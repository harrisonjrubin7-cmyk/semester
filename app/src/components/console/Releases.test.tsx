// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { EXPERIENCE_FLAGS, MODULE_FLAG_NAMES, experienceFlags, moduleFlags } from '../../lib/experience-flags';
import { toolkitFlags, TOOLKIT_FLAGS } from '../../lib/toolkit/flags';
import { communityFlags, COMMUNITY_FLAGS } from '../../community/flags';
import { Releases, flagRows } from './Releases';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

const experience = {
  ...experienceFlags({}),
  humanHelp: 'production' as const,
  integrationDashboard: 'sandbox' as const,
  workflowBuilder: 'preview' as const,
};
const modules = { ...moduleFlags({}), cost_planner: 'production' as const };
// Flags that live outside experience-flags.ts, switched on the way a build would: by environment variable.
const toolkit = toolkitFlags({ VITE_AI_TOOLKIT: 'sandbox', VITE_TOOLKIT_DATA_UPLOAD: 'preview', VITE_TOOLKIT_RESEARCH: 'sandbox' });
const community = communityFlags({ VITE_COMMUNITY_FEED: 'production', VITE_COMMUNITY_IMAGES: 'sandbox' });

const mount = (filter = '') =>
  act(async () =>
    root.render(<Releases env="Staging" filter={filter} experience={experience} modules={modules} toolkit={toolkit} community={community} language="preview" />),
  );
const cells = (label: string) => [...host.querySelectorAll('tbody tr')].find((tr) => tr.querySelector('th')?.textContent === label);

it('lists every flag the registry has, so the tab cannot fall behind it', async () => {
  await mount();
  const ids = flagRows(experience, modules, toolkit, community, 'preview').map((r) => r.id);
  for (const key of Object.keys(EXPERIENCE_FLAGS)) expect(ids, key).toContain(`experience.${key}`);
  for (const name of MODULE_FLAG_NAMES) expect(ids, name).toContain(`module.${name}`);
  for (const key of Object.keys(TOOLKIT_FLAGS)) expect(ids, key).toContain(`toolkit.${key}`);
  for (const key of Object.keys(COMMUNITY_FLAGS)) expect(ids, key).toContain(`community.${key}`);
  expect(ids).toContain('language');
  expect(host.querySelectorAll('tbody tr')).toHaveLength(
    Object.keys(EXPERIENCE_FLAGS).length + MODULE_FLAG_NAMES.length + Object.keys(TOOLKIT_FLAGS).length + Object.keys(COMMUNITY_FLAGS).length + 1,
  );
});

it('shows flags enabled outside experience-flags.ts, which a build can turn on by variable', async () => {
  await mount();
  expect(cells('Toolkit: research studio')?.textContent).toContain('Sandbox');
  expect(cells('Toolkit: data upload')?.textContent).toContain('Preview');
  expect(cells('AI Toolkit')?.textContent).toContain('Sandbox');
  expect(cells('Community: feed')?.textContent).toContain('On in production');
  expect(cells('Community: images')?.textContent).toContain('Sandbox');
  expect(cells('Language')?.textContent).toContain('Preview');
});

it('says what the registries themselves say: unbuilt toolkit flags cannot be on, high-risk community flags never follow preview', async () => {
  await mount();
  expect(cells('Toolkit: code execution')?.textContent).toContain('Cannot be switched on from this build');
  expect(cells('Community: images')?.textContent).toContain('High risk');
  expect(cells('Community: feed')?.textContent).not.toContain('High risk');
  expect(cells('Community: feed')?.textContent).toContain('Communities, memberships, finite explained feeds, study sessions.');
});

it('does not claim to list every flag, since it lists the registries it reads', async () => {
  await mount();
  expect(host.textContent).toContain('experience, module, toolkit and community flag registries');
  expect(host.textContent).not.toMatch(/every feature flag/i);
});

it('says each state in words and puts what is live first', async () => {
  await mount();
  expect(cells('Human help')?.textContent).toContain('On in production');
  expect(cells('Integration dashboard')?.textContent).toContain('Sandbox');
  expect(cells('Workflow builder')?.textContent).toContain('Preview');
  expect(cells('Student accounts')?.textContent).toContain('Off');
  const first = host.querySelector('tbody tr')!;
  expect(first.textContent).toContain('On in production');
  const states = [...host.querySelectorAll('tbody tr td:nth-of-type(1)')].map((td) => td.textContent);
  expect(states.indexOf('Off')).toBeGreaterThan(states.lastIndexOf('Preview'));
});

it('is read-only: no control that would pretend to change a build-time flag', async () => {
  await mount();
  expect(host.querySelectorAll('button, input, select, textarea, [role="switch"], [role="checkbox"]')).toHaveLength(0);
  expect(host.textContent).toContain('Read-only');
  expect(host.textContent).toContain('make a new build');
});

it('says so when the registry does not describe a flag, instead of inventing a sentence', async () => {
  await mount();
  expect(cells('Adaptive learning')?.textContent).toContain('Not described in the flag registry.');
  expect(cells('Workflow builder')?.textContent).toContain('second-person publish rule');
});

it('filters by name or state, and says when nothing matches', async () => {
  await mount('workflow builder');
  const rows = host.querySelectorAll('tbody tr');
  expect(rows).toHaveLength(1);
  expect(rows[0].textContent).toContain('Workflow builder');
  await mount('sandbox');
  const names = [...host.querySelectorAll('tbody tr th')].map((th) => th.textContent);
  expect(names).toEqual(expect.arrayContaining(['Integration dashboard', 'AI Toolkit', 'Toolkit: research studio', 'Community: images']));
  expect(names).not.toContain('Workflow builder');
  await mount('no-such-flag');
  expect(host.querySelectorAll('tbody tr')).toHaveLength(0);
  expect(host.textContent).toContain('No flags match.');
});
