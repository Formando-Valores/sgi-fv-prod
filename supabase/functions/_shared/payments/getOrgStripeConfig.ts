import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Fetches Stripe config for an org from org_stripe_config table.
 * Falls back to environment variables if no config found or decryption fails.
 */
export async function getOrgStripeConfig(
  orgId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  apiVersion: string;
  defaultCurrency: string;
  allowedCurrencies: string[];
  checkoutProductName: string;
}> {
  // Defaults from env vars (backward compatibility)
  const envSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const envWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

  if (!orgId) {
    return {
      stripeSecretKey: envSecretKey,
      stripeWebhookSecret: envWebhookSecret,
      apiVersion: '2025-03-31.basil',
      defaultCurrency: 'brl',
      allowedCurrencies: ['brl', 'eur'],
      checkoutProductName: 'Serviço SGI FV',
    };
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase
      .from('org_stripe_config')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !data) {
      return {
        stripeSecretKey: envSecretKey,
        stripeWebhookSecret: envWebhookSecret,
        apiVersion: '2025-03-31.basil',
        defaultCurrency: 'brl',
        allowedCurrencies: ['brl', 'eur'],
        checkoutProductName: 'Serviço SGI FV',
      };
    }

    // Try to decrypt the stored keys
    const encKeyHex = Deno.env.get('STRIPE_CONFIG_ENCRYPTION_KEY') ?? '';
    
    let stripeSecretKey = envSecretKey;
    let stripeWebhookSecret = envWebhookSecret;

    if (encKeyHex && data.stripe_secret_key_encrypted) {
      try {
        stripeSecretKey = await decryptFromDb(data.stripe_secret_key_encrypted, encKeyHex);
      } catch {
        // Decryption failed, use env var fallback
      }
    }

    if (encKeyHex && data.stripe_webhook_secret_encrypted) {
      try {
        stripeWebhookSecret = await decryptFromDb(data.stripe_webhook_secret_encrypted, encKeyHex);
      } catch {
        // Decryption failed, use env var fallback
      }
    }

    return {
      stripeSecretKey,
      stripeWebhookSecret,
      apiVersion: data.stripe_api_version || '2025-03-31.basil',
      defaultCurrency: data.default_currency || 'brl',
      allowedCurrencies: Array.isArray(data.allowed_currencies) && data.allowed_currencies.length > 0
        ? data.allowed_currencies
        : [data.default_currency || 'brl'],
      checkoutProductName: data.checkout_product_name || 'Serviço SGI FV',
    };
  } catch {
    // Any error, fall back to env vars
    return {
      stripeSecretKey: envSecretKey,
      stripeWebhookSecret: envWebhookSecret,
      apiVersion: '2025-03-31.basil',
      defaultCurrency: 'brl',
      allowedCurrencies: ['brl', 'eur'],
      checkoutProductName: 'Serviço SGI FV',
    };
  }
}

// --- Decryption helper (mirrors stripe-config/index.ts) ---

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function getDecryptionKey(hexKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    hexToUint8Array(hexKey),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

async function decryptFromDb(encrypted: string, encKeyHex: string): Promise<string> {
  const [ivHex, ctHex] = encrypted.split(':');
  if (!ivHex || !ctHex) throw new Error('Invalid encrypted format');
  const key = await getDecryptionKey(encKeyHex);
  const iv = hexToUint8Array(ivHex);
  const ciphertext = hexToUint8Array(ctHex);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}
