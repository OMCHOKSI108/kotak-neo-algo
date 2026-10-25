from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class Quote(BaseModel):
    symbol: str
    exchange: str = "NSE"
    token: Optional[str] = None
    ltp: float
    open: float = 0.0
    high: float = 0.0
    low: float = 0.0
    close: Optional[float] = None
    prev_close: float = 0.0
    change: float = 0.0
    change_percent: float = 0.0
    volume: int = 0
    last_trade_time: Optional[str] = None
    bid: Optional[float] = None
    ask: Optional[float] = None
    open_interest: Optional[int] = None
    depth: Optional[Dict[str, List[Dict[str, Any]]]] = None


class OptionContract(BaseModel):
    symbol: str
    token: Optional[str] = None
    option_type: str  # "CE" or "PE"
    strike_price: float
    ltp: float = 0.0
    prev_close: Optional[float] = None
    change: Optional[float] = None
    volume: Optional[int] = None
    open_interest: Optional[float] = None
    change_oi: Optional[float] = None
    bid: Optional[float] = None
    ask: Optional[float] = None
    iv: Optional[float] = None


class OptionStrike(BaseModel):
    strike_price: float
    call: Optional[OptionContract] = None
    put: Optional[OptionContract] = None


class OptionChain(BaseModel):
    underlying: str
    underlying_ltp: float
    expiry: str
    expiries: List[str] = Field(default_factory=list)
    lot_size: int = 50
    strikes: List[OptionStrike] = Field(default_factory=list)


class BrokerAuthResult(BaseModel):
    is_authenticated: bool
    broker_name: str
    message: str
    session_metadata: Dict[str, Any] = Field(default_factory=dict)


class BrokerProfile(BaseModel):
    client_id: str
    client_name: str
    broker_name: str
    email: Optional[str] = None
    available_margin: float = 0.0
    used_margin: float = 0.0
    collateral: float = 0.0
    cash: float = 0.0
    is_live: bool = False


class Position(BaseModel):
    symbol: str
    exchange: str = "NSE"
    product: str = "MIS"  # MIS, NRML, CNC
    quantity: int = 0
    buy_avg_price: float = 0.0
    sell_avg_price: float = 0.0
    ltp: float = 0.0
    pnl: float = 0.0
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0


class Order(BaseModel):
    order_id: str
    symbol: str
    exchange: str = "NSE"
    transaction_type: str  # BUY or SELL
    order_type: str = "MARKET"  # MARKET, LIMIT, SL, SL-M
    product: str = "MIS"
    quantity: int
    filled_quantity: int = 0
    price: float = 0.0
    trigger_price: Optional[float] = 0.0
    status: str = "COMPLETE"  # COMPLETE, PENDING, REJECTED, CANCELLED
    order_timestamp: str = ""
    rejection_reason: Optional[str] = None


class OrderRequest(BaseModel):
    symbol: str
    exchange: str = "NSE"
    transaction_type: str  # BUY or SELL
    order_type: str = "MARKET"  # MARKET, LIMIT, SL, SL-M
    product: str = "MIS"  # MIS, NRML, CNC
    quantity: int
    price: Optional[float] = 0.0
    trigger_price: Optional[float] = 0.0
    stop_loss: Optional[float] = None
    target: Optional[float] = None
    tag: Optional[str] = "NEO_ALGO"


class OrderResult(BaseModel):
    success: bool
    order_id: Optional[str] = None
    message: str
    status: str
