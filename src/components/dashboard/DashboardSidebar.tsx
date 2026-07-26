import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Eye, Shield, Building2, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [collapsed, setCollapsed] = useState(false);
  const isViewingAsDifferent = showRoleSwitcher && accessLevel && originalRoleLabel && accessLevel !== originalRoleLabel;

  const renderUserInfo = () => (
    <div className="mb-4 px-3 py-3 rounded-xl bg-surface-50 border border-surface-200/60">
      <p className="font-bold text-surface-800 text-sm truncate">{userName}</p>
      <p className="text-[10px] uppercase tracking-wider text-surface-400 font-semibold mt-0.5 truncate">
        {hierarchyLabel}{orgName ? ` · ${orgName}` : ''}
      </p>
    </div>
  );

  const renderRoleSwitcher = () => {
    if (!showRoleSwitcher) return null;
    return (
      <div className={`mb-3 px-3 py-2.5 rounded-xl border transition-colors ${isViewingAsDifferent ? 'bg-amber-50 border-amber-200' : 'bg-surface-50 border-surface-200/60'}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <Shield className="w-3.5 h-3.5 text-surface-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400">Ver como</span>
        </div>
        <select
          value={accessLevel || 'Administrador'}
          onChange={(e) => onAccessLevelChange?.(e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs bg-white border border-surface-200 rounded-lg font-semibold text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer transition-colors"
        >
          {ACCESS_LEVELS.map((level) => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
        {isViewingAsDifferent && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Eye className="w-3 h-3 text-amber-600" />
            <span className="text-[11px] text-amber-700 font-medium">Ver como {accessLevel}</span>
          </div>
        )}
      </div>
    );
  };

  const renderOrgSelector = () => {
    if (!showRoleSwitcher) return null;
    return (
      <div className="mb-3 px-3 py-2.5 rounded-xl border bg-surface-50 border-surface-200/60">
        <div className="flex items-center gap-2 mb-1.5">
          <Building2 className="w-3.5 h-3.5 text-surface-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400">Organização</span>
        </div>
        <select
          value={activeOrgId || ''}
          onChange={(e) => onSwitchOrg?.(e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs bg-white border border-surface-200 rounded-lg font-semibold text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer transition-colors"
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
      className={`
        fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
        ${collapsed ? 'w-[68px]' : 'w-64'}
        shrink-0 bg-white border-r border-surface-200/60 shadow-sidebar
        transition-all duration-300 ease-in-out
        flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Header */}
      <div className={`px-4 py-5 border-b border-surface-100 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="min-w-0 animate-fade-in">
            <h2 className="text-base font-extrabold text-surface-800 tracking-tight">SGI FV</h2>
            <p className="text-[10px] text-surface-400 font-semibold uppercase tracking-wider">Formando Valores</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors shrink-0"
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {!collapsed && renderUserInfo()}
        {!collapsed && renderRoleSwitcher()}
        {!collapsed && renderOrgSelector()}

        {/* Navigation */}
        <nav className="space-y-1">
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
                className={`
                  flex items-center gap-3 w-full text-left rounded-xl transition-all duration-150
                  ${collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'}
                  ${isActive
                    ? 'bg-brand-50 text-brand-700 font-bold shadow-sm ring-1 ring-brand-200/40'
                    : 'text-surface-500 hover:bg-surface-50 hover:text-surface-700 font-medium'
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-brand-600' : ''}`} />
                {!collapsed && <span className="text-sm truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className={`px-3 py-3 border-t border-surface-100 ${collapsed ? 'flex justify-center' : ''}`}>
        <button
          type="button"
          onClick={() => { onLogout?.(); onNavigate(); }}
          className={`
            flex items-center gap-3 w-full rounded-xl transition-all duration-150
            text-surface-400 hover:bg-red-50 hover:text-red-600 font-medium
            ${collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'}
          `}
          title={collapsed ? 'Sair' : undefined}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span className="text-sm">Sair</span>}
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
