/**
 * Who connects to whom, and what they say to arrange it.
 *
 * A call in this app has no media server: every camera goes straight to every
 * other person. That is the only shape a student project can actually deploy —
 * an SFU is a machine somebody rents by the hour — and it means the hard part
 * is not the video, which browsers do, but the introductions, which they do
 * not. This file is the introductions, and it is pure so that the awkward
 * parts can be tested rather than reproduced by opening four tabs.
 *
 * `lib/rtc.ts` carries these decisions out against real peer connections and a
 * real channel. Everything below is arithmetic on strings.
 *
 * ## The one rule that makes a mesh work
 *
 * Two people who learn about each other at the same instant will both offer,
 * and two offers crossing is *glare* — the state machines on both sides fall
 * over, and the call fails in the way that looks like the network's fault. The
 * fix is not to retry faster. It is for both sides to answer the same question
 * the same way, from information they both already have: **the lower session
 * id offers.** Nothing else is needed and nothing else is negotiated, because
 * the ids are the two things both peers definitely know.
 *
 * The peer that does *not* offer is the polite one, in the sense the WebRTC
 * "perfect negotiation" pattern uses: if an offer arrives while it has one of
 * its own in flight, it gives way. Its counterpart ignores the collision. That
 * pairing is what `polite` is for, and it is the same fact as `callsFirst`
 * read from the other end, which is why they are one line each rather than two
 * tables that can disagree.
 *
 * ## A session, not a person
 *
 * Ids here identify a *tab*, not an account. Somebody who reloads is a new
 * peer, and somebody with the call open on a laptop and a phone is two. That
 * is the truthful model — there really are two cameras — and it is what keeps
 * the id comparison above total: two sessions never share an id, so the
 * question "who offers" always has an answer.
 */

/** What everybody in the call knows about everybody else. */
export interface Flags {
  name: string;
  muted: boolean;
  camera: boolean;
  sharing: boolean;
  /** When the hand went up, or 0. A moment rather than a boolean, so the
   *  queue can be ordered by it — see `ordered` in `lib/call.ts`. */
  hand: number;
}

export const RESTING: Flags = { name: '', muted: false, camera: true, sharing: false, hand: 0 };

/**
 * Everything one peer says to the others.
 *
 * Two kinds, and the difference matters to every reader: `here`, `gone`,
 * `state`, `said`, `ask` and `react` are to the room, and `offer`, `answer`
 * and `ice` are to one peer. Both travel on the same broadcast channel — a mesh has no private
 * pipe until the connection it is arranging exists — so the addressed ones
 * carry a `to` and everybody else drops them. See `addressed`.
 */
export type Signal =
  | { t: 'here'; from: string; at: number; flags: Flags }
  | { t: 'gone'; from: string }
  | { t: 'state'; from: string; flags: Flags }
  | { t: 'said'; from: string; at: number; body: string }
  | { t: 'ask'; from: string; what: 'mute' }
  | { t: 'react'; from: string; at: number; mark: string }
  | { t: 'offer'; from: string; to: string; sdp: string }
  | { t: 'answer'; from: string; to: string; sdp: string }
  | { t: 'ice'; from: string; to: string; candidate: unknown };

/** How often a peer says it is still here. */
export const BEAT = 5_000;

/**
 * How long a peer lasts without saying so.
 *
 * Three missed beats. One is a phone that slept for a moment; three is a
 * laptop lid, a tab closed by the system, or a browser that never sent `gone`
 * because it was killed rather than closed — which is most of the ways a call
 * actually ends.
 */
export const TTL = BEAT * 3 + 2_000;

/** Whether this signal is for me, or for somebody else, or for the room. */
export function addressed(signal: Signal, me: string): boolean {
  if (signal.from === me) return false;
  return 'to' in signal ? signal.to === me : true;
}

