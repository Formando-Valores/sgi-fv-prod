import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Pencil, Search, Users, Loader2 } from 'lucide-react';
import { supabase } from '../../../../supabase';
import type { User, Organization } from '../../../../types';
import { ProcessStatus, ServiceUnit, Hierarchy, UserRole } from '../../../../types';
import { sanitizeDisplayValue, mapOrgRoleToAccessLevel, mapAccessLevelToOrgRole, extractOrganizationName, ACCESS_LEVELS, type AccessLevel } from '../../../lib/clientUtils';
import { SUPABASE_EDGE_FUNCTIONS } from '../../../lib/supabaseFunctions';
import { useToast } from '../../../contexts/ToastContext';
import { TableSkeleton } from '../../ui/Skeleton';

interface OrgMemberView {
  user_id: string;
  org_id: string;
  org_name: string;
  name: string;
  email: string;
  accessLevel: AccessLevel;
  source: 'org_members' | 'profiles';
}

type OrgMemberRow = {
  org_id: string;
  user_id: string;
  role: string;
  nome_completo?: string | null;
  nome?: string | null;
  name?: string | null;
  full_name?: string | null;
  organizations?: { name?: string } | Array<{ name?: string }> | null;
};

type ProfileRow = {
  id: string;
  org_id?: string | null;
  role?: string | null;
  email?: string | null;
  nome_completo?: string | null;
  nome?: string | null;
  name?: string | null;
  organizations?: { name?: string } | Array<{ name?: string }> | null;
};

const DEFAULT_ORGANIZATION_NAME_KEYWORDS = ['central', 'default', 'padr', 'todas'];

const normalizeText = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const isDefaultOrganizationName = (name: string | undefined | null) => {
  if (!name) return false;
  const normalized = normalizeText(name);
  return DEFAULT_ORGANIZATION_NAME_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const resolveAccessLevel = (role: string | null | undefined): AccessLevel => {
  if (!role) return 'Cliente';
  const normalized = sanitizeDisplayValue(role).toLowerCase();
  if (normalized === 'administrador' || normalized === 'admin' || normalized === 'owner') return 'Administrador';
  if (normalized === 'usuário sênior' || normalized === 'usuario senior' || normalized === 'senior') return 'Usuário Sênior';
  if (normalized === 'usuário pleno' || normalized === 'usuario pleno' || normalized === 'pleno' || normalized === 'staff') return 'Usuário Pleno';
  if (normalized === 'operador') return 'Operador';
  return 'Cliente';
};

interface ManagementSectionProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  organizations: Organization[];
  currentUser: User;
}

