/* ================= PITCH TRAINER =================
   Luyện thanh điệu bằng biểu đồ: đường cao độ của bản ghi gốc và của người học vẽ chồng lên nhau.
   F0: YIN trên khung 40ms, bước 10ms, 70-450 Hz, sau khi hạ mẫu xuống ~16 kHz.
   Cao độ đổi ra nửa cung so với F0 trung vị của người nói, nên giọng nam và nữ so được với nhau. */
const PT_K=20, PT_YMAX=8;
let PT={tab:'ma',base:'ma',pair:null,q:'',item:null,ref:null,refBuf:null,refNote:'',rec:null,recBuf:null,fb:null,recording:false,micMsg:'',status:'',tok:0};
let PT_AC=null, PT_POOL=null;
function PT_ctx(){if(!PT_AC){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;PT_AC=new C();}return PT_AC;}

/* ---------- pitch detection ---------- */
function PT_mono(buf){
  const n=buf.length,ch=buf.numberOfChannels,x=new Float32Array(n);
  for(let c=0;c<ch;c++){const d=buf.getChannelData(c);for(let i=0;i<n;i++)x[i]+=d[i]/ch;}
  return x;
}
function PT_down(x,sr){ // box low-pass + decimate to about 16 kHz
  const f=Math.max(1,Math.round(sr/16000));if(f===1)return {x,sr};
  const m=Math.floor(x.length/f),y=new Float32Array(m);
  for(let i=0;i<m;i++){let s=0;for(let j=0;j<f;j++)s+=x[i*f+j];y[i]=s/f;}
  return {x:y,sr:sr/f};
}
function PT_yin(x,sr){ // returns [{f0,rms,clar}] per 10ms frame
  const N=Math.round(sr*0.04),hop=Math.round(sr*0.01),tMin=Math.max(2,Math.floor(sr/450)),tMax=Math.ceil(sr/70),Wn=N-tMax-1;
  const d=new Float32Array(tMax+2),out=[];
  for(let s=0;s+N<=x.length;s+=hop){
    let e=0;for(let j=0;j<N;j++)e+=x[s+j]*x[s+j];const rms=Math.sqrt(e/N);
    if(rms<1e-4){out.push({f0:0,rms,clar:0});continue;}
    let run=0;d[0]=1;
    for(let tau=1;tau<=tMax+1;tau++){let v=0;for(let j=0;j<Wn;j++){const q=x[s+j]-x[s+j+tau];v+=q*q;}run+=v;d[tau]=run>0?v*tau/run:1;}
    let best=-1;
    for(let tau=tMin;tau<=tMax;tau++){if(d[tau]<0.15){while(tau+1<=tMax&&d[tau+1]<d[tau])tau++;best=tau;break;}}
    if(best<0){let mv=9;for(let tau=tMin;tau<=tMax;tau++)if(d[tau]<mv){mv=d[tau];best=tau;}}
    let t=best;if(best>tMin&&best<tMax){const a=d[best-1],b=d[best],c=d[best+1],den=a-2*b+c;if(Math.abs(den)>1e-9)t=best+0.5*(a-c)/den;}
    out.push({f0:sr/t,rms,clar:1-d[best]});
  }
  return out;
}
const PT_med=a=>{const s=a.slice().sort((p,q)=>p-q),n=s.length;return n?(n%2?s[n>>1]:(s[n/2-1]+s[n/2])/2):0;};
function PT_track(buf){ // -> {hz:[f0|null], med}
  const {x,sr}=PT_down(PT_mono(buf),buf.sampleRate);
  const fr=PT_yin(x,sr); if(!fr.length)return {hz:[],med:0};
  const maxR=Math.max(...fr.map(f=>f.rms));
  let hz=fr.map(f=>(f.rms>Math.max(0.004,0.06*maxR)&&f.clar>0.5&&f.f0>=70&&f.f0<=450)?f.f0:null);
  // drop voiced islands shorter than 40ms
  for(let i=0;i<hz.length;){if(hz[i]==null){i++;continue;}let j=i;while(j<hz.length&&hz[j]!=null)j++;if(j-i<4)for(let k=i;k<j;k++)hz[k]=null;i=j;}
  // octave errors against the global median
  let med=PT_med(hz.filter(v=>v!=null));
  if(med){hz=hz.map(v=>{if(v==null)return v;let r=v/med;if(r>1.8&&v/2>=70)v/=2;else if(r<0.56&&v*2<=450)v*=2;r=v/med;return (r>2.2||r<0.45)?null:v;});}
  // 5-point median smoothing inside voiced runs
  const sm=hz.map((v,i)=>{if(v==null)return null;const w=[];for(let k=i-2;k<=i+2;k++)if(hz[k]!=null)w.push(hz[k]);return PT_med(w);});
  med=PT_med(sm.filter(v=>v!=null));
  return {hz:sm,med,rms:fr.map(f=>f.rms),maxR};
}
function PT_analyze(buf,nSyl){ // -> {st:[semitone|null] over the speech region, segs:[[a,b]], med, voiced}
  const {hz,med,rms,maxR}=PT_track(buf);
  if(!med)return {st:[],segs:[],med:0,voiced:0};
  // voiced runs, grouped into clusters split by gaps > 200ms; keep the strongest cluster
  const runs=[];for(let i=0;i<hz.length;){if(hz[i]==null){i++;continue;}let j=i;while(j<hz.length&&hz[j]!=null)j++;runs.push([i,j-1]);i=j;}
  const cl=[];for(const r of runs){const c=cl[cl.length-1];if(c&&r[0]-c.b<=20){c.b=r[1];c.n+=r[1]-r[0]+1;}else cl.push({a:r[0],b:r[1],n:r[1]-r[0]+1});}
  const c=cl.sort((p,q)=>q.n-p.n)[0];
  let a=c.a,b=c.b; // trim weak onset (nasal/consonant glide) and fading offset frames
  while(b-a>10&&(hz[a]==null||rms[a]<0.3*maxR))a++;
  while(b-a>10&&(hz[b]==null||rms[b]<0.12*maxR))b--;
  const vals=hz.slice(a,b+1).filter(v=>v!=null),m2=PT_med(vals);
  const st=hz.slice(a,b+1).map(v=>v==null?null:12*Math.log2(v/m2));
  const L=st.length;let segs=[[0,L-1]];
  if(nSyl===2){
    // split at the longest unvoiced gap near the middle, else in two equal parts
    let cut=-1,glen=0;
    for(let i=0;i<L;){if(st[i]!=null){i++;continue;}let j=i;while(j<L&&st[j]==null)j++;const mid=(i+j-1)/2;if(mid>L*0.25&&mid<L*0.75&&j-i>=2&&j-i>glen){glen=j-i;cut=[i,j-1];}i=j;}
    segs=cut!==-1?[[0,cut[0]-1],[cut[1]+1,L-1]]:[[0,(L>>1)-1],[L>>1,L-1]];
  }
  return {st,segs,med:m2,voiced:vals.length};
}
function PT_resample(st,[a,b]){ // K points over the segment, interpolating across gaps
  const ix=[],vs=[];for(let i=a;i<=b;i++)if(st[i]!=null){ix.push(i);vs.push(st[i]);}
  if(ix.length<3)return null;
  const out=[];
  for(let k=0;k<PT_K;k++){const p=ix[0]+(ix[ix.length-1]-ix[0])*k/(PT_K-1);let j=0;while(j<ix.length-2&&ix[j+1]<p)j++;const t=ix[j+1]===ix[j]?0:(p-ix[j])/(ix[j+1]-ix[j]);out.push(vs[j]+(vs[j+1]-vs[j])*Math.max(0,Math.min(1,t)));}
  return out;
}

