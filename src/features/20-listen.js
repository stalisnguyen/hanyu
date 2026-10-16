/* ================= LISTEN: passages sentence by sentence, daily AI dialogue ================= */
function lpSplit(text){return text.split(/(?<=[。！？!?；])/).map(x=>x.trim()).filter(Boolean);}
async function lpPassage(box){
  if(!RD)RD=await (await fetch('data/reading.json')).json();
  const list=RD.filter(r=>r.lv===LS.lv);
  if(!LS.pid||!list.find(r=>r.id===LS.pid))LS.pid=list[0]&&list[0].id;
  const r=RD.find(x=>x.id===LS.pid); if(!r){box.innerHTML='<p class="note">Chưa có bài ở cấp này.</p>';return;}
  const sents=[];r.paras.forEach(p=>lpSplit(p[0]).forEach(t=>sents.push(t)));
  const st={shown:new Set(),playing:false};
  const draw=()=>{
    box.innerHTML=`<div class="spread"><select id="lpSel">${list.map(x=>`<option value="${x.id}" ${x.id===r.id?'selected':''}>${esc(x.title)} - ${esc(x.tvi)}</option>`).join('')}</select>
      <div class="row"><button class="btn primary sm" id="lpAll">${st.playing?'<svg class="i"><use href="#i-square"/></svg> Dừng':'<svg class="i"><use href="#i-play"/></svg> Nghe cả bài'}</button><button class="btn sm" id="lpShow">Hiện hết chữ</button></div></div>
      <p class="note">Nghe từng câu, cố hiểu trước khi bấm "Hiện". Nghe được ý chính rồi mới xem chữ. Xong thì qua tab Đọc làm câu hỏi của bài này.</p>
      <div class="lp-list">${sents.map((t,i)=>`<div class="lp-s"><button class="spk" data-i="${i}" aria-label="Nghe câu ${i+1}">${SPK}</button><span class="num muted small">${i+1}</span>${st.shown.has(i)?`<span class="han lp-t">${P.settings.py?rubyHTML(t):colorText(t)}</span>`:`<button class="btn ghost sm" data-show="${i}">Hiện</button>`}</div>`).join('')}</div>
      <div class="row"><button class="btn sm" id="lpRead">Làm câu hỏi bài này</button></div>`;
    $('#lpSel').onchange=e=>{LS.pid=e.target.value;stopSay();lpPassage(box);};
    $$('[data-i]',box).forEach(b=>b.onclick=()=>say(sents[+b.dataset.i]));
    $$('[data-show]',box).forEach(b=>b.onclick=()=>{st.shown.add(+b.dataset.show);draw();});
    $('#lpShow').onclick=()=>{sents.forEach((_,i)=>st.shown.add(i));draw();};
    $('#lpRead').onclick=()=>{rdLv=r.lv;rdOpen=r.id;go('read');};
    $('#lpAll').onclick=async()=>{if(st.playing){st.playing=false;stopSay();draw();return;}st.playing=true;draw();
      for(let i=0;i<sents.length&&st.playing;i++){const b=$(`[data-i="${i}"]`,box);if(b)b.classList.add('lp-on');await say(sents[i]);if(b)b.classList.remove('lp-on');await new Promise(z=>setTimeout(z,300));}
      if(st.playing)window.__award&&window.__award('listen',5);st.playing=false;draw();};
  };
  draw();
}
async function lpDaily(box){
  if(!AI){box.innerHTML='<p class="note">Phần này cần trợ lý AI. Vào Tôi, mục Cài đặt, để mở khóa bằng mật khẩu của app.</p>';return;}
  P.dlg=P.dlg||{}; const key=ymd(Date.now())+'-'+LS.lv;
  const show=d=>{
    let shown=false;
    const draw=()=>{
      box.innerHTML=`<div class="spread"><h3>${esc(d.title||'Hội thoại hôm nay')}</h3><div class="row"><button class="btn primary sm" id="ldPlay"><svg class="i"><use href="#i-play"/></svg> Nghe</button><button class="btn sm" id="ldSlow">Nghe chậm</button><button class="btn sm" id="ldShow">${shown?'Ẩn chữ':'Hiện chữ'}</button><button class="btn ghost sm" id="ldNew">Bài khác</button></div></div>
        <p class="note">Hội thoại do AI soạn từ những từ bạn đang học. Nghe 2 lần rồi trả lời câu hỏi, sau đó mới hiện chữ.</p>
        ${shown?`<div class="audio-lines han">${d.lines.map(l=>`<div><b>${esc(l[0])}：</b>${P.settings.py?rubyHTML(l[1]):colorText(l[1])}<div class="small muted">${esc(l[2]||'')}</div></div>`).join('')}</div>`:''}
        <div class="ld-q">${(d.q||[]).map((q,i)=>`<div class="q" id="ldq${i}"><div class="han stmt">${i+1}. ${esc(q.q)}</div><div class="opts">${q.o.map((o,k)=>`<button class="opt han" data-q="${i}" data-k="${k}">${esc(o)}</button>`).join('')}</div><div class="w" hidden></div></div>`).join('')}</div>`;
      const lines=d.lines.map(l=>[l[0]==='男'||/男|先生|哥|爸|王/.test(l[0])?'男':'女',l[1]]);
      $('#ldPlay').onclick=()=>sayLines(lines);
      $('#ldSlow').onclick=async()=>{stopSay();for(const [sp,t] of lines){await say(t,{rate:0.55,alt:sp==='男'});}};
      $('#ldShow').onclick=()=>{shown=!shown;draw();};
      $('#ldNew').onclick=()=>{delete P.dlg[key];touch('main');lpDaily(box);};
      $$('[data-q]',box).forEach(b=>b.onclick=()=>{const i=+b.dataset.q,k=+b.dataset.k,q=d.q[i],qb=$('#ldq'+i);if(qb.dataset.done)return;qb.dataset.done=1;
        $$(`[data-q="${i}"]`,qb).forEach((y,j)=>{y.disabled=true;if(j===q.a)y.classList.add('right');else if(j===k)y.classList.add('wrong');});const w=$('.w',qb);w.hidden=false;w.textContent=q.w||'';
        window.__award&&window.__award('listen',3);if(k!==q.a)window.__mistake&&window.__mistake('q',{k:'lc',audio:lines,q:q.q,o:q.o,a:q.a,w:q.w});});
    };
    draw();
  };
  if(P.dlg[key]){show(P.dlg[key]);return;}
  box.innerHTML='<p class="note">AI đang soạn hội thoại hôm nay...</p>';
  const learning=W.filter(w=>P.srs[w.h]&&w.lv<=LS.lv).sort((a,b)=>(P.srs[b.h].first||0)-(P.srs[a.h].first||0)).slice(0,25).map(w=>w.h);
  const extra=learning.length<8?shuffle(W.filter(w=>w.lv===LS.lv)).slice(0,15).map(w=>w.h):[];
  try{
    const d=await askJSON(`Soạn một đoạn hội thoại tiếng Trung giản thể tự nhiên giữa hai người (một nam, một nữ) cho người Việt học HSK ${lvN(LS.lv)}. Dùng nhiều nhất có thể các từ: ${learning.concat(extra).join('、')}. Chỉ dùng từ vựng trong phạm vi HSK ${lvN(LS.lv)}. Độ dài: ${LS.lv<=2?'6-8':LS.lv<=4?'8-10':'10-12'} lượt nói. Tình huống đời thường, có chút hài hước hoặc bất ngờ.
Trả DUY NHẤT JSON: {"title":"tiêu đề tiếng Việt ngắn","lines":[["男 hoặc 女","câu tiếng Trung","dịch tiếng Việt"]],"q":[{"q":"câu hỏi nghe hiểu tiếng Trung","o":["A","B","C","D"],"a":0,"w":"giải thích tiếng Việt ngắn"}]}
Có 3 câu hỏi, đáp án phân bố đều. Không dùng gạch ngang dài.`,{modelTier:'default'});
    if(!d||!Array.isArray(d.lines))throw {code:'bad_json'};
    P.dlg={};P.dlg[key]=d;touch('main');show(d);
  }catch(e){box.innerHTML=`<p class="note">${esc(aiError(e))}</p><button class="btn sm" id="ldRetry">Thử lại</button>`;$('#ldRetry').onclick=()=>lpDaily(box);}
}
