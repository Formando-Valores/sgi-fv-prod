/**
 * SGI FV - Process Details Page
 * Displays the detailed process view with real data
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Calendar, Landmark, UserCheck, MessageSquare, User as UserIcon, Loader2, AlertCircle, X, ChevronRight, ExternalLink, CreditCard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getProcessById, listProcessEvents, updateProcessStatus, addProcessEvent, listRequiredChecklistDocuments, listProcessAttachments, reviewProcessAttachment, type Process, type ProcessEvent, type ProcessDocumentAttachment, type ProcessDocumentChecklistItem } from '../../lib/processes';
import { createCheckoutSession } from '../../lib/stripe';
import { getPaymentStatusUi } from '../../lib/paymentStatus';

const statusSteps = [
  { key: 'cadastro', label: 'CADASTRO', color: 'bg-slate-500' },
  { key: 'triagem', label: 'TRIAGEM', color: 'bg-yellow-400' },
  { key: 'analise', label: 'ANÁLISE', color: 'bg-orange-500' },
  { key: 'concluido', label: 'CONCLUÍDO', color: 'bg-[#39ff14]' },
];

const eventTypeLabels: Record<string, { label: string; color: string }> = {
  registro: { label: 'Registro', color: 'text-blue-400' },
  status_change: { label: 'Alteração de Status', color: 'text-emerald-400' },
  observacao: { label: 'Observação', color: 'text-purple-400' },
  documento: { label: 'Documento', color: 'text-orange-400' },
  atribuicao: { label: 'Atribuição', color: 'text-cyan-400' },
};

const ProcessDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userContext, isAdmin } = useAuth();
  
  const [process, setProcess] = useState<Process | null>(null);
  const [events, setEvents] = useState<ProcessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<ProcessDocumentAttachment[]>([]);
  const [requiredDocuments, setRequiredDocuments] = useState<ProcessDocumentChecklistItem[]>([]);
  const [error, setError] = useState('');
  
  // Modal states
  const [showObsModal, setShowObsModal] = useState(false);
  const [obsText, setObsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [redirectingCheckout, setRedirectingCheckout] = useState(false);

  useEffect(() => {
    loadData();
  }, [id, userContext?.org_id]);

  const loadData = async () => {
    if (!userContext?.org_id || !id) return;
    
    setLoading(true);
    setError('');
    try {
      const [processData, eventsData] = await Promise.all([
        getProcessById(userContext.org_id, id),
        listProcessEvents(userContext.org_id, id)
      ]);
      
      if (!processData) {
        setError('Processo não encontrado');
        return;
      }
      
      setProcess(processData);
      setEvents(eventsData);

      const [attachmentsData, checklistData] = await Promise.all([
        listProcessAttachments(userContext.org_id, id),
        listRequiredChecklistDocuments(userContext.org_id, id).catch(() => []),
      ]);
      setAttachments(attachmentsData);
      setRequiredDocuments(checklistData);
    } catch (err) {
      console.error('Error loading process:', err);
      setError('Erro ao carregar processo');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: Process['status']) => {
    if (!userContext?.org_id || !userContext?.id || !process) return;
    
    setSubmitting(true);
    try {
      await updateProcessStatus(userContext.org_id, process.id, newStatus, userContext.id);
      await loadData();
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userContext?.org_id || !userContext?.id || !process || !obsText.trim()) return;
    
    setSubmitting(true);
    try {
      await addProcessEvent(userContext.org_id, process.id, 'observacao', obsText.trim(), userContext.id);
      setObsText('');
      setShowObsModal(false);
      await loadData();
    } catch (err) {
      console.error('Error adding observation:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  const currentStepIndex = statusSteps.findIndex(s => s.key === process?.status);
  const canReviewDocuments = ['admin', 'pleno', 'senior'].includes((userContext?.hierarchy || '').toLowerCase());

  const handleGoToCheckout = async () => {
    if (!process || !userContext?.org_id || !userContext?.id) return;

    const amount = Number((process as Record<string, unknown>).amount ?? (process as Record<string, unknown>).os_value ?? 0);
    if (amount <= 0) {
      window.alert('Valor do pagamento não definido para este processo.');
      return;
    }

    setRedirectingCheckout(true);
    try {
      const session = await createCheckoutSession({
        amount: Math.round(amount * 100),
        currency: 'brl',
        successUrl: `${window.location.origin}/#/payments/success?processId=${process.id}`,
        cancelUrl: `${window.location.origin}/#/payments/cancel?processId=${process.id}`,
        processId: process.id,
        clientId: userContext.id,
        serviceId: String((process as Record<string, unknown>).service_id ?? ''),
        organizationId: userContext.org_id,
        areaId: String((process as Record<string, unknown>).area_id ?? ''),
        sectorId: String((process as Record<string, unknown>).sector_id ?? ''),
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

  const handleReview = async (attachmentId: string, decision: 'approved' | 'rejected' | 'resubmission_requested') => {
    if (!userContext?.org_id || !userContext?.id || !process) return;
    let justification = '';
    let guidance = '';
    if (decision === 'rejected') {
      justification = window.prompt('Informe a justificativa da recusa (obrigatório):', '') || '';
      if (!justification.trim()) return;
    }
    if (decision === 'resubmission_requested') {
      guidance = window.prompt('Informe a orientação para reenvio (obrigatório):', '') || '';
      if (!guidance.trim()) return;
    }
    await reviewProcessAttachment(userContext.org_id, process.id, attachmentId, decision, userContext.id, { justification, guidance });
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !process) {
    return (
      <div className="space-y-6">
        <Link to="/processos" className="inline-flex items-center gap-2 text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" /> Voltar
        </Link>
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-6 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-400" />
          <p className="text-red-200 font-bold">{error || 'Processo não encontrado'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div className="flex items-center gap-4 no-print">
        <Link
          to="/processos"
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black text-white tracking-tighter">
            {process.protocolo || `Processo #${process.id.slice(0,8)}`}
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-slate-400 text-xs font-bold uppercase">{formatDateTime(process.created_at)}</p>
            <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
            <p className="text-slate-200 text-sm font-bold">{process.titulo}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Status Section */}
        <section className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Activity className="text-blue-500" /> STATUS DO PROCESSO
              </h2>
              <span className="bg-slate-800 px-3 py-1 rounded-full text-[10px] font-black text-slate-400 tracking-widest uppercase">ACOMPANHAMENTO</span>
            </div>

            {/* Stepper */}
            <div className="relative flex justify-between mb-8">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-800 -translate-y-1/2 z-0"></div>
              {statusSteps.map((step, idx) => (
                <div key={step.key} className="relative z-10 flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-slate-950 transition-all ${idx <= currentStepIndex ? step.color : 'bg-slate-800'}`}>
                    {idx < currentStepIndex ? <div className="w-3 h-3 bg-white rounded-full"></div> : null}
                    {idx === currentStepIndex ? <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div> : null}
                  </div>
                  <span className={`mt-3 text-[10px] font-black uppercase tracking-tighter ${idx <= currentStepIndex ? 'text-white' : 'text-slate-600'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Status Actions */}
            {isAdmin && process.status !== 'concluido' && (
              <div className="flex flex-wrap gap-2 mb-6">
                {statusSteps.map((step, idx) => (
                  idx > currentStepIndex && (
                    <button
                      key={step.key}
                      onClick={() => handleStatusChange(step.key as Process['status'])}
                      disabled={submitting}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg text-sm font-bold text-white flex items-center gap-2 transition-colors"
                    >
                      Avançar para {step.label} <ChevronRight className="w-4 h-4" />
                    </button>
                  )
                ))}
              </div>
            )}

            {/* Manager and Notes Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 overflow-hidden">
              {/* Manager */}
              <div className="p-8 flex flex-col items-center text-center border-b md:border-b-0 md:border-r border-slate-800/50">
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-blue-600 shadow-xl">
                  <UserCheck className="text-white w-8 h-8" />
                </div>
                <p className="text-xl font-black uppercase tracking-tight text-white">
                  {process.responsavel_user_id ? 'Atribuído' : 'A DEFINIR'}
                </p>
                <p className="text-slate-500 text-[10px] mt-1 uppercase font-bold tracking-widest">Gestor Responsável</p>
              </div>

              {/* Add Observation */}
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-purple-600 shadow-xl">
                  <MessageSquare className="text-white w-8 h-8" />
                </div>
                {isAdmin ? (
                  <button
                    onClick={() => setShowObsModal(true)}
                    className="text-sm font-bold text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    + Registrar Observação
                  </button>
                ) : (
                  <p className="text-sm font-bold text-slate-400">Observações na timeline</p>
                )}
                <p className="text-slate-500 text-[10px] mt-1 uppercase font-bold tracking-widest">Notas do Atendimento</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Landmark className="text-emerald-500" /> PROCESSAMENTO ADMINISTRATIVO
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-900 border border-slate-800 rounded-xl">
                <p className="text-slate-500 text-[10px] font-black uppercase mb-1">Protocolo SGI</p>
                <p className="text-xl font-black text-blue-400">{process.protocolo || '-'}</p>
              </div>
              <div className="p-4 bg-gray-900 border border-slate-800 rounded-xl">
                <p className="text-slate-500 text-[10px] font-black uppercase mb-1">Situação Atual</p>
                <p className="text-xl font-black text-white">
                  {statusSteps.find(s => s.key === process.status)?.label || process.status}
                </p>
              </div>
            </div>
          </div>

          {requiredDocuments.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-3">Documentos obrigatórios</h2>
              <ul className="space-y-2">
                {requiredDocuments.map((doc) => (
                  <li key={doc.id} className="text-sm text-slate-300">• {doc.document_name}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-3">Anexos do processo</h2>
            {attachments.length === 0 ? <p className="text-sm text-slate-500">Nenhum anexo.</p> : (
              <div className="space-y-3">
                {attachments.map((a) => (
                  <div key={a.id} className="border border-slate-700 rounded-lg p-3">
                    <p className="font-bold text-sm text-white">{a.document_name}</p>
                    <p className="text-xs text-slate-400">Status: {a.validation_status}</p>
                    {canReviewDocuments && (
                      <div className="flex gap-2 mt-2">
                        <button className="text-xs px-2 py-1 bg-emerald-700 rounded" onClick={() => handleReview(a.id, 'approved')}>Aprovar</button>
                        <button className="text-xs px-2 py-1 bg-red-700 rounded" onClick={() => handleReview(a.id, 'rejected')}>Recusar</button>
                        <button className="text-xs px-2 py-1 bg-yellow-700 rounded" onClick={() => handleReview(a.id, 'resubmission_requested')}>Solicitar reenvio</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Sidebar Data Section */}
        <section className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <UserIcon className="text-purple-500" /> DADOS CADASTRAIS
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-slate-500 text-[10px] font-black uppercase">Cliente</p>
                <p className="text-sm font-bold text-slate-200">{process.cliente_nome || '-'}</p>
              </div>
              <div className="h-px bg-slate-800"></div>
              <div>
                <p className="text-slate-500 text-[10px] font-black uppercase">Documento</p>
                <p className="text-sm font-bold text-slate-200">{process.cliente_documento || '-'}</p>
              </div>
              <div className="h-px bg-slate-800"></div>
              <div>
                <p className="text-slate-500 text-[10px] font-black uppercase">Contato</p>
                <p className="text-sm font-bold text-slate-200">{process.cliente_contato || '-'}</p>
              </div>
            </div>
          </div>

          {process.payment_status && process.payment_status !== 'paid' && process.payment_status !== 'released' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CreditCard className="text-emerald-500" /> PAGAMENTO
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-slate-500 text-[10px] font-black uppercase">Status</p>
                  <span className={`inline-block mt-1 px-2 py-1 rounded text-[10px] font-bold uppercase ${getPaymentStatusUi(process.payment_status)?.color || 'bg-slate-700'} text-white`}>
                    {getPaymentStatusUi(process.payment_status)?.label || process.payment_status}
                  </span>
                </div>
                {(process.payment_status === 'pending' || process.payment_status === 'failed' || process.payment_status === 'canceled') && (
                  <button
                    type="button"
                    onClick={() => { void handleGoToCheckout(); }}
                    disabled={redirectingCheckout}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {redirectingCheckout ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Redirecionando...</>
                    ) : (
                      <><ExternalLink className="h-4 w-4" /> Pagar agora</>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Calendar className="text-orange-500" /> LINHA DO TEMPO
            </h2>
            <div className="max-h-80 overflow-y-auto pr-2 relative">
              <div className="absolute left-1 top-0 bottom-0 w-0.5 bg-slate-800"></div>
              <div className="space-y-6 pl-6 relative">
                {events.length === 0 ? (
                  <p className="text-slate-500 text-sm">Nenhum evento registrado</p>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="relative">
                      <div className={`absolute -left-[23px] top-1.5 w-3 h-3 rounded-full border-2 border-slate-900 ${eventTypeLabels[event.tipo]?.color.replace('text-', 'bg-') || 'bg-slate-500'}`}></div>
                      <p className={`text-xs font-black ${eventTypeLabels[event.tipo]?.color || 'text-slate-400'}`}>
                        {formatDateTime(event.created_at)}
                      </p>
                      <p className="text-sm font-bold text-white mt-1">
                        {eventTypeLabels[event.tipo]?.label || event.tipo}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{event.mensagem}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Observation Modal */}
      {showObsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Registrar Observação</h2>
              <button onClick={() => setShowObsModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddObservation} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Observação</label>
                <textarea
                  value={obsText}
                  onChange={(e) => setObsText(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
                  placeholder="Digite sua observação..."
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowObsModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !obsText.trim()}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessDetails;
