// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
const mock=vi.hoisted(()=>({ask:vi.fn(),dispatch:vi.fn(),stance:'allowed'}));
vi.mock('../state/store',()=>({useStore:()=>({state:{term:'2026FA',sample:false,updates:[],notes:[{id:'private',courseId:'econ',title:'Private note',body:'Personal material not selected.'}]},catalog:{byId:{econ:{code:'ECON',ai:{stance:mock.stance,note:''}}}},dispatch:mock.dispatch})}));
vi.mock('../lib/live',()=>({useLive:()=>({guide:{code:'ECON',units:[{name:'Opportunity cost',cards:[{q:'What is opportunity cost?',a:'The value of the next best alternative.'}]}]}})}));
vi.mock('../lib/claude',()=>({ask:mock.ask,configured:()=>true,routeLabel:()=> 'test connection'}));
vi.mock('./Drawing',()=>({Drawing:()=>null}));
import { StudyStudio } from './StudyStudio';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root;let host:HTMLDivElement;
const result=(title='First section',body='Review the next best alternative [unit-0].')=>({format:'comprehensive',title,body,citations:[{sourceId:'unit-0',quote:'The value of the next best alternative.'}]});
function button(text:string){const found=[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()===text);if(!found)throw new Error(`Missing button ${text}`);return found;}
function check(text:string){const label=[...host.querySelectorAll('label')].find(l=>l.textContent?.includes(text));const box=label?.querySelector('input[type=checkbox]') as HTMLInputElement;if(!box)throw new Error(`Missing checkbox ${text}`);act(()=>box.click());}
async function press(text:string){await act(async()=>{button(text).click();});}
beforeEach(()=>{localStorage.clear();mock.ask.mockReset();mock.dispatch.mockReset();mock.stance='allowed';host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();});
function mount(){act(()=>root.render(<StudyStudio courseId="econ" onClose={()=>{}}/>));}
async function prepare(){mount();check('Opportunity cost');check('Send the selected text');mock.ask.mockResolvedValue(JSON.stringify({sections:[result(),result('Second section','Keep this other section unchanged [unit-0].')]}));await press('Create study guide');}
it('requires explicit text selection and consent, excluding unselected personal notes',async()=>{
 mount();expect(button('Create study guide').disabled).toBe(true);check('Opportunity cost');expect(button('Create study guide').disabled).toBe(true);check('Send the selected text');mock.ask.mockResolvedValue(JSON.stringify({sections:[result()]}));await press('Create study guide');
 const payload=JSON.parse(mock.ask.mock.calls[0][0].messages[0].content);expect(payload.sources.map((s:{id:string})=>s.id)).toEqual(['unit-0']);expect(JSON.stringify(payload)).not.toContain('Personal material not selected');expect(host.textContent).toContain('Source quotations were matched');
});
it('regenerates only the chosen section and saves a course-linked editable document',async()=>{
 await prepare();mock.ask.mockResolvedValue(JSON.stringify({sections:[result('Revised first','Revised body [unit-0].')]}));await press('Regenerate this section');expect(host.textContent).toContain('Second section');expect(host.textContent).toContain('Revised first');
 await press('Save & open in Write');const action=mock.dispatch.mock.calls.find(([a])=>a.type==='makeDocument')?.[0];expect(action).toMatchObject({type:'makeDocument',open:true,doc:{courseId:'econ'}});expect(JSON.stringify(action)).toContain('Keep this other section unchanged');
});
it('keeps existing sections when regenerated citations cannot be verified',async()=>{
 await prepare();mock.ask.mockResolvedValue(JSON.stringify({sections:[{...result(),citations:[{sourceId:'unit-0',quote:'This invented quotation cannot be verified.'}]}]}));await press('Regenerate this section');expect(host.textContent).toContain('First section');expect(host.textContent).toContain('Second section');expect(host.textContent).toContain('could not be verified');
});
it('blocks AI generation for a course with an AI prohibition',()=>{
 mock.stance='banned';mount();check('Opportunity cost');expect(button('Create study guide').disabled).toBe(true);expect(host.textContent).toContain('does not permit AI');expect(mock.ask).not.toHaveBeenCalled();
});
