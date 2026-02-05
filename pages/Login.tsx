
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { User } from '../types';
import { supabase } from '../App';

interface LoginProps {
  setCurrentUser: (user: User) => void;
  users: User[];
}

const Login: React.FC<LoginProps> = ({ setCurrentUser, users }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Utilizando supabase.auth.signInWithPassword conforme solicitado
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Email ou senha inválidos');
      return;
    }

    if (data.user) {
      // Se o login for bem-sucedido, buscamos os dados complementares do usuário 
      // no nosso estado local (ou mock) para manter a consistência do dashboard.
      const userProfile = users.find(u => u.email === email);
      
      if (userProfile) {
        setCurrentUser(userProfile);
        // O redirecionamento para o dashboard é controlado pelo estado currentUser no App.tsx
        // mas aqui forçamos a navegação caso o estado não dispare o re-render imediato.
        navigate('/dashboard');
      } else {
        // Caso o usuário exista no Auth mas não no nosso mock, 
        // poderíamos criar um perfil básico ou retornar erro.
        setError('Perfil do usuário não encontrado no sistema SGI.');
      }
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

          {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}

          <button
            type="submit"
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg uppercase tracking-widest transition-all transform active:scale-95 shadow-lg"
          >
            Autenticar no SGI
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
