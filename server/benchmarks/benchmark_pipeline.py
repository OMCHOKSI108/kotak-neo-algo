"""
Comprehensive Execution Pipeline Benchmark for Kotak Neo Algo Platform.
Measures latency (p50, p95, p99, max, mean) across each segment of the execution path:
1. Market Data Normalization & Ingestion
2. In-Memory Quote Cache Lookup
3. Strategy Evaluation (EMA / Indicator Signal)
4. Risk Validation (Lot sizes & Limits)
5. Order Construction & Adapter Dispatch (MockBrokerAdapter)
6. WebSocket Fan-Out Latency (Simulating connected React clients)
7. End-to-End Processing Latency (Tick -> Risk -> Order -> Acknowledged)
"""

import asyncio
import time
import statistics
import numpy as np
from typing import List, Dict, Any

from app.broker.schemas import Quote, OrderRequest
from app.broker.mock_adapter import MockBrokerAdapter
from app.market.service import MarketDataService
from app.calculations.risk import calculate_indian_transaction_charges, calculate_slippage
from app.calculations.indicators import calculate_ema


def format_stats(latencies_ns: List[int], name: str) -> Dict[str, float]:
    """Calculates p50, p95, p99, max, mean in microseconds (us)."""
    if not latencies_ns:
        return {}
    us = [ns / 1_000.0 for ns in latencies_ns]
    return {
        "metric": name,
        "count": len(us),
        "p50_us": round(float(np.percentile(us, 50)), 2),
        "p95_us": round(float(np.percentile(us, 95)), 2),
        "p99_us": round(float(np.percentile(us, 99)), 2),
        "max_us": round(float(max(us)), 2),
        "mean_us": round(float(statistics.mean(us)), 2),
    }


class MockWebSocketClient:
    """Simulates a React client connected via /ws/market."""
    def __init__(self, slow_delay_s: float = 0.0):
        self.slow_delay_s = slow_delay_s
        self.messages_received = 0

    async def send_json(self, data: Dict[str, Any]):
        if self.slow_delay_s > 0:
            await asyncio.sleep(self.slow_delay_s)
        self.messages_received += 1


async def benchmark_market_data_normalization(iterations: int = 1000) -> List[int]:
    """Measures time to construct and normalize raw broker tick into a Quote schema."""
    latencies = []
    for i in range(iterations):
        t0 = time.perf_counter_ns()
        q = Quote(
            symbol="NIFTY 50",
            exchange="NSE",
            token="26000",
            ltp=24500.0 + (i % 50),
            open=24450.0,
            high=24550.0,
            low=24420.0,
            prev_close=24400.0,
            change=100.0,
            change_percent=0.41,
            volume=5000000 + i * 100
        )
        t1 = time.perf_counter_ns()
        latencies.append(t1 - t0)
    return latencies


async def benchmark_quote_cache_lookup(market_svc: MarketDataService, iterations: int = 1000) -> List[int]:
    """Measures retrieval of quote from in-memory cache."""
    latencies = []
    syms = ["NIFTY 50", "BANKNIFTY", "RELIANCE", "TCS"]
    for i in range(iterations):
        sym = syms[i % len(syms)]
        t0 = time.perf_counter_ns()
        quote = market_svc._cached_quotes.get(sym.upper())
        t1 = time.perf_counter_ns()
        latencies.append(t1 - t0)
    return latencies


async def benchmark_strategy_evaluation(iterations: int = 1000) -> List[int]:
    """Measures legacy pandas series EMA calculation on incoming tick."""
    import pandas as pd
    prices = [24500.0 + (j % 30) for j in range(50)]
    s = pd.Series(prices)
    latencies = []
    for _ in range(iterations):
        t0 = time.perf_counter_ns()
        fast_ema = calculate_ema(s, period=9).iloc[-1]
        slow_ema = calculate_ema(s, period=15).iloc[-1]
        signal = 1 if fast_ema > slow_ema else (-1 if fast_ema < slow_ema else 0)
        t1 = time.perf_counter_ns()
        latencies.append(t1 - t0)
    return latencies


