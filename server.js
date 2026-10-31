// azentio.ai — public website + governed collaboration portal.
// Zero-dependency Node server. Every protected read/write is authorised here, on the server.
const path = require('path');
const IS_WORKER = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
const fs = IS_WORKER ? null : require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const STATIC_CACHE = new Map();
const seed = require('./seed');

const PORT = process.env.PORT || 3000;
const MIN_COHORT = Number(process.env.MIN_COHORT || 3); // min distinct orgs before trend stats are shown
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const db = seed();
// Public azentio.com page content (public audience) for AIRA retrieval.
let SITE_PAGES = [];
function setSiteContent(pages) { SITE_PAGES = pages.map((p) => ({ path: p.path, name: p.name, description: p.description, text: p.sections.flatMap((s) => [s.heading, ...s.items.map((i) => i.x)]).join(' ').slice(0, 1500) })); }
if (fs) try { setSiteContent(JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'azentio-content.json'), 'utf8'))); } catch (e) { /* content file optional (Workers sets it via setSiteContent) */ }
// Sessions are HMAC-signed cookies {userId, activeOrg, expires}, so they work across processes/isolates.
const sessionSecret = () => process.env.SESSION_SECRET || (globalThis.__AZ_DEV_SECRET ||= crypto.randomBytes(32).toString('hex'));
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function signSession(s) { const p = b64u(JSON.stringify(s)); return p + '.' + b64u(crypto.createHmac('sha256', sessionSecret()).update(p).digest()); }
function readSession(tok) {
  const [p, sig] = String(tok).split('.'); if (!p || !sig) return null;
  const want = b64u(crypto.createHmac('sha256', sessionSecret()).update(p).digest());
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try { return JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch (e) { return null; }
}
const setSessionCookie = (res, s) => res.setHeader('Set-Cookie', `az_session=${signSession(s)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${process.env.SECURE_COOKIE ? '; Secure' : ''}`);

// ---------- helpers ----------
const id = (p) => p + '_' + crypto.randomBytes(5).toString('hex');
const now = () => new Date().toISOString();
const clip = (s, n) => String(s ?? '').trim().slice(0, n);
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const deny = (msg = 'Forbidden') => { throw new HttpError(403, msg); };
const bad = (msg) => { throw new HttpError(400, msg); };
const notFound = () => { throw new HttpError(404, 'Not found'); };

function audit(actor, action, target, detail = {}) {
  db.audit.unshift({ id: id('aud'), at: now(), actor: actor ? actor.email : 'system', action, target, detail });
}
function notify(userId, text, link) {
  // Persisted in-app notification (outbox). Email is P1 and is never claimed as "delivered".
  db.notifications.unshift({ id: id('ntf'), userId, text, link, read: false, at: now(), channel: 'in-app' });
}

// ---------- identity & access ----------
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32, { N: 1024 }).toString('hex');
function getSession(req) {
  const m = /(?:^|;\s*)az_session=([A-Za-z0-9_.-]+)/.exec(req.headers.cookie || '');
  const s = m && readSession(m[1]);
  if (!s || s.expires < Date.now()) return null;
  const user = db.users.find((u) => u.id === s.userId && u.active);
  return user ? { token: m[1], s, user } : null;
}
const has = (user, role) => !!user && user.roles.includes(role);
const isEmployee = (u) => has(u, 'employee');
function membership(user, orgId) {
  return user && user.memberships.find((m) => m.orgId === orgId && m.status === 'active');
}
// Active tenant comes from the server-side session, never from a client-supplied header or body.
function activeOrg(ctx) {
  if (!ctx) return null;
  const m = membership(ctx.user, ctx.s.activeOrg);
  return m ? m.orgId : null;
}
function requireAuth(ctx) { if (!ctx) throw new HttpError(401, 'Sign in required'); return ctx.user; }
function requireRole(ctx, role) { const u = requireAuth(ctx); if (!has(u, role)) deny(`Requires ${role} grant`); return u; }
function requireTenant(ctx) { requireAuth(ctx); const org = activeOrg(ctx); if (!org) deny('No active client workspace'); return org; }

// Audience check: public must be explicit; missing metadata is denied.
function canSee(ctx, audience) {
  if (!audience) return false;
  if (audience === 'public') return true;
  if (!ctx) return false;
  if (audience === 'employee') return isEmployee(ctx.user);
  if (audience === 'clients') return !!activeOrg(ctx);
  if (audience.startsWith('org:')) return activeOrg(ctx) === audience.slice(4);
  return false;
}
function entitled(ctx, product) {
  const org = db.orgs.find((o) => o.id === activeOrg(ctx));
  return !!org && org.entitlements.includes(product);
}

// ---------- collective learning ----------
const SENSITIVE = [
  [/\b\d{8,}\b/, 'Long number (possible account/ID)'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, 'Email address'],
  [/\b(password|passwd|api[_ -]?key|secret|token)\b/i, 'Credential keyword'],
  [/\b(IBAN|SWIFT|account no|acct)\b/i, 'Banking identifier'],
  [/(USD|AED|INR|EUR|\$|₹)\s?\d[\d,.]{3,}/i, 'Specific amount (possible pricing / customer figure)'],
  [/\b(customer|client) (named|called)\b/i, 'Possible customer identity'],
];
const scanSensitive = (text) => SENSITIVE.filter(([re]) => re.test(text)).map(([, label]) => label);

