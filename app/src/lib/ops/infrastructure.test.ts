import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The repository-state half of the infrastructure controls: the parts that are
 * facts about files, so a test can hold them. The behavioural half — does the
 * Terraform validate, does the policy catch what it should — runs in
 * `.github/workflows/infra.yml`, which has Terraform and OPA; this suite has
 * neither and does not pretend to.
 *
 * See infra/README.md for what each control is and whether it is live.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const ls = (p: string) => readdirSync(join(root, p));

const ROOTS = ['platform', 'staging', 'production'] as const;
const FIELDS = ['Record', 'Status', 'Kind', 'Roots', 'Approved-destroys', 'Approver', 'Approved', 'Applied'];
const STATUSES = ['draft', 'approved', 'applied', 'rejected', 'superseded'];
const SECTIONS = ['Summary', 'Environments and tenants affected', 'Risk', 'Rollback', 'Evidence'];

/** The `Key: value` lines before a record's first heading. */
export const header = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    if (line.startsWith('#')) break;
    const m = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
};

/** What is wrong with a change record; empty when it is sound. */
export const problems = (file: string, text: string): string[] => {
  const n = /^CC-(\d+)\.md$/.exec(file)?.[1];
  const h = header(text);
  const bad: string[] = [];
  if (!n) return [`${file} is not named CC-<pull request number>.md`];
  for (const f of FIELDS) if (!(f in h)) bad.push(`missing header field ${f}`);
  if (h.Record !== `CC-${n}` && file !== 'TEMPLATE.md') bad.push(`Record is '${h.Record}', not CC-${n}`);
  if (!STATUSES.includes(h.Status)) bad.push(`Status '${h.Status}' is not one of ${STATUSES.join(', ')}`);
  if (!['standard', 'emergency'].includes(h.Kind)) bad.push(`Kind '${h.Kind}' is not standard or emergency`);
  for (const r of (h.Roots ?? '').split(',').map((x) => x.trim()).filter(Boolean)) if (!(ROOTS as readonly string[]).includes(r)) bad.push(`unknown root '${r}'`);
  if (['approved', 'applied'].includes(h.Status) && !(h.Approver && /^\d{4}-\d{2}-\d{2}$/.test(h.Approved ?? ''))) bad.push('approved needs Approver and an Approved date (YYYY-MM-DD)');
  if (h.Status === 'applied' && !h.Applied) bad.push('applied needs the run URL under Applied');
  for (const s of SECTIONS) if (!new RegExp(`^## ${s}\\s*$`, 'm').test(text)) bad.push(`missing section '${s}'`);
  const rollback = /^## Rollback\s*$([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(text)?.[1].trim() ?? '';
  if (rollback.length < 20) bad.push('Rollback is empty; "cannot be undone" is an answer, blank is not');
  return bad;
};

