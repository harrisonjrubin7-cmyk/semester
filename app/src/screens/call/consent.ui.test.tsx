// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Signal } from '../../lib/mesh';

/**
 * The recording consent, as it reaches a screen.
 *
 * `consent.test.ts` proves the state machine and `taping.test.ts` proves the
 * recorder cannot upload. Neither touches the wiring, and the wiring is where
 * a correct rule quietly stops being connected to anything — a banner that
 * never renders, an Allow button that sends the wrong signal, a notice that
 * does not appear when somebody else is recording.
 *
 * Mocking `join` is what makes this possible: the mock keeps the `onSignal`
 * callback the screen hands it, so a test can put a signal into the call the
 * way a peer would. That is closer to the real thing than a screenshot would
 * be, because no screenshot in this container can show a second person asking
 * — the proxy will not tunnel `wss://`, so two browsers here cannot meet.
 */

// React needs telling that `act` is legitimate here; every mounting test in
// this repository says so for itself.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dispatch = vi.fn();
vi.mock('../../state/store', () => ({
  useStore: () => ({ state: {}, dispatch, catalog: [] }),
}));

/** The signal handler the screen gave `join`, so a test can be the other peer. */
let onSignal: ((s: Signal) => void) | undefined;
const sent: Signal[] = [];

vi.mock('../../lib/rtc', () => ({
  canShare: () => false,
  share: vi.fn(),
  meter: () => () => {},
  shut: vi.fn(),
  // The hooks are the *fourth* argument — `join(code, local, flags, ears)`.
  // Reading them from the third gave a mock that captured the flags object and
  // never wired a signal to anything, which showed up as a screen where
  // nobody ever arrived.
  join: vi.fn((_code: string, _local: unknown, _flags: unknown, hooks: { onSignal: (s: Signal) => void }) => {
    onSignal = hooks.onSignal;
    return Promise.resolve({
      id: 'me',
      send: (s: Signal) => sent.push(s),
      announce: vi.fn(),
      present: vi.fn(),
      keep: vi.fn(),
      leave: vi.fn(),
    });
  }),
}));

/* Recognition is not the subject and jsdom has none. */
vi.mock('../../lib/mic', () => ({ dictate: vi.fn(), dictationSupported: () => false }));

/* The recorder is not the subject either, and jsdom has no MediaRecorder. */
const taped: string[] = [];
vi.mock('../../lib/taping', () => ({
  mix: () => ({ stream: {} as MediaStream, stop: () => taped.push('unmixed') }),
  tape: () => ({ stop: () => { taped.push('stopped'); return Promise.resolve(null); }, running: () => true }),
  keep: vi.fn(),
}));

import { Stage } from './Stage';

let host: HTMLDivElement;
let root: Root;

const stream = () =>
  ({ getTracks: () => [], getVideoTracks: () => [], getAudioTracks: () => [] }) as unknown as MediaStream;

/** Another person, arriving and saying something. */
const peerArrives = async (id: string) =>
  act(async () => {
    onSignal?.({ t: 'here', from: id, at: Date.now(), flags: { name: id, muted: false, camera: true, sharing: false, hand: 0 } });
    await Promise.resolve();
  });

const says = async (s: Signal) =>
  act(async () => {
    onSignal?.(s);
    await Promise.resolve();
  });

const text = () => host.textContent ?? '';
const button = (re: RegExp) =>
  [...host.querySelectorAll('button')].find((b) => re.test(b.textContent ?? ''));

