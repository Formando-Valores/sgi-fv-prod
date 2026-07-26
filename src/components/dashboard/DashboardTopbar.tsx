import React from 'react';
import { Menu, Bell } from 'lucide-react';

interface DashboardTopbarProps {
  title: React.ReactNode;
  subtitle: string;
  actions?: React.ReactNode;
  onOpenSidebar?: () => void;
}

const DashboardTopbar: React.FC<DashboardTopbarProps> = ({ title, subtitle, actions, onOpenSidebar }) => {
  return (
    <header className="glass border-b border-surface-200/60 px-4 sm:px-6 lg:px-8 no-print">
      <div className="flex items-center gap-3 h-16">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 rounded-xl text-surface-500 hover:bg-surface-100 hover:text-surface-700 active:scale-95 transition-all"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-surface-800 truncate flex items-center gap-2">
              {title}
            </h1>
            <p className="text-[11px] font-medium text-surface-400 uppercase tracking-wider truncate">
              {subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 rounded-xl text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            </button>
            {actions && <div className="flex-shrink-0">{actions}</div>}
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardTopbar;
