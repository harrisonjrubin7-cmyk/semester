// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { quality } from './quality';
import { AiAnswerRemedy } from './AiAnswerRemedy';

vi.mock('../state/store', () => ({ useStore: () => ({ account: { id: 'synthetic-account' } }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const q = quality({ read: { mode: 'grounded', says: '', because: '', screens: [] }, help: { kind: 'ready' }, sources: 2 });

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function draw(props: Partial<Parameters<typeof AiAnswerRemedy>[0]> = {}) {
  act(() => {
    root.render(
      <AiAnswerRemedy answer="The answer body" category="harmful" quality={q} available {...props} />,
    );
  });
}

describe('AI answer human remedy', () => {
  it('has a labelled keyboard-native form and states the privacy and decision boundaries', () => {
    draw();
    const textarea = host.querySelector('textarea');
    expect(textarea?.labels?.[0]?.textContent).toContain('What should the reviewer know');
    expect(host.querySelector('form')).not.toBeNull();
    expect(host.querySelector('button[type="submit"]')).not.toBeNull();
    expect(host.textContent).toContain('authorized human reviewer');
    expect(host.textContent).toContain('cannot automatically change a grade');
    expect(host.textContent).toContain('must not be used for retaliation');
    expect(host.textContent).toContain('answer itself is not stored');
  });

  it('submits the evidence snapshot and announces a human-owned receipt', async () => {
    const submitter = vi.fn().mockResolvedValue({ id: 'synthetic-receipt', status: 'submitted', ownerSeat: 'trust_officer' });
    draw({ submitter });
    const textarea = host.querySelector('textarea')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(textarea, 'The source does not support this claim.');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => host.querySelector('form')!.requestSubmit());
    expect(submitter).toHaveBeenCalledWith(expect.objectContaining({
      category: 'harmful',
      answer: 'The answer body',
      summary: 'The source does not support this claim.',
      sourceStrength: 'strong',
      policyState: 'allowed',
      sourceCount: 2,
    }));
    expect(host.querySelector('[role="status"]')?.textContent).toContain('submitted for human review');
    expect(host.textContent).toContain('trust officer');
  });

  it('fails closed to an explicit private-data-safe fallback', () => {
    draw({ available: false });
    expect(host.querySelector('form')).toBeNull();
    expect(host.textContent).toContain('No report was sent');
    expect(host.textContent).toContain('do not include the answer');
  });

  it('reads only the account-owned status path and announces the latest state', async () => {
    const statusLoader = vi.fn().mockResolvedValue([{
      id: 'synthetic-receipt', category: 'incorrect', evidenceReference: 'ask-semester:abc',
      status: 'in_review', ownerSeat: 'trust_officer', responseDueAt: '2026-10-28T12:00:00Z',
      escalationAt: '2026-10-29T12:00:00Z', resolutionCode: null, resolutionEvidence: null,
    }]);
    draw({ statusLoader });
    const button = [...host.querySelectorAll('button')].find((item) => item.textContent?.includes('CHECK MY REVIEW STATUS'))!;
    await act(async () => button.click());
    expect(statusLoader).toHaveBeenCalledOnce();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Latest request: in review');
    expect(host.textContent).toContain('Owner: trust officer');
  });
});
