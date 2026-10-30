// Prayer-request endpoint for nearerthanyouthink.com.
// POST /api/prayer {name?, email?, message, website?} -> emails PRAYER_TO_EMAIL via Brevo.
// No dependencies; the site's nginx proxies /api/ here.
'use strict';
const http = require('http');

const {
  BREVO_API_KEY,
  PRAYER_TO_EMAIL,
  PRAYER_SENDER_EMAIL = 'hello@noorandluca.com', // only noorandluca.com is verified in Brevo
  PRAYER_SENDER_NAME = 'Nearer Than You Think',
  PORT = '3000',
  BREVO_URL = 'https://api.brevo.com/v3/smtp/email', // overridable for local testing
} = process.env;

if (!BREVO_API_KEY || !PRAYER_TO_EMAIL) {
  console.error('BREVO_API_KEY and PRAYER_TO_EMAIL are required');
  process.exit(1);
}

const MAX = { name: 80, email: 200, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 5 requests per IP per hour; plenty for a person, not for a script.
const WINDOW_MS = 60 * 60 * 1000, LIMIT = 5;
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, ts] of hits) if (ts.every(t => now - t >= WINDOW_MS)) hits.delete(ip);
}, WINDOW_MS).unref();

const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 20000) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function sendEmail({ name, email, message }) {
  const who = name || 'Someone';
  const html = `
    <p><strong>${esc(who)}</strong> asked for prayer on nearerthanyouthink.com:</p>
    <blockquote style="border-left:3px solid #c4915a;margin:16px 0;padding:4px 16px;white-space:pre-wrap">${esc(message)}</blockquote>
    <p>${email ? `They would like a reply: <a href="mailto:${esc(email)}">${esc(email)}</a> (just hit Reply).` : 'They did not leave an email address.'}</p>`;
  const payload = {
    sender: { email: PRAYER_SENDER_EMAIL, name: PRAYER_SENDER_NAME },
    to: [{ email: PRAYER_TO_EMAIL }],
    subject: `Prayer request from ${who}`,
    htmlContent: html,
    tags: ['nearerthanyouthink-prayer'],
  };
  if (email) payload.replyTo = { email, ...(name ? { name } : {}) };
  const r = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

http.createServer(async (req, res) => {
  if (req.url === '/api/health') return send(res, 200, { ok: true });
  if (req.url !== '/api/prayer' || req.method !== 'POST') return send(res, 404, { error: 'not found' });

  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress;
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'invalid request' }); }

  // Honeypot: a hidden field real visitors never fill. Pretend success.
  if (body.website) return send(res, 200, { ok: true });
  if (limited(ip)) return send(res, 429, { error: 'Too many requests. Please try again later.' });

  const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const name = clean(body.name, MAX.name);
  const email = clean(body.email, MAX.email);
  const message = clean(body.message, MAX.message);
  if (!message) return send(res, 400, { error: 'Please share what you would like prayer for.' });
  if (email && !EMAIL_RE.test(email)) return send(res, 400, { error: 'That email address does not look right.' });

  try {
    await sendEmail({ name, email, message });
    console.log(`prayer request sent (ip ${ip}, reply ${email ? 'yes' : 'no'}, ${message.length} chars)`);
    send(res, 200, { ok: true });
  } catch (e) {
    console.error('send failed:', e.message);
    send(res, 502, { error: 'We could not send your request just now. Please try again in a moment.' });
  }
}).listen(Number(PORT), () => console.log(`prayer api listening on ${PORT}`));
