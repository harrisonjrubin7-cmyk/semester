import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNow, useStore } from '../state/store';
import type { Look, ScreenContext } from './shape';
import type { Screen } from '../lib/types';

/**
 * The assistant's own state, mounted once above the router.
 *
 * One assistant, in the shell. Not a screen you navigate to and not a
 * component a screen renders — a chat window written inside a screen file is
 * a second assistant, and two assistants that disagree about what is on
 * screen is worse than one that is sometimes wrong.
 *
 * ## Why it does not re-render on every state change
 *
 * The obvious build calls `useStore()` here and recomputes the context on
 * every action. That would put a full context assembly — four courses, every
 * grading row, every deadline — behind every tick of a checkbox and every
 * keystroke in a note.
 *
 * It does not need to. A context is a pure function of state, so it can be
 * computed at the moment it is used: when the sheet opens, and when a
 * question is sent. So the live store is held in a ref, kept current by a
 * bridge that renders nothing, and the only thing that re-renders this tree
 * is the screen changing — which is the one state change the assistant's own
 * surface actually reflects.
 */


interface AI {
  open: boolean;
  /** Open the sheet, optionally with a question already in the box. */
  show: (seed?: string) => void;
  hide: () => void;
  /**
   * Whatever had focus when the sheet was opened, for giving it back.
   *
   * Recorded here rather than by the panel, and the difference is the whole
   * bug. The panel captured `document.activeElement` when it mounted — by
   * which time the composer inside it had already focused itself, because
   * child effects run before the parent's. So the panel remembered the box it
   * was about to unmount, restoring focus to a detached node put it on
   * `<body>`, and a keyboard reader who pressed Escape was returned to the top
   * of the document.
   *
   * `show()` is the only moment the answer is still true, and it is one place
   * because every way in goes through it: the button, Cmd+K, and a selection.
   *
   * It may be detached by the time it is wanted — the button unmounts while
   * the sheet is open, so the common case *is* a dead node. `Assistant.tsx`
   * checks `isConnected` and falls back to the button it has just re-rendered.
   */
  cameFrom: () => HTMLElement | null;
  /** The screen the assistant is currently on, for the button's own name. */
  screen: Screen;
  /**
   * The live store, or null before the bridge has handed one up.
   *
   * Raw, because assembling it reaches every screen's provider and that is
   * 7,543 lines this file must not import — `AIProvider` is mounted above the
   * router, so what it imports, every student parses before the first render.
   * `ai/assemble.ts` turns these two into an `Assembled`, and everything that
   * calls it is already behind the panel's chunk or the Ask tab's.
   */
  live: () => Look | null;
  /** Context registered by whatever is mounted right now. */
  registered: () => ScreenContext[];
  /**
   * Register context while a component is mounted.
   *
   * How an open row or a modal adds its own detail without the screen's
   * provider having to know it exists. Returns the unregister.
   */
  register: (id: string, ctx: ScreenContext) => () => void;
  /** Drop anything registered by a long press or a selection. */
  forgetAbout: () => void;
}

const Ctx = createContext<AI | null>(null);

/**
 * What the assistant reads, without subscribing this tree to it.
 *
 * Renders null. Its only job is to keep the ref current, which it can do on
 * every store change without costing anything, because nothing below it
 * re-renders when it does.
 */
function Bridge({ onLive, onScreen }: { onLive: (l: Look) => void; onScreen: (s: Screen) => void }) {
  const { state, catalog } = useStore();
  const now = useNow();
  /*
   * Handed up after the render commits, rather than written during it.
   *
   * Two things this avoids. Assigning to a ref in a render body is wrong
   * under a render React discards — the ref would keep state from a render
   * that never committed. And passing the ref down to be mutated makes the
   * owner of the value the component that does not own it; a callback puts
   * the write back where the value lives.
   *
   * Nothing reads it until the student opens the sheet or sends a question,
   * both long after this has run, so being correct here costs nothing.
   */
  useEffect(() => {
    onLive({ state, catalog, now });
  }, [onLive, state, catalog, now]);
  // The one thing the assistant's own surface reflects: which screen it is
  // on, for the button's accessible name and the sheet's header.
  useEffect(() => {
    onScreen(state.screen);
  }, [state.screen, onScreen]);
  return null;
}

export function AIProvider({ children }: { children: ReactNode }) {
  const live = useRef<Look | null>(null);
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  /** What a caller asked to start with — a long-press, a suggestion chip. */
  const [seeded, setSeeded] = useState('');
  /** What had focus when the sheet was opened. See `cameFrom` on the type. */
  const cameFrom = useRef<HTMLElement | null>(null);
  /** Context registered by components that are mounted right now. */
  const extra = useRef(new Map<string, ScreenContext>());

  const onScreen = useCallback((s: Screen) => setScreen(s), []);
  const onLive = useCallback((l: Look) => {
    live.current = l;
  }, []);

  const readCameFrom = useCallback(() => cameFrom.current, []);
  const readLive = useCallback(() => live.current, []);
  const readRegistered = useCallback(() => [...extra.current.values()], []);

  const register = useCallback((id: string, ctx: ScreenContext) => {
    extra.current.set(id, ctx);
    return () => {
      extra.current.delete(id);
    };
  }, []);

  /**
   * Forget anything registered about one particular thing.
   *
   * `useAIContext` unregisters on unmount, which is right for a modal or an
   * expanded row: the thing is gone, so its context should be. A long press
   * has no such moment — the row it was about is still on screen when the
   * sheet closes — so without this, holding one deadline and then asking a
   * general question would answer with that deadline still attached, and the
   * header would say so while the student had forgotten they ever held it.
   *
   * Cleared when the sheet closes, and again when it opens, because either
   * end of that is a new question.
   */
  const forgetAbout = useCallback(() => {
    for (const key of [...extra.current.keys()]) {
      if (key.startsWith('about:')) extra.current.delete(key);
    }
  }, []);

  const value = useMemo<AI>(
    () => ({
      open,
      show: (seed?: string) => {
        // Before the state change, because the state change is what unmounts
        // the button that is usually the answer.
        cameFrom.current = document.activeElement as HTMLElement | null;
        if (seed !== undefined) setSeeded(seed);
        setOpen(true);
      },
      hide: () => {
        forgetAbout();
        setOpen(false);
      },
      forgetAbout,
      cameFrom: readCameFrom,
      screen,
      live: readLive,
      registered: readRegistered,
      register,
    }),
    [open, screen, readCameFrom, readLive, readRegistered, register, forgetAbout],
  );

  return (
    <Ctx.Provider value={value}>
      <Bridge onLive={onLive} onScreen={onScreen} />
      <Seed.Provider value={{ seeded, clear: () => setSeeded('') }}>{children}</Seed.Provider>
    </Ctx.Provider>
  );
}

/** The seed is its own context so taking it does not re-render the whole tree. */
const Seed = createContext<{ seeded: string; clear: () => void }>({ seeded: '', clear: () => {} });

export function useSeed() {
  return useContext(Seed);
}

export function useAI(): AI {
  const ai = useContext(Ctx);
  if (!ai) throw new Error('useAI outside AIProvider');
  return ai;
}

/* A `useAIContext(id, ctx)` hook stood here to register context for a
 * component's lifetime. The screens that register context call `register`
 * directly inside their own effects — `components/Insights.tsx`,
 * `ai/AskAbout.tsx` — so this was a second door onto `register` that none of
 * them took. */
