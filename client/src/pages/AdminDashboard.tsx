import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { AdminUserItem, AuditLogItem } from '../types';
import {
  ShieldCheck, UserPlus, CheckCircle, XCircle, Trash2,
  RefreshCw, ShieldAlert, History, Radio, Plus
} from 'lucide-react';
import { CreateUserModal } from '../components/CreateUserModal';

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New user form modal
  const [showAddModal, setShowAddModal] = useState(false);

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

  const handleUserCreated = (newUser: AdminUserItem) => {
    setSuccessMsg(`User ${newUser.email} created successfully! They can log in immediately.`);
    loadData();
    setTimeout(() => setSuccessMsg(null), 6000);
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
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            <span>Platform Administration & User Management</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Create user credentials, monitor active trader accounts, and inspect encrypted broker connections.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* Security Banner: Zero plain secrets guarantee */}
      <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 text-purple-600 mt-0.5" />
        <div>
          <span className="font-bold">Strict Credential Masking & Encryption Policy:</span>
          <p className="text-purple-800 mt-0.5">
            All user passwords are encrypted with salted bcrypt hashes. Broker consumer keys, tokens, and MPINs are encrypted at rest with AES-256-GCM. Sensitive secrets are never displayed in full, even to administrators.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          ✓ {successMsg}
        </div>
      )}

      {/* Users & Connected Broker Accounts Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Registered Platform Users</h3>
            <p className="text-xs text-gray-500">Users created by administrator who can log in to the platform</p>
          </div>
          <span className="text-xs font-mono font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {users.length} Total Users
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold">
              <tr>
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Connected Broker</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-gray-900">
                    <p className="text-sm text-gray-900">{u.full_name}</p>
                    <p className="text-gray-500 text-xs font-mono font-normal">{u.email}</p>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {u.role === 'admin' ? 'Administrator' : 'Trader'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                        u.is_active
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}
                    >
                      {u.is_active ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      <span>{u.is_active ? 'ACTIVE' : 'DISABLED'}</span>
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-gray-700">
                    {u.broker_accounts && u.broker_accounts.length > 0 ? (
                      <div className="space-y-1.5">
                        {u.broker_accounts.map((ba) => (
                          <div
                            key={ba.id}
                            className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center space-x-1.5">
                              <Radio
                                className={`w-2.5 h-2.5 ${ba.is_connected ? 'text-emerald-600' : 'text-gray-400'}`}
                              />
                              <span className="font-bold text-gray-900">
                                {ba.broker_name === 'kotak_neo' || ba.broker === 'KOTAK_NEO' ? 'Kotak Neo' : 'Mock'}:
                              </span>
                              <span className="text-gray-600 font-mono font-semibold">{ba.masked_identifier}</span>
                              <span className={`text-[10px] px-1 py-0.5 rounded font-semibold ${
                                ba.is_connected ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                              }`}>
                                {ba.is_connected ? 'CONNECTED' : 'DISCONNECTED'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
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
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                                >
                                  Disconnect
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-xs">No broker linked</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-gray-600 font-mono">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>

                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleToggleStatus(u.id, u.is_active)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
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
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
            <History className="w-4 h-4 text-blue-600" />
            <span>Audit Trail & Activity Log</span>
          </h3>
          <span className="text-xs font-mono text-gray-500">{auditLogs.length} Records</span>
        </div>

        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-sans font-bold">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">User ID</th>
                <th className="py-2.5 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-600">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 font-bold text-blue-700">{log.action}</td>
                  <td className="py-2 px-3 text-gray-800">{log.user_id ?? 'System'}</td>
                  <td className="py-2 px-3 text-gray-600 truncate max-w-xs">
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
    </div>
  );
};
