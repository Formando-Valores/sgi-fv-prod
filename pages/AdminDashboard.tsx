
import React, { useEffect, useState } from 'react';
import { LogOut, Printer, FileDown, Eye, Pencil, Search, Users, ShieldCheck, X, Plus, Trash2, Calendar, MessageSquare, Check, User as UserIcon, UserCheck, LayoutDashboard, FolderKanban, Users2, Settings, Menu, Building2 } from 'lucide-react';
import { User, ProcessStatus, UserRole, Hierarchy, ServiceUnit, Organization } from '../types';
import { NavLink, useLocation } from 'react-router-dom';
import { SERVICE_MANAGERS } from '../constants';
import { buildOrganizationErrorMessage, createOrganization, deleteOrganization, loadOrganizations, updateOrganization, updateOrganizationStatus } from '../organizationRepository';
import { supabase } from '../supabase';
import type { Process as DbProcess } from '../src/lib/processes';

type AccessLevel = 'Administrador' | 'Usuário Sênior' | 'Usuário Pleno' | 'Operador' | 'Cliente';

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
  organizations?: { name?: string } | null;
};

type ProfileRow = {
  id: string;
  org_id?: string | null;
  role?: string | null;
  email?: string | null;
  nome_completo?: string | null;
  nome?: string | null;
  name?: string | null;
  organizations?: { name?: string } | null;
};


interface AdminProcessRow extends User {
  processRecordId?: string;
  profileUserId?: string | null;
  processType: string;
  startDate: string;
  deadlineDate: string;
  etapaAtual: string;
  financeiro: string;
  prioridade: string;
  valor: number;
  sourceLabel: string;
  requestedOrganizationName: string;
}

interface ClientProfileView {
  id: string;
  user_id: string;
  org_id: string;
  org_name: string;
  nome: string;
  email: string;
  accessLevel: AccessLevel;
  created_at?: string;
}

const ACCESS_LEVELS: AccessLevel[] = ['Administrador', 'Usuário Sênior', 'Usuário Pleno', 'Operador', 'Cliente'];

const mapOrgRoleToAccessLevel = (role: string | null | undefined): AccessLevel => {
  if (!role) return 'Cliente';
  if (role === 'owner' || role === 'admin') return 'Administrador';
  if (role === 'staff') return 'Usuário Pleno';
  return 'Cliente';
};

const mapAccessLevelToOrgRole = (level: AccessLevel): 'admin' | 'staff' | 'client' => {
  if (level === 'Administrador') return 'admin';
  if (level === 'Usuário Sênior' || level === 'Usuário Pleno' || level === 'Operador') return 'staff';
  return 'client';
};

const DEFAULT_ORGANIZATION_NAME_KEYWORDS = ['central', 'default', 'padr', 'todas'];

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const isDefaultOrganizationName = (name: string | undefined | null) => {
  if (!name) return false;
  const normalized = normalizeText(name);
  return DEFAULT_ORGANIZATION_NAME_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const sanitizeDisplayValue = (value: string | null | undefined) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
};

const resolveAccessLevel = (role: string | null | undefined): AccessLevel => {
  if (!role) return 'Cliente';

  const normalized = sanitizeDisplayValue(role).toLowerCase();

  if (normalized === 'administrador' || normalized === 'admin' || normalized === 'owner') return 'Administrador';
  if (normalized === 'usuário sênior' || normalized === 'usuario senior') return 'Usuário Sênior';
  if (normalized === 'usuário pleno' || normalized === 'usuario pleno' || normalized === 'staff') return 'Usuário Pleno';
  if (normalized === 'operador') return 'Operador';
  if (normalized === 'cliente' || normalized === 'client') return 'Cliente';

  return 'Cliente';
};

