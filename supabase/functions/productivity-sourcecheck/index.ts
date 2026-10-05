import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// A source availability check, never a claim of institutional approval.
const privateAddress = (address: string) => {
  if(address.includes(':')) return !/^2[0-9a-f]{3}:/i.test(address) || /^2001:db8:/i.test(address);
  const p=address.split('.').map(Number);
  return p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255)||p[0]===0||p[0]===10||p[0]===127||p[0]>=224||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&(p[1]===168||p[1]===0))||(p[0]===100&&p[1]>=64&&p[1]<=127)||(p[0]===198&&(p[1]===18||p[1]===19));
};
async function approvedUrl(raw:string):Promise<URL> {
 const url=new URL(raw);
 const hosts=(Deno.env.get('PRODUCTIVITY_SOURCE_HOSTS')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 const host=url.hostname.toLowerCase();
 if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||!(/^[a-z0-9.-]+\.edu$/.test(host)||hosts.includes(host))) throw new Error('Use a public .edu source or an institution-approved source host.');
 // Query strings may contain private tokens. Source checks accept public paths only.
 if(url.search) throw new Error('Use a public source URL without query tokens.');
 const addresses=(await Promise.allSettled([Deno.resolveDns(host,'A'),Deno.resolveDns(host,'AAAA')])).flatMap(r=>r.status==='fulfilled'?r.value:[]);
 if(!addresses.length||addresses.some(privateAddress)) throw new Error('Source must resolve exclusively to public addresses.');
 return url;
}
Deno.serve(async(req:Request)=>{
 const headers={...corsHeaders(Deno.env.get('ALLOWED_ORIGIN'),req.headers.get('origin'),Deno.env.get('CORS_ALLOW_DEV')),'Content-Type':'application/json'};
 const response=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return response(405,{error:'Use POST.'});
 try{
  const auth=req.headers.get('authorization')||'';
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const {data,error}=await client.auth.getUser();
  if(error||!data.user)return response(401,{error:'Sign in before checking sources.'});
  const raw=await req.text();if(raw.length>5000)return response(413,{error:'Source request is too large.'});
  const input=JSON.parse(raw);if(typeof input.url!=='string'||typeof input.excerpt!=='string'||input.url.length>2000||input.excerpt.length>1000)return response(400,{error:'Provide a public URL and a short exact excerpt.'});
  let url=await approvedUrl(input.url);
  const signal=AbortSignal.timeout(8000);
  let page:Response|undefined;
  for(let i=0;i<4;i++){
   page=await fetch(url,{redirect:'manual',signal,headers:{Accept:'text/html,text/plain'}});
   if(page.status>=300&&page.status<400){const next=page.headers.get('location');await page.body?.cancel();if(!next)throw new Error('Source redirect has no destination.');url=await approvedUrl(new URL(next,url).href);page=undefined;continue;}break;
  }
  if(!page)throw new Error('Too many source redirects.');
  if(!page.ok){await page.body?.cancel();return response(200,{state:'unavailable',status:page.status,url:url.href,checkedAt:new Date().toISOString()});}
  if(!/text\/(html|plain)/i.test(page.headers.get('content-type')||'')){await page.body?.cancel();throw new Error('Use a public HTML or plain-text source.');}
  const reader=page.body?.getReader();if(!reader)throw new Error('Source returned no content.');
  const decoder=new TextDecoder();let text='';let bytes=0;
  try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.length;if(bytes>512000)throw new Error('Source exceeds the bounded check size.');text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
  const normalize=(s:string)=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
  const excerpt=normalize(input.excerpt);
  return response(200,{state:'available',excerptFound:!!excerpt&&normalize(text).includes(excerpt),url:url.href,checkedAt:new Date().toISOString()});
 }catch(e){return response(400,{error:e instanceof Error?e.message:'Source check failed.'});}
});
