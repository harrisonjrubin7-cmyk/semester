export type DirectoryKind='housing'|'dining'|'clubs';
export interface CampusListing {id:string;name:string;category:string;description:string;location:string;url:string;contact:string;details:Record<string,string>}
export interface CampusDirectoryData {institution:string;updated:string;items:CampusListing[]}
export function parseDirectory(text:string):CampusDirectoryData {
 if(text.length>2_000_000)throw new Error('Choose a directory smaller than 2 MB.');
 const v=JSON.parse(text);if(!v||typeof v.institution!=='string'||!v.institution.trim()||!Array.isArray(v.items)||v.items.length>3000)throw new Error('Provide an institution name and an items array (up to 3,000 entries).');
 const ids=new Set<string>();
 const str=(x:unknown,max=1000)=>typeof x==='string'?x.trim().slice(0,max):'';
 const items=v.items.map((r:Record<string,unknown>,i:number):CampusListing=>{
  if(!r||typeof r!=='object'||!str(r.id)||!str(r.name))throw new Error(`Entry ${i+1} needs an id and name.`);
  const id=str(r.id,160);if(ids.has(id))throw new Error(`Duplicate id: ${id}.`);ids.add(id);
  const url=str(r.url,2000);if(url){let u:URL;try{u=new URL(url);}catch{throw new Error(`${str(r.name)}: use a full https:// or http:// link.`);}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error(`${str(r.name)}: only ordinary web links are accepted.`);}
  const details:Record<string,string>={};if(r.details&&typeof r.details==='object'&&!Array.isArray(r.details))for(const [key,val]of Object.entries(r.details).slice(0,20))if(typeof val==='string')details[key.slice(0,60)]=val.slice(0,1500);
  return{id,name:str(r.name,180),category:str(r.category,80)||'General',description:str(r.description,5000),location:str(r.location,200),url,contact:str(r.contact,250),details};
 });return{institution:str(v.institution,200),updated:new Date().toISOString(),items};
}
export function directoryTemplate(kind:DirectoryKind){return{institution:'Example University — replace with your institution',items:[{id:`example-${kind}`,name:`Example ${kind==='housing'?'residence':kind==='dining'?'dining hall or meal plan':'student organization'} — replace this entry`,category:kind==='housing'?'Residence hall':kind==='dining'?'Dining hall':'Academic',description:'Description supplied by the institution.',location:'Building or meeting location',url:'https://example.edu',contact:'Office or organization contact',details:kind==='housing'?{'Room types':'Provided by housing office','Cost per term':'Provided by housing office','Accessibility':'Contact housing for accommodations','Availability':'Not provided'}:kind==='dining'?{'Hours':'Published opening hours','Menu':'Institution menu link or description','Dietary options':'Confirm with dining staff','Plan eligibility':'Published eligibility'}:{'Meeting schedule':'Published days and times','How to join':'Published membership process','Membership fee':'Published fee or free','Events':'Published upcoming events'}}]};}
