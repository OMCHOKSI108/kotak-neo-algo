import React, { useState, useEffect, useRef } from 'react';
import { Quote, User, SymbolSearchResult } from '../types';
import { api } from '../api';
import {
  TrendingUp, TrendingDown, Clock, Search, ArrowUpRight,
  Layers, Plus, Trash2, Filter, Zap, Check, Building2
} from 'lucide-react';
import { CreateUserModal } from '../components/CreateUserModal';

interface MarketDashboardProps {
  quotes: Record<string, Quote>;
  flashStates: Record<string, 'up' | 'down'>;
  onNavigateOptionChain: (underlying: string) => void;
  onNavigateTrader?: (symbol: string) => void;
  user: User;
}

export const MarketDashboard: React.FC<MarketDashboardProps> = ({
  quotes,
  flashStates,
  onNavigateOptionChain,
  onNavigateTrader,
  user,
}) => {
  const [activeSegment, setActiveSegment] = useState<'all' | 'indices' | 'equities' | 'futures' | 'options'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [customWatchlist, setCustomWatchlist] = useState<string[]>([
    'NIFTY 50', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'HDFCBANK', 'ICICIBANK', 'TCS', 'INFY'
  ]);
  const [newSymbolInput, setNewSymbolInput] = useState('');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const isAdmin = user.role === 'admin';

  const indexSymbols = ['NIFTY 50', 'BANKNIFTY', 'SENSEX'];
  const stockSymbols = ['RELIANCE', 'HDFCBANK', 'ICICIBANK', 'TCS', 'INFY'];

  const [searchResults, setSearchResults] = useState<SymbolSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live search debounced query to backend
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchSymbols(searchTerm.trim());
        setSearchResults(results);
        setShowSearchDropdown(results.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleAddSearchResult = (item: SymbolSearchResult) => {
    const sym = item.symbol.toUpperCase();
    if (!customWatchlist.includes(sym)) {
      setCustomWatchlist(prev => [...prev, sym]);
      setSuccessToast(`Added ${item.name} (${item.exchange}) to Watchlist.`);
      setTimeout(() => setSuccessToast(null), 3500);
    }
    setShowSearchDropdown(false);
    setSearchTerm('');
  };

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSymbolInput.trim().toUpperCase();
    if (clean && !customWatchlist.includes(clean)) {
      setCustomWatchlist([...customWatchlist, clean]);
      setNewSymbolInput('');
      setSuccessToast(`Added ${clean} to Watchlist.`);
      setTimeout(() => setSuccessToast(null), 3000);
    }
  };

  const handleRemoveSymbol = (sym: string) => {
    setCustomWatchlist(customWatchlist.filter(s => s !== sym));
  };

  // Filter symbols based on activeSegment and searchTerm
  const filteredSymbols = customWatchlist.filter((sym) => {
    const matchesSearch = sym.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (activeSegment === 'indices') {
      return indexSymbols.includes(sym);
    } else if (activeSegment === 'equities') {
      return stockSymbols.includes(sym) || (!indexSymbols.includes(sym) && !sym.includes('FUT') && !sym.includes('CE') && !sym.includes('PE'));
    } else if (activeSegment === 'futures') {
      return sym.includes('FUT');
    } else if (activeSegment === 'options') {
      return sym.includes('CE') || sym.includes('PE');
    }
    return true;
  });

  const formatPrice = (val?: number) => {
    if (val === undefined || val === null || val === 0) return '--';
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleUserCreated = (newUser: any) => {
    setSuccessToast(`User ${newUser.email} created successfully.`);
    setTimeout(() => setSuccessToast(null), 5000);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <span>✓ {successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">×</button>
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Market Monitoring
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time streaming prices from Kotak Neo for Indian indices, equities, and derivatives
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs text-gray-500 font-mono flex items-center space-x-1.5 bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>Last Tick: {quotes['NIFTY 50']?.last_trade_time || 'Syncing...'}</span>
          </span>

          {isAdmin && (
            <button
              onClick={() => setShowCreateUserModal(true)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add User</span>
            </button>
          )}
        </div>
      </div>

      {/* Major Indices Quick Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {indexSymbols.map((sym) => {
          const q = quotes[sym];
          const flash = flashStates[sym];
          const isPos = (q?.change || 0) >= 0;

          return (
            <div
              key={sym}
              className={`bg-white border border-gray-200 rounded-xl p-4 shadow-2xs transition-all duration-300 relative ${
                flash === 'up'
                  ? 'ring-2 ring-emerald-500 bg-emerald-50/20'
                  : flash === 'down'
                  ? 'ring-2 ring-red-500 bg-red-50/20'
                  : 'hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-900">{sym}</span>
                <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-medium">
                  {sym === 'SENSEX' ? 'BSE' : 'NSE'}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-gray-900 tracking-tight">
                  {formatPrice(q?.ltp)}
                </span>
                <span className={`flex items-center text-xs font-semibold font-mono ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isPos ? '+' : ''}{q?.change ? q.change.toFixed(2) : '0.00'} ({isPos ? '+' : ''}{q?.change_percent ? q.change_percent.toFixed(2) : '0.00'}%)
                </span>
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <span>H: <strong className="font-mono text-gray-800">{q?.high ? q.high.toFixed(2) : '--'}</strong></span>
                <span>L: <strong className="font-mono text-gray-800">{q?.low ? q.low.toFixed(2) : '--'}</strong></span>
                <button
                  onClick={() => onNavigateOptionChain(sym)}
                  className="text-blue-600 hover:text-blue-800 font-semibold flex items-center"
                >
                  Options <ArrowUpRight className="w-3 h-3 ml-0.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Segment Tabs & Watchlist Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50/50">
          {/* Segment Filter Buttons */}
          <div className="flex items-center space-x-1.5">
            {[
              { id: 'all', label: 'All Watchlist' },
              { id: 'indices', label: 'Indices' },
              { id: 'equities', label: 'Equities' },
              { id: 'futures', label: 'Futures' },
              { id: 'options', label: 'Options' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSegment(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeSegment === tab.id
                    ? 'bg-white text-gray-900 shadow-2xs border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar & Add Symbol */}
          <div className="flex items-center space-x-2" ref={searchContainerRef}>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search NSE & BSE stocks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowSearchDropdown(true);
                }}
                className="pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 sm:w-56 font-sans shadow-2xs"
              />

              {/* Floating BSE & NSE Search Dropdown */}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute left-0 mt-1.5 w-72 sm:w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-gray-100 max-h-80 overflow-y-auto animate-scale-in font-sans">
                  <div className="px-3 py-1.5 bg-gray-50 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <span>NSE & BSE Instruments ({searchResults.length})</span>
                    {isSearching && <span className="text-blue-600 font-mono">Searching...</span>}
                  </div>
                  {searchResults.map((item, idx) => {
                    const isAlreadyAdded = customWatchlist.includes(item.symbol.toUpperCase());
                    return (
                      <div
                        key={`${item.symbol}-${item.exchange}-${idx}`}
                        onClick={() => handleAddSearchResult(item)}
                        className="px-3 py-2 hover:bg-blue-50/50 cursor-pointer flex items-center justify-between transition-colors group"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-xs text-gray-900 font-mono">{item.symbol}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase font-mono ${
                              item.exchange === 'BSE'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                              {item.exchange}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">{item.segment}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">{item.name}</p>
                        </div>
                        <div>
                          {isAlreadyAdded ? (
                            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                              <Check className="w-3 h-3" />
                              Added
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-[10px] font-bold transition-colors flex items-center gap-1 shadow-2xs"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <form onSubmit={handleAddSymbol} className="flex items-center space-x-1">
              <input
                type="text"
                placeholder="+ Add symbol"
                value={newSymbolInput}
                onChange={(e) => setNewSymbolInput(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-24 sm:w-28 uppercase font-mono"
              />
              <button
                type="submit"
                disabled={!newSymbolInput.trim()}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-40 transition-colors"
                title="Add to Watchlist"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Real Quotes Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Instrument</th>
                <th className="py-2.5 px-4">Exchange</th>
                <th className="py-2.5 px-4 text-right">LTP (₹)</th>
                <th className="py-2.5 px-4 text-right">Change</th>
                <th className="py-2.5 px-4 text-right">Change %</th>
                <th className="py-2.5 px-4 text-right">High</th>
                <th className="py-2.5 px-4 text-right">Low</th>
                <th className="py-2.5 px-4 text-right">Volume</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {filteredSymbols.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400 font-sans text-xs">
                    No instruments found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredSymbols.map((sym) => {
                  const q = quotes[sym];
                  const flash = flashStates[sym];
                  const isPos = (q?.change || 0) >= 0;

                  return (
                    <tr
                      key={sym}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        flash === 'up' ? 'bg-emerald-50/20' : flash === 'down' ? 'bg-red-50/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-gray-900 font-sans flex items-center space-x-2">
                        <span>{sym}</span>
                        {sym.includes('CE') && <span className="text-[10px] px-1 bg-emerald-100 text-emerald-800 rounded">CE</span>}
                        {sym.includes('PE') && <span className="text-[10px] px-1 bg-red-100 text-red-800 rounded">PE</span>}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-sans">
                        {q?.exchange || (sym === 'SENSEX' ? 'BSE' : 'NSE')}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">
                        {formatPrice(q?.ltp)}
                      </td>
                      <td className={`py-3 px-4 text-right font-semibold ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isPos ? '+' : ''}{q?.change ? q.change.toFixed(2) : '0.00'}
                      </td>
                      <td className={`py-3 px-4 text-right font-semibold ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isPos ? '+' : ''}{q?.change_percent ? q.change_percent.toFixed(2) : '0.00'}%
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        {q?.high ? q.high.toFixed(2) : '--'}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        {q?.low ? q.low.toFixed(2) : '--'}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500">
                        {q?.volume ? q.volume.toLocaleString('en-IN') : '--'}
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        <div className="flex items-center justify-center space-x-2">
                          {(sym === 'NIFTY 50' || sym === 'BANKNIFTY' || sym === 'SENSEX') && (
                            <button
                              onClick={() => onNavigateOptionChain(sym)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                              title="View Option Chain"
                            >
                              Chain
                            </button>
                          )}
                          {onNavigateTrader && (
                            <button
                              onClick={() => onNavigateTrader(sym)}
                              className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold flex items-center"
                              title="Trade in Terminal"
                            >
                              <Zap className="w-3 h-3 mr-0.5" />
                              Trade
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveSymbol(sym)}
                            className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                            title="Remove from Watchlist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin User Creation Modal */}
      {isAdmin && (
        <CreateUserModal
          isOpen={showCreateUserModal}
          onClose={() => setShowCreateUserModal(false)}
          onSuccess={handleUserCreated}
        />
      )}
    </div>
  );
};
