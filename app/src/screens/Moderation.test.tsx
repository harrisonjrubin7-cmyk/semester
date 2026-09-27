// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  on: true,
  flags: {} as Record<string, boolean>,
  standing: vi.fn(),
  programs: vi.fn(),
  policies: vi.fn(),
  escalations: vi.fn(),
  request: vi.fn(),
  decideEscalation: vi.fn(),
  safety: vi.fn(),
  canManage: vi.fn(),
  grants: vi.fn(),
  requestId: vi.fn(),
  decideId: vi.fn(),
  reveal: vi.fn(),
  dispatch: vi.fn(),
  queue: vi.fn(),
  decideCase: vi.fn(),
  decideAppeal: vi.fn(),
  lastSweep: vi.fn(),
}));

vi.mock('../state/store', () => ({
  useStore: () => ({ account: { id: 'rev', email: 'rev@semester.example', via: 'email' }, state: { tone: 'plain' }, dispatch: mock.dispatch }),
  useNow: () => new Date('2026-09-27T12:00:00Z'),
}));
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: vi.fn() }));
vi.mock('../community/flags', () => ({
  COMMUNITY_FLAGS: {},
  enabled: (_flags: unknown, key: string) => (key in mock.flags ? mock.flags[key] : mock.on),
}));
vi.mock('../community/client', () => ({
  reviewerStanding: mock.standing,
  loadQueue: mock.queue,
  decideCase: mock.decideCase,
  decideAppeal: mock.decideAppeal,
  lastSweep: mock.lastSweep,
  loadProgramsBySchool: mock.programs,
  loadEscalationPolicies: mock.policies,
  loadEscalations: mock.escalations,
  requestEscalation: mock.request,
  decideEscalation: mock.decideEscalation,
  readAuthorSafety: mock.safety,
  accountHash: async () => 'me-hash',
  canManageAgreements: mock.canManage,
  loadIdentityGrants: mock.grants,
  requestIdentity: mock.requestId,
  decideIdentity: mock.decideId,
  revealIdentity: mock.reveal,
}));

import { Moderation } from './Moderation';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

const kase = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  postId: `post-${id}`,
  tenantId: 'vu',
  category: 'private_information_or_doxxing',
  severity: 'P0',
  protection: 'temporary_hold',
  route: 'professional_urgent',
  status: 'open',
  createdAt: '2026-09-27T10:00:00Z',
  post: { body: `Body ${id}`, authorName: 'Jordan', status: 'held', communityName: 'ECON 1010', asAlias: false },
  reports: [{ category: 'private_information_or_doxxing', imminent: true, details: 'posted her room', createdAt: '2026-09-27T10:00:00Z' }],
  signals: [{ detector: 'pii_doxxing', ruleId: 'pii.third-party-contact', confidence: 0.95, version: 'community-detectors-2026.09.1', createdAt: '2026-09-27T10:00:00Z' }],
  ...patch,
});

const POLICY = {
  tenantId: 'vu',
  enabled: true,
  agreementRef: 'VU-DSA-2026-01',
  categories: ['private_information_or_doxxing', 'threat_or_safety_concern'],
  identityRequired: false,
  hasChannel: true,
};

const pending = (patch: Record<string, unknown> = {}) => ({
  id: 'e1',
  caseId: 'k9',
  tenantId: 'vu',
  category: 'threat_or_safety_concern',
  severity: 'P1',
  status: 'requested',
  requestedReason: 'names a person and a place',
  requestedAt: '2026-09-27T11:00:00Z',
  requestedBy: 'someone-else',
  decidedReason: null,
  decidedAt: null,
  delivery: null,
  ...patch,
});

