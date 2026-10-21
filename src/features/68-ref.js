/* ================= INVITE CODE (REF) =================
   New people unlock AI and sync with a shared invite code (limited places, see api/ref.js) instead of the group password.
   The password box accepts either: an invite code is exchanged for a personal access key, anything else is kept as the password.
   Whoever holds the group password sees an admin panel in Settings to set the code and the number of places. */
const REF_T={ok:(n,m)=>`Đã mở khóa. Bạn là người thứ ${n}/${m} dùng mã này.`,full:m=>`Mã này đã đủ ${m} người. Bạn nhắn người chia sẻ để xin mã mới nhé.`,slow:'Bạn thử nhiều lần quá. Đợi một lúc rồi nhập lại.',
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
  setKey(v);return true;
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
        if(!r.ok){$('#refMsg',box).textContent=REF_T.bad;return;}s=await r.json();draw();toast(REF_T.saved);}catch(err){$('#refMsg',box).textContent=REF_T.bad;}};
  };
  draw();host.appendChild(box);
}
{const _set=VIEWS.settings;VIEWS.settings=function(el){const r=_set.apply(this,arguments);Promise.resolve(r).then(()=>refAdmin(el));return r;};}
