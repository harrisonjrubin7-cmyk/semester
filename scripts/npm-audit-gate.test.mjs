import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateAudit } from './npm-audit-gate.mjs';

const NOW = new Date('2026-10-27T12:00:00Z');
const clean = () => ({ auditReportVersion: 2, vulnerabilities: {} });
const planted = (fixAvailable = false) => ({
  auditReportVersion: 2,
  vulnerabilities: {
    'planted-package': {
      severity: 'high',
      via: [{ source: 999001, severity: 'high', title: 'Planted high advisory', url: 'https://example.invalid/GHSA-planted' }],
      fixAvailable,
    },
  },
});
const exception = (expiresOn = '2026-11-03', reviewedOn = '2026-10-27') => ({
  schema: 1,
  entries: [{
    package: 'planted-package',
    source: 999001,
    owner: 'security',
    reviewedOn,
    expiresOn,
    reason: 'No fixed release exists; usage is unreachable in the shipped application.',
  }],
});

test('a clean npm audit passes without an exception', () => {
  assert.deepEqual(evaluateAudit(clean(), { schema: 1, entries: [] }, { now: NOW }), { allowed: [], blocked: [] });
});

test('a planted high advisory blocks the gate', () => {
  const result = evaluateAudit(planted(), { schema: 1, entries: [] }, { now: NOW });
  assert.equal(result.blocked.length, 1);
  assert.equal(result.blocked[0].reason, 'no reviewed exception');
});

test('an unexpired reviewed exception may cover an advisory with no fix', () => {
  const result = evaluateAudit(planted(), exception(), { now: NOW });
  assert.equal(result.blocked.length, 0);
  assert.equal(result.allowed.length, 1);
});

test('an expired exception blocks the gate', () => {
  const result = evaluateAudit(planted(), exception('2026-10-26', '2026-10-20'), { now: NOW });
  assert.equal(result.blocked[0].reason, 'exception expired 2026-10-26');
});

test('an exception cannot hide an advisory with a fix', () => {
  const result = evaluateAudit(planted(true), exception(), { now: NOW });
  assert.equal(result.blocked[0].reason, 'npm reports a fix is available');
});
