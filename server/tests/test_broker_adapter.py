import pytest
import asyncio
from app.broker.mock_adapter import MockBrokerAdapter
from app.broker.schemas import OrderRequest
from app.core.config import settings


@pytest.mark.asyncio
async def test_mock_broker_authentication_and_profile():
    adapter = MockBrokerAdapter()
    auth_res = await adapter.authenticate({})
    assert auth_res.is_authenticated is True
    assert auth_res.broker_name == "mock_broker"

    profile = await adapter.get_profile()
    assert profile.client_id == "MOCK_TRADER_001"
    assert profile.available_margin > 0


@pytest.mark.asyncio
async def test_mock_broker_quotes():
    adapter = MockBrokerAdapter()
    symbols = ["NIFTY 50", "BANKNIFTY", "SENSEX", "RELIANCE"]
    quotes = await adapter.get_quotes(symbols)

    assert len(quotes) == 4
    quote_map = {q.symbol: q for q in quotes}

    assert "NIFTY 50" in quote_map
    assert quote_map["NIFTY 50"].ltp > 20000.0
    assert quote_map["BANKNIFTY"].ltp > 45000.0
    assert quote_map["SENSEX"].ltp > 70000.0
    assert quote_map["RELIANCE"].ltp > 2000.0

    for q in quotes:
        assert q.bid is not None
        assert q.ask is not None
        assert q.volume > 0


@pytest.mark.asyncio
async def test_mock_broker_option_chain():
    adapter = MockBrokerAdapter()
    expiries = await adapter.get_expiries("NIFTY")
    assert len(expiries) > 0

    chain = await adapter.get_option_chain("NIFTY", expiries[0])
    assert chain.underlying == "NIFTY"
    assert chain.underlying_ltp > 0
    assert len(chain.strikes) > 0

    mid_strike = chain.strikes[len(chain.strikes) // 2]
    assert mid_strike.call is not None
    assert mid_strike.put is not None
    assert mid_strike.call.ltp > 0
    assert mid_strike.put.ltp > 0
    assert mid_strike.call.open_interest is not None
    assert mid_strike.put.open_interest is not None


@pytest.mark.asyncio
async def test_mock_broker_paper_order_execution():
    adapter = MockBrokerAdapter()
    req = OrderRequest(
        symbol="NIFTY 50",
        exchange="NSE",
        transaction_type="BUY",
        order_type="MARKET",
        product="MIS",
        quantity=50
    )
    result = await adapter.place_order(req)
    assert result.success is True
    assert result.status == "COMPLETE"
    assert result.order_id is not None

    orders = await adapter.get_orders()
    assert len(orders) > 0
    assert orders[0].order_id == result.order_id


@pytest.mark.asyncio
async def test_mock_broker_market_data_subscription():
    adapter = MockBrokerAdapter()
    received_ticks = []

    def on_tick(q):
        received_ticks.append(q)

    await adapter.subscribe_market_data(["NIFTY 50"], on_tick)
    # Allow background simulator task to fire at least once
    await asyncio.sleep(2.0)
    await adapter.unsubscribe_market_data(["NIFTY 50"])

    assert len(received_ticks) >= 1
    assert received_ticks[0].symbol == "NIFTY 50"
