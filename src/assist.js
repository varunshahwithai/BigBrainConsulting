/* ===== AI-native helpers: "Not sure where to start?" finder, AI quick start for the simulator and the diagnoser, and the "Ask BBC" assistant.
   Everything AI writes is labelled as an AI estimate and can be undone. The calculation engines stay the source of truth. ===== */
const AX_TOOLS={sim:"Market Entry Simulator",ops:"Operations Bottleneck Diagnoser",ma:"M&A Due Diligence Analyst",growth:"Growth Opportunity Finder",team:"Hire a student team"};
function axErr(e,what){return e&&e.code==="rate_limited"?(e.message||"Too many AI requests just now. Try again in a minute."):e&&e.code==="login_needed"?"Please log in again to use AI.":`The AI couldn't ${what} this time. Nothing was changed. Please try again.`;}
const axNum=(v,lo,hi,dflt)=>{v=+v;if(!isFinite(v))return dflt;if(lo!==undefined)v=Math.max(lo,v);if(hi!==undefined)v=Math.min(hi,v);return v;};
const axClip=(o,n)=>{let t="";try{t=JSON.stringify(o);}catch(e){t="";}return t.length>n?t.slice(0,n)+"…":t;};
function axCss(){if($("axCss"))return;const st=document.createElement("style");st.id="axCss";st.textContent=`
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.axbox{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:22px;display:flex;flex-direction:column;gap:12px}
.axbox h3{font:700 22px/1.2 var(--display);margin:0}
.axbox textarea{width:100%;min-height:76px;resize:vertical;font:15px/1.5 var(--body);padding:12px 14px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--bg);color:var(--ink)}
.axbox textarea:focus{outline:2px solid var(--ink);outline-offset:1px}
.axrow{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.axout{border-top:1px solid var(--line);padding-top:12px;display:flex;flex-direction:column;gap:10px}
.axout ul{margin:0;padding-left:18px}
.axgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px 14px}
.axgrid div{font-size:13px;display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed var(--line);padding:3px 0}
.axgrid b{font-variant-numeric:tabular-nums}
.axfab{position:fixed;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:60;display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:13px 20px;background:var(--ink);color:var(--bg);border:0;font:600 15px var(--body);cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.axfab i{font-style:normal;font:700 16px var(--display)}
.axchat{position:fixed;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:61;width:min(400px,calc(100vw - 32px));height:min(580px,calc(100vh - 110px));background:var(--surface);border:1px solid var(--line);border-radius:22px;box-shadow:0 18px 50px rgba(0,0,0,.2);display:flex;flex-direction:column;overflow:hidden}
.axhead{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line)}
.axhead b{font:700 18px var(--display)}
.axhead .spacer{flex:1}
.axmsgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.axm{max-width:88%;padding:10px 13px;border-radius:16px;font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
.axm.u{align-self:flex-end;background:var(--ink);color:var(--bg);border-bottom-right-radius:5px}
.axm.a{align-self:flex-start;background:var(--sunk);border-bottom-left-radius:5px}
.axm.a .pill{margin-top:8px}
.axchips{display:flex;flex-wrap:wrap;gap:6px}
.axchips button{font:500 13px var(--body);border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:6px 11px;cursor:pointer;text-align:left}
.axform{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line)}
.axform input{flex:1;min-width:0;font:15px var(--body);padding:11px 14px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--ink)}
.axnote{font-size:11px;color:var(--muted);padding:0 16px 10px}
body.signup-mode .axfab,body.signup-mode .axchat{display:none!important}
@media (max-width:560px){.axchat{right:8px;left:8px;width:auto;bottom:8px;height:calc(100vh - 90px)}}
@media print{.axfab,.axchat{display:none!important}}`;document.head.appendChild(st);}

/* ---------- 1. "Not sure where to start?" on the home page ---------- */
function axFinderBuild(){const hero=document.querySelector("#home .hero");if(!hero||$("axFinder"))return;
  const box=document.createElement("section");box.className="axbox";box.id="axFinder";box.setAttribute("aria-labelledby","axFinderT");
  box.innerHTML=`<div class="row"><h3 id="axFinderT">Not sure where to start?</h3><span class="chip ai">AI</span></div>
    <p class="small muted" style="margin:0">Describe your situation in a sentence or two. The AI points you to the right tool and gets it ready for you.</p>
    <label class="sr-only" for="axFinderQ">Describe your situation</label>
    <textarea id="axFinderQ" maxlength="1200" placeholder="e.g. I run a small bakery in Leeds and I'm thinking of raising my prices. Will I lose customers?"></textarea>
    <div class="axrow"><button class="pill" type="button" id="axFinderGo">Find the right tool</button><span class="small muted" id="axFinderMsg"></span></div>
    <div class="axout" id="axFinderOut" hidden></div>`;
  hero.insertAdjacentElement("afterend",box);
  $("axFinderGo").onclick=axFinder;
  $("axFinderQ").addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))axFinder();});}
