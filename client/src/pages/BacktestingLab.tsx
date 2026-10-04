import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { StrategyDefinition, BacktestReport, TradeRecord, BrokerProfile } from '../types';
import {
  BarChart2, Play, Check, AlertCircle, Info, Sliders,
  ArrowUpRight, ArrowDownRight, Layers, FileText, ChevronRight, Wallet
} from 'lucide-react';

export const BacktestingLab: React.FC = () => {
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [datasets, setDatasets] = useState<string[]>([]);
  const [brokerProfile, setBrokerProfile] = useState<BrokerProfile | null>(null);

  // Form selections
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('sma_crossover');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY');
  const [capital, setCapital] = useState<number>(500000);
  const [lotSize, setLotSize] = useState<number>(25);
  const [numLots, setNumLots] = useState<number>(2);
  const [sizingMode, setSizingMode] = useState<'lots' | 'capital'>('lots');
  const [slippage, setSlippage] = useState<number>(0.05);
  const [brokerage, setBrokerage] = useState<number>(20);
  const [parameters, setParameters] = useState<Record<string, any>>({});

  // Execution state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<BacktestReport | null>(null);

  // Standard Indian exchange lot sizes by symbol
  const getDefaultLotSizeForSymbol = (sym: string): number => {
    const s = sym.toUpperCase();
    if (s.includes('BANKNIFTY')) return 15;
    if (s.includes('NIFTY')) return 25;
    if (s.includes('SENSEX')) return 10;
    return 1; // Equities default to 1 share
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [strats, dSets, profile] = await Promise.all([
          api.getStrategies(),
          api.getDatasets().catch(() => ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS']),
          api.getBrokerProfile().catch(() => null),
        ]);

        setStrategies(strats);
        setDatasets(dSets);

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
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-600" />
            <span>Quantitative Backtesting Lab</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Broker-independent simulation engine testing parameterized strategies against normalized Indian historical data.
          </p>
        </div>

        {/* Dynamic Live Broker Balance Banner */}
        {brokerProfile && brokerProfile.available_margin > 0 && (
          <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-800">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold">Live Margin:</span>
              <span className="font-mono font-bold text-gray-900">₹{formatPrice(brokerProfile.available_margin)}</span>
            </div>
            <button
              type="button"
              onClick={handleUseBrokerBalance}
              className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 transition-colors"
            >
              Use Balance
            </button>
          </div>
        )}
      </div>

      {/* 1. Visual Strategy Selector Cards */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">
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
                    ? 'bg-blue-50/70 border-blue-600 shadow-sm'
                    : 'bg-white border-gray-200 hover:border-gray-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-gray-900">{strat.name}</h3>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{strat.description}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] font-mono text-gray-500">
                  <span>Default Asset: <span className="text-gray-900 font-semibold">{strat.default_symbol || 'NIFTY'}</span></span>
                  <span>Lot Size: <span className="text-blue-700 font-bold">{strat.default_lot_size || 1}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Execution Parameters & Configuration */}
      <form onSubmit={handleRunBacktest} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Trading Parameters & Lot Sizing</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure capital, instrument lot sizes, statutory transaction charges, and technical indicator thresholds.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Underlying Asset */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1 font-mono">
              Underlying Asset
            </label>
            <select
              value={selectedSymbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
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
              <label className="block text-xs font-bold text-gray-700 uppercase font-mono">
                Trading Capital (₹)
              </label>
              {brokerProfile && (
                <button
                  type="button"
                  onClick={handleUseBrokerBalance}
                  className="text-[10px] text-blue-600 hover:underline font-mono font-bold"
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
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              required
            />
          </div>

          {/* Lot Size Setting (Configurable in UI) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1 font-mono flex items-center justify-between">
              <span>Lot Size</span>
              <span className="text-[10px] text-blue-600 font-normal">Per Contract</span>
            </label>
            <input
              type="number"
              value={lotSize}
              onChange={(e) => setLotSize(Math.max(1, Number(e.target.value)))}
              min={1}
              step={1}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              required
            />
          </div>

          {/* Number of Lots */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1 font-mono flex items-center justify-between">
              <span>Number of Lots</span>
              <span className="text-[10px] text-emerald-700 font-bold font-mono">Qty: {totalTradeQty}</span>
            </label>
            <input
              type="number"
              value={numLots}
              onChange={(e) => setNumLots(Math.max(1, Number(e.target.value)))}
              min={1}
              step={1}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              required
            />
          </div>
        </div>

        {/* Position Sizing Mode & Statutory Costs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1 font-mono">
              Position Sizing Model
            </label>
            <select
              value={sizingMode}
              onChange={(e) => setSizingMode(e.target.value as any)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
            >
              <option value="lots">Fixed Lot Execution ({numLots} Lots = {totalTradeQty} units)</option>
              <option value="capital">Dynamic Capital Allocation (Max Lots Affordable)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1 font-mono">
              Slippage Buffer (%)
            </label>
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(Number(e.target.value))}
              step={0.01}
              min={0}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1 font-mono">
              Flat Brokerage / Order (₹)
            </label>
            <input
              type="number"
              value={brokerage}
              onChange={(e) => setBrokerage(Number(e.target.value))}
              step={1}
              min={0}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        {/* Dynamic Strategy-Specific Parameters */}
        {Object.keys(parameters).length > 0 && (
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>Strategy Indicators & Risk Thresholds ({currentStrategy?.name})</span>
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(parameters).map(([key, val]) => (
                <div key={key}>
                  <label className="block text-[11px] text-gray-600 font-mono capitalize mb-1">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                    step={Number(val) % 1 !== 0 || Number(val) < 1 ? 0.01 : 1}
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-500 font-mono flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600" />
            <span>Simulates bar-by-bar entries, exits, stop loss, and Indian statutory charges (STT, GST, SEBI).</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors uppercase tracking-wider shadow-sm"
          >
            <Play className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Simulating Trades...' : 'Execute Backtest'}</span>
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Backtest Report / Results */}
      {report && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
              <span className="text-[11px] font-mono text-gray-500 block uppercase">Net P&L</span>
              <p
                className={`text-base font-bold font-mono mt-1 ${
                  report.metrics.net_pnl >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                ₹{formatPrice(report.metrics.net_pnl)}
              </p>
              <span className="text-[10px] text-gray-600 font-mono">
                {report.metrics.net_return_percent >= 0 ? '+' : ''}
                {report.metrics.net_return_percent.toFixed(2)}%
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
              <span className="text-[11px] font-mono text-gray-500 block uppercase">Win Rate</span>
              <p className="text-base font-bold font-mono text-gray-900 mt-1">
                {report.metrics.win_rate.toFixed(1)}%
              </p>
              <span className="text-[10px] text-gray-600 font-mono">
                {report.metrics.winning_trades}W / {report.metrics.losing_trades}L
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
              <span className="text-[11px] font-mono text-gray-500 block uppercase">Profit Factor</span>
              <p className="text-base font-bold font-mono text-gray-900 mt-1">
                {report.metrics.profit_factor.toFixed(2)}
              </p>
              <span className="text-[10px] text-gray-600 font-mono">Gross Gain / Loss</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
              <span className="text-[11px] font-mono text-gray-500 block uppercase">Max Drawdown</span>
              <p className="text-base font-bold font-mono text-red-700 mt-1">
                {report.metrics.max_drawdown_percent.toFixed(2)}%
              </p>
              <span className="text-[10px] text-gray-600 font-mono">
                ₹{formatPrice(report.metrics.max_drawdown)}
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
              <span className="text-[11px] font-mono text-gray-500 block uppercase">Sharpe Ratio</span>
              <p className="text-base font-bold font-mono text-gray-900 mt-1">
                {report.metrics.sharpe_ratio.toFixed(2)}
              </p>
              <span className="text-[10px] text-gray-600 font-mono">Risk-Adjusted</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
              <span className="text-[11px] font-mono text-gray-500 block uppercase">Total Trades</span>
              <p className="text-base font-bold font-mono text-gray-900 mt-1">
                {report.metrics.total_trades}
              </p>
              <span className="text-[10px] text-gray-600 font-mono">Completed Roundtrips</span>
            </div>
          </div>

          {/* Equity Curve Table / Summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 font-mono flex items-center justify-between">
              <span>Simulated Portfolio Growth</span>
              <span className="text-xs text-gray-500 font-normal">
                Initial: ₹{formatPrice(report.metrics.initial_capital)} → Final: ₹{formatPrice(report.metrics.final_equity)}
              </span>
            </h3>

            {/* SVG Equity Curve visualization */}
            {report.equity_curve.length > 1 && (
              <div className="h-44 w-full bg-gray-50 rounded-lg p-3 relative flex items-end overflow-hidden border border-gray-200">
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
                  const strokeColor = isProfit ? '#059669' : '#DC2626';

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
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Trade Execution Ledger ({report.trades.length} Trades)</span>
              </h3>
              <span className="text-xs text-gray-600 font-mono">
                Quantity: {totalTradeQty} ({numLots} lots × {lotSize})
              </span>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-[11px] font-bold text-gray-700 uppercase tracking-wider bg-gray-50 sticky top-0">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Entry</th>
                    <th className="py-2.5 px-3">Exit</th>
                    <th className="py-2.5 px-3">Gross P&L</th>
                    <th className="py-2.5 px-3">Taxes & Charges</th>
                    <th className="py-2.5 px-3">Net P&L</th>
                    <th className="py-2.5 px-3">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                  {report.trades.map((t: TradeRecord) => (
                    <tr key={t.trade_id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-500">{t.trade_id}</td>
                      <td className="py-2 px-3 font-semibold text-blue-700">{t.direction}</td>
                      <td className="py-2 px-3 text-gray-900 font-bold">{t.quantity}</td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-gray-900">₹{formatPrice(t.entry_price)}</div>
                        <div className="text-[10px] text-gray-500">{t.entry_date.split('T')[0]}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-gray-900">₹{formatPrice(t.exit_price)}</div>
                        <div className="text-[10px] text-gray-500">{t.exit_date.split('T')[0]}</div>
                      </td>
                      <td className={`py-2 px-3 font-bold ${t.gross_pnl >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        ₹{formatPrice(t.gross_pnl)}
                      </td>
                      <td className="py-2 px-3 text-amber-800">
                        ₹{formatPrice(t.total_charges)}
                      </td>
                      <td className={`py-2 px-3 font-bold ${t.net_pnl >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        ₹{formatPrice(t.net_pnl)} ({t.net_return_pct >= 0 ? '+' : ''}{t.net_return_pct.toFixed(2)}%)
                      </td>
                      <td className="py-2 px-3 text-gray-600">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 text-[10px] font-semibold">
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
