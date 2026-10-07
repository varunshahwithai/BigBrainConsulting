/* ===== Calculation engine: the source of truth. No AI, no DOM. ===== */
const FACTORS=[
  ["reg","Regulatory barriers"],["cap","Capital requirements"],["tech","Technology requirements"],
  ["dist","Distribution complexity"],["brand","Brand requirements"],["switch","Customer switching costs"],
  ["comp","Competitor strength"],["talent","Talent requirements"],["ttm","Time to market"]
];
const DEFAULTS={
  name:"Brightdesk",product:"AI sales assistant",geo:"United Kingdom",
  price:100,volume:10000,discount:10,varcost:35,fixed:250000,cac:30,upc:2,conv:4,currev:"",
  country:"United Kingdom",industry:"B2B software",ctype:"Small and mid-sized businesses",
  tam:400000000,samPct:15,samMode:"calc",sam:60000000,share:3,growth:8,pcust:120000,spend:500,
  elastic:-1.2,scA:90,scB:100,scC:120,sel:"C",
  invest:250000,horizon:3,ttmE:9,pShare:30,pCac:60,pFixed:40,pInv:70,ttmP:4,pRisk:40,
  f_reg:4,f_cap:6,f_tech:5,f_dist:6,f_brand:5,f_switch:7,f_comp:7,f_talent:4,f_ttm:5,
  w_reg:1,w_cap:1,w_tech:1,w_dist:1,w_brand:1,w_switch:1,w_comp:1,w_talent:1,w_ttm:1
};
const REC_WEIGHTS={profit:25,roi:20,payback:20,opportunity:15,risk:20};

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const safeDiv=(a,b)=>b?a/b:0;

/* Volume after a % change in price, using: %ΔQ = elasticity × %ΔP */
function volumeAfter(S,pctPriceChange,e){
  const el=e===undefined?S.elastic:e;
  return Math.max(0,S.volume*(1+el*pctPriceChange));
}

/* P&L for one set of price, discount and volume */
function pnl(S,list,discount,vol){
  const net=list*(1-discount/100);
  const rev=vol*net;
  const vc=vol*S.varcost;
  const gp=rev-vc;
  const customers=safeDiv(vol,S.upc);
  const acq=customers*S.cac;
  const op=gp-S.fixed-acq;
  const cm=net-S.varcost;
  const cacU=safeDiv(S.cac,S.upc);
  return {list,discount,net,vol,rev,vc,gp,gm:safeDiv(gp,rev),customers,acq,fixed:S.fixed,op,om:safeDiv(op,rev),
    cm,cacU,be:cm>0?S.fixed/cm:Infinity,beAcq:cm-cacU>0?S.fixed/(cm-cacU):Infinity,ppu:safeDiv(op,vol),
    leads:S.conv>0?customers/(S.conv/100):0};
}

const base=S=>pnl(S,S.price,S.discount,S.volume);

/* A pricing scenario: list price changes, discount stays, volume reacts by elasticity */
function scenario(S,list,e){
  const pct=safeDiv(list-S.price,S.price);
  return Object.assign(pnl(S,list,S.discount,volumeAfter(S,pct,e)),{pct});
}

/* A discount scenario: the net price moves, so demand reacts to the net-price change */
function discountCase(S,d){
  const b=base(S);
  const net=S.price*(1-d/100);
  const pct=safeDiv(net-b.net,b.net);
  const r=pnl(S,S.price,d,volumeAfter(S,pct));
  const unitProfit=r.cm-r.cacU;
  const reqVol=unitProfit>0?(b.op+S.fixed)/unitProfit:Infinity;
  return Object.assign(r,{pct,reqVol,reqUplift:isFinite(reqVol)?reqVol/S.volume-1:Infinity});
}

const samOf=S=>S.samMode==="manual"?+S.sam||0:(+S.tam||0)*(+S.samPct||0)/100;
function market(S){
  const sam=samOf(S);const som=sam*S.share/100;
  const b=base(S);
  return {tam:S.tam,sam,samPct:safeDiv(sam,S.tam),som,somSam:safeDiv(som,sam),somTam:safeDiv(som,S.tam),
    bottomUp:S.pcust*S.spend,planShare:safeDiv(b.rev,sam),planVsSom:safeDiv(b.rev,som),
    som3:som*Math.pow(1+S.growth/100,3)};
}

