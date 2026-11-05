/* ===== Growth Opportunity Finder: calculation engine. The source of truth for every number. No AI, no page code. ===== */
const G_DIMS=[["size","Market size"],["growth","Growth potential"],["fit","Strategic fit"],["feas","Feasibility"],["comp","Competitive attractiveness"],["fin","Financial attractiveness"]];
const G_WEIGHTS={size:20,growth:15,fit:20,feas:15,comp:10,fin:20};
const G_THRESH={high:8,attractive:6,validate:4};
const G_CATS=[["product","Product"],["segment","Customer segment"],["geo","Geographic"],["channel","Market and channel"],["retention","Monetisation and retention"]];
const G_CONF_PENALTY={high:0,medium:0.3,low:0.8,insufficient:1.5};
const G_SCEN_DEFAULT={conservative:{conv:70,spend:90,cost:115,label:"Conservative"},base:{conv:100,spend:100,cost:100,label:"Base"},optimistic:{conv:130,spend:110,cost:95,label:"Optimistic"}};
const gnum=v=>{if(v===""||v===null||v===undefined)return null;const n=+v;return isFinite(n)?n:null;};
const gdiv=(a,b)=>b?a/b:null;

/* weights must total 100 */
function gWeightTotal(w){return G_DIMS.reduce((s,[k])=>s+(+w[k]||0),0);}
/* overall score out of 10: sum of score × weight. Missing dimension scores are left out and the weights re-spread over the rest. */
function gScore(o,w){w=w||G_WEIGHTS;let tot=0,ws=0;const parts=[];
  G_DIMS.forEach(([k,l])=>{const s=gnum(o.scores&&o.scores[k]);const wt=+w[k]||0;if(s!==null&&wt>0){const c=Math.min(10,Math.max(1,s));tot+=c*wt;ws+=wt;parts.push({k,label:l,score:c,weight:wt,points:c*wt/100});}});
  return{score:ws?tot/ws:null,parts,missing:G_DIMS.filter(([k])=>gnum(o.scores&&o.scores[k])===null).map(x=>x[1])};}
function gClass(score,t){t=t||G_THRESH;if(score===null)return{key:"none",label:"Not scored"};
  return score>=t.high?{key:"high",label:"High priority"}:score>=t.attractive?{key:"attractive",label:"Attractive opportunity"}:score>=t.validate?{key:"validate",label:"Requires further validation"}:{key:"low",label:"Low priority"};}
