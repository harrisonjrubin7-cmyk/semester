// Front door: reuses the tested workflow from the main Semester app (decision C23, option a) — one implementation, one data store.
import { createEndpoint } from 'zitejs/backend';
import shared from '../../../semester/src/api/sectionRequests';

export default createEndpoint({
  description: 'New course section requests: chair review, registrar authorization, section creation and reconciliation',
  authenticated: true,
  inputSchema: shared.inputSchema,
  outputSchema: shared.outputSchema,
  execute: (args) => shared.execute(args as never),
});
