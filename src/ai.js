/* ===== AI layer (sits on top of the model, never changes numbers silently), saving and export ===== */
/* On the live website (outside Claude), AI, saving and "who is this visitor" come from our own back door at /api */
const IN_CLAUDE=!!(window.claude&&window.claude.use);
function webUid(){let u=null;try{u=localStorage.getItem("bbc-uid");}catch(e){}
  if(!u){u=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,12));try{localStorage.setItem("bbc-uid",u);}catch(e){}}return u;}
async function bbcApi(path,body,method){const r=await fetch("/api/"+path,{method:method||(body?"POST":"GET"),headers:{"content-type":"application/json"},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.message||j.error||("HTTP "+r.status));e.code=j.error;e.status=r.status;throw e;}return j;}
function bbcTool(){const o=document.getElementById("ops");return o&&!o.hidden?"ops":"sim";}
function webCap(name){if(location.protocol==="file:")return null;const uid=webUid();const q=encodeURIComponent;
  if(name==="sample")return{json:async(prompt,o)=>(await bbcApi("ai",{uid,prompt:prompt+"\n\nFormatting rules: reply with valid JSON only. In fields that are numbers, write percentages out of 100 (2.5 means 2.5%, never 0.025) and money as plain numbers with no symbols or commas. In written sentences, show money with its currency symbol and thousands separators (for example £4,620) and percentages with a % sign, rounded sensibly (for example 121%).",tier:(o&&o.modelTier)||"default",tool:bbcTool()})).data};
  if(name==="user")return{id:async()=>uid};
  if(name==="downloads")return{save:async({filename,data})=>{const blob=new Blob([data],{type:/\.csv$/.test(filename)?"text/csv":"text/markdown"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}};
  if(name==="db"){const ref=path=>({get:async()=>{const r=await bbcApi(`doc?uid=${q(uid)}&path=${q(path)}`);return{exists:!!r.data,data:()=>r.data};},
      set:async d=>{await bbcApi("doc",{uid,path,data:d},"PUT");},delete:async()=>{await bbcApi(`doc?uid=${q(uid)}&path=${q(path)}`,null,"DELETE");}});
    return{collection:p=>({get:async()=>{const r=await bbcApi(`docs?uid=${q(uid)}&path=${q(p)}`);return{docs:r.docs.map(x=>({id:x.id,exists:true,data:()=>x.data}))};},doc:id=>ref(p+"/"+id)}),doc:p=>ref(p)};}
  return null;}
window.bbcTrack=(type,detail)=>{if(IN_CLAUDE||location.protocol==="file:")return;try{fetch("/api/event",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uid:webUid(),type,detail:detail||null}),keepalive:true}).catch(()=>{});}catch(e){}};
const cap=name=>IN_CLAUDE?window.claude.use(name).catch(()=>null):Promise.resolve(webCap(name));
let AI=null;cap("sample").then(s=>{AI=s;});
function toast(t){$("toast").textContent=t;}

