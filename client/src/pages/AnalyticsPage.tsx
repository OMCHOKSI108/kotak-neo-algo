import React, { useState, useEffect } from 'react';
import { AnalyticsSummary, User } from '../types';
import { api } from '../api';
import {
  TrendingUp, TrendingDown, RefreshCw, BarChart2,
  Calendar, Award, AlertTriangle, ShieldCheck, ArrowUpRight, ArrowDownRight,
  PieChart, Activity, Info
} from 'lucide-react';

interface AnalyticsPageProps {
  user: User;
  onNavigateTrader?: () => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ user, onNavigateTrader }) => {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('today');

  const fetchAnalytics = async (selectedPeriod: string) => {
    setLoading(true);
    try {
      const res = await api.getAnalytics(selectedPeriod);
      setData(res);
    } catch (err) {
      // Keep state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(period);
  }, [period]);

  const periods = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: 'all', label: 'All Time' },
  ];

  // Helper to render SVG Equity Curve
  const renderEquityCurve = (curve: { timestamp: string; pnl: number }[]) => {
    if (!curve || curve.length === 0) {
      return (
        <div className="h-48 flex items-center justify-center text-xs text-gray-400">
          No equity progression data available for this timeframe
        </div>
      );
    }

    const minPnl = Math.min(0, ...curve.map(c => c.pnl));
    const maxPnl = Math.max(0, ...curve.map(c => c.pnl));
    const range = (maxPnl - minPnl) || 1;
    const width = 600;
    const height = 180;
    const padding = 20;

    const points = curve.map((pt, idx) => {
      const x = padding + (idx / Math.max(1, curve.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((pt.pnl - minPnl) / range) * (height - 2 * padding);
      return `${x},${y}`;
    }).join(' ');

    const zeroY = height - padding - ((0 - minPnl) / range) * (height - 2 * padding);

    return (
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 overflow-visible">
          {/* Zero baseline */}
          <line
            x1={padding}
            y1={zeroY}
            x2={width - padding}
            y2={zeroY}
            stroke="#E2E8F0"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />

          {/* Polyline */}
          <polyline
            fill="none"
            stroke={curve[curve.length - 1]?.pnl >= 0 ? '#10B981' : '#EF4444'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Dots */}
          {curve.map((pt, idx) => {
            const x = padding + (idx / Math.max(1, curve.length - 1)) * (width - 2 * padding);
            const y = height - padding - ((pt.pnl - minPnl) / range) * (height - 2 * padding);
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r="3"
                className={pt.pnl >= 0 ? 'fill-emerald-500' : 'fill-red-500'}
              />
            );
          })}
        </svg>

        {/* Labels */}
        <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1 px-2">
          <span>{curve[0]?.timestamp.split('T')[0] || 'Start'}</span>
          <span>{curve[curve.length - 1]?.timestamp.split('T')[0] || 'End'}</span>
        </div>
      </div>
    );
  };

  // Helper to render Daily P&L Bars
  const renderDailyBars = (daily: { date: string; pnl: number }[]) => {
    if (!daily || daily.length === 0) {
      return (
        <div className="h-48 flex items-center justify-center text-xs text-gray-400">
          No daily settlement records found for this period
        </div>
      );
    }

    const maxAbs = Math.max(1, ...daily.map(d => Math.abs(d.pnl)));

    return (
      <div className="h-48 flex items-end justify-between gap-1 pt-6 px-2">
        {daily.map((day, idx) => {
          const isProfitable = day.pnl >= 0;
          const heightPct = Math.max(8, (Math.abs(day.pnl) / maxAbs) * 100);

          return (
            <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
              {/* Tooltip on hover */}
              <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded font-mono pointer-events-none whitespace-nowrap z-10">
                {day.date}: ₹{day.pnl.toFixed(2)}
              </div>

              {/* Bar */}
              <div
                style={{ height: `${heightPct}%` }}
                className={`w-full max-w-[28px] rounded-t-sm transition-all ${
                  isProfitable ? 'bg-emerald-500 group-hover:bg-emerald-600' : 'bg-red-500 group-hover:bg-red-600'
                }`}
              />

              {/* Label */}
              <span className="text-[9px] text-gray-400 font-mono mt-1 rotate-45 sm:rotate-0 origin-left">
                {day.date.split('-').slice(1).join('/')}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Performance Analytics
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Verified execution metrics and returns computed from closed trades
          </p>
        </div>

        {/* Period Selector & Refresh */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-xs font-semibold">
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  period === p.id
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchAnalytics(period)}
            className="p-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors shadow-2xs"
            title="Refresh Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Net P&L */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-medium text-gray-500 block">Net Realized P&L</span>
          <span
            className={`text-xl font-bold font-mono block mt-0.5 ${
              (data?.net_pnl || 0) > 0
                ? 'text-emerald-600'
                : (data?.net_pnl || 0) < 0
                ? 'text-red-600'
                : 'text-gray-900'
            }`}
          >
            ₹{(data?.net_pnl || 0).toFixed(2)}
          </span>
          <span className="text-[10px] text-gray-400 mt-1 block">
            Gross: ₹{(data?.gross_profit || 0).toFixed(2)}
          </span>
        </div>

        {/* Win Rate */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-gray-500 block">Win Rate</span>
          <span className="text-xl font-bold font-mono text-gray-900 block mt-0.5">
            {(data?.win_rate || 0).toFixed(1)}%
          </span>
          <span className="text-[10px] text-gray-400 mt-1 block">
            {data?.winning_trades || 0}W / {data?.losing_trades || 0}L
          </span>
        </div>

        {/* Profit Factor */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-gray-500 block">Profit Factor</span>
          <span className="text-xl font-bold font-mono text-gray-900 block mt-0.5">
            {(data?.profit_factor || 0).toFixed(2)}
          </span>
          <span className="text-[10px] text-gray-400 mt-1 block">
            Loss: ₹{Math.abs(data?.gross_loss || 0).toFixed(2)}
          </span>
        </div>

        {/* Max Drawdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-gray-500 block">Max Drawdown</span>
          <span className="text-xl font-bold font-mono text-red-600 block mt-0.5">
            {(data?.max_drawdown || 0).toFixed(1)}%
          </span>
          <span className="text-[10px] text-gray-400 mt-1 block">
            Peak to trough
          </span>
        </div>

        {/* Total Trades */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-gray-500 block">Total Trades</span>
          <span className="text-xl font-bold font-mono text-gray-900 block mt-0.5">
            {data?.total_trades || 0}
          </span>
          <span className="text-[10px] text-gray-400 mt-1 block">
            Avg: ₹{(data?.avg_trade_pnl || 0).toFixed(1)}
          </span>
        </div>

        {/* Best / Worst Day */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-gray-500 block">Best / Worst Day</span>
          <div className="flex items-center space-x-2 mt-0.5">
            <span className="text-xs font-bold font-mono text-emerald-600">
              +₹{(data?.best_day || 0).toFixed(0)}
            </span>
            <span className="text-gray-300">/</span>
            <span className="text-xs font-bold font-mono text-red-600">
              ₹{(data?.worst_day || 0).toFixed(0)}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 mt-1 block font-mono">
            Daily range
          </span>
        </div>
      </div>

      {/* Visual Charts: Equity Curve & Daily P&L */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Equity Curve Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-gray-900">
                Cumulative Equity Curve
              </h2>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">
              Net Returns
            </span>
          </div>

          {renderEquityCurve(data?.equity_curve || [])}
        </div>

        {/* Daily P&L Bars */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <BarChart2 className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-bold text-gray-900">
                Daily P&L Distribution
              </h2>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">
              Settled Days
            </span>
          </div>

          {renderDailyBars(data?.daily_pnl || [])}
        </div>
      </div>

      {/* Strategy Performance Breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900">
              Strategy Performance Breakdown
            </h2>
          </div>
          <span className="text-[11px] text-gray-400 font-mono">
            {(data?.strategy_breakdown || []).length} Strategies tracked
          </span>
        </div>

        {(!data?.strategy_breakdown || data.strategy_breakdown.length === 0) ? (
          <div className="p-8 text-center text-xs text-gray-400">
            <Info className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            No strategy-specific trades recorded for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold">
                  <th className="py-2.5 px-4">Strategy</th>
                  <th className="py-2.5 px-4 text-right">Trades Executed</th>
                  <th className="py-2.5 px-4 text-right">Win Rate</th>
                  <th className="py-2.5 px-4 text-right">Net Realized P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {data.strategy_breakdown.map((strat, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-900 font-sans">
                      {strat.strategy}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      {strat.trades}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      {strat.win_rate > 0 ? `${strat.win_rate.toFixed(1)}%` : '0.0%'}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-bold ${
                        strat.pnl > 0
                          ? 'text-emerald-600'
                          : strat.pnl < 0
                          ? 'text-red-600'
                          : 'text-gray-900'
                      }`}
                    >
                      ₹{strat.pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notice on Real Data Integrity */}
      <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl flex items-start space-x-2.5 text-xs text-blue-900">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <span className="font-bold">Real Trading Terminal Data Integrity</span>
          <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
            All metrics above are calculated directly from verified database trade records. In accordance with platform integrity rules, zero demo or simulated values are fabricated. When you place trades through the terminal or run automated strategies, every entry, exit, and charge is accounted for here.
          </p>
        </div>
      </div>
    </div>
  );
};
