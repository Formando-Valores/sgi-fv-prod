import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// --- Encryption helpers (AES-256-GCM) ---

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const rawHex = Deno.env.get('STRIPE_CONFIG_ENCRYPTION_KEY') ?? '';
  if (!rawHex || rawHex.length < 64) {
    throw new Error('STRIPE_CONFIG_ENCRYPTION_KEY não configurada ou muito curta (mínimo 32 bytes / 64 hex chars).');
  }
  return crypto.subtle.importKey(
    'raw',
    hexToUint8Array(rawHex),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  // Format: iv_hex:ciphertext_hex
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const ctHex = Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${ivHex}:${ctHex}`;
}

async function decrypt(encrypted: string, key: CryptoKey): Promise<string> {
  const [ivHex, ctHex] = encrypted.split(':');
  if (!ivHex || !ctHex) throw new Error('Formato de dados encriptados inválido.');
  const iv = hexToUint8Array(ivHex);
  const ciphertext = hexToUint8Array(ctHex);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return key.slice(0, 7) + '****' + key.slice(-4);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { success: false, error: 'Supabase URL ou Service Role Key não configurados.' });
  }

  // Auth via user JWT — client with JWT only (for auth verification)
  const authHeader = request.headers.get('Authorization') ?? '';
  const supabaseAuth = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return jsonResponse(401, { success: false, error: 'Não autenticado.' });
  }

  // DB operations — service role client WITHOUT Authorization header (bypasses RLS)
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Get encryption key
  let encKey: CryptoKey;
  try {
    encKey = await getEncryptionKey();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse(500, { success: false, error: `Erro de configuração de encriptação: ${msg}` });
  }

  const url = new URL(request.url);
  const orgId = url.searchParams.get('org_id') ?? '';

  if (!orgId) {
    return jsonResponse(400, { success: false, error: 'org_id é obrigatório.' });
  }

  // --- GET: Read config ---
  if (request.method === 'GET') {
    const { data, error } = await supabase
      .from('org_stripe_config')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();

    if (error) {
      return jsonResponse(500, { success: false, error: error.message });
    }

    if (!data) {
      return jsonResponse(200, { success: true, data: null });
    }

    // Decrypt secrets for admin view
    let secretKey = '';
    let webhookSecret = '';
    try {
      if (data.stripe_secret_key_encrypted) {
        secretKey = await decrypt(data.stripe_secret_key_encrypted, encKey);
      }
      if (data.stripe_webhook_secret_encrypted) {
        webhookSecret = await decrypt(data.stripe_webhook_secret_encrypted, encKey);
      }
    } catch {
      // If decryption fails, return masked only
      secretKey = '';
      webhookSecret = '';
    }

    return jsonResponse(200, {
      success: true,
      data: {
        org_id: data.org_id,
        stripe_secret_key: secretKey,
        stripe_secret_key_masked: data.secret_key_last4 ? `sk_****${data.secret_key_last4}` : '',
        stripe_webhook_secret: webhookSecret,
        stripe_webhook_secret_masked: data.webhook_secret_last4 ? `whsec_****${data.webhook_secret_last4}` : '',
        stripe_api_version: data.stripe_api_version,
        default_currency: data.default_currency,
        allowed_currencies: Array.isArray(data.allowed_currencies)
          ? data.allowed_currencies
          : [data.default_currency || 'brl'],
        checkout_product_name: data.checkout_product_name,
        is_live_mode: data.is_live_mode,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    });
  }

  // --- POST: Create or update config ---
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    const stripeSecretKey = String(body.stripe_secret_key ?? '').trim();
    const stripeWebhookSecret = String(body.stripe_webhook_secret ?? '').trim();
    const apiVersion = String(body.stripe_api_version ?? '2025-03-31.basil').trim();
    const currency = String(body.default_currency ?? 'brl').trim().toLowerCase();
    const productName = String(body.checkout_product_name ?? 'Serviço SGI FV').trim();
    const isLive = Boolean(body.is_live_mode);

    const rawCurrencies = Array.isArray(body.allowed_currencies) ? body.allowed_currencies : [currency];
    const allowedCurrencies = rawCurrencies
      .map((c) => String(c).trim().toLowerCase())
      .filter((c) => c.length > 0);
    const normalizedCurrencies = Array.from(new Set(allowedCurrencies.length > 0 ? allowedCurrencies : [currency]));
    const normalizedDefaultCurrency = normalizedCurrencies.includes(currency) ? currency : normalizedCurrencies[0];

    if (!stripeSecretKey) {
      return jsonResponse(400, { success: false, error: 'stripe_secret_key é obrigatório.' });
    }

    // Encrypt sensitive fields
    let encryptedSecret = '';
    let encryptedWebhook = '';
    let secretLast4 = '';
    let webhookLast4 = '';

    try {
      if (stripeSecretKey) {
        encryptedSecret = await encrypt(stripeSecretKey, encKey);
        secretLast4 = stripeSecretKey.slice(-4);
      }
      if (stripeWebhookSecret) {
        encryptedWebhook = await encrypt(stripeWebhookSecret, encKey);
        webhookLast4 = stripeWebhookSecret.slice(-4);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return jsonResponse(500, { success: false, error: `Erro ao encriptografar chaves: ${msg}` });
    }

    const upsertData = {
      org_id: orgId,
      stripe_secret_key_encrypted: encryptedSecret || null,
      stripe_webhook_secret_encrypted: encryptedWebhook || null,
      stripe_api_version: apiVersion,
      default_currency: normalizedDefaultCurrency,
      allowed_currencies: normalizedCurrencies,
      checkout_product_name: productName,
      is_live_mode: isLive,
      secret_key_last4: secretLast4 || null,
      webhook_secret_last4: webhookLast4 || null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('org_stripe_config')
      .upsert(upsertData, { onConflict: 'org_id' })
      .select()
      .single();

    if (error) {
      return jsonResponse(500, { success: false, error: error.message });
    }

    return jsonResponse(200, {
      success: true,
      data: {
        org_id: data.org_id,
        stripe_secret_key_masked: data.secret_key_last4 ? `sk_****${data.secret_key_last4}` : '',
        stripe_webhook_secret_masked: data.webhook_secret_last4 ? `whsec_****${data.webhook_secret_last4}` : '',
        stripe_api_version: data.stripe_api_version,
        default_currency: data.default_currency,
        allowed_currencies: Array.isArray(data.allowed_currencies)
          ? data.allowed_currencies
          : [data.default_currency || 'brl'],
        checkout_product_name: data.checkout_product_name,
        is_live_mode: data.is_live_mode,
        updated_at: data.updated_at,
      },
      message: 'Configuração Stripe atualizada com sucesso.',
    });
  }

  return jsonResponse(405, { success: false, error: 'Método não permitido.' });
});
