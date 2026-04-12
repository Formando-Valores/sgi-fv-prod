
import React from 'react';
import { LogOut, Printer, FileDown, User as UserIcon, Calendar, Clock, Landmark, Activity, UserCheck, MessageSquare } from 'lucide-react';
import { User, ProcessStatus, UserRole } from '../types';
import { supabase } from '../supabase';
import { SERVICE_MANAGERS } from '../constants';
import { SUPABASE_EDGE_FUNCTIONS } from '../src/lib/supabaseFunctions';

interface UserDashboardProps {
  currentUser: User;
  onLogout: () => void;
}

type ServiceArea = 'administrativo' | 'juridico' | 'tecnologico' | 'recursos_humanos' | 'advocacia';

type GuidedService = {
  id: string;
  area: ServiceArea;
  category: string;
  name: string;
  priceLabel: string;
  description?: string;
  deadline?: string;
};

type AvailableProfessional = {
  id: string;
  professional: string;
  roleLabel: string;
  email?: string | null;
  availableSlots: string[];
  isAvailableNow: boolean;
  nextAvailableSlot: string | null;
  statusLabel: string;
  activeServiceCount: number;
  scheduledTodayCount: number;
  totalOpenDemands: number;
  loadScore: number;
  isRecommended?: boolean;
};

type ProcessStep = {
  name: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
  responsible: string;
  updatedAt: string;
  notes?: string;
};

type ServiceProcessView = {
  id: string;
  serviceName: string;
  scheduledSlot: string;
  assignedProfessional: string;
  statusLabel: 'aguardando atendimento' | 'em atendimento' | 'aguardando documentos' | 'em análise' | 'finalizado';
  createdAt: string;
  steps: ProcessStep[];
  timeline: Array<{ date: string; message: string }>;
};

type DashboardProcessRow = {
  id: string;
  titulo?: string | null;
  protocolo?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  unidade_atendimento?: string | null;
  cliente_nome?: string | null;
  cliente_contato?: string | null;
  responsavel_user_id?: string | null;
  data_conclusao?: string | null;
};

const SERVICE_CATALOG: GuidedService[] = [
  { id: 'adm-001', area: 'administrativo', category: 'Administrativo', name: 'Regularização de documentos', priceLabel: '80€' },
  { id: 'adm-002', area: 'administrativo', category: 'Administrativo', name: 'Abertura de atividade', priceLabel: '120€' },
  { id: 'jur-001', area: 'juridico', category: 'Serviços Avulsos', name: 'Consulta Oral/Online', priceLabel: '50€' },
  { id: 'jur-002', area: 'juridico', category: 'Serviços Avulsos', name: 'Consulta Urgente', priceLabel: '75€' },
  { id: 'jur-003', area: 'juridico', category: 'Serviços Avulsos', name: 'Consulta Escrita', priceLabel: '100€' },
  { id: 'jur-004', area: 'juridico', category: 'Serviços Avulsos', name: 'Parecer Jurídico', priceLabel: '150€' },
  { id: 'jur-005', area: 'juridico', category: 'Serviços Avulsos', name: 'Elaboração de Contratos', priceLabel: 'Sob consulta' },
  { id: 'jur-006', area: 'juridico', category: 'Processos Judiciais', name: 'Comum Singular', priceLabel: '500€' },
  { id: 'jur-007', area: 'juridico', category: 'Processos Judiciais', name: 'Divórcio por mútuo consentimento', priceLabel: '500€' },
  { id: 'jur-008', area: 'juridico', category: 'Processos Judiciais', name: 'Ação Sumária', priceLabel: '600€' },
  { id: 'jur-009', area: 'juridico', category: 'Recursos', name: 'Relação sem julgamento', priceLabel: '500€' },
  { id: 'jur-010', area: 'juridico', category: 'Imigração', name: 'Autorização de residência', priceLabel: '400€' },
  { id: 'tec-001', area: 'tecnologico', category: 'Tecnológico', name: 'Diagnóstico de sistema', priceLabel: 'Sob consulta' },
  { id: 'rh-001', area: 'recursos_humanos', category: 'Recursos Humanos', name: 'Auditoria trabalhista', priceLabel: '140€' },
  { id: 'rh-002', area: 'recursos_humanos', category: 'Recursos Humanos', name: 'Mediação de conflito laboral', priceLabel: '110€' },
  { id: 'adv-001', area: 'advocacia', category: 'Advocacia', name: 'Ação Ordinária', priceLabel: '1000€' },
];

const AUTO_ASSIGNMENT_ENABLED = false;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROCESS_STEP_NAMES = ['Atendimento iniciado', 'Coleta de informações', 'Análise', 'Execução', 'Finalização'];
const ASSOCIATIVE_FEE_EUR = 50;
const PROCESS_STATUS_LABEL_MAP: Record<string, ServiceProcessView['statusLabel']> = {
  pendente: 'aguardando atendimento',
  triagem: 'em atendimento',
  analise: 'em análise',
  concluido: 'finalizado',
};
const parsePriceLabel = (priceLabel: string): number | null => {
  const normalized = priceLabel.replace('€', '').replace(',', '.').trim();
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
};
const mapDbStatusToProcessStatus = (status?: string | null): ProcessStatus => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'triagem') return ProcessStatus.TRIAGEM;
  if (normalized === 'analise' || normalized === 'análise') return ProcessStatus.ANALISE;
  if (normalized === 'concluido') return ProcessStatus.CONCLUIDO;
  return ProcessStatus.PENDENTE;
};

