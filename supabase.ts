/**
 * Supabase Client Configuration
 */

console.log('[SUPABASE] supabase.ts module loading...');

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ktrrqaqaljdcmxqdcff.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

console.log('[SUPABASE] Environment variables:', {
  VITE_SUPABASE_URL: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET',
  VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'NOT SET'
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SUPABASE] ❌ Missing environment variables!');
  throw new Error(
    'Missing Supabase environment variables. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env'
  )
}

console.log('[SUPABASE] Creating Supabase client...');
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log('[SUPABASE] ✅ Supabase client created successfully');
