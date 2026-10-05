import { useId, useState } from 'react';
import { explain } from '../../lib/explain';
import type { Screen } from '../../lib/types';
import { useStore } from '../../state/store';
import { showExplain } from '../../lib/unity';
import { FixThis } from '../FixThis';

/**
 * "About this screen" — the same help, in the same place, on every screen.
 *
 * Drawn by `ShellBody`, which every screen passes through, so it cannot be
 * forgotten on one and it is always the last thing in the screen's content —
 * the "same relative order" WCAG 2.2's 3.2.6 asks help to keep.
 *
 * Closed by default and opened in place: progressive disclosure rather than a
 * dialog, so it never covers the thing it is explaining and never takes focus
 * anywhere unexpected. A real button with `aria-expanded`, a real region with
 * a name, and the four answers as a description list.
 */
export function ScreenGuide({ screen, sheet = false }: { screen: Screen; sheet?: boolean }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const region = useId();
  /*
   * On a screen that fills its box — the chat, the mailbox — the answers open
   * in a sheet rather than in place. Still the last thing on the screen and
   * still the same words, so it is the same help in the same order; opening
   * it in place would have grown the page and pushed the pinned composer off
   * the bottom.
   */
  if (sheet) {
    return (
      <aside className="screen-guide is-compact" aria-label="About this screen">
        <button type="button" className="bare link-quiet tap-y" aria-haspopup="dialog" onClick={() => showExplain(screen)}>
          <span className="status-glyph" aria-hidden="true">
            ?{' '}
          </span>
          About this screen
        </button>
      </aside>
    );
  }
  return (
    <aside className="screen-guide" aria-label="About this screen">
      <button
        type="button"
        className="bare link-quiet tap-y"
        aria-expanded={open}
        aria-controls={region}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="status-glyph" aria-hidden="true">
          ?{' '}
        </span>
        About this screen
      </button>
      {/*
        Always in the document, and `hidden` until opened. `aria-controls`
        has to name an element that exists: rendered only when open, the
        button pointed at nothing on every screen, which the accessibility
        smoke reports as a broken reference.
      */}
      <div id={region} className="screen-guide-body" hidden={!open}>
        <Answers screen={screen} />
        {/*
          The correction path, on every screen: a deadline that looks wrong, a
          source out of date, an answer that is incorrect, something that
          should be private, a barrier. See `lib/fixthis.ts`.
        */}
        <FixThis />
        {screen !== 'help' && (
          <button type="button" className="bare link-quiet tap-y" onClick={() => dispatch({ type: 'go', screen: 'help' })}>
            Open the guidebook
          </button>
        )}
      </div>
    </aside>
  );
}

/** The four answers, the one way — in place, or in the sheet. */
export function Answers({ screen }: { screen: Screen }) {
  const e = explain(screen);
  return (
    <dl className="screen-guide-answers">
      <dt>What is this?</dt>
      <dd>{e.what}</dd>
      <dt>Why does it matter?</dt>
      <dd>{e.why}</dd>
      <dt>Where does this information come from?</dt>
      <dd>{e.from}</dd>
      <dt>What can I do next?</dt>
      <dd>{e.next}</dd>
    </dl>
  );
}
