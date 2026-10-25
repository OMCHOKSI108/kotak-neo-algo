import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { AdminUserItem, AuditLogItem } from '../types';
import { CreateUserModal } from '../components/CreateUserModal';
import {
  Users, Shield, CheckCircle, XCircle, Trash2, KeyRound,
  RefreshCw, Radio, Lock, History, AlertCircle, Plus, Eye, EyeOff, X
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reset Password Modal
  const [resetUser, setResetUser] = useState<AdminUserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPass, setShowResetPass] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [uList, logs] = await Promise.all([
        api.getAdminUsers(),
        api.getAuditLogs().catch(() => []),
      ]);
      setUsers(uList);
      setAuditLogs(logs);
    } catch (err: any) {
      setError(err.message || 'Failed to load administrator data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUserCreated = (newUser: AdminUserItem) => {
    setUsers((prev) => [newUser, ...prev]);
    setSuccessMsg(`User ${newUser.email} created successfully.`);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleToggleStatus = async (userId: number, currentStatus: boolean) => {
    try {
      await api.updateUserStatus(userId, !currentStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: !currentStatus } : u))
      );
      setSuccessMsg(`User status updated.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: number, email: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete user ${email}?`)) return;
    try {
      await api.deleteUser(userId);
      setSuccessMsg(`User ${email} removed.`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setResetLoading(true);
    try {
      await api.resetUserPassword(resetUser.id, newPassword);
      setSuccessMsg(`Password for ${resetUser.email} has been reset successfully.`);
      setResetUser(null);
      setNewPassword('');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            User Management & System Audit
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Create and manage platform user credentials, role access, and audit broker sessions
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Security Note */}
      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 flex items-center space-x-2">
        <Lock className="w-4 h-4 text-gray-500 shrink-0" />
        <span>
          Passwords encrypted via salted bcrypt. Sensitive broker credentials & session tokens encrypted at rest with AES-256-GCM. Raw keys are never shown.
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* Users & Connected Broker Accounts Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Registered Platform Users</h2>
            <p className="text-xs text-gray-500">Users authorized to sign in to the algorithmic trading terminal</p>
          </div>
          <span className="text-xs font-mono font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {users.length} Users
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
              <tr>
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Account Status</th>
                <th className="py-2.5 px-4">Trading Mode</th>
                <th className="py-2.5 px-4">Active Algos</th>
                <th className="py-2.5 px-4">Linked Broker</th>
                <th className="py-2.5 px-4">Created</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-3 px-4 font-bold text-gray-900">
                    <p className="text-sm text-gray-900">{u.full_name}</p>
                    <p className="text-gray-500 text-xs font-mono font-normal">{u.email}</p>
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {u.role === 'admin' ? 'Admin' : 'Trader'}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {u.is_active ? <CheckCircle className="w-3 h-3 mr-0.5" /> : <XCircle className="w-3 h-3 mr-0.5" />}
                      <span>{u.is_active ? 'Active' : 'Disabled'}</span>
                    </span>
                  </td>

                  <td className="py-3 px-4 font-mono text-xs">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        u.trading_status === 'LIVE'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {u.trading_status || 'PAPER'}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-mono text-xs text-gray-700">
                    <span className="font-bold">{u.active_strategies_count ?? 0}</span> active
                  </td>

                  <td className="py-3 px-4 text-gray-700">
                    {u.broker_accounts && u.broker_accounts.length > 0 ? (
                      <div className="space-y-1">
                        {u.broker_accounts.map((ba) => (
                          <div
                            key={ba.id}
                            className="p-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center space-x-1.5">
                              <Radio
                                className={`w-2.5 h-2.5 ${ba.is_connected ? 'text-emerald-600' : 'text-gray-400'}`}
                              />
                              <span className="font-semibold text-gray-900">
                                {ba.broker_name === 'kotak_neo' || ba.broker === 'KOTAK_NEO' ? 'Kotak Neo' : ba.broker}:
                              </span>
                              <span className="text-gray-600 font-mono font-medium">{ba.masked_identifier}</span>
                            </div>

                            {ba.is_connected && (
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`Disconnect broker account ${ba.masked_identifier}?`)) return;
                                  try {
                                    await api.adminDisconnectBroker(ba.id);
                                    await loadData();
                                    setSuccessMsg(`Disconnected broker account ${ba.masked_identifier}`);
                                  } catch (err: any) {
                                    setError(err.message);
                                  }
                                }}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                              >
                                Disconnect
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">No broker linked</span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-gray-500 font-mono text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>

                  <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                    {/* Reset Password Button */}
                    <button
                      onClick={() => {
                        setResetUser(u);
                        setNewPassword('');
                      }}
                      className="p-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors inline-flex items-center"
                      title="Reset User Password"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleToggleStatus(u.id, u.is_active)}
                      className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                        u.is_active
                          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>

                    <button
                      onClick={() => handleDeleteUser(u.id, u.email)}
                      className="p-1 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors inline-flex items-center"
                      title="Delete User"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log Trail */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
            <History className="w-4 h-4 text-gray-500" />
            <span>Security & Activity Audit Log</span>
          </h2>
          <span className="text-xs font-mono text-gray-500">{auditLogs.length} Records</span>
        </div>

        <div className="overflow-x-auto max-h-60">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-sans font-semibold">
              <tr>
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">User ID</th>
                <th className="py-2 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/70">
                  <td className="py-2 px-3 text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 font-semibold text-blue-700">{log.action}</td>
                  <td className="py-2 px-3 text-gray-700">{log.user_id ?? 'System'}</td>
                  <td className="py-2 px-3 text-gray-500 truncate max-w-xs">
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reusable Create User Modal */}
      <CreateUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onUserCreated={handleUserCreated}
      />

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  Reset Password for {resetUser.email}
                </h3>
              </div>
              <button
                onClick={() => setResetUser(null)}
                className="p-1 hover:bg-gray-200 rounded-md text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-5 space-y-4 text-xs">
              <p className="text-gray-600">
                Enter a new password for <span className="font-semibold text-gray-900">{resetUser.full_name}</span>. The password will be hashed with salted bcrypt in PostgreSQL.
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showResetPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter min 6 character password"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPass(!showResetPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showResetPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setResetUser(null)}
                  className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-xs font-semibold text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                >
                  {resetLoading ? 'Resetting...' : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
