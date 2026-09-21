import { useCallback, useEffect, useRef, useState } from 'react';
import { dictate, dictationSupported } from '../lib/mic';
import { canSpeak, hush, speakThen } from '../lib/speak';
import {
  QUIET_MS,
  forSpeech,
  offersLine,
  step,
  type Doing,
  type Event,
  type Phase,
} from '../lib/voiceloop';
import type { Conversation } from './converse';

/**
 * The voice loop, wired to a real conversation.
 *
 * `lib/voiceloop.ts` is the machine and says why it is one; this is the part
 * that cannot be pure — the microphone, the voice, the request, and the three
 * timers between them. Everything here that could be a decision is delegated
 * to `step`, so this file has no opinion about when to listen. It only does
 * what the last step said.
 *
 * ## Why the answer is watched rather than awaited
 *
 * `talk.send` returns a promise, and awaiting it looks like the obvious way
 * to know the answer arrived. It is not: the same conversation is driven by
 * the composer and by the sheet, so an answer can complete that this loop
 * never sent, and a question can be sent from the box while the loop is
 * listening. Watching `busy` fall and reading the turn that landed is true in
 * all of those; awaiting one promise is true only in the case this file
 * happened to cause.
 */
export interface Voice {
  /** Where the loop is. `off` unless somebody turned it on. */
  phase: Phase;
  on: boolean;
  /** Whether this browser can do both halves. False hides the control. */
  supported: boolean;
  /** What it has heard this turn, for showing back before it goes. */
  heard: string;
  /** Why it stopped, when it stopped itself. Empty otherwise. */
  said: string;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useVoice(talk: Conversation): Voice {
  const [phase, setPhase] = useState<Phase>('off');
  const [heard, setHeard] = useState('');
  const [said, setSaid] = useState('');

  /*
   * The phase, readable from inside a callback that was created in an earlier
   * render. Every one of these — the recogniser's `onresult`, the quiet
   * timer, the utterance's `onend` — outlives the render that made it, and
   * reading `phase` in them would be reading whatever it was when the closure
   * was built. The ref is the loop's actual state; the state above is for
   * drawing.
   */
  const at = useRef<Phase>('off');
  const held = useRef('');
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopMic = useRef<(() => void) | null>(null);
  const stopVoice = useRef<(() => void) | null>(null);
  /** The turn count when the last question went, so the reply can be found. */
  const sentAt = useRef(-1);

  const supported = dictationSupported() && canSpeak();

  const clearQuiet = () => {
    if (quiet.current) clearTimeout(quiet.current);
    quiet.current = null;
  };

  /*
   * `talk` changes identity every render — it is a hook's return value — so a
   * callback that closed over it would be rebuilt constantly and every effect
   * keyed on it would re-run. The ref keeps one live reference the loop can
   * read at the moment it needs it.
   *
   * Written in an effect rather than during the render. A ref assigned while
   * rendering is a side effect in a function React may call twice or throw
   * away, and oxlint says so. Everything that reads it — a timer, a
   * recogniser callback, an utterance ending — runs after effects have
   * flushed, so it is never the stale one.
   */
  const conv = useRef(talk);
  useEffect(() => {
    conv.current = talk;
  });

  /**
   * The loop's own re-entry point.
   *
   * `apply` ends by stepping the machine again — the quiet timer, the
   * recogniser, the utterance finishing all feed their result straight back
   * in — and a `useCallback` that names itself inside its own initialiser is
   * reading a binding that does not exist yet. So the recursion goes through
   * this, set below once `apply` is built.
   */
  const again = useRef<(got: Doing) => void>(() => {});

  /** Carry out what a step decided, and remember where it left the loop. */
  const apply = useCallback((got: Doing) => {
    at.current = got.phase;
    setPhase(got.phase);

    // The microphone first, and before anything that makes a noise. `got.mic`
    // is the only thing that decides — see the note in `lib/voiceloop.ts`
    // about hearing its own answer.
    if (got.mic && !stopMic.current) {
      held.current = '';
      setHeard('');
      stopMic.current = dictate(
        (text) => {
          held.current = text;
          setHeard(text);
          // Any sound restarts the clock: the pause that sends is a pause
          // since the last thing heard, not since the turn began.
          clearQuiet();
          quiet.current = setTimeout(() => {
            again.current(step(at.current, { t: 'quiet', text: held.current }));
          }, QUIET_MS);
        },
        (message) => {
          // `no-speech` is a quiet room, not a fault, and stopping on it would
          // end the mode every time somebody thought for four seconds.
          if (/nothing was heard/i.test(message)) return;
          setSaid(message);
          again.current(step(at.current, { t: 'failed' }));
        },
      );
    } else if (!got.mic && stopMic.current) {
      stopMic.current();
      stopMic.current = null;
      clearQuiet();
    }

    if (got.phase === 'off') {
      stopVoice.current?.();
      stopVoice.current = null;
      hush();
      setHeard('');
    }

    if (got.send) {
      setHeard(got.send);
      sentAt.current = conv.current.turns.length;
      void conv.current.send(got.send);
    }

    if (got.speak) {
      stopVoice.current?.();
      stopVoice.current = speakThen(got.speak, 1, () => {
        stopVoice.current = null;
        again.current(step(at.current, { t: 'spoken' }));
      });
    }
  }, []);

  useEffect(() => {
    again.current = apply;
  }, [apply]);

  const fire = useCallback((e: Event) => apply(step(at.current, e)), [apply]);

  const start = useCallback(() => {
    setSaid('');
    fire({ t: 'start' });
  }, [fire]);
  const stop = useCallback(() => fire({ t: 'stop' }), [fire]);
  const toggle = useCallback(() => {
    if (at.current === 'off') start();
    else stop();
  }, [start, stop]);

  /*
   * The answer, noticed rather than awaited.
   *
   * Runs on every render while thinking and does nothing until `busy` falls,
   * which is the only moment the last turn is whole. `sentAt` is what stops it
   * reading an answer to a question typed into the box while the loop was
   * listening — a real sequence, because the composer and this share one
   * conversation.
   */
  useEffect(() => {
    if (at.current !== 'thinking' || talk.busy) return;
    const last = talk.turns[talk.turns.length - 1];
    if (!last || last.role !== 'assistant' || talk.turns.length <= sentAt.current) return;

    if (talk.said) {
      // The request failed and `lib/trouble.ts` has the sentence for it. The
      // loop says nothing of its own: it is already on screen.
      fire({ t: 'failed' });
      return;
    }
    const offers = offersLine(talk.proposals.length);
    const words = forSpeech(last.content);
    apply(
      step(at.current, {
        t: 'answered',
        // The offers are named after the answer rather than instead of it, so
        // a reply that was mostly an offer still says what it was about.
        text: offers && words ? `${last.content}\n\n${offers}` : last.content || offers,
      }),
    );
  }, [talk.busy, talk.turns, talk.said, talk.proposals, apply, fire]);

  /*
   * The mode does not survive leaving.
   *
   * An unmount with the recogniser running leaves the microphone indicator
   * lit on a screen that is gone, and an utterance mid-sentence keeps reading
   * an answer the person navigated away from — which is the complaint
   * `lib/speak.ts:hush` exists for.
   */
  useEffect(
    () => () => {
      stopMic.current?.();
      stopMic.current = null;
      stopVoice.current?.();
      stopVoice.current = null;
      if (quiet.current) clearTimeout(quiet.current);
      hush();
      at.current = 'off';
    },
    [],
  );

  return { phase, on: phase !== 'off', supported, heard, said, start, stop, toggle };
}
