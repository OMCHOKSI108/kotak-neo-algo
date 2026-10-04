import re
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import httpx
from pydantic import BaseModel, Field

from app.security.encryption import mask_identifier

logger = logging.getLogger(__name__)

# Official Kotak Neo Auth URLs
KOTAK_LOGIN_URL_PROD = "https://mis.kotaksecurities.com/login/1.0/tradeApiLogin"
KOTAK_VALIDATE_URL_PROD = "https://mis.kotaksecurities.com/login/1.0/tradeApiValidate"

KOTAK_LOGIN_URL_UAT = "https://d-mis.kotaksecurities.com/login/1.0/tradeApiLogin"
KOTAK_VALIDATE_URL_UAT = "https://d-mis.kotaksecurities.com/login/1.0/tradeApiValidate"

NEO_FIN_KEY = "neotradeapi"


class BrokerSession(BaseModel):
    """
    Internal model representing a sanitized Kotak Neo broker session.
    Never exposes plain secrets or tokens in standard dict representations.
    """
    broker: str = "KOTAK_NEO"
    status: str = "CONNECTED"  # CONNECTED, FAILED, DISCONNECTED
    account_identifier: str = ""
    trading_session_available: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    message: Optional[str] = None

    # Internal session credentials stored privately for backend DB encryption only
    # Not exposed through to_sanitized_dict() or json() serialization
    view_token: Optional[str] = Field(default=None, exclude=True)
    view_sid: Optional[str] = Field(default=None, exclude=True)
    trading_token: Optional[str] = Field(default=None, exclude=True)
    trading_sid: Optional[str] = Field(default=None, exclude=True)
    base_url: Optional[str] = Field(default=None, exclude=True)
    feed_url: Optional[str] = Field(default=None, exclude=True)
    data_center: Optional[str] = Field(default=None, exclude=True)

    def to_sanitized_dict(self) -> Dict[str, Any]:
        """Return strictly sanitized session information for API responses."""
        return {
            "broker": self.broker,
            "status": self.status,
            "account_identifier": self.account_identifier,
            "trading_session_available": self.trading_session_available,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "message": self.message,
        }


def validate_kotak_credentials(credentials: Dict[str, Any]) -> None:
    """Validate format and presence of Kotak Neo credentials."""
    consumer_key = credentials.get("consumer_key", "").strip()
    mobile = credentials.get("mobile_number", "").strip()
    ucc = credentials.get("ucc", "").strip()
    mpin = credentials.get("mpin", "").strip()
    totp = str(credentials.get("totp", "")).strip()

    if not consumer_key:
        raise ValueError("Consumer Key / Access Token is required.")
    if not mobile:
        raise ValueError("Mobile number is required.")
    if not ucc:
        raise ValueError("UCC (Client Code) is required.")
    if not mpin or len(mpin) < 4:
        raise ValueError("Valid MPIN is required (at least 4-6 digits).")
    if not totp:
        raise ValueError("Current 6-digit TOTP is required.")
    if not re.match(r"^\d{6}$", totp):
        raise ValueError("TOTP must be exactly 6 digits.")


