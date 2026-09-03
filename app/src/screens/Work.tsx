import { useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { ProjectFile } from '../components/ProjectFile';
import { ChipRow, SectionLabel } from '../components/ui';
import { Check, Plus } from '../components/Icons';
import { extractText } from '../lib/extract';
import { breakDown, critique, type Breakdown } from '../lib/assignment';
import { ask, configured, routeLabel } from '../lib/claude';
import { datedItems } from '../lib/select';
import type { CourseId } from '../lib/types';

type Tab = 'plan' | 'file' | 'draft' | 'ask';

const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'Break it down' },
  { id: 'file', label: 'Project file' },
  { id: 'draft', label: 'Read my draft' },
  { id: 'ask', label: 'Anything else' },
];

/**
 * Assignments, and everything else you want Claude for.
 *
 * The obvious thing to build here would be "paste the instructions, get the
 * assignment". This is not that, and the screen says so once rather than
 * nagging: the app holds real coursework submitted under a real name, and the
 * Honor Code is student-run.
 *
 * What it does is the part marks are actually lost on. Instructions bury three
 * deliverables in a paragraph about margins; the rubric says where the marks
 * are and nobody reads it; the work is left until the night before because it
 * was never broken into steps small enough to start. All three are fixed by
 * reading carefully, which is a thing a model is good at and a tired student
 * at 1am is not.
 */
