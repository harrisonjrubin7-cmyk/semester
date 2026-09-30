import {FeedbackInbox} from './FeedbackInbox';
import {LearningMap} from './LearningMap';
import {CourseAgreement} from './CourseAgreement';
import {LearningInsights} from './LearningInsights';
import {LearningPreferences} from './LearningPreferences';
import {OfficeAgenda} from './OfficeAgenda';
/**
 * The six learning panels under one heading, so Study carries one closed row
 * for them instead of five. Each is still its own panel with its own private
 * store; this only decides where they sit. `portal-workspace` for the same
 * reason as the panels inside it: classless buttons are styled by that scope.
 */
export function LearningHub(){
 return <details className="portal-workspace portal-panel learning-hub"><summary>Learning</summary><p>Your concepts and start-here check, feedback you received, what each course allows, what you have covered, a list to bring to office hours, and how you like to study. All of it stays on this device.</p><LearningMap/><FeedbackInbox/><LearningInsights/><OfficeAgenda/><CourseAgreement/><LearningPreferences/></details>;
}
