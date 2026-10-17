import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitInstitutionalIntake, type InstitutionalIntakeInput } from './institutional-intake';

const INPUT: InstitutionalIntakeInput = {
  name: 'Pat Lee',
  email: 'pat@state.example',
  institution: 'State University',
  domain: 'state.example',
  system: 'sis',
  provider: 'Example SIS',
  dataMode: 'manual',
  launchWindow: 'next_term',
};

afterEach(() => vi.useRealTimers());

describe('institutional intake client', () => {
  it('sends only bounded discovery metadata and accepts a real receipt shape', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(
      JSON.stringify({ ok: true, reference: 'SL-0A1B2C3D4E' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    await expect(submitInstitutionalIntake(INPUT, {
      endpoint: 'https://example.test/functions/v1/lead-intake', fetcher,
    })).resolves.toEqual({ reference: 'SL-0A1B2C3D4E' });
    const [url, init] = fetcher.mock.calls[0] as Parameters<typeof fetch>;
    expect(url).toBe('https://example.test/functions/v1/lead-intake');
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit' });
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toEqual({
      route: 'plan_institution_launch',
      name: 'Pat Lee',
      email: 'pat@state.example',
      organization: 'State University',
      message: '',
      page: '/#/university/package',
      website: '',
      fields: {
        requested_domain: 'state.example',
        requested_system: 'sis',
        requested_provider: 'Example SIS',
        requested_product: 'semester_institutional',
        data_mode: 'manual',
        desired_launch_window: 'next_term',
      },
    });
  });

  it('does not accept malformed success, rejection, throttling, or uncertain delivery as saved', async () => {
    const call = (response: Response | Error) => submitInstitutionalIntake(INPUT, {
      endpoint: 'https://example.test/functions/v1/lead-intake',
      fetcher: vi.fn(async () => {
        if (response instanceof Error) throw response;
        return response;
      }),
    });
    await expect(call(new Response(JSON.stringify({ ok: true, reference: 'not-a-receipt' }), { status: 200 })))
      .rejects.toThrow(/could not verify/i);
    await expect(call(new Response(JSON.stringify({ ok: false, error: 'Choose a supported system category.' }), { status: 400 })))
      .rejects.toThrow('Choose a supported system category.');
    await expect(call(new Response('{}', { status: 403 }))).rejects.toThrow(/not permitted/i);
    await expect(call(new Response('{}', { status: 429, headers: { 'Retry-After': '3600' } })))
      .rejects.toThrow(/one hour/i);
    await expect(call(new Response('{}', { status: 502 }))).rejects.toThrow(/may or may not have arrived/i);
    await expect(call(new Error('network secret'))).rejects.toThrow(/may or may not have arrived/i);
  });

  it('times out a stalled transport as uncertain without retrying it', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const request = submitInstitutionalIntake(INPUT, {
      endpoint: 'https://example.test/functions/v1/lead-intake', fetcher, timeoutMs: 25,
    });
    const uncertain = expect(request).rejects.toThrow(/may or may not have arrived/i);
    await vi.advanceTimersByTimeAsync(25);
    await uncertain;
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('keeps the timeout active while an accepted response body is stalled', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => new Response(new ReadableStream({
      start(controller) {
        init?.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
      },
    }), { status: 200 }));
    const request = submitInstitutionalIntake(INPUT, {
      endpoint: 'https://example.test/functions/v1/lead-intake', fetcher, timeoutMs: 25,
    });
    const uncertain = expect(request).rejects.toThrow(/may or may not have arrived/i);
    await vi.advanceTimersByTimeAsync(25);
    await uncertain;
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
