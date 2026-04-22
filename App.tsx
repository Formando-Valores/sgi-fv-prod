/**
 * SGI FV - Main Application Component
 * Sistema de Gestão Integrada - Formando Valores
 * 
 * DEBUG VERSION: Comprehensive logging enabled
 */

console.log('[APP] ========================================');
console.log('[APP] App.tsx module loading...', new Date().toISOString());
console.log('[APP] ========================================');

import React, { useEffect, useState } from 'react';
console.log('[APP] ✅ React imported');

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import PasswordRecovery from './pages/PasswordRecovery';
import UnifiedDashboard from './src/pages/UnifiedDashboard';
import PaymentSuccess from './src/pages/Payments/PaymentSuccess';
import PaymentCancel from './src/pages/Payments/PaymentCancel';
import { ProcessStatus, ServiceUnit, User } from './types';
import { INITIAL_MOCK_USERS } from './constants';
import { supabase } from './supabase';

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

const isAdminOrgRole = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return normalized === 'admin' || normalized === 'owner' || normalized === 'administrador';
};

const RootApp: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authBootstrapping, setAuthBootstrapping] = useState(true);

  const [users, setUsers] = useState<User[]>(() =>
    parseStorageItem<User[]>('sgi_users', INITIAL_MOCK_USERS)
  );

  useEffect(() => {
    localStorage.setItem('sgi_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    let mounted = true;

    const bootstrapUserFromSession = async () => {
      if (mounted) {
        setAuthBootstrapping(true);
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[auth] getSession falhou durante bootstrap', error);
          if (mounted) setCurrentUser(null);
          return;
        }

        const sessionUser = data.session?.user;
        if (!sessionUser) {
          if (mounted) setCurrentUser(null);
          return;
        }

        const existingUser = users.find((user) => user.id === sessionUser.id || user.email === (sessionUser.email || ''));

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sessionUser.id)
          .maybeSingle();

        if (profileError) {
          console.warn('[auth] não foi possível carregar profile no bootstrap', profileError);
        }

        const { data: contextData, error: contextError } = await supabase
          .from('v_user_context')
          .select('org_role, org_id, org_name')
          .eq('user_id', sessionUser.id)
          .maybeSingle();

        if (contextError) {
          console.warn('[auth] erro ao buscar contexto por user_id', contextError);
        }

        let contextByEmailData: { org_role?: string | null; org_id?: string | null; org_name?: string | null } | null = null;
        if (!contextData?.org_role && sessionUser.email) {
          const { data: byEmail, error: byEmailError } = await supabase
            .from('v_user_context')
            .select('org_role, org_id, org_name')
            .eq('email', sessionUser.email)
            .maybeSingle();
          contextByEmailData = byEmail;

          if (byEmailError) {
            console.warn('[auth] erro ao buscar contexto por email', byEmailError);
          }
        }

        const orgRole = contextData?.org_role ?? contextByEmailData?.org_role ?? profile?.role ?? null;
        const normalizedRole = isAdminOrgRole(orgRole) ? UserRole.ADMIN : UserRole.CLIENT;

        const normalizedUser: User = {
          id: sessionUser.id,
          name: profile?.nome_completo ?? existingUser?.name ?? sessionUser.email?.split('@')[0] ?? 'Usuário',
          email: sessionUser.email ?? existingUser?.email ?? '',
          role: normalizedRole,
          documentId: profile?.documento_identidade ?? existingUser?.documentId ?? '-',
          taxId: profile?.nif_cpf ?? existingUser?.taxId ?? '-',
          address: profile?.endereco ?? existingUser?.address ?? '-',
          maritalStatus: profile?.estado_civil ?? existingUser?.maritalStatus ?? 'Não informado',
          country: profile?.pais ?? existingUser?.country ?? 'Brasil',
          phone: profile?.phone ?? existingUser?.phone ?? '-',
          processNumber: existingUser?.processNumber ?? '',
          unit: existingUser?.unit ?? ServiceUnit.JURIDICO,
          status: existingUser?.status ?? ProcessStatus.PENDENTE,
          protocol: existingUser?.protocol ?? `JURA-${new Date().getFullYear()}-000`,
          registrationDate: existingUser?.registrationDate ?? new Date().toLocaleString('pt-BR'),
          notes: existingUser?.notes,
          deadline: existingUser?.deadline,
          serviceManager: existingUser?.serviceManager,
          organizationId: contextData?.org_id ?? contextByEmailData?.org_id ?? profile?.org_id ?? existingUser?.organizationId,
          organizationName: contextData?.org_name ?? contextByEmailData?.org_name ?? existingUser?.organizationName,
        };

        if (mounted) {
          setCurrentUser(normalizedUser);
        }
      } finally {
        if (mounted) {
          setAuthBootstrapping(false);
        }
      }
    };

    void bootstrapUserFromSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event) => {
      void bootstrapUserFromSession();
    });
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [users]);

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const authLoadingScreen = (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="mt-3 text-sm font-semibold text-gray-600">Restaurando sessão...</p>
      </div>
    </div>
  );

  const renderDashboardRoute = (section: 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes' = 'dashboard') => {
    if (authBootstrapping) {
      return authLoadingScreen;
    }

    if (!currentUser) {
      return <Navigate to="/login" />;
    }

    return (
      <UnifiedDashboard
        currentUser={currentUser}
        users={users}
        setUsers={setUsers}
        onLogout={handleLogout}
        section={section}
      />
    );
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-gray-50 text-gray-800 font-['Inter',sans-serif]">
        <Routes>
          <Route
            path="/login"
            element={authBootstrapping ? authLoadingScreen : (currentUser ? <Navigate to="/dashboard" /> : <Login setCurrentUser={setCurrentUser} users={users} />)}
          />
          <Route
            path="/register"
            element={authBootstrapping ? authLoadingScreen : (currentUser ? <Navigate to="/dashboard" /> : <Register setUsers={setUsers} setCurrentUser={setCurrentUser} />)}
          />
          <Route path="/recovery" element={<PasswordRecovery />} />
          <Route path="/dashboard" element={renderDashboardRoute('dashboard')} />
          <Route path="/dashboard/processos" element={renderDashboardRoute('processos')} />
          <Route path="/dashboard/clientes" element={renderDashboardRoute('clientes')} />
          <Route path="/dashboard/configuracoes" element={renderDashboardRoute('configuracoes')} />
          <Route path="/dashboard/organizacoes" element={renderDashboardRoute('organizacoes')} />
          <Route path="/payments/success" element={<PaymentSuccess />} />
          <Route path="/payments/cancel" element={<PaymentCancel />} />
          <Route path="*" element={authBootstrapping ? authLoadingScreen : <Navigate to="/login" />} />
        </Routes>
      </div>
    </HashRouter>
  );
};

export default RootApp;