// Minimal test harness: no dependencies, runs under plain node after an esbuild bundle (see tests/run.sh).
import { deepStrictEqual } from 'node:assert';

type Result = { name: string; ok: boolean; error?: string };
const results: Result[] = [];
const queue: Promise<void>[] = [];

export function test(name: string, fn: () => void | Promise<void>) {
  queue.push(Promise.resolve().then(fn).then(
    () => { results.push({ name, ok: true }); },
    (e: unknown) => { results.push({ name, ok: false, error: e instanceof Error ? e.message : String(e) }); },
  ));
}

export const eq = (actual: unknown, expected: unknown) => deepStrictEqual(actual, expected);

export async function report(file: string) {
  await Promise.all(queue);
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${file} › ${r.name}${r.error ? `\n      ${r.error.split('\n')[0]}` : ''}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${file}: ${results.length - failed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}