/* commercial attractiveness (y axis) and feasibility (x axis) for the matrix */
function gAxes(o){const s=o.scores||{};const pick=ks=>{const v=ks.map(k=>gnum(s[k])).filter(x=>x!==null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
  return{attract:pick(["size","growth","comp","fin"]),feas:pick(["feas","fit"])};}
function gQuadrant(a,mid){mid=mid||5.5;if(a.attract===null||a.feas===null)return null;
  const hi=a.attract>=mid,easy=a.feas>=mid;return hi&&easy?{key:"quick",label:"Quick win"}:hi?{key:"bet",label:"Strategic bet"}:easy?{key:"incremental",label:"Incremental improvement"}:{key:"lowp",label:"Low priority"};}
/* ranking: score first, but weak evidence pulls an opportunity down so a well-evidenced one isn't overtaken by a guess */
function gRank(opps,w,t){return opps.filter(o=>o.status!=="rejected").map(o=>{const S=gScore(o,w);const conf=o.confidence||"medium";const adj=S.score===null?null:S.score-(G_CONF_PENALTY[conf]||0);
    return{o,score:S.score,adjusted:adj,parts:S.parts,missing:S.missing,cls:gClass(S.score,t),conf,axes:gAxes(o),quad:gQuadrant(gAxes(o))};})
  .sort((a,b)=>(b.adjusted===null?-99:b.adjusted)-(a.adjusted===null?-99:a.adjusted)).map((r,i)=>Object.assign(r,{rank:i+1}));}

/* financial model for one opportunity (annual figures). fin: audience, conv %, arpc (revenue per customer per year), varPct (variable cost % of revenue),
   acq (direct acquisition / marketing spend per year), fixed (incremental operating costs per year), setup (one-off investment), launch (months to launch) */
function gFin(f,sc){f=f||{};sc=sc||G_SCEN_DEFAULT.base;
  const aud=gnum(f.audience),conv=gnum(f.conv),arpc=gnum(f.arpc);if(aud===null||conv===null||arpc===null)return null;
  const varPct=gnum(f.varPct)||0,acq=gnum(f.acq)||0,fixed=gnum(f.fixed)||0,setup=gnum(f.setup)||0;
  const customers=aud*(conv*sc.conv/100)/100;const revenue=customers*arpc*sc.spend/100;
  const variable=revenue*Math.min(100,varPct*sc.cost/100)/100;const gross=revenue-variable;const acqC=acq*sc.cost/100;
  const contribution=revenue-variable-acqC;const opProfit=gross-acqC-fixed*sc.cost/100;
  const monthly=opProfit/12;const payback=setup>0&&monthly>0?setup/monthly:(setup===0&&monthly>0?0:null);
  const netBenefit=opProfit-setup;const roi=setup>0?netBenefit/setup*100:null;
  return{customers,revenue,variable,gross,grossMargin:gdiv(gross,revenue)===null?null:gross/revenue*100,acq:acqC,contribution,opProfit,investment:setup,payback,netBenefit,roi};}
function gScenarios(f,sc){sc=sc||G_SCEN_DEFAULT;return["conservative","base","optimistic"].map(k=>({key:k,label:(sc[k]||G_SCEN_DEFAULT[k]).label||G_SCEN_DEFAULT[k].label,r:gFin(f,sc[k]||G_SCEN_DEFAULT[k])}));}

/* market sizing: TAM/SAM/SOM. Bottom-up TAM = potential customers × annual spend when TAM isn't given. */
function gMarket(m){m=m||{};let tam=gnum(m.tam),tamSrc=m.src&&m.src.tam||"user";
  const pc=gnum(m.pcust),sp=gnum(m.spend);if(tam===null&&pc!==null&&sp!==null){tam=pc*sp;tamSrc="calc";}
  let sam=gnum(m.sam),samSrc=m.src&&m.src.sam||"user";const samPct=gnum(m.samPct);if(sam===null&&tam!==null&&samPct!==null){sam=tam*samPct/100;samSrc="calc";}
  const share=gnum(m.share);const som=sam!==null&&share!==null?sam*share/100:null;
  return{tam,sam,som,tamSrc,samSrc,somSrc:"calc",somPctSam:som!==null&&sam?som/sam*100:null,somPctTam:som!==null&&tam?som/tam*100:null,bottomUp:pc!==null&&sp!==null?pc*sp:null};}

/* product portfolio: revenue share, growth and margin, only where the data exists */
function gProducts(ps){ps=ps||[];const total=ps.reduce((s,p)=>s+(gnum(p.revenue)||0),0);
  return ps.map(p=>{const r=gnum(p.revenue),pr=gnum(p.prevRevenue),c=gnum(p.cost);
    return Object.assign({},p,{share:r!==null&&total?r/total*100:null,growthPct:r!==null&&pr?(r-pr)/pr*100:null,margin:r&&c!==null?(r-c)/r*100:null});});}

/* feedback: percentages always come from the analysed sample */
function gFeedback(an){if(!an||!an.n)return null;const n=an.n;const s=an.sentiment||{};const pct=v=>v?v/n*100:0;
  return{n,sentiment:{positive:pct(s.positive),negative:pct(s.negative),neutral:pct(s.neutral),mixed:pct(s.mixed)},
    themes:(an.themes||[]).map(t=>Object.assign({},t,{pct:t.count?t.count/n*100:null})).sort((a,b)=>(b.count||0)-(a.count||0))};}

/* everything at once */
function gAll(G){const w=G.weights||G_WEIGHTS,t=G.thresh||G_THRESH;const R=gRank(G.opps||[],w,t);
  const withFin=R.map(r=>({r,fin:gFin(r.o.fin),sc:gScenarios(r.o.fin,G.scen)})).filter(x=>x.fin);
  return{R,top:R.slice(0,3),M:gMarket(G.market),P:gProducts(G.products),FB:gFeedback(G.feedback&&G.feedback.analysed),fin:withFin,
    wTotal:gWeightTotal(w),quick:R.filter(r=>r.quad&&r.quad.key==="quick"),highCount:R.filter(r=>r.cls.key==="high").length,
    revPotential:withFin.reduce((s,x)=>s+(x.fin.revenue||0),0)};}
if(typeof module!=="undefined")module.exports={gScore,gClass,gAxes,gQuadrant,gRank,gFin,gScenarios,gMarket,gProducts,gFeedback,gAll,gWeightTotal,G_WEIGHTS,G_THRESH,G_SCEN_DEFAULT};