let axFind=null;
async function axFinder(){const q=($("axFinderQ").value||"").trim();const out=$("axFinderOut");
  if(q.length<8){$("axFinderMsg").textContent="Tell us a little more first.";$("axFinderQ").focus();return;}
  if(!AI){$("axFinderMsg").textContent="AI isn't available in this view.";return;}
  $("axFinderGo").disabled=true;$("axFinderMsg").textContent="Thinking… this usually takes 5 to 20 seconds.";out.hidden=true;
  const prompt=`Ask BBC tool finder: route a visitor to the right free consulting tool.
The tools on the site:
- "sim" Market Entry Simulator: pricing, discounts, demand and costs, profit and break-even, market size (TAM/SAM/SOM), entering a new market or launching a product, and an Enter / Partner / Don't Enter recommendation.
- "ops" Operations Bottleneck Diagnoser: a business process that is slow, backed up, error-prone or costly (orders, kitchens, support tickets, invoices, hiring, production). Finds the step holding everything back and tests fixes.
- "ma" M&A Due Diligence Analyst: thinking of buying, investing in or valuing a specific company. Checks its numbers, risks, synergies and price.
- "growth" Growth Opportunity Finder: where a business should grow next: new products, customer segments, markets or channels, unmet customer needs, competitors and trends, ending in prioritised opportunities and a 90-day plan.
- "team": the problem is broad or needs people rather than a calculator (strategy, marketing plans, research). A free team of business school students can help, pro bono.
Visitor wrote: """${q}"""
Return JSON: {"tool":"sim|ops|ma|growth|team","reason":"one or two friendly sentences in plain UK English explaining why this tool fits their situation","first_step":"one sentence on what they'll do first","description":"their situation rewritten as a clear one-paragraph brief, keeping every concrete detail they gave (business type, place, prices, numbers)","company_name":"for ma or growth: the company they named, else empty"}`;
  try{const r=await AI.json(prompt,{modelTier:"quick"});
    const t=["sim","ops","ma","growth","team"].includes(r.tool)?r.tool:"team";axFind={tool:t,desc:String(r.description||q),company:String(r.company_name||"")};
    out.innerHTML=`<p style="margin:0"><b>Best fit: ${AX_TOOLS[t]}</b></p><p class="small" style="margin:0">${esc(r.reason||"")}</p>${r.first_step?`<p class="small muted" style="margin:0">${esc(r.first_step)}</p>`:""}
      <div class="axrow"><button class="pill" type="button" id="axFinderOpen">${t==="team"?"Request a free student team":"Open the "+AX_TOOLS[t]} →</button><span class="chip ai">AI suggestion</span></div>
      <p class="small muted" style="margin:0">Or pick another tool from the toolkit below.</p>`;
    out.hidden=false;$("axFinderMsg").textContent="";$("axFinderOpen").onclick=()=>axHandoff(axFind);
    if(window.bbcTrack)bbcTrack("ai_finder",t);
  }catch(e){$("axFinderMsg").textContent=axErr(e,"work it out");}
  $("axFinderGo").disabled=false;}
function axHandoff(f){if(!f)return;
  if(f.tool==="team"){if(typeof openHire==="function")openHire();setTimeout(()=>{const q=$("hrQ");if(q&&!q.value)q.value=f.desc;},60);return;}
  if(f.tool==="sim"){setView("sim");setTimeout(()=>{const t=$("axSimQ");if(t){t.value=f.desc;axSimFill();}},120);return;}
  if(f.tool==="ops"){setView("ops");setTimeout(()=>{if(typeof opsGo==="function")opsGo("process");const t=$("axOpsQ");if(t){t.value=f.desc;axOpsFill();}},150);return;}
  if(f.tool==="growth"){setView("growth");setTimeout(()=>{try{if(f.company&&!(G.company.name||"").trim()){G.company.name=f.company;}if(f.desc&&!G.findings.some(x=>x.text===f.desc))gAddFinding({area:"company",text:f.desc,status:"user",sourceId:gAddSource({kind:"user",title:"Your description"}).id});gSave();gBuildCompany();gGo("company");}catch(e){}},150);return;}
  if(f.tool==="ma"){setView("ma");setTimeout(()=>{try{if(f.company&&MA){MA.target.name=f.company;if(typeof maGo==="function")maGo("target");}}catch(e){}},150);}}

