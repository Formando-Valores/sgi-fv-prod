
import React, { useEffect, useState, useRef } from 'react';
import { Eye, Pencil, Search, Users, ShieldCheck, X, Plus, Trash2, Calendar, MessageSquare, Check, User as UserIcon, UserCheck, LayoutDashboard, FolderKanban, Users2, Settings, Building2, Flag, FileBarChart2, ExternalLink, Loader2, CreditCard, ChevronDown, Upload, FileDown, Mail, SearchX, BarChart3, FilePlus } from 'lucide-react';
import { User, ProcessStatus, UserRole, Hierarchy, ServiceUnit, Organization } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';
import { SERVICE_MANAGERS } from '../constants';
import { loadOrganizations } from '../organizationRepository';
import { supabase } from '../supabase';
import type { Process as DbProcess } from '../src/lib/processes';
import { listProcesses } from '../src/lib/processes';
import Card from '../src/components/ui/Card';
import Badge from '../src/components/ui/Badge';
import Skeleton from '../src/components/ui/Skeleton';
import Button from '../src/components/ui/Button';
import DashboardShell from '../src/components/dashboard/DashboardShell';
import DashboardSidebar from '../src/components/dashboard/DashboardSidebar';
import DashboardTopbar from '../src/components/dashboard/DashboardTopbar';
import DashboardCardContainer from '../src/components/dashboard/DashboardCardContainer';
import { can, getAllowedModules, resolvePermissions } from '../src/lib/permissions';
import OverviewBlock from '../src/components/dashboard/blocks/OverviewBlock';
import ProcessesBlock from '../src/components/dashboard/blocks/ProcessesBlock';
import OrganizationsSection from '../src/components/dashboard/blocks/OrganizationsSection';
import ClientsSection from '../src/components/dashboard/blocks/ClientsSection';
import DashboardSection from '../src/components/dashboard/blocks/DashboardSection';
import ClientJourneyBlock from '../src/components/dashboard/blocks/ClientJourneyBlock';
import AgendaBlock from '../src/components/dashboard/blocks/AgendaBlock';
import ClientProcessProgressPanel, {
  ClientProcessProgressHistoryItem,
} from '../src/components/dashboard/ClientProcessProgressPanel';
import ReportsPage from '../src/pages/Reports/ReportsPage';
import IbanManagementSection from '../src/components/dashboard/blocks/IbanManagementSection';
import ServicesSection from '../src/components/dashboard/blocks/ServicesSection';
import CommunicationBlock from '../src/components/dashboard/blocks/CommunicationBlock';
import ProcessesSection from '../src/components/dashboard/blocks/ProcessesSection';
import UsersSection from '../src/components/dashboard/blocks/UsersSection';
import ManagementSection from '../src/components/dashboard/blocks/ManagementSection';
import { useToast } from '../src/contexts/ToastContext';
import { createCheckoutSession } from '../src/lib/stripe';
import { getPaymentStatusUi } from '../src/lib/paymentStatus';
import { calcAssociationFees, ASSOCIATION_ANNUAL_FEE, type AssociationFeeItem, formatEuro } from '../src/lib/servicesCatalog';
import { loadServicesCatalog, filterServicesByUnit, filterGroupsByUnit, filterServicesByGroup, type DbCatalogService } from '../src/lib/servicesCatalogDb';
import { uploadPaymentProof, validatePaymentProof, getPaymentProofs, type PaymentProof } from '../src/lib/paymentProofs';
import { uploadProcessDocument, listProcessDocuments, reviewProcessDocument, deleteProcessDocument, type ProcessDocument } from '../src/lib/processDocuments';
import { SUPABASE_EDGE_FUNCTIONS } from '../src/lib/supabaseFunctions';
import { sanitizeDisplayValue } from '../src/lib/clientUtils';

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
  servicesSelected?: { id: string; name: string; price: number; group: string }[] | null;
  associationFees?: AssociationFeeItem[] | null;
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
    onCloseSidebar={() => setSidebarOpen(false)}
    sidebar={(
      <DashboardSidebar
        sidebarOpen={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
        onSelectSection={onSelectSection}
        onLogout={onLogout}
        userName={currentUserName}
        hierarchyLabel={hierarchyLabel}
        links={sidebarLinks}
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

interface AdminDashboardProps {
  currentUser: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onLogout: () => void;
  section?: 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes' | 'relatorios';
  blocks?: {
    OverviewBlock?: React.ComponentType<{ children: React.ReactNode }>;
    ProcessesBlock?: React.ComponentType<{ children: React.ReactNode }>;
    ClientJourneyBlock?: React.ComponentType<{ children: React.ReactNode }>;
  };
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, users, setUsers, onLogout, section = 'dashboard', blocks }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'management' | 'iban' | 'servicos'>('users');
  const [selectedUser, setSelectedUser] = useState<AdminProcessRow | User | null>(null);
  const [selectedUserTab, setSelectedUserTab] = useState<'cadastral' | 'financeiro' | 'documentos' | 'comunicacao'>('cadastral');
  const [editingUser, setEditingUser] = useState<AdminProcessRow | User | null>(null);
  const [redirectingCheckout, setRedirectingCheckout] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [validatingProof, setValidatingProof] = useState(false);
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showToast } = useToast();
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



  const permissions = resolvePermissions(currentUser.org_role ?? (currentUser.role === UserRole.ADMIN ? 'admin' : 'client'), {
    profileRole: currentUser.profile_role ?? null,
  });
  const permissionSubject = { org_role: currentUser.org_role ?? null, hierarchy: permissions.hierarchy };
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
    { to: '/dashboard/configuracoes', label: 'Configurações', icon: Settings, visible: allowedModules.includes('configuracoes') },
    { to: '/dashboard/organizacoes', label: 'Organizações', icon: Building2, visible: allowedModules.includes('organizacoes') },
    { to: '/dashboard/relatorios', label: 'Relatórios', icon: FileBarChart2, visible: allowedModules.includes('relatorios') },
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
    console.log('[AdminDashboard] location change → pathname:', location.pathname, 'section:', resolved);
    setCurrentSection(resolved);
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    const requestedSection = resolveRequestedSectionFromLocation();
    const hasInvalidSectionInRoute =
      Boolean(location.pathname.split('/')[2] || location.hash.split('/')[2]) && !requestedSection;

    const canAccess = canAccessSection(currentSection);
    console.log('[AdminDashboard] access check → section:', currentSection, 'canAccess:', canAccess, 'requested:', requestedSection, 'invalidRoute:', hasInvalidSectionInRoute);
    if (!hasInvalidSectionInRoute && canAccess) return;
    console.log('[AdminDashboard] ⚠️ redirecting to /dashboard from', currentSection);
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
    const orgId = currentUser.organizationId || currentUser.org_id;
    if (orgId) {
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
  }, [currentUser.organizationId, currentUser.org_id]);

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

  const baseProcessRows: AdminProcessRow[] = dbProcesses.map((process) => {
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
        profileUserId: process.responsavel_user_id,
        name: sanitizeDisplayValue(process.cliente_nome) || sanitizeDisplayValue(process.titulo) || 'Solicitação sem nome',
        email: pEmail || email || '-',
        role: UserRole.CLIENT,
        documentId: sanitizeDisplayValue(process.cliente_documento) || pDocId || '---',
        taxId: pTaxId || sanitizeDisplayValue(process.cliente_documento) || '---',
        address: pAddress || (requestedOrganizationName !== 'Não informado' ? `Organização solicitada: ${requestedOrganizationName}` : '---'),
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
        valor: process.os_value != null ? Number(process.os_value) : generatedValue,
        sourceLabel: source ? source.toUpperCase() : 'PAINEL',
        requestedOrganizationName,
        contractedServiceName: sanitizeDisplayValue(process.titulo) || 'Serviço não informado',
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
    setFormChanged(false);
    void hydrateEditingProfileForm(editingUser);
  }, [editingUser]);

  const handleCloseEditModal = () => {
    if (formChanged) {
      const confirmed = window.confirm('Você tem alterações não salvas. Deseja realmente sair?');
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
    if (!processId) { window.alert('Usuário não possui um processo vinculado para comprovante de pagamento.'); return; }
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
    const profileUserId = sanitizeDisplayValue((currentEditingUser as AdminProcessRow | null)?.profileUserId || currentEditingUser?.id);
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
    if(window.confirm('Deseja realmente excluir este usuário?')) {
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
    if (!processId) { alert('Usuário não possui um processo vinculado para anexar documentos.'); return; }
    const orgId = currentUser.organizationId;
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
    if (!processId) { showToast({ type: 'error', message: 'Usuário não possui um processo vinculado para reenviar certificado.' }); return; }

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
        { key: 'documento_identidade', label: 'Documento de Identidade (Cartão de Cidadão)' },
        { key: 'nif_cpf', label: 'NIF/CPF' },
        { key: 'endereco', label: 'Endereço (Morada)' },
        { key: 'estado_civil', label: 'Estado Civil' },
        { key: 'phone', label: 'Telefone/WhatsApp' },
        { key: 'pais', label: 'País' },
      ];

      const missingFields = requiredFields.filter(f => {
        const val = getVal(f.key);
        return !val || val === '---' || val === '-' || val === 'sem-email@nao-informado';
      });

      if (missingFields.length > 0) {
        showToast({
          type: 'warning',
          message: `Cadastro do cliente incompleto. Para gerar o certificado completo, atualize: ${missingFields.map(f => f.label).join(', ')}`
        });
      }

      if (!window.confirm('Deseja realmente gerar o certificado de filiação e enviá-lo por e-mail para o cliente?')) {
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


  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingForProcess, setUploadingForProcess] = useState<string | null>(null);

  const PaymentProofUploadButton = ({ processRow }: { processRow: AdminProcessRow }) => {
    const pid = processRow.processRecordId;
    const isUploading = uploadingProof && !!pid && uploadingForProcess === pid;

    return (
      <div>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*,application/pdf"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploadingForProcess(pid);
            await handleUploadProof(file);
            setUploadingForProcess(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
        >
          {isUploading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
          ) : (
            <><Upload className="h-4 w-4" /> Enviar Comprovante de Pagamento</>
          )}
        </button>
        <p className="text-xs text-gray-500 text-center mt-1">Aceito: imagem ou PDF</p>
      </div>
    );
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
          <div className="flex border-b border-gray-100 mb-6 gap-8 no-print overflow-x-auto overflow-y-hidden whitespace-nowrap scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
        <button 
          onClick={() => setActiveTab('iban')}
          className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'iban' ? 'text-blue-500' : 'text-gray-500'}`}
        >
          IBAN Profissionais
          {activeTab === 'iban' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('servicos')}
          className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'servicos' ? 'text-blue-500' : 'text-gray-500'}`}
        >
          Serviços
          {activeTab === 'servicos' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full"></div>}
        </button>
          </div>
        </>
      )}


      {(currentSection === 'dashboard' || currentSection === 'organizacoes') && (
        <OrganizationsSection
          organizations={organizations}
          canManageOrganizations={can('manage', 'organizacoes', permissionSubject)}
          onRefreshOrganizations={async () => { const { organizations: loaded, error } = await loadOrganizations(); if (!error) setOrganizations(loaded); }}
        />
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
        <ClientsSection organizations={organizations} users={users} setUsers={setUsers} />
      )}
      {currentSection === 'relatorios' && (
        <section className="no-print">
          <ReportsPage
            defaultOrgId={currentUser.organizationId ?? null}
            operationalOnly={!canViewAllReports}
          />
        </section>
      )}
      {currentSection === 'configuracoes' && activeTab === 'users' && (
        <UsersSection users={users} onSelectUser={setSelectedUser} onEditUser={setEditingUser} />
      )}
      {currentSection === 'configuracoes' && activeTab === 'iban' && (
        <div key="tab-iban" className="animate-slideUp"><IbanManagementSection currentUser={currentUser} /></div>
      )}
      {currentSection === 'configuracoes' && activeTab === 'servicos' && (
        <div key="tab-servicos" className="animate-slideUp"><ServicesSection currentUser={currentUser} /></div>
      )}
      {currentSection === 'configuracoes' && activeTab === 'management' && (
        <ManagementSection users={users} setUsers={setUsers} organizations={organizations} currentUser={currentUser} />
      )}
      {currentSection === 'agenda' && (
        <div className="max-w-full bg-white border border-gray-100 rounded-2xl shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
          <AgendaBlock />
        </div>
      )}

      {/* Details View Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-[calc(100%-2rem)] sm:w-[calc(100%-3rem)] md:w-full max-w-2xl rounded-2xl border border-gray-100 shadow-2xl max-h-[92vh] md:max-h-[85vh] flex flex-col overflow-hidden animate-scaleIn">
             <div className="shrink-0 px-4 sm:px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 backdrop-blur-sm">
                <h3 className="text-sm sm:text-lg font-black uppercase tracking-tight truncate pr-2">Ficha Cadastral</h3>
                <button onClick={() => setSelectedUser(null)} className="p-1.5 sm:p-2 bg-gray-100 hover:bg-gray-200 rounded-full hover:scale-105 active:scale-95 transition-transform shrink-0">
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
             </div>
               <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth px-4 sm:px-6 py-4 sm:py-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                 {/* Sub-aba navigation */}
                <div className="grid grid-cols-2 md:flex gap-2 mb-6">
                  <button
                    type="button"
                    onClick={() => setSelectedUserTab('cadastral')}
                    className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all text-center ${
                      selectedUserTab === 'cadastral'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Consulte seus dados
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUserTab('financeiro')}
                    className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all text-center ${
                      selectedUserTab === 'financeiro'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Suas finanças
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedUserTab('documentos'); loadProcessDocuments(); }}
                    className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all text-center ${
                      selectedUserTab === 'documentos'
                        ? 'bg-violet-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Seus documentos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUserTab('comunicacao')}
                    className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all text-center ${
                      selectedUserTab === 'comunicacao'
                        ? 'bg-sky-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Fale conosco
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
                          <p className="font-bold break-words">{selectedUser.processNumber || 'NÃƒO INFORMADO'}</p>
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
                    <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <label className="text-[10px] font-black text-emerald-700 uppercase block mb-1">Resumo do Pagamento</label>
                      <p className="text-3xl font-black text-emerald-700">
                        {(selectedUser as AdminProcessRow).osValue != null
                          ? formatEuro(Number((selectedUser as AdminProcessRow).osValue ?? 0))
                          : '-'}
                      </p>
                    </div>

                    {(selectedUser as AdminProcessRow).servicesSelected && (selectedUser as AdminProcessRow).servicesSelected!.length > 0 && (
                      <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Serviços Contratados</label>
                        <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                          {(selectedUser as AdminProcessRow).servicesSelected!.map((svc, idx) => (
                            <div key={idx} className="flex items-center justify-between px-4 py-3 bg-white">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-gray-800 truncate">{svc.name}</p>
                                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{svc.group}</p>
                              </div>
                              <span className="text-sm font-black text-gray-700 ml-3">{formatEuro(svc.price)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(selectedUser as AdminProcessRow).associationFees && (selectedUser as AdminProcessRow).associationFees!.length > 0 && (() => {
                      const allFees = (selectedUser as AdminProcessRow).associationFees!;
                      const svcTotal = (selectedUser as AdminProcessRow).osValue ?? 0;
                      const servicosTotal = svcTotal - (allFees.find(f => f.type === 'doacao')?.price ?? 0);
                      const convenioFees = allFees.filter(f => f.type === 'convenio');
                      const doacaoFee = allFees.find(f => f.type === 'doacao');
                      const convenioTotal = convenioFees.reduce((s, f) => s + f.price, 0);
                      const profissionalNet = servicosTotal - convenioTotal;
                      return (
                        <div>
                          <label className="text-[10px] font-black text-amber-700 uppercase block mb-2">Taxas Associativas</label>
                          <div className="divide-y divide-amber-100 border border-amber-200 rounded-xl overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 bg-blue-50">
                              <p className="text-sm font-bold text-blue-800">Valor Bruto dos Serviços</p>
                              <span className="text-sm font-black text-blue-800">{formatEuro(servicosTotal)}</span>
                            </div>
                            {convenioFees.map((fee, idx) => (
                              <div key={idx} className="flex items-center justify-between px-4 py-3 bg-amber-50">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-amber-900 truncate">{fee.name}</p>
                                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Associação</p>
                                </div>
                                <span className="text-sm font-black text-amber-700 ml-3">- {formatEuro(fee.price)}</span>
                              </div>
                            ))}
                            {doacaoFee && (
                              <div className="flex items-center justify-between px-4 py-3 bg-purple-50">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-purple-900 truncate">{doacaoFee.name}</p>
                                  <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">Associação</p>
                                </div>
                                <span className="text-sm font-black text-purple-700 ml-3">+ {formatEuro(doacaoFee.price)}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between px-4 py-3 bg-emerald-50">
                              <p className="text-sm font-bold text-emerald-800">Valor Líquido ao Profissional</p>
                              <span className="text-base font-black text-emerald-700">{formatEuro(Math.max(0, profissionalNet))}</span>
                            </div>
                            <div className="flex items-center justify-between px-4 py-3 bg-amber-100">
                              <p className="text-sm font-black text-amber-900 uppercase">Total a Pagar</p>
                              <span className="text-base font-black text-amber-900">{formatEuro(svcTotal)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                        <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Tipo de Serviço</label>
                        <p className="text-lg font-black text-gray-900">{(selectedUser as AdminProcessRow).processType || '-'}</p>
                      </div>
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                        <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Unidade de Atendimento</label>
                        <p className="text-lg font-black text-gray-900">{selectedUser.unit}</p>
                      </div>
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                        <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Status do Pagamento</label>
                        {(selectedUser as AdminProcessRow).paymentStatus ? (
                          <span className={`inline-block px-3 py-1 rounded text-xs font-bold uppercase text-white ${getPaymentStatusUi((selectedUser as AdminProcessRow).paymentStatus)?.color || 'bg-slate-600'}`}>
                            {getPaymentStatusUi((selectedUser as AdminProcessRow).paymentStatus)?.label || (selectedUser as AdminProcessRow).paymentStatus}
                          </span>
                        ) : (
                          <p className="text-lg font-black text-gray-400">Pendente</p>
                        )}
                      </div>
                    </div>

                    {/* Stripe payment button */}
                    {((selectedUser as AdminProcessRow).paymentStatus == null || (selectedUser as AdminProcessRow).paymentStatus === 'pending' || (selectedUser as AdminProcessRow).paymentStatus === 'failed' || (selectedUser as AdminProcessRow).paymentStatus === 'canceled') && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => { void handleGoToCheckout(selectedUser); }}
                          disabled={redirectingCheckout}
                          className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-emerald-600 px-6 py-4 text-base font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 shadow-lg"
                        >
                          {redirectingCheckout ? (
                            <><Loader2 className="h-5 w-5 animate-spin" /> Redirecionando para pagamento...</>
                          ) : (
                            <><CreditCard className="h-5 w-5" /> Pagar agora — {formatEuro(Number((selectedUser as AdminProcessRow).osValue ?? 0))}</>
                          )}
                        </button>
                        <p className="text-xs text-gray-500 text-center">Pagamento processado via Stripe com segurança</p>

                        {/* Payment proof upload for clients */}
                        {(isClientScope) && (
                          <PaymentProofUploadButton
                            processRow={selectedUser as AdminProcessRow}
                            uploadingProof={uploadingProof}
                            onUpload={handleUploadProof}
                          />
                        )}
                      </div>
                    )}

                    {/* Pending validation - waiting for admin approval */}
                    {(selectedUser as AdminProcessRow).paymentStatus === 'pending_validation' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                          <p className="font-bold text-amber-800">
                            {isClientScope
                              ? 'Comprovante enviado! Aguardando validação.'
                              : 'Cliente enviou comprovante. Valide abaixo.'}
                          </p>
                        </div>

                        {/* Show payment proofs */}
                        {paymentProofs.length > 0 && (
                          <div>
                            <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Comprovantes Enviados</label>
                            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                              {paymentProofs.map((proof) => (
                                <div key={proof.id} className="flex items-center justify-between px-4 py-3 bg-white">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-gray-800 truncate">{proof.file_name || 'Comprovante'}</p>
                                    {proof.amount && (
                                      <p className="text-[10px] font-semibold text-gray-500">Valor: {formatEuro(proof.amount)}</p>
                                    )}
                                    {proof.notes && <p className="text-[10px] text-gray-500 mt-1">{proof.notes}</p>}
                                  </div>
                                  <a
                                    href={proof.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold text-blue-600 hover:text-blue-800 ml-3 underline"
                                  >
                                    Ver arquivo
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Admin validation buttons */}
                        {!isClientScope && (
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                const pid = (selectedUser as AdminProcessRow).processRecordId;
                                const proofId = paymentProofs[0]?.id;
                                if (proofId && pid) void handleValidateProof(proofId, pid, 'validated');
                              }}
                              disabled={validatingProof || paymentProofs.length === 0}
                              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
                            >
                              {validatingProof ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              Validar Pagamento
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const pid = (selectedUser as AdminProcessRow).processRecordId;
                                const proofId = paymentProofs[0]?.id;
                                if (proofId && pid) void handleValidateProof(proofId, pid, 'rejected');
                              }}
                              disabled={validatingProof || paymentProofs.length === 0}
                              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
                            >
                              <X className="h-4 w-4" />
                              Rejeitar
                            </button>
                          </div>
                        )}

                        {/* Client sees resend option if rejected */}
                        {isClientScope && paymentProofs[0]?.status === 'rejected' && (
                          <PaymentProofUploadButton
                            processRow={selectedUser as AdminProcessRow}
                            uploadingProof={uploadingProof}
                            onUpload={handleUploadProof}
                          />
                        )}
                      </div>
                    )}

                    {/* Validated/accepted */}
                    {((selectedUser as AdminProcessRow).paymentStatus === 'validated' || (selectedUser as AdminProcessRow).paymentStatus === 'accepted') && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                        <Check className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                        <p className="font-bold text-emerald-800 text-lg">Pagamento Validado</p>
                        <p className="text-sm text-emerald-600 mt-1">Certificado de Filiação disponível para download.</p>
                      </div>
                    )}

                    {/* Rejected */}
                    {(selectedUser as AdminProcessRow).paymentStatus === 'rejected' && (
                      <div className="space-y-3">
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                          <p className="font-bold text-red-800">Comprovante rejeitado</p>
                          <p className="text-sm text-red-600 mt-1">Envie um novo comprovante válido.</p>
                        </div>
                        {isClientScope && (
                          <PaymentProofUploadButton
                            processRow={selectedUser as AdminProcessRow}
                            uploadingProof={uploadingProof}
                            onUpload={handleUploadProof}
                          />
                        )}
                      </div>
                    )}

                    {/* Certificate section when paid/validated */}
                    {((selectedUser as AdminProcessRow).paymentStatus === 'paid' || (selectedUser as AdminProcessRow).paymentStatus === 'validated' || (selectedUser as AdminProcessRow).paymentStatus === 'accepted') && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-black uppercase text-blue-800">Certificado de Filiação</h4>
                          <a
                             href={(selectedUser as AdminProcessRow).processRecordId ? `/#/certificate?processId=${(selectedUser as AdminProcessRow).processRecordId}` : '#'}
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 underline"
                          >
                            <FileDown className="h-3 w-3" />
                            Baixar
                          </a>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleResendCertificate}
                            disabled={resendingCertificate}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all"
                          >
                            {resendingCertificate ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Mail className="h-3 w-3" />
                            )}
                            Reenviar por Email
                          </button>
                          <label className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-all">
                            <Upload className="h-3 w-3" />
                            Upload Manual
                            <input
                              type="file"
                              className="hidden"
                              accept="application/pdf,image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !selectedUser || !currentUser.id) return;
                                const processId = (selectedUser as AdminProcessRow).processRecordId;
                                const orgId = currentUser.organizationId;
                                if (!orgId || !processId) return;
                                await uploadProcessDocument(orgId, processId, currentUser.id, file, 'Certificado - Upload Manual');
                                if (e.target) e.target.value = '';
                                await loadProcessDocuments();
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedUserTab === 'documentos' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-black uppercase text-gray-800">Documentos do Processo</h3>
                      <label className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-colors cursor-pointer ${uploadingDocument ? 'bg-violet-400' : 'bg-violet-600 hover:bg-violet-500'}`}>
                        {uploadingDocument ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Enviandoâ€¦</>
                        ) : (
                          <><Upload className="h-4 w-4" /> Adicionar Documento</>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                          onChange={handleUploadDocument}
                          disabled={uploadingDocument}
                        />
                      </label>
                    </div>

                    {processDocumentsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                      </div>
                    ) : processDocuments.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <p className="font-bold">Nenhum documento anexado.</p>
                        <p className="text-sm mt-1">Clique em "Adicionar Documento" para enviar um arquivo.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {processDocuments.map((doc) => (
                          <div key={doc.id} className="border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-gray-800 break-words">{doc.document_name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  doc.validation_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                  doc.validation_status === 'rejected' ? 'bg-red-100 text-red-700' :
                                  doc.validation_status === 'resubmission_requested' ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {doc.validation_status === 'approved' ? 'Aprovado' :
                                   doc.validation_status === 'rejected' ? 'Rejeitado' :
                                   doc.validation_status === 'resubmission_requested' ? 'Reenvio solicitado' :
                                   'Pendente'}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {new Date(doc.created_at).toLocaleString('pt-BR')}
                                </span>
                              </div>
                              {doc.pending_reason && (
                                <p className="text-xs text-gray-500 mt-1">{doc.pending_reason}</p>
                              )}
                              {doc.review_notes && (
                                <p className="text-xs text-amber-600 mt-1 font-semibold">Parecer: {doc.review_notes}</p>
                              )}
                              {doc.file_path && (
                                <a href={doc.file_path} target="_blank" rel="noopener noreferrer"
                                   className="text-xs text-blue-600 hover:text-blue-800 font-bold mt-1 inline-block">
                                  Visualizar arquivo â†’
                                </a>
                              )}
                            </div>
                            {!isClientScope && doc.validation_status === 'pending' && (
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleDocumentReview(doc.id, 'approved')}
                                  disabled={reviewingDocumentId === doc.id}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                  {reviewingDocumentId === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Aprovar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDocumentReview(doc.id, 'rejected')}
                                  disabled={reviewingDocumentId === doc.id}
                                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                  Rejeitar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDocumentReview(doc.id, 'resubmission_requested')}
                                  disabled={reviewingDocumentId === doc.id}
                                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                  Solicitar Reenvio
                                </button>
                              </div>
                            )}
                            {doc.validation_status === 'rejected' && !isClientScope && (
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleDocumentReview(doc.id, 'resubmission_requested')}
                                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                  Solicitar Reenvio
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedUserTab === 'comunicacao' && selectedUser && (selectedUser as AdminProcessRow).processRecordId && (
                  <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                      <h3 className="text-sm font-black uppercase text-gray-700">Comunicação do Processo</h3>
                    </div>
                    <CommunicationBlock
                      processId={(selectedUser as AdminProcessRow).processRecordId!}
                      currentUserId={currentUser.id}
                    />
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* Edit Status Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-3xl rounded-3xl border border-gray-100 shadow-2xl overflow-hidden animate-scaleIn">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <h3 className="text-xl font-black uppercase">Editar Status: {editingUser.protocol}</h3>
               <button type="button" onClick={handleCloseEditModal} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full">
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
                        <select name="status" defaultValue={editingUser.status} onChange={() => setFormChanged(true)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none ring-blue-500 focus:ring-2">
                          {Object.values(ProcessStatus).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block flex items-center gap-2">
                          <UserCheck className="w-3 h-3" /> Gestor do Serviço
                        </label>
                        <select name="serviceManager" defaultValue={editingUser.serviceManager} onChange={() => setFormChanged(true)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none ring-blue-500 focus:ring-2">
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
                      <input name="deadline" type="date" defaultValue={editingUser.deadline} onChange={() => setFormChanged(true)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" /> Nota de Observações
                      </label>
                      <textarea name="notes" rows={4} defaultValue={editingUser.notes} onChange={() => setFormChanged(true)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold resize-none" placeholder="Digite as anotações do processo..."></textarea>
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
                                  {item.updatedAt ? ` â€¢ Atualizado por ${item.updatedByName || 'Administrador'} em ${new Date(item.updatedAt).toLocaleString('pt-BR')}` : ''}
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
                            onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, fullName: event.target.value })); setFormChanged(true); }}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">E-mail</label>
                          <input
                            type="email"
                             value={editingProfileForm.email}
                            onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, email: event.target.value })); setFormChanged(true); }}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Documento de Identidade</label>
                          <input
                            type="text"
                            value={editingProfileForm.documentId}
                            onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, documentId: event.target.value })); setFormChanged(true); }}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">NIF / CPF</label>
                          <input
                            type="text"
                            value={editingProfileForm.taxId}
                            onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, taxId: event.target.value })); setFormChanged(true); }}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Telefone</label>
                          <input
                            type="text"
                            value={editingProfileForm.phone}
                            onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, phone: event.target.value })); setFormChanged(true); }}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Estado Civil</label>
                          <input
                            type="text"
                            value={editingProfileForm.maritalStatus}
                            onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, maritalStatus: event.target.value })); setFormChanged(true); }}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">País</label>
                          <input
                            type="text"
                            value={editingProfileForm.country}
                            onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, country: event.target.value })); setFormChanged(true); }}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Endereço completo (inclua CEP)</label>
                          <input
                            type="text"
                            value={editingProfileForm.address}
                            onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, address: event.target.value })); setFormChanged(true); }}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {editingProfileLoading && (
                      <div className="space-y-4 p-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /></div>
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

// Pending Approvals Component
export default AdminDashboard;
