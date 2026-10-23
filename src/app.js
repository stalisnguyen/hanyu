/* Sổ Tay Hán Ngữ - app logic. Runs both as a plain static site and inside a claude.ai artifact,
   where db (sync), user and sample (Claude) light up extra features. */
(function(){
'use strict';

/* ================= helpers ================= */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
const pick=a=>a[Math.random()*a.length|0];
const DAY=86400000;
const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d.getTime();};
const ymd=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const T1='āēīōūǖĀĒĪŌŪǕ',T2='áéíóúǘÁÉÍÓÚǗ',T3='ǎěǐǒǔǚǍĚǏǑǓǙ',T4='àèìòùǜÀÈÌÒÙǛ';
function toneOf(s){for(const c of s){if(T1.includes(c))return 1;if(T2.includes(c))return 2;if(T3.includes(c))return 3;if(T4.includes(c))return 4;}return 5;}
const isHan=c=>/[㐀-鿿豈-﫿]/.test(c);
const stripTone=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ü/g,'v').toLowerCase();
const viFold=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
const SPK='<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>';
function toast(msg,ms=2600){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),ms);}
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};

/* pinyin for arbitrary text (pinyin-pro), per character with tone class */
function pyChars(text){
  try{ if(window.pinyinPro) return window.pinyinPro.pinyin(text,{type:'all'}).map(o=>({c:o.origin,p:o.isZh?o.pinyin:''})); }catch(e){}
  return [...text].map(c=>({c,p:''}));
}
function rubyHTML(text){ // hanzi with ruby pinyin, tone colored
  return pyChars(text).map(o=>o.p?`<ruby class="t${toneOf(o.p)}">${esc(o.c)}<rt>${esc(o.p)}</rt></ruby>`:esc(o.c)).join('');
}
function colorText(text){return pyChars(text).map(o=>o.p?`<span class="t${toneOf(o.p)}">${esc(o.c)}</span>`:esc(o.c)).join('');}
function pyLine(text){ // plain pinyin line for a sentence
  try{ if(window.pinyinPro) return window.pinyinPro.pinyin(text,{toneType:'symbol',nonZh:'consecutive'}); }catch(e){}
  return '';
}
function sentPyHTML(s){return String(s).split(/(\s+)/).map(t=>/^\s+$/.test(t)?t:`<span class="t${toneOf(t)}">${esc(t)}</span>`).join('');}

/* ================= data ================= */
const LVS=[1,2,3,4,5,6,7]; const lvN=L=>L===7?'7-9':String(L);
/* phrase decks: 8 = 搭配 (collocations), 9 = 成语 (idioms). Chosen in P.settings.ph, kept apart from the HSK levels */
const PH_DECKS=[[8,'Cụm từ 搭配'],[9,'Thành ngữ 成语']]; const PH_NAME={8:'Cụm từ',9:'Thành ngữ'};
const lvLabel=L=>PH_NAME[L]||'HSK '+lvN(L);
const studyLv=()=>[...P.settings.lv,...(P.settings.ph||[])];
const inLv=(w,levels)=>levels.includes(w.lv)||(w.lv2!=null&&levels.includes(w.lv2));
const W=[]; const WI=new Map(); const LV_COUNT=[0,0,0,0,0,0,0,0,0,0]; let loadedLv=new Set();
let GRAM=[]; const TESTS={}; let STROKE_IDX=null; const STROKE_CACHE={};
async function loadLevel(L){
  if(loadedLv.has(L))return;
  const r=await fetch('data/words-'+L+'.json'); const rows=await r.json();
  if(loadedLv.has(L))return;
  rows.forEach((x,i)=>{const o=WI.get(x[0]);if(o){if(o.lv!==L)o.lv2=L;if(!o.note&&x[9])o.note=x[9];if(!o.alt&&x[10])o.alt=x[10];return;} /* same word in an HSK level and a phrase deck */
    const w={h:x[0],p:x[1].split(' '),hv:x[2],vi:x[3],em:x[4],ex:x[5],exp:x[6],exvi:x[7],cl:x[8]||[],note:x[9]||'',alt:x[10]||null,lv:L,i};W.push(w);WI.set(w.h,w);});
  LV_COUNT[L]=rows.length; loadedLv.add(L);
}
async function loadAllWords(){for(const L of LVS)await loadLevel(L);}
async function loadGrammar(){if(!GRAM.length){GRAM=await (await fetch('data/grammar.json')).json();}return GRAM;}
async function loadTests(L){if(!TESTS[L])TESTS[L]=await (await fetch('data/tests/hsk'+L+'.json')).json();return TESTS[L];}
async function strokeData(ch){
  if(!STROKE_IDX)STROKE_IDX=await (await fetch('data/strokes/index.json')).json();
  const L=STROKE_IDX[ch]; if(!L) return null;
  if(!STROKE_CACHE[L])STROKE_CACHE[L]=fetch('data/strokes/s'+L+'.json').then(r=>r.json());
  return (await STROKE_CACHE[L])[ch]||null;
}
function phExtra(w,card){
  const alt=w.alt&&w.alt.length?`<div class="small"><span class="muted">${w.lv===8?'Cùng kiểu kết hợp':'Gần nghĩa, trái nghĩa'}:</span> ${w.alt.map(a=>WI.get(a)?`<button class="lnk han" data-phw="${esc(a)}">${esc(a)}</button>`:`<span class="han">${esc(a)}</span>`).join(', ')}</div>`:'';
  return (w.note?`<div class="small ph-note">${esc(w.note)}</div>`:'')+alt;
}
function pyHTML(w){return w.p.map(s=>`<span class="t${toneOf(s)}">${esc(s)}</span>`).join('');}
function hanHTML(w){const ch=[...w.h];if(ch.length!==w.p.length)return esc(w.h);return ch.map((c,i)=>`<span class="t${toneOf(w.p[i])}">${c}</span>`).join('');}
function wordsAt(levels){return W.filter(w=>inLv(w,levels)).concat(P.custom.filter(()=>levels.includes(0)));}

/* ================= progress state ================= */
const DEFAULT={v:1,upd:0,settings:{lv:[1],newPerDay:10,py:true,color:true,hv:true,mode:'hz',voiceRate:0.75,voice:''},srs:{},hist:{},gram:{},tests:[],custom:[]};
/* profiles: each learner on a device has a name, a slug (storage + sync key) and an optional PIN */
const slugOf=n=>viFold(n).trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,30);
let WHO=store.get('hanyu-who',null);
if(!WHO&&(store.get('hanyu-p',{}).upd||0)>0){WHO={name:'Stalis',slug:'stalis'};store.set('hanyu-who',WHO);}
const PKEY=()=>!WHO||WHO.slug==='stalis'?'hanyu-p':'hanyu-p:'+WHO.slug;
let P=Object.assign(structuredClone(DEFAULT),store.get(PKEY(),{}));
P.settings=Object.assign({},DEFAULT.settings,P.settings||{});
let dirty=new Set();
function touch(part){P.upd=Date.now();dirty.add(part);store.set(PKEY(),P);scheduleSync();}
function card(h){return P.srs[h];}

/* SRS (SM-2 style) */
function schedule(h,r){ // r: 0 again,1 hard,2 good,3 easy
  const now=Date.now(); let c=P.srs[h]||{iv:0,ef:2.5,n:0,l:0,due:now,s:0};
  if(r===0){c.l++;c.n=0;c.iv=0;c.ef=Math.max(1.3,c.ef-0.2);c.due=now+60*1000;c.s=1;}
  else{
    if(r===1){c.iv=c.iv<1?1:Math.max(1,Math.round(c.iv*1.2));c.ef=Math.max(1.3,c.ef-0.15);}
    else if(r===2){c.iv=c.n===0?1:c.n===1?3:Math.round(c.iv*c.ef);}
    else{c.iv=c.n===0?4:Math.round(Math.max(c.iv,1)*c.ef*1.3);c.ef+=0.15;}
    c.n++;c.s=2;c.due=today()+c.iv*DAY;
  }
  P.srs[h]=c; const k=ymd(now); P.hist[k]=(P.hist[k]||0)+1; touch('srs'); touch('main');
  return c;
}
function ivLabel(h,r){
  const c=Object.assign({iv:0,ef:2.5,n:0},P.srs[h]||{});
  if(r===0)return '1 phút';
  let iv= r===1?(c.iv<1?1:Math.max(1,Math.round(c.iv*1.2))): r===2?(c.n===0?1:c.n===1?3:Math.round(c.iv*c.ef)) : (c.n===0?4:Math.round(Math.max(c.iv,1)*c.ef*1.3));
  return iv<30? iv+' ngày' : iv<365? Math.round(iv/30)+' tháng' : (iv/365).toFixed(1)+' năm';
}
const known=h=>{const c=P.srs[h];return c&&c.s===2&&c.iv>=7;};
const seen=h=>!!P.srs[h];
function dueList(levels){const now=Date.now();return W.filter(w=>inLv(w,levels)&&P.srs[w.h]&&P.srs[w.h].due<=now).sort((a,b)=>P.srs[a.h].due-P.srs[b.h].due);}
function newToday(){const t=today();return Object.values(P.srs).filter(c=>c.first>=t).length;}
/* new cards: when phrase decks are on, half of the new cards come from them, alternating with HSK words */
function newMix(limit,skip=[]){const ph=P.settings.ph||[];const nl=(lv,n)=>newList(lv,n+skip.length).filter(w=>!skip.includes(w)).slice(0,n);
  if(!ph.length)return nl(P.settings.lv,limit);
  /* per deck: its own new rows first (easier HSK first, as built), then 成语 that also sit in HSK 7-9; decks alternate */
  const fresh=w=>!P.srs[w.h]&&!skip.includes(w), per=ph.map(L=>[...W.filter(w=>w.lv===L&&fresh(w)),...W.filter(w=>w.lv2===L&&fresh(w))]);
  const a=[];for(let i=0;a.length<Math.ceil(limit/2)&&per.some(d=>i<d.length);i++)per.forEach(d=>{if(i<d.length&&a.length<Math.ceil(limit/2)&&!a.includes(d[i]))a.push(d[i]);});
  const b=nl(P.settings.lv,limit-a.length).filter(w=>!a.includes(w)), out=[];
  for(let i=0;out.length<limit&&(i<a.length||i<b.length);i++){if(i<b.length)out.push(b[i]);if(i<a.length&&out.length<limit)out.push(a[i]);}return out;}
function newList(levels,limit){const out=[];for(const w of W){if(out.length>=limit)break;if(inLv(w,levels)&&!P.srs[w.h])out.push(w);}return out;}
function streak(){let s=0,t=today();if(!P.hist[ymd(t)])t-=DAY;while(P.hist[ymd(t)]){s++;t-=DAY;}return s;}

/* ================= platform =================
   Two modes:
   - inside a claude.ai artifact: window.claude.use('db'|'user'|'sample')
   - standalone web (Vercel): /api/ai (Claude via the owner's API key) and /api/sync (Upstash Redis),
     both locked by the app password the owner sets in Vercel. */
let DB=null, UID=null, AI=null, syncState='local', SYNC=null, WEB=null;
const getKey=()=>{try{return localStorage.getItem('hanyu-key')||'';}catch(e){return '';}};
const setKey=v=>{try{v?localStorage.setItem('hanyu-key',v):localStorage.removeItem('hanyu-key');}catch(e){}};
async function initPlatform(){
  const C=window.claude;
  if(C&&typeof C.use==='function'){
    try{
      const [db,user,sample]=await Promise.all([C.use('db').catch(()=>null),C.use('user').catch(()=>null),C.use('sample').catch(()=>null)]);
      if(sample){AI=sample;refreshAIBits();}
      if(db&&user){const id=await user.id();if(id){DB=db;UID=id;SYNC='db';await pullRemote();}}
    }catch(e){console.warn(e);}
    if(AI||SYNC){renderSync();return;}
  }
  // standalone web
  try{
    const r=await fetch('api/status',{cache:'no-store'});
    if(r.ok){WEB=await r.json();
      if(WEB.ai){AI=makeWebAI();refreshAIBits();}
      if(WEB.sync){SYNC='web'; if(getKey()) await pullRemote(); else syncState='off';}
    }
  }catch(e){}
  renderSync();
  if(typeof uiSyncBanner==='function')uiSyncBanner();
}

/* ---- password modal (web mode) ---- */
function askPassword(wrong){
  return new Promise(res=>{
    const m=modal(`<h2>Mã mời hoặc mật khẩu nhóm</h2>
      <p class="note">${wrong?'Mật khẩu chưa đúng. Nhập lại.':'Nhập mã mời hoặc mật khẩu nhóm để mở trợ lý AI và đồng bộ tiến độ giữa các máy. Chỉ cần nhập một lần trên mỗi máy.'}</p>
      <div id="gIn"></div><p class="small muted" id="gOr"></p>
      <form id="pwF" class="row"><input type="password" id="pwI" autocomplete="current-password" placeholder="Mã mời hoặc mật khẩu" style="flex:1 1 200px"><button class="btn primary" type="submit">Mở khóa</button></form><p class="small" id="pwMsg" style="color:var(--bad,#c33)"></p>`);
    let done=false;
    const fin=v=>{if(done)return;done=true;res(v);};
    if(typeof authMount==='function')authMount(m,()=>{m.close();fin(true);});
    $('#pwF',m.el).onsubmit=async e=>{e.preventDefault();const v=$('#pwI',m.el).value.trim();if(!v)return;if(await refSubmit(v,m)){m.close();fin(true);}};
    const obs=new MutationObserver(()=>{if(!document.body.contains(m.el)){obs.disconnect();fin(false);}});obs.observe(document.body,{childList:true});
    setTimeout(()=>$('#pwI',m.el).focus(),50);
  });
}
async function api(path,{method='POST',body}={}){
  for(let i=0;i<3;i++){
    if(!getKey()){const ok=await askPassword(false);if(!ok)throw {code:'not_granted'};}
    let r;
    const hd={'content-type':'application/json','x-app-key':getKey()};if(WHO){hd['x-user']=WHO.slug;if(WHO.pin)hd['x-user-pin']=WHO.pin;}
    try{r=await fetch(path,{method,headers:hd,body:body?JSON.stringify(body):undefined});}
    catch(e){throw {code:'network'};}
    if(r.status===401){setKey('');const ok=await askPassword(true);if(!ok)throw {code:'not_granted'};continue;}
    if(r.status===402){if(path.includes('sync'))throw {code:'inactive'};const ok=await askPassword(false);if(!ok)throw {code:'not_granted'};continue;}
    if(r.status===429)throw {code:'rate_limited'};
    if(r.status===403||(r.status===400&&path.includes('sync'))){const ok=await askPin(r.status===403&&WHO&&WHO.pin);if(!ok)throw {code:'not_granted'};continue;}
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw {code:j.error||'upstream'};
    return j;
  }
  throw {code:'not_granted'};
}
function parseJSON(text){
  let t=String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
  try{return JSON.parse(t);}catch(e){}
  const a=Math.min(...['{','['].map(c=>{const k=t.indexOf(c);return k<0?1e9:k;})), b=Math.max(t.lastIndexOf('}'),t.lastIndexOf(']'));
  if(a<1e9&&b>a)return JSON.parse(t.slice(a,b+1));
  throw {code:'bad_json'};
}
function makeWebAI(){
  const call=async(input,opts={})=>{
    const messages=typeof input==='string'?[{role:'user',content:input}]:input;
    if(opts.onText)opts.onText({text:'AI đang viết...',delta:''});
    const j=await api('api/ai',{body:{messages,tier:opts.modelTier||'default'}});
    const text=String(j.text||'');
    if(opts.onText)opts.onText({text,delta:text});
    return {text,truncated:!!j.truncated};
  };
  call.json=async(input,opts={})=>{
    const msg=typeof input==='string'?input+'\n\nChỉ trả về JSON hợp lệ, không thêm chữ nào khác, không bọc trong ```.':input;
    const {text}=await call(msg,Object.assign({},opts,{onText:null}));
    return parseJSON(text);
  };
  return call;
}

/* ---- sync ---- */
function docRef(name){return DB.doc('data/users/'+UID+'/'+name);}
function adopt(m){P=Object.assign(structuredClone(DEFAULT),m);P.settings=Object.assign({},DEFAULT.settings,m.settings||{});store.set(PKEY(),P);applySettings();route(true);}
/* merge two progress documents (this device + cloud) without losing either side */
function mergeP(a,b){
  const newer=(a.upd||0)>=(b.upd||0)?a:b, older=newer===a?b:a;
  const m=JSON.parse(JSON.stringify(newer)), o=older;
  const card=(x,y)=>!x?y:!y?x:((x.n||0)!==(y.n||0)?((x.n||0)>(y.n||0)?x:y):((x.due||0)>=(y.due||0)?x:y));
  m.srs=m.srs||{};for(const [h,c] of Object.entries(o.srs||{}))m.srs[h]=card(m.srs[h],c);
  m.hist=m.hist||{};for(const [k,v] of Object.entries(o.hist||{}))m.hist[k]=Math.max(m.hist[k]||0,v||0);
  m.day=m.day||{};for(const [k,d] of Object.entries(o.day||{})){const t=m.day[k]=m.day[k]||{};for(const [f,v] of Object.entries(d||{}))if(typeof v==='number')t[f]=Math.max(t[f]||0,v);}
  for(const f of ['gram','cul']){m[f]=Object.assign({},o[f]||{},m[f]||{});}
  m.reads=m.reads||{};for(const [k,v] of Object.entries(o.reads||{}))m.reads[k]=Math.max(m.reads[k]||0,v||0);
  m.mist=Object.assign({},o.mist||{},m.mist||{});
  const seenT=new Set((m.tests||[]).map(t=>t.id+'|'+t.date));m.tests=(m.tests||[]).concat((o.tests||[]).filter(t=>!seenT.has(t.id+'|'+t.date))).sort((x,y)=>(x.date||0)-(y.date||0));
  const seenC=new Set((m.custom||[]).map(w=>w.h));m.custom=(m.custom||[]).concat((o.custom||[]).filter(w=>!seenC.has(w.h)));
  const seenR=new Set((m.reports||[]).map(r=>r.d));m.reports=(m.reports||[]).concat((o.reports||[]).filter(r=>!seenR.has(r.d)));
  if(o.games){m.games=m.games||{};for(const f of ['best','plays']){m.games[f]=m.games[f]||{};for(const [k,v] of Object.entries(o.games[f]||{}))m.games[f][k]=Math.max(m.games[f][k]||0,v||0);}}
  m.placed=m.placed||o.placed; m.culExtra=Math.max(m.culExtra||0,o.culExtra||0);
  m.upd=Date.now(); return m;
}
async function pullRemote(){
  try{
    if(SYNC==='web'){
      const j=await api('api/sync',{method:'GET'});
      if(j.data){const local=Object.keys(P.srs||{}).length+Object.keys(P.hist||{}).length;
        if(!local){adopt(j.data);syncState='on';return;}           // fresh device: take the cloud copy
        adopt(mergeP(P,j.data));}                                  // both have progress: merge, never overwrite
      syncState='on';dirty.add('main');await pushRemote();return;
    }
    const main=await docRef('main').get();
    if(main.exists){
      const m=main.data();
      if((m.upd||0)>(P.upd||0)){
        const srs={};
        for(const part of ['srs1','srs2','srs3','srs4','srs5','srs6','srs7','srs0']){const s=await docRef(part).get();if(s.exists)Object.assign(srs,s.data().cards||{});}
        adopt(Object.assign({},m,{srs}));syncState='on';return;
      }
    }
    syncState='on'; dirty.add('main');dirty.add('srs'); await pushRemote();
  }catch(e){console.warn('sync pull',e);syncState=e&&(e.code==='not_granted'||e.code==='inactive')?'off':'err';}
}
let syncTimer=null;
function scheduleSync(){if(!SYNC||syncState==='off')return;clearTimeout(syncTimer);syncTimer=setTimeout(pushRemote,2500);}
async function pushRemote(){
  if(!SYNC||!dirty.size)return; const parts=[...dirty]; dirty.clear();
  try{
    if(SYNC==='web'){await api('api/sync',{method:'PUT',body:{data:P,summary:typeof uiSummary==='function'?uiSummary():null}});}
    else{
      if(parts.includes('main')||parts.includes('srs')){const {srs,...main}=P; await docRef('main').set(JSON.parse(JSON.stringify(main)));}
      if(parts.includes('srs')){
        const by={};for(const [h,c] of Object.entries(P.srs)){const w=WI.get(h);const L=w?w.lv:0;(by[L]=by[L]||{})[h]=c;}
        for(const L of [0,1,2,3,4,5,6,7]){if(by[L])await docRef('srs'+L).set({cards:by[L]});}
      }
    }
    syncState='on';
  }catch(e){if(e&&e.code==='stale'){await pullRemote();renderSync();return;}console.warn('sync push',e);parts.forEach(p=>dirty.add(p));syncState=e&&(e.code==='not_granted'||e.code==='inactive')?'off':'err';}
  renderSync();
}
function renderSync(){
  const el=$('#sync');if(!el)return;
  el.className='sync'+(syncState==='on'?' on':'');
  const t=syncState==='on'?'Đã đồng bộ':syncState==='err'?'Lỗi đồng bộ, đang lưu trên máy':syncState==='off'?'Bấm để bật đồng bộ':'Lưu trên máy này';
  el.title=t;el.innerHTML='<i></i><span class="sync-t">'+t+'</span>';
  el.style.cursor=syncState==='off'||syncState==='err'?'pointer':'';
  el.onclick=(syncState==='off'||syncState==='err')?async()=>{await pullRemote();renderSync();}:null;
}
async function ask(prompt,opts={}){ if(!AI)throw {code:'no_ai'}; return AI(prompt,opts); }
async function askJSON(prompt,opts={}){ if(!AI)throw {code:'no_ai'}; return AI.json(prompt,opts); }
function aiError(e){
  const c=e&&e.code;
  if(c==='not_granted')return WEB?'Cần nhập mật khẩu ứng dụng để dùng phần này.':'Bạn chưa cho phép trang dùng AI. Mở menu Permissions của artifact để bật lại.';
  if(c==='rate_limited')return 'Đã chạm giới hạn lượt dùng miễn phí. Đợi một lúc (hoặc sang ngày mai) rồi thử lại.';
  if(c==='no_key')return 'Chưa có API key cho AI trong Vercel (GROQ_API_KEY, GEMINI_API_KEY hoặc ANTHROPIC_API_KEY).';
  if(c==='no_password')return 'Chưa đặt mật khẩu ứng dụng trong Vercel (biến APP_PASSWORD).';
  if(c==='billing')return 'Tài khoản API hết credit hoặc hết hạn mức miễn phí hôm nay.';
  if(c==='bad_json')return 'AI trả kết quả sai định dạng. Bấm thử lại.';
  return 'AI chưa trả lời được. Thử lại sau ít phút.';
}
function refreshAIBits(){$$('.need-ai').forEach(el=>el.hidden=!AI);$$('.no-ai').forEach(el=>el.hidden=!!AI);}

