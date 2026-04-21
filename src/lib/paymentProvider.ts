export type PaymentProviderName = 'stripe';

export type PaymentMethod =
  | 'stripe_checkout'
  | 'pix'
  | 'boleto'
  | 'card'
  | 'transfer'
  | 'other';

export type CreateCheckoutInput = {
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  processId: string;
  clientId: string;
  serviceId: string;
  organizationId: string;
  areaId: string;
  sectorId: string;
};

export type CreateCheckoutResult = {
  sessionId: string;
  url: string;
  provider: PaymentProviderName;
  paymentMethod: PaymentMethod;
};

export type InterpretedWebhook = {
  providerEventId: string;
  eventType: string;
  processId: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled' | 'released';
};

export type PaymentStatusResult = {
  processId: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled' | 'released';
  provider: PaymentProviderName;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  readonly defaultPaymentMethod: PaymentMethod;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  interpretWebhook(payload: string, signature?: string): Promise<InterpretedWebhook | null>;
  getPaymentStatus(processId: string): Promise<PaymentStatusResult | null>;
}
