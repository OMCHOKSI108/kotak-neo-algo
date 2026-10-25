import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { BrokerAccount, BrokerProfile, User } from '../types';
import {
  ShieldCheck, Radio, RefreshCw, Key, Lock, Phone, User as UserIcon,
  CheckCircle2, AlertTriangle, Plus, Server, Check, Clock,
  Smartphone, ChevronDown, ChevronUp, Wallet, ArrowRightLeft, Info
} from 'lucide-react';

interface BrokerSettingsPageProps {
  user?: User;
}

export const BrokerSettingsPage: React.FC<BrokerSettingsPageProps> = ({ user }) => {
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showConfigForm, setShowConfigForm] = useState(false);

  // Broker selection
  const [selectedBroker, setSelectedBroker] = useState<'KOTAK_NEO' | 'UPSTOX' | 'FYERS'>('KOTAK_NEO');

  // Connection form state
  const [accountName, setAccountName] = useState('My Kotak Account');
  const [consumerKey, setConsumerKey] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [ucc, setUcc] = useState('');
  const [mpin, setMpin] = useState('');
  const [totp, setTotp] = useState('');
  const [environment, setEnvironment] = useState('prod');

  // Reconnect modal state
  const [reconnectModalAcc, setReconnectModalAcc] = useState<BrokerAccount | null>(null);
  const [reconnectTotp, setReconnectTotp] = useState('');
  const [refreshingMargin, setRefreshingMargin] = useState(false);

  const loadAccountsAndProfile = async () => {
    setLoading(true);
    try {
      const [accs, prof] = await Promise.all([
        api.getBrokerAccounts(),
        api.getBrokerProfile().catch(() => null),
      ]);
      setAccounts(accs);
      if (prof) setProfile(prof);

      // Auto-open form only for standard users without connected accounts
      const hasConn = accs.some((a) => a.is_connected || a.status === 'CONNECTED');
      if (!hasConn && !isSuperAdmin) {
        setShowConfigForm(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load broker data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshMargin = async () => {
    setRefreshingMargin(true);
    setError(null);
    try {
      const prof = await api.getBrokerProfile();
      if (prof) setProfile(prof);
      const accs = await api.getBrokerAccounts();
      setAccounts(accs);
      setSuccessMsg('Live margin updated from broker API.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setError('Failed to refresh margin from broker API: ' + (err.message || 'Network error'));
    } finally {
      setRefreshingMargin(false);
    }
  };

  useEffect(() => {
    loadAccountsAndProfile();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      if (selectedBroker === 'KOTAK_NEO') {
        if (!consumerKey || !mobileNumber || !ucc || !mpin || !totp) {
          setError('Please fill in Consumer Key, Mobile, UCC, MPIN, and 6-digit TOTP.');
          setActionLoading(false);
          return;
        }

        if (totp.trim().length !== 6 || !/^\d{6}$/.test(totp.trim())) {
          setError('TOTP must be a valid 6-digit numeric code.');
          setActionLoading(false);
          return;
        }
      }

      const payload: any = {
        broker: selectedBroker,
        account_name: accountName,
      };

      if (selectedBroker === 'KOTAK_NEO') {
        payload.consumer_key = consumerKey.trim();
        payload.mobile_number = mobileNumber.trim();
        payload.ucc = ucc.trim().toUpperCase();
        payload.mpin = mpin.trim();
        payload.totp = totp.trim();
        payload.environment = environment;
      }

      const res = await api.connectBroker(payload);

      if (res.success) {
        setSuccessMsg(res.message || `Connected to ${selectedBroker}!`);
        setConsumerKey('');
        setMpin('');
        setTotp('');
        setShowConfigForm(false);
        await loadAccountsAndProfile();
      } else {
        setError(res.message || 'Connection failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Connection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async (accId: number) => {
    if (!window.confirm('Disconnect this broker account? Active market streams and live execution will pause.')) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.disconnectBroker(accId);
      setSuccessMsg(res.message || 'Account disconnected.');
      await loadAccountsAndProfile();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReconnect = (acc: BrokerAccount) => {
    setReconnectModalAcc(acc);
    setReconnectTotp('');
    setError(null);
  };

  const handleExecuteReconnect = async () => {
    if (!reconnectModalAcc) return;
    if (reconnectModalAcc.broker === 'KOTAK_NEO' && (!reconnectTotp || reconnectTotp.trim().length !== 6)) {
      setError('Please provide your current 6-digit TOTP code.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await api.reconnectBroker(reconnectModalAcc.id, reconnectTotp.trim());
      if (res.success) {
        setSuccessMsg(res.message || 'Reconnected successfully!');
        setReconnectModalAcc(null);
        setReconnectTotp('');
        await loadAccountsAndProfile();
      } else {
        setError(res.message || 'Reconnection failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Reconnection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const connectedAccounts = accounts.filter((a) => a.is_connected || a.status === 'CONNECTED');
  const hasConnected = connectedAccounts.length > 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Broker Settings
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Connect and manage API credentials for live market feed and automated execution.
          </p>
        </div>

        <button
          onClick={loadAccountsAndProfile}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors shadow-2xs self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Security note */}
      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span>
          Broker tokens, MPINs, and API credentials are encrypted at rest with AES-256-GCM. Raw credentials are never transmitted in logs.
        </span>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold text-red-500 ml-2">×</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold text-emerald-600 ml-2">×</button>
        </div>
      )}

      {/* SUPER ADMIN VIEW: BROKER CONFIGURED VIA .ENV */}
      {isSuperAdmin && (
        <div className="bg-white border-2 border-emerald-400/90 rounded-2xl p-5 shadow-xs relative overflow-hidden space-y-4">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-blue-600 to-emerald-600" />
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center font-black text-red-700 text-base shadow-2xs">
                KN
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900 font-sans">
                    Kotak Neo Live Gateway
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Connected via .env
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  SuperAdmin credentials securely configured in server environment (<code className="text-blue-700 font-mono font-bold">.env</code>). Automated order execution and streaming quotes active.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadAccountsAndProfile}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Verify Session</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100 text-xs">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Configuration</span>
              <span className="text-xs font-bold text-gray-900 font-mono block mt-0.5">Server .env Managed</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Execution Gateway</span>
              <span className="text-xs font-bold text-blue-700 font-mono block mt-0.5">Kotak Trade API v2</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Security Status</span>
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-0.5 font-mono">
                <Lock className="w-3 h-3 text-emerald-600" />
                <span>AES-256 Encrypted</span>
              </span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Available Margin</span>
                <span className="text-xs font-bold font-mono text-emerald-700 block mt-0.5">
                  ₹{profile ? profile.available_margin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRefreshMargin}
                disabled={refreshingMargin}
                className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors"
                title="Refresh Margin from Broker API"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingMargin ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CASE 1: CONNECTED BROKER SHOWCASED IN CARD VIEW (Non-superadmin or user linked accounts) */}
      {!isSuperAdmin && hasConnected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span>Connected Broker</span>
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                ● Live Link Active
              </span>
            </h2>
            <button
              onClick={() => setShowConfigForm(!showConfigForm)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              {showConfigForm ? (
                <>
                  <span>Hide Form</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Update / Add Broker</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {connectedAccounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-white border-2 border-emerald-400/80 rounded-xl p-5 shadow-xs relative overflow-hidden"
              >
                {/* Kotak accent top line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 to-blue-700" />

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left: Brand & Identification */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center font-bold text-red-700 text-sm">
                        KN
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900">
                            {acc.broker === 'KOTAK_NEO' ? 'Kotak Neo' : acc.broker}
                          </h3>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Connected
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 font-medium">
                          {acc.account_name || 'Primary Trading Gateway'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenReconnect(acc)}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors"
                      title="Refresh session token with TOTP"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh Session</span>
                    </button>
                    <button
                      onClick={() => handleDisconnect(acc.id)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* Account Details & Status Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
                  <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                    <span className="text-[10px] uppercase font-semibold text-gray-400 block">Client Code (UCC)</span>
                    <span className="text-xs font-bold font-mono text-gray-900 block mt-0.5">
                      {acc.masked_identifier || 'VERIFIED'}
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                    <span className="text-[10px] uppercase font-semibold text-gray-400 block">Gateway</span>
                    <span className="text-xs font-bold text-gray-900 block mt-0.5">
                      Kotak Trade API v2
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                    <span className="text-[10px] uppercase font-semibold text-gray-400 block">Session Security</span>
                    <span className="text-xs font-bold text-emerald-700 block mt-0.5 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span>AES-256 Valid</span>
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                    <span className="text-[10px] uppercase font-semibold text-gray-400 block">Last Verified</span>
                    <span className="text-xs font-mono text-gray-700 block mt-0.5">
                      {acc.last_authenticated_at
                        ? new Date(acc.last_authenticated_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Active Today'}
                    </span>
                  </div>
                </div>

                {/* Profile Margins & Real API Balances */}
                {(() => {
                  const availMargin = profile?.available_margin ?? acc.session_metadata?.available_margin ?? 0;
                  const usedMargin = profile?.used_margin ?? acc.session_metadata?.used_margin ?? 0;
                  const collateralVal = profile?.collateral ?? acc.session_metadata?.collateral ?? 0;
                  const cashVal = profile?.cash ?? acc.session_metadata?.cash ?? 0;

                  return (
                    <div className="mt-3 p-3 rounded-lg bg-emerald-50/70 border border-emerald-100/90 text-xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-emerald-600" />
                          <span className="font-semibold text-gray-700">Available Trading Margin:</span>
                          <span className="font-bold font-mono text-emerald-800 text-sm">
                            ₹{availMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold font-sans text-[10px]">
                            Kotak Neo API Active
                          </span>
                          <button
                            type="button"
                            onClick={handleRefreshMargin}
                            disabled={refreshingMargin}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-gray-50 border border-emerald-200 text-emerald-700 font-semibold text-[11px] transition-colors shadow-2xs"
                            title="Fetch latest margin balance directly from Kotak Neo API"
                          >
                            <RefreshCw className={`w-3 h-3 ${refreshingMargin ? 'animate-spin text-emerald-600' : ''}`} />
                            <span>{refreshingMargin ? 'Syncing...' : 'Refresh Margin'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-emerald-200/50 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-gray-600">
                        <span>Used Margin: <strong className="text-gray-900 font-bold">₹{usedMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                        {collateralVal > 0 && (
                          <span>Collateral: <strong className="text-gray-900 font-bold">₹{collateralVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                        )}
                        {cashVal > 0 && (
                          <span>Cash: <strong className="text-gray-900 font-bold">₹{cashVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                        )}
                        {acc.session_metadata?.last_margin_sync && (
                          <span className="text-[10px] text-gray-400 ml-auto">
                            Synced: {new Date(acc.session_metadata.last_margin_sync).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disconnected Accounts (if any) */}
      {accounts.filter((a) => !a.is_connected && a.status !== 'CONNECTED').length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Previously Linked Accounts
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {accounts
              .filter((a) => !a.is_connected && a.status !== 'CONNECTED')
              .map((acc) => (
                <div
                  key={acc.id}
                  className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-800">
                        {acc.broker === 'KOTAK_NEO' ? 'Kotak Neo' : acc.broker}
                      </span>
                      <p className="text-[11px] text-gray-500 font-mono">{acc.masked_identifier}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      Disconnected
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenReconnect(acc)}
                    disabled={actionLoading}
                    className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reconnect Session</span>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* CASE 2: INPUT AREA FOR API TOKENS / RECONFIGURE FORM (Only for non-superadmin users) */}
      {!isSuperAdmin && (!hasConnected || showConfigForm) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>{hasConnected ? 'Update Broker Credentials' : 'Connect Broker API'}</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {hasConnected
                  ? 'Re-enter API credentials or link a secondary trading account.'
                  : 'Enter your Kotak Neo API keys & credentials to start algorithmic trading.'}
              </p>
            </div>
            {hasConnected && (
              <button
                type="button"
                onClick={() => setShowConfigForm(false)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Broker Selector Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setSelectedBroker('KOTAK_NEO')}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                selectedBroker === 'KOTAK_NEO'
                  ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold">Kotak Neo</span>
                {selectedBroker === 'KOTAK_NEO' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </div>
              <span className="text-[10px] text-blue-700 font-medium">Direct Live API</span>
            </button>

            <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 opacity-60 cursor-not-allowed">
              <span className="text-xs font-medium block">Upstox</span>
              <span className="text-[10px]">Coming Soon</span>
            </div>

            <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 opacity-60 cursor-not-allowed">
              <span className="text-xs font-medium block">FYERS</span>
              <span className="text-[10px]">Coming Soon</span>
            </div>
          </div>

          {/* Connection Form */}
          <form onSubmit={handleConnect} className="space-y-4 pt-1">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Account Label / Name
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Primary Kotak Account"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Consumer Key / API Key
                </label>
                <div className="relative">
                  <Key className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={consumerKey}
                    onChange={(e) => setConsumerKey(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter Kotak Neo API Consumer Key"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Registered Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="9876543210"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Client Code (UCC)
                  </label>
                  <div className="relative">
                    <UserIcon className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={ucc}
                      onChange={(e) => setUcc(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g. W6BCV"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Trading MPIN
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      maxLength={6}
                      value={mpin}
                      onChange={(e) => setMpin(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-900 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="••••••"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Current TOTP (6-Digit Authenticator)
                  </label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      maxLength={6}
                      value={totp}
                      onChange={(e) => setTotp(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-900 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="123456"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 px-4 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Authenticating with Kotak Neo API...</span>
                  </>
                ) : (
                  <span>Connect Kotak Neo Account</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reconnect Modal */}
      {reconnectModalAcc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 font-sans">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Reconnect Kotak Neo
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Account: <span className="font-mono font-bold text-gray-800">{reconnectModalAcc.masked_identifier}</span>
                </p>
              </div>
              <button
                onClick={() => setReconnectModalAcc(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Enter your current 6-digit TOTP code from your authenticator app to refresh session.
            </p>

            <div>
              <input
                type="text"
                maxLength={6}
                value={reconnectTotp}
                onChange={(e) => setReconnectTotp(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-center text-lg text-gray-900 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="123456"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setReconnectModalAcc(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReconnect}
                disabled={actionLoading || reconnectTotp.trim().length !== 6}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs"
              >
                {actionLoading ? 'Connecting...' : 'Reconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
