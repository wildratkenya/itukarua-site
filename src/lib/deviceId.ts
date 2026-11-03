const DEVICE_KEY = 'itukarua.deviceId.v1';
const DEVICE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

let ephemeralId: string | null = null;

function newDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(18);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Stable per-browser id used to cap how many devices a day-pass token can be
// used on. It survives the pass being removed from this browser, so re-entering
// the token keeps the same slot. Clearing site data mints a new id.
export function getDeviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_KEY);
    if (stored && DEVICE_PATTERN.test(stored)) return stored;
    const created = newDeviceId();
    localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    if (!ephemeralId) ephemeralId = newDeviceId();
    return ephemeralId;
  }
}
