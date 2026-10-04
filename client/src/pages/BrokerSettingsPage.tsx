import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { BrokerAccount, BrokerProfile } from '../types';
import {
  ShieldCheck, Radio, RefreshCw, Key, Lock, Phone, User as UserIcon,
  CheckCircle2, XCircle, AlertTriangle, Plus, Server, Check, Clock,
  ExternalLink, ShieldAlert, Sparkles, Smartphone
} from 'lucide-react';

export const BrokerSettingsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Broker selection
  const [selectedBroker, setSelectedBroker] = useState<'KOTAK_NEO' | 'MOCK_BROKER' | 'UPSTOX' | 'FYERS'>('KOTAK_NEO');

  // Connection form state
  const [accountName, setAccountName] = useState('My Kotak Trading Account');
  const [consumerKey, setConsumerKey] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [ucc, setUcc] = useState('');
  const [mpin, setMpin] = useState('');
  const [totp, setTotp] = useState('');
  const [environment, setEnvironment] = useState('prod');

  // Reconnect modal state
  const [reconnectModalAcc, setReconnectModalAcc] = useState<BrokerAccount | null>(null);
  const [reconnectTotp, setReconnectTotp] = useState('');

  const loadAccountsAndProfile = async () => {
    setLoading(true);
    try {
      const [accs, prof] = await Promise.all([
        api.getBrokerAccounts(),
        api.getBrokerProfile().catch(() => null),
      ]);
      setAccounts(accs);
      if (prof) setProfile(prof);
    } catch (err: any) {
      setError(err.message || 'Failed to load broker data');
    } finally {
      setLoading(false);
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
          setError('All fields are required: Consumer Key, Mobile, UCC, MPIN, and 6-digit TOTP.');
          setActionLoading(false);
          return;
        }

        if (totp.trim().length !== 6 || !/^\d{6}$/.test(totp.trim())) {
          setError('TOTP must be a valid 6-digit numeric code from Google Authenticator / 2FA.');
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
        setSuccessMsg(res.message || `Successfully connected to ${selectedBroker}!`);
        // Immediately clear sensitive plaintext credentials from memory/form
        setConsumerKey('');
        setMpin('');
        setTotp('');
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
    if (!window.confirm('Disconnect this broker account? Active market streaming and sessions will be closed.')) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.disconnectBroker(accId);
      setSuccessMsg(res.message || 'Broker account disconnected successfully.');
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
      setError('A fresh 6-digit TOTP is required to re-authenticate with Kotak Neo.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await api.reconnectBroker(reconnectModalAcc.id, reconnectTotp.trim());
      if (res.success) {
        setSuccessMsg(res.message || 'Broker reconnected successfully!');
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans">
      {/* Header & Status Alert */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              <span>Broker Accounts & Connection</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Secure multi-broker management powered by isolated backend adapters and AES-256-GCM authenticated encryption.
            </p>
          </div>
          <button
            onClick={loadAccountsAndProfile}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors self-start sm:self-auto shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>

        {/* Global Security Notice Banner */}
        <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-gray-900">Zero Raw Secret Exposure Policy</span>
            <p className="text-blue-950 text-[11px] leading-relaxed">
              React never connects directly to Kotak Neo or third-party broker endpoints. All credentials are encrypted at rest with
              authenticated 256-bit AES-GCM (<code className="font-mono text-blue-800">BROKER_ENCRYPTION_KEY</code>). API tokens, MPINs, and TOTPs
              are never logged, never stored in localStorage, and never sent back to the browser.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>{successMsg}</div>
        </div>
      )}

      {/* Active Connected Accounts Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-600" />
          <span>Configured Broker Accounts ({accounts.length})</span>
        </h2>

        {accounts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 shadow-sm text-xs">
            <p>No broker accounts linked yet. Use the form below to connect Kotak Neo or the Mock sandbox broker.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc) => {
              const isConn = acc.is_connected || acc.status === 'CONNECTED';
              return (
                <div
                  key={acc.id}
                  className={`bg-white border rounded-xl p-5 space-y-4 shadow-sm transition-all ${
                    isConn ? 'border-emerald-300' : 'border-gray-200 opacity-90'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-gray-900">
                          {acc.broker === 'KOTAK_NEO' ? 'Kotak Neo' : acc.broker === 'MOCK_BROKER' ? 'Mock Broker' : acc.broker}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isConn
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          {isConn ? 'CONNECTED' : 'DISCONNECTED'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{acc.account_name}</p>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500">
                      {acc.broker === 'KOTAK_NEO' ? (
                        <Smartphone className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Server className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                  </div>

                  {/* Sanitized details only */}
                  <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono space-y-1.5 border border-gray-200">
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-sans">Account / UCC:</span>
                      <span className="text-gray-900 font-bold">{acc.masked_identifier || '*****'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-sans">Status:</span>
                      <span className={isConn ? 'text-emerald-700 font-bold' : 'text-gray-600'}>{acc.status}</span>
                    </div>
                    {acc.last_authenticated_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-sans">Last Verified:</span>
                        <span className="text-gray-700">
                          {new Date(acc.last_authenticated_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    {isConn ? (
                      <button
                        onClick={() => handleDisconnect(acc.id)}
                        disabled={actionLoading}
                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenReconnect(acc)}
                        disabled={actionLoading}
                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reconnect</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect New Broker Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" />
            <span>Connect Broker Account</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Choose your brokerage and authenticate. All credentials are encrypted in PostgreSQL at rest and never shared.
          </p>
        </div>

        {/* Broker Selector Tabs */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Select Broker
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Kotak Neo */}
            <button
              type="button"
              onClick={() => setSelectedBroker('KOTAK_NEO')}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                selectedBroker === 'KOTAK_NEO'
                  ? 'bg-blue-50 border-blue-600 text-blue-900'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-gray-900">Kotak Neo</span>
                {selectedBroker === 'KOTAK_NEO' && <Check className="w-4 h-4 text-blue-600" />}
              </div>
              <span className="text-[10px] text-blue-700 font-mono font-semibold">Production SDK 3.0</span>
            </button>

            {/* Mock Broker */}
            <button
              type="button"
              onClick={() => setSelectedBroker('MOCK_BROKER')}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                selectedBroker === 'MOCK_BROKER'
                  ? 'bg-blue-50 border-blue-600 text-blue-900'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-gray-900">Mock Broker</span>
                {selectedBroker === 'MOCK_BROKER' && <Check className="w-4 h-4 text-blue-600" />}
              </div>
              <span className="text-[10px] text-amber-700 font-mono font-semibold">Paper Sandbox</span>
            </button>

            {/* Upstox */}
            <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 opacity-60 cursor-not-allowed">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">Upstox</span>
              </div>
              <span className="text-[10px] font-mono">Coming Soon</span>
            </div>

            {/* FYERS */}
            <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 opacity-60 cursor-not-allowed">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">FYERS</span>
              </div>
              <span className="text-[10px] font-mono">Coming Soon</span>
            </div>
          </div>
        </div>

        {/* Connection Form */}
        <form onSubmit={handleConnect} className="space-y-4 pt-2">
          {selectedBroker === 'KOTAK_NEO' ? (
            <div className="space-y-4">
              <div className="bg-blue-50/50 border border-blue-200 p-3 rounded-lg text-xs text-blue-900 flex items-center justify-between">
                <span>
                  Uses Kotak Neo 2-step TOTP login (<code className="text-blue-800 font-bold">tradeApiLogin</code>) + MPIN validate (<code className="text-blue-800 font-bold">tradeApiValidate</code>).
                </span>
                <a
                  href="https://github.com/Kotak-Neo/Kotak-Neo/blob/main/docs/getting-started.md"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:underline flex items-center gap-1 font-mono text-[11px] font-bold"
                >
                  <span>Kotak Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Account Nickname
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. My Primary Kotak Account"
                  required
                />
              </div>

              {/* Consumer Key */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Consumer Key / Default App Token
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={consumerKey}
                    onChange={(e) => setConsumerKey(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. ec6a746c-e44b-455e-abf2-c13352b2fc45"
                    required
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Found in Neo App/Web → More → TradeAPI → API Dashboard</p>
              </div>

              {/* Mobile & UCC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Registered Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="+919876543210"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Client Code (UCC)
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={ucc}
                      onChange={(e) => setUcc(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g. AB123"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* MPIN & TOTP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    6-digit Trading MPIN
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
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
                  <p className="text-[11px] text-gray-500 mt-1">Same MPIN used in the Neo Mobile App</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                    <span>Current 6-digit TOTP</span>
                    <span className="text-[10px] text-amber-700 font-semibold">Dynamic 30s code</span>
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
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
                  <p className="text-[11px] text-gray-500 mt-1">From Google Authenticator / Microsoft Authenticator</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-5 space-y-2">
              <div className="flex items-center gap-2 text-amber-800">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <span className="font-bold text-sm">Safe Simulation Sandbox</span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Connects a high-fidelity local paper simulator for NIFTY 50, BANKNIFTY, SENSEX, and top NSE stocks with
                instant tick streaming, realistic options pricing, and simulated order execution.
              </p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authenticating with Broker...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {selectedBroker === 'KOTAK_NEO' ? 'Connect / Login to Kotak Neo' : 'Connect Mock Paper Broker'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Reconnect Modal */}
      {reconnectModalAcc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-sans">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                  <span>Reconnect Kotak Neo Session</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Account: <span className="font-mono font-bold text-gray-800">{reconnectModalAcc.masked_identifier}</span>
                </p>
              </div>
              <button
                onClick={() => setReconnectModalAcc(null)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Your long-lived credentials remain safely encrypted at rest. To re-authorize today's session with Kotak Neo,
              please provide your current 6-digit TOTP code.
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Current 6-Digit TOTP Code
              </label>
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

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReconnectModalAcc(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReconnect}
                disabled={actionLoading || reconnectTotp.trim().length !== 6}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center gap-1.5 shadow-sm"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Verify & Reconnect</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
