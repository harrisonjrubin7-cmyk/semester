#!/usr/bin/env node
/**
 * Rewrite a podcast script in a hosting style.
 *
 *     node pipeline/restyle-script.mjs audio/scripts/econ1020.json --style storyteller
 *     node pipeline/restyle-script.mjs audio/scripts/econ1020.json --all-styles --dry-run
 *
 * Step 3 of docs/VIDEO_PODCAST_ROADMAP.md. `make-script.mjs` says outright that
 * its draft "will be correct and a little mechanical" and that the openings,
 * the transitions and the close are the parts worth rewriting by hand. This is
 * that rewrite, done by a model, over the whole script rather than the joins.
 *
 * ## What it will not do
 *
 * The script teaches a real course and students revise from it, so the rewrite
 * is allowed to change how it sounds and nothing else. `restyle.mjs` holds the
 * rules and enforces them: the model's answer is checked before it is written,
 * and a rewrite that invents a figure, drops one, renames a chapter, or loses
 * a self-test's answering silence is discarded rather than saved for editing.
 *
 * ## Authoring-time, not per student
 *
 * This reads `ANTHROPIC_API_KEY` from the environment and calls the API
 * directly. It deliberately does **not** go through `supabase/functions/claude`:
 * that Edge Function exists to give a signed-in student a metered share of a
 * server-side key, with the auth and rate limiting that implies. Whoever runs
 * this pipeline is not a student, runs it once per course rather than per
 * request, and should be spending their own budget — routing an operator tool
 * through the student path would put authoring traffic on a student's quota and
 * make the Edge Function's limits a thing to work around.
 *
 * Install the SDK once:  cd pipeline && npm install
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { check, parseReply, prompt, restyledScript } from './restyle.mjs';
import { STYLES, STYLE_IDS } from './styles.mjs';

const MODEL = 'claude-opus-5';
/** Per million tokens, from the model's published rates. */
const PRICE = { input: 5, output: 25 };

function usage(message) {
  console.error(
    `${message}\n\n` +
      'node pipeline/restyle-script.mjs <script.json> --style <id> [--dry-run] [-o dir]\n' +
      'node pipeline/restyle-script.mjs <script.json> --all-styles [--dry-run]\n\n' +
      `styles: ${STYLE_IDS.join(', ')}`,
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const scriptPath = argv.find((a) => !a.startsWith('--') && a.endsWith('.json'));
if (!scriptPath) usage('Name a script to restyle.');
if (!existsSync(scriptPath)) usage(`No script at ${scriptPath}`);

const dry = argv.includes('--dry-run');
const all = argv.includes('--all-styles');
const outDir = flag('o', dirname(scriptPath));

const wanted = all ? STYLE_IDS : [flag('style')];
if (!all && !wanted[0]) usage('Pass --style <id>, or --all-styles.');
for (const id of wanted) {
  if (!STYLES[id]) usage(`Unknown style "${id}".`);
}

const original = JSON.parse(readFileSync(scriptPath, 'utf8'));
if (!Array.isArray(original.lines) || !original.lines.length) {
  usage(`${scriptPath} has no lines.`);
}

/*
 * What this would cost, before it costs it.
 *
 * The first generator in this pipeline where `--dry-run` is about money rather
 * than minutes. The token count is exact when a key is present — the API is
 * asked — and a local estimate labelled as such when it is not, so the shot
 * list still prints on a machine that cannot call anything.
 */
const words = original.lines.reduce((n, l) => n + String(l.t).split(/\s+/).length, 0);
console.log(
  `${basename(scriptPath)}: ${original.lines.length} lines, ~${words} words, ` +
    `${wanted.length} style${wanted.length === 1 ? '' : 's'}`,
);

let client = null;
let inputTokens = null;
const haveKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

if (haveKey) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  client = new Anthropic();
  const counted = await client.messages.countTokens({
    model: MODEL,
    messages: [{ role: 'user', content: prompt(original, STYLES[wanted[0]]) }],
  });
  inputTokens = counted.input_tokens;
} else {
  // Four characters a token is the usual rule of thumb; it is an estimate and
  // is printed as one rather than dressed up as a measurement.
  inputTokens = Math.round(JSON.stringify(original.lines).length / 4);
}

/*
 * Output is assumed to be about the size of the input: a restyle rewrites the
 * same material, so it returns roughly the same number of lines. It is the
 * estimate that can be wrong in the expensive direction, so it is stated.
 */
const perStyle = (inputTokens * PRICE.input + inputTokens * PRICE.output) / 1_000_000;
console.log(
  `  ${MODEL}: ~${inputTokens.toLocaleString()} input tokens` +
    `${haveKey ? ' (counted)' : ' (estimated at 4 chars/token — no key set)'}, ` +
    `output assumed similar`,
);
console.log(
  `  ~$${perStyle.toFixed(2)} per style, ~$${(perStyle * wanted.length).toFixed(2)} for this run`,
);
for (const id of wanted) console.log(`    ${id.padEnd(18)} ${STYLES[id].label}`);

if (dry) {
  console.log('\n--dry-run: nothing sent, nothing written, nothing spent.');
  process.exit(0);
}

if (!client) {
  console.error(
    '\nANTHROPIC_API_KEY is not set. This is an authoring-time operator tool and\n' +
      'spends your own budget — export a key, or run with --dry-run to see the cost.',
  );
  process.exit(1);
}

let failures = 0;

for (const id of wanted) {
  const style = STYLES[id];
  process.stdout.write(`\n${id}: asking… `);

  let restyled;
  try {
    /*
     * Streamed because a whole episode is a long output — 4,400 words for
     * ECON — and a non-streaming request at this `max_tokens` is what HTTP
     * timeouts are made of.
     */
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      system: [
        {
          type: 'text',
          text:
            'You restyle educational podcast scripts. You change how they sound. ' +
            'You never change what they say.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: prompt(original, style) }],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      console.log(`refused (${message.stop_details?.category ?? 'no category'}).`);
      failures += 1;
      continue;
    }
    if (message.stop_reason === 'max_tokens') {
      console.log('ran out of output tokens — the script came back truncated.');
      failures += 1;
      continue;
    }

    restyled = parseReply(
      message.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join(''),
    );
    const { input_tokens: inTok, output_tokens: outTok } = message.usage;
    process.stdout.write(
      `${inTok.toLocaleString()} in / ${outTok.toLocaleString()} out ` +
        `($${((inTok * PRICE.input + outTok * PRICE.output) / 1_000_000).toFixed(2)}) `,
    );
  } catch (error) {
    console.log(`failed: ${error instanceof Error ? error.message : String(error)}`);
    failures += 1;
    continue;
  }

  const problems = check(original, restyled);
  if (problems.length) {
    console.log('rejected:');
    for (const p of problems) console.log(`    · ${p}`);
    console.log('  Nothing written. A restyle that changes the facts is worse than none.');
    failures += 1;
    continue;
  }

  const out = restyledScript(original, id, style, restyled.lines);
  const name = `${basename(scriptPath, '.json')}.${id}.json`;
  const path = join(outDir, name);
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(`→ ${path}`);
}

if (failures) {
  console.error(`\n${failures} of ${wanted.length} styles did not produce a usable script.`);
}

console.log(
  '\nNext, for each script written:\n' +
    `  python3 audio/synth.py <script> app/public/audio\n` +
    '  cd app && npm run transcripts    # the script is the transcript; both move together',
);
process.exit(failures ? 1 : 0);