/* ================= speech =================
   Words and syllables: native recordings (audio-cmn, CC BY-SA).
   Sentences: the best Chinese voice the browser offers, at the chosen speed. */
let voices=[], AIDX=null; const ABUNDLE={}; let curAudio=null;
const IN_ARTIFACT=!!(window.claude&&typeof window.claude.use==='function');
function voiceScore(v){const n=v.name;let s=0;
  if(/zh[-_]CN/i.test(v.lang))s+=20; else if(/zh[-_]TW/i.test(v.lang))s+=5;
  if(/premium/i.test(n))s+=60; if(/enhanced|增强/i.test(n))s+=45; if(/natural|neural/i.test(n))s+=55; if(/xiaoxiao|xiaoyi|yunxi|yunjian/i.test(n))s+=40;
  if(/google/i.test(n))s+=35; if(/lili|yu-?shu|lilian/i.test(n))s+=25; if(/tingting|ting-ting/i.test(n))s+=10;
  if(/cantonese|粤|hk|sinji/i.test(n+v.lang))s-=50; return s;}
function loadVoices(){try{voices=speechSynthesis.getVoices().filter(v=>/^(zh|cmn)/i.test(v.lang));voices.sort((a,b)=>voiceScore(b)-voiceScore(a));}catch(e){}}
try{loadVoices();speechSynthesis.onvoiceschanged=()=>{loadVoices();if($('#vSel'))fillVoiceSel();};}catch(e){}
function pickVoice(alt){
  if(!voices.length)return null;
  const chosen=P.settings.voice&&voices.find(v=>v.name===P.settings.voice);
  const main=chosen||voices[0];
  if(!alt)return main;
  return voices.find(v=>v!==main&&!/cantonese|粤|hk|sinji/i.test(v.name+v.lang))||main;
}
const TTS_CACHE=new Map(); let ttsFail=0;
async function cloudTTS(text,rate,alt){
  if(!WEB||!WEB.tts||ttsFail>=3||!getKey())return false;
  const key=(alt?'m':'f')+'|'+rate+'|'+text; let url=TTS_CACHE.get(key);
  if(!url){
    try{const r=await fetch('api/tts',{method:'POST',headers:{'content-type':'application/json','x-app-key':getKey()},body:JSON.stringify({text,rate:rate/0.85,voice:alt?'m':'f'})});
      if(!r.ok){ttsFail++;return false;}
      url=URL.createObjectURL(await r.blob());TTS_CACHE.set(key,url);if(TTS_CACHE.size>300){const k=TTS_CACHE.keys().next().value;URL.revokeObjectURL(TTS_CACHE.get(k));TTS_CACHE.delete(k);}
    }catch(e){ttsFail++;return false;}
  }
  return playURL(url,0.85);
}
function say(text,{rate,alt=false}={}){
  const rr=rate||P.settings.voiceRate;
  if(WEB&&WEB.tts&&getKey()&&ttsFail<3){stopSay();return cloudTTS(text,rr,alt).then(ok=>ok?undefined:sayLocal(text,{rate:rr,alt}));}
  return sayLocal(text,{rate:rr,alt});
}
function sayLocal(text,{rate,alt=false}={}){
  return new Promise(res=>{
    try{
      stopAudio();
      const u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';u.rate=rate||P.settings.voiceRate;
      const v=pickVoice(alt); if(v)u.voice=v; if(alt&&voices.length<2)u.pitch=0.7;
      u.onend=res;u.onerror=res;speechSynthesis.speak(u);
      if(!voices.length&&!window.__ttsWarned)setTimeout(()=>{loadVoices();if(!voices.length&&!window.__ttsWarned){window.__ttsWarned=1;window.__voiceBanner&&window.__voiceBanner();}},600);
    }catch(e){res();}
  });
}
function stopAudio(){if(curAudio){try{curAudio.pause();}catch(e){}curAudio=null;}}
function stopSay(){stopAudio();try{speechSynthesis.cancel();}catch(e){}}
const hexOf=h=>[...h].map(c=>c.codePointAt(0).toString(16)).join('-');
async function audioIndex(){if(!AIDX){try{const j=await (await fetch('data/audio-index.json')).json();AIDX={w:new Set(j.w),s:new Set(j.s)};}catch(e){AIDX={w:new Set(),s:new Set()};}}return AIDX;}
async function audioURL(kind,key,lv){
  if(!IN_ARTIFACT)return 'audio/'+kind+'/'+key+'.mp3';
  const b=kind==='s'?'s':'w'+lv;
  const get=n=>fetch('data/audio/'+n+'.json').then(r=>r.json()).catch(()=>({}));
  if(!ABUNDLE[b])ABUNDLE[b]=lv===7&&kind!=='s'?Promise.all([get('w7'),get('w7b')]).then(a=>Object.assign({},...a)):get(b);
  const d=(await ABUNDLE[b])[key]; if(!d)return null;
  return 'data:audio/mpeg;base64,'+d;
}
function playURL(url,rate){
  return new Promise(res=>{
    const a=new Audio(url); curAudio=a; a.preservesPitch=true;
    a.playbackRate=Math.max(0.5,Math.min(1.2,(rate||P.settings.voiceRate)/0.85));
    a.onended=()=>res(true); a.onerror=()=>res(false);
    a.play().catch(()=>res(false));
  });
}
async function sayWord(h,opts={}){
  stopSay(); const idx=await audioIndex(); const w=WI.get(h); const k=hexOf(h);
  // a single polyphonic character (还 hái/huán, 好 hǎo/hào...): the word recording may be the other reading,
  // so play the native syllable recording of the reading this card teaches
  if(w&&[...h].length===1&&w.p&&w.p[0]){let poly=false;try{poly=/\s/.test(window.pinyinPro.polyphonic(h)[0]||'');}catch(e){}
    if(poly){const syl=stripTone(w.p[0])+toneOf(w.p[0]);if(idx.s.has(syl)){const u=await audioURL('s',syl);if(u&&await playURL(u,opts.rate))return;}}}
  if(w&&w.lv&&idx.w.has(k)){const u=await audioURL('w',k,w.lv);if(u&&await playURL(u,opts.rate))return;}
  return say(h,opts);
}
async function saySyl(syl){ // e.g. "ma3"
  stopSay(); const idx=await audioIndex();
  if(idx.s.has(syl)){const u=await audioURL('s',syl);if(u&&await playURL(u))return true;}
  return false;
}
async function speak(text,opts){ // word if known & short, else TTS
  if(WI.has(text)) return sayWord(text,opts);
  return say(text,opts);
}
async function sayLines(lines){stopSay();for(const [sp,t] of lines){await say(t,{alt:sp==='男'});await new Promise(r=>setTimeout(r,350));}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-say]');if(b){e.preventDefault();speak(b.dataset.say);return;}const s2=e.target.closest('[data-syl]');if(s2){e.preventDefault();saySyl(s2.dataset.syl).then(ok=>{if(!ok&&s2.dataset.fb)say(s2.dataset.fb);});}});

/* voice settings modal */
function fillVoiceSel(){const sel=$('#vSel');if(!sel)return;sel.innerHTML=voices.length?voices.map((v,i)=>`<option value="${esc(v.name)}" ${(P.settings.voice?v.name===P.settings.voice:i===0)?'selected':''}>${esc(v.name)} (${esc(v.lang)})${i===0?' - tốt nhất máy có':''}</option>`).join(''):'<option>Chưa có giọng tiếng Trung</option>';}
function openVoice(){
  const m=modal(`<h2>Giọng đọc</h2>
    <p class="note">Từ vựng và âm tiết dùng bản thu giọng người thật. ${WEB&&WEB.tts?'Câu và bài đọc dùng giọng neural Xiaoxiao/Yunxi của Azure (cần nhập mật khẩu ứng dụng một lần).':'Câu và bài đọc dùng giọng đọc có sẵn trên máy.'}</p>
    <label class="label" for="vRate">Tốc độ</label>
    <div class="row"><input type="range" id="vRate" min="0.5" max="1.1" step="0.05" value="${P.settings.voiceRate}" style="flex:1"><span class="num" id="vRateT"></span></div>
    <label class="label" for="vSel">Giọng cho câu và bài đọc</label>
    <div class="row"><select id="vSel" style="flex:1 1 240px;min-width:0"></select><button class="btn sm" id="vTest">Nghe thử</button></div>
    <div class="vn"><b>Muốn giọng tự nhiên hơn:</b><br>
      Mac: System Settings -> Accessibility -> Spoken Content -> System Voice -> Manage Voices -> Chinese (China mainland) -> tải giọng có chữ <b>Premium</b> hoặc <b>Enhanced</b> (ví dụ Lili, Yu-shu). Tải xong mở lại trang.<br>
      iPhone: Cài đặt -> Trợ năng -> Nội dung được đọc -> Giọng nói -> Tiếng Trung -> chọn giọng Nâng cao.<br>
      Windows: dùng trình duyệt Edge, có sẵn giọng "Microsoft Xiaoxiao Online (Natural)" rất tự nhiên.<br>
      Chrome: có giọng "Google 普通话" khá tốt.</div>`);
  fillVoiceSel();
  const rt=()=>{$('#vRateT',m.el).textContent=Math.round(P.settings.voiceRate*100)+'%'+(P.settings.voiceRate<0.8?' (chậm)':P.settings.voiceRate>0.95?' (bình thường)':'');};rt();
  $('#vRate',m.el).oninput=e=>{P.settings.voiceRate=+e.target.value;rt();};
  $('#vRate',m.el).onchange=()=>touch('main');
  $('#vSel',m.el).onchange=e=>{P.settings.voice=e.target.value;touch('main');};
  $('#vTest',m.el).onclick=()=>say('你好，我叫小王。今天天气很好，我们一起去公园散步吧。');
}

/* ================= voice input =================
   listen({lang, onText(text, isFinal), onEnd(finalText), continuous}) -> handle or null.
   Two engines:
   - browser speech recognition (live words), used on desktop Chrome/Edge/Safari;
   - record + Whisper on the server (api/stt), used on phones and browsers without recognition. Phone browsers
     handle live recognition badly (iPhone stops it when anything else uses the mic, Android repeats or cuts words).
   Whisper handle: {whisper:true, stop(): Promise<text>, url(): Promise<blobURL of the recording>}. */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const IS_MOBILE=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const CAN_REC=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder);
const whisperOK=()=>CAN_REC&&!!(WEB&&WEB.ai);
const useWhisper=()=>whisperOK()&&(IS_MOBILE||!SR);
const canListen=()=>useWhisper()||!!SR;
function recMime(){const c=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];try{for(const t of c)if(MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t))return t;}catch(e){}return '';}
async function transcribe(blob,lang){
  for(let i=0;i<2;i++){
    if(!getKey()){const ok=await askPassword(false);if(!ok)return '';}
    let r;try{r=await fetch('api/stt?lang='+(lang||'en'),{method:'POST',headers:{'content-type':blob.type||'audio/webm','x-app-key':getKey()},body:blob});}
    catch(e){toast('Mất mạng nên chưa chuyển được giọng thành chữ.',3500);return '';}
    if(r.status===401){setKey('');continue;}
    if(!r.ok){toast(r.status===429?'Đã chạm giới hạn lượt chuyển giọng miễn phí, đợi một lát rồi thử lại.':r.status===413?'Bản ghi quá dài, nói ngắn hơn rồi thử lại.':'Chưa chuyển được giọng thành chữ, thử lại sau.',4000);return '';}
    const j=await r.json().catch(()=>({}));return String(j.text||'').trim();
  }
  return '';
}
function micDenied(){toast('Trình duyệt chưa cho dùng micro. Trên điện thoại: vào Cài đặt của trình duyệt, cho phép Micro cho trang này rồi tải lại.',5000);}
function listenWhisper({lang,onText,onEnd,continuous,maxMs=9000}){
  let stream=null,mr=null,chunks=[],ctx=null,timer=null,stopped=false,heard=false,alive=false,quietSince=0,started=Date.now();
  // create the audio context inside the tap (iPhone keeps it suspended otherwise); if it never reports sound we do not trust it
  try{const AC=window.AudioContext||window.webkitAudioContext;ctx=new AC();ctx.resume&&ctx.resume();}catch(e){ctx=null;}
  let resolveUrl;const urlP=new Promise(r=>resolveUrl=r);let textP=null;
  const code=String(lang||'en').slice(0,2);
  const cleanup=()=>{clearInterval(timer);try{ctx&&ctx.close();}catch(e){}if(stream)stream.getTracks().forEach(t=>t.stop());};
  const finish=()=>{
    if(textP)return textP;
    textP=new Promise(async res=>{
      stopped=true;
      const blob=await new Promise(r=>{if(!mr||mr.state==='inactive'){r(chunks.length?new Blob(chunks,{type:(mr&&mr.mimeType)||'audio/webm'}):null);return;}
        mr.onstop=()=>r(chunks.length?new Blob(chunks,{type:mr.mimeType||'audio/webm'}):null);try{mr.stop();}catch(e){r(null);}});
      cleanup();
      resolveUrl(blob?URL.createObjectURL(blob):null);
      let t='';if(blob&&(heard||!alive))t=await transcribe(blob,code);
      onText&&onText(t,true);onEnd&&onEnd(t);res(t);
    });
    return textP;
  };
  (async()=>{
    try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}
    catch(e){micDenied();stopped=true;resolveUrl(null);textP=Promise.resolve('');onText&&onText('',true);onEnd&&onEnd('');return;}
    if(stopped){stream.getTracks().forEach(t=>t.stop());return;}
    const mt=recMime();try{mr=new MediaRecorder(stream,mt?{mimeType:mt,audioBitsPerSecond:48000}:{});}catch(e){mr=new MediaRecorder(stream);}
    mr.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};mr.start(250);
    // loudness watch: knows whether anything was said, and stops single answers after a pause
    let an=null,buf=null;
    try{if(ctx){const src=ctx.createMediaStreamSource(stream);an=ctx.createAnalyser();an.fftSize=1024;src.connect(an);buf=new Float32Array(an.fftSize);}}catch(e){an=null;}
    timer=setInterval(()=>{const now=Date.now();let rms=0;
      if(an){an.getFloatTimeDomainData(buf);let s=0;for(const v of buf)s+=v*v;rms=Math.sqrt(s/buf.length);}
      if(rms>1e-4)alive=true;
      if(rms>0.02){heard=true;quietSince=0;}else if(!quietSince)quietSince=now;
      if(!continuous){
        if(alive&&((heard&&quietSince&&now-quietSince>1300)||(!heard&&now-started>6000)))finish();
        else if(!alive&&now-started>4000)finish();   // no level reading on this device: fixed 4 s for one word
        else if(now-started>maxMs)finish();
      }
      else if(now-started>180000)finish();},100);
  })();
  return {whisper:true,stop:finish,url:()=>urlP};
}
function listenBrowser({lang,onText,onEnd,continuous}){
  if(!SR)return null;
  const rec=new SR(); rec.lang=lang; rec.interimResults=true; rec.continuous=continuous; rec.maxAlternatives=1;
  let finalText='', stopped=false, lastInterim='';
  rec.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];if(r.isFinal)finalText+=r[0].transcript+' ';else interim+=r[0].transcript;}lastInterim=interim;onText&&onText((finalText+interim).trim(),false);};
  rec.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed')micDenied();};
  rec.onend=()=>{if(!stopped&&continuous){try{rec.start();return;}catch(e){}}const t=(finalText.trim()||lastInterim.trim());onText&&onText(t,true);onEnd&&onEnd(t);};
  try{rec.start();}catch(e){return null;}
  return {stop(){stopped=true;try{rec.stop();}catch(e){}return Promise.resolve(finalText.trim());}};
}
function listen({lang='en-GB',onText,onEnd,continuous=true,maxMs}={}){
  if(useWhisper())return listenWhisper({lang,onText,onEnd,continuous,maxMs});
  return listenBrowser({lang,onText,onEnd,continuous});
}
/* audio recorder (not used by Stalong views yet) */
async function recorder(){
  if(!CAN_REC)return null;
  let stream; try{stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch(e){micDenied();return null;}
  const mt=recMime(); let mr; try{mr=new MediaRecorder(stream,mt?{mimeType:mt}:{});}catch(e){mr=new MediaRecorder(stream);}
  const chunks=[]; mr.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);}; mr.start(250);
  return {stop:()=>new Promise(res=>{mr.onstop=()=>{stream.getTracks().forEach(t=>t.stop());res(chunks.length?URL.createObjectURL(new Blob(chunks,{type:mr.mimeType||'audio/webm'})):null);};try{mr.stop();}catch(e){res(null);}})};
}


/* ================= routing ================= */
const VIEWS={home:renderHome,study:renderStudy,dict:renderDict,listen:renderListen,speak:renderSpeak,read:renderRead,write:renderWrite,radicals:renderRadicals,pinyin:renderPinyin,grammar:renderGrammar,test:renderTest,talk:el=>{SP.sub='talk';current='speak';renderSpeak(el);},tones:renderTones};
let current='home';
function go(v){if(v===current){route();return;}current=v;try{history.pushState(null,'','#'+v);}catch(e){}route();window.scrollTo(0,0);}
window.addEventListener('popstate',()=>{const h=(location.hash||'').slice(1)||'home';if(VIEWS[h]&&h!==current){current=h;route();}});
window.addEventListener('hashchange',()=>{const h=(location.hash||'').slice(1)||'home';if(VIEWS[h]&&h!==current){current=h;route();}});
function route(soft){
  uiNav();
  if(soft&&['test','talk','write'].includes(current))return;
  stopSay(); (VIEWS[current]||renderHome)($('#view'));
}
function applySettings(){
  document.body.classList.toggle('mono',!P.settings.color);
  if(P.settings.theme)document.documentElement.dataset.theme=P.settings.theme;else delete document.documentElement.dataset.theme;
}

/* ================= level chips ================= */
function levelChips(sel,onChange,{multi=true,id='lvc'}={}){
  const html=`<div class="row" id="${id}"><span class="label">HSK</span>${LVS.map(L=>`<button class="chip" data-l="${L}" aria-pressed="${sel.includes(L)}">${lvN(L)}</button>`).join('')}</div>`;
  setTimeout(()=>{$$('#'+id+' .chip').forEach(b=>b.onclick=()=>{
    const L=+b.dataset.l; let s;
    if(multi){s=sel.includes(L)?sel.filter(x=>x!==L):[...sel,L].sort();if(!s.length)return;} else s=[L];
    onChange(s);
  });});
  return html;
}