const TYPES = ['Market observation', 'Emerging trend', 'Product gap', 'Operational challenge', 'Successful practice', 'Improvement suggestion'];
const VISIBILITY = ['private', 'org', 'community'];
// Allowed lifecycle transitions (explicit state machine).
const TRANSITIONS = {
  draft: ['submitted', 'draft'],
  submitted: ['returned', 'published', 'rejected'],
  returned: ['submitted', 'draft'],
  published: ['withdrawn', 'under_review', 'submitted'],
  under_review: ['published', 'rejected', 'withdrawn'],
  rejected: [],
  withdrawn: [],
};
function transition(c, to, actor, detail) {
  if (!(TRANSITIONS[c.state] || []).includes(to)) bad(`Cannot move from ${c.state} to ${to}`);
  c.history.push({ at: now(), from: c.state, to, by: actor.email, ...detail });
  audit(actor, 'contribution.' + to, c.id, { from: c.state, ...detail });
  c.state = to; c.updatedAt = now();
}
function validateContribution(b) {
  const errs = [];
  if (!TYPES.includes(b.type)) errs.push('type');
  if (!b.title || b.title.trim().length < 5 || b.title.length > 120) errs.push('title (5-120 chars)');
  if (!b.body || b.body.trim().length < 20 || b.body.length > 4000) errs.push('body (20-4000 chars)');
  if (!db.products.some((p) => p.slug === b.offering)) errs.push('offering');
  if (!VISIBILITY.includes(b.visibility)) errs.push('visibility');
  if (!b.period || !/^\d{4}-Q[1-4]$/.test(b.period)) errs.push('observation period (YYYY-Qn)');
  if (!['Anecdotal', 'Internal data', 'Multiple customers', 'Published source'].includes(b.evidenceType)) errs.push('evidence type');
  if (!['Low', 'Medium', 'High'].includes(b.confidence)) errs.push('confidence');
  if (b.link && !/^https:\/\/[^\s]{4,300}$/.test(b.link)) errs.push('link (https only)');
  if (errs.length) bad('Invalid fields: ' + errs.join(', '));
}
// Who may read a source contribution (the private original).
function canReadSource(ctx, c) {
  if (!ctx) return false;
  if (c.authorId === ctx.user.id) return true;
  if (c.visibility === 'org' && activeOrg(ctx) === c.orgId && c.state !== 'draft') return true;
  // Moderators see only material that was submitted for community review, never unsubmitted drafts.
  if (has(ctx.user, 'moderator') && c.visibility === 'community' && c.state !== 'draft') return true;
  return false;
}
// The public projection of an approved shared copy: no tenant IDs, author, attachments or reviewer notes.
function sharedView(s) {
  return {
    id: s.id, title: s.title, summary: s.summary, type: s.type, offering: s.offering, industry: s.industry,
    region: s.region, period: s.period, theme: s.theme, confidence: s.confidence, evidenceType: s.evidenceType,
    attribution: s.attribution || 'De-identified contributor', version: s.version, publishedAt: s.publishedAt,
    feedback: { useful: s.feedback.useful.length, needsEvidence: s.feedback.needsEvidence.length },
  };
}
// Moderated, de-identified shared copies are the public face of collective learning: anyone may read them.
// Writing (contributing, feedback, reports) still needs a signed-in client or employee.
const sharedVisibleTo = () => db.shared.filter((s) => s.active);

function themes(ctx) {
  const groups = {};
  for (const s of sharedVisibleTo(ctx)) (groups[s.theme] ||= []).push(s);
  return Object.entries(groups).map(([theme, items]) => {
    const orgs = new Set(items.map((s) => s.orgId)).size; // repeated posts from one org count once
    const safe = orgs >= MIN_COHORT;
    const periods = items.map((s) => s.period).sort();
    return {
      theme, offerings: [...new Set(items.map((s) => s.offering))],
      contributions: items.map((s) => ({ id: s.id, title: s.title })),
      distinctOrganisations: safe ? orgs : null,
      suppressed: !safe,
      period: periods[0] + (periods.length > 1 ? ' – ' + periods[periods.length - 1] : ''),
      limitations: safe
        ? `Small sample (${orgs} organisations). Indicates a recurring signal, not market prevalence or causation.`
        : `Fewer than ${MIN_COHORT} distinct organisations — counts suppressed.`,
      ideas: db.ideas.filter((i) => i.evidence.some((e) => items.some((s) => s.id === e))).map(ideaPublic),
      lastUpdate: items.map((s) => s.publishedAt).sort().pop(),
    };
  });
}
const ideaPublic = (i) => ({ id: i.id, title: i.title, offering: i.offering, status: i.status, team: i.team, publicNote: i.publicNote, updatedAt: i.updatedAt });

// ---------- AIRA ----------
async function aira(ctx, question) {
  const q = clip(question, 500).toLowerCase();
  if (!q) bad('Ask a question');
  const words = q.split(/\W+/).filter((w) => w.length > 3);
  const score = (t) => words.reduce((n, w) => n + (t.toLowerCase().includes(w) ? 1 : 0), 0);
  // Retrieval only over material this user may see: public catalogue + approved shared copies.
  // Employee-only content and private sources are never placed in the prompt.
  const docs = [
    ...db.products.map((p) => ({ ref: 'product:' + p.slug, title: p.name, text: p.tagline + ' ' + p.description })),
    ...SITE_PAGES.map((p) => ({ ref: 'page:' + p.path, title: p.name, text: p.description + ' ' + p.text })),
    ...sharedVisibleTo(ctx).map((s) => ({ ref: 'shared:' + s.id, title: s.title, text: s.summary + ' Theme: ' + s.theme + '. Period: ' + s.period })),
  ].map((d) => ({ ...d, score: score(d.title + ' ' + d.text) })).filter((d) => d.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);

  const key = process.env.ANTHROPIC_API_KEY;
  if (key && docs.length) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: process.env.AIRA_MODEL || 'claude-sonnet-5-5', max_tokens: 600,
          system: 'You are AIRA, the azentio.ai assistant. Answer ONLY from the provided sources. Cite sources inline like [shared:abc] or [product:slug]. Say plainly when the sources are insufficient. Note that shared observations are a small, de-identified sample, not proof of market prevalence. Never give credit or business decisions.',
          messages: [{ role: 'user', content: 'Sources:\n' + docs.map((d) => `[${d.ref}] ${d.title}: ${d.text}`).join('\n') + '\n\nQuestion: ' + question }],
        }),
      });
      const j = await r.json();
      if (r.ok) return { answer: j.content.map((c) => c.text || '').join(''), sources: docs.map(({ ref, title }) => ({ ref, title })), engine: 'claude' };
    } catch (e) { /* fall through to extractive answer */ }
  }
  if (!docs.length) return { answer: 'I could not find approved material that answers this. Try asking about our products or shared learning themes.', sources: [], engine: 'retrieval' };
  return {
    answer: 'Based on approved sources:\n' + docs.slice(0, 3).map((d) => `• ${d.title} — ${d.text.slice(0, 180)}… [${d.ref}]`).join('\n') + '\n\nShared observations are a small de-identified sample, not proof of prevalence.',
    sources: docs.map(({ ref, title }) => ({ ref, title })), engine: 'retrieval',
  };
}

