import type { DataClass } from '../integration/classification';

export interface EducationDataRule {
  entity: string;
  fields: string;
  canonical: string;
  classification: DataClass;
  purpose: string;
  aiBoundary: string;
  controls: string[];
}

// Logical domain mapping, not an assertion that every field is an Edu-API
// v1.0 endpoint. Vendor-specific extensions require a versioned adapter.
export const EDUCATION_DATA_MAP: readonly EducationDataRule[] = [
  ['Person / identity', 'Identifier, institutional email, affiliation', 'Person / Identity / Affiliation', 'T3', 'Account access and authorized roles', 'Minimum identifiers only; no broad profile copy', 'PT-2 PT-3 AC-2 AC-6'],
  ['Organization', 'Institution, campus, department', 'Institution / Campus / Department', 'T0', 'Routing and authorization context', 'Public structure only', 'PT-3 SI-10'],
  ['Academic period', 'Term, session, start/end dates', 'Term / Session / AcademicCalendar', 'T0', 'Deadlines and planning', 'Official dates with source and freshness', 'SI-10 SI-12'],
  ['Program', 'Credential, pathway, program references', 'Program / Credential / Pathway', 'T0', 'Source-backed pathway comparison', 'Never certify completion from planning data', 'PT-3 SI-10'],
  ['Course', 'Catalog code, title, credits, prerequisites', 'Course / CatalogCourse', 'T0', 'Course and requirement search', 'Versioned catalog and effective dates', 'SI-10 CM-3'],
  ['Course offering', 'Section, meetings, location, instructor', 'CourseOffering / Section / Meeting', 'T1', 'Authorized course context', 'No seat or eligibility promise without live validation', 'AC-3 PT-3 SI-10'],
  ['Enrollment', 'Person, offering, status, role, effective dates', 'Enrollment / RoleAssignment', 'T3', 'Current course access and selected planning', 'Denied to routine AI; narrow authorized context only', 'AC-2 AC-3 PT-2 PT-3 SI-12'],
  ['Curriculum / requirement', 'Requirement references, official status, catalog year', 'Requirement / Rule / LearningPath', 'T3', 'Student-selected planning scenario', 'Official audit remains authoritative', 'PT-3 AC-3 SI-10'],
  ['Schedule preferences', 'Availability and student-entered constraints', 'AcademicPlan / Availability', 'T2', 'Optional private study planning', 'Selected context only; no behavior or risk inference', 'PT-3 PT-4'],
  ['Performance', 'Grades, mastery, feedback, assessment results', 'Result / Mastery / FinalGrade', 'T4', 'Separate institution-authorized workflow', 'Excluded from general integration ingestion and routine AI', 'PT-2 PT-3 PT-7 AC-6'],
  ['Finance / aid', 'Balance, charges, aid documents and eligibility', 'AccountStatus / ChargeReference / PaymentTask', 'T4', 'Official service link or approved workflow', 'No raw financial detail or eligibility inference in AI', 'PT-2 PT-3 PT-7 AC-6'],
  ['Holds / alerts', 'Office and official action link; reason excluded', 'RegistrationHold', 'T3', 'Neutral official support routing', 'Minimized status only; no automated analysis', 'PT-3 PT-7 AC-3'],
  ['Appointments / cases', 'Participant, appointment, notes visibility', 'Appointment / CaseReference', 'T3', 'Authorized support and continuity', 'Private notes separate; time-bound participant access', 'PT-3 PT-4 AC-3 AU-12'],
  ['Competency / artifact', 'Student-selected skill, evidence and reflection', 'EvidenceClaim / Artifact / Competency', 'T2', 'Portfolio or selected advisor share', 'No automatic employer exposure or inferred achievement', 'PT-3 PT-4 AC-3 SI-10'],
  ['Entitlement / resource events', 'Library/lab access reference and expiry', 'ResourceEntitlement / AccessGrant', 'T3', 'Resource access routing', 'No surveillance profile or individual behavior ranking', 'AC-3 PT-3 SI-12'],
  ['Sensitive attachments', 'Identity, accommodation, health, conduct documents', 'Authorized service reference only', 'T6', 'Separate restricted service', 'Never general-purpose storage, indexing or AI retrieval', 'PT-2 PT-7 AC-3 SC-28'],
].map(([entity, fields, canonical, classification, purpose, aiBoundary, controls]) => ({
  entity, fields, canonical, classification: classification as DataClass, purpose, aiBoundary, controls: controls.split(' '),
}));
