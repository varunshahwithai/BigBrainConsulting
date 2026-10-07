/* ===== Page: inputs, rendering, charts. Every number shown comes from the engine above. ===== */
const SYM={GBP:"£",USD:"$",EUR:"€",INR:"₹"};
const MARKET_KEYS=["tam","samPct","sam","share","growth","pcust","spend"];
function fresh(){const s=JSON.parse(JSON.stringify(DEFAULTS));s.cur="GBP";s.src={};MARKET_KEYS.forEach(k=>s.src[k]="example");s.esrc={};return s;}
let S=fresh();
try{const d=JSON.parse(localStorage.getItem("mes-draft")||"null");if(d&&d.price!==undefined)S=Object.assign(fresh(),d);}catch(e){}

const F={
  cur:{l:"Currency",t:"select",opts:[["GBP","£ GBP"],["USD","$ USD"],["EUR","€ EUR"],["INR","₹ INR"]]},
  name:{l:"Company name",t:"text"},product:{l:"Product or service",t:"text"},geo:{l:"Where you sell today",t:"text"},
  price:{l:"List price per unit",h:"Before any discount",u:"money",step:1},
  volume:{l:"Units sold per year",h:"At today's price",u:"num",step:100},
  discount:{l:"Average discount",h:"Promos, coupons, bulk deals",u:"pct",step:1,min:0,max:90},
  varcost:{l:"Variable cost per unit",h:"Materials, delivery, payment fees",u:"money",step:0.5},
  fixed:{l:"Fixed costs per year",h:"Salaries, rent, software",u:"money",step:1000},
  cac:{l:"Customer acquisition cost",h:"Sales and marketing spend per new customer",u:"money",step:1},
  upc:{l:"Units per customer per year",h:"How many units one customer buys",u:"num",step:0.1,min:0.1},
  conv:{l:"Conversion rate",h:"Share of leads who become customers",u:"pct",step:0.1,min:0},
  currev:{l:"Current revenue, if known",h:"We use it to sense-check your inputs",u:"money",step:1000,blank:true},
  country:{l:"Country or region",t:"text"},industry:{l:"Industry",t:"text"},ctype:{l:"Customer type",t:"text"},
  tam:{l:"TAM",h:"Total addressable market, per year",u:"money",step:1000000},
  samPct:{l:"Share of TAM you can serve",h:"The part your product, geography and customer type can reach. Sets your SAM",u:"pct",step:0.5,min:0,max:100},
  sam:{l:"SAM",h:"Serviceable market. Calculated as TAM × share you can serve",u:"money",step:100000},
  share:{l:"Expected share of SAM",h:"What you can realistically win. Sets your SOM",u:"pct",step:0.1,min:0,max:100},
  growth:{l:"Market growth per year",u:"pct",step:0.5},
  pcust:{l:"Number of potential customers",u:"num",step:100},
  spend:{l:"Average spend per customer per year",u:"money",step:10},
  elastic:{l:"Your elasticity",u:"num",step:0.1,min:-5,max:0},
  scA:{l:"Scenario A price",u:"money",step:1},scB:{l:"Scenario B price",u:"money",step:1},scC:{l:"Scenario C price",u:"money",step:1},
  invest:{l:"Investment needed",h:"Setup, launch, hiring, stock",u:"money",step:1000},
  horizon:{l:"Time horizon",u:"yrs",step:1,min:1,max:10},
  ttmE:{l:"Time to market",h:"Months before the first sale",u:"mo",step:1,min:0,max:60},
  pShare:{l:"Partner's cut of revenue",u:"pct",step:1,min:0,max:90},
  pCac:{l:"Acquisition cost saved",h:"The partner brings customers to you",u:"pct",step:1,min:0,max:100},
  pFixed:{l:"Fixed costs saved",h:"The partner runs part of the operation",u:"pct",step:1,min:0,max:100},
  pInv:{l:"Investment saved",u:"pct",step:1,min:0,max:100},
  ttmP:{l:"Time to market",h:"Months before the first sale",u:"mo",step:1,min:0,max:60},
  pRisk:{l:"Risk reduced by partnering",h:"Share of entry difficulty the partner absorbs",u:"pct",step:1,min:0,max:100}
};
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------- formatting ---------- */
const sym=()=>SYM[S.cur]||"£";
function money(v){if(!isFinite(v))return"—";const a=Math.abs(v),s=v<0?"−":"";let b;
  if(a>=1e9)b=(a/1e9).toFixed(a>=1e10?1:2)+"B";else if(a>=1e6)b=(a/1e6).toFixed(a>=1e7?1:2)+"M";else if(a>=1e5)b=(a/1e3).toFixed(0)+"K";
  else b=Math.round(a).toLocaleString("en-GB");return s+sym()+b;}
function money2(v){if(!isFinite(v))return"—";return(v<0?"−":"")+sym()+Math.abs(v).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2});}
const num=v=>isFinite(v)?(v<0?"−":"")+Math.round(Math.abs(v)).toLocaleString("en-GB"):"—";
const pct=(v,dp=1)=>isFinite(v)?(v<0?"−":"")+(Math.abs(v)*100).toFixed(dp)+"%":"—";
const spct=(v,dp=1)=>isFinite(v)?(v>0?"+":v<0?"−":"")+(Math.abs(v)*100).toFixed(dp)+"%":"—";
const el=v=>(v<0?"−":"")+Math.abs(v).toFixed(1);
const months=m=>m===null?"Not within horizon":`Year ${Math.ceil(m/12)} (month ${m})`;

/* ---------- field builders ---------- */
function fieldHTML(k,opts={}){
  const f=F[k];const id=(opts.pre||"f")+"-"+k;
  const chip=MARKET_KEYS.includes(k)?` <span class="srcchip" data-chip="${k}"></span>`:"";
  const help=f.h?`<small>${f.h}</small>`:"";
  if(f.t==="text")return `<div class="field text"><label for="${id}">${f.l}${help}</label><input id="${id}" type="text" data-k="${k}" data-t="text"></div>`;
  if(f.t==="select")return `<div class="field"><label for="${id}">${f.l}</label><select id="${id}" data-k="${k}" data-t="text">${f.opts.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join("")}</select></div>`;
  return `<div class="field"><label for="${id}"><span>${f.l}${chip}</span>${help}</label>${box(k,id)}</div>`;
}
function box(k,id){const f=F[k];
  const pre=f.u==="money"?`<span class="cs">${sym()}</span>`:"";
  const suf=f.u==="pct"?`<span class="suf">%</span>`:f.u==="yrs"?`<span class="suf">yrs</span>`:f.u==="mo"?`<span class="suf">mo</span>`:"";
  return `<div class="inbox">${pre}<input id="${id}" type="text" inputmode="decimal" autocomplete="off" data-k="${k}" data-num="1">${suf}</div>`;
}
const fill=(id,keys,pre)=>{$(id).innerHTML=keys.map(k=>fieldHTML(k,{pre})).join("");};

/* slider ranges, anchored so a range doesn't jump while you drag */
let A={};let PV={p:0,v:0};const resetPV=()=>{PV={p:S.price,v:S.volume};};
function niceStep(x){if(x<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(x)));const m=x/p;return(m<1.5?1:m<3.5?2:m<7.5?5:10)*p;}
function range(k){const a=A[k]||S[k]||1;
  switch(k){
    case"price":return[Math.max(0,a*.5),a*2,niceStep(a/100)];
    case"volume":return[Math.round(a*.1),Math.round(a*5),niceStep(a/200)];
    case"discount":return[0,50,1];
    case"varcost":return[0,Math.max(a*2,(A.price||S.price)),niceStep(a/100)];
    case"fixed":return[0,a*3,niceStep(a/100)];
    case"cac":return[0,Math.max(a*3,10),niceStep(Math.max(a,1)/100)];
    case"conv":return[0.5,30,0.1];
    case"share":return[0.1,20,0.1];
    case"elastic":return[-3,0,0.1];
  }}
function sliderHTML(k,label){const f=F[k];const id="s-"+k;
  return `<div class="slider"><div class="top"><label for="${id}n">${label||f.l}</label>${box(k,id+"n")}</div>
  <input type="range" id="${id}" data-k="${k}" data-range="1" aria-label="${label||f.l}"><div class="ends"><span data-end="${k}-min"></span><span data-end="${k}-max"></span></div></div>`;}
function fmtUnit(k,v){const u=F[k].u;return u==="money"?money(v):u==="pct"?v+"%":k==="elastic"?el(v):num(v);}
function applyRanges(){document.querySelectorAll('input[data-range]').forEach(r=>{const k=r.dataset.k;const[mn,mx,st]=range(k);
  r.min=mn;r.max=mx;r.step=st;r.value=S[k];
  document.querySelectorAll(`[data-end="${k}-min"]`).forEach(e=>e.textContent=fmtUnit(k,mn));
  document.querySelectorAll(`[data-end="${k}-max"]`).forEach(e=>e.textContent=fmtUnit(k,mx));});}
function anchorAll(){resetPV();["price","volume","varcost","fixed","cac"].forEach(k=>A[k]=S[k]);}

/* ---------- state sync ---------- */
function fmtIn(v){if(v===""||v===undefined||v===null||!isFinite(v))return"";const a=Math.abs(v);
  return a>=1000?Number(v).toLocaleString("en-GB",{maximumFractionDigits:2}):String(Math.round(v*100)/100);}
const parseIn=t=>parseFloat(String(t).replace(/[,\s£$€₹]/g,"").replace("−","-"));
document.addEventListener("focusout",e=>{const i=e.target;if(i.dataset&&i.dataset.num)i.value=fmtIn(S[i.dataset.k]);});
function syncInputs(skip){document.querySelectorAll("[data-k]").forEach(i=>{if(i===skip)return;const k=i.dataset.k;
  if(i.dataset.range){i.value=S[k];return;}
  const v=S[k];i.value=i.dataset.num?fmtIn(v):((v===""||v===undefined)?"":v);});
  document.querySelectorAll(".cs").forEach(c=>c.textContent=sym());}
