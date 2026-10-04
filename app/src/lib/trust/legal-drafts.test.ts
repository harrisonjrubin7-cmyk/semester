import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PARTIES } from './subprocessors';
import { SUPPORT } from '../privacy';

/**
 * The Terms of Service and Privacy Policy drafts in `docs/legal/`, held to the
 * registers they were written from.
 *
 * They are drafts for counsel, not law in force, and two things would make
 * them dangerous before that review happens:
 *
 *   · **The banner goes.** A draft with its "Not in force" line deleted reads
 *     like the real thing, and gets linked or sent. The banner stays until the
 *     `terms-reviewed` gate records a qualified review, which is when this
 *     assertion should be changed — deliberately, in the same commit.
 *   · **The policy falls behind the register.** A provider added to
 *     `subprocessors.ts` that the privacy policy does not name is an
 *     undisclosed recipient. So every party must have an entry in `NAMED_AS`
 *     below, and that phrase must appear in the policy. A new party fails here
 *     until someone writes it into the policy and maps it.
 */

const LEGAL = join(process.cwd(), '..', 'docs', 'legal');
const read = (name: string) => readFileSync(join(LEGAL, name), 'utf8');

/** Each register entry, and the words the privacy policy uses for it. */
const NAMED_AS: Record<string, string> = {
  'Supabase': 'Supabase',
  'GitHub Pages': 'GitHub Pages',
  'Vercel': 'Vercel',
  'Anthropic (Semester’s key)': 'Anthropic',
  'Stripe': 'Stripe',
  'Resend': 'Resend',
  'OpenAI (institution-approved)': 'OpenAI, when your school approves it',
  'The institution’s LMS (LTI 1.3 platform)': 'learning management system** (LTI 1.3)',
  'Anthropic (student’s own key)': 'Your own AI key',
  'OpenAI (student’s own key)': 'Anthropic or OpenAI, using a key you entered',
  'Microsoft': 'Microsoft',
  'Google': 'Google',
  'Zoom': 'Zoom',
  'Apple': 'Apple',
  'OpenStreetMap tile servers': 'OpenStreetMap tile servers',
  'Nominatim and Photon (address lookup)': 'Nominatim and Photon',
  'Public institution source hosts': 'Public institution source hosts you check',
  'Calendar and Canvas hosts the student links': 'Calendar and Canvas hosts you link',
  'The student’s browser push service': 'browser\'s push service',
};

describe('legal drafts', () => {
  // Every draft in the folder, not a list someone must remember to extend: a
  // new policy without the banner is exactly the one that gets linked by
  // mistake.
  // Two files here are not policies: they are the program's working views of
  // the controlled registers at the repository root. They are named, not
  // matched by pattern, so any other file in the folder still has to be a
  // `-DRAFT.md` with the banner. They keep their own banner and must keep
  // pointing at the register that controls them (asserted below).
  const PROGRAM_VIEWS = {
    'LEGAL_REVIEW_QUEUE.md': 'LEGAL-REVIEW-QUEUE.md',
    'PUBLIC_CLAIMS_APPROVAL_REGISTER.md': 'PUBLIC-CLAIMS-APPROVAL-REGISTER.md',
  } as const;
  const DRAFTS = readdirSync(LEGAL).filter((f) => f.endsWith('.md') && !(f in PROGRAM_VIEWS));

  it('finds every draft, including the two it began with', () => {
    expect(DRAFTS).toContain('PRIVACY-POLICY-DRAFT.md');
    expect(DRAFTS).toContain('TERMS-OF-SERVICE-DRAFT.md');
    expect(DRAFTS.length).toBeGreaterThanOrEqual(13);
    for (const f of DRAFTS) expect(f, 'a policy here is a draft until it is in force').toMatch(/-DRAFT\.md$/);
  });

  it.each(Object.entries(PROGRAM_VIEWS))(
    '%s stays a draft working list and defers to its controlled register %s',
    (name, controlled) => {
      const text = read(name);
      expect(text).toMatch(/DRAFT FOR QUALIFIED LEGAL REVIEW/);
      expect(text, 'it must link the register that controls it').toContain(`](../../${controlled})`);
      expect(text, 'it approves nothing').toMatch(/does not (replace|approve)/i);
    },
  );

  it.each(DRAFTS)(
    '%s still says it is not in force',
    (name) => {
      const text = read(name);
      expect(text).toMatch(/\*\*Not in force\. Not reviewed by a lawyer\.\*\*/);
      expect(text).toContain(SUPPORT);
    },
  );

  it('maps every party in the subprocessor register', () => {
    const unmapped = PARTIES.map((p) => p.name).filter((n) => !(n in NAMED_AS));
    expect(unmapped, 'add these to the privacy policy and to NAMED_AS').toEqual([]);
    const stale = Object.keys(NAMED_AS).filter((n) => !PARTIES.some((p) => p.name === n));
    expect(stale, 'these are no longer in the register').toEqual([]);
  });

  it('names every party in the privacy policy', () => {
    const policy = read('PRIVACY-POLICY-DRAFT.md');
    const missing = Object.entries(NAMED_AS)
      .filter(([, phrase]) => !policy.includes(phrase))
      .map(([name]) => name);
    expect(missing).toEqual([]);
  });
});
