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
from app.api.trader import router as trader_router
from app.api.strategies import router as strategies_router
from app.api.analytics import router as analytics_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("kotak_neo_algo")


from app.core.telemetry import execution_metrics

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: database initialization, telemetry monitoring, and background market service startup."""
    logger.info("Starting %s in %s mode...", settings.APP_NAME, settings.APP_ENV)
    # Initialize database tables and bootstrap admin
    await init_db()
    # Start execution metrics and event loop monitor
    await execution_metrics.start_event_loop_monitor()
    # Start market data background streaming
    await market_service.start()
    yield
    execution_metrics.stop_event_loop_monitor()
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
app.include_router(trader_router, prefix="/api")
app.include_router(strategies_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")


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


@app.get("/")
async def root():
    """Showcase platform information and directory of available API endpoints."""
    return {
        "app_name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "online",
        "environment": settings.APP_ENV,
        "trading_enabled": settings.TRADING_ENABLED,
        "documentation": {
            "swagger_ui": "/docs",
            "redoc": "/redoc",
            "openapi_json": "/openapi.json",
        },
        "endpoints": {
            "health": [
                {
                    "method": "GET",
                    "path": "/health",
                    "description": "System health check and broker connectivity status",
                }
            ],
            "authentication": [
                {
                    "method": "POST",
                    "path": "/api/v1/auth/login",
                    "description": "Authenticate user/admin with email and password",
                },
                {
                    "method": "GET",
                    "path": "/api/v1/auth/me",
                    "description": "Get current authenticated user profile",
                },
            ],
            "admin": [
                {
                    "method": "GET",
                    "path": "/api/v1/admin/users",
                    "description": "List all registered platform users",
                },
                {
                    "method": "POST",
                    "path": "/api/v1/admin/users",
                    "description": "Create a new platform user account",
                },
                {
                    "method": "PATCH",
                    "path": "/api/v1/admin/users/{user_id}/status",
                    "description": "Enable or disable a user account",
                },
                {
                    "method": "GET",
                    "path": "/api/v1/admin/broker-accounts",
                    "description": "Audit all connected broker accounts with masked identifiers",
                },
            ],
            "broker_management": [
                {
                    "method": "GET",
                    "path": "/api/v1/broker/accounts",
                    "description": "List connected broker accounts for current user",
                },
                {
                    "method": "POST",
                    "path": "/api/v1/broker/connect",
                    "description": "Secure 2-step TOTP/MPIN broker connection with AES-256-GCM encryption",
                },
                {
                    "method": "POST",
                    "path": "/api/v1/broker/disconnect",
                    "description": "Disconnect active broker session",
                },
                {
                    "method": "GET",
                    "path": "/api/v1/broker/profile",
                    "description": "Fetch real broker margin balance and profile",
                },
                {
                    "method": "GET",
                    "path": "/api/v1/broker/positions",
                    "description": "Fetch live open positions",
                },
                {
                    "method": "GET",
                    "path": "/api/v1/broker/orders",
                    "description": "Fetch live order book history",
                },
            ],
            "market_data": [
                {
                    "method": "GET",
                    "path": "/api/v1/market/overview",
                    "description": "Overview of major Indian indices (NIFTY 50, BANKNIFTY, SENSEX)",
                },
                {
                    "method": "GET",
                    "path": "/api/v1/market/quotes",
                    "description": "Real-time quotes for tracked symbols",
                },
                {
                    "method": "GET",
                    "path": "/api/v1/market/option-chain",
                    "description": "Normalized option chain data by strike and expiry",
                },
                {
                    "method": "GET",
                    "path": "/api/v1/market/historical",
                    "description": "Historical OHLCV candlestick data",
                },
            ],
            "quantitative_backtesting": [
                {
                    "method": "GET",
                    "path": "/api/v1/backtest/strategies",
                    "description": "List available quantitative strategies and indicator parameters",
                },
                {
                    "method": "POST",
                    "path": "/api/v1/backtest/run",
                    "description": "Execute backtest with configurable lot sizes and statutory friction",
                },
            ],
            "websocket": [
                {
                    "protocol": "WebSocket",
                    "path": "/ws/market",
                    "description": "Real-time live market ticks streaming normalized to React",
                }
            ],
        },
    }


@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Health check endpoint exposing platform, safety, broker, and execution latency telemetry."""
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "trading_enabled": settings.TRADING_ENABLED,
        "active_broker": market_service.adapter.broker_name,
        "is_connected": market_service.adapter.is_connected,
        "telemetry": execution_metrics.get_summary()
    }

