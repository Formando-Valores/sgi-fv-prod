import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Check, X } from 'lucide-react';
import { listProfessionalAccounts, upsertProfessionalAccount, deleteProfessionalAccount, type ProfessionalAccount } from '../../../lib/professionalAccounts';
import { ServiceUnit } from '../../../../types';

interface Props {
  currentUser: { id: string; role: string };
}

const IbanManagementSection: React.FC<Props> = ({ currentUser }) => {
  const [accounts, setAccounts] = useState<ProfessionalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [form, setForm] = useState({
    userId: '',
    fullName: '',
    document: '',
    iban: '',
    bankName: '',
    serviceUnit: 'ADMINISTRATIVO' as ServiceUnit,
  });

  const loadAccounts = async () => {
    setLoading(true);
    const data = await listProfessionalAccounts();
    setAccounts(data);
    setLoading(false);
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.iban) {
      setFeedback({ type: 'error', message: 'Nome e IBAN são obrigatórios.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    const { error } = await upsertProfessionalAccount({
      full_name: form.fullName,
      document: form.document || undefined,
      iban: form.iban,
      bank_name: form.bankName || undefined,
      service_unit: form.serviceUnit,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      setFeedback({ type: 'error', message: error });
      return;
    }
    setFeedback({ type: 'success', message: 'Conta salva com sucesso!' });
    setForm({ userId: '', fullName: '', document: '', iban: '', bankName: '', serviceUnit: 'ADMINISTRATIVO' as ServiceUnit });
    await loadAccounts();
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta conta bancária?')) return;
    const { error } = await deleteProfessionalAccount(id);
    if (error) {
      setFeedback({ type: 'error', message: error });
      return;
    }
    setFeedback({ type: 'success', message: 'Conta excluída.' });
    await loadAccounts();
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
          <Plus className="text-blue-500" /> Cadastrar IBAN
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome Completo *</label>
            <input
              required
              type="text"
              placeholder="Nome do profissional"
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Documento (RG/CPF)</label>
            <input
              type="text"
              placeholder="Documento de identificação"
              value={form.document}
              onChange={(e) => setForm((prev) => ({ ...prev, document: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">IBAN *</label>
            <input
              required
              type="text"
              placeholder="PT50 0000 0000 0000 0000 0000 0"
              value={form.iban}
              onChange={(e) => setForm((prev) => ({ ...prev, iban: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Banco</label>
            <input
              type="text"
              placeholder="Nome do banco"
              value={form.bankName}
              onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Unidade de Serviço</label>
            <select
              value={form.serviceUnit}
              onChange={(e) => setForm((prev) => ({ ...prev, serviceUnit: e.target.value as ServiceUnit }))}
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-semibold"
            >
              <option value="ADMINISTRATIVO">Administrativo</option>
              <option value="JURÍDICO / ADVOCACIA">Jurídico / Advocacia</option>
              <option value="TECNOLÓGICO / AI">Tecnológico / AI</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold uppercase rounded-xl transition-colors"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Salvando...</> : 'Salvar IBAN'}
          </button>
          {feedback && (
            <p className={`text-sm font-bold ${feedback.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
              {feedback.type === 'success' ? <Check className="h-4 w-4 inline mr-1" /> : <X className="h-4 w-4 inline mr-1" />}
              {feedback.message}
            </p>
          )}
        </form>
      </div>

      <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
        <h3 className="text-lg font-bold mb-6">Contas Cadastradas</h3>
        {loading ? (
          <p className="text-gray-500"><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando...</p>
        ) : accounts.length === 0 ? (
          <p className="text-gray-500">Nenhuma conta cadastrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">IBAN</th>
                  <th className="px-4 py-3">Unidade</th>
                  <th className="px-4 py-3">Ativo</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-700">{acc.full_name}</td>
                    <td className="px-4 py-3 text-gray-500">{acc.document || '-'}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{acc.iban}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-black text-gray-500">
                        {acc.service_unit === 'ADMINISTRATIVO' ? 'ADM' : acc.service_unit === 'JURÍDICO / ADVOCACIA' ? 'JUR' : 'TEC'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block w-2 h-2 rounded-full ${acc.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(acc.id)}
                        className="p-1.5 bg-red-100 hover:bg-red-200 rounded-md text-red-600"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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

export default IbanManagementSection;
