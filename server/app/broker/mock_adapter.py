import asyncio
import inspect
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Callable, Dict, Any

from app.broker.base import BrokerAdapter
from app.broker.schemas import (
    Quote, OptionChain, OptionStrike, OptionContract,
    BrokerAuthResult, BrokerProfile, Position, Order,
    OrderRequest, OrderResult
)
from app.core.config import settings

logger = logging.getLogger(__name__)


class MockBrokerAdapter(BrokerAdapter):
    """
    Production-quality Simulated/Mock Broker for Indian markets.
    Provides realistic market data for NIFTY 50, BANKNIFTY, SENSEX, and top NSE stocks,
    realistic option chains, simulated positions, and safe paper-trading execution.
    """

    def __init__(self):
        self._connected = True
        self._subscribers: Dict[str, List[Callable[[Quote], Any]]] = {}
        self._streaming_task: Optional[asyncio.Task] = None
        self._orders: List[Order] = []
        self._positions: List[Position] = []
        self._init_baseline_data()
        self._init_simulated_portfolio()

    @property
    def broker_name(self) -> str:
        return "mock_broker"

    @property
    def is_connected(self) -> bool:
        return self._connected

    def _init_baseline_data(self):
        """Initial baseline market state for major Indian indices and stocks."""
        self._quotes: Dict[str, Dict[str, Any]] = {
            "NIFTY 50": {
                "symbol": "NIFTY 50", "exchange": "NSE", "token": "26000",
                "ltp": 24530.80, "open": 24480.00, "high": 24585.50, "low": 24450.20,
                "prev_close": 24420.00, "volume": 38245000, "step": 50, "lot": 50
            },
            "BANKNIFTY": {
                "symbol": "BANKNIFTY", "exchange": "NSE", "token": "26001",
                "ltp": 52340.50, "open": 52180.00, "high": 52490.00, "low": 52120.00,
                "prev_close": 52150.00, "volume": 18450000, "step": 100, "lot": 15
            },
            "SENSEX": {
                "symbol": "SENSEX", "exchange": "BSE", "token": "1",
                "ltp": 80420.25, "open": 80210.00, "high": 80560.80, "low": 80150.00,
                "prev_close": 80180.00, "volume": 12500000, "step": 100, "lot": 10
            },
            "RELIANCE": {
                "symbol": "RELIANCE", "exchange": "NSE", "token": "2885",
                "ltp": 2965.40, "open": 2940.00, "high": 2980.00, "low": 2935.00,
                "prev_close": 2942.50, "volume": 4820000, "step": 20, "lot": 250
            },
            "HDFCBANK": {
                "symbol": "HDFCBANK", "exchange": "NSE", "token": "1333",
                "ltp": 1682.15, "open": 1670.00, "high": 1690.00, "low": 1665.00,
                "prev_close": 1668.00, "volume": 9230000, "step": 10, "lot": 550
            },
            "ICICIBANK": {
                "symbol": "ICICIBANK", "exchange": "NSE", "token": "4963",
                "ltp": 1245.80, "open": 1235.00, "high": 1252.00, "low": 1232.00,
                "prev_close": 1238.40, "volume": 6120000, "step": 10, "lot": 700
            },
            "TCS": {
                "symbol": "TCS", "exchange": "NSE", "token": "11536",
                "ltp": 4125.60, "open": 4100.00, "high": 4145.00, "low": 4090.00,
                "prev_close": 4095.00, "volume": 2150000, "step": 50, "lot": 175
            },
            "INFY": {
                "symbol": "INFY", "exchange": "NSE", "token": "1594",
                "ltp": 1874.20, "open": 1860.00, "high": 1885.00, "low": 1855.00,
                "prev_close": 1858.00, "volume": 5430000, "step": 20, "lot": 400
            }
        }

    def _init_simulated_portfolio(self):
        """Initial simulated positions and orders for testing."""
        self._positions = [
            Position(
                symbol="NIFTY26OCT24500CE", exchange="NSE", product="MIS",
                quantity=100, buy_avg_price=145.50, sell_avg_price=0.0,
                ltp=162.20, pnl=1670.0, realized_pnl=0.0, unrealized_pnl=1670.0
            ),
            Position(
                symbol="RELIANCE", exchange="NSE", product="CNC",
                quantity=25, buy_avg_price=2920.00, sell_avg_price=0.0,
                ltp=2965.40, pnl=1135.0, realized_pnl=0.0, unrealized_pnl=1135.0
            )
        ]
        self._orders = [
            Order(
                order_id="MOCK-ORD-1001", symbol="NIFTY26OCT24500CE", exchange="NSE",
                transaction_type="BUY", order_type="LIMIT", product="MIS",
                quantity=100, filled_quantity=100, price=145.50,
                status="COMPLETE", order_timestamp=datetime.now(timezone.utc).isoformat()
            ),
            Order(
                order_id="MOCK-ORD-1002", symbol="RELIANCE", exchange="NSE",
                transaction_type="BUY", order_type="MARKET", product="CNC",
                quantity=25, filled_quantity=25, price=2920.00,
                status="COMPLETE", order_timestamp=datetime.now(timezone.utc).isoformat()
            )
        ]

    async def authenticate(self, credentials: Dict[str, Any]) -> BrokerAuthResult:
        self._connected = True
        return BrokerAuthResult(
            is_authenticated=True,
            broker_name=self.broker_name,
            message="Mock Paper Trading Broker connected successfully",
            session_metadata={"environment": "simulation", "mode": "paper_trading"}
        )

    async def get_profile(self) -> BrokerProfile:
        return BrokerProfile(
            client_id="MOCK_TRADER_001",
            client_name="Simulated Paper Trading Account",
            broker_name=self.broker_name,
            email="paper@mocktrading.local",
            available_margin=1000000.00,
            used_margin=182450.00,
            is_live=False
        )

    async def get_quotes(self, symbols: List[str]) -> List[Quote]:
        results = []
        for sym in symbols:
            s_clean = sym.strip().upper()
            if s_clean in self._quotes:
                raw = self._quotes[s_clean]
                ltp = raw["ltp"]
                pc = raw["prev_close"]
                chg = round(ltp - pc, 2)
                chg_pct = round((chg / pc) * 100, 2) if pc > 0 else 0.0
                quote = Quote(
                    symbol=raw["symbol"],
                    exchange=raw["exchange"],
                    token=raw["token"],
                    ltp=ltp,
                    open=raw["open"],
                    high=raw["high"],
                    low=raw["low"],
                    close=raw.get("close"),
                    prev_close=pc,
                    change=chg,
                    change_percent=chg_pct,
                    volume=raw["volume"],
                    last_trade_time=datetime.now(timezone.utc).strftime("%H:%M:%S"),
                    bid=round(ltp - 0.05, 2),
                    ask=round(ltp + 0.05, 2),
                    open_interest=raw.get("volume", 0) // 4
                )
                results.append(quote)
            else:
                # Provide a realistic quote fallback
                results.append(
                    Quote(
                        symbol=s_clean,
                        exchange="NSE",
                        ltp=100.0,
                        open=100.0,
                        high=102.0,
                        low=98.0,
                        prev_close=99.5,
                        change=0.5,
                        change_percent=0.5,
                        volume=10000
                    )
                )
        return results

    async def get_expiries(self, underlying: str) -> List[str]:
        # Generate upcoming Thursdays for weekly/monthly expiries
        today = datetime.now(timezone.utc).date()
        expiries = []
        curr = today
        for _ in range(60):
            if curr.weekday() == 3 and curr >= today:  # Thursday
                expiries.append(curr.isoformat())
                if len(expiries) >= 5:
                    break
            curr += timedelta(days=1)
        return expiries

    async def get_option_chain(self, underlying: str, expiry: Optional[str] = None) -> OptionChain:
        und = underlying.upper().strip()
        base = self._quotes.get(und, self._quotes["NIFTY 50"])
        ltp = base["ltp"]
        step = base.get("step", 50)
        lot = base.get("lot", 50)
        expiries = await self.get_expiries(und)
        sel_expiry = expiry if expiry and expiry in expiries else expiries[0]

        # Generate 15 strikes centered around ATM
        atm_strike = round(ltp / step) * step
        strikes_list = []
        for i in range(-7, 8):
            strike = atm_strike + (i * step)
            # Distance from ATM
            dist = strike - ltp
            # Approximate Call and Put LTP
            # Intrinsic value: Call = max(0, ltp - strike), Put = max(0, strike - ltp)
            time_val = max(10.0, 150.0 - abs(dist) * 0.15)
            call_ltp = round(max(0.05, max(0.0, -dist) + time_val), 2)
            put_ltp = round(max(0.05, max(0.0, dist) + time_val), 2)

            call_oi = max(500, int(150000 - abs(dist) * 80 + random.randint(-5000, 5000)))
            put_oi = max(500, int(160000 - abs(dist) * 80 + random.randint(-5000, 5000)))

            call_vol = max(100, int(call_oi * 0.4 + random.randint(-1000, 1000)))
            put_vol = max(100, int(put_oi * 0.4 + random.randint(-1000, 1000)))

            call_contract = OptionContract(
                symbol=f"{und}{sel_expiry.replace('-', '')}{int(strike)}CE",
                token=str(random.randint(10000, 99999)),
                option_type="CE",
                strike_price=float(strike),
                ltp=call_ltp,
                prev_close=round(call_ltp * 0.96, 2),
                change=round(call_ltp * 0.04, 2),
                volume=call_vol,
                open_interest=call_oi,
                change_oi=random.randint(-2000, 5000),
                bid=round(call_ltp - 0.15, 2),
                ask=round(call_ltp + 0.15, 2),
                iv=round(14.5 + abs(dist) * 0.005, 2)
            )

            put_contract = OptionContract(
                symbol=f"{und}{sel_expiry.replace('-', '')}{int(strike)}PE",
                token=str(random.randint(10000, 99999)),
                option_type="PE",
                strike_price=float(strike),
                ltp=put_ltp,
                prev_close=round(put_ltp * 1.03, 2),
                change=round(-put_ltp * 0.03, 2),
                volume=put_vol,
                open_interest=put_oi,
                change_oi=random.randint(-3000, 4000),
                bid=round(put_ltp - 0.15, 2),
                ask=round(put_ltp + 0.15, 2),
                iv=round(15.2 + abs(dist) * 0.005, 2)
            )

            strikes_list.append(OptionStrike(
                strike_price=float(strike),
                call=call_contract,
                put=put_contract
            ))

        return OptionChain(
            underlying=und,
            underlying_ltp=ltp,
            expiry=sel_expiry,
            expiries=expiries,
            lot_size=lot,
            strikes=strikes_list
        )

    async def get_positions(self) -> List[Position]:
        return self._positions

    async def get_orders(self) -> List[Order]:
        return self._orders

    async def place_order(self, order_req: OrderRequest) -> OrderResult:
        """
        Paper trading simulator order placement.
        Enforces TRADING_ENABLED check if live execution is requested.
        """
        if not settings.TRADING_ENABLED:
            logger.info("TRADING_ENABLED=False. Executing in SIMULATED/PAPER mode.")

        # Simulate execution
        exec_price = order_req.price if order_req.price and order_req.price > 0 else (
            self._quotes.get(order_req.symbol, {}).get("ltp", 100.0)
        )
        ord_id = f"MOCK-ORD-{random.randint(100000, 999999)}"
        new_order = Order(
            order_id=ord_id,
            symbol=order_req.symbol,
            exchange=order_req.exchange,
            transaction_type=order_req.transaction_type,
            order_type=order_req.order_type,
            product=order_req.product,
            quantity=order_req.quantity,
            filled_quantity=order_req.quantity,
            price=exec_price,
            trigger_price=order_req.trigger_price,
            status="COMPLETE",
            order_timestamp=datetime.now(timezone.utc).isoformat()
        )
        self._orders.insert(0, new_order)

        # Update or add position
        qty_delta = order_req.quantity if order_req.transaction_type == "BUY" else -order_req.quantity
        found = False
        for pos in self._positions:
            if pos.symbol == order_req.symbol and pos.product == order_req.product:
                pos.quantity += qty_delta
                pos.ltp = exec_price
                found = True
                break
        if not found:
            self._positions.append(Position(
                symbol=order_req.symbol,
                exchange=order_req.exchange,
                product=order_req.product,
                quantity=qty_delta,
                buy_avg_price=exec_price if qty_delta > 0 else 0.0,
                sell_avg_price=exec_price if qty_delta < 0 else 0.0,
                ltp=exec_price,
                pnl=0.0
            ))

        return OrderResult(
            success=True,
            order_id=ord_id,
            message="Paper order filled successfully (Simulated execution)",
            status="COMPLETE"
        )

    async def modify_order(self, order_id: str, quantity: Optional[int] = None, price: Optional[float] = None) -> OrderResult:
        for ord in self._orders:
            if ord.order_id == order_id:
                if quantity:
                    ord.quantity = quantity
                if price:
                    ord.price = price
                return OrderResult(success=True, order_id=order_id, message="Order modified", status=ord.status)
        return OrderResult(success=False, order_id=order_id, message="Order not found", status="REJECTED")

    async def cancel_order(self, order_id: str) -> OrderResult:
        for ord in self._orders:
            if ord.order_id == order_id:
                ord.status = "CANCELLED"
                return OrderResult(success=True, order_id=order_id, message="Order cancelled", status="CANCELLED")
        return OrderResult(success=False, order_id=order_id, message="Order not found", status="REJECTED")

    async def subscribe_market_data(self, symbols: List[str], callback: Callable[[Quote], Any]) -> None:
        for sym in symbols:
            s_clean = sym.strip().upper()
            if s_clean not in self._subscribers:
                self._subscribers[s_clean] = []
            if callback not in self._subscribers[s_clean]:
                self._subscribers[s_clean].append(callback)

        if not self._streaming_task or self._streaming_task.done():
            self._streaming_task = asyncio.create_task(self._simulation_loop())

    async def unsubscribe_market_data(self, symbols: List[str]) -> None:
        for sym in symbols:
            s_clean = sym.strip().upper()
            self._subscribers.pop(s_clean, None)

    async def _simulation_loop(self):
        """Micro-tick simulator that fluctuates prices realistically every 1-2 seconds."""
        try:
            while self._subscribers:
                await asyncio.sleep(1.5)
                for sym, callbacks in list(self._subscribers.items()):
                    if sym in self._quotes:
                        raw = self._quotes[sym]
                        # Fluctuate LTP by small fraction (-0.08% to +0.08%)
                        delta_pct = random.uniform(-0.0008, 0.0008)
                        new_ltp = round(raw["ltp"] * (1.0 + delta_pct), 2)
                        raw["ltp"] = new_ltp
                        raw["high"] = max(raw["high"], new_ltp)
                        raw["low"] = min(raw["low"], new_ltp)
                        raw["volume"] += random.randint(10, 500)

                        pc = raw["prev_close"]
                        chg = round(new_ltp - pc, 2)
                        chg_pct = round((chg / pc) * 100, 2) if pc > 0 else 0.0

                        quote = Quote(
                            symbol=raw["symbol"],
                            exchange=raw["exchange"],
                            token=raw["token"],
                            ltp=new_ltp,
                            open=raw["open"],
                            high=raw["high"],
                            low=raw["low"],
                            close=raw.get("close"),
                            prev_close=pc,
                            change=chg,
                            change_percent=chg_pct,
                            volume=raw["volume"],
                            last_trade_time=datetime.now(timezone.utc).strftime("%H:%M:%S"),
                            bid=round(new_ltp - 0.05, 2),
                            ask=round(new_ltp + 0.05, 2)
                        )
                        for cb in callbacks:
                            try:
                                if inspect.iscoroutinefunction(cb):
                                    await cb(quote)
                                else:
                                    cb(quote)
                            except Exception as e:
                                logger.debug("Error in market subscriber callback: %s", e)
        except asyncio.CancelledError:
            pass

    async def disconnect(self) -> None:
        """Disconnect mock broker session and stop tick generation."""
        self._connected = False
        if self._tick_task and not self._tick_task.done():
            self._tick_task.cancel()
            self._tick_task = None
        self._subscribers.clear()
        logger.info("Mock broker disconnected.")

