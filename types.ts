/**
 * SGI FV - Type Definitions
 * Sistema de Gestão Integrada - Formando Valores
 */

// ============================================
// ENUMS
// ============================================

export enum ServiceUnit {
  JURIDICO = 'JURÍDICO / ADVOCACIA',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  TECNOLOGICO = 'TECNOLÓGICO / AI'
}

export enum ProcessStatus {
  PENDENTE = 'CADASTRO',
  TRIAGEM = 'TRIAGEM',
  ANALISE = 'ANÁLISE',
  CONCLUIDO = 'CONCLUÍDO'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  CLIENT = 'CLIENT',
  MANAGER = 'MANAGER'
}

export enum Hierarchy {
  FULL = 'Alteração e Edição',
  STATUS_ONLY = 'Somente Alteração',
  NOTES_ONLY = 'Somente Anotações'
}


export enum AccessLevel {
  GENERAL_ADMIN = 'ADMINISTRADOR GERAL',
  SENIOR_USER = 'USUÁRIO SÊNIOR',
  PLENO_USER = 'USUÁRIO PLENO',
  CLIENT = 'CLIENTE'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  accessLevel?: AccessLevel;
  documentId: string;
  taxId: string;
  address: string;
  maritalStatus: string;
  country: string;
  phone: string;
  processNumber?: string;
  unit: ServiceUnit;
  status: ProcessStatus;
  protocol: string;
  registrationDate: string;
  lastUpdate?: string;
  hierarchy?: Hierarchy;
  notes?: string;
  deadline?: string;
  serviceManager?: string; // Novo campo: Gestor do Serviço
  organizationId?: string;
  organizationName?: string;
}

export interface Organization {
  id: string;
  name: string;
  createdAt?: string;
  subscriptionExpiresAt?: string;
  slug?: string;
  active?: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Converte UserContext para User legacy (compatibilidade)
 */
export function userContextToLegacyUser(ctx: UserContext): User {
  return {
    id: ctx.id,
    name: ctx.nome_completo,
    email: ctx.email,
    role: ctx.role === 'admin' || ctx.role === 'owner' ? UserRole.ADMIN : UserRole.CLIENT,
    documentId: ctx.profile?.documento_identidade || '',
    taxId: ctx.profile?.nif_cpf || '',
    address: ctx.profile?.endereco || '',
    maritalStatus: ctx.profile?.estado_civil || '',
    country: ctx.profile?.pais || '',
    phone: ctx.profile?.phone || '',
    unit: ServiceUnit.JURIDICO,
    status: ProcessStatus.PENDENTE,
    protocol: '',
    registrationDate: ctx.profile?.created_at || new Date().toISOString(),
    org_id: ctx.org_id,
    org_slug: ctx.org_slug,
    org_name: ctx.org_name,
    org_role: ctx.role
  };
}

/**
 * Verifica se o usuário tem permissão de admin
 */
export function isAdmin(user: User | UserContext): boolean {
  if ('org_role' in user && user.org_role) {
    return user.org_role === 'admin' || user.org_role === 'owner';
  }
  if ('role' in user) {
    if (typeof user.role === 'string') {
      return user.role === 'admin' || user.role === 'owner' || user.role === 'ADMIN';
    }
    return user.role === UserRole.ADMIN;
  }
  return false;
}

// ============================================
// OTHER TYPES
// ============================================

export interface TimelineEntry {
  date: string;
  description: string;
}

export interface Country {
  name: string;
  code: string;
  flag: string;
}
