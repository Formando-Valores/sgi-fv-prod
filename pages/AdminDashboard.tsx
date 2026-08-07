
import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { Eye, Calendar, LayoutDashboard, FolderKanban, Users2, Settings, Building2, FileBarChart2, BarChart3, FilePlus } from 'lucide-react';
import { User, ProcessStatus, UserRole, Hierarchy, ServiceUnit, Organization, type OrgRole, type OrgMembership } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadOrganizations } from '../organizationRepository';
import { supabase } from '../supabase';
import { listProcesses } from '../src/lib/processes';
import type { Process as DbProcess } from '../src/lib/processes';
import DashboardShell from '../src/components/dashboard/DashboardShell';
import DashboardSidebar from '../src/components/dashboard/DashboardSidebar';
import DashboardTopbar from '../src/components/dashboard/DashboardTopbar';
import { can, getAllowedModules, resolvePermissions } from '../src/lib/permissions';
import Skeleton from '../src/components/ui/Skeleton';
const OverviewBlock = lazy(() => import('../src/components/dashboard/blocks/OverviewBlock'));
const ProcessesBlock = lazy(() => import('../src/components/dashboard/blocks/ProcessesBlock'));
const ClientsSection = lazy(() => import('../src/components/dashboard/blocks/ClientsSection'));
const DashboardSection = lazy(() => import('../src/components/dashboard/blocks/DashboardSection'));
const ClientJourneyBlock = lazy(() => import('../src/components/dashboard/blocks/ClientJourneyBlock'));
const AgendaBlock = lazy(() => import('../src/components/dashboard/blocks/AgendaBlock'));
import { ClientProcessProgressHistoryItem } from '../src/components/dashboard/ClientProcessProgressPanel';
const ReportsPage = lazy(() => import('../src/pages/Reports/ReportsPage'));
const IbanManagementSection = lazy(() => import('../src/components/dashboard/blocks/IbanManagementSection'));
const ServicesSection = lazy(() => import('../src/components/dashboard/blocks/ServicesSection'));
const ProcessesSection = lazy(() => import('../src/components/dashboard/blocks/ProcessesSection'));
const UsersSection = lazy(() => import('../src/components/dashboard/blocks/UsersSection'));
const ManagementSection = lazy(() => import('../src/components/dashboard/blocks/ManagementSection'));
const StripeConfigPanel = lazy(() => import('../src/components/dashboard/blocks/StripeConfigPanel'));
const OrganizationsSection = lazy(() => import('../src/components/dashboard/blocks/OrganizationsSection'));
import { useToast } from '../src/contexts/ToastContext';
import { createCheckoutSession } from '../src/lib/stripe';
import { loadServicesCatalog, filterServicesByUnit, filterGroupsByUnit, filterServicesByGroup, type DbCatalogService } from '../src/lib/servicesCatalogDb';
import { uploadPaymentProof, validatePaymentProof, getPaymentProofs, type PaymentProof } from '../src/lib/paymentProofs';
import { uploadProcessDocument, listProcessDocuments, reviewProcessDocument, type ProcessDocument } from '../src/lib/processDocuments';
import { SUPABASE_EDGE_FUNCTIONS } from '../src/lib/supabaseFunctions';
import { sanitizeDisplayValue, mapAccessLevelToOrgRole, type AccessLevel } from '../src/lib/clientUtils';
import { useChecklist } from '../src/hooks/useChecklist';
import SelectedUserDetailModal, { type AdminProcessRow } from '../src/components/dashboard/modals/SelectedUserDetailModal';
import EditingUserStatusModal from '../src/components/dashboard/modals/EditingUserStatusModal';

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
  currentOrgName?: string;
  availableOrgs?: OrgMembership[];
  onSwitchOrg?: (orgId: string) => void;
  activeOrgId?: string | null;
  showRoleSwitcher?: boolean;
  accessLevel?: string;
  onAccessLevelChange?: (level: string) => void;
  originalRoleLabel?: string;
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
  currentOrgName,
  availableOrgs,
  onSwitchOrg,
  activeOrgId,
  showRoleSwitcher,
  accessLevel,
  onAccessLevelChange,
  originalRoleLabel,
}) => {
  return (
  <DashboardShell
    sidebarOpen={sidebarOpen}
    onCloseSidebar={() => setSidebarOpen(false)}
    sidebar={(
      <DashboardSidebar
        sidebarOpen={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
        onSelectSection={onSelectSection}
        onLogout={onLogout}
        userName={currentUserName}
        hierarchyLabel={hierarchyLabel}
        orgName={currentOrgName}
        links={sidebarLinks}
        showRoleSwitcher={showRoleSwitcher}
        accessLevel={accessLevel}
        onAccessLevelChange={onAccessLevelChange}
        originalRoleLabel={originalRoleLabel}
        availableOrgs={availableOrgs}
        activeOrgId={activeOrgId}
        onSwitchOrg={onSwitchOrg}
      />
    )}
    topbar={(
      <DashboardTopbar
        title={<><img src="/icons/icon.svg" alt="SGI FV" className="h-6 w-6 sm:h-8 sm:w-8 inline-block" /> SGI FV - PAINEL ADMINISTRATIVO</>}
        subtitle={`Bem-vindo, ${currentUserName}`}
        onOpenSidebar={() => setSidebarOpen(true)}
      />
    )}
  >
    {children}
  </DashboardShell>
  );
};

interface AdminDashboardProps {
  currentUser: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onLogout: () => void;
  onSwitchOrg?: (orgId: string) => void;
  section?: 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes' | 'relatorios';
  blocks?: {
    OverviewBlock?: React.ComponentType<{ children: React.ReactNode }>;
    ProcessesBlock?: React.ComponentType<{ children: React.ReactNode }>;
    ClientJourneyBlock?: React.ComponentType<{ children: React.ReactNode }>;
  };
}

// Helper para obter orgId ativa
const getActiveOrgId = (user: User): string | null => {
  return user.activeOrgId || user.organizationId || user.org_id || null;
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, users, setUsers, onLogout, onSwitchOrg, section = 'dashboard', blocks }) => {
  // Estado do seletor de organiza��o
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);
  const orgSwitcherRef = useRef<HTMLDivElement>(null);
  const activeOrgId = getActiveOrgId(currentUser);
  const currentOrgName = currentUser.availableOrgs?.find(o => o.org_id === activeOrgId)?.organizations?.name
    || currentUser.organizationName
    || 'Selecionar Organiza��o';
  const [activeTab, setActiveTab] = useState<'users' | 'management' | 'iban' | 'servicos'>('users');
  const [selectedUser, setSelectedUser] = useState<AdminProcessRow | User | null>(null);
  const [selectedUserTab, setSelectedUserTab] = useState<'cadastral' | 'financeiro' | 'documentos' | 'comunicacao'>('cadastral');
  const [editingUser, setEditingUser] = useState<AdminProcessRow | User | null>(null);
  const [redirectingCheckout, setRedirectingCheckout] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [validatingProof, setValidatingProof] = useState(false);
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([]);
  const [impersonatingAccessLevel, setImpersonatingAccessLevel] = useState('Administrador');
  const isFirstOrgLoad = useRef(true);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showToast } = useToast();

  // Fecha seletor de org ao clicar fora
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (orgSwitcherRef.current && !orgSwitcherRef.current.contains(e.target as Node)) {
        setOrgSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [processVisualOverrides, setProcessVisualOverrides] = useState<ProcessVisualOverrides>({});
  const [adminCatalog, setAdminCatalog] = useState<DbCatalogService[]>([]);

  useEffect(() => {
    loadServicesCatalog().then(setAdminCatalog);
  }, []);

  useEffect(() => {
    loadOrganizations().then(({ organizations: loaded, error }) => {
      if (!error) setOrganizations(loaded);
    });
  }, []);

  const refreshOrganizations = async () => {
    const { organizations: loaded, error } = await loadOrganizations();
    if (!error) setOrganizations(loaded);
  };

  // Documentos tab state
  const [processDocuments, setProcessDocuments] = useState<ProcessDocument[]>([]);
  const [processDocumentsLoading, setProcessDocumentsLoading] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [reviewingDocumentId, setReviewingDocumentId] = useState<string | null>(null);
  const [resendingCertificate, setResendingCertificate] = useState(false);


  const [dbProcesses, setDbProcesses] = useState<DbProcess[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, Record<string, unknown>>>(new Map());
  const [initialProcessesLoaded, setInitialProcessesLoaded] = useState(false);
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
  const ClientJourneyContainer = blocks?.ClientJourneyBlock ?? ClientJourneyBlock;
  const [editingProfileLoading, setEditingProfileLoading] = useState(false);
  const [editingProfileError, setEditingProfileError] = useState('');
  const [editingProfileSaving, setEditingProfileSaving] = useState(false);
  const [formChanged, setFormChanged] = useState(false);
  // Checklist via hook
  const checklist = useChecklist(editingUser, currentUser, activeOrgId);
  const [clientJourneyHistory, setClientJourneyHistory] = useState<ClientProcessProgressHistoryItem[]>([]);
  const [clientJourneyLoading, setClientJourneyLoading] = useState(false);
  const clientJourneyLastProcessIdRef = React.useRef<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const validSections = ['dashboard', 'indicadores', 'processos', 'clientes', 'configuracoes', 'organizacoes', 'relatorios', 'agenda'] as const;
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



  const realPermissions = resolvePermissions(currentUser.org_role ?? (currentUser.role === UserRole.ADMIN ? 'admin' : 'client'), {
    profileRole: currentUser.profile_role ?? null,
  });

  const effectiveOrgRole = impersonatingAccessLevel !== 'Administrador'
    ? (mapAccessLevelToOrgRole(impersonatingAccessLevel as AccessLevel) as OrgRole)
    : (currentUser.org_role ?? (currentUser.role === UserRole.ADMIN ? 'admin' : 'client'));
  const effectiveProfileRole = currentUser.profile_role ?? null;

  const permissions = resolvePermissions(effectiveOrgRole, {
    profileRole: effectiveProfileRole,
  });
  const permissionSubject = { org_role: effectiveOrgRole, hierarchy: permissions.hierarchy };
  const allowedModules = getAllowedModules(permissionSubject);
  const canCreateProcess = can('create', 'processos', permissionSubject);
  const canViewAllReports = can('view_all', 'relatorios', permissionSubject);
  const isClientScope = permissions.hierarchy === 'cliente';

  const sectionReadOnly = {
    processos: !can('create', 'processos', permissionSubject) && !can('delete', 'processos', permissionSubject),
    clientes: !can('manage', 'clientes', permissionSubject),
    configuracoes: !can('manage', 'configuracoes', permissionSubject),
    organizacoes: !can('manage', 'organizacoes', permissionSubject),
    relatorios: !can('view_all', 'relatorios', permissionSubject),
    agenda: !can('manage', 'agenda', permissionSubject),
  } as const;

  const sidebarLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: allowedModules.includes('dashboard') },
    { to: '/dashboard/indicadores', label: 'Indicadores', icon: BarChart3, visible: allowedModules.includes('dashboard') },
    { to: '/dashboard/processos?novo=1', label: 'Novo Processo', icon: FilePlus, visible: allowedModules.includes('processos') },
    { to: '/dashboard/processos', label: 'Processos', icon: FolderKanban, visible: allowedModules.includes('processos') },
    { to: '/dashboard/clientes', label: 'Clientes', icon: Users2, visible: allowedModules.includes('clientes') },
    { to: '/dashboard/configuracoes', label: 'Configura��es', icon: Settings, visible: allowedModules.includes('configuracoes') },
    { to: '/dashboard/organizacoes', label: 'Organiza��es', icon: Building2, visible: allowedModules.includes('organizacoes') },
    { to: '/dashboard/relatorios', label: 'Relat�rios', icon: FileBarChart2, visible: allowedModules.includes('relatorios') },
    { to: '/dashboard/agenda', label: 'Agenda', icon: Calendar, visible: allowedModules.includes('agenda') },
  ].filter((item) => item.visible);

  const sectionModuleMap: Partial<Record<DashboardSection, 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes' | 'relatorios' | 'agenda'>> = {
    dashboard: 'dashboard',
    indicadores: 'dashboard',
    processos: 'processos',
    clientes: 'clientes',
    configuracoes: 'configuracoes',
    organizacoes: 'organizacoes',
    relatorios: 'relatorios',
    agenda: 'agenda',
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
    const resolved = resolveSectionFromLocation();
    setCurrentSection(resolved);
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    const requestedSection = resolveRequestedSectionFromLocation();
    const hasInvalidSectionInRoute =
      Boolean(location.pathname.split('/')[2] || location.hash.split('/')[2]) && !requestedSection;

    const canAccess = canAccessSection(currentSection);
    if (!hasInvalidSectionInRoute && canAccess) return;
    navigate('/dashboard', { replace: true });
    setCurrentSection('dashboard');
  }, [currentSection, navigate, allowedModules, location.pathname, location.hash]);

  useEffect(() => {
    if (currentSection === 'configuracoes') {
      setActiveTab('users');
      return;
    }

    if (currentSection === 'dashboard') {
      setActiveTab('users');
    }
  }, [currentSection, location.search]);

  useEffect(() => {
    const orgId = getActiveOrgId(currentUser);
    if (orgId) {
      if (!isFirstOrgLoad.current) {
        const orgLabel = organizations.find(o => o.id === orgId)?.name || 'organiza��o';
        showToast({ type: 'success', message: `Organiza��o alterada para ${orgLabel}` });
      }
      isFirstOrgLoad.current = false;
      listProcesses(orgId).then(async (processes) => {
        const typed = processes as DbProcess[];
        setDbProcesses(typed);
        setInitialProcessesLoaded(true);
        const userIds: string[] = [];
        const seen = new Set<string>();
        for (const p of typed) {
          const uid = (p as Record<string, unknown>).cliente_user_id;
          if (typeof uid === 'string' && uid && !seen.has(uid)) {
            seen.add(uid);
            userIds.push(uid);
          }
        }
        if (userIds.length > 0) {
          const { data: rows } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds);
          setProfileMap(new Map((rows || []).map(r => [r.id, r as Record<string, unknown>])));
        }
      });
    }
  }, [activeOrgId]);

  useEffect(() => {
    if (selectedUserTab === 'financeiro' && selectedUser) {
      void fetchPaymentProofsForSelected();
    }
  }, [selectedUserTab, selectedUser]);

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
    if (source === 'wix' || source === 'vainaai') return 'Solicita��o recebida';
    if (process.status === 'concluido') return 'Finalizado';
    if (process.status === 'analise') return 'Em an�lise';
    if (process.status === 'triagem') return 'Triagem';
    return 'Cadastro';
  };

  const baseProcessRows: AdminProcessRow[] = dbProcesses.map((process) => {
      const unit = inferServiceUnit(process);
      const legacyStatus = mapDatabaseStatusToLegacy(process.status);
      const source = sanitizeDisplayValue(process.origem_canal);
      const contact = sanitizeDisplayValue(process.cliente_contato);
      const email = contact.includes('@') ? contact : '';
      const requestedOrganizationName = sanitizeDisplayValue(process.org_nome_solicitado) || 'N�o informado';
      const isExternalRequest = source.toLowerCase() === 'wix' || source.toLowerCase() === 'vainaai';
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
        formatDeadlineForDisplay(resolvedDeadline) || (isExternalRequest ? 'Aguardando an�lise' : '-');

      const pClientUserId = (process as Record<string, unknown>).cliente_user_id;
      const profile = typeof pClientUserId === 'string' && pClientUserId ? profileMap.get(pClientUserId) : null;
      const pEmail = profile?.email as string | undefined;
      const pDocId = profile?.documento_identidade as string | undefined;
      const pTaxId = profile?.nif_cpf as string | undefined;
      const pMarital = profile?.estado_civil as string | undefined;
      const pCountry = profile?.pais as string | undefined;
      const pAddress = profile?.endereco as string | undefined;
      const pPhone = profile?.phone as string | undefined;

      return {
        id: process.id,
        processRecordId: process.id,
        profileUserId: process.cliente_user_id,
        name: sanitizeDisplayValue(process.cliente_nome) || sanitizeDisplayValue(process.titulo) || 'Solicita��o sem nome',
        email: pEmail || email || '-',
        role: UserRole.CLIENT,
        documentId: sanitizeDisplayValue(process.cliente_documento) || pDocId || '---',
        taxId: pTaxId || sanitizeDisplayValue(process.cliente_documento) || '---',
        address: pAddress || (requestedOrganizationName !== 'N�o informado' ? `Organiza��o solicitada: ${requestedOrganizationName}` : '---'),
        maritalStatus: pMarital || '---',
        country: pCountry || 'Brasil',
        phone: pPhone || (!email && contact ? contact : '---'),
        processNumber: process.id,
        unit,
        status: legacyStatus,
        protocol: sanitizeDisplayValue(process.protocolo) || 'SEM PROTOCOLO',
        registrationDate: process.created_at,
        lastUpdate: process.updated_at || process.created_at,
        hierarchy: Hierarchy.STATUS_ONLY,
        notes:
          resolvedNotes ||
          (isExternalRequest ? `Origem: ${source.toLowerCase() === 'wix' ? 'Wix' : 'VAINAAI'}${requestedOrganizationName !== 'N�o informado' ? ` � Organiza��o solicitada: ${requestedOrganizationName}` : ''}` : undefined),
        deadline: resolvedDeadline,
        serviceManager: resolvedServiceManager || (isExternalRequest ? 'Aguardando aprova��o' : 'N�o definido'),
        organizationId: process.org_id,
        organizationName: requestedOrganizationName,
        processType: unit,
        startDate: formatProcessDate(process.created_at),
        deadlineDate: resolvedDeadlineDisplay,
        etapaAtual: buildProcessStage(process),
        financeiro: isExternalRequest ? 'Aguardando valida��o' : (legacyStatus === ProcessStatus.CONCLUIDO ? 'Quitado' : 'Pendente'),
        prioridade: isExternalRequest ? 'Alta' : (legacyStatus === ProcessStatus.CONCLUIDO ? 'M�dia' : 'Baixa'),
        valor: process.os_value != null ? Number(process.os_value) : generatedValue,
        sourceLabel: source ? source.toUpperCase() : 'PAINEL',
        requestedOrganizationName,
        contractedServiceName: sanitizeDisplayValue(process.titulo) || 'Servi�o n�o informado',
        paymentStatus: process.payment_status ?? null,
        osValue: process.os_value ?? null,
        servicesSelected: (process.services_selected as AdminProcessRow['servicesSelected']) ?? null,
        associationFees: (process.association_fees as AdminProcessRow['associationFees']) ?? null,
      };
    }) as AdminProcessRow[];

  const clientPrimaryProcess: AdminProcessRow | null = isClientScope ? (baseProcessRows[0] ?? null) : null;

  const navigateToDashboardHighlight = (targetSection: DashboardSection, presetFilter: DashboardPresetFilter) => {
    setCurrentSection(targetSection);
    navigate(`/dashboard/${targetSection}?preset=${presetFilter}`);
  };

  const hydrateEditingProfileForm = async (user: AdminProcessRow | User | null) => {
    if (!user) return;

    const isProcessRow = 'processRecordId' in (user || {});
    const profileUserId = sanitizeDisplayValue(
      isProcessRow
        ? (user as AdminProcessRow).profileUserId
        : user.id
    );
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
      setEditingProfileError('N�o foi poss�vel carregar todos os dados cadastrais do usu�rio.');
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
    setFormChanged(false);
    void hydrateEditingProfileForm(editingUser);
  }, [editingUser]);

  const handleCloseEditModal = () => {
    if (formChanged) {
      const confirmed = window.confirm('Voc� tem altera��es n�o salvas. Deseja realmente sair?');
      if (!confirmed) return;
    }
    setEditingUser(null);
  };

  useEffect(() => {
    if (!formChanged || !editingUser) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [formChanged, editingUser]);


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
        message: sanitizeDisplayValue(event.mensagem) || 'Atualiza��o registrada.',
      }));

      setClientJourneyHistory(compactHistory);
      setClientJourneyLoading(false);
    };

    void loadClientJourneyHistory();

    return () => {
      cancelled = true;
    };
  }, [clientPrimaryProcess?.id, isClientScope]);

  const handleGoToCheckout = async (selected: AdminProcessRow | User) => {
    const processRow = selected as AdminProcessRow;
    const amount = Number(processRow.osValue ?? processRow.valor ?? 0);
    if (amount <= 0) {
      window.alert('Valor do pagamento n�o definido para este processo.');
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
      window.alert('N�o foi poss�vel iniciar o pagamento. Tente novamente mais tarde.');
    } finally {
      setRedirectingCheckout(false);
    }
  };

  const fetchPaymentProofsForSelected = async () => {
    if (!selectedUser) return;
    const processId = (selectedUser as AdminProcessRow).processRecordId;
    if (!processId) { setPaymentProofs([]); return; }
    const proofs = await getPaymentProofs(processId);
    setPaymentProofs(proofs);
  };

  const handleUploadProof = async (file: File, amount?: number) => {
    if (!selectedUser) return;
    const processId = (selectedUser as AdminProcessRow).processRecordId;
    if (!processId) { window.alert('Usu�rio n�o possui um processo vinculado para comprovante de pagamento.'); return; }
    setUploadingProof(true);
    const { proof, error } = await uploadPaymentProof(processId, currentUser.id, file, amount);
    setUploadingProof(false);
    if (error) {
      window.alert(error);
      return;
    }
    await fetchPaymentProofsForSelected();
    // Refresh local state to reflect new payment_status
    setDbProcesses((prev) => prev.map((p) => {
      if (p.id === processId) {
        return { ...p, payment_status: 'pending_validation' as const };
      }
      return p;
    }));
  };

  const handleValidateProof = async (proofId: string, processId: string, status: 'validated' | 'rejected') => {
    setValidatingProof(true);
    const { error } = await validatePaymentProof(proofId, processId, status, currentUser.id);
    setValidatingProof(false);
    if (error) {
      window.alert(error);
      return;
    }
    await fetchPaymentProofsForSelected();
    // Refresh local state
    const newPaymentStatus = status === 'validated' ? 'validated' as const : 'rejected' as const;
    setDbProcesses((prev) => prev.map((p) => {
      if (p.id === processId) {
        return { ...p, payment_status: newPaymentStatus };
      }
      return p;
    }));
  };

  const handleUpdateStatus = async (userId: string, status: ProcessStatus, deadline?: string, notes?: string, serviceManager?: string) => {
    try {
    const timestamp = new Date().toLocaleString('pt-BR');
    const currentEditingUser = editingUser;
    const isProcessRow = 'processRecordId' in (currentEditingUser || {});
    const profileUserId = sanitizeDisplayValue(
      isProcessRow
        ? (currentEditingUser as AdminProcessRow | null)?.profileUserId
        : currentEditingUser?.id
    );
    const processRecordId = sanitizeDisplayValue((currentEditingUser as AdminProcessRow | null)?.processRecordId || null);

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
      analise: 'an�lise',
      concluido: 'conclu�do',
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
      setEditingProfileError('Data de prazo inv�lida. Use o calend�rio para selecionar uma data v�lida.');
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
        processUpdateError = 'N�o foi poss�vel atualizar status, prazo, gestor e observa��es do processo no banco.';
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
      const processOrgId = (currentEditingUser as AdminProcessRow | null)?.organizationId || activeOrgId;

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
        const previousManagerLabel = previousServiceManager || 'N�o definido';
        const nextManagerLabel = normalizedServiceManager || 'N�o definido';
        processEventsPayload.push({
          org_id: processOrgId,
          process_id: processRecordId,
          tipo: 'atribuicao',
          mensagem: `Respons�vel do servi�o alterado de ${previousManagerLabel} para ${nextManagerLabel}.`,
          created_by: currentUser.id,
        });
      }

      if (deadlineChanged) {
        const previousDeadlineLabel = previousDeadline ? formatDeadlineForDisplay(previousDeadline) : 'N�o definido';
        const nextDeadlineLabel = normalizedDeadline ? formatDeadlineForDisplay(normalizedDeadline) : 'N�o definido';
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
          mensagem: `Observa��o registrada: ${normalizedNotes}.`,
          created_by: currentUser.id,
        });
      }

      if (processEventsPayload.length > 0) {
        await supabase.from('process_events').insert(processEventsPayload);
      }
    }

    if (processRecordId && serviceManagerChanged && normalizedServiceManager) {
      try {
        const { data: profProfile } = await supabase
          .from('profiles')
          .select('id, email, nome_completo')
          .eq('nome_completo', normalizedServiceManager)
          .maybeSingle();

        if (profProfile?.email) {
          const currentProc = currentEditingUser as AdminProcessRow | null;
          await supabase.functions.invoke(SUPABASE_EDGE_FUNCTIONS.NOTIFY_PROCESS_ASSIGNMENT, {
            body: {
              email: profProfile.email,
              professionalName: profProfile.nome_completo || normalizedServiceManager,
              processProtocol: currentProc?.protocol || '',
              processTitle: currentProc?.name || currentProc?.title || '',
              clientName: currentProc?.cliente_nome || currentProc?.name || '',
              clientContact: currentProc?.cliente_contato || '',
              deadline: currentProc?.deadline || '',
              notes: normalizedNotes || '',
            },
          });
        }
      } catch (notifyErr) {
        console.warn('[notify] falha ao notificar profissional', notifyErr);
      }
    }

    let profileUpdateError = '';
    if (profileUserId) {
      const { error } = await supabase
        .from('profiles')
        .update(profilePayload)
        .eq('id', profileUserId);

      if (error) {
        profileUpdateError = 'N�o foi poss�vel atualizar os dados cadastrais na tabela profiles.';
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

    setFormChanged(false);

    if (processUpdateError || profileUpdateError) {
      setEditingProfileError([processUpdateError, profileUpdateError].filter(Boolean).join(' '));
    } else {
      showToast({ type: 'success', message: 'Dados do cliente atualizados com sucesso.' });
    }

    setEditingProfileSaving(false);
    setEditingUser(null);
    } catch (err) {
      console.error('[handleUpdateStatus]', err);
      setEditingProfileSaving(false);
    }
  };



  const handleDeleteUser = (id: string) => {
    if(window.confirm('Deseja realmente excluir este usu�rio?')) {
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const loadProcessDocuments = async () => {
    if (!selectedUser?.id) return;
    const processId = (selectedUser as AdminProcessRow).processRecordId;
    if (!processId) return;
    setProcessDocumentsLoading(true);
    const docs = await listProcessDocuments(processId);
    setProcessDocuments(docs);
    setProcessDocumentsLoading(false);
  };

  const handleDocumentReview = async (docId: string, decision: 'approved' | 'rejected' | 'resubmission_requested') => {
    if (!selectedUser?.id || !currentUser.id) return;
    setReviewingDocumentId(docId);
    await reviewProcessDocument(docId, decision, currentUser.id);
    setReviewingDocumentId(null);
    await loadProcessDocuments();
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser || !currentUser.id) return;
    const processId = (selectedUser as AdminProcessRow).processRecordId;
    if (!processId) { alert('Usu�rio n�o possui um processo vinculado para anexar documentos.'); return; }
    const orgId = getActiveOrgId(currentUser);
    if (!orgId) return;
    setUploadingDocument(true);
    await uploadProcessDocument(orgId, processId, currentUser.id, file);
    setUploadingDocument(false);
    if (e.target) e.target.value = '';
    await loadProcessDocuments();
  };

  const handleResendCertificate = async () => {
    if (!selectedUser) return;
    const processId = (selectedUser as AdminProcessRow).processRecordId;
    if (!processId) { showToast({ type: 'error', message: 'Usu�rio n�o possui um processo vinculado para reenviar certificado.' }); return; }

    setResendingCertificate(true);

    try {
      const userId = (selectedUser as AdminProcessRow).profileUserId || selectedUser.id;
      let profileData: Record<string, string | null> = {};

      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('documento_identidade, nif_cpf, endereco, estado_civil, phone, pais')
          .eq('id', userId)
          .maybeSingle();
        if (profile) profileData = profile as Record<string, string | null>;
      }

      const getVal = (key: string): string => {
        const fromProfile = profileData[key];
        if (fromProfile && fromProfile !== '---') return fromProfile;
        const userVal = (selectedUser as any)[
          key === 'documento_identidade' ? 'documentId' :
          key === 'nif_cpf' ? 'taxId' :
          key === 'endereco' ? 'address' :
          key === 'estado_civil' ? 'maritalStatus' :
          key === 'phone' ? 'phone' :
          key === 'pais' ? 'country' : key
        ];
        return userVal || '';
      };

      const requiredFields = [
        { key: 'documento_identidade', label: 'Documento de Identidade (Cart�o de Cidad�o)' },
        { key: 'nif_cpf', label: 'NIF/CPF' },
        { key: 'endereco', label: 'Endere�o (Morada)' },
        { key: 'estado_civil', label: 'Estado Civil' },
        { key: 'phone', label: 'Telefone/WhatsApp' },
        { key: 'pais', label: 'Pa�s' },
      ];

      const missingFields = requiredFields.filter(f => {
        const val = getVal(f.key);
        return !val || val === '---' || val === '-' || val === 'sem-email@nao-informado';
      });

      if (missingFields.length > 0) {
        showToast({
          type: 'warning',
          message: `Cadastro do cliente incompleto. Preencha os dados abaixo para gerar o certificado.`
        });
        await hydrateEditingProfileForm(selectedUser);
        setEditingUser(selectedUser);
        setResendingCertificate(false);
        return;
      }

      if (!window.confirm('Deseja realmente gerar o certificado de filia��o e envi�-lo por e-mail para o cliente?')) {
        setResendingCertificate(false);
        return;
      }

      const clientEmail = selectedUser.email !== '-' ? selectedUser.email : undefined;
      const response = await supabase.functions.invoke(
        SUPABASE_EDGE_FUNCTIONS.SEND_CERTIFICATE,
        { body: { processId, clientEmail } }
      );
      if (response.error) {
        let detail = response.error.message || 'desconhecido';
        if (response.response) {
          try {
            const text = await response.response.clone().text();
            detail = text || detail;
          } catch {}
        }
        showToast({ type: 'error', message: `Erro ao reenviar certificado: ${detail}` });
      } else {
        showToast({ type: 'success', message: 'Certificado reenviado por e-mail com sucesso!' });
      }
    } catch (err: any) {
      const detail = err?.message || 'desconhecido';
      showToast({ type: 'error', message: `Erro ao reenviar certificado: ${detail}` });
    } finally {
      setResendingCertificate(false);
    }
  };


  const [uploadingForProcess, setUploadingForProcess] = useState<string | null>(null);

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
      currentOrgName={currentOrgName}
      availableOrgs={organizations.map(o => ({ org_id: o.id, organizations: { name: o.name, is_active: o.isActive } }))}
      onSwitchOrg={onSwitchOrg}
      activeOrgId={activeOrgId}
      showRoleSwitcher={realPermissions.isAdminHierarchy}
      accessLevel={impersonatingAccessLevel}
      onAccessLevelChange={(level) => {
        setImpersonatingAccessLevel(level);
      }}
      originalRoleLabel={realPermissions.hierarchy}
    >
      {impersonatingAccessLevel !== 'Administrador' && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-800 truncate">
                Visualizando como {impersonatingAccessLevel}
              </p>
              <p className="text-xs text-amber-600 truncate">
                Permiss�es ajustadas automaticamente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setImpersonatingAccessLevel('Administrador');
            }}
            className="shrink-0 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-200 hover:bg-amber-300 rounded-lg transition-colors"
          >
            Voltar
          </button>
        </div>
      )}

      <Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}>
      {currentSection === 'dashboard' && (
        <DashboardSection
          dashboardProcessRows={baseProcessRows}
          usersCount={users.length}
          filteredUsersCount={users.length}
          isClientScope={isClientScope}
          canAccessSection={canAccessSection}
          navigateToDashboardHighlight={navigateToDashboardHighlight}
          setSelectedUser={setSelectedUser}
          OverviewContainer={OverviewContainer}
          clientJourneyHistory={clientJourneyHistory}
          clientJourneyLoading={clientJourneyLoading}
        />
      )}

      {currentSection === 'indicadores' && (
        <DashboardSection
          dashboardProcessRows={baseProcessRows}
          usersCount={users.length}
          filteredUsersCount={users.length}
          isClientScope={isClientScope}
          canAccessSection={canAccessSection}
          navigateToDashboardHighlight={navigateToDashboardHighlight}
          setSelectedUser={setSelectedUser}
          OverviewContainer={OverviewContainer}
          clientJourneyHistory={clientJourneyHistory}
          clientJourneyLoading={clientJourneyLoading}
        />
      )}

      {currentSection === 'configuracoes' && (
        <>
          {/* Navigation Tabs */}
          <div className="flex border-b border-surface-100 mb-6 gap-8 no-print overflow-x-auto overflow-y-hidden whitespace-nowrap scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'users' ? 'text-brand-500' : 'text-surface-500'}`}
        >
          Visualiza��o de Usu�rios
          {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-500 rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('management')}
          className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'management' ? 'text-brand-500' : 'text-surface-500'}`}
        >
          Gest�o de Acessos
          {activeTab === 'management' && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-500 rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('iban')}
          className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'iban' ? 'text-brand-500' : 'text-surface-500'}`}
        >
          IBAN Profissionais
          {activeTab === 'iban' && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-500 rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('servicos')}
          className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'servicos' ? 'text-brand-500' : 'text-surface-500'}`}
        >
          Servi�os
          {activeTab === 'servicos' && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-500 rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('stripe')}
          className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'stripe' ? 'text-brand-500' : 'text-surface-500'}`}
        >
          Stripe
          {activeTab === 'stripe' && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-500 rounded-t-full"></div>}
        </button>
          </div>
        </>
      )}


      {(currentSection === 'dashboard' || currentSection === 'processos') && (
        <ProcessesSection
        baseProcessRows={baseProcessRows}
        organizations={organizations}
        currentUser={currentUser}
        isClientScope={isClientScope}
        canCreateProcess={canCreateProcess}
        sectionReadOnly={sectionReadOnly.processos}
        adminCatalog={adminCatalog}
        setDbProcesses={setDbProcesses}
        editingUser={editingUser}
        selectedUser={selectedUser}
        setEditingUser={setEditingUser}
        setSelectedUser={setSelectedUser}
        newAdminOrgId={organizations[0]?.id || ''}
        currentSection={currentSection}
        locationSearch={location.search}
        initialProcessesLoaded={initialProcessesLoaded}
        ProcessesContainer={ProcessesContainer}
      />
      )}
      {currentSection === 'clientes' && (
        <ClientsSection organizations={organizations} users={users} setUsers={setUsers} activeOrgId={activeOrgId} />
      )}
      {currentSection === 'relatorios' && (
        <section className="no-print">
          <ReportsPage
            defaultOrgId={activeOrgId}
            operationalOnly={!canViewAllReports}
          />
        </section>
      )}
      {currentSection === 'configuracoes' && activeTab === 'users' && (
        <UsersSection users={users} onSelectUser={setSelectedUser} onEditUser={setEditingUser} />
      )}
      {currentSection === 'configuracoes' && activeTab === 'iban' && (
        <div key="tab-iban" className="animate-slideUp"><IbanManagementSection currentUser={currentUser} activeOrgId={activeOrgId} /></div>
      )}
      {currentSection === 'configuracoes' && activeTab === 'servicos' && (
        <div key="tab-servicos" className="animate-slideUp"><ServicesSection currentUser={currentUser} activeOrgId={activeOrgId} /></div>
      )}
      {currentSection === 'configuracoes' && activeTab === 'management' && (
        <ManagementSection users={users} setUsers={setUsers} organizations={organizations} currentUser={currentUser} activeOrgId={activeOrgId} />
      )}
      {currentSection === 'configuracoes' && activeTab === 'stripe' && (
        <div key="tab-stripe" className="animate-slideUp"><StripeConfigPanel activeOrgId={activeOrgId} /></div>
      )}
      {currentSection === 'agenda' && (
        <div className="max-w-full bg-white border border-surface-100 rounded-2xl shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
          <AgendaBlock />
        </div>
      )}
      {currentSection === 'organizacoes' && (
        <OrganizationsSection
          organizations={organizations}
          onRefreshOrganizations={refreshOrganizations}
          canManageOrganizations={!sectionReadOnly.organizacoes}
        />
      )}

      </Suspense>

      {/* Details View Modal */}
      {selectedUser && (
        <SelectedUserDetailModal
          selectedUser={selectedUser}
          selectedUserTab={selectedUserTab}
          onTabChange={setSelectedUserTab}
          onClose={() => setSelectedUser(null)}
          onLoadDocuments={loadProcessDocuments}
          processDocuments={processDocuments}
          processDocumentsLoading={processDocumentsLoading}
          uploadingDocument={uploadingDocument}
          reviewingDocumentId={reviewingDocumentId}
          onUploadDocument={handleUploadDocument}
          onDocumentReview={handleDocumentReview}
          isClientScope={isClientScope}
          paymentProofs={paymentProofs}
          uploadingProof={uploadingProof}
          onUploadProof={handleUploadProof}
          onGoToCheckout={() => void handleGoToCheckout(selectedUser)}
          onValidateProof={handleValidateProof}
          validatingProof={validatingProof}
          redirectingCheckout={redirectingCheckout}
          resendingCertificate={resendingCertificate}
          onResendCertificate={handleResendCertificate}
          currentUserId={currentUser.id}
          uploadingForProcess={uploadingForProcess}
          setUploadingForProcess={setUploadingForProcess}
        />
      )}

      {/* Edit Status Modal */}
      <EditingUserStatusModal
        editingUser={editingUser}
        onClose={handleCloseEditModal}
        onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void handleUpdateStatus(
            editingUser.id,
            fd.get('status') as ProcessStatus,
            fd.get('deadline') as string,
            fd.get('notes') as string,
            fd.get('serviceManager') as string
          );
        }}
        formChanged={formChanged}
        setFormChanged={setFormChanged}
        editingProfileForm={editingProfileForm}
        setEditingProfileForm={setEditingProfileForm}
        editingProfileLoading={editingProfileLoading}
        editingProfileSaving={editingProfileSaving}
        editingProfileError={editingProfileError}
        processChecklist={checklist.processChecklist}
        newChecklistText={checklist.newChecklistText}
        setNewChecklistText={checklist.setNewChecklistText}
        editingChecklistItemId={checklist.editingChecklistItemId}
        setEditingChecklistItemId={checklist.setEditingChecklistItemId}
        editingChecklistText={checklist.editingChecklistText}
        setEditingChecklistText={checklist.setEditingChecklistText}
        checklistLoading={checklist.checklistLoading}
        checklistError={checklist.checklistError}
        onAddChecklistItem={checklist.handleAddChecklistItem}
        onToggleChecklistItem={checklist.handleToggleChecklistItem}
        onEditChecklistItem={checklist.handleEditChecklistItem}
        onDeleteChecklistItem={checklist.handleDeleteChecklistItem}
      />
    </AdminDashboardLayout>
  );
};

// Pending Approvals Component
export default AdminDashboard;
