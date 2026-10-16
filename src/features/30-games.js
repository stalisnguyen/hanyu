/* ================= GAMES ================= */
/* Four quick games on the words of the chosen HSK levels. Best scores live in P.games.best[id]. */
const GM_GAMES=[
  {id:'speed',name:'Tốc độ 60 giây',icon:'速',keys:'Phím 1-4',desc:'Nhìn chữ Hán, chọn nghĩa đúng trong 4 đáp án. Đúng liên tiếp thì điểm được nhân lên.'},
  {id:'match',name:'Ghép cặp',icon:'配',keys:'Chạm hoặc bấm chuột',desc:'Ghép 6 chữ Hán với 6 nghĩa tiếng Việt, 3 vòng. Càng nhanh càng nhiều điểm.'},
  {id:'fall',name:'Chữ rơi',icon:'落',keys:'Gõ pinyin, Enter',desc:'Gõ pinyin không dấu để phá chữ trước khi chạm đáy. Có chế độ chọn nghĩa.'},
  {id:'tone',name:'Bắn thanh điệu',icon:'声',keys:'Phím 1-4, R nghe lại',desc:'Nghe một âm tiết giọng người thật, đoán thanh 1-4 trước khi hết giờ.'},
];
const GM={lv:null,key:null,timers:[],raf:0,active:false,fallMode:'py'};
const GM_TONE_MARK=['ā','á','ǎ','à'];

function gmData(){P.games=P.games||{};P.games.best=P.games.best||{};P.games.plays=P.games.plays||{};return P.games;}
function gmPool(){return W.filter(w=>GM.lv.includes(w.lv)&&w.h&&w.vi);}
function gmShort(vi){const s=String(vi).split(';')[0].trim();if(s.length<=44)return s;const c=s.slice(0,42),sp=c.lastIndexOf(' ');return (sp>24?c.slice(0,sp):c).replace(/[\s,:(]+$/,'')+'...';}
function gmReduce(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}}
function gmAlive(){const s=document.getElementById('gmStage');return !!(s&&s.isConnected);}
function gmClear(){GM.timers.forEach(t=>clearTimeout(t));GM.timers=[];cancelAnimationFrame(GM.raf);GM.raf=0;GM.key=null;GM.active=false;}
function gmLater(fn,ms){const t=setTimeout(()=>{if(gmAlive())fn();},ms);GM.timers.push(t);return t;}
function gmEvery(fn,ms){const t=setInterval(()=>{if(!gmAlive()){gmClear();return;}fn();},ms);GM.timers.push(t);return t;}
function gmRace(p,ms){return Promise.race([p,new Promise(r=>setTimeout(()=>r(true),ms))]);}
function gmClock(s){s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}

/* three wrong options with different short meanings, preferring the same word length */
function gmOptions(w,pool){
  const mine=gmShort(w.vi),len=[...w.h].length,seen=new Set([mine]),out=[];
  const cand=shuffle(pool).slice(0,60).sort((a,b)=>Math.abs([...a.h].length-len)-Math.abs([...b.h].length-len));
  for(const x of cand){if(out.length>=3)break;const s=gmShort(x.vi);if(x.h===w.h||seen.has(s))continue;seen.add(s);out.push(x);}
  return shuffle([w,...out]);
}

