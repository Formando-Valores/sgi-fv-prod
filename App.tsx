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
import CertificatePage from './src/pages/Certificate/CertificatePage';
import { ProcessStatus, ServiceUnit, User, UserRole } from './types';
import { supabase } from './supabase';
import { getAllowedModules, resolvePermissions } from './src/lib/permissions';

const RootApp: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authBootstrapping, setAuthBootstrapping] = useState(true);

  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadUsersFromSupabase = async () => {
      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, email, nome_completo, documento_identidade, nif_cpf, estado_civil, phone, endereco, pais, org_id, created_at')
          .order('created_at', { ascending: false });

        if (error || !profiles?.length) {
          return;
        }

        const userIds = profiles.map(p => p.id);
        const { data: members } = await supabase
          .from('org_members')
          .select('user_id, org_id, role, organizations(name)')
          .in('user_id', userIds);

        const memberByUserId = new Map((members || []).map(m => [m.user_id, m]));

        const mappedUsers: User[] = profiles.map(profile => {
          const member = memberByUserId.get(profile.id);
          const isAdmin = member?.role === 'admin' || member?.role === 'owner';
          const orgValue = member?.organizations;
          const orgName = Array.isArray(orgValue) ? orgValue[0]?.name : orgValue?.name || null;

          return {
            id: profile.id,
            name: profile.nome_completo || profile.email?.split('@')[0] || 'Usuário',
            email: profile.email || '',
            role: isAdmin ? UserRole.ADMIN : UserRole.CLIENT,
            documentId: profile.documento_identidade || '-',
            taxId: profile.nif_cpf || '-',
            address: profile.endereco || '-',
            maritalStatus: profile.estado_civil || 'Não informado',
            country: profile.pais || 'Brasil',
            phone: profile.phone || '-',
            unit: ServiceUnit.JURIDICO,
            status: ProcessStatus.PENDENTE,
            protocol: `SGI-${new Date().getFullYear()}-000`,
            registrationDate: profile.created_at
              ? new Date(profile.created_at).toLocaleString('pt-BR')
              : new Date().toLocaleString('pt-BR'),
            organizationId: profile.org_id,
            organizationName: orgName,
          } as User;
        });

        if (mounted) {
          setUsers(prev => {
            const prevMap = new Map(prev.map(u => [u.id, u]));
            mappedUsers.forEach(u => prevMap.set(u.id, u));
            return Array.from(prevMap.values());
          });
        }
      } catch (err) {
        console.warn('[users] erro ao carregar do Supabase', err);
      }
    };

    void loadUsersFromSupabase();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrapUserFromSession = async (showLoader = false) => {
      if (mounted && showLoader) {
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
        const permissions = resolvePermissions(orgRole, { profileRole: profile?.role });
        const normalizedRole = permissions.hierarchy === 'cliente' ? UserRole.CLIENT : UserRole.ADMIN;

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
      } catch (bootstrapError) {
        console.error('[auth] erro inesperado no bootstrapUserFromSession', bootstrapError);
        if (mounted) {
          setCurrentUser(null);
        }
      } finally {
        if (mounted) {
          setAuthBootstrapping(false);
        }
      }
    };

    void bootstrapUserFromSession(true);

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setAuthBootstrapping(false);
        return;
      }

      void bootstrapUserFromSession(false);
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


  const renderUnifiedSectionRoute = (section: 'dashboard' | 'processos' | 'clientes' | 'configuracoes' | 'organizacoes' | 'relatorios') => {
    if (authBootstrapping) {
      return authLoadingScreen;
    }

    if (!currentUser) {
      return <Navigate to="/login" />;
    }

    const permissions = resolvePermissions(currentUser.org_role ?? (currentUser.role === UserRole.ADMIN ? 'admin' : 'client'));
    const allowedModules = getAllowedModules({ org_role: currentUser.org_role ?? null, hierarchy: permissions.hierarchy });
    if (section !== 'dashboard' && !allowedModules.includes(section)) {
      return <Navigate to="/dashboard" replace />;
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

  const renderDashboardRoute = () => {
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
          <Route path="/dashboard/*" element={renderDashboardRoute()} />
          <Route path="/processos" element={renderUnifiedSectionRoute('processos')} />
          <Route path="/clientes" element={renderUnifiedSectionRoute('clientes')} />
          <Route path="/configuracoes" element={renderUnifiedSectionRoute('configuracoes')} />
          <Route path="/organizacoes" element={renderUnifiedSectionRoute('organizacoes')} />
          <Route path="/relatorios" element={renderUnifiedSectionRoute('relatorios')} />
          <Route path="/payments/success" element={<PaymentSuccess />} />
          <Route path="/payments/cancel" element={<PaymentCancel />} />
          <Route path="/certificate" element={<CertificatePage />} />
          <Route path="*" element={authBootstrapping ? authLoadingScreen : <Navigate to="/login" />} />
        </Routes>
      </div>
    </HashRouter>
  );
};

export default RootApp;