function type(el: Element, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const button = (scope: Element, text: string) =>
  [...scope.querySelectorAll('button')].find((b) => b.textContent === text) as HTMLButtonElement | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  mock.on = true;
  mock.flags = { institutionEscalation: false, accountSafetyState: false, scopedPseudonymity: false, volunteerModeration: false };
  mock.grants.mockResolvedValue([]);
  mock.requestId.mockResolvedValue(undefined);
  mock.decideId.mockResolvedValue(undefined);
  mock.reveal.mockResolvedValue({
    handle: 'quietana',
    vaultRef: 'ab'.repeat(32),
    otherCases: [{ caseId: 'k7', category: 'harassment_or_bullying', severity: 'P2', status: 'decided', asAlias: false }],
    expiresAt: '2099-01-01T00:00:00Z',
  });
  mock.programs.mockResolvedValue(new Map([['vu', { institutionEscalation: true, accountSafetyState: true }]]));
  mock.policies.mockResolvedValue(new Map([['vu', POLICY]]));
  mock.escalations.mockResolvedValue([]);
  mock.request.mockResolvedValue(undefined);
  mock.decideEscalation.mockResolvedValue(undefined);
  mock.safety.mockResolvedValue(60);
  mock.canManage.mockResolvedValue(false);
  mock.standing.mockResolvedValue('reviewer');
  mock.queue.mockResolvedValue([kase('k0'), kase('k1', { status: 'appealed', severity: 'P2', category: 'spam_scam_or_phishing' })]);
  mock.decideCase.mockResolvedValue(undefined);
  mock.decideAppeal.mockResolvedValue(undefined);
  mock.lastSweep.mockResolvedValue({ ranAt: '2026-09-27T09:29:00Z', removed: 4 });
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
    root.render(<Moderation />);
  });
}

