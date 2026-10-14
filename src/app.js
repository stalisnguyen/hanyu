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
const W=[]; const WI=new Map(); const LV_COUNT=[0,0,0,0,0,0,0]; let loadedLv=new Set();
let GRAM=[]; const TESTS={}; let STROKE_IDX=null; const STROKE_CACHE={};
async function loadLevel(L){
  if(loadedLv.has(L))return;
  const r=await fetch('data/words-'+L+'.json'); const rows=await r.json();
  if(loadedLv.has(L))return;
  rows.forEach((x,i)=>{const w={h:x[0],p:x[1].split(' '),hv:x[2],vi:x[3],em:x[4],ex:x[5],exp:x[6],exvi:x[7],cl:x[8]||[],lv:L,i};W.push(w);WI.set(w.h,w);});
  LV_COUNT[L]=rows.length; loadedLv.add(L);
}
async function loadAllWords(){for(let L=1;L<=6;L++)await loadLevel(L);}
async function loadGrammar(){if(!GRAM.length){GRAM=await (await fetch('data/grammar.json')).json();}return GRAM;}
async function loadTests(L){if(!TESTS[L])TESTS[L]=await (await fetch('data/tests/hsk'+L+'.json')).json();return TESTS[L];}
async function strokeData(ch){
  if(!STROKE_IDX)STROKE_IDX=await (await fetch('data/strokes/index.json')).json();
  const L=STROKE_IDX[ch]; if(!L) return null;
  if(!STROKE_CACHE[L])STROKE_CACHE[L]=fetch('data/strokes/s'+L+'.json').then(r=>r.json());
  return (await STROKE_CACHE[L])[ch]||null;
}
function pyHTML(w){return w.p.map(s=>`<span class="t${toneOf(s)}">${esc(s)}</span>`).join('');}
function hanHTML(w){const ch=[...w.h];if(ch.length!==w.p.length)return esc(w.h);return ch.map((c,i)=>`<span class="t${toneOf(w.p[i])}">${c}</span>`).join('');}
function wordsAt(levels){return W.filter(w=>levels.includes(w.lv)).concat(P.custom.filter(()=>levels.includes(0)));}

/* ================= progress state ================= */
const DEFAULT={v:1,upd:0,settings:{lv:[1],newPerDay:10,py:true,color:true,hv:true,mode:'hz',voiceRate:0.85},srs:{},hist:{},gram:{},tests:[],custom:[]};
let P=Object.assign(structuredClone(DEFAULT),store.get('hanyu-p',{}));
P.settings=Object.assign({},DEFAULT.settings,P.settings||{});
let dirty=new Set();
function touch(part){P.upd=Date.now();dirty.add(part);store.set('hanyu-p',P);scheduleSync();}
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
function dueList(levels){const now=Date.now();return W.filter(w=>levels.includes(w.lv)&&P.srs[w.h]&&P.srs[w.h].due<=now).sort((a,b)=>P.srs[a.h].due-P.srs[b.h].due);}
function newToday(){const t=today();return Object.values(P.srs).filter(c=>c.first>=t).length;}
function newList(levels,limit){const out=[];for(const w of W){if(out.length>=limit)break;if(levels.includes(w.lv)&&!P.srs[w.h])out.push(w);}return out;}
function streak(){let s=0,t=today();if(!P.hist[ymd(t)])t-=DAY;while(P.hist[ymd(t)]){s++;t-=DAY;}return s;}

/* ================= platform: db / user / sample ================= */
let DB=null, UID=null, AI=null, syncState='local';
async function initPlatform(){
  const C=window.claude; if(!C||typeof C.use!=='function'){renderSync();return;}
  try{
    const [db,user,sample]=await Promise.all([C.use('db').catch(()=>null),C.use('user').catch(()=>null),C.use('sample').catch(()=>null)]);
    if(sample){AI=sample;document.body.classList.add('has-ai');refreshAIBits();}
    if(db&&user){const id=await user.id();if(id){DB=db;UID=id;await pullRemote();}}
  }catch(e){console.warn(e);}
  renderSync();
}
function docRef(name){return DB.doc('data/users/'+UID+'/'+name);}
async function pullRemote(){
  try{
    const main=await docRef('main').get();
    if(main.exists){
      const m=main.data();
      if((m.upd||0)>(P.upd||0)){
        const srs={};
        for(const part of ['srs1','srs2','srs3','srs4','srs5','srs6','srs0']){const s=await docRef(part).get();if(s.exists)Object.assign(srs,s.data().cards||{});}
        P=Object.assign(structuredClone(DEFAULT),m,{srs});P.settings=Object.assign({},DEFAULT.settings,m.settings||{});
        store.set('hanyu-p',P); applySettings(); route(true);
        syncState='on'; return;
      }
    }
    syncState='on'; dirty.add('main');dirty.add('srs'); await pushRemote();
  }catch(e){console.warn('sync pull',e);syncState='err';}
}
let syncTimer=null;
function scheduleSync(){if(!DB)return;clearTimeout(syncTimer);syncTimer=setTimeout(pushRemote,2500);}
async function pushRemote(){
  if(!DB||!dirty.size)return; const parts=[...dirty]; dirty.clear();
  try{
    if(parts.includes('main')||parts.includes('srs')){
      const {srs,...main}=P; await docRef('main').set(JSON.parse(JSON.stringify(main)));
    }
    if(parts.includes('srs')){
      const by={};for(const [h,c] of Object.entries(P.srs)){const w=WI.get(h);const L=w?w.lv:0;(by[L]=by[L]||{})[h]=c;}
      for(const L of [0,1,2,3,4,5,6]){if(by[L])await docRef('srs'+L).set({cards:by[L]});}
    }
    syncState='on';
  }catch(e){console.warn('sync push',e);parts.forEach(p=>dirty.add(p));syncState='err';}
  renderSync();
}
function renderSync(){
  const el=$('#sync');if(!el)return;
  el.className='sync'+(syncState==='on'?' on':'');
  const t=syncState==='on'?'Đã đồng bộ':syncState==='err'?'Lỗi đồng bộ, đang lưu trên máy':'Lưu trên máy này';el.title=t;el.innerHTML='<i></i><span class="sync-t">'+t+'</span>';
}
async function ask(prompt,opts={}){ if(!AI)throw new Error('no-ai'); return AI(prompt,opts); }
async function askJSON(prompt,opts={}){ if(!AI)throw new Error('no-ai'); return AI.json(prompt,opts); }
function aiError(e){
  const c=e&&e.code;
  if(c==='not_granted')return 'Bạn chưa cho phép trang dùng Claude. Mở menu Permissions của artifact để bật lại.';
  if(c==='rate_limited')return 'Đang gửi quá nhiều yêu cầu. Đợi một lúc rồi thử lại.';
  return 'Claude chưa trả lời được. Thử lại sau ít phút.';
}
function refreshAIBits(){$$('.need-ai').forEach(el=>el.hidden=!AI);$$('.no-ai').forEach(el=>el.hidden=!!AI);}

