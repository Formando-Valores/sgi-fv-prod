import React from 'react';
import { X, CreditCard, Loader2, Check, FileDown, Upload, Mail } from 'lucide-react';
import { User, ProcessStatus } from '../../../../types';
import { sanitizeDisplayValue } from '../../../lib/clientUtils';
import { formatEuro } from '../../../lib/servicesCatalog';
import { getPaymentStatusUi } from '../../../lib/paymentStatus';
import CommunicationBlock from '../blocks/CommunicationBlock';
import PaymentProofUploadButton from '../PaymentProofUploadButton';
import type { ProcessDocument } from '../../../lib/processDocuments';
import type { PaymentProof } from '../../../lib/paymentProofs';

export interface AdminProcessRow extends User {
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
  associationFees?: { name: string; price: number; type: string }[] | null;
}

type SelectedUserTab = 'cadastral' | 'financeiro' | 'documentos' | 'comunicacao';

interface SelectedUserDetailModalProps {
  selectedUser: AdminProcessRow | User;
  selectedUserTab: SelectedUserTab;
  onTabChange: (tab: SelectedUserTab) => void;
  onClose: () => void;
  onLoadDocuments: () => void;
  processDocuments: ProcessDocument[];
  processDocumentsLoading: boolean;
  uploadingDocument: boolean;
  reviewingDocumentId: string | null;
  onUploadDocument: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDocumentReview: (docId: string, decision: 'approved' | 'rejected' | 'resubmission_requested') => void;
  isClientScope: boolean;
  paymentProofs: PaymentProof[];
  uploadingProof: boolean;
  onUploadProof: (file: File, amount?: number) => Promise<void>;
  onGoToCheckout: () => void;
  onValidateProof: (proofId: string, processId: string, status: 'validated' | 'rejected') => Promise<void>;
  validatingProof: boolean;
  redirectingCheckout: boolean;
  resendingCertificate: boolean;
  onResendCertificate: () => void;
  currentUserId: string;
  uploadingForProcess: string | null;
  setUploadingForProcess: (pid: string | null) => void;
}

