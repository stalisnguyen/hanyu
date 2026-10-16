/* ================= MASCOT: Tiểu Long 小龙 =================
   mascotSVG(state, size, rank)  state: hi | idea | yay | ok | hmm | zzz | calm
   rank 0..7 picks the hat (Đồng sinh -> Trạng nguyên). Fixed palette so it reads the same in dark mode. */
const MC={body:'#2FAE84',dark:'#1B8564',snout:'#7FD8B5',belly:'#FFF0C2',belly2:'#F2DC9A',horn:'#FFC23D',horn2:'#E59A12',eye:'#17211C',cheek:'#FF98A0',hat:'#20262B',red:'#C8372F',gold:'#F5B82E'};
function mcHat(r){
  if(r==null||r<=0)return `<path d="M100 30c-6-12 4-20 10-15-7 1-8 7-4 13z" fill="${MC.dark}"/><circle cx="102" cy="31" r="4" fill="${MC.red}"/>`; // tuft + red tie
  if(r===1)return `<path d="M58 52c10-22 74-22 84 0-8 6-76 6-84 0z" fill="${MC.hat}"/><path d="M62 49c12-8 64-8 76 0" stroke="#3B444B" stroke-width="3" fill="none"/>`; // khăn đóng
  const h=r<=4?[0,0,10,16,22][r]:22;
  let s=`<path d="M64 50c6-${8+h} 66-${8+h} 72 0z" fill="${MC.hat}"/><rect x="60" y="46" width="80" height="9" rx="4.5" fill="${MC.hat}"/>`;
  if(r>=3)s+=`<rect x="92" y="${36-h}" width="16" height="7" rx="3" fill="${MC.gold}"/>`;
  if(r===5)s+=`<circle cx="134" cy="44" r="7" fill="${MC.red}"/><circle cx="134" cy="44" r="3" fill="${MC.gold}"/><path d="M127 49l-6 6" stroke="${MC.body}" stroke-width="3"/>`;
  if(r>=6)s+=`<path d="M60 50c-14-2-26-8-30-14 10 0 22 4 32 8z" fill="${MC.hat}"/><path d="M140 50c14-2 26-8 30-14-10 0-22 4-32 8z" fill="${MC.hat}"/>`;
  if(r>=7)s+=`<circle cx="100" cy="${41-h}" r="5" fill="${MC.red}"/>`;
  return s;
}
function mascotSVG(state,size,rank){
  state=state||'calm'; size=size||120;
  const zzz=state==='zzz', yay=state==='yay';
  const eyes=zzz?`<path d="M74 74q8 7 16 0M110 74q8 7 16 0" stroke="${MC.eye}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    :yay?`<path d="M74 76q8-10 16 0M110 76q8-10 16 0" stroke="${MC.eye}" stroke-width="4" fill="none" stroke-linecap="round"/>`
    :`<g class="mc-eyes"><ellipse cx="82" cy="73" rx="8" ry="10" fill="${MC.eye}"/><ellipse cx="118" cy="73" rx="8" ry="10" fill="${MC.eye}"/><circle cx="85" cy="69" r="3" fill="#fff"/><circle cx="121" cy="69" r="3" fill="#fff"/></g>`;
  const mouth=yay?`<path d="M90 97q10 12 20 0z" fill="#7A2A2A"/>`:zzz?`<ellipse cx="100" cy="99" rx="4" ry="3" fill="#2A3A33"/>`:state==='hmm'?`<path d="M92 99q8-4 16 1" stroke="${MC.eye}" stroke-width="3" fill="none" stroke-linecap="round"/>`:`<path d="M91 97q9 8 18 0" stroke="${MC.eye}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  // arms: [left, right] as paths
  const armL=yay?`M62 120c-14-8-24-20-24-34`:state==='hmm'?`M62 126c-8 4-14 2-16-4`:`M62 126c-8 6-12 12-10 18`;
  const armR=state==='hi'||yay?`M138 120c14-8 24-20 24-34`:state==='hmm'?`M138 118c10-16 4-34-10-44`:state==='ok'?`M138 124c10-2 16-8 16-16`:`M138 126c8 6 12 12 10 18`;
  const tail=`<path d="M146 150c22 4 34-6 32-22-1-8-8-10-12-6 6 2 6 12-4 14-8 2-14-2-18-4z" fill="${MC.body}"/><path d="M174 122l8-8 0 12z" fill="${MC.horn}"/>`;
  const extra= state==='idea'?`<g transform="translate(150 18)"><circle cx="14" cy="16" r="12" fill="${MC.gold}"/><rect x="9" y="26" width="10" height="8" rx="2" fill="#9AA3A0"/><path d="M14 0v-6M-2 8l-5-4M30 8l5-4" stroke="${MC.gold}" stroke-width="3" stroke-linecap="round"/></g>`
    : zzz?`<g font-family="Be Vietnam Pro,sans-serif" font-weight="800" fill="${MC.dark}"><text x="140" y="40" font-size="18">z</text><text x="154" y="26" font-size="13">z</text></g>`
    : yay?`<g><circle cx="30" cy="40" r="4" fill="${MC.red}"/><rect x="160" y="30" width="8" height="5" fill="${MC.gold}" transform="rotate(30 164 32)"/><circle cx="170" cy="70" r="3.5" fill="#2C5FC4"/><rect x="24" y="80" width="7" height="5" fill="${MC.body}" transform="rotate(-20 27 82)"/></g>`
    : state==='ok'?`<g transform="translate(150 96)"><circle cx="6" cy="6" r="9" fill="${MC.body}"/><path d="M6 -6v6" stroke="${MC.body}" stroke-width="7" stroke-linecap="round"/></g>`:'';
  return `<svg class="mascot mc-${state}" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="Tiểu Long">
  ${tail}
  <ellipse cx="100" cy="188" rx="46" ry="6" fill="#000" opacity=".08"/>
  <ellipse cx="80" cy="178" rx="16" ry="10" fill="${MC.dark}"/><ellipse cx="120" cy="178" rx="16" ry="10" fill="${MC.dark}"/>
  <path d="M56 140c0-30 20-44 44-44s44 14 44 44c0 26-18 40-44 40s-44-14-44-40z" fill="${MC.body}"/>
  <path d="M76 142c0-18 10-28 24-28s24 10 24 28c0 18-10 30-24 30s-24-12-24-30z" fill="${MC.belly}"/>
  <path d="M80 132h40M78 146h44M82 160h36" stroke="${MC.belly2}" stroke-width="3" stroke-linecap="round"/>
  <path d="${armL}" stroke="${MC.body}" stroke-width="14" fill="none" stroke-linecap="round"/>
  <path d="${armR}" stroke="${MC.body}" stroke-width="14" fill="none" stroke-linecap="round"/>
  <path d="M74 40l-10-22c10 0 18 8 20 18z" fill="${MC.horn}"/><path d="M126 40l10-22c-10 0-18 8-20 18z" fill="${MC.horn}"/>
  <path d="M90 34l4-12 6 10 6-10 4 12z" fill="${MC.dark}"/>
  <path d="M54 70c-14-6-18-18-16-26 8 4 14 12 18 18z" fill="${MC.dark}"/><path d="M146 70c14-6 18-18 16-26-8 4-14 12-18 18z" fill="${MC.dark}"/>
  <circle cx="100" cy="78" r="48" fill="${MC.body}"/>
  <ellipse cx="100" cy="98" rx="30" ry="19" fill="${MC.snout}"/>
  <circle cx="91" cy="91" r="2.6" fill="${MC.dark}"/><circle cx="109" cy="91" r="2.6" fill="${MC.dark}"/>
  <path d="M71 98c-12 0-20 6-22 14M129 98c12 0 20 6 22 14" stroke="${MC.horn}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="68" cy="88" rx="7" ry="4.5" fill="${MC.cheek}" opacity=".75"/><ellipse cx="132" cy="88" rx="7" ry="4.5" fill="${MC.cheek}" opacity=".75"/>
  ${eyes}${mouth}${mcHat(rank)}${extra}
  </svg>`;
}
function mcRankIdx(){try{const xp=plXPTotal();let i=0;PL_RANKS.forEach((r,k)=>{if(xp>=r[0])i=k;});return i;}catch(e){return 0;}}
function mascot(state,size){if(P.settings&&P.settings.noMascot)return '';return `<span class="mc-wrap">${mascotSVG(state,size,mcRankIdx())}</span>`;}
function mcSay(state,text,size){if(P.settings&&P.settings.noMascot)return `<p class="note">${text}</p>`;return `<div class="mc-say">${mascot(state,size||64)}<div class="mc-bubble">${text}</div></div>`;}
