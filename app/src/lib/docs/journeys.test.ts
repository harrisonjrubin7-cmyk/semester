import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The role-journey coverage map, held against the tree.
 *
 * `docs/ecosystem/journeys.json` holds every row of the role blueprint's §5
 * (95 journeys), its §11.1 shared components and its §11.2 workspace families,
 * each with a status and the paths that justify it. This test is what keeps
 * that file honest:
 *
 * - no row is silently dropped: the counts per §5 section are the blueprint's;
 * - every cited path exists, so the file cannot cite a screen nobody can open;
 * - a status is only as strong as its evidence (see `supports` below);
 * - every database role a row names is in `docs/ROLE-LAUNCH-REGISTER.md`,
 *   which is rendered from the migrations, so a role that does not exist fails;
 * - every row says what is missing, so "code-present" is never read as done.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);

interface Row {
  id: string;
  status: string;
  evidence: string[];
  gap: string;
}
interface Journey extends Row {
  section: string;
  role: string;
  dbRoles: string[];
}
interface Shared extends Row {
  item: string;
}
interface Workspace extends Row {
  family: string;
}
interface Journeys {
  ladder: string[];
  journeys: Journey[];
  shared: Shared[];
  workspaces: Workspace[];
}

const data = JSON.parse(readFileSync(at('docs/ecosystem/journeys.json'), 'utf8')) as Journeys;
const register = readFileSync(at('docs/ROLE-LAUNCH-REGISTER.md'), 'utf8');
const registeredRoles = new Set([...register.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1] ?? ''));

const ALL_ROWS: Row[] = [...data.journeys, ...data.shared, ...data.workspaces];

/** The blueprint's §5 row counts, by section. */
const SECTION_COUNTS: Record<string, number> = { '5.1': 19, '5.2': 11, '5.3': 11, '5.4': 9, '5.5': 16, '5.6': 11, '5.7': 18 };

const SHARED_IDS = [
  'context-workspace-switcher', 'institution-role-indicator', 'action-list-detail', 'source-provenance-panel',
  'access-explanation', 'approval-request-decision', 'record-history', 'sync-reconciliation-status',
  'consent-delegation-manager', 'export-preview', 'ai-source-policy-disclosure', 'conflict-resolution',
  'support-access-request', 'revocation-notice', 'accessible-states',
].map((s) => `11.1.${s}`);

const WORKSPACE_IDS = [
  'learner', 'teaching', 'advising', 'services', 'academic-operations', 'career-partners', 'governance',
  'technical-operations', 'company',
].map((s) => `11.2.${s}`);

/**
 * What a status requires of its evidence. `specified` may cite documents but no
 * app code; anything from `code-present` up cites a screen or module in `app/`;
 * `schema-present` says the role exists, so it needs a role and a source that
 * defines it. Nothing is rated `tested` without a test file among its evidence.
 */
function supports(status: string, row: Journey | Shared | Workspace): string | null {
  const hasApp = row.evidence.some((p) => p.startsWith('app/'));
  if (status === 'specified') return hasApp ? 'specified rows cite no app code' : null;
  if (status === 'schema-present') {
    const defined = row.evidence.some((p) => p === 'docs/ROLE-PERMISSION-MATRIX.md' || p.startsWith('supabase/'));
    const journey = row as Journey;
    if (!defined) return 'schema-present needs a role matrix or supabase/ source';
    if (journey.dbRoles !== undefined && journey.dbRoles.length === 0) return 'schema-present needs a dbRole';
    return null;
  }
  if (status === 'code-present') return hasApp ? null : 'code-present needs an app/ path';
  if (status === 'tested') {
    const hasTest = row.evidence.some((p) => /\.test\.[jt]sx?$/.test(p));
    return hasApp && hasTest ? null : 'tested needs an app/ path and a test file';
  }
  return 'this pass rates nothing above tested';
}

describe('role-journey coverage map', () => {
  it('uses only ladder statuses', () => {
    for (const row of ALL_ROWS) expect(data.ladder, row.id).toContain(row.status);
  });

  it('cites only paths that exist', () => {
    for (const row of ALL_ROWS) for (const p of row.evidence) expect(existsSync(at(p)), `${row.id} cites ${p}`).toBe(true);
  });

  it('holds every status to the evidence it needs', () => {
    for (const row of ALL_ROWS) {
      const problem = supports(row.status, row as Journey);
      expect(problem, `${row.id}: ${problem ?? ''}`).toBeNull();
    }
  });

  it('names only database roles that the launch register lists', () => {
    for (const j of data.journeys) for (const r of j.dbRoles) expect(registeredRoles.has(r), `${j.id} names ${r}`).toBe(true);
  });

  it('covers every row of blueprint §5, with no row dropped or duplicated', () => {
    const ids = data.journeys.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
    const counts: Record<string, number> = {};
    for (const j of data.journeys) counts[j.section] = (counts[j.section] ?? 0) + 1;
    expect(counts).toEqual(SECTION_COUNTS);
  });

  it('covers every §11.1 shared component and every §11.2 workspace family', () => {
    expect(data.shared.map((s) => s.id).sort()).toEqual([...SHARED_IDS].sort());
    expect(data.workspaces.map((w) => w.id).sort()).toEqual([...WORKSPACE_IDS].sort());
  });

  it('says what is missing on every row, so a code-present screen is not read as finished', () => {
    for (const row of ALL_ROWS) expect(row.gap.trim(), row.id).not.toBe('');
  });

  it('does not claim deployment or operation, because this pass did not probe production', () => {
    for (const row of ALL_ROWS) expect(['deployed', 'operational']).not.toContain(row.status);
  });
});
