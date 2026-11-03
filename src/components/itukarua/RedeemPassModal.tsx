import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, KeyRound, Loader2, X } from 'lucide-react';
import { getTopRatedPass, type TopRatedPassResult } from '@/lib/database';
import { downloadPassToken, formatPassExpiry, saveStoredPass, type StoredPass } from '@/lib/contactPass';

interface RedeemPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRedeemed: (pass: StoredPass) => void;
}

const REASON_MESSAGES: Record<string, string> = {
  invalid: 'That token is not valid. Check the code and try again.',
  expired: 'That day pass has expired. Buy a new one to unlock contacts again.',
  rate_limited: 'Too many attempts. Wait a minute and try again.',
  device_limit: 'This day pass is already in use on 3 devices. Use it on one of those, or buy a new pass.',
};

const RedeemPassModal: React.FC<RedeemPassModalProps> = ({ isOpen, onClose, onRedeemed }) => {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<(TopRatedPassResult & { pass: StoredPass }) | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setToken('');
      setBusy(false);
      setError('');
      setResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRedeem = async () => {
    const clean = token.trim().toUpperCase();
    if (!clean) { setError('Enter the token from your purchase.'); return; }
    setBusy(true);
    setError('');
    try {
      const outcome = await getTopRatedPass(clean);
      if (!outcome) { setError('Could not check that token. Try again.'); return; }
      if (!outcome.allowed) {
        setError(REASON_MESSAGES[outcome.reason || 'invalid'] || REASON_MESSAGES.invalid);
        return;
      }
      const stored = saveStoredPass(clean, outcome.expiresAt ?? null);
      setResult({ ...outcome, pass: stored });
      onRedeemed(stored);
    } catch {
      setError('Could not check that token. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const covered = result?.profiles?.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">I have a day pass</h2>
            <p className="text-xs text-gray-500 mt-0.5">Paste the token you received after paying.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {result ? (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-semibold">Day pass active</p>
                <p className="text-xs text-green-700 mt-1">
                  {covered} top-rated worker{covered === 1 ? '' : 's'} unlocked until {formatPassExpiry(result.pass)}.
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Open any worker in the Top Rated list. Your pass stays saved in this browser,
              so you do not need to enter the token again today.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => downloadPassToken(result.pass)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 hover:border-green-600 hover:text-green-700 text-sm font-semibold rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" /> Download token
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                View workers
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <label htmlFor="day-pass-token" className="block text-xs font-medium text-gray-600">
              Day pass token
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="day-pass-token"
                value={token}
                onChange={e => { setToken(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && !busy) handleRedeem(); }}
                placeholder="ITK-XXXXXXXXXXXX"
                autoComplete="off"
                spellCheck={false}
                className="w-full pl-9 pr-3 py-2.5 text-sm font-mono border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="flex items-start gap-2 text-xs text-red-600">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </p>
            )}

            <button
              onClick={handleRedeem}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking token…</> : 'Redeem day pass'}
            </button>

            <p className="text-[11px] text-gray-400">
              The token unlocks contact details for the top-rated workers as they were when
              you paid. It does not unlock CVs or certificates. It works on up to 3 browsers
              or devices, so keep the code private: anyone who has it can use a slot.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RedeemPassModal;
