import { codeOf, productionOnly } from './graph.ts';
import { areaOf, type Tree } from './rules.ts';

/**
 * Where every existing file is meant to end up.
 *
 * A proposal, mechanically derived, so that it can be re-run and argued with.
 * Ownership is a first-match list of path patterns; disposition follows from
 * what a file *does* (does it render, does it touch storage or the network,
 * does anything import it), not from what it is called. The unmatched are
 * reported as `unassigned` rather than guessed — a number the plan has to
 * shrink, not hide.
 *
 * It decides nothing. A person moving a file reads the row, then the file.
 */

export const DOMAINS = [
  'identity', 'policy', 'tasks', 'calendar', 'today', 'academic', 'learning', 'productivity', 'ai',
  'campus', 'community', 'family', 'career', 'finance', 'admin', 'support-trust', 'platform',
] as const;
export type DomainName = (typeof DOMAINS)[number];

/** `[domain, pattern]`, tried in order against the path relative to `src`. Order carries meaning: specific before general. */
export const OWNERSHIP: readonly (readonly [DomainName, RegExp])[] = [
  // The slice that exists already.
  ['identity', /^domains\/identity\//],
  ['policy', /^domains\/policy\//],
  ['tasks', /^domains\/tasks\//],
  ['calendar', /^domains\/calendar\//],
  ['today', /^domains\/today\//],
  ['platform', /^(kernel|composition|architecture)\//],

  // Trust, governance and operating documentation kept as code.
  ['support-trust', /^lib\/(governance|ops|trust|launch|verify|equity|record|history|k12)\//],
  ['support-trust', /^lib\/[a-z0-9-]*(register|scorecard|readiness|launchkit|operationalreality|masterregister|oneos|onesystem|blueprint|supplychain|benchmark|learningregister|knownlimitations|incident|postmortem|sla|trustdashboard|trustlink|trustroom|support|supporttickets|tickethandoff|trouble|audit|diagnose|statusnotice|syncstatus|handoff-status|perfbudget|previewsecurity|cspheader|usage|counts|failure|fault)[a-z0-9.-]*\.tsx?$/],
  ['support-trust', /^screens\/(TrustRoom|Support|Help|Reports|Proof|Update|Changes|WhatsNew)\.tsx$/],

  // Institution and integrations.
  ['admin', /^(lib|components)\/(integration|migration|console|institutional|enrollment\/)/],
  ['admin', /^lib\/(university|institution|institutional|interop|migrate|ltiarrival|ltilanding|ltiscore|canvas|connectregister|office-actions|officeagenda|registrar|agreement|adopt|adoptpieces|expansion|replaceregister|definerregister)[a-z0-9.-]*\.tsx?$/],
  ['admin', /^screens\/(University|Registrar|Console|Agreements|Data|Import)\.tsx$/],

  // Commercial.
  ['finance', /^lib\/(billing|gtm|finance)\//],
  ['finance', /^lib\/(bill|cost|spend|subscribe|plans|membership|deal|price|beta|pilot|launchpad)[a-z0-9.-]*\.tsx?$/],
  ['finance', /^screens\/(Bill|Costs|Springboard)\.tsx$/],

  // Identity, then policy.
  ['identity', /^lib\/(role|rolelaunch|rolespec|capabilities|profile|session|session\.place|account|age|aboutme|password|oauthscopes|school|schoolclaim|schoollinks|schoolpack|school-records-hook|findschool|fromschool|joined|invite|institutional-access|privacy|data-rights|mecontrols|orgs|consent|deletions|readonly)[a-z0-9.-]*\.tsx?$/],
  ['identity', /^screens\/(Account|Me|Profile|Privacy|FirstRun|Onboarding)\.tsx$/],
  ['policy', /^lib\/(aiflags|experience-flags|flags|featurepolicy|modulegate|modulemode|rollout-|screen-governance|entitlement|quota|allowance|edgeguards|keys|keygate|accessmode|prefers|calm-)[a-z0-9.-]*\.tsx?$/],
  ['policy', /^lib\/(config)\//],

  // Today and what feeds it.
  ['today', /^lib\/(today-|nextstep|welcome|whatchanged|whatsnew|onhome|beats|brief|runway|underway|waiting|ahead|behind|since|launcher|journey|journeys|journey-areas|operating-rhythm|life-balance|lifeevents|momentfeedback)[a-z0-9.-]*\.tsx?$/],
  ['today', /^screens\/(Today|Behind|Runway|Launchpad|Hub)\.tsx$/],
  ['today', /^components\/(Today|ActionCenter|CrunchWeek|ExplanationSheet|NextStep)[A-Za-z]*\.tsx$/],

  // Tasks and calendar.
  ['tasks', /^lib\/(chores|goals|goal-plan|flight-plan|flight-plan-storage|repeat|deadline-feed|deadline-groups|duetime|doing|again|undo|actions|actionchoices|steps|plan-recovery|dayplan)[a-z0-9.-]*\.tsx?$/],
  ['tasks', /^screens\/(Work|Guess)\.tsx$/],
  ['calendar', /^lib\/(calsource|clash|monthgrid|ics|opencal|weekpage|weekly|weekly-reset|daily-rhythm|hourplace|hourwindow|clocks|intime|arrange|select|date|timing|term|termload|termtransition|ladder|rail|attend|beats)[a-z0-9.-]*\.tsx?$/],
  ['calendar', /^screens\/(Calendar|calendar|Clocks)\.tsx$/],

  // Learning and academic record.
  ['academic', /^lib\/(degree|graduation|graduation-cloud|registration|registration-actions|registration-day|registration-plan|registration-window|credits|transcript|transferhub|gradebook|grades|gradesheet|gpasheet|termgpa|pathway|path-profile|path-readiness|abroad|advisor|advisor-attachments|advisor-meeting|advisor-shares|academic-recovery|courserules|cutoffs|standing|standard|learnerrecord|learner-pathways)[a-z0-9.-]*\.tsx?$/],
  ['academic', /^lib\/(gradebook|advancement|enrollment|assessment)\//],
  ['academic', /^screens\/(Degree|Registration|Registrar|Gradebook|Grades|Pathway|Courses|EditCourse|Gap|GapOffer)\.tsx$/],
  ['learning', /^lib\/(study|studyjournal|studystudio|study-readiness|quiz|quiz-feedback|drilldeck|fsrs|interleave|review|teachback|socratic|itembank|exam|examattempt|pretest|learning|learningintent|learninginsights|learningmap|learningprefs|learning-loop|skills-graph|course|course-capture|course-demand|course-demand-remote|course-detail|coursestudio|assignment|attempt|rubricengine|solve|maths|calc|fourier|laplace|plot|hilbert|wavelet|poly|discrete|fractional|gap|gaps|vocabulary|worked|reading|readout|harvest|packet|handout|guidebook|help-routes|essay|draft|revise|score|stats|toolkit)[a-z0-9.-]*\.tsx?$/],
  ['learning', /^lib\/toolkit\//],
  ['learning', /^screens\/(Study|Drill|Lesson|Exam|Solve|Equations|Analyse|Guide|Guides|Sources|Essay|Create|Draw|Field)\.tsx$/],

  // Productivity suite.
  ['productivity', /^lib\/(document|doc[a-z]*|sheet|sheet[a-z]*|deck|decks|slides|xlsx[a-z]*|docx[a-z]*|pptx|pdf[a-z]*|ooxml|svgout|files|folders|downloads|zips|workspace-backup|workspace-view|creations|designtemplates|capture|capture-policy|clips|figure|diagram|chart|chartlayer|condfmt|cutout|covers|pivot|grid|margins|layout|doclayout|edit|merge|rediff|changeset|coedit|cocanvas|shots|shelf|bookmarks|bookmarks\.hook|browser|browser\.hook|notes|productivity|productivity-tools|productivity-cloud|productivity-arrival|tools|toolscope|toolnow|drivehome|asset|imagesize|qr|barcode|exportqa|export|asset)[a-z0-9.-]*\.tsx?$/],
  ['productivity', /^screens\/(Write|write|Sheet|sheet|Deck|deck|Slides|Mine|mine|Export)\.tsx$/],
  ['productivity', /^components\/(creation|ProductivityWorkspace|Grapher|desk)[A-Za-z/]*/],

  // AI.
  ['ai', /^(ai|intelligence|insights)\//],
  ['ai', /^lib\/(claude|openai|assistant|assistant-confidence|localask|ask-human|classify|generate|extract|explain|aloud|speak|mic|transcribe|voice|voiceloop|sound|cite|context|context-graph|aihandoff|intent|suggest|typeahead|learningregister)[a-z0-9.-]*\.tsx?$/],
  ['ai', /^screens\/(Ask|Search)\.tsx$/],

  // Campus, community, family, career.
  ['campus', /^lib\/(dining|athletics|athletics\.hook|athleteshare|activities|activity|meals|menus|maps|geocode|locate|near|findplace|rooms|room-availability|roomchat|roomprefs|housing|house|campusdirectory|directory|offices|officehours|office-actions|listings|official-notices|announce|basicneeds|casework|travelpack|taping)[a-z0-9.-]*\.tsx?$/],
  ['campus', /^lib\/dining\//],
  ['campus', /^screens\/(Activities|Activity|Athletics|Dining|Directory|Housing|Maps|Meals|People|Classmates)\.tsx$/],
  ['community', /^community\//],
  ['community', /^lib\/(classmates|connect|meet|groupwork|mail|mailbox|mailrules|moderation|mentors|linkgroups|communitiesregister|feed|feedlink|volunteer|call|rtc|forwork|formshare|sharing|shared|threads|comms|referral)[a-z0-9.-]*\.tsx?$/],
  ['community', /^screens\/(Community|Connect|Meet|Mail|Moderation|Volunteer|Volunteers|Respond|call|Links)\.tsx$/],
  ['family', /^lib\/(family|familyinvites|familyshare|clientfamily|parent)[a-z0-9.-]*\.tsx?$/],
  ['family', /^screens\/Family\.tsx$/],
  ['career', /^lib\/(career|career-evidence|opportunities|apply|credential-wallet|letters|skills|journey|expertpack|office)[a-z0-9.-]*\.tsx?$/],
  ['career', /^screens\/(Career|Applying|Opportunities)\.tsx$/],

  // Course content is data, not code.
  ['learning', /^data\//],
  ['learning', /^content\//],

  // Everything that every domain stands on.
  ['platform', /^(a11y|styles|site|state)\//],
  ['platform', /^(App|main|screens|headers)\.tsx?$/],
  ['platform', /^lib\/(cloud|sync|stored|device-library|device|idb|locale|route|nav|navareas|tabs|tabbar|look|tint|dim|contrast|types|keyboard|offline|offline-mode|push|notify|import|import-review|backup|search|find|lookup|deeplink|returnto|redirected|scrolling\.hook|chrome|chrome\.hook|surface|ui|uxstates|validate|fields|filter|folds|folds\.hook|names|kinds|inventory|idempotency|net|nil|sitting|sitting\.hook|toolscope|environment|publichost|portal-storage|recoverydrafts|refresh|returned|drag|drop|ribbon|strip|tone|token|warm|where|you|yours|yes|zips)[a-z0-9.-]*\.tsx?$/],
  ['platform', /^lib\/(sync|contract|__docs|__pix)\//],
  ['platform', /^components\/(ui|Page|Fold|Icons|Blueprint|nav|shell|soft|Command|unity|mail|room)[A-Za-z/.]*/],
];

export type Disposition = 'reuse' | 'migrate' | 'replace' | 'archive' | 'delete-candidate';

export interface Row {
  readonly path: string;
  readonly loc: number;
  readonly domain: DomainName | 'unassigned';
  readonly disposition: Disposition;
  /** The one sentence that says why this disposition, so a row can be argued with. */
  readonly because: string;
}

const TOUCHES_WORLD = /\b(?:localStorage|sessionStorage|indexedDB|fetch\s*\(|supabase|import\.meta\.env|useSyncExternalStore|createContext)\b/i;
const RENDERS = /\bfrom\s+['"]react(?:-dom)?(?:\/[^'"]*)?['"]|\.tsx$/;
/** Entry points and things loaded by a path the import scanner does not follow. */
const ENTRY = /^(main\.tsx|site\/.*|vite-env\.d\.ts)$/;
const PRIMITIVE_FAN_IN = 25;

export function ownerOf(path: string): DomainName | 'unassigned' {
  for (const [domain, re] of OWNERSHIP) if (re.test(path)) return domain;
  return 'unassigned';
}

/** Archive candidates: documentation kept as code. They belong in the repository's ops tooling, not the client. */
const ARCHIVE = /^lib\/(governance|ops|trust|gtm|launch|verify|equity|record|history|k12)\/|register\.tsx?$|^lib\/(masterregister|oneos|onesystem|blueprint|supplychain|launchkit|operationalreality)\.tsx?$/;

/** What a file is reachable from: the files something outside `src` or the browser loads. */
function reachableFrom(entries: readonly string[], prod: ReturnType<typeof productionOnly>): Set<string> {
  const seen = new Set<string>();
  const queue = entries.filter((e) => prod.files.has(e));
  while (queue.length) {
    const f = queue.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const e of prod.byFile.get(f) ?? []) if (e.to && !seen.has(e.to)) queue.push(e.to);
  }
  return seen;
}

/**
 * Give a file the domain its neighbours belong to.
 *
 * A component called `AbsenceNotices` is not named for a domain, but it imports
 * `lib/attend` and `lib/calsource`, which are. Pass one votes by what a file
 * imports (right for a screen or component, which exists to talk to a domain);
 * pass two votes by who imports it (right for a helper that has no opinion of
 * its own). `platform` only wins when nothing else votes: everything imports
 * the platform, so counting it would drown the signal.
 */
function voteOwners(owner: Map<string, DomainName | 'unassigned'>, prod: ReturnType<typeof productionOnly>): void {
  const tally = (neighbours: Iterable<string>): DomainName | 'unassigned' => {
    const votes = new Map<string, number>();
    for (const n of neighbours) {
      const d = owner.get(n);
      if (d && d !== 'unassigned') votes.set(d, (votes.get(d) ?? 0) + 1);
    }
    const specific = [...votes].filter(([d]) => d !== 'platform').sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (specific.length) return specific[0][1] > (specific[1]?.[1] ?? 0) ? (specific[0][0] as DomainName) : 'unassigned';
    return votes.has('platform') ? 'platform' : 'unassigned';
  };
  const importersOf = new Map<string, string[]>();
  for (const e of prod.edges) if (e.to) (importersOf.get(e.to) ?? importersOf.set(e.to, []).get(e.to)!).push(e.from);

  for (const f of prod.files) {
    if (owner.get(f) !== 'unassigned') continue;
    owner.set(f, tally((prod.byFile.get(f) ?? []).flatMap((e) => (e.to ? [e.to] : []))));
  }
  for (const f of prod.files) {
    if (owner.get(f) !== 'unassigned') continue;
    owner.set(f, tally(importersOf.get(f) ?? []));
  }
}

export function classify(tree: Tree, entries: readonly string[] = ['main.tsx', 'site/render.tsx']): Row[] {
  const prod = productionOnly(tree.graph);
  const reachable = reachableFrom(entries, prod);
  const owner = new Map<string, DomainName | 'unassigned'>([...prod.files].map((f) => [f, ownerOf(f)]));
  voteOwners(owner, prod);
  // Who imports each file, from product code: for "does the product need it" and for the shared-primitive test.
  const prodImporters = new Map<string, Set<string>>();
  for (const e of prod.edges) if (e.to) (prodImporters.get(e.to) ?? prodImporters.set(e.to, new Set()).get(e.to)!).add(e.from);

  const rows: Row[] = [];
  for (const path of [...prod.files].sort()) {
    const text = tree.sources[path] ?? '';
    const code = codeOf(text);
    const loc = text.split('\n').length;
    const domain = owner.get(path) ?? 'unassigned';
    const area = areaOf(path);
    const fanIn = prodImporters.get(path)?.size ?? 0;

    let disposition: Disposition;
    let because: string;
    if (ARCHIVE.test(path)) {
      const outside = [...(prodImporters.get(path) ?? [])].filter((f) => !ARCHIVE.test(f));
      disposition = outside.length === 0 ? 'archive' : 'migrate';
      because = outside.length === 0 ? 'documentation kept as code, imported only by other such files and tests: move out of the client bundle' : `documentation kept as code, but ${outside.length} product file(s) import it: serve it from the server instead`;
    } else if (!reachable.has(path) && !ENTRY.test(path) && !/^(architecture|kernel|composition|domains)\//.test(path)) {
      disposition = 'delete-candidate';
      because = 'no import path from any entry point reaches it: dead in the product, alive only if a test imports it. Confirm no script or glob loads it, then delete it with its test';
    } else if ((area === 'screens' || area === 'components') && fanIn < PRIMITIVE_FAN_IN) {
      disposition = 'replace';
      because = 'a screen or component composed over legacy state: rebuild as a thin view of a domain read model';
    } else if (area === 'components') {
      disposition = 'reuse';
      because = `a shared primitive (${fanIn} importers): the design system`;
    } else if (area === 'data') {
      disposition = 'reuse';
      because = 'course content: move to a content package unchanged';
    } else if (TOUCHES_WORLD.test(code)) {
      disposition = 'migrate';
      because = 'touches storage, the network, the environment or React state: needs a port and an adapter before it can move';
    } else if (RENDERS.test(code)) {
      disposition = 'migrate';
      because = 'imports React: separate the logic from the hook';
    } else {
      disposition = 'reuse';
      because = 'pure logic with no ambient dependency: wrap behind an adapter now, move into its domain when next touched';
    }
    rows.push({ path, loc, domain, disposition, because });
  }
  return rows;
}

export interface Summary {
  readonly byDomain: Record<string, { files: number; loc: number } & Record<Disposition, number>>;
  readonly byDisposition: Record<Disposition, { files: number; loc: number }>;
  readonly unassigned: number;
}

export function summarize(rows: readonly Row[]): Summary {
  const blank = () => ({ files: 0, loc: 0, reuse: 0, migrate: 0, replace: 0, archive: 0, 'delete-candidate': 0 });
  const byDomain: Summary['byDomain'] = {};
  const byDisposition = {} as Summary['byDisposition'];
  for (const r of rows) {
    const d = (byDomain[r.domain] ??= blank());
    d.files++;
    d.loc += r.loc;
    d[r.disposition]++;
    const x = (byDisposition[r.disposition] ??= { files: 0, loc: 0 });
    x.files++;
    x.loc += r.loc;
  }
  return { byDomain, byDisposition, unassigned: byDomain.unassigned?.files ?? 0 };
}

export const csv = (rows: readonly Row[]): string =>
  ['path,loc,domain,disposition,because', ...rows.map((r) => [r.path, r.loc, r.domain, r.disposition, `"${r.because}"`].join(','))].join('\n') + '\n';

