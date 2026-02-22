/**
 * SGI FV - Main Application Component
 * Sistema de Gestão Integrada - Formando Valores
 */

import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import AppLayout from './src/layouts/AppLayout';
import Dashboard from './src/pages/Dashboard';
import ProcessList from './src/pages/Processes/ProcessList';
import ProcessNew from './src/pages/Processes/ProcessNew';
import ProcessDetails from './src/pages/Processes/ProcessDetails';
import ClientList from './src/pages/Clients/ClientList';
import Members from './src/pages/Settings/Members';
import Configuracoes from './src/pages/Configuracoes';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white font-arial flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm uppercase tracking-widest">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public Route wrapper (redirects if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white font-arial flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm uppercase tracking-widest">Carregando...</p>
        </div>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// App Routes Component (needs to be inside AuthProvider)
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Auth routes - outside layout */}
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } 
      />
      <Route 
        path="/register" 
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        } 
      />
      
      {/* App routes - inside layout with protection */}
      <Route element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/processos" element={<ProcessList />} />
        <Route path="/processos/novo" element={<ProcessNew />} />
        <Route path="/processos/:id" element={<ProcessDetails />} />
        <Route path="/clientes" element={<ClientList />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/configuracoes/membros" element={<Members />} />
      </Route>
      
      {/* Redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <div className="min-h-screen bg-[#0f172a] text-white font-arial">
          <AppRoutes />
        </div>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;
