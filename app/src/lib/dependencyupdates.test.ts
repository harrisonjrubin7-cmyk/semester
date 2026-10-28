import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const updateBlocks = (source: string) => source.split(/^  (?=- package-ecosystem:)/m).filter((block) => block.startsWith('- package-ecosystem:'));

export function workflowLabUpdateProblems(source: string): string[] {
  const problems: string[] = [];
  const block = updateBlocks(source).find((candidate) => /^\s*directory:\s*\/workflow-lab\s*$/m.test(candidate));

  if (!block) return ['Workflow Lab has no dedicated dependency updater'];
  if (!/^- package-ecosystem:\s*npm\s*$/m.test(block)) problems.push('Workflow Lab updater does not use the npm ecosystem');
  if (!/^\s*interval:\s*weekly\s*$/m.test(block)) problems.push('Workflow Lab updater is not weekly');
  if (!/^\s*open-pull-requests-limit:\s*[1-9]\d*\s*$/m.test(block)) problems.push('Workflow Lab updater has no positive pull-request limit');
  if (!/^\s*workflow-lab-minor-and-patch:\s*$/m.test(block)) problems.push('Workflow Lab minor and patch updates are not grouped');
  if (!/^\s*- '\*'\s*$/m.test(block)) problems.push('Workflow Lab update group does not cover every dependency');
  if (!/^\s*- minor\s*$/m.test(block) || !/^\s*- patch\s*$/m.test(block)) problems.push('Workflow Lab update group does not cover both minor and patch updates');

  return problems;
}

export function starterUpdateProblems(source: string): string[] {
  const problems: string[] = [];
  const block = updateBlocks(source).find((candidate) => /^\s*directory:\s*\/starter\s*$/m.test(candidate));

  if (!block) return ['Starter has no dedicated dependency updater'];
  if (!/^- package-ecosystem:\s*npm\s*$/m.test(block)) problems.push('Starter updater does not use the npm ecosystem');
  if (!/^\s*interval:\s*weekly\s*$/m.test(block)) problems.push('Starter updater is not weekly');
  if (!/^\s*open-pull-requests-limit:\s*[1-9]\d*\s*$/m.test(block)) problems.push('Starter updater has no positive pull-request limit');
  if (!/^\s*starter-minor-and-patch:\s*$/m.test(block)) problems.push('Starter minor and patch updates are not grouped');
  if (!/^\s*- '\*'\s*$/m.test(block)) problems.push('Starter update group does not cover every dependency');
  if (!/^\s*- minor\s*$/m.test(block) || !/^\s*- patch\s*$/m.test(block)) problems.push('Starter update group does not cover both minor and patch updates');

  return problems;
}

export function videoUpdateProblems(source: string): string[] {
  const problems: string[] = [];
  const block = updateBlocks(source).find((candidate) => /^\s*directory:\s*\/video\s*$/m.test(candidate));

  if (!block) return ['Video has no dedicated dependency updater'];
  if (!/^- package-ecosystem:\s*npm\s*$/m.test(block)) problems.push('Video updater does not use the npm ecosystem');
  if (!/^\s*interval:\s*weekly\s*$/m.test(block)) problems.push('Video updater is not weekly');
  if (!/^\s*open-pull-requests-limit:\s*[1-9]\d*\s*$/m.test(block)) problems.push('Video updater has no positive pull-request limit');
  if (!/^\s*video-minor-and-patch:\s*$/m.test(block)) problems.push('Video minor and patch updates are not grouped');
  if (!/^\s*- '\*'\s*$/m.test(block)) problems.push('Video update group does not cover every dependency');
  if (!/^\s*- minor\s*$/m.test(block) || !/^\s*- patch\s*$/m.test(block)) problems.push('Video update group does not cover both minor and patch updates');

  return problems;
}

