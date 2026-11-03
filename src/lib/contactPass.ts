import { TOP_RATED_PASS_HOURS_DEFAULT } from './database';

const STORAGE_KEY = 'itukarua.topRatedPass.v1';

export interface StoredPass {
  token: string;
  expiresAt: string | null;
  savedAt: string;
}

export function passExpiry(pass: StoredPass): Date {
  if (pass.expiresAt) return new Date(pass.expiresAt);
  return new Date(new Date(pass.savedAt).getTime() + TOP_RATED_PASS_HOURS_DEFAULT * 3600_000);
}

export function passIsActive(pass: StoredPass | null): pass is StoredPass {
  return !!pass && passExpiry(pass).getTime() > Date.now();
}

export function readStoredPass(): StoredPass | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPass>;
    if (!parsed?.token || typeof parsed.token !== 'string' || !parsed.token.startsWith('ITK-')) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const pass: StoredPass = {
      token: parsed.token,
      expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    };
    if (!passIsActive(pass)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return pass;
  } catch {
    return null;
  }
}

export function saveStoredPass(token: string, expiresAt: string | null): StoredPass {
  const pass: StoredPass = {
    token: token.trim().toUpperCase(),
    expiresAt: expiresAt || null,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pass));
  } catch {
    // Private browsing or a full quota: the on-screen token still works.
  }
  return pass;
}

export function clearStoredPass(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}

export function formatPassExpiry(pass: StoredPass): string {
  return passExpiry(pass).toLocaleString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function downloadPassToken(pass: StoredPass): void {
  const expiry = formatPassExpiry(pass);
  const text = [
    'ITUKARUA TOP RATED DAY PASS',
    '============================',
    '',
    `Token:      ${pass.token}`,
    `Expires:    ${expiry}`,
    `Purchased:  ${new Date(pass.savedAt).toLocaleString('en-KE')}`,
    '',
    'What this unlocks',
    '-----------------',
    'Contact details (phone, email, WhatsApp, location) for the workers in the',
    'Top Rated list as it stood when you paid, until the expiry above.',
    '',
    'Sign in with the same browser to view CVs and certificates. Those are not',
    'included in the day pass.',
    '',
    'Devices',
    '-------',
    'This pass works on up to 3 browsers or devices. A fourth device is refused.',
    '',
    'Keep this token private: anyone who has it can use these slots until it',
    'expires. Redeem it at itukarua.co.ke -> Top Rated -> "I have a day pass".',
  ].join('\n');

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `itukarua-day-pass-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
