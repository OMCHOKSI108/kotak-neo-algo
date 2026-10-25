import pytest
from httpx import AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import User


@pytest.mark.asyncio
async def test_admin_flow_a_and_flow_b_user_creation(client: AsyncClient, admin_token: str, db_session: AsyncSession):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Clean up any previous test accounts
    await db_session.execute(delete(User).where(User.email.in_(["flow_b_trader@neoalgo.local", "flow_a_trader@neoalgo.local"])))
    await db_session.commit()

    # FLOW B: Create user without broker configuration (user configures later)
    flow_b_payload = {
        "email": "flow_b_trader@neoalgo.local",
        "password": "Password123!",
        "full_name": "Flow B Trader",
        "role": "user",
        "configure_broker": False
    }
    resp_b = await client.post("/api/admin/users", json=flow_b_payload, headers=headers)
    assert resp_b.status_code == 201
    user_b = resp_b.json()
    assert user_b["email"] == "flow_b_trader@neoalgo.local"
    assert len(user_b["broker_accounts"]) == 0

    # FLOW A: Create user WITH Kotak Neo broker configuration
    flow_a_payload = {
        "email": "flow_a_trader@neoalgo.local",
        "password": "Password123!",
        "full_name": "Flow A Trader",
        "role": "user",
        "configure_broker": True,
        "broker": "KOTAK_NEO",
        "consumer_key": "sample-consumer-key-12345",
        "mobile_number": "9876543210",
        "ucc": "W6BCV",
        "mpin": "181130"
    }
    resp_a = await client.post("/api/admin/users", json=flow_a_payload, headers=headers)
    assert resp_a.status_code == 201
    user_a = resp_a.json()
    assert user_a["email"] == "flow_a_trader@neoalgo.local"
    assert len(user_a["broker_accounts"]) == 1
    ba = user_a["broker_accounts"][0]
    assert ba["broker"] == "KOTAK_NEO"
    assert ba["masked_identifier"] == "*****BCV"

    # Reset password test
    reset_resp = await client.post(
        f"/api/admin/users/{user_a['id']}/reset-password",
        json={"new_password": "NewSecretPass456!"},
        headers=headers
    )
    assert reset_resp.status_code == 200
    assert reset_resp.json()["success"] is True