/* ---------- ideal tone shapes (Chao numbers) and sandhi ---------- */
function PT_eff(item){ // effective tones + notes
  const t=item.t.slice(),ch=[...item.h],note=[];
  if(t.length===2){
    if(ch[0]==='不'&&t[0]===4&&t[1]===4){t[0]=2;note[0]='不 trước thanh 4 đọc thành bú (thanh 2).';}
    else if(ch[0]==='一'&&t[0]===1&&t[1]!==5){if(t[1]===4){t[0]=2;note[0]='一 trước thanh 4 đọc thành yí (thanh 2).';}else{t[0]=4;note[0]='一 trước thanh 1, 2, 3 đọc thành yì (thanh 4).';}}
    else if(t[0]===3&&t[1]===3){t[0]=2;note[0]='Hai thanh 3 đi liền: âm đầu đọc thành thanh 2.';}
  }
  const half=t.map((x,i)=>x===3&&i<t.length-1);
  half.forEach((h,i)=>{if(h&&!note[i])note[i]='Thanh 3 đứng trước âm khác thường chỉ đọc nửa đầu: xuống thấp rồi dừng.';});
  return {t,half,note};
}
function PT_shape(tone,half,prev){
  if(tone===1)return [[0,5],[1,5]];
  if(tone===2)return [[0,3],[0.3,2.8],[1,5]];
  if(tone===3)return half?[[0,2],[0.7,1],[1,1]]:[[0,2],[0.5,1],[1,4]];
  if(tone===4)return [[0,5],[1,1]];
  const L={1:2,2:3,3:4,4:1}[prev]||3;return [[0,L],[1,L-0.3]];
}
function PT_ideal(item){ // per syllable K points in semitones, centred on the word mean
  const e=PT_eff(item);
  const segs=e.t.map((tone,i)=>{const s=PT_shape(tone,e.half[i],e.t[i-1]);const o=[];
    for(let k=0;k<PT_K;k++){const p=k/(PT_K-1);let j=0;while(j<s.length-2&&s[j+1][0]<p)j++;const u=(p-s[j][0])/(s[j+1][0]-s[j][0]);o.push(((s[j][1]+(s[j+1][1]-s[j][1])*Math.max(0,Math.min(1,u)))-3)*3);}return o;});
  const all=segs.flat(),m=all.reduce((p,q)=>p+q,0)/all.length;
  return {segs:segs.map(s=>s.map(v=>v-m)),eff:e};
}
function PT_align(an,nSyl){ // resampled segments + offset that puts the contour mean at 0 (ideal mean)
  if(!an||!an.st.length)return null;
  const rs=an.segs.slice(0,nSyl).map(sg=>PT_resample(an.st,sg));
  const all=rs.filter(Boolean).flat();if(!all.length)return null;
  const off=-all.reduce((p,q)=>p+q,0)/all.length;
  return {rs:rs.map(r=>r&&r.map(v=>v+off)),off};
}
const PT_rmse=(a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length);
const PT_score=r=>Math.round(100*Math.max(0,Math.min(1,1-(r-1)/6)));

