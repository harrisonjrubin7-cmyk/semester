#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const DEFAULT_APP = 'https://harrisonjrubin7-cmyk.github.io/semester';

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
  return {
    app: (process.env.SEMESTER_PUBLIC_APP_URL || DEFAULT_APP).replace(/\/$/, ''),
    supabase: (process.env.VITE_SUPABASE_URL || committed.VITE_SUPABASE_URL || '').replace(/\/$/, ''),
    key: process.env.VITE_SUPABASE_KEY || committed.VITE_SUPABASE_KEY || '',
    expectedReleaseSha: process.env.SEMESTER_EXPECTED_RELEASE_SHA || '',
  };
}

const SHA = /^[0-9a-f]{40}$/;

/**
 * Fail closed when the deployed bundle cannot prove that it is the intended,
 * generally available production build. The manifest contains only public,
 * non-secret states and booleans; release-manifest.ts owns its schema.
 */
export function validateProductionRelease(manifest, expectedSha = '') {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Release manifest was not a JSON object.');
  }
  if (expectedSha && !SHA.test(expectedSha)) {
    throw new Error('Expected release SHA was not a 40-character lowercase Git SHA.');
  }

  const problems = [];
  const sourceSha = manifest.source?.sha;
  if (manifest.schemaVersion !== 1) problems.push('schema version is not 1');
  if (!SHA.test(sourceSha ?? '')) problems.push('source SHA is missing or ambiguous');
  if (expectedSha && sourceSha !== expectedSha) problems.push('source SHA does not match the monitored revision');
  if (manifest.environment !== 'Production') problems.push('environment is not Production');
  if (manifest.features?.privateBeta !== 'off') problems.push('private beta is not off');
  if (manifest.controls?.accountService !== true) problems.push('account service is not enabled');
  if (manifest.controls?.institutionalPreview !== false) problems.push('institutional preview is enabled');
  if (manifest.controls?.readOnly !== false) problems.push('read-only mode is enabled');

  if (problems.length) throw new Error(`Release manifest is not GA-ready: ${problems.join('; ')}.`);
  return sourceSha;
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
  const { app, supabase, key, expectedReleaseSha } = await configuration();
  if (!app.startsWith('https://')) throw new Error('The public app URL must use HTTPS.');
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

  const release = await request('release manifest', `${app}/release.json?monitor=${nonce}`, {
    headers: { 'cache-control': 'no-cache' },
  });
  let releaseBody;
  try {
    releaseBody = await release.json();
  } catch {
    throw new Error('Release manifest was not valid JSON.');
  }
  const releaseSha = validateProductionRelease(releaseBody, expectedReleaseSha);
  console.log(`  ok   production release identity (${releaseSha})`);

  const schools = await request(
    'Supabase PostgREST',
    `${supabase}/rest/v1/schools?select=id&limit=1`,
    { headers: { apikey: key, authorization: `Bearer ${key}` } },
  );
  const body = await schools.json();
  if (!Array.isArray(body)) throw new Error('Supabase PostgREST did not return a JSON array.');

  console.log('\nProduction frontend, exact GA release identity, deployed assets and Supabase API are verified.');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runPublicProductionSmoke().catch(error => {
    console.error(`  FAIL ${error instanceof Error ? error.message : 'Public production smoke failed.'}`);
    process.exitCode = 1;
  });
}
