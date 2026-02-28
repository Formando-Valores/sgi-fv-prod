/**
 * SGI FV - Register Page
 * Sistema de Gestão Integrada - Formando Valores
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { COUNTRIES } from '../constants';
import { ServiceUnit, ProcessStatus, User, UserRole } from '../types';
import { isSupabaseConfigured, supabase } from '../supabase';

interface RegisterProps {
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setCurrentUser: (user: User) => void;
}

const Register: React.FC<RegisterProps> = ({ setUsers, setCurrentUser }) => {
  const goToRoute = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    documentId: '',
    taxId: '',
    address: '',
    maritalStatus: 'Solteiro',
    country: 'Brasil',
    phone: '',
    processNumber: '',
    unit: ServiceUnit.JURIDICO
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!isSupabaseConfigured) {
      setError('Configuração do sistema incompleta. Contate o suporte para ajustar as variáveis do Supabase.');
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Configuração do sistema incompleta. Contate o suporte para ajustar as variáveis do Supabase.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!validatePassword(formData.password)) {
      setError('A senha deve ter 8 caracteres, uma letra maiúscula, um caractere especial e um número.');
      return;
    }

    try {
      console.info('[register] iniciando cadastro', { email: formData.email });

      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        console.error('[register] falha no cadastro', authError);
        setError(authError.message);
        return;
      }

      if (data.user) {
        const { error: profileInsertError } = await supabase
          .from('profiles')
          .insert([
            {
              id: data.user.id,
              nome: formData.name,
              email: formData.email,
              role: UserRole.CLIENT,
            },
          ]);

        if (profileInsertError) {
          console.error('[register] erro ao criar profile', profileInsertError);
          setError('Cadastro criado, mas houve falha ao criar perfil. Tente entrar novamente.');
          return;
        }

        const prefix =
          formData.unit === ServiceUnit.JURIDICO
            ? 'JURA'
            : formData.unit === ServiceUnit.ADMINISTRATIVO
              ? 'ADM'
              : 'TECAI';
        const protocol = `${prefix}-2026-00${Math.floor(Math.random() * 900) + 100}`;

        const newUser: User = {
          id: data.user.id,
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: UserRole.CLIENT,
          documentId: formData.documentId,
          taxId: formData.taxId,
          address: formData.address,
          maritalStatus: formData.maritalStatus,
          country: formData.country,
          phone: formData.phone,
          processNumber: formData.processNumber,
          unit: formData.unit,
          status: ProcessStatus.PENDENTE,
          protocol,
          registrationDate: new Date().toLocaleString('pt-BR'),
        };

        setUsers((prev) => [...prev, newUser]);
        alert('Cadastro realizado com sucesso');
        goToRoute('/login');
      }
    } catch (err) {
      console.error('[register] erro inesperado', err);
      setError('Erro inesperado. Tente novamente.');
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 text-center">
          <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Conta Criada!</h2>
          <p className="text-slate-400">Redirecionando para o login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-wider text-white">SGI FV</h1>
          <p className="text-slate-400 font-semibold uppercase text-xs mt-1">Criar Nova Conta</p>
        </div>

        <div className="p-8">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-3xl font-bold">Solicitar Registro</h2>
            <button 
              onClick={() => goToRoute('/login')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold"
            >
              <ArrowLeft className="w-4 h-4" /> VOLTAR AO LOGIN
            </button>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">E-mail</label>
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
            <label className="block text-sm font-bold text-slate-300 mb-2">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-slate-500 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
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

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Confirmar Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-slate-500 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-slate-700 rounded-lg text-white font-bold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isLoading}
              />
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
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-bold rounded-lg uppercase tracking-widest transition-all transform active:scale-95 shadow-lg flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Criando conta...</span>
              </>
            ) : (
              'Criar Conta'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-700 text-center">
          <p className="text-slate-400 text-sm">Já possui conta?</p>
          <Link
            to="/login"
            className="text-blue-400 hover:text-blue-300 font-bold text-sm transition-colors"
          >
            Faça login
          </Link>
        </div>
      </div>
      
      <p className="mt-8 text-slate-600 text-[10px] uppercase tracking-tighter">
        © 2026 SGI FV - Sistema de Gestão Integrada
      </p>
    </div>
  );
};

export default Register;
