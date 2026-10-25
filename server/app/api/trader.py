import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import (
    User, UserTradingSettings, OrderRecord, PositionRecord, TradeRecord, AuditLog, BrokerAccount
)
from app.api.deps import get_current_user
from app.market.service import market_service
from app.core.config import settings
from app.broker.schemas import OrderRequest
from app.security.encryption import decrypt_secret
from app.broker.factory import get_broker_adapter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/trader", tags=["Trader & Risk"])

# Dynamic master lot sizes
INDEX_LOT_SIZES: Dict[str, int] = {
    "NIFTY": 65,
    "BANKNIFTY": 30,
    "SENSEX": 20
}


def get_symbol_lot_size(symbol: str) -> int:
    sym_upper = symbol.upper()
    if "BANK" in sym_upper:
        return INDEX_LOT_SIZES["BANKNIFTY"]
    elif "SENSEX" in sym_upper:
        return INDEX_LOT_SIZES["SENSEX"]
    elif "NIFTY" in sym_upper:
        return INDEX_LOT_SIZES["NIFTY"]
    return 1  # Standard equity lot size


class UserTradingSettingsResponse(BaseModel):
    trading_mode: str
    live_trading_enabled: bool
    nifty_lots: int
    banknifty_lots: int
    sensex_lots: int
    max_daily_loss: float
    max_daily_trades: int
    max_open_positions: int
    max_loss_per_trade: float
    is_trading_halted: bool
    halt_reason: Optional[str] = None
    calculated_quantities: Dict[str, int]


class UpdateTradingSettingsRequest(BaseModel):
    trading_mode: Optional[str] = None
    live_trading_enabled: Optional[bool] = None
    nifty_lots: Optional[int] = Field(None, ge=1, le=50)
    banknifty_lots: Optional[int] = Field(None, ge=1, le=50)
    sensex_lots: Optional[int] = Field(None, ge=1, le=50)
    max_daily_loss: Optional[float] = Field(None, ge=500.0)
    max_daily_trades: Optional[int] = Field(None, ge=1)
    max_open_positions: Optional[int] = Field(None, ge=1)
    max_loss_per_trade: Optional[float] = Field(None, ge=100.0)


class TraderOrderRequest(BaseModel):
    symbol: str
    exchange: str = "NSE"
    side: str = Field(..., description="BUY or SELL")
    order_type: str = "MARKET"  # MARKET, LIMIT
    product: str = "MIS"        # MIS, NRML
    lots: int = 1
    quantity: Optional[int] = None
    price: Optional[float] = 0.0
    stop_loss: Optional[float] = None
    target: Optional[float] = None
    mode: Optional[str] = "PAPER"  # PAPER or LIVE


class TraderOrderResponse(BaseModel):
    success: bool
    order_id: Optional[str] = None
    symbol: str
    side: str
    quantity: int
    price: float
    status: str
    mode: str
    message: str


# ------------------------------------------------------------------------------
# Settings & Lots
# ------------------------------------------------------------------------------

async def get_or_create_user_settings(user_id: int, db: AsyncSession) -> UserTradingSettings:
    stmt = select(UserTradingSettings).where(UserTradingSettings.user_id == user_id)
    res = await db.execute(stmt)
    user_settings = res.scalar_one_or_none()
    if not user_settings:
        user_settings = UserTradingSettings(
            user_id=user_id,
            trading_mode="PAPER",
            live_trading_enabled=False,
            nifty_lots=1,
            banknifty_lots=1,
            sensex_lots=1,
            max_daily_loss=5000.0,
            max_daily_trades=10,
            max_open_positions=3,
            max_loss_per_trade=1500.0
        )
        db.add(user_settings)
        await db.commit()
        await db.refresh(user_settings)
    return user_settings


@router.get("/lots", response_model=Dict[str, int])
async def get_lot_sizes():
    """Returns current active lot sizes for major Indian indices."""
    return INDEX_LOT_SIZES


@router.get("/settings", response_model=UserTradingSettingsResponse)
async def get_trader_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Fetch user's algorithm trading settings, lot configuration, and risk limits."""
    s = await get_or_create_user_settings(user.id, db)
    return UserTradingSettingsResponse(
        trading_mode=s.trading_mode,
        live_trading_enabled=s.live_trading_enabled,
        nifty_lots=s.nifty_lots,
        banknifty_lots=s.banknifty_lots,
        sensex_lots=s.sensex_lots,
        max_daily_loss=s.max_daily_loss,
        max_daily_trades=s.max_daily_trades,
        max_open_positions=s.max_open_positions,
        max_loss_per_trade=s.max_loss_per_trade,
        is_trading_halted=s.is_trading_halted,
        halt_reason=s.halt_reason,
        calculated_quantities={
            "NIFTY": s.nifty_lots * INDEX_LOT_SIZES["NIFTY"],
            "BANKNIFTY": s.banknifty_lots * INDEX_LOT_SIZES["BANKNIFTY"],
            "SENSEX": s.sensex_lots * INDEX_LOT_SIZES["SENSEX"],
        }
    )


