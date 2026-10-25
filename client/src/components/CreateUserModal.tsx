import React, { useState } from 'react';
import { api } from '../api';
import { AdminUserItem } from '../types';
import {
  X, UserPlus, Mail, Lock, User, Shield, CheckCircle, AlertCircle,
  Eye, EyeOff, KeyRound, Smartphone, Hash, Radio
} from 'lucide-react';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated?: (user: AdminUserItem) => void;
  onSuccess?: (user: AdminUserItem) => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onUserCreated,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInfo, setCreatedInfo] = useState<{ email: string; name: string } | null>(null);

  // Optional Flow A Broker Configuration
  const [configureBroker, setConfigureBroker] = useState(false);
  const [consumerKey, setConsumerKey] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [ucc, setUcc] = useState('');
  const [mpin, setMpin] = useState('');
  const [totp, setTotp] = useState('');

  if (!isOpen) return null;

  const handleResetAndClose = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('user');
    setConfigureBroker(false);
    setConsumerKey('');
    setMobileNumber('');
    setUcc('');
    setMpin('');
    setTotp('');
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

    if (configureBroker) {
      if (!consumerKey.trim() || !mobileNumber.trim() || !ucc.trim() || !mpin.trim()) {
        setError('Please provide Consumer Key, Mobile Number, UCC, and MPIN for Kotak Neo configuration.');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        full_name: fullName.trim(),
        email: email.trim(),
        password: password,
        role: role,
        configure_broker: configureBroker,
      };

      if (configureBroker) {
        payload.broker = 'KOTAK_NEO';
        payload.consumer_key = consumerKey.trim();
        payload.mobile_number = mobileNumber.trim();
        payload.ucc = ucc.trim().toUpperCase();
        payload.mpin = mpin.trim();
        if (totp.trim()) {
          payload.totp = totp.trim();
        }
      }

      const newUser = await api.createAdminUser(payload);

      setCreatedInfo({ email: newUser.email, name: newUser.full_name });
      if (onUserCreated) {
        onUserCreated(newUser);
      }
      if (onSuccess) {
        onSuccess(newUser);
      }
      setFullName('');
      setEmail('');
      setPassword('');
      setConfigureBroker(false);
      setConsumerKey('');
      setMobileNumber('');
      setUcc('');
      setMpin('');
      setTotp('');
    } catch (err: any) {
      setError(err.message || 'Failed to create user. Email may already exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fade-in font-sans">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-lg w-full overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Create New User Account</h3>
              <p className="text-xs text-gray-500">Provide login credentials and optional broker setup</p>
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
        <div className="p-6 overflow-y-auto">
          {createdInfo ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">Account Successfully Created!</h4>
                <p className="text-xs text-gray-600 mt-1">
                  User <span className="font-semibold text-gray-900">{createdInfo.email}</span> can now log in immediately.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-left text-gray-700 space-y-1">
                <div><span className="font-semibold">User:</span> {createdInfo.name}</div>
                <div><span className="font-semibold">Email / Login ID:</span> {createdInfo.email}</div>
                <div className="text-gray-500 text-[11px] pt-1">
                  Passwords and broker credentials are encrypted with salted bcrypt & AES-256-GCM at rest.
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
                  className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-2xs"
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
                    placeholder="e.g. Om Choksi"
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
                    placeholder="omchoksi99@gmail.com"
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
              </div>

              {/* Flow A: Optional Kotak Neo Provisioning */}
              <div className="pt-2 border-t border-gray-100">
                <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg bg-gray-50 hover:bg-gray-100/80 transition-colors">
                  <input
                    type="checkbox"
                    checked={configureBroker}
                    onChange={(e) => setConfigureBroker(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="text-left">
                    <span className="text-xs font-bold text-gray-900 block">
                      Configure Kotak Neo Broker Account (Flow A)
                    </span>
                    <span className="text-[11px] text-gray-500 block">
                      Admin provisions encrypted broker credentials directly for this trader
                    </span>
                  </div>
                </label>

                {configureBroker && (
                  <div className="mt-3 p-3.5 bg-blue-50/40 border border-blue-100 rounded-xl space-y-3 animate-fade-in text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Consumer Key / App Token <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={consumerKey}
                        onChange={(e) => setConsumerKey(e.target.value)}
                        placeholder="Default Application Token"
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          Mobile Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value)}
                          placeholder="10-digit mobile"
                          className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          Client Code (UCC) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={ucc}
                          onChange={(e) => setUcc(e.target.value)}
                          placeholder="e.g. Y7635"
                          className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono uppercase focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          MPIN <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          maxLength={6}
                          value={mpin}
                          onChange={(e) => setMpin(e.target.value)}
                          placeholder="6-digit MPIN"
                          className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          TOTP (Optional Login)
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={totp}
                          onChange={(e) => setTotp(e.target.value)}
                          placeholder="6-digit TOTP"
                          className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-gray-500">
                      Credentials will be encrypted with AES-256-GCM. The trader can also self-connect later (Flow B).
                    </p>
                  </div>
                )}
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
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-2xs"
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
