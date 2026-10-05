/**
 * Three Operations Console checks, as pure functions: whether a customer
 * promise is being kept, what a release touches, and whether the people on
 * call are being asked for more than people can give.
 *
 * There is no Operations Console yet — the operating system lists its map as
 * missing — so these are the rules written before the screens, the way the
 * error budgets and the AI gates were. Each takes facts in and gives a verdict
 * out, reads nothing itself, and is held by `consolechecks.test.ts` to refuse from a
 * state that would otherwise pass, one rule at a time.
 *
 * ## The customer promise checker
 *
 * A contract says "24/7 P0/P1 support"; the console verifies that an on-call
 * roster exists, that the customer's escalation contacts are recorded, that
 * the support tier is active, and so on. A promise is *kept* only when every
 * check it names is true, and the unmet checks are the finding. The promises
 * here are the ones a first pilot would make; `PROMISES` grows with contracts,
 * never ahead of them.
 *
 * ## The release impact checker
 *
 * Before a release: which tenants, roles, integrations, documents, training
 * material, notifications and alerts a change touches, from the paths it
 * changed and the flags it moved. A change is *material* — and needs
 * approval — when it touches a migration, a policy, an integration, a
 * conformance claim or a flag that is on for a tenant. The rules are
 * deliberately coarse: this is the list of who to tell, not a proof of
 * safety.
 *
 * ## On-call workload
 *
 * A platform cannot support universities if the people running it are
 * overloaded or irreplaceable. The rules are the brief's: a ceiling on
 * consecutive days covered by one person, a backup for every shift, a floor on
 * recovery after an incident-heavy shift, and no single seat holding every
 * runbook. One person on call for a fortnight is a finding, not a schedule.
 */

// ── Customer promises ────────────────────────────────────────────────────────

export interface PromiseCheck {
  id: string;
  /** What the console must be able to see. */
  needs: string;
}

export interface CustomerPromise {
  id: string;
  /** The contract's words. */
  says: string;
  verifies: readonly PromiseCheck[];
}

export const PROMISES: readonly CustomerPromise[] = [
  {
    id: 'support-24-7',
    says: '24/7 P0/P1 support',
    verifies: [
      { id: 'roster', needs: 'An on-call roster exists with no gap in the contract period.' },
      { id: 'escalation-contacts', needs: 'The customer’s escalation contacts are recorded and confirmed.' },
      { id: 'tier-active', needs: 'The support-tier entitlement is active on the tenant.' },
      { id: 'status-subscription', needs: 'The customer is subscribed to status notices.' },
      { id: 'incident-template', needs: 'An incident notice template exists for the customer’s audiences.' },
      { id: 'critical-calendar', needs: 'The customer’s critical periods (registration, finals) are on the calendar.' },
    ],
  },
  {
    id: 'sis-read-only',
    says: 'Read-only SIS integration',
    verifies: [
      { id: 'no-write-scope', needs: 'The connector holds no write scope.' },
      { id: 'no-write-workflow', needs: 'No workflow that writes to the SIS is enabled for the tenant.' },
      { id: 'data-map-approved', needs: 'The field-level data map is approved by the customer.' },
      { id: 'fallback', needs: 'A fallback for a stale or absent source is configured.' },
      { id: 'freshness-alert', needs: 'A freshness alert is active for the connector.' },
    ],
  },
  {
    id: 'export-on-request',
    says: 'A complete export of the institution’s data within ten business days of a written request',
    verifies: [
      { id: 'export-format', needs: 'The export format is documented and produces every table the tenant holds.' },
      { id: 'requester-verification', needs: 'A verified-requester process exists.' },
      { id: 'export-rehearsed', needs: 'An export has been rehearsed against a synthetic tenant.' },
    ],
  },
  {
    id: 'aggregate-only',
    says: 'No individual student analytics reach the institution',
    verifies: [
      { id: 'suppression', needs: 'Every aggregate table enforces the n ≥ 10 floor in the database.' },
      { id: 'no-risk-labels', needs: 'No model or field labels an individual student’s risk.' },
      { id: 'dashboard-scope', needs: 'Every staff dashboard reads aggregate tables only.' },
    ],
  },
];

