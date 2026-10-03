// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { meetingKey } from '../lib/advisor-meeting';
import type { SharePayload } from '../lib/advisor-meeting';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';

const sent: { email: string; title: string; payload: SharePayload; days: number }[] = [];
const revoked: string[] = [];
let listed: { shares: unknown[]; events: unknown[] } = { shares: [], events: [] };
vi.mock('../lib/advisor-shares', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/advisor-shares')>();
  return {
    ...real,
    shareWithAdvisor: vi.fn(async (email: string, title: string, payload: SharePayload, days: number) => {
      sent.push({ email, title, payload, days });
      return 'share-1';
    }),
    myShares: vi.fn(async () => listed),
    revokeShare: vi.fn(async (id: string) => {
      revoked.push(id);
    }),
    deleteShare: vi.fn(async () => {}),
    sharedWithMe: vi.fn(async () => [
      { id: 'in-1', title: 'Spring planning', shared_as: 'Riley', created_at: '2026-09-20T00:00:00Z', expires_at: '2026-10-20T00:00:00Z' },
    ]),
    openShare: vi.fn(async () => ({
      title: 'Spring planning',
      expires_at: '2026-10-20T00:00:00Z',
      payload: { version: 1, sharedAs: 'Riley', title: 'Spring planning', date: null, agenda: ['Minor options'], questions: ['Is PSCI 1100 required?'], scenario: null, courses: [], followUps: [] },
    })),
  };
});

const { AdvisorMeeting } = await import('./AdvisorMeeting');
const { Degree } = await import('../screens/Degree');