/* short synth sounds, no files needed */
let GM_AC=null;
function gmSfx(kind){
  if(gmData().mute)return;
  try{
    GM_AC=GM_AC||new (window.AudioContext||window.webkitAudioContext)();const ac=GM_AC;if(ac.state==='suspended')ac.resume();
    const seq={ok:[[660,.07],[990,.1]],combo:[[660,.06],[880,.06],[1320,.14]],bad:[[196,.2]],tick:[[1400,.03]],pop:[[520,.05],[820,.08]],end:[[523,.1],[659,.1],[784,.22]]}[kind]||[];
    let t=ac.currentTime;
    seq.forEach(([f,d])=>{const o=ac.createOscillator(),g=ac.createGain();o.type=kind==='bad'?'sawtooth':'triangle';o.frequency.value=f;
      g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(kind==='bad'?0.07:0.12,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
      o.connect(g).connect(ac.destination);o.start(t);o.stop(t+d+0.03);t+=d*0.85;});
  }catch(e){}
}
function gmFloat(host,text,cls,x,y){
  if(!host)return;const f=document.createElement('div');f.className='gm-float '+(cls||'');f.textContent=text;
  if(x!=null){f.style.left=x+'px';f.style.top=y+'px';}
  host.appendChild(f);
  if(x!=null)f.style.left=Math.max(4,Math.min(x,host.clientWidth-f.offsetWidth-4))+'px';
  setTimeout(()=>f.remove(),gmReduce()?500:900);
}
document.addEventListener('keydown',e=>{if(!GM.key||!gmAlive()||$('.modal-bg')||e.metaKey||e.ctrlKey||e.altKey)return;GM.key(e);});

/* ---------- menu ---------- */
async function renderGames(el){
  if(GM.active&&gmAlive())return; // keep a running game when the app re-renders softly
  gmClear();
  if(!GM.lv)GM.lv=P.settings.lv.slice();
  if(GM.lv.some(L=>!loadedLv.has(L))){el.innerHTML='<div class="view"><p class="note">Đang tải từ vựng...</p></div>';await Promise.all(GM.lv.map(loadLevel));if(current!=='games')return;}
  const g=gmData(),n=gmPool().length;
  el.innerHTML=`<div class="view"><div class="spread"><h2>Trò chơi</h2>${levelChips(GM.lv,s=>{GM.lv=s;renderGames(el);},{id:'gmlv'})}</div>
   <p class="note">Đang dùng ${n} từ của HSK ${GM.lv.join(', ')}. Chọn thêm cấp ở trên để trộn từ.</p>
   <div class="gm-cards">${GM_GAMES.map(x=>`<button class="gm-card" data-g="${x.id}"><span class="gm-ic han">${x.icon}</span><span class="gm-ct"><b>${x.name}</b><span class="note">${x.desc}</span><span class="kbd">${x.keys}</span></span></button>`).join('')}</div>
   <div class="panel"><div class="spread"><h3>Bảng kỷ lục</h3><button class="btn ghost sm" id="gmMute" aria-pressed="${!g.mute}">Âm hiệu: ${g.mute?'tắt':'bật'}</button></div>
    <div class="gm-board">${GM_GAMES.map(x=>`<div class="gm-brow"><span class="gm-bic han">${x.icon}</span><span class="gm-bname">${x.name}<span class="small muted">${g.plays[x.id]?g.plays[x.id]+' lượt chơi':'Chưa chơi'}</span></span><b class="num">${g.best[x.id]||0}</b></div>`).join('')}</div></div></div>`;
  $$('.gm-card',el).forEach(b=>b.onclick=()=>gmOpen(b.dataset.g));
  $('#gmMute').onclick=()=>{g.mute=!g.mute;touch('main');renderGames(el);};
}
function gmOpen(id){
  const game=GM_GAMES.find(x=>x.id===id);
  if(gmPool().length<12){toast('Cần ít nhất 12 từ, hãy chọn thêm cấp HSK.');return;}
  gmStart(game);
}
const GM_PLAY={speed:gmSpeed,match:gmMatch,fall:gmFall,tone:gmTone};
const GM_RULES={
  speed:['60 giây, mỗi lượt hiện một từ chữ Hán, không có pinyin.','Chọn nghĩa đúng bằng chuột hoặc phím 1, 2, 3, 4.','Đúng 3 câu liên tiếp được nhân 2 điểm, 6 câu nhân 3, tối đa nhân 5. Sai là mất chuỗi.'],
  match:['Mỗi vòng có 6 thẻ chữ Hán và 6 thẻ nghĩa đã xáo trộn.','Chạm một thẻ rồi chạm thẻ cặp với nó. Chạm thẻ chữ Hán sẽ nghe đọc.','3 vòng. Mỗi cặp đúng 50 điểm, ghép sai trừ 15, xong sớm được thưởng thêm.'],
  fall:['Chữ rơi từ trên xuống, chạm đáy là mất một mạng. Có 3 mạng.','Gõ pinyin không dấu rồi nhấn Enter, ví dụ 学习 là xuexi, ü gõ là v (绿 là lv).','Chữ rơi nhanh dần. Chế độ chọn nghĩa: chọn nghĩa của chữ thấp nhất bằng chuột hoặc phím 1-4.'],
  tone:['Nghe một âm tiết do người thật đọc.','Chọn thanh 1-4 bằng nút hoặc phím 1, 2, 3, 4 trước khi thanh thời gian hết.','Đúng liên tiếp được cộng thêm điểm. Sai hoặc hết giờ mất một mạng, có 3 mạng. Phím R để nghe lại.'],
};

/* ---------- shared frame, start and end screens ---------- */
function gmFrame(game){
  gmClear();
  const el=$('#view');
  el.innerHTML=`<div class="view"><div class="gm-stage" id="gmStage" data-game="${game.id}">
    <div class="gm-head"><button class="btn sm" id="gmBack">Thoát</button><b class="gm-title"><span class="han">${game.icon}</span> ${game.name}</b><div class="gm-hud" id="gmHud"></div></div>
    <div class="gm-body" id="gmBody"></div></div></div>`;
  $('#gmBack').onclick=()=>{gmClear();stopSay();renderGames(el);};
  return $('#gmBody');
}
function gmStart(game){
  const b=gmFrame(game);
  const fall=game.id==='fall';
  b.innerHTML=`<div class="gm-start"><div class="gm-bigic han">${game.icon}</div><h2>${game.name}</h2>
    <ul class="gm-rules">${GM_RULES[game.id].map(r=>`<li>${esc(r)}</li>`).join('')}</ul>
    ${fall?`<div class="row" id="gmFm"><span class="label">Chế độ</span><button class="chip" data-fm="py" aria-pressed="${GM.fallMode==='py'}">Gõ pinyin</button><button class="chip" data-fm="vi" aria-pressed="${GM.fallMode==='vi'}">Chọn nghĩa</button></div>`:''}
    <button class="btn primary gm-go" id="gmGo">Bắt đầu</button><span class="small muted">hoặc nhấn Enter</span></div>`;
  if(fall)$$('#gmFm [data-fm]').forEach(x=>x.onclick=()=>{GM.fallMode=x.dataset.fm;$$('#gmFm [data-fm]').forEach(y=>y.setAttribute('aria-pressed',y===x));});
  const begin=()=>gmCountdown(game);
  $('#gmGo').onclick=begin;
  GM.key=e=>{if(e.key==='Enter'&&!e.target.closest('button')){e.preventDefault();begin();}};
}
function gmCountdown(game){
  const b=gmFrame(game);GM.active=true;
  const steps=gmReduce()?['Bắt đầu']:['3','2','1'];let i=0;
  const show=()=>{if(i>=steps.length){b.innerHTML='';GM_PLAY[game.id](b,game);return;}
    b.innerHTML=`<div class="gm-count"><span class="num">${steps[i]}</span></div>`;gmSfx('tick');i++;gmLater(show,steps.length>1?520:600);};
  show();
}
function gmEnd(game,score,missed,stats){
  gmClear();stopSay();gmSfx('end');
  const g=gmData(),prev=g.best[game.id]||0,rec=score>prev;
  if(rec)g.best[game.id]=score;g.plays[game.id]=(g.plays[game.id]||0)+1;touch('main');
  if(score>0)window.__award&&window.__award('game',Math.max(1,Math.round(score/10)));
  const uniq=[...new Map(missed.map(w=>[w.h,w])).values()];
  const b=$('#gmBody');if(!b)return;$('#gmHud').innerHTML='';
  b.innerHTML=`<div class="gm-end">
    <span class="label">Điểm</span><div class="gm-score num">${score}</div>
    ${rec&&prev?'<span class="pill ai">Kỷ lục mới</span>':rec&&score?'<span class="pill ai">Kỷ lục đầu tiên</span>':''}
    <div class="gm-stats">${stats.map(([k,v])=>`<div><b class="num">${v}</b><span class="small muted">${k}</span></div>`).join('')}<div><b class="num">${Math.max(prev,score)}</b><span class="small muted">Kỷ lục</span></div></div>
    <div class="gm-missed"><h3>Từ cần ôn${uniq.length?' ('+uniq.length+')':''}</h3>
     ${uniq.length?`<p class="note">Bấm vào từ để xem chi tiết, bấm loa để nghe.</p><div class="gm-mlist">${uniq.map(w=>`<div class="gm-mw"><button class="gm-mwb" data-wd="${esc(w.h)}"><span class="han gm-mh">${hanHTML(w)}</span><span class="gm-mt"><span class="py small">${pyHTML(w)}</span><span class="small">${esc(gmShort(w.vi))}</span></span></button><button class="spk" data-say="${esc(w.h)}" aria-label="Nghe ${esc(w.h)}">${SPK}</button></div>`).join('')}</div>`:'<p class="note">Không sai từ nào trong lượt này.</p>'}</div>
    <div class="row gm-endbtns"><button class="btn primary" id="gmAgain">Chơi lại</button><button class="btn" id="gmMenu">Chọn trò khác</button></div></div>`;
  $$('[data-wd]',b).forEach(x=>x.onclick=()=>openWord(x.dataset.wd));
  $('#gmAgain').onclick=()=>gmCountdown(game);
  $('#gmMenu').onclick=()=>renderGames($('#view'));
  GM.key=e=>{if(e.key==='Enter'&&!e.target.closest('button')){e.preventDefault();gmCountdown(game);}};
}

/* ---------- 1. Tốc độ 60 giây ---------- */
function gmSpeed(body,game){
  const pool=gmPool(),hud=$('#gmHud'),DUR=60;
  const st={score:0,combo:0,maxCombo:0,right:0,wrong:0,missed:[],left:DUR,lock:true,cur:null,opts:[]};
  const mult=c=>Math.min(5,1+Math.floor(c/3));
  body.innerHTML=`<div class="gm-tbar" id="gmTb"><i id="gmT"></i></div>
    <div class="gm-sp"><div class="gm-combo" id="gmCombo"></div><div class="gm-word han" id="gmW"></div><div class="gm-fxh" id="gmFx"></div></div>
    <div class="gm-opts" id="gmO"></div>`;
  const drawHud=()=>{hud.innerHTML=`<span class="gm-pts num">${st.score}</span><span class="timer num ${st.left<=10?'low':''}">${Math.ceil(st.left)}s</span>`;};
  const drawCombo=()=>{const m=mult(st.combo);$('#gmCombo').innerHTML=st.combo>=2?`<span class="gm-cb ${m>1?'hot':''}">Chuỗi ${st.combo}${m>1?' - nhân '+m:''}</span>`:'';};
  let order=shuffle(pool),oi=0;
  function next(){
    if(oi>=order.length){order=shuffle(pool);oi=0;}
    st.cur=order[oi++];st.opts=gmOptions(st.cur,pool);st.lock=false;
    const n=[...st.cur.h].length,w=$('#gmW');w.innerHTML=hanHTML(st.cur);w.style.setProperty('--n',n);
    $('#gmO').innerHTML=st.opts.map((o,k)=>`<button class="gm-opt" data-k="${k}"><span class="gm-k num">${k+1}</span><span>${esc(gmShort(o.vi))}</span></button>`).join('');
    $$('#gmO [data-k]').forEach(b=>b.onclick=()=>answer(+b.dataset.k));
  }
  function answer(k){
    if(st.lock||!st.opts[k])return;st.lock=true;
    const btns=$$('#gmO .gm-opt'),ri=st.opts.indexOf(st.cur);btns[ri].classList.add('right');
    if(k===ri){st.combo++;st.right++;st.maxCombo=Math.max(st.maxCombo,st.combo);const pts=10*mult(st.combo);st.score+=pts;
      gmSfx(st.combo>=3&&st.combo%3===0?'combo':'ok');gmFloat($('#gmFx'),'+'+pts,'ok');gmLater(next,200);}
    else{btns[k].classList.add('wrong');st.combo=0;st.wrong++;st.missed.push(st.cur);gmSfx('bad');gmLater(next,850);}
    drawCombo();drawHud();
  }
  const end=performance.now()+DUR*1000;let lastSec=DUR;
  gmEvery(()=>{
    st.left=Math.max(0,(end-performance.now())/1000);
    $('#gmT').style.width=(st.left/DUR*100)+'%';$('#gmTb').classList.toggle('low',st.left<=10);
    const s=Math.ceil(st.left);if(s!==lastSec){lastSec=s;drawHud();if(s<=5&&s>0)gmSfx('tick');}
    if(st.left<=0)gmEnd(game,st.score,st.missed,[['Đúng',st.right],['Sai',st.wrong],['Chuỗi dài nhất',st.maxCombo]]);
  },100);
  GM.key=e=>{if(/^[1-4]$/.test(e.key)){e.preventDefault();answer(+e.key-1);}};
  drawHud();drawCombo();next();
}

/* ---------- 2. Ghép cặp ---------- */
function gmMatch(body,game){
  const pool=gmPool(),hud=$('#gmHud'),ROUNDS=3,PAIRS=6,used=new Set();
  const st={round:0,left:0,mistakes:0,score:0,missed:[],sel:null,cards:[],t0:performance.now()};
  body.innerHTML=`<div class="gm-mround" id="gmR"></div><div class="gm-grid" id="gmG"></div>`;
  const drawHud=()=>{hud.innerHTML=`<span class="small muted">Vòng ${st.round}/${ROUNDS}</span><span class="gm-pts num">${st.score}</span><span class="timer num">${gmClock((performance.now()-st.t0)/1000)}</span>`;};
  function round(){
    st.round++;st.sel=null;const ws=[],means=new Set();
    for(const w of shuffle(pool)){if(ws.length>=PAIRS)break;const s=gmShort(w.vi);if(used.has(w.h)||means.has(s))continue;means.add(s);used.add(w.h);ws.push(w);}
    st.cards=shuffle([...ws.map(w=>({w,t:'h'})),...ws.map(w=>({w,t:'v'}))]);st.left=ws.length;
    $('#gmR').innerHTML=`<span class="label">Vòng ${st.round}</span><span class="small muted">Còn ${st.left} cặp</span>`;
    $('#gmG').innerHTML=st.cards.map((c,i)=>`<button class="gm-mc ${c.t==='h'?'is-h':'is-v'}" data-i="${i}">${c.t==='h'?`<span class="han">${hanHTML(c.w)}</span>`:`<span>${esc(gmShort(c.w.vi))}</span>`}</button>`).join('');
    $$('#gmG [data-i]').forEach(b=>b.onclick=()=>tap(+b.dataset.i,b));
    drawHud();
  }
  function tap(i,btn){
    const c=st.cards[i];if(c.done)return;
    if(c.t==='h')sayWord(c.w.h);
    const btns=$$('#gmG .gm-mc');
    if(st.sel===null||st.sel===i||st.cards[st.sel].t===c.t){
      if(st.sel!==null)btns[st.sel].classList.remove('sel');
      st.sel=st.sel===i?null:i;if(st.sel!==null)btn.classList.add('sel');return;
    }
    const a=st.cards[st.sel],ba=btns[st.sel];ba.classList.remove('sel');st.sel=null;
    if(a.w===c.w){
      a.done=c.done=true;st.score+=50;st.left--;gmSfx('ok');
      [ba,btn].forEach(x=>{x.classList.add('ok');setTimeout(()=>x.classList.add('gone'),gmReduce()?120:320);});
      $('#gmR').innerHTML=`<span class="label">Vòng ${st.round}</span><span class="small muted">Còn ${st.left} cặp</span>`;
      if(!st.left){
        if(st.round<ROUNDS){gmSfx('combo');$('#gmR').innerHTML=`<span class="label">Xong vòng ${st.round}</span><span class="small muted">Chuẩn bị vòng ${st.round+1}</span>`;gmLater(round,800);}
        else gmLater(finish,450);
      }
    }else{
      st.mistakes++;st.score=Math.max(0,st.score-15);st.missed.push(a.t==='h'?a.w:c.w);gmSfx('bad');
      [ba,btn].forEach(x=>{x.classList.add('bad');setTimeout(()=>x.classList.remove('bad'),480);});
    }
    drawHud();
  }
  function finish(){
    const secs=(performance.now()-st.t0)/1000,bonus=Math.max(0,Math.round((150-secs)*3));st.score+=bonus;
    gmEnd(game,st.score,st.missed,[['Thời gian',gmClock(secs)],['Ghép sai',st.mistakes],['Thưởng tốc độ',bonus]]);
  }
  gmEvery(drawHud,250);
  round();
}

/* ---------- 3. Chữ rơi ---------- */
function gmFall(body,game){
  const mode=GM.fallMode,reduce=gmReduce(),hud=$('#gmHud');
  const pool=gmPool().filter(w=>[...w.h].length<=4&&w.p.length===[...w.h].length);
  const keyOf=w=>w.p.map(s=>stripTone(s).replace(/[^a-zv]/g,'')).join('');
  const st={score:0,lives:3,combo:0,killed:0,missed:[],items:[],t:0,spawnIn:0,last:0,lowest:null,opts:[]};
  body.innerHTML=`<div class="gm-field" id="gmF"><div class="gm-floor" id="gmFloor"></div></div>
    ${mode==='py'?`<form class="gm-type" id="gmForm" autocomplete="off"><input id="gmIn" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="Pinyin không dấu, vd: xuexi" aria-label="Pinyin"><button class="btn primary" type="submit">Bắn</button></form>`
      :`<div class="gm-opts gm-opts-fall" id="gmO"></div>`}`;
  const F=$('#gmF');
  const drawHud=()=>{hud.innerHTML=`<span class="gm-lives" aria-label="${st.lives} mạng">${[0,1,2].map(i=>`<i class="${i<st.lives?'on':''}">♥</i>`).join('')}</span><span class="gm-pts num">${st.score}</span>`;};
  const label=w=>`${w.p.join(' ')} - ${gmShort(w.vi)}`;
  function spawn(){
    const onScreen=new Set(st.items.map(it=>it.w.h)),keys=new Set(st.items.map(it=>it.key));
    let w=null;for(let k=0;k<20;k++){const c=pick(pool);if(!onScreen.has(c.h)&&!keys.has(keyOf(c))){w=c;break;}}
    if(!w)return;
    const el=document.createElement('div');el.className='gm-drop han';el.innerHTML=hanHTML(w);F.appendChild(el);
    const ew=el.offsetWidth,eh=el.offsetHeight,fw=F.clientWidth;
    const it={w,el,key:keyOf(w),x:6+Math.random()*Math.max(0,fw-ew-12),y:-eh,h:eh};
    el.style.transform=`translate(${it.x}px,${it.y}px)`;st.items.push(it);
  }
  function remove(it){st.items=st.items.filter(x=>x!==it);}
  function kill(it){
    remove(it);st.combo++;st.killed++;
    const pts=10+5*([...it.w.h].length-1)+Math.min(20,(st.combo-1)*2);st.score+=pts;
    gmSfx(st.combo%5===0?'combo':'pop');
    gmFloat(F,'+'+pts+'  '+label(it.w),'ok',it.x,Math.max(0,it.y));
    it.el.style.setProperty('--t',`translate(${it.x}px,${it.y}px)`);it.el.classList.add('boom');setTimeout(()=>it.el.remove(),reduce?60:260);drawHud();
  }
  function lose(it){
    remove(it);st.lives--;st.combo=0;st.missed.push(it.w);gmSfx('bad');
    gmFloat(F,label(it.w),'bad',it.x,F.clientHeight-70);
    it.el.remove();$('#gmFloor').classList.remove('hit');void F.offsetWidth;$('#gmFloor').classList.add('hit');drawHud();
    if(st.lives<=0)gmEnd(game,st.score,st.missed,[['Phá được',st.killed],['Thời gian',gmClock(st.t)],['Chế độ',mode==='py'?'Pinyin':'Nghĩa']]);
  }
  function drawOpts(){
    const box=$('#gmO');if(!box)return;const it=st.lowest;
    if(!it){box.innerHTML='<p class="note">Chờ chữ rơi xuống...</p>';st.opts=[];return;}
    st.opts=gmOptions(it.w,pool);
    box.innerHTML=st.opts.map((o,k)=>`<button class="gm-opt" data-k="${k}"><span class="gm-k num">${k+1}</span><span>${esc(gmShort(o.vi))}</span></button>`).join('');
    $$('[data-k]',box).forEach(b=>b.onclick=()=>choose(+b.dataset.k));
  }
  function choose(k){
    const it=st.lowest,o=st.opts[k];if(!it||!o)return;
    if(o===it.w){kill(it);return;}
    const b=$$('#gmO .gm-opt')[k];if(b){b.classList.add('wrong');setTimeout(()=>b.classList.remove('wrong'),400);}
    st.combo=0;st.score=Math.max(0,st.score-5);if(!st.missed.includes(it.w))st.missed.push(it.w);gmSfx('bad');drawHud();
  }
  function shoot(){
    const inp=$('#gmIn');const v=stripTone(inp.value).replace(/[^a-z]/g,'');if(!v)return;
    const hits=st.items.filter(it=>it.key===v||it.key.replace(/v/g,'u')===v).sort((a,b)=>b.y-a.y);
    inp.value='';st.items.forEach(it=>it.el.classList.remove('hit'));
    if(hits.length)kill(hits[0]);
    else{st.combo=0;gmSfx('bad');inp.classList.remove('gm-shake');void inp.offsetWidth;inp.classList.add('gm-shake');}
  }
  if(mode==='py'){
    const inp=$('#gmIn');
    $('#gmForm').onsubmit=e=>{e.preventDefault();shoot();inp.focus();};
    inp.oninput=()=>{const v=stripTone(inp.value).replace(/[^a-z]/g,'');st.items.forEach(it=>it.el.classList.toggle('hit',!!v&&(it.key.startsWith(v)||it.key.replace(/v/g,'u').startsWith(v))));};
    setTimeout(()=>inp.focus(),30);
  }else GM.key=e=>{if(/^[1-4]$/.test(e.key)){e.preventDefault();choose(+e.key-1);}};
  const slow=reduce?0.6:1,slowMode=mode==='vi'?0.85:1;
  function loop(ts){
    if(!gmAlive()){gmClear();return;}
    const dt=st.last?Math.min(0.05,(ts-st.last)/1000):0;st.last=ts;st.t+=dt;
    const H=F.clientHeight,scale=H/420;
    const speed=Math.min(150,30+st.t*1.2)*scale*slow*slowMode;
    st.spawnIn-=dt;
    if(st.spawnIn<=0&&st.items.length<7){spawn();st.spawnIn=Math.max(mode==='vi'?1.7:1.0,(mode==='vi'?3.6:3.0)-st.t*0.035)/slow;}
    for(const it of st.items.slice()){
      it.y+=speed*dt;it.el.style.transform=`translate(${it.x}px,${it.y}px)`;
      if(it.y+it.h>=H-6){lose(it);if(st.lives<=0)return;}
    }
    if(mode==='vi'){
      const low=st.items.reduce((m,it)=>!m||it.y>m.y?it:m,null);
      if(low!==st.lowest){if(st.lowest)st.lowest.el.classList.remove('target');st.lowest=low;if(low)low.el.classList.add('target');drawOpts();}
    }
    GM.raf=requestAnimationFrame(loop);
  }
  drawHud();if(mode==='vi')drawOpts();
  GM.raf=requestAnimationFrame(loop);
}

/* ---------- 4. Bắn thanh điệu ---------- */
function gmTone(body,game){
  const hud=$('#gmHud'),entries=[],seenSyl=new Set();
  for(const w of shuffle(gmPool())){const ch=[...w.h];if(ch.length!==w.p.length)continue;
    w.p.forEach((p,i)=>{const t=toneOf(p);if(t===5)return;const syl=stripTone(p).replace(/[^a-zv]/g,'')+t;if(seenSyl.has(syl))return;seenSyl.add(syl);entries.push({syl,mark:p.toLowerCase(),tone:t,w,ch:ch[i]});});}
  const st={score:0,lives:3,streak:0,best:0,right:0,n:0,missed:[],cur:null,phase:'load',tm:0,tts:false};
  body.innerHTML=`<div class="gm-tone">
    <div class="gm-tq"><button class="gm-play" id="gmPlay" aria-label="Nghe lại">${SPK}</button><span class="small muted" id="gmTs">Đang phát...</span></div>
    <div class="gm-tbar" id="gmTb"><i id="gmT"></i></div>
    <div class="gm-reveal" id="gmRv"></div>
    <div class="gm-tbtns">${[1,2,3,4].map(n=>`<button class="gm-tb" data-t="${n}"><span class="py t${n}">${GM_TONE_MARK[n-1]}</span><span class="small muted">Thanh ${n} <span class="kbd">${n}</span></span></button>`).join('')}</div></div>`;
  const drawHud=()=>{hud.innerHTML=`<span class="gm-lives" aria-label="${st.lives} mạng">${[0,1,2].map(i=>`<i class="${i<st.lives?'on':''}">♥</i>`).join('')}</span>${st.streak>=2?`<span class="gm-cb hot">Chuỗi ${st.streak}</span>`:''}<span class="gm-pts num">${st.score}</span>`;};
  const play=e=>st.tts?gmRace(say(e.ch),2500):gmRace(saySyl(e.syl),3000);
  async function nextQ(){
    st.phase='load';st.cur=null;$('#gmRv').innerHTML='';$('#gmTs').textContent='Đang phát...';$('#gmT').style.width='100%';
    $$('.gm-tb').forEach(b=>{b.classList.remove('right','wrong');b.disabled=false;});
    let e=null;
    for(let k=0;k<8&&!e;k++){const c=pick(entries);if(await play(c))e=c;if(!gmAlive())return;}
    if(!e){st.tts=true;e=pick(entries);toast('Không phát được bản thu âm tiết, tạm dùng giọng máy.');await play(e);if(!gmAlive())return;}
    st.cur=e;st.phase='ask';$('#gmTs').textContent='Thanh mấy?';
    const limit=Math.max(2.5,5.5-st.n*0.08)*(gmReduce()?1.3:1),t0=performance.now();
    st.tm=gmEvery(()=>{const left=limit-(performance.now()-t0)/1000;$('#gmT').style.width=Math.max(0,left/limit*100)+'%';$('#gmTb').classList.toggle('low',left<limit*0.3);if(left<=0)answer(0);},50);
  }
  function answer(t){
    if(st.phase!=='ask')return;st.phase='show';clearInterval(st.tm);st.n++;
    const c=st.cur,ok=t===c.tone,btns=$$('.gm-tb');
    btns.forEach(b=>b.disabled=true);btns[c.tone-1].classList.add('right');if(t&&!ok)btns[t-1].classList.add('wrong');
    if(ok){st.streak++;st.right++;st.best=Math.max(st.best,st.streak);const pts=10+Math.min(20,(st.streak-1)*2);st.score+=pts;gmSfx(st.streak%5===0?'combo':'ok');}
    else{st.lives--;st.streak=0;st.missed.push(c.w);gmSfx('bad');}
    $('#gmTs').textContent=ok?'Đúng':(t?'Chưa đúng':'Hết giờ');
    $('#gmRv').innerHTML=`<span class="py gm-syl t${c.tone}">${esc(c.mark)}</span><span class="small muted">thanh ${c.tone}, trong từ</span>
      <button class="gm-rw" data-say="${esc(c.w.h)}"><span class="han">${hanHTML(c.w)}</span><span class="py small">${pyHTML(c.w)}</span><span class="small">${esc(gmShort(c.w.vi))}</span></button>`;
    drawHud();
    if(st.lives<=0)gmLater(()=>gmEnd(game,st.score,st.missed,[['Đúng',st.right+'/'+st.n],['Chuỗi dài nhất',st.best]]),1500);
    else gmLater(nextQ,ok?1100:2000);
  }
  $$('.gm-tb').forEach(b=>b.onclick=()=>answer(+b.dataset.t));
  $('#gmPlay').onclick=()=>{if(st.cur)play(st.cur);};
  GM.key=e=>{if(/^[1-4]$/.test(e.key)){e.preventDefault();answer(+e.key);}else if((e.key==='r'||e.key==='R'||e.key===' ')&&st.cur){e.preventDefault();play(st.cur);}};
  drawHud();nextQ();
}

VIEWS.games=renderGames;
