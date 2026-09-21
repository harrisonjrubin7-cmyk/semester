import { describe, expect, it } from 'vitest';
import {
  MORE_ON_SCREEN,
  MOST_SPOKEN,
  PHASES,
  SEE_SCREEN,
  enough,
  forSpeech,
  offersLine,
  step,
  type Event,
  type Phase,
} from './voiceloop';

/** Every event the loop can be handed, for the exhaustive sweeps below. */
const EVENTS: Event[] = [
  { t: 'start' },
  { t: 'stop' },
  { t: 'heard', text: 'what is due', final: false },
  { t: 'heard', text: 'what is due', final: true },
  { t: 'quiet', text: 'what is due on Wednesday' },
  { t: 'answered', text: 'Two things.' },
  { t: 'spoken' },
  { t: 'failed' },
];

describe('the microphone, which is the whole reason this is a machine', () => {
  /*
   * The echo. A phone speaking through its own speaker can hear itself, so
   * recognition running during `speaking` transcribes the answer, sends it as
   * the next question, and the loop is away — costing a request per turn and
   * unstoppable by staying quiet, because the person staying quiet is not the
   * one talking.
   *
   * Swept rather than sampled: 4 phases × 8 events is small enough to check
   * whole, and the case that would be missed by sampling is exactly the odd
   * one — a `heard` arriving in `speaking` from a recogniser winding down.
   */
  it('is open only while listening, from every phase and every event', () => {
    for (const phase of PHASES) {
      for (const e of EVENTS) {
        const got = step(phase, e);
        expect(got.mic, `${phase} + ${e.t} left mic=${got.mic} in ${got.phase}`).toBe(
          got.phase === 'listening',
        );
      }
    }
  });

  it('is shut the instant a question goes, not when the answer comes back', () => {
    // The gap between sending and answering is seconds long. Leaving the mic
    // open across it means the next thing said — to a person, in a corridor —
    // becomes a question nobody asked.
    const got = step('listening', { t: 'quiet', text: 'what is due on Wednesday' });
    expect(got.phase).toBe('thinking');
    expect(got.mic).toBe(false);
    expect(got.send).toBe('what is due on Wednesday');
  });
});

describe('stopping', () => {
  it('works from every phase', () => {
    for (const phase of PHASES) {
      expect(step(phase, { t: 'stop' }).phase).toBe('off');
      expect(step(phase, { t: 'stop' }).mic).toBe(false);
    }
  });

  it('is not undone by an answer that was already in flight', () => {
    /*
     * The ordering that actually happens: somebody presses stop while it is
     * thinking, and the request they cannot see completes a second later. If
     * `answered` woke the loop, the phone would start talking after being
     * told to stop — in a lecture, which is where somebody presses stop.
     */
    const off = step('thinking', { t: 'stop' });
    expect(off.phase).toBe('off');
    const after = step(off.phase, { t: 'answered', text: 'Two things are due.' });
    expect(after.phase).toBe('off');
    expect(after.speak).toBeUndefined();
    expect(after.mic).toBe(false);
  });

  it('is not undone by the voice finishing afterwards', () => {
    const after = step('off', { t: 'spoken' });
    expect(after.phase).toBe('off');
    expect(after.mic).toBe(false);
  });

  it('treats a failure as a stop rather than a retry', () => {
    // A refused microphone or a failed request, retried automatically, is a
    // loop that asks for permission forever. It stops and says so instead.
    for (const phase of PHASES) expect(step(phase, { t: 'failed' }).phase).toBe('off');
  });
});

describe('deciding somebody has finished talking', () => {
  it('does not send on a final result, because people pause mid-question', () => {
    // "so for the elasticity question… do I use the midpoint formula" arrives
    // as two finals and is one question.
    const got = step('listening', { t: 'heard', text: 'so for the elasticity question', final: true });
    expect(got.phase).toBe('listening');
    expect(got.send).toBeUndefined();
  });

  it('sends on silence, carrying what was said across the pauses', () => {
    const got = step('listening', {
      t: 'quiet',
      text: 'so for the elasticity question do I use the midpoint formula',
    });
    expect(got.send).toBe('so for the elasticity question do I use the midpoint formula');
  });

  it('keeps listening through a silence with nothing in it', () => {
    // A pause in an empty room is the commonest event of all, and it must not
    // cost a request.
    const got = step('listening', { t: 'quiet', text: '   ' });
    expect(got.phase).toBe('listening');
    expect(got.send).toBeUndefined();
  });
});

describe('enough', () => {
  it('rejects what a cough and a door sound like', () => {
    for (const noise of ['', '  ', '.', '...', 'uh', 'um', 'ummm', 'er', 'hmm', 'ah']) {
      expect(enough(noise), noise).toBe(false);
    }
  });

  it('accepts a short real answer to something the assistant asked', () => {
    // The assistant asks "shall I show the whole week?" and the reply is one
    // word. A word-count bar would throw it away.
    expect(enough('yes please')).toBe(true);
    expect(enough('midpoint')).toBe(true);
  });

  it('accepts an ordinary question', () => {
    expect(enough('what is due on Wednesday')).toBe(true);
  });
});

