// Cloudflare Worker: protegeix la clau de Gemini darrere d'un codi d'accés.
// Secrets/variables: GEMINI_API_KEY (secret), ACCESS_CODES (secret, separats per comes),
// ALLOWED_ORIGIN (p. ex. https://usuari.github.io — sense barra final).
const MODEL = 'gemini-3.8-flash';
const MAX_BODY = 6 * 1024 * 1024;

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export default {
  async fetch(req, env) {
    const allowed = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Headers': 'content-type,x-access-code',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      Vary: 'Origin'
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    if (allowed !== '*' && req.headers.get('Origin') !== allowed) return json({ error: 'origin' }, 403);

    const code = (req.headers.get('x-access-code') || '').trim();
    const codes = (env.ACCESS_CODES || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!code || !codes.some((c) => safeEqual(c, code))) return json({ error: 'codi incorrecte' }, 401);

    if (new URL(req.url).pathname === '/check') return json({ ok: true });

    const body = await req.text();
    if (body.length > MAX_BODY) return json({ error: 'massa gran' }, 413);

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body
    });
    return new Response(await r.text(), { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
};
