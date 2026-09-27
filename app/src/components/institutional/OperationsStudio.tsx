import { useMemo, useState } from 'react';
import { TabList, SectionLabel } from '../ui';
import { Card, Never } from '../JourneyKit';
import { useDeviceLibrary } from '../../lib/device-library';
import { download } from '../../lib/deliver';
import {
  CERTIFICATION,
  DEPRECATION_NOTICE_MONTHS,
  DICTIONARY,
  FORBIDDEN,
  INTERNATIONAL,
  KEY_MAX_AGE_DAYS,
  MIN_COHORT,
  OPERATIONS_CAPABILITY,
  RATE_LIMITS,
  SCOPES,
  WEBHOOK_EVENTS,
  approve,
  operationsAllowed,
  bottlenecks,
  capacityScenario,
  continuityGaps,
  downstream,
  exportReport,
  findCycle,
  freshness,
  termsTo,
  uncovered,
  type Cell,
  type CourseNode,
  type Evidence,
} from '../../lib/institution-ops';

/**
 * The staff side of the student journey — governed first.
 *
 * Behind `VITE_INSTITUTIONAL_OPERATIONS` and off everywhere by default. It
 * ships no institutional data and invents none: every tool here works on what
 * an analyst pastes or types, on this device, and every figure it produces has
 * been through `lib/institution-ops.ts` — suppressed under n = 10, refused if
 * it names a forbidden measure, held for a second reviewer if sensitive.
 */

const TABS = [
  { id: 'governance' as const, label: 'Governance' },
  { id: 'curriculum' as const, label: 'Curriculum' },
  { id: 'evidence' as const, label: 'Evidence' },
  { id: 'platform' as const, label: 'Platform' },
  { id: 'readiness' as const, label: 'Readiness' },
];

type Tab = (typeof TABS)[number]['id'];

interface OpsLibrary {
  evidence: Evidence[];
  standards: string[];
  ready: Record<string, boolean>;
}

const EMPTY_OPS: OpsLibrary = { evidence: [], standards: [], ready: {} };

function readOps(v: unknown): OpsLibrary {
  if (!v || typeof v !== 'object') return EMPTY_OPS;
  const o = v as Record<string, unknown>;
  const evidence = (Array.isArray(o.evidence) ? o.evidence : [])
    .filter((e): e is Evidence => !!e && typeof e === 'object' && typeof (e as Evidence).id === 'string')
    .map((e) => ({
      id: String(e.id),
      standard: String(e.standard ?? ''),
      title: String(e.title ?? ''),
      owner: String(e.owner ?? ''),
      updated: /^\d{4}-\d{2}-\d{2}$/.test(String(e.updated)) ? String(e.updated) : '',
      every: Number.isFinite(e.every) && e.every > 0 ? Math.min(e.every, 120) : 12,
      state: (e.state === 'review' || e.state === 'approved' ? e.state : 'draft') as Evidence['state'],
      approver: typeof e.approver === 'string' ? e.approver : undefined,
    }))
    .slice(0, 500);
  return {
    evidence,
    standards: (Array.isArray(o.standards) ? o.standards : []).filter((s): s is string => typeof s === 'string').slice(0, 200),
    ready: Object.fromEntries(Object.entries(o.ready && typeof o.ready === 'object' ? o.ready : {}).filter(([, x]) => x === true)) as Record<string, boolean>,
  };
}

const today = () => new Date().toISOString().slice(0, 10);

/** Written out, not built, so the dead-CSS check can see every class in use. */
const FRESH_TAG: Record<ReturnType<typeof freshness>, string> = {
  fresh: 'jx-tag',
  due: 'jx-tag',
  stale: 'jx-tag jx-fresh-stale',
  unowned: 'jx-tag jx-fresh-unowned',
};

/**
 * `verified` is the gateway-verified capability list, not a role picker; the
 * studio refuses without `outcomes:read` even if a caller forgets to gate the
 * tab. Drafts are keyed by school and account so two analysts on one browser
 * profile never see each other's evidence.
 */
export function OperationsStudio({ verified, tenantId, accountId }: { verified: readonly string[]; tenantId: string; accountId: string }) {
  if (!operationsAllowed(verified)) {
    return <p className="jx-muted">Operations needs the verified {OPERATIONS_CAPABILITY} capability for this school.</p>;
  }
  return <Studio key={`${tenantId}:${accountId}`} storageKey={`semester.operations.v1:${tenantId}:${accountId}`} />;
}

