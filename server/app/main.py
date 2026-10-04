import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.init_db import init_db
from app.market.service import market_service
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.broker import router as broker_router
from app.api.market import router as market_router
from app.api.backtest import router as backtest_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("kotak_neo_algo")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: database initialization and background market service startup."""
    logger.info("Starting %s in %s mode...", settings.APP_NAME, settings.APP_ENV)
    # Initialize database tables and bootstrap admin
    await init_db()
    # Start market data background streaming
    await market_service.start()
    yield
    logger.info("Shutting down %s...", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Indian Algo Trading & Research Platform with Broker-Adapter Architecture",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(broker_router, prefix="/api")
app.include_router(market_router, prefix="/api")
app.include_router(backtest_router, prefix="/api")


# Also mount direct /ws/market endpoint so React can connect to ws://localhost:8000/ws/market
@app.websocket("/ws/market")
async def root_market_websocket(websocket: WebSocket):
    await market_service.register_client(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except Exception:
        await market_service.unregister_client(websocket)


@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Health check endpoint exposing platform and safety status."""
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "trading_enabled": settings.TRADING_ENABLED,
        "active_broker": market_service.adapter.broker_name,
        "is_connected": market_service.adapter.is_connected
    }
