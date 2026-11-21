import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { OptionChain, OptionStrike, OptionContract } from '../types';
import {
  Calendar, Filter, RefreshCw, AlertCircle, Zap, X, CheckCircle2,
  Search, ChevronDown, ArrowUpRight, ArrowDownRight, Target
} from 'lucide-react';
import { OptionTradeModal } from '../components/OptionTradeModal';

interface OptionChainPageProps {
  initialUnderlying?: string;
  onNavigateTrader?: (symbol: string, optionDetails?: any) => void;
  tradingMode?: 'PAPER' | 'LIVE';
}

const POPULAR_FNO_SYMBOLS = [
  { symbol: 'NIFTY', name: 'NIFTY 50 Index', isIndex: true },
  { symbol: 'BANKNIFTY', name: 'Nifty Bank Index', isIndex: true },
  { symbol: 'SENSEX', name: 'BSE Sensex Index', isIndex: true },
  { symbol: 'FINNIFTY', name: 'Nifty Financial Services', isIndex: true },
  { symbol: 'MIDCPNIFTY', name: 'Nifty Midcap Select', isIndex: true },
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', isIndex: false },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', isIndex: false },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', isIndex: false },
  { symbol: 'TCS', name: 'Tata Consultancy Services', isIndex: false },
  { symbol: 'INFY', name: 'Infosys Ltd', isIndex: false },
  { symbol: 'SBIN', name: 'State Bank of India', isIndex: false },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', isIndex: false },
  { symbol: 'ITC', name: 'ITC Ltd', isIndex: false },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', isIndex: false },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd', isIndex: false },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', isIndex: false },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd', isIndex: false },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', isIndex: false },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India', isIndex: false },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', isIndex: false },
  { symbol: 'TITAN', name: 'Titan Company Ltd', isIndex: false },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', isIndex: false },
  { symbol: 'WIPRO', name: 'Wipro Ltd', isIndex: false },
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd', isIndex: false },
  { symbol: 'M&M', name: 'Mahindra & Mahindra', isIndex: false },
];

