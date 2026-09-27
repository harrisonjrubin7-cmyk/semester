// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  on: true,
  account: { id: 'me', email: 'me@example.edu', via: 'email' } as unknown,
  loadCommunities: vi.fn(),
  loadNotices: vi.fn(),
  loadPosts: vi.fn(),
  loadSessions: vi.fn(),
  createPost: vi.fn(),
  reportPost: vi.fn(),
  appeal: vi.fn(),
  blockAuthor: vi.fn(),
  standing: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock('../state/store', () => ({
  useStore: () => ({ account: mock.account, state: { tone: 'plain' }, dispatch: mock.dispatch }),
  useNow: () => new Date('2026-09-27T12:00:00Z'),
}));
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: vi.fn() }));
vi.mock('../lib/media', () => ({ WIDE: '(min-width: 840px)', useMedia: () => false }));
vi.mock('../community/flags', () => ({
  COMMUNITY_FLAGS: {},
  enabled: () => mock.on,
}));
vi.mock('../community/client', () => ({
  loadCommunities: mock.loadCommunities,
  loadNotices: mock.loadNotices,
  loadPosts: mock.loadPosts,
  loadSessions: mock.loadSessions,
  createPost: mock.createPost,
  reportPost: mock.reportPost,
  appeal: mock.appeal,
  blockAuthor: mock.blockAuthor,
  reviewerStanding: mock.standing,
  createStudyGroup: vi.fn(),
  deletePost: vi.fn(),
  editPost: vi.fn(),
  joinCommunity: vi.fn(),
  leaveCommunity: vi.fn(),
  muteAuthor: vi.fn(),
  createSession: vi.fn(),
  joinSession: vi.fn(),
  leaveSession: vi.fn(),
}));

import { Community } from './Community';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

const course = {
  id: 'c1',
  kind: 'course',
  name: 'ECON 1010',
  purpose: 'Problem sets',
  verification: 'faculty_approved',
  integrityPolicy: 'No sharing graded answers.',
  role: 'member',
};

const post = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  communityId: 'c1',
  authorRef: `ref-${id}`,
  authorName: 'Jordan',
  body: `Body ${id}`,
  label: 'student_created',
  status: 'published',
  createdAt: '2026-09-27T10:00:00Z',
  editedAt: null,
  mine: false,
  ...patch,
});

beforeEach(() => {
  vi.clearAllMocks();
  mock.on = true;
  mock.account = { id: 'me', email: 'me@example.edu', via: 'email' };
  mock.loadCommunities.mockResolvedValue([course, { ...course, id: 'c2', name: 'Chess club', kind: 'student_organization', role: null }]);
  mock.loadNotices.mockResolvedValue([]);
  mock.loadPosts.mockResolvedValue({ posts: [post('a'), post('mine', { mine: true, status: 'held' })], muted: [] });
  mock.loadSessions.mockResolvedValue({ sessions: [], venues: [] });
  mock.createPost.mockResolvedValue('new');
  mock.reportPost.mockResolvedValue(undefined);
  mock.appeal.mockResolvedValue(undefined);
  mock.standing.mockResolvedValue('none');
  localStorage.clear();
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
    root.render(<Community />);
  });
}

