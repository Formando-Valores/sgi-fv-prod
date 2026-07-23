import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Eye, Shield, Building2 } from 'lucide-react';

type SidebarLink = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ACCESS_LEVELS = ['Administrador', 'Usuário Sênior', 'Usuário Pleno', 'Operador', 'Cliente'] as const;

interface DashboardSidebarProps {
  sidebarOpen: boolean;
  onNavigate: () => void;
  onSelectSection?: (section: string) => void;
  onLogout?: () => void;
  userName: string;
  hierarchyLabel: string;
  orgName?: string;
  links: SidebarLink[];
  showRoleSwitcher?: boolean;
  accessLevel?: string;
  onAccessLevelChange?: (level: string) => void;
  originalRoleLabel?: string;
  availableOrgs?: Array<{ org_id: string; organizations?: { name?: string } }>;
  activeOrgId?: string | null;
  onSwitchOrg?: (orgId: string) => void;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  sidebarOpen, onNavigate, onSelectSection, onLogout,
  userName, hierarchyLabel, orgName, links,
  showRoleSwitcher, accessLevel, onAccessLevelChange, originalRoleLabel,
  availableOrgs, activeOrgId, onSwitchOrg,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const isViewingAsDifferent = showRoleSwitcher && accessLevel && originalRoleLabel && accessLevel !== originalRoleLabel;

  const renderUserInfo = () => (
    <div className="mb-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
      <p className="font-bold text-gray-800">{userName}</p>
      <p className="text-[10px] uppercase tracking-widest text-gray-500">
        {hierarchyLabel.toUpperCase()}{orgName ? ` | ${orgName.toUpperCase()}` : ''}
      </p>
    </div>
  );

  const renderRoleSwitcher = () => {
    if (!showRoleSwitcher) return null;

    return (
      <div className={`mb-4 p-3 rounded-xl border transition-colors ${isViewingAsDifferent ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Visualizar como</span>
        </div>
        <select
          value={accessLevel || 'Administrador'}
          onChange={(e) => onAccessLevelChange?.(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
        >
          {ACCESS_LEVELS.map((level) => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
        {isViewingAsDifferent && (
          <div className="flex items-center gap-2 mt-2">
            <Eye className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs text-amber-700 font-medium">Visualizando como {accessLevel}</span>
          </div>
        )}
      </div>
    );
  };

  const renderOrgSelector = () => {
    if (!showRoleSwitcher) return null;

    return (
      <div className="mb-4 p-3 rounded-xl border bg-gray-50 border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Organização</span>
        </div>
        <select
          value={activeOrgId || ''}
          onChange={(e) => onSwitchOrg?.(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
        >
          {availableOrgs?.filter((membership) => {
            const org = membership.organizations as Record<string, unknown> | undefined;
            return org?.is_active !== false;
          }).map((membership) => (
            <option key={membership.org_id} value={membership.org_id}>
              {membership.organizations?.name || membership.org_id}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-72 shrink-0 bg-white border border-gray-100 rounded-r-2xl lg:rounded-2xl p-5 h-full lg:h-fit transition-transform duration-300 shadow-sm flex flex-col overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
    >
      <h2 className="text-xl font-black mb-1 text-gray-800">SGI FV</h2>
      <p className="text-gray-500 text-xs font-bold uppercase mb-6">Formando Valores</p>

      {renderUserInfo()}
      {renderRoleSwitcher()}
      {renderOrgSelector()}

      <nav className="space-y-2 mt-auto">
        {links.map((item) => {
          const isActive = currentPath === item.to || (item.to !== '/dashboard' && currentPath.startsWith(item.to));
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => {
                const sectionFromPath = item.to.split('/')[2] || 'dashboard';
                onSelectSection?.(sectionFromPath);
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
