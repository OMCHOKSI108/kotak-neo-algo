import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import User, Strategy, AuditLog
from app.api.deps import get_current_user
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/strategies", tags=["Strategies Management"])


class StrategyResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    instrument: str
    timeframe: str
    mode: str
    status: str
    fast_ema: int
    slow_ema: int
    option_type: str
    strike_selection: str
    lots: int
    stop_loss: float
    target: float
    max_trades_per_day: int
    schedule_start: str
    schedule_end: str
    today_pnl: float
    total_pnl: float
    trades_count: int
    win_rate: float
    max_drawdown: float
    last_signal: Optional[str] = None
    last_signal_time: Optional[datetime] = None
    last_run_time: Optional[datetime] = None
    created_at: Optional[datetime] = None
    createdAt: Optional[datetime] = None
    parameters: Optional[Dict[str, Any]] = None
    default_symbol: Optional[str] = None
    default_timeframe: Optional[str] = None
    default_lot_size: Optional[int] = None
    default_num_lots: Optional[int] = None
    asset: Optional[str] = None
    lotSize: Optional[int] = None


def serialize_strategy(s: Strategy) -> Dict[str, Any]:
    lot_size = 25 if "NIFTY" in s.instrument.upper() and "BANK" not in s.instrument.upper() else (15 if "BANKNIFTY" in s.instrument.upper() else (10 if "SENSEX" in s.instrument.upper() else 1))
    params = {
        "fast_ema": s.fast_ema,
        "slow_ema": s.slow_ema,
        "stop_loss_pts": s.stop_loss,
        "target_pts": s.target,
        "max_trades_per_day": s.max_trades_per_day,
        "schedule_start": s.schedule_start,
        "schedule_end": s.schedule_end,
        "option_type": s.option_type,
        "strike_selection": s.strike_selection
    }
    if s.config and isinstance(s.config, dict):
        params.update(s.config)

    return {
        "id": s.id,
        "name": s.name,
        "description": s.description or "",
        "instrument": s.instrument,
        "asset": s.instrument,
        "timeframe": s.timeframe,
        "mode": s.mode,
        "status": s.status,
        "fast_ema": s.fast_ema,
        "slow_ema": s.slow_ema,
        "option_type": s.option_type,
        "strike_selection": s.strike_selection,
        "lots": s.lots,
        "stop_loss": s.stop_loss,
        "target": s.target,
        "max_trades_per_day": s.max_trades_per_day,
        "schedule_start": s.schedule_start,
        "schedule_end": s.schedule_end,
        "today_pnl": s.today_pnl,
        "total_pnl": s.total_pnl,
        "trades_count": s.trades_count,
        "win_rate": s.win_rate,
        "max_drawdown": s.max_drawdown,
        "last_signal": s.last_signal,
        "last_signal_time": s.last_signal_time,
        "last_run_time": s.last_run_time,
        "created_at": s.created_at,
        "createdAt": s.created_at,
        "parameters": params,
        "default_symbol": s.instrument,
        "default_timeframe": s.timeframe,
        "default_lot_size": lot_size,
        "default_num_lots": s.lots,
        "lotSize": lot_size,
    }


class CreateStrategyRequest(BaseModel):
    name: str
    description: Optional[str] = None
    instrument: str = "NIFTY"
    timeframe: str = "5m"
    fast_ema: int = 9
    slow_ema: int = 15
    option_type: str = "CALL"
    strike_selection: str = "ATM"
    lots: int = 1
    stop_loss: float = 20.0
    target: float = 40.0
    max_trades_per_day: int = 3
    schedule_start: str = "09:20"
    schedule_end: str = "15:15"


class UpdateStrategyRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instrument: Optional[str] = None
    timeframe: Optional[str] = None
    fast_ema: Optional[int] = None
    slow_ema: Optional[int] = None
    option_type: Optional[str] = None
    strike_selection: Optional[str] = None
    lots: Optional[int] = None
    stop_loss: Optional[float] = None
    target: Optional[float] = None
    max_trades_per_day: Optional[int] = None
    schedule_start: Optional[str] = None
    schedule_end: Optional[str] = None


class DeployStrategyRequest(BaseModel):
    mode: str = Field(..., description="PAPER or LIVE")


async def ensure_default_strategy(user_id: int, db: AsyncSession):
    stmt = select(Strategy).where(Strategy.user_id == user_id)
    res = await db.execute(stmt)
    existing = res.scalars().all()
    if not existing:
        default_strat = Strategy(
            user_id=user_id,
            name="NIFTY 9/15 EMA",
            description="Indian index trend-following algorithm buying CALLs on bullish 9/15 EMA cross and PUTs on bearish cross.",
            instrument="NIFTY",
            timeframe="5m",
            fast_ema=9,
            slow_ema=15,
            option_type="CALL",
            strike_selection="ATM",
            lots=1,
            stop_loss=20.0,
            target=40.0,
            max_trades_per_day=3,
            schedule_start="09:20",
            schedule_end="15:15",
            mode="PAPER",
            status="READY",
            today_pnl=0.0,
            total_pnl=0.0,
            trades_count=0,
            win_rate=0.0,
            max_drawdown=0.0
        )
        db.add(default_strat)
        await db.commit()


