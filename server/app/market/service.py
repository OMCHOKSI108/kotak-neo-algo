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
        self._cached_option_quotes: Dict[str, Quote] = {}
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

    async def subscribe_symbol(self, symbol: str, exchange_segment: Optional[str] = None, token: Optional[str] = None) -> Quote:
        """Subscribe to a new symbol dynamically and prime its quote snapshot immediately."""
        s_clean = symbol.strip().upper()
        try:
            quotes = await self._adapter.get_quotes([s_clean])
            quote = quotes[0] if quotes else Quote(symbol=s_clean, exchange="NSE", ltp=0.0, prev_close=0.0)
            self._cached_quotes[s_clean] = quote
            await self._adapter.subscribe_market_data([s_clean], self._on_tick)
            # Notify connected UI clients immediately
            await self._broadcast_tick(quote)
            return quote
        except Exception as e:
            logger.warning("Error dynamically subscribing symbol %s: %s", s_clean, e)
            q_fallback = Quote(symbol=s_clean, exchange="NSE", ltp=0.0, prev_close=0.0)
            self._cached_quotes[s_clean] = q_fallback
            return q_fallback

    async def unsubscribe_symbol(self, symbol: str) -> None:
        """Unsubscribe a symbol and remove from memory cache."""
        s_clean = symbol.strip().upper()
        try:
            await self._adapter.unsubscribe_market_data([s_clean])
        except Exception as e:
            logger.debug("Error unsubscribing symbol %s: %s", s_clean, e)
        self._cached_quotes.pop(s_clean, None)

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

    def get_cached_option_quote(self, symbol: str, token: Optional[str] = None) -> Optional[Quote]:
        """Look up cached option quote across multiple normalization keys (symbol, token, spaceless, compact)."""
        import re
        s_clean = symbol.strip().upper()
        if s_clean in self._cached_option_quotes:
            return self._cached_option_quotes[s_clean]
        if s_clean in self._cached_quotes:
            return self._cached_quotes[s_clean]

        s_spaceless = re.sub(r'\s+', '', s_clean)
        if s_spaceless in self._cached_option_quotes:
            return self._cached_option_quotes[s_spaceless]
        if s_spaceless in self._cached_quotes:
            return self._cached_quotes[s_spaceless]

        if token:
            tok_clean = token.strip().upper()
            if tok_clean in self._cached_option_quotes:
                return self._cached_option_quotes[tok_clean]
            if "|" in tok_clean and tok_clean.split("|")[1] in self._cached_option_quotes:
                return self._cached_option_quotes[tok_clean.split("|")[1]]

        for k, v in self._cached_option_quotes.items():
            k_spaceless = re.sub(r'\s+', '', k)
            if k_spaceless == s_spaceless:
                return v

        return None

    async def get_quotes(self, symbols: Optional[List[str]] = None) -> List[Quote]:
        """Get latest cached quotes or fetch on-demand with Option Chain cache fallback."""
        syms = symbols or DEFAULT_WATCHLIST
        # 1. Fill from option quote cache if available
        for s in syms:
            s_up = s.upper()
            if s_up not in self._cached_quotes:
                cached_opt = self.get_cached_option_quote(s)
                if cached_opt:
                    self._cached_quotes[s_up] = cached_opt

        # 2. Check remaining cache misses
        needed_fetch = [s for s in syms if s.upper() not in self._cached_quotes]
        if needed_fetch:
            new_quotes = await self._adapter.get_quotes(needed_fetch)
            for q in new_quotes:
                self._cached_quotes[q.symbol.upper()] = q

        return [self._cached_quotes[s.upper()] for s in syms if s.upper() in self._cached_quotes]

    async def get_option_chain(self, underlying: str, expiry: Optional[str] = None) -> OptionChain:
        """Fetch option chain from active adapter and prime option quote cache."""
        import re
        chain = await self._adapter.get_option_chain(underlying, expiry)
        und_clean = underlying.strip().upper()
        exch = "BSE" if "SENSEX" in und_clean else "NSE"

        # Prime all strike contracts into option quote cache for instantaneous order fill & margin check
        for strike in chain.strikes:
            for opt in (strike.call, strike.put):
                if not opt:
                    continue
                q = Quote(
                    symbol=opt.symbol,
                    exchange=exch,
                    token=opt.token,
                    ltp=opt.ltp,
                    prev_close=opt.prev_close or opt.ltp,
                    change=opt.change or 0.0,
                    change_percent=round(((opt.change or 0.0) / (opt.prev_close or opt.ltp or 1.0)) * 100, 2) if (opt.prev_close or opt.ltp) else 0.0,
                    volume=opt.volume or 0,
                    bid=opt.bid,
                    ask=opt.ask,
                    open_interest=int(opt.open_interest) if opt.open_interest else None
                )
                # Key 1: Direct contract symbol (e.g. NIFTY2026112625800CE)
                self._cached_quotes[opt.symbol.upper()] = q
                self._cached_option_quotes[opt.symbol.upper()] = q

                # Key 2: Spaced contract symbol (e.g. NIFTY 25800 CE)
                spaced_key = f"{und_clean} {int(opt.strike_price)} {opt.option_type}".upper()
                self._cached_quotes[spaced_key] = q
                self._cached_option_quotes[spaced_key] = q

                # Key 3: Spaceless key (e.g. NIFTY25800CE)
                compact_key = f"{und_clean}{int(opt.strike_price)}{opt.option_type}".upper()
                self._cached_quotes[compact_key] = q
                self._cached_option_quotes[compact_key] = q

                # Key 4: Token key
                if opt.token:
                    tok_u = opt.token.upper()
                    self._cached_quotes[tok_u] = q
                    self._cached_option_quotes[tok_u] = q
                    if "|" in tok_u:
                        bare_tok = tok_u.split("|")[1]
                        self._cached_quotes[bare_tok] = q
                        self._cached_option_quotes[bare_tok] = q

        return chain

    async def get_expiries(self, underlying: str) -> List[str]:
        """Fetch expiries for underlying."""
        return await self._adapter.get_expiries(underlying)


# Global market data service singleton
market_service = MarketDataService()
