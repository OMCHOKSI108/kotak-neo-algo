export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  is_active: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Quote {
  symbol: string;
  exchange: string;
  token?: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close?: number;
  prev_close: number;
  change: number;
  change_percent: number;
  volume: number;
  last_trade_time?: string;
  bid?: number;
  ask?: number;
  open_interest?: number;
}

export interface OptionContract {
  symbol: string;
  token?: string;
  option_type: 'CE' | 'PE';
  strike_price: number;
  ltp: number;
  prev_close?: number;
  change?: number;
  volume?: number;
  open_interest?: number;
  change_oi?: number;
  bid?: number;
  ask?: number;
  iv?: number;
}

export interface OptionStrike {
  strike_price: number;
  call?: OptionContract;
  put?: OptionContract;
}

export interface OptionChain {
  underlying: string;
  underlying_ltp: number;
  expiry: string;
  expiries: string[];
  lot_size: number;
  strikes: OptionStrike[];
}

export interface BrokerAccount {
  id: number;
  broker: string;
  broker_name: string;
  account_name: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'FAILED';
  is_connected: boolean;
  last_authenticated_at?: string;
  last_heartbeat_at?: string;
  masked_identifier: string;
  session_metadata?: Record<string, any>;
}

export interface SanitizedBrokerConnectResponse {
  success: boolean;
  broker: string;
  status: string;
  account?: string;
  account_id?: number;
  connected_at?: string;
  last_verified_at?: string;
  message?: string;
}

export interface BrokerProfile {
  client_id: string;
  client_name: string;
  broker_name: string;
  email?: string;
  available_margin: number;
  used_margin: number;
  is_live: boolean;
}

export interface StrategyParam {
  [key: string]: any;
}

export interface StrategyDefinition {
  id: string;
  name: string;
  description: string;
  default_symbol?: string;
  default_timeframe?: string;
  default_lot_size?: number;
  default_num_lots?: number;
  default_capital?: number;
  capital?: number;
  slippage_pct?: number;
  brokerage_per_order?: number;
  parameters: StrategyParam;
}

export interface TradeRecord {
  trade_id: number;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  quantity: number;
  entry_date: string;
  entry_price: number;
  exit_date: string;
  exit_price: number;
  gross_pnl: number;
  total_charges: number;
  net_pnl: number;
  net_return_pct: number;
  exit_reason: string;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  cash: number;
  close_price: number;
}

export interface BacktestMetrics {
  initial_capital: number;
  final_equity: number;
  net_pnl: number;
  net_return_percent: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown: number;
  max_drawdown_percent: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  avg_trade_pnl: number;
  max_consecutive_losses: number;
}

export interface BacktestReport {
  run_id?: number;
  strategy_id: string;
  strategy_name: string;
  symbol: string;
  timeframe: string;
  start_date: string;
  end_date: string;
  parameters: Record<string, any>;
  metrics: BacktestMetrics;
  trades: TradeRecord[];
  equity_curve: EquityPoint[];
}

export interface AdminUserItem {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  broker_accounts: {
    id: number;
    broker?: string;
    broker_name: string;
    account_name: string;
    status?: string;
    is_connected: boolean;
    last_heartbeat_at?: string;
    masked_identifier: string;
  }[];
}

export interface AuditLogItem {
  id: number;
  user_id?: number;
  action: string;
  details: Record<string, any>;
  created_at: string;
}
