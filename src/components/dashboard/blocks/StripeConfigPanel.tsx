import React, { useEffect, useState } from 'react';
import { CreditCard, Eye, EyeOff, Loader2, Save, Check, AlertTriangle, Zap } from 'lucide-react';
import { getStripeConfig, updateStripeConfig, type StripeConfigData } from '../../../lib/stripeConfig';

interface Props {
  activeOrgId?: string | null;
}

const API_VERSIONS = [
  '2025-03-31.basil',
  '2024-12-18.acacia',
  '2024-11-20.acacia',
  '2024-10-16.acacia',
  '2024-06-20',
];

const CURRENCIES = [
  { code: 'brl', label: 'BRL (Real Brasileiro)' },
  { code: 'eur', label: 'EUR (Euro)' },
  { code: 'usd', label: 'USD (Dólar Americano)' },
];

const StripeConfigPanel: React.FC<Props> = ({ activeOrgId }) => {
  const [config, setConfig] = useState<StripeConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [secretKey, setSecretKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [apiVersion, setApiVersion] = useState('2025-03-31.basil');
  const [currency, setCurrency] = useState('brl');
  const [productName, setProductName] = useState('Serviço SGI FV');
  const [isLive, setIsLive] = useState(false);

  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const loadConfig = async () => {
    if (!activeOrgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFeedback(null);
    const { data, error } = await getStripeConfig(activeOrgId);
    if (error) {
      setFeedback({ type: 'error', message: error });
    }
    if (data) {
      setConfig(data);
      setSecretKey(data.stripe_secret_key || '');
      setWebhookSecret(data.stripe_webhook_secret || '');
      setApiVersion(data.stripe_api_version);
      setCurrency(data.default_currency);
      setProductName(data.checkout_product_name);
      setIsLive(data.is_live_mode);
    } else {
      setConfig(null);
      setSecretKey('');
      setWebhookSecret('');
      setApiVersion('2025-03-31.basil');
      setCurrency('brl');
      setProductName('Serviço SGI FV');
      setIsLive(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadConfig();
  }, [activeOrgId]);

  const handleSave = async () => {
    if (!activeOrgId) return;

    if (!secretKey) {
      setFeedback({ type: 'error', message: 'A Chave Secreta do Stripe é obrigatória.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const payload: Record<string, unknown> = {
      stripe_api_version: apiVersion,
      default_currency: currency,
      checkout_product_name: productName,
      is_live_mode: isLive,
    };

    // Only send keys if they were changed (avoid overwriting with empty)
    if (secretKey) payload.stripe_secret_key = secretKey;
    if (webhookSecret) payload.stripe_webhook_secret = webhookSecret;

    const { data, error } = await updateStripeConfig(activeOrgId, payload);

    setSaving(false);
    if (error) {
      setFeedback({ type: 'error', message: error });
      return;
    }

    if (data) {
      setConfig((prev) => prev ? { ...prev, ...data } : data as StripeConfigData);
      setSecretKey(data.stripe_secret_key || secretKey);
    }

    setFeedback({ type: 'success', message: 'Configuração Stripe salva com sucesso!' });
    setTimeout(() => setFeedback(null), 4000);
  };

  if (!activeOrgId) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_16px_34px_rgba(15,23,42,0.08)] p-8">
        <p className="text-gray-500 text-sm text-center">Selecione uma organização para configurar o Stripe.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_16px_34px_rgba(15,23,42,0.08)] p-8">
        <div className="flex items-center gap-3 justify-center text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Carregando configuração...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_16px_34px_rgba(15,23,42,0.08)] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
        <div className="p-2 bg-indigo-50 rounded-xl">
          <CreditCard className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-base font-black uppercase tracking-tight">Configuração Stripe</h2>
          <p className="text-xs text-gray-500 mt-0.5">Credenciais e configurações de pagamento desta organização</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Mode Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center gap-3">
            <Zap className={`w-4 h-4 ${isLive ? 'text-emerald-600' : 'text-amber-500'}`} />
            <div>
              <p className="text-sm font-bold text-gray-800">
                Modo {isLive ? 'Produção' : 'Teste'}
              </p>
              <p className="text-xs text-gray-500">
                {isLive ? 'Cobranças reais serão processadas' : 'Nenhuma cobrança real será processada'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsLive(!isLive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isLive ? 'bg-emerald-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                isLive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Warning for Live Mode */}
        {isLive && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">Modo Produção Ativo</p>
              <p className="text-xs text-amber-700 mt-1">
                Certifique-se de que a chave secreta é do modo live (sk_live_...) e que o webhook está configurado corretamente no painel do Stripe.
              </p>
            </div>
          </div>
        )}

        {/* Stripe Secret Key */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Chave Secreta do Stripe
          </label>
          <div className="relative">
            <input
              type={showSecretKey ? 'text' : 'password'}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={config?.stripe_secret_key_masked || 'sk_test_... ou sk_live_...'}
              className="w-full px-4 py-2.5 pr-10 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowSecretKey(!showSecretKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {config?.stripe_secret_key_masked && (
            <p className="text-xs text-gray-400 mt-1">Atual: {config.stripe_secret_key_masked}</p>
          )}
        </div>

        {/* Webhook Secret */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Webhook Signing Secret
          </label>
          <div className="relative">
            <input
              type={showWebhookSecret ? 'text' : 'password'}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={config?.stripe_webhook_secret_masked || 'whsec_...'}
              className="w-full px-4 py-2.5 pr-10 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowWebhookSecret(!showWebhookSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {config?.stripe_webhook_secret_masked && (
            <p className="text-xs text-gray-400 mt-1">Atual: {config.stripe_webhook_secret_masked}</p>
          )}
        </div>

        {/* API Version */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Versão da API Stripe
          </label>
          <select
            value={apiVersion}
            onChange={(e) => setApiVersion(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          >
            {API_VERSIONS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Currency + Product Name Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Moeda Padrão
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Nome do Produto no Checkout
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {feedback.message}
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center justify-between pt-2">
          {config?.updated_at && (
            <p className="text-xs text-gray-400">
              Última atualização: {new Date(config.updated_at).toLocaleString('pt-BR')}
            </p>
          )}
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StripeConfigPanel;
