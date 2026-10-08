import React, { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';
import { getConsent, setConsent, CONSENT_VERSION } from '@/lib/consent';
import { PRIVACY_POLICY, COOKIE_POLICY } from '@/data/termsContent';

/**
 * First-visit consent bar for cookies + privacy policy.
 *
 * Non-blocking on purpose: the site only runs essential cookies (see
 * COOKIE_POLICY), so declining must never break anything - the bar is a
 * transparency record, not a gate. Acceptance is stored in localStorage with
 * the CONSENT_VERSION stamped in, so bumping that constant re-prompts everyone
 * after a policy change.
 *
 * Mounted in App.tsx so it also covers /admin.
 */
const CookieConsent: React.FC = () => {
  // null = "not yet read from storage"; render nothing in that frame so the
  // bar never flashes for users who already accepted.
  const [decided, setDecided] = useState<boolean | null>(null);
  const [showPolicy, setShowPolicy] = useState<'privacy' | 'cookies' | null>(null);

  useEffect(() => {
    setDecided(getConsent() !== null);
  }, []);

  const decide = (status: 'accepted' | 'declined') => {
    setConsent(status);
    setDecided(true);
  };

  if (decided === null || decided === true) return null;

  const policyText = showPolicy === 'privacy' ? PRIVACY_POLICY : COOKIE_POLICY;
  const policyTitle = showPolicy === 'privacy' ? 'Privacy Policy' : 'Cookie Policy';

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-[150] border-t border-gray-200 bg-white/95 backdrop-blur shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Cookie className="w-5 h-5 text-green-600 shrink-0 hidden sm:block" />
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed flex-1">
            We use essential cookies to keep Itukarua secure and working (sign-in, theme, spam protection) — no
            third-party tracking. Read our{' '}
            <button type="button" onClick={() => setShowPolicy('cookies')} className="underline text-green-700 hover:text-green-800 font-medium">
              Cookie Policy
            </button>{' '}
            and{' '}
            <button type="button" onClick={() => setShowPolicy('privacy')} className="underline text-green-700 hover:text-green-800 font-medium">
              Privacy Policy
            </button>
            . By continuing you accept our use of cookies.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => decide('declined')}
              className="px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => decide('accepted')}
              className="px-4 py-2 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Accept Cookies &amp; Privacy Policy
            </button>
          </div>
        </div>
      </div>

      {showPolicy && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowPolicy(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">{policyTitle}</h2>
              <button onClick={() => setShowPolicy(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 text-sm text-gray-700 whitespace-pre-line leading-relaxed">{policyText}</div>
            <div className="px-6 pb-4 text-[11px] text-gray-400">Consent notice version {CONSENT_VERSION}</div>
          </div>
        </div>
      )}
    </>
  );
};

export default CookieConsent;
