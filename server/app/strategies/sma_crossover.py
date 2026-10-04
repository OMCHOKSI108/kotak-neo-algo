from typing import Dict, Any
import pandas as pd
from app.strategies.base import BaseStrategy
from app.calculations.indicators import calculate_sma


class SMACrossoverStrategy(BaseStrategy):
    """
    Moving Average Crossover Strategy.
    Generates BUY signal when fast SMA crosses above slow SMA.
    Generates SELL signal when fast SMA crosses below slow SMA.
    """

    @property
    def name(self) -> str:
        return "sma_crossover"

    @property
    def description(self) -> str:
        return "Fast and Slow Simple Moving Average (SMA) trend-following crossover strategy."

    @property
    def default_parameters(self) -> Dict[str, Any]:
        return {
            "fast_period": 9,
            "slow_period": 21,
            "stop_loss_pct": 0.02,
            "take_profit_pct": 0.04
        }

    def generate_signals(self, df: pd.DataFrame, parameters: Dict[str, Any]) -> pd.DataFrame:
        df = df.copy()
        fast_p = int(parameters.get("fast_period", 9))
        slow_p = int(parameters.get("slow_period", 21))

        df["fast_sma"] = calculate_sma(df["close"], fast_p)
        df["slow_sma"] = calculate_sma(df["close"], slow_p)

        df["signal"] = 0
        # Bullish cross: fast moves above slow
        bullish = (df["fast_sma"] > df["slow_sma"]) & (df["fast_sma"].shift(1) <= df["slow_sma"].shift(1))
        # Bearish cross: fast moves below slow
        bearish = (df["fast_sma"] < df["slow_sma"]) & (df["fast_sma"].shift(1) >= df["slow_sma"].shift(1))

        df.loc[bullish, "signal"] = 1
        df.loc[bearish, "signal"] = -1

        return df
