import React from 'react';

interface DashboardCardContainerProps {
  className?: string;
  children: React.ReactNode;
}

const DashboardCardContainer: React.FC<DashboardCardContainerProps> = ({ className = '', children }) => {
  return (
    <div className={`bg-white border border-surface-200/60 rounded-2xl shadow-card ${className}`}>
      {children}
    </div>
  );
};

export default DashboardCardContainer;
