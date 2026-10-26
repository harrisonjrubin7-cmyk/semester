// Front door: reuses the tested workflow from the main Semester app (decision C23 pattern) — one implementation, one data store.
import { createEndpoint } from 'zitejs/backend';
import shared from '../../../semester/src/api/assessments';

export default createEndpoint({
  description: 'Course assessments: author and publish frozen question versions, take attempts within a window, auto-score choice questions, grade short answers, release',
  authenticated: true,
  inputSchema: shared.inputSchema,
  outputSchema: shared.outputSchema,
  execute: (args) => shared.execute(args as never),
});
