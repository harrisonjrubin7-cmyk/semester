import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEATS } from '../launchreadiness';
import { cell, controlLine, link, renderedFrom, table } from '../ops/render';
import { CONTROLS, MATURITY_AREAS, STANCES, bare, coverage, type Control, type MaturityArea } from './maturity';

/**
 * The maturity register is only worth having if a control cannot claim more
 * than the tree shows:
 *
 *   - every `in-place` and `partial` control cites a path that exists, and an
 *     `owed` one cites nothing;
 *   - every area has a stance, an owner who is a council seat, and at least
 *     one control;
 *   - the counts are stated here, so a change in either direction is a line in
 *     a diff.
 *
 * `docs/operating-model/OPERATIONAL-MATURITY.md` is rendered from the data;
 * run `npm run registers` from app/ to rewrite it. The last test fails while
 * it is stale.
 */

const root = join(import.meta.dirname, '../../../..');
const exists = (p: string) => existsSync(join(root, p));
const DOC = 'docs/operating-model/OPERATIONAL-MATURITY.md';
const AREAS = Object.keys(MATURITY_AREAS) as MaturityArea[];

describe('the operational-maturity register', () => {
  it('can tell a missing file from a present one', () => {
    expect(exists('README.md')).toBe(true);
    expect(exists('app/src/lib/governance/no-such-control.md')).toBe(false);
  });

  it('names each control once, in a known area, with a note', () => {
    const ids = CONTROLS.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of CONTROLS) {
      expect(AREAS, x.id).toContain(x.area);
      expect(x.control.trim().length, x.id).toBeGreaterThan(8);
      expect(x.note.trim().length, `${x.id} has no note`).toBeGreaterThan(12);
    }
    for (const a of AREAS) expect(CONTROLS.some((x) => x.area === a), a).toBe(true);
  });

  it('cites evidence that exists, and nothing for what is owed', () => {
    for (const x of CONTROLS) {
      if (x.status === 'owed') {
        expect(x.evidence, `${x.id} is owed and cites ${x.evidence}`).toBeNull();
      } else {
        expect(x.evidence, `${x.id} is ${x.status} and cites nothing`).not.toBeNull();
        expect(exists(x.evidence!), `${x.id} cites ${x.evidence}, which is missing`).toBe(true);
      }
    }
  });

  it('gives every area a stance the company is held to, owned by a council seat', () => {
    for (const a of AREAS) {
      const s = STANCES[a];
      expect(s.stance.length, a).toBeGreaterThan(40);
      expect(SEATS, a).toContain(s.owner);
      expect(['internal', 'staff', 'public']).toContain(s.exposure);
    }
    // The two the brief says never reach general staff or students.
    expect(STANCES.records.exposure).toBe('internal');
    expect(STANCES.ediscovery.exposure).toBe('internal');
  });

  it('states the finding: how many controls are in place, partial and owed', () => {
    const c = coverage();
    expect(c.inPlace + c.partial + c.owed).toBe(CONTROLS.length);
    // Said directly, so a change in either direction has to be explained here.
    // Legal holds (20260930100000_legal_holds.sql) moved RM-02, RM-04, RM-05 and
    // RM-08 from owed to partial: 76/81 became 80/77. None is in place, because
    // no screen or runbook places a hold and erase_account's resume is unproved.
    expect(c).toEqual({ inPlace: 43, partial: 80, owed: 77 });
    expect(CONTROLS).toHaveLength(200);
    const one: Control = { id: 'x', area: 'docs', control: 'a control', status: 'owed', evidence: null, note: 'a note long enough' };
    expect(coverage([one])).toEqual({ inPlace: 0, partial: 0, owed: 1 });
  });

  it('names the areas where nothing is in place', () => {
    expect(bare()).toEqual(['records', 'ediscovery', 'generated', 'devices', 'finops', 'residency', 'disaster']);
    expect(bare([{ id: 'x', area: 'docs', control: 'a control', status: 'in-place', evidence: 'README.md', note: 'a note long enough' }])).not.toContain('docs');
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

const STATUS_WORD = { 'in-place': 'in place', partial: 'partial', owed: 'owed' } as const;

function render(): string {
  const c = coverage();
  const out: string[] = [
    '# Operational maturity',
    '',
    renderedFrom('app/src/lib/governance/maturity.ts', 'maturity.test.ts'),
    '',
    controlLine(DOC),
    '',
    'The last twenty areas of running a platform for universities that a feature',
    'list never mentions, each broken into the controls a reviewer would ask for',
    'and each control marked with what the tree holds. A control that claims to',
    'exist cites a file, and the file exists; an owed control says what would',
    'close it. Nothing here is a promise of a date.',
    '',
    `**${c.inPlace} of ${CONTROLS.length} controls are in place, ${c.partial} are partial and ${c.owed} are owed.**`,
    `Nothing at all is in place in ${bare().length} areas: ${bare().map((a) => MATURITY_AREAS[a]).join('; ')}.`,
    'Most owed controls wait on something that does not exist yet — a company,',
    'a second person, billing, an assessment engine, a customer — and the note',
    'says which.',
    '',
    '## How to read an area',
    '',
    'Each opens with the **stance**: the one sentence the company is held to,',
    'whatever the checklist says. **Exposure** says who may see the area’s',
    'working material — `internal` never reaches general staff or students.',
    '**Owner** is a seat of the [launch readiness council](../LAUNCH-READINESS-COUNCIL.md),',
    'never a person; every seat is vacant.',
    '',
    '## The areas',
    '',
    ...table(
      ['Area', 'In place', 'Partial', 'Owed', 'Exposure', 'Owner'],
      AREAS.map((a) => {
        const rows = CONTROLS.filter((x) => x.area === a);
        const n = (s: Control['status']) => String(rows.filter((x) => x.status === s).length);
        return [`[${MATURITY_AREAS[a]}](#${slug(MATURITY_AREAS[a])})`, n('in-place'), n('partial'), n('owed'), `\`${STANCES[a].exposure}\``, `\`${STANCES[a].owner}\``];
      }),
      ['left', 'right', 'right', 'right'],
    ),
    '',
  ];
  for (const a of AREAS) {
    const rows = CONTROLS.filter((x) => x.area === a);
    const s = STANCES[a];
    out.push(`## ${MATURITY_AREAS[a]}`, '', `> ${s.stance}`, '', `Exposure \`${s.exposure}\` · owner \`${s.owner}\` · ${rows.filter((x) => x.status === 'in-place').length} of ${rows.length} in place.`, '');
    out.push(
      ...table(
        ['ID', 'Control', 'Status', 'Evidence', 'What it shows, or what would close it'],
        rows.map((x) => [x.id, cell(x.control), STATUS_WORD[x.status], x.evidence ? `[\`${x.evidence}\`](${link(DOC, x.evidence)})` : '—', cell(x.note)]),
      ),
      '',
    );
  }
  return out.join('\n');
}

/** GitHub’s heading anchor: lower case, spaces to hyphens, punctuation dropped. */
function slug(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-');
}
