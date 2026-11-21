import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_and_update_trader_settings(client: AsyncClient, user_token: str):
    headers = {"Authorization": f"Bearer {user_token}"}

    # 1. Get settings (auto-creates defaults if none exist)
    resp = await client.get("/api/trader/settings", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["trading_mode"] == "PAPER"
    assert data["nifty_lots"] >= 1
    assert "calculated_quantities" in data
    assert data["calculated_quantities"]["NIFTY"] == data["nifty_lots"] * 65

    # 2. Update settings (change lots and risk limit)
    update_payload = {
        "nifty_lots": 2,
        "banknifty_lots": 3,
        "sensex_lots": 1,
        "max_daily_loss": 8000.0,
        "max_daily_trades": 15,
        "max_loss_per_trade": 2000.0
    }
    update_resp = await client.post("/api/trader/settings", json=update_payload, headers=headers)
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["nifty_lots"] == 2
    assert updated_data["banknifty_lots"] == 3
    assert updated_data["max_daily_loss"] == 8000.0
    assert updated_data["calculated_quantities"]["NIFTY"] == 130  # 2 * 65
    assert updated_data["calculated_quantities"]["BANKNIFTY"] == 90  # 3 * 30


@pytest.mark.asyncio
async def test_trader_lot_sizes_endpoint(client: AsyncClient, user_token: str):
    headers = {"Authorization": f"Bearer {user_token}"}
    resp = await client.get("/api/trader/lots", headers=headers)
    assert resp.status_code == 200
    lots = resp.json()
    assert lots["NIFTY"] == 65
    assert lots["BANKNIFTY"] == 30
    assert lots["SENSEX"] == 20


@pytest.mark.asyncio
async def test_paper_order_execution_and_positions(client: AsyncClient, user_token: str):
    headers = {"Authorization": f"Bearer {user_token}"}

    import uuid
    test_symbol = f"NIFTY26OCT22400CE_{uuid.uuid4().hex[:6].upper()}"

    # Place a paper BUY order
    order_payload = {
        "symbol": test_symbol,
        "exchange": "NSE",
        "side": "BUY",
        "order_type": "MARKET",
        "product": "MIS",
        "lots": 1,
        "price": 160.0,
        "stop_loss": 140.0,
        "target": 200.0,
        "mode": "PAPER"
    }
    resp = await client.post("/api/trader/order", json=order_payload, headers=headers)
    assert resp.status_code == 200
    order_data = resp.json()
    assert order_data["success"] is True
    assert order_data["status"] == "EXECUTED"
    assert order_data["mode"] == "PAPER"
    assert order_data["quantity"] == 65

    # Check orders list
    orders_resp = await client.get("/api/trader/orders", headers=headers)
    assert orders_resp.status_code == 200
    orders = orders_resp.json()
    assert len(orders) >= 1
    assert any(o["symbol"] == test_symbol for o in orders)

    # Check positions list
    pos_resp = await client.get("/api/trader/positions", headers=headers)
    assert pos_resp.status_code == 200
    pos_data = pos_resp.json()
    positions = pos_data["positions"]
    assert len(positions) >= 1
    target_pos = next((p for p in positions if p["symbol"] == test_symbol and p["status"] == "OPEN"), None)
    assert target_pos is not None
    assert target_pos["quantity"] == 65
    assert target_pos["status"] == "OPEN"

    # Square off the position
    sq_resp = await client.post(f"/api/trader/positions/{target_pos['id']}/square-off", headers=headers)
    assert sq_resp.status_code == 200
    assert sq_resp.json()["success"] is True

    # Check that position is now closed
    pos_resp_after = await client.get("/api/trader/positions", headers=headers)
    pos_after = pos_resp_after.json()["positions"]
    sq_pos = next((p for p in pos_after if p["id"] == target_pos["id"]), None)
    assert sq_pos is not None
    assert sq_pos["status"] == "CLOSED"


@pytest.mark.asyncio
async def test_spot_index_order_rejected(client: AsyncClient, user_token: str):
    headers = {"Authorization": f"Bearer {user_token}"}
    order_payload = {
        "symbol": "NIFTY",
        "exchange": "NSE",
        "side": "BUY",
        "order_type": "MARKET",
        "product": "MIS",
        "lots": 1,
        "mode": "PAPER"
    }
    resp = await client.post("/api/trader/order", json=order_payload, headers=headers)
    assert resp.status_code == 400
    assert "non-tradable spot index" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_option_market_order_with_token_and_ltp(client: AsyncClient, user_token: str):
    headers = {"Authorization": f"Bearer {user_token}"}
    order_payload = {
        "symbol": "NIFTY 25800 CE",
        "token": "45678",
        "exchange_segment": "nse_fo",
        "side": "BUY",
        "order_type": "MARKET",
        "product": "MIS",
        "lots": 1,
        "ltp": 102.55,
        "mode": "PAPER"
    }
    resp = await client.post("/api/trader/order", json=order_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["status"] == "EXECUTED"
    assert data["mode"] == "PAPER"
    assert data["price"] == 102.55


@pytest.mark.asyncio
async def test_live_order_rejected_when_insufficient_margin(client: AsyncClient, user_token: str):
    from app.core.config import settings
    from unittest.mock import AsyncMock, MagicMock
    from app.market.service import market_service
    from app.broker.schemas import BrokerProfile

    headers = {"Authorization": f"Bearer {user_token}"}
    order_payload = {
        "symbol": "NIFTY 25800 CE",
        "token": "45678",
        "exchange_segment": "nse_fo",
        "side": "BUY",
        "order_type": "MARKET",
        "product": "MIS",
        "lots": 1,
        "ltp": 102.55,
        "mode": "LIVE"
    }

    # 1. Without TRADING_ENABLED, server safety guardrail blocks live order
    order_payload1 = {**order_payload, "client_order_id": "test-live-guard-1"}
    resp1 = await client.post("/api/trader/order", json=order_payload1, headers=headers)
    assert resp1.status_code == 400
    assert "Live execution is disabled by server safety guardrail" in resp1.json()["detail"]

    # 2. With TRADING_ENABLED=True & live_trading_enabled=True, margin pre-check blocks order if margin is zero
    orig_trading_enabled = settings.TRADING_ENABLED
    orig_adapter = market_service.adapter
    try:
        settings.TRADING_ENABLED = True

        # Enable live trading in user settings
        await client.post("/api/trader/settings", json={"live_trading_enabled": True}, headers=headers)

        # Mock adapter profile to return 0 margin
        mock_profile = BrokerProfile(
            client_id="TEST_UCC",
            client_name="Test User",
            broker_name="mock_broker",
            available_margin=0.0,
            used_margin=0.0,
            cash=0.0,
            is_live=True
        )
        mock_adapter = MagicMock()
        mock_adapter.is_connected = True
        mock_adapter.get_profile = AsyncMock(return_value=mock_profile)
        market_service._adapter = mock_adapter

        order_payload2 = {**order_payload, "client_order_id": "test-live-guard-2"}
        resp2 = await client.post("/api/trader/order", json=order_payload2, headers=headers)
        assert resp2.status_code == 400
        assert "Insufficient broker margin" in resp2.json()["detail"]
    finally:
        settings.TRADING_ENABLED = orig_trading_enabled
        market_service._adapter = orig_adapter


