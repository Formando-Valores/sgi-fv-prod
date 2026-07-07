import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, FolderKanban, X, AlertCircle, Loader2, Lock, ChevronDown, Upload, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { can } from '../../lib/permissions';
import {
  listProcesses,
  listAdminOperationalProcesses,
  createProcess,
  type Process,
  type CreateProcessPayload
} from '../../lib/processes';
import {
  PAYMENT_STATUS_BADGES,
  PROCESS_STATUS_BADGES,
  getOperationalStatus,
} from '../../lib/paymentStatus';
import { CUSTOM_ANALYSIS_FEE, calcAssociationFees, type AssociationFeeItem, formatEuro } from '../../lib/servicesCatalog';
import { loadServicesCatalog, filterServicesByUnit, filterGroupsByUnit, filterServicesByGroup, type DbCatalogService } from '../../lib/servicesCatalogDb';
import { uploadPaymentProof } from '../../lib/paymentProofs';
import type { ServiceUnit } from '../../../types';

const SERVICE_UNITS: { value: ServiceUnit; label: string }[] = [
  { value: 'ADMINISTRATIVO', label: 'Administrativo' },
  { value: 'JURÍDICO / ADVOCACIA', label: 'Jurídico / Advocacia' },
  { value: 'TECNOLÓGICO / AI', label: 'Tecnológico / AI' },
];

