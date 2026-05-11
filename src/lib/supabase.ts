import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xahaxtbudiubelemewna.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhaGF4dGJ1ZGl1YmVsZW1ld25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjE5MDYsImV4cCI6MjA5MDY5NzkwNn0.Y9YUpREWTY255lTh0RypLa5dr-nmzv6M8EYeWGIDkXs'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY

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

export function optimizeImageUrl(url: string, width: number = 400, height: number = 400): string {
  if (!url || !url.startsWith(supabaseUrl)) {
    return url;
  }
  
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}width=${width}&height=${height}&resize=cover&quality=80`;
}
