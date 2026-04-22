import React from 'react';
import AdminDashboard from '../../pages/AdminDashboard';
import { User } from '../../types';

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
  return (
    <AdminDashboard
      currentUser={currentUser}
      users={users}
      setUsers={setUsers}
      onLogout={onLogout}
      section={section}
    />
  );
};

export default UnifiedDashboard;
