import {readTable} from './sheet';
export interface Meeting {days:number[];start:number;end:number}
export interface CatalogCourse {id:string;code:string;section:string;title:string;term:string;department:string;credits:number;instructor:string;location:string;description:string;prerequisites:string;seats:number|null;meetings:Meeting[]}
export interface InstitutionCatalog {institution:string;importedAt:string;courses:CatalogCourse[]}
const word=(v:unknown,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
function time(v:unknown):number {
 if(typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<1440)return v;
 if(typeof v!=='string'||!/^([01]?\d|2[0-3]):[0-5]\d$/.test(v))throw new Error('Meeting times must use 24-hour HH:MM, such as 09:10.');
 const [h,m]=v.split(':').map(Number);return h*60+m;
}
export function parseCatalog(text:string):InstitutionCatalog {
 if(text.length>2_000_000)throw new Error('Use a catalog smaller than 2 MB.');
 let raw:unknown;
 // Every other refusal in this function is a sentence a student can act on,
 // and malformed JSON was the one that reached them as the browser's own
 // "Unexpected token } in JSON at position 412".
 if(text.trim().startsWith('{')||text.trim().startsWith('[')){
  try{raw=JSON.parse(text);}
  catch{throw new Error('That file starts like JSON but is not valid JSON. Export it again, or paste the catalog as a CSV table instead.');}
 }
 else {const [header,...rows]=readTable(text);if(!header)throw new Error('The catalog is empty.');raw={institution:'Imported institution',courses:rows.map(row=>Object.fromEntries(header.map((h,i)=>[h.trim(),row[i]||''])))};}
 if(!raw||typeof raw!=='object')throw new Error('Provide a JSON catalog or CSV table.');
 const obj=raw as Record<string,unknown>;const rows=Array.isArray(raw)?raw:obj.courses;
 if(!Array.isArray(rows)||!rows.length||rows.length>5000)throw new Error('Include between 1 and 5,000 course sections.');
 const used=new Set<string>();
 const courses=rows.map((value,index):CatalogCourse=>{
  if(!value||typeof value!=='object')throw new Error(`Row ${index+1} is not a course.`);
  const r=value as Record<string,unknown>;const code=word(r.code,30),title=word(r.title),term=word(r.term,60),section=word(r.section,30)||'01';
  if(!code||!title||!term)throw new Error(`Row ${index+1}: code, title and term are required.`);
  const id=word(r.id,160)||`${term}:${code}:${section}`;
  if(used.has(id))throw new Error(`Duplicate section: ${code} ${section}.`);used.add(id);
  const credits=Number(r.credits);if(r.credits==null||r.credits===''||!Number.isFinite(credits)||credits<0||credits>30)throw new Error(`${code}: credits must be between 0 and 30.`);
  const seats=r.seats==null||r.seats===''?null:Number(r.seats);if(seats!==null&&(!Number.isInteger(seats)||seats<0))throw new Error(`${code}: seats must be a nonnegative whole number, or blank if unknown.`);
  const meetingRows=r.meetings??((r.days||r.start||r.end)?[{days:typeof r.days==='string'?r.days.split(/[ ,;]+/).filter(Boolean).map(Number):r.days,start:r.start,end:r.end}]:[]);
  if(!Array.isArray(meetingRows)||meetingRows.length>14)throw new Error(`${code}: use a meetings array.`);
  const meetings=meetingRows.map(m=>{
   if(!m||typeof m!=='object'||!Array.isArray(m.days)||!m.days.length||m.days.some((d:unknown)=>!Number.isInteger(d)||Number(d)<0||Number(d)>6))throw new Error(`${code}: meeting days use 0–6 (Sunday–Saturday).`);
   const start=time(m.start),end=time(m.end);if(end<=start)throw new Error(`${code}: the end time must follow the start time.`);
   return{days:[...new Set<number>(m.days)],start,end};
  });
  return{id,code,section,title,term,credits,seats,meetings,department:word(r.department,60)||code.split(' ')[0],instructor:word(r.instructor),location:word(r.location),description:word(r.description,5000),prerequisites:word(r.prerequisites,1500)};
 });
 return{institution:word(obj.institution)||'Imported institution',importedAt:new Date().toISOString(),courses};
}
export function conflicts(courses:CatalogCourse[]):{a:CatalogCourse;b:CatalogCourse;days:number[]}[]{
 const found:{a:CatalogCourse;b:CatalogCourse;days:number[]}[]=[];
 for(let i=0;i<courses.length;i++)for(let j=i+1;j<courses.length;j++){
  const a=courses[i],b=courses[j];if(a.term!==b.term)continue;
  const days=new Set<number>();for(const x of a.meetings)for(const y of b.meetings)if(x.start<y.end&&y.start<x.end)for(const day of x.days)if(y.days.includes(day))days.add(day);
  if(days.size)found.push({a,b,days:[...days]});
 }return found;
}
export const clock24=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export const CATALOG_TEMPLATE={institution:'Example University — replace with your institution',courses:[{id:'example-101-01',code:'EXAM 101',section:'01',title:'Example course — replace this row',term:'Fall 2026',department:'EXAM',credits:3,instructor:'Instructor name',location:'Building and room',description:'Course description',prerequisites:'None stated',seats:null,meetings:[{days:[1,3,5],start:'09:00',end:'09:50'}]}]};