// ---------- Federated learning (P2, opt-in simulation) ----------
function federatedRound(actor, { dropout = 'org_pacific', clipNorm = 1.0 } = {}) {
  const rnd = mulberry(42);
  const sig = (z) => 1 / (1 + Math.exp(-z));
  // Each participant's synthetic dataset stays local; only weight deltas leave the "environment".
  const make = (n, skew) => Array.from({ length: n }, () => {
    const x = [1, rnd() * 2 - 1 + skew, rnd() * 2 - 1, rnd() * 2 - 1];
    const y = sig(2.2 * x[1] - 1.5 * x[2] + 0.8 * x[3] + (rnd() - 0.5)) > 0.5 ? 1 : 0;
    return { x, y };
  });
  const participants = db.orgs.filter((o) => o.flConsent).map((o, i) => ({ org: o, data: make(160 + i * 60, [0, 0.4, -0.3][i] || 0) }));
  const holdout = make(400, 0);
  const acc = (w, set) => set.filter(({ x, y }) => (sig(x.reduce((s, v, k) => s + v * w[k], 0)) > 0.5 ? 1 : 0) === y).length / set.length;
  let global = [0, 0, 0, 0];
  const log = [];
  for (let round = 1; round <= 5; round++) {
    const updates = [];
    for (const p of participants) {
      if (p.org.id === dropout && round === 3) { log.push({ round, org: p.org.name, status: 'dropped out' }); continue; }
      let w = global.slice();
      for (let ep = 0; ep < 20; ep++) for (const { x, y } of p.data) {
        const e = sig(x.reduce((s, v, k) => s + v * w[k], 0)) - y;
        w = w.map((wk, k) => wk - 0.05 * e * x[k]);
      }
      let delta = w.map((v, k) => v - global[k]);
      const norm = Math.hypot(...delta);
      const valid = delta.every(Number.isFinite) && norm < 50;
      if (!valid) { log.push({ round, org: p.org.name, status: 'rejected update' }); continue; }
      if (norm > clipNorm) delta = delta.map((d) => (d * clipNorm) / norm); // bounded update
      updates.push({ delta, n: p.data.length });
      log.push({ round, org: p.org.name, status: 'accepted', samples: p.data.length, updateNorm: +norm.toFixed(3), clipped: norm > clipNorm });
    }
    if (updates.length < 2) { log.push({ round, status: 'skipped: below minimum cohort' }); continue; }
    const total = updates.reduce((s, u) => s + u.n, 0);
    global = global.map((g, k) => g + updates.reduce((s, u) => s + (u.delta[k] * u.n) / total, 0)); // FedAvg, sample-weighted
  }
  const baseline = Math.max(holdout.filter((h) => h.y).length, holdout.filter((h) => !h.y).length) / holdout.length;
  const candidate = {
    id: id('model'), version: 'seasonality-risk-v' + (db.models.length + 1), at: now(), status: 'candidate — awaiting human review',
    participants: participants.map((p) => p.org.name), method: 'FedAvg (sample-weighted), L2 clip ' + clipNorm,
    holdoutAccuracy: +acc(global, holdout).toFixed(3), majorityBaseline: +baseline.toFixed(3), weights: global.map((w) => +w.toFixed(3)), log,
    caveats: 'Simulated: no secure aggregation or formal differential privacy is applied. Model updates can leak information and malicious clients can poison training. Skewed client distributions (feature shift per participant) reduce global accuracy for minority distributions. Withdrawal blocks future participation; it does not "untrain" an existing model.',
  };
  db.models.unshift(candidate);
  audit(actor, 'fl.round', candidate.id, { participants: candidate.participants.length, acc: candidate.holdoutAccuracy });
  return candidate;
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- API routes ----------
const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

function me(ctx) {
  if (!ctx) return { user: null };
  const u = ctx.user;
  return {
    user: { id: u.id, name: u.name, email: u.email, roles: u.roles },
    memberships: u.memberships.filter((m) => m.status === 'active').map((m) => ({ orgId: m.orgId, role: m.role, orgName: db.orgs.find((o) => o.id === m.orgId).name })),
    activeOrg: activeOrg(ctx), termsAccepted: u.termsAccepted,
    unread: db.notifications.filter((n) => n.userId === u.id && !n.read).length,
  };
}

// Public
route('GET', '/api/public/site', () => ({
  products: db.products, banners: db.banners.filter((b) => b.audience === 'public' && b.active),
  media: db.media.filter((m) => m.audience === 'public').map(({ id, title, kind, duration, description }) => ({ id, title, kind, duration, description })),
  insights: db.insights, events: db.events.filter((e) => e.audience === 'public'),
}));
route('POST', '/api/public/demo-request', (ctx, b) => {
  if (!b.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email || '') || !b.product) bad('Name, valid email and product are required');
  const r = { id: id('dem'), name: clip(b.name, 80), email: clip(b.email, 120), company: clip(b.company, 120), product: clip(b.product, 60), message: clip(b.message, 1000), at: now(), status: 'received' };
  db.demoRequests.push(r); audit(null, 'demo.requested', r.id);
  return { ok: true, status: 'Request received (no email has been sent yet)' };
});
route('POST', '/api/public/hackathon-register', (ctx, b) => {
  if (!b.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email || '') || !b.team) bad('Name, valid email and team are required');
  db.hackathonRegs.push({ id: id('hk'), name: clip(b.name, 80), email: clip(b.email, 120), team: clip(b.team, 80), track: clip(b.track, 80), at: now() });
  return { ok: true };
});

