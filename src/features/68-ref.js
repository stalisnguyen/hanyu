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
function refStatsHTML(t){
  const pct=o=>o.of?Math.round(o.back/o.of*100)+'%':'-', d0=t.daily[0], ai=x=>x.ai+x.stt;
  const sum=k=>t.daily.slice(0,7).reduce((a,x)=>a+(typeof k==='function'?k(x):x[k]),0);
  return `<h3 style="margin-top:14px">${REF_T.st.title}</h3>
   <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">${[[REF_T.st.today,d0.active],[REF_T.st.week,t.active7],[REF_T.st.fresh7,sum('fresh')],[REF_T.st.learners,t.learners],[REF_T.st.ai7,sum(ai)],[REF_T.st.aiu,d0.aiUsers]].map(([l,v])=>`<div style="background:var(--sunk);border-radius:12px;padding:8px 10px"><div class="small muted">${l}</div><b style="font-size:20px">${v}</b></div>`).join('')}</div>
   <p class="small" style="margin:10px 0 4px"><b>${REF_T.st.ret}</b> ${[1,7,30].map(n=>`D${n}: <b>${pct(t.retention[n])}</b> <span class="muted">(${t.retention[n].back}/${t.retention[n].of})</span>`).join(' &nbsp; ')}</p>
   <p class="small muted" style="margin:0 0 8px">${REF_T.st.retNote}</p>
   <div style="overflow-x:auto"><table class="small" style="width:100%;border-collapse:collapse"><tr class="muted"><th style="text-align:left">${REF_T.st.day}</th><th>${REF_T.st.active}</th><th>${REF_T.st.new}</th><th>AI</th></tr>
   ${t.daily.map(x=>`<tr><td>${x.day.slice(6)}/${x.day.slice(4,6)}</td><td style="text-align:center">${x.active}</td><td style="text-align:center">${x.fresh}</td><td style="text-align:center">${ai(x)}</td></tr>`).join('')}</table></div>`;
}
async function refAdmin(el){
  if(!getKey()||/^[a-f0-9]{40}$/.test(getKey()))return;
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
  try{const r=await fetch('api/ref',{method:'POST',headers:{'content-type':'application/json','x-app-key':getKey()},body:JSON.stringify({action:'stats'})});
    if(r.ok){const st=document.createElement('div');st.id='refStats';st.innerHTML=refStatsHTML(await r.json());box.appendChild(st);}}catch(e){}
}
{const _set=VIEWS.settings;VIEWS.settings=function(el){const r=_set.apply(this,arguments);Promise.resolve(r).then(()=>refAdmin(el));return r;};}
