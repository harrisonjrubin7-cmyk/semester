import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNCIL, SEATS } from '../launchreadiness';
import { REGISTER } from '../masterregister';
import { DEFAULT_SITE } from '../../site/config';
import { ROUTES, renderPage } from '../../site/render';
import {
  AUDIENCES,
  CLAIMS,
  CLAIM_STATUSES,
  FLOOR,
  POLICIES,
  POLICY_MEANING,
  PROOF_RULES,
  STATUS_LABEL,
  STATUS_MEANING,
  escapeHtml,
  policyProblems,
  problems,
  type Claim,
  type Facts,
} from './claims';
import { CALENDAR } from './proofcalendar';
import { EVIDENCE, expiredUnder } from './evidence';
import { CAPABILITY_DEFINITIONS } from '../governance/capability-governance';
import { projectClaim, repositoryProjectionContext } from '../governance/projections';
import { cell, controlLine, link, renderedFrom, table } from './render';

/**
 * The claims register, held to the tree and to the site.
 *
 * Three things are checked, and the order matters:
 *
 *   1. **The checks catch what they are for.** Each rule in `problems()` is
 *      shown a claim that breaks it before it is trusted to pass the real
 *      ones — an "available" with no test, a word above its rows, a page that
 *      prints a label the register does not know. A check that has never
 *      failed is not known to be a check.
 *   2. **The real register passes.** Every path exists, every row is in the
 *      master register and at or above the claim's floor, every proof is on
 *      the calendar, and every page named prints the wording with its label.
 *   3. **The site prints nothing else.** Every `data-claim` on every page is a
 *      registered id, and its label is the register's word for it.
 *
 * `ops/claims/README.md` is rendered from the data; `npm run registers` from
 * app/ rewrites it, and the last test fails while it is stale.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const DOC = 'ops/claims/README.md';

const pages = new Map(ROUTES.map((r) => [r.path, renderPage(r, DEFAULT_SITE)]));
// UTC avoids a different expiry decision across developer timezones.
const TODAY = new Date().toISOString().slice(0, 10);
const contexts = Object.fromEntries(CAPABILITY_DEFINITIONS.map((c) => [c.id, repositoryProjectionContext(c, EVIDENCE, TODAY, CLAIMS)]));
const FACTS: Facts = {
  capabilityExists: (id) => CAPABILITY_DEFINITIONS.some((capability) => capability.id === id),
  claimProjection: (claim) => projectClaim(claim, CAPABILITY_DEFINITIONS, contexts),
  expiredEvidence: expiredUnder(EVIDENCE, TODAY),
  rowStatus: (id) => REGISTER.find((r) => r.id === id)?.status,
  exists: (p) => existsSync(at(p)),
  proofExists: (id) => CALENDAR.some((c) => c.id === id),
  routes: ROUTES.map((r) => r.path),
  page: (route) => pages.get(route),
};

const sound: Claim = {
  id: 'fixture',
  capabilityIds: ['CAP-001'],
  claim: 'A fixture',
  scope: 'For the test',
  status: 'available',
  owner: 'engineering',
  pages: ['/'],
  audiences: ['students'],
  evidence: [{ path: 'app/src/lib/ops/claims.test.ts', shows: 'this' }],
  rows: ['TRUST-001'],
};
/** Facts under which `sound` is sound: the home page prints it. */
const fixtureFacts: Facts = {
  ...FACTS,
  claimProjection: undefined,
  expiredEvidence: undefined,
  routes: ['/'],
  page: (route) => (route === '/' ? `<li data-claim="fixture"><span class="site-badge site-status site-status-available">Available now</span> A fixture</li>` : ''),
};

