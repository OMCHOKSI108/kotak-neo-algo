import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import select

from app.main import app
from app.db.session import get_db
from app.models.models import Base, User, BrokerAccount
from app.core.config import settings
from app.core.security import get_password_hash, create_access_token

# NullPool prevents asyncpg connections from being held in pool across event loops
test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool, echo=False)
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await test_engine.dispose()


@pytest_asyncio.fixture
async def client():
    async def override_get_db():
        async with TestSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_token() -> str:
    async with TestSessionLocal() as session:
        stmt = select(User).where(User.email == "test_admin@kotakneoalgo.local")
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            user = User(
                email="test_admin@kotakneoalgo.local",
                hashed_password=get_password_hash("AdminPass123!"),
                full_name="Test Administrator",
                role="admin",
                is_active=True
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

        return create_access_token({"sub": str(user.id), "email": user.email, "role": "admin"})


@pytest_asyncio.fixture
async def user_token() -> str:
    async with TestSessionLocal() as session:
        stmt = select(User).where(User.email == "test_trader@kotakneoalgo.local")
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            user = User(
                email="test_trader@kotakneoalgo.local",
                hashed_password=get_password_hash("TraderPass123!"),
                full_name="Test Trader",
                role="user",
                is_active=True
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

        return create_access_token({"sub": str(user.id), "email": user.email, "role": "user"})


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session