/* --- AI market suggestions: shown for review, applied only when accepted --- */
let suggestions=null;
const SUGG_KEYS=[["tam","TAM","money"],["sam","SAM","money"],["share","Expected share of SAM","pct"],["growth","Market growth per year","pct"],["pcust","Potential customers","num"],["spend","Average spend per customer","money"]];
function panels(html){document.querySelectorAll(".ai-panel").forEach(p=>{p.hidden=!html;p.innerHTML=html||"";});}
async function suggest(){
  if(!AI){panels(`<p class="small">AI suggestions aren't available in this view. You can still type your own numbers.</p>`);return;}
  panels(`<div class="row"><h3>AI is estimating your market…</h3><span class="chip ai">AI</span></div><p class="small muted">This usually takes 10 to 40 seconds.</p>`);
  const prompt=`You help users of a pricing and market-entry simulator estimate market-sizing assumptions. Use general knowledge; be conservative and realistic. These are rough estimates the user will check.
Business: ${S.name}. Product: ${S.product}. Target market: ${S.country}. Industry: ${S.industry}. Customer type: ${S.ctype}. Current list price: ${S.price} ${S.cur} per unit.
Return JSON only, all money values per year in ${S.cur}:
{"tam":number,"sam":number,"share_pct":number (realistic share of SAM a new entrant could win in 3 years),"growth_pct":number,"potential_customers":number,"avg_spend":number,"price_low":number,"price_high":number (typical price range per unit for comparable products),"basis":{"tam":"one short sentence on how you got it","sam":"...","share_pct":"...","growth_pct":"...","potential_customers":"...","avg_spend":"..."},"confidence":{"tam":"high|medium|low","sam":"...","share_pct":"...","growth_pct":"...","potential_customers":"...","avg_spend":"..."},"reference_points":["up to 4 well-known public data sources a user could check these against, named only (e.g. a government statistics series), no URLs"],"risks":["3 short market-entry risks"],"questions":["3 short questions the user should investigate"]}`;
  try{
    const r=await AI.json(prompt,{modelTier:"default"});
    suggestions={tam:+r.tam,sam:+r.sam,share:+r.share_pct,growth:+r.growth_pct,pcust:+r.potential_customers,spend:+r.avg_spend,basis:r.basis||{},pl:+r.price_low,ph:+r.price_high,risks:r.risks||[],questions:r.questions||[],conf:r.confidence||{},refs:r.reference_points||[]};
    drawSuggestions();
  }catch(e){panels(`<p class="small">${e&&e.code==="not_granted"?"AI access wasn't allowed, so nothing changed.":e&&e.code==="rate_limited"?"Too many AI requests just now. Try again in a minute.":"The AI couldn't produce estimates this time. Nothing was changed."}</p>`);}
}
function fmtK(v,t){return t==="money"?money(v):t==="pct"?v+"%":num(v);}
function drawSuggestions(){if(!suggestions){panels("");return;}const s=suggestions;const bk={tam:"tam",sam:"sam",share:"share_pct",growth:"growth_pct",pcust:"potential_customers",spend:"avg_spend"};
  const rows=SUGG_KEYS.filter(([k])=>isFinite(s[k])&&s[k]>=0).map(([k,l,t])=>`<div class="sugg"><div><b>${l}: ${fmtK(s[k],t)}</b><small>${esc(s.basis[bk[k]]||"")}</small><small>Confidence: ${esc(s.conf[bk[k]]||"unknown")} · Source: AI estimate, no live source yet · you have ${fmtK(S[k],t)}</small></div>
    ${S.src[k==="sam"&&S.samMode!=="manual"?"samPct":k]==="ai"&&Math.abs((k==="sam"?samOf(S):S[k])-s[k])<=Math.max(1,s[k]*0.002)?'<span class="chip ai">Applied</span><span></span>':`<button class="pill sm" type="button" data-acc="${k}">Use this</button><button class="pill sm ghost" type="button" data-rej="${k}">Ignore</button>`}</div>`).join("");
  const price=isFinite(s.pl)&&isFinite(s.ph)?`<p class="small">Comparable products typically sell for <b>${money2(s.pl)} to ${money2(s.ph)}</b> per unit (your price: ${money2(S.price)}). For reference only, nothing is changed.</p>`:"";
  panels(`<div class="row"><h3>AI market estimates</h3><span class="chip ai">AI-generated assumption</span><span class="spacer"></span><button class="pill sm" type="button" data-acc="all">Use all</button><button class="pill sm ghost" type="button" data-rej="all">Close</button></div>
    <p class="small muted">Rough estimates from the AI's general knowledge, not live research. Nothing changes until you choose "Use this". You can edit any value afterwards.</p>
    <div>${rows}</div>${price}
    <div class="cols"><div><h4>Risks to check</h4><ul class="small" style="margin:6px 0 0;padding-left:18px">${s.risks.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
    <div><h4>Questions to investigate</h4><ul class="small" style="margin:6px 0 0;padding-left:18px">${s.questions.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div></div>
    <div class="ai-sources"><h4>Sources</h4><p class="small muted">These numbers are estimates from the AI's general knowledge. No live research was done, so there are no links yet. Live web research with a clickable source under every number comes when the site launches. Until then, check them against public data such as:</p>
    <ul class="small" style="margin:6px 0 0;padding-left:18px">${s.refs.map(x=>`<li>${esc(x)}</li>`).join("")||"<li>Official statistics for your country and industry reports</li>"}</ul></div>`);}