/* ---------- feedback ---------- */
function PT_tip(L,I,tone,orig,half,two){
  const avg=(a,i,j)=>{let s=0;for(let k=i;k<j;k++)s+=a[k];return s/(j-i);};
  const st=avg(L,0,3),en=avg(L,PT_K-3,PT_K),mn=Math.min(...L),mx=Math.max(...L),mp=L.indexOf(mn)/(PT_K-1),sl=en-st,rg=mx-mn;
  const iMn=Math.min(...I),iAvg=avg(I,0,PT_K),lAvg=avg(L,0,PT_K);
  if(tone===2&&orig===3&&st-mn>2&&mp>0.25&&mp<0.85)return 'Hai thanh 3 đi liền: âm đầu đọc thành thanh 2, đi thẳng lên, không cần xuống thấp.';
  if(tone===1){
    if(two&&lAvg<iAvg-2.5)return 'Thanh 1 chưa đủ cao so với âm còn lại. Đặt giọng cao hơn ngay từ đầu.';
    if(sl<-2)return 'Thanh 1 bị rơi xuống ở cuối. Giữ giọng cao và đều đến hết âm.';
    if(sl>2)return 'Thanh 1 đang đi lên. Bắt đầu ngay ở độ cao cuối và giữ nguyên.';
    if(rg>3)return 'Thanh 1 chưa đủ cao và đều. Giữ một nốt như khi hát.';
  }
  if(tone===2){
    if(sl<3)return 'Thanh 2 chưa lên đủ. Kéo giọng từ giữa lên cao, như khi hỏi lại "Hả?".';
    if(mx-en>2)return 'Cuối thanh 2 bị rơi xuống. Giữ hướng đi lên đến hết âm.';
    if(st-mn>2.5&&mp>0.5)return 'Thanh 2 xuống thấp quá lâu nên nghe giống thanh 3. Đi lên sớm hơn.';
  }
  if(tone===3){
    if(mn>iMn+2.5||st-mn<1.5)return 'Thanh 3 của bạn chưa xuống đủ thấp. Hạ giọng thật trầm, gần như giọng khàn.';
    if(half&&en-mn>3)return 'Thanh 3 đứng trước âm khác chỉ cần nửa đầu: xuống thấp rồi dừng, không cần lên lại.';
    if(!half&&en-mn<2)return 'Khi đọc riêng, thanh 3 lên lại ở cuối. Thêm phần đi lên nhẹ sau điểm thấp nhất.';
  }
  if(tone===4){
    if(sl>-5)return 'Thanh 4 rơi chưa đủ mạnh. Bắt đầu cao rồi rơi thẳng xuống, dứt khoát như khi ra lệnh.';
    if(two&&st<I[0]-3)return 'Thanh 4 bắt đầu hơi thấp nên nghe giống thanh huyền. Bắt đầu cao hơn.';
  }
  if(tone===5&&rg>5)return 'Thanh nhẹ đang lên xuống rõ. Đọc ngắn và nhẹ hơn, không nhấn.';
  return null;
}
const PT_GOOD=['Rất tốt, đường cao độ gần với dạng chuẩn.','Tốt lắm. Giữ cảm giác này và thử nói nhanh hơn một chút.','Chuẩn rồi. Thử thêm vài lần để nhớ cảm giác.'];
function PT_feedback(){
  const it=PT.item,n=it.t.length,id=PT_ideal(it),me=PT_align(PT.rec,n),rf=PT_align(PT.ref,n);
  if(!me)return null;
  return it.t.map((orig,i)=>{
    const L=me.rs[i],I=id.segs[i],tone=id.eff.t[i];
    const sy={py:it.py[i],tone,orig,note:id.eff.note[i]};
    if(!L)return Object.assign(sy,{score:null,tip:'Chưa bắt được giọng ở âm này. Nói to và kéo dài âm hơn một chút.'});
    const sI=PT_score(PT_rmse(L,I)),R=rf&&rf.rs[i],sR=R?PT_score(PT_rmse(L,R)):null;
    const score=sR==null?sI:Math.round((sI+sR)/2);
    let tip=PT_tip(L,I,tone,orig,id.eff.half[i],n>1);
    if(!tip)tip=score>=75?PT_GOOD[(i+score)%PT_GOOD.length]:(tone===5?'Thanh nhẹ: đọc ngắn và nhẹ, cao độ theo âm đứng trước.':'Hình dáng gần đúng. Nghe mẫu thêm một lần rồi bắt chước độ cao lúc đầu và lúc cuối.');
    return Object.assign(sy,{score,sI,sR,tip});
  });
}