describe('change records', () => {
  const records = () => ls('infra/changes').filter((f) => /^CC-\d+\.md$/.test(f));

  it('flags what is wrong with a record, and nothing in a sound one', () => {
    const sound = read('infra/changes/TEMPLATE.md').replace('CC-0000', 'CC-7');
    expect(problems('CC-7.md', sound)).toEqual([]);
    expect(problems('notes.md', sound)).toHaveLength(1);
    expect(problems('CC-7.md', sound.replace('Status: draft', 'Status: approved'))).toContain('approved needs Approver and an Approved date (YYYY-MM-DD)');
    expect(problems('CC-7.md', sound.replace('Roots: production', 'Roots: prod'))).toContain("unknown root 'prod'");
    expect(problems('CC-7.md', sound.replace('## Rollback', '## Backout'))).toContain("missing section 'Rollback'");
    expect(problems('CC-8.md', sound)).toContain("Record is 'CC-7', not CC-8");
  });

  it('are all sound', () => {
    for (const f of records()) expect(problems(f, read(`infra/changes/${f}`)), f).toEqual([]);
  });

  it('exist for every policy exception, which must carry an expiry', () => {
    const { exceptions } = JSON.parse(read('infra/policy/exceptions.json')) as { exceptions: { workflow: string; match: string; expires: string; record: string; reason: string }[] };
    expect(exceptions.length).toBeGreaterThan(0);
    for (const e of exceptions) {
      expect(e.expires, `${e.workflow}: ${e.match}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.reason.length, `${e.workflow} gives no reason`).toBeGreaterThan(40);
      expect(existsSync(join(root, e.record)), `${e.workflow} cites ${e.record}, which does not exist`).toBe(true);
      expect(e.record, 'a placeholder record').not.toMatch(/CC-PR/);
      expect(existsSync(join(root, '.github/workflows', e.workflow)), `${e.workflow} is not a workflow`).toBe(true);
    }
  });
});

describe('the Terraform', () => {
  const modules = ls('infra/terraform/modules');

  it('pins Terraform and every provider, in every module and root', () => {
    for (const dir of [...modules.map((m) => `modules/${m}`), ...ROOTS.map((r) => `envs/${r}`)]) {
      const v = read(`infra/terraform/${dir}/versions.tf`);
      expect(v, dir).toMatch(/required_version\s*=\s*">= 1\.10\.0, < 2\.0\.0"/);
      for (const [, src] of v.matchAll(/source\s*=\s*"([^"]+)"/g)) expect(v, `${dir}: ${src}`).toMatch(new RegExp(`${src}"\\s*\\n\\s*version\\s*=\\s*"~> \\d`));
    }
  });

  it('commits a provider lockfile for each root, with hashes for the platforms people use', () => {
    for (const r of ROOTS) {
      const lock = read(`infra/terraform/envs/${r}/.terraform.lock.hcl`);
      expect(lock, r).toMatch(/provider "registry\.terraform\.io\//);
      expect(lock, r).toMatch(/"h1:/);
      expect(lock, `${r}: a lock made on one platform only fails on the other`).toMatch(/"zh:/);
    }
  });

  it('keeps state out of git and the backend partial, so no account is committed', () => {
    expect(read('.gitignore')).toMatch(/\*\.tfstate/);
    for (const r of ROOTS) expect(read(`infra/terraform/envs/${r}/versions.tf`), r).toMatch(/backend "s3" \{\}/);
    expect(ls('infra/terraform/envs').flatMap((r) => ls(`infra/terraform/envs/${r}`)).filter((f) => f.endsWith('.tfstate'))).toEqual([]);
  });

  it('holds identifiers in tfvars, never a credential', () => {
    for (const r of ROOTS) {
      const t = read(`infra/terraform/envs/${r}/terraform.tfvars`).replace(/^\s*#.*$/gm, '');
      expect(t, r).not.toMatch(/password|secret|token|api[_-]?key|sbp_|sb_secret|eyJ[A-Za-z0-9_-]{20,}/i);
    }
  });

  it('reads the default-branch rules from the one ruleset file instead of restating them', () => {
    expect(read('infra/terraform/envs/platform/main.tf')).toMatch(/\.github\/rulesets\/main\.json/);
    expect(read('infra/terraform/modules/github_governance/main.tf')).toMatch(/jsondecode\(file\(var\.ruleset_file\)\)/);
  });

  it('never lets production be created or its protections destroyed by a refactor', () => {
    expect(read('infra/terraform/modules/supabase_project/main.tf')).toMatch(/prevent_destroy = true/);
    expect(read('infra/terraform/modules/vercel_gateway/main.tf')).toMatch(/prevent_destroy = true/);
    expect(read('infra/terraform/envs/production/main.tf')).toMatch(/create_project\s*=\s*false/);
  });
});

describe('the pipeline', () => {
  const wf = (f: string) => read(`.github/workflows/${f}`);

  it('applies only from main, through a reviewed environment, the plan it hashed', () => {
    const a = wf('infra-apply.yml');
    expect(a).toMatch(/environment: infrastructure-production/);
    expect(a.match(/if: github\.ref == 'refs\/heads\/main'/g)).toHaveLength(2);
    expect(a).toMatch(/sha256sum --check --strict/);
    expect(a).toMatch(/terraform apply -no-color plan\.bin/);
    expect(a, 'a second plan must come back empty').toMatch(/plan -detailed-exitcode/);
    expect(a, 'only an approved record authorises an apply').toMatch(/\[ "\$status" = "approved" \]/);
  });

  it('checks for drift daily, and says NOT CHECKED rather than clean when it cannot', () => {
    const d = wf('drift.yml');
    expect(d).toMatch(/cron: '\d+ \d+ \* \* \*'/);
    expect(d).toMatch(/-detailed-exitcode/);
    expect(d).toMatch(/NOT CHECKED/);
    expect(d).toMatch(/environment: infrastructure-plan/);
  });

  it('verifies the attestations it makes, as an outsider would', () => {
    const s = wf('supply-chain.yml');
    expect(s).toMatch(/attest-build-provenance@[0-9a-f]{40}/);
    expect(s).toMatch(/attest-sbom@[0-9a-f]{40}/);
    expect(s.match(/gh attestation verify/g)).toHaveLength(2);
    expect(s).toMatch(/--signer-workflow/);
    expect(s, 'the identity-minting permission is on the job, not the workflow').not.toMatch(/^permissions:\n(?:  .*\n)*  id-token/m);
  });

  it('keeps the policy scripts executable and the OPA download pinned by hash', () => {
    for (const f of ls('scripts/infra').filter((x) => x.endsWith('.sh'))) expect(read(`scripts/infra/${f}`), f).toMatch(/^#!\/usr\/bin\/env bash\nset -euo pipefail|^#!\/usr\/bin\/env bash\n(?:#.*\n)+set -euo pipefail/);
    for (const f of ['infra.yml', 'infra-apply.yml']) expect(wf(f), f).toMatch(/OPA_SHA256: '[0-9a-f]{64}'/);
  });
});

describe('the state-store bootstrap', () => {
  const policy = JSON.parse(read('infra/bootstrap/state-iam-policy.json')) as { Statement: { Effect: string; Action: string[]; Resource: string | string[] }[] };

  it('grants the state credential this bucket and nothing else', () => {
    for (const s of policy.Statement) {
      expect(s.Effect).toBe('Allow');
      for (const a of s.Action) expect(a, 'a wildcard action').not.toMatch(/\*/);
      for (const r of [s.Resource].flat()) {
        expect(r, 'resources are named for the bucket placeholder').toMatch(/^arn:aws:s3:::BUCKET_NAME(\/(platform|staging|production)\/terraform\.tfstate\*)?$/);
      }
    }
  });

  it('never lets the credential change the bucket itself', () => {
    const actions = policy.Statement.flatMap((s) => s.Action);
    expect(actions.filter((a) => /Put(Bucket|Lifecycle)|Delete(Bucket|Object(Version)?s?Tagging)|PutBucketPolicy/.test(a))).toEqual([]);
  });

  it('refuses plain-HTTP requests at the bucket', () => {
    expect(read('infra/bootstrap/bucket-policy.json')).toMatch(/aws:SecureTransport[\s\S]*false/);
  });
});
