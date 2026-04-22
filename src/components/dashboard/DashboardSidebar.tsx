import React from 'react';
import { NavLink } from 'react-router-dom';

type SidebarLink = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

interface DashboardSidebarProps {
  sidebarOpen: boolean;
  onNavigate: () => void;
  userName: string;
  hierarchyLabel: string;
  links: SidebarLink[];
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ sidebarOpen, onNavigate, userName, hierarchyLabel, links }) => {
  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-72 shrink-0 bg-white border border-gray-100 rounded-r-2xl lg:rounded-2xl p-5 h-full lg:h-fit transition-transform duration-300 shadow-sm ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
    >
      <h2 className="text-xl font-black mb-1 text-gray-800">SGI FV</h2>
      <p className="text-gray-500 text-xs font-bold uppercase mb-6">Formando Valores</p>

      <div className="mb-6 p-3 rounded-xl bg-gray-50 border border-gray-200">
        <p className="font-bold text-gray-800">{userName}</p>
        <p className="text-[10px] uppercase tracking-widest text-gray-500">{hierarchyLabel.toUpperCase()}</p>
      </div>

      <nav className="space-y-2">
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isActive ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'}`}
          >
            <item.icon className="w-4 h-4" />
            <span className="font-bold">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default DashboardSidebar;
