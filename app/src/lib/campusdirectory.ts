import { formatDate } from './locale';
export type DirectoryKind='housing'|'dining'|'clubs'|'departments'|'events';
/**
 * One entry in a school-supplied directory.
 *
 * `starts` and `ends` are an event's own dates, `YYYY-MM-DD` or
 * `YYYY-MM-DDTHH:MM` in the school's local time, as the file gives them. An
 * events directory requires `starts` (see `parseDirectory`); every other kind
 * ignores it.
 */
export interface CampusListing {id:string;name:string;category:string;description:string;location:string;url:string;contact:string;details:Record<string,string>;starts?:string;ends?:string}

/** A date or a date and a time, and a real one: `2026-02-31` is refused. */
const WHEN=/^(\d{4}-\d{2}-\d{2})(T([01]\d|2[0-3]):[0-5]\d)?$/;
export function validWhen(v:string):boolean{const m=WHEN.exec(v);if(!m)return false;const d=new Date(`${m[1]}T00:00:00Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===m[1];}

/**
 * What each directory is called and says, in one place rather than as a
 * ternary per sentence in the component — which is how the three kinds were
 * written, and why a fourth would have been read as "clubs" in every line
 * that did not know it existed.
 */
export const DIRECTORY_COPY:Record<DirectoryKind,{label:string;blurb:string;icon:string;empty:string;example:string;category:string;details:Record<string,string>}>={
 housing:{label:'housing options',blurb:'Find a place that fits your needs. Save options and compare them before applying.',icon:'⌂',empty:'Import residence profiles, room types, costs and application links. Your saved residence and move-out planning remain available in My housing.',example:'residence',category:'Residence hall',details:{'Room types':'Provided by housing office','Cost per term':'Provided by housing office','Accessibility':'Contact housing for accommodations','Availability':'Not provided'}},
 dining:{label:'dining & meal plans',blurb:'Find places to eat, check the details and compare your meal options.',icon:'☷',empty:'Import dining locations, menus, hours, dietary options and meal plan details. Your balances and spending plan remain available in My meal plan.',example:'dining hall or meal plan',category:'Dining hall',details:{'Hours':'Published opening hours','Menu':'Institution menu link or description','Dietary options':'Confirm with dining staff','Plan eligibility':'Published eligibility'}},
 clubs:{label:'clubs & organizations',blurb:'Find your community. Discover organizations and bring their activities into your week.',icon:'♧',empty:'Import organization profiles, meeting information, events and membership links. Your personal activities remain available in My week.',example:'student organization',category:'Academic',details:{'Meeting schedule':'Published days and times','How to join':'Published membership process','Membership fee':'Published fee or free','Events':'Published upcoming events'}},
 departments:{label:'departments & offices',blurb:'Who to ask, where they are and when they are open — from your school’s own directory.',icon:'◫',empty:'Import your school’s departments and offices: advising, registrar, financial aid, disability services, counseling, career center. Each entry links to the office’s own page.',example:'department or office',category:'Student services',details:{'Hours':'Published office hours','Appointments':'How to book, as the office publishes it','Walk-in':'Published walk-in times, if any','Serves':'Who the office is for'}},
 events:{label:'campus events',blurb:'What is on, from your school’s own calendar. Details come from the file you import.',icon:'◷',empty:'Import your school’s events: talks, fairs, info sessions, performances. Each needs a start date; past events are set aside.',example:'event',category:'Talk',details:{'Cost':'Published price or free','Registration':'How to register, as published','Accessibility':'Contact the organizer for accommodations','Host':'Department or organization'}},
};

/** Events in date order, upcoming first, with anything that ended before `today` set aside. */
export function upcomingEvents(items:CampusListing[],today:string):{upcoming:CampusListing[];past:CampusListing[]}{
 const day=(v?:string)=>(v??'').slice(0,10);
 const sorted=[...items].sort((a,b)=>(a.starts??'').localeCompare(b.starts??'')||a.name.localeCompare(b.name));
 const done=(i:CampusListing)=>day(i.ends||i.starts)<today;
 return {upcoming:sorted.filter(i=>!done(i)),past:sorted.filter(done).reverse()};
}

/** "Thu 8 Oct, 18:30" or "Thu 8 Oct", read as written — no time zone is invented. */
export function whenLine(i:CampusListing):string{
 const one=(v:string)=>{const [d,t]=v.split('T');const date=formatDate(new Date(`${d}T00:00:00Z`), {weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});return t?`${date}, ${t}`:date;};
 if(!i.starts)return '';
 if(!i.ends||i.ends===i.starts)return one(i.starts);
 // The same day twice reads as a mistake: "11:00 – 15:00" after the date, not the date again.
 const [sd]=i.starts.split('T'),[ed,et]=i.ends.split('T');
 return sd===ed&&et?`${one(i.starts)} – ${et}`:`${one(i.starts)} – ${one(i.ends)}`;
}
export interface CampusDirectoryData {institution:string;updated:string;items:CampusListing[]}
export function parseDirectory(text:string,kind?:DirectoryKind):CampusDirectoryData {
 if(text.length>2_000_000)throw new Error('Choose a directory smaller than 2 MB.');
 const v=JSON.parse(text);if(!v||typeof v.institution!=='string'||!v.institution.trim()||!Array.isArray(v.items)||v.items.length>3000)throw new Error('Provide an institution name and an items array (up to 3,000 entries).');
 const ids=new Set<string>();
 const str=(x:unknown,max=1000)=>typeof x==='string'?x.trim().slice(0,max):'';
 const items=v.items.map((r:Record<string,unknown>,i:number):CampusListing=>{
  if(!r||typeof r!=='object'||!str(r.id)||!str(r.name))throw new Error(`Entry ${i+1} needs an id and name.`);
  const id=str(r.id,160);if(ids.has(id))throw new Error(`Duplicate id: ${id}.`);ids.add(id);
  const url=str(r.url,2000);if(url){let u:URL;try{u=new URL(url);}catch{throw new Error(`${str(r.name)}: use a full https:// or http:// link.`);}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error(`${str(r.name)}: only ordinary web links are accepted.`);}
  const details:Record<string,string>={};if(r.details&&typeof r.details==='object'&&!Array.isArray(r.details))for(const [key,val]of Object.entries(r.details).slice(0,20))if(typeof val==='string')details[key.slice(0,60)]=val.slice(0,1500);
  const starts=str(r.starts,16),ends=str(r.ends,16);
  if(starts&&!validWhen(starts))throw new Error(`${str(r.name)}: write the start as YYYY-MM-DD or YYYY-MM-DDTHH:MM.`);
  if(ends&&(!validWhen(ends)||(starts&&ends<starts)))throw new Error(`${str(r.name)}: the end must be a real date on or after the start.`);
  // An event with no date cannot be put in order or set aside once it is over.
  if(kind==='events'&&!starts)throw new Error(`${str(r.name)}: an event needs a start date.`);
  return{id,name:str(r.name,180),category:str(r.category,80)||'General',description:str(r.description,5000),location:str(r.location,200),url,contact:str(r.contact,250),details,...(starts?{starts}:{}),...(ends?{ends}:{})};
 });return{institution:str(v.institution,200),updated:new Date().toISOString(),items};
}
export function directoryTemplate(kind:DirectoryKind){const c=DIRECTORY_COPY[kind];return{institution:'Example University — replace with your institution',items:[{id:`example-${kind}`,name:`Example ${c.example} — replace this entry`,category:c.category,description:'Description supplied by the institution.',location:'Building or meeting location',url:'https://example.edu',contact:'Office or organization contact',details:c.details,...(kind==='events'?{starts:'2026-10-08T18:30',ends:'2026-10-08T20:00'}:{})}]};}
