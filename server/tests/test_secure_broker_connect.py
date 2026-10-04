import pytest
from httpx import AsyncClient
from app.security.encryption import encrypt_secret, decrypt_secret, mask_identifier
from app.broker.kotak_neo import validate_kotak_credentials, BrokerSession


def test_authenticated_aes_gcm_encryption_with_key_versioning():
    secret_text = "kotak-consumer-key-9988-secret-mpin-4321"
    encrypted = encrypt_secret(secret_text)
    
    assert encrypted is not None
    assert encrypted != secret_text
    assert encrypted.startswith("v1:")
    
    # Decrypt and verify
    decrypted = decrypt_secret(encrypted)
    assert decrypted == secret_text


def test_tampered_ciphertext_detection():
    secret_text = "test-secret-value"
    encrypted = encrypt_secret(secret_text)
    
    # Tamper with the ciphertext payload
    tampered = encrypted[:-4] + "AAAA"
    with pytest.raises(RuntimeError):
        decrypt_secret(tampered)


def test_mask_identifier():
    assert mask_identifier("AB123") == "*****123"
    assert mask_identifier("UCC987654") == "*****654"
    assert mask_identifier("12") == "*****"
    assert mask_identifier("") == "Not Configured"
    assert mask_identifier(None) == "Not Configured"


def test_kotak_credentials_validation():
    # Valid credentials
    valid_creds = {
        "consumer_key": "valid-consumer-token",
        "mobile_number": "+919876543210",
        "ucc": "AB123",
        "mpin": "123456",
        "totp": "654321"
    }
    # Should not raise
    validate_kotak_credentials(valid_creds)

    # Invalid TOTP (not 6 digits)
    with pytest.raises(ValueError, match="TOTP must be exactly 6 digits"):
        validate_kotak_credentials({**valid_creds, "totp": "123"})

    # Missing MPIN
    with pytest.raises(ValueError, match="Valid MPIN is required"):
        validate_kotak_credentials({**valid_creds, "mpin": ""})


def test_broker_session_zero_leakage():
    session = BrokerSession(
        broker="KOTAK_NEO",
        status="CONNECTED",
        account_identifier="*****123",
        trading_session_available=True,
        view_token="super-secret-view-token-1234",
        view_sid="secret-view-sid-5678",
        trading_token="super-secret-trading-token-9999",
        trading_sid="secret-trading-sid-0000",
        base_url="https://mis.kotaksecurities.com"
    )

    sanitized = session.to_sanitized_dict()
    assert "super-secret" not in str(sanitized)
    assert "view_token" not in sanitized
    assert "trading_token" not in sanitized
    assert sanitized["account_identifier"] == "*****123"
    assert sanitized["status"] == "CONNECTED"


@pytest.mark.asyncio
async def test_connect_mock_broker_rejected(client: AsyncClient, user_token: str):
    # Connect Mock Broker via /api/brokers/connect must be rejected
    resp = await client.post(
        "/api/brokers/connect",
        json={"broker": "MOCK_BROKER", "account_name": "Test Simulation"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert data["broker"] == "MOCK_BROKER"
    assert data["status"] == "FAILED"
    assert "Mock paper broker has been removed" in data["message"]


@pytest.mark.asyncio
async def test_connect_kotak_neo_validation_failure(client: AsyncClient, user_token: str):
    # Attempting to connect Kotak Neo with invalid 3-digit TOTP
    resp = await client.post(
        "/api/brokers/connect",
        json={
            "broker": "KOTAK_NEO",
            "consumer_key": "some-key",
            "mobile_number": "+919876543210",
            "ucc": "AB123",
            "mpin": "123456",
            "totp": "123"  # invalid TOTP
        },
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert data["status"] == "FAILED"
    assert "TOTP must be exactly 6 digits" in data["message"]
