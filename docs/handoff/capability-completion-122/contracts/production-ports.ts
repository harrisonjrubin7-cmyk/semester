// Proposed integration ports, not verified repository types or endpoints.
// No domain writes should execute until these ports map to canonical server systems.
export interface Target {tenant:string;sha:string;environment:string;cohort:string;dataMode:string}
export interface VerifiedActor {id:string;sessionId:string;tenant:string;purpose:string}
export interface Intent {capability:string;command:string;objectId:string;expectedVersion:number;idempotencyKey:string;payload:unknown;approvalRef?:string}
export interface Decision {allowed:boolean;reason:string;policyVersion:string;authorityRef:string}
export interface Receipt {id:string;tenant:string;objectId:string;committedVersion:number;commandId:string;recovery:string}
export interface IdentityPort {resolveVerifiedActor(request:unknown):Promise<VerifiedActor>}
export interface PolicyPort {authorize(actor:VerifiedActor,intent:Intent,target:Target):Promise<Decision>}
export interface SourcePort {readAuthorizedCurrent(actor:VerifiedActor,objectId:string):Promise<{version:number;authority:string;sourceAt:string;fresh:boolean}>}
export interface ApprovalPort {verifyExactBinding(actor:VerifiedActor,intent:Intent,target:Target):Promise<Decision>}
export interface TransactionPort {
 // Atomic canonical domain state + idempotency record + outbox write.
 // Conflicting key/payload rejects; retries return original durable receipt.
 executeAtomic(actor:VerifiedActor,intent:Intent,decision:Decision):Promise<Receipt>;
}
export interface ProjectionPort {readAuthorized(actor:VerifiedActor,capability:string):Promise<unknown>;reconcile(eventId:string):Promise<void>}
export interface EvidencePort {evaluateExactRelease(target:Target,capability:string):Promise<Decision>}
// Implementation deliberately absent here: map canonical systems before wiring.
// Browser-provided tenant/actor/grants and local checklist entries are untrusted.
