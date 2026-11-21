import numpy as np
from typing import List, Dict, Any


def calculate_performance_metrics(
    trades: List[Dict[str, Any]],
    initial_capital: float,
    equity_curve: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Compute algorithmic trading performance metrics:
    - Net P&L, Return %
    - Win rate, Total trades, Winning vs Losing trades
    - Profit factor (Gross Profit / Gross Loss)
    - Maximum Drawdown (absolute & percentage)
    - Sharpe Ratio, Sortino Ratio
    - Average trade P&L, Max consecutive losses
    """
    total_trades = len(trades)
    if total_trades == 0:
        return {
            "initial_capital": initial_capital,
            "final_equity": initial_capital,
            "net_pnl": 0.0,
            "net_return_percent": 0.0,
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
            "win_rate": 0.0,
            "profit_factor": 0.0,
            "max_drawdown": 0.0,
            "max_drawdown_percent": 0.0,
            "sharpe_ratio": 0.0,
            "sortino_ratio": 0.0,
            "avg_trade_pnl": 0.0,
            "max_consecutive_losses": 0
        }

    pnls = [t["net_pnl"] for t in trades]
    winning_trades = [p for p in pnls if p > 0]
    losing_trades = [p for p in pnls if p < 0]

    gross_profit = sum(winning_trades)
    gross_loss = abs(sum(losing_trades))
    net_pnl = round(sum(pnls), 2)
    final_equity = round(initial_capital + net_pnl, 2)
    net_return_pct = round((net_pnl / initial_capital) * 100, 2)

    win_count = len(winning_trades)
    loss_count = len(losing_trades)
    win_rate = round((win_count / total_trades) * 100, 2)

    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (999.0 if gross_profit > 0 else 0.0)

    # Maximum Drawdown calculation from equity curve
    equity_values = [pt["equity"] for pt in equity_curve] if equity_curve else [initial_capital, final_equity]
    peak = equity_values[0]
    max_dd = 0.0
    max_dd_pct = 0.0

    for eq in equity_values:
        if eq > peak:
            peak = eq
        dd = peak - eq
        dd_pct = (dd / peak) * 100 if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd
        if dd_pct > max_dd_pct:
            max_dd_pct = dd_pct

    # Returns for Sharpe and Sortino (annualized with 252 trading days)
    trade_returns = [p / initial_capital for p in pnls]
    mean_ret = np.mean(trade_returns)
    std_ret = np.std(trade_returns)

    # Sharpe ratio (assuming 0 risk-free rate for simplicity)
    if std_ret > 0:
        sharpe = round(float((mean_ret / std_ret) * np.sqrt(252)), 2)
    else:
        sharpe = 0.0

    # Downside deviation for Sortino
    neg_returns = [r for r in trade_returns if r < 0]
    if neg_returns:
        downside_std = np.std(neg_returns)
        sortino = round(float((mean_ret / downside_std) * np.sqrt(252)), 2) if downside_std > 0 else 0.0
    else:
        sortino = 999.0 if mean_ret > 0 else 0.0

    # Max consecutive losses and wins
    max_consec_losses = 0
    curr_consec_loss = 0
    max_consec_wins = 0
    curr_consec_win = 0
    for p in pnls:
        if p < 0:
            curr_consec_loss += 1
            if curr_consec_loss > max_consec_losses:
                max_consec_losses = curr_consec_loss
            curr_consec_win = 0
        elif p > 0:
            curr_consec_win += 1
            if curr_consec_win > max_consec_wins:
                max_consec_wins = curr_consec_win
            curr_consec_loss = 0
        else:
            curr_consec_loss = 0
            curr_consec_win = 0

    gross_pnls = [t.get("gross_pnl", t["net_pnl"]) for t in trades]
    total_charges_list = [t.get("total_charges", 0.0) for t in trades]
    gross_pnl = round(sum(gross_pnls), 2)
    total_charges = round(sum(total_charges_list), 2)

    avg_win = round(float(np.mean(winning_trades)), 2) if winning_trades else 0.0
    avg_loss = round(float(np.mean([abs(x) for x in losing_trades])), 2) if losing_trades else 0.0
    win_loss_ratio = round(avg_win / avg_loss, 2) if avg_loss > 0 else 0.0
    loss_rate = 100.0 - win_rate
    expectancy = round(((win_rate / 100.0) * avg_win) - ((loss_rate / 100.0) * avg_loss), 2)
    calmar_ratio = round(net_return_pct / max_dd_pct, 2) if max_dd_pct > 0 else 0.0

    return {
        "initial_capital": round(initial_capital, 2),
        "final_equity": final_equity,
        "net_pnl": net_pnl,
        "gross_pnl": gross_pnl,
        "total_charges": total_charges,
        "net_return_percent": net_return_pct,
        "total_trades": total_trades,
        "winning_trades": win_count,
        "losing_trades": loss_count,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "expectancy": expectancy,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "win_loss_ratio": win_loss_ratio,
        "max_drawdown": round(max_dd, 2),
        "max_drawdown_percent": round(max_dd_pct, 2),
        "sharpe_ratio": sharpe,
        "sortino_ratio": sortino,
        "calmar_ratio": calmar_ratio,
        "avg_trade_pnl": round(float(np.mean(pnls)), 2),
        "max_consecutive_losses": max_consec_losses,
        "max_consecutive_wins": max_consec_wins
    }
