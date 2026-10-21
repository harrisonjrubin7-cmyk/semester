// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InstitutionalPackage } from './InstitutionalPackage';
import type { InstitutionalIntakeInput } from '../../lib/institutional-intake';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const field = (name: string) => host.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement;
const change = (name: string, value: string) => {
  const input = field(name);
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
};
const submit = () => act(() => { host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });

it('shows one package, the governed operating-layer outcome and every gated phase', () => {
  act(() => root.render(<InstitutionalPackage />));
  expect(host.textContent).toContain('Semester Institutional');
  expect(host.textContent).toContain('without replacing systems of record');
  expect(host.textContent).not.toContain('Replace the LMS and gradebook');
  expect(host.textContent).toContain('OneRoster remains planned, not included today');
  for (const phase of ['Agree', 'Pilot', 'Integrate', 'Run in parallel', 'Migrate', 'Cut over', 'Expand']) {
    expect(host.textContent).toContain(phase);
  }
  expect(host.textContent).toContain('simplifies buying, not governance');
});

it('submits bounded discovery details once and shows only an accepted pending receipt', async () => {
  let resolve!: (value: { reference: string }) => void;
  const intake = vi.fn((_input: InstitutionalIntakeInput) => new Promise<{ reference: string }>((done) => { resolve = done; }));
  act(() => root.render(<InstitutionalPackage
    requester={{ name: 'Pat Lee', email: 'pat@state.example' }}
    institution={{ name: 'State University', domain: 'state.example' }}
    submitIntake={intake}
  />));
  change('provider', 'Example SIS');
  change('system', 'sis');
  submit();
  submit();
  expect(intake).toHaveBeenCalledOnce();
  expect(host.textContent).toContain('Sending request');
  expect((host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  await act(async () => resolve({ reference: 'SL-0A1B2C3D4E' }));
  expect(intake).toHaveBeenCalledWith(expect.objectContaining({
    institution: 'State University', domain: 'state.example', provider: 'Example SIS', system: 'sis', dataMode: 'manual',
  }));
  expect(host.textContent).toContain('Request received · pending human review');
  expect(host.textContent).toContain('SL-0A1B2C3D4E');
  expect(host.textContent).toContain('does not confirm ownership');
  expect(host.textContent).toContain('cannot securely retrieve');
  expect(host.querySelector('form')).toBeNull();
});

it('keeps a rejected or uncertain submission editable and never marks it received', async () => {
  const intake = vi.fn(async () => { throw new Error('The request may or may not have arrived. Do not submit it again automatically; check before retrying.'); });
  act(() => root.render(<InstitutionalPackage
    requester={{ name: '', email: 'not-an-email' }}
    institution={{ name: '', domain: '' }}
    submitIntake={intake}
  />));
  submit();
  expect(intake).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/name, a valid work email, institution, domain, and provider/i);
  change('name', 'Pat Lee');
  change('email', 'pat@state.example');
  change('institution', 'State University');
  change('domain', 'state.example');
  change('provider', 'Example SIS');
  submit();
  await act(async () => { await Promise.resolve(); });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('may or may not have arrived');
  expect(host.textContent).not.toContain('Request received · pending human review');
  expect(host.querySelector('form')).not.toBeNull();
});

it('allows an internationalized institution domain for server canonicalization', async () => {
  const intake = vi.fn(async () => ({ reference: 'SL-0A1B2C3D4E' }));
  act(() => root.render(<InstitutionalPackage
    requester={{ name: 'Pat Lee', email: 'pat@state.example' }}
    institution={{ name: 'Universität', domain: 'universität.de' }}
    submitIntake={intake}
  />));
  change('provider', 'Example SIS');
  submit();
  await act(async () => { await Promise.resolve(); });
  expect(intake).toHaveBeenCalledOnce();
});

it('warns that the form is discovery-only and must not receive secrets or student records', () => {
  act(() => root.render(<InstitutionalPackage />));
  expect(host.querySelector('#institution-request-error')?.getAttribute('role')).toBe('alert');
  expect(host.textContent).toContain('No passwords, API keys, secrets, or student records');
  expect(host.textContent).toContain('does not activate a tenant or connect a provider');
});
