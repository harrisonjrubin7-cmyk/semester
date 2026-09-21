import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `SECRETS.md` is a list of places, and a list of places goes short.
 *
 * `security.test.ts` already holds `SECURITY.md` to the secrets the Edge
 * Functions read, bidirectionally, and that is the right rule for an incident
 * list: a name in it that nothing reads sends somebody to rotate a key that is
 * not there. It is also the rule that makes that document structurally unable
 * to hold half of what a rotation needs — `SUPABASE_ACCESS_TOKEN` is a GitHub
 * Actions secret and no `Deno.env.get` will ever name it, so adding it there
 * turns that suite red.
 *
 * So there are two documents, and this is the guard for the second. The
 * failure it exists to catch is the same shape as the other one's and reaches
 * a store that one cannot see:
 *
 *   **Somebody adds a workflow, the workflow reads a new Actions secret, and
 *   the inventory does not know that store has anything in it.** Nothing goes
 *   red. The rotation happens, everything the owner knows about is replaced,
 *   and a live credential stays live in a settings page nobody opened.
 *
 * ## What it does not check
 *
 * Whether any of it is *true* — that a secret is in the store the table says,
 * that the person named can reach it, or that the procedure works. None of
 * that is readable from here, and a test asserting it would be asserting the
 * document against itself.
 */

const ROOT = join(process.cwd(), '..');
const DOC = join(ROOT, 'SECRETS.md');
const FUNCTIONS = join(ROOT, 'supabase', 'functions');
const WORKFLOWS = join(ROOT, '.github', 'workflows');

const doc = () => readFileSync(DOC, 'utf8');

/** Every `Deno.env.get('…')` across every Edge Function, by name. */
function functionSecrets(): string[] {
  const found = new Set<string>();
  for (const dir of readdirSync(FUNCTIONS)) {
    const file = join(FUNCTIONS, dir, 'index.ts');
    if (!existsSync(file)) continue;
    for (const m of readFileSync(file, 'utf8').matchAll(/Deno\.env\.get\('([A-Z0-9_]+)'\)/g)) {
      found.add(m[1]);
    }
  }
  return [...found].sort();
}

/** Every `secrets.NAME` and `vars.NAME` the workflows read. */
function actionsSecrets(): string[] {
  const found = new Set<string>();
  for (const name of readdirSync(WORKFLOWS)) {
    const text = readFileSync(join(WORKFLOWS, name), 'utf8');
    for (const m of text.matchAll(/\b(?:secrets|vars)\.([A-Z][A-Z0-9_]*)\b/g)) found.add(m[1]);
  }
  return [...found].sort();
}

describe('the inventory is there and is shaped like one', () => {
  it('is at the root, where somebody looking for it would look', () => {
    expect(existsSync(DOC), 'SECRETS.md is gone').toBe(true);
  });

  it('has a rotation log with the columns a rotation is recorded in', () => {
    // The point of the file for the week it was written. A log without a
    // reason column is a list of dates.
    const flat = doc().replace(/\s+/g, ' ');
    expect(flat).toMatch(/\| Date \| Secret \| Rotated by \| Reason \|/);
  });

  it('and names the four stores rather than only the secrets', () => {
    // "Where does it live" is the question this file exists for. A table of
    // names and revocations is the one that already exists next door.
    const said = doc();
    for (const store of [
      'Supabase function secrets',
      'GitHub Actions',
      '.env.local',
      'Dashboard',
    ]) {
      expect(said, `SECRETS.md no longer says where ${store} is`).toContain(store);
    }
  });

  it('and hands the incident case to the document that owns it', () => {
    // The two documents overlap in one place and the boundary is the useful
    // part of both. A second copy of the rotation steps here is a second copy
    // to drift, and the stale one is the one somebody reads under pressure.
    expect(doc()).toContain('SECURITY.md');
  });
});

describe('every store something reads from is a store this file knows about', () => {
  it('names every environment variable the Edge Functions read', () => {
    const missing = functionSecrets().filter((name) => !doc().includes(name));
    expect(missing, 'read by a function, absent from SECRETS.md').toEqual([]);
  });

  it('and every secret or variable the workflows read', () => {
    /*
     * The half `SECURITY.md` cannot hold, and the reason this file exists.
     * A deploy secret is not a function secret: nothing in `supabase/` names
     * `SUPABASE_ACCESS_TOKEN`, and it is the credential in this project with
     * the widest reach after the service key — it is the Supabase *account*
     * rather than one project.
     */
    const missing = actionsSecrets().filter((name) => !doc().includes(name));
    expect(missing, 'read by a workflow, absent from SECRETS.md').toEqual([]);
  });

  it('and the probes read the tree rather than reporting an empty one', () => {
    /*
     * The control, and the reason the two clean sweeps above mean anything: a
     * scanner that finds nothing passes both. This repository has shipped that
     * probe before — `CLAUDE.md` records a teardown check that reported every
     * file as leaking because it keyed on the wrong thing, and a later one
     * that reported a leaking file as clean.
     *
     * Both ends pinned to something certainly there: the service key, which
     * every function that writes needs, and the deploy token, which is the
     * whole reason the workflow half of this scan exists.
     */
    const fromFunctions = functionSecrets();
    const fromWorkflows = actionsSecrets();
    expect(fromFunctions.length, 'the function scan found nothing').toBeGreaterThan(5);
    expect(fromWorkflows.length, 'the workflow scan found nothing').toBeGreaterThan(5);
    expect(fromFunctions).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(fromWorkflows).toContain('SUPABASE_ACCESS_TOKEN');
  });

  it('and the scan reads the workflows rather than their comments', () => {
    /*
     * The second control, and the one `security.test.ts` learned the hard way
     * next door: every function's header carries `supabase secrets set …` as
     * deploy instructions, so a probe grepping for capitalised words finds the
     * names whether or not anything reads them.
     *
     * Here the shape is `${{ secrets.NAME }}`, which prose does not contain —
     * pinned to a name these workflows discuss in a comment and read nowhere.
     */
    const prose = readdirSync(WORKFLOWS)
      .map((n) => readFileSync(join(WORKFLOWS, n), 'utf8'))
      .join('\n');
    expect(prose, 'the comment this control is pinned to has been rewritten').toContain(
      'GITLEAKS_LICENSE',
    );
    expect(actionsSecrets(), 'the scan is picking up prose').not.toContain('GITLEAKS_LICENSE');
  });
});

describe('what it points at exists', () => {
  it('every repository file it links to is a file that is there', () => {
    const linked = [...doc().matchAll(/\]\((?!https?:)([^)#]+)\)/g)].map((m) => m[1]);
    expect(linked.length, 'the document links to no files').toBeGreaterThan(5);
    for (const path of new Set(linked)) {
      expect(existsSync(join(ROOT, path)), `${path} is linked but not there`).toBe(true);
    }
  });

  it('and does not leave a placeholder where a name should be', () => {
    for (const placeholder of ['TODO', 'TBD', 'FIXME', '<owner>', 'XXX']) {
      expect(doc(), `SECRETS.md still says ${placeholder}`).not.toContain(placeholder);
    }
  });
});