@router.post("/settings", response_model=UserTradingSettingsResponse)
async def update_trader_settings(
    payload: UpdateTradingSettingsRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update lot counts and risk parameters."""
    s = await get_or_create_user_settings(user.id, db)
    if payload.live_trading_enabled is not None:
        s.live_trading_enabled = payload.live_trading_enabled
    if payload.trading_mode is not None:
        if payload.trading_mode == "LIVE" and not s.live_trading_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot switch to LIVE mode without enabling live trading."
            )
        s.trading_mode = payload.trading_mode
    if payload.nifty_lots is not None:
        s.nifty_lots = payload.nifty_lots
    if payload.banknifty_lots is not None:
        s.banknifty_lots = payload.banknifty_lots
    if payload.sensex_lots is not None:
        s.sensex_lots = payload.sensex_lots
    if payload.max_daily_loss is not None:
        s.max_daily_loss = payload.max_daily_loss
    if payload.max_daily_trades is not None:
        s.max_daily_trades = payload.max_daily_trades
    if payload.max_open_positions is not None:
        s.max_open_positions = payload.max_open_positions
    if payload.max_loss_per_trade is not None:
        s.max_loss_per_trade = payload.max_loss_per_trade

    await db.commit()
    await db.refresh(s)

    return UserTradingSettingsResponse(
        trading_mode=s.trading_mode,
        live_trading_enabled=s.live_trading_enabled,
        nifty_lots=s.nifty_lots,
        banknifty_lots=s.banknifty_lots,
        sensex_lots=s.sensex_lots,
        max_daily_loss=s.max_daily_loss,
        max_daily_trades=s.max_daily_trades,
        max_open_positions=s.max_open_positions,
        max_loss_per_trade=s.max_loss_per_trade,
        is_trading_halted=s.is_trading_halted,
        halt_reason=s.halt_reason,
        calculated_quantities={
            "NIFTY": s.nifty_lots * INDEX_LOT_SIZES["NIFTY"],
            "BANKNIFTY": s.banknifty_lots * INDEX_LOT_SIZES["BANKNIFTY"],
            "SENSEX": s.sensex_lots * INDEX_LOT_SIZES["SENSEX"],
        }
    )


# ------------------------------------------------------------------------------
# Orders & Execution
# ------------------------------------------------------------------------------

@router.post("/order", response_model=TraderOrderResponse)
async def place_trader_order(
    req: TraderOrderRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Execute order (Paper or Live).
    Enforces risk limits (Max daily loss, Max trades, TRADING_ENABLED guardrail).
    """
    s = await get_or_create_user_settings(user.id, db)
    
    # 1. Check Circuit Breaker / Trading Halt
    if s.is_trading_halted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Trading halted: {s.halt_reason or 'Risk limit exceeded'}"
        )

    # Calculate actual quantity
    lot_size = get_symbol_lot_size(req.symbol)
    qty = req.quantity if req.quantity and req.quantity > 0 else (req.lots * lot_size)
    target_mode = (req.mode or s.trading_mode or "PAPER").upper()

    order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc)

    # 2. Live Trading Safety Checks
    if target_mode == "LIVE":
        if not settings.TRADING_ENABLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Live execution is disabled by server safety guardrail (TRADING_ENABLED=False)."
            )
        if not s.live_trading_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User account has not enabled Live Trading mode."
            )

        # Resolve active broker adapter (prefer user's connected BrokerAccount)
        stmt = select(BrokerAccount).where(
            BrokerAccount.user_id == user.id,
            BrokerAccount.is_connected == True
        )
        res = await db.execute(stmt)
        user_broker_acc = res.scalar_one_or_none()

        active_adapter = market_service.adapter
        if user_broker_acc:
            try:
                creds = {
                    "consumer_key": decrypt_secret(user_broker_acc.encrypted_consumer_key) if user_broker_acc.encrypted_consumer_key else None,
                    "mobile_number": decrypt_secret(user_broker_acc.encrypted_mobile_number) if user_broker_acc.encrypted_mobile_number else None,
                    "ucc": decrypt_secret(user_broker_acc.encrypted_ucc) if user_broker_acc.encrypted_ucc else None,
                    "mpin": decrypt_secret(user_broker_acc.encrypted_mpin) if user_broker_acc.encrypted_mpin else None,
                    "totp_secret": decrypt_secret(user_broker_acc.encrypted_totp_secret) if user_broker_acc.encrypted_totp_secret else None,
                    "environment": (user_broker_acc.session_metadata or {}).get("environment", "prod"),
                }
                active_adapter = get_broker_adapter(user_broker_acc.broker, account_id=user.id, credentials=creds)
            except Exception as e:
                logger.warning("Could not get user-specific broker adapter for order: %s", e)

        # Execute via active broker adapter
        broker_res = await active_adapter.place_order(
            OrderRequest(
                symbol=req.symbol,
                exchange=req.exchange,
                transaction_type=req.side,
                order_type=req.order_type,
                product=req.product,
                quantity=qty,
                price=req.price or 0.0,
                trigger_price=req.stop_loss,
                stop_loss=req.stop_loss,
                target=req.target
            )
        )

        order_record = OrderRecord(
            user_id=user.id,
            order_id=broker_res.order_id or order_id,
            symbol=req.symbol,
            exchange=req.exchange,
            side=req.side,
            order_type=req.order_type,
            product=req.product,
            quantity=qty,
            lots=req.lots,
            price=req.price or 0.0,
            stop_loss=req.stop_loss,
            target=req.target,
            status="EXECUTED" if broker_res.success else "REJECTED",
            rejection_reason=broker_res.message if not broker_res.success else None,
            mode="LIVE",
            placed_at=now,
            executed_at=now if broker_res.success else None
        )
        db.add(order_record)

        audit = AuditLog(
            user_id=user.id,
            action="LIVE_ORDER_PLACED",
            details={
                "order_id": order_record.order_id,
                "symbol": req.symbol,
                "side": req.side,
                "quantity": qty,
                "success": broker_res.success,
                "broker": market_service.adapter.broker_name
            }
        )
        db.add(audit)
        await db.commit()

        return TraderOrderResponse(
            success=broker_res.success,
            order_id=order_record.order_id,
            symbol=req.symbol,
            side=req.side,
            quantity=qty,
            price=req.price or 0.0,
            status=order_record.status,
            mode="LIVE",
            message=broker_res.message
        )

    # 3. Paper Trading Execution
    # Fetch latest LTP for realistic price fill
    quotes = await market_service.get_quotes([req.symbol])
    current_ltp = quotes[0].ltp if quotes and quotes[0].ltp > 0 else (req.price or 100.0)
    exec_price = req.price if (req.order_type == "LIMIT" and req.price) else current_ltp

    order_record = OrderRecord(
        user_id=user.id,
        order_id=order_id,
        symbol=req.symbol,
        exchange=req.exchange,
        side=req.side,
        order_type=req.order_type,
        product=req.product,
        quantity=qty,
        lots=req.lots,
        price=exec_price,
        stop_loss=req.stop_loss,
        target=req.target,
        status="EXECUTED",
        mode="PAPER",
        placed_at=now,
        executed_at=now
    )
    db.add(order_record)

    # Update or create PositionRecord for Paper Trading
    pos_stmt = select(PositionRecord).where(
        and_(
            PositionRecord.user_id == user.id,
            PositionRecord.symbol == req.symbol,
            PositionRecord.product == req.product,
            PositionRecord.status == "OPEN",
            PositionRecord.mode == "PAPER"
        )
    )
    res = await db.execute(pos_stmt)
    existing_pos = res.scalar_one_or_none()

    if not existing_pos:
        new_pos = PositionRecord(
            user_id=user.id,
            symbol=req.symbol,
            exchange=req.exchange,
            product=req.product,
            side=req.side,
            quantity=qty,
            buy_avg_price=exec_price if req.side == "BUY" else 0.0,
            sell_avg_price=exec_price if req.side == "SELL" else 0.0,
            ltp=exec_price,
            pnl=0.0,
            pnl_percent=0.0,
            status="OPEN",
            mode="PAPER",
            opened_at=now
        )
        db.add(new_pos)
    else:
        # Same direction -> increase position
        if existing_pos.side == req.side:
            total_qty = existing_pos.quantity + qty
            if req.side == "BUY":
                existing_pos.buy_avg_price = ((existing_pos.buy_avg_price * existing_pos.quantity) + (exec_price * qty)) / total_qty
            else:
                existing_pos.sell_avg_price = ((existing_pos.sell_avg_price * existing_pos.quantity) + (exec_price * qty)) / total_qty
            existing_pos.quantity = total_qty
            existing_pos.ltp = exec_price
        else:
            # Opposite direction -> partial or full close
            if qty >= existing_pos.quantity:
                # Full close
                close_qty = existing_pos.quantity
                entry_p = existing_pos.buy_avg_price if existing_pos.side == "BUY" else existing_pos.sell_avg_price
                trade_pnl = (exec_price - entry_p) * close_qty if existing_pos.side == "BUY" else (entry_p - exec_price) * close_qty
                
                existing_pos.status = "CLOSED"
                existing_pos.closed_at = now
                existing_pos.realized_pnl += trade_pnl
                existing_pos.unrealized_pnl = 0.0
                existing_pos.pnl = existing_pos.realized_pnl

                # Create trade record
                trade = TradeRecord(
                    user_id=user.id,
                    symbol=req.symbol,
                    side=existing_pos.side,
                    quantity=close_qty,
                    entry_price=entry_p,
                    exit_price=exec_price,
                    pnl=trade_pnl,
                    pnl_percent=((exec_price - entry_p) / entry_p * 100) if entry_p > 0 else 0.0,
                    entry_time=existing_pos.opened_at,
                    exit_time=now,
                    exit_reason="MANUAL_SQUARE_OFF",
                    mode="PAPER"
                )
                db.add(trade)
            else:
                # Partial reduction
                existing_pos.quantity -= qty

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="PAPER_ORDER_EXECUTED",
        details={
            "order_id": order_id,
            "symbol": req.symbol,
            "side": req.side,
            "quantity": qty,
            "price": exec_price
        }
    )
    db.add(audit)
    await db.commit()

    return TraderOrderResponse(
        success=True,
        order_id=order_id,
        symbol=req.symbol,
        side=req.side,
        quantity=qty,
        price=exec_price,
        status="EXECUTED",
        mode="PAPER",
        message="Paper order executed successfully."
    )


