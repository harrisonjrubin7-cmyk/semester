import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { shut } from '../../lib/rtc';
import { Lobby } from './Lobby';
import { Green } from './Green';
import { Stage } from './Stage';

/**
 * A call, in three states: the lobby, the green room, and the call.
 *
 * The state is the code and whether a stream has been handed over, and both
 * are deliberately small. There is no call in the store and no call in
 * storage: a call is a thing happening now, to this tab, and the moment it is
 * something the app *remembers* it becomes something that can be restored
 * wrongly — a green room for a call that ended on Tuesday, a peer connection
 * that outlives the screen it was drawn on.
 *
 * The code does live in the URL, because that is the whole point of a call:
 * `#/call/bcd-fghj-kmn` is a link somebody can send, and opening it lands in
 * the green room for that call. See `NAMED` in `lib/route.ts`.
 *
 * ## Leaving the screen leaves the call
 *
 * There is no miniature call that follows you to Today. That is a real
 * feature in both of the apps this borrows from and it is a much larger one
 * than it looks — a floating window, a second render path for every tile, and
 * a call that survives navigation is a call that survives navigation *into a
 * bug*. What is here instead is honest: the controls say Leave, unmounting
 * hangs up, and nothing goes on running where you cannot see it.
 */
export function Call() {
  const { state, dispatch } = useStore();
  const code = state.callCode;

  /** What the green room was left with, once somebody presses Join. */
  const [live, setLive] = useState<{
    stream: MediaStream;
    name: string;
    flags: { muted: boolean; camera: boolean };
  } | null>(null);
  const [title, setTitle] = useState('');
  const [wantShare, setWantShare] = useState(false);

  /* A different call is a different everything. Leaving drops the code, and
     the stream stops with it — by way of the effect below, which owns that. */
  useEffect(() => {
    if (!code && live) setLive(null);
  }, [code, live]);

  /*
   * One owner for the camera, and it is this screen's lifetime.
   *
   * The paragraph above promises that unmounting hangs up and nothing goes on
   * running where you cannot see it. Half of it was true: `Stage`'s cleanup
   * calls `session.leave()`, which closes every peer connection and the
   * channel. None of that touches the `MediaStream` — `leave` tears down
   * connections, and `shut` was only ever reached from the Leave button and
   * from the code-dropped effect above.
   *
   * This screen is a `switch` arm in `App.tsx`, so tapping any other
   * destination unmounts it without either of those running. The camera light
   * stayed on and the microphone kept capturing, on a screen already left.
   *
   * Keyed on `live` rather than written as an unmount-only effect because
   * `StrictMode` is on: it runs setup, cleanup, setup on the *initial* mount,
   * and an unmount-only cleanup would stop the camera in development the
   * moment it was acquired. `live` is null for that first pass, so the
   * cleanup is a no-op, and the run that carries a real stream is an ordinary
   * dependency change that React does not double-invoke.
   */
  useEffect(() => {
    if (!live) return;
    return () => shut(live.stream);
  }, [live]);

  if (!code) {
    return (
      <Lobby
        onOpen={(call) => {
          setTitle(call.title);
          setWantShare(Boolean(call.share));
          dispatch({ type: 'openCall', code: call.code });
        }}
      />
    );
  }

  if (!live) {
    return (
      <Green
        code={code}
        title={title}
        onJoin={(stream, flags, name) => setLive({ stream, flags, name })}
        onBack={() => dispatch({ type: 'openCall', code: '' })}
      />
    );
  }

  return (
    <Stage
      // Rebuilt from scratch for a new call rather than reconciled into one:
      // every connection, every tile and the session itself belong to one
      // code, and reusing them across two would be the subtlest bug in here.
      key={code}
      code={code}
      title={title}
      local={live.stream}
      name={live.name}
      start={live.flags}
      wantShare={wantShare}
      // No `shut` here: clearing `live` runs the cleanup above, which is the
      // one place the stream is stopped however the screen is left.
      onLeave={() => {
        setLive(null);
        dispatch({ type: 'openCall', code: '' });
      }}
    />
  );
}
