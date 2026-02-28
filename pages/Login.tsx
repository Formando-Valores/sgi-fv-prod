/**
 * SGI FV - Login Page
 * Sistema de Gestão Integrada - Formando Valores
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';

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
    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('Email ou senha inválidos');
        } else {
          setError(authError.message);
        }
        return;
      }

      if (!data.user) {
        setError('Erro ao autenticar. Tente novamente.');
        return;
      }

      // Auth state change listener in AuthContext will handle the rest
      navigate('/dashboard');

    } catch (err) {
      console.error('Erro no login:', err);
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
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
