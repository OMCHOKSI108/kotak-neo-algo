from typing import Dict, Any
import pandas as pd
from app.strategies.base import BaseStrategy
from app.calculations.indicators import calculate_ema


class Nifty915EMAStrategy(BaseStrategy):
    """
    Default Indian Index 9/15 EMA Crossover Strategy.
    - Generates bullish signal (BUY CALL) when EMA 9 crosses above EMA 15.
    - Generates bearish signal (BUY PUT) when EMA 9 crosses below EMA 15.
    - Operates with strict stop loss and target rules.
    """

    @property
    def name(self) -> str:
        return "nifty_9_15_ema"

    @property
    def description(self) -> str:
        return "9/15 EMA crossover momentum strategy for NIFTY / BANKNIFTY options & futures."

    @property
    def default_parameters(self) -> Dict[str, Any]:
        return {
            "fast_period": 9,
            "slow_period": 15,
            "stop_loss_pct": 0.015,
            "take_profit_pct": 0.03,
            "max_trades_per_day": 3
        }

    def generate_signals(self, df: pd.DataFrame, parameters: Dict[str, Any]) -> pd.DataFrame:
        df = df.copy()
        fast_p = int(parameters.get("fast_period", 9))
        slow_p = int(parameters.get("slow_period", 15))

        df["fast_ema"] = calculate_ema(df["close"], fast_p)
        df["slow_ema"] = calculate_ema(df["close"], slow_p)

        df["signal"] = 0
        # Bullish cross: fast EMA moves above slow EMA -> BUY CALL
        bullish = (df["fast_ema"] > df["slow_ema"]) & (df["fast_ema"].shift(1) <= df["slow_ema"].shift(1))
        # Bearish cross: fast EMA moves below slow EMA -> BUY PUT
        bearish = (df["fast_ema"] < df["slow_ema"]) & (df["fast_ema"].shift(1) >= df["slow_ema"].shift(1))

        df.loc[bullish, "signal"] = 1
        df.loc[bearish, "signal"] = -1

        return df
