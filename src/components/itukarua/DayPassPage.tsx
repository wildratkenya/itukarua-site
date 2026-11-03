import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Clock, Copy, Download, KeyRound, Loader2, Lock, RefreshCw, Users } from 'lucide-react';
import {
  getTopRatedPass,
  getTopRatedPassConfig,
  TOP_RATED_PASS_FEE_DEFAULT,
  TOP_RATED_PASS_HOURS_DEFAULT,
  type TopRatedPassResult,
} from '@/lib/database';
import {
  clearStoredPass,
  downloadPassToken,
  formatPassExpiry,
  readStoredPass,
  saveStoredPass,
  type StoredPass,
} from '@/lib/contactPass';
import { optimizeImageUrl, handleImageError } from '@/lib/supabase';
import type { Page } from './Header';
import type { MpesaHandler } from '@/lib/mpesa';

interface DayPassPageProps {
  onNavigate: (page: Page) => void;
  onOpenAuth: (tab: 'login' | 'signup') => void;
  onOpenMpesa: MpesaHandler;
}

const REASON_MESSAGES: Record<string, string> = {
  invalid: 'That token is not valid.',
  expired: 'That day pass has expired.',
  rate_limited: 'Too many checks in a short time. Wait a minute and reload.',
  device_limit: 'This day pass is already in use on 3 devices. Use it on one of those, or buy a new pass.',
};

