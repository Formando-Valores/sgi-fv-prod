import React from 'react';
import { User } from '../types';
import UnifiedDashboard from '../src/pages/UnifiedDashboard';

interface UserDashboardProps {
  currentUser: User;
  onLogout: () => void;
}

/**
 * Compat layer: client dashboard now delegates to the unified dashboard shell/blocks.
 * This keeps legacy imports alive while concentrating layout/permissions in one place.
 */
const UserDashboard: React.FC<UserDashboardProps> = ({ currentUser, onLogout }) => {
  const [users, setUsers] = React.useState<User[]>([currentUser]);

  React.useEffect(() => {
    setUsers((previous) => {
      const next = previous.filter((item) => item.id !== currentUser.id);
      return [currentUser, ...next];
    });
  }, [currentUser]);

  return (
    <UnifiedDashboard
      currentUser={currentUser}
      users={users}
      setUsers={setUsers}
      onLogout={onLogout}
      section="dashboard"
    />
  );
};

export default UserDashboard;
