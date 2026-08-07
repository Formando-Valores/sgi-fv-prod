import React from 'react';
import { X, Calendar, MessageSquare, UserCheck, Flag, Loader2 } from 'lucide-react';
import { ProcessStatus } from '../../../../types';
import { sanitizeDisplayValue } from '../../../lib/clientUtils';
import { SERVICE_MANAGERS } from '../../../../constants';
import Skeleton from '../../ui/Skeleton';
import type { ProcessChecklistItem } from '../../../hooks/useChecklist';

interface EditingUserStatusModalProps {
  editingUser: {
    id: string;
    processRecordId?: string;
    protocol?: string;
    status?: string;
    deadline?: string;
    serviceManager?: string;
    notes?: string;
    organizationId?: string;
  } | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  formChanged: boolean;
  setFormChanged: (changed: boolean) => void;
  editingProfileForm: {
    fullName: string;
    email: string;
    documentId: string;
    taxId: string;
    phone: string;
    address: string;
    country: string;
    maritalStatus: string;
  };
  setEditingProfileForm: React.Dispatch<React.SetStateAction<{
    fullName: string;
    email: string;
    documentId: string;
    taxId: string;
    phone: string;
    address: string;
    country: string;
    maritalStatus: string;
  }>>;
  editingProfileLoading: boolean;
  editingProfileSaving: boolean;
  editingProfileError: string;
  processChecklist: ProcessChecklistItem[];
  newChecklistText: string;
  setNewChecklistText: (text: string) => void;
  editingChecklistItemId: string | null;
  setEditingChecklistItemId: (id: string | null) => void;
  editingChecklistText: string;
  setEditingChecklistText: (text: string) => void;
  checklistLoading: boolean;
  checklistError: string;
  onAddChecklistItem: () => Promise<void>;
  onToggleChecklistItem: (itemId: string, completed: boolean) => Promise<void>;
  onEditChecklistItem: (itemId: string, text: string) => Promise<void>;
  onDeleteChecklistItem: (itemId: string) => Promise<void>;
}

