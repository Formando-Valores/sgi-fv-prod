/**
 * SGI FV - Process List Page
 * List of all processes with search and filters
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, FolderKanban, X, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { listProcesses, createProcess, type Process, type CreateProcessPayload } from '../../lib/processes';

const statusLabels: Record<string, { label: string; color: string }> = {
  cadastro: { label: 'Cadastro', color: 'bg-slate-600' },
  triagem: { label: 'Triagem', color: 'bg-yellow-600' },
  analise: { label: 'Análise', color: 'bg-orange-600' },
  concluido: { label: 'Concluído', color: 'bg-emerald-600' }
};

const ProcessList: React.FC = () => {
  const { userContext, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<CreateProcessPayload>({
    titulo: '',
    cliente_nome: '',
    cliente_documento: '',
    cliente_contato: ''
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadProcesses();
  }, [userContext?.org_id]);

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
      const data = await listProcesses(userContext.org_id);
      setProcesses(data);
    } catch (err) {
      console.error('Error loading processes:', err);
      setError('Erro ao carregar processos. Verifique se as migrações foram executadas.');
    } finally {
      setLoading(false); // ALWAYS set loading to false
    }
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
      const newProcess = await createProcess(userContext.org_id, formData, userContext.id);
      setShowModal(false);
      setFormData({ titulo: '', cliente_nome: '', cliente_documento: '', cliente_contato: '' });
      navigate(`/processos/${newProcess.id}`);
    } catch (err) {
      console.error('Error creating process:', err);
      setFormError('Erro ao criar processo');
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
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
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
        /* Empty State */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <FolderKanban className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-400 mb-2">
            {searchTerm ? 'Nenhum processo encontrado' : 'Nenhum processo cadastrado'}
          </h3>
          <p className="text-slate-500 text-sm">
            {searchTerm ? 'Tente uma busca diferente' : isAdmin ? 'Clique em "Novo Processo" para começar' : 'Aguarde a criação de processos'}
          </p>
        </div>
      ) : (
        /* Table */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                  <th className="px-6 py-4">Protocolo</th>
                  <th className="px-6 py-4">Título</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredProcesses.map((process) => (
                  <tr key={process.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded-md text-[10px] font-black">
                        {process.protocolo || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-200">{process.titulo}</td>
                    <td className="px-6 py-4 text-slate-300">{process.cliente_nome || '-'}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${statusLabels[process.status]?.color || 'bg-slate-600'}`}
                      >
                        {statusLabels[process.status]?.label || process.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-bold">{formatDate(process.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/processos/${process.id}`}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 inline-flex"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Novo Processo</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Título *</label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Título do processo"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Nome do Cliente</label>
                <input
                  type="text"
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
                <label className="block text-sm font-bold text-slate-300 mb-2">Contato</label>
                <input
                  type="text"
                  value={formData.cliente_contato}
                  onChange={(e) => setFormData({ ...formData, cliente_contato: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-900 border border-slate-700 rounded-xl text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Telefone ou email"
                />
              </div>
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <p className="text-red-200 text-sm font-bold">{formError}</p>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors"
                >
                  Cancelar
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
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessList;
