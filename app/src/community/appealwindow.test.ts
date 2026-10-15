/**
 * The appeal window exists twice — as the TypeScript the app reasons with, and
 * as the SQL the database enforces. This holds the two to each other.
 *
 * It reads the *last* definition of each function across every migration, not
 * the first: a Postgres function is replaced whole, so the one that runs is the
 * newest. `programs.test.ts` reads `20260928032000_community.sql` and would
 * never see this window, which is why this is not a case in that file.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPEAL_RULES } from './moderation';

const dir = new URL('../../../supabase/migrations/', import.meta.url);

/** The body of the newest `create or replace function <fn>(` in any migration. */
function lastDefinition(fn: string): string {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (let i = files.length - 1; i >= 0; i--) {
    const sql = readFileSync(new URL(files[i], dir), 'utf8');
    const start = sql.lastIndexOf(`create or replace function ${fn}(`);
    if (start < 0) continue;
    const open = sql.indexOf('$$', start);
    return sql.slice(start, sql.indexOf('$$', open + 2));
  }
  throw new Error(`${fn} is in no migration`);
}

describe('the appeal window, in both places', () => {
  const days = `interval '${APPEAL_RULES.filingWindowDays} days'`;

  it('filing is refused once the decision is older than the window', () => {
    const body = lastDefinition('public.appeal_community_decision');
    expect(body).toContain(`decided < now() - ${days}`);
    expect(body).toContain('the appeal window has closed');
  });

  it('the window runs from the decision, not from the report or the appeal', () => {
    const body = lastDefinition('public.appeal_community_decision');
    expect(body).toContain("d.stage = 'decision'");
    expect(body).toContain('max(d.decided_at)');
  });

  it('the author is offered an appeal only inside it', () => {
    expect(lastDefinition('public.my_community_notices')).toContain(
      `c.status = 'decided' and d.decided_at >= now() - ${days}`,
    );
  });
});
