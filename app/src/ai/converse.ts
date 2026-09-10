import { useCallback, useEffect, useMemo } from 'react';
import { useStore } from '../state/store';
import { ask, provider, settings, type ToolCall, type Turn } from '../lib/claude';
import type { Usage } from '../lib/spend';
import { build as buildContext } from '../lib/context';
import { readMode, type Mode } from '../lib/mode';
import type { Thread } from '../lib/threads';
import { systemPrompt } from './prompt';
import { answerLocally, type Local } from '../lib/localask';
import { monthStart, read as readSpend, record, since, total } from '../lib/spend';
import { proposalsLine, readProposal, TOOLS, undoFor, type Known, type Lists, type Proposal } from '../lib/tools';
import { isLookup, LOOKUPS, MOST_ROUNDS, runLookups } from '../lib/lookup';
import { currentLook } from '../state/shape';
import { datedItems } from '../lib/select';
import { useTrouble } from '../lib/trouble';
import { useAI } from './store';
import { dropThread, flight, keepTurns, newThread, openThread, sender, setLive, useLive,
  renameThread,
  pinThread,
  openedOn,
  restoreThread,
} from './live';

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
  /** Turns dropped from the middle to stay inside the window. See `Dropped`. */
  dropped: number;
  streaming: string;
  busy: boolean;
  /** What the last question was read as. Shown, never hidden. */
  mode: Mode | null;
  /** Which of your records the last answer drew on. */
  used: string[];
  /** What it is reading right now, while it reads it. Empty the rest of the time. */
  looking: string[];
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
  /** Give one a name of your own. An empty name goes back to the question. */
  rename: (id: string, name: string) => void;
  /** Keep one at the top, and keep it from being dropped for room. */
  pin: (id: string, pinned: boolean) => void;
  /**
   * The ones that have come out of the list, newest first.
   *
   * Almost always empty. The list holds a hundred conversations or a hundred
   * and fifty thousand characters, whichever comes first, and what passes
   * either limit is moved here rather than deleted.
   */
  archived: Thread[];
  /** Put one back in the list, and open it. */
  restore: (id: string) => void;
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
  const { turns, streaming, busy, mode, used, looking, locally, proposals, applied, spend, dropped } =
    live;
  const setStreaming = (v: string) => setLive('streaming', v);
  const setBusy = (v: boolean) => setLive('busy', v);
  const setMode = (v: Mode | null) => setLive('mode', v);
  const setUsed = (v: string[]) => setLive('used', v);
  const setLooking = (v: string[]) => setLive('looking', v);
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
      documents: state.documents,
      sheets: state.sheets,
      equations: state.equations,
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
      /*
       * Where this conversation started, recorded before the question is.
       *
       * Before rather than after, because `remember` is what gives the thread
       * its title and the two belong to the same moment — and because after
       * the answer arrives the student may well be on a different screen.
       * `openedOn` ignores every call but the first.
       */
      openedOn(state.screen);
      remember(next);
      setStreaming('');
      trouble.clear();
      setProposals([]);
      setBusy(true);
      flight.abort = new AbortController();
      let sofar = '';
      /*
       * What the whole question cost, added up rather than filed one row per
       * round.
       *
       * The meter says "2 answers this month", and a question that looked
       * something up used to make that read 2 after one question — two
       * requests, but one answer, and the label is about answers. The dollars
       * are identical either way; what differs is whether the count beside
       * them means anything.
       *
       * Declared out here rather than beside the loop so the `finally` below
       * can reach it: the rounds before a Stop have been paid for too.
       */
      let spent: Usage | null = null;
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
        /** Everything this answer drew on: what travelled, plus what it fetched. */
        const drew = new Set(drawn.used);
        setUsed(drawn.used);

        /*
         * The conversation as the next request will see it, which is not
         * always the conversation on screen.
         *
         * A question that needs something `lib/context.ts` did not send grows
         * two turns per round — the answer's tool calls, and this app's
         * replies to them — and the API requires both to travel. They are
         * kept here rather than in the transcript because they are wire
         * bookkeeping: nobody wants to scroll past "read_grades: ECON 1010"
         * to reread what they were told.
         */
        let sending: Turn[] = next;
        let reply = '';
        /*
         * Whether the answer stopped rather than ended.
         *
         * The stop reasons a reader cannot see for themselves. An answer cut
         * off at the ceiling arrives looking finished — it ends on a full
         * sentence about as often as not — and the transcript already has a
         * way to say otherwise, the same one Stop uses. Without this the
         * model is later sent a truncated answer as though it were complete
         * and reasons on from a conclusion it never reached.
         *
         * `cut` is the same failure arriving a different way: the stream died
         * mid-answer, which on a phone is the ordinary one. `lib/claude.ts`
         * could not tell that from an answer that ended until it was taught
         * to read the closing event, and until then a dropped connection was
         * drawn here as a finished turn.
         */
        let ranOut = false;

        for (let round = 0; ; round += 1) {
          /** Read-only calls this round asked for. See `lib/lookup.ts`. */
          const wants: ToolCall[] = [];
          /*
           * Each round answers for itself.
           *
           * `ranOut` is set from `onStop`, and `lib/claude.ts` calls that only
           * when the stream had something to report — a stream that closes
           * cleanly with nothing to say says nothing, which its own test pins.
           * So a round cut mid-answer set this true, and a later round that
           * closed with `message_stop` and no `stop_reason` left it true: the
           * finished answer was saved `incomplete`, drawn under "Stopped
           * here.", and sent back to the model as a conclusion it never
           * reached — when in fact it had.
           *
           * A normal `end_turn` round did clear it, which is why this needed a
           * stream shape rather than an ordinary one to show up.
           */
          ranOut = false;

          const said = await ask({
            system: systemFor(read.mode, drawn.text),
            messages: sending,
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
            /*
             * Both sets, and they are not the same kind of thing.
             *
             * `TOOLS` are proposals — they change something, so each becomes a
             * card with a button and nothing goes back to the model.
             * `LOOKUPS` read — they change nothing, so they run at once and
             * their answers go back in the next round. `isLookup` is the only
             * thing that decides which branch a call takes, so a tool cannot
             * be quietly in both.
             */
            tools:
              /*
               * Not in app mode, and not once the rounds are spent.
               *
               * App mode answers from the guidebook and nothing else — that
               * narrowness is what stops it inventing a feature, and a model
               * that can pull the student's grades into "where do I set my
               * grade scale" is no longer in the mode the prompt describes.
               * `prompt.test.ts` holds the other half of this.
               */
              read.mode === 'app' || round >= MOST_ROUNDS ? TOOLS : [...TOOLS, ...LOOKUPS],
            onToolUse: (call) => {
              if (isLookup(call.name)) {
                wants.push(call);
                return;
              }
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
              spent = {
                input: (spent?.input ?? 0) + u.input,
                output: (spent?.output ?? 0) + u.output,
                cacheWrite: (spent?.cacheWrite ?? 0) + u.cacheWrite,
                cacheRead: (spent?.cacheRead ?? 0) + u.cacheRead,
              };
            },
            signal: flight.abort.signal,
            onStop: (why) => {
              ranOut = why === 'max_tokens' || why === 'cut';
            },
            onText: (chunk) => {
              // The first word of the round is the end of the pause the
              // lookup line was explaining.
              if (round > 0 && chunk.trim()) setLooking([]);
              sofar += chunk;
              setStreaming(sofar);
            },
          });

          // Whatever it said before asking to read something is kept. It is
          // usually nothing, and where it is not, dropping the model's own
          // words to tidy the transcript is not this app's call to make.
          reply = reply ? `${reply}\n\n${said}`.trim() : said;
          if (wants.length === 0) break;

          /*
           * The lookups, run here and only here.
           *
           * Nothing in `lib/lookup.ts` can dispatch, write or fetch — it takes
           * state and returns strings — which is why these need no
           * confirmation. A card asking permission to read a number the
           * student is looking at on the next screen would protect nobody.
           */
          const found = runLookups(wants, { state, catalog, now });
          for (const u of found.used) drew.add(u);
          setUsed([...drew]);
          sending = [
            ...sending,
            { role: 'assistant', content: said, calls: wants },
            { role: 'user', content: '', results: found.results },
          ];
          // The next round writes after a blank line rather than butting up
          // against the sentence before the lookup.
          if (said.trim()) sofar += '\n\n';
          /*
           * Said while the next round is in flight, not while the lookup runs.
           *
           * Reading state takes no measurable time — the whole of the pause is
           * the second request. Setting this after the read and clearing it on
           * the first word back means the line is on screen for exactly the
           * wait it is explaining, rather than flickering for a millisecond
           * and leaving the real pause unaccounted for.
           */
          setLooking(found.saying);
        }

        remember([
          ...next,
          { role: 'assistant', content: reply, ...(ranOut ? { incomplete: true } : {}) },
        ]);
      } catch (e) {
        // Pressing Stop is a decision, not a failure. Keep what had arrived.
        if (e instanceof DOMException && e.name === 'AbortError') {
          // Kept, and marked. Half an answer is context worth having; half an
          // answer that looks whole is a conclusion the model never reached.
          if (sofar.trim()) {
            remember([...next, { role: 'assistant', content: sofar, incomplete: true }]);
          }
        } else {
          trouble.failed(e, () => void sender.run(text));
        }
      } finally {
        /*
         * In `finally`, so a question stopped between rounds is still counted.
         *
         * The first round has been paid for whether or not the second one
         * finished, and a meter that quietly forgets the rounds before a Stop
         * is a meter that reads low exactly when somebody is watching it
         * because they are worried about the bill.
         */
        if (spent) {
          record({ at: Date.now(), model: settings().model, from: state.screen, use: spent });
          setSpend(readSpend());
        }
        setStreaming('');
        setLooking([]);
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
    looking,
    locally,
    proposals,
    applied,
    proposalsLine: proposalsLine(proposals),
    cost: total(since(spend, monthStart(now))),
    dropped,
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
    rename: renameThread,
    pin: pinThread,
    /*
     * The conversations that came out of the list, and the way back into one.
     *
     * Restoring opens it, which is deliberate and explained on
     * `restoreThread`: `fit` never sheds the open thread, so anything restored
     * without being opened would be archived again by the next save.
     */
    archived: live.archived,
    restore: (id: string) => {
      restoreThread(id);
      trouble.clear();
    },
  };
}

/** What to call the thing answering — Claude or GPT, whichever is set. */
export { provider };
