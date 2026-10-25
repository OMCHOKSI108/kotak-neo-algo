import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.strategies.base import BaseStrategy
from app.strategies.sma_crossover import SMACrossoverStrategy
from app.strategies.rsi_strategy import RSIMeanReversionStrategy
from app.strategies.breakout_strategy import HighLowBreakoutStrategy
from app.strategies.ema_9_15 import Nifty915EMAStrategy

STRATEGY_MAP: Dict[str, BaseStrategy] = {
    "nifty_9_15_ema": Nifty915EMAStrategy(),
    "sma_crossover": SMACrossoverStrategy(),
    "rsi_mean_reversion": RSIMeanReversionStrategy(),
    "channel_breakout": HighLowBreakoutStrategy(),
}

STRATEGY_JSON_PATH = Path(__file__).resolve().parent / "strategy.json"


def get_strategy(strategy_id: str) -> Optional[BaseStrategy]:
    """Retrieve strategy implementation instance by id."""
    return STRATEGY_MAP.get(strategy_id)


def list_strategies() -> List[Dict[str, Any]]:
    """List all available strategies with their default metadata and parameters."""
    if STRATEGY_JSON_PATH.exists():
        try:
            with open(STRATEGY_JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("strategies", [])
        except Exception:
            pass

    # Fallback to in-code definitions
    return [
        {
            "id": strat_id,
            "name": strat.name,
            "description": strat.description,
            "parameters": strat.default_parameters
        }
        for strat_id, strat in STRATEGY_MAP.items()
    ]


def load_strategy_config(strategy_id: str) -> Dict[str, Any]:
    """Load configuration for a specific strategy from strategy.json."""
    if STRATEGY_JSON_PATH.exists():
        with open(STRATEGY_JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            for strat in data.get("strategies", []):
                if strat.get("id") == strategy_id:
                    return strat

    # Fallback
    strat = get_strategy(strategy_id)
    if strat:
        return {
            "id": strategy_id,
            "name": strat.name,
            "description": strat.description,
            "parameters": strat.default_parameters,
            "capital": 500000.0,
            "slippage_pct": 0.0005,
            "brokerage_per_order": 20.0
        }
    return {}
