from typing import Optional, Dict, Any
from app.broker.base import BrokerAdapter
from app.broker.mock_adapter import MockBrokerAdapter
from app.broker.kotak_adapter import KotakNeoAdapter

# Cache of active adapters keyed by account_id / user_id
_adapters: Dict[str, BrokerAdapter] = {}


def get_broker_adapter(
    broker_name: str,
    account_id: Optional[int] = None,
    credentials: Optional[Dict[str, Any]] = None
) -> BrokerAdapter:
    """
    Factory to retrieve or instantiate a broker adapter.
    Supports 'mock_broker' and 'kotak_neo', and extensible to 'upstox', 'fyers', etc.
    """
    cache_key = f"{broker_name}:{account_id or 'default'}"
    if cache_key in _adapters:
        return _adapters[cache_key]

    if broker_name == "kotak_neo":
        adapter = KotakNeoAdapter(credentials=credentials)
    elif broker_name == "mock_broker":
        adapter = MockBrokerAdapter()
    else:
        # Fallback to mock broker for safety
        adapter = MockBrokerAdapter()

    _adapters[cache_key] = adapter
    return adapter
