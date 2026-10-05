import { useMemo, useState } from 'react';
import { CLOCKS, MODULES, MODULE_EFFECTS, simulate, type Change, type Simulation } from '../../lib/governance/policysim';
import type { ModuleFlag } from '../../lib/experience-flags';
import { SectionLabel } from '../ui';

/**
 * The policy simulator, in the control plane: pick a change, read what it
 * would do before it is staged. Every line comes from `lib/governance/
 * policysim.ts`; this only draws it. Nothing here applies anything.
 */
export function PolicySimulator() {
  const [kind, setKind] = useState<Change['kind']>('module-off');
  const [module, setModule] = useState<ModuleFlag>('course_studio');
  const [scope, setScope] = useState<'course' | 'tenant'>('course');
  const [course, setCourse] = useState('');
  const [clock, setClock] = useState(CLOCKS[1].id);
  const [days, setDays] = useState('180');

  const change: Change = useMemo(
    () => (kind === 'module-off' ? { kind, module, scope: MODULE_EFFECTS[module].perCourse ? scope : 'tenant', course } : { kind, clock, toDays: Number(days) }),
    [kind, module, scope, course, clock, days],
  );
  const sim = useMemo(() => simulate(change), [change]);

  return (
    <section className="policy-sim" aria-label="Policy simulator">
      <SectionLabel>Before you change a policy</SectionLabel>
      <p className="control-plane-note">
        Simulate the change first: who sees it, which workflows and alternatives, what support content to update, and the audit event it writes. Nothing here changes anything.
      </p>
      <div className="policy-sim-fields">
        <label className="policy-sim-field">
          <span>Kind of change</span>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Change['kind'])}>
            <option value="module-off">Turn a module off</option>
            <option value="retention">Change a retention clock</option>
          </select>
        </label>
        {kind === 'module-off' ? (
          <>
            <label className="policy-sim-field">
              <span>Module</span>
              <select className="input" value={module} onChange={(e) => setModule(e.target.value as ModuleFlag)}>
                {MODULES.map((m) => (
                  <option key={m} value={m}>
                    {MODULE_EFFECTS[m].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="policy-sim-field">
              <span>Scope</span>
              <select className="input" value={MODULE_EFFECTS[module].perCourse ? scope : 'tenant'} onChange={(e) => setScope(e.target.value as 'course' | 'tenant')}>
                {MODULE_EFFECTS[module].perCourse && <option value="course">One course</option>}
                <option value="tenant">Whole institution</option>
              </select>
            </label>
            {scope === 'course' && MODULE_EFFECTS[module].perCourse && (
              <label className="policy-sim-field">
                <span>Course</span>
                <input className="input" value={course} placeholder="ECON 1020" onChange={(e) => setCourse(e.target.value)} />
              </label>
            )}
          </>
        ) : (
          <>
            <label className="policy-sim-field">
              <span>Clock</span>
              <select className="input" value={clock} onChange={(e) => setClock(e.target.value)}>
                {CLOCKS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} — {c.days === null ? 'until deleted' : `${c.days} days`}
                  </option>
                ))}
              </select>
            </label>
            <label className="policy-sim-field">
              <span>New clock, in days</span>
              <input className="input" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
            </label>
          </>
        )}
      </div>
      <Result sim={sim} />
    </section>
  );
}

function Result({ sim }: { sim: Simulation }) {
  if (sim.refused) {
    return (
      <p className="policy-sim-refused">
        <strong>Refused.</strong> {sim.refused}
      </p>
    );
  }
  const rows: [string, string[]][] = [
    ['Who sees the change', [sim.who]],
    ['Workflows affected', sim.workflows],
    ['Alternatives that remain', sim.alternatives],
    ['Support content to update', sim.support],
    ['Data classes affected', sim.dataClasses],
    ['Exports that change', sim.exports],
    ['Deletions that change', sim.deletions],
    ['Contracts to review', sim.contracts],
    ['Audit event', [sim.audit.event, ...sim.audit.records]],
    ['Reviewers before it applies', sim.reviewers.map((r) => r.replace(/_/g, ' '))],
  ];
  return (
    <div className="policy-sim-result">
      <p className="policy-sim-change">{sim.change}</p>
      <dl className="policy-sim-dl">
        {rows
          .filter(([, v]) => v.length > 0)
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>
                {v.length === 1 ? (
                  v[0]
                ) : (
                  <ul>
                    {v.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
