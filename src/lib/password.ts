// Minimum password length shown to users. The Supabase project's
// `password_min_length` setting must stay at or above this value; the UI check
// only gives a helpful message before the server rejects a short password.
export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_HINT = `Min ${MIN_PASSWORD_LENGTH} characters`;

export const PASSWORD_TOO_SHORT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;

export const isPasswordLongEnough = (value: string): boolean => value.length >= MIN_PASSWORD_LENGTH;

// Generated with crypto.getRandomValues, so it is unpredictable and never
// leaves the browser. Ambiguous characters (I, l, O, 0, 1) are omitted so the
// suggestion is easy to read and type on a phone.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*-_=+?';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

const randomIndex = (max: number): number => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
};

const randomChar = (set: string): string => set[randomIndex(set.length)];

/** A 16-character suggestion containing upper, lower, digit and symbol. */
export function suggestPassword(length: number = 16): string {
  const size = Math.max(length, MIN_PASSWORD_LENGTH, 4);
  const chars = [randomChar(UPPER), randomChar(LOWER), randomChar(DIGITS), randomChar(SYMBOLS)];

  while (chars.length < size) chars.push(randomChar(ALL));

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
