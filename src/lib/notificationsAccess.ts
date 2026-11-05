/**
 * Sino de novidades do painel: quem o vê e como se apresentam os eventos.
 * Papéis reais em org_members.role (migration 029): owner, admin, senior, pleno,
 * operador, staff, client. "staff" é tratado como pleno no front (permissions.ts).
 */

export const ACTIVITY_BELL_ROLES = ['owner', 'admin', 'senior', 'pleno', 'staff'] as const;

export function canSeeActivityBell(role: string | null | undefined): boolean {
  const normalized = String(role ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return (ACTIVITY_BELL_ROLES as readonly string[]).includes(normalized);
}

export type OrgActivityEvent = {
  event_id: string;
  event_type: 'new_member' | 'payment_paid' | string;
  occurred_at: string;
  title: string;
  person_name: string | null;
  person_email: string | null;
  member_role: string | null;
  process_id: string | null;
  protocolo: string | null;
  amount: number | string | null;
  currency: string | null;
  is_unseen: boolean;
};

export function countUnseen(events: Array<Pick<OrgActivityEvent, 'is_unseen'>>): number {
  return events.filter((e) => e.is_unseen).length;
}

export function formatBadgeCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '';
  return count > 9 ? '9+' : String(count);
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Administrador',
  admin: 'Administrador',
  senior: 'Usuário Sênior',
  pleno: 'Usuário Pleno',
  staff: 'Usuário Pleno',
  operador: 'Operador',
  client: 'Cliente',
};

export function formatActivityAmount(amount: unknown, currency?: string | null): string {
  const n = Number(amount);
  if (amount === null || amount === undefined || amount === '' || !Number.isFinite(n)) return '';
  const cur = String(currency || 'EUR').toUpperCase();
  try {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: cur }).format(n);
  } catch {
    return `${n.toFixed(2)} ${cur}`;
  }
}

/** Título e descrição curtos de cada evento (texto em português). */
export function describeActivityEvent(e: OrgActivityEvent): { title: string; description: string } {
  const who = e.person_name || e.person_email || 'Sem nome';
  if (e.event_type === 'payment_paid') {
    const amount = formatActivityAmount(e.amount, e.currency);
    const parts = [who, e.protocolo ? `processo ${e.protocolo}` : '', amount].filter(Boolean);
    return { title: 'Novo pagamento recebido', description: parts.join(' · ') };
  }
  const role = ROLE_LABELS[String(e.member_role ?? '')] ?? '';
  const parts = [who, e.person_email && e.person_email !== who ? e.person_email : '', role].filter(Boolean);
  return { title: 'Novo utilizador', description: parts.join(' · ') };
}
