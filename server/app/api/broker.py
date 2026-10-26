import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import User, BrokerAccount, AuditLog
from app.security.encryption import encrypt_secret, decrypt_secret, mask_identifier
from app.core.config import settings
from app.api.deps import get_current_user, require_admin
from app.broker.factory import get_broker_adapter, remove_broker_adapter
from app.broker.schemas import (
    Position, Order, OrderRequest, OrderResult, BrokerProfile
)
from app.broker import kotak_neo
from app.market.service import market_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Broker Integration"])


# ------------------------------------------------------------------------------
# Request & Response Schemas
# ------------------------------------------------------------------------------

class ConnectBrokerRequest(BaseModel):
    broker: str = Field(..., description="KOTAK_NEO or MOCK_BROKER")
    account_name: Optional[str] = "Trading Account"
    # Kotak Neo specific credentials
    consumer_key: Optional[str] = None
    mobile_number: Optional[str] = None
    ucc: Optional[str] = None
    mpin: Optional[str] = None
    totp: Optional[str] = None
    totp_secret: Optional[str] = None
    environment: str = "prod"

    # Compatibility alias for broker_name
    broker_name: Optional[str] = None


class ReconnectBrokerRequest(BaseModel):
    totp: Optional[str] = Field(None, description="Current 6-digit TOTP code for 2FA re-verification")


class SanitizedBrokerConnectResponse(BaseModel):
    success: bool
    broker: str
    status: str
    account: Optional[str] = None
    account_id: Optional[int] = None
    connected_at: Optional[str] = None
    last_verified_at: Optional[str] = None
    message: Optional[str] = None


class BrokerAccountResponse(BaseModel):
    id: int
    broker: str
    broker_name: str
    account_name: str
    status: str
    is_connected: bool
    last_authenticated_at: Optional[datetime] = None
    last_heartbeat_at: Optional[datetime] = None
    masked_identifier: str
    session_metadata: Dict[str, Any] = {}


# ------------------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------------------

