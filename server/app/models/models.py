from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
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


class BrokerAccount(Base):
    __tablename__ = "broker_accounts"

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