/* ---------- 2a. Simulator: describe your business, AI fills in the starting numbers ---------- */
let axSimUndo=null;
function axSimBuild(){const pane=$("p-model");if(!pane||$("axSim"))return;
  const box=document.createElement("div");box.className="axbox";box.id="axSim";
  box.innerHTML=`<div class="row"><h3>Start from your business</h3><span class="chip ai">AI</span></div>
    <p class="small muted" style="margin:0">Describe your business in a sentence. The AI fills in realistic starting numbers for every step, labelled as AI estimates, so you only need to correct what you know.</p>
    <label class="sr-only" for="axSimQ">Describe your business</label>
    <textarea id="axSimQ" maxlength="1200" placeholder="e.g. A specialty coffee shop in Bristol selling flat whites at £3.60, about 250 cups a day, thinking of opening in Bath."></textarea>
    <div class="axrow"><button class="pill" type="button" id="axSimGo">Fill in my numbers</button><span class="small muted" id="axSimMsg"></span></div>
    <div class="axout" id="axSimOut" hidden></div>`;
  pane.insertBefore(box,pane.firstChild);
  $("axSimGo").onclick=axSimFill;}
async function axSimFill(){const q=($("axSimQ").value||"").trim();
  if(q.length<8){$("axSimMsg").textContent="Tell us a little more about the business first.";$("axSimQ").focus();return;}
  if(!AI){$("axSimMsg").textContent="AI isn't available in this view.";return;}
  $("axSimGo").disabled=true;$("axSimMsg").textContent="The AI is building your model… this usually takes 10 to 40 seconds.";$("axSimOut").hidden=true;
  const facs=FACTORS.map(([k,l])=>`"f_${k}":number 1-10 (${l})`).join(",");
  const prompt=`Simulator quick start: estimate starting assumptions for a pricing and market-entry model from a short description.
Description: """${q}"""
Use any numbers the user gave exactly. Estimate the rest realistically and conservatively for this kind of business. These are rough AI estimates the user will check.
Pick the currency from the description or location: GBP, USD, EUR or INR (default GBP). All money values in that currency, per year unless stated.
Return JSON only:
{"name":"business name or a short descriptive name","product":"main product or service","geo":"where they sell today","country":"target market (country or region) for growth or entry","industry":"industry","ctype":"customer type","cur":"GBP|USD|EUR|INR",
"price":number (list price per unit),"volume":number (units sold per year),"discount":number (average discount %),"varcost":number (variable cost per unit),"fixed":number (fixed costs per year),"cac":number (acquisition cost per new customer),"upc":number (units per customer per year),"conv":number (lead conversion %),
"tam":number,"samPct":number (% of TAM they can serve),"share":number (% of SAM realistically won in 3 years),"growth":number (market growth % per year),"pcust":number (potential customers),"spend":number (average spend per customer per year),
"elastic":number between -3 and -0.2 (price elasticity of demand),"invest":number (investment needed to enter the target market),${facs},
"assumptions":["up to 5 short sentences naming the most important guesses you made"],"check_first":["3 numbers the user should check first, with why, very short"]}`;
  try{const r=await AI.json(prompt,{modelTier:"default"});
    axSimUndo=JSON.stringify(S);const n={};
    const txt=k=>{const v=String(r[k]||"").trim();if(v)n[k]=v.slice(0,80);};["name","product","geo","country","industry","ctype"].forEach(txt);
    if(["GBP","USD","EUR","INR"].includes(r.cur))n.cur=r.cur;
    const set=(k,lo,hi)=>{const v=axNum(r[k],lo,hi,null);if(v!==null)n[k]=v;};
    set("price",0.01);set("volume",1);set("discount",0,90);set("varcost",0);set("fixed",0);set("cac",0);set("upc",0.1);set("conv",0,100);
    set("tam",1);set("samPct",0,100);set("share",0,100);set("growth",-50,200);set("pcust",1);set("spend",0);set("elastic",-5,0);set("invest",0);
    FACTORS.forEach(([k])=>{const v=axNum(r["f_"+k],1,10,null);if(v!==null)n["f_"+k]=Math.round(v);});
    if(!(n.price>0)||!(n.volume>0))throw new Error("bad");
    ["price","varcost","cac","spend"].forEach(k=>{if(n[k]!==undefined)n[k]=Math.round(n[k]*100)/100;});["volume","fixed","tam","pcust","invest"].forEach(k=>{if(n[k]!==undefined)n[k]=Math.round(n[k]);});
    Object.assign(S,n);S.samMode="calc";S.sam=Math.round((+S.tam||0)*(+S.samPct||0)/100);
    const p=+S.price;S.scA=Math.round(p*0.9*100)/100;S.scB=p;S.scC=Math.round(p*1.15*100)/100;
    S.src=S.src||{};MARKET_KEYS.forEach(k=>{if(n[k]!==undefined||k==="sam")S.src[k]="ai";});S.esrc=S.esrc||{};FACTORS.forEach(([k])=>{if(n["f_"+k]!==undefined)S.esrc[k]="ai";});
    S.aiStart=true;anchorAll();applyRanges();syncInputs();render();saveDraft();
    const cur=SYM[S.cur]||"";const m=v=>{v=+v;const d=v<1000&&v%1?2:0;return cur+v.toLocaleString("en-GB",{minimumFractionDigits:d,maximumFractionDigits:d});};
    const show=[["Price per unit",m(S.price)],["Units per year",(+S.volume).toLocaleString("en-GB")],["Average discount",S.discount+"%"],["Variable cost per unit",m(S.varcost)],["Fixed costs per year",m(S.fixed)],["Acquisition cost",m(S.cac)],["TAM",m(S.tam)],["Share of TAM you can serve",S.samPct+"%"],["Expected share of SAM",S.share+"%"],["Market growth",S.growth+"%"],["Elasticity",S.elastic],["Investment to enter",m(S.invest)]];
    const li=a=>(Array.isArray(a)?a:[]).slice(0,5).map(x=>`<li>${esc(x)}</li>`).join("");
    $("axSimOut").innerHTML=`<div class="row"><b>Your model is filled in with AI estimates</b><span class="chip ai">AI-generated assumptions</span><span class="spacer"></span><button class="pill sm ghost" type="button" id="axSimUndo">Undo</button></div>
      <div class="axgrid">${show.map(([l,v])=>`<div><span>${l}</span><b>${esc(v)}</b></div>`).join("")}</div>
      ${li(r.check_first)?`<div><h4 style="margin:0 0 4px">Check these first</h4><ul class="small">${li(r.check_first)}</ul></div>`:""}
      ${li(r.assumptions)?`<details><summary class="small">What the AI assumed</summary><ul class="small" style="margin-top:6px">${li(r.assumptions)}</ul></details>`:""}
      <p class="small muted" style="margin:0">These are estimates from the AI's general knowledge, not research. Change any number below and everything updates. Stuck? Ask BBC in the corner.</p>`;
    $("axSimOut").hidden=false;$("axSimMsg").textContent="";
    $("axSimUndo").onclick=()=>{if(!axSimUndo)return;S=JSON.parse(axSimUndo);axSimUndo=null;anchorAll();applyRanges();syncInputs();render();saveDraft();$("axSimOut").hidden=true;toast("Undone. Your previous numbers are back.");};
    toast("Done. Your model is filled in with AI estimates.");if(window.bbcTrack)bbcTrack("ai_quickstart","sim");
  }catch(e){$("axSimMsg").textContent=axErr(e,"build your model");}
  $("axSimGo").disabled=false;}

