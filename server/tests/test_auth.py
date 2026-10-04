import pytest
from httpx import AsyncClient
from app.core.security import (
    verify_password, get_password_hash, create_access_token, decode_access_token,
    encrypt_credential, decrypt_credential, mask_secret
)


def test_password_hashing():
    pwd = "MySecretTradingPassword#2026"
    hashed = get_password_hash(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_creation_and_decoding():
    data = {"sub": "42", "email": "trader@market.in", "role": "user"}
    token = create_access_token(data)
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "42"
    assert decoded["email"] == "trader@market.in"
    assert decoded["role"] == "user"


def test_credential_encryption_at_rest():
    secret_key = "KOTAK_API_CONSUMER_SECRET_xyz987"
    encrypted = encrypt_credential(secret_key)
    assert encrypted != secret_key
    decrypted = decrypt_credential(encrypted)
    assert decrypted == secret_key


def test_secret_masking():
    assert mask_secret("1234567890", 4) == "••••••7890"
    assert mask_secret("SECRET", 2) == "••••ET"
    assert mask_secret("123", 4) == "•••"
    assert mask_secret(None) == ""


@pytest.mark.asyncio
async def test_auth_login_success_and_failure(client: AsyncClient):
    # Test failure on non-existent user
    resp = await client.post("/api/auth/login", json={"email": "nonexistent@user.com", "password": "any"})
    assert resp.status_code == 401

    # Test login with seeded admin
    resp = await client.post("/api/auth/login", json={
        "email": "admin@kotakneoalgo.local",
        "password": "AdminPassword@2026!"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "admin@kotakneoalgo.local"
    assert data["user"]["role"] == "admin"
