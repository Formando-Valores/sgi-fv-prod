import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../../supabase';

type PollState = 'checking' | 'paid' | 'timeout' | 'not_found' | 'error';

type ProcessPaymentSnapshot = {
  id: string;
  payment_status: string | null;
  process_status: string | null;
  updated_at: string;
};

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 90000;

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PollState>('checking');
  const [snapshot, setSnapshot] = useState<ProcessPaymentSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const sessionId = useMemo(() => {
    return searchParams.get('session_id') || searchParams.get('sessionId') || '';
  }, [searchParams]);

  const processId = useMemo(() => {
    return searchParams.get('processId') || searchParams.get('process_id') || '';
  }, [searchParams]);

  const fetchProcessSnapshot = useCallback(async (): Promise<ProcessPaymentSnapshot | null> => {
    if (processId) {
      const { data, error } = await supabase
        .from('processes')
        .select('id, payment_status, process_status, updated_at')
        .eq('id', processId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) return data;
    }

    if (!sessionId) {
      return null;
    }

    const { data, error } = await supabase
      .from('processes')
      .select('id, payment_status, process_status, updated_at')
      .eq('stripe_checkout_session_id', sessionId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }, [processId, sessionId]);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const current = await fetchProcessSnapshot();

        if (cancelled) return;

        if (!current) {
          if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
            setStatus('not_found');
          }
          return;
        }

        setSnapshot(current);

        if (current.payment_status === 'paid') {
          setStatus('paid');
          return;
        }

        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          setStatus('timeout');
        }
      } catch (error) {
        if (cancelled) return;

        console.error('[payment-success] erro ao consultar status de pagamento', error);
        setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido ao consultar pagamento.');
        setStatus('error');
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [fetchProcessSnapshot]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight">Retorno de pagamento</h1>
        <p className="mt-2 text-sm text-gray-600">
          Seu checkout foi finalizado. Agora estamos aguardando a confirmação oficial do pagamento.
        </p>

        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-bold text-blue-800">Pagamento em confirmação</p>
          <p className="mt-1 text-sm text-blue-700">
            A liberação administrativa continua no backend e não depende desta página estar aberta.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          {status === 'checking' && (
            <div className="flex items-center gap-3 text-gray-700">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-semibold">Confirmando pagamento... isso pode levar alguns segundos.</span>
            </div>
          )}

          {status === 'paid' && (
            <div className="flex items-center gap-3 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-semibold">Pagamento confirmado. Seu processo seguirá o fluxo normal.</span>
            </div>
          )}

          {status === 'timeout' && (
            <div className="flex items-start gap-3 text-amber-700">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <span className="text-sm font-semibold">
                Ainda não recebemos a confirmação automática. Você pode fechar esta tela e acompanhar depois.
              </span>
            </div>
          )}

          {status === 'not_found' && (
            <div className="flex items-start gap-3 text-amber-700">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <span className="text-sm font-semibold">
                Não localizamos o processo com os parâmetros recebidos. Se necessário, tente pagar novamente.
              </span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-3 text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <span className="text-sm font-semibold">
                Não foi possível consultar o backend agora. {errorMessage || 'Tente novamente em instantes.'}
              </span>
            </div>
          )}
        </div>

        <div className="mt-6 text-xs text-gray-500">
          {processId && <p>Processo: {processId}</p>}
          {sessionId && <p>Sessão Stripe: {sessionId}</p>}
          {snapshot?.updated_at && <p>Última atualização: {new Date(snapshot.updated_at).toLocaleString('pt-BR')}</p>}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/dashboard"
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500"
          >
            Ir para o painel
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