/* ---------- items, pools, reference ---------- */
const PT_TM={a:'āáǎà',e:'ēéěè',i:'īíǐì',o:'ōóǒò',u:'ūúǔù',v:'ǖǘǚǜ'};
function PT_mark(base,t){ // ma+3 -> mǎ
  if(t<1||t>4)return base.replace(/v/g,'ü');
  let i=base.search(/[ae]/);if(i<0)i=base.indexOf('ou');if(i<0){for(let k=base.length-1;k>=0;k--)if('iouv'.includes(base[k])){i=k;break;}}
  if(i<0)return base;return (base.slice(0,i)+PT_TM[base[i]][t-1]+base.slice(i+1)).replace(/v/g,'ü');
}
const PT_BASES=[...new Set(DRILL.map(d=>stripTone(d[1])))];
function PT_sylItem(base,t){const d=DRILL.find(x=>stripTone(x[1])===base&&x[2]===t);return {kind:'s',h:d?d[0]:'',py:[d?d[1]:PT_mark(base,t)],t:[t],key:base+t};}
function PT_wordItem(w){return {kind:'w',h:w.h,py:w.p.slice(),t:w.p.map(toneOf),key:hexOf(w.h),lv:w.lv};}
const PT_ok=w=>w.p.length>=1&&w.p.length<=2&&[...w.h].length===w.p.length;
async function PT_pool(){
  if(PT_POOL)return PT_POOL;const idx=await audioIndex();
  PT_POOL=W.filter(w=>PT_ok(w)&&idx.w.has(hexOf(w.h)));return PT_POOL;
}
async function PT_pairWord(a,b){
  const pool=(await PT_pool()).filter(w=>w.p.length===2&&toneOf(w.p[0])===a&&toneOf(w.p[1])===b);
  const lv=P.settings.lv;let cand=pool.filter(w=>lv.includes(w.lv));
  if(!cand.length)cand=pool.filter(w=>w.lv<=Math.max(...lv)+1);if(!cand.length)cand=pool;
  if(PT.item&&cand.length>1)cand=cand.filter(w=>w.h!==PT.item.h);
  return cand.length?pick(cand):null;
}
async function PT_loadRef(){
  const it=PT.item,tok=++PT.tok;PT.ref=null;PT.refBuf=null;PT.refNote='Đang tải bản ghi mẫu...';PT_drawChart();
  try{
    const idx=await audioIndex();let url=null;
    if(it.kind==='s'&&idx.s.has(it.key))url=await audioURL('s',it.key);
    if(it.kind==='w'&&idx.w.has(it.key))url=await audioURL('w',it.key,it.lv);
    if(!url){if(tok===PT.tok){PT.refNote='Mục này chưa có bản ghi âm gốc, nên chỉ so với dạng thanh chuẩn.';PT_drawChart();}return;}
    const ab=await (await fetch(url)).arrayBuffer();const ctx=PT_ctx();
    const buf=await new Promise((res,rej)=>{const p=ctx.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej);});
    if(tok!==PT.tok)return;
    PT.refBuf=buf;PT.ref=PT_analyze(buf,it.t.length);PT.refNote=PT.ref.voiced?'':'Không đọc được cao độ của bản mẫu.';
  }catch(e){if(tok===PT.tok)PT.refNote='Không tải được bản ghi mẫu.';}
  if(tok===PT.tok){if(PT.rec)PT.fb=PT_feedback();PT_drawChart();PT_drawFb();}
}
function PT_select(it){PT.item=it;PT.rec=null;PT.recBuf=null;PT.fb=null;PT.status='';PT_drawItem();PT_drawFb();PT_loadRef();}

