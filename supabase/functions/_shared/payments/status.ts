import type { PaymentStatus } from './domain.ts';

export const mapEventToPaymentStatus = (eventType: string): PaymentStatus | null => {
  if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') return 'paid';
  if (eventType === 'payment_intent.payment_failed') return 'failed';
  if (eventType === 'checkout.session.expired' || eventType === 'checkout.session.async_payment_failed') return 'canceled';
  if (eventType === 'charge.refunded' || eventType === 'charge.refund.updated') return 'refunded';
  return null;
};

export const mapEventToAuditCode = (eventType: string) => {
  if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') return 'payment_confirmed';
  if (eventType === 'payment_intent.payment_failed') return 'payment_failed';
  if (eventType === 'checkout.session.expired' || eventType === 'checkout.session.async_payment_failed') return 'payment_canceled';
  if (eventType === 'charge.refunded' || eventType === 'charge.refund.updated') return 'payment_refunded';
  return 'payment_updated';
};

export const resolveProcessUpdate = (paymentStatus: PaymentStatus) => {
  if (paymentStatus === 'paid') {
    return {
      paymentStatus,
      processStatus: 'liberado',
      shouldReleaseProcess: true,
    };
  }

  return {
    paymentStatus,
    processStatus: null,
    shouldReleaseProcess: false,
  };
};
