/**
 * The one door to `packages/institution`.
 *
 * The institution package owns the policy decision point, the event catalog
 * and envelope, and the workflow machines (ADRs 0007–0009). This package
 * builds the platform around them and must not fork them, so it reaches them
 * here and nowhere else — `architecture.test.ts` refuses a second import. If
 * the institution package renames something, one file changes.
 */
export {
  ACTOR_TYPES,
  CORRELATION_ID_PATTERN,
  MFA_LEVELS,
  POLICY_ACTIONS,
  POLICY_ENVIRONMENTS,
  TENANT_VERIFICATIONS,
  EVENT_TYPES,
  RESOURCE_CLASSIFICATIONS,
  MemoryOutbox,
  MemoryReceiptLedger,
  applyObligations,
  decide,
  isPolicyAction,
  drainOutbox,
  isEventType,
  makeEvent,
  processOnce,
  transition,
  validateEvent,
} from '../../../institution/src/index.ts';

export type {
  ActorType,
  AuthorizationDecision,
  AuthorizationRequest,
  ConsentGrant,
  EventType,
  MfaLevel,
  OutboxRow,
  OutboxStore,
  PolicyEnvironment,
  PolicyObligation,
  ReceiptLedger,
  ResourceClassification,
  RetentionClass,
  RoleGrant,
  SemesterEvent,
  TenantVerification,
  UserAction,
  WorkflowDefinition,
} from '../../../institution/src/index.ts';
