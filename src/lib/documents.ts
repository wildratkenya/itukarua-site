import { supabase, supabaseUrl } from './supabase';

// Certificates are stored as object paths (e.g. "<uid>/certs/<file>.pdf") in a
// private bucket. Older rows still hold public adverts-bucket URLs; both are
// resolved to a short-lived signed URL before display.

export const DOCUMENTS_BUCKET = 'documents';

const LEGACY_PUBLIC_MARKER = '/storage/v1/object/public/adverts/';
const SIGNED_MARKER = '/storage/v1/object/sign/';

function storagePath(value: string): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    const index = value.indexOf(LEGACY_PUBLIC_MARKER);
    if (index === -1) return null;
    return decodeURIComponent(value.slice(index + LEGACY_PUBLIC_MARKER.length).split('?')[0]);
  }
  return value.replace(/^\/+/, '');
}

// Send signed storage reads through the same-origin proxy the rest of the app
// uses; direct browser requests to supabase.co have been unreliable.
function sameOriginUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  const marker = `${supabaseUrl}${SIGNED_MARKER}`;
  if (!url.startsWith(marker)) return url;
  return `${window.location.origin}/supabase${SIGNED_MARKER}${url.slice(marker.length)}`;
}

export async function resolveDocumentUrl(value: string, expiresIn = 3600): Promise<string> {
  const path = storagePath(value);
  if (!path) return value;

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    console.error('[documents] could not sign', path, error);
    return '';
  }
  return sameOriginUrl(data.signedUrl);
}
