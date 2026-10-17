import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COMPONENT_EVIDENCE_REQUIREMENTS = [
  'typescript_api',
  'accessibility_behavior',
  'visual_states',
  'story_or_test_fixture',
  'light_and_dark_coverage',
  'responsive_behavior',
  'reduced_motion_behavior',
  'usage_documentation',
] as const;

export type ComponentEvidenceRequirement = (typeof COMPONENT_EVIDENCE_REQUIREMENTS)[number];

export interface PublicDesignSystemComponent {
  name: string;
  source: string;
  imported: string;
}

export interface ComponentEvidenceRecord {
  name: string;
  family: string;
  source: string;
  status: 'evidence_complete' | 'evidence_incomplete';
  requirements: Record<ComponentEvidenceRequirement, string[]>;
  satisfied: Record<ComponentEvidenceRequirement, boolean>;
  missing: ComponentEvidenceRequirement[];
}

export interface ComponentEvidenceResult {
  status: 'complete' | 'incomplete';
  claim_ceiling: string;
  requirements: readonly ComponentEvidenceRequirement[];
  summary: { total: number; complete: number; incomplete: number };
  missing_by_requirement: Record<ComponentEvidenceRequirement, string[]>;
  components: ComponentEvidenceRecord[];
}

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';

function walk(directory: string, predicate: (path: string) => boolean, output: string[] = []): string[] {
  if (!existsSync(directory)) return output;
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, predicate, output);
    else if (predicate(path)) output.push(path);
  }
  return output;
}

export function publicComponents(indexText: string): PublicDesignSystemComponent[] {
  const output: PublicDesignSystemComponent[] = [];
  for (const match of indexText.matchAll(/export\s*\{([^}]+)\}\s*from\s*['"](\.\/[^'"]+)['"]/g)) {
    const source = match[2]!.replace(/^\.\//, '').replace(/\.jsx$/, '');
    for (const item of match[1]!.split(',')) {
      const part = item.trim();
      if (!part) continue;
      const names = part.split(/\s+as\s+/);
      const imported = names[0]!.trim();
      output.push({ name: (names[1] ?? imported).trim(), source, imported });
    }
  }
  return output.sort((a, b) => a.name.localeCompare(b.name));
}

const evidence = (path: string, root: string) => relative(root, path).split('\\').join('/');

function hasNamedRow(markdown: string, name: string, sectionStart: string, sectionEnd: string): boolean {
  const start = markdown.indexOf(sectionStart);
  const end = markdown.indexOf(sectionEnd, start + sectionStart.length);
  if (start < 0) return false;
  const section = markdown.slice(start, end < 0 ? undefined : end);
  return section.split('\n').some((line) => line.startsWith(`| **${name}** |`) || line.startsWith(`| ${name} |`));
}

export function componentEvidence({ root = sourceRoot }: { root?: string } = {}): ComponentEvidenceResult {
  const componentRoot = join(root, 'app/src/components/semester-design');
  const specPath = join(root, 'docs/design-system/COMPONENT-SPEC-MATRIX.md');
  const operatingStandardPath = join(root, 'docs/product-design/DESIGN-SYSTEM-OPERATING-STANDARD.md');
  const motionPath = join(root, 'app/src/styles/semester-design/integration.css');
  const spec = read(specPath);
  const standard = read(operatingStandardPath);
  const cards = walk(componentRoot, (path) => path.endsWith('.card.html'));
  const tests = walk(join(root, 'app/src'), (path) => /\.test\.(?:ts|tsx)$/.test(path));

  const components: ComponentEvidenceRecord[] = publicComponents(read(join(componentRoot, 'index.ts'))).map(({ name, source }) => {
    const sourcePath = [join(componentRoot, `${source}.tsx`), join(componentRoot, `${source}.jsx`)].find(existsSync) ?? join(componentRoot, `${source}.jsx`);
    const declarationPath = join(componentRoot, `${source}.d.ts`);
    const family = source.includes('/') ? source.split('/')[0]! : 'root';
    const named = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    const fixture = cards.find((path) => named.test(read(path)));
    const test = tests.find((path) => named.test(read(path)) && !path.endsWith('/semester-design.test.tsx'));
    const hasContract = hasNamedRow(spec, name, '## 2. Components', '## 3. States');
    const hasStates = hasNamedRow(spec, name, '## 3. States', '## 4. Family state defaults');
    const familyContract = family !== 'root' && spec.includes(`| ${family} |`);
    const requirements: Record<ComponentEvidenceRequirement, string[]> = {
      typescript_api: [sourcePath, declarationPath].filter(existsSync).map((path) => evidence(path, root)),
      accessibility_behavior: hasContract ? [evidence(specPath, root)] : [],
      visual_states: hasStates ? [evidence(specPath, root)] : [],
      story_or_test_fixture: [fixture, test].filter((path): path is string => Boolean(path)).map((path) => evidence(path, root)),
      light_and_dark_coverage: [],
      responsive_behavior: familyContract ? [evidence(specPath, root)] : [],
      reduced_motion_behavior: /reduced[- ]motion behavior/.test(standard) && existsSync(motionPath)
        ? [evidence(operatingStandardPath, root), evidence(motionPath, root)]
        : [],
      usage_documentation: hasContract ? [evidence(specPath, root)] : [],
    };
    const satisfied = Object.fromEntries(COMPONENT_EVIDENCE_REQUIREMENTS.map((requirement) => [requirement, requirements[requirement].length > 0])) as Record<ComponentEvidenceRequirement, boolean>;
    satisfied.typescript_api = sourcePath.endsWith('.tsx') ? existsSync(sourcePath) : existsSync(sourcePath) && existsSync(declarationPath);
    const missing = COMPONENT_EVIDENCE_REQUIREMENTS.filter((requirement) => !satisfied[requirement]);
    return { name, family, source: evidence(sourcePath, root), status: missing.length ? 'evidence_incomplete' : 'evidence_complete', requirements, satisfied, missing };
  });

  const complete = components.filter(({ status }) => status === 'evidence_complete').length;
  const missingByRequirement = Object.fromEntries(COMPONENT_EVIDENCE_REQUIREMENTS.map((requirement) => [
    requirement,
    components.filter(({ missing }) => missing.includes(requirement)).map(({ name }) => name),
  ])) as Record<ComponentEvidenceRequirement, string[]>;
  return {
    status: complete === components.length ? 'complete' : 'incomplete',
    claim_ceiling: 'Repository evidence census only; this report does not prove human accessibility review, visual approval, deployment, or institutional activation.',
    requirements: COMPONENT_EVIDENCE_REQUIREMENTS,
    summary: { total: components.length, complete, incomplete: components.length - complete },
    missing_by_requirement: missingByRequirement,
    components,
  };
}
