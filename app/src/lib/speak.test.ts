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