/**
 * Whether I am the one who offers.
 *
 * The lower id, by ordinary string comparison. Any total order over ids would
 * do; what matters is that both ends compute the same one, which is why it
 * reads the two ids and nothing else — not who arrived first, which the two
 * sides disagree about, and not a coin, which they cannot both toss.
 */
export function callsFirst(me: string, them: string): boolean {
  return me < them;
}

/** The other half of the same fact: the peer that gives way on a collision. */
export function polite(me: string, them: string): boolean {
  return !callsFirst(me, them);
}

/** A peer as the roster holds it. */
export interface Known {
  id: string;
  flags: Flags;
  /** When they first appeared to us, which is the order they are drawn in. */
  joinedAt: number;
  /** The last thing heard from them, for `expired`. */
  heard: number;
}

export type Roster = Record<string, Known>;

/**
 * The roster after one signal.
 *
 * A new object, never a mutation, because the screen holds this in React state
 * and an in-place update is a render that does not happen.
 *
 * `joinedAt` is set once and then left alone. It is what the gallery falls
 * back to when nothing else distinguishes two tiles — see `ordered` in
 * `lib/call.ts` — and a heartbeat that refreshed it would make the tiles
 * shuffle every five seconds for no reason anybody watching could name.
 */
export function seen(roster: Roster, signal: Signal, now: number): Roster {
  const was = roster[signal.from];

  if (signal.t === 'gone') {
    if (!was) return roster;
    const next = { ...roster };
    delete next[signal.from];
    return next;
  }

  if (signal.t === 'here' || signal.t === 'state') {
    return {
      ...roster,
      [signal.from]: {
        id: signal.from,
        flags: signal.flags,
        joinedAt: was?.joinedAt ?? now,
        heard: now,
      },
    };
  }

  // Anything else is still proof of life, and nothing more. A peer we have
  // never had a `here` from is not added on the strength of an ICE candidate:
  // a tile with no name on it would be worse than one that arrives a beat
  // later, and the `here` is on its way by construction.
  if (!was) return roster;
  return { ...roster, [signal.from]: { ...was, heard: now } };
}

/** Ids that have gone quiet for longer than they are allowed to. */
export function expired(roster: Roster, now: number, ttl = TTL): string[] {
  return Object.values(roster)
    .filter((k) => now - k.heard > ttl)
    .map((k) => k.id);
}

/** The roster without them. One pass, so a sweep is one new object. */
export function drop(roster: Roster, ids: string[]): Roster {
  if (ids.length === 0) return roster;
  const next = { ...roster };
  for (const id of ids) delete next[id];
  return next;
}

/**
 * The peers I should be holding a connection to, and the ones I should not.
 *
 * Called after every roster change, and it is the whole of the connection
 * lifecycle: anybody in the roster I have no connection to is one to open,
 * anybody I have a connection to who is no longer in the roster is one to
 * close. Written as a comparison of two sets rather than as an action taken at
 * each `here` and `gone`, because those arrive out of order, twice, and
 * sometimes not at all — and a lifecycle built out of events has to be right
 * about every one of them, where a reconciliation only has to be right about
 * the current state.
 */
export function reconcile(roster: Roster, open: string[]): { start: string[]; stop: string[] } {
  const want = new Set(Object.keys(roster));
  const have = new Set(open);
  return {
    start: [...want].filter((id) => !have.has(id)).sort(),
    stop: [...have].filter((id) => !want.has(id)).sort(),
  };
}

/**
 * Whether a hello should be answered with one of our own.
 *
 * The hello is sent once, on arrival. That is enough for the person already
 * in the call — they hear the newcomer — and not enough for the newcomer,
 * who hears nobody: their peers' video arrives without waiting for a roster,
 * so a tile appears with no name, no mute state and no hand on it, and stays
 * that way until the next heartbeat. Found by driving two peers at each other
 * rather than by reading the code, which is why it is a function with a test
 * rather than a line inside the switch in `lib/rtc.ts`.
 *
 * The rule that makes it terminate: answer only a peer we had not heard from.
 * Answering makes them known, so the same hello is never answered twice, and
 * their answer to our answer finds us already known at their end. Two extra
 * messages per arrival, and no more however many people are in the call.
 */
