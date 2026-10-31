// Cloudflare Workers entry: static files come from the assets binding, /api/* runs the same handler as the Node server.
import app from './server.js';
import content from './public/azentio-content.json';

app.setSiteContent(content);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    for (const k of ['ANTHROPIC_API_KEY', 'SESSION_SECRET', 'AIRA_MODEL', 'MIN_COHORT']) if (env[k]) process.env[k] = env[k];
    process.env.SECURE_COOKIE = '1';
    const headers = {};
    request.headers.forEach((v, k) => { headers[k] = v; });
    const bodyText = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text();
    const req = { method: request.method, url: url.pathname + url.search, headers, async *[Symbol.asyncIterator]() { if (bodyText) yield bodyText; } };
    return new Promise((resolve) => {
      const h = new Headers(); let status = 200;
      const res = {
        setHeader: (k, v) => h.set(k, v),
        writeHead: (st, hd = {}) => { status = st; for (const k in hd) h.set(k, hd[k]); },
        end: (d) => resolve(new Response(d ?? null, { status, headers: h })),
      };
      app.handle(req, res).catch((e) => { console.error(e); resolve(new Response('{"error":"Server error"}', { status: 500, headers: { 'Content-Type': 'application/json' } })); });
    });
  },
};