# ------------------------------------------------------------------------------
# Positions & Square Off
# ------------------------------------------------------------------------------

@router.get("/positions")
async def get_trader_positions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Fetch open and closed positions for user with real-time P&L calculated against latest market data.
    """
    stmt = select(PositionRecord).where(
        PositionRecord.user_id == user.id
    ).order_by(PositionRecord.opened_at.desc())
    res = await db.execute(stmt)
    records = res.scalars().all()

    # Collect symbols for live tick update
    open_symbols = [p.symbol for p in records if p.status == "OPEN"]
    quotes_map = {}
    if open_symbols:
        quotes = await market_service.get_quotes(open_symbols)
        quotes_map = {q.symbol: q.ltp for q in quotes if q.ltp > 0}

    total_realized = 0.0
    total_unrealized = 0.0
    result_list = []

    for p in records:
        if p.status == "OPEN":
            current_ltp = quotes_map.get(p.symbol) or p.ltp
            p.ltp = current_ltp
            entry_p = p.buy_avg_price if p.side == "BUY" else p.sell_avg_price
            if p.side == "BUY":
                unrealized = (current_ltp - entry_p) * p.quantity
            else:
                unrealized = (entry_p - current_ltp) * p.quantity
            p.unrealized_pnl = round(unrealized, 2)
            p.pnl = round(p.realized_pnl + unrealized, 2)
            p.pnl_percent = round((unrealized / (entry_p * p.quantity) * 100), 2) if entry_p > 0 and p.quantity > 0 else 0.0
            total_unrealized += unrealized
        total_realized += p.realized_pnl

        result_list.append({
            "id": p.id,
            "symbol": p.symbol,
            "exchange": p.exchange,
            "product": p.product,
            "side": p.side,
            "quantity": p.quantity,
            "buy_avg_price": p.buy_avg_price,
            "sell_avg_price": p.sell_avg_price,
            "ltp": p.ltp,
            "pnl": p.pnl,
            "pnl_percent": p.pnl_percent,
            "realized_pnl": p.realized_pnl,
            "unrealized_pnl": p.unrealized_pnl,
            "status": p.status,
            "mode": p.mode,
            "opened_at": p.opened_at.isoformat() if p.opened_at else None,
            "closed_at": p.closed_at.isoformat() if p.closed_at else None,
        })

    return {
        "total_pnl": round(total_realized + total_unrealized, 2),
        "realized_pnl": round(total_realized, 2),
        "unrealized_pnl": round(total_unrealized, 2),
        "positions": result_list
    }


@router.post("/positions/{position_id}/square-off")
async def square_off_position(
    position_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Square off a specific open position."""
    stmt = select(PositionRecord).where(
        and_(
            PositionRecord.id == position_id,
            PositionRecord.user_id == user.id
        )
    )
    res = await db.execute(stmt)
    pos = res.scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found.")
    if pos.status == "CLOSED":
        return {"success": True, "message": "Position is already closed."}

    now = datetime.now(timezone.utc)
    quotes = await market_service.get_quotes([pos.symbol])
    current_ltp = quotes[0].ltp if quotes and quotes[0].ltp > 0 else pos.ltp
    entry_p = pos.buy_avg_price if pos.side == "BUY" else pos.sell_avg_price
    
    trade_pnl = (current_ltp - entry_p) * pos.quantity if pos.side == "BUY" else (entry_p - current_ltp) * pos.quantity
    
    pos.status = "CLOSED"
    pos.closed_at = now
    pos.ltp = current_ltp
    pos.realized_pnl += trade_pnl
    pos.unrealized_pnl = 0.0
    pos.pnl = pos.realized_pnl

    trade = TradeRecord(
        user_id=user.id,
        symbol=pos.symbol,
        side=pos.side,
        quantity=pos.quantity,
        entry_price=entry_p,
        exit_price=current_ltp,
        pnl=trade_pnl,
        pnl_percent=((current_ltp - entry_p) / entry_p * 100) if entry_p > 0 else 0.0,
        entry_time=pos.opened_at,
        exit_time=now,
        exit_reason="SQUARE_OFF",
        mode=pos.mode
    )
    db.add(trade)
    await db.commit()

    return {"success": True, "message": f"Position {pos.symbol} squared off successfully at {current_ltp}."}


