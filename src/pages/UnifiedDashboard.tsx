import React from 'react';
import AdminDashboard from '../../pages/AdminDashboard';
import { User } from '../../types';
import { getAllowedModules, resolvePermissions } from '../lib/permissions';
import OverviewBlock from '../components/dashboard/blocks/OverviewBlock';
import ProcessesBlock from '../components/dashboard/blocks/ProcessesBlock';
import ClientsBlock from '../components/dashboard/blocks/ClientsBlock';
import OrganizationsBlock from '../components/dashboard/blocks/OrganizationsBlock';
import ClientJourneyBlock from '../components/dashboard/blocks/ClientJourneyBlock';

interface UnifiedDashboardProps {
  currentUser: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onLogout: () => void;
  section?: 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes';
}

const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({
  currentUser,
  users,
  setUsers,
  onLogout,
  section = 'dashboard',
}) => {
  const permissions = resolvePermissions(currentUser);
  const allowedModules = getAllowedModules(permissions);
  const EmptyBlock: React.FC<{ children: React.ReactNode }> = () => null;

  return (
    <AdminDashboard
      currentUser={currentUser}
      users={users}
      setUsers={setUsers}
      onLogout={onLogout}
      section={section}
      blocks={{
        OverviewBlock,
        ProcessesBlock: allowedModules.includes('processos') ? ProcessesBlock : EmptyBlock,
        ClientsBlock: allowedModules.includes('clientes') ? ClientsBlock : EmptyBlock,
        OrganizationsBlock: allowedModules.includes('organizacoes') ? OrganizationsBlock : EmptyBlock,
        ClientJourneyBlock: allowedModules.includes('clientes') ? ClientJourneyBlock : EmptyBlock,
      }}
    />
  );
};

export default UnifiedDashboard;
