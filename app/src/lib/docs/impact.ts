/**
 * What a change owes the documentation.
 *
 * `docs/documentation/OWNERSHIP-AND-REVIEW.md` says a change is not finished
 * until the page that describes it is. This is that rule as data and one pure
 * function; `scripts/docs-impact.mjs` feeds it `git diff` and the pull
 * request body, and CI fails the pull request it finds wanting.
 *
 * Two kinds of fact are kept honest in two different ways, and this file is
 * only the second:
 *
 *   - **A list of what exists** (routes, events, functions, variables) is held
 *     by a generated or held reference page, whose test goes red the moment the
 *     list and the code differ. No rule here is needed for those; a rule here
 *     that duplicated one would only add a second way to be wrong.
 *   - **A description of what a person experiences** (a screen, a procedure, a
 *     setup step) cannot be diffed. For those the only thing a machine can
 *     check is that *some* page moved when the code did, or that the author
 *     said, out loud and in the pull request, why none needed to.
 *
 * The rules below are the second kind plus the first kind's backstop: a change
 * under a path whose reference is generated still has to touch it, so the
 * author sees the diff before CI does.
 *
 * Pure: no git, no clock, no environment.
 */

export interface ImpactRule {
  id: string;
  /** Paths (repository-relative) that oblige. */
  touches: RegExp;
  /** Paths that match `touches` and still do not oblige: tests, fixtures. */
  except?: RegExp;
  /** A change satisfies the rule by touching any one of these; a trailing `/` is a directory. */
  anyOf: readonly string[];
  /** One clause, shown to the author when the rule fires. */
  why: string;
}

const TEST = /(?:\.test\.[cm]?tsx?|\.check\.sql|\.snapshot|fixtures?\/)/;

export const RULES: readonly ImpactRule[] = [
  {
    id: 'gateway',
    touches: /^(?:app\/server\/institution\/|app\/api\/|packages\/institution\/src\/)/,
    except: TEST,
    anyOf: ['docs/reference/', 'docs/guides/', 'docs/decisions/'],
    why: 'the institution gateway, its contract package or its entry point changed; the API, error and event references describe it',
  },
  {
    id: 'edge-functions',
    touches: /^supabase\/functions\//,
    except: TEST,
    anyOf: ['docs/reference/', 'docs/guides/', 'docs/decisions/'],
    why: 'an edge function or its shared logic changed; EDGE-FUNCTIONS.md and CONFIGURATION.md describe them',
  },
  {
    id: 'integration-worker',
    touches: /^app\/server\/integration\//,
    except: TEST,
    anyOf: ['docs/reference/', 'docs/guides/', 'docs/INTEGRATION-OPERATOR-RUNBOOK.md', 'docs/decisions/'],
    why: 'the integration worker changed; the operator runbook and integration guides describe how it behaves',
  },
  {
    id: 'screens',
    touches: /^app\/src\/screens\/.+\.tsx$/,
    except: TEST,
    anyOf: ['CHANGELOG.md', 'docs/help/', 'docs/support/'],
    why: 'a screen changed; CHANGELOG.md says what a tester will see, docs/help/ and docs/support/ say how to use and fix it',
  },
  {
    id: 'tooling',
    touches: /^(?:app\/package\.json|app\/vite\.config\.ts|app\/tsconfig[^/]*\.json|app\/scripts\/.+|\.github\/workflows\/.+)$/,
    except: TEST,
    anyOf: ['docs/developers/', 'CONTRIBUTING.md', 'CLAUDE.md', 'REGRESSION-CHECKLIST.md', 'docs/decisions/'],
    why: 'a script, a workflow or build configuration changed; onboarding and the testing guide quote the commands',
  },
  {
    id: 'examples',
    touches: /^examples\//,
    except: /(?:\.test\.[cm]?tsx?)$/,
    anyOf: ['docs/guides/integrations/', 'examples/'],
    why: 'a reference application changed; its guide quotes the code and a test holds the quotation',
  },
];

/** `Docs: none because <reason>` on a line of its own, in the pull request body or a commit message. */
export const WAIVER = /^\s*Docs:\s*none because\s+(\S.{9,})$/im;

export interface Finding {
  rule: string;
  /** The changed paths that fired the rule. */
  because: string[];
  why: string;
  wants: readonly string[];
}

export interface Verdict {
  ok: boolean;
  findings: Finding[];
  /** The waiver's reason, if one was given and used. */
  waived: string | null;
}

const hit = (p: string, want: string) => (want.endsWith('/') ? p.startsWith(want) : p === want);

/**
 * Whether the change documents itself. `changed` is every path in the diff;
 * `messages` is the pull request body and the commit messages joined.
 */
export function impact(changed: readonly string[], messages: string): Verdict {
  const findings: Finding[] = [];
  for (const r of RULES) {
    const fired = changed.filter((p) => r.touches.test(p) && !(r.except && r.except.test(p)));
    if (fired.length === 0) continue;
    if (changed.some((p) => r.anyOf.some((w) => hit(p, w)))) continue;
    findings.push({ rule: r.id, because: fired, why: r.why, wants: r.anyOf });
  }
  const waiver = WAIVER.exec(messages);
  if (findings.length > 0 && waiver) return { ok: true, findings, waived: waiver[1].trim() };
  return { ok: findings.length === 0, findings, waived: null };
}
