from typing import Dict, Any
import pandas as pd
from app.strategies.base import BaseStrategy


class HighLowBreakoutStrategy(BaseStrategy):
    """
    Channel Breakout Strategy.
    Buys when price breaks above highest high of the lookback window.
    Sells when price breaks below lowest low of the lookback window.
    """

    @property
    def name(self) -> str:
        return "channel_breakout"

    @property
    def description(self) -> str:
        return "Donchian channel high/low breakout strategy."

    @property
    def default_parameters(self) -> Dict[str, Any]:
        return {
            "lookback_period": 20,
            "stop_loss_pct": 0.015,
            "take_profit_pct": 0.04
        }

    def generate_signals(self, df: pd.DataFrame, parameters: Dict[str, Any]) -> pd.DataFrame:
        df = df.copy()
        lookback = int(parameters.get("lookback_period", 20))

        # Highest high and lowest low of previous N bars (excluding current bar)
        df["highest_high"] = df["high"].shift(1).rolling(window=lookback, min_periods=1).max()
        df["lowest_low"] = df["low"].shift(1).rolling(window=lookback, min_periods=1).min()

        df["signal"] = 0
        buy_cond = df["close"] > df["highest_high"]
        sell_cond = df["close"] < df["lowest_low"]

        df.loc[buy_cond, "signal"] = 1
        df.loc[sell_cond, "signal"] = -1

        return df
