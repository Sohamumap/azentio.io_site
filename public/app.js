// azentio.ai SPA. The UI only reflects permissions; the server enforces them.
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let ME = { user: null }, SITE = null;

async function api(path, body, method) {
  const r = await fetch(path, { method: method || (body ? 'POST' : 'GET'), headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const j = r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), 3800); }
const run = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };
const has = (r) => ME.user?.roles.includes(r);
const isEmp = () => has('employee');
const state = (s) => `<span class="pill-state s-${esc(s)}">${esc(String(s).replace('_', ' '))}</span>`;
const fmt = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
let CONTENT = [], MEDIA = { base: '', pages: {}, insights: [], testimonials: [], logos: [], stats: [] };
const LOCAL = (s) => '/az-img/' + s.replace(/\//g, '_').replace(/\.\w+$/, '.webp');
const IMG = (s, alt) => s ? `<img src="${esc(/^https?:/.test(s) ? s : LOCAL(s))}" alt="${esc(alt || '')}" loading="lazy" decoding="async" onerror="this.parentElement.classList.add('noimg');this.remove()">` : '';
const azPage = (path) => CONTENT.find((p) => p.path === path);
const INDUSTRIES = [['/banking', 'Banking'], ['/insurance', 'Insurance'], ['/risk-compliance', 'Risk & Compliance'], ['/capital-markets', 'Capital Markets'], ['/erp', 'ERP']];
const productName = (slug) => SITE?.products.find((p) => p.slug === slug)?.name || slug;

// ---------- chrome ----------
function renderNav() {
  const pub = [...INDUSTRIES.map(([p, l]) => ['#/az' + p, l]), ['#/products', 'AI Products'], ['#/az/insights', 'Insights'], ['#/company', 'Company'], ['#/hackathon', 'Build Labs']];
  $('#navlinks').innerHTML = pub.map(([h, l]) => `<a href="${h}" class="${location.hash.startsWith(h) ? 'on' : ''}">${l}</a>`).join('');
  $('#navright').innerHTML = ME.user
    ? `<a class="btn sm ghost" href="${isEmp() ? '#/employee' : '#/client'}">Portal${ME.unread ? ` · ${ME.unread}` : ''}</a><button class="btn sm dark" id="logout">Sign out</button>`
    : `<a class="btn sm ghost" href="#/login">Sign in</a><a class="btn sm" href="#/connect">Request demo</a>`;
  const lo = $('#logout'); if (lo) lo.onclick = run(async () => { await api('/api/auth/logout', {}); ME = { user: null }; location.hash = '#/'; });
}
$('#burger').onclick = () => $('#navlinks').classList.toggle('open');

// ---------- public pages ----------
const CAPS = [
  ['Intelligent Decisioning', 'Turn policies, evidence and data into informed recommendations.', ['Evaluate applications vs configurable policies', 'Simulate policy changes', 'Evidence-backed recommendations']],
  ['Document Intelligence', 'Extract, interpret and validate complex information.', ['Classify & extract', 'Validate across documents', 'Detect inconsistencies']],
  ['AI Agents & Automation', 'Connect intelligence with workflows and human oversight.', ['Interpret tasks', 'Automate multi-step activities', 'Human approvals & audit trails']],
  ['Analytics & Insights', 'Transform data into actionable intelligence.', ['Unify data sources', 'Identify trends & root causes', 'Simulate scenarios']],
  ['Configurable AI Platforms', 'Adapt solutions to evolving business requirements.', ['Configure rules', 'Map databases & APIs', 'Track versions & approvals']],
  ['Trusted Enterprise AI', 'Designed for security, accountability and traceability.', ['Enterprise SSO & RBAC', 'Audit records', 'Human oversight & governance']],
];
const pages = {
  home() {
    const b = SITE.banners[0];
    const ind = { '/banking': 'Enables financial institutions to continually redefine themselves.', '/insurance': 'Allowing insurance companies to significantly reduce costs.', '/risk-compliance': 'Ensuring compliance and mitigating risks seamlessly worldwide.', '/capital-markets': 'Helping capital market firms embrace technologies.', '/erp': 'Providing exceptional industry cloud solutions.' };
    const awards = MEDIA.insights.filter((i) => /award|recogni|leader|named|wins|triumph/i.test(i.t)).slice(0, 6);
    const stories = MEDIA.insights.filter((i) => i.p.includes('/case-studies'));
    const tests = MEDIA.testimonials.slice(0, 3);
    return `${b ? `<div class="banner"><span><b>${esc(b.title)}</b> · ${esc(b.text)}</span><a class="btn sm lime" href="#/hackathon">Register interest</a></div>` : ''}
    <section class="xhero"><div class="xhero-in">
      <div class="xhero-copy">
        <div class="eyebrow light">Banking · Insurance · Capital Markets · ERP · AI</div>
        <h1>Transformative technology.<br><span class="g">Built with intelligence.</span></h1>
        <p class="lead">${esc(azPage('/')?.sections?.[0]?.items?.[0]?.x || '')}</p>
        <div class="cta"><a class="btn" href="#/connect">Book a demo</a><a class="btn outline-light" href="#/products">Explore AI products</a></div>
      </div>
      <div class="xhero-media">
        <div class="ph tall">${IMG(MEDIA.pages['/banking']?.hero, 'Azentio banking')}</div>
        <div class="ph">${IMG(MEDIA.pages['/insurance']?.hero, 'Azentio insurance')}</div>
        <div class="ph">${IMG(MEDIA.pages['/erp']?.hero, 'Azentio ERP')}</div>
        <div class="float-stat"><b>650+</b><span>clients in 60+ countries</span></div>
      </div>
    </div></section>
    <div class="logos"><span class="logos-label">Trusted by industry leaders</span><div class="logos-track">${[...MEDIA.logos, ...MEDIA.logos].map((l) => `<span class="logo-chip">${IMG(l.s, l.a)}</span>`).join('')}</div></div>
    <section><div class="head-row"><div><div class="eyebrow">World class technology. Regional passion.</div><h2>Purpose-built platforms for every part of financial services.</h2></div><p class="muted">${esc(azPage('/')?.sections?.[1]?.items?.[0]?.x || '')}</p></div>
      <div class="tiles">${INDUSTRIES.map(([p, l], i) => `<a class="tile ${i === 0 ? 'big' : ''}" href="#/az${p}"><div class="ph">${IMG(MEDIA.pages[p]?.hero, l)}</div><div class="tile-copy"><span class="chip">${CONTENT.filter((c) => c.path.startsWith(p + '/')).length} solutions</span><h3>${l}</h3><p>${esc(ind[p])}</p><span class="more">Explore ${l} →</span></div></a>`).join('')}</div></section>
    <div class="statband"><div class="statband-in"><div><div class="eyebrow light">Transforming technology every day</div><h2>Proven impact across the Middle East, Africa and South East Asia.</h2></div><div class="stats">${MEDIA.stats.map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('')}</div></div></div>
    <section><div class="head-row"><div><div class="eyebrow">Awards</div><h2>We're proud to be winners.</h2></div><a class="link" href="#/az/insights/awards-and-analyst-reports">All awards & analyst reports →</a></div>
      <div class="cards3">${awards.map(insightCard).join('')}</div></section>
    <section class="tint"><div class="tint-in"><div class="eyebrow">What our customers say</div><h2>Trusted to run mission-critical operations.</h2>
      <div class="quotes">${tests.map((t, i) => `<figure class="quote ${i === 0 ? 'lead-q' : ''}"><blockquote>“${esc(t.q.length > 330 ? t.q.slice(0, 330).replace(/\s\S*$/, '') + '…' : t.q)}”</blockquote><figcaption><span class="avatar">${IMG(t.img, t.n)}</span><span><b>${esc(t.n)}</b><small>${esc(t.r)}</small></span></figcaption></figure>`).join('')}</div></div></section>
    <section><div class="head-row"><div><div class="eyebrow">Case studies</div><h2>Customer stories</h2></div><a class="link" href="#/az/insights/case-studies-and-testimonials">All customer stories →</a></div>
      <div class="cards3">${stories.map(insightCard).join('')}</div></section>
    <section class="split"><div class="ph rounded">${IMG(MEDIA.pages['/']?.hero, 'Azentio team')}</div><div><div class="eyebrow">azentio.ai</div><h2>Intelligence in every layer.</h2><p class="muted">AI creates value when it becomes part of how businesses operate. azentio.ai brings applied AI to credit, documents and reporting, with a governed portal where employees and clients learn together.</p>
      <ul class="ticks">${CAPS.map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join('')}</ul><div class="cta"><a class="btn dark" href="#/products">Explore AI products</a><a class="btn ghost" href="#/login">Portal sign-in</a></div></div></section>
    <section class="split rev"><div class="ph rounded">${IMG(MEDIA.pages['/careers']?.hero, 'Careers at Azentio')}</div><div><div class="eyebrow">Committed to innovation</div><h2>Join our journey.</h2><p class="muted">We foster a culture of excellence, collaboration and innovation, where 1,900+ technology professionals build software trusted by financial institutions worldwide.</p><div class="cta"><a class="btn dark" href="#/az/careers">Careers at Azentio</a><a class="btn ghost" href="#/az/about-azentio">About us</a></div></div></section>
    ${ctaBand()}`;
  },
  products() { return `<section><div class="eyebrow">Product catalogue</div><h1>Products</h1><p class="lead">Applied AI products for lenders, banks and financial institutions.</p><div class="grid">${SITE.products.map(productCard).join('')}</div></section>`; },
  product(slug) {
    const p = SITE.products.find((x) => x.slug === slug); if (!p) return pages.notfound();
    return `<section><a href="#/products" class="muted small">← All products</a><div class="eyebrow">${esc(p.category)}</div><h1>${esc(p.name)}</h1><p class="lead">${esc(p.description)}</p>
    <div class="grid">${p.features.map((f) => `<div class="card flat"><h3>✦ ${esc(f)}</h3></div>`).join('')}</div>
    <div class="row" style="margin-top:24px;max-width:520px"><a class="btn" href="#/connect?product=${p.slug}">Request a demo</a><a class="btn ghost" href="#/login">Try in the sandbox (sign in)</a></div></section>`;
  },
  solutions() {
    const sol = [['Banks', 'SME lending, policy simulation, regulatory reporting', ['sme-credit-decisioning', 'credit-strategy-simulator', 'riva']], ['Microfinance', 'Fast, explainable small-business analysis', ['financial-analysis-intelligence', 'document-intelligence']], ['Trade & supply-chain finance', 'Portfolio context for every application', ['similar-portfolio-intelligence', 'document-intelligence']]];
    return `<section><div class="eyebrow">Solutions</div><h1>Solutions by industry</h1><div class="grid">${sol.map(([t, d, ps]) => `<div class="card"><h3>${t}</h3><p class="muted">${d}</p>${ps.map((s) => `<a class="tag navy" href="#/products/${s}">${esc(productName(s))}</a>`).join('')}</div>`).join('')}</div></section>`;
  },
  lab() { return `<section><div class="eyebrow">Innovation</div><h1>AI Lab & Technology</h1><p class="lead">Our AI Lab turns experiments into governed products: retrieval with citations, explainable scoring, human-in-the-loop agents, and an opt-in federated learning programme where client data never leaves the client environment.</p><div class="grid">${['Retrieval with citations', 'Explainable decisioning', 'Human-in-the-loop agents', 'Federated learning (opt-in)', 'Enterprise SSO & RBAC', 'Audit by design'].map((t) => `<div class="card flat"><h3>${t}</h3></div>`).join('')}</div><p class="muted small">Internal experiments and prototype notes are available to employees in the portal.</p></section>`; },
  media() { return `<section><div class="eyebrow">Media & videos</div><h1>See it in action</h1><div class="grid">${SITE.media.map((m) => `<div class="card"><div class="video">▶</div><span class="tag">${esc(m.kind)}</span><span class="tag navy">${esc(m.duration)}</span><h3>${esc(m.title)}</h3><p class="muted small">${esc(m.description)}</p></div>`).join('')}</div><p class="muted small">Employee broadcasts and client briefings are available inside the portal to their configured audiences.</p></section>`; },
  insights() { return `<section><div class="eyebrow">Insights</div><h1>Perspectives on applied AI</h1><div class="grid">${SITE.insights.map((i) => `<div class="card"><span class="tag">${esc(i.tag)}</span><h3>${esc(i.title)}</h3><p class="muted small">${i.minutes} min read</p></div>`).join('')}</div></section>`; },
  about() { return `<section><div class="eyebrow">About</div><h1>We build intelligence and create shared value.</h1><p class="lead">azentio.ai is Azentio's home for applied AI: product discovery for the public, an exclusive workspace for employees, and organisation-specific workspaces for clients — connected by governed collective learning that improves our offerings.</p><div class="grid"><div class="card"><h3>Public discovery</h3><p class="muted">Explore products, media and insights. Request demos and join Build Labs.</p></div><div class="card"><h3>Employee innovation</h3><p class="muted">Sandbox playground, experiments, internal broadcasts and improvement ideas.</p></div><div class="card"><h3>Client collaboration</h3><p class="muted">Entitled demos, private observations, and moderated, de-identified shared learning.</p></div></div></section>`; },
  connect() {
    const pre = new URLSearchParams(location.hash.split('?')[1] || '').get('product') || '';
    return `<section style="max-width:720px"><div class="eyebrow">Connect</div><h1>Request a demo</h1><form class="stack card" id="demo"><div class="row"><label>Name<input name="name" required maxlength="80"></label><label>Work email<input name="email" type="email" required></label></div><label>Company<input name="company" maxlength="120"></label><label>Product<select name="product">${SITE.products.map((p) => `<option value="${p.slug}" ${p.slug === pre ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label><label>What would you like to see?<textarea name="message" maxlength="1000"></textarea></label><button class="btn">Send request</button></form></section>`;
  },
  hackathon() { return `<section style="max-width:780px"><div class="eyebrow">Azentio Build Labs</div><h1>You're in? <span class="g">Build with us.</span></h1><p class="lead">Top teams from 2,000+ applicants build applied AI with Azentio mentors. Register your team's interest.</p><form class="stack card" id="hack"><div class="row"><label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label></div><div class="row"><label>Team<input name="team" required></label><label>Track<select name="track"><option>AI Website & Employee Portal</option><option>Document Intelligence</option><option>Credit Decisioning</option></select></label></div><button class="btn lime">Register interest</button></form></section>`; },
  login() {
    const demo = [['priya@azentio.com', 'Employee'], ['omar@azentio.com', 'Product owner'], ['lena@azentio.com', 'Learning moderator'], ['ravi@azentio.com', 'Content publisher'], ['admin@azentio.com', 'Portal administrator'], ['sara@gulfhorizon.example', 'Client admin · Gulf Horizon'], ['tom@gulfhorizon.example', 'Client member · Gulf Horizon'], ['amina@sahel.example', 'Client member · Sahel'], ['kenji@pacifictrade.example', 'Client · 2 organisations']];
    return `<section class="grid two" style="max-width:1000px"><div><div class="eyebrow">Portal</div><h1>Sign in</h1><p class="muted">Employees: verified @azentio.com identity with an approved membership. Clients: by invitation to a registered organisation.</p><form class="stack card" id="login"><label>Email<input name="email" type="email" required></label><label>Password<input name="password" type="password" required></label><button class="btn">Sign in</button></form></div>
    <div class="card flat demo-accounts"><h3>Seeded demo accounts</h3><p class="muted small">Password for all: <code>demo1234</code>. Each has least-privilege grants.</p><div class="stack" style="display:grid;gap:6px">${demo.map(([e, r]) => `<button class="btn ghost sm" data-demo="${e}"><b>${r}</b>&nbsp;<span class="muted">${e}</span></button>`).join('')}</div></div></section>`;
  },
  async invite(token) {
    const inv = await api('/api/invite/' + encodeURIComponent(token)).catch(() => null);
    if (!inv) return `<section><h1>Invitation unavailable</h1><p class="muted">This invitation is invalid, used, revoked or expired.</p></section>`;
    return `<section style="max-width:720px"><div class="eyebrow">Invitation</div><h1>Join ${esc(inv.orgName)}</h1><p class="muted">Proposed role: <b>${esc(inv.role.replace('_', ' '))}</b> · for ${esc(inv.email)} · expires ${fmt(inv.expires)}</p>
    <div class="notice green"><b>Workspace terms & sharing.</b> Joining this workspace is <b>not</b> consent to share your observations or to train any model. Every contribution starts as a private draft. Sharing beyond your organisation requires your explicit choice and moderation. Model-training consent is separate and optional.</div>
    <form class="stack card" id="accept" data-token="${esc(token)}"><label>Your name<input name="name"></label><label>Choose a password (min 8)<input name="password" type="password" minlength="8"></label><label class="check"><input type="checkbox" name="acceptTerms" required> I have read the workspace terms and the learning-sharing explanation.</label><button class="btn">Accept invitation</button></form></section>`;
  },
  az(path) {
    const pg = azPage(path); if (!pg) return pages.notfound();
    const md = MEDIA.pages[path] || { gallery: [] };
    const kids = path === '/' ? [] : CONTENT.filter((c) => c.path.startsWith(path + '/') && c.path.split('/').length === path.split('/').length + 1);
    const segs = path.split('/').filter(Boolean);
    const crumbs = segs.slice(0, -1).map((_, i) => '/' + segs.slice(0, i + 1).join('/'));
    const isLeaders = path === '/our-leadership';
    const gal = isLeaders ? [] : md.gallery.filter((g) => !/768x347/.test(g.s) && (/\.(jpe?g|webp)$/i.test(g.s) || /banner|product|people|team|career|about|culture|office|employee|cloud|gallery/i.test(g.s)));
    const secs = pg.sections.filter((s) => s.heading || s.items.length > 1);
    let gi = 0;
    const secHtml = secs.map((sec, i) => {
      const hs = sec.items.filter(isHead).length;
      const body = sec.items.length > 6 || hs > 2
        ? `<div class="feat">${groupItems(sec.items).map((g) => `<div>${g.h ? `<h3>${esc(g.h)}</h3>` : ''}${g.p.map((x) => `<p>${esc(x)}</p>`).join('')}</div>`).join('')}</div>`
        : sec.items.map((x) => (x.t === 'h' ? `<h3>${esc(x.x)}</h3>` : `<p>${esc(x.x)}</p>`)).join('');
      const img = !isLeaders && sec.items.length <= 8 && gal[gi] ? gal[gi++] : null;
      return img ? `<section class="split ${i % 2 ? 'rev' : ''}"><div class="ph rounded">${IMG(img.s, img.a)}</div><div>${sec.heading ? `<h2>${esc(sec.heading)}</h2>` : ''}<div class="prose">${body}</div></div></section>`
        : `<section class="block">${sec.heading ? `<h2>${esc(sec.heading)}</h2>` : ''}<div class="prose wide">${body}</div></section>`;
    }).join('');
    const people = isLeaders ? `<section><div class="people">${md.gallery.filter((g) => / - /.test(g.a) || /hari/i.test(g.s)).map((g) => { const [n0, r] = g.a.split(/ - /); const first = (n0 || g.s.split('/').pop().split(/[-.]/)[0]).trim(); const full = pg.sections.flatMap((x) => x.items).find((x) => x.x.toLowerCase().startsWith(first.toLowerCase().slice(0, 4)) && x.x.length < 40); const n = full ? full.x : first; return `<figure class="person"><div class="ph">${IMG(g.s, g.a)}</div><figcaption><b>${esc(n)}</b><small>${esc(r || 'Leadership team')}</small></figcaption></figure>`; }).join('')}</div></section>` : '';
    const rel = MEDIA.insights.filter((x) => x.p && x.p !== path && (path.startsWith('/insights') ? x.p.startsWith(path) : relTo(path, x))).slice(0, 3);
    return `<section class="phero"><div class="phero-in">
      <div><nav class="crumbs"><a href="#/">Home</a>${crumbs.map((c) => `<span>/</span><a href="#/az${c}">${esc(azPage(c)?.name || c.split('/').pop().replace(/-/g, ' '))}</a>`).join('')}</nav>
      <h1>${esc(pg.name)}</h1><p class="lead">${esc(pg.description)}</p>
      <div class="cta"><a class="btn" href="#/connect">Book a demo</a><a class="btn ghost" href="https://www.azentio.com${esc(path)}" target="_blank" rel="noopener">View on azentio.com ↗</a></div></div>
      ${md.hero ? `<div class="ph rounded hero-img">${IMG(md.hero, pg.name)}</div>` : ''}</div></section>
    ${kids.length ? `<section><div class="eyebrow">Explore</div><h2>${segs.length === 1 ? 'Solutions' : 'In this section'}</h2><div class="cards3">${kids.map(azCard).join('')}</div></section>` : ''}
    ${people}${secHtml}
    ${INDUSTRIES.some(([p]) => path.startsWith(p)) ? `<div class="logos"><span class="logos-label">Trusted by industry leaders</span><div class="logos-track">${[...MEDIA.logos, ...MEDIA.logos].map((l) => `<span class="logo-chip">${IMG(l.s, l.a)}</span>`).join('')}</div></div>` : ''}
    ${rel.length ? `<section><div class="eyebrow">Insights</div><h2>Related reading</h2><div class="cards3">${rel.map(insightCard).join('')}</div></section>` : ''}
    ${ctaBand()}`;
  },
  company() {
    const list = ['/about-azentio', '/our-leadership', '/our-presence', '/careers', '/partner-with-us/reach-partner-program', '/contact-us'];
    return `<section class="phero"><div class="phero-in"><div><div class="eyebrow">Company</div><h1>About Azentio</h1><p class="lead">${esc(azPage('/about-azentio')?.description || '')}</p><div class="cta"><a class="btn" href="#/az/about-azentio">Our story</a><a class="btn ghost" href="#/az/careers">Careers</a></div></div><div class="ph rounded hero-img">${IMG(MEDIA.pages['/about-azentio']?.hero, 'About Azentio')}</div></div></section>
    <div class="statband"><div class="statband-in"><div><div class="eyebrow light">Azentio at a glance</div><h2>World class technology. Regional passion.</h2></div><div class="stats">${MEDIA.stats.map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('')}</div></div></div>
    <section><div class="cards3">${list.map((p) => azPage(p)).filter(Boolean).map(azCard).join('')}<a class="xcard" href="#/about"><div class="ph">${IMG(MEDIA.pages['/']?.hero, 'azentio.ai')}</div><div class="xcard-body"><span class="chip">azentio.ai</span><h3>The azentio.ai portal</h3><p>Public discovery, employee innovation and client collaboration.</p></div></a></div></section>`;
  },
  notfound() { return `<section><h1>Page not found</h1><a class="btn" href="#/">Home</a></section>`; },
};
const azCard = (p) => `<a class="xcard" href="#/az${p.path}"><div class="ph">${IMG(MEDIA.pages[p.path]?.hero || MEDIA.pages[p.path]?.gallery?.[0]?.s, p.name)}</div><div class="xcard-body"><h3>${esc(p.name)}</h3><p>${esc((p.description || '').slice(0, 150))}</p><span class="more">Learn more →</span></div></a>`;
const insightCard = (x) => `<a class="xcard" href="${x.p ? '#/az' + esc(x.p) : 'https://www.azentio.com/insights'}" ${x.p ? '' : 'target="_blank" rel="noopener"'}><div class="ph wide">${IMG(x.s, x.t)}</div><div class="xcard-body"><span class="chip">${/case-stud/.test(x.p) ? 'Case study' : /award|recogni|leader|wins/i.test(x.t) ? 'Award' : 'Insight'}</span><h3>${esc(x.t)}</h3><span class="more">Read more →</span></div></a>`;
const ctaBand = () => `<section class="ctaband"><div class="ph">${IMG('2026/07/demo_link_nw-scaled-1.webp', 'Book a demo')}</div><div class="ctaband-copy"><div class="eyebrow light">See it in action</div><h2>Ready to transform your business?</h2><p>Talk to our experts and see how Azentio's platforms and applied AI fit your institution.</p><div class="cta"><a class="btn" href="#/connect">Book a demo</a><a class="btn outline-light" href="#/az/contact-us">Contact us</a></div></div></section>`;
const isHead = (it) => it.t === 'h' || (it.x.length < 48 && !/[.!?:,]$/.test(it.x));
function groupItems(items) { const out = []; let cur = null; for (const it of items) { const h = isHead(it); if (h || !cur) { cur = { h: h ? it.x : '', p: [] }; out.push(cur); if (h) continue; } cur.p.push(it.x); } return out.filter((g) => g.h || g.p.length); }
function relTo(path, x) { const key = { '/banking': /bank|lend|imal|islamic/i, '/insurance': /insur|qiic|claims/i, '/risk-compliance': /aml|sanction|kyc|risk|compliance|fraud/i, '/capital-markets': /wealth|capital|pnb|mfund/i, '/erp': /erp|invoic|enterprises|printing/i }; const k = Object.keys(key).find((p) => path.startsWith(p)); return k ? key[k].test(x.t + ' ' + x.p) : false; }
const productCard = (p) => `<div class="card"><div class="eyebrow">${esc(p.category)}</div><h3>${esc(p.name)}</h3><p class="muted small">${esc(p.tagline)}</p><a class="btn sm ghost" href="#/products/${p.slug}">Explore product</a></div>`;

// ---------- portal ----------
function portalShell(active, body) {
  const ws = ME.memberships || [];
  const links = [];
  if (isEmp()) {
    links.push(['label', 'Employee'], ['#/employee', 'Dashboard'], ['#/playground', 'Playground'], ['#/broadcasts', 'Live & recordings'], ['#/knowledge', 'Knowledge & experiments']);
    links.push(['label', 'Collective learning'], ['#/learning', 'Shared learning'], ['#/themes', 'Theme dashboard'], ['#/ideas', 'Improvement ideas']);
    if (has('moderator')) links.push(['#/moderation', 'Moderation queue']);
    if (has('publisher')) links.push(['label', 'Content'], ['#/publisher', 'Publish content']);
    if (has('portal_admin')) links.push(['label', 'Administration'], ['#/admin', 'Portal admin'], ['#/fl', 'Federated learning (P2)']);
  } else {
    links.push(['label', 'Workspace'], ['#/client', 'Dashboard'], ['#/playground', 'Sandbox demos'], ['#/client/observations', 'My observations'], ['#/client/org-observations', "Our organisation's"], ['#/client/new', 'New observation']);
    links.push(['label', 'Community'], ['#/learning', 'Shared learning'], ['#/themes', 'Themes'], ['#/ideas', 'Improvement status']);
    if (ME.memberships?.find((m) => m.orgId === ME.activeOrg)?.role === 'client_admin') links.push(['label', 'Organisation'], ['#/client/org', 'Members & invitations']);
  }
  links.push(['label', 'Me'], ['#/notifications', `Notifications${ME.unread ? ` (${ME.unread})` : ''}`]);
  const org = ws.find((m) => m.orgId === ME.activeOrg);
  return `<div class="portal"><nav class="side">${links.map(([h, l]) => (h === 'label' ? `<div class="label">${l}</div>` : `<a href="${h}" class="${h === active ? 'on' : ''}">${l}</a>`)).join('')}</nav>
  <div class="content"><div class="ws"><span>Signed in as <b>${esc(ME.user.name)}</b></span>${ME.user.roles.map((r) => `<span class="tag navy">${esc(r.replace('_', ' '))}</span>`).join('')}
  ${org ? `<span>· Active organisation: <b>${esc(org.orgName)}</b></span>` : ''}${ws.length > 1 ? `<select id="wsswitch" style="max-width:280px">${ws.map((m) => `<option value="${m.orgId}" ${m.orgId === ME.activeOrg ? 'selected' : ''}>${esc(m.orgName)}</option>`).join('')}</select>` : ''}</div>${body}</div></div>`;
}
const portal = {
  async employee() {
    const d = await api('/api/employee/dashboard');
    return portalShell('#/employee', `<h1>Employee dashboard</h1><p class="muted">Internal only. Never shown in public or client search, or to AIRA for clients.</p>
    <div class="grid"><a class="card" href="#/playground" style="text-decoration:none"><h3>Playground →</h3><p class="muted small">Guided sandbox with synthetic scenarios.</p></a><a class="card" href="#/broadcasts" style="text-decoration:none"><h3>Live & recordings →</h3><p class="muted small">${d.broadcasts.length} employee broadcasts.</p></a><a class="card" href="#/knowledge" style="text-decoration:none"><h3>Experiments →</h3><p class="muted small">${d.experiments.length} active experiments.</p></a><a class="card" href="#/ideas" style="text-decoration:none"><h3>Improvement ideas →</h3><p class="muted small">${d.ideas.length} ${d.isProductOwner ? 'you can manage' : 'assigned to you'}.</p></a></div>
    <h2 style="margin-top:32px">Hackathon team spaces</h2><div class="grid">${d.teams.map((t) => `<div class="card flat"><h3>${esc(t.name)}</h3><p class="muted small">${esc(t.track)} · ${t.members} members</p></div>`).join('')}</div>
    <h2 style="margin-top:32px">Release notes</h2>${d.releaseNotes.map((r) => `<p><span class="tag lime">${esc(r.version)}</span> ${esc(r.note)}</p>`).join('')}`);
  },
  async playground() {
    const d = await api('/api/playground/scenarios');
    return portalShell('#/playground', `<h1>${isEmp() ? 'Playground' : 'Sandbox demonstrations'}</h1><div class="notice"><b>Sandbox.</b> Synthetic data only. Outputs are simulated and are not credit or business decisions.</div>
    ${d.products.length ? `<form class="card stack" id="pgform"><div class="row"><label>1 · Offering<select name="product" id="pgprod">${d.products.map((p) => `<option value="${p.slug}">${esc(p.name)}</option>`).join('')}</select></label><label>2 · Scenario<select name="scenario" id="pgscen"></select></label></div><div id="pginputs"></div><button class="btn">3 · Run demonstration</button></form><div id="pgout"></div>` : '<div class="card flat"><h3>No sandbox entitlements yet</h3><p class="muted">Your organisation has no entitled offerings. Ask your client administrator or Azentio account team.</p></div>'}
    <h3 style="margin-top:24px">Your recent runs</h3>${d.runs.length ? d.runs.map((r) => `<p class="small">${fmt(r.at)} · ${esc(r.product)} · ${esc(r.scenario)} → <b>${esc(r.output)}</b></p>`).join('') : '<p class="muted small">No runs yet.</p>'}`, d);
  },
  async broadcasts() {
    const d = await api('/api/employee/dashboard');
    return portalShell('#/broadcasts', `<h1>Internal live & recordings</h1><p class="muted">Audience: employees. ${d.canPublish ? 'You hold a publishing grant.' : 'Only employees with a publishing grant can change broadcasts.'}</p><div class="grid">${d.broadcasts.map((m) => `<div class="card"><div class="video">${m.kind === 'live' ? '● LIVE' : '▶'}</div><span class="tag red">employee only</span><h3>${esc(m.title)}</h3><p class="muted small">${esc(m.description)} · ${esc(m.duration)}</p></div>`).join('')}</div>`);
  },
  async knowledge() {
    const d = await api('/api/employee/dashboard');
    return portalShell('#/knowledge', `<h1>Experiments & knowledge library</h1><div class="grid two"><div><h2>Experiments</h2>${d.experiments.map((e) => `<div class="card flat" style="margin-bottom:10px"><span class="tag">${esc(e.status)}</span><h3>${esc(e.title)}</h3><p class="muted small">${esc(e.hypothesis)} — ${esc(e.owner)}</p></div>`).join('')}
    <form class="card stack" id="expform"><h3>Submit an experiment</h3><label>Title<input name="title" required minlength="4" maxlength="120"></label><label>Hypothesis<textarea name="hypothesis" required maxlength="1000"></textarea></label><button class="btn">Submit</button></form></div>
    <div><h2>Knowledge library</h2><table><tr><th>Document</th><th>Owner</th><th>Review by</th><th></th></tr>${d.knowledge.map((k) => `<tr><td>${esc(k.title)}<div class="muted small">${k.feedback.length} feedback</div></td><td>${esc(k.owner)}</td><td>${esc(k.reviewDate)}</td><td><button class="btn sm ghost" data-kfb="${k.id}">Feedback</button></td></tr>`).join('')}</table></div></div>`);
  },
  async learning() {
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const d = await api('/api/shared?' + q.toString());
    const sel = (k, vals) => `<label>${k}<select name="${k}"><option value="">All</option>${vals.map((v) => `<option ${q.get(k) === v ? 'selected' : ''} value="${esc(v)}">${esc(k === 'offering' ? productName(v) : v)}</option>`).join('')}</select></label>`;
    return portalShell('#/learning', `<h1>Shared learning</h1><div class="notice green">Cross-client feed: only <b>moderated, de-identified</b> copies approved for the learning community. Private and organisation-only content never appears here.</div>
    <form class="card stack" id="searchform"><div class="row"><label>Search<input name="q" value="${esc(q.get('q') || '')}" placeholder="e.g. seasonal"></label>${sel('offering', d.facets.offering)}${sel('industry', d.facets.industry)}</div><div class="row">${sel('region', d.facets.region)}${sel('period', d.facets.period)}${sel('topic', d.facets.topic)}</div><div class="row"><button class="btn">Search</button><a class="btn ghost" href="/api/shared/export.csv?${esc(q.toString())}">Export CSV</a><a class="btn ghost" href="#/learning">Clear</a></div></form>
    <p class="muted small">${d.count} result(s)</p><div class="grid two">${d.items.map((s) => `<div class="card"><span class="tag">${esc(s.theme)}</span><span class="tag navy">${esc(productName(s.offering))}</span><span class="tag amber">${esc(s.confidence)} confidence</span><h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p><p class="muted small">${esc(s.industry)} · ${esc(s.region)} · ${esc(s.period)} · ${esc(s.evidenceType)} · ${esc(s.attribution)} · v${s.version}</p><div class="row"><button class="btn sm ghost" data-fb="${s.id}" data-kind="useful">👍 Useful (${s.feedback.useful})</button><button class="btn sm ghost" data-fb="${s.id}" data-kind="needsEvidence">Needs evidence (${s.feedback.needsEvidence})</button><button class="btn sm ghost" data-report="${s.id}">Report</button></div></div>`).join('') || '<p class="muted">No approved shared observations match.</p>'}</div>`);
  },
  async themes() {
    const d = await api('/api/themes');
    return portalShell('#/themes', `<h1>Theme dashboard</h1><p class="muted">Distinct contributing organisations are counted once each; counts below ${d.minCohort} organisations are suppressed. Popularity is not market prevalence or proof of causation.</p>
    ${d.themes.map((t) => `<div class="card" style="margin-bottom:16px"><div class="row"><div><h2 style="margin:0">${esc(t.theme)}</h2><p class="muted small">${t.offerings.map(productName).map(esc).join(', ')} · ${esc(t.period)} · updated ${fmt(t.lastUpdate)}</p></div><div style="flex:0 0 auto;text-align:right"><div class="stat">${t.suppressed ? '—' : t.distinctOrganisations}</div><div class="muted small">distinct organisations</div></div></div>
    <div class="notice">${esc(t.limitations)}</div><b>Supporting approved contributions</b><ul>${t.contributions.map((c) => `<li><a href="#/learning?q=${encodeURIComponent(c.title.split(' ')[0])}">${esc(c.title)}</a></li>`).join('')}</ul>
    ${t.ideas.map((i) => `<p><span class="tag lime">${esc(i.status)}</span> <b>${esc(i.title)}</b> — ${esc(i.team)} · ${esc(i.publicNote)}</p>`).join('')}</div>`).join('') || '<p class="muted">No themes yet.</p>'}`);
  },
  async ideas() {
    const ideas = await api('/api/ideas');
    const po = has('product_owner');
    const shared = po ? (await api('/api/shared')).items : [];
    const statuses = ['Proposed', 'Under review', 'Planned', 'In progress', 'Released', 'Not proceeding'];
    return portalShell('#/ideas', `<h1>Improvement ideas</h1><p class="muted">${po ? 'You are a product owner: link only approved shared evidence. Status changes are audited and notify contributors.' : 'Plain-language status of improvements. Not delivery commitments.'}</p>
    <div class="tablewrap"><table><tr><th>Idea</th><th>Offering</th><th>Team</th><th>Status</th><th>Updated</th>${po ? '<th>Change status</th>' : ''}</tr>${ideas.map((i) => `<tr><td><b>${esc(i.title)}</b>${i.problem ? `<div class="muted small">${esc(i.problem)}</div><div class="small">Evidence: ${i.evidence.length} approved · Priority ${esc(i.priority)} · ${i.shared ? 'shared with clients' : 'internal'}</div>` : ''}<div class="small">${esc(i.publicNote)}</div></td><td>${esc(productName(i.offering))}</td><td>${esc(i.team)}</td><td><span class="tag lime">${esc(i.status)}</span></td><td>${fmt(i.updatedAt)}</td>${po ? `<td><select data-idea="${i.id}">${statuses.map((s) => `<option ${s === i.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>` : ''}</tr>`).join('')}</table></div>
    ${po ? `<form class="card stack" id="ideaform" style="margin-top:20px"><h3>New improvement idea</h3><div class="row"><label>Title<input name="title" required></label><label>Offering<select name="offering">${SITE.products.map((p) => `<option value="${p.slug}">${esc(p.name)}</option>`).join('')}</select></label></div><label>Problem statement<textarea name="problem" required></textarea></label><label>Proposed outcome<input name="outcome"></label><div class="row"><label>Team<input name="team" value="Product"></label><label>Priority<select name="priority"><option>Low</option><option selected>Medium</option><option>High</option></select></label></div><b class="small">Supporting approved contributions</b>${shared.map((s) => `<label class="check"><input type="checkbox" name="evidence" value="${s.id}"> ${esc(s.title)} <span class="muted small">(${esc(s.theme)})</span></label>`).join('')}<label>Public status note (shown to clients if shared)<input name="publicNote" maxlength="300"></label><label class="check"><input type="checkbox" name="shared"> Share status with client community</label><button class="btn">Create idea</button></form>` : ''}`);
  },
  async moderation() {
    const d = await api('/api/moderation/queue');
    return portalShell('#/moderation', `<h1>Moderation queue</h1><p class="muted">You see only contributions submitted for community review — never unsubmitted drafts. The published copy contains only the reviewed fields below.</p>
    ${d.queue.map((c) => `<div class="card" style="margin-bottom:16px"><div class="row"><div>${state(c.state)} <span class="tag navy">${esc(c.type)}</span> <span class="tag">${esc(productName(c.offering))}</span> <span class="tag amber">${esc(c.consentNote)}</span> v${c.version}</div></div>
      <h3>${esc(c.title)}</h3><p>${esc(c.body)}</p><p class="muted small">Source org (private, never shared): ${esc(c.orgName)} · ${esc(c.region)} · ${esc(c.period)} · ${esc(c.evidenceType)} · ${esc(c.confidence)}</p>
      ${c.flags.length ? `<div class="notice red"><b>Possible sensitive content:</b> ${c.flags.map(esc).join(', ')}. A scan is not a privacy guarantee — review manually.</div>` : ''}
      ${c.state === 'returned' ? '<p class="muted">Waiting for author to amend.</p>' : `<form class="stack" data-mod="${c.id}"><div class="row"><label>Shared title<input name="title" value="${esc(c.title)}"></label><label>Theme<input name="theme" placeholder="e.g. Seasonality context" list="themes"></label></div><label>Redacted shared summary<textarea name="summary">${esc(c.body)}</textarea></label><div class="row"><label>Shared region (coarsen)<input name="region" value="${esc(c.region)}"></label><label class="check"><input type="checkbox" name="coarsenPeriod"> Coarsen period to year</label>${c.consent.attribution ? '<label class="check"><input type="checkbox" name="showAttribution"> Show organisation attribution (author opted in)</label>' : ''}</div><label>Note to author / reason<input name="note"></label><div class="row"><button class="btn" data-act="publish">Publish approved version</button><button class="btn ghost" data-act="return">Request clarification</button><button class="btn danger" data-act="reject">Reject</button></div></form>`}</div>`).join('') || '<p class="muted">Queue is empty.</p>'}
    <datalist id="themes"><option>Seasonality context</option><option>Document quality</option><option>Regulatory reporting</option></datalist>
    <h2>Open reports</h2>${d.reports.map((r) => `<div class="card flat" style="margin-bottom:10px"><b>${esc(r.shared?.title)}</b><p class="muted small">Reason: ${esc(r.reason)} — ${esc(r.note)} · ${esc(r.status)}</p><div class="row"><button class="btn sm danger" data-rep="${r.id}" data-ract="unpublish">Temporarily unpublish</button><button class="btn sm ghost" data-rep="${r.id}" data-ract="restore">Restore</button><button class="btn sm ghost" data-rep="${r.id}" data-ract="dismiss">Dismiss</button></div></div>`).join('') || '<p class="muted">No open reports.</p>'}`);
  },
  async publisher() {
    return portalShell('#/publisher', `<h1>Publish content</h1><p class="muted">Publishing grant only. No identity administration, no access to private learning records.</p><div class="grid two"><form class="card stack" id="banform"><h3>Homepage banner</h3><label>Title<input name="title" required></label><label>Text<input name="text"></label><button class="btn">Publish banner</button></form>
    <form class="card stack" id="medform"><h3>Video / live session</h3><label>Title<input name="title" required></label><label>Description<input name="description"></label><div class="row"><label>Kind<select name="kind"><option value="recording">Recording</option><option value="live">Live</option></select></label><label>Audience<select name="audience"><option value="public">Public</option><option value="employee">Employees only</option><option value="clients">All client workspaces</option></select></label></div><label>Duration / time<input name="duration"></label><button class="btn">Publish</button></form></div>`);
  },
  async admin() {
    const d = await api('/api/admin/overview');
    const roles = ['employee', 'moderator', 'publisher', 'product_owner', 'portal_admin'];
    return portalShell('#/admin', `<h1>Portal administration</h1><div class="notice">${esc(d.note)} Privileged actions are audited. Trend threshold: ${d.minCohort} organisations.</div>
    <h2>Organisations & entitlements</h2><div class="tablewrap"><table><tr><th>Organisation</th><th>Entitlements</th></tr>${d.orgs.map((o) => `<tr><td>${esc(o.name)}<div class="muted small">${esc(o.industry)} · ${esc(o.region)}</div></td><td>${SITE.products.map((p) => `<label class="check small"><input type="checkbox" data-ent="${o.id}" value="${p.slug}" ${o.entitlements.includes(p.slug) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('')}</td></tr>`).join('')}</table></div>
    <h2>Platform role grants</h2><div class="tablewrap"><table><tr><th>User</th>${roles.map((r) => `<th>${r.replace('_', ' ')}</th>`).join('')}</tr>${d.users.map((u) => `<tr><td>${esc(u.name)}<div class="muted small">${esc(u.email)}</div></td>${roles.map((r) => `<td><input type="checkbox" data-role="${u.id}" value="${r}" ${u.roles.includes(r) ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}</table></div>
    <h2>Demo requests (${d.demoRequests.length}) & Build Labs registrations (${d.hackathonRegs.length})</h2>${d.demoRequests.map((r) => `<p class="small">${fmt(r.at)} · ${esc(r.name)} · ${esc(r.company)} · ${esc(productName(r.product))}</p>`).join('')}${d.hackathonRegs.map((r) => `<p class="small">${fmt(r.at)} · ${esc(r.name)} · team ${esc(r.team)}</p>`).join('')}
    <h2>Audit log</h2><div class="tablewrap"><table><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr>${d.audit.map((a) => `<tr><td>${new Date(a.at).toLocaleTimeString()}</td><td>${esc(a.actor)}</td><td>${esc(a.action)}</td><td>${esc(a.target)}</td></tr>`).join('')}</table></div>`);
  },
  async fl() {
    const models = await api('/api/fl/models');
    return portalShell('#/fl', `<h1>Federated learning programme (P2, opt-in)</h1><div class="notice"><b>Separate from collective learning.</b> Each consenting client environment trains locally on its own synthetic dataset; only bounded weight updates are aggregated. Simulated controls are labelled honestly: no secure aggregation or formal differential privacy is claimed.</div>
    <button class="btn" id="flrun">Run 5 aggregation rounds (with a dropout at round 3)</button>
    ${models.map((m) => `<div class="card" style="margin-top:16px"><div class="row"><div><h3>${esc(m.version)}</h3><span class="tag amber">${esc(m.status)}</span></div><div style="flex:0 0 auto"><div class="stat">${(m.holdoutAccuracy * 100).toFixed(1)}%</div><div class="muted small">holdout accuracy vs ${(m.majorityBaseline * 100).toFixed(1)}% baseline</div></div></div>
    <p class="small">Participants: ${m.participants.map(esc).join(', ')} · ${esc(m.method)}</p><details><summary>Round log</summary><table>${m.log.map((l) => `<tr><td>R${l.round}</td><td>${esc(l.org || '')}</td><td>${esc(l.status)}</td><td>${l.samples ? l.samples + ' samples (stay local)' : ''}</td><td>${l.updateNorm ?? ''}${l.clipped ? ' clipped' : ''}</td></tr>`).join('')}</table></details>
    <p class="muted small">${esc(m.caveats)}</p>${m.status.startsWith('candidate') && has('portal_admin') ? `<div class="row"><button class="btn sm" data-fld="${m.id}" data-dec="approve">Approve staged deployment</button><button class="btn sm ghost" data-fld="${m.id}" data-dec="reject">Reject</button></div>` : ''}</div>`).join('')}`);
  },
  async client() {
    const d = await api('/api/client/dashboard');
    const cs = d.contributionStatus;
    return portalShell('#/client', `<h1>${esc(d.org.name)}</h1><p class="muted">${esc(d.org.industry)} · ${esc(d.org.region)} · your role: ${esc(d.role.replace('_', ' '))}</p>
    <div class="grid"><div class="card"><div class="stat">${d.entitlements.length}</div><div class="muted">entitled offerings</div></div><div class="card"><div class="stat">${cs.draft}</div><div class="muted">private drafts</div></div><div class="card"><div class="stat">${cs.submitted + cs.returned}</div><div class="muted">in review / returned</div></div><div class="card"><div class="stat">${cs.published}</div><div class="muted">published shared copies</div></div></div>
    <h2 style="margin-top:28px">Entitled offerings</h2>${d.entitlements.length ? `<div class="grid">${d.entitlements.map((p) => `<div class="card flat"><h3>${esc(p.name)}</h3><p class="muted small">${esc(p.tagline)}</p><a class="btn sm" href="#/playground">Open sandbox</a></div>`).join('')}</div>` : '<div class="card flat"><p class="muted">No entitlements are assigned to this organisation yet.</p></div>'}
    <div class="grid two" style="margin-top:28px"><div><h2>Sessions & briefings</h2>${d.sessions.map((e) => `<p><span class="tag">${esc(e.kind)}</span> <b>${esc(e.title)}</b> · ${esc(e.when)}</p>`).join('') || '<p class="muted">No sessions assigned.</p>'}${d.media.map((m) => `<p><span class="tag navy">${esc(m.kind)}</span> ${esc(m.title)} · ${esc(m.duration)}</p>`).join('')}<h3>Resources</h3>${d.resources.map((r) => `<p>📄 ${esc(r.title)}</p>`).join('') || '<p class="muted">None.</p>'}</div>
    <div><h2>Improvement status</h2>${d.ideas.map((i) => `<div class="card flat"><span class="tag lime">${esc(i.status)}</span><h3>${esc(i.title)}</h3><p class="muted small">${esc(i.team)} · updated ${fmt(i.updatedAt)}</p><p class="small">${esc(i.publicNote)}</p></div>`).join('') || '<p class="muted">Nothing yet.</p>'}</div></div>`);
  },
  async observations(scope = 'mine') {
    const list = await api('/api/contributions?scope=' + scope);
    const title = scope === 'mine' ? 'My observations' : "Our organisation's observations";
    return portalShell(scope === 'mine' ? '#/client/observations' : '#/client/org-observations', `<h1>${title}</h1><p class="muted">${scope === 'mine' ? 'Private to you unless you choose otherwise. Saving never shares.' : 'Visible only within your organisation. Separate from the cross-client shared feed.'}</p><a class="btn" href="#/client/new">+ New observation</a>
    ${list.map((c) => `<div class="card" style="margin-top:14px"><div>${state(c.state)} <span class="tag navy">${esc(c.type)}</span> <span class="tag">${esc({ private: 'Private to me', org: 'My organisation', community: 'Proposed for learning community' }[c.visibility])}</span> v${c.version}</div><h3>${esc(c.title)}</h3><p class="small">${esc(c.body)}</p>
      ${c.flags.length ? `<div class="notice red">Possible sensitive content: ${c.flags.map(esc).join(', ')}. Please remove before sharing.</div>` : ''}
      <p class="muted small">Who can see this version: ${c.state === 'published' ? 'a moderated, de-identified copy is visible to authorised clients and employees' : c.visibility === 'org' ? 'members of your organisation' : c.visibility === 'community' && c.state !== 'draft' ? 'you and learning moderators (for review)' : 'only you'}. Consent: publish ${c.consent.publish ? '✓' : '✗'} · attribution ${c.consent.attribution ? '✓' : '✗'} · model training ${c.consent.training ? '✓' : '✗'}</p>
      <div class="steps">${c.history.map((h) => `<span>${fmt(h.at)} ${esc(h.to)}${h.reason ? ': ' + esc(h.reason) : ''}</span>`).join('')}</div>
      ${scope === 'mine' ? `<div class="row" style="margin-top:10px">${['draft', 'returned', 'published'].includes(c.state) ? `<a class="btn sm ghost" href="#/client/edit/${c.id}">${c.state === 'returned' ? 'Amend' : c.state === 'published' ? 'Edit (new version, re-review)' : 'Edit'}</a>` : ''}${['draft', 'returned'].includes(c.state) && c.visibility === 'community' ? `<button class="btn sm" data-submit="${c.id}">Submit for review</button>` : ''}${['published', 'under_review'].includes(c.state) ? `<button class="btn sm danger" data-withdraw="${c.id}">Withdraw</button>` : ''}</div>` : `<p class="muted small">By ${esc(c.author)}</p>`}</div>`).join('') || '<p class="muted" style="margin-top:14px">Nothing here yet.</p>'}`);
  },
  async obsform(cid) {
    const c = cid ? (await api('/api/contributions?scope=mine')).find((x) => x.id === cid) : null;
    const v = (k, d = '') => esc(c ? c[k] : d);
    const opt = (vals, cur) => vals.map((x) => `<option ${x === cur ? 'selected' : ''}>${x}</option>`).join('');
    return portalShell('#/client/new', `<h1>${c ? 'Edit observation' : 'New observation'}</h1>
    <div class="notice"><b>Before you write:</b> exclude customer identities, account numbers, transaction-level data, credentials, confidential contract terms and pricing. Use general wording. An automated scan flags likely issues but is not a privacy guarantee.</div>
    <form class="card stack" id="obsform" data-id="${c ? c.id : ''}"><div class="row"><label>Type<select name="type">${opt(['Market observation', 'Emerging trend', 'Product gap', 'Operational challenge', 'Successful practice', 'Improvement suggestion'], c?.type)}</select></label><label>Offering<select name="offering">${SITE.products.map((p) => `<option value="${p.slug}" ${c?.offering === p.slug ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label></div>
    <label>Title (5–120)<input name="title" required minlength="5" maxlength="120" value="${v('title')}"></label><label>Observation (20–4000)<textarea name="body" required minlength="20" maxlength="4000">${v('body')}</textarea></label>
    <div class="row"><label>Industry<input name="industry" value="${v('industry', 'Banking')}"></label><label>Region<input name="region" value="${v('region', 'Middle East')}"></label><label>Observation period<input name="period" required pattern="\\d{4}-Q[1-4]" value="${v('period', '2026-Q3')}"></label></div>
    <div class="row"><label>Evidence type<select name="evidenceType">${opt(['Anecdotal', 'Internal data', 'Multiple customers', 'Published source'], c?.evidenceType)}</select></label><label>Confidence<select name="confidence">${opt(['Low', 'Medium', 'High'], c?.confidence || 'Medium')}</select></label><label>Supporting link (https, optional)<input name="link" type="url" value="${v('link')}"></label></div>
    <fieldset class="card flat"><legend><b>Who can see this?</b></legend>${[['private', 'Private to me (default)'], ['org', 'Within my organisation'], ['community', 'Propose for the approved learning community (moderated, de-identified)']].map(([k, l]) => `<label class="check"><input type="radio" name="visibility" value="${k}" ${(c?.visibility || 'private') === k ? 'checked' : ''}> ${l}</label>`).join('')}</fieldset>
    <fieldset class="card flat"><legend><b>Separate permissions</b></legend><p class="muted small">Storing and processing this contribution is required to save it. Each permission below is independent.</p><label class="check"><input type="checkbox" name="consentPublish" ${c?.consent.publish ? 'checked' : ''}> Publish a reviewed, de-identified shared copy</label><label class="check"><input type="checkbox" name="consentAttribution" ${c?.consent.attribution ? 'checked' : ''}> Allow my organisation's name to be shown (still subject to review)</label><label class="check"><input type="checkbox" name="consentTraining" ${c?.consent.training ? 'checked' : ''}> Include in any future model-training / federated programme</label></fieldset>
    <button class="btn">${c ? 'Save changes' : 'Save private draft'}</button></form>`);
  },
  async orgadmin() {
    const d = await api('/api/org/members');
    return portalShell('#/client/org', `<h1>Members & invitations</h1><p class="muted">You can grant only client roles in your own organisation.</p>
    <div class="tablewrap"><table><tr><th>Member</th><th>Role</th><th>Status</th><th></th></tr>${d.members.map((m) => `<tr><td>${esc(m.name)}<div class="muted small">${esc(m.email)}</div></td><td>${esc(m.role)}</td><td>${esc(m.status)}</td><td>${m.status === 'active' && m.id !== ME.user.id ? `<button class="btn sm ghost" data-revm="${m.id}">Revoke</button>` : ''}</td></tr>`).join('')}</table></div>
    <h2>Invitations</h2><div class="tablewrap"><table><tr><th>Email</th><th>Role</th><th>Status</th><th>Expires</th><th></th></tr>${d.invitations.map((i) => `<tr><td>${esc(i.email)}</td><td>${esc(i.role)}</td><td>${esc(i.status)}</td><td>${fmt(i.expires)}</td><td>${i.link ? `<a class="small" href="${esc(i.link)}">Invite link</a> <button class="btn sm ghost" data-revi="${i.id}">Revoke</button>` : ''}</td></tr>`).join('')}</table></div>
    <form class="card stack" id="invform" style="margin-top:16px"><h3>Invite a colleague</h3><div class="row"><label>Email<input name="email" type="email" required></label><label>Role<select name="role"><option value="client_member">Client member</option><option value="client_admin">Client administrator</option></select></label></div><button class="btn">Create single-use invitation (72h)</button></form>`);
  },
  async notifications() {
    const n = await api('/api/me/notifications'); await api('/api/me/notifications/read', {}); ME.unread = 0;
    return portalShell('#/notifications', `<h1>Notifications</h1><p class="muted small">In-app notifications. Email delivery is not configured, so nothing here is marked as emailed.</p>${n.map((x) => `<div class="card flat" style="margin-bottom:8px">${x.read ? '' : '<span class="tag lime">new</span>'} ${esc(x.text)} <span class="muted small">· ${fmt(x.at)}</span> ${x.link ? `<a class="small" href="${esc(x.link)}">Open</a>` : ''}</div>`).join('') || '<p class="muted">No notifications.</p>'}`);
  },
};

// ---------- router ----------
async function router() {
  const h = location.hash.replace(/^#/, '').split('?')[0] || '/';
  const parts = h.split('/').filter(Boolean);
  const main = $('#main');
  try {
    ME = await api('/api/me');
    renderNav();
    let html;
    const needAuth = ['employee', 'playground', 'broadcasts', 'knowledge', 'learning', 'themes', 'ideas', 'moderation', 'publisher', 'admin', 'fl', 'client', 'notifications'];
    if (needAuth.includes(parts[0]) && !ME.user) { location.hash = '#/login'; return; }
    if (ME.user && !ME.termsAccepted && parts[0] !== 'invite') { /* seeded users already accepted */ }
    switch (parts[0]) {
      case undefined: html = pages.home(); break;
      case 'az': html = pages.az('/' + parts.slice(1).join('/')); break;
      case 'products': html = parts[1] ? pages.product(parts[1]) : pages.products(); break;
      case 'invite': html = await pages.invite(parts[1]); break;
      case 'client':
        html = !parts[1] ? await portal.client() : parts[1] === 'observations' ? await portal.observations('mine') : parts[1] === 'org-observations' ? await portal.observations('org') : parts[1] === 'new' ? await portal.obsform() : parts[1] === 'edit' ? await portal.obsform(parts[2]) : parts[1] === 'org' ? await portal.orgadmin() : pages.notfound();
        break;
      default:
        html = pages[parts[0]] ? await pages[parts[0]]() : portal[parts[0]] ? await portal[parts[0]]() : pages.notfound();
    }
    main.innerHTML = html;
    bind(parts);
    window.scrollTo(0, 0);
  } catch (e) {
    main.innerHTML = `<section><h1>Access denied</h1><p class="muted">${esc(e.message)}</p><a class="btn" href="${ME.user ? (isEmp() ? '#/employee' : '#/client') : '#/login'}">Go back</a></section>`;
  }
}
const formData = (f) => { const o = {}; new FormData(f).forEach((v, k) => { if (o[k] !== undefined) o[k] = [].concat(o[k], v); else o[k] = v; }); f.querySelectorAll('input[type=checkbox]').forEach((c) => { if (c.name && !(c.name in o)) o[c.name] = false; else if (c.name && o[c.name] === 'on') o[c.name] = true; }); return o; };
const on = (sel, ev, fn) => document.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, run((e) => fn(e, el))));

function bind() {
  on('#demo', 'submit', async (e, f) => { e.preventDefault(); const r = await api('/api/public/demo-request', formData(f)); f.reset(); toast(r.status); });
  on('#hack', 'submit', async (e, f) => { e.preventDefault(); await api('/api/public/hackathon-register', formData(f)); f.reset(); toast('Registered! See you at the hackathon.'); });
  on('#login', 'submit', async (e, f) => { e.preventDefault(); ME = await api('/api/auth/login', formData(f)); location.hash = isEmp() ? '#/employee' : '#/client'; });
  on('[data-demo]', 'click', async (e, b) => { ME = await api('/api/auth/login', { email: b.dataset.demo, password: 'demo1234' }); location.hash = isEmp() ? '#/employee' : '#/client'; });
  on('#accept', 'submit', async (e, f) => { e.preventDefault(); await api(`/api/invite/${f.dataset.token}/accept`, formData(f)); toast('Invitation accepted. Sign in with your new account.'); location.hash = '#/login'; });
  on('#wsswitch', 'change', async (e, s) => { await api('/api/me/workspace', { orgId: s.value }); location.hash = '#/client'; router(); });
  // playground
  const prod = $('#pgprod');
  if (prod) {
    const fill = async () => { const d = await api('/api/playground/scenarios'); $('#pgscen').innerHTML = d.scenarios.filter((s) => s.product === prod.value).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join(''); showInputs(d); };
    const showInputs = (d) => { const s = d.scenarios.find((x) => x.id === $('#pgscen').value); $('#pginputs').innerHTML = s ? `<div class="sandbox small"><b>Inputs (synthetic):</b> ${Object.entries(s.inputs).map(([k, v]) => `${esc(k)}: <b>${esc(v)}</b>`).join(' · ')}</div>` : ''; };
    prod.onchange = run(fill); $('#pgscen').onchange = run(async () => showInputs(await api('/api/playground/scenarios'))); fill();
    on('#pgform', 'submit', async (e, f) => { e.preventDefault(); const r = await api('/api/playground/run', formData(f));
      $('#pgout').innerHTML = `<div class="card sandbox" style="margin-top:16px"><div class="tag amber">${esc(r.label)}</div><h2>${esc(r.output)}</h2><table><tr><th>Evidence</th><th>Value</th><th>Effect</th></tr>${r.evidence.map((x) => `<tr><td>${esc(x.factor)}</td><td>${esc(x.value)}</td><td>${esc(x.effect)}</td></tr>`).join('')}</table>
      <form class="row" id="pgfb" style="margin-top:12px"><select name="rating"><option>Helpful</option><option>Unclear evidence</option><option>Incorrect</option></select><input name="comment" placeholder="Structured feedback (optional)"><button class="btn sm">Send feedback</button></form></div>`;
      on('#pgfb', 'submit', async (e2, f2) => { e2.preventDefault(); await api('/api/playground/feedback', { ...formData(f2), runId: r.id }); toast('Feedback recorded'); });
    });
  }
  on('#expform', 'submit', async (e, f) => { e.preventDefault(); await api('/api/employee/experiments', formData(f)); toast('Experiment submitted'); router(); });
  on('[data-kfb]', 'click', async (e, b) => { const text = prompt('Feedback for document owner'); if (text) { await api(`/api/employee/knowledge/${b.dataset.kfb}/feedback`, { text }); toast('Thanks — sent to owner'); router(); } });
  on('#searchform', 'submit', async (e, f) => { e.preventDefault(); const p = new URLSearchParams(Object.entries(formData(f)).filter(([, v]) => v)); location.hash = '#/learning?' + p; });
  on('[data-fb]', 'click', async (e, b) => { await api(`/api/shared/${b.dataset.fb}/feedback`, { kind: b.dataset.kind }); router(); });
  on('[data-report]', 'click', async (e, b) => { const note = prompt('Why are you reporting this? (misleading, confidential, inappropriate). You do not need to name another client.'); if (note !== null) { await api(`/api/shared/${b.dataset.report}/report`, { reason: 'Report', note }); toast('Report sent to moderators'); } });
  on('#obsform', 'submit', async (e, f) => { e.preventDefault(); const d = formData(f); const cid = f.dataset.id; await api(cid ? '/api/contributions/' + cid : '/api/contributions', d, cid ? 'PUT' : 'POST'); toast(cid ? 'Saved' : 'Saved as private draft — nothing has been shared'); location.hash = '#/client/observations'; });
  on('[data-submit]', 'click', async (e, b) => { await api(`/api/contributions/${b.dataset.submit}/submit`, {}); toast('Submitted for moderation'); router(); });
  on('[data-withdraw]', 'click', async (e, b) => { if (!confirm('Withdraw? It will be removed from search, themes and AIRA immediately. Copies already viewed cannot be recalled.')) return; await api(`/api/contributions/${b.dataset.withdraw}/withdraw`, {}); toast('Withdrawn and de-indexed'); router(); });
  on('[data-mod] button', 'click', async (e, b) => { e.preventDefault(); const f = b.closest('form'); await api(`/api/moderation/${f.dataset.mod}/${b.dataset.act}`, formData(f)); toast('Decision recorded; author notified'); router(); });
  on('[data-rep]', 'click', async (e, b) => { await api(`/api/moderation/reports/${b.dataset.rep}/${b.dataset.ract}`, { note: b.dataset.ract }); toast('Report decision recorded'); router(); });
  on('[data-idea]', 'change', async (e, s) => { await api(`/api/ideas/${s.dataset.idea}/status`, { status: s.value }); toast('Status updated (audited)'); router(); });
  on('#ideaform', 'submit', async (e, f) => { e.preventDefault(); const d = formData(f); d.evidence = [].concat(d.evidence || []).filter((x) => typeof x === 'string'); await api('/api/ideas', d); toast('Idea created'); router(); });
  on('#banform', 'submit', async (e, f) => { e.preventDefault(); await api('/api/banners', formData(f)); SITE = await api('/api/public/site'); toast('Banner live on homepage'); f.reset(); });
  on('#medform', 'submit', async (e, f) => { e.preventDefault(); await api('/api/media', formData(f)); SITE = await api('/api/public/site'); toast('Published to selected audience'); f.reset(); });
  on('[data-ent]', 'change', async (e, c) => { const id = c.dataset.ent; const ents = [...document.querySelectorAll(`[data-ent="${id}"]:checked`)].map((x) => x.value); await api(`/api/admin/orgs/${id}/entitlements`, { entitlements: ents }); toast('Entitlements updated (audited)'); });
  on('[data-role]', 'change', async (e, c) => { const id = c.dataset.role; const roles = [...document.querySelectorAll(`[data-role="${id}"]:checked`)].map((x) => x.value); try { await api(`/api/admin/users/${id}/roles`, { roles }); toast('Roles updated (audited)'); } catch (err) { c.checked = !c.checked; throw err; } });
  on('#flrun', 'click', async () => { await api('/api/fl/round', {}); toast('Candidate model registered — awaiting human review'); router(); });
  on('[data-fld]', 'click', async (e, b) => { await api(`/api/fl/models/${b.dataset.fld}/decision`, { decision: b.dataset.dec }); router(); });
  on('#invform', 'submit', async (e, f) => { e.preventDefault(); const r = await api('/api/org/invite', formData(f)); toast(r.note); router(); });
  on('[data-revi]', 'click', async (e, b) => { await api(`/api/org/invite/${b.dataset.revi}/revoke`, {}); router(); });
  on('[data-revm]', 'click', async (e, b) => { await api(`/api/org/members/${b.dataset.revm}/revoke`, {}); router(); });
}

// ---------- AIRA ----------
$('#aira-btn').onclick = () => $('#aira').classList.toggle('hidden');
$('#aira-close').onclick = () => $('#aira').classList.add('hidden');
$('#aira-form').onsubmit = run(async (e) => {
  e.preventDefault(); const q = $('#aira-q').value.trim(); if (!q) return;
  const log = $('#aira-log'); log.insertAdjacentHTML('beforeend', `<div class="msg me">${esc(q)}</div>`); $('#aira-q').value = '';
  const r = await api('/api/aira', { question: q });
  log.insertAdjacentHTML('beforeend', `<div class="msg bot">${esc(r.answer)}${r.sources.length ? `\n\nSources: ${r.sources.map((s) => esc(s.title)).join(' · ')}` : ''}</div>`); log.scrollTop = 1e9;
});

(async () => { [SITE, CONTENT, MEDIA] = await Promise.all([api('/api/public/site'), fetch('/azentio-content.json').then((r) => r.json()).catch(() => []), fetch('/azentio-media.json').then((r) => r.json()).catch(() => MEDIA)]); window.addEventListener('hashchange', router); router(); })();
