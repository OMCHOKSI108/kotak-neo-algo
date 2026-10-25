import React, { useState, useEffect } from 'react';
import { TraderPositionItem, TraderPositionsSummary, User } from '../types';
import { api } from '../api';
import {
  Briefcase, TrendingUp, TrendingDown, RefreshCw,
  AlertTriangle, CheckCircle2, ShieldAlert
} from 'lucide-react';

interface PositionsPageProps {
  user: User;
  onNavigateTrader?: (symbol: string) => void;
}

export const PositionsPage: React.FC<PositionsPageProps> = ({ user, onNavigateTrader }) => {
  const [data, setData] = useState<TraderPositionsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showSquareOffAllModal, setShowSquareOffAllModal] = useState(false);

  const fetchPositions = async () => {
    try {
      const res = await api.getTraderPositions();
      setData(res);
    } catch (err: any) {
      // Keep empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSquareOffSingle = async (posId: number, symbol: string) => {
    setActionLoading(true);
    try {
      const res = await api.squareOffPosition(posId);
      setToast({ type: 'success', message: res.message });
      await fetchPositions();
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Square off failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSquareOffAll = async () => {
    setShowSquareOffAllModal(false);
    setActionLoading(true);
    try {
      const res = await api.squareOffAllPositions();
      setToast({ type: 'success', message: res.message });
      await fetchPositions();
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Square off all failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const openPositions = data?.positions.filter(p => p.status === 'OPEN') || [];
  const closedPositions = data?.positions.filter(p => p.status === 'CLOSED') || [];

  return (
    <div className="space-y-6 font-sans">
      {/* Toast */}
      {toast && (
        <div className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between shadow-2xs ${
          toast.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* Header & Square Off All Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Open & Closed Positions
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time mark-to-market positions tracked across the active session
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {openPositions.length > 0 && (
            <button
              onClick={() => setShowSquareOffAllModal(true)}
              disabled={actionLoading}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
            >
              Square Off All ({openPositions.length})
            </button>
          )}

          <button
            onClick={fetchPositions}
            className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            title="Refresh positions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block font-mono">
            Total Net P&L
          </span>
          <div className={`text-xl font-bold font-mono mt-1 ${
            (data?.total_pnl || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}>
            ₹{(data?.total_pnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-gray-500 mt-1">Realized + Mark-to-market</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block font-mono">
            Realized P&L
          </span>
          <div className={`text-xl font-bold font-mono mt-1 ${
            (data?.realized_pnl || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}>
            ₹{(data?.realized_pnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-gray-500 mt-1">Locked from closed positions</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block font-mono">
            Unrealized P&L
          </span>
          <div className={`text-xl font-bold font-mono mt-1 ${
            (data?.unrealized_pnl || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}>
            ₹{(data?.unrealized_pnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-gray-500 mt-1">Active open floating P&L</p>
        </div>
      </div>

      {/* Positions Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            Positions Book ({openPositions.length} Open, {closedPositions.length} Closed)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Symbol</th>
                <th className="py-2.5 px-4">Side</th>
                <th className="py-2.5 px-4">Product</th>
                <th className="py-2.5 px-4 text-right">Quantity</th>
                <th className="py-2.5 px-4 text-right">Avg Entry</th>
                <th className="py-2.5 px-4 text-right">LTP</th>
                <th className="py-2.5 px-4 text-right">P&L (₹)</th>
                <th className="py-2.5 px-4 text-right">Return %</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {!data || data.positions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400 font-sans text-xs">
                    No positions open or recorded today.
                  </td>
                </tr>
              ) : (
                data.positions.map((p) => {
                  const isPos = p.pnl >= 0;
                  const avgPrice = p.side === 'BUY' ? p.buy_avg_price : p.sell_avg_price;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-gray-900 font-sans">
                        {p.symbol}
                      </td>
                      <td className="py-3 px-4 font-semibold font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.side === 'BUY' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {p.side}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-sans">
                        {p.product}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">
                        {p.quantity}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        ₹{avgPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900 font-bold">
                        ₹{p.ltp.toFixed(2)}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isPos ? '+' : ''}₹{p.pnl.toFixed(2)}
                      </td>
                      <td className={`py-3 px-4 text-right font-semibold ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isPos ? '+' : ''}{p.pnl_percent.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          p.status === 'OPEN' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        {p.status === 'OPEN' && (
                          <button
                            onClick={() => handleSquareOffSingle(p.id, p.symbol)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 text-[11px] font-bold text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                          >
                            Square Off
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Square Off All */}
      {showSquareOffAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-gray-200 animate-scale-in">
            <div className="flex items-center space-x-2 text-red-600 pb-2 border-b border-gray-100">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-sm font-bold">Square Off All Positions?</h3>
            </div>
            <p className="text-xs text-gray-600 my-3 leading-relaxed">
              This will market-exit all <strong>{openPositions.length} active positions</strong> immediately at current market prices.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowSquareOffAllModal(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSquareOffAll}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-2xs"
              >
                Confirm Square Off All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
