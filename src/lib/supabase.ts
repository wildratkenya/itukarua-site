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

export function optimizeImageUrl(url: string, width: number = 400, height: number = 400): string {
  if (!url || !url.startsWith(supabaseUrl)) {
    return url;
  }
  
  // Proxy through Vercel to avoid ad-blocker blocking supabase.co/storage requests
  if (url.startsWith(STORAGE_PREFIX) && typeof window !== 'undefined') {
    const origin = window.location.origin;
    // Skip proxy on localhost since Vite dev server doesn't have the rewrite rule
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      const path = url.substring(STORAGE_PREFIX.length);
      return `${origin}/supabase-storage/${path}?width=${width}&height=${height}&resize=cover&quality=80`;
    }
  }
  
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}width=${width}&height=${height}&resize=cover&quality=80`;
}

export function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.target as HTMLImageElement;
  if (!img.src.includes(FALLBACK_IMAGE)) {
    img.src = FALLBACK_IMAGE;
  }
}
