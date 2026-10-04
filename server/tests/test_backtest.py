import pytest
import pandas as pd
import numpy as np
from app.calculations.indicators import (
    calculate_sma, calculate_ema, calculate_rsi, calculate_bollinger_bands, calculate_atr
)
from app.calculations.risk import calculate_slippage, calculate_indian_transaction_charges
from app.calculations.metrics import calculate_performance_metrics
from app.backtest.engine import backtest_engine


def test_indicators_math():
    series = pd.Series([10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0, 20.0])
    sma = calculate_sma(series, 5)
    assert len(sma) == len(series)
    assert round(sma.iloc[-1], 2) == 18.0

    ema = calculate_ema(series, 5)
    assert len(ema) == len(series)
    assert ema.iloc[-1] > 0

    rsi = calculate_rsi(series, 5)
    assert len(rsi) == len(series)
    assert 0 <= rsi.iloc[-1] <= 100


def test_indian_transaction_charges():
    # Test intraday buy charges
    buy_costs = calculate_indian_transaction_charges(turnover=100000.0, side="BUY", segment="equity_intraday")
    assert buy_costs["brokerage"] <= 20.0
    assert buy_costs["stamp_duty"] > 0.0
    assert buy_costs["stt"] == 0.0  # STT not charged on intraday buy
    assert buy_costs["total_charges"] > 0.0

    # Test intraday sell charges
    sell_costs = calculate_indian_transaction_charges(turnover=100000.0, side="SELL", segment="equity_intraday")
    assert sell_costs["stt"] > 0.0  # STT charged on intraday sell


def test_performance_metrics_calculation():
    trades = [
        {"net_pnl": 1500.0},
        {"net_pnl": -500.0},
        {"net_pnl": 2000.0},
        {"net_pnl": -1000.0}
    ]
    equity_curve = [
        {"equity": 100000.0},
        {"equity": 101500.0},
        {"equity": 101000.0},
        {"equity": 103000.0},
        {"equity": 102000.0}
    ]
    metrics = calculate_performance_metrics(trades, initial_capital=100000.0, equity_curve=equity_curve)

    assert metrics["total_trades"] == 4
    assert metrics["winning_trades"] == 2
    assert metrics["losing_trades"] == 2
    assert metrics["win_rate"] == 50.0
    assert metrics["net_pnl"] == 2000.0
    assert metrics["profit_factor"] == round(3500.0 / 1500.0, 2)
    assert metrics["max_drawdown"] == 1000.0


def test_backtest_engine_run():
    report = backtest_engine.run(
        strategy_id="sma_crossover",
        symbol="NIFTY",
        timeframe="1d",
        initial_capital=500000.0,
        slippage_pct=0.0005,
        brokerage_per_order=20.0,
        segment="equity_intraday"
    )

    assert "metrics" in report
    assert "trades" in report
    assert "equity_curve" in report
    assert report["strategy_name"] == "sma_crossover"
    assert report["symbol"] == "NIFTY"
    assert report["metrics"]["initial_capital"] == 500000.0
    assert len(report["equity_curve"]) > 0
