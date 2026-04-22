import React from 'react';
import { Menu } from 'lucide-react';

interface DashboardShellProps {
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  onCloseSidebar: () => void;
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
}

const DashboardShell: React.FC<DashboardShellProps> = ({
  sidebarOpen,
  onOpenSidebar,
  onCloseSidebar,
  sidebar,
  topbar,
  children,
}) => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50 p-4 md:p-8 text-gray-800">
      <div className="mx-auto flex min-w-0 max-w-[1600px] flex-col gap-6 lg:flex-row">
        <div className="lg:hidden mb-3">
          <button
            onClick={onOpenSidebar}
            className="p-3 rounded-xl bg-white border border-gray-200 text-gray-700 shadow-sm"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {sidebarOpen && (
          <button
            className="lg:hidden fixed inset-0 bg-black/30 z-40"
            onClick={onCloseSidebar}
            aria-label="Fechar menu"
          />
        )}

        {sidebar}

        <div className="min-w-0 flex-1 lg:pl-0">
          {topbar}
          {children}
        </div>
      </div>
    </div>
  );
};

export default DashboardShell;