document.addEventListener("input",e=>{const i=e.target;const k=i.dataset&&i.dataset.k;if(!k)return;
  if(i.dataset.t==="text"){S[k]=i.value;}
  else{if(i.value===""&&F[k]&&F[k].blank){S[k]="";}else{const v=i.dataset.range?parseFloat(i.value):parseIn(i.value);if(!isFinite(v))return;S[k]=v;}}
  if(MARKET_KEYS.includes(k))S.src[k]="user";
  if(k.startsWith("f_")&&S.esrc)S.esrc[k.slice(2)]="user";
  if(k==="price"&&i.closest("#sliders")&&S.link!==false&&PV.p>0){S.volume=Math.max(0,Math.round(PV.v*(1+S.elastic*(S.price/PV.p-1))));}
  else if(k==="price"||k==="volume"){PV={p:S.price,v:S.volume};}
  if(!i.dataset.range&&A[k]!==undefined){A[k]=S[k];applyRanges();}
  syncInputs(i);render();saveDraft();});
document.addEventListener("change",e=>{if(e.target.dataset&&e.target.dataset.k==="cur"){syncInputs();render();saveDraft();}});
let draftT;function saveDraft(){clearTimeout(draftT);draftT=setTimeout(()=>{try{localStorage.setItem("mes-draft",JSON.stringify(S));}catch(e){}},400);}

/* ---------- charts (inline SVG, one scale per axis) ---------- */
function ticks(mn,mx,n=5){if(mn===mx){mn-=1;mx+=1;}const st=niceStep((mx-mn)/n);return{lo:Math.floor(mn/st)*st,hi:Math.ceil(mx/st)*st,st};}
const CHARTS={};
function boxW(svg){const p=svg&&svg.parentElement;const w=p&&p.clientWidth;return w&&w>200?Math.round(w):640;}
function yLab(t,fmt){let m=0;for(let v=t.lo;v<=t.hi+t.st/2;v+=t.st)m=Math.max(m,String(fmt(v)).length);return Math.max(44,m*6.8+16);}
function drawLine(svg,o,W,H){const R=18,T=18,B=32;
  const xs=o.xs;let ys=[];o.series.forEach(s=>ys=ys.concat(s.ys.filter(isFinite)));if(o.zero)ys.push(0);(o.hlines||[]).forEach(l=>ys.push(l.v));
  const t=ticks(Math.min(...ys),Math.max(...ys));const L=yLab(t,o.yFmt);const xmin=xs[0],xmax=xs[xs.length-1];
  const X=v=>L+(W-L-R)*(v-xmin)/((xmax-xmin)||1),Y=v=>T+(H-T-B)*(t.hi-v)/((t.hi-t.lo)||1);
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  let g="";for(let v=t.lo;v<=t.hi+t.st/2;v+=t.st){const z=Math.abs(v)<t.st/1e6;
    g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line);stroke-width:${z?1.6:1}" ${z?"":'stroke-dasharray="3 4"'}/><text x="${L-8}" y="${Y(v)+4}" text-anchor="end">${o.yFmt(v)}</text>`;}
  const n=Math.max(2,Math.min(o.xTicks||6,Math.floor((W-L-R)/80)));
  const xt=ticks(xmin,xmax,n);for(let v=xt.lo;v<=xmax+1e-9;v+=xt.st){if(v<xmin-1e-9)continue;const x=X(v);g+=`<text x="${x}" y="${H-10}" text-anchor="${x>W-R-30?"end":x<L+20?"start":"middle"}">${o.xFmt(v)}</text>`;}
  (o.marks||[]).forEach((m,i)=>{if(m.x<xmin||m.x>xmax)return;const x=X(m.x);const right=x<W-R-90;g+=`<line x1="${x}" x2="${x}" y1="${T}" y2="${H-B}" style="stroke:${m.c};stroke-width:1.5" ${m.dash?'stroke-dasharray="5 4"':""}/><text x="${right?x+5:x-5}" y="${T+11+i*14}" text-anchor="${right?"start":"end"}" class="halo" style="fill:${m.c}">${esc(m.label)}</text>`;});
  (o.hlines||[]).forEach(l=>{g+=`<line x1="${L}" x2="${W-R}" y1="${Y(l.v)}" y2="${Y(l.v)}" style="stroke:${l.c};stroke-width:1.5" stroke-dasharray="6 4"/><text x="${W-R-4}" y="${Y(l.v)-5}" text-anchor="end" class="halo" style="fill:${l.c}">${esc(l.label)}</text>`;});
  o.series.forEach(s=>{const pts=xs.map((x,i)=>isFinite(s.ys[i])?`${X(x).toFixed(1)},${Y(s.ys[i]).toFixed(1)}`:null).filter(Boolean).join(" ");
    g+=`<polyline fill="none" points="${pts}" style="stroke:${s.c};stroke-width:2.5;stroke-linejoin:round"/>`;});
  (o.dots||[]).forEach(d=>{const x=X(d.x),y=Y(d.y);g+=`<circle cx="${x}" cy="${y}" r="5" style="fill:${d.c};stroke:var(--surface);stroke-width:2"/>`+(d.label?(x<L+120?`<text x="${x+10}" y="${y+20}" class="halo" style="fill:var(--ink)">${esc(d.label)}</text>`:`<text x="${x-10}" y="${y-12}" text-anchor="end" class="halo" style="fill:var(--ink)">${esc(d.label)}</text>`):"");});
  svg.innerHTML=g;return{X,Y,L,R,T,B,W,H};}
function drawBars(svg,o,W,H){const R=10,T=16,B=32;const nb=o.stack?1:o.series.length;
  let ys=[0];if(o.stack)o.cats.forEach((c,i)=>ys.push(o.series.reduce((a,s)=>a+Math.max(0,+s.vals[i]||0),0)));else o.series.forEach(s=>ys=ys.concat(s.vals.map(v=>+v||0)));
  (o.lines||[]).forEach(l=>ys.push(l.v));
  const t=ticks(Math.min(...ys),Math.max(...ys));const L=yLab(t,o.yFmt);
  const Y=v=>T+(H-T-B)*(t.hi-v)/((t.hi-t.lo)||1);const gw=(W-L-R)/Math.max(1,o.cats.length);const bw=Math.max(4,Math.min(o.stack?46:30,(gw-14)/nb));
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  let g="";for(let v=t.lo;v<=t.hi+t.st/2;v+=t.st){const z=Math.abs(v)<t.st/1e6;g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line);stroke-width:${z?1.6:1}" ${z?"":'stroke-dasharray="3 4"'}/><text x="${L-8}" y="${Y(v)+4}" text-anchor="end">${o.yFmt(v)}</text>`;}
  const maxc=Math.max(3,Math.floor(gw/6.6));const cut=c=>{c=String(c);return c.length>maxc?c.slice(0,maxc-1)+"…":c;};
  o.cats.forEach((c,i)=>{const x0=L+gw*i+(gw-bw*nb)/2;
    if(o.stack){let acc=0;o.series.forEach(s=>{const v=Math.max(0,+s.vals[i]||0);if(v<=0)return;const y1=Y(acc+v),y0=Y(acc);g+=`<rect x="${x0+1}" y="${y1}" width="${bw-2}" height="${Math.max(y0-y1,1)}" style="fill:${s.cs?s.cs[i]:s.c}"/>`;acc+=v;});}
    else o.series.forEach((s,j)=>{const v=+s.vals[i]||0;const y=Y(Math.max(v,0)),h=Math.abs(Y(v)-Y(0));g+=`<rect x="${x0+j*bw+1}" y="${y}" width="${bw-2}" height="${Math.max(h,1)}" rx="3" style="fill:${s.cs?s.cs[i]:s.c}"/>`;});
    g+=`<text x="${L+gw*i+gw/2}" y="${H-10}" text-anchor="middle" style="${o.hl===i?"fill:var(--ink);font-weight:600":""}"><title>${esc(c)}</title>${esc(cut(c))}</text>`;});
  (o.lines||[]).forEach(l=>{g+=`<line x1="${L}" x2="${W-R}" y1="${Y(l.v)}" y2="${Y(l.v)}" style="stroke:${l.c};stroke-width:1.5" stroke-dasharray="6 4"/><text x="${W-R-4}" y="${Y(l.v)-5}" text-anchor="end" class="halo" style="fill:${l.c}">${esc(l.label)}</text>`;});
  svg.innerHTML=g;return{L,R,T,B,W,H,gw};}
/* ---------- chart colours (item 49): green good, yellow watch, red bad ---------- */
const PNC=v=>v<0?"var(--stop)":"var(--go)";const SCC=v=>v<=3?"var(--go)":v<=6?"var(--amber)":"var(--stop)";
/* ---------- extra chart types (item 50) ---------- */
function cutT(c,n){c=String(c);return c.length>n?c.slice(0,n-1)+"…":c;}
function drawPie(svg,o,W,H,donut){const sl=o.slices.filter(s=>s.v>0);const tot=sl.reduce((a,s)=>a+s.v,0);
  const narrow=W<460;const r=narrow?Math.min(W/2-24,110):Math.min(H/2-16,W*0.2);const cx=narrow?W/2:r+28,cy=r+16;
  if(narrow)H=Math.round(cy+r+24+sl.length*24);svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  if(!tot){svg.innerHTML=`<text x="${W/2}" y="${H/2}" text-anchor="middle">Nothing to show yet</text>`;return{W,H};}
  let a=-Math.PI/2,g="";const P=(ang,rr)=>`${(cx+rr*Math.cos(ang)).toFixed(1)},${(cy+rr*Math.sin(ang)).toFixed(1)}`;
  sl.forEach(s=>{const f=s.v/tot;const a2=a+f*2*Math.PI;const tt=`<title>${esc(s.label)}: ${o.fmt(s.v)} (${Math.round(f*100)}%)</title>`;
    g+=f>0.9999?`<circle cx="${cx}" cy="${cy}" r="${r}" style="fill:${s.c}">${tt}</circle>`:`<path d="M${cx},${cy} L${P(a,r)} A${r},${r} 0 ${f>0.5?1:0} 1 ${P(a2,r)} Z" style="fill:${s.c};stroke:var(--surface);stroke-width:2">${tt}</path>`;
    if(f>=0.07){const m=(a+a2)/2;const rr=donut?r*0.8:r*0.62;g+=`<text x="${(cx+rr*Math.cos(m)).toFixed(1)}" y="${(cy+rr*Math.sin(m)+4).toFixed(1)}" text-anchor="middle" class="halo" style="fill:var(--ink);font-weight:600">${Math.round(f*100)}%</text>`;}
    a=a2;});
  if(donut)g+=`<circle cx="${cx}" cy="${cy}" r="${(r*0.58).toFixed(1)}" style="fill:var(--surface)"/><text x="${cx}" y="${cy+2}" text-anchor="middle" style="fill:var(--ink);font:700 ${r>80?18:14}px var(--body)">${o.fmt(tot)}</text><text x="${cx}" y="${cy+20}" text-anchor="middle">${esc(o.totalLabel||"Total")}</text>`;
  const lx=narrow?18:cx+r+36;let ly=narrow?cy+r+30:Math.max(24,cy-sl.length*12+8);
  sl.forEach(s=>{g+=`<rect x="${lx}" y="${ly-10}" width="12" height="12" rx="3" style="fill:${s.c}"/><text x="${lx+20}" y="${ly}" style="fill:var(--ink);font-family:var(--body);font-size:13px">${esc(cutT(s.label,narrow?22:30))}</text><text x="${Math.min(W-12,lx+(narrow?W-40:300))}" y="${ly}" text-anchor="end">${o.fmt(s.v)} · ${Math.round(s.v/tot*100)}%</text>`;ly+=24;});
  svg.innerHTML=g;return{W,H};}
