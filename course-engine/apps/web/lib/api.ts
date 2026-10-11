export const API=process.env.NEXT_PUBLIC_API_URL??"http://localhost:8000/api/v1";
export function token(){return typeof window==="undefined"?"":localStorage.getItem("course_engine_token")??""}
export async function api<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(`${API}${path}`,{...init,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token()}`,...init.headers}});if(!response.ok)throw new Error((await response.text())||`Request failed: ${response.status}`);return response.status===204?undefined as T:response.json()}

export async function download(path: string): Promise<void> {
  const response = await fetch(`${API}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token()}` } });
  if (!response.ok) throw new Error((await response.text()) || `Request failed: ${response.status}`);
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? "semester-study-export";
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
