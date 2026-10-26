from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON, Float, Index
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="user", nullable=False)  # "admin" or "user"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    broker_accounts = relationship("BrokerAccount", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    backtest_runs = relationship("BacktestRun", back_populates="user", cascade="all, delete-orphan")
    trading_settings = relationship("UserTradingSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    strategies = relationship("Strategy", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("OrderRecord", back_populates="user", cascade="all, delete-orphan")
    positions = relationship("PositionRecord", back_populates="user", cascade="all, delete-orphan")
    trades = relationship("TradeRecord", back_populates="user", cascade="all, delete-orphan")


class BrokerAccount(Base):
    __tablename__ = "broker_accounts"
    __table_args__ = (
        Index("ix_broker_accounts_user_status", "user_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    broker = Column(String(50), nullable=False, default="KOTAK_NEO")  # e.g., "KOTAK_NEO", "MOCK_BROKER"
    broker_name = Column(String(50), nullable=True, default="KOTAK_NEO")
    account_name = Column(String(100), default="Default Account", nullable=False)
    status = Column(String(20), default="DISCONNECTED", nullable=False)  # "CONNECTED", "DISCONNECTED", "FAILED"
    is_active = Column(Boolean, default=True, nullable=True)
    last_authenticated_at = Column(DateTime(timezone=True), nullable=True)
    last_heartbeat_at = Column(DateTime(timezone=True), nullable=True)

    # Sensitive credentials & session tokens ENCRYPTED AT REST with authenticated AES-256-GCM
    encrypted_consumer_key = Column(Text, nullable=True)
    encrypted_mobile_number = Column(Text, nullable=True)
    encrypted_ucc = Column(Text, nullable=True)
    encrypted_mpin = Column(Text, nullable=True)
    encrypted_totp_secret = Column(Text, nullable=True)
    encrypted_view_token = Column(Text, nullable=True)
    encrypted_view_sid = Column(Text, nullable=True)
    encrypted_trading_token = Column(Text, nullable=True)
    encrypted_trading_sid = Column(Text, nullable=True)
    encrypted_base_url = Column(Text, nullable=True)

    # Legacy field support
    encrypted_consumer_secret = Column(Text, nullable=True)

    # Safe display identifier (masked) e.g., "UCC: *****123"
    masked_identifier = Column(String(100), default="", nullable=False)

    # Non-sensitive dynamic session metadata
    session_metadata = Column(JSON, default=dict, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="broker_accounts")

    def __init__(self, **kwargs):
        if "broker_name" in kwargs and "broker" not in kwargs:
            kwargs["broker"] = kwargs["broker_name"]
        elif "broker" in kwargs and "broker_name" not in kwargs:
            kwargs["broker_name"] = kwargs["broker"]
        super().__init__(**kwargs)

    @property
    def is_connected(self) -> bool:
        return self.status == "CONNECTED"

    @is_connected.setter
    def is_connected(self, val: bool):
        self.status = "CONNECTED" if val else "DISCONNECTED"


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_user_created", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    broker_account_id = Column(Integer, ForeignKey("broker_accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    details = Column(JSON, default=dict, nullable=False)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="audit_logs")


class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    strategy_name = Column(String(100), nullable=False)
    symbol = Column(String(50), nullable=False)
    timeframe = Column(String(20), default="1d", nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    
    parameters = Column(JSON, default=dict, nullable=False)
    metrics = Column(JSON, default=dict, nullable=False)
    trades = Column(JSON, default=list, nullable=False)
    equity_curve = Column(JSON, default=list, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="backtest_runs")


class UserTradingSettings(Base):
    __tablename__ = "user_trading_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    trading_mode = Column(String(20), default="PAPER", nullable=False)  # "PAPER" or "LIVE"
    live_trading_enabled = Column(Boolean, default=False, nullable=False)
    
    # Lot configurations per instrument
    nifty_lots = Column(Integer, default=1, nullable=False)
    banknifty_lots = Column(Integer, default=1, nullable=False)
    sensex_lots = Column(Integer, default=1, nullable=False)
    
    # Risk limits
    max_daily_loss = Column(Float, default=5000.0, nullable=False)
    max_daily_trades = Column(Integer, default=10, nullable=False)
    max_open_positions = Column(Integer, default=3, nullable=False)
    max_loss_per_trade = Column(Float, default=1500.0, nullable=False)
    
    # Circuit breaker / safety halt
    is_trading_halted = Column(Boolean, default=False, nullable=False)
    halt_reason = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="trading_settings")


class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    instrument = Column(String(50), default="NIFTY", nullable=False)  # NIFTY, BANKNIFTY, SENSEX
    timeframe = Column(String(20), default="5m", nullable=False)
    mode = Column(String(20), default="PAPER", nullable=False)  # "DISABLED", "PAPER", "LIVE"
    status = Column(String(20), default="READY", nullable=False)  # "READY", "RUNNING", "PAUSED", "STOPPED"
    
    # Algorithm parameters (9/15 EMA default)
    fast_ema = Column(Integer, default=9, nullable=False)
    slow_ema = Column(Integer, default=15, nullable=False)
    option_type = Column(String(10), default="CALL", nullable=False)  # "CALL", "PUT"
    strike_selection = Column(String(20), default="ATM", nullable=False)  # "ATM", "ITM1", "OTM1"
    lots = Column(Integer, default=1, nullable=False)
    stop_loss = Column(Float, default=20.0, nullable=False)
    target = Column(Float, default=40.0, nullable=False)
    max_trades_per_day = Column(Integer, default=3, nullable=False)
    schedule_start = Column(String(10), default="09:20", nullable=False)
    schedule_end = Column(String(10), default="15:15", nullable=False)
    config = Column(JSON, default=dict, nullable=False)

    # Runtime performance metrics
    today_pnl = Column(Float, default=0.0, nullable=False)
    total_pnl = Column(Float, default=0.0, nullable=False)
    trades_count = Column(Integer, default=0, nullable=False)
    win_rate = Column(Float, default=0.0, nullable=False)
    max_drawdown = Column(Float, default=0.0, nullable=False)
    last_signal = Column(String(100), nullable=True)
    last_signal_time = Column(DateTime(timezone=True), nullable=True)
    last_run_time = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="strategies")
    orders = relationship("OrderRecord", back_populates="strategy")
    positions = relationship("PositionRecord", back_populates="strategy")
    trades = relationship("TradeRecord", back_populates="strategy")


class OrderRecord(Base):
    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_orders_user_status", "user_id", "status"),
        Index("ix_orders_user_placed_at", "user_id", "placed_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    broker_account_id = Column(Integer, ForeignKey("broker_accounts.id", ondelete="SET NULL"), nullable=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id", ondelete="SET NULL"), nullable=True)
    
    order_id = Column(String(100), nullable=False, index=True)
    symbol = Column(String(100), nullable=False)
    exchange = Column(String(20), default="NSE", nullable=False)
    side = Column(String(10), nullable=False)  # "BUY" or "SELL"
    order_type = Column(String(20), default="MARKET", nullable=False)  # "MARKET" or "LIMIT"
    product = Column(String(20), default="MIS", nullable=False)  # "MIS" or "NRML"
    quantity = Column(Integer, nullable=False)
    lots = Column(Integer, default=1, nullable=False)
    price = Column(Float, default=0.0, nullable=False)
    trigger_price = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)
    target = Column(Float, nullable=True)
    
    status = Column(String(30), default="OPEN", nullable=False)  # "OPEN", "EXECUTED", "REJECTED", "CANCELLED", "PENDING"
    rejection_reason = Column(Text, nullable=True)
    mode = Column(String(20), default="PAPER", nullable=False)  # "PAPER" or "LIVE"
    
    placed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    executed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="orders")
    strategy = relationship("Strategy", back_populates="orders")


