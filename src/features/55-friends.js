/* ================= PROFILES + STUDY GROUP (Bạn học) =================
   Each learner: name + slug + the account they sign in with (web sync). Older devices may still hold a group password + PIN.
   Board: api/board returns everyone's weekly XP, streak and rank. */
function uiName(){return WHO&&WHO.name?WHO.name:'bạn';}
function uiMonday(){const t=today();return ymd(t-((new Date(t).getDay()+6)%7)*DAY);}
function uiSummary(){
  let wxp=0;const mon=today()-((new Date(today()).getDay()+6)%7)*DAY;
  for(let d=mon;d<=today();d+=DAY){const x=(P.day||{})[ymd(d)];if(x)wxp+=x.xp||0;}
  return {name:uiName(),wxp,xp:plXPTotal(),streak:streak(),rank:mcRankIdx(),known:Object.keys(P.srs).filter(known).length,today:plDay().xp||0,week:uiMonday()};
}
function askPin(wrong){
  return new Promise(res=>{
    const m=modal(`<h2>Mã PIN của ${esc(uiName())}</h2>
      <p class="note">${wrong?'Mã PIN chưa đúng. Nhập lại nhé.':'Mỗi người học có một mã PIN riêng để giữ tiến độ của mình, không ai ghi đè được. Lần đầu nhập là lúc đặt PIN (4 đến 6 số), nhớ nó để dùng trên máy khác.'}</p>
      <form id="pnF" class="row"><input type="password" inputmode="numeric" id="pnI" autocomplete="off" placeholder="Mã PIN" maxlength="6" style="flex:1 1 160px"><button class="btn primary" type="submit">Xong</button></form>`);
    let done=false;const fin=v=>{if(done)return;done=true;res(v);};
    $('#pnF',m.el).onsubmit=e=>{e.preventDefault();const v=$('#pnI',m.el).value.trim();if(v.length<4){toast('PIN cần 4 đến 6 số.');return;}
      if(!WHO)WHO={name:'Stalis',slug:'stalis'};WHO.pin=v;store.set('hanyu-who',WHO);m.close();fin(true);};
    const obs=new MutationObserver(()=>{if(!document.body.contains(m.el)){obs.disconnect();fin(false);}});obs.observe(document.body,{childList:true});
    setTimeout(()=>$('#pnI',m.el).focus(),50);
  });
}
/* switch or create a learner on this device */
async function setProfile(name,pin){
  const slug=slugOf(name); if(!slug)return false;
  const first=!WHO;
  if(!first&&WHO.slug!==slug){clearTimeout(syncTimer);if(dirty.size){try{await pushRemote();}catch(e){}}}
  WHO={name:name.trim().slice(0,30),slug,pin:pin||''}; store.set('hanyu-who',WHO);
  const saved=store.get(PKEY(),null);
  if(first&&!saved){store.set(PKEY(),P);}           // fresh device: keep what was done before naming
  else{P=Object.assign(structuredClone(DEFAULT),saved||{});P.settings=Object.assign({},DEFAULT.settings,P.settings||{});}
  queue=[];dirty=new Set();applySettings();
  if(SYNC==='web'&&getKey()){await pullRemote();renderSync();}
  route();return true;
}
function profileForm(fresh){
  return `<div class="pf"><label class="pf-l">Tên của bạn<input type="text" id="pfN" maxlength="30" placeholder="Ví dụ: Minh Anh" value="${fresh?'':esc(WHO?WHO.name:'')}"></label></div>`;
}
function switchProfile(){
  const a=typeof acctGet==='function'&&acctGet();
  if(a){const m=modal(`<h2>Đổi người học</h2><p class="note">Máy này đang đăng nhập bằng <b>${esc(a.email||a.name||'')}</b>. Để người khác học trên máy này, đăng xuất rồi nhập tên người đó. Họ đăng nhập Google của họ để giữ tiến độ riêng.</p><div class="row"><button class="btn primary" id="pfOut">Đăng xuất và đổi người</button><button class="btn ghost" id="pfNo">Thôi</button></div>`);
    $('#pfNo',m.el).onclick=()=>m.close();
    $('#pfOut',m.el).onclick=async()=>{m.close();await authLogout();await initPlatform();switchProfile();};return;}
  const m=modal(`<h2>Đổi người học</h2><p class="note">Máy dùng chung thì mỗi người nhập tên của mình, tiến độ của từng người lưu riêng trên máy này. Đăng nhập Google để học tiếp trên máy khác.</p>${profileForm(true)}<div class="row"><button class="btn primary" id="pfGo">Vào học</button></div>`);
  $('#pfGo',m.el).onclick=async()=>{const n=$('#pfN',m.el).value.trim();if(!slugOf(n)){toast('Nhập tên trước nhé.');return;}m.close();await setProfile(n,'');toast('Chào '+n+'!');};
}

