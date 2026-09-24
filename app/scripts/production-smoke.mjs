#!/usr/bin/env node

const app = (process.env.SEMESTER_PRODUCTION_APP_URL || '').replace(/\/$/, '');
const gateway = (process.env.SEMESTER_PRODUCTION_GATEWAY_URL || '').replace(/\/$/, '');
if (!app || !gateway || !app.startsWith('https://') || !gateway.startsWith('https://')) {
  console.error('Set SEMESTER_PRODUCTION_APP_URL and SEMESTER_PRODUCTION_GATEWAY_URL to HTTPS origins.');
  process.exit(2);
}

async function probe(label, url, expected, init = {}) {
  let response;
  try {
    response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new Error(`${label} could not be reached.`);
  }
  if (response.status !== expected) throw new Error(`${label} returned ${response.status}; expected ${expected}.`);
  console.log(`  ok   ${label} (${response.status})`);
  return response;
}

try {
  await probe('frontend', `${app}/`, 200);
  const live = await probe('gateway liveness', `${gateway}/health/live`, 200);
  if ((await live.json()).status !== 'live') throw new Error('Liveness body did not say live.');
  const ready = await probe('gateway readiness', `${gateway}/health/ready`, 200);
  if ((await ready.json()).status !== 'ready') throw new Error('Readiness body did not say ready.');
  await probe('unauthenticated institutional access refusal', `${gateway}/status`, 401, {
    headers: { Origin: app },
  });
  console.log('\nProduction frontend, liveness, readiness and authentication refusal are verified.');
} catch (error) {
  console.error(`  FAIL ${error instanceof Error ? error.message : 'Production smoke failed.'}`);
  process.exit(1);
}
