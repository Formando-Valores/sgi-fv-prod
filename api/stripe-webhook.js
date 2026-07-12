export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, stripe-signature');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;

  if (!anonKey || !supabaseUrl) {
    return res.status(500).json({ error: 'Missing credentials' });
  }

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const stripeSignature = req.headers['stripe-signature'];

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/stripe-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        ...(stripeSignature ? { 'stripe-signature': stripeSignature } : {}),
      },
      body: rawBody,
    });

    const responseBody = await response.text();
    res.status(response.status).send(responseBody);
  } catch (error) {
    console.error('[stripe-webhook-proxy] error:', error);
    res.status(500).json({ error: 'Proxy error' });
  }
}
