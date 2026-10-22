const $=id=>document.getElementById(id);
const S={c:location.hash.slice(1)||localStorage.getItem('ops.c')||'social',t:{},role:localStorage.getItem('ops.role')||'CEO',f:'All',q:'',crisis:false,done:{}};
const esc=s=>String(s).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
const cell=v=>{v=String(v);if(v[0]==='~'){const i=v.indexOf(':');return '<span class="pill s-'+v.slice(1,i)+'">'+esc(v.slice(i+1))+'</span>'}return esc(v)};
const plain=v=>{v=String(v);return v[0]==='~'?v.slice(v.indexOf(':')+1):v};
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),2200)}
function rail(){const g={};CONSOLES.forEach(c=>(g[c.group]=g[c.group]||[]).push(c));
 $('rail').innerHTML='<div class="brand"><img src="../../assets/logo-horizontal-reversed.svg" alt="Semester"></div>'+Object.entries(g).map(([k,cs])=>'<h6>'+k+'</h6>'+cs.map(c=>`<button class="${c.id===S.c?'on':''}" onclick="go('${c.id}')"><span>${c.name}</span>${c.roles.includes(S.role)?'':'<span class="ct">locked</span>'}</button>`).join('')).join('')+'<h6>More</h6><button onclick="location.href=\'../master-control/index.html\'"><span>Master control</span></button>'}
function go(id){S.c=id;S.f='All';S.q='';localStorage.setItem('ops.c',id);history.replaceState(null,'','#'+id);render()}
function cur(){return CONSOLES.find(c=>c.id===S.c)||CONSOLES[0]}
function kpis(k){return k?'<div class="kpis">'+k.map(([l,v,d,dir])=>`<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="d ${dir||'muted'}">${d||'&nbsp;'}</div></div>`).join('')+'</div>':''}
function table(t){let rows=t.rows.map((r,i)=>[r,i]);const fi=t.filter?t.cols.indexOf(t.filter.field):-1;
 if(fi>=0&&S.f!=='All')rows=rows.filter(([r])=>plain(r[fi])===S.f);
 if(S.q)rows=rows.filter(([r])=>r.map(plain).join(' ').toLowerCase().includes(S.q.toLowerCase()));
 const bar=(t.search||t.filter)?'<div class="bar">'+(t.search?`<input placeholder="Search" value="${esc(S.q)}" oninput="S.q=this.value;draw()">`:'')+(t.filter?t.filter.opts.map(o=>`<button class="chip ${S.f===o?'on':''}" onclick="S.f='${o}';draw()">${o}</button>`).join(''):'')+'<span class="muted">'+rows.length+' of '+t.rows.length+'</span></div>':'';
 return bar+'<div class="tw"><table><thead><tr>'+t.cols.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(([r,i])=>`<tr class="rw" onclick="openRow(${i})">`+r.map(v=>'<td>'+cell(v)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+t.cols.length+'" class="muted">Nothing matches.</td></tr>')+'</tbody></table></div>'}
function charts(t){const max=Math.max(...t.spark);return '<div class="grid2"><div class="panel"><h3>Last 12 months</h3><div class="spark">'+t.spark.map(v=>`<i style="height:${v/max*100}%"></i>`).join('')+'</div></div><div class="panel"><h3>Breakdown</h3>'+t.bars.map(([l,v])=>`<div class="hbar"><span>${l}</span><span><b style="width:${v}%"></b></span><span>${v}${t.barUnit||''}</span></div>`).join('')+'</div></div>'}
function calendar(){const ev={2:[['Planner launch','']],3:[['Halden case study','w']],4:[['AI tutor explainer','a']],5:[['Accessibility reel','']],8:[['Finals reminder','w']],10:[['Webinar promo','']],12:[['Northmere co-post','']],15:[['CIO webinar live','']],17:[['Partner spotlight','a']],22:[['Registrar roundtable','']],26:[['Halloween study tips','w']]};
 const dn=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];let h='<div class="bar"><b>October 2026</b><span class="pill s-info">Scheduled</span><span class="pill s-warn">Needs approval</span><span class="pill s-ai">Legal review</span></div><div class="cal">'+dn.map(d=>'<div class="dh">'+d+'</div>').join('')+'<div></div><div></div><div></div>';
 for(let d=1;d<=31;d++)h+='<div class="day"><span class="n">'+d+'</span>'+(ev[d]||[]).map(([n,k])=>`<span class="ev ${k}" onclick="toast('${n}: opened in composer')">${S.crisis?'⏸ ':''}${n}</span>`).join('')+'</div>';return h+'</div>'}
