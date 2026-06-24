
import React, { useEffect, useState } from 'react';
import { LogOut, Printer, FileDown, Eye, Pencil, Search, Users, ShieldCheck, X, Plus, Trash2, Calendar, MessageSquare, Check, User as UserIcon, UserCheck, LayoutDashboard, FolderKanban, Users2, Settings, Building2, Flag, FileBarChart2, ExternalLink, Loader2, CreditCard } from 'lucide-react';
import { User, ProcessStatus, UserRole, Hierarchy, ServiceUnit, Organization } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';
import { SERVICE_MANAGERS } from '../constants';
import { buildOrganizationErrorMessage, createOrganization, deleteOrganization, loadOrganizations, updateOrganization, updateOrganizationStatus } from '../organizationRepository';
import { supabase } from '../supabase';
import type { Process as DbProcess } from '../src/lib/processes';
import Card from '../src/components/ui/Card';
import Badge from '../src/components/ui/Badge';
import Button from '../src/components/ui/Button';
import DashboardShell from '../src/components/dashboard/DashboardShell';
import DashboardSidebar from '../src/components/dashboard/DashboardSidebar';
import DashboardTopbar from '../src/components/dashboard/DashboardTopbar';
import DashboardCardContainer from '../src/components/dashboard/DashboardCardContainer';
import { can, getAllowedModules, resolvePermissions } from '../src/lib/permissions';
import OverviewBlock from '../src/components/dashboard/blocks/OverviewBlock';
import ProcessesBlock from '../src/components/dashboard/blocks/ProcessesBlock';
import ClientsBlock from '../src/components/dashboard/blocks/ClientsBlock';
import OrganizationsBlock from '../src/components/dashboard/blocks/OrganizationsBlock';
import ClientJourneyBlock from '../src/components/dashboard/blocks/ClientJourneyBlock';
import ClientProcessProgressPanel, {
  ClientProcessProgressHistoryItem,
} from '../src/components/dashboard/ClientProcessProgressPanel';
import ReportsPage from '../src/pages/Reports/ReportsPage';
import { createCheckoutSession } from '../src/lib/stripe';
import { getPaymentStatusUi } from '../src/lib/paymentStatus';

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
  contractedServiceName: string;
  paymentStatus?: string | null;
  osValue?: number | null;
}

interface ClientProfileView {
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

interface NewClientFormState {
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
  grantSystemAccess: boolean;
}

interface EditClientFormState {
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

type ProcessVisualOverrides = Record<
  string,
  {
    deadline?: string;
    serviceManager?: string;
    notes?: string;
  }
>;

type ProcessChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  createdByName?: string;
  updatedAt?: string;
  updatedByName?: string;
};

type ProcessQuickPreset = 'andamento' | 'atencao' | 'novos7d';

const CHECKLIST_EVENT_PREFIX = 'CHECKLIST_EVENT:';

const ACCESS_LEVELS: AccessLevel[] = ['Administrador', 'Usuário Sênior', 'Usuário Pleno', 'Operador', 'Cliente'];

const mapOrgRoleToAccessLevel = (role: string | null | undefined): AccessLevel => {
  if (!role) return 'Cliente';
  if (role === 'owner' || role === 'admin') return 'Administrador';
  if (role === 'senior') return 'Usuário Sênior';
  if (role === 'pleno' || role === 'staff') return 'Usuário Pleno';
  if (role === 'operador') return 'Operador';
  return 'Cliente';
};

const mapAccessLevelToOrgRole = (level: AccessLevel): string => {
  if (level === 'Administrador') return 'admin';
  if (level === 'Usuário Sênior') return 'senior';
  if (level === 'Usuário Pleno') return 'pleno';
  if (level === 'Operador') return 'operador';
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

const extractOrganizationName = (
  organizations: { name?: string } | Array<{ name?: string }> | null | undefined
) => {
  if (Array.isArray(organizations)) {
    return sanitizeDisplayValue(organizations[0]?.name) || null;
  }
  return sanitizeDisplayValue(organizations?.name) || null;
};

const resolveAccessLevel = (role: string | null | undefined): AccessLevel => {
  if (!role) return 'Cliente';

  const normalized = sanitizeDisplayValue(role).toLowerCase();

  if (normalized === 'administrador' || normalized === 'admin' || normalized === 'owner') return 'Administrador';
  if (normalized === 'usuário sênior' || normalized === 'usuario senior' || normalized === 'senior') return 'Usuário Sênior';
  if (normalized === 'usuário pleno' || normalized === 'usuario pleno' || normalized === 'pleno' || normalized === 'staff') return 'Usuário Pleno';
  if (normalized === 'operador') return 'Operador';
  if (normalized === 'cliente' || normalized === 'client') return 'Cliente';

  return 'Cliente';
};

const statusBadgeVariant = (status: ProcessStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
  if (status === ProcessStatus.CONCLUIDO) return 'success';
  if (status === ProcessStatus.ANALISE) return 'warning';
  if (status === ProcessStatus.TRIAGEM) return 'info';
  return 'neutral';
};



type AdminDashboardLayoutProps = {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentUserName: string;
  hierarchyLabel: string;
  sidebarLinks: Array<{ to: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
  onLogout: () => void;
  onPrint: () => void;
  onSelectSection: (nextSection: string) => void;
  children: React.ReactNode;
};

const AdminDashboardLayout: React.FC<AdminDashboardLayoutProps> = ({
  sidebarOpen,
  setSidebarOpen,
  currentUserName,
  hierarchyLabel,
  sidebarLinks,
  onLogout,
  onPrint,
  onSelectSection,
  children,
}) => (
  <DashboardShell
    sidebarOpen={sidebarOpen}
    onOpenSidebar={() => setSidebarOpen(true)}
    onCloseSidebar={() => setSidebarOpen(false)}
    sidebar={(
      <DashboardSidebar
        sidebarOpen={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
        onSelectSection={onSelectSection}
        userName={currentUserName}
        hierarchyLabel={hierarchyLabel}
        links={sidebarLinks}
      />
    )}
    topbar={(
      <DashboardTopbar
        title={<><ShieldCheck className="text-blue-500" /> SGI FV - PAINEL ADMINISTRATIVO</>}
        subtitle={`Bem-vindo, ${currentUserName}`}
        actions={(
          <div className="flex gap-2">
            <Button
              onClick={onPrint}
              title="Clique para Imprimir Documento"
              variant="secondary"
              className="flex items-center gap-2 text-xs font-bold uppercase"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
            <Button
              onClick={onPrint}
              title="Clique para Salvar como PDF"
              className="flex items-center gap-2 text-xs font-bold uppercase"
            >
              <FileDown className="w-4 h-4" /> Gerar PDF
            </Button>
            <Button onClick={onLogout} variant="danger" className="flex items-center gap-2 text-xs font-bold uppercase">
              <LogOut className="w-4 h-4" /> Sair
            </Button>
          </div>
        )}
      />
    )}
  >
    {children}
  </DashboardShell>
);

interface AdminDashboardProps {
  currentUser: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onLogout: () => void;
  section?: 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes' | 'relatorios';
  blocks?: {
    OverviewBlock?: React.ComponentType<{ children: React.ReactNode }>;
    ProcessesBlock?: React.ComponentType<{ children: React.ReactNode }>;
    ClientsBlock?: React.ComponentType<{ children: React.ReactNode }>;
    OrganizationsBlock?: React.ComponentType<{ children: React.ReactNode }>;
    ClientJourneyBlock?: React.ComponentType<{ children: React.ReactNode }>;
  };
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, users, setUsers, onLogout, section = 'dashboard', blocks }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'management'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminProcessRow | User | null>(null);
  const [selectedUserTab, setSelectedUserTab] = useState<'cadastral' | 'financeiro'>('cadastral');
  const [editingUser, setEditingUser] = useState<AdminProcessRow | User | null>(null);
  const [redirectingCheckout, setRedirectingCheckout] = useState(false);
  
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
  const [processStatusPreset, setProcessStatusPreset] = useState<'all' | 'andamento' | 'atencao'>('all');
  const [processResponsibleFilter, setProcessResponsibleFilter] = useState('all');
  const [processTypeFilter, setProcessTypeFilter] = useState<'all' | ServiceUnit>('all');
  const [processPeriodFilter, setProcessPeriodFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [activeProcessQuickPreset, setActiveProcessQuickPreset] = useState<ProcessQuickPreset | null>(null);
  const [processRowsLimit, setProcessRowsLimit] = useState(10);
  const [showCreateProcessModal, setShowCreateProcessModal] = useState(false);
  const [creatingProcess, setCreatingProcess] = useState(false);
  const [processVisualOverrides, setProcessVisualOverrides] = useState<ProcessVisualOverrides>({});
  const [processActionFeedback, setProcessActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [newProcessForm, setNewProcessForm] = useState({
    organizationId: '',
    title: '',
    clientName: '',
    clientDocument: '',
    clientContact: '',
    serviceUnit: ServiceUnit.JURIDICO,
    osValue: undefined as number | undefined,
  });
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
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientFormError, setClientFormError] = useState('');
  const [clientFormSuccess, setClientFormSuccess] = useState('');
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [savingClientEdit, setSavingClientEdit] = useState(false);
  const [clientEditError, setClientEditError] = useState('');
  const [clientEditSuccess, setClientEditSuccess] = useState('');
  const [editingClient, setEditingClient] = useState<ClientProfileView | null>(null);
  const [editClientForm, setEditClientForm] = useState<EditClientFormState>({
    fullName: '',
    email: '',
    phone: '',
    documentId: '',
    taxId: '',
    address: '',
    country: 'Brasil',
    maritalStatus: 'Solteiro',
    organizationId: '',
    accessLevel: 'Cliente',
  });
  const [newClientForm, setNewClientForm] = useState<NewClientFormState>({
    fullName: '',
    email: '',
    phone: '',
    documentId: '',
    taxId: '',
    address: '',
    country: 'Brasil',
    maritalStatus: 'Solteiro',
    organizationId: '',
    accessLevel: 'Cliente',
    grantSystemAccess: false,
  });
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
  const OverviewContainer = blocks?.OverviewBlock ?? OverviewBlock;
  const ProcessesContainer = blocks?.ProcessesBlock ?? ProcessesBlock;
  const ClientsContainer = blocks?.ClientsBlock ?? ClientsBlock;
  const OrganizationsContainer = blocks?.OrganizationsBlock ?? OrganizationsBlock;
  const ClientJourneyContainer = blocks?.ClientJourneyBlock ?? ClientJourneyBlock;
  const [editingProfileLoading, setEditingProfileLoading] = useState(false);
  const [editingProfileError, setEditingProfileError] = useState('');
  const [editingProfileSaving, setEditingProfileSaving] = useState(false);
  const [processChecklist, setProcessChecklist] = useState<ProcessChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<string | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState('');
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState('');
  const [clientJourneyHistory, setClientJourneyHistory] = useState<ClientProcessProgressHistoryItem[]>([]);
  const [clientJourneyLoading, setClientJourneyLoading] = useState(false);
  const clientJourneyLastProcessIdRef = React.useRef<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const validSections = ['dashboard', 'processos', 'clientes', 'configuracoes', 'organizacoes', 'relatorios'] as const;
  type DashboardSection = typeof validSections[number];
  type DashboardPresetFilter =
    | 'usuarios_cadastrados'
    | 'processos-em-andamento'
    | 'processos-prioridade'
    | 'processos-novos-7d';
  const parseSectionCandidate = (value?: string | null): DashboardSection | null => {
    if (!value) return null;
    if ((validSections as readonly string[]).includes(value)) return value as DashboardSection;
    return null;
  };
  const resolveSectionFromLocation = (): DashboardSection => {
    const pathnameSection = parseSectionCandidate(location.pathname.split('/')[2]);
    if (pathnameSection) return pathnameSection;

    const hashValue = location.hash || (typeof window !== 'undefined' ? window.location.hash : '');
    const hashSection = parseSectionCandidate(hashValue.split('/')[2]);
    if (hashSection) return hashSection;

    return section || 'dashboard';
  };
  const resolveRequestedSectionFromLocation = (): DashboardSection | null => {
    const pathnameSection = parseSectionCandidate(location.pathname.split('/')[2]);
    if (pathnameSection) return pathnameSection;

    const hashValue = location.hash || (typeof window !== 'undefined' ? window.location.hash : '');
    const hashSection = parseSectionCandidate(hashValue.split('/')[2]);
    if (hashSection) return hashSection;

    return null;
  };
  const [currentSection, setCurrentSection] = useState<DashboardSection>(resolveSectionFromLocation);

  const parseProcessQuickPresetFromSearch = (search: string): ProcessQuickPreset | null => {
    const preset = new URLSearchParams(search).get('preset');

    if (!preset) return null;

    const presetAliases: Record<string, ProcessQuickPreset> = {
      andamento: 'andamento',
      'processos-em-andamento': 'andamento',
      atencao: 'atencao',
      'processos-prioridade': 'atencao',
      novos7d: 'novos7d',
      'processos-novos-7d': 'novos7d',
    };

    return presetAliases[preset] ?? null;
  };

  const applyProcessQuickPreset = (preset: ProcessQuickPreset) => {
    setProcessSearch('');
    setProcessResponsibleFilter('all');
    setProcessTypeFilter('all');

    if (preset === 'andamento') {
      setProcessStatusFilter('all');
      setProcessStatusPreset('andamento');
      setProcessPeriodFilter('all');
    } else if (preset === 'atencao') {
      setProcessStatusFilter('all');
      setProcessStatusPreset('atencao');
      setProcessPeriodFilter('all');
    } else if (preset === 'novos7d') {
      setProcessStatusFilter('all');
      setProcessStatusPreset('all');
      setProcessPeriodFilter('7d');
    }
  };

  const permissions = resolvePermissions(currentUser.org_role ?? (currentUser.role === UserRole.ADMIN ? 'admin' : 'client'));
  const permissionSubject = { org_role: currentUser.org_role ?? null, hierarchy: permissions.hierarchy };
  const allowedModules = getAllowedModules(permissionSubject);
  const canCreateProcess = can('create', 'processos', permissionSubject);
  const canManageOrganizations = can('manage', 'organizacoes', permissionSubject);
  const canViewAllReports = can('view_all', 'relatorios', permissionSubject);
  const isClientScope = permissions.hierarchy === 'cliente';

  const sectionReadOnly = {
    processos: !can('create', 'processos', permissionSubject) && !can('delete', 'processos', permissionSubject),
    clientes: !can('manage', 'clientes', permissionSubject),
    configuracoes: !can('manage', 'configuracoes', permissionSubject),
    organizacoes: !can('manage', 'organizacoes', permissionSubject),
    relatorios: !can('view_all', 'relatorios', permissionSubject),
  } as const;

  const sidebarLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: allowedModules.includes('dashboard') },
    { to: '/dashboard/processos', label: 'Processos', icon: FolderKanban, visible: allowedModules.includes('processos') },
    { to: '/dashboard/clientes', label: 'Clientes', icon: Users2, visible: allowedModules.includes('clientes') },
    { to: '/dashboard/configuracoes', label: 'Configurações', icon: Settings, visible: allowedModules.includes('configuracoes') },
    { to: '/dashboard/organizacoes', label: 'Organizações', icon: Building2, visible: allowedModules.includes('organizacoes') },
    { to: '/dashboard/relatorios', label: 'Relatórios', icon: FileBarChart2, visible: allowedModules.includes('relatorios') },
  ].filter((item) => item.visible);

  const sectionModuleMap: Partial<Record<DashboardSection, 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes' | 'relatorios'>> = {
    dashboard: 'dashboard',
    processos: 'processos',
    clientes: 'clientes',
    configuracoes: 'configuracoes',
    organizacoes: 'organizacoes',
    relatorios: 'relatorios',
  };

  const canAccessSection = (sectionName: DashboardSection) => {
    if (sectionName === 'dashboard') return true;
    const mappedModule = sectionModuleMap[sectionName];
    if (!mappedModule) return false;
    return allowedModules.includes(mappedModule);
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setCurrentSection(resolveSectionFromLocation());
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    const requestedSection = resolveRequestedSectionFromLocation();
    const hasInvalidSectionInRoute =
      Boolean(location.pathname.split('/')[2] || location.hash.split('/')[2]) && !requestedSection;

    if (!hasInvalidSectionInRoute && canAccessSection(currentSection)) return;
    navigate('/dashboard', { replace: true });
    setCurrentSection('dashboard');
  }, [currentSection, navigate, allowedModules, location.pathname, location.hash]);

