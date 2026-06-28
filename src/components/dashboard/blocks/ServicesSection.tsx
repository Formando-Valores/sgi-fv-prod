import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Loader2, Check, X, Search, XCircle } from 'lucide-react';
import {
  loadServicesCatalog,
  createService,
  updateService,
  deleteService,
  type DbCatalogService,
} from '../../../lib/servicesCatalogDb';
import { ServiceUnit } from '../../../../types';

interface Props {
  currentUser: { id: string; role: string };
}

const emptyForm = {
  name: '',
  description: '',
  unit: 'ADMINISTRATIVO',
  group: '',
  price: 0,
};

const ServicesSection: React.FC<Props> = () => {
  const [services, setServices] = useState<DbCatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const data = await loadServicesCatalog(true);
    setServices(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.price <= 0) {
      setFeedback({ type: 'error', message: 'Nome e preço (maior que zero) são obrigatórios.' });
      return;
    }
    setSaving(true);
    setFeedback(null);

    if (editingId) {
      const { error } = await updateService(editingId, {
        name: form.name,
        description: form.description || undefined,
        unit: form.unit,
        group: form.group || undefined,
        price: form.price,
      });
      setSaving(false);
      if (error) {
        setFeedback({ type: 'error', message: error.message });
        return;
      }
      setFeedback({ type: 'success', message: 'Serviço atualizado com sucesso!' });
    } else {
      const { error } = await createService({
        name: form.name,
        description: form.description || undefined,
        unit: form.unit,
        group: form.group || undefined,
        price: form.price,
      });
      setSaving(false);
      if (error) {
        setFeedback({ type: 'error', message: error.message });
        return;
      }
      setFeedback({ type: 'success', message: 'Serviço cadastrado com sucesso!' });
    }

    resetForm();
    await load();
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleEdit = (svc: DbCatalogService) => {
    setForm({
      name: svc.name,
      description: svc.description || '',
      unit: svc.unit,
      group: svc.group || '',
      price: svc.price,
    });
    setEditingId(svc.id);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este serviço?')) return;
    const { error } = await deleteService(id);
    if (error) {
      setFeedback({ type: 'error', message: error.message });
      return;
    }
    setFeedback({ type: 'success', message: 'Serviço excluído.' });
    await load();
    setTimeout(() => setFeedback(null), 3000);
  };

  const filtered = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.group || '').toLowerCase().includes(search.toLowerCase()) ||
    s.unit.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
          {editingId ? <Pencil className="text-blue-500" /> : <Plus className="text-blue-500" />}
          {editingId ? 'Editar Serviço' : 'Cadastrar Serviço'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome *</label>
            <input
              required
              type="text"
              placeholder="Nome do serviço"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Descrição</label>
            <textarea
              placeholder="Descrição do serviço"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Unidade *</label>
            <select
              required
              value={form.unit}
              onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold"
            >
              {Object.values(ServiceUnit).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Grupo</label>
            <input
              type="text"
              placeholder="Ex: Licenciamento, Certidão, etc."
              value={form.group}
              onChange={(e) => setForm((prev) => ({ ...prev, group: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Preço (€) *</label>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold uppercase rounded-xl transition-colors"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Salvando...</> : editingId ? 'Atualizar' : 'Cadastrar'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
          {feedback && (
            <p className={`text-sm font-bold ${feedback.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
              {feedback.type === 'success' ? <Check className="h-4 w-4 inline mr-1" /> : <X className="h-4 w-4 inline mr-1" />}
              {feedback.message}
            </p>
          )}
        </form>
      </div>

      <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h3 className="text-lg font-bold">Serviços Cadastrados</h3>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 text-gray-500 w-4 h-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar serviços..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
            />
          </div>
        </div>
        {loading ? (
          <p className="text-gray-500"><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500">Nenhum serviço encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Unidade</th>
                  <th className="px-4 py-3">Grupo</th>
                  <th className="px-4 py-3 text-right">Preço (€)</th>
                  <th className="px-4 py-3 text-center">Ativo</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((svc) => (
                  <tr key={svc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-700">{svc.name}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-black text-gray-500">{svc.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{svc.group || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">€ {svc.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${svc.active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(svc)}
                          className="p-1.5 bg-blue-100 hover:bg-blue-200 rounded-md text-blue-600"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(svc.id)}
                          className="p-1.5 bg-red-100 hover:bg-red-200 rounded-md text-red-600"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServicesSection;