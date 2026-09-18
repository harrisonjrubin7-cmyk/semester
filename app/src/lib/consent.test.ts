import { describe, expect, it } from 'vitest';
import {
  NOT_RECORDING,
  RECORD_ASK_HOLD,
  RESTING,
  asking,
  awaiting,
  mayRecord,
  recording,
} from './mesh';
import type { Recording, Roster, Signal } from './mesh';

/**
 * Recording consent, which is the only thing in this app done *to* people.
 *
 * Three rules were decided before any of it was written, and every test here
 * holds one of them:
 *
 *   **Everyone is told before it starts, and it cannot start until they have
 *   each said yes.** Not a banner they might notice — an answer from every
 *   person in the room.
 *
 *   **Anyone can refuse, and refusing ends it for everyone.** Not "their track
 *   is dropped", which produces a file whose gap is itself a statement, and
 *   not "they can leave", which is an ultimatum rather than a choice.
 *
 *   **The file never reaches Semester.** Asserted in `taping.test.ts`, which
 *   reads that module's source for a network call, because the only honest
 *   check on "it cannot upload" is that it contains nothing that could.
 *
 * The case that most of this file exists for is the fourth one, which nobody
 * decides at the keyboard and everybody meets in a real call: **somebody
 * joining a recording already in progress has consented to nothing.**
 */

const who = (...ids: string[]): Roster =>
  Object.fromEntries(
    ids.map((id, n) => [id, { id, flags: { ...RESTING, name: id }, joinedAt: n, heard: n }]),
  );

const ask = (from: string, at = 1_000): Signal => ({ t: 'record-ask', from, at });
const yes = (from: string, to: string, at = 1_100): Signal => ({ t: 'record-yes', from, to, at });
const no = (from: string, at = 1_100): Signal => ({ t: 'record-no', from, at });
const on = (from: string, at = 1_200): Signal => ({ t: 'record-on', from, at });
const off = (from: string, at = 1_300): Signal => ({ t: 'record-off', from, at });
const left = (from: string): Signal => ({ t: 'gone', from });

/** Drive a list of signals through, from nothing. */
const after = (signals: Signal[], now = 1_500): Recording =>
  signals.reduce<Recording>((state, s) => recording(state, s, now), NOT_RECORDING);

describe('nobody is recorded without being asked', () => {
  it('starts with nothing happening', () => {
    expect(NOT_RECORDING.asker).toBe('');
    expect(NOT_RECORDING.running).toBe(false);
  });

  it('a request alone does not permit recording', () => {
    const state = after([ask('a')]);
    expect(state.asker).toBe('a');
    expect(mayRecord(state, who('a', 'b'), 'a'), 'recording began on the asking').toBe(false);
  });

  it('one yes out of two is not enough', () => {
    const state = after([ask('a'), yes('b', 'a')]);
    expect(mayRecord(state, who('a', 'b', 'c'), 'a')).toBe(false);
  });

  it('every other person saying yes is', () => {
    const state = after([ask('a'), yes('b', 'a'), yes('c', 'a')]);
    expect(mayRecord(state, who('a', 'b', 'c'), 'a')).toBe(true);
  });

  it('and the asker is not asked to consent to themselves', () => {
    const state = after([ask('a')]);
    expect(asking(state, 'a'), 'the asker was shown their own request').toBe(false);
    expect(asking(state, 'b')).toBe(true);
  });

  it('alone in a call, there is nobody to ask', () => {
    const state = after([ask('a')]);
    expect(mayRecord(state, who('a'), 'a')).toBe(true);
  });

  it('somebody who is not the asker can never record', () => {
    const state = after([ask('a'), yes('b', 'a'), yes('c', 'a')]);
    expect(mayRecord(state, who('a', 'b', 'c'), 'b'), 'a bystander could record').toBe(false);
  });

  it('even when everybody in their own view happens to have agreed', () => {
    /*
     * The case that isolates the check. Above, `a` is the asker and has no
     * answer of their own, so the roll-call fails anyway and the test passes
     * whether or not `mayRecord` looks at who is asking — the mutation harness
     * found that by deleting the check and watching nothing go red.
     *
     * Here `b` is not the asker and everyone else in b's roster has agreed, so
     * the roll-call would pass. Only the asker check stops it.
     */
    const state: Recording = { asker: 'a', at: 1_000, answers: { c: 'agreed' }, running: false };
    expect(mayRecord(state, who('b', 'c'), 'b'), 'a bystander recorded on another person\u2019s consent').toBe(
      false,
    );
  });

  it('and a refusal is not an answer that counts as one', () => {
    /*
     * Built by hand rather than driven through signals, deliberately. A
     * refusal arriving as a signal also clears the asker, so through that door
     * `mayRecord` never sees a live request alongside a `refused` — which made
     * the difference between "has agreed" and "has answered at all"
     * unreachable, and a mutation swapping them passed. This pins
     * `mayRecord`'s own contract rather than the route that usually reaches
     * it: a state carrying a refusal does not permit recording, however it
     * came to exist.
     */
    const state: Recording = { asker: 'a', at: 1_000, answers: { b: 'refused' }, running: false };
    expect(mayRecord(state, who('a', 'b'), 'a'), 'a refusal was counted as an answer').toBe(false);
  });

  it('names who has still to answer, so the asker is not left guessing', () => {
    const state = after([ask('a'), yes('c', 'a')]);
    expect(awaiting(state, who('a', 'b', 'c', 'd'), 'a')).toEqual(['b', 'd']);
  });
});

