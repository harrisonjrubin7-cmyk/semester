/**
 * The screen fell over. The app does not have to.
 *
 * ## What happens without this
 *
 * React unmounts the whole tree when a render throws and nothing catches it.
 * Not the screen — the tree. The app had no boundary anywhere, so one bad
 * render meant a white page: `#root` with zero children, no message, no
 * navigation, no way back except clearing the site's data. Somebody whose
 * semester is in here would reasonably conclude they had lost it.
 *
 * ## The failure this was actually found by
 *
 * Every screen but Today is fetched when it is opened, and every deploy gives
 * those files new names. GitHub Pages then stops serving the old ones. So an
 * installed app that has been open since before a deploy — which is how a PWA
 * is used — asks for `Courses-YfCaA22G.js`, gets a 404, and the dynamic import
 * rejects. Measured, before this existed: `#root` empty, zero characters, the
 * app gone. Four deploys went out in a single afternoon while this was true.
 *
 * That case is worth naming rather than lumping in with "something broke",
 * because it is not broken and the person has done nothing wrong: the app was
 * updated underneath them, a reload is the whole fix, and saying so is the
 * difference between a dead end and a button.
 *
 * ## The same failure with a second cause
 *
 * A missing chunk also means "there is no connection and this screen was never
 * downloaded", and that was told as the update story too — measured with the
 * network off: "A new version was published while this was open… a reload is
 * the whole fix." Nothing had been published, and the reload came back to the
 * same message. A confident false story, prescribing the one action that
 * cannot work, in an app whose whole promise is that it keeps working with no
 * signal. `lib/fault.ts` separates the two and this says the right one.
 *
 * ## Why it wraps the screen and not the app
 *
 * Inside the header and the navigation rather than around them, so a screen
 * that fails leaves you somewhere you can leave *from*. A boundary around
 * everything would catch the same errors and give you a full-page apology
 * with no way out, which is only marginally better than the white page.
 *
 * `key` on the boundary is the screen id, so moving to another screen resets
 * it — without that, one failure would leave the message up for the rest of
 * the session however far you navigated away.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { LOG_KEY, add, entry, read } from '../lib/diagnose';
import { faultOf, type Fault } from '../lib/fault';
import { offline } from '../lib/offline';

/** What each of the three failures is called, and what it says. */
const SAYS: Record<Fault, { kicker: string; heading: string; body: string }> = {
  absent: {
    kicker: 'No connection',
    heading: 'This screen has not been downloaded.',
    body: 'Everything you have opened before works with no signal, and this part of the app has never been fetched — so there is nothing on this device to draw. It will open as soon as there is a connection. Nothing is lost: everything you have is saved here.',
  },
  stale: {
    kicker: 'This app was updated',
    heading: 'Reload to pick up the new version.',
    body: 'A new version was published while this was open, so the file this screen needed is no longer the one being served. Nothing is lost — everything you have is saved on this device — and a reload is the whole fix.',
  },
  broken: {
    kicker: 'This screen stopped',
    heading: 'Something on this screen went wrong.',
    body: 'Your work is safe: everything is saved on this device as you go, and nothing on this screen writes anything. The rest of the app still works, so you can carry on somewhere else.',
  },
};

interface Props {
  children: ReactNode;
  /** Where to send somebody who cannot stay here. */
  onLeave: () => void;
}

interface State {
  error: Error | null;
}

export class ScreenTrouble extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The same ring buffer `Watching` writes to, so the diagnostics screen
    // shows render failures beside the uncaught errors it already collects.
    // Wrapped for the reason `Watching` gives: a logger that throws inside an
    // error handler turns one visible problem into two invisible ones.
    try {
      const log = read(localStorage.getItem(LOG_KEY));
      const where = document.body.dataset.screen ?? '';
      localStorage.setItem(
        LOG_KEY,
        JSON.stringify(add(log, entry('error', `render: ${error.message}`, where, info.componentStack ?? undefined))),
      );
    } catch {
      // Storage full, or disabled. Nothing here may re-throw.
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    /*
     * Read at render rather than when the error was caught: a person who has
     * walked back into signal and pressed nothing should not still be reading
     * that they are offline.
     */
    const fault = faultOf(error, !offline());
    const says = SAYS[fault];

    return (
      <div style={{ paddingTop: 'var(--sp-7)', paddingBottom: 'var(--sp-7)', paddingLeft: 'var(--sp-7)', paddingRight: 'var(--sp-7)', maxWidth: 460 }} role="alert">
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--type-xs)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: 0.5,
          }}
        >
          {says.kicker}
        </div>
        <h2
          style={{
            marginTop: 'var(--sp-3)',
            fontSize: 'var(--type-xl)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 'var(--font-heading-weight)' as never,
            lineHeight: 'var(--leading-tight)',
            textWrap: 'pretty',
          }}
        >
          {says.heading}
        </h2>
        <p
          style={{
            marginTop: 'var(--sp-5)',
            fontSize: 'var(--type-base)',
            opacity: 0.75,
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
          }}
        >
          {says.body}
        </p>

        {/* Both buttons in every case, in the order of which one works.
            With no connection a reload cannot fetch what was never fetched and
            Today is on the device already, so leaving leads — and the reload
            is still offered, because it is the right press the moment the
            signal is back. Written as an order rather than as a row-reverse:
            the first button a keyboard reaches should be the first one drawn.
            */}
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-7)', flexWrap: 'wrap' }}>
          {(fault === 'absent' ? ['leave', 'reload'] : ['reload', 'leave']).map((which, i) =>
            which === 'reload' ? (
              <button
                key="reload"
                type="button"
                className={i === 0 ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => window.location.reload()}
                style={{ minHeight: 44 }}
              >
                Reload
              </button>
            ) : (
              <button
                key="leave"
                type="button"
                className={i === 0 ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => {
                  this.setState({ error: null });
                  this.props.onLeave();
                }}
                style={{ minHeight: 44 }}
              >
                Go to Today
              </button>
            ),
          )}
        </div>

        {/* The message itself, last and quiet. Somebody reporting this needs
            it, and hiding it entirely means the report says "it broke". */}
        {fault === 'broken' && (
          <p
            style={{
              marginTop: 'var(--sp-7)',
              fontSize: 'var(--type-xs)',
              opacity: 0.45,
              lineHeight: 'var(--leading-normal)',
              wordBreak: 'break-word',
            }}
          >
            {error.message} · Settings → Storage keeps a log of this on the device.
          </p>
        )}
      </div>
    );
  }
}
