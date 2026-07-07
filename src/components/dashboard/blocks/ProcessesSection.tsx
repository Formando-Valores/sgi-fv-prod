import React, { useEffect, useState } from 'react';
import { Eye, Pencil, Search, X, Plus, Trash2, ChevronDown, SearchX } from 'lucide-react';
import type { Process as DbProcess } from '../../../lib/processes';
import { ProcessStatus, ServiceUnit, type User, type Organization } from '../../../../types';
import { sanitizeDisplayValue } from '../../../lib/clientUtils';
import { supabase } from '../../../../supabase';
import { calcAssociationFees, formatEuro } from '../../../lib/servicesCatalog';
import { filterServicesByUnit, filterGroupsByUnit, filterServicesByGroup, type DbCatalogService } from '../../../lib/servicesCatalogDb';
import { getPaymentStatusUi } from '../../../lib/paymentStatus';
import { useToast } from '../../../contexts/ToastContext';
import Card from '../../ui/Card';
import Badge from '../../ui/Badge';

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
  associationFees?: { type: string; name: string; price: number; destination: string }[] | null;
}

type ProcessQuickPreset = 'andamento' | 'atencao' | 'novos7d';

interface NewProcessFormState {
  organizationId: string;
  title: string;
  clientName: string;
  clientDocument: string;
  clientContact: string;
  serviceUnit: ServiceUnit | null;
  selectedServiceIds: string[];
  osValue: number | undefined;
  donation: number;
}

const statusBadgeVariant = (status: ProcessStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
  if (status === ProcessStatus.CONCLUIDO) return 'success';
  if (status === ProcessStatus.ANALISE) return 'warning';
  if (status === ProcessStatus.TRIAGEM) return 'info';
  return 'neutral';
};

const PROCESS_SELECT_BASE_COLUMNS = 'id,org_id,titulo,protocolo,status,cliente_nome,cliente_documento,cliente_contato,responsavel_user_id,created_at,updated_at,origem_canal,unidade_atendimento,org_nome_solicitado,payment_status,process_status,os_value,services_selected,association_fees';

