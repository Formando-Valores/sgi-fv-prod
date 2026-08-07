import React, { useEffect, useState } from 'react';
import { Loader2, X, CreditCard } from 'lucide-react';
import { createCheckoutSession } from '../../lib/stripe';
import { getOrgCurrencies, amountToMinorUnits, currencySymbol } from '../../lib/stripeCurrency';

export interface CheckoutRequest {
  amountBRL: number;
  processId: string;
  clientId: string;
  serviceId: string;
  organizationId: string;
  areaId: string;
  sectorId: string;
  successUrl: string;
  cancelUrl: string;
}

interface Props {
  open: boolean;
  request: CheckoutRequest | null;
  onClose: () => void;
  onError: (message: string) => void;
  onStart: (url: string) => void;
}

const CurrencySelectModal: React.FC<Props> = ({ open, request, onClose, onError, onStart }) => {
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !request) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { allowedCurrencies } = await getOrgCurrencies(request.organizationId);
        if (cancelled) return;

        const list = Array.from(new Set(allowedCurrencies.map((c) => c.toLowerCase())));
        setCurrencies(list);

        if (list.length === 1) {
          await startCheckout(request, list[0]);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        onError(message);
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request]);

  const startCheckout = async (req: CheckoutRequest, currency: string) => {
    setStarting(currency);
    try {
      const session = await createCheckoutSession({
        amount: amountToMinorUnits(req.amountBRL, currency),
        currency,
        successUrl: req.successUrl,
        cancelUrl: req.cancelUrl,
        processId: req.processId,
        clientId: req.clientId,
        serviceId: req.serviceId,
        organizationId: req.organizationId,
        areaId: req.areaId,
        sectorId: req.sectorId,
      });
      if (session.url) {
        onStart(session.url);
      } else {
        onError('Não foi possível obter a URL de pagamento.');
        onClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onError(message);
      onClose();
    } finally {
      setStarting(null);
    }
  };

  if (!open || !request) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-[calc(100%-2rem)] sm:w-[calc(100%-3rem)] md:w-full max-w-md rounded-2xl border border-surface-100 shadow-2xl overflow-hidden animate-scaleIn">
        <div className="shrink-0 px-6 py-4 border-b border-surface-100 flex justify-between items-center bg-surface-50/80 backdrop-blur-sm">
          <h3 className="text-sm sm:text-base font-black uppercase tracking-tight flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            Escolha a moeda do pagamento
          </h3>
          <button onClick={onClose} className="p-1.5 sm:p-2 bg-surface-100 hover:bg-surface-200 rounded-full hover:scale-105 active:scale-95 transition-transform shrink-0">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-10 text-surface-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Verificando opções de pagamento...</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-surface-500 mb-2">
                Selecione em qual moeda deseja realizar o pagamento:
              </p>
              {currencies.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => void startCheckout(request, code)}
                  disabled={starting !== null}
                  className="w-full inline-flex items-center justify-between gap-3 rounded-xl bg-emerald-600 px-6 py-4 text-base font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 shadow-lg"
                >
                  <span className="flex items-center gap-2">
                    {starting === code && <Loader2 className="h-5 w-5 animate-spin" />}
                    {currencySymbol(code)} Pagar em {code.toUpperCase()}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CurrencySelectModal;