function Studio({ storageKey }: { storageKey: string }) {
  const [tab, setTab] = useState<Tab>('governance');
  const lib = useDeviceLibrary(storageKey, readOps, EMPTY_OPS);
  return (
    <div className="jx-ops">
      <TabList label="Operations" className="portal-tabs" value={tab} onChange={setTab} tabs={TABS} />
      {tab === 'governance' ? <Governance /> : null}
      {tab === 'curriculum' ? <Curriculum /> : null}
      {tab === 'evidence' ? <EvidenceTab lib={lib.value} update={lib.update} /> : null}
      {tab === 'platform' ? <Platform /> : null}
      {tab === 'readiness' ? <Readiness lib={lib.value} update={lib.update} /> : null}
    </div>
  );
}

/** "group,key,n" lines → cells. Anything else is skipped and counted. */
function parseCells(text: string): { cells: Cell[]; skipped: number } {
  const cells: Cell[] = [];
  let skipped = 0;
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const [group, key, n] = line.split(',').map((x) => x.trim());
    const count = Number(n);
    if (group && key && Number.isInteger(count) && count >= 0) cells.push({ group, key, n: count });
    else skipped += 1;
  }
  return { cells, skipped };
}

function Governance() {
  const [metric, setMetric] = useState(DICTIONARY[0].id);
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [reviewer, setReviewer] = useState('');
  const { cells, skipped } = useMemo(() => parseCells(text), [text]);
  const def = DICTIONARY.find((m) => m.id === metric)!;
  const result = cells.length
    ? exportReport({
        id: metric,
        title: def.name,
        metrics: [metric],
        cells,
        review: reviewer ? { author, reviewer, approvedAt: today() } : undefined,
      })
    : null;
  const refusal: Record<string, string> = {
    needs_review: 'This metric is sensitive. It needs a named reviewer before it can leave.',
    self_review: 'The reviewer cannot be the author.',
    forbidden_field: 'A row names a forbidden measure. It cannot be exported.',
    unknown_metric: 'That metric is not in the data dictionary.',
  };
  return (
    <>
      <Card kicker="The floor" title={`Aggregates only, at n ≥ ${MIN_COHORT}`}>
        <p>Every figure is suppressed under {MIN_COHORT} students, and one more cell per group where a total would give the hidden one back. The database enforces the same floor.</p>
      </Card>
      <Never heading="Measures that do not exist here" items={FORBIDDEN.map((f) => f.says)} />

      <SectionLabel>Data dictionary</SectionLabel>
      {DICTIONARY.map((m) => (
        <div key={m.id} className="jx-entry">
          <div className="jx-entry-head">
            <span className="jx-entry-title">{m.name}</span>
            <span className="jx-tag">{m.grain}</span>
            {m.sensitive ? <span className="jx-tag jx-tag-student">Needs review</span> : null}
          </div>
          <div className="jx-entry-what">{m.definition}</div>
          <div className="jx-privacy">Lineage: {m.sources.join(' → ')} · Owner: {m.owner}</div>
        </div>
      ))}

      <SectionLabel>Suppressed export</SectionLabel>
      <label className="jx-field">
        <span>Metric</span>
        <select className="input" value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Metric to export">
          {DICTIONARY.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label className="jx-field">
        <span>Aggregate counts, one per line: group,key,n</span>
        <textarea className="input jx-area" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Fall 2026,admitted,412\nFall 2026,confirmed,301'} aria-label="Aggregate counts" />
      </label>
      {def.sensitive ? (
        <div className="jx-inline">
          <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author" aria-label="Report author" />
          <input className="input" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Reviewer" aria-label="Report reviewer" />
        </div>
      ) : null}
      {skipped ? <p className="jx-warn" role="alert">{skipped} line{skipped === 1 ? '' : 's'} not in group,key,n form — skipped.</p> : null}
      {result && !result.ok ? <p className="jx-warn" role="alert">{refusal[result.why]}</p> : null}
      {result && result.ok ? (
        <>
          <pre className="jx-pre">{result.csv}</pre>
          <button type="button" className="btn btn-secondary" onClick={() => download({ name: `${metric}-suppressed.csv`, body: result.csv, mime: 'text/csv' })}>
            Download CSV
          </button>
        </>
      ) : null}
    </>
  );
}

/** "CODE: PRE, PRE" lines → course nodes. */
function parseCourses(text: string): CourseNode[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [id, rest = ''] = l.split(':');
      return { id: id.trim(), prereqs: rest.split(',').map((p) => p.trim()).filter(Boolean), outcomes: [] };
    })
    .filter((c) => c.id);
}

