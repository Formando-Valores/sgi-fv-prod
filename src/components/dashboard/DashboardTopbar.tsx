import React from 'react';

interface DashboardTopbarProps {
  title: React.ReactNode;
  subtitle: string;
  actions?: React.ReactNode;
}

const DashboardTopbar: React.FC<DashboardTopbarProps> = ({ title, subtitle, actions }) => {
  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 no-print">
      <div>
        <h1 className="text-2xl font-black text-gray-800 tracking-tighter flex items-center gap-2">{title}</h1>
        <p className="text-gray-500 text-xs font-bold uppercase mt-1">{subtitle}</p>
      </div>
      {actions}
    </header>
  );
};

export default DashboardTopbar;
