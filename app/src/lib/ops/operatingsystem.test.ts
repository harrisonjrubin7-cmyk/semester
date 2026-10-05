import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNCIL, SEATS } from '../launchreadiness';
import { written } from './decisionlog';
import { ARCHIVED, BRIEF_CATEGORIES, SCOPE_QUESTIONS, SCOPE_RULE, SOURCES, type Source } from './operatingsystem';
import { OPERATING_SYSTEM, cell, controlLine, isIsoDate, link, renderedFrom, table } from './render';

/**
 * The single source of truth, held to the tree.
 *
 * A page that says "this is the authoritative version" is worth exactly as
 * much as the checking behind it, so:
 *
 *   - every path it names exists, and none is in an archive;
 *   - a category is `missing` exactly when it names no path, and then says
 *     what would close it;
 *   - every decision it cites is in the log, the ADRs, or DECISIONS.md;
 *   - a document may be listed as superseded only if it redirects to the one
 *     that replaced it (D-002), and is not authoritative for anything else;
 *   - every authoritative document displays the control line, so a reader
 *     of any of them can find its owner and review dates;
 *   - the scope questions are in the pull-request template, verbatim, where a
 *     change is reviewed.
 *
 * `SEMESTER-OPERATING-SYSTEM.md` is rendered from the data; `npm run
 * registers` from app/ rewrites it, and the last test fails while it is stale.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const DOC = OPERATING_SYSTEM;

const decisionsFile = read('DECISIONS.md');

/** Whether a `decisions` entry names something that is actually written down. */
function resolves(id: string): boolean {
  if (/^D-\d+$/.test(id)) return written(root, id);
  let m = /^ADR-(\d{4})$/.exec(id);
  if (m) return readdirSync(at('docs/architecture')).some((f) => f.startsWith(`${m![1]}-`) && f.endsWith('.md'));
  m = /^DECISIONS §(\d+)$/.exec(id);
  if (m) return new RegExp(`^## ${m[1]} ·`, 'm').test(decisionsFile);
  return false;
}

const brief = SOURCES.filter((s) => BRIEF_CATEGORIES.includes(s.category));
const extra = SOURCES.filter((s) => !BRIEF_CATEGORIES.includes(s.category));