const DayPassPage: React.FC<DayPassPageProps> = ({ onNavigate, onOpenAuth, onOpenMpesa }) => {
  const [pass, setPass] = useState<StoredPass | null>(() => readStoredPass());
  const [result, setResult] = useState<TopRatedPassResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fee, setFee] = useState(TOP_RATED_PASS_FEE_DEFAULT);
  const [hours, setHours] = useState(TOP_RATED_PASS_HOURS_DEFAULT);
  const [tokenInput, setTokenInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getTopRatedPassConfig().then(cfg => { setFee(cfg.fee); setHours(cfg.windowHours); }).catch(() => {});
  }, []);

  const loadPass = useCallback(async (current: StoredPass) => {
    setLoading(true);
    setError('');
    try {
      const outcome = await getTopRatedPass(current.token);
      if (!outcome) {
        setError('Could not load your pass right now. Try again.');
        return;
      }
      if (!outcome.allowed) {
        if (outcome.reason === 'expired' || outcome.reason === 'invalid') {
          clearStoredPass();
          setPass(null);
          setResult(null);
          setError(REASON_MESSAGES[outcome.reason]);
        } else {
          setError(REASON_MESSAGES[outcome.reason || 'invalid'] || REASON_MESSAGES.invalid);
        }
        return;
      }
      setResult(outcome);
    } catch {
      setError('Could not load your pass right now. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pass) loadPass(pass);
  }, [pass, loadPass]);

  const handleRedeem = async () => {
    const clean = tokenInput.trim().toUpperCase();
    if (!clean) { setRedeemError('Enter the token from your purchase.'); return; }
    setRedeeming(true);
    setRedeemError('');
    try {
      const outcome = await getTopRatedPass(clean);
      if (!outcome) { setRedeemError('Could not check that token. Try again.'); return; }
      if (!outcome.allowed) {
        setRedeemError(REASON_MESSAGES[outcome.reason || 'invalid'] || REASON_MESSAGES.invalid);
        return;
      }
      const stored = saveStoredPass(clean, outcome.expiresAt ?? null);
      setTokenInput('');
      setPass(stored);
    } catch {
      setRedeemError('Could not check that token. Try again.');
    } finally {
      setRedeeming(false);
    }
  };

  const handleBuy = () => {
    onOpenMpesa(
      fee,
      'Top Rated Day Pass — 24h',
      'ITK-TOP',
      'top_rated_day_pass',
      undefined, undefined, undefined, undefined, false, false, null,
      undefined, undefined, undefined,
      {
        metadata: { kind: 'top_rated_pass' },
        onTokenIssued: (token, expiresAt) => {
          setPass(saveStoredPass(token, expiresAt));
        },
      }
    );
  };

  const handleCopy = async () => {
    if (!pass) return;
    try {
      await navigator.clipboard.writeText(pass.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable; the token is still visible for manual copy.
    }
  };

  const covered = result?.profiles || [];

  return (
    <div className="min-h-[60vh] bg-gray-50 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Top Rated Day Pass</h1>
          <p className="text-sm text-gray-500 mt-1">
            Contact details for every top-rated worker, unlocked with one token for {hours} hours on up to 3 devices.
          </p>
        </div>

        {!pass ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                <KeyRound className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Redeem your token</h2>
                <p className="text-xs text-gray-500 mt-0.5">Paste the token you received after payment.</p>
              </div>
            </div>
            <div>
              <label htmlFor="pass-token" className="block text-xs font-medium text-gray-600 mb-1.5">Day pass token</label>
              <input
                id="pass-token"
                value={tokenInput}
                onChange={e => { setTokenInput(e.target.value); setRedeemError(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && !redeeming) handleRedeem(); }}
                placeholder="ITK-XXXXXXXXXXXX"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2.5 text-sm font-mono border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              {redeemError && (
                <p className="flex items-start gap-2 text-xs text-red-600 mt-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {redeemError}
                </p>
              )}
            </div>
            <button
              onClick={handleRedeem}
              disabled={redeeming}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {redeeming ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking token…</> : 'Redeem day pass'}
            </button>

            <div className="pt-5 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Don't have a pass yet?</h3>
              <p className="text-xs text-gray-500 mt-1 mb-3">
                KES {fee} unlocks phone, email, WhatsApp and location for every top-rated worker for {hours} hours.
                It works on up to 3 browsers or devices. CVs and certificates still require an account.
              </p>
              <button
                onClick={handleBuy}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 hover:border-green-600 hover:text-green-700 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
              >
                Buy day pass — KES {fee}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Day pass active</h2>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {result ? `${covered.length} worker${covered.length === 1 ? '' : 's'} covered` : 'Checking your pass…'}
                    </p>
                    <p className="text-xs text-green-700 mt-1">Expires {formatPassExpiry(pass)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadPass(pass)}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 hover:border-green-600 hover:text-green-700 disabled:opacity-60 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Refresh
                  </button>
                  <button
                    onClick={() => downloadPassToken(pass)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                </div>
              </div>

              <div className="mt-5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Your token</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs sm:text-sm font-mono text-gray-800 break-all">{pass.token}</code>
                  <button
                    onClick={handleCopy}
                    aria-label="Copy token"
                    className="p-2 bg-white border border-gray-200 hover:border-green-600 hover:text-green-700 text-gray-500 rounded-lg transition-colors flex-shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  Keep this private. It works on up to 3 browsers or devices; anyone with the token can use one of those slots.
                </p>
              </div>

              {error && (
                <p className="flex items-start gap-2 text-xs text-red-600 mt-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">Workers in your pass</h2>
                  <p className="text-xs text-gray-500 mt-0.5">The top-rated list as it stood when you paid.</p>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-[11px] font-semibold rounded-full">
                  <Users className="w-3 h-3" /> {covered.length}
                </span>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                </div>
              )}

              {!loading && covered.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  No workers are currently covered. A worker who withdraws contact consent stops appearing here.
                </p>
              )}

              {!loading && covered.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {covered.map(worker => {
                    const skill = Array.isArray(worker.skills)
                      ? worker.skills[0]
                      : typeof worker.skills === 'string'
                        ? worker.skills.split(',')[0]?.trim()
                        : undefined;
                    return (
                      <div key={worker.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                        {worker.profile_image ? (
                          <img src={optimizeImageUrl(worker.profile_image, 72, 72)} alt={worker.full_name} className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-100" onError={handleImageError} />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center text-sm font-bold text-green-700">
                            {(worker.full_name?.[0] || 'W').toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{worker.full_name}</p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {skill || 'Worker'}
                            {worker.county ? ` · ${worker.county}` : worker.location ? ` · ${worker.location}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-indigo-900">Need CVs and certificates?</p>
                  <p className="text-xs text-indigo-700 mt-0.5">Those documents require a signed-in account; the day pass covers contact details only.</p>
                </div>
              </div>
              <button
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
              >
                Sign in
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onNavigate('home')}
                className="px-4 py-2 border border-gray-300 hover:border-green-600 hover:text-green-700 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Browse top-rated workers
              </button>
              <button
                onClick={() => { clearStoredPass(); setPass(null); setResult(null); setError(''); }}
                className="px-4 py-2 text-gray-400 hover:text-red-600 text-xs font-semibold transition-colors"
              >
                Remove pass from this browser
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DayPassPage;