function checklist(t){const c=cur().id;const items=t.items.map((it,i)=>{const k=c+i;const d=k in S.done?S.done[k]:it[2];return [it,d,k]});const n=items.filter(x=>x[1]).length;
 return `<div class="panel"><h3>October close · ${n} of ${items.length} done</h3><div style="height:6px;background:#22262f;border-radius:3px;margin-bottom:12px"><div style="height:6px;width:${n/items.length*100}%;background:#9fd6a8;border-radius:3px"></div></div>`+items.map(([it,d,k])=>`<label style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #22262f;cursor:pointer"><input type="checkbox" ${d?'checked':''} onchange="S.done['${k}']=this.checked;draw()"><span style="flex:1;${d?'text-decoration:line-through;color:#98989b':''}">${it[0]}</span><span class="muted">${it[1]}</span></label>`).join('')+'</div>'}
function draw(){const c=cur(),t=c.tabs.find(x=>x.id===S.t[c.id])||c.tabs[0];let h='';
 if(!c.roles.includes(S.role)||(t.roleOnly&&!t.roleOnly.includes(S.role))){$('body').innerHTML='<div class="lock">Your role ('+S.role+') can\u2019t open this view. Allowed: '+(t.roleOnly||c.roles).join(', ')+'.</div>';return}
 h+=kpis(t.kpis);
 if(t.type==='charts')h+=charts(t);else if(t.type==='calendar')h+=calendar();else if(t.type==='checklist')h+=checklist(t);
 else if(t.type==='panels')h+='<div class="grid2">'+t.panels.map(([n,b])=>'<div class="panel"><h3>'+n+'</h3>'+b+'</div>').join('')+'</div>';
 if(t.cols)h+=table(t);$('body').innerHTML=h;
 const q=$('body').querySelector('input[placeholder=Search]');if(q&&S.q){q.focus();q.setSelectionRange(S.q.length,S.q.length)}}
function render(){const c=cur();rail();$('title').textContent=c.name;$('sub').textContent=c.sub;
 $('actions').innerHTML=c.roles.includes(S.role)?c.actions.map(a=>`<button class="btn ${a.k}" onclick="act('${a.a}')">${a.a==='crisis'&&S.crisis?'End crisis mode':a.l}</button>`).join(''):'';
 const at=S.t[c.id]||c.tabs[0].id;$('tabs').innerHTML=c.tabs.length>1?c.tabs.map(t=>`<button class="${t.id===at?'on':''}" onclick="S.t['${c.id}']='${t.id}';S.f='All';S.q='';render()">${t.name}</button>`).join(''):'';
 $('crisis').classList.toggle('on',S.crisis&&c.id==='social');closeD();draw()}
function act(a){if(a==='crisis'){S.crisis=!S.crisis;toast(S.crisis?'Crisis mode on · 11 posts paused · leads paged':'Crisis mode off · schedule resumed');render();return}
 if(a==='compose'){openD('Compose post','<label class="muted">Channels</label><div class="bar">'+['LinkedIn','X','Instagram','TikTok','YouTube','Threads'].map(x=>`<button class="chip" onclick="this.classList.toggle('on')">${x}</button>`).join('')+'</div><label class="muted">Post</label><textarea rows="6" style="background:#090a0e;border:1px solid #333843;color:#eceef2;border-radius:6px;padding:10px;font:inherit"></textarea><label class="muted">Schedule</label><input type="datetime-local" style="background:#090a0e;border:1px solid #333843;color:#eceef2;border-radius:6px;padding:8px;font:inherit"><div class="muted">Checks run on submit: brand voice, alt text, captions, claims needing Legal.</div>',['Send for approval','Save draft']);return}
 if(a.startsWith('toast:'))toast(a.slice(6))}
function openD(title,body,btns){$('dt').textContent=title;$('db').innerHTML=body;$('df').innerHTML=(btns||[]).map((b,i)=>`<button class="btn ${i?'':'p'}" onclick="toast('${b.replace(/'/g,'')} · done');closeD()">${b}</button>`).join('');$('drawer').classList.add('open')}
function closeD(){$('drawer').classList.remove('open')}
function openRow(i){const c=cur(),t=c.tabs.find(x=>x.id===S.t[c.id])||c.tabs[0],r=t.rows[i];
 openD(plain(r[0])+(t.cols[1]?' · '+plain(r[1]):''),'<div class="kv">'+t.cols.map((col,j)=>'<span>'+col+'</span><span>'+cell(r[j])+'</span>').join('')+'</div><div class="panel"><h3>Activity</h3><div class="muted" style="line-height:1.7">Created by system · 2 days ago<br>Viewed by '+S.role+' · just now</div></div><div class="muted">Changes here are written to the audit log with your role.</div>',t.rowActions||['Open'])}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeD()});
$('role').innerHTML=ROLES.map(r=>`<option ${r===S.role?'selected':''}>${r}</option>`).join('');$('role').onchange=e=>{S.role=e.target.value;localStorage.setItem('ops.role',S.role);render()};
render();
