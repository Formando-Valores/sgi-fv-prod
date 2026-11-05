import { describe, expect, it } from 'vitest';
import {
  decideCreateUser,
  decideMembershipChange,
  escapeHtml,
  extractBearer,
  isStaffCaller,
  timingSafeEqual,
  uiRoleToOrgRole,
  type CallerContext,
} from '../../supabase/functions/_shared/authz';

const anon: CallerContext = { kind: 'anonymous' };
const service: CallerContext = { kind: 'service' };
const orgAdmin: CallerContext = { kind: 'user', userId: 'u-admin', orgRole: 'admin' };
const orgOwner: CallerContext = { kind: 'user', userId: 'u-owner', orgRole: 'owner' };
const operador: CallerContext = { kind: 'user', userId: 'u-op', orgRole: 'operador' };
const client: CallerContext = { kind: 'user', userId: 'u-cli', orgRole: 'client' };
const globalAdmin: CallerContext = { kind: 'user', userId: 'u-g', isGlobalAdmin: true, orgRole: null };

describe('R-01 · create-user', () => {
  it('anónimo não pode apagar utilizadores', () => {
    const d = decideCreateUser(anon, { action: 'delete', requestedRole: 'client', userAlreadyExists: true });
    expect(d.allowed).toBe(false);
    expect(d.status).toBe(403);
  });

  it('admin de uma organização também não pode apagar contas (só admin global)', () => {
    expect(decideCreateUser(orgAdmin, { action: 'delete', requestedRole: 'client', userAlreadyExists: true }).allowed).toBe(false);
    expect(decideCreateUser(globalAdmin, { action: 'delete', requestedRole: 'client', userAlreadyExists: true }).allowed).toBe(true);
    expect(decideCreateUser(service, { action: 'delete', requestedRole: 'client', userAlreadyExists: true }).allowed).toBe(true);
  });

  it('anónimo não redefine a senha de uma conta existente (tomada de conta)', () => {
    const d = decideCreateUser(anon, { requestedRole: 'client', userAlreadyExists: true });
    expect(d.allowed).toBe(false);
    expect(d.status).toBe(409);
    expect(d.mayResetPassword).toBe(false);
  });

  it('anónimo que pede papel admin fica sempre como client', () => {
    const d = decideCreateUser(anon, { requestedRole: 'admin', userAlreadyExists: false });
    expect(d.allowed).toBe(true);
    expect(d.effectiveRole).toBe('client');
  });

  it('staff não-admin também só cria clientes', () => {
    expect(decideCreateUser(operador, { requestedRole: 'admin', userAlreadyExists: false }).effectiveRole).toBe('client');
  });

  it('admin da org cria admins, mas não redefine senhas de contas existentes', () => {
    const created = decideCreateUser(orgAdmin, { requestedRole: 'admin', userAlreadyExists: false });
    expect(created.allowed).toBe(true);
    expect(created.effectiveRole).toBe('admin');
    const existing = decideCreateUser(orgAdmin, { requestedRole: 'client', userAlreadyExists: true });
    expect(existing.allowed).toBe(true);
    expect(existing.mayResetPassword).toBe(false);
  });

  it('só admin global/service atribui owner ou redefine senha', () => {
    expect(decideCreateUser(orgAdmin, { requestedRole: 'owner', userAlreadyExists: false }).allowed).toBe(false);
    expect(decideCreateUser(globalAdmin, { requestedRole: 'owner', userAlreadyExists: false }).allowed).toBe(true);
    expect(decideCreateUser(globalAdmin, { requestedRole: 'client', userAlreadyExists: true }).mayResetPassword).toBe(true);
  });

  it('mapeia papéis da interface', () => {
    expect(uiRoleToOrgRole('Administrador')).toBe('admin');
    expect(uiRoleToOrgRole('Cliente')).toBe('client');
    expect(uiRoleToOrgRole('')).toBe('client');
  });
});

describe('R-02 · update-user-org-membership', () => {
  it('anónimo, cliente e operador não alteram vínculos', () => {
    expect(decideMembershipChange(anon, 'admin').allowed).toBe(false);
    expect(decideMembershipChange(client, 'admin').allowed).toBe(false);
    expect(decideMembershipChange(operador, 'client').allowed).toBe(false);
  });

  it('recusa papéis inválidos', () => {
    const d = decideMembershipChange(orgAdmin, 'superuser');
    expect(d.allowed).toBe(false);
    expect(d.status).toBe(400);
  });

  it('admin altera papéis comuns, mas não atribui owner', () => {
    expect(decideMembershipChange(orgAdmin, 'pleno').allowed).toBe(true);
    expect(decideMembershipChange(orgAdmin, 'owner').allowed).toBe(false);
    expect(decideMembershipChange(orgOwner, 'owner').allowed).toBe(true);
    expect(decideMembershipChange(globalAdmin, 'owner').allowed).toBe(true);
  });
});

describe('R-03/R-04 · staff da organização', () => {
  it('só staff (não clientes nem anónimos) cria clientes de processo / envia certificados', () => {
    expect(isStaffCaller(anon)).toBe(false);
    expect(isStaffCaller(client)).toBe(false);
    expect(isStaffCaller(operador)).toBe(true);
    expect(isStaffCaller(orgAdmin)).toBe(true);
    expect(isStaffCaller(service)).toBe(true);
    expect(isStaffCaller({ kind: 'user', userId: 'x', orgRole: null })).toBe(false);
  });
});

describe('utilitários de segurança', () => {
  it('compara chaves em tempo constante', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('extrai o token Bearer', () => {
    expect(extractBearer('Bearer xyz')).toBe('xyz');
    expect(extractBearer('bearer  xyz ')).toBe('xyz');
    expect(extractBearer('Basic xyz')).toBe('');
    expect(extractBearer(null)).toBe('');
  });

  it('escapa HTML (injeção no e-mail do certificado)', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });
});