describe('a refusal ends it, for everyone', () => {
  it('before it starts', () => {
    const state = after([ask('a'), yes('b', 'a'), no('c')]);
    expect(state.asker).toBe('');
    expect(mayRecord(state, who('a', 'b', 'c'), 'a')).toBe(false);
  });

  it('and while it is running', () => {
    const state = after([ask('a'), yes('b', 'a'), yes('c', 'a'), on('a'), no('c')]);
    expect(state.running, 'a refusal left the recording running').toBe(false);
    expect(mayRecord(state, who('a', 'b', 'c'), 'a')).toBe(false);
  });

  it('from somebody who had already agreed — consent can be taken back', () => {
    const state = after([ask('a'), yes('b', 'a'), yes('c', 'a'), on('a'), no('b')]);
    expect(state.running).toBe(false);
  });

  it('and the yes of everybody else does not outvote it', () => {
    /*
     * There is no arithmetic here on purpose. One refusal is not a vote that
     * can be lost; the state after it has no asker at all, which is what makes
     * "recording continued over an objection" unreachable rather than merely
     * unlikely.
     */
    const state = after([ask('a'), yes('b', 'a'), yes('c', 'a'), yes('d', 'a'), on('a'), no('e')]);
    expect(state.running).toBe(false);
    expect(state.answers.e).toBe('refused');
  });
});

describe('somebody joining a recording has consented to nothing', () => {
  it('so their arrival stops it', () => {
    const state = after([ask('a'), yes('b', 'a'), on('a')]);
    expect(mayRecord(state, who('a', 'b'), 'a')).toBe(true);
    // c walks in. Nothing is sent, nothing is handled — the roster changed.
    expect(mayRecord(state, who('a', 'b', 'c'), 'a'), 'a newcomer was recorded unasked').toBe(false);
  });

  it('and asking again, with them in the room, lets it resume', () => {
    const state = after([ask('a'), yes('b', 'a'), on('a'), ask('a', 2_000), yes('b', 'a'), yes('c', 'a')], 2_100);
    expect(mayRecord(state, who('a', 'b', 'c'), 'a')).toBe(true);
  });

  it('but a new request throws away the old answers', () => {
    /*
     * The thing that makes consent per-recording rather than permanent. If
     * `b`'s yes survived into the second request, `a` would be recording `b`
     * on a permission `b` gave to a different recording.
     */
    const state = after([ask('a'), yes('b', 'a'), ask('a', 2_000)], 2_100);
    expect(state.answers).toEqual({});
    expect(mayRecord(state, who('a', 'b'), 'a')).toBe(false);
  });
});

