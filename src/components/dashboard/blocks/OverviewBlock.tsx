import React from 'react';

interface OverviewBlockProps {
  children: React.ReactNode;
}

const OverviewBlock: React.FC<OverviewBlockProps> = ({ children }) => {
  return <>{children}</>;
};

export default OverviewBlock;
