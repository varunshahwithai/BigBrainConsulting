/* ===== Growth Opportunity Finder: screens, AI research and saving. The engine (growthengine.js) owns every number. ===== */
const GSTEPS=[["company","Company"],["evidence","Evidence"],["customers","Customers"],["market","Market"],["opps","Opportunities"],["prioritise","Prioritise"],["financials","Financials"],["roadmap","90-day plan"]];
const G_OBJECTIVES=["Increase revenue","Acquire new customers","Increase customer retention","Enter new geographic markets","Launch new products","Expand existing products","Target new customer segments","Improve market share","Increase average order value","Improve profitability","Strengthen competitive positioning","Diversify revenue streams"];
const G_SRC={upload:"From your data",ai:"AI estimate, unverified",live:"Live web source",user:"Added by you",calc:"Calculated",example:"Example (made up)",paste:"From your data"};
function gFresh(){return{v:1,step:"company",furthest:0,company:{name:""},objectives:[],constraints:{},currency:"GBP",sources:[],findings:[],products:[],
  feedback:{items:[],analysed:null},needs:[],segments:[],competitors:[],trends:[],market:{src:{}},opps:[],weights:Object.assign({},G_WEIGHTS),thresh:Object.assign({},G_THRESH),
  scen:JSON.parse(JSON.stringify(G_SCEN_DEFAULT)),finSel:null,roadmap:[],kpis:[],start:"",summary:null,example:false};}
let G=null;try{const d=JSON.parse(localStorage.getItem("gr-draft")||"null");if(d&&d.v===1)G=Object.assign(gFresh(),d);}catch(e){}
if(!G)G=gFresh();
let GTAB=G.step||"company",GBUSY=null,G_A=null,gResumeShown=false,gMatrixSel=null;
const gIdx=k=>GSTEPS.findIndex(s=>s[0]===k);
const gId=()=>Date.now().toString(36).slice(-5)+Math.random().toString(36).slice(2,6);
function gSave(){clearTimeout(gSave.t);gSave.t=setTimeout(()=>{try{localStorage.setItem("gr-draft",JSON.stringify(G));}catch(e){}},300);}
function gGet(p){return p.split(".").reduce((o,k)=>o==null?undefined:o[k],G);}
function gSet(p,v){const ks=p.split(".");let o=G;ks.slice(0,-1).forEach(k=>{if(o[k]==null||typeof o[k]!=="object")o[k]={};o=o[k];});o[ks[ks.length-1]]=v;}
function gSym(){return(typeof MCURS!=="undefined"&&MCURS[G.currency])||({GBP:"£",USD:"$",EUR:"€",INR:"₹"}[G.currency])||"£";}
function gm(v,full){if(v===null||v===undefined||!isFinite(v))return"—";const s=v<0?"−":"",a=Math.abs(v),c=gSym();
  if(full)return s+c+Math.round(a).toLocaleString("en-GB");return s+c+(a>=1e9?(a/1e9).toFixed(1).replace(/\.0$/,"")+"bn":a>=1e6?(a/1e6).toFixed(1).replace(/\.0$/,"")+"m":a>=1e4?Math.round(a/1e3)+"k":a>=1000?(a/1e3).toFixed(1).replace(/\.0$/,"")+"k":a>=100?Math.round(a):a.toFixed(2).replace(/\.00$/,""));}
const gpct=(v,d)=>v===null||v===undefined||!isFinite(v)?"—":(+v).toFixed(d===undefined?1:d).replace(/\.0$/,"")+"%";
const gn=v=>{if(v===""||v===null||v===undefined)return null;const n=+String(v).replace(/[^0-9.\-]/g,"");return isFinite(n)?n:null;};
function gChip(st,extra){const t=G_SRC[st]||st;const cls=st==="ai"?"ai":st==="live"||st==="upload"||st==="paste"?"go":st==="example"?"in":"new";return`<span class="chip ${cls}">${esc(t)}${extra?` · ${esc(extra)}`:""}</span>`;}
function gOnline(){return !IN_CLAUDE&&location.protocol!=="file:";}
function gToast(t){const el=$("gtoast");if(el)el.textContent=t;if(typeof toast==="function")toast(t);}
function gWorking(html,where){const ids={evidence:"g-working",customers:"g-working3",market:"g-working4",opps:"g-working5",financials:"g-working7",roadmap:"g-working8"};const w=$(ids[where||GTAB]);if(!w)return;w.hidden=!html;w.innerHTML=html?`<div class="card big"><div class="row"><span class="chip ai">AI</span><b>${html}</b></div><p class="small muted">This usually takes 10 to 40 seconds. You can keep reading while you wait.</p></div>`:"";}
function gErr(e,what){return e&&e.code==="rate_limited"?(e.message||"Too many AI requests just now. Try again in a minute."):e&&e.code==="login_needed"?"Please log in again to use AI.":e&&e.code==="not_granted"?"AI access wasn't allowed, so nothing changed.":`The AI couldn't ${what} this time. Nothing was changed. Please try again.`;}

/* ---------- AI calls ---------- */
const G_NO_NET="\nIMPORTANT: you have no internet access for this request. Answer from your own knowledge, which may be out of date; say which year facts relate to. Only give a source_url if it is the company's well-known official website, otherwise leave it empty. Never invent URLs, figures or quotes.";
async function gAI(prompt,tier){if(!AI)throw{code:"no_ai"};return await AI.json(prompt,{modelTier:tier||"default"});}
/* research: live web search through the website when it's switched on, otherwise the AI's own knowledge, labelled */
async function gResearchCall(prompt,queries){
  if(gOnline()){const r=await bbcApi("growth/research",{uid:webUid(),prompt,queries,target:{name:G.company.name,industry:G.company.industry||""}});return{data:r.data||{},sources:r.sources||[],live:!!r.live};}
  return{data:await gAI(prompt+G_NO_NET),sources:[],live:false};}
function gTargetLine(){const c=G.company;return`Company: ${c.name}${c.industry?" ("+c.industry+")":""}${c.country?", operating in "+c.country:""}${c.website?", website "+c.website:""}${c.products?". Main products: "+c.products:""}${c.model?". Business model: "+c.model:""}.`;}
function gAddSource(o){const ex=G.sources.find(s=>(o.url&&s.url===o.url)||(o.filename&&s.filename===o.filename&&s.kind===o.kind));if(ex)return ex;const s=Object.assign({id:gId(),at:Date.now()},o);G.sources.push(s);return s;}
function gAddFinding(f){if(!f.text||!String(f.text).trim())return;const t=String(f.text).trim().slice(0,400);if(G.findings.some(x=>x.text===t))return;G.findings.push(Object.assign({id:gId()},f,{text:t}));}
function gLiveStatus(url,sources){if(!url)return"ai";const d=u=>{try{return new URL(u).hostname.replace(/^www\./,"");}catch(e){return u;}};return sources.some(s=>s.url===url||d(s.url)===d(url))?"live":"ai";}
async function gResearch(task){if(GBUSY)return;if(!(G.company.name||"").trim()){gGo("company");return;}if(!PROFILE&&typeof needProfile==="function"){needProfile(()=>gResearch(task),"research");return;}
  if(!AI&&!gOnline()){gWorking("");gToast("AI research isn't available in this view.");return;}
  const name=G.company.name;const P={
    company:{label:`Researching ${esc(name)}…`,q:[`${name} company overview business model products`,`${name} revenue results ${new Date().getFullYear()}`,`${name} latest news expansion launch`],
      p:`Research this company for a growth strategy review. ${gTargetLine()}
Return JSON: {"overview":"2-3 sentences","business_model":"","customers":"who buys today","presence":"where it operates","positioning":"how it competes","capabilities":["up to 5 strengths it could build on"],"revenue":{"value":number or null,"year":"","currency":""},"products":[{"name":"","category":"","price":number or null,"description":""}],"developments":[{"text":"recent launch, expansion, partnership or result, one sentence","year":"","source_url":""}],"confidence":"high|medium|low"}
Mark marketing claims as claims. Don't assume a private company publishes financials.`},
    customers:{label:`Researching ${esc(name)}'s customers…`,q:[`${name} reviews complaints`,`${name} customer reviews trustpilot`,`${name} reddit customers`],
      p:`Research what customers say about this company and its product category. ${gTargetLine()}
Return JSON: {"praise":[{"theme":"","detail":"one sentence","source_url":""}],"complaints":[{"theme":"","detail":"","source_url":""}],"requests":[{"theme":"what customers wish existed","detail":"","source_url":""}],"changing_expectations":[{"theme":"","detail":"","source_url":""}],"note":"one sentence on how reliable this is"}
These are themes, not counts: never invent numbers of reviews or percentages.`},
    market:{label:"Researching competitors and the market…",q:[`${name} competitors`,`${G.company.industry||name} market size growth ${G.company.country||""}`,`${G.company.industry||name} industry trends ${new Date().getFullYear()}`,`${G.company.industry||name} new product launches competitors`],
      p:`Research the competitors and market for this company. ${gTargetLine()}
Return JSON: {"competitors":[{"name":"","products":"","pricing":"","customers":"","presence":"","positioning":"","recent_moves":"launches, expansions, pricing changes, partnerships with year","strengths":"","weaknesses":"","source_url":""}],
"trends":[{"trend":"","evidence":"","geography":"","impact":"high|medium|low","horizon":"now|1-2 years|3+ years","opportunity":"what it could mean for this company","confidence":"high|medium|low","source_url":"","date":""}],
"market_size":{"definition":"which market this is","tam":number or null,"currency":"","sam_pct":number or null,"share_pct":number or null,"growth_pct":number or null,"potential_customers":number or null,"avg_spend":number or null,"basis":"how the figures were reached, and which are estimates","source_url":""}}
Up to 5 competitors and 5 trends. A competitor's move is a signal to assess, not proof a market is attractive.`}};
  const T=P[task];if(!T)return;GBUSY=task;gWorking(T.label,"evidence");gRender();
  try{const r=await gResearchCall(T.p,T.q);const d=r.data||{},src=r.sources||[];const live=r.live;
    const base=gAddSource({kind:live?"live":"ai",title:live?`Live web research: ${task}`:`AI research: ${task}`,date:new Date().toISOString().slice(0,10)});
    src.forEach(s=>gAddSource({kind:"live",title:s.title||s.url,url:s.url,date:s.date||""}));
    const F=(area,text,url,conf)=>{const st=live?gLiveStatus(url,src):"ai";const s=url&&st==="live"?gAddSource({kind:"live",title:url,url}):base;gAddFinding({area,text,sourceId:s.id,status:st,url:url||"",conf:conf||d.confidence||""});};
    if(task==="company"){["overview","business_model","customers","presence","positioning"].forEach(k=>d[k]&&F("company",(k==="overview"?"":k.replace("_"," ")+": ")+d[k]));
      (d.capabilities||[]).forEach(c=>F("company","Capability: "+c));
      if(d.revenue&&d.revenue.value)F("company",`Revenue: ${d.revenue.currency||""} ${(+d.revenue.value).toLocaleString("en-GB")} (${d.revenue.year||"year not stated"})`);
      (d.developments||[]).forEach(x=>x&&x.text&&F("company",`${x.text}${x.year?" ("+x.year+")":""}`,x.source_url));
      (d.products||[]).slice(0,10).forEach(p=>{if(p&&p.name&&!G.products.some(q=>q.name.toLowerCase()===String(p.name).toLowerCase()))G.products.push({name:String(p.name).slice(0,60),category:p.category||"",price:gn(p.price),revenue:null,prevRevenue:null,cost:null,rating:null,status:"ai"});});
      if(!G.company.model&&d.business_model)G.company.model=String(d.business_model).slice(0,160);}
    if(task==="customers"){[["praise","Customers like"],["complaints","Customers complain about"],["requests","Customers ask for"],["changing_expectations","Changing expectation"]].forEach(([k,l])=>(d[k]||[]).forEach(x=>x&&x.theme&&F("customer",`${l}: ${x.theme}${x.detail?" — "+x.detail:""}`,x.source_url)));
      if(d.note)F("customer","Reliability: "+d.note);}
    if(task==="market"){(d.competitors||[]).slice(0,6).forEach(c=>{if(!c||!c.name)return;const st=live?gLiveStatus(c.source_url,src):"ai";const i=G.competitors.findIndex(x=>x.name.toLowerCase()===String(c.name).toLowerCase());const o={name:String(c.name).slice(0,60),products:c.products||"",pricing:c.pricing||"",customers:c.customers||"",presence:c.presence||"",positioning:c.positioning||"",moves:c.recent_moves||"",strengths:c.strengths||"",weaknesses:c.weaknesses||"",url:c.source_url||"",status:st};if(i>=0)G.competitors[i]=o;else G.competitors.push(o);});
      (d.trends||[]).slice(0,6).forEach(t=>{if(t&&t.trend&&!G.trends.some(x=>x.trend===t.trend))G.trends.push({trend:t.trend,evidence:t.evidence||"",geo:t.geography||"",impact:t.impact||"",horizon:t.horizon||"",opportunity:t.opportunity||"",conf:t.confidence||"",url:t.source_url||"",date:t.date||"",status:live?gLiveStatus(t.source_url,src):"ai"});});
      gApplyMarket(d.market_size,live?gLiveStatus(d.market_size&&d.market_size.source_url,src):"ai");}
    gWorking("","evidence");gToast(live?"Research added, with live web sources.":"Research added. It's from the AI's knowledge, so check anything important.");if(window.bbcTrack)bbcTrack("growth_research",task);
  }catch(e){gWorking("","evidence");gToast(gErr(e,"finish the research"));}
  GBUSY=null;gSave();gRender();}