export function Work() {
  const { state, dispatch, now, catalog } = useStore();
  const courseId: CourseId = state.guideId;
  const { guide } = useLive(courseId);

  const [tab, setTab] = useState<Tab>('plan');
  const [instructions, setInstructions] = useState('');
  const [plan, setPlan] = useState<Breakdown | null>(null);
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(0);
  const [kept, setKept] = useState(false);
  const [read, setRead] = useState('');
  const abort = useRef<AbortController | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const unitNames = useMemo(() => guide.units.map((u) => u.name), [guide]);

  const context = useMemo(() => {
    const due = datedItems(catalog, now)
      .filter((i) => i.c === courseId && !i.isPast)
      .slice(0, 6)
      .map((i) => `- ${i.title} · ${i.mon} ${i.day} · ${i.weight}`)
      .join('\n');
    return (
      `${guide.code} — ${guide.name}\n${guide.blurb}\n\n` +
      `Upcoming:\n${due || '- nothing left'}\n\n` +
      `Units:\n${unitNames.map((u, i) => `${i + 1}. ${u}`).join('\n')}`
    );
  }, [guide, unitNames, courseId, catalog, now]);

  const run = async (fn: (signal: AbortSignal) => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    abort.current = new AbortController();
    try {
      await fn(abort.current.signal);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const upload = async (f: File) => {
    setError('');
    try {
      const got = await extractText(f);
      setInstructions(got.text);
      setRead(`${got.name} · ${got.words} words`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** Every step in the plan becomes a task you will actually see again. */
  const keepSteps = () => {
    if (!plan) return;
    for (const s of plan.steps) {
      dispatch({
        type: 'addTask',
        task: {
          title: s.do,
          date: s.by || plan.due || null,
          time: s.minutes ? `${s.minutes} min` : '',
          note: s.why,
          courseId,
        },
      });
    }
    setSaved(plan.steps.length);
  };

  const keepAsNote = (title: string, body: string) => {
    dispatch({ type: 'keepNote', title, body, courseId });
    setKept(true);
  };

  if (!configured()) {
    return (
      <div style={{ padding: 18 }}>
        <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
          <div className="kicker">Needs Claude</div>
          <div style={{ fontSize: 14, marginTop: 8, lineHeight: 1.5, opacity: 0.8 }}>
            Sign in to use the shared key, or add your own under Ask Claude → Settings. Everything
            else in the app works without it.
          </div>
        </Blueprint>
      </div>
    );
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.45, textWrap: 'pretty' }}>
        Working on {guide.code}. Switch course from Study.
      </div>

      <div style={{ marginTop: 12 }}>
        <ChipRow
          options={TABS.map((t) => t.label)}
          value={TABS.find((t) => t.id === tab)?.label ?? 'Break it down'}
          onChange={(label) => {
            const found = TABS.find((t) => t.label === label);
            if (found) setTab(found.id);
          }}
        />
      </div>

      {/* ── Break it down ──────────────────────────────────────────────── */}
      {tab === 'plan' && (
        <>
          <SectionLabel>The instructions</SectionLabel>
          <div style={{ fontSize: 12.5, opacity: 0.62, lineHeight: 1.5, marginBottom: 10 }}>
            Paste them, or drop the file your professor posted. You get back what is being asked,
            how it is marked, a plan with dates, and the questions worth asking in office hours.
            You do not get the assignment written — that is yours to write.
          </div>

          <textarea
            className="input"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Paste the assignment instructions…"
            rows={7}
            style={{ fontSize: 13.5, lineHeight: 1.5, resize: 'vertical' }}
            aria-label="Assignment instructions"
          />

          <input
            ref={file}
            type="file"
            accept=".pdf,.docx,.txt,.md,.html,text/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = '';
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => file.current?.click()}
              style={{ flex: 'none', padding: '0 14px', height: 40, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Upload
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || instructions.trim().length < 40}
              onClick={() =>
                void run(async (signal) => {
                  setPlan(null);
                  setSaved(0);
                  setPlan(await breakDown(instructions, context, unitNames, signal));
                })
              }
              style={{ flex: 1, height: 40, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              {busy ? 'Reading…' : 'Break it down'}
            </button>
          </div>
          {read && (
            <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 8 }}>Read {read}</div>
          )}

          {plan && <PlanView plan={plan} saved={saved} onKeep={keepSteps} />}
        </>
      )}

      {/* ── Read my draft ──────────────────────────────────────────────── */}
      {tab === 'draft' && (
        <>
          <SectionLabel>Your draft</SectionLabel>
          <div style={{ fontSize: 12.5, opacity: 0.62, lineHeight: 1.5, marginBottom: 10 }}>
            Feedback against the rubric and the course material — what is working, what would move
            the grade most, and anything the guide does not support. Nothing is rewritten for you.
          </div>
          <textarea
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste what you have written so far…"
            rows={10}
            style={{ fontSize: 13.5, lineHeight: 1.5, resize: 'vertical' }}
            aria-label="Your draft"
          />
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={busy || draft.trim().length < 80}
            onClick={() =>
              void run(async (signal) => {
                setFeedback('');
                let sofar = '';
                await critique(draft, instructions, context, (chunk) => {
                  sofar += chunk;
                  setFeedback(sofar);
                }, signal);
              })
            }
            style={{ height: 44, marginTop: 10, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {busy ? 'Reading…' : 'Read it'}
          </button>
          {feedback && (
            <>
              <SectionLabel>Feedback</SectionLabel>
              <Prose text={feedback} />
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => keepAsNote(`Feedback · ${guide.code}`, feedback)}
                disabled={kept}
                style={{ height: 40, marginTop: 12, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                {kept ? 'Saved to Mine → Notes' : 'Keep as a note'}
              </button>
            </>
          )}
        </>
      )}

      {/* ── Anything else ──────────────────────────────────────────────── */}
      {tab === 'file' && <ProjectFile courseId={courseId} course={`${guide.code} — ${guide.name}`} />}

      {tab === 'ask' && (
        <>
          <SectionLabel>What do you need</SectionLabel>
          <div style={{ fontSize: 12.5, opacity: 0.62, lineHeight: 1.5, marginBottom: 10 }}>
            A revision timetable, practice questions, a summary of a reading, an email to a
            professor, an outline of your own argument to react to. This one has {guide.code} in
            front of it, so answers are about your course.
          </div>
          <textarea
            className="input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Write 15 practice questions on the units I am weakest at…"
            rows={4}
            style={{ fontSize: 13.5, lineHeight: 1.5, resize: 'vertical' }}
            aria-label="Your request"
          />
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={busy || !prompt.trim()}
            onClick={() =>
              void run(async (signal) => {
                setOutput('');
                let sofar = '';
                await ask({
                  signal,
                  maxTokens: 2400,
                  system:
                    'You are helping a university student with their own coursework. Be concrete ' +
                    'and use the course material below wherever it applies. If you are asked to ' +
                    'produce work to be submitted for a grade as their own — an essay, a problem ' +
                    'set answer, a lab report — say plainly that you will not, in one sentence, ' +
                    'and offer the version that helps them write it: an outline, the questions to ' +
                    'answer, feedback on what they draft. Never lecture them about it.\n\n' +
                    `The course:\n${context}`,
                  messages: [{ role: 'user', content: prompt }],
                  onText: (chunk) => {
                    sofar += chunk;
                    setOutput(sofar);
                  },
                });
              })
            }
            style={{ height: 44, marginTop: 10, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {busy ? 'Working…' : 'Generate'}
          </button>
          {output && (
            <>
              <SectionLabel>Result</SectionLabel>
              <Prose text={output} />
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => keepAsNote(prompt.slice(0, 60), output)}
                disabled={kept}
                style={{ height: 40, marginTop: 12, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                {kept ? 'Saved to Mine → Notes' : 'Keep as a note'}
              </button>
            </>
          )}
        </>
      )}

      {busy && (
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => abort.current?.abort()}
          style={{ height: 36, marginTop: 10, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}
        >
          Stop
        </button>
      )}

      {error && (
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--app-accent)',
            marginTop: 12,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ fontSize: 11, opacity: 0.4, marginTop: 20, lineHeight: 1.45 }}>
        Going through {routeLabel()}.
        Whatever you submit has to be your own work.
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}

/** Model output, as paragraphs rather than one wall. */
function Prose({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', textWrap: 'pretty' }}>
      {text}
    </div>
  );
}

function PlanView({
  plan,
  saved,
  onKeep,
}: {
  plan: Breakdown;
  saved: number;
  onKeep: () => void;
}) {
  const row = (label: string, body: string, key: string) => (
    <div key={key} style={{ padding: '11px 0', borderBottom: '1px solid var(--app-line)' }}>
      <div style={{ fontSize: 14, lineHeight: 1.3 }}>{label}</div>
      {body && (
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 3, lineHeight: 1.45 }}>{body}</div>
      )}
    </div>
  );

  return (
    <>
      <Blueprint style={{ padding: 15, marginTop: 16, background: 'var(--app-hero)' }}>
        <div className="kicker">What this is</div>
        <div
          className="chrome-text"
          style={{ fontSize: 21, lineHeight: 1.15, marginTop: 6, textWrap: 'pretty' }}
        >
          {plan.title}
        </div>
        {plan.due && (
          <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 5 }}>Due {plan.due}</div>
        )}
      </Blueprint>

      {plan.deliverables.length > 0 && (
        <>
          <SectionLabel>What you hand in</SectionLabel>
          {plan.deliverables.map((d, i) => row(d.what, d.detail, `d${i}`))}
        </>
      )}

      {plan.rubric.length > 0 && (
        <>
          <SectionLabel>How it is marked</SectionLabel>
          {plan.rubric.map((r, i) => (
            <div key={`r${i}`} style={{ padding: '11px 0', borderBottom: '1px solid var(--app-line)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <div style={{ fontSize: 14, flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                  {r.criterion}
                </div>
                {r.weight && (
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 12,
                      color: 'var(--app-accent)',
                      flex: 'none',
                    }}
                  >
                    {r.weight}
                  </div>
                )}
              </div>
              {r.means && (
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 3, lineHeight: 1.45 }}>
                  {r.means}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {plan.steps.length > 0 && (
        <>
          <SectionLabel>A way through it</SectionLabel>
          {plan.steps.map((s, i) => (
            <div key={`s${i}`} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--app-line)' }}>
              <div
                style={{
                  width: 26,
                  flex: 'none',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 20,
                  opacity: 0.4,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, lineHeight: 1.3 }}>{s.do}</div>
                {s.why && (
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 3, lineHeight: 1.45 }}>
                    {s.why}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 10.5,
                    opacity: 0.5,
                    marginTop: 5,
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  {[s.by, s.minutes ? `${s.minutes} min` : ''].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={saved > 0}
            onClick={onKeep}
            style={{
              height: 44,
              marginTop: 12,
              fontSize: 12,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {saved > 0 ? <Check size={14} /> : <Plus size={14} />}
            {saved > 0 ? `${saved} tasks added` : `Add ${plan.steps.length} steps as tasks`}
          </button>
        </>
      )}

      {plan.units.length > 0 && (
        <>
          <SectionLabel>Units this draws on</SectionLabel>
          {plan.units.map((u) => row(u, '', u))}
        </>
      )}

      {plan.checklist.length > 0 && (
        <>
          <SectionLabel>Before you submit</SectionLabel>
          {plan.checklist.map((c, i) => row(c, '', `c${i}`))}
        </>
      )}

      {plan.unclear.length > 0 && (
        <>
          <SectionLabel>Worth asking about</SectionLabel>
          <div style={{ fontSize: 12.5, opacity: 0.6, lineHeight: 1.5, marginBottom: 4 }}>
            The instructions do not settle these. Ask in office hours or on the discussion board —
            getting this right early is worth more than any amount of redrafting.
          </div>
          {plan.unclear.map((q, i) => row(q, '', `q${i}`))}
        </>
      )}
    </>
  );
}
