// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Leaving the screen stops the camera, not just the call.
 *
 * `Index.tsx` promises it in its own words — "unmounting hangs up, and
 * nothing goes on running where you cannot see it" — and half of it was true.
 * Unmounting did hang up: `Stage`'s cleanup calls `session.leave()`, which
 * closes every peer connection and the signalling channel.
 *
 * What it did not do was stop the local tracks. `leave()` tears down
 * connections and never touches the `MediaStream`; `Index`'s only teardown is
 * an effect watching for the code to drop, which has no cleanup function; and
 * `onLeave` runs on the Leave button and nowhere else. `shut` is the only
 * thing in the app that stops a track, and no caller of it runs on unmount.
 *
 * So the screen is a `switch` arm in `App.tsx` — tap any other destination
 * and `<Call/>` unmounts — and the camera light stayed on, with the
 * microphone still capturing, on a screen the person had already left.
 *
 * `Green` and `Stage` are stubbed because neither is the subject: what is
 * being pinned is that the stream handed over at Join is stopped when the
 * screen goes, whatever the reason it went.
 */
const dispatch = vi.fn();
vi.mock('../../state/store', () => ({
  useStore: () => ({ state: { callCode: 'bcd-fghj-kmn' }, dispatch }),
}));

/** Hands a stream over the moment it renders, as pressing Join does. */
vi.mock('./Green', () => ({
  Green: ({ onJoin }: { onJoin: (s: MediaStream, f: unknown, n: string) => void }) => {
    queueMicrotask(() => onJoin(stream, { muted: false, camera: true }, 'Someone'));
    return null;
  },
}));

/** The call itself is not the subject, and it wants a browser with WebRTC in it. */
vi.mock('./Stage', () => ({
  Stage: ({ onLeave }: { onLeave: () => void }) => {
    leave = onLeave;
    return null;
  },
}));

let leave: (() => void) | undefined;

let stream: MediaStream;
let stopped: string[];

const track = (kind: string) =>
  ({ kind, stop: () => stopped.push(kind), enabled: true }) as unknown as MediaStreamTrack;

import { Call } from './Index';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  stopped = [];
  const tracks = [track('video'), track('audio')];
  stream = { getTracks: () => tracks, getVideoTracks: () => [tracks[0]] } as unknown as MediaStream;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  host.remove();
});

it('stops the camera and the microphone when the screen unmounts', async () => {
  await act(async () => root.render(<Call />));
  // Join: the green room hands the stream over and the call begins.
  await act(async () => {
    await Promise.resolve();
  });
  expect(stopped, 'nothing should be stopped while the call is on screen').toEqual([]);

  // Navigating to another destination unmounts this screen — there is no
  // Leave press, and `App.tsx` renders one screen out of a switch.
  await act(async () => root.unmount());

  expect(stopped.sort()).toEqual(['audio', 'video']);
});

/*
 * The fix must not be the other bug.
 *
 * `StrictMode` is on in `main.tsx`, and it runs setup, cleanup, setup on the
 * initial mount. An unmount-only teardown — the obvious way to write this —
 * would stop the camera in development the instant it was acquired, which is
 * worse than the leak it fixes. The effect keys on `live` instead, which is
 * null for that first pass, so the doubled cleanup has nothing to stop.
 */
it('does not stop the stream during the StrictMode remount', async () => {
  await act(async () => root.render(<StrictMode><Call /></StrictMode>));
  await act(async () => {
    await Promise.resolve();
  });
  expect(stopped, 'the camera should survive the simulated remount').toEqual([]);
  await act(async () => root.unmount());
  expect(stopped.sort()).toEqual(['audio', 'video']);
});

/** The Leave button still stops it, by the same single owner. */
it('stops the stream when Leave is pressed', async () => {
  await act(async () => root.render(<Call />));
  await act(async () => {
    await Promise.resolve();
  });
  expect(stopped).toEqual([]);
  await act(async () => leave?.());
  expect(stopped.sort()).toEqual(['audio', 'video']);
});
