// Front door: reuses the tested study-guide workflow from the main Semester app — one implementation, one data store.
// Instructors publish here; their enrolled students see the guide in Semester (Learn → Study guides).
import { createEndpoint } from 'zitejs/backend';
import shared from '../../../semester/src/api/guides';

export default createEndpoint({
  description: 'Study guides: write a guide for a section and publish it to enrolled students',
  authenticated: true,
  inputSchema: shared.inputSchema,
  outputSchema: shared.outputSchema,
  execute: (args) => shared.execute(args as never),
});
