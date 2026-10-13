import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { validatePilotArtifacts } from './validate-pilot-artifacts.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Copies only what the validator reads, so each fixture is a real, isolated tree.
function withFixture(mutate, check) {
  const dir = mkdtempSync(join(tmpdir(), 'pilot-artifacts-'));
  try {
    for (const rel of ['docs/architecture', 'docs/contracts', 'docs/launch', 'docs/governance', 'supabase/migrations']) {
      cpSync(join(repo, rel), join(dir, rel), { recursive: true });
    }
    mutate(dir);
    check(validatePilotArtifacts(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function editYaml(dir, rel, change) {
  const doc = parse(readFileSync(join(dir, rel), 'utf8'));
  change(doc);
  writeFileSync(join(dir, rel), stringify(doc));
}

function expectCode(issues, code) {
  const codes = issues.map((i) => i.code);
  assert.ok(codes.includes(code), `expected ${code}, got: ${codes.join(', ') || '(none)'}`);
}

test('the committed pilot artifacts validate', () => {
  const issues = validatePilotArtifacts(repo);
  assert.deepEqual(issues, [], JSON.stringify(issues, null, 2));
});

test('a GO decision with unverified evidence is refused', () => {
  withFixture(
    (dir) => editYaml(dir, 'docs/launch/go-no-go.yaml', (d) => Object.assign(d, { decision: 'GO', decided_by: 'someone' })),
    (issues) => expectCode(issues, 'gate.go_without_evidence'),
  );
});

test('an API route whose operation is missing from the OpenAPI contract is refused', () => {
  withFixture(
    (dir) => {
      const rel = 'docs/contracts/api.openapi.yaml';
      writeFileSync(join(dir, rel), readFileSync(join(dir, rel), 'utf8').replace('operationId: getReadinessContext', 'operationId: getReadinessContextRenamed'));
    },
    (issues) => {
      expectCode(issues, 'route.operation_missing');
      expectCode(issues, 'operation.unrouted');
    },
  );
});

test('an idempotent route whose OpenAPI operation omits the Idempotency-Key header is refused', () => {
  withFixture(
    (dir) => editYaml(dir, 'docs/contracts/api.openapi.yaml', (d) => {
      d.paths['/v1/readiness/evaluations'].post.parameters = [];
    }),
    (issues) => expectCode(issues, 'route.idempotency_undeclared'),
  );
});

test('a verified control with no check command is refused', () => {
  withFixture(
    (dir) => editYaml(dir, 'docs/governance/control-register.yaml', (d) => {
      delete d.controls['CTL-CONTRACT-VALIDATE'].evidence.check;
    }),
    (issues) => expectCode(issues, 'control.verified_without_check'),
  );
});

test('an implemented record whose table its migration does not define is refused', () => {
  withFixture(
    (dir) => editYaml(dir, 'docs/contracts/records.yaml', (d) => {
      d.records.readiness_evaluations.table = 'private.not_a_real_table';
    }),
    (issues) => expectCode(issues, 'record.table_not_in_migration'),
  );
});

test('a document that cites an unknown control is refused', () => {
  withFixture(
    (dir) => appendFileSync(join(dir, 'docs/launch/pilot-scope.md'), '\nSee CTL-DOES-NOT-EXIST.\n'),
    (issues) => expectCode(issues, 'doc.unknown_control'),
  );
});

test('a document that cites a missing file is refused', () => {
  withFixture(
    (dir) => appendFileSync(join(dir, 'docs/launch/pilot-scope.md'), '\nSee docs/launch/no-such-page.md.\n'),
    (issues) => expectCode(issues, 'doc.missing_path'),
  );
});

test('a workflow transition to an undeclared state is refused', () => {
  withFixture(
    (dir) => editYaml(dir, 'docs/contracts/workflows.yaml', (d) => {
      d.workflows.readiness_evaluation.transitions.push({ from: 'running', to: 'nowhere', event: 'retry' });
    }),
    (issues) => expectCode(issues, 'workflow.unknown_state'),
  );
});

test('a workflow that leaves a terminal state is refused', () => {
  withFixture(
    (dir) => editYaml(dir, 'docs/contracts/workflows.yaml', (d) => {
      d.workflows.readiness_evaluation.transitions.push({ from: 'completed', to: 'running', event: 'retry' });
    }),
    (issues) => expectCode(issues, 'workflow.transition_from_terminal'),
  );
});

test('an event with no AsyncAPI message is refused', () => {
  withFixture(
    (dir) => editYaml(dir, 'docs/contracts/asyncapi.yaml', (d) => {
      delete d.components.messages['override.decided'];
    }),
    (issues) => expectCode(issues, 'asyncapi.event_missing'),
  );
});

test('a verified release item with no evidence is refused', () => {
  withFixture(
    (dir) => editYaml(dir, 'docs/governance/release-evidence.yaml', (d) => {
      d.items['REL-PRD-01'].status = 'verified';
    }),
    (issues) => expectCode(issues, 'release.verified_without_evidence'),
  );
});

test('a missing required artifact is reported', () => {
  withFixture(
    (dir) => rmSync(join(dir, 'docs/launch/go-no-go.yaml')),
    (issues) => expectCode(issues, 'artifact.missing'),
  );
});