function reason(el: Element, value: string) {
  const input = el.querySelector('input') as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Moderation', () => {
  it('is off while its flag is off', async () => {
    mock.on = false;
    await render();
    expect(host.textContent).toContain('isn’t switched on');
    expect(mock.standing).not.toHaveBeenCalled();
  });

  it('shows no queue to an account without a reviewer role', async () => {
    mock.standing.mockResolvedValue('none');
    await render();
    expect(host.textContent).toContain('doesn’t hold a Trust & Safety reviewer role');
    expect(mock.queue).not.toHaveBeenCalled();
  });

  it('shows the post, the reports and what triage did — never who reported', async () => {
    await render();
    const card = host.querySelector('article') as HTMLElement;
    expect(card.textContent).toContain('P0 · urgent');
    expect(card.textContent).toContain('Hidden pending review');
    expect(card.textContent).toContain('Body k0');
    expect(card.textContent).toContain('posted her room');
    expect(card.textContent).not.toMatch(/reported by|reporter:/i);
    expect(host.textContent).toContain('not monitored as an emergency-response service');
  });

  it('shows what the detectors recorded, labelled as triage', async () => {
    await render();
    const card = host.querySelector('article') as HTMLElement;
    expect(card.textContent).toContain('Automated signals — triage only, never a decision');
    expect(card.textContent).toContain('pii.third-party-contact · confidence 95%');
    expect(card.textContent).toContain('urgent professional review');
  });

  it('says when the retention sweep last ran, and when it never has', async () => {
    await render();
    expect(host.textContent).toContain('removed 4 records');
    act(() => root.unmount());
    root = createRoot(host);
    mock.lastSweep.mockResolvedValue(null);
    await render();
    expect(host.textContent).toContain('has not run yet');
  });

  it('does not offer a P0 account-wide pause to a non-senior reviewer', async () => {
    await render();
    const options = [...(host.querySelector('article select') as HTMLSelectElement).options].map((o) => o.value);
    expect(options).not.toContain('account_restriction');
    expect(options).toContain('remove');
  });

  it('offers it to a senior reviewer', async () => {
    mock.standing.mockResolvedValue('senior');
    await render();
    const options = [...(host.querySelector('article select') as HTMLSelectElement).options].map((o) => o.value);
    expect(options).toContain('account_restriction');
  });

  it('needs a reason code before a decision can be recorded', async () => {
    await render();
    const card = host.querySelector('article') as HTMLElement;
    const record = [...card.querySelectorAll('button')].find((b) => b.textContent === 'Record decision') as HTMLButtonElement;
    expect(record.disabled).toBe(true);
    reason(card, 'privacy.dox');
    const select = card.querySelector('select') as HTMLSelectElement;
    act(() => {
      select.value = 'remove';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => record.click());
    expect(mock.decideCase).toHaveBeenCalledWith('k0', 'remove', 'privacy.dox');
  });

  it('decides appeals separately, and says the deciding reviewer is refused', async () => {
    await render();
    const appealCard = [...host.querySelectorAll('article')][1] as HTMLElement;
    expect(appealCard.textContent).toContain('an appeal goes to somebody else');
    reason(appealCard, 'context');
    const grant = [...appealCard.querySelectorAll('button')].find((b) => b.textContent === 'Grant appeal and restore') as HTMLButtonElement;
    await act(async () => grant.click());
    expect(mock.decideAppeal).toHaveBeenCalledWith('k1', false, 'context');
  });

  describe('escalation', () => {
    it('is absent while its build flag is off, whatever the school has switched on', async () => {
      await render();
      expect(host.textContent).not.toContain('Escalate to the university');
      expect(mock.policies).not.toHaveBeenCalled();
    });

    it('is absent where the school has not switched it on', async () => {
      mock.flags.institutionEscalation = true;
      mock.programs.mockResolvedValue(new Map([['vu', { institutionEscalation: false }]]));
      await render();
      expect(host.textContent).not.toContain('Escalate to the university');
    });

    it('stays off with only the safety-state flag built, though the school has both on', async () => {
      mock.flags.accountSafetyState = true;
      await render();
      expect(host.textContent).toContain('Author’s safety state');
      expect(host.textContent).not.toContain('Escalate to the university');
    });

    it('is offered only on P0 and P1 cases', async () => {
      mock.flags.institutionEscalation = true;
      await render();
      const [p0, p2] = [...host.querySelectorAll('article')];
      expect(p0.textContent).toContain('Escalate to the university');
      expect(p2.textContent).not.toContain('Escalate to the university');
    });

    it('shows exactly what would be sent, and needs a written reason', async () => {
      mock.flags.institutionEscalation = true;
      await render();
      const card = host.querySelector('article') as HTMLElement;
      expect(card.textContent).toContain('the agreement VU-DSA-2026-01');
      expect(card.textContent).toContain('Nothing that identifies the author');
      const ask = button(card, 'Ask a second reviewer to approve') as HTMLButtonElement;
      type(card.querySelector('textarea') as HTMLTextAreaElement, 'too short');
      expect(ask.disabled).toBe(true);
      type(card.querySelector('textarea') as HTMLTextAreaElement, 'room number and a threat');
      await act(async () => ask.click());
      expect(mock.request).toHaveBeenCalledWith('k0', 'room number and a threat');
    });

    it('says when the agreement requires an identity reference, and that it is never a name', async () => {
      mock.flags.institutionEscalation = true;
      mock.policies.mockResolvedValue(new Map([['vu', { ...POLICY, identityRequired: true }]]));
      await render();
      expect(host.querySelector('article')?.textContent).toContain('never a name, an email or an account id');
    });

    it('says why, instead of a button, when the agreement does not cover the case', async () => {
      mock.flags.institutionEscalation = true;
      mock.policies.mockResolvedValue(new Map([['vu', { ...POLICY, categories: ['threat_or_safety_concern'] }]]));
      await render();
      const card = host.querySelector('article') as HTMLElement;
      expect(card.textContent).toContain('doesn’t cover this category');
      expect(button(card, 'Ask a second reviewer to approve')).toBeUndefined();
    });

    it('lets a different reviewer approve with their own reason', async () => {
      mock.flags.institutionEscalation = true;
      mock.escalations.mockResolvedValue([pending()]);
      await render();
      const item = host.querySelector('[aria-label="Escalation, waiting for a second reviewer"]') as HTMLElement;
      expect(item.textContent).toContain('P1 · serious');
      const approve = button(item, 'Approve and send') as HTMLButtonElement;
      expect(approve.disabled).toBe(true);
      expect(item.textContent).toContain('Write at least 10 characters — 10 to go.');
      type(item.querySelector('textarea') as HTMLTextAreaElement, 'credible and specific');
      await act(async () => approve.click());
      expect(mock.decideEscalation).toHaveBeenCalledWith('e1', true, 'credible and specific');
    });

    it('does not offer the requester their own approval', async () => {
      mock.flags.institutionEscalation = true;
      mock.escalations.mockResolvedValue([pending({ requestedBy: 'me-hash' })]);
      await render();
      const item = host.querySelector('[aria-label="Escalation, waiting for a second reviewer"]') as HTMLElement;
      expect(item.textContent).toContain('You asked for this one');
      expect(button(item, 'Approve and send')).toBeUndefined();
    });

    it('shows whether an approved escalation has been delivered', async () => {
      mock.flags.institutionEscalation = true;
      mock.escalations.mockResolvedValue([
        pending({ status: 'approved', decidedAt: '2026-09-27T11:30:00Z', decidedReason: 'agreed', delivery: { queuedAt: '2026-09-27T11:30:00Z', attempts: 1, deliveredAt: null } }),
      ]);
      await render();
      expect(host.textContent).toContain('Queued for delivery; not sent yet.');
    });

    it('says why a delivery failed, in words, and when it will try again', async () => {
      mock.flags.institutionEscalation = true;
      mock.escalations.mockResolvedValue([
        pending({ status: 'approved', decidedAt: '2026-09-27T11:30:00Z', decidedReason: 'agreed',
          delivery: { queuedAt: '2026-09-27T11:30:00Z', attempts: 2, deliveredAt: null, lastError: 'http_502', nextAttemptAt: '2026-09-27T11:50:00Z' } }),
        pending({ id: 'e3', caseId: 'k8', status: 'approved', decidedAt: '2026-09-27T11:30:00Z', decidedReason: 'agreed',
          delivery: { queuedAt: '2026-09-27T11:30:00Z', attempts: 5, deliveredAt: null, lastError: 'payload_rejected', nextAttemptAt: null } }),
      ]);
      await render();
      expect(host.textContent).toContain('Not delivered yet — the university’s system answered 502. Next attempt');
      expect(host.textContent).toContain('No more attempts will be made');
      expect(host.textContent).toContain('held a field the agreement does not allow');
    });
  });

  describe('the way to the volunteer programme', () => {
    it('is only for a senior reviewer, with volunteer moderation built', async () => {
      mock.flags.volunteerModeration = true;
      await render();
      expect(host.textContent).not.toContain('Volunteer programme');
      act(() => root.unmount());
      root = createRoot(host);
      mock.standing.mockResolvedValue('senior');
      await render();
      const open = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Volunteer programme') as HTMLButtonElement;
      await act(async () => open.click());
      expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'volunteers' });
    });

    it('is not shown to a senior while volunteer moderation is not built', async () => {
      mock.standing.mockResolvedValue('senior');
      await render();
      expect(host.textContent).not.toContain('Volunteer programme');
    });
  });

  describe('the way to escalation agreements', () => {
    it('appears only for an account the server says may manage them', async () => {
      mock.flags.institutionEscalation = true;
      await render();
      expect(host.textContent).not.toContain('Escalation agreements');
      act(() => root.unmount());
      root = createRoot(host);
      mock.canManage.mockResolvedValue(true);
      await render();
      const open = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Escalation agreements') as HTMLButtonElement;
      await act(async () => open.click());
      expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'agreements' });
    });

    it('is not asked about while escalation is not built', async () => {
      mock.canManage.mockResolvedValue(true);
      await render();
      expect(mock.canManage).not.toHaveBeenCalled();
      expect(host.textContent).not.toContain('Escalation agreements');
    });
  });

  describe('images on a case', () => {
    const media = (patch: Record<string, unknown>) => ({
      id: 'm', status: 'held', reasonCode: 'matches_removed_image', width: 800, height: 600, url: 'https://x/held',
      knownAbuseMatch: false, altText: 'A photo', ...patch,
    });

    it('shows a held image to the reviewer, with why it was held', async () => {
      mock.queue.mockResolvedValue([kase('k0', { media: media({}) })]);
      await render();
      const card = host.querySelector('article') as HTMLElement;
      expect(card.querySelector('img')?.getAttribute('src')).toBe('https://x/held');
      expect(card.textContent).toContain('Image held — matches removed image.');
    });

    it('never shows a known-abuse match, and says what to do instead', async () => {
      mock.queue.mockResolvedValue([kase('k0', { media: media({ knownAbuseMatch: true, url: 'https://x/should-never-render' }) })]);
      await render();
      const card = host.querySelector('article') as HTMLElement;
      expect(card.querySelector('img')).toBeNull();
      expect(card.innerHTML).not.toContain('should-never-render');
      expect(card.querySelector('[role="alert"]')?.textContent).toContain('Do not try to view it.');
    });

    it('offers a known-abuse match only removal or a restriction, and starts on removal', async () => {
      mock.queue.mockResolvedValue([
        kase('k0', { media: media({ knownAbuseMatch: true, url: null }) }),
        kase('k1', { media: media({}) }),
      ]);
      await render();
      const [matched, held] = [...host.querySelectorAll('article')].map((a) => a.querySelector('select') as HTMLSelectElement);
      const offered = [...matched.options].map((o) => o.value);
      expect(offered).toContain('remove');
      expect(offered.filter((v) => !['remove', 'rate_limit', 'community_restriction', 'account_restriction'].includes(v))).toEqual([]);
      expect(matched.value).toBe('remove');
      // What is sent, not only what is drawn: a select shows its first option whatever the state holds.
      const card = host.querySelector('article') as HTMLElement;
      reason(card, 'abuse.known_hash');
      const record = [...card.querySelectorAll('button')].find((b) => b.textContent === 'Record decision') as HTMLButtonElement;
      await act(async () => record.click());
      expect(mock.decideCase).toHaveBeenCalledWith('k0', 'remove', 'abuse.known_hash');
      // The control: an ordinary held image keeps every choice.
      expect([...held.options].map((o) => o.value)).toContain('allow');
      expect(held.value).toBe('allow');
    });
  });

  describe('who is behind an alias', () => {
    const aliasCase = () => kase('k0', { post: { body: 'Body k0', authorName: 'Wanderer5', status: 'held', communityName: 'Support', asAlias: true } });
    const grant = (patch: Record<string, unknown> = {}) => ({
      id: 'g1', caseId: 'k0', status: 'requested', grantee: 'me-hash', requestedReason: 'pattern of harassment',
      requestedAt: '2026-09-27T10:00:00Z', decidedReason: null, expiresAt: null, ...patch,
    });
    const card = () => host.querySelector('article') as HTMLElement;

    it('is absent while aliases are not built', async () => {
      mock.queue.mockResolvedValue([aliasCase()]);
      await render();
      expect(host.textContent).not.toContain('Who posted this');
      expect(mock.grants).not.toHaveBeenCalled();
    });

    it('stays absent with only escalation built, though everything it needs is loaded', async () => {
      mock.flags.institutionEscalation = true;
      mock.queue.mockResolvedValue([aliasCase()]);
      await render();
      expect(host.textContent).toContain('Escalate to the university');
      expect(host.textContent).not.toContain('Who posted this');
    });

    it('is absent on a post made under a real name', async () => {
      mock.flags.scopedPseudonymity = true;
      await render();
      expect(host.textContent).not.toContain('Who posted this');
    });

    it('asks with a reason', async () => {
      mock.flags.scopedPseudonymity = true;
      mock.queue.mockResolvedValue([aliasCase()]);
      await render();
      expect(mock.grants).toHaveBeenCalledWith(['k0']);
      const ask = button(card(), 'Ask to see who posted this') as HTMLButtonElement;
      expect(ask.disabled).toBe(true);
      type(card().querySelector('details textarea') as HTMLTextAreaElement, 'pattern of harassment across posts');
      await act(async () => ask.click());
      expect(mock.requestId).toHaveBeenCalledWith('k0', 'pattern of harassment across posts');
    });

    it('tells the asker to wait, and offers them nothing to approve', async () => {
      mock.flags.scopedPseudonymity = true;
      mock.queue.mockResolvedValue([aliasCase()]);
      mock.grants.mockResolvedValue([grant()]);
      await render();
      expect(card().textContent).toContain('A different reviewer has to approve it.');
      expect(button(card(), 'Approve')).toBeUndefined();
      expect(button(card(), 'Show who posted this')).toBeUndefined();
    });

    it('lets another reviewer decide, and says approving shows them nothing', async () => {
      mock.flags.scopedPseudonymity = true;
      mock.queue.mockResolvedValue([aliasCase()]);
      mock.grants.mockResolvedValue([grant({ grantee: 'someone-else' })]);
      await render();
      const req = card().querySelector('[aria-label="A request to see who posted this"]') as HTMLElement;
      expect(req.textContent).toContain('it does not show you anything');
      const approve = button(req, 'Approve') as HTMLButtonElement;
      expect(approve.disabled).toBe(true);
      type(req.querySelector('textarea') as HTMLTextAreaElement, 'repeat reports from three members');
      await act(async () => approve.click());
      expect(mock.decideId).toHaveBeenCalledWith('g1', true, 'repeat reports from three members');
      expect(button(card(), 'Show who posted this')).toBeUndefined();
    });

    it('shows the handle and other cases to the grantee, and says the look is recorded', async () => {
      mock.flags.scopedPseudonymity = true;
      mock.queue.mockResolvedValue([aliasCase()]);
      mock.grants.mockResolvedValue([grant({ status: 'approved', expiresAt: '2099-01-01T00:00:00Z' })]);
      await render();
      await act(async () => button(card(), 'Show who posted this')!.click());
      expect(mock.reveal).toHaveBeenCalledWith('g1');
      expect(card().textContent).toContain('Posted by quietana.');
      expect(card().textContent).toContain('under their own name');
      expect(card().textContent).toContain('This look is recorded in the case history.');
      const revealed = card().querySelector('details [role="status"]') as HTMLElement;
      expect(revealed.textContent).toContain('quietana');
      expect(revealed.textContent).not.toMatch(/@|\.edu|\.example/);
    });

    it('does not let a reviewer use somebody else\'s grant', async () => {
      mock.flags.scopedPseudonymity = true;
      mock.queue.mockResolvedValue([aliasCase()]);
      mock.grants.mockResolvedValue([grant({ grantee: 'someone-else', status: 'approved', expiresAt: '2099-01-01T00:00:00Z' })]);
      await render();
      expect(button(card(), 'Show who posted this')).toBeUndefined();
    });

    it('treats an expired grant as gone', async () => {
      mock.flags.scopedPseudonymity = true;
      mock.queue.mockResolvedValue([aliasCase()]);
      mock.grants.mockResolvedValue([grant({ status: 'approved', expiresAt: '2020-01-01T00:00:00Z' })]);
      await render();
      expect(button(card(), 'Show who posted this')).toBeUndefined();
      expect(card().textContent).toContain('Your last grant has run out.');
    });
  });

  describe('safety state', () => {
    it('is absent while its build flag is off', async () => {
      await render();
      expect(host.textContent).not.toContain('Author’s safety state');
    });

    it('is absent where the school has not switched it on', async () => {
      mock.flags.accountSafetyState = true;
      mock.programs.mockResolvedValue(new Map([['vu', { accountSafetyState: false }]]));
      await render();
      expect(host.textContent).not.toContain('Author’s safety state');
    });

    it('stays off with only the escalation flag built, though the school has both on', async () => {
      mock.flags.institutionEscalation = true;
      await render();
      expect(host.textContent).toContain('Escalate to the university');
      expect(host.textContent).not.toContain('Author’s safety state');
    });

    it('is read only with a written reason, and says the read is recorded', async () => {
      mock.flags.accountSafetyState = true;
      await render();
      const card = host.querySelector('article') as HTMLElement;
      expect(card.textContent).toContain('P0 by 40, P1 by 20, P2 by 8');
      const read = button(card, 'Read it') as HTMLButtonElement;
      const input = [...card.querySelectorAll('details input')][0] as HTMLInputElement;
      type(input, 'why');
      expect(read.disabled).toBe(true);
      type(input, 'second report on this author');
      await act(async () => read.click());
      expect(mock.safety).toHaveBeenCalledWith('k0', 'second report on this author');
      expect(card.textContent).toContain('60 out of 100.');
      expect(card.textContent).toContain('recorded in the case history');
    });
  });
});
