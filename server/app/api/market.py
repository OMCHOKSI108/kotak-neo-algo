from typing import List, Optional
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from app.broker.schemas import Quote, OptionChain
from app.market.service import market_service, DEFAULT_WATCHLIST
from app.api.deps import get_current_user
from app.models.models import User

router = APIRouter(prefix="/market", tags=["Market Data"])


@router.get("/quotes", response_model=List[Quote])
async def get_quotes(
    symbols: Optional[List[str]] = Query(None),
    user: User = Depends(get_current_user)
):
    """
    Fetch normalized quotes for requested symbols or standard watchlist
    (NIFTY 50, BANKNIFTY, SENSEX, RELIANCE, HDFCBANK, ICICIBANK, TCS, INFY).
    """
    target_symbols = symbols if symbols else DEFAULT_WATCHLIST
    return await market_service.get_quotes(target_symbols)


@router.get("/expiries", response_model=List[str])
async def get_expiries(
    underlying: str = Query("NIFTY", description="NIFTY, BANKNIFTY, SENSEX"),
    user: User = Depends(get_current_user)
):
    """Fetch available option contract expiry dates for underlying."""
    return await market_service.get_expiries(underlying)


@router.get("/option-chain", response_model=OptionChain)
async def get_option_chain(
    underlying: str = Query("NIFTY", description="NIFTY, BANKNIFTY, SENSEX"),
    expiry: Optional[str] = Query(None, description="Expiration date (YYYY-MM-DD)"),
    user: User = Depends(get_current_user)
):
    """
    Fetch normalized option chain for NIFTY, BANKNIFTY, or SENSEX.
    Surfaces strikes, CE/PE LTP, OI, Change in OI, Volume, Bid, Ask strictly when provided by broker.
    """
    return await market_service.get_option_chain(underlying, expiry)


# WebSocket endpoint for real-time market data streaming
@router.websocket("/ws")
async def market_websocket_endpoint(websocket: WebSocket):
    """
    Application internal WebSocket for streaming normalized ticks directly to React.
    React connects here (never directly to Kotak or external broker).
    """
    await market_service.register_client(websocket)
    try:
        while True:
            # Keep connection alive; accept any client messages (e.g. ping or subscription updates)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await market_service.unregister_client(websocket)
    except Exception:
        await market_service.unregister_client(websocket)
