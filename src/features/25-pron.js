/* ================= PINYIN: reading rules (sandhi, neutral tone, erhua, 啊, spelling, polyphones, stress) ================= */
let PRON=null, PRON_SEC='sandhi';
async function pronRender(box){
  if(!box)return;
  if(!PRON){box.innerHTML='<p class="note">Đang tải...</p>';PRON=await (await fetch('data/pron-rules.json')).json();}
  const secs=PRON.sections;
  const draw=()=>{
    const sec=secs.find(x=>x.id===PRON_SEC)||secs[0];
    box.innerHTML=`<p class="note">Pinyin trong từ điển ghi thanh gốc của từng chữ. Khi nói, nhiều chữ đổi thanh hoặc đọc nhẹ đi. Cột "Viết" là cách ghi trong sách, cột "Đọc" là cách người bản xứ thật sự nói. Bấm vào ví dụ để nghe.</p>
      <div class="row">${secs.map(x=>`<button class="chip" data-sec="${x.id}" aria-pressed="${x.id===sec.id}">${esc(x.title)} <span class="muted">${x.rules.length}</span></button>`).join('')}<button class="chip" data-sec="quiz" aria-pressed="${PRON_SEC==='quiz'}">Luyện tập ${PRON.quiz.length} câu</button></div>
      ${PRON_SEC==='quiz'?pronQuizHTML():`<p>${esc(sec.intro||'')}</p>${sec.id==='poly'?'<input type="search" id="prQ" placeholder="Tìm chữ đa âm, ví dụ 行 hoặc 长">':''}
      <div class="pr-list">${sec.rules.map((r,i)=>pronRuleHTML(r,i)).join('')}</div>`}`;
    $$('[data-sec]',box).forEach(b=>b.onclick=()=>{PRON_SEC=b.dataset.sec;draw();});
    const q=$('#prQ',box);if(q)q.oninput=()=>{const v=q.value.trim();$$('.pr-rule',box).forEach(el=>el.hidden=!!v&&!el.textContent.includes(v));};
    if(PRON_SEC==='quiz')pronQuizBind(box);
  };
  draw();
}
function pronRuleHTML(r,i){
  const diff=(a,b)=>a.replace(/\s+/g,'')!==b.replace(/\s+/g,'');
  return `<div class="panel pr-rule"><h3>${esc(r.t)}</h3><div>${esc(r.d)}</div>
    ${r.ex&&r.ex.length?`<div class="pr-ex-wrap"><table class="pr-ex"><thead><tr><th>Chữ</th><th>Viết</th><th>Đọc</th><th>Nghĩa</th></tr></thead><tbody>${r.ex.map(e=>`<tr><td><button class="lnk han" data-say="${esc(e[0])}">${esc(e[0])}</button></td><td class="py">${sentPyHTML(e[1])}</td><td class="py ${diff(e[1],e[2])?'pr-chg':''}">${sentPyHTML(e[2])}</td><td class="small">${esc(e[3]||'')}</td></tr>`).join('')}</tbody></table></div>`:''}
    ${r.warn?`<div class="vn"><b>Hay sai:</b> ${esc(r.warn)}</div>`:''}</div>`;
}
let PRQ=null;
function pronQuizHTML(){
  if(!PRQ)PRQ={items:shuffle(PRON.quiz).slice(0,10),i:0,ok:0};
  const it=PRQ.items[PRQ.i];
  if(!it)return `<div class="panel done"><div class="big num">${PRQ.ok}/${PRQ.items.length}</div><p>câu đúng</p><button class="btn primary" id="prAgain">Làm 10 câu khác</button></div>`;
  return `<div class="panel"><div class="spread"><span class="label">Câu ${PRQ.i+1}/${PRQ.items.length}</span><span class="small muted num">Đúng: ${PRQ.ok}</span></div>
    <div class="row"><span class="han" style="font-size:30px">${esc(it.zh)}</span><span class="py muted">Viết: ${esc(it.written)}</span><button class="spk" data-say="${esc(it.zh)}" aria-label="Nghe">${SPK}</button></div>
    <div class="note">Người bản xứ thực tế đọc thế nào?</div>
    <div class="opts">${it.o.map((o,k)=>`<button class="opt py" data-pk="${k}">${esc(o)}</button>`).join('')}</div><div id="prW"></div></div>`;
}
function pronQuizBind(box){
  const again=$('#prAgain',box);if(again)again.onclick=()=>{PRQ=null;pronRender(box);};
  const it=PRQ&&PRQ.items[PRQ.i];if(!it)return;
  $$('[data-pk]',box).forEach(b=>b.onclick=()=>{if(it.done)return;it.done=1;const k=+b.dataset.pk;
    $$('[data-pk]',box).forEach((y,j)=>{y.disabled=true;if(j===it.a)y.classList.add('right');else if(j===k)y.classList.add('wrong');});
    if(k===it.a)PRQ.ok++;else window.__mistake&&window.__mistake('q',{k:'fill',s:it.zh+' ('+it.written+')',o:it.o,a:it.a,w:it.w});
    window.__award&&window.__award('grammar',0.3);speak(it.zh);
    $('#prW',box).innerHTML=`<div class="w" style="margin-top:8px">${esc(it.w)}</div><button class="btn primary sm" id="prNext" style="margin-top:8px">Câu tiếp</button>`;
    $('#prNext',box).onclick=()=>{PRQ.i++;pronRender(box);};});
}
