from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import User, BrokerAccount, AuditLog
from app.core.security import encrypt_credential, decrypt_credential, mask_secret
from app.core.config import settings
from app.api.deps import get_current_user
from app.broker.factory import get_broker_adapter
from app.broker.schemas import (
    Position, Order, OrderRequest, OrderResult, BrokerProfile
)
from app.market.service import market_service

router = APIRouter(prefix="/broker", tags=["Broker Integration"])


class ConnectBrokerRequest(BaseModel):
    broker_name: str = Field(..., description="mock_broker or kotak_neo")
    account_name: str = "Trading Account"
    # Kotak Neo specific fields (optional if mock_broker)
    consumer_key: Optional[str] = None
    consumer_secret: Optional[str] = None
    mobile_number: Optional[str] = None
    ucc: Optional[str] = None
    mpin: Optional[str] = None
    totp_secret: Optional[str] = None
    environment: str = "prod"


class BrokerAccountResponse(BaseModel):
    id: int
    broker_name: str
    account_name: str
    is_connected: bool
    last_heartbeat_at: Optional[datetime] = None
    masked_identifier: str
    session_metadata: Dict[str, Any] = {}
    # Credentials are encrypted in DB and NEVER returned in plain text here!


@router.get("/accounts", response_model=List[BrokerAccountResponse])
async def get_accounts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Retrieve all broker accounts belonging to the current user (credentials masked)."""
    stmt = select(BrokerAccount).where(BrokerAccount.user_id == user.id)
    result = await db.execute(stmt)
    accounts = result.scalars().all()

    return [
        BrokerAccountResponse(
            id=acc.id,
            broker_name=acc.broker_name,
            account_name=acc.account_name,
            is_connected=acc.is_connected,
            last_heartbeat_at=acc.last_heartbeat_at,
            masked_identifier=acc.masked_identifier or "N/A",
            session_metadata=acc.session_metadata or {}
        )
        for acc in accounts
    ]


@router.post("/connect", response_model=BrokerAccountResponse)
async def connect_broker(
    req: ConnectBrokerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Connect a broker account (Mock Broker or Kotak Neo).
    Encrypts credentials at rest in PostgreSQL using application Fernet encryption key.
    """
    b_name = req.broker_name.lower().strip()
    if b_name not in ["mock_broker", "kotak_neo"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported broker: '{req.broker_name}'. Currently supported: mock_broker, kotak_neo."
        )

    # Build masked identifier for safe UI display
    if b_name == "mock_broker":
        masked_id = "MOCK-PAPER-" + str(user.id).zfill(3)
        creds = {"environment": "simulation"}
    else:
        # Kotak Neo: validate and encrypt
        if not (req.consumer_key and req.mobile_number and req.ucc and req.mpin):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kotak Neo requires consumer_key, mobile_number, ucc, and mpin."
            )
        masked_id = f"UCC: {mask_secret(req.ucc, 2)} | Mobile: {mask_secret(req.mobile_number, 3)}"
        creds = {
            "consumer_key": req.consumer_key,
            "consumer_secret": req.consumer_secret,
            "mobile_number": req.mobile_number,
            "ucc": req.ucc,
            "mpin": req.mpin,
            "totp_secret": req.totp_secret,
            "environment": req.environment,
        }

    # Instantiate adapter and authenticate
    adapter = get_broker_adapter(b_name, credentials=creds)
    auth_result = await adapter.authenticate(creds)

    if not auth_result.is_authenticated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Broker authentication failed: {auth_result.message}"
        )

    # Check if existing account for this broker exists for this user
    stmt = select(BrokerAccount).where(
        BrokerAccount.user_id == user.id,
        BrokerAccount.broker_name == b_name
    )
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if not account:
        account = BrokerAccount(
            user_id=user.id,
            broker_name=b_name,
            account_name=req.account_name,
            is_active=True,
            is_connected=True,
            last_heartbeat_at=now,
            masked_identifier=masked_id,
            session_metadata=auth_result.session_metadata,
            encrypted_consumer_key=encrypt_credential(req.consumer_key),
            encrypted_consumer_secret=encrypt_credential(req.consumer_secret),
            encrypted_mobile_number=encrypt_credential(req.mobile_number),
            encrypted_ucc=encrypt_credential(req.ucc),
            encrypted_mpin=encrypt_credential(req.mpin),
            encrypted_totp_secret=encrypt_credential(req.totp_secret)
        )
        db.add(account)
    else:
        account.is_connected = True
        account.account_name = req.account_name
        account.last_heartbeat_at = now
        account.masked_identifier = masked_id
        account.session_metadata = auth_result.session_metadata
        if req.consumer_key:
            account.encrypted_consumer_key = encrypt_credential(req.consumer_key)
            account.encrypted_consumer_secret = encrypt_credential(req.consumer_secret)
            account.encrypted_mobile_number = encrypt_credential(req.mobile_number)
            account.encrypted_ucc = encrypt_credential(req.ucc)
            account.encrypted_mpin = encrypt_credential(req.mpin)
            account.encrypted_totp_secret = encrypt_credential(req.totp_secret)

    # Update active market data adapter in MarketDataService
    market_service.set_adapter(adapter)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="BROKER_CONNECTED",
        details={"broker_name": b_name, "masked_identifier": masked_id}
    )
    db.add(audit)
    await db.commit()
    await db.refresh(account)

    return BrokerAccountResponse(
        id=account.id,
        broker_name=account.broker_name,
        account_name=account.account_name,
        is_connected=account.is_connected,
        last_heartbeat_at=account.last_heartbeat_at,
        masked_identifier=account.masked_identifier,
        session_metadata=account.session_metadata
    )