function drawWaterfall(svg,o,W,H){const R=10,T=22,B=32;let acc=0;
  const bars=o.items.map(it=>{if(it.total){acc=it.v;return{lo:Math.min(0,it.v),hi:Math.max(0,it.v),it,end:it.v};}const s=acc;acc+=it.v;return{lo:Math.min(s,acc),hi:Math.max(s,acc),it,end:acc};});
  let ys=[0];bars.forEach(b=>ys.push(b.lo,b.hi));const t=ticks(Math.min(...ys),Math.max(...ys));const L=yLab(t,o.yFmt);
  const Y=v=>T+(H-T-B)*(t.hi-v)/((t.hi-t.lo)||1);const gw=(W-L-R)/Math.max(1,bars.length);const bw=Math.max(14,Math.min(64,gw*0.62));
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);let g="";
  for(let v=t.lo;v<=t.hi+t.st/2;v+=t.st){const z=Math.abs(v)<t.st/1e6;g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line);stroke-width:${z?1.6:1}" ${z?"":'stroke-dasharray="3 4"'}/><text x="${L-8}" y="${Y(v)+4}" text-anchor="end">${o.yFmt(v)}</text>`;}
  const maxc=Math.max(3,Math.floor(gw/6.6));
  bars.forEach((b,i)=>{const x=L+gw*i+(gw-bw)/2;const y1=Y(b.hi),y0=Y(b.lo);
    g+=`<rect x="${x}" y="${y1}" width="${bw}" height="${Math.max(y0-y1,1)}" rx="3" style="fill:${b.it.c}"><title>${esc(b.it.label)}: ${o.yFmt(b.it.v)}</title></rect>`;
    const lab=(b.it.total?"":b.it.v>=0?"+":"−")+o.yFmt(Math.abs(b.it.v)).replace(/^-/,"");
    g+=`<text x="${x+bw/2}" y="${y1-6}" text-anchor="middle" class="halo" style="fill:var(--ink)">${b.it.total?o.yFmt(b.it.v):lab}</text>`;
    if(i<bars.length-1){const nx=L+gw*(i+1)+(gw-bw)/2;g+=`<line x1="${x+bw}" x2="${nx}" y1="${Y(b.end)}" y2="${Y(b.end)}" style="stroke:var(--muted);stroke-width:1" stroke-dasharray="2 3"/>`;}
    g+=`<text x="${L+gw*i+gw/2}" y="${H-10}" text-anchor="middle"><title>${esc(b.it.label)}</title>${esc(cutT(b.it.label,maxc))}</text>`;});
  svg.innerHTML=g;return{W,H};}
