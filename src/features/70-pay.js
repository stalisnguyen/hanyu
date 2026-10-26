/* ================= UPGRADE (paid plans, VietQR + SePay) =================
   #upgrade: plans for this app, tied to the Google account (api/pay.js). Buying shows a VietQR with the amount and a payment
   code (STA + 8 digits) in the transfer content; the money goes straight to the owner's bank account and SePay reports it
   to api/sepayhook, which opens access. The page polls api/pay 'check' and says thanks as soon as the transfer is seen. */
const PAY_T={title:"Nâng cấp Stalong",
  lead:"Gói dùng riêng cho Stalong, gắn với tài khoản Google nên dùng được trên mọi máy. Thanh toán bằng chuyển khoản VietQR, quyền tự mở trong khoảng một phút sau khi chuyển.",
  offline:"Thanh toán cần dùng bản online của app.",
  needSign:"Đăng nhập Google trước nhé. Gói được gắn với tài khoản của bạn.",
  month:"Gói tháng",
  year:"Gói năm",
  perMonth:"30 ngày dùng đầy đủ",
  buy:"Thanh toán VietQR",
  opening:"Đang tạo mã...",
  incl:"Gói gồm những gì",
  soon:"Thanh toán sẽ mở sớm (trước 15/11). Giá và gói đã hiện ở đây để bạn xem trước.",
  ownerNote:"Bạn là chủ app nên tài khoản này đã dùng đầy đủ.",
  scan:"Quét mã để thanh toán",
  scanNote:"Mở app ngân hàng, quét mã QR này, kiểm tra thông tin rồi xác nhận. Nếu đang dùng điện thoại, lưu ảnh QR hoặc chép thông tin bên dưới.",
  bank:"Ngân hàng",
  acc:"Số tài khoản",
  holder:"Chủ tài khoản",
  amount:"Số tiền",
  content:"Nội dung chuyển khoản",
  copy:"Chép",
  copied:"Đã chép.",
  waiting:"Đang chờ chuyển khoản. Trang này tự cập nhật.",
  stillWaiting:"Vẫn chưa thấy chuyển khoản. Nếu bạn đã chuyển, bấm Kiểm tra, hoặc email minhnguyen94.reve@gmail.com kèm mã thanh toán.",
  later:"Để sau",
  check:"Kiểm tra thanh toán",
  fine:"Gói không tự gia hạn: hết hạn thì bạn chủ động mua tiếp. Hoàn tiền đầy đủ trong 7 ngày kể từ lần thanh toán đầu.",
  terms:"Điều khoản",
  notYet:"Chưa thấy chuyển khoản. Thường chỉ mất khoảng một phút, bạn thử lại sau ít phút nhé.",
  createFail:"Chưa tạo được mã thanh toán. Thử lại sau ít phút nhé.",
  upgrade:"Nâng cấp",
  extend:"Gia hạn",
  seePlans:"Xem gói trả phí",
  admTitle:"Doanh thu (SePay)",
  admReady:"SePay đã kết nối.",
  admNotReady:"SePay chưa kết nối (cần SEPAY_API_KEY, SEPAY_BANK, SEPAY_ACCOUNT trên Vercel).",
  admRev:"Tổng doanh thu",
  admHook:"Địa chỉ webhook dán vào SePay:",
  perks:["Trợ lý AI giải thích ngữ pháp, chữa câu, luyện hội thoại, 50 lượt mỗi ngày", "Giọng đọc tự nhiên và chấm phát âm khi luyện nói", "Đồng bộ tiến độ trên mọi máy", "Toàn bộ phần học miễn phí vẫn giữ nguyên"],
  mustContent:c=>`Giữ đúng nội dung chuyển khoản <b>${c}</b>, app dựa vào mã này để nhận ra bạn.`,
  money:n=>Number(n).toLocaleString('vi-VN')+'đ',
  best:s=>`Tiết kiệm ${s}%`,
  perYear:m=>`365 ngày, khoảng ${m} mỗi tháng`,
  thanks:d=>`Đã nhận thanh toán, cảm ơn bạn! Dùng đầy đủ đến hết ${d}.`,
  admHookOk:u=>`Đã đăng ký webhook: ${u}`};
const payLast={get(){try{return JSON.parse(localStorage.getItem('hanyu-order')||'null');}catch(e){return null;}},
  set(v){try{v?localStorage.setItem('hanyu-order',JSON.stringify(v)):localStorage.removeItem('hanyu-order');}catch(e){}}};