function Curriculum() {
  const [text, setText] = useState('');
  const [target, setTarget] = useState('');
  const [demand, setDemand] = useState('');
  const [seats, setSeats] = useState('30');
  const [sections, setSections] = useState('4');
  const courses = useMemo(() => parseCourses(text), [text]);
  const cycle = findCycle(courses);
  const known = courses.some((c) => c.id === target);
  const planned = Number(demand) || 0;
  const scenario = capacityScenario(planned, Number(seats) || 0, Number(sections) || 0);
  const blocks = known && !cycle ? bottlenecks(courses, [{ id: target, planned, seats: scenario.seats }]) : [];
  return (
    <>
      <label className="jx-field">
        <span>Prerequisites, one course per line: CODE: PREREQ, PREREQ</span>
        <textarea className="input jx-area" value={text} onChange={(e) => setText(e.target.value)} placeholder={'ECON 1010:\nECON 1500: ECON 1010\nECON 3010: ECON 1500, MATH 1300'} aria-label="Course prerequisites" />
      </label>
      {cycle ? <p className="jx-warn" role="alert">Prerequisite cycle: {cycle.join(' → ')}</p> : null}
      <label className="jx-field">
        <span>Course to examine</span>
        <input className="input" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="ECON 3010" aria-label="Course to examine" />
      </label>
      {known && !cycle ? (
        <Card kicker={target} title={`${termsTo(target, courses)} terms at the earliest`}>
          <p>Changing it touches {downstream(target, courses).length} later course{downstream(target, courses).length === 1 ? '' : 's'}: {downstream(target, courses).join(', ') || 'none'}.</p>
        </Card>
      ) : null}
      <SectionLabel>Section capacity</SectionLabel>
      <div className="jx-inline">
        <label className="jx-field">
          <span>Planned students (aggregate)</span>
          <input className="input" inputMode="numeric" value={demand} onChange={(e) => setDemand(e.target.value)} aria-label="Planned students" />
        </label>
        <label className="jx-field">
          <span>Seats per section</span>
          <input className="input" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} aria-label="Seats per section" />
        </label>
        <label className="jx-field">
          <span>Sections</span>
          <input className="input" inputMode="numeric" value={sections} onChange={(e) => setSections(e.target.value)} aria-label="Sections" />
        </label>
      </div>
      {planned > 0 && planned < MIN_COHORT ? (
        <p className="jx-warn" role="alert">Under {MIN_COHORT} planned students — too few to model. A scenario on nine students is a guess about nine students.</p>
      ) : planned > 0 ? (
        <p className="jx-lead">
          {scenario.seats} seats · {scenario.unmet ? `${scenario.unmet} unmet` : `${scenario.spare} spare`} · {scenario.sectionsNeeded} sections needed
          {blocks.length ? ` · a bottleneck for ${blocks[0].blocks} later course${blocks[0].blocks === 1 ? '' : 's'}` : ''}
        </p>
      ) : null}
    </>
  );
}