function drawRadar(svg,o,W,H){const n=o.cats.length;const cx=W/2,cy=H/2+4;const r=Math.max(40,Math.min(W/2-(W<460?70:120),H/2-30));const mx=o.max||10;
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);const A=i=>-Math.PI/2+i*2*Math.PI/n;const pt=(i,v)=>[cx+r*v/mx*Math.cos(A(i)),cy+r*v/mx*Math.sin(A(i))];
  let g="";[0.2,0.4,0.6,0.8,1].forEach(f=>{g+=`<polygon points="${o.cats.map((_,i)=>pt(i,mx*f).map(z=>z.toFixed(1)).join(",")).join(" ")}" style="fill:none;stroke:var(--line)"/>`;});
  o.cats.forEach((c,i)=>{const[x,y]=pt(i,mx);g+=`<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" style="stroke:var(--line)"/>`;
    const[lx,ly]=pt(i,mx*1.12);const co=Math.cos(A(i));g+=`<text x="${lx.toFixed(1)}" y="${(ly+4).toFixed(1)}" text-anchor="${Math.abs(co)<0.3?"middle":co>0?"start":"end"}"><title>${esc(c)}</title>${esc(cutT(c,W<460?12:22))}</text>`;});
  o.series.forEach(s=>{g+=`<polygon points="${s.vals.map((v,i)=>pt(i,+v||0).map(z=>z.toFixed(1)).join(",")).join(" ")}" style="fill:${s.c};fill-opacity:.12;stroke:var(--ink);stroke-width:1.5"/>`;
    s.vals.forEach((v,i)=>{const[x,y]=pt(i,+v||0);g+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" style="fill:${s.cs?s.cs[i]:s.c};stroke:var(--surface);stroke-width:2"><title>${esc(o.cats[i])}: ${o.fmt(v)}</title></circle>`;});});
  svg.innerHTML=g;return{W,H};}
function drawFunnel(svg,o,W,H){const n=o.items.length;const narrow=W<460;const bwMax=narrow?W*0.48:W*0.5;const cxb=12+bwMax/2;const rh=(H-16)/n;const mx=Math.max(...o.items.map(i=>i.v),1);
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);let g="";
  o.items.forEach((it,i)=>{const w=Math.max(10,bwMax*Math.sqrt(Math.max(0,it.v)/mx));const y=8+rh*i;const h=rh-10;
    g+=`<rect x="${(cxb-w/2).toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" rx="6" style="fill:${it.c}"><title>${esc(it.label)}: ${o.fmt(it.v)}</title></rect>`;
    const tx=12+bwMax+16;g+=`<text x="${tx}" y="${y+h/2-3}" style="fill:var(--ink);font-family:var(--body);font-size:13px;font-weight:600">${esc(it.label)}</text><text x="${tx}" y="${y+h/2+14}">${o.fmt(it.v)}${it.sub?" · "+esc(it.sub):""}</text>`;});
  svg.innerHTML=g;return{W,H};}
function drawCircles(svg,o){const W=600,H=320,R0=150;const r1=R0,r2=Math.max(R0*Math.sqrt(o.sam/(o.tam||1)),24),r3=Math.max(R0*Math.sqrt(o.som/(o.tam||1)),10);
  const cx=170,by=H-10;const c=(r,f,s)=>`<circle cx="${cx}" cy="${by-r}" r="${r}" style="fill:${f};stroke:${s||"none"}"/>`;
  const lab=(y,ty,t,v,s)=>`<line x1="${cx}" y1="${y}" x2="${370}" y2="${ty}" style="stroke:var(--line)"/><text x="380" y="${ty-4}" style="fill:var(--ink);font-family:var(--body);font-size:13px;font-weight:600">${t}</text><text x="380" y="${ty+13}">${v}${s?" · "+s:""}</text>`;
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  svg.innerHTML=c(r1,"var(--sunk)","var(--line)")+c(r2,"var(--amber-soft)","var(--amber)")+c(r3,"var(--go)")+
    lab(by-2*r1+16,40,"TAM · total addressable",o.fmt(o.tam))+lab(by-2*r2+12,130,"SAM · serviceable",o.fmt(o.sam),o.samS)+lab(by-r3,230,"SOM · obtainable",o.fmt(o.som),o.somS);
  return{W,H};}

/* line <-> bar conversions */
function lineToBar(o){const n=o.xs.length;const k=Math.min(n,8);const idx=[];for(let i=0;i<k;i++)idx.push(Math.round(i*(n-1)/Math.max(1,k-1)));
  return{cats:idx.map(i=>o.xFmt(o.xs[i])),catName:"",yFmt:o.yFmt,series:o.series.map(s=>({n:s.n,c:s.c,cs:s.csFn?idx.map(i=>s.csFn(s.ys[i])):undefined,vals:idx.map(i=>s.ys[i])}))};}
function barToLine(o){const cats=o.cats;return{xs:cats.map((_,i)=>i),xTicks:cats.length,xFmt:v=>Number.isInteger(v)&&cats[v]!==undefined?cutT(cats[v],12):"",xName:v=>(o.catName||"")+cats[v],yFmt:o.yFmt,zero:true,hlines:o.lines,
  series:o.series.map(s=>({n:s.n,c:s.c,ys:s.vals.map(v=>+v||0)})),dots:[].concat(...o.series.filter(s=>s.cs).map(s=>s.vals.map((v,i)=>({x:i,y:+v||0,c:s.cs[i]}))))};}

/* chart registry + view switcher */
const CV_NAMES={line:"Line",bar:"Bar",stack:"By step",waterfall:"Waterfall",donut:"Donut",pie:"Pie",radar:"Radar",funnel:"Funnel",circles:"Circles"};
let CVIEW={};try{CVIEW=JSON.parse(localStorage.getItem("chart-views")||"{}")||{};}catch(e){CVIEW={};}
function cvGet(id,c){const v=CVIEW[id];return c.views&&c.views.includes(v)?v:(c.views?c.views[0]:c.kind);}
function viewOf(c,v){if(v===c.kind||(v==="stack"&&c.kind==="bar"))return{kind:c.kind,o:c.o};
  if(v==="bar"&&c.kind==="line")return{kind:"bar",o:lineToBar(c.o)};if(v==="line"&&c.kind==="bar")return{kind:"line",o:barToLine(c.o)};
  const alt=c.alt&&c.alt[v];return{kind:v,o:typeof alt==="function"?alt():alt};}
function drawView(svg,k,W,H){if(k.kind==="line")return drawLine(svg,k.o,W,H);if(k.kind==="bar")return drawBars(svg,k.o,W,H);if(k.kind==="waterfall")return drawWaterfall(svg,k.o,W,H);
  if(k.kind==="pie"||k.kind==="donut")return drawPie(svg,k.o,W,H,k.kind==="donut");if(k.kind==="radar")return drawRadar(svg,k.o,W,H);if(k.kind==="funnel")return drawFunnel(svg,k.o,W,H);if(k.kind==="circles")return drawCircles(svg,k.o);}
function viewH(k,W){const s=W<500;return k.kind==="line"?Math.round(((k.o&&k.o.H)||260)*(s?1.15:1)):k.kind==="radar"?(s?300:320):k.kind==="funnel"?(s?240:260):k.kind==="pie"||k.kind==="donut"?(s?300:260):(s?300:260);}
function cvBar(id,c){const svg=$(id);if(!svg)return;const box=svg.closest(".chartbox");if(!box)return;let bar=box.previousElementSibling;
  const has=bar&&bar.classList.contains("cview");if(!c.views||c.views.length<2){if(has)bar.remove();return;}
  if(!has){bar=document.createElement("div");bar.className="seg cview";bar.setAttribute("role","group");bar.setAttribute("aria-label","Chart type");box.parentNode.insertBefore(bar,box);}
  const cur=cvGet(id,c);bar.dataset.cv=id;bar.innerHTML=`<span class="cvl">View</span>`+c.views.map(v=>`<button type="button" data-cvset="${v}" aria-pressed="${v===cur}">${CV_NAMES[v]||v}</button>`).join("");}
function drawChartId(id){const c=CHARTS[id];const svg=$(id);if(!c||!svg)return;cvBar(id,c);const k=viewOf(c,cvGet(id,c));const W=boxW(svg);
  svg.dataset.cvkind=k.kind;const card=svg.closest(".card");if(card)card.querySelectorAll(`[data-legend-for="${id}"]`).forEach(l=>l.hidden=!!(l.dataset.legendViews&&!l.dataset.legendViews.split(" ").includes(cvGet(id,c))));
  drawView(svg,k,W,viewH(k,W));}
function regChart(id,kind,o,opt){CHARTS[id]=Object.assign({kind,o},opt||{});drawChartId(id);}
function lineChart(id,o,opt){regChart(id,"line",o,opt);}
function barChart(id,o,opt){regChart(id,"bar",o,opt);}
document.addEventListener("click",e=>{const b=e.target.closest("[data-cvset]");if(!b)return;const bar=b.closest("[data-cv]");if(!bar)return;e.stopPropagation();
  CVIEW[bar.dataset.cv]=b.dataset.cvset;try{localStorage.setItem("chart-views",JSON.stringify(CVIEW));}catch(err){}drawChartId(bar.dataset.cv);},true);

/* ---------- chart zoom (click any chart) ---------- */
let CM=null;
function openChart(box){const svg=box.querySelector("svg");if(!svg)return;const card=box.closest(".card");
  let p=box.previousElementSibling,head="";for(let i=0;i<3&&p;i++,p=p.previousElementSibling){if(/H4/.test(p.tagName)){head=p.textContent;break;}}
  if(!head)head=card&&card.querySelector("h3")?card.querySelector("h3").textContent:"Chart";
  $("cmTitle").textContent=head;const c=CHARTS[svg.id];const k=c?viewOf(c,cvGet(svg.id,c)):null;
  const lg=(k&&k.kind!=="line"&&k.kind!=="bar")?null:(box.parentNode.querySelector(".legend")||(card&&card.querySelector(".legend")));$("cmLegend").innerHTML=lg?lg.innerHTML:"";
  $("chartModal").hidden=false;const m=$("cmSvg");const W=Math.max(320,$("cmSvg").parentElement.clientWidth||900);const H=Math.round(Math.min(560,Math.max(300,W*0.5)));
  $("cmTip").hidden=true;
  if(!c){m.setAttribute("viewBox",svg.getAttribute("viewBox"));m.innerHTML=svg.innerHTML;CM=null;$("cmHint").hidden=true;}
  else{const geo=drawView(m,k,W,H);const hov=k.kind==="line"||k.kind==="bar";$("cmHint").hidden=!hov;CM=hov?{kind:k.kind,o:k.o,geo}:null;}
  $("chartModal").querySelector(".xbtn").focus();}
function closeModal(id){$(id).hidden=true;if(id==="chartModal")CM=null;}
function chartHover(ev){if(!CM)return;const m=$("cmSvg");const r=m.getBoundingClientRect();const pt=ev.touches?ev.touches[0]:ev;
  const g=CM.geo,o=CM.o;const sx=(pt.clientX-r.left)*(g.W/r.width);if(sx<g.L||sx>g.W-g.R){$("cmTip").hidden=true;const gd=m.querySelector(".guide");if(gd)gd.remove();return;}
  let idx,x,lines,head;
  if(CM.kind==="line"){const xs=o.xs;const xv=xs[0]+(sx-g.L)/(g.W-g.L-g.R)*(xs[xs.length-1]-xs[0]);idx=0;xs.forEach((v,i)=>{if(Math.abs(v-xv)<Math.abs(xs[idx]-xv))idx=i;});
    x=g.X(xs[idx]);head=o.xName?o.xName(xs[idx]):o.xFmt(xs[idx]);lines=o.series.map(s=>`<span><i class="dot" style="background:${s.c}"></i> ${esc(s.n||"Value")}: ${o.yFmt(s.ys[idx])}</span>`);}
  else{idx=Math.min(o.cats.length-1,Math.max(0,Math.floor((sx-g.L)/g.gw)));x=g.L+g.gw*idx+g.gw/2;head=(o.catName||"")+o.cats[idx];lines=o.series.map(s=>`<span><i class="dot" style="background:${s.cs?s.cs[idx]:s.c}"></i> ${esc(s.n||"Value")}: ${o.yFmt(s.vals[idx])}</span>`);}
  let gd=m.querySelector(".guide");if(!gd){gd=document.createElementNS("http://www.w3.org/2000/svg","line");gd.setAttribute("class","guide");m.appendChild(gd);}
  gd.setAttribute("x1",x);gd.setAttribute("x2",x);gd.setAttribute("y1",g.T);gd.setAttribute("y2",g.H-g.B);gd.setAttribute("style","stroke:var(--ink);stroke-width:1;stroke-dasharray:2 3");
  const tip=$("cmTip");tip.innerHTML=`<b>${esc(head)}</b>${lines.join("<br>")}`;tip.hidden=false;
  const px=x*(r.width/g.W);tip.style.left=Math.min(Math.max(px,90),r.width-90)+"px";tip.style.top=Math.max(40,(pt.clientY-r.top))+"px";}
document.addEventListener("click",e=>{const box=e.target.closest(".chartbox");if(box&&!e.target.closest(".modal")){openChart(box);return;}
  const x=e.target.closest("[data-close]");if(x){closeModal(x.dataset.close);return;}
  if(e.target.classList&&e.target.classList.contains("modal")){closeModal(e.target.id);}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){["chartModal","profileModal","hireModal"].forEach(id=>{if(!$(id).hidden)closeModal(id);});}});
$("cmSvg").addEventListener("mousemove",chartHover);$("cmSvg").addEventListener("touchmove",e=>{chartHover(e);},{passive:true});$("cmSvg").addEventListener("touchstart",chartHover,{passive:true});
let rzT;window.addEventListener("resize",()=>{clearTimeout(rzT);rzT=setTimeout(()=>{if(!$("sim").hidden)render();if(typeof opsRender==="function")opsRender();},150);});

/* ---------- KPIs + trace ---------- */
let traceKey="op";
function traceLines(k,b,M){const s=S;const L=[];
  const net=["Net selling price","List price × (1 − discount)",`${money2(s.price)} × (1 − ${s.discount}%) = ${money2(b.net)}`];
  const rev=["Revenue","Units sold × net price",`${num(b.vol)} × ${money2(b.net)} = ${money(b.rev)}`];
  const vc=["Variable costs","Units sold × variable cost per unit",`${num(b.vol)} × ${money2(s.varcost)} = ${money(b.vc)}`];
  const gp=["Gross profit","Revenue − variable costs",`${money(b.rev)} − ${money(b.vc)} = ${money(b.gp)}`];
  const cu=["Customers","Units sold ÷ units per customer",`${num(b.vol)} ÷ ${s.upc} = ${num(b.customers)}`];
  const acq=["Customer acquisition costs","Customers × acquisition cost",`${num(b.customers)} × ${money2(s.cac)} = ${money(b.acq)}`];
  const op=["Operating profit","Gross profit − fixed costs − acquisition costs",`${money(b.gp)} − ${money(s.fixed)} − ${money(b.acq)} = ${money(b.op)}`];
  const cm=["Contribution margin per unit","Net price − variable cost per unit",`${money2(b.net)} − ${money2(s.varcost)} = ${money2(b.cm)}`];
  switch(k){
    case"rev":return[net,rev];
    case"gp":return[net,rev,vc,gp];
    case"gm":return[net,rev,vc,gp,["Gross margin","Gross profit ÷ revenue",`${money(b.gp)} ÷ ${money(b.rev)} = ${pct(b.gm)}`]];
    case"op":return[net,rev,vc,gp,cu,acq,op];
    case"om":return[net,rev,vc,gp,cu,acq,op,["Operating margin","Operating profit ÷ revenue",`${money(b.op)} ÷ ${money(b.rev)} = ${pct(b.om)}`]];
    case"be":return[net,cm,["Break-even volume","Fixed costs ÷ contribution margin",`${money(s.fixed)} ÷ ${money2(b.cm)} = ${num(b.be)} units`],
      ["Including acquisition costs","Fixed costs ÷ (contribution margin − acquisition cost per unit)",`${money(s.fixed)} ÷ (${money2(b.cm)} − ${money2(b.cacU)}) = ${num(b.beAcq)} units`]];
    case"ppu":return[net,rev,vc,gp,cu,acq,op,["Profit per unit","Operating profit ÷ units sold",`${money(b.op)} ÷ ${num(b.vol)} = ${money2(b.ppu)}`]];
    case"share":return[net,rev,["TAM","Your input on the Market step",`${money(M.tam)}`,"market:c-tam"],
      S.samMode==="manual"?["SAM","Entered directly on the Market step",`${money(M.sam)}`,"market:c-sam"]:["SAM","TAM × share of TAM you can serve",`${money(M.tam)} × ${S.samPct}% = ${money(M.sam)}`,"market:c-samPct"],
      ["Estimated market share","Your revenue ÷ SAM",`${money(b.rev)} ÷ ${money(M.sam)} = ${pct(M.planShare,2)}`]];
  }}
const KPIS=[["rev","Revenue"],["gp","Gross profit"],["gm","Gross margin"],["op","Operating profit"],["om","Operating margin"],["be","Break-even volume"],["ppu","Profit per unit"],["share","Est. market share"]];
function renderKpis(b,M){
  const v={rev:[money(b.rev),"per year"],gp:[money(b.gp),"per year"],gm:[pct(b.gm),"of revenue"],op:[money(b.op),"per year"],om:[pct(b.om),"of revenue"],
    be:[num(b.be)+" units",`${num(b.beAcq)} incl. acquisition`],ppu:[money2(b.ppu),"after all costs"],share:[pct(M.planShare,2),"of SAM"]};
  const neg={op:b.op<0,om:b.om<0,ppu:b.ppu<0,gp:b.gp<0};
  $("kpis").innerHTML=KPIS.map(([k,l])=>`<button type="button" class="kpi" data-trace="${k}" aria-pressed="${traceKey===k}"><span>${l}</span><b class="${neg[k]?"neg":""}">${v[k][0]}</b><i>${v[k][1]}</i></button>`).join("");
  const lines=traceLines(traceKey,b,M);const name=KPIS.find(x=>x[0]===traceKey)[1];
  $("trace").innerHTML=`<div class="row"><h4>How ${name.toLowerCase()} is calculated</h4><span class="spacer"></span><span class="chip in">Your inputs</span><span class="chip calc">Calculated</span></div><ol>${lines.map(l=>`<li><b>${l[0]}</b> = ${l[1]}${l[3]?`<a class="goto" data-goto="${l[3]}" href="#">Edit in Market →</a>`:""}<br><code>${l[2]}</code></li>`).join("")}</ol>`;
}
document.addEventListener("click",e=>{const t=e.target.closest("[data-trace]");if(t){traceKey=t.dataset.trace;render();}
  const gt=e.target.closest("[data-goto]");if(gt){e.preventDefault();const[tab,id]=gt.dataset.goto.split(":");jumpTo(tab,id);}});
function jumpTo(tab,id){go(tab);const el0=$(id);if(!el0)return;const el=el0.closest(".field")||el0;setTimeout(()=>{el.scrollIntoView({behavior:"smooth",block:"center"});el.classList.remove("flash");void el.offsetWidth;el.classList.add("flash");if(el0.focus)el0.focus({preventScroll:true});},40);}

function renderBE(b,R){
  const be=b.beAcq;const xmax=Math.max(b.vol,isFinite(be)?be:0)*1.6||1000;const xs=[];for(let i=0;i<=40;i++)xs.push(xmax*i/40);
  const cost=x=>S.fixed+(S.varcost+b.cacU)*x;
  const dots=[{x:b.vol,y:b.rev,c:"var(--ink)",label:"You today"}];if(isFinite(be))dots.push({x:be,y:be*b.net,c:"var(--amber)",label:"Break-even"});
  const fx=b.rev-b.vc-b.acq-b.op;
  lineChart("c-be",{xs,series:[{n:"Revenue",c:"var(--ink)",ys:xs.map(x=>x*b.net)},{n:"Total costs",c:"var(--stop)",ys:xs.map(cost)}],xFmt:v=>num(v),xName:v=>num(v)+" units a year",yFmt:money,dots,zero:true},
    {views:["line","waterfall"],alt:{waterfall:{yFmt:money,items:[{label:"Revenue",v:b.rev,c:"var(--ink)",total:true},{label:"Variable costs",v:-b.vc,c:"var(--stop)"},{label:"Acquisition",v:-b.acq,c:"var(--stop)"},{label:"Fixed costs",v:-fx,c:"var(--stop)"},{label:"Operating profit",v:b.op,c:b.op>=0?"var(--go)":"var(--stop)",total:true}]}}});
  const yr=m=>m===null?"Not within "+S.horizon+" yrs":"Year "+Math.ceil(m/12);
  const f=(l,v,i)=>`<div class="befact"><span>${l}</span><b>${v}</b><i>${i}</i></div>`;
  $("be-facts").innerHTML=f("Break-even volume, each year",isFinite(be)?num(be)+" units":"None",isFinite(be)?`You plan ${num(b.vol)}, ${b.vol>=be?num(b.vol-be)+" above":num(be-b.vol)+" below"} it. Includes acquisition costs.`:"Each sale loses money after acquisition costs.")+
    f("Investment paid back, entering alone",yr(R.E.payback),R.E.payback?`Month ${R.E.payback}, on ${money(R.E.inv)} invested`:`${money(R.E.inv)} invested is not recovered`)+
    f("Investment paid back, with a partner",yr(R.P.payback),R.P.payback?`Month ${R.P.payback}, on ${money(R.P.inv)} invested`:`${money(R.P.inv)} invested is not recovered`);
}

function renderCockpit(b,M,R){const sc=scenario(S,S["sc"+S.sel]);const EN=R.EN;
  const row=(t,vals)=>`<div class="cock"><h4>${t}</h4><div class="vals">${vals.map(v=>`<div class="v"><span>${v[0]}</span><b class="${v[2]||""}">${v[1]}</b></div>`).join("")}</div></div>`;
  const imp=sc.rev-b.rev;
  $("cockpit").innerHTML=
    row("Market opportunity",[["TAM",money(M.tam)],["SAM",money(M.sam)],["SOM",money(M.som)],["Growth",S.growth+"% a year"]])+
    row("Financial model",[["Revenue",money(b.rev)],["Gross profit",money(b.gp)],["Operating profit",money(b.op),b.op<0?"neg":""],["Operating margin",pct(b.om)]])+
    row("Pricing",[["Current price",money2(S.price)],[`Scenario ${S.sel} price`,money2(sc.list)],["Expected volume",num(sc.vol)],["Elasticity",el(S.elastic)],["Revenue impact",(imp>=0?"+":"")+money(imp),imp<0?"neg":"pos"]])+
    row("Profitability",[["Break-even volume",num(b.be)],["Contribution margin",money2(b.cm)],["Profit per unit",money2(b.ppu)],["ROI (enter)",pct(R.E.roi,0)]])+
    row("Market entry",[["Entry difficulty",EN.score.toFixed(1)+" / 10"],["Investment",money(S.invest)],["Time to break-even",months(R.E.payback)]])+
    `<div class="cock"><h4>Strategy</h4><div class="strat3">${["ENTER","PARTNER","DON'T ENTER"].map(c=>`<span class="chip ${c===R.call?(c==="ENTER"?"go":c==="PARTNER"?"in":"stop"):"in"}">${c===R.call?"Recommended: ":""}${c}</span>`).join("")}<button class="pill sm ghost" type="button" data-go="strategy">See why</button></div></div>`;
}

/* ---------- pricing ---------- */
function elasticType(e){return e<-1.05?["elastic","Elastic","A price rise is likely to cut revenue, because volume falls faster than price rises.","stop"]:
  e>-0.95?["inelastic","Inelastic","A price rise is likely to grow revenue, because volume falls more slowly than price rises.","go"]:
  ["unit","Unit elastic","Price changes leave revenue roughly unchanged.","warn"];}
function renderPricing(b){
  const e=S.elastic;
  $("el-explain").textContent=`An elasticity of ${el(e)} means a 1% price increase is expected to cut volume by about ${Math.abs(e).toFixed(1)}%, assuming nothing else changes.`;
  const es=[-0.5,-1,-1.5];if(!es.some(x=>Math.abs(x-e)<1e-9))es.push(e);
  $("teach").innerHTML=es.sort((a,c)=>c-a).map(x=>{const r=scenario(S,S.price*1.1,x);const d=r.rev/b.rev-1;
    const res=Math.abs(d)<0.015?["Roughly unchanged","warn"]:d>0?["Revenue increases","go"]:["Revenue decreases","stop"];
    return `<tr class="${Math.abs(x-e)<1e-9?"hl":""}"><td>${el(x)}${Math.abs(x-e)<1e-9?" (yours)":""}</td><td>+10%</td><td>${spct(r.vol/S.volume-1,0)}</td><td>${spct(d)}</td><td><span class="chip ${res[1]}">${res[0]}</span></td></tr>`;}).join("");
  const t=elasticType(e);$("el-type").className="callout "+t[3];$("el-type").innerHTML=`<strong>Your assumption: ${t[1]} (${el(e)})</strong><p class="small">${t[2]}</p>`;

  $("selSeg").innerHTML=["A","B","C"].map(k=>`<button type="button" data-sel="${k}" aria-pressed="${S.sel===k}">Scenario ${k}</button>`).join("");
  const cols=[Object.assign(base(S),{pct:0}),scenario(S,S.scA),scenario(S,S.scB),scenario(S,S.scC)];
  const rows=[["List price",c=>money2(c.list)],["Discount",c=>S.discount+"%"],["Net selling price",c=>money2(c.net)],["Price change",c=>spct(c.pct)],["Expected volume",c=>num(c.vol)],
    ["Revenue",c=>money(c.rev),"rev"],["Variable costs",c=>money(c.vc)],["Gross profit",c=>money(c.gp),"gp"],["Gross margin",c=>pct(c.gm),"gm"],["Acquisition costs",c=>money(c.acq)],
    ["Operating profit",c=>money(c.op),"op"],["Operating margin",c=>pct(c.om),"om"]];
  const best={};["rev","gp","gm","op","om"].forEach(k=>{let bi=0;cols.forEach((c,i)=>{if(c[k]>cols[bi][k]+1e-9)bi=i;});best[k]=bi;});
  $("sc-table").innerHTML=rows.map(([l,f,k])=>`<tr><td>${l}</td>${cols.map((c,i)=>`<td class="${k&&best[k]===i?"best":""}">${f(c)}${k&&best[k]===i?'<span class="win">Highest</span>':""}</td>`).join("")}</tr>`).join("");
  const names=["Current","Scenario A","Scenario B","Scenario C"];
  const ins=$("sc-insight");
  if(best.rev!==best.op){ins.className="callout warn";ins.innerHTML=`<strong>The highest revenue isn't the highest profit.</strong><p class="small">${names[best.rev]} brings in the most revenue (${money(cols[best.rev].rev)}), but ${names[best.op]} makes the most operating profit (${money(cols[best.op].op)}). Judge prices on profit, not sales.</p>`;}
  else{ins.className="callout go";ins.innerHTML=`<strong>${names[best.op]} looks strongest.</strong><p class="small">It gives both the highest revenue and the highest operating profit (${money(cols[best.op].op)}) under your elasticity of ${el(e)}.</p>`;}
  barChart("c-scen",{cats:names,catName:"",yFmt:money,hl:best.op,series:[{n:"Revenue",c:"var(--ink)",vals:cols.map(c=>c.rev)},{n:"Gross profit",c:"var(--amber)",vals:cols.map(c=>c.gp)},{n:"Operating profit",c:"var(--go)",cs:cols.map(c=>PNC(c.op)),vals:cols.map(c=>c.op)}]},{views:["bar","line"]});

  /* cause-and-effect chain */
  const sc=scenario(S,S["sc"+S.sel]);const dq=e*sc.pct;
  const alt=Object.assign({},S,{price:sc.list,volume:sc.vol});const R2=recommend(alt);
  $("chain-title").textContent=`Scenario ${S.sel}: from today's ${money2(S.price)} to ${money2(sc.list)}.`;
  const link=(ic,txt,sub,val,cls)=>`<div class="link"><span class="ic">${ic}</span><p>${txt}<small>${sub}</small></p><b class="${cls||""}">${val}</b></div>`;
  const ar='<div class="arrow"></div>';
  $("chain").innerHTML=[
    link(sc.pct>=0?"↑":"↓",`Price ${sc.pct>=0?"increases":"decreases"} by ${pct(Math.abs(sc.pct))}`,`(${money2(sc.list)} − ${money2(S.price)}) ÷ ${money2(S.price)}`,spct(sc.pct)),
    link("×",`Expected volume ${dq<=0?"decreases":"increases"} by ${pct(Math.abs(dq))}`,`elasticity ${el(e)} × ${spct(sc.pct)}`,spct(dq)),
    link("=",`Expected volume becomes ${num(sc.vol)}`,`${num(S.volume)} × (1 ${dq<0?"−":"+"} ${pct(Math.abs(dq))})`,num(sc.vol)),
    link("£",`Revenue becomes ${money(sc.rev)}`,`${num(sc.vol)} units × ${money2(sc.net)} net price`,spct(sc.rev/b.rev-1),sc.rev<b.rev?"neg":"pos"),
    link("−",`Variable and acquisition costs become ${money(sc.vc+sc.acq)}`,`${num(sc.vol)} × (${money2(S.varcost)} + ${money2(b.cacU)} per unit)`,money(sc.vc+sc.acq-b.vc-b.acq)),
    link("=",`Operating profit becomes ${money(sc.op)}`,`today: ${money(b.op)}`,(sc.op>=b.op?"+":"")+money(sc.op-b.op),sc.op<b.op?"neg":"pos"),
    link("→",`Recommendation at this price: ${R2.call}`,R2.call===recommend(S).call?"same as today":"changes from today's call",R2.call)
  ].join(ar);

  /* price curves */
  const pZero=e<0?S.price*(1-1/e):Infinity;let pMax=Math.min(S.price*2,pZero);pMax=Math.max(pMax,Math.min(sc.list*1.05,pZero),S.price*1.1);
  const xs=[];for(let i=0;i<=60;i++)xs.push(S.price*0.5+(pMax-S.price*0.5)*i/60);
  $("price-note").textContent=pZero<S.price*2?`Demand reaches zero at ${money2(pZero)} with your elasticity of ${el(e)}, so the charts stop there.`:"";
  const pts=xs.map(p=>scenario(S,p));
  const marks=[{x:S.price,label:"Today",c:"var(--ink)",dash:true},{x:sc.list,label:"Scenario "+S.sel,c:"var(--amber)"}];
  lineChart("c-price",{xs,series:[{n:"Revenue",c:"var(--ink)",ys:pts.map(p=>p.rev)},{n:"Gross profit",c:"var(--amber)",ys:pts.map(p=>p.gp)},{n:"Operating profit",c:"var(--go)",csFn:PNC,ys:pts.map(p=>p.op)}],xFmt:money,xName:v=>"Price "+money2(v),yFmt:money,marks,zero:true},{views:["line","bar"]});
  lineChart("c-vol",{H:200,xs,series:[{n:"Units a year",c:"var(--ink)",ys:pts.map(p=>p.vol)}],xFmt:money,xName:v=>"Price "+money2(v),yFmt:num,marks,zero:true},{views:["line","bar"]});

  /* elasticity sensitivity */
  const se=[-0.5,-1,-1.5,-2];if(!se.some(x=>Math.abs(x-e)<1e-9))se.push(e);se.sort((a,c)=>c-a);
  const rs=se.map(x=>scenario(S,sc.list,x));
  $("sens-title").textContent=`Scenario ${S.sel} at ${money2(sc.list)} (${spct(sc.pct)}), under different elasticity assumptions.`;
  $("sens").innerHTML=rs.map((r,i)=>`<tr class="${Math.abs(se[i]-e)<1e-9?"hl":""}"><td>${el(se[i])}${Math.abs(se[i]-e)<1e-9?" (yours)":""}</td><td>${num(r.vol)}</td><td>${money(r.rev)}</td><td>${money(r.gp)}</td><td class="${r.op<0?"neg":""}">${money(r.op)}</td><td class="${r.op<b.op?"neg":"pos"}">${(r.op>=b.op?"+":"")+money(r.op-b.op)}</td></tr>`).join("");
  barChart("c-sens",{catName:"Elasticity ",cats:se.map(x=>el(x)),hl:se.findIndex(x=>Math.abs(x-e)<1e-9),yFmt:money,series:[{n:"Revenue",c:"var(--ink)",vals:rs.map(r=>r.rev)},{n:"Gross profit",c:"var(--amber)",vals:rs.map(r=>r.gp)},{n:"Operating profit",c:"var(--go)",cs:rs.map(r=>PNC(r.op)),vals:rs.map(r=>r.op)}]},{views:["bar","line"]});
  const better=se.filter((x,i)=>rs[i].op>b.op);
  $("sens-note").textContent=sc.pct===0?"This scenario keeps today's price, so elasticity doesn't change it. Pick a scenario with a different price.":
    better.length===se.length?`Scenario ${S.sel} beats today's profit at every elasticity tested, so the conclusion is robust.`:
    better.length===0?`Scenario ${S.sel} is worse than today at every elasticity tested.`:
    `Scenario ${S.sel} beats today's profit only when elasticity is ${better.map(el).join(", ")}. The answer depends on how price-sensitive your customers really are, so this is the assumption to test first.`;
}
document.addEventListener("click",e=>{const t=e.target.closest("[data-sel]");if(t){S.sel=t.dataset.sel;render();saveDraft();}});

/* ---------- discounts ---------- */
function renderDiscount(b){
  const ds=[0,5,10,15,20,25,30];if(!ds.includes(S.discount))ds.push(S.discount);ds.sort((a,c)=>a-c);
  $("disc").innerHTML=ds.map(d=>{const r=discountCase(S,d);const ok=r.vol>=r.reqVol-0.5;
    const need=!isFinite(r.reqVol)?'<span class="neg">Not possible: each sale loses money</span>':`<span class="${ok?"pos":"neg"}">${num(r.reqVol)} (${spct(r.reqUplift,0)})</span>`;
    return `<tr class="${d===S.discount?"hl":""}"><td>${d}%${d===S.discount?" (today)":""}</td><td>${money2(r.net)}</td><td>${num(r.vol)}</td><td>${money(r.rev)}</td><td>${money(r.gp)}</td><td>${pct(r.gm)}</td><td class="${r.op<0?"neg":""}">${money(r.op)}</td><td>${need}</td></tr>`;}).join("");
  const xs=[];for(let d=0;d<=50;d++)xs.push(d);const rs=xs.map(d=>discountCase(S,d));
  lineChart("c-disc",{xs,series:[{n:"Revenue",c:"var(--ink)",ys:rs.map(r=>r.rev)},{n:"Gross profit",c:"var(--amber)",ys:rs.map(r=>r.gp)},{n:"Operating profit",c:"var(--go)",csFn:PNC,ys:rs.map(r=>r.op)}],xFmt:v=>v+"%",xName:v=>v+"% discount",yFmt:money,zero:true,
    marks:[{x:S.discount,label:"Today",c:"var(--ink)",dash:true}]},{views:["line","bar"]});
  const bestD=rs.reduce((a,r,i)=>r.op>rs[a].op?i:a,0);
  const d2=Math.min(50,S.discount+10);const r2=discountCase(S,d2);
  const box=$("disc-insight");
  const need=isFinite(r2.reqVol)?`you need about <b>${pct(r2.reqUplift,0)} more volume</b> than today to earn the same operating profit, but your elasticity assumption predicts only <b>${pct(r2.vol/S.volume-1,0)} more</b>`:"every sale would lose money, so no amount of extra volume can make it work";
  box.className="callout "+(r2.vol>=r2.reqVol?"go":"warn");
  box.innerHTML=`<strong>Higher volume does not automatically mean higher profit.</strong><p>At a ${d2}% discount, ${need}. The discount that gives the most operating profit under your assumptions is <b>${xs[bestD]}%</b> (${money(rs[bestD].op)}).</p>`;
}

/* ---------- market ---------- */
function chipFor(k){if((k==="sam"&&S.samMode!=="manual")||(k==="samPct"&&S.samMode==="manual"))return'<span class="chip calc">Calculated</span>';const s=S.src[k]||"user";return s==="ai"?'<span class="chip ai">AI assumption</span>':s==="example"?'<span class="chip ex" title="A made-up starting number. Replace it with yours.">Sample value</span>':'<span class="chip in">User input</span>';}
function renderMarket(b,M){
  document.querySelectorAll("[data-chip]").forEach(c=>c.innerHTML=chipFor(c.dataset.chip));
  CHARTS["c-mkt"]={kind:"circles",views:["circles","funnel","bar"],o:{tam:M.tam,sam:M.sam,som:M.som,fmt:money,samS:pct(M.sam/(M.tam||1),0)+" of TAM",somS:pct(M.somSam,1)+" of SAM"},
    alt:{funnel:{fmt:money,items:[{label:"TAM · total addressable",v:M.tam,c:"var(--s3)"},{label:"SAM · serviceable",v:M.sam,c:"var(--amber)",sub:pct(M.sam/(M.tam||1),0)+" of TAM"},{label:"SOM · obtainable",v:M.som,c:"var(--go)",sub:pct(M.somSam,1)+" of SAM"}]},
      bar:{cats:["TAM","SAM","SOM"],catName:"",yFmt:money,series:[{n:"Market size a year",c:"var(--s3)",cs:["var(--s3)","var(--amber)","var(--go)"],vals:[M.tam,M.sam,M.som]}]}}};drawChartId("c-mkt");
  const man=S.samMode==="manual";const step=(l,v,chip,sub,res)=>`<div class="chain-step${res?" res":""}"><span>${l} ${chip}</span><b>${v}</b>${sub?`<small>${sub}</small>`:""}</div>`;const op=t=>`<div class="chain-op">${t}</div>`;const C='<span class="chip calc">Calculated</span>';
  $("mkt-stats").innerHTML=step("TAM, total addressable market",money(M.tam),chipFor("tam"),"Everyone who could buy this kind of product, per year")+
    op(man?"SAM entered directly":`× ${S.samPct}% you can serve ${chipFor("samPct")}`)+
    step("SAM, serviceable market",money(M.sam),man?chipFor("sam"):C,man?`Implies ${pct(M.samPct,1)} of TAM`:`${money(M.tam)} × ${S.samPct}% = ${money(M.sam)}`,!man)+
    op(`× ${S.share}% you expect to win ${chipFor("share")}`)+
    step("SOM, obtainable market",money(M.som),C,`${money(M.sam)} × ${S.share}% = ${money(M.som)} · ${pct(M.somTam,2)} of TAM`,true)+
    `<div class="row small muted" style="margin-top:6px"><span>Growth ${S.growth}% a year ${chipFor("growth")}</span><span class="spacer"></span><span>SOM in 3 years: <b style="color:var(--ink)">${money(M.som3)}</b></span></div>`;
  const fit=[];
  fit.push(M.planVsSom>1?`<div class="callout warn"><strong>Your sales plan is bigger than your SOM.</strong><p class="small">You plan ${money(b.rev)} a year, ${pct(M.planVsSom,0)} of what you think you can realistically win (${money(M.som)}). Either the plan or the share assumption needs another look.</p></div>`:
    `<div class="callout go"><strong>Your sales plan fits inside your SOM.</strong><p class="small">You plan ${money(b.rev)} a year, ${pct(M.planVsSom,0)} of your obtainable market (${money(M.som)}).</p></div>`);
  fit.push(`<p class="small">Your plan equals <b>${pct(M.planShare,2)}</b> of SAM. That's the "Est. market share" on the Model step.</p>`);
  if(S.pcust&&S.spend){const r=M.bottomUp/(M.sam||1);fit.push(`<p class="small">Bottom-up check: ${num(S.pcust)} potential customers × ${money(S.spend)} = <b>${money(M.bottomUp)}</b>, which is ${pct(r,0)} of your SAM. ${Math.abs(r-1)>0.5?'<span class="neg">That is far from your SAM figure, so one of them is probably off.</span>':'<span class="pos">That broadly supports your SAM.</span>'}</p>`);}
  if(S.currev!==""&&isFinite(+S.currev)&&+S.currev>0){const r=b.rev/S.currev;fit.push(`<p class="small">Your inputs imply ${money(b.rev)} revenue against the ${money(+S.currev)} you entered (${spct(r-1,0)}).</p>`);}
  $("mkt-fit").innerHTML=fit.join("");
}

/* ---------- entry ---------- */
function buildFactors(){$("factors").innerHTML=FACTORS.map(([k,l])=>`<div class="factor"><label for="r-${k}"><span>${l}</span> <span data-echip="${k}"></span></label>
  <div class="sc"><input type="range" id="r-${k}" min="1" max="10" step="1" data-k="f_${k}"><output data-out="${k}"></output></div>
  <div class="inbox"><input type="number" min="0" max="5" step="1" data-k="w_${k}" aria-label="Weight for ${l}"></div>
  <div class="bar"><i data-bar="${k}"></i></div></div>`).join("");}
function renderEntry(EN){S.esrc=S.esrc||{};
  document.querySelectorAll("[data-echip]").forEach(c=>{const k=c.dataset.echip;c.innerHTML=S.esrc[k]==="ai"?'<span class="chip ai">AI assumption</span>':"";});
  EN.rows.forEach(r=>{const o=document.querySelector(`[data-out="${r.k}"]`);if(o)o.textContent=r.score;const bi=document.querySelector(`[data-bar="${r.k}"]`);if(bi){bi.style.width=(r.weight?r.score*10:0)+"%";bi.style.opacity=r.weight?1:.2;bi.style.background=SCC(r.score);}});
  const fl=k=>(FACTORS.find(f=>f[0]===k)||[0,k])[1];const bc=EN.rows.map(r=>fl(r.k)),bv=EN.rows.map(r=>r.score),bcs=bv.map(SCC);
  barChart("c-barr",{cats:bc,catName:"",yFmt:v=>String(Math.round(v*10)/10),series:[{n:"Score out of 10",c:"var(--amber)",cs:bcs,vals:bv}]},{views:["bar","radar"],alt:{radar:{cats:bc,max:10,fmt:v=>v+"/10",series:[{n:"Score",c:"var(--amber)",cs:bcs,vals:bv}]}}});
  $("en-score").textContent=EN.score.toFixed(1);const lab=riskLabel(EN.score);
  $("en-chip").innerHTML=`<span class="chip ${lab==="High"?"stop":lab==="Medium"?"warn":"go"}">${lab} difficulty</span>`;
  $("en-formula").innerHTML=`Weighted average = (${EN.rows.filter(r=>r.weight).map(r=>`<span style="white-space:nowrap">${r.score}×${r.weight}</span>`).join(" + ")}) ÷ ${EN.den} = <b>${EN.score.toFixed(1)}</b>`;
  $("en-top").innerHTML=EN.top.map(r=>`<li>${r.label}: ${r.score}/10${r.weight!==1?`, weight ${r.weight}`:""}</li>`).join("");
}

/* ---------- strategy ---------- */
function recText(R){const E=R.E,P=R.P;
  const opp=R.oppRatio>=2?`The market is large relative to your plan (SOM is ${R.oppRatio.toFixed(1)}× your yearly revenue)`:R.oppRatio>=1?"The market can support your plan":"Your plan is bigger than the market you can realistically win";
  if(R.call==="DON'T ENTER")return `${R.reasons.join(" ")} Not entering avoids ${money(S.invest)} of investment and a ${riskLabel(E.risk).toLowerCase()} risk market, with the biggest barrier being ${R.EN.top[0]?R.EN.top[0].label.toLowerCase():"unknown"}.`;
  const W=R.call==="ENTER"?E:P,O=R.call==="ENTER"?P:E,sw=R.call==="ENTER"?R.sE:R.sP,so=R.call==="ENTER"?R.sP:R.sE;
  const pts=[];
  if(W.net>O.net)pts.push(`earns more after investment (${money(W.net)} vs ${money(O.net)})`);
  if(W.inv<O.inv)pts.push(`needs ${money(O.inv-W.inv)} less upfront`);
  if(W.payback&&(!O.payback||W.payback<O.payback))pts.push(`breaks even sooner (month ${W.payback}${O.payback?` vs ${O.payback}`:""})`);
  if(W.risk<O.risk)pts.push(`carries less risk (${W.risk.toFixed(1)} vs ${O.risk.toFixed(1)} out of 10)`);
  if(W.ttm<O.ttm)pts.push(`reaches customers ${O.ttm-W.ttm} months earlier`);
  const trade=O.net>W.net?` ${R.call==="ENTER"?"Partnering":"Entering alone"} could earn more (${money(O.net)}), but it scores lower overall.`:"";
  return `${opp} and expected profit is positive. ${R.call==="ENTER"?"Entering alone":"Partnering"} scores ${sw.total.toFixed(0)} out of 100 against ${so.total.toFixed(0)} because it ${pts.length?pts.join(", "):"balances profit and risk better"}.${trade}`;
}
function renderStrategy(R){
  const cls={"ENTER":"go","PARTNER":"mid","DON'T ENTER":"stop"}[R.call];
  $("verdict").className="verdict "+cls;$("call").textContent=R.call;$("rec-text").textContent=recText(R);
  const E=R.E,P=R.P,H=S.horizon;
  const dl=rows=>`<dl>${rows.map(r=>`<dt>${r[0]}</dt><dd class="${r[2]||""}">${r[1]}</dd>`).join("")}</dl>`;
  const lossOf={"ENTER":R.E.net<0,"PARTNER":R.P.net<0,"DON'T ENTER":false};
  const card=(k,t,sub,rows)=>`<div class="opt ${R.call===k?"rec":lossOf[k]?"loss":""}"><div class="row"><h3>${t}</h3><span class="spacer"></span>${R.call===k?'<span class="chip go">Recommended</span>':""}</div><p class="small muted">${sub}</p>${dl(rows)}</div>`;
  const best=Math.max(E.net,P.net,0);
  const optsH=
    card("ENTER","Enter","Build and sell directly.",[["Required investment",money(E.inv)],[`Expected revenue, ${H} yrs`,money(E.rev)],["Expected profit after investment",money(E.net),E.net<0?"neg":"pos"],["Time to break-even",months(E.payback)],["Expected market share",pct(E.share,2)],["Risk score",`${E.risk.toFixed(1)} · ${riskLabel(E.risk)}`]])+
    card("PARTNER","Partner","Sell through a distributor, reseller, JV or similar.",[["Partner's revenue share",`${S.pShare}% (${money(P.partnerCut)})`],["Acquisition cost saved",money2(P.acqSaved)+" per unit"],["Required investment",money(P.inv)],[`Revenue you keep, ${H} yrs`,money(P.yourRev)],["Expected profit after investment",money(P.net),P.net<0?"neg":"pos"],["Time to market",P.ttm+" months"],["Risk score",`${P.risk.toFixed(1)} · ${riskLabel(P.risk)}`]])+
    card("DON'T ENTER","Don't enter","Keep the money and stay out.",[["Investment avoided",money(E.inv)],["Revenue foregone",money(E.rev)],["Profit foregone",money(best)],["Opportunity foregone",money(R.M.som)+" SOM a year"],["Risk avoided",`${E.risk.toFixed(1)} · ${riskLabel(E.risk)}`]]);
  if($("opts").dataset.h!==optsH){$("opts").innerHTML=optsH;$("opts").dataset.h=optsH;}
  const r=(l,a,b,c)=>`<tr><td>${l}</td><td>${a}</td><td>${b}</td><td>${c}</td></tr>`;
  $("cmp").innerHTML=r("Investment",money(E.inv),money(P.inv),money(0))+r(`Revenue over ${H} yrs`,money(E.rev),money(P.rev),money(0))+r("Revenue you keep",money(E.yourRev),money(P.yourRev),money(0))+
    r("Operating profit",money(E.op),money(P.op),money(0))+r("Profit after investment",money(E.net),money(P.net),money(0))+r("Return on investment",pct(E.roi,0),pct(P.roi,0),"—")+
    r("Time to break-even",months(E.payback),months(P.payback),"—")+r("Time to market",E.ttm+" months",P.ttm+" months","N/A")+r("Market share (average year)",pct(E.share,2),pct(P.share,2),"0%")+
    r("Risk",`${riskLabel(E.risk)} (${E.risk.toFixed(1)})`,`${riskLabel(P.risk)} (${P.risk.toFixed(1)})`,"None");
  const xs=E.cum.map((_,i)=>i);
  lineChart("c-path",{xs,series:[{n:"Enter",c:"var(--go)",ys:E.cum},{n:"Partner",c:"var(--amber)",ys:P.cum}],xFmt:v=>v===0?"Start":"M"+v,xName:v=>v===0?"Start":`Month ${v} (year ${Math.ceil(v/12)})`,yFmt:money,zero:true,xTicks:6});
  const lbl={profit:"Profit after investment",roi:"Return on investment",payback:"Time to break-even",opportunity:"Market opportunity",risk:"Risk (entry difficulty)"};
  $("score").innerHTML=Object.keys(REC_WEIGHTS).map(k=>`<tr><td>${lbl[k]} (${REC_WEIGHTS[k]})</td><td>${R.sE.parts[k].toFixed(1)}</td><td>${R.sP.parts[k].toFixed(1)}</td></tr>`).join("")+
    `<tr class="hl"><td><b>Total (100)</b></td><td><b>${R.sE.total.toFixed(1)}</b></td><td><b>${R.sP.total.toFixed(1)}</b></td></tr>`;
  $("score-rule").textContent=`Rule: the option with the higher total wins. If both lose money over ${H} years, or the best total is under ${R.threshold}, the call is Don't Enter. Profit points are relative to the better option; ROI earns full points at 100%; break-even earns more the earlier it comes; opportunity compares SOM with your yearly revenue; risk uses the entry difficulty score.`;
}

function syncSam(){if(S.samMode!=="manual")S.sam=samOf(S);else if(S.tam)S.samPct=Math.round(S.sam/S.tam*1000)/10;
  document.querySelectorAll('[data-k="sam"]').forEach(i=>{i.readOnly=S.samMode!=="manual";if(document.activeElement!==i)i.value=fmtIn(S.sam);});
  document.querySelectorAll('[data-k="samPct"]').forEach(i=>{i.readOnly=S.samMode==="manual";if(document.activeElement!==i)i.value=fmtIn(S.samPct);});
  const cb=$("samManual");if(cb)cb.checked=S.samMode==="manual";}
function renderCompany(){$("coSum").innerHTML=`<b>${esc(S.name||"Your company")}</b> · ${esc(S.product||"Product")} · ${esc(S.geo||"Market")} · ${esc(S.cur)}`;}
/* ---------- render all ---------- */
function render(){syncSam();const b=base(S),M=market(S),R=recommend(S);
  renderKpis(b,M);renderBE(b,R);renderCompany();renderCockpit(b,M,R);renderPricing(b);renderDiscount(b);renderMarket(b,M);renderEntry(R.EN);renderStrategy(R);
  return R;}

/* ---------- tabs ---------- */
const TABS=[["model","Model"],["pricing","Pricing"],["discount","Discounts"],["market","Market"],["entry","Entry difficulty"],["strategy","Recommendation"]];
function go(t){TABS.forEach(([k])=>{$("p-"+k).hidden=k!==t;});setTimeout(()=>render(),0);document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===t));
  try{localStorage.setItem("mes-tab",t);}catch(e){}}
