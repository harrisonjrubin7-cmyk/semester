// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  on: true,
  flags: {} as Record<string, boolean>,
  myStanding: vi.fn(),
  uploadImage: vi.fn(),
  account: { id: 'me', email: 'me@example.edu', via: 'email' } as unknown,
  loadCommunities: vi.fn(),
  loadNotices: vi.fn(),
  loadPosts: vi.fn(),
  loadSessions: vi.fn(),
  createPost: vi.fn(),
  deletePost: vi.fn(),
  reportPost: vi.fn(),
  appeal: vi.fn(),
  blockAuthor: vi.fn(),
  standing: vi.fn(),
  dispatch: vi.fn(),
  programs: vi.fn(),
  loadAlias: vi.fn(),
  claimAlias: vi.fn(),
  dropAlias: vi.fn(),
}));

vi.mock('../state/store', () => ({
  useStore: () => ({ account: mock.account, state: { tone: 'plain' }, dispatch: mock.dispatch }),
  useNow: () => new Date('2026-09-27T12:00:00Z'),
}));
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: vi.fn() }));
vi.mock('../lib/media', () => ({ WIDE: '(min-width: 840px)', useMedia: () => false }));
vi.mock('../community/flags', () => ({
  COMMUNITY_FLAGS: {},
  enabled: (_flags: unknown, key: string) => (key in mock.flags ? mock.flags[key] : mock.on),
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
  loadPrograms: mock.programs,
  myStanding: mock.myStanding,
  uploadImage: mock.uploadImage,
  NO_PROGRAMS: { scopedPseudonymity: false, volunteerModeration: false, institutionEscalation: false, accountSafetyState: false, imagePosts: false },
  loadAlias: mock.loadAlias,
  claimAlias: mock.claimAlias,
  dropAlias: mock.dropAlias,
  createStudyGroup: vi.fn(),
  deletePost: mock.deletePost,
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
  pseudonymityApproved: false,
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
  asAlias: false,
  createdAt: '2026-09-27T10:00:00Z',
  editedAt: null,
  mine: false,
  media: null,
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
  mock.deletePost.mockResolvedValue(undefined);
  mock.reportPost.mockResolvedValue(undefined);
  mock.appeal.mockResolvedValue(undefined);
  mock.standing.mockResolvedValue('none');
  mock.programs.mockResolvedValue({ scopedPseudonymity: false, volunteerModeration: false });
  mock.flags = {};
  mock.myStanding.mockResolvedValue('A past decision still affects your Community account.');
  mock.loadAlias.mockResolvedValue(null);
  mock.claimAlias.mockResolvedValue(undefined);
  mock.dropAlias.mockResolvedValue(undefined);
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

  it('previews the server-owned post deletion before changing Community', async () => {
    await openCourse();
    const yours = host.querySelector('[aria-label="Your posts"]') as HTMLElement;
    const remove = [...yours.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Delete');
    act(() => remove?.click());

    const preview = host.querySelector('.action-preview')?.textContent ?? '';
    expect(preview).toContain('Body mine');
    expect(preview).toContain('withdrawn from Community');
    expect(preview).toContain('review evidence stays available to authorized reviewers');
    expect(preview).toContain('cannot be restored');
    expect(mock.deletePost).not.toHaveBeenCalled();

    click('Cancel');
    expect(mock.deletePost).not.toHaveBeenCalled();

    act(() => remove?.click());
    click('Delete post');
    await settle();
    expect(mock.deletePost).toHaveBeenCalledOnce();
    expect(mock.deletePost).toHaveBeenCalledWith('mine');
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
    expect(mock.createPost).toHaveBeenCalledWith('c1', 'Call me at 615-555-0142', true, false, null);
  });

  it('posts clean text without a prompt', async () => {
    await openCourse();
    type(host.querySelector('textarea') as HTMLTextAreaElement, 'Anyone doing problem set 3 tonight?');
    await act(async () => {
      (host.querySelector('form[aria-label="Write a post"]') as HTMLFormElement).requestSubmit();
    });
    expect(mock.createPost).toHaveBeenCalledWith('c1', 'Anyone doing problem set 3 tonight?', false, false, null);
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

  it('names the course policy before a post that asks for answers', async () => {
    await openCourse();
    type(host.querySelector('textarea') as HTMLTextAreaElement, 'Does anyone have the answer key for the midterm?');
    await act(async () => {
      (host.querySelector('form[aria-label="Write a post"]') as HTMLFormElement).requestSubmit();
    });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('No sharing graded answers.');
    expect(mock.createPost).not.toHaveBeenCalled();
    click('Post anyway');
    await settle();
    expect(mock.createPost).toHaveBeenCalledWith('c1', 'Does anyone have the answer key for the midterm?', false, false, null);
  });

  it('never stops a post with crisis language, and offers support after it', async () => {
    await openCourse();
    type(host.querySelector('textarea') as HTMLTextAreaElement, 'honestly I want to die this week');
    await act(async () => {
      (host.querySelector('form[aria-label="Write a post"]') as HTMLFormElement).requestSubmit();
    });
    await settle();
    expect(mock.createPost).toHaveBeenCalledWith('c1', 'honestly I want to die this week', false, false, null);
    expect(host.textContent).toContain('988');
  });

  it('says nothing on the device about a threat or hate hit', async () => {
    await openCourse();
    type(host.querySelector('textarea') as HTMLTextAreaElement, 'those people are vermin');
    await act(async () => {
      (host.querySelector('form[aria-label="Write a post"]') as HTMLFormElement).requestSubmit();
    });
    await settle();
    expect(mock.createPost).toHaveBeenCalled();
    expect(host.querySelector('form[aria-label="Write a post"] [role="alert"]')).toBeNull();
  });

  describe('aliases', () => {
    const approved = () => {
      mock.loadCommunities.mockResolvedValue([{ ...course, kind: 'support', pseudonymityApproved: true }]);
      mock.programs.mockResolvedValue({ scopedPseudonymity: true, volunteerModeration: false });
    };

    it('offer nothing unless the school switched them on', async () => {
      mock.loadCommunities.mockResolvedValue([{ ...course, kind: 'support', pseudonymityApproved: true }]);
      await render();
      click('ECON 1010 · Support');
      await settle();
      expect(host.querySelector('[aria-label="Your name in this community"]')).toBeNull();
      expect(mock.loadAlias).not.toHaveBeenCalled();
    });

    it('offer nothing in a community that has not approved them', async () => {
      mock.programs.mockResolvedValue({ scopedPseudonymity: true, volunteerModeration: false });
      await openCourse();
      expect(host.querySelector('[aria-label="Your name in this community"]')).toBeNull();
    });

    it('say who can still see through one, before a name is chosen', async () => {
      approved();
      await render();
      click('ECON 1010 · Support');
      await settle();
      const panel = host.querySelector('[aria-label="Your name in this community"]') as HTMLElement;
      expect(panel.textContent).toContain('Semester still knows it is you');
      type(panel.querySelector('input') as HTMLInputElement, 'Navigator1');
      await act(async () => {
        (panel.querySelector('form') as HTMLFormElement).requestSubmit();
      });
      expect(mock.claimAlias).toHaveBeenCalledWith('c1', 'Navigator1');
    });

    it('post under the alias only when asked to', async () => {
      approved();
      mock.loadAlias.mockResolvedValue({ name: 'Navigator1', rotatedAt: null });
      await render();
      click('ECON 1010 · Support');
      await settle();
      await settle();
      type(host.querySelector('textarea') as HTMLTextAreaElement, 'First post here');
      await act(async () => {
        (host.querySelector('form[aria-label="Write a post"]') as HTMLFormElement).requestSubmit();
      });
      expect(mock.createPost).toHaveBeenLastCalledWith('c1', 'First post here', false, false, null);
      const toggle = [...host.querySelectorAll('label')].find((l) => l.textContent === 'Post as Navigator1')!
        .querySelector('input') as HTMLInputElement;
      act(() => toggle.click());
      type(host.querySelector('textarea') as HTMLTextAreaElement, 'Second post here');
      await act(async () => {
        (host.querySelector('form[aria-label="Write a post"]') as HTMLFormElement).requestSubmit();
      });
      expect(mock.createPost).toHaveBeenLastCalledWith('c1', 'Second post here', false, true, null);
      expect(host.textContent).toContain('Post as Navigator1');
    });

    it('mark an alias post as a pseudonym', async () => {
      mock.loadPosts.mockResolvedValue({ posts: [post('z', { authorName: 'Navigator1', asAlias: true })], muted: [] });
      await openCourse();
      expect(host.textContent).toContain('Navigator1 · pseudonym');
    });
  });

  it('opens volunteer moderation only when the school has switched it on', async () => {
    await render();
    expect(host.textContent).not.toContain('Volunteer moderation');
    act(() => root.unmount());
    root = createRoot(host);
    mock.programs.mockResolvedValue({ scopedPseudonymity: false, volunteerModeration: true });
    await render();
    click('Volunteer moderation');
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'volunteer' });
  });

  describe('standing', () => {
    it('is not asked for where the school has not switched safety state on', async () => {
      await render();
      expect(mock.myStanding).not.toHaveBeenCalled();
      expect(host.textContent).not.toContain('Your standing');
    });

    it('is not asked for while the build flag is off, whatever the school says', async () => {
      mock.flags.accountSafetyState = false;
      mock.programs.mockResolvedValue({ accountSafetyState: true });
      await render();
      expect(mock.myStanding).not.toHaveBeenCalled();
    });

    it('is a sentence, never a number, with what it can and cannot touch', async () => {
      mock.programs.mockResolvedValue({ accountSafetyState: true });
      await render();
      const panel = host.querySelector('[aria-label="Your Community standing"]') as HTMLElement;
      expect(panel.textContent).toContain('A past decision still affects your Community account.');
      expect(panel.textContent).toContain('never affects your feed, your courses');
      expect(panel.textContent).not.toMatch(/\d+ (out of|\/) 100/);
    });
  });

  describe('images', () => {
    /** A small, real JPEG: JFIF header, one frame, one scan. */
    const jpegBytes = () =>
      new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
        0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
        0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x10, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xff, 0xda, 0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00, 0x12, 0x34,
        0xff, 0xd9,
      ]);
    const on = () => mock.programs.mockResolvedValue({ scopedPseudonymity: false, volunteerModeration: false, imagePosts: true });
    const picker = () => [...host.querySelectorAll('input[type="file"]')][0] as HTMLInputElement | undefined;
    async function choose(bytes: Uint8Array) {
      const input = picker()!;
      const file = new File([bytes as BlobPart], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      await act(async () => {
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 0));
      });
    }

    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => 'blob:preview');
      URL.revokeObjectURL = vi.fn();
      mock.uploadImage.mockResolvedValue('media-1');
    });

    it('are not offered while the school has them off', async () => {
      await openCourse();
      expect(picker()).toBeUndefined();
    });

    it('are not offered while the build flag is off, whatever the school says', async () => {
      on();
      mock.flags.communityImages = false;
      await openCourse();
      expect(picker()).toBeUndefined();
    });

    it('are not offered in a support community', async () => {
      on();
      mock.loadCommunities.mockResolvedValue([{ ...course, kind: 'support' }]);
      await render();
      click('ECON 1010 · Support');
      await settle();
      expect(picker()).toBeUndefined();
    });

    it('strip the image on this device, need a description, then upload before posting', async () => {
      on();
      await openCourse();
      await choose(jpegBytes());
      expect(host.textContent).toContain('Location and camera details were removed on this device.');
      type(host.querySelector('textarea') as HTMLTextAreaElement, 'Our lab bench');
      const form = host.querySelector('form[aria-label="Write a post"]') as HTMLFormElement;
      const post = [...form.querySelectorAll('button')].find((b) => b.textContent === 'Post') as HTMLButtonElement;
      expect(post.disabled, 'no description yet').toBe(true);
      type(form.querySelector('input.input') as HTMLInputElement, 'Two microscopes on a bench');
      await act(async () => form.requestSubmit());
      const [, kind, sent, alt] = mock.uploadImage.mock.calls[0];
      expect(kind).toBe('jpeg');
      expect(alt).toBe('Two microscopes on a bench');
      // The EXIF segment in the chosen file never leaves the device.
      expect([...(sent as Uint8Array)].join(',')).not.toContain([0x45, 0x78, 0x69, 0x66].join(','));
      expect(mock.createPost).toHaveBeenLastCalledWith('c1', 'Our lab bench', false, false, 'media-1');
    });

    it('refuse a file that is not an image, in words', async () => {
      on();
      await openCourse();
      await choose(new TextEncoder().encode('<svg onload=alert(1)>'));
      expect(host.textContent).toContain('Only JPEG, PNG and WebP images can be shared in Community');
    });

    it('are never offered while posting under an alias', async () => {
      mock.loadCommunities.mockResolvedValue([{ ...course, kind: 'study_group', pseudonymityApproved: true }]);
      mock.programs.mockResolvedValue({ scopedPseudonymity: true, volunteerModeration: false, imagePosts: true });
      mock.loadAlias.mockResolvedValue({ name: 'Navigator1', rotatedAt: null });
      await render();
      click('ECON 1010 · Study group');
      await settle();
      await settle();
      expect(picker()).toBeDefined();
      const toggle = [...host.querySelectorAll('label')].find((l) => l.textContent === 'Post as Navigator1')!
        .querySelector('input') as HTMLInputElement;
      act(() => toggle.click());
      expect(picker()).toBeUndefined();
    });

    it('show a cleared image with its description, and tell the author where theirs stands', async () => {
      const media = (patch: Record<string, unknown>) => ({
        id: 'm', status: 'clear', reasonCode: '', width: 800, height: 600, url: 'https://x/signed', knownAbuseMatch: false,
        altText: 'Two microscopes on a bench', ...patch,
      });
      mock.loadPosts.mockResolvedValue({
        posts: [
          post('a', { media: media({}) }),
          post('mine', { mine: true, status: 'pending', media: media({ status: 'pending', url: 'https://x/own', altText: 'My own photo' }) }),
          post('words', { mine: true, status: 'pending' }),
        ],
        muted: [],
      });
      await openCourse();
      const img = host.querySelector('img[alt="Two microscopes on a bench"]') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe('https://x/signed');
      expect(host.textContent).toContain('Your image is being checked. The post appears to others once it clears.');
      // The host-approval words belong to the post without an image, not to the one waiting on its scan.
      expect(host.textContent?.split('Waiting for a host to approve it').length).toBe(2);
    });
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