// Auth
route('POST', '/api/auth/login', (ctx, b, req, res) => {
  const u = db.users.find((x) => x.email === String(b.email || '').toLowerCase().trim());
  if (!u || !u.active || hashPw(String(b.password || ''), u.salt) !== u.pw) throw new HttpError(401, 'Invalid credentials');
  // Employee access needs a verified @azentio.com identity AND an approved employee grant (not the suffix alone).
  if (u.roles.includes('employee') && !u.email.endsWith('@azentio.com')) deny('Employee grant requires a verified azentio.com identity');
  const first = u.memberships.find((m) => m.status === 'active');
  const sess = { userId: u.id, activeOrg: first ? first.orgId : null, expires: Date.now() + SESSION_TTL_MS, n: crypto.randomBytes(6).toString('hex') };
  setSessionCookie(res, sess);
  audit(u, 'auth.login', u.id);
  return me({ s: sess, user: u });
});
route('POST', '/api/auth/logout', (ctx, b, req, res) => { res.setHeader('Set-Cookie', 'az_session=; Path=/; Max-Age=0'); return { ok: true }; });
route('GET', '/api/me', (ctx) => me(ctx));
route('POST', '/api/me/workspace', (ctx, b, req, res) => {
  requireAuth(ctx);
  if (!membership(ctx.user, b.orgId)) deny('Not a member of that organisation');
  ctx.s.activeOrg = b.orgId; setSessionCookie(res, ctx.s); audit(ctx.user, 'workspace.switch', b.orgId); return me(ctx);
});
route('POST', '/api/me/accept-terms', (ctx) => { requireAuth(ctx).termsAccepted = now(); return me(ctx); });
route('GET', '/api/me/notifications', (ctx) => db.notifications.filter((n) => n.userId === requireAuth(ctx).id).slice(0, 50));
route('POST', '/api/me/notifications/read', (ctx) => { const u = requireAuth(ctx); db.notifications.forEach((n) => n.userId === u.id && (n.read = true)); return { ok: true }; });

// Invitations (client onboarding)
route('GET', '/api/invite/:token', (ctx, b, req, res, p) => {
  const inv = db.invitations.find((i) => i.token === p.token);
  if (!inv || inv.status !== 'pending' || Date.parse(inv.expires) < Date.now()) notFound();
  return { orgName: db.orgs.find((o) => o.id === inv.orgId).name, role: inv.role, email: inv.email.replace(/^(.).*(@.*)$/, '$1***$2'), expires: inv.expires };
});
route('POST', '/api/invite/:token/accept', (ctx, b, req, res, p) => {
  const inv = db.invitations.find((i) => i.token === p.token);
  if (!inv || inv.status !== 'pending' || Date.parse(inv.expires) < Date.now()) notFound();
  if (!b.acceptTerms) bad('Review and accept the workspace terms first');
  let u = db.users.find((x) => x.email === inv.email);
  if (ctx && ctx.user.email !== inv.email) deny('This invitation is for a different verified account');
  if (!u) {
    if (!b.password || b.password.length < 8) bad('Choose a password of at least 8 characters');
    const salt = crypto.randomBytes(8).toString('hex');
    u = { id: id('usr'), email: inv.email, name: clip(b.name, 80) || inv.email, roles: [], memberships: [], salt, pw: hashPw(b.password, salt), active: true };
    db.users.push(u);
  }
  u.memberships.push({ orgId: inv.orgId, role: inv.role, status: 'active' });
  u.termsAccepted = now(); inv.status = 'accepted'; inv.acceptedAt = now(); // single use
  audit(u, 'invite.accepted', inv.id, { orgId: inv.orgId, role: inv.role });
  return { ok: true };
});

// Employee portal
route('GET', '/api/employee/dashboard', (ctx) => {
  const u = requireRole(ctx, 'employee');
  return {
    experiments: db.experiments, broadcasts: db.media.filter((m) => m.audience === 'employee'),
    knowledge: db.knowledge, releaseNotes: db.releaseNotes, teams: db.teams,
    ideas: db.ideas.filter((i) => has(u, 'product_owner') || i.ownerId === u.id).map((i) => ({ ...i })),
    canPublish: has(u, 'publisher'), canModerate: has(u, 'moderator'), isProductOwner: has(u, 'product_owner'),
  };
});
route('POST', '/api/employee/experiments', (ctx, b) => {
  const u = requireRole(ctx, 'employee');
  if (!b.title || b.title.length < 4 || !b.hypothesis) bad('Title and hypothesis are required');
  const e = { id: id('exp'), title: clip(b.title, 120), hypothesis: clip(b.hypothesis, 1000), owner: u.name, status: 'Submitted', at: now() };
  db.experiments.unshift(e); audit(u, 'experiment.submitted', e.id); return e;
});
route('POST', '/api/employee/knowledge/:id/feedback', (ctx, b, req, res, p) => {
  const u = requireRole(ctx, 'employee'); const k = db.knowledge.find((x) => x.id === p.id) || notFound();
  k.feedback.push({ by: u.name, text: clip(b.text, 500), at: now() }); return k;
});

// Playground (sandbox; synthetic data, deterministic scoring)
route('POST', '/api/playground/run', (ctx, b) => {
  // Visitors can try every sandbox on synthetic data; signed-in clients are limited to their entitlements.
  const product = db.products.find((p) => p.slug === b.product) || notFound();
  if (ctx && !isEmployee(ctx.user) && !entitled(ctx, product.slug)) deny('Your organisation is not entitled to this sandbox');
  const scenario = db.scenarios.find((s) => s.id === b.scenario && s.product === product.slug) || notFound();
  const i = scenario.inputs;
  const dscr = i.netOperatingIncome / i.debtService;
  const seasonalSwing = (i.peakMonthRevenue - i.troughMonthRevenue) / i.peakMonthRevenue;
  const evidence = [
    { factor: 'Debt service coverage', value: dscr.toFixed(2), effect: dscr >= 1.25 ? '+ meets policy (≥1.25)' : '− below policy (1.25)' },
    { factor: 'Seasonal revenue swing', value: Math.round(seasonalSwing * 100) + '%', effect: seasonalSwing > 0.4 ? '! high seasonality — compare on annualised basis' : 'normal' },
    { factor: 'Years trading', value: i.yearsTrading, effect: i.yearsTrading >= 3 ? '+ established' : '− limited history' },
    { factor: 'Leverage (debt/equity)', value: i.debtToEquity, effect: i.debtToEquity <= 2 ? '+ within appetite' : '− elevated' },
  ];
  const pos = evidence.filter((e) => e.effect.startsWith('+')).length;
  const run = {
    id: id('run'), at: now(), product: product.name, scenario: scenario.name,
    output: pos >= 3 ? 'Simulated: within indicative policy' : pos === 2 ? 'Simulated: refer for analyst review' : 'Simulated: outside indicative policy',
    evidence, label: 'SANDBOX — synthetic data. Simulated output, not a credit or business decision.',
    tenant: !ctx ? 'public' : isEmployee(ctx.user) ? 'internal' : activeOrg(ctx), userId: ctx ? ctx.user.id : null,
  };
  db.runs.unshift(run); db.runs.length = Math.min(db.runs.length, 500); return run;
});
route('GET', '/api/playground/scenarios', (ctx) => {
  const allowed = db.products.filter((p) => !ctx || isEmployee(ctx.user) || entitled(ctx, p.slug)).map((p) => p.slug);
  return { products: db.products.filter((p) => allowed.includes(p.slug) && db.scenarios.some((s) => s.product === p.slug)), scenarios: db.scenarios.filter((s) => allowed.includes(s.product)), runs: ctx ? db.runs.filter((r) => r.userId === ctx.user.id).slice(0, 10) : [] };
});
route('POST', '/api/playground/feedback', (ctx, b) => {
  const u = requireAuth(ctx);
  db.playgroundFeedback.push({ by: u.id, runId: clip(b.runId, 40), rating: clip(b.rating, 20), comment: clip(b.comment, 500), at: now() }); return { ok: true };
});