export function greets(signal: Signal, known: string[]): boolean {
  return signal.t === 'here' && !known.includes(signal.from);
}

/** One line of the in-call chat. */
export interface Line {
  id: string;
  from: string;
  name: string;
  body: string;
  at: number;
}

/** The most chat a call keeps. It is a call, not a transcript. */
export const KEPT = 200;

/**
 * The chat after one `said`.
 *
 * Trimmed to `KEPT` from the front, and it holds the sender's name *as it was
 * when they said it* rather than looking it up at render: somebody who leaves
 * has no roster entry any more, and their message should not become
 * "Unknown" the moment they hang up.
 */
export function heard(lines: Line[], signal: Signal, roster: Roster): Line[] {
  if (signal.t !== 'said') return lines;
  const body = signal.body.trim().slice(0, 2000);
  if (!body) return lines;
  const line: Line = {
    id: `${signal.from}-${signal.at}-${lines.length}`,
    from: signal.from,
    name: roster[signal.from]?.flags.name || 'Somebody',
    body,
    at: signal.at,
  };
  const next = [...lines, line];
  return next.length > KEPT ? next.slice(next.length - KEPT) : next;
}

/**
 * The marks people can throw at a call.
 *
 * Six, which is both Zoom's set and Meet's, near enough, and for the same
 * reason: a reaction is a thing you recognise at tile size and out of the
 * corner of your eye, and a picker of forty is a decision nobody wanted to
 * make in the middle of somebody's sentence. A hand is not here — it is not a
 * reaction, it goes in a queue and waits for a turn, so it is a flag on the
 * peer and is ordered by when it went up.
 */
export const MARKS = ['👍', '👏', '😂', '🎉', '😮', '❤️'] as const;

/** How long a mark hangs over a tile before it fades. */
export const FADES = 4_000;

/** A mark, while it is still on screen. */
export interface Mark {
  from: string;
  mark: string;
  at: number;
}

/**
 * The marks still showing, after one signal and at this moment.
 *
 * One per person: a second thumbs-up replaces the first rather than stacking,
 * because somebody leaning on the button should not be able to cover the call
 * in their own emoji. Expiry happens here rather than on a timer, so a call
 * left in a background tab does not accumulate a hundred of them.
 */
export function reacted(marks: Mark[], signal: Signal, now: number): Mark[] {
  const live = marks.filter((m) => now - m.at < FADES);
  if (signal.t !== 'react') return live.length === marks.length ? marks : live;
  if (!(MARKS as readonly string[]).includes(signal.mark)) return live;
  return [...live.filter((m) => m.from !== signal.from), { from: signal.from, mark: signal.mark, at: signal.at }];
}

/**
 * Who counts as the host: whoever has been here longest.
 *
 * There is no host in a mesh — no server, nobody with a switch — so this is
 * the only honest definition, and the only thing it unlocks is *asking*. The
 * screen is careful about that: "Ask everyone to mute" sends a request that
 * shows up as a line people can act on. It does not mute anybody, because
 * nothing here can, and a button that claimed to would be a lie somebody
 * relied on in a seminar.
 *
 * Ties are broken by id so that every tab in the call picks the same person,
 * which matters because they are all computing it separately.
 */
export function hostOf(roster: Roster, me: string, mine: number): string {
  const all = [...Object.values(roster), { id: me, joinedAt: mine } as Known];
  let best: { id: string; joinedAt: number } | null = null;
  for (const k of all) {
    if (!best || k.joinedAt < best.joinedAt || (k.joinedAt === best.joinedAt && k.id < best.id)) {
      best = { id: k.id, joinedAt: k.joinedAt };
    }
  }
  return best?.id ?? me;
}
