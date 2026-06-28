import React from 'react';
import { Menu } from 'lucide-react';

interface DashboardTopbarProps {
  title: React.ReactNode;
  subtitle: string;
  actions?: React.ReactNode;
  onOpenSidebar?: () => void;
}

const DashboardTopbar: React.FC<DashboardTopbarProps> = ({ title, subtitle, actions, onOpenSidebar }) => {
  return (
    <header className="flex flex-row items-center gap-3 mb-8 no-print">
      <button
        onClick={onOpenSidebar}
        className="lg:hidden p-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-gray-800 tracking-tighter flex items-center gap-2">{title}</h1>
          <p className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase mt-0.5">{subtitle}</p>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </header>
  );
};

export default DashboardTopbar;