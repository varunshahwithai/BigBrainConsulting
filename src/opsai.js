/* ===== Operations Diagnoser: AI layer. Sits on top of the model, labelled, never changes a number without "Use this". ===== */
const stripTags=s=>String(s).replace(/<[^>]+>/g,"");
function opsSummary(){const C=opsCalc(O),R=opsRecommend(O,C),T=C.totals;const r1=v=>isFinite(v)?Math.round(v*10)/10:null;
  const mix=oDataMix();const rs=OPS_RCA_SUM(C);
  return{currency:O.cur,business:O.biz,process:O.proc,demand_per_day:+O.demand,working_days_per_month:+O.days,
    steps:C.steps.map(r=>({name:r.name,capacity_per_day:r1(r.cap),demand_per_day:r1(r.inU),utilisation_pct:r1(r.util*100),status:r.status,people:+r.s.staff||0,can_work_at_once:r.par,
      processing_min_per_unit:r1(r.load),waiting_min:r1(r.wait),waiting_source:r.waitSrc==="model"?"estimated by the model":"entered by user",queue_keeps_growing:r.growing,
      delay_rate_pct:r1(r.delay*100),avg_delay_min:r.delayMin,error_rate_pct:r1(r.err*100),rework_hours_per_month:r1(md(r.reworkHours)),cancel_rate_pct:r1(r.cancel*100),
      overtime_hours_per_day:r1(r.otHours),units_not_processed_per_day:r1(r.dropped),monthly_financial_cost:Math.round(md(r.impact)),bottleneck_score_out_of_10:r1(r.score),share_of_all_waiting_pct:r1(r.waitShare*100),
      processing_time_source:SRCNAME[(r.s.src||{}).time||"example"]})),
    primary_bottleneck:C.primary?C.primary.name:null,step_with_least_spare_capacity:C.constraint?C.constraint.name:null,
    totals:{throughput_per_day:r1(T.throughput),process_capacity_per_day:r1(T.procCap),lead_time_min:r1(T.lead),waiting_and_delay_share_pct:r1(T.waitShare*100),
      delay_rate_pct:r1(T.delayRate*100),error_rate_pct:r1(T.errorRate*100),cancel_rate_pct:r1(T.cancelRate*100),monthly_financial_cost:Math.round(md(T.impact)),
      monthly_cost_breakdown:{delay:Math.round(md(T.delayCost)),rework:Math.round(md(T.reworkCost)),overtime:Math.round(md(T.otCost)),lost_contribution:Math.round(md(T.lostContrib))},
      monthly_revenue_opportunity_separate:Math.round(md(T.revenueOpp)),health_score_out_of_100:Math.round(C.health)},
    root_cause:{primary:stripTags(rs.primary),others:stripTags(rs.others),whys:(rcaFor(O.rcaStep||(C.primary||{}).id||"").whys||[]).filter(w=>w.trim())},
    scenarios:R.evs.map(e=>({name:e.sc.name,step:e.sc.step&&oStep(e.sc.step)?oStep(e.sc.step).name:null,investment:e.inv,net_monthly_benefit:Math.round(e.monthlyBenefit),
      payback_months:e.payback===null?null:r1(e.payback),throughput_after_per_day:r1(e.C.totals.throughput),capacity_limit_before:e.from?e.from.name:null,capacity_limit_after:e.to?e.to.name:null})),
    objective:(OPS_OBJECTIVES.find(o=>o[0]===O.objective)||["",""])[1],recommended_scenario:R.best?R.best.sc.name:"Keep the current process (no scenario pays back)",
    data_sources_pct:{actual:Math.round(mix.actual*100),estimated:Math.round(mix.estimated*100),example_or_ai:Math.round(mix.example*100)},data_warnings:oWarnings(C).map(w=>stripTags(w[0]))};}
function aiErr(e,what){return e&&e.code==="not_granted"?"AI access wasn't allowed, so nothing changed.":e&&e.code==="rate_limited"?"Too many AI requests just now. Try again in a minute.":`The AI couldn't ${what} this time. Nothing was changed.`;}
const AI_RULES=`Plain UK English, short sentences, no jargon. Use ONLY numbers that appear in the MODEL JSON and quote them; never invent figures. The calculation engine is the source of truth: explain it, never override it. Treat causes as possibilities, not facts.`;

