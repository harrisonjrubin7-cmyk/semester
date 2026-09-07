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
import { useStore } from '../state/store';
import { DESTINATIONS } from '../lib/nav';
import { providerFor } from './providers';
import { render, type Look, type ScreenContext } from './shape';
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

export interface Assembled {
  screen: Screen;
  /** What the screen is called, for the sheet header and the button's name. */
  label: string;
  /** The screen's own account of itself, or null when it has no provider. */
  own: ScreenContext | null;
  /** Extra context registered by whatever is mounted — a modal, an open row. */
  extra: ScreenContext[];
  /** Exactly what would be sent about this screen. Shown on demand. */
  text: string;
  /** Rows that did not fit. Said out loud rather than silently cut. */
  dropped: number;
}

interface AI {
  open: boolean;
  /** Open the sheet, optionally with a question already in the box. */
  show: (seed?: string) => void;
  hide: () => void;
  /** What is on screen, assembled now. Never stale, never recomputed early. */
  look: () => Assembled;
  /** The screen the assistant is currently on, for the button's own name. */
  screen: Screen;
  /** What the sheet should offer to ask here. */
  suggestions: () => string[];
  /**
   * Register context while a component is mounted.
   *
   * How an open row or a modal adds its own detail without the screen's
   * provider having to know it exists. Returns the unregister.
   */
  register: (id: string, ctx: ScreenContext) => () => void;
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
  const { state, catalog, now } = useStore();
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
  /** Context registered by components that are mounted right now. */
  const extra = useRef(new Map<string, ScreenContext>());

  const onScreen = useCallback((s: Screen) => setScreen(s), []);
  const onLive = useCallback((l: Look) => {
    live.current = l;
  }, []);

  const look = useCallback((): Assembled => {
    const now = live.current;
    const label = DESTINATIONS.find((d) => d.screen === screen)?.label ?? screen;
    const registered = [...extra.current.values()];
    if (!now) {
      return { screen, label, own: null, extra: registered, text: '', dropped: 0 };
    }
    const provide = providerFor(screen);
    const own = provide ? provide(now) : null;
    if (!own) {
      /*
       * A screen with nothing of its own to say.
       *
       * The sheet says so rather than hiding it. "This screen told me
       * nothing" is a fact the student should have when they are weighing an
       * answer — the alternative is an answer that seems to be about what
       * they are looking at and is not.
       */
      const only = registered
        .map((c) => render(screen, label, c))
        .map((r) => r.text)
        .join('\n\n');
      return { screen, label, own: null, extra: registered, text: only, dropped: 0 };
    }
    const rendered = render(screen, label, own);
    const withExtra = [rendered.text, ...registered.map((c) => render(screen, label, c).text)]
      .filter(Boolean)
      .join('\n\n');
    return { screen, label, own, extra: registered, text: withExtra, dropped: rendered.dropped };
  }, [screen]);

  const suggestions = useCallback(() => {
    const assembled = look();
    const fromScreen = assembled.own?.suggestions ?? [];
    const fromExtra = assembled.extra.flatMap((c) => c.suggestions);
    const all = [...fromExtra, ...fromScreen];
    // Everywhere works, so a screen with nothing to suggest still offers the
    // two questions that are worth asking from anywhere.
    return all.length > 0
      ? all.slice(0, 3)
      : ['What is due this week?', 'How am I doing?', 'How does this app work?'];
  }, [look]);

  const register = useCallback((id: string, ctx: ScreenContext) => {
    extra.current.set(id, ctx);
    return () => {
      extra.current.delete(id);
    };
  }, []);

  const value = useMemo<AI>(
    () => ({
      open,
      show: (seed?: string) => {
        if (seed !== undefined) setSeeded(seed);
        setOpen(true);
      },
      hide: () => setOpen(false),
      look,
      screen,
      suggestions,
      register,
    }),
    [open, look, screen, suggestions, register],
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

/**
 * Add context for as long as this component is mounted.
 *
 * For a modal, an expanded row, a selected card — anything that is part of
 * what the student is looking at but is not the screen. Unregisters on
 * unmount, so a closed sheet cannot leave its record attached to the next
 * question.
 *
 * `ctx` must be memoised by the caller, or this re-registers on every render.
 */
export function useAIContext(id: string, ctx: ScreenContext | null): void {
  const { register } = useAI();
  useEffect(() => {
    if (!ctx) return;
    return register(id, ctx);
  }, [id, ctx, register]);
}
