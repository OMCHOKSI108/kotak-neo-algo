import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { BrokerAccount, BrokerProfile } from '../types';
import {
  ShieldCheck, Radio, RefreshCw, Key, Lock, Phone, User as UserIcon,
  CheckCircle2, XCircle, AlertTriangle, Plus, Server, Check, Clock
} from 'lucide-react';

export const BrokerSettingsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [selectedBroker, setSelectedBroker] = useState<'mock_broker' | 'kotak_neo'>('mock_broker');
  const [accountName, setAccountName] = useState('My Trading Account');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [ucc, setUcc] = useState('');
  const [mpin, setMpin] = useState('');
  const [totpSecret, setTotpSecret] = useState('');

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
    setLoading(true);

    try {
      const payload: any = {
        broker_name: selectedBroker,
        account_name: accountName,
      };

      if (selectedBroker === 'kotak_neo') {
        payload.consumer_key = consumerKey;
        payload.consumer_secret = consumerSecret;
        payload.mobile_number = mobileNumber;
        payload.ucc = ucc;
        payload.mpin = mpin;
        payload.totp_secret = totpSecret;
      }

      const res = await api.connectBroker(payload);
      setSuccessMsg(`Successfully connected to ${selectedBroker === 'kotak_neo' ? 'Kotak Neo' : 'Mock Paper Broker'}!`);
      // Clear sensitive form fields
      setConsumerKey('');
      setConsumerSecret('');
      setMpin('');
      setTotpSecret('');
      await loadAccountsAndProfile();
    } catch (err: any) {
      setError(err.message || 'Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (accId: number) => {
    if (!window.confirm('Are you sure you want to disconnect this broker account?')) return;
    try {
      await api.disconnectBroker(accId);
      await loadAccountsAndProfile();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleHeartbeat = async (accId: number) => {
    try {
      await api.checkHeartbeat(accId);
      await loadAccountsAndProfile();
      setSuccessMsg('Heartbeat check successful!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Funds Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-[#151922] border border-[#232936] rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                <Server className="w-5 h-5 text-blue-400" />
                <span>Broker Connection Management</span>
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Unified broker adapter layer. Connect simulated paper trading or configure official Kotak Neo Trade API V2.
              </p>
            </div>
            <button
              onClick={loadAccountsAndProfile}
              className="p-2 rounded-lg bg-[#0B0E14] border border-[#232936] text-gray-400 hover:text-white"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-5 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-400 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-300">Defense-in-Depth Credential Security</p>
              <p className="text-gray-300 mt-0.5">
                All consumer keys, MPINs, and TOTP secrets are encrypted at rest with Fernet (AES-128-CBC) in PostgreSQL.
                Plain secrets are never logged and never transmitted back to the UI.
              </p>
            </div>
          </div>
        </div>

        {/* Profile / Funds Card */}
        <div className="bg-[#151922] border border-[#232936] rounded-xl p-6 shadow-lg">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">
            Active Broker Account
          </h3>
          <p className="text-lg font-bold text-white mt-1">{profile?.client_name || 'No Active Account'}</p>
          <div className="mt-4 space-y-2 font-mono text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#232936]">
              <span className="text-gray-400">Client ID / UCC:</span>
              <span className="text-white font-bold">{profile?.client_id || '--'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#232936]">
              <span className="text-gray-400">Available Margin:</span>
              <span className="text-emerald-400 font-bold">
                ₹{profile?.available_margin ? profile.available_margin.toLocaleString('en-IN') : '0.00'}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-400">Used Margin:</span>
              <span className="text-amber-400 font-bold">
                ₹{profile?.used_margin ? profile.used_margin.toLocaleString('en-IN') : '0.00'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center space-x-3">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Connected Accounts Table */}
      <div className="bg-[#151922] border border-[#232936] rounded-xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-[#232936]">
          <h3 className="text-base font-bold text-white">Configured Broker Accounts</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#232936] text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-[#10141D]">
                <th className="py-3 px-4">Broker</th>
                <th className="py-3 px-4">Account Label</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Masked Identifier</th>
                <th className="py-3 px-4">Last Sync</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232936] font-mono text-xs">
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    No broker accounts connected. Connect one below.
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-[#1D2330]">
                    <td className="py-3.5 px-4 font-bold text-white">
                      <span className="capitalize">{acc.broker_name.replace('_', ' ')}</span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-300">{acc.account_name}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-semibold ${
                          acc.is_connected
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        <Radio className="w-3 h-3" />
                        <span>{acc.is_connected ? 'CONNECTED' : 'DISCONNECTED'}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-300">{acc.masked_identifier}</td>
                    <td className="py-3.5 px-4 text-gray-400">
                      {acc.last_heartbeat_at ? new Date(acc.last_heartbeat_at).toLocaleTimeString() : 'Never'}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleHeartbeat(acc.id)}
                        className="px-2.5 py-1 rounded bg-[#0B0E14] text-gray-300 hover:text-white border border-[#232936]"
                        title="Ping Broker Adapter"
                      >
                        Sync
                      </button>
                      {acc.is_connected && (
                        <button
                          onClick={() => handleDisconnect(acc.id)}
                          className="px-2.5 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                        >
                          Disconnect
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Connect Broker Form */}
      <div className="bg-[#151922] border border-[#232936] rounded-xl p-6 shadow-xl">
        <h3 className="text-base font-bold text-white mb-4">Connect New Broker Integration</h3>

        {/* Adapter Switcher */}
        <div className="flex space-x-4 mb-6">
          <button
            type="button"
            onClick={() => setSelectedBroker('mock_broker')}
            className={`flex-1 p-4 rounded-xl border text-left transition-all ${
              selectedBroker === 'mock_broker'
                ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500'
                : 'bg-[#0B0E14] border-[#232936] hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">Simulated Paper Broker</span>
              {selectedBroker === 'mock_broker' && <Check className="w-5 h-5 text-blue-400" />}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Zero-risk simulation with realistic NIFTY/BANKNIFTY/SENSEX prices, option chains, and paper order execution.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedBroker('kotak_neo')}
            className={`flex-1 p-4 rounded-xl border text-left transition-all ${
              selectedBroker === 'kotak_neo'
                ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500'
                : 'bg-[#0B0E14] border-[#232936] hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">Kotak Neo Trade API (V2)</span>
              {selectedBroker === 'kotak_neo' && <Check className="w-5 h-5 text-blue-400" />}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Official Trade API with TOTP 2FA, dynamic baseUrl, and modern SFeed native_batch WebSocket.
            </p>
          </button>
        </div>

        <form onSubmit={handleConnect} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
                Account Label
              </label>
              <input
                type="text"
                required
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="e.g. Algo Main Account"
              />
            </div>

            {selectedBroker === 'kotak_neo' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
                    Consumer Key (Plain Token)
                  </label>
                  <input
                    type="password"
                    required
                    value={consumerKey}
                    onChange={(e) => setConsumerKey(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="From Neo App -> TradeAPI Card"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
                    Registered Mobile Number
                  </label>
                  <input
                    type="text"
                    required
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="+919876543210"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
                    Unique Client Code (UCC)
                  </label>
                  <input
                    type="text"
                    required
                    value={ucc}
                    onChange={(e) => setUcc(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="e.g. ABC87"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
                    6-Digit MPIN
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={mpin}
                    onChange={(e) => setMpin(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="••••••"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
                    TOTP Secret (Optional for Auto-2FA)
                  </label>
                  <input
                    type="password"
                    value={totpSecret}
                    onChange={(e) => setTotpSecret(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="Base32 TOTP secret string"
                  />
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Connecting...' : selectedBroker === 'kotak_neo' ? 'Save & Connect Kotak Neo' : 'Connect Simulated Paper Broker'}
          </button>
        </form>
      </div>
    </div>
  );
};