const normalizeProcessOptionalFields = (process: Partial<DbProcess>): DbProcess => ({
  ...(process as DbProcess),
  data_prazo: process.data_prazo ?? null,
  gestor_servico: process.gestor_servico ?? null,
  observacoes: process.observacoes ?? null,
  services_selected: (process as Record<string, unknown>).services_selected ?? null,
  association_fees: (process as Record<string, unknown>).association_fees ?? null,
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

interface ProcessesSectionProps {
  baseProcessRows: AdminProcessRow[];
  organizations: Organization[];
  currentUser: User;
  isClientScope: boolean;
  canCreateProcess: boolean;
  sectionReadOnly: boolean;
  adminCatalog: DbCatalogService[];
  setDbProcesses: React.Dispatch<React.SetStateAction<DbProcess[]>>;
  editingUser: AdminProcessRow | User | null;
  selectedUser: AdminProcessRow | User | null;
  setEditingUser: React.Dispatch<React.SetStateAction<AdminProcessRow | User | null>>;
  setSelectedUser: React.Dispatch<React.SetStateAction<AdminProcessRow | User | null>>;
  newAdminOrgId: string;
  currentSection: string;
  locationSearch: string;
  ProcessesContainer: React.ComponentType<{ children: React.ReactNode }>;
}

const ProcessesSection: React.FC<ProcessesSectionProps> = ({
  baseProcessRows,
  organizations,
  currentUser,
  isClientScope,
  canCreateProcess,
  sectionReadOnly,
  adminCatalog,
  setDbProcesses,
  editingUser,
  selectedUser,
  setEditingUser,
  setSelectedUser,
  newAdminOrgId,
  currentSection,
  locationSearch,
  ProcessesContainer,
}) => {
  const { showToast } = useToast();
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
  const [newProcessForm, setNewProcessForm] = useState<NewProcessFormState>({
    organizationId: '',
    title: '',
    clientName: '',
    clientDocument: '',
    clientContact: '',
    serviceUnit: null,
    selectedServiceIds: [],
    osValue: undefined,
    donation: 0,
  });
  const [adminServiceSearch, setAdminServiceSearch] = useState('');
  const [adminExpandedGroups, setAdminExpandedGroups] = useState<Record<string, boolean>>({});
  const [processesLoading, setProcessesLoading] = useState(false);
  const [processesError, setProcessesError] = useState('');

  const resolveOrganizationScope = async () => {
    const { data, error } = await supabase
      .from('org_members')
      .select('org_id,role,organizations!inner(slug,name)')
      .eq('user_id', sanitizeDisplayValue(currentUser.id));

    if (error || !data || data.length === 0) {
      return { allowedOrgIds: new Set<string>(), hasGlobalScope: false, error };
    }

    const scopeRows = data as Array<{ org_id: string; role: string; organizations: { slug?: string; name?: string } | Array<{ slug?: string; name?: string }> }>;
    const allowedOrgIds = new Set(scopeRows.map((row) => row.org_id));

    const DEFAULT_ORGANIZATION_NAME_KEYWORDS = ['central', 'default', 'padr', 'todas'];
    const normalizeText = (value: string) =>
      value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const isDefaultOrganizationName = (name: string | undefined | null) => {
      if (!name) return false;
      const normalized = normalizeText(name);
      return DEFAULT_ORGANIZATION_NAME_KEYWORDS.some((keyword) => normalized.includes(keyword));
    };

    const hasGlobalScope = scopeRows.some((row) => {
      const normalizedRole = sanitizeDisplayValue(row.role).toLowerCase();
      if (!['owner', 'admin'].includes(normalizedRole)) return false;

      const organizationsValue = row.organizations;
      const firstOrg = Array.isArray(organizationsValue) ? organizationsValue[0] : organizationsValue;
      const orgSlug = sanitizeDisplayValue(firstOrg?.slug).toLowerCase();
      const orgName = sanitizeDisplayValue(firstOrg?.name);

      return orgSlug === 'default' || isDefaultOrganizationName(orgName);
    });

    return { allowedOrgIds, hasGlobalScope, error: null };
  };

  const resetNewProcessForm = () => {
    setNewProcessForm({
      organizationId: '',
      title: '',
      clientName: '',
      clientDocument: '',
      clientContact: '',
      serviceUnit: null,
      selectedServiceIds: [],
      osValue: undefined,
      donation: 0,
    });
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

  useEffect(() => {
    if (currentSection !== 'processos') {
      setActiveProcessQuickPreset(null);
      setProcessStatusPreset('all');
      return;
    }

    const detectedPreset = parseProcessQuickPresetFromSearch(locationSearch);
    if (!detectedPreset) {
      setActiveProcessQuickPreset(null);
      setProcessStatusPreset('all');
      return;
    }

    setActiveProcessQuickPreset(detectedPreset);
    applyProcessQuickPreset(detectedPreset);
  }, [currentSection, locationSearch]);

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

  const isWithinPeriod = (registrationDate: string, period: 'all' | 'today' | '7d' | '30d') => {
    if (period === 'all') return true;

    const parsedDate = new Date(registrationDate);
    if (Number.isNaN(parsedDate.getTime())) return true;

    const now = new Date();
    const diffMs = now.getTime() - parsedDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (period === 'today') return diffDays <= 1;
    if (period === '7d') return diffDays <= 7;
    return diffDays <= 30;
  };

  const processResponsibles = Array.from(new Set(baseProcessRows.map((row) => row.serviceManager || 'Não definido')));

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

  const handleCreateProcess = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedOrganization = organizations.find((organization) => organization.id === newProcessForm.organizationId);

    if (!selectedOrganization) {
      showToast({ type: 'error', message: 'Selecione uma organização válida para criar o processo.' });
      return;
    }

    const { allowedOrgIds, hasGlobalScope, error: scopeError } = await resolveOrganizationScope();
    if (scopeError) {
      showToast({ type: 'error', message: 'Não foi possível validar o escopo da organização.' });
      return;
    }
    if (!hasGlobalScope && !allowedOrgIds.has(selectedOrganization.id)) {
      showToast({ type: 'error', message: 'Você não possui permissão para criar processo nesta organização.' });
      return;
    }

    if (!sanitizeDisplayValue(newProcessForm.clientName)) {
      showToast({ type: 'error', message: 'Informe o nome do cliente para criar o processo.' });
      return;
    }

    setCreatingProcess(true);

    const processTitle =
      sanitizeDisplayValue(newProcessForm.title) ||
      `Processo manual - ${sanitizeDisplayValue(newProcessForm.clientName)}`;

    const selectedServiceIds = newProcessForm.selectedServiceIds ?? [];
    const servicesSelected = selectedServiceIds.length > 0
      ? selectedServiceIds.map((id: string) => {
          const svc = adminCatalog.find((s) => s.id === id);
          return svc ? { id: svc.id, name: svc.name, price: svc.price, group: svc.group } : null;
        }).filter(Boolean)
      : null;

    const servicesTotal = (servicesSelected ?? []).reduce((sum: number, s: any) => sum + (s?.price ?? 0), 0);
    const hasOsValue = typeof newProcessForm.osValue === 'number' && newProcessForm.osValue > 0;
    const associationFees = servicesSelected && servicesSelected.length > 0 ? calcAssociationFees(servicesTotal) : [];
    const doacaoFee = newProcessForm.donation > 0 ? { type: 'doacao' as const, name: 'Doação Voluntária', price: newProcessForm.donation, destination: 'association' as const } : null;
    const allFees = doacaoFee ? [...(associationFees ?? []), doacaoFee] : associationFees;
    const totalOsValue = hasOsValue ? newProcessForm.osValue! : (servicesTotal + newProcessForm.donation);

    const processPayload: Record<string, unknown> = {
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
      os_value: totalOsValue > 0 ? totalOsValue : null,
    };
    if (isClientScope) {
      processPayload.cliente_user_id = currentUser.id;
    }

    const { data: createdProcess, error: processInsertError } = await supabase
      .from('processes')
      .insert(processPayload)
      .select(PROCESS_SELECT_BASE_COLUMNS)
      .single();

    if (processInsertError || !createdProcess) {
      setCreatingProcess(false);
      showToast({ type: 'error', message: `Não foi possível criar o processo: ${processInsertError?.message || processInsertError?.details || 'erro desconhecido'}` });
      return;
    }

    let processToAdd = createdProcess;
    if (hasOsValue || servicesSelected || allFees.length > 0) {
      const updates: Record<string, unknown> = {};
      if (hasOsValue) updates.process_status = 'aguardando_pagamento';
      if (servicesSelected) updates.services_selected = servicesSelected;
      if (allFees.length > 0) updates.association_fees = allFees;
      const { data: updatedProcess } = await supabase
        .from('processes')
        .update(updates)
        .eq('id', createdProcess.id)
        .select(PROCESS_SELECT_BASE_COLUMNS)
        .single();
      if (updatedProcess) {
        processToAdd = updatedProcess;
      }
    }

    await supabase.from('process_events').insert({
      org_id: selectedOrganization.id,
      process_id: createdProcess.id,
      tipo: 'registro',
      mensagem: `Processo criado manualmente pelo painel administrativo para ${sanitizeDisplayValue(newProcessForm.clientName)}.`,
      created_by: currentUser.id,
    });

    setDbProcesses((prev) => [normalizeProcessOptionalFields(processToAdd as DbProcess), ...prev]);
    showToast({ type: 'success', message: 'Processo criado com sucesso e adicionado à lista.' });
    setCreatingProcess(false);
    setShowCreateProcessModal(false);
    resetNewProcessForm();
  };

  const handleDeleteProcess = async (process: AdminProcessRow) => {
    const processId = sanitizeDisplayValue(process.processRecordId || process.id);
    if (!processId) return;

    const confirmed = window.confirm(`Deseja realmente excluir o processo ${process.protocol}? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;

    setProcessesLoading(true);

    const { error: deleteEventsError } = await supabase
      .from('process_events')
      .delete()
      .eq('process_id', processId);

    if (deleteEventsError) {
      setProcessesLoading(false);
      showToast({ type: 'error', message: 'Não foi possível excluir os eventos do processo.' });
      return;
    }

    const { error: deleteProcessError } = await supabase
      .from('processes')
      .delete()
      .eq('id', processId);

    if (deleteProcessError) {
      setProcessesLoading(false);
      showToast({ type: 'error', message: 'Não foi possível excluir o processo selecionado.' });
      return;
    }

    setDbProcesses((previous) => previous.filter((row) => row.id !== processId));
    if (editingUser && sanitizeDisplayValue((editingUser as AdminProcessRow).processRecordId || editingUser.id) === processId) {
      setEditingUser(null);
    }
    if (selectedUser && sanitizeDisplayValue((selectedUser as AdminProcessRow).processRecordId || selectedUser.id) === processId) {
      setSelectedUser(null);
    }

    setProcessesLoading(false);
    showToast({ type: 'success', message: `Processo ${process.protocol} excluído com sucesso.` });
  };

  return (
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
                  setShowCreateProcessModal(true);
                }}
                className="inline-flex items-center gap-2 shrink-0 px-4 py-2 rounded-lg border border-blue-100 bg-blue-50 text-blue-600 font-semibold hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-4 h-4" /> Novo processo
              </button>
            )}
          </div>
          <p className="text-gray-500 text-sm mb-4">Visão geral em formato de planilha para filtrar, acompanhar status e agir rápido.</p>
          {sectionReadOnly && (
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
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center">
                <SearchX className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-500">Nenhum resultado encontrado</p>
                <p className="text-xs text-gray-400 mt-1">Tente ajustar os filtros ou o termo da busca.</p>
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
                      {!isClientScope && (
                        <button
                          onClick={() => setEditingUser(process)}
                          className="p-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg text-white"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {!isClientScope && (
                        <button
                          onClick={() => void handleDeleteProcess(process)}
                          className="p-2 bg-red-500 hover:bg-red-600 rounded-lg text-white"
                          title="Excluir processo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
                        {(() => {
                          const paymentUi = getPaymentStatusUi(process.paymentStatus);
                          return paymentUi ? (
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${paymentUi.color} text-white text-xs px-2.5 py-1`}>
                              {paymentUi.label}
                            </span>
                          ) : (
                            <Badge variant="warning" className="text-xs px-2.5 py-1">{process.financeiro}</Badge>
                          );
                        })()}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Prioridade & Valor</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="success" className="text-xs px-2.5 py-1">{process.prioridade}</Badge>
                        <span className="text-gray-800 font-black">{formatEuro(process.valor)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Card>
      </div>

      {canCreateProcess && showCreateProcessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-3xl rounded-3xl border border-gray-100 shadow-2xl overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-black uppercase">Criar processo manual</h3>
              <button
                onClick={() => {
                  setShowCreateProcessModal(false);
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
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">
                      Título do processo
                      <span className={`ml-2 text-[10px] font-normal ${newProcessForm.title.length >= 90 ? 'text-red-500' : 'text-gray-400'}`}>
                        {newProcessForm.title.length}/100
                      </span>
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      value={newProcessForm.title}
                      onChange={(event) => setNewProcessForm((prev) => ({ ...prev, title: event.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex.: Abertura de acompanhamento administrativo"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">
                      Cliente
                      <span className={`ml-2 text-[10px] font-normal ${newProcessForm.clientName.length >= 90 ? 'text-red-500' : 'text-gray-400'}`}>
                        {newProcessForm.clientName.length}/100
                      </span>
                    </label>
                    <input
                      type="text"
                      maxLength={100}
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
                      onChange={(event) => {
                        const unit = event.target.value as ServiceUnit;
                        setNewProcessForm((prev) => ({
                          ...prev,
                          serviceUnit: unit,
                          selectedServiceIds: [],
                          osValue: undefined,
                        }));
                        setAdminServiceSearch('');
                        setAdminExpandedGroups({});
                      }}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione o tipo...</option>
                      <option value={ServiceUnit.ADMINISTRATIVO}>Administrativo</option>
                      <option value={ServiceUnit.JURIDICO}>Jurídico / Advocacia</option>
                      <option value={ServiceUnit.TECNOLOGICO}>Tecnológico / AI</option>
                    </select>
                  </div>

                  {newProcessForm.serviceUnit && (
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Serviços <span className="font-normal normal-case text-gray-400">(selecione abaixo o serviço a contratar)</span></label>
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={adminServiceSearch}
                          onChange={(e) => setAdminServiceSearch(e.target.value)}
                          placeholder="Pesquisar serviço..."
                          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm font-bold placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {filterGroupsByUnit(adminCatalog, newProcessForm.serviceUnit).map((group) => {
                          const services = filterServicesByGroup(adminCatalog, newProcessForm.serviceUnit, group);
                          const filtered = adminServiceSearch
                            ? services.filter((s) => s.name.toLowerCase().includes(adminServiceSearch.toLowerCase()))
                            : services;
                          if (filtered.length === 0) return null;
                          const isCollapsed = !adminExpandedGroups[group];
                          return (
                            <div key={group} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setAdminExpandedGroups((prev) => {
                                  if (prev[group]) { const { [group]: _, ...rest } = prev; return rest; }
                                  return { ...prev, [group]: true };
                                })}
                                className="flex items-center justify-between w-full px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
                              >
                                {group}
                                <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                              </button>
                              {!isCollapsed && (
                                <div className="px-3 pb-3 space-y-2">
                                  {filtered.map((svc) => {
                                    const selected = (newProcessForm.selectedServiceIds ?? []).includes(svc.id);
                                    return (
                                      <label
                                        key={svc.id}
                                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors border ${
                                          selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={() => {
                                              setNewProcessForm((prev) => {
                                                const ids = prev.selectedServiceIds ?? [];
                                                const next = selected ? ids.filter((i: string) => i !== svc.id) : [...ids, svc.id];
                                                const svcTotal = next.reduce((sum: number, id: string) => {
                                                  const s = filterServicesByUnit(adminCatalog, prev.serviceUnit!).find((x) => x.id === id);
                                                  return sum + (s?.price ?? 0);
                                                }, 0);
                                                return { ...prev, selectedServiceIds: next, osValue: svcTotal > 0 ? svcTotal : undefined };
                                              });
                                            }}
                                            className="w-4 h-4 accent-blue-600"
                                          />
                                          <div>
                                            <p className="text-sm font-bold text-gray-800">{svc.name}</p>
                                            <p className="text-xs text-gray-500">{svc.description}</p>
                                          </div>
                                        </div>
                                        <span className="text-sm font-black text-emerald-600">{formatEuro(svc.price)}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {newProcessForm.serviceUnit && (newProcessForm.selectedServiceIds ?? []).length > 0 && (
                    <div className="md:col-span-2 space-y-3">
                      <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Serviços Selecionados</label>
                        <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                          {(newProcessForm.selectedServiceIds ?? []).map((id: string) => {
                            const servicesList = filterServicesByUnit(adminCatalog, newProcessForm.serviceUnit!);
                            const svc = servicesList.find((s) => s.id === id);
                            if (!svc) return null;
                            return (
                              <div key={id} className="flex items-center justify-between px-4 py-3 bg-white">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-gray-800 truncate">{svc.name}</p>
                                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{svc.group}</p>
                                </div>
                                <span className="text-sm font-black text-emerald-600 ml-3">{formatEuro(svc.price)}</span>
                              </div>
                            );
                          })}
                          <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                            <p className="text-sm font-black text-gray-700 uppercase">Subtotal Serviços</p>
                            <span className="text-base font-black text-emerald-700">
                              {formatEuro((newProcessForm.selectedServiceIds ?? []).reduce((sum: number, id: string) => {
                                const servicesList = filterServicesByUnit(adminCatalog, newProcessForm.serviceUnit!);
                                const s = servicesList.find((x) => x.id === id);
                                return sum + (s?.price ?? 0);
                              }, 0))}
                            </span>
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const svcTotal = (newProcessForm.selectedServiceIds ?? []).reduce((sum: number, id: string) => {
                          const servicesList = filterServicesByUnit(adminCatalog, newProcessForm.serviceUnit!);
                          const s = servicesList.find((x) => x.id === id);
                          return sum + (s?.price ?? 0);
                        }, 0);
                        const fees = calcAssociationFees(svcTotal);
                        const doacaoFee = newProcessForm.donation > 0 ? { type: 'doacao' as const, name: 'Doação Voluntária', price: newProcessForm.donation, destination: 'association' as const } : null;
                        const allFees = doacaoFee ? [...fees, doacaoFee] : fees;
                        const convenioTotal = fees.reduce((s, f) => s + f.price, 0);
                        const profissionalNet = svcTotal - convenioTotal;
                        if (!allFees.length) return null;
                        return (
                          <div>
                            <label className="text-[10px] font-black text-amber-700 uppercase block mb-2">Taxas Associativas</label>
                            <div className="divide-y divide-amber-100 border border-amber-200 rounded-xl overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-3 bg-blue-50">
                                <p className="text-sm font-bold text-blue-800">Valor Bruto dos Serviços</p>
                                <span className="text-sm font-black text-blue-800">{formatEuro(svcTotal)}</span>
                              </div>
                              {fees.map((fee) => (
                                <div key={fee.type} className="flex items-center justify-between px-4 py-3 bg-amber-50">
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
                                <span className="text-base font-black text-amber-900">{formatEuro(svcTotal + newProcessForm.donation)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Valor da OS (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProcessForm.osValue ?? ''}
                      onChange={(event) => setNewProcessForm((prev) => ({ ...prev, osValue: event.target.value ? Number(event.target.value) : undefined }))}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                    {newProcessForm.serviceUnit && (newProcessForm.selectedServiceIds ?? []).length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">Valor calculado com base nos serviços selecionados.</p>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-purple-600 uppercase block mb-2">Doação Voluntária (€) <span className="text-[10px] font-normal text-gray-400">— valor extra para associação</span></label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProcessForm.donation || ''}
                      onChange={(event) => setNewProcessForm((prev) => ({ ...prev, donation: event.target.value ? Number(event.target.value) : 0 }))}
                      className="w-full bg-purple-50 border border-purple-200 rounded-xl p-4 text-purple-800 font-semibold outline-none focus:ring-2 focus:ring-purple-500"
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
    </ProcessesContainer>
  );
};

export default ProcessesSection;
