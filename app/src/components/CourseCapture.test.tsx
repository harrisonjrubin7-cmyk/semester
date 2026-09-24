// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CourseCapture } from './CourseCapture';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const mount = (over: Partial<Parameters<typeof CourseCapture>[0]> = {}) => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <CourseCapture
        courseId="econ"
        policy={{ recording: 'permitted', modelProcessing: true }}
        onFiles={vi.fn()}
        {...over}
      />,
    ),
  );
};

const consent = () => {
  const box = host.querySelector('[aria-label="I have permission to capture and process this material"]') as HTMLInputElement;
  act(() => box.click());
};

describe('CourseCapture', () => {
  it('requires explicit consent and accepts audio, video, image and document files', async () => {
    const onFiles = vi.fn();
    mount({ onFiles });
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toContain('audio/*');
    expect(input.accept).toContain('video/*');
    expect(input.accept).toContain('image/*');
    expect(input.disabled).toBe(true);

    consent();
    const enabledInput = host.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['lecture'], 'lecture.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(enabledInput, 'files', { configurable: true, value: [file] });
    await act(async () => {
      enabledInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('preserved locally');
  });

  it('shows denied policy and removes a local original', async () => {
    mount({ policy: { recording: 'prohibited', modelProcessing: false } });
    expect(host.textContent).toContain('Recording is not permitted');

    act(() => root.unmount());
    host.remove();
    mount();
    consent();
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['image'], 'problem.png', { type: 'image/png' })],
    });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const remove = [...host.querySelectorAll('button')].find((button) => /Remove problem.png/.test(button.getAttribute('aria-label') ?? ''))!;
    act(() => remove.click());
    expect(host.querySelector('[aria-label="Remove problem.png"]')).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('was removed');
  });
});
