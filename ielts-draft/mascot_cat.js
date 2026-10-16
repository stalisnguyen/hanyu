/* Catalis mascot: Mít, a ginger kitten. catSVG(state, size, rank)
   state: calm | hi | idea | yay | ok | hmm | zzz ; rank 0..7 (Freshman -> Professor) picks accessories. */
const CC={fur:'#F2A33A',dark:'#D97F1E',stripe:'#C96F12',belly:'#FFF3DC',ear:'#FFB4A8',nose:'#E5707A',eye:'#1C2333',navy:'#22346E',gold:'#F5B82E',red:'#C8372F'};
function catAcc(r){
  let s='';
  if(r>=1&&r<4)s+=`<path d="M62 46c6-20 70-20 76 0z" fill="${CC.navy}"/><circle cx="100" cy="26" r="6" fill="${CC.gold}"/>`; // beanie
  if(r>=2)s+=`<g fill="none" stroke="${CC.navy}" stroke-width="3.5"><circle cx="82" cy="78" r="12"/><circle cx="118" cy="78" r="12"/><path d="M94 78h12"/></g>`; // glasses
  if(r>=4){s+=`<path d="M56 40l44-18 44 18-44 18z" fill="${CC.navy}"/><rect x="80" y="40" width="40" height="12" rx="3" fill="${CC.navy}"/><path d="M144 40v20" stroke="${CC.gold}" stroke-width="3"/><circle cx="144" cy="62" r="4" fill="${CC.gold}"/>`;} // mortarboard
  if(r>=5)s+=`<rect x="150" y="140" width="26" height="12" rx="6" fill="#FFF8E7" stroke="${CC.dark}" stroke-width="2"/><rect x="160" y="138" width="6" height="16" fill="${CC.red}"/>`; // scroll
  if(r>=6)s+=`<path d="M86 118l14 8-14 8zM114 118l-14 8 14 8z" fill="${CC.red}"/><circle cx="100" cy="126" r="4" fill="${CC.red}"/>`; // bow tie
  if(r>=7)s+=`<path d="M60 150c10 20 70 20 80 0v30H60z" fill="${CC.navy}" opacity=".9"/>`; // gown
  return s;
}
function catSVG(state,size,rank){
  state=state||'calm';size=size||120;rank=rank||0;
  const yay=state==='yay',zzz=state==='zzz';
  const eyes=zzz?`<path d="M74 80q8 6 16 0M110 80q8 6 16 0" stroke="${CC.eye}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    :yay?`<path d="M74 82q8-10 16 0M110 82q8-10 16 0" stroke="${CC.eye}" stroke-width="4" fill="none" stroke-linecap="round"/>`
    :`<ellipse cx="82" cy="79" rx="7" ry="9" fill="${CC.eye}"/><ellipse cx="118" cy="79" rx="7" ry="9" fill="${CC.eye}"/><circle cx="84.5" cy="75.5" r="2.6" fill="#fff"/><circle cx="120.5" cy="75.5" r="2.6" fill="#fff"/>`;
  const mouth=yay?`<path d="M92 99q8 10 16 0z" fill="#8A2A33"/>`:state==='hmm'?`<path d="M93 101q7-3 14 1" stroke="${CC.eye}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
    :`<path d="M100 96v4M100 100q-5 5-10 2M100 100q5 5 10 2" stroke="${CC.eye}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const armL=yay?'M66 128c-14-8-22-22-20-36':'M66 132c-6 8-8 14-6 20';
  const armR=state==='hi'||yay?'M134 128c14-8 22-22 20-36':state==='hmm'?'M134 124c12-14 6-34-10-42':state==='ok'?'M134 130c10-2 16-8 16-16':'M134 132c6 8 8 14 6 20';
  const extra=state==='idea'?`<g transform="translate(150 14)"><circle cx="14" cy="16" r="12" fill="${CC.gold}"/><rect x="9" y="26" width="10" height="8" rx="2" fill="#9AA3A0"/></g>`
    :zzz?`<g font-family="sans-serif" font-weight="800" fill="${CC.navy}"><text x="142" y="44" font-size="18">z</text><text x="156" y="30" font-size="13">z</text></g>`
    :yay?`<circle cx="32" cy="44" r="4" fill="${CC.red}"/><rect x="160" y="34" width="8" height="5" fill="${CC.gold}" transform="rotate(30 164 36)"/><circle cx="168" cy="74" r="3.5" fill="#2C5FC4"/>`:'';
  return `<svg class="mascot cat-${state}" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="Mít">
  <path d="M140 168c26 0 40-16 36-36-2-10-12-12-14-4 6 4 4 22-16 24z" fill="${CC.fur}"/><path d="M168 134l8-4M171 146l9 0" stroke="${CC.stripe}" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="100" cy="190" rx="44" ry="6" fill="#000" opacity=".08"/>
  <ellipse cx="82" cy="182" rx="14" ry="9" fill="${CC.fur}"/><ellipse cx="118" cy="182" rx="14" ry="9" fill="${CC.fur}"/>
  <path d="M60 148c0-28 18-40 40-40s40 12 40 40c0 24-16 36-40 36s-40-12-40-36z" fill="${CC.fur}"/>
  <path d="M80 150c0-16 9-24 20-24s20 8 20 24-9 26-20 26-20-10-20-26z" fill="${CC.belly}"/>
  <path d="${armL}" stroke="${CC.fur}" stroke-width="14" fill="none" stroke-linecap="round"/><path d="${armR}" stroke="${CC.fur}" stroke-width="14" fill="none" stroke-linecap="round"/>
  <path d="M58 60l-4-38 32 20z" fill="${CC.fur}"/><path d="M142 60l4-38-32 20z" fill="${CC.fur}"/>
  <path d="M62 52l-2-20 16 11z" fill="${CC.ear}"/><path d="M138 52l2-20-16 11z" fill="${CC.ear}"/>
  <ellipse cx="100" cy="82" rx="50" ry="44" fill="${CC.fur}"/>
  <path d="M92 40l4 14M100 38v16M108 40l-4 14" stroke="${CC.stripe}" stroke-width="4" stroke-linecap="round"/>
  <path d="M52 76l12 2M52 88l12-2M148 76l-12 2M148 88l-12-2" stroke="${CC.stripe}" stroke-width="3.5" stroke-linecap="round"/>
  <ellipse cx="100" cy="98" rx="20" ry="13" fill="${CC.belly}"/>
  <path d="M95 92h10l-5 5z" fill="${CC.nose}"/>
  <path d="M72 96l-18-3M72 101l-18 3M128 96l18-3M128 101l18 3" stroke="#7A5A3A" stroke-width="1.6" stroke-linecap="round"/>
  <ellipse cx="70" cy="92" rx="6" ry="4" fill="${CC.ear}" opacity=".8"/><ellipse cx="130" cy="92" rx="6" ry="4" fill="${CC.ear}" opacity=".8"/>
  ${eyes}${mouth}${catAcc(rank)}${extra}</svg>`;
}
if(typeof module!=='undefined')module.exports={catSVG};
