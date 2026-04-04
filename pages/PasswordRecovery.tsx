import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../supabase';

type RecoveryState = 'bootstrapping' | 'ready' | 'error';

const extractRecoveryParams = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash || '';

  const tokenLikeSegment = hash
    .split('#')
    .find((segment) => /(access_token|refresh_token|code)=/.test(segment));

  const hashQuery = (() => {
    if (!tokenLikeSegment) {
      return '';
    }

    if (tokenLikeSegment.includes('?')) {
      return tokenLikeSegment.split('?').slice(1).join('?');
    }

    return tokenLikeSegment.startsWith('/') ? '' : tokenLikeSegment;
  })();

  const hashParams = new URLSearchParams(hashQuery);

  return {
    email: hashParams.get('email') ?? searchParams.get('email'),
    token: hashParams.get('token') ?? searchParams.get('token'),
    tokenHash: hashParams.get('token_hash') ?? searchParams.get('token_hash'),
    accessToken: hashParams.get('access_token') ?? searchParams.get('access_token'),
    refreshToken: hashParams.get('refresh_token') ?? searchParams.get('refresh_token'),
    code: hashParams.get('code') ?? searchParams.get('code'),
    type: hashParams.get('type') ?? searchParams.get('type'),
  };
};

const validatePassword = (value: string) => {
  const hasMinLength = value.length >= 8;
  const hasUpper = /[A-Z]/.test(value);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  return hasMinLength && hasUpper && hasSpecial && hasNumber;
};

const PasswordRecovery: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [state, setState] = useState<RecoveryState>('bootstrapping');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => state === 'ready' && !isSubmitting, [state, isSubmitting]);

  useEffect(() => {
    const bootstrapRecoverySession = async () => {
      if (!isSupabaseConfigured) {
        setFeedback('As variáveis de ambiente do Supabase não estão configuradas neste ambiente.');
        setState('error');
        return;
      }

      const { email, token, tokenHash, accessToken, refreshToken, code, type } = extractRecoveryParams();

      if (token && email) {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'recovery',
        });

        if (error) {
          setFeedback(error.message || 'Não foi possível validar o link de recuperação.');
          setState('error');
          return;
        }

        setState('ready');
        return;
      }

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        });

        if (error) {
          setFeedback(error.message || 'Não foi possível validar o link de recuperação.');
          setState('error');
          return;
        }

        setState('ready');
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setFeedback(error.message || 'Não foi possível validar o link de recuperação.');
          setState('error');
          return;
        }

        setState('ready');
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setFeedback(error.message || 'Não foi possível validar o link de recuperação.');
          setState('error');
          return;
        }

        setState('ready');
        return;
      }

      if (type === 'recovery') {
        setFeedback('Link de recuperação inválido ou expirado. Solicite um novo link.');
        setState('error');
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setFeedback('Link de recuperação inválido ou expirado. Solicite um novo link.');
        setState('error');
        return;
      }

      setState('ready');
    };

    void bootstrapRecoverySession();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setFeedback('');

    if (password !== confirmPassword) {
      setFeedback('As senhas não coincidem.');
      return;
    }

    if (!validatePassword(password)) {
      setFeedback('A senha deve ter 8 caracteres, uma letra maiúscula, um caractere especial e um número.');
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setFeedback(error.message || 'Não foi possível redefinir a senha.');
      setIsSubmitting(false);
      return;
    }

    await supabase.auth.signOut();
    setFeedback('Senha redefinida com sucesso. Você já pode voltar ao login.');
    setPassword('');
    setConfirmPassword('');
    setIsSubmitting(false);
    setState('error');
  };

  return (
    <div className="min-h-screen bg-white text-gray-800 font-arial flex items-center justify-center p-6">
      <div className="w-full max-w-[460px] rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="text-center mb-6">
          <h1 className="m-0 text-5xl font-extrabold tracking-wide text-[#142c4c]">SGI FV</h1>
          <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-500">Formando Valores</p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <p className="m-0 text-slate-600 leading-relaxed">Defina uma nova senha para concluir o acesso à sua conta.</p>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Nova senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              disabled={!canSubmit}
              placeholder="Digite sua nova senha"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-800 outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Confirmar nova senha</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              disabled={!canSubmit}
              placeholder="Confirme sua nova senha"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-800 outline-none"
            />
          </label>

          {feedback && (
            <p className={`m-0 text-sm font-bold ${feedback.includes('sucesso') ? 'text-emerald-600' : 'text-rose-600'}`}>
              {feedback}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-extrabold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Atualizando...' : 'Atualizar senha'}
          </button>

          <Link to="/login" className="text-center font-bold text-blue-600 no-underline">
            Voltar para o login
          </Link>
        </form>
      </div>
    </div>
  );
};

export default PasswordRecovery;
