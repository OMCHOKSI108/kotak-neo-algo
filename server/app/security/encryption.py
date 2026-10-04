import os
import base64
import logging
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.fernet import Fernet
from app.core.config import settings

logger = logging.getLogger(__name__)

# Key version prefix for authenticated encryption
CURRENT_KEY_VERSION = "v1"


def _get_encryption_key_bytes() -> bytes:
    """
    Derive a 256-bit (32 bytes) binary key for AES-256-GCM.
    Uses BROKER_ENCRYPTION_KEY if configured in settings; otherwise derives
    deterministically from ENCRYPTION_KEY or JWT_SECRET_KEY.
    """
    key_str = getattr(settings, "BROKER_ENCRYPTION_KEY", None) or settings.ENCRYPTION_KEY
    if not key_str:
        key_str = settings.JWT_SECRET_KEY

    # Check if key is hex-encoded 64 characters (32 bytes)
    try:
        if len(key_str) == 64:
            return bytes.fromhex(key_str)
    except Exception:
        pass

    # Check if key is base64-encoded 32 bytes
    try:
        decoded = base64.b64decode(key_str)
        if len(decoded) == 32:
            return decoded
    except Exception:
        pass

    # Deterministically hash to 32 bytes using SHA-256
    import hashlib
    return hashlib.sha256(key_str.encode("utf-8")).digest()


def encrypt_secret(value: Optional[str]) -> Optional[str]:
    """
    Encrypt a sensitive string at rest using authenticated AES-256-GCM with key versioning.
    Format: v1:<base64(12_byte_nonce + ciphertext_with_tag)>
    
    Security properties:
    - Authenticated encryption (ciphertext integrity and confidentiality guaranteed).
    - Randomized 96-bit nonce generated uniquely per encryption.
    - Key version prefix allows zero-downtime key rotation.
    - Plaintext is never logged or exposed.
    """
    if value is None or value == "":
        return None

    try:
        key = _get_encryption_key_bytes()
        aesgcm = AESGCM(key)
        # 96-bit nonce (12 bytes) recommended by NIST for AES-GCM
        nonce = os.urandom(12)
        plaintext_bytes = value.encode("utf-8")
        ciphertext = aesgcm.encrypt(nonce, plaintext_bytes, None)
        
        # Combine nonce + ciphertext
        payload = nonce + ciphertext
        encoded = base64.urlsafe_b64encode(payload).decode("ascii")
        return f"{CURRENT_KEY_VERSION}:{encoded}"
    except Exception as e:
        logger.error("Error during authenticated secret encryption: %s", type(e).__name__)
        raise RuntimeError("Secret encryption failed") from None


def decrypt_secret(encrypted_value: Optional[str]) -> Optional[str]:
    """
    Decrypt an authenticated ciphertext string at rest.
    Supports key versioning and backward compatibility with Fernet ciphertexts.
    """
    if encrypted_value is None or encrypted_value == "":
        return None

    # Handle v1 AES-256-GCM format
    if encrypted_value.startswith("v1:"):
        try:
            key = _get_encryption_key_bytes()
            aesgcm = AESGCM(key)
            payload_str = encrypted_value[3:]
            payload = base64.urlsafe_b64decode(payload_str.encode("ascii"))
            nonce = payload[:12]
            ciphertext = payload[12:]
            decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
            return decrypted_bytes.decode("utf-8")
        except Exception as e:
            logger.error("Error during authenticated secret decryption: %s", type(e).__name__)
            raise RuntimeError("Secret decryption failed") from None

    # Backward compatibility fallback: Try Fernet decryption for existing v0 tokens
    try:
        fernet = Fernet(settings.ENCRYPTION_KEY.encode())
        return fernet.decrypt(encrypted_value.encode()).decode()
    except Exception:
        logger.error("Failed to decrypt ciphertext using both AES-GCM and legacy cipher.")
        raise RuntimeError("Secret decryption failed") from None


def mask_identifier(val: Optional[str], visible_suffix_len: int = 3) -> str:
    """
    Mask sensitive identifier for safe UI display (e.g. '*****123').
    Never displays full strings.
    """
    if not val:
        return "Not Configured"
    clean = str(val).strip()
    if len(clean) <= visible_suffix_len:
        return "*****"
    return f"*****{clean[-visible_suffix_len:]}"
