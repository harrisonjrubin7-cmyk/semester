import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDIENCES, AUDIENCE_LABEL, type Audience } from '../governance/incident-comms';
import { SEATS } from '../launchreadiness';
import { CADENCE, CROSSWALK, EXERCISES, PLAYBOOKS, SEVERITIES, playbook } from './incidentplaybooks';
import { cell, controlLine, renderedFrom, table } from './render';
import { control } from './trustcontrols';

/**
 * The playbooks and the exercise calendar, held to what they lean on.
 *
 * A playbook is only as good as the controls it reaches for and the people it
 * puts in the room, so the checks are about those: every control it names is
 * in the register, every message audience is one the composer can produce, a
 * playbook whose message goes to a security or privacy audience says that
 * counsel is needed, and every playbook is rehearsed by at least one exercise
 * with its own commander present. The calendar carries no date, because the
 * start is the founder's decision; it carries weeks after that decision.
 *
 * `INCIDENT-PLAYBOOKS.md` and `TABLETOP-CALENDAR.md` are rendered; `npm run
 * registers` from app/ rewrites them.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const PLAYBOOK_DOC = 'docs/integrated-trust/INCIDENT-PLAYBOOKS.md';
const CALENDAR_DOC = 'docs/integrated-trust/TABLETOP-CALENDAR.md';

describe('severity', () => {
  it('lays the other scales against the four the code uses, once each, in order', () => {
    expect(CROSSWALK.map((r) => r.severity)).toEqual([...SEVERITIES]);
    expect(CROSSWALK.map((r) => r.pScale)).toEqual(['P0', 'P1', 'P2', 'P3']);
    expect(CROSSWALK.map((r) => r.securityPolicy)).toEqual(['Critical', 'High', 'Medium', 'Low']);
  });

  it('keeps the rule incident-recovery.ts enforces: a suspected cross-tenant scope is SEV1', () => {
    expect(playbook('IR-01')?.defaultSeverity).toBe('SEV1');
  });
});

describe('the playbooks', () => {
  it('have unique ids in order', () => {
    expect(PLAYBOOKS.map((p) => p.id)).toEqual(PLAYBOOKS.map((_, i) => `IR-${String(i + 1).padStart(2, '0')}`));
  });

  it('say how to contain, investigate, recover and preserve evidence', () => {
    for (const p of PLAYBOOKS) {
      for (const k of ['contain', 'investigate', 'recover', 'evidence'] as const) expect(p[k].length, `${p.id} ${k}`).toBeGreaterThan(0);
      expect(p.today.length, `${p.id} today`).toBeGreaterThan(30);
    }
  });

  it('lean only on controls, seats, severities and message audiences that exist', () => {
    for (const p of PLAYBOOKS) {
      for (const c of p.controls) expect(control(c), `${p.id} ${c}`).toBeDefined();
      expect(SEATS, p.id).toContain(p.commander);
      for (const s of p.seats) expect(SEATS, `${p.id} ${s}`).toContain(s);
      expect(p.seats, `${p.id} commander is in the room`).toContain(p.commander);
      expect(SEVERITIES, p.id).toContain(p.defaultSeverity);
      expect(Object.keys(AUDIENCES), p.id).toContain(p.audience);
    }
  });

  it('say that counsel is needed whenever the message goes to a security or privacy audience', () => {
    for (const p of PLAYBOOKS) if (p.audience === 'security' || p.audience === 'privacy') expect(p.counsel, p.id).toBe(true);
  });

  it('never tell the reader to delete a known-abuse match or to repair a record before evidence is held', () => {
    const ir09 = playbook('IR-09')!;
    expect(ir09.contain.join(' ')).toMatch(/do not delete a known-abuse match/i);
    const ir03 = playbook('IR-03')!;
    expect(ir03.contain.join(' ')).toMatch(/before the evidence is held/i);
  });
});

describe('the exercise calendar', () => {
  it('has unique ids and strictly increasing weeks', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    for (let i = 1; i < EXERCISES.length; i++) expect(EXERCISES[i].week, EXERCISES[i].id).toBeGreaterThan(EXERCISES[i - 1].week);
  });

  it('rehearses every playbook at least once', () => {
    const rehearsed = new Set(EXERCISES.flatMap((e) => e.playbooks));
    expect(PLAYBOOKS.filter((p) => !rehearsed.has(p.id)).map((p) => p.id)).toEqual([]);
  });

  it('puts each playbook\'s commander in the room that rehearses it, and names only real playbooks and seats', () => {
    for (const e of EXERCISES) {
      for (const id of e.playbooks) {
        const p = playbook(id);
        expect(p, `${e.id} ${id}`).toBeDefined();
        expect(e.seats, `${e.id} needs ${p?.commander} for ${id}`).toContain(p!.commander);
      }
      for (const s of e.seats) expect(SEATS, `${e.id} ${s}`).toContain(s);
    }
  });

  it('files every exercise under docs/evidence/operations/ with the day it was held', () => {
    for (const e of EXERCISES) {
      expect(e.artifact, e.id).toMatch(/^docs\/evidence\/operations\/\{date\}-[a-z0-9-]+\.md$/);
      expect(e.passes.length, e.id).toBeGreaterThan(40);
      expect(e.tests.length, e.id).toBeGreaterThan(20);
    }
  });

  it('includes a restore, a switch drill and a staffed game day with someone told to be absent', () => {
    expect(EXERCISES.some((e) => e.form === 'restore')).toBe(true);
    expect(EXERCISES.some((e) => e.form === 'drill')).toBe(true);
    const day = EXERCISES.find((e) => e.form === 'game-day' && e.seats.length >= 5);
    expect(day?.tests).toMatch(/unavailable/);
  });

  it('renders the playbooks and the calendar from the data', () => {
    const a = renderPlaybooks();
    const b = renderCalendar();
    if (process.env.REGISTERS === 'write') {
      writeFileSync(at(PLAYBOOK_DOC), a);
      writeFileSync(at(CALENDAR_DOC), b);
    }
    expect(readFileSync(at(PLAYBOOK_DOC), 'utf8'), `${PLAYBOOK_DOC} is stale; run \`npm run registers\` from app/`).toBe(a);
    expect(readFileSync(at(CALENDAR_DOC), 'utf8'), `${CALENDAR_DOC} is stale; run \`npm run registers\` from app/`).toBe(b);
  });
});

// ── Rendering ──

function renderPlaybooks(): string {
  const lines: string[] = [];
  lines.push('# Incident playbooks', '');
  lines.push(renderedFrom('app/src/lib/ops/incidentplaybooks.ts', 'incidentplaybooks.test.ts'), '');
  lines.push(controlLine(PLAYBOOK_DOC), '');
  lines.push(
    `${PLAYBOOKS.length} scenario playbooks. The plan around them — roles, the first fifteen minutes, communications, evidence handling and what counsel decides — is in [incident response](INCIDENT-RESPONSE.md); the rehearsal schedule is the [tabletop calendar](TABLETOP-CALENDAR.md).`,
    '',
    '## Severity',
    '',
    'Four scales are in use across the trust, engineering and security documents. `app/src/lib/incident-recovery.ts` is the only one a test holds, so this keeps it (SEV1 to SEV4) and lays the others against it. ' +
      'Choosing the scale is the founder\'s decision (RM-06); until it is made the documents keep disagreeing. The times are internal first-look targets, not a promise to anyone: the trust documents record that no acknowledgement or update clock is authorized while one person holds every role.',
    '',
    ...table(
      ['Severity', 'Means', 'P scale', 'SECURITY.md word', 'Audit scale', 'First look (internal)'],
      CROSSWALK.map((r) => [r.severity, cell(r.means), r.pScale, r.securityPolicy, cell(r.audit), r.firstLookTarget]),
    ),
    '',
    '## Message audiences',
    '',
    'Rendered from `AUDIENCES` in `app/src/lib/governance/incident-comms.ts`. The composer refuses a message missing any of its required details. The intervals are what it enforces; they are not a promise to a customer.',
    '',
    ...table(
      ['Audience', 'Approvers', 'Update every (min)', 'Tells the institution', 'Required details'],
      (Object.keys(AUDIENCES) as Audience[]).map((a) => [
        AUDIENCE_LABEL[a],
        AUDIENCES[a].approvers.join(', '),
        String(AUDIENCES[a].updateEveryMinutes),
        AUDIENCES[a].notifyInstitution ? 'yes' : 'no',
        cell(AUDIENCES[a].requires.map((r) => r.heading + ('oneOf' in r && r.oneOf ? ` (${r.oneOf.join(' / ')})` : '')).join('; ') || '—'),
      ]),
      ['left', 'left', 'right'],
    ),
    '',
    '## Index',
    '',
    ...table(
      ['Playbook', 'Default', 'Commander', 'Message', 'Counsel', 'Lever'],
      PLAYBOOKS.map((p) => [`[${p.id}](#${p.id.toLowerCase()})`, p.defaultSeverity, p.commander, p.audience, p.counsel ? 'yes' : 'no', cell(p.lever ?? '—')]),
    ),
    '',
  );

  for (const p of PLAYBOOKS) {
    lines.push(`## ${p.id}`, '', `### ${p.title}`, '');
    lines.push(`**Trigger.** ${p.trigger}`, '');
    lines.push(`**Default severity.** ${p.defaultSeverity}. **Commander.** ${p.commander}. **In the room.** ${p.seats.join(', ')}. **Message template.** \`${p.audience}\`.${p.counsel ? ' **Counsel needed** (requires qualified human counsel review).' : ''}`, '');
    for (const [title, steps] of [['Contain', p.contain], ['Investigate', p.investigate], ['Recover', p.recover], ['Preserve first', p.evidence]] as const) {
      lines.push(`**${title}.**`, '', ...steps.map((s) => `- ${s}`), '');
    }
    lines.push(`**Controls relied on.** ${p.controls.map((c) => `[${c}](CONTROL-FRAMEWORK.md)`).join(', ')}.`, '');
    lines.push(`**Where this stands today.** ${p.today}`, '');
  }
  return lines.join('\n') + '\n';
}

function renderCalendar(): string {
  const lines: string[] = [];
  lines.push('# Tabletop and drill calendar', '');
  lines.push(renderedFrom('app/src/lib/ops/incidentplaybooks.ts', 'incidentplaybooks.test.ts'), '');
  lines.push(controlLine(CALENDAR_DOC), '');
  lines.push(
    'The schedule on which the incident playbooks are rehearsed. It carries weeks after the day the founder starts the programme, not dates: the start is a decision, and no date is invented here. ' +
      'An exercise counts as held when its file exists under `docs/evidence/operations/` stating the day it was held, and not before; the master register reads the same rule. ' +
      'The one rehearsal so far, [the founder readiness walkthrough of 3 October](../evidence/operations/2026-10-03-founder-readiness-tabletop.md), was a read of documents and the repository, and says it does not close the exercise gates.',
    '',
    ...table(
      ['ID', 'Week', 'Form', 'Playbooks', 'In the room', 'Passes when', 'Finds out', 'Files'],
      EXERCISES.map((e) => [e.id, String(e.week), e.form, e.playbooks.join(', '), e.seats.join(', '), cell(e.passes), cell(e.tests), `\`${e.artifact}\``]),
      ['left', 'right'],
    ),
    '',
    '## After the first year',
    '',
    ...Object.entries(CADENCE).map(([k, v]) => `- **${k}.** ${v}`),
    '',
    '## Coverage',
    '',
    ...table(
      ['Playbook', 'Scenario', 'Rehearsed by'],
      PLAYBOOKS.map((p) => [p.id, cell(p.title), EXERCISES.filter((e) => e.playbooks.includes(p.id)).map((e) => e.id).join(', ')]),
    ),
    '',
    `Every exercise puts the commander of each playbook it rehearses in the room, and the test fails if one does not. The seats that have no holder today (security, trust, data, finance and the pilot champion) cannot attend as themselves, which is the first thing the exercises will find.`,
    '',
  );
  return lines.join('\n') + '\n';
}