// Media: access enforced per item, including direct requests
route('GET', '/api/media/:id', (ctx, b, req, res, p) => {
  const m = db.media.find((x) => x.id === p.id) || notFound();
  if (!canSee(ctx, m.audience)) ctx ? deny('Not in this video\'s audience') : (() => { throw new HttpError(401, 'Sign in required'); })();
  return m;
});
route('POST', '/api/media', (ctx, b) => {
  const u = requireRole(ctx, 'publisher');
  if (!['public', 'employee', 'clients'].includes(b.audience) || !b.title) bad('Title and a valid audience are required');
  const m = { id: id('med'), title: clip(b.title, 120), description: clip(b.description, 400), kind: b.kind === 'live' ? 'live' : 'recording', audience: b.audience, duration: clip(b.duration, 20) || 'Live', at: now() };
  db.media.unshift(m); audit(u, 'media.published', m.id, { audience: m.audience }); return m;
});
route('POST', '/api/banners', (ctx, b) => {
  const u = requireRole(ctx, 'publisher');
  if (!b.title) bad('Title required');
  db.banners.forEach((x) => (x.active = false));
  const ban = { id: id('ban'), title: clip(b.title, 120), text: clip(b.text, 240), audience: 'public', active: true };
  db.banners.unshift(ban); audit(u, 'banner.published', ban.id); return ban;
});

// Client portal
route('GET', '/api/client/dashboard', (ctx) => {
  const org = requireTenant(ctx);
  const o = db.orgs.find((x) => x.id === org);
  const mine = db.contributions.filter((c) => c.orgId === org && c.authorId === ctx.user.id);
  return {
    org: { id: o.id, name: o.name, industry: o.industry, region: o.region },
    entitlements: db.products.filter((p) => o.entitlements.includes(p.slug)),
    sessions: db.events.filter((e) => canSee(ctx, e.audience)),
    media: db.media.filter((m) => m.audience === 'clients' || m.audience === 'org:' + org).map(({ id, title, kind, duration, description }) => ({ id, title, kind, duration, description })),
    resources: db.resources.filter((r) => r.audience === 'org:' + org || r.audience === 'clients'),
    contributionStatus: TRANSITIONS && Object.fromEntries(Object.keys(TRANSITIONS).map((s) => [s, mine.filter((c) => c.state === s).length])),
    ideas: db.ideas.filter((i) => i.shared).map(ideaPublic),
    role: membership(ctx.user, org).role,
  };
});
route('GET', '/api/contributions', (ctx, b, req, res, p, query) => {
  const org = requireTenant(ctx);
  const scope = query.get('scope') || 'mine';
  const list = db.contributions.filter((c) => c.orgId === org && (scope === 'mine' ? c.authorId === ctx.user.id : canReadSource(ctx, c) && c.visibility !== 'private'));
  return list.map((c) => ({ ...c, moderatorNotes: undefined, author: db.users.find((u) => u.id === c.authorId)?.name }));
});
route('POST', '/api/contributions', (ctx, b) => {
  const org = requireTenant(ctx);
  validateContribution(b);
  const c = {
    id: id('obs'), orgId: org, authorId: ctx.user.id, type: b.type, title: clip(b.title, 120), body: clip(b.body, 4000),
    offering: b.offering, industry: clip(b.industry, 60), region: clip(b.region, 60), period: b.period, evidenceType: b.evidenceType,
    confidence: b.confidence, link: b.link || '', visibility: b.visibility, state: 'draft', version: 1,
    consent: { store: true, publish: !!b.consentPublish, attribution: !!b.consentAttribution, training: !!b.consentTraining },
    consentHistory: [{ at: now(), store: true, publish: !!b.consentPublish, attribution: !!b.consentAttribution, training: !!b.consentTraining }],
    flags: scanSensitive(b.title + ' ' + b.body), history: [{ at: now(), to: 'draft', by: ctx.user.email }], moderatorNotes: [], createdAt: now(), updatedAt: now(),
  };
  db.contributions.unshift(c); audit(ctx.user, 'contribution.draft', c.id);
  return c; // Saved as a PRIVATE DRAFT. Saving never shares.
});
function ownContribution(ctx, cid) {
  const org = requireTenant(ctx);
  const c = db.contributions.find((x) => x.id === cid);
  if (!c || c.orgId !== org || c.authorId !== ctx.user.id) notFound();
  return c;
}
route('PUT', '/api/contributions/:id', (ctx, b, req, res, p) => {
  const c = ownContribution(ctx, p.id);
  if (!['draft', 'returned', 'published'].includes(c.state)) bad('This contribution cannot be edited in its current state');
  validateContribution(b);
  Object.assign(c, { type: b.type, title: clip(b.title, 120), body: clip(b.body, 4000), offering: b.offering, industry: clip(b.industry, 60), region: clip(b.region, 60), period: b.period, evidenceType: b.evidenceType, confidence: b.confidence, link: b.link || '', visibility: b.visibility });
  const consent = { store: true, publish: !!b.consentPublish, attribution: !!b.consentAttribution, training: !!b.consentTraining };
  if (JSON.stringify(consent) !== JSON.stringify(c.consent)) c.consentHistory.push({ at: now(), ...consent });
  c.consent = consent; c.flags = scanSensitive(c.title + ' ' + c.body);
  if (c.state === 'published') { c.version++; transition(c, 'submitted', ctx.user, { note: 'Material edit — new version requires renewed review' }); }
  c.updatedAt = now(); return c;
});
route('POST', '/api/contributions/:id/submit', (ctx, b, req, res, p) => {
  const c = ownContribution(ctx, p.id);
  if (c.visibility !== 'community') bad('Only contributions proposed for the learning community go to review. Change visibility first.');
  if (!c.consent.publish) bad('Explicit permission to publish a reviewed shared copy is required');
  transition(c, 'submitted', ctx.user);
  db.users.filter((u) => has(u, 'moderator')).forEach((m) => notify(m.id, `New contribution awaiting review: “${c.title}”`, '#/moderation'));
  return c;
});
route('POST', '/api/contributions/:id/withdraw', (ctx, b, req, res, p) => {
  const c = ownContribution(ctx, p.id);
  transition(c, 'withdrawn', ctx.user);
  // Synchronous invalidation: search, theme counts and AIRA retrieval are all computed from active shared copies.
  db.shared.filter((s) => s.sourceId === c.id).forEach((s) => { s.active = false; s.withdrawnAt = now(); });
  notify(ctx.user.id, `“${c.title}” withdrawn. It is removed from search and AIRA immediately; copies already viewed cannot be recalled.`);
  return c;
});
route('POST', '/api/contributions/:id/visibility', (ctx, b, req, res, p) => {
  const c = ownContribution(ctx, p.id);
  if (!VISIBILITY.includes(b.visibility)) bad('Invalid visibility');
  if (c.state !== 'draft' && c.state !== 'returned') bad('Visibility can only change on drafts');
  c.visibility = b.visibility; audit(ctx.user, 'contribution.visibility', c.id, { visibility: b.visibility }); return c;
});

