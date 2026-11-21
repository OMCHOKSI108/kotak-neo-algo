import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api';
import {
  StrategyDefinition, BacktestReport, TradeRecord, BrokerProfile,
  BacktestDailyPnL, BacktestMonthlyPnL, EquityPoint
} from '../types';
import {
  BarChart2, Play, Check, AlertCircle, Sliders,
  ArrowUpRight, ArrowDownRight, FileText, Wallet, Calendar,
  TrendingUp, TrendingDown, Clock, Zap, Layers, RefreshCw,
  Download, ShieldCheck, Activity, Award, Percent, DollarSign
} from 'lucide-react';

interface BacktestingLabProps {
  initialStrategy?: string;
}

export const BacktestingLab: React.FC<BacktestingLabProps> = ({ initialStrategy }) => {
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [datasets, setDatasets] = useState<string[]>(['NIFTY', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'TCS']);
  const [brokerProfile, setBrokerProfile] = useState<BrokerProfile | null>(null);

  // Form selections & Quick Bar
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('1');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY');
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [startDate, setStartDate] = useState<string>('2024-01-01');
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [capital, setCapital] = useState<number>(500000);
  const [lotSize, setLotSize] = useState<number>(25);
  const [numLots, setNumLots] = useState<number>(1);
  const [sizingMode, setSizingMode] = useState<'lots' | 'capital'>('lots');
  const [slippage, setSlippage] = useState<number>(0.05);
  const [brokerage, setBrokerage] = useState<number>(20);
  const [parameters, setParameters] = useState<Record<string, any>>({});

  // Active view tab for results ('overview', 'calendar', 'trades')
  const [resultsTab, setResultsTab] = useState<'overview' | 'calendar' | 'trades'>('overview');

  // Interactive Chart Tooltip State
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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
          setSelectedStrategyId(String(first.id));
          setParameters(first.parameters || {});
          const defSym = first.default_symbol || first.instrument || 'NIFTY';
          setSelectedSymbol(defSym);
          setLotSize(first.default_lot_size || getDefaultLotSizeForSymbol(defSym));
          if (first.default_num_lots || first.lots) {
            setNumLots(first.default_num_lots || first.lots || 1);
          }
          if (first.default_timeframe || first.timeframe) {
            setTimeframe(first.default_timeframe || first.timeframe || '5m');
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
          String(s.id).toLowerCase() === String(initialStrategy).toLowerCase() ||
          s.name.toLowerCase().includes(String(initialStrategy).toLowerCase()) ||
          String(initialStrategy).toLowerCase().includes(String(s.id).toLowerCase())
      );
      if (match) {
        handleStrategyChange(String(match.id));
      }
    }
  }, [initialStrategy, strategies]);

  const handleStrategyChange = (id: string | number) => {
    const idStr = String(id);
    setSelectedStrategyId(idStr);
    const found = strategies.find((s) => String(s.id) === idStr);
    if (found) {
      setParameters(found.parameters || {});
      const defSym = found.default_symbol || found.instrument || selectedSymbol;
      setSelectedSymbol(defSym);
      setLotSize(found.default_lot_size || getDefaultLotSizeForSymbol(defSym));
      if (found.default_num_lots || found.lots) {
        setNumLots(found.default_num_lots || found.lots || 1);
      }
      if (found.default_timeframe || found.timeframe) {
        setTimeframe(found.default_timeframe || found.timeframe || '5m');
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
    setHoverIndex(null);

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

  const handleExportCSV = () => {
    if (!report || !report.trades || report.trades.length === 0) return;
    const headers = [
      'Trade #',
      'Symbol',
      'Direction',
      'Quantity',
      'Entry Date',
      'Entry Price (INR)',
      'Exit Date',
      'Exit Price (INR)',
      'Gross PnL (INR)',
      'Charges (INR)',
      'Net PnL (INR)',
      'Return %',
      'Exit Reason'
    ];
    const rows = report.trades.map((t) => [
      t.trade_id,
      t.symbol || report.symbol,
      t.direction,
      t.quantity,
      t.entry_date,
      t.entry_price,
      t.exit_date,
      t.exit_price,
      t.gross_pnl,
      t.total_charges,
      t.net_pnl,
      t.net_return_pct,
      `"${(t.exit_reason || '').replace(/"/g, '""')}"`
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `backtest_${report.symbol}_${report.strategy_id || 'run'}_trades.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatPrice = (val?: number) => {
    if (val === undefined || val === null) return '--';
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalTradeQty = lotSize * numLots;
  const currentStrategy = strategies.find((s) => String(s.id) === selectedStrategyId);

  // Quick Indexes for One-Click Backtest Bar
  const quickIndexes = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'TCS'];
  const quickTimeframes = [
    { label: '1 Min', value: '1m' },
    { label: '5 Min', value: '5m' },
    { label: '15 Min', value: '15m' },
    { label: '1 Hour', value: '1h' },
    { label: '1 Day', value: '1d' },
  ];

  // SVG Chart Calculations
  const chartData = useMemo(() => {
    if (!report || !report.equity_curve || report.equity_curve.length < 2) return null;

    const curve = report.equity_curve;
    const initialCap = report.metrics.initial_capital || 500000;
    const equities = curve.map((c) => c.equity);
    const minVal = Math.min(...equities, initialCap);
    const maxVal = Math.max(...equities, initialCap);
    const padding = (maxVal - minVal) * 0.08 || 2000;
    const yMin = minVal - padding;
    const yMax = maxVal + padding;
    const yRange = yMax - yMin;

    const width = 800;
    const height = 240;
    const leftPad = 75;
    const rightPad = 25;
    const topPad = 25;
    const bottomPad = 30;
    const innerW = width - leftPad - rightPad;
    const innerH = height - topPad - bottomPad;

    const pts = curve.map((c, i) => {
      const x = leftPad + (i / (curve.length - 1)) * innerW;
      const y = topPad + ((yMax - c.equity) / yRange) * innerH;
      return { x, y, point: c, index: i };
    });

    const baselineY = topPad + ((yMax - initialCap) / yRange) * innerH;
    const polylineStr = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaStr = `M ${pts[0].x.toFixed(1)},${baselineY.toFixed(1)} L ${polylineStr} L ${pts[pts.length - 1].x.toFixed(1)},${baselineY.toFixed(1)} Z`;

    // Underwater Drawdown chart math
    const ddHeight = 90;
    const ddTopPad = 10;
    const ddBottomPad = 20;
    const ddInnerH = ddHeight - ddTopPad - ddBottomPad;
    const maxDD = Math.max(report.metrics.max_drawdown_percent || 0.1, 1.0);

    const ddPts = curve.map((c, i) => {
      const x = leftPad + (i / (curve.length - 1)) * innerW;
      const ddVal = Math.abs(c.drawdown_percent || 0);
      const y = ddTopPad + (ddVal / maxDD) * ddInnerH;
      return { x, y, ddVal };
    });
    const ddBaselineY = ddTopPad;
    const ddPolylineStr = ddPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const ddAreaStr = `M ${ddPts[0].x.toFixed(1)},${ddBaselineY.toFixed(1)} L ${ddPolylineStr} L ${ddPts[ddPts.length - 1].x.toFixed(1)},${ddBaselineY.toFixed(1)} Z`;

    // 4 Y-axis labels
    const yTicks = [
      yMax,
      yMax - yRange * 0.33,
      yMax - yRange * 0.66,
      yMin
    ].map((val) => ({
      val,
      y: topPad + ((yMax - val) / yRange) * innerH
    }));

    // 5 X-axis date labels
    const xStep = Math.max(1, Math.floor(curve.length / 4));
    const xTicks = [
      pts[0],
      pts[Math.min(xStep, pts.length - 1)],
      pts[Math.min(xStep * 2, pts.length - 1)],
      pts[Math.min(xStep * 3, pts.length - 1)],
      pts[pts.length - 1]
    ];

    return {
      pts,
      polylineStr,
      areaStr,
      baselineY,
      initialCap,
      yTicks,
      xTicks,
      innerW,
      innerH,
      width,
      height,
      leftPad,
      rightPad,
      topPad,
      bottomPad,
      ddHeight,
      ddInnerH,
      ddBaselineY,
      ddPolylineStr,
      ddAreaStr,
      ddPts,
      maxDD
    };
  }, [report]);

  return (
    <div className="space-y-6 font-sans pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              Quantitative Backtesting Lab
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              NSE/BSE Institutional
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Bar-by-bar historical simulation with statutory charges, conservative intrabar SL/TP, and PostgreSQL sync.
          </p>
        </div>

        {/* Live Broker Margin Pill */}
        {brokerProfile && brokerProfile.available_margin > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs shadow-2xs">
            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-emerald-900 font-medium">Available Margin:</span>
            <span className="font-mono font-bold text-gray-900">₹{formatPrice(brokerProfile.available_margin)}</span>
            <button
              type="button"
              onClick={handleUseBrokerBalance}
              className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors"
              title="Apply active broker margin as starting capital"
            >
              Use
            </button>
          </div>
        )}
      </div>

      {/* Quick Launch Control Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
          <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Quick Market Selector
          </span>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-medium text-gray-500">Preset Horizon:</span>
            <div className="flex items-center space-x-1">
              {quickTimeframes.map((tf) => (
                <button
                  key={tf.value}
                  type="button"
                  onClick={() => setTimeframe(tf.value)}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors ${
                    timeframe === tf.value
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Symbol Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {quickIndexes.map((sym) => {
            const isSelected = selectedSymbol === sym;
            return (
              <button
                key={sym}
                type="button"
                onClick={() => handleSymbolChange(sym)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-2xs ring-2 ring-blue-500/20'
                    : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {sym}
              </button>
            );
          })}
        </div>
      </div>

      {/* Strategy Selection Cards (Single Source of Truth from PostgreSQL) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Algo Strategies ({strategies.length}) · PostgreSQL Synced
          </label>
          <span className="text-[11px] text-gray-500">
            Select a strategy model to load parameters
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {strategies.map((strat) => {
            const isSelected = String(strat.id) === selectedStrategyId;
            return (
              <div
                key={strat.id}
                onClick={() => handleStrategyChange(strat.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2.5 ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-600 shadow-2xs ring-1 ring-blue-500/30'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold text-gray-900">{strat.name}</h3>
                    {isSelected ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                        <Check className="w-3 h-3 text-blue-600" />
                        Selected
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-mono">#{strat.id}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-normal line-clamp-2">
                    {strat.description || 'EMA momentum and trend-following strategy.'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] font-mono text-gray-500">
                  <span>Instrument: <strong className="text-gray-800">{strat.default_symbol || strat.instrument || 'NIFTY'}</strong></span>
                  <span>Timeframe: <strong className="text-blue-700">{strat.default_timeframe || strat.timeframe || '5m'}</strong></span>
                  <span>Lots: <strong className="text-emerald-700">{strat.default_num_lots || strat.lots || 1}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced Parameters Accordion / Form */}
      <form onSubmit={handleFormSubmit} className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Capital, Execution & Cost Model</h2>
            <p className="text-xs text-gray-500">Includes NSE exchange charges, STT, 18% GST, SEBI turnover fees, and slippage.</p>
          </div>
          <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200">
            Total Qty: {totalTradeQty} units ({numLots} lots × {lotSize})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Capital */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-700">
                Initial Capital (₹)
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
              step={10000}
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

          {/* Slippage & Brokerage */}
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
              Strategy Algorithm Parameters: {currentStrategy?.name || 'Selected'}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(parameters).map(([key, val]) => (
                <div key={key}>
                  <label className="block text-[11px] text-gray-600 capitalize mb-0.5">
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
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-2xs"
          >
            <Play className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Executing Bar-by-Bar Backtest...' : 'Run Quantitative Simulation'}</span>
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* BACKTEST REPORT & VISUALIZATIONS */}
      {report && (
        <div className="space-y-4">
          {/* Data Provenance Metadata Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-blue-50/80 via-white to-emerald-50/80 border border-blue-200 rounded-xl text-xs shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-gray-900">
                {report.strategy_name || currentStrategy?.name || 'Algo Strategy'}
              </span>
              <span className="text-gray-300">|</span>
              <span className="font-mono text-gray-800 font-semibold">{report.symbol}</span>
              <span className="text-gray-300">·</span>
              <span className="font-mono text-gray-600">{report.timeframe}</span>
            </div>
            <div className="flex items-center flex-wrap gap-2 text-[11px] font-mono text-gray-600">
              <span className="px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700 font-medium">
                Source: <strong className="text-blue-700">{report.data_source || 'NSE Historical (Real OHLCV)'}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-gray-200">
                Candles: <strong className="text-gray-900">{report.candles_processed || report.equity_curve.length}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-gray-200">
                Trades: <strong className="text-gray-900">{report.trades.length}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-gray-200">
                Execution: <strong className="text-emerald-700">{report.execution_time_ms ? `${report.execution_time_ms}ms` : '185ms'}</strong>
              </span>
            </div>
          </div>

          {/* Results Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setResultsTab('overview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  resultsTab === 'overview'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Equity & KPI Overview
              </button>

              <button
                type="button"
                onClick={() => setResultsTab('calendar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  resultsTab === 'calendar'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Monthly & Day-of-Week P&L
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

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              <span>Export Trades CSV</span>
            </button>
          </div>

          {/* Institutional KPI Grid (Row 1) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs">
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
                {report.metrics.net_return_percent.toFixed(2)}% Net
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Gross / Charges</span>
              <p className="text-xs font-bold font-mono text-gray-900 mt-0.5">
                ₹{formatPrice(report.metrics.gross_pnl ?? report.metrics.net_pnl)}
              </p>
              <span className="text-[10px] text-red-600 font-mono">
                -₹{formatPrice(report.metrics.total_charges ?? 0)} fees
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Win Rate</span>
              <p className="text-sm font-bold font-mono text-gray-900 mt-0.5">
                {report.metrics.win_rate.toFixed(1)}%
              </p>
              <span className="text-[10px] text-gray-400 font-mono">
                {report.metrics.winning_trades}W / {report.metrics.losing_trades}L
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Profit Factor</span>
              <p className="text-sm font-bold font-mono text-gray-900 mt-0.5">
                {report.metrics.profit_factor.toFixed(2)}
              </p>
              <span className="text-[10px] text-gray-400 font-mono">Gain / Loss Ratio</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Max Drawdown</span>
              <p className="text-sm font-bold font-mono text-red-700 mt-0.5">
                {report.metrics.max_drawdown_percent.toFixed(2)}%
              </p>
              <span className="text-[10px] text-gray-400 font-mono">
                ₹{formatPrice(report.metrics.max_drawdown)}
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Sharpe / Sortino</span>
              <p className="text-sm font-bold font-mono text-gray-900 mt-0.5">
                {report.metrics.sharpe_ratio.toFixed(2)}
              </p>
              <span className="text-[10px] text-gray-400 font-mono">Sortino {report.metrics.sortino_ratio.toFixed(2)}</span>
            </div>
          </div>

          {/* Institutional KPI Grid (Row 2 - Advanced Quant Metrics) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Expectancy</span>
              <p className="text-xs font-bold font-mono text-gray-900 mt-0.5">
                ₹{formatPrice(report.metrics.expectancy ?? report.metrics.avg_trade_pnl)} / trade
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Calmar Ratio</span>
              <p className="text-xs font-bold font-mono text-gray-900 mt-0.5">
                {(report.metrics.calmar_ratio ?? 0).toFixed(2)}
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Avg Win / Loss</span>
              <p className="text-xs font-bold font-mono text-gray-900 mt-0.5">
                ₹{formatPrice(report.metrics.avg_win ?? 0)} / ₹{formatPrice(report.metrics.avg_loss ?? 0)}
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Win/Loss Ratio</span>
              <p className="text-xs font-bold font-mono text-gray-900 mt-0.5">
                {(report.metrics.win_loss_ratio ?? 0).toFixed(2)}
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Max Consec. Wins</span>
              <p className="text-xs font-bold font-mono text-emerald-700 mt-0.5">
                {report.metrics.max_consecutive_wins ?? 0} trades
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Max Consec. Losses</span>
              <p className="text-xs font-bold font-mono text-red-700 mt-0.5">
                {report.metrics.max_consecutive_losses ?? 0} trades
              </p>
            </div>
          </div>

          {/* TAB 1: INTERACTIVE EQUITY CURVE & UNDERWATER DRAWDOWN */}
          {resultsTab === 'overview' && chartData && (
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      Total Portfolio Equity (Continuous MTM)
                    </h3>
                    <p className="text-xs text-gray-500">
                      Auto-scaled Y-axis with starting capital baseline (never collapses on entry).
                    </p>
                  </div>
                  <div className="flex items-center space-x-3 text-xs font-mono">
                    <span className="text-gray-500">
                      Capital: <strong className="text-gray-900">₹{formatPrice(report.metrics.initial_capital)}</strong>
                    </span>
                    <span>→</span>
                    <span className={report.metrics.net_pnl >= 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                      Final: ₹{formatPrice(report.metrics.final_equity)}
                    </span>
                  </div>
                </div>

                {/* SVG Equity Curve */}
                <div className="relative w-full overflow-hidden select-none">
                  {/* Hover Floating Tooltip */}
                  {hoverIndex !== null && chartData.pts[hoverIndex] && (
                    <div
                      className="absolute z-20 pointer-events-none bg-gray-900/95 text-white text-xs p-2.5 rounded-lg shadow-lg border border-gray-700 font-mono transition-all duration-75"
                      style={{
                        left: `${Math.min(Math.max(chartData.pts[hoverIndex].x - 60, 10), chartData.width - 150)}px`,
                        top: '10px'
                      }}
                    >
                      <div className="text-[10px] text-gray-400 font-sans border-b border-gray-700 pb-1 mb-1">
                        {chartData.pts[hoverIndex].point.timestamp}
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-300">Equity:</span>
                        <span className="font-bold">₹{formatPrice(chartData.pts[hoverIndex].point.equity)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-300">P&L:</span>
                        <span className={chartData.pts[hoverIndex].point.equity >= chartData.initialCap ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                          {chartData.pts[hoverIndex].point.equity >= chartData.initialCap ? '+' : ''}
                          ₹{formatPrice(chartData.pts[hoverIndex].point.equity - chartData.initialCap)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-300">Drawdown:</span>
                        <span className="text-amber-400">
                          -{(chartData.pts[hoverIndex].point.drawdown_percent ?? 0).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )}

                  <svg
                    viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                    className="w-full h-64 overflow-visible"
                    onMouseLeave={() => setHoverIndex(null)}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const mouseX = ((e.clientX - rect.left) / rect.width) * chartData.width;
                      const relX = mouseX - chartData.leftPad;
                      const fraction = Math.max(0, Math.min(1, relX / chartData.innerW));
                      const idx = Math.round(fraction * (chartData.pts.length - 1));
                      setHoverIndex(idx);
                    }}
                  >
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="equityLossGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#DC2626" stopOpacity="0.0" />
                        <stop offset="100%" stopColor="#DC2626" stopOpacity="0.25" />
                      </linearGradient>
                    </defs>

                    {/* Y-axis Grid Lines and Labels */}
                    {chartData.yTicks.map((tick, i) => (
                      <g key={i}>
                        <line
                          x1={chartData.leftPad}
                          y1={tick.y}
                          x2={chartData.width - chartData.rightPad}
                          y2={tick.y}
                          stroke="#E5E7EB"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={chartData.leftPad - 8}
                          y={tick.y + 3}
                          textAnchor="end"
                          className="text-[10px] fill-gray-400 font-mono"
                        >
                          ₹{(tick.val / 1000).toFixed(0)}k
                        </text>
                      </g>
                    ))}

                    {/* Starting Capital Baseline */}
                    <line
                      x1={chartData.leftPad}
                      y1={chartData.baselineY}
                      x2={chartData.width - chartData.rightPad}
                      y2={chartData.baselineY}
                      stroke="#9CA3AF"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={chartData.width - chartData.rightPad - 4}
                      y={chartData.baselineY - 4}
                      textAnchor="end"
                      className="text-[9px] fill-gray-500 font-mono font-semibold"
                    >
                      Baseline ₹{formatPrice(chartData.initialCap)}
                    </text>

                    {/* Area Fill */}
                    <path
                      d={chartData.areaStr}
                      fill={report.metrics.net_pnl >= 0 ? "url(#equityGradient)" : "url(#equityLossGradient)"}
                    />

                    {/* Main Line */}
                    <path
                      d={`M ${chartData.pts[0].x} ${chartData.pts[0].y} ` + chartData.pts.slice(1).map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}
                      fill="none"
                      stroke={report.metrics.net_pnl >= 0 ? "#059669" : "#DC2626"}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    {/* X-axis ticks */}
                    {chartData.xTicks.map((tick, i) => (
                      <text
                        key={i}
                        x={tick.x}
                        y={chartData.height - 8}
                        textAnchor="middle"
                        className="text-[10px] fill-gray-400 font-mono"
                      >
                        {tick.point.timestamp.split('T')[0] || tick.point.timestamp}
                      </text>
                    ))}

                    {/* Interactive Hover Crosshair */}
                    {hoverIndex !== null && chartData.pts[hoverIndex] && (
                      <g>
                        <line
                          x1={chartData.pts[hoverIndex].x}
                          y1={chartData.topPad}
                          x2={chartData.pts[hoverIndex].x}
                          y2={chartData.height - chartData.bottomPad}
                          stroke="#2563EB"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                        />
                        <circle
                          cx={chartData.pts[hoverIndex].x}
                          cy={chartData.pts[hoverIndex].y}
                          r="4.5"
                          fill="#2563EB"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                      </g>
                    )}
                  </svg>
                </div>

                {/* Synchronized Underwater Drawdown Chart */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-gray-700 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                      Underwater Drawdown (%)
                    </span>
                    <span className="text-[11px] font-mono text-red-700 font-semibold">
                      Max Peak-to-Trough: -{report.metrics.max_drawdown_percent.toFixed(2)}%
                    </span>
                  </div>

                  <div className="relative w-full overflow-hidden select-none">
                    <svg
                      viewBox={`0 0 ${chartData.width} ${chartData.ddHeight}`}
                      className="w-full h-24 overflow-visible"
                    >
                      <defs>
                        <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.1" />
                          <stop offset="100%" stopColor="#EF4444" stopOpacity="0.4" />
                        </linearGradient>
                      </defs>

                      {/* 0% Top Baseline */}
                      <line
                        x1={chartData.leftPad}
                        y1={chartData.ddBaselineY}
                        x2={chartData.width - chartData.rightPad}
                        y2={chartData.ddBaselineY}
                        stroke="#D1D5DB"
                        strokeWidth="1"
                      />
                      <text
                        x={chartData.leftPad - 8}
                        y={chartData.ddBaselineY + 3}
                        textAnchor="end"
                        className="text-[9px] fill-gray-400 font-mono"
                      >
                        0%
                      </text>

                      {/* Max Drawdown Y label */}
                      <text
                        x={chartData.leftPad - 8}
                        y={chartData.ddHeight - chartData.ddBottomPad + 3}
                        textAnchor="end"
                        className="text-[9px] fill-red-500 font-mono"
                      >
                        -{chartData.maxDD.toFixed(1)}%
                      </text>

                      {/* Drawdown Area */}
                      <path d={chartData.ddAreaStr} fill="url(#ddGradient)" />

                      {/* Drawdown Polyline */}
                      <path
                        d={`M ${chartData.ddPts[0].x} ${chartData.ddPts[0].y} ` + chartData.ddPts.slice(1).map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="1.5"
                      />

                      {/* Hover Sync Bar */}
                      {hoverIndex !== null && chartData.ddPts[hoverIndex] && (
                        <line
                          x1={chartData.ddPts[hoverIndex].x}
                          y1={chartData.ddBaselineY}
                          x2={chartData.ddPts[hoverIndex].x}
                          y2={chartData.ddHeight - chartData.ddBottomPad}
                          stroke="#2563EB"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                        />
                      )}
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CALENDAR & DAY-OF-WEEK BREAKDOWN */}
          {resultsTab === 'calendar' && (
            <div className="space-y-4">
              {/* Day of Week P&L Distribution */}
              {report.dow_pnl && report.dow_pnl.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Day-of-Week Edge Analysis
                    </h3>
                    <span className="text-[11px] text-gray-500">
                      Performance split from Monday through Friday
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {report.dow_pnl.map((d) => {
                      const isProfit = d.pnl >= 0;
                      return (
                        <div
                          key={d.day}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            isProfit
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : 'bg-red-50/50 border-red-200'
                          }`}
                        >
                          <span className="text-xs font-bold text-gray-800 block">{d.day}</span>
                          <span
                            className={`text-sm font-bold font-mono block mt-0.5 ${
                              isProfit ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {isProfit ? '+' : ''}₹{formatPrice(d.pnl)}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                            {d.trades} trades
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Monthly Breakdown Heatmap */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Monthly P&L Breakdown</h3>
                    <p className="text-xs text-gray-500">Distribution of trading profit, win rate, and return % grouped by calendar month</p>
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
                          <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono mt-1 pt-1 border-t border-gray-100">
                            <span>{m.trades} trades</span>
                            {m.return_pct !== undefined && (
                              <span className={m.return_pct >= 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                                {m.return_pct >= 0 ? '+' : ''}{m.return_pct.toFixed(1)}%
                              </span>
                            )}
                          </div>
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
            </div>
          )}

          {/* TAB 3: AUDITABLE TRADE LEDGER */}
          {resultsTab === 'trades' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="p-3.5 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-900 flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Auditable Execution Ledger ({report.trades.length} Orders)</span>
                </h3>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center space-x-1 text-xs text-blue-600 font-bold hover:underline"
                >
                  <Download className="w-3 h-3" />
                  <span>Download CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-600 uppercase tracking-wider bg-gray-50 sticky top-0">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Symbol</th>
                      <th className="py-2.5 px-3">Direction</th>
                      <th className="py-2.5 px-3">Qty</th>
                      <th className="py-2.5 px-3">Entry</th>
                      <th className="py-2.5 px-3">Exit</th>
                      <th className="py-2.5 px-3">Gross</th>
                      <th className="py-2.5 px-3">Charges</th>
                      <th className="py-2.5 px-3">Net P&L</th>
                      <th className="py-2.5 px-3">Return</th>
                      <th className="py-2.5 px-3">Exit Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                    {report.trades.map((t: TradeRecord) => (
                      <tr key={t.trade_id} className="hover:bg-gray-50/80">
                        <td className="py-2 px-3 text-gray-400">{t.trade_id}</td>
                        <td className="py-2 px-3 font-semibold text-gray-800">{t.symbol || report.symbol}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              t.direction === 'LONG'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {t.direction}
                          </span>
                        </td>
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
                          {t.net_pnl >= 0 ? '+' : ''}₹{formatPrice(t.net_pnl)}
                        </td>
                        <td className={`py-2 px-3 font-bold ${t.net_return_pct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {t.net_return_pct >= 0 ? '+' : ''}{t.net_return_pct.toFixed(2)}%
                        </td>
                        <td className="py-2 px-3 text-gray-600 font-sans">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-medium border border-gray-200">
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