const EditingUserStatusModal: React.FC<EditingUserStatusModalProps> = ({
  editingUser,
  onClose,
  onSubmit,
  formChanged,
  setFormChanged,
  editingProfileForm,
  setEditingProfileForm,
  editingProfileLoading,
  editingProfileSaving,
  editingProfileError,
  processChecklist,
  newChecklistText,
  setNewChecklistText,
  editingChecklistItemId,
  setEditingChecklistItemId,
  editingChecklistText,
  setEditingChecklistText,
  checklistLoading,
  checklistError,
  onAddChecklistItem,
  onToggleChecklistItem,
  onEditChecklistItem,
  onDeleteChecklistItem,
}) => {
  if (!editingUser) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-3xl rounded-3xl border border-surface-100 shadow-2xl overflow-hidden animate-scaleIn">
        <div className="p-6 border-b border-surface-100 flex justify-between items-center bg-surface-50">
          <h3 className="text-xl font-black uppercase">Editar Status: {editingUser.protocol}</h3>
          <button type="button" onClick={onClose} className="p-2 bg-surface-100 hover:bg-surface-200 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-8 max-h-[85vh] overflow-y-auto">
          <form onSubmit={onSubmit}>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-surface-500 uppercase mb-2 block">Alterar Status do Processo</label>
                  <select name="status" defaultValue={editingUser.status} onChange={() => setFormChanged(true)} className="w-full bg-white border border-surface-200 rounded-xl p-4 text-surface-800 font-semibold outline-none ring-brand-500 focus:ring-2">
                    {Object.values(ProcessStatus).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-surface-500 uppercase mb-2 block flex items-center gap-2">
                    <UserCheck className="w-3 h-3" /> Gestor do Serviço
                  </label>
                  <select name="serviceManager" defaultValue={editingUser.serviceManager} onChange={() => setFormChanged(true)} className="w-full bg-white border border-surface-200 rounded-xl p-4 text-surface-800 font-semibold outline-none ring-brand-500 focus:ring-2">
                    <option value="">Selecione um gestor</option>
                    {SERVICE_MANAGERS.map(manager => (
                      <option key={manager} value={manager}>{manager}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-surface-500 uppercase mb-2 block flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> Data de Prazo
                </label>
                <input name="deadline" type="date" defaultValue={editingUser.deadline} onChange={() => setFormChanged(true)} className="w-full bg-white border border-surface-200 rounded-xl p-4 text-surface-800 font-semibold" />
              </div>
              <div>
                <label className="text-[10px] font-black text-surface-500 uppercase mb-2 block flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" /> Nota de Observações
                </label>
                <textarea name="notes" rows={4} defaultValue={editingUser.notes} onChange={() => setFormChanged(true)} className="w-full bg-white border border-surface-200 rounded-xl p-4 text-surface-800 font-semibold resize-none" placeholder="Digite as anotações do processo..."></textarea>
              </div>

              <div className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Flag className="w-4 h-4 text-brand-600" />
                  <h4 className="text-sm font-black uppercase text-surface-700">Checklist do processo</h4>
                </div>
                <p className="text-xs text-surface-500 mb-3">
                  Todos os administradores podem criar itens e marcar como concluídos.
                </p>

                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <input
                    type="text"
                    value={newChecklistText}
                    onChange={(event) => setNewChecklistText(event.target.value)}
                    placeholder="Adicionar novo item ao checklist"
                    className="w-full bg-white border border-surface-200 rounded-xl px-3 py-2 text-sm text-surface-800 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => void onAddChecklistItem()}
                    disabled={!sanitizeDisplayValue(newChecklistText)}
                    className="rounded-xl bg-brand-600 text-white px-4 py-2 text-xs font-black uppercase disabled:opacity-60"
                  >
                    Adicionar
                  </button>
                </div>

                {checklistLoading ? (
                  <p className="text-xs font-semibold text-surface-500">Carregando checklist...</p>
                ) : processChecklist.length === 0 ? (
                  <p className="text-xs font-semibold text-surface-500">Nenhum item criado para este processo.</p>
                ) : (
                  <div className="space-y-2">
                    {processChecklist.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 rounded-xl border border-surface-200 bg-white p-3">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={(event) => void onToggleChecklistItem(item.id, event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-surface-300 text-brand-600"
                        />
                        <div className="flex-1 min-w-0">
                          {editingChecklistItemId === item.id ? (
                            <div className="flex flex-col sm:flex-row gap-2 mb-1">
                              <input
                                type="text"
                                value={editingChecklistText}
                                onChange={(event) => setEditingChecklistText(event.target.value)}
                                className="w-full bg-white border border-surface-200 rounded-lg px-2 py-1 text-sm font-semibold"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void onEditChecklistItem(item.id, editingChecklistText)}
                                  disabled={!sanitizeDisplayValue(editingChecklistText)}
                                  className="px-2 py-1 rounded-lg bg-brand-600 text-white text-[11px] font-black uppercase disabled:opacity-50"
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingChecklistItemId(null);
                                    setEditingChecklistText('');
                                  }}
                                  className="px-2 py-1 rounded-lg border border-surface-300 text-[11px] font-black uppercase"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className={`text-sm font-semibold ${item.completed ? 'line-through text-surface-400' : 'text-surface-800'}`}>
                              {item.text}
                            </p>
                          )}
                          <p className="text-[11px] text-surface-500">
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
                            className="p-1.5 rounded-md border border-surface-200 text-surface-600 hover:bg-surface-100"
                            title="Editar item"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteChecklistItem(item.id)}
                            className="p-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                            title="Excluir item"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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

              <div className="border-t border-surface-100 pt-6">
                <h4 className="text-lg font-black uppercase mb-4">Dados cadastrais do usuário</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-surface-500 uppercase block mb-2">Nome Completo</label>
                    <input
                      type="text"
                      value={editingProfileForm.fullName}
                      onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, fullName: event.target.value })); setFormChanged(true); }}
                      className="w-full bg-white border border-surface-200 rounded-xl p-4 text-surface-800 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-surface-500 uppercase block mb-2">E-mail</label>
                    <input
                      type="email"
                      value={editingProfileForm.email}
                      onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, email: event.target.value })); setFormChanged(true); }}
                      className="w-full bg-white border border-surface-200 rounded-xl p-4 text-surface-800 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-surface-500 uppercase block mb-2">Documento de Identidade</label>
                    <input
                      type="text"
                      value={editingProfileForm.documentId}
                      onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, documentId: event.target.value })); setFormChanged(true); }}
                      className="w-full bg-white border border-surface-200 rounded-xl p-4 text-surface-800 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-surface-500 uppercase block mb-2">NIF / CPF</label>
                    <input
                      type="text"
                      value={editingProfileForm.taxId}
                      onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, taxId: event.target.value })); setFormChanged(true); }}
                      className="w-full bg-white border border-surface-200 rounded-xl p-4 text-surface-800 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-surface-500 uppercase block mb-2">Telefone</label>
                    <input
                      type="text"
                      value={editingProfileForm.phone}
                      onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, phone: event.target.value })); setFormChanged(true); }}
                      className="w-full bg-white border border-surface-200 rounded-xl p-4 text-surface-800 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-surface-500 uppercase block mb-2">Estado Civil</label>
                    <input
                      type="text"
                      value={editingProfileForm.maritalStatus}
                      onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, maritalStatus: event.target.value })); setFormChanged(true); }}
                      className="w-full bg-white border border-surface-200 rounded-xl p-4 text-surface-800 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-surface-500 uppercase block mb-2">País</label>
                    <input
                      type="text"
                      value={editingProfileForm.country}
                      onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, country: event.target.value })); setFormChanged(true); }}
                      className="w-full bg-white border border-surface-200 rounded-xl p-4 text-surface-800 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-surface-500 uppercase block mb-2">Endereço completo (inclua CEP)</label>
                    <input
                      type="text"
                      value={editingProfileForm.address}
                      onChange={(event) => { setEditingProfileForm((prev) => ({ ...prev, address: event.target.value })); setFormChanged(true); }}
                      className="w-full bg-white border border-surface-200 rounded-xl p-4 text-surface-800 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
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
  );
};

export default EditingUserStatusModal;