/* ---------- 2b. Diagnoser: describe your process, AI drafts the steps and numbers ---------- */
function axOpsBuild(){const head=document.querySelector("#op-process .ohead");if(!head||$("axOps"))return;
  const box=document.createElement("div");box.className="axbox";box.id="axOps";
  box.innerHTML=`<div class="row"><h3>Describe your process instead</h3><span class="chip ai">AI</span></div>
    <p class="small muted" style="margin:0">Tell us how work moves through your business. The AI drafts the steps and typical numbers for you, labelled as AI estimates, so you only correct what you know.</p>
    <label class="sr-only" for="axOpsQ">Describe your process</label>
    <textarea id="axOpsQ" maxlength="1500" placeholder="e.g. We're a 6-person print shop in Glasgow. Orders come in by email, we design a proof, the customer approves it, we print, then cut and pack. About 40 orders a day and approvals are always slow."></textarea>
    <div class="axrow"><button class="pill" type="button" id="axOpsGo">Draft my process</button><span class="small muted" id="axOpsMsg"></span></div>
    <div class="axout" id="axOpsOut" hidden></div>`;
  head.insertAdjacentElement("afterend",box);
  const or=document.createElement("p");or.className="small muted";or.id="axOpsOr";or.style.margin="0";or.textContent="Or pick the process closest to yours:";box.insertAdjacentElement("afterend",or);
  $("axOpsGo").onclick=axOpsFill;}
