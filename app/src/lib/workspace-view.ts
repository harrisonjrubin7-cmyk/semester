import {useState,type Dispatch,type SetStateAction} from 'react';
import {useStrip} from './browser.hook';
/** View selection is per app tab; saved content remains in the shared library. */
export function useWorkspaceTabId(){const strip=useStrip();return strip.tabs[strip.at].id;}
export function useWorkspaceSelection(scope:string,name:string,initial=''):[string,Dispatch<SetStateAction<string>>]{
 const tabId=useWorkspaceTabId();const key=`semester.view.v1:${scope}:${tabId}:${name}`;
 const [value,setValue]=useState(()=>{try{return sessionStorage.getItem(key)||initial;}catch{return initial;}});
 const set:Dispatch<SetStateAction<string>>=next=>setValue(old=>{const value=typeof next==='function'?next(old):next;try{sessionStorage.setItem(key,value);}catch{/* Selection still works for this visit. */}return value;});
 return [value,set];
}
