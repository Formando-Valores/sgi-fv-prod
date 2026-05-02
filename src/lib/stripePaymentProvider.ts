import { supabase } from '../../supabase';
import { createCheckoutSession } from './stripe';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  InterpretedWebhook,
  PaymentProvider,
  PaymentStatusResult,
} from './paymentProvider';

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

  async interpretWebhook(_payload: string, _signature?: string): Promise<InterpretedWebhook | null> {
    return null;
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
