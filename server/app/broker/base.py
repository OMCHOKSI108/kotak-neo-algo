from abc import ABC, abstractmethod
from typing import List, Optional, Callable, Dict, Any
from app.broker.schemas import (
    Quote, OptionChain, BrokerAuthResult, BrokerProfile,
    Position, Order, OrderRequest, OrderResult
)


class BrokerAdapter(ABC):
    """
    Abstract interface for broker integrations.
    Every broker (Kotak Neo, Mock, Upstox, FYERS) must implement this interface.
    The core platform services and UI communicate exclusively through this contract.
    """

    @property
    @abstractmethod
    def broker_name(self) -> str:
        """Name of the broker, e.g. 'mock_broker' or 'kotak_neo'."""
        pass

    @property
    @abstractmethod
    def is_connected(self) -> bool:
        """Return True if adapter has a valid active session."""
        pass

    @abstractmethod
    async def authenticate(self, credentials: Dict[str, Any]) -> BrokerAuthResult:
        """Authenticate with the broker using credentials."""
        pass

    @abstractmethod
    async def get_profile(self) -> BrokerProfile:
        """Fetch user profile, account details, and funds/margins."""
        pass

    @abstractmethod
    async def get_quotes(self, symbols: List[str]) -> List[Quote]:
        """Fetch latest quotes for requested symbols."""
        pass

    @abstractmethod
    async def get_expiries(self, underlying: str) -> List[str]:
        """Fetch available expiry dates for an underlying instrument."""
        pass

    @abstractmethod
    async def get_option_chain(self, underlying: str, expiry: Optional[str] = None) -> OptionChain:
        """Fetch normalized option chain for underlying index/stock."""
        pass

    @abstractmethod
    async def get_positions(self) -> List[Position]:
        """Fetch current open/closed positions."""
        pass

    @abstractmethod
    async def get_orders(self) -> List[Order]:
        """Fetch today's order book."""
        pass

    @abstractmethod
    async def place_order(self, order_req: OrderRequest) -> OrderResult:
        """
        Place an order. Must strictly enforce the TRADING_ENABLED safety check.
        """
        pass

    @abstractmethod
    async def modify_order(self, order_id: str, quantity: Optional[int] = None, price: Optional[float] = None) -> OrderResult:
        """Modify an existing open order."""
        pass

    @abstractmethod
    async def cancel_order(self, order_id: str) -> OrderResult:
        """Cancel an open order."""
        pass

    @abstractmethod
    async def subscribe_market_data(self, symbols: List[str], callback: Callable[[Quote], Any]) -> None:
        """Subscribe to live ticks for specified symbols."""
        pass

    @abstractmethod
    async def unsubscribe_market_data(self, symbols: List[str]) -> None:
        """Unsubscribe from live ticks."""
        pass
