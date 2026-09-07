import { useCallback, useEffect, useMemo } from 'react';
import { useStore } from '../state/store';
import { ask, provider, settings, type Turn } from '../lib/claude';
import { build as buildContext } from '../lib/context';
import { readMode, type Mode } from '../lib/mode';
import type { Thread } from '../lib/threads';
import { systemPrompt } from './prompt';
import { answerLocally, type Local } from '../lib/localask';
import { monthStart, read as readSpend, record, since, total } from '../lib/spend';
import { proposalsLine, readProposal, TOOLS, undoFor, type Known, type Lists, type Proposal } from '../lib/tools';
import { currentLook } from '../state/shape';
import { datedItems } from '../lib/select';
import { useTrouble } from '../lib/trouble';
import { useAI } from './store';
import { dropThread, flight, keepTurns, newThread, openThread, sender, setLive, useLive } from './live';

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
 * It is a hook, but the state it reads is not the hook's. That distinction is
 * the whole of `ai/live.ts` and it was a bug for a while: hook state belongs
 * to the caller, so while this said "one conversation" the sheet and the full
 * chat each quietly had their own. The turns, the request in flight and
 * everything around them live in that module now, and this reads them.
 *
 * `lib/chatlog.ts` still persists the transcript, for coming back tomorrow.
 * It is not what makes the two surfaces agree — a write on change is not a
 * subscription, and a copy that has already mounted never hears it.
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
  /** Try the failed request again — null when the failure was not that kind. */
  again: (() => void) | null;
  /**
   * The same question, answered again.
   *
   * Distinct from `again`, which is `lib/trouble.ts` offering a retry after a
   * request that failed. This one runs after a request that succeeded and you
   * did not like the answer — a different thing, and conflating them would put
   * a retry button under an answer that was never going to be retried.
   */
  redo: (() => void) | null;
  send: (text: string, from?: Turn[]) => Promise<void>;
  stop: () => void;
  run: (p: Proposal) => void;
  takeBack: (entry: { p: Proposal; before: Lists }) => void;
  /** Start a new conversation, keeping the one you were in. */
  clear: () => void;
  /** Dismiss one offer without running it. */
  dismiss: (id: string) => void;
  /** Every conversation, for the history list. See `lib/threads.ts`. */
  threads: Thread[];
  /** Which of them is on screen. */
  openId: string;
  /** Switch to one already in the list. */
  open: (id: string) => void;
  /** Delete one. Deleting the open one lands on the next newest. */
  drop: (id: string) => void;
}

