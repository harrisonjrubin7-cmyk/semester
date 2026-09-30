import {Fragment} from 'react';
import {useStore} from '../state/store';
import {FeedbackInbox} from './FeedbackInbox';
import {LearningMap} from './LearningMap';
import {CourseAgreement} from './CourseAgreement';
import {LearningInsights} from './LearningInsights';
import {LearningPreferences} from './LearningPreferences';
import {OfficeAgenda} from './OfficeAgenda';
/**
 * The six learning panels. Loaded on first open by `LearningHub`, so Study does
 * not carry them until they are wanted.
 *
 * Keyed by account and term as a group: the panels hold a student's unsaved
 * text (an agenda in progress, a typed question) in component state, and on a
 * shared device the store can switch account or term while they are mounted.
 * Without the key the next person would see, and could export, what the last
 * one was writing.
 */
export function LearningPanels(){
 const {state,account}=useStore();
 return <Fragment key={`${account?.id||'device'}:${state.term}`}><LearningMap/><FeedbackInbox/><LearningInsights/><OfficeAgenda/><CourseAgreement/><LearningPreferences/></Fragment>;
}
