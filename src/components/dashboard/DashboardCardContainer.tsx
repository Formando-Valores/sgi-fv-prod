import React from 'react';

interface DashboardCardContainerProps {
  className?: string;
  children: React.ReactNode;
}

const DashboardCardContainer: React.FC<DashboardCardContainerProps> = ({ className = '', children }) => {
  return <div className={`bg-white border border-gray-100 rounded-2xl shadow-[0_16px_34px_rgba(15,23,42,0.08)] ${className}`}>{children}</div>;
};

export default DashboardCardContainer;