$("tabs").innerHTML=TABS.map(([k,l],i)=>`<button type="button" role="tab" data-tab="${k}"><span class="n">${i+1}</span>${l}</button>`).join("");
document.addEventListener("click",e=>{const t=e.target.closest("[data-tab]");if(t){go(t.dataset.tab);}
  const g=e.target.closest("[data-go]");if(g){e.preventDefault();if(g.dataset.go==="save"){$("savebar").scrollIntoView({behavior:"smooth"});return;}go(g.dataset.go);$("app").scrollIntoView({behavior:"smooth"});}
  const v=e.target.closest("[data-view]");if(v&&["home","sim","ops"].includes(v.dataset.view)){e.preventDefault();setView(v.dataset.view);}
  const sc=e.target.closest("[data-scroll]");if(sc){e.preventDefault();$(sc.dataset.scroll).scrollIntoView({behavior:"smooth"});}});
function setView(v){if(!["home","sim","ops"].includes(v))v="home";$("home").hidden=v!=="home";$("sim").hidden=v!=="sim";const ops=$("ops");if(ops)ops.hidden=v!=="ops";$("navHome").hidden=v==="home";
  document.title=v==="sim"?"Market Entry Simulator · BBC":v==="ops"?"Operations Bottleneck Diagnoser · BBC":"BBC · Big Brain Consulting";
  if(v==="sim")setTimeout(render,0);if(v==="ops"&&typeof opsRender==="function")setTimeout(opsRender,0);window.scrollTo(0,0);}

