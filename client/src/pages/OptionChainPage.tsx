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
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-[#151922] border border-[#232936] rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Index Tabs */}
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">
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
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-[#0B0E14] text-gray-400 hover:text-white border border-[#232936]'
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
              <div className="border-r border-[#232936] pr-6">
                <span className="text-gray-400 block">Underlying LTP</span>
                <span className="text-lg font-bold text-white">₹{formatPrice(chain.underlying_ltp)}</span>
              </div>
              <div className="border-r border-[#232936] pr-6">
                <span className="text-gray-400 block">PCR (OI)</span>
                <span className={`text-lg font-bold ${Number(pcr) > 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pcr}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">Lot Size</span>
                <span className="text-lg font-bold text-blue-400">{chain.lot_size}</span>
              </div>
            </div>
          )}

          {/* Expiry & Strike Controls */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              <select
                value={selectedExpiry}
                onChange={(e) => setSelectedExpiry(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none font-mono"
              >
                {chain?.expiries.map((exp) => (
                  <option key={exp} value={exp} className="bg-[#151922] text-white">
                    {exp}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => fetchChain(underlying, selectedExpiry)}
              disabled={loading}
              className="p-2 rounded-lg bg-[#0B0E14] border border-[#232936] text-gray-400 hover:text-white transition-colors"
              title="Refresh Option Chain"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Option Chain Table */}
      <div className="bg-[#151922] border border-[#232936] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-xs font-mono">
            <thead>
              {/* Top grouping header */}
              <tr className="border-b border-[#232936] bg-[#10141D] text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th colSpan={6} className="py-2.5 px-3 border-r border-[#232936] text-emerald-400">
                  CALL OPTIONS (CE)
                </th>
                <th className="py-2.5 px-4 bg-[#181D28] text-white font-extrabold border-r border-l border-[#232936]">
                  STRIKE
                </th>
                <th colSpan={6} className="py-2.5 px-3 border-l border-[#232936] text-red-400">
                  PUT OPTIONS (PE)
                </th>
              </tr>
              {/* Column header */}
              <tr className="border-b border-[#232936] bg-[#0E121A] text-[10px] text-gray-400 uppercase">
                {/* Calls */}
                <th className="py-2 px-3">OI</th>
                <th className="py-2 px-3">Chg OI</th>
                <th className="py-2 px-3">Volume</th>
                <th className="py-2 px-3">Bid</th>
                <th className="py-2 px-3">Ask</th>
                <th className="py-2 px-3 border-r border-[#232936] text-emerald-400 font-bold">LTP</th>

                {/* Strike */}
                <th className="py-2 px-4 bg-[#141923] text-white font-bold border-r border-l border-[#232936]">
                  Price
                </th>

                {/* Puts */}
                <th className="py-2 px-3 border-l border-[#232936] text-red-400 font-bold">LTP</th>
                <th className="py-2 px-3">Bid</th>
                <th className="py-2 px-3">Ask</th>
                <th className="py-2 px-3">Volume</th>
                <th className="py-2 px-3">Chg OI</th>
                <th className="py-2 px-3">OI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232936]/60">
              {displayedStrikes.map((s) => {
                const isATM = s.strike_price === atmStrike;
                const callITM = s.strike_price < (chain?.underlying_ltp || 0);
                const putITM = s.strike_price > (chain?.underlying_ltp || 0);

                return (
                  <tr
                    key={s.strike_price}
                    className={`hover:bg-[#1D2330] transition-colors ${
                      isATM ? 'bg-blue-600/10 font-bold' : ''
                    }`}
                  >
                    {/* Call Columns */}
                    <td className={`py-2 px-3 ${callITM ? 'bg-emerald-950/15' : ''} text-gray-300`}>
                      {formatNum(s.call?.open_interest)}
                    </td>
                    <td
                      className={`py-2 px-3 ${callITM ? 'bg-emerald-950/15' : ''} ${
                        (s.call?.change_oi || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {(s.call?.change_oi || 0) >= 0 ? '+' : ''}{formatNum(s.call?.change_oi)}
                    </td>
                    <td className={`py-2 px-3 ${callITM ? 'bg-emerald-950/15' : ''} text-gray-400`}>
                      {formatNum(s.call?.volume)}
                    </td>
                    <td className={`py-2 px-3 ${callITM ? 'bg-emerald-950/15' : ''} text-gray-300`}>
                      {formatPrice(s.call?.bid)}
                    </td>
                    <td className={`py-2 px-3 ${callITM ? 'bg-emerald-950/15' : ''} text-gray-300`}>
                      {formatPrice(s.call?.ask)}
                    </td>
                    <td
                      className={`py-2 px-3 border-r border-[#232936] font-bold text-white ${
                        callITM ? 'bg-emerald-950/25 text-emerald-300' : ''
                      }`}
                    >
                      ₹{formatPrice(s.call?.ltp)}
                    </td>

                    {/* Strike */}
                    <td
                      className={`py-2 px-4 bg-[#131722] text-white font-extrabold border-r border-l border-[#232936] ${
                        isATM ? 'text-amber-400 bg-amber-400/10 ring-1 ring-amber-400' : ''
                      }`}
                    >
                      <span>{s.strike_price}</span>
                      {isATM && <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300">ATM</span>}
                    </td>

                    {/* Put Columns */}
                    <td
                      className={`py-2 px-3 border-l border-[#232936] font-bold text-white ${
                        putITM ? 'bg-red-950/25 text-red-300' : ''
                      }`}
                    >
                      ₹{formatPrice(s.put?.ltp)}
                    </td>
                    <td className={`py-2 px-3 ${putITM ? 'bg-red-950/15' : ''} text-gray-300`}>
                      {formatPrice(s.put?.bid)}
                    </td>
                    <td className={`py-2 px-3 ${putITM ? 'bg-red-950/15' : ''} text-gray-300`}>
                      {formatPrice(s.put?.ask)}
                    </td>
                    <td className={`py-2 px-3 ${putITM ? 'bg-red-950/15' : ''} text-gray-400`}>
                      {formatNum(s.put?.volume)}
                    </td>
                    <td
                      className={`py-2 px-3 ${putITM ? 'bg-red-950/15' : ''} ${
                        (s.put?.change_oi || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {(s.put?.change_oi || 0) >= 0 ? '+' : ''}{formatNum(s.put?.change_oi)}
                    </td>
                    <td className={`py-2 px-3 ${putITM ? 'bg-red-950/15' : ''} text-gray-300`}>
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
