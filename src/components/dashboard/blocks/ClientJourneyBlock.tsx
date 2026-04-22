import React from 'react';

interface ClientJourneyBlockProps {
  children: React.ReactNode;
}

const ClientJourneyBlock: React.FC<ClientJourneyBlockProps> = ({ children }) => {
  return <>{children}</>;
};

export default ClientJourneyBlock;
