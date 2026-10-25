import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  StrategyDefinition, BacktestReport, TradeRecord, BrokerProfile,
  BacktestDailyPnL, BacktestMonthlyPnL
} from '../types';
import {
  BarChart2, Play, Check, AlertCircle, Sliders,
  ArrowUpRight, ArrowDownRight, FileText, Wallet, Calendar,
  TrendingUp, TrendingDown, Clock, Zap, Layers, RefreshCw
} from 'lucide-react';

interface BacktestingLabProps {
  initialStrategy?: string;
}

export const BacktestingLab: React.FC<BacktestingLabProps> = ({ initialStrategy }) => {
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [datasets, setDatasets] = useState<string[]>(['NIFTY', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'TCS']);
  const [brokerProfile, setBrokerProfile] = useState<BrokerProfile | null>(null);

  // Form selections & Quick Bar
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('sma_crossover');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY');
  const [timeframe, setTimeframe] = useState<string>('1d');
  const [startDate, setStartDate] = useState<string>('2024-01-01');
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [capital, setCapital] = useState<number>(500000);
  const [lotSize, setLotSize] = useState<number>(25);
  const [numLots, setNumLots] = useState<number>(2);
  const [sizingMode, setSizingMode] = useState<'lots' | 'capital'>('lots');
  const [slippage, setSlippage] = useState<number>(0.05);
  const [brokerage, setBrokerage] = useState<number>(20);
  const [parameters, setParameters] = useState<Record<string, any>>({});

  // Active view tab for results (Stats, Monthly PnL, Daily PnL, Trade History)
  const [resultsTab, setResultsTab] = useState<'stats' | 'monthly' | 'daily' | 'trades'>('stats');

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
    return 1;
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [strats, dSets, profile] = await Promise.all([
          api.getStrategies(),
          api.getDatasets().catch(() => ['NIFTY', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'TCS']),
          api.getBrokerProfile().catch(() => null),
        ]);

        setStrategies(strats);
        if (dSets && dSets.length > 0) setDatasets(dSets);

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

  // Handle incoming initialStrategy param from StrategiesPage
  useEffect(() => {
    if (initialStrategy && strategies.length > 0) {
      const match = strategies.find(
        (s) =>
          s.id.toLowerCase() === initialStrategy.toLowerCase() ||
          s.name.toLowerCase().includes(initialStrategy.toLowerCase()) ||
          initialStrategy.toLowerCase().includes(s.id.toLowerCase())
      );
      if (match) {
        handleStrategyChange(match.id);
      }
    }
  }, [initialStrategy, strategies]);

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

  const executeBacktest = async (
    targetSymbol = selectedSymbol,
    targetTimeframe = timeframe,
    targetStartDate = startDate,
    targetEndDate = endDate
  ) => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.runBacktest({
        strategy_id: selectedStrategyId,
        symbol: targetSymbol,
        timeframe: targetTimeframe,
        start_date: targetStartDate || undefined,
        end_date: targetEndDate || undefined,
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
      setError(err.message || 'Backtest failed to execute.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeBacktest();
  };

  const formatPrice = (val?: number) => {
    if (val === undefined || val === null) return '--';
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalTradeQty = lotSize * numLots;
  const currentStrategy = strategies.find((s) => s.id === selectedStrategyId);

  // Quick Indexes for One-Click Backtest Bar
  const quickIndexes = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'TCS'];
  const quickTimeframes = [
    { label: '1 Min', value: '1m' },
    { label: '5 Min', value: '5m' },
    { label: '15 Min', value: '15m' },
    { label: '1 Hour', value: '1h' },
    { label: '1 Day', value: '1d' },
  ];

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Backtesting Lab
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Test algorithmic strategies on historical Indian market data with SEBI statutory charges & slippage.
          </p>
        </div>

        {/* Live Broker Margin Pill */}
        {brokerProfile && brokerProfile.available_margin > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-emerald-900">Margin:</span>
            <span className="font-mono font-bold text-gray-900">₹{formatPrice(brokerProfile.available_margin)}</span>
            <button
              type="button"
              onClick={handleUseBrokerBalance}
              className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors"
            >
              Use
            </button>
          </div>
        )}
      </div>

      {/* ONE-CLICK INSTANT BACKTEST BAR (SUPER ADMIN) */}
      <div className="bg-white border-2 border-blue-600/70 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                One-Click Quick Backtest
              </h2>
              <p className="text-[11px] text-gray-500">
                Select an index, timeframe, and date range to test instantly
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-semibold">
            {currentStrategy?.name || 'Selected Strategy'}
          </span>
        </div>

        {/* Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
          {/* Index Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Index / Underlying
            </label>
            <div className="flex items-center gap-1">
              {quickIndexes.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => handleSymbolChange(sym)}
                  className={`flex-1 py-1.5 text-[11px] font-mono font-bold rounded-lg border transition-all ${
                    selectedSymbol === sym
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {sym === 'BANKNIFTY' ? 'BNF' : sym}
                </button>
              ))}
            </div>
          </div>

          {/* Timeframe Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Timeframe
            </label>
            <div className="flex items-center gap-1">
              {quickTimeframes.map((tf) => (
                <button
                  key={tf.value}
                  type="button"
                  onClick={() => setTimeframe(tf.value)}
                  className={`flex-1 py-1.5 text-[11px] font-mono font-semibold rounded-lg border transition-all ${
                    timeframe === tf.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {tf.value}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range Inputs */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Date Range
            </label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-[11px] font-mono text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-[11px] font-mono text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Instant Execute Button */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => executeBacktest()}
              disabled={loading}
              className="w-full py-2 px-4 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Zap className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Simulating...' : '⚡ One-Click Backtest'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Strategy Selection Cards */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
          Strategy Models ({strategies.length})
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {strategies.map((strat) => {
            const isSelected = strat.id === selectedStrategyId;
            return (
              <div
                key={strat.id}
                onClick={() => handleStrategyChange(strat.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                  isSelected
                    ? 'bg-blue-50/60 border-blue-600 shadow-xs ring-1 ring-blue-500/20'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold text-gray-900">{strat.name}</h3>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-normal">{strat.description}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] font-mono text-gray-400">
                  <span>Asset: <span className="text-gray-700 font-semibold">{strat.default_symbol || 'NIFTY'}</span></span>
                  <span>Lot: <span className="text-blue-700 font-bold">{strat.default_lot_size || 1}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced Parameters Accordion / Form */}
      <form onSubmit={handleFormSubmit} className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Capital & Execution Parameters</h2>
            <p className="text-xs text-gray-500">Intraday margin requirements, slippage, and brokerage charges.</p>
          </div>
          <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200">
            Total Qty: {totalTradeQty} units
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Capital */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-700">
                Capital (₹)
              </label>
              {brokerProfile && (
                <button
                  type="button"
                  onClick={handleUseBrokerBalance}
                  className="text-[10px] text-blue-600 hover:underline font-semibold"
                >
                  Use Margin
                </button>
              )}
            </div>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              min={10000}
              step={5000}
              className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              required
            />
          </div>

          {/* Lot Size */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Lot Size
            </label>
            <input
              type="number"
              value={lotSize}
              onChange={(e) => setLotSize(Math.max(1, Number(e.target.value)))}
              min={1}
              step={1}
              className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              required
            />
          </div>

          {/* Number of Lots */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Number of Lots
            </label>
            <input
              type="number"
              value={numLots}
              onChange={(e) => setNumLots(Math.max(1, Number(e.target.value)))}
              min={1}
              step={1}
              className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              required
            />
          </div>

          {/* Brokerage Per Order */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Brokerage / Order (₹)
            </label>
            <input
              type="number"
              value={brokerage}
              onChange={(e) => setBrokerage(Number(e.target.value))}
              step={1}
              min={0}
              className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Dynamic Indicator Parameters */}
        {Object.keys(parameters).length > 0 && (
          <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
            <span className="text-xs font-bold text-gray-800">
              Indicator Inputs: {currentStrategy?.name}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(parameters).map(([key, val]) => (
                <div key={key}>
                  <label className="block text-[11px] text-gray-500 capitalize mb-0.5">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                    step={Number(val) % 1 !== 0 || Number(val) < 1 ? 0.01 : 1}
                    className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
          >
            <Play className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Running Simulation...' : 'Run Full Simulation'}</span>
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* BACKTEST REPORT & VISUALIZATIONS */}
      {report && (
        <div className="space-y-4">
          {/* Results Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setResultsTab('stats')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  resultsTab === 'stats'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Performance Stats
              </button>

              <button
                type="button"
                onClick={() => setResultsTab('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  resultsTab === 'monthly'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Monthly P&L Visualizer
              </button>

              <button
                type="button"
                onClick={() => setResultsTab('daily')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  resultsTab === 'daily'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Daily P&L Distribution
              </button>

              <button
                type="button"
                onClick={() => setResultsTab('trades')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  resultsTab === 'trades'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Trade Ledger ({report.trades.length})
              </button>
            </div>

            <span className="text-xs font-mono text-gray-500">
              {report.symbol} · {report.timeframe} · {report.trades.length} trades
            </span>
          </div>

          {/* Key Metrics Grid (Always Visible) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Net P&L</span>
              <p
                className={`text-sm font-bold font-mono mt-0.5 ${
                  report.metrics.net_pnl >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                ₹{formatPrice(report.metrics.net_pnl)}
              </p>
              <span className="text-[10px] text-gray-400 font-mono">
                {report.metrics.net_return_percent >= 0 ? '+' : ''}
                {report.metrics.net_return_percent.toFixed(2)}%
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Win Rate</span>
              <p className="text-sm font-bold font-mono text-gray-900 mt-0.5">
                {report.metrics.win_rate.toFixed(1)}%
              </p>
              <span className="text-[10px] text-gray-400 font-mono">
                {report.metrics.winning_trades}W / {report.metrics.losing_trades}L
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Profit Factor</span>
              <p className="text-sm font-bold font-mono text-gray-900 mt-0.5">
                {report.metrics.profit_factor.toFixed(2)}
              </p>
              <span className="text-[10px] text-gray-400 font-mono">Gross Gain/Loss</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Max Drawdown</span>
              <p className="text-sm font-bold font-mono text-red-700 mt-0.5">
                {report.metrics.max_drawdown_percent.toFixed(2)}%
              </p>
              <span className="text-[10px] text-gray-400 font-mono">
                ₹{formatPrice(report.metrics.max_drawdown)}
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Sharpe Ratio</span>
              <p className="text-sm font-bold font-mono text-gray-900 mt-0.5">
                {report.metrics.sharpe_ratio.toFixed(2)}
              </p>
              <span className="text-[10px] text-gray-400 font-mono">Risk-Adjusted</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Total Trades</span>
              <p className="text-sm font-bold font-mono text-gray-900 mt-0.5">
                {report.metrics.total_trades}
              </p>
              <span className="text-[10px] text-gray-400 font-mono">Avg ₹{formatPrice(report.metrics.avg_trade_pnl)}</span>
            </div>
          </div>

          {/* TAB 1: EQUITY CURVE & PERFORMANCE DETAILS */}
          {resultsTab === 'stats' && (
            <div className="space-y-4">
              {report.equity_curve.length > 1 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-xs">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-900">Capital Growth / Equity Curve</span>
                    <span className="font-mono text-gray-500">
                      ₹{formatPrice(report.metrics.initial_capital)} → ₹{formatPrice(report.metrics.final_equity)}
                    </span>
                  </div>

                  <div className="h-44 w-full bg-gray-50 rounded-lg p-2 relative flex items-end overflow-hidden border border-gray-100">
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
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MONTHLY PNL VISUALIZER */}
          {resultsTab === 'monthly' && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Monthly P&L Breakdown</h3>
                  <p className="text-xs text-gray-500">Distribution of trading profit and loss grouped by calendar month</p>
                </div>
              </div>

              {report.monthly_pnl && report.monthly_pnl.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {report.monthly_pnl.map((m: BacktestMonthlyPnL) => {
                    const isProfit = m.pnl >= 0;
                    return (
                      <div
                        key={m.month}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isProfit
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : 'bg-red-50/50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-gray-800">{m.month}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              isProfit ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {m.win_rate.toFixed(0)}% Win
                          </span>
                        </div>
                        <p
                          className={`text-base font-bold font-mono ${
                            isProfit ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {isProfit ? '+' : ''}₹{formatPrice(m.pnl)}
                        </p>
                        <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                          {m.trades} trades executed
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No monthly trades record available for this period.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DAILY PNL VISUALIZER */}
          {resultsTab === 'daily' && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Daily P&L Distribution</h3>
                  <p className="text-xs text-gray-500">Day-by-day trading performance and trade counts</p>
                </div>
              </div>

              {report.daily_pnl && report.daily_pnl.length > 0 ? (
                <div className="space-y-4">
                  {/* Summary bar */}
                  {(() => {
                    const greenDays = report.daily_pnl.filter((d) => d.pnl > 0).length;
                    const redDays = report.daily_pnl.filter((d) => d.pnl < 0).length;
                    const totalDays = report.daily_pnl.length;
                    const greenPct = totalDays > 0 ? ((greenDays / totalDays) * 100).toFixed(0) : '0';

                    return (
                      <div className="flex flex-wrap items-center gap-4 text-xs font-mono bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <span className="font-bold text-gray-900">Total Active Days: {totalDays}</span>
                        <span className="text-emerald-700 font-semibold">● {greenDays} Green Days ({greenPct}%)</span>
                        <span className="text-red-700 font-semibold">● {redDays} Red Days</span>
                      </div>
                    );
                  })()}

                  {/* Daily scroll list */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-96 overflow-y-auto p-1">
                    {report.daily_pnl.map((d: BacktestDailyPnL) => {
                      const isProfit = d.pnl >= 0;
                      return (
                        <div
                          key={d.date}
                          className={`p-2.5 rounded-lg border text-xs font-mono ${
                            isProfit
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : 'bg-red-50/40 border-red-200'
                          }`}
                        >
                          <div className="text-[10px] text-gray-500 font-sans">{d.date}</div>
                          <div
                            className={`font-bold mt-0.5 ${
                              isProfit ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {isProfit ? '+' : ''}₹{formatPrice(d.pnl)}
                          </div>
                          <div className="text-[10px] text-gray-400 font-sans">{d.trades} trades</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No daily trades record available for this period.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TRADE HISTORY LEDGER */}
          {resultsTab === 'trades' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-900 flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Execution Ledger ({report.trades.length} Orders)</span>
                </h3>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-600 uppercase tracking-wider bg-gray-50 sticky top-0">
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Symbol</th>
                      <th className="py-2 px-3">Direction</th>
                      <th className="py-2 px-3">Qty</th>
                      <th className="py-2 px-3">Entry</th>
                      <th className="py-2 px-3">Exit</th>
                      <th className="py-2 px-3">Gross</th>
                      <th className="py-2 px-3">Charges</th>
                      <th className="py-2 px-3">Net P&L</th>
                      <th className="py-2 px-3">Return</th>
                      <th className="py-2 px-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                    {report.trades.map((t: TradeRecord) => (
                      <tr key={t.trade_id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-400">{t.trade_id}</td>
                        <td className="py-2 px-3 font-semibold text-gray-800">{t.symbol || report.symbol}</td>
                        <td className="py-2 px-3 font-semibold text-blue-700">{t.direction}</td>
                        <td className="py-2 px-3 text-gray-900 font-bold">{t.quantity}</td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-gray-900">₹{formatPrice(t.entry_price)}</div>
                          <div className="text-[10px] text-gray-400 font-sans">{t.entry_date.split('T')[0]}</div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-gray-900">₹{formatPrice(t.exit_price)}</div>
                          <div className="text-[10px] text-gray-400 font-sans">{t.exit_date.split('T')[0]}</div>
                        </td>
                        <td className={`py-2 px-3 font-bold ${t.gross_pnl >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          ₹{formatPrice(t.gross_pnl)}
                        </td>
                        <td className="py-2 px-3 text-gray-500">
                          ₹{formatPrice(t.total_charges)}
                        </td>
                        <td className={`py-2 px-3 font-bold ${t.net_pnl >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          ₹{formatPrice(t.net_pnl)}
                        </td>
                        <td className={`py-2 px-3 font-bold ${t.net_return_pct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {t.net_return_pct >= 0 ? '+' : ''}{t.net_return_pct.toFixed(2)}%
                        </td>
                        <td className="py-2 px-3 text-gray-500 font-sans">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-medium">
                            {t.exit_reason}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
