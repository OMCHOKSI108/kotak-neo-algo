import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { BrokerAccount, BrokerProfile } from '../types';
import {
  ShieldCheck, Radio, RefreshCw, Key, Lock, Phone, User as UserIcon,
  CheckCircle2, AlertTriangle, Plus, Server, Check, Clock,
  ExternalLink, Sparkles, Smartphone
} from 'lucide-react';

export const BrokerSettingsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    if (!window.confirm('Disconnect this broker account? Active market streams will stop.')) return;
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Broker Accounts
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Connect and manage broker API connections for live market data and trading.
          </p>
        </div>

        <button
          onClick={loadAccountsAndProfile}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors shadow-xs self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Security note */}
      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span>
          Broker tokens, MPINs, and API credentials are encrypted at rest with AES-256-GCM.
        </span>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Connected Accounts Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-900">
          Connected Accounts ({accounts.length})
        </h2>

        {accounts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 shadow-xs text-xs">
            <p>No broker account linked. Use the form below to connect your Kotak Neo account.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc) => {
              const isConn = acc.is_connected || acc.status === 'CONNECTED';
              return (
                <div
                  key={acc.id}
                  className={`bg-white border rounded-xl p-4 space-y-3 shadow-xs transition-all ${
                    isConn ? 'border-emerald-300' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">
                          {acc.broker === 'KOTAK_NEO' ? 'Kotak Neo' : acc.broker}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                            isConn
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          {isConn ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{acc.account_name}</p>
                    </div>

                    <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500">
                      {acc.broker === 'KOTAK_NEO' ? (
                        <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <Server className="w-3.5 h-3.5 text-amber-600" />
                      )}
                    </div>
                  </div>

                  {/* Sanitized details */}
                  <div className="bg-gray-50 rounded-lg p-2.5 text-xs font-mono space-y-1 border border-gray-100">
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-sans">UCC:</span>
                      <span className="text-gray-900 font-bold">{acc.masked_identifier || '*****'}</span>
                    </div>
                    {acc.last_authenticated_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-sans">Verified:</span>
                        <span className="text-gray-600">
                          {new Date(acc.last_authenticated_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-1">
                    {isConn ? (
                      <button
                        onClick={() => handleDisconnect(acc.id)}
                        disabled={actionLoading}
                        className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenReconnect(acc)}
                        disabled={actionLoading}
                        className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors flex items-center justify-center gap-1.5"
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
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" />
            <span>Link a Broker</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Select your broker to authenticate and enable live feeds.
          </p>
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
            <span className="text-[10px] text-blue-700 font-medium">Live Broker</span>
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
                  Account Name
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
                  Consumer Key
                </label>
                <div className="relative">
                  <Key className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={consumerKey}
                    onChange={(e) => setConsumerKey(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="API Consumer Key"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Mobile Number
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
                      placeholder="W6BCV"
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
                    Current TOTP (6 Digits)
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
              className="w-full py-2 px-4 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Authenticating with Kotak Neo...</span>
                </>
              ) : (
                <span>Connect Kotak Neo</span>
              )}
            </button>
          </div>
        </form>
      </div>

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
              Enter your current 6-digit TOTP code to re-authenticate with Kotak Neo.
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