export const OptionChainPage: React.FC<OptionChainPageProps> = ({
  initialUnderlying = 'NIFTY',
  onNavigateTrader,
  tradingMode = 'PAPER',
}) => {
  const [underlying, setUnderlying] = useState(initialUnderlying);
  const [chain, setChain] = useState<OptionChain | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strikeFilter, setStrikeFilter] = useState<string>('near_8'); // near_5, near_8, near_15, near_25, all
  const [selectedStrikeJump, setSelectedStrikeJump] = useState<string>('');

  // Symbol Selector Dropdown State
  const [isSymbolDropdownOpen, setIsSymbolDropdownOpen] = useState(false);
  const [symbolSearchQuery, setSymbolSearchQuery] = useState('');
  const symbolDropdownRef = useRef<HTMLDivElement>(null);

  // Dhan-style Trade Ticket State
  const [activeTradeTicket, setActiveTradeTicket] = useState<{
    underlying: string;
    strike: number;
    type: 'CE' | 'PE';
    contract: OptionContract;
    defaultSide: 'BUY' | 'SELL';
  } | null>(null);
  const [tradeSuccessToast, setTradeSuccessToast] = useState<string | null>(null);

  const [selectedContract, setSelectedContract] = useState<{
    contract: OptionContract;
    type: 'CE' | 'PE';
    strike: number;
  } | null>(null);

  const spotRowRef = useRef<HTMLTableRowElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const fetchChain = async (und: string, exp?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOptionChain(und, exp);
      setChain(data);
      if (!selectedExpiry || !data.expiries.includes(selectedExpiry)) {
        setSelectedExpiry(data.expiry);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch option chain');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChain(underlying, selectedExpiry || undefined);
  }, [underlying, selectedExpiry]);

  // Close symbol dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (symbolDropdownRef.current && !symbolDropdownRef.current.contains(e.target as Node)) {
        setIsSymbolDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Derived calculations: Total OI, PCR, ATM Strike, Max OI for visual bars
  let totalCallOI = 0;
  let totalPutOI = 0;
  let atmStrike = 0;
  let minDiff = Infinity;
  let maxOI = 1;

  if (chain && chain.strikes.length > 0) {
    chain.strikes.forEach((s) => {
      const cOI = s.call?.open_interest || 0;
      const pOI = s.put?.open_interest || 0;
      totalCallOI += cOI;
      totalPutOI += pOI;
      if (cOI > maxOI) maxOI = cOI;
      if (pOI > maxOI) maxOI = pOI;

      const diff = Math.abs(s.strike_price - chain.underlying_ltp);
      if (diff < minDiff) {
        minDiff = diff;
        atmStrike = s.strike_price;
      }
    });
  }

  const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : '--';

  // Filter strikes according to selected range
  let displayedStrikes = chain?.strikes || [];
  if (chain && chain.strikes.length > 0 && strikeFilter !== 'all') {
    const rangeCount = strikeFilter === 'near_5' ? 5
      : strikeFilter === 'near_8' ? 8
      : strikeFilter === 'near_15' ? 15
      : strikeFilter === 'near_25' ? 25
      : 8;

    const atmIndex = displayedStrikes.findIndex((s) => s.strike_price === atmStrike);
    if (atmIndex !== -1) {
      const start = Math.max(0, atmIndex - rangeCount);
      const end = Math.min(displayedStrikes.length, atmIndex + rangeCount + 1);
      displayedStrikes = displayedStrikes.slice(start, end);
    }
  }

  // Auto-scroll to center Spot Price Bar on data load
  useEffect(() => {
    if (chain && spotRowRef.current) {
      const timer = setTimeout(() => {
        spotRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [chain?.underlying, chain?.expiry, strikeFilter]);

  const handleJumpToStrike = (strikeStr: string) => {
    setSelectedStrikeJump(strikeStr);
    if (!strikeStr || strikeStr === 'all') return;
    const el = document.getElementById(`strike-row-${strikeStr}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-blue-100');
      setTimeout(() => el.classList.remove('bg-blue-100'), 1500);
    }
  };

  const formatNum = (val?: number | null) => {
    if (val === undefined || val === null) return '-';
    return val.toLocaleString('en-IN');
  };

  const formatChgOI = (val?: number | null) => {
    if (val === undefined || val === null) return '-';
    if (val === 0) return '0';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toLocaleString('en-IN')}`;
  };

  const formatVolume = (val?: number | null) => {
    if (val === undefined || val === null) return '0';
    return val.toLocaleString('en-IN');
  };

  const formatPrice = (val?: number | null) => {
    if (val === undefined || val === null) return '-';
    return val.toFixed(2);
  };

  const lotSize = chain?.lot_size || (
    underlying === 'BANKNIFTY' ? 30 :
    underlying === 'SENSEX' ? 20 :
    underlying === 'NIFTY' ? 65 : 1
  );

  const filteredSymbols = POPULAR_FNO_SYMBOLS.filter(
    (item) => item.symbol.toLowerCase().includes(symbolSearchQuery.toLowerCase()) ||
              item.name.toLowerCase().includes(symbolSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 font-sans">
      {/* Top Controls Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Quick Pills & Searchable F&O Stock Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono mr-1">
              Underlying:
            </span>

            {/* Default Index Quick Pills */}
            {['NIFTY', 'BANKNIFTY', 'SENSEX'].map((u) => (
              <button
                key={u}
                onClick={() => {
                  setUnderlying(u);
                  setSelectedExpiry('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                  underlying === u
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-gray-50 text-gray-700 hover:text-black border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {u}
              </button>
            ))}

            {/* NSE-Style Searchable F&O Symbol Dropdown */}
            <div className="relative" ref={symbolDropdownRef}>
              <button
                type="button"
                onClick={() => setIsSymbolDropdownOpen(!isSymbolDropdownOpen)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  !['NIFTY', 'BANKNIFTY', 'SENSEX'].includes(underlying)
                    ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Search className="w-3.5 h-3.5 text-gray-400" />
                <span>{!['NIFTY', 'BANKNIFTY', 'SENSEX'].includes(underlying) ? underlying : 'Select Stock F&O'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1" />
              </button>

              {isSymbolDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-2 z-50 animate-scale-in">
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search F&O symbol..."
                      value={symbolSearchQuery}
                      onChange={(e) => setSymbolSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-0.5">
                    {filteredSymbols.map((item) => (
                      <button
                        key={item.symbol}
                        onClick={() => {
                          setUnderlying(item.symbol);
                          setSelectedExpiry('');
                          setIsSymbolDropdownOpen(false);
                          setSymbolSearchQuery('');
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          underlying === item.symbol
                            ? 'bg-blue-600 text-white font-bold'
                            : 'hover:bg-gray-50 text-gray-800'
                        }`}
                      >
                        <div>
                          <span className="font-bold font-mono">{item.symbol}</span>
                          <span className={`block text-[10px] ${underlying === item.symbol ? 'text-blue-100' : 'text-gray-400'} truncate max-w-[140px]`}>
                            {item.name}
                          </span>
                        </div>
                        {item.isIndex && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold font-mono ${
                            underlying === item.symbol ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-500'
                          }`}>
                            IDX
                          </span>
                        )}
                      </button>
                    ))}
                    {filteredSymbols.length === 0 && (
                      <div className="py-4 text-center text-xs text-gray-400">
                        No F&O symbols found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center / Right: Expiry, Range, Jump-to-strike & Refresh */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Expiry Selector */}
            <div className="flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={selectedExpiry}
                onChange={(e) => setSelectedExpiry(e.target.value)}
                disabled={loading || !chain || chain.expiries.length === 0}
                className="bg-white border border-gray-200 text-xs font-semibold text-gray-900 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
              >
                {chain?.expiries.map((exp) => (
                  <option key={exp} value={exp}>
                    {exp}
                  </option>
                ))}
              </select>
            </div>

            {/* Strike Range Selector */}
            <div className="flex items-center space-x-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={strikeFilter}
                onChange={(e) => setStrikeFilter(e.target.value)}
                className="bg-white border border-gray-200 text-xs font-semibold text-gray-900 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
              >
                <option value="near_5">Near ATM (±5)</option>
                <option value="near_8">Near ATM (±8)</option>
                <option value="near_15">Near ATM (±15)</option>
                <option value="near_25">Near ATM (±25)</option>
                <option value="all">All Strikes</option>
              </select>
            </div>

            {/* NSE-Style Jump-To-Strike Selector */}
            <div className="flex items-center space-x-1.5">
              <Target className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={selectedStrikeJump}
                onChange={(e) => handleJumpToStrike(e.target.value)}
                disabled={loading || !chain || chain.strikes.length === 0}
                className="bg-white border border-gray-200 text-xs font-semibold text-gray-900 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
              >
                <option value="">Jump to Strike...</option>
                {chain?.strikes.map((s) => (
                  <option key={s.strike_price} value={s.strike_price}>
                    {s.strike_price.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchChain(underlying, selectedExpiry || undefined)}
              disabled={loading}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-black transition-colors"
              title="Refresh Option Chain"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Underlying Stats Bar */}
        {chain && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-4">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block font-mono">
                  {underlying} Spot
                </span>
                <span className="text-base font-bold font-mono text-gray-950">
                  ₹{chain.underlying_ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-6 w-[1px] bg-gray-200" />
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block font-mono">
                  Lot Size
                </span>
                <span className="text-sm font-bold font-mono text-gray-800">
                  {lotSize} Qty
                </span>
              </div>
              <div className="h-6 w-[1px] bg-gray-200" />
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block font-mono">
                  PCR (OI)
                </span>
                <span className={`text-sm font-bold font-mono ${parseFloat(pcr) >= 1 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {pcr}
                </span>
              </div>
              <div className="h-6 w-[1px] bg-gray-200" />
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block font-mono">
                  Total Calls OI
                </span>
                <span className="text-xs font-bold font-mono text-emerald-700">
                  {formatNum(totalCallOI)}
                </span>
              </div>
              <div className="h-6 w-[1px] bg-gray-200" />
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block font-mono">
                  Total Puts OI
                </span>
                <span className="text-xs font-bold font-mono text-red-700">
                  {formatNum(totalPutOI)}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-[11px] font-mono text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300" />
                <span>In-The-Money (ITM)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-white border border-gray-300" />
                <span>Out-Of-The-Money (OTM)</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center space-x-2 text-xs font-semibold shadow-2xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Option Chain Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs" ref={tableContainerRef}>
        <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
          <table className="w-full text-center text-xs border-collapse">
            {/* Top Multi-Header (Sticky) */}
            <thead className="sticky top-0 z-20 bg-gray-50 shadow-xs">
              <tr className="border-b border-gray-200 font-mono text-[10px]">
                <th colSpan={6} className="py-2 text-center text-emerald-800 font-bold border-r border-gray-200 uppercase tracking-widest bg-emerald-50/50">
                  Calls (CE)
                </th>
                <th className="py-2 px-3 text-center text-gray-900 font-bold uppercase tracking-wider bg-gray-200/80">
                  Strike
                </th>
                <th colSpan={6} className="py-2 text-center text-red-800 font-bold border-l border-gray-200 uppercase tracking-widest bg-red-50/50">
                  Puts (PE)
                </th>
              </tr>
              <tr className="bg-gray-100/90 border-b border-gray-200 text-gray-600 font-semibold text-[10px] font-mono">
                {/* Calls Headers */}
                <th className="py-2 px-2 text-right w-24" title="Open Interest">OI</th>
                <th className="py-2 px-2 text-right w-20" title="Change in Open Interest">Chg OI</th>
                <th className="py-2 px-2 text-right w-20" title="Traded Contracts Volume">Volume</th>
                <th className="py-2 px-2 text-right w-14" title="Implied Volatility (BSM)">IV</th>
                <th className="py-2 px-2 text-right w-16" title="Best Bid Price">Bid</th>
                <th className="py-2 px-3 text-right font-bold text-gray-900 border-r border-gray-300 w-28">LTP</th>

                {/* Strike Header */}
                <th className="py-2 px-4 text-center font-bold text-gray-950 bg-gray-200 w-24">Strike</th>

                {/* Puts Headers */}
                <th className="py-2 px-3 text-left font-bold text-gray-900 border-l border-gray-300 w-28">LTP</th>
                <th className="py-2 px-2 text-left w-16" title="Best Ask Price">Ask</th>
                <th className="py-2 px-2 text-left w-14" title="Implied Volatility (BSM)">IV</th>
                <th className="py-2 px-2 text-left w-20" title="Traded Contracts Volume">Volume</th>
                <th className="py-2 px-2 text-left w-20" title="Change in Open Interest">Chg OI</th>
                <th className="py-2 px-2 text-left w-24" title="Open Interest">OI</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
              {loading && !chain ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-gray-400 font-sans">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-blue-500" />
                    Fetching Option Chain from Kotak Neo...
                  </td>
                </tr>
              ) : displayedStrikes.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-gray-400 font-sans">
                    No option contracts available for this expiry.
                  </td>
                </tr>
              ) : (
                displayedStrikes.map((s, idx) => {
                  const isAtm = s.strike_price === atmStrike;
                  const spotPrice = chain?.underlying_ltp || 0;
                  // ITM conditions: Calls below Spot, Puts above Spot
                  const isCallItm = s.strike_price < spotPrice;
                  const isPutItm = s.strike_price > spotPrice;

                  // Visual OI Bar percentage
                  const callOiPct = Math.min(100, Math.round(((s.call?.open_interest || 0) / maxOI) * 100));
                  const putOiPct = Math.min(100, Math.round(((s.put?.open_interest || 0) / maxOI) * 100));

                  // Spot Price bar insertion between strikes
                  const nextStrike = displayedStrikes[idx + 1];
                  const shouldRenderSpotAfter =
                    spotPrice > 0 &&
                    s.strike_price <= spotPrice &&
                    (!nextStrike || nextStrike.strike_price > spotPrice);

                  return (
                    <React.Fragment key={s.strike_price}>
                      <tr
                        id={`strike-row-${s.strike_price}`}
                        className={`transition-colors ${
                          isAtm ? 'font-bold' : ''
                        }`}
                      >
                        {/* CALLS OI with Visual Progress Bar */}
                        <td className={`py-1.5 px-2 text-right relative overflow-hidden ${
                          isCallItm ? 'bg-amber-50/50' : 'bg-white'
                        }`}>
                          <div
                            className="absolute inset-y-0 right-0 bg-emerald-100/70 pointer-events-none transition-all"
                            style={{ width: `${callOiPct}%` }}
                          />
                          <span className="relative z-10 tabular-nums text-gray-700 font-medium">
                            {formatNum(s.call?.open_interest)}
                          </span>
                        </td>

                        {/* CALLS Change OI */}
                        <td className={`py-1.5 px-2 text-right tabular-nums ${
                          (s.call?.change_oi || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                        } ${isCallItm ? 'bg-amber-50/50' : 'bg-white'}`}>
                          {formatChgOI(s.call?.change_oi)}
                        </td>

                        {/* CALLS Volume */}
                        <td className={`py-1.5 px-2 text-right tabular-nums text-gray-500 ${
                          isCallItm ? 'bg-amber-50/50' : 'bg-white'
                        }`}>
                          {formatVolume(s.call?.volume)}
                        </td>

                        {/* CALLS IV */}
                        <td className={`py-1.5 px-2 text-right tabular-nums font-medium text-blue-600 ${
                          isCallItm ? 'bg-amber-50/50' : 'bg-white'
                        }`}>
                          {s.call?.iv ? `${s.call.iv.toFixed(1)}%` : '-'}
                        </td>

                        {/* CALLS Bid */}
                        <td className={`py-1.5 px-2 text-right tabular-nums text-gray-500 ${
                          isCallItm ? 'bg-amber-50/50' : 'bg-white'
                        }`}>
                          {formatPrice(s.call?.bid)}
                        </td>

                        {/* CALLS LTP WITH DHAN-STYLE BUY/SELL BUTTONS */}
                        <td
                          className={`py-1.5 px-2 text-right font-bold text-emerald-700 border-r border-gray-300 group/call relative ${
                            isCallItm ? 'bg-amber-50/60' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-end space-x-1.5">
                            {s.call && (
                              <div className="flex items-center space-x-1 opacity-0 group-hover/call:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTradeTicket({
                                      underlying,
                                      strike: s.strike_price,
                                      type: 'CE',
                                      contract: s.call!,
                                      defaultSide: 'BUY',
                                    });
                                  }}
                                  className="w-5 h-5 rounded text-[10px] font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs flex items-center justify-center transition-transform hover:scale-110"
                                  title={`Buy ${underlying} ${s.strike_price} CE`}
                                >
                                  B
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTradeTicket({
                                      underlying,
                                      strike: s.strike_price,
                                      type: 'CE',
                                      contract: s.call!,
                                      defaultSide: 'SELL',
                                    });
                                  }}
                                  className="w-5 h-5 rounded text-[10px] font-extrabold bg-red-600 hover:bg-red-700 text-white shadow-2xs flex items-center justify-center transition-transform hover:scale-110"
                                  title={`Sell ${underlying} ${s.strike_price} CE`}
                                >
                                  S
                                </button>
                              </div>
                            )}
                            <span
                              onClick={() => s.call && setSelectedContract({ contract: s.call, type: 'CE', strike: s.strike_price })}
                              className="cursor-pointer hover:underline tabular-nums"
                            >
                              {formatPrice(s.call?.ltp)}
                            </span>
                          </div>
                        </td>

                        {/* STRIKE PRICE (Center Column) */}
                        <td className={`py-1.5 px-3 font-bold text-center tabular-nums ${
                          isAtm
                            ? 'bg-amber-200 text-amber-950 ring-1 ring-amber-400 font-extrabold'
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          {s.strike_price.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                          {isAtm && (
                            <span className="ml-1 text-[8px] bg-amber-300 text-amber-950 px-1 py-0.2 rounded font-extrabold uppercase">
                              ATM
                            </span>
                          )}
                        </td>

                        {/* PUTS LTP WITH DHAN-STYLE BUY/SELL BUTTONS */}
                        <td
                          className={`py-1.5 px-2 text-left font-bold text-red-700 border-l border-gray-300 group/put relative ${
                            isPutItm ? 'bg-amber-50/60' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-start space-x-1.5">
                            <span
                              onClick={() => s.put && setSelectedContract({ contract: s.put, type: 'PE', strike: s.strike_price })}
                              className="cursor-pointer hover:underline tabular-nums"
                            >
                              {formatPrice(s.put?.ltp)}
                            </span>
                            {s.put && (
                              <div className="flex items-center space-x-1 opacity-0 group-hover/put:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTradeTicket({
                                      underlying,
                                      strike: s.strike_price,
                                      type: 'PE',
                                      contract: s.put!,
                                      defaultSide: 'BUY',
                                    });
                                  }}
                                  className="w-5 h-5 rounded text-[10px] font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs flex items-center justify-center transition-transform hover:scale-110"
                                  title={`Buy ${underlying} ${s.strike_price} PE`}
                                >
                                  B
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTradeTicket({
                                      underlying,
                                      strike: s.strike_price,
                                      type: 'PE',
                                      contract: s.put!,
                                      defaultSide: 'SELL',
                                    });
                                  }}
                                  className="w-5 h-5 rounded text-[10px] font-extrabold bg-red-600 hover:bg-red-700 text-white shadow-2xs flex items-center justify-center transition-transform hover:scale-110"
                                  title={`Sell ${underlying} ${s.strike_price} PE`}
                                >
                                  S
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* PUTS Ask */}
                        <td className={`py-1.5 px-2 text-left tabular-nums text-gray-500 ${
                          isPutItm ? 'bg-amber-50/50' : 'bg-white'
                        }`}>
                          {formatPrice(s.put?.ask)}
                        </td>

                        {/* PUTS IV */}
                        <td className={`py-1.5 px-2 text-left tabular-nums font-medium text-blue-600 ${
                          isPutItm ? 'bg-amber-50/50' : 'bg-white'
                        }`}>
                          {s.put?.iv ? `${s.put.iv.toFixed(1)}%` : '-'}
                        </td>

                        {/* PUTS Volume */}
                        <td className={`py-1.5 px-2 text-left tabular-nums text-gray-500 ${
                          isPutItm ? 'bg-amber-50/50' : 'bg-white'
                        }`}>
                          {formatVolume(s.put?.volume)}
                        </td>

                        {/* PUTS Change OI */}
                        <td className={`py-1.5 px-2 text-left tabular-nums ${
                          (s.put?.change_oi || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                        } ${isPutItm ? 'bg-amber-50/50' : 'bg-white'}`}>
                          {formatChgOI(s.put?.change_oi)}
                        </td>

                        {/* PUTS OI with Visual Progress Bar */}
                        <td className={`py-1.5 px-2 text-left relative overflow-hidden ${
                          isPutItm ? 'bg-amber-50/50' : 'bg-white'
                        }`}>
                          <div
                            className="absolute inset-y-0 left-0 bg-red-100/70 pointer-events-none transition-all"
                            style={{ width: `${putOiPct}%` }}
                          />
                          <span className="relative z-10 tabular-nums text-gray-700 font-medium">
                            {formatNum(s.put?.open_interest)}
                          </span>
                        </td>
                      </tr>

                      {/* Prominent Spot Price Bar Divider */}
                      {shouldRenderSpotAfter && (
                        <tr
                          ref={spotRowRef}
                          id="spot-price-bar"
                          className="bg-amber-400/20 border-y-2 border-amber-400"
                        >
                          <td colSpan={13} className="py-2 px-4 text-center">
                            <div className="inline-flex items-center space-x-2.5 px-4 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-950 font-bold text-xs tracking-wide shadow-2xs font-sans">
                              <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                              <span className="uppercase font-mono text-[11px] text-amber-800">Spot Reference:</span>
                              <span className="font-mono text-sm text-gray-950 font-extrabold">
                                {underlying} ₹{spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-amber-900 font-mono font-medium">· Lot: {lotSize} Qty</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Live Data Provenance Info */}
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-gray-500 font-mono gap-1.5">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-gray-800">Kotak Neo Live Option Stream:</span>
            <span>Tick quotes & OI updated in real-time</span>
          </div>
          <div className="text-[10px] text-gray-500">
            <span>IV: Black-Scholes European model · Depth: Live Level-2 order book during market hours</span>
          </div>
        </div>
      </div>

      {/* Selected Option Details Modal / Quick Inspector */}
      {selectedContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 font-sans">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-gray-200 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                  selectedContract.type === 'CE' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {selectedContract.type}
                </span>
                <h3 className="text-sm font-bold text-gray-900 font-mono">
                  {underlying} {selectedContract.strike} {selectedContract.type}
                </h3>
              </div>
              <button
                onClick={() => setSelectedContract(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-400 font-mono">LTP</span>
                  <div className="text-base font-bold font-mono text-gray-900 mt-0.5">
                    ₹{selectedContract.contract.ltp.toFixed(2)}
                  </div>
                </div>

                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-400 font-mono">Lot Size</span>
                  <div className="text-base font-bold font-mono text-gray-900 mt-0.5">
                    {lotSize} Qty
                  </div>
                </div>

                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-400 font-mono">Contract Token</span>
                  <div className="text-xs font-mono text-gray-700 mt-0.5 truncate">
                    {selectedContract.contract.token || 'N/A'}
                  </div>
                </div>

                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-400 font-mono">Estimated Value (1 Lot)</span>
                  <div className="text-base font-bold font-mono text-blue-700 mt-0.5">
                    ₹{(selectedContract.contract.ltp * lotSize).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-100 text-blue-900 text-[11px] leading-relaxed font-mono">
                <strong>Expiry:</strong> {selectedExpiry} · <strong>Symbol:</strong> {selectedContract.contract.symbol}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setSelectedContract(null)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
              {onNavigateTrader && (
                <button
                  onClick={() => {
                    const sym = selectedContract.contract.symbol || `${underlying}${selectedContract.strike}${selectedContract.type}`;
                    onNavigateTrader(sym, {
                      symbol: sym,
                      strike: selectedContract.strike,
                      type: selectedContract.type,
                      price: selectedContract.contract.ltp,
                      lots: 1
                    });
                  }}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-2xs"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Trade in Terminal</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dhan-Style Inline Trade Ticket Modal */}
      {activeTradeTicket && (
        <OptionTradeModal
          isOpen={!!activeTradeTicket}
          onClose={() => setActiveTradeTicket(null)}
          underlying={activeTradeTicket.underlying}
          strike={activeTradeTicket.strike}
          type={activeTradeTicket.type}
          contract={activeTradeTicket.contract}
          defaultSide={activeTradeTicket.defaultSide}
          lotSize={lotSize}
          initialMode={tradingMode}
          onOrderSuccess={(msg) => {
            setTradeSuccessToast(msg);
            setTimeout(() => setTradeSuccessToast(null), 5000);
          }}
        />
      )}

      {/* Trade Execution Success Toast */}
      {tradeSuccessToast && (
        <div className="fixed bottom-12 right-6 z-50 bg-emerald-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2.5 text-xs font-semibold animate-slide-up border border-emerald-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{tradeSuccessToast}</span>
          <button
            onClick={() => setTradeSuccessToast(null)}
            className="text-emerald-300 hover:text-white font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
