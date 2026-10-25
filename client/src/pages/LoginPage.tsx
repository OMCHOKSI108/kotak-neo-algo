import React, { useState } from 'react';
import { api } from '../api';
import { User } from '../types';
import {
  Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff,
  ShieldCheck, Loader2
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resp = await api.login(email.trim(), password);
      localStorage.setItem('token', resp.access_token);
      localStorage.setItem('user', JSON.stringify(resp.user));
      onLoginSuccess(resp.user, resp.access_token);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillAdmin = () => {
    setEmail('omchoksi99@gmail.com');
    setPassword('OMchoksi');
    setError(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] text-white font-sans flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-[#ED1C24] selection:text-white">
      {/* Kotak Neo Dark Theme Ambient Glow & Flowing Curve */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top-center ambient red glow */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#ED1C24]/15 rounded-full blur-3xl pointer-events-none" />
        {/* Bottom subtle indigo accent glow */}
        <div className="absolute -bottom-40 right-1/4 w-[500px] h-[300px] bg-[#161385]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Ambient SVG curved wave lines */}
        <svg
          className="absolute inset-0 w-full h-full opacity-20"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          viewBox="0 0 1440 900"
        >
          <path
            d="M -100 200 C 300 100 600 400 1100 250 C 1300 190 1500 280 1600 320"
            stroke="#ED1C24"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M -100 450 C 400 350 800 600 1200 400 C 1400 300 1550 420 1600 480"
            stroke="#ED1C24"
            strokeWidth="0.8"
            strokeDasharray="4 6"
            fill="none"
          />
        </svg>
      </div>

      {/* Centered Login Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-[#121318]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80">
          {/* Kotak Neo Brand Header */}
          <div className="text-center space-y-3">
            <div className="flex justify-center items-center">
              <img
                src="/Kotak_Neo_Website_dark_mode.svg"
                alt="Kotak Neo"
                className="h-10 sm:h-11 w-auto object-contain select-none"
                loading="eager"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Algo Trading Terminal
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                Enter your credentials to access your trading workspace
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-5 p-3 rounded-xl bg-red-950/80 border border-red-500/50 flex items-start space-x-2.5 text-red-200 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-300">
                Email Address / User ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#181A20] border border-gray-700/80 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ED1C24] focus:ring-1 focus:ring-[#ED1C24] transition-all"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-gray-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleFillAdmin}
                  className="text-[11px] font-medium text-[#0084FF] hover:text-[#339DFF] hover:underline cursor-pointer transition-colors"
                >
                  Fill Admin
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 bg-[#181A20] border border-gray-700/80 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ED1C24] focus:ring-1 focus:ring-[#ED1C24] transition-all font-mono"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-200 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-gray-400" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-[#ED1C24] hover:bg-[#D4171E] active:scale-[0.99] transition-all shadow-lg shadow-red-950/40 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Security footnote */}
          <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-center space-x-2 text-[11px] text-gray-500 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>256-bit AES-GCM Encrypted · Kotak Trade API</span>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-gray-500 mt-4 font-mono">
          © 2026 Kotak Neo Algo Platform · Production Terminal
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