export function useConversation(): Conversation {
  const { state, dispatch, now, catalog } = useStore();
  const ai = useAI();
  const trouble = useTrouble();

  /*
   * One conversation, not one per surface.
   *
   * This was nine `useState` calls, which meant the sheet and the full chat
   * each had their own — two conversations wearing the same name, each
   * seeded from the saved log at mount and deaf to the other from then on.
   * `ai/live.ts` has the whole account of it. The setters below keep
   * `useState`'s signature so everything downstream is unchanged.
   */
  const live = useLive();
  const { turns, streaming, busy, mode, used, locally, proposals, applied, spend } = live;
  const setStreaming = (v: string) => setLive('streaming', v);
  const setBusy = (v: boolean) => setLive('busy', v);
  const setMode = (v: Mode | null) => setLive('mode', v);
  const setUsed = (v: string[]) => setLive('used', v);
  const setLocally = (v: Local | null) => setLive('locally', v);
  const setProposals = (v: Proposal[] | ((was: Proposal[]) => Proposal[])) =>
    setLive('proposals', v);
  const setApplied = (
    v: { p: Proposal; before: Lists }[] | ((was: { p: Proposal; before: Lists }[]) => { p: Proposal; before: Lists }[]),
  ) => setLive('applied', v);
  const setSpend = (v: ReturnType<typeof readSpend>) => setLive('spend', v);

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

  /*
   * Every change to the transcript goes through the thread store.
   *
   * This used to write `turns` and then write a separate single-conversation
   * key beside it. With threads there is one record and `keepTurns` updates
   * the open thread inside it — the list's title and its "last touched" come
   * off the same write, so a row cannot say one thing while the transcript
   * says another.
   */
  const remember = useCallback((next: Turn[]) => {
    keepTurns(next);
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

  /*
   * The prompt is built in `ai/prompt.ts`, not here.
   *
   * It was a `useCallback` with an empty dependency list — a pure function of
   * its two arguments, wearing a hook's clothes and reachable only from a
   * React render. Out there it can be printed, diffed and run: the voice
   * check in `scripts/voice.mjs` sends the real prompt for the real ten
   * questions, which was not possible while it lived in this closure.
   */
  const systemFor = systemPrompt;

  const send = useCallback(
    /*
     * `from` is which conversation this question is being added to, and
     * defaults to the one on screen.
     *
     * It exists for "ask again", which drops the answer it did not like and
     * the question above it before asking again. Setting state and then
     * calling `send` does not work: `send` closes over `turns` from the render
     * it was created in, so the trimmed list is not the one it appends to and
     * the question comes back twice. Passing the base is the fix, and the only
     * caller that passes one is the retry.
     */
    async (text: string, from?: Turn[]) => {
      if (!text.trim() || busy) return;
      const base = from ?? turns;
      const next: Turn[] = [...base, { role: 'user', content: text.trim() }];
      remember(next);
      setStreaming('');
      trouble.clear();
      setProposals([]);
      setBusy(true);
      flight.abort = new AbortController();
      let sofar = '';
      try {
        const read = readMode(text);
        setMode(read.mode);
        const local = localFor(text, read.mode);
        setLocally(local);

        /*
         * Offline: say so, once, and keep whatever the app could answer itself.
         *
         * `navigator.onLine` is a weak signal — it says the device has a
         * network interface, not that anything is reachable — so it is used
         * only to skip a request that is certain to fail, never to decide
         * that a working connection is broken. A false negative here costs a
         * round trip; the false positive it avoids is a student on a train
         * watching a spinner turn into "failed to fetch".
         */
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          trouble.wrong(
            local
              ? 'No connection, so this is what the app can tell you about itself. Anything else needs one.'
              : 'No connection. Questions about your own records and about the wider world both need one — only questions about this app can be answered offline.',
          );
          setBusy(false);
          return;
        }

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
          signal: flight.abort.signal,
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
          trouble.failed(e, () => void sender.run(text));
        }
      } finally {
        setStreaming('');
        setBusy(false);
      }
    },
    [busy, turns, remember, trouble, ai, state, catalog, now, systemFor, held, dispatch],
  );

  /*
   * Kept current after the render commits, not during it.
   *
   * Writing to a ref in the render body works and is wrong under a render
   * React discards; the retry would then run a `send` closed over state that
   * never shipped. Nothing reads it until a request has already failed and
   * somebody has pressed the button, which is long after this has run.
   */
  useEffect(() => {
    sender.run = send;
  }, [send]);

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
    /*
     * Drops the answer and asks the question again.
     *
     * The last user turn, not a stored "last question": if the turns were
     * trimmed to fit the window, what is on screen is what the model will be
     * sent, and asking again should mean the same conversation rather than a
     * question lifted out of one it no longer has.
     */
    redo:
      busy || turns.length < 2 || turns.at(-1)?.role !== 'assistant'
        ? null
        : () => {
            const asked = turns.at(-2)?.content ?? '';
            void send(asked, turns.slice(0, -2));
          },
    send,
    stop: () => flight.abort?.abort(),
    run,
    takeBack,
    dismiss: (id: string) => setProposals((was) => was.filter((q) => q.id !== id)),
    /*
     * A new conversation, not a deleted one.
     *
     * This emptied the only transcript there was and removed its key, which
     * is why Sunday's revision plan did not survive Tuesday. It now starts a
     * thread and leaves the old one in the list. `newThread` clears the
     * proposals and the undo stack itself — see the note on `cleared`.
     */
    clear: () => {
      newThread();
      trouble.clear();
    },
    threads: live.threads,
    openId: live.openId,
    open: (id: string) => {
      openThread(id);
      trouble.clear();
    },
    drop: dropThread,
  };
}

/** What to call the thing answering — Claude or GPT, whichever is set. */
export { provider };
