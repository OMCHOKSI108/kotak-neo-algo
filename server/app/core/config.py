from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# Determine project root directory (where .env lives)
SERVER_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = SERVER_DIR.parent
ENV_PATH = ROOT_DIR / ".env" if (ROOT_DIR / ".env").exists() else SERVER_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = "Indian Algo Trading & Research Platform"
    APP_ENV: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Safety Guardrails
    TRADING_ENABLED: bool = False

    # Security & Encryption
    ENCRYPTION_KEY: str = Field(
        default="iAMArUJ66YJA_9C0HsIN-otQbfaJkHCwNi8lmxsMUSw=",
        description="Legacy Fernet symmetric key for encrypting credentials at rest"
    )
    BROKER_ENCRYPTION_KEY: Optional[str] = Field(
        default="3d115d4341000b58bd19a63509aa4235d548e3f092e205660847c961f52163da",
        description="256-bit key for authenticated AES-256-GCM broker credential encryption"
    )
    JWT_SECRET_KEY: str = "algo_platform_super_secret_jwt_key_2026_change_in_prod"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5435/algo_trading"

    # Admin bootstrap
    ADMIN_EMAIL: str = "omchoksi99@gmail.com"
    ADMIN_PASSWORD: str = "OMchoksi"
    ADMIN_NAME: str = "Om Choksi"

    # Kotak Neo Broker Credentials
    KOTAK_CONSUMER_KEY: Optional[str] = None
    KOTAK_CONSUMER_SECRET: Optional[str] = None
    KOTAK_MOBILE_NUMBER: Optional[str] = None
    KOTAK_UCC: Optional[str] = None
    KOTAK_MPIN: Optional[str] = None
    KOTAK_TOTP_SECRET: Optional[str] = None
    KOTAK_ENVIRONMENT: str = "prod"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]


settings = Settings()
