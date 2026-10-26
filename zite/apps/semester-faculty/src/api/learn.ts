// Front door: reuses the tested workflow from the main Semester app (decision C23 pattern) — one implementation, one data store.
import { createEndpoint } from 'zitejs/backend';
import shared from '../../../semester/src/api/learn';

export default createEndpoint({
  description: 'Course spaces: sections, assignments, private drafts, submissions, grading and release',
  authenticated: true,
  inputSchema: shared.inputSchema,
  outputSchema: shared.outputSchema,
  execute: (args) => shared.execute(args as never),
});