@router.post("/positions/square-off-all")
async def square_off_all_positions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Square off all open positions."""
    stmt = select(PositionRecord).where(
        and_(
            PositionRecord.user_id == user.id,
            PositionRecord.status == "OPEN"
        )
    )
    res = await db.execute(stmt)
    open_positions = res.scalars().all()
    if not open_positions:
        return {"success": True, "count": 0, "message": "No open positions to square off."}

    now = datetime.now(timezone.utc)
    for pos in open_positions:
        quotes = await market_service.get_quotes([pos.symbol])
        current_ltp = quotes[0].ltp if quotes and quotes[0].ltp > 0 else pos.ltp
        entry_p = pos.buy_avg_price if pos.side == "BUY" else pos.sell_avg_price
        trade_pnl = (current_ltp - entry_p) * pos.quantity if pos.side == "BUY" else (entry_p - current_ltp) * pos.quantity
        
        pos.status = "CLOSED"
        pos.closed_at = now
        pos.ltp = current_ltp
        pos.realized_pnl += trade_pnl
        pos.unrealized_pnl = 0.0
        pos.pnl = pos.realized_pnl

        trade = TradeRecord(
            user_id=user.id,
            symbol=pos.symbol,
            side=pos.side,
            quantity=pos.quantity,
            entry_price=entry_p,
            exit_price=current_ltp,
            pnl=trade_pnl,
            pnl_percent=((current_ltp - entry_p) / entry_p * 100) if entry_p > 0 else 0.0,
            entry_time=pos.opened_at,
            exit_time=now,
            exit_reason="SQUARE_OFF_ALL",
            mode=pos.mode
        )
        db.add(trade)

    await db.commit()
    return {"success": True, "count": len(open_positions), "message": f"Squared off {len(open_positions)} positions."}


# ------------------------------------------------------------------------------
# Orders List
# ------------------------------------------------------------------------------

@router.get("/orders")
async def get_trader_orders(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Fetch order book history."""
    stmt = select(OrderRecord).where(
        OrderRecord.user_id == user.id
    ).order_by(OrderRecord.placed_at.desc())
    res = await db.execute(stmt)
    records = res.scalars().all()
    return [
        {
            "id": o.id,
            "order_id": o.order_id,
            "symbol": o.symbol,
            "exchange": o.exchange,
            "side": o.side,
            "order_type": o.order_type,
            "product": o.product,
            "quantity": o.quantity,
            "lots": o.lots,
            "price": o.price,
            "status": o.status,
            "rejection_reason": o.rejection_reason,
            "mode": o.mode,
            "placed_at": o.placed_at.isoformat() if o.placed_at else None,
            "executed_at": o.executed_at.isoformat() if o.executed_at else None,
        }
        for o in records
    ]