export interface PromiseVerdict {
  kept: boolean;
  met: PromiseCheck[];
  unmet: PromiseCheck[];
}

/** Whether a promise is kept, given what the console can see. Unknown reads as false. */
export function verify(promise: CustomerPromise, facts: Readonly<Record<string, boolean>>): PromiseVerdict {
  const met = promise.verifies.filter((c) => facts[c.id] === true);
  const unmet = promise.verifies.filter((c) => facts[c.id] !== true);
  return { kept: unmet.length === 0, met, unmet };
}

// ── Release impact ───────────────────────────────────────────────────────────

export interface ReleaseChange {
  /** Repository-relative paths changed. */
  files: readonly string[];
  /** Flags whose state changes, with the tenants each is on for. */
  flags: readonly { name: string; onFor: readonly string[] }[];
}

export interface ImpactCatalog {
  /** Every tenant the platform runs. */
  tenants: readonly string[];
  /** Which roles use a screen, by screen file stem. */
  rolesByScreen: Readonly<Record<string, readonly string[]>>;
}

export interface Impact {
  tenants: string[];
  roles: string[];
  integrations: string[];
  /** Documents or claims that may need updating. */
  documents: string[];
  training: boolean;
  notifications: string[];
  alerts: string[];
  /** Needs an approval before release. */
  material: boolean;
  why: string[];
}

