from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from app.market.scrip_manager import scrip_manager, InstrumentSearchResult
from app.api.deps import get_current_user
from app.models.models import User

router = APIRouter(prefix="/instruments", tags=["Instruments"])


@router.get("/search", response_model=List[InstrumentSearchResult])
async def search_instruments(
    q: str = Query("", description="Symbol, contract or company name"),
    query: Optional[str] = Query(None, description="Alias query parameter"),
    segment: Optional[str] = Query(None, description="Filter: all, equity, fo, indices"),
    limit: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user)
):
    """
    Fast sub-millisecond multi-token instrument search across NSE, BSE, NFO, BFO.
    Supports symbols, companies, strikes, and option types (e.g. 'RELIANCE', 'NIFTY 25800 CE', 'BANKNIFTY FUT').
    """
    search_term = q or query or ""
    return scrip_manager.search(query=search_term, segment=segment, limit=limit)
