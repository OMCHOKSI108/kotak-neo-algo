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

  const connectedAccounts = accounts.filter((a) => a.is_connected || a.status === 'CONNECTED');

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header & Status Alert */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Server className="w-6 h-6 text-blue-400" />
              <span>Broker Connection & Accounts</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Secure multi-broker management powered by isolated backend adapters and authenticated AES-256-GCM encryption.
            </p>
          </div>
          <button
            onClick={loadAccountsAndProfile}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1D2330] hover:bg-[#252D3D] text-gray-300 border border-[#2B3547] transition-colors self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>

        {/* Global Security Notice Banner */}
        <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-white">Zero Raw Secret Exposure Guarantee</span>
            <p className="text-gray-300 text-[11px] leading-relaxed">
              React never connects directly to Kotak Neo or broker WebSockets. All credentials are encrypted at rest with
              authenticated 256-bit AES-GCM (<code className="font-mono text-blue-300">BROKER_ENCRYPTION_KEY</code>). API tokens, MPINs, and TOTPs
              are never logged, never saved in localStorage, and never sent back to the browser.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Operation Failed:</span> {error}
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>{successMsg}</div>
        </div>
      )}

      {/* Active Connected Accounts Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400" />
          <span>Configured Broker Accounts ({accounts.length})</span>
        </h2>

        {accounts.length === 0 ? (
          <div className="bg-[#151922] border border-[#232936] rounded-xl p-8 text-center text-gray-400">
            <p>No broker accounts linked yet. Use the form below to connect Kotak Neo or a Mock paper broker.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc) => {
              const isConn = acc.is_connected || acc.status === 'CONNECTED';
              return (
                <div
                  key={acc.id}
                  className={`bg-[#151922] border rounded-xl p-5 space-y-4 transition-all ${
                    isConn ? 'border-emerald-500/30' : 'border-[#232936] opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white">
                          {acc.broker === 'KOTAK_NEO' ? 'Kotak Neo' : acc.broker === 'MOCK_BROKER' ? 'Mock Broker' : acc.broker}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            isConn
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-gray-800 text-gray-400 border-gray-700'
                          }`}
                        >
                          {isConn ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{acc.account_name}</p>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-[#1D2330] border border-[#2B3547] flex items-center justify-center text-gray-400">
                      {acc.broker === 'KOTAK_NEO' ? (
                        <Smartphone className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Server className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                  </div>

                  {/* Sanitized details only */}
                  <div className="bg-[#0E1117] rounded-lg p-3 text-xs font-mono space-y-1.5 border border-[#1F2633]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account / UCC:</span>
                      <span className="text-gray-200 font-semibold">{acc.masked_identifier || '*****'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status:</span>
                      <span className={isConn ? 'text-emerald-400' : 'text-gray-400'}>{acc.status}</span>
                    </div>
                    {acc.last_authenticated_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Last Verified:</span>
                        <span className="text-gray-400">
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
                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenReconnect(acc)}
                        disabled={actionLoading}
                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition-colors flex items-center justify-center gap-1.5"
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
      <div className="bg-[#151922] border border-[#232936] rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-400" />
            <span>Connect Broker Account</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Choose your brokerage and authenticate. All credentials are encrypted in PostgreSQL at rest and never shared.
          </p>
        </div>

        {/* Broker Selector Tabs */}
        <div>
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Select Broker
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Kotak Neo */}
            <button
              type="button"
              onClick={() => setSelectedBroker('KOTAK_NEO')}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                selectedBroker === 'KOTAK_NEO'
                  ? 'bg-blue-600/15 border-blue-500 text-white'
                  : 'bg-[#1A202C] border-[#2A3447] text-gray-400 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-white">Kotak Neo</span>
                {selectedBroker === 'KOTAK_NEO' && <Check className="w-4 h-4 text-blue-400" />}
              </div>
              <span className="text-[10px] text-blue-400 font-mono">Production SDK 3.0</span>
            </button>

            {/* Mock Broker */}
            <button
              type="button"
              onClick={() => setSelectedBroker('MOCK_BROKER')}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                selectedBroker === 'MOCK_BROKER'
                  ? 'bg-blue-600/15 border-blue-500 text-white'
                  : 'bg-[#1A202C] border-[#2A3447] text-gray-400 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-white">Mock Broker</span>
                {selectedBroker === 'MOCK_BROKER' && <Check className="w-4 h-4 text-blue-400" />}
              </div>
              <span className="text-[10px] text-amber-400 font-mono">Paper Sandbox</span>
            </button>

            {/* Upstox (Coming soon) */}
            <div className="p-3 rounded-xl border border-[#232936] bg-[#121620] text-gray-500 opacity-60 cursor-not-allowed">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">Upstox</span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">Coming Soon</span>
            </div>

            {/* FYERS (Coming soon) */}
            <div className="p-3 rounded-xl border border-[#232936] bg-[#121620] text-gray-500 opacity-60 cursor-not-allowed">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">FYERS</span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">Coming Soon</span>
            </div>
          </div>
        </div>

        {/* Connection Form */}
        <form onSubmit={handleConnect} className="space-y-4 pt-2">
          {selectedBroker === 'KOTAK_NEO' ? (
            <div className="space-y-4">
              <div className="bg-[#121620] border border-[#202736] p-3 rounded-lg text-xs text-gray-400 flex items-center justify-between">
                <span>
                  Uses Kotak Neo 2-step TOTP login (<code className="text-blue-300">tradeApiLogin</code>) + MPIN validate (<code className="text-blue-300">tradeApiValidate</code>).
                </span>
                <a
                  href="https://github.com/Kotak-Neo/Kotak-Neo/blob/main/docs/getting-started.md"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                >
                  <span>Kotak Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Account Nickname
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full bg-[#0E1117] border border-[#2B3547] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g. My Primary Kotak Account"
                  required
                />
              </div>

              {/* Consumer Key */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Consumer Key / Default App Token
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={consumerKey}
                    onChange={(e) => setConsumerKey(e.target.value)}
                    className="w-full bg-[#0E1117] border border-[#2B3547] rounded-lg pl-9 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    placeholder="e.g. ec6a746c-e44b-455e-abf2-c13352b2fc45"
                    required
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Found in Neo App/Web → More → TradeAPI → API Dashboard</p>
              </div>

              {/* Mobile & UCC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Registered Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full bg-[#0E1117] border border-[#2B3547] rounded-lg pl-9 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                      placeholder="+919876543210"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Client Code (UCC)
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={ucc}
                      onChange={(e) => setUcc(e.target.value.toUpperCase())}
                      className="w-full bg-[#0E1117] border border-[#2B3547] rounded-lg pl-9 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                      placeholder="e.g. AB123"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* MPIN & TOTP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    6-digit Trading MPIN
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                    <input
                      type="password"
                      maxLength={6}
                      value={mpin}
                      onChange={(e) => setMpin(e.target.value)}
                      className="w-full bg-[#0E1117] border border-[#2B3547] rounded-lg pl-9 pr-3 py-2 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-blue-500"
                      placeholder="••••••"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">Same MPIN used in the Neo Mobile App</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center justify-between">
                    <span>Current 6-digit TOTP</span>
                    <span className="text-[10px] text-amber-400">Dynamic 30s code</span>
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      maxLength={6}
                      value={totp}
                      onChange={(e) => setTotp(e.target.value)}
                      className="w-full bg-[#0E1117] border border-[#2B3547] rounded-lg pl-9 pr-3 py-2 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-blue-500"
                      placeholder="123456"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">From Google Authenticator / Microsoft Authenticator</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0E1117] border border-[#1F2633] rounded-lg p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Sparkles className="w-5 h-5" />
                <span className="font-semibold text-sm">Safe Simulation Sandbox</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Connects a high-fidelity local paper simulator for NIFTY 50, BANKNIFTY, SENSEX, and top NSE stocks with
                instant tick streaming, realistic options pricing, and simulated order execution.
              </p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authenticating with Kotak Neo...</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#151922] border border-[#2B3547] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-400" />
                  <span>Reconnect Kotak Neo Session</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Account: <span className="font-mono text-gray-200">{reconnectModalAcc.masked_identifier}</span>
                </p>
              </div>
              <button
                onClick={() => setReconnectModalAcc(null)}
                className="text-gray-400 hover:text-white text-lg"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Your long-lived credentials remain safely encrypted at rest. To re-authorize today's session with Kotak Neo,
              please provide your current 6-digit TOTP code.
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Current 6-Digit TOTP Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={reconnectTotp}
                onChange={(e) => setReconnectTotp(e.target.value)}
                className="w-full bg-[#0E1117] border border-[#2B3547] rounded-lg px-3 py-2 text-center text-lg text-white font-mono tracking-widest focus:outline-none focus:border-blue-500"
                placeholder="123456"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReconnectModalAcc(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReconnect}
                disabled={actionLoading || reconnectTotp.trim().length !== 6}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white flex items-center gap-2"
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
