// Cookie & privacy consent record.
//
// Stored in localStorage (no backend): guests and signed-in users alike get the
// same treatment, and there is no PII in the record itself.
//
// `v` is the consent-form version. Bump CONSENT_VERSION whenever the wording of
// the notice or the policies changes materially - everyone on an older version
// sees the bar again and must re-accept.

export const CONSENT_VERSION = 1;
const STORAGE_KEY = 'itukarua_consent';

export type ConsentStatus = 'accepted' | 'declined';

export interface ConsentRecord {
  status: ConsentStatus;
  v: number;
  at: string;
}

export const getConsent = (): ConsentRecord | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.status !== 'accepted' && parsed.status !== 'declined') return null;
    if (parsed.v !== CONSENT_VERSION) return null; // outdated wording -> re-prompt
    return parsed;
  } catch {
    return null;
  }
};

export const setConsent = (status: ConsentStatus): ConsentRecord => {
  const record: ConsentRecord = { status, v: CONSENT_VERSION, at: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private mode / storage full: the bar will reappear next visit, which is
    // the legally safe fallback anyway.
  }
  return record;
};

export const hasConsent = (): boolean => getConsent()?.status === 'accepted';

// Future analytics/ad hooks gate on this - never load tracking scripts until
// the visitor has accepted. Called here so the call site exists today.
export const canTrack = (): boolean => hasConsent();
