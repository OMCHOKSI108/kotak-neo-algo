import base64
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict
import bcrypt
from cryptography.fernet import Fernet
from jose import jwt, JWTError

from app.core.config import settings

# Initialize Fernet cipher with ENCRYPTION_KEY
_fernet: Optional[Fernet] = None


def get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = settings.ENCRYPTION_KEY.encode()
        _fernet = Fernet(key)
    return _fernet


from app.security.encryption import encrypt_secret, decrypt_secret, mask_identifier


def encrypt_credential(plain_text: Optional[str]) -> Optional[str]:
    """Encrypt sensitive broker secret string at rest using authenticated AES-256-GCM."""
    return encrypt_secret(plain_text)


def decrypt_credential(cipher_text: Optional[str]) -> Optional[str]:
    """Decrypt sensitive broker secret string."""
    try:
        return decrypt_secret(cipher_text)
    except Exception:
        return None


def mask_secret(value: Optional[str], visible_chars: int = 4) -> str:
    """
    Mask sensitive secrets (API keys, MPIN, tokens, secrets) for safe display in UI.
    NEVER display raw secrets to users or administrators.
    Example: '1234567890' -> '••••••7890'
    """
    if not value:
        return ""
    val_str = str(value)
    if len(val_str) <= visible_chars:
        return "•" * len(val_str)
    masked_part = "•" * (len(val_str) - visible_chars)
    return masked_part + val_str[-visible_chars:]


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )


def get_password_hash(password: str) -> str:
    """Hash password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT access token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
