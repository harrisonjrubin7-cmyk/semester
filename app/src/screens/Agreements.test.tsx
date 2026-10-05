// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  on: true,
  canManage: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  activate: vi.fn(),
  retire: vi.fn(),
}));

vi.mock('../state/store', () => ({
  useStore: () => ({ account: { id: 'me', email: 'me@semester.example', via: 'email' }, state: { tone: 'plain' }, dispatch: vi.fn() }),
  useNow: () => new Date(),
}));
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: vi.fn() }));
vi.mock('../community/flags', () => ({ COMMUNITY_FLAGS: {}, enabled: () => mock.on }));
vi.mock('../community/client', () => ({
  canManageAgreements: mock.canManage,
  loadAgreements: mock.load,
  saveAgreement: mock.save,
  activateAgreement: mock.activate,
  retireAgreement: mock.retire,
  accountHash: async () => 'me-hash',
}));

import { Agreements, agreementState } from './Agreements';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const agreement = (patch: Record<string, unknown> = {}) => ({
  tenantId: 'vu',
  enabled: false,
  agreementRef: 'VU-DSA-2026-01',
  categories: ['threat_or_safety_concern'],
  identityRequired: false,
  channel: 'webhook:vu_dos',
  contact: 'Dean of Students office',
  expiresOn: inDays(300),
  draftedBy: 'someone-else',
  draftedAt: '2026-09-27T10:00:00Z',
  activatedAt: null,
  ...patch,
});

