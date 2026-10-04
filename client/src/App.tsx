import React, { useState, useEffect } from 'react';
import { User } from './types';
import { api } from './api';
import { useMarketData } from './hooks/useMarketData';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { MarketDashboard } from './pages/MarketDashboard';
import { OptionChainPage } from './pages/OptionChainPage';
import { BrokerSettingsPage } from './pages/BrokerSettingsPage';
import { BacktestingLab } from './pages/BacktestingLab';
import { AdminDashboard } from './pages/AdminDashboard';
import { ShieldCheck, Server, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('market');
  const [selectedOptionUnderlying, setSelectedOptionUnderlying] = useState<string>('NIFTY');
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Real-time market data hook
  const { quotes, isConnected: isWsConnected, flashStates } = useMarketData();

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        const parsedUser: User = JSON.parse(storedUser);
        setUser(parsedUser);
        // Validate with backend in background
        api.getMe()
          .then((freshUser) => {
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
          })
          .catch(() => {
            // Token might be invalid or expired
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

  const handleLoginSuccess = (loggedInUser: User, token: string) => {
    setUser(loggedInUser);
    setActiveTab('market');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setActiveTab('market');
  };

  const handleNavigateOptionChain = (symbol: string) => {
    // Normalize index symbol names for option chain
    let cleanSym = symbol;
    if (symbol.includes('NIFTY 50') || symbol === 'NIFTY') cleanSym = 'NIFTY';
    else if (symbol.includes('BANKNIFTY')) cleanSym = 'BANKNIFTY';
    else if (symbol.includes('SENSEX')) cleanSym = 'SENSEX';

    setSelectedOptionUnderlying(cleanSym);
    setActiveTab('option-chain');
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm font-mono tracking-wide">
            Initializing Kotak Neo Algo Platform...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#0E1117] text-gray-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        user={user}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isWsConnected={isWsConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'market' && (
          <MarketDashboard
            quotes={quotes}
            flashStates={flashStates}
            onNavigateOptionChain={handleNavigateOptionChain}
          />
        )}

        {activeTab === 'option-chain' && (
          <OptionChainPage initialUnderlying={selectedOptionUnderlying} />
        )}

        {activeTab === 'backtest' && (
          <BacktestingLab />
        )}

        {activeTab === 'broker' && (
          <BrokerSettingsPage />
        )}

        {activeTab === 'admin' && (
          user.role === 'admin' ? (
            <AdminDashboard />
          ) : (
            <div className="bg-[#151922] border border-red-500/20 rounded-xl p-8 text-center max-w-md mx-auto my-12">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white mb-2">Access Restricted</h3>
              <p className="text-sm text-gray-400">
                You need Administrator privileges to access user management and audit logs.
              </p>
            </div>
          )
        )}
      </main>

      {/* Bottom Status Footer */}
      <footer className="bg-[#151922] border-t border-[#232936] py-3 px-4 sm:px-6 lg:px-8 text-xs text-gray-500 flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-mono text-gray-400">Backend API: Online</span>
          </div>
          <span className="text-gray-700">|</span>
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`}></span>
            <span className="font-mono text-gray-400">
              WebSocket: {isWsConnected ? 'Connected (Active Feed)' : 'Reconnecting...'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <span className="font-mono text-amber-400/90 flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
            V1 Paper Sandbox Mode Active
          </span>
          <span className="text-gray-700">|</span>
          <span className="text-gray-500">PostgreSQL + FastAPI + React</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
