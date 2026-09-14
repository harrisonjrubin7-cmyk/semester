// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
const mock=vi.hoisted(()=>({status:vi.fn(),records:vi.fn(),prepare:vi.fn(),commit:vi.fn(),reconcile:vi.fn(),dispatch:vi.fn()}));
vi.mock('../state/store',()=>({useStore:()=>({state:{term:'2026FA'},account:null,school:{name:'Test school'},catalog:{courses:[]},dispatch:mock.dispatch})}));
vi.mock('../lib/university',async importOriginal=>({...await importOriginal<object>(),gatewayConfigured:true,institutionStatus:mock.status,institutionRecords:mock.records,prepareInstitutionAction:mock.prepare,commitInstitutionAction:mock.commit,reconcileInstitutionAction:mock.reconcile}));
import { University } from './University';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root;let host:HTMLDivElement;
function button(text:string){const b=[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()===text);if(!b)throw new Error(`Missing ${text}`);return b;}
async function press(text:string){await act(async()=>button(text).click());}
function mount(){act(()=>root.render(<University/>));}
beforeEach(()=>{localStorage.clear();Object.values(mock).forEach(fn=>fn.mockReset());host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();});
it('keeps official data separate from local preparation and requires preview plus confirmation',async()=>{
 mock.status.mockResolvedValue({version:1,institutionId:'school',institutionName:'Test school',roles:['student'],connections:[{area:'courses',state:'connected',provider:'Fixture LMS',canRead:true,canWrite:true,lastSyncAt:null,permissions:[],message:''}]});
 mock.records.mockResolvedValue({records:[{id:'course',area:'courses',title:'Test course',summary:'Official record fixture',status:'Ready',version:'1',updatedAt:'2026-09-13T12:00:00Z',details:[],actions:[{id:'acknowledge',label:'Acknowledge course policy',fields:[]}]}],nextCursor:null,fetchedAt:'2026-09-13T12:00:00Z'});
 mock.prepare.mockResolvedValue({id:'review',title:'Acknowledge policy',details:[{label:'Course',value:'Test course'}],expiresAt:'2099-01-01T00:00:00Z'});
 mock.commit.mockResolvedValue({id:'official-receipt',status:'pending',message:'Accepted for processing',recordedAt:'2026-09-13T12:00:00Z'});
 mount();await press('Connections');await press('Check school access');await press('Records');await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await press('Acknowledge course policy');await act(async()=>{const forms=host.querySelectorAll('form');forms[forms.length-1].dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
 expect(mock.commit).not.toHaveBeenCalled();expect(button('Confirm official action').disabled).toBe(true);act(()=>host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());await press('Confirm official action');expect(mock.commit).toHaveBeenCalledExactlyOnceWith('review');expect(host.textContent).toContain('Awaiting official completion');expect(localStorage.getItem('semester.university.drafts.v1:device:2026FA')).toBeNull();expect(JSON.stringify(localStorage)).not.toContain('Official record fixture');mock.reconcile.mockResolvedValue({id:'official-receipt',status:'completed',message:'Confirmed',recordedAt:'2026-09-13T12:00:00Z'});await press('Recheck this action');expect(mock.reconcile).toHaveBeenCalledExactlyOnceWith('review');expect(mock.commit).toHaveBeenCalledTimes(1);
});
it('preserves malformed saved drafts instead of overwriting them with an empty file',()=>{
 const key='semester.university.drafts.v1:device:2026FA';localStorage.setItem(key,'broken but recoverable');mount();expect(localStorage.getItem(key)).toBe('broken but recoverable');expect(host.textContent).toContain('Download recovery copy');
});
