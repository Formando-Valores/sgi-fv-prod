/**
 * SGI FV - Login Page
 * Sistema de Gestão Integrada - Formando Valores
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Mail, Lock, ArrowRight, Shield, Scale, Users } from 'lucide-react';
import { ProcessStatus, ServiceUnit, User, UserRole, type OrgMembership } from '../types';
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


const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const extractRecoveryParamsFromUrl = () => {
  const href = window.location.href;
  const searchParams = new URLSearchParams(window.location.search);
  const tokenParams = new URLSearchParams();

  ['code', 'type', 'token', 'email', 'token_hash', 'access_token', 'refresh_token', 'error', 'error_description'].forEach((key) => {
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
      ['code', 'type', 'token', 'email', 'token_hash', 'access_token', 'refresh_token', 'error', 'error_description'].forEach((key) => {
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
      (recoveryParams.has('token') && recoveryParams.has('email')) ||
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

    const appOrigin = window.location.origin.replace(/\/$/, '');
    const loginUrl = `${appOrigin}${window.location.pathname.includes('#') ? '' : '/#/login'}`;
    const redirectTo = `${appOrigin}/recovery.html`;

    const runFallbackReset = async () => {
      const { error: fallbackError } = await withTimeout(
        supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
          redirectTo,
        }),
        12000,
        'Tempo limite no fallback de recuperação de senha.'
      );

      if (fallbackError) {
        console.error('[login] fallback resetPasswordForEmail também falhou', fallbackError);
      }
    };

    try {
      const { data: forgotData, error: forgotError } = await withTimeout(
        supabase.functions.invoke(SUPABASE_EDGE_FUNCTIONS.FORGOT_PASSWORD, {
          body: {
            email: forgotPasswordEmail,
            loginUrl,
            redirectTo,
          },
        }),
        12000,
        'Tempo limite ao contatar o Supabase.'
      );

      const functionSucceeded = !forgotError && (forgotData?.success ?? true);

      if (!functionSucceeded) {
        console.error('[login] falha ao solicitar redefinição de senha', forgotError);
        await runFallbackReset();
      }

      setForgotPasswordMessage('Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.');
    } catch (forgotPasswordRequestError) {
      console.error('[login] erro inesperado ao solicitar redefinição de senha', forgotPasswordRequestError);
      try {
        await runFallbackReset();
        setForgotPasswordMessage('Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.');
      } catch (fallbackExecutionError) {
        console.error('[login] erro ao executar fallback de redefinição', fallbackExecutionError);
        setForgotPasswordError('Não foi possível conectar ao servidor de autenticação. Verifique a configuração do Supabase e tente novamente.');
      }
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
      console.info('[login] iniciando autenticação');
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
        console.info('[login] autenticado, buscando profile');

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


        const { data: loginOrgMemberships } = await supabase
          .from('org_members')
          .select('org_id, role, organizations(name, slug, is_active)')
          .eq('user_id', userId);

        const contextOrganizationId = contextData?.org_id ?? contextByEmailData?.org_id;
        const contextOrganizationName = contextData?.org_name ?? contextByEmailData?.org_name;
        const contextOrganizationSlug = contextData?.org_slug ?? contextByEmailData?.org_slug;

        const hasAdminRole =
          isAdminRole(profile?.role) ||
          isAdminRole(contextRole) ||
          isAdminRole(existingUser?.role) ||
          ADMIN_CREDENTIALS.some((adminEmail) => adminEmail.toLowerCase() === (data.user.email || '').toLowerCase());

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
          protocol: existingUser?.protocol ?? '-',
          registrationDate: existingUser?.registrationDate ?? new Date().toLocaleString('pt-BR'),
          notes: existingUser?.notes,
          deadline: existingUser?.deadline,
          serviceManager: existingUser?.serviceManager,
          organizationId: profileOrgId ?? existingUser?.organizationId ?? contextOrganizationId ?? undefined,
          organizationName: profile?.organization_name ?? existingUser?.organizationName ?? contextOrganizationName ?? defaultOrganization?.name ?? undefined,
          activeOrgId: profileOrgId ?? existingUser?.organizationId ?? contextOrganizationId ?? undefined,
          availableOrgs: (loginOrgMemberships || []).filter((m: Record<string, unknown>) => {
            const org = m.organizations as Record<string, unknown> | undefined;
            return org?.is_active !== false;
          }) as OrgMembership[],
        };

        console.info('[login] profile carregado, redirecionando para dashboard');

        setCurrentUser(normalizedUser);

        navigate('/dashboard');
      }
    } catch (err) {
      console.error('[login] erro inesperado', err);
      setError('Erro inesperado. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <img src="/icons/icon.svg" alt="SGI FV" className="h-14 w-14 mb-8 rounded-xl" />
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-4">
            Sistema de<br />Gestão Integrada
          </h1>
          <p className="text-brand-200 text-lg font-medium max-w-md leading-relaxed">
            Plataforma completa para gestão de processos jurídicos e acompanhamento de clientes.
          </p>

          <div className="mt-12 space-y-4">
            {[
              { icon: Shield, text: 'Controle de acesso por organização' },
              { icon: Scale, text: 'Acompanhamento de processos em tempo real' },
              { icon: Users, text: 'Gestão integrada de clientes e afiliação' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="text-sm font-medium text-brand-100">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-surface-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <img src="/icons/icon.svg" alt="SGI FV" className="h-10 w-10 mx-auto mb-3" />
            <h1 className="text-xl font-extrabold text-surface-800 tracking-tight">SGI FV</h1>
            <p className="text-[10px] text-surface-400 font-semibold uppercase tracking-widest">Formando Valores</p>
          </div>

          <div className="bg-white border border-surface-200/60 rounded-2xl shadow-card p-6 sm:p-8">
            {!showForgotPassword && (
              <div className="mb-6">
                <h2 className="text-xl font-extrabold text-surface-800">Bem-vindo de volta</h2>
                <p className="text-sm text-surface-500 mt-1">Insira suas credenciais para acessar o painel</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {showForgotPassword ? (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h3 className="text-sm font-bold text-surface-800">Recuperar acesso</h3>
                    <p className="text-xs text-surface-500 mt-1">
                      Informe seu e-mail para receber um link seguro de redefinição de senha.
                    </p>
                  </div>

                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 w-4 h-4" />
                    <input
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(event) => setForgotPasswordEmail(event.target.value)}
                      className="w-full rounded-xl border border-surface-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                      placeholder="seu@email.com"
                      required={showForgotPassword}
                      disabled={forgotPasswordLoading}
                    />
                  </div>

                  {forgotPasswordError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-xs font-medium text-red-600">{forgotPasswordError}</p>
                    </div>
                  )}

                  {forgotPasswordMessage && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <p className="text-xs font-medium text-emerald-600">{forgotPasswordMessage}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleForgotPassword()}
                    disabled={forgotPasswordLoading}
                    className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {forgotPasswordLoading ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                        Enviando...
                      </>
                    ) : (
                      <>Enviar link de redefinição</>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPasswordError('');
                      setForgotPasswordMessage('');
                    }}
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm font-semibold text-surface-600 transition-all hover:bg-surface-100"
                  >
                    Voltar ao login
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-surface-700 mb-1.5">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 w-4 h-4" />
                      <input
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-xl text-sm font-medium text-surface-800 placeholder:text-surface-400 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 ${error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-surface-200 hover:border-surface-300'}`}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-surface-700 mb-1.5">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 w-4 h-4" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full pl-10 pr-11 py-2.5 bg-white border rounded-xl text-sm font-medium text-surface-800 placeholder:text-surface-400 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 ${error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-surface-200 hover:border-surface-300'}`}
                        required
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors p-0.5"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setForgotPasswordEmail((current) => current || email);
                          setForgotPasswordError('');
                          setForgotPasswordMessage('');
                        }}
                        className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-xs font-medium text-red-600">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2 text-sm"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                        Autenticando...
                      </>
                    ) : (
                      <>
                        Entrar
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              )}
            </form>
          </div>

          {/* Register link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-surface-500">
              Ainda não possui acesso?{' '}
              <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                Criar conta
              </Link>
            </p>
          </div>

          <p className="mt-8 text-center text-[10px] text-surface-400 font-medium">
            © 2026 SGI FV — Sistema de Gestão Integrada
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
