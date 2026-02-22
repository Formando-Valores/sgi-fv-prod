/**
 * SGI FV - Auth Context
 * Provides authentication state and user context throughout the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../supabase';
import type { UserContext, OrgRole } from '../../types';

interface AuthContextValue {
  session: Session | null;
  userContext: UserContext | null;
  loading: boolean;
  isAdmin: boolean;
  refreshContext: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Fetch user context from v_user_context view
 */
async function fetchUserContext(userId: string): Promise<UserContext | null> {
  const { data, error } = await supabase
    .from('v_user_context')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.warn('Could not fetch user context:', error);
    return null;
  }

  return {
    id: data.user_id,
    email: data.email || '',
    nome_completo: data.nome_completo || '',
    org_id: data.org_id || '',
    org_slug: data.org_slug || 'default',
    org_name: data.org_name || 'Sem organização',
    role: (data.org_role || 'client') as OrgRole,
    profile: null
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);

  const loadContext = useCallback(async (userId: string) => {
    const ctx = await fetchUserContext(userId);
    setUserContext(ctx);
    return ctx;
  }, []);

  const refreshContext = useCallback(async () => {
    if (session?.user?.id) {
      await loadContext(session.user.id);
    }
  }, [session, loadContext]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserContext(null);
  }, []);

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        
        if (initialSession?.user?.id) {
          await loadContext(initialSession.user.id);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state change:', event);
        setSession(newSession);
        
        if (event === 'SIGNED_IN' && newSession?.user?.id) {
          await loadContext(newSession.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUserContext(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadContext]);

  const isAdmin = userContext?.role === 'admin' || userContext?.role === 'owner';

  return (
    <AuthContext.Provider value={{
      session,
      userContext,
      loading,
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
