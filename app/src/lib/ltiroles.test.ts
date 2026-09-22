import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The launch writes down what it was told, and does not die trying.
 *
 * `supabase/functions/lti/index.ts` is Deno, is imported by no test, and `tsc
 * -b` never reaches it — `ltideeplink.test.ts` says so where it asserts the
 * same file's branch order, and the only thing that compiles it is a deploy. So
 * this reads it as text, which cannot be fooled by a path a test did not take
 * because it is not taking paths.
 *
 * Three properties, and each is a thing a later edit could quietly undo.
 *
 * ## It is called at all
 *
 * The whole of item 246–250 and 274 rests on it. Before
 * `20260922020000_lti_roles.sql` the `roles` claim was read on every launch,
 * reduced to one boolean, and discarded; a rename or a dropped call puts it
 * straight back to that with nothing failing.
 *
 * ## It is called after the account exists
 *
 * It needs a subject, which `accountFor` is the only thing that knows. Moved
 * above it, `bound.userId` is not there yet — and because the failure is
 * swallowed on purpose (below), that would be a launch that silently records
 * nothing, forever, with a green deploy.
 *
 * ## It is not fatal
 *
 * This is the one worth pinning hardest. A grant that cannot be written costs
 * this launch its course roles; a launch that *refused* over it would cost a
 * student their class. It fails closed — no grant written is no access gained —
 * so the error is logged and the session proceeds, exactly as the link-ticket
 * write above it does. Turning that `console.error` into a `refuse` would look
 * like rigour and would take the app down for a school on a bad migration.
 */
const source = readFileSync(
  new URL('../../../supabase/functions/lti/index.ts', import.meta.url),
  'utf8',
);

describe('the launch records what it was told', () => {
  it('calls record_lti_roles, with the four things it takes', () => {
    expect(source, 'the call is gone').toContain("rpc('record_lti_roles'");
    for (const arg of ['want_subject', 'want_issuer', 'want_context', 'want_roles']) {
      expect(source, `${arg} is not passed`).toContain(`${arg}:`);
    }
    // The roles claim itself, not the boolean derived from it. `who.teaches`
    // answers "can this person see other people's work" and keeps
    // `Administrator` and `Mentor` in its set; passing it here would grant on a
    // question nobody asked.
    expect(source).toContain('want_roles: who.roles');
    expect(source).not.toContain('want_roles: who.teaches');
  });

  it('passes the account it just resolved, not something recomputed', () => {
    expect(source).toContain('want_subject: bound.userId');
    // Both paths through `accountFor` have to return it, or one kind of launch
    // records nothing: a returning student on the first, a brand-new one on the
    // second.
    expect(source).toMatch(/userId: known\.user_id/);
    expect(source).toMatch(/userId: made\.user\.id/);
  });

  it('calls it after the account exists', () => {
    const resolve = source.indexOf('accountFor(client, who)');
    const record = source.indexOf("rpc('record_lti_roles'");
    expect(resolve, 'accountFor is gone').toBeGreaterThan(-1);
    expect(record, 'the call is gone').toBeGreaterThan(-1);
    expect(resolve).toBeLessThan(record);
  });

  it('and after the deep-linking branch has already returned', () => {
    /*
     * An instructor in the "add an activity" dialog has not arrived and may
     * cancel. That branch returns before anything is provisioned, so there is no
     * subject to write grants about — and a call above it would be writing them
     * for somebody who never launched.
     */
    const branch = source.indexOf("who.messageType === 'LtiDeepLinkingRequest'");
    const record = source.indexOf("rpc('record_lti_roles'");
    expect(branch).toBeGreaterThan(-1);
    expect(branch).toBeLessThan(record);
  });

  it('does not refuse the launch when the write fails', () => {
    /*
     * Anchored on the handler rather than on the call, and the first version of
     * this was not: a 900-character window after the `rpc(` reached past the
     * handling and into the session-minting block below, whose `return refuse`
     * is correct and belongs to a different failure. A window wide enough to
     * catch an unrelated statement is a window that reports the wrong thing in
     * both directions.
     */
    const handler = source.indexOf('if (rolesError)');
    expect(handler, 'the failure is not handled at all').toBeGreaterThan(-1);
    const block = source.slice(handler, handler + 260);
    expect(block, 'the failure is not logged').toContain('console.error');
    expect(block, 'a failed grant now refuses the launch').not.toContain('refuse(');
    // And the handler is downstream of the call it handles, so the two cannot
    // drift apart without this saying so.
    expect(source.indexOf("rpc('record_lti_roles'")).toBeLessThan(handler);
  });

  /*
   * A control. Every assertion above is about one string's presence or its
   * position relative to another, and all of them would hold against a file
   * that had been emptied of everything else.
   */
  it('control: the file is still the launch route', () => {
    expect(source).toContain('checkLaunch(');
    expect(source).toContain('generateLink');
    expect(source.length).toBeGreaterThan(5_000);
  });
});