/* ---------- build page ---------- */
fill("f-company",["name","product","geo"],"a");
fill("f-company2",["cur","currev"],"a");
fill("f-market2",["country","industry","ctype","tam","samPct","sam","share","growth","pcust","spend"],"c");
$("f-market2").querySelector('[data-k="sam"]').closest(".field").insertAdjacentHTML("afterend",`<label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="samManual" style="accent-color:var(--ink)"> I'll enter SAM myself (for example from a report)</label>`);
$("samManual").addEventListener("change",e=>{S.samMode=e.target.checked?"manual":"calc";if(!e.target.checked)S.src.samPct=S.src.samPct||"user";syncInputs();render();saveDraft();});
fill("f-enter",["invest","horizon","ttmE"],"d");
fill("f-partner",["pShare","pCac","pFixed","pInv","ttmP","pRisk"],"e");
$("sliders-more").innerHTML=[["cac","Customer acquisition cost"],["conv","Conversion rate"],["share","Market share (of SAM)"]].map(([k,l])=>sliderHTML(k,l)).join("")+
  `<div class="slider">${fieldHTML("upc",{pre:"m"})}</div>`;
$("sliders").innerHTML=[["price","Price"],["volume","Sales volume (units / yr)"],["discount","Discount"],["varcost","Variable cost per unit"],["fixed","Fixed costs (per yr)"]].map(([k,l])=>sliderHTML(k,l)).join("")+
  `<label class="small" style="display:flex;gap:8px;align-items:flex-start;padding:4px 6px"><input type="checkbox" id="linkPV" style="margin-top:3px;accent-color:var(--ink)"><span><b>Volume reacts to price.</b> Moving the price slider changes volume using your elasticity assumption. Untick to move them separately.</span></label><p class="small muted" id="leads" style="padding:4px 6px"></p>`;
$("el-slider").innerHTML=sliderHTML("elastic","Your elasticity assumption").replace('<div class="slider">','<div style="display:flex;flex-direction:column;gap:6px">');
$("sc-inputs").innerHTML=["scA","scB","scC"].map(k=>fieldHTML(k,{pre:"g"})).join("");
buildFactors();
$("resetBtn").onclick=()=>{const keepCur=S.cur;S=fresh();S.cur=keepCur;anchorAll();applyRanges();syncInputs();render();saveDraft();toast("Reset to the example.");};
anchorAll();syncInputs();applyRanges();
$("linkPV").checked=S.link!==false;$("linkPV").addEventListener("change",e=>{S.link=e.target.checked;resetPV();saveDraft();});
const _render=render;render=function(){const R=_render();const b=base(S);$("leads").textContent=`At ${S.conv}% conversion you need about ${num(b.leads)} leads a year to win ${num(b.customers)} customers.`;return R;};
render();
let startTab="model";try{startTab=localStorage.getItem("mes-tab")||"model";}catch(e){}if(!TABS.some(t=>t[0]===startTab))startTab="model";go(startTab);

