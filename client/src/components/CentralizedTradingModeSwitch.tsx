import React, { useState } from 'react';
import { api } from '../api';
import { ShieldCheck, Zap, AlertTriangle, X, Check, Loader2 } from 'lucide-react';

interface CentralizedTradingModeSwitchProps {
  currentMode: 'PAPER' | 'LIVE';
  onModeChange: (newMode: 'PAPER' | 'LIVE') => void;
  brokerConnected: boolean;
}

export const CentralizedTradingModeSwitch: React.FC<CentralizedTradingModeSwitchProps> = ({
  currentMode,
  onModeChange,
  brokerConnected,
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleClick = (targetMode: 'PAPER' | 'LIVE') => {
    if (targetMode === currentMode) return;

    if (targetMode === 'LIVE') {
      // Show confirmation dialog before engaging live execution
      setAcknowledgedRisk(false);
      setError(null);
      setShowConfirmModal(true);
    } else {
      // Switching back to paper mode is safe and immediate
      switchMode('PAPER');
    }
  };

  const switchMode = async (targetMode: 'PAPER' | 'LIVE') => {
    setLoading(true);
    setError(null);
    try {
      await api.updateTraderSettings({
        trading_mode: targetMode,
        live_trading_enabled: targetMode === 'LIVE',
      });
      onModeChange(targetMode);
      localStorage.setItem('trading_mode', targetMode);
      setShowConfirmModal(false);
    } catch (err: any) {
      setError(err.message || `Failed to switch to ${targetMode} mode`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Centralized Switch Segmented Pill */}
      <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200/80 shadow-2xs font-mono text-[11px]">
        {/* Paper Mode Option */}
        <button
          type="button"
          onClick={() => handleToggleClick('PAPER')}
          disabled={loading}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-md font-bold transition-all ${
            currentMode === 'PAPER'
              ? 'bg-white text-blue-700 shadow-xs border border-gray-200/60'
              : 'text-gray-500 hover:text-gray-900'
          }`}
          title="Switch to Safe Virtual Paper Trading Simulation"
        >
          <ShieldCheck className={`w-3.5 h-3.5 ${currentMode === 'PAPER' ? 'text-blue-600' : 'text-gray-400'}`} />
          <span>PAPER</span>
        </button>

        {/* Live Real Trading Option */}
        <button
          type="button"
          onClick={() => handleToggleClick('LIVE')}
          disabled={loading}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-md font-bold transition-all relative ${
            currentMode === 'LIVE'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-gray-500 hover:text-red-600'
          }`}
          title="Switch to Real Broker Live Execution (Real Capital)"
        >
          {currentMode === 'LIVE' && (
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          )}
          <Zap className={`w-3.5 h-3.5 ${currentMode === 'LIVE' ? 'text-white' : 'text-gray-400'}`} />
          <span>LIVE REAL</span>
        </button>
      </div>

      {/* Safety Confirmation Modal for Switching to LIVE */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden relative">
            {/* Top Warning Strip */}
            <div className="h-1.5 w-full bg-red-600" />

            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Switch to LIVE Trading Mode?
                    </h3>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      Execution Gateway: Kotak Neo Broker
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={loading}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-red-50 border border-red-200/80 rounded-xl p-3.5 text-xs text-red-900 space-y-2">
                <p className="font-semibold">
                  ⚠️ Caution: Real Capital Execution
                </p>
                <p className="text-red-700 leading-relaxed">
                  You are engaging <strong>LIVE TRADING</strong> mode. All subsequent orders placed from the <strong>Option Chain</strong> (inline Buy/Sell tickets), <strong>Trader ticket</strong>, and <strong>Automated Algo strategies</strong> will be routed directly to Kotak Neo with real money.
                </p>
                {!brokerConnected && (
                  <p className="font-bold text-amber-800 bg-amber-100/70 p-2 rounded-lg border border-amber-200 mt-2">
                    Notice: Kotak Neo live session is configured via server .env. Ensure your daily 2FA/TOTP token is active.
                  </p>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-100 border border-red-200 rounded-lg text-xs font-semibold text-red-800">
                  {error}
                </div>
              )}

              {/* Explicit Risk Acknowledgement Checkbox */}
              <label className="flex items-start space-x-2.5 cursor-pointer text-xs text-gray-700 select-none pt-1">
                <input
                  type="checkbox"
                  checked={acknowledgedRisk}
                  onChange={(e) => setAcknowledgedRisk(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-red-600 focus:ring-red-500 border-gray-300"
                />
                <span>
                  I understand that orders placed in LIVE mode execute real market trades with financial capital.
                </span>
              </label>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Stay in Paper Mode
                </button>

                <button
                  type="button"
                  onClick={() => switchMode('LIVE')}
                  disabled={!acknowledgedRisk || loading}
                  className={`flex-1 flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
                    acknowledgedRisk && !loading
                      ? 'bg-red-600 hover:bg-red-700 cursor-pointer shadow-red-500/20'
                      : 'bg-red-300 cursor-not-allowed'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Engaging Live...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Engage LIVE Trading</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