class PositionRecord(Base):
    __tablename__ = "positions"
    __table_args__ = (
        Index("ix_positions_user_sym_prod_stat", "user_id", "symbol", "product", "status", "mode"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    broker_account_id = Column(Integer, ForeignKey("broker_accounts.id", ondelete="SET NULL"), nullable=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id", ondelete="SET NULL"), nullable=True)

    symbol = Column(String(100), nullable=False)
    exchange = Column(String(20), default="NSE", nullable=False)
    product = Column(String(20), default="MIS", nullable=False)
    side = Column(String(10), default="BUY", nullable=False)
    quantity = Column(Integer, default=0, nullable=False)
    buy_avg_price = Column(Float, default=0.0, nullable=False)
    sell_avg_price = Column(Float, default=0.0, nullable=False)
    ltp = Column(Float, default=0.0, nullable=False)
    pnl = Column(Float, default=0.0, nullable=False)
    pnl_percent = Column(Float, default=0.0, nullable=False)
    realized_pnl = Column(Float, default=0.0, nullable=False)
    unrealized_pnl = Column(Float, default=0.0, nullable=False)
    status = Column(String(20), default="OPEN", nullable=False)  # "OPEN" or "CLOSED"
    mode = Column(String(20), default="PAPER", nullable=False)  # "PAPER" or "LIVE"

    opened_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="positions")
    strategy = relationship("Strategy", back_populates="positions")


class TradeRecord(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id", ondelete="SET NULL"), nullable=True)

    symbol = Column(String(100), nullable=False)
    side = Column(String(10), nullable=False)
    quantity = Column(Integer, nullable=False)
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=False)
    pnl = Column(Float, default=0.0, nullable=False)
    pnl_percent = Column(Float, default=0.0, nullable=False)
    entry_time = Column(DateTime(timezone=True), nullable=False)
    exit_time = Column(DateTime(timezone=True), nullable=False)
    exit_reason = Column(String(100), nullable=True)
    mode = Column(String(20), default="PAPER", nullable=False)  # "PAPER" or "LIVE"

    user = relationship("User", back_populates="trades")
    strategy = relationship("Strategy", back_populates="trades")
