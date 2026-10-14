// Proposed ports, not deployed endpoints or canonical repository type assertions.
export interface Target { tenant:string; sha:string; environment:string; cohort:string; dataMode:string }
export interface Actor { id:string; tenant:string; session:string; purpose:string }
export interface Command { capability:string; command:string; objectId:string; expectedVersion:number; idempotencyKey:string; payload:unknown; approvalRef?:string }
export interface Decision { allowed:boolean; reason:string; authorityRef:string; policyVersion:string }
export interface Receipt { id:string; objectId:string; committedVersion:number; authorityRef:string; recovery:string }
export interface IdentityPort { resolveVerified(request:unknown):Promise<Actor> }
export interface PolicyPort { authorize(actor:Actor,command:Command,target:Target):Promise<Decision> }
export interface ApprovalPort { verifyExactBinding(actor:Actor,command:Command,target:Target):Promise<Decision> }
export interface TransactionPort {
 // Canonical domain write, idempotency record and outbox event must be atomic.
 executeAtomic(actor:Actor,command:Command,decision:Decision):Promise<Receipt>;
}
export interface InquiryPort {
 // Only this accepted durable receipt can support 'Request received'.
 submitValidatedInquiry(input:{name:string;email:string;message:string;purpose:string;idempotencyKey:string}):Promise<{receiptId:string;acceptedAt:string}>;
}
export interface HandoffPort { consumeVerified(actor:Actor,token:string):Promise<{allowedPath:string;receiptId:string}> }
export interface EvidencePort { evaluateExactTarget(target:Target,capability:string):Promise<Decision> }
// No implementation supplied: bind canonical server systems before production.
// Client actor/tenant/grant claims and preview receipts are never authority.
