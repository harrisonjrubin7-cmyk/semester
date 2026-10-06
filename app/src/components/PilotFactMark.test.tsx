// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GradeFactMark } from './PilotFactMark';

/**
 * A seeded grade is the figure a first-run student can mistake for a record.
 * The mark has to say sample, with an age, and never the official word.
 */

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('a seeded grade', () => {
  it('renders as sample, with no recorded update time, and not as institution verified', () => {
    act(() => {
      root.render(<GradeFactMark seeded />);
    });
    expect(host.querySelector('[data-source="sample"]')).not.toBeNull();
    expect(host.querySelector('[data-source="institution_verified"]')).toBeNull();
    expect(host.textContent).toContain('Sample');
    expect(host.textContent).toContain('Update time not recorded');
    expect(host.textContent).not.toContain('Institution verified');
  });
});
