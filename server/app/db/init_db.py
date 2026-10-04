import logging
from sqlalchemy import select
from app.db.session import engine, AsyncSessionLocal
from app.models.models import Base, User, BrokerAccount, AuditLog
from app.core.config import settings
from app.core.security import get_password_hash, encrypt_credential

logger = logging.getLogger(__name__)


async def init_db():
    """Initialize database tables and seed bootstrap administrator account."""
    logger.info("Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Check if Admin user exists
        stmt = select(User).where(User.email == settings.ADMIN_EMAIL)
        result = await session.execute(stmt)
        admin_user = result.scalar_one_or_none()

        if not admin_user:
            logger.info("Creating default administrator account: %s", settings.ADMIN_EMAIL)
            admin_user = User(
                email=settings.ADMIN_EMAIL,
                hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                full_name=settings.ADMIN_NAME,
                role="admin",
                is_active=True
            )
            session.add(admin_user)
            await session.flush()

            # Create default Mock Broker account for immediate testing
            mock_account = BrokerAccount(
                user_id=admin_user.id,
                broker="MOCK_BROKER",
                account_name="Paper / Simulated Broker",
                status="CONNECTED",
                masked_identifier="MOCK-PAPER-001",
                session_metadata={"status": "connected", "type": "simulator"}
            )
            session.add(mock_account)

            # Audit log
            audit = AuditLog(
                user_id=admin_user.id,
                action="SYSTEM_BOOTSTRAP",
                details={"message": "Database initialized, admin account & mock broker seeded."}
            )
            session.add(audit)

            await session.commit()
            logger.info("Default administrator and mock broker successfully created.")
        else:
            logger.info("Administrator account already exists.")
