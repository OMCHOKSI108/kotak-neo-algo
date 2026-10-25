import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { OptionChain, OptionStrike, OptionContract } from '../types';
import { Layers, Calendar, Filter, RefreshCw, AlertCircle, Info, Zap, X, CheckCircle2 } from 'lucide-react';
import { OptionTradeModal } from '../components/OptionTradeModal';

interface OptionChainPageProps {
  initialUnderlying?: string;
  onNavigateTrader?: (symbol: string, optionDetails?: any) => void;
  tradingMode?: 'PAPER' | 'LIVE';
}

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
  const [strikeFilter, setStrikeFilter] = useState<string>('all'); // all, near
  const [selectedContract, setSelectedContract] = useState<{
    contract: OptionContract;
    type: 'CE' | 'PE';
    strike: number;
  } | null>(null);

  // Dhan-style Quick Trade Ticket State
  const [activeTradeTicket, setActiveTradeTicket] = useState<{
    underlying: string;
    strike: number;
    type: 'CE' | 'PE';
    contract: OptionContract;
    defaultSide: 'BUY' | 'SELL';
  } | null>(null);
  const [tradeSuccessToast, setTradeSuccessToast] = useState<string | null>(null);

  const supportedUnderlyings = ['NIFTY', 'BANKNIFTY', 'SENSEX'];

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

  // Derived calculations: Total OI, PCR
  let totalCallOI = 0;
  let totalPutOI = 0;
  let atmStrike = 0;
  let minDiff = Infinity;

  if (chain && chain.strikes.length > 0) {
    chain.strikes.forEach((s) => {
      if (s.call?.open_interest) totalCallOI += s.call.open_interest;
      if (s.put?.open_interest) totalPutOI += s.put.open_interest;

      const diff = Math.abs(s.strike_price - chain.underlying_ltp);
      if (diff < minDiff) {
        minDiff = diff;
        atmStrike = s.strike_price;
      }
    });
  }

  const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : '--';

  // Filter strikes
  let displayedStrikes = chain?.strikes || [];
  if (strikeFilter === 'near' && chain) {
    const atmIndex = displayedStrikes.findIndex((s) => s.strike_price === atmStrike);
    if (atmIndex !== -1) {
      const start = Math.max(0, atmIndex - 8);
      const end = Math.min(displayedStrikes.length, atmIndex + 9);
      displayedStrikes = displayedStrikes.slice(start, end);
    }
  }

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

  const lotSize = chain?.lot_size || (underlying === 'BANKNIFTY' ? 30 : underlying === 'SENSEX' ? 20 : 65);

  return (
    <div className="space-y-6 font-sans">
      {/* Header & Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Index Tabs */}
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
              Underlying Index
            </span>
            <div className="flex space-x-2 mt-1">
              {supportedUnderlyings.map((u) => (
                <button
                  key={u}
                  onClick={() => {
                    setUnderlying(u);
                    setSelectedExpiry('');
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    underlying === u
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white text-gray-700 hover:text-black border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Underlying Spot Price & Stats */}
          {chain && (
            <div className="flex items-center space-x-4 bg-gray-50 border border-gray-100 px-4 py-2 rounded-lg">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                  Underlying Spot
                </span>
                <span className="text-base font-bold font-mono text-gray-900">
                  ₹{chain.underlying_ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-7 w-[1px] bg-gray-200" />
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                  Lot Size
                </span>
                <span className="text-sm font-bold font-mono text-gray-800">
                  {lotSize}
                </span>
              </div>
              <div className="h-7 w-[1px] bg-gray-200" />
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                  PCR (OI)
                </span>
                <span className={`text-sm font-bold font-mono ${parseFloat(pcr) >= 1 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {pcr}
                </span>
              </div>
            </div>
          )}

          {/* Expiry Selector & Filter */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
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

            <div className="flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={strikeFilter}
                onChange={(e) => setStrikeFilter(e.target.value)}
                className="bg-white border border-gray-200 text-xs font-semibold text-gray-900 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
              >
                <option value="all">All Strikes</option>
                <option value="near">Near ATM (±8)</option>
              </select>
            </div>

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
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center space-x-2 text-xs font-semibold shadow-2xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Option Chain Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs">
            {/* Top Multi-Header */}
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 font-mono text-[10px]">
                <th colSpan={6} className="py-2 text-center text-emerald-800 font-bold border-r border-gray-200 uppercase tracking-widest bg-emerald-50/40">
                  Calls (CE)
                </th>
                <th className="py-2 text-center text-gray-900 font-bold uppercase tracking-wider bg-gray-100/70">
                  Strike
                </th>
                <th colSpan={6} className="py-2 text-center text-red-800 font-bold border-l border-gray-200 uppercase tracking-widest bg-red-50/40">
                  Puts (PE)
                </th>
              </tr>
              <tr className="bg-gray-50/50 border-b border-gray-200 text-gray-500 font-medium text-[10px] font-mono">
                {/* Calls Headers */}
                <th className="py-2 px-2 text-right" title="Open Interest">OI</th>
                <th className="py-2 px-2 text-right" title="Change in Open Interest">Chg OI</th>
                <th className="py-2 px-2 text-right" title="Traded Contracts Volume">Volume</th>
                <th className="py-2 px-2 text-right" title="Implied Volatility (computed via Black-Scholes European model)">IV</th>
                <th className="py-2 px-2 text-right" title="Best Bid Price (live during market hours)">Bid</th>
                <th className="py-2 px-3 text-right font-bold text-gray-900 border-r border-gray-200">LTP</th>

                {/* Strike Header */}
                <th className="py-2 px-4 text-center font-bold text-gray-900 bg-gray-100/50">Price</th>

                {/* Puts Headers */}
                <th className="py-2 px-3 text-left font-bold text-gray-900 border-l border-gray-200">LTP</th>
                <th className="py-2 px-2 text-left" title="Best Ask Price (live during market hours)">Ask</th>
                <th className="py-2 px-2 text-left" title="Implied Volatility (computed via Black-Scholes European model)">IV</th>
                <th className="py-2 px-2 text-left" title="Traded Contracts Volume">Volume</th>
                <th className="py-2 px-2 text-left" title="Change in Open Interest">Chg OI</th>
                <th className="py-2 px-2 text-left" title="Open Interest">OI</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
              {loading && !chain ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-gray-400 font-sans">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2" />
                    Fetching Option Chain from Kotak Neo...
                  </td>
                </tr>
              ) : displayedStrikes.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-gray-400 font-sans">
                    No option contracts available for this expiry.
                  </td>
                </tr>
              ) : (
                displayedStrikes.map((s) => {
                  const isAtm = s.strike_price === atmStrike;
                  const isCallItm = chain ? s.strike_price < chain.underlying_ltp : false;
                  const isPutItm = chain ? s.strike_price > chain.underlying_ltp : false;

                  return (
                    <tr
                      key={s.strike_price}
                      className={`hover:bg-blue-50/20 transition-colors ${
                        isAtm ? 'bg-amber-50/30 font-bold' : ''
                      }`}
                    >
                      {/* CALLS DATA */}
                      <td className={`py-2 px-2 text-right text-gray-600 ${isCallItm ? 'bg-amber-50/20' : ''}`}>
                        {formatNum(s.call?.open_interest)}
                      </td>
                      <td className={`py-2 px-2 text-right ${
                        (s.call?.change_oi || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                      } ${isCallItm ? 'bg-amber-50/20' : ''}`}>
                        {formatChgOI(s.call?.change_oi)}
                      </td>
                      <td className={`py-2 px-2 text-right text-gray-500 ${isCallItm ? 'bg-amber-50/20' : ''}`}>
                        {formatVolume(s.call?.volume)}
                      </td>
                      <td className={`py-2 px-2 text-right font-medium text-blue-600 ${isCallItm ? 'bg-amber-50/20' : ''}`}>
                        {s.call?.iv ? `${s.call.iv.toFixed(1)}%` : '-'}
                      </td>
                      <td className={`py-2 px-2 text-right text-gray-500 ${isCallItm ? 'bg-amber-50/20' : ''}`}>
                        {formatPrice(s.call?.bid)}
                      </td>
                      {/* CALLS LTP WITH DHAN-STYLE BUY/SELL BUTTONS */}
                      <td
                        className={`py-2 px-2 text-right font-bold text-emerald-700 border-r border-gray-200 group/call relative ${
                          isCallItm ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <div className="flex items-center justify-end space-x-1.5">
                          {s.call && (
                            <div className="flex items-center space-x-1 sm:opacity-0 group-hover/call:opacity-100 transition-opacity">
                              <button
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
                            className="cursor-pointer hover:underline font-mono"
                          >
                            {formatPrice(s.call?.ltp)}
                          </span>
                        </div>
                      </td>

                      {/* STRIKE PRICE */}
                      <td className={`py-2 px-4 font-bold text-center ${
                        isAtm
                          ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'
                          : 'bg-gray-100/60 text-gray-900'
                      }`}>
                        {s.strike_price.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                        {isAtm && <span className="ml-1 text-[9px] text-amber-700 font-extrabold uppercase">ATM</span>}
                      </td>

                      {/* PUTS LTP WITH DHAN-STYLE BUY/SELL BUTTONS */}
                      <td
                        className={`py-2 px-2 text-left font-bold text-red-700 border-l border-gray-200 group/put relative ${
                          isPutItm ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <div className="flex items-center justify-start space-x-1.5">
                          <span
                            onClick={() => s.put && setSelectedContract({ contract: s.put, type: 'PE', strike: s.strike_price })}
                            className="cursor-pointer hover:underline font-mono"
                          >
                            {formatPrice(s.put?.ltp)}
                          </span>
                          {s.put && (
                            <div className="flex items-center space-x-1 sm:opacity-0 group-hover/put:opacity-100 transition-opacity">
                              <button
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
                      <td className={`py-2 px-2 text-left text-gray-500 ${isPutItm ? 'bg-amber-50/20' : ''}`}>
                        {formatPrice(s.put?.ask)}
                      </td>
                      <td className={`py-2 px-2 text-left font-medium text-blue-600 ${isPutItm ? 'bg-amber-50/20' : ''}`}>
                        {s.put?.iv ? `${s.put.iv.toFixed(1)}%` : '-'}
                      </td>
                      <td className={`py-2 px-2 text-left text-gray-500 ${isPutItm ? 'bg-amber-50/20' : ''}`}>
                        {formatVolume(s.put?.volume)}
                      </td>
                      <td className={`py-2 px-2 text-left ${
                        (s.put?.change_oi || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                      } ${isPutItm ? 'bg-amber-50/20' : ''}`}>
                        {formatChgOI(s.put?.change_oi)}
                      </td>
                      <td className={`py-2 px-2 text-left text-gray-600 ${isPutItm ? 'bg-amber-50/20' : ''}`}>
                        {formatNum(s.put?.open_interest)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Live Data Provenance Info */}
        <div className="bg-gray-50/80 border-t border-gray-200 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-gray-500 font-mono gap-1.5">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-gray-700">Kotak Neo Live API:</span>
            <span>LTP, OI & Change in OI active</span>
          </div>
          <div className="text-[10px] text-gray-500">
            <span>IV: Black-Scholes European model · Bid/Ask: Level-2 live depth during market hours</span>
          </div>
        </div>
      </div>

      {/* Selected Option Details Modal / Drawer */}
      {selectedContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-gray-200 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
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
                  <span className="text-[10px] uppercase font-bold text-gray-400">LTP</span>
                  <div className="text-base font-bold font-mono text-gray-900 mt-0.5">
                    ₹{selectedContract.contract.ltp.toFixed(2)}
                  </div>
                </div>

                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Lot Size</span>
                  <div className="text-base font-bold font-mono text-gray-900 mt-0.5">
                    {lotSize}
                  </div>
                </div>

                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Contract Token</span>
                  <div className="text-xs font-mono text-gray-700 mt-0.5 truncate">
                    {selectedContract.contract.token || 'N/A'}
                  </div>
                </div>

                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Estimated Value (1 Lot)</span>
                  <div className="text-base font-bold font-mono text-blue-700 mt-0.5">
                    ₹{(selectedContract.contract.ltp * lotSize).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-100 text-blue-900 text-[11px] leading-relaxed">
                <strong>Expiry:</strong> {selectedExpiry} · <strong>Trading Symbol:</strong> {selectedContract.contract.symbol}
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
