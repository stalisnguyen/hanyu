/* ================= GOOGLE SIGN-IN =================
   Signing in with Google gives this device a key tied to the person's account (api/auth.js), so access follows them to any device.
   A device that already had the group password or an invite key passes that beta access on to the account.
   While signed in, an invite code typed in the password box unlocks the account instead of only this device. */
const AUTH_T={loc:"vi",
  title:"Tài khoản",
  why:"Đăng nhập bằng Google để lưu tiến độ, học tiếp trên máy khác và giữ quyền dùng trợ lý AI. App chỉ nhận tên, email và ảnh đại diện của bạn.",
  or:"hoặc nhập mã mời",
  needCode:"Tài khoản này chưa có gói đang dùng. Mua gói để tiếp tục dùng trợ lý AI, tiến độ học vẫn được lưu bình thường. Có mã mời thì nhập bên dưới.",
  access:"Quyền dùng",
  owner:"Chủ app, dùng không giới hạn",
  betaEnded:"Đã hết thời gian beta miễn phí",
  none:"Chưa có gói",
  ended:"Hết hạn dùng thử",
  enterCode:"Nhập mã mời",
  out:"Đăng xuất khỏi máy này",
  outQ:"Đăng xuất khỏi máy này? Tiến độ học trên máy vẫn giữ nguyên.",
  outDone:"Đã đăng xuất.",
  unlocked:"Đã mở trợ lý AI cho tài khoản này.",
  signedNeed:"Đã đăng nhập, tiến độ được lưu theo tài khoản. Trợ lý AI cần gói trả phí.",
  fail:"Đăng nhập chưa được. Thử lại sau ít phút nhé.",
  slow:"Bạn thử nhiều lần quá. Đợi một lúc rồi thử lại.",
  again:"Phiên đăng nhập đã hết. Đóng hộp này rồi đăng nhập lại nhé.",
  noGis:"Không tải được nút đăng nhập Google. Kiểm tra mạng hoặc trình chặn quảng cáo rồi tải lại trang.",
  nudgeTitle:"Đăng nhập để học liền mạch",
  needTitle:"Tài khoản chưa có gói",
  nudgeText:"Lưu tiến độ theo tài khoản để học tiếp trên mọi máy và mở trợ lý AI. Phần học miễn phí vẫn dùng được khi chưa đăng nhập.",
  later:"Để sau",
  inTitle:"Lưu tiến độ của bạn",
  inText:"Đăng nhập Google để không mất bài đã học khi đổi máy và học tiếp trên điện thoại hay máy tính. Trợ lý AI cũng cần đăng nhập. Chưa muốn thì bấm Để sau, tiến độ vẫn lưu trên máy này.",
  inSkip:"Để sau, học luôn",
  inAppTitle:"Đăng nhập Google không chạy trong trình duyệt của Facebook, Messenger hay Zalo.",
  inAppSteps:"Bấm dấu ba chấm ở góc màn hình, chọn \"Mở bằng trình duyệt\" (hoặc Safari, Chrome), rồi đăng nhập ở đó. Hoặc chép link và dán vào trình duyệt.",
  copyLink:"Chép link",
  linkCopied:"Đã chép link. Dán vào Safari hoặc Chrome nhé.",
  adm:"Tài khoản Google",
  admTrial:"Số ngày dùng thử cho tài khoản mới (0 = tắt, để 0 trong giai đoạn beta)",
  admLimit:"Lượt AI mỗi người mỗi ngày",
  admBeta:"Ngày miễn phí cuối cùng của beta",
  admSave:"Lưu",
  admSaved:"Đã lưu.",
  hi:n=>`Chào ${n}, bạn đã đăng nhập.`,
  trial:d=>`Dùng thử đến ${d}`,
  paid:d=>`Đã mua, dùng đến ${d}`,
  admN:n=>`${n} tài khoản đã đăng nhập.`,
  beta:d=>`Beta miễn phí đến hết ${d}`};
