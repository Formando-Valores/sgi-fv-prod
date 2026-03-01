/**
 * SGI FV - User Context Utility
 * Helper functions for user context operations
 */

import { supabase } from '../../supabase';
import type { UserContext, OrgRole } from '../../types';

/**
 * Get user context from v_user_context view
 * Returns null if user is not authenticated or has no organization
 */
export async function getUserContext(): Promise<UserContext | null> {
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.log('No authenticated user');
    return null;
  }

  // Query v_user_context view
  const { data, error } = await supabase
    .from('v_user_context')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    console.warn('User context not found:', error);
    // Return minimal context with "Sem organização" state
    return {
      id: user.id,
      email: user.email || '',
      nome_completo: user.user_metadata?.name || '',
      org_id: '',
      org_slug: '',
      org_name: 'Sem organização',
      role: 'client' as OrgRole,
      profile: null
    };
  }

  return {
    id: data.user_id,
    email: data.email || '',
    nome_completo: data.nome_completo || '',
    org_id: data.org_id || '',
    org_slug: data.org_slug || '',
    org_name: data.org_name || 'Sem organização',
    role: (data.org_role || 'client') as OrgRole,
    profile: null
  };
}

/**
 * Check if user has admin permissions
 */
export function hasAdminPermission(userContext: UserContext | null): boolean {
  if (!userContext) return false;
  return userContext.role === 'admin' || userContext.role === 'owner';
}

/**
 * Check if user has a valid organization
 */
export function hasValidOrg(userContext: UserContext | null): boolean {
  if (!userContext) return false;
  return !!userContext.org_id && userContext.org_id !== '';
}
