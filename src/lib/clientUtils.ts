export type AccessLevel = 'Administrador' | 'Usuário Sênior' | 'Usuário Pleno' | 'Operador' | 'Cliente';

export interface ClientProfileView {
  id: string;
  user_id: string;
  org_id: string;
  org_name: string;
  nome: string;
  email: string;
  accessLevel: AccessLevel;
  source: 'org_members+profiles' | 'org_members_only' | 'local_manual';
  created_at?: string;
}

export interface NewClientFormState {
  fullName: string;
  email: string;
  phone: string;
  documentId: string;
  taxId: string;
  address: string;
  country: string;
  maritalStatus: string;
  organizationId: string;
  accessLevel: AccessLevel;
}

export interface EditClientFormState {
  fullName: string;
  email: string;
  phone: string;
  documentId: string;
  taxId: string;
  address: string;
  country: string;
  maritalStatus: string;
  organizationId: string;
  accessLevel: AccessLevel;
}

export const sanitizeDisplayValue = (value: string | null | undefined) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
};

export const mapOrgRoleToAccessLevel = (role: string | null | undefined): AccessLevel => {
  if (!role) return 'Cliente';
  if (role === 'owner' || role === 'admin') return 'Administrador';
  if (role === 'senior') return 'Usuário Sênior';
  if (role === 'pleno' || role === 'staff') return 'Usuário Pleno';
  if (role === 'operador') return 'Operador';
  return 'Cliente';
};

export const mapAccessLevelToOrgRole = (level: AccessLevel): string => {
  if (level === 'Administrador') return 'admin';
  if (level === 'Usuário Sênior') return 'senior';
  if (level === 'Usuário Pleno') return 'pleno';
  if (level === 'Operador') return 'operador';
  return 'client';
};

export const ACCESS_LEVELS: AccessLevel[] = ['Administrador', 'Usuário Sênior', 'Usuário Pleno', 'Operador', 'Cliente'];

export const extractOrganizationName = (
  organizations: { name?: string } | Array<{ name?: string }> | null | undefined
) => {
  if (Array.isArray(organizations)) {
    return sanitizeDisplayValue(organizations[0]?.name) || null;
  }
  return sanitizeDisplayValue(organizations?.name) || null;
};
