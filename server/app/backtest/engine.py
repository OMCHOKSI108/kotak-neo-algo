import math
from typing import Dict, Any, List, Optional
import pandas as pd
from app.backtest.data_loader import load_historical_data
from app.strategies.registry import get_strategy, load_strategy_config
from app.calculations.risk import calculate_slippage, calculate_indian_transaction_charges
from app.calculations.metrics import calculate_performance_metrics


class BacktestEngine:
    """
    Backtesting engine independent of any broker.
    Executes parameterized strategies against historical OHLCV data,
    simulates realistic order fills with slippage, accounts for Indian transaction costs,
    and calculates comprehensive performance statistics.
    """

    def __init__(self):
        pass

    def run(
        self,
        strategy_id: str,
        symbol: str = "NIFTY",
        timeframe: str = "1d",
        initial_capital: float = 500000.0,
        lot_size: int = 1,
        num_lots: int = 1,
        sizing_mode: str = "lots",
        slippage_pct: float = 0.0005,
        brokerage_per_order: float = 20.0,
        segment: str = "equity_intraday",
        parameters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        # 1. Load Strategy
        strat_obj = get_strategy(strategy_id)
        if not strat_obj:
            raise ValueError(f"Strategy '{strategy_id}' not found in registry.")

        config = load_strategy_config(strategy_id)
        # Inherit defaults from config if not explicitly provided
        if lot_size <= 1 and config.get("default_lot_size"):
            lot_size = config["default_lot_size"]
        if num_lots <= 1 and config.get("default_num_lots"):
            num_lots = config["default_num_lots"]
        merged_params = strat_obj.default_parameters.copy()
        if "parameters" in config and isinstance(config["parameters"], dict):
            merged_params.update(config["parameters"])
        if parameters:
            merged_params.update(parameters)

        # 2. Load historical data
        df = load_historical_data(symbol, timeframe)
        if df.empty or len(df) < 10:
            raise ValueError(f"Insufficient historical data for symbol '{symbol}'.")

        # 3. Generate Signals
        signal_df = strat_obj.generate_signals(df, merged_params)

        # 4. Simulate Trades
        cash = initial_capital
        position_qty = 0
        entry_price = 0.0
        entry_date = ""
        stop_loss_pct = float(merged_params.get("stop_loss_pct", 0.02))
        take_profit_pct = float(merged_params.get("take_profit_pct", 0.04))

        trades: List[Dict[str, Any]] = []
        equity_curve: List[Dict[str, Any]] = []
        trade_id = 1

        for idx, row in signal_df.iterrows():
            curr_date = str(row.get("timestamp", idx))
            open_p = float(row["open"])
            high_p = float(row["high"])
            low_p = float(row["low"])
            close_p = float(row["close"])
            signal = int(row.get("signal", 0))

            # --- Check Exit for Open Long Position ---
            if position_qty > 0:
                exit_triggered = False
                exit_price = close_p
                exit_reason = "SIGNAL"

                # Check Stop Loss
                sl_price = entry_price * (1.0 - stop_loss_pct)
                if low_p <= sl_price:
                    exit_triggered = True
                    exit_price = sl_price
                    exit_reason = "STOP_LOSS"
                # Check Take Profit
                tp_price = entry_price * (1.0 + take_profit_pct)
                if high_p >= tp_price:
                    exit_triggered = True
                    exit_price = tp_price
                    exit_reason = "TAKE_PROFIT"
                # Check Reverse Signal
                if not exit_triggered and signal == -1:
                    exit_triggered = True
                    exit_price = close_p
                    exit_reason = "SIGNAL_EXIT"

                if exit_triggered:
                    exec_exit_price = calculate_slippage(exit_price, "SELL", slippage_pct)
                    exit_turnover = exec_exit_price * position_qty
                    exit_costs = calculate_indian_transaction_charges(
                        turnover=exit_turnover,
                        side="SELL",
                        segment=segment,
                        custom_brokerage_per_order=brokerage_per_order
                    )
                    gross_pnl = round((exec_exit_price - entry_price) * position_qty, 2)
                    net_pnl = round(gross_pnl - (current_entry_costs["total_charges"] + exit_costs["total_charges"]), 2)
                    cash += (exit_turnover - exit_costs["total_charges"])

                    trades.append({
                        "trade_id": trade_id,
                        "symbol": symbol.upper(),
                        "direction": "LONG",
                        "quantity": position_qty,
                        "entry_date": entry_date,
                        "entry_price": round(entry_price, 2),
                        "exit_date": curr_date,
                        "exit_price": round(exec_exit_price, 2),
                        "gross_pnl": gross_pnl,
                        "total_charges": round(current_entry_costs["total_charges"] + exit_costs["total_charges"], 2),
                        "net_pnl": net_pnl,
                        "net_return_pct": round((net_pnl / (entry_price * position_qty)) * 100, 2),
                        "exit_reason": exit_reason
                    })
                    trade_id += 1
                    position_qty = 0
                    entry_price = 0.0

            # --- Check Entry for Flat Position ---
            if position_qty == 0 and signal == 1:
                exec_entry_price = calculate_slippage(close_p, "BUY", slippage_pct)
                clean_lot_size = max(1, int(lot_size))
                clean_num_lots = max(1, int(num_lots))

                if sizing_mode == "lots":
                    # Trade exact number of lots (e.g. 2 lots * 25 lot_size = 50 qty)
                    desired_qty = clean_num_lots * clean_lot_size
                    entry_turnover = exec_entry_price * desired_qty
                    entry_costs = calculate_indian_transaction_charges(
                        turnover=entry_turnover,
                        side="BUY",
                        segment=segment,
                        custom_brokerage_per_order=brokerage_per_order
                    )
                    # If cash is insufficient, downsize to maximum affordable lots
                    if cash < (entry_turnover + entry_costs["total_charges"]):
                        affordable_lots = math.floor(cash / (exec_entry_price * clean_lot_size))
                        desired_qty = affordable_lots * clean_lot_size

                    qty = desired_qty
                else:
                    # Allocate based on available cash rounded to nearest lot size
                    alloc_cash = cash * 0.95
                    raw_qty = math.floor(alloc_cash / exec_entry_price)
                    qty = (raw_qty // clean_lot_size) * clean_lot_size if clean_lot_size > 1 else raw_qty

                if qty > 0:
                    entry_turnover = exec_entry_price * qty
                    entry_costs = calculate_indian_transaction_charges(
                        turnover=entry_turnover,
                        side="BUY",
                        segment=segment,
                        custom_brokerage_per_order=brokerage_per_order
                    )
                    if cash >= (entry_turnover + entry_costs["total_charges"]):
                        cash -= (entry_turnover + entry_costs["total_charges"])
                        position_qty = qty
                        entry_price = exec_entry_price
                        entry_date = curr_date
                        current_entry_costs = entry_costs

            # Mark to Market (MTM) current portfolio equity
            unrealized = (close_p - entry_price) * position_qty if position_qty > 0 else 0.0
            current_equity = round(cash + (position_qty * close_p) + unrealized, 2)
            equity_curve.append({
                "timestamp": curr_date,
                "equity": current_equity,
                "cash": round(cash, 2),
                "close_price": close_p
            })

        # Close any lingering open position at end of backtest period
        if position_qty > 0:
            final_bar = signal_df.iloc[-1]
            last_date = str(final_bar.get("timestamp", len(signal_df) - 1))
            last_close = float(final_bar["close"])
            exec_exit = calculate_slippage(last_close, "SELL", slippage_pct)
            exit_turnover = exec_exit * position_qty
            exit_costs = calculate_indian_transaction_charges(
                turnover=exit_turnover,
                side="SELL",
                segment=segment,
                custom_brokerage_per_order=brokerage_per_order
            )
            gross_pnl = round((exec_exit - entry_price) * position_qty, 2)
            net_pnl = round(gross_pnl - (current_entry_costs["total_charges"] + exit_costs["total_charges"]), 2)
            cash += (exit_turnover - exit_costs["total_charges"])
            trades.append({
                "trade_id": trade_id,
                "symbol": symbol.upper(),
                "direction": "LONG",
                "quantity": position_qty,
                "entry_date": entry_date,
                "entry_price": round(entry_price, 2),
                "exit_date": last_date,
                "exit_price": round(exec_exit, 2),
                "gross_pnl": gross_pnl,
                "total_charges": round(current_entry_costs["total_charges"] + exit_costs["total_charges"], 2),
                "net_pnl": net_pnl,
                "net_return_pct": round((net_pnl / (entry_price * position_qty)) * 100, 2),
                "exit_reason": "END_OF_PERIOD"
            })
            if equity_curve:
                equity_curve[-1]["equity"] = round(cash, 2)
                equity_curve[-1]["cash"] = round(cash, 2)

        # 5. Compute Metrics
        metrics = calculate_performance_metrics(trades, initial_capital, equity_curve)

        return {
            "strategy_id": strategy_id,
            "strategy_name": strat_obj.name,
            "symbol": symbol.upper(),
            "timeframe": timeframe,
            "start_date": signal_df.iloc[0].get("timestamp"),
            "end_date": signal_df.iloc[-1].get("timestamp"),
            "parameters": merged_params,
            "metrics": metrics,
            "trades": trades,
            "equity_curve": equity_curve
        }


backtest_engine = BacktestEngine()
