/**
 * SGI FV - Login Page
 * Sistema de Gestão Integrada - Formando Valores
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { ProcessStatus, ServiceUnit, User, UserRole } from '../types';
import { isSupabaseConfigured, supabase } from '../supabase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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

        const existingUser = users.find((user) => user.id === userId || user.email === email);
        const normalizedRole = profile?.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.CLIENT;

        const normalizedUser: User = {
          id: userId,
          name: profile?.nome ?? profile?.nome_completo ?? existingUser?.name ?? data.user.email?.split('@')[0] ?? 'Usuário',
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
        };

        console.info('[login] profile carregado, redirecionando para dashboard', {
          profileId: profile?.id,
          role: normalizedUser.role,
        });

        setCurrentUser(normalizedUser);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('[login] erro inesperado', err);
      setError('Erro inesperado. Tente novamente.');
    }
  };






  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-wider text-white">SGI FV</h1>
          <p className="text-slate-400 font-semibold uppercase text-xs mt-1">Formando Valores</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Usuário - e-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 text-slate-500 w-5 h-5" />
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-slate-700 rounded-lg text-white font-bold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Senha Privada</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-slate-500 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="******"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-gray-900 border border-slate-700 rounded-lg text-white font-bold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-200 text-sm font-bold">{error}</p>
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
        </form>

        <div className="mt-8 pt-6 border-t border-slate-700 text-center">
          <p className="text-slate-400 text-sm mb-4">Ainda não possui acesso?</p>
          <Link
            to="/register"
            className="inline-block px-6 py-2 border-2 border-slate-600 hover:border-slate-400 text-slate-300 font-bold rounded-full transition-all"
          >
            REGISTRE-SE AGORA
          </Link>
        </div>
      </div>
      
      <p className="mt-8 text-slate-600 text-[10px] uppercase tracking-tighter">
        © 2026 SGI FV - Sistema de Gestão Integrada
      </p>
    </div>
  );
};

export default Login;
