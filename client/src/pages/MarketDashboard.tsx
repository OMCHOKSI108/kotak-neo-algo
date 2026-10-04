import React, { useState } from 'react';
import { Quote, User } from '../types';
import {
  TrendingUp, TrendingDown, Clock, Search, ArrowUpRight, ArrowDownRight,
  Layers, UserPlus, ShieldCheck, User as UserIcon, Plus
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
    setSuccessToast(`User ${newUser.email} created successfully! They can log in now.`);
    setTimeout(() => setSuccessToast(null), 6000);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <span>✓ {successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">×</button>
        </div>
      )}

      {/* Account Distinction & Quick Actions Bar */}
      {isAdmin ? (
        /* ADMIN HOME BAR WITH PROMINENT + USER BUTTON */
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-gray-900">Administrator Console</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
                  Admin Privileges
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Logged in as <span className="font-semibold text-gray-800">{user.full_name}</span> ({user.email}). You can manage platform users and audit broker connections.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCreateUserModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all hover:shadow active:scale-95"
              title="Create a new User ID and Password"
            >
              <Plus className="w-4 h-4" />
              <span>Create User</span>
            </button>
          </div>
        </div>
      ) : (
        /* REGULAR TRADER HOME BAR */
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-gray-900">Trader Workspace</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                  Trader Account
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Welcome, <span className="font-semibold text-gray-800">{user.full_name}</span>. Real-time Indian feeds and quantitative execution are active.
              </p>
            </div>
          </div>

          <div className="text-xs text-gray-500 font-mono">
            Safety Mode: <span className="text-emerald-700 font-bold">Paper Execution</span>
          </div>
        </div>
      )}

      {/* Top Banner / Indices Row */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center space-x-2">
              <span>Major Indian Indices</span>
            </h2>
            <p className="text-xs text-gray-500">Live normalized tick feeds from broker adapter</p>
          </div>
          <span className="text-xs text-gray-500 font-mono flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>Updated: {quotes['NIFTY 50']?.last_trade_time || 'Syncing...'}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {indexSymbols.map((sym) => {
            const q = quotes[sym];
            const flash = flashStates[sym];
            const isPos = (q?.change || 0) >= 0;

            return (
              <div
                key={sym}
                className={`bg-white border border-gray-200 rounded-xl p-5 shadow-sm transition-all duration-300 relative overflow-hidden ${
                  flash === 'up'
                    ? 'ring-2 ring-emerald-500 bg-emerald-50/40'
                    : flash === 'down'
                    ? 'ring-2 ring-red-500 bg-red-50/40'
                    : 'hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">
                      {q?.exchange || 'NSE'} Index
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 mt-0.5">{sym}</h3>
                  </div>

                  <button
                    onClick={() => onNavigateOptionChain(sym.replace(' 50', ''))}
                    className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                    title="Inspect Option Chain"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Options</span>
                  </button>
                </div>

                <div className="mt-4 flex items-baseline justify-between">
                  <div className="text-2xl font-extrabold font-mono text-black tracking-tight">
                    ₹{formatPrice(q?.ltp)}
                  </div>
                  <div
                    className={`flex items-center text-sm font-bold font-mono px-2 py-0.5 rounded ${
                      isPos ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-red-700 bg-red-50 border border-red-200'
                    }`}
                  >
                    {isPos ? <ArrowUpRight className="w-4 h-4 mr-0.5" /> : <ArrowDownRight className="w-4 h-4 mr-0.5" />}
                    <span>{isPos ? '+' : ''}{q?.change ? q.change.toFixed(2) : '0.00'}</span>
                    <span className="ml-1 text-xs">({q?.change_percent ? q.change_percent.toFixed(2) : '0.00'}%)</span>
                  </div>
                </div>

                {/* Day Range Bar */}
                <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 font-mono">
                  <div className="flex justify-between mb-1">
                    <span>L: ₹{formatPrice(q?.low)}</span>
                    <span>H: ₹{formatPrice(q?.high)}</span>
                  </div>
                  {q?.high && q?.low && q.high > q.low ? (
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, (((q.ltp || q.low) - q.low) / (q.high - q.low)) * 100))}%`,
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-1.5 bg-gray-100 rounded-full" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stock Watchlist Section */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Active Stock Watchlist</h3>
            <p className="text-xs text-gray-500">Selected high-liquidity NSE equities</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search symbol (e.g. RELIANCE)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-sans font-bold">
              <tr>
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4 text-right">LTP (₹)</th>
                <th className="py-3 px-4 text-right">Change</th>
                <th className="py-3 px-4 text-right">Change %</th>
                <th className="py-3 px-4 text-right">Day High</th>
                <th className="py-3 px-4 text-right">Day Low</th>
                <th className="py-3 px-4 text-right">Volume</th>
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
                    className={`hover:bg-gray-50 transition-colors ${
                      flash === 'up' ? 'bg-emerald-50/50' : flash === 'down' ? 'bg-red-50/50' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-sans font-bold text-gray-900">
                      <div className="flex items-center space-x-2">
                        <span>{sym}</span>
                        <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                          NSE
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-black text-sm">
                      ₹{formatPrice(q?.ltp)}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-semibold ${isPos ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isPos ? '+' : ''}{q?.change ? q.change.toFixed(2) : '--'}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-semibold ${isPos ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isPos ? '+' : ''}{q?.change_percent ? q.change_percent.toFixed(2) : '--'}%
                    </td>
                    <td className="py-3.5 px-4 text-right text-gray-700">₹{formatPrice(q?.high)}</td>
                    <td className="py-3.5 px-4 text-right text-gray-700">₹{formatPrice(q?.low)}</td>
                    <td className="py-3.5 px-4 text-right text-gray-600">
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