/* --- example data for the steps --- */
let oDataSugg=null;
function oDataPanel(h){const p=document.querySelector(".ai-odata");p.hidden=!h;p.innerHTML=h||"";}
async function opsAiData(){if(!AI){oDataPanel(`<p class="small">AI isn't available in this view. You can still type your own numbers or use a template.</p>`);return;}
  oDataPanel(`<p class="small muted">AI is estimating typical numbers for your steps… this usually takes 10 to 40 seconds.</p>`);
  const prompt=`You help users of an operations bottleneck tool create realistic EXAMPLE data when they have none. These are clearly labelled AI-generated example assumptions the user will check.
Business: ${O.biz.name} (${O.biz.type}, ${O.biz.industry}, ${O.biz.location}). Process: ${O.proc.name}. ${O.proc.desc}
Steps in order: ${O.steps.map((s,i)=>`${i+1}. ${s.name}${s.desc?" ("+s.desc+")":""}`).join("; ")}.
Currency ${O.cur}. Return JSON only: {"steps":[{"name":"exact step name","time":avg minutes per unit,"tmin":fastest minutes,"tmax":slowest minutes,"err":error rate percent,"rwShare":percent of errors fixed by rework,"rwMin":rework minutes per error,"delay":percent of units delayed,"delayMin":average delay minutes,"cancel":percent of units cancelled or rejected at this step,"labour":labour cost per hour,"reason":"one short sentence","confidence":"high|medium|low"}]} with one entry per step in the same order.`;
  try{const r=await AI.json(prompt,{modelTier:"default"});oDataSugg=(r.steps||[]).slice(0,O.steps.length).map((x,i)=>Object.assign({},x,{id:O.steps[i].id}));oDrawDataSugg();}
  catch(e){oDataPanel(`<p class="small">${aiErr(e,"generate example data")}</p>`);}}
const AI_DATA_FIELDS=["time","tmin","tmax","err","rwShare","rwMin","delay","delayMin","cancel","labour"];
function oDrawDataSugg(){if(!oDataSugg||!oDataSugg.length){oDataPanel("");return;}
  oDataPanel(`<div class="row"><h4>AI example data</h4><span class="chip ai">AI-generated example assumption</span><span class="spacer"></span><button class="pill sm" type="button" data-oaid="all">Use all</button><button class="pill sm ghost" type="button" data-oaix="all">Close</button></div>
   <p class="small muted">Nothing changes until you choose "Use this". People and hours stay as they are, because only you know those.</p>
   ${oDataSugg.map(x=>{const s=oStep(x.id);if(!s)return"";return`<div class="sugg"><div><b>${esc(s.name)}: ${onum(+x.time,1)} min (${onum(+x.tmin,1)}–${onum(+x.tmax,1)}), errors ${onum(+x.err,1)}%, delays ${onum(+x.delay,1)}%, cancellations ${onum(+x.cancel,1)}%</b><small>${esc(x.reason||"")}</small><small>Confidence: ${esc(x.confidence||"unknown")} · Source: AI estimate, no live source yet</small></div>
     ${x.used?'<span class="chip ai">Applied</span><span></span>':`<button class="pill sm" type="button" data-oaid="${x.id}">Use this</button><button class="pill sm ghost" type="button" data-oaix="${x.id}">Ignore</button>`}</div>`;}).join("")}`);}
function oApplyData(x){const s=oStep(x.id);if(!s)return;AI_DATA_FIELDS.forEach(f=>{const v=+x[f];if(isFinite(v)&&v>=0){s[f]=["err","rwShare","delay","cancel"].includes(f)?Math.min(100,v):v;s.src=s.src||{};s.src[f]="ai";}});x.used=true;}

