import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A streamed answer is announced once, whole — not a word at a time.
 *
 * Both conversation surfaces render the transcript as `role="log"` with
 * `aria-live="polite"`, so a completed turn is read out when it lands and
 * waits for the reader to pause. The text arriving token by token is the
 * sighted view of the same turn, and it is rendered inside an `aria-hidden`
 * element: a live region containing it would announce every token, which
 * is unusable (EC-A11Y-02). Nothing held either half until now, and the two
 * surfaces carry the same block twice, so one could drift from the other.
 *
 * This reads the shape of the source, not a screen reader's output. It can
 * tell an `assertive` log, a missing `aria-hidden`, or a streaming block
 * moved out of one, from the code; it cannot tell what a given screen
 * reader does with a polite log (EC-A11Y-09).
 */

const here = join(import.meta.dirname);
const SURFACES = ['Chat.tsx', 'Panel.tsx'] as const;

/** The JSX opening tag that contains `at`: from the nearest `<` before it to the first `>` after it. */
function openingTag(src: string, at: number): string {
  const start = src.lastIndexOf('<', at);
  const end = src.indexOf('>', at);
  expect(start, 'the attribute is inside a tag').toBeGreaterThanOrEqual(0);
  return src.slice(start, end + 1);
}

/**
 * The `<div …>` tags still open at `at`, nearest first: a balanced walk that
 * pops on `</div>`, so a container closed before the streaming block is not
 * counted as its ancestor. The first draft collected every earlier opening
 * tag, which Codex found would stay green with the stream moved out of both.
 */
function enclosingDivs(src: string, at: number): string[] {
  const stack: string[] = [];
  for (const m of src.slice(0, at).matchAll(/<div\b[^>]*>|<\/div>/g)) {
    if (m[0] === '</div>') stack.pop();
    else if (!m[0].endsWith('/>')) stack.push(m[0]);
  }
  return stack.reverse();
}

const shape = (src: string) => {
  const logs = [...src.matchAll(/role="log"/g)].map((m) => openingTag(src, m.index!));
  const streams = [...src.matchAll(/\{talk\.streaming && </g)].map((m) => enclosingDivs(src, m.index!));
  return { logs, streams };
};

describe.each(SURFACES)('%s', (file) => {
  const src = readFileSync(join(here, file), 'utf8');
  const { logs, streams } = shape(src);

  it('renders the conversation as one polite log', () => {
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('aria-live="polite"');
    expect(logs[0]).not.toContain('assertive');
  });

  it('renders the streaming text aria-hidden, so the log announces the turn only when it lands', () => {
    expect(streams).toHaveLength(1);
    // The nearest enclosing div is the one that hides it; the log is further out.
    const [nearest] = streams[0];
    expect(nearest, 'the streaming block sits in an aria-hidden element').toMatch(/^<div aria-hidden[\s>]/);
    expect(streams[0].some((d) => d.includes('role="log"')), 'the hidden block is inside the log, not beside it').toBe(true);
  });
});

describe('the shape reader', () => {
  it('reads a leaky surface as leaky', () => {
    const leaky = '<div role="log" aria-live="assertive"><div>{talk.streaming && <Reply />}</div></div>';
    const { logs, streams } = shape(leaky);
    expect(logs[0]).toContain('assertive');
    expect(streams[0][0]).not.toMatch(/aria-hidden/);
  });

  it('does not count a container closed before the stream as its ancestor', () => {
    const closedHidden = '<div role="log" aria-live="polite"><div aria-hidden>x</div>{talk.streaming && <Reply />}</div>';
    expect(shape(closedHidden).streams[0][0]).toMatch(/^<div role="log"/);
    const outsideLog = '<div role="log" aria-live="polite">y</div><div aria-hidden>{talk.streaming && <Reply />}</div>';
    expect(shape(outsideLog).streams[0].some((d) => d.includes('role="log"'))).toBe(false);
    const selfClosing = '<div role="log" aria-live="polite"><div aria-hidden><div className="rule" />{talk.streaming && <Reply />}</div></div>';
    expect(shape(selfClosing).streams[0]).toHaveLength(2);
  });
});
