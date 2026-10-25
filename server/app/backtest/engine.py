import math
from typing import Dict, Any, List, Optional
from datetime import datetime
import pandas as pd
from app.backtest.data_loader import load_historical_data
from app.strategies.registry import get_strategy, load_strategy_config
from app.calculations.risk import calculate_slippage, calculate_indian_transaction_charges
from app.calculations.metrics import calculate_performance_metrics


INDEX_STRIKE_STEPS: Dict[str, int] = {
    "NIFTY": 50,
    "NIFTY 50": 50,
    "BANKNIFTY": 100,
    "SENSEX": 100,
    "FINNIFTY": 50,
}

INDEX_DEFAULT_LOT_SIZES: Dict[str, int] = {
    "NIFTY": 65,
    "NIFTY 50": 65,
    "BANKNIFTY": 30,
    "SENSEX": 20,
    "FINNIFTY": 40,
}


class BacktestEngine:
    """
    Advanced Quantitative Backtesting Engine for Indian Markets.
    Supports both:
    1. Realistic Options Trading Mode: Bullish buys ATM Call (CE), Bearish buys ATM Put (PE)
       with Black-Scholes Delta approximation, Theta time decay, premium-based SL/TP.
    2. Futures & Equity Spot Mode: Direct linear points simulation with margin sizing.
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
        segment: str = "options",  # "options" or "equity_intraday" or "futures"
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        sym_upper = symbol.upper().strip()

        # 1. Load Strategy
        strat_obj = get_strategy(strategy_id)
        if not strat_obj:
            raise ValueError(f"Strategy '{strategy_id}' not found in registry.")

        config = load_strategy_config(strategy_id)
        # Determine appropriate lot size for index/stock
        default_index_lot = INDEX_DEFAULT_LOT_SIZES.get(sym_upper, 1)
        if lot_size <= 1:
            lot_size = config.get("default_lot_size", default_index_lot)
        if num_lots <= 1 and config.get("default_num_lots"):
            num_lots = config["default_num_lots"]

        merged_params = strat_obj.default_parameters.copy()
        if "parameters" in config and isinstance(config["parameters"], dict):
            merged_params.update(config["parameters"])
        if parameters:
            merged_params.update(parameters)

        # 2. Load historical data from API
        df = load_historical_data(sym_upper, timeframe)
        if "timestamp" in df.columns:
            if start_date:
                df = df[df["timestamp"] >= str(start_date)[:10]]
            if end_date:
                df = df[df["timestamp"] <= str(end_date)[:10]]
            df = df.reset_index(drop=True)

        if df.empty or len(df) < 5:
            raise ValueError(f"Insufficient historical data for symbol '{symbol}' in selected date range.")

        # 3. Generate Signals on underlying
        signal_df = strat_obj.generate_signals(df, merged_params)

        # 4. Simulation Parameters
        is_index = sym_upper in INDEX_STRIKE_STEPS
        strike_step = INDEX_STRIKE_STEPS.get(sym_upper, 50)
        is_options_mode = (segment == "options") or (is_index and merged_params.get("execution_mode", "options") != "futures")

        # Option Risk Parameters
        # In options, stop loss is typically 25% of premium; take profit is 50% (1:2 R:R)
        opt_sl_pct = float(merged_params.get("stop_loss_pct", 0.25 if is_options_mode else 0.015))
        opt_tp_pct = float(merged_params.get("take_profit_pct", 0.50 if is_options_mode else 0.03))

        cash = initial_capital
        position: Optional[Dict[str, Any]] = None  # Current open trade
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

            # --- Check Exit for Open Position ---
            if position is not None:
                pos_type = position["type"]  # "CE" (Call) or "PE" (Put) or "LONG"
                entry_spot = position["entry_spot"]
                entry_premium = position["entry_price"]
                delta = position["delta"]
                entry_idx = position["entry_idx"]
                days_held = max(1, idx - entry_idx)

                # Daily Theta decay: ~1.5% of premium per day for ATM weekly options
                theta_decay = entry_premium * (0.015 * days_held) if is_options_mode else 0.0

                # Calculate estimated current premium based on spot change
                if pos_type == "CE":
                    spot_delta = close_p - entry_spot
                    low_spot_delta = low_p - entry_spot
                    high_spot_delta = high_p - entry_spot

                    curr_premium = max(5.0, entry_premium + (delta * spot_delta) - theta_decay)
                    low_premium = max(5.0, entry_premium + (delta * low_spot_delta) - theta_decay)
                    high_premium = max(5.0, entry_premium + (delta * high_spot_delta) - theta_decay)
                elif pos_type == "PE":
                    # Put gains when spot drops
                    spot_delta = entry_spot - close_p
                    low_spot_delta = entry_spot - high_p
                    high_spot_delta = entry_spot - low_p

                    curr_premium = max(5.0, entry_premium + (abs(delta) * spot_delta) - theta_decay)
                    low_premium = max(5.0, entry_premium + (abs(delta) * low_spot_delta) - theta_decay)
                    high_premium = max(5.0, entry_premium + (abs(delta) * high_spot_delta) - theta_decay)
                else:
                    # Linear spot / futures
                    curr_premium = close_p
                    low_premium = low_p
                    high_premium = high_p

                exit_triggered = False
                exit_price = curr_premium
                exit_reason = "SIGNAL"

                # Check Stop Loss
                sl_barrier = entry_premium * (1.0 - opt_sl_pct)
                if low_premium <= sl_barrier:
                    exit_triggered = True
                    exit_price = sl_barrier
                    exit_reason = "STOP_LOSS"

                # Check Take Profit
                tp_barrier = entry_premium * (1.0 + opt_tp_pct)
                if not exit_triggered and high_premium >= tp_barrier:
                    exit_triggered = True
                    exit_price = tp_barrier
                    exit_reason = "TAKE_PROFIT"

                # Check Signal Reversal (e.g. Call held but Bearish signal appears)
                if not exit_triggered:
                    if pos_type == "CE" and signal == -1:
                        exit_triggered = True
                        exit_price = curr_premium
                        exit_reason = "REVERSAL_SIGNAL"
                    elif pos_type == "PE" and signal == 1:
                        exit_triggered = True
                        exit_price = curr_premium
                        exit_reason = "REVERSAL_SIGNAL"

                if exit_triggered:
                    pos_qty = position["quantity"]
                    exec_exit_price = calculate_slippage(exit_price, "SELL", slippage_pct)
                    exit_turnover = exec_exit_price * pos_qty

                    charges_segment = "futures_options" if is_options_mode else segment
                    exit_costs = calculate_indian_transaction_charges(
                        turnover=exit_turnover,
                        side="SELL",
                        segment=charges_segment,
                        custom_brokerage_per_order=brokerage_per_order
                    )

                    gross_pnl = round((exec_exit_price - entry_premium) * pos_qty, 2)
                    total_charges = round(position["entry_costs"]["total_charges"] + exit_costs["total_charges"], 2)
                    net_pnl = round(gross_pnl - total_charges, 2)
                    cash += (exit_turnover - exit_costs["total_charges"])

                    trades.append({
                        "trade_id": trade_id,
                        "symbol": position["instrument"],
                        "direction": position["direction"],
                        "quantity": pos_qty,
                        "entry_date": position["entry_date"],
                        "entry_price": round(entry_premium, 2),
                        "exit_date": curr_date,
                        "exit_price": round(exec_exit_price, 2),
                        "gross_pnl": gross_pnl,
                        "total_charges": total_charges,
                        "net_pnl": net_pnl,
                        "net_return_pct": round((net_pnl / (entry_premium * pos_qty)) * 100, 2),
                        "exit_reason": exit_reason
                    })
                    trade_id += 1
                    position = None

            # --- Check Entry for Flat Position ---
            if position is None and signal in [1, -1]:
                clean_lot_size = max(1, int(lot_size))
                clean_num_lots = max(1, int(num_lots))
                desired_qty = clean_num_lots * clean_lot_size

                if is_options_mode:
                    # ATM Strike calculation
                    atm_strike = round(close_p / strike_step) * strike_step
                    # ATM Option Premium approximation: ~1.2% of spot for Indian indices
                    base_premium = round(close_p * 0.0125, 2)

                    if signal == 1:
                        opt_type = "CE"
                        instrument = f"{sym_upper} {int(atm_strike)} CE"
                        direction = "BUY CE (BULLISH)"
                        delta = 0.52
                    else:
                        opt_type = "PE"
                        instrument = f"{sym_upper} {int(atm_strike)} PE"
                        direction = "BUY PE (BEARISH)"
                        delta = -0.48

                    entry_price = calculate_slippage(base_premium, "BUY", slippage_pct)
                    entry_turnover = entry_price * desired_qty
                    entry_costs = calculate_indian_transaction_charges(
                        turnover=entry_turnover,
                        side="BUY",
                        segment="futures_options",
                        custom_brokerage_per_order=brokerage_per_order
                    )
                    required_cash = entry_turnover + entry_costs["total_charges"]

                    if cash >= required_cash:
                        cash -= required_cash
                        position = {
                            "type": opt_type,
                            "instrument": instrument,
                            "direction": direction,
                            "strike": atm_strike,
                            "entry_spot": close_p,
                            "entry_price": entry_price,
                            "entry_date": curr_date,
                            "entry_idx": idx,
                            "quantity": desired_qty,
                            "delta": delta,
                            "entry_costs": entry_costs
                        }
                else:
                    # Futures / Spot linear mode
                    if signal == 1:
                        entry_price = calculate_slippage(close_p, "BUY", slippage_pct)
                        margin_pct = 0.20 if segment in ["equity_intraday", "futures"] else 1.0
                        entry_turnover = entry_price * desired_qty
                        entry_costs = calculate_indian_transaction_charges(
                            turnover=entry_turnover,
                            side="BUY",
                            segment=segment,
                            custom_brokerage_per_order=brokerage_per_order
                        )
                        required_cash = (entry_turnover * margin_pct) + entry_costs["total_charges"]

                        if cash >= required_cash:
                            cash -= entry_costs["total_charges"]
                            position = {
                                "type": "LONG",
                                "instrument": sym_upper,
                                "direction": "BUY",
                                "strike": 0,
                                "entry_spot": close_p,
                                "entry_price": entry_price,
                                "entry_date": curr_date,
                                "entry_idx": idx,
                                "quantity": desired_qty,
                                "delta": 1.0,
                                "entry_costs": entry_costs
                            }

            # Mark to Market (MTM) current portfolio equity
            unrealized = 0.0
            if position is not None:
                if is_options_mode:
                    delta_p = close_p - position["entry_spot"]
                    mult = 1 if position["type"] == "CE" else -1
                    cur_p = max(5.0, position["entry_price"] + (mult * abs(position["delta"]) * delta_p))
                    unrealized = (cur_p - position["entry_price"]) * position["quantity"]
                else:
                    unrealized = (close_p - position["entry_price"]) * position["quantity"]

            current_equity = round(cash + unrealized, 2)
            equity_curve.append({
                "timestamp": curr_date,
                "equity": current_equity,
                "cash": round(cash, 2),
                "close_price": close_p
            })

        # Close any lingering open position at end of backtest period
        if position is not None:
            final_bar = signal_df.iloc[-1]
            last_date = str(final_bar.get("timestamp", len(signal_df) - 1))
            final_close = float(final_bar["close"])

            if is_options_mode:
                delta_p = final_close - position["entry_spot"]
                mult = 1 if position["type"] == "CE" else -1
                exit_price = max(5.0, position["entry_price"] + (mult * abs(position["delta"]) * delta_p))
            else:
                exit_price = final_close

            exec_exit = calculate_slippage(exit_price, "SELL", slippage_pct)
            exit_turnover = exec_exit * position["quantity"]
            charges_segment = "futures_options" if is_options_mode else segment
            exit_costs = calculate_indian_transaction_charges(
                turnover=exit_turnover,
                side="SELL",
                segment=charges_segment,
                custom_brokerage_per_order=brokerage_per_order
            )
            gross_pnl = round((exec_exit - position["entry_price"]) * position["quantity"], 2)
            total_charges = round(position["entry_costs"]["total_charges"] + exit_costs["total_charges"], 2)
            net_pnl = round(gross_pnl - total_charges, 2)
            cash += (exit_turnover - exit_costs["total_charges"])

            trades.append({
                "trade_id": trade_id,
                "symbol": position["instrument"],
                "direction": position["direction"],
                "quantity": position["quantity"],
                "entry_date": position["entry_date"],
                "entry_price": round(position["entry_price"], 2),
                "exit_date": last_date,
                "exit_price": round(exec_exit, 2),
                "gross_pnl": gross_pnl,
                "total_charges": total_charges,
                "net_pnl": net_pnl,
                "net_return_pct": round((net_pnl / (position["entry_price"] * position["quantity"])) * 100, 2),
                "exit_reason": "END_OF_PERIOD"
            })
            if equity_curve:
                equity_curve[-1]["equity"] = round(cash, 2)
                equity_curve[-1]["cash"] = round(cash, 2)

        # 5. Compute Metrics
        metrics = calculate_performance_metrics(trades, initial_capital, equity_curve)

        # 6. Compute Daily & Monthly PnL Breakdowns for Super Admin visualization
        daily_dict = {}
        for t in trades:
            d = str(t.get("exit_date", ""))[:10]
            if d:
                if d not in daily_dict:
                    daily_dict[d] = {"date": d, "pnl": 0.0, "trades": 0}
                daily_dict[d]["pnl"] = round(daily_dict[d]["pnl"] + t["net_pnl"], 2)
                daily_dict[d]["trades"] += 1
        daily_pnl = sorted(list(daily_dict.values()), key=lambda x: x["date"])

        monthly_dict = {}
        for t in trades:
            m = str(t.get("exit_date", ""))[:7]
            if m:
                if m not in monthly_dict:
                    monthly_dict[m] = {"month": m, "pnl": 0.0, "trades": 0, "wins": 0}
                monthly_dict[m]["pnl"] = round(monthly_dict[m]["pnl"] + t["net_pnl"], 2)
                monthly_dict[m]["trades"] += 1
                if t["net_pnl"] > 0:
                    monthly_dict[m]["wins"] += 1

        monthly_pnl = []
        for m, item in sorted(monthly_dict.items(), key=lambda x: x[0]):
            win_pct = round((item["wins"] / item["trades"]) * 100, 1) if item["trades"] > 0 else 0.0
            monthly_pnl.append({
                "month": m,
                "pnl": item["pnl"],
                "trades": item["trades"],
                "win_rate": win_pct
            })

        return {
            "strategy_id": strategy_id,
            "strategy_name": strat_obj.name,
            "symbol": sym_upper,
            "timeframe": timeframe,
            "execution_mode": "OPTIONS_BUYING" if is_options_mode else "FUTURES_SPOT",
            "start_date": signal_df.iloc[0].get("timestamp"),
            "end_date": signal_df.iloc[-1].get("timestamp"),
            "parameters": merged_params,
            "metrics": metrics,
            "trades": trades,
            "equity_curve": equity_curve,
            "daily_pnl": daily_pnl,
            "monthly_pnl": monthly_pnl
        }


backtest_engine = BacktestEngine()
