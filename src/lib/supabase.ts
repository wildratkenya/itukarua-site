import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseKey ? 'SET' : 'MISSING');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // Disable to prevent navigator lock issues
    autoRefreshToken: true,
    detectSessionInUrl: false, // Disable to prevent issues
  },
  global: {
    headers: {
      'apikey': supabaseKey,
    },
  },
});