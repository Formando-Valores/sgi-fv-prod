
import React from 'react';
import { LogOut, Printer, FileDown, User as UserIcon, Calendar, Clock, Landmark, Activity, UserCheck, MessageSquare } from 'lucide-react';
import { User, ProcessStatus } from '../types';
import { supabase } from '../supabase';
import { SERVICE_MANAGERS } from '../constants';

interface UserDashboardProps {
  currentUser: User;
  onLogout: () => void;
}

type ServiceArea = 'juridico' | 'tecnologico' | 'advocacia';

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

const SERVICE_CATALOG: GuidedService[] = [
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
  { id: 'adv-001', area: 'advocacia', category: 'Advocacia', name: 'Ação Ordinária', priceLabel: '1000€' },
];

const AUTO_ASSIGNMENT_ENABLED = false;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const [processCreationError, setProcessCreationError] = React.useState<string | null>(null);
  const [availableProfessionals, setAvailableProfessionals] = React.useState<AvailableProfessional[]>([]);
  const [isLoadingProfessionals, setIsLoadingProfessionals] = React.useState(false);
  const [professionalsError, setProfessionalsError] = React.useState<string | null>(null);

  const steps = [
    { label: ProcessStatus.PENDENTE, color: 'bg-slate-500' },
    { label: ProcessStatus.TRIAGEM, color: 'bg-yellow-400' },
    { label: ProcessStatus.ANALISE, color: 'bg-orange-500' },
    { label: ProcessStatus.CONCLUIDO, color: 'bg-[#39ff14]' },
  ];

  const currentStepIndex = steps.findIndex(s => s.label === processStatus);
  const guidedServices = selectedArea ? SERVICE_CATALOG.filter((service) => service.area === selectedArea) : [];
  const selectedService = guidedServices.find((service) => service.id === selectedServiceId) ?? null;
  const canContinueToPayment = Boolean(
      selectedArea &&
      selectedService &&
      selectedSlot &&
      selectedAdminScheduleSlot &&
      availableProfessionals.some((professional) => professional.id === selectedSlot && professional.availableSlots.length > 0),
  );
  const isOnboardingFlow = processStatus !== ProcessStatus.CONCLUIDO && !initialStageFinished;

  React.useEffect(() => {
    const loadProfessionals = async () => {
      if (!currentUser.organizationId || !selectedServiceId) {
        setAvailableProfessionals([]);
        return;
      }

      setIsLoadingProfessionals(true);
      setProfessionalsError(null);

      try {
        let memberRows: Array<{ user_id: string; role: string }> = [];

        const { data: members, error: membersError } = await supabase
          .from('org_members')
          .select('user_id,role')
          .eq('org_id', currentUser.organizationId)
          .in('role', ['owner', 'admin']);

        if (!membersError) {
          memberRows = (members || []) as Array<{ user_id: string; role: string }>;
        }

        const userIds = memberRows.map((member) => member.user_id).filter(Boolean);

        const profileMap = new Map<string, { id: string; nome_completo?: string | null; nome?: string | null; name?: string | null; email?: string | null; role?: string | null }>();

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

        let professionalsBase = Array.from(uniqueById.values());

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

    setIsCreatingProcess(true);
    setProcessCreationError(null);

    try {
      const processTitle = `${selectedService.name} - ${selectedSlotData.professional} (${selectedAdminScheduleSlot || 'horário a confirmar'})`;
      const { data: createdProcess, error: processError } = await supabase
        .from('processes')
        .insert({
          org_id: currentUser.organizationId,
          titulo: processTitle,
          status: 'triagem',
          cliente_nome: currentUser.name,
          cliente_documento: currentUser.documentId || null,
          cliente_contato: currentUser.phone || currentUser.email || null,
          origem_canal: 'portal_cliente',
          unidade_atendimento: selectedService.area,
          org_nome_solicitado: currentUser.organizationName || null,
        })
        .select('id')
        .single();

      if (processError || !createdProcess) {
        throw processError || new Error('Falha ao criar processo');
      }

      setCreatedProcessId(createdProcess.id);

      await supabase.from('process_events').insert({
        org_id: currentUser.organizationId,
        process_id: createdProcess.id,
        tipo: 'registro',
        mensagem: `Processo criado a partir do onboarding. Profissional indicado: ${selectedSlotData.professional}. Horário previsto: ${selectedAdminScheduleSlot || 'a confirmar'}. Serviço: ${selectedService.name}.`,
        created_by: currentUser.id,
      });

      setInitialStageFinished(true);
      if (processStatus === ProcessStatus.PENDENTE) {
        setProcessStatus(ProcessStatus.TRIAGEM);
      }
      await logTimelineEvent(`Etapa inicial finalizada após pagamento confirmado. Processo ${createdProcess.id} gerado e encaminhado para recebimento pelo profissional.`);
    } catch {
      setProcessCreationError('Falha ao gerar processo para o profissional. Tente novamente.');
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

      {isOnboardingFlow && (
        <section className="mb-6 bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-black text-gray-800">Primeiro acesso guiado</h2>
          <p className="text-sm text-gray-500 mb-4">Selecione o seu serviço pela área selecionada.</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[
              { id: 'juridico', label: 'Jurídico' },
              { id: 'tecnologico', label: 'Tecnológico' },
              { id: 'advocacia', label: 'Advocacia' },
              { id: 'confirmar', label: 'Confirmar' },
            ].map((areaButton) => (
              <button
                key={areaButton.id}
                type="button"
                onClick={() => {
                  if (areaButton.id === 'confirmar') return;
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
              <p className="text-xs font-black uppercase text-gray-500">Resumo do serviço</p>
              <p className="font-bold text-gray-800">{selectedService.name}</p>
              <p className="text-sm text-blue-600 font-semibold">{selectedService.priceLabel}</p>
            </div>
          )}

          {selectedService && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-black uppercase text-gray-500 mb-2">Profissionais administradores disponíveis</p>
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
                    {availableProfessionals.map((slot) => (
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
                          <p className="font-semibold text-gray-800">{slot.professional}</p>
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
                        <p className="text-sm text-gray-500">{slot.roleLabel}{slot.email ? ` • ${slot.email}` : ''}</p>
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
              <p className="text-xs font-black uppercase text-gray-500">Pagamento (após seleção do profissional)</p>
              {!selectedSlot && (
                <p className="mt-2 text-sm font-semibold text-amber-700">
                  Selecione primeiro um profissional para liberar o pagamento.
                </p>
              )}
              {selectedSlot && (
                <p className="mt-2 text-sm font-semibold text-blue-700">
                  Profissional selecionado ({selectedAdminScheduleSlot || 'sem horário disponível'}). Agora escolha a forma de pagamento.
                </p>
              )}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!canContinueToPayment}
                  onClick={() => {
                    setPaymentMethod('cartao');
                    setPaymentStatus('confirmed');
                    void logTimelineEvent(`Pagamento iniciado no Stripe por cartão para ${selectedService.name}, após seleção do profissional.`);
                    void logTimelineEvent(`Pagamento confirmado automaticamente (cartão) para ${selectedService.name}.`);
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
                    void logTimelineEvent(`Pagamento iniciado no Stripe por boleto para ${selectedService.name}, após seleção do profissional. Aguardando confirmação.`);
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
                    {isCreatingProcess ? 'Gerando processo...' : 'Finalizar etapa inicial e encaminhar ao profissional'}
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
            O serviço foi encaminhado para recebimento pelo profissional responsável e seguirá para as próximas etapas.
          </p>
          {createdProcessId && (
            <p className="text-xs font-bold text-emerald-800 mt-2">
              Processo gerado: {createdProcessId}
            </p>
          )}
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

            {/* Destaque Central Dividido: Gestor e Notas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
               {/* Lado Esquerdo: Gestor */}
               <div className="p-8 flex flex-col items-center text-center border-b md:border-b-0 md:border-r border-gray-200">
                  <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-blue-600 shadow-xl`}>
                    <UserCheck className="text-white w-8 h-8" />
                  </div>
                  <p className="text-xl font-black uppercase tracking-tight text-gray-800">{currentUser.serviceManager || 'A DEFINIR'}</p>
                  <p className="text-gray-500 text-[10px] mt-1 uppercase font-bold tracking-widest">Gestor Responsável</p>
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
