/* ================= INVITE CODE (REF) =================
   New people unlock AI and sync with a shared invite code (limited places, see api/ref.js) instead of the group password.
   The password box accepts either: an invite code is exchanged for a personal access key, anything else is kept as the password.
   Whoever holds the group password sees an admin panel in Settings to set the code and the number of places. */
const REF_T={wrong:'Mã mời hoặc mật khẩu chưa đúng. Nếu bạn nhận mã từ bài viết, có thể mã chưa mở hoặc đã đổi. Nhắn người chia sẻ để xin mã mới nhé.',
  st:{title:'Số liệu beta',today:'Hoạt động hôm nay',week:'Hoạt động 7 ngày',fresh7:'Máy mới 7 ngày',learners:'Người có tiến độ đồng bộ',ai7:'Lượt AI 7 ngày',aiu:'Người dùng AI hôm nay',ret:'Quay lại sau',retNote:'Tính theo máy, không theo người: một người dùng hai máy được tính là hai. Số trong ngoặc là số máy quay lại trên số máy mới của các ngày đủ tuổi.',day:'Ngày',active:'Hoạt động',new:'Mới'},
  ok:(n,m)=>`Đã mở khóa. Bạn là người thứ ${n}/${m} dùng mã này.`,full:m=>`Mã này đã đủ ${m} người. Bạn nhắn người chia sẻ để xin mã mới nhé.`,slow:'Bạn thử nhiều lần quá. Đợi một lúc rồi nhập lại.',
  title:'Mã mời cho người mới',note:'Người mới nhập mã này thay cho mật khẩu nhóm. Mỗi người nhận một khóa riêng, mã tự khóa khi đủ số suất. Người đang dùng mật khẩu nhóm không bị ảnh hưởng. Đổi sang mã mới thì bắt đầu đếm lại từ 0.',
  used:(u,m)=>`${u}/${m} suất đã dùng`,copy:'Chép lời mời',none:'Chưa có mã mời. Đặt một mã bên dưới (4 đến 24 ký tự, chữ, số hoặc gạch ngang).',ph:'Ví dụ STALIS50',save:'Lưu mã',
  total:n=>`Tổng số khóa đã cấp từ trước đến nay: ${n}.`,share:(u,c)=>`Link: ${u}\nMã mời: ${c}\nBấm vào trợ lý AI hoặc nút "Nhập mã mời" trong phần cài đặt, dán mã vào là xong.`,copied:'Đã chép lời mời.',saved:'Đã lưu mã mời.',bad:'Không lưu được. Mã cần 4 đến 24 ký tự, chỉ gồm chữ, số, gạch ngang.'};
async function refRedeem(code){
  try{const r=await fetch('api/ref',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'redeem',code})});
    const j=await r.json().catch(()=>({}));
    if(r.ok&&j.token)return j; if(r.status===410)return {full:true,max:j.max}; if(r.status===429)return {slow:true};
    return {invalid:true};}catch(e){return {invalid:true};}
}
/* used by askPassword: returns true when the modal may close */
async function refSubmit(v,m){
  const msg=$('#pwMsg',m.el), btn=$('#pwF button',m.el); if(btn)btn.disabled=true;
  const r=await refRedeem(v); if(btn)btn.disabled=false;
  if(r.token){setKey(r.token);toast(REF_T.ok(r.n,r.max),4500);return true;}
  if(r.full){if(msg)msg.textContent=REF_T.full(r.max);return false;}
  if(r.slow){if(msg)msg.textContent=REF_T.slow;return false;}
  /* not an invite code: accept it only if the server takes it as a password or personal key */
  let ok=false;try{const c=await fetch('api/ref',{method:'POST',headers:{'content-type':'application/json','x-app-key':v},body:JSON.stringify({action:'check'})});ok=c.ok&&(await c.json()).ok;}catch(e){}
  if(ok){setKey(v);return true;}
  if(msg)msg.textContent=REF_T.wrong;return false;
}
/* anonymous daily ping for the beta numbers (random id kept on this device, nothing else is sent) */
(function refPing(){try{if(/^(localhost|127\.)/.test(location.hostname))return;const day=new Date(Date.now()+7*36e5).toISOString().slice(0,10);
  if(localStorage.getItem('hanyu-ping')===day)return;let id=localStorage.getItem('hanyu-did');
  if(!id){id=[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem('hanyu-did',id);}
  setTimeout(()=>fetch('api/ping',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({d:id})}).then(r=>{if(r.ok)localStorage.setItem('hanyu-ping',day);}).catch(()=>{}),4000);}catch(e){}})();
