import type { CapabilityMap, OrgRole, User, UserContext } from '../../types';

export type SystemHierarchy = 'admin' | 'senior' | 'pleno' | 'operador' | 'cliente';

export type PermissionModule = 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes' | 'financeiro' | 'relatorios';
export type PermissionAction = 'view' | 'view_own' | 'view_all' | 'create' | 'update' | 'delete' | 'manage';
export type PermissionScope = PermissionModule;

export type PermissionCapabilities = CapabilityMap;

export type HierarchyMappingFlags = {
  profileRole?: string | null;
  hierarchy?: string | null;
  isSenior?: boolean | null;
  isPleno?: boolean | null;
  isOperador?: boolean | null;
  isCliente?: boolean | null;
  isAdmin?: boolean | null;
};

type PermissionMatrix = {
  modules: PermissionModule[];
  actionsByScope: Partial<Record<PermissionScope, PermissionAction[]>>;
};

type PermissionSubject =
  | Pick<UserContext, 'role' | 'profile_role' | 'hierarchy' | 'org_id' | 'id'>
  | Pick<User, 'role' | 'org_role' | 'organizationId' | 'id'>
  | {
      id?: string | null;
      role?: OrgRole | string | null;
      org_role?: OrgRole | string | null;
      hierarchy?: SystemHierarchy | string | null;
      profileRole?: string | null;
      profile_role?: string | null;
      org_id?: string | null;
      organizationId?: string | null;
    };

export type DataScope = {
  orgId: string | null;
  userId: string | null;
  restrictToOwnUser: boolean;
};

export type ReportScope = DataScope & {
  canViewGlobalOrganizations: boolean;
  restrictToResponsibleUser: boolean;
};

const normalizeText = (value?: string | null): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

const normalizeHierarchyValue = (value?: string | null): SystemHierarchy | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (['admin', 'administrador', 'administrator', 'owner'].includes(normalized)) return 'admin';
  if (['senior', 'usuario senior', 'usuário sênior'].includes(normalized)) return 'senior';
  if (['pleno', 'usuario pleno', 'usuário pleno', 'staff'].includes(normalized)) return 'pleno';
  if (['operador', 'operator'].includes(normalized)) return 'operador';
  if (['cliente', 'client'].includes(normalized)) return 'cliente';

  return null;
};

export function mapToSystemHierarchy(orgRole?: OrgRole | string | null, flags: HierarchyMappingFlags = {}): SystemHierarchy {
  if (flags.isAdmin) return 'admin';
  if (flags.isSenior) return 'senior';
  if (flags.isPleno) return 'pleno';
  if (flags.isOperador) return 'operador';
  if (flags.isCliente) return 'cliente';

  const explicitHierarchy = normalizeHierarchyValue(flags.hierarchy) || normalizeHierarchyValue(flags.profileRole);
  if (explicitHierarchy) return explicitHierarchy;

  const normalizedOrgRole = normalizeText(orgRole?.toString());

  if (normalizedOrgRole === 'owner' || normalizedOrgRole === 'admin') return 'admin';
  if (normalizedOrgRole === 'staff') return 'pleno';

  return 'cliente';
}

const CAPABILITIES_BY_HIERARCHY: Record<SystemHierarchy, PermissionCapabilities> = {
  admin: {
    canViewOrganizations: true,
    canManageOrganizations: true,
    canManageMembers: true,
    canManageClients: true,
    canOperateProcesses: true,
    canAccessSettings: true,
    canViewFinancial: true,
  },
  senior: {
    canViewOrganizations: true,
    canManageOrganizations: false,
    canManageMembers: true,
    canManageClients: true,
    canOperateProcesses: true,
    canAccessSettings: true,
    canViewFinancial: true,
  },
  pleno: {
    canViewOrganizations: true,
    canManageOrganizations: false,
    canManageMembers: false,
    canManageClients: true,
    canOperateProcesses: true,
    canAccessSettings: false,
    canViewFinancial: true,
  },
  operador: {
    canViewOrganizations: false,
    canManageOrganizations: false,
    canManageMembers: false,
    canManageClients: false,
    canOperateProcesses: true,
    canAccessSettings: false,
    canViewFinancial: false,
  },
  cliente: {
    canViewOrganizations: false,
    canManageOrganizations: false,
    canManageMembers: false,
    canManageClients: false,
    canOperateProcesses: false,
    canAccessSettings: false,
    canViewFinancial: true,
  },
};

