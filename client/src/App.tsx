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
import { CreateUserModal } from './components/CreateUserModal';
import { ShieldCheck, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('market');
  const [selectedOptionUnderlying, setSelectedOptionUnderlying] = useState<string>('NIFTY');
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [showGlobalCreateUserModal, setShowGlobalCreateUserModal] = useState(false);

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
    let cleanSym = symbol;
    if (symbol.includes('NIFTY 50') || symbol === 'NIFTY') cleanSym = 'NIFTY';
    else if (symbol.includes('BANKNIFTY')) cleanSym = 'BANKNIFTY';
    else if (symbol.includes('SENSEX')) cleanSym = 'SENSEX';

    setSelectedOptionUnderlying(cleanSym);
    setActiveTab('option-chain');
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        user={user}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isWsConnected={isWsConnected}
        onOpenCreateUser={() => setShowGlobalCreateUserModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'market' && (
          <MarketDashboard
            quotes={quotes}
            flashStates={flashStates}
            onNavigateOptionChain={handleNavigateOptionChain}
            user={user}
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
            <div className="bg-white border border-red-200 rounded-xl p-8 text-center max-w-md mx-auto my-12 shadow-sm">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-900 mb-1">Access Restricted</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                You are currently logged in with a standard <span className="font-semibold text-gray-800">Trader Account</span>. Administrator privileges are required to manage users and view server security audits.
              </p>
            </div>
          )
        )}
      </main>

      {/* Global Admin User Creation Modal */}
      {user.role === 'admin' && (
        <CreateUserModal
          isOpen={showGlobalCreateUserModal}
          onClose={() => setShowGlobalCreateUserModal(false)}
        />
      )}

      {/* Bottom Status Footer */}
      <footer className="bg-white border-t border-gray-200 py-3 px-4 sm:px-6 lg:px-8 text-xs text-gray-600 flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0 shadow-xs">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-mono text-gray-700 font-medium">Backend API: Online</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></span>
            <span className="font-mono text-gray-700 font-medium">
              Internal WebSocket: {isWsConnected ? 'Live Tick Feed' : 'Connecting...'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <span className="font-mono text-amber-800 font-semibold flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-amber-600" />
            V1 Paper Sandbox Mode Active
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500 font-mono">FastAPI + React + PostgreSQL</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