async def benchmark_incremental_strategy_evaluation(iterations: int = 1000) -> List[int]:
    """Measures optimized incremental O(1) EMA calculation on incoming tick."""
    from app.calculations.indicators import incremental_ema, fast_ema_cross
    latencies = []
    f_ema = 24500.0
    s_ema = 24490.0
    prev_f = 24495.0
    prev_s = 24492.0
    price = 24510.0

    for _ in range(iterations):
        t0 = time.perf_counter_ns()
        new_f = incremental_ema(price, f_ema, period=9)
        new_s = incremental_ema(price, s_ema, period=15)
        signal = fast_ema_cross(new_f, new_s, prev_f, prev_s)
        t1 = time.perf_counter_ns()
        latencies.append(t1 - t0)
    return latencies


async def benchmark_risk_validation(iterations: int = 1000) -> List[int]:
    """Measures risk authorization and transaction charge calculation."""
    latencies = []
    for i in range(iterations):
        t0 = time.perf_counter_ns()
        charges = calculate_indian_transaction_charges(
            turnover=24500.0 * 25,
            side="BUY",
            segment="options"
        )
        slippage = calculate_slippage(price=24500.0, side="BUY", slippage_pct=0.0005)
        # Check daily risk limit
        is_safe = charges["total_charges"] < 500.0 and slippage > 0
        t1 = time.perf_counter_ns()
        latencies.append(t1 - t0)
    return latencies


async def benchmark_order_dispatch(adapter: MockBrokerAdapter, iterations: int = 1000) -> List[int]:
    """Measures order construction and adapter dispatch."""
    latencies = []
    for i in range(iterations):
        req = OrderRequest(
            symbol="NIFTY24DEC24500CE",
            exchange="NSE",
            transaction_type="BUY",
            order_type="MARKET",
            product="MIS",
            quantity=25,
            price=0.0
        )
        t0 = time.perf_counter_ns()
        res = await adapter.place_order(req)
        t1 = time.perf_counter_ns()
        latencies.append(t1 - t0)
    return latencies


async def benchmark_websocket_fanout(market_svc: MarketDataService, num_clients: int = 5, iterations: int = 200) -> List[int]:
    """Measures sequential WebSocket broadcasting across multiple clients."""
    # Register mock WebSocket clients
    market_svc._active_connections.clear()
    clients = [MockWebSocketClient(slow_delay_s=0.0) for _ in range(num_clients)]
    market_svc._active_connections.update(clients)

    q = Quote(
        symbol="NIFTY 50", exchange="NSE", token="26000",
        ltp=24520.0, prev_close=24400.0
    )

    latencies = []
    for _ in range(iterations):
        t0 = time.perf_counter_ns()
        await market_svc._broadcast_tick(q)
        t1 = time.perf_counter_ns()
        latencies.append(t1 - t0)

    market_svc._active_connections.clear()
    return latencies


async def benchmark_end_to_end_pipeline(market_svc: MarketDataService, adapter: MockBrokerAdapter, iterations: int = 500) -> List[int]:
    """
    Measures complete hot path:
    Incoming Tick -> Quote Cache Update -> Strategy Signal -> Risk Check -> Order Dispatch -> Result Acknowledged.
    """
    latencies = []
    import pandas as pd
    series = pd.Series([24500.0 + (j % 20) for j in range(30)])

    for i in range(iterations):
        t0 = time.perf_counter_ns()

        # 1. Market Data received & normalized
        q = Quote(
            symbol="NIFTY 50", exchange="NSE", token="26000",
            ltp=24500.0 + (i % 25), prev_close=24400.0, volume=1000000 + i
        )
        market_svc._cached_quotes[q.symbol.upper()] = q

        # 2. Strategy evaluation
        fast_ema = float(series.iloc[-1])
        slow_ema = float(series.iloc[-5])
        signal = "BUY" if fast_ema >= slow_ema else "SELL"

        # 3. Risk check
        lot_size = 25
        qty = 1 * lot_size
        charges = calculate_indian_transaction_charges(turnover=q.ltp * qty, side=signal, segment="options")
        if charges["total_charges"] > 1000.0:
            continue

        # 4. Order dispatch to broker
        order_req = OrderRequest(
            symbol="NIFTY24DEC24500CE",
            exchange="NSE",
            transaction_type=signal,
            order_type="MARKET",
            product="MIS",
            quantity=qty,
            price=0.0
        )
        res = await adapter.place_order(order_req)
        assert res.success is True

        t1 = time.perf_counter_ns()
        latencies.append(t1 - t0)

    return latencies


