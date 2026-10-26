// Front door: reuses the tested workflow from the main Semester app (decision C23 pattern) — one implementation, one data store.
import { createEndpoint } from 'zitejs/backend';
import shared from '../../../semester/src/api/help';

export default createEndpoint({
  description: 'Advising, tutoring and support: booking slots, support requests, caseload and referrals',
  authenticated: true,
  inputSchema: shared.inputSchema,
  outputSchema: shared.outputSchema,
  execute: (args) => shared.execute(args as never),
});
