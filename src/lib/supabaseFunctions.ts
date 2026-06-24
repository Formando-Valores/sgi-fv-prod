export const SUPABASE_EDGE_FUNCTIONS = {
  ACCESS_EMAIL_SHARED: 'accessEmail_shared',
  CREATE_CLIENT_PROCESS: 'create-client-process',
  DOCUMENT_REVIEW_NOTIFICATION: 'document-review-notification',
  FORGOT_PASSWORD: 'forgot-password',
  SEND_ACCESS_CREDENTIALS: 'send-access-credentials',
  STRIPE_CREATE_CHECKOUT_SESSION: 'stripe-create-checkout-session',
  STRIPE_CREATE_CUSTOMER_PORTAL_SESSION: 'stripe-create-customer-portal-session',
  STRIPE_RECONCILIATION: 'stripe-reconciliation',
  WIX_CLIENT_INTAKE: 'wix-client-intake',
} as const;