/**
 * Phase G on screen. The student's preparation, and the two roads off the
 * device — export/print and a share — each only after showing exactly what
 * leaves; the sharing panel's states and revocation; the advisor's view; and
 * the Degree tab with the flag off, as the control.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  window.location.hash = '';
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, courses: [] }));
  localStorage.setItem(
    'semester.registration.v1',
    JSON.stringify({
      catalog: {
        institution: 'Example University',
        importedAt: '2026-09-01T00:00:00Z',
        courses: [
          { id: 'e3', code: 'ECON 3010', section: '01', title: 'Game Theory', term: 'Spring 2027', credits: 3, meetings: [{ days: [2], start: '13:00', end: '14:15' }] },
          { id: 'p1', code: 'PSCI 1100', section: '01', title: 'Politics', term: 'Spring 2027', credits: 3, meetings: [] },
        ],
      },
      cart: [],
      plans: [],
    }),
  );
  localStorage.setItem('semester.course-shortlist.v1', JSON.stringify({ saved: ['e3', 'p1'], compare: [] }));
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
  sent.length = 0;
  revoked.length = 0;
  listed = { shares: [], events: [] };
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

const mount = async (accountId: string | null) => {
  await act(async () => {
    root.render(
      <StoreProvider>
        <AdvisorMeeting accountId={accountId} />
      </StoreProvider>,
    );
  });
};
const text = (el: ParentNode = host) => (el.textContent ?? '').replace(/\s+/g, ' ');
const button = (name: RegExp, within: ParentNode = host) => {
  const found = [...within.querySelectorAll('button')].find((b) => name.test((b.textContent ?? '').trim()));
  if (!found) throw new Error(`No button ${name}: ${[...within.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`);
  return found;
};
const field = (label: RegExp) =>
  [...host.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')].find((i) => label.test(i.closest('label')?.textContent ?? ''))!;
const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  await act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const dialog = () => [...host.querySelectorAll('[role="dialog"]')].find((d) => d.classList.contains('dialog'))!;

const prepare = async () => {
  await act(async () => button(/^Prepare a meeting$/).click());
  await act(async () => button(/^Add an agenda item$/).click());
  await type(field(/^Agenda item 1/), 'Spring courses');
  await act(async () => button(/^Add a question$/).click());
  await type(field(/^Question 1/), 'Can I take ECON 3010 early?');
  await act(async () => button(/^Add a follow-up$/).click());
  await type(field(/^Follow-up 1/), 'Email the department');
  await type(field(/^Private notes/), 'I am worried about money');
  const econ = [...host.querySelectorAll<HTMLInputElement>('.advisor-attach input')].find((i) => i.closest('label')?.textContent?.includes('ECON 3010'))!;
  await act(async () => econ.click());
};

describe('the Degree tab', () => {
  it('is not there with the flag off, and is with it on', async () => {
    await act(async () => root.render(<StoreProvider><Degree advisorMeeting={false} /></StoreProvider>));
    expect(text()).not.toContain('Advisor meeting');
    await act(async () => root.render(<StoreProvider><Degree advisorMeeting /></StoreProvider>));
    expect([...host.querySelectorAll('button, [role="tab"], [role="radio"]')].some((b) => b.textContent === 'Advisor meeting')).toBe(true);
  }, 15_000);
});

describe('preparing and exporting', () => {
  it('keeps the meeting on the device, and exports only after a preview that leaves out private notes', async () => {
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    await mount(null);
    await prepare();
    const stored = JSON.parse(localStorage.getItem(meetingKey(null))!);
    expect(stored.meetings[0]).toMatchObject({ agenda: [{ text: 'Spring courses' }], notes: 'I am worried about money', attach: { courses: ['e3'] } });

    await act(async () => button(/^Download summary…$/).click());
    const preview = text(dialog());
    expect(preview).toContain('• Spring courses');
    expect(preview).toContain('• Email the department');
    expect(preview).not.toContain('worried');
    expect(preview).toContain('Private notes are not included.');
    expect(document.activeElement?.textContent).toBe('Cancel');
    expect(created).not.toHaveBeenCalled();
    await act(async () => button(/^Download$/).click());
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('keeps each account’s preparation to that account on a shared device', async () => {
    await mount('student-a');
    await prepare();
    expect(JSON.parse(localStorage.getItem(meetingKey('student-a'))!).meetings[0].notes).toBe('I am worried about money');
    await act(async () => root.unmount());
    root = createRoot(host);
    await mount('student-b');
    expect(text()).not.toContain('Spring courses');
    expect(localStorage.getItem(meetingKey('student-b'))).toBeNull();
    await act(async () => root.unmount());
    root = createRoot(host);
    await mount('student-a');
    expect(text()).toContain('Advisor meeting');
    expect([...host.querySelectorAll('textarea')].some((t) => (t as HTMLTextAreaElement).value === 'I am worried about money')).toBe(true);
  });

  it('offers no sharing when signed out, and says why', async () => {
    await mount(null);
    await prepare();
    expect(() => button(/^Preview and share…$/)).toThrow();
    expect(text()).toContain('Sign in to share with an advisor.');
  });
});

describe('sharing with an advisor', () => {
  it('shows exactly what the advisor will see, and sends only after confirming', async () => {
    await mount('u1');
    await prepare();
    await type(field(/^Your name/), 'Sam');
    await type(field(/^Advisor’s school email/), 'advisor@school.edu');
    await act(async () => button(/^Preview and share…$/).click());
    const preview = text(dialog());
    expect(preview).toContain('advisor@school.edu will see exactly this, as “Sam”');
    expect(preview).toContain('Spring courses');
    expect(preview).toContain('ECON 3010 · 01 — Game Theory');
    expect(preview).not.toContain('PSCI 1100');
    expect(preview).not.toContain('Email the department');
    expect(preview).not.toContain('worried');
    expect(document.activeElement?.textContent).toBe('Cancel');
    expect(sent).toEqual([]);
    await act(async () => button(/^Share$/).click());
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ email: 'advisor@school.edu', days: 30 });
    expect(sent[0].payload.followUps).toEqual([]);
    expect(JSON.stringify(sent[0].payload)).not.toContain('worried');
    expect(text()).toContain('You can revoke it below at any time.');
  });

  it('includes follow-ups only when ticked', async () => {
    await mount('u1');
    await prepare();
    const tick = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((i) => i.closest('label')?.textContent?.includes('Include my follow-up actions'))!;
    await act(async () => tick.click());
    await type(field(/^Your name/), 'Sam');
    await type(field(/^Advisor’s school email/), 'advisor@school.edu');
    await act(async () => button(/^Preview and share…$/).click());
    await act(async () => button(/^Share$/).click());
    expect(sent[0].payload.followUps).toEqual(['Email the department']);
  });

  it('lists shares by state and reads, and revokes only after confirming', async () => {
    listed = {
      shares: [
      // 07:00 UTC is the same calendar day from UTC-5 to UTC+14, the range
      // `npm run test:zones` runs in; noon UTC is tomorrow in Kiritimati.
        { id: 's-live', title: 'Spring planning', created_at: '2026-09-20T07:00:00Z', expires_at: '2099-01-01T07:00:00Z', revoked_at: null },
        { id: 's-old', title: 'Fall check-in', created_at: '2026-08-01T07:00:00Z', expires_at: '2026-08-08T07:00:00Z', revoked_at: null },
        { id: 's-off', title: 'Minor question', created_at: '2026-09-01T07:00:00Z', expires_at: '2099-01-01T07:00:00Z', revoked_at: '2026-09-02T07:00:00Z' },
      ],
      events: [{ share_id: 's-live', read_at: '2026-09-22T07:00:00Z' }],
    };
    await mount('u1');
    await act(async () => button(/^Prepare a meeting$/).click());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const rows = [...host.querySelectorAll('.advisor-shares li')];
    expect(rows.map((r) => r.getAttribute('data-state'))).toEqual(['active', 'expired', 'revoked']);
    expect(text(rows[0])).toContain('Opened 1 time, last on Sep 22, 2026.');
    expect(text(rows[1])).toContain('Expired Aug 8, 2026.');
    expect(rows[1].textContent).not.toContain('Revoke');
    await act(async () => button(/^Revoke…$/, rows[0]).click());
    expect(text(dialog())).toContain('stops opening for your advisor now');
    expect(revoked).toEqual([]);
    await act(async () => button(/^Revoke$/).click());
    expect(revoked).toEqual(['s-live']);
  });
});

describe('the advisor’s view', () => {
  it('asks nothing until opened, then shows only what was shared, and says the student sees it', async () => {
    const shares = await import('../lib/advisor-shares');
    await mount('u1');
    expect(shares.sharedWithMe).not.toHaveBeenCalled();
    const details = host.querySelector<HTMLDetailsElement>('.advisor-view')!;
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    });
    expect(shares.sharedWithMe).toHaveBeenCalledTimes(1);
    await act(async () => button(/^Spring planning$/, details).click());
    const view = host.querySelector('.advisor-view-share')!;
    expect(text(view)).toContain('Shared by Riley');
    expect(text(view)).toContain('The student can see that you opened it');
    expect(text(view)).toContain('Is PSCI 1100 required?');
  });

  it('forgets what one advisor opened when another signs in on the same screen', async () => {
    await mount('advisor-a');
    const details = host.querySelector<HTMLDetailsElement>('.advisor-view')!;
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    });
    await act(async () => button(/^Spring planning$/, details).click());
    expect(text()).toContain('Is PSCI 1100 required?');
    await mount('advisor-b');
    expect(text()).not.toContain('Is PSCI 1100 required?');
    expect(text()).not.toContain('Shared by Riley');
    await mount('advisor-b');
    expect(text()).not.toContain('Shared by Riley');
  });
});