function entry(S){
  let num=0,den=0;const rows=[];
  FACTORS.forEach(([k,label])=>{const sc=+S["f_"+k]||0,w=+S["w_"+k]||0;num+=sc*w;den+=w;rows.push({k,label,score:sc,weight:w,contrib:sc*w});});
  const score=den?num/den:0;
  const top=rows.filter(r=>r.weight>0).sort((a,b)=>b.score*b.weight-a.score*a.weight||b.score-a.score).slice(0,3);
  return {score,rows,top,num,den};
}
const riskLabel=r=>r<=0?"None":r<4?"Low":r<7?"Medium":"High";

/* Month-by-month path for ENTER or PARTNER over the horizon */
function path(S,kind){
  const b=base(S);const P=kind==="partner";
  const keep=P?1-S.pShare/100:1;
  const cacU=b.cacU*(P?1-S.pCac/100:1);
  const fixedM=S.fixed/12*(P?1-S.pFixed/100:1);
  const inv=S.invest*(P?1-S.pInv/100:1);
  const ttm=Math.round(P?S.ttmP:S.ttmE);
  const months=Math.round(S.horizon*12);
  const cum=[-inv];let rev=0,yourRev=0,op=0,payback=null;
  for(let m=1;m<=months;m++){
    let mop=0;
    if(m>ttm){
      const v=S.volume/12*Math.pow(1+S.growth/100,(m-ttm-1)/12);
      const r=v*b.net;
      rev+=r;yourRev+=r*keep;
      mop=r*keep-v*S.varcost-v*cacU-fixedM;
    }
    op+=mop;cum.push(cum[m-1]+mop);
    if(payback===null&&m>ttm&&cum[m]>=0)payback=m;
  }
  const e=entry(S).score;
  const risk=P?e*(1-S.pRisk/100):e;
  const net=op-inv;
  return {kind,inv,ttm,months,rev,yourRev,op,net,roi:inv>0?net/inv:(net>0?Infinity:0),payback,cum,risk,
    partnerCut:rev-yourRev,acqSaved:P?b.cacU*S.pCac/100:0,share:safeDiv(rev/S.horizon,samOf(S))};
}

function recommend(S){
  const E=path(S,"enter"),P=path(S,"partner"),M=market(S),EN=entry(S);
  const b=base(S);
  const maxNet=Math.max(E.net,P.net,1);
  const oppRatio=safeDiv(M.som,b.rev);
  const oppScore=REC_WEIGHTS.opportunity*clamp((oppRatio-0.5)/2.5,0,1);
  const score=o=>{
    const parts={
      profit:REC_WEIGHTS.profit*clamp(o.net/maxNet,0,1),
      roi:REC_WEIGHTS.roi*clamp(isFinite(o.roi)?o.roi:1,0,1),
      payback:o.payback?REC_WEIGHTS.payback*clamp(1-o.payback/o.months,0,1):0,
      opportunity:oppScore,
      risk:REC_WEIGHTS.risk*clamp(1-(o.risk-1)/9,0,1)
    };
    return {parts,total:Object.values(parts).reduce((a,c)=>a+c,0)};
  };
  const sE=score(E),sP=score(P);
  let call,reasons=[];
  if(E.net<=0&&P.net<=0){
    call="DON'T ENTER";
    reasons.push(`Neither option earns back its investment within ${S.horizon} years (Enter ${fmtPlain(E.net)}, Partner ${fmtPlain(P.net)}).`);
  }else{
    const best=sE.total>=sP.total?"ENTER":"PARTNER";
    const top=Math.max(sE.total,sP.total);
    if(top<35){call="DON'T ENTER";reasons.push(`The best option scores ${top.toFixed(0)} out of 100, below the 35-point bar for a worthwhile entry.`);}
    else call=best;
  }
  return {call,E,P,sE,sP,M,EN,b,oppRatio,reasons,threshold:35};
}
/* plain formatting used inside engine text; the page re-formats for display */
function fmtPlain(v){return (v<0?"−":"")+Math.round(Math.abs(v)).toLocaleString();}

if(typeof module!=="undefined")module.exports={samOf,DEFAULTS,FACTORS,REC_WEIGHTS,pnl,base,scenario,discountCase,market,entry,path,recommend,volumeAfter,riskLabel};
