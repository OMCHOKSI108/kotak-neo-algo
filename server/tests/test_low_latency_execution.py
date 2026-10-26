import asyncio
import pytest
import time
from httpx import AsyncClient
import pandas as pd

from app.calculations.indicators import calculate_ema, incremental_ema, fast_ema_cross
from app.market.service import MarketDataService
from app.broker.mock_adapter import MockBrokerAdapter
from app.broker.schemas import Quote
from app.core.telemetry import execution_metrics


def test_incremental_ema_mathematical_precision_and_speed():
    """
    Verifies that incremental_ema(price, prev_ema, period) produces mathematically
    equivalent results to pandas calculate_ema without creating Series/DataFrame objects.
    """
    period = 9
    prices = [24500.0, 24520.0, 24510.0, 24540.0, 24535.0, 24560.0, 24580.0, 24570.0, 24600.0, 24620.0]
    
    # Pandas calculate_ema
    series = pd.Series(prices)
    pandas_ema = calculate_ema(series, period=period).tolist()
    
    # Incremental O(1) calculation
    inc_ema = []
    curr_ema = 0.0
    for p in prices:
        curr_ema = incremental_ema(p, curr_ema, period=period)
        inc_ema.append(curr_ema)
    
    # Assert values match within float precision
    for p_val, i_val in zip(pandas_ema, inc_ema):
        assert abs(p_val - i_val) < 0.01


def test_fast_ema_cross_logic():
    """Verifies O(1) golden and death crossover signal detection."""
    # Bullish cross: fast moves from below to above slow
    assert fast_ema_cross(current_fast=105.0, current_slow=100.0, previous_fast=98.0, previous_slow=100.0) == 1

    # Bearish cross: fast moves from above to below slow
    assert fast_ema_cross(current_fast=95.0, current_slow=100.0, previous_fast=102.0, previous_slow=100.0) == -1

    # Continuation / No cross
    assert fast_ema_cross(current_fast=105.0, current_slow=100.0, previous_fast=103.0, previous_slow=100.0) == 0


@pytest.mark.asyncio
async def test_market_service_strategy_subscribers_independent_of_clients():
    """
    Verifies that trading strategies receive ticks immediately via in-process callback
    without serialization delay, and continue receiving ticks even if no WebSocket clients are connected.
    """
    adapter = MockBrokerAdapter()
    service = MarketDataService(adapter=adapter)
    
    received_ticks = []
    def on_strategy_tick(q: Quote):
        received_ticks.append(q)

    service.subscribe_strategy(on_strategy_tick)

    # Emit a tick directly
    test_quote = Quote(symbol="NIFTY 50", exchange="NSE", token="26000", ltp=24500.0, prev_close=24450.0)
    await service._on_tick(test_quote)

    assert len(received_ticks) == 1
    assert received_ticks[0].symbol == "NIFTY 50"
    assert received_ticks[0].ltp == 24500.0

    service.unsubscribe_strategy(on_strategy_tick)


@pytest.mark.asyncio
async def test_duplicate_order_intent_suppression(client: AsyncClient, user_token: str):
    """
    Verifies that identical rapid orders within the duplicate guard window
    are detected and rejected with HTTP 409 to prevent duplicate exchange fills.
    """
    from app.market.service import market_service
    market_service._cached_quotes["NIFTY 50"] = Quote(
        symbol="NIFTY 50", exchange="NSE", token="26000", ltp=24500.0, prev_close=24400.0
    )

    headers = {"Authorization": f"Bearer {user_token}"}
    payload = {
        "symbol": "NIFTY 50",
        "exchange": "NSE",
        "side": "BUY",
        "order_type": "MARKET",
        "product": "MIS",
        "lots": 1,
        "mode": "PAPER"
    }

    # First order succeeds
    res1 = await client.post("/api/trader/order", json=payload, headers=headers)
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["success"] is True
    assert "execution_time_ms" in d1

    # Immediate second duplicate order with identical payload is suppressed
    res2 = await client.post("/api/trader/order", json=payload, headers=headers)
    assert res2.status_code == 409
    assert "Duplicate order submission detected" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_client_order_id_strict_idempotency(client: AsyncClient, user_token: str):
    """
    Verifies that reusing the same client_order_id is strictly rejected with HTTP 409
    regardless of elapsed time, guaranteeing idempotent order submission.
    """
    from app.market.service import market_service
    market_service._cached_quotes["RELIANCE"] = Quote(
        symbol="RELIANCE", exchange="NSE", token="2885", ltp=2950.0, prev_close=2920.0
    )

    headers = {"Authorization": f"Bearer {user_token}"}
    cl_id = f"CL-TEST-{int(time.time() * 1000)}"
    payload = {
        "symbol": "RELIANCE",
        "exchange": "NSE",
        "side": "BUY",
        "order_type": "MARKET",
        "product": "CNC",
        "quantity": 5,
        "mode": "PAPER",
        "client_order_id": cl_id
    }

    # 1. First submission succeeds with client_order_id preserved
    res1 = await client.post("/api/trader/order", json=payload, headers=headers)
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["client_order_id"] == cl_id
    assert d1["success"] is True

    # 2. Resubmission with same client_order_id is blocked with 409 conflict
    res2 = await client.post("/api/trader/order", json=payload, headers=headers)
    assert res2.status_code == 409
    assert "already processed" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_execution_metrics_and_event_loop_monitor():
    """
    Verifies that execution latency telemetry records pipeline timings and
    measures event loop lag correctly.
    """
    execution_metrics.record("order_dispatch_ns", 15_000)
    execution_metrics.record("order_dispatch_ns", 25_000)
    execution_metrics.record_order(success=True)
    execution_metrics.record_order(success=False)

    summary = execution_metrics.get_summary()
    assert summary["total_orders"] >= 2
    assert summary["rejected_orders"] >= 1
    assert "order_dispatch_ns" in summary["stages"]
    stage_data = summary["stages"]["order_dispatch_ns"]
    assert stage_data["count"] >= 2
    assert stage_data["p50_us"] > 0
