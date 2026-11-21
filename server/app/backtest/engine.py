import math
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
import pandas as pd
from app.backtest.data_loader import load_historical_data_with_source
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
    Institutional Quantitative Backtesting Engine for Indian Markets (NSE/BSE).
    Features:
    1. Strict Bar-by-Bar Execution (No Lookahead Bias):
       Signals triggered on candle i close execute at candle i+1 open + slippage.
    2. Conservative Intrabar SL/TP:
       If both SL and TP price levels fall within the same candle's [Low, High],
       strictly triggers Stop Loss first (conservative execution).
    3. Intraday Square-Off:
       Force-exits open intraday positions on the 15:15 IST candle (or session close) with EOD_SQUAREOFF.
    4. Real Portfolio Equity Tracking:
       Total Equity = Initial Capital + Realized P&L + Unrealized MTM - Cumulative Transaction Charges.
       Never drops by the notional position value on entry.
    5. Indian Regulatory Cost Model:
       Calculates Brokerage, STT, Exchange Turnover charges, 18% GST, SEBI turnover fees, and Stamp Duty.
    6. Complete Quantitative Risk Metrics:
       Sharpe, Sortino, Calmar, Profit Factor, Expectancy, Win Rate, Drawdowns, and Consecutive Streaks.
    7. Data Provenance & Performance Telemetry:
       Tracks data source, candles processed, and execution time in milliseconds.
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
        segment: str = "options",  # "options", "equity_intraday", or "futures"
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        t_start = time.perf_counter()
        sym_upper = symbol.upper().strip()

        # 1. Load Strategy Object and Configurations
        strat_obj = get_strategy(strategy_id)
        if not strat_obj:
            raise ValueError(f"Strategy '{strategy_id}' not found in registry.")

        config = load_strategy_config(strategy_id)
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

        # 2. Load Real Historical Data with Provenance Tracking
        df, data_source = load_historical_data_with_source(sym_upper, timeframe)
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

        # 4. Simulation Setup
        is_index = sym_upper in INDEX_STRIKE_STEPS
        strike_step = INDEX_STRIKE_STEPS.get(sym_upper, 50)
        is_options_mode = (segment == "options") or (is_index and merged_params.get("execution_mode", "options") != "futures")

        opt_sl_pct = float(merged_params.get("stop_loss_pct", 0.25 if is_options_mode else 0.015))
        opt_tp_pct = float(merged_params.get("take_profit_pct", 0.50 if is_options_mode else 0.03))

        clean_lot_size = max(1, int(lot_size))
        clean_num_lots = max(1, int(num_lots))
        desired_qty = clean_num_lots * clean_lot_size

        # Portfolio Accounting State
        realized_pnl = 0.0
        cumulative_charges = 0.0
        position: Optional[Dict[str, Any]] = None
        pending_signal: Optional[Dict[str, Any]] = None  # Signal on bar i close executes on bar i+1 open

        trades: List[Dict[str, Any]] = []
        equity_curve: List[Dict[str, Any]] = []
        trade_id = 1
        peak_equity = float(initial_capital)

        # 5. Bar-by-Bar Sequential Execution Loop
        num_bars = len(signal_df)
        for idx in range(num_bars):
            row = signal_df.iloc[idx]
            curr_date = str(row.get("timestamp", idx))
            open_p = float(row["open"])
            high_p = float(row["high"])
            low_p = float(row["low"])
            close_p = float(row["close"])
            signal = int(row.get("signal", 0))

            # --- A. EXECUTE PENDING SIGNAL ON BAR OPEN (No Lookahead) ---
            if position is None and pending_signal is not None:
                sig_val = pending_signal["signal"]
                entry_spot = open_p  # Fill at open of next candle

                if is_options_mode:
                    atm_strike = round(entry_spot / strike_step) * strike_step
                    base_premium = round(entry_spot * 0.0125, 2)

                    if sig_val == 1:
                        opt_type = "CE"
                        instrument = f"{sym_upper} {int(atm_strike)} CE"
                        direction = "BUY CE (BULLISH)"
                        delta = 0.52
                    else:
                        opt_type = "PE"
                        instrument = f"{sym_upper} {int(atm_strike)} PE"
                        direction = "BUY PE (BEARISH)"
                        delta = -0.48

                    entry_exec_price = calculate_slippage(base_premium, "BUY", slippage_pct)
                    entry_turnover = entry_exec_price * desired_qty
                    entry_costs = calculate_indian_transaction_charges(
                        turnover=entry_turnover,
                        side="BUY",
                        segment="futures_options",
                        custom_brokerage_per_order=brokerage_per_order
                    )
                    cumulative_charges += entry_costs["total_charges"]

                    position = {
                        "type": opt_type,
                        "instrument": instrument,
                        "direction": direction,
                        "strike": atm_strike,
                        "entry_spot": entry_spot,
                        "entry_price": entry_exec_price,
                        "entry_date": curr_date,
                        "entry_idx": idx,
                        "quantity": desired_qty,
                        "delta": delta,
                        "entry_costs": entry_costs
                    }
                else:
                    # Futures / Spot Linear Mode
                    entry_exec_price = calculate_slippage(open_p, "BUY", slippage_pct)
                    entry_turnover = entry_exec_price * desired_qty
                    entry_costs = calculate_indian_transaction_charges(
                        turnover=entry_turnover,
                        side="BUY",
                        segment=segment,
                        custom_brokerage_per_order=brokerage_per_order
                    )
                    cumulative_charges += entry_costs["total_charges"]

                    position = {
                        "type": "LONG",
                        "instrument": sym_upper,
                        "direction": "BUY",
                        "strike": 0,
                        "entry_spot": entry_spot,
                        "entry_price": entry_exec_price,
                        "entry_date": curr_date,
                        "entry_idx": idx,
                        "quantity": desired_qty,
                        "delta": 1.0,
                        "entry_costs": entry_costs
                    }

                pending_signal = None

            # --- B. INTRABAR EXIT EVALUATION FOR OPEN POSITION ---
            if position is not None:
                pos_type = position["type"]
                entry_spot = position["entry_spot"]
                entry_premium = position["entry_price"]
                delta = position["delta"]
                days_held = max(1, idx - position["entry_idx"])
                theta_decay = entry_premium * (0.015 * days_held) if is_options_mode else 0.0

                if pos_type == "CE":
                    low_spot_delta = low_p - entry_spot
                    high_spot_delta = high_p - entry_spot
                    curr_spot_delta = close_p - entry_spot

                    low_val = max(5.0, entry_premium + (delta * low_spot_delta) - theta_decay)
                    high_val = max(5.0, entry_premium + (delta * high_spot_delta) - theta_decay)
                    close_val = max(5.0, entry_premium + (delta * curr_spot_delta) - theta_decay)
                elif pos_type == "PE":
                    low_spot_delta = entry_spot - high_p
                    high_spot_delta = entry_spot - low_p
                    curr_spot_delta = entry_spot - close_p

                    low_val = max(5.0, entry_premium + (abs(delta) * low_spot_delta) - theta_decay)
                    high_val = max(5.0, entry_premium + (abs(delta) * high_spot_delta) - theta_decay)
                    close_val = max(5.0, entry_premium + (abs(delta) * curr_spot_delta) - theta_decay)
                else:
                    low_val = low_p
                    high_val = high_p
                    close_val = close_p

                sl_barrier = entry_premium * (1.0 - opt_sl_pct)
                tp_barrier = entry_premium * (1.0 + opt_tp_pct)

                sl_hit = (low_val <= sl_barrier)
                tp_hit = (high_val >= tp_barrier)

                exit_triggered = False
                exit_price = close_val
                exit_reason = "SIGNAL"

                # Conservative Intrabar Execution: If both SL and Target are within candle range, trigger SL first
                if sl_hit and tp_hit:
                    exit_triggered = True
                    exit_price = sl_barrier
                    exit_reason = "STOP_LOSS"
                elif sl_hit:
                    exit_triggered = True
                    exit_price = sl_barrier
                    exit_reason = "STOP_LOSS"
                elif tp_hit:
                    exit_triggered = True
                    exit_price = tp_barrier
                    exit_reason = "TAKE_PROFIT"

                # Intraday 15:15 IST Square-Off Check
                if not exit_triggered:
                    if "15:15" in curr_date or "15:20" in curr_date or "15:25" in curr_date:
                        exit_triggered = True
                        exit_price = close_val
                        exit_reason = "EOD_SQUAREOFF"

                # Signal Reversal Check
                if not exit_triggered:
                    if (pos_type == "CE" and signal == -1) or (pos_type == "PE" and signal == 1):
                        exit_triggered = True
                        exit_price = close_val
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
                    cumulative_charges += exit_costs["total_charges"]

                    gross_trade_pnl = round((exec_exit_price - entry_premium) * pos_qty, 2)
                    trade_total_charges = round(position["entry_costs"]["total_charges"] + exit_costs["total_charges"], 2)
                    net_trade_pnl = round(gross_trade_pnl - trade_total_charges, 2)
                    realized_pnl += gross_trade_pnl

                    trades.append({
                        "trade_id": trade_id,
                        "symbol": position["instrument"],
                        "direction": position["direction"],
                        "side": "BUY" if pos_type in ["CE", "PE", "LONG"] else "SELL",
                        "quantity": pos_qty,
                        "entry_date": position["entry_date"],
                        "entry_price": round(entry_premium, 2),
                        "exit_date": curr_date,
                        "exit_price": round(exec_exit_price, 2),
                        "gross_pnl": gross_trade_pnl,
                        "total_charges": trade_total_charges,
                        "charges": trade_total_charges,
                        "net_pnl": net_trade_pnl,
                        "net_return_pct": round((net_trade_pnl / (entry_premium * pos_qty)) * 100, 2),
                        "exit_reason": exit_reason
                    })
                    trade_id += 1
                    position = None

            # --- C. RECORD SIGNAL ON CLOSE FOR NEXT BAR OPEN ---
            if position is None and signal in [1, -1]:
                pending_signal = {"signal": signal, "trigger_idx": idx}

            # --- D. ACCURATE PORTFOLIO EQUITY AT BAR CLOSE ---
            unrealized_pnl = 0.0
            if position is not None:
                pos_type = position["type"]
                entry_spot = position["entry_spot"]
                entry_premium = position["entry_price"]
                delta = position["delta"]
                days_held = max(1, idx - position["entry_idx"])
                theta_decay = entry_premium * (0.015 * days_held) if is_options_mode else 0.0

                if pos_type == "CE":
                    curr_spot_delta = close_p - entry_spot
                    close_val = max(5.0, entry_premium + (delta * curr_spot_delta) - theta_decay)
                elif pos_type == "PE":
                    curr_spot_delta = entry_spot - close_p
                    close_val = max(5.0, entry_premium + (abs(delta) * curr_spot_delta) - theta_decay)
                else:
                    close_val = close_p

                unrealized_pnl = (close_val - entry_premium) * position["quantity"]

            current_equity = round(float(initial_capital) + realized_pnl + unrealized_pnl - cumulative_charges, 2)
            peak_equity = max(peak_equity, current_equity)
            dd_rs = round(max(0.0, peak_equity - current_equity), 2)
            dd_pct = round((dd_rs / peak_equity * 100.0) if peak_equity > 0 else 0.0, 2)

            equity_curve.append({
                "timestamp": curr_date,
                "equity": current_equity,
                "cash": round(float(initial_capital) + realized_pnl - cumulative_charges, 2),
                "unrealized_pnl": round(unrealized_pnl, 2),
                "drawdown_pct": dd_pct,
                "drawdown_rs": dd_rs,
                "close_price": close_p
            })

        # --- E. CLOSE ANY OPEN POSITION AT END OF PERIOD ---
        if position is not None:
            final_bar = signal_df.iloc[-1]
            last_date = str(final_bar.get("timestamp", num_bars - 1))
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
            cumulative_charges += exit_costs["total_charges"]

            gross_trade_pnl = round((exec_exit - position["entry_price"]) * position["quantity"], 2)
            trade_total_charges = round(position["entry_costs"]["total_charges"] + exit_costs["total_charges"], 2)
            net_trade_pnl = round(gross_trade_pnl - trade_total_charges, 2)
            realized_pnl += gross_trade_pnl

            trades.append({
                "trade_id": trade_id,
                "symbol": position["instrument"],
                "direction": position["direction"],
                "side": "BUY" if position["type"] in ["CE", "PE", "LONG"] else "SELL",
                "quantity": position["quantity"],
                "entry_date": position["entry_date"],
                "entry_price": round(position["entry_price"], 2),
                "exit_date": last_date,
                "exit_price": round(exec_exit, 2),
                "gross_pnl": gross_trade_pnl,
                "total_charges": trade_total_charges,
                "charges": trade_total_charges,
                "net_pnl": net_trade_pnl,
                "net_return_pct": round((net_trade_pnl / (position["entry_price"] * position["quantity"])) * 100, 2),
                "exit_reason": "END_OF_PERIOD"
            })
            if equity_curve:
                final_eq = round(float(initial_capital) + realized_pnl - cumulative_charges, 2)
                equity_curve[-1]["equity"] = final_eq
                equity_curve[-1]["cash"] = final_eq
                equity_curve[-1]["unrealized_pnl"] = 0.0

        # --- F. INSTITUTIONAL METRICS ---
        metrics = calculate_performance_metrics(trades, initial_capital, equity_curve)

        # --- G. DAILY & MONTHLY BREAKDOWN ---
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
            ret_pct = round((item["pnl"] / initial_capital) * 100, 2)
            monthly_pnl.append({
                "month": m,
                "pnl": item["pnl"],
                "return_pct": ret_pct,
                "trades": item["trades"],
                "win_rate": win_pct
            })

        # --- H. DAY-OF-WEEK BREAKDOWN (Mon - Fri) ---
        dow_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        dow_data = {d: {"day": d, "day_num": i, "pnl": 0.0, "trades": 0, "wins": 0} for i, d in enumerate(dow_order)}
        for t in trades:
            raw_d = str(t.get("entry_date", ""))[:10]
            try:
                dt_obj = datetime.strptime(raw_d, "%Y-%m-%d")
                d_name = dt_obj.strftime("%A")
                if d_name in dow_data:
                    dow_data[d_name]["pnl"] = round(dow_data[d_name]["pnl"] + t["net_pnl"], 2)
                    dow_data[d_name]["trades"] += 1
                    if t["net_pnl"] > 0:
                        dow_data[d_name]["wins"] += 1
            except Exception:
                pass

        day_of_week_pnl = []
        for d in dow_order:
            item = dow_data[d]
            win_pct = round((item["wins"] / item["trades"]) * 100, 1) if item["trades"] > 0 else 0.0
            day_of_week_pnl.append({
                "day": d,
                "day_num": item["day_num"],
                "pnl": item["pnl"],
                "trades": item["trades"],
                "win_rate": win_pct
            })

        elapsed_ms = round((time.perf_counter() - t_start) * 1000.0, 1)

        metadata = {
            "data_source": data_source,
            "candles_processed": len(df),
            "execution_time_ms": elapsed_ms,
            "symbol": sym_upper,
            "timeframe": timeframe,
            "start_date": str(signal_df.iloc[0].get("timestamp"))[:10],
            "end_date": str(signal_df.iloc[-1].get("timestamp"))[:10],
            "total_trades": len(trades)
        }

        return {
            "strategy_id": strategy_id,
            "strategy_name": strat_obj.name,
            "symbol": sym_upper,
            "timeframe": timeframe,
            "execution_mode": "OPTIONS_BUYING" if is_options_mode else "FUTURES_SPOT",
            "start_date": metadata["start_date"],
            "end_date": metadata["end_date"],
            "parameters": merged_params,
            "metrics": metrics,
            "trades": trades,
            "equity_curve": equity_curve,
            "daily_pnl": daily_pnl,
            "monthly_pnl": monthly_pnl,
            "day_of_week_pnl": day_of_week_pnl,
            "dow_pnl": day_of_week_pnl,
            "data_source": data_source,
            "candles_processed": len(df),
            "execution_time_ms": elapsed_ms,
            "metadata": metadata
        }


backtest_engine = BacktestEngine()
