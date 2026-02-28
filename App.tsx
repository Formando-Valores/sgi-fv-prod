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

const RootApp: React.FC = () => {
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

export default RootApp;