  useEffect(() => {
    if (currentSection === 'configuracoes') {
      const preset = new URLSearchParams(location.search).get('preset');
      if (preset === 'usuarios_cadastrados') {
        setActiveTab('users');
        setSearchTerm('');
        return;
      }

      setActiveTab('management');
      return;
    }

    if (currentSection === 'dashboard') {
      setActiveTab('users');
    }
  }, [currentSection, location.search]);

  useEffect(() => {
    if (currentSection !== 'processos') {
      setActiveProcessQuickPreset(null);
      setProcessStatusPreset('all');
      return;
    }

    const detectedPreset = parseProcessQuickPresetFromSearch(location.search);
    if (!detectedPreset) {
      setActiveProcessQuickPreset(null);
      setProcessStatusPreset('all');
      return;
    }

    setActiveProcessQuickPreset(detectedPreset);
    applyProcessQuickPreset(detectedPreset);
  }, [currentSection, location.search]);

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

  const PROCESS_SELECT_BASE_COLUMNS = 'id,org_id,titulo,protocolo,status,cliente_nome,cliente_documento,cliente_contato,responsavel_user_id,created_at,updated_at,origem_canal,unidade_atendimento,org_nome_solicitado,payment_status,process_status,os_value';
  const PROCESS_SELECT_WITH_OPTIONAL_COLUMNS = 'id,org_id,titulo,protocolo,status,cliente_nome,cliente_documento,cliente_contato,responsavel_user_id,data_prazo,gestor_servico,observacoes,created_at,updated_at,origem_canal,unidade_atendimento,org_nome_solicitado,payment_status,process_status,os_value';

  const normalizeProcessOptionalFields = (process: Partial<DbProcess>): DbProcess => ({
    ...(process as DbProcess),
    data_prazo: process.data_prazo ?? null,
    gestor_servico: process.gestor_servico ?? null,
    observacoes: process.observacoes ?? null,
  });

  const hasMissingOptionalProcessColumns = (error: unknown): boolean => {
    const supabaseError = (error || {}) as { code?: string | null; message?: string | null; details?: string | null; hint?: string | null };
    const errorCode = sanitizeDisplayValue(supabaseError.code || '');
    const combinedMessage = `${supabaseError.message || ''} ${supabaseError.details || ''} ${supabaseError.hint || ''}`.toLowerCase();

    const mentionsOptionalColumns = ['data_prazo', 'gestor_servico', 'observacoes'].some((column) => combinedMessage.includes(column));
    return mentionsOptionalColumns || errorCode === '42703' || errorCode === 'PGRST204';
  };

  const logProcessesQueryError = (label: string, error: unknown) => {
    const supabaseError = (error || {}) as { code?: string | null; message?: string | null; details?: string | null; hint?: string | null };
    console.warn(`[processos] ${label}`, {
      code: supabaseError.code || 'sem-codigo',
      message: supabaseError.message || 'sem-mensagem',
      details: supabaseError.details || 'sem-detalhes',
      hint: supabaseError.hint || 'sem-hint',
    });
  };