/* ================= HOME ================= */
function renderHome(el){
  const lv=studyLv(); const due=dueList(lv).length; const nw=Math.max(0,P.settings.newPerDay-newToday());
  const st=streak(); const todayN=P.hist[ymd(Date.now())]||0;
  const pool=W.filter(w=>w.em&&lv.includes(w.lv)); const wd=pool.length?pool[(Math.floor(Date.now()/DAY))%pool.length]:null;
  const heat=[];const start=today()-83*DAY;for(let i=0;i<84;i++){const n=P.hist[ymd(start+i*DAY)]||0;heat.push(n===0?'':n<10?'h1':n<25?'h2':n<50?'h3':'h4');}
  el.innerHTML=`<div class="view">
   <div class="hero">
    <div class="today">
      <div class="label" style="color:inherit;opacity:.85">Hôm nay</div>
      <div class="stats"><div><div class="big">${due}</div><span>thẻ cần ôn</span></div><div><div class="big">${nw}</div><span>từ mới</span></div><div><div class="big">${st}</div><span>ngày liên tiếp</span></div></div>
      <button class="btn" id="hStart">${due+nw?'Bắt đầu ôn '+(due+Math.min(nw,P.settings.newPerDay))+' thẻ':'Học thêm từ mới'}</button>
      <div class="small" style="opacity:.85">Đã ôn ${todayN} lượt hôm nay. Đang học HSK ${lv.map(lvN).join(', ')}.</div>
    </div>
    <div class="panel">${wd?`<span class="label">Từ của ngày</span><div class="wotd"><span class="em">${wd.em}</span><div><div class="h han">${hanHTML(wd)}</div><div class="py">${pyHTML(wd)} <span class="muted small">${esc(wd.hv)}</span></div><div>${esc(wd.vi)}</div></div><button class="spk" data-say="${esc(wd.h)}" aria-label="Nghe">${SPK}</button></div><div class="small muted han">${esc(wd.ex)}</div><button class="btn sm" id="hWd" style="align-self:flex-start">Xem chi tiết</button>`:'<span class="note">Đang tải từ vựng...</span>'}</div>
   </div>
   <div class="grid2">
    <div class="panel"><div class="spread"><h3>Tiến độ theo cấp</h3><span class="note">thuộc = ôn đạt khoảng cách >= 7 ngày</span></div>
      ${LVS.map(L=>{const ws=W.filter(w=>w.lv===L);const k=ws.filter(w=>known(w.h)).length;const s=ws.filter(w=>seen(w.h)).length;const tot=ws.length||LV_COUNT[L]||1;
        return `<div class="lvrow"><b>HSK ${lvN(L)}</b><span class="bar-track"><i style="width:${k/tot*100}%"></i></span><span class="num muted">${k}/${tot}${s>k?' <span class="small">(+'+(s-k)+')</span>':''}</span></div>`;}).join('')}
    </div>
    <div class="panel"><h3>12 tuần gần đây</h3><div class="heat">${heat.map(c=>`<i class="${c}"></i>`).join('')}</div>
      <div class="spread"><span class="note">Mỗi ô là một ngày, càng đậm càng ôn nhiều.</span></div>
      <h3 style="margin-top:6px">Cài đặt học</h3>
      ${levelChips(lv,s=>{P.settings.lv=s;touch('main');renderHome(el);},{id:'hlv'})}
      <label class="row small">Từ mới mỗi ngày <input type="number" id="hNew" min="0" max="60" value="${P.settings.newPerDay}" style="width:80px"></label>
    </div>
   </div>
   <div class="grid3">
     <button class="panel" style="text-align:left" data-go="test"><h3>Thi thử HSK</h3><span class="note">12 đề theo format thật, có nghe, đọc, viết và chấm điểm.</span></button>
     <button class="panel" style="text-align:left" data-go="listen"><h3>Nghe</h3><span class="note">Chép chính tả, nghe chọn nghĩa, nghe chọn chữ.</span></button>
     <button class="panel" style="text-align:left" data-go="speak"><h3>Nói</h3><span class="note">Nhại theo câu mẫu có chấm, hội thoại với trợ lý AI.</span></button>
     <button class="panel" style="text-align:left" data-go="read"><h3>Đọc</h3><span class="note">60 bài đọc HSK 1-6, bấm từ để tra nghĩa.</span></button>
     <button class="panel" style="text-align:left" data-go="write"><h3>Viết</h3><span class="note">Viết chữ theo nét, sắp xếp câu, dịch câu, viết đoạn văn.</span></button>
     <button class="panel" style="text-align:left" data-go="grammar"><h3>Ngữ pháp</h3><span class="note">183 điểm ngữ pháp HSK 1-6 kèm bài luyện.</span></button>
   </div>
  </div>`;
  $('#hStart').onclick=()=>go('study');
  const b=$('#hWd');if(b)b.onclick=()=>openWord(wd.h);
  $('#hNew').onchange=e=>{P.settings.newPerDay=Math.max(0,Math.min(60,+e.target.value||0));touch('main');};
  $$('[data-go]',el).forEach(b=>b.onclick=()=>go(b.dataset.go));
}

/* ================= STUDY (SRS) ================= */
let queue=[],qcur=null,revealed=false,sessDone=0;
function buildQueue(){
  const lv=studyLv(); const due=dueList(lv); const nw=newMix(Math.max(0,P.settings.newPerDay-newToday()));
  queue=[...due,...nw]; sessDone=0;
}
function renderStudy(el){
  if(!queue.length||!queue.every(w=>inLv(w,studyLv())))buildQueue();
  el.innerHTML=`<div class="view"><div class="spread"><h2>Ôn từ vựng</h2>
     <div class="row"><span class="label">Mặt trước</span>${[['hz','Chữ Hán'],['vi','Nghĩa'],['au','Nghe']].map(([m,t])=>`<button class="chip" data-m="${m}" aria-pressed="${P.settings.mode===m}">${t}</button>`).join('')}</div></div>
     ${levelChips(P.settings.lv,s=>{P.settings.lv=s;touch('main');buildQueue();renderStudy(el);},{id:'slv'})}
     <div class="row" id="sph"><span class="label">Thêm bộ</span>${PH_DECKS.map(([L,t])=>`<button class="chip" data-ph="${L}" aria-pressed="${(P.settings.ph||[]).includes(L)}">${t}</button>`).join('')}</div>
     <div class="study"><div id="cardBox"></div>
     <aside class="panel"><h3>Phiên này</h3><div id="sessInfo" class="small"></div>
      <p class="note">Chấm điểm sau khi lật: Quên thì gặp lại sau 1 phút, các mức còn lại đẩy lần ôn tiếp theo ra xa dần. Phím tắt: Space lật thẻ, 1 2 3 4 chấm điểm.</p>
      <button class="btn sm" id="addNew">Thêm 10 từ mới</button></aside></div></div>`;
  $$('[data-m]',el).forEach(b=>b.onclick=()=>{P.settings.mode=b.dataset.m;touch('main');$$('[data-m]',el).forEach(x=>x.setAttribute('aria-pressed',x.dataset.m===P.settings.mode));nextCard(true);});
  $$('[data-ph]',el).forEach(b=>b.onclick=async()=>{const L=+b.dataset.ph;const a=P.settings.ph=P.settings.ph||[];const i=a.indexOf(L);if(i<0)a.push(L);else a.splice(i,1);touch('main');
    if(a.includes(L)){b.disabled=true;await Promise.all([loadLevel(L),...(L===9?[loadLevel(7)]:[])]);}buildQueue();renderStudy(el);});
  $('#addNew').onclick=()=>{const extra=newMix(10,queue);queue.push(...extra);if(!qcur)nextCard();info();toast('Đã thêm '+extra.length+' từ mới vào phiên.');};
  nextCard(true);
}
function info(){const n=queue.filter(w=>!P.srs[w.h]).length;$('#sessInfo')&&($('#sessInfo').innerHTML=`Còn <b>${queue.length}</b> thẻ (${n} từ mới). Đã ôn <b>${sessDone}</b>.`);}
function nextCard(keep){
  if(!keep||!qcur){qcur=queue[0]||null;}
  revealed=false; drawCard(); info();
}
function drawCard(){
  const box=$('#cardBox');if(!box)return; const w=qcur;
  if(!w){box.innerHTML=`<div class="card"><div class="done"><div class="big">🎉</div><h2>Xong phần ôn hôm nay</h2><p class="note">Quay lại ngày mai, hoặc bấm "Thêm 10 từ mới" để học tiếp.</p></div></div>`;return;}
  const m=P.settings.mode, isNew=!P.srs[w.h];
  const front = m==='vi'?`<div class="prompt-vi">${esc(w.vi)}</div>${w.em?`<div class="emo">${w.em}</div>`:''}`
    : m==='au'?`<button class="btn primary" data-say="${esc(w.h)}">Nghe lại</button>`
    : `${w.em&&revealed?'':''}<div class="big han">${hanHTML(w)}</div>${P.settings.py?`<div class="bigpy py">${pyHTML(w)}</div>`:''}`;
  const back = `${w.em?`<div class="emo">${w.em}</div>`:''}<div class="big han">${hanHTML(w)}</div><div class="bigpy py">${pyHTML(w)}</div>
     ${P.settings.hv?`<div class="hv">${esc(w.hv)}</div>`:''}<div class="mean">${esc(w.vi)}</div>
     ${w.cl&&w.cl.length?`<div class="small muted">Lượng từ: <span class="han">${esc(w.cl.join(', '))}</span></div>`:''}${phExtra(w,true)}
     <div class="ex"><button class="spk" data-say="${esc(w.ex)}" aria-label="Nghe câu">${SPK}</button><div><div class="zh han">${colorText(w.ex)}</div><div class="pyl py">${sentPyHTML(w.exp)}</div><div class="vil">${esc(w.exvi)}</div></div></div>`;
  box.innerHTML=`<div class="card"><div class="corner"><span class="pill">${lvLabel(w.lv2>=8?w.lv2:w.lv)}</span>${isNew?'<span class="pill ai">Mới</span>':''}</div>
    <div class="corner-r"><button class="spk" data-say="${esc(w.h)}" aria-label="Nghe">${SPK}</button><button class="spk" id="cInfo" aria-label="Chi tiết" title="Chi tiết"><svg class="i"><use href="#i-book-open"/></svg></button></div>
    ${revealed?back:front}
    ${revealed?'':'<button class="btn primary" id="cFlip" style="margin-top:auto">Lật thẻ <span class="kbd">Space</span></button>'}
  </div>
  ${revealed?`<div class="rate" style="margin-top:10px">${['Quên','Khó','Nhớ','Dễ'].map((t,i)=>`<button class="btn r${i}" data-r="${i}">${t}<small>${ivLabel(w.h,i)}</small></button>`).join('')}</div>`:''}`;
  if(m==='au'&&!revealed)sayWord(w.h);
  const f=$('#cFlip');if(f)f.onclick=flip;
  $('#cInfo').onclick=()=>openWord(w.h);
  $$('[data-r]',box).forEach(b=>b.onclick=()=>rate(+b.dataset.r));
}
function flip(){if(!qcur||revealed)return;revealed=true;drawCard();sayWord(qcur.h);}
function rate(r){
  if(!qcur||!revealed)return; const w=qcur;
  const wasNew=!P.srs[w.h]; const c=schedule(w.h,r); if(!c.first){c.first=Date.now();}
  window.__award&&window.__award(wasNew?'new':'review',1); if(r===0)window.__mistake&&window.__mistake('word',w.h);
  queue.shift(); sessDone++;
  if(r===0){queue.splice(Math.min(queue.length,4),0,w);}
  qcur=null; nextCard();
}
document.addEventListener('keydown',e=>{
  if(current!=='study'||e.target.closest('input,textarea,select')||$('.modal-bg'))return;
  if(e.code==='Space'){e.preventDefault();flip();}
  else if(['1','2','3','4'].includes(e.key)&&revealed)rate(+e.key-1);
});

/* ================= DICTIONARY ================= */
let dq='',dlv=LVS,dshow=80,dfilter='all';
function renderDict(el){
  el.innerHTML=`<div class="view"><div class="spread"><h2>Từ điển HSK</h2><span class="note num" id="dCount"></span></div>
   <div class="dict-tools"><input type="search" id="dq" placeholder="Tìm chữ Hán, pinyin (không dấu cũng được), Hán Việt hoặc nghĩa tiếng Việt" value="${esc(dq)}">
    <select id="df"><option value="all">Tất cả</option><option value="new">Chưa học</option><option value="seen">Đang học</option><option value="known">Đã thuộc</option><option value="em">Có hình minh họa</option></select></div>
   ${levelChips(dlv,s=>{dlv=s;dshow=80;draw();},{id:'dlv'})}
   <div class="wlist" id="dl"></div><button class="btn" id="dMore" hidden>Xem thêm</button>
   <div class="panel"><h3>Thêm từ của riêng bạn</h3><p class="note">Từ ngoài danh sách HSK (tên món ăn, thuật ngữ công việc...). Pinyin tự điền.${AI?' AI điền giúp nghĩa và câu ví dụ.':''}</p>
    <div class="row"><input type="text" id="cw" placeholder="Chữ Hán, ví dụ 区块链" style="flex:1 1 160px"><input type="text" id="cv" placeholder="Nghĩa tiếng Việt" style="flex:2 1 200px"><button class="btn sm" id="cAdd">Thêm</button></div>
    <div id="cList" class="row"></div></div></div>`;
  $('#df').value=dfilter;
  const draw=()=>{
    const q=dq.trim(); const qf=viFold(q); const qs=stripTone(q).replace(/\s+/g,'');
    let list=W.filter(w=>inLv(w,dlv)||(w.lv>=8&&q));
    if(dfilter==='new')list=list.filter(w=>!seen(w.h));else if(dfilter==='seen')list=list.filter(w=>seen(w.h)&&!known(w.h));else if(dfilter==='known')list=list.filter(w=>known(w.h));else if(dfilter==='em')list=list.filter(w=>w.em);
    if(q){
      const han=[...q].some(isHan);
      list=list.map(w=>{let s=0;
        if(han){if(w.h===q)s=100;else if(w.h.startsWith(q))s=60;else if(w.h.includes(q))s=30;}
        else{const p=stripTone(w.p.join(''));if(p===qs)s=90;else if(p.startsWith(qs))s=50;
          const hv=viFold(w.hv);if(hv===qf)s=Math.max(s,85);else if(hv.startsWith(qf))s=Math.max(s,40);
          const v=viFold(w.vi);if(v.split(/[;,]\s*/).some(x=>x.trim()===qf))s=Math.max(s,80);else if(v.includes(qf))s=Math.max(s,25);}
        return [s,w];}).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]||a[1].lv-b[1].lv).map(x=>x[1]);
    }
    $('#dCount').textContent=list.length+' từ';
    $('#dl').innerHTML=list.length?list.slice(0,dshow).map(w=>{const st=known(w.h)?'s2':seen(w.h)?'s1':'';
      return `<button class="wrow" data-h="${esc(w.h)}"><span class="e">${w.em||''}</span><span class="h han">${hanHTML(w)}</span><span class="p py">${pyHTML(w)}</span><span class="v">${esc(w.vi)}</span><span class="st row" style="gap:6px"><span class="pill">${w.lv}</span><span class="dot ${st}"></span></span></button>`;}).join(''):'<div class="empty">Không tìm thấy từ nào.</div>';
    $('#dMore').hidden=list.length<=dshow;
    $$('#dl .wrow').forEach(b=>b.onclick=()=>openWord(b.dataset.h));
  };
  let t;$('#dq').oninput=e=>{dq=e.target.value;dshow=80;clearTimeout(t);t=setTimeout(draw,120);};
  $('#df').onchange=e=>{dfilter=e.target.value;dshow=80;draw();};
  $('#dMore').onclick=()=>{dshow+=120;draw();};
  const drawCustom=()=>{$('#cList').innerHTML=P.custom.map((c,i)=>`<span class="chip"><span class="han">${esc(c.h)}</span> ${esc(c.vi)} <button class="btn ghost sm" data-ci="${i}" aria-label="Xóa">x</button></span>`).join('');
    $$('[data-ci]').forEach(b=>b.onclick=()=>{P.custom.splice(+b.dataset.ci,1);touch('main');drawCustom();});};
  $('#cAdd').onclick=async()=>{
    const h=$('#cw').value.trim();if(!h||![...h].some(isHan)){toast('Nhập chữ Hán trước.');return;}
    let vi=$('#cv').value.trim(); let extra={};
    if(AI&&!vi){$('#cAdd').disabled=true;$('#cAdd').textContent='AI đang điền...';
      try{extra=await askJSON(`Bạn là từ điển Trung-Việt. Cho từ "${h}", trả JSON {"vi":"nghĩa tiếng Việt ngắn gọn","hv":"âm Hán Việt viết thường","ex":"câu ví dụ tiếng Trung giản thể ngắn","exvi":"dịch câu ví dụ sang tiếng Việt"}. Chỉ trả JSON.`,{modelTier:'quick'});vi=extra.vi||'';}
      catch(e){toast(aiError(e));}
      $('#cAdd').disabled=false;$('#cAdd').textContent='Thêm';}
    if(!vi){toast('Nhập nghĩa tiếng Việt.');return;}
    P.custom.push({h,vi,hv:extra.hv||'',ex:extra.ex||'',exvi:extra.exvi||'',t:Date.now()});touch('main');
    $('#cw').value='';$('#cv').value='';drawCustom();toast('Đã thêm '+h);
  };
  draw();drawCustom();
}

