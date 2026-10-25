import React, { useState, useEffect } from 'react';
import { User, BrokerAccount, UserTradingSettings, TraderOrderRequest, BrokerProfile } from '../types';
import { api } from '../api';
import {
  Zap, ShieldAlert, AlertTriangle, CheckCircle2,
  RefreshCw, Lock, ArrowRight, Settings2, Sliders, Wallet
} from 'lucide-react';

interface TraderPageProps {
  user: User;
  initialSymbol?: string;
  initialDetails?: any;
  onNavigate: (tab: string) => void;
  tradingMode?: 'PAPER' | 'LIVE';
  onModeChange?: (m: 'PAPER' | 'LIVE') => void;
}

export const TraderPage: React.FC<TraderPageProps> = ({
  user,
  initialSymbol = 'NIFTY',
  initialDetails,
  onNavigate,
  tradingMode = 'PAPER',
  onModeChange,
}) => {
  const [brokerAccounts, setBrokerAccounts] = useState<BrokerAccount[]>([]);
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [settings, setSettings] = useState<UserTradingSettings | null>(null);
  const [lotSizes, setLotSizes] = useState<Record<string, number>>({ NIFTY: 65, BANKNIFTY: 30, SENSEX: 20 });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Lot config form states
  const [niftyLots, setNiftyLots] = useState(1);
  const [bankniftyLots, setBankniftyLots] = useState(1);
  const [sensexLots, setSensexLots] = useState(1);
  const [maxDailyLoss, setMaxDailyLoss] = useState(5000);
  const [maxDailyTrades, setMaxDailyTrades] = useState(10);
  const [maxLossPerTrade, setMaxLossPerTrade] = useState(1500);

  // Order Ticket states
  const [symbol, setSymbol] = useState(initialSymbol);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [product, setProduct] = useState<'MIS' | 'NRML'>('MIS');
  const [orderLots, setOrderLots] = useState(1);
  const [orderPrice, setOrderPrice] = useState(initialDetails?.price || 0);
  const [stopLoss, setStopLoss] = useState(0);
  const [target, setTarget] = useState(0);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Live order confirmation modal
  const [showLiveConfirmModal, setShowLiveConfirmModal] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [accs, s, lots, prof] = await Promise.all([
          api.getBrokerAccounts().catch(() => []),
          api.getTraderSettings().catch(() => null),
          api.getLotSizes().catch(() => ({ NIFTY: 65, BANKNIFTY: 30, SENSEX: 20 })),
          api.getBrokerProfile().catch(() => null),
        ]);

        if (isMounted) {
          setBrokerAccounts(accs);
          if (prof) setProfile(prof);
          if (s) {
            setSettings(s);
            setNiftyLots(s.nifty_lots);
            setBankniftyLots(s.banknifty_lots);
            setSensexLots(s.sensex_lots);
            setMaxDailyLoss(s.max_daily_loss);
            setMaxDailyTrades(s.max_daily_trades);
            setMaxLossPerTrade(s.max_loss_per_trade);
          }
          if (lots) setLotSizes(lots);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  const connectedBroker = brokerAccounts.find(a => a.is_connected && a.status === 'CONNECTED');

  const handleSaveLotSettings = async () => {
    setSavingSettings(true);
    setErrorToast(null);
    try {
      const updated = await api.updateTraderSettings({
        nifty_lots: niftyLots,
        banknifty_lots: bankniftyLots,
        sensex_lots: sensexLots,
        max_daily_loss: maxDailyLoss,
        max_daily_trades: maxDailyTrades,
        max_loss_per_trade: maxLossPerTrade,
      });
      setSettings(updated);
      setSuccessToast('Trading settings & lot configurations saved successfully.');
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      setErrorToast(err.message || 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    if (tradingMode && settings && settings.trading_mode !== tradingMode) {
      setSettings(prev => prev ? ({ ...prev, trading_mode: tradingMode }) : null);
    }
  }, [tradingMode]);

  const handleToggleMode = async (targetMode: 'PAPER' | 'LIVE') => {
    if (targetMode === 'LIVE' && !settings?.live_trading_enabled) {
      setErrorToast('Please check "Enable Live Execution" before switching to LIVE trading.');
      return;
    }
    try {
      const updated = await api.updateTraderSettings({
        trading_mode: targetMode,
      });
      setSettings(updated);
      onModeChange?.(targetMode);
      setSuccessToast(`Switched active mode to ${targetMode} TRADING.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      setErrorToast(err.message || 'Mode switch failed.');
    }
  };

  // Compute calculated quantity for order ticket
  const getSymbolLot = (sym: string) => {
    const u = sym.toUpperCase();
    if (u.includes('BANK')) return lotSizes.BANKNIFTY || 30;
    if (u.includes('SENSEX')) return lotSizes.SENSEX || 20;
    if (u.includes('NIFTY')) return lotSizes.NIFTY || 65;
    return 1;
  };

  const currentInstLotSize = getSymbolLot(symbol);
  const totalOrderQty = orderLots * currentInstLotSize;
  const estimatedOrderValue = totalOrderQty * (orderPrice > 0 ? orderPrice : 100);

  const handleSubmitOrder = async () => {
    if (settings?.trading_mode === 'LIVE') {
      setShowLiveConfirmModal(true);
    } else {
      await executeOrder('PAPER');
    }
  };

  const executeOrder = async (mode: 'PAPER' | 'LIVE') => {
    setIsSubmittingOrder(true);
    setShowLiveConfirmModal(false);
    setErrorToast(null);
    try {
      const req: TraderOrderRequest = {
        symbol: symbol.trim().toUpperCase(),
        exchange: symbol.toUpperCase().includes('SENSEX') ? 'BSE' : 'NSE',
        side,
        order_type: orderType,
        product,
        lots: orderLots,
        quantity: totalOrderQty,
        price: orderPrice > 0 ? orderPrice : undefined,
        stop_loss: stopLoss > 0 ? stopLoss : undefined,
        target: target > 0 ? target : undefined,
        mode,
      };

      const res = await api.placeTraderOrder(req);
      if (res.success) {
        setSuccessToast(`Order placed: ${res.side} ${res.quantity} ${res.symbol} (${res.mode})`);
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        setErrorToast(`Order failed: ${res.message}`);
      }
    } catch (err: any) {
      setErrorToast(err.message || 'Order submission error.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast notifications */}
      {successToast && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <span>✓ {successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">×</button>
        </div>
      )}
      {errorToast && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <span>⚠ {errorToast}</span>
          <button onClick={() => setErrorToast(null)} className="text-red-700 hover:text-red-900 font-bold ml-2">×</button>
        </div>
      )}

      {/* 1. Trading Account Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
              Trading Execution Account
            </span>
            <div className="flex items-center space-x-3 mt-1">
              <h2 className="text-base font-bold text-gray-900">
                {connectedBroker ? connectedBroker.broker_name : 'No Broker Connected'}
              </h2>
              {connectedBroker ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Connected ({connectedBroker.masked_identifier})</span>
                </span>
              ) : (
                <button
                  onClick={() => onNavigate('broker')}
                  className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>Connect Kotak Neo</span>
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Orders and position risk limits are validated locally and synchronized with the broker adapter.
            </p>
          </div>

          {/* Mode Switcher: Paper vs Live */}
          <div className="flex items-center space-x-3 bg-gray-50 border border-gray-200 p-1.5 rounded-xl">
            <button
              onClick={() => handleToggleMode('PAPER')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                settings?.trading_mode === 'PAPER'
                  ? 'bg-white text-blue-700 shadow-2xs border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Paper Trading
            </button>
            <button
              onClick={() => handleToggleMode('LIVE')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                settings?.trading_mode === 'LIVE'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Live Trading
            </button>
          </div>
        </div>

        {/* Live confirmation checkbox */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings?.live_trading_enabled || false}
              onChange={(e) => {
                const checked = e.target.checked;
                api.updateTraderSettings({ live_trading_enabled: checked }).then(res => setSettings(res));
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span className="font-semibold text-gray-800">
              Enable Live Execution Permission
            </span>
            <span className="text-[11px] text-gray-400 font-normal">
              (Requires explicit confirmation modal before each real order)
            </span>
          </label>

          <span className="text-[11px] text-gray-400 font-mono">
            Safety Guardrail: {settings?.trading_mode === 'LIVE' ? 'LIVE MODE ENGAGED' : 'SAFE PAPER SIMULATION'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 2. Left Column: LOT SETTINGS & RISK CONTROLS (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-900">Configured Lot Settings</h3>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">Dynamic Broker Multipliers</span>
            </div>

            <div className="py-4 space-y-4">
              {/* NIFTY 50 Lots */}
              <div className="bg-gray-50/70 p-3 rounded-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-900">NIFTY 50</span>
                    <span className="text-[10px] text-gray-400 ml-2 font-mono">1 Lot = {lotSizes.NIFTY} Qty</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Lots:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={niftyLots}
                      onChange={(e) => setNiftyLots(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-2 py-1 text-center font-bold text-xs bg-white border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-gray-600 font-mono flex items-center justify-between pt-1 border-t border-gray-200/50">
                  <span>Calculated Quantity:</span>
                  <strong className="text-gray-900">{niftyLots * lotSizes.NIFTY} units</strong>
                </div>
              </div>

              {/* BANKNIFTY Lots */}
              <div className="bg-gray-50/70 p-3 rounded-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-900">BANKNIFTY</span>
                    <span className="text-[10px] text-gray-400 ml-2 font-mono">1 Lot = {lotSizes.BANKNIFTY} Qty</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Lots:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={bankniftyLots}
                      onChange={(e) => setBankniftyLots(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-2 py-1 text-center font-bold text-xs bg-white border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-gray-600 font-mono flex items-center justify-between pt-1 border-t border-gray-200/50">
                  <span>Calculated Quantity:</span>
                  <strong className="text-gray-900">{bankniftyLots * lotSizes.BANKNIFTY} units</strong>
                </div>
              </div>

              {/* SENSEX Lots */}
              <div className="bg-gray-50/70 p-3 rounded-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-900">SENSEX</span>
                    <span className="text-[10px] text-gray-400 ml-2 font-mono">1 Lot = {lotSizes.SENSEX} Qty</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Lots:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={sensexLots}
                      onChange={(e) => setSensexLots(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-2 py-1 text-center font-bold text-xs bg-white border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-gray-600 font-mono flex items-center justify-between pt-1 border-t border-gray-200/50">
                  <span>Calculated Quantity:</span>
                  <strong className="text-gray-900">{sensexLots * lotSizes.SENSEX} units</strong>
                </div>
              </div>
            </div>

            {/* Risk Parameters */}
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <span className="text-xs font-bold text-gray-800 block">Risk Safeguards</span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Max Daily Loss (₹)
                  </label>
                  <input
                    type="number"
                    value={maxDailyLoss}
                    onChange={(e) => setMaxDailyLoss(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Max Trades / Day
                  </label>
                  <input
                    type="number"
                    value={maxDailyTrades}
                    onChange={(e) => setMaxDailyTrades(parseInt(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Max Loss / Trade (₹)
                </label>
                <input
                  type="number"
                  value={maxLossPerTrade}
                  onChange={(e) => setMaxLossPerTrade(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <button
                onClick={handleSaveLotSettings}
                disabled={savingSettings}
                className="w-full mt-2 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors shadow-2xs flex items-center justify-center space-x-1"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>{savingSettings ? 'Saving...' : 'Save Settings & Risk Limits'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Right Column: MANUAL TRADE EXECUTION TICKET (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900">Trade Execution Ticket</h3>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                settings?.trading_mode === 'LIVE' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700'
              }`}>
                Mode: {settings?.trading_mode || 'PAPER'}
              </span>
            </div>

            <div className="py-4 space-y-4">
              {/* Buy / Sell Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSide('BUY')}
                  className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    side === 'BUY'
                      ? 'bg-emerald-600 text-white shadow-2xs ring-2 ring-emerald-600/30'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  BUY / LONG
                </button>
                <button
                  type="button"
                  onClick={() => setSide('SELL')}
                  className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    side === 'SELL'
                      ? 'bg-red-600 text-white shadow-2xs ring-2 ring-red-600/30'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  SELL / SHORT
                </button>
              </div>

              {/* Instrument & Product */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Symbol / Contract
                  </label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. NIFTY, NIFTY26OCT22400CE"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Product
                  </label>
                  <select
                    value={product}
                    onChange={(e) => setProduct(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-semibold"
                  >
                    <option value="MIS">MIS (Intraday)</option>
                    <option value="NRML">NRML (Normal/Carry)</option>
                  </select>
                </div>
              </div>

              {/* Order Type, Lots & Limit Price */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Order Type
                  </label>
                  <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-semibold"
                  >
                    <option value="MARKET">MARKET</option>
                    <option value="LIMIT">LIMIT</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Number of Lots
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={orderLots}
                    onChange={(e) => setOrderLots(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Limit Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    disabled={orderType === 'MARKET'}
                    value={orderPrice}
                    onChange={(e) => setOrderPrice(parseFloat(e.target.value) || 0)}
                    placeholder={orderType === 'MARKET' ? 'Market Fill' : '0.00'}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>
              </div>

              {/* Stop Loss & Target */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Stop Loss Trigger (₹)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                    placeholder="Optional SL"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Target Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={target}
                    onChange={(e) => setTarget(parseFloat(e.target.value) || 0)}
                    placeholder="Optional Target"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Order Calculation Preview Card */}
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200/80 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-gray-600">
                  <span className="flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Available Broker Margin:</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-700">
                    ₹{profile ? profile.available_margin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Unit Quantity:</span>
                  <span className="font-mono font-bold text-gray-900">
                    {orderLots} lot(s) × {currentInstLotSize} = {totalOrderQty} units
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Estimated Total Value:</span>
                  <span className="font-mono font-bold text-blue-700 text-sm">
                    ₹{estimatedOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Order Submission Button */}
              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={isSubmittingOrder || !symbol.trim()}
                className={`w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-2xs transition-colors flex items-center justify-center space-x-2 ${
                  side === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-40`}
              >
                {isSubmittingOrder ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Execute {side} Order ({settings?.trading_mode || 'PAPER'})</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CONFIRM LIVE ORDER MODAL */}
      {showLiveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border-2 border-red-500 animate-scale-in">
            <div className="flex items-center space-x-2 text-red-600 pb-3 border-b border-gray-100">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-base font-extrabold tracking-tight">CONFIRM LIVE ORDER</h3>
            </div>

            <p className="text-xs text-gray-600 my-3 leading-relaxed">
              You are about to place a <strong>REAL LIVE ORDER</strong> on your connected <strong>Kotak Neo</strong> account. Real capital will be committed.
            </p>

            <div className="bg-gray-50 rounded-lg p-3.5 space-y-2 text-xs border border-gray-200 font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">Broker:</span>
                <span className="font-bold text-gray-900">{connectedBroker?.broker_name || 'Kotak Neo'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Instrument:</span>
                <span className="font-bold text-gray-900">{symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Side:</span>
                <span className={`font-bold ${side === 'BUY' ? 'text-emerald-700' : 'text-red-700'}`}>{side}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Order Type:</span>
                <span className="font-bold text-gray-900">{orderType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Lots:</span>
                <span className="font-bold text-gray-900">{orderLots}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Quantity:</span>
                <span className="font-bold text-gray-900">{totalOrderQty} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Estimated Value:</span>
                <span className="font-bold text-blue-700">₹{estimatedOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {stopLoss > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Stop Loss:</span>
                  <span className="font-bold text-red-600">₹{stopLoss}</span>
                </div>
              )}
              {target > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Target:</span>
                  <span className="font-bold text-emerald-600">₹{target}</span>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowLiveConfirmModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeOrder('LIVE')}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
              >
                PLACE LIVE ORDER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
