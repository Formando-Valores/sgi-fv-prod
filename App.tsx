/**
 * SGI FV - Main Application Component
 * Sistema de Gestão Integrada - Formando Valores
 * 
 * DEBUG VERSION: Comprehensive logging enabled
 */

console.log('[APP] ========================================');
console.log('[APP] App.tsx module loading...', new Date().toISOString());
console.log('[APP] ========================================');

import React from 'react';
console.log('[APP] ✅ React imported');

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
console.log('[APP] ✅ react-router-dom imported');

import Login from './pages/Login';
console.log('[APP] ✅ Login imported');

import Register from './pages/Register';
console.log('[APP] ✅ Register imported');

import AppLayout from './src/layouts/AppLayout';
console.log('[APP] ✅ AppLayout imported');

import Dashboard from './src/pages/Dashboard';
console.log('[APP] ✅ Dashboard imported');

import ProcessList from './src/pages/Processes/ProcessList';
console.log('[APP] ✅ ProcessList imported');

import ProcessNew from './src/pages/Processes/ProcessNew';
console.log('[APP] ✅ ProcessNew imported');

import ProcessDetails from './src/pages/Processes/ProcessDetails';
console.log('[APP] ✅ ProcessDetails imported');

import ClientList from './src/pages/Clients/ClientList';
console.log('[APP] ✅ ClientList imported');

import Members from './src/pages/Settings/Members';
console.log('[APP] ✅ Members imported');

import Configuracoes from './src/pages/Configuracoes';
console.log('[APP] ✅ Configuracoes imported');

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
console.log('[APP] ✅ AuthProvider imported');

console.log('[APP] All imports completed successfully!');

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('[ProtectedRoute] Rendering...');
  const { session, loading } = useAuth();
  console.log('[ProtectedRoute] Auth state:', { hasSession: !!session, loading });

  if (loading) {
    console.log('[ProtectedRoute] Showing loading state');
    return (
      <div className="min-h-screen bg-[#0f172a] text-white font-arial flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm uppercase tracking-widest">Carregando...</p>
          <p className="text-slate-500 text-xs mt-2">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    console.log('[ProtectedRoute] No session, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('[ProtectedRoute] Session valid, rendering children');
  return <>{children}</>;
};

// Public Route wrapper (redirects if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('[PublicRoute] Rendering...');
  const { session, loading } = useAuth();
  console.log('[PublicRoute] Auth state:', { hasSession: !!session, loading });

  if (loading) {
    console.log('[PublicRoute] Showing loading state');
    return (
      <div className="min-h-screen bg-[#0f172a] text-white font-arial flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm uppercase tracking-widest">Carregando...</p>
          <p className="text-slate-500 text-xs mt-2">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (session) {
    console.log('[PublicRoute] Has session, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  console.log('[PublicRoute] No session, rendering children');
  return <>{children}</>;
};

// App Routes Component (needs to be inside AuthProvider)
const AppRoutes: React.FC = () => {
  console.log('[AppRoutes] Rendering...');
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
  console.log('[App] ========================================');
  console.log('[App] App component RENDERING!', new Date().toISOString());
  console.log('[App] ========================================');
  
  return (
    <HashRouter>
      {(() => {
        console.log('[App] HashRouter initialized');
        return null;
      })()}
      <AuthProvider>
        {(() => {
          console.log('[App] AuthProvider wrapper rendered');
          return null;
        })()}
        <div className="min-h-screen bg-[#0f172a] text-white font-arial">
          <AppRoutes />
        </div>
      </AuthProvider>
    </HashRouter>
  );
};

console.log('[APP] App component defined, exporting...');
export default App;
console.log('[APP] ✅ App exported successfully');
