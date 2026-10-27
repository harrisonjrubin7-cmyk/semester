// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationRequestPanel } from './AccommodationRequestPanel';
import type { AccommodationRequestStatus } from '../lib/accommodation-request';

vi.mock('../state/store', () => ({ useStore: () => ({ account: { id: 'synthetic-student' } }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const openRequest: AccommodationRequestStatus = {
  id: 'access-request-1',
  kind: 'accessibility_barrier',
  summary: 'The video has no captions.',
  status: 'in_review',
  ownerSeat: 'disability_services_officer',
  responseDueAt: '2026-10-27T18:00:00Z',
  escalationAt: '2026-10-27T22:00:00Z',
  correctionCount: 0,
  resolutionCode: null,
  followUpRequestedAt: null,
  createdAt: '2026-10-27T14:00:00Z',
  resolvedAt: null,
  withdrawnAt: null,
};

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function button(label: string) {
  const found = [...host.querySelectorAll('button')].find((item) => item.textContent?.includes(label));
  if (!found) throw new Error(`Button not found: ${label}`);
  return found as HTMLButtonElement;
}

async function typeInto(control: HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(control, value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('student accommodation request path', () => {
  it('uses labelled native controls and states privacy, human ownership and decision boundaries before sending', () => {
    act(() => root.render(<AccommodationRequestPanel available />));
    const textarea = host.querySelector('textarea')!;
    expect(textarea.labels?.[0]?.textContent).toContain('What should the access office know');
    expect(host.querySelector('select')?.labels?.[0]?.textContent).toContain('What kind of help');
    expect(host.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(host.textContent).toContain('does not decide whether you qualify');
    expect(host.textContent).toContain('Do not include a diagnosis');
    expect(host.textContent).toContain('authorized person at your school');
    expect(button('Send private request').disabled).toBe(true);
  });

  it('submits only the selected kind, minimal summary and explicit consent, then announces human review', async () => {
    const submitter = vi.fn().mockResolvedValue({ id: 'access-receipt-1', status: 'submitted', ownerSeat: 'disability_services_officer' });
    const statusLoader = vi.fn().mockResolvedValue([]);
    act(() => root.render(<AccommodationRequestPanel available submitter={submitter} statusLoader={statusLoader} />));
    const select = host.querySelector('select')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'accessibility_barrier');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await typeInto(host.querySelector('textarea')!, 'The lecture player has no caption control.');
    await act(async () => {
      (host.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
      host.querySelector('form')!.requestSubmit();
    });
    expect(submitter).toHaveBeenCalledWith({
      kind: 'accessibility_barrier',
      summary: 'The lecture player has no caption control.',
      consent: true,
    });
    expect(host.querySelector('[role="status"]')?.textContent).toContain('submitted for human review');
    expect(host.textContent).toContain('school’s access office');
  });

  it('reads own status and provides keyboard-native correction and confirmed withdrawal routes', async () => {
    const statusLoader = vi.fn().mockResolvedValue([openRequest]);
    const corrector = vi.fn().mockResolvedValue(undefined);
    const withdrawer = vi.fn().mockResolvedValue(undefined);
    act(() => root.render(
      <AccommodationRequestPanel available statusLoader={statusLoader} corrector={corrector} withdrawer={withdrawer} />,
    ));
    await act(async () => button('Check my request status').click());
    expect(host.textContent).toContain('Status: in review');
    expect(host.textContent).toContain('Owner: your school’s access office');

    await act(async () => button('Correct this request').click());
    const correction = [...host.querySelectorAll('textarea')].find((item) => item.labels?.[0]?.textContent?.includes('Corrected request'))!;
    await typeInto(correction, 'The recorded lecture player has no caption control.');
    await act(async () => button('Add correction').click());
    expect(corrector).toHaveBeenCalledWith('access-request-1', 'The recorded lecture player has no caption control.');
    expect(host.textContent).toContain('without deleting the original request');

    await act(async () => button('Withdraw this request').click());
    expect(host.textContent).toContain('audit history remains');
    await act(async () => button('Confirm withdrawal').click());
    expect(withdrawer).toHaveBeenCalledWith('access-request-1');
    expect(host.textContent).toContain('request was withdrawn');
  });

  it('announces a human follow-up request without closing the correction path', async () => {
    const statusLoader = vi.fn().mockResolvedValue([{
      ...openRequest,
      status: 'needs_student',
      followUpRequestedAt: '2026-10-27T16:00:00Z',
    }]);
    act(() => root.render(<AccommodationRequestPanel available statusLoader={statusLoader} />));
    await act(async () => button('Check my request status').click());
    expect(host.textContent).toContain('Status: needs student');
    expect(host.textContent).toContain('requested more information');
    expect(button('Correct this request')).not.toBeNull();
  });

  it('fails closed to a private-data-safe official fallback when the authenticated route is unavailable', () => {
    act(() => root.render(<AccommodationRequestPanel available={false} />));
    expect(host.querySelector('form')).toBeNull();
    expect(host.textContent).toContain('No request was sent');
    expect(host.textContent).toContain('contact your school’s access office directly');
    expect(host.textContent).toContain('without including a diagnosis');
  });
});
