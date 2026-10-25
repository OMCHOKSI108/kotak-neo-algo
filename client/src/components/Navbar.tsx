import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { KotakNeoLogo } from './KotakNeoLogo';
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
  isBrokerConnected: boolean;
  onOpenCreateUser?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  activeTab,
  setActiveTab,
  isWsConnected,
  isBrokerConnected,
  onOpenCreateUser,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isSuperAdmin = user.role === 'superadmin' || user.role === 'admin';

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
  const superAdminNavItems = [
    { id: 'market', label: 'Markets', icon: Activity },
    { id: 'option-chain', label: 'Option Chain', icon: Layers },
    { id: 'strategies', label: 'Strategies', icon: Cpu },
    { id: 'backtest', label: 'Backtest', icon: BarChart2 },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'admin', label: 'Users', icon: ShieldCheck },
    { id: 'broker', label: 'Brokers', icon: Settings },
  ];

  const userNavItems = [
    { id: 'market', label: 'Markets', icon: Activity },
    { id: 'option-chain', label: 'Option Chain', icon: Layers },
    { id: 'strategies', label: 'Strategies', icon: Cpu },
    { id: 'orders', label: 'Orders', icon: FileText },
    { id: 'positions', label: 'Positions', icon: Briefcase },
    { id: 'broker', label: 'Broker API', icon: Settings },
  ];

  const navItems = isSuperAdmin ? superAdminNavItems : userNavItems;

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
              onClick={() => handleTabClick(isSuperAdmin ? 'dashboard' : 'dashboard')}
              className="focus:outline-none text-left cursor-pointer transition-opacity hover:opacity-95"
            >
              <KotakNeoLogo size="sm" />
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
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                isWsConnected && isBrokerConnected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : isWsConnected
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}
              title={
                isWsConnected && isBrokerConnected
                  ? 'Live market data from Kotak Neo'
                  : isWsConnected
                  ? 'Simulated paper-trading data (broker not connected)'
                  : 'Market feed disconnected'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isWsConnected && isBrokerConnected
                    ? 'bg-emerald-500 animate-pulse'
                    : isWsConnected
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <span className="hidden sm:inline font-mono">
                {isWsConnected && isBrokerConnected
                  ? 'Live'
                  : isWsConnected
                  ? 'Paper'
                  : 'Offline'}
              </span>
            </div>

            {/* Admin Quick Action Button: + Add User */}
            {isSuperAdmin && onOpenCreateUser && (
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
                  isSuperAdmin ? 'bg-purple-600' : 'bg-blue-600'
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
                        isSuperAdmin
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {isSuperAdmin ? 'Super Admin' : 'Trader / User'}
                      </span>
                    </div>
                  </div>

                  {/* Menu Options */}
                  <div className="py-1">
                    {isSuperAdmin ? (
                      <>
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            setActiveTab('admin');
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium flex items-center space-x-2"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                          <span>User Management (RBAC)</span>
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
                            <span>Create New User / Admin</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            setActiveTab('strategies');
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium flex items-center space-x-2"
                        >
                          <Cpu className="w-3.5 h-3.5 text-blue-600" />
                          <span>Trading Strategies</span>
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
