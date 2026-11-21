import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import User, WatchlistItem
from app.api.deps import get_current_user
from app.market.service import market_service, DEFAULT_WATCHLIST
from app.market.scrip_manager import scrip_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/watchlist", tags=["Watchlist"])


class WatchlistAddRequest(BaseModel):
    symbol: str = Field(..., description="Canonical ticker symbol (e.g. RELIANCE, NIFTY 25800 CE)")
    trading_symbol: Optional[str] = Field(None, description="Display trading symbol")
    tradingSymbol: Optional[str] = Field(None, description="CamelCase alias")
    name: Optional[str] = Field(None, description="Company name or description")
    exchange: Optional[str] = Field("NSE", description="NSE or BSE")
    exchange_segment: Optional[str] = Field("nse_cm", description="nse_cm, bse_cm, nse_fo, bse_fo")
    exchangeSegment: Optional[str] = Field(None, description="CamelCase alias")
    instrument_type: Optional[str] = Field("EQ", description="EQ, IDX, FUT, CE, PE")
    instrumentType: Optional[str] = Field(None, description="CamelCase alias")
    token: Optional[str] = Field(None, description="Broker instrument token")
    instrumentToken: Optional[str] = Field(None, description="Token alias")
    lot_size: Optional[int] = Field(1, description="Lot size")
    lotSize: Optional[int] = Field(None, description="CamelCase alias")
    strike_price: Optional[float] = Field(None, description="Strike price for options")
    strikePrice: Optional[float] = Field(None, description="CamelCase alias")
    expiry: Optional[str] = Field(None, description="Contract expiry date")


class WatchlistItemResponse(BaseModel):
    id: int
    symbol: str
    trading_symbol: str
    tradingSymbol: str
    name: Optional[str] = None
    exchange: str
    exchange_segment: str
    exchangeSegment: str
    instrument_type: str
    instrumentType: str
    token: Optional[str] = None
    lot_size: int
    lotSize: int
    strike_price: Optional[float] = None
    strikePrice: Optional[float] = None
    expiry: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


def _to_response_item(item: WatchlistItem) -> WatchlistItemResponse:
    trd = item.trading_symbol or item.symbol
    seg = item.exchange_segment or "nse_cm"
    itype = item.instrument_type or "EQ"
    lot = item.lot_size or 1
    return WatchlistItemResponse(
        id=item.id,
        symbol=item.symbol,
        trading_symbol=trd,
        tradingSymbol=trd,
        name=item.name,
        exchange=item.exchange or "NSE",
        exchange_segment=seg,
        exchangeSegment=seg,
        instrument_type=itype,
        instrumentType=itype,
        token=item.token,
        lot_size=lot,
        lotSize=lot,
        strike_price=item.strike_price,
        strikePrice=item.strike_price,
        expiry=item.expiry,
        created_at=item.created_at,
    )


