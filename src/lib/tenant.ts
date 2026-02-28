/**
 * SGI FV - Tenant/Organization Context Module
 * 
 * Este módulo gerencia o contexto multi-tenant da aplicação,
 * resolvendo a organização atual e carregando dados do usuário.
 */

import { supabase } from '../../supabase';
import type { UserContext, OrgMembership } from '../../types';

/**
 * Resolve o slug da organização atual
 * Prioridade:
 * 1. Slug na URL (/:orgSlug/...)
 * 2. Variável de ambiente VITE_ORG_SLUG
 * 3. Fallback para 'default'
 */
export async function resolveOrgSlug(): Promise<string> {
  // Verifica se há um slug na URL (primeiro segmento após a hash)
  const hash = window.location.hash;
  const pathParts = hash.replace('#/', '').split('/');
  const pathSlug = pathParts[0];
  
  // Lista de rotas conhecidas que não são slugs
  const knownRoutes = ['login', 'register', 'dashboard', ''];
  
  if (pathSlug && !knownRoutes.includes(pathSlug)) {
    // Verifica se o slug existe no banco
    const { data } = await supabase
      .from('organizations')
      .select('slug')
      .eq('slug', pathSlug)
      .single();
    
    if (data) {
      return pathSlug;
    }
  }
  
  // Fallback para variável de ambiente ou 'default'
  return import.meta.env.VITE_ORG_SLUG || 'default';
}

/**
 * Obtém o ID da organização pelo slug
 */
export async function getOrgIdBySlug(slug: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single();
  
  if (error || !data) {
    console.error('Erro ao buscar organização:', error);
    return null;
  }
  
  return data.id;
}

/**
 * Obtém o contexto completo do usuário atual
 * Inclui: dados do auth, perfil, membership e organização
 */
export async function getCurrentUserContext(): Promise<UserContext | null> {
  // 1. Verifica se há usuário autenticado
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.log('Nenhum usuário autenticado');
    return null;
  }
  
  // 2. Busca membership do usuário (com dados da organização)
  const { data: membership, error: membershipError } = await supabase
    .from('org_members')
    .select(`
      org_id,
      role,
      organizations (
        id,
        slug,
        name
      )
    `)
    .eq('user_id', user.id)
    .single();
  
  if (membershipError || !membership) {
    console.log('Usuário sem membership:', membershipError);
    return null;
  }
  
  // 3. Busca perfil do usuário
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (profileError) {
    console.warn('Perfil não encontrado:', profileError);
  }
  
  // 4. Monta o contexto completo
  const org = membership.organizations as { id: string; slug: string; name: string };
  
  return {
    id: user.id,
    email: user.email || '',
    nome_completo: profile?.nome_completo || user.user_metadata?.name || '',
    org_id: membership.org_id,
    org_slug: org?.slug || 'default',
    org_name: org?.name || 'Organização',
    role: membership.role as 'owner' | 'admin' | 'staff' | 'client',
    profile: profile || null
  };
}

/**
 * Cria uma nova organização e torna o usuário owner
 */
export async function createOrganization(
  slug: string,
  name: string,
  userId: string
): Promise<{ org_id: string } | null> {
  // 1. Cria a organização
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ slug, name })
    .select('id')
    .single();
  
  if (orgError || !org) {
    console.error('Erro ao criar organização:', orgError);
    return null;
  }
  
  // 2. Adiciona o usuário como owner
  const { error: memberError } = await supabase
    .from('org_members')
    .insert({
      org_id: org.id,
      user_id: userId,
      role: 'owner'
    });
  
  if (memberError) {
    console.error('Erro ao criar membership:', memberError);
    return null;
  }
  
  return { org_id: org.id };
}

/**
 * Adiciona um usuário a uma organização existente
 */
export async function addUserToOrg(
  orgId: string,
  userId: string,
  role: 'owner' | 'admin' | 'staff' | 'client' = 'client'
): Promise<boolean> {
  const { error } = await supabase
    .from('org_members')
    .insert({
      org_id: orgId,
      user_id: userId,
      role
    });
  
  if (error) {
    console.error('Erro ao adicionar usuário à organização:', error);
    return false;
  }
  
  return true;
}

/**
 * Cria ou atualiza o perfil do usuário
 */
export async function upsertProfile(
  userId: string,
  orgId: string,
  data: {
    email?: string;
    nome_completo?: string;
    documento_identidade?: string;
    nif_cpf?: string;
    estado_civil?: string;
    phone?: string;
    endereco?: string;
    pais?: string;
  }
): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      org_id: orgId,
      ...data
    });
  
  if (error) {
    console.error('Erro ao salvar perfil:', error);
    return false;
  }
  
  return true;
}
