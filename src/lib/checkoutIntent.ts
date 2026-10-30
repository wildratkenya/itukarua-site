/**
 * One-shot hand-off from the pricing page to the signup + payment flow. The
 * chosen plan rides along in sessionStorage so it survives the auth modal and
 * a page reload, and is consumed exactly once when the M-Pesa prompt opens —
 * an abandoned checkout must not re-open on the next sign-in.
 */
const KEY = 'itukarua_pending_subscription';

export interface SubscriptionIntent {
  kind: 'subscription';
  role: 'jobseeker';
  amount: number;
  days: number;
}

export function setSubscriptionIntent(intent: SubscriptionIntent): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(intent));
  } catch {}
}

export function peekSubscriptionIntent(): SubscriptionIntent | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.kind !== 'subscription' || parsed.role !== 'jobseeker') return null;
    if (typeof parsed.amount !== 'number' || typeof parsed.days !== 'number') return null;
    return parsed as SubscriptionIntent;
  } catch {
    return null;
  }
}

export function clearSubscriptionIntent(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

export function takeSubscriptionIntent(): SubscriptionIntent | null {
  const intent = peekSubscriptionIntent();
  clearSubscriptionIntent();
  return intent;
}
