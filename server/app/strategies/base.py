from abc import ABC, abstractmethod
from typing import Dict, Any
import pandas as pd


class BaseStrategy(ABC):
    """
    Abstract base strategy.
    Strategies are pure and decoupled from data storage and broker execution.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique strategy name."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Human-readable strategy description."""
        pass

    @property
    @abstractmethod
    def default_parameters(self) -> Dict[str, Any]:
        """Default parameter dictionary."""
        pass

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame, parameters: Dict[str, Any]) -> pd.DataFrame:
        """
        Takes OHLCV dataframe and strategy parameters, calculates indicators,
        and outputs the dataframe with an integer 'signal' column:
        1: Buy / Long
        -1: Sell / Exit / Short
        0: Hold
        """
        pass
