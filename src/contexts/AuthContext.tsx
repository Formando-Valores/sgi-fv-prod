/**
 * SGI FV - Auth Context
 * Provides authentication state and user context throughout the app
 * 
 * DEBUG VERSION: Comprehensive logging enabled
 */

console.log('[AuthContext] ========================================');
console.log('[AuthContext] AuthContext.tsx module loading...', new Date().toISOString());
console.log('[AuthContext] ========================================');

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
console.log('[AuthContext] ✅ React hooks imported');
import { Session } from '@supabase/supabase-js';
console.log('[AuthContext] ✅ Supabase Session type imported');

import { supabase } from '../../supabase';
console.log('[AuthContext] ✅ Supabase client imported');

import type { UserContext, OrgRole } from '../../types';
console.log('[AuthContext] ✅ Types imported');
console.log('[AuthContext] All imports completed successfully!');

// Debug mode flag - set to false in production
const DEBUG = true;
const log = (...args: any[]) => {
  if (DEBUG) console.log('[AuthContext]', new Date().toISOString(), ...args);
};
const logError = (...args: any[]) => {
  console.error('[AuthContext ERROR]', new Date().toISOString(), ...args);
};

interface AuthContextValue {
  session: Session | null;
  userContext: UserContext | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  refreshContext: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Check if an error is a "relation does not exist" error
 */
function isTableNotFoundError(error: any): boolean {
  const message = error?.message || error?.details || '';
  return (
    message.includes('relation') && message.includes('does not exist') ||
    message.includes('42P01') || // PostgreSQL error code for undefined_table
    error?.code === '42P01'
  );
}

/**
 * Fetch user context from v_user_context view
 */
async function fetchUserContext(userId: string): Promise<{ context: UserContext | null; error: string | null }> {
  const startTime = performance.now();
  log('fetchUserContext() starting for userId:', userId);
  
  try {
    log('Executing Supabase query on v_user_context...');
    
    // Use maybeSingle() to handle case where no rows exist
    const { data, error } = await supabase
      .from('v_user_context')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const queryTime = performance.now() - startTime;
    log(`Query completed in ${queryTime.toFixed(2)}ms`);

    if (error) {
      logError('Error fetching user context:', error);
      logError('Error details:', JSON.stringify(error, null, 2));
      logError('Error code:', error.code);
      logError('Error message:', error.message);
      logError('Error hint:', error.hint);
      logError('Error details:', error.details);
      
      // Check if it's a "relation does not exist" error
      if (isTableNotFoundError(error)) {
        log('Detected table not found error');
        return { 
          context: null, 
          error: '⚠️ Banco de dados não configurado. Execute as migrações SQL primeiro.\n\nVeja PROCESSES_MODULE.md para instruções detalhadas.' 
        };
      }
      
      return { 
        context: null, 
        error: 'Erro ao carregar contexto do usuário. Por favor, tente novamente.' 
      };
    }

    if (!data) {
      log('No user context found for user:', userId);
      log('Query returned null/undefined data');
      return { 
        context: null, 
        error: 'Usuário não vinculado a nenhuma organização. Entre em contato com o administrador.' 
      };
    }

    log('User context data received:', JSON.stringify(data, null, 2));

    const context: UserContext = {
      id: data.user_id,
      email: data.email || '',
      nome_completo: data.nome_completo || '',
      org_id: data.org_id || '',
      org_slug: data.org_slug || 'default',
      org_name: data.org_name || 'Sem organização',
      role: (data.org_role || 'client') as OrgRole,
      profile: null
    };

    log('UserContext created:', JSON.stringify(context, null, 2));
    
    return {
      context,
      error: null
    };
  } catch (err) {
    const queryTime = performance.now() - startTime;
    logError(`Unexpected error after ${queryTime.toFixed(2)}ms:`, err);
    logError('Error stack:', (err as Error)?.stack);
    return { 
      context: null, 
      error: 'Erro inesperado ao carregar dados. Por favor, tente novamente.' 
    };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  log('AuthProvider rendering');
  
  const [session, setSession] = useState<Session | null>(null);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  log('Current state:', { 
    hasSession: !!session, 
    hasUserContext: !!userContext, 
    loading, 
    error 
  });

  const loadContext = useCallback(async (userId: string) => {
    log('loadContext() called for userId:', userId);
    const result = await fetchUserContext(userId);
    log('loadContext() result:', { hasContext: !!result.context, error: result.error });
    setUserContext(result.context);
    setError(result.error);
    return result;
  }, []);

  const refreshContext = useCallback(async () => {
    log('refreshContext() called');
    if (session?.user?.id) {
      log('Refreshing context for user:', session.user.id);
      setLoading(true);
      setError(null);
      try {
        await loadContext(session.user.id);
      } finally {
        setLoading(false);
        log('refreshContext() completed');
      }
    } else {
      log('No session/user ID, cannot refresh context');
    }
  }, [session, loadContext]);

  const signOut = useCallback(async () => {
    log('signOut() called');
    await supabase.auth.signOut();
    setSession(null);
    setUserContext(null);
    setError(null);
    log('signOut() completed');
  }, []);

  useEffect(() => {
    log('useEffect: Initializing auth...');
    
    // Log localStorage state
    try {
      const authKeys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('auth'));
      log('LocalStorage auth keys:', authKeys);
      authKeys.forEach(key => {
        try {
          const value = localStorage.getItem(key);
          log(`LocalStorage[${key}]:`, value ? `${value.substring(0, 100)}...` : 'null');
        } catch (e) {
          log(`LocalStorage[${key}]: Error reading`);
        }
      });
    } catch (e) {
      log('Error reading localStorage:', e);
    }
    
    // Get initial session with timeout protection
    const initAuth = async () => {
      const initStartTime = performance.now();
      log('initAuth() starting...');
      
      try {
        setLoading(true);
        setError(null);
        
        // Add timeout to prevent infinite loading
        log('Setting up 15s timeout...');
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => {
            log('TIMEOUT TRIGGERED after 15s');
            reject(new Error('Timeout: Conexão demorou muito'));
          }, 15000)
        );
        
        log('Calling supabase.auth.getSession()...');
        const sessionPromise = supabase.auth.getSession();
        
        const { data: { session: initialSession } } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as { data: { session: Session | null } };
        
        const sessionTime = performance.now() - initStartTime;
        log(`getSession() completed in ${sessionTime.toFixed(2)}ms`);
        log('Initial session:', initialSession ? {
          userId: initialSession.user?.id,
          email: initialSession.user?.email,
          expiresAt: initialSession.expires_at
        } : 'null');
        
        setSession(initialSession);
        
        if (initialSession?.user?.id) {
          log('Session found, loading user context...');
          const contextStartTime = performance.now();
          await loadContext(initialSession.user.id);
          const contextTime = performance.now() - contextStartTime;
          log(`loadContext() completed in ${contextTime.toFixed(2)}ms`);
        } else {
          log('No session found, user not authenticated');
        }
      } catch (err: any) {
        const totalTime = performance.now() - initStartTime;
        logError(`Error initializing auth after ${totalTime.toFixed(2)}ms:`, err);
        logError('Error message:', err?.message);
        logError('Error stack:', err?.stack);
        
        if (err?.message?.includes('Timeout')) {
          setError('Tempo limite excedido. Verifique sua conexão e tente novamente.');
        } else {
          setError('Erro ao inicializar autenticação. Por favor, recarregue a página.');
        }
      } finally {
        const totalTime = performance.now() - initStartTime;
        log(`initAuth() finished in ${totalTime.toFixed(2)}ms, setting loading=false`);
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    log('Setting up auth state change listener...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        log('Auth state change event:', event);
        log('New session:', newSession ? {
          userId: newSession.user?.id,
          email: newSession.user?.email
        } : 'null');
        
        setSession(newSession);
        
        if (event === 'SIGNED_IN' && newSession?.user?.id) {
          log('SIGNED_IN event, loading context...');
          setLoading(true);
          setError(null);
          try {
            await loadContext(newSession.user.id);
          } finally {
            setLoading(false);
            log('SIGNED_IN context loading completed');
          }
        } else if (event === 'SIGNED_OUT') {
          log('SIGNED_OUT event, clearing context');
          setUserContext(null);
          setError(null);
        } else if (event === 'TOKEN_REFRESHED') {
          log('TOKEN_REFRESHED event');
        } else if (event === 'USER_UPDATED') {
          log('USER_UPDATED event');
        }
      }
    );

    return () => {
      log('Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, [loadContext]);

  const isAdmin = userContext?.role === 'admin' || userContext?.role === 'owner';
  
  log('Render decision:', { loading, error: !!error, hasSession: !!session, isAdmin });

  // Show loading state
  if (loading) {
    log('Rendering loading spinner');
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando...</p>
          <p className="text-gray-600 text-xs mt-2">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Show error state only if user is authenticated but context failed
  if (error && session) {
    log('Rendering error state:', error);
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-4">Erro ao Carregar</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={refreshContext}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Tentar Novamente
            </button>
            <button
              onClick={async () => {
                log('User clicked logout from error screen');
                await supabase.auth.signOut();
                window.location.href = '/login';
              }}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Sair e Fazer Login Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  log('Rendering children with context');
  return (
    <AuthContext.Provider value={{
      session,
      userContext,
      loading,
      error,
      isAdmin,
      refreshContext,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
