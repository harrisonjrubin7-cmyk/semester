// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canSpeak, hush, readAloud, say, spoken, writeAloud } from './speak';

const card = { q: 'What is deadweight loss?', a: 'The surplus nobody gets.' };

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'speechSynthesis');
  localStorage.clear();
});

/** A browser voice, as far as this module is concerned. */
function fitVoice() {
  const spoke: string[] = [];
  let cancels = 0;
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      speak: (u: SpeechSynthesisUtterance) => spoke.push(u.text),
      cancel: () => {
        cancels += 1;
      },
    },
  });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string;
      rate = 1;
      constructor(text: string) {
        this.text = text;
      }
    },
  );
  return {
    spoke,
    get cancels() {
      return cancels;
    },
  };
}

describe('whether it can speak at all', () => {
  it('says no when the browser has no voice', () => {
    expect(canSpeak()).toBe(false);
  });

  it('says yes when it does', () => {
    fitVoice();
    expect(canSpeak()).toBe(true);
  });

  it('stays silent rather than throwing where there is none', () => {
    // A missing voice costs a feature, not a screen.
    expect(() => say('anything')).not.toThrow();
    expect(() => hush()).not.toThrow();
  });
});

describe('saying something', () => {
  it('cancels what was being said first', () => {
    // Tapping through three cards quickly should leave the third being read,
    // not all three queued behind two you have already answered.
    const v = fitVoice();
    say('one');
    say('two');
    expect(v.spoke).toEqual(['one', 'two']);
    expect(v.cancels).toBe(2);
  });

  it('does not read out an empty string', () => {
    const v = fitVoice();
    say('   ');
    expect(v.spoke).toEqual([]);
  });

  it('survives a browser that has the object and refuses the call', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: () => {
          throw new Error('not allowed');
        },
        cancel: () => {},
      },
    });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    expect(() => say('anything')).not.toThrow();
  });
});

describe('what gets read', () => {
  it('reads the question before the turn and the answer after it', () => {
    // Reading "the answer is" into somebody's ear before they have tried to
    // recall it defeats the exercise; reading the question twice is what
    // makes people switch the voice off.
    expect(spoken(card, false)).toBe(card.q);
    expect(spoken(card, true)).toBe(card.a);
  });
});

describe('the preference', () => {
  it('is off until it is turned on', () => {
    expect(readAloud()).toBe(false);
    writeAloud(true);
    expect(readAloud()).toBe(true);
    writeAloud(false);
    expect(readAloud()).toBe(false);
  });
});

describe('reading a lesson, one beat at a time', () => {
  /**
   * A voice that finishes after a stated delay, and can be told to finish
   * instantly — which is the case that matters, because that is what a
   * browser with no voice installed does.
   */
  function voice(after: number) {
    const spoke: string[] = [];
    let pending: (() => void) | null = null;
    let failing: (() => void) | null = null;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: (u: SpeechSynthesisUtterance & { onend?: () => void; onerror?: () => void }) => {
          spoke.push(u.text);
          pending = () => u.onend?.();
          failing = () => u.onerror?.();
        },
        cancel: () => {},
      },
    });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string;
        rate = 1;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    return {
      spoke,
      finish: () => {
        vi.advanceTimersByTime(after);
        pending?.();
      },
      fail: () => {
        vi.advanceTimersByTime(after);
        failing?.();
      },
    };
  }

  afterEach(() => vi.useRealTimers());

  it('reports a sentence that took time to say as said', async () => {
    vi.useFakeTimers();
    const { speakThen } = await import('./speak');
    const heard: boolean[] = [];
    const v = voice(1200);
    speakThen('A whole sentence, read out.', 1, (spoke) => heard.push(spoke));
    v.finish();
    expect(heard).toEqual([true]);
  });

  it('reports a sentence that came back instantly as not said', async () => {
    /*
     * The failure this exists for, measured in headless Chromium:
     * `'speechSynthesis' in window` is true, `getVoices()` is empty, and every
     * utterance completes at once. A lesson advancing on completion raced
     * through six beats in under a second and a half, in silence.
     *
     * Counting voices is the obvious check and is not reliable — the list
     * loads asynchronously and is empty on the first call in browsers that do
     * have one. How long it took is reliable, and does not care why.
     */
    vi.useFakeTimers();
    const { speakThen } = await import('./speak');
    const heard: boolean[] = [];
    const v = voice(0);
    speakThen('A whole sentence, read out.', 1, (spoke) => heard.push(spoke));
    v.finish();
    expect(heard).toEqual([false]);
  });

  it('reports a sentence the browser refused as not said, however long it took', async () => {
    // A voice that errors after a plausible delay is still a voice that said
    // nothing. Reading on from there would be the same silent race as the
    // instant case, arrived at more slowly.
    vi.useFakeTimers();
    const { speakThen } = await import('./speak');
    const heard: boolean[] = [];
    const v = voice(1200);
    speakThen('A whole sentence, read out.', 1, (spoke) => heard.push(spoke));
    v.fail();
    expect(heard).toEqual([false]);
  });

  it('says nothing back at all once it has been stopped', async () => {
    // `onend` does not fire on a cancel, so a stop that left the callbacks
    // attached would be indistinguishable from the sentence finishing.
    vi.useFakeTimers();
    const { speakThen } = await import('./speak');
    const heard: boolean[] = [];
    const v = voice(1200);
    const stop = speakThen('A whole sentence, read out.', 1, (spoke) => heard.push(spoke));
    stop();
    v.finish();
    expect(heard).toEqual([]);
  });

  it('does not try where there is no speech at all', async () => {
    const { speakThen } = await import('./speak');
    const heard: boolean[] = [];
    const stop = speakThen('Anything.', 1, (spoke) => heard.push(spoke));
    stop();
    expect(heard).toEqual([]);
  });
});
