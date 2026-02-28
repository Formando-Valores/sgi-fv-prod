
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { User, UserRole } from './types';
import { INITIAL_MOCK_USERS } from './constants';

const parseStorageItem = <T,>(key: string, fallback: T): T => {
  const rawValue = localStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.error(`[storage] valor inválido para ${key}, limpando item`, error);
    localStorage.removeItem(key);
    return fallback;
  }
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    parseStorageItem<User | null>('sgi_current_user', null)
  );

  const [users, setUsers] = useState<User[]>(() =>
    parseStorageItem<User[]>('sgi_users', INITIAL_MOCK_USERS)
  );

  useEffect(() => {
    localStorage.setItem('sgi_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('sgi_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('sgi_current_user');
    }
  }, [currentUser]);

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-[#0f172a] text-white font-arial">
        <Routes>
          <Route 
            path="/login" 
            element={currentUser ? <Navigate to="/dashboard" /> : <Login setCurrentUser={setCurrentUser} users={users} />} 
          />
          <Route 
            path="/register" 
            element={currentUser ? <Navigate to="/dashboard" /> : <Register setUsers={setUsers} setCurrentUser={setCurrentUser} />} 
          />
          <Route 
            path="/dashboard" 
            element={
              currentUser ? (
                currentUser.role === UserRole.ADMIN ? (
                  <AdminDashboard currentUser={currentUser} users={users} setUsers={setUsers} onLogout={handleLogout} />
                ) : (
                  <UserDashboard currentUser={currentUser} onLogout={handleLogout} />
                )
              ) : (
                <Navigate to="/login" />
              )
            } 
          />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </HashRouter>
  );
};

export default App;
