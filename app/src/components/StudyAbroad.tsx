import { formatNumber } from '../lib/locale';
import { useState } from 'react';
import {
  ABROAD_LIMITS,
  APPROVALS,
  APPROVAL_MEANING,
  APPROVAL_TEXT,
  EMPTY_ABROAD,
  STAGES,
  STAGE_STEPS,
  STAGE_TITLE,
  approvalText,
  creditLine,
  creditPicture,
  newCourse,
  newProgram,
  readAbroad,
  stageProgress,
  type AbroadPlan,
  type AbroadProgram,
  type Approval,
  type CourseMatch,
} from '../lib/abroad';
import { useDeviceLibrary } from '../lib/device-library';
import { secondLine } from '../lib/dim';
import { SourceBadge } from './SourceBadge';
import { Notice, SectionLabel, Segmented } from './ui';

/**
 * Study abroad, as a tab of Pathway: which programme, whether its credit will
 * count, and what is left to do before, during and after. See `lib/abroad.ts`
 * for the rules — every approval is the student's own record of one.
 */

const field = { display: 'block', marginBottom: 'var(--sp-4)' } as const;
const input = { width: '100%', marginTop: 'var(--sp-2)' } as const;
const small = { fontSize: 'var(--type-sm)', ...secondLine() } as const;
const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)' } as const;

