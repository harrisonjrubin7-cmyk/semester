// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider, useStore } from '../../state/store';
import { loadSeed } from '../../data/seed';
import { STORAGE_KEY, currentLook, type State } from '../../state/shape';
import { closeOverlay, showCapture } from '../../lib/unity';
import { ContextBar } from './ContextBar';
import { ObjectCard } from './ObjectCard';
import { KeepItAs, UnityLayer } from './UnityLayer';
import { CommandCenter, FirstGoal } from './CommandCenter';
import { ScreenGuide } from './ScreenGuide';
import { ShellBody } from '../shell/ShellBody';
import { EXEMPT, FILLS } from '../shell/exempt';
import { WorkspaceModePicker } from './modes';
import { ErrorState, LoadingState, Progress, StepStatus, SuccessState } from './States';
import { NextSteps } from './NextSteps';
import { Visibility } from './Visibility';

/**
 * The shared components, driven the way a student would drive them: by
 * pressing things with names, and reading what a screen reader would read.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let seen: State;

/** Reads the store after each commit, the way the app's own effects do. */
function Probe() {
  const { state } = useStore();
  useEffect(() => {
    seen = state;
  });
  return null;
}

beforeAll(async () => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  await loadSeed();
});

beforeEach(async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
  host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
  });
});