const PERMISSION_MATRIX_BY_HIERARCHY: Record<SystemHierarchy, PermissionMatrix> = {
  admin: {
    modules: ['dashboard', 'processos', 'clientes', 'configuracoes', 'organizacoes', 'financeiro', 'relatorios'],
    actionsByScope: {
      dashboard: ['view', 'view_all'],
      processos: ['view', 'view_all', 'create', 'update', 'delete', 'manage'],
      clientes: ['view', 'view_all', 'create', 'update', 'delete', 'manage'],
      configuracoes: ['view', 'manage'],
      organizacoes: ['view', 'view_all', 'create', 'update', 'delete', 'manage'],
      financeiro: ['view', 'view_all', 'manage'],
      relatorios: ['view', 'view_all'],
    },
  },
  senior: {
    modules: ['dashboard', 'processos', 'clientes', 'configuracoes', 'financeiro', 'relatorios'],
    actionsByScope: {
      dashboard: ['view', 'view_all'],
      processos: ['view', 'view_all', 'create', 'update', 'manage'],
      clientes: ['view', 'view_all', 'create', 'update', 'manage'],
      configuracoes: ['view', 'manage'],
      financeiro: ['view', 'view_all'],
      relatorios: ['view', 'view_all'],
    },
  },
  pleno: {
    modules: ['dashboard', 'processos', 'clientes', 'financeiro', 'relatorios'],
    actionsByScope: {
      dashboard: ['view'],
      processos: ['view', 'create', 'update', 'manage'],
      clientes: ['view', 'create', 'update', 'manage'],
      financeiro: ['view'],
      relatorios: ['view'],
    },
  },
  operador: {
    modules: ['dashboard', 'processos', 'relatorios'],
    actionsByScope: {
      dashboard: ['view'],
      processos: ['view', 'update'],
      relatorios: ['view'],
    },
  },
  cliente: {
    modules: ['dashboard', 'processos', 'financeiro', 'relatorios'],
    actionsByScope: {
      dashboard: ['view_own'],
      processos: ['view_own', 'update'],
      financeiro: ['view_own', 'update'],
      relatorios: ['view_own', 'update'],
    },
  },
};

export function getAuthorizationDeniedMessage(action: PermissionAction, scope: PermissionScope): string {
  return `Permissão negada: seu perfil/escopo não permite ${action} em ${scope}.`;
}

function resolveHierarchyFromSubject(subject?: PermissionSubject | null): SystemHierarchy {
  if (!subject) return 'cliente';

  const hierarchy = 'hierarchy' in subject ? normalizeHierarchyValue(subject.hierarchy) : null;
  if (hierarchy) return hierarchy;

  const orgRole =
    ('org_role' in subject ? subject.org_role : null) ||
    ('role' in subject ? subject.role : null);

  return mapToSystemHierarchy(orgRole as OrgRole | string | null, {
    profileRole:
      ('profileRole' in subject ? subject.profileRole : null) ||
      ('profile_role' in subject ? subject.profile_role : null),
  });
}

export function getCapabilitiesForHierarchy(hierarchy: SystemHierarchy): PermissionCapabilities {
  return CAPABILITIES_BY_HIERARCHY[hierarchy];
}

export function getAllowedModules(subject?: PermissionSubject | null): PermissionModule[] {
  const hierarchy = resolveHierarchyFromSubject(subject);
  return PERMISSION_MATRIX_BY_HIERARCHY[hierarchy].modules;
}

export function can(action: PermissionAction, scope: PermissionScope, subject?: PermissionSubject | null): boolean {
  const hierarchy = resolveHierarchyFromSubject(subject);
  const allowedActions = PERMISSION_MATRIX_BY_HIERARCHY[hierarchy].actionsByScope[scope] || [];

  if (allowedActions.includes(action)) return true;
  if (allowedActions.includes('manage')) return ['view', 'view_all', 'create', 'update', 'delete', 'manage'].includes(action);
  if (allowedActions.includes('view_all') && (action === 'view' || action === 'view_own')) return true;
  if (allowedActions.includes('view') && action === 'view_own') return true;

  return false;
}

export function resolvePermissions(orgRole?: OrgRole | string | null, flags: HierarchyMappingFlags = {}) {
  const hierarchy = mapToSystemHierarchy(orgRole, flags);
  const capabilities = getCapabilitiesForHierarchy(hierarchy);

  return {
    hierarchy,
    capabilities,
    isAdminHierarchy: hierarchy === 'admin',
    modules: getAllowedModules({ hierarchy }),
  };
}

export function hierarchyToOrgRole(hierarchy: SystemHierarchy): OrgRole {
  if (hierarchy === 'admin' || hierarchy === 'senior') return 'admin';
  if (hierarchy === 'pleno' || hierarchy === 'operador') return 'staff';
  return 'client';
}

export function getNavigationModules(subject?: PermissionSubject | null): PermissionModule[] {
  return getAllowedModules(subject).filter((module) => module !== 'financeiro');
}

export function getProcessScope(subject?: PermissionSubject | null): DataScope {
  const hierarchy = resolveHierarchyFromSubject(subject);
  const orgId = ('org_id' in (subject || {}) ? subject?.org_id : null) || ('organizationId' in (subject || {}) ? subject?.organizationId : null) || null;
  const userId = ('id' in (subject || {}) ? subject?.id : null) || null;

  return {
    orgId,
    userId,
    restrictToOwnUser: hierarchy === 'cliente',
  };
}

export function getReportScope(subject?: PermissionSubject | null): ReportScope {
  const hierarchy = resolveHierarchyFromSubject(subject);
  const baseScope = getProcessScope(subject);
  const canViewGlobalOrganizations = hierarchy === 'admin';
  const canViewAllReports = can('view_all', 'relatorios', subject);

  return {
    ...baseScope,
    canViewGlobalOrganizations,
    restrictToResponsibleUser: !canViewAllReports,
  };
}
