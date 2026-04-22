import type { OrgRole } from '../../types';

export type SystemHierarchy = 'admin' | 'senior' | 'pleno' | 'operador' | 'cliente';

export type PermissionCapabilities = {
  canViewOrganizations: boolean;
  canManageOrganizations: boolean;
  canManageMembers: boolean;
  canManageClients: boolean;
  canOperateProcesses: boolean;
  canAccessSettings: boolean;
  canViewFinancial: boolean;
};

export type HierarchyMappingFlags = {
  profileRole?: string | null;
  hierarchy?: string | null;
  isSenior?: boolean | null;
  isPleno?: boolean | null;
  isOperador?: boolean | null;
  isCliente?: boolean | null;
  isAdmin?: boolean | null;
};

const normalizeHierarchyValue = (value?: string | null): SystemHierarchy | null => {
  if (!value) return null;

  const normalized = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

  if (['admin', 'administrador', 'owner'].includes(normalized)) return 'admin';
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

  const normalizedOrgRole = (orgRole || '').toString().trim().toLowerCase();

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

export function getCapabilitiesForHierarchy(hierarchy: SystemHierarchy): PermissionCapabilities {
  return CAPABILITIES_BY_HIERARCHY[hierarchy];
}

export function resolvePermissions(orgRole?: OrgRole | string | null, flags: HierarchyMappingFlags = {}) {
  const hierarchy = mapToSystemHierarchy(orgRole, flags);
  const capabilities = getCapabilitiesForHierarchy(hierarchy);

  return {
    hierarchy,
    capabilities,
    isAdminHierarchy: hierarchy === 'admin',
  };
}

export function hierarchyToOrgRole(hierarchy: SystemHierarchy): OrgRole {
  if (hierarchy === 'admin' || hierarchy === 'senior') return 'admin';
  if (hierarchy === 'pleno' || hierarchy === 'operador') return 'staff';
  return 'client';
}
