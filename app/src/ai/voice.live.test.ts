import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { check, report } from '../lib/voice';
import { systemPrompt } from './prompt';
import type { Mode } from '../lib/mode';

/**
 * The ten questions, through the real prompt, against the real model.
 *
 *     ANTHROPIC_API_KEY=sk-ant-… npx vitest run src/ai/voice.live.test.ts
 *
 * ## Why this is a test and not a document
 *
 * "Does it still open with pleasantries" is a question about the model's
 * behaviour, and the only way to answer it is to ask the model. Reading the
 * prompt and agreeing that it says the right things proves that the prompt
 * says the right things — a different claim, and the one it is easy to
 * mistake for the first.
 *
 * ## Why it skips
 *
 * It costs money and needs a key, so with no `ANTHROPIC_API_KEY` in the
 * environment every case here is skipped and the suite stays green. That is
 * deliberate rather than convenient: a check that quietly passes when it
 * cannot run is worse than one that is absent, so vitest reports these as
 * *skipped* — visible in the output, and not counted as evidence.
 *
 * The prompt-assembly cases below do run without a key, because they need
 * nothing sent.
 *
 * ## The ten
 *
 * Chosen for the three modes and, more to the point, for the three shapes of
 * answer the voice rules are about: a question whose honest answer is one
 * sentence, a question that genuinely has parts, and a question the app
 * cannot do at all. Ten questions that all deserve four paragraphs would say
 * nothing about the rule against padding a one-line answer.
 */

const KEY = process.env.ANTHROPIC_API_KEY ?? '';
const MODEL = process.env.VOICE_MODEL ?? 'claude-opus-5';

/**
 * A term to answer about.
 *
 * Not the app's own sample data pulled through the store: this file does not
 * render React, and standing one up to get four courses would make it a test
 * of the store. What a voice check needs is a context realistic in shape —
 * dated items with ids, weights, a screen — and identical on every run, which
 * a live store would not be.
 */
const CONTEXT = readFileSync(new URL('./voice-context.md', import.meta.url), 'utf8');

const QUESTIONS: { mode: Mode; q: string; shape: string }[] = [
  { mode: 'grounded', q: 'When is the ECON 1020 final?', shape: 'one sentence' },
  { mode: 'grounded', q: 'How much is the PSCI midterm worth?', shape: 'one sentence' },
  { mode: 'grounded', q: 'Do I have anything due tomorrow?', shape: 'one sentence' },
  { mode: 'grounded', q: 'What should I work on this week?', shape: 'has parts' },
  { mode: 'grounded', q: 'Where do I stand across the four courses?', shape: 'has parts' },
  { mode: 'grounded', q: 'Change my ECON grade to an A.', shape: 'cannot' },
  { mode: 'grounded', q: 'Email Professor Larsen and ask for an extension.', shape: 'cannot' },
  { mode: 'app', q: 'How do I add a course from a syllabus?', shape: 'has parts' },
  { mode: 'app', q: 'Can this app text me reminders?', shape: 'cannot' },
  { mode: 'general', q: 'Explain price elasticity of demand so I can use it in an essay.', shape: 'has parts' },
];

async function answer(mode: Mode, question: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      system: systemPrompt(mode, CONTEXT),
      messages: [{ role: 'user', content: question }],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { content: { type: string; text?: string }[] };
  return body.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
}

describe.skipIf(!KEY)('the ten questions, answered', () => {
  for (const { mode, q, shape } of QUESTIONS) {
    it(
      `[${mode}/${shape}] ${q}`,
      async () => {
        const text = await answer(mode, q);
        // Printed whether it passes or not: the answer is the thing being
        // judged, and a run that only says "ok" gives nobody a way to
        // disagree with the rubric.
        console.log(`\n${report(q, text)}\n${text.replace(/^/gm, '  │ ')}\n`);
        expect(check(text)).toEqual([]);

        // Length is not a rule, because the right length depends on the
        // question. But a one-sentence question answered in two hundred
        // words is the padding failure the rubric cannot see, so the one
        // shape with an objective ceiling gets one.
        if (shape === 'one sentence') {
          expect(text.split(/\s+/).length).toBeLessThan(60);
        }
      },
      60_000,
    );
  }
});

/**
 * The half that needs no key.
 *
 * Not a substitute for the above and not presented as one — this checks that
 * the prompt says what it is supposed to say, which is the claim that does
 * not need the model. It is here rather than in `prompt.test.ts` because it
 * is about the same ten questions: every one of them has to reach a prompt
 * that carries the voice rules, and the mode switch is the thing that could
 * quietly drop them.
 */
describe('every question reaches a prompt with the voice rules in it', () => {
  for (const { mode, q } of QUESTIONS) {
    it(`[${mode}] ${q}`, () => {
      const built = systemPrompt(mode, CONTEXT);
      expect(built).toContain('First sentence answers the question');
      expect(built).toContain('Stop when the answer is finished');
      expect(built).toContain('Match the length to the question');
    });
  }

  it('tells the grounded and general modes they cannot act, but not the app mode', () => {
    // The app mode has no tools in play and no records in front of it — it is
    // answering out of the guidebook — so the paragraph about proposals would
    // be describing machinery that is not there.
    expect(systemPrompt('grounded', CONTEXT)).toContain('Nothing you call happens');
    expect(systemPrompt('general', CONTEXT)).toContain('Nothing you call happens');
    expect(systemPrompt('app', CONTEXT)).not.toContain('Nothing you call happens');
  });

  it('keeps the student out of the app-mode prompt entirely', () => {
    // A question about how the app works does not need their grades, and the
    // cheapest way to never leak them is to never assemble them.
    const built = systemPrompt('app', CONTEXT);
    expect(built).not.toContain('ECON 1020');
    expect(built).not.toContain('Larsen');
  });
});
