import { test, eq } from './harness';
import { buildPackage, canonical, missing, dimensions } from '../src/lib/applicationRules';

const d = { institutionId: 'i1', institution: 'Northgate', program: ' Nursing BSN ', entryTerm: 'Fall 2027', statement: 'x'.repeat(220), documents: [{ url: 'u1', filename: 't.pdf' }] };
test('the package carries only recipient, program, term, statement and documents (control)', () => {
  eq(Object.keys(buildPackage(d)), ['recipient', 'program', 'entryTerm', 'statement', 'documents']);
  eq(buildPackage(d).program, 'Nursing BSN');
});
test('canonical JSON does not depend on key order', () => { eq(canonical({ b: 1, a: [{ y: 2, x: 1 }] }), canonical({ a: [{ x: 1, y: 2 }], b: 1 })); });
test('missing items are named', () => { eq(missing({ ...d, statement: 'short', documents: [], program: '' }), ['a statement of at least 200 characters', 'a transcript', 'a program']); });
test('delivery is never "received" without an institution receipt', () => {
  eq(dimensions({ status: 'Submitted', mode: 'native', received: false, missing: 0 }).delivery, 'Not confirmed');
  eq(dimensions({ status: 'Submitted', mode: 'native', received: true, missing: 0 }).delivery, 'Received by the institution');
  eq(dimensions({ status: 'Submitted', mode: 'planning', received: false, missing: 0 }).delivery, 'Outside Semester');
  eq(dimensions({ status: 'Admitted', mode: 'native', received: true, missing: 0 }).decision, 'Released: Admitted');
});
