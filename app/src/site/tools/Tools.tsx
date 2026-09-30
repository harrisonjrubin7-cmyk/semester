import { useState } from 'react';
import { SEASONS, project, type Season, type Term } from '../../lib/graduation';
import { CHECKLIST } from '../../lib/registration-day';
import { conflicts, type CatalogCourse } from '../../lib/registration';
import { MODULES as CORE_MODULES } from '../modules';
import { HORIZON, INSTITUTION_TYPES, exampleRow, stackCalc, stackCsv } from '../../lib/stackcost.mjs';
import { LABEL as DIAGNOSTIC_LABEL, QUESTIONS, SCALE, briefText, diagnose, type Answers } from '../../lib/navdiagnostic';

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

export type ToolId = 'graduation' | 'schedule' | 'checklist' | 'advisor' | 'navigation' | 'stack';

export interface ToolProps {
  /** The first term still to come, fixed at build time so hydration matches. */
  next: Term;
  /**
   * The register's word for each Core module, read at build time so the tool script does not
   * carry the claims register. Only the stack calculator uses it.
   */
  statuses?: Record<string, string>;
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
  {
    id: 'navigation',
    title: 'Academic navigation diagnostic',
    lead: 'Seven questions about where students get lost at your institution, and an action brief from your own answers.',
    description: 'A guided self-assessment for institutions: where students get lost, a navigation score, the top friction patterns and an action brief.',
  },
  {
    id: 'stack',
    title: 'Stack consolidation calculator',
    lead: 'What your school pays today for the systems Semester Core is planned to take over, and what would change if, and only when, the replacement is available and your contract has ended.',
    description: 'For institutions: compare five years of your current software bills with Semester, system by system, from your own numbers. A planning estimate.',
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

// ── navigation diagnostic ────────────────────────────────────────────────

export function NavigationTool() {
  const [answers, setAnswers] = useState<Answers>({});
  const [said, setSaid] = useState('');
  const result = diagnose(answers);
  const text = briefText(answers);
  return (
    <div className="tool">
      <ol className="tool-checklist">
        {QUESTIONS.map((q) => (
          <li key={q.id}>
            <fieldset className="tool-field">
              <legend>{q.ask}</legend>
              {SCALE.map((s) => (
                <label key={s.value} className="tool-check">
                  <input
                    type="radio"
                    name={`nav-${q.id}`}
                    checked={answers[q.id] === s.value}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: s.value }))}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="tool-result" role="status" aria-live="polite">
        <p className="site-kicker">Self-assessment</p>
        <p className="tool-answer">
          {result.answered === 0
            ? 'Answer the questions above to see a score, the friction patterns and an action brief.'
            : `${result.score} of ${result.max} · ${result.maturity.level} — ${result.maturity.means}`}
        </p>
        {result.patterns.length > 0 && (
          <>
            <p className="site-kicker">Top friction patterns</p>
            <ul>
              {result.patterns.map((q) => (
                <li key={q.id}>
                  <strong>{q.pattern}.</strong> {q.action}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="site-small">{DIAGNOSTIC_LABEL}</p>
      </div>
      <div className="tool-actions">
        <button
          type="button"
          className="site-button"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setSaid('Copied.')).catch(() => setSaid('Could not copy; select the text and copy it yourself.'));
          }}
        >
          Copy the action brief
        </button>
        <span className="site-small">{said}</span>
      </div>
      <pre className="tool-agenda">{text}</pre>
    </div>
  );
}

// ── stack consolidation ───────────────────────────────────────────────────

const STACK_COLS = [
  ['annualCost', 'Current cost per year ($)'],
  ['contractEnds', 'Contract ends after year'],
  ['readyYear', 'Replacement available from year'],
  ['semesterAnnual', 'Semester price per year ($, your quote)'],
  ['migrationOnce', 'One-time migration ($)'],
  ['adminHours', 'Admin hours freed per year'],
] as const;
type StackCol = (typeof STACK_COLS)[number][0];
type StackVals = Record<string, Record<StackCol, string>>;

const blankStack = (): StackVals =>
  Object.fromEntries(CORE_MODULES.map((m) => [m.id, Object.fromEntries(STACK_COLS.map(([k]) => [k, ''])) as Record<StackCol, string>]));

/** Thousands separators without asking the locale: the figures are US dollars, and the server and the client must print the same characters. */
const grouped = (n: number) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const dollars = (n: number) => `${n < 0 && Math.round(n) !== 0 ? '−' : ''}$${grouped(n)}`;

export function StackTool({ statuses = {} }: Pick<ToolProps, 'statuses'>) {
  const [type, setType] = useState('public4');
  const [esc, setEsc] = useState('0');
  const [vals, setVals] = useState<StackVals>(blankStack);
  const [illus, setIllus] = useState(false);

  const input = {
    escalation: esc,
    rows: CORE_MODULES.map((m) => ({ id: m.id, name: m.name, ...vals[m.id] })),
  };
  const r = stackCalc(input);
  const entered = r.rows.filter((x) => x.annual > 0);
  const blocked = entered.filter((x) => x.switchYear === null);
  const notAvailable = CORE_MODULES.filter((m) => (statuses[m.id] ?? 'Planned') !== 'Available now').length;

  const set = (id: string, col: StackCol, v: string) => {
    setIllus(false);
    setVals((prev) => ({ ...prev, [id]: { ...prev[id], [col]: v } }));
  };
  const fill = () => {
    const ex = exampleRow(INSTITUTION_TYPES.find((t) => t.id === type)?.scale ?? 1);
    setVals(Object.fromEntries(CORE_MODULES.map((m) => [m.id, Object.fromEntries(STACK_COLS.map(([k]) => [k, String(ex[k])])) as Record<StackCol, string>])));
    setIllus(true);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([stackCsv(input, r, statuses)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'semester-stack-comparison.csv';
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tool">
      <p className="site-small">
        One row per system Semester Core is planned to take over. Enter what you pay today, when each contract ends, and the year you
        would assume Semester’s replacement is available. A system counts as switched off only when both are true, and only if you
        enter a Semester price from a quote: Semester has no published institutional price.
      </p>
      <div className="tool-grid">
        <label className="tool-field">
          <span>Institution type (sets only the illustrative example)</span>
          <select className="tool-input" value={type} onChange={(e) => setType(e.target.value)}>
            {INSTITUTION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="tool-field">
          <span>Yearly price increase on current systems (%)</span>
          <input className="tool-input" inputMode="decimal" value={esc} onChange={(e) => { setIllus(false); setEsc(e.target.value); }} />
        </label>
      </div>
      <div className="tool-actions">
        <button type="button" className="site-button" onClick={fill}>Fill with illustrative numbers</button>
        <button type="button" className="site-button" onClick={() => { setVals(blankStack()); setEsc('0'); setIllus(false); }}>Clear all</button>
      </div>
      <div className="site-scroll">
        <table className="site-table tool-stack">
          <caption>Systems, and what each costs and when it could change</caption>
          <thead>
            <tr>
              <th scope="col">System</th>
              <th scope="col">Semester register</th>
              {STACK_COLS.map(([k, label]) => <th scope="col" key={k}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {CORE_MODULES.map((m) => (
              <tr key={m.id}>
                <th scope="row">{m.name}<br /><span className="site-small">{m.replaces}</span></th>
                <td>{statuses[m.id] ?? 'Planned'}</td>
                {STACK_COLS.map(([k, label]) => (
                  <td key={k}>
                    <input
                      className="tool-input"
                      inputMode="decimal"
                      aria-label={`${m.name}: ${label}`}
                      value={vals[m.id][k]}
                      onChange={(e) => set(m.id, k, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tool-result" role="status" aria-live="polite">
        {illus && <p className="site-badge site-badge-warn">Illustrative numbers: placeholders, not Semester’s prices or any school’s costs.</p>}
        <p className="site-badge site-badge-warn">
          Where Semester’s replacement stands: the register calls {notAvailable} of {CORE_MODULES.length} modules here below “Available now”.
          Semester Core is planned and has set no date; the year you enter is your assumption, not a commitment.
        </p>
        <p className="site-kicker">Planning estimate · five years</p>
        {entered.length === 0 ? (
          <p className="tool-answer">Enter what you pay today for at least one system, or use the illustrative numbers, to see a comparison.</p>
        ) : r.switched === 0 ? (
          <>
            <p className="tool-answer">$0 saved: no system is switched off on these inputs.</p>
            <ul>{blocked.map((x) => <li key={x.id}>{x.name}: {x.why}</li>)}</ul>
          </>
        ) : (
          <>
            <p className="tool-answer">
              {dollars(r.totalSaving)} {r.totalSaving >= 0 ? 'saved' : 'more than today'} over five years on these inputs.
            </p>
            <ul>
              <li>Current stack: {dollars(r.totalCurrent)}. With Semester: {dollars(r.totalWith)}.</li>
              <li>Payback: {r.paybackMonth === null ? `not within ${HORIZON} years` : `month ${r.paybackMonth} (year ${Math.ceil(r.paybackMonth / 12)})`}.</li>
              <li>Systems switched off: {r.switched} of {entered.length} with a cost entered.</li>
              <li>Admin hours freed: {grouped(r.hoursTotal)} over five years (your figure).</li>
            </ul>
            <div className="site-scroll">
              <table className="site-table">
                <caption>Year by year</caption>
                <thead><tr><th scope="col">Year</th><th scope="col">Current systems</th><th scope="col">With Semester</th><th scope="col">Saving</th><th scope="col">Cumulative</th></tr></thead>
                <tbody>
                  {r.years.map((y) => (
                    <tr key={y.year}>
                      <th scope="row">{y.year}</th>
                      <td>{dollars(y.current)}</td>
                      <td>{dollars(y.withSemester)}</td>
                      <td>{dollars(y.saving)}</td>
                      <td>{dollars(y.cumulative)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="site-scroll">
              <table className="site-table">
                <caption>Consolidation timeline: when each system is switched off</caption>
                <thead><tr><th scope="col">System</th><th scope="col">Contract ends after</th><th scope="col">Replacement from</th><th scope="col">Switched off</th></tr></thead>
                <tbody>
                  {entered.map((x) => (
                    <tr key={x.id}>
                      <th scope="row">{x.name}<br /><span className="site-small">Register: {statuses[x.id] ?? 'Planned'}</span></th>
                      <td>{x.contractEnds ? `year ${x.contractEnds}` : 'no contract'}</td>
                      <td>{x.ready === null ? 'not entered' : `year ${x.ready}`}</td>
                      <td>{x.switchYear === null ? `Not within ${HORIZON} years: ${x.why}` : `Year ${x.switchYear}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="site-kicker">Method</p>
        <p className="site-small">
          Each year, current systems cost what you pay today, raised by the yearly increase you enter. With Semester, a system still
          running costs the same; a system already switched off costs Semester’s price for it, plus its one-time migration in the year
          it is switched. A system is switched off in the later of the year after its contract ends and the year its replacement is
          available. A switch-off after year {HORIZON}, or with no Semester price entered, is not counted. Saving is current minus with
          Semester. Payback is the first month the cumulative saving reaches zero, interpolated within the year.
        </p>
        <p className="site-kicker">Assumptions</p>
        <ul className="site-small">
          <li>Semester’s price is yours, from a quote. Semester has no published institutional price.</li>
          <li>The year each replacement is available is yours. The register’s word for every module is shown beside it.</li>
          <li>Costs are in today’s dollars apart from the increase you enter; nothing is discounted.</li>
          <li>No cost of running both systems at once is included unless you put it in the one-time migration.</li>
          <li>Admin hours freed are your figure, not a Semester benchmark.</li>
        </ul>
        <p className="site-kicker">Limits</p>
        <p className="site-small">
          A planning estimate from your inputs, not a quote, a forecast or a guarantee. It ignores contract penalties, taxes, staff
          turnover and anything you do not enter. Semester Core is planned; none of these modules is built.
        </p>
      </div>
      <div className="tool-actions">
        <button type="button" className="site-button" onClick={download}>Download CSV</button>
        <button type="button" className="site-button" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
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
      {id === 'navigation' && <NavigationTool />}
      {id === 'stack' && <StackTool statuses={props.statuses} />}
      <p className="site-small">{EPHEMERAL}</p>
    </>
  );
}