interface AdminDashboardProps {
  currentUser: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onLogout: () => void;
  section?: 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes';
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, users, setUsers, onLogout, section = 'dashboard' }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'management'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminProcessRow | User | null>(null);
  const [editingUser, setEditingUser] = useState<AdminProcessRow | User | null>(null);
  
  // Management tab states
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAccessLevel, setNewAccessLevel] = useState<AccessLevel>('Usuário Sênior');
  const [newAdminHierarchy, setNewAdminHierarchy] = useState<Hierarchy>(Hierarchy.FULL);
  const [editingHierarchyUser, setEditingHierarchyUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationName, setOrganizationName] = useState('');
  const [organizationIsActive, setOrganizationIsActive] = useState(true);
  const [editingOrganizationId, setEditingOrganizationId] = useState<string | null>(null);
  const [editingOrganizationName, setEditingOrganizationName] = useState('');
  const [orgError, setOrgError] = useState('');
  const [orgSuccess, setOrgSuccess] = useState('');
  const [processSearch, setProcessSearch] = useState('');
  const [processStatusFilter, setProcessStatusFilter] = useState<'all' | ProcessStatus>('all');
  const [processResponsibleFilter, setProcessResponsibleFilter] = useState('all');
  const [processTypeFilter, setProcessTypeFilter] = useState<'all' | ServiceUnit>('all');
  const [processPeriodFilter, setProcessPeriodFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [processRowsLimit, setProcessRowsLimit] = useState(10);
  const [configSearch, setConfigSearch] = useState('');
  const [configRowsLimit, setConfigRowsLimit] = useState(10);
  const [newAdminOrgId, setNewAdminOrgId] = useState('');
  const [orgMembers, setOrgMembers] = useState<OrgMemberView[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [memberActionFeedback, setMemberActionFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [editingMemberUserId, setEditingMemberUserId] = useState<string | null>(null);
  const [clientsData, setClientsData] = useState<ClientProfileView[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState('');
  const [clientsSearch, setClientsSearch] = useState('');
  const [clientsRowsLimit, setClientsRowsLimit] = useState(10);
  const [clientsSort, setClientsSort] = useState<'name_asc' | 'name_desc' | 'recent'>('name_asc');
  const [dbProcesses, setDbProcesses] = useState<DbProcess[]>([]);
  const [processesLoading, setProcessesLoading] = useState(false);
  const [processesError, setProcessesError] = useState('');
  const [editingProfileForm, setEditingProfileForm] = useState({
    fullName: '',
    email: '',
    documentId: '',
    taxId: '',
    phone: '',
    address: '',
    country: 'Brasil',
    maritalStatus: 'Solteiro',
  });
  const [editingProfileLoading, setEditingProfileLoading] = useState(false);
  const [editingProfileError, setEditingProfileError] = useState('');
  const [editingProfileSaving, setEditingProfileSaving] = useState(false);

  const location = useLocation();
  const currentSection = section ?? (location.pathname.split('/')[2] as 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes') ?? 'dashboard';

  const sidebarLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/dashboard/processos', label: 'Processos', icon: FolderKanban },
    { to: '/dashboard/clientes', label: 'Clientes', icon: Users2 },
    { to: '/dashboard/configuracoes', label: 'Configurações', icon: Settings },
    { to: '/dashboard/organizacoes', label: 'Organizações', icon: Building2 },
  ];

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (currentSection === 'configuracoes') {
      setActiveTab('management');
      return;
    }

    if (currentSection === 'dashboard') {
      setActiveTab('users');
    }
  }, [currentSection]);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.protocol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mapDatabaseStatusToLegacy = (status: string | null | undefined): ProcessStatus => {
    const normalized = sanitizeDisplayValue(status).toLowerCase();
    if (normalized === 'concluido') return ProcessStatus.CONCLUIDO;
    if (normalized === 'analise') return ProcessStatus.ANALISE;
    if (normalized === 'triagem') return ProcessStatus.TRIAGEM;
    return ProcessStatus.PENDENTE;
  };

  const formatProcessDate = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('pt-BR');
  };

  const inferServiceUnit = (process: DbProcess): ServiceUnit => {
    const unit = sanitizeDisplayValue(process.unidade_atendimento);
    if (unit === ServiceUnit.ADMINISTRATIVO) return ServiceUnit.ADMINISTRATIVO;
    if (unit === ServiceUnit.TECNOLOGICO) return ServiceUnit.TECNOLOGICO;
    return ServiceUnit.JURIDICO;
  };

  const buildProcessStage = (process: DbProcess) => {
    const source = sanitizeDisplayValue(process.origem_canal).toLowerCase();
    if (source === 'wix') return 'Solicitação recebida';
    if (process.status === 'concluido') return 'Finalizado';
    if (process.status === 'analise') return 'Em análise';
    if (process.status === 'triagem') return 'Triagem';
    return 'Cadastro';
  };

  const baseProcessRows: AdminProcessRow[] = (dbProcesses.length > 0 ? dbProcesses.map((process) => {
      const unit = inferServiceUnit(process);
      const legacyStatus = mapDatabaseStatusToLegacy(process.status);
      const source = sanitizeDisplayValue(process.origem_canal);
      const contact = sanitizeDisplayValue(process.cliente_contato);
      const email = contact.includes('@') ? contact : '';
      const requestedOrganizationName = sanitizeDisplayValue(process.org_nome_solicitado) || 'Não informado';
      const isExternalRequest = source.toLowerCase() === 'wix';
      const generatedValue = unit === ServiceUnit.ADMINISTRATIVO ? 5200 : unit === ServiceUnit.TECNOLOGICO ? 8200 : 1800;

      return {
        id: process.id,
        processRecordId: process.id,
        profileUserId: process.responsavel_user_id,
        name: sanitizeDisplayValue(process.cliente_nome) || sanitizeDisplayValue(process.titulo) || 'Solicitação sem nome',
        email: email || '-',
        role: UserRole.CLIENT,
        documentId: sanitizeDisplayValue(process.cliente_documento) || '---',
        taxId: sanitizeDisplayValue(process.cliente_documento) || '---',
        address: requestedOrganizationName !== 'Não informado' ? `Organização solicitada: ${requestedOrganizationName}` : '---',
        maritalStatus: '---',
        country: 'Brasil',
        phone: !email && contact ? contact : '---',
        processNumber: process.id,
        unit,
        status: legacyStatus,
        protocol: sanitizeDisplayValue(process.protocolo) || 'SEM PROTOCOLO',
        registrationDate: process.created_at,
        lastUpdate: process.updated_at || process.created_at,
        hierarchy: Hierarchy.STATUS_ONLY,
        notes: isExternalRequest ? `Origem: Wix${requestedOrganizationName !== 'Não informado' ? ` · Organização solicitada: ${requestedOrganizationName}` : ''}` : undefined,
        deadline: '',
        serviceManager: isExternalRequest ? 'Aguardando aprovação' : 'Não definido',
        organizationId: process.org_id,
        organizationName: requestedOrganizationName,
        processType: unit,
        startDate: formatProcessDate(process.created_at),
        deadlineDate: isExternalRequest ? 'Aguardando análise' : '-',
        etapaAtual: buildProcessStage(process),
        financeiro: isExternalRequest ? 'Aguardando validação' : (legacyStatus === ProcessStatus.CONCLUIDO ? 'Quitado' : 'Pendente'),
        prioridade: isExternalRequest ? 'Alta' : (legacyStatus === ProcessStatus.CONCLUIDO ? 'Média' : 'Baixa'),
        valor: generatedValue,
        sourceLabel: source ? source.toUpperCase() : 'PAINEL',
        requestedOrganizationName,
      };
    }) : users.map((user) => {
      const generatedValue = user.unit === ServiceUnit.ADMINISTRATIVO ? 5200 : 1800;
      return {
        ...user,
        processRecordId: user.id,
        profileUserId: user.id,
        processType: user.unit === ServiceUnit.ADMINISTRATIVO ? 'Administrativo' : 'Jurídico',
        startDate: user.registrationDate,
        deadlineDate: user.deadline || '12/03/2026',
        etapaAtual: user.status === ProcessStatus.CONCLUIDO ? 'Finalizado' : 'Documentos',
        financeiro: user.status === ProcessStatus.CONCLUIDO ? 'Quitado' : 'Pendente',
        prioridade: user.status === ProcessStatus.CONCLUIDO ? 'Média' : 'Baixa',
        valor: generatedValue,
        sourceLabel: 'PAINEL',
        requestedOrganizationName: user.organizationName || 'Não informado',
      };
    })) as AdminProcessRow[];

  const processResponsibles = Array.from(new Set(baseProcessRows.map((row) => row.serviceManager || 'Não definido')));

  const isWithinPeriod = (registrationDate: string, period: 'all' | 'today' | '7d' | '30d') => {
    if (period === 'all') return true;

    const parsedDate = new Date(registrationDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return true;
    }

    const now = new Date();
    const diffMs = now.getTime() - parsedDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (period === 'today') return diffDays <= 1;
    if (period === '7d') return diffDays <= 7;
    return diffDays <= 30;
  };

  const processRows = baseProcessRows.filter((process) => {
    const matchesSearch =
      process.name.toLowerCase().includes(processSearch.toLowerCase()) ||
      process.email.toLowerCase().includes(processSearch.toLowerCase()) ||
      process.protocol.toLowerCase().includes(processSearch.toLowerCase()) ||
      process.processType.toLowerCase().includes(processSearch.toLowerCase()) ||
      process.sourceLabel.toLowerCase().includes(processSearch.toLowerCase()) ||
      process.requestedOrganizationName.toLowerCase().includes(processSearch.toLowerCase());

    const matchesStatus = processStatusFilter === 'all' || process.status === processStatusFilter;
    const matchesResponsible = processResponsibleFilter === 'all' || (process.serviceManager || 'Não definido') === processResponsibleFilter;
    const matchesType = processTypeFilter === 'all' || process.processType === processTypeFilter;
    const matchesPeriod = isWithinPeriod(process.registrationDate, processPeriodFilter);

    return matchesSearch && matchesStatus && matchesResponsible && matchesType && matchesPeriod;
  });

  const visibleProcessRows = processRows.slice(0, processRowsLimit);

  const processStats = {
    total: processRows.length,
    emAndamento: processRows.filter((process) => process.status !== ProcessStatus.CONCLUIDO).length,
    concluidos: processRows.filter((process) => process.status === ProcessStatus.CONCLUIDO).length,
    aguardando: processRows.filter((process) => process.status === ProcessStatus.PENDENTE || process.status === ProcessStatus.TRIAGEM || process.status === ProcessStatus.ANALISE).length,
    atrasados: processRows.filter((process) => process.status !== ProcessStatus.CONCLUIDO && Boolean(process.deadline)).length,
  };

  const hydrateEditingProfileForm = async (user: AdminProcessRow | User | null) => {
    if (!user) return;

    const profileUserId = sanitizeDisplayValue((user as AdminProcessRow).profileUserId || user.id);
    const fallbackForm = {
      fullName: sanitizeDisplayValue(user.name),
      email: sanitizeDisplayValue(user.email === '-' ? '' : user.email),
      documentId: sanitizeDisplayValue(user.documentId === '---' ? '' : user.documentId),
      taxId: sanitizeDisplayValue(user.taxId === '---' ? '' : user.taxId),
      phone: sanitizeDisplayValue(user.phone === '---' ? '' : user.phone),
      address: sanitizeDisplayValue(user.address === '---' ? '' : user.address),
      country: sanitizeDisplayValue(user.country) || 'Brasil',
      maritalStatus: sanitizeDisplayValue(user.maritalStatus) || 'Solteiro',
    };

    setEditingProfileForm(fallbackForm);
    setEditingProfileError('');

    if (!profileUserId) return;

    setEditingProfileLoading(true);

    const { data, error } = await supabase
      .from('profiles')
      .select('id,nome_completo,email,documento_identidade,nif_cpf,estado_civil,phone,endereco,pais')
      .eq('id', profileUserId)
      .maybeSingle();

    if (error) {
      setEditingProfileError('Não foi possível carregar todos os dados cadastrais do usuário.');
      setEditingProfileLoading(false);
      return;
    }

    if (data) {
      setEditingProfileForm({
        fullName: sanitizeDisplayValue(data.nome_completo) || fallbackForm.fullName,
        email: sanitizeDisplayValue(data.email) || fallbackForm.email,
        documentId: sanitizeDisplayValue(data.documento_identidade) || fallbackForm.documentId,
        taxId: sanitizeDisplayValue(data.nif_cpf) || fallbackForm.taxId,
        phone: sanitizeDisplayValue(data.phone) || fallbackForm.phone,
        address: sanitizeDisplayValue(data.endereco) || fallbackForm.address,
        country: sanitizeDisplayValue(data.pais) || fallbackForm.country,
        maritalStatus: sanitizeDisplayValue(data.estado_civil) || fallbackForm.maritalStatus,
      });
    }

    setEditingProfileLoading(false);
  };

  useEffect(() => {
    if (!editingUser) return;
    void hydrateEditingProfileForm(editingUser);
  }, [editingUser]);


  const fetchProcesses = async () => {
    setProcessesLoading(true);
    setProcessesError('');

    const { data, error } = await supabase
      .from('processes')
      .select('id,org_id,titulo,protocolo,status,cliente_nome,cliente_documento,cliente_contato,responsavel_user_id,created_at,updated_at,origem_canal,unidade_atendimento,org_nome_solicitado')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[processos] erro ao carregar processos reais', error);
      setProcessesError('Não foi possível carregar os processos recebidos no banco. Exibindo a base local disponível.');
      setDbProcesses([]);
      setProcessesLoading(false);
      return;
    }

    setDbProcesses((data as DbProcess[] | null) || []);
    setProcessesLoading(false);
  };

  const handleUpdateStatus = async (userId: string, status: ProcessStatus, deadline?: string, notes?: string, serviceManager?: string) => {
    const timestamp = new Date().toLocaleString('pt-BR');
    const currentEditingUser = editingUser;
    const profileUserId = sanitizeDisplayValue((currentEditingUser as AdminProcessRow | null)?.profileUserId || currentEditingUser?.id);
    const processRecordId = sanitizeDisplayValue((currentEditingUser as AdminProcessRow | null)?.processRecordId || currentEditingUser?.id);

    const profilePayload = {
      nome_completo: sanitizeDisplayValue(editingProfileForm.fullName) || null,
      email: sanitizeDisplayValue(editingProfileForm.email).toLowerCase() || null,
      documento_identidade: sanitizeDisplayValue(editingProfileForm.documentId) || null,
      nif_cpf: sanitizeDisplayValue(editingProfileForm.taxId) || null,
      phone: sanitizeDisplayValue(editingProfileForm.phone) || null,
      endereco: sanitizeDisplayValue(editingProfileForm.address) || null,
      pais: sanitizeDisplayValue(editingProfileForm.country) || null,
      estado_civil: sanitizeDisplayValue(editingProfileForm.maritalStatus) || null,
    };

    const statusMap: Record<ProcessStatus, 'cadastro' | 'triagem' | 'analise' | 'concluido'> = {
      [ProcessStatus.PENDENTE]: 'cadastro',
      [ProcessStatus.TRIAGEM]: 'triagem',
      [ProcessStatus.ANALISE]: 'analise',
      [ProcessStatus.CONCLUIDO]: 'concluido',
    };

    setEditingProfileSaving(true);
    setEditingProfileError('');

    let processUpdateError = '';
    if ((currentEditingUser as AdminProcessRow | null)?.processRecordId && dbProcesses.length > 0 && processRecordId) {
      const { error } = await supabase
        .from('processes')
        .update({ status: statusMap[status] })
        .eq('id', processRecordId);

      if (error) {
        processUpdateError = 'Não foi possível atualizar o status do processo no banco.';
      } else {
        setDbProcesses((prev) =>
          prev.map((process) => (process.id === processRecordId ? { ...process, status: statusMap[status] } : process))
        );
      }
    }

    let profileUpdateError = '';
    if (profileUserId) {
      const { error } = await supabase
        .from('profiles')
        .update(profilePayload)
        .eq('id', profileUserId);

      if (error) {
        profileUpdateError = 'Não foi possível atualizar os dados cadastrais na tabela profiles.';
      }
    }

    setUsers(prev => prev.map(u => 
      u.id === userId || u.id === profileUserId ? {
        ...u,
        name: profilePayload.nome_completo || u.name,
        email: profilePayload.email || u.email,
        documentId: profilePayload.documento_identidade || u.documentId,
        taxId: profilePayload.nif_cpf || u.taxId,
        address: profilePayload.endereco || u.address,
        maritalStatus: profilePayload.estado_civil || u.maritalStatus,
        country: profilePayload.pais || u.country,
        phone: profilePayload.phone || u.phone,
        status,
        deadline,
        notes,
        serviceManager,
        lastUpdate: timestamp
      } : u
    ));

    if (!processUpdateError && !profileUpdateError) {
      setEditingProfileSaving(false);
      setEditingUser(null);
      return;
    }

    setEditingProfileError([processUpdateError, profileUpdateError].filter(Boolean).join(' '));
    setEditingProfileSaving(false);
  };

  const fetchOrgMembers = async () => {
    setMembersLoading(true);
    setMembersError('');

    const orgMemberSelectOptions = [
      'org_id,user_id,role,nome_completo,nome,name,full_name,organizations(name)',
      'org_id,user_id,role,organizations(name)',
      'org_id,user_id,role',
    ];

    let memberRows: OrgMemberRow[] | null = null;
    let memberError: { message?: string } | null = null;

    for (const selectFields of orgMemberSelectOptions) {
      const query = await supabase
        .from('org_members')
        .select(selectFields)
        .order('created_at', { ascending: false });

      if (!query.error) {
        memberRows = query.data as OrgMemberRow[] | null;
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
          const rows = (profileQuery.data || []) as Array<{ id: string; nome_completo?: string | null; nome?: string | null; name?: string | null; email?: string | null; role?: string | null }>;
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
        org_name: member.organizations?.name || 'Organização Padrão',
        name: resolvedName,
        email: resolvedEmail || '-',
        accessLevel,
        source: 'org_members',
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
      const query = await supabase
        .from('profiles')
        .select(selectFields)
        .order('created_at', { ascending: false });

      if (!query.error) {
        profileRows = (query.data as ProfileRow[] | null) || [];
        allProfilesError = null;
        break;
      }

      allProfilesError = query.error;
    }

    if (allProfilesError) {
      console.warn('[configuracoes] não foi possível carregar profiles completos; exibindo apenas org_members', allProfilesError);
    }

    const membershipKeys = new Set(normalizedMembersFromMembership.map((member) => `${member.org_id}-${member.user_id}`));

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
        return {
          profile,
          key: `${orgId}-${profile.id}`,
        };
      })
      .filter(({ key }) => !membershipKeys.has(key))
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
          org_name: profile.organizations?.name || defaultOrgName,
          name: resolvedName,
          email: resolvedEmail,
          accessLevel: resolveAccessLevel(profile.role),
          source: 'profiles',
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
      alert('Selecione uma organização válida.');
      return;
    }
    const selectedOrgName = selectedOrg?.name || 'Organização Padrão';

    let targetUserId = editingMemberUserId;
    const normalizedEmail = sanitizeDisplayValue(newAdminEmail);
    const shouldLookupProfileByEmail = !targetUserId && normalizedEmail && normalizedEmail !== '-';

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
      alert('Erro ao buscar usuário no banco. Tente novamente.');
      return;
    }

    if (!targetUserId && !existingProfile?.id) {
      alert('Não foi possível vincular este usuário à organização porque o ID não está válido no Auth. Peça para o usuário concluir cadastro/login no Supabase e tente novamente.');
      return;
    }

    targetUserId = targetUserId || existingProfile?.id || null;

    if (!targetUserId) {
      alert('Não foi possível identificar o usuário selecionado para atualização.');
      return;
    }

    const orgRole = mapAccessLevelToOrgRole(newAccessLevel);

    const { error: upsertMemberError } = await supabase
      .from('org_members')
      .upsert(
        {
          org_id: newAdminOrgId,
          user_id: targetUserId,
          role: orgRole,
        },
        { onConflict: 'org_id,user_id' }
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
        alert('Erro ao salvar vínculo na tabela org_members.');
        return;
      }
    }

    await supabase
      .from('profiles')
      .update({
        nome_completo: sanitizeDisplayValue(newAdminName),
        name: sanitizeDisplayValue(newAdminName),
        role: newAccessLevel,
        org_id: newAdminOrgId,
      })
      .eq('id', targetUserId);

    setUsers((prev) => {
      const found = prev.find((user) => user.id === targetUserId || user.email === normalizedEmail);
      const role = newAccessLevel === 'Administrador' ? UserRole.ADMIN : UserRole.CLIENT;

      if (found) {
        return prev.map((user) =>
          user.id === found.id
            ? { ...user, name: sanitizeDisplayValue(newAdminName) || user.name, role, hierarchy: newAdminHierarchy, organizationId: newAdminOrgId, organizationName: selectedOrgName }
            : user
        );
      }

      const newUser: User = {
        id: targetUserId,
        name: sanitizeDisplayValue(newAdminName) || 'Usuário',
        email: normalizedEmail || '-',
        role,
        hierarchy: newAdminHierarchy,
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
    setNewAdminOrgId(selectedOrg.id);
    setNewAccessLevel('Usuário Sênior');
    setEditingMemberUserId(null);
    await fetchOrgMembers();
    alert(membershipWarning || 'Membro cadastrado/atualizado com sucesso.');
  };

  const handleUpdateHierarchy = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingHierarchyUser) return;
    
    const fd = new FormData(e.currentTarget);
    const hierarchy = fd.get('hierarchy') as Hierarchy;
    const name = fd.get('admin_name') as string;

    setUsers(prev => prev.map(u => 
      u.id === editingHierarchyUser.id ? { ...u, hierarchy, name } : u
    ));
    setEditingHierarchyUser(null);
  };

  const handleDeleteUser = (id: string) => {
    if(window.confirm('Deseja realmente excluir este usuário?')) {
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const refreshOrganizations = async () => {
    const { organizations: loadedOrganizations, error } = await loadOrganizations();

    if (error) {
      console.warn('[organizacoes] erro ao carregar organizações', error);
      setOrgError(buildOrganizationErrorMessage(error));
      return;
    }

    setOrgError('');
    setOrganizations(loadedOrganizations);
    if (!newAdminOrgId && loadedOrganizations.length > 0) {
      const defaultOrg = loadedOrganizations.find((org) => org.name.toLowerCase().includes('padr'));
      setNewAdminOrgId(defaultOrg?.id || loadedOrganizations[0].id);
    }
  };

  useEffect(() => {
    void refreshOrganizations();
    fetchOrgMembers();
    void fetchProcesses();
  }, []);

  const managementUsers = orgMembers
    .filter((user) =>
      user.name.toLowerCase().includes(configSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(configSearch.toLowerCase())
    )
    .slice(0, configRowsLimit);

  const handleDeleteMember = async (member: OrgMemberView) => {
    if (!window.confirm('Deseja realmente remover este membro da organização?')) return;
    setMemberActionFeedback(null);
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
      setMemberActionFeedback({
        type: 'warning',
        message: `O usuário ${memberEmail} já não possui cadastro no banco. A listagem foi atualizada.`,
      });
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
        setMemberActionFeedback({ type: 'success', message: `Usuário ${memberEmail} excluído com sucesso do sistema.` });
        await fetchOrgMembers();
        return;
      }
    }

    const { error: orgMemberDeleteError } = await supabase
      .from('org_members')
      .delete()
      .eq('user_id', member.user_id);

    if (orgMemberDeleteError) {
      setMemberActionFeedback({ type: 'error', message: `Erro ao remover vínculos de organização para ${memberEmail}.` });
      alert('Erro ao remover vínculo na organização.');
      return;
    }

    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', member.user_id);

    if (profileDeleteError) {
      const errorMessage = String(profileDeleteError.message || '').toLowerCase();
      const errorCode = String((profileDeleteError as { code?: string }).code || '').toLowerCase();
      const errorStatus = String((profileDeleteError as { status?: number }).status || '');

      const isPermissionError =
        errorStatus === '403' ||
        errorCode === '42501' ||
        errorMessage.includes('permission denied') ||
        errorMessage.includes('row-level security') ||
        errorMessage.includes('not allowed');

      if (isPermissionError) {
        setMemberActionFeedback({
          type: 'warning',
          message:
            `Vínculo removido, mas o perfil de ${memberEmail} não pôde ser excluído por permissão no Supabase. ` +
            'Isso indica RLS/policies sem DELETE em profiles para seu usuário atual.',
        });
        alert('Vínculo removido, mas não foi possível excluir o perfil por permissão. Verifique políticas do Supabase para exclusão completa.');
      } else {
        setMemberActionFeedback({
          type: 'error',
          message: `Vínculo removido, mas houve erro ao excluir o perfil de ${memberEmail} no banco.`,
        });
        alert('Vínculo removido, mas houve erro ao excluir o perfil no banco.');
      }

      await fetchOrgMembers();
      return;
    }

    if (memberEmail !== 'sem-email') {
      await supabase
        .from('profiles')
        .delete()
        .eq('email', memberEmail)
        .neq('id', member.user_id);
    }

    const { data: profileStillExists } = await supabase
      .from('profiles')
      .select('id,email')
      .or(`id.eq.${member.user_id},email.eq.${memberEmail}`)
      .limit(1)
      .maybeSingle();

    const { data: membershipStillExists } = await supabase
      .from('org_members')
      .select('user_id')
      .eq('user_id', member.user_id)
      .limit(1)
      .maybeSingle();

    if (profileStillExists || membershipStillExists) {
      setMemberActionFeedback({
        type: 'warning',
        message: rpcMissingFunction
          ? `Exclusão definitiva indisponível para ${memberEmail}: a função RPC delete_user_completely não está publicada neste banco. Aplique a migration 006_hard_delete_user.sql no Supabase para remover também auth.users.`
          : `A exclusão de ${memberEmail} não foi concluída totalmente. Ainda existe cadastro no banco.`,
      });
      await fetchOrgMembers();
      return;
    }

    setUsers((prev) => prev.filter((user) => user.id !== member.user_id));
    setMemberActionFeedback({ type: 'success', message: `Usuário ${memberEmail} excluído com sucesso do sistema.` });

    await fetchOrgMembers();
  };

  const fetchClients = async () => {
    setClientsLoading(true);
    setClientsError('');

    const { data: membershipScopeRows, error: membershipScopeError } = await supabase
      .from('org_members')
      .select('org_id,user_id,role,organizations(name)')
      .eq('user_id', currentUser.id);

    if (membershipScopeError) {
      setClientsError('Não foi possível validar o escopo de acesso do usuário.');
      setClientsLoading(false);
      return;
    }

    const hasGlobalScope = (membershipScopeRows || []).some((membership) => {
      const role = String(membership.role || '').toLowerCase();
      const orgName = membership.organizations?.name;
      return (role === 'admin' || role === 'owner') && isDefaultOrganizationName(orgName);
    });

    const { data: memberRows, error: membersError } = await supabase
      .from('org_members')
      .select('org_id,user_id,role,organizations(name)')
      .order('created_at', { ascending: false });

    if (membersError) {
      setClientsError('Não foi possível carregar os membros da tabela org_members.');
      setClientsLoading(false);
      return;
    }

    const allowedOrgIds = new Set((membershipScopeRows || []).map((row) => row.org_id));
    const scopedMembers = (memberRows || []).filter((member) => hasGlobalScope || allowedOrgIds.has(member.org_id));

    if (scopedMembers.length === 0) {
      setClientsData([]);
      setClientsLoading(false);
      return;
    }

    const userIds = Array.from(new Set(scopedMembers.map((member) => member.user_id)));
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id,nome_completo,nome,email,created_at')
      .in('id', userIds);

    if (profileError) {
      setClientsError('Não foi possível carregar os perfis vinculados aos membros.');
      setClientsLoading(false);
      return;
    }

    const profileMap = new Map((profileRows || []).map((row) => [row.id, row]));

    const normalizedClients: ClientProfileView[] = scopedMembers.map((member) => {
      const profile = profileMap.get(member.user_id);
      const email = profile?.email || '-';
      const nome =
        profile?.nome_completo ||
        profile?.nome ||
        (email !== '-' ? String(email).split('@')[0] : `Usuário ${member.user_id.slice(0, 8)}`);

      return {
        id: `${member.org_id}-${member.user_id}`,
        user_id: member.user_id,
        org_id: member.org_id,
        org_name: member.organizations?.name || 'Organização Padrão',
        nome,
        email,
        accessLevel: mapOrgRoleToAccessLevel(member.role),
        created_at: profile?.created_at || undefined,
      };
    });

    setClientsData(normalizedClients);
    setClientsLoading(false);
  };

  useEffect(() => {
    if (currentSection === 'clientes') {
      fetchClients();
    }
  }, [currentSection]);

  const visibleClients = clientsData
    .filter((client) =>
      client.nome.toLowerCase().includes(clientsSearch.toLowerCase()) ||
      client.email.toLowerCase().includes(clientsSearch.toLowerCase()) ||
      client.org_name.toLowerCase().includes(clientsSearch.toLowerCase())
    )
    .sort((a, b) => {
      if (clientsSort === 'name_asc') {
        return a.nome.localeCompare(b.nome, 'pt-BR');
      }
      if (clientsSort === 'name_desc') {
        return b.nome.localeCompare(a.nome, 'pt-BR');
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    })
    .slice(0, clientsRowsLimit);

  const handleCreateOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOrgError('');
    setOrgSuccess('');

    if (!organizationName.trim()) {
      setOrgError('Informe o nome da organização.');
      return;
    }

    const { organization, error } = await createOrganization(organizationName, organizationIsActive);

    if (error || !organization) {
      console.error('[organizacoes] erro ao cadastrar organização', error);
      setOrgError(buildOrganizationErrorMessage(error));
      return;
    }

    setOrganizations((prev) => [...prev, organization].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')));
    setOrganizationName('');
    setOrganizationIsActive(true);
    setOrgSuccess(`Organização ${organization.name} cadastrada com sucesso.`);
    await refreshOrganizations();
  };

  const handleStartEditOrganization = (organization: Organization) => {
    setEditingOrganizationId(organization.id);
    setEditingOrganizationName(organization.name);
    setOrgError('');
    setOrgSuccess('');
  };

  const handleCancelEditOrganization = () => {
    setEditingOrganizationId(null);
    setEditingOrganizationName('');
  };

  const handleSaveEditOrganization = async (organizationId: string) => {
    setOrgError('');
    setOrgSuccess('');

    const { error } = await updateOrganization(organizationId, editingOrganizationName);

    if (error) {
      console.error('[organizacoes] erro ao editar organização', error);
      setOrgError(buildOrganizationErrorMessage(error));
      return;
    }

    setOrgSuccess('Organização atualizada com sucesso.');
    handleCancelEditOrganization();
    await refreshOrganizations();
  };

  const handleToggleOrganizationStatus = async (organization: Organization) => {
    setOrgError('');
    setOrgSuccess('');

    const nextStatus = !(organization.isActive ?? true);
    const { error } = await updateOrganizationStatus(organization.id, nextStatus);

    if (error) {
      console.error('[organizacoes] erro ao atualizar status da organização', error);
      setOrgError(buildOrganizationErrorMessage(error));
      return;
    }

    setOrgSuccess(`Organização ${organization.name} marcada como ${nextStatus ? 'ativa' : 'inativa'}.`);
    await refreshOrganizations();
  };

  const handleDeleteOrganization = async (organization: Organization) => {
    if (!window.confirm(`Deseja realmente excluir a organização ${organization.name}?`)) {
      return;
    }

    setOrgError('');
    setOrgSuccess('');

    const { error } = await deleteOrganization(organization.id);

    if (error) {
      console.error('[organizacoes] erro ao excluir organização', error);
      setOrgError(buildOrganizationErrorMessage(error));
      return;
    }

    setOrgSuccess(`Organização ${organization.name} excluída com sucesso.`);
    await refreshOrganizations();
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="mx-auto max-w-[1600px] flex flex-col lg:flex-row gap-6">
        <div className="lg:hidden mb-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {sidebarOpen && (
          <button
            className="lg:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          />
        )}

        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-72 bg-slate-900 border border-slate-800 rounded-r-2xl lg:rounded-2xl p-5 h-full lg:h-fit transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        >
          <h2 className="text-xl font-black mb-1">SGI FV</h2>
          <p className="text-slate-500 text-xs font-bold uppercase mb-6">Formando Valores</p>

          <div className="mb-6 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="font-bold text-slate-200">{currentUser.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">{currentUser.role === UserRole.ADMIN ? 'ADMIN' : 'CLIENTE'}</p>
          </div>

          <nav className="space-y-2">
            {sidebarLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isActive ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600'}`}
              >
                <item.icon className="w-4 h-4" />
                <span className="font-bold">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex-1 lg:pl-0">
      {/* Admin Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tighter flex items-center gap-2">
            <ShieldCheck className="text-red-500" /> SGI FV - PAINEL ADMINISTRATIVO
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase mt-1">Bem-vindo, {currentUser.name}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handlePrint} 
            title="Clique para Imprimir Documento"
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors flex items-center gap-2 px-4 text-xs font-bold uppercase"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button 
            onClick={handlePrint} 
            title="Clique para Salvar como PDF"
            className="p-2 bg-blue-900/40 hover:bg-blue-900/60 rounded-lg text-blue-300 transition-colors flex items-center gap-2 px-4 text-xs font-bold uppercase border border-blue-800"
          >
            <FileDown className="w-4 h-4" /> Gerar PDF
          </button>
          <button onClick={onLogout} className="p-2 bg-red-900/20 hover:bg-red-900/40 rounded-lg text-red-400 transition-colors flex items-center gap-2 px-4 text-xs font-bold uppercase">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      {(currentSection === 'dashboard' || currentSection === 'configuracoes') && (
        <>
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 mb-6 gap-8 no-print">
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'users' ? 'text-blue-500' : 'text-slate-500'}`}
        >
          Visualização de Usuários
          {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('management')}
          className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'management' ? 'text-blue-500' : 'text-slate-500'}`}
        >
          Gestão de Acessos
          {activeTab === 'management' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full"></div>}
        </button>
          </div>
        </>
      )}


      {currentSection === 'organizacoes' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-black mb-4">CADASTRAR ORGANIZAÇÃO</h3>
            <form onSubmit={handleCreateOrganization} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 mb-2 block">Nome da organização</label>
                <input
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  className="w-full p-3 bg-gray-900 border border-slate-700 rounded-lg text-white font-bold"
                  placeholder="Ex.: Organização Alpha"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300 font-semibold">
                <input
                  type="checkbox"
                  checked={organizationIsActive}
                  onChange={(event) => setOrganizationIsActive(event.target.checked)}
                  className="w-4 h-4"
                />
                Organização ativa
              </label>
              {orgError && <p className="text-sm text-red-400 font-bold">{orgError}</p>}
              {orgSuccess && <p className="text-sm text-emerald-400 font-bold">{orgSuccess}</p>}
              <button type="submit" className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold">
                Salvar organização
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-black mb-4">ORGANIZAÇÕES CADASTRADAS</h3>
            <div className="space-y-3">
              {organizations.map((organization) => {
                const isEditing = editingOrganizationId === organization.id;

                return (
                  <div key={organization.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    {isEditing ? (
                      <>
                        <input
                          value={editingOrganizationName}
                          onChange={(event) => setEditingOrganizationName(event.target.value)}
                          className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveEditOrganization(organization.id)}
                            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditOrganization}
                            className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-bold"
                          >
                            Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold">{organization.name}</p>
                          <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${organization.isActive ?? true ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' : 'bg-amber-900/40 text-amber-300 border border-amber-700'}`}>
                            {(organization.isActive ?? true) ? 'ATIVA' : 'INATIVA'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">ID: {organization.id}</p>
                        <div className="flex gap-2 pt-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleStartEditOrganization(organization)}
                            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleOrganizationStatus(organization)}
                            className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold"
                          >
                            {(organization.isActive ?? true) ? 'Inativar' : 'Ativar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteOrganization(organization)}
                            className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold"
                          >
                            Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {organizations.length === 0 && (
                <p className="text-slate-400 text-sm">Nenhuma organização cadastrada ainda.</p>
              )}
            </div>
          </div>
        </div>
      ) : currentSection === 'processos' ? (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-5xl font-black tracking-tight leading-none">Processos</h3>
              <button className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-200 font-bold">
                ≡ Colunas
              </button>
            </div>
            <p className="text-slate-400 text-sm mb-6">Visão geral em formato de planilha para filtrar, acompanhar status e agir rápido.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-4">
                <p className="text-xs text-slate-400 uppercase">Processos</p>
                <p className="text-4xl font-black leading-none mt-2">{processStats.total}</p>
                <p className="text-slate-300 mt-1">Total após filtros</p>
              </div>
              <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-4">
                <p className="text-xs text-slate-400 uppercase">Em andamento</p>
                <p className="text-4xl font-black leading-none mt-2">{processStats.emAndamento}</p>
                <p className="text-slate-300 mt-1">Ativos</p>
              </div>
              <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-4">
                <p className="text-xs text-slate-400 uppercase">Concluídos</p>
                <p className="text-4xl font-black leading-none mt-2">{processStats.concluidos}</p>
                <p className="text-slate-300 mt-1">Finalizados</p>
              </div>
              <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-4">
                <p className="text-xs text-slate-400 uppercase">Aguardando</p>
                <p className="text-4xl font-black leading-none mt-2">{processStats.aguardando}</p>
                <p className="text-slate-300 mt-1">Pendências</p>
              </div>
              <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-4">
                <p className="text-xs text-slate-400 uppercase">Atrasados</p>
                <p className="text-4xl font-black leading-none mt-2">{processStats.atrasados}</p>
                <p className="text-slate-300 mt-1">Prazo vencido</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-500 w-5 h-5" />
                <input
                  value={processSearch}
                  onChange={(event) => setProcessSearch(event.target.value)}
                  placeholder="Buscar processo, cliente, responsável..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold"
                />
              </div>
              <select
                value={processStatusFilter}
                onChange={(event) => setProcessStatusFilter(event.target.value as 'all' | ProcessStatus)}
                className="w-full py-3 px-4 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold"
              >
                <option value="all">Todos os status</option>
                <option value={ProcessStatus.PENDENTE}>Cadastro</option>
                <option value={ProcessStatus.TRIAGEM}>Triagem</option>
                <option value={ProcessStatus.ANALISE}>Análise</option>
                <option value={ProcessStatus.CONCLUIDO}>Concluído</option>
              </select>
              <select
                value={processResponsibleFilter}
                onChange={(event) => setProcessResponsibleFilter(event.target.value)}
                className="w-full py-3 px-4 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold"
              >
                <option value="all">Todos os responsáveis</option>
                {processResponsibles.map((responsible) => (
                  <option key={responsible} value={responsible}>{responsible}</option>
                ))}
              </select>
              <select
                value={processTypeFilter}
                onChange={(event) => setProcessTypeFilter(event.target.value as 'all' | ServiceUnit)}
                className="w-full py-3 px-4 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold"
              >
                <option value="all">Todos os tipos</option>
                <option value={ServiceUnit.ADMINISTRATIVO}>Administrativo</option>
                <option value={ServiceUnit.JURIDICO}>Jurídico / Advocacia</option>
                <option value={ServiceUnit.TECNOLOGICO}>Tecnológico / AI</option>
              </select>
              <select
                value={processPeriodFilter}
                onChange={(event) => setProcessPeriodFilter(event.target.value as 'all' | 'today' | '7d' | '30d')}
                className="w-full py-3 px-4 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold"
              >
                <option value="all">Todo período</option>
                <option value="today">Hoje</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
              </select>
            </div>
          </div>

          {processesError && (
            <div className="mb-4 rounded-2xl border border-amber-700/60 bg-amber-900/20 px-4 py-3 text-sm font-bold text-amber-200">
              {processesError}
            </div>
          )}

          {!processesError && dbProcesses.some((process) => sanitizeDisplayValue(process.origem_canal).toLowerCase() === 'wix') && (
            <div className="mb-4 rounded-2xl border border-fuchsia-700/60 bg-fuchsia-900/10 px-4 py-3 text-sm font-bold text-fuchsia-200">
              Solicitações recebidas via Wix aparecem com a origem <span className="text-white">WIX</span> e ficam prontas para análise/aprovação nesta lista.
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-2xl font-black">Lista de processos</h4>
                <p className="text-slate-400 text-sm">Mostrando {visibleProcessRows.length} de {processRows.length} resultados</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-300 font-bold">Linhas</span>
                <select
                  value={processRowsLimit}
                  onChange={(event) => setProcessRowsLimit(Number(event.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                    <th className="px-4 py-4">Nº Processo</th>
                    <th className="px-4 py-4">Cliente</th>
                    <th className="px-4 py-4">Tipo</th>
                    <th className="px-4 py-4">Origem</th>
                    <th className="px-4 py-4">Responsável</th>
                    <th className="px-4 py-4">Data Início</th>
                    <th className="px-4 py-4">Prazo</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Etapa Atual</th>
                    <th className="px-4 py-4">Financeiro</th>
                    <th className="px-4 py-4">Prioridade</th>
                    <th className="px-4 py-4">Valor</th>
                    <th className="px-4 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {visibleProcessRows.map((process) => (
                    <tr key={process.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-4 font-black text-white">{process.protocol}</td>
                      <td className="px-4 py-4 font-bold text-slate-200">{process.name}</td>
                      <td className="px-4 py-4 text-slate-300">{process.processType}</td>
                      <td className="px-4 py-4"><span className={`px-3 py-1 rounded-full text-[10px] font-black ${process.sourceLabel === 'WIX' ? 'bg-fuchsia-900/40 text-fuchsia-300 border border-fuchsia-700' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>{process.sourceLabel}</span></td>
                      <td className="px-4 py-4 text-slate-300">{process.serviceManager || 'Não definido'}</td>
                      <td className="px-4 py-4 text-slate-300">{process.startDate}</td>
                      <td className="px-4 py-4 text-slate-300">{process.deadlineDate}</td>
                      <td className="px-4 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                          process.status === ProcessStatus.CONCLUIDO
                            ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700'
                            : process.status === ProcessStatus.ANALISE
                              ? 'bg-orange-900/40 text-orange-300 border border-orange-700'
                              : process.status === ProcessStatus.TRIAGEM
                                ? 'bg-blue-900/40 text-blue-300 border border-blue-700'
                                : 'bg-yellow-900/40 text-yellow-300 border border-yellow-700'
                        }`}>
                          {process.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-300">{process.etapaAtual}{process.requestedOrganizationName !== 'Não informado' ? ` · ${process.requestedOrganizationName}` : ''}</td>
                      <td className="px-4 py-4">
                        <span className="px-3 py-1 rounded-full text-[10px] font-black bg-yellow-900/40 text-yellow-300 border border-yellow-700">
                          {process.financeiro}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-900/40 text-emerald-300 border border-emerald-700">
                          {process.prioridade}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-black text-slate-100">R$ {process.valor.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setSelectedUser(process)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingUser(process)}
                            className="p-2 bg-blue-900/30 hover:bg-blue-900/50 rounded-lg text-blue-400"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : currentSection === 'clientes' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-black mb-4">CLIENTES</h3>

          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-3 text-slate-500 w-4 h-4" />
              <input
                value={clientsSearch}
                onChange={(event) => setClientsSearch(event.target.value)}
                placeholder="Buscar por nome..."
                className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-slate-700 rounded-lg text-white font-bold"
              />
            </div>
            <select
              value={clientsSort}
              onChange={(event) => setClientsSort(event.target.value as 'name_asc' | 'name_desc' | 'recent')}
              className="w-full py-2 px-3 bg-gray-900 border border-slate-700 rounded-lg text-white font-bold"
            >
              <option value="name_asc">Ordenar: Nome (A-Z)</option>
              <option value="name_desc">Ordenar: Nome (Z-A)</option>
              <option value="recent">Ordenar: Mais recentes</option>
            </select>
            <select
              value={clientsRowsLimit}
              onChange={(event) => setClientsRowsLimit(Number(event.target.value))}
              className="w-full py-2 px-3 bg-gray-900 border border-slate-700 rounded-lg text-white font-bold"
            >
              <option value={10}>Mostrar 10</option>
              <option value={25}>Mostrar 25</option>
              <option value={50}>Mostrar 50</option>
            </select>
          </div>

          {clientsError && <p className="text-sm text-red-400 font-bold mb-4">{clientsError}</p>}

          <div className="mb-3 flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>Total encontrado: {clientsData.length}</span>
            <span>Exibindo: {visibleClients.length}</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Nível</th>
                  <th className="px-6 py-4">Organização</th>
                  <th className="px-6 py-4">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {clientsLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">Carregando membros...</td>
                  </tr>
                ) : visibleClients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">Nenhum membro encontrado.</td>
                  </tr>
                ) : visibleClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-800/30">
                    <td className="px-6 py-4 font-bold text-slate-100">{client.nome}</td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black text-blue-400 uppercase border border-blue-900/50 bg-blue-900/10 px-2 py-0.5 rounded">
                        {client.accessLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-bold">{client.org_name}</td>
                    <td className="px-6 py-4 text-slate-400 font-bold">{client.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'users' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-2.5 text-slate-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Pesquise Por: Nome, Protocolo ou E-mail"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-slate-800 rounded-full text-white text-sm font-bold placeholder:text-slate-600 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Total de Registros:</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded-md text-blue-400 font-bold text-xs">{filteredUsers.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                  <th className="px-6 py-4">Nome Completo</th>
                  <th className="px-6 py-4">Telefone+DDD+País</th>
                  <th className="px-6 py-4">Protocolo SGI</th>
                  <th className="px-6 py-4">Status do Processo</th>
                  <th className="px-6 py-4">Última Alteração</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-200">{user.name}</td>
                    <td className="px-6 py-4 text-slate-400 font-bold">{user.phone} ({user.country})</td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded-md text-[10px] font-black">{user.protocol}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${
                        user.status === ProcessStatus.PENDENTE ? 'bg-slate-600' :
                        user.status === ProcessStatus.TRIAGEM ? 'bg-yellow-600' :
                        user.status === ProcessStatus.ANALISE ? 'bg-orange-600' : 'bg-emerald-600'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-[10px] font-bold">
                       {user.lastUpdate || user.registrationDate}
                    </td>
                    <td className="px-6 py-4 text-right no-print">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setSelectedUser(user)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-300"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setEditingUser(user)}
                          className="p-1.5 bg-blue-900/30 hover:bg-blue-900/50 rounded-md text-blue-400"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Management Tab Content */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Plus className="text-blue-500" /> Cadastrar Usuário e Nível
              </h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nome de Usuário</label>
                    <input 
                      required
                      type="text"
                      placeholder="Nome do Gestor"
                      value={newAdminName}
                      onChange={e => setNewAdminName(e.target.value)}
                      className="w-full bg-gray-900 border border-slate-800 rounded-lg p-3 text-white font-bold" 
                    />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">E-mail</label>
                    <input 
                      required
                      type="email"
                      placeholder="admin@sgi.com"
                      value={newAdminEmail}
                      onChange={e => setNewAdminEmail(e.target.value)}
                      className="w-full bg-gray-900 border border-slate-800 rounded-lg p-3 text-white font-bold" 
                    />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Perfil de Acesso</label>
                    <select
                      value={newAccessLevel}
                      onChange={(event) => setNewAccessLevel(event.target.value as AccessLevel)}
                      className="w-full bg-gray-900 border border-slate-800 rounded-lg p-3 text-white font-bold"
                    >
                      {ACCESS_LEVELS.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-2">Diretoria/Gerência da organização: agenda, equipe e distribuição autorizada.</p>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Instituição / Organização</label>
                    <select
                      value={newAdminOrgId}
                      onChange={(event) => setNewAdminOrgId(event.target.value)}
                      className="w-full bg-gray-900 border border-slate-800 rounded-lg p-3 text-white font-bold"
                    >
                      {organizations.length === 0 && <option value="">Carregando organizações...</option>}
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-2">Instituição atual selecionada: {organizations.find((org) => org.id === newAdminOrgId)?.name || 'Organização Padrão'}</p>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Hierarquia / Nível</label>
                    <div className="space-y-2 mt-2">
                      <label className="flex items-center gap-2 text-sm text-slate-200 font-bold">
                        <input type="radio" name="new_hierarchy_radio" className="w-4 h-4 accent-blue-500" checked={newAdminHierarchy === Hierarchy.FULL} onChange={() => setNewAdminHierarchy(Hierarchy.FULL)} />
                        Alteração e Edição
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-200 font-bold">
                        <input type="radio" name="new_hierarchy_radio" className="w-4 h-4 accent-blue-500" checked={newAdminHierarchy === Hierarchy.STATUS_ONLY} onChange={() => setNewAdminHierarchy(Hierarchy.STATUS_ONLY)} />
                        Somente Alteração
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-200 font-bold">
                        <input type="radio" name="new_hierarchy_radio" className="w-4 h-4 accent-blue-500" checked={newAdminHierarchy === Hierarchy.NOTES_ONLY} onChange={() => setNewAdminHierarchy(Hierarchy.NOTES_ONLY)} />
                        Somente Anotações
                      </label>
                    </div>
                 </div>
                 <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg uppercase text-xs tracking-widest mt-4 shadow-lg active:scale-95 transition-transform">
                    {editingMemberUserId ? 'Atualizar / Definir' : 'Cadastrar / Definir'}
                 </button>
              </form>
           </div>

           <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row gap-3 md:items-center md:justify-between bg-slate-900">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 text-sm font-bold">Mostrar</span>
                  <select
                    value={configRowsLimit}
                    onChange={(event) => setConfigRowsLimit(Number(event.target.value))}
                    className="bg-gray-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-3 text-slate-500 w-4 h-4" />
                  <input
                    value={configSearch}
                    onChange={(event) => setConfigSearch(event.target.value)}
                    placeholder="Pesquisar..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-slate-700 rounded-lg text-white font-bold"
                  />
                </div>
              </div>
              {membersError && <p className="px-4 pt-3 text-sm text-red-400 font-bold">{membersError}</p>}
              {memberActionFeedback && (
                <p
                  className={`px-4 pt-3 text-sm font-bold ${
                    memberActionFeedback.type === 'success'
                      ? 'text-emerald-400'
                      : memberActionFeedback.type === 'warning'
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }`}
                >
                  {memberActionFeedback.message}
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                      <th className="px-6 py-4">Usuário</th>
                      <th className="px-6 py-4">Nível de Acesso</th>
                      <th className="px-6 py-4">Instituição</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {membersLoading ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400">Carregando membros...</td>
                      </tr>
                    ) : managementUsers.map(u => (
                      <tr key={`${u.user_id}-${u.org_id}`} className="hover:bg-slate-800/30">
                        <td className="px-6 py-4 font-bold flex flex-col">
                           <span>{u.name}</span>
                           <span className="text-[10px] text-slate-500">{u.email}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black text-blue-400 uppercase border border-blue-900/50 bg-blue-900/10 px-2 py-0.5 rounded">
                            {u.accessLevel.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300 font-bold">{u.org_name || 'Organização Padrão'}</td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => {
                                  setNewAdminName(u.name);
                                  setNewAdminEmail(u.email === '-' ? '' : u.email);
                                  setNewAdminOrgId(u.org_id);
                                  setNewAccessLevel(u.accessLevel);
                                  setEditingMemberUserId(u.user_id);
                                }}
                                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition-colors"
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
           </div>
        </div>
      )}

      {/* Hierarchy Edit Modal */}
      {editingHierarchyUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 w-full max-w-md rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
             <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
               <h3 className="text-xl font-black uppercase">Editar Gestor</h3>
               <button onClick={() => setEditingHierarchyUser(null)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full">
                 <X className="w-5 h-5" />
               </button>
             </div>
             <div className="p-8">
                <form onSubmit={handleUpdateHierarchy}>
                  <p className="text-slate-400 text-sm mb-6">Alterando dados para <strong>{editingHierarchyUser.email}</strong></p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Nome de Usuário</label>
                      <input 
                        required
                        name="admin_name"
                        type="text"
                        defaultValue={editingHierarchyUser.name}
                        className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 mb-4" 
                      />
                    </div>

                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Hierarquia / Nível</label>
                    {Object.values(Hierarchy).map(h => (
                      <label key={h} className="flex items-center gap-3 p-4 bg-gray-900 border border-slate-800 rounded-xl cursor-pointer hover:border-blue-500 transition-colors">
                        <input 
                          type="radio" 
                          name="hierarchy" 
                          value={h} 
                          defaultChecked={editingHierarchyUser.hierarchy === h} 
                          className="w-5 h-5 accent-blue-500" 
                        />
                        <span className="font-bold text-slate-200">{h}</span>
                      </label>
                    ))}
                    <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl mt-4">
                      Confirmar Alteração
                    </button>
                  </div>
                </form>
             </div>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
             <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
               <h3 className="text-xl font-black uppercase">Ficha Cadastral do Cliente</h3>
               <button onClick={() => setSelectedUser(null)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full">
                 <X className="w-5 h-5" />
               </button>
             </div>
             <div className="p-8 overflow-y-auto">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">Nome Completo</label>
                      <p className="text-lg font-black">{selectedUser.name}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">E-mail</label>
                      <p className="font-bold text-blue-400">{selectedUser.email}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">Documento / NIF-CPF</label>
                      <p className="font-bold">{selectedUser.documentId} / {selectedUser.taxId}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">Estado Civil / País</label>
                      <p className="font-bold">{selectedUser.maritalStatus} - {selectedUser.country}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">Protocolo SGI</label>
                      <p className="text-lg font-black text-emerald-400">{selectedUser.protocol}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">Unidade Atendimento</label>
                      <p className="font-bold text-blue-300">{selectedUser.unit}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">Processo Judicial</label>
                      <p className="font-bold">{selectedUser.processNumber || 'NÃO INFORMADO'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">Status Atual</label>
                      <p className="font-black text-orange-500 uppercase">{selectedUser.status}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-800">
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Endereço Completo</label>
                  <p className="font-bold p-4 bg-gray-900 rounded-xl">{selectedUser.address}</p>
                </div>
                {selectedUser.notes && (
                  <div className="mt-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Observações Internas</label>
                    <p className="font-bold p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl text-blue-200 italic">"{selectedUser.notes}"</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
        </div>
      </div>

      {/* Edit Status Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 w-full max-w-3xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
             <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
               <h3 className="text-xl font-black uppercase">Editar Status: {editingUser.protocol}</h3>
               <button onClick={() => setEditingUser(null)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full">
                 <X className="w-5 h-5" />
               </button>
             </div>
             <div className="p-8 max-h-[85vh] overflow-y-auto">
                <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  void handleUpdateStatus(
                    editingUser.id, 
                    fd.get('status') as ProcessStatus,
                    fd.get('deadline') as string,
                    fd.get('notes') as string,
                    fd.get('serviceManager') as string
                  );
                }}>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Alterar Status do Processo</label>
                        <select name="status" defaultValue={editingUser.status} className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none ring-blue-500 focus:ring-2">
                          {Object.values(ProcessStatus).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block flex items-center gap-2">
                          <UserCheck className="w-3 h-3" /> Gestor do Serviço
                        </label>
                        <select name="serviceManager" defaultValue={editingUser.serviceManager} className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none ring-blue-500 focus:ring-2">
                          <option value="">Selecione um gestor</option>
                          {SERVICE_MANAGERS.map(manager => (
                            <option key={manager} value={manager}>{manager}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> Data de Prazo
                      </label>
                      <input name="deadline" type="date" defaultValue={editingUser.deadline} className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" /> Nota de Observações
                      </label>
                      <textarea name="notes" rows={4} defaultValue={editingUser.notes} className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold resize-none" placeholder="Digite as anotações do processo..."></textarea>
                    </div>

                    <div className="border-t border-slate-800 pt-6">
                      <h4 className="text-lg font-black uppercase mb-4">Dados cadastrais do usuário</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Nome Completo</label>
                          <input
                            type="text"
                            value={editingProfileForm.fullName}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, fullName: event.target.value }))}
                            className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">E-mail</label>
                          <input
                            type="email"
                            value={editingProfileForm.email}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                            className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Documento de Identidade</label>
                          <input
                            type="text"
                            value={editingProfileForm.documentId}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, documentId: event.target.value }))}
                            className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">NIF / CPF</label>
                          <input
                            type="text"
                            value={editingProfileForm.taxId}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, taxId: event.target.value }))}
                            className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Telefone</label>
                          <input
                            type="text"
                            value={editingProfileForm.phone}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                            className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Estado Civil</label>
                          <input
                            type="text"
                            value={editingProfileForm.maritalStatus}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, maritalStatus: event.target.value }))}
                            className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">País</label>
                          <input
                            type="text"
                            value={editingProfileForm.country}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, country: event.target.value }))}
                            className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Endereço completo (inclua CEP)</label>
                          <input
                            type="text"
                            value={editingProfileForm.address}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, address: event.target.value }))}
                            className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {editingProfileLoading && (
                      <p className="text-sm font-bold text-slate-400">Carregando dados completos do cadastro...</p>
                    )}
                    {editingProfileError && (
                      <p className="text-sm font-bold text-amber-300">{editingProfileError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={editingProfileSaving}
                      className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all"
                    >
                      {editingProfileSaving ? 'SALVANDO...' : 'Salvar Alterações'}
                    </button>
                  </div>
                </form>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
