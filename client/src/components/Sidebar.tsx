import React, { useState } from 'react';
import { User } from '../types';
import { KotakNeoLogo } from './KotakNeoLogo';
import {
  TrendingUp, Activity, Layers, BarChart2, Settings,
  ShieldCheck, UserPlus, LogOut, ChevronDown, Menu, X,
  LayoutDashboard, Terminal, FileText, Briefcase, Cpu,
  ChevronLeft, ChevronRight, Zap, Shield
} from 'lucide-react';

interface SidebarProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  onToggle: () => void;
  isWsConnected: boolean;
  isBrokerConnected: boolean;
  onOpenCreateUser?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onLogout,
  isOpen,
  onToggle,
  isWsConnected,
  isBrokerConnected,
  onOpenCreateUser,
}) => {
  const isSuperAdmin = user.role === 'superadmin' || user.role === 'admin';

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'TR';
  };

  // Grouped Navigation Sections
  const navSections = [
    {
      title: 'TRADING & TERMINAL',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'market', label: 'Market Watchlist', icon: Activity, badge: 'Live' },
        { id: 'option-chain', label: 'Option Chain (Dhan-Style)', icon: Layers, highlight: true },
        { id: 'trader', label: 'Trading Ticket', icon: Terminal },
        { id: 'orders', label: 'Order Book', icon: FileText },
        { id: 'positions', label: 'Positions & MTM', icon: Briefcase },
      ]
    },
    {
      title: 'QUANT & RESEARCH',
      items: [
        { id: 'strategies', label: 'Algo Strategies', icon: Cpu },
        { id: 'backtest', label: 'Backtesting Lab', icon: BarChart2, badge: 'Options' },
        { id: 'analytics', label: 'P&L Analytics', icon: TrendingUp },
      ]
    },
    {
      title: 'ADMIN & CONFIG',
      items: [
        ...(isSuperAdmin ? [{ id: 'admin', label: 'User RBAC Management', icon: ShieldCheck, badge: 'Admin' }] : []),
        { id: 'broker', label: isSuperAdmin ? 'Broker (.env Link)' : 'Broker Settings', icon: Settings },
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-2xs lg:hidden"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 font-sans ${
          isOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-16'
        }`}
      >
        {/* Brand & Collapse Header */}
        <div className="h-14 px-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div className="flex items-center overflow-hidden">
            {isOpen ? (
              <button
                onClick={() => setActiveTab('dashboard')}
                className="focus:outline-none text-left cursor-pointer transition-opacity hover:opacity-95"
              >
                <KotakNeoLogo size="sm" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-black text-white text-xs shadow-2xs">
                KN
              </div>
            )}
          </div>

          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          >
            {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4 hidden lg:block" />}
          </button>
        </div>

        {/* Scrollable Nav Items */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {isOpen && (
                <span className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 block mb-1">
                  {section.title}
                </span>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      if (window.innerWidth < 1024) onToggle();
                    }}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all relative ${
                      isOpen ? 'px-3 py-2 space-x-2.5 justify-start' : 'p-2.5 justify-center'
                    } ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-bold shadow-2xs border border-blue-200/60'
                        : item.highlight
                        ? 'text-gray-800 hover:bg-blue-50/50 hover:text-blue-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    title={!isOpen ? item.label : undefined}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                    {isOpen && (
                      <div className="flex-1 flex items-center justify-between truncate">
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                            item.badge === 'Admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom User Profile & Status Card */}
        <div className="p-3 border-t border-gray-200 bg-gray-50/50 shrink-0">
          {isOpen ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-2xs ${
                    isSuperAdmin ? 'bg-purple-600' : 'bg-blue-600'
                  }`}>
                    {getInitials(user.full_name, user.email)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate leading-none">{user.full_name}</p>
                    <span className={`inline-block text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded mt-1 font-mono ${
                      isSuperAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {isSuperAdmin ? 'Super Admin' : 'Trader'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Feed & Broker Status Indicator */}
              <div className="p-2 bg-white rounded-lg border border-gray-200 text-[10px] font-mono space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Market Feed:</span>
                  <span className={`font-bold flex items-center gap-1 ${
                    isWsConnected && isBrokerConnected ? 'text-emerald-600' : isWsConnected ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isWsConnected && isBrokerConnected ? 'bg-emerald-500 animate-pulse' : isWsConnected ? 'bg-amber-400' : 'bg-red-500'
                    }`} />
                    {isWsConnected && isBrokerConnected ? 'Live Kotak' : isWsConnected ? 'Paper Sim' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Broker:</span>
                  <span className="font-bold text-gray-700">
                    {isBrokerConnected ? 'Kotak Neo' : isSuperAdmin ? 'Configured (.env)' : 'Not Connected'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-2xs ${
                isSuperAdmin ? 'bg-purple-600' : 'bg-blue-600'
              }`}>
                {getInitials(user.full_name, user.email)}
              </div>
              <button
                onClick={onLogout}
                className="p-1 text-gray-400 hover:text-red-600 rounded-lg"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