/* ---------- recording ---------- */
function PT_micFail(e){
  const n=e&&e.name;
  if(IN_ARTIFACT||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!PT_ctx())PT.micMsg='Ở đây trình duyệt không cho dùng micro. Phần thu giọng chạy trên trang hanyu-ecru.vercel.app bằng Chrome, Edge hoặc Safari. Bạn vẫn nghe mẫu và xem đường cao độ của bản mẫu được.';
  else if(n==='NotAllowedError'||n==='SecurityError')PT.micMsg='Bạn chưa cho phép dùng micro. Bấm biểu tượng ổ khóa cạnh thanh địa chỉ, bật micro cho trang này rồi thử lại. Nếu vẫn không được, mở trang hanyu-ecru.vercel.app bằng Chrome, Edge hoặc Safari.';
  else if(n==='NotFoundError')PT.micMsg='Không tìm thấy micro trên máy. Cắm tai nghe có micro hoặc dùng điện thoại rồi thử lại.';
  else PT.micMsg='Không mở được micro. Phần thu giọng chạy trên trang hanyu-ecru.vercel.app bằng Chrome, Edge hoặc Safari.';
  PT.recording=false;PT_drawItem();
}
let PT_R=null;
async function PT_record(){
  if(PT.recording){PT_stop();return;}
  if(!PT.item)return;
  const ctx=PT_ctx();
  if(!ctx||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){PT_micFail();return;}
  stopSay();let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}catch(e){PT_micFail(e);return;}
  try{await ctx.resume();}catch(e){}
  const src=ctx.createMediaStreamSource(stream),proc=ctx.createScriptProcessor(2048,1,1),mute=ctx.createGain();mute.gain.value=0;
  src.connect(proc);proc.connect(mute);mute.connect(ctx.destination);
  const sr=ctx.sampleRate,blk=2048/sr;
  PT_R={stream,src,proc,mute,chunks:[],t:0,floor:[],speech:0,sil:0,heard:false,sr};
  proc.onaudioprocess=ev=>{
    const R=PT_R;if(!R||R.proc!==proc)return;
    const x=ev.inputBuffer.getChannelData(0);R.chunks.push(new Float32Array(x));R.t+=blk;
    let e=0;for(let i=0;i<x.length;i++)e+=x[i]*x[i];const rms=Math.sqrt(e/x.length);
    if(R.t<0.2){R.floor.push(rms);}
    else{const fl=R.floor.length?PT_med(R.floor):0,th=Math.max(0.01,fl*3);
      if(rms>th){R.speech++;R.sil=0;if(R.speech>=2)R.heard=true;}else if(R.heard)R.sil+=blk;
      if(R.heard&&R.sil>0.55){PT_stop();return;}}
    const bar=$('#ptBar');if(bar)bar.style.width=Math.min(100,R.t/3*100)+'%';
    if(R.t>=3)PT_stop();
  };
  PT.recording=true;PT.micMsg='';PT.status='Đang thu. Nói ngay bây giờ, máy tự dừng khi bạn im lặng.';PT_drawItem();
}
function PT_stop(){
  const R=PT_R;if(!R)return;PT_R=null;
  try{R.proc.onaudioprocess=null;R.src.disconnect();R.proc.disconnect();R.mute.disconnect();}catch(e){}
  R.stream.getTracks().forEach(t=>t.stop());PT.recording=false;
  const n=R.chunks.reduce((s,c)=>s+c.length,0);
  if(!n){PT.status='';PT_drawItem();return;}
  const buf=PT_ctx().createBuffer(1,n,R.sr),d=buf.getChannelData(0);let o=0;for(const c of R.chunks){d.set(c,o);o+=c.length;}
  PT_finish(buf,R.heard);
}
function PT_finish(buf,heard){
  if(!PT.item)return;
  PT.recBuf=buf;const an=PT_analyze(buf,PT.item.t.length);
  if(an.voiced<6){PT.rec=null;PT.fb=null;PT.status=heard?'Chưa bắt được cao độ của giọng. Nói to, rõ và kéo dài âm hơn một chút.':'Chưa nghe thấy giọng. Kiểm tra micro rồi nói to hơn.';}
  else{PT.rec=an;PT.fb=PT_feedback();PT.status='';window.__award&&window.__award('speak',1);}
  PT_drawItem();PT_drawChart();PT_drawFb();
}
function PT_playBuf(buf){const ctx=PT_ctx();if(!ctx||!buf)return;stopSay();ctx.resume&&ctx.resume();const s=ctx.createBufferSource();s.buffer=buf;s.connect(ctx.destination);s.start();}
async function PT_playRef(){const it=PT.item;if(!it)return;
  if(it.kind==='s'){if(!(await saySyl(it.key)))say(it.h||it.py[0]);}else sayWord(it.h);}