function gApplyMarket(ms,st){if(!ms)return;const m=G.market;m.src=m.src||{};const set=(k,v)=>{v=gn(v);if(v!==null&&(m[k]===undefined||m[k]===null||m[k]===""||m.src[k]==="ai"||m.src[k]==="live")){m[k]=v;m.src[k]=st;}};
  set("tam",ms.tam);set("samPct",ms.sam_pct);set("share",ms.share_pct);set("growth",ms.growth_pct);set("pcust",ms.potential_customers);set("spend",ms.avg_spend);
  if(ms.definition)m.definition=String(ms.definition).slice(0,200);if(ms.basis)m.basis=String(ms.basis).slice(0,500);if(ms.source_url)m.url=ms.source_url;}

/* ---------- uploads and pasted text ---------- */
function gExtractPrompt(text,name){return`You are reading a document for a growth strategy review of ${G.company.name||"a company"}. Document "${name}":\n\n${text}\n\nReturn JSON only, copying facts exactly, never inventing: {"document":{"title":"","type":"","date":"","currency":""},"products":[{"name":"","category":"","price":null,"revenue":null,"prev_revenue":null,"cost":null,"rating":null,"period":"","page":""}],"metrics":[{"name":"","value":0,"unit":"","period":"","page":""}],"feedback":[{"text":"one customer comment quoted exactly","rating":null,"product":""}],"findings":[{"area":"company|product|customer|competitor|trend|market","text":"","page":""}]}`;}
async function gUpload(files){if(GBUSY||!files||!files.length)return;if(!(G.company.name||"").trim()){gGo("company");return;}if(!PROFILE&&typeof needProfile==="function"){needProfile(()=>gUpload(files),"upload documents");return;}
  const list=[...files].slice(0,5);
  for(let i=0;i<list.length;i++){const f=list[i];GBUSY="upload";gWorking(`Reading ${esc(f.name)}${list.length>1?` (${i+1} of ${list.length})`:""}…`,"evidence");
    try{if(f.size>19.5*1024*1024&&/\.pdf$/i.test(f.name))throw new Error("This PDF is over about 19 MB. Upload just the pages you need.");
      const raw=await mReadFile(f);let text=null,pdf=null;
      if(typeof raw==="string"&&raw.startsWith("data:"))pdf=raw.split(",")[1];
      else if(raw instanceof ArrayBuffer){const X=await mLoadXlsx();const wb=X.read(raw,{type:"array"});text=wb.SheetNames.slice(0,12).map(n=>`--- Sheet: ${n} ---\n`+X.utils.sheet_to_csv(wb.Sheets[n]).split("\n").slice(0,600).join("\n")).join("\n\n");}
      else text=String(raw);
      let d;
      if(gOnline()){const body={uid:webUid(),filename:f.name,kind:"growth",target:{name:G.company.name,industry:G.company.industry||""}};if(pdf)body.pdf=pdf;else body.text=text.slice(0,400000);d=(await bbcApi("ma/extract",body)).data||{};}
      else{if(pdf)throw new Error("Reading PDFs works on the live website. Here, try a CSV or Excel file, or paste the text.");d=await gAI(gExtractPrompt(text.slice(0,10000),f.name));}
      gApplyDoc(d,f.name);
    }catch(e){gToast(e&&e.message&&!e.code?e.message:gErr(e,"read "+f.name));}}
  GBUSY=null;gWorking("","evidence");gSave();gRender();}
function gApplyDoc(d,name){const doc=d.document||{};const s=gAddSource({kind:"upload",title:doc.title||name,filename:name,type:doc.type||"",date:doc.date||""});let n=0;
  if(doc.currency&&/^(GBP|USD|EUR|INR)$/.test(doc.currency)&&!G.products.some(p=>p.status==="upload"))G.currency=doc.currency;
  (d.products||[]).forEach(p=>{if(!p||!p.name)return;n++;const i=G.products.findIndex(q=>q.name.toLowerCase()===String(p.name).toLowerCase());const o={name:String(p.name).slice(0,60),category:p.category||"",price:gn(p.price),revenue:gn(p.revenue),prevRevenue:gn(p.prev_revenue),cost:gn(p.cost),rating:gn(p.rating),status:"upload",sourceId:s.id,page:p.page||""};if(i>=0)G.products[i]=Object.assign(G.products[i],Object.fromEntries(Object.entries(o).filter(([,v])=>v!==null&&v!=="")));else G.products.push(o);});
  (d.metrics||[]).forEach(m=>{if(m&&m.name&&m.value!==undefined){n++;gAddFinding({area:"company",text:`${m.name}: ${(+m.value).toLocaleString("en-GB")}${m.unit?" "+m.unit:""}${m.period?" ("+m.period+")":""}`,sourceId:s.id,status:"upload",page:m.page||""});}});
  (d.findings||[]).forEach(x=>{if(x&&x.text){n++;gAddFinding({area:x.area||"company",text:x.text,sourceId:s.id,status:"upload",page:x.page||""});}});
  const fb=(d.feedback||[]).filter(x=>x&&x.text).slice(0,150);fb.forEach(x=>G.feedback.items.push({text:String(x.text).slice(0,500),rating:gn(x.rating),product:x.product||"",sourceId:s.id}));
  if(fb.length)G.feedback.analysed=null;s.count=n+fb.length;gToast(`Read ${name}: ${n} facts${fb.length?` and ${fb.length} customer comments`:""}.`);}
function gPaste(){const t=($("g-paste").value||"").trim();if(!t)return;const kind=$("g-paste-kind").value;
  if(kind==="feedback"){const lines=t.split(/\n+/).map(x=>x.trim()).filter(x=>x.length>2).slice(0,400);const s=gAddSource({kind:"paste",title:`Pasted feedback (${new Date().toLocaleDateString("en-GB")})`});lines.forEach(l=>G.feedback.items.push({text:l.slice(0,500),sourceId:s.id}));G.feedback.analysed=null;gToast(`Added ${lines.length} customer comments. Analyse them in step 3.`);}
  else{const s=gAddSource({kind:"user",title:"Your notes"});t.split(/\n+/).filter(x=>x.trim()).slice(0,40).forEach(l=>gAddFinding({area:"company",text:l,sourceId:s.id,status:"user"}));gToast("Notes added.");}
  $("g-paste").value="";gSave();gRender();}

/* ---------- AI analysis steps ---------- */
function gContext(max){const A=gAll(G);const fb=A.FB;
  const ctx={company:G.company,objectives:G.objectives,constraints:G.constraints,currency:G.currency,
    products:A.P.map(p=>({name:p.name,category:p.category,price:p.price,revenue:p.revenue,growth_pct:p.growthPct===null?null:Math.round(p.growthPct),margin_pct:p.margin===null?null:Math.round(p.margin),source:G_SRC[p.status]||""})),
    findings:G.findings.slice(-40).map(f=>`[${G_SRC[f.status]||f.status}] (${f.area}) ${f.text}`),
    customer_feedback:fb?{analysed_comments:fb.n,themes:fb.themes.map(t=>({id:t.id,theme:t.theme,type:t.type,mentions:t.count,pct_of_sample:t.pct===null?null:Math.round(t.pct),segment:t.segment}))}:"none analysed",
    unmet_needs:G.needs.map(n=>({need:n.text,type:n.type,segment:n.segment})),segments:G.segments.map(s=>({name:s.name,needs:s.needs,fit:s.fit})),
    competitors:G.competitors.map(c=>({name:c.name,positioning:c.positioning,moves:c.moves,weaknesses:c.weaknesses})),trends:G.trends.map(t=>({trend:t.trend,impact:t.impact,horizon:t.horizon,source:G_SRC[t.status]})),
    market:{tam:A.M.tam,sam:A.M.sam,som:A.M.som,growth_pct:gn(G.market.growth),definition:G.market.definition||""}};
  let s=JSON.stringify(ctx);return s.length>(max||9000)?s.slice(0,max||9000)+"…":s;}
