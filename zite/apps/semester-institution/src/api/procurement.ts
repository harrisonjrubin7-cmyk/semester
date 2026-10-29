// Front door: reuses the tested workflow from the main Semester app (decision C23 pattern) - one implementation, one data store.
import { createEndpoint } from 'zitejs/backend';
import shared from '../../../semester/src/api/procurement';

export default createEndpoint({
  description: 'Procurement: budgets, requisitions, approvals, purchase orders, receiving, invoices and the supplier portal links',
  authenticated: true,
  inputSchema: shared.inputSchema,
  outputSchema: shared.outputSchema,
  execute: (args) => shared.execute(args as never),
});