async def login(credentials: Dict[str, Any]) -> BrokerSession:
    """
    Perform official 2-step Kotak Neo TOTP authentication:
    Step 1: POST tradeApiLogin (with Consumer Key, Mobile, UCC, TOTP) -> View Token & View SID
    Step 2: POST tradeApiValidate (with MPIN, View Token, View SID, Consumer Key) -> Trading Token, Trading SID, Base URL

    Returns a BrokerSession. On authentication failure, returns a BrokerSession with status='FAILED'
    and a safe, sanitized message.
    """
    validate_kotak_credentials(credentials)

    consumer_key = credentials["consumer_key"].strip()
    mobile = credentials["mobile_number"].strip()
    ucc = credentials["ucc"].strip().upper()
    mpin = credentials["mpin"].strip()
    totp = str(credentials["totp"]).strip()
    env = credentials.get("environment", "prod").lower()

    login_url = KOTAK_LOGIN_URL_PROD if env == "prod" else KOTAK_LOGIN_URL_UAT
    validate_url = KOTAK_VALIDATE_URL_PROD if env == "prod" else KOTAK_VALIDATE_URL_UAT

    masked_acc = mask_identifier(ucc)

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Step 1: TOTP Login
        step1_headers = {
            "Authorization": consumer_key,
            "neo-fin-key": NEO_FIN_KEY,
            "Content-Type": "application/json",
        }
        step1_body = {
            "mobileNumber": mobile,
            "ucc": ucc,
            "totp": totp,
        }

        try:
            resp1 = await client.post(login_url, headers=step1_headers, json=step1_body)
        except Exception as net_err:
            logger.error("Network error during Kotak Neo step 1 TOTP login: %s", type(net_err).__name__)
            return BrokerSession(
                broker="KOTAK_NEO",
                status="FAILED",
                account_identifier=masked_acc,
                trading_session_available=False,
                message="Unable to reach Kotak Neo authentication service. Check internet connection.",
            )

        try:
            data1 = resp1.json()
        except Exception:
            logger.error("Non-JSON response received from Kotak Neo step 1: HTTP %d", resp1.status_code)
            return BrokerSession(
                broker="KOTAK_NEO",
                status="FAILED",
                account_identifier=masked_acc,
                trading_session_available=False,
                message="Kotak Neo service returned an invalid response format.",
            )

        payload1 = data1.get("data") if isinstance(data1, dict) else None
        if resp1.status_code not in range(200, 300) or not isinstance(payload1, dict):
            error_msg = data1.get("message") or data1.get("Error") or "Invalid credentials or TOTP expired."
            logger.warning("Kotak Neo Step 1 TOTP failed with HTTP %d", resp1.status_code)
            return BrokerSession(
                broker="KOTAK_NEO",
                status="FAILED",
                account_identifier=masked_acc,
                trading_session_available=False,
                message=f"Kotak Neo TOTP login failed: {error_msg}",
            )

        view_token = payload1.get("token")
        view_sid = payload1.get("sid")

        if not view_token or not view_sid:
            logger.warning("Kotak Neo Step 1 did not return view token or sid")
            return BrokerSession(
                broker="KOTAK_NEO",
                status="FAILED",
                account_identifier=masked_acc,
                trading_session_available=False,
                message="Kotak Neo authentication failed: View session tokens missing.",
            )

        # Step 2: MPIN Validate
        step2_headers = {
            "Authorization": consumer_key,
            "sid": view_sid,
            "Auth": view_token,
            "neo-fin-key": NEO_FIN_KEY,
            "Content-Type": "application/json",
        }
        step2_body = {
            "mpin": mpin,
        }

        try:
            resp2 = await client.post(validate_url, headers=step2_headers, json=step2_body)
        except Exception as net_err:
            logger.error("Network error during Kotak Neo step 2 MPIN validate: %s", type(net_err).__name__)
            return BrokerSession(
                broker="KOTAK_NEO",
                status="FAILED",
                account_identifier=masked_acc,
                trading_session_available=False,
                message="Failed connecting to Kotak MPIN validation service.",
            )

        try:
            data2 = resp2.json()
        except Exception:
            logger.error("Non-JSON response received from Kotak Neo step 2: HTTP %d", resp2.status_code)
            return BrokerSession(
                broker="KOTAK_NEO",
                status="FAILED",
                account_identifier=masked_acc,
                trading_session_available=False,
                message="Kotak Neo validation returned an unexpected response.",
            )

        payload2 = data2.get("data") if isinstance(data2, dict) else None
        if resp2.status_code not in range(200, 300) or not isinstance(payload2, dict):
            error_msg = data2.get("message") or data2.get("Error") or "MPIN validation failed."
            logger.warning("Kotak Neo Step 2 MPIN validation failed with HTTP %d", resp2.status_code)
            return BrokerSession(
                broker="KOTAK_NEO",
                status="FAILED",
                account_identifier=masked_acc,
                trading_session_available=False,
                message=f"Kotak Neo MPIN validation failed: {error_msg}",
            )

        trading_token = payload2.get("token")
        trading_sid = payload2.get("sid")
        base_url = payload2.get("baseUrl")
        feed_url = payload2.get("feedUrl")
        data_center = payload2.get("dataCenter")

        logger.info("Kotak Neo 2-step authentication succeeded for account %s", masked_acc)

        return BrokerSession(
            broker="KOTAK_NEO",
            status="CONNECTED",
            account_identifier=masked_acc,
            trading_session_available=bool(trading_token),
            created_at=datetime.now(timezone.utc),
            message="Successfully authenticated with Kotak Neo.",
            view_token=view_token,
            view_sid=view_sid,
            trading_token=trading_token,
            trading_sid=trading_sid,
            base_url=base_url,
            feed_url=feed_url,
            data_center=data_center,
        )