/* --- AI diagnosis (six sections) --- */
async function opsAiDiagnose(){const out=$("oaidx");if(!AI){out.innerHTML=`<p class="small">AI isn't available in this view. The bottleneck, ranking and costs above all work without it.</p>`;return;}
  out.innerHTML=`<p class="small muted">Reading your model… this usually takes 10 to 40 seconds.</p>`;
  const prompt=`You are an operations consultant writing a short diagnosis from a deterministic process model. ${AI_RULES}
The primary bottleneck is "${(OC||opsCalc(O)).primary?(OC||opsCalc(O)).primary.name:""}" (decided by the model's visible scoring). Mention when key inputs are example or AI values (see processing_time_source and data_sources_pct).
Return JSON only: {"primary":"one sentence naming the biggest constraint with its numbers","why_it_matters":"what impact it has, with numbers","evidence":["3 to 5 metric bullets"],"likely_causes":["3 possible causes, worded as possibilities"],"downstream":"which other steps are affected and how","investigate":["3 data points to collect to confirm the diagnosis"]}
MODEL: ${JSON.stringify(opsSummary())}`;
  try{const r=await AI.json(prompt,{modelTier:"default",cache:false});const li=a=>`<ul class="small" style="margin:4px 0 0;padding-left:18px">${(a||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;
    const sec=(n,t,b)=>`<div class="pt" style="cursor:default"><span>${n}</span><span class="tx"><b>${t}</b>${b}</span></div>`;
    out.innerHTML=sec(1,"Primary bottleneck",esc(r.primary||""))+sec(2,"Why it matters",esc(r.why_it_matters||""))+sec(3,"Evidence",li(r.evidence))+sec(4,"Likely causes <span class='chip ex'>Possible, not confirmed</span>",li(r.likely_causes))+sec(5,"Downstream effects",esc(r.downstream||""))+sec(6,"What to investigate",li(r.investigate))+
      `<p class="small muted">Written from the model as it stood when you asked. Change an input and ask again to refresh it.</p>`;}
  catch(e){out.innerHTML=`<p class="small">${aiErr(e,"write a diagnosis")}</p>`;}}

/* --- AI causes --- */
let oCauseSugg=null;
function oCausePanel(h){const p=document.querySelector(".ai-ocauses");p.hidden=!h;p.innerHTML=h||"";}
async function opsAiCauses(){if(!AI){oCausePanel(`<p class="small">AI isn't available in this view. You can still mark causes yourself.</p>`);return;}
  const C=OC||opsCalc(O);const r=C.steps.find(x=>x.id===O.rcaStep)||C.primary;if(!r)return;
  oCausePanel(`<p class="small muted">AI is thinking about likely causes at ${esc(r.name)}…</p>`);
  const prompt=`Suggest likely root causes for a process bottleneck. ${AI_RULES}
Step under investigation: "${r.name}". Observed problems: ${oObserved(r,C).map(stripTags).join(" ")}
Categories allowed: People, Process, Technology, Equipment, Demand, Quality, External.
Return JSON only: {"causes":[{"category":"one allowed category","cause":"short cause, max 8 words","why":"one sentence linking it to the observed numbers"}]} with 4 to 6 causes.
MODEL: ${JSON.stringify(opsSummary())}`;
  try{const res=await AI.json(prompt,{modelTier:"default"});oCauseSugg=(res.causes||[]).filter(c=>RCA_CATS[c.category]).map(c=>Object.assign({id:opsId()},c));oDrawCauses();}
  catch(e){oCausePanel(`<p class="small">${aiErr(e,"suggest causes")}</p>`);}}
function oDrawCauses(){if(!oCauseSugg||!oCauseSugg.length){oCausePanel("");return;}
  oCausePanel(`<div class="row"><h4>AI-suggested causes</h4><span class="chip ai">AI suggestion</span><span class="spacer"></span><button class="pill sm" type="button" data-oaic="all">Add all as suspected</button><button class="pill sm ghost" type="button" data-oaicx="all">Close</button></div>
   ${oCauseSugg.map(c=>`<div class="sugg"><div><b>${esc(c.category)}: ${esc(c.cause)}</b><small>${esc(c.why||"")}</small></div>${c.used?'<span class="chip ai">Added</span><span></span>':`<button class="pill sm" type="button" data-oaic="${c.id}">Add as suspected</button><button class="pill sm ghost" type="button" data-oaicx="${c.id}">Ignore</button>`}</div>`).join("")}`);}

/* --- next why --- */
async function opsAiWhy(){const box=$("orca-whyai");if(!AI){box.innerHTML=`<p class="small">AI isn't available in this view.</p>`;return;}
  const C=OC||opsCalc(O);const r=C.steps.find(x=>x.id===O.rcaStep)||C.primary;const R=rcaFor(r.id);const n=R.whys.findIndex(w=>!w.trim());
  if(n<0){box.innerHTML=`<p class="small">All five whys are answered. Edit any of them to go deeper.</p>`;return;}
  box.innerHTML=`<p class="small muted">Thinking about the next question…</p>`;
  const prompt=`Help a user run a 5 Whys analysis. ${AI_RULES}
Problem: "${R.problem||r.name+" is slowing the process down"}". Answers so far: ${R.whys.filter(w=>w.trim()).map((w,i)=>`Why ${i+1}: ${w}`).join(" | ")||"none"}.
Observed data: ${oObserved(r,C).map(stripTags).join(" ")}
Return JSON only: {"question":"the next 'why' question, max 15 words","suggested_answer":"a plausible answer to check, max 20 words"}`;
  try{const res=await AI.json(prompt,{modelTier:"quick",cache:false});
    box.innerHTML=`<div class="callout ai"><p class="small"><span class="chip ai">AI suggestion</span> <b>Why ${n+1}: ${esc(res.question||"")}</b></p><p class="small">Possible answer to check: ${esc(res.suggested_answer||"")}</p>
      <div class="row"><button class="pill sm" type="button" data-oaiw="${n}" data-text="${esc(res.suggested_answer||"")}">Use this answer</button><button class="pill sm ghost" type="button" data-oaiwx="1">Dismiss</button></div></div>`;}
  catch(e){box.innerHTML=`<p class="small">${aiErr(e,"suggest the next question")}</p>`;}}

/* --- eight-point recommendation --- */
const OPS_AI_TITLES=["Where the bottleneck is","Why it exists","What it is costing","The biggest operational risk","The strongest improvement","What happens after the improvement","What new bottleneck may emerge","What to investigate next"];
const OPS_AI_LINKS=[["diagnose","obn","Diagnosis"],["rca","osec-causes","Cause & fix"],["cost","osec-costtot","Cause & fix"],["diagnose","osec-rank","Diagnosis"],["improve","orec","Fixes"],["improve","osec-ba","Fixes"],["improve","osec-ba","Fixes"],["diagnose","odd-dq","Diagnosis"]];
async function opsAiRecommend(){const out=$("oairec");if(!AI){out.innerHTML=`<p class="small">AI isn't available in this view. Every number and the recommended scenario still work without it.</p>`;return;}
  out.innerHTML=`<p class="small muted">Reading your model… this usually takes 10 to 40 seconds.</p>`;
  const prompt=`You explain the results of a deterministic operations model to a student or founder. ${AI_RULES}
The recommended scenario is "${(OR&&OR.best)?OR.best.sc.name:"Keep the current process"}", chosen by fixed rules for the user's objective; explain it, and flag cautions as cautions.
Return JSON only: {"points":[8 strings]} in this order: ${OPS_AI_TITLES.map((t,i)=>`${i+1}) ${t}`).join("; ")}. Each at most 55 words.
MODEL: ${JSON.stringify(opsSummary())}`;
  try{const r=await AI.json(prompt,{modelTier:"default",cache:false});const pts=(r.points||[]).slice(0,8);
    out.innerHTML=pts.map((p,i)=>`<button type="button" class="pt" data-ojump="${OPS_AI_LINKS[i][0]}:${OPS_AI_LINKS[i][1]}"><span>${i+1}</span><span class="tx"><b>${OPS_AI_TITLES[i]}</b>${esc(p)}<em>See where this comes from in ${OPS_AI_LINKS[i][2]} →</em></span></button>`).join("")+
      `<p class="small muted">Written from the model as it stood when you asked. Change an input and ask again to refresh it.</p>`;}
  catch(e){out.innerHTML=`<p class="small">${aiErr(e,"write the recommendation")}</p>`;}}

