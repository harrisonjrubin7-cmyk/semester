// Academic records workspace (Institution). Reuses the registrar parts of Semester's Final grades page: posting certified
// grades, corrections and transcripts; academic standing decisions and appeals; the institution's grading policy.
// Each panel authorizes on the server and hides itself when the viewer's role does not include it.
import { Registrar } from '../../../semester/src/pages/FinalGrades';
import { RegistrarStanding } from '../../../semester/src/components/AcademicStanding';
import GradingPolicyPanel from '../../../semester/src/components/GradingPolicyPanel';
import { PageHeader } from '../components/States';

export default function Records() {
  return (
    <div className="space-y-4">
      <PageHeader title="Academic records" sub="Official grades, corrections, transcripts, academic standing and the grading policy. A course grade from an instructor is not official until it is posted here by someone other than the person who certified it." />
      <Registrar />
      <RegistrarStanding />
      <GradingPolicyPanel />
      <p className="text-xs text-muted-foreground">If a panel is missing, your role does not include it.</p>
    </div>
  );
}