const ProcessList: React.FC = () => {
  const { userContext } = useAuth();
  const canViewAllProcesses = can('view_all', 'processos', userContext);
  const canCreateProcess = can('create', 'processos', userContext);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState<DbCatalogService[]>([]);

  useEffect(() => {
    loadServicesCatalog().then(setCatalog);
  }, []);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedUnit, setSelectedUnit] = useState<ServiceUnit | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [customMode, setCustomMode] = useState(false);
  const [customServiceName, setCustomServiceName] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [donation, setDonation] = useState(0);
  const [formData, setFormData] = useState<CreateProcessPayload>({
    titulo: '',
    cliente_nome: '',
    cliente_documento: '',
    cliente_contato: '',
    os_value: undefined,
    association_fees: undefined
  });
  const [formError, setFormError] = useState('');
  const [uploadingProofFor, setUploadingProofFor] = useState<string | null>(null);
  const [proofUploadFeedback, setProofUploadFeedback] = useState<{ processId: string; message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const availableServices = useMemo(() => {
    if (!selectedUnit) return [];
    return filterServicesByUnit(catalog, selectedUnit);
  }, [selectedUnit, catalog]);

  const totalValue = useMemo(() => {
    let total = 0;
    for (const id of selectedServiceIds) {
      const svc = availableServices.find((s) => s.id === id);
      if (svc) total += svc.price;
    }
    if (customMode && customServiceName.trim()) {
      total += CUSTOM_ANALYSIS_FEE;
    }
    return total;
  }, [availableServices, selectedServiceIds, customMode, customServiceName]);

  useEffect(() => {
    loadProcesses();
  }, [userContext?.org_id, canViewAllProcesses]);

  const loadProcesses = async () => {
    if (!userContext?.org_id) {
      console.warn('No org_id in userContext, skipping process load');
      setProcesses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = canViewAllProcesses
        ? await listAdminOperationalProcesses(userContext.org_id)
        : await listProcesses(userContext.org_id);
      setProcesses(data);
    } catch (err) {
      console.error('Error loading processes:', err);
      setError('Erro ao carregar processos. Verifique se as migrações foram executadas.');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStep(1);
    setSelectedUnit(null);
    setSelectedServiceIds([]);
    setCustomMode(false);
    setCustomServiceName('');
    setServiceSearch('');
    setExpandedGroups({});
    setFormData({ titulo: '', cliente_nome: '', cliente_documento: '', cliente_contato: '', os_value: undefined, association_fees: undefined });
    setFormError('');
    setShowModal(false);
  };

  const handleToggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    if (!selectedUnit) {
      setFormError('Selecione um tipo de serviço.');
      return;
    }
    if (selectedServiceIds.length === 0 && !customMode) {
      setFormError('Selecione ao menos um serviço ou informe um serviço customizado.');
      return;
    }
    if (customMode && !customServiceName.trim()) {
      setFormError('Informe o nome do serviço customizado.');
      return;
    }
    setFormData((prev) => {
      const servicesTotal = totalValue;
      const fees = servicesTotal > 0 ? calcAssociationFees(servicesTotal) : [];
      const doacao = donation > 0 ? { type: 'doacao' as const, name: 'Doação Voluntária', price: donation, destination: 'association' as const } : null;
      const allFees = doacao ? [...fees, doacao] : fees;
      return {
        ...prev,
        os_value: servicesTotal + donation > 0 ? servicesTotal + donation : undefined,
        association_fees: allFees.length > 0 ? allFees : undefined,
        unidade_atendimento: selectedUnit,
      };
    });
    setStep(2);
    setFormError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userContext?.org_id || !userContext?.id) return;

    if (!formData.titulo.trim()) {
      setFormError('Título é obrigatório');
      return;
    }

    setCreating(true);
    setFormError('');
    try {
      const isClient = !can('view_all', 'processos', userContext);
      const selectedServices = customMode && customServiceName.trim()
        ? [...availableServices.filter(s => selectedServiceIds.includes(s.id)), { id: 'custom', name: customServiceName.trim(), price: CUSTOM_ANALYSIS_FEE, group: 'Outros' }]
        : availableServices.filter(s => selectedServiceIds.includes(s.id));
      const servicesTotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
      const associationFees = selectedServices.length > 0 ? calcAssociationFees(servicesTotal) : [];
      const doacao = donation > 0 ? { type: 'doacao' as const, name: 'Doação Voluntária', price: donation, destination: 'association' as const } : null;
      const allFees = doacao ? [...associationFees, doacao] : associationFees;
      const payload = {
        ...formData,
        responsavel_user_id: isClient ? userContext.id : formData.responsavel_user_id,
        cliente_user_id: isClient ? userContext.id : undefined,
        services_selected: selectedServices,
        association_fees: allFees.length > 0 ? allFees : undefined,
        os_value: servicesTotal + donation > 0 ? servicesTotal + donation : undefined,
      };
      const newProcess = await createProcess(userContext.org_id, payload, userContext.id);
      resetModal();
      navigate(`/processos/${newProcess.id}`);
    } catch (err: any) {
      console.error('Error creating process:', err);
      const detail = err?.message || err?.details || err?.error_description || (typeof err === 'string' ? err : JSON.stringify(err));
      setFormError(`Erro ao criar processo: ${detail}`);
    } finally {
      setCreating(false);
    }
  };

  const filteredProcesses = processes.filter(
    (p) =>
      (p.protocolo?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (p.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (p.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatSource = (source?: string | null) => {
    if (!source) return 'Painel interno';
    const normalized = source.toLowerCase();
    if (normalized === 'wix') return 'Wix';
    return source;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <FolderKanban className="text-blue-500" /> Processos
          </h1>
          <p className="text-slate-400 text-sm font-bold mt-1">Gerenciamento de processos</p>
        </div>
        {canCreateProcess && (
          <button
            onClick={() => { resetModal(); setShowModal(true); }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2 transition-colors shadow-lg"
          >
            <Plus className="w-5 h-5" /> Novo Processo
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 text-slate-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Pesquisar por protocolo, título ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-slate-800 rounded-xl text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-900/30 border border-red-800 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-200 font-bold">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : filteredProcesses.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <FolderKanban className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-400 mb-2">
            {searchTerm ? 'Nenhum processo encontrado' : 'Nenhum processo cadastrado'}
          </h3>
          <p className="text-slate-500 text-sm">
            {searchTerm ? 'Tente uma busca diferente' : canCreateProcess ? 'Clique em "Novo Processo" para começar' : 'Aguarde a criação de processos'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                  <th className="px-3 sm:px-6 py-2 sm:py-4">Protocolo</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4">Título</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4">Cliente</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4">Status</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4">Origem</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4">Unidade</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4">Data</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredProcesses.map((process) => (
                  <tr key={process.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-3 sm:px-6 py-2 sm:py-4">
                      <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded-md text-[10px] font-black">{process.protocolo || '-'}</span>
                    </td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 font-bold text-slate-200">{process.titulo}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-slate-300">{process.cliente_nome || '-'}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4">
                      {process.payment_status && (
                        <span className={`mr-2 px-3 py-1 rounded-full text-[10px] font-black text-white ${PAYMENT_STATUS_BADGES[process.payment_status]?.color || 'bg-slate-600'}`}>
                          Pgto: {PAYMENT_STATUS_BADGES[process.payment_status]?.label || process.payment_status}
                        </span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${PROCESS_STATUS_BADGES[getOperationalStatus(process)]?.color || 'bg-slate-600'}`}>
                        {PROCESS_STATUS_BADGES[getOperationalStatus(process)]?.label || getOperationalStatus(process)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-slate-300 font-semibold">{formatSource(process.origem_canal)}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-slate-300">{process.unidade_atendimento || '-'}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-slate-400 font-bold">{formatDate(process.created_at)}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {process.process_status === 'aguardando_pagamento' && (process.payment_status == null || process.payment_status === 'pending' || process.payment_status === 'failed' || process.payment_status === 'rejected') && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide bg-amber-900/30 text-amber-300 border border-amber-700">
                            <Lock className="w-3 h-3" />
                            Aguardando pagamento
                          </span>
                        )}
                        {process.process_status === 'aguardando_pagamento' && (process.payment_status == null || process.payment_status === 'pending' || process.payment_status === 'failed' || process.payment_status === 'rejected') && (() => {
                          const uploadId = `proof-upload-${process.id}`;
                          return (
                            <>
                              <input type="file" id={uploadId} accept="image/*,application/pdf" className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setUploadingProofFor(process.id);
                                  const { error } = await uploadPaymentProof(process.id, userContext?.id || '', file);
                                  setUploadingProofFor(null);
                                  if (e.target) e.target.value = '';
                                  if (error) {
                                    setProofUploadFeedback({ processId: process.id, message: error, type: 'error' });
                                  } else {
                                    setProofUploadFeedback({ processId: process.id, message: 'Comprovante enviado! Aguardando validação.', type: 'success' });
                                    setProcesses((prev) => prev.map((p) => p.id === process.id ? { ...p, payment_status: 'pending_validation' as any } : p));
                                  }
                                  setTimeout(() => setProofUploadFeedback(null), 4000);
                                }}
                              />
                              <label htmlFor={uploadId} className={`p-2 bg-emerald-800 hover:bg-emerald-700 rounded-lg text-emerald-300 inline-flex cursor-pointer disabled:opacity-60 ${uploadingProofFor === process.id ? 'opacity-60 pointer-events-none' : ''}`} title="Enviar comprovante de pagamento">
                                {uploadingProofFor === process.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              </label>
                            </>
                          );
                        })()}
                        {process.payment_status === 'pending_validation' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide bg-amber-900/30 text-amber-300 border border-amber-700">
                            <Loader2 className="w-3 h-3 animate-spin" /> Validando
                          </span>
                        )}
                        {(process.payment_status === 'validated' || process.payment_status === 'accepted') && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide bg-emerald-900/30 text-emerald-300 border border-emerald-700">
                            <Check className="w-3 h-3" /> Pago
                          </span>
                        )}
                        {proofUploadFeedback && proofUploadFeedback.processId === process.id && (
                          <span className={`text-[10px] font-bold ${proofUploadFeedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{proofUploadFeedback.message}</span>
                        )}
                        <Link to={`/processos/${process.id}`} title={process.process_status === 'aguardando_pagamento' ? 'Visualização liberada. Edição bloqueada até confirmação do pagamento.' : 'Visualizar processo'} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 inline-flex">
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="block md:hidden space-y-2 p-3">
            {filteredProcesses.map((process) => (
              <div key={process.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="font-bold text-slate-100 text-sm truncate">{process.titulo}</p>
                    <span className="bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded-md text-[10px] font-black inline-block mt-1">{process.protocolo || '-'}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {process.payment_status && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black text-white ${PAYMENT_STATUS_BADGES[process.payment_status]?.color || 'bg-slate-600'}`}>
                        {PAYMENT_STATUS_BADGES[process.payment_status]?.label || process.payment_status}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black text-white ${PROCESS_STATUS_BADGES[getOperationalStatus(process)]?.color || 'bg-slate-600'}`}>
                      {PROCESS_STATUS_BADGES[getOperationalStatus(process)]?.label || getOperationalStatus(process)}
                    </span>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-slate-400">
                  <p><span className="font-semibold text-slate-500">Cliente:</span> {process.cliente_nome || '-'}</p>
                  <p><span className="font-semibold text-slate-500">Origem:</span> {formatSource(process.origem_canal)}</p>
                  <p><span className="font-semibold text-slate-500">Unidade:</span> {process.unidade_atendimento || '-'}</p>
                  <p><span className="font-semibold text-slate-500">Data:</span> {formatDate(process.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700">
                  {process.process_status === 'aguardando_pagamento' && (process.payment_status == null || process.payment_status === 'pending' || process.payment_status === 'failed' || process.payment_status === 'rejected') && (() => {
                    const uploadId = `proof-upload-mobile-${process.id}`;
                    return (
                      <>
                        <input type="file" id={uploadId} accept="image/*,application/pdf" className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingProofFor(process.id);
                            const { error } = await uploadPaymentProof(process.id, userContext?.id || '', file);
                            setUploadingProofFor(null);
                            if (e.target) e.target.value = '';
                            if (error) {
                              setProofUploadFeedback({ processId: process.id, message: error, type: 'error' });
                            } else {
                              setProofUploadFeedback({ processId: process.id, message: 'Comprovante enviado!', type: 'success' });
                              setProcesses((prev) => prev.map((p) => p.id === process.id ? { ...p, payment_status: 'pending_validation' as any } : p));
                            }
                            setTimeout(() => setProofUploadFeedback(null), 4000);
                          }}
                        />
                        <label htmlFor={uploadId} className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-emerald-800 hover:bg-emerald-700 rounded-lg text-emerald-300 text-[10px] font-black uppercase tracking-wide cursor-pointer ${uploadingProofFor === process.id ? 'opacity-60 pointer-events-none' : ''}`}>
                          {uploadingProofFor === process.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          Comprovante
                        </label>
                      </>
                    );
                  })()}
                  {process.payment_status === 'pending_validation' && (
                    <span className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide bg-amber-900/30 text-amber-300 border border-amber-700">
                      <Loader2 className="w-3 h-3 animate-spin" /> Validando
                    </span>
                  )}
                  {(process.payment_status === 'validated' || process.payment_status === 'accepted') && (
                    <span className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide bg-emerald-900/30 text-emerald-300 border border-emerald-700">
                      <Check className="w-3 h-3" /> Pago
                    </span>
                  )}
                  <Link to={`/processos/${process.id}`} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-[10px] font-black uppercase tracking-wide">
                    <Eye className="w-3 h-3" /> Ver
                  </Link>
                </div>
                {proofUploadFeedback && proofUploadFeedback.processId === process.id && (
                  <p className={`mt-2 text-[10px] font-bold text-center ${proofUploadFeedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{proofUploadFeedback.message}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto animate-scaleIn">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">{step === 1 ? 'Novo Processo - Serviços' : 'Novo Processo - Dados'}</h2>
              <button onClick={resetModal} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {step === 1 ? (
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Tipo de Serviço *</label>
                  <select
                    value={selectedUnit ?? ''}
                    onChange={(e) => {
                      setSelectedUnit(e.target.value as ServiceUnit || null);
                      setSelectedServiceIds([]);
                      setCustomMode(false);
                      setCustomServiceName('');
                      setServiceSearch('');
                      setExpandedGroups({});
                    }}
                    className="w-full px-4 py-3 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Selecione o tipo...</option>
                    {SERVICE_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>

                {selectedUnit && availableServices.length > 0 && (
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">Serviços Disponíveis</label>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        placeholder="Pesquisar serviço..."
                        className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-slate-700 rounded-xl text-white text-sm font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {filterGroupsByUnit(catalog, selectedUnit).map((group) => {
                        const services = filterServicesByGroup(catalog, selectedUnit, group);
                        const filtered = serviceSearch
                          ? services.filter((s) => s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                          : services;
                        if (filtered.length === 0) return null;
                        const isCollapsed = !expandedGroups[group];
                        return (
                          <div key={group} className="bg-gray-900 border border-slate-800 rounded-xl overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedGroups((prev) => {
                                if (prev[group]) { const { [group]: _, ...rest } = prev; return rest; }
                                return { ...prev, [group]: true };
                              })}
                              className="flex items-center justify-between w-full px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
                            >
                              {group}
                              <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                            </button>
                            {!isCollapsed && (
                              <div className="px-3 pb-3 space-y-2">
                                {filtered.map((svc) => (
                                  <label
                                    key={svc.id}
                                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                                      selectedServiceIds.includes(svc.id)
                                        ? 'bg-blue-900/40 border border-blue-700'
                                        : 'bg-gray-800 border border-slate-700 hover:border-slate-600'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        checked={selectedServiceIds.includes(svc.id)}
                                        onChange={() => handleToggleService(svc.id)}
                                        className="w-4 h-4 accent-blue-500"
                                      />
                                      <div>
                                        <p className="text-sm font-bold text-slate-200">{svc.name}</p>
                                        <p className="text-xs text-slate-500">{svc.description}</p>
                                      </div>
                                    </div>
                                    <span className="text-sm font-black text-emerald-400">
                                      {formatEuro(svc.price)}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customMode}
                      onChange={() => {
                        setCustomMode(!customMode);
                        if (!customMode) setCustomServiceName('');
                      }}
                      className="w-4 h-4 accent-blue-500"
                    />
                    <span className="text-sm font-bold text-slate-300">Não encontrei meu serviço na lista</span>
                  </label>
                  {customMode && (
                    <div className="mt-2 p-3 bg-amber-900/20 border border-amber-700 rounded-xl">
                      <p className="text-xs text-amber-300 mb-2 font-bold">
                        Informe o serviço desejado. Uma taxa de análise de <span className="text-white">{formatEuro(CUSTOM_ANALYSIS_FEE)}</span> será aplicada.
                        O valor real será apresentado em um novo processo após a análise.
                      </p>
                      <input
                        type="text"
                        value={customServiceName}
                        onChange={(e) => setCustomServiceName(e.target.value)}
                        placeholder="Descreva o serviço desejado..."
                        className="w-full px-4 py-3 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      />
                    </div>
                  )}
                </div>

                {totalValue > 0 && (
                  <div className="p-4 bg-slate-800 rounded-xl text-right">
                    <p className="text-xs text-slate-400 font-bold">VALOR TOTAL</p>
                    <p className="text-2xl font-black text-emerald-400">{formatEuro(totalValue)}</p>
                  </div>
                )}

                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <p className="text-red-200 text-sm font-bold">{formError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetModal}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleContinue}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">
                    Título *
                    <span className={`ml-2 text-[10px] font-normal ${formData.titulo.length >= 90 ? 'text-red-400' : 'text-slate-500'}`}>
                      {formData.titulo.length}/100
                    </span>
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Título do processo"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">
                    Nome do Cliente
                    <span className={`ml-2 text-[10px] font-normal ${formData.cliente_nome.length >= 90 ? 'text-red-400' : 'text-slate-500'}`}>
                      {formData.cliente_nome.length}/100
                    </span>
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={formData.cliente_nome}
                    onChange={(e) => setFormData({ ...formData, cliente_nome: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Documento (CPF/CNPJ)</label>
                  <input
                    type="text"
                    value={formData.cliente_documento}
                    onChange={(e) => setFormData({ ...formData, cliente_documento: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Valor da OS (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.os_value ?? ''}
                    onChange={(e) => setFormData({ ...formData, os_value: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full px-4 py-3 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0,00"
                    readOnly
                  />
                  <p className="text-xs text-slate-500 mt-1">Valor calculado com base nos serviços selecionados. Pode ser ajustado manualmente.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Doação Voluntária (€) <span className="text-xs text-slate-500 font-normal">— valor extra para a associação</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={donation || ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : 0;
                      setDonation(val);
                      // Recalculate os_value and fees when donation changes
                      setFormData((prev) => {
                        const servicesTotal = totalValue;
                        const fees = servicesTotal > 0 ? calcAssociationFees(servicesTotal) : [];
                        const doacao = val > 0 ? { type: 'doacao' as const, name: 'Doação Voluntária', price: val, destination: 'association' as const } : null;
                        const allFees = doacao ? [...fees, doacao] : fees;
                        return {
                          ...prev,
                          os_value: servicesTotal + val > 0 ? servicesTotal + val : undefined,
                          association_fees: allFees.length > 0 ? allFees : undefined,
                        };
                      });
                    }}
                    className="w-full px-4 py-3 bg-purple-950/30 border border-purple-700/50 rounded-xl text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Contato</label>
                  <input
                    type="text"
                    value={formData.cliente_contato}
                    onChange={(e) => setFormData({ ...formData, cliente_contato: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Telefone ou email"
                  />
                </div>

                {selectedUnit && (
                  <div className="p-3 bg-slate-800 rounded-xl">
                    <p className="text-xs text-slate-400 font-bold">Tipo: {SERVICE_UNITS.find(u => u.value === selectedUnit)?.label}</p>
                    <p className="text-lg font-black text-emerald-400 mt-1">{formatEuro(formData.os_value ?? 0)}</p>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs text-blue-400 hover:text-blue-300 font-bold mt-1"
                    >
                      Alterar serviços
                    </button>
                  </div>
                )}

                {formData.association_fees && formData.association_fees.length > 0 && (() => {
                  const allFees = formData.association_fees!;
                  const feesTotal = allFees.reduce((s, f) => s + f.price, 0);
                  const svcTotal = formData.os_value ?? 0;
                  const servicosTotal = svcTotal - (allFees.find(f => f.type === 'doacao')?.price ?? 0);
                  const convenioFees = allFees.filter(f => f.type === 'convenio');
                  const doacaoFee = allFees.find(f => f.type === 'doacao');
                  const convenioTotal = convenioFees.reduce((s, f) => s + f.price, 0);
                  const profissionalNet = servicosTotal - convenioTotal;
                  return (
                    <div>
                      <label className="text-[10px] font-black text-amber-400 uppercase block mb-2">Taxas Associativas</label>
                      <div className="divide-y divide-amber-800/50 border border-amber-700/50 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/40">
                          <p className="text-sm font-bold text-slate-200">Valor Bruto dos Serviços</p>
                          <span className="text-sm font-black text-white">{formatEuro(servicosTotal)}</span>
                        </div>
                        {convenioFees.map((fee) => (
                          <div key={fee.type} className="flex items-center justify-between px-4 py-3 bg-amber-900/20">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-amber-200 truncate">{fee.name}</p>
                              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Associação</p>
                            </div>
                            <span className="text-sm font-black text-amber-300 ml-3">- {formatEuro(fee.price)}</span>
                          </div>
                        ))}
                        {doacaoFee && (
                          <div className="flex items-center justify-between px-4 py-3 bg-purple-900/20">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-purple-200 truncate">{doacaoFee.name}</p>
                              <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">Associação</p>
                            </div>
                            <span className="text-sm font-black text-purple-300 ml-3">+ {formatEuro(doacaoFee.price)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-4 py-3 bg-emerald-900/30">
                          <p className="text-sm font-bold text-emerald-200">Valor Líquido ao Profissional</p>
                          <span className="text-base font-black text-emerald-300">{formatEuro(Math.max(0, profissionalNet))}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 bg-amber-900/40">
                          <p className="text-sm font-black text-amber-200 uppercase">Total a Pagar</p>
                          <span className="text-base font-black text-amber-200">{formatEuro(svcTotal)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <p className="text-red-200 text-sm font-bold">{formError}</p>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      'Criar Processo'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessList;
