import React from 'react';
import { User } from '../types';
import {
  TrendingUp, Shield, Activity, Radio, User as UserIcon,
  LogOut, Layers, BarChart2, ShieldCheck, Settings, UserPlus
} from 'lucide-react';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isWsConnected: boolean;
  onOpenCreateUser?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  activeTab,
  setActiveTab,
  isWsConnected,
  onOpenCreateUser,
}) => {
  const isAdmin = user.role === 'admin';

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-gray-900 flex items-center space-x-1.5">
                <span>Kotak Neo Algo</span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  V1.0
                </span>
              </span>
              <p className="text-[11px] text-gray-500 font-medium">Algorithmic Research Platform</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            <button
              onClick={() => setActiveTab('market')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'market'
                  ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Live Market</span>
            </button>

            <button
              onClick={() => setActiveTab('option-chain')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'option-chain'
                  ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Option Chain</span>
            </button>

            <button
              onClick={() => setActiveTab('backtest')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'backtest'
                  ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>Backtesting Lab</span>
            </button>

            <button
              onClick={() => setActiveTab('broker')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'broker'
                  ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Broker Setup</span>
            </button>

            {/* Admin only tab */}
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'admin'
                    ? 'bg-purple-50 text-purple-700 font-semibold border border-purple-200'
                    : 'text-gray-600 hover:text-purple-700 hover:bg-purple-50'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>Admin Panel</span>
              </button>
            )}
          </nav>

          {/* Right Status Badges & User Menu */}
          <div className="flex items-center space-x-3">
            {/* Quick Admin + Create User Button */}
            {isAdmin && onOpenCreateUser && (
              <button
                onClick={onOpenCreateUser}
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
                title="Create a new user account"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ User</span>
              </button>
            )}

            {/* Account Role Badge (Admin vs Trader) */}
            <div
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                isAdmin
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
              title={isAdmin ? 'Administrator Account (Full Privileges)' : 'Trader Account (Standard Privileges)'}
            >
              {isAdmin ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  <span>ADMIN</span>
                </>
              ) : (
                <>
                  <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span>TRADER</span>
                </>
              )}
            </div>

            {/* WebSocket Stream Indicator */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
                isWsConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
              title={isWsConnected ? 'Connected to FastAPI Internal Feed' : 'Connecting to Feed...'}
            >
              <Radio className={`w-3 h-3 ${isWsConnected ? 'animate-pulse text-emerald-600' : 'text-red-500'}`} />
              <span className="hidden sm:inline">{isWsConnected ? 'LIVE FEED' : 'OFFLINE'}</span>
            </div>

            {/* User Profile Info */}
            <div className="flex items-center space-x-2 pl-2 border-l border-gray-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-gray-900 leading-none">{user.full_name}</p>
                <p className="text-[10px] text-gray-500 font-mono truncate max-w-[120px] mt-0.5">{user.email}</p>
              </div>

              <button
                onClick={onLogout}
                title="Log out"
                className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-gray-100 transition-colors"
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
