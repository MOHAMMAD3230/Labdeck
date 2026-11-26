/* LabDeck feedback endpoint.
 *   POST /api/feedback  -> validate and store one submission in KV
 *   GET  /api/feedback  -> health check
 * Everything else is served from the static assets binding. */

const MAX_BODY = 8 * 1024;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function str(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, max);
}

function validate(body) {
  if (!body || typeof body !== 'object') return null;
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  const courseId = str(body.courseId, 40);
  if (!courseId) return null;
  return {
    id: str(body.id, 64) || crypto.randomUUID(),
    courseId,
    lessonId: body.lessonId ? str(body.lessonId, 40) : null,
    rating,
    helpful: str(body.helpful, 1000),
    confusing: str(body.confusing, 1000),
    email: str(body.email, 200),
    createdAt: str(body.createdAt, 40),
    receivedAt: new Date().toISOString()
  };
}

async function post(request, env) {
  const origin = request.headers.get('Origin');
  const url = new URL(request.url);
  if (origin && origin !== url.origin) return json({ ok: false, error: 'cross-origin' }, 403);

  const text = await request.text();
  if (text.length > MAX_BODY) return json({ ok: false, error: 'payload too large' }, 413);

  let body;
  try { body = JSON.parse(text); } catch (e) { return json({ ok: false, error: 'invalid json' }, 400); }

  const clean = validate(body);
  if (!clean) return json({ ok: false, error: 'invalid payload' }, 400);

  clean.country = (request.cf && request.cf.country) || null;

  const key = `fb:${Date.now()}:${clean.id}`;
  await env.FEEDBACK.put(key, JSON.stringify(clean), { expirationTtl: 60 * 60 * 24 * 365 });

  return json({ ok: true, id: clean.id });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/feedback') {
      if (request.method === 'POST') return post(request, env);
      if (request.method === 'GET') return json({ ok: true, service: 'labdeck-feedback' });
      return json({ ok: false, error: 'method not allowed' }, 405);
    }

    return env.ASSETS.fetch(request);
  }
};
