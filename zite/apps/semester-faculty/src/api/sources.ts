// Front door: reuses the tested Sources workflow from the main Semester app — one implementation, one data store.
// Instructors add readings to a section's reading list here; enrolled students see them in Semester (Learn → Sources).
import { createEndpoint } from 'zitejs/backend';
import shared from '../../../semester/src/api/sources';

export default createEndpoint({
  description: 'Sources: keep readings and add them to a section reading list for enrolled students',
  authenticated: true,
  inputSchema: shared.inputSchema,
  outputSchema: shared.outputSchema,
  execute: (args) => shared.execute(args as never),
});
