import {
  AuthResponse, User, Quote, OptionChain, BrokerAccount,
  BrokerProfile, StrategyDefinition, BacktestReport,
  AdminUserItem, AuditLogItem
} from './types';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth-expired'));
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    let errorMsg = `Request failed: ${response.statusText}`;
    try {
      const errData = await response.json();
      errorMsg = errData.detail || errorMsg;
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Authentication
  login: (email: string, password: string): Promise<AuthResponse> =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: (): Promise<User> => request('/auth/me'),

  // Market Data
  getQuotes: (symbols?: string[]): Promise<Quote[]> => {
    const query = symbols ? `?symbols=${symbols.join('&symbols=')}` : '';
    return request(`/market/quotes${query}`);
  },

  getExpiries: (underlying: string): Promise<string[]> =>
    request(`/market/expiries?underlying=${encodeURIComponent(underlying)}`),

  getOptionChain: (underlying: string, expiry?: string): Promise<OptionChain> => {
    let url = `/market/option-chain?underlying=${encodeURIComponent(underlying)}`;
    if (expiry) url += `&expiry=${encodeURIComponent(expiry)}`;
    return request(url);
  },

  // Broker Accounts
  getBrokerAccounts: (): Promise<BrokerAccount[]> => request('/broker/accounts'),

  connectBroker: (data: any): Promise<BrokerAccount> =>
    request('/broker/connect', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  disconnectBroker: (accountId: number): Promise<{ message: string }> =>
    request(`/broker/disconnect/${accountId}`, { method: 'POST' }),

  checkHeartbeat: (accountId: number): Promise<any> =>
    request(`/broker/heartbeat/${accountId}`),

  getBrokerProfile: (): Promise<BrokerProfile> => request('/broker/profile'),

  // Backtest
  getStrategies: (): Promise<StrategyDefinition[]> => request('/backtest/strategies'),

  getDatasets: (): Promise<string[]> => request('/backtest/datasets'),

  runBacktest: (payload: any): Promise<BacktestReport> =>
    request('/backtest/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getBacktestHistory: (): Promise<any[]> => request('/backtest/history'),

  // Admin Operations
  getAdminUsers: (): Promise<AdminUserItem[]> => request('/admin/users'),

  createAdminUser: (data: any): Promise<AdminUserItem> =>
    request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUserStatus: (userId: number, isActive: boolean): Promise<AdminUserItem> =>
    request(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    }),

  deleteUser: (userId: number): Promise<{ message: string }> =>
    request(`/admin/users/${userId}`, { method: 'DELETE' }),

  getAuditLogs: (): Promise<AuditLogItem[]> => request('/admin/audit-logs'),
};
