// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { LoadedBook } from '../../lib/gradebook/client';
import type { Entry } from '../../lib/gradebook/model';
import { InstructorBook } from './InstructorBook';
import { StudentGrades } from './StudentGrades';
const api = vi.hoisted(() => ({loadBook:vi.fn(),enterScore:vi.fn(),exportRows:vi.fn(),release:vi.fn(),fileRegrade:vi.fn()}));
vi.mock('../../lib/gradebook/client', async importOriginal => ({...await importOriginal<typeof import('../../lib/gradebook/client')>(),...api}));
vi.mock('../../state/store',()=>({useStore:()=>({say:vi.fn(),dispatch:vi.fn()}),useAccountId:()=> 'viewer'}));
const downloads=vi.hoisted(()=>vi.fn());
vi.mock('../../lib/deliver',()=>({download:downloads}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT=true;
let host:HTMLDivElement, root:Root;
const entry=(id:string,studentId:string,status:Entry['status'],comment:string,version=1):Entry=>({id,itemId:'quiz',studentId,version,score:8,mark:null,comment,status,action:status==='released'?'released':'entered',gradedBy:'professor',actor:'professor',reason:'',regradeId:null,operation:id,at:'2026-10-01T12:00:00Z'});
const book:LoadedBook={course:'ECON 1010',term:'2026FA',scheme:{categories:[{key:'work',name:'Coursework',weight:100,dropLowest:0}],letters:[{min:0,letter:'A'}],moderationRequired:false},schemeVersion:1,items:[{id:'quiz',title:'Quiz one',categoryKey:'work',pointsPossible:10,lineItem:null}],entries:[entry('a','student-a','released','Released feedback'),entry('b','student-a','draft','PRIVATE DRAFT',2),entry('c','student-b','released','CLASSMATE FEEDBACK')],regrades:[],resolutions:[]};
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();api.loadBook.mockResolvedValue(book);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const button=(label:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()===label)!;
async function click(label:string){await act(async()=>button(label).click());}
it('keeps draft grades out of working downloads and never acquires export or release permission through a view',async()=>{
 await act(async()=>root.render(<InstructorBook course="ECON 1010" term="2026FA" me="grader" caps={['grades:enter']}/>));
 for(const view of ['Card view','Summary view','Table view']){
  await click(view);expect(button('Download visible rows').disabled).toBe(true);await click('Download visible rows');expect(host.textContent).toContain('PRIVATE DRAFT');expect(host.textContent).not.toContain('Release grades for Quiz one');
 }
 expect(downloads).not.toHaveBeenCalled();expect(api.exportRows).not.toHaveBeenCalled();expect(api.release).not.toHaveBeenCalled();expect(api.enterScore).not.toHaveBeenCalled();
 await click('Card view');const score=host.querySelector('input[aria-label="Score for student student-…"]') as HTMLInputElement;
 expect(score).not.toBeNull();await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(score,'9');score.dispatchEvent(new Event('input',{bubbles:true}));});await click('Summary view');expect((host.querySelector('input[aria-label="Score for student student-…"]') as HTMLInputElement).value).toBe('9');expect(api.enterScore).not.toHaveBeenCalled();
});
it('student cards and working exports use only that student’s released projection and preserve regrade cancellation',async()=>{
 await act(async()=>root.render(<StudentGrades course="ECON 1010" term="2026FA" me="student-a"/>));
 for(const view of ['Card view','Summary view']){await click(view);expect(host.textContent).toContain('Released feedback');expect(host.textContent).not.toMatch(/PRIVATE DRAFT|CLASSMATE FEEDBACK/);}
 await click('Download visible rows');expect(downloads).toHaveBeenCalledTimes(1);expect(downloads.mock.calls[0][0].body).not.toMatch(/PRIVATE DRAFT|CLASSMATE FEEDBACK/);
 await click('Ask about Quiz one');await click('Cancel');expect(api.fileRegrade).not.toHaveBeenCalled();
});
