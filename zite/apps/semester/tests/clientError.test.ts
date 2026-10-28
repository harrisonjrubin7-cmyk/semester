import { test, eq } from './harness';
import { readError, friendlyError } from '../src/lib/clientError';

const call = (status: number, body: unknown) => new Error(`API call failed (${status}): ${typeof body === 'string' ? body : JSON.stringify(body)}`);

test('the Institution overview 403 shows the server’s plain message, never the internal authz string', () => {
  const e = call(403, { error: { code: 'FORBIDDEN', message: 'authz:role:readiness.read:9f0024b4-c030-4b6a-9e1f-2d7c5f1a0b11', userFacingMessage: 'Your role does not allow this. (Reference 9f0024b4)' } });
  const r = readError(e);
  eq([r.message, r.denied, r.reference, r.status], ['Your role does not allow this. (Reference 9f0024b4)', true, '9f0024b4', 403]);
});
test('without a userFacingMessage, an internal authz string becomes a safe denial with a reference', () => {
  const r = readError(call(403, { message: 'authz:role:readiness.read:079b99a5-d268-4c3e-8a77-0f6a5b2c9d10' }));
  eq(r.message, 'You don’t have access to this. (Reference 079b99a5)');
  eq(readError(new Error('authz:role:readiness.read:079b99a5-d268-4c3e-8a77-0f6a5b2c9d10')).message, 'You don’t have access to this. (Reference 079b99a5)');
});
test('a deliberate, human sentence from the server is shown as written', () => {
  eq(friendlyError(call(400, { error: { message: 'Only the instructor of record manages extensions.' } })), 'Only the instructor of record manages extensions.');
  eq(friendlyError(call(400, 'The new due date must be after the assignment due date.')), 'The new due date must be after the assignment due date.');
});
test('server faults, SQL text, stack traces and HTML bodies are never shown', () => {
  eq(friendlyError(call(500, { message: 'duplicate key value violates unique constraint "x"' })), 'This is temporarily unavailable. Try again in a moment.');
  eq(friendlyError(call(500, '<html><body>Bad gateway</body></html>')), 'This is temporarily unavailable. Try again in a moment.');
  eq(friendlyError(call(400, { message: 'TypeError: cannot read x at foo (bar.js:1:2)' })), 'Something went wrong. Try again.');
  eq(friendlyError(call(404, '')), 'This could not be found.');
  eq(readError(call(503, '')).unavailable, true);
});
test('control: errors already carrying a userFacingMessage (server-side calls) keep it', () => {
  const e = Object.assign(new Error('authz:role:x:00000000-0000-0000-0000-000000000000'), { userFacingMessage: 'Your role does not allow this. (Reference 00000000)' });
  eq(friendlyError(e), 'Your role does not allow this. (Reference 00000000)');
  eq(friendlyError(undefined), 'Something went wrong. Try again.');
});
