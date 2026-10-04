import React from 'react';
import { User } from '../types';
import {
  TrendingUp, Shield, Activity, Radio, User as UserIcon,
  LogOut, Layers, BarChart2, ShieldCheck, Settings
} from 'lucide-react';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isWsConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  activeTab,
  setActiveTab,
  isWsConnected,
}) => {
  return (
    <header className="bg-[#151922] border-b border-[#232936] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white flex items-center space-x-1.5">
                <span>Kotak Neo Algo</span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  V1.0
                </span>
              </span>
              <p className="text-[11px] text-gray-400 font-mono">Broker-Adapter Platform</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            <button
              onClick={() => setActiveTab('market')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'market'
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1D2330]'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Market Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('option-chain')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'option-chain'
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1D2330]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Option Chain</span>
            </button>

            <button
              onClick={() => setActiveTab('backtest')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'backtest'
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1D2330]'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>Backtesting Lab</span>
            </button>

            <button
              onClick={() => setActiveTab('broker')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'broker'
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1D2330]'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Broker Setup</span>
            </button>

            {user.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'admin'
                    ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20'
                    : 'text-gray-400 hover:text-purple-300 hover:bg-[#1D2330]'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Panel</span>
              </button>
            )}
          </nav>

          {/* Right Status Badges & User Menu */}
          <div className="flex items-center space-x-3">
            {/* Safety Guardrail Badge */}
            <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Shield className="w-3.5 h-3.5" />
              <span>TRADING_ENABLED=false (Safe Paper Mode)</span>
            </div>

            {/* WebSocket Stream Indicator */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
                isWsConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}
              title={isWsConnected ? 'Connected to FastAPI Internal Feed' : 'Connecting to Feed...'}
            >
              <Radio className={`w-3 h-3 ${isWsConnected ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">{isWsConnected ? 'LIVE FEED' : 'OFFLINE'}</span>
            </div>

            {/* User Profile Info */}
            <div className="flex items-center space-x-2 pl-2 border-l border-[#232936]">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-white leading-none">{user.full_name}</p>
                <p className="text-[10px] text-gray-400 font-mono capitalize leading-tight mt-0.5">{user.role}</p>
              </div>

              <button
                onClick={onLogout}
                title="Log out"
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-[#1D2330] transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
