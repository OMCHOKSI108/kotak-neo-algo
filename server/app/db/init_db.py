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
        # Check if SuperAdmin / Admin user exists
        stmt = select(User).where((User.email == settings.ADMIN_EMAIL) | (User.role.in_(["superadmin", "admin"])))
        result = await session.execute(stmt)
        admin_user = result.scalars().first()

        if not admin_user:
            logger.info("Creating default SuperAdmin account: %s", settings.ADMIN_EMAIL)
            admin_user = User(
                email=settings.ADMIN_EMAIL,
                hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                full_name=settings.ADMIN_NAME,
                role="superadmin",
                is_active=True
            )
            session.add(admin_user)
            await session.flush()

            # Audit log
            audit = AuditLog(
                user_id=admin_user.id,
                action="SYSTEM_BOOTSTRAP",
                details={"message": "Database initialized, SuperAdmin account seeded."}
            )
            session.add(audit)

            await session.commit()
            logger.info("Default SuperAdmin successfully created.")
        else:
            if admin_user.role != "superadmin" and admin_user.email == settings.ADMIN_EMAIL:
                admin_user.role = "superadmin"
                await session.commit()
                logger.info("Updated %s to role 'superadmin'.", settings.ADMIN_EMAIL)
            else:
                logger.info("SuperAdmin account '%s' is active with role '%s'.", admin_user.email, admin_user.role)