beforeEach(async () => {
  sent.length = 0;
  taped.length = 0;
  onSignal = undefined;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <Stage
        code="bcd-fghj-kmn"
        title="A call"
        local={stream()}
        name="Me"
        start={{ muted: false, camera: true }}
        wantShare={false}
        onLeave={() => {}}
      />,
    );
    await Promise.resolve();
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it('puts a request to the person being asked, and not to the asker', async () => {
  await peerArrives('them');
  await says({ t: 'record-ask', from: 'them', at: Date.now() });

  expect(text(), 'the request never reached the screen').toMatch(/wants to record this call/i);
  expect(text()).toMatch(/cannot start until everybody agrees/i);
  expect(button(/^Allow$/), 'there was no way to agree').toBeTruthy();
  expect(button(/do not record me/i), 'there was no way to refuse').toBeTruthy();
});

it('sends a yes addressed to whoever asked', async () => {
  await peerArrives('them');
  await says({ t: 'record-ask', from: 'them', at: Date.now() });
  await act(async () => {
    button(/^Allow$/)?.click();
    await Promise.resolve();
  });

  const yes = sent.find((s) => s.t === 'record-yes');
  expect(yes, 'agreeing sent nothing').toBeTruthy();
  expect(yes && 'to' in yes && yes.to, 'the yes was not addressed to the asker').toBe('them');
});

it('sends a refusal to the room, because it stops it for everyone', async () => {
  await peerArrives('them');
  await says({ t: 'record-ask', from: 'them', at: Date.now() });
  await act(async () => {
    button(/do not record me/i)?.click();
    await Promise.resolve();
  });

  const no = sent.find((s) => s.t === 'record-no');
  expect(no, 'refusing sent nothing').toBeTruthy();
  // To the room: a refusal carries no `to`, which is what makes it everybody's.
  expect(no && 'to' in no, 'the refusal was addressed to one person').toBe(false);
});

it('tells everybody while it is running, and leaves them the button that stops it', async () => {
  await peerArrives('them');
  await says({ t: 'record-ask', from: 'them', at: Date.now() });
  await says({ t: 'record-yes', from: 'me', to: 'them', at: Date.now() });
  await says({ t: 'record-on', from: 'them', at: Date.now() });

  expect(text(), 'nobody was told it had started').toMatch(/recording/i);
  expect(text(), 'the screen did not say where the file goes').toMatch(/not sent to Semester/i);
  expect(button(/stop recording/i), 'a bystander could not stop it').toBeTruthy();
});

it('and that button is a refusal when it is somebody else recording', async () => {
  await peerArrives('them');
  await says({ t: 'record-ask', from: 'them', at: Date.now() });
  await says({ t: 'record-yes', from: 'me', to: 'them', at: Date.now() });
  await says({ t: 'record-on', from: 'them', at: Date.now() });
  await act(async () => {
    button(/stop recording/i)?.click();
    await Promise.resolve();
  });

  expect(sent.some((s) => s.t === 'record-no'), 'stopping somebody else’s recording sent the wrong signal').toBe(
    true,
  );
});

it('offers the panel copy that says what recording here means', async () => {
  // The section is in the More panel, which is where a control that puts a
  // question to everybody else belongs — see the comment on it in `Stage`.
  await act(async () => {
    button(/^More$/)?.click();
    await Promise.resolve();
  });
  /*
   * The words are the feature as much as the state machine is. Somebody
   * deciding whether to press this is deciding on the strength of this
   * paragraph, so it is pinned rather than left to drift.
   */
  expect(text()).toMatch(/Everybody is asked first/i);
  expect(text()).toMatch(/does not start until every one of them agrees/i);
  expect(text()).toMatch(/Semester never receives it/i);
  expect(text()).toMatch(/If somebody joins while it is running it stops/i);
});

it('names who has not answered, rather than falling back to "everybody"', async () => {
  /*
   * The line used to say "Waiting for everybody." whenever the list came back
   * empty. Driving it in a browser is what showed the problem: a call that
   * could not connect sat saying that to one person in an empty room, which
   * reads as a room full of people ignoring them.
   *
   * Two people are needed to see the line at all — alone, `mayRecord` is
   * already true and it simply starts — so this asks with somebody there and
   * checks the line names them.
   */
  await peerArrives('them');
  await act(async () => {
    button(/^More$/)?.click();
    await Promise.resolve();
  });
  await act(async () => {
    button(/ask to record this call/i)?.click();
    await Promise.resolve();
  });

  expect(text()).toMatch(/waiting for them/i);
  expect(text(), 'it fell back to the word everybody').not.toMatch(/waiting for everybody/i);
});

it('starts at once when there is nobody to ask', async () => {
  /*
   * Alone in a call there is nobody whose consent is owed, so the request and
   * the recording are the same moment. The button becoming "Stop recording"
   * is how that is visible.
   */
  await act(async () => {
    button(/^More$/)?.click();
    await Promise.resolve();
  });
  await act(async () => {
    button(/ask to record this call/i)?.click();
    await Promise.resolve();
  });
  expect(text(), 'recording alone did not begin').toMatch(/Recording\./i);
  expect(text(), 'it waited for somebody in an empty room').not.toMatch(/waiting for/i);
});

it('asks nobody when the request was never made', () => {
  expect(text()).not.toMatch(/wants to record this call/i);
});

it('and the note about keeping a call no longer claims nothing is ever recorded', async () => {
  /*
   * A sentence this change made false. The More panel said "the call itself is
   * not recorded, here or anywhere", which was true when the only thing that
   * button did was write a note — and became a lie the moment recording
   * existed. Pinned here because the copy is the only place a person is told
   * what the app does with a call, and a false sentence there is worse than a
   * missing feature.
   */
  await act(async () => {
    button(/^More$/)?.click();
    await Promise.resolve();
  });
  expect(text()).not.toMatch(/not recorded, here or anywhere/i);
  expect(text()).toMatch(/only recorded if somebody asks and everybody agrees/i);
});