async function gRunAI(kind,arg){if(GBUSY)return;if(!PROFILE&&typeof needProfile==="function"){needProfile(()=>gRunAI(kind,arg),"use AI");return;}
  if(!AI&&!gOnline()){gToast("AI isn't available in this view.");return;}
  const L={feedback:["Analysing customer feedback…","customers"],needs:["Finding unmet needs…","customers"],segments:["Suggesting customer segments…","customers"],market:["Estimating market size…","market"],opps:["Generating growth opportunities…","opps"],deeper:["Digging deeper…","opps"],fin:["Suggesting starting numbers…","financials"],roadmap:["Building your 90-day plan…","roadmap"],summary:["Writing the growth strategy summary…","roadmap"]}[kind];
  if(!L)return;GBUSY=kind;gWorking(L[0],L[1]);gRender();
  try{
    if(kind==="feedback"){const items=G.feedback.items;if(!items.length)throw{msg:"Add customer feedback first: upload a file with reviews or survey answers, or paste comments in step 2."};
      let lines=[],len=0;for(let i=0;i<items.length;i++){const l=`${i}|${items[i].text.replace(/\s+/g," ").slice(0,180)}`;if(len+l.length>9500)break;lines.push(l);len+=l.length+1;}
      const d=await gAI(`Classify customer feedback for ${G.company.name||"a business"}. Each line is "index|comment".\n${lines.join("\n")}\n\nGroup similar comments into up to 10 themes. Return JSON: {"themes":[{"id":"t1","theme":"short name","type":"pain|praise|request","segment":"who seems affected, or empty","product":"which product, or empty","opportunity":"one sentence on the business opportunity, for pains and requests"}],"items":[{"i":0,"s":"pos|neg|neu|mix","t":["t1"]}]}\nInclude every index exactly once in items.`);
      const n=lines.length,sent={positive:0,negative:0,neutral:0,mixed:0},cnt={},quotes={};const map={pos:"positive",neg:"negative",neu:"neutral",mix:"mixed"};const seen=new Set();
      (d.items||[]).forEach(x=>{const i=+x.i;if(!isFinite(i)||i<0||i>=n||seen.has(i))return;seen.add(i);sent[map[x.s]||"neutral"]++;(x.t||[]).forEach(t=>{cnt[t]=(cnt[t]||0)+1;(quotes[t]=quotes[t]||[]).length<2&&quotes[t].push(items[i].text.slice(0,200));});});
      const an=seen.size;G.feedback.analysed={n:an,of:items.length,sentiment:sent,themes:(d.themes||[]).filter(t=>t&&t.id).map(t=>({id:t.id,theme:t.theme,type:t.type,segment:t.segment||"",product:t.product||"",opportunity:t.opportunity||"",count:cnt[t.id]||0,quotes:quotes[t.id]||[]})),at:Date.now()};}
    if(kind==="needs"){const d=await gAI(`Identify unmet customer needs for a growth strategy. Use ONLY this evidence:\n${gContext()}\nReturn JSON: {"needs":[{"text":"the need","evidence":"what in the evidence supports it","segment":"","type":"observed|emerging|hypothesis","theme_id":"id of the matching feedback theme, or empty","existing_solutions":"","why_inadequate":"","opportunity":""}]}\n"observed" only when backed by analysed customer feedback (give its theme_id); "emerging" when suggested by trends; otherwise "hypothesis". Up to 7 needs.`);
      const ids=new Set(((G.feedback.analysed||{}).themes||[]).map(t=>t.id));
      G.needs=(d.needs||[]).filter(x=>x&&x.text).slice(0,8).map(x=>({text:x.text,evidence:x.evidence||"",segment:x.segment||"",type:x.type==="observed"&&!ids.has(x.theme_id)?"hypothesis":["observed","emerging","hypothesis"].includes(x.type)?x.type:"hypothesis",themeId:ids.has(x.theme_id)?x.theme_id:"",existing:x.existing_solutions||"",gap:x.why_inadequate||"",opportunity:x.opportunity||"",status:"ai"}));}
    if(kind==="segments"){const d=await gAI(`Suggest customer segments worth targeting for this company's growth. Evidence:\n${gContext()}\nReturn JSON: {"segments":[{"name":"","description":"","estimated_size":"rough, with basis","growth":"high|medium|low","needs":["up to 3"],"product_fit":"high|medium|low","spending_potential":"","acquisition_difficulty":"high|medium|low","competitive_intensity":"high|medium|low","strategic_relevance":"one sentence"}]}\nUp to 5. These are hypotheses: don't present sizes as facts.`);
      G.segments=(d.segments||[]).filter(x=>x&&x.name).slice(0,6).map(x=>({name:x.name,desc:x.description||"",size:x.estimated_size||"",growth:x.growth||"",needs:x.needs||[],fit:x.product_fit||"",spend:x.spending_potential||"",difficulty:x.acquisition_difficulty||"",competition:x.competitive_intensity||"",relevance:x.strategic_relevance||"",status:"ai"}));}
    if(kind==="market"){const name=G.company.name;const r=await gResearchCall(`Estimate the market size for this company's main market. ${gTargetLine()}\nReturn JSON: {"market_size":{"definition":"","tam":number or null,"currency":"","sam_pct":number or null,"share_pct":number or null,"growth_pct":number or null,"potential_customers":number or null,"avg_spend":number or null,"basis":"how you reached each figure and which are estimates","source_url":""}}\nIf published estimates use different market definitions, don't combine them; explain.`,[`${G.company.industry||name} market size ${G.company.country||""}`,`${G.company.industry||name} market growth rate`]);
      const ms=(r.data||{}).market_size;gApplyMarket(ms,r.live?gLiveStatus(ms&&ms.source_url,r.sources||[]):"ai");(r.sources||[]).forEach(s=>gAddSource({kind:"live",title:s.title||s.url,url:s.url}));}
    if(kind==="opps"){const d=await gAI(`You are a growth strategy consultant. Generate specific, evidence-backed growth opportunities for this company. Logic: company capabilities + customer needs + market trends + competitive gaps = opportunities. Never generic advice like "improve marketing".\nEVIDENCE:\n${gContext(9500)}\nReturn JSON: {"opportunities":[{"title":"","category":"product|segment|geo|channel|retention","description":"","customer_problem":"","evidence":["quote the specific evidence items used"],"target_customer":"","market_potential":"","revenue_opportunity":"rough, with basis","rationale":"","assumptions":[""],"risks":[""],"requirements":"","next_step":"","scores":{"size":1-10,"growth":1-10,"fit":1-10,"feas":1-10,"comp":1-10,"fin":1-10},"score_reasons":{"size":"","growth":"","fit":"","feas":"","comp":"higher = more favourable competition","fin":""},"confidence":"high|medium|low|insufficient","time_to_launch_months":number,"investment":number,"fin":{"audience":number (people or businesses reachable in year 1),"conv_pct":number,"revenue_per_customer":number (per year),"variable_cost_pct":number,"acquisition_spend":number (per year),"extra_fixed_costs":number (per year),"setup_investment":number}}]}\n6 to 8 opportunities across at least 4 categories, money in ${G.currency}. Respect the constraints (budget, timeline, risk). Confidence reflects how strong the evidence is.`);
      const keep=G.opps.filter(o=>o.status==="accepted"||o.src==="user");const fresh=(d.opportunities||[]).filter(x=>x&&x.title).slice(0,9).map(x=>gOppFrom(x,"ai"));G.opps=keep.concat(fresh.filter(f=>!keep.some(k=>k.title===f.title)));if(!G.finSel&&G.opps[0])G.finSel=G.opps[0].id;}
    if(kind==="deeper"){const o=G.opps.find(x=>x.id===arg);if(!o)throw{msg:"Opportunity not found."};const d=await gAI(`Look harder at this growth opportunity for ${G.company.name}: ${JSON.stringify({title:o.title,description:o.desc,evidence:o.evidence,assumptions:o.assumptions})}\nContext:\n${gContext(6000)}\nReturn JSON: {"evidence_for":[""],"evidence_against":[""],"validation_questions":["what to test before investing"],"verdict":"one honest sentence"}`);o.deep={for:d.evidence_for||[],against:d.evidence_against||[],questions:d.validation_questions||[],verdict:d.verdict||""};}
    if(kind==="fin"){const o=G.opps.find(x=>x.id===G.finSel);if(!o)throw{msg:"Pick an opportunity first."};const d=await gAI(`Suggest realistic, conservative first-year assumptions to model this growth opportunity for ${G.company.name} (money in ${G.currency}): ${JSON.stringify({title:o.title,description:o.desc,target:o.target,market:o.potential})}\nContext:\n${gContext(5000)}\nReturn JSON: {"audience":number,"conv_pct":number,"revenue_per_customer":number,"variable_cost_pct":number,"acquisition_spend":number,"extra_fixed_costs":number,"setup_investment":number,"launch_months":number,"basis":"one or two sentences"}`);
      o.fin=gFinFrom(d);o.finSrc="ai";o.finBasis=d.basis||"";}
    if(kind==="roadmap"){const pick=gRoadOpps();if(!pick.length)throw{msg:"Generate and score some opportunities first (steps 5 and 6)."};
      const d=await gAI(`Build a practical 90-day execution plan for ${G.company.name} for these prioritised growth opportunities: ${JSON.stringify(pick.map(o=>({title:o.title,description:o.desc,next_step:o.next,risks:o.risks,requirements:o.reqs})))}\nConstraints: ${JSON.stringify(G.constraints)}\nReturn JSON: {"activities":[{"phase":1|2|3,"initiative":"what happens, in 3 to 6 plain words","owner":"a short role, e.g. Marketing lead","start_day":1-90,"end_day":1-90,"metric":"how you'll know it worked, under 8 words","opportunity":"title"}],"kpis":[{"opportunity":"title","name":"","baseline":"","target":""}]}\nPhase 1 days 1-30 validate, phase 2 days 31-60 build and prepare, phase 3 days 61-90 launch and measure. Keep it simple: 6 to 9 activities in total, 2 or 3 per phase, no long sentences. Up to 4 KPIs.`);
      G.roadmap=(d.activities||[]).filter(a=>a&&a.initiative).slice(0,10).map(a=>({id:gId(),phase:[1,2,3].includes(+a.phase)?+a.phase:1,initiative:a.initiative,desc:a.description||"",priority:a.priority||"medium",owner:a.owner||"",startDay:Math.min(90,Math.max(1,+a.start_day||1)),endDay:Math.min(90,Math.max(1,+a.end_day||30)),deps:a.dependencies||"",resources:a.resources||"",cost:gn(a.cost),metric:a.metric||"",outcome:a.outcome||"",opp:a.opportunity||""}));
      G.kpis=(d.kpis||[]).filter(k=>k&&k.name).slice(0,6).map(k=>({id:gId(),opp:k.opportunity||"",name:k.name,baseline:k.baseline||"",target:k.target||"",actual:""}));if(!G.start)G.start=new Date().toISOString().slice(0,10);}
    if(kind==="summary"){const A=gAll(G);if(!A.R.length)throw{msg:"Generate and score some opportunities first (steps 5 and 6)."};
      const facts={ranking:A.R.map(r=>({rank:r.rank,title:r.o.title,category:r.o.cat,score_out_of_10:r.score===null?null:+r.score.toFixed(1),classification:r.cls.label,evidence_confidence:r.conf,quadrant:r.quad&&r.quad.label,status:r.o.status})),
        financials:A.fin.map(x=>({title:x.r.o.title,revenue:Math.round(x.fin.revenue),operating_profit_contribution:Math.round(x.fin.opProfit),investment:x.fin.investment,payback_months:x.fin.payback===null?null:Math.round(x.fin.payback)})),
        rejected:G.opps.filter(o=>o.status==="rejected").map(o=>o.title)};
      const d=await gAI(`Write a growth strategy recommendation for ${G.company.name}. The scoring engine has already ranked the opportunities; explain its ranking, don't override it. Use only numbers from the FACTS and quote them.\nFACTS (engine output): ${JSON.stringify(facts)}\nEVIDENCE: ${gContext(6000)}\nReturn JSON: {"headline":"Recommended growth strategy in under 12 words","where":"where the company should grow","why":"why these opportunities are attractive, linking customer needs, trends, capabilities","biggest_opportunity":"","biggest_risk":"","avoid":"what to avoid and why (weak evidence, poor fit or poor economics)","priorities":["the top 3 initiatives, in the engine's order"],"next_steps":["4-6 concrete next steps"]}\nPlain UK English, short sentences, currency ${G.currency}.`);
      G.summary=Object.assign({},d,{at:Date.now()});}
    gToast("Done. Everything the AI wrote is labelled so you can check it.");if(window.bbcTrack)bbcTrack("growth_ai",kind);
  }catch(e){gToast(e&&e.msg?e.msg:gErr(e,"finish that"));}
  GBUSY=null;gWorking("",L[1]);gSave();gRender();}
function gFinFrom(f){f=f||{};return{audience:gn(f.audience),conv:gn(f.conv_pct),arpc:gn(f.revenue_per_customer),varPct:gn(f.variable_cost_pct),acq:gn(f.acquisition_spend),fixed:gn(f.extra_fixed_costs),setup:gn(f.setup_investment),launch:gn(f.launch_months)};}
function gOppFrom(x,src){const cats=G_CATS.map(c=>c[0]);const sc={};G_DIMS.forEach(([k])=>{const v=gn(x.scores&&x.scores[k]);sc[k]=v===null?null:Math.min(10,Math.max(1,Math.round(v)));});
  return{id:gId(),title:String(x.title).slice(0,120),cat:cats.includes(x.category)?x.category:"product",desc:x.description||"",problem:x.customer_problem||"",evidence:Array.isArray(x.evidence)?x.evidence:x.evidence?[x.evidence]:[],target:x.target_customer||"",potential:x.market_potential||"",revenue:x.revenue_opportunity||"",rationale:x.rationale||"",assumptions:x.assumptions||[],risks:x.risks||[],reqs:x.requirements||"",next:x.next_step||"",
    scores:sc,reasons:x.score_reasons||{},confidence:["high","medium","low","insufficient"].includes(x.confidence)?x.confidence:"medium",time:gn(x.time_to_launch_months),investment:gn(x.investment),fin:gFinFrom(Object.assign({},x.fin,{launch_months:x.time_to_launch_months})),finSrc:src,status:"open",notes:"",src};}
function gRoadOpps(){const A=gAll(G);const acc=A.R.filter(r=>r.o.status==="accepted").map(r=>r.o);return(acc.length?acc:A.R.slice(0,3).map(r=>r.o)).slice(0,4);}

/* ---------- navigation ---------- */
function gProg(){const cur=gIdx(GTAB),far=Math.max(G.furthest||0,cur);
  $("gprog").innerHTML=GSTEPS.map(([k,l],i)=>`<button type="button" class="ost${i===cur?" cur":""}${i<cur?" done":""}" data-gstep="${k}" ${i>far?"disabled":""} ${i===cur?'aria-current="step"':""}><span class="n">${i<cur?"✓":i+1}</span><span class="l">${l}</span></button>`).join("");}
function gGo(t,noScroll){if(gIdx(t)<0)return;GTAB=t;G.step=t;G.furthest=Math.max(G.furthest||0,gIdx(t));GSTEPS.forEach(([k])=>{$("gp-"+k).hidden=k!==t;});gSave();
  if(t==="company")gBuildCompany();
  if(!noScroll&&!$("growth").hidden)setTimeout(()=>{const a=$("gapp");if(a&&a.getBoundingClientRect().top<0)a.scrollIntoView({behavior:"smooth",block:"start"});},0);setTimeout(gRender,0);}
function gNext(d){const i=gIdx(GTAB)+d;if(i<0||i>=GSTEPS.length)return;if(GTAB==="company"&&d>0&&!(G.company.name||"").trim()){const n=$("g-name");if(n){n.focus();n.classList.add("flash");}return;}gGo(GSTEPS[i][0]);}

/* ---------- step 1: company ---------- */
function gField(path,label,help,o){o=o||{};const id=o.id||"g-"+path.replace(/\./g,"-");const v=gGet(path);
  if(o.select)return`<div class="field text"><label for="${id}">${label}${help?`<small>${help}</small>`:""}</label><select id="${id}" data-gk="${path}">${o.select.map(x=>`<option${x===v?" selected":""}>${esc(x)}</option>`).join("")}</select></div>`;
  return`<div class="field text"><label for="${id}">${label}${help?`<small>${help}</small>`:""}</label><input id="${id}" type="text" ${o.num?'inputmode="decimal" data-num="1"':""} data-gk="${path}" value="${esc(v===undefined||v===null?"":v)}" placeholder="${esc(o.ph||"")}" autocomplete="off"></div>`;}