let axOpsUndo=null;
async function axOpsFill(){const q=($("axOpsQ").value||"").trim();
  if(q.length<8){$("axOpsMsg").textContent="Tell us a little more about the process first.";$("axOpsQ").focus();return;}
  if(!AI){$("axOpsMsg").textContent="AI isn't available in this view.";return;}
  $("axOpsGo").disabled=true;$("axOpsMsg").textContent="The AI is drafting your process… this usually takes 10 to 40 seconds.";$("axOpsOut").hidden=true;
  const prompt=`Diagnoser quick start: draft a business process for an operations bottleneck tool from a short description.
Description: """${q}"""
Use any numbers the user gave exactly. Estimate the rest realistically for this kind of business. These are AI estimates the user will check. Money in GBP unless the description clearly uses another currency (then still give plain numbers).
Return JSON only:
{"biz_name":"business name or short descriptive name","industry":"","type":"kind of business","location":"","employees":number,"process_name":"what they'd call this process","process_desc":"one sentence: from what starts it to what ends it","currency":"GBP|USD|EUR|INR",
"demand_per_day":number (units of work arriving per working day),"revenue_per_unit":number,"margin_per_unit":number (contribution per unit),"overtime_rate_per_hour":number,"delay_cost_per_unit_per_hour":number,
"steps":[3 to 8 steps in order, each {"name":"short","desc":"one short sentence","time_min":number (hands-on minutes per unit),"time_min_low":number,"time_min_high":number,"staff":number (people working this step at once),"machines":number,"stations":number (0 if not limiting),"hours_per_day":number,"error_pct":number,"rework_share_pct":number (share of errors that are reworked, usually 100),"rework_min":number,"delay_pct":number (share of units delayed),"delay_min":number,"cancel_pct":number,"exit_label":"what a cancellation is called, or empty","labour_per_hour":number,"machine_per_hour":number,"other_per_unit":number}],
"assumptions":["up to 4 short sentences naming your main guesses"],"likely_bottleneck":"one short sentence on where you expect the hold-up, based on the description"}`;
  try{const r=await AI.json(prompt,{modelTier:"default"});
    const st=(Array.isArray(r.steps)?r.steps:[]).slice(0,8);if(st.length<2)throw new Error("bad");
    const T=STEP_TYP;const nz=(v,lo,hi,d)=>axNum(v,lo,hi,d);
    const steps=st.map(s=>{const t=nz(s.time_min,0.1,10000,T.time);return[String(s.name||"Step").slice(0,60),String(s.desc||"").slice(0,140),t,nz(s.time_min_low,0.1,10000,Math.round(t*0.6*10)/10),nz(s.time_min_high,0.1,10000,Math.round(t*1.8*10)/10),
      nz(s.staff,0,500,1),nz(s.machines,0,500,0),nz(s.stations,0,500,0),nz(s.hours_per_day,0.5,24,8),nz(s.error_pct,0,100,T.err),nz(s.rework_share_pct,0,100,100),nz(s.rework_min,0,10000,T.rwMin),
      nz(s.delay_pct,0,100,T.delay),nz(s.delay_min,0,100000,T.delayMin),nz(s.cancel_pct,0,100,0),String(s.exit_label||"").slice(0,40),nz(s.labour_per_hour,0,1000,T.labour),nz(s.machine_per_hour,0,10000,0),nz(s.other_per_unit,0,100000,0)];});
    OPS_TEMPLATES.ai={label:"AI draft",proc:String(r.process_name||"My process").slice(0,60),desc:String(r.process_desc||"").slice(0,200),industry:String(r.industry||"").slice(0,60),type:String(r.type||"").slice(0,60),biz:String(r.biz_name||"My business").slice(0,60),loc:String(r.location||"").slice(0,60),employees:nz(r.employees,0,1e6,""),
      demand:nz(r.demand_per_day,0.1,1e7,100),revenue:nz(r.revenue_per_unit,0,1e7,0),margin:nz(r.margin_per_unit,0,1e7,0),otRate:nz(r.overtime_rate_per_hour,0,1000,20),otMax:1,delayCost:nz(r.delay_cost_per_unit_per_hour,0,1e5,0.5),steps};
    axOpsUndo=JSON.stringify(O);oLoadTemplate("ai");
    if(["GBP","USD","EUR","INR"].includes(r.currency))O.cur=r.currency;
    O.steps.forEach(s=>OPS_STEP_FIELDS.forEach(f=>{s.src[f]="ai";}));OPS_PROC_FIELDS.forEach(f=>{O.src[f]="ai";});O.aiStart=true;
    oBuildAll();opsRender();opsSave();
    const li=a=>(Array.isArray(a)?a:[]).slice(0,4).map(x=>`<li>${esc(x)}</li>`).join("");
    $("axOpsOut").innerHTML=`<div class="row"><b>Drafted: ${esc(O.proc.name)} · ${O.steps.length} steps</b><span class="chip ai">AI-generated assumptions</span><span class="spacer"></span><button class="pill sm ghost" type="button" id="axOpsUndo">Undo</button></div>
      <ol class="small" style="margin:0;padding-left:20px">${O.steps.map(s=>`<li><b>${esc(s.name)}</b>${s.desc?" · "+esc(s.desc):""}</li>`).join("")}</ol>
      ${r.likely_bottleneck?`<p class="small" style="margin:0"><b>First guess:</b> ${esc(r.likely_bottleneck)} The diagnosis will test this with the numbers.</p>`:""}
      ${li(r.assumptions)?`<details><summary class="small">What the AI assumed</summary><ul class="small" style="margin-top:6px">${li(r.assumptions)}</ul></details>`:""}
      <div class="axrow"><button class="pill" type="button" data-onext="1">Check the steps →</button><span class="small muted">Every number is labelled "AI-generated" until you change it.</span></div>`;
    $("axOpsOut").hidden=false;$("axOpsMsg").textContent="";
    $("axOpsUndo").onclick=()=>{if(!axOpsUndo)return;O=JSON.parse(axOpsUndo);axOpsUndo=null;oBuildAll();opsRender();opsSave();$("axOpsOut").hidden=true;otoast("Undone. Your previous process is back.");};
    if(typeof otoast==="function")otoast("Done. Your process is drafted with AI estimates.");if(window.bbcTrack)bbcTrack("ai_quickstart","ops");
  }catch(e){$("axOpsMsg").textContent=axErr(e,"draft your process");}
  $("axOpsGo").disabled=false;}

