// Front door: reuses the tested workflow from the main Semester app (decision C23 pattern) - one implementation, one data store.
import { createEndpoint } from 'zitejs/backend';
import shared from '../../../semester/src/api/grants';

export default createEndpoint({
  description: 'Grants and sponsored projects: recorded awards, second-officer verification, spend reports',
  authenticated: true,
  inputSchema: shared.inputSchema,
  outputSchema: shared.outputSchema,
  execute: (args) => shared.execute(args as never),
});