function EvidenceTab({ lib, update }: { lib: OpsLibrary; update: (fn: (o: OpsLibrary) => OpsLibrary) => void }) {
  const [standard, setStandard] = useState('');
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [approver, setApprover] = useState('');
  const [error, setError] = useState('');
  const gaps = uncovered(lib.standards, lib.evidence);
  const add = () => {
    if (!standard.trim() || !title.trim()) return;
    const e: Evidence = { id: `ev-${Date.now().toString(36)}`, standard: standard.trim(), title: title.trim(), owner: owner.trim(), updated: today(), every: 12, state: 'draft' };
    update((o) => ({ ...o, evidence: [e, ...o.evidence], standards: o.standards.includes(e.standard) ? o.standards : [...o.standards, e.standard] }));
    setTitle('');
  };
  const set = (id: string, fn: (e: Evidence) => Evidence) => {
    try {
      update((o) => ({ ...o, evidence: o.evidence.map((x) => (x.id === id ? fn(x) : x)) }));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return (
    <>
      {gaps.length ? <p className="jx-warn" role="alert">Standards with no approved evidence: {gaps.join(', ')}</p> : null}
      {error ? <p className="jx-warn" role="alert">{error}</p> : null}
      {lib.evidence.map((e) => (
        <div key={e.id} className="jx-entry">
          <div className="jx-entry-head">
            <span className="jx-entry-title">{e.title}</span>
            <span className="jx-tag">{e.standard}</span>
            <span className="jx-tag">{e.state}</span>
            <span className={FRESH_TAG[freshness(e, today())]}>{freshness(e, today())}</span>
          </div>
          <div className="jx-entry-what">
            Owner: {e.owner || 'nobody'} · updated {e.updated} · review every {e.every} months{e.approver ? ` · approved by ${e.approver}` : ''}
          </div>
          <div className="jx-actions">
            {e.state === 'draft' ? (
              <button type="button" className="jx-go" onClick={() => set(e.id, (x) => ({ ...x, state: 'review' }))}>
                Send for review
              </button>
            ) : null}
            {e.state === 'review' ? (
              <button type="button" className="jx-go" onClick={() => {
                const who = approver.trim();
                if (!who || who === e.owner) {
                  setError('Evidence is approved by somebody other than its owner.');
                  return;
                }
                set(e.id, (x) => approve(x, who));
              }}>
                Approve as {approver || '…'}
              </button>
            ) : null}
            <button type="button" className="jx-go" onClick={() => set(e.id, (x) => ({ ...x, updated: today(), state: x.state === 'approved' ? 'review' : x.state }))}>
              Mark refreshed
            </button>
          </div>
        </div>
      ))}
      <SectionLabel>Add evidence</SectionLabel>
      <div className="jx-inline">
        <input className="input" value={standard} onChange={(e) => setStandard(e.target.value)} placeholder="Standard (e.g. 8.2.a)" aria-label="Standard" />
        <input className="input" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" aria-label="Evidence owner" />
      </div>
      <div className="jx-inline">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Evidence title" aria-label="Evidence title" />
        <button type="button" className="btn btn-secondary" onClick={add}>
          Add
        </button>
      </div>
      <label className="jx-field">
        <span>Approving as</span>
        <input className="input" value={approver} onChange={(e) => setApprover(e.target.value)} placeholder="Your name" aria-label="Approver name" />
      </label>
    </>
  );
}

function Platform() {
  return (
    <>
      <Card kicker="Scopes" title="Read by default">
        {SCOPES.map((s) => (
          <p key={s.id}>
            <code>{s.id}</code> {s.write ? '(write) ' : ''}— {s.says}
          </p>
        ))}
      </Card>
      <Card kicker="Webhooks" title="Events carry counts and ids, never content">
        <p>{WEBHOOK_EVENTS.join(' · ')}</p>
      </Card>
      <Card kicker="Policy" title="Keys, limits and versions">
        <p>Keys rotate at least every {KEY_MAX_AGE_DAYS} days and belong to one tenant. {RATE_LIMITS.standard} requests a minute, {RATE_LIMITS.bulk} for bulk endpoints. A version is retired only after {DEPRECATION_NOTICE_MONTHS} months’ notice. Every call is written to the audit log.</p>
      </Card>
      <Card kicker="Certification" title="What an integration must show">
        <ul>
          {CERTIFICATION.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function Readiness({ lib, update }: { lib: OpsLibrary; update: (fn: (o: OpsLibrary) => OpsLibrary) => void }) {
  const [rto, setRto] = useState('8');
  const [rpo, setRpo] = useState('1');
  const [restore, setRestore] = useState('');
  const [regions, setRegions] = useState('1');
  const [access, setAccess] = useState('');
  const gaps = continuityGaps({ rtoHours: Number(rto) || 0, rpoHours: Number(rpo) || 0, lastRestoreTest: restore, regions: Number(regions) || 0, emergencyAccessReviewed: access }, today());
  return (
    <>
      <SectionLabel>Tenant continuity</SectionLabel>
      <div className="jx-inline">
        <label className="jx-field">
          <span>Recovery time, hours</span>
          <input className="input" inputMode="numeric" value={rto} onChange={(e) => setRto(e.target.value)} aria-label="Recovery time objective in hours" />
        </label>
        <label className="jx-field">
          <span>Data at risk, hours</span>
          <input className="input" inputMode="numeric" value={rpo} onChange={(e) => setRpo(e.target.value)} aria-label="Recovery point objective in hours" />
        </label>
        <label className="jx-field">
          <span>Regions</span>
          <input className="input" inputMode="numeric" value={regions} onChange={(e) => setRegions(e.target.value)} aria-label="Regions" />
        </label>
      </div>
      <div className="jx-inline">
        <label className="jx-field">
          <span>Last restore test</span>
          <input className="input" type="date" value={restore} onChange={(e) => setRestore(e.target.value)} aria-label="Last restore test" />
        </label>
        <label className="jx-field">
          <span>Emergency access last reviewed</span>
          <input className="input" type="date" value={access} onChange={(e) => setAccess(e.target.value)} aria-label="Emergency access last reviewed" />
        </label>
      </div>
      {gaps.length ? (
        <ul className="jx-warn">
          {gaps.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      ) : (
        <p className="jx-lead">No gaps against the stated targets.</p>
      )}
      <SectionLabel>International expansion</SectionLabel>
      {INTERNATIONAL.map((i) => (
        <label key={i.id} className="jx-check">
          <input type="checkbox" checked={Boolean(lib.ready[i.id])} onChange={() => update((o) => ({ ...o, ready: { ...o.ready, [i.id]: !o.ready[i.id] } }))} aria-label={i.title} />
          <span className="jx-check-body">
            <span className="jx-check-title">{i.title}</span>
            <span className="jx-check-detail">{i.area}</span>
          </span>
        </label>
      ))}
    </>
  );
}
