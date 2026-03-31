/**
 * SGI FV - Login Page
 * Sistema de Gestão Integrada - Formando Valores
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { ProcessStatus, ServiceUnit, User, UserRole } from '../types';
import { isSupabaseConfigured, supabase } from '../supabase';
import { ADMIN_CREDENTIALS } from '../constants';
import { SUPABASE_EDGE_FUNCTIONS } from '../src/lib/supabaseFunctions';

interface LoginProps {
  setCurrentUser: (user: User) => void;
  users: User[];
}

const isAdminRole = (value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  return ['admin', 'administrator', 'administrador', 'owner', 'administrador geral', UserRole.ADMIN.toLowerCase()].includes(value.toLowerCase());
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const extractRecoveryParamsFromUrl = () => {
  const href = window.location.href;
  const searchParams = new URLSearchParams(window.location.search);
  const tokenParams = new URLSearchParams();

  ['code', 'type', 'token_hash', 'access_token', 'refresh_token', 'error', 'error_description'].forEach((key) => {
    const value = searchParams.get(key);
    if (value) {
      tokenParams.set(key, value);
    }
  });

  href
    .split('#')
    .slice(1)
    .forEach((segment) => {
      const normalized = segment.includes('?') ? segment.split('?').slice(1).join('?') : segment;
      if (!normalized.includes('=')) {
        return;
      }

      const params = new URLSearchParams(normalized);
      ['code', 'type', 'token_hash', 'access_token', 'refresh_token', 'error', 'error_description'].forEach((key) => {
        const value = params.get(key);
        if (value && !tokenParams.has(key)) {
          tokenParams.set(key, value);
        }
      });
    });

  return tokenParams;
};

const Login: React.FC<LoginProps> = ({ setCurrentUser, users }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('');
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const recoveryParams = extractRecoveryParamsFromUrl();
    const hasRecoverySignal =
      recoveryParams.get('type') === 'recovery' ||
      recoveryParams.has('token_hash') ||
      recoveryParams.has('access_token') ||
      recoveryParams.has('refresh_token') ||
      recoveryParams.has('code');

    if (!hasRecoverySignal) {
      return;
    }

    const query = recoveryParams.toString();
    navigate(`/recovery${query ? `?${query}` : ''}`, { replace: true });
  }, [navigate]);

  const handleForgotPassword = async () => {
    setForgotPasswordError('');
    setForgotPasswordMessage('');

    if (!forgotPasswordEmail) {
      setForgotPasswordError('Informe o e-mail da sua conta para continuar.');
      return;
    }

    if (!isValidEmail(forgotPasswordEmail)) {
      setForgotPasswordError('Informe um e-mail válido para receber o link de redefinição.');
      return;
    }

    setForgotPasswordLoading(true);

    try {
      const appOrigin = window.location.origin.replace(/\/$/, '');
      const loginUrl = `${appOrigin}${window.location.pathname.includes('#') ? '' : '/#/login'}`;
      const redirectTo = `${appOrigin}/recovery.html`;

      const { data: forgotData, error: forgotError } = await supabase.functions.invoke(SUPABASE_EDGE_FUNCTIONS.FORGOT_PASSWORD, {
        body: {
          email: forgotPasswordEmail,
          loginUrl,
          redirectTo,
        },
      });

      const functionSucceeded = !forgotError && (forgotData?.success ?? true);

      if (!functionSucceeded) {
        console.error('[login] falha ao solicitar redefinição de senha', forgotError);

        const { error: fallbackError } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
          redirectTo,
        });

        if (fallbackError) {
          console.error('[login] fallback resetPasswordForEmail também falhou', fallbackError);
        }
      }

      setForgotPasswordMessage('Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.');
    } catch (forgotPasswordRequestError) {
      console.error('[login] erro inesperado ao solicitar redefinição de senha', forgotPasswordRequestError);
      setForgotPasswordMessage('Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isSupabaseConfigured) {
      setError('Configuração do sistema incompleta. Contate o suporte para ajustar as variáveis do Supabase.');
      return;
    }

    try {
      console.info('[login] iniciando autenticação', { email });
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('[login] falha na autenticação', authError);
        setError('Email ou senha inválidos');
        return;
      }

      if (data.user) {
        const userId = data.user.id;
        console.info('[login] autenticado, buscando profile', { userId });

        const { data: defaultOrganization } = await supabase
          .from('organizations')
          .select('id, name, slug')
          .eq('slug', 'default')
          .maybeSingle();

        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) {
          console.error('[login] erro ao buscar profile', profileError);
          setError('Erro ao buscar perfil.');
          return;
        }

        let profile = profiles;

        if (!profile) {
          const { data: inserted, error: insertError } = await supabase
            .from('profiles')
            .insert([
              {
                id: userId,
                email: data.user.email,
                role: UserRole.CLIENT,
                nome_completo: data.user.user_metadata?.name ?? null,
                org_id: defaultOrganization?.id ?? null,
              },
            ])
            .select('*')
            .maybeSingle();

          if (insertError) {
            console.error('[login] erro ao criar profile', insertError);
            setError('Perfil não encontrado e não foi possível criar.');
            return;
          }

          profile = inserted;
        }

        const profileOrgId = profile?.org_id ?? profile?.organization_id ?? defaultOrganization?.id ?? null;

        if (profileOrgId) {
          const { data: existingMembership, error: membershipLookupError } = await supabase
            .from('org_members')
            .select('org_id')
            .eq('org_id', profileOrgId)
            .eq('user_id', userId)
            .maybeSingle();

          if (membershipLookupError) {
            console.warn('[login] não foi possível verificar vínculo em org_members', membershipLookupError);
          }

          if (!existingMembership) {
            const { error: membershipInsertError } = await supabase
              .from('org_members')
              .insert({
                org_id: profileOrgId,
                user_id: userId,
                role: 'client',
              });

            if (membershipInsertError) {
              console.warn('[login] não foi possível criar vínculo em org_members', membershipInsertError);
            }
          }
        }

        const existingUser = users.find((user) => user.id === userId || user.email === email);

        const { data: contextData, error: contextError } = await supabase
          .from('v_user_context')
          .select('org_role, org_id, org_name, org_slug')
          .eq('user_id', userId)
          .maybeSingle();

        if (contextError) {
          console.warn('[login] erro ao buscar contexto organizacional por user_id', contextError);
        }

        let contextRole = contextData?.org_role;
        let contextByEmailData: { org_role?: string | null; org_id?: string | null; org_name?: string | null; org_slug?: string | null } | null = null;

        if (!contextRole && data.user.email) {
          const { data: contextByEmail, error: contextByEmailError } = await supabase
            .from('v_user_context')
            .select('org_role, org_id, org_name, org_slug')
            .eq('email', data.user.email)
            .maybeSingle();

          contextByEmailData = contextByEmail;

          if (contextByEmailError) {
            console.warn('[login] erro ao buscar contexto organizacional por email', contextByEmailError);
          }

          contextRole = contextByEmail?.org_role ?? contextRole;
        }


        const contextOrganizationId = contextData?.org_id ?? contextByEmailData?.org_id;
        const contextOrganizationName = contextData?.org_name ?? contextByEmailData?.org_name;
        const contextOrganizationSlug = contextData?.org_slug ?? contextByEmailData?.org_slug;

        const hasDefaultOrganizationAccess =
          contextOrganizationSlug === 'default' ||
          (!!defaultOrganization?.id && contextOrganizationId === defaultOrganization.id) ||
          (!!defaultOrganization?.id && profileOrgId === defaultOrganization.id);

        const hasAdminRole =
          isAdminRole(profile?.role) ||
          isAdminRole(contextRole) ||
          isAdminRole(existingUser?.role) ||
          ADMIN_CREDENTIALS.some((adminEmail) => adminEmail.toLowerCase() === (data.user.email || '').toLowerCase()) ||
          hasDefaultOrganizationAccess;

        const normalizedRole = hasAdminRole ? UserRole.ADMIN : UserRole.CLIENT;

        const normalizedUser: User = {
          id: userId,
          name: profile?.nome_completo ?? existingUser?.name ?? data.user.email?.split('@')[0] ?? 'Usuário',
          email: data.user.email ?? existingUser?.email ?? email,
          role: normalizedRole,
          documentId: existingUser?.documentId ?? '-',
          taxId: existingUser?.taxId ?? '-',
          address: existingUser?.address ?? '-',
          maritalStatus: existingUser?.maritalStatus ?? 'Não informado',
          country: existingUser?.country ?? 'Brasil',
          phone: existingUser?.phone ?? '-',
          processNumber: existingUser?.processNumber ?? '',
          unit: existingUser?.unit ?? ServiceUnit.JURIDICO,
          status: existingUser?.status ?? ProcessStatus.PENDENTE,
          protocol: existingUser?.protocol ?? `JURA-${new Date().getFullYear()}-000`,
          registrationDate: existingUser?.registrationDate ?? new Date().toLocaleString('pt-BR'),
          notes: existingUser?.notes,
          deadline: existingUser?.deadline,
          serviceManager: existingUser?.serviceManager,
          organizationId: profileOrgId ?? existingUser?.organizationId ?? contextOrganizationId ?? undefined,
          organizationName: profile?.organization_name ?? existingUser?.organizationName ?? contextOrganizationName ?? defaultOrganization?.name ?? undefined,
        };

        console.info('[login] profile carregado, redirecionando para dashboard', {
          profileId: profile?.id,
          role: normalizedUser.role,
        });

        setCurrentUser(normalizedUser);

        const mergedUsers = [
          ...users.filter((user) => user.id !== normalizedUser.id),
          normalizedUser,
        ];
        localStorage.setItem('sgi_users', JSON.stringify(mergedUsers));

        navigate('/dashboard');
      }
    } catch (err) {
      console.error('[login] erro inesperado', err);
      setError('Erro inesperado. Tente novamente.');
    }
  };






  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-wider text-gray-800">SGI FV</h1>
          <p className="text-gray-500 font-semibold uppercase text-xs mt-1">Formando Valores</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {showForgotPassword ? (
            <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-blue-700">Recuperar acesso</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Informe seu e-mail para receber um link seguro de redefinição de senha.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                    E-mail cadastrado
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(event) => setForgotPasswordEmail(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white py-3 pl-10 pr-4 text-gray-800 font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="seu@email.com"
                      required={showForgotPassword}
                      disabled={forgotPasswordLoading}
                    />
                  </div>
                </div>

                {forgotPasswordError && (
                  <p className="text-sm font-bold text-red-600">{forgotPasswordError}</p>
                )}

                {forgotPasswordMessage && (
                  <p className="text-sm font-bold text-emerald-600">{forgotPasswordMessage}</p>
                )}

                <button
                  type="button"
                  onClick={() => void handleForgotPassword()}
                  disabled={forgotPasswordLoading}
                  className="w-full rounded-lg border border-blue-700 bg-blue-600/90 px-4 py-3 text-sm font-black uppercase tracking-wider text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {forgotPasswordLoading ? 'Enviando instruções...' : 'Enviar link de redefinição'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordError('');
                    setForgotPasswordMessage('');
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-black uppercase tracking-wider text-gray-700 transition-colors hover:bg-gray-200"
                >
                  Voltar ao login
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Usuário - e-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={!showForgotPassword}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Senha Privada</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="******"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={!showForgotPassword}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="mt-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setForgotPasswordEmail((current) => current || email);
                      setForgotPasswordError('');
                      setForgotPasswordMessage('');
                    }}
                    className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 text-sm font-bold">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold rounded-lg uppercase tracking-widest transition-all transform active:scale-95 shadow-lg flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Autenticando...</span>
                  </>
                ) : (
                  'Autenticar no SGI'
                )}
              </button>
            </>
          )}
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-gray-500 text-sm mb-4">Ainda não possui acesso?</p>
          <Link
            to="/register"
            className="inline-block px-6 py-2 border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-bold rounded-full transition-all"
          >
            REGISTRE-SE AGORA
          </Link>
        </div>
      </div>
      
      <p className="mt-8 text-gray-500 text-[10px] uppercase tracking-tighter">
        © 2026 SGI FV - Sistema de Gestão Integrada
      </p>
    </div>
  );
};

export default Login;
