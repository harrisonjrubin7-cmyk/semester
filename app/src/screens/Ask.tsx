import { useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Dictate } from '../components/Dictate';
import { proposalsLine, readProposal, TOOLS, undoFor, type Known, type Lists, type Proposal } from '../lib/tools';
import { currentLook } from '../state/shape';
import { answerLocally, type Local } from '../lib/localask';
import { clear as clearLog, load as loadLog, save as saveLog } from '../lib/chatlog';
import { line as spendLine, monthStart, read as readSpend, record, since, total, money, RATES_READ } from '../lib/spend';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
import { useLive } from '../lib/live';
import { readMode, type Mode } from '../lib/mode';
import { build as buildContext } from '../lib/context';
import { build as guidebook } from '../lib/guidebook';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { datedItems } from '../lib/select';
import { MODELS, ask, configured, makeCards, modelLabel, provider, route, routeLabel, saveSettings, settings, type Turn } from '../lib/claude';
import { OPENAI_MODELS } from '../lib/openai';
import type { CourseId } from '../lib/types';

/**
 * Claude, with the course in front of it.
 *
 * The point is not a chat window. It is that the app already holds the guide,
 * the deadlines and what you are weakest at, so the question "explain hurdle
 * three again" can be answered against this course rather than in general — and
 * that an answer worth keeping becomes cards, which land in Cards, Read, Quiz,
 * Cram and the lesson slides at once.
 */
