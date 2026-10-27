// Front door: the shared app switcher for the Semester education operating system — one account, one directory.
import { createEndpoint } from 'zitejs/backend';
import shared from '../../../semester/src/api/appDirectory';

export default createEndpoint({
  description: 'App directory: which Semester apps the signed-in person can use, with links',
  authenticated: true,
  inputSchema: shared.inputSchema,
  outputSchema: shared.outputSchema,
  execute: (args) => shared.execute(args as never),
});
