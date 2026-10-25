from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import User, BrokerAccount, AuditLog, UserTradingSettings, Strategy
from app.core.security import get_password_hash, mask_secret
from app.security.encryption import encrypt_secret, mask_identifier
from app.api.deps import get_current_admin

router = APIRouter(prefix="/admin", tags=["Administrator"])


class CreateUserRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "user"  # "admin" or "user"
    configure_broker: Optional[bool] = False
    broker: Optional[str] = "KOTAK_NEO"
    consumer_key: Optional[str] = None
    mobile_number: Optional[str] = None
    ucc: Optional[str] = None
    mpin: Optional[str] = None
    totp: Optional[str] = None


class UpdateUserStatusRequest(BaseModel):
    is_active: bool


class ResetPasswordRequest(BaseModel):
    new_password: str


class BrokerAccountSummary(BaseModel):
    id: int
    broker: str
    broker_name: str
    account_name: str
    status: str
    is_connected: bool
    last_heartbeat_at: Optional[datetime] = None
    masked_identifier: str
    # All secrets are explicitly omitted/masked


class AdminUserItem(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    trading_status: str = "PAPER"
    active_strategies_count: int = 0
    broker_accounts: List[BrokerAccountSummary] = []


class AuditLogItem(BaseModel):
    id: int
    user_id: Optional[int]
    broker_account_id: Optional[int] = None
    action: str
    details: Dict[str, Any]
    created_at: datetime


@router.get("/users", response_model=List[AdminUserItem])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    List all platform users with connected broker summaries.
    NEVER displays plain credentials, secrets, MPINs or tokens.
    """
    stmt = select(User).options(
        selectinload(User.broker_accounts),
        selectinload(User.trading_settings),
        selectinload(User.strategies)
    ).order_by(User.id.asc())
    result = await db.execute(stmt)
    users = result.scalars().all()

    response = []
    for u in users:
        ba_summaries = []
        for ba in u.broker_accounts:
            ba_summaries.append(
                BrokerAccountSummary(
                    id=ba.id,
                    broker=ba.broker,
                    broker_name=ba.broker_name,
                    account_name=ba.account_name,
                    status=ba.status,
                    is_connected=ba.is_connected,
                    last_heartbeat_at=ba.last_heartbeat_at,
                    masked_identifier=ba.masked_identifier or "N/A"
                )
            )
        trading_status = u.trading_settings.trading_mode if u.trading_settings else "PAPER"
        active_strats = len([s for s in u.strategies if s.status in ("READY", "RUNNING")]) if u.strategies else 0

        response.append(
            AdminUserItem(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                is_active=u.is_active,
                created_at=u.created_at,
                trading_status=trading_status,
                active_strategies_count=active_strats,
                broker_accounts=ba_summaries
            )
        )
    return response


@router.post("/users", response_model=AdminUserItem, status_code=status.HTTP_201_CREATED)
async def create_user(
    req: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Administrator creates a user account.
    Supports FLOW A (Admin configures broker credentials on creation)
    and FLOW B (User configures broker from their own account later).
    """
    email_clean = req.email.lower().strip()
    stmt = select(User).where(User.email == email_clean)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{email_clean}' already exists."
        )

    new_user = User(
        email=email_clean,
        hashed_password=get_password_hash(req.password),
        full_name=req.full_name.strip(),
        role=req.role if req.role in ["admin", "user"] else "user",
        is_active=True
    )
    db.add(new_user)
    await db.flush()

    ba_summaries = []
    # FLOW A: Optional broker configuration by admin
    if req.configure_broker and req.consumer_key and req.ucc:
        enc_consumer_key = encrypt_secret(req.consumer_key)
        enc_mobile = encrypt_secret(req.mobile_number) if req.mobile_number else None
        enc_ucc = encrypt_secret(req.ucc)
        enc_mpin = encrypt_secret(req.mpin) if req.mpin else None
        masked_ucc = mask_identifier(req.ucc)
        now = datetime.now(timezone.utc)

        ba = BrokerAccount(
            user_id=new_user.id,
            broker="KOTAK_NEO",
            broker_name="Kotak Neo",
            account_name=f"Kotak Neo ({masked_ucc})",
            status="CONNECTED" if req.totp else "DISCONNECTED",
            masked_identifier=masked_ucc,
            encrypted_consumer_key=enc_consumer_key,
            encrypted_mobile_number=enc_mobile,
            encrypted_ucc=enc_ucc,
            encrypted_mpin=enc_mpin,
            last_authenticated_at=now if req.totp else None,
            last_heartbeat_at=now if req.totp else None,
        )
        db.add(ba)
        await db.flush()

        ba_summaries.append(
            BrokerAccountSummary(
                id=ba.id,
                broker=ba.broker,
                broker_name=ba.broker_name,
                account_name=ba.account_name,
                status=ba.status,
                is_connected=ba.is_connected,
                last_heartbeat_at=ba.last_heartbeat_at,
                masked_identifier=ba.masked_identifier
            )
        )

    # Audit log
    audit = AuditLog(
        user_id=admin.id,
        action="ADMIN_CREATE_USER",
        details={
            "created_user_id": new_user.id,
            "created_email": new_user.email,
            "role": new_user.role,
            "broker_configured": bool(req.configure_broker)
        }
    )
    db.add(audit)
    await db.commit()

    return AdminUserItem(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        is_active=new_user.is_active,
        created_at=new_user.created_at,
        trading_status="PAPER",
        active_strategies_count=0,
        broker_accounts=ba_summaries
    )


@router.patch("/users/{user_id}/status", response_model=AdminUserItem)
async def update_user_status(
    user_id: int,
    req: UpdateUserStatusRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Enable or disable a user account."""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own account."
        )

    stmt = select(User).options(selectinload(User.broker_accounts)).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = req.is_active

    audit = AuditLog(
        user_id=admin.id,
        action="ADMIN_UPDATE_USER_STATUS",
        details={"target_user_id": user_id, "is_active": req.is_active}
    )
    db.add(audit)
    await db.commit()

    return AdminUserItem(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        broker_accounts=[
            BrokerAccountSummary(
                id=ba.id,
                broker_name=ba.broker_name,
                account_name=ba.account_name,
                is_connected=ba.is_connected,
                last_heartbeat_at=ba.last_heartbeat_at,
                masked_identifier=ba.masked_identifier
            ) for ba in user.broker_accounts
        ]
    )


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    req: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Admin resets a user password."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = get_password_hash(req.new_password)
    audit = AuditLog(
        user_id=admin.id,
        action="ADMIN_RESET_PASSWORD",
        details={"target_user_id": user_id, "email": user.email}
    )
    db.add(audit)
    await db.commit()
    return {"success": True, "message": f"Password for {user.email} reset successfully."}


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
async def remove_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Delete a user account and associated resources."""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot delete their own account."
        )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await db.delete(user)

    audit = AuditLog(
        user_id=admin.id,
        action="ADMIN_DELETE_USER",
        details={"deleted_user_id": user_id, "email": user.email}
    )
    db.add(audit)
    await db.commit()

    return {"message": f"User {user.email} removed successfully"}


@router.get("/audit-logs", response_model=List[AuditLogItem])
async def list_audit_logs(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """View platform audit log trail."""
    stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return [
        AuditLogItem(
            id=log.id,
            user_id=log.user_id,
            action=log.action,
            details=log.details,
            created_at=log.created_at
        ) for log in logs
    ]
