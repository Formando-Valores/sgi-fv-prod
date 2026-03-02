
import React, { useEffect, useState } from 'react';
import { LogOut, Printer, FileDown, Eye, Pencil, Search, Users, ShieldCheck, X, Plus, Trash2, Calendar, MessageSquare, Check, User as UserIcon, UserCheck, LayoutDashboard, FolderKanban, Users2, Settings, Menu, Building2, PieChart, Wallet } from 'lucide-react';
import { User, ProcessStatus, UserRole, Hierarchy, ServiceUnit, Organization, AccessLevel } from '../types';
import { NavLink, useLocation } from 'react-router-dom';
import { ADMIN_CREDENTIALS, SERVICE_MANAGERS } from '../constants';
import { buildOrganizationErrorMessage, createOrganization, deleteOrganization, loadOrganizations, updateOrganizationActiveStatus } from '../organizationRepository';

interface AdminDashboardProps {
  currentUser: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onLogout: () => void;
  section?: 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes' | 'financeiro';
}

const ACCESS_LEVEL_OPTIONS = [
  AccessLevel.GENERAL_ADMIN,
  AccessLevel.SENIOR_USER,
  AccessLevel.PLENO_USER,
  AccessLevel.CLIENT,
] as const;

const ACCESS_LEVEL_DESCRIPTIONS: Record<AccessLevel, string> = {
  [AccessLevel.GENERAL_ADMIN]: 'Visão total da plataforma, financeiro e gestão de perfis.',
  [AccessLevel.SENIOR_USER]: 'Diretoria/Gerência da organização: agenda, equipe e distribuição autorizada.',
  [AccessLevel.PLENO_USER]: 'Execução técnica: atua nos clientes/processos atribuídos.',
  [AccessLevel.CLIENT]: 'Acesso restrito ao próprio processo e documentos.',
};

