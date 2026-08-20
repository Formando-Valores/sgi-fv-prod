export const config = {
  api: {
    bodyParser: false,
  },
};

const ALLOWED_ORIGINS = [
  'https://sgi-fv-prod.vercel.app',
  'https://sgi-fv.vercel.app',
];

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
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

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  const stripeSignature = req.headers['stripe-signature'];

  if (!stripeSignature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/stripe-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'stripe-signature': stripeSignature,
      },
      body: rawBody,
    });

    const responseBody = await response.text();
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.status(response.status).send(responseBody);
  } catch (error) {
    console.error('[stripe-webhook-proxy] error:', error);
    res.status(500).json({ error: 'Proxy error' });
  }
}
