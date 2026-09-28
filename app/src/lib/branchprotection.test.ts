import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The branch-protection ruleset, as a file, held to the CI it requires.
 *
 * GitHub's settings are not in the repository and nothing here can change
 * them, so `.github/rulesets/main.json` is a definition the owner imports
 * (`docs/BRANCH-PROTECTION.md`). What this test guards is the way such a file
 * goes quietly wrong:
 *
 *   - **A renamed CI job.** A required check whose name no job reports never
 *     arrives, and every pull request waits on it for ever — or, if somebody
 *     "fixes" that by removing the requirement in the UI, nothing is required
 *     at all. So the required contexts must be exactly the `ci.yml` jobs that
 *     run on a pull request, read from the workflow rather than listed here.
 *   - **A rule quietly weakened.** Review count to zero, stale approvals kept,
 *     force-push allowed, a bypass list that lets somebody past every rule.
 *   - **A document that claims more than is true.** It must say the ruleset is
 *     not active until the owner applies it.
 */

const ROOT = join(process.cwd(), '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

interface Rule {
  type: string;
  parameters?: Record<string, unknown>;
}
interface Ruleset {
  name: string;
  target: string;
  enforcement: string;
  conditions: { ref_name: { include: string[] } };
  bypass_actors: unknown[];
  rules: Rule[];
}

const ruleset = () => JSON.parse(read('.github', 'rulesets', 'main.json')) as Ruleset;
const rule = (type: string) => ruleset().rules.find((r) => r.type === type);

/**
 * The jobs in ci.yml that run on a pull request: every top-level job, minus
 * any whose `if:` restricts it to `push`. Parsed by indentation, which is how
 * the workflow is written — two spaces for a job, four for its keys.
 */
function pullRequestJobs(): string[] {
  const yml = read('.github', 'workflows', 'ci.yml');
  expect(yml, 'CI no longer runs on pull requests').toMatch(/^ {2}pull_request:/m);
  const body = yml.slice(yml.search(/^jobs:\s*$/m));
  const out: string[] = [];
  const parts = body.split(/^ {2}([a-z0-9_-]+):\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i];
    const keys = parts[i + 1];
    const cond = /^ {4}if:\s*(.+)$/m.exec(keys)?.[1] ?? '';
    if (/github\.event_name == 'push'/.test(cond) && !/pull_request/.test(cond)) continue;
    out.push(name);
  }
  return out.sort();
}

describe('the probe reads the workflow', () => {
  it('finds the two jobs a pull request runs, and not the push-only notifier', () => {
    const jobs = pullRequestJobs();
    expect(jobs).toContain('build');
    expect(jobs).not.toContain('notify');
  });
});

describe('the ruleset', () => {
  it('targets the default branch and is written to be active once imported', () => {
    const r = ruleset();
    expect(r.target).toBe('branch');
    expect(r.enforcement).toBe('active');
    expect(r.conditions.ref_name.include).toEqual(['~DEFAULT_BRANCH']);
  });

  // The owner's decision, 28 September: one person has access, and GitHub
  // will not let an author approve their own pull request, so an empty list
  // would stop every merge. The admin role may bypass, and only through a
  // pull request (`bypass_mode: "pull_request"`), which GitHub records on the
  // pull request — never by pushing to main. Anything wider fails here, and
  // docs/BRANCH-PROTECTION.md says SEC-003 stays `building` until a second
  // reviewer replaces this.
  it('lets only the admin role past it, and only through a pull request', () => {
    expect(ruleset().bypass_actors).toEqual([
      { actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'pull_request' },
    ]);
  });

  it('forbids deleting main and force-pushing to it', () => {
    expect(rule('deletion')).toBeTruthy();
    expect(rule('non_fast_forward')).toBeTruthy();
  });

  it('requires a pull request with an approving code-owner review that a later push invalidates', () => {
    const p = rule('pull_request')?.parameters ?? {};
    expect(p.required_approving_review_count).toBeGreaterThanOrEqual(1);
    expect(p.require_code_owner_review).toBe(true);
    expect(p.dismiss_stale_reviews_on_push).toBe(true);
    expect(p.require_last_push_approval).toBe(true);
  });

  it('requires exactly the CI jobs a pull request runs, up to date with main', () => {
    const p = rule('required_status_checks')?.parameters as {
      strict_required_status_checks_policy: boolean;
      required_status_checks: { context: string; integration_id?: number }[];
    };
    expect(p.strict_required_status_checks_policy).toBe(true);
    const contexts = p.required_status_checks.map((c) => c.context).sort();
    expect(contexts).toEqual(pullRequestJobs());
    // 15368 is the GitHub Actions app: a status of the same name from any
    // other integration must not satisfy the check.
    for (const c of p.required_status_checks) expect(c.integration_id).toBe(15368);
  });
});

describe('CODEOWNERS and the document', () => {
  it('CODEOWNERS gives every path an owner', () => {
    const owners = read('.github', 'CODEOWNERS');
    expect(owners).toMatch(/^\*\s+@\S+/m);
  });

  it('the document says the ruleset is not active until the owner applies it, and how', () => {
    const path = join(ROOT, 'docs', 'BRANCH-PROTECTION.md');
    expect(existsSync(path)).toBe(true);
    const doc = readFileSync(path, 'utf8').replace(/\s+/g, ' ');
    expect(doc).toContain('**Not active until the owner applies it.**');
    expect(doc).toContain('.github/rulesets/main.json');
    expect(doc).toMatch(/gh api [^`]*repos\/[^`]*\/rulesets/);
    expect(doc).toContain('Settings → Rules → Rulesets');
  });
});
