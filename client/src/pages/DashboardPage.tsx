import React, { useState, useEffect } from 'react';
import { Quote, User, BrokerAccount, UserTradingSettings, StrategyItem, TraderPositionsSummary } from '../types';
import { api } from '../api';
import {
  TrendingUp, TrendingDown, Activity, ShieldAlert, Cpu, Zap,
  Layers, ArrowUpRight, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';

interface DashboardPageProps {
  quotes: Record<string, Quote> | Quote[];
  isWsConnected: boolean;
  user: User;
  onNavigate: (tab: string, param?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  quotes,
  isWsConnected,
  user,
  onNavigate,
}) => {
  const [brokerAccounts, setBrokerAccounts] = useState<BrokerAccount[]>([]);
  const [tradingSettings, setTradingSettings] = useState<UserTradingSettings | null>(null);
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [positionsSummary, setPositionsSummary] = useState<TraderPositionsSummary | null>(null);
  const [ordersTodayCount, setOrdersTodayCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [accounts, settings, strats, pos, orders] = await Promise.all([
          api.getBrokerAccounts().catch(() => []),
          api.getTraderSettings().catch(() => null),
          api.getUserStrategies().catch(() => []),
          api.getTraderPositions().catch(() => null),
          api.getTraderOrders().catch(() => [])
        ]);

        if (isMounted) {
          setBrokerAccounts(accounts);
          setTradingSettings(settings);
          setStrategies(strats);
          setPositionsSummary(pos);
          setOrdersTodayCount(orders.length);
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
  const runningStrategies = strategies.filter(s => s.status === 'RUNNING');
  const isAlgoRunning = runningStrategies.length > 0;

  // Determine Indian market trading hours (09:15 - 15:30 IST, Mon-Fri)
  const isMarketOpen = () => {
    const now = new Date();
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const day = istDate.getUTCDay(); // 0 is Sunday, 6 is Saturday
    if (day === 0 || day === 6) return false;
    const hours = istDate.getUTCHours();
    const minutes = istDate.getUTCMinutes();
    const currentMins = hours * 60 + minutes;
    const openMins = 9 * 60 + 15;
    const closeMins = 15 * 60 + 30;
    return currentMins >= openMins && currentMins <= closeMins;
  };

  const marketOpen = isMarketOpen();

  // Index quotes
  const quotesList = Array.isArray(quotes) ? quotes : Object.values(quotes);
  const niftyQuote = quotesList.find(q => q.symbol.includes('NIFTY 50') || q.symbol === 'NIFTY');
  const bankNiftyQuote = quotesList.find(q => q.symbol.includes('BANKNIFTY'));
  const sensexQuote = quotesList.find(q => q.symbol.includes('SENSEX'));

  const indices = [
    { name: 'NIFTY 50', quote: niftyQuote, key: 'NIFTY' },
    { name: 'BANKNIFTY', quote: bankNiftyQuote, key: 'BANKNIFTY' },
    { name: 'SENSEX', quote: sensexQuote, key: 'SENSEX' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Real System Status Cards Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Market Status */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Market</span>
            <span className={`w-2 h-2 rounded-full ${marketOpen ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className={`text-sm font-bold ${marketOpen ? 'text-emerald-700' : 'text-gray-700'}`}>
              {marketOpen ? 'OPEN (NSE/BSE)' : 'CLOSED'}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">Normal trading hours: 09:15 - 15:30 IST</p>
        </div>

        {/* Data Feed */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Data Feed</span>
            <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className={`text-sm font-bold ${isWsConnected ? 'text-emerald-700' : 'text-red-700'}`}>
              {isWsConnected ? 'LIVE FEED ACTIVE' : 'OFFLINE'}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">Direct Kotak Neo API stream</p>
        </div>

        {/* Broker Status */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Broker</span>
            <span className={`w-2 h-2 rounded-full ${connectedBroker ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className={`text-sm font-bold ${connectedBroker ? 'text-emerald-700' : 'text-amber-700'}`}>
              {connectedBroker ? 'KOTAK CONNECTED' : 'NOT CONNECTED'}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            {connectedBroker ? `UCC: ${connectedBroker.masked_identifier}` : 'Connect in Brokers page'}
          </p>
        </div>

        {/* Algo Engine */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Algo Engine</span>
            <span className={`w-2 h-2 rounded-full ${isAlgoRunning ? 'bg-blue-600 animate-pulse' : 'bg-gray-400'}`} />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className={`text-sm font-bold ${isAlgoRunning ? 'text-blue-700' : 'text-gray-700'}`}>
              {isAlgoRunning ? `RUNNING (${runningStrategies.length})` : 'STOPPED'}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            Mode: {tradingSettings?.trading_mode || 'PAPER'}
          </p>
        </div>
      </div>

      {/* 2. Major Indices Tickers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {indices.map(({ name, quote, key }) => {
          const ltp = quote?.ltp || 0;
          const change = quote?.change || 0;
          const changePct = quote?.change_percent || 0;
          const isUp = change >= 0;

          return (
            <div
              key={name}
              className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs hover:border-gray-300 transition-all cursor-pointer"
              onClick={() => onNavigate('option-chain', key)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-900">{name}</span>
                <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                  {key === 'SENSEX' ? 'BSE' : 'NSE'}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-xl font-bold font-mono text-gray-900 tracking-tight">
                  {ltp > 0 ? ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : 'Loading...'}
                </div>
                <div className={`flex items-center space-x-1 text-xs font-semibold font-mono ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{isUp ? '+' : ''}{change.toFixed(2)}</span>
                  <span>({isUp ? '+' : ''}{changePct.toFixed(2)}%)</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <span>H: <span className="font-mono text-gray-800 font-medium">{quote?.high ? quote.high.toFixed(2) : '-'}</span></span>
                <span>L: <span className="font-mono text-gray-800 font-medium">{quote?.low ? quote.low.toFixed(2) : '-'}</span></span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate('option-chain', key);
                  }}
                  className="text-blue-600 hover:text-blue-800 flex items-center font-medium"
                >
                  Chain <ArrowUpRight className="w-3 h-3 ml-0.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Personal Trading Information & Position Status */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Trading Portfolio & Execution Summary</h2>
            <p className="text-xs text-gray-500">Real-time statistics across active session</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigate('trader')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-2xs"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Trader Terminal</span>
            </button>
          </div>
        </div>

        {/* Real Summary Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 py-4">
          <div className="bg-gray-50/80 rounded-lg p-3 border border-gray-100">
            <span className="text-[10px] uppercase font-bold text-gray-500">Today's P&L</span>
            <div className={`text-base font-bold font-mono mt-1 ${
              (positionsSummary?.total_pnl || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              ₹{(positionsSummary?.total_pnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-gray-50/80 rounded-lg p-3 border border-gray-100">
            <span className="text-[10px] uppercase font-bold text-gray-500">Realized P&L</span>
            <div className={`text-base font-bold font-mono mt-1 ${
              (positionsSummary?.realized_pnl || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              ₹{(positionsSummary?.realized_pnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-gray-50/80 rounded-lg p-3 border border-gray-100">
            <span className="text-[10px] uppercase font-bold text-gray-500">Unrealized P&L</span>
            <div className={`text-base font-bold font-mono mt-1 ${
              (positionsSummary?.unrealized_pnl || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              ₹{(positionsSummary?.unrealized_pnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-gray-50/80 rounded-lg p-3 border border-gray-100">
            <span className="text-[10px] uppercase font-bold text-gray-500">Open Positions</span>
            <div className="text-base font-bold font-mono text-gray-900 mt-1">
              {positionsSummary?.positions.filter(p => p.status === 'OPEN').length || 0}
            </div>
          </div>

          <div className="bg-gray-50/80 rounded-lg p-3 border border-gray-100">
            <span className="text-[10px] uppercase font-bold text-gray-500">Active Strategies</span>
            <div className="text-base font-bold font-mono text-gray-900 mt-1">
              {runningStrategies.length} / {strategies.length}
            </div>
          </div>

          <div className="bg-gray-50/80 rounded-lg p-3 border border-gray-100">
            <span className="text-[10px] uppercase font-bold text-gray-500">Orders Today</span>
            <div className="text-base font-bold font-mono text-gray-900 mt-1">
              {ordersTodayCount}
            </div>
          </div>

          <div className="bg-gray-50/80 rounded-lg p-3 border border-gray-100">
            <span className="text-[10px] uppercase font-bold text-gray-500">Trading Mode</span>
            <div className="text-base font-bold font-mono text-blue-700 mt-1">
              {tradingSettings?.trading_mode || 'PAPER'}
            </div>
          </div>
        </div>

        {/* If broker not connected notice */}
        {!connectedBroker && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-2 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-amber-900">Broker Not Connected</h4>
              <p className="text-xs text-amber-700 mt-0.5">
                Connect your Kotak Neo trading account to stream live portfolio holdings, account margin, and execute automated orders.
              </p>
            </div>
            <button
              onClick={() => onNavigate('broker')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold transition-colors"
            >
              Connect Kotak Neo
            </button>
          </div>
        )}
      </div>

      {/* 4. Active Algorithms Status Quick Overview */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">Configured Algorithms</h3>
            <p className="text-xs text-gray-500">Deployment and status of trading algorithms</p>
          </div>
          <button
            onClick={() => onNavigate('strategies')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            Manage Strategies →
          </button>
        </div>

        <div className="divide-y divide-gray-100 mt-2">
          {strategies.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              No strategies configured. Open the Strategies page to initialize the default 9/15 EMA strategy.
            </div>
          ) : (
            strategies.slice(0, 3).map((strat) => (
              <div key={strat.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-gray-900">{strat.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">
                      {strat.instrument}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      strat.status === 'RUNNING' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      strat.status === 'PAUSED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {strat.status} ({strat.mode})
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Fast: EMA {strat.fast_ema} · Slow: EMA {strat.slow_ema} · {strat.lots} lot(s) · SL: {strat.stop_loss} pts
                  </p>
                </div>

                <div className="text-right">
                  <div className={`text-xs font-bold font-mono ${strat.today_pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    ₹{strat.today_pnl.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    Last signal: {strat.last_signal || 'None'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
