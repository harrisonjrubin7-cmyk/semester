// Front door: reuses the tested workflow from the main Semester app (decision C23 pattern) — one implementation, one data store.
import { createEndpoint } from 'zitejs/backend';
import shared from '../../../semester/src/api/courseReuse';

export default createEndpoint({
  description: 'Reuse a course in a new term: copies the teaching shell into a new section; student data never copies (shared)',
  authenticated: true,
  inputSchema: shared.inputSchema,
  outputSchema: shared.outputSchema,
  execute: (args) => shared.execute(args as never),
});
