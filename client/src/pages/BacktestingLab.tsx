import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { StrategyDefinition, BacktestReport, TradeRecord } from '../types';
import {
  BarChart2, Play, DollarSign, Activity, Percent, ArrowUpRight,
  ArrowDownRight, CheckCircle, Sliders, Calendar, FileText
} from 'lucide-react';

export const BacktestingLab: React.FC = () => {
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [datasets, setDatasets] = useState<string[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('sma_crossover');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY');
  const [capital, setCapital] = useState<number>(500000);
  const [slippage, setSlippage] = useState<number>(0.05); // 0.05%
  const [brokerage, setBrokerage] = useState<number>(20.0);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [strats, dsets] = await Promise.all([
          api.getStrategies(),
          api.getDatasets(),
        ]);
        setStrategies(strats);
        setDatasets(dsets);

        if (strats.length > 0) {
          const first = strats[0];
          setSelectedStrategyId(first.id);
          setParameters(first.parameters || {});
          if (first.default_symbol) setSelectedSymbol(first.default_symbol);
        }
      } catch (err: any) {
        setError(err.message);
      }
    };
    init();
  }, []);

  const handleStrategyChange = (id: string) => {
    setSelectedStrategyId(id);
    const found = strategies.find((s) => s.id === id);
    if (found) {
      setParameters(found.parameters || {});
      if (found.default_symbol) setSelectedSymbol(found.default_symbol);
    }
  };

  const handleParamChange = (key: string, val: any) => {
    setParameters((prev) => ({
      ...prev,
      [key]: isNaN(Number(val)) ? val : Number(val),
    }));
  };

  const handleRunBacktest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await api.runBacktest({
        strategy_id: selectedStrategyId,
        symbol: selectedSymbol,
        timeframe: '1d',
        initial_capital: capital,
        slippage_pct: slippage / 100,
        brokerage_per_order: brokerage,
        segment: 'equity_intraday',
        parameters,
      });
      setReport(result);
    } catch (err: any) {
      setError(err.message || 'Backtest execution failed');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (val?: number) => {
    if (val === undefined || val === null) return '--';
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
          <BarChart2 className="w-5 h-5 text-blue-400" />
          <span>Backtesting & Quantitative Strategy Lab</span>
        </h2>
        <p className="text-xs text-gray-400 font-mono mt-0.5">
          Pure broker-independent engine executing parameterized strategies against normalized Indian historical data.
        </p>
      </div>

      {/* Strategy Tuner & Execution Form */}
      <form onSubmit={handleRunBacktest} className="bg-[#151922] border border-[#232936] rounded-xl p-6 shadow-xl space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Strategy Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
              Strategy
            </label>
            <select
              value={selectedStrategyId}
              onChange={(e) => handleStrategyChange(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dataset Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
              Underlying Asset
            </label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            >
              {datasets.map((d) => (
                <option key={d} value={d}>
                  {d} (1D Bars)
                </option>
              ))}
            </select>
          </div>

          {/* Initial Capital */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
              Initial Capital (₹)
            </label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Slippage & Brokerage */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
                Slippage %
              </label>
              <input
                type="number"
                step="0.01"
                value={slippage}
                onChange={(e) => setSlippage(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
                Brokerage ₹
              </label>
              <input
                type="number"
                value={brokerage}
                onChange={(e) => setBrokerage(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Parameter Tuner */}
        <div className="pt-4 border-t border-[#232936]">
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center space-x-1.5 mb-3 font-mono">
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span>Strategy Parameters (from strategy.json)</span>
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(parameters).map(([key, value]) => (
              <div key={key}>
                <label className="block text-[11px] font-mono text-gray-400 mb-1 capitalize">
                  {key.replace(/_/g, ' ')}
                </label>
                <input
                  type="number"
                  step="any"
                  value={value}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-500 focus:outline-none transition-colors disabled:opacity-50 shadow-lg shadow-blue-600/30"
          >
            <Play className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Simulating Strategy...' : 'Execute Backtest'}</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Results View */}
      {report && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 font-mono">
            {/* Net P&L */}
            <div className="bg-[#151922] border border-[#232936] rounded-xl p-4">
              <span className="text-[11px] text-gray-400 uppercase">Net P&L</span>
              <p
                className={`text-lg font-extrabold mt-1 ${
                  report.metrics.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                ₹{formatPrice(report.metrics.net_pnl)}
              </p>
              <span className="text-[10px] text-gray-500">
                {report.metrics.net_return_percent >= 0 ? '+' : ''}
                {report.metrics.net_return_percent}%
              </span>
            </div>

            {/* Win Rate */}
            <div className="bg-[#151922] border border-[#232936] rounded-xl p-4">
              <span className="text-[11px] text-gray-400 uppercase">Win Rate</span>
              <p className="text-lg font-extrabold text-white mt-1">{report.metrics.win_rate}%</p>
              <span className="text-[10px] text-gray-500">
                {report.metrics.winning_trades}W / {report.metrics.losing_trades}L
              </span>
            </div>

            {/* Total Trades */}
            <div className="bg-[#151922] border border-[#232936] rounded-xl p-4">
              <span className="text-[11px] text-gray-400 uppercase">Total Trades</span>
              <p className="text-lg font-extrabold text-blue-400 mt-1">{report.metrics.total_trades}</p>
              <span className="text-[10px] text-gray-500">Completed Orders</span>
            </div>

            {/* Profit Factor */}
            <div className="bg-[#151922] border border-[#232936] rounded-xl p-4">
              <span className="text-[11px] text-gray-400 uppercase">Profit Factor</span>
              <p className="text-lg font-extrabold text-white mt-1">{report.metrics.profit_factor}</p>
              <span className="text-[10px] text-gray-500">Gross W / Gross L</span>
            </div>

            {/* Max Drawdown */}
            <div className="bg-[#151922] border border-[#232936] rounded-xl p-4">
              <span className="text-[11px] text-gray-400 uppercase">Max Drawdown</span>
              <p className="text-lg font-extrabold text-red-400 mt-1">
                {report.metrics.max_drawdown_percent}%
              </p>
              <span className="text-[10px] text-gray-500">₹{formatPrice(report.metrics.max_drawdown)}</span>
            </div>

            {/* Sharpe Ratio */}
            <div className="bg-[#151922] border border-[#232936] rounded-xl p-4">
              <span className="text-[11px] text-gray-400 uppercase">Sharpe Ratio</span>
              <p className="text-lg font-extrabold text-white mt-1">{report.metrics.sharpe_ratio}</p>
              <span className="text-[10px] text-gray-500">Annualized</span>
            </div>

            {/* Sortino Ratio */}
            <div className="bg-[#151922] border border-[#232936] rounded-xl p-4">
              <span className="text-[11px] text-gray-400 uppercase">Sortino Ratio</span>
              <p className="text-lg font-extrabold text-white mt-1">{report.metrics.sortino_ratio}</p>
              <span className="text-[10px] text-gray-500">Downside Dev</span>
            </div>
          </div>

          {/* Equity Curve SVG Chart */}
          <div className="bg-[#151922] border border-[#232936] rounded-xl p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-2">Simulated Equity Curve</h3>
            <p className="text-xs text-gray-400 font-mono mb-4">
              Capital evolution accounting for fills, slippage, and Indian regulatory fees (STT, GST, SEBI charges).
            </p>

            {report.equity_curve.length > 1 ? (
              <div className="w-full h-56 relative">
                {(() => {
                  const values = report.equity_curve.map((p) => p.equity);
                  const min = Math.min(...values);
                  const max = Math.max(...values);
                  const range = max - min || 1;
                  const width = 800;
                  const height = 200;

                  const points = report.equity_curve
                    .map((p, i) => {
                      const x = (i / (report.equity_curve.length - 1)) * width;
                      const y = height - ((p.equity - min) / range) * (height - 20) - 10;
                      return `${x},${y}`;
                    })
                    .join(' ');

                  return (
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <polyline fill="none" stroke="#3B82F6" strokeWidth="2.5" points={points} />
                    </svg>
                  );
                })()}
                <div className="flex justify-between text-[10px] font-mono text-gray-500 mt-2">
                  <span>Start: {report.equity_curve[0]?.timestamp}</span>
                  <span>End: {report.equity_curve[report.equity_curve.length - 1]?.timestamp}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Not enough points to render equity curve.</p>
            )}
          </div>

          {/* Trade History Table */}
          <div className="bg-[#151922] border border-[#232936] rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#232936] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Trade Execution Log</h3>
              <span className="text-xs font-mono text-gray-400">{report.trades.length} Simulated Trades</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#232936] text-[10px] text-gray-400 uppercase bg-[#10141D]">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Side</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Entry (Date / Price)</th>
                    <th className="py-2.5 px-3">Exit (Date / Price)</th>
                    <th className="py-2.5 px-3">Gross P&L</th>
                    <th className="py-2.5 px-3">Charges (STT/GST)</th>
                    <th className="py-2.5 px-3">Net P&L</th>
                    <th className="py-2.5 px-3">Exit Trigger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232936]/60">
                  {report.trades.map((t) => (
                    <tr key={t.trade_id} className="hover:bg-[#1D2330]">
                      <td className="py-2.5 px-3 text-gray-500">{t.trade_id}</td>
                      <td className="py-2.5 px-3 font-bold text-white">{t.symbol}</td>
                      <td className="py-2.5 px-3 text-emerald-400">{t.direction}</td>
                      <td className="py-2.5 px-3 text-gray-300">{t.quantity}</td>
                      <td className="py-2.5 px-3 text-gray-300">
                        {t.entry_date} @ ₹{formatPrice(t.entry_price)}
                      </td>
                      <td className="py-2.5 px-3 text-gray-300">
                        {t.exit_date} @ ₹{formatPrice(t.exit_price)}
                      </td>
                      <td className="py-2.5 px-3 text-gray-300">₹{formatPrice(t.gross_pnl)}</td>
                      <td className="py-2.5 px-3 text-amber-400">₹{formatPrice(t.total_charges)}</td>
                      <td
                        className={`py-2.5 px-3 font-bold ${
                          t.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        ₹{formatPrice(t.net_pnl)} ({t.net_return_pct}%)
                      </td>
                      <td className="py-2.5 px-3 text-gray-400">{t.exit_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
