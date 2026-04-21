import { supabase } from '../../supabase';
import { createCheckoutSession, handleStripeWebhook } from './stripe';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  InterpretedWebhook,
  PaymentProvider,
  PaymentStatusResult,
} from './paymentProvider';

/**
 * Adapter inicial para Stripe seguindo a interface de domínio de pagamentos.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe' as const;
  readonly defaultPaymentMethod = 'stripe_checkout' as const;

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const session = await createCheckoutSession(input);

    return {
      sessionId: session.sessionId,
      url: session.url,
      provider: this.name,
      paymentMethod: this.defaultPaymentMethod,
    };
  }

  async interpretWebhook(payload: string, signature?: string): Promise<InterpretedWebhook | null> {
    const accepted = await handleStripeWebhook(payload, signature ?? '');
    if (!accepted) return null;

    return {
      providerEventId: 'handled-by-edge-function',
      eventType: 'stripe.webhook.accepted',
      processId: '',
      paymentStatus: 'pending',
    };
  }

  async getPaymentStatus(processId: string): Promise<PaymentStatusResult | null> {
    const { data, error } = await supabase
      .from('payments')
      .select('process_id,status')
      .eq('process_id', processId)
      .eq('payment_provider', this.name)
      .maybeSingle();

    if (error || !data) return null;

    return {
      processId: String(data.process_id),
      status: data.status,
      provider: this.name,
    };
  }
}

export const stripePaymentProvider = new StripePaymentProvider();