Object.assign(REF_T.st,{loading:'Đang tải số liệu...',fail:'Chưa tải được số liệu.',from:'Từ ngày',to:'Đến ngày',apply:'Xem',days:n=>`${n} ngày`,table:'Xem bảng số',inRange:d=>`${d} ngày. Số cạnh mỗi đường: số máy khác nhau đã hoạt động trong khoảng này, số máy mới, số lượt AI.`,ser:{active:'Máy hoạt động',fresh:'Máy mới',ai:'Lượt AI'},none:'Chưa đo',since:d=>`Bắt đầu đo từ ${d}, các ngày trước đó không có dữ liệu.`});
function refStatsHTML(t){
  const pct=o=>o.of?Math.round(o.back/o.of*100)+'%':'-', d0=t.daily[0], ai=x=>x.ai+x.stt;
  const sum=k=>t.daily.slice(0,7).reduce((a,x)=>a+(typeof k==='function'?k(x):x[k]),0);
  return `<h3 style="margin-top:14px">${REF_T.st.title}</h3>
   <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">${[[REF_T.st.today,d0.active],[REF_T.st.week,t.active7],[REF_T.st.fresh7,sum('fresh')],[REF_T.st.learners,t.learners],[REF_T.st.ai7,sum(ai)],[REF_T.st.aiu,d0.aiUsers]].map(([l,v])=>`<div class="panel" style="padding:10px"><div class="small muted">${l}</div><b style="font-size:22px">${v}</b></div>`).join('')}</div>
   <p class="small" style="margin:10px 0 4px"><b>${REF_T.st.ret}</b> ${[1,7,30].map(n=>`D${n}: <b>${pct(t.retention[n])}</b> <span class="muted">(${t.retention[n].back}/${t.retention[n].of})</span>`).join(' &nbsp; ')}</p>
   <p class="small muted" style="margin:0 0 8px">${REF_T.st.retNote}</p>
   <div id="rsBody"></div>`;
}
/* daily trend for the chosen range: line chart with hover/tap read-out, quick ranges and a from-to filter */
const RS_SER=[{k:'active',c:'var(--rs1)'},{k:'fresh',c:'var(--rs2)'},{k:'ai',c:'var(--rs3)'}];
const rsYmd=d=>d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6), rsShort=d=>d.slice(6)+'/'+d.slice(4,6);
function rsChart(box,rows,off){
  const W=Math.max(300,box.clientWidth||600),H=220,L=34,R=10,T=12,B=26,n=rows.length;
  const shown=RS_SER.filter(s=>!off[s.k]);
  const max=Math.max(1,...rows.filter(r=>r.m).flatMap(r=>shown.map(s=>r[s.k])));
  const step=max<=5?1:Math.pow(10,Math.floor(Math.log10(max/4)))*([1,2,5,10].find(m=>max/4<=Math.pow(10,Math.floor(Math.log10(max/4)))*m)||10);
  const top=Math.ceil(max/step)*step, x=i=>L+(n<2?(W-L-R)/2:i*(W-L-R)/(n-1)), y=v=>T+(H-T-B)*(1-v/top);
  const ticks=[];for(let v=0;v<=top;v+=step)ticks.push(v);
  const every=Math.max(1,Math.ceil(n/(W/52)));
  const svg=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block;touch-action:pan-y" role="img" aria-label="${REF_T.st.title}">
    ${ticks.map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rsg)" stroke-width="1"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="currentColor" opacity=".6">${v}</text>`).join('')}
    ${rows.map((r,i)=>(i%every===0&&n-1-i>=every*0.7)||i===n-1?`<text x="${x(i)}" y="${H-8}" text-anchor="${i===n-1&&n>1?'end':'middle'}" font-size="11" fill="currentColor" opacity=".6">${rsShort(r.day)}</text>`:'').join('')}
    ${(()=>{const f=rows.findIndex(r=>r.m);return f>0?`<rect x="${L}" y="${T}" width="${Math.max(0,x(f)-L-(n>1?(W-L-R)/(n-1)/2:0))}" height="${H-T-B}" fill="var(--rsg)" opacity=".45"/><text x="${L+6}" y="${T+14}" font-size="11" fill="currentColor" opacity=".6">${x(f)-L>90?REF_T.st.none:''}</text>`:'';})()}
    ${shown.map(s=>{const segs=[];let cur=[];rows.forEach((r,i)=>{if(r.m)cur.push(x(i)+','+y(r[s.k]));else if(cur.length){segs.push(cur);cur=[];}});if(cur.length)segs.push(cur);
      return segs.map(g=>g.length>1?`<polyline fill="none" stroke="${s.c}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" points="${g.join(' ')}"/>`:'').join('')+
      (n<=45||rows.filter(r=>r.m).length<3?rows.map((r,i)=>r.m?`<circle cx="${x(i)}" cy="${y(r[s.k])}" r="2.6" fill="${s.c}"/>`:'').join(''):'');}).join('')}
    <line id="rsX" x1="0" x2="0" y1="${T}" y2="${H-B}" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="3 3" visibility="hidden"/>
    <g id="rsDots"></g><rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="transparent" id="rsHit"/></svg>
    <div id="rsTip" class="rs-tip" hidden></div>`;
  box.innerHTML=svg;box.dataset.w=W;
  const hit=$('#rsHit',box),tip=$('#rsTip',box),xl=$('#rsX',box),dots=$('#rsDots',box),sv=$('svg',box);
  const show=e=>{const rc=sv.getBoundingClientRect(),px=(e.clientX-rc.left)*W/rc.width;
    const i=Math.max(0,Math.min(n-1,Math.round(n<2?0:(px-L)/((W-L-R)/(n-1))))),r=rows[i];
    xl.setAttribute('x1',x(i));xl.setAttribute('x2',x(i));xl.setAttribute('visibility','visible');
    dots.innerHTML=r.m?shown.map(s=>`<circle cx="${x(i)}" cy="${y(r[s.k])}" r="4.5" fill="${s.c}" stroke="var(--rsbg)" stroke-width="2"/>`).join(''):'';
    tip.innerHTML=`<b>${rsShort(r.day)}/${r.day.slice(0,4)}</b>`+(r.m?RS_SER.map(s=>`<div><i style="background:${s.c}"></i>${REF_T.st.ser[s.k]}: <b>${r[s.k]}</b></div>`).join(''):`<div class="muted">${REF_T.st.none}</div>`);
    tip.hidden=false;const tw=tip.offsetWidth,left=x(i)*rc.width/W;
    tip.style.left=Math.max(0,Math.min(rc.width-tw,left+12>rc.width-tw?left-tw-12:left+12))+'px';tip.style.top='8px';};
  const hide=()=>{tip.hidden=true;xl.setAttribute('visibility','hidden');dots.innerHTML='';};
  hit.addEventListener('pointermove',show);hit.addEventListener('pointerdown',show);hit.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')hide();});
}
async function refStatsLoad(st,range){
  st.innerHTML=`<p class="small muted">${REF_T.st.loading}</p>`;
  let t;try{const r=await fetch('api/ref',{method:'POST',headers:{'content-type':'application/json','x-app-key':getKey()},body:JSON.stringify(Object.assign({action:'stats'},range))});if(!r.ok)throw 0;t=await r.json();}
  catch(e){st.innerHTML=`<p class="small">${REF_T.st.fail}</p>`;return;}
  st.innerHTML=refStatsHTML(t);
  const body=$('#rsBody',st), since=t.since||'00000000', rows=t.daily.slice().reverse().map(x=>({day:x.day,m:x.day>=since,active:x.active,fresh:x.fresh,ai:x.ai+x.stt,aiUsers:x.aiUsers}));
  const first=rows[0].day,last=rows[rows.length-1].day, tot=k=>rows.reduce((a,r)=>a+(r.m?r[k]:0),0), gap=rows.some(r=>!r.m);
  const quick=[7,14,30,90];
  body.innerHTML=`<div class="rs-bar">${quick.map(d=>`<button class="btn sm" data-d="${d}" aria-pressed="${range.days===d}">${REF_T.st.days(d)}</button>`).join('')}
      <span class="rs-dates"><input type="date" id="rsF" value="${rsYmd(first)}" aria-label="${REF_T.st.from}"><span>-</span><input type="date" id="rsT" value="${rsYmd(last)}" aria-label="${REF_T.st.to}"><button class="btn sm" id="rsGo">${REF_T.st.apply}</button></span></div>
    <div class="rs-leg">${RS_SER.map(s=>`<button data-k="${s.k}" aria-pressed="true"><i style="background:${s.c}"></i>${REF_T.st.ser[s.k]} <b>${s.k==='active'?t.activeRange:tot(s.k)}</b></button>`).join('')}</div>
    <div class="rs-chart" id="rsC"></div>
    <p class="small muted" style="margin:4px 0 8px">${REF_T.st.inRange(rows.length)}${gap?' '+REF_T.st.since(rsShort(since)+'/'+since.slice(0,4)):''}</p>
    <details class="adv"><summary>${REF_T.st.table}</summary><div style="overflow-x:auto"><table class="small" style="width:100%;border-collapse:collapse"><tr class="muted"><th style="text-align:left">${REF_T.st.day}</th><th>${REF_T.st.active}</th><th>${REF_T.st.new}</th><th>AI</th></tr>
      ${t.daily.map(x=>{const m=x.day>=since,v=n=>m?n:'-';return `<tr${m?'':' class="muted"'}><td>${rsShort(x.day)}</td><td style="text-align:center">${v(x.active)}</td><td style="text-align:center">${v(x.fresh)}</td><td style="text-align:center">${v(x.ai+x.stt)}</td></tr>`;}).join('')}</table></div></details>`;
  const off={}, c=$('#rsC',body), draw=()=>rsChart(c,rows,off);
  draw();
  $$('[data-d]',body).forEach(b=>b.onclick=()=>refStatsLoad(st,{days:+b.dataset.d}));
  $('#rsGo',body).onclick=()=>{const f=$('#rsF',body).value.replace(/-/g,''),to=$('#rsT',body).value.replace(/-/g,'');if(f&&to)refStatsLoad(st,{from:f,to});};
  $$('.rs-leg [data-k]',body).forEach(b=>b.onclick=()=>{const k=b.dataset.k;off[k]=!off[k];b.setAttribute('aria-pressed',!off[k]);draw();});
  let rw;const ro=window.ResizeObserver?new ResizeObserver(()=>{clearTimeout(rw);rw=setTimeout(()=>{if(!document.body.contains(c)){ro.disconnect();return;}if(Math.abs(Math.max(300,c.clientWidth)-(+c.dataset.w||0))>4)draw();},120);}):null;if(ro)ro.observe(c);
}
async function refAdmin(el){
  if(!getKey())return;
  let s;try{const r=await fetch('api/ref',{method:'POST',headers:{'content-type':'application/json','x-app-key':getKey()},body:JSON.stringify({action:'status'})});if(!r.ok)return;s=await r.json();}catch(e){return;}
  const host=$('.view',el)||el; if(!document.body.contains(host)||$('#refAdm',host))return;
  const box=document.createElement('div');box.className='panel';box.id='refAdm';
  const draw=()=>{box.innerHTML=`<h3>${REF_T.title}</h3><p class="note">${REF_T.note}</p>
    ${s.code?`<div class="row" style="align-items:center;gap:10px"><b style="font-size:22px;letter-spacing:.06em">${esc(s.code)}</b><span class="pill">${REF_T.used(s.used,s.max)}</span><button class="btn sm" id="refCp">${REF_T.copy}</button></div>`:`<p class="small">${REF_T.none}</p>`}
    <form class="row" id="refF" style="margin-top:8px"><input type="text" id="refC" value="${esc(s.code||'')}" placeholder="${REF_T.ph}" maxlength="24" style="flex:1 1 160px;text-transform:uppercase"><input type="number" id="refM" value="${s.max||50}" min="1" max="1000" style="width:90px"><button class="btn primary" type="submit">${REF_T.save}</button></form>
    <p class="small muted" id="refMsg">${REF_T.total(s.issued)}</p>`;
    const cp=$('#refCp',box);if(cp)cp.onclick=()=>{const t=REF_T.share(location.origin,s.code);try{navigator.clipboard.writeText(t);toast(REF_T.copied);}catch(e){prompt('',t);}};
    $('#refF',box).onsubmit=async e=>{e.preventDefault();const code=$('#refC',box).value.trim(),max=+$('#refM',box).value||50;
      try{const r=await fetch('api/ref',{method:'POST',headers:{'content-type':'application/json','x-app-key':getKey()},body:JSON.stringify({action:'set',code,max})});
        if(!r.ok){$('#refMsg',box).textContent=REF_T.bad;return;}s=await r.json();const keep=$('#refStats',box);draw();if(keep)box.appendChild(keep);toast(REF_T.saved);}catch(err){$('#refMsg',box).textContent=REF_T.bad;}};
  };
  draw();host.appendChild(box);
  const st=document.createElement('div');st.id='refStats';box.appendChild(st);refStatsLoad(st,{days:30});
}
{const _set=VIEWS.settings;VIEWS.settings=function(el){const r=_set.apply(this,arguments);Promise.resolve(r).then(()=>refAdmin(el));return r;};}
