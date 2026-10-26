from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings

# Configure high-throughput asyncpg connection pool for PostgreSQL
is_postgres = "postgres" in settings.DATABASE_URL.lower()
engine_kwargs = {
    "echo": False,
    "future": True,
    "pool_pre_ping": True,
}
if is_postgres:
    engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 10,
        "pool_timeout": 30,
        "pool_recycle": 1800
    })

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency that provides an async database session.
    Optimized to only execute commit when writes/mutations occurred,
    eliminating redundant database round-trips for read-only routes.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            if session.is_active and (session.dirty or session.new or session.deleted):
                await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
