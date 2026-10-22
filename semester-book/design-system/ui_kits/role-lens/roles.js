// Role × screen access model and backend map. Design-level: derived from navareas.ts areas, the console/staff/external kits and the brief — not read from every migration.
(function(){
const ROLES=[['student','Student'],['applicant','Applicant'],['guardian','Guardian'],['alumni','Alumni'],['faculty','Faculty'],['ta','Teaching assistant'],['advisor','Advisor'],['registrar','Registrar'],['finance','Finance'],['affairs','Student affairs'],['security','IT / security'],['support','Support / ops'],['employer','Employer'],['partner','Marketplace partner'],['chair','Department chair'],['moderator','Community moderator'],['mentor','Mentor'],['implementation','Implementation lead'],['csm','Customer success'],['revops','Revenue operations'],['investor','Investor / board'],['buyer','Institution buyer']];
// access: full | scoped | shared | read | audited | none
const R={
 applicant:{applying:'full',costs:'read',campus:'read',maps:'read',university:'read',activities:'read',support:'full',help:'full',profile:'full',account:'full',settings:'full',privacy:'full',export:'full',notifs:'full'},
 guardian:{family:'shared',billing:'shared',grades:'shared',calendar:'shared',support:'full',help:'full',profile:'full',account:'full',settings:'full',privacy:'full',notifs:'full'},
 alumni:{career:'full',opportunities:'full',people:'full',community:'full',degree:'read',profile:'full',account:'full',settings:'full',privacy:'full',export:'full',help:'full',support:'full',mail:'full'},
 faculty:{course:'scoped',grades:'scoped',calendar:'full',mail:'full',meet:'full',people:'read',announce:'scoped',sources:'scoped',study:'scoped',support:'full',help:'full',profile:'full',settings:'full',notifs:'full'},
 ta:{course:'scoped',grades:'scoped',calendar:'full',mail:'full',meet:'full',announce:'scoped',support:'full',help:'full',profile:'full',settings:'full'},
 advisor:{degree:'shared',advising:'shared',calendar:'full',meet:'full',mail:'full',people:'read',registration:'read',support:'full',help:'full',profile:'full',settings:'full'},
 registrar:{registration:'full',degree:'full',grades:'audited',announce:'full',calendar:'full',people:'read',support:'full',help:'full',settings:'full'},
 finance:{billing:'full',costs:'full',support:'full',help:'full',settings:'full'},
 affairs:{support:'shared',behind:'shared',housing:'scoped',meals:'scoped',community:'scoped',help:'full',settings:'full'},
 security:{settings:'full',privacy:'audited',account:'audited',connect:'audited'},
 support:{support:'scoped',connect:'scoped',help:'full'},
 employer:{opportunities:'scoped',career:'shared',mail:'scoped',settings:'full'},
 partner:{opportunities:'scoped',settings:'full'},
 chair:{course:'read',grades:'audited',announce:'full',people:'read',registration:'read',support:'full',help:'full',settings:'full'},
 moderator:{community:'scoped',classmates:'read',help:'full',settings:'full'},
 mentor:{career:'shared',opportunities:'read',mail:'scoped',meet:'scoped',help:'full',settings:'full'},
 implementation:{settings:'full',connect:'audited',support:'scoped',help:'full'},
 csm:{help:'full'},
 revops:{help:'full'},
 investor:{},
 buyer:{university:'read',help:'read'},
};
function access(role,screen){if(role==='student')return 'full';return (R[role]||{})[screen]||'none';}
const SAID={full:'Full — their own records',scoped:'Scoped — only their sections, tickets or listings',shared:'Shared — only what a student chose to share, until it expires',read:'Read-only',audited:'Audited — break-glass or approval, every view logged',none:'Not available — the screen does not render for this role. Company roles (investor, customer success, revenue ops) work in the company consoles — investor portal, business workspace, /ops — with aggregate data only, never student records'};
const BACKEND={
 today:{src:['SIS','LMS','Calendar feeds','Semester'],tables:['items','term_plan_courses','sync_state'],rls:'owner_id = auth.uid()',api:'Edge: sync-feeds · RPC: today_items()'},
 plan:{src:['SIS','Registrar','Bursar','Semester'],tables:['term_plan_courses','registration_time_tickets','holds','plans'],rls:'owner_id = auth.uid(); official rows read-only',api:'RPC: enroll(), drop(), withdraw() with idempotency keys'},
 learn:{src:['LMS','Course materials','Semester','AI provider (no student records)'],tables:['courses','assignments','grades','notes','study_sets'],rls:'enrolment-scoped; instructors by section; released grades only to students',api:'Edge: lms-sync · AI: ask (context-scoped)'},
 help:{src:['Offices','Semester'],tables:['support_requests','shares','share_events'],rls:'requester or granted office; shares by grantee + expiry',api:'RPC: request_help(), share_with(), revoke_share()'},
 campus:{src:['Dining','Housing','Events','Maps'],tables:['events','dining_hours','housing_requests','posts'],rls:'tenant members read; moderators write',api:'Edge: campus-feeds'},
 progress:{src:['SIS degree audit','Semester'],tables:['degree_audit','scenarios','metrics'],rls:'owner; advisor via active share',api:'RPC: degree_progress()'},
 you:{src:['Semester','Identity provider (SAML)'],tables:['profiles','settings','connections','audit_log'],rls:'owner_id = auth.uid(); security role via break-glass',api:'Auth: SAML SSO · RPC: export_my_data(), delete_account()'},
};
window.LENS={ROLES,access,SAID,BACKEND};
})();