const payMoney=n=>PAY_T.money(n);
if(typeof UI_ALIAS==='object'&&UI_ALIAS)UI_ALIAS.upgrade='settings';
async function payPost(action,extra){
  const r=await fetch('api/pay',{method:'POST',headers:{'content-type':'application/json','x-app-key':getKey()},body:JSON.stringify(Object.assign({action},extra||{}))});
  return {ok:r.ok,status:r.status,j:await r.json().catch(()=>({}))};
}
async function payCheck(code){
  try{const r=await payPost('check',{code});if(r.ok&&r.j.paid){acctSet(r.j.acct);payLast.set(null);return r.j.acct;}if(r.status===404)payLast.set(null);}catch(e){}
  return null;
}
function payCopy(t){try{navigator.clipboard.writeText(String(t));toast(PAY_T.copied);}catch(e){prompt('',String(t));}}
/* the transfer box: QR, bank details with copy buttons, live wait for the money */
function payBox(host,o,onPaid){
  const row=(l,v,c)=>`<div class="kv"><span>${l}</span><b>${esc(v)}${c?` <button class="btn ghost sm" data-cp="${esc(c)}">${PAY_T.copy}</button>`:''}</b></div>`;
  host.innerHTML=`<div class="panel pay-box"><h3>${PAY_T.scan}</h3>
    <img class="pay-qr" src="${esc(o.qr)}" alt="VietQR" width="260" height="260">
    <p class="small muted" style="margin:4px 0 10px">${PAY_T.scanNote}</p>
    ${row(PAY_T.bank,o.bank)}${row(PAY_T.acc,o.account,o.account)}${o.name?row(PAY_T.holder,o.name):''}
    ${row(PAY_T.amount,payMoney(o.amount),o.amount)}${row(PAY_T.content,o.code,o.code)}
    <p class="note">${PAY_T.mustContent(o.code)}</p>
    <p class="small pay-wait" id="payWait"><span class="pay-dot"></span>${PAY_T.waiting}</p>
    <div class="row" style="gap:8px"><button class="btn sm" id="payNow">${PAY_T.check}</button><button class="btn ghost sm" id="payX">${PAY_T.later}</button></div></div>`;
  $$('[data-cp]',host).forEach(b=>b.onclick=()=>payCopy(b.dataset.cp));
  let stop=false,n=0;
  const tick=async()=>{if(stop||!document.body.contains(host))return;const a=await payCheck(o.code);
    if(a){stop=true;onPaid(a);return;} if(++n<200)setTimeout(tick,n<60?4000:10000);
    else{const w=$('#payWait',host);if(w)w.textContent=PAY_T.stillWaiting;}};
  setTimeout(tick,4000);
  $('#payNow',host).onclick=async()=>{const a=await payCheck(o.code);if(a){stop=true;onPaid(a);}else toast(PAY_T.notYet,5000);};
  $('#payX',host).onclick=()=>{stop=true;host.innerHTML='';};
  host.scrollIntoView({behavior:'smooth',block:'start'});
}
VIEWS.upgrade=async el=>{
  el.innerHTML=`<div class="view up"><div class="panel"><h3>${PAY_T.title}</h3><p class="note">${PAY_T.lead}</p><div id="upAcct"></div></div>
    <div class="up-plans" id="upPlans"></div><div id="upPay"></div><div class="panel" id="upMore"></div></div>`;
  for(let i=0;i<40&&WEB===null;i++)await new Promise(r=>setTimeout(r,150)); /* first load: wait for api/status */
  if(!document.body.contains(el)||current!=='upgrade')return;
  if(!WEB){$('#upAcct',el).innerHTML=`<p class="small">${PAY_T.offline}</p>`;return;}
  const a=acctGet(), box=$('#upAcct',el);
  if(!a){box.innerHTML=`<p class="small">${PAY_T.needSign}</p><div id="upG" style="min-height:44px"></div><p class="small" id="upMsg"></p>`;
    authButton($('#upG',el),async()=>{await initPlatform();if(current==='upgrade')VIEWS.upgrade(el);},e=>{$('#upMsg',el).textContent=e;});}
  else box.innerHTML=`${acctFace(a)}<div class="kv"><span>${AUTH_T.access}</span><b>${acctLine(a)}</b></div>`;
  let info={ready:false,plans:{month:{amount:49000,days:30},year:{amount:399000,days:365}}};
  try{const r=await payPost('info');if(r.ok)info=r.j;}catch(e){}
  const m=info.plans.month,y=info.plans.year,save=Math.round((1-y.amount/(m.amount*12))*100);
  const card=(k,p,extra,best)=>`<div class="panel up-plan${best?' best':''}">${best?`<span class="pill">${PAY_T.best(save)}</span>`:''}
    <h3>${k==='month'?PAY_T.month:PAY_T.year}</h3><div class="up-price">${payMoney(p.amount)}</div><p class="small muted">${extra}</p>
    <button class="btn ${best?'primary':''}" data-plan="${k}" ${info.ready&&a&&!a.owner?'':'disabled'}>${PAY_T.buy}</button></div>`;
  $('#upPlans',el).innerHTML=card('month',m,PAY_T.perMonth)+card('year',y,PAY_T.perYear(payMoney(Math.round(y.amount/12/1000)*1000)),true);
  $('#upMore',el).innerHTML=`<h3>${PAY_T.incl}</h3><ul class="small">${PAY_T.perks.map(x=>`<li>${x}</li>`).join('')}</ul>
    ${info.ready?'':`<p class="note">${PAY_T.soon}</p>`}${a&&a.owner?`<p class="note">${PAY_T.ownerNote}</p>`:''}
    <p class="small muted">${PAY_T.fine} <a href="https://stalis-study.vercel.app/terms.html" target="_blank" rel="noopener">${PAY_T.terms}</a></p>`;
  const paid=acct=>{toast(PAY_T.thanks(authDate(acct.paidUntil)),7000);if(current==='upgrade')VIEWS.upgrade(el);};
  $$('[data-plan]',el).forEach(b=>b.onclick=async()=>{
    b.disabled=true;const old=b.textContent;b.textContent=PAY_T.opening;
    let r;try{r=await payPost('create',{plan:b.dataset.plan});}catch(e){r={ok:false,j:{}};}
    b.disabled=false;b.textContent=old;
    if(r.ok&&r.j.code){const o=Object.assign({at:Date.now()},r.j);payLast.set(o);payBox($('#upPay',el),o,paid);return;}
    toast(r.status===401?PAY_T.needSign:PAY_T.createFail,5000);
  });
  /* an unfinished order from before: show it again so the person can pay or check */
  const last=payLast.get();
  if(last&&a&&last.code&&Date.now()-(last.at||0)<7*864e5){const done=await payCheck(last.code);if(done)paid(done);else if(payLast.get())payBox($('#upPay',el),last,paid);}
};
/* owner: sales so far and the webhook address to give SePay */
async function payAdmin(host){
  if(!getKey()||$('#payAdm',host))return;
  let s;try{const r=await payPost('sales');if(!r.ok)return;s=r.j;}catch(e){return;}
  if(!document.body.contains(host)||$('#payAdm',host))return;
  const b=document.createElement('div');b.className='panel';b.id='payAdm';
  b.innerHTML=`<h3>${PAY_T.admTitle}</h3><p class="small">${s.ready?PAY_T.admReady:PAY_T.admNotReady}</p>
    <div class="kv"><span>${PAY_T.admRev}</span><b>${payMoney(s.revenue)}</b></div><div class="kv"><span>${PAY_T.month}</span><b>${s.month}</b></div><div class="kv"><span>${PAY_T.year}</span><b>${s.year}</b></div>
    <p class="small muted">${PAY_T.admHook} <code>${esc(s.hook)}</code></p>`;
  host.appendChild(b);
}
function payBtn(a){return a.owner?'':`<button class="btn ${a.active?'':'primary'} sm" id="acUp">${a.paidUntil>Date.now()?PAY_T.extend:PAY_T.upgrade}</button>`;}
{const _ap=authPanel;authPanel=function(el,host){_ap(el,host);payAdmin(host);};}
{const _am=authMount;authMount=function(m,done){_am(m,done);const a=acctGet();
  if(a&&!a.active&&!$('#upGo',m.el)){const f=$('#pwF',m.el);if(f)f.insertAdjacentHTML('afterend',`<button class="btn sm" id="upGo" style="margin-top:8px">${PAY_T.seePlans}</button>`);
    const g=$('#upGo',m.el);if(g)g.onclick=()=>{m.close();go('upgrade');};}};}
