import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import User, TradeRecord, Strategy
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["Performance Analytics"])


class AnalyticsSummaryResponse(BaseModel):
    period: str
    net_pnl: float
    gross_profit: float
    gross_loss: float
    win_rate: float
    profit_factor: float
    max_drawdown: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    avg_trade_pnl: float
    best_day: float
    worst_day: float
    equity_curve: List[Dict[str, Any]]
    daily_pnl: List[Dict[str, Any]]
    strategy_breakdown: List[Dict[str, Any]]


@router.get("", response_model=AnalyticsSummaryResponse)
@router.get("/", response_model=AnalyticsSummaryResponse)
async def get_user_analytics(
    period: str = Query("today", description="today, 7d, 30d, all"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Compute actual performance analytics from user's trade history.
    Does NOT fabricate numbers: returns clean zeros / empty state if no trades exist.
    """
    now = datetime.now(timezone.utc)
    query = select(TradeRecord).where(TradeRecord.user_id == user.id)

    if period == "today":
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.where(TradeRecord.exit_time >= start_of_day)
    elif period == "7d":
        query = query.where(TradeRecord.exit_time >= now - timedelta(days=7))
    elif period == "30d":
        query = query.where(TradeRecord.exit_time >= now - timedelta(days=30))

    query = query.order_by(TradeRecord.exit_time.asc())
    res = await db.execute(query)
    trades = res.scalars().all()

    if not trades:
        return AnalyticsSummaryResponse(
            period=period,
            net_pnl=0.0,
            gross_profit=0.0,
            gross_loss=0.0,
            win_rate=0.0,
            profit_factor=0.0,
            max_drawdown=0.0,
            total_trades=0,
            winning_trades=0,
            losing_trades=0,
            avg_trade_pnl=0.0,
            best_day=0.0,
            worst_day=0.0,
            equity_curve=[],
            daily_pnl=[],
            strategy_breakdown=[]
        )

    gross_profit = 0.0
    gross_loss = 0.0
    winning_count = 0
    losing_count = 0
    cumulative_pnl = 0.0
    peak = 0.0
    max_dd = 0.0

    daily_totals: Dict[str, float] = {}
    strategy_totals: Dict[str, Dict[str, Any]] = {}
    equity_curve: List[Dict[str, Any]] = []

    for t in trades:
        pnl = float(t.pnl)
        cumulative_pnl += pnl

        if cumulative_pnl > peak:
            peak = cumulative_pnl
        dd = peak - cumulative_pnl
        if dd > max_dd:
            max_dd = dd

        if pnl > 0:
            gross_profit += pnl
            winning_count += 1
        elif pnl < 0:
            gross_loss += pnl
            losing_count += 1

        date_str = t.exit_time.strftime("%Y-%m-%d")
        daily_totals[date_str] = daily_totals.get(date_str, 0.0) + pnl

        strat_name = "Manual Trade"
        if t.strategy_id:
            strat_name = f"Strategy #{t.strategy_id}"
        if strat_name not in strategy_totals:
            strategy_totals[strat_name] = {"pnl": 0.0, "trades": 0, "wins": 0}
        strategy_totals[strat_name]["pnl"] += pnl
        strategy_totals[strat_name]["trades"] += 1
        if pnl > 0:
            strategy_totals[strat_name]["wins"] += 1

        equity_curve.append({
            "timestamp": t.exit_time.isoformat(),
            "pnl": round(cumulative_pnl, 2)
        })

    total_trades = len(trades)
    win_rate = round((winning_count / total_trades) * 100, 2) if total_trades > 0 else 0.0
    profit_factor = round(abs(gross_profit / gross_loss), 2) if gross_loss < 0 else (99.9 if gross_profit > 0 else 0.0)

    daily_pnl_list = [
        {"date": d, "pnl": round(val, 2)}
        for d, val in sorted(daily_totals.items())
    ]
    best_day = max(daily_totals.values()) if daily_totals else 0.0
    worst_day = min(daily_totals.values()) if daily_totals else 0.0

    strategy_breakdown = [
        {
            "strategy": s_name,
            "pnl": round(s_data["pnl"], 2),
            "trades": s_data["trades"],
            "win_rate": round((s_data["wins"] / s_data["trades"]) * 100, 2) if s_data["trades"] > 0 else 0.0
        }
        for s_name, s_data in strategy_totals.items()
    ]

    return AnalyticsSummaryResponse(
        period=period,
        net_pnl=round(cumulative_pnl, 2),
        gross_profit=round(gross_profit, 2),
        gross_loss=round(gross_loss, 2),
        win_rate=win_rate,
        profit_factor=profit_factor,
        max_drawdown=round(max_dd, 2),
        total_trades=total_trades,
        winning_trades=winning_count,
        losing_trades=losing_count,
        avg_trade_pnl=round(cumulative_pnl / total_trades, 2) if total_trades > 0 else 0.0,
        best_day=round(best_day, 2),
        worst_day=round(worst_day, 2),
        equity_curve=equity_curve,
        daily_pnl=daily_pnl_list,
        strategy_breakdown=strategy_breakdown
    )