/* ---------- drawing ---------- */
function PT_chartSVG(){
  const it=PT.item;if(!it)return '';
  const n=it.t.length,VW=480,VH=230,l=34,r=8,t=10,b=34,pw=VW-l-r,ph=VH-t-b,sw=pw/n;
  const Y=v=>t+(PT_YMAX-Math.max(-PT_YMAX-0.5,Math.min(PT_YMAX+0.5,v)))/(2*PT_YMAX)*ph;
  let g='';
  for(let v=-8;v<=8;v+=2){const y=Y(v).toFixed(1);g+=`<line x1="${l}" x2="${VW-r}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="${v===0?1.2:0.6}" ${v%4?'stroke-dasharray="2 4"':''}/>`;if(v%4===0)g+=`<text x="${l-6}" y="${(+y+4).toFixed(1)}" text-anchor="end" font-size="13" fill="var(--muted)">${v>0?'+'+v:v}</text>`;}
  for(let i=0;i<n;i++){const x=l+sw*(i+0.5);if(i>0)g+=`<line x1="${l+sw*i}" x2="${l+sw*i}" y1="${t}" y2="${t+ph}" stroke="var(--line2)" stroke-dasharray="4 4"/>`;
    g+=`<text x="${x}" y="${VH-12}" text-anchor="middle" font-size="17" font-weight="600" fill="var(--t${it.t[i]})" font-family="var(--f-py)">${esc(it.py[i])}</text>`;}
  const id=PT_ideal(it);
  const idealD=id.segs.map((s,i)=>'M'+s.map((v,k)=>`${(l+sw*i+6+(sw-12)*k/(PT_K-1)).toFixed(1)} ${Y(v).toFixed(1)}`).join(' L')).join(' ');
  g+=`<path d="${idealD}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="6 5" opacity=".75" stroke-linecap="round"/>`;
  const line=(an,col,w)=>{const al=PT_align(an,n);if(!al)return '';let d='';
    an.segs.slice(0,n).forEach(([a,bb],i)=>{let pen=false;for(let j=a;j<=bb;j++){const v=an.st[j];if(v==null){pen=false;continue;}const x=l+sw*i+6+(sw-12)*(bb>a?(j-a)/(bb-a):0.5);d+=(pen?' L':' M')+x.toFixed(1)+' '+Y(v+al.off).toFixed(1);pen=true;}});
    return d?`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`:'';};
  g+=line(PT.ref,'var(--accent)',3.5)+line(PT.rec,'var(--t4)',3);
  return `<svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Biểu đồ cao độ: bản mẫu, giọng của bạn và dạng thanh chuẩn">${g}</svg>`;
}
function PT_drawChart(){
  const c=$('#ptChart');if(!c)return;
  if(!PT.item){c.innerHTML='<div class="empty">Chọn một âm tiết hoặc một từ để bắt đầu.</div>';return;}
  c.innerHTML=`${PT_chartSVG()}<div class="pt-legend"><span><i class="pt-k pt-kr"></i>Bản mẫu</span><span><i class="pt-k pt-km"></i>Giọng của bạn</span><span><i class="pt-k pt-ki"></i>Dạng thanh chuẩn</span></div>
   <p class="note">Trục dọc là nửa cung so với giọng trung bình của người nói, nên giọng nam và nữ so được với nhau. Mỗi âm tiết kéo giãn cùng một độ rộng.${PT.refNote?' '+esc(PT.refNote):''}</p>`;
}
function PT_drawFb(){
  const f=$('#ptFb');if(!f)return;
  if(!PT.fb){const it=PT.item;const e=it?PT_eff(it):null;const notes=e?e.note.filter(Boolean):[];
    f.innerHTML=notes.length?`<div class="pt-tipbox">${notes.map(esc).join('<br>')}</div>`:'';return;}
  const tot=PT.fb.filter(x=>x.score!=null),avg=tot.length?Math.round(tot.reduce((s,x)=>s+x.score,0)/tot.length):null;
  f.innerHTML=`${avg!=null?`<div class="pt-total"><b class="num">${avg}</b><span>điểm cho lần này${avg>=80?'. Rất tốt.':avg>=55?'. Gần được rồi.':'. Thử lại, chậm hơn một chút.'}</span></div>`:''}
   <div class="pt-fbs">${PT.fb.map(x=>`<div class="pt-fbc">
     <div class="pt-fbh"><span class="py t${x.tone}">${esc(x.py)}</span><span class="small muted">Thanh ${x.tone===5?'nhẹ':x.tone}${x.tone!==x.orig?` (gốc thanh ${x.orig})`:''}</span>${x.score!=null?`<span class="pt-sc ${x.score>=75?'ok':x.score>=50?'mid':'low'} num">${x.score}</span>`:''}</div>
     <div>${esc(x.tip)}</div>
     ${x.score!=null?`<div class="small muted num">So với dạng chuẩn: ${x.sI}${x.sR!=null?`. So với bản mẫu: ${x.sR}`:''}</div>`:''}
     ${x.note?`<div class="small muted">${esc(x.note)}</div>`:''}</div>`).join('')}</div>`;
}
function PT_drawItem(){
  const b=$('#ptItem');if(!b)return;const it=PT.item;
  if(!it){b.innerHTML='';return;}
  const ch=[...it.h];
  b.innerHTML=`<div class="pt-word">${it.h?`<span class="han pt-h">${ch.map((c,i)=>`<span class="t${it.t[i]||5}">${esc(c)}</span>`).join('')}</span>`:''}<span class="py pt-p">${it.py.map((p,i)=>`<span class="t${it.t[i]}">${esc(p)}</span>`).join(' ')}</span>${it.kind==='w'&&WI.get(it.h)?`<span class="small muted">${esc(WI.get(it.h).vi)}</span>`:''}</div>
   <div class="pt-btns"><button class="btn" id="ptRef"><svg class="i"><use href="#i-play"/></svg> Nghe mẫu</button>
   <button class="btn primary ${PT.recording?'pt-on':''}" id="ptRec">${PT.recording?'<i class="pt-dot"></i>Đang thu, bấm để dừng':'Thu giọng'}</button>
   <button class="btn" id="ptMe" ${PT.recBuf&&!PT.recording?'':'disabled'}>Nghe lại bản thu</button></div>
   ${PT.recording?'<div class="bar-track pt-bar"><i id="ptBar" style="width:0%"></i></div>':''}
   ${PT.status?`<p class="note">${esc(PT.status)}</p>`:''}${PT.micMsg?`<div class="pt-msg">${esc(PT.micMsg)}</div>`:''}`;
  $('#ptRef').onclick=PT_playRef;$('#ptRec').onclick=PT_record;$('#ptMe').onclick=()=>PT_playBuf(PT.recBuf);
}
function PT_drawPicker(){
  const b=$('#ptPick');if(!b)return;
  if(PT.tab==='ma'){
    b.innerHTML=`<div class="row">${PT_BASES.map(s=>`<button class="chip py" data-pb="${s}" aria-pressed="${s===PT.base}">${esc(s)}</button>`).join('')}</div>
     <div class="pt-tones">${[1,2,3,4].map(n=>{const it=PT_sylItem(PT.base,n);const on=PT.item&&PT.item.kind==='s'&&PT.item.key===it.key;return `<button class="btn pt-tb" data-pt="${n}" aria-pressed="${on}"><span class="han t${n}">${esc(it.h)}</span><span class="py t${n}">${esc(it.py[0])}</span></button>`;}).join('')}</div>`;
    $$('[data-pb]',b).forEach(x=>x.onclick=()=>{PT.base=x.dataset.pb;PT_select(PT_sylItem(PT.base,1));PT_drawPicker();});
    $$('[data-pt]',b).forEach(x=>x.onclick=()=>{PT_select(PT_sylItem(PT.base,+x.dataset.pt));PT_drawPicker();});
  }else if(PT.tab==='pair'){
    const V=['ā','á','ǎ','à'];
    b.innerHTML=`<p class="note">Chọn một cặp thanh, máy lấy một từ hai chữ ở cấp HSK bạn đang học.</p>
     <div class="pt-grid4">${[1,2,3,4].flatMap(a=>[1,2,3,4].map(c=>`<button class="btn sm pt-pc" data-pa="${a}${c}" aria-pressed="${PT.pair===''+a+c}"><span class="t${a}">${a}</span>+<span class="t${c}">${c}</span><span class="py muted">${V[a-1]} ${V[c-1]}</span></button>`)).join('')}</div>
     ${PT.pair?'<div class="row"><button class="btn sm" id="ptMore">Từ khác cùng cặp</button></div>':''}`;
    const go2=async k=>{PT.pair=k;const w=await PT_pairWord(+k[0],+k[1]);if(w)PT_select(PT_wordItem(w));else toast('Chưa có từ cho cặp thanh này.');PT_drawPicker();};
    $$('[data-pa]',b).forEach(x=>x.onclick=()=>go2(x.dataset.pa));
    const m=$('#ptMore',b);if(m)m.onclick=()=>go2(PT.pair);
  }else{
    b.innerHTML=`<input type="search" id="ptQ" placeholder="Gõ chữ Hán, pinyin hoặc Hán Việt, ví dụ 你好, nihao" value="${esc(PT.q)}" autocomplete="off"><div class="row" id="ptRes"></div>`;
    const inp=$('#ptQ',b);inp.oninput=()=>{PT.q=inp.value;PT_search();};PT_search();
  }
}
async function PT_search(){
  const r=$('#ptRes');if(!r)return;const q=PT.q.trim();
  if(!q){r.innerHTML='<span class="note">Từ 1 đến 2 âm tiết, có bản ghi âm gốc.</span>';return;}
  const pool=await PT_pool(),han=[...q].some(isHan),qq=stripTone(q).replace(/[\s'0-9]/g,''),qv=viFold(q).trim();
  const res=[];for(const w of pool){if(res.length>=14)break;
    if(han?w.h.includes(q):(stripTone(w.p.join('')).startsWith(qq)||(w.hv&&viFold(w.hv).startsWith(qv))))res.push(w);}
  if(PT.q.trim()!==q)return;
  r.innerHTML=res.length?res.map(w=>`<button class="chip pt-rc" data-ph="${esc(w.h)}"><span class="han">${hanHTML(w)}</span> <span class="py small">${pyHTML(w)}</span></button>`).join(''):'<span class="note">Không thấy từ phù hợp có bản ghi âm.</span>';
  $$('[data-ph]',r).forEach(x=>x.onclick=()=>PT_select(PT_wordItem(WI.get(x.dataset.ph))));
}
function ptRender(el){
  const solo=el.id==='view';
  const mic=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
  if(!mic&&!PT.micMsg)PT.micMsg='Trình duyệt ở đây không cho dùng micro. Phần thu giọng chạy trên trang hanyu-ecru.vercel.app bằng Chrome, Edge hoặc Safari. Bạn vẫn xem được đường cao độ của bản mẫu.';
  const body=`<div class="pt">
    <div><h3>Luyện thanh điệu bằng biểu đồ</h3><p class="note">Nghe mẫu, thu giọng của bạn rồi so hai đường cao độ trên cùng một biểu đồ.</p></div>
    ${subTabs('ptTabs',[['ma','4 thanh của một âm'],['pair','Cặp thanh'],['search','Tìm từ']],PT.tab,k=>{PT.tab=k;$$('#ptTabs .chip').forEach(c=>c.setAttribute('aria-pressed',c.dataset.st===k));PT_drawPicker();})}
    <div id="ptPick" class="pt-pick"></div>
    <div id="ptItem" class="pt-item"></div>
    <div id="ptChart" class="pt-chart"></div>
    <div id="ptFb"></div></div>`;
  el.innerHTML=solo?`<div class="view"><h2>Thanh điệu</h2><div class="panel">${body}</div></div>`:body;
  if(!PT.item)PT.item=PT_sylItem(PT.base,1),PT.rec=null;
  PT_drawPicker();PT_drawItem();PT_drawChart();PT_drawFb();
  if(!PT.ref&&!PT.refBuf)PT_loadRef();
}
VIEWS.pitch=ptRender;
{const _rt=renderTones;VIEWS.tones=el=>{_rt(el);const host=document.createElement('div');host.className='panel';el.querySelector('.view').appendChild(host);ptRender(host);};}
window.__pt={analyze:PT_analyze,track:PT_track,ideal:PT_ideal,eff:PT_eff,finish:PT_finish,state:()=>PT};