afterEach(async () => {
  await act(async () => closeOverlay());
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

async function mount(node: ReactNode) {
  await act(async () => {
    root.render(
      <StoreProvider>
        <Probe />
        {node}
        <UnityLayer />
      </StoreProvider>,
    );
  });
}

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const button = (label: string | RegExp): HTMLButtonElement => {
  const found = [...host.querySelectorAll('button')].find((b) =>
    typeof label === 'string' ? (b.textContent ?? '').trim() === label : label.test(b.textContent ?? ''),
  );
  if (!found) throw new Error(`no button "${label}" in: ${text()}`);
  return found;
};
const press = (label: string | RegExp) => act(async () => button(label).click());

async function typeIn(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('the context bar', () => {
  it('says where you are, on whose authority, and how the work stands', async () => {
    await mount(
      <ContextBar
        context="PSY 101 · Research Methods"
        title="Statistical analysis report"
        statuses={['course-provided', 'updated-today']}
        save="saved"
        source={{ title: 'Statistical analysis report', origin: 'course-provided', sourceName: 'PSY 101 syllabus' }}
        primary={{ label: 'Open workspace', run: () => {} }}
      />,
    );
    const bar = host.querySelector('section')!;
    expect(bar.getAttribute('aria-label')).toBe('PSY 101 · Research Methods: Statistical analysis report');
    expect(text()).toContain('Course-provided');
    expect(text()).toContain('Updated today');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Saved');
  });

  it('holds an action while it cannot run', async () => {
    let ran = 0;
    await mount(<ContextBar title="Your study guide" primary={{ label: 'Save & open in Write', run: () => (ran += 1), disabled: true }} />);
    expect(button('Save & open in Write').disabled).toBe(true);
    await press('Save & open in Write');
    expect(ran).toBe(0);
  });

  it('opens Source & details as a dialog that takes focus and gives it back', async () => {
    await mount(
      <ContextBar
        title="Midterm 2"
        source={{
          title: 'Midterm 2',
          origin: 'yours',
          freshness: 'Entered 3 days ago',
          limitations: 'Check the course site for room changes.',
        }}
      />,
    );
    const opener = button('Source & details');
    opener.focus();
    await press('Source & details');
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Source & details');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(text()).toContain('You entered this yourself');
    expect(text()).toContain('Check the course site for room changes.');
    expect(text()).toContain('Only you');
    await act(async () => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe('the object card', () => {
  it('has the one rhythm: eyebrow, heading, why, metadata, one primary', async () => {
    let ran = 0;
    await mount(
      <ObjectCard
        kind="requirement"
        title="Registration opens tomorrow"
        explanation="You have two items left before you can register."
        metadata="Tue 14 Oct · 9:00"
        statuses={['needs-confirmation']}
        primary={{ label: 'Finish checklist', run: () => (ran += 1) }}
        secondary={{ label: 'View details', run: () => {} }}
        level={2}
      />,
    );
    const article = host.querySelector('article')!;
    const h = article.querySelector('h2')!;
    expect(article.getAttribute('aria-labelledby')).toBe(h.id);
    expect(text()).toContain('Requirement · Needs confirmation');
    expect(host.querySelectorAll('.btn-primary')).toHaveLength(1);
    await press('Finish checklist');
    expect(ran).toBe(1);
  });

  it('holds its primary while the action is already running', async () => {
    let ran = 0;
    await mount(<ObjectCard kind="task" title="Request a transcript" primary={{ label: 'Request', run: () => (ran += 1), disabled: true }} />);
    expect(button('Request').disabled).toBe(true);
    await press('Request');
    expect(ran).toBe(0);
  });

  it('opens in another place with a real navigation, so Back comes home', async () => {
    await mount(
      <ObjectCard kind="course" title="ECON 1020" openIn={[{ label: 'Study', screen: 'study' }, { label: 'Clocks', screen: 'clocks' }]} />,
    );
    expect(host.querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Open ECON 1020 in');
    const from = seen.screen;
    await press('Clocks');
    expect(seen.screen).toBe('clocks');
    expect(seen.history.at(-1)).toBe(from);
  });
});

describe('quick capture', () => {
  it('keeps a line as a task, attached to no course unless asked', async () => {
    await mount(null);
    await act(async () => showCapture());
    const field = host.querySelector('[role="dialog"] input') as HTMLInputElement;
    expect(document.activeElement).toBe(field);
    await typeIn(field, 'Email TA about lab');
    await press('Save');
    const task = seen.tasks.find((t) => t.title === 'Email TA about lab');
    expect(task?.courseId).toBeNull();
    expect(text()).toContain('Saved');
  });

  it('keeps a question for an advisor as a private note that says what it is', async () => {
    await mount(null);
    await act(async () => showCapture());
    await press('Question for advisor');
    expect(button('Question for advisor').getAttribute('aria-pressed')).toBe('true');
    await typeIn(host.querySelector('[role="dialog"] input') as HTMLInputElement, 'Can PSY 340 count twice?');
    await press('Save');
    const note = seen.notes.find((n) => n.title === 'Can PSY 340 count twice?');
    expect(note?.body).toBe('Captured as: Question for advisor');
    expect(text()).toContain('Only me');
  });

  it('is reached from the + box, carrying over what was typed', async () => {
    let left = 0;
    await mount(<KeepItAs text="  Ask about the PSCI minor " onLeave={() => (left += 1)} />);
    expect(host.querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Keep it as something else');
    await press('Question for advisor');
    expect(left).toBe(1);
    const field = host.querySelector('[role="dialog"] input') as HTMLInputElement;
    expect(field.value).toBe('Ask about the PSCI minor');
    const chosen = [...host.querySelectorAll('[role="dialog"] button[aria-pressed="true"]')].map((b) => b.textContent);
    expect(chosen).toEqual(['Question for advisor']);
    await press('Save');
    expect(seen.notes.some((n) => n.title === 'Ask about the PSCI minor')).toBe(true);
  });

  it('will not save an empty line', async () => {
    await mount(null);
    await act(async () => showCapture());
    expect(button('Save').disabled).toBe(true);
  });
});

describe('the command centre', () => {
  it('reorders with Move up and Move down, and keeps the order', async () => {
    await mount(<CommandCenter />);
    const labels = () => [...host.querySelectorAll('.command-widget-label')].map((l) => l.textContent);
    expect(labels()).toEqual(['This week’s plan', 'Current assignment', 'Study progress']);
    await press('Arrange');
    const firstDown = host.querySelectorAll('[role="group"]')[0].querySelectorAll('button')[1] as HTMLButtonElement;
    await act(async () => firstDown.click());
    expect(labels()).toEqual(['Current assignment', 'This week’s plan', 'Study progress']);
    expect(currentLook(seen).pinned).toBe('assignment,week,study');
  });

  it('pins and unpins without dragging', async () => {
    await mount(<CommandCenter />);
    await press('Arrange');
    await press('Pin Degree requirement progress');
    expect(currentLook(seen).pinned).toContain('degree');
  });
});

describe('first-session setup', () => {
  it('asks what would help, and goes straight there', async () => {
    await mount(<FirstGoal />);
    expect(host.querySelector('h2')?.textContent).toBe('What would help most today?');
    await press('More options');
    await press('Study for a course');
    expect(currentLook(seen).goal).toBe('study');
    expect(seen.screen).toBe('study');
    expect(text()).toContain('Your focus');
    await press('Change');
    expect(text()).toContain('What would help most today?');
  });

  it('keeps keyboard focus on the goal disclosure after revealing more choices', async () => {
    await mount(<FirstGoal />);
    const more = button('More options');
    more.focus();
    await act(async () => more.click());
    expect(document.activeElement).toBe(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(text()).toContain('Study for a course');
  });
});

describe('About this screen', () => {
  it('is a disclosure with the four answers', async () => {
    await mount(<ScreenGuide screen="calendar" />);
    const toggle = button(/About this screen/);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    // The reference resolves while closed too — the accessibility smoke
    // fails a control that names an element not in the document.
    const region = document.getElementById(toggle.getAttribute('aria-controls')!);
    expect(region).not.toBeNull();
    expect(region!.hidden).toBe(true);
    await act(async () => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).not.toBeNull();
    for (const q of ['What is this?', 'Why does it matter?', 'Where does this information come from?', 'What can I do next?']) {
      expect(text()).toContain(q);
    }
  });
});

describe('About this screen on the full-bleed screens', () => {
  it('is drawn on every one of them, last, in the same words', async () => {
    for (const screen of EXEMPT) {
      await mount(
        <ShellBody screen={screen}>
          <p>the screen</p>
        </ShellBody>,
      );
      const guide = host.querySelector('aside[aria-label="About this screen"]');
      expect(guide, screen).not.toBeNull();
      // After the screen's own content, which is what keeps help in the same
      // relative order everywhere (WCAG 3.2.6).
      const body = host.querySelector('p')!;
      expect(body.compareDocumentPosition(guide!) & Node.DOCUMENT_POSITION_FOLLOWING, screen).toBeTruthy();
    }
  });

  it('opens in place on a screen that scrolls', async () => {
    await mount(
      <ShellBody screen="calendar">
        <p>the grid</p>
      </ShellBody>,
    );
    await press(/About this screen/);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(text()).toContain('Your classes, deadlines and events on one calendar.');
  });

  it('opens as a sheet on a screen that fills its box, so the composer stays put', async () => {
    expect(FILLS).toContain('ask');
    await mount(
      <ShellBody screen="ask">
        <p>the chat</p>
      </ShellBody>,
    );
    expect(host.querySelector('.fill-with-guide')).not.toBeNull();
    const opener = button(/About this screen/);
    expect(opener.getAttribute('aria-haspopup')).toBe('dialog');
    opener.focus();
    await press(/About this screen/);
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toBe('About this screen');
    expect(dialog.textContent).toContain('What can I do next?');
    await act(async () => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.activeElement).toBe(opener);
  });
});

describe('workspace modes', () => {
  it('Accessibility turns on the existing settings rather than inventing its own', async () => {
    await mount(<WorkspaceModePicker />);
    const access = [...host.querySelectorAll('input[type="radio"]')].find(
      (r) => (r as HTMLInputElement).value === 'access',
    ) as HTMLInputElement;
    await act(async () => access.click());
    expect(seen.workspaceMode).toBe('access');
    expect(seen.textSize).toBe('large');
    expect(seen.calm).toBe('still');
  });

  it('Focused draws a way out, and the way out works', async () => {
    await mount(<WorkspaceModePicker />);
    expect(host.querySelector('[aria-label="Focus mode"]')).toBeNull();
    const focused = [...host.querySelectorAll('input[type="radio"]')].find(
      (r) => (r as HTMLInputElement).value === 'focused',
    ) as HTMLInputElement;
    await act(async () => focused.click());
    expect(host.querySelector('[aria-label="Focus mode"]')).not.toBeNull();
    await press('Exit focus');
    expect(seen.workspaceMode).toBe('guided');
  });
});

describe('the break reminder in Focused', () => {
  it('suggests a break after fifty minutes, as a status a reader hears, and takes it', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, workspaceMode: 'focused' }));
      await mount(null);
      const status = () => host.querySelector('.focus-bar [role="status"]')!;
      expect(status()).not.toBeNull();
      expect(status().textContent).toBe('');
      await act(async () => {
        vi.advanceTimersByTime(50 * 60_000);
      });
      expect(status().textContent).toBe('50 minutes of focus. Time for a short break?');
      const timers = seen.timers.length;
      await press('Take a 5-minute break');
      expect(seen.timers.length).toBe(timers + 1);
      expect(seen.timers[0].label).toBe('Break');
      expect(status().textContent).toBe('');
      expect(button('Exit focus')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the standard states', () => {
  it('loading says so to a reader and marks the region busy', async () => {
    await mount(<LoadingState what="your courses" />);
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Loading your courses');
  });

  it('an error interrupts and always offers a way out', async () => {
    let tried = 0;
    await mount(<ErrorState title="Could not import" body="The file is not a syllabus." recover={{ label: 'Choose another file', run: () => (tried += 1) }} reference="IMP-42" />);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await press('Choose another file');
    expect(tried).toBe(1);
    expect(text()).toContain('Reference: IMP-42');
  });

  it('success points at what is next, without a streak in sight', async () => {
    await mount(<SuccessState title="Checklist complete" next={{ label: 'Compare two course options', run: () => {} }} />);
    expect(text()).toContain('Next: Compare two course options');
    expect(text()).not.toMatch(/streak|#1|beat/i);
  });

  it('progress is a real progress bar, with cancel and retry by name', async () => {
    await mount(<Progress label="Uploading syllabus" done={3} total={4} onCancel={() => {}} note="Stays on this device." />);
    const bar = host.querySelector('progress')!;
    expect(bar.getAttribute('aria-label')).toBe('Uploading syllabus');
    expect(text()).toContain('75%');
    expect(button('Cancel')).toBeTruthy();
    await mount(<Progress label="Uploading syllabus" done={3} total={4} failed="The connection dropped." onRetry={() => {}} />);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('The connection dropped.');
    expect(button('Retry')).toBeTruthy();
  });

  it('steps say their state in words, and mark the current one', async () => {
    await mount(
      <StepStatus
        label="Drafting your study guide"
        steps={[
          { label: 'Gathering sources', state: 'done' },
          { label: 'Drafting', state: 'working' },
          { label: 'Ready', state: 'waiting' },
        ]}
      />,
    );
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain('Drafting');
    expect(text()).toContain('Gathering sources — done');
  });
});

describe('next and visibility', () => {
  it('Next offers at most three, and nothing when there is nothing', async () => {
    const step = (label: string) => ({ label, run: () => {} });
    await mount(<NextSteps steps={[step('a'), step('b'), step('c'), step('d')]} />);
    expect(host.querySelectorAll('.next-step')).toHaveLength(3);
    await mount(<NextSteps steps={[]} />);
    expect(host.querySelector('.next-steps')).toBeNull();
  });

  it('offers only the audiences a module can honour', async () => {
    await mount(<Visibility value="only-me" allowed={['only-me', 'course']} onChange={() => {}} />);
    const radios = [...host.querySelectorAll('input[type="radio"]')].map((r) => (r as HTMLInputElement).value);
    expect(radios).toEqual(['only-me', 'course']);
    expect(host.querySelector('legend')?.textContent).toBe('Who can see this?');
  });
});
