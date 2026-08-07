import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { success: false, error: 'Supabase URL ou Service Role Key não configurados.' });
  }

  const url = new URL(request.url);
  const orgId = url.searchParams.get('org_id') ?? '';

  if (!orgId) {
    return jsonResponse(400, { success: false, error: 'org_id é obrigatório.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from('org_stripe_config')
    .select('default_currency, allowed_currencies')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) {
    return jsonResponse(500, { success: false, error: error.message });
  }

  const allowed = Array.isArray(data?.allowed_currencies) && (data!.allowed_currencies as string[]).length > 0
    ? data!.allowed_currencies as string[]
    : ['brl', 'eur'];

  return jsonResponse(200, {
    success: true,
    data: {
      org_id: orgId,
      default_currency: String(data?.default_currency ?? 'brl'),
      allowed_currencies: allowed.map((c) => c.toLowerCase()),
    },
  });
});
