import React, { useState, useEffect } from 'react';
import { User } from './types';
import { api } from './api';
import { useMarketData } from './hooks/useMarketData';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MarketDashboard } from './pages/MarketDashboard';
import { OptionChainPage } from './pages/OptionChainPage';
import { StrategiesPage } from './pages/StrategiesPage';
import { TraderPage } from './pages/TraderPage';
import { OrdersPage } from './pages/OrdersPage';
import { PositionsPage } from './pages/PositionsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { BrokerSettingsPage } from './pages/BrokerSettingsPage';
import { BacktestingLab } from './pages/BacktestingLab';
import { AdminDashboard } from './pages/AdminDashboard';
import { CreateUserModal } from './components/CreateUserModal';
import { Sidebar } from './components/Sidebar';
import { CentralizedTradingModeSwitch } from './components/CentralizedTradingModeSwitch';
import { AlertCircle, ShieldCheck, Menu, Plus } from 'lucide-react';

interface SystemHealth {
  status: string;
  app_name: string;
  trading_enabled: boolean;
  active_broker: string;
  is_connected: boolean;
}

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedOptionUnderlying, setSelectedOptionUnderlying] = useState<string>('NIFTY');
  const [selectedTraderSymbol, setSelectedTraderSymbol] = useState<string>('NIFTY');
  const [selectedBacktestStrategy, setSelectedBacktestStrategy] = useState<string | undefined>(undefined);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [showGlobalCreateUserModal, setShowGlobalCreateUserModal] = useState(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tradingMode, setTradingMode] = useState<'PAPER' | 'LIVE'>(
    (localStorage.getItem('trading_mode') as 'PAPER' | 'LIVE') || 'PAPER'
  );

  // Sync trading mode from backend user settings
  useEffect(() => {
    if (!user) return;
    api.getTraderSettings().then((s) => {
      if (s?.trading_mode) {
        setTradingMode(s.trading_mode as 'PAPER' | 'LIVE');
      }
    }).catch(() => {});
  }, [user]);

  // Real-time market data hook
  const { quotes, isConnected: isWsConnected, flashStates } = useMarketData();

  // Fetch health status periodically
  const fetchHealth = async () => {
    try {
      const data = await api.getHealth();
      setSystemHealth(data);
    } catch {
      setSystemHealth(null);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        const parsedUser: User = JSON.parse(storedUser);
        setUser(parsedUser);
        const isSuper = parsedUser.role === 'superadmin' || parsedUser.role === 'admin';
        if (isSuper) {
          setActiveTab('dashboard');
        } else {
          setActiveTab('dashboard');
        }

        // Validate with backend in background
        api.getMe()
          .then((freshUser) => {
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
          })
          .catch(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          })
          .finally(() => setLoadingInitial(false));
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setLoadingInitial(false);
      }
    } else {
      setLoadingInitial(false);
    }
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setActiveTab('dashboard');
  };

  const handleNavigateOptionChain = (symbol: string) => {
    let cleanSym = symbol;
    if (symbol.includes('NIFTY 50') || symbol === 'NIFTY') cleanSym = 'NIFTY';
    else if (symbol.includes('BANKNIFTY')) cleanSym = 'BANKNIFTY';
    else if (symbol.includes('SENSEX')) cleanSym = 'SENSEX';

    setSelectedOptionUnderlying(cleanSym);
    setActiveTab('option-chain');
  };

  const handleTabNavigate = (tab: string, param?: string) => {
    if (param) {
      if (tab === 'option-chain') {
        setSelectedOptionUnderlying(param);
      } else if (tab === 'trader') {
        setSelectedTraderSymbol(param);
      } else if (tab === 'backtest') {
        setSelectedBacktestStrategy(param);
      }
    }
    setActiveTab(tab);
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-600 text-xs font-semibold tracking-wide">
            Loading Trading Workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Workspace Overview';
      case 'market': return 'Live Watchlist (NSE & BSE Equities & Indices)';
      case 'option-chain': return 'Option Chain · Dhan-Style Direct Trading';
      case 'trader': return 'Order Execution Ticket';
      case 'orders': return 'Order Book & Trade History';
      case 'positions': return 'Open Positions & Realized MTM';
      case 'strategies': return 'Algorithmic Strategy Engine';
      case 'backtest': return 'Quantitative Backtesting Lab (Options & Futures)';
      case 'analytics': return 'P&L Analytics & Risk Breakdown';
      case 'admin': return 'User RBAC & Access Control';
      case 'broker': return 'Kotak Neo Direct Broker Link';
      default: return tab;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-900 flex font-sans selection:bg-blue-600 selection:text-white">
      {/* Collapsible Left Sidebar */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isWsConnected={isWsConnected}
        isBrokerConnected={systemHealth?.is_connected ?? false}
        onOpenCreateUser={() => setShowGlobalCreateUserModal(true)}
      />

      {/* Main Container with dynamic left padding for sidebar */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-16'}`}>
        {/* Top App Header */}
        <header className="h-14 bg-white border-b border-gray-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 shadow-2xs">
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Toggle Navigation Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-bold text-gray-900 font-sans tracking-tight truncate">
              {getTabTitle(activeTab)}
            </h1>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            {/* Centralized Execution Control Toggle (Paper vs Live Kotak Neo) */}
            <CentralizedTradingModeSwitch
              currentMode={tradingMode}
              onModeChange={setTradingMode}
              brokerConnected={systemHealth?.is_connected ?? false}
            />

            {/* Live Feed Pill */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                isWsConnected && systemHealth?.is_connected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : isWsConnected
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isWsConnected && systemHealth?.is_connected
                    ? 'bg-emerald-500 animate-pulse'
                    : isWsConnected
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-gray-400'
                }`}
              />
              <span className="font-mono font-bold text-[10px] uppercase">
                {isWsConnected && systemHealth?.is_connected
                  ? 'Live (Kotak Neo)'
                  : isWsConnected
                  ? 'Simulated (Paper)'
                  : 'Feed Offline'}
              </span>
            </div>

            {/* Broker Status Pill */}
            <div className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-[10px] font-mono text-gray-700">
              <span className="text-gray-400">Broker:</span>
              <span className="font-bold">
                {systemHealth?.is_connected ? 'Kotak Neo Live' : (user.role === 'superadmin' || user.role === 'admin') ? 'Configured (.env)' : 'Not Connected'}
              </span>
            </div>

            {/* Super Admin Quick + User Button */}
            {(user.role === 'superadmin' || user.role === 'admin') && (
              <button
                onClick={() => setShowGlobalCreateUserModal(true)}
                className="hidden md:flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ User</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardPage
            quotes={quotes}
            isWsConnected={isWsConnected}
            user={user}
            onNavigate={handleTabNavigate}
          />
        )}

        {activeTab === 'market' && (
          <MarketDashboard
            quotes={quotes}
            flashStates={flashStates}
            onNavigateOptionChain={handleNavigateOptionChain}
            user={user}
          />
        )}

        {activeTab === 'option-chain' && (
          <OptionChainPage
            initialUnderlying={selectedOptionUnderlying}
            onNavigateTrader={(sym) => {
              setSelectedTraderSymbol(sym);
              setActiveTab('trader');
            }}
            tradingMode={tradingMode}
          />
        )}

        {activeTab === 'strategies' && (
          <StrategiesPage
            user={user}
            onNavigateBacktest={(stratName) => {
              setSelectedBacktestStrategy(stratName);
              setActiveTab('backtest');
            }}
          />
        )}

        {activeTab === 'trader' && (
          <TraderPage
            user={user}
            initialSymbol={selectedTraderSymbol}
            onNavigate={handleTabNavigate}
            tradingMode={tradingMode}
            onModeChange={setTradingMode}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersPage
            user={user}
            onNavigateTrader={() => setActiveTab('trader')}
          />
        )}

        {activeTab === 'positions' && (
          <PositionsPage
            user={user}
            onNavigateTrader={(sym) => {
              setSelectedTraderSymbol(sym);
              setActiveTab('trader');
            }}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsPage
            user={user}
            onNavigateTrader={() => setActiveTab('trader')}
          />
        )}

        {activeTab === 'backtest' && (
          <BacktestingLab
            initialStrategy={selectedBacktestStrategy}
          />
        )}

        {activeTab === 'broker' && (
          <BrokerSettingsPage user={user} />
        )}

        {activeTab === 'admin' && (
          (user.role === 'superadmin' || user.role === 'admin') ? (
            <AdminDashboard />
          ) : (
            <div className="bg-white border border-red-200 rounded-xl p-8 text-center max-w-md mx-auto my-12 shadow-2xs">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-900 mb-1">Access Restricted</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                You are currently logged in with a standard <span className="font-semibold text-gray-800">User Account</span>. Administrator privileges are required to manage users and inspect system security logs.
              </p>
            </div>
          )
        )}
      </main>

      {/* Global Admin User Creation Modal */}
      {(user.role === 'superadmin' || user.role === 'admin') && (
        <CreateUserModal
          isOpen={showGlobalCreateUserModal}
          onClose={() => setShowGlobalCreateUserModal(false)}
        />
      )}

      {/* Bottom Status Footer with Real Health Polling */}
      <footer className="bg-white border-t border-gray-200 py-2.5 px-4 sm:px-6 lg:px-8 text-xs text-gray-500 flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
        <div className="flex items-center space-x-3 text-[11px] font-mono">
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${systemHealth ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
            <span className="text-gray-700">API {systemHealth ? 'Connected' : 'Connecting...'}</span>
          </div>
          <span className="text-gray-300">·</span>
          <div className="flex items-center space-x-1.5">
            {isWsConnected && systemHealth?.is_connected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-gray-700">Feed Live (Kotak Neo)</span>
              </>
            ) : isWsConnected && !systemHealth?.is_connected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="text-gray-700">Feed Simulated (Paper)</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-gray-700">Feed Offline</span>
              </>
            )}
          </div>
          <span className="text-gray-300">·</span>
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${systemHealth?.is_connected ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
            <span className="text-gray-700">
              Broker: {systemHealth?.is_connected ? (systemHealth.active_broker || 'Kotak Neo') : 'Not Connected'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-[11px]">
          <span className={`font-semibold ${systemHealth?.trading_enabled ? 'text-amber-700' : 'text-gray-600'}`}>
            {systemHealth?.trading_enabled ? 'Execution: LIVE BROKER OMS' : 'Safe Mode: Paper Simulation'}
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-400 font-mono">NeoAlgo Trading Terminal</span>
        </div>
      </footer>
      </div>
    </div>
  );
};

export default App;
