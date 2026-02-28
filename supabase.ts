/**
 * Supabase Client Configuration
 * DEBUG VERSION: Comprehensive logging enabled
 */

console.log('[SUPABASE] ========================================');
console.log('[SUPABASE] supabase.ts module loading...', new Date().toISOString());
console.log('[SUPABASE] ========================================');

import { createClient } from '@supabase/supabase-js'
console.log('[SUPABASE] ✅ @supabase/supabase-js imported');

const fallbackSupabaseUrl = 'https://ktrrrqaqaljdcmxqdcff.supabase.co';
const fallbackSupabaseAnonKey = 'sb_publishable_ZcEU2_K18A4NU43hO4zPmA_N5SkuqO_';

console.log('[SUPABASE] Environment variables:', {
  VITE_SUPABASE_URL: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET',
  VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'NOT SET'
});

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SUPABASE] ❌ Missing environment variables!');
  throw new Error(
    'Missing Supabase environment variables. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env'
  )
}

console.log('[SUPABASE] Creating Supabase client...');
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)
console.log('[SUPABASE] ✅ Supabase client created successfully');
console.log('[SUPABASE] ========================================');