const mapAccessLevelToRole = (accessLevel: AccessLevel): UserRole => {
  if (accessLevel === AccessLevel.CLIENT) {
    return UserRole.CLIENT;
  }

  return UserRole.ADMIN;
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, users, setUsers, onLogout, section = 'dashboard' }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'management'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Management tab states
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminHierarchy, setNewAdminHierarchy] = useState<Hierarchy>(Hierarchy.FULL);
  const [newUserAccessLevel, setNewUserAccessLevel] = useState<AccessLevel>(AccessLevel.SENIOR_USER);
  const [editingHierarchyUser, setEditingHierarchyUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationName, setOrganizationName] = useState('');
  const [orgError, setOrgError] = useState('');
  const [orgSuccess, setOrgSuccess] = useState('');
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);
  const [organizationDeletingId, setOrganizationDeletingId] = useState<string | null>(null);
  const [organizationTogglingId, setOrganizationTogglingId] = useState<string | null>(null);
  const [financialOrganizationFilter, setFinancialOrganizationFilter] = useState<string>('all');
  const [financialUserFilter, setFinancialUserFilter] = useState<string>('all');
  const [selectedFinancialId, setSelectedFinancialId] = useState<string | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [managementSearchTerm, setManagementSearchTerm] = useState('');
  const [managementPageSize, setManagementPageSize] = useState<number>(10);
  const [managementPage, setManagementPage] = useState<number>(1);

  const location = useLocation();
  const currentSection = section ?? (location.pathname.split('/')[2] as 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes' | 'financeiro') ?? 'dashboard';



  const centralOrganization = organizations.find((organization) => {
    const normalizedSlug = organization.slug?.toLowerCase();
    const normalizedName = organization.name.toLowerCase();

    return normalizedSlug === 'default' || normalizedName === 'organização padrão';
  });

  const isCentralAdmin =
    currentUser.role === UserRole.ADMIN &&
    Boolean(
      (currentUser.organizationId && centralOrganization?.id && currentUser.organizationId === centralOrganization.id) ||
      currentUser.organizationName?.toLowerCase() === 'organização padrão'
    );

  const getUserAccessLevel = (user: User): AccessLevel => {
    if (user.accessLevel) {
      return user.accessLevel;
    }

    const userEmail = user.email?.toLowerCase();
    const isBootstrapGeneralAdmin = userEmail ? ADMIN_CREDENTIALS.includes(userEmail) : false;

    if (user.role === UserRole.CLIENT) {
      return AccessLevel.CLIENT;
    }

    return isBootstrapGeneralAdmin ? AccessLevel.GENERAL_ADMIN : AccessLevel.SENIOR_USER;
  };

  const canManageAccess = currentUser.role === UserRole.ADMIN;

  const organizationScopedUsers = isCentralAdmin
    ? users
    : currentUser.organizationId
      ? users.filter((user) => user.organizationId === currentUser.organizationId)
      : users;

  const managementScopedUsers = canManageAccess ? users : organizationScopedUsers;

  const managementFilteredUsers = managementScopedUsers.filter((user) => {
    const term = managementSearchTerm.trim().toLowerCase();

    if (!term) {
      return true;
    }

    return (
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      getUserAccessLevel(user).toLowerCase().includes(term)
    );
  });

  const managementTotalPages = Math.max(Math.ceil(managementFilteredUsers.length / managementPageSize), 1);
  const managementSafePage = Math.min(managementPage, managementTotalPages);
  const managementPageStart = (managementSafePage - 1) * managementPageSize;
  const managementPagedUsers = managementFilteredUsers.slice(
    managementPageStart,
    managementPageStart + managementPageSize
  );

  const organizationInsights = organizations
    .map((organization) => {
      const organizationClients = users.filter(
        (user) => user.organizationId === organization.id && getUserAccessLevel(user) === AccessLevel.CLIENT
      );

      const processCount = organizationClients.filter(
        (user) => Boolean(user.processNumber) || Boolean(user.protocol)
      ).length;

      return {
        ...organization,
        clientsCount: organizationClients.length,
        processCount,
      };
    })
    .sort((left, right) => right.clientsCount - left.clientsCount);

  const maxClientsCount = Math.max(...organizationInsights.map((item) => item.clientsCount), 1);

  const baseValueByStatus: Record<ProcessStatus, number> = {
    [ProcessStatus.PENDENTE]: 1800,
    [ProcessStatus.TRIAGEM]: 2600,
    [ProcessStatus.ANALISE]: 3400,
    [ProcessStatus.CONCLUIDO]: 5200,
  };

  const financialRows = organizationScopedUsers
    .filter((user) => getUserAccessLevel(user) !== AccessLevel.CLIENT)
    .map((user) => {
      const total = baseValueByStatus[user.status] ?? 1800;
      const paid = user.status === ProcessStatus.CONCLUIDO ? total : user.status === ProcessStatus.ANALISE ? total * 0.6 : total * 0.25;
      const pending = Math.max(total - paid, 0);

      return {
        id: user.id,
        userName: user.name,
        organizationId: user.organizationId ?? 'sem-org',
        organizationName: user.organizationName ?? 'Não informado',
        protocol: user.protocol,
        status: user.status,
        total,
        paid,
        pending,
      };
    });

  const filteredFinancialRows = financialRows.filter((row) => {
    const byOrg = financialOrganizationFilter === 'all' || row.organizationId === financialOrganizationFilter;
    const byUser = financialUserFilter === 'all' || row.id === financialUserFilter;
    return byOrg && byUser;
  });

  const financialTotal = filteredFinancialRows.reduce((acc, row) => acc + row.total, 0);
  const financialPaid = filteredFinancialRows.reduce((acc, row) => acc + row.paid, 0);
  const financialPending = filteredFinancialRows.reduce((acc, row) => acc + row.pending, 0);
  const selectedFinancialRow = filteredFinancialRows.find((row) => row.id === selectedFinancialId) ?? filteredFinancialRows[0] ?? null;

  const piePaid = financialTotal > 0 ? Math.round((financialPaid / financialTotal) * 100) : 0;
  const piePending = Math.max(100 - piePaid, 0);

  const dashboardUserRows = organizationScopedUsers.slice(0, 6);
  const dashboardProcessRows = organizationScopedUsers.map((user) => ({
    id: user.id,
    userName: user.name,
    protocol: user.protocol,
    status: user.status,
    value: baseValueByStatus[user.status] ?? 1800,
  }));

  const selectedDashboardProcess =
    dashboardProcessRows.find((row) => row.id === selectedProcessId) ?? dashboardProcessRows[0] ?? null;

  const dashboardStats = {
    activeUsers: organizationScopedUsers.filter((user) => getUserAccessLevel(user) !== AccessLevel.CLIENT).length,
    activeProcesses: organizationScopedUsers.filter((user) => user.status !== ProcessStatus.CONCLUIDO).length,
    completedProcesses: organizationScopedUsers.filter((user) => user.status === ProcessStatus.CONCLUIDO).length,
    totalValue: dashboardProcessRows.reduce((acc, row) => acc + row.value, 0),
  };

  const processStatusTotal = Math.max(dashboardProcessRows.length, 1);
  const processDistribution = {
    triagem: Math.round((dashboardProcessRows.filter((row) => row.status === ProcessStatus.TRIAGEM).length / processStatusTotal) * 100),
    analise: Math.round((dashboardProcessRows.filter((row) => row.status === ProcessStatus.ANALISE).length / processStatusTotal) * 100),
    concluido: Math.round((dashboardProcessRows.filter((row) => row.status === ProcessStatus.CONCLUIDO).length / processStatusTotal) * 100),
    pendente: Math.round((dashboardProcessRows.filter((row) => row.status === ProcessStatus.PENDENTE).length / processStatusTotal) * 100),
  };

  const processPieSlices = {
    triagem: processDistribution.triagem,
    analise: processDistribution.triagem + processDistribution.analise,
    concluido: processDistribution.triagem + processDistribution.analise + processDistribution.concluido,
  };


  const sidebarLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/dashboard/processos', label: 'Processos', icon: FolderKanban },
    { to: '/dashboard/clientes', label: 'Clientes', icon: Users2 },
    { to: '/dashboard/configuracoes', label: 'Configurações', icon: Settings },
    { to: '/dashboard/organizacoes', label: 'Organizações', icon: Building2 },
    { to: '/dashboard/financeiro', label: 'Financeiro', icon: Wallet },
  ];

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (currentSection === 'configuracoes') {
      setActiveTab('management');
      return;
    }

    if (currentSection === 'dashboard') {
      setActiveTab('users');
    }
  }, [currentSection]);

  useEffect(() => {
    setManagementPage(1);
  }, [managementSearchTerm, managementPageSize]);

  const filteredUsers = organizationScopedUsers.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.protocol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdateStatus = (userId: string, status: ProcessStatus, deadline?: string, notes?: string, serviceManager?: string) => {
    const timestamp = new Date().toLocaleString('pt-BR');
    setUsers(prev => prev.map(u => 
      u.id === userId ? { ...u, status, deadline, notes, serviceManager, lastUpdate: timestamp } : u
    ));
    setEditingUser(null);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();

    if (!canManageAccess) {
      setOrgError('Somente o Administrador Geral pode alterar nível de acesso de usuários.');
      setOrgSuccess('');
      return;
    }

    if (!newAdminEmail || !newAdminName) return;

    const existing = users.find(u => u.email === newAdminEmail);
    if (existing) {
       setUsers(prev => prev.map(u => 
         u.email === newAdminEmail ? { ...u, name: newAdminName, role: mapAccessLevelToRole(newUserAccessLevel), accessLevel: newUserAccessLevel, hierarchy: newAdminHierarchy } : u
       ));
    } else {
       const newUser: User = {
         id: Date.now().toString(),
         name: newAdminName,
         email: newAdminEmail,
         role: mapAccessLevelToRole(newUserAccessLevel),
         accessLevel: newUserAccessLevel,
         hierarchy: newAdminHierarchy,
         documentId: '---',
         taxId: '---',
         address: '---',
         maritalStatus: '---',
         country: '---',
         phone: '---',
         unit: ServiceUnit.ADMINISTRATIVO,
         status: ProcessStatus.PENDENTE,
         protocol: `ADM-2026-ADM`,
         registrationDate: new Date().toLocaleString('pt-BR'),
         lastUpdate: new Date().toLocaleString('pt-BR'),
       };
       setUsers(prev => [...prev, newUser]);
    }
    setNewAdminEmail('');
    setNewAdminName('');
    setNewUserAccessLevel(AccessLevel.SENIOR_USER);
    alert('Usuário definido com sucesso.');
  };

  const handleUpdateHierarchy = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingHierarchyUser) return;

    if (!canManageAccess) {
      setOrgError('Somente o Administrador Geral pode alterar nível de acesso de usuários.');
      setOrgSuccess('');
      return;
    }

    const fd = new FormData(e.currentTarget);
    const hierarchy = fd.get('hierarchy') as Hierarchy;
    const name = fd.get('admin_name') as string;
    const accessLevel = fd.get('access_level') as AccessLevel;

    setUsers(prev => prev.map(u =>
      u.id === editingHierarchyUser.id
        ? { ...u, hierarchy, name, accessLevel, role: mapAccessLevelToRole(accessLevel) }
        : u
    ));
    setEditingHierarchyUser(null);
  };

  const handleDeleteUser = (id: string) => {
    if (!canManageAccess) {
      setOrgError('Somente o Administrador Geral pode excluir usuários administrativos.');
      setOrgSuccess('');
      return;
    }

    if(window.confirm('Deseja realmente excluir este usuário?')) {
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDateTime = (value?: string) => {
    if (!value) {
      return 'Não informado';
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return value;
    }

    return parsedDate.toLocaleString('pt-BR');
  };

  useEffect(() => {
    const fetchOrganizations = async () => {
      const { organizations: loadedOrganizations, error } = await loadOrganizations();

      if (error) {
        console.warn('[organizacoes] erro ao carregar organizações', error);
        setOrgError(buildOrganizationErrorMessage(error));
        return;
      }

      setOrgError('');
      setOrganizations(loadedOrganizations);
    };

    fetchOrganizations();
  }, []);

  const handleCreateOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOrgError('');
    setOrgSuccess('');

    if (!organizationName.trim()) {
      setOrgError('Informe o nome da organização.');
      return;
    }

    setIsCreatingOrganization(true);

    const { organization, error } = await createOrganization(organizationName);

    setIsCreatingOrganization(false);

    if (error || !organization) {
      console.error('[organizacoes] erro ao cadastrar organização', error);
      setOrgError(buildOrganizationErrorMessage(error));
      return;
    }

    setOrganizations((prev) => [...prev, organization].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')));
    setOrganizationName('');
    setOrgSuccess('Organização cadastrada com sucesso.');
  };


  const isCentralOrganization = (organization: Organization) => organization.id === centralOrganization?.id;

  const handleDeleteOrganization = async (organization: Organization) => {
    if (isCentralOrganization(organization)) {
      setOrgError('A organização central (slug default) não pode ser excluída.');
      setOrgSuccess('');
      return;
    }

    if (!window.confirm('Deseja realmente excluir esta organização?')) {
      return;
    }

    setOrgError('');
    setOrgSuccess('');
    setOrganizationDeletingId(organization.id);

    const { error, deleted } = await deleteOrganization(organization.id);

    setOrganizationDeletingId(null);

    if (error || !deleted) {
      setOrgError(buildOrganizationErrorMessage(error));
      return;
    }

    setOrganizations((prev) => prev.filter((item) => item.id !== organization.id));
    setOrgSuccess('Organização excluída com sucesso.');
  };



  const handleToggleOrganizationStatus = async (organization: Organization) => {
    if (isCentralOrganization(organization)) {
      setOrgError('A organização central não pode ser desativada.');
      setOrgSuccess('');
      return;
    }

    setOrgError('');
    setOrgSuccess('');
    setOrganizationTogglingId(organization.id);

    const targetActive = organization.active === undefined ? false : !organization.active;
    const { error, updated } = await updateOrganizationActiveStatus(organization.id, targetActive);

    setOrganizationTogglingId(null);

    if (error || !updated) {
      setOrgError(buildOrganizationErrorMessage(error));
      return;
    }

    setOrganizations((prev) => prev.map((item) => item.id === organization.id ? { ...item, active: targetActive } : item));
    setOrgSuccess(`Organização ${targetActive ? 'ativada' : 'inativada'} com sucesso.`);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="mx-auto max-w-[1600px] flex flex-col lg:flex-row gap-6">
        <div className="lg:hidden mb-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {sidebarOpen && (
          <button
            className="lg:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          />
        )}

        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-72 bg-slate-900 border border-slate-800 rounded-r-2xl lg:rounded-2xl p-5 h-full lg:h-fit transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        >
          <h2 className="text-xl font-black mb-1">SGI FV</h2>
          <p className="text-slate-500 text-xs font-bold uppercase mb-6">Formando Valores</p>

          <div className="mb-6 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="font-bold text-slate-200">{currentUser.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">{getUserAccessLevel(currentUser)}</p>
          </div>

          <nav className="space-y-2">
            {sidebarLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isActive ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600'}`}
              >
                <item.icon className="w-4 h-4" />
                <span className="font-bold">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex-1 lg:pl-0">
      {/* Admin Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tighter flex items-center gap-2">
            <ShieldCheck className="text-red-500" /> SGI FV - PAINEL ADMINISTRATIVO
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase mt-1">Bem-vindo, {currentUser.name}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handlePrint} 
            title="Clique para Imprimir Documento"
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors flex items-center gap-2 px-4 text-xs font-bold uppercase"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button 
            onClick={handlePrint} 
            title="Clique para Salvar como PDF"
            className="p-2 bg-blue-900/40 hover:bg-blue-900/60 rounded-lg text-blue-300 transition-colors flex items-center gap-2 px-4 text-xs font-bold uppercase border border-blue-800"
          >
            <FileDown className="w-4 h-4" /> Gerar PDF
          </button>
          <button onClick={onLogout} className="p-2 bg-red-900/20 hover:bg-red-900/40 rounded-lg text-red-400 transition-colors flex items-center gap-2 px-4 text-xs font-bold uppercase">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      {(currentSection === 'dashboard' || currentSection === 'configuracoes') && (
        <>
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 mb-6 gap-8 no-print">
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'users' ? 'text-blue-500' : 'text-slate-500'}`}
        >
          Visualização de Usuários
          {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('management')}
          className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'management' ? 'text-blue-500' : 'text-slate-500'}`}
        >
          Gestão de Acessos
          {activeTab === 'management' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full"></div>}
        </button>
          </div>
        </>
      )}


      {currentSection === 'organizacoes' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-black mb-4">CADASTRAR ORGANIZAÇÃO</h3>
            <form onSubmit={handleCreateOrganization} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 mb-2 block">Nome da organização</label>
                <input
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  className="w-full p-3 bg-gray-900 border border-slate-700 rounded-lg text-white font-bold"
                  placeholder="Ex.: Organização Alpha"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 mb-2 block">Expiração da assinatura (em breve)</label>
                <input
                  disabled
                  value="Em breve: integração com pagamento"
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 text-sm"
                />
              </div>
              {isCreatingOrganization && <p className="text-sm text-blue-300 font-bold">Cadastrando organização...</p>}
              {orgError && <p className="text-sm text-red-400 font-bold">{orgError}</p>}
              {orgSuccess && <p className="text-sm text-emerald-400 font-bold">{orgSuccess}</p>}
              <button type="submit" disabled={isCreatingOrganization} className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 font-bold">
                {isCreatingOrganization ? 'Cadastrando...' : 'Salvar organização'}
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-black mb-4">ORGANIZAÇÕES CADASTRADAS</h3>
            <div className="space-y-3">
              {organizations.map((organization) => (
                <div key={organization.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{organization.name}</p>
                      <p className="text-xs text-slate-400">Cadastro em: {formatDateTime(organization.createdAt)}</p>
                      <p className="text-xs text-slate-500">Expiração da assinatura: {formatDateTime(organization.subscriptionExpiresAt)}</p>
                      <p className="text-xs text-slate-400">Status: <span className={`font-bold ${organization.active === false ? 'text-red-300' : 'text-emerald-300'}`}>{organization.active === false ? 'Inativa' : 'Ativa'}</span></p>
                      {isCentralOrganization(organization) && (
                        <p className="text-[11px] text-amber-300 font-bold mt-1">Organização central protegida contra exclusão.</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleOrganizationStatus(organization)}
                      disabled={organizationTogglingId === organization.id || isCentralOrganization(organization)}
                      className={`p-2 rounded-lg disabled:bg-slate-800 disabled:text-slate-500 ${organization.active === false ? 'bg-red-900/30 hover:bg-red-900/50 text-red-300' : 'bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300'}`}
                      title={organization.active === false ? 'Ativar organização' : 'Inativar organização'}
                    >
                      <Check className={`w-4 h-4 ${organization.active === false ? 'text-red-300' : 'text-emerald-300'}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOrganization(organization)}
                      disabled={organizationDeletingId === organization.id || isCentralOrganization(organization)}
                      className="p-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 disabled:bg-slate-800 disabled:text-slate-500 text-red-300"
                      title={isCentralOrganization(organization) ? 'Organização central não pode ser excluída' : 'Excluir organização'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {organizations.length === 0 && (
                <p className="text-slate-400 text-sm">Nenhuma organização cadastrada ainda.</p>
              )}
            </div>
          </div>
        </div>
      
      ) : currentSection === 'financeiro' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p className="text-xs text-slate-400 uppercase">Valor total</p><p className="text-2xl font-black text-blue-300">R$ {financialTotal.toLocaleString('pt-BR')}</p></div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p className="text-xs text-slate-400 uppercase">Recebido</p><p className="text-2xl font-black text-emerald-300">R$ {financialPaid.toLocaleString('pt-BR')}</p></div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p className="text-xs text-slate-400 uppercase">Pendente</p><p className="text-2xl font-black text-amber-300">R$ {financialPending.toLocaleString('pt-BR')}</p></div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p className="text-xs text-slate-400 uppercase">Registros</p><p className="text-2xl font-black text-slate-100">{filteredFinancialRows.length}</p></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:col-span-2">
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <select value={financialOrganizationFilter} onChange={(event) => setFinancialOrganizationFilter(event.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                  <option value="all">Todas as organizações</option>
                  {organizations.map((org) => (<option key={org.id} value={org.id}>{org.name}</option>))}
                </select>
                <select value={financialUserFilter} onChange={(event) => setFinancialUserFilter(event.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                  <option value="all">Todos os usuários</option>
                  {financialRows.map((row) => (<option key={row.id} value={row.id}>{row.userName}</option>))}
                </select>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {filteredFinancialRows.map((row) => (
                  <button key={row.id} type="button" onClick={() => setSelectedFinancialId(row.id)} className={`w-full text-left p-3 rounded-xl border ${selectedFinancialRow?.id === row.id ? 'border-blue-500 bg-blue-900/20' : 'border-slate-800 bg-slate-950'}`}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="font-bold">{row.userName} • {row.organizationName}</p>
                      <p className="text-xs text-slate-400">{row.protocol}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Total: <span className="text-blue-300 font-bold">R$ {row.total.toLocaleString('pt-BR')}</span> • Recebido: <span className="text-emerald-300 font-bold">R$ {row.paid.toLocaleString('pt-BR')}</span> • Pendente: <span className="text-amber-300 font-bold">R$ {row.pending.toLocaleString('pt-BR')}</span></p>
                  </button>
                ))}
                {filteredFinancialRows.length === 0 && <p className="text-sm text-slate-400">Nenhum registro para os filtros selecionados.</p>}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="font-black uppercase text-sm tracking-wider mb-4 flex items-center gap-2"><PieChart className="w-4 h-4 text-blue-400" /> Proporção financeira</h3>
              <div className="w-48 h-48 mx-auto rounded-full" style={{ background: `conic-gradient(#34d399 0 ${piePaid}%, #f59e0b ${piePaid}% 100%)` }} />
              <div className="mt-4 text-sm space-y-1">
                <p><span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-2" />Recebido: <strong>{piePaid}%</strong></p>
                <p><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-2" />Pendente: <strong>{piePending}%</strong></p>
              </div>
              {selectedFinancialRow && (
                <div className="mt-5 pt-4 border-t border-slate-800 text-xs text-slate-300 space-y-1">
                  <p className="font-bold text-slate-100">Detalhe selecionado</p>
                  <p>Usuário: {selectedFinancialRow.userName}</p>
                  <p>Organização: {selectedFinancialRow.organizationName}</p>
                  <p>Status: {selectedFinancialRow.status}</p>
                  <p>Protocolo: {selectedFinancialRow.protocol}</p>
                </div>
              )}
            </div>
          </div>
        </div>
) : currentSection === 'processos' ? (

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-black mb-4">PROCESSOS</h3>
          <p className="text-slate-400 text-sm mb-4">Visão rápida dos processos cadastrados.</p>
          <div className="space-y-3">
            {organizationScopedUsers.map((user) => (
              <div key={user.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="font-bold">{user.name}</span>
                <span className="text-xs text-slate-400">{user.protocol} • {user.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : currentSection === 'clientes' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-black mb-4">CLIENTES</h3>
          <div className="space-y-3">
            {organizationScopedUsers.filter((user) => user.role !== UserRole.ADMIN).map((user) => (
              <div key={user.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="font-bold">{user.name}</p>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'users' ? (
        <>
          {currentSection === 'dashboard' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Usuários Ativos</p>
                  <p className="text-3xl font-black text-blue-300 mt-2">{dashboardStats.activeUsers}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Processos Ativos</p>
                  <p className="text-3xl font-black text-amber-300 mt-2">{dashboardStats.activeProcesses}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Processos Concluídos</p>
                  <p className="text-3xl font-black text-emerald-300 mt-2">{dashboardStats.completedProcesses}</p>
                </div>
                <div className="bg-emerald-900/40 border border-emerald-700 rounded-2xl p-5">
                  <p className="text-xs uppercase tracking-wider text-emerald-100">Valor Geral</p>
                  <p className="text-3xl font-black text-emerald-200 mt-2">R$ {dashboardStats.totalValue.toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-blue-900/50 border-b border-slate-800">
                    <h3 className="font-black">Gestão de Usuários</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-2 text-left">Nome</th>
                          <th className="px-4 py-2 text-left">E-mail</th>
                          <th className="px-4 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {dashboardUserRows.map((user) => (
                          <tr key={user.id}>
                            <td className="px-4 py-3 font-bold">{user.name}</td>
                            <td className="px-4 py-3 text-slate-400">{user.email}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold ${user.status === ProcessStatus.CONCLUIDO ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/40 text-amber-300'}`}>
                                {user.status === ProcessStatus.CONCLUIDO ? 'Ativo' : 'Em andamento'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="xl:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-blue-900/50 border-b border-slate-800">
                    <h3 className="font-black">Gestão de Processos</h3>
                  </div>
                  <div className="space-y-2 p-4">
                    {dashboardProcessRows.slice(0, 5).map((row) => (
                      <button key={row.id} type="button" onClick={() => setSelectedProcessId(row.id)} className={`w-full text-left p-3 rounded-xl border ${selectedProcessId === row.id ? 'border-blue-500 bg-blue-900/20' : 'border-slate-800 bg-slate-950'}`}>
                        <p className="font-bold text-sm">{row.protocol}</p>
                        <p className="text-xs text-slate-400">{row.userName}</p>
                        <p className="text-xs text-emerald-300 font-bold mt-1">R$ {row.value.toLocaleString('pt-BR')}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <h3 className="font-black mb-3">Detalhes do Processo</h3>
                  {selectedDashboardProcess ? (
                    <div className="text-sm space-y-2">
                      <p className="font-bold">{selectedDashboardProcess.protocol}</p>
                      <p className="text-slate-400">Responsável: {selectedDashboardProcess.userName}</p>
                      <p>Status: <span className="font-bold text-blue-300">{selectedDashboardProcess.status}</span></p>
                      <p>Valor: <span className="font-bold text-emerald-300">R$ {selectedDashboardProcess.value.toLocaleString('pt-BR')}</span></p>
                      <button type="button" className="mt-3 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold">Gerar Gráfico de Pizza</button>
                    </div>
                  ) : <p className="text-slate-400 text-sm">Selecione um processo para ver detalhes.</p>}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="font-black mb-4">Distribuição dos Processos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="w-56 h-56 mx-auto rounded-full" style={{ background: `conic-gradient(#3b82f6 0 ${processPieSlices.triagem}%, #f59e0b ${processPieSlices.triagem}% ${processPieSlices.analise}%, #22c55e ${processPieSlices.analise}% ${processPieSlices.concluido}%, #8b5cf6 ${processPieSlices.concluido}% 100%)` }} />
                  <div className="space-y-2 text-sm">
                    <p><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2" />Triagem: <strong>{processDistribution.triagem}%</strong></p>
                    <p><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2" />Análise: <strong>{processDistribution.analise}%</strong></p>
                    <p><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2" />Concluído: <strong>{processDistribution.concluido}%</strong></p>
                    <p><span className="inline-block w-2 h-2 rounded-full bg-violet-500 mr-2" />Cadastro: <strong>{processDistribution.pendente}%</strong></p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-2.5 text-slate-500 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Pesquise Por: Nome, Protocolo ou E-mail"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-slate-800 rounded-full text-white text-sm font-bold placeholder:text-slate-600 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[10px] font-black uppercase">Total de Registros:</span>
                  <span className="bg-slate-800 px-2 py-0.5 rounded-md text-blue-400 font-bold text-xs">{filteredUsers.length}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                      <th className="px-6 py-4">Nome Completo</th>
                      <th className="px-6 py-4">Telefone+DDD+País</th>
                      <th className="px-6 py-4">Protocolo SGI</th>
                      <th className="px-6 py-4">Status do Processo</th>
                      <th className="px-6 py-4">Última Alteração</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-200">{user.name}</td>
                        <td className="px-6 py-4 text-slate-400 font-bold">{user.phone} ({user.country})</td>
                        <td className="px-6 py-4">
                          <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded-md text-[10px] font-black">{user.protocol}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${
                            user.status === ProcessStatus.PENDENTE ? 'bg-slate-600' :
                            user.status === ProcessStatus.TRIAGEM ? 'bg-yellow-600' :
                            user.status === ProcessStatus.ANALISE ? 'bg-orange-600' : 'bg-emerald-600'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-[10px] font-bold">
                          {user.lastUpdate || user.registrationDate}
                        </td>
                        <td className="px-6 py-4 text-right no-print">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setSelectedUser(user)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-300">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingUser(user)} className="p-1.5 bg-blue-900/30 hover:bg-blue-900/50 rounded-md text-blue-400">
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
) : (
        /* Management Tab Content */
        <div className="space-y-4">
          {!canManageAccess && (
            <p className="text-xs font-bold text-amber-300">Somente usuários ADMIN podem promover/rebaixar níveis de usuários.</p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Plus className="text-blue-500" /> Cadastrar Usuário e Nível
              </h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nome de Usuário</label>
                    <input 
                      required
                      type="text"
                      placeholder="Nome do Gestor"
                      value={newAdminName}
                      onChange={e => setNewAdminName(e.target.value)}
                      className="w-full bg-gray-900 border border-slate-800 rounded-lg p-3 text-white font-bold" 
                    />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">E-mail</label>
                    <input 
                      required
                      type="email"
                      placeholder="admin@sgi.com"
                      value={newAdminEmail}
                      onChange={e => setNewAdminEmail(e.target.value)}
                      className="w-full bg-gray-900 border border-slate-800 rounded-lg p-3 text-white font-bold" 
                    />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Perfil de Acesso</label>
                    <select
                      value={newUserAccessLevel}
                      onChange={(event) => setNewUserAccessLevel(event.target.value as AccessLevel)}
                      disabled={!canManageAccess}
                      className="w-full bg-gray-900 border border-slate-800 rounded-lg p-3 text-white font-bold disabled:opacity-60"
                    >
                      {ACCESS_LEVEL_OPTIONS.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">{ACCESS_LEVEL_DESCRIPTIONS[newUserAccessLevel]}</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Hierarquia / Nível</label>
                    <div className="space-y-3 mt-2">
                       {Object.values(Hierarchy).map(h => (
                         <label key={h} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer group">
                           <input 
                            type="radio" 
                            name="new_hierarchy" 
                            className="w-4 h-4 accent-blue-500" 
                            checked={newAdminHierarchy === h}
                            onChange={() => setNewAdminHierarchy(h)}
                           /> 
                           <span className="group-hover:text-white transition-colors">{h}</span>
                         </label>
                       ))}
                    </div>
                 </div>
                 <button type="submit" disabled={!canManageAccess} className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold rounded-lg uppercase text-xs tracking-widest mt-4 shadow-lg active:scale-95 transition-transform">
                    Cadastrar / Definir
                 </button>
              </form>
           </div>

           <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <span>Mostrar</span>
                  <select
                    value={managementPageSize}
                    onChange={(event) => setManagementPageSize(Number(event.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  >
                    {[5, 10, 20, 50].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-2.5 text-slate-500 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={managementSearchTerm}
                    onChange={(event) => setManagementSearchTerm(event.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                      <th className="px-6 py-4">Usuário / Adm</th>
                      <th className="px-6 py-4">Nível de Acesso</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {managementPagedUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-800/30">
                        <td className="px-6 py-4 font-bold flex flex-col">
                           <span>{u.name}</span>
                           <span className="text-[10px] text-slate-500">{u.email}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black text-blue-400 uppercase border border-blue-900/50 bg-blue-900/10 px-2 py-0.5 rounded">
                            {getUserAccessLevel(u)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => setEditingHierarchyUser(u)}
                                disabled={!canManageAccess}
                                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteUser(u.id)} 
                                disabled={!canManageAccess}
                                className="p-2 bg-red-900/20 hover:bg-red-900/40 rounded-md text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
              <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>
                  {managementFilteredUsers.length === 0
                    ? '0 usuários'
                    : `${managementPageStart + 1} - ${Math.min(managementPageStart + managementPageSize, managementFilteredUsers.length)} de ${managementFilteredUsers.length} usuários`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setManagementPage((prev) => Math.max(prev - 1, 1))}
                    disabled={managementSafePage <= 1}
                    className="px-2 py-1 rounded bg-slate-800 disabled:opacity-40"
                  >
                    {'<'}
                  </button>
                  <span>{managementSafePage}/{managementTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setManagementPage((prev) => Math.min(prev + 1, managementTotalPages))}
                    disabled={managementSafePage >= managementTotalPages}
                    className="px-2 py-1 rounded bg-slate-800 disabled:opacity-40"
                  >
                    {'>'}
                  </button>
                </div>
              </div>
           </div>
          </div>
        </div>
      )}

      {/* Hierarchy Edit Modal */}
      {editingHierarchyUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 w-full max-w-md rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
             <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
               <h3 className="text-xl font-black uppercase">Editar Perfil de Usuário</h3>
               <button onClick={() => setEditingHierarchyUser(null)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full">
                 <X className="w-5 h-5" />
               </button>
             </div>
             <div className="p-8">
                <form onSubmit={handleUpdateHierarchy}>
                  <p className="text-slate-400 text-sm mb-6">Alterando dados para <strong>{editingHierarchyUser.email}</strong></p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Nome de Usuário</label>
                      <input 
                        required
                        name="admin_name"
                        type="text"
                        defaultValue={editingHierarchyUser.name}
                        className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 mb-4" 
                      />
                    </div>

                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Perfil de acesso</label>
                    <select
                      name="access_level"
                      defaultValue={getUserAccessLevel(editingHierarchyUser)}
                      className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                    >
                      {ACCESS_LEVEL_OPTIONS.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>

                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Hierarquia / Nível</label>
                    {Object.values(Hierarchy).map(h => (
                      <label key={h} className="flex items-center gap-3 p-4 bg-gray-900 border border-slate-800 rounded-xl cursor-pointer hover:border-blue-500 transition-colors">
                        <input 
                          type="radio" 
                          name="hierarchy" 
                          value={h} 
                          defaultChecked={editingHierarchyUser.hierarchy === h} 
                          className="w-5 h-5 accent-blue-500" 
                        />
                        <span className="font-bold text-slate-200">{h}</span>
                      </label>
                    ))}
                    <button type="submit" disabled={!canManageAccess} className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl mt-4">
                      Confirmar Alteração
                    </button>
                  </div>
                </form>
             </div>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
             <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
               <h3 className="text-xl font-black uppercase">Ficha Cadastral do Cliente</h3>
               <button onClick={() => setSelectedUser(null)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full">
                 <X className="w-5 h-5" />
               </button>
             </div>
             <div className="p-8 overflow-y-auto">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">Nome Completo</label>
                      <p className="text-lg font-black">{selectedUser.name}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">E-mail</label>
                      <p className="font-bold text-blue-400">{selectedUser.email}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">Documento / NIF-CPF</label>
                      <p className="font-bold">{selectedUser.documentId} / {selectedUser.taxId}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">Estado Civil / País</label>
                      <p className="font-bold">{selectedUser.maritalStatus} - {selectedUser.country}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">Protocolo SGI</label>
                      <p className="text-lg font-black text-emerald-400">{selectedUser.protocol}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">Unidade Atendimento</label>
                      <p className="font-bold text-blue-300">{selectedUser.unit}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">Processo Judicial</label>
                      <p className="font-bold">{selectedUser.processNumber || 'NÃO INFORMADO'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">Status Atual</label>
                      <p className="font-black text-orange-500 uppercase">{selectedUser.status}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-800">
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Endereço Completo</label>
                  <p className="font-bold p-4 bg-gray-900 rounded-xl">{selectedUser.address}</p>
                </div>
                {selectedUser.notes && (
                  <div className="mt-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Observações Internas</label>
                    <p className="font-bold p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl text-blue-200 italic">"{selectedUser.notes}"</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
        </div>
      </div>

      {/* Edit Status Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
             <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
               <h3 className="text-xl font-black uppercase">Editar Status: {editingUser.protocol}</h3>
               <button onClick={() => setEditingUser(null)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full">
                 <X className="w-5 h-5" />
               </button>
             </div>
             <div className="p-8">
                <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  handleUpdateStatus(
                    editingUser.id, 
                    fd.get('status') as ProcessStatus,
                    fd.get('deadline') as string,
                    fd.get('notes') as string,
                    fd.get('serviceManager') as string
                  );
                }}>
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Alterar Status do Processo</label>
                      <select name="status" defaultValue={editingUser.status} className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none ring-blue-500 focus:ring-2">
                        {Object.values(ProcessStatus).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block flex items-center gap-2">
                        <UserCheck className="w-3 h-3" /> Gestor do Serviço
                      </label>
                      <select name="serviceManager" defaultValue={editingUser.serviceManager} className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none ring-blue-500 focus:ring-2">
                        <option value="">Selecione um gestor</option>
                        {SERVICE_MANAGERS.map(manager => (
                          <option key={manager} value={manager}>{manager}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> Data de Prazo
                      </label>
                      <input name="deadline" type="date" defaultValue={editingUser.deadline} className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" /> Nota de Observações
                      </label>
                      <textarea name="notes" rows={4} defaultValue={editingUser.notes} className="w-full bg-gray-900 border border-slate-800 rounded-xl p-4 text-white font-bold resize-none" placeholder="Digite as anotações do processo..."></textarea>
                    </div>
                    <button type="submit" className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all">
                      Salvar Alterações
                    </button>
                  </div>
                </form>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
