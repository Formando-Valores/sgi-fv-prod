import React from 'react';

interface ClientsBlockProps {
  children: React.ReactNode;
}

const ClientsBlock: React.FC<ClientsBlockProps> = ({ children }) => {
  return <>{children}</>;
};

export default ClientsBlock;
