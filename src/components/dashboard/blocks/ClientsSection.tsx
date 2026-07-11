import React, { useState, useEffect } from 'react';
import { Search, Users, Pencil, Trash2, X, Plus, Check } from 'lucide-react';
import { User, ServiceUnit, Organization } from '../../../../types';
import { supabase } from '../../../../supabase';
import Button from '../../ui/Button';
import { TableSkeleton } from '../../ui/Skeleton';
import DashboardCardContainer from '../DashboardCardContainer';
import {
  ClientProfileView,
  NewClientFormState,
  EditClientFormState,
  sanitizeDisplayValue,
  mapAccessLevelToOrgRole,
  mapOrgRoleToAccessLevel,
  AccessLevel,
} from '../../../lib/clientUtils';
import { SUPABASE_EDGE_FUNCTIONS } from '../../../lib/supabaseFunctions';
import { useToast } from '../../../contexts/ToastContext';

interface ClientsSectionProps {
  organizations: Organization[];
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const ClientsSection: React.FC<ClientsSectionProps> = ({ organizations, users, setUsers }) => {
  const { showToast } = useToast();
  const [clientsData, setClientsData] = useState<ClientProfileView[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState('');
  const [clientsSearch, setClientsSearch] = useState('');
  const [clientsRowsLimit, setClientsRowsLimit] = useState(10);
  const [clientsSort, setClientsSort] = useState<'name_asc' | 'name_desc' | 'recent'>('name_asc');
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientFormError, setClientFormError] = useState('');
  const [clientFormSuccess, setClientFormSuccess] = useState('');
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [savingClientEdit, setSavingClientEdit] = useState(false);
  const [clientEditError, setClientEditError] = useState('');
  const [clientEditSuccess, setClientEditSuccess] = useState('');
  const [editingClient, setEditingClient] = useState<ClientProfileView | null>(null);
  const [editClientForm, setEditClientForm] = useState<EditClientFormState>({
    fullName: '',
    email: '',
    phone: '',
    documentId: '',
    taxId: '',
    address: '',
    country: 'Brasil',
    maritalStatus: 'Solteiro',
    organizationId: '',
    accessLevel: 'Cliente',
  });
  const [newClientForm, setNewClientForm] = useState<NewClientFormState>({
    fullName: '',
    email: '',
    phone: '',
    documentId: '',
    taxId: '',
    address: '',
    country: 'Brasil',
    maritalStatus: 'Solteiro',
    organizationId: '',
    accessLevel: 'Cliente',
  });

  const ACCESS_LEVELS: AccessLevel[] = ['Administrador', 'Usuário Sênior', 'Usuário Pleno', 'Operador', 'Cliente'];

  const fetchClients = async () => {
    setClientsLoading(true);
    setClientsError('');

    const { data: scopedMembers, error: membersError } = await supabase
      .from('org_members')
      .select('user_id,org_id,role,organizations:org_id(name)');

    if (membersError) {
      console.warn('[clientes] erro ao carregar membros', membersError);
      setClientsError('Erro ao carregar lista de clientes. Tente novamente mais tarde.');
      setClientsLoading(false);
      return;
    }

    if (!scopedMembers || scopedMembers.length === 0) {
      setClientsData([]);
      setClientsLoading(false);
      return;
    }

    const userIds = Array.from(new Set(scopedMembers.map((member) => member.user_id)));
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id,nome_completo,email,created_at')
      .in('id', userIds);

    if (profileError) {
      console.warn('[clientes] falha ao carregar perfis; exibindo listagem parcial', profileError);
      setClientsError('Alguns dados de perfil não puderam ser carregados agora. A listagem exibida pode estar parcial.');
    } else {
      setClientsError('');
    }

    const profileMap = new Map(((profileRows || []) as Array<{ id: string; nome_completo?: string | null; email?: string | null; created_at?: string | null }>).map((row) => [row.id, row]));

    const normalizedClients: ClientProfileView[] = scopedMembers.map((member) => {
      const profile = profileMap.get(member.user_id);
      const email = profile?.email || 'sem-email@nao-informado';
      const nome =
        profile?.nome_completo ||
        (email !== 'sem-email@nao-informado' ? String(email).split('@')[0] : `Usuário ${member.user_id.slice(0, 8)}`);

      return {
        id: `${member.org_id}-${member.user_id}`,
        user_id: member.user_id,
        org_id: member.org_id,
        org_name: extractOrganizationName(member.organizations) || 'Organização Padrão',
        nome,
        email,
        accessLevel: mapOrgRoleToAccessLevel(member.role),
        source: profile ? 'org_members+profiles' : 'org_members_only',
        created_at: profile?.created_at || undefined,
      };
    });

    setClientsData(normalizedClients);
    setClientsLoading(false);
  };

  useEffect(() => {
    void fetchClients();
  }, []);

  const visibleClients = clientsData
    .filter((client) =>
      client.nome.toLowerCase().includes(clientsSearch.toLowerCase()) ||
      client.email.toLowerCase().includes(clientsSearch.toLowerCase()) ||
      client.org_name.toLowerCase().includes(clientsSearch.toLowerCase())
    )
    .sort((a, b) => {
      if (clientsSort === 'name_asc') {
        return a.nome.localeCompare(b.nome, 'pt-BR');
      }
      if (clientsSort === 'name_desc') {
        return b.nome.localeCompare(a.nome, 'pt-BR');
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    })
    .slice(0, clientsRowsLimit);

  const resetNewClientForm = () => {
    setNewClientForm({
      fullName: '',
      email: '',
      phone: '',
      documentId: '',
      taxId: '',
      address: '',
      country: 'Brasil',
      maritalStatus: 'Solteiro',
      organizationId: '',
      accessLevel: 'Cliente',
    });
    setClientFormError('');
    setClientFormSuccess('');
  };

  const handleCreateClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClientFormError('');
    setClientFormSuccess('');

    const name = sanitizeDisplayValue(newClientForm.fullName);
    const email = sanitizeDisplayValue(newClientForm.email);
    const taxId = sanitizeDisplayValue(newClientForm.taxId);
    const phone = sanitizeDisplayValue(newClientForm.phone);
    const address = sanitizeDisplayValue(newClientForm.address);
    const selectedOrg = organizations.find((org) => org.id === newClientForm.organizationId);

    if (!name) {
      setClientFormError('Informe o nome do cliente.');
      return;
    }

    if (!email) {
      setClientFormError('Informe o e-mail do cliente.');
      return;
    }

    if (!taxId) {
      setClientFormError('Informe o NIF/CPF do cliente.');
      return;
    }

    if (!phone) {
      setClientFormError('Informe o telefone do cliente.');
      return;
    }

    if (!address) {
      setClientFormError('Informe o endereço do cliente.');
      return;
    }

    if (!selectedOrg) {
      setClientFormError('Selecione uma organização válida.');
      return;
    }

    setCreatingClient(true);

    try {
      const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
      const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
      if (!supabaseUrl || !anonKey) {
        setClientFormError('Erro de configuração do ambiente.');
        return;
      }

      const tempPassword = crypto.randomUUID().slice(0, 12);

      const response = await fetch(`${supabaseUrl}/functions/v1/${SUPABASE_EDGE_FUNCTIONS.CREATE_USER}`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password: tempPassword,
          name,
          role: newClientForm.accessLevel,
          org_id: selectedOrg.id,
          unit: ServiceUnit.ADMINISTRATIVO,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setClientFormError(`Erro ao criar cliente: ${result.error || 'desconhecido'}`);
        return;
      }

      if (result.process_warning) {
        console.warn('[create-client] aviso do processo:', result.process_warning);
      }

      await fetchClients();
      resetNewClientForm();
      setShowCreateClientModal(false);
      showToast({ type: 'success', message: `Cliente ${name} cadastrado com sucesso. Os dados de acesso foram enviados por e-mail.` });
    } catch (fetchErr: any) {
      setClientFormError(`Erro ao comunicar com o servidor: ${fetchErr?.message || 'desconhecido'}`);
    } finally {
      setCreatingClient(false);
    }
  };

  const handleStartEditClient = async (client: ClientProfileView) => {
    setEditingClient(client);
    setClientEditError('');
    setClientEditSuccess('');

    const baseForm: EditClientFormState = {
      fullName: client.nome,
      email: client.email === 'sem-email@nao-informado' ? '' : client.email,
      phone: '',
      documentId: '',
      taxId: '',
      address: '',
      country: 'Brasil',
      maritalStatus: 'Solteiro',
      organizationId: client.org_id,
      accessLevel: client.accessLevel,
    };

    setEditClientForm(baseForm);
    setShowEditClientModal(true);

    if (client.user_id.startsWith('local-')) {
      const localUser = users.find((user) => user.id === client.user_id);
      if (!localUser) return;
      setEditClientForm({
        fullName: localUser.name || baseForm.fullName,
        email: localUser.email || baseForm.email,
        phone: localUser.phone === '---' ? '' : localUser.phone,
        documentId: localUser.documentId === '---' ? '' : localUser.documentId,
        taxId: localUser.taxId === '---' ? '' : localUser.taxId,
        address: localUser.address === '---' ? '' : localUser.address,
        country: localUser.country === '---' ? 'Brasil' : localUser.country,
        maritalStatus: localUser.maritalStatus === '---' ? 'Solteiro' : localUser.maritalStatus,
        organizationId: localUser.organizationId || baseForm.organizationId,
        accessLevel: client.accessLevel,
      });
      return;
    }

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('nome_completo,email,phone,documento_identidade,nif_cpf,endereco,pais,estado_civil')
      .eq('id', client.user_id)
      .maybeSingle();

    if (error) {
      setClientEditError('Não foi possível carregar todos os dados do cliente. Você ainda pode editar os campos disponíveis.');
      return;
    }

    if (!profileData) return;

    setEditClientForm({
      fullName: sanitizeDisplayValue(profileData.nome_completo) || baseForm.fullName,
      email: sanitizeDisplayValue(profileData.email) || baseForm.email,
      phone: sanitizeDisplayValue(profileData.phone),
      documentId: sanitizeDisplayValue(profileData.documento_identidade),
      taxId: sanitizeDisplayValue(profileData.nif_cpf),
      address: sanitizeDisplayValue(profileData.endereco),
      country: sanitizeDisplayValue(profileData.pais) || 'Brasil',
      maritalStatus: sanitizeDisplayValue(profileData.estado_civil) || 'Solteiro',
      organizationId: baseForm.organizationId,
      accessLevel: client.accessLevel,
    });
  };

  const handleSaveClientEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingClient) return;

