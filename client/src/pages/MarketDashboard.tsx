import React, { useState } from 'react';
import { Quote, User } from '../types';
import {
  TrendingUp, Clock, Search, ArrowUpRight, ArrowDownRight,
  Layers, UserPlus, Plus
} from 'lucide-react';
import { CreateUserModal } from '../components/CreateUserModal';

interface MarketDashboardProps {
  quotes: Record<string, Quote>;
  flashStates: Record<string, 'up' | 'down'>;
  onNavigateOptionChain: (underlying: string) => void;
  user: User;
}

export const MarketDashboard: React.FC<MarketDashboardProps> = ({
  quotes,
  flashStates,
  onNavigateOptionChain,
  user,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const isAdmin = user.role === 'admin';

  const indexSymbols = ['NIFTY 50', 'BANKNIFTY', 'SENSEX'];
  const stockSymbols = ['RELIANCE', 'HDFCBANK', 'ICICIBANK', 'TCS', 'INFY'];

  const filteredStocks = stockSymbols.filter((sym) =>
    sym.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatPrice = (val?: number) => {
    if (val === undefined || val === null) return '--';
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleUserCreated = (newUser: any) => {
    setSuccessToast(`User ${newUser.email} created. They can now log in.`);
    setTimeout(() => setSuccessToast(null), 5000);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-fade-in">
          <span>✓ {successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">×</button>
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Market Overview
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time quotes for major indices and liquid equities
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs text-gray-500 font-mono flex items-center space-x-1.5 bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg shadow-xs">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>Updated: {quotes['NIFTY 50']?.last_trade_time || 'Syncing...'}</span>
          </span>

          {isAdmin && (
            <button
              onClick={() => setShowCreateUserModal(true)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors"
              title="Create new user login"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add User</span>
            </button>
          )}
        </div>
      </div>

      {/* Major Indices Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {indexSymbols.map((sym) => {
          const q = quotes[sym];
          const flash = flashStates[sym];
          const isPos = (q?.change || 0) >= 0;

          return (
            <div
              key={sym}
              className={`bg-white border border-gray-200 rounded-xl p-5 shadow-xs transition-all duration-300 relative overflow-hidden ${
                flash === 'up'
                  ? 'ring-2 ring-emerald-500 bg-emerald-50/30'
                  : flash === 'down'
                  ? 'ring-2 ring-red-500 bg-red-50/30'
                  : 'hover:border-gray-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 font-mono uppercase tracking-wider">
                    {q?.exchange || 'NSE'} Index
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 mt-0.5">{sym}</h3>
                </div>

                <button
                  onClick={() => onNavigateOptionChain(sym.replace(' 50', ''))}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors"
                  title="View Option Chain"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Options</span>
                </button>
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <div className="text-2xl font-extrabold font-mono text-black tracking-tight">
                  ₹{formatPrice(q?.ltp)}
                </div>
                <div
                  className={`flex items-center text-xs font-bold font-mono px-2 py-0.5 rounded ${
                    isPos ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-red-700 bg-red-50 border border-red-200'
                  }`}
                >
                  {isPos ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                  <span>{isPos ? '+' : ''}{q?.change ? q.change.toFixed(2) : '0.00'}</span>
                  <span className="ml-1 text-[11px]">({q?.change_percent ? q.change_percent.toFixed(2) : '0.00'}%)</span>
                </div>
              </div>

              {/* Day Range Bar */}
              <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 font-mono">
                <div className="flex justify-between mb-1">
                  <span>L: ₹{formatPrice(q?.low)}</span>
                  <span>H: ₹{formatPrice(q?.high)}</span>
                </div>
                {q?.high && q?.low && q.high > q.low ? (
                  <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, (((q.ltp || q.low) - q.low) / (q.high - q.low)) * 100))}%`,
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-1 bg-gray-100 rounded-full" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stock Watchlist Section */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Equities Watchlist</h2>
            <p className="text-xs text-gray-500">Live prices for active market securities</p>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-sans font-semibold">
              <tr>
                <th className="py-2.5 px-4">Symbol</th>
                <th className="py-2.5 px-4 text-right">LTP (₹)</th>
                <th className="py-2.5 px-4 text-right">Change</th>
                <th className="py-2.5 px-4 text-right">Change %</th>
                <th className="py-2.5 px-4 text-right">High</th>
                <th className="py-2.5 px-4 text-right">Low</th>
                <th className="py-2.5 px-4 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStocks.map((sym) => {
                const q = quotes[sym];
                const flash = flashStates[sym];
                const isPos = (q?.change || 0) >= 0;

                return (
                  <tr
                    key={sym}
                    className={`hover:bg-gray-50/80 transition-colors ${
                      flash === 'up' ? 'bg-emerald-50/40' : flash === 'down' ? 'bg-red-50/40' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-sans font-bold text-gray-900">
                      <div className="flex items-center space-x-2">
                        <span>{sym}</span>
                        <span className="text-[10px] px-1 py-0.2 rounded bg-gray-100 text-gray-500 font-mono">
                          NSE
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-black">
                      ₹{formatPrice(q?.ltp)}
                    </td>
                    <td className={`py-3 px-4 text-right font-semibold ${isPos ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isPos ? '+' : ''}{q?.change ? q.change.toFixed(2) : '--'}
                    </td>
                    <td className={`py-3 px-4 text-right font-semibold ${isPos ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isPos ? '+' : ''}{q?.change_percent ? q.change_percent.toFixed(2) : '--'}%
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">₹{formatPrice(q?.high)}</td>
                    <td className="py-3 px-4 text-right text-gray-600">₹{formatPrice(q?.low)}</td>
                    <td className="py-3 px-4 text-right text-gray-500">
                      {q?.volume ? q.volume.toLocaleString('en-IN') : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Quick User Creation Modal */}
      {isAdmin && (
        <CreateUserModal
          isOpen={showCreateUserModal}
          onClose={() => setShowCreateUserModal(false)}
          onUserCreated={handleUserCreated}
        />
      )}
    </div>
  );
};