export function Ask() {
  const { state, dispatch, now, catalog } = useStore();
  const courseId: CourseId = state.guideId;
  const { guide } = useLive(courseId);

  const [config, setConfig] = useState(settings());
  const [showKey, setShowKey] = useState(!configured());
  /**
   * The conversation, restored if there was one.
   *
   * Asking something, tapping into a course to check a date and coming back
   * used to lose the thread — which meant people asked one question and
   * stopped, because the second question in a conversation is usually the
   * good one. See `lib/chatlog.ts` for where it is kept and why not in the
   * main store.
   */
  const [turns, setTurns] = useState<Turn[]>(() => loadLog()?.turns ?? []);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const trouble = useTrouble();
  const [made, setMade] = useState(0);
  /**
   * What Claude has offered to do, waiting on a tap.
   *
   * Cleared at the start of every question: an offer from three turns ago is
   * an offer about a state of the world that has moved on.
   */
  const [proposals, setProposals] = useState<Proposal[]>([]);
  /**
   * What has been run, and how to take each one back.
   *
   * A proposal moves here on the tap rather than disappearing. The row stays
   * on screen saying what changed, past tense, with an Undo beside it — and
   * the `before` it carries is the snapshot the undo is computed against, so
   * "every write is undoable" holds for the row that was actually written.
   */
  const [applied, setApplied] = useState<{ p: Proposal; before: Lists }[]>([]);

  /*
   * Whether the course context is attached at all.
   *
   * The screen used to require a course before it would answer anything,
   * which made "explain price elasticity" a question you had to file under a
   * subject first. It is a filter now: on, the guide goes with the question;
   * off, it does not. Neither is a gate.
   */
  const [scoped, setScoped] = useState(true);
  /** What the last question was read as, shown beside the answer. */
  const [ran, setRan] = useState<Mode | null>(null);
  /** Which of your records the last answer drew on. Shown, never asserted. */
  const [used, setUsed] = useState<string[]>([]);
  /**
   * What the app itself could say about the last question, with no request.
   *
   * Shown above the answer rather than instead of it. A question about a
   * screen has an answer the registry already holds, and the offline path is
   * worth having for the student on a train — but retrieval is retrieval, so
   * it is presented as the screens whose own description matched, not as
   * prose that reads like a verdict. See `lib/localask.ts`.
   */
  const [locally, setLocally] = useState<Local | null>(null);
  /** What the asking has cost. Re-read after each answer. See `lib/spend.ts`. */
  const [spend, setSpend] = useState(() => readSpend());
  /** The last question asked, so a failure can be tried again without retyping. */
  const abort = useRef<AbortController | null>(null);

  /**
   * The deadlines this course still has, with their ids.
   *
   * The ids go into the prompt because a tool call has to name one — and
   * every id that comes back is checked against this same list before it
   * becomes a button, so an invented one produces nothing. See `lib/tools.ts`.
   */
  const dueNow = useMemo(
    () =>
      datedItems(catalog, now)
        .filter((i) => i.c === courseId && !i.isPast)
        .slice(0, 6)
        .map((i) => ({ id: i.id, title: i.title, mon: i.mon, day: i.day, weight: i.weight })),
    [catalog, now, courseId],
  );

  /**
   * What the app actually holds, for checking a tool call against reality.
   *
   * Assembled here and read in `readProposal`, which is the only place a call
   * becomes a button. Nothing in it is sent anywhere — this is the app
   * checking the model's arguments, not context going out. What goes out is
   * `lib/context.ts` and only that.
   */
  const held: Known = useMemo(
    () => ({
      deadlines: dueNow.map((i) => ({ id: i.id, title: i.title })),
      tasks: state.tasks.map((t) => ({ id: t.id, title: t.title, date: t.date })),
      courses: catalog.courses.map((c) => ({ id: c.id, code: catalog.byId[c.id].code })),
      attendance: state.attendance,
      look: currentLook(state),
    }),
    [dueNow, state, catalog],
  );

  /*
   * Written when the conversation changes, and only then.
   *
   * Not in a `useEffect` on every render: this is a localStorage write, and
   * the transcript changes exactly twice per question. Called from the two
   * places that change it, which is also the only way to be sure a save is
   * not silently skipped by a dependency array somebody edits later.
   */
  const remember = (next: Turn[]) => {
    setTurns(next);
    saveLog({ turns: next, at: Date.now(), courseId });
  };

  /** The lists a write can add a row to, snapshotted so an undo is exact. */
  const lists = (): Lists => ({
    tasks: state.tasks,
    notes: state.notes,
    sources: state.sources,
    applications: state.applications,
    timers: state.timers,
  });

  /**
   * Run a proposal, and keep enough to take it back.
   *
   * A view proposal on the screen you are already looking at runs the moment
   * it arrives, further down — nothing is kept by it, and a confirmation for
   * "filter the list you are staring at" is friction with no safety in it.
   * Everything else, including going somewhere else, waits for this.
   */
  const run = (p: Proposal) => {
    const before = lists();
    dispatch(p.action);
    if (p.sort === 'view') {
      const seed = p.search;
      if (seed) dispatch({ type: 'setQuery', query: seed });
    }
    setProposals((was) => was.filter((q) => q.id !== p.id));
    // A view keeps no row: you are on another screen now, and going back is
    // the undo. Only writes leave something to take back.
    if (p.sort === 'write') setApplied((was) => [...was, { p, before }]);
  };

  /**
   * Take one back.
   *
   * `undoFor` compares the lists either side of the write, so an addition
   * undoes to the row that actually appeared rather than the one with a
   * matching title. When it returns nothing the write did not take, and the
   * row says so instead of claiming a success.
   */
  const takeBack = (entry: { p: Proposal; before: Lists }) => {
    const act = entry.p.undo ? undoFor(entry.p.undo, entry.before, lists()) : null;
    if (act) {
      dispatch(act);
      /*
       * And clear the app's own undo, which this would otherwise raise.
       *
       * Taking back an added task dispatches `deleteTask`, which is in
       * `UNDOABLE` — so the global "Task deleted · UNDO" toast came up the
       * instant you pressed Undo here. Two Undo buttons on screen at once,
       * the second offering to undo the first, and the toast reads as though
       * the undo had failed and was being offered again. Pressing it puts the
       * task back, which is the opposite of what anybody wants at that point.
       *
       * The toast is right in general and wrong here: this removal *is* the
       * undo, and a safety net under a safety net is a loop rather than a
       * net. The row it belongs to disappears at the same moment, so nothing
       * is left claiming an offer that no longer stands.
       */
      dispatch({ type: 'forgetUndo' });
    }
    setApplied((was) => was.filter((e) => e.p.id !== entry.p.id));
  };

  // The course, compressed enough to send and specific enough to be useful.
  const context = useMemo(() => {
    const due = dueNow
      .map((i) => `- [${i.id}] ${i.title} · ${i.mon} ${i.day} · ${i.weight}`)
      .join('\n');
    const units = guide.units
      .map(
        (u, i) =>
          `${i + 1}. ${u.name} (${u.mastery}% mastered)\n` +
          u.cards.slice(0, 4).map((c) => `   · ${c.q} — ${c.a}`).join('\n'),
      )
      .join('\n');
    return `${guide.code} — ${guide.name}\n${guide.blurb}\n\nUpcoming:\n${due || '- nothing left'}\n\nUnits:\n${units}`;
  }, [guide, dueNow]);

  /**
   * What the app itself can be said to do, for a question about the app.
   *
   * The registry and the generated guide, and nothing else. This is the
   * boundary that stops an answer inventing a feature: a student told to
   * "enable weekly digests in Settings" concludes the app is broken, and the
   * only defence is that the answer can only name what the registry holds.
   */
  const appFacts = useMemo(() => {
    const book = guidebook();
    return book.sections
      .filter((sec) => ['screens', 'settings', 'keys', 'wrong'].includes(sec.id))
      .map((sec) => `## ${sec.title}\n${sec.body}`)
      .join('\n\n');
  }, []);

  /**
   * One system prompt per mode.
   *
   * The base is the same in all three — be specific, do not invent a feature —
   * and what changes is what is attached and what the answer is expected to
   * rest on. A general question gets no guide and no instruction to prefer
   * one; that is the whole point of the mode existing.
   */
  const systemFor = (mode: Mode, drawn: string): string => {
    const never =
      'Never describe a feature of this app that is not in the material below. If the app cannot ' +
      'do what is being asked, say so plainly and name the closest thing it can do. ' +
      'Be specific: numbers, names, mechanisms. Short paragraphs, no filler, no restating the ' +
      'question. No exclamation marks.';

    /*
     * What the tools are, said in the prompt as well as in the schema.
     *
     * The schema stops a bad call; this stops a bad *sentence*. Without it the
     * honest failure — "I have removed that course for you" — reads exactly
     * like a success, because nothing on screen contradicts it. Saying what
     * there is no tool for is the half that matters.
     */
    const acting =
      'You have a small set of tools. Nothing you call happens: each one becomes a line the ' +
      'student reads with a button beside it, and they decide. So describe what you are ' +
      'proposing in the future tense, never as done. ' +
      'There is no tool that deletes anything, changes a grade, a dropped score or the grading ' +
      'scale, or moves a date that came from a syllabus. When asked for one of those, say plainly ' +
      'that you cannot and name the screen where they can do it themselves. Never say you have ' +
      'done something you have not.';

    if (mode === 'app') {
      return (
        'You are answering a question about the study app the student is using. Everything you ' +
        'may say about it is below — the screens it has, its settings, its shortcuts. ' +
        `${never}\n\n${appFacts}`
      );
    }
    if (mode === 'grounded') {
      return (
        'You are answering a question about this student\'s own courses and records. Answer from ' +
        'what is below and say which part you used. Where a number rests on part of the picture, ' +
        'say how much of it — "3 of 8 quizzes graded, so this is partial". Do not estimate a ' +
        'number the records do not support. ' +
        'Each deadline carries its id in brackets; use those ids when a tool needs one, and never ' +
        'invent one. Offer a tool only when the student has asked for the thing it does.\n\n' +
        `${acting}\n\n${never}\n\n${drawn}`
      );
    }
    return (
      'You are helping a university student. Answer the question they asked, well and directly — ' +
      'a concept, a piece of code, a piece of writing, a decision, whatever it is. Do not narrow ' +
      'it to their coursework and do not refuse because it is not about a course. ' +
      `${acting}\n\n${never}\n\n${drawn}`
    );
  };

  /**
   * What the app can say about itself for this question, if anything.
   *
   * The threshold, not the mode, is what decides. See the note at the call
   * site for why the mode reader is the wrong gate.
   */
  const localFor = (text: string, mode: Mode): Local | null => {
    const found = answerLocally(text);
    if (!found) return null;
    if (mode === 'app') return found;
    /*
     * A word in common is not a question about a screen.
     *
     * The bar is the score alone, never "but a guide line matched" — a guide
     * line will match almost any question with two ordinary words in it, and
     * an escape hatch on the threshold is the threshold not existing.
     * Three points is one question word landing on a screen's own label;
     * half that is the least this should ever show unasked.
     */
    return (found.matches[0]?.score ?? 0) >= 1.5 ? found : null;
  };

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next: Turn[] = [...turns, { role: 'user', content: text.trim() }];
    remember(next);
    setDraft('');
    setStreaming('');
    trouble.clear();
    setProposals([]);
    setBusy(true);
    abort.current = new AbortController();
    let sofar = '';
    try {
      const read = readMode(text);
      setRan(read.mode);
      /*
       * The app's own answer first, on every question — not only on the ones
       * the mode reader calls app questions.
       *
       * Gating it on `mode === 'app'` looked right and was wrong the first
       * time it ran: "where is the meal plan" is read as a general question,
       * because the app shape deliberately requires an operating verb, and so
       * the offline path never fired on the plainest app question there is.
       * The mode reader is tuned for what to *attach*, which is a different
       * question from what the app can answer about itself.
       *
       * So it runs on everything and the bar moves instead. On a question the
       * mode reader did call an app question, a list of candidates is useful
       * even when the ranking is loose. On anything else only a strong match
       * is worth showing, because "explain price elasticity" must not come
       * back with a row about the Costs screen.
       */
      setLocally(localFor(text, read.mode));
      /*
       * Assembled per question, by the one function allowed to decide it.
       *
       * The screen used to build its own context from the open guide, which
       * meant the boundary on what leaves the device was wherever somebody
       * last edited a template string. `lib/context.ts` is that decision in
       * one readable place, with an allowlist, and it is the only thing that
       * decides it. See its header.
       */
      const drawn = buildContext(text, read.mode, state, catalog, now, state.screen);
      setUsed(drawn.used);
      const reply = await ask({
        system: systemFor(read.mode, drawn.text),
        messages: next,
        // Every question about this course opens with the same guide. Caching
        // is a prefix match, so the saving is real only because `context`
        // holds absolute dates rather than "in three days" — a relative time
        // would rewrite the prompt every thirty seconds and quietly cost the
        // whole thing. A short course will not reach the minimum cacheable
        // length and simply will not cache, which costs nothing.
        cache: true,
        // Proposals only. `readProposal` re-checks every argument against
        // what the app actually holds, and nothing runs until it is tapped.
        // See `lib/tools.ts`.
        tools: TOOLS,
        onToolUse: (call) => {
          const p = readProposal(call, held);
          if (!p) return;
          /*
           * A view change on the screen you are already looking at runs now.
           *
           * That is the one case where confirming costs something and protects
           * nothing: you can see the filter land and you can see it go, and a
           * card asking permission to narrow the list in front of you is pure
           * friction. Going *somewhere else* is not that — it takes you off a
           * half-read answer — so it stays a tap like everything else.
           */
          if (p.sort === 'view' && p.screen === state.screen) {
            if (p.search) dispatch({ type: 'setQuery', query: p.search });
            return;
          }
          setProposals((was) => (was.some((q) => q.id === p.id) ? was : [...was, p]));
        },
        signal: abort.current.signal,
        // What it cost, as the API reported it. Silent where nothing was
        // reported — a proxy that strips the block, the OpenAI route — so the
        // meter can tell "free" from "not measured". See `lib/spend.ts`.
        onUsage: (u) => {
          record({ at: Date.now(), model: settings().model, from: 'ask', use: u });
          setSpend(readSpend());
        },
        onText: (chunk) => {
          sofar += chunk;
          setStreaming(sofar);
        },
      });
      remember([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      // Pressing Stop is a decision, not a failure. Keep what had arrived —
      // half an answer you asked to cut short is still worth reading.
      if (e instanceof DOMException && e.name === 'AbortError') {
        if (sofar.trim()) remember([...next, { role: 'assistant', content: sofar }]);
      } else {
        // `send` here is the one from the render that failed, so it still
        // closes over the transcript as it was *before* this question was
        // appended. Calling it again re-appends the same turn rather than
        // stacking a second copy of it.
        trouble.failed(e, () => void send(text));
      }
    } finally {
      setStreaming('');
      setBusy(false);
    }
  };

  /** Turn the last answer into cards on this course. */
  const keep = async () => {
    const last = turns.filter((t) => t.role === 'assistant').at(-1);
    if (!last || busy) return;
    setBusy(true);
    trouble.clear();
    try {
      const cards = await makeCards(last.content, context);
      if (cards.length === 0) {
        // Not a failure to retry: the answer is prose that does not break
        // into questions, and asking again would cost a request to be told so
        // a second time.
        trouble.wrong('Nothing in that answer made a clean card. Nothing was added.');
        return;
      }
      dispatch({
        type: 'addUpdate',
        update: {
          courseId,
          unit: null,
          title: 'From a question you asked',
          // Recorded on the material so a card's origin is still readable in a
          // month, whichever provider was answering when it was made.
          source: provider(),
          body: '',
          cards,
          terms: [],
          fileIds: [],
        },
      });
      setMade(cards.length);
    } catch (e) {
      trouble.failed(e, () => void keep());
    } finally {
      setBusy(false);
    }
  };

  const weakest = guide.units.reduce((a, b) => (b.mastery < a.mastery ? b : a), guide.units[0]);

  return (
    <div style={{ padding: 18 }}>
      {/*
        The course is a filter, not a gate.

        Tapping the course you are already on turns the scope off, which is
        how you ask something that has nothing to do with a course without
        first having to file it under one.
      */}
      <div className="chiprow">
        <div style={{ display: 'flex', gap: 6 }}>
          {catalog.courses.map((c) => {
            const on = scoped && c.id === courseId;
            return (
              <button
                key={c.id}
                type="button"
                className="btn"
                onClick={() => {
                  if (c.id === courseId) {
                    setScoped(!scoped);
                    return;
                  }
                  setScoped(true);
                  dispatch({ type: 'openGuide', id: c.id, mode: state.mode });
                }}
                aria-pressed={on}
                style={{
                  flex: 'none',
                  padding: '5px 11px',
                  fontSize: 'calc(11px * var(--text-scale, 1))',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  background: on ? 'var(--chrome)' : 'transparent',
                  color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
                  borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                }}
              >
                {catalog.byId[c.id].code.split(/\s+/)[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* What the last answer was drawn from. Never a mystery — an answer
          whose basis is invisible is one nobody can weigh. */}
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--type-xs)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          opacity: 0.55,
          marginTop: 'var(--sp-4)',
        }}
      >
        {/* What it drew on, listed rather than claimed. An answer whose
            basis is invisible is one nobody can weigh. */}
        {ran === 'app'
          ? 'Answered from this app’s own screens'
          : ran === 'grounded'
            ? `Answered from your courses${scoped ? '' : ' — scope is off'}`
            : ran === 'general'
              ? `Answered generally${scoped ? `, with ${guide.code} attached` : ''}`
              : scoped
                ? `${guide.code} is attached. Tap it again to ask about anything else.`
                : 'No course attached. Ask anything.'}
        {used.length > 0 && ran !== 'app' ? ` · ${used.join(', ')}` : ''}
      </div>

      {!configured(config) || showKey ? (
        <Blueprint style={{ padding: 16, marginTop: 14 }}>
          <div className="kicker">Setup</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(19px * var(--text-scale, 1))', marginTop: 5 }}>
            Where the answers come from
          </div>
          <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.78, lineHeight: 1.5, marginTop: 6, textWrap: 'pretty' }}>
            {config.provider === 'openai'
              ? 'Two providers, so a lapsed account or an outage the night before a midterm does not stop the app working. Nothing above this setting knows which one answered.'
              : route() === 'shared'
                ? 'Signed in, so this is already working — the shared key lives in a server function, metered per account, and never reaches this browser. Add your own key below only if you want past the monthly limit.'
                : 'A key typed here is stored on this device and sent only to Anthropic. Be clear-eyed about it: anything running in this browser can read a key in this browser. Signing in uses the shared key instead, and a proxy you run is better still — the proxy field wins when both are filled in.'}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {(
              [
                { id: 'anthropic', label: 'Claude' },
                { id: 'openai', label: 'ChatGPT' },
              ] as const
            ).map((p) => {
              const on = config.provider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="btn"
                  onClick={() => setConfig({ ...config, provider: p.id })}
                  aria-pressed={on}
                  style={{
                    flex: 1,
                    padding: '7px 11px',
                    fontSize: 'calc(11px * var(--text-scale, 1))',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    background: on ? 'var(--chrome)' : 'transparent',
                    color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
                    borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {config.provider === 'openai' ? (
            <>
              <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.75, lineHeight: 1.5, marginTop: 10 }}>
                There is no shared key on this side — the server function holds an Anthropic key
                and nothing else. So this means your own OpenAI key, in this browser, where
                anything running here can read it. It is billable and has no spend cap of its own.
              </div>
              <input
                className="input"
                type="password"
                placeholder="sk-…"
                value={config.openaiKey}
                onChange={(e) => setConfig({ ...config, openaiKey: e.target.value })}
                style={{ fontSize: 'calc(13px * var(--text-scale, 1))', marginTop: 10 }}
                aria-label="OpenAI API key"
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {OPENAI_MODELS.map((m) => {
                  const on = config.openaiModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="btn"
                      onClick={() => setConfig({ ...config, openaiModel: m.id })}
                      aria-pressed={on}
                      style={{
                        padding: '5px 11px',
                        fontSize: 'calc(11px * var(--text-scale, 1))',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        background: on ? 'var(--chrome)' : 'transparent',
                        color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
                        borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 6 }}>
                {OPENAI_MODELS.find((m) => m.id === config.openaiModel)?.note}
                {' '}Extended thinking is Anthropic-only, so the screens that ask for it simply do
                not get it here.
              </div>
            </>
          ) : (
            <>
          <input
            className="input"
            type="password"
            placeholder="sk-ant-…"
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            style={{ fontSize: 'calc(13px * var(--text-scale, 1))', marginTop: 12 }}
            aria-label="API key"
          />
          <input
            className="input"
            placeholder="https://your-proxy.example.com  (better)"
            value={config.proxy}
            onChange={(e) => setConfig({ ...config, proxy: e.target.value })}
            style={{ fontSize: 'calc(13px * var(--text-scale, 1))', marginTop: 8 }}
            aria-label="Proxy URL"
          />

          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {MODELS.map((m) => {
              const on = config.model === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className="btn"
                  onClick={() => setConfig({ ...config, model: m.id })}
                  aria-pressed={on}
                  style={{
                    padding: '5px 11px',
                    fontSize: 'calc(11px * var(--text-scale, 1))',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    background: on ? 'var(--chrome)' : 'transparent',
                    color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
                    borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 6 }}>
            {MODELS.find((m) => m.id === config.model)?.note}
          </div>
            </>
          )}

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              saveSettings(config);
              setShowKey(false);
            }}
            style={{
              height: 44,
              fontSize: 'calc(13px * var(--text-scale, 1))',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginTop: 12,
            }}
          >
            Save on this device
          </button>
        </Blueprint>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 14,
          }}
        >
          <div className="kicker">
            {guide.code} · {modelLabel()} · {routeLabel()}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
            {turns.length > 0 && (
              <button
                type="button"
                className="bare"
                onClick={() => {
                  remember([]);
                  clearLog();
                  setLocally(null);
                  setProposals([]);
                  setApplied([]);
                  setRan(null);
                  setUsed([]);
                }}
                style={{ flex: 'none', width: 'auto', fontSize: 'var(--type-xs)', opacity: 0.5, letterSpacing: '0.1em' }}
              >
                NEW
              </button>
            )}
            <button
              type="button"
              className="bare"
              onClick={() => setShowKey(true)}
              style={{ flex: 'none', width: 'auto', fontSize: 'var(--type-xs)', opacity: 0.5, letterSpacing: '0.1em' }}
            >
              SETTINGS
            </button>
          </div>
        </div>
      )}

      {turns.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
          {[
            `Explain ${weakest?.name ?? 'the first unit'} as if I have not read it.`,
            'Give me three exam questions on this course and mark my answers as I go.',
            'What is the difference between the two things I keep confusing in this course?',
          ].map((prompt) => (
            <Blueprint
              key={prompt}
              onClick={() => void send(prompt)}
              style={{ padding: '12px 14px', textAlign: 'left', fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.4 }}
            >
              {prompt}
            </Blueprint>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
        {turns.map((t, i) => (
          <div key={i}>
            <div className="kicker" style={{ color: t.role === 'user' ? 'inherit' : 'var(--app-accent)' }}>
              {t.role === 'user' ? 'You' : provider()}
            </div>
            <div
              style={{
                fontSize: 'calc(14px * var(--text-scale, 1))',
                lineHeight: 1.55,
                marginTop: 4,
                whiteSpace: 'pre-wrap',
                opacity: t.role === 'user' ? 0.75 : 1,
                textWrap: 'pretty',
              }}
            >
              {t.content}
            </div>
          </div>
        ))}
        {streaming && (
          <div>
            <div className="kicker" style={{ color: 'var(--app-accent)' }}>
              {provider()}
            </div>
            <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.55, marginTop: 4, whiteSpace: 'pre-wrap' }}>
              {streaming}
            </div>
          </div>
        )}
      </div>

      {/* What the app itself can say, with no request behind it.
          Shown as the screens whose own description matched, not as a
          sentence naming one — a student has no reason to doubt an app
          describing itself, so a confident wrong answer here is the worst
          kind. See `lib/localask.ts`. */}
      {locally && (
        <div style={{ marginTop: 14 }}>
          <div className="kicker">From this app, with nothing sent</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
            {locally.matches.map((m) => (
              <Blueprint
                key={m.screen}
                onClick={() => dispatch({ type: 'go', screen: m.screen })}
                style={{ padding: '10px 12px', textAlign: 'left' }}
              >
                <div style={{ fontSize: 'var(--type-sm)', fontFamily: 'var(--font-heading)' }}>
                  {m.label}
                  <span style={{ opacity: 0.45, fontFamily: 'var(--font-body)' }}> · {m.group}</span>
                </div>
                <div style={{ fontSize: 'var(--type-xs)', opacity: 0.7, lineHeight: 1.45, marginTop: 3, textWrap: 'pretty' }}>
                  {m.blurb}
                </div>
              </Blueprint>
            ))}
            {locally.fromGuide.map((quoted) => (
              <div
                key={quoted}
                style={{
                  fontSize: 'var(--type-xs)',
                  opacity: 0.7,
                  lineHeight: 1.5,
                  paddingLeft: 10,
                  borderLeft: '2px solid var(--app-line)',
                  textWrap: 'pretty',
                }}
              >
                {quoted}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What it has offered to do. Nothing here has happened: each line says
          exactly what its button will change, and the button is the only
          thing that changes it. See `lib/tools.ts`. */}
      {proposals.length > 0 && !busy && (
        <div
          style={{
            marginTop: 14,
            padding: '11px 13px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--app-line)',
            background: 'var(--app-panel)',
          }}
        >
          <div className="kicker">{proposalsLine(proposals)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 9 }}>
            {proposals.map((p) => (
              <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.4 }}>
                  {p.said}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => run(p)}
                  style={{ flex: 'none', height: 34, fontSize: 'calc(12px * var(--text-scale, 1))' }}
                >
                  {p.verb}
                </button>
                <button
                  type="button"
                  className="bare"
                  aria-label={`Dismiss: ${p.said}`}
                  onClick={() => setProposals((was) => was.filter((q) => q.id !== p.id))}
                  style={{ flex: 'none', width: 22, opacity: 0.4, fontSize: 'calc(14px * var(--text-scale, 1))' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What has been done, and how to take it back.
          Every row here changed something, says so in the past tense, and
          keeps its Undo until the next question. See `lib/tools.ts`. */}
      {applied.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
          {applied.map((e) => (
            <div key={e.p.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 'calc(12.5px * var(--text-scale, 1))',
                  lineHeight: 1.4,
                  opacity: 0.75,
                  textWrap: 'pretty',
                }}
              >
                Done — {e.p.did}.
              </span>
              <button
                type="button"
                className="bare"
                onClick={() => takeBack(e)}
                style={{
                  flex: 'none',
                  width: 'auto',
                  fontSize: 'calc(11px * var(--text-scale, 1))',
                  letterSpacing: '0.1em',
                  opacity: 0.7,
                }}
              >
                UNDO
              </button>
            </div>
          ))}
        </div>
      )}

      {/* The question is still the last turn, so asking again is asking the
          same thing — no retyping, and the conversation keeps its shape. */}
      <Trouble said={trouble.said} onRetry={trouble.again} busy={busy} />
      {made > 0 && (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.75, marginTop: 12, lineHeight: 1.45 }}>
          {made} cards added to {guide.code}. They are in Cards, Read, Quiz and Cram now.
        </div>
      )}

      <textarea
        className="input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send(draft);
        }}
        placeholder="Ask anything — a concept, your own deadlines, or how this app works…"
        style={{ minHeight: 84, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.5, marginTop: 16 }}
        aria-label="Your question"
      />
      <Dictate compact current={draft} onText={setDraft} label="Say it instead" />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !draft.trim()}
          onClick={() => void send(draft)}
          style={{ flex: 1, height: 44, fontSize: 'calc(13px * var(--text-scale, 1))', letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          {busy ? 'Thinking…' : 'Ask'}
        </button>
        {busy ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => abort.current?.abort()}
            style={{ height: 44, fontSize: 'calc(12px * var(--text-scale, 1))', letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!turns.some((t) => t.role === 'assistant')}
            onClick={() => void keep()}
            style={{ height: 44, fontSize: 'calc(12px * var(--text-scale, 1))', letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Keep as cards
          </button>
        )}
      </div>

      {/* Two lists, both written from what the code does rather than from
          what the feature was meant to do. The first stopped being true when
          `ask` widened past one course, which is exactly how these go wrong. */}
      {/* What the asking has cost. A key typed into this app is billed to
          the student's own card, and the app spent it silently until now.
          Tokens are the fact; money is a conversion at published rates that
          can go stale, which is why the rates and their date are named. */}
      {spend.length > 0 && (
        <>
          <SectionLabel>What this has cost</SectionLabel>
          <div style={{ fontSize: 'var(--type-sm)', lineHeight: 1.5, textWrap: 'pretty' }}>
            {spendLine(since(spend, monthStart(now)))} this month.
            <span style={{ opacity: 0.6 }}>
              {' '}
              {(() => {
                const t = total(since(spend, monthStart(now)));
                const unpriced = t.unpriced > 0 ? ` ${t.unpriced} of them were answered by a model with no rate here, so the total is short by those.` : '';
                return `Tokens are counted by the API; the money is an estimate at list prices as at ${RATES_READ}, so treat it as a scale rather than a bill.${unpriced}`;
              })()}
            </span>
            {' '}
            <span style={{ opacity: 0.6 }}>All time: {money(total(spend).dollars)}.</span>
          </div>
        </>
      )}

      <SectionLabel>What it can see</SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        Your course codes and today’s date, always. For a question about your own records: the
        deadlines in the window you asked about, and the grades, attendance and unit names for the
        courses you named. Cards travel only when you name one course and ask about its material,
        and then about four thousand characters of them.
        <br />
        <br />
        Never, whatever is asked: your notes, your drafts, your files, anyone in People or Letters,
        and no key or token of any kind. That list is one file — <code>lib/context.ts</code> — and
        it is the only thing that decides what leaves this device.
      </div>

      <SectionLabel>What it can do</SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        Offer to tick off a deadline, add or move one of your own tasks, mark you at a class, start
        a timer, keep a note, add a source, track an application, change the accent, text size,
        background or spacing, or take you to a screen. Nothing happens until you tap it, and
        everything it changes has an Undo beside it.
        <br />
        <br />
        It cannot delete anything, and it cannot touch a grade, a dropped score, the grading scale
        or a date that came from a syllabus. There is no tool for any of those, so it cannot do
        them by accident and cannot do them by being asked.
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}
