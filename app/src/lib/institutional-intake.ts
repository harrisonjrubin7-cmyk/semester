export const INSTITUTION_SYSTEMS = [
  ['identity', 'Identity / SSO'],
  ['lms', 'Learning management system'],
  ['sis', 'Student information system'],
  ['catalog', 'Course catalog'],
  ['degree_audit', 'Degree audit'],
  ['other', 'Other institutional system'],
] as const;

export const INSTITUTION_LAUNCH_WINDOWS = [
  ['this_term', 'This term'],
  ['next_term', 'Next term'],
  ['within_12_months', 'Within 12 months'],
  ['exploring', 'Exploring; no target date'],
] as const;

export type InstitutionSystem = typeof INSTITUTION_SYSTEMS[number][0];
export type InstitutionDataMode = 'manual' | 'connected';
export type InstitutionLaunchWindow = typeof INSTITUTION_LAUNCH_WINDOWS[number][0];

export interface InstitutionalIntakeInput {
  name: string;
  email: string;
  institution: string;
  domain: string;
  system: InstitutionSystem;
  provider: string;
  dataMode: InstitutionDataMode;
  launchWindow: InstitutionLaunchWindow;
}

export interface InstitutionalIntakeReceipt { reference: string }

export interface InstitutionalIntakeOptions {
  endpoint?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

const configuredEndpoint = (): string => {
  const base = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
  return base ? `${base}/functions/v1/lead-intake` : '';
};

/**
 * Submit discovery metadata. This endpoint returns a receipt only; it cannot
 * authenticate ownership, activate a tenant, connect a provider, or retrieve
 * a request later. There is deliberately no automatic retry: after a network
 * interruption the caller cannot know whether the first POST was accepted.
 */
export async function submitInstitutionalIntake(
  input: InstitutionalIntakeInput,
  options: InstitutionalIntakeOptions = {},
): Promise<InstitutionalIntakeReceipt> {
  const endpoint = options.endpoint ?? configuredEndpoint();
  if (!endpoint) throw new Error('Institutional request intake is not configured in this build.');

  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  try {
    response = await (options.fetcher ?? fetch)(endpoint, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        route: 'plan_institution_launch',
        name: input.name.trim(),
        email: input.email.trim(),
        organization: input.institution.trim(),
        message: '',
        page: '/#/university/package',
        website: '',
        fields: {
          requested_domain: input.domain.trim(),
          requested_system: input.system,
          requested_provider: input.provider.trim(),
          requested_product: 'semester_institutional',
          data_mode: input.dataMode,
          desired_launch_window: input.launchWindow,
        },
      }),
    });
  } catch {
    clearTimeout(timeout);
    throw new Error('The request may or may not have arrived. Do not submit it again automatically; check before retrying.');
  }

  let body: Record<string, unknown> = {};
  try {
    const value: unknown = await response.json();
    if (value && typeof value === 'object' && !Array.isArray(value)) body = value as Record<string, unknown>;
  } catch {
    if (controller.signal.aborted) {
      throw new Error('The request may or may not have arrived. Do not submit it again automatically; check before retrying.');
    }
  } finally {
    clearTimeout(timeout);
  }
  if (response.ok && body.ok === true && typeof body.reference === 'string' && /^SL-[0-9A-F]{10}$/.test(body.reference)) {
    return { reference: body.reference };
  }
  if (response.status === 400 && typeof body.error === 'string' && body.error) throw new Error(body.error);
  if (response.status === 403) throw new Error('This app origin is not permitted to send institutional requests.');
  if (response.status === 429) {
    const retry = response.headers.get('Retry-After');
    throw new Error(retry === '3600' ? 'Too many requests. Wait one hour before trying again.' : 'Too many requests. Try again later.');
  }
  if (response.ok) throw new Error('Semester accepted a response that this app could not verify. Do not resubmit automatically.');
  if (response.status >= 500) {
    throw new Error('The request may or may not have arrived. Do not submit it again automatically; check before retrying.');
  }
  throw new Error('Semester could not accept the request. Nothing has been marked as received.');
}