const SCHOOLS = [
  { id: 'vu', name: 'Vanderbilt University' },
  { id: 'bu', name: 'Belmont University' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mock.on = true;
  mock.canManage.mockResolvedValue(true);
  mock.load.mockResolvedValue({ schools: SCHOOLS, agreements: [agreement()], events: [] });
  mock.save.mockResolvedValue(undefined);
  mock.activate.mockResolvedValue(undefined);
  mock.retire.mockResolvedValue(undefined);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function render() {
  await act(async () => {
    root.render(<Agreements />);
  });
}

const button = (scope: Element, text: string) =>
  [...scope.querySelectorAll('button')].find((b) => b.textContent === text) as HTMLButtonElement | undefined;

function type(el: Element, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

const card = () => host.querySelector('[aria-label="Agreement with Vanderbilt University"]') as HTMLElement;

describe('Agreements', () => {
  it('is off while escalation is not built', async () => {
    mock.on = false;
    await render();
    expect(host.textContent).toContain('isn’t switched on in this build');
    expect(mock.canManage).not.toHaveBeenCalled();
  });

  it('shows nothing to an account without the role', async () => {
    mock.canManage.mockResolvedValue(false);
    await render();
    expect(host.textContent).toContain('doesn’t hold the escalation-agreement role');
    expect(mock.load).not.toHaveBeenCalled();
  });

  it('says it never switches a school on', async () => {
    await render();
    expect(host.textContent).toContain('Activating an agreement doesn’t switch escalation on at a school');
  });

  it('lets a second person activate a draft, with what they checked', async () => {
    await render();
    expect(card().textContent).toContain('Draft — waiting for a second person');
    const activate = button(card(), 'Activate') as HTMLButtonElement;
    expect(activate.disabled).toBe(true);
    type(card().querySelector('textarea') as HTMLTextAreaElement, 'read against the signed copy');
    await act(async () => activate.click());
    expect(mock.activate).toHaveBeenCalledWith('vu', 'read against the signed copy');
  });

  it('tells whoever drafted it that somebody else must activate it', async () => {
    mock.load.mockResolvedValue({ schools: SCHOOLS, agreements: [agreement({ draftedBy: 'me-hash' })], events: [] });
    await render();
    expect(card().textContent).toContain('You recorded this version. A different person has to activate it.');
    expect(button(card(), 'Activate')).toBeUndefined();
  });

  it('retires an active agreement with a reason, and warns that editing stops escalations', async () => {
    mock.load.mockResolvedValue({
      schools: SCHOOLS,
      agreements: [agreement({ enabled: true, activatedAt: '2026-09-27T11:00:00Z' })],
      events: [],
    });
    await render();
    expect(card().textContent).toContain('Active');
    expect(card().textContent).toContain('Editing makes it a draft, which stops escalations');
    const retire = button(card(), 'Retire') as HTMLButtonElement;
    expect(retire.disabled).toBe(true);
    type(card().querySelector('textarea') as HTMLTextAreaElement, 'the school ended the agreement');
    await act(async () => retire.click());
    expect(mock.retire).toHaveBeenCalledWith('vu', 'the school ended the agreement');
  });

  it('shows an agreement past its end as ended, with nothing to activate', async () => {
    mock.load.mockResolvedValue({ schools: SCHOOLS, agreements: [agreement({ enabled: true, expiresOn: inDays(-1) })], events: [] });
    await render();
    expect(card().textContent).toContain('This agreement has ended');
    expect(button(card(), 'Activate')).toBeUndefined();
    expect(button(card(), 'Retire')).toBeUndefined();
  });

  it('records a new agreement only once every field is right, and only for a school without one', async () => {
    await render();
    await act(async () => button(host, 'Record a new agreement')!.click());
    const form = host.querySelector('form[aria-label="Record a new agreement"]') as HTMLFormElement;
    expect([...form.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Belmont University']);
    const save = button(form, 'Save as a draft') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(form.textContent).toContain('Name the signed agreement.');

    const [ref, contact, channel] = [...form.querySelectorAll('input.input')] as HTMLInputElement[];
    type(ref, 'BU-DSA-2026-01');
    type(contact, 'Office of Student Care');
    type(channel, 'https://evil.example');
    act(() => (form.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
    expect(form.textContent).toContain('lowercase letters, digits and underscores');
    expect(save.disabled).toBe(true);
    type(channel, 'bu_care');
    expect(save.disabled).toBe(false);
    await act(async () => save.click());
    expect(mock.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'bu', agreementRef: 'BU-DSA-2026-01', channel: 'webhook:bu_care', identityRequired: false }),
    );
  });

  it('will not save an agreement that covers nothing', async () => {
    await render();
    await act(async () => button(host, 'Record a new agreement')!.click());
    const form = host.querySelector('form') as HTMLFormElement;
    const [ref, contact, channel] = [...form.querySelectorAll('input.input')] as HTMLInputElement[];
    type(ref, 'BU-DSA-2026-01');
    type(contact, 'Office of Student Care');
    type(channel, 'bu_care');
    expect(form.textContent).toContain('Choose at least one kind of case it covers.');
    expect((button(form, 'Save as a draft') as HTMLButtonElement).disabled).toBe(true);
  });

  it('explains what an identity reference is before anybody ticks it', async () => {
    await render();
    await act(async () => button(host, 'Record a new agreement')!.click());
    const form = host.querySelector('form') as HTMLFormElement;
    const identity = [...form.querySelectorAll('label')].find((l) => l.textContent?.includes('requires an identity reference'))!
      .querySelector('input') as HTMLInputElement;
    act(() => identity.click());
    expect(form.textContent).toContain('never a name, an email or an account id');
  });

  it('warns that saving an active agreement makes it a draft again', async () => {
    mock.load.mockResolvedValue({ schools: SCHOOLS, agreements: [agreement({ enabled: true, activatedAt: '2026-09-27T11:00:00Z' })], events: [] });
    await render();
    await act(async () => button(card(), 'Edit')!.click());
    expect(host.textContent).toContain('Saving makes this a draft again');
  });
});

describe('agreementState', () => {
  const today = '2026-09-27';
  it('reads ended before anything else', () => {
    expect(agreementState(agreement({ enabled: true, expiresOn: '2026-09-26' }) as never, today)).toBe('ended');
  });
  it('tells a draft from a retired agreement', () => {
    expect(agreementState(agreement() as never, today)).toBe('draft');
    expect(agreementState(agreement({ activatedAt: '2026-09-20T00:00:00Z' }) as never, today)).toBe('retired');
    expect(agreementState(agreement({ enabled: true, activatedAt: '2026-09-20T00:00:00Z' }) as never, today)).toBe('active');
  });
});
