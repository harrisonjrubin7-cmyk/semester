import { describe, expect, it, vi } from 'vitest';
import {
  authenticateLtiLaunchRequest,
  type LtiAuthStep,
  type LtiLaunchAuthDependencies,
} from '../../../supabase/functions/_shared/ltiauth';

interface Spent {
  issuer: string;
  client_id: string;
  nonce: string;
}

interface Registration {
  issuer: string;
  clientId: string;
}

interface Verified {
  subject: string;
}

const success = <T>(value: T): LtiAuthStep<T> => ({ ok: true, value });
const failure = (reason: string, detail = reason, status?: number): LtiAuthStep<never> => ({
  ok: false,
  reason,
  detail,
  status,
});

const spent: Spent = { issuer: 'https://lms.example', client_id: 'client', nonce: 'nonce' };
const registration: Registration = { issuer: spent.issuer, clientId: spent.client_id };
const verified: Verified = { subject: 'student' };

function request(method = 'POST') {
  return new Request('https://functions.example/lti/launch', { method });
}

function harness(values: Record<string, string> = { state: 'state', id_token: 'token' }) {
  const order: string[] = [];
  const readParams = vi.fn(async () => {
    order.push('params');
    return values;
  });
  const spend = vi.fn(async () => {
    order.push('spend');
    return success(spent);
  });
  const loadRegistration = vi.fn(async () => {
    order.push('registration');
    return success(registration);
  });
  const verify = vi.fn(async () => {
    order.push('verify');
    return success(verified);
  });
  const refuse = vi.fn((reason: string, detail: string, status = 400) =>
    Response.json({ reason, detail }, { status }));

  const dependencies: LtiLaunchAuthDependencies<Spent, Registration, Verified> = {
    readParams,
    spend,
    loadRegistration,
    verify,
    refuse,
  };
  return { dependencies, order, readParams, spend, loadRegistration, verify, refuse };
}

describe('LTI launch authentication boundary', () => {
  it('rejects a non-POST launch before reading input or protected state', async () => {
    const h = harness();

    const response = await authenticateLtiLaunchRequest(request('GET'), h.dependencies);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(405);
    expect(h.order).toEqual([]);
  });

  it.each([
    [{ id_token: 'token' }, 'no-state'],
    [{ state: 'state' }, 'no-token'],
    [{ state: '   ', id_token: 'token' }, 'no-state'],
    [{ state: 'state', id_token: '   ' }, 'no-token'],
  ])('rejects missing launch proof before spending state', async (values, reason) => {
    const h = harness(values);

    const response = await authenticateLtiLaunchRequest(request(), h.dependencies);

    expect(response).toBeInstanceOf(Response);
    expect(await (response as Response).json()).toMatchObject({ reason });
    expect(h.order).toEqual(['params']);
  });

  it.each([
    [failure('spend-failed', 'database unavailable', 500), 500],
    [failure('stale-state', 'already spent'), 400],
  ])('rejects an unspendable or replayed state before registration lookup', async (outcome, status) => {
    const h = harness();
    h.spend.mockResolvedValueOnce(outcome);

    const response = await authenticateLtiLaunchRequest(request(), h.dependencies);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(status);
    expect(h.order).toEqual(['params']);
    expect(h.spend).toHaveBeenCalledOnce();
    expect(h.loadRegistration).not.toHaveBeenCalled();
  });

  it('rejects a missing registration before signature verification', async () => {
    const h = harness();
    h.loadRegistration.mockResolvedValueOnce(failure('registration-gone', 'missing', 500));

    const response = await authenticateLtiLaunchRequest(request(), h.dependencies);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(500);
    expect(h.order).toEqual(['params', 'spend']);
    expect(h.loadRegistration).toHaveBeenCalledOnce();
    expect(h.verify).not.toHaveBeenCalled();
  });

  it.each(['bad-header', 'bad-signature', 'bad-claims'])('rejects %s before protected launch work', async (reason) => {
    const h = harness();
    h.verify.mockResolvedValueOnce(failure(reason, 'not verified', 401));

    const response = await authenticateLtiLaunchRequest(request(), h.dependencies);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(401);
    expect(h.order).toEqual(['params', 'spend', 'registration']);
    expect(h.verify).toHaveBeenCalledOnce();
  });

  it('returns only an accepted launch after state, registration and token verification', async () => {
    const h = harness();

    const result = await authenticateLtiLaunchRequest(request(), h.dependencies);

    expect(result).toEqual({ spent, registration, verified });
    expect(h.order).toEqual(['params', 'spend', 'registration', 'verify']);
    expect(h.spend).toHaveBeenCalledWith('state');
    expect(h.verify).toHaveBeenCalledWith('token', registration, spent);
    expect(h.refuse).not.toHaveBeenCalled();
  });
});
