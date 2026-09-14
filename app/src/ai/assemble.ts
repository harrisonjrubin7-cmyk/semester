import { screenName } from '../lib/nav';
import { providerFor } from './providers';
import { render, type Look, type ScreenContext } from './shape';
import type { Screen } from '../lib/types';

/**
 * What the assistant can see, assembled at the moment it is asked.
 *
 * This was two callbacks on `ai/store.tsx`, and moving them is about weight
 * rather than about design. `AIProvider` is mounted by `main.tsx`, above the
 * router, so everything that file imports is parsed before the first render —
 * and `providerFor` reaches every screen's account of itself, which between
 * them read the spreadsheet engine, the equation library, the chart model and
 * the whole insights tree. Twenty-three modules and 7,543 lines on the eager
 * import graph, to hold a function nothing calls until somebody opens the
 * assistant.
 *
 * Nothing calls it earlier than that, either, and that is what makes the move
 * safe rather than clever: `assemble` is reached from exactly three places —
 * `ai/Panel.tsx`, `ai/Opening.tsx` and `ai/converse.ts` — and all three are
 * already behind the panel's chunk or the Ask tab's. The store keeps what
 * only it can know (which screen, the live store, what is registered) and
 * this holds the part that needs the providers.
 *
 * It is a function rather than a hook on purpose. The reasoning in
 * `ai/store.tsx` about not re-rendering still holds and is the whole design:
 * a context is a pure function of state, so it is computed when it is used —
 * when the panel opens, and when a question is sent — and never on a
 * keystroke.
 *
 * See `ENGINEERING-AUDIT.md` §1, P1e.
 */

/**
 * What `assemble` needs, which is less than the whole assistant.
 *
 * Named as what it takes rather than as where it comes from, so the two
 * callers that already hold an `AI` can pass it straight in and a test can
 * pass three fields.
 */
export interface Inputs {
  /** The screen the assistant is on. */
  screen: Screen;
  /** The live store, or null before the bridge has handed one up. */
  live: () => Look | null;
  /** Context registered by whatever is mounted right now. */
  registered: () => ScreenContext[];
}

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

export function assemble(ai: Inputs): Assembled {
  const { screen } = ai;
  const now = ai.live();
  // `screenName` rather than the registry alone: it also knows the settings
  // pages and the screens you reach from something else, which the registry
  // deliberately does not list. Without it the sheet's header read "Looking
  // at: setLook" and its placeholder "Ask about drill".
  const label = screenName(screen);
  const registered = ai.registered();
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
  /*
   * What was asked about goes first, not last.
   *
   * A long press on a deadline registers that deadline. Appending it after
   * the whole screen put the specific thing at the bottom of eight hundred
   * characters of list, which is the wrong way round twice over: it is what
   * the question is about, and a context that has to be cut is cut from the
   * end.
   */
  const rendered = render(screen, label, own);
  const text = [...registered.map((c) => render(screen, label, c).text), rendered.text]
    .filter(Boolean)
    .join('\n\n');
  return { screen, label, own, extra: registered, text, dropped: rendered.dropped };
}

export function suggestionsFor(ai: Inputs): string[] {
  const assembled = assemble(ai);
  const fromScreen = assembled.own?.suggestions ?? [];
  const fromExtra = assembled.extra.flatMap((c) => c.suggestions);
  const all = [...fromExtra, ...fromScreen];
  // Everywhere works, so a screen with nothing to suggest still offers the
  // two questions that are worth asking from anywhere.
  return all.length > 0
    ? all.slice(0, 3)
    : ['What is due this week?', 'How am I doing?', 'How does this app work?'];
}
