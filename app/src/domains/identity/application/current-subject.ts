import { makeSubject, type Subject } from '../domain/subject';
import type { IdentitySource } from './ports';

/** The subject right now. Read each time: sign-in, sign-out and a role change all happen while the app is open. */
export const currentSubject = (source: IdentitySource): Subject => makeSubject(source.read());
