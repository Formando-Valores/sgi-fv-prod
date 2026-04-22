import React from 'react';

interface OrganizationsBlockProps {
  children: React.ReactNode;
}

const OrganizationsBlock: React.FC<OrganizationsBlockProps> = ({ children }) => {
  return <>{children}</>;
};

export default OrganizationsBlock;
