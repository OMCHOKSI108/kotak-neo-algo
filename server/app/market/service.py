import asyncio
import logging
from typing import Dict, List, Set, Optional, Any, Callable
from fastapi import WebSocket
from app.broker.base import BrokerAdapter
from app.broker.schemas import Quote, OptionChain
from app.broker.kotak_adapter import KotakNeoAdapter

logger = logging.getLogger(__name__)

DEFAULT_WATCHLIST = [
    "NIFTY 50",
    "BANKNIFTY",
    "SENSEX",
    "RELIANCE",
    "HDFCBANK",
    "ICICIBANK",
    "TCS",
    "INFY"
]


class MarketDataService:
    """
    Centralized market data service.
    Receives quotes from the active broker adapter, normalizes them,
    caches them in memory, and pushes live updates to all connected React clients
    via the platform's internal WebSocket (/ws/market).
    React never communicates with Kotak Neo or broker endpoints directly.
    """

    def __init__(self, adapter: Optional[BrokerAdapter] = None):
        self._adapter: BrokerAdapter = adapter or KotakNeoAdapter()
        self._cached_quotes: Dict[str, Quote] = {}
        self._active_connections: Set[WebSocket] = set()
        self._strategy_subscribers: List[Callable[[Quote], Any]] = []
        self._lock = asyncio.Lock()
        self._is_running = False

    @property
    def adapter(self) -> BrokerAdapter:
        return self._adapter

    def set_adapter(self, adapter: BrokerAdapter):
        """Switch active market data adapter (e.g. from Mock to Kotak Neo)."""
        logger.info("Switching active market data adapter to: %s", adapter.broker_name)
        self._adapter = adapter
        # Re-subscribe watchlist
        asyncio.create_task(self.start())

    async def start(self):
        """Initialize subscriptions and prime cache."""
        try:
            # Prime initial quotes
            quotes = await self._adapter.get_quotes(DEFAULT_WATCHLIST)
            for q in quotes:
                self._cached_quotes[q.symbol.upper()] = q

            # Subscribe to ticks with callback
            await self._adapter.subscribe_market_data(DEFAULT_WATCHLIST, self._on_tick)
            self._is_running = True
            logger.info("MarketDataService started with %d symbols subscribed.", len(DEFAULT_WATCHLIST))
        except Exception as e:
            logger.error("Error starting MarketDataService: %s", e)

    def subscribe_strategy(self, callback: Callable[[Quote], Any]):
        """Register a trading strategy for immediate, zero-latency in-process tick notifications."""
        if callback not in self._strategy_subscribers:
            self._strategy_subscribers.append(callback)

    def unsubscribe_strategy(self, callback: Callable[[Quote], Any]):
        """Unregister a trading strategy callback."""
        if callback in self._strategy_subscribers:
            self._strategy_subscribers.remove(callback)

    async def _on_tick(self, quote: Quote):
        """
        Callback invoked when broker emits a market tick.
        Dispatches to internal strategies first with zero UI latency, then broadcasts asynchronously to React.
        """
        sym_key = quote.symbol.upper()
        self._cached_quotes[sym_key] = quote

        # 1. Execute strategy callbacks immediately (Hot path: no serialization or network overhead)
        for cb in self._strategy_subscribers:
            try:
                res = cb(quote)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as e:
                logger.error("Error in strategy tick callback: %s", e)

        # 2. Asynchronously fan out to UI dashboards without blocking tick processing
        if self._active_connections:
            asyncio.create_task(self._broadcast_tick(quote))

    async def register_client(self, websocket: WebSocket):
        """Register a React client WebSocket connection and send current snapshot."""
        await websocket.accept()
        async with self._lock:
            self._active_connections.add(websocket)
        logger.info("React client connected to /ws/market. Total active clients: %d", len(self._active_connections))

        # Send initial snapshot of all quotes
        try:
            snapshot_payload = {
                "type": "SNAPSHOT",
                "data": [q.model_dump() for q in self._cached_quotes.values()]
            }
            await websocket.send_json(snapshot_payload)
        except Exception as e:
            logger.warning("Failed to send initial snapshot to client: %s", e)

    async def unregister_client(self, websocket: WebSocket):
        """Unregister a disconnected React client WebSocket."""
        async with self._lock:
            self._active_connections.discard(websocket)
        logger.info("React client disconnected from /ws/market. Remaining clients: %d", len(self._active_connections))

    async def _broadcast_tick(self, quote: Quote):
        """
        Broadcast single tick to all connected React clients.
        Pre-serializes JSON once and broadcasts concurrently with timeout to prevent slow client backpressure.
        """
        if not self._active_connections:
            return

        import json
        payload_str = json.dumps({
            "type": "TICK",
            "data": quote.model_dump()
        })

        async def _safe_send(ws: WebSocket) -> Optional[WebSocket]:
            try:
                await asyncio.wait_for(ws.send_text(payload_str), timeout=0.05)
                return None
            except Exception:
                return ws

        results = await asyncio.gather(*[_safe_send(ws) for ws in list(self._active_connections)], return_exceptions=True)
        dead = [ws for ws in results if isinstance(ws, WebSocket)]

        if dead:
            async with self._lock:
                for ws in dead:
                    self._active_connections.discard(ws)

    async def get_quotes(self, symbols: Optional[List[str]] = None) -> List[Quote]:
        """Get latest cached quotes or fetch on-demand."""
        syms = symbols or DEFAULT_WATCHLIST
        # Check cache
        needed_fetch = [s for s in syms if s.upper() not in self._cached_quotes]
        if needed_fetch:
            new_quotes = await self._adapter.get_quotes(needed_fetch)
            for q in new_quotes:
                self._cached_quotes[q.symbol.upper()] = q

        return [self._cached_quotes[s.upper()] for s in syms if s.upper() in self._cached_quotes]

    async def get_option_chain(self, underlying: str, expiry: Optional[str] = None) -> OptionChain:
        """Fetch option chain from active adapter."""
        return await self._adapter.get_option_chain(underlying, expiry)

    async def get_expiries(self, underlying: str) -> List[str]:
        """Fetch expiries for underlying."""
        return await self._adapter.get_expiries(underlying)


# Global market data service singleton
market_service = MarketDataService()
