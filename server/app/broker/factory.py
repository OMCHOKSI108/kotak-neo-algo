import logging
from typing import Optional, Dict, Any
from app.broker.base import BrokerAdapter
from app.broker.mock_adapter import MockBrokerAdapter
from app.broker.kotak_adapter import KotakNeoAdapter

logger = logging.getLogger(__name__)

# Cache of active adapters keyed by account_id / user_id
_adapters: Dict[str, BrokerAdapter] = {}


def get_broker_adapter(
    broker_name: str,
    account_id: Optional[int] = None,
    credentials: Optional[Dict[str, Any]] = None
) -> BrokerAdapter:
    """
    Factory to retrieve or instantiate a broker adapter.
    Normalizes broker names (e.g. 'KOTAK_NEO' or 'kotak_neo', 'MOCK_BROKER' or 'mock_broker').
    Extensible to future brokers: Upstox, FYERS, Dhan, Zerodha.
    """
    normalized = broker_name.strip().upper()
    cache_key = f"{normalized}:{account_id or 'default'}"
    if cache_key in _adapters:
        return _adapters[cache_key]

    if normalized in ("KOTAK_NEO", "KOTAK", "KOTAKNEO"):
        adapter = KotakNeoAdapter(credentials=credentials)
    elif normalized in ("MOCK_BROKER", "MOCK", "PAPER"):
        raise ValueError("Mock broker has been disabled. Only real brokers (Kotak Neo) are supported.")
    elif normalized in ("UPSTOX", "FYERS", "DHAN", "ZERODHA"):
        # Architecture is ready for future brokers
        raise NotImplementedError(f"Broker '{broker_name}' adapter is coming soon. Currently supported: KOTAK_NEO.")
    else:
        logger.info("Initializing KotakNeoAdapter for '%s'.", broker_name)
        adapter = KotakNeoAdapter(credentials=credentials)

    _adapters[cache_key] = adapter
    return adapter


def remove_broker_adapter(account_id: int, broker_name: Optional[str] = None) -> None:
    """Evict an adapter from the cache (e.g. on disconnect)."""
    keys_to_remove = [k for k in _adapters if f":{account_id}" in k]
    for k in keys_to_remove:
        adapter = _adapters.pop(k, None)
        if adapter and hasattr(adapter, "disconnect"):
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(adapter.disconnect())
            except Exception:
                pass
