/* ================= PLAN: daily plan, XP, ranks, placement, mistakes, culture, decomposition, reports ================= */
const PL_W={review:1,new:3,listen:2,speak:3,read:20,write:6,grammar:8,test:4,game:1,culture:5};
const PL_RANKS=[[0,'童生','Đồng sinh'],[300,'秀才','Tú tài'],[1000,'举人','Cử nhân'],[2500,'贡士','Cống sĩ'],[5000,'进士','Tiến sĩ'],[9000,'探花','Thám hoa'],[15000,'榜眼','Bảng nhãn'],[25000,'状元','Trạng nguyên']];
function plDay(k){P.day=P.day||{};k=k||ymd(Date.now());return P.day[k]=P.day[k]||{xp:0};}
function plXPTotal(){return Object.values(P.day||{}).reduce((a,d)=>a+(d.xp||0),0);}
function plRank(xp){let r=PL_RANKS[0],nx=null;for(let i=0;i<PL_RANKS.length;i++){if(xp>=PL_RANKS[i][0]){r=PL_RANKS[i];nx=PL_RANKS[i+1]||null;}}return {r,nx};}
function award(kind,n){
  n=n||1; const d=plDay(); d[kind]=(d[kind]||0)+n; const before=plXPTotal();
  d.xp=(d.xp||0)+Math.round((PL_W[kind]||1)*n);
  const k=ymd(Date.now()); P.hist[k]=(P.hist[k]||0)+n; touch('main');
  const a=plRank(before).r, b=plRank(plXPTotal()).r;
  const gain=Math.round((PL_W[kind]||1)*n); window.__xpFly&&window.__xpFly(gain);
  if(b!==a){if(window.__rankUp)window.__rankUp(b);else toast('Lên danh hiệu mới: '+b[2]+' ('+b[1]+')',4000);}
  const goal=plGoalXP(); if(d.xp>=goal&&d.xp-gain<goal){if(window.__goalDone)setTimeout(window.__goalDone,b!==a?2500:600);else toast('Đã đạt mục tiêu hôm nay. Giỏi lắm!',3500);}
  plTick();
}
window.__award=award;
function plCfg(){P.plan=P.plan||{target:4,minutes:30,start:today(),auto:true};return P.plan;}
function plGoalXP(){return Math.round(plCfg().minutes*3.5);}
function plNewPerDay(){const m=plCfg().minutes;return m>=90?35:m>=60?25:m>=45?18:m>=30?12:8;}
function plApply(){const c=plCfg();if(!c.auto)return;P.settings.lv=LVS.filter(L=>L<=c.target);P.settings.newPerDay=plNewPerDay();}
function plTasks(){
  const c=plCfg(), d=plDay(), dow=new Date().getDay(), even=Math.floor(today()/DAY)%2===0;
  const due=dueList(studyLv()).length, nw=Math.max(0,P.settings.newPerDay-newToday());
  const t=[
    {k:'srs',t:'Ôn thẻ và học từ mới',sub:due+nw?`${due} thẻ đến hạn, ${nw} từ mới`:'Đã xong phần thẻ hôm nay',done:due===0&&nw===0,go:'study'},
    {k:'listen',t:'Nghe 10 câu',sub:'Chép chính tả hoặc nghe chọn nghĩa',done:(d.listen||0)>=10,go:'listen',n:[(d.listen||0),10]},
    {k:'speak',t:'Nói 5 câu',sub:'Nhại theo câu mẫu hoặc chấm thanh điệu',done:(d.speak||0)>=5,go:'speak',n:[(d.speak||0),5]},
    even?{k:'read',t:'Đọc 1 bài',sub:'Bài đọc theo cấp, làm câu hỏi cuối bài',done:(d.read||0)>=1,go:'read'}
        :{k:'grammar',t:'Học 1 điểm ngữ pháp',sub:'Đọc, làm câu luyện tập, bấm "Đánh dấu đã nắm"',done:(d.grammar||0)>=1,go:'grammar'},
    {k:'culture',t:'Chuyện văn hóa hôm nay',sub:'Đọc và trả lời câu hỏi nhỏ',done:(d.culture||0)>=1,go:'culture'},
  ];
  if(c.minutes>=45)t.push({k:'write',t:'Viết 3 câu',sub:'Sắp xếp câu, dịch câu hoặc viết đoạn',done:(d.write||0)>=3,go:'write',n:[(d.write||0),3]});
  if(dow===0)t.push({k:'test',t:'Thi thử cuối tuần',sub:'Một đề HSK '+c.target+' để đo tiến độ',done:(d.test||0)>=1,go:'test'});
  const mist=plMistList().length; if(mist)t.push({k:'mist',t:'Ôn sổ lỗi',sub:mist+' mục đang chờ',done:(d.mist||0)>=1,go:'mistakes'});
  return t;
}
function plProjection(){
  const c=plCfg(); const ws=W.filter(w=>w.lv<=c.target); const left=ws.filter(w=>!P.srs[w.h]).length; const per=P.settings.newPerDay||1;
  const days=Math.ceil(left/per); return {left,total:ws.length,days,date:new Date(today()+days*DAY)};
}
function plWeek(){let xp=0,act=0,nw=0;for(let i=0;i<7;i++){const d=(P.day||{})[ymd(today()-i*DAY)];if(d){xp+=d.xp||0;if(d.xp)act++;nw+=d.new||0;}}return {xp,act,nw};}
function plRing(pct){const r=34,c=2*Math.PI*r,o=c*(1-Math.min(1,pct));return `<svg viewBox="0 0 84 84" class="pl-ring" role="img" aria-label="${Math.round(pct*100)}% mục tiêu"><circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--line)" stroke-width="9"/><circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${o.toFixed(1)}" transform="rotate(-90 42 42)"/><text x="42" y="47" text-anchor="middle" font-size="17" font-weight="700" fill="var(--ink)" font-family="Be Vietnam Pro,sans-serif">${Math.round(pct*100)}%</text></svg>`;}
function plTick(){const el=$('#plPanel');if(el&&current==='home')el.outerHTML=plPanelHTML();plBind();}
function plPanelHTML(){
  const c=plCfg(), d=plDay(), goal=plGoalXP(), xpT=plXPTotal(), {r,nx}=plRank(xpT), tasks=plTasks(), pr=plProjection(), wk=plWeek();
  const doneN=tasks.filter(x=>x.done).length;
  return `<div class="panel pl-panel" id="plPanel">
    <div class="pl-top">${plRing(d.xp/goal)}
      <div class="pl-sum"><div class="label">Mục tiêu hôm nay</div><div><b class="num">${d.xp||0}</b> / ${goal} XP, ${doneN}/${tasks.length} việc</div>
        <div class="small muted">Danh hiệu: <b style="color:var(--ink)">${r[2]}</b> <span class="han">${r[1]}</span>${nx?` - còn ${nx[0]-xpT} XP lên ${nx[2]}`:''}</div>
        <div class="small muted">Chuỗi ${streak()} ngày. 7 ngày qua: ${wk.xp} XP, ${wk.nw} từ mới, học ${wk.act}/7 ngày.</div></div>
      <button class="btn sm" id="plSet">Lộ trình</button></div>
    <div class="pl-tasks">${tasks.map(x=>`<button class="pl-task ${x.done?'done':''}" data-go="${x.go}"><span class="check ${x.done?'on':''}">${x.done?'✓':''}</span><span><b>${esc(x.t)}</b>${x.n?` <span class="num muted">${Math.min(x.n[0],x.n[1])}/${x.n[1]}</span>`:''}<br><span class="small muted">${esc(x.sub)}</span></span></button>`).join('')}</div>
    <div class="small muted">Mục tiêu HSK ${lvN(c.target)}, ${c.minutes} phút/ngày, ${P.settings.newPerDay} từ mới/ngày. Còn ${pr.left}/${pr.total} từ chưa học, dự kiến học hết vào <b style="color:var(--ink)">${pr.date.toLocaleDateString('vi-VN')}</b> (${pr.days} ngày).</div>
    <div class="row small"><button class="lnk" data-go="mistakes">Sổ lỗi sai</button><button class="lnk" data-go="culture">Văn hóa</button><button class="lnk" data-go="games">Trò chơi</button><button class="lnk" data-go="placement">Xếp lớp lại</button><button class="lnk" id="plRep">Báo lỗi đã ghi</button></div>
    ${Object.keys(P.srs).length<20&&!P.placed?`<div class="vn">Bạn từng học tiếng Trung. Làm <button class="lnk" id="plPlace">bài xếp lớp 10 phút</button> để bỏ qua những từ còn nhớ, tiết kiệm vài trăm thẻ.</div>`:''}
  </div>`;
}
function plBind(){
  const s=$('#plSet');if(s)s.onclick=plSettings;
  const p=$('#plPlace');if(p)p.onclick=()=>go('placement');
  const rp=$('#plRep');if(rp)rp.onclick=reportsList;
  $$('#plPanel [data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
}
function plSettings(){
  const c=plCfg();
  const m=modal(`<h2>Lộ trình học</h2>
    <label class="label">Mục tiêu</label><div class="row">${LVS.map(L=>`<button class="chip" data-t="${L}" aria-pressed="${c.target===L}">HSK ${lvN(L)}</button>`).join('')}</div>
    <label class="label">Số phút mỗi ngày</label><div class="row">${[15,30,45,60,90].map(n=>`<button class="chip" data-m="${n}" aria-pressed="${c.minutes===n}">${n} phút</button>`).join('')}</div>
    <p class="note" id="plInfo"></p>
    <label class="row small"><input type="checkbox" id="plAuto" ${c.auto?'checked':''}> Tự đặt cấp đang học và số từ mới theo lộ trình</label>`);
  const info=()=>{plApply();const pr=plProjection();$('#plInfo',m.el).textContent=`${P.settings.newPerDay} từ mới/ngày. Còn ${pr.left} từ đến hết HSK ${lvN(c.target)}, dự kiến ${pr.days} ngày (đến ${pr.date.toLocaleDateString('vi-VN')}). Mỗi ngày mục tiêu ${plGoalXP()} XP.`;};info();
  $$('[data-t]',m.el).forEach(b=>b.onclick=()=>{c.target=+b.dataset.t;$$('[data-t]',m.el).forEach(x=>x.setAttribute('aria-pressed',x===b));info();touch('main');});
  $$('[data-m]',m.el).forEach(b=>b.onclick=()=>{c.minutes=+b.dataset.m;$$('[data-m]',m.el).forEach(x=>x.setAttribute('aria-pressed',x===b));info();touch('main');});
  $('#plAuto',m.el).onchange=e=>{c.auto=e.target.checked;info();touch('main');};
  const obs=new MutationObserver(()=>{if(!document.body.contains(m.el)){obs.disconnect();buildQueue&&(queue=[]);route();}});obs.observe(document.body,{childList:true});
}
const _plHome=renderHome;
VIEWS.home=el=>{plCfg();plApply();_plHome(el);const v=$('.view',el);if(!v)return;const h=document.createElement('div');v.prepend(h);h.outerHTML=plPanelHTML();
  const cul=document.createElement('div');$('.hero',el).after(cul);cul.outerHTML=culCardHTML();plBind();culBind();};

/* ---------- placement test ---------- */
let PLC=null;
VIEWS.placement=el=>{
  if(!PLC)PLC={L:1,i:0,items:[],stats:{},marked:0};
  const c=plCfg();
  const start=()=>{const pool=W.filter(w=>w.lv===PLC.L&&!P.srs[w.h]);PLC.items=shuffle(pool).slice(0,15);PLC.i=0;PLC.stats[PLC.L]={yes:0,ok:0,chk:0,n:0};draw();};
  const finishLevel=()=>{const st=PLC.stats[PLC.L];const ratio=st.n?st.yes/st.n:0;const acc=st.chk?st.ok/st.chk:1;
    el.innerHTML=`<div class="view"><h2>Bài xếp lớp - HSK ${lvN(PLC.L)}</h2><div class="panel"><p>Bạn nhận ra <b>${st.yes}/${st.n}</b> từ mẫu${st.chk?`, kiểm tra lại đúng ${st.ok}/${st.chk}`:''}.</p>
      ${ratio*acc>=0.8?`<p>Có vẻ bạn nắm khá chắc HSK ${lvN(PLC.L)}. Có thể đánh dấu cả cấp là đã biết. Các từ này vẫn sẽ quay lại rải rác trong vài tuần để kiểm tra, từ nào quên thì học lại.</p><div class="row"><button class="btn primary" id="pcAll">Đánh dấu cả HSK ${lvN(PLC.L)} đã biết</button><button class="btn" id="pcNext">Chỉ giữ những từ vừa chọn, sang cấp tiếp</button></div>`
        :ratio*acc>=0.4?`<p>Bạn nhớ một phần HSK ${lvN(PLC.L)}. Những từ bạn chọn "Biết" đã được đánh dấu, phần còn lại sẽ học như từ mới.</p><div class="row"><button class="btn primary" id="pcEnd">Xong, bắt đầu học</button>${PLC.L<c.target?'<button class="btn" id="pcNext">Thử cấp tiếp</button>':''}</div>`
        :`<p>Nên bắt đầu học từ HSK ${lvN(PLC.L)}. Những từ bạn đã biết đã được đánh dấu.</p><button class="btn primary" id="pcEnd">Bắt đầu học</button>`}</div></div>`;
    const all=$('#pcAll');if(all)all.onclick=()=>{let n=0;W.filter(w=>w.lv===PLC.L&&!P.srs[w.h]).forEach(w=>{const iv=5+Math.floor(Math.random()*25);P.srs[w.h]={iv,ef:2.5,n:2,l:0,due:today()+iv*DAY,s:2,first:Date.now(),pl:1};n++;});PLC.marked+=n;touch('srs');touch('main');next();};
    const nx=$('#pcNext');if(nx)nx.onclick=next; const en=$('#pcEnd');if(en)en.onclick=end;};
  const next=()=>{if(PLC.L>=Math.min(6,Math.max(c.target,4))){end();return;}PLC.L++;start();};
  const end=()=>{P.placed=1;touch('main');toast('Đã xếp lớp. '+Object.values(P.srs).filter(x=>x.pl).length+' từ được đánh dấu đã biết.',4000);PLC=null;queue=[];go('home');};
  const draw=()=>{
    const w=PLC.items[PLC.i]; if(!w){finishLevel();return;}
    const st=PLC.stats[PLC.L];
    el.innerHTML=`<div class="view"><div class="spread"><h2>Bài xếp lớp - HSK ${lvN(PLC.L)}</h2><span class="note num">${PLC.i+1}/${PLC.items.length}</span></div>
      <p class="note">Nhìn chữ, nếu biết nghĩa thì bấm "Biết". Thỉnh thoảng app hỏi lại để kiểm tra. Cứ trả lời thật, không đoán.</p>
      <div class="card" style="min-height:240px"><div class="big han">${esc(w.h)}</div><div class="row" style="margin-top:auto"><button class="btn" id="pcNo">Không biết <span class="kbd">1</span></button><button class="btn primary" id="pcYes">Biết <span class="kbd">2</span></button></div></div>
      <button class="btn ghost sm" id="pcSkip">Dừng xếp lớp</button></div>`;
    const no=()=>{st.n++;PLC.i++;draw();};
    const yes=()=>{st.n++;if(st.n%3===0){const o=shuffle([w,...shuffle(W.filter(x=>x.lv===w.lv&&x.vi!==w.vi)).slice(0,3)]);
        el.querySelector('.card').innerHTML=`<div class="big han">${esc(w.h)}</div><p class="note">Kiểm tra nhanh: nghĩa là gì?</p><div class="opts" style="width:100%">${o.map((x,k)=>`<button class="opt" data-k="${k}">${esc(x.vi)}</button>`).join('')}</div>`;
        $$('[data-k]',el).forEach(b=>b.onclick=()=>{st.chk++;const ok=o[+b.dataset.k]===w;if(ok){st.ok++;st.yes++;mark(w);}PLC.i++;draw();});return;}
      st.yes++;mark(w);PLC.i++;draw();};
    const mark=w=>{const iv=7+Math.floor(Math.random()*14);P.srs[w.h]={iv,ef:2.5,n:2,l:0,due:today()+iv*DAY,s:2,first:Date.now(),pl:1};touch('srs');};
    $('#pcNo').onclick=no;$('#pcYes').onclick=yes;$('#pcSkip').onclick=end;
    document.onkeydown=e=>{if(current!=='placement'||!$('#pcYes'))return;if(e.key==='1')no();if(e.key==='2')yes();};
  };
  if(!PLC.items.length)start();else draw();
};

/* ---------- mistakes notebook ---------- */
function plMistList(){P.mist=P.mist||{};return Object.entries(P.mist).filter(([k,v])=>!v.ok||v.ok<2);}
window.__mistake=(type,x)=>{
  P.mist=P.mist||{};
  const key=type==='word'?'w:'+x:'q:'+(x.s||x.q||x.text||'').slice(0,60)+'|'+(Array.isArray(x.o)?x.o.join('/'):x.a);
  const e=P.mist[key]||{t:type,n:0,ok:0,x:type==='word'?x:JSON.parse(JSON.stringify(x))};
  e.n++;e.ok=0;e.last=Date.now();P.mist[key]=e;
  const keys=Object.keys(P.mist);if(keys.length>400){keys.sort((a,b)=>P.mist[a].last-P.mist[b].last).slice(0,keys.length-400).forEach(k=>delete P.mist[k]);}
  touch('main');
};
VIEWS.mistakes=el=>{
  const list=plMistList().sort((a,b)=>b[1].n-a[1].n);
  const words=list.filter(([k,v])=>v.t==='word'), qs=list.filter(([k,v])=>v.t==='q');
  el.innerHTML=`<div class="view"><div class="spread"><h2>Sổ lỗi sai</h2><span class="note">${list.length} mục</span></div>
   <p class="note">App tự ghi lại từ bạn bấm "Quên", từ nghe sai, câu sai trong thi thử và ngữ pháp. Mỗi mục trả lời đúng 2 lần liên tiếp thì tự rời sổ.</p>
   ${list.length?`<div class="row"><button class="btn primary" id="mkGo">Ôn 15 mục sai nhiều nhất</button></div>`:'<div class="empty">Chưa có lỗi nào. Học tiếp nhé.</div>'}
   ${words.length?`<div class="panel"><h3>Từ hay sai</h3><div class="pexs">${words.slice(0,60).map(([k,v])=>{const w=WI.get(v.x);return w?`<button class="pex" data-wd="${esc(w.h)}"><span class="han">${hanHTML(w)}</span> <span class="muted small">${esc(w.vi)}</span> <span class="pill">${v.n}</span></button>`:'';}).join('')}</div></div>`:''}
   ${qs.length?`<div class="panel"><h3>Câu hay sai</h3>${qs.slice(0,30).map(([k,v])=>`<div class="small" style="border-bottom:1px dashed var(--line);padding:6px 0"><span class="han">${esc(v.x.s||v.x.q||(v.x.audio?v.x.audio.map(a=>a[1]).join(' '):'')||'')}</span> <span class="pill">${v.n}</span><div class="muted">${esc(v.x.w||'')}</div></div>`).join('')}</div>`:''}</div>`;
  $$('[data-wd]',el).forEach(b=>b.onclick=()=>openWord(b.dataset.wd));
  const g=$('#mkGo');if(g)g.onclick=()=>{
    const pick15=list.slice(0,15); const keys=[];
    const items=pick15.map(([k,v])=>{keys.push(k);if(v.t==='q')return Object.assign({},v.x);const w=WI.get(v.x);if(!w)return null;
      const o=shuffle([w,...shuffle(W.filter(x=>x.lv===w.lv&&x.vi!==w.vi)).slice(0,3)]);return {k:'fill',s:w.h,o:o.map(x=>x.vi),a:o.indexOf(w),w:w.h+' ('+w.p.join(' ')+', '+w.hv+'): '+w.vi};}).filter(Boolean);
    plDay().mist=(plDay().mist||0)+1;touch('main');
    window.__mistReview=keys;
    runTest({id:'mist-'+Date.now(),title:'Ôn sổ lỗi',minutes:0,sections:[{type:'read',title:'Sổ lỗi',parts:[{instr:'Làm lại các câu đã sai',items}]}]},null);
  };
};

/* ---------- culture of the day ---------- */
let CUL=null;
async function culLoad(){if(!CUL){try{CUL=await (await fetch('data/culture.json')).json();}catch(e){CUL=[];}}return CUL;}
function culIndex(){const c=plCfg();return Math.max(0,Math.floor((today()-(c.start||today()))/DAY));}
function culCardHTML(){return `<div class="panel cul-card" id="culCard"><span class="label">Chuyện văn hóa hôm nay</span><div id="culBody" class="note">Đang tải...</div></div>`;}
async function culBind(){
  const b=$('#culBody');if(!b)return; const all=await culLoad(); if(!all.length){b.textContent='';return;}
  const x=all[culIndex()%all.length];
  b.className='';b.innerHTML=`<div class="spread"><span class="pill">${esc(x.cat)}</span><button class="btn sm" data-go2="culture">Xem tất cả</button></div>
    <h3 style="margin-top:6px">${esc(x.title)}</h3><div class="row"><span class="han" style="font-size:24px">${colorText(x.zh)}</span><span class="py">${esc(x.py)}</span>${x.hv?`<span class="muted small">${esc(x.hv)}</span>`:''}<button class="spk" data-say="${esc(x.zh)}" aria-label="Nghe">${SPK}</button></div>
    <p style="margin:6px 0">${esc(x.body)}</p>${x.ex?`<div class="small"><span class="han">${esc(x.ex[0])}</span><br><span class="py muted">${esc(x.ex[1])}</span><br><span class="muted">${esc(x.ex[2])}</span></div>`:''}
    <div id="culQ"></div>`;
  $$('[data-go2]',b).forEach(a=>a.onclick=()=>go(a.dataset.go2));
  culQuiz($('#culQ'),x);
}
function culQuiz(box,x){
  if(!x.q)return; P.cul=P.cul||{};
  const done=P.cul[x.id];
  box.innerHTML=`<div class="gq" style="margin-top:8px"><span class="label">Câu hỏi nhỏ</span><div>${esc(x.q.q)}</div><div class="opts">${x.q.o.map((o,k)=>`<button class="opt ${done&&k===x.q.a?'right':''}" data-k="${k}" ${done?'disabled':''}>${esc(o)}</button>`).join('')}</div>
    ${x.words&&x.words.length?`<div class="small">Từ liên quan: ${x.words.map(h=>WI.get(h)?`<button class="lnk han" data-wd="${esc(h)}">${esc(h)}</button>`:`<span class="han">${esc(h)}</span>`).join(' ')}</div>`:''}</div>`;
  $$('[data-wd]',box).forEach(b=>b.onclick=()=>openWord(b.dataset.wd));
  $$('[data-k]',box).forEach(b=>b.onclick=()=>{const k=+b.dataset.k;$$('[data-k]',box).forEach((y,i)=>{y.disabled=true;if(i===x.q.a)y.classList.add('right');else if(i===k)y.classList.add('wrong');});
    if(!P.cul[x.id]){P.cul[x.id]=k===x.q.a?2:1;award('culture',1);}});
}
VIEWS.culture=async el=>{
  el.innerHTML='<div class="view"><p class="note">Đang tải...</p></div>';
  const all=await culLoad(); const upto=Math.min(all.length,culIndex()+1+ (P.culExtra||0));
  const list=all.slice(0,upto).reverse(); const cats=[...new Set(all.map(x=>x.cat))];
  el.innerHTML=`<div class="view"><div class="spread"><h2>Văn hóa Trung Quốc</h2><span class="note">Đã mở ${upto}/${all.length} chuyện</span></div>
   <p class="note">Mỗi ngày mở thêm một chuyện. Muốn đọc thêm thì bấm "Mở thêm 1 chuyện" sau khi xong nhiệm vụ hôm nay.</p>
   <div class="row"><button class="btn sm" id="culMore" ${plDay().xp>=plGoalXP()?'':'disabled'}>Mở thêm 1 chuyện</button><span class="small muted">${plDay().xp>=plGoalXP()?'':'Đạt mục tiêu XP hôm nay để mở thêm.'}</span></div>
   <div class="cul-list">${list.map(x=>`<details class="g"><summary><span class="pill">${esc(x.cat)}</span><span class="t">${esc(x.title)}</span><span class="han">${esc(x.zh)}</span>${P.cul&&P.cul[x.id]?'<span class="check on">✓</span>':''}</summary><div class="body" data-cid="${x.id}"></div></details>`).join('')}</div></div>`;
  $$('.cul-list details',el).forEach(d=>d.addEventListener('toggle',()=>{if(!d.open)return;const b=$('.body',d);if(b.dataset.r)return;b.dataset.r=1;const x=all.find(y=>y.id===b.dataset.cid);
    b.innerHTML=`<div class="row"><span class="han" style="font-size:22px">${colorText(x.zh)}</span><span class="py">${esc(x.py)}</span>${x.hv?`<span class="muted small">${esc(x.hv)}</span>`:''}<button class="spk" data-say="${esc(x.zh)}" aria-label="Nghe">${SPK}</button></div><p style="margin:0">${esc(x.body)}</p>${x.ex?`<div class="small"><span class="han">${esc(x.ex[0])}</span><br><span class="py muted">${esc(x.ex[1])}</span><br><span class="muted">${esc(x.ex[2])}</span></div>`:''}<div class="cq"></div>`;culQuiz($('.cq',b),x);}));
  const m=$('#culMore');if(m)m.onclick=()=>{P.culExtra=(P.culExtra||0)+1;touch('main');VIEWS.culture(el);};
};

/* ---------- Hán Việt decomposition + auto-hide pinyin ---------- */
let DEC=null;
async function decLoad(){if(!DEC){try{DEC=await (await fetch('data/decomp.json')).json();}catch(e){DEC={};}}return DEC;}
async function decompHTML(h){
  const d=await decLoad(); const rows=[...h].filter(isHan).map(ch=>{const x=d[ch]; const w=WI.get(ch);
    const head=`<span class="han dc-ch">${esc(ch)}</span><span class="dc-hv">${esc(w?w.hv:'')}</span>`;
    if(!x)return `<div class="dc-row">${head}<span class="muted small">chữ đơn, không tách</span></div>`;
    return `<div class="dc-row">${head}<span class="dc-eq">=</span>${x.c.map(c=>`<span class="dc-part"><span class="han">${esc(c[0])}</span>${c[1]?`<span class="dc-phv">${esc(c[1])}</span>`:''}${c[2]?`<span class="small muted">${esc(c[2])}</span>`:''}</span>`).join('<span class="dc-plus">+</span>')}</div>`;});
  return `<div class="dc"><span class="label">Tách chữ theo Hán Việt</span>${rows.join('')}<p class="note">Thành phần đứng bên trái hoặc phía trên thường gợi nghĩa, thành phần còn lại thường gợi âm.</p></div>`;
}
const _plOpenWord=openWord;
openWord=function(h){_plOpenWord(h);const m=$('.modal');if(!m)return;const host=document.createElement('div');const ex=$('.ex',m);(ex||m.lastChild).after(host);decompHTML(h).then(x=>host.innerHTML=x);
  const row=$$('.row',m).pop();if(row){const b=document.createElement('button');b.className='btn sm';b.textContent='Báo lỗi';b.onclick=()=>reportForm(h);row.appendChild(b);}};
const _plDrawCard=drawCard;
drawCard=function(){
  const w=qcur, c=w&&P.srs[w.h];
  const hide=w&&!revealed&&P.settings.autoHide!==false&&P.settings.mode==='hz'&&c&&c.n>=2;
  const saved=P.settings.py; if(hide)P.settings.py=false;
  _plDrawCard(); P.settings.py=saved;
  if(hide){const big=$('#cardBox .big');if(big){const b=document.createElement('button');b.className='btn ghost sm';b.textContent='Hiện pinyin';b.onclick=()=>{b.outerHTML=`<div class="bigpy py">${pyHTML(w)}</div>`;};big.after(b);}}
  if(w&&revealed){const host=document.createElement('div');host.style.width='100%';$('#cardBox .card').appendChild(host);decompHTML(w.h).then(x=>host.innerHTML=x);}
};

/* ---------- error reports ---------- */
function reportForm(h){
  const m=modal(`<h2>Báo lỗi: <span class="han">${esc(h)}</span></h2><p class="note">Ghi chỗ sai (nghĩa, pinyin, Hán Việt, câu ví dụ, âm thanh...). Báo lỗi được lưu trong tiến độ của bạn. Gửi danh sách này trong chat để sửa theo đợt.</p>
    <textarea id="rpT" rows="3" placeholder="Ví dụ: nghĩa tiếng Việt nên là ..."></textarea><div class="row"><button class="btn primary" id="rpS">Lưu báo lỗi</button></div>`);
  $('#rpS',m.el).onclick=()=>{const t=$('#rpT',m.el).value.trim();if(!t)return;P.reports=P.reports||[];P.reports.push({h,t,d:Date.now()});touch('main');m.close();toast('Đã lưu. Xem lại ở Tôi -> Báo lỗi đã ghi.');};
}
function reportsList(){
  const r=P.reports||[];
  const txt=r.map(x=>`${x.h}: ${x.t}`).join('\n');
  const m=modal(`<h2>Báo lỗi đã ghi (${r.length})</h2>${r.length?`<textarea rows="10" readonly id="rpAll">${esc(txt)}</textarea><div class="row"><button class="btn primary" id="rpCp">Sao chép tất cả</button><button class="btn" id="rpClr">Xóa danh sách</button></div><p class="note">Dán danh sách này vào chat để sửa dữ liệu.</p>`:'<p class="note">Chưa có báo lỗi nào.</p>'}`);
  const cp=$('#rpCp',m.el);if(cp)cp.onclick=()=>{const ta=$('#rpAll',m.el);navigator.clipboard.writeText(txt).then(()=>toast('Đã sao chép.')).catch(()=>{ta.select();toast('Bấm Ctrl/Cmd+C để sao chép.');});};
  const cl=$('#rpClr',m.el);if(cl)cl.onclick=()=>{cl.outerHTML='<span class="small">Xóa hết?</span> <button class="btn sm" id="rpY">Xóa</button>';$('#rpY',m.el).onclick=()=>{P.reports=[];touch('main');m.close();};};
}
window.__reportsList=reportsList;

window.__mistOk=x=>{P.mist=P.mist||{};const keys=['q:'+(x.s||x.q||x.text||'').slice(0,60)+'|'+(Array.isArray(x.o)?x.o.join('/'):x.a),'w:'+(x.s||'')];
  keys.forEach(k=>{const e=P.mist[k];if(e){e.ok=(e.ok||0)+1;if(e.ok>=2)delete P.mist[k];}});};
