import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xahaxtbudiubelemewna.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhaGF4dGJ1ZGl1YmVsZW1ld25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjE5MDYsImV4cCI6MjA5MDY5NzkwNn0.Y9YUpREWTY255lTh0RypLa5dr-nmzv6M8EYeWGIDkXs'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: typeof navigator !== 'undefined' && navigator.locks?.query ? false : true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'apikey': supabaseKey,
    },
  },
});

// ─── Image Optimization ─────────────────────────────────────────────────────

export const FALLBACK_IMAGE = 'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055543861_b8e656f2.jpg';

const STORAGE_PREFIX = `${supabaseUrl}/storage/v1/object/public/`;

const BUCKET_ALIASES: Record<string, string> = { adverts: 'a' }
const BUCKET_ALIASES_REVERSE: Record<string, string> = { a: 'adverts' }

export function optimizeImageUrl(url: string, width: number = 400, height: number = 400): string {
  if (!url || !url.startsWith(supabaseUrl)) {
    return url;
  }
  
  if (url.startsWith(STORAGE_PREFIX) && typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      const path = url.substring(STORAGE_PREFIX.length);
      const slash = path.indexOf('/');
      const bucket = slash > 0 ? path.slice(0, slash) : path;
      const rest = slash > 0 ? path.slice(slash + 1) : '';
      const safe = BUCKET_ALIASES[bucket] || bucket;
      return `${origin}/img/${safe}/${rest}?width=${width}&height=${height}&resize=cover&quality=80&format=webp`;
    }
  }
  
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}width=${width}&height=${height}&resize=cover&quality=80&format=webp`;
}

export function restoreStorageUrl(proxyPath: string): string {
  // /img/a/admin/foo.jpg -> https://xahaxtbudiubelemewna.supabase.co/storage/v1/object/public/adverts/admin/foo.jpg
  const parts = proxyPath.replace(/^\/img\//, '').split('/');
  if (parts.length < 2) return proxyPath;
  const safe = parts[0];
  const bucket = BUCKET_ALIASES_REVERSE[safe] || safe;
  const rest = parts.slice(1).join('/');
  return `${STORAGE_PREFIX}${bucket}/${rest}`;
}

export function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.target as HTMLImageElement;
  if (!img.src.includes(FALLBACK_IMAGE)) {
    img.src = FALLBACK_IMAGE;
  }
}