/* ---------- 5. "Ask BBC": an assistant on every page that knows where you are and sees your numbers ---------- */
let axHist=[];let axBusy=false;
function axView(){for(const v of ["sim","ops","ma","growth"]){const el=$(v);if(el&&!el.hidden)return v;}return"home";}
function axContext(){const v=axView();
  try{if(v==="sim"){let tab="";const t=document.querySelector('#tabs [aria-selected="true"]');if(t)tab=t.textContent.replace(/^\s*\d+\s*/,"").trim();
      return{where:`Market Entry Simulator${tab?", "+tab+" step":""}`,steps:"Tabs: "+TABS.map(x=>x[1]).join(" → ")+". The Model tab has the price/volume/cost inputs and a 'Start from your business' AI box; Market has TAM/SAM/SOM and 'AI estimates'; Entry difficulty scores 9 barriers; Recommendation compares Enter, Partner and Don't Enter. Users can save, export a report, and tap any number to see how it was calculated.",
        model:modelSummary(),ai_estimated:!!S.aiStart};}
    if(v==="ops"){const C=opsCalc(O);const step=(OSTEPS.find(x=>x[0]===(O.step||"process"))||["",""])[1];
      return{where:`Operations Bottleneck Diagnoser, ${step} step`,steps:"Steps: "+OSTEPS.map(x=>x[1]).join(" → ")+". Process lets you pick a template or describe the process for an AI draft; Numbers has a 'Not sure? Use a typical number' button on each field; Diagnosis shows the bottleneck; Cause & fix has a 5 whys; Fixes compares scenarios; Action plan summarises.",
        model:O.picked?opsSummary():{note:"No process chosen yet"},ai_estimated:!!O.aiStart,steps_count:C.steps.length};}
    if(v==="ma"){let res=null;try{res=maAll(MA);}catch(e){}
      return{where:`M&A Due Diligence Analyst, ${(MSTEPS.find(x=>x[0]===MA.step)||["",""])[1]||"Target"} step`,steps:"Steps: "+MSTEPS.map(x=>x[1]).join(" → ")+". Target: name the company, then AI research or upload annual reports/accounts (PDF, Excel, CSV) so figures are read with page sources. Evidence lists sources; Numbers shows figures and conflicts; Financial health flags; Market; Risks; Synergies & price models valuation; Memo writes a diligence memo to export.",
        target:MA.target,results:res};}
    if(v==="growth"){let res=null;try{const A=gAll(G);res={ranking:A.R.map(r=>({rank:r.rank,title:r.o.title,category:r.o.cat,score:r.score===null?null:+r.score.toFixed(1),class:r.cls.label,confidence:r.conf,quadrant:r.quad&&r.quad.label,status:r.o.status,finance:(()=>{const f=gFin(r.o.fin);return f?{revenue:Math.round(f.revenue),operating_profit:Math.round(f.opProfit),investment:f.investment,payback_months:f.payback===null?null:Math.round(f.payback)}:null;})()})),weights:G.weights,market:A.M};}catch(e){}
      return{where:`Growth Opportunity Finder, ${(GSTEPS.find(x=>x[0]===G.step)||["",""])[1]||"Company"} step`,steps:"Steps: "+GSTEPS.map(x=>x[1]).join(" → ")+". Company: name, goals and limits. Evidence: AI research (company, customers, competitors and market), uploads (PDF, Excel, CSV) and pasted feedback. Customers: products, feedback analysis, unmet needs, segments. Market: competitors, trends, TAM/SAM/SOM. Opportunities: AI-generated ideas to accept or reject. Prioritise: six weighted scores and an attractiveness vs feasibility matrix. Financials: revenue, profit, payback, ROI and three scenarios. 90-day plan: roadmap, KPIs, summary and export.",
        company:G.company,evidence:gContext(5000),engine_results:res};}
  }catch(e){}
  return{where:"Home page",tools:"Market Entry Simulator (pricing, demand, costs, market size, enter a market); Operations Bottleneck Diagnoser (slow or costly processes); M&A Due Diligence Analyst (checking a company before buying or investing); Growth Opportunity Finder (where a business should grow next, ending in a 90-day plan); Hire a team (free pro bono student consultants for broader problems). Every tool is free with an account."};}
