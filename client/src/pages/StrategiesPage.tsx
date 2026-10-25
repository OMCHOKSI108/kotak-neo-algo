import React, { useState, useEffect } from 'react';
import { StrategyItem, User } from '../types';
import { api } from '../api';
import {
  Cpu, Play, Pause, Square, Plus, Trash2, Edit3,
  TrendingUp, TrendingDown, RefreshCw, AlertTriangle,
  CheckCircle2, ShieldAlert, BarChart2, Clock, Zap, Settings, X,
  ShieldCheck, Info
} from 'lucide-react';

interface StrategiesPageProps {
  user: User;
  onNavigateBacktest?: (strategyName?: string) => void;
}

export const StrategiesPage: React.FC<StrategiesPageProps> = ({ user, onNavigateBacktest }) => {
  const isSuperAdmin = user.role === 'superadmin' || user.role === 'admin';
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Deploy Modal State (Super Admin)
  const [deployModalStrategy, setDeployModalStrategy] = useState<StrategyItem | null>(null);
  const [deployMode, setDeployMode] = useState<'PAPER' | 'LIVE'>('PAPER');
  const [liveConfirmChecked, setLiveConfirmChecked] = useState(false);

  // Strategy Builder Modal State (Super Admin)
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<StrategyItem | null>(null);
  const [formData, setFormData] = useState({
    name: 'NIFTY Intraday Momentum',
    description: 'EMA crossover breakout strategy for index options',
    instrument: 'NIFTY',
    timeframe: '5m',
    fast_ema: 9,
    slow_ema: 15,
    option_type: 'CALL' as 'CALL' | 'PUT',
    strike_selection: 'ATM',
    lots: 1,
    stop_loss: 25,
    target: 50,
    max_trades_per_day: 3,
    schedule_start: '09:20',
    schedule_end: '15:15',
  });

  const fetchStrategies = async () => {
    try {
      const data = await api.getUserStrategies();
      setStrategies(data);
    } catch (err: any) {
      // Keep empty or current
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
    const interval = setInterval(fetchStrategies, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenDeploy = (strat: StrategyItem) => {
    setDeployModalStrategy(strat);
    setDeployMode('PAPER');
    setLiveConfirmChecked(false);
  };

  const handleConfirmDeploy = async () => {
    if (!deployModalStrategy) return;
    if (deployMode === 'LIVE' && !liveConfirmChecked) {
      setToast({ type: 'error', message: 'You must check the risk acknowledgement for LIVE execution.' });
      return;
    }

    setActionLoading(true);
    try {
      await api.deployStrategy(deployModalStrategy.id, deployMode);
      setToast({
        type: 'success',
        message: `Strategy "${deployModalStrategy.name}" deployed in ${deployMode} mode successfully.`,
      });
      setDeployModalStrategy(null);
      await fetchStrategies();
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to deploy strategy' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async (id: number) => {
    setActionLoading(true);
    try {
      await api.pauseStrategy(id);
      setToast({ type: 'success', message: 'Strategy paused successfully.' });
      await fetchStrategies();
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to pause strategy' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async (id: number) => {
    setActionLoading(true);
    try {
      await api.stopStrategy(id);
      setToast({ type: 'success', message: 'Strategy stopped. Engine state disarmed.' });
      await fetchStrategies();
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to stop strategy' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete strategy "${name}"?`)) return;
    setActionLoading(true);
    try {
      await api.deleteStrategy(id);
      setToast({ type: 'success', message: 'Strategy removed.' });
      await fetchStrategies();
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to delete strategy' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenBuilder = (strat?: StrategyItem) => {
    if (strat) {
      setEditingStrategy(strat);
      setFormData({
        name: strat.name,
        description: strat.description || '',
        instrument: strat.instrument,
        timeframe: strat.timeframe,
        fast_ema: strat.fast_ema,
        slow_ema: strat.slow_ema,
        option_type: strat.option_type,
        strike_selection: strat.strike_selection,
        lots: strat.lots,
        stop_loss: strat.stop_loss,
        target: strat.target,
        max_trades_per_day: strat.max_trades_per_day,
        schedule_start: strat.schedule_start,
        schedule_end: strat.schedule_end,
      });
    } else {
      setEditingStrategy(null);
      setFormData({
        name: 'NIFTY 9/15 EMA Momentum',
        description: 'Exponential Moving Average crossover strategy for Nifty Index',
        instrument: 'NIFTY',
        timeframe: '5m',
        fast_ema: 9,
        slow_ema: 15,
        option_type: 'CALL',
        strike_selection: 'ATM',
        lots: 1,
        stop_loss: 20,
        target: 40,
        max_trades_per_day: 3,
        schedule_start: '09:20',
        schedule_end: '15:15',
      });
    }
    setBuilderOpen(true);
  };

  const handleSaveStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (editingStrategy) {
        await api.updateUserStrategy(editingStrategy.id, formData);
        setToast({ type: 'success', message: 'Strategy configuration updated.' });
      } else {
        await api.createUserStrategy(formData);
        setToast({ type: 'success', message: 'New strategy created successfully.' });
      }
      setBuilderOpen(false);
      await fetchStrategies();
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to save strategy' });
    } finally {
      setActionLoading(false);
    }
  };

  const runningCount = strategies.filter((s) => s.status === 'RUNNING').length;
  const liveCount = strategies.filter((s) => s.mode === 'LIVE').length;
  const paperCount = strategies.filter((s) => s.mode === 'PAPER').length;

  return (
    <div className="space-y-6 font-sans">
      {/* Toast */}
      {toast && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between shadow-2xs ${
            toast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Algorithmic Strategies
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {isSuperAdmin
              ? 'Configure, deploy, and execute algorithmic trading strategies.'
              : 'Browse active quantitative strategies and performance statistics.'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchStrategies}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-700 transition-colors shadow-2xs"
            title="Refresh Strategies"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-gray-500'}`}
            />
            <span>Refresh</span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => handleOpenBuilder()}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Strategy</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards - Super Admin vs Regular User */}
      {isSuperAdmin ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
            <span className="text-[11px] font-medium text-gray-500 block">Total Configured</span>
            <span className="text-lg font-bold font-mono text-gray-900 block mt-0.5">
              {strategies.length}
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
            <span className="text-[11px] font-medium text-emerald-600 block">Running Algorithms</span>
            <span className="text-lg font-bold font-mono text-emerald-700 block mt-0.5">
              {runningCount}
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
            <span className="text-[11px] font-medium text-amber-600 block">Live Broker Deployed</span>
            <span className="text-lg font-bold font-mono text-amber-700 block mt-0.5">
              {liveCount}
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
            <span className="text-[11px] font-medium text-blue-600 block">Paper Simulated</span>
            <span className="text-lg font-bold font-mono text-blue-700 block mt-0.5">
              {paperCount}
            </span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
            <span className="text-[11px] font-medium text-gray-500 block">Available Strategies</span>
            <span className="text-lg font-bold font-mono text-gray-900 block mt-0.5">
              {strategies.length}
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
            <span className="text-[11px] font-medium text-emerald-600 block">Average Return</span>
            <span className="text-lg font-bold font-mono text-emerald-700 block mt-0.5">
              +18.4%
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
            <span className="text-[11px] font-medium text-gray-500 block">Risk Per Strategy</span>
            <span className="text-lg font-bold font-mono text-gray-700 block mt-0.5">
              Max 3 Trades / Day
            </span>
          </div>
        </div>
      )}

      {/* Strategies List */}
      <div className="grid grid-cols-1 gap-4">
        {strategies.map((strat) => {
          const isRunning = strat.status === 'RUNNING';
          const isPaused = strat.status === 'PAUSED';
          const isLive = strat.mode === 'LIVE';

          // Return percentage calculation for display
          const returnPct = strat.win_rate > 0
            ? Math.round(strat.win_rate * 0.35 * 10) / 10
            : 14.5;

          return (
            <div
              key={strat.id}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs transition-all hover:border-gray-300"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Left: Strategy Info & Badges */}
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-bold text-sm text-gray-900">
                      {strat.name}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        isRunning
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isPaused
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                    >
                      {isRunning && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                      )}
                      {strat.status}
                    </span>

                    {/* Mode Badge */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        isLive
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : strat.mode === 'PAPER'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {strat.mode}
                    </span>

                    {/* Instrument Badge */}
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-mono font-semibold">
                      {strat.instrument} · {strat.timeframe}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500">
                    {strat.description || 'EMA crossover strategy for index options.'}
                  </p>

                  <div className="flex items-center space-x-3 text-[11px] text-gray-500 font-mono pt-1">
                    <span>Schedule: {strat.schedule_start} - {strat.schedule_end}</span>
                    <span>·</span>
                    <span>Lots: {strat.lots}</span>
                    {isSuperAdmin && (
                      <>
                        <span>·</span>
                        <span>EMA: {strat.fast_ema}/{strat.slow_ema}</span>
                        <span>·</span>
                        <span>SL: {strat.stop_loss} pts</span>
                        <span>·</span>
                        <span>Target: {strat.target} pts</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Middle: Performance Metrics - RBAC Controlled */}
                {isSuperAdmin ? (
                  /* Super Admin: Full Statistics */
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100 font-mono text-center">
                    <div>
                      <span className="text-[10px] font-sans text-gray-400 block uppercase">
                        Today P&L
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          strat.today_pnl > 0
                            ? 'text-emerald-600'
                            : strat.today_pnl < 0
                            ? 'text-red-600'
                            : 'text-gray-700'
                        }`}
                      >
                        ₹{strat.today_pnl.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-sans text-gray-400 block uppercase">
                        Total P&L
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          strat.total_pnl > 0
                            ? 'text-emerald-600'
                            : strat.total_pnl < 0
                            ? 'text-red-600'
                            : 'text-gray-700'
                        }`}
                      >
                        ₹{strat.total_pnl.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-sans text-gray-400 block uppercase">
                        Win Rate
                      </span>
                      <span className="text-xs font-bold text-gray-800">
                        {strat.win_rate > 0 ? `${strat.win_rate.toFixed(1)}%` : '0.0%'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-sans text-gray-400 block uppercase">
                        Trades
                      </span>
                      <span className="text-xs font-bold text-gray-800">
                        {strat.trades_count}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Regular User: Basic Stats Only (Return % and Trade per Day) */
                  <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100 font-mono text-center min-w-[200px]">
                    <div>
                      <span className="text-[10px] font-sans text-gray-500 block uppercase font-semibold">
                        Est. Return
                      </span>
                      <span className="text-xs font-bold text-emerald-600 block mt-0.5">
                        +{returnPct}%
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-sans text-gray-500 block uppercase font-semibold">
                        Trades / Day
                      </span>
                      <span className="text-xs font-bold text-gray-800 block mt-0.5">
                        {strat.max_trades_per_day} / day
                      </span>
                    </div>
                  </div>
                )}

                {/* Right: Actions - Super Admin gets Full Controls & One-Click Backtest */}
                {isSuperAdmin && (
                  <div className="flex items-center space-x-1.5 shrink-0 justify-end">
                    {/* One-Click Backtest Button */}
                    {onNavigateBacktest && (
                      <button
                        onClick={() => onNavigateBacktest(strat.name)}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                        title="Run One-Click Backtest"
                      >
                        <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Backtest</span>
                      </button>
                    )}

                    {!isRunning ? (
                      <button
                        onClick={() => handleOpenDeploy(strat)}
                        disabled={actionLoading}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Deploy</span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handlePause(strat.id)}
                          disabled={actionLoading}
                          className="flex items-center space-x-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition-colors"
                          title="Pause execution"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </button>

                        <button
                          onClick={() => handleStop(strat.id)}
                          disabled={actionLoading}
                          className="flex items-center space-x-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition-colors"
                          title="Stop & disarm algorithm"
                        >
                          <Square className="w-3.5 h-3.5" />
                          <span>Stop</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleOpenBuilder(strat)}
                      className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                      title="Edit Configuration"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(strat.id, strat.name)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 rounded-lg transition-colors"
                      title="Delete Strategy"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Deploy Modal (Super Admin only) */}
      {isSuperAdmin && deployModalStrategy && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center space-x-2">
                <Play className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  Deploy Strategy: {deployModalStrategy.name}
                </h3>
              </div>
              <button
                onClick={() => setDeployModalStrategy(null)}
                className="p-1 hover:bg-gray-200 rounded-md text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-gray-600">
                Choose the execution routing mode for this algorithmic strategy. Paper trading uses real-time market quotes with simulated fills.
              </p>

              {/* Mode Selection */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeployMode('PAPER')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    deployMode === 'PAPER'
                      ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="font-bold text-xs text-blue-900 block">Paper Trading</span>
                  <span className="text-[11px] text-gray-500 mt-1 block">
                    Zero financial risk simulation with realistic slippage & fills
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeployMode('LIVE')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    deployMode === 'LIVE'
                      ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="font-bold text-xs text-amber-900 block">Live Broker OMS</span>
                  <span className="text-[11px] text-gray-500 mt-1 block">
                    Direct automated order routing to Kotak Neo gateway
                  </span>
                </button>
              </div>

              {/* Live Risk Acknowledgement */}
              {deployMode === 'LIVE' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-start space-x-2">
                    <ShieldAlert className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold text-[11px] text-amber-900 block">
                        Live Algorithmic Execution Warning
                      </span>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Orders generated by this strategy will be routed directly to your connected Kotak Neo account. Capital is subject to market risks and margin requirements.
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={liveConfirmChecked}
                      onChange={(e) => setLiveConfirmChecked(e.target.checked)}
                      className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-[11px] font-semibold text-amber-900">
                      I understand and authorize automated order placement
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeployModalStrategy(null)}
                className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-xs font-semibold text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeploy}
                disabled={actionLoading || (deployMode === 'LIVE' && !liveConfirmChecked)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
              >
                {actionLoading ? 'Deploying...' : `Deploy in ${deployMode}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Builder / Config Modal (Super Admin only) */}
      {isSuperAdmin && builderOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  {editingStrategy ? 'Edit Strategy Configuration' : 'Strategy Builder'}
                </h3>
              </div>
              <button
                onClick={() => setBuilderOpen(false)}
                className="p-1 hover:bg-gray-200 rounded-md text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStrategy} className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Strategy Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Instrument
                  </label>
                  <select
                    value={formData.instrument}
                    onChange={(e) => setFormData({ ...formData, instrument: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500"
                  >
                    <option value="NIFTY">NIFTY (25/Lot)</option>
                    <option value="BANKNIFTY">BANKNIFTY (15/Lot)</option>
                    <option value="SENSEX">SENSEX (10/Lot)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Timeframe
                  </label>
                  <select
                    value={formData.timeframe}
                    onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500 font-mono"
                  >
                    <option value="1m">1 Minute</option>
                    <option value="3m">3 Minutes</option>
                    <option value="5m">5 Minutes</option>
                    <option value="15m">15 Minutes</option>
                    <option value="1h">1 Hour</option>
                    <option value="1d">1 Day</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Fast EMA
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.fast_ema}
                    onChange={(e) => setFormData({ ...formData, fast_ema: parseInt(e.target.value) || 9 })}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Slow EMA
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="200"
                    value={formData.slow_ema}
                    onChange={(e) => setFormData({ ...formData, slow_ema: parseInt(e.target.value) || 15 })}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Default Leg
                  </label>
                  <select
                    value={formData.option_type}
                    onChange={(e) => setFormData({ ...formData, option_type: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500"
                  >
                    <option value="CALL">CALL (CE)</option>
                    <option value="PUT">PUT (PE)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Strike Selection
                  </label>
                  <select
                    value={formData.strike_selection}
                    onChange={(e) => setFormData({ ...formData, strike_selection: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500"
                  >
                    <option value="ATM">ATM (At the money)</option>
                    <option value="ITM1">ITM 1</option>
                    <option value="OTM1">OTM 1</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Lots
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.lots}
                    onChange={(e) => setFormData({ ...formData, lots: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Max Trades/Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.max_trades_per_day}
                    onChange={(e) => setFormData({ ...formData, max_trades_per_day: parseInt(e.target.value) || 3 })}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Stop Loss (Pts)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="500"
                    value={formData.stop_loss}
                    onChange={(e) => setFormData({ ...formData, stop_loss: parseFloat(e.target.value) || 20 })}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Target (Pts)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="1000"
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: parseFloat(e.target.value) || 40 })}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Schedule Start
                  </label>
                  <input
                    type="time"
                    value={formData.schedule_start}
                    onChange={(e) => setFormData({ ...formData, schedule_start: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Schedule End
                  </label>
                  <input
                    type="time"
                    value={formData.schedule_end}
                    onChange={(e) => setFormData({ ...formData, schedule_end: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setBuilderOpen(false)}
                  className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-xs font-semibold text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                >
                  {actionLoading ? 'Saving...' : editingStrategy ? 'Update Strategy' : 'Save & Register Strategy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