// Shared learning feed & search (same visibility rules for counts, suggestions and export)
function searchShared(ctx, query) {
  const q = (query.get('q') || '').toLowerCase();
  const f = (k) => query.get(k) || '';
  return sharedVisibleTo(ctx).filter((s) =>
    (!q || (s.title + ' ' + s.summary + ' ' + s.theme).toLowerCase().includes(q)) &&
    (!f('offering') || s.offering === f('offering')) && (!f('industry') || s.industry === f('industry')) &&
    (!f('region') || s.region === f('region')) && (!f('period') || s.period === f('period')) && (!f('topic') || s.theme === f('topic'))).map(sharedView);
}
route('GET', '/api/shared', (ctx, b, req, res, p, query) => {
  const items = searchShared(ctx, query);
  const all = sharedVisibleTo(ctx);
  return { items, count: items.length, facets: { offering: [...new Set(all.map((s) => s.offering))], industry: [...new Set(all.map((s) => s.industry))], region: [...new Set(all.map((s) => s.region))], period: [...new Set(all.map((s) => s.period))].sort(), topic: [...new Set(all.map((s) => s.theme))] } };
});
route('GET', '/api/shared/export.csv', (ctx, b, req, res, p, query) => {
  const rows = searchShared(ctx, query);
  res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="shared-learning.csv"' });
  const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  res.end(['title,theme,offering,industry,region,period,confidence,attribution', ...rows.map((r) => [r.title, r.theme, r.offering, r.industry, r.region, r.period, r.confidence, r.attribution].map(esc).join(','))].join('\n'));
  return undefined;
});
route('POST', '/api/shared/:id/feedback', (ctx, b, req, res, p) => {
  const u = requireAuth(ctx); const s = db.shared.find((x) => x.id === p.id && x.active) || notFound();
  if (!sharedVisibleTo(ctx).includes(s)) notFound();
  const k = b.kind === 'needsEvidence' ? 'needsEvidence' : 'useful';
  if (!s.feedback[k].includes(u.id)) s.feedback[k].push(u.id); return sharedView(s);
});
route('POST', '/api/shared/:id/report', (ctx, b, req, res, p) => {
  const u = requireAuth(ctx); const s = db.shared.find((x) => x.id === p.id && x.active) || notFound();
  if (!sharedVisibleTo(ctx).includes(s)) notFound();
  db.reports.unshift({ id: id('rep'), sharedId: s.id, reason: clip(b.reason, 40) || 'Other', note: clip(b.note, 500), by: u.id, at: now(), status: 'open' });
  db.users.filter((x) => has(x, 'moderator')).forEach((m) => notify(m.id, `Report on shared item “${s.title}”`, '#/moderation'));
  audit(u, 'shared.reported', s.id); return { ok: true };
});
route('GET', '/api/themes', (ctx) => ({ minCohort: MIN_COHORT, themes: themes(ctx) }));
route('POST', '/api/aira', async (ctx, b) => aira(ctx, b.question));