describe('Workflow Lab dependency updates', () => {
  it('holds a weekly, bounded updater beside the standalone lockfile', () => {
    expect(existsSync(join(root, 'workflow-lab/package.json'))).toBe(true);
    expect(existsSync(join(root, 'workflow-lab/package-lock.json'))).toBe(true);
    expect(workflowLabUpdateProblems(read('.github/dependabot.yml'))).toEqual([]);
  });

  it('fails closed when the directory or npm ecosystem is removed', () => {
    const source = read('.github/dependabot.yml');
    expect(workflowLabUpdateProblems(source.replace('directory: /workflow-lab', 'directory: /workflow-lab-disabled'))).toContain(
      'Workflow Lab has no dedicated dependency updater',
    );
    expect(workflowLabUpdateProblems(source.replace(/(- package-ecosystem: )npm(\n\s+directory: \/workflow-lab)/, '$1disabled$2'))).toContain(
      'Workflow Lab updater does not use the npm ecosystem',
    );
  });

  it('fails closed when weekly cadence or grouped update types drift', () => {
    const source = read('.github/dependabot.yml');
    const workflowLab = updateBlocks(source).find((block) => block.includes('directory: /workflow-lab'))!;
    expect(workflowLabUpdateProblems(source.replace(workflowLab, workflowLab.replace('interval: weekly', 'interval: monthly')))).toContain(
      'Workflow Lab updater is not weekly',
    );
    expect(workflowLabUpdateProblems(source.replace(workflowLab, workflowLab.replace('          - patch\n', '')))).toContain(
      'Workflow Lab update group does not cover both minor and patch updates',
    );
  });
});

describe('Starter dependency updates', () => {
  it('holds a weekly, bounded updater beside the standalone pnpm lockfile', () => {
    expect(existsSync(join(root, 'starter/package.json'))).toBe(true);
    expect(existsSync(join(root, 'starter/pnpm-lock.yaml'))).toBe(true);
    expect(starterUpdateProblems(read('.github/dependabot.yml'))).toEqual([]);
  });

  it('fails closed when the directory or npm ecosystem is removed', () => {
    const source = read('.github/dependabot.yml');
    expect(starterUpdateProblems(source.replace('directory: /starter', 'directory: /starter-disabled'))).toContain(
      'Starter has no dedicated dependency updater',
    );
    expect(starterUpdateProblems(source.replace(/(- package-ecosystem: )npm(\n\s+directory: \/starter)/, '$1disabled$2'))).toContain(
      'Starter updater does not use the npm ecosystem',
    );
  });

  it('fails closed when cadence, queue bounds or grouped update types drift', () => {
    const source = read('.github/dependabot.yml');
    const starter = updateBlocks(source).find((block) => block.includes('directory: /starter'))!;
    expect(starterUpdateProblems(source.replace(starter, starter.replace('interval: weekly', 'interval: monthly')))).toContain(
      'Starter updater is not weekly',
    );
    expect(starterUpdateProblems(source.replace(starter, starter.replace('open-pull-requests-limit: 5', 'open-pull-requests-limit: 0')))).toContain(
      'Starter updater has no positive pull-request limit',
    );
    expect(starterUpdateProblems(source.replace(starter, starter.replace('          - patch\n', '')))).toContain(
      'Starter update group does not cover both minor and patch updates',
    );
  });
});

describe('Video dependency updates', () => {
  it('holds a weekly, bounded updater beside the standalone npm lockfile', () => {
    expect(existsSync(join(root, 'video/package.json'))).toBe(true);
    expect(existsSync(join(root, 'video/package-lock.json'))).toBe(true);
    expect(videoUpdateProblems(read('.github/dependabot.yml'))).toEqual([]);
  });

  it('fails closed when the directory or npm ecosystem is removed', () => {
    const source = read('.github/dependabot.yml');
    expect(videoUpdateProblems(source.replace('directory: /video', 'directory: /video-disabled'))).toContain(
      'Video has no dedicated dependency updater',
    );
    expect(videoUpdateProblems(source.replace(/(- package-ecosystem: )npm(\n\s+directory: \/video)/, '$1disabled$2'))).toContain(
      'Video updater does not use the npm ecosystem',
    );
  });

  it('fails closed when cadence, queue bounds or grouped update types drift', () => {
    const source = read('.github/dependabot.yml');
    const video = updateBlocks(source).find((block) => block.includes('directory: /video'))!;
    expect(videoUpdateProblems(source.replace(video, video.replace('interval: weekly', 'interval: monthly')))).toContain(
      'Video updater is not weekly',
    );
    expect(videoUpdateProblems(source.replace(video, video.replace('open-pull-requests-limit: 5', 'open-pull-requests-limit: 0')))).toContain(
      'Video updater has no positive pull-request limit',
    );
    expect(videoUpdateProblems(source.replace(video, video.replace('          - patch\n', '')))).toContain(
      'Video update group does not cover both minor and patch updates',
    );
  });
});