function axStarters(){const v=axView();
  return v==="sim"?["Explain my results simply","Why is my profit what it is?","What should I change first?","Is my price too low?"]:
    v==="ops"?["Where is my bottleneck and why?","Which fix should I try first?","What do these numbers mean?","How do I fill in this step?"]:
    v==="ma"?["How do I start a due diligence?","What should I upload?","Explain the red flags","Is the price fair?"]:
    v==="growth"?["Which three opportunities should we pursue first?","Which needs least investment?","What should I do next?","Explain the scores"]:
    ["Which tool should I use?","How does this website work?","Can a student team help me?","Is it really free?"];}
function axBuildChat(){if($("axFab"))return;
  const fab=document.createElement("button");fab.type="button";fab.className="axfab";fab.id="axFab";fab.innerHTML=`<i>✦</i> Ask BBC`;fab.setAttribute("aria-haspopup","dialog");fab.hidden=true;
  const box=document.createElement("section");box.className="axchat";box.id="axChat";box.hidden=true;box.setAttribute("role","dialog");box.setAttribute("aria-label","Ask BBC assistant");
  box.innerHTML=`<div class="axhead"><b>Ask BBC</b><span class="chip ai">AI</span><span class="spacer"></span><button type="button" class="pill sm ghost" id="axClear" title="Start a new conversation">New</button><button type="button" class="xbtn" id="axClose" aria-label="Close" style="position:static">×</button></div>
    <div class="axmsgs" id="axMsgs" aria-live="polite"></div>
    <form class="axform" id="axForm"><label class="sr-only" for="axIn">Your question</label><input id="axIn" type="text" maxlength="600" autocomplete="off" placeholder="Ask anything about your numbers…"><button class="pill" type="submit" id="axSend">Send</button></form>
    <div class="axnote">AI answers can be wrong. It explains the tool's numbers and never changes them.</div>`;
  document.body.appendChild(fab);document.body.appendChild(box);
  fab.onclick=()=>axOpen(true);$("axClose").onclick=()=>axOpen(false);
  $("axClear").onclick=()=>{axHist=[];axDraw();$("axIn").focus();};
  $("axForm").onsubmit=e=>{e.preventDefault();const q=$("axIn").value.trim();if(q)axAsk(q);};
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("axChat").hidden)axOpen(false);});
  box.addEventListener("click",e=>{const c=e.target.closest("[data-axq]");if(c){axAsk(c.dataset.axq);return;}const g=e.target.closest("[data-axgo]");if(g){axOpen(false);const t=g.dataset.axgo;if(t==="team"){if(typeof openHire==="function")openHire();}else setView(t);}});}
