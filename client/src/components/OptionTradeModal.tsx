import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { OptionContract, TraderOrderRequest } from '../types';
import {
  X, Zap, ShieldAlert, CheckCircle2, AlertCircle, ArrowUpRight,
  ArrowDownRight, Calculator, Sliders, ChevronDown
} from 'lucide-react';

interface OptionTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  underlying: string;
  strike: number;
  type: 'CE' | 'PE';
  contract: OptionContract;
  defaultSide?: 'BUY' | 'SELL';
  lotSize: number;
  initialMode?: 'PAPER' | 'LIVE';
  onOrderSuccess?: (msg: string) => void;
}

export const OptionTradeModal: React.FC<OptionTradeModalProps> = ({
  isOpen,
  onClose,
  underlying,
  strike,
  type,
  contract,
  defaultSide = 'BUY',
  lotSize,
  initialMode = 'PAPER',
  onOrderSuccess,
}) => {
  if (!isOpen) return null;

  const [side, setSide] = useState<'BUY' | 'SELL'>(defaultSide);
  const [product, setProduct] = useState<'MIS' | 'NRML'>('MIS');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'SL'>('MARKET');
  const [lots, setLots] = useState<number>(1);
  const [price, setPrice] = useState<number>(contract.ltp || 100.0);
  const [stopLossPoints, setStopLossPoints] = useState<number>(Math.round(contract.ltp * 0.20) || 20);
  const [targetPoints, setTargetPoints] = useState<number>(Math.round(contract.ltp * 0.40) || 40);
  const [mode, setMode] = useState<'PAPER' | 'LIVE'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableMargin, setAvailableMargin] = useState<number | null>(null);

  useEffect(() => {
    api.getBrokerProfile().then((p) => {
      if (p && typeof p.available_margin === 'number') {
        setAvailableMargin(p.available_margin);
      }
    }).catch(() => {});
  }, []);

  const cleanSymbol = contract.symbol || `${underlying} ${strike} ${type}`;
  const totalQuantity = lots * lotSize;
  const entryPrice = orderType === 'MARKET' ? (contract.ltp || price) : price;

  // Stop loss and Target price calculations
  const calculatedStopLoss = side === 'BUY'
    ? Math.max(0.05, Math.round((entryPrice - stopLossPoints) * 10) / 10)
    : Math.round((entryPrice + stopLossPoints) * 10) / 10;

  const calculatedTarget = side === 'BUY'
    ? Math.round((entryPrice + targetPoints) * 10) / 10
    : Math.max(0.05, Math.round((entryPrice - targetPoints) * 10) / 10);

  // Financial calculations
  const estimatedMargin = side === 'BUY'
    ? Math.round(entryPrice * totalQuantity)
    : Math.round((entryPrice * totalQuantity) * 0.25 + 75000); // Margin for option selling

  const maxRisk = Math.round(stopLossPoints * totalQuantity);
  const maxReward = Math.round(targetPoints * totalQuantity);
  const riskRewardRatio = stopLossPoints > 0 ? (targetPoints / stopLossPoints).toFixed(1) : '1.0';

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: TraderOrderRequest = {
        symbol: cleanSymbol,
        exchange: underlying.toUpperCase() === 'SENSEX' ? 'BSE' : 'NSE',
        side,
        order_type: orderType === 'SL' ? 'LIMIT' : orderType,
        product,
        lots,
        quantity: totalQuantity,
        price: orderType === 'MARKET' ? 0.0 : entryPrice,
        stop_loss: calculatedStopLoss,
        target: calculatedTarget,
        mode,
      };

      const res = await api.placeTraderOrder(payload);
      if (res.success) {
        if (onOrderSuccess) {
          onOrderSuccess(`${side} ${totalQuantity}x ${cleanSymbol} executed successfully (${res.order_id || 'OK'}).`);
        }
        onClose();
      } else {
        setError(res.message || 'Order submission failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to place order.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-3 font-sans animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden relative">
        {/* Top Header Accent */}
        <div className={`h-1.5 w-full ${side === 'BUY' ? 'bg-blue-600' : 'bg-red-600'}`} />

        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase font-mono ${
              type === 'CE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'
            }`}>
              {type}
            </span>
            <div>
              <h3 className="text-sm font-bold text-gray-900 font-mono tracking-tight">
                {underlying} {strike} {type}
              </h3>
              <div className="text-[11px] text-gray-500 font-mono flex items-center gap-2 mt-0.5">
                <span>LTP: <strong className="text-gray-800 font-bold">₹{contract.ltp?.toFixed(2) || '0.00'}</strong></span>
                <span>·</span>
                <span>Lot: {lotSize} Qty</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handlePlaceOrder} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action (BUY / SELL) Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setSide('BUY')}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                side === 'BUY'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              BUY (Long)
            </button>
            <button
              type="button"
              onClick={() => setSide('SELL')}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                side === 'SELL'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              SELL (Short)
            </button>
          </div>

          {/* Product & Order Type Rows */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Product */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Product</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setProduct('MIS')}
                  className={`py-1 rounded text-xs font-bold transition-all ${
                    product === 'MIS' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500'
                  }`}
                >
                  Intraday (MIS)
                </button>
                <button
                  type="button"
                  onClick={() => setProduct('NRML')}
                  className={`py-1 rounded text-xs font-bold transition-all ${
                    product === 'NRML' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500'
                  }`}
                >
                  Overnight (NRML)
                </button>
              </div>
            </div>

            {/* Order Type */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Order Type</label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg text-[11px]">
                {(['MARKET', 'LIMIT', 'SL'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOrderType(t)}
                    className={`py-1 rounded font-bold transition-all ${
                      orderType === t ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lots & Price Inputs */}
          <div className="grid grid-cols-2 gap-3">
            {/* Lots Counter */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Lots ({totalQuantity} Qty)
              </label>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setLots(Math.max(1, lots - 1))}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold border-r border-gray-200"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={lots}
                  onChange={(e) => setLots(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-center text-xs font-bold text-gray-900 py-1.5 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setLots(lots + 1)}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold border-l border-gray-200"
                >
                  +
                </button>
              </div>
            </div>

            {/* Execution / Limit Price */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                {orderType === 'MARKET' ? 'Market Fill (LTP)' : 'Limit Price (₹)'}
              </label>
              <input
                type="number"
                step="0.05"
                disabled={orderType === 'MARKET'}
                value={orderType === 'MARKET' ? contract.ltp : price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 bg-white disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {/* SL & Target (TP) Risk Management Controls */}
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-blue-900">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>Stop Loss & Target Protection (Bracketed)</span>
              </span>
              <span className="font-mono text-gray-600">R:R 1:{riskRewardRatio}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-red-600 mb-0.5">
                  Stop Loss (-{stopLossPoints} pts)
                </label>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={stopLossPoints}
                    onChange={(e) => setStopLossPoints(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono font-bold text-red-700 focus:outline-none focus:ring-1 focus:ring-red-400"
                  />
                  <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap">₹{calculatedStopLoss}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-emerald-600 mb-0.5">
                  Target (+{targetPoints} pts)
                </label>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={targetPoints}
                    onChange={(e) => setTargetPoints(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                  <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap">₹{calculatedTarget}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary Strip */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div>
              <span className="text-[10px] uppercase text-gray-400 font-semibold block truncate">Available</span>
              <span className="font-bold text-emerald-700 block mt-0.5 truncate">
                ₹{availableMargin !== null ? availableMargin.toLocaleString('en-IN') : '0'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-gray-400 font-semibold block truncate">Needed</span>
              <span className="font-bold text-gray-900 block mt-0.5 truncate">
                ₹{estimatedMargin.toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-gray-400 font-semibold block truncate">Max Risk</span>
              <span className="font-bold text-red-600 block mt-0.5 truncate">-₹{maxRisk.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-gray-400 font-semibold block truncate">Max Profit</span>
              <span className="font-bold text-emerald-600 block mt-0.5 truncate">+₹{maxReward.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Insufficient Margin Warning in Live Mode */}
          {mode === 'LIVE' && availableMargin !== null && estimatedMargin > availableMargin && (
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Available margin (₹{availableMargin.toLocaleString('en-IN')}) is lower than needed (₹{estimatedMargin.toLocaleString('en-IN')}).</span>
            </div>
          )}

          {/* Mode Switch & Execution Button */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-semibold text-gray-500">Execution:</span>
              <button
                type="button"
                onClick={() => setMode(mode === 'PAPER' ? 'LIVE' : 'PAPER')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider transition-all ${
                  mode === 'LIVE'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}
              >
                {mode === 'LIVE' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span>LIVE REAL (Kotak Neo)</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>PAPER (Simulation)</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all flex items-center gap-1.5 ${
                  side === 'BUY'
                    ? 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                    : 'bg-red-600 hover:bg-red-700 active:scale-95'
                }`}
              >
                {loading ? (
                  <span>Submitting...</span>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>{side} {totalQuantity} Qty</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
