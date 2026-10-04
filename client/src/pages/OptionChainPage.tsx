import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { OptionChain, OptionStrike } from '../types';
import { Layers, Calendar, Filter, RefreshCw, AlertCircle, Info } from 'lucide-react';

interface OptionChainPageProps {
  initialUnderlying?: string;
}

export const OptionChainPage: React.FC<OptionChainPageProps> = ({
  initialUnderlying = 'NIFTY',
}) => {
  const [underlying, setUnderlying] = useState(initialUnderlying);
  const [chain, setChain] = useState<OptionChain | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strikeFilter, setStrikeFilter] = useState<string>('all'); // all, atm, near

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
      const start = Math.max(0, atmIndex - 5);
      const end = Math.min(displayedStrikes.length, atmIndex + 6);
      displayedStrikes = displayedStrikes.slice(start, end);
    }
  }

  const formatNum = (val?: number) => {
    if (val === undefined || val === null) return '-';
    return val.toLocaleString('en-IN');
  };

  const formatPrice = (val?: number) => {
    if (val === undefined || val === null) return '-';
    return val.toFixed(2);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header & Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Index Tabs */}
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider font-mono">
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
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    underlying === u
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:text-black border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Underling LTP & PCR Stats */}
          {chain && (
            <div className="flex items-center space-x-6 font-mono text-xs">
              <div className="border-r border-gray-200 pr-6">
                <span className="text-gray-500 block">Underlying LTP</span>
                <span className="text-lg font-extrabold text-black">₹{formatPrice(chain.underlying_ltp)}</span>
              </div>
              <div className="border-r border-gray-200 pr-6">
                <span className="text-gray-500 block">PCR (OI)</span>
                <span className={`text-lg font-extrabold ${Number(pcr) > 1 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {pcr}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Lot Size</span>
                <span className="text-lg font-extrabold text-blue-700">{chain.lot_size}</span>
              </div>
            </div>
          )}

          {/* Expiry & Strike Controls */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 shadow-xs">
              <Calendar className="w-4 h-4 text-gray-500" />
              <select
                value={selectedExpiry}
                onChange={(e) => setSelectedExpiry(e.target.value)}
                className="bg-transparent text-xs text-gray-900 focus:outline-none font-mono font-medium"
              >
                {chain?.expiries.map((exp) => (
                  <option key={exp} value={exp} className="bg-white text-gray-900">
                    {exp}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => fetchChain(underlying, selectedExpiry)}
              disabled={loading}
              className="p-2 rounded-lg bg-white border border-gray-300 text-gray-600 hover:text-black hover:bg-gray-50 transition-colors shadow-xs"
              title="Refresh Option Chain"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Option Chain Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-xs font-mono">
            <thead>
              {/* Top grouping header */}
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                <th colSpan={6} className="py-2.5 px-3 border-r border-gray-200 text-emerald-800">
                  CALL OPTIONS (CE)
                </th>
                <th className="py-2.5 px-4 bg-gray-100 text-black font-extrabold border-r border-l border-gray-200">
                  STRIKE
                </th>
                <th colSpan={6} className="py-2.5 px-3 border-l border-gray-200 text-red-800">
                  PUT OPTIONS (PE)
                </th>
              </tr>
              {/* Column header */}
              <tr className="border-b border-gray-200 bg-gray-50 text-[10px] text-gray-600 font-bold uppercase">
                {/* Calls */}
                <th className="py-2 px-3">OI</th>
                <th className="py-2 px-3">Chg OI</th>
                <th className="py-2 px-3">Volume</th>
                <th className="py-2 px-3">Bid</th>
                <th className="py-2 px-3">Ask</th>
                <th className="py-2 px-3 border-r border-gray-200 text-emerald-800 font-bold">LTP</th>

                {/* Strike */}
                <th className="py-2 px-4 bg-gray-100 text-black font-bold border-r border-l border-gray-200">
                  Price
                </th>

                {/* Puts */}
                <th className="py-2 px-3 border-l border-gray-200 text-red-800 font-bold">LTP</th>
                <th className="py-2 px-3">Bid</th>
                <th className="py-2 px-3">Ask</th>
                <th className="py-2 px-3">Volume</th>
                <th className="py-2 px-3">Chg OI</th>
                <th className="py-2 px-3">OI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedStrikes.map((s) => {
                const isATM = s.strike_price === atmStrike;
                const callITM = s.strike_price < (chain?.underlying_ltp || 0);
                const putITM = s.strike_price > (chain?.underlying_ltp || 0);

                return (
                  <tr
                    key={s.strike_price}
                    className={`hover:bg-gray-50/80 transition-colors ${
                      isATM ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    {/* Call Columns */}
                    <td className={`py-2 px-3 ${callITM ? 'bg-emerald-50/60 font-semibold' : ''} text-gray-700`}>
                      {formatNum(s.call?.open_interest)}
                    </td>
                    <td
                      className={`py-2 px-3 ${callITM ? 'bg-emerald-50/60' : ''} ${
                        (s.call?.change_oi || 0) >= 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'
                      }`}
                    >
                      {(s.call?.change_oi || 0) >= 0 ? '+' : ''}{formatNum(s.call?.change_oi)}
                    </td>
                    <td className={`py-2 px-3 ${callITM ? 'bg-emerald-50/60' : ''} text-gray-600`}>
                      {formatNum(s.call?.volume)}
                    </td>
                    <td className={`py-2 px-3 ${callITM ? 'bg-emerald-50/60' : ''} text-gray-700`}>
                      {formatPrice(s.call?.bid)}
                    </td>
                    <td className={`py-2 px-3 ${callITM ? 'bg-emerald-50/60' : ''} text-gray-700`}>
                      {formatPrice(s.call?.ask)}
                    </td>
                    <td
                      className={`py-2 px-3 border-r border-gray-200 font-bold text-gray-900 ${
                        callITM ? 'bg-emerald-50/80 text-emerald-900' : ''
                      }`}
                    >
                      ₹{formatPrice(s.call?.ltp)}
                    </td>

                    {/* Strike */}
                    <td
                      className={`py-2 px-4 bg-gray-50 text-black font-extrabold border-r border-l border-gray-200 ${
                        isATM ? 'bg-amber-100 text-amber-950 font-extrabold ring-1 ring-amber-400' : ''
                      }`}
                    >
                      <span>{s.strike_price}</span>
                      {isATM && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-amber-200 text-amber-900 font-bold">ATM</span>}
                    </td>

                    {/* Put Columns */}
                    <td
                      className={`py-2 px-3 border-l border-gray-200 font-bold text-gray-900 ${
                        putITM ? 'bg-red-50/80 text-red-900' : ''
                      }`}
                    >
                      ₹{formatPrice(s.put?.ltp)}
                    </td>
                    <td className={`py-2 px-3 ${putITM ? 'bg-red-50/60' : ''} text-gray-700`}>
                      {formatPrice(s.put?.bid)}
                    </td>
                    <td className={`py-2 px-3 ${putITM ? 'bg-red-50/60' : ''} text-gray-700`}>
                      {formatPrice(s.put?.ask)}
                    </td>
                    <td className={`py-2 px-3 ${putITM ? 'bg-red-50/60' : ''} text-gray-600`}>
                      {formatNum(s.put?.volume)}
                    </td>
                    <td
                      className={`py-2 px-3 ${putITM ? 'bg-red-50/60' : ''} ${
                        (s.put?.change_oi || 0) >= 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'
                      }`}
                    >
                      {(s.put?.change_oi || 0) >= 0 ? '+' : ''}{formatNum(s.put?.change_oi)}
                    </td>
                    <td className={`py-2 px-3 ${putITM ? 'bg-red-50/60 font-semibold' : ''} text-gray-700`}>
                      {formatNum(s.put?.open_interest)}
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
