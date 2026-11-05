/**
 * Identificação de quem chama uma Edge Function (MISSÃO 002).
 * - 'service'   → Bearer == SUPABASE_SERVICE_ROLE_KEY (chamadas servidor→servidor, ex.: stripe-webhook)
 * - 'user'      → JWT de sessão válido (auth.getUser)
 * - 'anonymous' → chave anon/publishable ou sem Authorization
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearer, timingSafeEqual, type CallerContext } from './authz.ts';

export type ResolvedCaller = CallerContext & {
  token: string;
  email?: string | null;
  // deno-lint-ignore no-explicit-any
  userClient?: any;
};

export async function resolveCaller(req: Request): Promise<ResolvedCaller> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const token = extractBearer(req.headers.get('Authorization'));

  if (!token) return { kind: 'anonymous', token: '' };
  if (serviceKey && timingSafeEqual(token, serviceKey)) return { kind: 'service', token };
  if (anonKey && timingSafeEqual(token, anonKey)) return { kind: 'anonymous', token };

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user) return { kind: 'anonymous', token };

  let isGlobalAdmin = false;
  try {
    const { data: g } = await userClient.rpc('is_default_org_admin', { check_user_id: data.user.id });
    isGlobalAdmin = g === true;
  } catch (_) {
    isGlobalAdmin = false;
  }

  return { kind: 'user', token, userId: data.user.id, email: data.user.email ?? null, isGlobalAdmin, userClient };
}

/**
 * Preenche orgRole do chamador na organização indicada (consulta com service role,
 * restrita ao próprio user_id).
 */
// deno-lint-ignore no-explicit-any
export async function withOrgRole(caller: ResolvedCaller, adminClient: any, orgId: string | null | undefined): Promise<ResolvedCaller> {
  if (caller.kind !== 'user' || !caller.userId || !orgId) return { ...caller, orgRole: null };
  const { data } = await adminClient
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', caller.userId)
    .maybeSingle();
  return { ...caller, orgRole: data?.role ? String(data.role).toLowerCase() : null };
}