@router.get("", response_model=List[WatchlistItemResponse])
async def get_user_watchlist(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Get user's personalized watchlist.
    If the user has no items saved, seeds the standard default instruments into PostgreSQL and returns them.
    """
    stmt = select(WatchlistItem).where(WatchlistItem.user_id == user.id).order_by(WatchlistItem.id.asc())
    result = await db.execute(stmt)
    items = list(result.scalars().all())

    if not items:
        # Seed default symbols
        for sym in DEFAULT_WATCHLIST:
            rec = scrip_manager.get_instrument_by_symbol(sym)
            trd = rec["trading_symbol"] if rec else sym
            seg = rec["exchange_segment"] if rec else ("bse_cm" if "SENSEX" in sym else "nse_cm")
            exch = rec["exchange"] if rec else ("BSE" if "SENSEX" in sym else "NSE")
            itype = rec["instrument_type"] if rec else ("IDX" if "NIFTY" in sym or "SENSEX" in sym else "EQ")
            token = str(rec["token"]) if rec else None
            lot = rec["lot_size"] if rec else 1

            new_item = WatchlistItem(
                user_id=user.id,
                symbol=sym,
                trading_symbol=trd,
                name=rec["name"] if rec else sym,
                exchange=exch,
                exchange_segment=seg,
                instrument_type=itype,
                token=token,
                lot_size=lot,
                created_at=datetime.now(timezone.utc)
            )
            db.add(new_item)
            items.append(new_item)

        try:
            await db.commit()
            # Refresh to get IDs
            for itm in items:
                await db.refresh(itm)
        except Exception as e:
            await db.rollback()
            logger.warning("Error seeding initial watchlist for user %s: %s", user.id, e)

    return [_to_response_item(i) for i in items]


@router.post("/add")
async def add_to_watchlist(
    req: WatchlistAddRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Add an instrument to user's watchlist and immediately subscribe to live broker feed/ticks.
    """
    sym = req.symbol.strip().upper()
    trd = req.trading_symbol or req.tradingSymbol or sym
    seg = req.exchange_segment or req.exchangeSegment or "nse_cm"
    itype = req.instrument_type or req.instrumentType or "EQ"
    token = req.token or req.instrumentToken
    lot = req.lot_size or req.lotSize or 1
    strike = req.strike_price or req.strikePrice
    expiry = req.expiry

    # If details are missing, lookup from scrip_manager
    rec = scrip_manager.get_instrument_by_symbol(sym)
    if rec:
        trd = trd or rec.get("trading_symbol") or sym
        seg = seg if seg != "nse_cm" else rec.get("exchange_segment", seg)
        itype = itype if itype != "EQ" else rec.get("instrument_type", itype)
        token = token or str(rec.get("token"))
        lot = lot if lot != 1 else int(rec.get("lot_size", 1))
        strike = strike or rec.get("strike_price")
        expiry = expiry or rec.get("expiry")

    # Check if already in user's watchlist
    stmt = select(WatchlistItem).where(
        WatchlistItem.user_id == user.id,
        WatchlistItem.symbol == sym
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()

    if existing:
        # Update existing record
        existing.trading_symbol = trd
        existing.exchange_segment = seg
        existing.instrument_type = itype
        existing.token = token
        existing.lot_size = lot
        existing.strike_price = strike
        existing.expiry = expiry
        await db.commit()
        await db.refresh(existing)
        target_item = existing
    else:
        new_item = WatchlistItem(
            user_id=user.id,
            symbol=sym,
            trading_symbol=trd,
            name=req.name or (rec.get("name") if rec else sym),
            exchange=req.exchange or (rec.get("exchange") if rec else "NSE"),
            exchange_segment=seg,
            instrument_type=itype,
            token=token,
            lot_size=lot,
            strike_price=strike,
            expiry=expiry,
            created_at=datetime.now(timezone.utc)
        )
        db.add(new_item)
        await db.commit()
        await db.refresh(new_item)
        target_item = new_item

    # Immediately subscribe Kotak Neo live feed for this symbol
    try:
        await market_service.subscribe_symbol(symbol=sym, exchange_segment=seg, token=token)
    except Exception as sub_err:
        logger.warning("Failed to immediately subscribe symbol %s: %s", sym, sub_err)

    return {
        "success": True,
        "message": f"{sym} added to watchlist successfully.",
        "item": _to_response_item(target_item).model_dump()
    }


@router.delete("/{symbol}")
async def remove_from_watchlist(
    symbol: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Remove an instrument from user's watchlist and unsubscribe from ticks if appropriate.
    """
    sym = symbol.strip().upper()
    stmt = delete(WatchlistItem).where(
        WatchlistItem.user_id == user.id,
        WatchlistItem.symbol == sym
    )
    result = await db.execute(stmt)
    await db.commit()

    if result.rowcount > 0:
        # Unsubscribe symbol
        try:
            await market_service.unsubscribe_symbol(sym)
        except Exception as e:
            logger.debug("Error unsubscribing symbol %s: %s", sym, e)

        return {
            "success": True,
            "message": f"{sym} removed from watchlist."
        }
    else:
        return {
            "success": False,
            "message": f"{sym} was not found in watchlist."
        }
