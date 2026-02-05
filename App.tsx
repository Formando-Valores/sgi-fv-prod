
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createClient } from "@supabase/supabase-js";
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { User, UserRole } from './types';
import { INITIAL_MOCK_USERS } from './constants';

// Inicialização do cliente Supabase conforme solicitado
export const supabase = createClient(
  "https://ktrrrqaqaljdcmxqdcff.supabase.co",
  "sb_publishable_ZcEU2_K18A4NU43hO4zPmA_N5SkuqO_"
);

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('sgi_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('sgi_users');
    return saved ? JSON.parse(saved) : INITIAL_MOCK_USERS;
  });

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
