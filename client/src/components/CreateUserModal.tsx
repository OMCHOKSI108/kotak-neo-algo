import React, { useState } from 'react';
import { api } from '../api';
import { AdminUserItem } from '../types';
import { X, UserPlus, Mail, Lock, User, Shield, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated?: (user: AdminUserItem) => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onUserCreated,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInfo, setCreatedInfo] = useState<{ email: string; name: string } | null>(null);

  if (!isOpen) return null;

  const handleResetAndClose = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('user');
    setError(null);
    setCreatedInfo(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password should be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newUser = await api.createAdminUser({
        full_name: fullName.trim(),
        email: email.trim(),
        password: password,
        role: role,
      });

      setCreatedInfo({ email: newUser.email, name: newUser.full_name });
      if (onUserCreated) {
        onUserCreated(newUser);
      }
      setFullName('');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to create user. Email may already exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Create New User Account</h3>
              <p className="text-xs text-gray-500">Provide login credentials for platform access</p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {createdInfo ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">Account Successfully Created!</h4>
                <p className="text-xs text-gray-600 mt-1">
                  User <span className="font-semibold text-gray-900">{createdInfo.email}</span> can now log in immediately using the password you set.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-left text-gray-700 space-y-1">
                <div><span className="font-semibold">User:</span> {createdInfo.name}</div>
                <div><span className="font-semibold">Email / Login ID:</span> {createdInfo.email}</div>
                <div className="text-gray-500 text-[11px] pt-1">
                  The password has been securely salted and encrypted in PostgreSQL.
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreatedInfo(null)}
                  className="flex-1 py-2 px-3 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Create Another User
                </button>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start space-x-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Karan Patel"
                    className="block w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Email / User ID */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Email Address / User ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@trading.local"
                    className="block w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Login Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Assign a secure password (min 6 chars)"
                    className="block w-full pl-9 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Account Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                      role === 'user'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="user"
                      checked={role === 'user'}
                      onChange={() => setRole('user')}
                      className="sr-only"
                    />
                    <User className="w-4 h-4 text-blue-600" />
                    <span>Trader / User</span>
                  </label>

                  <label
                    className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                      role === 'admin'
                        ? 'bg-purple-50 border-purple-500 text-purple-900 font-bold'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={role === 'admin'}
                      onChange={() => setRole('admin')}
                      className="sr-only"
                    />
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span>Administrator</span>
                  </label>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  {role === 'user'
                    ? 'Regular traders can connect their broker, view market feeds, and run backtests.'
                    : 'Administrators have full access to create/disable users and inspect platform broker audits.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{loading ? 'Creating...' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
