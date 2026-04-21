export type PaymentProviderName = 'stripe';

export type PaymentMethod =
  | 'stripe_checkout'
  | 'pix'
  | 'boleto'
  | 'card'
  | 'transfer'
  | 'other';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled' | 'released';

export type CreateCheckoutInput = {
  amountInCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  processId: string;
  clientId: string;
  serviceId?: string;
  organizationId: string;
  areaId?: string;
  sectorId?: string;
};

export type CreateCheckoutResult = {
  sessionId: string;
  url: string;
  provider: PaymentProviderName;
  paymentMethod: PaymentMethod;
};

export type WebhookInterpretation = {
  eventId: string;
  eventType: string;
  processId: string;
  paymentStatus: PaymentStatus;
  checkoutSessionId: string | null;
  paymentIntentId: string | null;
  metadata: Record<string, string>;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  readonly defaultPaymentMethod: PaymentMethod;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  interpretWebhook(rawBody: string, signature: string): Promise<WebhookInterpretation | null>;
  getPaymentStatusFromEventType(eventType: string): PaymentStatus | null;
}