document.addEventListener("click",e=>{
  const a=e.target.closest("[data-ai]");if(a){const t=a.dataset.ai;t==="suggest"?suggest():t==="entry"?entryAI():explainAI();return;}
  const acc=e.target.closest("[data-acc]");if(acc&&suggestions){const ks=acc.dataset.acc==="all"?SUGG_KEYS.map(x=>x[0]):[acc.dataset.acc];
    ks.forEach(k=>{if(isFinite(suggestions[k])&&suggestions[k]>=0){if(k==="sam"&&S.samMode!=="manual"){const t=(ks.includes("tam")&&isFinite(suggestions.tam))?suggestions.tam:S.tam;if(t>0){S.samPct=Math.round(suggestions.sam/t*1000)/10;S.src.samPct="ai";}}else{S[k]=suggestions[k];S.src[k]="ai";}}});syncInputs();render();saveDraft();drawSuggestions();toast("AI assumptions applied. They're labelled so you can tell them apart.");return;}
  const rej=e.target.closest("[data-rej]");if(rej&&suggestions){if(rej.dataset.rej==="all"){suggestions=null;panels("");}else{const k=rej.dataset.rej;delete suggestions[k];drawSuggestions();}}
});

/* --- AI explanation of the model's results --- */
const AI_LINKS=[["model","kpis","Model"],["pricing","sec-scen","Pricing"],["pricing","sec-sens","Pricing"],["strategy","sec-cmp","Recommendation"],["entry","sec-entry","Entry difficulty"],["pricing","sec-scen","Pricing"],["strategy","sec-score","Recommendation"],["market","sec-fit","Market"]];
const AI_TITLES=["What the numbers say","How price changes affect demand","How elasticity affects the result","The biggest opportunity","The biggest risk","The strongest pricing strategy","Enter, Partner or Don't Enter","What to investigate next"];
function modelSummary(){const b=base(S),M=market(S),R=recommend(S);const r0=v=>Math.round(v);
  const sc=["A","B","C"].map(k=>{const s=scenario(S,S["sc"+k]);return{scenario:k,price:S["sc"+k],price_change_pct:+(s.pct*100).toFixed(1),volume:r0(s.vol),revenue:r0(s.rev),gross_profit:r0(s.gp),operating_profit:r0(s.op),operating_margin_pct:+(s.om*100).toFixed(1)};});
  const d2=Math.min(50,S.discount+10),dc=discountCase(S,d2);
  return{currency:S.cur,company:S.name,product:S.product,market:S.country,industry:S.industry,customer_type:S.ctype,
    today:{list_price:S.price,discount_pct:S.discount,net_price:+b.net.toFixed(2),units_per_year:S.volume,revenue:r0(b.rev),gross_profit:r0(b.gp),gross_margin_pct:+(b.gm*100).toFixed(1),operating_profit:r0(b.op),operating_margin_pct:+(b.om*100).toFixed(1),break_even_units:r0(b.be),contribution_margin_per_unit:+b.cm.toFixed(2)},
    elasticity:S.elastic,elasticity_meaning:(()=>{const t=elasticType(S.elastic);return `${t[1]}: ${t[2]} (Below −1 = customers are price sensitive; −1 = proportional; between −1 and 0 = price insensitive.)`;})(),pricing_scenarios:sc,
    discount_test:{discount_pct:d2,extra_volume_needed_pct:isFinite(dc.reqUplift)?+(dc.reqUplift*100).toFixed(0):null,extra_volume_predicted_pct:+((dc.vol/S.volume-1)*100).toFixed(0)},
    market:{tam:r0(M.tam),sam:r0(M.sam),som:r0(M.som),growth_pct:S.growth,plan_as_pct_of_som:+(M.planVsSom*100).toFixed(0),
      where_each_input_came_from:Object.fromEntries(MARKET_KEYS.map(k=>[F[k].l,S.src[k]==="ai"?"AI-generated assumption":S.src[k]==="example"?"sample value (made up, not real data)":"user input"]))},
    entry_difficulty:{score:+R.EN.score.toFixed(1),top_barriers:R.EN.top.map(t=>t.label+" "+t.score+"/10")},
    enter:{investment:r0(R.E.inv),profit_after_investment:r0(R.E.net),roi_pct:+(R.E.roi*100).toFixed(0),break_even_month:R.E.payback,risk:+R.E.risk.toFixed(1),score:+R.sE.total.toFixed(1)},
    partner:{investment:r0(R.P.inv),partner_revenue_share_pct:S.pShare,profit_after_investment:r0(R.P.net),roi_pct:+(R.P.roi*100).toFixed(0),break_even_month:R.P.payback,risk:+R.P.risk.toFixed(1),score:+R.sP.total.toFixed(1)},
    horizon_years:S.horizon,model_recommendation:R.call};}
