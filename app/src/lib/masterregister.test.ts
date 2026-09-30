import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ARTIFACTS,
  DOMAINS,
  GATES,
  NEEDS_EVIDENCE_DIR,
  REGISTER,
  SIGNOFFS,
  STATUSES,
  STATUS_MEANING,
  STOP_CONDITIONS,
  domainOf,
  rowsOf,
  verdict,
  type Domain,
  type Requirement,
} from './masterregister';
import { COUNCIL, CURRENT, SEATS } from './launchreadiness';

/**
 * The master register is only worth having if a row cannot claim more than the
 * repository shows. So each status is held to the kind of file it would need:
 *
 *   - every cited path exists, with a control that a missing one reads missing;
 *   - `designed` cites a document, `building`/`implemented` cite code, and
 *     `tested` cites a test that runs on every change;
 *   - nothing reaches `evidenced` or above without an artifact under
 *     `docs/evidence/`, and nothing is `launch-approved` with a sign-off vacant;
 *   - the gates cover every row, and `verdict` refuses from a state that would
 *     otherwise pass, one rule at a time.
 *
 * `docs/MASTER-LAUNCH-READINESS-REGISTER.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/MASTER-LAUNCH-READINESS-REGISTER.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) =>
  /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p) || /^app\/scripts\/.*smoke.*\.mjs$/.test(p) || p === 'supabase/restore.sh';
const isCode = (p: string) => !isDoc(p);

describe('the master launch readiness register', () => {
  describe('its shape', () => {
    it('holds all 142 rows of the plan, once each, in domain order', () => {
      expect(REGISTER).toHaveLength(142);
      const ids = REGISTER.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
      const order = Object.keys(DOMAINS);
      const seen = ids.map((id) => order.indexOf(domainOf(id)));
      expect(seen.every((d, i) => d >= 0 && (i === 0 || d >= seen[i - 1]))).toBe(true);
    });

    it('numbers each domain from 001 without a hole', () => {
      for (const domain of Object.keys(DOMAINS) as Domain[]) {
        const nums = REGISTER.filter((r) => domainOf(r.id) === domain).map((r) => Number(r.id.split('-')[1]));
        expect(nums.length, domain).toBeGreaterThan(0);
        expect(nums, domain).toEqual(nums.map((_, i) => i + 1));
      }
    });

    it('says what every row needs, what proves it, and what is missing', () => {
      for (const r of REGISTER) {
        expect(r.capability.trim(), r.id).toBeTruthy();
        expect(r.requirement.trim(), r.id).toBeTruthy();
        expect(r.validation.trim(), r.id).toBeTruthy();
        expect(['P0', 'P1', 'P2'], r.id).toContain(r.severity);
        expect(STATUSES, r.id).toContain(r.status);
        if (r.status !== 'launch-approved') expect(r.gap.trim().length, `${r.id} is ${r.status} and names no gap`).toBeGreaterThan(20);
      }
    });
  });

  describe('its evidence', () => {
    it('can tell a missing file from a present one', () => {
      expect(existsSync(join(root, 'README.md'))).toBe(true);
      expect(existsSync(join(root, 'app/src/lib/no-such-register-evidence.ts'))).toBe(false);
    });

    it('cites only files that exist', () => {
      for (const r of REGISTER) {
        for (const { path } of r.evidence) expect(existsSync(join(root, path)), `${r.id} cites ${path}, which is missing`).toBe(true);
      }
    });

    it('classifies the kinds of file correctly, which is what the next rule relies on', () => {
      expect(isTest('app/src/lib/sla.test.ts')).toBe(true);
      expect(isTest('supabase/rls-coverage.check.sql')).toBe(true);
      expect(isTest('app/src/lib/sla.ts')).toBe(false);
      expect(isDoc('docs/trust/SLA.md')).toBe(true);
      expect(isCode('.github/workflows/ci.yml')).toBe(true);
      expect(isCode('docs/trust/SLA.md')).toBe(false);
    });

    it('holds each status to the kind of file it claims', () => {
      for (const r of REGISTER) {
        const paths = r.evidence.map((e) => e.path);
        if (r.status === 'designed') expect(paths.some(isDoc), `${r.id} is designed and cites no document`).toBe(true);
        if (r.status === 'building' || r.status === 'implemented') expect(paths.some(isCode), `${r.id} is ${r.status} and cites no code`).toBe(true);
        if (r.status === 'tested') expect(paths.some(isTest), `${r.id} is tested and cites no test`).toBe(true);
        if (r.status !== 'not-started' && r.status !== 'blocked') expect(paths.length, `${r.id} is ${r.status} with nothing cited`).toBeGreaterThan(0);
      }
    });

    it('lets nothing claim an outside event without an artifact under docs/evidence/', () => {
      for (const r of REGISTER) {
        if (NEEDS_EVIDENCE_DIR.includes(r.status)) {
          expect(r.evidence.some((e) => e.path.startsWith('docs/evidence/')), `${r.id} is ${r.status}`).toBe(true);
        }
      }
      // The directory's first files were the AI drills of 29 September, and
      // one row rests on them. Said directly, so the next one is noticed.
      expect(REGISTER.filter((r) => NEEDS_EVIDENCE_DIR.includes(r.status)).map((r) => r.id)).toEqual(['AI-012']);
    });

    it('describes the council as launchreadiness.ts has it, seat for seat', () => {
      // PRG-001 said "no AI/SRE/GTM seat" for a day after the operations seat
      // existed (D-120), found by Codex on #945. The row now quotes the counts,
      // and this holds them to the council data.
      const row = REGISTER.find((r) => r.id === 'PRG-001')!;
      const shows = row.evidence.find((e) => e.path === 'app/src/lib/launchreadiness.ts')!.shows;
      const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
      const lower = shows.toLowerCase();
      const held = COUNCIL.filter((c) => c.holder !== null).length;
      expect(lower).toContain(`${WORDS[SEATS.length]} seats`);
      expect(lower).toContain(`${WORDS[held]} held`);
      expect(lower).toContain(`${WORDS[SEATS.length - held]} vacant`);
      // Who holds them, and how, is held too (Codex on #947): a seat that
      // passes to someone else, an acting holder confirmed, or a signature
      // given must each change the sentence.
      // An empty council holds nothing, so nothing in it is "all by the
      // founder" and nobody in it is acting (Codex on #951: `every` is true
      // of an empty list).
      const founderOnly = held > 0 && COUNCIL.every((c) => c.holder === null || c.holder.startsWith('Founder'));
      expect(lower.includes('all by the founder'), 'PRG-001 says every held seat is the founder\'s').toBe(founderOnly);
      const acting = COUNCIL.filter((c) => c.holder?.endsWith(', acting')).length;
      if (held > 0) expect(lower).toContain(`${WORDS[acting]} of them acting`);
      else expect(lower).not.toContain('of them acting');
      const signed = CURRENT.signoffs.length;
      expect(lower).toContain(signed === 0 ? 'none signed' : `${WORDS[signed]} signed`);
      if (signed > 0) expect(lower).not.toContain('none signed');
      for (const seat of SEATS) expect(shows, `PRG-001 names the ${seat} seat`).toContain(seat);
      // A seat the council has is never reported missing, by either name.
      for (const name of [...SEATS, 'SRE']) expect(shows, `PRG-001 says there is no ${name} seat`).not.toMatch(new RegExp(`\\bno\\b[^.;]*\\b${name}\\b`, 'i'));
    });

    it('approves no row while any sign-off is vacant', () => {
      if (SIGNOFFS.some((s) => !s.signed)) expect(REGISTER.filter((r) => r.status === 'launch-approved')).toEqual([]);
      for (const s of SIGNOFFS) if (s.signed) expect(s.signed, s.fn).not.toMatch(/@/);
    });

    it('cites only files that exist for the artifact index, and points at itself', () => {
      for (const a of ARTIFACTS) {
        for (const path of a.covered) expect(existsSync(join(root, path)), `${a.name} → ${path}`).toBe(true);
        if (a.state === 'missing') expect(a.covered, a.name).toEqual([]);
        else expect(a.covered.length, a.name).toBeGreaterThan(0);
        // An artifact the brief asks to add must not already exist under that name
        // somewhere this index fails to mention.
        if (a.state !== 'this-register') expect(existsSync(join(root, 'docs', a.name)), `docs/${a.name} exists; index it`).toBe(false);
      }
      expect(ARTIFACTS).toHaveLength(18);
    });
  });

  describe('the gates', () => {
    it('A to G together own every row, and only rows that exist', () => {
      const ids = new Set(REGISTER.map((r) => r.id));
      const owned = GATES.filter((g) => g.id !== 'H').flatMap((g) => g.rows);
      for (const id of owned) expect(ids.has(id), `a gate owns ${id}, which is not a row`).toBe(true);
      expect([...ids].filter((id) => !owned.includes(id)), 'rows no gate owns').toEqual([]);
      expect(rowsOf(GATES.find((g) => g.id === 'H')!)).toHaveLength(REGISTER.length);
    });

    it('none passes today', () => {
      for (const gate of GATES) expect(verdict(gate).passes, gate.id).toBe(false);
    });

    const approved = (): Requirement[] => REGISTER.map((r) => ({ ...r, status: 'launch-approved' }));
    const signed = SIGNOFFS.map((s) => ({ ...s, signed: `${s.approver} (accepted)` }));

    it('passes when every owned row is approved and, for H, every sign-off is held', () => {
      for (const gate of GATES) expect(verdict(gate, approved(), signed).passes, gate.id).toBe(true);
    });

    it('refuses on one unapproved row', () => {
      for (const gate of GATES) {
        const rows = approved();
        const target = rows.find((r) => rowsOf(gate).includes(r.id))!;
        target.status = 'tested';
        const v = verdict(gate, rows, signed);
        expect(v.passes, gate.id).toBe(false);
        expect(v.open).toEqual([target.id]);
      }
    });

    it('refuses when an owned row is missing from the register', () => {
      const gate = GATES.find((g) => g.id === 'D')!;
      expect(verdict(gate, approved().filter((r) => r.id !== 'INT-007'), signed).passes).toBe(false);
    });

    it('refuses H on one vacant sign-off, and only H', () => {
      const vacant = signed.map((s, i) => (i === 3 ? { ...s, signed: null } : s));
      for (const gate of GATES) expect(verdict(gate, approved(), vacant).passes, gate.id).toBe(gate.id !== 'H');
    });

    it('lists open rows P0 first', () => {
      const open = verdict(GATES.find((g) => g.id === 'H')!).open;
      const sev = open.map((id) => REGISTER.find((r) => r.id === id)!.severity);
      expect([...sev].sort()).toEqual(sev);
    });
  });

  it('is what docs/MASTER-LAUNCH-READINESS-REGISTER.md says', () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function render(): string {
  const count = (rows: readonly Requirement[], s: string) => rows.filter((r) => r.status === s).length;
  const out: string[] = [
    '# Master Launch Readiness Register',
    '',
    '<!-- Rendered from app/src/lib/masterregister.ts by masterregister.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'Every requirement the Day-One Enterprise Launch Master Plan sets for Semester',
    'as a complete university platform — student platform, native LMS,',
    'interoperability, governed AI, campus modules, trust, reliability, support and',
    'commercial operations — with where the repository stands on each, and the',
    'eight gates that decide launch.',
    '',
    '**This is not evidence that a capability exists.** A row is complete only when',
    'it is implemented, tested, accessible, secure, observable, recoverable,',
    'documented, supportable, contractable, deployable and auditable, and its',
    'owners have signed. The statuses below were assessed against `origin/main` at',
    '`5bc0330` and re-assessed at `fd8fc0b`, both on 2026-09-28, and a test holds',
    'each to the kind of file it cites.',
    '',
    'The narrower go/no-go for a first pilot school is',
    '[`LAUNCH-READINESS-COUNCIL.md`](LAUNCH-READINESS-COUNCIL.md); every role\'s',
    'state is in [`ROLE-LAUNCH-REGISTER.md`](ROLE-LAUNCH-REGISTER.md).',
    '',
    '## Where it stands',
    '',
    '| Status | Meaning | Rows | P0 |',
    '| --- | --- | ---: | ---: |',
    ...STATUSES.map((s) => `| ${s} | ${STATUS_MEANING[s]} | ${count(REGISTER, s)} | ${REGISTER.filter((r) => r.status === s && r.severity === 'P0').length} |`),
    `| **total** | | **${REGISTER.length}** | **${REGISTER.filter((r) => r.severity === 'P0').length}** |`,
    '',
    '`tested` means code exists and an automated test exercises it — never that',
    'the row is ready. Every `tested` row still needs something the repository',
    'cannot supply by itself (a UAT, a drill, a certification, a contract, a named',
    'owner), and its gap says which. Nothing can be above `tested` without an',
    `artifact under \`docs/evidence/\` that is still current: ${REGISTER.filter((r) => NEEDS_EVIDENCE_DIR.includes(r.status)).map((r) => r.id).join(', ') || 'none is'}${REGISTER.some((r) => NEEDS_EVIDENCE_DIR.includes(r.status)) ? ', on the AI drills of 29 September' : ''}.`,
    '',
    '## The gates',
    '',
    'A gate passes only when every row it owns is launch approved; H owns every row',
    'and also needs every sign-off. **No gate passes.**',
    '',
    '| Gate | Title | Rows | ' + STATUSES.filter((s) => s !== 'launch-approved').map((s) => s).join(' | ') + ' | Passes |',
    '| --- | --- | ---: | ' + STATUSES.filter((s) => s !== 'launch-approved').map(() => '---:').join(' | ') + ' | --- |',
  ];
  for (const gate of GATES) {
    const v = verdict(gate);
    out.push(
      `| ${gate.id} | ${gate.title} | ${rowsOf(gate).length} | ${STATUSES.filter((s) => s !== 'launch-approved')
        .map((s) => v.byStatus[s] ?? 0)
        .join(' | ')} | ${v.passes ? 'yes' : 'no'} |`,
    );
  }
  out.push('');
  for (const gate of GATES) {
    out.push(`### Gate ${gate.id} — ${gate.title}`, '');
    for (const c of gate.checks) out.push(`- [ ] ${c}`);
    out.push('', gate.id === 'H' ? 'Owns every row below.' : `Owns ${gate.rows.map((id) => `\`${id}\``).join(', ')}.`, '');
  }

  out.push('## The register', '');
  for (const domain of Object.keys(DOMAINS) as Domain[]) {
    const rows = REGISTER.filter((r) => domainOf(r.id) === domain);
    out.push(`### ${DOMAINS[domain]}`, '');
    out.push('| ID | Capability | Launch requirement | Validation | Sev | Status | Evidence | Gap |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const r of rows) {
      const ev = r.evidence.length ? r.evidence.map((e) => `\`${e.path}\` — ${cell(e.shows)}`).join('<br>') : '—';
      out.push(`| ${r.id} | ${cell(r.capability)} | ${cell(r.requirement)} | ${cell(r.validation)} | ${r.severity} | ${r.status} | ${ev} | ${cell(r.gap)} |`);
    }
    out.push('');
  }

  out.push('## Launch stop conditions', '', 'Launch stops if any of these is true.', '');
  for (const s of STOP_CONDITIONS) out.push(`- ${s}`);
  out.push('', '## Executive sign-off', '', '| Function | Sign-off condition | Approver | Signed |', '| --- | --- | --- | --- |');
  for (const s of SIGNOFFS) out.push(`| ${s.fn} | ${cell(s.condition)} | ${s.approver} | ${s.signed ?? 'vacant'} |`);

  out.push(
    '',
    '## The master artifacts',
    '',
    'The brief asked for seventeen further documents and a role register. Where the',
    'repository already answers one, this points there rather than copying it; two',
    'are not written, for the reason given.',
    '',
    '| Artifact | State | Where it is answered | Note |',
    '| --- | --- | --- | --- |',
  );
  for (const a of ARTIFACTS) out.push(`| \`${a.name}\` | ${a.state} | ${a.covered.length ? a.covered.map((p) => `\`${p}\``).join('<br>') : '—'} | ${cell(a.note)} |`);

  out.push(
    '',
    '## What it takes',
    '',
    'The plan models 48–52 weeks with parallel teams: at least two product',
    'designers, three frontend, four backend, two integration, two SRE and two QA',
    'engineers, plus security, accessibility, learning-science, AI, implementation,',
    'support, counsel and GTM leads. The register does not pretend otherwise. Most',
    'of the rows still open are not code: they are people, drills, contracts,',
    'certifications and a term of real teaching, and no commit can close them.',
    '',
  );
  return out.join('\n');
}
