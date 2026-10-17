#!/usr/bin/env node
/**
 * Evidence census for every public export in the scoped Semester design system.
 *
 * This is deliberately a census, not a readiness assertion. A component is
 * complete only when each requirement from the design-system brief has a
 * repository evidence path. Missing evidence remains visible in the report.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REQUIREMENTS = [
  'typescript_api',
  'accessibility_behavior',
  'visual_states',
  'story_or_test_fixture',
  'light_and_dark_coverage',
  'responsive_behavior',
  'reduced_motion_behavior',
  'usage_documentation',
];

const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';

function walk(directory, predicate, output = []) {
  if (!existsSync(directory)) return output;
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, predicate, output);
    else if (predicate(path)) output.push(path);
  }
  return output;
}

export function publicComponents(indexText) {
  const output = [];
  for (const match of indexText.matchAll(/export\s*\{([^}]+)\}\s*from\s*['"](\.\/[^'"]+)['"]/g)) {
    const source = match[2].replace(/^\.\//, '').replace(/\.jsx$/, '');
    for (const item of match[1].split(',')) {
      const part = item.trim();
      if (!part) continue;
      const [imported, exported = imported] = part.split(/\s+as\s+/);
      output.push({ name: exported.trim(), source, imported: imported.trim() });
    }
  }
  return output.sort((a, b) => a.name.localeCompare(b.name));
}

function evidence(path, root) {
  return relative(root, path).split('\\').join('/');
}

function hasNamedRow(markdown, name, sectionStart, sectionEnd) {
  const start = markdown.indexOf(sectionStart);
  const end = markdown.indexOf(sectionEnd, start + sectionStart.length);
  if (start < 0) return false;
  const section = markdown.slice(start, end < 0 ? undefined : end);
  return section.split('\n').some((line) => line.startsWith(`| **${name}** |`) || line.startsWith(`| ${name} |`));
}

export function componentEvidence({ root = resolve(here, '../..') } = {}) {
  const componentRoot = join(root, 'app/src/components/semester-design');
  const indexPath = join(componentRoot, 'index.ts');
  const specPath = join(root, 'docs/design-system/COMPONENT-SPEC-MATRIX.md');
  const operatingStandardPath = join(root, 'docs/product-design/DESIGN-SYSTEM-OPERATING-STANDARD.md');
  const motionPath = join(root, 'app/src/styles/semester-design/integration.css');
  const spec = read(specPath);
  const standard = read(operatingStandardPath);
  const cards = walk(componentRoot, (path) => path.endsWith('.card.html'));
  const tests = walk(join(root, 'app/src'), (path) => /\.test\.(?:ts|tsx)$/.test(path));

  const components = publicComponents(read(indexPath)).map(({ name, source }) => {
    const sourcePath = [join(componentRoot, `${source}.tsx`), join(componentRoot, `${source}.jsx`)].find(existsSync) ?? join(componentRoot, `${source}.jsx`);
    const declarationPath = join(componentRoot, `${source}.d.ts`);
    const family = source.includes('/') ? source.split('/')[0] : 'root';
    const named = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    const fixture = cards.find((path) => named.test(read(path)));
    const test = tests.find((path) => named.test(read(path)) && !path.endsWith('/semester-design.test.tsx'));
    const hasContract = hasNamedRow(spec, name, '## 2. Components', '## 3. States');
    const hasStates = hasNamedRow(spec, name, '## 3. States', '## 4. Family state defaults');
    const familyContract = family !== 'root' && spec.includes(`| ${family} |`);
    const requirements = {
      typescript_api: [sourcePath, declarationPath].filter(existsSync).map((path) => evidence(path, root)),
      accessibility_behavior: hasContract ? [evidence(specPath, root)] : [],
      visual_states: hasStates ? [evidence(specPath, root)] : [],
      story_or_test_fixture: [fixture, test].filter(Boolean).map((path) => evidence(path, root)),
      light_and_dark_coverage: [],
      responsive_behavior: familyContract ? [evidence(specPath, root)] : [],
      reduced_motion_behavior: /reduced[- ]motion behavior/.test(standard) && existsSync(motionPath)
        ? [evidence(operatingStandardPath, root), evidence(motionPath, root)]
        : [],
      usage_documentation: hasContract ? [evidence(specPath, root)] : [],
    };
    const satisfied = {
      ...Object.fromEntries(REQUIREMENTS.map((requirement) => [requirement, requirements[requirement].length > 0])),
      typescript_api: sourcePath.endsWith('.tsx') ? existsSync(sourcePath) : existsSync(sourcePath) && existsSync(declarationPath),
    };
    const missing = REQUIREMENTS.filter((requirement) => !satisfied[requirement]);
    return { name, family, source: evidence(sourcePath, root), status: missing.length ? 'evidence_incomplete' : 'evidence_complete', requirements, satisfied, missing };
  });

  const complete = components.filter(({ status }) => status === 'evidence_complete').length;
  const missingByRequirement = Object.fromEntries(REQUIREMENTS.map((requirement) => [
    requirement,
    components.filter(({ missing }) => missing.includes(requirement)).map(({ name }) => name),
  ]));
  return {
    status: complete === components.length ? 'complete' : 'incomplete',
    claim_ceiling: 'Repository evidence census only; this report does not prove human accessibility review, visual approval, deployment, or institutional activation.',
    requirements: REQUIREMENTS,
    summary: { total: components.length, complete, incomplete: components.length - complete },
    missing_by_requirement: missingByRequirement,
    components,
  };
}

if (process.argv[1]?.endsWith('design-system-component-evidence.mjs')) {
  const args = process.argv.slice(2);
  const rootArg = args.indexOf('--root');
  const result = componentEvidence(rootArg >= 0 ? { root: resolve(args[rootArg + 1]) } : {});
  const outArg = args.indexOf('--out');
  if (outArg >= 0) {
    const out = resolve(args[outArg + 1]);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${out}`);
  } else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
