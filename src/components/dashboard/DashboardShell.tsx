import React from 'react';

interface DashboardShellProps {
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
}

const DashboardShell: React.FC<DashboardShellProps> = ({
  sidebarOpen,
  onCloseSidebar,
  sidebar,
  topbar,
  children,
}) => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50 p-3 sm:p-4 md:p-8 text-gray-800">
      <div className="mx-auto flex min-w-0 max-w-[1600px] flex-col gap-4 sm:gap-6 lg:flex-row">
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