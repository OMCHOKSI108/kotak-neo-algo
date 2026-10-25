import React, { useState, useEffect } from 'react';
import { TraderOrderItem, User } from '../types';
import { api } from '../api';
import {
  FileText, RefreshCw, Filter, CheckCircle2, Clock,
  XCircle, AlertCircle, Search, ArrowUpRight, ArrowDownRight,
  ExternalLink, X
} from 'lucide-react';

interface OrdersPageProps {
  user: User;
  onNavigateTrader?: () => void;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({ user, onNavigateTrader }) => {
  const [orders, setOrders] = useState<TraderOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sideFilter, setSideFilter] = useState<string>('ALL');
  const [modeFilter, setModeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<TraderOrderItem | null>(null);

  const fetchOrders = async () => {
    try {
      const data = await api.getTraderOrders();
      setOrders(data);
    } catch (err) {
      // Keep empty list on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, []);

  const filteredOrders = orders.filter(order => {
    if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;
    if (sideFilter !== 'ALL' && order.side !== sideFilter) return false;
    if (modeFilter !== 'ALL' && order.mode !== modeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSym = order.symbol.toLowerCase().includes(q);
      const matchId = order.order_id.toLowerCase().includes(q);
      if (!matchSym && !matchId) return false;
    }
    return true;
  });

  const executedCount = orders.filter(o => o.status === 'EXECUTED').length;
  const openCount = orders.filter(o => o.status === 'OPEN').length;
  const rejectedCount = orders.filter(o => o.status === 'REJECTED').length;

  const formatTime = (ts?: string) => {
    if (!ts) return '--:--:--';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  const formatDate = (ts?: string) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'EXECUTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
            EXECUTED
          </span>
        );
      case 'OPEN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-2.5 h-2.5 mr-1" />
            OPEN
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-2.5 h-2.5 mr-1" />
            REJECTED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Order Book
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time execution log of manual orders and automated algorithmic trades
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchOrders}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-700 transition-colors shadow-2xs"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-gray-500'}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-gray-500 block">Total Orders</span>
          <span className="text-lg font-bold font-mono text-gray-900 block mt-0.5">
            {orders.length}
          </span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-emerald-600 block">Executed</span>
          <span className="text-lg font-bold font-mono text-emerald-700 block mt-0.5">
            {executedCount}
          </span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-blue-600 block">Open Pending</span>
          <span className="text-lg font-bold font-mono text-blue-700 block mt-0.5">
            {openCount}
          </span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-red-600 block">Rejected / Failed</span>
          <span className="text-lg font-bold font-mono text-red-700 block mt-0.5">
            {rejectedCount}
          </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search symbol or order ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-[11px] font-semibold">
            {['ALL', 'EXECUTED', 'OPEN', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  statusFilter === st
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Side Tabs */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-[11px] font-semibold">
            {['ALL', 'BUY', 'SELL'].map((s) => (
              <button
                key={s}
                onClick={() => setSideFilter(s)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  sideFilter === s
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-[11px] font-semibold">
            {['ALL', 'PAPER', 'LIVE'].map((m) => (
              <button
                key={m}
                onClick={() => setModeFilter(m)}
                className={`px-2 py-1 rounded-md transition-all ${
                  modeFilter === m
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-gray-800 mb-1">
              No orders found
            </h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
              {orders.length === 0
                ? 'No orders have been placed during this trading session. Submit manual tickets from the Trader terminal or activate an automated strategy.'
                : 'No orders match your selected filters.'}
            </p>
            {onNavigateTrader && (
              <button
                onClick={onNavigateTrader}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs inline-flex items-center space-x-1.5"
              >
                <span>Open Trader Terminal</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Side</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3 text-right">Qty (Lots)</th>
                  <th className="py-2.5 px-3 text-right">Price</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {filteredOrders.map((order) => {
                  const isBuy = order.side === 'BUY';
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Time */}
                      <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">
                        <span className="block font-medium text-gray-700">
                          {formatTime(order.placed_at || order.executed_at)}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {formatDate(order.placed_at || order.executed_at)}
                        </span>
                      </td>

                      {/* Order ID */}
                      <td className="py-2.5 px-3 text-gray-700 font-mono text-[11px] whitespace-nowrap">
                        <span title={order.order_id}>
                          {order.order_id.length > 12
                            ? `${order.order_id.substring(0, 10)}...`
                            : order.order_id}
                        </span>
                      </td>

                      {/* Symbol */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-gray-900 font-sans">
                            {order.symbol}
                          </span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-gray-100 text-gray-600 font-mono">
                            {order.exchange || 'NSE'}
                          </span>
                        </div>
                      </td>

                      {/* Side */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isBuy
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {isBuy ? (
                            <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" />
                          ) : (
                            <ArrowDownRight className="w-2.5 h-2.5 mr-0.5" />
                          )}
                          {order.side}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="py-2.5 px-3 text-gray-600 font-sans font-medium whitespace-nowrap">
                        {order.order_type}
                      </td>

                      {/* Product */}
                      <td className="py-2.5 px-3 text-gray-600 font-sans whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-mono text-gray-700">
                          {order.product}
                        </span>
                      </td>

                      {/* Qty (Lots) */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <span className="font-bold text-gray-900">
                          {order.quantity}
                        </span>
                        {order.lots > 0 && (
                          <span className="text-gray-400 text-[10px] ml-1">
                            ({order.lots}L)
                          </span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="py-2.5 px-3 text-right font-medium text-gray-900 whitespace-nowrap">
                        {order.price > 0 ? `₹${order.price.toFixed(2)}` : 'MARKET'}
                      </td>

                      {/* Mode */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            order.mode === 'LIVE'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {order.mode}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {getStatusBadge(order.status)}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                          }}
                          className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-700 transition-colors"
                          title="View order details"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal / Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  Order Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 hover:bg-gray-200 rounded-md text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 text-xs">
              {/* Order Status Banner */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div>
                  <span className="text-[10px] text-gray-500 block uppercase font-medium">
                    Order Status
                  </span>
                  <div className="mt-0.5">
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-gray-500 block uppercase font-medium">
                    Execution Mode
                  </span>
                  <span
                    className={`mt-0.5 inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedOrder.mode === 'LIVE'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {selectedOrder.mode} TRADING
                  </span>
                </div>
              </div>

              {/* Rejection Notice if rejected */}
              {selectedOrder.status === 'REJECTED' && selectedOrder.rejection_reason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold block text-[11px]">Rejection Reason</span>
                    <p className="text-[11px] mt-0.5">{selectedOrder.rejection_reason}</p>
                  </div>
                </div>
              )}

              {/* Specification Grid */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50/60 p-3 rounded-lg border border-gray-100 font-mono text-[11px]">
                <div>
                  <span className="text-gray-500 block text-[10px] font-sans">Order ID</span>
                  <span className="font-bold text-gray-900 break-all">{selectedOrder.order_id}</span>
                </div>

                <div>
                  <span className="text-gray-500 block text-[10px] font-sans">Instrument</span>
                  <span className="font-bold text-gray-900">{selectedOrder.symbol} ({selectedOrder.exchange || 'NSE'})</span>
                </div>

                <div>
                  <span className="text-gray-500 block text-[10px] font-sans">Direction</span>
                  <span className={`font-bold ${selectedOrder.side === 'BUY' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {selectedOrder.side}
                  </span>
                </div>

                <div>
                  <span className="text-gray-500 block text-[10px] font-sans">Order Type</span>
                  <span className="font-bold text-gray-900">{selectedOrder.order_type}</span>
                </div>

                <div>
                  <span className="text-gray-500 block text-[10px] font-sans">Product Code</span>
                  <span className="font-bold text-gray-900">{selectedOrder.product}</span>
                </div>

                <div>
                  <span className="text-gray-500 block text-[10px] font-sans">Quantity & Lots</span>
                  <span className="font-bold text-gray-900">
                    {selectedOrder.quantity} units {selectedOrder.lots > 0 ? `(${selectedOrder.lots} lots)` : ''}
                  </span>
                </div>

                <div>
                  <span className="text-gray-500 block text-[10px] font-sans">Execution Price</span>
                  <span className="font-bold text-gray-900">
                    {selectedOrder.price > 0 ? `₹${selectedOrder.price.toFixed(2)}` : 'MARKET'}
                  </span>
                </div>

                <div>
                  <span className="text-gray-500 block text-[10px] font-sans">Placed Timestamp</span>
                  <span className="font-bold text-gray-700">
                    {formatTime(selectedOrder.placed_at)}
                  </span>
                </div>
              </div>

              {/* Execution Router Info */}
              <div className="text-[11px] text-gray-500 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <span className="font-semibold text-gray-700 block mb-0.5">Execution Router</span>
                {selectedOrder.mode === 'LIVE'
                  ? 'Routed via KotakNeoAdapter to Kotak Neo OMS Gateway with AES-256 encrypted session tokens.'
                  : 'Processed by local high-speed Paper Execution Simulator with real-time mark-to-market fills.'}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-xs font-semibold text-gray-700 transition-colors shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
