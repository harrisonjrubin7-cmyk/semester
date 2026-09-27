import { useState } from 'react';
import { SEASONS, project, type Season, type Term } from '../../lib/graduation';
import { CHECKLIST } from '../../lib/registration-day';
import { conflicts, type CatalogCourse } from '../../lib/registration';

/**
 * The public tools: useful before anybody signs up.
 *
 * Each is the app's own logic — `project()` from `lib/graduation.ts`,
 * `conflicts()` from `lib/registration.ts`, `CHECKLIST` from
 * `lib/registration-day.ts` — so a tool on the website and the same question
 * in the app cannot give different answers.
 *
 * Nothing here is stored or sent. State lives in the page and is gone when the
 * tab closes, which the page says. The components are prerendered by
 * `render.tsx` and hydrated by `client.tsx` with the same props, so they
 * render the same thing both times: nothing reads the clock during render.
 */

export type ToolId = 'graduation' | 'schedule' | 'checklist' | 'advisor';

export interface ToolProps {
  /** The first term still to come, fixed at build time so hydration matches. */
  next: Term;
}

export const TOOL_LIST: { id: ToolId; title: string; lead: string; description: string }[] = [
  {
    id: 'graduation',
    title: 'Graduation timeline calculator',
    lead: 'How many terms are left at the pace you choose, with summers or without.',
    description: 'Estimate when you could finish your degree at different credit loads, with or without summers.',
  },
  {
    id: 'schedule',
    title: 'Schedule builder',
    lead: 'Add the sections you are considering and see every time conflict.',
    description: 'Check a class schedule for time conflicts and total credits before registration.',
  },
  {
    id: 'checklist',
    title: 'Registration checklist',
    lead: 'Everything to have ready before your registration window opens.',
    description: 'A checklist of what to have ready before course registration opens.',
  },
  {
    id: 'advisor',
    title: 'Advisor meeting planner',
    lead: 'Your questions and your plan, ready for the meeting.',
    description: 'Prepare an agenda and questions for a meeting with your academic advisor.',
  },
];

const EPHEMERAL = 'Nothing you enter here is saved or sent. It is gone when you close this page.';

const int = (v: string, lo: number, hi: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};

// ── graduation ────────────────────────────────────────────────────────────