async function explainAI(){const out=$("ai-out");
  if(!AI){out.innerHTML=`<p class="small">AI explanations aren't available in this view. Every number and the recommendation above still work without it.</p>`;return;}
  out.innerHTML=`<p class="small muted">Reading your model… this usually takes 10 to 40 seconds.</p>`;
  const prompt=`You explain the results of a deterministic pricing and market-entry model to a student or founder. Plain UK English, no jargon, short sentences.
Rules: use ONLY the numbers in the JSON below and quote them; never invent figures. The model's recommendation is "${recommend(S).call}" and was calculated by a fixed scoring method; explain it, and if you see a reason for caution, say so clearly as a caution, not a new recommendation. Describe elasticity exactly as "elasticity_meaning" says; never call it mildly or weakly sensitive if it is below −1. When an input is a sample value or AI-generated, say so using its plain name from "where_each_input_came_from". Never show field codes or JSON keys.
Return JSON only: {"points":[8 strings]} in this order: ${AI_TITLES.map((t,i)=>`${i+1}) ${t}`).join("; ")}. Each string at most 55 words.
MODEL: ${JSON.stringify(modelSummary())}`;
  try{const r=await AI.json(prompt,{modelTier:"default",cache:false});const pts=(r.points||[]).slice(0,8);
    out.innerHTML=pts.map((p,i)=>`<button type="button" class="pt" data-jump="${i}"><span>${i+1}</span><span class="tx"><b>${AI_TITLES[i]}</b>${esc(p)}<em>See where this comes from in ${AI_LINKS[i][2]} →</em></span></button>`).join("")+
      `<p class="small muted">Explanation of the model as it stood when you asked. Change an input and ask again to refresh it.</p>`;
  }catch(e){out.innerHTML=`<p class="small">${e&&e.code==="not_granted"?"AI access wasn't allowed.":e&&e.code==="rate_limited"?"Too many AI requests just now. Try again in a minute.":"The AI couldn't write an explanation this time. Try again."}</p>`;}
}

/* --- Saving: to the viewer's private account space if available, otherwise this browser --- */
let DB=null,UID=null;
const LOCAL_KEY="mes-saved";
function localList(){try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||"[]");}catch(e){return[];}}
function localPut(arr){try{localStorage.setItem(LOCAL_KEY,JSON.stringify(arr));return true;}catch(e){return false;}}
async function listSaved(){
  if(DB){try{const q=await DB.collection("data/users/"+UID).get();return q.docs.filter(d=>d.exists&&d.id.startsWith("sim_")).map(d=>Object.assign({id:d.id},d.data())).sort((a,b)=>b.savedAt-a.savedAt);}catch(e){return[];}}
  return localList().sort((a,b)=>b.savedAt-a.savedAt);}
let pendingDelete=null;
async function drawSaved(){const items=await listSaved();
  $("saved").innerHTML=items.length?items.map(it=>`<div class="it"><b>${esc(it.name)}</b><small>${new Date(it.savedAt).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})} · ${esc(it.call||"")}</small><span class="spacer"></span>
    <button class="pill sm" type="button" data-load="${it.id}">Open</button><button class="pill sm ghost" type="button" data-del="${it.id}">${pendingDelete===it.id?"Tap again to delete":"Delete"}</button></div>`).join(""):`<p class="small" style="color:inherit;opacity:.7">No saved simulations yet.</p>`;}