/* ---------- Bạn học view ---------- */
let BOARD=null, BOARD_AT=0, BOARD_ME='';
async function boardLoad(force){
  if(!WEB||!WEB.sync||!getKey())return null;
  if(!force&&BOARD&&Date.now()-BOARD_AT<60000)return BOARD;
  try{const j=await api('api/board',{method:'GET'});BOARD=(j.list||[]);BOARD_ME=j.me||'';BOARD_AT=Date.now();}catch(e){return BOARD;}
  return BOARD;
}
function boardRows(list){
  const mon=uiMonday();
  return list.map(x=>Object.assign({},x,{wxp:x.week===mon?x.wxp:0,today:x.week===mon&&ymd(x.upd||0)===ymd(Date.now())?x.today:0}))
    .sort((a,b)=>b.wxp-a.wxp||b.streak-a.streak);
}
VIEWS.friends=async el=>{
  const link=location.origin&&location.protocol.startsWith('http')&&!IN_ARTIFACT?location.origin:'https://hanyu-ecru.vercel.app';
  const invite=`<div class="panel"><h3>Mời người thân cùng học</h3>
    <ol class="inv"><li>Gửi link <b>${esc(link.replace(/^https?:\/\//,''))}</b> cho bạn bè.</li><li>Họ mở link, nhập tên và đăng nhập Google.</li><li>Học xong bài đầu tiên là tên họ hiện trên bảng này.</li></ol>
    <div class="row"><button class="btn sm" id="frCopy">${ic('repeat')} Sao chép lời mời</button><button class="btn ghost sm" id="frSw">Đổi người học trên máy này</button></div></div>`;
  if(IN_ARTIFACT||!WEB||!WEB.sync){
    el.innerHTML=`<div class="view">${mcSay('idea','Bảng bạn học chạy trên bản web. Mở Stalong trên web để học cùng nhau nhé.',64)}${invite}</div>`;bindInv();return;}
  if(!getKey()){el.innerHTML=`<div class="view">${mcSay('hi','Đăng nhập Google (hoặc nhập mã mời) để xem cả nhóm đang học thế nào.',64)}<button class="btn primary" id="frKey" style="align-self:flex-start">Đăng nhập hoặc nhập mã</button>${invite}</div>`;
    $('#frKey').onclick=async()=>{if(await askPassword(false)){await initPlatform();VIEWS.friends(el);}};bindInv();return;}
  el.innerHTML='<div class="view"><p class="note">Đang tải bảng...</p></div>';
  const list=boardRows((await boardLoad(true))||[]);
  const me=BOARD_ME||(WHO?WHO.slug:'');
  el.innerHTML=`<div class="view">
    <div class="spread"><h2>Tuần này</h2><span class="note">Xếp theo XP từ thứ Hai</span></div>
    ${list.length?`<div class="board">${list.map((x,i)=>`<div class="bd-row ${x.slug===me?'me':''}"><span class="bd-pos num">${i+1}</span><span class="bd-mc">${mascotSVG(x.today?'hi':'zzz',48,x.rank||0)}</span>
      <span class="bd-n"><b>${esc(x.name)}${x.slug===me?' <span class="pill ai">bạn</span>':''}</b><span class="small muted">${PL_RANKS[x.rank||0][2]} <span class="han">${PL_RANKS[x.rank||0][1]}</span>, ${x.known||0} từ đã thuộc</span></span>
      <span class="bd-st"><span class="bd-x num">${ic('zap')}${x.wxp}</span><span class="bd-f num ${x.streak?'':'cold'}">${ic('flame')}${x.streak}</span></span></div>`).join('')}</div>`
      :mcSay('zzz','Chưa ai lên bảng. Học xong một bài là tên bạn sẽ hiện ở đây.',64)}
    ${list.length===1?mcSay('idea','Một mình thì hơi buồn. Rủ thêm người cùng học cho vui nhé.',56):''}
    ${invite}</div>`;
  bindInv();
  function bindInv(){
    const c=$('#frCopy');if(c)c.onclick=()=>{const t=`Học tiếng Trung cùng mình trên Stalong 思龙 nhé: ${link}\nMở link, nhập tên và đăng nhập Google là xong.`;
      (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Đã sao chép lời mời.')).catch(()=>toast(t,6000));};
    const s=$('#frSw');if(s)s.onclick=switchProfile;
  }
};
/* small board card on Today */
async function uiFriendsCard(){
  const side=$('.hm-side');if(!side)return;
  const list=await boardLoad(false);if(!list||list.length<2||current!=='home')return;
  const rows=boardRows(list).slice(0,3),me=BOARD_ME||(WHO?WHO.slug:'');
  if(!side.isConnected||$('#hmFr'))return;
  side.insertAdjacentHTML('beforeend',`<button class="panel fr-mini" id="hmFr"><span class="label">Bạn học tuần này</span>${rows.map((x,i)=>`<span class="fr-r ${x.slug===me?'me':''}"><span class="num">${i+1}</span><span class="fr-mc">${mascotSVG('calm',30,x.rank||0)}</span><b>${esc(x.name)}</b><span class="num muted">${x.wxp} XP</span></span>`).join('')}</button>`);
  const fr=$('#hmFr',side);if(fr)fr.onclick=()=>go('friends');
}

/* Today: remind to turn on sync when this device has no group password yet */
function uiSyncBanner(){
  if(!WEB||!WEB.sync||getKey()||current!=='home'||$('#syBan'))return;
  const v=$('#view .view');if(!v)return;
  v.insertAdjacentHTML('afterbegin',`<div class="vbanner" id="syBan">${mcSay('idea','Máy này chưa đồng bộ, tiến độ chỉ lưu tại đây. Đăng nhập Google (hoặc nhập mã mời) để mở tiến độ của bạn từ máy khác.',48)}<div class="row"><button class="btn primary sm" id="syGo">Đăng nhập hoặc nhập mã</button></div></div>`);
  $('#syGo').onclick=async()=>{if(await askPassword(false)){await initPlatform();route();toast(syncState==='on'?'Đã đồng bộ.':'Chưa đồng bộ được, thử lại sau.');}};
}
