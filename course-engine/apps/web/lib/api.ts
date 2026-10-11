export const API=process.env.NEXT_PUBLIC_API_URL??"http://localhost:8000/api/v1";
export function token(){return typeof window==="undefined"?"":localStorage.getItem("course_engine_token")??""}
export async function api<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(`${API}${path}`,{...init,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token()}`,...init.headers}});if(!response.ok)throw new Error((await response.text())||`Request failed: ${response.status}`);return response.status===204?undefined as T:response.json()}