function axOpen(on){$("axChat").hidden=!on;$("axFab").hidden=on||!axShouldShow();if(on){axDraw();setTimeout(()=>$("axIn").focus(),30);}else $("axFab").focus();}
function axShouldShow(){return !!AI&&(typeof PROFILE==="undefined"||!!PROFILE)&&!document.body.classList.contains("signup-mode");}
function axSync(){const f=$("axFab"),c=$("axChat");if(!f)return;const ok=axShouldShow();if(!ok){f.hidden=true;c.hidden=true;return;}if(c.hidden)f.hidden=false;}
function axDraw(){const m=$("axMsgs");if(!m)return;
  if(!axHist.length){const where=axContext().where;m.innerHTML=`<div class="axm a">Hi${PROFILE&&PROFILE.name?" "+esc(PROFILE.name.split(" ")[0]):""}. You're on the ${esc(where)}. Ask me anything: what a number means, why a result came out the way it did, or what to do next.</div><div class="axchips">${axStarters().map(s=>`<button type="button" data-axq="${esc(s)}">${esc(s)}</button>`).join("")}</div>`;return;}
  m.innerHTML=axHist.map(h=>`<div class="axm ${h.r==="u"?"u":"a"}">${esc(h.t)}${h.go?`<br><button type="button" class="pill sm" data-axgo="${h.go}">${h.go==="team"?"Request a student team":"Open the "+AX_TOOLS[h.go]} →</button>`:""}</div>`).join("")+(axBusy?`<div class="axm a" id="axTyping">Thinking…</div>`:"");
  m.scrollTop=m.scrollHeight;}
async function axAsk(q){if(axBusy)return;if(!AI){axHist.push({r:"u",t:q},{r:"a",t:"AI isn't available in this view."});axDraw();return;}
  $("axIn").value="";axHist.push({r:"u",t:q});axBusy=true;$("axSend").disabled=true;axDraw();
  const ctx=axContext();const past=axHist.slice(-9,-1).map(h=>(h.r==="u"?"User: ":"Assistant: ")+h.t).join("\n");
  const prompt=`Ask BBC assistant: ${q.slice(0,140)}
You are "Ask BBC", the friendly helper inside BBC – Big Brain Consulting, a free website of consulting tools for students, founders and small businesses.
Rules: plain UK English, warm and brief (under 120 words unless the user asks for more), short paragraphs or a few "- " bullet lines, no markdown headings or bold. No jargon; if you must use a term, explain it in a few words.
Use ONLY numbers from the CONTEXT and quote them; never invent figures. The tool's calculation engine is the source of truth: explain it, never contradict it. If a number is labelled AI-generated or sample, say it's an estimate to check.
If they ask how to do something, tell them exactly where to click on this site. If another tool fits their question better, say so and set "go".
You can't change their numbers yourself; tell them which field to change. Not financial, legal or professional advice: for big decisions, suggest checking with a professional or requesting a free student team.
CONTEXT (where the user is and their current numbers): ${axClip(ctx,9000)}
${past?"CONVERSATION SO FAR:\n"+past.slice(-3000)+"\n":""}USER: ${q}
Return JSON: {"reply":"your answer as plain text with \\n for new lines","go":"sim|ops|ma|growth|team or empty (only if a different tool or a student team would clearly help)"}`;
  try{const r=await AI.json(prompt,{modelTier:"quick"});const go=["sim","ops","ma","growth","team"].includes(r.go)&&r.go!==axView()?r.go:null;
    axHist.push({r:"a",t:String(r.reply||"Sorry, I couldn't put an answer together. Try asking another way.").replace(/\*\*/g,""),go});if(window.bbcTrack)bbcTrack("ai_assistant",axView());}
  catch(e){axHist.push({r:"a",t:axErr(e,"answer")});}
  axBusy=false;$("axSend").disabled=false;axDraw();$("axIn").focus();}

/* ---------- start ---------- */
(function axInit(){axCss();axFinderBuild();axSimBuild();axOpsBuild();axBuildChat();
  if(typeof setView==="function"){const sv=setView;setView=function(v){sv(v);setTimeout(axSync,0);};}
  (window.bbcAuth||Promise.resolve()).then(()=>setTimeout(axSync,50));setInterval(axSync,1500);})();
