import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Search, User as UserIcon, Building2 } from 'lucide-react';

type SidebarLink = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type ProfileSearchResult = Record<string, unknown>;

interface DashboardSidebarProps {
  sidebarOpen: boolean;
  onNavigate: () => void;
  onSelectSection?: (section: string) => void;
  onLogout?: () => void;
  userName: string;
  hierarchyLabel: string;
  orgName?: string;
  links: SidebarLink[];
  /** Profile search for impersonation (admin only) */
  showProfileSearch?: boolean;
  profileSearchQuery?: string;
  onProfileSearchChange?: (query: string) => void;
  profileSearchResults?: ProfileSearchResult[];
  profileSearchOpen?: boolean;
  isSearching?: boolean;
  profileSearchRef?: React.RefObject<HTMLDivElement>;
  onSelectProfile?: (profile: ProfileSearchResult) => void;
  /** Organizações disponíveis para seleção de contexto (admin) */
  impersonateAvailableOrgs?: Array<{ org_id: string; role?: string; organizations?: unknown }>;
  /** ID da org selecionada no modo impersonation */
  impersonatingOrgId?: string | null;
  /** Callback ao trocar de org no modo impersonation */
  onSwitchImpersonatedOrg?: (orgId: string) => void;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  sidebarOpen, onNavigate, onSelectSection, onLogout,
  userName, hierarchyLabel, orgName, links,
  showProfileSearch, profileSearchQuery, onProfileSearchChange,
  profileSearchResults, profileSearchOpen, isSearching,
  profileSearchRef, onSelectProfile,
  impersonateAvailableOrgs, impersonatingOrgId, onSwitchImpersonatedOrg,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  console.log('[DashboardSidebar] links:', links.map(l => l.to).join(', '));

  const renderUserInfo = () => (
    <div className="mb-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
      <p className="font-bold text-gray-800">{userName}</p>
      <p className="text-[10px] uppercase tracking-widest text-gray-500">
        {hierarchyLabel.toUpperCase()}{orgName ? ` | ${orgName.toUpperCase()}` : ''}
      </p>
    </div>
  );

  const renderProfileSearch = () => {
    if (!showProfileSearch) return null;
    return (
      <div ref={profileSearchRef as React.RefObject<HTMLDivElement>} className="relative mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar perfil..."
            value={profileSearchQuery || ''}
            onChange={(e) => onProfileSearchChange?.(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {profileSearchOpen && profileSearchResults && profileSearchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[60] max-h-72 overflow-y-auto">
            {profileSearchResults.map((profile) => (
              <button
                key={profile.id as string}
                type="button"
                onClick={() => onSelectProfile?.(profile)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
              >
                <UserIcon className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{profile.nome_completo as string || 'Sem nome'}</p>
                  <p className="text-xs text-gray-500 truncate">{profile.email as string}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                      {profile.org_role === 'owner' ? 'Proprietário' : profile.org_role === 'admin' ? 'Admin' : profile.org_role === 'staff' ? 'Staff' : 'Cliente'}
                    </span>
                    {profile.org_name && (
                      <span className="text-[10px] text-gray-400 truncate">{profile.org_name as string}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        {profileSearchOpen && (profileSearchQuery?.length ?? 0) >= 3 && (profileSearchResults?.length ?? 0) === 0 && !isSearching && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[60] p-4 text-center text-sm text-gray-500">
            Nenhum perfil encontrado para &quot;{profileSearchQuery}&quot;
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-72 shrink-0 bg-white border border-gray-100 rounded-r-2xl lg:rounded-2xl p-5 h-full lg:h-fit transition-transform duration-300 shadow-sm ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
    >
      <h2 className="text-xl font-black mb-1 text-gray-800">SGI FV</h2>
      <p className="text-gray-500 text-xs font-bold uppercase mb-6">Formando Valores</p>

      {renderUserInfo()}
      {renderProfileSearch()}
      {showProfileSearch && impersonateAvailableOrgs && impersonateAvailableOrgs.length > 0 && (
        <div className="mb-4">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Organização</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={impersonatingOrgId || ''}
              onChange={(e) => onSwitchImpersonatedOrg?.(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold text-gray-700 appearance-none cursor-pointer"
            >
              <option value="">Selecione uma organização</option>
              {impersonateAvailableOrgs.map((membership) => {
                const orgName = (membership.organizations as { name?: string } | undefined)?.name || membership.org_id;
                return (
                  <option key={membership.org_id} value={membership.org_id}>{orgName}</option>
                );
              })}
            </select>
          </div>
        </div>
      )}

      <nav className="space-y-2">
        {links.map((item) => {
          const isActive = currentPath === item.to || (item.to !== '/dashboard' && currentPath.startsWith(item.to));
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => {
                console.log('[Sidebar] clicked:', item.label, 'to:', item.to);
                const sectionFromPath = item.to.split('/')[2] || 'dashboard';
                console.log('[Sidebar] calling onSelectSection:', sectionFromPath);
                onSelectSection?.(sectionFromPath);
                console.log('[Sidebar] calling navigate:', item.to);
                navigate(item.to);
                onNavigate();
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all min-w-0 w-full text-left ${isActive ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'}`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="font-bold truncate">{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => { onLogout?.(); onNavigate(); }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 text-red-500 hover:bg-red-50 hover:border-red-100 transition-all w-full font-bold"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair</span>
        </button>
      </nav>
    </aside>
  );
};

export default DashboardSidebar;
