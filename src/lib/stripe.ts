/**
 * SGI FV - Stripe Integration (STUB)
 * 
 * TODO: Implementar integração com Stripe para:
 * - Checkout de planos/assinaturas
 * - Webhooks para atualização de status
 * - Portal do cliente
 * 
 * Referências:
 * - https://stripe.com/docs/payments/checkout
 * - https://stripe.com/docs/billing/subscriptions/webhooks
 */

// TODO: Configurar chaves Stripe
// VITE_STRIPE_PUBLISHABLE_KEY=pk_...
// STRIPE_SECRET_KEY=sk_... (apenas backend)
// STRIPE_WEBHOOK_SECRET=whsec_...

/**
 * Criar sessão de checkout
 * TODO: Implementar chamada para Stripe Checkout
 */
export async function createCheckoutSession(
  _priceId: string,
  _customerId: string
): Promise<{ url: string } | null> {
  console.warn('Stripe checkout não implementado');
  return null;
}

/**
 * Processar webhook do Stripe
 * TODO: Implementar handler para eventos:
 * - checkout.session.completed
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_failed
 */
export async function handleStripeWebhook(
  _payload: string,
  _signature: string
): Promise<boolean> {
  console.warn('Stripe webhook handler não implementado');
  return false;
}

/**
 * Criar portal do cliente
 * TODO: Implementar redirecionamento para Stripe Customer Portal
 */
export async function createCustomerPortalSession(
  _customerId: string
): Promise<{ url: string } | null> {
  console.warn('Stripe customer portal não implementado');
  return null;
}
