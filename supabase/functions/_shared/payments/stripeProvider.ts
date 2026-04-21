import Stripe from 'https://esm.sh/stripe@18.3.0?target=deno';
import type { CreateCheckoutInput, CreateCheckoutResult, PaymentProvider, WebhookInterpretation } from './domain.ts';
import { mapEventToPaymentStatus } from './status.ts';

const normalizeStripeId = (value: string | Stripe.PaymentIntent | null) => {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
};

export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe' as const;
  readonly defaultPaymentMethod = 'stripe_checkout' as const;

  private readonly client: Stripe;

  constructor(secretKey: string) {
    this.client = new Stripe(secretKey, { apiVersion: '2025-03-31.basil' });
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const session = await this.client.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency,
            unit_amount: Math.round(input.amountInCents),
            product_data: {
              name: 'Serviço SGI FV',
            },
          },
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        processId: input.processId,
        clientId: input.clientId,
        serviceId: String(input.serviceId ?? ''),
        organizationId: input.organizationId,
        areaId: String(input.areaId ?? ''),
        sectorId: String(input.sectorId ?? ''),
      },
    });

    return {
      sessionId: session.id,
      url: String(session.url ?? ''),
      provider: this.name,
      paymentMethod: this.defaultPaymentMethod,
    };
  }

  getPaymentStatusFromEventType(eventType: string) {
    return mapEventToPaymentStatus(eventType);
  }

  async interpretWebhook(rawBody: string, signature: string): Promise<WebhookInterpretation | null> {
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
    const event = await this.client.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    const actionableStatus = this.getPaymentStatusFromEventType(event.type);
    if (!actionableStatus) return null;

    let processId = '';
    let paymentIntentId: string | null = null;
    let checkoutSessionId: string | null = null;
    const metadata: Record<string, string> = {};

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      processId = String(session.metadata?.processId ?? '').trim();
      paymentIntentId = normalizeStripeId(session.payment_intent as string | Stripe.PaymentIntent | null);
      checkoutSessionId = session.id;
      Object.assign(metadata, session.metadata ?? {});
    }

    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      processId = String(paymentIntent.metadata?.processId ?? '').trim();
      paymentIntentId = paymentIntent.id;
      checkoutSessionId = String(paymentIntent.metadata?.checkoutSessionId ?? '').trim() || null;
      Object.assign(metadata, paymentIntent.metadata ?? {});
    }

    if (event.type === 'charge.refunded' || event.type === 'charge.refund.updated') {
      const charge = event.data.object as Stripe.Charge;
      processId = String(charge.metadata?.processId ?? '').trim();
      paymentIntentId = normalizeStripeId(charge.payment_intent as string | Stripe.PaymentIntent | null);
      checkoutSessionId = String(charge.metadata?.checkoutSessionId ?? '').trim() || null;
      Object.assign(metadata, charge.metadata ?? {});
    }

    return {
      eventId: event.id,
      eventType: event.type,
      processId,
      paymentStatus: actionableStatus,
      checkoutSessionId,
      paymentIntentId,
      metadata,
    };
  }
}
