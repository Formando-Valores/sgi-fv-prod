
import React, { useEffect, useState } from 'react';
import { LogOut, Printer, FileDown, Eye, Pencil, Search, Users, ShieldCheck, X, Plus, Trash2, Calendar, MessageSquare, Check, User as UserIcon, UserCheck, LayoutDashboard, FolderKanban, Users2, Settings, Menu, Building2 } from 'lucide-react';
import { User, ProcessStatus, UserRole, Hierarchy, ServiceUnit, Organization } from '../types';
import { NavLink, useLocation } from 'react-router-dom';
import { SERVICE_MANAGERS } from '../constants';
import { buildOrganizationErrorMessage, createOrganization, loadOrganizations } from '../organizationRepository';

interface AdminDashboardProps {
  currentUser: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onLogout: () => void;
  section?: 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes';
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, users, setUsers, onLogout, section = 'dashboard' }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'management'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Management tab states
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminHierarchy, setNewAdminHierarchy] = useState<Hierarchy>(Hierarchy.FULL);
  const [editingHierarchyUser, setEditingHierarchyUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationName, setOrganizationName] = useState('');
  const [orgError, setOrgError] = useState('');

  const location = useLocation();
  const currentSection = section ?? (location.pathname.split('/')[2] as 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes') ?? 'dashboard';

  const sidebarLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/dashboard/processos', label: 'Processos', icon: FolderKanban },
    { to: '/dashboard/clientes', label: 'Clientes', icon: Users2 },
    { to: '/dashboard/configuracoes', label: 'Configurações', icon: Settings },
    { to: '/dashboard/organizacoes', label: 'Organizações', icon: Building2 },
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

  const filteredUsers = users.filter(u => 
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
    if (!newAdminEmail || !newAdminName) return;

    const existing = users.find(u => u.email === newAdminEmail);
    if (existing) {
       setUsers(prev => prev.map(u => 
         u.email === newAdminEmail ? { ...u, name: newAdminName, role: UserRole.ADMIN, hierarchy: newAdminHierarchy } : u
       ));
    } else {
       const newUser: User = {
         id: Date.now().toString(),
         name: newAdminName,
         email: newAdminEmail,
         role: UserRole.ADMIN,
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
    alert('Usuário administrativo definido com sucesso.');
  };

  const handleUpdateHierarchy = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingHierarchyUser) return;
    
    const fd = new FormData(e.currentTarget);
    const hierarchy = fd.get('hierarchy') as Hierarchy;
    const name = fd.get('admin_name') as string;

    setUsers(prev => prev.map(u => 
      u.id === editingHierarchyUser.id ? { ...u, hierarchy, name } : u
    ));
    setEditingHierarchyUser(null);
  };

  const handleDeleteUser = (id: string) => {
    if(window.confirm('Deseja realmente excluir este usuário?')) {
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  const handlePrint = () => {
    window.print();
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

    if (!organizationName.trim()) {
      setOrgError('Informe o nome da organização.');
      return;
    }

    const { organization, error } = await createOrganization(organizationName);

    if (error || !organization) {
      console.error('[organizacoes] erro ao cadastrar organização', error);
      setOrgError(buildOrganizationErrorMessage(error));
      return;
    }

    setOrganizations((prev) => [...prev, organization].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')));
    setOrganizationName('');
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
            <p className="text-[10px] uppercase tracking-widest text-slate-400">{currentUser.role === UserRole.ADMIN ? 'ADMIN' : 'CLIENTE'}</p>
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
              {orgError && <p className="text-sm text-red-400 font-bold">{orgError}</p>}
              <button type="submit" className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold">
                Salvar organização
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-black mb-4">ORGANIZAÇÕES CADASTRADAS</h3>
            <div className="space-y-3">
              {organizations.map((organization) => (
                <div key={organization.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <p className="font-bold">{organization.name}</p>
                  <p className="text-xs text-slate-400">ID: {organization.id}</p>
                </div>
              ))}
              {organizations.length === 0 && (
                <p className="text-slate-400 text-sm">Nenhuma organização cadastrada ainda.</p>
              )}
            </div>
          </div>
        </div>
      ) : currentSection === 'processos' ? (

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-black mb-4">PROCESSOS</h3>
          <p className="text-slate-400 text-sm mb-4">Visão rápida dos processos cadastrados.</p>
          <div className="space-y-3">
            {users.map((user) => (
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
            {users.filter((user) => user.role !== UserRole.ADMIN).map((user) => (
              <div key={user.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="font-bold">{user.name}</p>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'users' ? (
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
                        <button 
                          onClick={() => setSelectedUser(user)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-300"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setEditingUser(user)}
                          className="p-1.5 bg-blue-900/30 hover:bg-blue-900/50 rounded-md text-blue-400"
                        >
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
      ) : (
        /* Management Tab Content */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Plus className="text-blue-500" /> Cadastrar Usuário Administrativo
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
                 <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg uppercase text-xs tracking-widest mt-4 shadow-lg active:scale-95 transition-transform">
                    Cadastrar / Definir
                 </button>
              </form>
           </div>

           <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
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
                    {users.filter(u => u.role === UserRole.ADMIN || u.hierarchy).map(u => (
                      <tr key={u.id} className="hover:bg-slate-800/30">
                        <td className="px-6 py-4 font-bold flex flex-col">
                           <span>{u.name}</span>
                           <span className="text-[10px] text-slate-500">{u.email}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black text-blue-400 uppercase border border-blue-900/50 bg-blue-900/10 px-2 py-0.5 rounded">
                            {u.hierarchy || 'Acesso Total'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => setEditingHierarchyUser(u)}
                                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteUser(u.id)} 
                                className="p-2 bg-red-900/20 hover:bg-red-900/40 rounded-md text-red-500 transition-colors"
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
           </div>
        </div>
      )}

      {/* Hierarchy Edit Modal */}
      {editingHierarchyUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 w-full max-w-md rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
             <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
               <h3 className="text-xl font-black uppercase">Editar Gestor</h3>
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
                    <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl mt-4">
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
