export interface LtiAuthFailure {
  ok: false;
  reason: string;
  detail: string;
  status?: number;
}

export interface LtiAuthSuccess<T> {
  ok: true;
  value: T;
}

export type LtiAuthStep<T> = LtiAuthFailure | LtiAuthSuccess<T>;

export interface LtiLaunchAuthDependencies<Spent, Registration, Verified> {
  readParams(req: Request): Promise<Record<string, string>>;
  spend(state: string): Promise<LtiAuthStep<Spent>>;
  loadRegistration(spent: Spent): Promise<LtiAuthStep<Registration>>;
  verify(token: string, registration: Registration, spent: Spent): Promise<LtiAuthStep<Verified>>;
  refuse(reason: string, detail: string, status?: number): Response;
}

export interface LtiLaunchAuthentication<Spent, Registration, Verified> {
  spent: Spent;
  registration: Registration;
  verified: Verified;
}

const rejected = (failure: LtiAuthFailure, refuse: LtiLaunchAuthDependencies<never, never, never>['refuse']) =>
  refuse(failure.reason, failure.detail, failure.status);

/**
 * Execute the LTI launch credential boundary before any launch-side account,
 * membership, context, grade or session work is allowed to run.
 */
export async function authenticateLtiLaunchRequest<Spent, Registration, Verified>(
  req: Request,
  dependencies: LtiLaunchAuthDependencies<Spent, Registration, Verified>,
): Promise<Response | LtiLaunchAuthentication<Spent, Registration, Verified>> {
  if (req.method !== 'POST') return dependencies.refuse('not-post', `Launch arrived as ${req.method}.`, 405);

  const values = await dependencies.readParams(req);
  const state = (values.state ?? '').trim();
  const token = (values.id_token ?? '').trim();
  if (!state) return dependencies.refuse('no-state', 'The launch carried no state.');
  if (!token) return dependencies.refuse('no-token', 'The launch carried no id_token.');

  const spent = await dependencies.spend(state);
  if (!spent.ok) return rejected(spent, dependencies.refuse);

  const registration = await dependencies.loadRegistration(spent.value);
  if (!registration.ok) return rejected(registration, dependencies.refuse);

  const verified = await dependencies.verify(token, registration.value, spent.value);
  if (!verified.ok) return rejected(verified, dependencies.refuse);

  return { spent: spent.value, registration: registration.value, verified: verified.value };
}
