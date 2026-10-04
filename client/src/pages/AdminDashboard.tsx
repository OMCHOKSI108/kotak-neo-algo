import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { AdminUserItem, AuditLogItem } from '../types';
import {
  ShieldCheck, UserPlus, CheckCircle, XCircle, Trash2,
  Lock, RefreshCw, Key, ShieldAlert, History, Radio
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New user form modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');

  const loadData = async () => {
    setLoading(true);
    try {
      const [uList, logs] = await Promise.all([
        api.getAdminUsers(),
        api.getAuditLogs().catch(() => []),
      ]);
      setUsers(uList);
      setAuditLogs(logs);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      await api.createAdminUser({
        email: newEmail,
        password: newPassword,
        full_name: newFullName,
        role: newRole,
      });
      setSuccessMsg(`User ${newEmail} created successfully!`);
      setShowAddModal(false);
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'User creation failed');
    }
  };

  const handleToggleStatus = async (userId: number, currentStatus: boolean) => {
    try {
      await api.updateUserStatus(userId, !currentStatus);
      await loadData();
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
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-[#151922] border border-[#232936] rounded-xl p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            <span>Platform Administration & User RBAC</span>
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Manage user accounts, view connected broker statuses, and review system audit records.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="p-2.5 rounded-lg bg-[#0B0E14] border border-[#232936] text-gray-400 hover:text-white"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-colors uppercase tracking-wider"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* Security Banner: Zero plain secrets guarantee */}
      <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs text-purple-300 flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 text-purple-400 mt-0.5" />
        <div>
          <span className="font-bold">Strict Credential Masking Policy Active:</span>
          <p className="text-gray-300 mt-0.5">
            In compliance with security specifications, all consumer secrets, access tokens, TOTP keys, and MPINs are
            strictly masked or omitted in all administrative UI representations. Sensitive credentials remain encrypted at rest.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {successMsg}
        </div>
      )}

      {/* Users & Connected Broker Accounts Table */}
      <div className="bg-[#151922] border border-[#232936] rounded-xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-[#232936]">
          <h3 className="text-base font-bold text-white">Registered Users & Broker Linkages</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#232936] text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-[#10141D]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Connected Broker Accounts</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232936] font-mono text-xs">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#1D2330]">
                  <td className="py-3.5 px-4 font-bold text-white">
                    <p className="font-sans text-sm">{u.full_name}</p>
                    <p className="text-gray-400 text-[11px] font-mono">{u.email}</p>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        u.role === 'admin'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                        u.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {u.is_active ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      <span>{u.is_active ? 'ACTIVE' : 'DISABLED'}</span>
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-gray-300">
                    {u.broker_accounts && u.broker_accounts.length > 0 ? (
                      <div className="space-y-1.5">
                        {u.broker_accounts.map((ba) => (
                          <div
                            key={ba.id}
                            className="p-2 rounded bg-[#0B0E14] border border-[#232936] text-[11px] flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center space-x-1.5">
                              <Radio
                                className={`w-2.5 h-2.5 ${ba.is_connected ? 'text-emerald-400' : 'text-gray-500'}`}
                              />
                              <span className="font-bold text-white">
                                {ba.broker_name === 'kotak_neo' || ba.broker === 'KOTAK_NEO' ? 'Kotak Neo' : 'Mock'}:
                              </span>
                              <span className="text-gray-400 font-mono">{ba.masked_identifier}</span>
                              <span className={`text-[9px] px-1 py-0.5 rounded font-semibold ${
                                ba.is_connected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-800 text-gray-500'
                              }`}>
                                {ba.is_connected ? 'CONNECTED' : 'DISCONNECTED'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-500 hidden sm:inline">
                                {ba.last_heartbeat_at ? new Date(ba.last_heartbeat_at).toLocaleTimeString() : 'Never'}
                              </span>
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
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                                >
                                  Disconnect
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">None connected</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-gray-400">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>

                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleToggleStatus(u.id, u.is_active)}
                      className={`px-2.5 py-1 rounded text-xs border ${
                        u.is_active
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                      }`}
                    >
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>

                    <button
                      onClick={() => handleDeleteUser(u.id, u.email)}
                      className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors inline-flex items-center"
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
      <div className="bg-[#151922] border border-[#232936] rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#232936] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <History className="w-4 h-4 text-blue-400" />
            <span>Audit Trail & Security Log</span>
          </h3>
          <span className="text-xs font-mono text-gray-400">{auditLogs.length} Records</span>
        </div>

        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#232936] text-[10px] text-gray-400 uppercase bg-[#10141D]">
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">User ID</th>
                <th className="py-2 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232936]/60">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#1D2330]">
                  <td className="py-2 px-3 text-gray-400">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 font-bold text-blue-400">{log.action}</td>
                  <td className="py-2 px-3 text-gray-300">{log.user_id ?? 'System'}</td>
                  <td className="py-2 px-3 text-gray-400 truncate max-w-xs">
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#151922] border border-[#232936] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Create New Platform User</h3>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="user@trading.in"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
                  Temporary Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="••••••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-mono">
                  System Role
                </label>
                <select
                  value={newRole}
                  onChange={(e: any) => setNewRole(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#232936] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="user">User (Algo Trader)</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white border border-[#232936]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors uppercase tracking-wider"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