const A11Y_PATHS = [/^app\/src\/a11y\//, /^app\/src\/lib\/look\.ts$/, /^app\/src\/styles\//, /^app\/src\/components\/ui\.tsx$/];

/** What a change touches, from its paths and flags. */
export function impact(change: ReleaseChange, catalog: ImpactCatalog): Impact {
  const out: Impact = { tenants: [], roles: [], integrations: [], documents: [], training: false, notifications: [], alerts: [], material: false, why: [] };
  const add = (list: string[], v: string) => {
    if (!list.includes(v)) list.push(v);
  };

  for (const f of change.files) {
    if (/^supabase\/migrations\//.test(f)) {
      for (const t of catalog.tenants) add(out.tenants, t);
      add(out.documents, 'RETENTION.md');
      out.material = true;
      add(out.why, `${f} changes the database`);
      add(out.alerts, 'migration-applied');
    }
    if (/^supabase\/.*\.sql$/.test(f) && /polic|rls|check\.sql/.test(f)) {
      out.material = true;
      add(out.why, `${f} changes a policy`);
      add(out.documents, 'docs/trust/SECURITY-WHITEPAPER.md');
    }
    const integration = /^app\/src\/lib\/integration\/([a-z0-9-]+)/.exec(f) ?? /^app\/server\/institution\/adapters\/([a-z0-9-]+)/.exec(f);
    if (integration) {
      add(out.integrations, integration[1]);
      out.material = true;
      add(out.why, `${f} changes an integration`);
      add(out.alerts, `integration:${integration[1]}`);
    }
    const screen = /^app\/src\/screens\/([A-Za-z0-9]+)\.tsx$/.exec(f);
    if (screen) {
      for (const r of catalog.rolesByScreen[screen[1]] ?? ['student']) add(out.roles, r);
      out.training = true;
      add(out.documents, 'docs/LAUNCH-CONTENT-AND-TRAINING.md');
    }
    if (A11Y_PATHS.some((re) => re.test(f))) {
      add(out.documents, 'docs/WCAG-UI-AUDIT-SCORECARD.md');
      add(out.documents, 'VPAT/ACR, once one exists');
      out.material = true;
      add(out.why, `${f} may change a conformance claim`);
    }
    if (/^app\/src\/lib\/privacy\.ts$|^docs\/legal\//.test(f)) {
      add(out.documents, 'docs/legal/PRIVACY-POLICY-DRAFT.md');
      for (const t of catalog.tenants) add(out.notifications, t);
      out.material = true;
      add(out.why, `${f} changes what is said about data`);
    }
  }

  for (const flag of change.flags) {
    for (const t of flag.onFor) {
      add(out.tenants, t);
      add(out.notifications, t);
    }
    if (flag.onFor.length > 0) {
      out.material = true;
      add(out.why, `flag ${flag.name} is on for ${flag.onFor.length} tenant${flag.onFor.length === 1 ? '' : 's'}`);
    }
    add(out.documents, 'docs/FEATURE-FLAG-REGISTRY.md');
  }

  return out;
}

// ── On-call workload ─────────────────────────────────────────────────────────

export interface Shift {
  seat: string;
  /** `YYYY-MM-DD`, inclusive. */
  from: string;
  to: string;
  backup: string | null;
  /** Incidents handled during the shift. */
  incidents: number;
}

export interface WorkloadRules {
  /** The most consecutive days one seat may cover. */
  maxConsecutiveDays: number;
  /** Incidents in one shift above which the next shift must be someone else's. */
  heavyShift: number;
  /** Runbooks each seat can run; a runbook only one seat can run is a finding. */
  runbooksBySeat: Readonly<Record<string, readonly string[]>>;
}

export const DEFAULT_RULES: WorkloadRules = { maxConsecutiveDays: 7, heavyShift: 3, runbooksBySeat: {} };

export interface Finding {
  rule: 'consecutive' | 'no-backup' | 'no-recovery' | 'single-point' | 'self-backup';
  seat: string;
  said: string;
}

const day = (s: string) => Math.round(Date.parse(`${s}T00:00:00Z`) / 86_400_000);

/** The findings against a roster. Empty means the roster is one people can keep. */
export function workload(shifts: readonly Shift[], rules: WorkloadRules = DEFAULT_RULES): Finding[] {
  const out: Finding[] = [];
  const sorted = [...shifts].sort((a, b) => a.from.localeCompare(b.from));

  for (const s of sorted) {
    if (!s.backup) out.push({ rule: 'no-backup', seat: s.seat, said: `${s.seat} has no backup from ${s.from} to ${s.to}.` });
    else if (s.backup === s.seat) out.push({ rule: 'self-backup', seat: s.seat, said: `${s.seat} is their own backup from ${s.from} to ${s.to}.` });
  }

  // The run and recovery rules are about one person's calendar, so each seat's
  // shifts are read on their own: another seat's shift between two of A's
  // does not end A's run, and does not count as A's rest (Codex, #922).
  const seats = [...new Set(sorted.map((s) => s.seat))];
  for (const seat of seats) {
    const own = sorted.filter((s) => s.seat === seat);
    let run: { seat: string; start: number; end: number } | null = null;
    for (const s of own) {
      const start = day(s.from);
      const end = day(s.to);
      if (run && start <= run.end + 1) run.end = Math.max(run.end, end);
      else {
        if (run && run.end - run.start + 1 > rules.maxConsecutiveDays) out.push(consecutive(run, rules));
        run = { seat, start, end };
      }
    }
    if (run && run.end - run.start + 1 > rules.maxConsecutiveDays) out.push(consecutive(run, rules));

    for (const [i, s] of own.entries()) {
      const next = own[i + 1];
      // Rest is a gap in this seat's own calendar, not somebody else's shift.
      if (s.incidents > rules.heavyShift && next && day(next.from) <= day(s.to) + 1) {
        out.push({ rule: 'no-recovery', seat, said: `${seat} handled ${s.incidents} incidents to ${s.to} and is on again from ${next.from}.` });
      }
    }
  }

  const holders = new Map<string, string[]>();
  for (const [seat, books] of Object.entries(rules.runbooksBySeat)) {
    for (const b of books) holders.set(b, [...(holders.get(b) ?? []), seat]);
  }
  for (const [book, seats] of holders) {
    if (seats.length === 1) out.push({ rule: 'single-point', seat: seats[0], said: `Only ${seats[0]} can run ${book}.` });
  }

  return out;
}

function consecutive(run: { seat: string; start: number; end: number }, rules: WorkloadRules): Finding {
  const days = run.end - run.start + 1;
  return { rule: 'consecutive', seat: run.seat, said: `${run.seat} covers ${days} consecutive days; the ceiling is ${rules.maxConsecutiveDays}.` };
}