async function saveSim(){const name=($("saveName").value||"").trim()||`${S.name||"Simulation"} · ${new Date().toLocaleDateString("en-GB")}`;
  const rec={name,savedAt:Date.now(),call:recommend(S).call,state:JSON.parse(JSON.stringify(S))};
  if(DB){try{await DB.collection("data/users/"+UID).doc("sim_"+Date.now().toString(36)).set(rec);toast(`Saved "${name}" to your account.`);}catch(e){toast("Couldn't save to your account just now. Try again.");return;}}
  else{const arr=localList();arr.push(Object.assign({id:"sim_"+Date.now().toString(36)},rec));toast(localPut(arr)?`Saved "${name}" in this browser.`:"This browser blocked saving. Try exporting instead.");}
  $("saveName").value="";drawSaved();}
document.addEventListener("click",e=>{const j=e.target.closest("[data-jump]");if(!j)return;const[t,id]=AI_LINKS[+j.dataset.jump];go(t);
  const el=$(id);if(!el)return;setTimeout(()=>{el.scrollIntoView({behavior:"smooth",block:"center"});el.classList.remove("flash");void el.offsetWidth;el.classList.add("flash");},30);});
document.addEventListener("click",async e=>{
  const l=e.target.closest("[data-load]");if(l){const items=await listSaved();const it=items.find(x=>x.id===l.dataset.load);if(it){S=Object.assign(fresh(),it.state);anchorAll();applyRanges();syncInputs();render();saveDraft();toast(`Opened "${it.name}".`);go("dash");$("app").scrollIntoView({behavior:"smooth"});}return;}
  const d=e.target.closest("[data-del]");if(d){const id=d.dataset.del;if(pendingDelete!==id){pendingDelete=id;drawSaved();return;}pendingDelete=null;
    if(DB){try{await DB.collection("data/users/"+UID).doc(id).delete();}catch(err){toast("Couldn't delete it just now.");}}else localPut(localList().filter(x=>x.id!==id));
    toast("Deleted.");drawSaved();}
});
$("saveBtn").onclick=()=>needProfile(saveSim,"save your simulation");
Promise.all([cap("db"),cap("user")]).then(async([db,user])=>{
  if(db&&user){try{UID=await user.id();if(UID){DB=db;}}catch(e){}}
  drawSaved();loadProfile();});

/* --- Export --- */
let DL=null;cap("downloads").then(d=>{DL=d;});
function report(){const b=base(S),M=market(S),R=recommend(S);const L=[];
  L.push(`# ${S.name}: ${S.product}`,`Market: ${S.country} · ${S.industry} · ${S.ctype}`,`Generated ${new Date().toLocaleString("en-GB")} with the Market Entry Simulator by BBC (Big Brain Consulting)`,"",
  `## Recommendation: ${R.call}`,recText(R),"",
  "## Today's model (per year)",`- List price ${money2(S.price)}, discount ${S.discount}%, net price ${money2(b.net)}`,`- Units ${num(b.vol)}, revenue ${money(b.rev)}`,
  `- Gross profit ${money(b.gp)} (${pct(b.gm)}), operating profit ${money(b.op)} (${pct(b.om)})`,`- Break-even ${num(b.be)} units (${num(b.beAcq)} incl. acquisition), profit per unit ${money2(b.ppu)}`,"",
  `## Pricing scenarios (elasticity ${el(S.elastic)})`);
  [["Current",S.price],["A",S.scA],["B",S.scB],["C",S.scC]].forEach(([n,p])=>{const s=scenario(S,p);L.push(`- ${n}: ${money2(p)} → ${num(s.vol)} units, revenue ${money(s.rev)}, operating profit ${money(s.op)} (${pct(s.om)})`);});
  L.push("","## Market",`- TAM ${money(M.tam)}, SAM ${money(M.sam)} (${S.samMode==="manual"?"entered directly":S.samPct+"% of TAM"}), SOM ${money(M.som)} (${S.share}% of SAM), growth ${S.growth}%/yr`,
    `- Sources: ${MARKET_KEYS.map(k=>`${k} ${S.src[k]==="ai"?"AI-generated assumption":S.src[k]==="example"?"example value":"user input"}`).join(", ")}`,"",
    `## Entry difficulty: ${R.EN.score.toFixed(1)} / 10`,...R.EN.top.map(t=>`- ${t.label}: ${t.score}/10`),"",
    `## Options over ${S.horizon} years`,`- Enter: invest ${money(R.E.inv)}, profit after investment ${money(R.E.net)}, break-even ${months(R.E.payback)}, risk ${R.E.risk.toFixed(1)}, score ${R.sE.total.toFixed(1)}`,
    `- Partner: invest ${money(R.P.inv)}, profit after investment ${money(R.P.net)}, break-even ${months(R.P.payback)}, risk ${R.P.risk.toFixed(1)}, score ${R.sP.total.toFixed(1)}`,
    `- Don't enter: investment avoided ${money(R.E.inv)}`,"","This is a simple model to support thinking, not financial advice.");
  return L.join("\n");}