describe('the checks', () => {
  it('rejects an unknown canonical capability and an empty binding', () => {
    expect(problems([{ ...sound, capabilityIds: ['CAP-999'] }], fixtureFacts)).toContain('fixture binds unknown capability CAP-999.');
    expect(problems([{ ...sound, capabilityIds: [] }], fixtureFacts)).toContain('fixture names no canonical capability.');
  });

  it('reports a supplied projection denial without replacing the other checks', () => {
    expect(problems([sound], { ...fixtureFacts, claimProjection: () => ({ permitted: false, reason: 'tenant approval missing' }) })).toContain('fixture exceeds its capability projection: tenant approval missing.');
  });
  it('pass a sound claim', () => {
    expect(problems([sound], fixtureFacts)).toEqual([]);
  });

  it('catch an available claim with no test behind it', () => {
    expect(problems([{ ...sound, evidence: [{ path: 'RETENTION.md', shows: 'a document' }] }], fixtureFacts)).toEqual(['fixture is available and cites no test.']);
  });

  it('catch a word above what the register supports', () => {
    // IAM-003 (institution SSO) is building: below the floor for an available claim.
    expect(problems([{ ...sound, rows: ['IAM-003'] }], fixtureFacts)).toEqual(['fixture claims available, but IAM-003 is building (needs tested).']);
    expect(problems([{ ...sound, status: 'planned', rows: ['IAM-003'] }], { ...fixtureFacts, page: () => `<li data-claim="fixture"><span class="site-badge site-status site-status-planned">Planned</span> A fixture</li>` })).toEqual([]);
  });

  it('catch a row, a path, a proof or a page that does not exist', () => {
    expect(problems([{ ...sound, rows: ['ZZZ-999'] }], fixtureFacts)).toEqual(['fixture rests on ZZZ-999, which is not in the master register.']);
    expect(problems([{ ...sound, evidence: [{ path: 'app/src/nowhere.test.ts', shows: '' }] }], fixtureFacts)).toEqual(['fixture cites app/src/nowhere.test.ts, which does not exist.']);
    expect(problems([{ ...sound, proof: 'nothing' }], fixtureFacts)).toEqual(['fixture names proof nothing, which is not on the calendar.']);
    expect(problems([{ ...sound, pages: ['/nowhere/'] }], fixtureFacts)).toEqual(['fixture names page /nowhere/, which is not a route.']);
  });

  it('catch a claim that is not yet available and names nothing that would move it', () => {
    expect(problems([{ ...sound, status: 'planned', rows: [] }], { ...fixtureFacts, page: () => `<li data-claim="fixture"><span class="site-badge site-status site-status-planned">Planned</span> A fixture</li>` })).toEqual([
      'fixture is planned and names no register row that would move it.',
    ]);
  });

  it('catch an available claim resting on evidence that has expired', () => {
    const facts: Facts = { ...fixtureFacts, expiredEvidence: (id) => (id === 'fixture' ? ['stale-record'] : []) };
    expect(problems([sound], facts)).toEqual(['fixture is available and rests on stale-record, which has expired.']);
    // The control: a claim that is not available may rest on it; the register says so in its own words.
    const planned = `<li data-claim="fixture"><span class="site-badge site-status site-status-planned">Planned</span> A fixture</li>`;
    expect(problems([{ ...sound, status: 'planned', rows: ['IAM-003'] }], { ...facts, page: () => planned })).toEqual([]);
    // And a caller with no register is not told anything expired.
    expect(problems([sound], fixtureFacts)).toEqual([]);
  });

  it('catch a page that prints the wrong label, no label, or the wording missing', () => {
    expect(problems([sound], { ...fixtureFacts, page: () => `<li data-claim="fixture"><span class="site-badge site-status site-status-planned">Planned</span> A fixture</li>` })).toEqual([
      '/ labels fixture “Planned”, but it is Available now.',
    ]);
    expect(problems([sound], { ...fixtureFacts, page: () => 'A fixture' })).toEqual(['/ prints no status for fixture.']);
    expect(problems([sound], { ...fixtureFacts, page: () => `<li data-claim="fixture"><span class="site-badge site-status site-status-available">Available now</span></li>` })).toEqual([
      '/ does not print the wording of fixture.',
    ]);
  });

  it('catch a label on the site that no claim registered', () => {
    expect(problems([sound], { ...fixtureFacts, page: () => `${fixtureFacts.page('/')}<li data-claim="stray"></li>` })).toEqual(['/ prints a status for stray, which is not registered.']);
  });

  it('catch wording the page would escape', () => {
    expect(problems([{ ...sound, claim: "It's a fixture" }], fixtureFacts)).toContain('fixture: the wording carries a character the page would escape; use ’ and “ ”.');
    expect(escapeHtml(`a & b's "c" <d>`)).toBe('a &amp; b&#x27;s &quot;c&quot; &lt;d&gt;');
  });

  it('catch a policy with a path but nothing written, or in force with no date', () => {
    const facts = { exists: () => true, rowStatus: () => 'building' as const };
    expect(policyProblems([{ id: 'p', policy: 'P', status: 'not-started', path: 'x.md', version: '0', effective: null, owner: 'privacy', rows: [] }], facts)).toEqual(['p: a policy has a path exactly when something is written.']);
    expect(policyProblems([{ id: 'p', policy: 'P', status: 'in-force', path: 'x.md', version: '0', effective: null, owner: 'privacy', rows: [] }], facts)).toEqual(['p is in force with no effective date or version.']);
    expect(policyProblems([{ id: 'p', policy: 'P', status: 'draft', path: 'x.md', version: '1.0', effective: null, owner: 'privacy', rows: [] }], facts)).toEqual(['p carries a version or effective date but is not in force.']);
  });
});