const ManagementSection: React.FC<ManagementSectionProps> = ({ users, setUsers, organizations, currentUser }) => {
  const { showToast } = useToast();
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAccessLevel, setNewAccessLevel] = useState<AccessLevel>('Usuário Sênior');
  const [newAdminOrgId, setNewAdminOrgId] = useState('');
  const [orgMembers, setOrgMembers] = useState<OrgMemberView[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [editingMemberUserId, setEditingMemberUserId] = useState<string | null>(null);

  const [userCreationStatus, setUserCreationStatus] = useState<string | null>(null);
  const [configSearch, setConfigSearch] = useState('');
  const [configRowsLimit, setConfigRowsLimit] = useState(10);
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const createUserFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingMemberUserId && createUserFormRef.current) {
      createUserFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editingMemberUserId]);

  useEffect(() => {
    if (organizations.length > 0 && !newAdminOrgId) {
      const defaultOrg = organizations.find((org) => String(org.slug || '').toLowerCase() === 'default')
        || organizations.find((org) => org.name?.toLowerCase().includes('padr'))
        || organizations[0];
      if (defaultOrg?.id) setNewAdminOrgId(defaultOrg.id);
    }
  }, [organizations, newAdminOrgId]);

  useEffect(() => {
    void fetchOrgMembers();
  }, []);

  const resolveOrganizationScope = async () => {
    const { data, error } = await supabase
      .from('org_members')
      .select('org_id,role,organizations(name,slug)')
      .eq('user_id', currentUser.id);

    if (error) {
      return { allowedOrgIds: new Set<string>(), hasGlobalScope: false, error };
    }

    const scopeRows = (data || []) as Array<{
      org_id: string;
      role?: string | null;
      organizations?: { name?: string | null; slug?: string | null } | Array<{ name?: string | null; slug?: string | null }> | null;
    }>;

    const allowedOrgIds = new Set(scopeRows.map((row) => row.org_id).filter(Boolean));
    const hasGlobalScope = scopeRows.some((row) => {
      const normalizedRole = sanitizeDisplayValue(row.role).toLowerCase();
      if (!['owner', 'admin'].includes(normalizedRole)) return false;
      const organizationsValue = row.organizations;
      const firstOrg = Array.isArray(organizationsValue) ? organizationsValue[0] : organizationsValue;
      const orgSlug = sanitizeDisplayValue(firstOrg?.slug).toLowerCase();
      const orgName = sanitizeDisplayValue(firstOrg?.name);
      return orgSlug === 'default' || isDefaultOrganizationName(orgName);
    });

    return { allowedOrgIds, hasGlobalScope, error: null as null };
  };

  const fetchOrgMembers = async () => {
    setMembersLoading(true);
    setMembersError('');

    const { allowedOrgIds, hasGlobalScope, error: scopeError } = await resolveOrganizationScope();
    if (scopeError) {
      setMembersError('Não foi possível validar o escopo de membros da organização.');
      setMembersLoading(false);
      return;
    }
    if (!hasGlobalScope && allowedOrgIds.size === 0) {
      setOrgMembers([]);
      setMembersLoading(false);
      return;
    }

    const orgMemberSelectOptions = [
      'org_id,user_id,role,nome_completo,nome,name,full_name,organizations(name)',
      'org_id,user_id,role,organizations(name)',
      'org_id,user_id,role',
    ];

    let memberRows: OrgMemberRow[] | null = null;
    let memberError: { message?: string } | null = null;

    for (const selectFields of orgMemberSelectOptions) {
      const queryBuilder = supabase
        .from('org_members')
        .select(selectFields)
        .order('created_at', { ascending: false });
      const query = !hasGlobalScope
        ? await queryBuilder.in('org_id', Array.from(allowedOrgIds))
        : await queryBuilder;

      if (!query.error) {
        memberRows = query.data as unknown as OrgMemberRow[] | null;
        memberError = null;
        break;
      }
      memberError = query.error;
    }

    if (memberError) {
      setMembersError('Não foi possível carregar os membros da organização.');
      setMembersLoading(false);
      return;
    }

    const memberUserIds = Array.from(new Set((memberRows || []).map((row) => row.user_id)));
    let profileMap = new Map<string, { nome_completo?: string | null; nome?: string | null; name?: string | null; email?: string | null; role?: string | null }>();

    if (memberUserIds.length > 0) {
      const profileSelectOptions = [
        'id,nome_completo,nome,name,email,role',
        'id,nome_completo,name,email,role',
        'id,nome_completo,email,role',
        'id,email,role',
      ];

      for (const selectFields of profileSelectOptions) {
        const profileQuery = await supabase
          .from('profiles')
          .select(selectFields)
          .in('id', memberUserIds);

        if (!profileQuery.error) {
          const rows = (profileQuery.data || []) as unknown as Array<{ id: string; nome_completo?: string | null; nome?: string | null; name?: string | null; email?: string | null; role?: string | null }>;
          profileMap = new Map(rows.map((profile) => [profile.id, profile]));
          break;
        }
      }
    }

    const normalizedMembersFromMembership: OrgMemberView[] = (memberRows || []).map((member) => {
      const profile = profileMap.get(member.user_id);
      const fallbackUser = users.find((user) => user.id === member.user_id);
      const nameFromMemberRow =
        sanitizeDisplayValue(member.nome_completo) ||
        sanitizeDisplayValue(member.full_name) ||
        sanitizeDisplayValue(member.name) ||
        sanitizeDisplayValue(member.nome);
      const roleFromProfile = typeof profile?.role === 'string' ? profile.role : null;
      const accessLevelFromMembership = mapOrgRoleToAccessLevel(member.role);
      const accessLevelFromProfile = roleFromProfile ? resolveAccessLevel(roleFromProfile) : null;

      const accessLevel =
        accessLevelFromMembership !== 'Cliente'
          ? accessLevelFromMembership
          : accessLevelFromProfile || 'Cliente';

      const resolvedEmail = sanitizeDisplayValue(profile?.email) || sanitizeDisplayValue(fallbackUser?.email) || '';
      const resolvedName =
        nameFromMemberRow ||
        sanitizeDisplayValue(profile?.nome_completo) ||
        sanitizeDisplayValue(profile?.name) ||
        sanitizeDisplayValue(profile?.nome) ||
        sanitizeDisplayValue(fallbackUser?.name) ||
        (resolvedEmail ? resolvedEmail.split('@')[0] : '') ||
        `Usuário ${member.user_id.slice(0, 8)}`;

      return {
        user_id: member.user_id,
        org_id: member.org_id,
        org_name: extractOrganizationName(member.organizations) || 'Organização Padrão',
        name: resolvedName,
        email: resolvedEmail || '-',
        accessLevel,
        source: 'org_members' as const,
      };
    });

    const profileSelectOptions = [
      'id,org_id,role,email,nome_completo,nome,name,organizations(name)',
      'id,org_id,role,email,nome_completo,name,organizations(name)',
      'id,org_id,role,email,nome_completo,nome,name',
      'id,org_id,role,email,nome_completo,name',
      'id,org_id,role,email,nome_completo',
      'id,org_id,role,email',
    ];

    let profileRows: ProfileRow[] | null = null;
    let allProfilesError: { message?: string } | null = null;

    for (const selectFields of profileSelectOptions) {
      const queryBuilder = supabase
        .from('profiles')
        .select(selectFields)
        .order('created_at', { ascending: false });
      const query = !hasGlobalScope
        ? await queryBuilder.in('org_id', Array.from(allowedOrgIds))
        : await queryBuilder;

      if (!query.error) {
        profileRows = (query.data as unknown as ProfileRow[] | null) || [];
        allProfilesError = null;
        break;
      }
      allProfilesError = query.error;
    }

    if (allProfilesError) {
      console.warn('[configuracoes] não foi possível carregar profiles completos; exibindo apenas org_members', allProfilesError);
    }

    const membershipKeys = new Set(normalizedMembersFromMembership.map((member) => `${member.org_id}-${member.user_id}`));
    const userIdsWithMembership = new Set(normalizedMembersFromMembership.map((member) => member.user_id));

    let defaultOrgId = newAdminOrgId || organizations[0]?.id || '';
    let defaultOrgName = organizations.find((org) => org.id === defaultOrgId)?.name || 'Organização Padrão';

    if (!defaultOrgId) {
      const { data: fallbackOrganizations, error: fallbackOrganizationsError } = await supabase
        .from('organizations')
        .select('id,name,slug')
        .order('created_at', { ascending: true });

      if (!fallbackOrganizationsError && (fallbackOrganizations || []).length > 0) {
        const defaultOrg =
          (fallbackOrganizations || []).find((org) => String(org.slug || '').toLowerCase() === 'default') ||
          (fallbackOrganizations || []).find((org) => String(org.name || '').toLowerCase().includes('padr')) ||
          fallbackOrganizations?.[0];

        if (defaultOrg?.id) {
          defaultOrgId = defaultOrg.id;
          defaultOrgName = defaultOrg.name || defaultOrgName;
          if (!newAdminOrgId) {
            setNewAdminOrgId(defaultOrg.id);
          }
        }
      }
    }

    const profileOnlyMembers: OrgMemberView[] = (((allProfilesError ? [] : profileRows) || []) as ProfileRow[])
      .filter((profile) => Boolean(profile.id))
      .map((profile) => {
        const orgId = sanitizeDisplayValue(profile.org_id) || 'sem-org';
        return { profile, key: `${orgId}-${profile.id}` };
      })
      .filter(({ key, profile }) => !membershipKeys.has(key) && !userIdsWithMembership.has(profile.id))
      .map(({ profile }) => {
        const fallbackUser = users.find((user) => user.id === profile.id);
        const resolvedEmail = sanitizeDisplayValue(profile.email) || sanitizeDisplayValue(fallbackUser?.email) || '-';
        const resolvedName =
          sanitizeDisplayValue(profile.nome_completo) ||
          sanitizeDisplayValue(profile.name) ||
          sanitizeDisplayValue(profile.nome) ||
          sanitizeDisplayValue(fallbackUser?.name) ||
          (resolvedEmail !== '-' ? resolvedEmail.split('@')[0] : '') ||
          `Usuário ${profile.id.slice(0, 8)}`;

        return {
          user_id: profile.id,
          org_id: sanitizeDisplayValue(profile.org_id) || defaultOrgId,
          org_name: extractOrganizationName(profile.organizations) || defaultOrgName,
          name: resolvedName,
          email: resolvedEmail,
          accessLevel: resolveAccessLevel(profile.role),
          source: 'profiles' as const,
        };
      });

    setOrgMembers([...normalizedMembersFromMembership, ...profileOnlyMembers]);
    setMembersLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName) return;

    const selectedOrg = organizations.find((org) => org.id === newAdminOrgId);
    if (!selectedOrg) {
      showToast({ type: 'error', message: 'Selecione uma organização válida.' });
      return;
    }
    const selectedOrgName = selectedOrg?.name || 'Organização Padrão';

    let targetUserId = editingMemberUserId;
    const normalizedEmail = sanitizeDisplayValue(newAdminEmail);
    const shouldLookupProfileByEmail = !targetUserId && normalizedEmail && normalizedEmail !== '-';

    setUserCreationStatus('Verificando email...');

    let existingProfile: { id?: string; email?: string | null } | null = null;
    let profileLookupError: { message?: string } | null = null;

    if (shouldLookupProfileByEmail) {
      const lookupResult = await supabase
        .from('profiles')
        .select('id,email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      existingProfile = lookupResult.data;
      profileLookupError = lookupResult.error;
    }

    if (profileLookupError) {
      setUserCreationStatus(null);
      showToast({ type: 'error', message: 'Erro ao buscar usuário no banco. Tente novamente.' });
      return;
    }

    if (existingProfile?.id && !editingMemberUserId) {
      showToast({ type: 'info', message: `O email ${normalizedEmail} já possui cadastro. O usuário será vinculado à organização atual.` });
    }

    if (newAdminPassword) {
      const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
      const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
      if (!supabaseUrl || !anonKey) {
        setUserCreationStatus(null);
        showToast({ type: 'error', message: 'Erro de configuração do ambiente.' });
        return;
      }
      setUserCreationStatus('Criando conta no sistema…');
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${SUPABASE_EDGE_FUNCTIONS.CREATE_USER}`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: normalizedEmail,
            password: newAdminPassword,
            name: sanitizeDisplayValue(newAdminName),
            role: newAccessLevel,
            org_id: newAdminOrgId,
            unit: ServiceUnit.ADMINISTRATIVO,
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          setUserCreationStatus(null);
          showToast({ type: 'error', message: `Erro ao criar usuário: ${result.error || 'desconhecido'}` });
          return;
        }
        targetUserId = result.user_id;
        if (result.process_warning) {
          showToast({ type: 'warning', message: `Atenção: ${result.process_warning}` });
        }
        setNewAdminPassword('');
      } catch (fetchErr: any) {
        setUserCreationStatus(null);
        showToast({ type: 'error', message: `Erro ao comunicar com o servidor: ${fetchErr?.message || 'desconhecido'}` });
        return;
      }
    } else if (!targetUserId && !existingProfile?.id) {
      setUserCreationStatus(null);
      showToast({ type: 'error', message: 'Usuário não encontrado no sistema. Informe uma senha para criar um novo cadastro.' });
      return;
    }

    targetUserId = targetUserId || existingProfile?.id || null;

    if (!targetUserId) {
      setUserCreationStatus(null);
      showToast({ type: 'error', message: 'Não foi possível identificar o usuário selecionado para atualização.' });
      return;
    }

    setUserCreationStatus('Vinculando à organização…');

    const orgRole = mapAccessLevelToOrgRole(newAccessLevel);

    await supabase.from('org_members').delete().eq('user_id', targetUserId);

    const { error: upsertMemberError } = await supabase
      .from('org_members')
      .insert(
        { org_id: newAdminOrgId, user_id: targetUserId, role: orgRole }
      );

    let membershipWarning = '';

    if (upsertMemberError) {
      const errorMessage = String(upsertMemberError.message || '').toLowerCase();
      const errorCode = String((upsertMemberError as { code?: string }).code || '').toLowerCase();
      const errorStatus = String((upsertMemberError as { status?: number }).status || '');

      const isPermissionError =
        errorStatus === '403' ||
        errorCode === '42501' ||
        errorMessage.includes('permission denied') ||
        errorMessage.includes('row-level security') ||
        errorMessage.includes('not allowed');

      if (isPermissionError) {
        membershipWarning = 'Nível atualizado no perfil, mas o vínculo em org_members foi bloqueado por permissão.';
      } else {
        setUserCreationStatus(null);
        showToast({ type: 'error', message: 'Erro ao salvar vínculo na tabela org_members.' });
        return;
      }
    }

    setUserCreationStatus('Atualizando perfil…');

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        nome_completo: sanitizeDisplayValue(newAdminName),
        name: sanitizeDisplayValue(newAdminName),
        role: newAccessLevel,
        org_id: newAdminOrgId,
      })
      .eq('id', targetUserId);

    if (profileUpdateError) {
      console.warn('handleCreateUser: profiles.update() falhou —', profileUpdateError.message);
    }

    setUserCreationStatus('Finalizando…');

    setUsers((prev) => {
      const found = prev.find((user) => user.id === targetUserId || user.email === normalizedEmail);
      const role = newAccessLevel === 'Administrador' ? UserRole.ADMIN : UserRole.CLIENT;

      if (found) {
        return prev.map((user) =>
          user.id === found.id
            ? { ...user, name: sanitizeDisplayValue(newAdminName) || user.name, role, hierarchy: Hierarchy.FULL, organizationId: newAdminOrgId, organizationName: selectedOrgName }
            : user
        );
      }

      const newUser: User = {
        id: targetUserId,
        name: sanitizeDisplayValue(newAdminName) || 'Usuário',
        email: normalizedEmail || '-',
        role,
        hierarchy: Hierarchy.FULL,
        documentId: '---',
        taxId: '---',
        address: '---',
        maritalStatus: '---',
        country: '---',
        phone: '---',
        unit: ServiceUnit.ADMINISTRATIVO,
        status: ProcessStatus.PENDENTE,
        protocol: `USR-2026-000`,
        registrationDate: new Date().toLocaleString('pt-BR'),
        lastUpdate: new Date().toLocaleString('pt-BR'),
        organizationId: newAdminOrgId,
        organizationName: selectedOrgName,
      };
      return [...prev, newUser];
    });

    setNewAdminEmail('');
    setNewAdminName('');
    setNewAdminPassword('');
    setNewAdminOrgId(selectedOrg.id);
    setNewAccessLevel('Usuário Sênior');
    setEditingMemberUserId(null);
    setUserCreationStatus(null);
    await fetchOrgMembers();
    showToast({ type: membershipWarning ? 'warning' : 'success', message: membershipWarning || 'Membro cadastrado/atualizado com sucesso.' });
  };

  const handleDeleteMember = async (member: OrgMemberView) => {
    if (!window.confirm('Deseja realmente remover este membro da organização?')) return;
    const fallbackEmail = sanitizeDisplayValue(member.email) || 'sem-email';

    const { data: profileBeforeDelete } = await supabase
      .from('profiles')
      .select('id,email')
      .eq('id', member.user_id)
      .maybeSingle();

    const memberEmail = sanitizeDisplayValue(profileBeforeDelete?.email) || fallbackEmail;

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', member.user_id)
      .maybeSingle();

    const { data: existingMembership } = await supabase
      .from('org_members')
      .select('user_id')
      .eq('org_id', member.org_id)
      .eq('user_id', member.user_id)
      .maybeSingle();

    if (!existingProfile && !existingMembership) {
      showToast({ type: 'warning', message: `O usuário ${memberEmail} já não possui cadastro no banco. A listagem foi atualizada.` });
      await fetchOrgMembers();
      return;
    }

    let rpcMissingFunction = false;

    const { error: hardDeleteError } = await supabase.rpc('delete_user_completely', {
      target_user_id: member.user_id,
    });

    if (hardDeleteError) {
      const rpcStatus = String((hardDeleteError as { status?: number }).status || '');
      const rpcCode = String((hardDeleteError as { code?: string }).code || '').toLowerCase();
      const rpcMessage = String(hardDeleteError.message || '').toLowerCase();

      const rpcMissing =
        rpcStatus === '404' ||
        rpcCode.includes('pgrst202') ||
        rpcMessage.includes('delete_user_completely') ||
        rpcMessage.includes('function') ||
        rpcMessage.includes('not found');

      if (rpcMissing) {
        rpcMissingFunction = true;
      }
    }

    if (!hardDeleteError) {
      const { data: profileStillExistsAfterRpc } = await supabase
        .from('profiles')
        .select('id')
        .or(`id.eq.${member.user_id},email.eq.${memberEmail}`)
        .limit(1)
        .maybeSingle();

      const { data: membershipStillExistsAfterRpc } = await supabase
        .from('org_members')
        .select('user_id')
        .eq('user_id', member.user_id)
        .limit(1)
        .maybeSingle();

      if (!profileStillExistsAfterRpc && !membershipStillExistsAfterRpc) {
        setUsers((prev) => prev.filter((user) => user.id !== member.user_id));
        showToast({ type: 'success', message: `Usuário ${memberEmail} excluído com sucesso do sistema.` });
        await fetchOrgMembers();
        return;
      }
    }

    const { error: orgMemberDeleteError } = await supabase
      .from('org_members')
      .delete()
      .eq('user_id', member.user_id);

    if (orgMemberDeleteError) {
      showToast({ type: 'error', message: `Erro ao remover vínculos de organização para ${memberEmail}.` });
      showToast({ type: 'error', message: 'Erro ao remover vínculo na organização.' });
      return;
    }

    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', member.user_id);

    if (profileDeleteError) {
      showToast({ type: 'error', message: `Erro ao excluir perfil de ${memberEmail}.` });
    } else {
      showToast({ type: 'success', message: `Usuário ${memberEmail} excluído com sucesso.` });
    }

    setUsers((prev) => prev.filter((user) => user.id !== member.user_id));
    await fetchOrgMembers();
  };

  const managementUsers = orgMembers
    .filter((user) =>
      user.name.toLowerCase().includes(configSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(configSearch.toLowerCase())
    )
    .slice(0, configRowsLimit);

  return (
    <div key="tab-management" className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slideUp">
      <div ref={createUserFormRef} className="lg:col-span-1 bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
        <button
          type="button"
          onClick={() => setShowCreateUserForm(!showCreateUserForm)}
          className="w-full flex items-center justify-between gap-2 text-left"
        >
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Plus className="text-blue-500" /> Cadastrar Usuário e Nível
          </h3>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${showCreateUserForm ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${showCreateUserForm ? 'max-h-[800px] opacity-100 mt-6' : 'max-h-0 opacity-0'}`}
        >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome de Usuário</label>
            <input
              required
              type="text"
              placeholder="Nome do Gestor"
              value={newAdminName}
              onChange={e => setNewAdminName(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">E-mail</label>
            <input
              required
              type="email"
              placeholder="admin@sgi.com"
              value={newAdminEmail}
              onChange={e => setNewAdminEmail(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Senha <span className="text-[10px] font-normal text-gray-400">(obrigatório se o usuário não existir)</span></label>
            <input
              type="password"
              placeholder="mín. 6 caracteres"
              value={newAdminPassword}
              onChange={e => setNewAdminPassword(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold"
            />
            <p className="text-[11px] text-gray-400 mt-1">Se o e-mail já estiver cadastrado, a senha será ignorada.</p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Perfil de Acesso</label>
            <select
              value={newAccessLevel}
              onChange={(event) => setNewAccessLevel(event.target.value as AccessLevel)}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold"
            >
              {ACCESS_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-2">Diretoria/Gerência da organização: agenda, equipe e distribuição autorizada.</p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Instituição / Organização</label>
            <select
              value={newAdminOrgId}
              onChange={(event) => setNewAdminOrgId(event.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold"
            >
              {organizations.length === 0 && <option value="">Carregando organizações...</option>}
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-2">Instituição atual selecionada: {organizations.find((org) => org.id === newAdminOrgId)?.name || 'Organização Padrão'}</p>
          </div>
          <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg uppercase text-xs tracking-widest mt-4 shadow-lg active:scale-95 transition-transform">
            {editingMemberUserId ? 'Atualizar / Definir' : 'Cadastrar / Definir'}
          </button>
        </form>
        </div>
      </div>

      <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between bg-white">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-sm font-bold">Mostrar</span>
            <select
              value={configRowsLimit}
              onChange={(event) => setConfigRowsLimit(Number(event.target.value))}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-800 font-semibold"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-3 text-gray-500 w-4 h-4" />
            <input
              value={configSearch}
              onChange={(event) => setConfigSearch(event.target.value)}
              placeholder="Pesquisar..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
            />
          </div>
        </div>
        {membersError && <p className="px-4 pt-3 text-sm text-red-400 font-bold">{membersError}</p>}

        {membersLoading ? (
          <div className="p-8"><TableSkeleton rows={4} cols={4} /></div>
        ) : managementUsers.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-500">Nenhum membro encontrado</p>
            <p className="text-xs text-gray-400 mt-1">Cadastre novos membros usando o formulário ao lado.</p>
          </div>
        ) : (
          <>
            <div className="block md:hidden space-y-3">
              {managementUsers.map(u => (
                <div key={`${u.user_id}-${u.org_id}`} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-800 text-sm truncate">{u.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                    </div>
                    <span className="text-[10px] font-black text-blue-400 uppercase border border-blue-900/50 bg-blue-900/10 px-2 py-0.5 rounded shrink-0 ml-2">
                      {u.accessLevel.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-600 font-bold truncate">{u.org_name || 'Organização Padrão'}</p>
                    <div className="flex gap-2 shrink-0 ml-2">
                      <button
                        onClick={() => {
                          setNewAdminName(u.name);
                          setNewAdminEmail(u.email === '-' ? '' : u.email);
                          setNewAdminOrgId(u.org_id);
                          setNewAccessLevel(u.accessLevel);
                          setEditingMemberUserId(u.user_id);
                          setShowCreateUserForm(true);
                        }}
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-500"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMember(u)}
                        className="p-1.5 bg-red-900/20 hover:bg-red-900/40 rounded-md text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                    <th className="px-3 sm:px-6 py-2 sm:py-4">Usuário</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-4">Nível de Acesso</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-4">Instituição</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {managementUsers.map(u => (
                    <tr key={`${u.user_id}-${u.org_id}`} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-2 sm:py-4 font-bold flex flex-col">
                        <span>{u.name}</span>
                        <span className="text-[10px] text-gray-500">{u.email}</span>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4">
                        <span className="text-[10px] font-black text-blue-400 uppercase border border-blue-900/50 bg-blue-900/10 px-2 py-0.5 rounded">
                          {u.accessLevel.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-gray-600 font-bold whitespace-nowrap">{u.org_name || 'Organização Padrão'}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setNewAdminName(u.name);
                              setNewAdminEmail(u.email === '-' ? '' : u.email);
                              setNewAdminOrgId(u.org_id);
                              setNewAccessLevel(u.accessLevel);
                              setEditingMemberUserId(u.user_id);
                              setShowCreateUserForm(true);
                            }}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-500 hover:text-white transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(u)}
                            className="p-2 bg-red-900/20 hover:bg-red-900/40 rounded-md text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ManagementSection;
