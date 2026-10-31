// Synthetic seed data only. No real customers, people or figures.
const crypto = require('crypto');

module.exports = function seed() {
  const salt = 'seedsalt';
  const pw = crypto.scryptSync('demo1234', salt, 32, { N: 1024 }).toString('hex');
  const user = (id, email, name, roles, memberships = []) => ({ id, email, name, roles, memberships, salt, pw, active: true, termsAccepted: '2026-10-01T00:00:00Z' });
  const t = (d) => new Date(Date.now() - d * 86400e3).toISOString();

  const products = [
    { slug: 'credit-strategy-simulator', name: 'Credit Strategy Simulator', category: 'Credit Policy Intelligence', tagline: 'Simulate credit policy changes before deployment.', description: 'Explore potential effects of policy changes on approvals, risk exposure and portfolio outcomes before they go live.', features: ['Policy what-if scenarios', 'Approval and risk impact', 'Portfolio outcome comparison', 'Versioned policy sets'] },
    { slug: 'sme-credit-decisioning', name: 'SME Credit Decisioning Workbench', category: 'Explainable Credit Intelligence', tagline: 'Financial analysis, policy evaluation and recommendations in one workbench.', description: 'Bring financial analysis, policy evaluation, risk review and credit recommendations into one workbench with evidence and human oversight.', features: ['Financial spreading', 'Policy evaluation', 'Evidence-backed recommendations', 'Analyst sign-off'] },
    { slug: 'financial-analysis-intelligence', name: 'Financial Analysis Intelligence', category: 'Analytics & Insights', tagline: 'Explainable comparisons of business financials.', description: 'Compare SME financial statements against peers and history, with plain-language explanations of ratios, trends and seasonality.', features: ['Ratio analysis', 'Peer comparison', 'Trend explanations', 'Seasonality context (under review)'] },
    { slug: 'similar-portfolio-intelligence', name: 'Similar Portfolio Intelligence', category: 'Contextual Portfolio Insights', tagline: 'Compare applications with relevant historical segments.', description: 'Compare financing applications with relevant historical portfolio segments to understand patterns, risk indicators and comparable outcomes.', features: ['Segment matching', 'Comparable outcomes', 'Risk indicators', 'Explainable similarity'] },
    { slug: 'riva', name: 'RIVA', category: 'Reporting Intelligence, Validation & Analytics', tagline: 'Configurable reporting with validation built in.', description: 'A configurable reporting environment connecting data sources, mapping report fields, supporting validation and simplifying reporting workflows.', features: ['Source mapping', 'Field validation', 'Report templates', 'Approval workflow'] },
    { slug: 'document-intelligence', name: 'Document Intelligence', category: 'Document Intelligence', tagline: 'Extract, interpret and validate complex documents.', description: 'Classify and extract information, validate across documents, detect inconsistencies and deliver structured data.', features: ['Classification', 'Extraction', 'Cross-document validation', 'Inconsistency detection'] },
  ];

  const orgs = [
    { id: 'org_gulf', name: 'Gulf Horizon Bank (synthetic)', industry: 'Banking', region: 'Middle East', entitlements: ['sme-credit-decisioning', 'financial-analysis-intelligence', 'credit-strategy-simulator'], flConsent: true },
    { id: 'org_sahel', name: 'Sahel Microfinance (synthetic)', industry: 'Microfinance', region: 'Africa', entitlements: ['financial-analysis-intelligence', 'riva'], flConsent: true },
    { id: 'org_pacific', name: 'Pacific Trade Credit (synthetic)', industry: 'Trade finance', region: 'Asia Pacific', entitlements: ['similar-portfolio-intelligence', 'financial-analysis-intelligence'], flConsent: true },
    { id: 'org_nordic', name: 'Nordic Leasing Co (synthetic)', industry: 'Leasing', region: 'Europe', entitlements: [], flConsent: false },
  ];

  const users = [
    user('u_emp', 'priya@azentio.com', 'Priya (Employee)', ['employee']),
    user('u_po', 'omar@azentio.com', 'Omar (Product owner)', ['employee', 'product_owner']),
    user('u_mod', 'lena@azentio.com', 'Lena (Moderator)', ['employee', 'moderator']),
    user('u_pub', 'ravi@azentio.com', 'Ravi (Content publisher)', ['employee', 'publisher']),
    user('u_adm', 'admin@azentio.com', 'Alex (Portal admin)', ['employee', 'portal_admin']),
    user('u_cadm', 'sara@gulfhorizon.example', 'Sara (Client admin, Gulf Horizon)', [], [{ orgId: 'org_gulf', role: 'client_admin', status: 'active' }]),
    user('u_cm1', 'tom@gulfhorizon.example', 'Tom (Client member, Gulf Horizon)', [], [{ orgId: 'org_gulf', role: 'client_member', status: 'active' }]),
    user('u_cm2', 'amina@sahel.example', 'Amina (Client member, Sahel)', [], [{ orgId: 'org_sahel', role: 'client_member', status: 'active' }]),
    user('u_cm3', 'kenji@pacifictrade.example', 'Kenji (Multi-org client)', [], [{ orgId: 'org_pacific', role: 'client_member', status: 'active' }, { orgId: 'org_nordic', role: 'client_member', status: 'active' }]),
  ];

  const obs = (id, orgId, authorId, title, body, extra = {}) => ({
    id, orgId, authorId, type: 'Market observation', title, body, offering: 'financial-analysis-intelligence', industry: orgs.find((o) => o.id === orgId).industry,
    region: orgs.find((o) => o.id === orgId).region, period: '2026-Q2', evidenceType: 'Multiple customers', confidence: 'Medium', link: '', visibility: 'community',
    state: 'published', version: 1, consent: { store: true, publish: true, attribution: false, training: false }, consentHistory: [{ at: t(30), store: true, publish: true, attribution: false, training: false }],
    flags: [], history: [{ at: t(30), to: 'draft', by: 'seed' }, { at: t(25), from: 'draft', to: 'submitted', by: 'seed' }, { at: t(20), from: 'submitted', to: 'published', by: 'lena@azentio.com' }],
    moderatorNotes: [{ at: t(20), by: 'lena@azentio.com', note: 'Removed branch name and exact month.' }], createdAt: t(30), updatedAt: t(20), ...extra,
  });
  const contributions = [
    obs('obs_s1', 'org_gulf', 'u_cm1', 'Seasonal retailers flagged as declining', 'Ratio comparisons treat Ramadan-season retailers as declining in off-peak quarters, so analysts override the explanation manually.'),
    obs('obs_s2', 'org_sahel', 'u_cm2', 'Harvest-cycle borrowers look volatile', 'Agri-linked SMEs show strong revenue after harvest and weak cash flow before it; quarter-on-quarter comparisons overstate risk.'),
    obs('obs_s3', 'org_pacific', 'u_cm3', 'Export peaks distort cash-flow trends', 'Exporters with year-end shipping peaks look like they are deteriorating when compared to the prior quarter instead of the same quarter last year.', { evidenceType: 'Internal data' }),
    obs('obs_d1', 'org_gulf', 'u_cm1', 'Document checks slow on bilingual statements', 'Bilingual Arabic/English statements need manual re-keying of totals; possibly 20% of SME files this quarter.', { state: 'draft', visibility: 'private', offering: 'document-intelligence', type: 'Operational challenge', history: [{ at: t(2), to: 'draft', by: 'seed' }], moderatorNotes: [] }),
    obs('obs_r1', 'org_gulf', 'u_cm1', 'Reporting templates differ by regulator region', 'Our team maintains three variants of the same SME exposure report for different regional regulators.', { state: 'submitted', offering: 'riva', type: 'Product gap', history: [{ at: t(1), to: 'submitted', by: 'tom@gulfhorizon.example' }], moderatorNotes: [] }),
  ];
  const shared = [
    ['shr_s1', 'obs_s1', 'org_gulf', 'Seasonal retailers misread as declining', 'In one Middle East banking portfolio, off-peak quarters for festival-season retailers were explained as decline; analysts overrode explanations manually.'],
    ['shr_s2', 'obs_s2', 'org_sahel', 'Harvest-cycle SMEs appear volatile', 'An African microfinance contributor reports agri-linked SMEs look riskier pre-harvest when compared quarter-on-quarter.'],
    ['shr_s3', 'obs_s3', 'org_pacific', 'Export seasonality distorts trend comparisons', 'An Asia Pacific trade-finance contributor sees exporters with year-end peaks flagged as deteriorating versus the prior quarter.'],
  ].map(([id, sourceId, orgId, title, summary]) => {
    const c = contributions.find((x) => x.id === sourceId);
    return { id, sourceId, orgId, title, summary, type: c.type, offering: c.offering, industry: c.industry, region: c.region, period: '2026-Q2', theme: 'Seasonality context', confidence: c.confidence, evidenceType: c.evidenceType, attribution: null, version: 1, publishedAt: t(20), active: true, feedback: { useful: [], needsEvidence: [] }, reviewedBy: 'u_mod' };
  });

  return {
    products, orgs, users, contributions, shared,
    ideas: [{ id: 'idea_season', title: 'Seasonality-aware comparison explanation', problem: 'Quarter-on-quarter comparisons misread seasonal SMEs as declining.', offering: 'financial-analysis-intelligence', evidence: ['shr_s1', 'shr_s2', 'shr_s3'], outcome: 'Explanations compare like-for-like seasonal periods and say so.', ownerId: 'u_po', team: 'Financial Analysis Intelligence', priority: 'High', status: 'Under review', shared: true, publicNote: 'We are reviewing how comparisons explain seasonal businesses. This is not a delivery commitment.', updatedAt: t(5), history: [{ at: t(10), status: 'Proposed', by: 'omar@azentio.com' }, { at: t(5), from: 'Proposed', status: 'Under review', by: 'omar@azentio.com' }] }],
    banners: [
      { id: 'ban_1', title: 'Azentio Build Labs is live', text: 'Top teams from 2,000+ applicants are building the future of applied AI. Register your team.', audience: 'public', active: true },
    ],
    media: [
      { id: 'med_p1', title: 'SME Credit Decisioning in 3 minutes', description: 'A walkthrough of evidence-backed recommendations with analyst sign-off.', kind: 'recording', audience: 'public', duration: '3:12' },
      { id: 'med_p2', title: 'Document Intelligence showcase', description: 'From bilingual statements to structured data.', kind: 'recording', audience: 'public', duration: '4:40' },
      { id: 'med_e1', title: 'Internal: AI Lab weekly broadcast', description: 'Employee-only: experiment results and prototype notes.', kind: 'live', audience: 'employee', duration: 'Live Thu 15:00' },
      { id: 'med_e2', title: 'Internal: Prompt evaluation retro (recording)', description: 'Employee-only recording.', kind: 'recording', audience: 'employee', duration: '28:05' },
      { id: 'med_c1', title: 'Client briefing: Q3 release overview', description: 'Invitation-only webinar for client workspaces.', kind: 'recording', audience: 'clients', duration: '22:10' },
    ],
    insights: [
      { title: 'Why explainability beats accuracy alone in credit AI', tag: 'Perspective', minutes: 6 },
      { title: 'Human oversight patterns for AI agents in lending', tag: 'Guide', minutes: 8 },
      { title: 'From documents to decisions: a practical roadmap', tag: 'Playbook', minutes: 5 },
    ],
    events: [
      { id: 'ev_1', title: 'Azentio Build Labs Hackathon', when: 'Nov 2026', audience: 'public', kind: 'Hackathon' },
      { id: 'ev_2', title: 'Client webinar: Seasonality in SME analysis', when: '18 Nov 2026', audience: 'clients', kind: 'Webinar' },
      { id: 'ev_3', title: 'Gulf Horizon roadmap briefing', when: '20 Nov 2026', audience: 'org:org_gulf', kind: 'Briefing' },
    ],
    resources: [
      { title: 'Gulf Horizon onboarding pack', audience: 'org:org_gulf' },
      { title: 'Shared-learning contribution guide', audience: 'clients' },
    ],
    experiments: [
      { id: 'exp_1', title: 'LLM explanations for ratio changes', hypothesis: 'Plain-language explanations cut analyst override time by 30%.', owner: 'Priya (Employee)', status: 'Running', at: t(9) },
      { id: 'exp_2', title: 'Bilingual OCR fallback', hypothesis: 'A second-pass model reduces re-keying on Arabic totals.', owner: 'AI Lab', status: 'Submitted', at: t(3) },
    ],
    knowledge: [
      { id: 'kn_1', title: 'Prompt guidelines for AIRA', owner: 'AI Lab', reviewDate: '2027-01-15', feedback: [] },
      { id: 'kn_2', title: 'Synthetic data generation standard', owner: 'Data Governance', reviewDate: '2026-12-01', feedback: [] },
      { id: 'kn_3', title: 'Moderation & de-identification playbook', owner: 'Learning Moderation', reviewDate: '2026-12-20', feedback: [] },
    ],
    releaseNotes: [{ version: '2026.10', note: 'Shared learning feed, theme dashboard and AIRA citations.' }, { version: '2026.09', note: 'Sandbox playground with synthetic SME scenarios.' }],
    teams: [{ name: 'Team Lumen', track: 'AI Website & Employee Portal', members: 4 }, { name: 'Team Ledger', track: 'Document Intelligence', members: 3 }],
    scenarios: [
      { id: 'sc_1', product: 'sme-credit-decisioning', name: 'Seasonal retailer (synthetic)', inputs: { netOperatingIncome: 182000, debtService: 131000, peakMonthRevenue: 96000, troughMonthRevenue: 41000, yearsTrading: 6, debtToEquity: 1.6 } },
      { id: 'sc_2', product: 'sme-credit-decisioning', name: 'Young logistics SME (synthetic)', inputs: { netOperatingIncome: 74000, debtService: 70000, peakMonthRevenue: 30000, troughMonthRevenue: 24000, yearsTrading: 2, debtToEquity: 2.8 } },
      { id: 'sc_3', product: 'financial-analysis-intelligence', name: 'Harvest-cycle agri trader (synthetic)', inputs: { netOperatingIncome: 120000, debtService: 88000, peakMonthRevenue: 70000, troughMonthRevenue: 15000, yearsTrading: 9, debtToEquity: 1.2 } },
      { id: 'sc_4', product: 'credit-strategy-simulator', name: 'Tightened DSCR policy (synthetic)', inputs: { netOperatingIncome: 150000, debtService: 118000, peakMonthRevenue: 50000, troughMonthRevenue: 40000, yearsTrading: 4, debtToEquity: 1.9 } },
      { id: 'sc_5', product: 'similar-portfolio-intelligence', name: 'Exporter with year-end peak (synthetic)', inputs: { netOperatingIncome: 210000, debtService: 150000, peakMonthRevenue: 120000, troughMonthRevenue: 45000, yearsTrading: 11, debtToEquity: 1.4 } },
      { id: 'sc_6', product: 'riva', name: 'Regional report reconciliation (synthetic)', inputs: { netOperatingIncome: 90000, debtService: 60000, peakMonthRevenue: 20000, troughMonthRevenue: 18000, yearsTrading: 5, debtToEquity: 1.0 } },
      { id: 'sc_7', product: 'document-intelligence', name: 'Bilingual statement pack (synthetic)', inputs: { netOperatingIncome: 64000, debtService: 52000, peakMonthRevenue: 15000, troughMonthRevenue: 12000, yearsTrading: 3, debtToEquity: 2.1 } },
    ],
    invitations: [{ id: 'inv_seed', token: 'demo-invite-gulf', orgId: 'org_gulf', email: 'newanalyst@gulfhorizon.example', role: 'client_member', status: 'pending', invitedBy: 'sara@gulfhorizon.example', expires: new Date(Date.now() + 72 * 3600e3).toISOString(), at: t(0) }],
    notifications: [], audit: [], reports: [], runs: [], playgroundFeedback: [], demoRequests: [], hackathonRegs: [], models: [],
  };
};