const UserDashboard: React.FC<UserDashboardProps> = ({ currentUser, onLogout }) => {
  const [selectedArea, setSelectedArea] = React.useState<ServiceArea | null>(null);
  const [selectedServiceId, setSelectedServiceId] = React.useState<string>('');
  const [paymentMethod, setPaymentMethod] = React.useState<'cartao' | 'boleto' | ''>('');
  const [paymentStatus, setPaymentStatus] = React.useState<'idle' | 'initiated' | 'awaiting_confirmation' | 'confirmed'>('idle');
  const [selectedSlot, setSelectedSlot] = React.useState<string>('');
  const [selectedAdminScheduleSlot, setSelectedAdminScheduleSlot] = React.useState<string>('');
  const [initialStageFinished, setInitialStageFinished] = React.useState(false);
  const [processStatus, setProcessStatus] = React.useState<ProcessStatus>(currentUser.status);
  const [isCreatingProcess, setIsCreatingProcess] = React.useState(false);
  const [createdProcessId, setCreatedProcessId] = React.useState<string | null>(null);
  const [serviceProcess, setServiceProcess] = React.useState<ServiceProcessView | null>(null);
  const [processCreationError, setProcessCreationError] = React.useState<string | null>(null);
  const [allowNewRequest, setAllowNewRequest] = React.useState(false);
  const [availableProfessionals, setAvailableProfessionals] = React.useState<AvailableProfessional[]>([]);
  const [isLoadingProfessionals, setIsLoadingProfessionals] = React.useState(false);
  const [professionalsError, setProfessionalsError] = React.useState<string | null>(null);
  const [dashboardProcesses, setDashboardProcesses] = React.useState<DashboardProcessRow[]>([]);
  const [dashboardProcessFilter, setDashboardProcessFilter] = React.useState<'todos' | 'andamento' | 'concluidos'>('todos');
  const [dashboardProcessSearch, setDashboardProcessSearch] = React.useState('');
  const [selectedDashboardProcessId, setSelectedDashboardProcessId] = React.useState<string | null>(null);
  const [dashboardProcessesLoading, setDashboardProcessesLoading] = React.useState(false);
  const [processComments, setProcessComments] = React.useState<Array<{ id: string; text: string; createdAt: string }>>([]);
  const [newComment, setNewComment] = React.useState('');
  const [processFiles, setProcessFiles] = React.useState<Array<{ id: string; name: string; sizeLabel: string; uploadedAt: string }>>([]);
  const [financeEntries, setFinanceEntries] = React.useState<Array<{ id: string; serviceName: string; totalLabel: string; paidAt: string }>>([]);

  const steps = [
    { label: ProcessStatus.PENDENTE, color: 'bg-slate-500' },
    { label: ProcessStatus.TRIAGEM, color: 'bg-yellow-400' },
    { label: ProcessStatus.ANALISE, color: 'bg-orange-500' },
    { label: ProcessStatus.CONCLUIDO, color: 'bg-[#39ff14]' },
  ];

  const currentStepIndex = steps.findIndex(s => s.label === processStatus);
  const guidedServices = selectedArea ? SERVICE_CATALOG.filter((service) => service.area === selectedArea) : [];
  const selectedService = guidedServices.find((service) => service.id === selectedServiceId) ?? null;
  const servicePriceValue = selectedService ? parsePriceLabel(selectedService.priceLabel) : null;
  const totalPriceValue = servicePriceValue !== null ? servicePriceValue + ASSOCIATIVE_FEE_EUR : null;
  const totalPriceLabel = totalPriceValue !== null ? `${totalPriceValue.toFixed(2).replace('.', ',')}€` : 'Sob consulta + quota associativa';
  const canContinueToPayment = Boolean(
      selectedArea &&
      selectedService &&
      selectedSlot &&
      selectedAdminScheduleSlot &&
      availableProfessionals.some((professional) => professional.id === selectedSlot && professional.availableSlots.length > 0),
  );
  const isOnboardingFlow = processStatus !== ProcessStatus.CONCLUIDO && (!initialStageFinished || allowNewRequest);
  const displaySectorName = processStatus === ProcessStatus.PENDENTE ? 'Atendimento ao Associado' : 'Setor Jurídico Conveniado à AI';
  const filteredDashboardProcesses = dashboardProcesses.filter((processRow) => {
    const normalizedStatus = (processRow.status || '').toLowerCase();
    const isConcluded = normalizedStatus === 'concluido';
    if (dashboardProcessFilter === 'andamento' && isConcluded) return false;
    if (dashboardProcessFilter === 'concluidos' && !isConcluded) return false;

    if (!dashboardProcessSearch.trim()) return true;
    const target = `${processRow.id} ${processRow.protocolo || ''} ${processRow.titulo || ''} ${processRow.unidade_atendimento || ''} ${processRow.status || ''} ${processRow.cliente_nome || ''}`.toLowerCase();
    return target.includes(dashboardProcessSearch.toLowerCase());
  });

  React.useEffect(() => {
    const loadDashboardProcesses = async () => {
      if (!currentUser.organizationId) return;
      setDashboardProcessesLoading(true);
      const localStorageKey = `sgi_dashboard_processes_${currentUser.id}`;
      const cachedRows = (() => {
        try {
          const fallbackRaw = localStorage.getItem(localStorageKey);
          return fallbackRaw ? JSON.parse(fallbackRaw) as DashboardProcessRow[] : [];
        } catch {
          return [] as DashboardProcessRow[];
        }
      })();

      if (cachedRows.length > 0) {
        setDashboardProcesses(cachedRows);
        if (!selectedDashboardProcessId) {
          setSelectedDashboardProcessId(cachedRows[0].id);
        }
      }

      const remoteQuery = supabase
        .from('processes')
        .select('id,titulo,protocolo,status,created_at,updated_at,unidade_atendimento,cliente_nome,cliente_contato,responsavel_user_id,data_conclusao')
        .eq('org_id', currentUser.organizationId)
        .order('created_at', { ascending: false });

      const clientFilters: string[] = [];
      const isClient = currentUser.role !== UserRole.ADMIN;
      if (isClient) {
        const email = currentUser.email?.trim().toLowerCase();
        const phone = currentUser.phone?.trim();
        const name = currentUser.name?.trim();
        if (email) clientFilters.push(`cliente_contato.eq.${email}`);
        if (phone) clientFilters.push(`cliente_contato.eq.${phone}`);
        if (name) clientFilters.push(`cliente_nome.eq.${name}`);
      }

      if (clientFilters.length > 0) {
        remoteQuery.or(clientFilters.join(','));
      }

      const { data, error } = await remoteQuery;
      if (error) {
        console.error('Erro ao carregar processos do dashboard:', error);
        setDashboardProcesses(cachedRows);
        setDashboardProcessesLoading(false);
        return;
      }

      let rows = (data || []) as DashboardProcessRow[];

      if (isClient && currentUser.id) {
        const { data: eventRows, error: eventError } = await supabase
          .from('process_events')
          .select('process_id')
          .eq('org_id', currentUser.organizationId)
          .eq('created_by', currentUser.id)
          .not('process_id', 'is', null);

        if (eventError) {
          console.error('Erro ao carregar vínculo de processos do cliente:', eventError);
        } else {
          const processIds = Array.from(
            new Set(
              ((eventRows || []) as Array<{ process_id?: string | null }>)
                .map((row) => row.process_id)
                .filter((value): value is string => Boolean(value)),
            ),
          );

          if (processIds.length > 0) {
            const { data: ownedRows, error: ownedError } = await supabase
              .from('processes')
              .select('id,titulo,protocolo,status,created_at,updated_at,unidade_atendimento,cliente_nome,cliente_contato,responsavel_user_id,data_conclusao')
              .eq('org_id', currentUser.organizationId)
              .in('id', processIds)
              .order('created_at', { ascending: false });

            if (ownedError) {
              console.error('Erro ao carregar processos vinculados por histórico:', ownedError);
            } else {
              const mergeMap = new Map<string, DashboardProcessRow>();
              rows.forEach((row) => mergeMap.set(row.id, row));
              ((ownedRows || []) as DashboardProcessRow[]).forEach((row) => mergeMap.set(row.id, row));
              rows = Array.from(mergeMap.values()).sort((a, b) => {
                const aTime = new Date(a.created_at || 0).getTime();
                const bTime = new Date(b.created_at || 0).getTime();
                return bTime - aTime;
              });
            }
          }
        }
      }

      const rowsToUse = rows.length > 0 ? rows : cachedRows;
      setDashboardProcesses(rowsToUse);
      if (rows.length > 0) {
        localStorage.setItem(localStorageKey, JSON.stringify(rows));
      }
      if (!selectedDashboardProcessId && rowsToUse.length > 0) {
        setSelectedDashboardProcessId(rowsToUse[0].id);
      }
      setDashboardProcessesLoading(false);
    };

    void loadDashboardProcesses();
  }, [currentUser.email, currentUser.name, currentUser.organizationId, currentUser.role, selectedDashboardProcessId]);

  React.useEffect(() => {
    if (!currentUser.id) return;
    localStorage.setItem(`sgi_dashboard_processes_${currentUser.id}`, JSON.stringify(dashboardProcesses));
  }, [currentUser.id, dashboardProcesses]);

  React.useEffect(() => {
    const selectedRow = selectedDashboardProcessId
      ? dashboardProcesses.find((row) => row.id === selectedDashboardProcessId)
      : dashboardProcesses[0];
    if (!selectedRow?.id || allowNewRequest) return;

    const loadSelectedProcessDetails = async () => {
      const { data: processEvents, error: processEventsError } = await supabase
        .from('process_events')
        .select('mensagem,created_at')
        .eq('process_id', selectedRow.id)
        .order('created_at', { ascending: true });
      if (processEventsError) {
        console.error('Erro ao carregar eventos do processo selecionado:', processEventsError);
      }

      const eventList = (processEvents || []) as Array<{ mensagem?: string | null; created_at?: string | null }>;
      const timeline = eventList.map((event) => ({
        date: event.created_at ? new Date(event.created_at).toLocaleString('pt-BR') : '-',
        message: event.mensagem || 'Atualização registrada',
      }));

      const createdAtLabel = selectedRow.created_at ? new Date(selectedRow.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
      const title = selectedRow.titulo || 'Solicitação de atendimento';
      const assignedProfessional = title.includes(' - ') ? title.split(' - ')[1]?.split('(')[0]?.trim() || 'Profissional a definir' : 'Profissional a definir';
      const serviceName = title.includes(' - ') ? title.split(' - ')[0].trim() : title;
      const scheduledSlot = title.includes('(') && title.includes(')') ? title.split('(').pop()?.replace(')', '').trim() || 'a confirmar' : 'a confirmar';

      setCreatedProcessId(selectedRow.id);
      setInitialStageFinished(true);
      setProcessStatus(mapDbStatusToProcessStatus(selectedRow.status));
      setServiceProcess({
        id: selectedRow.id,
        serviceName,
        scheduledSlot,
        assignedProfessional,
        statusLabel: PROCESS_STATUS_LABEL_MAP[(selectedRow.status || '').toLowerCase()] || 'aguardando atendimento',
        createdAt: createdAtLabel,
        steps: PROCESS_STEP_NAMES.map((stepName, index) => ({
          name: stepName,
          status: (selectedRow.status || '').toLowerCase() === 'concluido'
            ? 'concluido'
            : index === 0 ? 'em_andamento' : 'pendente',
          responsible: assignedProfessional,
          updatedAt: createdAtLabel,
          notes: index === 0 ? 'Processo carregado no dashboard principal.' : '',
        })),
        timeline,
      });
    };

    void loadSelectedProcessDetails();
  }, [allowNewRequest, dashboardProcesses, selectedDashboardProcessId]);

  React.useEffect(() => {
    const loadProfessionals = async () => {
      if (!selectedServiceId) {
        setAvailableProfessionals([]);
        return;
      }

      setIsLoadingProfessionals(true);
      setProfessionalsError(null);

      try {
        let professionalsBase: AvailableProfessional[] = [];

        const { data: contextAdmins, error: contextAdminsError } = await supabase
          .from('v_user_context')
          .select('user_id,email,nome_completo,org_id,org_role,org_slug,org_name')
          .eq('org_slug', 'default')
          .in('org_role', ['admin', 'owner']);

        if (!contextAdminsError && (contextAdmins || []).length > 0) {
          professionalsBase = ((contextAdmins || []) as Array<{
            user_id?: string | null;
            email?: string | null;
            nome_completo?: string | null;
            org_id?: string | null;
            org_role?: string | null;
          }>)
            .filter((admin) => {
              if (!admin.user_id) return false;
              if (!currentUser.organizationId) return true;
              return !admin.org_id || admin.org_id === currentUser.organizationId;
            })
            .map((admin) => ({
              id: admin.user_id as string,
              professional: admin.nome_completo || admin.email || 'Administrador',
              roleLabel: (admin.org_role || '').toLowerCase() === 'owner' ? 'Proprietário' : 'Administrador',
              email: admin.email || null,
              availableSlots: [],
              isAvailableNow: false,
              nextAvailableSlot: null,
              statusLabel: 'Indisponível',
              activeServiceCount: 0,
              scheduledTodayCount: 0,
              totalOpenDemands: 0,
              loadScore: 0,
            }));
        }

        let memberRows: Array<{ user_id: string; role: string }> = [];
        const profileMap = new Map<string, { id: string; nome_completo?: string | null; nome?: string | null; name?: string | null; email?: string | null; role?: string | null }>();

        if (currentUser.organizationId) {
          const { data: members, error: membersError } = await supabase
            .from('org_members')
            .select('user_id,role')
            .eq('org_id', currentUser.organizationId)
            .in('role', ['owner', 'admin']);

          if (!membersError) {
            memberRows = (members || []) as Array<{ user_id: string; role: string }>;
          }

          const userIds = memberRows.map((member) => member.user_id).filter(Boolean);

          if (userIds.length > 0) {
            const { data: profilesByMembers, error: profilesByMembersError } = await supabase
              .from('profiles')
              .select('id,nome_completo,nome,name,email,role')
              .in('id', userIds);

            if (profilesByMembersError) {
              throw profilesByMembersError;
            }

            ((profilesByMembers || []) as Array<{ id: string; nome_completo?: string | null; nome?: string | null; name?: string | null; email?: string | null; role?: string | null }>)
              .forEach((profile) => profileMap.set(profile.id, profile));
          }

          const { data: fallbackProfiles, error: fallbackProfilesError } = await supabase
            .from('profiles')
            .select('id,nome_completo,nome,name,email,role')
            .eq('org_id', currentUser.organizationId)
            .or('role.eq.admin,role.eq.owner,role.eq.ADMIN,role.eq.OWNER,role.eq.Administrador,role.eq.administrador');

          if (!fallbackProfilesError) {
            ((fallbackProfiles || []) as Array<{ id: string; nome_completo?: string | null; nome?: string | null; name?: string | null; email?: string | null; role?: string | null }>)
              .forEach((profile) => {
                if (!profileMap.has(profile.id)) {
                  profileMap.set(profile.id, profile);
                }
              });
          }
        }

        const fromMembers = memberRows.map((member) => {
          const profile = profileMap.get(member.user_id);
          const professionalName = profile?.nome_completo || profile?.nome || profile?.name || profile?.email || 'Profissional';
          return {
            id: member.user_id,
            professional: professionalName,
            roleLabel: member.role === 'owner' ? 'Proprietário' : 'Administrador',
            email: profile?.email || null,
            availableSlots: [],
            isAvailableNow: false,
            nextAvailableSlot: null,
            statusLabel: 'Indisponível',
            activeServiceCount: 0,
            scheduledTodayCount: 0,
            totalOpenDemands: 0,
            loadScore: 0,
          } as AvailableProfessional;
        });

        const fromProfiles = Array.from(profileMap.values()).map((profile) => {
          const roleNormalized = (profile.role || '').toLowerCase();
          return {
            id: profile.id,
            professional: profile.nome_completo || profile.nome || profile.name || profile.email || 'Profissional',
            roleLabel: roleNormalized === 'owner' ? 'Proprietário' : 'Administrador',
            email: profile.email || null,
            availableSlots: [],
            isAvailableNow: false,
            nextAvailableSlot: null,
            statusLabel: 'Indisponível',
            activeServiceCount: 0,
            scheduledTodayCount: 0,
            totalOpenDemands: 0,
            loadScore: 0,
          } as AvailableProfessional;
        });

        const uniqueById = new Map<string, AvailableProfessional>();
        [...fromMembers, ...fromProfiles].forEach((professional) => {
          uniqueById.set(professional.id, professional);
        });

        if (professionalsBase.length === 0) {
          professionalsBase = Array.from(uniqueById.values());
        }

        if (professionalsBase.length === 0) {
          const localUsers = (() => {
            try {
              const raw = localStorage.getItem('sgi_users');
              return raw ? JSON.parse(raw) as Array<{ id?: string; name?: string; email?: string; role?: string }> : [];
            } catch {
              return [] as Array<{ id?: string; name?: string; email?: string; role?: string }>;
            }
          })();

          const localAdmins = localUsers.filter((user) => (user.role || '').toString().toUpperCase() === 'ADMIN');
          if (localAdmins.length > 0) {
            professionalsBase = localAdmins.map((admin, index) => ({
              id: admin.id || `fallback-admin-${index}`,
              professional: admin.name || admin.email || `Administrador ${index + 1}`,
              roleLabel: 'Administrador',
              email: admin.email || null,
              availableSlots: [],
              isAvailableNow: false,
              nextAvailableSlot: null,
              statusLabel: 'Disponível agora',
              activeServiceCount: 0,
              scheduledTodayCount: 0,
              totalOpenDemands: 0,
              loadScore: 0,
            }));
          }
        }

        if (professionalsBase.length === 0) {
          professionalsBase = SERVICE_MANAGERS.map((name, index) => ({
            id: `fallback-manager-${index}`,
            professional: name,
            roleLabel: 'Administrador',
            email: null,
            availableSlots: [],
            isAvailableNow: false,
            nextAvailableSlot: null,
            statusLabel: 'Disponível agora',
            activeServiceCount: 0,
            scheduledTodayCount: 0,
            totalOpenDemands: 0,
            loadScore: 0,
          }));
        }

        const professionalIds = professionalsBase.map((professional) => professional.id).filter((id) => UUID_PATTERN.test(id));
        let processRows: Array<{ responsavel_user_id: string | null; status: string | null; created_at: string | null }> = [];

        if (professionalIds.length > 0) {
          const { data: processData } = await supabase
            .from('processes')
            .select('responsavel_user_id,status,created_at')
            .eq('org_id', currentUser.organizationId)
            .in('responsavel_user_id', professionalIds);

          processRows = (processData || []) as Array<{ responsavel_user_id: string | null; status: string | null; created_at: string | null }>;
        }

        const todayIso = new Date().toISOString().slice(0, 10);
        const hourNow = new Date().getHours();
        const baseSlotTemplates = ['09:00', '10:30', '14:00', '16:00'];

        const rankedProfessionals = professionalsBase
          .map((professional) => {
            const professionalProcesses = processRows.filter((processRow) => processRow.responsavel_user_id === professional.id);
            const activeServiceCount = professionalProcesses.filter((processRow) => {
              const normalizedStatus = (processRow.status || '').toLowerCase();
              return normalizedStatus === 'triagem' || normalizedStatus === 'analise' || normalizedStatus === 'análise';
            }).length;
            const totalOpenDemands = professionalProcesses.filter((processRow) => (processRow.status || '').toLowerCase() !== 'concluido').length;
            const scheduledTodayCount = professionalProcesses.filter((processRow) => (processRow.created_at || '').startsWith(todayIso)).length;
            const occupiedSlots = Math.min(baseSlotTemplates.length, scheduledTodayCount);
            const availableSlots = baseSlotTemplates.slice(occupiedSlots);
            const isAvailableNow = availableSlots.length > 0 && hourNow >= 9 && hourNow < 18;
            const nextAvailableSlot = availableSlots[0] ?? null;
            const loadScore = activeServiceCount * 3 + scheduledTodayCount * 2 + totalOpenDemands;
            const statusLabel = isAvailableNow
              ? 'Disponível agora'
              : nextAvailableSlot
                ? `Próximo horário disponível: ${nextAvailableSlot}`
                : 'Indisponível';

            return {
              ...professional,
              activeServiceCount,
              scheduledTodayCount,
              totalOpenDemands,
              loadScore,
              availableSlots,
              isAvailableNow,
              nextAvailableSlot,
              statusLabel,
            };
          })
          .sort((a, b) => {
            if (Number(b.isAvailableNow) !== Number(a.isAvailableNow)) return Number(b.isAvailableNow) - Number(a.isAvailableNow);
            if (a.loadScore !== b.loadScore) return a.loadScore - b.loadScore;
            if (a.scheduledTodayCount !== b.scheduledTodayCount) return a.scheduledTodayCount - b.scheduledTodayCount;
            return a.professional.localeCompare(b.professional);
          });

        const recommendedId = rankedProfessionals[0]?.id;
        const enriched = rankedProfessionals.map((professional) => ({
          ...professional,
          isRecommended: professional.id === recommendedId,
        }));

        if (AUTO_ASSIGNMENT_ENABLED && !selectedSlot && enriched[0]?.availableSlots.length) {
          setSelectedSlot(enriched[0].id);
        }

        setAvailableProfessionals(enriched);
      } catch {
        setProfessionalsError('Não foi possível carregar os profissionais administradores.');
        setAvailableProfessionals([]);
      } finally {
        setIsLoadingProfessionals(false);
      }
    };

    void loadProfessionals();
  }, [currentUser.organizationId, selectedServiceId]);

  const handlePrint = () => {
    window.print();
  };

  const handleAddComment = () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    const createdAt = new Date().toLocaleString('pt-BR');
    setProcessComments((previous) => [{ id: crypto.randomUUID(), text: trimmed, createdAt }, ...previous]);
    setNewComment('');
    void logTimelineEvent(`Comentário registrado pelo cliente em ${createdAt}.`);
  };

  const handleAttachmentUpload: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const uploadedAt = new Date().toLocaleString('pt-BR');
    const mappedFiles = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      sizeLabel: `${(file.size / 1024).toFixed(1)} KB`,
      uploadedAt,
    }));
    setProcessFiles((previous) => [...mappedFiles, ...previous]);
    void logTimelineEvent(`${files.length} anexo(s) enviado(s) pelo cliente.`);
    event.target.value = '';
  };

  const handleDownloadReceipt = (entry: { id: string; serviceName: string; totalLabel: string; paidAt: string }) => {
    const receiptText = `Comprovante SGI-FV\nOS: ${entry.id}\nCliente: ${currentUser.name}\nServiço: ${entry.serviceName}\nValor: ${entry.totalLabel}\nData pagamento: ${entry.paidAt}\n`;
    const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comprovante-${entry.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTechnicalReport = () => {
    if (!serviceProcess) return;
    const historyLines = serviceProcess.timeline.map((event) => `- ${event.date}: ${event.message}`).join('\n');
    const reportText = `RELATÓRIO TÉCNICO - SIGA FV\nCliente: ${currentUser.name}\nEmail: ${currentUser.email}\nOS: ${serviceProcess.id}\nServiço: ${serviceProcess.serviceName}\nValor pago: ${totalPriceLabel}\nSetor Responsável: ${displaySectorName}\n\nHistórico:\n${historyLines}\n\nInterações:\nComentários: ${processComments.length}\nAnexos: ${processFiles.length}\n\nParecer técnico:\nProcesso em acompanhamento pela equipe técnica.`;
    const blob = new Blob([reportText], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-tecnico-${serviceProcess.id}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectedSlotData = React.useMemo(
    () => availableProfessionals.find((professional) => professional.id === selectedSlot) ?? null,
    [availableProfessionals, selectedSlot],
  );

  React.useEffect(() => {
    if (selectedSlot && (!selectedSlotData || selectedSlotData.availableSlots.length === 0)) {
      setSelectedSlot('');
      setSelectedAdminScheduleSlot('');
      setPaymentMethod('');
      setPaymentStatus('idle');
    }
  }, [selectedSlot, selectedSlotData]);

  const logTimelineEvent = async (message: string) => {
    try {
      await supabase.from('process_events').insert({
        process_id: null,
        org_id: currentUser.organizationId ?? null,
        created_by: currentUser.id,
        tipo: 'registro',
        mensagem: message,
      });
    } catch {
      // não bloqueia fluxo do usuário
    }
  };

  const handleFinalizeInitialStage = async () => {
    if (!selectedService || !selectedSlotData || !currentUser.organizationId) {
      setProcessCreationError('Não foi possível gerar o processo. Verifique serviço, agenda e organização.');
      return;
    }

    if (createdProcessId && serviceProcess) {
      setInitialStageFinished(true);
      return;
    }

    setIsCreatingProcess(true);
    setProcessCreationError(null);

    try {
      let createdProcess: { id: string } | null = null;

      const { data: functionResult, error: functionError } = await supabase.functions.invoke(
        SUPABASE_EDGE_FUNCTIONS.CREATE_CLIENT_PROCESS,
        {
          body: {
            organizationId: currentUser.organizationId,
            serviceName: selectedService.name,
            serviceArea: selectedService.area,
            scheduledSlot: selectedAdminScheduleSlot || null,
            assignedProfessionalName: selectedSlotData.professional,
            assignedAdminId: UUID_PATTERN.test(selectedSlotData.id) ? selectedSlotData.id : null,
            clientName: currentUser.name,
            clientDocument: currentUser.documentId || null,
            clientContact: currentUser.email || currentUser.phone || null,
            organizationName: currentUser.organizationName || null,
          },
        },
      );

      if (!functionError && functionResult?.success && functionResult?.processId) {
        createdProcess = { id: functionResult.processId as string };
      } else {
        throw functionError || new Error(functionResult?.error || 'Falha ao criar processo');
      }

      setCreatedProcessId(createdProcess.id);
      setSelectedDashboardProcessId(createdProcess.id);
      setDashboardProcesses((previous) => [
        {
          id: createdProcess.id,
          titulo: selectedService.name,
          protocolo: createdProcess.id,
          status: 'triagem',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          unidade_atendimento: selectedService.area,
          cliente_nome: currentUser.name,
          cliente_contato: currentUser.email || currentUser.phone || null,
          responsavel_user_id: UUID_PATTERN.test(selectedSlotData.id) ? selectedSlotData.id : null,
          data_conclusao: null,
        },
        ...previous.filter((row) => row.id !== createdProcess.id),
      ]);

      await supabase.from('process_events').insert({
        org_id: currentUser.organizationId,
        process_id: createdProcess.id,
        tipo: 'registro',
        mensagem: `Processo criado a partir do onboarding. Profissional indicado: ${selectedSlotData.professional}. Horário previsto: ${selectedAdminScheduleSlot || 'a confirmar'}. Serviço: ${selectedService.name}.`,
        created_by: currentUser.id,
      });
      await supabase.from('process_events').insert({
        org_id: currentUser.organizationId,
        process_id: createdProcess.id,
        tipo: 'atribuicao',
        mensagem: `Atendimento atribuído para ${selectedSlotData.professional}. Outros administradores da organização podem assumir se necessário.`,
        created_by: currentUser.id,
      });

      const now = new Date().toLocaleString('pt-BR');
      setServiceProcess({
        id: createdProcess.id,
        serviceName: selectedService.name,
        scheduledSlot: selectedAdminScheduleSlot || 'a confirmar',
        assignedProfessional: selectedSlotData.professional,
        statusLabel: 'aguardando atendimento',
        createdAt: now,
        steps: PROCESS_STEP_NAMES.map((stepName, index) => ({
          name: stepName,
          status: index === 0 ? 'em_andamento' : 'pendente',
          responsible: selectedSlotData.professional,
          updatedAt: now,
          notes: index === 0 ? 'Pagamento confirmado e atendimento iniciado.' : '',
        })),
        timeline: [
          { date: now, message: 'Ordem de Serviço criada' },
          { date: now, message: `Setor responsável atualizado (${selectedSlotData.professional})` },
        ],
      });
      setFinanceEntries((previous) => [
        {
          id: createdProcess.id,
          serviceName: selectedService.name,
          totalLabel: totalPriceLabel,
          paidAt: now,
        },
        ...previous,
      ]);

      setInitialStageFinished(true);
      setAllowNewRequest(false);
      if (processStatus === ProcessStatus.PENDENTE) {
        setProcessStatus(ProcessStatus.TRIAGEM);
      }
      await logTimelineEvent(`Etapa inicial finalizada após pagamento confirmado. Processo ${createdProcess.id} gerado e encaminhado para o setor responsável.`);
    } catch {
      setProcessCreationError('Falha ao gerar processo para o setor responsável. Tente novamente.');
    } finally {
      setIsCreatingProcess(false);
    }
  };

  return (
  <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-gray-800">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 no-print">
        <div>
          <h1 className="text-xl font-black text-gray-800 tracking-tighter">SGI FV FORMANDO VALORES</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-gray-500 text-xs font-bold uppercase">{currentUser.registrationDate}</p>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <p className="text-gray-700 text-sm font-bold">{currentUser.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handlePrint} 
            title="Imprimir visualização atual"
            className="p-2 bg-white hover:bg-gray-100 rounded-lg text-gray-700 transition-colors flex items-center gap-2 px-4 text-xs font-bold uppercase border border-gray-200"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button 
            onClick={handlePrint} 
            title="Salvar como PDF"
            className="p-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors flex items-center gap-2 px-4 text-xs font-bold border border-blue-200 uppercase"
          >
            <FileDown className="w-4 h-4" /> Gerar PDF
          </button>
          <button onClick={onLogout} className="p-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-600 transition-colors flex items-center gap-2 px-4 text-xs font-bold uppercase border border-red-200">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      <section className="mb-6 bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-black text-gray-800">Guia rápido do sistema</h2>
        <ol className="mt-2 list-decimal pl-5 text-sm text-gray-600 space-y-1">
          <li>Crie uma <strong>Nova Ordem de Serviço</strong> escolhendo área e serviço.</li>
          <li>Confira o total (serviço + quota associativa) e conclua o pagamento.</li>
          <li>Após aprovação, envie anexos e comentários dentro da OS.</li>
          <li>Acompanhe o histórico, baixe relatório técnico e comprovantes financeiros.</li>
        </ol>
      </section>

      <section className="mb-6 bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-black text-gray-800">Acompanhamento dos Meus Processos</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { id: 'andamento', label: 'Em andamento' },
            { id: 'concluidos', label: 'Concluídos' },
            { id: 'todos', label: 'Todos' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDashboardProcessFilter(tab.id as 'todos' | 'andamento' | 'concluidos')}
              className={`rounded-lg px-3 py-2 text-xs font-black uppercase ${dashboardProcessFilter === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          value={dashboardProcessSearch}
          onChange={(event) => setDashboardProcessSearch(event.target.value)}
          placeholder="Buscar por nº processo, OS, serviço, status..."
          className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />

        {dashboardProcessesLoading ? (
          <p className="mt-3 text-sm text-gray-500 font-semibold">Carregando processos...</p>
        ) : filteredDashboardProcesses.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600 font-semibold">
            Você ainda não possui processos cadastrados. Clique em Nova Ordem de Serviço para iniciar um atendimento.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
            {filteredDashboardProcesses.map((processRow) => {
              const isSelected = selectedDashboardProcessId === processRow.id || (!selectedDashboardProcessId && filteredDashboardProcesses.length === 1);
              const statusNormalized = (processRow.status || '').toLowerCase();
              const situation = statusNormalized === 'concluido' ? 'Concluído' : 'Em andamento';
              return (
                <button
                  key={processRow.id}
                  type="button"
                  onClick={() => setSelectedDashboardProcessId(processRow.id)}
                  className={`text-left rounded-xl border p-3 ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}
                >
                  <p className="text-xs text-gray-500 font-black uppercase">Processo {processRow.id}</p>
                  <p className="text-sm font-bold text-gray-800">OS: {processRow.protocolo || processRow.id}</p>
                  <p className="text-xs text-gray-600">Área: {processRow.unidade_atendimento || '-'}</p>
                  <p className="text-xs text-gray-600">Serviço: {processRow.titulo || '-'}</p>
                  <p className="text-xs text-gray-600">Status: {processRow.status || '-'}</p>
                  <p className="text-xs text-gray-600">Abertura: {processRow.created_at ? new Date(processRow.created_at).toLocaleString('pt-BR') : '-'}</p>
                  <p className="text-xs text-gray-700 font-bold">Situação: {situation}</p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {isOnboardingFlow && (
        <section className="mb-6 bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-black text-gray-800">Primeiro acesso guiado</h2>
          <p className="text-sm text-gray-500 mb-4">Selecione o seu serviço pela área selecionada.</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[
              { id: 'administrativo', label: 'Administrativo' },
              { id: 'juridico', label: 'Jurídico' },
              { id: 'tecnologico', label: 'Tecnológico' },
              { id: 'recursos_humanos', label: 'Recursos Humanos' },
            ].map((areaButton) => (
              <button
                key={areaButton.id}
                type="button"
                onClick={() => {
                  const nextArea = areaButton.id as ServiceArea;
                  setSelectedArea(nextArea);
                  setSelectedServiceId('');
                  setPaymentMethod('');
                  setPaymentStatus('idle');
                  setSelectedSlot('');
                  setSelectedAdminScheduleSlot('');
                  setInitialStageFinished(false);
                  void logTimelineEvent(`Área selecionada no primeiro acesso: ${nextArea}.`);
                }}
                className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${selectedArea === areaButton.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700'}`}
              >
                {areaButton.label}
              </button>
            ))}
          </div>

          {selectedArea && (
            <div className="space-y-3">
              <p className="text-xs font-black uppercase text-gray-500">Serviços disponíveis</p>
              <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
                {guidedServices.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => {
                      setSelectedServiceId(service.id);
                      setPaymentMethod('');
                      setPaymentStatus('idle');
                      setSelectedSlot('');
                      setSelectedAdminScheduleSlot('');
                      setInitialStageFinished(false);
                      void logTimelineEvent(`Serviço escolhido no primeiro acesso: ${service.name} (${service.priceLabel}).`);
                    }}
                    className={`text-left rounded-xl border p-3 ${selectedServiceId === service.id ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}
                  >
                    <p className="text-xs uppercase font-black text-gray-500">{service.category}</p>
                    <p className="font-bold text-gray-800">{service.name}</p>
                    <p className="text-sm text-blue-600 font-semibold">{service.priceLabel}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedService && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-black uppercase text-gray-500">Resumo da Ordem de Serviço</p>
              <p className="font-bold text-gray-800">{selectedService.name}</p>
              <p className="text-sm text-blue-600 font-semibold">Serviço: {selectedService.priceLabel}</p>
              <p className="text-sm text-gray-700 font-semibold">Quota Associativa Convênio: {ASSOCIATIVE_FEE_EUR}€</p>
              <p className="text-sm text-emerald-700 font-black">Total da cobrança: {totalPriceLabel}</p>
              <button
                type="button"
                className="mt-2 rounded-lg bg-blue-600 text-white text-sm font-bold px-3 py-2"
              >
                Prosseguir para pagamento
              </button>
            </div>
          )}

          {selectedService && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-black uppercase text-gray-500 mb-2">Setor responsável disponível</p>
              {isLoadingProfessionals && (
                <p className="text-sm font-semibold text-gray-500">Carregando profissionais...</p>
              )}
              {professionalsError && (
                <p className="text-sm font-semibold text-red-600">{professionalsError}</p>
              )}
              {!isLoadingProfessionals && !professionalsError && availableProfessionals.length === 0 && (
                <p className="text-sm font-semibold text-amber-700">
                  Nenhum administrador disponível nesta organização para receber o serviço.
                </p>
              )}
              {!isLoadingProfessionals && !professionalsError && availableProfessionals.length > 0 && (
                <>
                  {availableProfessionals.every((professional) => professional.availableSlots.length === 0) && (
                    <p className="text-sm font-semibold text-amber-700 mb-2">
                      No momento não há profissionais com agenda disponível para este serviço.
                    </p>
                  )}
                  <div className="space-y-2">
                    {availableProfessionals.map((slot, index) => (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={slot.availableSlots.length === 0}
                        onClick={() => {
                          setSelectedSlot(slot.id);
                          setSelectedAdminScheduleSlot(slot.availableSlots[0] || '');
                          setPaymentMethod('');
                          setPaymentStatus('idle');
                          void logTimelineEvent(`Profissional selecionado pelo cliente: ${slot.professional} (${slot.roleLabel}). Horário previsto: ${slot.availableSlots[0] || 'indefinido'}. Status agenda: ${slot.statusLabel}.`);
                        }}
                        className={`w-full text-left rounded-lg border p-3 disabled:opacity-60 ${selectedSlot === slot.id ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-800">Setor Jurídico Conveniado à AI • Equipe {index + 1}</p>
                          {slot.isRecommended && (
                            <span className="rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 uppercase tracking-wider">
                              Recomendado
                            </span>
                          )}
                          {slot.isAvailableNow && (
                            <span className="rounded-full bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-1 uppercase tracking-wider">
                              Disponível agora
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{slot.roleLabel}</p>
                        <p className={`text-xs font-bold mt-1 ${slot.availableSlots.length ? 'text-emerald-700' : 'text-amber-700'}`}>{slot.statusLabel}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Em andamento: {slot.activeServiceCount} • Agendados hoje: {slot.scheduledTodayCount} • Fila aberta: {slot.totalOpenDemands}
                        </p>
                        {slot.availableSlots.length > 0 && (
                          <p className="text-xs text-blue-700 font-semibold mt-1">
                            Próximos horários: {slot.availableSlots.slice(0, 3).join(' • ')}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {selectedService && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-black uppercase text-gray-500">Pagamento da Ordem de Serviço</p>
              {!selectedSlot && (
                <p className="mt-2 text-sm font-semibold text-amber-700">
                  Selecione primeiro um setor responsável para liberar o pagamento.
                </p>
              )}
              {selectedSlot && (
                <p className="mt-2 text-sm font-semibold text-blue-700">
                  Setor responsável selecionado ({selectedAdminScheduleSlot || 'sem horário disponível'}). Agora escolha a forma de pagamento.
                </p>
              )}
              <p className="mt-2 text-sm font-bold text-gray-700">
                Total da OS: {totalPriceLabel} (serviço + quota associativa de {ASSOCIATIVE_FEE_EUR}€)
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!canContinueToPayment}
                  onClick={() => {
                    setPaymentMethod('cartao');
                    setPaymentStatus('confirmed');
                    void logTimelineEvent(`Pagamento iniciado no Stripe por cartão para ${selectedService.name}, após seleção do setor responsável.`);
                    void logTimelineEvent(`Pagamento confirmado automaticamente (cartão) para ${selectedService.name}.`);
                    void handleFinalizeInitialStage();
                  }}
                  className="rounded-xl bg-blue-600 text-white font-bold px-4 py-2 disabled:opacity-50"
                >
                  Pagar com cartão
                </button>
                <button
                  type="button"
                  disabled={!canContinueToPayment}
                  onClick={() => {
                    setPaymentMethod('boleto');
                    setPaymentStatus('awaiting_confirmation');
                    void logTimelineEvent(`Pagamento iniciado no Stripe por boleto para ${selectedService.name}, após seleção do setor responsável. Aguardando confirmação.`);
                  }}
                  className="rounded-xl border border-blue-200 bg-white text-blue-700 font-bold px-4 py-2 disabled:opacity-50"
                >
                  Pagar com boleto
                </button>
              </div>

              {paymentStatus === 'awaiting_confirmation' && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-700">
                    Aguardando confirmação de pagamento do boleto. Após confirmação, o fluxo continuará automaticamente.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentStatus('confirmed');
                      void logTimelineEvent(`Pagamento confirmado após compensação de boleto para ${selectedService.name}.`);
                      void handleFinalizeInitialStage();
                    }}
                    className="mt-2 rounded-lg bg-amber-600 text-white px-3 py-2 text-sm font-bold"
                  >
                    Confirmar pagamento do boleto
                  </button>
                </div>
              )}

              {paymentStatus === 'confirmed' && (
                <div className="mt-3 space-y-3">
                  <p className="text-sm font-semibold text-emerald-700">
                    Pagamento confirmado via {paymentMethod === 'cartao' ? 'cartão de crédito' : 'boleto'}.
                  </p>
                  <button
                    type="button"
                    disabled={isCreatingProcess}
                    onClick={() => {
                      void handleFinalizeInitialStage();
                    }}
                    className="rounded-xl bg-emerald-600 text-white font-bold px-4 py-2 disabled:opacity-60"
                  >
                    {isCreatingProcess ? 'Gerando processo...' : 'Finalizar pagamento e liberar área da OS'}
                  </button>
                  {processCreationError && (
                    <p className="text-sm font-semibold text-red-600">{processCreationError}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {initialStageFinished && (
        <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-6">
          <h2 className="text-lg font-black text-emerald-800">Etapa inicial concluída</h2>
          <p className="text-sm font-semibold text-emerald-700 mt-1">
            Pagamento aprovado e área da Ordem de Serviço liberada para envio de comentários e documentos.
          </p>
          {createdProcessId && (
            <div className="text-xs font-bold text-emerald-800 mt-2 space-y-1">
              <p>Número da OS: {createdProcessId}</p>
              <p>Serviço contratado: {selectedService?.name || serviceProcess?.serviceName || '-'}</p>
              <p>Valor pago: {totalPriceLabel}</p>
            </div>
          )}
        </section>
      )}

      {serviceProcess && (
        <section className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-6">
          <h2 className="text-lg font-black text-blue-800">PROCESSO EM ANDAMENTO</h2>
          <p className="text-sm font-semibold text-emerald-700 mt-1">Pagamento confirmado! Seu atendimento foi iniciado.</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <p><span className="font-black text-gray-600 uppercase text-xs">Setor responsável</span><br />{displaySectorName}</p>
            <p><span className="font-black text-gray-600 uppercase text-xs">Status</span><br />{serviceProcess.statusLabel}</p>
            <p><span className="font-black text-gray-600 uppercase text-xs">Serviço</span><br />{serviceProcess.serviceName}</p>
            <p><span className="font-black text-gray-600 uppercase text-xs">Data/Hora</span><br />{serviceProcess.createdAt} • {serviceProcess.scheduledSlot}</p>
          </div>
          <div className="mt-4 space-y-2">
            {serviceProcess.steps.map((step) => (
              <div key={step.name} className="rounded-lg border border-blue-100 bg-white p-3">
                <p className="text-sm font-bold text-gray-800">{step.name}</p>
                <p className="text-xs text-gray-500">Status: {step.status} • Setor Responsável: {displaySectorName} • Atualizado: {step.updatedAt}</p>
                {step.notes && <p className="text-xs text-gray-600 mt-1">{step.notes}</p>}
              </div>
            ))}
          </div>
          <button type="button" className="mt-4 rounded-xl border border-blue-200 bg-white text-blue-700 font-bold px-4 py-2">
            Acompanhar atendimento da OS
          </button>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-blue-100 bg-white p-3">
              <p className="text-xs font-black uppercase text-gray-500 mb-2">Comentários</p>
              <textarea
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm"
                placeholder="Escreva um comentário sobre a OS..."
              />
              <button type="button" onClick={handleAddComment} className="mt-2 rounded-lg bg-blue-600 text-white text-xs font-bold px-3 py-2">
                Registrar comentário
              </button>
              <div className="mt-2 space-y-1 max-h-28 overflow-auto">
                {processComments.map((comment) => (
                  <p key={comment.id} className="text-xs text-gray-600">{comment.createdAt} • {comment.text}</p>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white p-3">
              <p className="text-xs font-black uppercase text-gray-500 mb-2">Anexos</p>
              <input type="file" multiple onChange={handleAttachmentUpload} className="text-xs" />
              <div className="mt-2 space-y-1 max-h-28 overflow-auto">
                {processFiles.map((file) => (
                  <p key={file.id} className="text-xs text-gray-600">{file.uploadedAt} • {file.name} ({file.sizeLabel})</p>
                ))}
              </div>
            </div>
          </div>
          {serviceProcess.timeline.length > 0 && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-white p-3">
              <p className="text-xs font-black uppercase text-gray-500 mb-2">Histórico do processo</p>
              <div className="space-y-1">
                {serviceProcess.timeline.map((event, index) => (
                  <p key={`${event.date}-${index}`} className="text-xs text-gray-600">
                    {event.date} • {event.message}
                  </p>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-blue-100 bg-white p-3">
              <p className="text-xs font-black uppercase text-gray-500 mb-2">Relatório técnico</p>
              <p className="text-xs text-gray-600 mb-2">Visualize os dados consolidados da OS e baixe em PDF.</p>
              <button type="button" onClick={handleDownloadTechnicalReport} className="rounded-lg bg-slate-700 text-white text-xs font-bold px-3 py-2">
                Baixar relatório técnico (PDF)
              </button>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white p-3">
              <p className="text-xs font-black uppercase text-gray-500 mb-2">Suporte</p>
              <a
                href={`https://wa.me/351935362089?text=${encodeURIComponent(`Olá, preciso de suporte técnico para a OS ${serviceProcess.id}. Cliente: ${currentUser.name}.`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-lg bg-green-600 text-white text-xs font-bold px-3 py-2"
              >
                Fale com a Área Técnica
              </a>
            </div>
          </div>
          {financeEntries.length > 0 && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-white p-3">
              <p className="text-xs font-black uppercase text-gray-500 mb-2">Módulo financeiro</p>
              <div className="space-y-2">
                {financeEntries.map((entry) => (
                  <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>{entry.serviceName} • {entry.totalLabel} • {entry.paidAt}</span>
                    <button type="button" onClick={() => handleDownloadReceipt(entry)} className="rounded-lg border border-gray-300 px-2 py-1 font-bold">
                      Baixar comprovante
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setAllowNewRequest(true);
              setInitialStageFinished(false);
              setCreatedProcessId(null);
              setServiceProcess(null);
              setSelectedArea(null);
              setSelectedServiceId('');
              setSelectedSlot('');
              setSelectedAdminScheduleSlot('');
              setPaymentMethod('');
              setPaymentStatus('idle');
            }}
            className="mt-3 rounded-xl bg-white border border-emerald-200 text-emerald-700 font-bold px-4 py-2"
          >
            Nova Ordem de Serviço
          </button>
        </section>
      )}

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Status Section */}
        <section className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                <Activity className="text-blue-500" /> STATUS DO PROCESSO
              </h2>
              <span className="bg-blue-50 px-3 py-1 rounded-full text-[10px] font-black text-blue-600 tracking-widest uppercase">ACOMPANHAMENTO EM TEMPO REAL</span>
            </div>

            {/* Stepper */}
            <div className="relative flex justify-between mb-12">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 z-0"></div>
              {steps.map((step, idx) => (
                <div key={step.label} className="relative z-10 flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white transition-all ${idx <= currentStepIndex ? step.color : 'bg-gray-300'}`}>
                    {idx < currentStepIndex ? <div className="w-3 h-3 bg-white rounded-full"></div> : null}
                    {idx === currentStepIndex ? <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div> : null}
                  </div>
                  <span className={`mt-3 text-[10px] font-black uppercase tracking-tighter ${idx <= currentStepIndex ? 'text-gray-800' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Destaque Central Dividido: Setor e Notas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
               {/* Lado Esquerdo: Setor */}
               <div className="p-8 flex flex-col items-center text-center border-b md:border-b-0 md:border-r border-gray-200">
                  <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-blue-600 shadow-xl`}>
                    <UserCheck className="text-white w-8 h-8" />
                  </div>
                  <p className="text-xl font-black uppercase tracking-tight text-gray-800">{displaySectorName}</p>
                  <p className="text-gray-500 text-[10px] mt-1 uppercase font-bold tracking-widest">Setor Responsável</p>
               </div>

               {/* Lado Direito: Notas do Atendimento */}
               <div className="p-8 flex flex-col items-center text-center">
                  <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-purple-600 shadow-xl`}>
                    <MessageSquare className="text-white w-8 h-8" />
                  </div>
                  <div className="max-h-24 overflow-y-auto w-full">
                    <p className="text-sm font-bold text-gray-700 leading-tight italic">
                      {currentUser.notes ? `"${currentUser.notes}"` : "Nenhuma observação no momento."}
                    </p>
                  </div>
                  <p className="text-gray-500 text-[10px] mt-1 uppercase font-bold tracking-widest">Notas do Atendimento</p>
               </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-800">
              <Landmark className="text-emerald-500" /> PROCESSAMENTO ADMINISTRATIVO
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                <p className="text-gray-500 text-[10px] font-black uppercase mb-1">Protocolo SGI</p>
                <p className="text-xl font-black text-blue-400">{currentUser.protocol}</p>
              </div>
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                <p className="text-gray-500 text-[10px] font-black uppercase mb-1">Situação Atual</p>
                <p className="text-xl font-black text-gray-800">{currentUser.status}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Sidebar Data Section */}
        <section className="space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-800">
              <UserIcon className="text-purple-500" /> DADOS CADASTRAIS
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-gray-500 text-[10px] font-black uppercase">Unidade</p>
                <p className="text-sm font-bold text-gray-700">{currentUser.unit}</p>
              </div>
              <div className="h-px bg-gray-200"></div>
              <div>
                <p className="text-gray-500 text-[10px] font-black uppercase">Identificação Fiscal</p>
                <p className="text-sm font-bold text-gray-700">{currentUser.taxId}</p>
              </div>
              <div className="h-px bg-gray-200"></div>
              <div>
                <p className="text-gray-500 text-[10px] font-black uppercase">Contato</p>
                <p className="text-sm font-bold text-gray-700">{currentUser.phone}</p>
              </div>
              <div className="h-px bg-gray-200"></div>
              <div>
                <p className="text-gray-500 text-[10px] font-black uppercase">País / DDD</p>
                <p className="text-sm font-bold text-gray-700">{currentUser.country}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-800">
              <Calendar className="text-orange-500" /> LINHA DO TEMPO
            </h2>
            <div className="max-h-64 overflow-y-auto pr-2 relative">
              <div className="absolute left-1 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              <div className="space-y-8 pl-6 relative">
                {currentUser.lastUpdate && (
                   <div className="relative">
                    <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></div>
                    <p className="text-xs font-black text-emerald-500">{currentUser.lastUpdate}</p>
                    <p className="text-sm font-bold text-gray-800 mt-1">ATUALIZAÇÃO DE STATUS</p>
                    <p className="text-xs text-gray-500">O processo avançou para a etapa de {currentUser.status}.</p>
                  </div>
                )}
                <div className="relative">
                  <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white"></div>
                  <p className="text-xs font-black text-blue-400">{currentUser.registrationDate}</p>
                  <p className="text-sm font-bold text-gray-800 mt-1">REGISTRO SGI FV</p>
                  <p className="text-xs text-gray-500">Ficha de cliente aberta com sucesso.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/>
  </svg>
);

export default UserDashboard;