export function StudyAbroad({ storageKey }: { storageKey: string }) {
  const lib = useDeviceLibrary(storageKey, readAbroad, EMPTY_ABROAD);
  const plan = lib.value;
  const [chosen, setChosen] = useState<string>('');
  const [said, setSaid] = useState('');
  const program = plan.programs.find((p) => p.id === chosen) ?? plan.programs[0];

  const setProgram = (id: string, patch: Partial<AbroadProgram>) =>
    lib.update((old) => ({ ...old, programs: old.programs.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const setCourse = (id: string, patch: Partial<CourseMatch>) =>
    lib.update((old) => ({ ...old, courses: old.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const add = () => {
    const p = { ...newProgram(), name: `Program ${plan.programs.length + 1}` };
    if (lib.update((old) => ({ ...old, programs: [...old.programs, p] }))) setChosen(p.id);
  };
  const remove = (id: string) =>
    lib.update((old): AbroadPlan => {
      const steps = { ...old.steps };
      delete steps[id];
      return { programs: old.programs.filter((p) => p.id !== id), courses: old.courses.filter((c) => c.programId !== id), steps };
    });

  return (
    <div>
      <p style={{ ...body, marginTop: 0 }}>
        Weigh programs, track whether each course abroad will count at home, and keep the steps before, during and
        after in one place. Every approval here is what you recorded; your study abroad office and advisor decide.
      </p>
      {lib.error && <Notice alert>{lib.error}</Notice>}

      <fieldset disabled={lib.blocked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {plan.programs.length > 1 && <Compare plan={plan} />}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center', marginBlock: 'var(--sp-5)' }}>
          {program && plan.programs.length > 1 && (
            <Segmented
              options={plan.programs.map((p) => ({ id: p.id, label: p.name || 'Untitled program' }))}
              value={program.id}
              onChange={setChosen}
            />
          )}
          {plan.programs.length < ABROAD_LIMITS.programs && (
            <button type="button" className="btn btn-ghost" onClick={add}>
              Add a program
            </button>
          )}
        </div>

        {!program && <p style={small}>No program yet. Add one to start comparing and matching courses.</p>}

        {program && (
          <>
            <ProgramForm program={program} onChange={(patch) => setProgram(program.id, patch)} />
            <Courses
              plan={plan}
              program={program}
              onAdd={() => lib.update((old) => ({ ...old, courses: [...old.courses, newCourse(program.id)] }))}
              onChange={setCourse}
              onRemove={(id) => lib.update((old) => ({ ...old, courses: old.courses.filter((c) => c.id !== id) }))}
            />
            <Stages
              plan={plan}
              programId={program.id}
              onTick={(step, on) =>
                lib.update((old) => ({ ...old, steps: { ...old.steps, [program.id]: { ...old.steps[program.id], [step]: on } } }))
              }
            />
            <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>For your advisor</SectionLabel>
            <p style={small}>The course plan as text. Copy it into an email yourself; Semester sends nothing.</p>
            <pre className="abroad-preview" aria-label="Course plan to copy">{approvalText(plan, program.id)}</pre>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (!navigator.clipboard) return setSaid('Could not copy. Select the text above and copy it instead.');
                  navigator.clipboard.writeText(approvalText(plan, program.id)).then(
                    () => setSaid('Copied.'),
                    () => setSaid('Could not copy. Select the text above and copy it instead.'),
                  );
                }}
              >
                Copy course plan
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => remove(program.id)}>
                Remove this program
              </button>
            </div>
            {said && <Notice>{said}</Notice>}
          </>
        )}
      </fieldset>
    </div>
  );
}

function ProgramForm({ program, onChange }: { program: AbroadProgram; onChange: (patch: Partial<AbroadProgram>) => void }) {
  const text = (k: 'name' | 'host' | 'city' | 'country' | 'term', label: string) => (
    <label style={field}>
      <span style={small}>{label}</span>
      <input className="input" maxLength={ABROAD_LIMITS.text} value={program[k]} onChange={(e) => onChange({ [k]: e.target.value })} style={input} />
    </label>
  );
  return (
    <section aria-labelledby="abroad-program">
      <SectionLabel style={{ marginBlock: '0 var(--sp-4)' }}>
        <span id="abroad-program">The program</span>
      </SectionLabel>
      <div className="abroad-grid">
        {text('name', 'Program')}
        {text('host', 'Host university or provider')}
        {text('city', 'City')}
        {text('country', 'Country')}
        {text('term', 'Term')}
        <label style={field}>
          <span style={small}>Application deadline</span>
          <input className="input" type="date" value={program.deadline} onChange={(e) => onChange({ deadline: e.target.value })} style={input} />
        </label>
        <label style={field}>
          <span style={small}>Credits you hope to bring home</span>
          <input
            className="input"
            inputMode="numeric"
            value={String(program.credits)}
            onChange={(e) => onChange({ credits: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
            style={input}
          />
        </label>
        <label style={field}>
          <span style={small}>Total cost, your own figure</span>
          <input
            className="input"
            inputMode="decimal"
            value={program.cost === null ? '' : String(program.cost)}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/,/g, ''));
              onChange({ cost: e.target.value.trim() && Number.isFinite(n) && n >= 0 ? Math.min(n, 10_000_000) : null });
            }}
            style={input}
          />
        </label>
        <label style={field}>
          <span style={small}>Currency</span>
          <input className="input" maxLength={10} value={program.currency} onChange={(e) => onChange({ currency: e.target.value.toUpperCase() })} style={input} />
        </label>
      </div>
      <label style={field}>
        <span style={small}>Official program page</span>
        <input className="input" type="url" maxLength={ABROAD_LIMITS.url} value={program.url} onChange={(e) => onChange({ url: e.target.value })} style={input} />
      </label>
      <label style={field}>
        <span style={small}>Notes: requirements, language, housing</span>
        <textarea className="input" rows={3} maxLength={ABROAD_LIMITS.notes} value={program.notes} onChange={(e) => onChange({ notes: e.target.value })} style={input} />
      </label>
    </section>
  );
}

function Courses({
  plan,
  program,
  onAdd,
  onChange,
  onRemove,
}: {
  plan: AbroadPlan;
  program: AbroadProgram;
  onAdd: () => void;
  onChange: (id: string, patch: Partial<CourseMatch>) => void;
  onRemove: (id: string) => void;
}) {
  const rows = plan.courses.filter((c) => c.programId === program.id);
  const picture = creditPicture(plan, program.id);
  return (
    <section aria-labelledby="abroad-courses">
      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>
        <span id="abroad-courses">Will the credit count?</span>
      </SectionLabel>
      <p style={{ ...body, marginTop: 0 }} role="status">
        {creditLine(picture)}
      </p>
      <p style={small}>
        <SourceBadge label="student_entered" /> The approval statuses are the ones you recorded. This is not an official
        credit evaluation: your home school&rsquo;s registrar or department decides what counts.
      </p>
      {picture.approved < picture.planned && (
        <p style={small}>
          Plan your graduation on the pre-approved credit only. Pending and estimated courses can still come back
          different.
        </p>
      )}
      <ol className="abroad-courses">
        {rows.map((c, i) => (
          <li key={c.id}>
            <fieldset className="abroad-course">
              <legend>Course {i + 1}</legend>
              <label style={field}>
                <span style={small}>Course abroad</span>
                <input className="input" maxLength={ABROAD_LIMITS.text} value={c.host} onChange={(e) => onChange(c.id, { host: e.target.value })} style={input} />
              </label>
              <label style={field}>
                <span style={small}>Counts at home as</span>
                <input className="input" maxLength={ABROAD_LIMITS.text} value={c.counts} onChange={(e) => onChange(c.id, { counts: e.target.value })} style={input} />
              </label>
              <label style={field}>
                <span style={small}>Credits</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={String(c.credits)}
                  onChange={(e) => onChange(c.id, { credits: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })}
                  style={input}
                />
              </label>
              <label style={field}>
                <span style={small}>Where it stands, as you recorded it</span>
                <select className="input" value={c.status} onChange={(e) => onChange(c.id, { status: e.target.value as Approval })} style={input}>
                  {APPROVALS.map((a) => (
                    <option key={a} value={a}>
                      {APPROVAL_TEXT[a]}
                    </option>
                  ))}
                </select>
              </label>
              <label style={field}>
                <span style={small}>Recorded from (who told you, and when)</span>
                <input className="input" maxLength={ABROAD_LIMITS.text} value={c.from} onChange={(e) => onChange(c.id, { from: e.target.value })} style={input} />
              </label>
              <p style={small}>{APPROVAL_MEANING[c.status]}</p>
              <button type="button" className="btn btn-ghost" onClick={() => onRemove(c.id)}>
                Remove course {i + 1}
              </button>
            </fieldset>
          </li>
        ))}
      </ol>
      {plan.courses.length < ABROAD_LIMITS.courses && (
        <button type="button" className="btn btn-ghost" onClick={onAdd}>
          Add a course abroad
        </button>
      )}
    </section>
  );
}

function Stages({ plan, programId, onTick }: { plan: AbroadPlan; programId: string; onTick: (step: string, on: boolean) => void }) {
  const ticks = plan.steps[programId] ?? {};
  return (
    <section aria-labelledby="abroad-steps">
      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>
        <span id="abroad-steps">Steps</span>
      </SectionLabel>
      {STAGES.map((stage) => {
        const { done, total } = stageProgress(plan, programId, stage);
        return (
          <details key={stage} className="abroad-stage" open={done < total && stage === 'application'}>
            <summary>
              {STAGE_TITLE[stage]} <span style={small}>· {done} of {total}</span>
            </summary>
            <ul className="abroad-steps">
              {STAGE_STEPS[stage].map((step) => (
                <li key={step}>
                  <label>
                    <input type="checkbox" checked={Boolean(ticks[step])} onChange={(e) => onTick(step, e.target.checked)} />
                    <span>{step}</span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </section>
  );
}

function Compare({ plan }: { plan: AbroadPlan }) {
  return (
    <section aria-labelledby="abroad-compare" style={{ marginTop: 'var(--sp-5)' }}>
      <SectionLabel style={{ marginBlock: '0 var(--sp-3)' }}>
        <span id="abroad-compare">Side by side</span>
      </SectionLabel>
      <div className="abroad-table-wrap">
        <table className="abroad-table">
          <caption className="sr-only">Programs compared</caption>
          <thead>
            <tr>
              <th scope="col">Program</th>
              <th scope="col">Term</th>
              <th scope="col">Deadline</th>
              <th scope="col">Cost, as you entered it</th>
              <th scope="col">Credit you can count on</th>
            </tr>
          </thead>
          <tbody>
            {plan.programs.map((p) => {
              const c = creditPicture(plan, p.id);
              return (
                <tr key={p.id}>
                  <th scope="row">{p.name || 'Untitled program'}</th>
                  <td>{p.term || '—'}</td>
                  <td>{p.deadline || '—'}</td>
                  <td>{p.cost === null ? 'Not entered' : `${formatNumber(p.cost)} ${p.currency}`}</td>
                  <td>
                    {c.approved} of {c.planned}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={small}>Costs stay in each program’s own currency and are not converted or added up.</p>
    </section>
  );
}
