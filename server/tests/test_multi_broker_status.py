import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock
from app.broker.kotak_neo import BrokerSession


from app.core.config import settings


@pytest.fixture(autouse=True)
def setup_multi_broker_env():
    orig_key = settings.KOTAK_CONSUMER_KEY
    orig_mob = settings.KOTAK_MOBILE_NUMBER
    orig_ucc = settings.KOTAK_UCC
    orig_mpin = settings.KOTAK_MPIN
    if not settings.KOTAK_CONSUMER_KEY:
        settings.KOTAK_CONSUMER_KEY = "mock_consumer_key"
    if not settings.KOTAK_MOBILE_NUMBER:
        settings.KOTAK_MOBILE_NUMBER = "+919999999999"
    if not settings.KOTAK_UCC:
        settings.KOTAK_UCC = "TESTUCC01"
    if not settings.KOTAK_MPIN:
        settings.KOTAK_MPIN = "123456"
    yield
    settings.KOTAK_CONSUMER_KEY = orig_key
    settings.KOTAK_MOBILE_NUMBER = orig_mob
    settings.KOTAK_UCC = orig_ucc
    settings.KOTAK_MPIN = orig_mpin


@pytest.mark.asyncio
async def test_get_brokers_status(client: AsyncClient, admin_token: str, user_token: str):
    # Admin checks status: should include .env broker
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp = await client.get("/api/brokers/status", headers=admin_headers)
    assert resp.status_code == 200
    brokers = resp.json()
    assert isinstance(brokers, list)

    # SuperAdmin should have the ENV broker in list
    env_brokers = [b for b in brokers if b.get("source") == "ENV"]
    assert len(env_brokers) >= 1
    env_b = env_brokers[0]
    assert env_b["brokerType"] == "kotak_neo"
    assert env_b["isPrimary"] is True
    assert env_b["authState"] in ("ACTIVE", "EXPIRED")
    assert "availableMargin" in env_b


@pytest.mark.asyncio
async def test_env_authenticate_authorization_and_validation(client: AsyncClient, user_token: str, admin_token: str):
    # Standard user cannot call env authenticate (403)
    user_headers = {"Authorization": f"Bearer {user_token}"}
    res_forbidden = await client.post(
        "/api/brokers/env/authenticate",
        json={"totp": "123456"},
        headers=user_headers
    )
    assert res_forbidden.status_code == 403

    # Admin with invalid TOTP length (422 / 400 validation error)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    res_invalid = await client.post(
        "/api/brokers/env/authenticate",
        json={"totp": "12"},
        headers=admin_headers
    )
    assert res_invalid.status_code in (400, 422)

    # Admin with valid 6-digit TOTP (mocking login)
    mock_session = BrokerSession(
        status="CONNECTED",
        trading_token="test_tt",
        trading_sid="test_ts",
        view_token="test_vt",
        view_sid="test_vs",
        base_url="https://api.kotak.com",
        data_center="mum",
        feed_url="wss://feed.kotak.com",
        message="Logged in"
    )

    with patch("app.broker.kotak_neo.login", new=AsyncMock(return_value=mock_session)):
        res_ok = await client.post(
            "/api/brokers/env/authenticate",
            json={"totp": "654321"},
            headers=admin_headers
        )
        assert res_ok.status_code == 200
        data = res_ok.json()
        assert data["success"] is True
        assert data["broker"]["authState"] == "ACTIVE"
        assert data["broker"]["source"] == "ENV"


@pytest.mark.asyncio
async def test_secondary_broker_lifecycle(client: AsyncClient, user_token: str):
    headers = {"Authorization": f"Bearer {user_token}"}

    # 1. Connect Upstox secondary broker
    upstox_payload = {
        "broker": "UPSTOX",
        "account_name": "My Secondary Upstox",
        "consumer_key": "UPSTOX_KEY_12345",
        "mpin": "UPSTOX_SECRET_67890",
        "totp": "UPSTOX_TOKEN_ABC",
        "environment": "prod"
    }
    connect_res = await client.post("/api/brokers/connect", json=upstox_payload, headers=headers)
    assert connect_res.status_code == 200
    conn_data = connect_res.json()
    assert conn_data["success"] is True
    assert conn_data["broker"] == "UPSTOX"
    acc_id = conn_data["account_id"]
    assert acc_id is not None

    # 2. Check status includes the new database broker
    status_res = await client.get("/api/brokers/status", headers=headers)
    assert status_res.status_code == 200
    broker_items = status_res.json()
    upstox_item = next((b for b in broker_items if b["id"] == str(acc_id)), None)
    assert upstox_item is not None
    assert upstox_item["brokerType"] == "upstox"
    assert upstox_item["source"] == "DATABASE"

    # 3. Activate as primary execution broker
    act_res = await client.post(f"/api/brokers/{acc_id}/activate", headers=headers)
    assert act_res.status_code == 200
    assert act_res.json()["success"] is True

    # 4. Disconnect broker
    disc_res = await client.post(f"/api/brokers/{acc_id}/disconnect", headers=headers)
    assert disc_res.status_code == 200
    assert disc_res.json()["success"] is True

    # 5. Delete broker
    del_res = await client.delete(f"/api/brokers/{acc_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True
