// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CreativeProject } from '../../lib/creations';
import { Publishing } from './Publishing';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const formshare = vi.hoisted(() => ({
  collect: vi.fn(),
  publish: vi.fn(),
  republish: vi.fn(),
  shareLink: vi.fn(() => 'https://semester.example/?form=published-form'),
  withdraw: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../lib/cloud', () => ({ cloudConfigured: true }));
vi.mock('../../lib/formshare', () => formshare);

const project: CreativeProject = {
  id: 'project-1',
  title: 'Research methods survey',
  kind: 'form',
  courseId: 'course-1',
  itemId: '',
  updated: Date.UTC(2026, 9, 9),
  archived: false,
  form: {
    description: 'A short survey',
    questions: [{
      id: 'question-1',
      title: 'What changed?',
      type: 'Paragraph',
      required: true,
      options: [],
      answer: '',
      points: 0,
      condition: null,
    }],
    responses: [{
      id: 'collected-1',
      at: '2026-10-09T12:00:00.000Z',
      answers: { 'question-1': 'The library hours.' },
      score: 0,
      possible: 0,
    }],
    accepting: true,
    opens: '',
    closes: '',
    limit: 150,
    quiz: false,
    sheetId: null,
    published: 'published-form',
  },
  design: { width: 1200, height: 630, background: '#ffffff', layers: [] },
  video: { clips: [] },
  notes: [],
};

let host: HTMLDivElement;
let root: Root;
const onChange = vi.fn<(patch: Partial<CreativeProject>) => boolean>(() => true);

const press = async (label: string) => {
  const button = [...host.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
  expect(button, `no button called ${label}`).toBeTruthy();
  await act(async () => button!.click());
};

beforeEach(async () => {
  formshare.withdraw.mockClear();
  onChange.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Publishing project={project} onChange={onChange} />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

it('previews the live withdrawal boundary and requires explicit confirmation', async () => {
  await press('Take it down');

  const preview = host.querySelector('.action-preview')?.textContent ?? '';
  expect(preview).toContain('Research methods survey');
  expect(preview).toContain('shared link stops working');
  expect(preview).toContain('every answer still stored with the published form is permanently deleted');
  expect(preview).toContain('questions, settings, and 1 answer already collected on this device stay here');
  expect(preview).toContain('This can’t be undone. Publishing again creates a new link; it cannot restore deleted responses.');
  expect(formshare.withdraw).not.toHaveBeenCalled();

  await press('Cancel');
  expect(formshare.withdraw).not.toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();

  await press('Take it down');
  await press('Take down form');

  expect(formshare.withdraw).toHaveBeenCalledWith('published-form');
  expect(onChange).toHaveBeenCalledWith({ form: { ...project.form, published: null } });
});