async def run_all_benchmarks(title: str = "BASELINE EXECUTION PIPELINE BENCHMARK"):
    print("=" * 80)
    print(f"  🚀 {title}")
    print("=" * 80)

    adapter = MockBrokerAdapter()
    market_svc = MarketDataService(adapter=adapter)
    await market_svc.start()

    # Warmup
    await benchmark_market_data_normalization(iterations=100)
    await benchmark_strategy_evaluation(iterations=100)

    # 1. Market Data Normalization
    norm_latencies = await benchmark_market_data_normalization(iterations=1000)
    stats_norm = format_stats(norm_latencies, "Market Data Normalization (Pydantic Quote)")

    # 2. In-Memory Quote Cache Lookup
    cache_latencies = await benchmark_quote_cache_lookup(market_svc, iterations=1000)
    stats_cache = format_stats(cache_latencies, "Quote In-Memory Cache Lookup")

    # 3. Strategy Evaluation (Pandas vs Incremental)
    strat_latencies = await benchmark_strategy_evaluation(iterations=1000)
    stats_strat = format_stats(strat_latencies, "Legacy Strategy Eval (Pandas Series EMA)")

    inc_strat_latencies = await benchmark_incremental_strategy_evaluation(iterations=1000)
    stats_inc_strat = format_stats(inc_strat_latencies, "Optimized Strategy Eval (Incremental O(1) EMA)")

    # 4. Risk Validation & Charges
    risk_latencies = await benchmark_risk_validation(iterations=1000)
    stats_risk = format_stats(risk_latencies, "Risk & Statutory Cost Check")

    # 5. Order Dispatch (MockBrokerAdapter)
    dispatch_latencies = await benchmark_order_dispatch(adapter, iterations=1000)
    stats_dispatch = format_stats(dispatch_latencies, "Order Construction & Broker Dispatch")

    # 6. WebSocket Fan-Out (5 clients)
    ws_latencies = await benchmark_websocket_fanout(market_svc, num_clients=5, iterations=500)
    stats_ws = format_stats(ws_latencies, "Optimized Async WebSocket Fan-Out (5 clients)")

    # 7. End-to-End Pipeline
    e2e_latencies = await benchmark_end_to_end_pipeline(market_svc, adapter, iterations=1000)
    stats_e2e = format_stats(e2e_latencies, "End-to-End Execution Pipeline (Tick to Order Ack)")

    # Output formatted table
    results = [stats_norm, stats_cache, stats_strat, stats_inc_strat, stats_risk, stats_dispatch, stats_ws, stats_e2e]
    print(f"{'Pipeline Stage':<45} | {'p50 (µs)':<10} | {'p95 (µs)':<10} | {'p99 (µs)':<10} | {'Max (µs)':<10} | {'Mean (µs)':<10}")
    print("-" * 105)
    for r in results:
        print(f"{r['metric']:<45} | {r['p50_us']:<10.2f} | {r['p95_us']:<10.2f} | {r['p99_us']:<10.2f} | {r['max_us']:<10.2f} | {r['mean_us']:<10.2f}")
    print("-" * 105)

    return results


if __name__ == "__main__":
    asyncio.run(run_all_benchmarks())
