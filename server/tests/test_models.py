import pytest
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.models import (
    User, BrokerAccount, UserTradingSettings,
    Strategy, OrderRecord, PositionRecord, TradeRecord
)


@pytest.mark.asyncio
async def test_database_models_creation(db_session: AsyncSession):
    # 0. Clean up any existing record
    await db_session.execute(delete(User).where(User.email == "trader_models_test@neoalgo.local"))
    await db_session.commit()

    # 1. Create a test user
    user = User(
        email="trader_models_test@neoalgo.local",
        hashed_password="hashed_pw_test",
        full_name="Model Test Trader",
        role="user",
        is_active=True
    )
    db_session.add(user)
    await db_session.flush()

    # 2. Create UserTradingSettings
    settings = UserTradingSettings(
        user_id=user.id,
        trading_mode="PAPER",
        live_trading_enabled=False,
        nifty_lots=2,
        banknifty_lots=1,
        sensex_lots=1,
        max_daily_loss=4000.0,
        max_daily_trades=8
    )
    db_session.add(settings)

    # 3. Create Strategy (9/15 EMA)
    strat = Strategy(
        user_id=user.id,
        name="NIFTY 9/15 EMA",
        description="Exponential moving average 9/15 crossover",
        instrument="NIFTY",
        timeframe="5m",
        mode="PAPER",
        status="READY",
        fast_ema=9,
        slow_ema=15,
        lots=2,
        stop_loss=20.0,
        target=40.0
    )
    db_session.add(strat)
    await db_session.flush()

    # 4. Create OrderRecord
    order = OrderRecord(
        user_id=user.id,
        strategy_id=strat.id,
        order_id="ORD-1001",
        symbol="NIFTY26OCT22400CE",
        exchange="NSE",
        side="BUY",
        order_type="MARKET",
        product="MIS",
        quantity=130,
        lots=2,
        price=150.0,
        status="EXECUTED",
        mode="PAPER"
    )
    db_session.add(order)

    # 5. Create PositionRecord
    pos = PositionRecord(
        user_id=user.id,
        strategy_id=strat.id,
        symbol="NIFTY26OCT22400CE",
        exchange="NSE",
        product="MIS",
        side="BUY",
        quantity=130,
        buy_avg_price=150.0,
        ltp=155.0,
        pnl=650.0,
        status="OPEN",
        mode="PAPER"
    )
    db_session.add(pos)

    # 6. Create TradeRecord
    now = datetime.now(timezone.utc)
    trade = TradeRecord(
        user_id=user.id,
        strategy_id=strat.id,
        symbol="NIFTY26OCT22400CE",
        side="BUY",
        quantity=130,
        entry_price=150.0,
        exit_price=158.0,
        pnl=1040.0,
        pnl_percent=5.33,
        entry_time=now,
        exit_time=now,
        exit_reason="TARGET",
        mode="PAPER"
    )
    db_session.add(trade)

    await db_session.commit()

    # Query back
    stmt = select(UserTradingSettings).where(UserTradingSettings.user_id == user.id)
    res = await db_session.execute(stmt)
    saved_settings = res.scalar_one()
    assert saved_settings.nifty_lots == 2
    assert saved_settings.trading_mode == "PAPER"

    stmt_strat = select(Strategy).where(Strategy.user_id == user.id)
    res_strat = await db_session.execute(stmt_strat)
    saved_strat = res_strat.scalar_one()
    assert saved_strat.name == "NIFTY 9/15 EMA"
    assert saved_strat.fast_ema == 9
