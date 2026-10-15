#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolveProductionTarget } from './production-target.mjs';

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

async function configuration() {
  let committed = {};
  try {
    committed = parseEnv(await readFile(new URL('../.env.production', import.meta.url), 'utf8'));
  } catch {
    // A deployment may supply both values without carrying the repository's
    // defaults. The validation below remains the one source of truth.
  }
  const target = resolveProductionTarget(
    process.env.SEMESTER_PUBLIC_APP_TARGET,
    process.env.SEMESTER_PUBLIC_APP_URL,
  );
  return {
    ...target,
    supabase: (process.env.VITE_SUPABASE_URL || committed.VITE_SUPABASE_URL || '').replace(/\/$/, ''),
    key: process.env.VITE_SUPABASE_KEY || committed.VITE_SUPABASE_KEY || '',
  };
}

async function request(label, url, init = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(`${label} could not be reached.`);
  }
  if (!response.ok) throw new Error(`${label} returned ${response.status}.`);
  console.log(`  ok   ${label} (${response.status})`);
  return response;
}

function asset(html, expression, label) {
  const match = html.match(expression);
  if (!match) throw new Error(`Frontend HTML did not name a ${label}.`);
  return match[1];
}

export async function runPublicProductionSmoke() {
  const { app, label, supabase, key } = await configuration();
  if (!supabase.startsWith('https://') || !key) {
    throw new Error('Production Supabase URL and publishable key must both be configured.');
  }

  const nonce = Date.now();
  const page = await request('frontend HTML', `${app}/?monitor=${nonce}`, {
    headers: { 'cache-control': 'no-cache' },
  });
  const html = await page.text();
  if (!/<title>Semester<\/title>/i.test(html)) throw new Error('Frontend HTML was not Semester.');

  const modulePath = asset(html, /<script[^>]+type="module"[^>]+src="([^"]+)"/i, 'module asset');
  const stylePath = asset(html, /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/i, 'stylesheet asset');
  await request('frontend module asset', new URL(modulePath, `${app}/`).href);
  await request('frontend stylesheet asset', new URL(stylePath, `${app}/`).href);

  const schools = await request(
    'Supabase PostgREST',
    `${supabase}/rest/v1/schools?select=id&limit=1`,
    { headers: { apikey: key, authorization: `Bearer ${key}` } },
  );
  const body = await schools.json();
  if (!Array.isArray(body)) throw new Error('Supabase PostgREST did not return a JSON array.');

  console.log(`\n${label}, deployed assets and Supabase API are reachable.`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runPublicProductionSmoke().catch(error => {
    console.error(`  FAIL ${error instanceof Error ? error.message : 'Public production smoke failed.'}`);
    process.exitCode = 1;
  });
}
