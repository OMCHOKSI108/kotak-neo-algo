from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import User, BacktestRun, AuditLog
from app.api.deps import get_current_user
from app.backtest.engine import backtest_engine
from app.backtest.data_loader import list_available_datasets
from app.strategies.registry import list_strategies, load_strategy_config

router = APIRouter(prefix="/backtest", tags=["Backtesting Engine"])


class RunBacktestRequest(BaseModel):
    strategy_id: str
    symbol: str = "NIFTY"
    timeframe: str = "1d"
    initial_capital: float = 500000.0
    lot_size: int = 1
    num_lots: int = 1
    sizing_mode: str = "lots"  # "lots" or "capital"
    slippage_pct: float = 0.0005
    brokerage_per_order: float = 20.0
    segment: str = "equity_intraday"
    parameters: Dict[str, Any] = Field(default_factory=dict)


class BacktestSummaryResponse(BaseModel):
    id: int
    strategy_name: str
    symbol: str
    timeframe: str
    net_pnl: float
    win_rate: float
    total_trades: int
    max_drawdown_percent: float
    created_at: datetime


@router.get("/strategies")
async def get_strategies(user: User = Depends(get_current_user)):
    """List available parameterized strategies from strategy.json configuration."""
    return list_strategies()


@router.get("/datasets")
async def get_datasets(user: User = Depends(get_current_user)):
    """List available historical datasets (NIFTY, BANKNIFTY, RELIANCE, TCS, etc.)."""
    return list_available_datasets()


@router.post("/run")
async def run_backtest(
    req: RunBacktestRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Execute backtest for a parameterized strategy on historical data,
    simulate trades with slippage and Indian statutory charges, and store results.
    """
    try:
        report = backtest_engine.run(
            strategy_id=req.strategy_id,
            symbol=req.symbol,
            timeframe=req.timeframe,
            initial_capital=req.initial_capital,
            lot_size=req.lot_size,
            num_lots=req.num_lots,
            sizing_mode=req.sizing_mode,
            slippage_pct=req.slippage_pct,
            brokerage_per_order=req.brokerage_per_order,
            segment=req.segment,
            parameters=req.parameters
        )

        # Persist to database
        db_run = BacktestRun(
            user_id=user.id,
            strategy_name=req.strategy_id,
            symbol=req.symbol.upper(),
            timeframe=req.timeframe,
            parameters=report.get("parameters", {}),
            metrics=report.get("metrics", {}),
            trades=report.get("trades", []),
            equity_curve=report.get("equity_curve", [])
        )
        db.add(db_run)

        # Audit log
        audit = AuditLog(
            user_id=user.id,
            action="BACKTEST_RUN",
            details={
                "strategy": req.strategy_id,
                "symbol": req.symbol,
                "net_pnl": report.get("metrics", {}).get("net_pnl"),
                "total_trades": report.get("metrics", {}).get("total_trades")
            }
        )
        db.add(audit)
        await db.commit()
        await db.refresh(db_run)

        report["run_id"] = db_run.id
        return report

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Backtest error: {str(e)}")


@router.get("/history", response_model=List[BacktestSummaryResponse])
async def get_backtest_history(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Fetch previously executed backtests for current user."""
    stmt = select(BacktestRun).where(BacktestRun.user_id == user.id).order_by(BacktestRun.id.desc()).limit(20)
    result = await db.execute(stmt)
    runs = result.scalars().all()

    response = []
    for r in runs:
        m = r.metrics or {}
        response.append(
            BacktestSummaryResponse(
                id=r.id,
                strategy_name=r.strategy_name,
                symbol=r.symbol,
                timeframe=r.timeframe,
                net_pnl=float(m.get("net_pnl", 0.0)),
                win_rate=float(m.get("win_rate", 0.0)),
                total_trades=int(m.get("total_trades", 0)),
                max_drawdown_percent=float(m.get("max_drawdown_percent", 0.0)),
                created_at=r.created_at
            )
        )
    return response


@router.get("/history/{run_id}")
async def get_backtest_detail(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Retrieve full trades, equity curve, and metrics for a specific backtest run."""
    stmt = select(BacktestRun).where(
        BacktestRun.id == run_id,
        BacktestRun.user_id == user.id
    )
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest run not found")

    return {
        "id": run.id,
        "strategy_name": run.strategy_name,
        "symbol": run.symbol,
        "timeframe": run.timeframe,
        "parameters": run.parameters,
        "metrics": run.metrics,
        "trades": run.trades,
        "equity_curve": run.equity_curve,
        "created_at": run.created_at
    }