// Moderation
route('GET', '/api/moderation/queue', (ctx) => {
  requireRole(ctx, 'moderator');
  const q = db.contributions.filter((c) => c.visibility === 'community' && ['submitted', 'under_review', 'returned'].includes(c.state));
  return {
    queue: q.map((c) => ({ ...c, orgName: db.orgs.find((o) => o.id === c.orgId).name, consentNote: c.consent.attribution ? 'Attribution permitted' : 'De-identify' })),
    reports: db.reports.filter((r) => r.status === 'open').map((r) => ({ ...r, shared: sharedView(db.shared.find((s) => s.id === r.sharedId)) })),
    published: db.shared.filter((s) => s.active).map(sharedView),
  };
});
route('POST', '/api/moderation/:id/:action', (ctx, b, req, res, p) => {
  const u = requireRole(ctx, 'moderator');
  const c = db.contributions.find((x) => x.id === p.id && x.visibility === 'community' && x.state !== 'draft') || notFound();
  if (b.note) c.moderatorNotes.push({ at: now(), by: u.email, note: clip(b.note, 1000) });
  if (p.action === 'return') { transition(c, 'returned', u, { reason: clip(b.note, 300) }); notify(c.authorId, `Clarification requested on “${c.title}”: ${clip(b.note, 200)}`, '#/client/observations'); }
  else if (p.action === 'reject') { transition(c, 'rejected', u, { reason: clip(b.note, 300) }); db.shared.filter((s) => s.sourceId === c.id).forEach((s) => (s.active = false)); notify(c.authorId, `“${c.title}” was not published: ${clip(b.note, 200) || 'see moderation reason'}`, '#/client/observations'); }
  else if (p.action === 'publish') {
    if (!c.consent.publish) deny('Author has not permitted publication');
    if (!b.title || !b.summary) bad('A reviewed title and redacted summary are required');
    const flags = scanSensitive(b.title + ' ' + b.summary);
    if (flags.length && !b.overrideFlags) bad('Redacted copy still looks sensitive: ' + flags.join(', '));
    db.shared.filter((s) => s.sourceId === c.id).forEach((s) => (s.active = false)); // supersede older version
    const s = {
      id: id('shr'), sourceId: c.id, orgId: c.orgId, title: clip(b.title, 120), summary: clip(b.summary, 1500), type: c.type, offering: c.offering,
      industry: c.industry, region: clip(b.region, 60) || c.region, period: c.period.slice(0, 4) + (b.coarsenPeriod ? '' : '-' + c.period.slice(5)),
      theme: clip(b.theme, 60) || 'Unclassified', confidence: c.confidence, evidenceType: c.evidenceType,
      attribution: c.consent.attribution && b.showAttribution ? db.orgs.find((o) => o.id === c.orgId).name : null,
      version: c.version, publishedAt: now(), active: true, feedback: { useful: [], needsEvidence: [] }, reviewedBy: u.id,
    };
    db.shared.unshift(s);
    transition(c, c.state === 'under_review' ? 'published' : 'published', u, { sharedId: s.id });
    notify(c.authorId, `“${c.title}” was published to shared learning (de-identified). Visible to authorised clients and employees.`, '#/learning');
  } else bad('Unknown action');
  return c;
});
route('POST', '/api/moderation/reports/:id/:action', (ctx, b, req, res, p) => {
  const u = requireRole(ctx, 'moderator');
  const r = db.reports.find((x) => x.id === p.id) || notFound();
  const s = db.shared.find((x) => x.id === r.sharedId); const c = db.contributions.find((x) => x.id === s.sourceId);
  if (p.action === 'unpublish') { s.active = false; transition(c, 'under_review', u, { report: r.id }); notify(c.authorId, `“${c.title}” is temporarily unpublished while a report is reviewed.`); }
  else if (p.action === 'restore') { s.active = true; if (c.state === 'under_review') transition(c, 'published', u, { report: r.id }); }
  else if (p.action === 'dismiss') { /* no change */ } else bad('Unknown action');
  r.status = p.action === 'unpublish' ? 'investigating' : 'closed'; r.decision = clip(b.note, 300) || p.action; r.decidedBy = u.email;
  audit(u, 'report.' + p.action, r.id); return r;
});

// Improvement ideas
route('GET', '/api/ideas', (ctx) => {
  if (!ctx) return db.ideas.filter((i) => i.shared).map(ideaPublic);
  if (has(ctx.user, 'product_owner')) return db.ideas;
  if (isEmployee(ctx.user)) return db.ideas.map(ideaPublic);
  requireTenant(ctx); return db.ideas.filter((i) => i.shared).map(ideaPublic);
});
const STATUSES = ['Proposed', 'Under review', 'Planned', 'In progress', 'Released', 'Not proceeding'];
route('POST', '/api/ideas', (ctx, b) => {
  const u = requireRole(ctx, 'product_owner');
  if (!b.title || !b.problem || !db.products.some((p) => p.slug === b.offering)) bad('Title, problem statement and offering are required');
  const evidence = (b.evidence || []).filter((e) => db.shared.some((s) => s.id === e && s.active)); // only permitted, approved evidence
  const i = { id: id('idea'), title: clip(b.title, 120), problem: clip(b.problem, 1000), offering: b.offering, evidence, outcome: clip(b.outcome, 500), ownerId: u.id, team: clip(b.team, 60) || 'Product', priority: ['Low', 'Medium', 'High'].includes(b.priority) ? b.priority : 'Medium', status: 'Proposed', shared: !!b.shared, publicNote: clip(b.publicNote, 300), updatedAt: now(), history: [{ at: now(), status: 'Proposed', by: u.email }] };
  db.ideas.unshift(i); audit(u, 'idea.created', i.id); return i;
});
route('POST', '/api/ideas/:id/status', (ctx, b, req, res, p) => {
  const u = requireRole(ctx, 'product_owner');
  const i = db.ideas.find((x) => x.id === p.id) || notFound();
  if (!STATUSES.includes(b.status)) bad('Invalid status');
  i.history.push({ at: now(), from: i.status, status: b.status, by: u.email }); i.status = b.status; i.updatedAt = now();
  if (b.publicNote !== undefined) i.publicNote = clip(b.publicNote, 300);
  if (b.shared !== undefined) i.shared = !!b.shared;
  audit(u, 'idea.status', i.id, { status: b.status });
  // Close the loop with contributors whose approved evidence supports this idea.
  if (i.shared) db.shared.filter((s) => i.evidence.includes(s.id)).forEach((s) => { const c = db.contributions.find((x) => x.id === s.sourceId); if (c) notify(c.authorId, `An improvement idea linked to your shared contribution is now “${b.status}”: ${i.title}`, '#/learning'); });
  return i;
});