function click(text: string) {
  const el = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  if (!el) throw new Error(`No button "${text}" in: ${host.textContent}`);
  act(() => el.click());
  return el;
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

function type(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function openCourse() {
  await render();
  click('ECON 1010 · Course');
  await settle();
}

describe('Community', () => {
  it('stays off, and says why, while its flags are off', async () => {
    mock.on = false;
    await render();
    expect(host.textContent).toContain('isn’t switched on');
    expect(mock.loadCommunities).not.toHaveBeenCalled();
  });

  it('needs an account', async () => {
    mock.account = null;
    await render();
    expect(host.textContent).toContain('needs a signed-in account');
  });

  it('lists your communities and others at your school, with no people or counts', async () => {
    await render();
    expect(host.textContent).toContain('ECON 1010 · Course');
    expect(host.textContent).toContain('Chess club');
    expect(host.textContent).toContain('never by who is nearby');
    expect(host.textContent).not.toMatch(/\bmembers?\b.*\d|\d+\s+members?/i);
  });

  it('opens a finite, labelled feed that explains itself', async () => {
    await openCourse();
    expect(host.textContent).toContain('Course policy: No sharing graded answers.');
    expect(host.textContent).toContain('Body a');
    expect(host.textContent).toContain('Student-created');
    expect(host.textContent).toContain('never scrolls forever');
    click('Why am I seeing this?');
    expect(host.querySelector('[aria-label="Why you’re seeing this"]')?.textContent).toContain('You joined ECON 1010.');
  });

  it('shows your own held post apart from the feed, in words', async () => {
    await openCourse();
    const yours = host.querySelector('[aria-label="Your posts"]');
    expect(yours?.textContent).toContain('Body mine');
    expect(yours?.textContent).toContain('Hidden while a reviewer looks at a report');
  });

  it('stops a post with a phone number and offers to remove it', async () => {
    await openCourse();
    const box = host.querySelector('textarea') as HTMLTextAreaElement;
    type(box, 'Call me at 615-555-0142');
    await act(async () => {
      (host.querySelector('form[aria-label="Write a post"]') as HTMLFormElement).requestSubmit();
    });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('phone number');
    expect(mock.createPost).not.toHaveBeenCalled();
    click('Remove it for me');
    expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Call me at [removed]');
  });

  it('posts when the author says the details are theirs', async () => {
    await openCourse();
    type(host.querySelector('textarea') as HTMLTextAreaElement, 'Call me at 615-555-0142');
    await act(async () => {
      (host.querySelector('form[aria-label="Write a post"]') as HTMLFormElement).requestSubmit();
    });
    click('It’s mine — post anyway');
    await settle();
    expect(mock.createPost).toHaveBeenCalledWith('c1', 'Call me at 615-555-0142', true);
  });

  it('posts clean text without a prompt', async () => {
    await openCourse();
    type(host.querySelector('textarea') as HTMLTextAreaElement, 'Anyone doing problem set 3 tonight?');
    await act(async () => {
      (host.querySelector('form[aria-label="Write a post"]') as HTMLFormElement).requestSubmit();
    });
    expect(mock.createPost).toHaveBeenCalledWith('c1', 'Anyone doing problem set 3 tonight?', false);
  });

  it('reports with the emergency notice first', async () => {
    await openCourse();
    click('Report');
    const form = host.querySelector('form[aria-label="Report this post"]') as HTMLFormElement;
    expect(form.textContent).toContain('not monitored as an emergency-response service');
    const radio = form.querySelector('input[value="private_information_or_doxxing"]') as HTMLInputElement;
    act(() => radio.click());
    await act(async () => {
      form.requestSubmit();
    });
    await settle();
    expect(mock.reportPost).toHaveBeenCalledWith('a', 'private_information_or_doxxing', false, '');
    expect(host.textContent).toContain('isn’t told who reported it');
  });

  it('hides a post for this viewer only', async () => {
    await openCourse();
    click('Hide');
    expect(host.textContent).not.toContain('Body a');
    expect(JSON.parse(localStorage.getItem('semester.community-feed.v1') ?? '{}').hiddenItems).toEqual(['a']);
  });

  it('offers newest-first as a pressed toggle', async () => {
    await openCourse();
    const newest = click('Newest first');
    expect(newest.getAttribute('aria-pressed')).toBe('true');
  });

  it('offers the review queue only to a reviewer', async () => {
    await render();
    expect(host.textContent).not.toContain('Open the review queue');
    act(() => root.unmount());
    root = createRoot(host);
    mock.standing.mockResolvedValue('reviewer');
    await render();
    await settle();
    click('Open the review queue');
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'moderation' });
  });

  it('tells an author about a decision and lets them appeal', async () => {
    mock.loadNotices.mockResolvedValue([
      { postId: 'p9', action: 'remove', reasonCode: 'harassment', decidedAt: '2026-09-26T10:00:00Z', appealable: true, appealStatus: 'none' },
    ]);
    await render();
    expect(host.textContent).toContain('a reviewer decided a post of yours should be removed');
    expect(host.textContent).not.toMatch(/P[0-3]|score|karma/);
    click('Appeal this decision');
    await settle();
    expect(mock.appeal).toHaveBeenCalledWith('p9');
  });
});