describe('leaving is not refusing', () => {
  it('somebody going does not stop the recording', () => {
    const state = after([ask('a'), yes('b', 'a'), yes('c', 'a'), on('a'), left('c')]);
    expect(state.running, 'closing a tab ended everybody’s recording').toBe(true);
    expect(mayRecord(state, who('a', 'b'), 'a')).toBe(true);
  });

  it('and coming back is asked afresh', () => {
    const state = after([ask('a'), yes('b', 'a'), yes('c', 'a'), on('a'), left('c')]);
    expect(mayRecord(state, who('a', 'b', 'c'), 'a'), 'a rejoin inherited an old yes').toBe(false);
  });
});

describe('a request that nobody answers lapses', () => {
  it('rather than standing all afternoon', () => {
    const asked = after([ask('a', 1_000)]);
    const later = recording(asked, { t: 'state', from: 'b', flags: RESTING }, 1_000 + RECORD_ASK_HOLD + 1);
    expect(later.asker).toBe('');
    expect(asking(later, 'b')).toBe(false);
  });

  it('but one that is running does not, however long it runs', () => {
    const live = after([ask('a', 1_000), yes('b', 'a'), on('a')]);
    const later = recording(live, { t: 'state', from: 'b', flags: RESTING }, 1_000 + RECORD_ASK_HOLD * 10);
    expect(later.running, 'a long recording expired itself').toBe(true);
  });

  it('and a yes arriving after it lapsed does not revive it', () => {
    const asked = after([ask('a', 1_000)]);
    const late = recording(asked, yes('b', 'a'), 1_000 + RECORD_ASK_HOLD + 1);
    expect(late.asker).toBe('');
    expect(mayRecord(late, who('a', 'b'), 'a')).toBe(false);
  });
});

describe('signals that are not this peer’s to send', () => {
  it('somebody else cannot announce that the asker started', () => {
    const state = after([ask('a'), yes('b', 'a'), on('b')]);
    expect(state.running, 'a bystander turned the recording on').toBe(false);
  });

  it('somebody else cannot announce that it stopped', () => {
    const state = after([ask('a'), yes('b', 'a'), on('a'), off('b')]);
    expect(state.running).toBe(true);
  });

  it('a yes addressed to somebody who is not the asker is ignored', () => {
    const state = after([ask('a'), yes('b', 'zzz')]);
    expect(state.answers).toEqual({});
  });

  it('and an unrelated signal changes nothing', () => {
    const before = after([ask('a'), yes('b', 'a')]);
    const same = recording(before, { t: 'said', from: 'c', at: 1_200, body: 'hello' }, 1_200);
    expect(same).toBe(before);
  });
});

describe('what each person is shown', () => {
  it('a request is put to everybody but the asker', () => {
    const state = after([ask('a')]);
    expect(asking(state, 'b')).toBe(true);
    expect(asking(state, 'c')).toBe(true);
    expect(asking(state, 'a')).toBe(false);
  });

  it('and not to somebody who has already answered', () => {
    const state = after([ask('a'), yes('b', 'a')]);
    expect(asking(state, 'b'), 'b was asked twice').toBe(false);
    expect(asking(state, 'c')).toBe(true);
  });

  it('nobody is asked once it is running — they are told', () => {
    const state = after([ask('a'), yes('b', 'a'), on('a')]);
    expect(asking(state, 'b')).toBe(false);
    expect(state.running).toBe(true);
  });

  it('including somebody who never answered, such as a newcomer', () => {
    /*
     * The case that isolates the running check. `b` above had already
     * answered, so they were not asked for that reason and the test passed
     * with the running check deleted. `d` walked in and has answered nothing —
     * and must still not be shown a consent prompt, because a recording
     * already running is not a decision in front of them. What they are shown
     * is that it is running; meanwhile `mayRecord` has gone false for the
     * asker, so it stops.
     */
    const state = after([ask('a'), yes('b', 'a'), yes('c', 'a'), on('a')]);
    expect(asking(state, 'd'), 'a newcomer was asked to consent to a recording in progress').toBe(false);
    expect(mayRecord(state, who('a', 'b', 'c', 'd'), 'a'), 'and it did not stop for them').toBe(false);
  });
});
