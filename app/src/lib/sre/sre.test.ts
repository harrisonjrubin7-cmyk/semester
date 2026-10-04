import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { JOURNEYS } from '../governance/error-budgets';
import { KILL_SWITCHES } from '../flags';
import { ALERTS } from './alerts';
import { CLASS_TARGETS, COMPONENTS, CRITICALITY_ORDER, ROLES, ROLE_HOLDERS, byId, closure, inversions, type Component } from './catalog';
import { EXPERIMENTS } from './chaos';
import { COHORTS, LIMITS, SCENARIOS, TARGET_UTILISATION, demand } from './capacity';
import { COST_DRIVERS } from './cost';
import { RUNBOOKS, RUNBOOK_DIR, RUNBOOK_SECTIONS, runbook } from './runbooks';
import { DIMENSIONS, MEASURED_JOURNEYS, alertLadder, gaps, scorecard, singlePointsOfFailure, summarise, type Row } from './scorecard';

const ROOT = resolve(__dirname, '../../../..');
const at = (p: string) => join(ROOT, p);
const read = (p: string) => readFileSync(at(p), 'utf8');

/*
 * Held to the repository, not to memory of it. A register that lists what
 * somebody remembers is a register of what somebody remembers.
 */
describe('the catalog is the repository', () => {
  it('has one row per edge-function directory, and no row for one that is gone', () => {
    const dirs = readdirSync(at('supabase/functions'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== '_shared').map((d) => d.name).sort();
    const rows = COMPONENTS.filter((c) => c.id.startsWith('fn:')).map((c) => c.id.slice(3)).sort();
    expect(rows).toEqual(dirs);
  });

  it('has one row per cron.schedule job in supabase/scheduler.sql', () => {
    const sql = read('supabase/scheduler.sql');
    const jobs = [...sql.matchAll(/cron\.schedule\(\s*'([^']+)'/g)].map((m) => m[1]).sort();
    expect(jobs.length).toBeGreaterThan(15);
    const rows = COMPONENTS.filter((c) => c.id.startsWith('job:')).map((c) => c.id.slice(4)).sort();
    expect(rows).toEqual(jobs);
  });

  it('has one row per workflow, plus the schema deploy that has no workflow', () => {
    const wf = readdirSync(at('.github/workflows')).filter((f) => f.endsWith('.yml')).map((f) => f.replace(/\.yml$/, '')).sort();
    const rows = COMPONENTS.filter((c) => c.id.startsWith('pipeline:') && c.id !== 'pipeline:schema-deploy').map((c) => c.id.slice(9)).sort();
    expect(rows).toEqual(wf);
  });

  it('points every row at a path that exists', () => {
    for (const c of COMPONENTS) expect(existsSync(at(c.path)), `${c.id} → ${c.path}`).toBe(true);
  });

  it('has unique ids', () => {
    const ids = COMPONENTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the catalog is internally consistent', () => {
  it('every dependency exists, and no chain loops', () => {
    for (const c of COMPONENTS) {
      for (const d of c.dependsOn) expect(byId(d), `${c.id} depends on ${d}`).toBeDefined();
      expect(() => closure(c.id), c.id).not.toThrow();
    }
  });

  it('nothing is less critical than something that depends on it', () => {
    expect(inversions()).toEqual([]);
  });

  it('the inversion check can fail: a C1 that leans on a C3 is caught', () => {
    const fake: Component[] = [
      { ...COMPONENTS[0], id: 'a', criticality: 'C1', dependsOn: ['b'] },
      { ...COMPONENTS[0], id: 'b', criticality: 'C3', dependsOn: [] },
    ];
    expect(inversions(fake)).toEqual([{ component: 'a', dependency: 'b' }]);
  });

  it('the cycle check can fail: a loop throws', () => {
    // closure() reads the real catalog, so build the loop through two real ids.
    const a = byId('web-app')!;
    const original = a.dependsOn;
    (a as { dependsOn: readonly string[] }).dependsOn = [...original, 'status-page'];
    const sp = byId('status-page')!;
    const spOriginal = sp.dependsOn;
    (sp as { dependsOn: readonly string[] }).dependsOn = ['web-app'];
    try {
      expect(() => closure('web-app')).toThrow(/cycle/i);
    } finally {
      (a as { dependsOn: readonly string[] }).dependsOn = original;
      (sp as { dependsOn: readonly string[] }).dependsOn = spOriginal;
    }
  });

  it('every journey id used is a real journey, and every journey has a component that can break it', () => {
    const ids = new Set(JOURNEYS.map((j) => j.id));
    for (const c of COMPONENTS) for (const j of c.journeys) expect(ids.has(j), `${c.id} → ${j}`).toBe(true);
    for (const j of JOURNEYS) expect(COMPONENTS.some((c) => c.journeys.includes(j.id)), j.id).toBe(true);
  });

  it('every journey is carried by at least one C0 or C1 component — a student outcome cannot hang only on a deferrable thing', () => {
    for (const j of JOURNEYS) {
      expect(COMPONENTS.some((c) => c.journeys.includes(j.id) && (c.criticality === 'C0' || c.criticality === 'C1')), j.id).toBe(true);
    }
  });

  it('every kill switch named is a real one, or a documented deploy flag', () => {
    const real = new Set<string>(KILL_SWITCHES.map((k) => (typeof k === 'string' ? k : (k as { key: string }).key)));
    const deployFlags = new Set(['VITE_READ_ONLY', 'SEMESTER_READ_ONLY']);
    for (const c of COMPONENTS) if (c.killSwitch) expect(real.has(c.killSwitch) || deployFlags.has(c.killSwitch), `${c.id} → ${c.killSwitch}`).toBe(true);
  });

  it('every role used has a holder, and every holder is a known role', () => {
    for (const c of COMPONENTS) expect(ROLES.includes(c.role), c.id).toBe(true);
    expect(ROLE_HOLDERS.map((h) => h.role).sort()).toEqual([...ROLES].sort());
  });

  it('class targets tighten as criticality rises', () => {
    const t = CRITICALITY_ORDER.map((c) => CLASS_TARGETS[c]);
    for (let i = 1; i < t.length; i++) {
      expect(t[i].rtoMinutes).toBeGreaterThan(t[i - 1].rtoMinutes);
      expect(t[i].rpoMinutes).toBeGreaterThan(t[i - 1].rpoMinutes);
    }
  });

  it('no recovery time is claimed as measured until a drill measured it', () => {
    for (const c of CRITICALITY_ORDER) expect(CLASS_TARGETS[c].measured).toEqual({ rtoMinutes: null, rpoMinutes: null });
    // …and the only provider-backed restore experiment is still planned.
    expect(EXPERIMENTS.find((e) => e.id === 'CX-03')?.status).toBe('planned');
  });
});

describe('runbooks are real, complete and referenced', () => {
  it('has a file for every index entry', () => {
    for (const r of RUNBOOKS) expect(existsSync(at(`${RUNBOOK_DIR}/${r.file}`)), r.id).toBe(true);
    expect(new Set(RUNBOOKS.map((r) => r.id)).size).toBe(RUNBOOKS.length);
  });

  it('has no runbook file the index does not list', () => {
    const files = readdirSync(at(RUNBOOK_DIR)).filter((f) => f.endsWith('.md') && f !== 'README.md' && f !== 'TEMPLATE.md').sort();
    expect(files).toEqual(RUNBOOKS.map((r) => r.file).sort());
  });

  it('has every section, in order, and a heading that carries its own id', () => {
    for (const r of RUNBOOKS) {
      const text = read(`${RUNBOOK_DIR}/${r.file}`);
      expect(text.split('\n')[0], r.id).toBe(`# ${r.id} · ${r.title}`);
      let last = -1;
      for (const s of RUNBOOK_SECTIONS) {
        const i = text.indexOf(`\n## ${s}\n`);
        expect(i, `${r.id} ## ${s}`).toBeGreaterThan(last);
        last = i;
      }
    }
  });

  it('is reached from at least one alert or catalog row — no orphans', () => {
    for (const r of RUNBOOKS) {
      expect(ALERTS.some((a) => a.runbook === r.id) || COMPONENTS.some((c) => c.runbook === r.id), r.id).toBe(true);
    }
  });

  it('is only ever referred to by an id that exists', () => {
    for (const a of ALERTS) expect(runbook(a.runbook), a.id).toBeDefined();
    for (const c of COMPONENTS) expect(runbook(c.runbook), c.id).toBeDefined();
    for (const e of EXPERIMENTS) expect(runbook(e.runbook), e.id).toBeDefined();
  });

  it('every repository path a runbook names exists (a runbook that points at nothing fails at 3 a.m.)', () => {
    const roots = /(?:^|[\s`(])((?:app|supabase|docs|packages|\.github|ops)\/[A-Za-z0-9_./\[\]\-@]+)/g;
    for (const r of RUNBOOKS) {
      const text = read(`${RUNBOOK_DIR}/${r.file}`);
      for (const m of text.matchAll(roots)) {
        const p = m[1].replace(/[.,;:)]+$/, '').replace(/\/$/, '');
        if (p.includes('*') || p.includes('<')) continue;
        expect(existsSync(at(p)), `${r.id} names ${p}`).toBe(true);
      }
    }
  });
});

describe('alerts', () => {
  it('have unique ids, real components and real runbooks', () => {
    expect(new Set(ALERTS.map((a) => a.id)).size).toBe(ALERTS.length);
    for (const a of ALERTS) {
      expect(byId(a.component), `${a.id} → ${a.component}`).toBeDefined();
      expect(runbook(a.runbook), a.id).toBeDefined();
    }
  });

  it('give every journey a burn alert', () => {
    for (const j of JOURNEYS) expect(ALERTS.some((a) => a.id === `burn:${j.id}`), j.id).toBe(true);
  });

  it('cannot be promoted to delivery_tested without evidence that exists', () => {
    for (const a of ALERTS) {
      if (a.state === 'delivery_tested') expect(a.evidence && existsSync(at(a.evidence)), a.id).toBeTruthy();
      else expect(a.evidence, a.id).toBeNull();
    }
  });

  it('is honest today: nothing has ever reached a human, and no journey has a measured SLI', () => {
    expect(alertLadder().delivery_tested).toBe(0);
    expect(MEASURED_JOURNEYS).toEqual([]);
    for (const a of ALERTS.filter((x) => x.source === 'burn')) expect(a.state, a.id).toBe('defined');
  });
});

describe('experiments', () => {
  it('cite evidence that exists when executed, and none when planned', () => {
    for (const e of EXPERIMENTS) {
      if (e.status === 'executed') expect(e.evidence && existsSync(at(e.evidence)), e.id).toBeTruthy();
      else expect(e.evidence, e.id).toBeNull();
    }
  });

  it('target real components, and never run in production without approval baked into the environment name', () => {
    for (const e of EXPERIMENTS) {
      expect(byId(e.component), e.id).toBeDefined();
      expect(e.abort.length, e.id).toBeGreaterThan(10);
    }
    expect(EXPERIMENTS.filter((e) => e.environment === 'production_with_approval')).toEqual([]);
  });

  it('exercise every C0 component at least once', () => {
    for (const c of COMPONENTS.filter((x) => x.criticality === 'C0')) {
      expect(EXPERIMENTS.some((e) => e.component === c.id), c.id).toBe(true);
    }
  });

  it('have unique ids', () => {
    expect(new Set(EXPERIMENTS.map((e) => e.id)).size).toBe(EXPERIMENTS.length);
  });
});

describe('cost drivers', () => {
  it('every AI driver carries a guardrail that stops spend, not only an alert', () => {
    for (const d of COST_DRIVERS.filter((x) => x.role === 'ai')) expect(d.guardrail, d.id).toBeTruthy();
  });

  it('name real components, and no budget is invented', () => {
    for (const d of COST_DRIVERS) expect(byId(d.component), d.id).toBeDefined();
    expect(COST_DRIVERS.every((d) => d.budgetMonthly === null)).toBe(true);
  });
});

describe('the scorecard reports the baseline, and can move', () => {
  it('today every role is a single point of failure', () => {
    expect(singlePointsOfFailure().sort()).toEqual([...ROLES].sort());
  });

  it('counts a backup as a backup: give one role a second person and its components turn green', () => {
    const rows = scorecard(COMPONENTS.filter((c) => c.role === 'ai'));
    expect(rows.every((r) => r.cells.backup === false)).toBe(true);
    const holder = ROLE_HOLDERS.find((h) => h.role === 'ai')!;
    const before = holder.backup;
    (holder as { backup: string | null }).backup = 'A. Second';
    try {
      expect(scorecard(COMPONENTS.filter((c) => c.role === 'ai')).every((r) => r.cells.backup === true)).toBe(true);
    } finally {
      (holder as { backup: string | null }).backup = before;
    }
  });

  it('summarises satisfied against applicable, and n/a never counts against a component', () => {
    const s = summarise();
    for (const cls of s) for (const d of DIMENSIONS) {
      expect(cls.dimensions[d].satisfied).toBeLessThanOrEqual(cls.dimensions[d].applicable);
    }
    const c3 = s.find((x) => x.criticality === 'C3')!;
    expect(c3.dimensions.alert.applicable).toBe(0);
    expect(c3.dimensions.drilled.applicable).toBe(0);
  });

  it('lists gaps most critical first', () => {
    const g = gaps();
    expect(g.length).toBeGreaterThan(0);
    const rank = g.map((x) => CRITICALITY_ORDER.indexOf(x.criticality));
    expect([...rank].sort((a, b) => a - b)).toEqual(rank);
  });

  it('records the drills that happened: the AI kill switch and the logical restore', () => {
    const drilled = new Set(scorecard().filter((r) => r.cells.drilled === true).map((r) => r.component));
    expect(drilled.has('fn:claude')).toBe(false); // C2: drill not applicable on the scorecard, though it ran
    expect(drilled.has('supabase-db')).toBe(true);
  });
});

/*
 * Prose that must not outrun the evidence. The existing drafts each end with
 * "Prohibited claims". Any line in docs/sre that uses one of these words has to
 * say, on the same line, that it is a thing we do NOT have.
 */
describe('docs/sre does not claim what it cannot show', () => {
  const dir = at('docs/sre');
  const md = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? md(join(d, e.name)) : e.name.endsWith('.md') ? [join(d, e.name)] : []));
  const files = existsSync(dir) ? md(dir) : [];
  const risky = /\b(24\s*\/\s*7|guarantee[sd]?|SLA|uptime|five nines|zero data loss|fully redundant)\b/i;
  const negated = /\b(no|not|never|without|cannot|can't|isn't|aren't|nothing|none|neither|prohibited|do not|does not|must not|until|unless|before|if|target|proposed|must|only when|claim)\b/i;

  it('has docs to check', () => expect(files.length).toBeGreaterThan(8));

  it('puts every risky word on a line that also says it is absent, proposed or conditional', () => {
    const bad: string[] = [];
    for (const f of files) {
      read(f.slice(ROOT.length + 1)).split('\n').forEach((line, i) => {
        if (risky.test(line) && !negated.test(line)) bad.push(`${f.slice(ROOT.length + 1)}:${i + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('every relative link between docs resolves', () => {
    const bad: string[] = [];
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\]\((?!https?:|#|mailto:)([^)#\s]+)(?:#[^)]*)?\)/g)) {
        if (!existsSync(resolve(dirname(f), m[1]))) bad.push(`${f.slice(ROOT.length + 1)} → ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

/*
 * Generated pages: the human copy of the registers. `npm run registers`
 * rewrites them; an ordinary run only compares, so editing a register without
 * regenerating its page fails here and not in review.
 */
const WRITE = process.env.REGISTERS === 'write';
function rendered(path: string, body: string) {
  const full = at(path);
  const text = `<!-- Generated from app/src/lib/sre by sre.test.ts. Edit the register, then run \`npm run registers\`. -->\n\n${body.trim()}\n`;
  if (WRITE) {
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  expect(existsSync(full), `${path} is missing: run npm run registers`).toBe(true);
  expect(readFileSync(full, 'utf8'), `${path} is stale: run npm run registers`).toBe(text);
}

const cell = (v: boolean | 'n/a') => (v === 'n/a' ? '—' : v ? 'yes' : '**no**');

describe('generated pages match the registers', () => {
  it('service catalog', () => {
    const rows = COMPONENTS.map((c) =>
      `| \`${c.id}\` | ${c.name} | ${c.kind} | ${c.criticality} | ${c.role} | ${c.journeys.join(', ') || '—'} | ${c.dependsOn.map((d) => `\`${d}\``).join(', ') || '—'} | ${c.killSwitch ? `\`${c.killSwitch}\`` : '—'} | ${c.runbook} |`);
    const holders = ROLE_HOLDERS.map((h) => `| ${h.role} | ${h.primary} | ${h.backup ?? '**none**'} |`);
    const targets = CRITICALITY_ORDER.map((k) => {
      const t = CLASS_TARGETS[k];
      return `| ${k} | ${t.rtoMinutes} min | ${t.rpoMinutes} min | every ${t.drillEveryDays} d | ${t.measured.rtoMinutes ?? 'unmeasured'} / ${t.measured.rpoMinutes ?? 'unmeasured'} |`;
    });
    rendered('docs/sre/generated/SERVICE-CATALOG.md', [
      '# Service catalog (generated)', '',
      `${COMPONENTS.length} components. Criticality classes: C0 data loss or exposure, or the emergency path; C1 a core daily journey or the only monitor; C2 can wait hours; C3 deferrable.`, '',
      '| Id | Name | Kind | Class | Role | Journeys | Depends on | Kill switch | Runbook |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |', ...rows, '',
      '## Role holders', '', '| Role | Primary | Backup |', '| --- | --- | --- |', ...holders, '',
      '## Proposed recovery targets by class', '', 'Targets, not readings. The last column is what a drill has measured.', '',
      '| Class | RTO target | RPO target | Drill | Measured RTO / RPO |', '| --- | --- | --- | --- | --- |', ...targets,
    ].join('\n'));
  });

  it('alert register', () => {
    const rows = ALERTS.map((a) => `| \`${a.id}\` | ${a.severity} | ${a.source} | \`${a.component}\` | ${a.runbook} | ${a.state} | ${a.condition} |`);
    const l = alertLadder();
    rendered('docs/sre/generated/ALERTS.md', [
      '# Alert register (generated)', '',
      `${ALERTS.length} alerts. defined ${l.defined} · manual ${l.manual} · wired ${l.wired} · delivery-tested ${l.delivery_tested}.`, '',
      'States: **defined** the condition is written and nothing evaluates it; **manual** a person evaluates it on a schedule; **wired** a machine evaluates it; **delivery-tested** a safe trigger reached a named human who acknowledged it.', '',
      '| Id | Route | Source | Component | Runbook | State | Condition |', '| --- | --- | --- | --- | --- | --- | --- |', ...rows,
    ].join('\n'));
  });

  it('experiments', () => {
    const rows = EXPERIMENTS.map((e) => `| ${e.id} | \`${e.component}\` | ${e.environment} | ${e.status}${e.evidence ? ` ([evidence](../../../${e.evidence}))` : ''} | ${e.hypothesis} | ${e.abort} |`);
    rendered('docs/sre/generated/EXPERIMENTS.md', [
      '# Failure experiments (generated)', '',
      `${EXPERIMENTS.length} experiments, ${EXPERIMENTS.filter((e) => e.status === 'executed').length} executed. A planned experiment is a hypothesis, not evidence.`, '',
      '| Id | Component | Where | Status | Hypothesis | Abort when |', '| --- | --- | --- | --- | --- | --- |', ...rows,
    ].join('\n'));
  });

  it('capacity demand', () => {
    const blocks = COHORTS.map((c) => {
      const rows = SCENARIOS.map((s) => {
        const d = demand(s, c);
        return `| ${s.label} | ${d.concurrentAccounts.toLocaleString('en-US')} | ${d.rps} | ${d.inFlight} | ${d.dbConnections} | ${d.aiCallsPerMinute} | ${d.notifications.toLocaleString('en-US')} in ${s.notificationWindowSeconds} s (${d.notificationsPerSecond}/s) |`;
      });
      return [`## ${c.label} (${c.accounts.toLocaleString('en-US')} accounts)`, '', '| Scenario | Concurrent accounts | Requests/s | In flight | DB connections | AI calls/min | Notifications |', '| --- | ---: | ---: | ---: | ---: | ---: | --- |', ...rows].join('\n');
    });
    const limits = LIMITS.map((l) => `| ${l.resource} | ${l.value ?? '**unverified**'} | ${l.where} |`);
    rendered('docs/sre/generated/CAPACITY.md', [
      '# Capacity demand by scenario (generated)', '',
      'Every figure derives from the **assumptions** in `app/src/lib/sre/capacity.ts` using Little\'s law. None is a measurement. The ceilings below are unverified, so this page cannot say any scenario fits.', '',
      ...blocks.flatMap((b) => [b, '']),
      `## Ceilings (target utilisation ${TARGET_UTILISATION * 100}%)`, '', '| Resource | Verified ceiling | Where to read it |', '| --- | --- | --- |', ...limits,
    ].join('\n'));
  });

  it('scorecard baseline', () => {
    const sum = summarise();
    const head = `| Class | Components | ${DIMENSIONS.join(' | ')} |`;
    const sep = `| --- | ---: | ${DIMENSIONS.map(() => '---:').join(' | ')} |`;
    const lines = sum.map((c) => `| ${c.criticality} | ${c.components} | ${DIMENSIONS.map((d) => (c.dimensions[d].applicable ? `${c.dimensions[d].satisfied}/${c.dimensions[d].applicable}` : '—')).join(' | ')} |`);
    const g = gaps();
    const perDim = DIMENSIONS.map((d) => `${d} ${g.filter((x) => x.dimension === d).length}`).join(' · ');
    const detail = (rows: Row[]) => rows.filter((r) => r.criticality === 'C0' || r.criticality === 'C1')
      .map((r) => `| \`${r.component}\` | ${r.criticality} | ${DIMENSIONS.map((d) => cell(r.cells[d])).join(' | ')} |`);
    rendered('docs/sre/generated/SCORECARD.md', [
      '# Reliability scorecard (generated)', '',
      'Satisfied of applicable. This is the baseline; the only direction a cell may move is from **no** to yes, and only by doing the thing.', '',
      head, sep, ...lines, '',
      `Open cells: ${g.length} (${perDim}).`, '',
      `Single points of failure: ${singlePointsOfFailure().join(', ')}.`, '',
      '## C0 and C1 detail', '',
      `| Component | Class | ${DIMENSIONS.join(' | ')} |`, `| --- | --- | ${DIMENSIONS.map(() => '---').join(' | ')} |`, ...detail(scorecard()),
    ].join('\n'));
  });
});