function csv(){const b=base(S),M=market(S),R=recommend(S);const rows=[["Section","Item","Value","Source"]];
  const inp=["price","volume","discount","varcost","fixed","cac","upc","conv","elastic","tam","samPct","sam","share","growth","pcust","spend","invest","horizon","ttmE","pShare","pCac","pFixed","pInv","ttmP","pRisk"];
  inp.forEach(k=>rows.push(["Input",F[k].l,S[k],MARKET_KEYS.includes(k)?(S.src[k]==="ai"?"AI-generated assumption":S.src[k]==="example"?"Example":"User input"):"User input"]));
  [["Net price",b.net],["Revenue",b.rev],["Variable costs",b.vc],["Gross profit",b.gp],["Gross margin",b.gm],["Acquisition costs",b.acq],["Operating profit",b.op],["Operating margin",b.om],["Break-even volume",b.be],["Profit per unit",b.ppu],["SOM",M.som],["Entry difficulty",R.EN.score],
   ["Enter profit after investment",R.E.net],["Partner profit after investment",R.P.net],["Enter score",R.sE.total],["Partner score",R.sP.total]].forEach(([l,v])=>rows.push(["Calculated",l,isFinite(v)?+v.toFixed(4):"",S.cur]));
  rows.push(["Result","Recommendation",R.call,"Scoring model"]);
  return rows.map(r=>r.map(c=>{const s=String(c);return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}).join(",")).join("\n");}
async function exportFile(name,data){
  if(DL){try{await DL.save({filename:name,data});toast("Export ready.");return;}catch(e){if(e&&e.code==="declined"){toast("Export cancelled.");return;}}}
  try{await navigator.clipboard.writeText(data);toast("Downloads aren't available here, so the content was copied. Paste it into a document.");}catch(e){toast("Export isn't available in this view.");}}
const slug=()=>(S.name||"simulation").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"simulation";
$("expReport").onclick=()=>needProfile(()=>exportFile(slug()+"-report.md",report()),"export your report");
$("expCsv").onclick=()=>needProfile(()=>exportFile(slug()+"-data.csv",csv()),"export your data");

/* --- Profile (required to save and export) --- */
let PROFILE=null,pendingAfterProfile=null;
async function loadProfile(){
  if(DB){try{const d=await DB.collection("data/users/"+UID).doc("profile").get();if(d.exists)PROFILE=d.data();}catch(e){}}
  if(!PROFILE){try{PROFILE=JSON.parse(localStorage.getItem("mes-profile")||"null");}catch(e){}}
  drawProfileBtn();}
function drawProfileBtn(){const b=$("navProfile");b.textContent=PROFILE?(PROFILE.name.split(" ")[0]+"'s profile"):"Make your profile";}
function openProfile(reason){const p=PROFILE||{};$("pfName").value=p.name||"";$("pfEmail").value=p.email||"";$("pfRole").value=p.role||"Student";$("pfWork").value=p.work||"";$("pfNews").checked=!!p.news;$("pfErr").textContent="";
  $("pfTitle").textContent=PROFILE?"Your profile":reason?"Create your free profile":"Make your profile";
  $("pfLead").textContent=reason&&!PROFILE?`You need a free profile to ${reason}. It takes 20 seconds, and we'll carry on straight after.`:"Free. Your profile lets you save simulations, export reports and pick up where you left off.";
  $("pfSubmit").textContent=PROFILE?"Save changes":reason?"Create profile and continue":"Create my profile";
  $("profileModal").hidden=false;setTimeout(()=>$("pfName").focus(),30);}
