/**
 * Regras de autorização puras (MISSÃO 002 / R-01..R-04).
 * Sem imports Deno/npm para poderem ser testadas com vitest.
 */

export const ORG_ROLES = ['owner', 'admin', 'senior', 'pleno', 'operador', 'staff', 'client'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const STAFF_ROLES: readonly OrgRole[] = ['owner', 'admin', 'senior', 'pleno', 'operador', 'staff'];
export const ADMIN_ROLES: readonly OrgRole[] = ['owner', 'admin'];

export type CallerKind = 'service' | 'user' | 'anonymous';

export type CallerContext = {
  kind: CallerKind;
  userId?: string | null;
  isGlobalAdmin?: boolean;
  /** Papel de quem chama na organização alvo (se for membro). */
  orgRole?: string | null;
};

export function normalizeOrgRole(value: unknown): OrgRole | null {
  const v = String(value ?? '').trim().toLowerCase();
  return (ORG_ROLES as readonly string[]).includes(v) ? (v as OrgRole) : null;
}

/** Converte o papel de UI ("Administrador", "Cliente", ...) para o papel de org_members. */
export function uiRoleToOrgRole(value: unknown): OrgRole {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'administrador' || v === 'admin') return 'admin';
  if (v === 'owner' || v === 'proprietário' || v === 'proprietario') return 'owner';
  if (v === 'cliente' || v === 'client' || v === '') return 'client';
  return normalizeOrgRole(v) ?? 'staff';
}

export function isAdminCaller(c: CallerContext): boolean {
  if (c.kind === 'service') return true;
  if (c.kind !== 'user') return false;
  if (c.isGlobalAdmin) return true;
  return (ADMIN_ROLES as readonly string[]).includes(String(c.orgRole ?? ''));
}

export function isStaffCaller(c: CallerContext): boolean {
  if (isAdminCaller(c)) return true;
  return c.kind === 'user' && (STAFF_ROLES as readonly string[]).includes(String(c.orgRole ?? ''));
}

/** Credenciais só podem ser enviadas pelo servidor ou pelo próprio titular. */
export function canSendAccessCredentials(c: CallerContext, recipientEmail: string, callerEmail?: string | null): boolean {
  if (c.kind === 'service') return true;
  if (c.kind !== 'user' || !callerEmail) return false;
  return recipientEmail.trim().toLowerCase() === callerEmail.trim().toLowerCase();
}

/** Checkout: service role, titular do processo ou staff da organização desse processo. */
export function canCreateCheckoutForProcess(c: CallerContext, processClientId: string | null | undefined): boolean {
  if (c.kind === 'service') return true;
  if (c.kind !== 'user' || !c.userId) return false;
  return c.userId === String(processClientId ?? '') || isStaffCaller(c);
}

/**
 * create-user: o que um chamador pode fazer.
 * - anónimo (registo público): só criar conta NOVA com papel client; nunca apagar nem redefinir senha.
 * - admin da org: criar/vincular utilizadores na SUA org (sem 'owner'); NÃO redefine senha nem
 *   sobrescreve o perfil de contas já existentes (evita tomada de conta de admins de outras orgs).
 * - admin global / service role: tudo, incluindo apagar e redefinir senha.
 */
export function decideCreateUser(c: CallerContext, req: {
  action?: string | null;
  requestedRole: OrgRole;
  userAlreadyExists: boolean;
}): { allowed: boolean; status?: number; reason?: string; effectiveRole: OrgRole; mayResetPassword: boolean } {
  const admin = isAdminCaller(c);
  const superAdmin = c.kind === 'service' || (c.kind === 'user' && !!c.isGlobalAdmin);

  if (req.action === 'delete') {
    return superAdmin
      ? { allowed: true, effectiveRole: req.requestedRole, mayResetPassword: false }
      : { allowed: false, status: 403, reason: 'Apenas o administrador global pode remover utilizadores.', effectiveRole: 'client', mayResetPassword: false };
  }

  if (!admin) {
    if (req.userAlreadyExists) {
      return { allowed: false, status: 409, reason: 'Este e-mail já está registado. Utilize "Esqueci a senha" para recuperar o acesso.', effectiveRole: 'client', mayResetPassword: false };
    }
    return { allowed: true, effectiveRole: 'client', mayResetPassword: false };
  }

  if (req.requestedRole === 'owner' && !superAdmin) {
    return { allowed: false, status: 403, reason: 'Apenas o administrador global pode atribuir o papel owner.', effectiveRole: 'client', mayResetPassword: false };
  }
  return { allowed: true, effectiveRole: req.requestedRole, mayResetPassword: superAdmin };
}

/** update-user-org-membership */
export function decideMembershipChange(c: CallerContext, requestedRole: unknown): {
  allowed: boolean; status?: number; reason?: string; role?: OrgRole;
} {
  const role = normalizeOrgRole(requestedRole);
  if (!role) return { allowed: false, status: 400, reason: 'Papel inválido.' };
  if (!isAdminCaller(c)) return { allowed: false, status: 403, reason: 'Apenas administradores da organização podem alterar vínculos.' };
  const superAdmin = c.kind === 'service' || (c.kind === 'user' && !!c.isGlobalAdmin);
  if (role === 'owner' && !superAdmin && c.orgRole !== 'owner') {
    return { allowed: false, status: 403, reason: 'Apenas um owner ou o administrador global pode atribuir o papel owner.' };
  }
  return { allowed: true, role };
}

/** Comparação em tempo constante (evita timing attacks na comparação de chaves). */
export function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(String(a ?? ''));
  const eb = new TextEncoder().encode(String(b ?? ''));
  let diff = ea.length ^ eb.length;
  const len = Math.max(ea.length, eb.length);
  for (let i = 0; i < len; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export function extractBearer(header: string | null | undefined): string {
  const h = String(header ?? '').trim();
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : '';
}

/** Escapa HTML para interpolação segura em e-mails. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
