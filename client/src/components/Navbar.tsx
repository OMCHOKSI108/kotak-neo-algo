import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import {
  TrendingUp, Activity, Layers, BarChart2, Settings,
  ShieldCheck, UserPlus, LogOut, ChevronDown, Menu, X,
  LayoutDashboard, Terminal, FileText, Briefcase, Cpu
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAdmin = user.role === 'admin';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute user initials for avatar
  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'TR';
  };

  // Role-based navigation tabs
  const adminNavItems = [
    { id: 'market', label: 'Markets', icon: Activity },
    { id: 'option-chain', label: 'Option Chain', icon: Layers },
    { id: 'strategies', label: 'Strategies', icon: Cpu },
    { id: 'backtest', label: 'Backtest', icon: BarChart2 },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'admin', label: 'Users', icon: ShieldCheck },
    { id: 'broker', label: 'Brokers', icon: Settings },
  ];

  const traderNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'market', label: 'Markets', icon: Activity },
    { id: 'option-chain', label: 'Option Chain', icon: Layers },
    { id: 'strategies', label: 'Strategies', icon: Cpu },
    { id: 'trader', label: 'Trader', icon: Terminal },
    { id: 'orders', label: 'Orders', icon: FileText },
    { id: 'positions', label: 'Positions', icon: Briefcase },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'backtest', label: 'Backtest', icon: BarChart2 },
    { id: 'broker', label: 'Brokers', icon: Settings },
  ];

  const navItems = isAdmin ? adminNavItems : traderNavItems;

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => handleTabClick(isAdmin ? 'market' : 'dashboard')}
              className="flex items-center space-x-2.5 focus:outline-none text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-2xs">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight text-gray-900 block leading-tight">
                  NeoAlgo
                </span>
                <span className="text-[10px] text-gray-500 font-medium block leading-none">
                  Trading Terminal
                </span>
              </div>
            </button>
          </div>

          {/* Center: Segmented Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center space-x-0.5 overflow-x-auto py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-gray-100 text-gray-900 font-bold shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Feed Status, Quick Actions, Profile Dropdown */}
          <div className="flex items-center space-x-2.5 shrink-0">
            {/* Live Feed Pill Indicator */}
            <div
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-50 border border-gray-200 text-gray-600"
              title={isWsConnected ? 'Market feed active (NSE WebSocket)' : 'Market feed disconnected'}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              <span className="hidden sm:inline font-mono">{isWsConnected ? 'Live Feed' : 'Feed Offline'}</span>
            </div>

            {/* Admin Quick Action Button: + Add User */}
            {isAdmin && onOpenCreateUser && (
              <button
                onClick={onOpenCreateUser}
                className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors shadow-2xs"
                title="Create a new trader account"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ User</span>
              </button>
            )}

            {/* Profile Dropdown Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 p-1 pl-1.5 pr-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors focus:outline-none"
              >
                {/* Initials Avatar */}
                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold text-white ${
                  isAdmin ? 'bg-purple-600' : 'bg-blue-600'
                }`}>
                  {getInitials(user.full_name, user.email)}
                </div>

                <div className="hidden sm:block text-left">
                  <span className="text-xs font-semibold text-gray-900 block leading-none max-w-[90px] truncate">
                    {user.full_name?.split(' ')[0] || 'User'}
                  </span>
                </div>

                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>

              {/* Dropdown Content Card */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-50 text-xs animate-fade-in font-sans">
                  {/* User Profile Summary */}
                  <div className="p-2.5 border-b border-gray-100">
                    <p className="font-bold text-gray-900 text-sm truncate">{user.full_name}</p>
                    <p className="text-gray-500 font-mono text-[11px] truncate mt-0.5">{user.email}</p>
                    <div className="mt-2 flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isAdmin
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {isAdmin ? 'Administrator' : 'Trader Account'}
                      </span>
                    </div>
                  </div>

                  {/* Menu Options */}
                  <div className="py-1">
                    {isAdmin ? (
                      <>
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            setActiveTab('admin');
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium flex items-center space-x-2"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                          <span>User Management</span>
                        </button>

                        {onOpenCreateUser && (
                          <button
                            onClick={() => {
                              setDropdownOpen(false);
                              onOpenCreateUser();
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium flex items-center space-x-2"
                          >
                            <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                            <span>Create New User</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            setActiveTab('trader');
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium flex items-center space-x-2"
                        >
                          <Terminal className="w-3.5 h-3.5 text-blue-600" />
                          <span>Trader Terminal</span>
                        </button>

                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            setActiveTab('positions');
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium flex items-center space-x-2"
                        >
                          <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Positions & MTM</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        setActiveTab('broker');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium flex items-center space-x-2"
                    >
                      <Settings className="w-3.5 h-3.5 text-gray-500" />
                      <span>Broker Accounts</span>
                    </button>
                  </div>

                  {/* Logout Divider */}
                  <div className="pt-1 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-red-600 font-medium flex items-center space-x-2 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5 text-red-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-gray-200 grid grid-cols-2 gap-1 animate-fade-in">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
