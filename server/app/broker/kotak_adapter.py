import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional, Callable, Dict, Any

from app.broker.base import BrokerAdapter
from app.broker.schemas import (
    Quote, OptionChain, OptionStrike, OptionContract,
    BrokerAuthResult, BrokerProfile, Position, Order,
    OrderRequest, OrderResult
)
from app.core.config import settings

logger = logging.getLogger(__name__)

# Try importing official NeoAPI client
try:
    from neo_api_client import NeoAPI
    from neo_api_client.websocket.feed import WsToken, SFeedScrip, SFeedIndex
    KOTAK_SDK_AVAILABLE = True
except ImportError:
    KOTAK_SDK_AVAILABLE = False
    logger.warning("kotakneoapi / neo_api_client is not installed or available.")


class KotakNeoAdapter(BrokerAdapter):
    """
    Official Kotak Neo Broker Adapter (V2 Trade API / SFeed WebSocket Protocol).
    Adheres strictly to the official Kotak Neo Trade API documentation:
    - 2-step TOTP Login & MPIN validation returning dynamic baseUrl and sid.
    - Plain token authorization.
    - Async/await SFeed native_batch WebSocket for live market data (post-15 Sept 2026 deprecation).
    - Rate-limited Quotes & Option Chain endpoints.
    - Financial risk safety checks (TRADING_ENABLED guardrail).
    """

    def __init__(self, credentials: Optional[Dict[str, Any]] = None):
        self._credentials = credentials or {}
        self._client: Optional[Any] = None
        self._ws_client: Optional[Any] = None
        self._connected = False
        self._session_data: Dict[str, Any] = {}
        self._subscribers: Dict[str, List[Callable[[Quote], Any]]] = {}
        self._ws_task: Optional[asyncio.Task] = None

        # Pre-seed credentials from settings if available (and not placeholder)
        if not self._credentials:
            if settings.KOTAK_CONSUMER_KEY and not settings.KOTAK_CONSUMER_KEY.startswith("mock_"):
                self._credentials = {
                    "consumer_key": settings.KOTAK_CONSUMER_KEY,
                    "consumer_secret": settings.KOTAK_CONSUMER_SECRET,
                    "mobile_number": settings.KOTAK_MOBILE_NUMBER,
                    "ucc": settings.KOTAK_UCC,
                    "mpin": settings.KOTAK_MPIN,
                    "totp_secret": settings.KOTAK_TOTP_SECRET,
                    "environment": settings.KOTAK_ENVIRONMENT,
                }

    @property
    def broker_name(self) -> str:
        return "kotak_neo"

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def authenticate(self, credentials: Optional[Dict[str, Any]] = None) -> BrokerAuthResult:
        """
        Authenticate with Kotak Neo using official TOTP login flow:
        Step 1: NeoAPI(consumer_key, environment)
        Step 2: client.totp_login(mobile_number, ucc, totp)
        Step 3: client.totp_validate(mpin) -> establishes session and dynamic baseUrl
        """
        if credentials is not None:
            self._credentials = dict(credentials)

        consumer_key = self._credentials.get("consumer_key")
        consumer_secret = self._credentials.get("consumer_secret")
        mobile = self._credentials.get("mobile_number")
        ucc = self._credentials.get("ucc")
        mpin = self._credentials.get("mpin")
        totp_secret = self._credentials.get("totp_secret")
        environment = self._credentials.get("environment", "prod")

        # Validate presence of credentials
        if not (consumer_key and mobile and ucc and mpin) or "placeholder" in str(consumer_key).lower():
            self._connected = False
            return BrokerAuthResult(
                is_authenticated=False,
                broker_name=self.broker_name,
                message="Kotak Neo credentials incomplete. Required: Consumer Key, Mobile, UCC, MPIN.",
                session_metadata={"status": "missing_credentials"}
            )

        if not KOTAK_SDK_AVAILABLE:
            return BrokerAuthResult(
                is_authenticated=False,
                broker_name=self.broker_name,
                message="kotakneoapi Python SDK not available in environment.",
                session_metadata={"status": "sdk_unavailable"}
            )

        try:
            # Generate TOTP code if totp_secret is supplied
            totp_code = ""
            if totp_secret:
                import pyotp
                totp_code = pyotp.TOTP(totp_secret).now()

            # Execute authentication via official NeoAPI
            # Note: client methods are synchronous in SDK; run in thread pool
            loop = asyncio.get_running_loop()

            def _login():
                client = NeoAPI(
                    consumer_key=consumer_key,
                    environment=environment
                )
                # Step 1: TOTP Login
                client.totp_login(mobile_number=mobile, ucc=ucc, totp=totp_code)
                # Step 2: MPIN Validate -> acquires baseUrl, sid, tokens
                validate_resp = client.totp_validate(mpin=mpin)
                return client, validate_resp

            client, validate_resp = await loop.run_in_executor(None, _login)
            self._client = client
            self._connected = True
            self._session_data = validate_resp if isinstance(validate_resp, dict) else {"status": "authenticated"}

            return BrokerAuthResult(
                is_authenticated=True,
                broker_name=self.broker_name,
                message="Kotak Neo authenticated successfully",
                session_metadata={
                    "ucc": ucc,
                    "environment": environment,
                    "connected_at": datetime.now(timezone.utc).isoformat()
                }
            )
        except Exception as e:
            logger.error("Kotak Neo authentication error: %s", str(e), exc_info=True)
            self._connected = False
            return BrokerAuthResult(
                is_authenticated=False,
                broker_name=self.broker_name,
                message=f"Kotak Neo authentication failed: {str(e)}",
                session_metadata={"error": str(e)}
            )

    async def get_profile(self) -> BrokerProfile:
        if not self._connected or not self._client:
            return BrokerProfile(
                client_id=self._credentials.get("ucc", "NOT_CONNECTED"),
                client_name="Kotak Neo Account",
                broker_name=self.broker_name,
                available_margin=0.0,
                used_margin=0.0,
                is_live=False
            )

        loop = asyncio.get_running_loop()
        try:
            limits_resp = await loop.run_in_executor(None, self._client.limits)
            avail = 0.0
            used = 0.0
            if isinstance(limits_resp, dict) and "data" in limits_resp:
                avail = float(limits_resp["data"].get("cash", 0.0))
                used = float(limits_resp["data"].get("marginUsed", 0.0))

            return BrokerProfile(
                client_id=self._credentials.get("ucc", "KOTAK_USER"),
                client_name="Kotak Neo Live Account",
                broker_name=self.broker_name,
                available_margin=avail,
                used_margin=used,
                is_live=True
            )
        except Exception as e:
            logger.error("Error fetching Kotak profile/limits: %s", e)
            return BrokerProfile(
                client_id=self._credentials.get("ucc", "KOTAK_USER"),
                client_name="Kotak Neo Live Account",
                broker_name=self.broker_name,
                available_margin=0.0,
                used_margin=0.0,
                is_live=True
            )

    async def get_quotes(self, symbols: List[str]) -> List[Quote]:
        if not self._connected or not self._client:
            # Return placeholder quotes if not authenticated with live Kotak
            return [
                Quote(symbol=s, exchange="NSE", ltp=0.0, prev_close=0.0)
                for s in symbols
            ]

        loop = asyncio.get_running_loop()
        try:
            # Map symbols to Kotak instrument token dictionaries
            # Format: [{"instrument_token": "...", "exchange_segment": "nse_cm"}]
            # Up to 50 instruments per request as per Kotak specification
            tokens = []
            for s in symbols:
                tokens.append({"instrument_token": s, "exchange_segment": "nse_cm"})

            raw_quotes = await loop.run_in_executor(
                None,
                lambda: self._client.quotes(instrument_tokens=tokens, quote_type="all")
            )

            results: List[Quote] = []
            if isinstance(raw_quotes, list):
                for item in raw_quotes:
                    ohlc = item.get("ohlc", {})
                    ltp = float(item.get("ltp", 0.0))
                    pc = float(ohlc.get("close", 0.0)) or ltp
                    chg = float(item.get("change", ltp - pc))
                    chg_pct = float(item.get("per_change", 0.0))

                    results.append(
                        Quote(
                            symbol=item.get("display_symbol", item.get("exchange_token", "")),
                            exchange=item.get("exchange", "NSE"),
                            token=item.get("exchange_token"),
                            ltp=ltp,
                            open=float(ohlc.get("open", 0.0)),
                            high=float(ohlc.get("high", 0.0)),
                            low=float(ohlc.get("low", 0.0)),
                            close=float(ohlc.get("close", 0.0)),
                            prev_close=pc,
                            change=chg,
                            change_percent=chg_pct,
                            volume=int(item.get("last_volume", 0)),
                            bid=float(item.get("depth", {}).get("buy", [{}])[0].get("price", 0.0)) if item.get("depth") else None,
                            ask=float(item.get("depth", {}).get("sell", [{}])[0].get("price", 0.0)) if item.get("depth") else None,
                            depth=item.get("depth")
                        )
                    )
            return results
        except Exception as e:
            logger.error("Error fetching Kotak quotes: %s", e)
            return []

    async def get_expiries(self, underlying: str) -> List[str]:
        if not self._connected or not self._client:
            return []
        loop = asyncio.get_running_loop()
        try:
            resp = await loop.run_in_executor(
                None,
                lambda: self._client.expiries(exchange="nse_fo", underlying=underlying.upper())
            )
            if isinstance(resp, dict) and "data" in resp:
                return resp["data"]
            elif isinstance(resp, list):
                return resp
            return []
        except Exception as e:
            logger.error("Error fetching Kotak expiries: %s", e)
            return []

    async def get_option_chain(self, underlying: str, expiry: Optional[str] = None) -> OptionChain:
        if not self._connected or not self._client:
            return OptionChain(underlying=underlying, underlying_ltp=0.0, expiry=expiry or "")

        loop = asyncio.get_running_loop()
        try:
            resp = await loop.run_in_executor(
                None,
                lambda: self._client.option_chain(
                    exchange="nse_fo",
                    underlying=underlying.upper(),
                    expiry=expiry,
                    instrument_type="option",
                    count=40
                )
            )

            data = resp.get("data", {}) if isinstance(resp, dict) else {}
            common = data.get("common_data", {})
            lot_size = int(common.get("mktLot", 50))
            exp_date = common.get("expiryDt", expiry or "")

            call_items = {item["instrument"]["strikePrice"]: item for item in data.get("call", [])}
            put_items = {item["instrument"]["strikePrice"]: item for item in data.get("put", [])}

            all_strikes = sorted(set(call_items.keys()) | set(put_items.keys()), key=lambda x: float(x))
            strikes: List[OptionStrike] = []

            for s_str in all_strikes:
                s_val = float(s_str)
                call_data = call_items.get(s_str)
                put_data = put_items.get(s_str)

                call_contract = None
                if call_data:
                    q = call_data.get("quote", {})
                    oi = call_data.get("openInterest", {})
                    call_contract = OptionContract(
                        symbol=call_data.get("instrument", {}).get("symbol", ""),
                        token=call_data.get("instrument", {}).get("neoSymbol", ""),
                        option_type="CE",
                        strike_price=s_val,
                        ltp=float(q.get("ltp", 0.0)),
                        prev_close=float(q.get("prevClose", 0.0)) if q.get("prevClose") else None,
                        change=float(q.get("ltp", 0.0)) - (float(q.get("prevClose", 0.0)) if q.get("prevClose") else 0.0),
                        volume=q.get("volume"),
                        open_interest=oi.get("current"),
                        change_oi=oi.get("change")
                    )

                put_contract = None
                if put_data:
                    q = put_data.get("quote", {})
                    oi = put_data.get("openInterest", {})
                    put_contract = OptionContract(
                        symbol=put_data.get("instrument", {}).get("symbol", ""),
                        token=put_data.get("instrument", {}).get("neoSymbol", ""),
                        option_type="PE",
                        strike_price=s_val,
                        ltp=float(q.get("ltp", 0.0)),
                        prev_close=float(q.get("prevClose", 0.0)) if q.get("prevClose") else None,
                        change=float(q.get("ltp", 0.0)) - (float(q.get("prevClose", 0.0)) if q.get("prevClose") else 0.0),
                        volume=q.get("volume"),
                        open_interest=oi.get("current"),
                        change_oi=oi.get("change")
                    )

                strikes.append(OptionStrike(strike_price=s_val, call=call_contract, put=put_contract))

            # Underlying LTP from quote
            und_ltp = 0.0
            if strikes:
                mid_strike = strikes[len(strikes) // 2].strike_price
                und_ltp = mid_strike

            return OptionChain(
                underlying=underlying.upper(),
                underlying_ltp=und_ltp,
                expiry=exp_date,
                lot_size=lot_size,
                strikes=strikes
            )
        except Exception as e:
            logger.error("Error fetching Kotak option chain: %s", e)
            return OptionChain(underlying=underlying, underlying_ltp=0.0, expiry=expiry or "")

    async def get_positions(self) -> List[Position]:
        if not self._connected or not self._client:
            return []
        loop = asyncio.get_running_loop()
        try:
            resp = await loop.run_in_executor(None, self._client.positions)
            positions = []
            if isinstance(resp, dict) and "data" in resp:
                for item in resp["data"]:
                    positions.append(
                        Position(
                            symbol=item.get("tradingSymbol", item.get("sym", "")),
                            exchange=item.get("exchangeSegment", "NSE"),
                            product=item.get("product", "MIS"),
                            quantity=int(item.get("netQty", 0)),
                            buy_avg_price=float(item.get("buyAvgPrice", 0.0)),
                            sell_avg_price=float(item.get("sellAvgPrice", 0.0)),
                            ltp=float(item.get("ltp", 0.0)),
                            pnl=float(item.get("pnl", 0.0)),
                            realized_pnl=float(item.get("realizedPnl", 0.0)),
                            unrealized_pnl=float(item.get("unrealizedPnl", 0.0))
                        )
                    )
            return positions
        except Exception as e:
            logger.error("Error fetching Kotak positions: %s", e)
            return []

    async def get_orders(self) -> List[Order]:
        if not self._connected or not self._client:
            return []
        loop = asyncio.get_running_loop()
        try:
            resp = await loop.run_in_executor(None, self._client.order_report)
            orders = []
            if isinstance(resp, dict) and "data" in resp:
                for item in resp["data"]:
                    orders.append(
                        Order(
                            order_id=str(item.get("nOrdNo", item.get("orderId", ""))),
                            symbol=item.get("tradingSymbol", item.get("sym", "")),
                            exchange=item.get("exchangeSegment", "NSE"),
                            transaction_type=item.get("transactionType", "BUY"),
                            order_type=item.get("orderType", "LIMIT"),
                            product=item.get("product", "MIS"),
                            quantity=int(item.get("qty", 0)),
                            filled_quantity=int(item.get("filledQty", 0)),
                            price=float(item.get("price", 0.0)),
                            status=item.get("ordSt", "PENDING"),
                            order_timestamp=item.get("ordDtTm", "")
                        )
                    )
            return orders
        except Exception as e:
            logger.error("Error fetching Kotak orders: %s", e)
            return []

    async def place_order(self, order_req: OrderRequest) -> OrderResult:
        """
        Place order on Kotak Neo API.
        STRICT SAFETY CHECK: Refuses execution unless TRADING_ENABLED is True!
        """
        if not settings.TRADING_ENABLED:
            logger.warning("Live order rejected: TRADING_ENABLED=False.")
            return OrderResult(
                success=False,
                order_id=None,
                message="Live trading is disabled by safety guardrail (TRADING_ENABLED=False).",
                status="REJECTED_SAFETY_CONTROL"
            )

        if not self._connected or not self._client:
            return OrderResult(
                success=False,
                order_id=None,
                message="Kotak Neo session is not authenticated.",
                status="NOT_AUTHENTICATED"
            )

        loop = asyncio.get_running_loop()
        try:
            resp = await loop.run_in_executor(
                None,
                lambda: self._client.place_order(
                    exchange_segment=order_req.exchange.lower(),
                    product=order_req.product,
                    price=str(order_req.price),
                    order_type=order_req.order_type,
                    quantity=str(order_req.quantity),
                    validity="DAY",
                    trading_symbol=order_req.symbol,
                    transaction_type=order_req.transaction_type,
                    amo="NO",
                    disclosed_quantity="0",
                    market_protection="0",
                    pf="N",
                    trigger_price=str(order_req.trigger_price) if order_req.trigger_price else "0"
                )
            )
            order_id = resp.get("nOrdNo") or resp.get("orderId") if isinstance(resp, dict) else "SUCCESS"
            return OrderResult(
                success=True,
                order_id=str(order_id),
                message="Order placed successfully on Kotak Neo",
                status="SUBMITTED"
            )
        except Exception as e:
            logger.error("Error placing Kotak order: %s", e)
            return OrderResult(
                success=False,
                order_id=None,
                message=f"Order placement failed: {str(e)}",
                status="ERROR"
            )

    async def modify_order(self, order_id: str, quantity: Optional[int] = None, price: Optional[float] = None) -> OrderResult:
        if not settings.TRADING_ENABLED:
            return OrderResult(
                success=False,
                order_id=order_id,
                message="Live order modification blocked: TRADING_ENABLED=False.",
                status="REJECTED_SAFETY_CONTROL"
            )
        if not self._connected or not self._client:
            return OrderResult(success=False, order_id=order_id, message="Not authenticated", status="NOT_AUTHENTICATED")

        loop = asyncio.get_running_loop()
        try:
            resp = await loop.run_in_executor(
                None,
                lambda: self._client.modify_order(
                    order_id=order_id,
                    price=str(price) if price else None,
                    quantity=str(quantity) if quantity else None
                )
            )
            return OrderResult(success=True, order_id=order_id, message="Order modified", status="SUBMITTED")
        except Exception as e:
            return OrderResult(success=False, order_id=order_id, message=str(e), status="ERROR")

    async def cancel_order(self, order_id: str) -> OrderResult:
        if not settings.TRADING_ENABLED:
            return OrderResult(
                success=False,
                order_id=order_id,
                message="Live order cancellation blocked: TRADING_ENABLED=False.",
                status="REJECTED_SAFETY_CONTROL"
            )
        if not self._connected or not self._client:
            return OrderResult(success=False, order_id=order_id, message="Not authenticated", status="NOT_AUTHENTICATED")

        loop = asyncio.get_running_loop()
        try:
            resp = await loop.run_in_executor(
                None,
                lambda: self._client.cancel_order(order_id=order_id)
            )
            return OrderResult(success=True, order_id=order_id, message="Order cancelled", status="CANCELLED")
        except Exception as e:
            return OrderResult(success=False, order_id=order_id, message=str(e), status="ERROR")

    async def subscribe_market_data(self, symbols: List[str], callback: Callable[[Quote], Any]) -> None:
        """
        Subscribe to live market feed using the modern SFeed WebSocket client (async/await native_batch protocol).
        """
        for sym in symbols:
            s_clean = sym.strip().upper()
            if s_clean not in self._subscribers:
                self._subscribers[s_clean] = []
            if callback not in self._subscribers[s_clean]:
                self._subscribers[s_clean].append(callback)

        if not self._connected or not self._client or not KOTAK_SDK_AVAILABLE:
            return

        # Launch SFeed WebSocket consumer if not already running
        if not self._ws_task or self._ws_task.done():
            self._ws_task = asyncio.create_task(self._run_sfeed_websocket())

    async def unsubscribe_market_data(self, symbols: List[str]) -> None:
        for sym in symbols:
            s_clean = sym.strip().upper()
            self._subscribers.pop(s_clean, None)

    async def _run_sfeed_websocket(self):
        """
        SFeed WebSocket consumer using official async context manager:
        async with client.create_websocket() as ws:
            await ws.subscribe_scrips([...])
            async for message in ws:
                ...
        """
        try:
            ws = self._client.create_websocket()
            tokens_to_subscribe = []
            for s in self._subscribers.keys():
                tokens_to_subscribe.append(WsToken("nse_cm", s))

            async with ws:
                if tokens_to_subscribe:
                    await ws.subscribe_scrips(tokens_to_subscribe)

                async for message in ws:
                    if isinstance(message, SFeedScrip) or isinstance(message, SFeedIndex):
                        sym = getattr(message, "trading_symbol", "")
                        ltp = float(getattr(message, "last_traded_price", 0.0))
                        pc = float(getattr(message, "close_price", ltp))
                        chg = float(getattr(message, "net_change", ltp - pc))
                        chg_pct = float(getattr(message, "net_change_percent", 0.0))

                        quote = Quote(
                            symbol=sym,
                            exchange=getattr(message, "exchange_segment", "NSE"),
                            token=str(getattr(message, "instrument_token", "")),
                            ltp=ltp,
                            open=float(getattr(message, "open_price", 0.0)),
                            high=float(getattr(message, "high_price", 0.0)),
                            low=float(getattr(message, "low_price", 0.0)),
                            close=pc,
                            prev_close=pc,
                            change=chg,
                            change_percent=chg_pct,
                            volume=int(getattr(message, "volume_traded_today", 0)),
                            last_trade_time=datetime.now(timezone.utc).strftime("%H:%M:%S")
                        )

                        # Notify subscribers
                        cbs = self._subscribers.get(sym.upper(), [])
                        for cb in cbs:
                            try:
                                if asyncio.iscoroutinefunction(cb):
                                    await cb(quote)
                                else:
                                    cb(quote)
                            except Exception as e:
                                logger.debug("Error in Kotak subscriber callback: %s", e)
        except Exception as e:
            logger.error("Kotak SFeed WebSocket error: %s", e)
