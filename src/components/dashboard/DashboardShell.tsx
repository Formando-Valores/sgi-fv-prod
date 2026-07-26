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
    <div className="min-h-screen bg-surface-50 flex">
      {sidebarOpen && (
        <button
          className="lg:hidden fixed inset-0 bg-surface-900/30 backdrop-blur-sm z-40 transition-opacity"
          onClick={onCloseSidebar}
          aria-label="Fechar menu"
        />
      )}

      {sidebar}

      <main className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-30">{topbar}</div>
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default DashboardShell;
