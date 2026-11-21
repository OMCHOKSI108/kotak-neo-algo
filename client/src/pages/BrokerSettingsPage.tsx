import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { BrokerStatusItem, User } from '../types';
import {
  ShieldCheck, RefreshCw, Key, Lock, Phone, User as UserIcon,
  CheckCircle2, AlertTriangle, Plus, Check, Clock, Wallet,
  Trash2, X, Cpu, Power, ShieldAlert
} from 'lucide-react';

interface BrokerSettingsPageProps {
  user?: User;
}

type SupportedBroker = 'KOTAK_NEO' | 'UPSTOX' | 'FYERS' | 'DHAN';

export const BrokerSettingsPage: React.FC<BrokerSettingsPageProps> = ({ user }) => {
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  const [brokers, setBrokers] = useState<BrokerStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Admin .env 2FA Authentication
  const [adminTotp, setAdminTotp] = useState('');
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [showAdminReauth, setShowAdminReauth] = useState(false);
  const [refreshingMargin, setRefreshingMargin] = useState(false);

  // Add Broker Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalBroker, setModalBroker] = useState<SupportedBroker>('KOTAK_NEO');
  const [modalAccountName, setModalAccountName] = useState('');
  const [modalConsumerKey, setModalConsumerKey] = useState('');
  const [modalMobileNumber, setModalMobileNumber] = useState('');
  const [modalUcc, setModalUcc] = useState('');
  const [modalMpin, setModalMpin] = useState('');
  const [modalTotp, setModalTotp] = useState('');
  const [modalEnvironment, setModalEnvironment] = useState('prod');
  const [modalClientId, setModalClientId] = useState('');
  const [modalSecretKey, setModalSecretKey] = useState('');
  const [modalAccessToken, setModalAccessToken] = useState('');

  // Reconnect Modal State
  const [reconnectItem, setReconnectItem] = useState<BrokerStatusItem | null>(null);
  const [reconnectTotp, setReconnectTotp] = useState('');

  // Fetch status on page mount
  const loadBrokersStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBrokersStatus();
      setBrokers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch broker session status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrokersStatus();
  }, []);

  // Handle .env Admin 2FA authorization
  const handleAdminTotpConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTotp = adminTotp.trim();
    if (!cleanTotp || cleanTotp.length !== 6 || !/^\d{6}$/.test(cleanTotp)) {
      setError('Please enter a valid 6-digit TOTP code from your authenticator app.');
      return;
    }

    setAdminAuthLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.authenticateEnvBroker(cleanTotp);
      if (res.success) {
        setSuccessMsg(res.message || 'Kotak Neo session authenticated successfully!');
        setAdminTotp('');
        setShowAdminReauth(false);
        await loadBrokersStatus();
      } else {
        setError(res.message || 'Authentication failed. Please verify your TOTP.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setAdminAuthLoading(false);
    }
  };

  // Quick refresh margin & probe broker API
  const handleRefreshMargin = async () => {
    setRefreshingMargin(true);
    setError(null);
    try {
      await api.getBrokerProfile();
      await loadBrokersStatus();
      setSuccessMsg('Live available margin updated directly from broker gateway.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError('Margin refresh failed: ' + (err.message || 'Network error'));
    } finally {
      setRefreshingMargin(false);
    }
  };

  // Submit Add Broker Modal Form
  const handleAddBrokerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let payload: any = {
        broker: modalBroker,
        account_name: modalAccountName.trim() || `${modalBroker} Account`,
      };

      if (modalBroker === 'KOTAK_NEO') {
        if (!modalConsumerKey || !modalMobileNumber || !modalUcc || !modalMpin || !modalTotp) {
          setError('Please provide Consumer Key, Mobile, UCC, MPIN, and 6-digit TOTP.');
          setActionLoading(false);
          return;
        }
        if (modalTotp.trim().length !== 6 || !/^\d{6}$/.test(modalTotp.trim())) {
          setError('TOTP must be a 6-digit numeric code.');
          setActionLoading(false);
          return;
        }
        payload = {
          ...payload,
          consumer_key: modalConsumerKey.trim(),
          mobile_number: modalMobileNumber.trim(),
          ucc: modalUcc.trim().toUpperCase(),
          mpin: modalMpin.trim(),
          totp: modalTotp.trim(),
          environment: modalEnvironment,
        };
      } else if (modalBroker === 'UPSTOX' || modalBroker === 'FYERS') {
        if (!modalClientId || !modalSecretKey) {
          setError(`Please provide ${modalBroker} Client ID and Secret Key.`);
          setActionLoading(false);
          return;
        }
        payload = {
          ...payload,
          consumer_key: modalClientId.trim(),
          mpin: modalSecretKey.trim(),
          totp: modalAccessToken.trim() || undefined,
        };
      } else if (modalBroker === 'DHAN') {
        if (!modalClientId || !modalAccessToken) {
          setError('Please provide Dhan Client ID and Access Token.');
          setActionLoading(false);
          return;
        }
        payload = {
          ...payload,
          consumer_key: modalClientId.trim(),
          totp: modalAccessToken.trim(),
        };
      }

      const res = await api.connectBroker(payload);
      if (res.success) {
        setSuccessMsg(res.message || `${modalBroker} linked successfully!`);
        setShowAddModal(false);
        // Reset form
        setModalAccountName('');
        setModalConsumerKey('');
        setModalMobileNumber('');
        setModalUcc('');
        setModalMpin('');
        setModalTotp('');
        setModalClientId('');
        setModalSecretKey('');
        setModalAccessToken('');
        await loadBrokersStatus();
      } else {
        setError(res.message || 'Failed to connect broker account.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect broker.');
    } finally {
      setActionLoading(false);
    }
  };

  // Activate secondary broker as primary execution broker
  const handleActivateBroker = async (brokerId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.activateBrokerAccount(brokerId);
      setSuccessMsg(res.message || 'Broker activated as primary execution gateway.');
      await loadBrokersStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to activate broker.');
    } finally {
      setActionLoading(false);
    }
  };

  // Disconnect broker account
  const handleDisconnectBroker = async (brokerId: string) => {
    if (!window.confirm('Disconnect this broker account? Live execution on this account will stop.')) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.disconnectBroker(brokerId);
      setSuccessMsg(res.message || 'Broker account disconnected.');
      await loadBrokersStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect broker.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete broker account
  const handleDeleteBroker = async (brokerId: string) => {
    if (!window.confirm('Permanently remove this broker account and stored credentials?')) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.deleteBrokerAccount(brokerId);
      setSuccessMsg(res.message || 'Broker account deleted.');
      await loadBrokersStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to delete broker account.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reconnect secondary broker
  const handleExecuteReconnect = async () => {
    if (!reconnectItem) return;
    if (reconnectItem.brokerType === 'kotak_neo' && (!reconnectTotp || reconnectTotp.trim().length !== 6)) {
      setError('Please provide a valid 6-digit TOTP code.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await api.reconnectBroker(reconnectItem.id, reconnectTotp.trim());
      if (res.success) {
        setSuccessMsg(res.message || 'Session reconnected successfully!');
        setReconnectItem(null);
        setReconnectTotp('');
        await loadBrokersStatus();
      } else {
        setError(res.message || 'Reconnection failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Reconnection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Identify .env Admin broker vs secondary DB brokers
  const envAdminBroker = brokers.find((b) => b.source === 'ENV');
  const secondaryBrokers = brokers.filter((b) => b.source !== 'ENV');

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Broker Settings
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage multi-broker API credentials, session life-cycles, and automated execution routing.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadBrokersStatus}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors shadow-2xs cursor-pointer"
            title="Refresh Broker Session Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Broker</span>
          </button>
        </div>
      </div>

      {/* Security Banner */}
      <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 flex items-center space-x-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span>
          Bank-grade encryption: Credentials, MPINs, and API tokens are encrypted with authenticated <strong>AES-256-GCM</strong>. Server-side credentials are never transmitted to frontend clients.
        </span>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold text-red-500 ml-2 hover:text-red-700">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold text-emerald-600 ml-2 hover:text-emerald-800">✕</button>
        </div>
      )}

      {/* SECTION 1: PRIMARY SERVER .ENV ADMIN BROKER CARD */}
      {isSuperAdmin && envAdminBroker && (
        <div className="bg-white border-2 border-emerald-500/80 rounded-2xl p-5 shadow-xs relative overflow-hidden space-y-4">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-blue-600 to-emerald-600" />

          {/* Title Row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center font-black text-red-700 text-base shadow-2xs">
                KN
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900">
                    Kotak Neo Live Gateway
                  </h3>
                  {envAdminBroker.authState === 'ACTIVE' ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      SESSION ACTIVE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 font-mono">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      2FA REQUIRED (SESSION EXPIRED)
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md font-semibold">
                    Primary SuperAdmin
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  {envAdminBroker.authState === 'ACTIVE'
                    ? `Live broker session is authenticated and operational. Valid until 06:00 AM IST.`
                    : 'Daily 2FA session expired at 06:00 AM IST. Enter your 6-digit TOTP code below to authorize today’s session.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadBrokersStatus}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors shadow-2xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Verify Session</span>
              </button>
            </div>
          </div>

          {/* Metrics Grid */}
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
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Session Expiry</span>
              <span className="text-xs font-bold text-gray-800 font-mono block mt-0.5">
                {envAdminBroker.authState === 'ACTIVE' ? '06:00 AM IST Daily' : 'Expired'}
              </span>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Available Margin</span>
                <span className="text-xs font-bold font-mono text-emerald-700 block mt-0.5">
                  ₹{envAdminBroker.availableMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRefreshMargin}
                disabled={refreshingMargin}
                className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer"
                title="Refresh Margin from Kotak Neo Gateway"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingMargin ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* CONDITIONAL 2FA TOTP BAR:
              If ACTIVE: TOTP input is HIDDEN. Only shows Session Active confirmation + subtle Re-authenticate button.
              If EXPIRED or ERROR: SHOWS inline 6-digit TOTP input + Authorize 2FA button. */}
          {envAdminBroker.authState !== 'ACTIVE' || showAdminReauth ? (
            <form onSubmit={handleAdminTotpConnect} className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Key className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold text-amber-950 block">Daily 2FA Authentication Required</span>
                  <span className="text-[11px] text-amber-800 block">
                    All credentials loaded from server .env. Enter today’s 6-digit TOTP code to activate live trading.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  maxLength={6}
                  value={adminTotp}
                  onChange={(e) => setAdminTotp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit TOTP"
                  autoFocus
                  className="w-32 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono font-bold tracking-widest text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={adminAuthLoading || adminTotp.length !== 6}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shadow-2xs whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                >
                  {adminAuthLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>Authorize 2FA</span>
                </button>
                {showAdminReauth && (
                  <button
                    type="button"
                    onClick={() => setShowAdminReauth(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-1"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-emerald-950 block">Session Authenticated for Today</span>
                  <span className="text-[11px] text-emerald-700 block">
                    Market feed and automated orders active. Session valid until tomorrow 06:00 AM IST.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAdminReauth(true)}
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline shrink-0 cursor-pointer"
              >
                Re-authenticate / Refresh 2FA
              </button>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: SECONDARY & USER BROKER ACCOUNTS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span>Configured Broker Accounts</span>
              <span className="text-xs font-mono font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {secondaryBrokers.length + (envAdminBroker ? 1 : 0)} Total
              </span>
            </h2>
            <p className="text-xs text-gray-500">
              Link additional execution accounts or alternate broker gateways.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Another Broker</span>
          </button>
        </div>

        {secondaryBrokers.length === 0 && !envAdminBroker ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">No Broker Accounts Connected</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Connect your Kotak Neo, Upstox, FYERS, or Dhan account to initiate automated trading.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Connect First Broker</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {secondaryBrokers.map((b) => (
              <div
                key={b.id}
                className="bg-white border border-gray-200 hover:border-gray-300 rounded-xl p-4 shadow-2xs transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-gray-700 text-xs">
                      {b.brokerType === 'kotak_neo' ? 'KN' : b.brokerType.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-gray-900">{b.label}</h4>
                        {b.authState === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            EXPIRED
                          </span>
                        )}
                        {b.isPrimary && (
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            Active Execution Broker
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-mono">
                        {b.maskedIdentifier || 'N/A'} • {b.source === 'ENV' ? 'Server .env' : 'Encrypted DB'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!b.isPrimary && (
                      <button
                        onClick={() => handleActivateBroker(b.id)}
                        disabled={actionLoading}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors cursor-pointer"
                        title="Route live trades through this account"
                      >
                        Set as Active Execution Broker
                      </button>
                    )}

                    {b.authState !== 'ACTIVE' && (
                      <button
                        onClick={() => {
                          setReconnectItem(b);
                          setReconnectTotp('');
                        }}
                        disabled={actionLoading}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Re-authenticate</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDisconnectBroker(b.id)}
                      disabled={actionLoading}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      Disconnect
                    </button>

                    <button
                      onClick={() => handleDeleteBroker(b.id)}
                      disabled={actionLoading}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Remove Broker"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sub details: Margin & status */}
                <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-3.5 h-3.5 text-gray-400" />
                    <span>Available Margin:</span>
                    <strong className="font-mono text-gray-900 font-bold">
                      ₹{b.availableMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                  {b.expiresAt && (
                    <span className="text-[11px] text-gray-400 font-mono">
                      Session valid until: {new Date(b.expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 3: ADD BROKER MODAL / DRAWER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 font-sans">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Connect New Broker API
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select your broker and enter credentials. Stored encrypted with AES-256-GCM.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Broker Selector Tabs */}
            <div className="grid grid-cols-4 gap-2">
              {(['KOTAK_NEO', 'UPSTOX', 'FYERS', 'DHAN'] as SupportedBroker[]).map((brk) => (
                <button
                  key={brk}
                  type="button"
                  onClick={() => setModalBroker(brk)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    modalBroker === brk
                      ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-2xs'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xs block font-bold">
                    {brk === 'KOTAK_NEO' ? 'Kotak' : brk}
                  </span>
                  <span className="text-[10px] text-gray-400 font-normal">
                    {brk === 'KOTAK_NEO' ? 'Live API' : 'OAuth / Key'}
                  </span>
                </button>
              ))}
            </div>

            {/* Dynamic Form per Selected Broker */}
            <form onSubmit={handleAddBrokerSubmit} className="space-y-3.5 pt-1 text-xs">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Account Label
                </label>
                <input
                  type="text"
                  value={modalAccountName}
                  onChange={(e) => setModalAccountName(e.target.value)}
                  placeholder={`My ${modalBroker} Account`}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Kotak Neo Fields */}
              {modalBroker === 'KOTAK_NEO' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Consumer Key (API Key)
                    </label>
                    <input
                      type="password"
                      value={modalConsumerKey}
                      onChange={(e) => setModalConsumerKey(e.target.value)}
                      placeholder="Kotak Neo API Consumer Key"
                      required
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Registered Mobile
                      </label>
                      <input
                        type="text"
                        value={modalMobileNumber}
                        onChange={(e) => setModalMobileNumber(e.target.value)}
                        placeholder="+919876543210"
                        required
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Client Code (UCC)
                      </label>
                      <input
                        type="text"
                        value={modalUcc}
                        onChange={(e) => setModalUcc(e.target.value.toUpperCase())}
                        placeholder="e.g. W6BCV"
                        required
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Trading MPIN
                      </label>
                      <input
                        type="password"
                        maxLength={6}
                        value={modalMpin}
                        onChange={(e) => setModalMpin(e.target.value)}
                        placeholder="••••••"
                        required
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Current 6-Digit TOTP
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={modalTotp}
                        onChange={(e) => setModalTotp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        required
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Upstox / FYERS Fields */}
              {(modalBroker === 'UPSTOX' || modalBroker === 'FYERS') && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {modalBroker === 'UPSTOX' ? 'API Key / Client ID' : 'App ID / Client ID'}
                    </label>
                    <input
                      type="text"
                      value={modalClientId}
                      onChange={(e) => setModalClientId(e.target.value)}
                      placeholder={`Enter ${modalBroker} Client ID`}
                      required
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      API Secret Key
                    </label>
                    <input
                      type="password"
                      value={modalSecretKey}
                      onChange={(e) => setModalSecretKey(e.target.value)}
                      placeholder={`Enter ${modalBroker} Secret Key`}
                      required
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Access Token / Auth Code (Optional)
                    </label>
                    <input
                      type="password"
                      value={modalAccessToken}
                      onChange={(e) => setModalAccessToken(e.target.value)}
                      placeholder="OAuth token if pre-generated"
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Dhan Fields */}
              {modalBroker === 'DHAN' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Dhan Client ID
                    </label>
                    <input
                      type="text"
                      value={modalClientId}
                      onChange={(e) => setModalClientId(e.target.value)}
                      placeholder="e.g. 1000000001"
                      required
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Dhan Access Token
                    </label>
                    <input
                      type="password"
                      value={modalAccessToken}
                      onChange={(e) => setModalAccessToken(e.target.value)}
                      placeholder="Enter 24-hr access token from Dhan web"
                      required
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>Save & Authenticate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECTION 4: RECONNECT MODAL FOR SECONDARY BROKERS */}
      {reconnectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 font-sans">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Re-authenticate {reconnectItem.label}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Identifier: <span className="font-mono font-bold text-gray-800">{reconnectItem.maskedIdentifier}</span>
                </p>
              </div>
              <button
                onClick={() => setReconnectItem(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Enter your current 6-digit TOTP code from your authenticator app to restore active session.
            </p>

            <input
              type="text"
              maxLength={6}
              value={reconnectTotp}
              onChange={(e) => setReconnectTotp(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-center text-lg text-gray-900 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="123456"
              autoFocus
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReconnectItem(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReconnect}
                disabled={actionLoading || reconnectTotp.trim().length !== 6}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-2xs cursor-pointer"
              >
                {actionLoading ? 'Connecting...' : 'Authorize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
