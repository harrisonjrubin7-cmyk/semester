import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLAUSES, DOCUMENTS, OWNER_STEPS, QUESTIONS, READ_ON, STANDING, type Provider } from './provider-terms';
import { PARTIES } from './subprocessors';
import { SHARED_PROVIDER } from '../../../../supabase/functions/_shared/provideractivation';

/**
 * Holds the provider-terms record to what it may claim. Every clause cites a
 * document on the record, every document sits on its provider's own host,
 * each provider answers every question the DPA checklist asks, every AI party
 * Semester or an institution directs is covered — and nothing is `accepted`
 * or `signed`, because no executed agreement is recorded in the shared-provider
 * activation record. The day one is, this test is the one to change.
 *
 * `docs/trust/PROVIDER-TERMS.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const DOC = 'docs/trust/PROVIDER-TERMS.md';
const HOSTS: Record<Provider, readonly string[]> = { Anthropic: ['anthropic.com', 'claude.com'], OpenAI: ['openai.com'] };
const official = (p: Provider, url: string) => {
  const host = new URL(url).hostname;
  return url.startsWith('https://') && HOSTS[p].some((h) => host === h || host.endsWith(`.${h}`));
};

describe('the provider terms record', () => {
  it('keeps every document on its provider’s own host, with a hash for every PDF', () => {
    expect(new Set(DOCUMENTS.map((d) => d.id)).size).toBe(DOCUMENTS.length);
    for (const d of DOCUMENTS) {
      expect(official(d.provider, d.url), `${d.id} is not on ${d.provider}’s host`).toBe(true);
      expect(d.version.trim().length, d.id).toBeGreaterThan(3);
      if (d.url.endsWith('.pdf')) expect(d.sha256, d.id).toMatch(/^[0-9a-f]{64}$/);
      else expect(d.sha256, d.id).toBeNull();
    }
    expect(READ_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('answers every checklist question for each provider, each from a document of its own', () => {
    for (const p of ['Anthropic', 'OpenAI'] as const) {
      expect(CLAUSES.filter((c) => c.provider === p).map((c) => c.question), p).toEqual([...QUESTIONS]);
    }
    for (const c of CLAUSES) {
      const d = DOCUMENTS.find((x) => x.id === c.doc);
      expect(d, `${c.provider} ${c.question} cites ${c.doc}`).toBeDefined();
      expect(d!.provider, `${c.provider} ${c.question} cites the other provider’s document`).toBe(c.provider);
      expect(c.quote.trim().length, `${c.provider} ${c.question}`).toBeGreaterThan(20);
      expect(c.reading.trim().length, `${c.provider} ${c.question}`).toBeGreaterThan(20);
    }
  });

  it('covers every AI party Semester or an institution directs, and no student-directed one', () => {
    const directed = PARTIES.filter((p) => /\bAI\b/.test(p.purpose) && p.kind !== 'student-directed').map((p) => p.name);
    expect(directed.length).toBeGreaterThan(0);
    expect(STANDING.map((s) => s.party).sort()).toEqual([...directed].sort());
    for (const s of STANDING) expect(s.party.startsWith(s.provider), s.party).toBe(true);
  });

  it('claims nothing is accepted or signed while no executed agreement is recorded', () => {
    // Keyed on the activation record's accepted-terms field, not on whether
    // docs/evidence/vendors/ exists: filing the entity's evidence there first
    // must not fail this test while the terms are still unaccepted. The day
    // termsAccepted is recorded, provideractivation.test.ts fails until the
    // Anthropic row here moves too. OpenAI has no record of Semester's; its
    // row moves only when this test is changed.
    expect(SHARED_PROVIDER.termsAccepted.status, 'Anthropic terms are recorded as accepted: move STANDING, then change this test').toBe('pending-owner');
    for (const s of STANDING) {
      expect(s.standing, s.party).toBe('published');
      expect(s.today, s.party).toMatch(/^Not in force\./);
    }
    expect(OWNER_STEPS.length).toBeGreaterThanOrEqual(4);
  });

  it('leaves no register saying the provider terms are not on file or not recorded', () => {
    // Codex found four registers still saying so after this record landed; the
    // walk is the guard, so a fifth copy is caught rather than hunted for.
    const stale = /(provider|training) terms[^.\n'`]{0,30}\bnot\s+(yet\s+)?(on file|recorded)|until provider terms are on file|provider terms not on file/i;
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const full = join(dir, f);
        if (statSync(full).isDirectory()) return f === 'node_modules' ? [] : walk(full);
        return /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts') ? [full] : [];
      });
    const hits = walk(join(root, 'app', 'src', 'lib')).filter((f) => stale.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => f.slice(root.length + 1))).toEqual([]);
    // The control: the pattern does catch the sentence the four registers used to carry.
    expect(stale.test('A draft for counsel; provider terms not on file.')).toBe(true);
    expect(stale.test('training terms per provider are not yet recorded')).toBe(true);
    expect(stale.test('Published terms are recorded; none is accepted or signed.')).toBe(false);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function render(): string {
  const out: string[] = [
    '# AI provider terms, as published',
    '',
    '<!-- Rendered from app/src/lib/trust/provider-terms.ts by provider-terms.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    `**Nothing on this page is signed.** These are the terms each AI provider publishes, read on ${READ_ON} and quoted word for word, so the [DPA checklist](DPA-CHECKLIST.md) and the [vendor risk register](VENDOR-RISK-REGISTER.md) can say what the terms are rather than that nobody has read them. A published term binds Semester only once Semester accepts it; *Standing* below says what that would take and whether it has happened. The test holds every party to *published* until an executed agreement, or a pointer to one, is filed under \`docs/evidence/vendors/\`.`,
    '',
    '## Standing',
    '',
    '| Party | Terms apply when | Today |',
    '| --- | --- | --- |',
    ...STANDING.map((s) => `| ${s.party} | ${cell(s.appliesWhen)} | ${cell(s.today)} |`),
    '',
    'Student-directed parties (a student’s own key) run under the student’s own agreement with the provider and are not recorded here.',
    '',
    '## The documents',
    '',
    '| Provider | Document | Version | SHA-256 of the copy read |',
    '| --- | --- | --- | --- |',
    ...DOCUMENTS.map((d) => `| ${d.provider} | [${cell(d.title)}](${d.url}) | ${cell(d.version)} | ${d.sha256 ? `\`${d.sha256}\`` : 'web page — effective date instead'} |`),
    '',
  ];
  for (const p of ['Anthropic', 'OpenAI'] as const) {
    out.push(`## ${p}`, '', '| Question | Section | The clause, verbatim | What it means for Semester |', '| --- | --- | --- | --- |');
    for (const c of CLAUSES.filter((x) => x.provider === p)) {
      const d = DOCUMENTS.find((x) => x.id === c.doc)!;
      out.push(`| ${c.question} | [${cell(d.title)}](${d.url}) ${cell(c.section)} | “${cell(c.quote)}” | ${cell(c.reading)} |`);
    }
    out.push('');
  }
  out.push('## What only the owner can do', '', ...OWNER_STEPS.map((s, i) => `${i + 1}. ${s}`), '');
  return out.join('\n');
}