@router.get("/brokers/accounts", response_model=List[BrokerAccountResponse])
@router.get("/broker/accounts", response_model=List[BrokerAccountResponse])
async def get_accounts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Retrieve all broker accounts belonging to the current user (all secrets masked)."""
    stmt = select(BrokerAccount).where(BrokerAccount.user_id == user.id).order_by(BrokerAccount.id.asc())
    result = await db.execute(stmt)
    accounts = result.scalars().all()

    return [
        BrokerAccountResponse(
            id=acc.id,
            broker=acc.broker,
            broker_name=acc.broker_name,
            account_name=acc.account_name,
            status=acc.status,
            is_connected=acc.is_connected,
            last_authenticated_at=acc.last_authenticated_at,
            last_heartbeat_at=acc.last_heartbeat_at,
            masked_identifier=acc.masked_identifier or "N/A",
            session_metadata=acc.session_metadata or {}
        )
        for acc in accounts
    ]


@router.post("/brokers/connect", response_model=SanitizedBrokerConnectResponse)
@router.post("/broker/connect", response_model=SanitizedBrokerConnectResponse)
async def connect_broker(
    req: ConnectBrokerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Connect a broker account (Kotak Neo or Mock Broker).
    
    Security & Architecture Flow:
    1. React sends credentials over HTTPS to FastAPI (React NEVER calls Kotak directly).
    2. FastAPI validates input format.
    3. Backend performs 2-step Kotak Neo TOTP auth (tradeApiLogin -> tradeApiValidate).
    4. Kotak returns temporary View Tokens, Trading Tokens, SIDs, and Base URL.
    5. Backend stores credentials and session info encrypted at rest in PostgreSQL
       using authenticated AES-256-GCM.
    6. Raw secrets and tokens are NEVER logged, returned in API response, or exposed.
    7. React receives strictly sanitized status info.
    """
    broker_type = (req.broker or req.broker_name or "").strip().upper()

    if broker_type in ("KOTAK_NEO", "KOTAK", "KOTAKNEO"):
        # Resolve TOTP: support either direct 6-digit TOTP code ('totp') or TOTP secret ('totp_secret')
        totp_val = req.totp
        if not totp_val and req.totp_secret:
            secret_clean = req.totp_secret.strip()
            if secret_clean.isdigit() and len(secret_clean) == 6:
                totp_val = secret_clean
            else:
                try:
                    import pyotp
                    totp_val = pyotp.TOTP(secret_clean).now()
                except Exception as e:
                    logger.warning("Could not derive TOTP from totp_secret: %s", e)

        # Validate Kotak Neo credentials
        creds = {
            "consumer_key": req.consumer_key,
            "mobile_number": req.mobile_number,
            "ucc": req.ucc,
            "mpin": req.mpin,
            "totp": totp_val,
            "totp_secret": req.totp_secret,
            "environment": req.environment,
        }

        try:
            kotak_neo.validate_kotak_credentials(creds)
        except ValueError as val_err:
            return SanitizedBrokerConnectResponse(
                success=False,
                broker="KOTAK_NEO",
                status="FAILED",
                message=str(val_err)
            )

        # Record audit log for attempt (without sensitive data)
        audit_attempt = AuditLog(
            user_id=user.id,
            action="BROKER_CONNECT_ATTEMPT",
            details={
                "broker": "KOTAK_NEO",
                "ucc_masked": mask_identifier(req.ucc),
                "environment": req.environment,
            }
        )
        db.add(audit_attempt)
        await db.commit()

        # Step 1 & 2: Authenticate via official Kotak Neo flow
        session = await kotak_neo.login(creds)

        if session.status != "CONNECTED":
            # Record audit log for failure
            audit_fail = AuditLog(
                user_id=user.id,
                action="BROKER_CONNECT_FAILED",
                details={
                    "broker": "KOTAK_NEO",
                    "ucc_masked": mask_identifier(req.ucc),
                    "reason": session.message,
                }
            )
            db.add(audit_fail)
            await db.commit()

            return SanitizedBrokerConnectResponse(
                success=False,
                broker="KOTAK_NEO",
                status="FAILED",
                message=session.message or "Kotak Neo authentication failed. Check your credentials or TOTP and try again."
            )

        # Authentication Succeeded!
        now = datetime.now(timezone.utc)
        masked_ucc = mask_identifier(req.ucc)

        # Find existing account or create new
        stmt = select(BrokerAccount).where(
            BrokerAccount.user_id == user.id,
            BrokerAccount.broker.in_(["KOTAK_NEO", "kotak_neo"])
        )
        result = await db.execute(stmt)
        account = result.scalar_one_or_none()

        # Encrypt all sensitive credentials & session tokens at rest
        enc_consumer_key = encrypt_secret(req.consumer_key)
        enc_mobile = encrypt_secret(req.mobile_number)
        enc_ucc = encrypt_secret(req.ucc)
        enc_mpin = encrypt_secret(req.mpin)
        enc_totp_secret = encrypt_secret(req.totp_secret) if req.totp_secret else None
        enc_view_token = encrypt_secret(session.view_token)
        enc_view_sid = encrypt_secret(session.view_sid)
        enc_trading_token = encrypt_secret(session.trading_token)
        enc_trading_sid = encrypt_secret(session.trading_sid)
        enc_base_url = encrypt_secret(session.base_url)

        if not account:
            account = BrokerAccount(
                user_id=user.id,
                broker="KOTAK_NEO",
                account_name=req.account_name or f"Kotak Neo ({masked_ucc})",
                status="CONNECTED",
                last_authenticated_at=now,
                last_heartbeat_at=now,
                masked_identifier=masked_ucc,
                encrypted_consumer_key=enc_consumer_key,
                encrypted_mobile_number=enc_mobile,
                encrypted_ucc=enc_ucc,
                encrypted_mpin=enc_mpin,
                encrypted_totp_secret=enc_totp_secret,
                encrypted_view_token=enc_view_token,
                encrypted_view_sid=enc_view_sid,
                encrypted_trading_token=enc_trading_token,
                encrypted_trading_sid=enc_trading_sid,
                encrypted_base_url=enc_base_url,
                session_metadata={
                    "data_center": session.data_center,
                    "feed_url": session.feed_url,
                    "environment": req.environment,
                }
            )
            db.add(account)
        else:
            account.status = "CONNECTED"
            account.account_name = req.account_name or account.account_name
            account.last_authenticated_at = now
            account.last_heartbeat_at = now
            account.masked_identifier = masked_ucc
            account.encrypted_consumer_key = enc_consumer_key
            account.encrypted_mobile_number = enc_mobile
            account.encrypted_ucc = enc_ucc
            account.encrypted_mpin = enc_mpin
            if enc_totp_secret:
                account.encrypted_totp_secret = enc_totp_secret
            account.encrypted_view_token = enc_view_token
            account.encrypted_view_sid = enc_view_sid
            account.encrypted_trading_token = enc_trading_token
            account.encrypted_trading_sid = enc_trading_sid
            account.encrypted_base_url = enc_base_url
            account.session_metadata = {
                "data_center": session.data_center,
                "feed_url": session.feed_url,
                "environment": req.environment,
            }

        # Initialize Kotak Neo Adapter with active session
        adapter = get_broker_adapter("kotak_neo", account_id=user.id, credentials=creds)
        if hasattr(adapter, "set_session_tokens"):
            adapter.set_session_tokens(
                session_data={
                    "trading_token": session.trading_token,
                    "trading_sid": session.trading_sid,
                    "view_token": session.view_token,
                    "view_sid": session.view_sid,
                    "base_url": session.base_url,
                    "data_center": session.data_center,
                },
                consumer_key=req.consumer_key,
                ucc=req.ucc,
                environment=req.environment
            )
        market_service.set_adapter(adapter)
        try:
            from app.api.trader import _USER_BROKER_ADAPTERS
            _USER_BROKER_ADAPTERS[user.id] = adapter
        except Exception:
            pass

        # Audit log for success
        audit_success = AuditLog(
            user_id=user.id,
            broker_account_id=account.id if hasattr(account, "id") else None,
            action="BROKER_CONNECT_SUCCESS",
            details={
                "broker": "KOTAK_NEO",
                "ucc_masked": masked_ucc,
                "status": "CONNECTED",
            }
        )
        db.add(audit_success)
        await db.commit()
        await db.refresh(account)

        return SanitizedBrokerConnectResponse(
            success=True,
            broker="KOTAK_NEO",
            status="CONNECTED",
            account=masked_ucc,
            account_id=account.id,
            connected_at=now.isoformat(),
            last_verified_at=now.isoformat(),
            message="Kotak Neo connected and authenticated successfully."
        )

    elif broker_type in ("MOCK_BROKER", "MOCK", "PAPER"):
        return SanitizedBrokerConnectResponse(
            success=False,
            broker="MOCK_BROKER",
            status="FAILED",
            message="Mock paper broker has been removed. Only real brokers (Kotak Neo) are supported."
        )

    elif broker_type in ("UPSTOX", "FYERS", "DHAN", "ZERODHA"):
        return SanitizedBrokerConnectResponse(
            success=False,
            broker=broker_type,
            status="FAILED",
            message=f"Broker {broker_type} adapter is coming soon. Currently supported: KOTAK_NEO."
        )
    else:
        return SanitizedBrokerConnectResponse(
            success=False,
            broker=broker_type,
            status="FAILED",
            message=f"Unsupported broker: '{broker_type}'."
        )