describe('an answer, as something worth hearing', () => {
  it('strips the marks a screen needs and a listener does not', () => {
    const said = forSpeech('## What is due\n\n- **ECON 1020** problem set — *Wednesday*\n');
    expect(said).not.toMatch(/[#*]/);
    expect(said).toContain('What is due');
    expect(said).toContain('ECON 1020');
  });

  it('reads a link as its words, never its address', () => {
    const said = forSpeech('See [the syllabus](https://example.edu/econ/syllabus.pdf).');
    expect(said).toContain('the syllabus');
    expect(said).not.toContain('http');
    expect(said).not.toContain('example.edu');
  });

  it('drops the deadline ids, which are not words', () => {
    // The context labels deadlines `[d-3]` so tool calls can name one. Read
    // aloud it is "bracket d dash three" in the middle of a sentence.
    const said = forSpeech('[d-3] PSCI reading response is due Thursday.');
    expect(said).not.toContain('d-3');
    expect(said).toContain('PSCI reading response is due Thursday');
  });

  it('leaves a table on the screen and says so, rather than reading pipes', () => {
    const said = forSpeech(
      'Here is the week.\n\n| Course | Due |\n| --- | --- |\n| ECON | Wed |\n| PSCI | Thu |\n',
    );
    expect(said).not.toContain('|');
    expect(said).toContain('Here is the week');
    expect(said).toContain(SEE_SCREEN);
  });

  it('does the same with fenced code, and does not lift a heading out of it', () => {
    const said = forSpeech('Try this.\n\n```\n## not a heading\nx = 1\n```\n');
    expect(said).not.toContain('x = 1');
    expect(said).not.toContain('not a heading');
    expect(said).toContain(SEE_SCREEN);
  });

  it('gives a heading a full stop so the voice falls', () => {
    // Without it the heading runs into the line below as one breathless
    // sentence, which is how a synthesised voice reads a list of headings.
    expect(forSpeech('## Grades\nYou are at 84%.')).toMatch(/Grades\.\s/);
  });

  it('hands the maths to `speakable` rather than keeping a second list', () => {
    // `lib/script.ts` owns that list and says why there is only one.
    const said = forSpeech('Elasticity is −1.2, so revenue falls when price rises by 10%.');
    expect(said).toContain('10 percent');
  });

  it('stops at a sentence when the answer is long, never mid-word', () => {
    const long = `${'The midpoint formula divides by the average. '.repeat(60)}`;
    const said = forSpeech(long);
    expect(said.length).toBeLessThan(MOST_SPOKEN + MORE_ON_SCREEN.length + 40);
    expect(said).toContain(MORE_ON_SCREEN);
    // What was read ends on a sentence, not half a word.
    expect(said.replace(` ${MORE_ON_SCREEN}`, '')).toMatch(/[.!?…]$/);
  });

  it('says one closing line, not two', () => {
    // A long answer with a table in it has two reasons for the same sentence.
    const said = forSpeech(
      `| a | b |\n| --- | --- |\n${'The midpoint formula divides by the average. '.repeat(60)}`,
    );
    expect(said).toContain(MORE_ON_SCREEN);
    expect(said).not.toContain(SEE_SCREEN);
  });

  it('is empty when there was nothing to say, so the loop does not wait', () => {
    // `step` reads this: an answer with no speech in it goes back to
    // listening rather than to `speaking`, where it would wait for a `spoken`
    // that the voice was never asked to fire.
    expect(forSpeech('')).toBe('');
    expect(forSpeech('   \n\n  ')).toBe('');
    expect(step('thinking', { t: 'answered', text: '' }).phase).toBe('listening');
    expect(step('thinking', { t: 'answered', text: '' }).speak).toBeUndefined();
  });

  it('still says where to look when the whole answer was a table', () => {
    const said = forSpeech('| Course | Due |\n| --- | --- |\n| ECON | Wed |\n');
    expect(said).toBe(SEE_SCREEN);
    // And that is sayable, so the loop speaks it rather than going silent.
    expect(step('thinking', { t: 'answered', text: '| a | b |\n| --- | --- |\n' }).phase).toBe(
      'speaking',
    );
  });
});

describe('offers', () => {
  it('names them and leaves them standing', () => {
    expect(offersLine(0)).toBe('');
    expect(offersLine(1)).toContain('one thing');
    expect(offersLine(3)).toContain('3 things');
    // Never a claim that anything happened. `ai/prompt.ts` promises a tool
    // call is a line with a button beside it, and a hands-free mode is the
    // one place that promise could be broken without anybody seeing it.
    for (const n of [1, 2, 5]) {
      expect(offersLine(n)).toMatch(/waiting on the screen/);
      expect(offersLine(n)).not.toMatch(/\bdone\b|\bapplied\b|\bI have\b/i);
    }
  });
});

describe('a whole turn', () => {
  it('goes listen, think, speak, listen', () => {
    let phase: Phase = 'off';
    const seen: Phase[] = [];

    const drive = (e: Event) => {
      const got = step(phase, e);
      phase = got.phase;
      seen.push(phase);
      return got;
    };

    drive({ t: 'start' });
    drive({ t: 'heard', text: 'what is due', final: false });
    const sent = drive({ t: 'quiet', text: 'what is due on Wednesday' });
    expect(sent.send).toBe('what is due on Wednesday');
    const spoke = drive({ t: 'answered', text: 'Two things: the ECON problem set and a reading.' });
    expect(spoke.speak).toContain('Two things');
    drive({ t: 'spoken' });

    expect(seen).toEqual(['listening', 'listening', 'thinking', 'speaking', 'listening']);
  });
});
