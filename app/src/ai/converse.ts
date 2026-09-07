import { useCallback, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { ask, provider, settings, type Turn } from '../lib/claude';
import { build as buildContext } from '../lib/context';
import { build as guidebook } from '../lib/guidebook';
import { readMode, type Mode } from '../lib/mode';
import { answerLocally, type Local } from '../lib/localask';
import { clear as clearLog, load as loadLog, save as saveLog } from '../lib/chatlog';
import { monthStart, read as readSpend, record, since, total } from '../lib/spend';
import { proposalsLine, readProposal, TOOLS, undoFor, type Known, type Lists, type Proposal } from '../lib/tools';
import { currentLook } from '../state/shape';
import { datedItems } from '../lib/select';
import { useTrouble } from '../lib/trouble';
import { useAI } from './store';

/**
 * The conversation itself, once, for whoever is showing it.
 *
 * The rule the brief states first — one assistant, and if you find yourself
 * writing chat UI inside a screen file, stop — is only enforceable if there
 * is one place the conversation lives. This is that place: the turns, the
 * request, the proposals, the undo, the local answer and the meter. The sheet
 * renders it; so does the older Ask screen, which is how there is one
 * assistant rather than two that disagree.
 *
 * It is a hook rather than a context because there is exactly one consumer at
 * a time and the state is genuinely local to whoever is showing the sheet.
 * The conversation survives across screens because it is written to
 * `lib/chatlog.ts`, not because it lives in a provider.
 */

export interface Conversation {
  turns: Turn[];
  streaming: string;
  busy: boolean;
  /** What the last question was read as. Shown, never hidden. */
  mode: Mode | null;
  /** Which of your records the last answer drew on. */
  used: string[];
  /** What the app itself could say, with no request behind it. */
  locally: Local | null;
  /** Offers waiting on a tap. Nothing here has happened. */
  proposals: Proposal[];
  /** What has been run, and how to take each one back. */
  applied: { p: Proposal; before: Lists }[];
  /** The line above the proposals, saying nothing has happened yet. */
  proposalsLine: string;
  /** This month's spend, as one line, or empty when nothing was measured. */
  cost: { asks: number; tokens: number; dollars: number; unpriced: number };
  said: string;
  again: (() => void) | null;
  send: (text: string) => Promise<void>;
  stop: () => void;
  run: (p: Proposal) => void;
  takeBack: (entry: { p: Proposal; before: Lists }) => void;
  clear: () => void;
  /** Dismiss one offer without running it. */
  dismiss: (id: string) => void;
}

export function useConversation(): Conversation {
  const { state, dispatch, now, catalog } = useStore();
  const ai = useAI();
  const trouble = useTrouble();

  const [turns, setTurns] = useState<Turn[]>(() => loadLog()?.turns ?? []);
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [used, setUsed] = useState<string[]>([]);
  const [locally, setLocally] = useState<Local | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [applied, setApplied] = useState<{ p: Proposal; before: Lists }[]>([]);
  const [spend, setSpend] = useState(() => readSpend());
  const abort = useRef<AbortController | null>(null);

  /**
   * What the app holds, for checking a tool call against reality.
   *
   * Nothing here is sent. This is the app checking the model's arguments,
   * which is a different job from deciding what leaves — that is
   * `lib/context.ts` and only that.
   */
  const held: Known = useMemo(
    () => ({
      deadlines: datedItems(catalog, now)
        .filter((i) => !i.isPast)
        .slice(0, 40)
        .map((i) => ({ id: i.id, title: i.title })),
      tasks: state.tasks.map((t) => ({ id: t.id, title: t.title, date: t.date })),
      courses: catalog.courses.map((c) => ({ id: c.id, code: catalog.byId[c.id].code })),
      attendance: state.attendance,
      look: currentLook(state),
      applications: state.applications.map((a) => ({
        id: a.id,
        org: a.org,
        role: a.role,
        stage: a.stage,
        next: a.next,
        nextBy: a.nextBy,
      })),
      dayBudget: state.dayBudget,
    }),
    [state, catalog, now],
  );

  const lists = useCallback(
    (): Lists => ({
      tasks: state.tasks,
      notes: state.notes,
      sources: state.sources,
      applications: state.applications,
      timers: state.timers,
    }),
    [state],
  );

  const remember = useCallback((next: Turn[]) => {
    setTurns(next);
    saveLog({ turns: next, at: Date.now(), courseId: null });
  }, []);

  /**
   * What the app itself can say about the app, before anything is sent.
   *
   * Runs on every question, not only the ones the mode reader calls app
   * questions: gating it on the mode meant it never fired on "where is the
   * meal plan", which is the plainest app question there is. The threshold
   * moves instead.
   */
  const localFor = (text: string, read: Mode): Local | null => {
    const found = answerLocally(text);
    if (!found) return null;
    if (read === 'app') return found;
    return (found.matches[0]?.score ?? 0) >= 1.5 ? found : null;
  };

  const systemFor = useCallback(
    (read: Mode, drawn: string): string => {
      const never =
        'Never describe a feature of this app that is not in the material below. If the app cannot ' +
        'do what is being asked, say so plainly and name the closest thing it can do. ' +
        'Be specific: numbers, names, mechanisms. Short paragraphs, no filler, no restating the ' +
        'question. No exclamation marks.';

      const acting =
        'You have a small set of tools. Nothing you call happens: each one becomes a line the ' +
        'student reads with a button beside it, and they decide. So describe what you are ' +
        'proposing in the future tense, never as done. ' +
        'There is no tool that deletes anything, changes a grade, a dropped score or the grading ' +
        'scale, or moves a date that came from a syllabus. When asked for one of those, say ' +
        'plainly that you cannot and name the screen where they can do it themselves. Never say ' +
        'you have done something you have not.';

      /*
       * No inference about how somebody is feeling.
       *
       * The app holds a workload and a schedule, and those describe a term
       * rather than a person. An assistant that reads "three deadlines and
       * two absences" as burnout is guessing at a mental state from a
       * calendar, in a place with no way to be corrected.
       */
      const bounds =
        'Answer about workload and schedule only. Do not infer or comment on how the student is ' +
        'feeling, their health, or their state of mind — the app holds a timetable, not a person. ' +
        'Where a number rests on part of the picture, say how much of it.';

      if (read === 'app') {
        const book = guidebook();
        const facts = book.sections
          .filter((sec) => ['screens', 'settings', 'keys', 'wrong'].includes(sec.id))
          .map((sec) => `## ${sec.title}\n${sec.body}`)
          .join('\n\n');
        return (
          'You are answering a question about the study app the student is using. Everything you ' +
          `may say about it is below. ${never}\n\n${facts}`
        );
      }
      if (read === 'grounded') {
        return (
          "You are answering a question about this student's own courses and records, and about " +
          'the screen they are looking at. Answer from what is below and say which part you used. ' +
          'Each deadline carries its id in brackets; use those ids when a tool needs one, and ' +
          `never invent one.\n\n${bounds}\n\n${acting}\n\n${never}\n\n${drawn}`
        );
      }
      return (
        'You are helping a university student. Answer the question they asked, well and directly — ' +
        'a concept, a piece of code, a piece of writing, a decision, whatever it is. Do not narrow ' +
        `it to their coursework and do not refuse because it is not about a course.\n\n` +
        `${bounds}\n\n${acting}\n\n${never}\n\n${drawn}`
      );
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return;
      const next: Turn[] = [...turns, { role: 'user', content: text.trim() }];
      remember(next);
      setStreaming('');
      trouble.clear();
      setProposals([]);
      setBusy(true);
      abort.current = new AbortController();
      let sofar = '';
      try {
        const read = readMode(text);
        setMode(read.mode);
        setLocally(localFor(text, read.mode));

        /*
         * The screen's own account, through the allowlist rather than around it.
         *
         * `ai/providers` decides what a screen is showing; `lib/context.ts`
         * decides whether it may leave. Both are needed and they are
         * different questions — see the note on `build`'s `onScreen`.
         */
        const seen = ai.look();
        const drawn = buildContext(text, read.mode, state, catalog, now, state.screen, seen.text);
        setUsed(drawn.used);

        const reply = await ask({
          system: systemFor(read.mode, drawn.text),
          messages: next,
          /*
           * Room for an answer that also proposes something.
           *
           * The default is 1,400, which was set when this was prose in and
           * prose out. A grounded answer that explains a grade projection and
           * then offers two tool calls spends a good part of that on the
           * calls, and an answer cut off mid-sentence is the one failure a
           * student cannot work around.
           */
          maxTokens: 3000,
          cache: true,
          tools: TOOLS,
          onToolUse: (call) => {
            const p = readProposal(call, held);
            if (!p) return;
            // A view change on the screen you are already looking at runs now:
            // you can see the filter land and see it go, so a card asking
            // permission to narrow the list in front of you is pure friction.
            if (p.sort === 'view' && p.screen === state.screen) {
              if (p.search) dispatch({ type: 'setQuery', query: p.search });
              return;
            }
            setProposals((was) => (was.some((q) => q.id === p.id) ? was : [...was, p]));
          },
          onUsage: (u) => {
            record({ at: Date.now(), model: settings().model, from: state.screen, use: u });
            setSpend(readSpend());
          },
          signal: abort.current.signal,
          onText: (chunk) => {
            sofar += chunk;
            setStreaming(sofar);
          },
        });
        remember([...next, { role: 'assistant', content: reply }]);
      } catch (e) {
        // Pressing Stop is a decision, not a failure. Keep what had arrived.
        if (e instanceof DOMException && e.name === 'AbortError') {
          if (sofar.trim()) remember([...next, { role: 'assistant', content: sofar }]);
        } else {
          trouble.failed(e, () => void send(text));
        }
      } finally {
        setStreaming('');
        setBusy(false);
      }
    },
    [busy, turns, remember, trouble, ai, state, catalog, now, systemFor, held, dispatch],
  );

  const run = useCallback(
    (p: Proposal) => {
      const before = lists();
      dispatch(p.action);
      if (p.sort === 'view' && p.search) dispatch({ type: 'setQuery', query: p.search });
      setProposals((was) => was.filter((q) => q.id !== p.id));
      // A view keeps no row: you are somewhere else now, and going back is the
      // undo. Only writes leave something to take back.
      if (p.sort === 'write') setApplied((was) => [...was, { p, before }]);
    },
    [dispatch, lists],
  );

  const takeBack = useCallback(
    (entry: { p: Proposal; before: Lists }) => {
      const act = entry.p.undo ? undoFor(entry.p.undo, entry.before, lists()) : null;
      if (act) {
        dispatch(act);
        /*
         * And clear the app's own undo, which this would otherwise raise.
         *
         * Taking back an added task dispatches `deleteTask`, which is in
         * `UNDOABLE` — so the global "Task deleted · UNDO" toast came up the
         * instant you pressed Undo here. Two Undo buttons at once, the second
         * offering to undo the first. This removal *is* the undo.
         */
        dispatch({ type: 'forgetUndo' });
      }
      setApplied((was) => was.filter((e) => e.p.id !== entry.p.id));
    },
    [dispatch, lists],
  );

  return {
    turns,
    streaming,
    busy,
    mode,
    used,
    locally,
    proposals,
    applied,
    proposalsLine: proposalsLine(proposals),
    cost: total(since(spend, monthStart(now))),
    said: trouble.said,
    again: trouble.again,
    send,
    stop: () => abort.current?.abort(),
    run,
    takeBack,
    dismiss: (id: string) => setProposals((was) => was.filter((q) => q.id !== id)),
    clear: () => {
      remember([]);
      clearLog();
      setLocally(null);
      setProposals([]);
      setApplied([]);
      setMode(null);
      setUsed([]);
      trouble.clear();
    },
  };
}

/** What to call the thing answering — Claude or GPT, whichever is set. */
export { provider };