@router.post("/brokers/{broker_account_id}/disconnect")
@router.post("/broker/disconnect/{broker_account_id}")
async def disconnect_broker_account(
    broker_account_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Disconnect a broker account.
    - Invalidates stored session credentials (view token, trading token, SIDs).
    - Marks account status as DISCONNECTED.
    - Evicts and cleans up broker adapter WebSocket connections.
    - Logs audit record.
    """
    stmt = select(BrokerAccount).where(
        BrokerAccount.id == broker_account_id,
        BrokerAccount.user_id == user.id
    )
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Broker account not found."
        )

    # Invalidate session credentials
    account.status = "DISCONNECTED"
    account.encrypted_view_token = None
    account.encrypted_view_sid = None
    account.encrypted_trading_token = None
    account.encrypted_trading_sid = None
    account.last_heartbeat_at = datetime.now(timezone.utc)

    # Evict active adapter and close its WebSocket
    remove_broker_adapter(account.id, account.broker)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        broker_account_id=account.id,
        action="BROKER_DISCONNECT",
        details={
            "broker": account.broker,
            "account_id": account.id,
            "masked_identifier": account.masked_identifier,
        }
    )
    db.add(audit)
    await db.commit()

    return {
        "success": True,
        "broker": account.broker,
        "status": "DISCONNECTED",
        "message": f"Broker account {account.masked_identifier} disconnected successfully."
    }


@router.post("/brokers/{broker_account_id}/reconnect", response_model=SanitizedBrokerConnectResponse)
@router.post("/broker/reconnect/{broker_account_id}")
async def reconnect_broker_account(
    broker_account_id: int,
    req: Optional[ReconnectBrokerRequest] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Reconnect an existing broker account using stored credentials and a fresh TOTP code.
    1. Retrieves encrypted long-lived credentials from PostgreSQL.
    2. Decrypts them strictly in server memory.
    3. Re-executes the Kotak Neo 2-step TOTP login flow.
    4. Updates encrypted session tokens in PostgreSQL.
    5. Returns sanitized connection result.
    """
    stmt = select(BrokerAccount).where(
        BrokerAccount.id == broker_account_id,
        BrokerAccount.user_id == user.id
    )
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Broker account not found."
        )


    # For Kotak Neo: decrypt long-lived credentials in memory
    try:
        consumer_key = decrypt_secret(account.encrypted_consumer_key)
        mobile = decrypt_secret(account.encrypted_mobile_number)
        ucc = decrypt_secret(account.encrypted_ucc)
        mpin = decrypt_secret(account.encrypted_mpin)
        totp_secret = decrypt_secret(account.encrypted_totp_secret) if account.encrypted_totp_secret else None
    except Exception as dec_err:
        logger.error("Failed to decrypt stored broker credentials: %s", type(dec_err).__name__)
        return SanitizedBrokerConnectResponse(
            success=False,
            broker="KOTAK_NEO",
            status="FAILED",
            message="Failed to decrypt stored credentials. Please re-enter your credentials."
        )

    totp_code = req.totp if req and req.totp else None
    if not totp_code and totp_secret:
        import pyotp
        totp_code = pyotp.TOTP(totp_secret).now()

    if not totp_code:
        return SanitizedBrokerConnectResponse(
            success=False,
            broker="KOTAK_NEO",
            status="FAILED",
            message="A fresh 6-digit TOTP code is required to re-authenticate with Kotak Neo."
        )

    creds = {
        "consumer_key": consumer_key,
        "mobile_number": mobile,
        "ucc": ucc,
        "mpin": mpin,
        "totp": totp_code,
        "environment": account.session_metadata.get("environment", "prod"),
    }

    session = await kotak_neo.login(creds)
    if session.status != "CONNECTED":
        audit_fail = AuditLog(
            user_id=user.id,
            broker_account_id=account.id,
            action="BROKER_RECONNECT_FAILED",
            details={
                "broker": "KOTAK_NEO",
                "ucc_masked": account.masked_identifier,
                "reason": session.message,
            }
        )
        db.add(audit_fail)
        await db.commit()

        return SanitizedBrokerConnectResponse(
            success=False,
            broker="KOTAK_NEO",
            status="FAILED",
            message=session.message or "Kotak Neo reconnection failed. Verify your TOTP code."
        )

    # Reconnect succeeded: update encrypted session tokens
    now = datetime.now(timezone.utc)
    account.status = "CONNECTED"
    account.last_authenticated_at = now
    account.last_heartbeat_at = now
    account.encrypted_view_token = encrypt_secret(session.view_token)
    account.encrypted_view_sid = encrypt_secret(session.view_sid)
    account.encrypted_trading_token = encrypt_secret(session.trading_token)
    account.encrypted_trading_sid = encrypt_secret(session.trading_sid)
    account.encrypted_base_url = encrypt_secret(session.base_url)

    adapter = get_broker_adapter("kotak_neo", account_id=user.id, credentials=creds)
    market_service.set_adapter(adapter)

    audit_success = AuditLog(
        user_id=user.id,
        broker_account_id=account.id,
        action="BROKER_RECONNECT_SUCCESS",
        details={
            "broker": "KOTAK_NEO",
            "ucc_masked": account.masked_identifier,
            "status": "CONNECTED",
        }
    )
    db.add(audit_success)
    await db.commit()

    return SanitizedBrokerConnectResponse(
        success=True,
        broker="KOTAK_NEO",
        status="CONNECTED",
        account=account.masked_identifier,
        account_id=account.id,
        connected_at=now.isoformat(),
        last_verified_at=now.isoformat(),
        message="Kotak Neo reconnected successfully."
    )


