// Front door: reuses the tested workflow from the main Semester app (decision C23 pattern) - one implementation, one data store.
import { createEndpoint } from 'zitejs/backend';
import shared from '../../../semester/src/api/budgetPlans';

export default createEndpoint({
  description: 'Budget and planning: fiscal-year plans, phased lines, two-person approval, variance against procurement commitments',
  authenticated: true,
  inputSchema: shared.inputSchema,
  outputSchema: shared.outputSchema,
  execute: (args) => shared.execute(args as never),
});