/* word detail modal */
function modal(html){
  const bg=document.createElement('div');bg.className='modal-bg';bg.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><button class="spk x" aria-label="Đóng"><svg class="i"><use href="#i-x"/></svg></button>${html}</div>`;
  document.body.appendChild(bg);const close=()=>{bg.remove();stopSay();document.removeEventListener('keydown',onk);};
  const onk=e=>{if(e.key==='Escape')close();};document.addEventListener('keydown',onk);
  bg.addEventListener('click',e=>{if(e.target===bg)close();});$('.x',bg).onclick=close;return {el:$('.modal',bg),close};
}
function openWord(h){
  const w=WI.get(h);if(!w)return; const c=P.srs[h];
  const m=modal(`<div class="wd-head">${w.em?`<span class="em">${w.em}</span>`:''}<div><div class="h han">${hanHTML(w)}</div></div>
     <div style="display:flex;flex-direction:column;gap:2px"><div class="py" style="font-size:22px">${pyHTML(w)}</div><div class="muted" style="text-transform:uppercase;letter-spacing:.08em;font-size:13px">Hán Việt: ${esc(w.hv)}</div><div class="row"><span class="pill">${lvLabel(w.lv)}</span>${w.lv2?`<span class="pill">${lvLabel(w.lv2)}</span>`:''}${c?`<span class="pill ai">${known(h)?'Đã thuộc':'Đang học'} - ôn lại sau ${Math.max(0,Math.round((c.due-Date.now())/DAY))} ngày</span>`:''}</div></div>
     <button class="spk" data-say="${esc(w.h)}" aria-label="Nghe" style="margin-left:auto">${SPK}</button></div>
   <div style="font-size:19px;font-weight:600">${esc(w.vi)}</div>
   ${w.cl.length?`<div class="small muted">Lượng từ đi kèm: <span class="han" style="font-size:16px">${esc(w.cl.join(', '))}</span></div>`:''}${phExtra(w)}
   <div class="ex" style="display:grid;grid-template-columns:34px minmax(0,1fr);gap:10px"><button class="spk" data-say="${esc(w.ex)}" aria-label="Nghe câu">${SPK}</button><div><div class="han" style="font-size:20px">${colorText(w.ex)}</div><div class="py small">${sentPyHTML(w.exp)}</div><div class="muted small">${esc(w.exvi)}</div></div></div>
   <div><span class="label">Thứ tự nét</span><div class="strokes" id="wdStrokes"></div></div>
   <div class="row">${c?'':'<button class="btn sm" id="wdLearn">Thêm vào ôn tập</button>'}<button class="btn sm" id="wdWrite">Luyện viết</button>
     <button class="btn sm need-ai" id="wdIll">Vẽ minh họa</button><button class="btn sm need-ai" id="wdMore">AI giải thích thêm</button></div>
   <div id="wdIllOut"></div><div id="wdAiOut"></div>
`);
  refreshAIBits();
  const sbox=$('#wdStrokes',m.el);
  [...w.h].forEach(ch=>{const d=document.createElement('div');d.className='box';d.title='Bấm để xem lại';sbox.appendChild(d);
    makeWriter(d,ch,{size:110,anim:true}).then(wr=>{if(!wr){d.innerHTML=`<div class="han" style="font-size:70px;text-align:center;line-height:110px">${esc(ch)}</div>`;return;}d.onclick=()=>wr.animateCharacter();wr.animateCharacter();});});
  const l=$('#wdLearn',m.el);if(l)l.onclick=()=>{P.srs[h]={iv:0,ef:2.5,n:0,l:0,due:Date.now(),s:1,first:Date.now()};touch('srs');touch('main');l.remove();toast('Đã thêm vào danh sách ôn hôm nay.');};
  $('#wdWrite',m.el).onclick=()=>{m.close();writeTarget=w.h;go('write');};
  const cached=store.get('hanyu-ill',{})[h]; if(cached)showIll(cached);
  function showIll(svg){$('#wdIllOut',m.el).innerHTML=`<div class="illus"><img alt="Minh họa cho ${esc(w.h)}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}"></div>`;}
  $('#wdIll',m.el).onclick=async e=>{
    const b=e.currentTarget;b.disabled=true;b.textContent='Đang vẽ...';
    try{const {text}=await ask(`Draw ONE simple, friendly flat-style illustration as an SVG that helps a learner remember the Chinese word ${w.h} (${w.p.join('')}), meaning "${w.vi}". Scene idea: ${w.exvi}. Requirements: viewBox="0 0 400 300", width="400" height="300", solid light background rect, bold simple shapes, 4-8 colors, no text or letters of any kind, no <script>, no external references, no foreignObject. Output only the SVG markup, nothing else.`,{modelTier:'default'});
      let svg=(text.match(/<svg[\s\S]*<\/svg>/i)||[''])[0];
      svg=svg.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi,'').replace(/\son\w+="[^"]*"/gi,'');
      if(!svg)throw {code:'bad'}; const all=store.get('hanyu-ill',{});all[h]=svg;store.set('hanyu-ill',all);showIll(svg);
    }catch(err){toast(aiError(err));}
    b.disabled=false;b.textContent='Vẽ lại';
  };
  $('#wdMore',m.el).onclick=async e=>{
    const b=e.currentTarget;b.disabled=true;const out=$('#wdAiOut',m.el);out.innerHTML='<div class="ai-out">AI đang viết...</div>';
    try{await ask(`Bạn là giáo viên tiếng Trung cho người Việt, trình độ học viên đang học HSK ${lvN(Math.max(...P.settings.lv))}. Giải thích ${w.lv===9||w.lv2===9?'thành ngữ':w.lv===8?'cụm từ':'từ'} ${w.h} (${w.p.join(' ')}, Hán Việt: ${w.hv}, nghĩa: ${w.vi}) bằng tiếng Việt tự nhiên, ngắn gọn:
1. Cách dùng chính và sắc thái (trang trọng hay khẩu ngữ).
2. 3 cụm từ đi kèm thường gặp, mỗi cụm kèm pinyin và nghĩa.
3. 3 câu ví dụ mới, mỗi câu: chữ Hán / pinyin / nghĩa tiếng Việt.
4. Từ dễ nhầm (nếu có) và cách phân biệt.
5. Mẹo nhớ dựa trên âm Hán Việt hoặc bộ thủ nếu hợp lý.
Không dùng markdown đậm, không dùng dấu gạch ngang dài. Trình bày dạng văn bản thuần, xuống dòng rõ ràng.`,{onText:({text})=>{out.innerHTML=`<div class="ai-out han">${esc(text)}</div>`;}});}
    catch(err){out.innerHTML=`<p class="note">${esc(aiError(err))}</p>`;}
    b.disabled=false;
  };
}

/* hanzi-writer wrapper */
async function makeWriter(el,ch,{size=300,anim=false,quiz=false,outline=true}={}){
  if(!window.HanziWriter)return null;
  const data=await strokeData(ch); if(!data)return null;
  const css=getComputedStyle(document.documentElement);
  const ink=css.getPropertyValue('--ink').trim()||'#18211D', acc=css.getPropertyValue('--accent').trim()||'#0E6E55', line=css.getPropertyValue('--line2').trim()||'#ccc';
  el.innerHTML='';
  return HanziWriter.create(el,ch,{width:size,height:size,padding:size*.06,showOutline:outline,strokeColor:ink,radicalColor:acc,outlineColor:line,highlightColor:acc,drawingColor:acc,
    strokeAnimationSpeed:1.2,delayBetweenStrokes:180,showCharacter:!quiz,charDataLoader:(c,ok)=>ok(data)});
}

/* ================= WRITE ================= */
let writeTarget=null;
function renderWriteChars(el){
  const pool=()=>{const lv=P.settings.lv;const learning=W.filter(w=>lv.includes(w.lv)&&seen(w.h));return learning.length?learning:W.filter(w=>lv.includes(w.lv)).slice(0,60);};
  let w=writeTarget?(WI.get(writeTarget)||{h:writeTarget,p:pyChars(writeTarget).map(o=>o.p||''),hv:'',vi:'',em:''}):pick(pool()); writeTarget=null;
  let chars=[...w.h], ci=0, writer=null, mistakes=0, mode='quiz';
  el.innerHTML=`<div class="view"><div class="spread"><h2>Luyện viết chữ</h2><div class="row"><input type="search" id="wq" placeholder="Nhập từ để luyện" style="width:180px"><button class="btn sm" id="wGo">Luyện</button><button class="btn sm" id="wRand">Từ khác</button></div></div>
   <div class="write-wrap"><div><div class="wpad" id="wpad"><svg class="grid" viewBox="0 0 100 100" preserveAspectRatio="none"><g stroke="var(--line)" stroke-width=".4" stroke-dasharray="2 2"><line x1="0" y1="0" x2="100" y2="100"/><line x1="100" y1="0" x2="0" y2="100"/><line x1="50" y1="0" x2="50" y2="100"/><line x1="0" y1="50" x2="100" y2="50"/></g></svg><div class="hw" id="hw"></div></div></div>
   <div class="panel" id="wInfo"></div></div>
   <div class="panel"><div class="spread"><h3>Từng nét của chữ <span class="han" id="wStepCh"></span></h3><span class="note" id="wStepN"></span></div><div class="steps" id="wSteps"></div><p class="note">Nét đỏ là nét viết ở bước đó, số là thứ tự nét. Bấm một ô để xem lại hoạt hình.</p></div>
   ${strokeRulesHTML()}</div>`;
  const size=Math.min(320,Math.floor(window.innerWidth*.86));
  async function load(){
    const ch=chars[ci]; mistakes=0;
    writer=await makeWriter($('#hw'),ch,{size,quiz:mode==='quiz',outline:mode!=='blind'});
    drawSteps(ch,$('#wSteps'),$('#wStepCh'),$('#wStepN'),()=>writer&&writer.animateCharacter());
    drawInfo();
    if(!writer){$('#hw').innerHTML=`<p class="note" style="padding:20px">Chưa có dữ liệu nét cho chữ ${esc(ch)}.</p>`;return;}
    if(mode==='watch'){writer.animateCharacter();}
    else writer.quiz({showHintAfterMisses:3,onMistake:()=>{mistakes++;drawInfo();},onComplete:s=>{
      drawInfo(`Xong chữ ${ch}. Sai ${s.totalMistakes} nét.`);
      if(ci<chars.length-1)setTimeout(()=>{ci++;load();},900);
    }});
  }
  function drawInfo(msg){
    $('#wInfo').innerHTML=`<div class="wd-head" style="gap:12px">${w.em?`<span style="font-size:40px">${w.em}</span>`:''}<div><div class="han" style="font-size:34px;font-weight:700">${chars.map((c,i)=>i===ci?`<span style="color:var(--accent)">${mode==='blind'&&i===ci?'＿':esc(c)}</span>`:esc(c)).join('')}</div><div class="py">${pyHTML(w)}</div></div><button class="spk" data-say="${esc(w.h)}" aria-label="Nghe">${SPK}</button></div>
     <div style="font-weight:600">${esc(w.vi)}</div><div class="small muted">Hán Việt: ${esc(w.hv)}</div>
     <div class="row"><span class="label">Chế độ</span>${[['watch','Xem nét'],['quiz','Viết theo nét mờ'],['blind','Viết không nhìn']].map(([k,t])=>`<button class="chip" data-wm="${k}" aria-pressed="${mode===k}">${t}</button>`).join('')}</div>
     <div class="row"><button class="btn sm" id="wAgain">Viết lại chữ này</button>${chars.length>1?`<button class="btn sm" id="wNext">Chữ tiếp</button>`:''}<button class="btn sm" id="wAnim">Xem mẫu</button></div>
     <p class="note">${msg?esc(msg):mode==='watch'?'Xem thứ tự viết từng nét.':`Viết từng nét theo đúng thứ tự. Sai 3 lần sẽ có gợi ý. Đã sai: ${mistakes}`}</p>`;
    $$('[data-wm]').forEach(b=>b.onclick=()=>{mode=b.dataset.wm;load();});
    $('#wAgain').onclick=load; $('#wAnim').onclick=()=>writer&&writer.animateCharacter();
    const n=$('#wNext');if(n)n.onclick=()=>{ci=(ci+1)%chars.length;load();};
  }
  const setWord=x=>{w=x;chars=[...w.h];ci=0;load();};
  $('#wRand').onclick=()=>setWord(pick(pool()));
  const goQ=()=>{const q=$('#wq').value.trim();if(!q)return;const f=WI.get(q)||W.find(x=>x.h.includes(q));if(f)setWord(f);else{setWord({h:q,p:pyChars(q).map(o=>o.p||''),hv:'',vi:'(ngoài danh sách HSK)',em:''});}};
  $('#wGo').onclick=goQ;$('#wq').onkeydown=e=>{if(e.key==='Enter')goQ();};
  load();
}

/* ================= GRAMMAR ================= */
let glv=null,gcat='',gq='';
async function renderGrammar(el){
  if(!glv)glv=P.settings.lv.slice();
  el.innerHTML='<div class="view"><p class="note">Đang tải ngữ pháp...</p></div>';
  await loadGrammar();
  const cats=[...new Set(GRAM.map(g=>g.cat))];
  el.innerHTML=`<div class="view"><div class="spread"><h2>Ngữ pháp HSK</h2><span class="note num" id="gCount"></span></div>
   ${levelChips(glv,s=>{glv=s;draw();},{id:'glv'})}
   <div class="dict-tools"><input type="search" id="gq" placeholder="Tìm mẫu câu, ví dụ 把, so sánh, bổ ngữ" value="${esc(gq)}"><select id="gcat"><option value="">Mọi loại</option>${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select><button class="btn sm" id="gQuiz">Làm 10 câu luyện tập</button></div>
   <div id="gl" style="display:flex;flex-direction:column;gap:8px"></div></div>`;
  $('#gcat').value=gcat;
  function draw(){
    const q=viFold(gq.trim());
    const list=GRAM.filter(g=>glv.includes(g.lv)&&(!gcat||g.cat===gcat)&&(!q||viFold(g.t+' '+g.f+' '+g.d+' '+g.ex.map(e=>e[0]).join(' ')).includes(q)));
    const done=list.filter(g=>P.gram[g.id]).length;
    $('#gCount').textContent=`${list.length} điểm, đã nắm ${done}`;
    $('#gl').innerHTML=list.map(g=>`<details class="g" data-id="${g.id}"><summary><span class="check ${P.gram[g.id]?'on':''}">${P.gram[g.id]?'✓':''}</span><span class="pill">HSK ${lvN(g.lv)}</span><span class="t">${esc(g.t)}</span><span class="small muted">${esc(g.cat)}</span></summary><div class="body"></div></details>`).join('')||'<div class="empty">Không có điểm ngữ pháp nào khớp.</div>';
    $$('#gl details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open&&!d.dataset.r){d.dataset.r=1;fill(d);}}));
  }
  function fill(d){
    const g=GRAM.find(x=>x.id===d.dataset.id);const b=$('.body',d);
    b.innerHTML=`<div class="formula han">${esc(g.f)}</div><p style="margin:0;max-width:70ch">${esc(g.d)}</p>
      ${g.ex.map(e=>`<div class="ex" style="display:grid;grid-template-columns:34px minmax(0,1fr);gap:10px"><button class="spk" data-say="${esc(e[0])}" aria-label="Nghe câu">${SPK}</button><div><div class="han" style="font-size:19px">${colorText(e[0])}</div><div class="py small">${sentPyHTML(e[1])}</div><div class="muted small">${esc(e[2])}</div></div></div>`).join('')}
      ${g.vn?`<div class="vn">${esc(g.vn)}</div>`:''}
      ${g.q?`<div class="gq"><span class="label">Luyện tập</span><div class="han" style="font-size:18px">${colorText(g.q.s)}</div><div class="opts">${g.q.o.map((o,i)=>`<button class="opt han" data-i="${i}">${esc(o)}</button>`).join('')}</div><div class="small gw" hidden></div></div>`:''}
      <div class="row"><button class="btn sm gdone">${P.gram[g.id]?'Bỏ đánh dấu':'Đánh dấu đã nắm'}</button><button class="btn sm gorder">Luyện sắp xếp câu</button><button class="btn sm need-ai gask">Hỏi AI thêm ví dụ</button></div><div class="gai"></div>`;
    refreshAIBits();
    $$('.opt',b).forEach(o=>o.onclick=()=>{$$('.opt',b).forEach((x,i)=>{x.disabled=true;if(i===g.q.a)x.classList.add('right');});if(+o.dataset.i!==g.q.a){o.classList.add('wrong');window.__mistake&&window.__mistake('q',{k:'fill',s:g.q.s,o:g.q.o,a:g.q.a,w:g.t+'. '+g.q.w});}const w=$('.gw',b);w.hidden=false;w.textContent=g.q.w;});
    $('.gdone',b).onclick=()=>{P.gram[g.id]=P.gram[g.id]?0:1;if(!P.gram[g.id])delete P.gram[g.id];else window.__award&&window.__award('grammar',1);touch('main');const c=$('.check',d);c.classList.toggle('on',!!P.gram[g.id]);c.textContent=P.gram[g.id]?'✓':'';$('.gdone',b).textContent=P.gram[g.id]?'Bỏ đánh dấu':'Đánh dấu đã nắm';};
    $('.gorder',b).onclick=()=>runTest({id:'gram-'+Date.now(),title:g.t,minutes:0,sections:[{type:'write',title:'Sắp xếp câu',parts:[{instr:'Dùng mẫu: '+g.f,items:g.ex.map(e=>orderItem(e[0],e[2]))}]}]},null);
    $('.gask',b).onclick=async e=>{const out=$('.gai',b);e.currentTarget.disabled=true;
      try{await ask(`Bạn là giáo viên tiếng Trung cho người Việt. Điểm ngữ pháp HSK ${lvN(g.lv)}: ${g.t}. Công thức: ${g.f}. Hãy đưa 5 câu ví dụ mới, tự nhiên, đúng trình độ, mỗi câu 3 dòng: chữ Hán / pinyin có dấu / nghĩa tiếng Việt. Sau đó thêm 2 lỗi người Việt hay mắc với mẫu này (ghi Sai: ... Đúng: ...). Văn bản thuần, không markdown, không gạch ngang dài.`,{onText:({text})=>{out.innerHTML=`<div class="ai-out han">${esc(text)}</div>`;}});}
      catch(err){out.innerHTML=`<p class="note">${esc(aiError(err))}</p>`;}};
  }
  let t;$('#gq').oninput=e=>{gq=e.target.value;clearTimeout(t);t=setTimeout(draw,150);};
  $('#gcat').onchange=e=>{gcat=e.target.value;draw();};
  $('#gQuiz').onclick=()=>{const qs=shuffle(GRAM.filter(g=>glv.includes(g.lv)&&g.q)).slice(0,10);if(!qs.length)return;
    runTest({id:'gram-'+Date.now(),title:'Luyện ngữ pháp HSK '+glv.join(', '),minutes:0,sections:[{type:'read',title:'Ngữ pháp',parts:[{instr:'Chọn đáp án đúng',items:qs.map(g=>({k:'fill',s:g.q.s,o:g.q.o,a:g.q.a,w:g.t+'. '+g.q.w}))}]}]},null);};
  draw();
}

/* ================= TEST ================= */
let tlv=null;
async function renderTest(el){
  if(!tlv)tlv=Math.max(...P.settings.lv);
  el.innerHTML='<div class="view"><p class="note">Đang tải đề...</p></div>';
  const T=await loadTests(tlv);
  const hist=P.tests.filter(t=>t.lv===tlv).slice(-8).reverse();
  el.innerHTML=`<div class="view"><h2>Thi thử HSK</h2>
   ${levelChips([tlv],s=>{tlv=s[0];renderTest(el);},{multi:false,id:'tlv'})}
   <div class="grid3">${T.tests.map(t=>{const n=t.sections.reduce((a,s)=>a+s.parts.reduce((b,p)=>b+p.items.length,0),0);const best=P.tests.filter(x=>x.id===t.id).reduce((m,x)=>Math.max(m,x.pct),-1);
     return `<div class="panel tcard"><span class="label">HSK ${lvN(tlv)}</span><h3>${esc(t.title)}</h3><span class="note">${n} câu, ${t.minutes} phút. ${t.sections.map(s=>esc(s.title)).join(', ')}.</span>${best>=0?`<span class="small">Điểm cao nhất: <b>${best}%</b></span>`:''}<button class="btn primary sm" data-t="${t.id}" style="align-self:flex-start">Làm bài</button></div>`;}).join('')}
     <div class="panel tcard need-ai"><span class="label">AI soạn</span><h3>Đề mới không trùng</h3><span class="note">Mỗi lần bấm là một đề rút gọn mới theo đúng cấp độ, khoảng 15 câu.</span><button class="btn sm" id="tAi" style="align-self:flex-start">Soạn đề mới</button></div>
   </div>
   <div class="panel"><h3>Lịch sử làm bài HSK ${lvN(tlv)}</h3>${hist.length?hist.map(h=>`<div class="spread small"><span>${esc(h.title)}</span><span class="num">${new Date(h.date).toLocaleDateString('vi-VN')} - <b>${h.pct}%</b> ${h.pct>=60?'<span class="pill ai">Đạt</span>':'<span class="pill">Chưa đạt</span>'}</span></div>`).join(''):'<p class="note">Chưa làm đề nào ở cấp này.</p>'}
   <p class="note">Mức đạt tham khảo: 60% tổng điểm. Phần nghe dùng giọng đọc của trình duyệt, mỗi bài được nghe tối đa 2 lần như khi thi thật.</p></div></div>`;
  refreshAIBits();
  $$('[data-t]',el).forEach(b=>b.onclick=()=>runTest(T.tests.find(t=>t.id===b.dataset.t),tlv));
  const ai=$('#tAi');if(ai)ai.onclick=async()=>{ai.disabled=true;ai.textContent='AI đang soạn đề (khoảng 1 phút)...';
    try{const words=W.filter(w=>w.lv<=tlv);const sample=shuffle(words.filter(w=>w.lv===tlv)).slice(0,60).map(w=>w.h).join('、');
      const t=await askJSON(`Soạn một đề thi thử HSK cấp ${tlv} (chuẩn HSK mới 2026) rút gọn, nội dung hoàn toàn mới, dành cho người Việt.
Dùng từ vựng trong phạm vi HSK ${lvN(tlv)}, ưu tiên các từ sau: ${sample}.
Trả về DUY NHẤT một JSON object theo đúng cấu trúc:
{"id":"ai","title":"Đề AI soạn - HSK ${lvN(tlv)}","minutes":15,"sections":[
 {"type":"listen","title":"Nghe hiểu","parts":[{"instr":"Nghe đoạn hội thoại và chọn đáp án đúng","items":[ ... 5 câu dạng {"k":"lc","audio":[["男","..."],["女","..."]],"q":"câu hỏi tiếng Trung","o":["A","B","C","D"],"a":0,"w":"giải thích tiếng Việt"} ]}]},
 {"type":"read","title":"Đọc hiểu","parts":[{"instr":"Chọn từ điền vào chỗ trống","items":[ ... 4 câu {"k":"fill","s":"câu có ___","o":[...4],"a":0,"w":"..."} ]},{"instr":"Đọc và trả lời","items":[ ... 3 câu {"k":"rc","text":"đoạn văn","q":"câu hỏi","o":[...4],"a":0,"w":"..."} ]}]}${tlv>=3?`,
 {"type":"write","title":"Viết","parts":[{"instr":"Sắp xếp thành câu đúng","items":[ ... 3 câu {"k":"order","pieces":["mảnh1","mảnh2","..."],"a":"câu đúng đầy đủ có dấu câu","w":"..."} ]}]}`:''}
]}
Đáp án "a" là chỉ số bắt đầu từ 0, phân bố đều. Phần "pieces" phải được xáo trộn và ghép lại đúng bằng "a" khi bỏ dấu câu. Giải thích "w" bằng tiếng Việt, không dùng gạch ngang dài.`,{modelTier:'complex'});
      if(!t||!Array.isArray(t.sections))throw {code:'bad'};
      t.id='ai-'+Date.now(); runTest(t,tlv);
    }catch(e){toast(aiError(e));ai.disabled=false;ai.textContent='Soạn đề mới';}};
}
function runTest(t,lv){
  const el=$('#view'); const items=[]; let finished=false;
  t.sections.forEach((s,si)=>s.parts.forEach((p,pi)=>p.items.forEach((it,ii)=>items.push({s,si,p,it,ans:null,plays:0}))));
  let left=(t.minutes||0)*60, timer=null;
  function html(){
    let n=0;
    return `<div class="view"><div class="runner-head"><div><b>${esc(t.title)}</b><div class="small muted" id="tProg"></div></div><div class="row">${t.minutes?`<span class="timer" id="tTimer"></span>`:''}<button class="btn sm" id="tQuit">Thoát</button><button class="btn primary sm" id="tSubmit">Nộp bài</button></div></div>
     <div id="tScore"></div>
     ${t.sections.map((s,si)=>`<section style="display:flex;flex-direction:column;gap:10px"><h2>${esc(s.title)}</h2>${s.parts.map(p=>`<p class="note">${esc(p.instr||'')}</p>${p.items.map(()=>{const i=n++;return `<div class="q" id="q${i}"></div>`;}).join('')}`).join('')}</section>`).join('')}
     <button class="btn primary" id="tSubmit2" style="align-self:flex-start">Nộp bài</button></div>`;
  }
  el.innerHTML=html();
  items.forEach((x,i)=>drawItem(i));
  function progress(){const a=items.filter(x=>x.ans!==null&&x.ans!==''&&!(Array.isArray(x.ans)&&!x.ans.length)).length;const p=$('#tProg');if(p)p.textContent=`Đã làm ${a}/${items.length} câu`;}
  function drawItem(i){
    const x=items[i],it=x.it,box=$('#q'+i); const show=finished;
    const pyOn=P.settings.py&&lv&&lv<=3;
    const zh=s=>pyOn?`<span class="han">${rubyHTML(s)}</span>`:`<span class="han">${esc(s)}</span>`;
    let body='';
    const audioBtn=it.audio?`<div class="play"><button class="btn sm" data-play="${i}" ${!show&&x.plays>=2?'disabled':''}><svg class="i"><use href="#i-play"/></svg> Nghe${show?'':' ('+(2-x.plays)+' lần)'}</button>${show?`<div class="audio-lines han">${it.audio.map(([sp,l])=>`<div>${sp&&sp!=='问'?esc(sp)+'：':''}${esc(l)}</div>`).join('')}</div>`:''}</div>`:'';
    const options=(o,cls='')=>`<div class="opts">${o.map((op,k)=>`<button class="opt ${cls} ${show&&k===it.a?'right':''} ${show&&x.ans===k&&k!==it.a?'wrong':''}" data-k="${k}" aria-pressed="${x.ans===k}" ${show?'disabled':''}><span class="zh">${String.fromCharCode(65+k)}. ${zh(op)}</span></button>`).join('')}</div>`;
    if(it.k==='lc'){body=audioBtn+(it.q?`<div class="stmt">${zh(it.q)}</div>`:'')+options(it.o);}
    else if(it.k==='tf'){body=(it.audio?audioBtn:`<div class="text">${zh(it.text||'')}</div>`)+`<div class="stmt">★ ${zh(it.s)}</div><div class="opts">${[true,false].map(v=>`<button class="opt ${show&&v===it.a?'right':''} ${show&&x.ans===v&&v!==it.a?'wrong':''}" data-tf="${v}" aria-pressed="${x.ans===v}" ${show?'disabled':''}>${v?'Đúng (✓)':'Sai (✗)'}</button>`).join('')}</div>`;}
    else if(it.k==='rc'){body=`<div class="text">${zh(it.text||'')}</div>${it.q?`<div class="stmt">${zh(it.q)}</div>`:''}`+options(it.o);}
    else if(it.k==='fill'||it.k==='match'){body=`<div class="text">${zh(it.s)}</div>`+options(it.o);}
    else if(it.k==='order'){const used=x.ans||[];body=`${it.hint?`<div class="muted">${esc(it.hint)}</div>`:''}<div class="built" id="b${i}">${used.map(k=>`<button class="piece" data-un="${k}" ${show?'disabled':''}>${esc(it.pieces[k])}</button>`).join('')||'<span class="note">Bấm các mảnh bên dưới theo thứ tự</span>'}</div><div class="pieces">${it.pieces.map((p,k)=>`<button class="piece ${used.includes(k)?'used':''}" data-pc="${k}" ${show||used.includes(k)?'disabled':''}>${esc(p)}</button>`).join('')}</div>${show?`<div class="small">Đáp án: <span class="han" style="font-size:17px">${esc(it.a)}</span></div>`:''}`;}
    else if(it.k==='char'){body=`<div class="text">${zh(it.s)}</div><input type="text" class="han" data-in="${i}" value="${esc(x.ans||'')}" maxlength="4" style="font-size:22px;width:110px" ${show?'disabled':''} placeholder="Chữ">${show?` <span class="small">Đáp án: <b class="han" style="font-size:20px">${esc(it.a)}</b></span>`:''}`;}
    else if(it.k==='essay'){body=`${it.text?`<div class="text">${zh(it.text)}</div>`:''}<div class="stmt">${esc(it.prompt)}</div>${it.words?`<div class="small">Từ bắt buộc: <span class="han" style="font-size:17px">${esc(it.words.join('、'))}</span></div>`:''}<textarea class="han" data-in="${i}" rows="6" ${show?'disabled':''} placeholder="Viết bài bằng chữ Hán">${esc(x.ans||'')}</textarea><div class="small muted"><span class="num" id="cc${i}">${[...(x.ans||'')].filter(isHan).length}</span> chữ Hán</div>${show?`<div class="w"><b>Bài mẫu:</b> <span class="han">${esc(it.sample)}</span><br><b>Tiêu chí:</b> ${esc(it.rubric||'')}</div><div id="eg${i}"></div>`:''}`;}
    const res=show?(it.k==='essay'?'':isRight(x)?'r-ok':'r-bad'):'';
    box.className='q '+res;
    box.innerHTML=`<span class="qn">Câu ${i+1}</span>${body}${show&&it.w?`<div class="w">${esc(it.w)}</div>`:''}`;
    $$('[data-k]',box).forEach(b=>b.onclick=()=>{x.ans=+b.dataset.k;drawItem(i);progress();});
    $$('[data-tf]',box).forEach(b=>b.onclick=()=>{x.ans=b.dataset.tf==='true';drawItem(i);progress();});
    $$('[data-pc]',box).forEach(b=>b.onclick=()=>{x.ans=[...(x.ans||[]),+b.dataset.pc];drawItem(i);progress();});
    $$('[data-un]',box).forEach(b=>b.onclick=()=>{x.ans=(x.ans||[]).filter(k=>k!==+b.dataset.un);drawItem(i);progress();});
    $$('[data-in]',box).forEach(inp=>inp.oninput=()=>{x.ans=inp.value;const c=$('#cc'+i);if(c)c.textContent=[...inp.value].filter(isHan).length;progress();});
    $$('[data-play]',box).forEach(b=>b.onclick=async()=>{if(!finished){if(x.plays>=2)return;x.plays++;}b.disabled=true;const lines=it.audio.map(([sp,l])=>[sp,l]);await sayLines(lines);drawItem(i);});
  }
  const norm=s=>String(s).replace(/[\s，。？！、,.?!；;：:“”"']/g,'');
  function isRight(x){const it=x.it;
    if(it.k==='tf')return x.ans===it.a;
    if(it.k==='order')return Array.isArray(x.ans)&&norm(x.ans.map(k=>it.pieces[k]).join(''))===norm(it.a);
    if(it.k==='char')return norm(x.ans||'')===norm(it.a);
    return x.ans===it.a;}
  function tick(){left--;const tm=$('#tTimer');if(!tm){clearInterval(timer);return;}tm.textContent=String(Math.floor(Math.max(0,left)/60)).padStart(2,'0')+':'+String(Math.max(0,left)%60).padStart(2,'0');tm.classList.toggle('low',left<120);if(left<=0){clearInterval(timer);toast('Hết giờ, bài đã được nộp.');submit();}}
  if(t.minutes){timer=setInterval(tick,1000);left++;tick();}
  progress();
  async function submit(){
    if(finished)return; finished=true; clearInterval(timer); stopSay(); const tm=$('#tTimer'); if(tm)tm.remove();
    const bySec={};items.forEach(x=>{if(x.it.k==='essay')return;const k=x.s.title;bySec[k]=bySec[k]||{ok:0,n:0};bySec[k].n++;if(isRight(x))bySec[k].ok++;});
    const ok=Object.values(bySec).reduce((a,b)=>a+b.ok,0), n=Object.values(bySec).reduce((a,b)=>a+b.n,0); const pct=n?Math.round(ok/n*100):0;
    $('#tScore').innerHTML=`<div class="panel"><div class="spread"><h2>Kết quả: ${pct}% ${pct>=60?'<span class="pill ai">Đạt</span>':'<span class="pill">Chưa đạt</span>'}</h2><button class="btn sm" id="tBack">Về danh sách đề</button></div>
      <div class="score">${Object.entries(bySec).map(([k,v])=>`<div class="s"><span class="label">${esc(k)}</span><b>${v.ok}/${v.n}</b><span class="small muted">${Math.round(v.ok/v.n*100)}%</span></div>`).join('')}</div>
      <p class="note">Câu sai được viền đỏ, bên dưới mỗi câu có giải thích. Phần nghe giờ hiện cả lời thoại.</p></div>`;
    $$('#tSubmit,#tSubmit2').forEach(b=>b.hidden=true);
    if(lv){P.tests.push({id:t.id,title:t.title,lv,pct,date:Date.now()});touch('main');}
    window.__award&&window.__award(lv?'test':/^gram/.test(t.id)?'grammar':/^order/.test(t.id)?'write':'review',lv?Math.max(1,Math.round(n/10)):Math.max(1,Math.round(n/3)));
    items.forEach(x=>{if(x.it.k==='essay')return;if(!isRight(x)){window.__mistake&&window.__mistake('q',x.it);}else if(window.__mistOk)window.__mistOk(x.it);});touch('main');
    items.forEach((x,i)=>drawItem(i));
    $('#tBack').onclick=()=>renderTest(el); window.scrollTo(0,0);
    items.forEach((x,i)=>{if(x.it.k==='essay'&&AI&&x.ans&&x.ans.trim())gradeEssay(x,i);});
  }
  async function gradeEssay(x,i){
    const out=$('#eg'+i);if(!out)return;out.innerHTML='<div class="ai-out">AI đang chấm bài viết...</div>';
    try{await ask(`Bạn là giám khảo HSK ${lv||''}. Chấm bài viết của học viên người Việt.
Đề: ${x.it.prompt}${x.it.words?' Từ bắt buộc: '+x.it.words.join('、'):''}${x.it.text?'\nĐoạn văn gốc: '+x.it.text:''}
Tiêu chí: ${x.it.rubric||''}
Bài của học viên: ${x.ans}
Trả lời bằng tiếng Việt, văn bản thuần: điểm trên thang 100, nhận xét ngắn (nội dung, ngữ pháp, từ vựng), liệt kê từng lỗi theo dạng "Sai: ... Đúng: ..." kèm lý do, rồi viết lại bài đã sửa bằng chữ Hán. Không dùng gạch ngang dài.`,{onText:({text})=>{out.innerHTML=`<div class="ai-out han">${esc(text)}</div>`;}});}
    catch(e){out.innerHTML=`<p class="note">${esc(aiError(e))}</p>`;}
  }
  const askSubmit=()=>{const empty=items.filter(x=>x.ans===null||x.ans==='').length;
    if(empty&&!$('#tConfirm')){const d=document.createElement('div');d.id='tConfirm';d.className='panel';d.innerHTML=`<span>Còn ${empty} câu chưa làm. Vẫn nộp?</span><div class="row"><button class="btn primary sm" id="tYes">Nộp</button><button class="btn sm" id="tNo">Làm tiếp</button></div>`;$('.runner-head').after(d);$('#tYes').onclick=()=>{d.remove();submit();};$('#tNo').onclick=()=>d.remove();window.scrollTo(0,0);return;}
    if(!empty)submit();};
  $('#tSubmit').onclick=askSubmit;$('#tSubmit2').onclick=askSubmit;
  $('#tQuit').onclick=()=>{clearInterval(timer);stopSay();if(String(t.id).startsWith('gram'))renderGrammar(el);else renderTest(el);};
  window.scrollTo(0,0);
}

/* ================= TALK ================= */
const SCEN=[
 {id:'free',e:'💬',t:'Nói chuyện tự do',d:'Chủ đề gì cũng được, trợ lý AI theo bạn.',lv:1},
 {id:'intro',e:'👋',t:'Làm quen',d:'Giới thiệu tên, quê, công việc, sở thích.',lv:1},
 {id:'cafe',e:'☕',t:'Gọi đồ ở quán cà phê',d:'Gọi món, hỏi giá, chọn đá đường.',lv:1},
 {id:'taxi',e:'🚕',t:'Đi taxi và hỏi đường',d:'Nói địa chỉ, hỏi đường, trả tiền.',lv:2},
 {id:'shop',e:'🛍️',t:'Mua sắm, mặc cả',d:'Hỏi size, màu, xin giảm giá.',lv:2},
 {id:'hotel',e:'🏨',t:'Nhận phòng khách sạn',d:'Đặt phòng, hỏi tiện ích, báo sự cố.',lv:3},
 {id:'doctor',e:'🏥',t:'Đi khám bệnh',d:'Mô tả triệu chứng, hỏi cách uống thuốc.',lv:3},
 {id:'rent',e:'🏠',t:'Thuê nhà',d:'Hỏi tiền thuê, hợp đồng, khu vực.',lv:4},
 {id:'meeting',e:'📊',t:'Họp công việc',d:'Báo cáo tiến độ, đưa ý kiến, phân công.',lv:4},
 {id:'interview',e:'💼',t:'Phỏng vấn xin việc',d:'Giới thiệu kinh nghiệm, trả lời câu hỏi tình huống.',lv:5},
 {id:'negotiate',e:'🤝',t:'Đàm phán với đối tác',d:'Thương lượng giá, điều khoản, thời hạn.',lv:5},
 {id:'debate',e:'🗣️',t:'Tranh luận một chủ đề',d:'Nêu quan điểm, phản biện, kết luận.',lv:6},
 {id:'news',e:'📰',t:'Bàn về tin tức',d:'Tóm tắt và bình luận một vấn đề xã hội.',lv:6}
];
let chat={scen:SCEN[0],lv:null,msgs:[],busy:false,showVi:false,mode:'voice',handsfree:false,voice:false};
function renderTalk(el){
  if(!chat.lv)chat.lv=Math.max(...P.settings.lv);
  el.innerHTML=`<div class="view"><div class="spread"><h2>Luyện hội thoại</h2>${levelChips([chat.lv],s=>{chat.lv=s[0];renderTalk(el);},{multi:false,id:'clv'})}</div>
   <div class="no-ai empty">Phần hội thoại cần trợ lý AI. Vào <b>Tôi</b>, mục Cài đặt, để mở khóa bằng mật khẩu của app.</div>
   <div class="chat need-ai"><div class="scen">${SCEN.map(s=>`<button data-s="${s.id}" aria-pressed="${chat.scen.id===s.id}"><span class="e">${s.e}</span><span><b>${esc(s.t)}</b><br><span class="small muted">${esc(s.d)}</span></span></button>`).join('')}</div>
    <div class="convo"><div class="spread" style="padding:10px 14px;border-bottom:1px solid var(--line)"><b>${chat.scen.e} ${esc(chat.scen.t)}</b><div class="row"><button class="icon-btn" id="cVi" aria-pressed="${chat.showVi}">Hiện nghĩa</button><button class="icon-btn" id="cReset">Bắt đầu lại</button></div></div>
     <div class="msgs" id="msgs"></div>
     <div class="composer"><div class="hints" id="hints"></div>
       <div class="voicebar" id="voicebar">
         <div class="live han" id="live"></div>
         <div class="vrow"><label class="small row" style="gap:6px"><input type="checkbox" id="cHf" ${chat.handsfree?'checked':''}> Rảnh tay</label>
           <button class="micbtn" id="cMic" aria-label="Bấm để nói"><svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>
           <button class="icon-btn" id="cKb" aria-pressed="${chat.mode==='text'}">Gõ phím</button></div>
         <div class="small muted" id="micHint">Bấm micro rồi nói tiếng Trung. Nói xong app tự gửi.</div>
       </div>
       <div class="row" id="textbar" ${chat.mode==='text'?'':'hidden'}><textarea id="cin" rows="2" class="han" placeholder="Gõ tiếng Trung (chữ Hán hoặc pinyin). Bí quá thì gõ tiếng Việt, trợ lý AI sẽ chỉ cách nói."></textarea><button class="btn primary" id="cSend">Gửi</button></div></div></div></div></div></div></div>`;
  refreshAIBits();
  $$('[data-s]',el).forEach(b=>b.onclick=()=>{chat.scen=SCEN.find(s=>s.id===b.dataset.s);chat.msgs=[];renderTalk(el);});
  $('#cVi').onclick=()=>{chat.showVi=!chat.showVi;renderTalk(el);};
  $('#cReset').onclick=()=>{chat.msgs=[];renderTalk(el);};
  $('#cSend').onclick=()=>send(); $('#cin').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
  $('#cKb').onclick=()=>{chat.mode=chat.mode==='text'?'voice':'text';$('#textbar').hidden=chat.mode!=='text';$('#cKb').setAttribute('aria-pressed',chat.mode==='text');if(chat.mode==='text')$('#cin').focus();};
  $('#cHf').onchange=e=>{chat.handsfree=e.target.checked;};
  setupMic();
  drawMsgs();
  if(AI&&!chat.msgs.length)turn(null);
}
function drawMsgs(){
  const box=$('#msgs');if(!box)return;
  box.innerHTML=chat.msgs.map((m,i)=>m.role==='user'?`<div class="msg me"><div class="bubble"><div class="zh han">${m.voice?'<svg class="i"><use href="#i-mic"/></svg> ':''}${esc(m.text)}</div></div>${m.fix?`<div class="fix"><b>Sửa:</b> <span class="han">${esc(m.fix.better)}</span><br>${esc(m.fix.note)}</div>`:''}</div>`
    :`<div class="msg"><div class="bubble"><div class="zh">${P.settings.py?rubyHTML(m.zh):colorText(m.zh)}</div>${chat.showVi||m.open?`<div class="vi">${esc(m.vi)}</div>`:''}</div><div class="row" style="gap:4px"><button class="spk" data-say="${esc(m.zh)}" aria-label="Nghe">${SPK}</button>${chat.showVi?'':`<button class="btn ghost sm" data-open="${i}">Nghĩa</button>`}</div></div>`).join('')+(chat.busy?'<div class="typing">Trợ lý AI đang trả lời...</div>':'');
  $$('[data-open]',box).forEach(b=>b.onclick=()=>{chat.msgs[+b.dataset.open].open=true;drawMsgs();});
  box.scrollTop=box.scrollHeight;
  const last=[...chat.msgs].reverse().find(m=>m.role==='ai');
  $('#hints').innerHTML=last&&last.hints&&last.hints.length?'<span class="small muted">Gợi ý (bấm để nghe):</span>'+last.hints.map(h=>`<button data-h="${esc(h)}">${esc(h)}</button>`).join(''):'';
  $$('#hints [data-h]').forEach(b=>b.onclick=()=>{if(chat.mode==='text'){$('#cin').value=b.dataset.h;$('#cin').focus();}else{say(b.dataset.h);const h=$('#micHint');if(h)h.innerHTML='Nghe xong thì bấm micro và nói lại: <span class="han">'+esc(b.dataset.h)+'</span>';}});
}
function send(text,byVoice){const v=(text!=null?text:$('#cin').value).trim();if(!v||chat.busy)return;if(text==null)$('#cin').value='';chat.msgs.push({role:'user',text:v,voice:!!byVoice});turn(v,!!byVoice);}
async function turn(userText,byVoice){
  chat.busy=true;drawMsgs();
  const lv=chat.lv; const s=chat.scen;
  const history=chat.msgs.slice(-14).map(m=>m.role==='user'?'Học viên: '+m.text:'Bạn: '+m.zh).join('\n');
  const prompt=`Bạn là bạn luyện nói tiếng Trung cho một người Việt đang học HSK ${lvN(lv)}. Tình huống: ${s.t} (${s.d}). Bạn đóng vai người bản xứ phù hợp tình huống (nhân viên, bác sĩ, nhà tuyển dụng, đối tác...), nói tự nhiên, câu ngắn, chỉ dùng từ vựng và ngữ pháp trong phạm vi HSK ${lvN(lv)}${lv<=2?', câu rất ngắn và đơn giản':''}. Mỗi lượt chỉ nói 1-3 câu và luôn kết thúc bằng một câu hỏi hoặc gợi mở để học viên trả lời.
${userText===null?'Hãy mở đầu cuộc hội thoại.':'Hội thoại đến giờ:\n'+history}
${userText!==null?`Câu mới nhất của học viên: "${userText}".${byVoice?' Câu này được máy nhận giọng chuyển thành chữ, nên nếu có chữ lạ hoặc không hợp ngữ cảnh thì nhiều khả năng học viên phát âm sai từ đó (sai thanh điệu hoặc phụ âm): khi đó ghi trong fix.note từ nào có thể bị phát âm sai và nên đọc thế nào (kèm pinyin).':''} Nếu câu đó có lỗi (ngữ pháp, từ dùng sai, trật tự từ, hoặc học viên viết tiếng Việt/pinyin), điền "fix" để chỉ cách nói đúng; nếu câu đã đúng và tự nhiên thì "fix" là null.`:''}
Trả về DUY NHẤT JSON: {"zh":"lời bạn nói, chữ Hán giản thể","vi":"dịch tiếng Việt","fix":${userText===null?'null':'{"better":"câu đúng bằng chữ Hán","note":"giải thích ngắn bằng tiếng Việt"} hoặc null'},"hints":["3 câu trả lời mẫu ngắn bằng chữ Hán mà học viên có thể nói tiếp"]}`;
  try{
    const r=await askJSON(prompt,{cache:false,modelTier:'default'});
    if(userText!==null&&r.fix&&r.fix.better){const u=[...chat.msgs].reverse().find(m=>m.role==='user');if(u)u.fix=r.fix;}
    chat.msgs.push({role:'ai',zh:String(r.zh||''),vi:String(r.vi||''),hints:Array.isArray(r.hints)?r.hints.slice(0,3):[]});
    chat.busy=false;drawMsgs();await say(String(r.zh||''));
    if(chat.handsfree&&chat.mode==='voice'&&current==='speak'&&$('#cMic')&&!chat.listening)$('#cMic').click();
  }catch(e){chat.busy=false;drawMsgs();toast(aiError(e));}
}
function setupMic(){
  const b=$('#cMic'),hint=$('#micHint'),live=$('#live');if(!b)return;
  const noVoice=msg=>{b.disabled=true;hint.innerHTML=msg;chat.mode='text';$('#textbar').hidden=false;$('#cKb').setAttribute('aria-pressed','true');};
  if(IN_ARTIFACT){noVoice('Trong khung chat của Claude không dùng được micro. Mở <a href="https://hanyu-ecru.vercel.app/#speak" target="_blank" rel="noopener">bản web</a> để nói bằng giọng. Tạm thời gõ phím bên dưới.');return;}
  if(!canListen()){noVoice('Máy này chưa ghi âm được. Nhập mật khẩu ứng dụng (Tôi -> Cài đặt) và cho phép micro, hoặc gõ phím bên dưới.');return;}
  let rec=null,sent=false;
  const idle='Bấm micro rồi nói tiếng Trung. Nói xong app tự gửi.';
  b.onclick=()=>{
    if(chat.busy)return;
    if(rec){if(rec.whisper)hint.textContent='Đang chuyển giọng thành chữ...';rec.stop();return;}
    stopSay();sent=false;live.textContent='';
    rec=listen({lang:'zh-CN',continuous:false,maxMs:30000,onText:t=>{live.textContent=t;},onEnd:t=>{
      rec=null;chat.listening=false;b.classList.remove('on');live.textContent='';t=String(t||'').trim();
      if(t&&!sent){sent=true;hint.textContent=idle;send(t,true);}else if(!t)hint.textContent='Chưa nghe thấy gì. Bấm micro và nói to, rõ hơn.';}});
    if(!rec){noVoice('Không mở được micro. Gõ phím bên dưới.');return;}
    chat.listening=true;b.classList.add('on');
    hint.textContent=rec.whisper?'Đang ghi âm... nói xong dừng một chút, app tự chuyển thành chữ và gửi. Bấm lại để dừng.':'Đang nghe... nói xong dừng một chút, app tự gửi. Bấm lại để dừng.';
  };
}


/* ================= STROKES: step diagrams + rules ================= */
async function drawSteps(ch,box,chEl,nEl,onClick){
  if(!box)return; if(chEl)chEl.textContent=ch;
  const d=await strokeData(ch);
  if(!d){box.innerHTML='<p class="note">Chưa có dữ liệu nét cho chữ này.</p>';if(nEl)nEl.textContent='';return;}
  const n=d.strokes.length; if(nEl)nEl.textContent=n+' nét';
  const num=(i)=>{const m=d.medians[i]&&d.medians[i][0];return m?`<circle cx="${m[0]}" cy="${m[1]}" r="62" fill="var(--bad)"/><text x="${m[0]}" y="${m[1]}" font-size="80" font-family="Noto Sans,sans-serif" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central" transform="scale(1,-1) translate(0,${-2*m[1]})">${i+1}</text>`:'';};
  box.innerHTML=d.strokes.map((_,k)=>`<button class="step" title="Bước ${k+1}"><svg viewBox="0 0 1024 1024"><g transform="translate(0,900) scale(1,-1)">${d.strokes.map((sp,i)=>`<path d="${sp}" fill="${i<k?'var(--ink)':i===k?'var(--bad)':'var(--line)'}"/>`).join('')}${num(k)}</g></svg><span class="num">${k+1}</span></button>`).join('');
  $$('.step',box).forEach(b=>b.onclick=onClick);
}
const STROKE_TYPES=[
 ['一','Ngang (横 héng)','Kéo từ trái sang phải.'],['丨','Sổ (竖 shù)','Kéo thẳng từ trên xuống.'],['丿','Phẩy (撇 piě)','Kéo chéo từ trên phải xuống dưới trái.'],
 ['㇏','Mác (捺 nà)','Kéo chéo từ trên trái xuống dưới phải, cuối nét đè mạnh rồi thoát ra.'],['丶','Chấm (点 diǎn)','Chấm ngắn, thường chéo xuống bên phải.'],
 ['㇀','Hất (提 tí)','Hất ngắn từ dưới trái lên trên phải.'],['𠃍','Gập (折 zhé)','Ngang rồi gập xuống sổ, viết liền một nét.'],['亅','Móc (钩 gōu)','Cuối nét móc ngược lên, ví dụ sổ móc.']];
const STROKE_RULES=[
 ['Ngang trước, sổ sau','十 干 丰','Gặp nét ngang cắt nét sổ thì viết ngang trước.'],
 ['Phẩy trước, mác sau','人 八 文','Hai nét chéo tách sang hai bên: phẩy (trái) trước, mác (phải) sau.'],
 ['Trên trước, dưới sau','三 京 草','Viết từ phía trên xuống phía dưới.'],
 ['Trái trước, phải sau','你 好 明','Chữ có hai phần trái phải thì viết phần trái trước.'],
 ['Ngoài trước, trong sau','月 同 问','Khung bao ba phía bên trên viết trước, phần bên trong viết sau.'],
 ['Vào nhà rồi đóng cửa','国 回 四','Khung kín bốn phía: viết hai cạnh và nội dung bên trong, nét ngang đáy viết cuối cùng.'],
 ['Giữa trước, hai bên sau','小 水 办','Khi phần giữa nổi bật hơn hai bên thì viết giữa trước.'],
 ['Bao dưới viết sau cùng','这 近 建','Bộ 辶 hay 廴 bọc phía dưới bên trái viết sau phần bên trong.'],
 ['Chấm nhỏ thường viết cuối','我 犬 戈','Chấm phía trên bên phải hay nằm trong chữ thường để cuối.']];
function strokeRulesHTML(){
  return `<div class="grid2"><div class="panel"><h3>Quy tắc thứ tự nét</h3>
    ${STROKE_RULES.map((r,i)=>`<div class="rule"><span class="rn num">${i+1}</span><div><b>${r[0]}</b> <span class="han rx">${r[1].split(' ').map(c=>`<button class="lnk han" data-wch="${c}">${c}</button>`).join(' ')}</span><div class="note">${r[2]}</div></div></div>`).join('')}
    <p class="note">Bấm vào chữ ví dụ để luyện ngay chữ đó.</p></div>
   <div class="panel"><h3>Các nét cơ bản</h3><div class="stypes">${STROKE_TYPES.map(t=>`<div class="stype"><span class="han sx">${t[0]}</span><div><b>${t[1]}</b><div class="note">${t[2]}</div></div></div>`).join('')}</div></div></div>`;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-wch]');if(b){writeTarget=b.dataset.wch;if(!WI.get(writeTarget))WI.set(writeTarget,{h:writeTarget,p:pyChars(writeTarget).map(o=>o.p||''),hv:'',vi:'',em:'',ex:'',exp:'',exvi:'',cl:[],lv:0,tmp:1});go('write');}});

/* ================= PINYIN ================= */
let PY=null;
async function renderPinyin(el){
  el.innerHTML='<div class="view"><p class="note">Đang tải...</p></div>';
  if(!PY)PY=await (await fetch('data/pinyin.json')).json();
  const grp=(arr,key)=>{const g={};arr.forEach(x=>{(g[x.grp]=g[x.grp]||[]).push(x);});return g;};
  const ex=list=>list.map(e=>`<button class="pex" data-say="${esc(e[0])}"><span class="han">${esc(e[0])}</span> <span class="py t${toneOf(e[1])}">${esc(e[1])}</span> <span class="muted">${esc(e[2])}</span></button>`).join('');
  const block=(x,k)=>`<div class="pcard"><div class="spread"><span class="pk py">${esc(x[k])}</span><span class="muted small py">${esc(x.ipa||'')}</span></div><div class="small">${esc(x.vi)}</div><div class="pexs">${ex(x.ex||[])}</div></div>`;
  const I=grp(PY.initials), F=grp(PY.finals);
  const finals=[...new Set(PY.table.map(t=>t.f))], inits=['',...new Set(PY.table.map(t=>t.i).filter(Boolean))];
  const cell={};PY.table.forEach(t=>{cell[t.i+'|'+t.f]=t;});
  el.innerHTML=`<div class="view"><h2>Bảng chữ cái pinyin</h2>
   <p class="note">Một âm tiết = thanh mẫu (phụ âm đầu) + vận mẫu (vần) + thanh điệu. Ví dụ: <span class="py">m + ā = mā</span>. Bấm vào chữ ví dụ để nghe.</p>
   <div class="row">${['Thanh mẫu','Vận mẫu','Quy tắc viết','Bảng âm tiết','Quy tắc đọc'].map((t,i)=>`<button class="chip" data-ps="${i}" aria-pressed="${i===(window.__pySub||0)}">${t}</button>`).join('')}<a class="chip" href="#tones" data-go2="tones">Thanh điệu</a></div>
   <div data-pp="4" class="view" hidden></div>
   <div data-pp="0" class="view">${Object.entries(I).map(([g,xs])=>`<h3>${esc(g)}</h3><div class="pgrid">${xs.map(x=>block(x,'i')).join('')}</div>`).join('')}</div>
   <div data-pp="1" class="view" hidden>${Object.entries(F).map(([g,xs])=>`<h3>${esc(g)}</h3><div class="pgrid">${xs.map(x=>block(x,'f')).join('')}</div>`).join('')}</div>
   <div data-pp="2" class="view" hidden>${PY.rules.map(r=>`<div class="panel"><h3>${esc(r.t)}</h3><div>${esc(r.d)}</div>${r.ex?`<div class="py small muted">${esc(r.ex)}</div>`:''}</div>`).join('')}</div>
   <div data-pp="3" class="view" hidden><p class="note">Hàng là thanh mẫu, cột là vận mẫu. Bấm một ô để nghe đủ 4 thanh, giọng người thật. Ô trống là tổ hợp không tồn tại trong tiếng phổ thông.</p>
     <div class="panel" id="pStrip" hidden></div>
     <div class="ptable-wrap"><table class="ptable"><thead><tr><th></th>${finals.map(f=>`<th class="py">${esc(f)}</th>`).join('')}</tr></thead><tbody>${inits.map(i=>`<tr><th class="py">${i||'∅'}</th>${finals.map(f=>{const t=cell[i+'|'+f];return t?`<td><button class="py" data-cell="${esc(t.s)}" data-c="${esc(t.c)}">${esc(t.s)}</button></td>`:'<td></td>';}).join('')}</tr>`).join('')}</tbody></table></div></div>
  </div>`;
  const showSub=k=>{window.__pySub=+k;$$('[data-ps]',el).forEach(x=>x.setAttribute('aria-pressed',x.dataset.ps===String(k)));$$('[data-pp]',el).forEach(p=>p.hidden=p.dataset.pp!==String(k));if(+k===4)pronRender($('[data-pp="4"]',el));};
  $$('[data-ps]',el).forEach(b=>b.onclick=()=>showSub(b.dataset.ps));
  if(window.__pySub)showSub(window.__pySub);
  $$('[data-go2]',el).forEach(a=>a.onclick=e=>{e.preventDefault();go(a.dataset.go2);});
  const MARK={a:'āáǎà',o:'ōóǒò',e:'ēéěè',i:'īíǐì',u:'ūúǔù',v:'ǖǘǚǜ'};
  const toned=(syl,n)=>{let x=syl.replace(/ü/g,'v');const pos=x.includes('a')?x.indexOf('a'):x.includes('e')?x.indexOf('e'):x.includes('ou')?x.indexOf('o'):(()=>{for(let k=x.length-1;k>=0;k--)if('aoeiuv'.includes(x[k]))return k;return -1;})();
    if(pos<0)return syl;return (x.slice(0,pos)+MARK[x[pos]][n-1]+x.slice(pos+1)).replace(/v/g,'ü');};
  $$('[data-cell]',el).forEach(b=>b.onclick=()=>{const syl=b.dataset.cell, base=stripTone(syl);const st=$('#pStrip');st.hidden=false;
    st.innerHTML=`<div class="spread"><b class="py" style="font-size:20px">${esc(syl)}</b><span class="note">Chữ ví dụ: <span class="han" style="font-size:18px">${esc(b.dataset.c)}</span> <button class="btn ghost sm" data-say="${esc(b.dataset.c)}"><svg class="i"><use href="#i-play"/></svg></button></span></div><div class="tonebtns">${[1,2,3,4].map(n=>`<button class="btn" data-syl="${base}${n}"><span class="py t${n}">${toned(syl,n)}</span></button>`).join('')}</div>`;
    saySyl(base+'1');st.scrollIntoView({block:'nearest',behavior:'smooth'});});
}

/* ================= RADICALS ================= */
let RAD=null, radTier='1', radQ='';
async function renderRadicals(el){
  el.innerHTML='<div class="view"><p class="note">Đang tải...</p></div>';
  if(!RAD)RAD=await (await fetch('data/radicals.json')).json();
  el.innerHTML=`<div class="view"><div class="spread"><h2>214 bộ thủ</h2><span class="note num" id="rCount"></span></div>
   <p class="note">Bộ thủ là thành phần gợi nghĩa của chữ Hán. Nhận ra bộ thủ giúp đoán nghĩa và nhớ mặt chữ nhanh hơn. Ví dụ chữ có bộ 氵 (thủy) thường liên quan đến nước: 河 sông, 海 biển, 洗 rửa.</p>
   <div class="dict-tools"><input type="search" id="rq" placeholder="Tìm theo chữ, Hán Việt hoặc nghĩa, ví dụ thủy, nước, 心" value="${esc(radQ)}">
    <div class="row">${[['1','Hay gặp'],['2','Thường gặp'],['3','Ít gặp'],['all','Tất cả']].map(([k,t])=>`<button class="chip" data-rt="${k}" aria-pressed="${radTier===k}">${t}</button>`).join('')}</div>
    <button class="btn sm" id="rQuiz">Kiểm tra 10 bộ</button></div>
   <div class="rgrid" id="rg"></div></div>`;
  const draw=()=>{
    const q=viFold(radQ.trim());
    const list=RAD.filter(x=>(radTier==='all'||String(x.f)===radTier)&&(!q||x.r===radQ.trim()||x.v.includes(radQ.trim())||viFold(x.hv).includes(q)||viFold(x.vi).includes(q)||x.ex.some(e=>e[0]===radQ.trim())));
    $('#rCount').textContent=list.length+' bộ';
    $('#rg').innerHTML=list.map(x=>`<button class="rcard" data-rn="${x.n}"><span class="rnum num">${x.n}</span><span class="rch han">${esc(x.r)}</span>${x.v.length?`<span class="rv han">${esc(x.v.join(' '))}</span>`:''}<span class="rhv">${esc(x.hv)}</span><span class="small muted">${esc(x.vi)}</span></button>`).join('')||'<div class="empty">Không có bộ nào khớp.</div>';
    $$('#rg .rcard').forEach(b=>b.onclick=()=>openRadical(+b.dataset.rn));
  };
  let t;$('#rq').oninput=e=>{radQ=e.target.value;clearTimeout(t);t=setTimeout(draw,120);};
  $$('[data-rt]',el).forEach(b=>b.onclick=()=>{radTier=b.dataset.rt;$$('[data-rt]',el).forEach(x=>x.setAttribute('aria-pressed',x===b));draw();});
  $('#rQuiz').onclick=()=>{const pool=RAD.filter(x=>radTier==='all'||String(x.f)===radTier);const qs=shuffle(pool).slice(0,10);
    runTest({id:'rad-'+Date.now(),title:'Kiểm tra bộ thủ',minutes:0,sections:[{type:'read',title:'Bộ thủ',parts:[{instr:'Chọn nghĩa đúng của bộ thủ',items:qs.map(x=>{const o=shuffle([x,...shuffle(RAD.filter(y=>y!==x&&y.vi!==x.vi)).slice(0,3)]);return {k:'fill',s:x.r+(x.v.length?' ('+x.v.join(' ')+')':''),o:o.map(y=>y.hv+' - '+y.vi),a:o.indexOf(x),w:'Bộ '+x.hv+' ('+x.vi+'). '+x.tip+' Ví dụ: '+x.ex.map(e=>e[0]).join(', ')};})}]}]},null);};
  draw();
}
function openRadical(n){
  const x=RAD.find(r=>r.n===n);if(!x)return;
  const hsk=W.filter(w=>[...w.h].some(c=>x.ex.some(e=>e[0]===c))).slice(0,12);
  const m=modal(`<div class="wd-head"><div class="h han">${esc(x.r)}</div><div style="display:flex;flex-direction:column;gap:2px"><div style="font-size:22px"><b>Bộ ${esc(x.hv)}</b> <span class="py">${esc(x.p)}</span></div><div>${esc(x.vi)}</div><div class="row"><span class="pill">Bộ số ${x.n}</span><span class="pill">${x.s} nét</span>${x.v.length?`<span class="pill">Dạng khác: <span class="han">${esc(x.v.join(' '))}</span></span>`:''}</div></div><button class="spk" data-say="${esc(x.r)}" aria-label="Nghe" style="margin-left:auto">${SPK}</button></div>
    <div class="vn">${esc(x.tip)}</div>
    <div><span class="label">Thứ tự nét</span><div class="steps" id="rSteps"></div></div>
    <div><span class="label">Chữ có bộ này</span><div class="pexs" style="margin-top:6px">${x.ex.map(e=>`<button class="pex" data-say="${esc(e[0])}"><span class="han" style="font-size:22px">${esc(e[0])}</span> <span class="py t${toneOf(e[1])}">${esc(e[1])}</span> <span class="muted">${esc(e[2])}</span></button>`).join('')}</div></div>
    ${hsk.length?`<div><span class="label">Từ HSK chứa các chữ này</span><div class="pexs" style="margin-top:6px">${hsk.map(w=>`<button class="pex" data-wd="${esc(w.h)}"><span class="han">${hanHTML(w)}</span> <span class="muted small">${esc(w.vi)}</span></button>`).join('')}</div></div>`:''}
    <div class="row"><button class="btn sm" data-wch="${esc(x.r)}">Luyện viết bộ này</button></div>`);
  drawSteps(x.r,$('#rSteps',m.el),null,null,()=>{});
  $$('[data-wd]',m.el).forEach(b=>b.onclick=()=>{m.close();openWord(b.dataset.wd);});
  $$('[data-wch]',m.el).forEach(b=>b.addEventListener('click',()=>m.close()));
}


/* ================= shared skill helpers ================= */
const PUNCT=/[\s，。？！、,.?!；;：:“”"'‘’（）()《》…—\-]/g;
function segment(text){
  try{const sg=new Intl.Segmenter('zh',{granularity:'word'});return [...sg.segment(text)].map(x=>x.segment);}catch(e){}
  const out=[];let buf='';for(const c of text){if(PUNCT.test(c)){PUNCT.lastIndex=0;if(buf)out.push(buf);buf='';out.push(c);}else{buf+=c;if(buf.length===2){out.push(buf);buf='';}}}if(buf)out.push(buf);return out;
}
const tonelessPy=t=>{try{return window.pinyinPro.pinyin(t,{toneType:'none',type:'array'}).map(x=>x.replace(/ü/g,'v'));}catch(e){return [...t];}};
function lcsMatch(a,b,eq){ // returns boolean[] over a
  const n=a.length,m=b.length,dp=Array.from({length:n+1},()=>new Array(m+1).fill(0));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=eq(a[i],b[j])?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  const ok=new Array(n).fill(false);let i=0,j=0;while(i<n&&j<m){if(eq(a[i],b[j])){ok[i]=true;i++;j++;}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++;}
  return ok;
}
// compare learner input (hanzi or pinyin) with target sentence; returns {ok:boolean[], chars, pct}
function compareZh(target,input){
  const chars=[...target.replace(PUNCT,'')];
  const inp=input.replace(PUNCT,'');
  const tp=tonelessPy(chars.join(''));
  let ok;
  if([...inp].some(isHan)){const ip=tonelessPy(inp);const ic=[...inp];
    ok=lcsMatch(chars.map((c,i)=>[c,tp[i]]),ic.map((c,i)=>[c,ip[i]]),(x,y)=>x[0]===y[0]||x[1]===y[1]);}
  else{const syl=stripTone(input).replace(/[^a-zv\s']/g,' ').trim();
    const joined=syl.replace(/[\s']/g,'');ok=new Array(chars.length).fill(false);let pos=0;
    tp.forEach((p,i)=>{const k=joined.indexOf(p,pos);if(k>=0&&k-pos<=3){ok[i]=true;pos=k+p.length;}});}
  return {ok,chars,pct:chars.length?Math.round(ok.filter(Boolean).length/chars.length*100):0};
}
const markHTML=r=>r.chars.map((c,i)=>`<span class="${r.ok[i]?'mk-ok':'mk-bad'}">${esc(c)}</span>`).join('');
function skillLv(){return Math.max(...P.settings.lv);}
function sentencePool(lv){const ws=W.filter(w=>w.lv<=lv&&w.ex&&w.ex.length>=5);const cur=ws.filter(w=>w.lv===lv);return cur.length>20?cur:ws;}
function subTabs(id,items,cur,onPick){
  setTimeout(()=>$$('#'+id+' [data-st]').forEach(b=>b.onclick=()=>onPick(b.dataset.st)));
  return `<div class="row" id="${id}">${items.map(([k,t])=>`<button class="chip" data-st="${k}" aria-pressed="${k===cur}">${t}</button>`).join('')}</div>`;
}

/* ================= LISTEN ================= */
let LS={lv:null,mode:'dict',items:[],i:0,score:0,done:false};
function renderListen(el){
  if(!LS.lv)LS.lv=skillLv();
  el.innerHTML=`<div class="view"><div class="spread"><h2>Luyện nghe</h2>${levelChips([LS.lv],s=>{LS.lv=s[0];newListen();renderListen(el);},{multi:false,id:'llv'})}</div>
   ${subTabs('lmode',[['dict','Chép chính tả'],['mean','Nghe chọn nghĩa'],['hz','Nghe chọn chữ'],['passage','Nghe bài đọc'],['daily','Hội thoại hôm nay'],['tone','Nghe thanh điệu']],LS.mode,m=>{if(m==='tone'){go('tones');return;}LS.mode=m;if(m!=='passage'&&m!=='daily')newListen();renderListen(el);})}
   <div class="panel" id="lBox"></div></div>`;
  if(LS.mode==='passage'){lpPassage($('#lBox'));return;}
  if(LS.mode==='daily'){lpDaily($('#lBox'));return;}
  if(!LS.items.length)newListen();
  drawListen();
}
function newListen(){
  const lv=LS.lv;LS.i=0;LS.score=0;LS.done=false;
  if(LS.mode==='dict')LS.items=shuffle(sentencePool(lv)).slice(0,10).map(w=>({w}));
  else{const pool=W.filter(w=>w.lv===lv);LS.items=shuffle(pool).slice(0,10).map(w=>{const o=shuffle([w,...shuffle(pool.filter(x=>x!==w&&x.vi!==w.vi&&x.h!==w.h)).slice(0,3)]);return {w,o};});}
}
function drawListen(){
  const b=$('#lBox');if(!b)return; const it=LS.items[LS.i];
  if(!it){b.innerHTML=`<div class="done"><div class="big num">${LS.score}/${LS.items.length}</div><p>${LS.mode==='dict'?'Điểm chính tả trung bình':'Câu đúng'}</p><button class="btn primary" id="lAgain">Làm lượt mới</button></div>`;$('#lAgain').onclick=()=>{newListen();drawListen();};return;}
  const head=`<div class="spread"><span class="label">Câu ${LS.i+1}/${LS.items.length}</span><span class="small muted num">${LS.mode==='dict'?'Điểm':'Đúng'}: ${LS.score}</span></div>
    <div class="row"><button class="btn primary" id="lPlay"><svg class="i"><use href="#i-play"/></svg> Nghe</button><button class="btn" id="lSlow">Nghe chậm</button></div>`;
  if(LS.mode==='dict'){
    b.innerHTML=head+`<p class="note">Gõ lại câu vừa nghe bằng chữ Hán, hoặc bằng pinyin không dấu nếu chưa gõ được chữ Hán.</p>
      <textarea id="lIn" rows="2" class="han" style="font-size:20px" placeholder="Câu bạn nghe được"></textarea>
      <div class="row"><button class="btn" id="lHint">Gợi ý pinyin</button><button class="btn primary" id="lCheck">Kiểm tra</button></div><div id="lRes"></div>`;
    $('#lHint').onclick=()=>{$('#lRes').innerHTML=`<div class="py">${sentPyHTML(it.w.exp)}</div>`;};
    $('#lCheck').onclick=()=>{const r=compareZh(it.w.ex,$('#lIn').value);if(!it.checked){it.checked=1;LS.score+=Math.round(r.pct/10);window.__award&&window.__award('listen',1);if(r.pct<80)window.__mistake&&window.__mistake('word',it.w.h);}
      $('#lRes').innerHTML=`<div class="q ${r.pct>=80?'r-ok':'r-bad'}"><div class="han" style="font-size:22px">${markHTML(r)}</div><div class="py small">${sentPyHTML(it.w.exp)}</div><div class="muted">${esc(it.w.exvi)}</div><b>${r.pct}% đúng</b><div class="row"><button class="btn sm" data-wd="${esc(it.w.h)}">Xem từ ${esc(it.w.h)}</button><button class="btn primary sm" id="lNext">Câu tiếp</button></div></div>`;
      $('#lNext').onclick=()=>{LS.i++;drawListen();};$$('[data-wd]',b).forEach(x=>x.onclick=()=>openWord(x.dataset.wd));};
  }else{
    b.innerHTML=head+`<div class="opts">${it.o.map((o,k)=>`<button class="opt" data-k="${k}">${LS.mode==='mean'?esc(o.vi):`<span class="han zh" style="font-size:24px">${esc(o.h)}</span>`}</button>`).join('')}</div><div id="lRes"></div>`;
    $$('[data-k]',b).forEach(x=>x.onclick=()=>{if(it.ans!=null)return;it.ans=+x.dataset.k;const right=it.o[it.ans]===it.w;if(right)LS.score++;else window.__mistake&&window.__mistake('word',it.w.h);window.__award&&window.__award('listen',1);
      $$('[data-k]',b).forEach((y,k)=>{y.disabled=true;if(it.o[k]===it.w)y.classList.add('right');else if(k===it.ans)y.classList.add('wrong');});
      $('#lRes').innerHTML=`<div class="row" style="margin-top:6px"><span class="han" style="font-size:22px">${hanHTML(it.w)}</span><span class="py">${pyHTML(it.w)}</span><span>${esc(it.w.vi)}</span><button class="btn primary sm" id="lNext" style="margin-left:auto">Tiếp</button></div>`;
      $('#lNext').onclick=()=>{LS.i++;drawListen();};});
  }
  const play=slow=>LS.mode==='dict'?say(it.w.ex,{rate:slow?0.55:undefined}):sayWord(it.w.h,{rate:slow?0.55:undefined});
  $('#lPlay').onclick=()=>play(false);$('#lSlow').onclick=()=>play(true);
  setTimeout(()=>play(false),250);
}

/* ================= SPEAK ================= */
let SP={sub:'shadow',lv:null,cur:null,src:'ex'};
function renderSpeak(el){
  if(!SP.lv)SP.lv=skillLv();
  el.innerHTML=`<div class="view"><h2>Luyện nói</h2>${subTabs('smode',[['shadow','Nhại theo câu mẫu'],['talk','Hội thoại với trợ lý AI']],SP.sub,m=>{SP.sub=m;renderSpeak(el);})}<div id="sBox"></div></div>`;
  if(SP.sub==='talk'){renderTalk($('#sBox'));return;}
  const box=$('#sBox');
  box.innerHTML=`<div class="view">${levelChips([SP.lv],s=>{SP.lv=s[0];SP.cur=null;renderSpeak(el);},{multi:false,id:'slv2'})}
    <div class="panel" id="shBox"></div>
    <p class="note">Cách luyện: nghe câu mẫu 2-3 lần, bấm Nói rồi đọc to. Máy nhận giọng và tô xanh những chữ nghe đúng, đỏ những chữ chưa rõ. Máy nhận giọng chưa chấm được thanh điệu, nên hãy nghe lại bản thu của chính mình để so với câu mẫu.</p></div>`;
  drawShadow();
}
function drawShadow(){
  const b=$('#shBox');if(!b)return;
  if(!SP.cur){const w=pick(sentencePool(SP.lv));SP.cur={zh:w.ex,py:w.exp,vi:w.exvi,h:w.h};}
  const c=SP.cur; const SR=canListen(); const canRec=!!(navigator.mediaDevices&&window.MediaRecorder);
  b.innerHTML=`<div class="han" style="font-size:26px;line-height:1.8">${P.settings.py?rubyHTML(c.zh):colorText(c.zh)}</div><div class="muted">${esc(c.vi)}</div>
    <div class="row"><button class="btn" id="shPlay"><svg class="i"><use href="#i-play"/></svg> Nghe mẫu</button><button class="btn" id="shSlow">Nghe chậm</button>
    ${SR?'<button class="btn primary" id="shRec"><svg class="i"><use href="#i-mic"/></svg> Nói</button>':''}${canRec?'<button class="btn" id="shSelf">⏺ Thu giọng mình</button>':''}<button class="btn ghost" id="shNext">Câu khác</button></div>
    <div id="shRes"></div>${!SR?'<p class="note">Máy này chưa ghi âm được. Nhập mật khẩu ứng dụng (Tôi -> Cài đặt) và cho phép micro để được chấm tự động.</p>':''}`;
  $('#shPlay').onclick=()=>say(c.zh);$('#shSlow').onclick=()=>say(c.zh,{rate:0.55});
  $('#shNext').onclick=()=>{SP.cur=null;drawShadow();};
  if(SR)$('#shRec').onclick=()=>{
    const btn=$('#shRec');
    if(SP.rec){if(SP.rec.whisper)btn.innerHTML='Đang chuyển thành chữ...';SP.rec.stop();return;}
    stopSay();
    SP.rec=listen({lang:'zh-CN',continuous:false,maxMs:15000,onText:t=>{if(t)$('#shRes').innerHTML=`<div class="muted han">${esc(t)}</div>`;},onEnd:heard=>{
      SP.rec=null;btn.innerHTML='<svg class="i"><use href="#i-mic"/></svg> Nói';heard=String(heard||'').trim();
      if(!heard){$('#shRes').innerHTML='<p class="note">Chưa nghe thấy gì. Bấm Nói rồi đọc to, rõ câu mẫu.</p>';return;}
      const r=compareZh(c.zh,heard);
      $('#shRes').innerHTML=`<div class="q ${r.pct>=80?'r-ok':'r-bad'}"><div class="han" style="font-size:24px">${markHTML(r)}</div><div class="small muted">Máy nghe được: <span class="han">${esc(heard)}</span></div><b>${r.pct}% rõ</b> ${r.pct>=90?'Rất tốt.':r.pct>=70?'Khá. Luyện thêm các chữ màu đỏ.':'Nghe mẫu chậm rồi đọc lại từng cụm.'}</div>`;
      window.__award&&window.__award('speak',1);}});
    if(!SP.rec){$('#shRes').innerHTML='<p class="note">Máy này chưa ghi âm được. Nhập mật khẩu ứng dụng và cho phép micro.</p>';return;}
    btn.innerHTML=SP.rec.whisper?'<svg class="i"><use href="#i-square"/></svg> Đang ghi, bấm để dừng':'<svg class="i"><use href="#i-square"/></svg> Đang nghe...';
  };
  if(canRec)$('#shSelf').onclick=async()=>{
    const btn=$('#shSelf');
    if(SP.mr&&SP.mr.state==='recording'){SP.mr.stop();return;}
    try{const st=await navigator.mediaDevices.getUserMedia({audio:true});const ch=[];const mr=new MediaRecorder(st);SP.mr=mr;
      mr.ondataavailable=e=>ch.push(e.data);mr.onstop=()=>{st.getTracks().forEach(t=>t.stop());btn.textContent='⏺ Thu giọng mình';const url=URL.createObjectURL(new Blob(ch,{type:mr.mimeType}));
        const d=document.createElement('div');d.className='row';d.innerHTML=`<span class="small muted">Bản thu của bạn:</span>`;const a=document.createElement('audio');a.controls=true;a.src=url;d.appendChild(a);const mb=document.createElement('button');mb.className='btn sm';mb.textContent='Nghe mẫu để so';mb.onclick=()=>say(c.zh);d.appendChild(mb);$('#shRes').appendChild(d);};
      mr.start();btn.innerHTML='<svg class="i"><use href="#i-square"/></svg> Dừng thu';}
    catch(e){toast('Không mở được micro ở trang này.');}
  };
}

/* ================= READ ================= */
let RD=null, rdLv=null, rdOpen=null;
async function renderRead(el){
  if(!rdLv)rdLv=skillLv();
  el.innerHTML='<div class="view"><p class="note">Đang tải bài đọc...</p></div>';
  if(!RD)RD=await (await fetch('data/reading.json')).json();
  if(rdOpen){drawReader(el,RD.find(r=>r.id===rdOpen));return;}
  P.reads=P.reads||{};
  const list=RD.filter(r=>r.lv===rdLv);
  el.innerHTML=`<div class="view"><div class="spread"><h2>Luyện đọc</h2>${levelChips([rdLv],s=>{rdLv=s[0];renderRead(el);},{multi:false,id:'rlv'})}</div>
   <p class="note">Mỗi cấp có 10 bài. Bấm vào bất kỳ từ nào trong bài để xem nghĩa. Đọc xong làm câu hỏi để kiểm tra mức hiểu.</p>
   <div class="grid3">${list.map(r=>{const sc=P.reads[r.id];const n=r.paras.reduce((a,p)=>a+[...p[0].replace(PUNCT,'')].length,0);
     return `<button class="panel tcard" style="text-align:left" data-rid="${r.id}"><span class="label">${esc(r.genre)} - ${n} chữ</span><h3 class="han" style="font-size:20px">${esc(r.title)}</h3><span class="note">${esc(r.tvi)}</span>${sc!=null?`<span class="small">Đã đọc: <b>${sc}%</b> câu hỏi đúng</span>`:''}</button>`;}).join('')}
     <div class="panel tcard need-ai"><span class="label">AI soạn</span><h3>Bài đọc mới</h3><span class="note">Nhập chủ đề bạn thích, AI viết bài đúng cấp HSK ${lvN(rdLv)}.</span><div class="row"><input type="text" id="rTopic" placeholder="Ví dụ: du lịch Đà Lạt, nuôi mèo" style="flex:1 1 140px"><button class="btn sm" id="rGen">Soạn</button></div></div>
   </div></div>`;
  refreshAIBits();
  $$('[data-rid]',el).forEach(b=>b.onclick=()=>{rdOpen=b.dataset.rid;renderRead(el);window.scrollTo(0,0);});
  const g=$('#rGen');if(g)g.onclick=async()=>{const topic=$('#rTopic').value.trim()||'đời sống hằng ngày';g.disabled=true;g.textContent='Đang viết...';
    try{const len={1:'50',2:'90',3:'160',4:'250',5:'380',6:'550'}[rdLv];
      const r=await askJSON(`Viết một bài đọc tiếng Trung giản thể mới cho người Việt học HSK ${lvN(rdLv)} (chuẩn HSK 2026), chủ đề: "${topic}". Khoảng ${len} chữ Hán, chỉ dùng từ vựng trong phạm vi HSK ${lvN(rdLv)}. Trả JSON đúng cấu trúc:
{"id":"ai","lv":${rdLv},"title":"tiêu đề tiếng Trung","tvi":"tiêu đề tiếng Việt","genre":"thể loại tiếng Việt","paras":[["đoạn tiếng Trung","bản dịch tiếng Việt"]],"gloss":[["từ","pinyin","nghĩa tiếng Việt"]],"q":[{"q":"câu hỏi tiếng Trung","o":["A","B","C","D"],"a":0,"w":"giải thích tiếng Việt"}]}
Có 4 câu hỏi, đáp án phân bố đều. Không dùng gạch ngang dài.`,{modelTier:'default'});
      if(!r||!Array.isArray(r.paras))throw {code:'bad_json'};r.id='ai-'+Date.now();r.lv=rdLv;r.q=r.q||[];r.gloss=r.gloss||[];RD.push(r);rdOpen=r.id;renderRead(el);}
    catch(e){toast(aiError(e));g.disabled=false;g.textContent='Soạn';}};
}
function wordSpans(text){
  return segment(text).map(seg=>{if(!/[\u3400-\u9fff]/.test(seg))return esc(seg);
    const inner=P.settings.py?rubyHTML(seg):colorText(seg);return `<span class="rw" data-rw="${esc(seg)}">${inner}</span>`;}).join('');
}
function drawReader(el,r){
  let showVi=false,reading=false;
  const sib=RD.filter(x=>x.lv===r.lv&&!String(x.id).startsWith('ai')), idx=sib.indexOf(r);
  const prev=idx>0?sib[idx-1]:null, next=idx>=0&&idx<sib.length-1?sib[idx+1]:null;
  const upLv=!next&&LVS.includes(r.lv+1)?r.lv+1:null;
  const openR=x=>{stopSay();reading=false;rdOpen=x.id;drawReader(el,x);window.scrollTo(0,0);};
  const draw=()=>{
    el.innerHTML=`<div class="view reader"><div class="spread"><button class="btn sm" id="rBack">Danh sách bài</button><div class="row"><button class="icon-btn" id="rVi" aria-pressed="${showVi}">Hiện bản dịch</button><button class="icon-btn" id="rPy" aria-pressed="${P.settings.py}">Pinyin</button><button class="btn sm" id="rPlay">${reading?'<svg class="i"><use href="#i-square"/></svg> Dừng':'<svg class="i"><use href="#i-play"/></svg> Nghe cả bài'}</button></div></div>
     <div><span class="pill">HSK ${lvN(r.lv)}</span> <span class="pill">${esc(r.genre||'')}</span></div>
     <h2 class="han" style="font-size:28px">${wordSpans(r.title)}</h2><div class="muted">${esc(r.tvi||'')}</div>
     <article class="rtext">${r.paras.map((p,i)=>`<div class="rpara"><p class="han">${wordSpans(p[0])} <button class="spk" data-say="${esc(p[0])}" aria-label="Nghe đoạn">${SPK}</button></p>${showVi?`<p class="rvi">${esc(p[1])}</p>`:''}</div>`).join('')}</article>
     <div id="rLook" class="rlook" hidden></div>
     ${r.gloss&&r.gloss.length?`<div class="panel"><h3>Từ cần chú ý</h3><div class="pexs">${r.gloss.map(g=>`<button class="pex" data-say="${esc(g[0])}"><span class="han">${esc(g[0])}</span> <span class="py t${toneOf(g[1])}">${esc(g[1])}</span> <span class="muted">${esc(g[2])}</span></button>`).join('')}</div></div>`:''}
     <div class="panel"><h3>Câu hỏi đọc hiểu</h3>${r.q.map((q,i)=>`<div class="q" id="rq${i}"><div class="han stmt">${i+1}. ${esc(q.q)}</div><div class="opts">${q.o.map((o,k)=>`<button class="opt han" data-q="${i}" data-k="${k}">${esc(o)}</button>`).join('')}</div><div class="w" hidden></div></div>`).join('')}
      <div class="row"><button class="btn primary" id="rCheck">Chấm điểm</button><span id="rScore"></span></div></div>
     <div class="rnav">${prev?`<button class="btn" id="rPrev"><svg class="i"><use href="#i-chevron-left"/></svg> Bài trước</button>`:'<span></span>'}<span class="small muted num">${idx>=0?`Bài ${idx+1}/${sib.length}`:''}</span>${next?`<button class="btn" id="rNext">Bài tiếp theo <svg class="i"><use href="#i-chevron-right"/></svg></button>`:upLv?`<button class="btn" id="rUp">Sang HSK ${lvN(upLv)} <svg class="i"><use href="#i-chevron-right"/></svg></button>`:'<span></span>'}</div></div>`;
    const ans={};
    $('#rBack').onclick=()=>{stopSay();reading=false;rdOpen=null;renderRead(el);};
    const pv=$('#rPrev');if(pv)pv.onclick=()=>openR(prev);
    const nx=$('#rNext');if(nx)nx.onclick=()=>openR(next);
    const up=$('#rUp');if(up)up.onclick=()=>{stopSay();reading=false;rdLv=upLv;const f=RD.find(x=>x.lv===upLv);rdOpen=f?f.id:null;renderRead(el);window.scrollTo(0,0);};
    $('#rVi').onclick=()=>{showVi=!showVi;draw();};
    $('#rPy').onclick=()=>{P.settings.py=!P.settings.py;touch('main');applySettings();draw();};
    $('#rPlay').onclick=async()=>{if(reading){reading=false;stopSay();draw();return;}reading=true;draw();for(const p of r.paras){if(!reading)break;await say(p[0]);}reading=false;draw();};
    $$('[data-q]',el).forEach(b=>b.onclick=()=>{const qi=+b.dataset.q;ans[qi]=+b.dataset.k;$$(`[data-q="${qi}"]`,el).forEach(x=>x.setAttribute('aria-pressed',x===b));});
    $('#rCheck').onclick=()=>{let ok=0;r.q.forEach((q,i)=>{const box=$('#rq'+i);$$(`[data-q="${i}"]`,box).forEach((x,k)=>{x.disabled=true;if(k===q.a)x.classList.add('right');else if(ans[i]===k)x.classList.add('wrong');});if(ans[i]===q.a)ok++;const w=$('.w',box);w.hidden=false;w.textContent=q.w;});
      const pct=r.q.length?Math.round(ok/r.q.length*100):0;$('#rScore').innerHTML=`<b>${ok}/${r.q.length}</b> câu đúng`;$('#rCheck').hidden=true;
      const nb=$('#rNext')||$('#rUp');if(nb){nb.classList.add('primary');nb.scrollIntoView({block:'center',behavior:'smooth'});}if(!String(r.id).startsWith('ai')){P.reads=P.reads||{};P.reads[r.id]=pct;}window.__award&&window.__award('read',1);touch('main');};
    $$('.rw',el).forEach(sp=>sp.onclick=e=>{e.stopPropagation();lookup(sp.dataset.rw,sp);});
  };
  draw();
}
function lookup(seg,anchor){
  const box=$('#rLook');if(!box)return; const w=WI.get(seg);
  const chars=[...seg].filter(isHan);
  const sub=!w&&chars.length>1?chars.map(c=>WI.get(c)).filter(Boolean):[];
  box.hidden=false;
  box.innerHTML=`<div class="spread"><div class="row"><span class="han" style="font-size:28px;font-weight:700">${w?hanHTML(w):colorText(seg)}</span><span class="py">${w?pyHTML(w):esc(pyLine(seg))}</span>${w&&w.hv?`<span class="muted small">${esc(w.hv)}</span>`:''}</div><div class="row"><button class="spk" data-say="${esc(seg)}" aria-label="Nghe">${SPK}</button><button class="spk" id="lkX" aria-label="Đóng">✕</button></div></div>
   <div>${w?esc(w.vi)+` <span class="pill">${lvLabel(w.lv)}</span>`:sub.length?sub.map(x=>`<span class="han">${esc(x.h)}</span>: ${esc(x.vi)}`).join('; '):'<span class="muted">Từ này không có trong danh sách HSK.</span>'}</div>
   <div class="row">${w?`<button class="btn sm" id="lkMore">Chi tiết</button>${P.srs[seg]?'':'<button class="btn sm" id="lkAdd">Thêm vào ôn tập</button>'}`:''}${!w&&AI?'<button class="btn sm" id="lkAi">Hỏi AI nghĩa</button>':''}</div><div id="lkOut" class="small"></div>`;
  $('#lkX').onclick=()=>box.hidden=true;
  const m=$('#lkMore');if(m)m.onclick=()=>openWord(seg);
  const a=$('#lkAdd');if(a)a.onclick=()=>{P.srs[seg]={iv:0,ef:2.5,n:0,l:0,due:Date.now(),s:1,first:Date.now()};touch('srs');touch('main');a.remove();toast('Đã thêm '+seg+' vào ôn tập.');};
  const ai=$('#lkAi');if(ai)ai.onclick=async()=>{ai.disabled=true;try{const {text}=await ask(`Giải thích ngắn gọn bằng tiếng Việt từ tiếng Trung "${seg}": pinyin, nghĩa, một ví dụ ngắn kèm dịch. Không quá 3 dòng, không markdown.`,{modelTier:'quick'});$('#lkOut').textContent=text;}catch(e){toast(aiError(e));}};
  speak(seg);
}

/* ================= WRITE (hub) ================= */
let WR={sub:'chars',lv:null,tr:null};
const ESSAY_TOPICS={1:['Giới thiệu bản thân','Gia đình tôi','Một ngày của tôi'],2:['Món ăn tôi thích','Cuối tuần của tôi','Bạn thân của tôi'],3:['Một chuyến du lịch','Thói quen học tập','Thành phố tôi sống'],4:['Ưu và nhược điểm của điện thoại','Một quyết định quan trọng','Công việc mơ ước'],5:['Làm việc từ xa: nên hay không','Một bài học từ thất bại','Mạng xã hội thay đổi cuộc sống ra sao'],6:['Trí tuệ nhân tạo và việc làm','Thành công nghĩa là gì','Giữ gìn văn hóa truyền thống']};
function renderWrite(el){
  if(!WR.lv)WR.lv=skillLv();
  el.innerHTML=`<div class="view"><h2>Luyện viết</h2>${subTabs('wmode',[['chars','Viết chữ'],['order','Sắp xếp câu'],['trans','Dịch Việt sang Trung'],['essay','Viết đoạn văn']],WR.sub,m=>{WR.sub=m;renderWrite(el);})}<div id="wBox"></div></div>`;
  const box=$('#wBox');
  if(WR.sub==='chars'){renderWriteChars(box);return;}
  const lvc=levelChips([WR.lv],s=>{WR.lv=s[0];WR.tr=null;renderWrite(el);},{multi:false,id:'wlv'});
  if(WR.sub==='order'){
    box.innerHTML=`<div class="view">${lvc}<div class="panel"><h3>Sắp xếp từ thành câu</h3><p class="note">Đây là dạng bài viết của đề HSK 3-5. Mỗi lượt 10 câu lấy từ câu ví dụ theo cấp, có nghĩa tiếng Việt làm gợi ý.</p><button class="btn primary" id="oGo" style="align-self:flex-start">Bắt đầu 10 câu</button></div></div>`;
    $('#oGo').onclick=()=>{const qs=shuffle(sentencePool(WR.lv)).slice(0,10);
      runTest({id:'order-'+Date.now(),title:'Sắp xếp câu HSK '+WR.lv,minutes:0,sections:[{type:'write',title:'Sắp xếp câu',parts:[{instr:'Bấm các mảnh theo đúng thứ tự để tạo thành câu',items:qs.map(w=>orderItem(w.ex,w.exvi,'Từ khóa: '+w.h+' ('+w.vi+')'))}]}]},null);};
    return;
  }
  if(WR.sub==='trans'){
    if(!WR.tr)WR.tr=pick(sentencePool(WR.lv));const w=WR.tr;
    box.innerHTML=`<div class="view">${lvc}<div class="panel"><span class="label">Dịch câu sau sang tiếng Trung</span><div style="font-size:20px;font-weight:600">${esc(w.exvi)}</div>
      <div class="small muted">Gợi ý: dùng từ <button class="lnk han" data-wd="${esc(w.h)}">${esc(w.h)}</button></div>
      <textarea id="tIn" rows="2" class="han" style="font-size:20px" placeholder="Viết bằng chữ Hán (gõ pinyin bằng bộ gõ tiếng Trung)"></textarea>
      <div class="row"><button class="btn primary" id="tCheck">Kiểm tra</button><button class="btn" id="tNext">Câu khác</button></div><div id="tRes"></div></div></div>`;
    $$('[data-wd]',box).forEach(x=>x.onclick=()=>openWord(x.dataset.wd));
    $('#tNext').onclick=()=>{WR.tr=null;renderWrite(el);};
    $('#tCheck').onclick=async()=>{const v=$('#tIn').value.trim();if(!v)return;const r=compareZh(w.ex,v);window.__award&&window.__award('write',1);
      $('#tRes').innerHTML=`<div class="q"><div class="small muted">Câu tham khảo:</div><div class="han" style="font-size:21px">${colorText(w.ex)}</div><div class="py small">${sentPyHTML(w.exp)}</div><div class="small">Trùng với câu tham khảo: <b>${r.pct}%</b>. Câu khác cách diễn đạt vẫn có thể đúng.</div><div id="tAi"></div></div>`;
      if(AI){const out=$('#tAi');out.innerHTML='<div class="ai-out">AI đang nhận xét...</div>';
        try{await ask(`Học viên người Việt trình độ HSK ${lvN(WR.lv)} dịch câu "${w.exvi}" sang tiếng Trung thành: "${v}". Câu tham khảo: "${w.ex}". Nhận xét ngắn bằng tiếng Việt: câu của học viên đúng hay sai, tự nhiên chưa; nếu sai thì ghi "Sai: ... Đúng: ..." kèm lý do ngắn. Tối đa 5 dòng, văn bản thuần, không gạch ngang dài.`,{modelTier:'quick',onText:({text})=>{out.innerHTML=`<div class="ai-out">${esc(text)}</div>`;}});}
        catch(e){out.innerHTML=`<p class="note">${esc(aiError(e))}</p>`;}}};
    return;
  }
  // essay
  const topics=ESSAY_TOPICS[WR.lv]||ESSAY_TOPICS[3]; const len={1:30,2:50,3:80,4:120,5:180,6:300}[WR.lv];
  const draft=store.get('hanyu-essay',{});
  box.innerHTML=`<div class="view">${lvc}<div class="panel"><span class="label">Chọn đề hoặc tự đặt đề</span><div class="row">${topics.map(t=>`<button class="chip" data-tp="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <input type="text" id="eTopic" placeholder="Đề bài" value="${esc(draft.topic||topics[0])}">
    <textarea id="eText" rows="8" class="han" style="font-size:18px" placeholder="Viết khoảng ${len} chữ Hán">${esc(draft.text||'')}</textarea>
    <div class="spread"><span class="small muted"><span class="num" id="eCount">0</span> / ${len} chữ Hán</span><button class="btn primary need-ai" id="eGrade">AI chấm và sửa</button></div>
    <p class="note no-ai">Cần bật AI để chấm bài. Bài nháp vẫn được lưu trên máy này.</p><div id="eOut"></div></div></div>`;
  refreshAIBits();
  const cnt=()=>{$('#eCount').textContent=[...$('#eText').value].filter(isHan).length;store.set('hanyu-essay',{topic:$('#eTopic').value,text:$('#eText').value});};cnt();
  $('#eText').oninput=cnt;$('#eTopic').oninput=cnt;
  $$('[data-tp]',box).forEach(b=>b.onclick=()=>{$('#eTopic').value=b.dataset.tp;cnt();});
  const g=$('#eGrade');if(g)g.onclick=async()=>{const t=$('#eText').value.trim();if([...t].filter(isHan).length<5){toast('Viết thêm vài câu đã.');return;}const out=$('#eOut');g.disabled=true;out.innerHTML='<div class="ai-out">AI đang chấm...</div>';
    window.__award&&window.__award('write',2);try{await ask(`Bạn là giáo viên tiếng Trung chấm bài viết cho học viên người Việt trình độ HSK ${lvN(WR.lv)}. Đề: "${$('#eTopic').value}". Bài viết:\n${t}\n\nTrả lời bằng tiếng Việt, văn bản thuần, không markdown, không gạch ngang dài:\n1. Điểm trên thang 100 và nhận xét chung 2 câu.\n2. Liệt kê từng lỗi theo dạng "Sai: ... Đúng: ..." kèm lý do ngắn (ngữ pháp, từ dùng sai, trật tự từ).\n3. Bài đã sửa hoàn chỉnh bằng chữ Hán.\n4. 3 từ hoặc mẫu câu HSK ${lvN(WR.lv)} nên dùng để bài hay hơn, kèm pinyin và nghĩa.`,{onText:({text})=>{out.innerHTML=`<div class="ai-out han">${esc(text)}</div>`;}});}
    catch(e){out.innerHTML=`<p class="note">${esc(aiError(e))}</p>`;}g.disabled=false;};
}
function orderItem(sentence,vi,extra){
  const end=(sentence.match(/[。？！]$/)||[''])[0];
  let pieces=segment(sentence.replace(/[。？！]$/,'')).filter(x=>x.trim());
  // merge punctuation into previous piece and tiny pieces to keep 3-7 chunks
  const m=[];pieces.forEach(p=>{if(PUNCT.test(p)&&m.length){PUNCT.lastIndex=0;m[m.length-1]+=p;}else{PUNCT.lastIndex=0;m.push(p);}});
  while(m.length>7){let k=0,best=1e9;for(let i=0;i<m.length-1;i++){const l=m[i].length+m[i+1].length;if(l<best){best=l;k=i;}}m.splice(k,2,m[k]+m[k+1]);}
  let sh=shuffle(m);let tries=0;while(sh.join('')===m.join('')&&m.length>1&&tries++<5)sh=shuffle(m);
  return {k:'order',pieces:sh,a:sentence,hint:vi+(extra?' - '+extra:''),w:'Câu đúng: '+sentence+(end?'':'')};
}

/* ================= TONES ================= */
const TONES=[
 {n:1,name:'Thanh 1',ch:'妈',py:'mā',vi:'mẹ',pts:[[0,5],[1,5]],d:'Cao và đều, giữ hơi như hát một nốt cao. Gần thanh ngang nhưng cao hơn hẳn.'},
 {n:2,name:'Thanh 2',ch:'麻',py:'má',vi:'cây gai',pts:[[0,3],[1,5]],d:'Đi từ giữa lên cao, như khi hỏi lại "Hả?". Gần thanh sắc.'},
 {n:3,name:'Thanh 3',ch:'马',py:'mǎ',vi:'con ngựa',pts:[[0,2],[.45,1],[1,4]],d:'Xuống thấp rồi lên. Trong câu thường chỉ đọc nửa đầu (xuống thấp). Gần thanh hỏi.'},
 {n:4,name:'Thanh 4',ch:'骂',py:'mà',vi:'mắng',pts:[[0,5],[1,1]],d:'Từ cao rơi thẳng xuống, ngắn và dứt khoát. Bắt đầu cao hơn thanh huyền.'},
 {n:5,name:'Thanh nhẹ',ch:'吗',py:'ma',vi:'trợ từ hỏi',pts:null,d:'Ngắn, nhẹ, không nhấn. Cao độ tùy âm tiết đứng trước.'}];
const RULES=[['Hai thanh 3 đi liền','Thanh 3 đầu đọc thành thanh 2.','你好','nǐ hǎo -> ní hǎo'],['不 trước thanh 4','不 (bù) đổi thành bú.','不是','bù shì -> bú shì'],['一 trước thanh 4','一 (yī) đổi thành yí.','一个','yī gè -> yí ge'],['一 trước thanh 1, 2, 3','一 đổi thành yì.','一起','yī qǐ -> yì qǐ']];
const DRILL=[['妈','mā',1],['麻','má',2],['马','mǎ',3],['骂','mà',4],['汤','tāng',1],['糖','táng',2],['躺','tǎng',3],['烫','tàng',4],['八','bā',1],['拔','bá',2],['把','bǎ',3],['爸','bà',4],['衣','yī',1],['姨','yí',2],['椅','yǐ',3],['意','yì',4],['书','shū',1],['熟','shú',2],['鼠','shǔ',3],['树','shù',4],['吃','chī',1],['茶','chá',2],['水','shuǐ',3],['去','qù',4]];
function contour(t){
  const Wd=160,H=96,x0=22,x1=Wd-8,y=l=>8+(5-l)*(H-16)/4;let g='';
  for(let l=1;l<=5;l++)g+=`<line x1="${x0}" x2="${x1}" y1="${y(l)}" y2="${y(l)}" stroke="var(--line)" stroke-width="1"/><text x="6" y="${y(l)+4}" font-size="10" fill="var(--muted)" font-family="Noto Sans,sans-serif">${l}</text>`;
  let m;if(!t.pts)m=`<circle cx="${(x0+x1)/2}" cy="${y(3)}" r="6" fill="var(--t5)"/>`;
  else{const P2=t.pts.map(p=>[x0+8+p[0]*(x1-x0-16),y(p[1])]);const d=P2.length===3?`M${P2[0][0]} ${P2[0][1]} Q${P2[1][0]} ${P2[1][1]+18} ${P2[2][0]} ${P2[2][1]}`:`M${P2[0][0]} ${P2[0][1]} L${P2[1][0]} ${P2[1][1]}`;m=`<path d="${d}" stroke="var(--t${t.n})" stroke-width="4" fill="none" stroke-linecap="round"/>`;}
  return `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Đường cao độ ${t.name}">${g}${m}</svg>`;
}
let drill={cur:null,right:0,total:0,done:false};
async function playDrill(){const c=drill.cur;const syl=stripTone(c[1])+c[2];if(!(await saySyl(syl)))say(c[0]);}
function renderTones(el){
  el.innerHTML=`<div class="view"><h2>Thanh điệu</h2><div class="tones">${TONES.map(t=>`<button class="tone" data-syl="${stripTone(t.py)}${t.n===5?5:t.n}" data-fb="${t.ch}"><span class="tn t${t.n}">${t.name}</span>${contour(t)}<span class="row"><span class="han t${t.n}" style="font-size:30px;font-weight:700">${t.ch}</span><span class="py t${t.n}" style="font-size:18px">${t.py}</span></span><span class="small muted"><b style="color:var(--ink)">${t.vi}</b>. ${t.d}</span></button>`).join('')}</div>
   <p class="note">Thang 5 mức của Triệu Nguyên Nhậm: thanh 1 = 55, thanh 2 = 35, thanh 3 = 214, thanh 4 = 51.</p>
   <div class="grid2"><div class="panel"><div class="spread"><h3>Biến điệu cần nhớ</h3><button class="btn sm" id="toRules">Xem đủ quy tắc đọc</button></div>${RULES.map(r=>`<div><b>${r[0]}</b><div class="note">${r[1]}</div><div><span class="han" style="font-size:18px">${r[2]}</span> <span class="py">${r[3]}</span> <button class="btn ghost sm" data-say="${r[2]}"><svg class="i"><use href="#i-play"/></svg></button></div></div>`).join('')}</div>
   <div class="panel" id="drill" style="align-items:center;text-align:center"></div></div></div>`;
  drawDrill();
  const tr=$('#toRules');if(tr)tr.onclick=()=>{window.__pySub=4;go('pinyin');};
}
function drawDrill(){
  const c=drill.cur,b=$('#drill');if(!b)return;
  b.innerHTML=`<h3>Luyện nghe thanh điệu</h3><p class="note">Nghe một âm tiết rồi đoán thanh.</p><button class="btn primary" id="dPlay">${c?'Nghe lại':'Bắt đầu'}</button>
   <div style="min-height:64px">${drill.done?`<div class="han t${c[2]}" style="font-size:40px;font-weight:700;line-height:1.1">${c[0]}</div><div class="py t${c[2]}">${c[1]}</div>`:''}</div>
   <div class="tonebtns" style="width:100%">${[1,2,3,4].map(n=>`<button class="btn" data-t="${n}" ${!c||drill.done?'disabled':''} style="${drill.done&&n===c[2]?'border-color:var(--ok)':''}"><span class="t${n}">${['ā','á','ǎ','à'][n-1]}</span></button>`).join('')}</div>
   <div class="row"><span class="small muted num">${drill.right}/${drill.total} đúng</span>${drill.done?'<button class="btn sm" id="dNext">Âm tiếp</button>':''}</div>`;
  $('#dPlay').onclick=()=>{if(!c){drill.cur=pick(DRILL);drawDrill();}playDrill();};
  $$('#drill [data-t]').forEach(x=>x.onclick=()=>{drill.done=true;drill.total++;if(+x.dataset.t===c[2])drill.right++;else toast('Chưa đúng, đây là thanh '+c[2]);drawDrill();});
  const n=$('#dNext');if(n)n.onclick=()=>{drill.cur=pick(DRILL);drill.done=false;drawDrill();playDrill();};
}

/* ================= boot ================= */
async function boot(){
  uiInit();
  applySettings();
  const h=(location.hash||'').slice(1); if(VIEWS[h])current=h;
  $('#view').innerHTML='<div class="view"><p class="note">Đang tải từ vựng...</p></div>';
  await loadLevel(Math.min(...P.settings.lv));
  route();
  initPlatform();
  await loadAllWords();
  for(const L of [8,9])try{await loadLevel(L);}catch(e){}
  if(['home','dict','study','progress'].includes(current)&&!$('.modal-bg'))route(true);
  setTimeout(()=>{if(!$('.modal-bg'))uiIntro();},700);
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-phw]');if(b){e.preventDefault();e.stopPropagation();const o=$('.modal-bg');if(o)o.remove();openWord(b.dataset.phw);}},true);
if(!IN_ARTIFACT&&'serviceWorker' in navigator&&location.protocol==='https:'){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}
boot().catch(e=>{console.error(e);$('#view').innerHTML='<div class="empty">Không tải được dữ liệu. Tải lại trang thử xem.</div>';});
})();