# ------------------------------------------------------------------------------
# Admin Actions
# ------------------------------------------------------------------------------

@router.post("/admin/brokers/{broker_account_id}/disconnect")
async def admin_disconnect_broker(
    broker_account_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Admin-initiated broker disconnect."""
    stmt = select(BrokerAccount).where(BrokerAccount.id == broker_account_id)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")

    account.status = "DISCONNECTED"
    account.encrypted_view_token = None
    account.encrypted_view_sid = None
    account.encrypted_trading_token = None
    account.encrypted_trading_sid = None
    account.last_heartbeat_at = datetime.now(timezone.utc)

    remove_broker_adapter(account.id, account.broker)

    audit = AuditLog(
        user_id=admin.id,
        broker_account_id=account.id,
        action="ADMIN_BROKER_DISCONNECT",
        details={
            "target_user_id": account.user_id,
            "broker": account.broker,
            "masked_identifier": account.masked_identifier,
        }
    )
    db.add(audit)
    await db.commit()

    return {"success": True, "message": f"Account {account.masked_identifier} disconnected by admin."}


# ------------------------------------------------------------------------------
# Portfolio, Positions, Orders
# ------------------------------------------------------------------------------

@router.get("/brokers/profile", response_model=BrokerProfile)
@router.get("/broker/profile", response_model=BrokerProfile)
async def get_broker_profile(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Fetch trading account profile, live margin, and funds from active broker adapter."""
    # Check if this user has an active connected broker account in DB
    stmt = select(BrokerAccount).where(
        BrokerAccount.user_id == user.id,
        BrokerAccount.is_connected == True
    )
    result = await db.execute(stmt)
    acc = result.scalar_one_or_none()

    adapter = None
    if acc:
        try:
            creds = {
                "consumer_key": decrypt_secret(acc.encrypted_consumer_key) if acc.encrypted_consumer_key else None,
                "mobile_number": decrypt_secret(acc.encrypted_mobile_number) if acc.encrypted_mobile_number else None,
                "ucc": decrypt_secret(acc.encrypted_ucc) if acc.encrypted_ucc else None,
                "mpin": decrypt_secret(acc.encrypted_mpin) if acc.encrypted_mpin else None,
                "totp_secret": decrypt_secret(acc.encrypted_totp_secret) if acc.encrypted_totp_secret else None,
                "environment": (acc.session_metadata or {}).get("environment", "prod"),
            }
            adapter = get_broker_adapter(acc.broker, account_id=user.id, credentials=creds)
        except Exception as e:
            logger.warning("Could not get user adapter for profile: %s", e)

    if not adapter:
        adapter = market_service.adapter

    profile = await adapter.get_profile()

    # Sync fresh margin and timestamp to BrokerAccount record
    if acc:
        meta = dict(acc.session_metadata or {})
        meta["available_margin"] = profile.available_margin
        meta["used_margin"] = profile.used_margin
        meta["collateral"] = profile.collateral
        meta["cash"] = profile.cash
        meta["last_margin_sync"] = datetime.now(timezone.utc).isoformat()
        acc.session_metadata = meta
        await db.commit()

    return profile


@router.get("/brokers/positions", response_model=List[Position])
@router.get("/broker/positions", response_model=List[Position])
async def get_positions(user: User = Depends(get_current_user)):
    """Fetch today's open and closed positions."""
    return await market_service.adapter.get_positions()


@router.get("/brokers/orders", response_model=List[Order])
@router.get("/broker/orders", response_model=List[Order])
async def get_orders(user: User = Depends(get_current_user)):
    """Fetch today's orders."""
    return await market_service.adapter.get_orders()


@router.post("/brokers/orders", response_model=OrderResult)
@router.post("/broker/orders", response_model=OrderResult)
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