/* ================= speech ================= */
let voices=[];
function loadVoices(){try{voices=speechSynthesis.getVoices().filter(v=>/^zh/i.test(v.lang));voices.sort((a,b)=>(/CN/i.test(b.lang)-/CN/i.test(a.lang)));}catch(e){}}
try{loadVoices();speechSynthesis.onvoiceschanged=loadVoices;}catch(e){}
function say(text,{rate,voice=0}={}){
  return new Promise(res=>{
    try{
      const u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';u.rate=rate||P.settings.voiceRate;
      if(voices.length)u.voice=voices[voice%voices.length]; if(voice%2===1&&voices.length<2)u.pitch=0.75;
      u.onend=res;u.onerror=res;speechSynthesis.speak(u);
      if(!voices.length&&!window.__ttsWarned)setTimeout(()=>{loadVoices();if(!voices.length&&!window.__ttsWarned){window.__ttsWarned=1;toast('Máy chưa có giọng đọc tiếng Trung. Cài thêm giọng Chinese (Simplified) trong cài đặt ngôn ngữ của hệ điều hành.',5000);}},500);
    }catch(e){res();}
  });
}
function stopSay(){try{speechSynthesis.cancel();}catch(e){}}
async function sayLines(lines){stopSay();for(const [sp,t] of lines){await say(t,{voice:sp==='女'?0:sp==='男'?1:2});await new Promise(r=>setTimeout(r,350));}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-say]');if(b){e.preventDefault();stopSay();say(b.dataset.say);}});