export function GraduationTool({ next }: ToolProps) {
  const [needed, setNeeded] = useState('120');
  const [done, setDone] = useState('30');
  const [perTerm, setPerTerm] = useState('15');
  const [summer, setSummer] = useState('0');
  const [season, setSeason] = useState<Season>(next.season);
  const [year, setYear] = useState(String(next.year));

  const plan = {
    needed: int(needed, 1, 400, 120),
    perTerm: int(perTerm, 0, 30, 15),
    summer: int(summer, 0, 20, 0),
    costPerTerm: 0,
    summerCost: 0,
    next: { season, year: int(year, 2000, 2100, next.year) },
  };
  const result = project(plan, int(done, 0, 400, 0));

  return (
    <div className="tool">
      <div className="tool-grid">
        <label className="tool-field">
          <span>Credits your degree needs (check your audit)</span>
          <input className="tool-input" inputMode="numeric" value={needed} onChange={(e) => setNeeded(e.target.value)} />
        </label>
        <label className="tool-field">
          <span>Credits you have finished</span>
          <input className="tool-input" inputMode="numeric" value={done} onChange={(e) => setDone(e.target.value)} />
        </label>
        <label className="tool-field">
          <span>Credits per fall or spring term</span>
          <input className="tool-input" inputMode="numeric" value={perTerm} onChange={(e) => setPerTerm(e.target.value)} />
        </label>
        <label className="tool-field">
          <span>Credits per summer (0 for none)</span>
          <input className="tool-input" inputMode="numeric" value={summer} onChange={(e) => setSummer(e.target.value)} />
        </label>
        <label className="tool-field">
          <span>Your next term</span>
          <select className="tool-input" value={season} onChange={(e) => setSeason(e.target.value as Season)}>
            {SEASONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="tool-field">
          <span>Year of your next term</span>
          <input className="tool-input" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
      </div>
      <div className="tool-result" role="status" aria-live="polite">
        <p className="site-kicker">Estimated</p>
        {result.remaining <= 0 ? (
          <p className="tool-answer">You have the credits you entered as needed.</p>
        ) : result.finish ? (
          <p className="tool-answer">
            You could finish in {result.finish.season} {result.finish.year}: {result.terms} fall or spring
            {result.terms === 1 ? ' term' : ' terms'}
            {result.summers ? ` and ${result.summers} ${result.summers === 1 ? 'summer' : 'summers'}` : ''}, with{' '}
            {result.remaining} credits to go.
          </p>
        ) : (
          <p className="tool-answer">At this pace the degree does not finish within twenty years. Try more credits per term.</p>
        )}
        <p className="site-small">An estimate from the numbers above, not a degree audit. Requirements, not just credits, decide when you graduate.</p>
      </div>
    </div>
  );
}

// ── schedule ──────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const minutes = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

interface Row {
  id: string;
  code: string;
  days: number[];
  start: string;
  end: string;
  credits: string;
}

export function ScheduleTool() {
  const [rows, setRows] = useState<Row[]>([
    { id: 'a', code: 'ECON 1010', days: [1, 3], start: '09:00', end: '09:50', credits: '3' },
    { id: 'b', code: 'MATH 1100', days: [1, 3], start: '09:30', end: '10:45', credits: '4' },
  ]);
  const [seq, setSeq] = useState(0);
  const update = (id: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const courses: CatalogCourse[] = rows.map((r) => ({
    id: r.id,
    code: r.code || 'Unnamed',
    section: '',
    title: '',
    term: '',
    department: '',
    credits: Number(r.credits) || 0,
    instructor: '',
    location: '',
    description: '',
    prerequisites: '',
    seats: null,
    meetings: Number.isFinite(minutes(r.start)) && Number.isFinite(minutes(r.end)) && r.days.length
      ? [{ days: r.days, start: minutes(r.start), end: minutes(r.end) }]
      : [],
  }));
  const clashes = conflicts(courses);
  const credits = courses.reduce((n, c) => n + c.credits, 0);

  return (
    <div className="tool">
      <ol className="tool-rows">
        {rows.map((r, i) => (
          <li key={r.id}>
            <fieldset className="tool-row">
              <legend>Class {i + 1}</legend>
              <label className="tool-field">
                <span>Course</span>
                <input className="tool-input" value={r.code} onChange={(e) => update(r.id, { code: e.target.value })} />
              </label>
              <div className="tool-days" role="group" aria-label={`Days for class ${i + 1}`}>
                {DAY_NAMES.map((d, day) => (
                  <label key={d} className="tool-day">
                    <input
                      type="checkbox"
                      checked={r.days.includes(day)}
                      onChange={(e) => update(r.id, { days: e.target.checked ? [...r.days, day].sort() : r.days.filter((x) => x !== day) })}
                    />
                    {d}
                  </label>
                ))}
              </div>
              <label className="tool-field">
                <span>Starts</span>
                <input className="tool-input" type="time" value={r.start} onChange={(e) => update(r.id, { start: e.target.value })} />
              </label>
              <label className="tool-field">
                <span>Ends</span>
                <input className="tool-input" type="time" value={r.end} onChange={(e) => update(r.id, { end: e.target.value })} />
              </label>
              <label className="tool-field">
                <span>Credits</span>
                <input className="tool-input" inputMode="numeric" value={r.credits} onChange={(e) => update(r.id, { credits: e.target.value })} />
              </label>
              <button type="button" className="tool-button" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                Remove class {i + 1}
              </button>
            </fieldset>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="tool-button"
        onClick={() => {
          setRows((rs) => [...rs, { id: `n${seq}`, code: '', days: [], start: '', end: '', credits: '3' }]);
          setSeq((n) => n + 1);
        }}
      >
        Add a class
      </button>
      <div className="tool-result" role="status" aria-live="polite">
        <p className="tool-answer">
          {credits} credits · {clashes.length === 0 ? 'no time conflicts' : `${clashes.length} time ${clashes.length === 1 ? 'conflict' : 'conflicts'}`}
        </p>
        {clashes.length > 0 && (
          <ul>
            {clashes.map((c) => (
              <li key={`${c.a.id}-${c.b.id}`}>
                {c.a.code} and {c.b.code} overlap on {c.days.map((d) => DAY_NAMES[d]).join(', ')}.
              </li>
            ))}
          </ul>
        )}
        <p className="site-small">This checks the times you typed. Your university’s registration system is the one that enrolls you.</p>
      </div>
    </div>
  );
}

// ── checklist ─────────────────────────────────────────────────────────────

export function ChecklistTool() {
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const done = CHECKLIST.filter((c) => ticked[c.id]).length;
  return (
    <div className="tool">
      <ul className="tool-checklist">
        {CHECKLIST.map((c) => (
          <li key={c.id}>
            <label className="tool-check">
              <input type="checkbox" checked={Boolean(ticked[c.id])} onChange={(e) => setTicked((t) => ({ ...t, [c.id]: e.target.checked }))} />
              <span>
                <strong>{c.label}</strong>
                <span className="site-small"> {c.why}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="tool-answer" role="status" aria-live="polite">
        {done} of {CHECKLIST.length} ready
      </p>
    </div>
  );
}

// ── advisor ───────────────────────────────────────────────────────────────

export function agendaText(input: { when: string; where: string; questions: string[]; decisions: string }): string {
  const lines = ['Advisor meeting agenda'];
  if (input.when.trim()) lines.push(`When: ${input.when.trim()}`);
  lines.push('', 'Where I am');
  lines.push(input.where.trim() || '(not filled in)');
  lines.push('', 'My questions');
  const qs = input.questions.map((q) => q.trim()).filter(Boolean);
  lines.push(...(qs.length ? qs.map((q, i) => `${i + 1}. ${q}`) : ['(none yet)']));
  lines.push('', 'Decisions I need to make');
  lines.push(input.decisions.trim() || '(not filled in)');
  lines.push('', 'Prepared with Semester. A planning note, not an official record.');
  return lines.join('\n');
}

export function AdvisorTool() {
  const [when, setWhen] = useState('');
  const [where, setWhere] = useState('');
  const [questions, setQuestions] = useState('');
  const [decisions, setDecisions] = useState('');
  const [said, setSaid] = useState('');
  const text = agendaText({ when, where, questions: questions.split('\n'), decisions });

  return (
    <div className="tool">
      <div className="tool-grid">
        <label className="tool-field">
          <span>When is the meeting (optional)</span>
          <input className="tool-input" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
      </div>
      <label className="tool-field">
        <span>Where I am: credits, major, anything that changed</span>
        <textarea className="tool-input" rows={3} value={where} onChange={(e) => setWhere(e.target.value)} />
      </label>
      <label className="tool-field">
        <span>My questions, one per line</span>
        <textarea className="tool-input" rows={4} value={questions} onChange={(e) => setQuestions(e.target.value)} />
      </label>
      <label className="tool-field">
        <span>Decisions I need to make</span>
        <textarea className="tool-input" rows={3} value={decisions} onChange={(e) => setDecisions(e.target.value)} />
      </label>
      <h2 className="tool-subhead">Your agenda</h2>
      <pre className="tool-preview" aria-label="Agenda preview">{text}</pre>
      <p className="site-actions">
        <button
          type="button"
          className="tool-button"
          onClick={() => {
            const failed = () => setSaid('Could not copy. Select the agenda above and copy it instead.');
            if (!navigator.clipboard) return failed();
            navigator.clipboard.writeText(text).then(() => setSaid('Copied. Paste it into an email or a note yourself — Semester sends nothing.'), failed);
          }}
        >
          Copy agenda
        </button>
        <button type="button" className="tool-button" onClick={() => window.print()}>Print agenda</button>
      </p>
      {said && <p role="status" className="site-small">{said}</p>}
    </div>
  );
}

export function Tool({ id, props }: { id: ToolId; props: ToolProps }) {
  return (
    <>
      {id === 'graduation' && <GraduationTool {...props} />}
      {id === 'schedule' && <ScheduleTool />}
      {id === 'checklist' && <ChecklistTool />}
      {id === 'advisor' && <AdvisorTool />}
      <p className="site-small">{EPHEMERAL}</p>
    </>
  );
}
