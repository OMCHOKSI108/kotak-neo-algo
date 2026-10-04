import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { StrategyDefinition, BacktestReport, TradeRecord, BrokerProfile } from '../types';
import {
  BarChart2, Play, DollarSign, Activity, Percent, ArrowUpRight,
  ArrowDownRight, CheckCircle, Sliders, Calendar, FileText, Layers,
  Wallet, Sparkles, Check, Info
} from 'lucide-react';

export const BacktestingLab: React.FC = () => {
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [datasets, setDatasets] = useState<string[]>([]);
  const [brokerProfile, setBrokerProfile] = useState<BrokerProfile | null>(null);

  // Form selections
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('sma_crossover');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY');
  const [capital, setCapital] = useState<number>(500000);
  const [lotSize, setLotSize] = useState<number>(25); // Indian standard: 25 for NIFTY, 15 for BANKNIFTY
  const [numLots, setNumLots] = useState<number>(2);
  const [sizingMode, setSizingMode] = useState<'lots' | 'capital'>('lots');
  const [slippage, setSlippage] = useState<number>(0.05); // 0.05%
  const [brokerage, setBrokerage] = useState<number>(20.0);
  const [parameters, setParameters] = useState<Record<string, any>>({});

  // Execution state
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect default lot size based on instrument
  const getDefaultLotSizeForSymbol = (sym: string): number => {
    const s = sym.toUpperCase();
    if (s.includes('BANKNIFTY')) return 15;
    if (s.includes('NIFTY')) return 25;
    if (s.includes('SENSEX')) return 10;
    return 1; // Equities: RELIANCE, TCS, INFY, etc.
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [strats, dsets, profile] = await Promise.all([
          api.getStrategies(),
          api.getDatasets(),
          api.getBrokerProfile().catch(() => null),
        ]);
        setStrategies(strats);
        setDatasets(dsets);
        if (profile) {
          setBrokerProfile(profile);
          if (profile.available_margin && profile.available_margin > 0) {
            setCapital(profile.available_margin);
          }
        }

        if (strats.length > 0) {
          const first = strats[0];
          setSelectedStrategyId(first.id);
          setParameters(first.parameters || {});
          if (first.default_symbol) {
            setSelectedSymbol(first.default_symbol);
            setLotSize(first.default_lot_size || getDefaultLotSizeForSymbol(first.default_symbol));
          }
          if (first.default_num_lots) {
            setNumLots(first.default_num_lots);
          }
          if (!profile?.available_margin && first.default_capital) {
            setCapital(first.default_capital);
          }
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
      if (found.default_symbol) {
        setSelectedSymbol(found.default_symbol);
        setLotSize(found.default_lot_size || getDefaultLotSizeForSymbol(found.default_symbol));
      }
      if (found.default_num_lots) {
        setNumLots(found.default_num_lots);
      }
    }
  };

  const handleSymbolChange = (sym: string) => {
    setSelectedSymbol(sym);
    setLotSize(getDefaultLotSizeForSymbol(sym));
  };

  const handleParamChange = (key: string, val: any) => {
    setParameters((prev) => ({
      ...prev,
      [key]: isNaN(Number(val)) ? val : Number(val),
    }));
  };

  const handleUseBrokerBalance = () => {
    if (brokerProfile && brokerProfile.available_margin > 0) {
      setCapital(brokerProfile.available_margin);
    }
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
        lot_size: lotSize,
        num_lots: numLots,
        sizing_mode: sizingMode,
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

  const totalTradeQty = lotSize * numLots;
  const currentStrategy = strategies.find((s) => s.id === selectedStrategyId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-400" />
            <span>Quantitative Backtesting Lab</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Broker-independent simulation engine testing parameterized strategies against normalized Indian historical data.
          </p>
        </div>

        {/* Dynamic Live Broker Balance Banner */}
        {brokerProfile && brokerProfile.available_margin > 0 && (
          <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Wallet className="w-4 h-4" />
              <span className="font-semibold">Live Broker Margin:</span>
              <span className="font-mono font-bold text-white">₹{formatPrice(brokerProfile.available_margin)}</span>
            </div>
            <button
              type="button"
              onClick={handleUseBrokerBalance}
              className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 transition-colors"
            >
              Use Balance
            </button>
          </div>
        )}
      </div>

      {/* 1. Visual Strategy Selector Cards */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider font-mono">
          Select Quantitative Strategy ({strategies.length} Available)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {strategies.map((strat) => {
            const isSelected = strat.id === selectedStrategyId;
            return (
              <div
                key={strat.id}
                onClick={() => handleStrategyChange(strat.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500 shadow-lg shadow-blue-500/10'
                    : 'bg-[#151922] border-[#232936] hover:border-[#384358]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-sm font-bold text-white">{strat.name}</h3>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{strat.description}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#232936] text-[11px] font-mono text-gray-500">
                  <span>Default Asset: <span className="text-gray-300">{strat.default_symbol || 'NIFTY'}</span></span>
                  <span>Lot: <span className="text-blue-400">{strat.default_lot_size || 1}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Execution Parameters & Configuration */}
      <form onSubmit={handleRunBacktest} className="bg-[#151922] border border-[#232936] rounded-xl p-6 shadow-xl space-y-6">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <span>Trading Parameters & Lot Sizing</span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Configure capital, instrument lot sizes, statutory transaction charges, and technical indicator thresholds.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Underlying Asset */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
              Underlying Asset
            </label>
            <select
              value={selectedSymbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              className="w-full bg-[#0E1117] border border-[#2B3547] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            >
              {datasets.map((d) => (
                <option key={d} value={d}>
                  {d} (1D Daily Bars)
                </option>
              ))}
            </select>
          </div>

          {/* Capital Input (Dynamic or Custom) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-300 uppercase font-mono">
                Trading Capital (₹)
              </label>
              {brokerProfile && (
                <button
                  type="button"
                  onClick={handleUseBrokerBalance}
                  className="text-[10px] text-blue-400 hover:underline font-mono"
                >
                  Fill Broker Balance
                </button>
              )}
            </div>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              min={10000}
              step={5000}
              className="w-full bg-[#0E1117] border border-[#2B3547] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              required
            />
          </div>

          {/* Lot Size Setting (Configurable in UI) */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono flex items-center justify-between">
              <span>Lot Size</span>
              <span className="text-[10px] text-blue-400 font-normal">Per Contract</span>
            </label>
            <input
              type="number"
              value={lotSize}
              onChange={(e) => setLotSize(Math.max(1, Number(e.target.value)))}
              min={1}
              step={1}
              className="w-full bg-[#0E1117] border border-[#2B3547] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              required
            />
          </div>

          {/* Number of Lots */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono flex items-center justify-between">
              <span>Number of Lots</span>
              <span className="text-[10px] text-emerald-400 font-semibold font-mono">Qty: {totalTradeQty}</span>
            </label>
            <input
              type="number"
              value={numLots}
              onChange={(e) => setNumLots(Math.max(1, Number(e.target.value)))}
              min={1}
              step={1}
              className="w-full bg-[#0E1117] border border-[#2B3547] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              required
            />
          </div>
        </div>

        {/* Position Sizing Mode & Statutory Costs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#232936]">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
              Position Sizing Model
            </label>
            <select
              value={sizingMode}
              onChange={(e) => setSizingMode(e.target.value as any)}
              className="w-full bg-[#0E1117] border border-[#2B3547] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            >
              <option value="lots">Fixed Lot Execution ({numLots} Lots = {totalTradeQty} units)</option>
              <option value="capital">Dynamic Capital Allocation (Max Lots Affordable)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
              Slippage Buffer (%)
            </label>
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(Number(e.target.value))}
              step={0.01}
              min={0}
              className="w-full bg-[#0E1117] border border-[#2B3547] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
              Flat Brokerage / Order (₹)
            </label>
            <input
              type="number"
              value={brokerage}
              onChange={(e) => setBrokerage(Number(e.target.value))}
              step={1}
              min={0}
              className="w-full bg-[#0E1117] border border-[#2B3547] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        {/* Dynamic Strategy-Specific Parameters */}
        {Object.keys(parameters).length > 0 && (
          <div className="p-4 rounded-xl bg-[#0E1117] border border-[#232936] space-y-3">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>Strategy Indicators & Risk Thresholds ({currentStrategy?.name})</span>
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(parameters).map(([key, val]) => (
                <div key={key}>
                  <label className="block text-[11px] text-gray-400 font-mono capitalize mb-1">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                    step={Number(val) % 1 !== 0 || Number(val) < 1 ? 0.01 : 1}
                    className="w-full bg-[#151922] border border-[#2B3547] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-400 font-mono flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            <span>Simulates bar-by-bar entries, exits, stop loss, and Indian statutory charges (STT, GST, SEBI).</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors uppercase tracking-wider shadow-lg shadow-blue-600/30"
          >
            <Play className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Simulating Trades...' : 'Execute Backtest'}</span>
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Backtest Report / Results */}
      {report && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-[#151922] border border-[#232936] rounded-xl p-3.5">
              <span className="text-[11px] font-mono text-gray-400 block uppercase">Net P&L</span>
              <p
                className={`text-base font-bold font-mono mt-1 ${
                  report.metrics.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                ₹{formatPrice(report.metrics.net_pnl)}
              </p>
              <span className="text-[10px] text-gray-500 font-mono">
                {report.metrics.net_return_percent >= 0 ? '+' : ''}
                {report.metrics.net_return_percent.toFixed(2)}%
              </span>
            </div>

            <div className="bg-[#151922] border border-[#232936] rounded-xl p-3.5">
              <span className="text-[11px] font-mono text-gray-400 block uppercase">Win Rate</span>
              <p className="text-base font-bold font-mono text-white mt-1">
                {report.metrics.win_rate.toFixed(1)}%
              </p>
              <span className="text-[10px] text-gray-500 font-mono">
                {report.metrics.winning_trades}W / {report.metrics.losing_trades}L
              </span>
            </div>

            <div className="bg-[#151922] border border-[#232936] rounded-xl p-3.5">
              <span className="text-[11px] font-mono text-gray-400 block uppercase">Profit Factor</span>
              <p className="text-base font-bold font-mono text-white mt-1">
                {report.metrics.profit_factor.toFixed(2)}
              </p>
              <span className="text-[10px] text-gray-500 font-mono">Gross Gain / Loss</span>
            </div>

            <div className="bg-[#151922] border border-[#232936] rounded-xl p-3.5">
              <span className="text-[11px] font-mono text-gray-400 block uppercase">Max Drawdown</span>
              <p className="text-base font-bold font-mono text-red-400 mt-1">
                {report.metrics.max_drawdown_percent.toFixed(2)}%
              </p>
              <span className="text-[10px] text-gray-500 font-mono">
                ₹{formatPrice(report.metrics.max_drawdown)}
              </span>
            </div>

            <div className="bg-[#151922] border border-[#232936] rounded-xl p-3.5">
              <span className="text-[11px] font-mono text-gray-400 block uppercase">Sharpe Ratio</span>
              <p className="text-base font-bold font-mono text-white mt-1">
                {report.metrics.sharpe_ratio.toFixed(2)}
              </p>
              <span className="text-[10px] text-gray-500 font-mono">Annualized Risk-Adj</span>
            </div>

            <div className="bg-[#151922] border border-[#232936] rounded-xl p-3.5">
              <span className="text-[11px] font-mono text-gray-400 block uppercase">Total Trades</span>
              <p className="text-base font-bold font-mono text-white mt-1">
                {report.metrics.total_trades}
              </p>
              <span className="text-[10px] text-gray-500 font-mono">Completed Roundtrips</span>
            </div>
          </div>

          {/* Equity Curve Table / Summary */}
          <div className="bg-[#151922] border border-[#232936] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white font-mono flex items-center justify-between">
              <span>Simulated Portfolio Growth</span>
              <span className="text-xs text-gray-400 font-normal">
                Initial: ₹{formatPrice(report.metrics.initial_capital)} → Final: ₹{formatPrice(report.metrics.final_equity)}
              </span>
            </h3>

            {/* Quick SVG Equity Curve visualization */}
            {report.equity_curve.length > 1 && (
              <div className="h-44 w-full bg-[#0E1117] rounded-lg p-3 relative flex items-end overflow-hidden border border-[#1F2633]">
                {(() => {
                  const values = report.equity_curve.map((e) => e.equity);
                  const min = Math.min(...values);
                  const max = Math.max(...values);
                  const range = max - min || 1;
                  const points = report.equity_curve
                    .map((e, idx) => {
                      const x = (idx / (report.equity_curve.length - 1)) * 100;
                      const y = 100 - ((e.equity - min) / range) * 85 - 10;
                      return `${x},${y}`;
                    })
                    .join(' ');

                  const isProfit = report.metrics.net_pnl >= 0;
                  const strokeColor = isProfit ? '#10B981' : '#EF4444';

                  return (
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                      <polyline
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="2"
                        points={points}
                      />
                    </svg>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Detailed Trades Log */}
          <div className="bg-[#151922] border border-[#232936] rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#232936] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Trade Execution Ledger ({report.trades.length} Trades)</span>
              </h3>
              <span className="text-xs text-gray-400 font-mono">
                Quantity: {totalTradeQty} ({numLots} lots × {lotSize})
              </span>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#232936] text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-[#10141D] sticky top-0">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Entry</th>
                    <th className="py-2.5 px-3">Exit</th>
                    <th className="py-2.5 px-3">Gross P&L</th>
                    <th className="py-2.5 px-3">Indian Taxes/Charges</th>
                    <th className="py-2.5 px-3">Net P&L</th>
                    <th className="py-2.5 px-3">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232936] font-mono text-[11px]">
                  {report.trades.map((t: TradeRecord) => (
                    <tr key={t.trade_id} className="hover:bg-[#1D2330]">
                      <td className="py-2 px-3 text-gray-400">{t.trade_id}</td>
                      <td className="py-2 px-3 font-semibold text-blue-400">{t.direction}</td>
                      <td className="py-2 px-3 text-white">{t.quantity}</td>
                      <td className="py-2 px-3">
                        <div>₹{formatPrice(t.entry_price)}</div>
                        <div className="text-[10px] text-gray-500">{t.entry_date.split('T')[0]}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div>₹{formatPrice(t.exit_price)}</div>
                        <div className="text-[10px] text-gray-500">{t.exit_date.split('T')[0]}</div>
                      </td>
                      <td className={`py-2 px-3 font-bold ${t.gross_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        ₹{formatPrice(t.gross_pnl)}
                      </td>
                      <td className="py-2 px-3 text-amber-400/90">
                        ₹{formatPrice(t.total_charges)}
                      </td>
                      <td className={`py-2 px-3 font-bold ${t.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        ₹{formatPrice(t.net_pnl)} ({t.net_return_pct >= 0 ? '+' : ''}{t.net_return_pct.toFixed(2)}%)
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        <span className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px]">
                          {t.exit_reason}
                        </span>
                      </td>
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
