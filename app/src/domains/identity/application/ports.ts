import type { IdentityFacts } from '../domain/subject';

/** Where identity comes from. Implemented in `adapters/`; here only as the shape the use case needs. */
export interface IdentitySource {
  read(): IdentityFacts;
}
