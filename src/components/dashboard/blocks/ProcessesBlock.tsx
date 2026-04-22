import React from 'react';

interface ProcessesBlockProps {
  children: React.ReactNode;
}

const ProcessesBlock: React.FC<ProcessesBlockProps> = ({ children }) => {
  return <>{children}</>;
};

export default ProcessesBlock;