function gBuildCompany(){$("g-company-main").innerHTML=gField("company.name","Company name","The business you want to grow",{id:"g-name",ph:"e.g. Pret A Manger"})+gField("company.industry","Industry","Optional",{ph:"e.g. Food and drink"});
  $("g-company-more").innerHTML=gField("company.website","Website","",{ph:"e.g. pret.co.uk"})+gField("company.hq","Headquarters","")+gField("company.country","Country of operation","",{ph:"e.g. United Kingdom"})+gField("company.founded","Year founded","",{num:true})+
    gField("company.size","Business size","",{select:["","Startup","Small business","Mid-sized company","Large company"]})+gField("company.employees","Number of employees","If known",{num:true})+gField("company.model","Business model","e.g. sells through supermarkets and online")+gField("company.products","Main products and services","")+gField("company.presence","Where it sells today","")+
    `<div class="field text"><label for="g-cur">Currency</label><select id="g-cur" data-gk="currency">${["GBP","USD","EUR","INR"].map(c=>`<option${c===G.currency?" selected":""}>${c}</option>`).join("")}</select></div>`;
  $("g-constraints").innerHTML=gField("constraints.investment","Money available for growth","e.g. 50000",{num:true})+gField("constraints.resources","People and resources available","")+gField("constraints.timeline","Timeline","",{select:["","Within 3 months","Within 6 months","Within a year","1 to 3 years"]})+gField("constraints.risk","Appetite for risk","",{select:["","Low","Medium","High"]})+
    gField("constraints.geo","Geographic limits","e.g. UK only for now")+gField("constraints.tech","Technology limits","")+gField("constraints.ops","Operational limits","e.g. no extra factory space");
  $("g-objectives").innerHTML=G_OBJECTIVES.map(o=>`<button type="button" class="mchip" data-gobj="${esc(o)}" aria-pressed="${G.objectives.includes(o)}">${esc(o)}</button>`).join("");}

/* ---------- step 2: evidence ---------- */
function gRenderEvidence(){const el=$("g-evidence");const areas=[["company","The company"],["product","Products"],["customer","Customers"],["competitor","Competitors"],["trend","Trends"],["market","Market"]];
  const srcName=id=>{const s=G.sources.find(x=>x.id===id);return s?s.filename||s.title:"";};
  const fbN=G.feedback.items.length;
  if(!G.findings.length&&!fbN&&!G.products.length){el.innerHTML=`<div class="otip">Nothing collected yet. Start with <b>Research the company</b>, or add your own data.</div>`;return;}
  el.innerHTML=`<div class="card big"><div class="row"><h3>What we know so far</h3><span class="spacer"></span><span class="small muted">${G.findings.length} findings · ${G.products.length} products · ${fbN} customer comments</span></div>
    ${areas.map(([k,l])=>{const fs=G.findings.filter(f=>f.area===k);return fs.length?`<h4 style="margin:12px 0 4px">${l}</h4><ul class="gfind">${fs.map(f=>`<li><span>${esc(f.text)}</span><span class="gfmeta">${gChip(f.status,f.page?"p. "+f.page:"")}${f.url?` <a href="${esc(f.url)}" target="_blank" rel="noopener">source</a>`:srcName(f.sourceId)&&f.status==="upload"?` <span class="small muted">${esc(srcName(f.sourceId))}</span>`:""} <button class="linkbtn" type="button" data-gfdel="${f.id}" aria-label="Remove">Remove</button></span></li>`).join("")}</ul>`:"";}).join("")}
    ${fbN?`<p class="small" style="margin-top:12px"><b>${fbN} customer comments</b> collected. Analyse them in the next step.</p>`:""}
    <details style="margin-top:10px"><summary class="small">Sources (${G.sources.length})</summary><ul class="small" style="margin-top:6px">${G.sources.map(s=>`<li>${esc(s.filename||s.title)} ${gChip(s.kind==="paste"?"paste":s.kind)}${s.url?` <a href="${esc(s.url)}" target="_blank" rel="noopener">open</a>`:""}${s.date?` · ${esc(s.date)}`:""}</li>`).join("")}</ul></details></div>`;}

