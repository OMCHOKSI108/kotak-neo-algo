import React, { useState } from 'react';
import { Quote } from '../types';
import { TrendingUp, TrendingDown, Clock, Search, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';

interface MarketDashboardProps {
  quotes: Record<string, Quote>;
  flashStates: Record<string, 'up' | 'down'>;
  onNavigateOptionChain: (underlying: string) => void;
}

export const MarketDashboard: React.FC<MarketDashboardProps> = ({
  quotes,
  flashStates,
  onNavigateOptionChain,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const indexSymbols = ['NIFTY 50', 'BANKNIFTY', 'SENSEX'];
  const stockSymbols = ['RELIANCE', 'HDFCBANK', 'ICICIBANK', 'TCS', 'INFY'];

  const filteredStocks = stockSymbols.filter((sym) =>
    sym.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatPrice = (val?: number) => {
    if (val === undefined || val === null) return '--';
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Indices Row */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
            <span>Market Overview</span>
            <span className="text-xs font-normal text-gray-400 font-mono">Live Normalized Indian Feeds</span>
          </h2>
          <span className="text-xs text-gray-400 font-mono flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
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
                className={`bg-[#151922] border border-[#232936] rounded-xl p-5 transition-all duration-300 relative overflow-hidden ${
                  flash === 'up' ? 'ring-1 ring-emerald-500 bg-emerald-500/5' : flash === 'down' ? 'ring-1 ring-red-500 bg-red-500/5' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 font-mono">
                      {q?.exchange || 'NSE'} Index
                    </span>
                    <h3 className="text-xl font-extrabold text-white mt-0.5">{sym}</h3>
                  </div>

                  <button
                    onClick={() => onNavigateOptionChain(sym.replace(' 50', ''))}
                    className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
                    title="Inspect Option Chain"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Options</span>
                  </button>
                </div>

                <div className="mt-4 flex items-baseline justify-between">
                  <div className="text-2xl font-bold font-mono text-white tracking-tight">
                    ₹{formatPrice(q?.ltp)}
                  </div>
                  <div
                    className={`flex items-center text-sm font-semibold font-mono px-2 py-0.5 rounded ${
                      isPos ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                    }`}
                  >
                    {isPos ? <ArrowUpRight className="w-4 h-4 mr-0.5" /> : <ArrowDownRight className="w-4 h-4 mr-0.5" />}
                    <span>{isPos ? '+' : ''}{q?.change ? q.change.toFixed(2) : '0.00'}</span>
                    <span className="ml-1 text-xs">({q?.change_percent ? q.change_percent.toFixed(2) : '0.00'}%)</span>
                  </div>
                </div>

                {/* Day Range Bar */}
                <div className="mt-4 pt-3 border-t border-[#232936] text-[11px] text-gray-400 font-mono">
                  <div className="flex justify-between mb-1">
                    <span>L: ₹{formatPrice(q?.low)}</span>
                    <span>H: ₹{formatPrice(q?.high)}</span>
                  </div>
                  {q?.high && q?.low && q.high > q.low ? (
                    <div className="w-full h-1.5 bg-[#0B0E14] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, ((q.ltp - q.low) / (q.high - q.low)) * 100))}%`,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Watchlist Section */}
      <div className="bg-[#151922] border border-[#232936] rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 sm:p-5 border-b border-[#232936] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">NSE Core Watchlist</h3>
            <p className="text-xs text-gray-400">Key liquid instruments tracked by platform algorithms</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#232936] text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-[#10141D]">
                <th className="py-3 px-4">Instrument</th>
                <th className="py-3 px-4">LTP (₹)</th>
                <th className="py-3 px-4">Change</th>
                <th className="py-3 px-4">Day High / Low</th>
                <th className="py-3 px-4">Bid / Ask</th>
                <th className="py-3 px-4">Volume</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232936] font-mono text-xs">
              {filteredStocks.map((sym) => {
                const q = quotes[sym];
                const flash = flashStates[sym];
                const isPos = (q?.change || 0) >= 0;

                return (
                  <tr
                    key={sym}
                    className={`hover:bg-[#1D2330] transition-colors ${
                      flash === 'up' ? 'bg-emerald-500/10' : flash === 'down' ? 'bg-red-500/10' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-bold text-white flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>{sym}</span>
                      <span className="text-[10px] text-gray-500 font-normal">NSE EQ</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      ₹{formatPrice(q?.ltp)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          isPos ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                        }`}
                      >
                        {isPos ? '+' : ''}{q?.change ? q.change.toFixed(2) : '0.00'} ({q?.change_percent ? q.change_percent.toFixed(2) : '0.00'}%)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-300">
                      <span>₹{formatPrice(q?.high)}</span> / <span className="text-gray-400">₹{formatPrice(q?.low)}</span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-300">
                      <span className="text-emerald-400">₹{formatPrice(q?.bid)}</span> / <span className="text-red-400">₹{formatPrice(q?.ask)}</span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-400">
                      {q?.volume ? q.volume.toLocaleString('en-IN') : '--'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onNavigateOptionChain(sym)}
                        className="px-2.5 py-1 text-xs rounded bg-[#0B0E14] text-blue-400 hover:bg-blue-600 hover:text-white border border-[#232936] transition-colors"
                      >
                        Analyze Chain
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
