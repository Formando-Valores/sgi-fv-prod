import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes. O build continuará, mas login/cadastro ficarão indisponíveis até configurar as variáveis no ambiente.'
  );
}

const authStorageKey = supabaseUrl
  ? `sgi-fv-auth-${new URL(supabaseUrl).host}`
  : 'sgi-fv-auth-placeholder';

const supabaseOptions: SupabaseClientOptions<'public'> = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: authStorageKey,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    // Evita deadlocks de LockManager vistos em alguns navegadores/abas durante refresh.
    lock: async (_name, _timeout, callback) => callback(),
  },
};

// Placeholders evitam quebra em tempo de import/build quando env ainda não foi configurado no provedor.
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  supabaseOptions
);