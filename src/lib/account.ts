import { supabase, supabaseUrl } from './supabase';

async function authedHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Your session expired. Sign in again and retry.');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body?.error) return String(body.error);
  } catch {
    // Non-JSON error body.
  }
  return `Request failed (${res.status})`;
}

export async function downloadMyData(): Promise<void> {
  const headers = await authedHeaders();
  const res = await fetch(`${supabaseUrl}/functions/v1/export-account-data`, { method: 'POST', headers });
  if (!res.ok) throw new Error(await readError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `itukarua-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function deleteMyAccount(): Promise<void> {
  const headers = await authedHeaders();
  const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, { method: 'POST', headers });
  if (!res.ok) throw new Error(await readError(res));
  await supabase.auth.signOut();
}
