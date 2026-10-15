// @vitest-environment jsdom
/**
 * The Configuration Studio, driven through an injected client. The client is
 * the only fake, and it keeps the database's rules by calling the same
 * `problems` the screen reads and by refusing the drafter a publish — so what
 * the screen offers is what the fake allows, and a refusal comes back in the
 * trigger's own words. The screen, its copy and its gating are the shipping
 * code.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refusal, type ConfigApi } from '../../lib/config/api';
import { current, problems, type ConfigDomain, type ConfigVersion, type Settings } from '../../lib/config/studio';
import { ConfigurationStudio } from './ConfigurationStudio';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EDITOR = 'user-editor';
const REGISTRAR = 'user-registrar';
const T = '2026-10-01T00:00:00.000Z';

const EDIT = ['config:manage', 'config:view'];
const PUBLISH = ['config:publish', 'config:view'];
const BOTH = ['config:manage', 'config:publish', 'config:view'];

function published(domain: ConfigDomain, version: number, settings: Settings, note = ''): ConfigVersion {
  return {
    id: `${domain}-${version}`, tenant_id: 'vu', domain, state: 'published', version, settings, note, based_on: null,
    created_by: EDITOR, published_by: REGISTRAR, created_at: T, updated_at: T, published_at: T,
  };
}
function draftRow(domain: ConfigDomain, settings: Settings, by = EDITOR): ConfigVersion {
  return {
    id: `${domain}-draft`, tenant_id: 'vu', domain, state: 'draft', version: null, settings, note: '', based_on: null,
    created_by: by, published_by: null, created_at: T, updated_at: T, published_at: null,
  };
}

/** An in-memory table that refuses what the trigger refuses. */
function fake(start: ConfigVersion[], viewer: string) {
  let rows = [...start];
  const api = {
    list: vi.fn(async () => rows),
    saveDraft: vi.fn(async (_t: string, domain: ConfigDomain, settings: Settings, note: string, basedOn: number | null, existing: ConfigVersion | null) => {
      const bad = problems(domain, settings);
      if (bad.length) throw refusal({ message: `This configuration is not valid: ${bad.join(', ')}` }, '');
      if (existing) rows = rows.map((r) => (r.id === existing.id ? { ...r, settings, note, based_on: basedOn, updated_at: `${T}#${rows.length}` } : r));
      else rows = [...rows, { ...draftRow(domain, settings, viewer), note, based_on: basedOn }];
    }),
    discardDraft: vi.fn(async (id: string) => {
      rows = rows.filter((r) => r.id !== id);
    }),
    publish: vi.fn(async (d: ConfigVersion) => {
      if (d.created_by === viewer) throw refusal({ message: 'Whoever drafted a configuration does not publish it.' }, '');
      const next = (current(rows, d.domain)?.version ?? 0) + 1;
      rows = rows.map((r) => (r.id === d.id ? { ...r, state: 'published' as const, version: next, published_by: viewer, published_at: T } : r));
    }),
  };
  return api as unknown as ConfigApi & Record<keyof ConfigApi, ReturnType<typeof vi.fn>>;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function mount(api: ConfigApi, viewerId: string, holds: readonly string[]) {
  await act(async () => {
    root.render(<ConfigurationStudio tenantId="vu" viewerId={viewerId} holds={holds} api={api} />);
  });
}
const button = (re: RegExp) => [...host.querySelectorAll('button')].find((b) => re.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
async function click(el: HTMLElement | undefined) {
  expect(el, 'control not found').toBeTruthy();
  await act(async () => el!.click());
}
function type(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const byId = (id: string) => host.querySelector(`#cfg-${id}`) as HTMLInputElement;
/** The "Set for this school" box under a setting. */
const setBox = (id: string) => byId(id).closest('div')!.querySelector('input[type="checkbox"]:not(fieldset input)') as HTMLInputElement;
async function open(name: RegExp) {
  await click(button(name));
}

describe('the domain list', () => {
  it('lists all eleven domains and says, first, that nothing reads the settings yet', async () => {
    await mount(fake([], EDITOR), EDITOR, EDIT);
    for (const d of ['Academic structure', 'Workflows', 'Roles', 'Branding and terminology', 'Content', 'AI', 'Notifications', 'Data', 'Features', 'Accessibility', 'Reporting']) {
      expect(button(new RegExp(`^${d}`)), d).toBeTruthy();
    }
    expect(host.textContent).toContain('Nothing in the app reads these settings yet');
  });

  it('shows each domain’s version, or the platform defaults, and whether a draft waits', async () => {
    await mount(fake([published('workflows', 3, { approval_sla_days: 4 }), draftRow('ai', { ai_enabled: false })], EDITOR), EDITOR, EDIT);
    expect(button(/^Workflows/)!.textContent).toContain('Version 3 · 1 set');
    expect(button(/^Roles/)!.textContent).toContain('Platform defaults');
    expect(button(/^AI/)!.textContent).toContain('draft waiting');
  });

  it('says so when the school can’t be reached', async () => {
    const api = { ...fake([], EDITOR), list: vi.fn(async () => { throw new Error('Could not load the configuration.'); }) } as unknown as ConfigApi;
    await mount(api, EDITOR, EDIT);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not load the configuration.');
  });
});

describe('drafting', () => {
  it('sends only what the editor set, and starts a draft the editor cannot publish', async () => {
    const api = fake([], EDITOR);
    await mount(api, EDITOR, EDIT);
    await open(/^Workflows/);
    await click(setBox('approval_sla_days'));
    await act(async () => type(byId('approval_sla_days'), '3'));
    await click(button(/Start a draft/));
    expect(api.saveDraft).toHaveBeenCalledWith('vu', 'workflows', { approval_sla_days: 3 }, '', null, null);
    expect(host.textContent).toContain('Draft saved.');
    expect(button(/Publish as version/)).toBeUndefined();
  });

  it('stops a value the database would refuse before it is sent', async () => {
    const api = fake([], EDITOR);
    await mount(api, EDITOR, EDIT);
    await open(/^Workflows/);
    await click(setBox('approval_sla_days'));
    await act(async () => type(byId('approval_sla_days'), '0'));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Days an approval may wait');
    expect((button(/Start a draft/) as HTMLButtonElement).disabled).toBe(true);
    expect(api.saveDraft).not.toHaveBeenCalled();
  });

  it('shows the change against the version in force, in words', async () => {
    await mount(fake([published('workflows', 1, { approval_sla_days: 5 })], EDITOR), EDITOR, EDIT);
    await open(/^Workflows/);
    await act(async () => type(byId('approval_sla_days'), '9'));
    expect(host.textContent).toContain('Changes from version 1:');
    expect(host.textContent).toContain('Days an approval may wait: 5 → 9');
  });

  it('offers a reader nothing to save', async () => {
    await mount(fake([published('ai', 1, { ai_enabled: false })], 'reader'), 'reader', ['config:view']);
    await open(/^AI/);
    expect(host.textContent).toContain('cannot draft changes');
    expect(button(/Start a draft|Save draft/)).toBeUndefined();
    expect((byId('ai_enabled') as unknown as HTMLSelectElement).disabled).toBe(true);
  });

  it('discards a draft and returns to the version in force', async () => {
    const api = fake([published('workflows', 1, { approval_sla_days: 5 }), draftRow('workflows', { approval_sla_days: 9 })], EDITOR);
    await mount(api, EDITOR, EDIT);
    await open(/^Workflows/);
    expect(byId('approval_sla_days').value).toBe('9');
    await click(button(/Discard draft/));
    expect(api.discardDraft).toHaveBeenCalledWith('workflows-draft');
    expect(byId('approval_sla_days').value).toBe('5');
  });
});

describe('publishing', () => {
  it('is refused to whoever drafted it, even holding the role, and says why before pressing', async () => {
    const api = fake([draftRow('workflows', { approval_sla_days: 3 }, EDITOR)], EDITOR);
    await mount(api, EDITOR, BOTH);
    await open(/^Workflows/);
    expect(host.textContent).toContain('Whoever drafted a configuration does not publish it');
    expect((button(/Publish as version 1/) as HTMLButtonElement).disabled).toBe(true);
    expect(api.publish).not.toHaveBeenCalled();
  });

  it('is done by a colleague, and becomes the next version', async () => {
    const api = fake([published('workflows', 1, { approval_sla_days: 5 }), draftRow('workflows', { approval_sla_days: 3 }, EDITOR)], REGISTRAR);
    await mount(api, REGISTRAR, PUBLISH);
    await open(/^Workflows/);
    await click(button(/Publish as version 2/));
    expect(api.publish).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Published.');
    expect(host.textContent).toContain('In force: version 2');
  });

  it('waits for the draft to be saved as it will be reviewed', async () => {
    const api = fake([draftRow('workflows', { approval_sla_days: 3 }, EDITOR)], REGISTRAR);
    await mount(api, REGISTRAR, BOTH);
    await open(/^Workflows/);
    expect(button(/Publish as version 1/)).toBeTruthy();
    // A publisher who also drafts edits it: it is then theirs and unsaved.
    await act(async () => type(byId('approval_sla_days'), '4'));
    expect(host.textContent).toContain('Save the draft first');
    expect((button(/Publish as version 1/) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('history and rollback', () => {
  const rows = [
    published('workflows', 1, { approval_sla_days: 5 }, 'first'),
    published('workflows', 2, { approval_sla_days: 10 }, 'slower'),
  ];

  it('lists versions newest first with what each set', async () => {
    await mount(fake(rows, EDITOR), EDITOR, EDIT);
    await open(/^Workflows/);
    const text = host.textContent ?? '';
    expect(text.indexOf('Version 2')).toBeLessThan(text.indexOf('Version 1'));
    expect(text).toContain('Days an approval may wait: 10');
    expect(text).toContain('slower');
  });

  it('loads an older version into the form, to be drafted and published like any other', async () => {
    const api = fake(rows, EDITOR);
    await mount(api, EDITOR, EDIT);
    await open(/^Workflows/);
    await click(button(/Start from version 1/));
    expect(byId('approval_sla_days').value).toBe('5');
    expect(host.textContent).toContain('a colleague publishes it as the next version');
    await click(button(/Start a draft/));
    expect(api.saveDraft).toHaveBeenCalledWith('vu', 'workflows', { approval_sla_days: 5 }, 'Back to version 1', 1, null);
  });

  it('offers no rollback to a reader', async () => {
    await mount(fake(rows, 'reader'), 'reader', ['config:view']);
    await open(/^Workflows/);
    expect(button(/Start from version/)).toBeUndefined();
  });
});
