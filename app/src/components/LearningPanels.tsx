import {FeedbackInbox} from './FeedbackInbox';
import {LearningMap} from './LearningMap';
import {CourseAgreement} from './CourseAgreement';
import {LearningInsights} from './LearningInsights';
import {LearningPreferences} from './LearningPreferences';
import {OfficeAgenda} from './OfficeAgenda';
/** The six learning panels. Loaded on first open by `LearningHub`, so Study does not carry them until they are wanted. */
export function LearningPanels(){
 return <><LearningMap/><FeedbackInbox/><LearningInsights/><OfficeAgenda/><CourseAgreement/><LearningPreferences/></>;
}