  const resolveOrganizationScope = async () => {
    const { data, error } = await supabase
      .from('org_members')
      .select('org_id,role,organizations(name,slug)')
      .eq('user_id', currentUser.id);

    if (error) {
      return {
        allowedOrgIds: new Set<string>(),
        hasGlobalScope: false,
        error,
      };
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

    return {
      allowedOrgIds,
      hasGlobalScope,
      error: null as null,
    };
  };

  const getEditingProcessRecordId = (user: AdminProcessRow | User | null) =>
    sanitizeDisplayValue((user as AdminProcessRow | null)?.processRecordId || user?.id);

  const buildChecklistFromEvents = (
    events: Array<{ mensagem?: string | null; created_at?: string | null; created_by?: string | null }>,
    userNameById: Record<string, string>
  ): ProcessChecklistItem[] => {
    const checklistMap = new Map<string, ProcessChecklistItem>();

    events.forEach((event) => {
      const rawMessage = sanitizeDisplayValue(event.mensagem);
      if (!rawMessage) return;
      if (!rawMessage.startsWith(CHECKLIST_EVENT_PREFIX)) return;

      try {
        const payload = JSON.parse(rawMessage.slice(CHECKLIST_EVENT_PREFIX.length)) as {
          action?: 'add' | 'toggle' | 'edit' | 'delete';
          itemId?: string;
          text?: string;
          completed?: boolean;
          actorName?: string;
        };

        if (!payload?.action || !payload.itemId) return;

        if (payload.action === 'add' && payload.text) {
          checklistMap.set(payload.itemId, {
            id: payload.itemId,
            text: payload.text,
            completed: false,
            createdAt: event.created_at || new Date().toISOString(),
            createdByName: payload.actorName || (event.created_by ? userNameById[event.created_by] : '') || 'Administrador',
          });
          return;
        }

        if (payload.action === 'toggle' && checklistMap.has(payload.itemId)) {
          const existing = checklistMap.get(payload.itemId)!;
          checklistMap.set(payload.itemId, {
            ...existing,
            completed: Boolean(payload.completed),
            updatedAt: event.created_at || existing.updatedAt,
            updatedByName: payload.actorName || (event.created_by ? userNameById[event.created_by] : '') || existing.updatedByName || 'Administrador',
          });
          return;
        }

        if (payload.action === 'edit' && checklistMap.has(payload.itemId) && payload.text) {
          const existing = checklistMap.get(payload.itemId)!;
          checklistMap.set(payload.itemId, {
            ...existing,
            text: payload.text,
            updatedAt: event.created_at || existing.updatedAt,
            updatedByName: payload.actorName || (event.created_by ? userNameById[event.created_by] : '') || existing.updatedByName || 'Administrador',
          });
          return;
        }

        if (payload.action === 'delete' && checklistMap.has(payload.itemId)) {
          checklistMap.delete(payload.itemId);
        }
      } catch {
        // ignora mensagens antigas de outros formatos
      }
    });

    return Array.from(checklistMap.values()).sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    });
  };

  const formatProcessDate = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('pt-BR');
  };

  const formatDeadlineForDisplay = (value?: string | null) => {
    if (!value) return '';
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('pt-BR');
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

  const fallbackUsersForRows = isClientScope
    ? users.filter((user) => user.id === currentUser.id)
    : users;

  const baseProcessRows: AdminProcessRow[] = (dbProcesses.length > 0 ? dbProcesses.map((process) => {
      const unit = inferServiceUnit(process);
      const legacyStatus = mapDatabaseStatusToLegacy(process.status);
      const source = sanitizeDisplayValue(process.origem_canal);
      const contact = sanitizeDisplayValue(process.cliente_contato);
      const email = contact.includes('@') ? contact : '';
      const requestedOrganizationName = sanitizeDisplayValue(process.org_nome_solicitado) || 'Não informado';
      const isExternalRequest = source.toLowerCase() === 'wix';
      const generatedValue = unit === ServiceUnit.ADMINISTRATIVO ? 5200 : unit === ServiceUnit.TECNOLOGICO ? 8200 : 1800;
      const processOverrides = processVisualOverrides[process.id] || {};
      const persistedDeadline = sanitizeDisplayValue(process.data_prazo);
      const persistedServiceManager = sanitizeDisplayValue(process.gestor_servico);
      const persistedNotes = sanitizeDisplayValue(process.observacoes);
      const manualDeadline = sanitizeDisplayValue(processOverrides.deadline);
      const manualServiceManager = sanitizeDisplayValue(processOverrides.serviceManager);
      const manualNotes = sanitizeDisplayValue(processOverrides.notes);
      const resolvedDeadline = persistedDeadline || manualDeadline;
      const resolvedServiceManager = persistedServiceManager || manualServiceManager;
      const resolvedNotes = persistedNotes || manualNotes;
      const resolvedDeadlineDisplay =
        formatDeadlineForDisplay(resolvedDeadline) || (isExternalRequest ? 'Aguardando análise' : '-');

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
        notes:
          resolvedNotes ||
          (isExternalRequest ? `Origem: Wix${requestedOrganizationName !== 'Não informado' ? ` · Organização solicitada: ${requestedOrganizationName}` : ''}` : undefined),
        deadline: resolvedDeadline,
        serviceManager: resolvedServiceManager || (isExternalRequest ? 'Aguardando aprovação' : 'Não definido'),
        organizationId: process.org_id,
        organizationName: requestedOrganizationName,
        processType: unit,
        startDate: formatProcessDate(process.created_at),
        deadlineDate: resolvedDeadlineDisplay,
        etapaAtual: buildProcessStage(process),
        financeiro: isExternalRequest ? 'Aguardando validação' : (legacyStatus === ProcessStatus.CONCLUIDO ? 'Quitado' : 'Pendente'),
        prioridade: isExternalRequest ? 'Alta' : (legacyStatus === ProcessStatus.CONCLUIDO ? 'Média' : 'Baixa'),
        valor: generatedValue,
        sourceLabel: source ? source.toUpperCase() : 'PAINEL',
        requestedOrganizationName,
        contractedServiceName: sanitizeDisplayValue(process.titulo) || 'Serviço não informado',
        paymentStatus: process.payment_status ?? null,
        osValue: process.os_value ?? null,
      };
    }) : fallbackUsersForRows.map((user) => {
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
        contractedServiceName: user.unit === ServiceUnit.ADMINISTRATIVO ? 'Serviço administrativo' : 'Serviço jurídico',
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
    const andamentoStatuses = [ProcessStatus.PENDENTE, ProcessStatus.TRIAGEM, ProcessStatus.ANALISE];
    const atencaoStatuses = [ProcessStatus.TRIAGEM, ProcessStatus.ANALISE];

    const matchesSearch =
      process.name.toLowerCase().includes(processSearch.toLowerCase()) ||
      process.email.toLowerCase().includes(processSearch.toLowerCase()) ||
      process.protocol.toLowerCase().includes(processSearch.toLowerCase()) ||
      process.processType.toLowerCase().includes(processSearch.toLowerCase()) ||
      process.sourceLabel.toLowerCase().includes(processSearch.toLowerCase()) ||
      process.requestedOrganizationName.toLowerCase().includes(processSearch.toLowerCase()) ||
      process.contractedServiceName.toLowerCase().includes(processSearch.toLowerCase());

    const matchesStatus =
      processStatusPreset === 'atencao'
        ? atencaoStatuses.includes(process.status)
        : processStatusPreset === 'andamento'
          ? andamentoStatuses.includes(process.status)
          : processStatusFilter === 'all' || process.status === processStatusFilter;
    const matchesResponsible = processResponsibleFilter === 'all' || (process.serviceManager || 'Não definido') === processResponsibleFilter;
    const matchesType = processTypeFilter === 'all' || process.processType === processTypeFilter;
    const matchesPeriod = isWithinPeriod(process.registrationDate, processPeriodFilter);

    return matchesSearch && matchesStatus && matchesResponsible && matchesType && matchesPeriod;
  });

  const quickPresetVisual = activeProcessQuickPreset
    ? {
      andamento: {
        label: 'Em andamento',
        helper: 'Aplicado via URL (?preset=andamento): Cadastro, Triagem e Análise.',
      },
      atencao: {
        label: 'Atenção',
        helper: 'Aplicado via URL (?preset=atencao): Triagem e Análise.',
      },
      novos7d: {
        label: 'Novos em 7 dias',
        helper: 'Aplicado via URL (?preset=novos7d): período configurado para últimos 7 dias.',
      },
    }[activeProcessQuickPreset]
    : null;

  const visibleProcessRows = processRows.slice(0, processRowsLimit);

  const processStats = {
    total: processRows.length,
    emAndamento: processRows.filter((process) => process.status !== ProcessStatus.CONCLUIDO).length,
    concluidos: processRows.filter((process) => process.status === ProcessStatus.CONCLUIDO).length,
    aguardando: processRows.filter((process) => process.status === ProcessStatus.PENDENTE || process.status === ProcessStatus.TRIAGEM || process.status === ProcessStatus.ANALISE).length,
    atrasados: processRows.filter((process) => process.status !== ProcessStatus.CONCLUIDO && Boolean(process.deadline)).length,
  };

  const dashboardHighlights = [
    {
      key: 'usuarios',
      label: 'Usuários cadastrados',
      value: users.length,
      helper: `${filteredUsers.length} visíveis no filtro atual`,
      icon: Users2,
      styles: 'border-blue-100 bg-blue-50 text-blue-700',
      targetSection: 'configuracoes' as DashboardSection,
      presetFilter: 'usuarios_cadastrados' as DashboardPresetFilter,
      ariaLabel: 'Ir para a seção de configurações na aba de usuários cadastrados',
    },
    {
      key: 'processos-ativos',
      label: 'Processos em andamento',
      value: processStats.emAndamento,
      helper: `${processStats.total} processos no total`,
      icon: FolderKanban,
      styles: 'border-indigo-100 bg-indigo-50 text-indigo-700',
      targetSection: 'processos' as DashboardSection,
      presetFilter: 'processos-em-andamento' as DashboardPresetFilter,
      ariaLabel: 'Ir para a seção de processos em andamento',
    },
    {
      key: 'prioridade',
      label: 'Demandas que exigem atenção',
      value: processRows.filter((process) => process.status === ProcessStatus.TRIAGEM || process.status === ProcessStatus.ANALISE).length,
      helper: 'Triagem + Análise',
      icon: MessageSquare,
      styles: 'border-amber-100 bg-amber-50 text-amber-700',
      targetSection: 'processos' as DashboardSection,
      presetFilter: 'processos-prioridade' as DashboardPresetFilter,
      ariaLabel: 'Ir para a seção de processos com foco em demandas prioritárias',
    },
    {
      key: 'novos',
      label: 'Novos nos últimos 7 dias',
      value: processRows.filter((process) => isWithinPeriod(process.registrationDate, '7d')).length,
      helper: 'Velocidade de entrada',
      icon: Calendar,
      styles: 'border-emerald-100 bg-emerald-50 text-emerald-700',
      targetSection: 'processos' as DashboardSection,
      presetFilter: 'processos-novos-7d' as DashboardPresetFilter,
      ariaLabel: 'Ir para a seção de processos com filtro de últimos sete dias',
    },
  ];

  const navigateToDashboardHighlight = (targetSection: DashboardSection, presetFilter: DashboardPresetFilter) => {
    setCurrentSection(targetSection);
    navigate(`/dashboard/${targetSection}?preset=${presetFilter}`);
  };

  const statusDistribution = [
    { label: 'Triagem', value: processRows.filter((process) => process.status === ProcessStatus.TRIAGEM).length, color: '#4F8FE8' },
    { label: 'Em andamento', value: processRows.filter((process) => process.status === ProcessStatus.ANALISE).length, color: '#F5B83B' },
    { label: 'Cadastro', value: processRows.filter((process) => process.status === ProcessStatus.PENDENTE).length, color: '#8C6DD7' },
    { label: 'Concluído', value: processRows.filter((process) => process.status === ProcessStatus.CONCLUIDO).length, color: '#52B788' },
  ];

  const serviceDistribution = Array.from(
    processRows.reduce<Map<string, number>>((accumulator, process) => {
      accumulator.set(process.processType, (accumulator.get(process.processType) || 0) + 1);
      return accumulator;
    }, new Map<string, number>()),
  ).map(([label, value], index) => ({
    label,
    value,
    color: ['#4F8FE8', '#52B788', '#8C6DD7', '#F5B83B'][index % 4],
  }));

  const totalForStatus = statusDistribution.reduce((sum, item) => sum + item.value, 0) || 1;
  const totalForService = serviceDistribution.reduce((sum, item) => sum + item.value, 0) || 1;

  const statusDonutStyle = {
    background: `conic-gradient(${statusDistribution
      .map((item, index) => {
        const start = statusDistribution.slice(0, index).reduce((sum, segment) => sum + segment.value, 0);
        const end = start + item.value;
        return `${item.color} ${(start / totalForStatus) * 100}% ${(end / totalForStatus) * 100}%`;
      })
      .join(', ')})`,
  };

  const serviceDonutStyle = {
    background: `conic-gradient(${serviceDistribution
      .map((item, index) => {
        const start = serviceDistribution.slice(0, index).reduce((sum, segment) => sum + segment.value, 0);
        const end = start + item.value;
        return `${item.color} ${(start / totalForService) * 100}% ${(end / totalForService) * 100}%`;
      })
      .join(', ')})`,
  };

  const dashboardRecentRows = processRows.slice(0, 5);
  const clientPrimaryProcess = isClientScope ? processRows[0] : null;
  const clientStatusLabelMap: Record<ProcessStatus, string> = {
    [ProcessStatus.PENDENTE]: 'Em atendimento inicial',
    [ProcessStatus.TRIAGEM]: 'Coleta em andamento',
    [ProcessStatus.ANALISE]: 'Análise em andamento',
    [ProcessStatus.CONCLUIDO]: 'Concluído',
  };
  const clientStepByStatus: Record<ProcessStatus, number> = {
    [ProcessStatus.PENDENTE]: 0,
    [ProcessStatus.TRIAGEM]: 1,
    [ProcessStatus.ANALISE]: 2,
    [ProcessStatus.CONCLUIDO]: 4,
  };

  const resetNewProcessForm = () => {
    setNewProcessForm({
      organizationId: newAdminOrgId || organizations[0]?.id || '',
      title: '',
      clientName: '',
      clientDocument: '',
      clientContact: '',
      serviceUnit: ServiceUnit.JURIDICO,
      osValue: undefined,
    });
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

  useEffect(() => {
    const processId = getEditingProcessRecordId(editingUser);
    if (!processId) {
      setProcessChecklist([]);
      setChecklistError('');
      setNewChecklistText('');
      return;
    }

    const loadChecklist = async () => {
      setChecklistLoading(true);
      setChecklistError('');

      const { data, error } = await supabase
        .from('process_events')
        .select('mensagem,created_at,created_by')
        .eq('process_id', processId)
        .eq('tipo', 'observacao')
        .order('created_at', { ascending: true });

      if (error) {
        setChecklistError('Não foi possível carregar o checklist deste processo.');
        setChecklistLoading(false);
        return;
      }

      const events = (data || []) as Array<{ mensagem?: string | null; created_at?: string | null; created_by?: string | null }>;
      const userIds = Array.from(new Set(events.map((event) => event.created_by).filter(Boolean))) as string[];
      let userNameById: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id,nome_completo,nome,name,email')
          .in('id', userIds);

        userNameById = ((profileRows || []) as Array<{ id: string; nome_completo?: string | null; nome?: string | null; name?: string | null; email?: string | null }>)
          .reduce<Record<string, string>>((accumulator, profile) => {
            accumulator[profile.id] =
              sanitizeDisplayValue(profile.nome_completo) ||
              sanitizeDisplayValue(profile.nome) ||
              sanitizeDisplayValue(profile.name) ||
              sanitizeDisplayValue(profile.email) ||
              'Administrador';
            return accumulator;
          }, {});
      }

      const checklist = buildChecklistFromEvents(events, userNameById);
      setProcessChecklist(checklist);
      setChecklistLoading(false);
      setEditingChecklistItemId(null);
      setEditingChecklistText('');
    };

    void loadChecklist();
  }, [editingUser]);

  const handleAddChecklistItem = async () => {
    const processId = getEditingProcessRecordId(editingUser);
    const normalizedText = sanitizeDisplayValue(newChecklistText);

    if (!processId || !normalizedText) return;

    const itemId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const newItem: ProcessChecklistItem = {
      id: itemId,
      text: normalizedText,
      completed: false,
      createdAt: nowIso,
      createdByName: currentUser.name || 'Administrador',
    };

    setProcessChecklist((prev) => [...prev, newItem]);
    setNewChecklistText('');
    setChecklistError('');

    const { error } = await supabase.from('process_events').insert({
      org_id: (editingUser as AdminProcessRow | null)?.organizationId || currentUser.organizationId || null,
      process_id: processId,
      tipo: 'observacao',
      mensagem: `${CHECKLIST_EVENT_PREFIX}${JSON.stringify({ action: 'add', itemId, text: normalizedText, actorName: currentUser.name || 'Administrador' })}`,
      created_by: currentUser.id,
    });

    if (error) {
      setChecklistError('Não foi possível salvar o novo item do checklist.');
      setProcessChecklist((prev) => prev.filter((item) => item.id !== itemId));
    }
  };

  const handleToggleChecklistItem = async (itemId: string, completed: boolean) => {
    const processId = getEditingProcessRecordId(editingUser);
    if (!processId) return;

    setChecklistError('');
    setProcessChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, completed, updatedAt: new Date().toISOString() } : item
      )
    );

    const { error } = await supabase.from('process_events').insert({
      org_id: (editingUser as AdminProcessRow | null)?.organizationId || currentUser.organizationId || null,
      process_id: processId,
      tipo: 'observacao',
      mensagem: `${CHECKLIST_EVENT_PREFIX}${JSON.stringify({ action: 'toggle', itemId, completed, actorName: currentUser.name || 'Administrador' })}`,
      created_by: currentUser.id,
    });

    if (error) {
      setChecklistError('Não foi possível atualizar o checklist.');
      setProcessChecklist((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, completed: !completed } : item))
      );
    }
  };

  const handleEditChecklistItem = async (itemId: string, text: string) => {
    const processId = getEditingProcessRecordId(editingUser);
    const normalizedText = sanitizeDisplayValue(text);
    if (!processId || !normalizedText) return;

    setChecklistError('');
    const currentItem = processChecklist.find((item) => item.id === itemId);
    if (!currentItem) return;

    setProcessChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, text: normalizedText, updatedAt: new Date().toISOString(), updatedByName: currentUser.name || 'Administrador' }
          : item
      )
    );

    const { error } = await supabase.from('process_events').insert({
      org_id: (editingUser as AdminProcessRow | null)?.organizationId || currentUser.organizationId || null,
      process_id: processId,
      tipo: 'observacao',
      mensagem: `${CHECKLIST_EVENT_PREFIX}${JSON.stringify({ action: 'edit', itemId, text: normalizedText, actorName: currentUser.name || 'Administrador' })}`,
      created_by: currentUser.id,
    });

    if (error) {
      setChecklistError('Não foi possível editar o item do checklist.');
      setProcessChecklist((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, text: currentItem.text, updatedAt: currentItem.updatedAt, updatedByName: currentItem.updatedByName }
            : item
        )
      );
      return;
    }

    setEditingChecklistItemId(null);
    setEditingChecklistText('');
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    const processId = getEditingProcessRecordId(editingUser);
    if (!processId) return;

    setChecklistError('');
    const previousItems = processChecklist;
    setProcessChecklist((prev) => prev.filter((item) => item.id !== itemId));
    if (editingChecklistItemId === itemId) {
      setEditingChecklistItemId(null);
      setEditingChecklistText('');
    }

    const { error } = await supabase.from('process_events').insert({
      org_id: (editingUser as AdminProcessRow | null)?.organizationId || currentUser.organizationId || null,
      process_id: processId,
      tipo: 'observacao',
      mensagem: `${CHECKLIST_EVENT_PREFIX}${JSON.stringify({ action: 'delete', itemId, actorName: currentUser.name || 'Administrador' })}`,
      created_by: currentUser.id,
    });

    if (error) {
      setChecklistError('Não foi possível excluir o item do checklist.');
      setProcessChecklist(previousItems);
    }
  };


  const fetchProcesses = async () => {
    setProcessesLoading(true);
    setProcessesError('');

    const normalizedUserId = sanitizeDisplayValue(currentUser.id);
    const canFilterByUserId = Boolean(normalizedUserId);
    const normalizedOrgId = sanitizeDisplayValue(currentUser.organizationId);
    const { allowedOrgIds, hasGlobalScope, error: scopeError } = await resolveOrganizationScope();
    const hasGlobalOrganizationScope = hasGlobalScope && !normalizedOrgId;

    if (scopeError) {
      setProcessesError('Não foi possível validar o escopo de organização do usuário.');
      setDbProcesses([]);
      setProcessesLoading(false);
      return;
    }

    if (!hasGlobalOrganizationScope && !normalizedOrgId) {
      setProcessesError('Filtro por organização obrigatório para este perfil.');
      setDbProcesses([]);
      setProcessesLoading(false);
      return;
    }

    if (normalizedOrgId && !hasGlobalOrganizationScope && !allowedOrgIds.has(normalizedOrgId)) {
      setProcessesError('Escopo de organização inválido para este usuário.');
      setDbProcesses([]);
      setProcessesLoading(false);
      return;
    }

    const persistDashboardAudit = async (resultCount: number) => {
      if (!normalizedUserId) return;

      const auditPayload = {
        actor_user_id: normalizedUserId,
        event_code: 'dashboard_module_consulted',
        details: {
          profile: currentUser.role,
          org: normalizedOrgId || null,
          module: 'dashboard_unificado',
          resultCount,
          orgFilterApplied: Boolean(normalizedOrgId),
          hasGlobalOrganizationScope,
        },
      };

      const { error: auditError } = await supabase.from('financial_audit_events').insert(auditPayload);
      if (auditError) {
        console.warn('[dashboard] falha ao registrar auditoria mínima de consulta', auditError);
      }
    };

    const queryWithOptionalColumns = supabase
      .from('processes')
      .select(PROCESS_SELECT_WITH_OPTIONAL_COLUMNS)
      .order('created_at', { ascending: false });

    if (normalizedOrgId) {
      queryWithOptionalColumns.eq('org_id', normalizedOrgId);
    }

    if (isClientScope) {
      if (!canFilterByUserId) {
        setProcessesError('Usuário cliente sem identificação válida para filtrar processos.');
        setDbProcesses([]);
        setProcessesLoading(false);
        return;
      }
      queryWithOptionalColumns.or(`cliente_user_id.eq.${normalizedUserId},responsavel_user_id.eq.${normalizedUserId}`);
    }

    let { data, error } = await queryWithOptionalColumns;

    if (error && isClientScope && canFilterByUserId && String(error.message || '').includes('cliente_user_id')) {
      const clientFallbackQuery = supabase
        .from('processes')
        .select(PROCESS_SELECT_WITH_OPTIONAL_COLUMNS)
        .order('created_at', { ascending: false })
        .eq('responsavel_user_id', normalizedUserId);
      const fallbackResponse = await clientFallbackQuery;
      data = fallbackResponse.data;
      error = fallbackResponse.error;
    }

    if (!error) {
      const rows = ((data as DbProcess[] | null) || []).map((process) => normalizeProcessOptionalFields(process));
      setDbProcesses(rows);
      await persistDashboardAudit(rows.length);
      setProcessesLoading(false);
      return;
    }

    logProcessesQueryError('falha na query com colunas opcionais', error);

    if (hasMissingOptionalProcessColumns(error)) {
      const fallbackQuery = supabase
        .from('processes')
        .select(PROCESS_SELECT_BASE_COLUMNS)
        .order('created_at', { ascending: false });

      if (normalizedOrgId) {
        fallbackQuery.eq('org_id', normalizedOrgId);
      }

      if (isClientScope && canFilterByUserId) {
        fallbackQuery.or(`cliente_user_id.eq.${normalizedUserId},responsavel_user_id.eq.${normalizedUserId}`);
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;

      if (!fallbackError) {
        const normalizedProcesses = ((fallbackData as DbProcess[] | null) || []).map((process) =>
          normalizeProcessOptionalFields(process)
        );

        setDbProcesses(normalizedProcesses);
        await persistDashboardAudit(normalizedProcesses.length);
        setProcessesError('Banco ainda sem colunas opcionais (data_prazo, gestor_servico, observacoes). Processos carregados em modo compatível.');
        setProcessesLoading(false);
        return;
      }

      logProcessesQueryError('falha também na query de fallback sem colunas opcionais', fallbackError);
    }

    setProcessesError('Não foi possível carregar os processos recebidos no banco. Exibindo a base local disponível.');
    setDbProcesses([]);
    setProcessesLoading(false);
  };

  useEffect(() => {
    if (!isClientScope) {
      clientJourneyLastProcessIdRef.current = null;
      setClientJourneyHistory([]);
      setClientJourneyLoading(false);
      return;
    }

    const processId = clientPrimaryProcess?.id ?? null;
    if (!processId) {
      clientJourneyLastProcessIdRef.current = null;
      setClientJourneyHistory([]);
      setClientJourneyLoading(false);
      return;
    }

    if (clientJourneyLastProcessIdRef.current === processId) {
      return;
    }

    clientJourneyLastProcessIdRef.current = processId;
    let cancelled = false;

    const loadClientJourneyHistory = async () => {
      setClientJourneyLoading(true);
      const { data, error } = await supabase
        .from('process_events')
        .select('id,mensagem,created_at')
        .eq('process_id', processId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (cancelled) {
        return;
      }

      if (error) {
        setClientJourneyHistory([]);
        setClientJourneyLoading(false);
        return;
      }

      const compactHistory = ((data || []) as Array<{ id: string; mensagem?: string | null; created_at?: string | null }>).map((event) => ({
        id: event.id,
        dateLabel: event.created_at ? new Date(event.created_at).toLocaleString('pt-BR') : 'Sem data',
        message: sanitizeDisplayValue(event.mensagem) || 'Atualização registrada.',
      }));

      setClientJourneyHistory(compactHistory);
      setClientJourneyLoading(false);
    };

    void loadClientJourneyHistory();

    return () => {
      cancelled = true;
    };
  }, [clientPrimaryProcess?.id, isClientScope]);

  const handleCreateProcess = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProcessActionFeedback(null);

    const selectedOrganization = organizations.find((organization) => organization.id === newProcessForm.organizationId);

    if (!selectedOrganization) {
      setProcessActionFeedback({ type: 'error', message: 'Selecione uma organização válida para criar o processo.' });
      return;
    }

    const { allowedOrgIds, hasGlobalScope, error: scopeError } = await resolveOrganizationScope();
    if (scopeError) {
      setProcessActionFeedback({ type: 'error', message: 'Não foi possível validar o escopo da organização.' });
      return;
    }
    if (!hasGlobalScope && !allowedOrgIds.has(selectedOrganization.id)) {
      setProcessActionFeedback({ type: 'error', message: 'Você não possui permissão para criar processo nesta organização.' });
      return;
    }

    if (!sanitizeDisplayValue(newProcessForm.clientName)) {
      setProcessActionFeedback({ type: 'error', message: 'Informe o nome do cliente para criar o processo.' });
      return;
    }

    setCreatingProcess(true);

    const processTitle =
      sanitizeDisplayValue(newProcessForm.title) ||
      `Processo manual - ${sanitizeDisplayValue(newProcessForm.clientName)}`;

    const processPayload = {
      org_id: selectedOrganization.id,
      titulo: processTitle,
      status: 'cadastro' as const,
      cliente_nome: sanitizeDisplayValue(newProcessForm.clientName),
      cliente_documento: sanitizeDisplayValue(newProcessForm.clientDocument) || null,
      cliente_contato: sanitizeDisplayValue(newProcessForm.clientContact) || null,
      responsavel_user_id: currentUser.id,
      origem_canal: 'painel',
      unidade_atendimento: newProcessForm.serviceUnit,
      org_nome_solicitado: selectedOrganization.name,
      os_value: typeof newProcessForm.osValue === 'number' ? newProcessForm.osValue : null,
    };

    const { data: createdProcess, error: processInsertError } = await supabase
      .from('processes')
      .insert(processPayload)
      .select(PROCESS_SELECT_BASE_COLUMNS)
      .single();

    if (processInsertError || !createdProcess) {
      setCreatingProcess(false);
      setProcessActionFeedback({ type: 'error', message: 'Não foi possível criar o processo manualmente no banco.' });
      return;
    }

    await supabase.from('process_events').insert({
      org_id: selectedOrganization.id,
      process_id: createdProcess.id,
      tipo: 'registro',
      mensagem: `Processo criado manualmente pelo painel administrativo para ${sanitizeDisplayValue(newProcessForm.clientName)}.`,
      created_by: currentUser.id,
    });

    setDbProcesses((prev) => [normalizeProcessOptionalFields(createdProcess as DbProcess), ...prev]);
    setProcessActionFeedback({ type: 'success', message: 'Processo criado com sucesso e adicionado à lista.' });
    setCreatingProcess(false);
    setShowCreateProcessModal(false);
    resetNewProcessForm();
  };

  const handleGoToCheckout = async (selected: AdminProcessRow | User) => {
    const processRow = selected as AdminProcessRow;
    const amount = Number(processRow.osValue ?? processRow.valor ?? 0);
    if (amount <= 0) {
      window.alert('Valor do pagamento não definido para este processo.');
      return;
    }
    setRedirectingCheckout(true);
    try {
      const session = await createCheckoutSession({
        amount: Math.round(amount * 100),
        currency: 'brl',
        successUrl: `${window.location.origin}/#/payments/success?processId=${processRow.processRecordId || processRow.id}`,
        cancelUrl: `${window.location.origin}/#/payments/cancel?processId=${processRow.processRecordId || processRow.id}`,
        processId: processRow.processRecordId || processRow.id,
        clientId: currentUser.id,
        serviceId: '',
        organizationId: processRow.organizationId,
        areaId: '',
        sectorId: '',
      });
      if (session.url) {
        window.location.assign(session.url);
      }
    } catch (err) {
      console.error('Erro ao criar checkout:', err);
      window.alert('Não foi possível iniciar o pagamento. Tente novamente mais tarde.');
    } finally {
      setRedirectingCheckout(false);
    }
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

    const statusLabelMap: Record<'cadastro' | 'triagem' | 'analise' | 'concluido', string> = {
      cadastro: 'cadastro',
      triagem: 'triagem',
      analise: 'análise',
      concluido: 'concluído',
    };

    const previousStatus = statusMap[(currentEditingUser as AdminProcessRow | null)?.status || ProcessStatus.PENDENTE];
    const previousDeadline = sanitizeDisplayValue((currentEditingUser as AdminProcessRow | null)?.deadline);
    const previousServiceManager = sanitizeDisplayValue((currentEditingUser as AdminProcessRow | null)?.serviceManager);
    const previousNotes = sanitizeDisplayValue((currentEditingUser as AdminProcessRow | null)?.notes);

    setEditingProfileSaving(true);
    setEditingProfileError('');

    const normalizedDeadline = sanitizeDisplayValue(deadline);
    const normalizedNotes = sanitizeDisplayValue(notes);
    const normalizedServiceManager = sanitizeDisplayValue(serviceManager);
    const nextStatus = statusMap[status];

    const statusChanged = previousStatus !== nextStatus;
    const deadlineChanged = previousDeadline !== normalizedDeadline;
    const serviceManagerChanged = previousServiceManager !== normalizedServiceManager;
    const notesChanged = previousNotes !== normalizedNotes;

    if (normalizedDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDeadline)) {
      setEditingProfileError('Data de prazo inválida. Use o calendário para selecionar uma data válida.');
      setEditingProfileSaving(false);
      return;
    }

    let processUpdateError = '';
    if (processRecordId) {
      const processUpdatePayload = {
        status: nextStatus,
        data_prazo: normalizedDeadline || null,
        gestor_servico: normalizedServiceManager || null,
        observacoes: normalizedNotes || null,
      };

      const { error } = await supabase
        .from('processes')
        .update(processUpdatePayload)
        .eq('id', processRecordId);

      if (error) {
        processUpdateError = 'Não foi possível atualizar status, prazo, gestor e observações do processo no banco.';
      } else {
        setDbProcesses((prev) =>
          prev.map((process) => (process.id === processRecordId ? { ...process, ...processUpdatePayload } : process))
        );
      }
    }

    if (processRecordId && !processUpdateError) {
      setProcessVisualOverrides((prev) => {
        const existing = prev[processRecordId] || {};
        const nextEntry = {
          ...existing,
          deadline: normalizedDeadline || undefined,
          notes: normalizedNotes || undefined,
          serviceManager: normalizedServiceManager || undefined,
        };

        if (!nextEntry.deadline && !nextEntry.notes && !nextEntry.serviceManager) {
          const { [processRecordId]: _removed, ...rest } = prev;
          return rest;
        }

        return { ...prev, [processRecordId]: nextEntry };
      });

      const processEventsPayload: Array<Record<string, unknown>> = [];
      const processOrgId = (currentEditingUser as AdminProcessRow | null)?.organizationId || currentUser.organizationId || null;

      if (statusChanged) {
        processEventsPayload.push({
          org_id: processOrgId,
          process_id: processRecordId,
          tipo: 'status_change',
          mensagem: `Status alterado de "${statusLabelMap[previousStatus]}" para "${statusLabelMap[nextStatus]}".`,
          created_by: currentUser.id,
        });
      }

      if (serviceManagerChanged) {
        const previousManagerLabel = previousServiceManager || 'Não definido';
        const nextManagerLabel = normalizedServiceManager || 'Não definido';
        processEventsPayload.push({
          org_id: processOrgId,
          process_id: processRecordId,
          tipo: 'atribuicao',
          mensagem: `Responsável do serviço alterado de ${previousManagerLabel} para ${nextManagerLabel}.`,
          created_by: currentUser.id,
        });
      }

      if (deadlineChanged) {
        const previousDeadlineLabel = previousDeadline ? formatDeadlineForDisplay(previousDeadline) : 'Não definido';
        const nextDeadlineLabel = normalizedDeadline ? formatDeadlineForDisplay(normalizedDeadline) : 'Não definido';
        processEventsPayload.push({
          org_id: processOrgId,
          process_id: processRecordId,
          tipo: 'observacao',
          mensagem: `Prazo atualizado de ${previousDeadlineLabel} para ${nextDeadlineLabel}.`,
          created_by: currentUser.id,
        });
      }

      if (notesChanged && normalizedNotes) {
        processEventsPayload.push({
          org_id: processOrgId,
          process_id: processRecordId,
          tipo: 'observacao',
          mensagem: `Observação registrada: ${normalizedNotes}.`,
          created_by: currentUser.id,
        });
      }

      if (processEventsPayload.length > 0) {
        await supabase.from('process_events').insert(processEventsPayload);
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
        deadline: normalizedDeadline,
        notes: normalizedNotes,
        serviceManager: normalizedServiceManager,
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

  const handleDeleteProcess = async (process: AdminProcessRow) => {
    const processId = sanitizeDisplayValue(process.processRecordId || process.id);
    if (!processId) return;

    const confirmed = window.confirm(`Deseja realmente excluir o processo ${process.protocol}? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;

    setProcessActionFeedback(null);

    const { error: deleteEventsError } = await supabase
      .from('process_events')
      .delete()
      .eq('process_id', processId);

    if (deleteEventsError) {
      setProcessActionFeedback({ type: 'error', message: 'Não foi possível excluir os eventos do processo.' });
      return;
    }

    const { error: deleteProcessError } = await supabase
      .from('processes')
      .delete()
      .eq('id', processId);

    if (deleteProcessError) {
      setProcessActionFeedback({ type: 'error', message: 'Não foi possível excluir o processo selecionado.' });
      return;
    }

    setDbProcesses((previous) => previous.filter((row) => row.id !== processId));
    if (editingUser && sanitizeDisplayValue((editingUser as AdminProcessRow).processRecordId || editingUser.id) === processId) {
      setEditingUser(null);
    }
    if (selectedUser && sanitizeDisplayValue((selectedUser as AdminProcessRow).processRecordId || selectedUser.id) === processId) {
      setSelectedUser(null);
    }

    setProcessActionFeedback({ type: 'success', message: `Processo ${process.protocol} excluído com sucesso.` });
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
          org_name: extractOrganizationName(profile.organizations) || defaultOrgName,
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
    setNewProcessForm((prev) => ({
      ...prev,
      organizationId: prev.organizationId || newAdminOrgId || loadedOrganizations[0]?.id || '',
    }));
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

    const { allowedOrgIds, hasGlobalScope, error: membershipScopeError } = await resolveOrganizationScope();
    if (membershipScopeError) {
      setClientsError('Não foi possível validar o escopo de acesso do usuário.');
      setClientsLoading(false);
      return;
    }
    if (!hasGlobalScope && allowedOrgIds.size === 0) {
      setClientsData([]);
      setClientsLoading(false);
      return;
    }

    const membersQuery = supabase
      .from('org_members')
      .select('org_id,user_id,role,organizations(name)')
      .order('created_at', { ascending: false });
    const { data: memberRows, error: membersError } = !hasGlobalScope
      ? await membersQuery.in('org_id', Array.from(allowedOrgIds))
      : await membersQuery;

    if (membersError) {
      setClientsError('Não foi possível carregar os membros da tabela org_members.');
      setClientsLoading(false);
      return;
    }

    const scopedMembers = (memberRows || []).filter((member) => hasGlobalScope || allowedOrgIds.has(member.org_id));

    if (scopedMembers.length === 0) {
      setClientsData([]);
      setClientsLoading(false);
      return;
    }

    const userIds = Array.from(new Set(scopedMembers.map((member) => member.user_id)));
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id,nome_completo,email,created_at')
      .in('id', userIds);

    if (profileError) {
      console.warn('[clientes] falha ao carregar perfis; exibindo listagem parcial', profileError);
      setClientsError('Alguns dados de perfil não puderam ser carregados agora. A listagem exibida pode estar parcial.');
    } else {
      setClientsError('');
    }

    const profileMap = new Map(((profileRows || []) as Array<{ id: string; nome_completo?: string | null; email?: string | null; created_at?: string | null }>).map((row) => [row.id, row]));

    const normalizedClients: ClientProfileView[] = scopedMembers.map((member) => {
      const profile = profileMap.get(member.user_id);
      const email = profile?.email || 'sem-email@nao-informado';
      const nome =
        profile?.nome_completo ||
        (email !== 'sem-email@nao-informado' ? String(email).split('@')[0] : `Usuário ${member.user_id.slice(0, 8)}`);

      return {
        id: `${member.org_id}-${member.user_id}`,
        user_id: member.user_id,
        org_id: member.org_id,
        org_name: extractOrganizationName(member.organizations) || 'Organização Padrão',
        nome,
        email,
        accessLevel: mapOrgRoleToAccessLevel(member.role),
        source: profile ? 'org_members+profiles' : 'org_members_only',
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

  const resetNewClientForm = () => {
    setNewClientForm({
      fullName: '',
      email: '',
      phone: '',
      documentId: '',
      taxId: '',
      address: '',
      country: 'Brasil',
      maritalStatus: 'Solteiro',
      organizationId: organizations[0]?.id || '',
      accessLevel: 'Cliente',
      grantSystemAccess: false,
    });
    setClientFormError('');
    setClientFormSuccess('');
  };

  const handleCreateClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClientFormError('');
    setClientFormSuccess('');

    const name = sanitizeDisplayValue(newClientForm.fullName);
    const email = sanitizeDisplayValue(newClientForm.email);
    const selectedOrg = organizations.find((org) => org.id === newClientForm.organizationId);

    if (!name) {
      setClientFormError('Informe o nome do cliente.');
      return;
    }

    if (!email) {
      setClientFormError('Informe o e-mail do cliente.');
      return;
    }

    if (!selectedOrg) {
      setClientFormError('Selecione uma organização válida.');
      return;
    }

    setCreatingClient(true);

    try {
      const normalizedRole = mapAccessLevelToOrgRole(newClientForm.accessLevel);

      if (newClientForm.grantSystemAccess) {
        const { data: existingProfile, error: lookupError } = await supabase
          .from('profiles')
          .select('id,email')
          .eq('email', email)
          .maybeSingle();

        if (lookupError) {
          setClientFormError('Não foi possível validar o perfil no banco de dados.');
          return;
        }

        if (!existingProfile?.id) {
          setClientFormError('Para liberar acesso ao sistema, este e-mail precisa já ter conta criada no Auth.');
          return;
        }

        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({
            nome_completo: name,
            name,
            documento_identidade: sanitizeDisplayValue(newClientForm.documentId) || null,
            nif_cpf: sanitizeDisplayValue(newClientForm.taxId) || null,
            estado_civil: sanitizeDisplayValue(newClientForm.maritalStatus) || null,
            phone: sanitizeDisplayValue(newClientForm.phone) || null,
            endereco: sanitizeDisplayValue(newClientForm.address) || null,
            pais: sanitizeDisplayValue(newClientForm.country) || null,
            role: newClientForm.accessLevel,
            org_id: selectedOrg.id,
          })
          .eq('id', existingProfile.id);

        if (updateProfileError) {
          setClientFormError('Não foi possível atualizar o perfil do cliente.');
          return;
        }

        const { error: upsertMemberError } = await supabase
          .from('org_members')
          .upsert(
            {
              org_id: selectedOrg.id,
              user_id: existingProfile.id,
              role: normalizedRole,
            },
            { onConflict: 'org_id,user_id' }
          );

        if (upsertMemberError) {
          setClientFormError('Perfil atualizado, mas não foi possível vincular cliente à organização.');
          return;
        }

        await fetchClients();
      } else {
        const tempId = `local-${Date.now()}`;
        const now = new Date().toLocaleString('pt-BR');

        setUsers((prev) => [
          {
            id: tempId,
            name,
            email,
            role: UserRole.CLIENT,
            documentId: sanitizeDisplayValue(newClientForm.documentId) || '---',
            taxId: sanitizeDisplayValue(newClientForm.taxId) || '---',
            address: sanitizeDisplayValue(newClientForm.address) || '---',
            maritalStatus: sanitizeDisplayValue(newClientForm.maritalStatus) || '---',
            country: sanitizeDisplayValue(newClientForm.country) || '---',
            phone: sanitizeDisplayValue(newClientForm.phone) || '---',
            unit: ServiceUnit.ADMINISTRATIVO,
            status: ProcessStatus.PENDENTE,
            protocol: `CLI-${new Date().getFullYear()}-${String(prev.length + 1).padStart(3, '0')}`,
            registrationDate: now,
            lastUpdate: now,
            hierarchy: Hierarchy.NOTES_ONLY,
            organizationId: selectedOrg.id,
            organizationName: selectedOrg.name,
          },
          ...prev,
        ]);

        setClientsData((prev) => [
          {
            id: `${selectedOrg.id}-${tempId}`,
            user_id: tempId,
            org_id: selectedOrg.id,
            org_name: selectedOrg.name,
            nome: name,
            email,
            accessLevel: newClientForm.accessLevel,
            source: 'local_manual',
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }

      setClientFormSuccess('Cliente cadastrado com sucesso.');
      resetNewClientForm();
      setShowCreateClientModal(false);
    } finally {
      setCreatingClient(false);
    }
  };

  const handleStartEditClient = async (client: ClientProfileView) => {
    setEditingClient(client);
    setClientEditError('');
    setClientEditSuccess('');

    const baseForm: EditClientFormState = {
      fullName: client.nome,
      email: client.email === 'sem-email@nao-informado' ? '' : client.email,
      phone: '',
      documentId: '',
      taxId: '',
      address: '',
      country: 'Brasil',
      maritalStatus: 'Solteiro',
      organizationId: client.org_id,
      accessLevel: client.accessLevel,
    };

    setEditClientForm(baseForm);
    setShowEditClientModal(true);

    if (client.user_id.startsWith('local-')) {
      const localUser = users.find((user) => user.id === client.user_id);
      if (!localUser) return;
      setEditClientForm({
        fullName: localUser.name || baseForm.fullName,
        email: localUser.email || baseForm.email,
        phone: localUser.phone === '---' ? '' : localUser.phone,
        documentId: localUser.documentId === '---' ? '' : localUser.documentId,
        taxId: localUser.taxId === '---' ? '' : localUser.taxId,
        address: localUser.address === '---' ? '' : localUser.address,
        country: localUser.country === '---' ? 'Brasil' : localUser.country,
        maritalStatus: localUser.maritalStatus === '---' ? 'Solteiro' : localUser.maritalStatus,
        organizationId: localUser.organizationId || baseForm.organizationId,
        accessLevel: client.accessLevel,
      });
      return;
    }

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('nome_completo,nome,email,phone,documento_identidade,nif_cpf,endereco,pais,estado_civil')
      .eq('id', client.user_id)
      .maybeSingle();

    if (error) {
      setClientEditError('Não foi possível carregar todos os dados do cliente. Você ainda pode editar os campos disponíveis.');
      return;
    }

    if (!profileData) return;

    setEditClientForm({
      fullName: sanitizeDisplayValue(profileData.nome_completo) || sanitizeDisplayValue(profileData.nome) || baseForm.fullName,
      email: sanitizeDisplayValue(profileData.email) || baseForm.email,
      phone: sanitizeDisplayValue(profileData.phone),
      documentId: sanitizeDisplayValue(profileData.documento_identidade),
      taxId: sanitizeDisplayValue(profileData.nif_cpf),
      address: sanitizeDisplayValue(profileData.endereco),
      country: sanitizeDisplayValue(profileData.pais) || 'Brasil',
      maritalStatus: sanitizeDisplayValue(profileData.estado_civil) || 'Solteiro',
      organizationId: baseForm.organizationId,
      accessLevel: client.accessLevel,
    });
  };

  const handleSaveClientEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingClient) return;

    setClientEditError('');
    setClientEditSuccess('');

    const selectedOrg = organizations.find((org) => org.id === editClientForm.organizationId);
    if (!selectedOrg) {
      setClientEditError('Selecione uma organização válida.');
      return;
    }

    const normalizedName = sanitizeDisplayValue(editClientForm.fullName);
    if (!normalizedName) {
      setClientEditError('Informe o nome do cliente.');
      return;
    }

    setSavingClientEdit(true);

    try {
      if (editingClient.user_id.startsWith('local-')) {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === editingClient.user_id
              ? {
                  ...user,
                  name: normalizedName,
                  email: sanitizeDisplayValue(editClientForm.email) || user.email,
                  phone: sanitizeDisplayValue(editClientForm.phone) || '---',
                  documentId: sanitizeDisplayValue(editClientForm.documentId) || '---',
                  taxId: sanitizeDisplayValue(editClientForm.taxId) || '---',
                  address: sanitizeDisplayValue(editClientForm.address) || '---',
                  country: sanitizeDisplayValue(editClientForm.country) || '---',
                  maritalStatus: sanitizeDisplayValue(editClientForm.maritalStatus) || '---',
                  organizationId: selectedOrg.id,
                  organizationName: selectedOrg.name,
                }
              : user
          )
        );
      } else {
        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({
            nome_completo: normalizedName,
            name: normalizedName,
            email: sanitizeDisplayValue(editClientForm.email) || null,
            phone: sanitizeDisplayValue(editClientForm.phone) || null,
            documento_identidade: sanitizeDisplayValue(editClientForm.documentId) || null,
            nif_cpf: sanitizeDisplayValue(editClientForm.taxId) || null,
            endereco: sanitizeDisplayValue(editClientForm.address) || null,
            pais: sanitizeDisplayValue(editClientForm.country) || null,
            estado_civil: sanitizeDisplayValue(editClientForm.maritalStatus) || null,
            role: editClientForm.accessLevel,
            org_id: selectedOrg.id,
          })
          .eq('id', editingClient.user_id);

        if (updateProfileError) {
          setClientEditError('Não foi possível atualizar os dados de perfil do cliente.');
          return;
        }

        const { error: upsertMemberError } = await supabase
          .from('org_members')
          .upsert(
            {
              org_id: selectedOrg.id,
              user_id: editingClient.user_id,
              role: mapAccessLevelToOrgRole(editClientForm.accessLevel),
            },
            { onConflict: 'org_id,user_id' }
          );

        if (upsertMemberError) {
          setClientEditError('Perfil atualizado, mas houve erro ao atualizar vínculo da organização.');
          return;
        }
      }

      setClientsData((prev) =>
        prev.map((client) =>
          client.id === editingClient.id
            ? {
                ...client,
                nome: normalizedName,
                email: sanitizeDisplayValue(editClientForm.email) || 'sem-email@nao-informado',
                org_id: selectedOrg.id,
                org_name: selectedOrg.name,
                accessLevel: editClientForm.accessLevel,
              }
            : client
        )
      );

      setClientEditSuccess('Cadastro do cliente atualizado com sucesso.');
      setShowEditClientModal(false);
      setEditingClient(null);
      await fetchClients();
    } finally {
      setSavingClientEdit(false);
    }
  };
  const handleDeleteClient = async (client: ClientProfileView) => {
    if (!window.confirm(`Deseja realmente remover ${client.nome} da lista de clientes?`)) return;

    if (client.user_id.startsWith('local-')) {
      setClientsData((prev) => prev.filter((c) => c.id !== client.id));
      setUsers((prev) => prev.filter((user) => user.id !== client.user_id));
      return;
    }

    const { error: deleteError } = await supabase
      .from('org_members')
      .delete()
      .eq('user_id', client.user_id)
      .eq('org_id', client.org_id);

    if (deleteError) {
      alert('Erro ao remover cliente da organização.');
      return;
    }

    await fetchClients();
  };
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
    <AdminDashboardLayout
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      currentUserName={currentUser.name}
      hierarchyLabel={permissions.hierarchy}
      sidebarLinks={sidebarLinks}
      onLogout={onLogout}
      onPrint={handlePrint}
      onSelectSection={(nextSection) => setCurrentSection(parseSectionCandidate(nextSection) || 'dashboard')}
    >

      {currentSection === 'dashboard' && (
        <OverviewContainer>
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5 no-print">
          {dashboardHighlights.map((item) => {
            const canNavigateToHighlight = canAccessSection(item.targetSection);

            return (
            <button
              key={item.key}
              type="button"
              aria-label={item.ariaLabel}
              aria-disabled={!canNavigateToHighlight}
              disabled={!canNavigateToHighlight}
              onClick={() => {
                if (!canNavigateToHighlight) return;
                navigateToDashboardHighlight(item.targetSection, item.presetFilter);
              }}
              onKeyDown={(event) => {
                if (!canNavigateToHighlight) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigateToDashboardHighlight(item.targetSection, item.presetFilter);
                }
              }}
              className={`rounded-2xl border p-4 shadow-sm ${item.styles} min-h-[112px] text-left transition outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 ${canNavigateToHighlight ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-widest">{item.label}</p>
                <item.icon className="h-5 w-5 opacity-80" />
              </div>
              <p className="text-3xl font-black leading-none">{item.value}</p>
              <p className="mt-2 text-xs font-semibold opacity-80">{item.helper}</p>
            </button>
          )})}
        </section>
        </OverviewContainer>
      )}

      {currentSection === 'dashboard' && (
        <OverviewContainer>
        {isClientScope && (
          <section className="mb-6 no-print">
            <ClientProcessProgressPanel
              serviceName={clientPrimaryProcess?.contractedServiceName || 'Nenhum serviço contratado ainda'}
              responsibleSector={clientPrimaryProcess?.processType || 'Setor não definido'}
              currentStatus={clientPrimaryProcess ? clientStatusLabelMap[clientPrimaryProcess.status] : 'Sem processo ativo'}
              currentStepIndex={clientPrimaryProcess ? clientStepByStatus[clientPrimaryProcess.status] : 0}
              history={clientJourneyLoading ? [{ id: 'loading', dateLabel: 'Carregando', message: 'Buscando histórico do processo...' }] : clientJourneyHistory}
            />
          </section>
        )}
        <section className="mb-6 space-y-4 no-print">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-base font-black text-gray-800">Processos por status</h3>
              <p className="text-xs font-semibold text-gray-500">Distribuição atual dos processos cadastrados</p>
              <div className="mt-4 flex flex-col md:flex-row gap-6 items-center">
                <div className="relative h-40 w-40 rounded-full" style={statusDonutStyle}>
                  <div className="absolute inset-5 rounded-full bg-white flex flex-col items-center justify-center">
                    <p className="text-3xl font-black text-gray-800">{processStats.total}</p>
                    <p className="text-xs font-semibold text-gray-500">Total</p>
                  </div>
                </div>
                <div className="w-full space-y-2">
                  {statusDistribution.map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-gray-700">{item.label}</span>
                      </div>
                      <span className="font-black text-gray-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-base font-black text-gray-800">Processos em andamento por serviço</h3>
              <p className="text-xs font-semibold text-gray-500">Distribuição dos processos em andamento</p>
              <div className="mt-4 flex flex-col md:flex-row gap-6 items-center">
                <div className="relative h-40 w-40 rounded-full" style={serviceDonutStyle}>
                  <div className="absolute inset-5 rounded-full bg-white flex flex-col items-center justify-center">
                    <p className="text-3xl font-black text-gray-800">{processStats.emAndamento}</p>
                    <p className="text-xs font-semibold text-gray-500">Ativos</p>
                  </div>
                </div>
                <div className="w-full space-y-2">
                  {serviceDistribution.length === 0 ? (
                    <p className="text-sm text-gray-500 font-semibold">Sem dados para exibir.</p>
                  ) : serviceDistribution.map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-gray-700">{item.label}</span>
                      </div>
                      <span className="font-black text-gray-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <article className="xl:col-span-2 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-gray-800">Evolução dos processos</h3>
                <p className="text-xs font-bold text-blue-600">TOTAL: {dashboardHighlights[3].value} novos processos</p>
              </div>
              <p className="text-xs font-semibold text-gray-500 mb-3">Novos processos cadastrados nos últimos 7 dias</p>
              <div className="grid grid-cols-7 gap-2 items-end h-36">
                {[...Array(7)].map((_, index) => {
                  const date = new Date();
                  date.setDate(date.getDate() - (6 - index));
                  const isoDay = date.toISOString().slice(0, 10);
                  const dayCount = processRows.filter((process) => (process.registrationDate || '').slice(0, 10) === isoDay).length;
                  const barHeight = Math.max(12, dayCount * 18);

                  return (
                    <div key={isoDay} className="flex flex-col items-center gap-2">
                      <div className="w-full rounded-md bg-blue-100/80 relative" style={{ height: `${barHeight}px` }}>
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-black text-blue-600">{dayCount}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-gray-500">{isoDay.slice(8, 10)}/{isoDay.slice(5, 7)}</span>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-base font-black text-gray-800">Tempo médio em andamento</h3>
              <p className="text-xs font-semibold text-gray-500 mb-3">Média de dias por serviço</p>
              <div className="space-y-2">
                {serviceDistribution.slice(0, 3).map((service, index) => {
                  const serviceRows = processRows.filter((row) => row.processType === service.label);
                  const daysAverage = serviceRows.length === 0
                    ? 0
                    : (serviceRows.reduce((acc, row) => {
                      const diff = (Date.now() - new Date(row.registrationDate).getTime()) / (1000 * 60 * 60 * 24);
                      return acc + (Number.isFinite(diff) ? diff : 0);
                    }, 0) / serviceRows.length);
                  const cardStyles = ['bg-blue-50 text-blue-700', 'bg-emerald-50 text-emerald-700', 'bg-violet-50 text-violet-700'][index % 3];

                  return (
                    <div key={service.label} className={`rounded-xl p-3 ${cardStyles}`}>
                      <p className="text-xl font-black">{daysAverage.toFixed(1)} dias</p>
                      <p className="text-xs font-semibold">{service.label}</p>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>

          <article className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-black text-gray-800">Processos recentes</h3>
                <p className="text-xs font-semibold text-gray-500">Últimos processos cadastrados</p>
              </div>
              <button onClick={() => setProcessRowsLimit(50)} className="text-xs font-black text-blue-600">
                Ver todos os processos
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Protocolo</th>
                    <th className="px-4 py-3 text-left">OS</th>
                    <th className="px-4 py-3 text-left">Serviço</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Abertura</th>
                    <th className="px-4 py-3 text-left">Setor responsável</th>
                    <th className="px-4 py-3 text-left">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardRecentRows.map((process) => (
                    <tr key={process.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-bold text-gray-800">{process.protocol}</td>
                      <td className="px-4 py-3 text-gray-600">{process.processRecordId}</td>
                      <td className="px-4 py-3 text-gray-700">{process.processType}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant(process.status)} className="text-xs px-2 py-1">{process.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{process.startDate}</td>
                      <td className="px-4 py-3 text-gray-600">{process.serviceManager || 'Não definido'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedUser(process)} className="text-blue-600 font-bold text-xs">
                          Abrir acompanhamento
                        </button>
                      </td>
                    </tr>
                  ))}
                  {dashboardRecentRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-500 font-semibold">
                        Nenhum processo encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
        </OverviewContainer>
      )}

      {currentSection === 'configuracoes' && (
        <>
          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-100 mb-6 gap-8 no-print">
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'users' ? 'text-blue-500' : 'text-gray-500'}`}
        >
          Visualização de Usuários
          {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('management')}
          className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'management' ? 'text-blue-500' : 'text-gray-500'}`}
        >
          Gestão de Acessos
          {activeTab === 'management' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full"></div>}
        </button>
          </div>
        </>
      )}


      {currentSection === 'organizacoes' ? (
        <OrganizationsContainer>
        {canManageOrganizations ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <h3 className="text-lg font-black mb-4">CADASTRAR ORGANIZAÇÃO</h3>
            <form onSubmit={handleCreateOrganization} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">Nome da organização</label>
                <input
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                  placeholder="Ex.: Organização Alpha"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 font-semibold">
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

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <h3 className="text-lg font-black mb-4">ORGANIZAÇÕES CADASTRADAS</h3>
            <div className="space-y-3">
              {organizations.map((organization) => {
                const isEditing = editingOrganizationId === organization.id;

                return (
                  <div key={organization.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-3 shadow-[0_10px_22px_rgba(15,23,42,0.06)]">
                    {isEditing ? (
                      <>
                        <input
                          value={editingOrganizationName}
                          onChange={(event) => setEditingOrganizationName(event.target.value)}
                          className="w-full p-2 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
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
                            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold"
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
                        <p className="text-xs text-gray-500">ID: {organization.id}</p>
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
                <p className="text-gray-500 text-sm">Nenhuma organização cadastrada ainda.</p>
              )}
            </div>
          </div>
        </div>
        ) : (
          <Card className="bg-white border-gray-100 p-6">
            <p className="text-sm font-semibold text-gray-500">Você não possui permissão para gerenciar organizações.</p>
          </Card>
        )}
        </OrganizationsContainer>
      ) : currentSection === 'processos' ? (
        <ProcessesContainer>
        <div className="min-w-0 space-y-6">
          <Card className="min-w-0 bg-white border-gray-100 p-4 sm:p-5">
            <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">Processos</h3>
              </div>
              {canCreateProcess && (
                <button
                  type="button"
                  onClick={() => {
                    resetNewProcessForm();
                    setProcessActionFeedback(null);
                    setShowCreateProcessModal(true);
                  }}
                  className="inline-flex items-center gap-2 shrink-0 px-4 py-2 rounded-lg border border-blue-100 bg-blue-50 text-blue-600 font-semibold hover:bg-blue-100 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Novo processo
                </button>
              )}
            </div>
            <p className="text-gray-500 text-sm mb-4">Visão geral em formato de planilha para filtrar, acompanhar status e agir rápido.</p>
            {sectionReadOnly.processos && (
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Modo somente leitura neste escopo: visualização habilitada, ações de criação/remoção bloqueadas.</p>
            )}

            <div className="grid min-w-0 grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-2.5 sm:gap-3">
              <div className="bg-white border-l-4 border-blue-500 rounded-xl p-3 shadow-sm border border-gray-100">
                <p className="text-xs text-blue-500 uppercase">Processos</p>
                <p className="text-3xl font-black leading-none mt-1.5 text-blue-600">{processStats.total}</p>
                <p className="text-blue-600 mt-1">Total após filtros</p>
              </div>
              <div className="bg-white border-l-4 border-blue-400 rounded-xl p-3 shadow-sm border border-gray-100">
                <p className="text-xs text-blue-500 uppercase">Em andamento</p>
                <p className="text-3xl font-black leading-none mt-1.5 text-blue-600">{processStats.emAndamento}</p>
                <p className="text-blue-600 mt-1">Ativos</p>
              </div>
              <div className="bg-white border-l-4 border-green-500 rounded-xl p-3 shadow-sm border border-gray-100">
                <p className="text-xs text-green-500 uppercase">Concluídos</p>
                <p className="text-3xl font-black leading-none mt-1.5 text-green-600">{processStats.concluidos}</p>
                <p className="text-green-600 mt-1">Finalizados</p>
              </div>
              <div className="bg-white border-l-4 border-yellow-500 rounded-xl p-3 shadow-sm border border-gray-100">
                <p className="text-xs text-yellow-500 uppercase">Aguardando</p>
                <p className="text-3xl font-black leading-none mt-1.5 text-yellow-600">{processStats.aguardando}</p>
                <p className="text-yellow-600 mt-1">Pendências</p>
              </div>
              <div className="bg-white border-l-4 border-red-500 rounded-xl p-3 shadow-sm border border-gray-100">
                <p className="text-xs text-red-500 uppercase">Atrasados</p>
                <p className="text-3xl font-black leading-none mt-1.5 text-red-600">{processStats.atrasados}</p>
                <p className="text-red-600 mt-1">Prazo vencido</p>
              </div>
            </div>

            <div className="mt-4 grid min-w-0 grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="relative min-w-0 md:col-span-2 2xl:col-span-4">
                <Search className="absolute left-3 top-3 text-gray-500 w-5 h-5" />
                <input
                  value={processSearch}
                  onChange={(event) => setProcessSearch(event.target.value)}
                  placeholder="Buscar processo, título, cliente, responsável..."
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <select
                value={processStatusFilter}
                onChange={(event) => {
                  setProcessStatusFilter(event.target.value as 'all' | ProcessStatus);
                  setProcessStatusPreset('all');
                }}
                className="w-full py-3 px-4 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
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
                className="w-full py-3 px-4 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">Todos os responsáveis</option>
                {processResponsibles.map((responsible) => (
                  <option key={responsible} value={responsible}>{responsible}</option>
                ))}
              </select>
              <select
                value={processTypeFilter}
                onChange={(event) => setProcessTypeFilter(event.target.value as 'all' | ServiceUnit)}
                className="w-full py-3 px-4 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">Todos os tipos</option>
                <option value={ServiceUnit.ADMINISTRATIVO}>Administrativo</option>
                <option value={ServiceUnit.JURIDICO}>Jurídico / Advocacia</option>
                <option value={ServiceUnit.TECNOLOGICO}>Tecnológico / AI</option>
              </select>
              <select
                value={processPeriodFilter}
                onChange={(event) => setProcessPeriodFilter(event.target.value as 'all' | 'today' | '7d' | '30d')}
                className="w-full py-3 px-4 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">Todo período</option>
                <option value="today">Hoje</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
              </select>
            </div>
          </Card>

          {processesError && (
            <div className="mb-4 rounded-2xl border border-amber-700/60 bg-amber-900/20 px-4 py-3 text-sm font-bold text-amber-200">
              {processesError}
            </div>
          )}

          {processActionFeedback && (
            <div className={`mb-4 rounded-2xl px-4 py-3 text-sm font-bold ${
              processActionFeedback.type === 'success'
                ? 'border border-emerald-700/60 bg-emerald-900/20 text-emerald-200'
                : 'border border-red-700/60 bg-red-900/20 text-red-200'
            }`}>
              {processActionFeedback.message}
            </div>
          )}

          {quickPresetVisual && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wider text-blue-600">Filtro rápido ativo</p>
              <p className="text-sm font-bold text-blue-700">{quickPresetVisual.label}</p>
              <p className="text-xs font-semibold text-blue-600 mt-1">{quickPresetVisual.helper}</p>
            </div>
          )}

          <Card className="bg-white border-gray-100 rounded-2xl overflow-hidden p-0">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white">
              <div>
                <h4 className="text-2xl font-black">Lista de processos</h4>
                <p className="text-gray-500 text-sm">Mostrando {visibleProcessRows.length} de {processRows.length} resultados</p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-sm text-gray-500 font-semibold">Linhas</span>
                <select
                  value={processRowsLimit}
                  onChange={(event) => setProcessRowsLimit(Number(event.target.value))}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4 bg-gray-50/70">
              {visibleProcessRows.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-gray-500 font-semibold">
                  Nenhum processo encontrado para os filtros selecionados.
                </div>
              ) : visibleProcessRows.map((process) => (
                <article
                  key={process.id}
                  className="rounded-2xl border border-gray-100 bg-white px-4 py-4 sm:px-5 sm:py-5 hover:border-blue-200 hover:bg-gray-50 transition-all shadow-sm"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-gray-800 font-black text-lg tracking-tight break-words">{process.protocol}</p>
                          <Badge variant={process.sourceLabel === 'WIX' ? 'info' : 'neutral'} className="text-xs px-2.5 py-1">{process.sourceLabel}</Badge>
                          <Badge variant={statusBadgeVariant(process.status)} className="text-xs px-2.5 py-1">{process.status}</Badge>
                        </div>
                        <p className="text-gray-800 text-base font-semibold mt-1 break-words">{process.contractedServiceName}</p>
                        <p className="text-gray-700 text-sm mt-1 break-words"><span className="font-black uppercase tracking-wide text-[10px] text-gray-500 mr-1">Cliente:</span>{process.name}</p>
                        <p className="text-gray-500 text-xs mt-1">Etapa: {process.etapaAtual}{process.requestedOrganizationName !== 'Não informado' ? ` · ${process.requestedOrganizationName}` : ''}</p>
                      </div>

                      <div className="flex items-center gap-2 self-start xl:self-auto">
                        <button
                          onClick={() => setSelectedUser(process)}
                          className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingUser(process)}
                          className="p-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg text-white"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => void handleDeleteProcess(process)}
                          className="p-2 bg-red-500 hover:bg-red-600 rounded-lg text-white"
                          title="Excluir processo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 text-sm">
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Tipo</p>
                        <p className="text-gray-800 font-semibold mt-1">{process.processType}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Responsável</p>
                        <p className="text-gray-800 font-semibold mt-1">{process.serviceManager || 'Não definido'}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Início</p>
                        <p className="text-gray-800 font-semibold mt-1">{process.startDate}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Prazo</p>
                        <p className="text-gray-800 font-semibold mt-1">{process.deadlineDate}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Financeiro</p>
                        <p className="mt-1">
                          <Badge variant="warning" className="text-xs px-2.5 py-1">{process.financeiro}</Badge>
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Prioridade & Valor</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant="success" className="text-xs px-2.5 py-1">{process.prioridade}</Badge>
                          <span className="text-gray-800 font-black">R$ {process.valor.toLocaleString('pt-BR')}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Card>
        </div>
        </ProcessesContainer>
      ) : currentSection === 'clientes' ? (
        <ClientsContainer>
        <DashboardCardContainer className="p-6">
          <h3 className="text-lg font-black mb-4">CLIENTES</h3>

          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-3 text-gray-500 w-4 h-4" />
              <input
                value={clientsSearch}
                onChange={(event) => setClientsSearch(event.target.value)}
                placeholder="Buscar por nome..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
              />
            </div>
            <select
              value={clientsSort}
              onChange={(event) => setClientsSort(event.target.value as 'name_asc' | 'name_desc' | 'recent')}
              className="w-full py-2 px-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
            >
              <option value="name_asc">Ordenar: Nome (A-Z)</option>
              <option value="name_desc">Ordenar: Nome (Z-A)</option>
              <option value="recent">Ordenar: Mais recentes</option>
            </select>
            <select
              value={clientsRowsLimit}
              onChange={(event) => setClientsRowsLimit(Number(event.target.value))}
              className="w-full py-2 px-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
            >
              <option value={10}>Mostrar 10</option>
              <option value={25}>Mostrar 25</option>
              <option value={50}>Mostrar 50</option>
            </select>
          </div>

          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            {clientsError && <p className="text-sm text-amber-600 font-bold">{clientsError}</p>}
            <div className="flex items-center gap-3 text-xs text-gray-500 font-bold ml-auto">
              <span>Total: {clientsData.length}</span>
              <span>Exibindo: {visibleClients.length}</span>
            </div>
            <button
              onClick={() => {
                resetNewClientForm();
                setShowCreateClientModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase rounded-lg transition-colors"
            >
              + Novo Cliente
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-gray-50">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Nível</th>
                  <th className="px-6 py-4">Organização</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Origem</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {clientsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Carregando membros...</td>
                  </tr>
                ) : visibleClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Nenhum membro encontrado.</td>
                  </tr>
                ) : visibleClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-gray-800">{client.nome}</td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black text-blue-400 uppercase border border-blue-900/50 bg-blue-900/10 px-2 py-0.5 rounded">
                        {client.accessLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-bold">{client.org_name}</td>
                    <td className="px-6 py-4 text-gray-500 font-bold">{client.email}</td>
                    <td className="px-6 py-4 text-gray-400 text-[10px] font-bold uppercase">
                      {client.source === 'local_manual' ? 'Manual' : client.source === 'org_members+profiles' ? 'Sistema' : 'Sistema'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleStartEditClient(client)}
                          className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-500 hover:text-white transition-colors"
                          title="Editar cliente"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client)}
                          className="p-2 bg-red-900/20 hover:bg-red-900/40 rounded-md text-red-500 transition-colors"
                          title="Remover cliente"
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
        </DashboardCardContainer>
        </ClientsContainer>
      ) : currentSection === 'relatorios' ? (
        <section className="no-print">
          <ReportsPage
            defaultOrgId={currentUser.organizationId ?? null}
            operationalOnly={!canViewAllReports}
          />
        </section>
      ) : currentSection === 'configuracoes' && activeTab === 'users' ? (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-2.5 text-gray-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Pesquise Por: Nome, Protocolo ou E-mail"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-full text-gray-800 text-sm font-semibold placeholder:text-gray-600 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-[10px] font-black uppercase">Total de Registros:</span>
              <span className="bg-blue-50 px-2 py-0.5 rounded-md text-blue-600 font-bold text-xs">{filteredUsers.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
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
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-700">{user.name}</td>
                    <td className="px-6 py-4 text-gray-500 font-bold">{user.phone} ({user.country})</td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded-md text-[10px] font-black">{user.protocol}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${
                        user.status === ProcessStatus.PENDENTE ? 'bg-gray-200 text-gray-700' :
                        user.status === ProcessStatus.TRIAGEM ? 'bg-yellow-600' :
                        user.status === ProcessStatus.ANALISE ? 'bg-orange-600' : 'bg-emerald-600'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-[10px] font-bold">
                       {user.lastUpdate || user.registrationDate}
                    </td>
                    <td className="px-6 py-4 text-right no-print">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setSelectedUser(user)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600"
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
      ) : currentSection === 'configuracoes' ? (
        /* Management Tab Content */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-1 bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Plus className="text-blue-500" /> Cadastrar Usuário e Nível
              </h3>
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
                 <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Hierarquia / Nível</label>
                    <div className="space-y-2 mt-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700 font-bold">
                        <input type="radio" name="new_hierarchy_radio" className="w-4 h-4 accent-blue-500" checked={newAdminHierarchy === Hierarchy.FULL} onChange={() => setNewAdminHierarchy(Hierarchy.FULL)} />
                        Alteração e Edição
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 font-bold">
                        <input type="radio" name="new_hierarchy_radio" className="w-4 h-4 accent-blue-500" checked={newAdminHierarchy === Hierarchy.STATUS_ONLY} onChange={() => setNewAdminHierarchy(Hierarchy.STATUS_ONLY)} />
                        Somente Alteração
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 font-bold">
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
                    <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                      <th className="px-6 py-4">Usuário</th>
                      <th className="px-6 py-4">Nível de Acesso</th>
                      <th className="px-6 py-4">Instituição</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {membersLoading ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Carregando membros...</td>
                      </tr>
                    ) : managementUsers.map(u => (
                      <tr key={`${u.user_id}-${u.org_id}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-bold flex flex-col">
                           <span>{u.name}</span>
                           <span className="text-[10px] text-gray-500">{u.email}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black text-blue-400 uppercase border border-blue-900/50 bg-blue-900/10 px-2 py-0.5 rounded">
                            {u.accessLevel.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600 font-bold">{u.org_name || 'Organização Padrão'}</td>
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
           </div>
        </div>
      ) : null}

      {showCreateClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-3xl border border-gray-100 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-black uppercase">Cadastrar novo cliente</h3>
              <button
                onClick={() => {
                  setShowCreateClientModal(false);
                  setClientFormError('');
                  setClientFormSuccess('');
                }}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 max-h-[85vh] overflow-y-auto">
              <form onSubmit={handleCreateClient} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Nome completo</label>
                    <input
                      type="text"
                      value={newClientForm.fullName}
                      onChange={(event) => setNewClientForm((prev) => ({ ...prev, fullName: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nome completo do cliente"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">E-mail</label>
                    <input
                      type="email"
                      value={newClientForm.email}
                      onChange={(event) => setNewClientForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="cliente@empresa.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Telefone</label>
                    <input
                      type="text"
                      value={newClientForm.phone}
                      onChange={(event) => setNewClientForm((prev) => ({ ...prev, phone: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+55 (11) 99999-9999"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Documento de identidade</label>
                    <input
                      type="text"
                      value={newClientForm.documentId}
                      onChange={(event) => setNewClientForm((prev) => ({ ...prev, documentId: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="RG / BI / Passaporte"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">NIF / CPF</label>
                    <input
                      type="text"
                      value={newClientForm.taxId}
                      onChange={(event) => setNewClientForm((prev) => ({ ...prev, taxId: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Número fiscal"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Estado civil</label>
                    <input
                      type="text"
                      value={newClientForm.maritalStatus}
                      onChange={(event) => setNewClientForm((prev) => ({ ...prev, maritalStatus: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Solteiro(a), Casado(a)..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">País</label>
                    <input
                      type="text"
                      value={newClientForm.country}
                      onChange={(event) => setNewClientForm((prev) => ({ ...prev, country: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Brasil"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Organização</label>
                    <select
                      value={newClientForm.organizationId}
                      onChange={(event) => setNewClientForm((prev) => ({ ...prev, organizationId: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Selecione a organização</option>
                      {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>{organization.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Endereço</label>
                    <input
                      type="text"
                      value={newClientForm.address}
                      onChange={(event) => setNewClientForm((prev) => ({ ...prev, address: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Rua, número, complemento, cidade"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Perfil no sistema</label>
                    <select
                      value={newClientForm.accessLevel}
                      onChange={(event) => setNewClientForm((prev) => ({ ...prev, accessLevel: event.target.value as AccessLevel }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ACCESS_LEVELS.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 w-full">
                      <input
                        type="checkbox"
                        checked={newClientForm.grantSystemAccess}
                        onChange={(event) => setNewClientForm((prev) => ({ ...prev, grantSystemAccess: event.target.checked }))}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className="text-sm font-semibold text-gray-700">Cliente terá acesso ao sistema</span>
                    </label>
                  </div>
                </div>

                {clientFormError && (
                  <p className="text-sm font-bold text-red-500">{clientFormError}</p>
                )}
                {clientFormSuccess && (
                  <p className="text-sm font-bold text-emerald-600">{clientFormSuccess}</p>
                )}

                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 text-sm text-gray-600">
                  Quando o acesso ao sistema estiver marcado, o e-mail informado precisa já existir no Auth para vínculo automático.
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreateClientModal(false);
                      setClientFormError('');
                      setClientFormSuccess('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex items-center gap-2" disabled={creatingClient}>
                    <Check className="w-4 h-4" /> {creatingClient ? 'Salvando...' : 'Salvar cliente'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditClientModal && editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-3xl border border-gray-100 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-black uppercase">Editar cadastro do cliente</h3>
                <p className="text-xs font-semibold text-gray-500 mt-1">
                  Origem: {editingClient.source === 'org_members+profiles' ? 'org_members + profiles' : editingClient.source === 'org_members_only' ? 'somente org_members' : 'cadastro manual'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEditClientModal(false);
                  setEditingClient(null);
                  setClientEditError('');
                  setClientEditSuccess('');
                }}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 max-h-[85vh] overflow-y-auto">
              <form onSubmit={handleSaveClientEdit} className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs font-semibold text-gray-600">
                  ID do cliente: <span className="font-black text-gray-800">{editingClient.user_id}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Nome completo</label>
                    <input
                      type="text"
                      value={editClientForm.fullName}
                      onChange={(event) => setEditClientForm((prev) => ({ ...prev, fullName: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">E-mail</label>
                    <input
                      type="email"
                      value={editClientForm.email}
                      onChange={(event) => setEditClientForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Telefone</label>
                    <input
                      type="text"
                      value={editClientForm.phone}
                      onChange={(event) => setEditClientForm((prev) => ({ ...prev, phone: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Documento de identidade</label>
                    <input
                      type="text"
                      value={editClientForm.documentId}
                      onChange={(event) => setEditClientForm((prev) => ({ ...prev, documentId: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">NIF / CPF</label>
                    <input
                      type="text"
                      value={editClientForm.taxId}
                      onChange={(event) => setEditClientForm((prev) => ({ ...prev, taxId: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Estado civil</label>
                    <input
                      type="text"
                      value={editClientForm.maritalStatus}
                      onChange={(event) => setEditClientForm((prev) => ({ ...prev, maritalStatus: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">País</label>
                    <input
                      type="text"
                      value={editClientForm.country}
                      onChange={(event) => setEditClientForm((prev) => ({ ...prev, country: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Organização</label>
                    <select
                      value={editClientForm.organizationId}
                      onChange={(event) => setEditClientForm((prev) => ({ ...prev, organizationId: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>{organization.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Endereço</label>
                    <input
                      type="text"
                      value={editClientForm.address}
                      onChange={(event) => setEditClientForm((prev) => ({ ...prev, address: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Perfil no sistema</label>
                    <select
                      value={editClientForm.accessLevel}
                      onChange={(event) => setEditClientForm((prev) => ({ ...prev, accessLevel: event.target.value as AccessLevel }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ACCESS_LEVELS.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {clientEditError && <p className="text-sm font-bold text-red-500">{clientEditError}</p>}
                {clientEditSuccess && <p className="text-sm font-bold text-emerald-600">{clientEditSuccess}</p>}

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowEditClientModal(false);
                      setEditingClient(null);
                      setClientEditError('');
                      setClientEditSuccess('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={savingClientEdit} className="flex items-center gap-2">
                    <Check className="w-4 h-4" /> {savingClientEdit ? 'Salvando...' : 'Salvar alterações'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Hierarchy Edit Modal */}
      {editingHierarchyUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-3xl border border-gray-100 shadow-2xl overflow-hidden">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <h3 className="text-xl font-black uppercase">Editar Gestor</h3>
               <button onClick={() => setEditingHierarchyUser(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full">
                 <X className="w-5 h-5" />
               </button>
             </div>
             <div className="p-8">
                <form onSubmit={handleUpdateHierarchy}>
                  <p className="text-gray-500 text-sm mb-6">Alterando dados para <strong>{editingHierarchyUser.email}</strong></p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Nome de Usuário</label>
                      <input 
                        required
                        name="admin_name"
                        type="text"
                        defaultValue={editingHierarchyUser.name}
                        className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500 mb-4" 
                      />
                    </div>

                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Hierarquia / Nível</label>
                    {Object.values(Hierarchy).map(h => (
                      <label key={h} className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-blue-500 transition-colors">
                        <input 
                          type="radio" 
                          name="hierarchy" 
                          value={h} 
                          defaultChecked={editingHierarchyUser.hierarchy === h} 
                          className="w-5 h-5 accent-blue-500" 
                        />
                        <span className="font-bold text-gray-700">{h}</span>
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
        <ClientJourneyContainer>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-gray-100 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <h3 className="text-xl font-black uppercase">Ficha Cadastral do Cliente</h3>
               <button onClick={() => setSelectedUser(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full">
                 <X className="w-5 h-5" />
               </button>
             </div>
              <div className="p-6 sm:p-8 overflow-y-auto">
                {/* Sub-aba navigation */}
                <div className="flex gap-1 mb-6 border-b border-gray-200">
                  <button
                    type="button"
                    onClick={() => setSelectedUserTab('cadastral')}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-t-lg transition-colors ${
                      selectedUserTab === 'cadastral'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Dados Cadastrais
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUserTab('financeiro')}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-t-lg transition-colors ${
                      selectedUserTab === 'financeiro'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Financeiro
                  </button>
                </div>

                {/* Dados Cadastrais */}
                {selectedUserTab === 'cadastral' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                      <div className="space-y-4 min-w-0">
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase">Nome Completo</label>
                          <p className="text-lg font-black break-words">{selectedUser.name}</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase">E-mail</label>
                          <p className="font-bold text-blue-400 break-all leading-snug">{selectedUser.email}</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase">Documento / NIF-CPF</label>
                          <p className="font-bold break-words">{selectedUser.documentId} / {selectedUser.taxId}</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase">Estado Civil / País</label>
                          <p className="font-bold break-words">{selectedUser.maritalStatus} - {selectedUser.country}</p>
                        </div>
                      </div>
                      <div className="space-y-4 min-w-0">
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase">Protocolo SGI</label>
                          <p className="text-lg font-black text-emerald-400 break-words">{selectedUser.protocol}</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase">Título do processo</label>
                          <p className="font-bold break-words">{sanitizeDisplayValue((selectedUser as AdminProcessRow).contractedServiceName) || 'Não informado'}</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase">Unidade Atendimento</label>
                          <p className="font-bold text-blue-300 break-words leading-snug">{selectedUser.unit}</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase">Processo Judicial</label>
                          <p className="font-bold break-words">{selectedUser.processNumber || 'NÃO INFORMADO'}</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase">Status Atual</label>
                          <p className="font-black text-orange-500 uppercase">{selectedUser.status}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-8 pt-6 border-t border-gray-100">
                      <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Endereço Completo</label>
                      <p className="font-semibold p-4 bg-gray-50 border border-gray-200 rounded-xl">{selectedUser.address}</p>
                    </div>
                    {selectedUser.notes && (
                      <div className="mt-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Observações Internas</label>
                        <p className="font-bold p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl text-blue-200 italic">"{selectedUser.notes}"</p>
                      </div>
                    )}
                  </>
                )}

                {/* Financeiro */}
                {selectedUserTab === 'financeiro' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl">
                        <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Valor da OS</label>
                        <p className="text-2xl font-black text-gray-900">
                          {(selectedUser as AdminProcessRow).osValue != null
                            ? `R$ ${Number((selectedUser as AdminProcessRow).osValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            : '-'}
                        </p>
                      </div>
                      <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl">
                        <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Tipo de Serviço</label>
                        <p className="text-xl font-black text-gray-900">{(selectedUser as AdminProcessRow).processType || '-'}</p>
                      </div>
                      <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl">
                        <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Unidade de Atendimento</label>
                        <p className="text-xl font-black text-gray-900">{selectedUser.unit}</p>
                      </div>
                      <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl">
                        <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Status do Pagamento</label>
                        {(selectedUser as AdminProcessRow).paymentStatus ? (
                          <span className={`inline-block px-3 py-1 rounded text-xs font-bold uppercase text-white ${getPaymentStatusUi((selectedUser as AdminProcessRow).paymentStatus)?.color || 'bg-slate-600'}`}>
                            {getPaymentStatusUi((selectedUser as AdminProcessRow).paymentStatus)?.label || (selectedUser as AdminProcessRow).paymentStatus}
                          </span>
                        ) : (
                          <p className="text-xl font-black text-gray-400">-</p>
                        )}
                      </div>
                    </div>

                    {((selectedUser as AdminProcessRow).paymentStatus === 'pending' || (selectedUser as AdminProcessRow).paymentStatus === 'failed' || (selectedUser as AdminProcessRow).paymentStatus === 'canceled') && (
                      <div className="pt-4">
                        <button
                          type="button"
                          onClick={() => { void handleGoToCheckout(selectedUser); }}
                          disabled={redirectingCheckout}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-4 text-base font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 shadow-lg"
                        >
                          {redirectingCheckout ? (
                            <><Loader2 className="h-5 w-5 animate-spin" /> Redirecionando...</>
                          ) : (
                            <><ExternalLink className="h-5 w-5" /> Pagar agora</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
             </div>
          </div>
        </div>
        </ClientJourneyContainer>
      )}

      {canCreateProcess && showCreateProcessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-3xl border border-gray-100 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-black uppercase">Criar processo manual</h3>
              <button
                onClick={() => {
                  setShowCreateProcessModal(false);
                  setProcessActionFeedback(null);
                }}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 max-h-[85vh] overflow-y-auto">
              <form onSubmit={handleCreateProcess} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Organização</label>
                    <select
                      value={newProcessForm.organizationId}
                      onChange={(event) => setNewProcessForm((prev) => ({ ...prev, organizationId: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Selecione a organização</option>
                      {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>{organization.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Título do processo</label>
                    <input
                      type="text"
                      value={newProcessForm.title}
                      onChange={(event) => setNewProcessForm((prev) => ({ ...prev, title: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex.: Abertura de acompanhamento administrativo"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Cliente</label>
                    <input
                      type="text"
                      value={newProcessForm.clientName}
                      onChange={(event) => setNewProcessForm((prev) => ({ ...prev, clientName: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nome completo do cliente"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Documento</label>
                    <input
                      type="text"
                      value={newProcessForm.clientDocument}
                      onChange={(event) => setNewProcessForm((prev) => ({ ...prev, clientDocument: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="CPF / NIF / Documento"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Contato</label>
                    <input
                      type="text"
                      value={newProcessForm.clientContact}
                      onChange={(event) => setNewProcessForm((prev) => ({ ...prev, clientContact: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="E-mail, telefone ou WhatsApp"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Tipo</label>
                    <select
                      value={newProcessForm.serviceUnit}
                      onChange={(event) => setNewProcessForm((prev) => ({ ...prev, serviceUnit: event.target.value as ServiceUnit }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={ServiceUnit.ADMINISTRATIVO}>Administrativo</option>
                      <option value={ServiceUnit.JURIDICO}>Jurídico / Advocacia</option>
                      <option value={ServiceUnit.TECNOLOGICO}>Tecnológico / AI</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Valor da OS (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProcessForm.osValue ?? ''}
                      onChange={(event) => setNewProcessForm((prev) => ({ ...prev, osValue: event.target.value ? Number(event.target.value) : undefined }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 text-sm text-gray-600">
                  O processo será criado manualmente com origem <span className="font-black text-gray-800">PAINEL</span>,
                  status inicial <span className="font-black text-gray-800">Cadastro</span> e vinculado à organização selecionada.
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateProcessModal(false);
                      setProcessActionFeedback(null);
                    }}
                    className="px-5 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creatingProcess}
                    className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-black uppercase tracking-wider"
                  >
                    {creatingProcess ? 'Criando processo...' : 'Criar processo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Status Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-3xl border border-gray-100 shadow-2xl overflow-hidden">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <h3 className="text-xl font-black uppercase">Editar Status: {editingUser.protocol}</h3>
               <button onClick={() => setEditingUser(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full">
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
                        <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block">Alterar Status do Processo</label>
                        <select name="status" defaultValue={editingUser.status} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none ring-blue-500 focus:ring-2">
                          {Object.values(ProcessStatus).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block flex items-center gap-2">
                          <UserCheck className="w-3 h-3" /> Gestor do Serviço
                        </label>
                        <select name="serviceManager" defaultValue={editingUser.serviceManager} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none ring-blue-500 focus:ring-2">
                          <option value="">Selecione um gestor</option>
                          {SERVICE_MANAGERS.map(manager => (
                            <option key={manager} value={manager}>{manager}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> Data de Prazo
                      </label>
                      <input name="deadline" type="date" defaultValue={editingUser.deadline} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" /> Nota de Observações
                      </label>
                      <textarea name="notes" rows={4} defaultValue={editingUser.notes} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold resize-none" placeholder="Digite as anotações do processo..."></textarea>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Flag className="w-4 h-4 text-blue-600" />
                        <h4 className="text-sm font-black uppercase text-gray-700">Checklist do processo</h4>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        Todos os administradores podem criar itens e marcar como concluídos.
                      </p>

                      <div className="flex flex-col sm:flex-row gap-2 mb-3">
                        <input
                          type="text"
                          value={newChecklistText}
                          onChange={(event) => setNewChecklistText(event.target.value)}
                          placeholder="Adicionar novo item ao checklist"
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 font-semibold"
                        />
                        <button
                          type="button"
                          onClick={() => void handleAddChecklistItem()}
                          disabled={!sanitizeDisplayValue(newChecklistText)}
                          className="rounded-xl bg-blue-600 text-white px-4 py-2 text-xs font-black uppercase disabled:opacity-60"
                        >
                          Adicionar
                        </button>
                      </div>

                      {checklistLoading ? (
                        <p className="text-xs font-semibold text-gray-500">Carregando checklist...</p>
                      ) : processChecklist.length === 0 ? (
                        <p className="text-xs font-semibold text-gray-500">Nenhum item criado para este processo.</p>
                      ) : (
                        <div className="space-y-2">
                          {processChecklist.map((item) => (
                            <div key={item.id} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={(event) => void handleToggleChecklistItem(item.id, event.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                              />
                              <div className="flex-1 min-w-0">
                                {editingChecklistItemId === item.id ? (
                                  <div className="flex flex-col sm:flex-row gap-2 mb-1">
                                    <input
                                      type="text"
                                      value={editingChecklistText}
                                      onChange={(event) => setEditingChecklistText(event.target.value)}
                                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm font-semibold"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => void handleEditChecklistItem(item.id, editingChecklistText)}
                                        disabled={!sanitizeDisplayValue(editingChecklistText)}
                                        className="px-2 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-black uppercase disabled:opacity-50"
                                      >
                                        Salvar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingChecklistItemId(null);
                                          setEditingChecklistText('');
                                        }}
                                        className="px-2 py-1 rounded-lg border border-gray-300 text-[11px] font-black uppercase"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className={`text-sm font-semibold ${item.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                    {item.text}
                                  </p>
                                )}
                                <p className="text-[11px] text-gray-500">
                                  Criado por {item.createdByName || 'Administrador'} em {new Date(item.createdAt).toLocaleString('pt-BR')}
                                  {item.updatedAt ? ` • Atualizado por ${item.updatedByName || 'Administrador'} em ${new Date(item.updatedAt).toLocaleString('pt-BR')}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingChecklistItemId(item.id);
                                    setEditingChecklistText(item.text);
                                  }}
                                  className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100"
                                  title="Editar item"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteChecklistItem(item.id)}
                                  className="p-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                                  title="Excluir item"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {checklistError && (
                        <p className="mt-2 text-xs font-semibold text-red-600">{checklistError}</p>
                      )}
                    </div>

                    <div className="border-t border-gray-100 pt-6">
                      <h4 className="text-lg font-black uppercase mb-4">Dados cadastrais do usuário</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Nome Completo</label>
                          <input
                            type="text"
                            value={editingProfileForm.fullName}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, fullName: event.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">E-mail</label>
                          <input
                            type="email"
                            value={editingProfileForm.email}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Documento de Identidade</label>
                          <input
                            type="text"
                            value={editingProfileForm.documentId}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, documentId: event.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">NIF / CPF</label>
                          <input
                            type="text"
                            value={editingProfileForm.taxId}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, taxId: event.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Telefone</label>
                          <input
                            type="text"
                            value={editingProfileForm.phone}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Estado Civil</label>
                          <input
                            type="text"
                            value={editingProfileForm.maritalStatus}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, maritalStatus: event.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">País</label>
                          <input
                            type="text"
                            value={editingProfileForm.country}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, country: event.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Endereço completo (inclua CEP)</label>
                          <input
                            type="text"
                            value={editingProfileForm.address}
                            onChange={(event) => setEditingProfileForm((prev) => ({ ...prev, address: event.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {editingProfileLoading && (
                      <p className="text-sm font-bold text-gray-500">Carregando dados completos do cadastro...</p>
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
    </AdminDashboardLayout>
  );
};

export default AdminDashboard;
