import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Quote, User, InstrumentSearchResult, WatchlistItem } from '../types';
import { api } from '../api';
import {
  Clock, Search, ArrowUpRight, Plus, Trash2, Zap, Check, X,
  Loader2, Filter, ChevronRight
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
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [isLoadingWatchlist, setIsLoadingWatchlist] = useState(true);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const indexSymbols = ['NIFTY 50', 'BANKNIFTY', 'SENSEX'];

  // Fast Scrip Search state
  const [searchResults, setSearchResults] = useState<InstrumentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [dropdownSegment, setDropdownSegment] = useState<'all' | 'equity' | 'fo' | 'indices'>('all');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);

  // Load persisted watchlist from backend on mount
  useEffect(() => {
    let isMounted = true;
    const fetchWatchlist = async () => {
      try {
        const items = await api.getWatchlist();
        if (isMounted) {
          setWatchlistItems(items);
        }
      } catch (err) {
        console.error('Failed to load watchlist:', err);
      } finally {
        if (isMounted) setIsLoadingWatchlist(false);
      }
    };
    fetchWatchlist();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global keyboard shortcut ('/' or 'Ctrl+K') to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 150ms debounced Scrip Master search query
  useEffect(() => {
    const query = searchTerm.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      setHighlightedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchInstruments(query, dropdownSegment, 20);
        setSearchResults(results);
        setShowSearchDropdown(true);
        setHighlightedIndex(results.length > 0 ? 0 : -1);
      } catch (err) {
        console.error('Scrip search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchTerm, dropdownSegment]);

  // Handle keyboard navigation inside search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchDropdown || searchResults.length === 0) {
      if (e.key === 'Escape') {
        setShowSearchDropdown(false);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev < searchResults.length - 1 ? prev + 1 : 0;
        scrollHighlightedIntoView(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : searchResults.length - 1;
        scrollHighlightedIntoView(next);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        handleToggleWatchlistItem(searchResults[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSearchDropdown(false);
    }
  };

  const scrollHighlightedIntoView = (index: number) => {
    if (!dropdownListRef.current) return;
    const element = dropdownListRef.current.children[index] as HTMLElement;
    if (element) {
      element.scrollIntoView({ block: 'nearest' });
    }
  };

  // Add / Toggle Instrument in Watchlist
  const handleToggleWatchlistItem = async (item: InstrumentSearchResult) => {
    const symUpper = item.symbol.toUpperCase();
    const isAlreadyAdded = watchlistItems.some((w) => w.symbol.toUpperCase() === symUpper);

    if (isAlreadyAdded) {
      // Remove
      setWatchlistItems((prev) => prev.filter((w) => w.symbol.toUpperCase() !== symUpper));
      try {
        await api.removeFromWatchlist(symUpper);
        setSuccessToast(`Removed ${item.tradingSymbol || item.symbol} from Watchlist.`);
        setTimeout(() => setSuccessToast(null), 3000);
      } catch (err) {
        console.error('Failed to remove from watchlist:', err);
      }
    } else {
      // Optimistic Add
      const newItem: WatchlistItem = {
        id: Date.now(),
        symbol: item.symbol,
        trading_symbol: item.tradingSymbol || item.symbol,
        tradingSymbol: item.tradingSymbol || item.symbol,
        name: item.name,
        exchange: item.exchange,
        exchange_segment: item.exchangeSegment,
        exchangeSegment: item.exchangeSegment,
        instrument_type: item.instrumentType,
        instrumentType: item.instrumentType,
        token: item.token,
        lot_size: item.lotSize || 1,
        lotSize: item.lotSize || 1,
        strike_price: item.strikePrice,
        strikePrice: item.strikePrice,
        expiry: item.expiry,
      };

      setWatchlistItems((prev) => [newItem, ...prev.filter((w) => w.symbol.toUpperCase() !== symUpper)]);
      setSuccessToast(`Added ${item.tradingSymbol || item.symbol} to Watchlist.`);
      setTimeout(() => setSuccessToast(null), 3000);

      try {
        await api.addToWatchlist({
          symbol: item.symbol,
          tradingSymbol: item.tradingSymbol || item.symbol,
          name: item.name,
          exchange: item.exchange,
          exchangeSegment: item.exchangeSegment,
          instrumentType: item.instrumentType,
          token: item.token,
          lotSize: item.lotSize,
          strikePrice: item.strikePrice,
          expiry: item.expiry,
        });
      } catch (err) {
        console.error('Failed to persist watchlist addition:', err);
      }
    }
  };

  const handleRemoveFromWatchlist = async (sym: string) => {
    const symUpper = sym.toUpperCase();
    setWatchlistItems((prev) => prev.filter((w) => w.symbol.toUpperCase() !== symUpper));
    try {
      await api.removeFromWatchlist(symUpper);
    } catch (err) {
      console.error('Failed to remove from watchlist:', err);
    }
  };

  // Helper to determine exact badge for instruments (prevents RELIANCE matching CE)
  const getInstrumentBadge = (item?: WatchlistItem, sym?: string) => {
    const s = (item?.symbol || sym || '').toUpperCase().trim();
    const itype = (item?.instrumentType || item?.instrument_type || '').toUpperCase();

    // Option checks: strictly CE/PE from instrumentType or ending with digits+CE / space+CE
    const isCE = itype === 'CE' || /\d+CE$/i.test(s) || /\sCE$/i.test(s);
    const isPE = itype === 'PE' || /\d+PE$/i.test(s) || /\sPE$/i.test(s);
    const isFUT = itype === 'FUT' || /\d+FUT$/i.test(s) || /\sFUT$/i.test(s) || s.endsWith('-FUT');
    const isIDX = itype === 'IDX' || ['NIFTY 50', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCPNIFTY', 'BANKEX'].includes(s);

    if (isCE) {
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded">
          CE
        </span>
      );
    }
    if (isPE) {
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200/60 rounded">
          PE
        </span>
      );
    }
    if (isFUT) {
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200/60 rounded">
          FUT
        </span>
      );
    }
    if (isIDX) {
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/60 rounded">
          INDEX
        </span>
      );
    }
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-gray-100 text-gray-600 border border-gray-200/60 rounded">
        EQ
      </span>
    );
  };

  // Filter watchlist items for the main table
  const filteredWatchlist = watchlistItems.filter((item) => {
    const s = item.symbol.toUpperCase();
    const itype = (item.instrumentType || item.instrument_type || '').toUpperCase();

    const isOption = itype === 'CE' || itype === 'PE' || /\d+(CE|PE)$/i.test(s) || /\s(CE|PE)$/i.test(s);
    const isFuture = itype === 'FUT' || /\d+FUT$/i.test(s) || /\sFUT$/i.test(s) || s.endsWith('-FUT');
    const isIndex = itype === 'IDX' || indexSymbols.includes(s) || ['FINNIFTY', 'MIDCPNIFTY', 'BANKEX'].includes(s);

    if (activeSegment === 'indices') return isIndex;
    if (activeSegment === 'equities') return !isIndex && !isOption && !isFuture;
    if (activeSegment === 'futures') return isFuture;
    if (activeSegment === 'options') return isOption;
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
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-2xs animate-fade-in">
          <span>✓ {successToast}</span>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 text-sm"
          >
            ×
          </button>
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

      {/* Segment Tabs & Watchlist Table Container */}
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

          {/* Autocomplete Scrip Master Search Input */}
          <div className="relative w-full sm:w-auto" ref={searchContainerRef}>
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search symbol, strike, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowSearchDropdown(true);
                }}
                onKeyDown={handleSearchKeyDown}
                className="pl-9 pr-14 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-72 md:w-80 font-sans shadow-2xs transition-all"
              />

              {/* Clear button or Shortcut hint */}
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                {isSearching ? (
                  <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                ) : searchTerm ? (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setShowSearchDropdown(false);
                      searchInputRef.current?.focus();
                    }}
                    className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="hidden sm:inline-block text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono border border-gray-200">
                    /
                  </span>
                )}
              </div>
            </div>

            {/* Trading-Grade Floating Autocomplete Dropdown */}
            {showSearchDropdown && (
              <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-full sm:w-96 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-100">
                {/* Segment Filter Pills Header */}
                <div className="p-2 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'equity', label: 'Equity' },
                      { id: 'fo', label: 'F&O' },
                      { id: 'indices', label: 'Indices' },
                    ].map((pill) => (
                      <button
                        key={pill.id}
                        type="button"
                        onClick={() => setDropdownSegment(pill.id as any)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                          dropdownSegment === pill.id
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-gray-600 hover:bg-gray-200/70'
                        }`}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>

                  <span className="text-[10px] font-mono text-gray-400">
                    {searchResults.length} matches
                  </span>
                </div>

                {/* Dropdown Items List */}
                <div
                  ref={dropdownListRef}
                  className="max-h-80 overflow-y-auto divide-y divide-gray-50"
                >
                  {isSearching && searchResults.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-xs flex flex-col items-center justify-center space-y-2">
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      <span>Searching Kotak Scrip Master...</span>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-xs">
                      No instruments found for "{searchTerm}".
                    </div>
                  ) : (
                    searchResults.map((item, idx) => {
                      const isHighlighted = idx === highlightedIndex;
                      const isAlreadyAdded = watchlistItems.some(
                        (w) => w.symbol.toUpperCase() === item.symbol.toUpperCase()
                      );

                      return (
                        <div
                          key={`${item.token}-${item.exchangeSegment}-${idx}`}
                          onClick={() => handleToggleWatchlistItem(item)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                            isHighlighted ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                          }`}
                        >
                          {/* Left Details */}
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-xs text-gray-900 font-mono tracking-tight">
                                {item.tradingSymbol || item.symbol}
                              </span>

                              {/* Segment / Option Type Badge */}
                              {item.instrumentType === 'CE' && (
                                <span className="text-[9px] font-extrabold px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono">
                                  CE
                                </span>
                              )}
                              {item.instrumentType === 'PE' && (
                                <span className="text-[9px] font-extrabold px-1 py-0.2 bg-rose-100 text-rose-800 rounded font-mono">
                                  PE
                                </span>
                              )}
                              {item.instrumentType === 'FUT' && (
                                <span className="text-[9px] font-extrabold px-1 py-0.2 bg-purple-100 text-purple-800 rounded font-mono">
                                  FUT
                                </span>
                              )}
                            </div>

                            {/* Subtitle / Company / Expiry / Lot */}
                            <p className="text-[11px] text-gray-500 truncate mt-0.5">
                              {item.name || item.tradingSymbol}
                              {item.lotSize > 1 && (
                                <span className="ml-1.5 text-gray-400 font-mono">
                                  Lot: {item.lotSize}
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Right Badges & One-Click Add */}
                          <div className="flex items-center space-x-2 shrink-0">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${
                                item.exchange === 'BSE'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200/60'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              }`}
                            >
                              {item.exchange}
                            </span>

                            {isAlreadyAdded ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleWatchlistItem(item);
                                }}
                                className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center space-x-1 hover:bg-emerald-100 transition-colors shadow-2xs"
                                title="Click to remove from watchlist"
                              >
                                <Check className="w-3 h-3" />
                                <span>Added</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleWatchlistItem(item);
                                }}
                                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold flex items-center space-x-0.5 transition-colors shadow-2xs"
                                title="Add to Watchlist"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Keyboard Navigation Footer Hint */}
                <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-between font-mono">
                  <span>↑↓ Navigate</span>
                  <span>↵ Add</span>
                  <span>esc Dismiss</span>
                </div>
              </div>
            )}
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
              {isLoadingWatchlist ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400 font-sans text-xs">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin mx-auto mb-1" />
                    <span>Loading watchlist...</span>
                  </td>
                </tr>
              ) : filteredWatchlist.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400 font-sans text-xs">
                    No instruments in this segment. Search above to add instruments to your watchlist.
                  </td>
                </tr>
              ) : (
                filteredWatchlist.map((item) => {
                  const sym = item.symbol;
                  const q = quotes[sym];
                  const flash = flashStates[sym];
                  const isPos = (q?.change || 0) >= 0;

                  return (
                    <tr
                      key={item.id ? `${item.id}-${sym}` : sym}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        flash === 'up' ? 'bg-emerald-50/20' : flash === 'down' ? 'bg-red-50/20' : ''
                      }`}
                    >
                      {/* Instrument Symbol & Proper Badge */}
                      <td className="py-3 px-4 font-bold text-gray-900 font-sans flex items-center space-x-2">
                        <span>{item.tradingSymbol || sym}</span>
                        {getInstrumentBadge(item, sym)}
                      </td>

                      <td className="py-3 px-4 text-gray-500 font-sans">
                        {q?.exchange || item.exchange || (sym === 'SENSEX' ? 'BSE' : 'NSE')}
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
                            onClick={() => handleRemoveFromWatchlist(sym)}
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