@router.get("", response_model=List[StrategyResponse])
@router.get("/", response_model=List[StrategyResponse])
async def list_user_strategies(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """List all configured algorithms for the user."""
    await ensure_default_strategy(user.id, db)
    stmt = select(Strategy).where(Strategy.user_id == user.id).order_by(Strategy.id.asc())
    res = await db.execute(stmt)
    return [serialize_strategy(s) for s in res.scalars().all()]


@router.post("", response_model=StrategyResponse)
@router.post("/", response_model=StrategyResponse)
async def create_user_strategy(
    req: CreateStrategyRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new strategy via Strategy Builder."""
    new_strat = Strategy(
        user_id=user.id,
        name=req.name,
        description=req.description,
        instrument=req.instrument,
        timeframe=req.timeframe,
        fast_ema=req.fast_ema,
        slow_ema=req.slow_ema,
        option_type=req.option_type,
        strike_selection=req.strike_selection,
        lots=req.lots,
        stop_loss=req.stop_loss,
        target=req.target,
        max_trades_per_day=req.max_trades_per_day,
        schedule_start=req.schedule_start,
        schedule_end=req.schedule_end,
        mode="PAPER",
        status="READY"
    )
    db.add(new_strat)
    await db.commit()
    await db.refresh(new_strat)

    audit = AuditLog(
        user_id=user.id,
        action="STRATEGY_CREATED",
        details={"strategy_id": new_strat.id, "name": new_strat.name}
    )
    db.add(audit)
    await db.commit()
    return new_strat


@router.put("/{strategy_id}", response_model=StrategyResponse)
async def update_user_strategy(
    strategy_id: int,
    req: UpdateStrategyRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update strategy parameters."""
    stmt = select(Strategy).where(and_(Strategy.id == strategy_id, Strategy.user_id == user.id))
    res = await db.execute(stmt)
    strat = res.scalar_one_or_none()
    if not strat:
        raise HTTPException(status_code=404, detail="Strategy not found.")

    for field, val in req.model_dump(exclude_unset=True).items():
        setattr(strat, field, val)

    await db.commit()
    await db.refresh(strat)
    return strat


@router.post("/{strategy_id}/deploy", response_model=StrategyResponse)
async def deploy_strategy(
    strategy_id: int,
    req: DeployStrategyRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Deploy algorithm to PAPER or LIVE execution."""
    stmt = select(Strategy).where(and_(Strategy.id == strategy_id, Strategy.user_id == user.id))
    res = await db.execute(stmt)
    strat = res.scalar_one_or_none()
    if not strat:
        raise HTTPException(status_code=404, detail="Strategy not found.")

    target_mode = req.mode.upper()
    if target_mode == "LIVE":
        if not settings.TRADING_ENABLED:
            raise HTTPException(
                status_code=400,
                detail="Live deployment rejected: Server TRADING_ENABLED=False guardrail active."
            )

    strat.mode = target_mode
    strat.status = "RUNNING"
    strat.last_run_time = datetime.now(timezone.utc)

    audit = AuditLog(
        user_id=user.id,
        action="STRATEGY_DEPLOYED",
        details={"strategy_id": strat.id, "mode": target_mode}
    )
    db.add(audit)
    await db.commit()
    await db.refresh(strat)
    return strat


@router.post("/{strategy_id}/pause", response_model=StrategyResponse)
async def pause_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Pause strategy execution."""
    stmt = select(Strategy).where(and_(Strategy.id == strategy_id, Strategy.user_id == user.id))
    res = await db.execute(stmt)
    strat = res.scalar_one_or_none()
    if not strat:
        raise HTTPException(status_code=404, detail="Strategy not found.")

    strat.status = "PAUSED"
    await db.commit()
    await db.refresh(strat)
    return strat


@router.post("/{strategy_id}/stop", response_model=StrategyResponse)
async def stop_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Stop strategy execution."""
    stmt = select(Strategy).where(and_(Strategy.id == strategy_id, Strategy.user_id == user.id))
    res = await db.execute(stmt)
    strat = res.scalar_one_or_none()
    if not strat:
        raise HTTPException(status_code=404, detail="Strategy not found.")

    strat.status = "STOPPED"
    await db.commit()
    await db.refresh(strat)
    return strat


@router.delete("/{strategy_id}")
async def delete_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Delete a user-defined strategy."""
    stmt = select(Strategy).where(and_(Strategy.id == strategy_id, Strategy.user_id == user.id))
    res = await db.execute(stmt)
    strat = res.scalar_one_or_none()
    if not strat:
        raise HTTPException(status_code=404, detail="Strategy not found.")

    await db.delete(strat)
    await db.commit()
    return {"success": True, "message": f"Strategy {strategy_id} deleted successfully."}