@router.post("/disconnect/{account_id}")
async def disconnect_broker(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Disconnect a broker account."""
    stmt = select(BrokerAccount).where(
        BrokerAccount.id == account_id,
        BrokerAccount.user_id == user.id
    )
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broker account not found")

    account.is_connected = False
    audit = AuditLog(
        user_id=user.id,
        action="BROKER_DISCONNECTED",
        details={"broker_name": account.broker_name, "account_id": account_id}
    )
    db.add(audit)
    await db.commit()

    return {"message": f"Broker {account.broker_name} disconnected"}


@router.get("/heartbeat/{account_id}")
async def check_heartbeat(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Heartbeat check for connected broker adapter."""
    stmt = select(BrokerAccount).where(
        BrokerAccount.id == account_id,
        BrokerAccount.user_id == user.id
    )
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    now = datetime.now(timezone.utc)
    account.last_heartbeat_at = now
    await db.commit()

    return {
        "account_id": account.id,
        "broker_name": account.broker_name,
        "is_connected": account.is_connected,
        "heartbeat_at": now.isoformat()
    }


@router.get("/profile", response_model=BrokerProfile)
async def get_broker_profile(user: User = Depends(get_current_user)):
    """Fetch trading account profile, margin, and funds from active adapter."""
    return await market_service.adapter.get_profile()


@router.get("/positions", response_model=List[Position])
async def get_positions(user: User = Depends(get_current_user)):
    """Fetch today's open and closed positions."""
    return await market_service.adapter.get_positions()


@router.get("/orders", response_model=List[Order])
async def get_orders(user: User = Depends(get_current_user)):
    """Fetch today's orders."""
    return await market_service.adapter.get_orders()


@router.post("/orders", response_model=OrderResult)
async def place_order(
    req: OrderRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Place order through active adapter.
    Enforces financial safety guardrails: Live execution requires TRADING_ENABLED=True.
    """
    result = await market_service.adapter.place_order(req)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="ORDER_SUBMITTED",
        details={
            "symbol": req.symbol,
            "quantity": req.quantity,
            "side": req.transaction_type,
            "success": result.success,
            "status": result.status
        }
    )
    db.add(audit)
    await db.commit()

    return result
