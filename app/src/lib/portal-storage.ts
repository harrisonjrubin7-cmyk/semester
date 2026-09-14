import {obj,textValue} from './device-library';
import {parseCatalog,type CatalogCourse,type InstitutionCatalog} from './registration';
import {parseDirectory,type CampusDirectoryData} from './campusdirectory';

export interface RegistrationPlan {id:string;name:string;courses:CatalogCourse[]}
export interface RegistrationData {catalog:InstitutionCatalog|null;cart:string[];plans:RegistrationPlan[]}
export const EMPTY_REGISTRATION:RegistrationData={catalog:null,cart:[],plans:[]};
export function readIds(value:unknown):string[] {
 if(!Array.isArray(value)||value.length>5000||value.some(id=>!textValue(id,200)))throw new Error('Saved selections are not valid.');
 return [...new Set(value as string[])];
}
export const EMPTY_IDS:string[]=[];
export function readRegistration(value:unknown):RegistrationData {
 if(!obj(value)||!Array.isArray(value.plans)||value.plans.length>12)throw new Error('Saved registration plans are not valid.');
 const catalog=value.catalog===null?null:parseCatalog(JSON.stringify(value.catalog));
 if(catalog&&obj(value.catalog)&&typeof value.catalog.importedAt==='string')catalog.importedAt=value.catalog.importedAt;
 const plans=value.plans.map(p=>{
  if(!obj(p)||!textValue(p.id,200)||!p.id||!textValue(p.name,80)||!p.name.trim())throw new Error('A saved schedule is missing its name or ID.');
  return {id:p.id,name:p.name,courses:parseCatalog(JSON.stringify(p.courses)).courses};
 });
 if(new Set(plans.map(p=>p.id)).size!==plans.length)throw new Error('Saved schedule IDs must be unique.');
 return {catalog,cart:readIds(value.cart),plans};
}
export function readStoredDirectory(value:unknown):CampusDirectoryData|null {
 if(value===null)return null;
 const directory=parseDirectory(JSON.stringify(value));
 if(obj(value)&&typeof value.updated==='string')directory.updated=value.updated;
 return directory;
}
export interface HousingDraft {residence:string;roomType:string;roommate:string;notes:string;checks:string[]}
export interface MealDraft {name:string;weekly:string;weeks:string;cost:string}
export const EMPTY_HOUSING:HousingDraft={residence:'',roomType:'',roommate:'',notes:'',checks:[]};
export const EMPTY_MEALS:MealDraft={name:'',weekly:'',weeks:'',cost:''};
export function readHousingDraft(value:unknown):HousingDraft {
 if(!obj(value)||['residence','roomType','roommate','notes'].some(k=>!textValue(value[k])))throw new Error('Saved housing preferences are not valid.');
 return {residence:value.residence as string,roomType:value.roomType as string,roommate:value.roommate as string,notes:value.notes as string,checks:readIds(value.checks)};
}
export function readMealDraft(value:unknown):MealDraft {
 if(!obj(value)||['name','weekly','weeks','cost'].some(k=>!textValue(value[k],200)))throw new Error('Saved meal plan is not valid.');
 return {name:value.name as string,weekly:value.weekly as string,weeks:value.weeks as string,cost:value.cost as string};
}
