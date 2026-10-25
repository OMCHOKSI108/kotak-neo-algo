import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from app.models.models import User, TradeRecord


@pytest.mark.asyncio
async def test_analytics_empty_state_without_fabrication(client: AsyncClient, user_token: str, db_session: AsyncSession):
    headers = {"Authorization": f"Bearer {user_token}"}
    me_resp = await client.get("/api/auth/me", headers=headers)
    user_id = me_resp.json()["id"]

    # Clear any previous test trades for clean isolation
    await db_session.execute(delete(TradeRecord).where(TradeRecord.user_id == user_id))
    await db_session.commit()

    resp = await client.get("/api/analytics?period=all", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["net_pnl"] == 0.0
    assert data["total_trades"] == 0
    assert data["win_rate"] == 0.0
    assert data["equity_curve"] == []
    assert data["strategy_breakdown"] == []


@pytest.mark.asyncio
async def test_analytics_with_actual_trades(client: AsyncClient, user_token: str, db_session: AsyncSession):
    headers = {"Authorization": f"Bearer {user_token}"}

    # Fetch user id from token
    me_resp = await client.get("/api/auth/me", headers=headers)
    user_id = me_resp.json()["id"]

    # Clear previous trades for isolated test
    await db_session.execute(delete(TradeRecord).where(TradeRecord.user_id == user_id))
    await db_session.commit()

    now = datetime.now(timezone.utc)
    # Add winning trade
    t1 = TradeRecord(
        user_id=user_id,
        symbol="NIFTY",
        side="BUY",
        quantity=65,
        entry_price=22000.0,
        exit_price=22100.0,
        pnl=6500.0,
        pnl_percent=0.45,
        entry_time=now - timedelta(hours=2),
        exit_time=now - timedelta(hours=1),
        exit_reason="TARGET",
        mode="PAPER"
    )
    # Add losing trade
    t2 = TradeRecord(
        user_id=user_id,
        symbol="BANKNIFTY",
        side="BUY",
        quantity=30,
        entry_price=54000.0,
        exit_price=53900.0,
        pnl=-3000.0,
        pnl_percent=-0.18,
        entry_time=now - timedelta(hours=1),
        exit_time=now,
        exit_reason="STOP_LOSS",
        mode="PAPER"
    )
    db_session.add(t1)
    db_session.add(t2)
    await db_session.commit()

    resp = await client.get("/api/analytics?period=today", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_trades"] == 2
    assert data["net_pnl"] == 3500.0
    assert data["gross_profit"] == 6500.0
    assert data["gross_loss"] == -3000.0
    assert data["win_rate"] == 50.0
    assert data["profit_factor"] == pytest.approx(6500.0 / 3000.0, rel=1e-2)