function needProfile(fn,reason){if(PROFILE){fn();return;}pendingAfterProfile=fn;openProfile(reason);}
document.addEventListener("click",e=>{if(e.target.closest("[data-profile]"))openProfile();});
$("pfForm").addEventListener("submit",async e=>{e.preventDefault();
  const name=$("pfName").value.trim(),email=$("pfEmail").value.trim();
  if(!name){$("pfErr").textContent="Please add your name.";$("pfName").focus();return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$("pfErr").textContent="Please enter a valid email address, like name@example.com.";$("pfEmail").focus();return;}
  const p={name,email,role:$("pfRole").value,work:$("pfWork").value.trim(),news:$("pfNews").checked,createdAt:(PROFILE&&PROFILE.createdAt)||Date.now(),updatedAt:Date.now()};
  let ok=false;if(DB){try{await DB.collection("data/users/"+UID).doc("profile").set(p);ok=true;}catch(err){}}
  try{localStorage.setItem("mes-profile",JSON.stringify(p));ok=true;}catch(err){}
  PROFILE=p;drawProfileBtn();$("profileModal").hidden=true;
  toast(ok?`Profile saved. Welcome, ${name.split(" ")[0]}.`:"Profile set for this visit. This browser blocked saving it, so you may need to add it again next time.");
  const f=pendingAfterProfile;pendingAfterProfile=null;if(f)f();});
document.addEventListener("click",e=>{if(e.target.closest('[data-close="profileModal"]'))pendingAfterProfile=null;});

/* --- AI estimate for entry barriers (24) --- */
let entrySugg=null;
function entryPanel(html){const p=document.querySelector(".ai-entry");p.hidden=!html;p.innerHTML=html||"";}
async function entryAI(){
  if(!AI){entryPanel(`<p class="small">AI estimates aren't available in this view. You can still score the barriers yourself.</p>`);return;}
  entryPanel(`<div class="row"><h3>AI is scoring the barriers…</h3><span class="chip ai">AI</span></div><p class="small muted">This usually takes 10 to 40 seconds.</p>`);
  const prompt=`You help users of a market-entry simulator score market-entry barriers. Be realistic and specific to the case.
Business: ${S.name}. Product: ${S.product}. Target market: ${S.country}. Industry: ${S.industry}. Customer type: ${S.ctype}. Price ${S.price} ${S.cur} per unit.
Score each barrier 1 (very easy) to 10 (very hard) for a new entrant. Return JSON only:
{"scores":{${FACTORS.map(([k,l])=>`"${k}":{"score":number,"reason":"one short sentence specific to this case (${l})","confidence":"high|medium|low"}`).join(",")}}}`;
  try{const r=await AI.json(prompt,{modelTier:"default"});entrySugg=r.scores||{};drawEntrySugg();}
  catch(e){entryPanel(`<p class="small">${e&&e.code==="not_granted"?"AI access wasn't allowed, so nothing changed.":e&&e.code==="rate_limited"?"Too many AI requests just now. Try again in a minute.":"The AI couldn't score the barriers this time. Nothing was changed."}</p>`);}}
function drawEntrySugg(){if(!entrySugg){entryPanel("");return;}
  const rows=FACTORS.filter(([k])=>entrySugg[k]&&isFinite(+entrySugg[k].score)).map(([k,l])=>{const g=entrySugg[k];const sc=Math.min(10,Math.max(1,Math.round(+g.score)));const applied=S.esrc&&S.esrc[k]==="ai"&&S["f_"+k]===sc;
    return `<div class="sugg"><div><b>${l}: ${sc}/10</b><small>${esc(g.reason||"")}</small><small>Confidence: ${esc(g.confidence||"unknown")} · Source: AI estimate, no live source yet · you have ${S["f_"+k]}/10</small></div>
    ${applied?'<span class="chip ai">Applied</span><span></span>':`<button class="pill sm" type="button" data-eacc="${k}">Use this</button><button class="pill sm ghost" type="button" data-erej="${k}">Ignore</button>`}</div>`;}).join("");
  entryPanel(`<div class="row"><h3>AI barrier scores</h3><span class="chip ai">AI-generated assumption</span><span class="spacer"></span><button class="pill sm" type="button" data-eacc="all">Use all</button><button class="pill sm ghost" type="button" data-erej="all">Close</button></div>
    <p class="small muted">Suggested scores only. Nothing changes until you choose "Use this". Your weights stay exactly as you set them.</p><div>${rows}</div>
    <div class="ai-sources"><h4>Sources</h4><p class="small muted">Based on the AI's general knowledge, not live research. Linked sources for each reason arrive when the site launches with live web search.</p></div>`);}