document.addEventListener("click",e=>{const g=s=>e.target.closest(s);let b;
  if((b=g("[data-oai]"))){({data:opsAiData,diagnose:opsAiDiagnose,causes:opsAiCauses,why:opsAiWhy,recommend:opsAiRecommend}[b.dataset.oai]||(()=>{}))();return;}
  if((b=g("[data-oaid]"))&&oDataSugg){const k=b.dataset.oaid;oDataSugg.forEach(x=>{if(k==="all"||x.id===k)oApplyData(x);});syncO();opsRender();opsSave();oDrawDataSugg();otoast("AI example data applied and labelled AI-generated.");return;}
  if((b=g("[data-oaix]"))&&oDataSugg){const k=b.dataset.oaix;if(k==="all"){oDataSugg=null;oDataPanel("");}else{oDataSugg=oDataSugg.filter(x=>x.id!==k);oDrawDataSugg();}return;}
  if((b=g("[data-oaic]"))&&oCauseSugg){const k=b.dataset.oaic;const R=rcaFor(O.rcaStep);oCauseSugg.forEach(c=>{if((k==="all"||c.id===k)&&!c.used){R.custom.push({id:opsId(),cat:c.category,text:c.cause,status:"suspected",src:"ai"});c.used=true;}});oBuildRca();opsRender();opsSave();oDrawCauses();return;}
  if((b=g("[data-oaicx]"))&&oCauseSugg){const k=b.dataset.oaicx;if(k==="all"){oCauseSugg=null;oCausePanel("");}else{oCauseSugg=oCauseSugg.filter(c=>c.id!==k);oDrawCauses();}return;}
  if((b=g("[data-oaiw]"))){const R=rcaFor(O.rcaStep);R.whys[+b.dataset.oaiw]=b.dataset.text;oBuildRca();opsRender();opsSave();$("orca-whyai").innerHTML="";return;}
  if(g("[data-oaiwx]")){$("orca-whyai").innerHTML="";return;}});
