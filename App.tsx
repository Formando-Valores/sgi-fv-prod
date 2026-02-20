/**
 * SGI FV - Main Application Component
 * Sistema de Gestão Integrada - Formando Valores
 */

import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { User, UserRole, UserContext, userContextToLegacyUser, isAdmin } from './types';
import { INITIAL_MOCK_USERS } from './constants';
import { supabase } from './supabase';
import { getCurrentUserContext } from './src/lib/tenant';

const App: React.FC = () => {
  // Estado principal do usuário
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('sgi_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Estado de loading durante restore de sessão
  const [isLoading, setIsLoading] = useState(true);

  // Estado de usuários (mantido para compatibilidade com AdminDashboard)
  // TODO: Migrar para queries Supabase
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('sgi_users');
    return saved ? JSON.parse(saved) : INITIAL_MOCK_USERS;
  });

  // Restaurar sessão do Supabase ao carregar
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Verificar se há sessão ativa no Supabase
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Tentar carregar contexto completo
          const userContext = await getCurrentUserContext();
          
          if (userContext) {
            // Converter para formato legacy e salvar
            const legacyUser = userContextToLegacyUser(userContext);
            setCurrentUser(legacyUser);
            localStorage.setItem('sgi_current_user', JSON.stringify(legacyUser));
          } else {
            // Usuário autenticado mas sem membership - limpar sessão local
            console.log('Usuário sem membership - limpando sessão');
            localStorage.removeItem('sgi_current_user');
            setCurrentUser(null);
          }
        } else {
          // Sem sessão Supabase - limpar localStorage se existir
          if (localStorage.getItem('sgi_current_user')) {
            localStorage.removeItem('sgi_current_user');
            setCurrentUser(null);
          }
        }
      } catch (error) {
        console.error('Erro ao restaurar sessão:', error);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();

    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event);
        
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('sgi_current_user');
          setCurrentUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Persistir users no localStorage
  useEffect(() => {
    localStorage.setItem('sgi_users', JSON.stringify(users));
  }, [users]);

  // Persistir currentUser no localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('sgi_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('sgi_current_user');
    }
  }, [currentUser]);

  // Handler de logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
    setCurrentUser(null);
  };

  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white font-arial flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm uppercase tracking-widest">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="min-h-screen bg-[#0f172a] text-white font-arial">
        <Routes>
          <Route 
            path="/login" 
            element={
              currentUser 
                ? <Navigate to="/dashboard" /> 
                : <Login setCurrentUser={setCurrentUser} users={users} />
            } 
          />
          <Route 
            path="/register" 
            element={
              currentUser 
                ? <Navigate to="/dashboard" /> 
                : <Register setUsers={setUsers} setCurrentUser={setCurrentUser} />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              currentUser ? (
                isAdmin(currentUser) ? (
                  <AdminDashboard 
                    currentUser={currentUser} 
                    users={users} 
                    setUsers={setUsers} 
                    onLogout={handleLogout} 
                  />
                ) : (
                  <UserDashboard 
                    currentUser={currentUser} 
                    onLogout={handleLogout} 
                  />
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
