import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle, RefreshCcw } from 'lucide-react';
import { supabase } from '../../../supabase';
import { SUPABASE_EDGE_FUNCTIONS } from '../../lib/supabaseFunctions';
import { getPaymentStatusUi } from '../../lib/paymentStatus';

type PollState = 'checking' | 'awaiting' | 'confirmed' | 'failed' | 'expired' | 'timeout' | 'not_found' | 'error';

type ProcessPaymentSnapshot = {
  id: string;
  payment_status: string | null;
  process_status: string | null;
  updated_at: string;
};

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 90000;

const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PollState>('checking');
  const [snapshot, setSnapshot] = useState<ProcessPaymentSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryingCheckout, setRetryingCheckout] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(0);

  const sessionId = useMemo(() => {
    return searchParams.get('session_id') || searchParams.get('sessionId') || '';
  }, [searchParams]);

  const processId = useMemo(() => {
    return searchParams.get('processId') || searchParams.get('process_id') || '';
  }, [searchParams]);

  const retryUrl = useMemo(() => {
    return searchParams.get('retry_url') || '';
  }, [searchParams]);

  const shortReference = useMemo(() => {
    const ref = sessionId || processId;
    if (!ref) return '';
    if (ref.length <= 12) return ref;
    return `${ref.slice(0, 6)}...${ref.slice(-6)}`;
  }, [processId, sessionId]);

  const mapPollState = useCallback((paymentStatus: string | null): PollState => {
    const paymentUi = getPaymentStatusUi(paymentStatus);
    switch (paymentUi?.key) {
      case 'pending':
        return 'awaiting';
      case 'paid':
      case 'released':
        return 'confirmed';
      case 'failed':
        return 'failed';
      case 'canceled':
        return 'expired';
      default:
        return 'checking';
    }
  }, []);

  const fetchProcessSnapshot = useCallback(async (): Promise<ProcessPaymentSnapshot | null> => {
    if (processId) {
      const { data, error } = await supabase
        .from('processes')
        .select('id, payment_status, process_status, updated_at')
        .eq('id', processId)
        .maybeSingle();

      if (error) throw error;
      if (data) return data;
    }

    if (!sessionId) return null;

    const { data, error } = await supabase
      .from('processes')
      .select('id, payment_status, process_status, updated_at')
      .eq('stripe_checkout_session_id', sessionId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }, [processId, sessionId]);

  const handleRetryCheckout = useCallback(async () => {
    if (retryUrl) {
      window.location.assign(retryUrl);
      return;
    }

    if (!processId) {
      setErrorMessage('Não foi possível recriar o checkout sem processId. Acesse o painel e tente novamente.');
      return;
    }

    try {
      setRetryingCheckout(true);
      setErrorMessage('');

      const { data, error } = await supabase.functions.invoke(SUPABASE_EDGE_FUNCTIONS.STRIPE_CREATE_CHECKOUT_SESSION, {
        body: { processId },
      });

      if (error) throw error;

      const url = String(data?.url ?? data?.checkoutUrl ?? '');
      if (!url) throw new Error('Checkout recriado, mas sem URL de redirecionamento.');

      window.location.assign(url);
    } catch (error) {
      console.error('[payment-success] erro ao recriar checkout', error);
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao recriar checkout.');
    } finally {
      setRetryingCheckout(false);
    }
  }, [processId, retryUrl]);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const current = await fetchProcessSnapshot();
        if (cancelled) return;

        if (!current) {
          if (Date.now() - startedAt >= POLL_TIMEOUT_MS) setStatus('not_found');
          return;
        }

        setSnapshot(current);

        const resolvedState = mapPollState(current.payment_status);
        if (resolvedState !== 'checking') {
          setStatus(resolvedState);
          return;
        }

        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) setStatus('timeout');
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
  }, [fetchProcessSnapshot, mapPollState]);

  useEffect(() => {
    if (status !== 'confirmed') {
      setRedirectCountdown(0);
      return;
    }
    setRedirectCountdown(10);
    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/dashboard/processos');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status, navigate]);

  const canRetryCheckout = status === 'failed' || status === 'expired';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight">Retorno de pagamento</h1>
        <p className="mt-2 text-sm text-gray-600">Seu checkout foi finalizado. Estamos sincronizando o status oficial.</p>

        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-bold text-blue-800">Monitoramento ativo</p>
          <p className="mt-1 text-sm text-blue-700">A liberação administrativa acontece no backend, mesmo se você fechar esta página.</p>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          {(status === 'checking' || status === 'awaiting') && (
            <div className="flex items-center gap-3 text-gray-700">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-semibold">Aguardando confirmação do pagamento.</span>
            </div>
          )}

          {status === 'confirmed' && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-semibold">Pagamento confirmado. Seu processo seguirá o fluxo normal.</span>
              </div>
              <p className="text-xs text-gray-500 ml-8">Redirecionando para lista de processos em {redirectCountdown}s...</p>
            </div>
          )}

          {status === 'failed' && (
            <div className="flex items-start gap-3 text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <span className="text-sm font-semibold">Falha na confirmação do pagamento. Você pode tentar novamente.</span>
            </div>
          )}

          {status === 'expired' && (
            <div className="flex items-start gap-3 text-amber-700">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <span className="text-sm font-semibold">Checkout expirado/cancelado. Gere uma nova tentativa para concluir o pagamento.</span>
            </div>
          )}

          {status === 'timeout' && (
            <div className="flex items-start gap-3 text-amber-700">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <span className="text-sm font-semibold">A confirmação demorou mais que o esperado. Verifique novamente em alguns minutos.</span>
            </div>
          )}

          {status === 'not_found' && (
            <div className="flex items-start gap-3 text-amber-700">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <span className="text-sm font-semibold">Não localizamos o processo com os parâmetros recebidos. Verifique novamente em alguns minutos.</span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-3 text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <span className="text-sm font-semibold">Não foi possível consultar o backend agora. {errorMessage || 'Tente novamente em instantes.'}</span>
            </div>
          )}
        </div>

        <div className="mt-6 text-xs text-gray-500">
          {processId && <p>Processo: {processId}</p>}
          {shortReference && <p>Referência de suporte: {shortReference}</p>}
          {snapshot?.payment_status && <p>Status atual: {getPaymentStatusUi(snapshot.payment_status)?.label || snapshot.payment_status}</p>}
          {snapshot?.updated_at && <p>Última atualização: {new Date(snapshot.updated_at).toLocaleString('pt-BR')}</p>}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {canRetryCheckout && (
            <button
              type="button"
              onClick={() => {
                void handleRetryCheckout();
              }}
              disabled={retryingCheckout}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${retryingCheckout ? 'animate-spin' : ''}`} />
              {retryingCheckout ? 'Recriando checkout...' : 'Tentar novamente'}
            </button>
          )}
          <Link
            to="/dashboard"
            className="rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-300"
          >
            Voltar ao painel
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
