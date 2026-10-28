// Final grades (Faculty): propose, release and certify the course grade for sections you teach. Posting the official
// academic record happens in Semester Institution, by a registrar who did not certify it.
import { Teaching } from '../../../semester/src/pages/FinalGrades';

export default function FinalGrades() {
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl">Final grades</h1>
        <p className="text-sm text-muted-foreground">The gradebook, the course grade you release, and the official grade are three separate records. Certifying sends the grade to the registrar; it is official only once posted.</p></div>
      <Teaching />
    </div>
  );
}
