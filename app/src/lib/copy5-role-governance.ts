export type Copy5RoleStatus =
  | 'exact'
  | 'candidate_alias'
  | 'contextual_variant'
  | 'governance_decision'
  | 'roadmap'
  | 'delegated_grant';

export interface Copy5RoleProposal {
  id: string;
  title: string;
  family: string;
  candidateRoles: string[];
  status: Copy5RoleStatus;
  requiredDecision: string;
}

const SOURCE = `sem_support\tSemester support operator\tPlatform operations\tsupport_agent\tcandidate_alias\tConfirm support session scope, expiry, audit and allowed capabilities; do not inherit student-record access
sem_security\tSemester security operator\tPlatform operations\tincident_responder|platform_admin\tgovernance_decision\tSplit incident response from platform administration; map each Copy 5 capability explicitly
sem_product\tSemester product operator\tPlatform operations\tcontent_owner|platform_admin\tgovernance_decision\tDefine a release/feature-flag operator role or prove existing roles are sufficient; no implicit data access
sem_privacy\tSemester privacy/legal operator\tPlatform operations\ttrust_officer|compliance_owner\tgovernance_decision\tSeparate privacy-case handling, legal holds and compliance oversight
sem_impl\tSemester implementation lead\tPlatform operations\timplementation_manager\tcandidate_alias\tConfirm tenant onboarding and cutover scope; preserve tenant isolation
inst_it\tInstitutional IT\tInstitution administration\tintegration_admin|university_admin\tgovernance_decision\tSplit integration/identity administration from broad tenant administration
inst_sec\tInstitutional security/privacy\tInstitution administration\ttrust_officer|compliance_owner\tgovernance_decision\tChoose tenant-scoped security and privacy ownership; require read-only audit where applicable
inst_exec\tInstitutional executive\tInstitution administration\tdean|university_admin|institutional_researcher\tgovernance_decision\tCreate an aggregate-only projection or map to a strictly aggregate existing role
inst_audit\tInstitutional auditor\tInstitution administration\ttrust_officer|compliance_owner\tgovernance_decision\tDefine time-boxed read-only evidence scope; do not reuse an operational role
student\tStudent\tStudents\tstudent\texact\tRetain canonical student role and map only self-scoped capabilities
transfer\tTransfer student\tStudents\ttransfer_student\tcandidate_alias\tConfirm whether this remains a distinct app role or a student context/profile attribute
online\tOnline student\tStudents\tstudent\tcontextual_variant\tTreat delivery mode as context unless a distinct permission bundle is justified
adult\tAdult learner\tStudents\tstudent\tcontextual_variant\tTreat learner demographic/scheduling needs as context unless permissions differ
grad\tGraduate student\tStudents\tgraduate_student\tcandidate_alias\tConfirm distinct research/assistantship permissions and scope
intl\tInternational student\tStudents\tstudent\tcontextual_variant\tKeep student identity separate from international_student_advisor staff authority
athlete\tStudent athlete\tStudents\tstudent\tcontextual_variant\tUse consented athletic context/capabilities; avoid a broad identity-derived role
worker\tStudent worker\tStudents\tstudent\tcontextual_variant\tModel campus employment as a scoped assignment, not blanket student authority
parent\tStudent parent/caregiver\tStudents\tstudent\tcontextual_variant\tTreat caregiving status as context; do not create elevated access
advisor\tAcademic advisor\tAdvising & registrar\tacademic_advisor\tcandidate_alias\tConfirm caseload and student-consent boundaries
success\tStudent success staff\tAdvising & registrar\tfirst_year_staff|university_staff\tgovernance_decision\tChoose a canonical owner and define opt-in outreach/referral scope
registrar\tRegistrar staff\tAdvising & registrar\tregistrar\texact\tRetain canonical registrar role; map record and release capabilities explicitly
progdir\tProgram director\tAdvising & registrar\tdepartment_admin|department_chair\tgovernance_decision\tDecide whether program planning differs from department administration/chair authority
faculty\tFaculty/instructor\tFaculty & TA\tfaculty\texact\tRetain course/section scoping and explicit grade-release controls
ta\tTeaching assistant\tFaculty & TA\tteaching_assistant\tcandidate_alias\tRetain assigned-section scope and prohibit release/administrative authority by default
chair\tDepartment chair\tFaculty & TA\tdepartment_chair\tcandidate_alias\tConfirm department scope and grade-change approval separation
finaid\tFinancial aid staff\tStudent services & affairs\tfinancial_aid_officer\tcandidate_alias\tMap restricted financial-aid records and appeal authority explicitly
accounts\tStudent accounts staff\tStudent services & affairs\tstudent_accounts_officer\tcandidate_alias\tMap billing/payment/refund duties and approval thresholds explicitly
admissions\tAdmissions staff\tStudent services & affairs\t\troadmap\tExisting reconciliation marks admissions as roadmap; no grant until a canonical role and policy are approved
housing\tHousing staff\tStudent services & affairs\tresidence_life_staff\tcandidate_alias\tConfirm assignment/request scope and exclude unrelated academic records
dining\tDining/campus-card staff\tStudent services & affairs\tdining_staff\tcandidate_alias\tConfirm meal-plan/card scope and tenant boundaries
library\tLibrary staff\tStudent services & affairs\tlearning_center_staff|university_staff\tgovernance_decision\tAdd or select a library-specific canonical role; do not broaden a generic staff role
access\tAccessibility/disability services\tStudent services & affairs\tdisability_services_officer|disability_services_staff\tgovernance_decision\tSeparate case authority from service/support duties; protect accommodation records
counsel\tCounseling/wellbeing staff\tStudent services & affairs\tcounseling_liaison\tcandidate_alias\tKeep clinical records outside Semester; map appointment/referral metadata only
career\tCareer staff\tStudent services & affairs\tcareer_center_staff|career_coach\tgovernance_decision\tSeparate center administration from coaching/caseload authority
safety\tCampus safety staff\tStudent services & affairs\t\troadmap\tExisting reconciliation marks campus safety as roadmap; define incident-data boundary before creating a role
moderator\tCommunity moderator\tStudent services & affairs\tmoderator\texact\tRetain audited moderation scope and prohibit unrelated private-record access
orgleader\tStudent organization leader\tStudent services & affairs\torganization_admin|organization_officer\tgovernance_decision\tChoose officer versus administrator based on membership and budget authority
peer\tPeer mentor\tStudent services & affairs\tpeer_mentor\tcandidate_alias\tRequire assigned-mentee and student-shared context
prospect\tProspective student\tExternal contexts\tprospective_student\tcandidate_alias\tRetain public/prospect scope only
applicant\tApplicant\tExternal contexts\t\troadmap\tExisting reconciliation marks applicant as roadmap; do not substitute admitted_student
alumni\tAlumni\tExternal contexts\talumni\texact\tRetain alumni-owned data and public/community boundaries
family\tFamily/guardian\tExternal contexts\t\tdelegated_grant\tRepository explicitly models family as a student-issued revocable grant, not a durable app role
employer\tEmployer\tExternal contexts\temployer\texact\tRetain verification and student-discoverability consent boundaries
mentor\tMentor\tExternal contexts\tpeer_mentor|research_partner\tgovernance_decision\tPrefer a relationship grant; define mentor type and student-shared scope before mapping
developer\tDeveloper/partner\tPartners & developers\tmarketplace_partner|integration_admin\troadmap\tExisting reconciliation keeps developer/partner access roadmap; require OAuth scopes, sandbox and review
sem_csm\tSemester customer-success manager\tCompany & investor\tcustomer_success\tcandidate_alias\tRestrict to tenant-health/adoption aggregates unless a time-boxed support grant is separately approved
sem_revops\tSemester revenue operations\tCompany & investor\taccount_executive|business_admin\tgovernance_decision\tSeparate pipeline/contracts from finance approval and student data
sem_fin\tSemester finance operator\tCompany & investor\tfinance_operator\tcandidate_alias\tRetain company-finance boundary; no student finance access by implication
sem_exec\tSemester executive\tCompany & investor\tbusiness_admin|portfolio_council\tgovernance_decision\tProvide aggregate-only company projections rather than operational or student access
investor\tInvestor / board member\tCompany & investor\tportfolio_council\tgovernance_decision\tDefine board-portal read-only aggregate scope, expiry and evidence
buyer\tInstitution buyer\tCompany & investor\tbilling_contact\tgovernance_decision\tKeep trust-room/pricing/pilot evaluation separate from tenant administration and student records`;

export const COPY5_ROLE_PROPOSALS: readonly Copy5RoleProposal[] = SOURCE.split('\n').map((line) => {
  const [id, title, family, candidates, status, requiredDecision] = line.split('\t');
  return {
    id,
    title,
    family,
    candidateRoles: candidates ? candidates.split('|') : [],
    status: status as Copy5RoleStatus,
    requiredDecision,
  };
});

const STATUS_LABEL: Record<Copy5RoleStatus, string> = {
  exact: 'Exact identifier match · not activation evidence',
  candidate_alias: 'Candidate alias · governance approval required',
  contextual_variant: 'Contextual variant · not a durable role',
  governance_decision: 'Governance decision required',
  roadmap: 'Planned only · no active role',
  delegated_grant: 'Delegated grant · not a durable role',
};

export function proposalMatchLabel(proposal: Copy5RoleProposal): string {
  return STATUS_LABEL[proposal.status];
}
