import {
  AuthResponse, User, Quote, OptionChain, BrokerAccount,
  BrokerProfile, StrategyDefinition, BacktestReport,
  AdminUserItem, AuditLogItem, SanitizedBrokerConnectResponse,
  UserTradingSettings, StrategyItem, TraderOrderRequest,
  TraderOrderResponse, TraderPositionsSummary, TraderOrderItem,
  AnalyticsSummary
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
  getBrokerAccounts: (): Promise<BrokerAccount[]> => request('/brokers/accounts'),

  connectBroker: (data: any): Promise<SanitizedBrokerConnectResponse> =>
    request('/brokers/connect', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  disconnectBroker: (accountId: number): Promise<{ success: boolean; message: string }> =>
    request(`/brokers/${accountId}/disconnect`, { method: 'POST' }),

  reconnectBroker: (accountId: number, totp?: string): Promise<SanitizedBrokerConnectResponse> =>
    request(`/brokers/${accountId}/reconnect`, {
      method: 'POST',
      body: JSON.stringify({ totp }),
    }),

  adminDisconnectBroker: (accountId: number): Promise<{ success: boolean; message: string }> =>
    request(`/admin/brokers/${accountId}/disconnect`, { method: 'POST' }),

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

  resetUserPassword: (userId: number, newPassword: string): Promise<{ success: boolean; message: string }> =>
    request(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword }),
    }),

  getAuditLogs: (): Promise<AuditLogItem[]> => request('/admin/audit-logs'),

  // Trader & Risk Management
  getTraderSettings: (): Promise<UserTradingSettings> => request('/trader/settings'),

  updateTraderSettings: (payload: Partial<UserTradingSettings>): Promise<UserTradingSettings> =>
    request('/trader/settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getLotSizes: (): Promise<Record<string, number>> => request('/trader/lots'),

  placeTraderOrder: (payload: TraderOrderRequest): Promise<TraderOrderResponse> =>
    request('/trader/order', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getTraderPositions: (): Promise<TraderPositionsSummary> => request('/trader/positions'),

  squareOffPosition: (positionId: number): Promise<{ success: boolean; message: string }> =>
    request(`/trader/positions/${positionId}/square-off`, { method: 'POST' }),

  squareOffAllPositions: (): Promise<{ success: boolean; count: number; message: string }> =>
    request('/trader/positions/square-off-all', { method: 'POST' }),

  getTraderOrders: (): Promise<TraderOrderItem[]> => request('/trader/orders'),

  // Algorithm Strategies
  getUserStrategies: (): Promise<StrategyItem[]> => request('/strategies'),

  createUserStrategy: (payload: Partial<StrategyItem>): Promise<StrategyItem> =>
    request('/strategies', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUserStrategy: (id: number, payload: Partial<StrategyItem>): Promise<StrategyItem> =>
    request(`/strategies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deployStrategy: (id: number, mode: 'PAPER' | 'LIVE'): Promise<StrategyItem> =>
    request(`/strategies/${id}/deploy`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),

  pauseStrategy: (id: number): Promise<StrategyItem> =>
    request(`/strategies/${id}/pause`, { method: 'POST' }),

  stopStrategy: (id: number): Promise<StrategyItem> =>
    request(`/strategies/${id}/stop`, { method: 'POST' }),

  deleteStrategy: (id: number): Promise<{ success: boolean; message: string }> =>
    request(`/strategies/${id}`, { method: 'DELETE' }),

  // Performance Analytics
  getAnalytics: (period: string = 'today'): Promise<AnalyticsSummary> =>
    request(`/analytics?period=${period}`),

  // System Health
  getHealth: (): Promise<{ status: string; app_name: string; trading_enabled: boolean; active_broker: string; is_connected: boolean }> =>
    request('/health'),
};