const AUTH_CID='764861746953-4nsjobj6ca8cm8tpt5srgo03u18hpjs2.apps.googleusercontent.com';
const acctGet=()=>{try{const a=JSON.parse(localStorage.getItem('hanyu-acct')||'null');return a&&getKey()&&a.k===getKey().slice(0,8)?a:null;}catch(e){return null;}};
const acctSet=a=>{try{a?localStorage.setItem('hanyu-acct',JSON.stringify(Object.assign({},a,{k:getKey().slice(0,8)}))):localStorage.removeItem('hanyu-acct');}catch(e){}};
let gisP=null;
function loadGIS(){
  return gisP||(gisP=new Promise((ok,no)=>{
    if(window.google&&google.accounts&&google.accounts.id)return ok();
    const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;
    s.onload=()=>ok();s.onerror=()=>{gisP=null;no(new Error('gis'));};document.head.appendChild(s);
  }));
}
async function authPost(action,extra){
  const r=await fetch('api/auth',{method:'POST',headers:{'content-type':'application/json','x-app-key':getKey()},body:JSON.stringify(Object.assign({action},extra||{}))});
  return {ok:r.ok,status:r.status,j:await r.json().catch(()=>({}))};
}
/* Google button in box; onAcct(acct) once the server has accepted the sign-in */
/* Facebook, Messenger, Instagram, Zalo, Line... open links in their own browser, where Google refuses to sign in */
const authInApp=()=>/FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Zalo|Line\/|MicroMessenger|TikTok|musical_ly|BytedanceWebview/i.test(navigator.userAgent||'');
function authInAppHTML(){return `<div class="g-inapp"><p class="small"><b>${AUTH_T.inAppTitle}</b></p><p class="small">${AUTH_T.inAppSteps}</p>
  <button class="btn sm" type="button" data-cplink>${AUTH_T.copyLink}</button></div>`;}