/* ---------- step 3: customers ---------- */
function gRenderCustomers(){const A=G_A;
  $("g-products").innerHTML=G.products.length?`<div class="otable"><table class="gtbl"><thead><tr><th>Product</th><th>Price</th><th>Revenue now</th><th>Revenue before</th><th>Cost</th><th>Share</th><th>Growth</th><th>Margin</th><th></th></tr></thead><tbody>${A.P.map((p,i)=>`<tr>
    <td><input data-gp="${i}.name" value="${esc(p.name)}" aria-label="Product name"><div>${gChip(p.status||"user")}</div></td>${["price","revenue","prevRevenue","cost"].map(k=>`<td><input inputmode="decimal" data-gp="${i}.${k}" value="${p[k]===null||p[k]===undefined?"":p[k]}" aria-label="${k}"></td>`).join("")}
    <td>${gpct(p.share,0)}</td><td>${gpct(p.growthPct,0)}</td><td>${p.margin===null?'<span class="small muted">needs cost</span>':gpct(p.margin,0)}</td><td><button class="linkbtn" type="button" data-gpdel="${i}">Remove</button></td></tr>`).join("")}</tbody></table></div>
    <p class="small muted">Share = product revenue ÷ total revenue. Growth = (now − before) ÷ before. Margin = (revenue − cost) ÷ revenue, only when you know the cost.</p>`:`<p class="small muted">No products yet. Research the company, upload a sales report or add one yourself.</p>`;
  const an=A.FB,items=G.feedback.items.length;
  $("g-feedback").innerHTML=!items?`<p class="small muted">No customer comments yet. Upload reviews, survey answers or complaints, or paste them in step 2. Customer themes from AI research are listed in the evidence, but they can't be counted.</p>`:
    !an?`<p class="small">${items} comments collected. Click <b>Analyse feedback</b> to group them into themes.</p>`:
    `<p class="small muted">Based on ${an.n} analysed comment${an.n===1?"":"s"}${G.feedback.analysed.of>an.n?` (of ${G.feedback.analysed.of} collected; the rest didn't fit in one analysis)`:""}. Percentages are of this sample only, not all customers.</p>
    <div class="gsent">${[["positive","Positive","var(--go)"],["mixed","Mixed","var(--amber)"],["neutral","Neutral","var(--line)"],["negative","Negative","var(--stop)"]].map(([k,l,c])=>an.sentiment[k]?`<i style="width:${an.sentiment[k]}%;background:${c}" title="${l} ${gpct(an.sentiment[k],0)}"></i>`:"").join("")}</div>
    <div class="row small" style="gap:14px;margin:6px 0 12px">${[["positive","Positive"],["mixed","Mixed"],["neutral","Neutral"],["negative","Negative"]].map(([k,l])=>`<span>${l} <b>${gpct(an.sentiment[k],0)}</b></span>`).join("")}</div>
    ${an.themes.map(t=>`<div class="gtheme"><div class="row"><b>${esc(t.theme)}</b><span class="chip ${t.type==="praise"?"go":t.type==="pain"?"stop":"in"}">${t.type==="praise"?"Praise":t.type==="pain"?"Pain point":"Request"}</span><span class="spacer"></span><span class="small"><b>${t.count}</b> mention${t.count===1?"":"s"} · ${gpct(t.pct,0)}</span></div>
      <div class="gbar"><i style="width:${Math.min(100,t.pct||0)}%"></i></div>${t.quotes.map(q=>`<p class="small muted gq">“${esc(q)}”</p>`).join("")}${t.opportunity?`<p class="small"><b>Opportunity:</b> ${esc(t.opportunity)}</p>`:""}${t.segment?`<p class="small muted">Affects: ${esc(t.segment)}</p>`:""}</div>`).join("")}`;
  $("g-fb-btn").disabled=!items;
  const tlabel={observed:["Observed need","go"],emerging:["Emerging need","in"],hypothesis:["AI hypothesis","ai"]};
  $("g-needs").innerHTML=G.needs.length?G.needs.map(n=>{const th=an&&n.themeId?an.themes.find(t=>t.id===n.themeId):null;const L=tlabel[n.type]||tlabel.hypothesis;
    return`<div class="gtheme"><div class="row"><b>${esc(n.text)}</b><span class="chip ${L[1]}">${L[0]}</span>${th?`<span class="small">${gpct(th.pct,0)} of analysed feedback</span>`:""}</div>${n.evidence?`<p class="small"><b>Evidence:</b> ${esc(n.evidence)}</p>`:""}${n.gap?`<p class="small"><b>Why current options fall short:</b> ${esc(n.gap)}</p>`:""}${n.opportunity?`<p class="small"><b>Opportunity:</b> ${esc(n.opportunity)}</p>`:""}${n.segment?`<p class="small muted">Who: ${esc(n.segment)}</p>`:""}</div>`;}).join(""):`<p class="small muted">Find needs customers have that nobody meets well. Works best after analysing feedback and researching the market.</p>`;
  $("g-segments").innerHTML=G.segments.length?`<p class="small muted">Segments are hypotheses to test. Sizes are rough AI estimates, not market facts.</p><div class="ggrid">${G.segments.map(s=>`<div class="gseg"><b>${esc(s.name)}</b><span class="chip ai">AI hypothesis</span><p class="small">${esc(s.desc)}</p><p class="small"><b>Needs:</b> ${esc((s.needs||[]).join(", "))}</p><p class="small muted">Size: ${esc(s.size||"—")} · Growth: ${esc(s.growth||"—")} · Fit: ${esc(s.fit||"—")} · Hard to win: ${esc(s.difficulty||"—")} · Competition: ${esc(s.competition||"—")}</p>${s.relevance?`<p class="small">${esc(s.relevance)}</p>`:""}</div>`).join("")}</div>`:`<p class="small muted">Find groups of customers worth targeting next.</p>`;}

/* ---------- step 4: market ---------- */
function gRenderMarket(){
  $("g-competitors").innerHTML=G.competitors.length?`<div class="ggrid">${G.competitors.map((c,i)=>`<div class="gseg"><div class="row"><input data-gc="${i}.name" value="${esc(c.name)}" aria-label="Competitor name" style="font-weight:700"><button class="linkbtn" type="button" data-gcdel="${i}">Remove</button></div><div>${gChip(c.status||"user")}${c.url?` <a class="small" href="${esc(c.url)}" target="_blank" rel="noopener">source</a>`:""}</div>
    ${[["positioning","Positioning"],["products","Products"],["pricing","Pricing"],["moves","Recent moves"],["strengths","Strengths"],["weaknesses","Weaknesses"]].map(([k,l])=>`<label class="small muted" style="display:block;margin-top:6px">${l}<textarea rows="2" data-gc="${i}.${k}">${esc(c[k]||"")}</textarea></label>`).join("")}</div>`).join("")}</div>`:`<p class="small muted">Research competitors and the market in step 2, or add them yourself.</p>`;
  $("g-trends").innerHTML=G.trends.length?G.trends.map((t,i)=>`<div class="gtheme"><div class="row"><b>${esc(t.trend)}</b>${gChip(t.status||"ai")}${t.impact?`<span class="chip ${t.impact==="high"?"go":"in"}">${esc(t.impact)} impact</span>`:""}<span class="small muted">${esc(t.horizon||"")}${t.geo?" · "+esc(t.geo):""}</span><span class="spacer"></span><button class="linkbtn" type="button" data-gtdel="${i}">Remove</button></div>${t.evidence?`<p class="small">${esc(t.evidence)}</p>`:""}${t.opportunity?`<p class="small"><b>For this company:</b> ${esc(t.opportunity)}</p>`:""}<p class="small muted">${t.date?esc(t.date)+" · ":""}${t.conf?"Confidence: "+esc(t.conf):""}${t.url?` · <a href="${esc(t.url)}" target="_blank" rel="noopener">source</a>`:""}</p></div>`).join(""):`<p class="small muted">Trends appear after researching competitors and the market.</p>`;
  const m=G.market,src=m.src||{};const lab=k=>src[k]?gChip(src[k]):"";
  const inp=(k,l,h)=>`<div class="field text"><label for="g-m-${k}">${l} ${lab(k)}${h?`<small>${h}</small>`:""}</label><input id="g-m-${k}" inputmode="decimal" data-gm="${k}" value="${m[k]===undefined||m[k]===null?"":m[k]}"></div>`;
  if(document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.gm){}else $("g-market-in").innerHTML=inp("tam","TAM",`Total market per year, ${G.currency}. Leave blank to use customers × spend`)+inp("pcust","Potential customers","For a bottom-up estimate")+inp("spend","Average annual spend per customer","")+inp("sam","SAM","Or leave blank and use the % below")+inp("samPct","Share of TAM it can serve","%")+inp("share","Share of SAM it could win","%, sets SOM")+inp("growth","Market growth per year","%");
  const M=G_A.M;const r=v=>v&&M.tam?Math.max(14,Math.sqrt(v/M.tam)*110):0;
  $("g-market-out").innerHTML=M.tam?`<svg viewBox="0 0 240 240" width="100%" style="max-width:260px" role="img" aria-label="TAM, SAM and SOM circles"><circle cx="120" cy="120" r="${r(M.tam)}" fill="var(--sunk)" stroke="var(--line)"/>${M.sam?`<circle cx="120" cy="${120+r(M.tam)-r(M.sam)}" r="${r(M.sam)}" fill="var(--surface)" stroke="var(--ink)"/>`:""}${M.som?`<circle cx="120" cy="${120+r(M.tam)-r(M.som)}" r="${r(M.som)}" fill="var(--ink)"/>`:""}</svg>
    <div class="gkv"><span>TAM</span><b>${gm(M.tam)}</b><span class="small muted">${M.tamSrc==="calc"?"Calculated: customers × spend":G_SRC[M.tamSrc]||""}</span></div>
    <div class="gkv"><span>SAM</span><b>${gm(M.sam)}</b><span class="small muted">${M.samSrc==="calc"?"Calculated: TAM × share served":G_SRC[M.samSrc]||""}</span></div>
    <div class="gkv"><span>SOM</span><b>${gm(M.som)}</b><span class="small muted">${M.som!==null?`Calculated: SAM × share won · ${gpct(M.somPctSam)} of SAM, ${gpct(M.somPctTam,2)} of TAM`:"Add the share it could win"}</span></div>
    ${m.definition?`<p class="small"><b>Market:</b> ${esc(m.definition)}</p>`:""}${m.basis?`<p class="small muted">${esc(m.basis)}${m.url?` · <a href="${esc(m.url)}" target="_blank" rel="noopener">source</a>`:""}</p>`:""}<p class="small muted">Estimates to help you think, not precise facts.</p>`:`<p class="small muted">Add a TAM, or potential customers and their annual spend, to size the market.</p>`;}

/* ---------- step 5: opportunities ---------- */
function gOppCard(o,r){const cat=(G_CATS.find(c=>c[0]===o.cat)||["","Other"])[1];const cls=r?r.cls:gClass(null);
  return`<article class="card big gopp${o.status==="rejected"?" rej":""}" id="go-${o.id}"><div class="row" style="align-items:flex-start"><div style="flex:1;min-width:0"><div class="row" style="gap:6px"><span class="chip in">${esc(cat)}</span>${o.src==="user"?gChip("user"):gChip(o.src==="example"?"example":"ai")}${r&&r.score!==null?`<span class="chip ${cls.key==="high"?"go":cls.key==="low"?"stop":"new"}">${esc(cls.label)} · ${r.score.toFixed(1)}/10</span>`:""}${o.status==="accepted"?'<span class="chip go">Accepted</span>':o.status==="rejected"?'<span class="chip stop">Rejected</span>':""}</div>
    <h3 style="margin:8px 0 4px"><input data-go="${o.id}.title" value="${esc(o.title)}" aria-label="Opportunity title" class="gtitle"></h3><p class="small" style="margin:0">${esc(o.desc)}</p></div></div>
    <details><summary class="small">Evidence, assumptions and risks</summary><div class="gdl">
      ${[["Customer problem",o.problem],["Target customer",o.target],["Market potential",o.potential],["Revenue opportunity",o.revenue],["Why it fits",o.rationale],["What it needs",o.reqs],["Next step",o.next]].filter(x=>x[1]).map(([l,v])=>`<p class="small"><b>${l}:</b> ${esc(v)}</p>`).join("")}
      ${o.evidence.length?`<p class="small"><b>Evidence:</b></p><ul class="small">${o.evidence.map(e=>`<li>${esc(e)}</li>`).join("")}</ul>`:""}
      ${o.assumptions.length?`<p class="small"><b>Key assumptions:</b></p><ul class="small">${o.assumptions.map(e=>`<li>${esc(e)}</li>`).join("")}</ul>`:""}
      ${o.risks.length?`<p class="small"><b>Risks:</b></p><ul class="small">${o.risks.map(e=>`<li>${esc(e)}</li>`).join("")}</ul>`:""}
      <p class="small muted">Evidence confidence: ${esc(o.confidence)}${o.time?` · About ${o.time} months to launch`:""}${o.investment?` · Investment around ${gm(o.investment)}`:""}</p>
      ${o.deep?`<div class="otip"><b>Deeper look</b>${o.deep.verdict?`<p class="small">${esc(o.deep.verdict)}</p>`:""}${o.deep.for.length?`<p class="small"><b>For:</b> ${o.deep.for.map(esc).join(" · ")}</p>`:""}${o.deep.against.length?`<p class="small"><b>Against:</b> ${o.deep.against.map(esc).join(" · ")}</p>`:""}${o.deep.questions.length?`<p class="small"><b>Test first:</b> ${o.deep.questions.map(esc).join(" · ")}</p>`:""}</div>`:""}
    </div></details>
    <label class="small muted" style="display:block">Notes<textarea rows="2" data-go="${o.id}.notes" placeholder="Your thoughts">${esc(o.notes||"")}</textarea></label>
    <div class="row"><button class="pill sm${o.status==="accepted"?"":" ghost"}" type="button" data-gacc="${o.id}">${o.status==="accepted"?"✓ Accepted":"Accept"}</button><button class="pill sm ghost" type="button" data-grej="${o.id}">${o.status==="rejected"?"Restore":"Reject"}</button><button class="pill sm ghost" type="button" data-gdeep="${o.id}">Dig deeper with AI</button>${o.src==="user"?`<button class="linkbtn" type="button" data-godel="${o.id}">Delete</button>`:""}</div></article>`;}
function gRenderOpps(){const f=$("g-opp-filter").value;const rk={};G_A.R.forEach(r=>rk[r.o.id]=r);
  if($("g-opp-filter").options.length<2)$("g-opp-filter").innerHTML=`<option value="">All categories</option>`+G_CATS.map(([k,l])=>`<option value="${k}">${l}</option>`).join("");
  const list=G.opps.filter(o=>!f||o.cat===f).sort((a,b)=>(rk[a.id]?rk[a.id].rank:99)-(rk[b.id]?rk[b.id].rank:99));
  $("g-opps-note").textContent=G.opps.length?`${G.opps.length} opportunities · ${G.opps.filter(o=>o.status==="accepted").length} accepted · ${G.opps.filter(o=>o.status==="rejected").length} rejected. Generating again keeps accepted ideas and your own.`:"Works best after gathering evidence. The more you've collected, the more specific the ideas.";
  $("g-opps").innerHTML=list.map(o=>gOppCard(o,rk[o.id])).join("")||(G.opps.length?`<p class="small muted">No opportunities in this category.</p>`:"");}

/* ---------- step 6: prioritise ---------- */
function gRenderPrioritise(){const A=G_A;const sort=$("g-sort").value;let R=A.R.slice();
  const finOf=r=>{const f=gFin(r.o.fin);return f?f.opProfit:-1e18;};const conf={high:3,medium:2,low:1,insufficient:0};
  if(sort==="fin")R.sort((a,b)=>finOf(b)-finOf(a));if(sort==="fit")R.sort((a,b)=>(b.o.scores.fit||0)-(a.o.scores.fit||0));if(sort==="feas")R.sort((a,b)=>(b.o.scores.feas||0)-(a.o.scores.feas||0));if(sort==="time")R.sort((a,b)=>(a.o.time||99)-(b.o.time||99));if(sort==="conf")R.sort((a,b)=>conf[b.conf]-conf[a.conf]);
  $("g-rank").innerHTML=R.length?R.map(r=>`<details class="grank"><summary><span class="grn">${r.rank}</span><span class="grt">${esc(r.o.title)}</span><span class="grs">${r.score===null?"—":r.score.toFixed(1)}</span></summary>
    <div class="row" style="gap:6px;margin:6px 0"><span class="chip ${r.cls.key==="high"?"go":r.cls.key==="low"?"stop":"new"}">${esc(r.cls.label)}</span><span class="chip in">Evidence: ${esc(r.conf)}</span>${r.quad?`<span class="chip in">${esc(r.quad.label)}</span>`:""}</div>
    ${r.adjusted!==null&&r.adjusted<r.score?`<p class="small muted">Ranked as ${r.adjusted.toFixed(1)} because the evidence is ${esc(r.conf)}.</p>`:""}
    <div class="gscores">${G_DIMS.map(([k,l])=>`<label class="small"><span>${l}</span><input inputmode="numeric" data-gs="${r.o.id}.${k}" value="${r.o.scores[k]===null||r.o.scores[k]===undefined?"":r.o.scores[k]}" aria-label="${l} score out of 10"><small class="muted">${esc((r.o.reasons||{})[k]||"")}</small></label>`).join("")}</div>
    <p class="small muted">Score = sum of each score × its weight. Scores are judgements, not measurements: change any of them.</p></details>`).join(""):`<p class="small muted">Generate opportunities in step 5 first.</p>`;
  const S=300,P=34,sx=v=>P+(v-1)/9*(S-2*P),sy=v=>S-P-(v-1)/9*(S-2*P);
  const dots=A.R.filter(r=>r.axes.attract!==null&&r.axes.feas!==null);
  $("g-matrix").innerHTML=`<svg viewBox="0 0 ${S} ${S}" width="100%" style="max-width:420px;display:block" role="img" aria-label="Attractiveness versus feasibility matrix">
    <rect x="${P}" y="${P}" width="${S-2*P}" height="${S-2*P}" fill="var(--surface)" stroke="var(--line)"/><line x1="${sx(5.5)}" y1="${P}" x2="${sx(5.5)}" y2="${S-P}" stroke="var(--line)" stroke-dasharray="4 4"/><line x1="${P}" y1="${sy(5.5)}" x2="${S-P}" y2="${sy(5.5)}" stroke="var(--line)" stroke-dasharray="4 4"/>
    <text x="${S-P-4}" y="${P+14}" text-anchor="end" font-size="10" fill="var(--go)" font-weight="700">Quick wins</text><text x="${P+4}" y="${P+14}" font-size="10" fill="var(--muted)" font-weight="700">Strategic bets</text><text x="${S-P-4}" y="${S-P-6}" text-anchor="end" font-size="10" fill="var(--muted)">Incremental</text><text x="${P+4}" y="${S-P-6}" font-size="10" fill="var(--muted)">Low priority</text>
    <text x="${S/2}" y="${S-8}" text-anchor="middle" font-size="10" fill="var(--muted)">Feasibility →</text><text x="12" y="${S/2}" text-anchor="middle" font-size="10" fill="var(--muted)" transform="rotate(-90 12 ${S/2})">Commercial attractiveness →</text>
    ${dots.map(r=>`<g class="gdot" data-gdot="${r.o.id}" tabindex="0" role="button" aria-label="${esc(r.o.title)}"><circle cx="${sx(r.axes.feas)}" cy="${sy(r.axes.attract)}" r="11" fill="${gMatrixSel===r.o.id?"var(--go)":"var(--ink)"}" stroke="var(--surface)" stroke-width="2"/><text x="${sx(r.axes.feas)}" y="${sy(r.axes.attract)+3.5}" text-anchor="middle" font-size="10" font-weight="700" fill="#ffffff">${r.rank}</text></g>`).join("")}</svg>`;
  const sel=A.R.find(r=>r.o.id===gMatrixSel);const sf=sel&&gFin(sel.o.fin);
  $("g-matrix-pick").innerHTML=sel?`<div class="otip"><b>${sel.rank}. ${esc(sel.o.title)}</b><p class="small">${esc(sel.quad?sel.quad.label:"")} · Score ${sel.score===null?"—":sel.score.toFixed(1)}/10 · Evidence ${esc(sel.conf)}</p>${sf?`<p class="small">Revenue ${gm(sf.revenue)} · Operating profit ${gm(sf.opProfit)} · Investment ${gm(sf.investment)} · Payback ${sf.payback===null?"not within the year":Math.round(sf.payback)+" months"}</p>`:""}${sel.o.time?`<p class="small">About ${sel.o.time} months to launch</p>`:""}${sel.o.risks.length?`<p class="small"><b>Risks:</b> ${sel.o.risks.slice(0,3).map(esc).join(" · ")}</p>`:""}</div>`:"";
  const wt=A.wTotal;$("g-wsum").textContent=wt===100?"Weights total 100%":`Weights total ${wt}%. They must add up to 100%.`;$("g-wsum").style.color=wt===100?"":"var(--stop)";
  if(!(document.activeElement&&document.activeElement.dataset&&(document.activeElement.dataset.gw||document.activeElement.dataset.gt))){
    $("g-weights").innerHTML=G_DIMS.map(([k,l])=>`<div class="field text"><label for="g-w-${k}">${l}<small>Weight %</small></label><input id="g-w-${k}" inputmode="numeric" data-gw="${k}" value="${G.weights[k]}"></div>`).join("");
    $("g-thresh").innerHTML=[["high","High priority from"],["attractive","Attractive from"],["validate","Needs validation from"]].map(([k,l])=>`<div class="field text"><label for="g-t-${k}">${l}<small>Score out of 10</small></label><input id="g-t-${k}" inputmode="decimal" data-gt="${k}" value="${G.thresh[k]}"></div>`).join("");}}

/* ---------- step 7: financials ---------- */
const G_FIN_FIELDS=[["audience","People or businesses you can reach","In year 1",""],["conv","Conversion rate","% who buy","%"],["arpc","Revenue per customer per year","","m"],["varPct","Variable costs","% of revenue: materials, delivery, fees","%"],["acq","Marketing and acquisition spend","Per year","m"],["fixed","Extra fixed costs","Per year: staff, rent, software","m"],["setup","One-off investment","Setup, development, launch","m"],["launch","Months to launch","",""]];
function gRenderFinancials(){const live=G.opps.filter(o=>o.status!=="rejected");const pick=$("g-fin-pick");
  if(!live.find(o=>o.id===G.finSel))G.finSel=live[0]?live[0].id:null;
  pick.innerHTML=live.map(o=>`<option value="${o.id}"${o.id===G.finSel?" selected":""}>${esc(o.title)}</option>`).join("")||`<option>No opportunities yet</option>`;
  const o=live.find(x=>x.id===G.finSel);
  if(!o){$("g-fin-in").innerHTML=`<p class="small muted">Generate opportunities in step 5 first.</p>`;$("g-fin-out").innerHTML="";$("g-scen").innerHTML="";$("g-fin-compare").innerHTML="";return;}
  o.fin=o.fin||{};
  if(!(document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.gf))$("g-fin-in").innerHTML=`<div>${o.finSrc==="ai"||o.finSrc==="example"?gChip(o.finSrc)+(o.finBasis?` <span class="small muted">${esc(o.finBasis)}</span>`:""):gChip("user")}</div>`+G_FIN_FIELDS.map(([k,l,h,u])=>`<div class="field text"><label for="g-f-${k}">${l}${h?`<small>${h}${u==="m"?" ("+G.currency+")":""}</small>`:u==="m"?`<small>${G.currency}</small>`:""}</label><input id="g-f-${k}" inputmode="decimal" data-gf="${k}" value="${o.fin[k]===null||o.fin[k]===undefined?"":o.fin[k]}"></div>`).join("");
  const F=gFin(o.fin);
  $("g-fin-out").innerHTML=F?`<div class="gkv"><span>Expected customers</span><b>${Math.round(F.customers).toLocaleString("en-GB")}</b><span class="small muted">Audience × conversion</span></div>
    <div class="gkv"><span>Revenue</span><b>${gm(F.revenue)}</b><span class="small muted">Customers × revenue per customer</span></div>
    <div class="gkv"><span>Gross profit</span><b>${gm(F.gross)}</b><span class="small muted">Revenue − variable costs · margin ${gpct(F.grossMargin,0)}</span></div>
    <div class="gkv"><span>Contribution</span><b>${gm(F.contribution)}</b><span class="small muted">Gross profit − acquisition spend</span></div>
    <div class="gkv"><span>Operating profit contribution</span><b style="color:${F.opProfit<0?"var(--stop)":"var(--go)"}">${gm(F.opProfit)}</b><span class="small muted">Gross profit − acquisition − extra fixed costs</span></div>
    <div class="gkv"><span>Payback</span><b>${F.payback===null?"Doesn't pay back":Math.round(F.payback)+" months"}</b><span class="small muted">Investment ÷ monthly operating profit</span></div>
    <div class="gkv"><span>First-year ROI</span><b>${F.roi===null?"—":gpct(F.roi,0)}</b><span class="small muted">(Operating profit − investment) ÷ investment</span></div>
    <p class="small muted">Annual figures for the first full year after launch. A model to think with, not a forecast.</p>`:`<p class="small muted">Add at least the audience, conversion rate and revenue per customer, or ask the AI to suggest starting numbers.</p>`;
  const sc=gScenarios(o.fin,G.scen);const row=(l,f)=>`<tr><td>${l}</td>${sc.map(s=>`<td>${s.r?f(s.r):"—"}</td>`).join("")}</tr>`;
  $("g-scen").innerHTML=F?`<div class="otable"><table class="gtbl"><thead><tr><th></th>${sc.map(s=>`<th>${s.label}</th>`).join("")}</tr></thead><tbody>
    <tr class="gadj"><td>Conversion vs base</td>${sc.map(s=>`<td><input inputmode="numeric" data-gsc="${s.key}.conv" value="${G.scen[s.key].conv}" aria-label="${s.label} conversion %">%</td>`).join("")}</tr>
    <tr class="gadj"><td>Spend per customer vs base</td>${sc.map(s=>`<td><input inputmode="numeric" data-gsc="${s.key}.spend" value="${G.scen[s.key].spend}" aria-label="${s.label} spend %">%</td>`).join("")}</tr>
    <tr class="gadj"><td>Costs vs base</td>${sc.map(s=>`<td><input inputmode="numeric" data-gsc="${s.key}.cost" value="${G.scen[s.key].cost}" aria-label="${s.label} cost %">%</td>`).join("")}</tr>
    ${row("Customers",r=>Math.round(r.customers).toLocaleString("en-GB"))}${row("Revenue",r=>gm(r.revenue))}${row("Gross profit",r=>gm(r.gross))}${row("Operating profit",r=>`<span style="color:${r.opProfit<0?"var(--stop)":"inherit"}">${gm(r.opProfit)}</span>`)}${row("Investment",r=>gm(r.investment))}${row("ROI",r=>r.roi===null?"—":gpct(r.roi,0))}${row("Payback",r=>r.payback===null?"No payback":Math.round(r.payback)+" mo")}
    </tbody></table></div>`:"";
  const C=G_A.fin;const mx=Math.max(1,...C.map(x=>Math.max(Math.abs(x.fin.revenue),Math.abs(x.fin.opProfit),x.fin.investment||0)));
  $("g-fin-compare").innerHTML=C.length?C.map(x=>`<div class="gcmp"><b class="small">${esc(x.r.o.title)}</b>${[["Revenue",x.fin.revenue,"var(--ink)"],["Operating profit",x.fin.opProfit,x.fin.opProfit<0?"var(--stop)":"var(--go)"],["Investment",x.fin.investment,"var(--muted)"]].map(([l,v,c])=>`<div class="gcrow"><span class="small muted">${l}</span><div class="gbar"><i style="width:${Math.abs(v)/mx*100}%;background:${c}"></i></div><span class="small">${gm(v)}</span></div>`).join("")}</div>`).join(""):`<p class="small muted">Opportunities with numbers appear here side by side.</p>`;}

/* ---------- step 8: roadmap ---------- */
function gDate(day){if(!G.start)return"Day "+day;const d=new Date(G.start);d.setDate(d.getDate()+day-1);return d.toLocaleDateString("en-GB",{day:"numeric",month:"short"});}
function gRenderRoadmap(){$("g-start").value=G.start||"";const pick=gRoadOpps();
  $("g-road-note").textContent=pick.length?`The plan covers: ${pick.map(o=>o.title).join(" · ")}. ${G.opps.some(o=>o.status==="accepted")?"These are your accepted opportunities.":"No opportunities accepted yet, so it uses the top 3 from the ranking."}`:"Generate and prioritise opportunities first.";
  const acts=G.roadmap.slice().sort((a,b)=>a.phase-b.phase||a.startDay-b.startDay);const pos=a=>`left:${(a.startDay-1)/90*100}%;width:${Math.max(2,(a.endDay-a.startDay+1)/90*100)}%`;
  $("g-roadmap").innerHTML=acts.length?`<div class="card big"><div class="row"><h3>Your 90-day roadmap</h3><span class="spacer"></span><button class="pill" type="button" id="g-road-pdf">Download roadmap (PDF)</button></div>
    <div class="gantt"><div class="gantt-row gantt-head"><span></span><div class="gtrack"><i style="left:0;width:33.33%">Validate</i><i style="left:33.33%;width:33.33%">Build</i><i style="left:66.66%;width:33.34%">Launch</i></div></div>
    ${acts.map(a=>`<div class="gantt-row"><span class="glab"><b>${esc(a.initiative)}</b><small>${esc(a.owner||"")}</small></span><div class="gtrack"><b class="gbar2 p${a.phase}" style="${pos(a)}" title="${esc(gDate(a.startDay))} → ${esc(gDate(a.endDay))}${a.metric?" · "+esc(a.metric):""}"></b></div></div>`).join("")}
    <div class="gantt-row gantt-foot"><span></span><div class="gtrack"><em style="left:0">${esc(gDate(1))}</em><em style="left:33.33%">${esc(gDate(31))}</em><em style="left:66.66%">${esc(gDate(61))}</em><em style="right:0">${esc(gDate(90))}</em></div></div></div>
    <p class="small muted">Drafted by AI from your top opportunities. Click "Build my 90-day plan" again for a fresh version.</p></div>`:"";
  $("g-kpis").innerHTML=G.kpis.length?`<div class="otable"><table class="gtbl"><thead><tr><th>KPI</th><th>For</th><th>Baseline</th><th>Target</th><th>Actual</th><th></th></tr></thead><tbody>${G.kpis.map((k,i)=>`<tr><td><input data-gkp="${i}.name" value="${esc(k.name)}" aria-label="KPI"></td><td class="small">${esc(k.opp||"")}</td><td><input data-gkp="${i}.baseline" value="${esc(k.baseline)}" aria-label="Baseline"></td><td><input data-gkp="${i}.target" value="${esc(k.target)}" aria-label="Target"></td><td><input data-gkp="${i}.actual" value="${esc(k.actual)}" aria-label="Actual"></td><td><button class="linkbtn" type="button" data-gkdel="${i}">Remove</button></td></tr>`).join("")}</tbody></table></div>`:`<p class="small muted">KPIs are suggested with the 90-day plan, or add your own.</p>`;
  const s=G.summary;
  $("g-summary").innerHTML=s?`<h3 style="font-family:var(--display)">${esc(s.headline||"")}</h3>${[["Where to grow",s.where],["Why",s.why],["Biggest opportunity",s.biggest_opportunity],["Biggest risk",s.biggest_risk],["What to avoid",s.avoid]].filter(x=>x[1]).map(([l,v])=>`<p class="small"><b>${l}:</b> ${esc(v)}</p>`).join("")}
    ${(s.priorities||[]).length?`<p class="small"><b>Top 3 priorities</b></p><ol class="small">${s.priorities.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>`:""}${(s.next_steps||[]).length?`<p class="small"><b>Next steps</b></p><ul class="small">${s.next_steps.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
    <p class="small muted">${G.example?"Example (made up).":"Written by AI from the scoring engine's ranking and your evidence."} Not professional advice.</p>`:`<p class="small muted">A short recommendation: where to grow, why, the biggest opportunity and risk, what to avoid, and your top 3 priorities. It explains the ranking above rather than picking its own.</p>`;}

/* ---------- one-page roadmap PDF ---------- */
let gJsPdf=null;
function gLoadJsPdf(){if(window.jspdf)return Promise.resolve(window.jspdf);if(gJsPdf)return gJsPdf;gJsPdf=new Promise((res,rej)=>{const sc=document.createElement("script");sc.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";sc.onload=()=>res(window.jspdf);sc.onerror=()=>{gJsPdf=null;rej(new Error("load"));};document.head.appendChild(sc);});return gJsPdf;}
async function gRoadmapPdf(){if(!G.roadmap.length)return;let lib;try{lib=await gLoadJsPdf();}catch(e){gToast("Couldn't create the PDF just now. Check your connection and try again.");return;}
  const doc=new lib.jsPDF({orientation:"landscape",unit:"mm",format:"a4"});const W=297,H=210,M=14,labW=78,x0=M+labW,tw=W-M-x0;const acts=G.roadmap.slice().sort((a,b)=>a.phase-b.phase||a.startDay-b.startDay);
  const tx=d=>x0+(d-1)/90*tw;const txt=(t)=>String(t||"").replace(/[^\x20-\x7E£€]/g,c=>({"–":"-","—":"-","’":"'","‘":"'","“":'"',"”":'"',"→":"->","·":"-","₹":"Rs "}[c]||""));
  doc.setFont("times","bold");doc.setFontSize(22);doc.setTextColor(15,15,14);doc.text(txt("90-day growth roadmap"),M,M+6);
  doc.setFont("helvetica","normal");doc.setFontSize(11);doc.setTextColor(107,107,102);doc.text(txt(`${G.company.name||""}  |  ${gDate(1)} to ${gDate(90)}${G.example?"  |  Example with made-up data":""}`),M,M+13);
  const top=M+24,rowH=Math.min(13,(H-top-46)/Math.max(1,acts.length));
  [[1,"VALIDATE","Days 1-30"],[31,"BUILD AND PREPARE","Days 31-60"],[61,"LAUNCH AND MEASURE","Days 61-90"]].forEach(([d,l,s2],i)=>{const xa=tx(d),wa=tw/3;doc.setFillColor(i===1?255:243,i===1?255:243,i===1?255:240);doc.rect(xa,top,wa,acts.length*rowH+10,"F");doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(15,15,14);doc.text(l,xa+3,top+5);doc.setFont("helvetica","normal");doc.setTextColor(107,107,102);doc.text(s2,xa+wa-3,top+5,{align:"right"});});
  acts.forEach((a,i)=>{const y=top+10+i*rowH;doc.setDrawColor(230,229,223);doc.line(M,y+rowH,W-M,y+rowH);
    doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(15,15,14);doc.text(doc.splitTextToSize(txt(a.initiative),labW-4)[0],M,y+rowH/2);
    doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(107,107,102);doc.text(txt(a.owner||""),M,y+rowH/2+4);
    const c=a.phase===3?[31,122,74]:a.phase===1?[107,107,102]:[15,15,14];doc.setFillColor(...c);const bx=tx(a.startDay),bw=Math.max(3,(a.endDay-a.startDay+1)/90*tw);doc.roundedRect(bx,y+rowH/2-3.2,bw,5,2.5,2.5,"F");
    if(a.metric){doc.setFontSize(7.5);doc.setTextColor(107,107,102);const full=txt(a.metric);if(bx+bw+2+doc.getTextWidth(full)<W-M)doc.text(full,bx+bw+2,y+rowH/2+1);else{const mt=doc.splitTextToSize(full,90)[0];doc.text(mt,Math.min(W-M,Math.max(bx+bw,x0+doc.getTextWidth(mt))),y+rowH/2+5.6,{align:"right"});}}});
  const kp=G.kpis.slice(0,4);let y=top+10+acts.length*rowH+10;
  if(kp.length){doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(15,15,14);doc.text("What we'll measure",M,y);doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(60,60,57);
    kp.forEach((k,i)=>{const cx=M+(i%2)*((W-2*M)/2),cy=y+6+Math.floor(i/2)*5.5;doc.text(doc.splitTextToSize(txt(`${k.name}: ${k.baseline||"-"} -> ${k.target||"-"}`),(W-2*M)/2-4)[0],cx,cy);});}
  doc.setFontSize(8);doc.setTextColor(150,150,145);doc.text("BBC - Big Brain Consulting  |  bigbrainconsulting.net  |  A plan to adapt, not a guarantee.",M,H-8);
  doc.save((G.company.name||"growth").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-90-day-roadmap.pdf");gToast("Downloaded your 90-day roadmap.");if(window.bbcTrack)bbcTrack("growth_roadmap_pdf");}

/* ---------- report, saving ---------- */
function gReportHTML(){const A=gAll(G);const c=G.company;const s=G.summary||{};const li=a=>(a||[]).map(x=>`<li>${esc(x)}</li>`).join("");
  return`<h1>Growth strategy: ${esc(c.name||"")}</h1><p class="mmeta">BBC – Big Brain Consulting · ${new Date().toLocaleDateString("en-GB")}${G.example?" · Worked example with made-up data":""}</p>
  ${s.headline?`<h2>${esc(s.headline)}</h2>${[["Where to grow",s.where],["Why",s.why],["Biggest opportunity",s.biggest_opportunity],["Biggest risk",s.biggest_risk],["What to avoid",s.avoid]].filter(x=>x[1]).map(([l,v])=>`<p><b>${l}:</b> ${esc(v)}</p>`).join("")}<p><b>Priorities</b></p><ol>${li(s.priorities)}</ol><p><b>Next steps</b></p><ul>${li(s.next_steps)}</ul>`:""}
  <h2>Opportunities, ranked</h2><table><tr><th>#</th><th>Opportunity</th><th>Score /10</th><th>Classification</th><th>Evidence</th><th>Quadrant</th><th>Status</th></tr>${A.R.map(r=>`<tr><td>${r.rank}</td><td>${esc(r.o.title)}</td><td>${r.score===null?"—":r.score.toFixed(1)}</td><td>${esc(r.cls.label)}</td><td>${esc(r.conf)}</td><td>${esc(r.quad?r.quad.label:"")}</td><td>${esc(r.o.status)}</td></tr>`).join("")}</table>
  <p>Weights: ${G_DIMS.map(([k,l])=>`${l} ${G.weights[k]}%`).join(", ")}.</p>
  ${A.fin.length?`<h2>Financial potential (first year, base case)</h2><table><tr><th>Opportunity</th><th>Revenue</th><th>Gross profit</th><th>Operating profit</th><th>Investment</th><th>Payback</th><th>ROI</th></tr>${A.fin.map(x=>`<tr><td>${esc(x.r.o.title)}</td><td>${gm(x.fin.revenue,true)}</td><td>${gm(x.fin.gross,true)}</td><td>${gm(x.fin.opProfit,true)}</td><td>${gm(x.fin.investment,true)}</td><td>${x.fin.payback===null?"—":Math.round(x.fin.payback)+" months"}</td><td>${x.fin.roi===null?"—":gpct(x.fin.roi,0)}</td></tr>`).join("")}</table>`:""}
  ${G.roadmap.length?`<h2>90-day plan</h2><table><tr><th>Phase</th><th>Initiative</th><th>Owner</th><th>Dates</th><th>Success metric</th><th>Cost</th></tr>${G.roadmap.slice().sort((a,b)=>a.startDay-b.startDay).map(a=>`<tr><td>${["","Validate","Build","Launch"][a.phase]}</td><td>${esc(a.initiative)}<br><small>${esc(a.desc)}</small></td><td>${esc(a.owner)}</td><td>${gDate(a.startDay)} – ${gDate(a.endDay)}</td><td>${esc(a.metric)}</td><td>${a.cost?gm(a.cost,true):""}</td></tr>`).join("")}</table>`:""}
  ${G.kpis.length?`<h2>KPIs</h2><table><tr><th>KPI</th><th>Baseline</th><th>Target</th><th>Actual</th></tr>${G.kpis.map(k=>`<tr><td>${esc(k.name)}</td><td>${esc(k.baseline)}</td><td>${esc(k.target)}</td><td>${esc(k.actual)}</td></tr>`).join("")}</table>`:""}
  ${A.FB?`<h2>Customer insight</h2><p>${A.FB.n} comments analysed.</p><ul>${A.FB.themes.slice(0,8).map(t=>`<li>${esc(t.theme)}: ${t.count} mentions (${gpct(t.pct,0)} of sample)</li>`).join("")}</ul>`:""}
  ${A.M.tam?`<h2>Market size</h2><p>TAM ${gm(A.M.tam,true)} · SAM ${gm(A.M.sam,true)} · SOM ${gm(A.M.som,true)}. ${esc(G.market.basis||"")}</p>`:""}
  <h2>Sources</h2><ul>${G.sources.map(x=>`<li>${esc(x.filename||x.title)} (${esc(G_SRC[x.kind]||x.kind)})${x.url?` ${esc(x.url)}`:""}</li>`).join("")}</ul>
  <p class="mmeta">AI-generated findings are labelled as estimates to verify. Scores are judgements, not measurements. Not financial or professional advice.</p>`;}
function gExportDoc(){return`<html><head><meta charset="utf-8"><title>${esc(G.company.name||"Growth strategy")}</title><style>body{font-family:Helvetica,Arial,sans-serif;font-size:11pt;line-height:1.5;color:#111;max-width:760px}h1,h2{font-family:Georgia,serif}h1{font-size:22pt}h2{font-size:14pt;margin-top:18pt}table{border-collapse:collapse;width:100%;font-size:9.5pt}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}.mmeta{color:#666}</style></head><body>${gReportHTML()}</body></html>`;}
async function gList(){if(DB&&UID){try{const q=await DB.collection("data/users/"+UID).get();return q.docs.filter(d=>d.exists&&d.id.startsWith("gr_")).map(d=>Object.assign({id:d.id},d.data())).sort((a,b)=>b.savedAt-a.savedAt);}catch(e){return[];}}try{return JSON.parse(localStorage.getItem("gr-saved")||"[]");}catch(e){return[];}}
async function gSaveRec(){const name=($("gsaveName").value||"").trim()||`${G.company.name||"Growth analysis"} · ${new Date().toLocaleDateString("en-GB")}`;const top=G_A.R[0];
  const rec={name,savedAt:Date.now(),company:G.company.name||"",top:top?top.o.title:"",state:JSON.parse(JSON.stringify(G))};
  if(DB&&UID){try{await DB.collection("data/users/"+UID).doc("gr_"+Date.now().toString(36)).set(rec);gToast(`Saved "${name}" to your account.`);}catch(e){gToast("Couldn't save just now. Try again.");return;}}
  else{const l=await gList();l.unshift(Object.assign({id:"gr_"+Date.now().toString(36)},rec));try{localStorage.setItem("gr-saved",JSON.stringify(l.slice(0,20)));gToast(`Saved "${name}" in this browser.`);}catch(e){gToast("This browser blocked saving.");}}
  gDrawSaved();}
async function gDrawSaved(){const l=await gList();const el=$("gsaved");if(!el)return;el.innerHTML=l.length?`<h4>Your saved analyses</h4>${l.map(it=>`<div class="saved"><div><b>${esc(it.name)}</b><small class="muted">${new Date(it.savedAt).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}${it.top?" · Top: "+esc(it.top):""}</small></div><div class="row"><button class="pill sm ghost" type="button" data-gopen="${esc(it.id)}">Open</button><button class="pill sm ghost" type="button" data-gdel="${esc(it.id)}">Delete</button></div></div>`).join("")}`:"";}

/* ---------- master render ---------- */
function gCss(){if($("gCss"))return;const st=document.createElement("style");st.id="gCss";st.textContent=`
#growth .gfind{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}#growth .gfind li{display:flex;flex-wrap:wrap;gap:6px 10px;justify-content:space-between;border-bottom:1px solid var(--line);padding:6px 0;font-size:14px}#growth .gfind li>span:first-child{flex:1 1 300px;min-width:0}
#growth .gfmeta{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#growth .gtbl{width:100%;border-collapse:collapse;font-size:13px}#growth .gtbl th,#growth .gtbl td{text-align:left;padding:6px;border-bottom:1px solid var(--line);vertical-align:top}#growth .gtbl input{width:100%;min-width:70px;font:13px var(--body);padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}#growth .gtbl .gadj input{width:64px;min-width:0}
#growth .otable{overflow-x:auto}
#growth .gsent{display:flex;height:14px;border-radius:999px;overflow:hidden;background:var(--sunk)}#growth .gsent i{display:block;height:100%}
#growth .gtheme{border-top:1px solid var(--line);padding:10px 0;display:flex;flex-direction:column;gap:4px}#growth .gtheme p{margin:0}#growth .gq{font-style:italic}
#growth .gbar{height:8px;border-radius:999px;background:var(--sunk);overflow:hidden;flex:1;min-width:60px}#growth .gbar i{display:block;height:100%;background:var(--ink);border-radius:999px}
#growth .ggrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}#growth .gseg{border:1px solid var(--line);border-radius:var(--r-md);padding:14px;display:flex;flex-direction:column;gap:4px;min-width:0}#growth .gseg p{margin:2px 0}
#growth .gseg input,#growth .gseg textarea,#growth .gact input,#growth .gact textarea,#growth .gact select,#growth .gopp textarea{width:100%;font:13px var(--body);padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);box-sizing:border-box}
#growth .gkv{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;border-bottom:1px solid var(--line);padding:8px 0}#growth .gkv b{font-variant-numeric:tabular-nums;font-size:17px}#growth .gkv .small{grid-column:1/-1}
#growth .gopp.rej{opacity:.55}#growth .gtitle{width:100%;font:700 19px/1.25 var(--display);border:0;background:transparent;color:var(--ink);padding:0}#growth .gtitle:focus{outline:1px dashed var(--line)}#growth .gdl{padding:6px 0}#growth .gdl p{margin:4px 0}
#growth .grank{border-bottom:1px solid var(--line);padding:8px 0}#growth .grank summary{display:flex;gap:10px;align-items:center;cursor:pointer;list-style:none}#growth .grank summary::-webkit-details-marker{display:none}
#growth .grn{width:26px;height:26px;border-radius:50%;background:var(--ink);color:var(--bg);display:grid;place-items:center;font:700 12px var(--body);flex:none}#growth .grt{flex:1;min-width:0;font-weight:600;font-size:14px}#growth .grs{font:700 16px var(--display);font-variant-numeric:tabular-nums}
#growth .gscores{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:6px}#growth .gscores label{display:flex;flex-direction:column;gap:3px}#growth .gscores input{width:70px;font:14px var(--body);padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}
#growth .gdot{cursor:pointer}#growth .gdot:focus{outline:none}#growth .gdot:focus circle{stroke:var(--go);stroke-width:3}
#growth .gcmp{border-bottom:1px solid var(--line);padding:8px 0;display:flex;flex-direction:column;gap:4px}#growth .gcrow{display:grid;grid-template-columns:120px minmax(0,1fr) 70px;gap:8px;align-items:center}
#growth .groad{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}@media (max-width:900px){#growth .groad{grid-template-columns:minmax(0,1fr)}}
#growth .gphase{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0}#growth .gph{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid var(--ink);padding-bottom:6px}
#growth .gact{border:1px solid var(--line);border-radius:var(--r-md);padding:10px;display:flex;flex-direction:column;gap:6px}#growth .gact .gtitle{font-size:15px}#growth .gactm{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:6px}#growth .gactm label{display:flex;flex-direction:column;gap:2px}#growth .gact p{margin:0}
#growth .gantt{display:flex;flex-direction:column;gap:6px;margin-top:10px;overflow-x:auto}
#growth .gantt-row{display:grid;grid-template-columns:minmax(140px,30%) minmax(260px,1fr);gap:12px;align-items:center;min-width:420px}
#growth .glab{display:flex;flex-direction:column;font-size:13px;line-height:1.3;min-width:0}#growth .glab small{color:var(--muted)}
#growth .gtrack{position:relative;height:22px;background:linear-gradient(90deg,var(--sunk) 0 33.33%,transparent 33.33% 66.66%,var(--sunk) 66.66%);border-radius:6px}
#growth .gantt-head .gtrack{background:none;height:20px}#growth .gantt-head i{position:absolute;top:0;font:700 11px var(--body);letter-spacing:.12em;text-transform:uppercase;text-align:center;color:var(--muted)}
#growth .gbar2{position:absolute;top:4px;height:14px;border-radius:999px;background:var(--ink)}#growth .gbar2.p1{background:#6B6B66}#growth .gbar2.p3{background:var(--go)}
#growth .gantt-foot .gtrack{background:none;height:16px}#growth .gantt-foot em{position:absolute;font:normal 11px var(--body);color:var(--muted)}
#growth #gsaveName{font:14px var(--body);padding:10px 14px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--ink);min-width:0;flex:1 1 200px}
#growth input#g-start{font:14px var(--body);padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}
@media (max-width:560px){#growth .gcrow{grid-template-columns:90px minmax(0,1fr) 60px}}`;document.head.appendChild(st);}
function gBuildAll(){gCss();gBuildCompany();}
function gRender(){if($("growth").hidden&&!window.G_FORCE)return;G_A=gAll(G);gProg();
  if($("gnext-1"))$("gnext-1").disabled=!(G.company.name||"").trim();
  if(!gResumeShown){gResumeShown=true;if((G.furthest||0)>0&&(G.company.name||"").trim()){const r=$("gresume");r.hidden=false;r.innerHTML=`<p><b>Welcome back.</b> We've kept your growth analysis of ${esc(G.company.name)}.</p><div class="row"><button class="pill sm" type="button" data-gresume="1">Carry on</button><button class="pill sm ghost" type="button" data-grestart="1">Start a new analysis</button></div>`;}}
  document.querySelectorAll("#growth [data-gresearch],#growth [data-gai],#growth [data-gdeep]").forEach(b=>b.disabled=!!GBUSY||(b.id==="g-fb-btn"&&!G.feedback.items.length));
  const t=GTAB;if(t==="evidence")gRenderEvidence();if(t==="customers")gRenderCustomers();if(t==="market")gRenderMarket();if(t==="opps")gRenderOpps();if(t==="prioritise")gRenderPrioritise();if(t==="financials")gRenderFinancials();if(t==="roadmap"){gRenderRoadmap();gDrawSaved();}}

/* ---------- events ---------- */
document.addEventListener("input",e=>{const i=e.target;if(!i.closest||!i.closest("#growth"))return;let d=i.dataset,r=false;
  if(d.gk){gSet(d.gk,d.gk==="currency"?i.value:i.dataset.num?(i.value===""?"":gn(i.value)):i.value);if(d.gk==="company.name")$("gnext-1").disabled=!i.value.trim();}
  else if(d.gp){const[ix,k]=d.gp.split(".");const p=G.products[+ix];if(p){p[k]=k==="name"?i.value:gn(i.value);if(p.status!=="user")p.edited=true;}r=true;}
  else if(d.gc){const[ix,k]=d.gc.split(".");const c=G.competitors[+ix];if(c)c[k]=i.value;}
  else if(d.gm){G.market[d.gm]=gn(i.value);G.market.src=G.market.src||{};G.market.src[d.gm]=i.value===""?undefined:"user";r=true;}
  else if(d.go){const[id,k]=d.go.split(".");const o=G.opps.find(x=>x.id===id);if(o)o[k]=i.value;}
  else if(d.gs){const[id,k]=d.gs.split(".");const o=G.opps.find(x=>x.id===id);if(o){const v=gn(i.value);o.scores[k]=v===null?null:Math.min(10,Math.max(1,v));}r=true;}
  else if(d.gw){G.weights[d.gw]=gn(i.value)||0;r=true;}
  else if(d.gt){G.thresh[d.gt]=gn(i.value)||0;r=true;}
  else if(d.gf){const o=G.opps.find(x=>x.id===G.finSel);if(o){o.fin=o.fin||{};o.fin[d.gf]=gn(i.value);o.finSrc="user";}r=true;}
  else if(d.gsc){const[k,f]=d.gsc.split(".");G.scen[k][f]=gn(i.value)||0;r=true;}
  else if(d.gr){const[ix,k]=d.gr.split(".");const a=G.roadmap[+ix];if(a){a[k]=["startDay","endDay"].includes(k)?Math.min(90,Math.max(1,gn(i.value)||1)):k==="cost"?gn(i.value):i.value;}}
  else if(d.gkp){const[ix,k]=d.gkp.split(".");const kp=G.kpis[+ix];if(kp)kp[k]=i.value;}
  else if(i.id==="g-start"){G.start=i.value;r=true;}
  else return;
  gSave();if(r){clearTimeout(gRender.t);gRender.t=setTimeout(()=>{G_A=gAll(G);if(GTAB==="customers")gRenderCustomersLite();else if(GTAB==="market")gRenderMarket();else if(GTAB==="prioritise")gRenderPrioritise();else if(GTAB==="financials")gRenderFinancials();else if(GTAB==="roadmap")gRenderRoadmap();},350);}});
function gRenderCustomersLite(){/* keep focus while typing in the products table: only refresh the computed columns */const A=G_A;document.querySelectorAll("#g-products tbody tr").forEach((tr,i)=>{const p=A.P[i];if(!p)return;const td=tr.children;td[5].textContent=gpct(p.share,0);td[6].textContent=gpct(p.growthPct,0);td[7].innerHTML=p.margin===null?'<span class="small muted">needs cost</span>':gpct(p.margin,0);});}
document.addEventListener("change",e=>{const i=e.target;if(!i.closest||!i.closest("#growth"))return;
  if(i.id==="g-file"){gUpload(i.files);i.value="";return;}
  if(i.id==="g-opp-filter"){gRenderOpps();return;}if(i.id==="g-sort"){gRenderPrioritise();return;}
  if(i.id==="g-fin-pick"){G.finSel=i.value;gSave();gRenderFinancials();return;}
  if(i.dataset&&(i.dataset.gm||i.dataset.gw||i.dataset.gt||i.dataset.gf||i.dataset.gr))setTimeout(gRender,0);});
document.addEventListener("click",e=>{const g=s=>e.target.closest(s);let b;if(!e.target.closest)return;
  if((b=g("[data-gexample]"))){e.preventDefault();if(typeof gLoadExample==="function")gLoadExample();return;}
  if(!e.target.closest("#growth"))return;
  if((b=g("[data-gnext]"))){e.preventDefault();gNext(1);return;}if((b=g("[data-gback]"))){e.preventDefault();gNext(-1);return;}
  if((b=g("[data-gstep]"))){if(!b.disabled)gGo(b.dataset.gstep);return;}
  if((b=g("[data-gobj]"))){const o=b.dataset.gobj;G.objectives=G.objectives.includes(o)?G.objectives.filter(x=>x!==o):G.objectives.concat(o);b.setAttribute("aria-pressed",G.objectives.includes(o));gSave();return;}
  if((b=g("[data-gresearch]"))){gResearch(b.dataset.gresearch);return;}
  if((b=g("[data-gai]"))){gRunAI(b.dataset.gai);return;}
  if((b=g("[data-gdeep]"))){gRunAI("deeper",b.dataset.gdeep);return;}
  if(b=g("#g-paste-add")){gPaste();return;}
  if((b=g("[data-gfdel]"))){G.findings=G.findings.filter(f=>f.id!==b.dataset.gfdel);gSave();gRender();return;}
  if((b=g("[data-gprodadd]"))){G.products.push({name:"New product",category:"",price:null,revenue:null,prevRevenue:null,cost:null,status:"user"});gSave();gRender();return;}
  if((b=g("[data-gpdel]"))){G.products.splice(+b.dataset.gpdel,1);gSave();gRender();return;}
  if((b=g("[data-gcompadd]"))){G.competitors.push({name:"New competitor",status:"user"});gSave();gRender();return;}
  if((b=g("[data-gcdel]"))){G.competitors.splice(+b.dataset.gcdel,1);gSave();gRender();return;}
  if((b=g("[data-gtdel]"))){G.trends.splice(+b.dataset.gtdel,1);gSave();gRender();return;}
  if((b=g("[data-goppadd]"))){const o=gOppFrom({title:"My opportunity",category:"product",description:"Describe the idea, then score it in step 6.",scores:{}},"user");o.src="user";o.finSrc="user";G.opps.unshift(o);gSave();gRender();return;}
  if((b=g("[data-godel]"))){G.opps=G.opps.filter(o=>o.id!==b.dataset.godel);gSave();gRender();return;}
  if((b=g("[data-gacc]"))){const o=G.opps.find(x=>x.id===b.dataset.gacc);if(o){o.status=o.status==="accepted"?"open":"accepted";gSave();gRender();}return;}
  if((b=g("[data-grej]"))){const o=G.opps.find(x=>x.id===b.dataset.grej);if(o){o.status=o.status==="rejected"?"open":"rejected";gSave();gRender();}return;}
  if((b=g("[data-gdot]"))){gMatrixSel=b.dataset.gdot;gRenderPrioritise();return;}
  if((b=g("[data-gwreset]"))){G.weights=Object.assign({},G_WEIGHTS);G.thresh=Object.assign({},G_THRESH);gSave();gRenderPrioritise();return;}
  if((b=g("[data-gradd]"))){G.roadmap.push({id:gId(),phase:+b.dataset.gradd,initiative:"New activity",desc:"",priority:"medium",owner:"",startDay:(+b.dataset.gradd-1)*30+1,endDay:+b.dataset.gradd*30,deps:"",resources:"",cost:null,metric:"",outcome:"",opp:""});gSave();gRender();return;}
  if((b=g("[data-grdel]"))){G.roadmap.splice(+b.dataset.grdel,1);gSave();gRender();return;}
  if((b=g("[data-gkpiadd]"))){G.kpis.push({id:gId(),opp:"",name:"New KPI",baseline:"",target:"",actual:""});gSave();gRender();return;}
  if((b=g("[data-gkdel]"))){G.kpis.splice(+b.dataset.gkdel,1);gSave();gRender();return;}
  if((b=g("[data-gresume]"))){$("gresume").hidden=true;gGo(G.step||"company");return;}
  if((b=g("[data-grestart]"))){const keep=G.currency;G=gFresh();G.currency=keep;gResumeShown=true;$("gresume").hidden=true;gMatrixSel=null;gBuildCompany();gGo("company");gToast("Started a new analysis.");return;}
  if(b=g("#g-road-pdf")){needProfile(gRoadmapPdf,"download the roadmap");return;}
  if(b=g("#gsaveBtn")){needProfile(gSaveRec,"save your analysis");return;}
  if((b=g("[data-gopen]"))){gList().then(l=>{const it=l.find(x=>x.id===b.dataset.gopen);if(it){G=Object.assign(gFresh(),it.state);gBuildCompany();gGo(G.step||"roadmap");gToast(`Opened "${it.name}".`);}});return;}
  if((b=g("[data-gdel]"))){(async()=>{if(DB&&UID){try{await DB.collection("data/users/"+UID).doc(b.dataset.gdel).delete();}catch(e){}}else{try{localStorage.setItem("gr-saved",JSON.stringify((await gList()).filter(x=>x.id!==b.dataset.gdel)));}catch(e){}}gDrawSaved();})();return;}
  if(b=g("#gexpWord")){needProfile(()=>{const name=(G.company.name||"growth-strategy").toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-growth-strategy.doc";const blob=new Blob([gExportDoc()],{type:"application/msword"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);gToast("Downloaded the Word report.");},"export");return;}
  if(b=g("#gexpPdf")){needProfile(()=>{const w=window.open("","_blank");if(!w){gToast("Your browser blocked the print window. Allow pop-ups for this site and try again.");return;}w.document.write(gExportDoc().replace("</body>","<script>window.onload=()=>{window.print();}<\/script></body>"));w.document.close();gToast('Choose "Save as PDF" in the print window.');},"export");return;}
});
document.addEventListener("keydown",e=>{const d=e.target.closest&&e.target.closest("[data-gdot]");if(d&&(e.key==="Enter"||e.key===" ")){e.preventDefault();gMatrixSel=d.dataset.gdot;gRenderPrioritise();}});
(function(){const dz=$("g-drop");if(!dz)return;["dragover","dragenter"].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.add("over");}));["dragleave","drop"].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.remove("over");}));dz.addEventListener("drop",e=>gUpload(e.dataTransfer.files));})();
gBuildAll();gGo(GTAB,true);
