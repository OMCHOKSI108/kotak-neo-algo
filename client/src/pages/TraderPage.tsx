import React, { useState, useEffect, useRef } from 'react';
import {
  User, BrokerAccount, UserTradingSettings, TraderOrderRequest,
  BrokerProfile, InstrumentSearchResult, BrokerStatusItem
} from '../types';
import { api } from '../api';
import {
  Zap, ShieldAlert, AlertTriangle, CheckCircle2,
  RefreshCw, ArrowRight, Settings2, Sliders, Wallet,
  Search, X, ExternalLink
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
  initialSymbol = 'RELIANCE',
  initialDetails,
  onNavigate,
  tradingMode = 'PAPER',
  onModeChange,
}) => {
  const [brokerAccounts, setBrokerAccounts] = useState<BrokerAccount[]>([]);
  const [brokerStatuses, setBrokerStatuses] = useState<BrokerStatusItem[]>([]);
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

  // Scrip Master Search & Selected Instrument
  const [symbol, setSymbol] = useState(initialSymbol === 'NIFTY' ? 'RELIANCE' : initialSymbol);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentSearchResult | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSymbol === 'NIFTY' ? 'RELIANCE' : initialSymbol);
  const [searchResults, setSearchResults] = useState<InstrumentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [dropdownSegment, setDropdownSegment] = useState<'all' | 'equity' | 'fo'>('all');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isSpotIndex, setIsSpotIndex] = useState(false);

  // Live Price State
  const [liveLtp, setLiveLtp] = useState<number | null>(initialDetails?.price || null);
  const [isLtpLoading, setIsLtpLoading] = useState(false);

  // Order Ticket states
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [product, setProduct] = useState<'MIS' | 'NRML'>('MIS');
  const [orderLots, setOrderLots] = useState(1);
  const [orderPrice, setOrderPrice] = useState<string>(initialDetails?.price ? String(initialDetails.price) : '');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [target, setTarget] = useState<string>('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Live order confirmation modal
  const [showLiveConfirmModal, setShowLiveConfirmModal] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);

  // Load initial broker and settings data
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [accs, s, lots, prof, statuses] = await Promise.all([
          api.getBrokerAccounts().catch(() => []),
          api.getTraderSettings().catch(() => null),
          api.getLotSizes().catch(() => ({ NIFTY: 65, BANKNIFTY: 30, SENSEX: 20 })),
          api.getBrokerProfile().catch(() => null),
          api.getBrokersStatus().catch(() => []),
        ]);

        if (isMounted) {
          setBrokerAccounts(accs);
          setBrokerStatuses(statuses);
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

  // Fetch initial symbol details if provided
  useEffect(() => {
    let isMounted = true;
    const initialSym = (initialSymbol === 'NIFTY' ? 'RELIANCE' : initialSymbol).trim();
    if (initialSym) {
      api.searchInstruments(initialSym, 'all', 1)
        .then((res) => {
          if (isMounted && res.length > 0) {
            const inst = res[0];
            setSelectedInstrument(inst);
            setSymbol(inst.symbol);
            setSearchQuery(inst.trading_symbol || inst.symbol);
            checkSpotIndex(inst);
          }
        })
        .catch(() => {});

      setIsLtpLoading(true);
      api.getQuotes([initialSym])
        .then((quotes) => {
          if (isMounted && quotes.length > 0 && quotes[0].ltp > 0) {
            setLiveLtp(quotes[0].ltp);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsLtpLoading(false);
        });
    }
    return () => { isMounted = false; };
  }, [initialSymbol]);

  // Click outside to close Scrip Master dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search against Kotak Neo Scrip Master (150ms)
  useEffect(() => {
    const query = searchQuery.trim();
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
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery, dropdownSegment]);

  // Helper to check if instrument is a non-tradable spot index
  const checkSpotIndex = (inst?: InstrumentSearchResult | null, symName?: string): boolean => {
    const s = (symName || inst?.symbol || symbol).trim().toUpperCase();
    const spotNames = ['NIFTY', 'NIFTY 50', 'BANKNIFTY', 'BANK NIFTY', 'SENSEX', 'FINNIFTY', 'MIDCPNIFTY'];
    const isSpot = spotNames.includes(s) || inst?.instrument_type === 'IDX';
    setIsSpotIndex(isSpot);
    return isSpot;
  };

  // Select an instrument from Scrip Master results
  const handleSelectInstrument = (item: InstrumentSearchResult) => {
    setSelectedInstrument(item);
    setSymbol(item.symbol);
    setSearchQuery(item.trading_symbol || item.symbol);
    setShowSearchDropdown(false);

    const isSpot = checkSpotIndex(item);
    if (isSpot) {
      setLiveLtp(null);
      return;
    }

    // Automatically sync default lots for the underlying
    const u = item.symbol.toUpperCase();
    if (u.startsWith('BANKNIFTY')) {
      setOrderLots(bankniftyLots);
    } else if (u.startsWith('SENSEX')) {
      setOrderLots(sensexLots);
    } else if (u.startsWith('NIFTY')) {
      setOrderLots(niftyLots);
    } else {
      setOrderLots(1);
    }

    // Fetch live quote for selected contract
    setIsLtpLoading(true);
    api.getQuotes([item.symbol])
      .then((quotes) => {
        if (quotes && quotes.length > 0 && quotes[0].ltp > 0) {
          const ltp = quotes[0].ltp;
          setLiveLtp(ltp);
          if (orderType === 'LIMIT' && !orderPrice) {
            setOrderPrice(ltp.toFixed(2));
          }
        }
      })
      .catch((err) => {
        console.debug('Failed to fetch quote for', item.symbol, err);
      })
      .finally(() => {
        setIsLtpLoading(false);
      });
  };

  // Keyboard navigation inside Scrip Master autocomplete
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchDropdown || searchResults.length === 0) {
      if (e.key === 'Escape') setShowSearchDropdown(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        handleSelectInstrument(searchResults[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSearchDropdown(false);
    }
  };

  // Sync left panel configured lots with order ticket when left-panel inputs change
  useEffect(() => {
    const u = symbol.toUpperCase();
    if (u.startsWith('BANKNIFTY')) {
      setOrderLots(bankniftyLots);
    } else if (u.startsWith('SENSEX')) {
      setOrderLots(sensexLots);
    } else if (u.startsWith('NIFTY')) {
      setOrderLots(niftyLots);
    }
  }, [niftyLots, bankniftyLots, sensexLots]);

  // Determine active broker status & clean label
  const primaryStatus = brokerStatuses.find(b => b.isPrimary) || brokerStatuses[0];
  const isEnvAccount = primaryStatus?.source === 'ENV';
  const isBrokerActive = primaryStatus ? primaryStatus.authState === 'ACTIVE' : (profile?.is_live || false);
  const connectedBroker = brokerAccounts.find(a => a.is_connected && a.status === 'CONNECTED');

  const cleanBrokerName = primaryStatus
    ? (primaryStatus.brokerType === 'kotak_neo' ? 'Kotak Neo' : primaryStatus.label)
    : (connectedBroker?.broker_name ? connectedBroker.broker_name.replace(/_/g, ' ') : 'Kotak Neo');

  // Available margin computation
  const isLive = settings?.trading_mode === 'LIVE';
  const availableMargin = isLive
    ? (profile?.available_margin ?? primaryStatus?.availableMargin ?? 0)
    : 1000000; // Simulated ₹10 Lakhs in Paper Trading mode

  // Contract Lot Size & Quantity
  const contractLotSize = selectedInstrument?.lot_size || (
    symbol.toUpperCase().includes('BANK') ? (lotSizes.BANKNIFTY || 30) :
    symbol.toUpperCase().includes('SENSEX') ? (lotSizes.SENSEX || 20) :
    symbol.toUpperCase().includes('NIFTY') ? (lotSizes.NIFTY || 65) : 1
  );

  const totalOrderQty = orderLots * contractLotSize;

  // Effective price: Limit price if LIMIT order, otherwise live LTP
  const parsedLimitPrice = parseFloat(orderPrice);
  const effectivePrice = orderType === 'LIMIT'
    ? (parsedLimitPrice > 0 ? parsedLimitPrice : 0)
    : (liveLtp || 0);

  const estimatedOrderValue = effectivePrice > 0 ? totalOrderQty * effectivePrice : null;

  // Margin validation for Live trading
  const isInsufficientMargin = isLive && (
    availableMargin <= 0 || (estimatedOrderValue !== null && availableMargin < estimatedOrderValue)
  );

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

  const handleToggleMode = async (targetMode: 'PAPER' | 'LIVE') => {
    if (targetMode === 'LIVE' && !settings?.live_trading_enabled) {
      setErrorToast('Please check "Enable Live Execution Permission" before switching to LIVE trading.');
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

  const handleOrderTypeChange = (newType: 'MARKET' | 'LIMIT') => {
    setOrderType(newType);
    if (newType === 'LIMIT') {
      if (liveLtp && liveLtp > 0 && !orderPrice) {
        setOrderPrice(liveLtp.toFixed(2));
      }
    } else {
      setOrderPrice('');
    }
  };

  const handleSubmitOrder = async () => {
    if (isSpotIndex) {
      setErrorToast(`'${symbol}' is a non-tradable spot index. Please select an Equity or F&O contract.`);
      return;
    }

    if (isLive) {
      if (!isBrokerActive) {
        setErrorToast('Broker session is not authenticated. Please complete 2FA in Broker Settings.');
        return;
      }
      if (isInsufficientMargin) {
        setErrorToast('Insufficient broker margin to place this order.');
        return;
      }
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
      const parsedSL = parseFloat(stopLoss);
      const parsedTgt = parseFloat(target);

      const req: TraderOrderRequest = {
        symbol: symbol.trim().toUpperCase(),
        exchange: selectedInstrument?.exchange || (symbol.toUpperCase().includes('SENSEX') ? 'BSE' : 'NSE'),
        side,
        order_type: orderType,
        product,
        lots: orderLots,
        quantity: totalOrderQty,
        price: orderType === 'LIMIT' && parsedLimitPrice > 0 ? parsedLimitPrice : undefined,
        stop_loss: parsedSL > 0 ? parsedSL : undefined,
        target: parsedTgt > 0 ? parsedTgt : undefined,
        mode,
      };

      const res = await api.placeTraderOrder(req);
      if (res.success) {
        setSuccessToast(`Order placed successfully: ${res.side} ${res.quantity} ${res.symbol} (${res.mode})`);
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
                {cleanBrokerName}
              </h2>
              {isBrokerActive ? (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Session Active {primaryStatus?.expiresAt ? '• Live API' : ''}</span>
                </span>
              ) : (
                <button
                  onClick={() => onNavigate('broker')}
                  className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>2FA Required (Session Expired)</span>
                  <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
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
                isLive ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700'
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

              {/* Scrip Master Autocomplete Search */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 relative" ref={searchContainerRef}>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Symbol / Contract (Scrip Master)
                  </label>
                  <div className="relative">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setSearchQuery(val);
                        setSymbol(val);
                        checkSpotIndex(null, val);
                      }}
                      onFocus={() => {
                        if (searchQuery.trim().length >= 2) setShowSearchDropdown(true);
                      }}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Search (e.g. RELIANCE, NIFTY 24500 CE)..."
                      className="w-full pl-8 pr-8 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono font-bold uppercase"
                    />
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSymbol('');
                          setSelectedInstrument(null);
                          setLiveLtp(null);
                          setShowSearchDropdown(false);
                        }}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Spot Index Warning Banner */}
                  {isSpotIndex && (
                    <div className="mt-1.5 p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start space-x-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Spot Index is non-tradable.</strong> Please select an Equity stock (e.g. RELIANCE) or an active Futures/Options contract (e.g. NIFTY 24500 CE).
                      </span>
                    </div>
                  )}

                  {/* Scrip Master Autocomplete Dropdown */}
                  {showSearchDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden text-xs animate-in fade-in-50 duration-150">
                      {/* Segment Pills */}
                      <div className="flex items-center space-x-1.5 p-2 bg-gray-50 border-b border-gray-100">
                        {(['all', 'equity', 'fo'] as const).map((seg) => (
                          <button
                            key={seg}
                            type="button"
                            onClick={() => setDropdownSegment(seg)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                              dropdownSegment === seg
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {seg === 'all' ? 'All Segments' : seg === 'equity' ? 'Equity' : 'F&O'}
                          </button>
                        ))}
                        {isSearching && (
                          <RefreshCw className="w-3 h-3 text-blue-600 animate-spin ml-auto" />
                        )}
                      </div>

                      {/* Dropdown Items List */}
                      <div ref={dropdownListRef} className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                        {searchResults.length === 0 ? (
                          <div className="p-4 text-center text-gray-400 font-mono text-xs">
                            {isSearching ? 'Searching Scrip Master...' : 'No matching instruments found.'}
                          </div>
                        ) : (
                          searchResults.map((item, idx) => {
                            const isIdx = item.instrument_type === 'IDX';
                            return (
                              <div
                                key={`${item.exchange_segment}-${item.token || item.symbol}-${idx}`}
                                onClick={() => handleSelectInstrument(item)}
                                className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                                  highlightedIndex === idx ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center space-x-1.5">
                                    <span className="font-bold text-gray-900 font-mono">{item.trading_symbol || item.symbol}</span>
                                    {isIdx && (
                                      <span className="text-[9px] px-1 py-0.2 bg-amber-100 text-amber-800 rounded font-semibold">
                                        INDEX
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-400 truncate">
                                    {item.name || item.exchange_segment} {item.expiry ? `• Exp: ${item.expiry}` : ''} {item.lot_size > 1 ? `• Lot: ${item.lot_size}` : ''}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1.5 shrink-0">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-100 text-gray-600">
                                    {item.exchange}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                    item.instrument_type === 'CE' ? 'bg-emerald-50 text-emerald-700' :
                                    item.instrument_type === 'PE' ? 'bg-red-50 text-red-700' :
                                    item.instrument_type === 'FUT' ? 'bg-purple-50 text-purple-700' :
                                    'bg-blue-50 text-blue-700'
                                  }`}>
                                    {item.instrument_type}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* Live Contract Info Banner */}
                  {selectedInstrument && !isSpotIndex && (
                    <div className="mt-1 flex items-center space-x-2 text-[11px] text-gray-500 font-mono">
                      <span>Segment: <strong className="text-gray-800">{selectedInstrument.exchange_segment}</strong></span>
                      <span>•</span>
                      <span>Lot Size: <strong className="text-gray-800">{contractLotSize}</strong></span>
                      <span>•</span>
                      <span>
                        Live LTP:{' '}
                        {isLtpLoading ? (
                          <span className="text-blue-600 animate-pulse">Fetching...</span>
                        ) : liveLtp ? (
                          <strong className="text-emerald-700 font-bold">₹{liveLtp.toFixed(2)}</strong>
                        ) : (
                          <span className="text-gray-400">Unavailable</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Product
                  </label>
                  <select
                    value={product}
                    onChange={(e) => setProduct(e.target.value as any)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-semibold"
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
                    onChange={(e) => handleOrderTypeChange(e.target.value as any)}
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
                    onChange={(e) => setOrderPrice(e.target.value)}
                    placeholder={orderType === 'MARKET' ? 'Market Fill (LTP)' : 'e.g. 150.00'}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>
              </div>

              {/* Stop Loss & Target (Optional, Clean Placeholders) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Stop Loss Trigger (₹)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder="Optional (₹)"
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
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="Optional (₹)"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Order Calculation Preview Card */}
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200/80 text-xs space-y-2">
                <div className="flex items-center justify-between text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Available Broker Margin:</span>
                  </span>
                  <span className={`font-mono font-bold ${
                    isLive
                      ? (availableMargin > 0 ? 'text-emerald-700' : 'text-red-600')
                      : 'text-blue-700'
                  }`}>
                    {isLive ? (
                      `₹${availableMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ) : (
                      '₹10,00,000.00 (Paper Simulation)'
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between text-gray-600">
                  <span>Unit Quantity:</span>
                  <span className="font-mono font-bold text-gray-900">
                    {orderLots} lot(s) × {contractLotSize} = {totalOrderQty} units
                  </span>
                </div>

                <div className="flex items-center justify-between text-gray-600 pt-1 border-t border-gray-200/50">
                  <span>Estimated Total Value:</span>
                  {isLtpLoading ? (
                    <span className="text-blue-600 font-mono font-bold animate-pulse text-xs">
                      Fetching live LTP...
                    </span>
                  ) : orderType === 'LIMIT' && (!orderPrice || parseFloat(orderPrice) <= 0) ? (
                    <span className="text-amber-600 font-mono font-semibold text-xs">
                      Enter limit price
                    </span>
                  ) : estimatedOrderValue !== null ? (
                    <span className="font-mono font-bold text-gray-900 text-sm">
                      ₹{estimatedOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-gray-400 font-mono text-xs">
                      Awaiting price
                    </span>
                  )}
                </div>

                {/* Insufficient Margin Alert Banner */}
                {isInsufficientMargin && (
                  <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                    <div className="leading-tight">
                      <strong>Insufficient Broker Margin:</strong> Available margin (₹{availableMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) is less than estimated required order value (₹{(estimatedOrderValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}). Add funds or reduce lots before executing.
                    </div>
                  </div>
                )}
              </div>

              {/* Order Submission Button */}
              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={
                  isSubmittingOrder ||
                  !symbol.trim() ||
                  isSpotIndex ||
                  (isLive && isInsufficientMargin) ||
                  (isLive && !isBrokerActive) ||
                  (orderType === 'LIMIT' && (!orderPrice || parseFloat(orderPrice) <= 0))
                }
                className={`w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-2xs transition-colors flex items-center justify-center space-x-2 ${
                  side === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed`}
              >
                {isSubmittingOrder ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>
                      {isSpotIndex
                        ? 'Non-Tradable Spot Index'
                        : isLive && !isBrokerActive
                        ? 'Broker 2FA Required'
                        : isLive && isInsufficientMargin
                        ? 'Insufficient Margin (Live Order Blocked)'
                        : `Execute ${side} Order (${settings?.trading_mode || 'PAPER'})`}
                    </span>
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
              You are about to place a <strong>REAL LIVE ORDER</strong> on your connected <strong>{cleanBrokerName}</strong> account. Real capital will be committed.
            </p>

            <div className="bg-gray-50 rounded-lg p-3.5 space-y-2 text-xs border border-gray-200 font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">Broker:</span>
                <span className="font-bold text-gray-900">{cleanBrokerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Contract / Symbol:</span>
                <span className="font-bold text-gray-900">{symbol}</span>
              </div>
              {selectedInstrument && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Segment:</span>
                  <span className="font-semibold text-gray-700">{selectedInstrument.exchange_segment} ({selectedInstrument.instrument_type})</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Side:</span>
                <span className={`font-bold ${side === 'BUY' ? 'text-emerald-700' : 'text-red-700'}`}>{side}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Order Type:</span>
                <span className="font-bold text-gray-900">
                  {orderType} {orderType === 'LIMIT' ? `@ ₹${parseFloat(orderPrice).toFixed(2)}` : '(Market Fill)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Lots:</span>
                <span className="font-bold text-gray-900">{orderLots} ({contractLotSize} / lot)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Quantity:</span>
                <span className="font-bold text-gray-900">{totalOrderQty} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Estimated Value:</span>
                <span className="font-bold text-blue-700">
                  {estimatedOrderValue !== null ? `₹${estimatedOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'At Market LTP'}
                </span>
              </div>
              {parseFloat(stopLoss) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Stop Loss:</span>
                  <span className="font-bold text-red-600">₹{parseFloat(stopLoss).toFixed(2)}</span>
                </div>
              )}
              {parseFloat(target) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Target:</span>
                  <span className="font-bold text-emerald-600">₹{parseFloat(target).toFixed(2)}</span>
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
                className={`px-5 py-2 text-white text-xs font-bold rounded-lg shadow-sm transition-colors ${
                  side === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                PLACE LIVE {side} ORDER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
