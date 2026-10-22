const vm=require('vm'),fs=require('fs');
const [file,out]=process.argv.slice(2);
const src=fs.readFileSync(file,'utf8');
const win={};
const ctx={window:win,document:{addEventListener(){},querySelector(){return null},getElementById(){return null},createElement(){return {style:{},setAttribute(){},appendChild(){}}},head:{appendChild(){}},body:{appendChild(){}}},console:{log(){},warn(){}},React:{createElement(){return null},useState:x=>[x,()=>{}],useEffect(){},useMemo:f=>f(),useRef:()=>({})},localStorage:{getItem(){return null},setItem(){}},location:{hash:''},addEventListener(){},setTimeout(){},navigator:{}};
ctx.globalThis=ctx; ctx.self=ctx; win.window=win;
vm.createContext(ctx);
const before=new Set(Object.keys(ctx));
try{ vm.runInContext(src.replace(/^\s*(const|let)\s+([A-Za-z_$][\w$]*)\s*=/gm,'var $2 ='),ctx,{timeout:5000}); }catch(e){ console.error('ERR',file,e.message.slice(0,120)); }
const res={};
for(const k of Object.keys(ctx)) if(!before.has(k) && typeof ctx[k]!=='function') res[k]=ctx[k];
for(const k of Object.keys(win)) if(k!=='window' && typeof win[k]!=='function') res['window.'+k]=win[k];
const clean=JSON.parse(JSON.stringify(res,(k,v)=>typeof v==='function'?undefined:v));
fs.writeFileSync(out,JSON.stringify(clean));
console.log(file.split('/').slice(-2).join('/'), Object.keys(clean).join(','), JSON.stringify(clean).length);