document.addEventListener("click",e=>{const a=e.target.closest("[data-eacc]");if(a&&entrySugg){const ks=a.dataset.eacc==="all"?FACTORS.map(f=>f[0]):[a.dataset.eacc];S.esrc=S.esrc||{};
    ks.forEach(k=>{const g=entrySugg[k];if(g&&isFinite(+g.score)){S["f_"+k]=Math.min(10,Math.max(1,Math.round(+g.score)));S.esrc[k]="ai";}});syncInputs();render();saveDraft();drawEntrySugg();toast("AI scores applied. They're labelled so you can tell them apart.");return;}
  const r=e.target.closest("[data-erej]");if(r&&entrySugg){if(r.dataset.erej==="all"){entrySugg=null;entryPanel("");}else{delete entrySugg[r.dataset.erej];drawEntrySugg();}}});

/* --- Hire a team (pro bono student teams) --- */
let HIRE_SENT=null;
async function openHire(){$("hrFormWrap").hidden=false;$("hrDone").hidden=true;$("hrErr").textContent="";
  const p=PROFILE||{};if(!$("hrName").value)$("hrName").value=p.name||"";if(!$("hrEmail").value)$("hrEmail").value=p.email||"";if(!$("hrCo").value)$("hrCo").value=S.name||"";
  const items=await listSaved();
  $("hrSim").innerHTML=`<option value="none">No simulation</option><option value="current" selected>My current simulation (${esc(S.name||"untitled")})</option>`+items.map(it=>`<option value="${esc(it.id)}">${esc(it.name)}</option>`).join("");
  $("hireModal").hidden=false;setTimeout(()=>$("hrName").focus(),30);}
document.addEventListener("click",e=>{if(e.target.closest("[data-hire]"))openHire();});
$("hrForm").addEventListener("submit",async e=>{e.preventDefault();
  const name=$("hrName").value.trim(),email=$("hrEmail").value.trim(),q=$("hrQ").value.trim();
  if(!name){$("hrErr").textContent="Please add your name.";$("hrName").focus();return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$("hrErr").textContent="Please enter a valid email address, like name@example.com.";$("hrEmail").focus();return;}
  if(q.length<5){$("hrErr").textContent="Please describe the decision you need help with.";$("hrQ").focus();return;}
  const simSel=$("hrSim").value;let sim=null;
  if(simSel==="current")sim={name:S.name,call:recommend(S).call,state:JSON.parse(JSON.stringify(S))};
  else if(simSel!=="none"){const it=(await listSaved()).find(x=>x.id===simSel);if(it)sim={name:it.name,call:it.call,state:it.state};}
  const req={name,email,company:$("hrCo").value.trim(),decision:q,stage:$("hrStage").value,timeline:$("hrWhen").value,simulation:sim,sentAt:Date.now()};
  let sent=false;
  if(DB&&UID){try{await DB.doc("requests/"+UID).set(req);sent=true;}catch(err){}}
  try{localStorage.setItem("mes-hire",JSON.stringify(req));}catch(err){}
  HIRE_SENT=req;$("hrFormWrap").hidden=true;$("hrDone").hidden=false;
  $("hrDoneText").textContent=sent?`Thanks, ${name.split(" ")[0]}. Your request has been sent. We'll match you with a student team and reply to ${email}.`
    :`Thanks, ${name.split(" ")[0]}. Student teams are opening soon. We've saved your request on this device, so you won't need to fill it in again.`;});
