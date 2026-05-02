import Stripe from 'https://esm.sh/stripe@18.3.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Client } from 'https://deno.land/x/postgres@v0.19.3/mod.ts';

type PortalPayload = { clientId?: string; org_id?: string; returnUrl?: string };

type OwnershipRow = { id: string };
type StripeCustomerRow = { stripe_customer_id: string | null };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const getDbConnectionString = () => Deno.env.get('SUPABASE_DB_URL') ?? Deno.env.get('POSTGRES_URL') ?? Deno.env.get('DATABASE_URL') ?? '';
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { success: false, error: 'Método não permitido.' });

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const dbConnectionString = getDbConnectionString();
  if (!stripeSecretKey || !supabaseUrl || !serviceRoleKey || !dbConnectionString) return jsonResponse(500, { success: false, error: 'Ambiente não configurado.' });

  const payload = (await request.json().catch(() => ({}))) as PortalPayload;
  const clientId = String(payload.clientId ?? '').trim();
  const orgId = String(payload.org_id ?? '').trim();
  const returnUrl = String(payload.returnUrl ?? '').trim();
  if (!isUuid(clientId) || !isUuid(orgId)) return jsonResponse(400, { success: false, error: 'clientId e org_id válidos são obrigatórios.' });

  const authHeader = request.headers.get('Authorization') ?? '';
  const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!jwtToken) return jsonResponse(401, { success: false, error: 'Token de autenticação ausente.' });

  const supabase = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: `Bearer ${jwtToken}` } } });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const authedUserId = authData?.user?.id ?? null;
  if (authError || !authedUserId) return jsonResponse(401, { success: false, error: 'Usuário não autenticado.' });
  if (authedUserId !== clientId) return jsonResponse(403, { success: false, error: 'clientId divergente do usuário autenticado.' });

  const client = new Client(dbConnectionString);
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-03-31.basil' });
  try {
    await client.connect();
    const ownership = await client.queryObject<OwnershipRow>('SELECT user_id AS id FROM public.org_members WHERE user_id=$1 AND org_id=$2 LIMIT 1', [clientId, orgId]);
    if (ownership.rows.length === 0) return jsonResponse(403, { success: false, error: 'Usuário sem vínculo com a organização informada.' });

    const customerResult = await client.queryObject<StripeCustomerRow>(
      `SELECT p.stripe_customer_id
         FROM public.payments p
         JOIN public.processes pr ON pr.id = p.process_id
        WHERE p.client_id = $1
          AND pr.org_id = $2
          AND p.stripe_customer_id IS NOT NULL
        ORDER BY p.updated_at DESC
        LIMIT 1`,
      [clientId, orgId],
    );

    const stripeCustomerId = customerResult.rows[0]?.stripe_customer_id?.trim() ?? '';
    if (!stripeCustomerId) return jsonResponse(404, { success: false, error: 'Nenhum cliente Stripe vinculado para este usuário.' });

    const portalSession = await stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: returnUrl || `${supabaseUrl.replace('.supabase.co', '.supabase.co')}` });
    return jsonResponse(200, { success: true, url: portalSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar sessão do portal Stripe.';
    return jsonResponse(500, { success: false, error: message });
  } finally {
    await client.end().catch(() => undefined);
  }
});