/* ================= routing ================= */
const VIEWS={home:renderHome,study:renderStudy,dict:renderDict,write:renderWrite,grammar:renderGrammar,test:renderTest,talk:renderTalk,tones:renderTones};
let current='home';
function go(v){current=v;try{history.replaceState(null,'','#'+v);}catch(e){}route();window.scrollTo(0,0);}
function route(soft){
  $$('nav.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.v===current));
  if(soft&&['test','talk','write'].includes(current))return;
  stopSay(); (VIEWS[current]||renderHome)($('#view'));
}
function applySettings(){
  document.body.classList.toggle('mono',!P.settings.color);
  $('#tgPy').setAttribute('aria-pressed',P.settings.py);$('#tgColor').setAttribute('aria-pressed',P.settings.color);
}

/* ================= level chips ================= */
function levelChips(sel,onChange,{multi=true,id='lvc'}={}){
  const html=`<div class="row" id="${id}"><span class="label">HSK</span>${[1,2,3,4,5,6].map(L=>`<button class="chip" data-l="${L}" aria-pressed="${sel.includes(L)}">${L}</button>`).join('')}</div>`;
  setTimeout(()=>{$$('#'+id+' .chip').forEach(b=>b.onclick=()=>{
    const L=+b.dataset.l; let s;
    if(multi){s=sel.includes(L)?sel.filter(x=>x!==L):[...sel,L].sort();if(!s.length)return;} else s=[L];
    onChange(s);
  });});
  return html;
}

/* ================= HOME ================= */
function renderHome(el){
  const lv=P.settings.lv; const due=dueList(lv).length; const nw=Math.max(0,P.settings.newPerDay-newToday());
  const st=streak(); const todayN=P.hist[ymd(Date.now())]||0;
  const pool=W.filter(w=>w.em&&lv.includes(w.lv)); const wd=pool.length?pool[(Math.floor(Date.now()/DAY))%pool.length]:null;
  const heat=[];const start=today()-83*DAY;for(let i=0;i<84;i++){const n=P.hist[ymd(start+i*DAY)]||0;heat.push(n===0?'':n<10?'h1':n<25?'h2':n<50?'h3':'h4');}
  el.innerHTML=`<div class="view">
   <div class="hero">
    <div class="today">
      <div class="label" style="color:inherit;opacity:.85">Hôm nay</div>
      <div class="stats"><div><div class="big">${due}</div><span>thẻ cần ôn</span></div><div><div class="big">${nw}</div><span>từ mới</span></div><div><div class="big">${st}</div><span>ngày liên tiếp</span></div></div>
      <button class="btn" id="hStart">${due+nw?'Bắt đầu ôn '+(due+Math.min(nw,P.settings.newPerDay))+' thẻ':'Học thêm từ mới'}</button>
      <div class="small" style="opacity:.85">Đã ôn ${todayN} lượt hôm nay. Đang học HSK ${lv.join(', ')}.</div>
    </div>
    <div class="panel">${wd?`<span class="label">Từ của ngày</span><div class="wotd"><span class="em">${wd.em}</span><div><div class="h han">${hanHTML(wd)}</div><div class="py">${pyHTML(wd)} <span class="muted small">${esc(wd.hv)}</span></div><div>${esc(wd.vi)}</div></div><button class="spk" data-say="${esc(wd.h)}" aria-label="Nghe">${SPK}</button></div><div class="small muted han">${esc(wd.ex)}</div><button class="btn sm" id="hWd" style="align-self:flex-start">Xem chi tiết</button>`:'<span class="note">Đang tải từ vựng...</span>'}</div>
   </div>
   <div class="grid2">
    <div class="panel"><div class="spread"><h3>Tiến độ theo cấp</h3><span class="note">thuộc = ôn đạt khoảng cách >= 7 ngày</span></div>
      ${[1,2,3,4,5,6].map(L=>{const ws=W.filter(w=>w.lv===L);const k=ws.filter(w=>known(w.h)).length;const s=ws.filter(w=>seen(w.h)).length;const tot=ws.length||LV_COUNT[L]||1;
        return `<div class="lvrow"><b>HSK ${L}</b><span class="bar-track"><i style="width:${k/tot*100}%"></i></span><span class="num muted">${k}/${tot}${s>k?' <span class="small">(+'+(s-k)+')</span>':''}</span></div>`;}).join('')}
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
     <button class="panel" style="text-align:left" data-go="talk"><h3>Luyện hội thoại</h3><span class="note">Nói chuyện với Claude theo tình huống, được sửa lỗi bằng tiếng Việt.</span></button>
     <button class="panel" style="text-align:left" data-go="write"><h3>Luyện viết chữ</h3><span class="note">Xem thứ tự nét và tự viết lại bằng tay hoặc chuột.</span></button>
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
  const lv=P.settings.lv; const due=dueList(lv); const nw=newList(lv,Math.max(0,P.settings.newPerDay-newToday()));
  queue=[...due,...nw]; sessDone=0;
}
function renderStudy(el){
  if(!queue.length||!queue.every(w=>P.settings.lv.includes(w.lv)))buildQueue();
  el.innerHTML=`<div class="view"><div class="spread"><h2>Ôn từ vựng</h2>
     <div class="row"><span class="label">Mặt trước</span>${[['hz','Chữ Hán'],['vi','Nghĩa'],['au','Nghe']].map(([m,t])=>`<button class="chip" data-m="${m}" aria-pressed="${P.settings.mode===m}">${t}</button>`).join('')}</div></div>
     ${levelChips(P.settings.lv,s=>{P.settings.lv=s;touch('main');buildQueue();renderStudy(el);},{id:'slv'})}
     <div class="study"><div id="cardBox"></div>
     <aside class="panel"><h3>Phiên này</h3><div id="sessInfo" class="small"></div>
      <p class="note">Chấm điểm sau khi lật: Quên thì gặp lại sau 1 phút, các mức còn lại đẩy lần ôn tiếp theo ra xa dần. Phím tắt: Space lật thẻ, 1 2 3 4 chấm điểm.</p>
      <button class="btn sm" id="addNew">Thêm 10 từ mới</button></aside></div></div>`;
  $$('[data-m]',el).forEach(b=>b.onclick=()=>{P.settings.mode=b.dataset.m;touch('main');$$('[data-m]',el).forEach(x=>x.setAttribute('aria-pressed',x.dataset.m===P.settings.mode));nextCard(true);});
  $('#addNew').onclick=()=>{const extra=newList(P.settings.lv,200).filter(w=>!queue.includes(w)).slice(0,10);queue.push(...extra);if(!qcur)nextCard();info();toast('Đã thêm '+extra.length+' từ mới vào phiên.');};
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
     ${w.cl&&w.cl.length?`<div class="small muted">Lượng từ: <span class="han">${esc(w.cl.join(', '))}</span></div>`:''}
     <div class="ex"><button class="spk" data-say="${esc(w.ex)}" aria-label="Nghe câu">${SPK}</button><div><div class="zh han">${colorText(w.ex)}</div><div class="pyl py">${sentPyHTML(w.exp)}</div><div class="vil">${esc(w.exvi)}</div></div></div>`;
  box.innerHTML=`<div class="card"><div class="corner"><span class="pill">HSK ${w.lv}</span>${isNew?'<span class="pill ai">Mới</span>':''}</div>
    <div class="corner-r"><button class="spk" data-say="${esc(w.h)}" aria-label="Nghe">${SPK}</button><button class="spk" id="cInfo" aria-label="Chi tiết" title="Chi tiết">i</button></div>
    ${revealed?back:front}
    ${revealed?'':'<button class="btn primary" id="cFlip" style="margin-top:auto">Lật thẻ <span class="kbd">Space</span></button>'}
  </div>
  ${revealed?`<div class="rate" style="margin-top:10px">${['Quên','Khó','Nhớ','Dễ'].map((t,i)=>`<button class="btn r${i}" data-r="${i}">${t}<small>${ivLabel(w.h,i)}</small></button>`).join('')}</div>`:''}`;
  if(m==='au'&&!revealed)say(w.h);
  const f=$('#cFlip');if(f)f.onclick=flip;
  $('#cInfo').onclick=()=>openWord(w.h);
  $$('[data-r]',box).forEach(b=>b.onclick=()=>rate(+b.dataset.r));
}
function flip(){if(!qcur||revealed)return;revealed=true;drawCard();say(qcur.h);}
function rate(r){
  if(!qcur||!revealed)return; const w=qcur;
  const c=schedule(w.h,r); if(!c.first){c.first=Date.now();}
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
let dq='',dlv=[1,2,3,4,5,6],dshow=80,dfilter='all';
function renderDict(el){
  el.innerHTML=`<div class="view"><div class="spread"><h2>Từ điển HSK</h2><span class="note num" id="dCount"></span></div>
   <div class="dict-tools"><input type="search" id="dq" placeholder="Tìm chữ Hán, pinyin (không dấu cũng được), Hán Việt hoặc nghĩa tiếng Việt" value="${esc(dq)}">
    <select id="df"><option value="all">Tất cả</option><option value="new">Chưa học</option><option value="seen">Đang học</option><option value="known">Đã thuộc</option><option value="em">Có hình minh họa</option></select></div>
   ${levelChips(dlv,s=>{dlv=s;dshow=80;draw();},{id:'dlv'})}
   <div class="wlist" id="dl"></div><button class="btn" id="dMore" hidden>Xem thêm</button>
   <div class="panel"><h3>Thêm từ của riêng bạn</h3><p class="note">Từ ngoài danh sách HSK (tên món ăn, thuật ngữ công việc...). Pinyin tự điền.${AI?' Claude điền giúp nghĩa và câu ví dụ.':''}</p>
    <div class="row"><input type="text" id="cw" placeholder="Chữ Hán, ví dụ 区块链" style="flex:1 1 160px"><input type="text" id="cv" placeholder="Nghĩa tiếng Việt" style="flex:2 1 200px"><button class="btn sm" id="cAdd">Thêm</button></div>
    <div id="cList" class="row"></div></div></div>`;
  $('#df').value=dfilter;
  const draw=()=>{
    const q=dq.trim(); const qf=viFold(q); const qs=stripTone(q).replace(/\s+/g,'');
    let list=W.filter(w=>dlv.includes(w.lv));
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
    if(AI&&!vi){$('#cAdd').disabled=true;$('#cAdd').textContent='Claude đang điền...';
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
  const bg=document.createElement('div');bg.className='modal-bg';bg.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><button class="spk x" aria-label="Đóng">✕</button>${html}</div>`;
  document.body.appendChild(bg);const close=()=>{bg.remove();stopSay();document.removeEventListener('keydown',onk);};
  const onk=e=>{if(e.key==='Escape')close();};document.addEventListener('keydown',onk);
  bg.addEventListener('click',e=>{if(e.target===bg)close();});$('.x',bg).onclick=close;return {el:$('.modal',bg),close};
}
function openWord(h){
  const w=WI.get(h);if(!w)return; const c=P.srs[h];
  const m=modal(`<div class="wd-head">${w.em?`<span class="em">${w.em}</span>`:''}<div><div class="h han">${hanHTML(w)}</div></div>
     <div style="display:flex;flex-direction:column;gap:2px"><div class="py" style="font-size:22px">${pyHTML(w)}</div><div class="muted" style="text-transform:uppercase;letter-spacing:.08em;font-size:13px">Hán Việt: ${esc(w.hv)}</div><div class="row"><span class="pill">HSK ${w.lv}</span>${c?`<span class="pill ai">${known(h)?'Đã thuộc':'Đang học'} - ôn lại sau ${Math.max(0,Math.round((c.due-Date.now())/DAY))} ngày</span>`:''}</div></div>
     <button class="spk" data-say="${esc(w.h)}" aria-label="Nghe" style="margin-left:auto">${SPK}</button></div>
   <div style="font-size:19px;font-weight:600">${esc(w.vi)}</div>
   ${w.cl.length?`<div class="small muted">Lượng từ đi kèm: <span class="han" style="font-size:16px">${esc(w.cl.join(', '))}</span></div>`:''}
   <div class="ex" style="display:grid;grid-template-columns:34px minmax(0,1fr);gap:10px"><button class="spk" data-say="${esc(w.ex)}" aria-label="Nghe câu">${SPK}</button><div><div class="han" style="font-size:20px">${colorText(w.ex)}</div><div class="py small">${sentPyHTML(w.exp)}</div><div class="muted small">${esc(w.exvi)}</div></div></div>
   <div><span class="label">Thứ tự nét</span><div class="strokes" id="wdStrokes"></div></div>
   <div class="row">${c?'':'<button class="btn sm" id="wdLearn">Thêm vào ôn tập</button>'}<button class="btn sm" id="wdWrite">Luyện viết</button>
     <button class="btn sm need-ai" id="wdIll">Vẽ minh họa</button><button class="btn sm need-ai" id="wdMore">Claude giải thích thêm</button></div>
   <div id="wdIllOut"></div><div id="wdAiOut"></div>
   <p class="note no-ai">Phần vẽ minh họa và giải thích thêm chạy khi mở trang trong Claude.</p>`);
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
    const b=e.currentTarget;b.disabled=true;const out=$('#wdAiOut',m.el);out.innerHTML='<div class="ai-out">Claude đang viết...</div>';
    try{await ask(`Bạn là giáo viên tiếng Trung cho người Việt, trình độ học viên đang học HSK ${w.lv}. Giải thích từ ${w.h} (${w.p.join(' ')}, Hán Việt: ${w.hv}, nghĩa: ${w.vi}) bằng tiếng Việt tự nhiên, ngắn gọn:
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
function renderWrite(el){
  const pool=()=>{const lv=P.settings.lv;const learning=W.filter(w=>lv.includes(w.lv)&&seen(w.h));return learning.length?learning:W.filter(w=>lv.includes(w.lv)).slice(0,60);};
  let w=writeTarget?WI.get(writeTarget):pick(pool()); writeTarget=null;
  let chars=[...w.h], ci=0, writer=null, mistakes=0, mode='quiz';
  el.innerHTML=`<div class="view"><div class="spread"><h2>Luyện viết chữ</h2><div class="row"><input type="search" id="wq" placeholder="Nhập từ để luyện" style="width:180px"><button class="btn sm" id="wGo">Luyện</button><button class="btn sm" id="wRand">Từ khác</button></div></div>
   <div class="write-wrap"><div><div class="wpad" id="wpad"><svg class="grid" viewBox="0 0 100 100" preserveAspectRatio="none"><g stroke="var(--line)" stroke-width=".4" stroke-dasharray="2 2"><line x1="0" y1="0" x2="100" y2="100"/><line x1="100" y1="0" x2="0" y2="100"/><line x1="50" y1="0" x2="50" y2="100"/><line x1="0" y1="50" x2="100" y2="50"/></g></svg><div class="hw" id="hw"></div></div></div>
   <div class="panel" id="wInfo"></div></div></div>`;
  const size=Math.min(320,Math.floor(window.innerWidth*.86));
  async function load(){
    const ch=chars[ci]; mistakes=0;
    writer=await makeWriter($('#hw'),ch,{size,quiz:mode==='quiz',outline:mode!=='blind'});
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
    $('#gl').innerHTML=list.map(g=>`<details class="g" data-id="${g.id}"><summary><span class="check ${P.gram[g.id]?'on':''}">${P.gram[g.id]?'✓':''}</span><span class="pill">HSK ${g.lv}</span><span class="t">${esc(g.t)}</span><span class="small muted">${esc(g.cat)}</span></summary><div class="body"></div></details>`).join('')||'<div class="empty">Không có điểm ngữ pháp nào khớp.</div>';
    $$('#gl details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open&&!d.dataset.r){d.dataset.r=1;fill(d);}}));
  }
  function fill(d){
    const g=GRAM.find(x=>x.id===d.dataset.id);const b=$('.body',d);
    b.innerHTML=`<div class="formula han">${esc(g.f)}</div><p style="margin:0;max-width:70ch">${esc(g.d)}</p>
      ${g.ex.map(e=>`<div class="ex" style="display:grid;grid-template-columns:34px minmax(0,1fr);gap:10px"><button class="spk" data-say="${esc(e[0])}" aria-label="Nghe câu">${SPK}</button><div><div class="han" style="font-size:19px">${colorText(e[0])}</div><div class="py small">${sentPyHTML(e[1])}</div><div class="muted small">${esc(e[2])}</div></div></div>`).join('')}
      ${g.vn?`<div class="vn">${esc(g.vn)}</div>`:''}
      ${g.q?`<div class="gq"><span class="label">Luyện tập</span><div class="han" style="font-size:18px">${colorText(g.q.s)}</div><div class="opts">${g.q.o.map((o,i)=>`<button class="opt han" data-i="${i}">${esc(o)}</button>`).join('')}</div><div class="small gw" hidden></div></div>`:''}
      <div class="row"><button class="btn sm gdone">${P.gram[g.id]?'Bỏ đánh dấu':'Đánh dấu đã nắm'}</button><button class="btn sm need-ai gask">Hỏi Claude thêm ví dụ</button></div><div class="gai"></div>`;
    refreshAIBits();
    $$('.opt',b).forEach(o=>o.onclick=()=>{$$('.opt',b).forEach((x,i)=>{x.disabled=true;if(i===g.q.a)x.classList.add('right');});if(+o.dataset.i!==g.q.a)o.classList.add('wrong');const w=$('.gw',b);w.hidden=false;w.textContent=g.q.w;});
    $('.gdone',b).onclick=()=>{P.gram[g.id]=P.gram[g.id]?0:1;if(!P.gram[g.id])delete P.gram[g.id];touch('main');const c=$('.check',d);c.classList.toggle('on',!!P.gram[g.id]);c.textContent=P.gram[g.id]?'✓':'';$('.gdone',b).textContent=P.gram[g.id]?'Bỏ đánh dấu':'Đánh dấu đã nắm';};
    $('.gask',b).onclick=async e=>{const out=$('.gai',b);e.currentTarget.disabled=true;
      try{await ask(`Bạn là giáo viên tiếng Trung cho người Việt. Điểm ngữ pháp HSK ${g.lv}: ${g.t}. Công thức: ${g.f}. Hãy đưa 5 câu ví dụ mới, tự nhiên, đúng trình độ, mỗi câu 3 dòng: chữ Hán / pinyin có dấu / nghĩa tiếng Việt. Sau đó thêm 2 lỗi người Việt hay mắc với mẫu này (ghi Sai: ... Đúng: ...). Văn bản thuần, không markdown, không gạch ngang dài.`,{onText:({text})=>{out.innerHTML=`<div class="ai-out han">${esc(text)}</div>`;}});}
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
     return `<div class="panel tcard"><span class="label">HSK ${tlv}</span><h3>${esc(t.title)}</h3><span class="note">${n} câu, ${t.minutes} phút. ${t.sections.map(s=>esc(s.title)).join(', ')}.</span>${best>=0?`<span class="small">Điểm cao nhất: <b>${best}%</b></span>`:''}<button class="btn primary sm" data-t="${t.id}" style="align-self:flex-start">Làm bài</button></div>`;}).join('')}
     <div class="panel tcard need-ai"><span class="label">Claude soạn</span><h3>Đề mới không trùng</h3><span class="note">Mỗi lần bấm là một đề rút gọn mới theo đúng cấp độ, khoảng 15 câu.</span><button class="btn sm" id="tAi" style="align-self:flex-start">Soạn đề mới</button></div>
     <div class="panel tcard no-ai"><span class="label">Claude soạn</span><h3>Đề mới không trùng</h3><span class="note">Mở trang trong Claude để Claude soạn đề mới mỗi lần.</span></div>
   </div>
   <div class="panel"><h3>Lịch sử làm bài HSK ${tlv}</h3>${hist.length?hist.map(h=>`<div class="spread small"><span>${esc(h.title)}</span><span class="num">${new Date(h.date).toLocaleDateString('vi-VN')} - <b>${h.pct}%</b> ${h.pct>=60?'<span class="pill ai">Đạt</span>':'<span class="pill">Chưa đạt</span>'}</span></div>`).join(''):'<p class="note">Chưa làm đề nào ở cấp này.</p>'}
   <p class="note">Mức đạt tham khảo: 60% tổng điểm. Phần nghe dùng giọng đọc của trình duyệt, mỗi bài được nghe tối đa 2 lần như khi thi thật.</p></div></div>`;
  refreshAIBits();
  $$('[data-t]',el).forEach(b=>b.onclick=()=>runTest(T.tests.find(t=>t.id===b.dataset.t),tlv));
  const ai=$('#tAi');if(ai)ai.onclick=async()=>{ai.disabled=true;ai.textContent='Claude đang soạn đề (khoảng 1 phút)...';
    try{const words=W.filter(w=>w.lv<=tlv);const sample=shuffle(words.filter(w=>w.lv===tlv)).slice(0,60).map(w=>w.h).join('、');
      const t=await askJSON(`Soạn một đề thi thử HSK cấp ${tlv} (chuẩn HSK mới 2026) rút gọn, nội dung hoàn toàn mới, dành cho người Việt.
Dùng từ vựng trong phạm vi HSK ${tlv}, ưu tiên các từ sau: ${sample}.
Trả về DUY NHẤT một JSON object theo đúng cấu trúc:
{"id":"ai","title":"Đề Claude soạn - HSK ${tlv}","minutes":15,"sections":[
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
    const audioBtn=it.audio?`<div class="play"><button class="btn sm" data-play="${i}" ${!show&&x.plays>=2?'disabled':''}>▶ Nghe${show?'':' ('+(2-x.plays)+' lần)'}</button>${show?`<div class="audio-lines han">${it.audio.map(([sp,l])=>`<div>${sp&&sp!=='问'?esc(sp)+'：':''}${esc(l)}</div>`).join('')}</div>`:''}</div>`:'';
    const options=(o,cls='')=>`<div class="opts">${o.map((op,k)=>`<button class="opt ${cls} ${show&&k===it.a?'right':''} ${show&&x.ans===k&&k!==it.a?'wrong':''}" data-k="${k}" aria-pressed="${x.ans===k}" ${show?'disabled':''}><span class="zh">${String.fromCharCode(65+k)}. ${zh(op)}</span></button>`).join('')}</div>`;
    if(it.k==='lc'){body=audioBtn+(it.q?`<div class="stmt">${zh(it.q)}</div>`:'')+options(it.o);}
    else if(it.k==='tf'){body=(it.audio?audioBtn:`<div class="text">${zh(it.text||'')}</div>`)+`<div class="stmt">★ ${zh(it.s)}</div><div class="opts">${[true,false].map(v=>`<button class="opt ${show&&v===it.a?'right':''} ${show&&x.ans===v&&v!==it.a?'wrong':''}" data-tf="${v}" aria-pressed="${x.ans===v}" ${show?'disabled':''}>${v?'Đúng (✓)':'Sai (✗)'}</button>`).join('')}</div>`;}
    else if(it.k==='rc'){body=`<div class="text">${zh(it.text||'')}</div>${it.q?`<div class="stmt">${zh(it.q)}</div>`:''}`+options(it.o);}
    else if(it.k==='fill'||it.k==='match'){body=`<div class="text">${zh(it.s)}</div>`+options(it.o);}
    else if(it.k==='order'){const used=x.ans||[];body=`<div class="built" id="b${i}">${used.map(k=>`<button class="piece" data-un="${k}" ${show?'disabled':''}>${esc(it.pieces[k])}</button>`).join('')||'<span class="note">Bấm các mảnh bên dưới theo thứ tự</span>'}</div><div class="pieces">${it.pieces.map((p,k)=>`<button class="piece ${used.includes(k)?'used':''}" data-pc="${k}" ${show||used.includes(k)?'disabled':''}>${esc(p)}</button>`).join('')}</div>${show?`<div class="small">Đáp án: <span class="han" style="font-size:17px">${esc(it.a)}</span></div>`:''}`;}
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
    items.forEach((x,i)=>drawItem(i));
    $('#tBack').onclick=()=>renderTest(el); window.scrollTo(0,0);
    items.forEach((x,i)=>{if(x.it.k==='essay'&&AI&&x.ans&&x.ans.trim())gradeEssay(x,i);});
  }
  async function gradeEssay(x,i){
    const out=$('#eg'+i);if(!out)return;out.innerHTML='<div class="ai-out">Claude đang chấm bài viết...</div>';
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
 {id:'free',e:'💬',t:'Nói chuyện tự do',d:'Chủ đề gì cũng được, Claude theo bạn.',lv:1},
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
let chat={scen:SCEN[0],lv:null,msgs:[],busy:false,showVi:false};
function renderTalk(el){
  if(!chat.lv)chat.lv=Math.max(...P.settings.lv);
  el.innerHTML=`<div class="view"><div class="spread"><h2>Luyện hội thoại</h2>${levelChips([chat.lv],s=>{chat.lv=s[0];renderTalk(el);},{multi:false,id:'clv'})}</div>
   <div class="no-ai empty">Phần hội thoại cần Claude. Mở trang này trong Claude (bản artifact) để luyện nói chuyện, được sửa lỗi và gợi ý câu trả lời. Bản web này vẫn dùng được thẻ từ, từ điển, viết chữ, ngữ pháp và thi thử.</div>
   <div class="chat need-ai"><div class="scen">${SCEN.map(s=>`<button data-s="${s.id}" aria-pressed="${chat.scen.id===s.id}"><span class="e">${s.e}</span><span><b>${esc(s.t)}</b><br><span class="small muted">${esc(s.d)}</span></span></button>`).join('')}</div>
    <div class="convo"><div class="spread" style="padding:10px 14px;border-bottom:1px solid var(--line)"><b>${chat.scen.e} ${esc(chat.scen.t)}</b><div class="row"><button class="icon-btn" id="cVi" aria-pressed="${chat.showVi}">Hiện nghĩa</button><button class="icon-btn" id="cReset">Bắt đầu lại</button></div></div>
     <div class="msgs" id="msgs"></div>
     <div class="composer"><div class="hints" id="hints"></div><div class="row"><textarea id="cin" rows="2" class="han" placeholder="Gõ tiếng Trung (chữ Hán hoặc pinyin). Bí quá thì gõ tiếng Việt, Claude sẽ chỉ cách nói."></textarea><button class="btn" id="cMic" hidden title="Nói">🎤</button><button class="btn primary" id="cSend">Gửi</button></div></div></div></div></div>`;
  refreshAIBits();
  $$('[data-s]',el).forEach(b=>b.onclick=()=>{chat.scen=SCEN.find(s=>s.id===b.dataset.s);chat.msgs=[];renderTalk(el);});
  $('#cVi').onclick=()=>{chat.showVi=!chat.showVi;renderTalk(el);};
  $('#cReset').onclick=()=>{chat.msgs=[];renderTalk(el);};
  $('#cSend').onclick=send; $('#cin').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
  setupMic();
  drawMsgs();
  if(AI&&!chat.msgs.length)turn(null);
}
function drawMsgs(){
  const box=$('#msgs');if(!box)return;
  box.innerHTML=chat.msgs.map((m,i)=>m.role==='user'?`<div class="msg me"><div class="bubble"><div class="zh han">${esc(m.text)}</div></div>${m.fix?`<div class="fix"><b>Sửa:</b> <span class="han">${esc(m.fix.better)}</span><br>${esc(m.fix.note)}</div>`:''}</div>`
    :`<div class="msg"><div class="bubble"><div class="zh">${P.settings.py?rubyHTML(m.zh):colorText(m.zh)}</div>${chat.showVi||m.open?`<div class="vi">${esc(m.vi)}</div>`:''}</div><div class="row" style="gap:4px"><button class="spk" data-say="${esc(m.zh)}" aria-label="Nghe">${SPK}</button>${chat.showVi?'':`<button class="btn ghost sm" data-open="${i}">Nghĩa</button>`}</div></div>`).join('')+(chat.busy?'<div class="typing">Claude đang trả lời...</div>':'');
  $$('[data-open]',box).forEach(b=>b.onclick=()=>{chat.msgs[+b.dataset.open].open=true;drawMsgs();});
  box.scrollTop=box.scrollHeight;
  const last=[...chat.msgs].reverse().find(m=>m.role==='ai');
  $('#hints').innerHTML=last&&last.hints?last.hints.map(h=>`<button data-h="${esc(h)}">${esc(h)}</button>`).join(''):'';
  $$('#hints [data-h]').forEach(b=>b.onclick=()=>{$('#cin').value=b.dataset.h;$('#cin').focus();});
}
function send(){const v=$('#cin').value.trim();if(!v||chat.busy)return;$('#cin').value='';chat.msgs.push({role:'user',text:v});turn(v);}
async function turn(userText){
  chat.busy=true;drawMsgs();
  const lv=chat.lv; const s=chat.scen;
  const history=chat.msgs.slice(-14).map(m=>m.role==='user'?'Học viên: '+m.text:'Bạn: '+m.zh).join('\n');
  const prompt=`Bạn là bạn luyện nói tiếng Trung cho một người Việt đang học HSK ${lv}. Tình huống: ${s.t} (${s.d}). Bạn đóng vai người bản xứ phù hợp tình huống (nhân viên, bác sĩ, nhà tuyển dụng, đối tác...), nói tự nhiên, câu ngắn, chỉ dùng từ vựng và ngữ pháp trong phạm vi HSK ${lv}${lv<=2?', câu rất ngắn và đơn giản':''}. Mỗi lượt chỉ nói 1-3 câu và luôn kết thúc bằng một câu hỏi hoặc gợi mở để học viên trả lời.
${userText===null?'Hãy mở đầu cuộc hội thoại.':'Hội thoại đến giờ:\n'+history}
${userText!==null?`Câu mới nhất của học viên: "${userText}". Nếu câu đó có lỗi (ngữ pháp, từ dùng sai, trật tự từ, hoặc học viên viết tiếng Việt/pinyin), điền "fix" để chỉ cách nói đúng; nếu câu đã đúng và tự nhiên thì "fix" là null.`:''}
Trả về DUY NHẤT JSON: {"zh":"lời bạn nói, chữ Hán giản thể","vi":"dịch tiếng Việt","fix":${userText===null?'null':'{"better":"câu đúng bằng chữ Hán","note":"giải thích ngắn bằng tiếng Việt"} hoặc null'},"hints":["3 câu trả lời mẫu ngắn bằng chữ Hán mà học viên có thể nói tiếp"]}`;
  try{
    const r=await askJSON(prompt,{cache:false,modelTier:'default'});
    if(userText!==null&&r.fix&&r.fix.better){const u=[...chat.msgs].reverse().find(m=>m.role==='user');if(u)u.fix=r.fix;}
    chat.msgs.push({role:'ai',zh:String(r.zh||''),vi:String(r.vi||''),hints:Array.isArray(r.hints)?r.hints.slice(0,3):[]});
    chat.busy=false;drawMsgs();say(String(r.zh||''));
  }catch(e){chat.busy=false;drawMsgs();toast(aiError(e));}
}
function setupMic(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;const b=$('#cMic');if(!SR||!b)return;
  b.hidden=false;let rec=null;
  b.onclick=()=>{
    if(rec){rec.stop();return;}
    try{rec=new SR();rec.lang='zh-CN';rec.interimResults=true;
      rec.onresult=e=>{$('#cin').value=[...e.results].map(r=>r[0].transcript).join('');};
      rec.onerror=ev=>{if(ev.error==='not-allowed'||ev.error==='service-not-allowed'){b.hidden=true;toast('Trình duyệt không cho dùng micro ở đây. Hãy gõ chữ.');}};
      rec.onend=()=>{rec=null;b.textContent='🎤';};
      rec.start();b.textContent='⏹';
    }catch(e){b.hidden=true;}
  };
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
function renderTones(el){
  el.innerHTML=`<div class="view"><h2>Thanh điệu</h2><div class="tones">${TONES.map(t=>`<button class="tone" data-say="${t.ch}"><span class="tn t${t.n}">${t.name}</span>${contour(t)}<span class="row"><span class="han t${t.n}" style="font-size:30px;font-weight:700">${t.ch}</span><span class="py t${t.n}" style="font-size:18px">${t.py}</span></span><span class="small muted"><b style="color:var(--ink)">${t.vi}</b>. ${t.d}</span></button>`).join('')}</div>
   <p class="note">Thang 5 mức của Triệu Nguyên Nhậm: thanh 1 = 55, thanh 2 = 35, thanh 3 = 214, thanh 4 = 51.</p>
   <div class="grid2"><div class="panel"><h3>Biến điệu cần nhớ</h3>${RULES.map(r=>`<div><b>${r[0]}</b><div class="note">${r[1]}</div><div><span class="han" style="font-size:18px">${r[2]}</span> <span class="py">${r[3]}</span> <button class="btn ghost sm" data-say="${r[2]}">▶</button></div></div>`).join('')}</div>
   <div class="panel" id="drill" style="align-items:center;text-align:center"></div></div></div>`;
  drawDrill();
}
function drawDrill(){
  const c=drill.cur,b=$('#drill');if(!b)return;
  b.innerHTML=`<h3>Luyện nghe thanh điệu</h3><p class="note">Nghe một âm tiết rồi đoán thanh.</p><button class="btn primary" id="dPlay">${c?'Nghe lại':'Bắt đầu'}</button>
   <div style="min-height:64px">${drill.done?`<div class="han t${c[2]}" style="font-size:40px;font-weight:700;line-height:1.1">${c[0]}</div><div class="py t${c[2]}">${c[1]}</div>`:''}</div>
   <div class="tonebtns" style="width:100%">${[1,2,3,4].map(n=>`<button class="btn" data-t="${n}" ${!c||drill.done?'disabled':''} style="${drill.done&&n===c[2]?'border-color:var(--ok)':''}"><span class="t${n}">${['ā','á','ǎ','à'][n-1]}</span></button>`).join('')}</div>
   <div class="row"><span class="small muted num">${drill.right}/${drill.total} đúng</span>${drill.done?'<button class="btn sm" id="dNext">Âm tiếp</button>':''}</div>`;
  $('#dPlay').onclick=()=>{if(!c){drill.cur=pick(DRILL);drawDrill();}say(drill.cur[0]);};
  $$('#drill [data-t]').forEach(x=>x.onclick=()=>{drill.done=true;drill.total++;if(+x.dataset.t===c[2])drill.right++;else toast('Chưa đúng, đây là thanh '+c[2]);drawDrill();});
  const n=$('#dNext');if(n)n.onclick=()=>{drill.cur=pick(DRILL);drill.done=false;drawDrill();say(drill.cur[0]);};
}

/* ================= boot ================= */
async function boot(){
  $('#tgPy').onclick=()=>{P.settings.py=!P.settings.py;touch('main');applySettings();route();};
  $('#tgColor').onclick=()=>{P.settings.color=!P.settings.color;touch('main');applySettings();};
  $$('nav.tabs button').forEach(b=>b.onclick=()=>go(b.dataset.v));
  applySettings();
  const h=(location.hash||'').slice(1); if(VIEWS[h])current=h;
  $('#view').innerHTML='<div class="view"><p class="note">Đang tải từ vựng...</p></div>';
  await loadLevel(Math.min(...P.settings.lv));
  route();
  initPlatform();
  await loadAllWords();
  if(['home','dict','study'].includes(current)&&!$('.modal-bg'))route(true);
}
boot().catch(e=>{console.error(e);$('#view').innerHTML='<div class="empty">Không tải được dữ liệu. Tải lại trang thử xem.</div>';});
})();
