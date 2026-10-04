import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_rbac_and_user_creation(client: AsyncClient, admin_token: str, user_token: str):
    # Non-admin attempting admin endpoint -> 403 Forbidden
    resp = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 403

    # Admin accessing user list -> 200 OK
    resp = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    users = resp.json()
    assert isinstance(users, list)
    assert len(users) >= 1

    # Admin creating user
    import uuid
    unique_email = f"newalgo_{uuid.uuid4().hex[:6]}@trader.in"
    new_user_payload = {
        "email": unique_email,
        "password": "StrongPassword!2026",
        "full_name": "New Algo Trader",
        "role": "user"
    }
    resp = await client.post("/api/admin/users", json=new_user_payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 201
    created = resp.json()
    assert created["email"] == unique_email
    assert created["role"] == "user"
    # Ensure masked identifier exists
    assert len(created["broker_accounts"]) > 0
    assert "MOCK" in created["broker_accounts"][0]["masked_identifier"]


@pytest.mark.asyncio
async def test_market_api_quotes_and_option_chain(client: AsyncClient, user_token: str):
    # Quotes
    resp = await client.get("/api/market/quotes", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 200
    quotes = resp.json()
    assert len(quotes) >= 3
    symbols = [q["symbol"] for q in quotes]
    assert "NIFTY 50" in symbols

    # Option chain for NIFTY
    resp = await client.get("/api/market/option-chain?underlying=NIFTY", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 200
    chain = resp.json()
    assert chain["underlying"] == "NIFTY"
    assert len(chain["strikes"]) > 0

    # Expiries
    resp = await client.get("/api/market/expiries?underlying=NIFTY", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 200
    expiries = resp.json()
    assert len(expiries) > 0


@pytest.mark.asyncio
async def test_backtest_api_endpoints(client: AsyncClient, user_token: str):
    # Strategies
    resp = await client.get("/api/backtest/strategies", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 200
    strats = resp.json()
    assert len(strats) >= 3

    # Datasets
    resp = await client.get("/api/backtest/datasets", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 200
    datasets = resp.json()
    assert "NIFTY" in datasets

    # Run backtest
    bt_payload = {
        "strategy_id": "sma_crossover",
        "symbol": "NIFTY",
        "timeframe": "1d",
        "initial_capital": 500000.0,
        "slippage_pct": 0.0005,
        "brokerage_per_order": 20.0,
        "segment": "equity_intraday"
    }
    resp = await client.post("/api/backtest/run", json=bt_payload, headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 200
    report = resp.json()
    assert "metrics" in report
    assert "trades" in report
    assert "equity_curve" in report
    assert "run_id" in report

    # Check history
    resp = await client.get("/api/backtest/history", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) >= 1
