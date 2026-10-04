from typing import Dict, Any
import pandas as pd
from app.strategies.base import BaseStrategy
from app.calculations.indicators import calculate_rsi


class RSIMeanReversionStrategy(BaseStrategy):
    """
    RSI Mean Reversion Strategy.
    Buys when RSI crosses back above oversold threshold.
    Sells when RSI crosses back below overbought threshold.
    """

    @property
    def name(self) -> str:
        return "rsi_mean_reversion"

    @property
    def description(self) -> str:
        return "RSI oversold / overbought mean reversion momentum strategy."

    @property
    def default_parameters(self) -> Dict[str, Any]:
        return {
            "period": 14,
            "oversold": 30,
            "overbought": 70,
            "stop_loss_pct": 0.02,
            "take_profit_pct": 0.03
        }

    def generate_signals(self, df: pd.DataFrame, parameters: Dict[str, Any]) -> pd.DataFrame:
        df = df.copy()
        period = int(parameters.get("period", 14))
        oversold = float(parameters.get("oversold", 30))
        overbought = float(parameters.get("overbought", 70))

        df["rsi"] = calculate_rsi(df["close"], period)
        df["signal"] = 0

        # Buy when crossing above oversold
        buy_cond = (df["rsi"] > oversold) & (df["rsi"].shift(1) <= oversold)
        # Sell when crossing below overbought
        sell_cond = (df["rsi"] < overbought) & (df["rsi"].shift(1) >= overbought)

        df.loc[buy_cond, "signal"] = 1
        df.loc[sell_cond, "signal"] = -1

        return df