// Client administration (own organisation only)
route('GET', '/api/org/members', (ctx) => {
  const org = requireTenant(ctx);
  if (membership(ctx.user, org).role !== 'client_admin') deny('Client administrator only');
  return {
    members: db.users.filter((u) => u.memberships.some((m) => m.orgId === org)).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.memberships.find((m) => m.orgId === org).role, status: u.memberships.find((m) => m.orgId === org).status })),
    invitations: db.invitations.filter((i) => i.orgId === org).map(({ token, ...i }) => ({ ...i, link: i.status === 'pending' ? '#/invite/' + token : null })),
  };
});
route('POST', '/api/org/invite', (ctx, b) => {
  const org = requireTenant(ctx);
  if (membership(ctx.user, org).role !== 'client_admin') deny('Client administrator only');
  if (!['client_member', 'client_admin'].includes(b.role)) deny('Clients can grant only client roles in their own organisation');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email || '')) bad('Valid email required');
  if (String(b.email).toLowerCase().endsWith('@azentio.com')) deny('Employee identities cannot be invited into a client tenant');
  const inv = { id: id('inv'), token: crypto.randomBytes(16).toString('hex'), orgId: org, email: b.email.toLowerCase(), role: b.role, status: 'pending', invitedBy: ctx.user.email, expires: new Date(Date.now() + 72 * 3600e3).toISOString(), at: now() };
  db.invitations.unshift(inv); audit(ctx.user, 'invite.created', inv.id, { role: inv.role });
  return { ...inv, token: undefined, link: '#/invite/' + inv.token, note: 'Invitation stored. Email delivery is not configured in this demo — share the link.' };
});
route('POST', '/api/org/invite/:id/revoke', (ctx, b, req, res, p) => {
  const org = requireTenant(ctx);
  if (membership(ctx.user, org).role !== 'client_admin') deny('Client administrator only');
  const inv = db.invitations.find((i) => i.id === p.id && i.orgId === org) || notFound();
  inv.status = 'revoked'; audit(ctx.user, 'invite.revoked', inv.id); return inv;
});
route('POST', '/api/org/members/:id/revoke', (ctx, b, req, res, p) => {
  const org = requireTenant(ctx);
  if (membership(ctx.user, org).role !== 'client_admin') deny('Client administrator only');
  const u = db.users.find((x) => x.id === p.id) || notFound(); const m = membership(u, org) || notFound();
  if (u.id === ctx.user.id) bad('You cannot revoke yourself');
  m.status = 'revoked'; audit(ctx.user, 'member.revoked', u.id, { org }); return { ok: true };
});

// Portal administration
route('GET', '/api/admin/overview', (ctx) => {
  requireRole(ctx, 'portal_admin');
  return {
    orgs: db.orgs, users: db.users.map(({ pw, salt, ...u }) => u), audit: db.audit.slice(0, 100),
    demoRequests: db.demoRequests, hackathonRegs: db.hackathonRegs, models: db.models, minCohort: MIN_COHORT,
    note: 'Admin role does not grant access to private client contributions; that requires an explicit moderation/support authorisation.',
  };
});
route('POST', '/api/admin/users/:id/roles', (ctx, b, req, res, p) => {
  const a = requireRole(ctx, 'portal_admin');
  const u = db.users.find((x) => x.id === p.id) || notFound();
  const valid = ['employee', 'moderator', 'publisher', 'product_owner', 'portal_admin'];
  const roles = (b.roles || []).filter((r) => valid.includes(r));
  if (roles.includes('employee') && !u.email.endsWith('@azentio.com')) bad('Employee grant requires a verified azentio.com identity');
  audit(a, 'roles.changed', u.id, { from: u.roles, to: roles }); u.roles = roles; return { ok: true };
});
route('POST', '/api/admin/orgs/:id/entitlements', (ctx, b, req, res, p) => {
  const a = requireRole(ctx, 'portal_admin');
  const o = db.orgs.find((x) => x.id === p.id) || notFound();
  o.entitlements = (b.entitlements || []).filter((e) => db.products.some((pr) => pr.slug === e));
  audit(a, 'entitlements.changed', o.id, { entitlements: o.entitlements }); return o;
});
route('POST', '/api/fl/round', (ctx, b) => federatedRound(requireRole(ctx, 'portal_admin'), b));
route('GET', '/api/fl/models', (ctx) => { requireRole(ctx, 'employee'); return db.models; });
route('POST', '/api/fl/models/:id/decision', (ctx, b, req, res, p) => {
  const a = requireRole(ctx, 'portal_admin'); const m = db.models.find((x) => x.id === p.id) || notFound();
  m.status = b.decision === 'approve' ? 'approved for staged deployment (rollback: previous version retained)' : 'rejected'; m.decidedBy = a.email;
  audit(a, 'fl.decision', m.id, { decision: b.decision }); return m;
});

// ---------- server ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json' };
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (url.pathname.startsWith('/api/')) {
    const ctx = getSession(req);
    for (const r of routes) {
      const m = req.method === r.method && r.re.exec(url.pathname);
      if (!m) continue;
      try {
        // CSRF guard for state-changing calls: require same-origin JSON.
        if (req.method !== 'GET' && !(req.headers['content-type'] || '').includes('application/json')) bad('JSON body required');
        let body = {};
        if (req.method !== 'GET') {
          let raw = ''; for await (const ch of req) { raw += ch; if (raw.length > 100_000) bad('Body too large'); }
          body = raw ? JSON.parse(raw) : {};
        }
        const out = await r.fn(ctx, body, req, res, m.groups || {}, url.searchParams);
        if (out !== undefined) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out)); }
      } catch (e) {
        const status = e.status || (e instanceof SyntaxError ? 400 : 500);
        if (status === 500) console.error(e);
        res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"Not found"}');
  }
  const file = path.join(__dirname, 'public', path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
  const real = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(__dirname, 'public', 'index.html');
  const ext = path.extname(real);
  const cache = url.pathname.startsWith('/az-img/') ? 'public, max-age=604800, immutable' : /\.(js|css|json|png|svg)$/.test(ext) ? 'public, max-age=600' : 'no-cache';
  const gz = /gzip/.test(req.headers['accept-encoding'] || '') && /\.(html|js|css|json|svg)$/.test(ext);
  const key = real + (gz ? ':gz' : '');
  const hit = STATIC_CACHE.get(key);
  const send = (data) => { res.writeHead(200, { 'Content-Type': MIME[ext] || MIME['.html'], 'Cache-Control': cache, ...(gz ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}) }); res.end(data); };
  if (hit) return send(hit);
  fs.readFile(real, (err, data) => {
    if (err) { res.writeHead(500); return res.end(); }
    const out = gz ? zlib.gzipSync(data, { level: 6 }) : data;
    STATIC_CACHE.set(key, out); send(out);
  });
}
const server = IS_WORKER ? null : require('http').createServer(handle);
if (require.main === module) server.listen(PORT, () => console.log(`azentio.ai running on http://localhost:${PORT}`));
module.exports = { server, db, handle, setSiteContent };