const SelectedUserDetailModal: React.FC<SelectedUserDetailModalProps> = ({
  selectedUser,
  selectedUserTab,
  onTabChange,
  onClose,
  onLoadDocuments,
  processDocuments,
  processDocumentsLoading,
  uploadingDocument,
  reviewingDocumentId,
  onUploadDocument,
  onDocumentReview,
  isClientScope,
  paymentProofs,
  uploadingProof,
  onUploadProof,
  onGoToCheckout,
  onValidateProof,
  validatingProof,
  redirectingCheckout,
  resendingCertificate,
  onResendCertificate,
  currentUserId,
  uploadingForProcess,
  setUploadingForProcess,
}) => {
  const processRow = selectedUser as AdminProcessRow;

  const tabButton = (tab: SelectedUserTab, label: string, color: string) => (
    <button
      type="button"
      onClick={() => onTabChange(tab)}
      className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all text-center ${
        selectedUserTab === tab
          ? `${color} text-white shadow-md`
          : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-[calc(100%-2rem)] sm:w-[calc(100%-3rem)] md:w-full max-w-2xl rounded-2xl border border-surface-100 shadow-2xl max-h-[92vh] md:max-h-[85vh] flex flex-col overflow-hidden animate-scaleIn">
        <div className="shrink-0 px-4 sm:px-6 py-4 border-b border-surface-100 flex justify-between items-center bg-surface-50/80 backdrop-blur-sm">
          <h3 className="text-sm sm:text-lg font-black uppercase tracking-tight truncate pr-2">Ficha Cadastral</h3>
          <button onClick={onClose} className="p-1.5 sm:p-2 bg-surface-100 hover:bg-surface-200 rounded-full hover:scale-105 active:scale-95 transition-transform shrink-0">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth px-4 sm:px-6 py-4 sm:py-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-surface-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
          <div className="grid grid-cols-2 md:flex gap-2 mb-6">
            {tabButton('cadastral', 'Consulte seus dados', 'bg-brand-600')}
            {tabButton('financeiro', 'Suas finanças', 'bg-emerald-600')}
            <button
              type="button"
              onClick={() => { onTabChange('documentos'); onLoadDocuments(); }}
              className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all text-center ${
                selectedUserTab === 'documentos'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              }`}
            >
              Seus documentos
            </button>
            {tabButton('comunicacao', 'Fale conosco', 'bg-sky-600')}
          </div>

          {selectedUserTab === 'cadastral' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-4 min-w-0">
                  <div>
                    <label className="text-[10px] font-black text-surface-500 uppercase">Nome Completo</label>
                    <p className="text-lg font-black break-words">{selectedUser.name}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-surface-500 uppercase">E-mail</label>
                    <p className="font-bold text-brand-400 break-all leading-snug">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-surface-500 uppercase">Documento / NIF-CPF</label>
                    <p className="font-bold break-words">{selectedUser.documentId} / {selectedUser.taxId}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-surface-500 uppercase">Estado Civil / País</label>
                    <p className="font-bold break-words">{selectedUser.maritalStatus} - {selectedUser.country}</p>
                  </div>
                </div>
                <div className="space-y-4 min-w-0">
                  <div>
                    <label className="text-[10px] font-black text-surface-500 uppercase">Protocolo SGI</label>
                    <p className="text-lg font-black text-emerald-400 break-words">{selectedUser.protocol}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-surface-500 uppercase">Título do processo</label>
                    <p className="font-bold break-words">{sanitizeDisplayValue(processRow.contractedServiceName) || 'Não informado'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-surface-500 uppercase">Unidade Atendimento</label>
                    <p className="font-bold text-brand-300 break-words leading-snug">{selectedUser.unit}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-surface-500 uppercase">Processo Judicial</label>
                    <p className="font-bold break-words">{selectedUser.processNumber || 'NÃO INFORMADO'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-surface-500 uppercase">Status Atual</label>
                    <p className="font-black text-orange-500 uppercase">{selectedUser.status}</p>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-surface-100">
                <label className="text-[10px] font-black text-surface-500 uppercase block mb-2">Endereço Completo</label>
                <p className="font-semibold p-4 bg-surface-50 border border-surface-200 rounded-xl">{selectedUser.address}</p>
              </div>
              {selectedUser.notes && (
                <div className="mt-4">
                  <label className="text-[10px] font-black text-surface-500 uppercase block mb-2">Observações Internas</label>
                  <p className="font-bold p-4 bg-brand-900/10 border border-brand-900/30 rounded-xl text-brand-200 italic">"{selectedUser.notes}"</p>
                </div>
              )}
            </>
          )}

          {selectedUserTab === 'financeiro' && (
            <div className="space-y-6">
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <label className="text-[10px] font-black text-emerald-700 uppercase block mb-1">Resumo do Pagamento</label>
                <p className="text-3xl font-black text-emerald-700">
                  {processRow.osValue != null
                    ? formatEuro(Number(processRow.osValue ?? 0))
                    : '-'}
                </p>
              </div>

              {processRow.servicesSelected && processRow.servicesSelected.length > 0 && (
                <div>
                  <label className="text-[10px] font-black text-surface-500 uppercase block mb-2">Serviços Contratados</label>
                  <div className="divide-y divide-surface-100 border border-surface-200 rounded-xl overflow-hidden">
                    {processRow.servicesSelected.map((svc, idx) => (
                      <div key={idx} className="flex items-center justify-between px-4 py-3 bg-white">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-surface-800 truncate">{svc.name}</p>
                          <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">{svc.group}</p>
                        </div>
                        <span className="text-sm font-black text-surface-700 ml-3">{formatEuro(svc.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {processRow.associationFees && processRow.associationFees.length > 0 && (() => {
                const allFees = processRow.associationFees!;
                const svcTotal = processRow.osValue ?? 0;
                const servicosTotal = svcTotal - (allFees.find(f => f.type === 'doacao')?.price ?? 0);
                const convenioFees = allFees.filter(f => f.type === 'convenio');
                const doacaoFee = allFees.find(f => f.type === 'doacao');
                const convenioTotal = convenioFees.reduce((s, f) => s + f.price, 0);
                const profissionalNet = servicosTotal - convenioTotal;
                return (
                  <div>
                    <label className="text-[10px] font-black text-amber-700 uppercase block mb-2">Taxas Associativas</label>
                    <div className="divide-y divide-amber-100 border border-amber-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-brand-50">
                        <p className="text-sm font-bold text-brand-800">Valor Bruto dos Serviços</p>
                        <span className="text-sm font-black text-brand-800">{formatEuro(servicosTotal)}</span>
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
                <div className="p-4 bg-surface-50 border border-surface-200 rounded-xl">
                  <label className="text-[10px] font-black text-surface-500 uppercase block mb-1">Tipo de Serviço</label>
                  <p className="text-lg font-black text-surface-900">{processRow.processType || '-'}</p>
                </div>
                <div className="p-4 bg-surface-50 border border-surface-200 rounded-xl">
                  <label className="text-[10px] font-black text-surface-500 uppercase block mb-1">Unidade de Atendimento</label>
                  <p className="text-lg font-black text-surface-900">{selectedUser.unit}</p>
                </div>
                <div className="p-4 bg-surface-50 border border-surface-200 rounded-xl">
                  <label className="text-[10px] font-black text-surface-500 uppercase block mb-1">Status do Pagamento</label>
                  {processRow.paymentStatus ? (
                    <span className={`inline-block px-3 py-1 rounded text-xs font-bold uppercase text-white ${getPaymentStatusUi(processRow.paymentStatus)?.color || 'bg-slate-600'}`}>
                      {getPaymentStatusUi(processRow.paymentStatus)?.label || processRow.paymentStatus}
                    </span>
                  ) : (
                    <p className="text-lg font-black text-surface-400">Pendente</p>
                  )}
                </div>
              </div>

              {(processRow.paymentStatus == null || processRow.paymentStatus === 'pending' || processRow.paymentStatus === 'failed' || processRow.paymentStatus === 'canceled') && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={onGoToCheckout}
                    disabled={redirectingCheckout}
                    className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-emerald-600 px-6 py-4 text-base font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 shadow-lg"
                  >
                    {redirectingCheckout ? (
                      <><Loader2 className="h-5 w-5 animate-spin" /> Redirecionando para pagamento...</>
                    ) : (
                      <><CreditCard className="h-5 h-5" /> Pagar agora — {formatEuro(Number(processRow.osValue ?? 0))}</>
                    )}
                  </button>
                  <p className="text-xs text-surface-500 text-center">Pagamento processado via Stripe com segurança</p>
                  {isClientScope && (
                    <PaymentProofUploadButton
                      processRow={processRow}
                      isUploading={uploadingProof}
                      onUpload={onUploadProof}
                      uploadingForProcess={uploadingForProcess}
                      setUploadingForProcess={setUploadingForProcess}
                    />
                  )}
                </div>
              )}

              {processRow.paymentStatus === 'pending_validation' && (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                    <p className="font-bold text-amber-800">
                      {isClientScope
                        ? 'Comprovante enviado! Aguardando validação.'
                        : 'Cliente enviou comprovante. Valide abaixo.'}
                    </p>
                  </div>
                  {paymentProofs.length > 0 && (
                    <div>
                      <label className="text-[10px] font-black text-surface-500 uppercase block mb-2">Comprovantes Enviados</label>
                      <div className="divide-y divide-surface-100 border border-surface-200 rounded-xl overflow-hidden">
                        {paymentProofs.map((proof) => (
                          <div key={proof.id} className="flex items-center justify-between px-4 py-3 bg-white">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-surface-800 truncate">{proof.file_name || 'Comprovante'}</p>
                              {proof.amount && (
                                <p className="text-[10px] font-semibold text-surface-500">Valor: {formatEuro(proof.amount)}</p>
                              )}
                              {proof.notes && <p className="text-[10px] text-surface-500 mt-1">{proof.notes}</p>}
                            </div>
                            <a href={proof.file_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs font-bold text-brand-600 hover:text-brand-800 ml-3 underline">
                              Ver arquivo
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!isClientScope && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const pid = processRow.processRecordId;
                          const proofId = paymentProofs[0]?.id;
                          if (proofId && pid) void onValidateProof(proofId, pid, 'validated');
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
                          const pid = processRow.processRecordId;
                          const proofId = paymentProofs[0]?.id;
                          if (proofId && pid) void onValidateProof(proofId, pid, 'rejected');
                        }}
                        disabled={validatingProof || paymentProofs.length === 0}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
                      >
                        <X className="h-4 w-4" />
                        Rejeitar
                      </button>
                    </div>
                  )}
                  {isClientScope && paymentProofs[0]?.status === 'rejected' && (
                    <PaymentProofUploadButton
                      processRow={processRow}
                      isUploading={uploadingProof}
                      onUpload={onUploadProof}
                      uploadingForProcess={uploadingForProcess}
                      setUploadingForProcess={setUploadingForProcess}
                    />
                  )}
                </div>
              )}

              {(processRow.paymentStatus === 'validated' || processRow.paymentStatus === 'accepted') && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <Check className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                  <p className="font-bold text-emerald-800 text-lg">Pagamento Validado</p>
                  <p className="text-sm text-emerald-600 mt-1">Certificado de Filiação disponível para download.</p>
                </div>
              )}

              {processRow.paymentStatus === 'rejected' && (
                <div className="space-y-3">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                    <p className="font-bold text-red-800">Comprovante rejeitado</p>
                    <p className="text-sm text-red-600 mt-1">Envie um novo comprovante válido.</p>
                  </div>
                  {isClientScope && (
                    <PaymentProofUploadButton
                      processRow={processRow}
                      isUploading={uploadingProof}
                      onUpload={onUploadProof}
                      uploadingForProcess={uploadingForProcess}
                      setUploadingForProcess={setUploadingForProcess}
                    />
                  )}
                </div>
              )}

              {(processRow.paymentStatus === 'paid' || processRow.paymentStatus === 'validated' || processRow.paymentStatus === 'accepted') && (
                <div className="mt-4 p-4 bg-brand-50 border border-brand-200 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-black uppercase text-brand-800">Certificado de Filiação</h4>
                    <a href={processRow.processRecordId ? `/#/certificate?processId=${processRow.processRecordId}` : '#'}
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-900 underline">
                      <FileDown className="h-3 w-3" />
                      Baixar
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={onResendCertificate}
                      disabled={resendingCertificate}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all"
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
                          if (!file || !selectedUser || !currentUserId) return;
                          const procId = processRow.processRecordId;
                          if (!procId) return;
                          e.target.value = '';
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
                <h3 className="text-lg font-black uppercase text-surface-800">Documentos do Processo</h3>
                <label className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-colors cursor-pointer ${uploadingDocument ? 'bg-violet-400' : 'bg-violet-600 hover:bg-violet-500'}`}>
                  {uploadingDocument ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
                  ) : (
                    <><Upload className="h-4 w-4" /> Adicionar Documento</>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={onUploadDocument}
                    disabled={uploadingDocument}
                  />
                </label>
              </div>

              {processDocumentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                </div>
              ) : processDocuments.length === 0 ? (
                <div className="text-center py-12 text-surface-500">
                  <p className="font-bold">Nenhum documento anexado.</p>
                  <p className="text-sm mt-1">Clique em "Adicionar Documento" para enviar um arquivo.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {processDocuments.map((doc) => (
                    <div key={doc.id} className="border border-surface-200 rounded-xl p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-surface-800 break-words">{doc.document_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            doc.validation_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            doc.validation_status === 'rejected' ? 'bg-red-100 text-red-700' :
                            doc.validation_status === 'resubmission_requested' ? 'bg-amber-100 text-amber-700' :
                            'bg-surface-100 text-surface-600'
                          }`}>
                            {doc.validation_status === 'approved' ? 'Aprovado' :
                             doc.validation_status === 'rejected' ? 'Rejeitado' :
                             doc.validation_status === 'resubmission_requested' ? 'Reenvio solicitado' :
                             'Pendente'}
                          </span>
                          <span className="text-xs text-surface-400">
                            {new Date(doc.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {doc.pending_reason && (
                          <p className="text-xs text-surface-500 mt-1">{doc.pending_reason}</p>
                        )}
                        {doc.review_notes && (
                          <p className="text-xs text-amber-600 mt-1 font-semibold">Parecer: {doc.review_notes}</p>
                        )}
                        {doc.file_path && (
                          <a href={doc.file_path} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-brand-600 hover:text-brand-800 font-bold mt-1 inline-block">
                            Visualizar arquivo →
                          </a>
                        )}
                      </div>
                      {!isClientScope && doc.validation_status === 'pending' && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => onDocumentReview(doc.id, 'approved')}
                            disabled={reviewingDocumentId === doc.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            {reviewingDocumentId === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Aprovar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDocumentReview(doc.id, 'rejected')}
                            disabled={reviewingDocumentId === doc.id}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            Rejeitar
                          </button>
                          <button
                            type="button"
                            onClick={() => onDocumentReview(doc.id, 'resubmission_requested')}
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
                            onClick={() => onDocumentReview(doc.id, 'resubmission_requested')}
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

          {selectedUserTab === 'comunicacao' && processRow.processRecordId && (
            <div className="bg-white border border-surface-100 rounded-2xl overflow-hidden shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
              <div className="p-4 border-b border-surface-100 bg-surface-50">
                <h3 className="text-sm font-black uppercase text-surface-700">Comunicação do Processo</h3>
              </div>
              <CommunicationBlock
                processId={processRow.processRecordId}
                currentUserId={currentUserId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectedUserDetailModal;