describe('the operating system register', () => {
  describe('its shape', () => {
    it('answers every category the brief lists, once, in its order, before anything else', () => {
      expect(brief.map((s) => s.category)).toEqual([...BRIEF_CATEGORIES]);
      expect(SOURCES.slice(0, BRIEF_CATEGORIES.length)).toEqual(brief);
    });

    it('names each category and slug once', () => {
      expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
      expect(new Set(SOURCES.map((s) => s.category)).size).toBe(SOURCES.length);
    });

    it('gives every entry an owner that is a council seat', () => {
      for (const s of SOURCES) expect(SEATS, s.id).toContain(s.owner);
    });

    it('dates every review and schedules the next one after it', () => {
      for (const s of SOURCES) {
        expect(isIsoDate(s.lastReviewed), `${s.id} lastReviewed`).toBe(true);
        expect(isIsoDate(s.nextReview), `${s.id} nextReview`).toBe(true);
        expect(s.nextReview > s.lastReviewed, `${s.id} is next reviewed before it was last reviewed`).toBe(true);
        expect(Number.isInteger(s.version) && s.version >= 1, `${s.id} version`).toBe(true);
      }
    });
  });

  describe('what it points at', () => {
    it('can tell a missing file from a present one', () => {
      expect(existsSync(at('README.md'))).toBe(true);
      expect(existsSync(at('docs/NO-SUCH-DOCUMENT.md'))).toBe(false);
    });

    it('cites only files that exist', () => {
      for (const s of SOURCES) {
        for (const p of [s.path, ...(s.alsoRead ?? []), ...s.supersedes]) {
          if (p) expect(existsSync(at(p)), `${s.id} cites ${p}, which is missing`).toBe(true);
        }
      }
    });

    it('never makes an archive authoritative', () => {
      for (const s of SOURCES) {
        if (s.path) for (const dir of ARCHIVED) expect(s.path.startsWith(dir), `${s.id} → ${s.path}`).toBe(false);
      }
    });

    it('is missing exactly when it names nothing, and then says what would close it', () => {
      for (const s of SOURCES) {
        expect(s.status === 'missing', `${s.id}: status ${s.status} with path ${s.path}`).toBe(s.path === null);
        if (s.status === 'missing') expect((s.gap ?? '').length, `${s.id} is missing and names no gap`).toBeGreaterThan(40);
        else expect(s.gap, `${s.id} has a path and a gap`).toBeUndefined();
      }
    });

    it('cites decisions that are written down', () => {
      expect(resolves('D-001')).toBe(true);
      expect(resolves('ADR-0001')).toBe(true);
      expect(resolves('DECISIONS §1')).toBe(true);
      expect(resolves('D-999')).toBe(false);
      expect(resolves('ADR-9999')).toBe(false);
      expect(resolves('DECISIONS §9')).toBe(false);
      for (const s of SOURCES) for (const d of s.decisions) expect(resolves(d), `${s.id} cites ${d}`).toBe(true);
    });

    it('lists a document as superseded only when it redirects, and only once', () => {
      const authoritative = new Set(SOURCES.map((s) => s.path).filter(Boolean));
      for (const s of SOURCES) {
        for (const old of s.supersedes) {
          expect(authoritative.has(old), `${old} is superseded by ${s.id} and authoritative elsewhere`).toBe(false);
          expect(read(old).includes(s.path!), `${old} carries no redirect to ${s.path}`).toBe(true);
        }
      }
    });

    it('is displayed by every authoritative document', () => {
      expect(read('COMPETITION.md').includes(DOC)).toBe(false); // the control: an uncontrolled page reads uncontrolled
      for (const s of SOURCES) {
        if (s.path) expect(read(s.path).includes(DOC), `${s.path} does not display the control line`).toBe(true);
      }
    });
  });

  describe('the rule on scope', () => {
    it('asks its questions in the pull-request template, verbatim and in order', () => {
      const template = read('.github/pull_request_template.md');
      expect(template).toContain(SCOPE_RULE);
      let from = 0;
      for (const q of SCOPE_QUESTIONS) {
        const i = template.indexOf(q, from);
        expect(i, `template lacks "${q}" after position ${from}`).toBeGreaterThanOrEqual(0);
        from = i + q.length;
      }
    });

    it('is cross-referenced from portfolio governance, where intake happens', () => {
      expect(read('docs/operating-model/PORTFOLIO-GOVERNANCE.md')).toContain(DOC);
    });
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(at(DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ──────────────────────────────────────────────────────────────

const ref = (p: string) => `[\`${p}\`](${link(DOC, p)})`;

function row(s: Source): string[] {
  return [
    cell(s.category),
    s.path ? ref(s.path) : '**none**',
    s.status,
    `\`${s.owner}\``,
    String(s.version),
    s.lastReviewed,
    s.nextReview,
    s.supersedes.length ? s.supersedes.map(ref).join('<br>') : '—',
    s.decisions.length ? s.decisions.map((d) => `\`${d}\``).join(', ') : '—',
  ];
}

function render(): string {
  const held = COUNCIL.filter((c) => c.holder !== null);
  const count = (st: Source['status']) => SOURCES.filter((s) => s.status === st).length;
  const heads = ['Category', 'Authoritative version', 'Status', 'Owner', 'Version', 'Last reviewed', 'Next review', 'Supersedes', 'Related decisions'];
  const out: string[] = [
    '# Semester operating system',
    '',
    renderedFrom('app/src/lib/ops/operatingsystem.ts', 'operatingsystem.test.ts'),
    '',
    'The one internal control document. For each thing the company runs on it',
    'links **only the current authoritative version**, says who owns it, when it',
    'was last reviewed and when it is next due, and what decisions it rests on.',
    'Where no authoritative version exists it says so, rather than pointing at',
    'the nearest thing and letting the nearest thing become the promise.',
    '',
    'The repository holds several hundred pages. Most are audits of a moment or',
    'plans that were overtaken, and they stay where they are: this page does not',
    'delete or renumber anything (D-002). It says which page wins.',
    '',
    '## Who holds the seats',
    '',
    'Owner is a seat of the [launch readiness council](docs/LAUNCH-READINESS-COUNCIL.md),',
    'never a person, and a seat is held only once somebody accepted it in writing.',
    held.length === 0
      ? '**Every seat is vacant.** No document below has a person behind it yet; the owner column says which seat will.'
      : `**${held.length} of ${COUNCIL.length} seats are held:** ${held.map((c) => `\`${c.seat}\` (${c.holder})`).join(', ')}.`,
    '',
    '## Where it stands',
    '',
    ...table(
      ['Status', 'Meaning', 'Entries'],
      [
        ['current', 'Read on the review date, and stands', String(count('current'))],
        ['draft', 'The authoritative version, but not yet fit to act on', String(count('draft'))],
        ['missing', 'No authoritative version exists; the gap says what would close it', String(count('missing'))],
        ['**total**', '', `**${SOURCES.length}**`],
      ],
      ['left', 'left', 'right'],
    ),
    '',
    '`version` counts reviews of the entry — the decision that this path is the',
    'authoritative one and its content was read and stands — not the document’s',
    'own revisions; git holds those. Registers that change with every merge are',
    'reviewed monthly, the rest quarterly, and a next-review date that has passed',
    'is a finding.',
    '',
    '## The register',
    '',
    `The nineteen categories the closing brief names, in its order.`,
    '',
    ...table(heads, brief.map(row)),
    '',
    '### Anything else',
    '',
    'What the repository also runs on, and the brief’s list did not name.',
    '',
    ...table(heads, extra.map(row)),
    '',
    '## Notes and gaps',
    '',
  ];
  for (const s of SOURCES) {
    const also = s.alsoRead?.length ? ` Read next: ${s.alsoRead.map(ref).join(', ')}.` : '';
    if (s.status === 'missing') out.push(`- **${s.category}** — *missing.* ${s.gap}${also}`);
    else if (s.note || also) out.push(`- **${s.category}** —${s.note ? ` ${s.note}` : ''}${also}`);
  }
  out.push(
    '',
    '## What every controlled document displays',
    '',
    'Each authoritative document above carries this line near its top, with the',
    'link made relative to where it sits, and the test refuses one that does not:',
    '',
    '```markdown',
    controlLine('docs/ANY-DOCUMENT.md'),
    '```',
    '',
    'The values are not copied into the documents. A control block pasted into',
    'thirty pages is thirty chances to drift; the line points here instead, and',
    'here is held to the tree.',
    '',
    '## The rule on scope',
    '',
    `> ${SCOPE_RULE}`,
    '',
    'For every addition, before it is built, in the pull request that proposes it',
    '(the questions are in [`.github/pull_request_template.md`](.github/pull_request_template.md),',
    'and the portfolio council’s intake in',
    '[`docs/operating-model/PORTFOLIO-GOVERNANCE.md`](docs/operating-model/PORTFOLIO-GOVERNANCE.md) asks the same):',
    '',
    ...SCOPE_QUESTIONS.map((q, i) => `${i + 1}. ${q}`),
    '',
    'The largest risk is not a lack of ambition. It is trying to operationalize',
    'every good idea at once. The registers this page links are the discipline:',
    '[`ops/strategic-boundaries/`](ops/strategic-boundaries/README.md) says what',
    'is never built, [`ops/customer-commitments/`](ops/customer-commitments/README.md)',
    'what has been promised, [`docs/PROOF-CALENDAR.md`](docs/PROOF-CALENDAR.md)',
    'when the evidence is produced, [`docs/LAUNCH-WAR-ROOM.md`](docs/LAUNCH-WAR-ROOM.md)',
    'who reports what each day before launch, and',
    '[`docs/COMPANY-FIRST-YEAR-MEASURES.md`](docs/COMPANY-FIRST-YEAR-MEASURES.md) what success means.',
    '',
    '## How this page is held',
    '',
    '`app/src/lib/ops/operatingsystem.test.ts` fails when a cited file is missing',
    'or archived, when a category calls itself missing while naming a path (or',
    'the reverse), when a decision is not in the log, when a superseded document',
    'carries no redirect, when an authoritative document does not display the',
    'control line, when the scope questions are not in the pull-request template,',
    'or when this page is stale. `npm run registers` from `app/` rewrites it.',
    '',
  );
  return out.join('\n');
}