async function authButton(box,onAcct,onErr){
  if(box)box.classList.add('g-host');
  if(authInApp()){box.innerHTML=authInAppHTML();const b=$('[data-cplink]',box);if(b)b.onclick=()=>{const u=location.origin+location.pathname;
    try{navigator.clipboard.writeText(u);toast(AUTH_T.linkCopied);}catch(e){prompt('',u);}};return;}
  try{await loadGIS();}catch(e){box.innerHTML=`<p class="small">${AUTH_T.noGis}</p>`;return;}
  /* phones and home-screen apps: full-page redirect, because the popup window cannot report back there */
  const redirect=navigator.standalone===true||matchMedia('(display-mode: standalone)').matches||matchMedia('(pointer: coarse)').matches;
  if(redirect){google.accounts.id.initialize({client_id:AUTH_CID,auto_select:false,ux_mode:'redirect',login_uri:location.origin+'/api/gauth'});
    box.innerHTML='';google.accounts.id.renderButton(box,{theme:'outline',size:'large',text:'signin_with',shape:'pill',locale:AUTH_T.loc,width:250});return;}
  google.accounts.id.initialize({client_id:AUTH_CID,auto_select:false,cancel_on_tap_outside:true,callback:async resp=>{
    let r;try{r=await authPost('google',{credential:resp.credential});}catch(e){r={ok:false,j:{}};}
    if(!r.ok||!r.j.token){if(onErr)onErr(r.status===429?AUTH_T.slow:AUTH_T.fail);return;}
    setKey(r.j.token);acctSet(r.j.acct);onAcct(r.j.acct);
  }});
  box.innerHTML='';
  google.accounts.id.renderButton(box,{theme:'outline',size:'large',text:'signin_with',shape:'pill',locale:AUTH_T.loc,width:250});
}
const authDate=t=>new Date(t).toLocaleDateString(AUTH_T.loc==='vi'?'vi-VN':'en-GB',{day:'numeric',month:'numeric',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'});
function acctLine(a){
  if(a.owner)return AUTH_T.owner;
  if(a.paidUntil>Date.now())return AUTH_T.paid(authDate(a.paidUntil));
  if(a.beta&&a.betaUntil>Date.now())return AUTH_T.beta(authDate(a.betaUntil-1));
  if(a.trialEnd>Date.now())return AUTH_T.trial(authDate(a.trialEnd));
  if(a.beta)return AUTH_T.betaEnded;
  return a.trialEnd?AUTH_T.ended:AUTH_T.none;
}
const acctFace=a=>`<div class="acct-row">${a.pic?`<img src="${esc(a.pic)}" alt="" referrerpolicy="no-referrer">`:''}<div><b>${esc(a.name||a.email)}</b><div class="small muted">${esc(a.email)}</div></div></div>`;
/* called from askPassword: Google button on top; when signed in but not unlocked, the box asks for an invite code */
function authMount(m,done){
  const box=$('#gIn',m.el),or=$('#gOr',m.el);if(!box||!WEB)return;
  const msg=$('#pwMsg',m.el),note=$('.note',m.el);
  const signed=a=>{box.innerHTML=acctFace(a);if(or)or.hidden=true;if(note)note.textContent=AUTH_T.needCode;const h=$('h2',m.el);if(h)h.textContent=AUTH_T.needTitle;};
  const a=acctGet();
  if(a){signed(a);authPost('me').then(r=>{if(r.ok){acctSet(r.j.acct);if(r.j.acct.active)done();}}).catch(()=>{});return;}
  if(or)or.textContent=AUTH_T.or;
  authButton(box,acct=>{
    if(acct.active){toast(AUTH_T.hi(acct.name||acct.email),3500);done();return;}
    signed(acct);if(msg)msg.textContent='';setTimeout(()=>{const i=$('#pwI',m.el);if(i)i.focus();},50);
  },e=>{if(msg)msg.textContent=e;});
}
{const _rs=refSubmit;refSubmit=async(v,m)=>{
  if(!acctGet())return _rs(v,m);
  const msg=$('#pwMsg',m.el),btn=$('#pwF button',m.el);if(btn)btn.disabled=true;
  let r;try{r=await authPost('redeem',{code:v});}catch(e){r={ok:false,status:0,j:{}};}
  if(btn)btn.disabled=false;
  if(r.ok){acctSet(r.j.acct);toast(r.j.n?REF_T.ok(r.j.n,r.j.max):AUTH_T.unlocked,4500);return true;}
  if(r.status===401){setKey('');acctSet(null);if(msg)msg.textContent=AUTH_T.again;return false;}
  if(msg)msg.textContent=r.status===410?REF_T.full(r.j.max):r.status===429?REF_T.slow:REF_T.wrong;return false;
};}
async function authLogout(){
  try{await authPost('logout');}catch(e){}
  try{if(window.google&&google.accounts&&google.accounts.id)google.accounts.id.disableAutoSelect();}catch(e){}
  setKey('');acctSet(null);
}
function authPanel(el,host){
  if(!WEB||$('#acctP',host))return;
  const p=document.createElement('div');p.className='panel';p.id='acctP';
  const a=acctGet();
  const draw=a=>{
    if(a){p.innerHTML=`<h3>${AUTH_T.title}</h3>${acctFace(a)}<div class="kv"><span>${AUTH_T.access}</span><b>${acctLine(a)}</b></div>${typeof payHint==='function'?payHint(a):''}
      <div class="row" style="gap:8px">${typeof payBtn==='function'?payBtn(a):''}${a.active?'':`<button class="btn sm" id="acCode">${AUTH_T.enterCode}</button>`}<button class="btn ghost sm" id="acOut">${AUTH_T.out}</button></div>`;
      const up=$('#acUp',p);if(up)up.onclick=()=>go('upgrade');
      const c=$('#acCode',p);if(c)c.onclick=async()=>{if(await askPassword(false)){await initPlatform();VIEWS.settings(el);}};
      $('#acOut',p).onclick=async()=>{if(!confirm(AUTH_T.outQ))return;await authLogout();toast(AUTH_T.outDone);await initPlatform();VIEWS.settings(el);};
    }else{p.innerHTML=`<h3>${AUTH_T.title}</h3><p class="note">${AUTH_T.why}</p><div id="acG" style="min-height:44px"></div><p class="small" id="acMsg"></p>`;
      authButton($('#acG',p),async acct=>{toast(acct.active?AUTH_T.hi(acct.name||acct.email):AUTH_T.signedNeed,4000);await initPlatform();VIEWS.settings(el);},e=>{$('#acMsg',p).textContent=e;});
    }
  };
  draw(a);
  /* first card in Settings, so the account and the paid plan are easy to find */
  const first=[...host.children].find(x=>x.classList&&x.classList.contains('panel'));
  host.insertBefore(p,first||null);
  if(a){[ '#stChg','#stOut','#stKey'].forEach(s=>{const b=$(s,host);if(b)b.remove();});
    authPost('me').then(r=>{if(r.ok){acctSet(r.j.acct);if(document.body.contains(p))draw(acctGet());}else if(r.status===401){setKey('');acctSet(null);VIEWS.settings(el);}}).catch(()=>{});}
}
/* onboarding step right after the name: optional Google sign-in (next() continues the intro) */
function introSignIn(box,next){
  box.innerHTML=`<div class="cele-mc">${mascot('idea',96)}</div><h2>${AUTH_T.inTitle}</h2><p>${AUTH_T.inText}</p><div id="inG" class="in-g"></div><p class="small" id="inMsg"></p><button class="in-skip" type="button" id="inSkip">${AUTH_T.inSkip}</button>`;
  $('#inSkip',box).onclick=next;
  authButton($('#inG',box),async acct=>{toast(acct.active?AUTH_T.hi(acct.name||acct.email):AUTH_T.signedNeed,4000);const nn=$('#acNudge');if(nn)nn.remove();await initPlatform();next();},e=>{$('#inMsg',box).textContent=e;});
}
const introAuthWanted=()=>!!(WEB&&WEB.sync)&&!acctGet();
/* owner only: how many accounts, and the free trial for new accounts (0 while the beta runs on invite codes) */
async function authAdmin(host){
  if(!getKey()||$('#acAdm',host))return;
  let s;try{const r=await fetch('api/ref',{method:'POST',headers:{'content-type':'application/json','x-app-key':getKey()},body:JSON.stringify({action:'status'})});if(!r.ok)return;s=await r.json();}catch(e){return;}
  if(!document.body.contains(host)||$('#acAdm',host))return;
  const b=document.createElement('div');b.className='panel';b.id='acAdm';
  const day=t=>{const d=new Date(t-1+7*36e5);return d.toISOString().slice(0,10);};
  b.innerHTML=`<h3>${AUTH_T.adm}</h3><p class="small">${AUTH_T.admN(s.accounts||0)}</p>
    <form id="acTF" style="display:grid;gap:8px">
      <label class="row small" style="justify-content:space-between">${AUTH_T.admLimit}<input type="number" id="acL" min="1" max="500" value="${s.ailimit||50}" style="width:90px"></label>
      <label class="row small" style="justify-content:space-between">${AUTH_T.admBeta}<input type="date" id="acB" value="${day(s.betaUntil)}" style="width:160px"></label>
      <label class="row small" style="justify-content:space-between">${AUTH_T.admTrial}<input type="number" id="acT" min="0" max="30" value="${s.trial||0}" style="width:90px"></label>
      <button class="btn sm" type="submit" style="justify-self:start">${AUTH_T.admSave}</button></form>`;
  $('#acTF',b).onsubmit=async e=>{e.preventDefault();
    const body={action:'set',trial:+$('#acT',b).value||0,ailimit:+$('#acL',b).value||50,betaLast:$('#acB',b).value};
    try{const r=await fetch('api/ref',{method:'POST',headers:{'content-type':'application/json','x-app-key':getKey()},body:JSON.stringify(body)});
      toast(r.ok?AUTH_T.admSaved:REF_T.bad);}catch(err){toast(REF_T.bad);}};
  host.appendChild(b);
}
/* one platform start at a time (boot and a sign-in can both ask for it), so the sync PIN box never shows twice */
{const _ip=initPlatform;let busy=null;initPlatform=async function(){while(busy){try{await busy;}catch(e){}}busy=_ip.apply(this,arguments);try{return await busy;}finally{busy=null;}};}
/* back from the redirect sign-in: #gauth=<one-time code> (or #gauth-error) */
{const h=location.hash;
  if(h==='#gauth-error'){try{history.replaceState(null,'',location.pathname+'#settings');}catch(e){}setTimeout(()=>toast(AUTH_T.fail,5000),1500);}
  else if(/^#gauth=[a-f0-9]{32}$/.test(h)){const code=h.slice(7);try{history.replaceState(null,'',location.pathname+'#settings');}catch(e){}
    setTimeout(async()=>{let r;try{r=await authPost('google',{code});}catch(e){r={ok:false,j:{}};}
      if(!r.ok||!r.j.token){toast(r.status===429?AUTH_T.slow:AUTH_T.fail,5000);return;}
      setKey(r.j.token);acctSet(r.j.acct);toast(r.j.acct.active?AUTH_T.hi(r.j.acct.name||r.j.acct.email):AUTH_T.signedNeed,4500);
      await initPlatform();go('settings');},300);}}
/* Home: a gentle invitation to sign in (not required for the free parts). "Later" hides it for 7 days. */
function authNudge(el){
  if(!WEB||acctGet()||!document.body.contains(el))return;
  const host=$('.view',el)||el;if($('#acNudge',host))return;
  let until=0;try{until=+localStorage.getItem('hanyu-nudge')||0;}catch(e){}
  if(Date.now()<until)return;
  const p=document.createElement('div');p.className='panel ac-nudge';p.id='acNudge';
  p.innerHTML=`<div class="ac-nudge-t"><b>${AUTH_T.nudgeTitle}</b><p class="small">${AUTH_T.nudgeText}</p></div><div class="ac-row"><div id="acNG"></div><button class="btn ghost sm" type="button" id="acNL">${AUTH_T.later}</button></div>`;
  host.insertBefore(p,host.firstChild);
  $('#acNL',p).onclick=()=>{try{localStorage.setItem('hanyu-nudge',String(Date.now()+7*864e5));}catch(e){}p.remove();};
  authButton($('#acNG',p),async acct=>{toast(acct.active?AUTH_T.hi(acct.name||acct.email):AUTH_T.signedNeed,4000);p.remove();await initPlatform();if(current==='home')route();},e=>toast(e,4000));
}
{const _home=VIEWS.home;VIEWS.home=function(el){const r=_home.apply(this,arguments);
  Promise.resolve(r).then(async()=>{for(let i=0;i<40&&WEB===null;i++)await new Promise(z=>setTimeout(z,150));authNudge(el);});return r;};}
{const _set=VIEWS.settings;VIEWS.settings=function(el){const r=_set.apply(this,arguments);
  Promise.resolve(r).then(()=>{const host=$('.view',el)||el;authPanel(el,host);authAdmin(host);});return r;};}