describe('the register', () => {
  it('has a word, a meaning and a floor for every status', () => {
    for (const s of CLAIM_STATUSES) {
      expect(STATUS_LABEL[s]).toBeTruthy();
      expect(STATUS_MEANING[s]).toBeTruthy();
      expect(FLOOR[s]).toBeTruthy();
    }
    for (const s of Object.keys(POLICY_MEANING)) expect(POLICY_MEANING[s as keyof typeof POLICY_MEANING]).toBeTruthy();
  });

  it('is owned by seats, and speaks to the four audiences', () => {
    for (const c of CLAIMS) {
      expect(SEATS).toContain(c.owner);
      expect(c.audiences.length, `${c.id} speaks to nobody`).toBeGreaterThan(0);
      for (const a of c.audiences) expect(AUDIENCES.map((x) => x.id)).toContain(a);
    }
    for (const a of AUDIENCES) expect(CLAIMS.some((c) => c.audiences.includes(a.id)), `nothing is said to ${a.id}`).toBe(true);
  });

  it('holds every claim to the tree, the master register, the calendar and the site', () => {
    expect(problems(CLAIMS, FACTS)).toEqual([]);
  });

  it('holds every policy to the tree', () => {
    expect(policyProblems(POLICIES, FACTS)).toEqual([]);
    expect(POLICIES.filter((p) => p.status === 'in-force')).toEqual([]); // the day this changes, /legal/ shows a version and a date
    for (const p of POLICIES) expect(SEATS).toContain(p.owner);
  });

  it('is what the launch-readiness page prints, every claim, for every audience', () => {
    const html = pages.get('/launch-readiness/')!;
    for (const c of CLAIMS) expect(html, c.id).toContain(`data-claim="${c.id}"`);
    for (const a of AUDIENCES) expect(html).toContain(escapeHtml(a.question));
    for (const s of CLAIM_STATUSES) expect(html).toContain(escapeHtml(STATUS_MEANING[s]));
  });

  it('is what the proof page promises', () => {
    const html = pages.get('/proof/')!;
    for (const rule of PROOF_RULES) expect(html).toContain(escapeHtml(rule));
  });

  it('is what the legal page shows: every policy, none in force', () => {
    const html = pages.get('/legal/')!;
    for (const p of POLICIES) expect(html).toContain(escapeHtml(p.policy));
    expect(html).not.toMatch(/in force since|effective from \d/i);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(at(DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ──────────────────────────────────────────────────────────────

function render(): string {
  const ref = (p: string) => `[\`${p}\`](${link(DOC, p)})`;
  const seat = (s: string) => `\`${s}\``;
  const count = (s: string) => CLAIMS.filter((c) => c.status === s).length;
  const out: string[] = [
    '# Claims register',
    '',
    renderedFrom('app/src/lib/ops/claims.ts', 'claims.test.ts'),
    '',
    controlLine(DOC),
    '',
    'Every capability the public site asserts, the status it may claim, the',
    'evidence behind it and the pages it appears on. This is the map the master',
    'register asks for in PRG-002: a public claim traces to the rows it rests on,',
    'and the test refuses a claim whose word is above what those rows support, an',
    '"available" with no test behind it, a page that does not print the wording,',
    'and a page that prints a status label this register does not know.',
    '',
    'The register covers the public site. Sales decks, RFP answers and anything',
    'said in a meeting are not yet mapped; when they are, they are rows here with',
    'a `pages` entry of their own kind, not a second register.',
    '',
    '## The words',
    '',
    'The site prints one of six words beside a capability. Each has a floor: the',
    'lowest master-register status its rows may hold. A claim may understate; it',
    'may not overstate.',
    '',
    ...table(
      ['Word', 'Means', 'Floor', 'Claims'],
      CLAIM_STATUSES.map((s) => [`**${STATUS_LABEL[s]}**`, STATUS_MEANING[s], `\`${FLOOR[s]}\``, String(count(s))]),
      ['left', 'left', 'left', 'right'],
    ),
    '',
    `${CLAIMS.length} claims in all. Nothing is \`limited-beta\` or \`institution-configured\`: there is no design partner and no configured institution, so neither word is earned yet.`.replace(
      'Nothing is `limited-beta` or `institution-configured`',
      count('limited-beta') + count('institution-configured') === 0 ? 'Nothing is `limited-beta` or `institution-configured`' : 'Some are `limited-beta` or `institution-configured`',
    ),
    '',
    '## The claims',
    '',
    ...table(
      ['Id', 'Claim', 'Status', 'Owner', 'Capabilities', 'Rests on', 'Would move it', 'Evidence', 'Pages'],
      CLAIMS.map((c) => [
        `\`${c.id}\``,
        `**${cell(c.claim)}**<br>${cell(c.scope)}`,
        STATUS_LABEL[c.status],
        seat(c.owner),
        c.capabilityIds.map((id) => `\`${id}\``).join(', '),
        c.rows.length ? c.rows.map((r) => `\`${r}\``).join(', ') : '—',
        c.proof ? `[\`${c.proof}\`](${link(DOC, 'docs/PROOF-CALENDAR.md')})` : '—',
        c.evidence.length ? c.evidence.map((e) => `${ref(e.path)} — ${cell(e.shows)}`).join('<br>') : '—',
        c.pages.map((p) => `\`${p}\``).join(', '),
      ]),
    ),
    '',
    'Every claim also appears on `/launch-readiness/`, grouped by the audience it',
    'answers: ' + AUDIENCES.map((a) => `**${a.title}** (${a.question})`).join('; ') + '.',
    '',
    '## The policies',
    '',
    'What `/legal/` lists. No policy is in force; the day one is, it carries a',
    'version, an effective date, its previous versions and a plain-language',
    'summary of what changed, and this table says so.',
    '',
    ...table(
      ['Policy', 'Status', 'Where', 'Owner', 'Rests on', 'Note'],
      POLICIES.map((p) => [p.policy, `\`${p.status}\``, p.path ? ref(p.path) : '—', seat(p.owner), p.rows.map((r) => `\`${r}\``).join(', '), p.note ? cell(p.note) : '—']),
    ),
    '',
    ...Object.entries(POLICY_MEANING).map(([s, m]) => `- \`${s}\`: ${m}.`),
    '',
    '## The proof policy',
    '',
    'How Semester will show proof, written before there is any to show, and',
    'printed at `/proof/`:',
    '',
    ...PROOF_RULES.map((r) => `- ${r}`),
    '',
    '## How a claim changes',
    '',
    '1. Edit `app/src/lib/ops/claims.ts`: the wording, the word, the rows, the',
    '   evidence, the pages. The founder seat owns the register; the owning seat',
    '   of the claim approves its wording.',
    '2. Run the suite. `claims.test.ts` refuses a word the rows do not support,',
    '   a page that does not print it, and a label the register does not know.',
    '3. Run `npm run registers` from app/ so this page matches, and commit both',
    '   in the same change.',
    '',
    'When evidence lapses — a proof-calendar artifact expires, a row falls below',
    'a floor — the test fails on the next change, and the claim is reworded or',
    'the row is moved back up before anything else merges. That is the',
    '"claim-to-evidence control": not a review, a red build.',
    '',
    `The seats are those of ${ref('docs/LAUNCH-READINESS-COUNCIL.md')}: ${COUNCIL.map((s) => `\`${s.seat}\` (${s.title})`).join(', ')}. Every seat is vacant; the owner column says which will hold it.`,
    '',
  ];
  return out.join('\n');
}
