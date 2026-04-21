import React, { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

const PaymentCancel: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const processId = useMemo(() => {
    return searchParams.get('processId') || searchParams.get('process_id') || '';
  }, [searchParams]);

  const retryUrl = useMemo(() => {
    return searchParams.get('retry_url') || '';
  }, [searchParams]);

  const handleRetry = () => {
    if (retryUrl) {
      window.location.assign(retryUrl);
      return;
    }

    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight">Pagamento cancelado</h1>
        <p className="mt-2 text-sm text-gray-600">
          Não houve confirmação de pagamento. O processo permanece em <strong>pending_payment</strong> no backend.
        </p>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5" />
          <div>
            <p className="text-sm font-bold">Nenhuma liberação administrativa foi feita pelo frontend.</p>
            <p className="mt-1 text-sm">Você pode tentar novamente quando estiver pronto.</p>
          </div>
        </div>

        {processId && <p className="mt-6 text-xs text-gray-500">Processo: {processId}</p>}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500"
          >
            <RefreshCcw className="h-4 w-4" /> Tentar novamente
          </button>
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

export default PaymentCancel;
