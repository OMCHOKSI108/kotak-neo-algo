import pytest
from app.broker.kotak_adapter import KotakNeoAdapter
from app.broker.schemas import OrderRequest
from app.core.config import settings


@pytest.mark.asyncio
async def test_kotak_adapter_unauthenticated_state():
    adapter = KotakNeoAdapter()
    assert adapter.broker_name == "kotak_neo"
    assert adapter.is_connected is False

    auth_res = await adapter.authenticate({})
    assert auth_res.is_authenticated is False
    assert "incomplete" in auth_res.message.lower()


@pytest.mark.asyncio
async def test_kotak_adapter_trading_enabled_safety_guardrail():
    """
    CRITICAL FINANCIAL RISK SAFETY TEST:
    Ensures that when TRADING_ENABLED=False (default V1 state),
    KotakNeoAdapter strictly rejects any order placement attempt.
    """
    adapter = KotakNeoAdapter()
    req = OrderRequest(
        symbol="RELIANCE",
        exchange="NSE",
        transaction_type="BUY",
        order_type="MARKET",
        product="CNC",
        quantity=10
    )

    # settings.TRADING_ENABLED is False by default
    result = await adapter.place_order(req)
    assert result.success is False
    assert result.status == "REJECTED_SAFETY_CONTROL"
    assert "safety guardrail" in result.message.lower()

    mod_res = await adapter.modify_order("ORD_123", quantity=20)
    assert mod_res.success is False
    assert mod_res.status == "REJECTED_SAFETY_CONTROL"

    cancel_res = await adapter.cancel_order("ORD_123")
    assert cancel_res.success is False
    assert cancel_res.status == "REJECTED_SAFETY_CONTROL"