    setClientEditError('');
    setClientEditSuccess('');

    const selectedOrg = organizations.find((org) => org.id === editClientForm.organizationId);
    if (!selectedOrg) {
      setClientEditError('Selecione uma organização válida.');
      return;
    }

    const normalizedName = sanitizeDisplayValue(editClientForm.fullName);
    if (!normalizedName) {
      setClientEditError('Informe o nome do cliente.');
      return;
    }

    setSavingClientEdit(true);

    try {
      if (editingClient.user_id.startsWith('local-')) {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === editingClient.user_id
              ? {
                  ...user,
                  name: normalizedName,
                  email: sanitizeDisplayValue(editClientForm.email) || user.email,
                  phone: sanitizeDisplayValue(editClientForm.phone) || '---',
                  documentId: sanitizeDisplayValue(editClientForm.documentId) || '---',
                  taxId: sanitizeDisplayValue(editClientForm.taxId) || '---',
                  address: sanitizeDisplayValue(editClientForm.address) || '---',
                  country: sanitizeDisplayValue(editClientForm.country) || '---',
                  maritalStatus: sanitizeDisplayValue(editClientForm.maritalStatus) || '---',
                  organizationId: selectedOrg.id,
                  organizationName: selectedOrg.name,
                }
              : user
          )
        );
      } else {
        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({
            nome_completo: normalizedName,
            name: normalizedName,
            email: sanitizeDisplayValue(editClientForm.email) || null,
            phone: sanitizeDisplayValue(editClientForm.phone) || null,
            documento_identidade: sanitizeDisplayValue(editClientForm.documentId) || null,
            nif_cpf: sanitizeDisplayValue(editClientForm.taxId) || null,
            endereco: sanitizeDisplayValue(editClientForm.address) || null,
            pais: sanitizeDisplayValue(editClientForm.country) || null,
            estado_civil: sanitizeDisplayValue(editClientForm.maritalStatus) || null,
            role: editClientForm.accessLevel,
            org_id: selectedOrg.id,
          })
          .eq('id', editingClient.user_id);

        if (updateProfileError) {
          setClientEditError('Não foi possível atualizar os dados de perfil do cliente.');
          return;
        }

        const { error: upsertMemberError } = await supabase
          .from('org_members')
          .upsert(
            {
              org_id: selectedOrg.id,
              user_id: editingClient.user_id,
              role: mapAccessLevelToOrgRole(editClientForm.accessLevel),
            },
            { onConflict: 'org_id,user_id' }
          );

        if (upsertMemberError) {
          setClientEditError('Perfil atualizado, mas houve erro ao atualizar vínculo da organização.');
          return;
        }
      }

      setClientsData((prev) =>
        prev.map((client) =>
          client.id === editingClient.id
            ? {
                ...client,
                nome: normalizedName,
                email: sanitizeDisplayValue(editClientForm.email) || 'sem-email@nao-informado',
                org_id: selectedOrg.id,
                org_name: selectedOrg.name,
                accessLevel: editClientForm.accessLevel,
              }
            : client
        )
      );

      setClientEditSuccess('Cadastro do cliente atualizado com sucesso.');
      setShowEditClientModal(false);
      setEditingClient(null);
      await fetchClients();
    } finally {
      setSavingClientEdit(false);
    }
  };

  const handleDeleteClient = async (client: ClientProfileView) => {
    if (!window.confirm(`Deseja realmente remover ${client.nome} da lista de clientes?`)) return;

    if (client.user_id.startsWith('local-')) {
      setClientsData((prev) => prev.filter((c) => c.id !== client.id));
      setUsers((prev) => prev.filter((user) => user.id !== client.user_id));
      return;
    }

    const { error: deleteError } = await supabase
      .from('org_members')
      .delete()
      .eq('user_id', client.user_id)
      .eq('org_id', client.org_id);

    if (deleteError) {
      showToast({ type: 'error', message: `Erro ao remover ${client.nome} da organização.` });
      return;
    }

    await fetchClients();
    showToast({ type: 'success', message: `Cliente ${client.nome} removido com sucesso.` });
  };

  const extractOrganizationName = (
    organizations: { name?: string } | Array<{ name?: string }> | null | undefined
  ) => {
    if (Array.isArray(organizations)) {
      return sanitizeDisplayValue(organizations[0]?.name) || null;
    }
    return sanitizeDisplayValue(organizations?.name) || null;
  };

  return (
    <>
      <DashboardCardContainer className="p-6">
        <h3 className="text-lg font-black mb-4">CLIENTES</h3>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-3 text-gray-500 w-4 h-4" />
            <input
              value={clientsSearch}
              onChange={(event) => setClientsSearch(event.target.value)}
              placeholder="Buscar por nome..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
            />
          </div>
          <select
            value={clientsSort}
            onChange={(event) => setClientsSort(event.target.value as 'name_asc' | 'name_desc' | 'recent')}
            className="w-full py-2 px-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
          >
            <option value="name_asc">Ordenar: Nome (A-Z)</option>
            <option value="name_desc">Ordenar: Nome (Z-A)</option>
            <option value="recent">Ordenar: Mais recentes</option>
          </select>
          <select
            value={clientsRowsLimit}
            onChange={(event) => setClientsRowsLimit(Number(event.target.value))}
            className="w-full py-2 px-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
          >
            <option value={10}>Mostrar 10</option>
            <option value={25}>Mostrar 25</option>
            <option value={50}>Mostrar 50</option>
          </select>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          {clientsError && <p className="text-sm text-amber-600 font-bold">{clientsError}</p>}
          <div className="flex items-center gap-3 text-xs text-gray-500 font-bold ml-auto">
            <span>Total: {clientsData.length}</span>
            <span>Exibindo: {visibleClients.length}</span>
          </div>
          <button
            onClick={() => {
              resetNewClientForm();
              setShowCreateClientModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase rounded-lg transition-colors"
          >
            + Novo Cliente
          </button>
        </div>

        {clientsLoading ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-6"><TableSkeleton rows={4} cols={6} /></div>
        ) : visibleClients.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-500">Nenhum membro encontrado</p>
            <p className="text-xs text-gray-400 mt-1">Nenhum cliente ou usuário corresponde aos critérios atuais.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-100 bg-gray-50">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                    <th className="px-3 sm:px-6 py-2 sm:py-4">Usuário</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-4">Nível</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-4">Organização</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-4">Email</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-4">Origem</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {visibleClients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-2 sm:py-4 font-bold text-gray-800">{client.nome}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4">
                        <span className="text-[10px] font-black text-blue-400 uppercase border border-blue-900/50 bg-blue-900/10 px-2 py-0.5 rounded">{client.accessLevel}</span>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-gray-600 font-bold whitespace-nowrap">{client.org_name}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-gray-500 font-bold">{client.email}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-gray-400 text-[10px] font-bold uppercase whitespace-nowrap">
                        {client.source === 'local_manual' ? 'Manual' : client.source === 'org_members+profiles' ? 'Sistema' : 'Sistema'}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => void handleStartEditClient(client)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-500 hover:text-white transition-colors" title="Editar cliente"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => void handleDeleteClient(client)} className="p-2 bg-red-900/20 hover:bg-red-900/40 rounded-md text-red-500 transition-colors" title="Remover cliente"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="block md:hidden space-y-3">
              {visibleClients.map((client) => (
                <div key={client.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{client.nome}</p>
                      <span className="text-[10px] font-black text-blue-400 uppercase border border-blue-900/50 bg-blue-900/10 px-2 py-0.5 rounded inline-block mt-1">{client.accessLevel}</span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => void handleStartEditClient(client)} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => void handleDeleteClient(client)} className="p-1.5 bg-red-100 hover:bg-red-200 rounded-md text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <p><span className="font-semibold text-gray-400">Email:</span> {client.email}</p>
                    <p><span className="font-semibold text-gray-400">Organização:</span> {client.org_name}</p>
                    <p><span className="font-semibold text-gray-400">Origem:</span> {client.source === 'local_manual' ? 'Manual' : client.source === 'org_members+profiles' ? 'Sistema' : 'Sistema'}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </DashboardCardContainer>

      {showCreateClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-3xl border border-gray-100 shadow-2xl overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-black uppercase">Cadastrar novo cliente</h3>
              <button
                onClick={() => {
                  setShowCreateClientModal(false);
                  setClientFormError('');
                  setClientFormSuccess('');
                }}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 hover:scale-105 active:scale-95 transition-transform"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {clientFormSuccess && (
                <div className="mb-6 p-4 bg-emerald-900/20 border border-emerald-700 rounded-xl">
                  <p className="text-sm font-bold text-emerald-300">{clientFormSuccess}</p>
                </div>
              )}
              <form onSubmit={handleCreateClient} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">Nome completo *</label>
                    <input
                      value={newClientForm.fullName}
                      onChange={(e) => setNewClientForm((prev) => ({ ...prev, fullName: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                      placeholder="Nome do cliente"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">E-mail *</label>
                    <input
                      value={newClientForm.email}
                      onChange={(e) => setNewClientForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">Telefone *</label>
                    <input
                      value={newClientForm.phone}
                      onChange={(e) => setNewClientForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">Documento de Identidade</label>
                    <input
                      value={newClientForm.documentId}
                      onChange={(e) => setNewClientForm((prev) => ({ ...prev, documentId: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                      placeholder="RG / Documento"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">NIF / CPF *</label>
                    <input
                      value={newClientForm.taxId}
                      onChange={(e) => setNewClientForm((prev) => ({ ...prev, taxId: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">Estado Civil</label>
                    <select
                      value={newClientForm.maritalStatus}
                      onChange={(e) => setNewClientForm((prev) => ({ ...prev, maritalStatus: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                    >
                      <option>Solteiro</option>
                      <option>Casado</option>
                      <option>Divorciado</option>
                      <option>Viúvo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">País</label>
                    <input
                      value={newClientForm.country}
                      onChange={(e) => setNewClientForm((prev) => ({ ...prev, country: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                      placeholder="Brasil"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">Organização *</label>
                    <select
                      value={newClientForm.organizationId}
                      onChange={(e) => setNewClientForm((prev) => ({ ...prev, organizationId: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                    >
                      <option value="">Selecione a organização</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-gray-500 mb-2 block">Endereço *</label>
                    <input
                      value={newClientForm.address}
                      onChange={(e) => setNewClientForm((prev) => ({ ...prev, address: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                      placeholder="Endereço completo"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">Nível de Acesso *</label>
                    <select
                      value={newClientForm.accessLevel}
                      onChange={(e) => setNewClientForm((prev) => ({ ...prev, accessLevel: e.target.value as AccessLevel }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                    >
                      {ACCESS_LEVELS.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2 pt-2">
                    <p className="text-xs font-semibold text-gray-400 italic">
                      Os dados de acesso serão enviados automaticamente para o e-mail informado.
                    </p>
                  </div>
                </div>
                {clientFormError && (
                  <p className="text-sm font-bold text-red-500">{clientFormError}</p>
                )}
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreateClientModal(false);
                      setClientFormError('');
                      setClientFormSuccess('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex items-center gap-2" disabled={creatingClient}>
                    <Check className="w-4 h-4" /> {creatingClient ? 'Salvando...' : 'Salvar cliente'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditClientModal && editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-3xl border border-gray-100 shadow-2xl overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-black uppercase">Editar cadastro do cliente</h3>
                <p className="text-xs font-semibold text-gray-500 mt-1">
                  Origem: {editingClient.source === 'org_members+profiles' ? 'org_members + profiles' : editingClient.source === 'org_members_only' ? 'somente org_members' : 'cadastro manual'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEditClientModal(false);
                  setEditingClient(null);
                  setClientEditError('');
                  setClientEditSuccess('');
                }}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 hover:scale-105 active:scale-95 transition-transform"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <p className="text-xs font-semibold text-gray-400 mb-4">
                ID do cliente: <span className="font-black text-gray-800">{editingClient.user_id}</span>
              </p>

              {clientEditSuccess && (
                <div className="mb-6 p-4 bg-emerald-900/20 border border-emerald-700 rounded-xl">
                  <p className="text-sm font-bold text-emerald-300">{clientEditSuccess}</p>
                </div>
              )}

              <form onSubmit={handleSaveClientEdit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">Nome completo *</label>
                    <input
                      value={editClientForm.fullName}
                      onChange={(e) => setEditClientForm((prev) => ({ ...prev, fullName: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">E-mail</label>
                    <input
                      value={editClientForm.email}
                      onChange={(e) => setEditClientForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">Telefone</label>
                    <input
                      value={editClientForm.phone}
                      onChange={(e) => setEditClientForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">Documento de Identidade</label>
                    <input
                      value={editClientForm.documentId}
                      onChange={(e) => setEditClientForm((prev) => ({ ...prev, documentId: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">NIF / CPF</label>
                    <input
                      value={editClientForm.taxId}
                      onChange={(e) => setEditClientForm((prev) => ({ ...prev, taxId: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">Estado Civil</label>
                    <select
                      value={editClientForm.maritalStatus}
                      onChange={(e) => setEditClientForm((prev) => ({ ...prev, maritalStatus: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                    >
                      <option>Solteiro</option>
                      <option>Casado</option>
                      <option>Divorciado</option>
                      <option>Viúvo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">País</label>
                    <input
                      value={editClientForm.country}
                      onChange={(e) => setEditClientForm((prev) => ({ ...prev, country: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">Organização *</label>
                    <select
                      value={editClientForm.organizationId}
                      onChange={(e) => setEditClientForm((prev) => ({ ...prev, organizationId: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                    >
                      <option value="">Selecione a organização</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-gray-500 mb-2 block">Endereço</label>
                    <input
                      value={editClientForm.address}
                      onChange={(e) => setEditClientForm((prev) => ({ ...prev, address: e.target.value }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">Nível de Acesso *</label>
                    <select
                      value={editClientForm.accessLevel}
                      onChange={(e) => setEditClientForm((prev) => ({ ...prev, accessLevel: e.target.value as AccessLevel }))}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                    >
                      {ACCESS_LEVELS.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {clientEditError && <p className="text-sm font-bold text-red-500">{clientEditError}</p>}
                {clientEditSuccess && <p className="text-sm font-bold text-emerald-600">{clientEditSuccess}</p>}

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowEditClientModal(false);
                      setEditingClient(null);
                      setClientEditError('');
                      setClientEditSuccess('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={savingClientEdit} className="flex items-center gap-2">
                    <Check className="w-4 h-4" /> {savingClientEdit ? 'Salvando...' : 'Salvar alterações'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ClientsSection;
