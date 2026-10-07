/* ===== Operations Bottleneck Diagnoser: page ===== */
function opsFresh(key){const P=opsFromTemplate(key||"ecom");const C=opsCalc(P);
  const bn=C.primary&&C.primary.s;const ks=bn&&opsAutomated(bn)?["machine","faster","quality"]:["staff","machine","faster"];
  ks.forEach(k=>P.scenarios.push(opsMakeScenario(P,k,C)));
  P.sel=(C.primary||C.steps[0]).id;return P;}
let O=null;try{const d=JSON.parse(localStorage.getItem("ops-draft")||"null");if(d&&Array.isArray(d.steps)&&d.steps.length)O=d;}catch(e){}
if(!O){O=opsFresh();O.picked=false;}
if(O.picked===undefined)O.picked=true;O.view="day";if(O.furthest===undefined)O.furthest=0;
let OC=null,OR=null,OTAB="process",oEditMore=false,oResumeShown=false,oPendStepDel=null,OPS_TUT=false,oUndo=null,oPendDel=null,oRankOpen={},oTraceKey=null;
const OSYM={GBP:"£",USD:"$",EUR:"€",INR:"₹"};
const osym=()=>OSYM[O.cur]||"£";
function om(v){if(v===null||v===undefined||!isFinite(v))return"—";const a=Math.abs(v),s=v<0?"−":"";let b;
  if(a>=1e9)b=(a/1e9).toFixed(2)+"B";else if(a>=1e6)b=(a/1e6).toFixed(a>=1e7?1:2)+"M";else if(a>=1e5)b=(a/1e3).toFixed(0)+"K";else b=Math.round(a).toLocaleString("en-GB");return s+osym()+b;}
function om2(v){if(!isFinite(v))return"—";return(v<0?"−":"")+osym()+Math.abs(v).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2});}
function onum(v,dp){if(v===null||v===undefined||!isFinite(v))return"—";const d=dp===undefined?(Math.abs(v)<10&&v!==Math.round(v)?1:0):dp;return(v<0?"−":"")+Math.abs(v).toLocaleString("en-GB",{minimumFractionDigits:d,maximumFractionDigits:d});}
const opct=(v,dp=0)=>isFinite(v)?(v<0?"−":"")+(Math.abs(v)*100).toFixed(dp)+"%":"—";
const ospct=(v,dp=0)=>isFinite(v)?(v>0?"+":v<0?"−":"")+(Math.abs(v)*100).toFixed(dp)+"%":"—";
const omin=v=>!isFinite(v)?"—":v>=600?onum(v/60,1)+" h":onum(v,v<10?1:0)+" min";
const vf=()=>O.view==="week"?5:O.view==="month"?(+O.days||22):1;
const vu=()=>O.view==="week"?"a week":O.view==="month"?"a month":"a day";
const ov=x=>isFinite(x)?onum(x*vf(),x*vf()<10?1:0):"No limit";
const md=x=>x*(+O.days||0);
let oDraftT;function opsSave(){clearTimeout(oDraftT);oDraftT=setTimeout(()=>{if(OPS_TUT)return;try{localStorage.setItem("ops-draft",JSON.stringify(O));}catch(e){}},400);}
function otoast(t){$("otoast").textContent=t;}

/* ---------- field definitions ---------- */
const OF={"biz.name":{l:"Business name",t:"text"},"biz.industry":{l:"Industry",t:"text"},"biz.type":{l:"Business type",t:"text"},"biz.employees":{l:"Employees in this process",u:"num"},
  "biz.location":{l:"Location",t:"text"},cur:{l:"Currency",t:"select",opts:[["GBP","£ GBP"],["USD","$ USD"],["EUR","€ EUR"],["INR","₹ INR"]]},
  "proc.name":{l:"Process name",t:"text"},"proc.desc":{l:"Description",t:"text"},"proc.owner":{l:"Process owner",t:"text"},
  "proc.freq":{l:"How often it runs",t:"select",opts:[["Continuously","Continuously"],["Daily","Daily"],["Weekly","Weekly"],["Monthly","Monthly"]]},
  demand:{l:"Demand",h:"Units entering the process each working day",u:"num",src:1},days:{l:"Working days per month",u:"num",src:1},
  revenue:{l:"Revenue per unit",h:"Used for revenue lost. Leave 0 if not relevant",u:"money",src:1},margin:{l:"Contribution per unit",h:"Profit after the unit's own costs",u:"money",src:1},
  otRate:{l:"Overtime cost per hour",u:"money",src:1},otMax:{l:"Max overtime per person a day",h:"Work beyond this is lost",u:"hrs",src:1},
  delayCost:{l:"Cost of delay per unit per hour",h:"Penalties, chasing, customer credits",u:"money",src:1},
  "thresh.low":{l:"Low below",u:"pct"},"thresh.healthy":{l:"High from",u:"pct"},"thresh.high":{l:"Overloaded above",u:"pct"}};
Object.keys(OPS_BN_W).forEach(k=>OF["bnW."+k]={l:OPS_BN_LABEL[k],u:"num"});
Object.keys(OPS_H_W).forEach(k=>OF["hW."+k]={l:OPS_H_LABEL[k],u:"num"});
const SF={name:{l:"Step name",t:"text"},desc:{l:"Description",t:"text"},exitLabel:{l:"Exit branch label",h:"For example \"Payment rejected\"",t:"text"},
  time:{l:"Average processing time",u:"min"},tmin:{l:"Fastest time",u:"min",blank:1},tmax:{l:"Slowest time",u:"min",blank:1},
  staff:{l:"Employees",h:"0 for a fully automated step",u:"num"},machines:{l:"Machines",h:"0 if not needed",u:"num"},stations:{l:"Workstations",h:"Each needs a person. 0 if not needed",u:"num"},hours:{l:"Available hours a day",u:"hrs"},
  err:{l:"Error rate",h:"Share of units with a mistake",u:"pct"},rwShare:{l:"Errors fixed by rework",h:"The rest fail and are lost",u:"pct"},rwMin:{l:"Rework time per error",u:"min"},
  delay:{l:"Delay rate",h:"Share of units held up",u:"pct"},delayMin:{l:"Average delay",u:"min"},wait:{l:"Average waiting time",h:"Leave blank to estimate",u:"min",blank:1},
  cancel:{l:"Cancellation rate",h:"Share of units leaving the process here",u:"pct"},
  labour:{l:"Labour cost per hour",u:"money"},machCost:{l:"Machine cost per hour",u:"money"},other:{l:"Other cost per unit",h:"Packaging, postage, materials",u:"money"},
  investment:{l:"Investment",u:"money"},monthlyCost:{l:"Extra running cost a month",h:"Costs not already in the model, such as software fees",u:"money"},value:{l:"Change",u:"num"}};
const SRCNAME={actual:"Actual",estimated:"Estimated",example:"Example",ai:"AI-generated",model:"Model estimate"};

/* ---------- paths ---------- */
function oStep(id){return O.steps.find(s=>s.id===id);}
function oSc(id){return O.scenarios.find(s=>s.id===id);}
function oTarget(path){const p=path.split(".");
  if(p[0]==="st"){const s=oStep(p[1]);return s?[s,p[2]]:null;}
  if(p[0]==="sc"){const s=oSc(p[1]);return s?[s,p[2]]:null;}
  if(p.length===2)return[O[p[0]],p[1]];return[O,p[0]];}
function getP(path){const t=oTarget(path);return t&&t[0]?t[0][t[1]]:undefined;}
function setP(path,v){const t=oTarget(path);if(t&&t[0])t[0][t[1]]=v;}
function srcOf(path){const p=path.split(".");if(p[0]==="st"){const s=oStep(p[1]);return s?((s.src||{})[p[2]]||"example"):"example";}return(O.src||{})[path]||"example";}
function setSrc(path,v){const p=path.split(".");if(p[0]==="st"){const s=oStep(p[1]);if(s){s.src=s.src||{};s.src[p[2]]=v;}}else{O.src=O.src||{};O.src[path]=v;}}
const srcable=path=>{const p=path.split(".");return p[0]==="st"?OPS_STEP_FIELDS.includes(p[2]):OPS_PROC_FIELDS.includes(path);};

/* ---------- field builder ---------- */
function ofield(path,d,pre){const id=(pre||"o")+"-"+path.replace(/\./g,"-");const help=d.h?`<small>${d.h}</small>`:"";
  const chip=srcable(path)?` <button type="button" class="srcchip" data-osrc="${path}" title="Tap to change where this number comes from"></button>`:"";
  if(d.t==="text")return`<div class="field text"><label for="${id}"><span>${d.l}</span>${help}</label><input id="${id}" type="text" data-op="${path}" autocomplete="off"></div>`;
  if(d.t==="select")return`<div class="field text"><label for="${id}">${d.l}</label><select id="${id}" data-op="${path}">${d.opts.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join("")}</select></div>`;
  const pr=d.u==="money"?`<span class="ocs">${osym()}</span>`:"";
  const sf=d.u==="pct"?`<span class="suf">%</span>`:d.u==="min"?`<span class="suf">min</span>`:d.u==="hrs"?`<span class="suf">hrs</span>`:"";
  return`<div class="field"><label for="${id}"><span>${d.l}${chip}</span>${help}</label><div class="inbox">${pr}<input id="${id}" type="text" inputmode="decimal" autocomplete="off" data-op="${path}" data-onum="1"${d.blank?' data-oblank="1"':""}>${sf}</div></div>`;}
const opf=(path,pre)=>ofield(path,OF[path],pre);
const osf=(s,f,pre)=>ofield(`st.${s.id}.${f}`,SF[f],pre);
function syncO(skip){document.querySelectorAll("[data-op]").forEach(el=>{if(el===skip)return;const v=getP(el.dataset.op);
    if(el.dataset.onum){if(document.activeElement===el)return;el.value=(v===""||v===undefined||v===null)?"":fmtIn(+v);}
    else el.value=v===undefined||v===null?"":v;});
  document.querySelectorAll("[data-osrc]").forEach(c=>{const s=srcOf(c.dataset.osrc);c.className="srcchip "+s;c.textContent=SRCNAME[s]||s;});
  document.querySelectorAll(".ocs").forEach(c=>c.textContent=osym());}
document.addEventListener("input",e=>{const i=e.target;const p=i.dataset&&i.dataset.op;if(!p||i.tagName==="SELECT")return;oSetFromInput(i,p);});
document.addEventListener("change",e=>{const i=e.target;const p=i.dataset&&i.dataset.op;if(p&&i.tagName==="SELECT"){oSetFromInput(i,p);return;}});
document.addEventListener("focusout",e=>{const i=e.target;if(i.dataset&&i.dataset.onum){const v=getP(i.dataset.op);i.value=(v===""||v===undefined)?"":fmtIn(+v);}});
function oSetFromInput(i,p){
  if(!i.dataset.onum){setP(p,i.value);}
  else{if(i.value.trim()===""&&i.dataset.oblank){setP(p,"");}else{const v=parseIn(i.value);if(!isFinite(v))return;setP(p,v);}}
  if(srcable(p)){const s=srcOf(p);if(s==="example"||s==="ai")setSrc(p,"estimated");}
  if(p==="cur")oBuildAll();
  syncO(i);opsRender();opsSave();}

/* ---------- guided steps ---------- */
const OSTEPS=[["process","Process"],["steps","Steps"],["numbers","Numbers"],["diagnosis","Diagnosis"],["cause","Cause & fix"],["scenarios","Fixes"],["summary","Action plan"],["ai","Explanation"]];
const TABMAP={map:"steps",data:"numbers",issues:"diagnosis",diagnose:"diagnosis",rca:"cause",cost:"cause",improve:"scenarios",fix:"scenarios",centre:"summary"};
const DETMAP={issues:"odd-issues",rca:"odd-rca",cost:"odd-cost"};
const oIdx=k=>OSTEPS.findIndex(x=>x[0]===k);
function oProg(){const cur=oIdx(OTAB),far=Math.max(O.furthest||0,cur);
  $("oprog").innerHTML=OSTEPS.map(([k,l],i)=>`<button type="button" class="ost${i===cur?" cur":""}${i<cur?" done":""}" data-ostep="${k}" ${i>far?"disabled":""} ${i===cur?'aria-current="step"':""}><span class="n">${i<cur?"✓":i+1}</span><span class="l">${l}</span></button>`).join("");}
function opsGo(t0,noScroll){const t=TABMAP[t0]||t0;if(oIdx(t)<0)return;OTAB=t;O.step=t;O.furthest=Math.max(O.furthest||0,oIdx(t));
  OSTEPS.forEach(([k])=>{$("op-"+k).hidden=k!==t;});oProg();opsSave();
  if(DETMAP[t0])setTimeout(()=>{const d=$(DETMAP[t0]);if(d){d.open=true;d.scrollIntoView({behavior:"smooth",block:"start"});}},60);
  else if(!noScroll&&!$("ops").hidden)setTimeout(()=>{const a=$("oapp");if(a&&a.getBoundingClientRect().top<0)a.scrollIntoView({behavior:"smooth",block:"start"});},0);
  setTimeout(opsRender,0);}
const STEP_TYP={time:5,tmin:3,tmax:10,staff:1,machines:0,stations:0,hours:8,err:2,rwShare:100,rwMin:10,delay:5,delayMin:30,wait:"",cancel:0,labour:14,machCost:0,other:0};
function oEnsureTyp(){O.steps.forEach(s=>{if(!s.typ){s.typ={};OPS_STEP_FIELDS.forEach(f=>s.typ[f]=s[f]);}});
  if(!O.typ){O.typ={};OPS_PROC_FIELDS.forEach(f=>O.typ[f]=O[f]);}
  if(!O.numSel||!oStep(O.numSel))O.numSel=(O.steps[0]||{}).id;}

/* ---------- builders (inputs; rebuilt only when structure changes) ---------- */
const OCARDS=[["ecom","Getting orders out the door","Online shop: from order to parcel"],["rest","Serving food on time","Restaurant or takeaway orders"],["support","Answering customer queries","Support tickets and emails"],["invoice","Paying supplier invoices","Accounts payable"],["recruit","Hiring people","From application to offer"],["mfg","Making products","Assembly or production line"],["wh","Picking and shipping stock","Warehouse order picking"],["onboard","Getting new customers live","Onboarding after a sale"],["blank","Something else","Build my own from scratch"]];
function oBuildCards(){const on=k=>O.picked&&O.tpl===k;
  $("ocards").innerHTML=OCARDS.map(([k,t,d])=>`<button type="button" class="ocardp${on(k)?" on":""}" data-ocard="${k}" aria-pressed="${on(k)}"><b>${t}</b><span>${d}</span>${on(k)?'<em>✓ Selected</em>':""}</button>`).join("");
  $("onext-1").disabled=!O.picked;}
function oBuildAbout(){$("o-about").innerHTML=[["biz.name",{l:"Business name",t:"text"}],["proc.name",{l:"What you call this process",t:"text"}],["biz.location",{l:"Where you're based",t:"text"}],["cur",OF.cur]].map(([p,d])=>ofield(p,d,"ab")).join("");}
function typBtn(path,val,unit){if(val===""||val===undefined||val===null)return"";const v=unit==="money"?om2(+val):onum(+val,(+val)%1?1:0)+(unit==="pct"?"%":unit==="min"?" min":unit==="hrs"?" h":"");
  return`<button type="button" class="otyp" data-otyp="${path}">Not sure? Use a typical number (${v})</button>`;}
function oq(path,label,help,unit,typ){return`<div class="oq">${ofield(path,{l:label,h:help,u:unit,blank:/\.(wait|tmin|tmax)$/.test(path)},"nq")}${typBtn(path,typ,unit)}</div>`;}
function oBuildMoney(){const T=O.typ||{};
  $("o-money").innerHTML=oq("demand","How many come in on a typical day?","Orders, tickets, invoices: whatever moves through the process","num",T.demand)+
    oq("margin","How much profit does each one make?","After the cost of making or delivering it. Used for lost profit","money",T.margin)+
    oq("revenue","How much does a customer pay for each one?","Leave 0 if not relevant","money",T.revenue);
  $("o-money2").innerHTML=oq("days","Working days a month","","num",T.days)+oq("otRate","Overtime cost per hour","","money",T.otRate)+oq("otMax","Most overtime per person a day","Hours. Work beyond this is lost","hrs",T.otMax)+oq("delayCost","Cost of a delay, per item per hour","Penalties, chasing, customer credits","money",T.delayCost);}
function oBuildSteps(){$("osteps").innerHTML=`<h3>Your steps</h3><div class="oslist">${O.steps.map((s,i)=>`<div class="osrow${s.id===O.sel?" sel":""}" data-osrow="${s.id}">
    <span class="osn">${i+1}</span><div class="osf"><input type="text" data-op="st.${s.id}.name" aria-label="Step ${i+1} name" class="osname" autocomplete="off"><input type="text" data-op="st.${s.id}.desc" aria-label="Step ${i+1} description" placeholder="What happens here? (optional)" class="osdesc" autocomplete="off"></div>
    <div class="osb"><button type="button" class="pill sm ghost" data-ostmove="-1" data-id="${s.id}" ${i===0?"disabled":""} aria-label="Move up">↑</button><button type="button" class="pill sm ghost" data-ostmove="1" data-id="${s.id}" ${i===O.steps.length-1?"disabled":""} aria-label="Move down">↓</button><button type="button" class="pill sm ghost" data-ostdel="${s.id}" ${O.steps.length<2?"disabled":""}>${oPendStepDel===s.id?"Tap again":"Remove"}</button></div></div>`).join("")}</div>
  <div class="row"><button class="pill sm" type="button" data-oadd="end">+ Add a step</button><span class="small muted">${O.steps.length} step${O.steps.length===1?"":"s"}</span></div>`;}
function oBuildNumbers(){oEnsureTyp();const s=oStep(O.numSel)||O.steps[0];if(!s)return;O.numSel=s.id;s.seen=true;const i=O.steps.indexOf(s),n=O.steps.length,T=s.typ||STEP_TYP;
  $("ochips").innerHTML=O.steps.map((x,j)=>`<button type="button" role="tab" class="ochip${x.id===s.id?" on":""}" data-onumsel="${x.id}" aria-selected="${x.id===s.id}"><span>${x.seen&&x.id!==s.id?"✓":j+1}</span><i>${esc(x.name)}</i></button>`).join("");
  const q=(f,l,h,u)=>oq(`st.${s.id}.${f}`,l,h,u,T[f]);
  $("onum-step").innerHTML=`<div class="row"><h3>Step ${i+1} of ${n}: <span data-oname="${s.id}">${esc(s.name)}</span></h3></div>
   <div class="oqs">${q("time","How long does one item take here?","Average, in minutes","min")}${q("staff","How many people work on this step?","0 if it's fully automated","num")}
    ${q("machines","How many machines does it use?","0 if none","num")}${q("stations","How many workstations or desks?","Each needs a person. 0 if not relevant","num")}
    ${q("hours","How many hours a day does this step run?","","hrs")}${q("err","How often does something go wrong here?","Percent of items that need fixing","pct")}
    ${q("delay","How often are items held up here?","Percent of items","pct")}${q("delayMin","When they're held up, for how long?","Minutes on average","min")}
    ${q("cancel","Do any items drop out here?","Percent cancelled or rejected","pct")}</div>
   <details class="more" id="onum-more"${oEditMore?" open":""}><summary>More detail (optional): time range, rework, waiting and costs</summary><div class="oqs" style="margin-top:12px">
    ${q("tmin","Fastest it's ever done","Minutes","min")}${q("tmax","Slowest it takes","Minutes","min")}${q("rwShare","Of the mistakes, how many get fixed?","Percent. The rest are thrown away","pct")}${q("rwMin","How long does a fix take?","Minutes","min")}
    ${q("wait","How long do items usually wait here?","Minutes. Leave blank and we'll estimate it","min")}<div class="oq">${ofield(`st.${s.id}.exitLabel`,{l:"What happens to items that drop out?",h:"For example \"Payment rejected\"",t:"text"},"nq")}</div>
    ${q("labour","Labour cost per hour","","money")}${q("machCost","Machine cost per hour","","money")}${q("other","Other cost per item","Packaging, postage, materials","money")}</div></details>
   <p class="calcline" id="onum-calc"></p>
   <div class="onav sub">${i>0?`<button class="pill ghost" type="button" data-onumgo="-1">← ${esc(O.steps[i-1].name)}</button>`:"<span></span>"}
    ${i<n-1?`<button class="pill" type="button" data-onumgo="1">Next step: ${esc(O.steps[i+1].name)} →</button>`:`<span class="odone">✓ That's every step. Nice work, the hard part's done.</span>`}</div>`;}
function oBuildWeights(){$("obnw").innerHTML=Object.keys(OPS_BN_W).map(k=>opf("bnW."+k,"wb")).join("")+`<button class="pill sm ghost" type="button" data-oreset="bnW" style="align-self:flex-start">Reset weights</button>`;
  $("othr").innerHTML=["thresh.low","thresh.healthy","thresh.high"].map(p=>opf(p,"th")).join("");
  $("ohw").innerHTML=Object.keys(OPS_H_W).map(k=>opf("hW."+k,"wh")).join("")+`<button class="pill sm ghost" type="button" data-oreset="hW" style="align-self:flex-start">Reset weights</button>`;}
function oBuildObjective(){$("oobj").innerHTML=OPS_OBJECTIVES.map(([k,l])=>`<button type="button" data-oobj="${k}" aria-pressed="${O.objective===k}">${l}</button>`).join("");
  $("oscadd").innerHTML=Object.entries(OPS_SC_KINDS).map(([k,v])=>`<button type="button" class="pill sm ghost" data-oscadd="${k}">+ ${v.label}</button>`).join("");}
function oSameIdea(a,b){if(a.kind!==b.kind||(a.step||"")!==(b.step||""))return false;if(a.kind==="sequence")return +a.to===+b.to;if(a.kind==="custom")return a.field===b.field&&a.op===b.op&&+a.value===+b.value;return true;}
function oDupOf(sc,list){list=list||O.scenarios;const i=list.findIndex(x=>x!==sc&&x.id!==sc.id&&oSameIdea(x,sc));const me=list.indexOf(sc);return i>=0&&(me<0||i<me)?i:-1;}
function oScMsg(html){const m=$("oscmsg");if(!m)return;if(!html){m.hidden=true;m.innerHTML="";return;}m.hidden=false;m.innerHTML=html;}
function oWhySame(e,C){const T0=C.totals,T1=e.C.totals;if(Math.abs(T1.throughput-T0.throughput)>=Math.max(0.05,T0.throughput*0.005))return"";
  const st=e.sc.step?oStep(e.sc.step):null;const sn=st?esc(st.name):"this step";const cons=e.C.constraint;let t;
  if(e.sc.kind==="machine"&&st&&!(+st.machines>0)&&!(+st.stations>0))t=`${sn} doesn't use machines or workstations, so adding one changes nothing here.`;
  else if(e.sc.kind==="staff"&&st&&opsAutomated(st))t=`${sn} runs without people, so an extra person doesn't change it.`;
  else if(e.shifted)t=`${esc(e.from.name)} is no longer the hold-up, but <b>${esc(e.to.name)}</b> now limits you to about ${ov(T1.throughput)} ${vu()}. To finish more, ${esc(e.to.name)} needs a fix too.`;
  else if(C.constraint&&C.constraint.util<1)t=`You already finish everything that comes in, so this shows up as ${e.monthlyBenefit>0?"savings":"cost"}, not more output.`;
  else if(cons&&st&&cons.id!==st.id)t=`<b>${esc(cons.name)}</b> is what limits your output, not ${sn}, so output stays the same.`;
  else t=`This change isn't big enough to lift ${cons?esc(cons.name):sn}'s limit, so output stays the same.`;
  return`<p class="small oscwhy"><b>Why output doesn't change:</b> ${t}</p>`;}
const CUSTOM_FIELDS=["time","staff","machines","stations","hours","err","rwShare","rwMin","delay","delayMin","cancel","labour","machCost"];
function oBuildScenarios(){$("osc").innerHTML=O.scenarios.map((sc,idx)=>{const L=String.fromCharCode(65+idx);
  const stepSel=`<div class="field text"><label for="osc-st-${sc.id}">Step</label><select id="osc-st-${sc.id}" data-op="sc.${sc.id}.step">${sc.kind==="variability"?'<option value="">Whole process</option>':""}${O.steps.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>`;
  let extra="";
  if(sc.kind==="sequence")extra=`<div class="field text"><label for="osc-to-${sc.id}">Move to position</label><select id="osc-to-${sc.id}" data-op="sc.${sc.id}.to">${O.steps.map((s,i)=>`<option value="${i}">${i+1}${i===0?" (first)":i===O.steps.length-1?" (last)":""}</option>`).join("")}</select></div>`;
  if(sc.kind==="custom")extra=`<div class="field text"><label for="osc-f-${sc.id}">What to change</label><select id="osc-f-${sc.id}" data-op="sc.${sc.id}.field">${CUSTOM_FIELDS.map(f=>`<option value="${f}">${SF[f].l}</option>`).join("")}</select></div>
    <div class="field text"><label for="osc-o-${sc.id}">How</label><select id="osc-o-${sc.id}" data-op="sc.${sc.id}.op"><option value="pct">Change by %</option><option value="add">Add</option><option value="set">Set to</option></select></div>${ofield(`sc.${sc.id}.value`,SF.value,"sc")}`;
  return`<div class="card osc" id="osc-${sc.id}"><button class="oscx" type="button" data-oscdel="${sc.id}" aria-label="Remove idea ${L}" title="Remove this idea">×</button><div class="row oschead"><span class="chip in">${L}</span><textarea rows="1" class="scname" data-op="sc.${sc.id}.name" aria-label="Idea ${L} name"></textarea></div><div class="oscdup" id="osc-d-${sc.id}" hidden></div>
   <p class="small muted">${esc(OPS_SC_KINDS[sc.kind].desc)}</p><div class="fields">${sc.kind==="variability"?"":stepSel}${extra}${ofield(`sc.${sc.id}.investment`,SF.investment,"sc")}${ofield(`sc.${sc.id}.monthlyCost`,SF.monthlyCost,"sc")}</div>
   <div id="osc-r-${sc.id}" class="oscres"></div></div>`;}).join("")||`<div class="card"><p class="muted">No scenarios yet. Add one above.</p></div>`;
  $("oba-sel").innerHTML=O.scenarios.map((sc,i)=>`<option value="${sc.id}">${String.fromCharCode(65+i)}. ${esc(sc.name)}</option>`).join("");
  if(!O.scenarios.some(s=>s.id===O.baSel))O.baSel="";}
const RCA_CATS={People:["Insufficient staffing","Skill gaps","Training","Absence","Poor allocation"],Process:["Too many steps","Manual approvals","Duplicate work","Poor handoffs","Unclear responsibilities"],
  Technology:["Slow software","System downtime","Manual data entry","Integration issues"],Equipment:["Machine or workstation capacity","Downtime","Maintenance","Reliability"],
  Demand:["Volume spikes","Seasonal demand","Poor forecasting"],Quality:["Errors","Rework","Defects"],External:["Supplier delays","Regulatory requirements","Third-party dependencies"]};
function rcaFor(id){O.rca=O.rca||{};if(!O.rca[id])O.rca[id]={status:{},custom:[],whys:["","","","",""],problem:""};return O.rca[id];}
function oBuildRca(){const sel=$("orca-step");if(!O.rcaStep||!oStep(O.rcaStep)){OC=OC||opsCalc(O);O.rcaStep=(OC.primary||OC.steps[0]||{}).id;}
  sel.innerHTML=O.steps.map(s=>`<option value="${s.id}"${s.id===O.rcaStep?" selected":""}>${esc(s.name)}</option>`).join("");
  const R=rcaFor(O.rcaStep);
  $("orca-prob").value=R.problem||"";
  $("orca-whys").innerHTML=R.whys.map((w,i)=>`<div class="field text" style="grid-template-columns:70px minmax(0,1fr)"><label for="orca-w${i}">Why ${i+1}?</label><input id="orca-w${i}" type="text" data-orca="why${i}" value="${esc(w)}" placeholder="${i===0?"Because…":"And why is that?"}"></div>`).join("");
  $("orca-cats").innerHTML=Object.entries(RCA_CATS).map(([cat,items])=>`<div class="cat"><h4>${cat}</h4>${items.map(it=>{const k=cat+"|"+it;return`<div class="cause" data-orow="${esc(k)}"><span>${esc(it)} <span data-osug="${esc(k)}"></span></span>${stSel(R.status[k]||"",`data-orcas="${esc(k)}"`)}</div>`;}).join("")}
    ${R.custom.filter(c=>c.cat===cat).map(c=>`<div class="cause"><span>${esc(c.text)} ${c.src==="ai"?'<span class="chip ai">AI suggestion</span>':'<span class="chip in">Yours</span>'}</span><span class="row" style="gap:4px">${stSel(c.status,`data-orcac="${c.id}"`)}<button class="linkbtn" type="button" data-orcadel="${c.id}" aria-label="Remove">×</button></span></div>`).join("")}</div>`).join("");
  $("orca-newcat").innerHTML=Object.keys(RCA_CATS).map(c=>`<option>${c}</option>`).join("");}
function stSel(v,attr){return`<select ${attr} aria-label="Status"><option value=""${!v?" selected":""}>Not checked</option><option value="suspected"${v==="suspected"?" selected":""}>Suspected</option><option value="confirmed"${v==="confirmed"?" selected":""}>Confirmed</option><option value="ruled"${v==="ruled"?" selected":""}>Ruled out</option></select>`;}
function oBuildAll(){oEnsureTyp();oBuildCards();oBuildAbout();oBuildMoney();oBuildSteps();oBuildNumbers();oBuildWeights();oBuildObjective();oBuildScenarios();oBuildRca();syncO();}

/* ---------- model-based helpers ---------- */
const stKey=st=>({Low:"low",Healthy:"ok",High:"high",Overloaded:"over"}[st]);
function oCapLine(r){if(r.par<=0&&+r.s.stations>0&&!(+r.s.staff>0))return"Workstations but nobody to work them, so no capacity. Add employees.";return r.par>0?`${onum(r.par)} at a time${(+r.s.staff||0)>r.par?` (${onum(+r.s.staff)} people, limited by ${(+r.s.stations>0&&+r.s.stations===r.par)?"workstations":"machines"})`:""} × ${onum(r.hours,1)} h × 60 ÷ ${onum(r.load,2)} min per unit${r.load>r.time?" (incl. rework)":""} = <b>${onum(r.cap)} units a day</b>`:"No people or machines, so no capacity";}
function oObserved(r,C){const L=[];const T=O.thresh;
  if(r.util>T.high/100)L.push(`Running at ${opct(r.util)} of capacity: ${ov(r.inU)} units arrive ${vu()} but it can handle ${ov(r.cap)}.`);
  else if(r.util>=T.healthy/100)L.push(`Very busy at ${opct(r.util)} of capacity, so queues build quickly.`);
  if(r.dropped>0.01)L.push(`Even with overtime, about ${ov(r.dropped)} units ${vu()} can't be processed.`);
  if(r.otHours>0.01)L.push(`Needs about ${onum(r.otHours*vf(),1)} hours of overtime ${vu()}.`);
  if(C.totals.waitTime>0&&r.waitShare>=0.2)L.push(`Accounts for ${opct(r.waitShare)} of all waiting time in the process.`);
  if(r.delay>=0.08)L.push(`${opct(r.delay)} of units are delayed here, by ${omin(r.delayMin)} on average.`);
  if(r.err>=0.03)L.push(`${opct(r.err,1)} error rate, creating ${onum(r.reworkHours*vf(),1)} hours of rework ${vu()}.`);
  if(r.cancel>=0.02)L.push(`${opct(r.cancel,1)} of units leave here (${esc(r.s.exitLabel||"cancelled")}).`);
  if((+r.s.staff||0)>r.par&&r.par>0)L.push(`${onum(+r.s.staff)} people but only ${onum(r.par)} can work at once.`);
  if(r.cs>0.3&&r.s.tmin!==""&&r.s.tmax!=="")L.push(`Processing time varies a lot (${omin(+r.s.tmin)} to ${omin(+r.s.tmax)}).`);
  return L.length?L:["No obvious problems in the data for this step."];}
function oSuggested(r){const S=new Set();
  if(r.util>=1){if((+r.s.staff||0)>r.par&&r.par>0){S.add("Equipment|Machine or workstation capacity");S.add("People|Poor allocation");}else S.add("People|Insufficient staffing");S.add("Demand|Poor forecasting");}
  else if(r.util>=0.85)S.add("Demand|Volume spikes");
  if(r.err>=0.03){S.add("Quality|Errors");S.add("Quality|Rework");S.add("People|Training");}
  if(r.delay>=0.08){S.add("Process|Poor handoffs");if(r.delayMin>=240)S.add("External|Third-party dependencies");}
  if(r.cancel>=0.02)S.add("Process|Manual approvals");
  if(r.cs>0.3&&r.s.tmin!==""&&r.s.tmax!=="")S.add("Process|Unclear responsibilities");
  return S;}
function oWarnings(C){const W=[];const all=[];O.steps.forEach(s=>OPS_STEP_FIELDS.forEach(f=>{if(f!=="wait")all.push((s.src||{})[f]||"example");}));OPS_PROC_FIELDS.forEach(f=>all.push((O.src||{})[f]||"example"));
  const share=x=>all.filter(s=>s===x).length/(all.length||1);
  const weak=share("example")+share("ai");
  if(weak>0.5)W.push(["Most of your numbers are example or AI-generated values ("+opct(weak)+"). Treat the diagnosis as a demonstration until you replace them.","numbers","osec-dataopt"]);
  const p=C.primary;if(p&&!["actual"].includes((p.s.src||{}).time))W.push([`Your bottleneck diagnosis is based on ${SRCNAME[(p.s.src||{}).time||"example"].toLowerCase()} processing times for ${esc(p.name)}, not actual historical data.`,"numbers","onum"]);
  if(!(+O.revenue>0))W.push(["The cost estimate doesn't include lost customer revenue because revenue per unit hasn't been provided.","numbers","osec-money"]);
  if(!(+O.margin>0))W.push(["Lost contribution isn't counted because contribution per unit hasn't been provided.","numbers","osec-money"]);
  if(O.steps.every(s=>s.wait===""||s.wait===undefined))W.push(["Queue analysis uses estimated waiting times because average waiting time hasn't been provided for any step.","numbers","onum"]);
  if(O.steps.some(s=>s.tmin===""||s.tmax===""))W.push(["Some steps have no fastest or slowest time, so variability is assumed. That affects the waiting time estimates.","numbers","onum"]);
  if(C.totals.growing)W.push(["At least one step can't keep up even with overtime, so its queue grows every day. Waiting times shown there are day-one averages.","diagnose","odd-time"]);
  return W;}
function oDataMix(){const all=[];O.steps.forEach(s=>OPS_STEP_FIELDS.forEach(f=>{if(f!=="wait")all.push((s.src||{})[f]||"example");}));OPS_PROC_FIELDS.forEach(f=>all.push((O.src||{})[f]||"example"));
  const c=k=>all.filter(s=>s===k).length/(all.length||1);return{actual:c("actual"),estimated:c("estimated"),example:c("example")+c("ai")};}

/* ---------- map ---------- */
function oMapHTML(C,mode){const mini=mode==="mini";
  if(mode==="plain")return`<span class="ocap">START</span>`+C.steps.map(r=>`<span class="oarrow" aria-hidden="true">→</span><div class="onode-wrap"><button type="button" class="onode plainnode${r.id===O.sel?" sel":""}" data-onode="${r.id}"><span class="on-n">Step ${r.i+1}</span><b>${esc(r.name)}</b>${r.s.desc?`<span class="on-meta">${esc(r.s.desc)}</span>`:""}</button>${r.cancel>0?`<span class="on-br">↳ ${esc(r.s.exitLabel||"Exit")}</span>`:""}</div>`).join("")+`<span class="oarrow" aria-hidden="true">→</span><span class="ocap">END</span>`;
  const p=C.primary,c=C.constraint;
  return`<span class="ocap">START</span>`+C.steps.map(r=>{const bn=p&&r.id===p.id,lim=c&&r.id===c.id&&!bn&&c.util>=O.thresh.healthy/100;
    return`<span class="oarrow" aria-hidden="true">→</span><div class="onode-wrap"><button type="button" class="onode st-${stKey(r.status)}${bn?" bn":""}${!mini&&r.id===O.sel?" sel":""}" data-onode="${r.id}" style="--sev:${bn?Math.max(0.5,r.score/10):0}" aria-label="${esc(r.name)}, ${opct(r.util)} busy${bn?", primary bottleneck":""}">
      ${bn?'<span class="on-bn">Bottleneck</span>':lim?'<span class="on-bn lim">Least spare capacity</span>':""}<span class="on-n">Step ${r.i+1}</span><b>${esc(r.name)}</b><span class="on-u">${opct(r.util)}</span>
      <span class="on-cap">${ov(r.cap)} / ${ov(r.inU)} ${vu()}</span><span class="on-meta">${onum(r.par)} at a time · errors ${opct(r.err,1)} · delays ${opct(r.delay)}</span></button>
      ${r.cancel>0?`<span class="on-br">↳ ${esc(r.s.exitLabel||"Exit")}: ${opct(r.cancel,1)} leave</span>`:""}</div>`;}).join("")+`<span class="oarrow" aria-hidden="true">→</span><span class="ocap">END</span>`;}

/* ---------- render (outputs only) ---------- */
function opsRender(){if($("ops").hidden&&!OPS_TUT)return;
  OC=opsCalc(O);OR=opsRecommend(O,OC);const C=OC;
  document.querySelectorAll("[data-oname]").forEach(e=>{const s=oStep(e.dataset.oname);if(s)e.textContent=s.name;});
  oProg();if($("onext-1"))$("onext-1").disabled=!O.picked;
  if(!oResumeShown&&!OPS_TUT){oResumeShown=true;if((O.furthest||0)>0&&O.picked){$("oresume").hidden=false;$("oresume").innerHTML=`<p><b>Welcome back.</b> We've kept your progress on ${esc(O.proc.name||"your process")}.</p><div class="row"><button class="pill sm" type="button" data-oresume="1">Carry on</button><button class="pill sm ghost" type="button" data-orestart="1">Start a new analysis</button></div>`;}}
  $("omap").innerHTML=oMapHTML(C,"plain");$("omap4").innerHTML=oMapHTML(C,"full");$("omini").innerHTML=oMapHTML(C,"mini");
  document.querySelectorAll("#ochips [data-onumsel]").forEach(b=>{const x=oStep(b.dataset.onumsel);const it=b.querySelector("i");if(x&&it)it.textContent=x.name;});
  const ns=C.steps.find(r=>r.id===O.numSel);if(ns&&$("onum-calc"))$("onum-calc").innerHTML=ns.par>0?`With these numbers, this step can handle about <b>${onum(ns.cap)} items a day</b> (${oCapLine(ns)}).`:oCapLine(ns);
  oRenderHero(C);oRenderIssues(C);oRenderDiagnose(C);oRenderQuick(C);oRenderRca(C);oRenderCost(C);oRenderCause(C);oRenderImprove(C);oRenderCentre(C);oRenderPlan(C);
  if(typeof OPS_TOUR_HOOK==="function")OPS_TOUR_HOOK();}

function oAnswer(C){const p=C.primary,T=C.totals;if(!p)return{h:"Add a step to start.",s:""};const cost=om(md(T.impact));
  if(p.util>1)return{h:`<b>${esc(p.name)}</b> is holding you back.`,s:`It can handle about ${onum(p.cap)} a day but ${onum(p.inU)} arrive, so work piles up. Inefficiency is costing about <b>${cost} a month</b>.`};
  if(p.util>=O.thresh.healthy/100)return{h:`<b>${esc(p.name)}</b> is your tightest step.`,s:`It's ${opct(p.util)} busy, so queues build up there. Inefficiency is costing about <b>${cost} a month</b>.`};
  return{h:`Good news: no step is overloaded.`,s:`Your biggest issue is <b>${esc(p.name)}</b>. Inefficiency is costing about <b>${cost} a month</b>.`};}
function healthWord(h){return h>=75?["Healthy","go"]:h>=50?["Fair","in"]:h>=30?["Strained","stop"]:["Critical","stop"];}
function oRenderHero(C){const a=oAnswer(C),p=C.primary,h=Math.round(C.health),w=healthWord(h);
  $("odiag-hero").innerHTML=`<div class="oh-score"><span class="oh-n">${h}</span><span class="oh-of">/ 100</span><span class="chip ${w[1]}">${w[0]}</span><small>Process health score</small></div>
   <div class="oh-txt"><p class="oa-h">${a.h}</p><p class="oa-s">${a.s}</p>${p?`<p class="small muted">Bottleneck score ${p.score.toFixed(1)} out of 10 (${p.severity.toLowerCase()}). <button class="linkbtn" type="button" data-ojump="diagnosis:odd-rank">Why?</button></p>`:""}</div>`;
  $("odiag-lead").textContent=h>=75?"Your process is in good shape. Here's where you could still improve.":"Here's what your numbers say, and where to focus first.";}
function oMainCause(r,C){const R=rcaFor(r.id);const conf=Object.entries(R.status).filter(([k,v])=>v==="confirmed").map(([k])=>k.split("|")[1]).concat(R.custom.filter(c=>c.status==="confirmed").map(c=>c.text));
  let t,d;const st=+r.s.staff||0;
  if(r.util>1&&st>r.par&&r.par>0){const lim=(+r.s.stations>0&&+r.s.stations===r.par)?"workstations":"machines";t=`Not enough ${lim} for the people you have`;d=`${onum(st)} people work at ${esc(r.name)}, but there are only ${onum(r.par)} ${lim}, so only ${onum(r.par)} can work at once. That caps the step at about ${onum(r.cap)} a day, below the ${onum(r.inU)} that arrive.`;}
  else if(r.util>1){t=`Not enough capacity at ${esc(r.name)}`;d=`About ${onum(r.inU)} items arrive a day, but with ${onum(r.par)} working at once for ${onum(r.hours,1)} hours, the step can only handle about ${onum(r.cap)}.`;}
  else if(r.err>=0.05){t=`Too many mistakes at ${esc(r.name)}`;d=`${opct(r.err,1)} of items need fixing, which uses about ${onum(r.reworkHours,1)} hours a day that could be spent on new work.`;}
  else if(r.delay>=0.1){t=`Items get held up at ${esc(r.name)}`;d=`${opct(r.delay)} of items are delayed by about ${omin(r.delayMin)}, often a sign of poor hand-offs or waiting on someone else.`;}
  else{t=`${esc(r.name)} is the busiest step`;d=`At ${opct(r.util)} busy, there's little slack, so any spike in demand turns into a queue.`;}
  return{t,d,conf};}
function oFixWhen(e){return e.inv===0?"Straight away":e.payback<1?"In under a month":"In about "+onum(e.payback,1)+" months";}
function oRenderCause(C){const p=C.primary;if(!p){$("ocause").innerHTML="";$("ofix").innerHTML="";return;}const m=oMainCause(p,C);
  $("ocause").innerHTML=`<span class="eyebrow" style="background:var(--stop-soft)">Most likely cause</span><h3>${m.t}</h3><p>${m.d}</p>
   ${m.conf.length?`<p class="small"><span class="chip go">You confirmed</span> ${m.conf.map(esc).join(", ")}</p>`:`<p class="small muted">Based on your numbers. Check it against what you see day to day.</p>`}
   <button class="linkbtn" type="button" data-ojump="cause:odd-rca" style="align-self:flex-start">Not quite right? Explore other causes</button>`;
  const e=OR.best;$("ofix").classList.toggle("has-fix",!!e);
  if(!e){$("ofix").innerHTML=`<span class="eyebrow" style="background:var(--sunk)">What we'd try first</span><h3>None of the quick fixes pays back yet</h3><p>That's useful to know before spending money. In the next step you can test other ideas, such as a cheaper fix or fewer mistakes at ${esc(p.name)}.</p><button class="pill" type="button" data-onext="1" style="align-self:flex-start">Compare fixes →</button>`;return;}
  const st=e.sc.step&&oStep(e.sc.step)?oStep(e.sc.step).name:"";const T0=C.totals,T1=e.C.totals;
  $("ofix").innerHTML=`<span class="eyebrow" style="background:var(--go-soft)">What we'd try first</span><h3>${esc(e.sc.name)}${st?` at ${esc(st)}`:""}</h3>
   <p>${T1.throughput>T0.throughput+0.01?`You'd finish about ${onum(T1.throughput)} a day instead of ${onum(T0.throughput)}. `:""}${T1.impact<T0.impact?`Inefficiency would fall from ${om(md(T0.impact))} to ${om(md(T1.impact))} a month.`:""}</p>
   <div class="cl"><span>Saves you each month</span><b class="pos">${om(e.monthlyBenefit)}</b><span>Costs to do</span><b>${e.inv?om(e.inv):"Nothing upfront"}</b><span>Pays for itself</span><b>${oFixWhen(e)}</b></div>
   ${e.shifted?`<p class="small">Heads up: after this, <b>${esc(e.to.name)}</b> becomes the busiest step, so look at it next.</p>`:""}
   <button class="pill" type="button" data-onext="1" style="align-self:flex-start">Compare this with other fixes →</button>`;}
function oRenderPlan(C){const p=C.primary,T=C.totals,e=OR.best;if(!p){$("osum-plan").innerHTML="";return;}const m=oMainCause(p,C);const h=Math.round(C.health),w=healthWord(h);
  const card=(n,t,b)=>`<div class="card oplanc"><span class="opn">${n}</span><h3>${t}</h3>${b}</div>`;
  const fixAt=e&&e.sc.step&&oStep(e.sc.step)?` at ${esc(oStep(e.sc.step).name)}`:"";
  const nxt=[`Time ${esc(p.name)} for a few days to check the numbers, especially any marked Example.`];
  if(e)nxt.push(`Get a quote or a plan for: ${esc(e.sc.name.toLowerCase())}${fixAt}.`);
  if(e&&e.shifted)nxt.push(`Keep an eye on ${esc(e.to.name)}: it becomes the busiest step after the fix.`);
  nxt.push("Come back after the change and update your numbers to see if it worked.");
  $("osum-plan").innerHTML=card(1,"The problem",`<p><b>${esc(p.name)}</b> is your bottleneck (${p.score.toFixed(1)}/10). Process health is <b>${h}/100</b> <span class="chip ${w[1]}">${w[0]}</span>.</p>`)+
    card(2,"What it costs",`<p>About <b>${om(md(T.impact))} a month</b> in delays, rework, overtime and lost profit.</p>${T.revenueOpp>0?`<p class="small muted">Separately, about ${om(md(T.revenueOpp))} a month of sales are missed.</p>`:""}`)+
    card(3,"Why",`<p><b>${m.t}.</b> ${m.d}</p>`)+
    card(4,"What to do",e?`<p><b>${esc(e.sc.name)}</b>${fixAt}. Saves about <b>${om(e.monthlyBenefit)} a month</b>${e.inv?`, and pays for itself ${oFixWhen(e).toLowerCase()}`:" with no upfront cost"}.</p>`:`<p>None of the tested fixes pays back yet. Try other ideas in step 6.</p>`)+
    `<div class="card oplanc wide"><h3>Your next steps</h3><ol class="onext">${nxt.map(x=>`<li>${x}</li>`).join("")}</ol></div>`;}
function oRenderQuick(C){const T=C.totals;const big=[["overtime",T.otCost],["delays",T.delayCost],["rework",T.reworkCost],["lost orders",T.lostContrib]].sort((a,b)=>b[1]-a[1]).filter(x=>x[1]>0);
  const mix=oDataMix();const W=oWarnings(C);
  const row=(icon,txt,j)=>`<div class="oq"><span class="oq-i">${icon}</span><p class="small">${txt}</p><button class="linkbtn" type="button" data-ojump="${j}">Details</button></div>`;
  $("oquick").innerHTML=row("⏱",`Each unit takes <b>${omin(T.lead)}${T.growing?"+":""}</b> from start to finish, and <b>${opct(T.waitShare)}</b> of that is waiting or delays.`,"diagnose:odd-time")+
    row("£",`Inefficiency costs <b>${om(md(T.impact))} a month</b>${big.length?`, mostly ${big.slice(0,2).map(x=>`${x[0]} (${om(md(x[1]))})`).join(" and ")}`:""}.`,"diagnose:odd-cost")+
    row("✕",`<b>${opct(T.errorRate,1)}</b> of units have an error, creating <b>${onum(md(T.reworkHours))} hours</b> of rework a month.`,"diagnose:odd-issues")+
    row("i",`Your numbers are ${opct(mix.actual)} actual, ${opct(mix.estimated)} estimated and ${opct(mix.example)} example.${W.length?` ${W.length} data warning${W.length>1?"s":""}.`:""}`,"diagnose:odd-dq");
  $("odq-sum").textContent=W.length?`${W.length} warning${W.length>1?"s":""}`:"No warnings";
  const over=C.steps.filter(r=>r.util>O.thresh.high/100);
  $("outil-note").textContent=over.length?`${over.map(r=>r.name).join(" and ")} ${over.length>1?"are":"is"} over capacity. Steps above ${O.thresh.healthy}% build queues quickly.`:`No step is over capacity. Steps above ${O.thresh.healthy}% build queues quickly.`;}
function oRenderIssues(C){const T=C.totals,d=+O.days||0;
  const card=(h,rows,id)=>`<div class="card"><h3>${h}</h3><div class="cl">${rows.map(r=>`<span>${r[0]}</span><b class="${r[2]||""}">${r[1]}</b>`).join("")}</div><button class="linkbtn" type="button" data-ojump="issues:${id}" style="align-self:flex-start">Details ↓</button></div>`;
  const sum=k=>C.steps.reduce((a,r)=>a+r[k],0);
  $("oiss-sum").innerHTML=card("Delays",[["Delayed units a month",onum(md(sum("delayed")))],["Delay hours a month",onum(md(T.delayHours))],["Delay cost a month",om(md(T.delayCost)),"neg"]],"osec-delays")+
    card("Errors and rework",[["Errors a month",onum(md(sum("errors")))],["Rework hours a month",onum(md(T.reworkHours))],["Rework cost a month",om(md(T.reworkCost)),"neg"]],"osec-errors")+
    card("Cancellations",[["Cancelled a month",onum(md(sum("cancelled")))],["Revenue lost a month",om(md(T.cancelRevenue)),"neg"],["Capacity used a month",onum(md(sum("cancelHours")))+" h"]],"osec-cancel");
  $("oiss-delay").innerHTML=C.steps.map(r=>`<tr><td>${esc(r.name)}</td><td>${opct(r.delay)}</td><td>${ov(r.delayed)}</td><td>${omin(r.delayMin)}</td><td>${onum(r.delayHours*vf(),1)}</td></tr>`).join("")+`<tr class="hl"><td><b>Total ${vu()}</b></td><td>${opct(T.delayRate)} overall</td><td>${ov(sum("delayed"))}</td><td></td><td>${onum(T.delayHours*vf(),1)}</td></tr>`;
  const dmax=C.steps.slice().sort((a,b)=>b.delayHours-a.delayHours)[0];
  $("oiss-delay-note").innerHTML=dmax&&dmax.delayHours>0?`Biggest source: <b>${esc(dmax.name)}</b>. ${onum(dmax.processed)} units a day × ${opct(dmax.delay)} delayed × ${omin(dmax.delayMin)} = ${onum(dmax.delayHours,1)} delay hours a day, costing about ${om(md(dmax.delayCost))} a month at ${om2(+O.delayCost)} per unit per hour.`:"No delays recorded.";
  $("oiss-err").innerHTML=C.steps.map(r=>`<tr><td>${esc(r.name)}</td><td>${opct(r.err,1)}</td><td>${ov(r.errors)}</td><td>${ov(r.reworked)}</td><td>${ov(r.failed)}</td><td>${onum(r.reworkHours*vf(),1)}</td><td>${om(r.reworkCost*vf())}</td></tr>`).join("")+`<tr class="hl"><td><b>Total ${vu()}</b></td><td>${opct(T.errorRate,1)} overall</td><td>${ov(sum("errors"))}</td><td>${ov(sum("reworked"))}</td><td>${ov(sum("failed"))}</td><td>${onum(T.reworkHours*vf(),1)}</td><td>${om(T.reworkCost*vf())}</td></tr>`;
  const emax=C.steps.slice().sort((a,b)=>b.reworkHours-a.reworkHours)[0];
  $("oiss-err-note").innerHTML=emax&&emax.reworkHours>0?`<strong>A ${opct(emax.err,1)} error rate is not just a percentage.</strong><p class="small">At <b>${esc(emax.name)}</b>: ${onum(md(emax.processed))} units a month × ${opct(emax.err,1)} = ${onum(md(emax.errors))} errors. ${opct(emax.rw)} are reworked at ${omin(emax.rwMin)} each = <b>${onum(md(emax.reworkHours))} hours of rework a month</b>, about <b>${om(md(emax.reworkCost))}</b> at ${om2(+emax.s.labour)} an hour.</p>`:"<p class='small'>No rework recorded.</p>";
  barChart("oc-err",{cats:C.steps.map(r=>r.name),catName:"",yFmt:v=>onum(v)+" h",series:[{n:"Rework hours a month",c:"var(--amber)",vals:C.steps.map(r=>md(r.reworkHours))},{n:"Cancelled work hours a month",c:"var(--stop)",vals:C.steps.map(r=>md(r.cancelHours))}]},{views:["bar","line"]});
  $("oiss-can").innerHTML=C.steps.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.cancel>0?esc(r.s.exitLabel||"Cancelled"):"—"}</td><td>${opct(r.cancel,1)}</td><td>${ov(r.cancelled)}</td><td>${om(md(r.cancelRevenue))}/mo</td><td>${onum(md(r.cancelHours),1)} h/mo</td><td>${om(md(r.cancelCost))}/mo</td></tr>`).join("");
  $("oiss-can-note").innerHTML=T.cancelRevenue>0||T.cancelCost>0?`Cancellations are costing about <b>${om(md(T.cancelRevenue))} a month in lost revenue</b> and using about <b>${onum(md(C.steps.reduce((a,r)=>a+r.cancelHours,0)))} hours</b> of capacity (${om(md(T.cancelCost))} of cost already incurred).`:"No cancellations recorded.";}

function oRenderDiagnose(C){const p=C.primary,c=C.constraint,T=C.totals;if(!p){$("obn").innerHTML="";return;}
  const ev=[`Capacity: ${ov(p.cap)} ${vu()} (normal hours)`,`Demand: ${ov(p.inU)} ${vu()}`,`Utilisation: ${opct(p.util)} (${p.status})`,`Average waiting: ${omin(p.wait)}${p.waitSrc==="model"?" (estimated)":""}`,`Delay rate: ${opct(p.delay)}`,`Error rate: ${opct(p.err,1)}`];
  const isLowest=isFinite(p.capFinal)&&Math.abs(p.capFinal-T.procCap)<1e-6;
  const why=`${esc(p.name)} ${isLowest?"has the lowest effective capacity in the process and ":""}is operating at ${opct(p.util)} utilisation.${T.waitTime>0?` It accounts for ${opct(p.waitShare)} of total waiting time.`:""}${p.delay>=0.08?` ${opct(p.delay)} of units are delayed here.`:""}`;
  $("obn").className="verdict "+(p.score>=5?"stop":"mid");
  $("obn").innerHTML=`<span class="eyebrow">Primary bottleneck</span><p class="call">${esc(p.name)}</p><p><b>${p.score.toFixed(1)}/10 · ${p.severity}</b></p><p style="max-width:75ch">${why}</p>
    <details class="more"><summary>Why?</summary><ul style="margin:8px 0 0;padding-left:18px">${ev.map(e=>`<li>${e}</li>`).join("")}</ul><p class="small" style="margin-top:6px">Therefore ${esc(p.name)} is currently the primary ${p.util>=1?"capacity ":""}constraint.</p></details>
    ${c&&c.id!==p.id&&c.util>=O.thresh.healthy/100?`<p class="small">Note: the step with the least spare capacity is <b>${esc(c.name)}</b> (${opct(c.util)} busy). ${esc(p.name)} ranks higher overall because of its other signals.</p>`:""}`;
  $("orank").innerHTML=C.ranking.map((r,i)=>`<button type="button" class="rankit" data-orank="${r.id}" aria-expanded="${!!oRankOpen[r.id]}"><span class="rn">${i+1}</span><span><b>${esc(r.name)}</b><small>Utilisation ${opct(r.util)} · waiting ${omin(r.wait)} · delays ${opct(r.delay)} · errors ${opct(r.err,1)}</small></span><span class="sc">${r.score.toFixed(1)}</span></button>
    ${oRankOpen[r.id]?`<div class="rankdet"><div class="tablebox"><table><thead><tr><th>Signal</th><th>Value</th><th>Scaled 0–1</th><th>Weight</th><th>Points</th></tr></thead><tbody>${Object.keys(OPS_BN_W).map(k=>`<tr><td>${OPS_BN_LABEL[k]}</td><td>${{util:opct(r.util),capacity:ov(r.cap)+" "+vu(),queue:omin(r.wait),delay:opct(r.delay),error:opct(r.err,1),cancel:opct(r.cancel,1),cost:om(md(r.impact))+"/mo"}[k]}</td><td>${r.comp[k].toFixed(2)}</td><td>${onum(+O.bnW[k]||0)}</td><td>${r.parts[k].toFixed(2)}</td></tr>`).join("")}<tr class="hl"><td><b>Score</b></td><td></td><td></td><td></td><td><b>${r.score.toFixed(1)}</b></td></tr></tbody></table></div>
      <p class="small muted" style="margin-top:6px">Scaling: utilisation counts from 50% (0) to 120% (1); capacity is the tightest step's capacity ÷ this step's; waiting is relative to the longest wait; delays full at 25%, errors at 15%, cancellations at 10%; cost relative to the costliest step. Score = 10 × weighted average.</p></div>`:""}`).join("");
  const sc={low:"var(--st-low)",ok:"var(--go)",high:"var(--amber)",over:"var(--stop)"};
  barChart("oc-cap",{cats:C.steps.map(r=>r.name),yFmt:v=>onum(v),series:[{n:"Capacity "+vu(),c:"var(--go)",cs:C.steps.map(r=>isFinite(r.cap)&&r.cap<r.inU-1e-9?"var(--stop)":"var(--go)"),vals:C.steps.map(r=>isFinite(r.cap)?r.cap*vf():0)},{n:"Demand "+vu(),c:"var(--ink)",vals:C.steps.map(r=>r.inU*vf())}]},{views:["bar","line"]});
  barChart("oc-util",{cats:C.steps.map(r=>r.name),yFmt:v=>Math.round(v)+"%",series:[{n:"Utilisation",c:"var(--s1)",cs:C.steps.map(r=>sc[stKey(r.status)]),vals:C.steps.map(r=>isFinite(r.util)?r.util*100:0)}],
    lines:[{v:O.thresh.healthy,label:"High "+O.thresh.healthy+"%",c:"var(--muted)"},{v:O.thresh.high,label:"Overloaded "+O.thresh.high+"%",c:"var(--stop)"}]},{views:["bar","line"]});
  barChart("oc-lead",{cats:C.steps.map(r=>r.name),yFmt:v=>onum(v)+" min",stack:true,series:[{n:"Processing",c:"var(--go)",vals:C.steps.map(r=>r.load)},{n:"Waiting",c:"var(--amber)",vals:C.steps.map(r=>r.wait)},{n:"Delays",c:"var(--stop)",vals:C.steps.map(r=>r.delayAvg)}]},
    {views:["stack","pie"],alt:{pie:{fmt:v=>omin(v),slices:[{label:"Working on it",v:T.procTime,c:"var(--go)"},{label:"Waiting in a queue",v:T.waitTime,c:"var(--amber)"},{label:"Held up by delays",v:T.delayTime,c:"var(--stop)"}]}}});
  $("olead").innerHTML=`<div class="cl" style="margin-top:8px"><span>Processing time</span><b>${omin(T.procTime)}</b><span>Waiting time</span><b>${omin(T.waitTime)}</b><span>Delays (average per unit)</span><b>${omin(T.delayTime)}</b><span><b>Total lead time</b></span><b>${omin(T.lead)}</b><span>Waiting and delays as % of lead time</span><b class="${T.waitShare>0.5?"neg":""}">${opct(T.waitShare)}</b></div>
    <p class="small muted" style="margin-top:6px">Total lead time = processing + waiting + delays. ${T.waitShare>0.5?"Most time is spent waiting, not working: this is a queue problem more than a speed problem.":"Processing makes up a good share of the time."}</p>`;
  const L=T&&C.totals;const lt=opsLittle(C);
  $("olittle").innerHTML=lt.ok?`<p><span class="chip calc">Derived using Little's Law</span></p><p class="formula">L = λ × W</p><div class="cl"><span>λ, finished units per hour</span><b>${onum(lt.lambda,1)}</b><span>W, time in the process</span><b>${onum(lt.W,2)} hours</b><span><b>L, units in the process at any time</b></span><b>${onum(lt.L,1)}</b></div>
    <p class="small">If ${onum(lt.lambda,1)} units finish per hour and each spends ${omin(lt.W*60)} in the process, about <b>${onum(lt.L,0)} units</b> are in the process at any given moment.</p>`:
    `<p class="small">Not shown. ${C.totals.growing?"At least one step's queue keeps growing, so there is no steady number of items in the process.":"There isn't enough data (open hours and lead time are needed)."}</p>`;
  const W=oWarnings(C);
  $("odq").innerHTML=W.length?W.map(w=>`<div class="callout warn"><p class="small">${w[0]} <button class="linkbtn" type="button" data-ojump="${w[1]}:${w[2]}">Fix this →</button></p></div>`).join(""):`<div class="callout go"><p class="small">No data warnings. Your diagnosis rests on your own numbers.</p></div>`;}
function opsLittle(C){return C.little;}

function oRenderRca(C){const r=C.steps.find(x=>x.id===O.rcaStep)||C.primary;if(!r)return;const R=rcaFor(r.id);
  $("orca-obs").innerHTML=oObserved(r,C).map(t=>`<li>${t}</li>`).join("");
  const sug=oSuggested(r);
  document.querySelectorAll("[data-orow]").forEach(el=>el.classList.toggle("sug",sug.has(el.dataset.orow)&&!R.status[el.dataset.orow]));
  document.querySelectorAll("[data-osug]").forEach(el=>el.innerHTML=sug.has(el.dataset.osug)?'<span class="chip calc">Suggested by the model</span>':"");
  if(document.activeElement!==$("orca-prob"))$("orca-prob").placeholder=`${esc(r.name)} is slowing the process down`;
  const st={suspected:"Suspected",confirmed:"Confirmed",ruled:"Ruled out"};
  const items=[];Object.entries(RCA_CATS).forEach(([cat,list])=>list.forEach(it=>{const k=cat+"|"+it;const s=R.status[k];if(s&&s!=="ruled")items.push({cat,text:it,s,src:"you"});else if(!s&&sug.has(k))items.push({cat,text:it,s:"model",src:"model"});}));
  R.custom.forEach(c=>{if(c.status!=="ruled")items.push({cat:c.cat,text:c.text,s:c.status||"",src:c.src});});
  const bycat={};items.forEach(i=>(bycat[i.cat]=bycat[i.cat]||[]).push(i));
  const whys=R.whys.filter(w=>w.trim());
  $("orca-tree").innerHTML=`<div class="tn"><span class="chip stop">Observed problem</span><b>${esc(R.problem||`${r.name} is slowing the process down`)}</b></div>
   <ul><li><div class="tn"><span class="chip stop">Bottleneck</span><b>${esc(r.name)}</b> <span class="small muted">${opct(r.util)} busy · score ${r.score.toFixed(1)}</span></div>
    <ul><li><details open><summary class="tn"><b>What the data shows</b> <span class="chip calc">Observed</span></summary><ul>${oObserved(r,C).map(t=>`<li class="small">${t}</li>`).join("")}</ul></details></li>
     ${Object.keys(bycat).length?Object.entries(bycat).map(([cat,list])=>`<li><details open><summary class="tn"><b>${cat}</b> <span class="chip ex">Potential cause</span></summary><ul>${list.map(i=>`<li class="small">${esc(i.text)} · <i>${i.s==="model"?"suggested by the model":st[i.s]||"not checked"}${i.src==="ai"?", AI suggestion":""}</i></li>`).join("")}</ul></details></li>`).join(""):`<li class="small muted">No potential causes marked yet. Use the list below.</li>`}
     ${whys.length?`<li><details open><summary class="tn"><b>5 Whys chain</b></summary><ol class="small">${whys.map(w=>`<li>${esc(w)}</li>`).join("")}</ol></details></li>`:""}</ul></li></ul>`;}

function oTraceLines(key,C){const d=+O.days||0;const[sid,type]=key.split(".");
  if(sid==="tot"){const k={delay:"delayCost",rework:"reworkCost",ot:"otCost",lost:"lostContrib",impact:"impact",rev:"revenueOpp"}[type];const lab={delay:"Delay cost",rework:"Rework cost",ot:"Overtime cost",lost:"Lost contribution",impact:"Total financial cost",rev:"Revenue opportunity"}[type];
    return{title:lab+" across all steps",lines:C.steps.filter(r=>r[k]>0).map(r=>[r.name,`${om2(r[k])} a day × ${d} days`,om(md(r[k]))]).concat([["Total","",om(md(C.totals[k]))]])};}
  const r=C.steps.find(x=>x.id===sid);if(!r)return null;const s=r.s;
  switch(type){
    case"delay":return{title:`Delay cost at ${r.name}`,lines:[["Delayed units",`${onum(r.processed,1)} processed × ${opct(r.delay)}`,onum(r.delayed,1)+" a day"],["Delay hours",`${onum(r.delayed,1)} × ${omin(r.delayMin)} ÷ 60`,onum(r.delayHours,1)+" h a day"],["Delay cost",`${onum(r.delayHours,1)} h × ${om2(+O.delayCost)}`,om2(r.delayCost)+" a day"],["A month",`× ${d} working days`,om(md(r.delayCost))]],conf:opsStepConf(O,r,["delay","delayMin","delayCost","demand"])};
    case"rework":return{title:`Rework cost at ${r.name}`,lines:[["Errors",`${onum(r.processed,1)} × ${opct(r.err,1)}`,onum(r.errors,1)+" a day"],["Reworked",`${onum(r.errors,1)} × ${opct(r.rw)}`,onum(r.reworked,1)],["Rework hours",`${onum(r.reworked,1)} × ${omin(r.rwMin)} ÷ 60`,onum(r.reworkHours,2)+" h"],["Rework cost",`${onum(r.reworkHours,2)} h × ${om2(+s.labour)}`,om2(r.reworkCost)+" a day"],["A month",`× ${d}`,om(md(r.reworkCost))]],conf:opsStepConf(O,r,["err","rwShare","rwMin","labour","demand"])};
    case"ot":return{title:`Overtime at ${r.name}`,lines:[["Work needed",`${onum(r.processed,1)} units × ${onum(r.load,2)} min`,onum(r.processed*r.load)+" min"],["Normal time available",`${onum(r.par)} × ${onum(r.hours,1)} h × 60`,onum(r.availMin)+" min"],["Overtime",`(work − available) ÷ 60, capped at ${onum(+O.otMax,1)} h each`,onum(r.otHours,1)+" h a day"],["Overtime cost",`× ${om2(+O.otRate)} an hour × ${d} days`,om(md(r.otCost))]],conf:opsStepConf(O,r,["time","staff","hours","otRate","otMax","demand"])};
    case"lost":return{title:`Lost contribution at ${r.name}`,lines:[["Units not processed",`arrivals beyond capacity incl. overtime`,onum(r.dropped,1)+" a day"],["…that would have finished",`× ${opct(r.downPass)} pass rate from here`,onum(r.lostFinal,1)],["Failed units (not reworked)",`${onum(r.errors,1)} × ${opct(1-r.rw)}, would have finished`,onum(r.failedFinal,1)],["Lost contribution",`${onum(r.lostUnits,1)} × ${om2(+O.margin)} × ${d} days`,om(md(r.lostContrib))]],conf:opsStepConf(O,r,["time","staff","hours","margin","demand","err","rwShare"])};
    case"impact":return{title:`Total financial cost at ${r.name}`,lines:[["Delay",``,om(md(r.delayCost))],["Rework",``,om(md(r.reworkCost))],["Overtime",``,om(md(r.otCost))],["Lost contribution",``,om(md(r.lostContrib))],["Total a month","Revenue lost is shown separately",om(md(r.impact))]],conf:opsStepConf(O,r,["time","staff","hours","err","delay","margin","labour","otRate","delayCost"])};}
  return null;}
function oRenderTrace(C){const box=$("otrace");if(!oTraceKey){box.hidden=true;return;}const t=oTraceLines(oTraceKey,C);if(!t){box.hidden=true;return;}box.hidden=false;
  box.innerHTML=`<div class="row"><h4>${esc(t.title)}</h4><span class="spacer"></span>${t.conf?`<span class="chip ${t.conf==="High"?"go":t.conf==="Medium"?"in":"ex"}">${t.conf} confidence</span>`:""}<button class="linkbtn" type="button" data-otr="">Close</button></div>
   <div class="tablebox"><table><tbody>${t.lines.map(l=>`<tr><td>${esc(l[0])}</td><td class="small muted" style="text-align:left">${l[1]}</td><td><b>${l[2]}</b></td></tr>`).join("")}</tbody></table></div>`;}
function oRenderCost(C){const T=C.totals;
  const lk=(k,v)=>`<button class="olink" type="button" data-otr="${k}">${v}</button>`;
  $("osec-costtot").innerHTML=`<div class="card big"><div class="row"><h3>Financial cost</h3><span class="chip stop">Money you lose</span></div><div class="cl">
    <span>Delay cost</span><b>${lk("tot.delay",om(md(T.delayCost)))}</b><span>Rework cost</span><b>${lk("tot.rework",om(md(T.reworkCost)))}</b><span>Overtime cost</span><b>${lk("tot.ot",om(md(T.otCost)))}</b><span>Lost contribution</span><b>${lk("tot.lost",om(md(T.lostContrib)))}</b>
    <span><b>Total estimated impact a month</b></span><b class="neg">${lk("tot.impact",om(md(T.impact)))}</b></div><p class="small muted">${onum(md(T.hoursLost))} hours a month lost to rework and cancelled work.</p></div>
   <div class="card big"><div class="row"><h3>Revenue opportunity</h3><span class="chip in">Sales you miss</span></div><div class="cl"><span>Revenue lost to cancellations</span><b>${om(md(T.cancelRevenue))}</b><span>Revenue on units lost to capacity and failures</span><b>${om(md(T.revenueOpp-T.cancelRevenue))}</b><span><b>Total a month</b></span><b>${lk("tot.rev",om(md(T.revenueOpp)))}</b></div>
    <p class="small muted">Shown separately and never added to the financial cost, because lost revenue already includes the contribution counted on the left.</p></div>`;
  oRenderTrace(C);
  barChart("oc-cost",{cats:C.steps.map(r=>r.name),yFmt:om,stack:true,series:[{n:"Delay",c:"var(--amber)",vals:C.steps.map(r=>md(r.delayCost))},{n:"Rework",c:"var(--stop-mid)",vals:C.steps.map(r=>md(r.reworkCost))},{n:"Overtime",c:"var(--s2)",vals:C.steps.map(r=>md(r.otCost))},{n:"Lost contribution",c:"var(--stop)",vals:C.steps.map(r=>md(r.lostContrib))}]},
    {views:["waterfall","donut","stack"],alt:{waterfall:{yFmt:om,items:[{label:"Delays",v:md(T.delayCost),c:"var(--amber)"},{label:"Rework",v:md(T.reworkCost),c:"var(--stop-mid)"},{label:"Overtime",v:md(T.otCost),c:"var(--s2)"},{label:"Lost profit",v:md(T.lostContrib),c:"var(--stop)"},{label:"Total a month",v:md(T.delayCost+T.reworkCost+T.otCost+T.lostContrib),c:"var(--ink)",total:true}]},
      donut:{fmt:om,totalLabel:"a month",slices:[{label:"Delays",v:md(T.delayCost),c:"var(--amber)"},{label:"Rework",v:md(T.reworkCost),c:"var(--stop-mid)"},{label:"Overtime",v:md(T.otCost),c:"var(--s2)"},{label:"Lost profit",v:md(T.lostContrib),c:"var(--stop)"}]}}});
  $("ocost").innerHTML=C.steps.slice().sort((a,b)=>b.impact-a.impact).map(r=>{const conf=opsStepConf(O,r,["time","staff","hours","err","delay","margin","labour","otRate","delayCost"]);
    return`<div class="card ocard${C.primary&&r.id===C.primary.id?" bnc":""}"><div class="row"><h3>${esc(r.name)}</h3><span class="spacer"></span><span class="chip ${conf==="High"?"go":conf==="Medium"?"in":"ex"}">${conf} confidence</span></div>
     <span class="small muted">Estimated monthly impact</span><span class="big">${lk(r.id+".impact",om(md(r.impact)))}</span>
     <div class="cl"><span>Rework</span><b>${lk(r.id+".rework",om(md(r.reworkCost)))}</b><span>Overtime</span><b>${lk(r.id+".ot",om(md(r.otCost)))}</b><span>Lost contribution</span><b>${lk(r.id+".lost",om(md(r.lostContrib)))}</b><span>Delay</span><b>${lk(r.id+".delay",om(md(r.delayCost)))}</b></div>
     <div class="cl small"><span>Hours lost a month</span><b>${onum(md(r.hoursLost))}</b><span>Units affected a month</span><b>${onum(md(r.affected))}</b><span>Delay rate</span><b>${opct(r.delay)}</b></div></div>`;}).join("");}

function oRenderImprove(C){const R=OR;document.querySelectorAll("[data-oobj]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.oobj===O.objective));
  const T0=C.totals,d=+O.days||0;const best=R.best;
  const pb=e=>e.monthlyBenefit<=0?"Doesn't pay back":e.inv===0?"Immediate":e.payback<1?"Under 1 month":onum(e.payback,1)+" months";
  const roi=e=>e.monthlyBenefit<=0?"Loses money":e.inv===0?"No investment":opct(e.roi);
  R.evs.forEach((e,i)=>{const el=$("osc-r-"+e.sc.id);if(!el)return;const card=$("osc-"+e.sc.id);if(card)card.classList.toggle("rec",!!best&&best.sc.id===e.sc.id);
    const st=e.sc.step&&!oStep(e.sc.step)&&e.sc.kind!=="variability"?`<p class="small neg">Choose a step: the one this used has been removed.</p>`:"";
    if(card)card.classList.toggle("loss",!(best&&best.sc.id===e.sc.id)&&e.monthlyBenefit<=0);
    const di=oDupOf(e.sc);const dEl=$("osc-d-"+e.sc.id);if(dEl){dEl.hidden=di<0;dEl.innerHTML=di<0?"":`Same as idea ${String.fromCharCode(65+di)}. Change the step or the numbers to test something different.`;}
    el.innerHTML=`${st}${best&&best.sc.id===e.sc.id?'<span class="chip go">Recommended</span>':""}<div class="cl small"><span>Throughput</span><b>${ov(T0.throughput)} → ${ov(e.C.totals.throughput)} ${vu()}</b><span>Capacity limit</span><b>${e.shifted?`${esc(e.from.name)} → <span class="neg">${esc(e.to.name)}</span>`:e.to?esc(e.to.name)+" (unchanged)":"—"}</b>
      <span>Net monthly benefit</span><b class="${e.monthlyBenefit>0?"pos":"neg"}">${om(e.monthlyBenefit)}</b><span>Payback</span><b>${pb(e)}</b><span>ROI</span><b>${roi(e)}</b></div>${oWhySame(e,C)}`;});
  document.querySelectorAll("#osc textarea.scname").forEach(oFitName);
  /* comparison */
  const cols=[{n:"Current",C,e:null}].concat(R.evs.map((e,i)=>({n:String.fromCharCode(65+i)+". "+e.sc.name,C:e.C,e})));
  const bi=best?R.evs.indexOf(best)+1:-1;
  $("ocmp-h").innerHTML=`<tr><th></th>${cols.map((c,i)=>`<th class="${i===bi?"best":""}">${esc(c.n)}${i===bi?'<span class="win">Best</span>':""}</th>`).join("")}</tr>`;
  const row=(l,f)=>`<tr><td>${l}</td>${cols.map((c,i)=>`<td class="${i===bi?"best-col":""}">${f(c)}</td>`).join("")}</tr>`;
  $("ocmp").innerHTML=[row("Process capacity "+vu(),c=>ov(c.C.totals.procCap)),row("Throughput "+vu(),c=>ov(c.C.totals.throughput)),row("Highest utilisation",c=>opct(c.C.totals.maxUtil)),row("Capacity limit",c=>c.C.constraint?esc(c.C.constraint.name):"—"),
    row("Lead time",c=>omin(c.C.totals.lead)+(c.C.totals.growing?" +":"")),row("Delay rate",c=>opct(c.C.totals.delayRate)),row("Error rate",c=>opct(c.C.totals.errorRate,1)),row("Cancellation rate",c=>opct(c.C.totals.cancelRate,1)),
    row("Monthly operating cost",c=>om(md(c.C.totals.opCost)+(c.e?+c.e.sc.monthlyCost||0:0))),row("Monthly inefficiency cost",c=>om(md(c.C.totals.impact))),row("Investment",c=>c.e?om(c.e.inv):"—"),row("Net monthly benefit",c=>c.e?`<span class="${c.e.monthlyBenefit>0?"pos":"neg"}">${om(c.e.monthlyBenefit)}</span>`:"—"),
    row("Payback",c=>c.e?pb(c.e):"N/A"),row("ROI",c=>c.e?roi(c.e):"N/A")].join("");
  /* recommendation */
  const objL=(OPS_OBJECTIVES.find(o=>o[0]===O.objective)||[0,""])[1].toLowerCase();
  const rec=$("orec");
  if(!R.evs.length){rec.className="verdict";rec.innerHTML=`<span class="eyebrow">Recommendation</span><p>Add a scenario above to test an improvement.</p>`;}
  else if(!best){rec.className="verdict stop";rec.innerHTML=`<span class="eyebrow">Recommendation</span><p class="call">Keep the current process</p><p style="max-width:75ch">None of your scenarios pays for itself or improves your goal (${objL}) at no net cost. Try a change aimed at ${C.primary?esc(C.primary.name):"the bottleneck"}, or lower the investment.</p>`;}
  else{const e=best;const ru=R.ranked[1];const T1=e.C.totals;const parts=[];
    if(T1.throughput>T0.throughput+0.01)parts.push(`raises throughput from ${ov(T0.throughput)} to ${ov(T1.throughput)} ${vu()}`);
    if(T1.impact<T0.impact-0.01)parts.push(`cuts the monthly inefficiency cost from ${om(md(T0.impact))} to ${om(md(T1.impact))}`);
    if(T1.delayRate<T0.delayRate-0.0005)parts.push(`reduces the delay rate from ${opct(T0.delayRate)} to ${opct(T1.delayRate)}`);
    if(T1.lead<T0.lead-0.5)parts.push(`shortens lead time from ${omin(T0.lead)} to ${omin(T1.lead)}`);
    let txt=`${esc(e.sc.name)}${e.sc.step&&oStep(e.sc.step)?` at ${esc(oStep(e.sc.step).name)}`:""} ${parts.length?parts.join(", "):"improves your goal"}. It needs ${e.inv?om(e.inv)+" of investment":"no investment"} and ${e.monthlyBenefit>0?`returns ${om(e.monthlyBenefit)} a month (payback: ${pb(e).toLowerCase()})`:"has no net cost"}.`;
    if(ru)txt+=` ${esc(ru.sc.name)} comes second${ru.inv>e.inv?`, needing ${om(ru.inv-e.inv)} more investment`:ru.monthlyBenefit<e.monthlyBenefit?`, returning ${om(e.monthlyBenefit-ru.monthlyBenefit)} less each month`:""}.`;
    if(e.shifted)txt+=` After the change, the capacity limit moves from ${esc(e.from.name)} to ${esc(e.to.name)}, so improve ${esc(e.from.name)} first, then reassess ${esc(e.to.name)}.`;
    rec.className="verdict go";rec.innerHTML=`<span class="eyebrow">Recommended for: ${objL}</span><p class="call">${esc(e.sc.name)}</p><p style="max-width:75ch">${txt}</p>`;}
  /* before/after */
  const selId=O.baSel&&R.evs.some(e=>e.sc.id===O.baSel)?O.baSel:(best?best.sc.id:(R.evs[0]&&R.evs[0].sc.id));
  if($("oba-sel").value!==selId&&selId)$("oba-sel").value=selId;
  const e=R.evs.find(x=>x.sc.id===selId);
  if(!e){$("oba").innerHTML=`<p class="muted">Add a scenario to see the before and after.</p>`;}
  else{const a=C.totals,b=e.C.totals;
    const col=(h,t,c,cls)=>`<div class="col ${cls}"><span class="eyebrow">${h}</span><div class="cl"><span>Throughput</span><b>${ov(t.throughput)} ${vu()}</b><span>Capacity</span><b>${ov(t.procCap)} ${vu()}</b><span>Highest utilisation</span><b>${opct(t.maxUtil)}</b><span>Delay rate</span><b>${opct(t.delayRate)}</b><span>Error rate</span><b>${opct(t.errorRate,1)}</b><span>Monthly impact</span><b>${om(md(t.impact))}</b><span>Capacity limit</span><b>${c?esc(c.name):"—"}</b></div></div>`;
    const ch=(x,y)=>x?(y-x)/x:0;
    const dl=(l,v,good)=>`<div class="delta"><span class="small muted">${l}</span><b class="${good===null?"":good?"pos":"neg"}">${v}</b></div>`;
    $("oba").innerHTML=`<div class="ba">${col("Current state",a,C.constraint,"")}<span class="mid" aria-hidden="true">→</span>${col(esc(e.sc.name),b,e.C.constraint,"after")}</div>
      <div class="deltas" style="margin-top:14px">${dl("Capacity",ospct(ch(a.procCap,b.procCap)),b.procCap>=a.procCap)}${dl("Throughput",ospct(ch(a.throughput,b.throughput),1),b.throughput>=a.throughput)}${dl("Delays",ospct(ch(a.delayRate,b.delayRate)),b.delayRate<=a.delayRate)}${dl("Errors",ospct(ch(a.errorRate,b.errorRate)),b.errorRate<=a.errorRate)}${dl("Monthly impact",(b.impact<=a.impact?"−":"+")+om(Math.abs(md(b.impact-a.impact))),b.impact<=a.impact)}</div>
      <h4 style="margin-top:16px">Bottleneck shift</h4><p class="small muted">The step with the least spare capacity, before and after.</p>
      <div class="shiftrow"><span class="small muted" style="border:0">Before</span>${C.steps.map(r=>`<span class="${C.constraint&&r.id===C.constraint.id?"on":""}">${esc(r.name)} ${opct(r.util)}</span>`).join("")}</div>
      <div class="shiftrow" style="margin-top:6px"><span class="small muted" style="border:0">After</span>${e.C.steps.map(r=>`<span class="${e.C.constraint&&r.id===e.C.constraint.id?"on":""}">${esc(r.name)} ${opct(r.util)}</span>`).join("")}</div>
      <p class="small" style="margin-top:8px">${e.shifted?`The ${esc(e.from.name)} bottleneck has been relieved, but the constraint has shifted to <b>${esc(e.to.name)}</b>.`:e.C.constraint&&e.C.constraint.util>1?`${esc(e.C.constraint.name)} is still overloaded after this change.`:`The capacity limit stays at ${e.C.constraint?esc(e.C.constraint.name):"the same step"}.`}</p>`;}
  const cats=["Current"].concat(R.evs.map((e,i)=>String.fromCharCode(65+i)));
  barChart("oc-thru",{cats,yFmt:v=>onum(v),series:[{n:"Finished units "+vu(),c:"var(--go)",vals:[C.totals.throughput*vf()].concat(R.evs.map(e=>e.C.totals.throughput*vf()))},{n:"Demand "+vu(),c:"var(--ink)",vals:cats.map(()=>(+O.demand||0)*vf())}]});
  barChart("oc-ben",{cats:R.evs.map((e,i)=>String.fromCharCode(65+i)),yFmt:om,series:[{n:"Net monthly benefit",c:"var(--go)",cs:R.evs.map(e=>e.monthlyBenefit>=0?"var(--go)":"var(--stop)"),vals:R.evs.map(e=>e.monthlyBenefit)}]});}

function oRenderCentre(C){const T=C.totals,p=C.primary;const h=C.health;
  $("ohealth").textContent=Math.round(h);$("ohealth-chip").innerHTML=`<span class="chip ${h>=75?"go":h>=50?"in":"stop"}">${h>=75?"Healthy":h>=50?"Fair":h>=30?"Strained":"Critical"}</span>`;
  $("ohealth-parts").innerHTML=Object.keys(OPS_H_W).map(k=>`<div class="factor" style="grid-template-columns:110px minmax(0,1fr) 70px;padding:4px 0;border:0"><span class="small">${OPS_H_LABEL[k]}</span><div class="bar"><i style="width:${Math.round(C.hs[k]*100)}%"></i></div><span class="small" style="text-align:right">${C.hparts[k].toFixed(0)} of ${Math.round(100*(+O.hW[k]||0)/(Object.values(O.hW).reduce((a,b)=>a+(+b||0),0)||1))}</span></div>`).join("");
  const kp=(l,v,i,j)=>`<button type="button" class="kpi" data-ojump="${j}"><span>${l}</span><b>${v}</b><i>${i}</i></button>`;
  $("okpi").innerHTML=kp("Throughput",ov(T.throughput),vu(),"improve:osec-cmp")+kp("Capacity",ov(T.procCap),"finished units "+vu(),"diagnose:oc-cap")+kp("Utilisation",opct(T.maxUtil),"at the busiest step","diagnose:oc-util")+
    kp("Lead time",omin(T.lead)+(T.growing?"+":""),T.growing?"and growing":"order to finish","diagnose:osec-lead")+kp("Delay rate",opct(T.delayRate),"of units delayed","issues:osec-delays")+kp("Error rate",opct(T.errorRate,1),"of units with an error","issues:osec-errors");
  const R=OPS_RCA_SUM(C);const best=OR.best;
  const row=(t,vals,j)=>`<div class="cock"><h4>${t}</h4><div class="vals">${vals.map(v=>`<div class="v"><span>${v[0]}</span><b class="${v[2]||""}">${v[1]}</b></div>`).join("")}<button class="pill sm ghost" type="button" data-otab="${j}">Details</button></div></div>`;
  $("ocentre").innerHTML=(p?row("Bottleneck",[["Primary bottleneck",esc(p.name),"neg"],["Score",p.score.toFixed(1)+"/10"],["Capacity",ov(p.cap)+" "+vu()],["Demand",ov(p.inU)+" "+vu()],["Utilisation",opct(p.util)],["Estimated cost",om(md(p.impact))+"/mo"]],"diagnose"):"")+
    row("Operational losses",[["Delay",om(md(T.delayCost))],["Rework",om(md(T.reworkCost))],["Lost contribution",om(md(T.lostContrib))],["Overtime",om(md(T.otCost))],["Total a month",om(md(T.impact)),"neg"]],"cost")+
    row("Root cause",[["Primary cause",R.primary],["Other causes",R.others],["5 Whys",R.whys],["Investigate",R.investigate]],"rca")+
    row("Improvement scenarios",[["Current",`${ov(T.throughput)} ${vu()}`]].concat(OR.evs.slice(0,4).map((e,i)=>[String.fromCharCode(65+i)+". "+esc(e.sc.name),`${om(e.monthlyBenefit)}/mo`,best&&best.sc.id===e.sc.id?"pos":""])),"improve");}
function OPS_RCA_SUM(C){const r=C.steps.find(x=>x.id===O.rcaStep)||C.primary;if(!r)return{primary:"—",others:"—",whys:"—",investigate:"—"};const R=rcaFor(r.id);
  const conf=[],sus=[];Object.entries(R.status).forEach(([k,s])=>{const t=k.split("|")[1];if(s==="confirmed")conf.push(t);if(s==="suspected")sus.push(t);});
  R.custom.forEach(c=>{if(c.status==="confirmed")conf.push(c.text);if(c.status==="suspected")sus.push(c.text);});
  const sug=[...oSuggested(r)].map(k=>k.split("|")[1]);
  const prim=conf[0]||sus[0];const others=conf.slice(1).concat(sus.slice(conf.length?0:1));
  return{primary:prim?esc(prim)+(conf[0]?" (confirmed)":" (suspected)"):sug[0]?esc(sug[0])+" (model suggestion)":"Not investigated",others:others.length?esc(others.slice(0,2).join(", ")):"—",
    whys:R.whys.filter(w=>w.trim()).length+" of 5 answered",investigate:sug.filter(s=>!conf.includes(s)).slice(0,2).map(esc).join(", ")||"—"};}

/* ---------- actions ---------- */
function oLoadTemplate(key){oUndo=JSON.stringify(O);const keep={cur:O.cur,objective:O.objective};
  if(key==="blank"){O=opsFromTemplate("ecom");O.tpl="blank";O.biz={name:"",industry:"",type:"",employees:"",location:""};O.proc={name:"My process",desc:"",owner:"",freq:"Daily"};
    O.steps=[opsBlankStep(),opsBlankStep(),opsBlankStep()];O.steps.forEach((s,i)=>{s.name=["First step","Second step","Third step"][i];s.typ=Object.assign({},STEP_TYP);});O.demand=100;O.revenue=0;O.margin=0;OPS_PROC_FIELDS.forEach(f=>O.src[f]="estimated");O.scenarios=[];}
  else O=opsFresh(key);
  Object.assign(O,keep);O.view="day";O.picked=true;O.furthest=0;O.step="process";O.sel=O.steps[0].id;O.numSel=O.steps[0].id;O.typ=null;O.rcaStep=null;oRankOpen={};oTraceKey=null;
  oBuildAll();opsRender();opsSave();}
function oFillScenarios(){if(!O.scenarios.length&&O.steps.length){const C=opsCalc(O);const bn=C.primary&&C.primary.s;const ks=bn&&opsAutomated(bn)?["machine","faster","quality"]:["staff","machine","faster"];ks.forEach(k=>O.scenarios.push(opsMakeScenario(O,k,C)));oBuildScenarios();syncO();}}
function toastUndo(msg){otoast("");const t=$("otoast");t.innerHTML=`${esc(msg)} <button class="linkbtn" type="button" data-oundo="1" style="color:inherit">Undo</button>`;}
function oNext(d){const i=oIdx(OTAB)+d;if(i<0||i>=OSTEPS.length)return;if(OTAB==="process"&&d>0&&!O.picked)return;
  if(OSTEPS[i][0]==="diagnosis"||OSTEPS[i][0]==="cause")oFillScenarios();
  opsGo(OSTEPS[i][0]);setTimeout(()=>{const a=$("oapp");if(a)a.scrollIntoView({behavior:"smooth",block:"start"});},20);}
document.addEventListener("click",e=>{const g=sel=>e.target.closest(sel);let b;
  if((b=g("[data-onext]"))){e.preventDefault();oNext(1);return;}
  if((b=g("[data-oback]"))){e.preventDefault();oNext(-1);return;}
  if((b=g("[data-ostep]"))){if(b.disabled)return;opsGo(b.dataset.ostep);return;}
  if((b=g("[data-otab]"))){e.preventDefault();opsGo(b.dataset.otab);return;}
  if((b=g("[data-oresume]"))){$("oresume").hidden=true;return;}
  if((b=g("[data-orestart]"))){oUndo=JSON.stringify(O);O=opsFresh();O.picked=false;O.furthest=0;O.view="day";$("oresume").hidden=true;oRankOpen={};oTraceKey=null;oBuildAll();opsGo("process");
    const t=$("otoast");if(t)t.textContent="";const r=$("oresume");r.hidden=false;r.innerHTML=`<p>Started a new analysis.</p><div class="row"><button class="pill sm ghost" type="button" data-oundo="1">Undo</button><button class="pill sm ghost" type="button" data-oresume="1">OK</button></div>`;return;}
  if((b=g("[data-ocard]"))){const k=b.dataset.ocard;if(O.tpl===k&&!O.picked){O.picked=true;O.furthest=0;oBuildCards();opsRender();opsSave();}else if(!(O.tpl===k&&O.picked))oLoadTemplate(k);
    setTimeout(()=>{const n=$("onext-1");if(n)n.focus({preventScroll:true});},30);return;}
  if((b=g("[data-onode]"))){const id=b.dataset.onode;
    if(b.closest("#omap")){O.sel=id;oPendStepDel=null;oBuildSteps();syncO();opsRender();const inp=document.querySelector(`[data-osrow="${id}"] .osname`);if(inp)inp.focus();return;}
    O.numSel=id;opsGo("numbers");oBuildNumbers();syncO();return;}
  if((b=g("[data-osrow]"))&&!g("button")){const id=b.dataset.osrow;if(O.sel!==id){O.sel=id;document.querySelectorAll("[data-osrow]").forEach(r=>r.classList.toggle("sel",r.dataset.osrow===id));opsRender();}return;}
  if((b=g("[data-oadd]"))){const ns=opsBlankStep();ns.name="New step";ns.typ=Object.assign({},STEP_TYP);const i=O.steps.length;O.steps.splice(i,0,ns);O.sel=ns.id;oBuildAll();opsRender();opsSave();
    setTimeout(()=>{const inp=document.querySelector(`[data-osrow="${ns.id}"] .osname`);if(inp){inp.focus();inp.select();}},30);return;}
  if((b=g("[data-ostmove]"))){const id=b.dataset.id;const i=O.steps.findIndex(s=>s.id===id);const j=i+(+b.dataset.ostmove);if(i<0||j<0||j>=O.steps.length)return;const t=O.steps[i];O.steps[i]=O.steps[j];O.steps[j]=t;O.sel=id;oBuildAll();opsRender();opsSave();return;}
  if((b=g("[data-ostdel]"))){const id=b.dataset.ostdel;if(oPendStepDel!==id){oPendStepDel=id;oBuildSteps();syncO();return;}oPendStepDel=null;oUndo=JSON.stringify(O);const i=O.steps.findIndex(s=>s.id===id);if(i>=0&&O.steps.length>1)O.steps.splice(i,1);
    O.sel=(O.steps[Math.min(i,O.steps.length-1)]||{}).id;oBuildAll();opsRender();opsSave();const r=$("oresume");r.hidden=false;r.innerHTML=`<p>Step removed.</p><div class="row"><button class="pill sm ghost" type="button" data-oundo="1">Undo</button><button class="pill sm ghost" type="button" data-oresume="1">OK</button></div>`;return;}
  if((b=g("[data-onumsel]"))){O.numSel=b.dataset.onumsel;oBuildNumbers();syncO();opsRender();opsSave();return;}
  if((b=g("[data-onumgo]"))){const i=O.steps.findIndex(s=>s.id===O.numSel)+(+b.dataset.onumgo);if(i<0||i>=O.steps.length)return;O.numSel=O.steps[i].id;oBuildNumbers();syncO();opsRender();opsSave();
    setTimeout(()=>{const c=$("onum");if(c&&c.getBoundingClientRect().top<0)c.scrollIntoView({behavior:"smooth",block:"start"});},20);return;}
  if((b=g("[data-otyp]"))){const p=b.dataset.otyp;const pp=p.split(".");let v;if(pp[0]==="st"){const s=oStep(pp[1]);v=s&&s.typ?s.typ[pp[2]]:STEP_TYP[pp[2]];}else v=(O.typ||{})[p];
    if(v===undefined)return;setP(p,v);setSrc(p,"example");syncO();opsRender();opsSave();b.textContent="✓ Typical number used. You can change it any time.";return;}
  if((b=g("[data-oundo]"))){oScMsg("");if(oUndo){O=JSON.parse(oUndo);oUndo=null;oBuildAll();opsGo(O.step||"process",true);opsSave();$("oresume").hidden=true;otoast("Undone.");}return;}
  if((b=g("[data-oall]"))){const v=b.dataset.oall;O.steps.forEach(s=>{s.src=s.src||{};OPS_STEP_FIELDS.forEach(f=>s.src[f]=v);});OPS_PROC_FIELDS.forEach(f=>O.src[f]=v);syncO();opsRender();opsSave();otoast(`Every number is now marked ${SRCNAME[v]}. You can still change any single label.`);return;}
  if((b=g("[data-osrc]"))){e.preventDefault();const p=b.dataset.osrc;const order=["actual","estimated","example"];const cur=srcOf(p);setSrc(p,order[(order.indexOf(cur)+1)%3]||"actual");syncO();opsRender();opsSave();return;}
    if((b=g("[data-oobj]"))){O.objective=b.dataset.oobj;opsRender();opsSave();return;}
  if((b=g("[data-oscadd]"))||(b=g("[data-oscforce]"))){const force=!!b.dataset.oscforce;const sc=opsMakeScenario(O,b.dataset.oscadd||b.dataset.oscforce,OC||opsCalc(O));
    const di=force?-1:oDupOf(sc);if(di>=0){const ex=O.scenarios[di];const st=ex.step&&oStep(ex.step)?" for "+esc(oStep(ex.step).name):"";
      oScMsg(`<p>You already have “${esc(ex.name)}”${st} (idea ${String.fromCharCode(65+di)}). Change its step or numbers there, or add a copy anyway.</p><div class="row"><button class="pill sm ghost" type="button" data-oscgo="${ex.id}">Show idea ${String.fromCharCode(65+di)}</button><button class="pill sm ghost" type="button" data-oscforce="${sc.kind}">Add a copy anyway</button></div>`);return;}
    oScMsg("");O.scenarios.push(sc);oBuildScenarios();syncO();opsRender();opsSave();setTimeout(()=>{const c=$("osc-"+sc.id);if(c){c.scrollIntoView({behavior:"smooth",block:"center"});c.classList.add("flash");}},40);return;}
  if((b=g("[data-oscgo]"))){const c=$("osc-"+b.dataset.oscgo);oScMsg("");if(c){c.scrollIntoView({behavior:"smooth",block:"center"});c.classList.remove("flash");void c.offsetWidth;c.classList.add("flash");}return;}
  if((b=g("[data-oscdel]"))){const i=O.scenarios.findIndex(s=>s.id===b.dataset.oscdel);if(i<0)return;oUndo=JSON.stringify(O);const nm=O.scenarios[i].name;O.scenarios.splice(i,1);oBuildScenarios();syncO();opsRender();opsSave();
    oScMsg(`<p>Removed “${esc(nm)}”.</p><div class="row"><button class="pill sm ghost" type="button" data-oundo="1">Undo</button><button class="pill sm ghost" type="button" data-oscok="1">OK</button></div>`);return;}
  if((b=g("[data-oscok]"))){oScMsg("");return;}
  if((b=g("[data-orank]"))){const id=b.dataset.orank;oRankOpen[id]=!oRankOpen[id];opsRender();return;}
  if((b=g("[data-otr]"))){oTraceKey=b.dataset.otr||null;opsRender();if(oTraceKey)$("otrace").scrollIntoView({behavior:"smooth",block:"center"});return;}
  if((b=g("[data-ojump]"))){e.preventDefault();const[t,id]=b.dataset.ojump.split(":");oJump(t,id);return;}
  if((b=g("[data-oreset]"))){const k=b.dataset.oreset;O[k]=Object.assign({},k==="bnW"?OPS_BN_W:OPS_H_W);syncO();opsRender();opsSave();return;}
  if((b=g("[data-orcadel]"))){const R=rcaFor(O.rcaStep);R.custom=R.custom.filter(c=>c.id!==b.dataset.orcadel);oBuildRca();opsRender();opsSave();return;}
  if(e.target.id==="orca-add"){const t=$("orca-new").value.trim();if(!t){$("orca-new").focus();return;}rcaFor(O.rcaStep).custom.push({id:opsId(),cat:$("orca-newcat").value,text:t,status:"suspected",src:"you"});$("orca-new").value="";oBuildRca();opsRender();opsSave();return;}});
function oJump(t,id){opsGo(TABMAP[t]||t);setTimeout(()=>{const el=$(id);if(!el)return;if(el.tagName==="DETAILS")el.open=true;let a=el.parentElement;while(a){if(a.tagName==="DETAILS")a.open=true;a=a.parentElement;}const tg=el.tagName==="DETAILS"?el:(el.closest(".card")||el);tg.scrollIntoView({behavior:"smooth",block:"center"});tg.classList.remove("flash");void tg.offsetWidth;tg.classList.add("flash");},60);}
document.addEventListener("input",e=>{const t=e.target;if(t.dataset&&t.dataset.orca&&t.tagName==="INPUT"){const R=rcaFor(O.rcaStep);const k=t.dataset.orca;if(k==="problem")R.problem=t.value;else R.whys[+k.slice(3)]=t.value;opsRender();opsSave();}});
document.addEventListener("change",e=>{const t=e.target;
  if(t.id==="orca-step"){O.rcaStep=t.value;oBuildRca();opsRender();opsSave();return;}
  if(t.id==="oba-sel"){O.baSel=t.value;opsRender();opsSave();return;}
  if(t.dataset&&t.dataset.orcas){rcaFor(O.rcaStep).status[t.dataset.orcas]=t.value;if(!t.value)delete rcaFor(O.rcaStep).status[t.dataset.orcas];opsRender();opsSave();return;}
  if(t.dataset&&t.dataset.orcac){const c=rcaFor(O.rcaStep).custom.find(x=>x.id===t.dataset.orcac);if(c)c.status=t.value;opsRender();opsSave();return;}});

document.addEventListener("toggle",e=>{const t=e.target;if(!t||!t.closest||!t.closest("#ops"))return;if(t.id==="onum-more"){oEditMore=t.open;return;}if(t.open&&t.classList.contains("odd")&&!t.dataset.rendered){t.dataset.rendered="1";setTimeout(()=>{opsRender();delete t.dataset.rendered;},0);}},true);
/* ---------- save and export ---------- */
const OLOCAL="ops-saved";
function oLocal(){try{return JSON.parse(localStorage.getItem(OLOCAL)||"[]");}catch(e){return[];}}
function oLocalPut(a){try{localStorage.setItem(OLOCAL,JSON.stringify(a));return true;}catch(e){return false;}}
async function oList(){if(DB&&UID){try{const q=await DB.collection("data/users/"+UID).get();return q.docs.filter(d=>d.exists&&d.id.startsWith("ops_")).map(d=>Object.assign({id:d.id},d.data())).sort((a,b)=>b.savedAt-a.savedAt);}catch(e){return[];}}return oLocal().sort((a,b)=>b.savedAt-a.savedAt);}
let oPendSave=null;
async function oDrawSaved(){const items=await oList();$("osaved").innerHTML=items.length?items.map(it=>`<div class="it"><b>${esc(it.name)}</b><small>${new Date(it.savedAt).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})} · bottleneck: ${esc(it.bn||"—")}</small><span class="spacer"></span><button class="pill sm" type="button" data-oload="${it.id}">Open</button><button class="pill sm ghost" type="button" data-osdel="${it.id}">${oPendSave===it.id?"Tap again to delete":"Delete"}</button></div>`).join(""):`<p class="small" style="color:inherit;opacity:.7">No saved analyses yet.</p>`;}
async function oSaveNow(){const C=opsCalc(O);const name=($("osaveName").value||"").trim()||`${O.proc.name||"Process"} · ${new Date().toLocaleDateString("en-GB")}`;
  const rec={name,savedAt:Date.now(),bn:C.primary?C.primary.name:"",state:JSON.parse(JSON.stringify(O))};const id="ops_"+Date.now().toString(36);
  if(DB&&UID){try{await DB.collection("data/users/"+UID).doc(id).set(rec);otoast(`Saved "${name}" to your account.`);}catch(e){otoast("Couldn't save to your account just now. Try again.");return;}}
  else{const a=oLocal();a.push(Object.assign({id},rec));otoast(oLocalPut(a)?`Saved "${name}" in this browser.`:"This browser blocked saving. Try exporting instead.");}
  $("osaveName").value="";oDrawSaved();}
document.addEventListener("click",async e=>{const l=e.target.closest("[data-oload]");if(l){const it=(await oList()).find(x=>x.id===l.dataset.oload);if(it){O=it.state;oBuildAll();opsGo("summary");opsSave();otoast(`Opened "${it.name}".`);$("oapp").scrollIntoView({behavior:"smooth"});}return;}
  const d=e.target.closest("[data-osdel]");if(d){const id=d.dataset.osdel;if(oPendSave!==id){oPendSave=id;oDrawSaved();return;}oPendSave=null;
    if(DB&&UID){try{await DB.collection("data/users/"+UID).doc(id).delete();}catch(err){otoast("Couldn't delete it just now.");}}else oLocalPut(oLocal().filter(x=>x.id!==id));otoast("Deleted.");oDrawSaved();}});
function oReport(){const C=opsCalc(O),R=opsRecommend(O,C),T=C.totals,p=C.primary,L=[];const d=+O.days||0;
  L.push(`# ${O.proc.name}: ${O.biz.name||"Process"}`,`${O.biz.industry||""} · ${O.biz.location||""} · Demand ${onum(+O.demand)} units a day`,`Generated ${new Date().toLocaleString("en-GB")} with the Operations Bottleneck Diagnoser by BBC (Big Brain Consulting)`,"");
  if(p)L.push(`## Primary bottleneck: ${p.name} (${p.score.toFixed(1)}/10)`,`- Capacity ${onum(p.cap)} a day vs demand ${onum(p.inU)} a day: ${opct(p.util)} utilisation`,`- Waiting ${omin(p.wait)}, delay rate ${opct(p.delay)}, error rate ${opct(p.err,1)}`,`- Estimated monthly impact ${om(md(p.impact))}`,"");
  L.push("## Process health",`- Health score ${Math.round(C.health)}/100`,`- Throughput ${onum(T.throughput)} of ${onum(+O.demand)} a day; process capacity ${onum(T.procCap)} a day`,`- Lead time ${omin(T.lead)} (${opct(T.waitShare)} waiting and delays)`,`- Delay rate ${opct(T.delayRate)}, error rate ${opct(T.errorRate,1)}, cancellation rate ${opct(T.cancelRate,1)}`,"");
  L.push("## Steps");C.steps.forEach(r=>L.push(`- ${r.name}: ${opct(r.util)} busy (${r.status}), capacity ${onum(r.cap)}/day, wait ${omin(r.wait)}, score ${r.score.toFixed(1)}`));
  L.push("","## Monthly cost",`- Financial cost ${om(md(T.impact))}: delay ${om(md(T.delayCost))}, rework ${om(md(T.reworkCost))}, overtime ${om(md(T.otCost))}, lost contribution ${om(md(T.lostContrib))}`,`- Revenue opportunity (separate) ${om(md(T.revenueOpp))}`,"");
  const rs=OPS_RCA_SUM(C);L.push("## Root cause",`- Primary cause: ${rs.primary.replace(/<[^>]+>/g,"")}`,`- 5 Whys: ${rs.whys}`);(rcaFor(O.rcaStep||"").whys||[]).filter(w=>w.trim()).forEach((w,i)=>L.push(`  ${i+1}. ${w}`));
  L.push("","## Improvement scenarios");R.evs.forEach((e,i)=>L.push(`- ${String.fromCharCode(65+i)}. ${e.sc.name}: throughput ${onum(e.C.totals.throughput)}/day, investment ${om(e.inv)}, net monthly benefit ${om(e.monthlyBenefit)}, payback ${e.monthlyBenefit>0?(e.inv?onum(e.payback,1)+" months":"immediate"):"none"}${e.shifted?`, constraint moves ${e.from.name} → ${e.to.name}`:""}`));
  L.push("",`## Recommendation (${(OPS_OBJECTIVES.find(o=>o[0]===O.objective)||["",""])[1]})`,R.best?`- ${R.best.sc.name}`:"- Keep the current process for now","","## Data quality");oWarnings(C).forEach(w=>L.push("- "+w[0].replace(/<[^>]+>/g,"")));
  const mix=oDataMix();L.push(`- Data: ${opct(mix.actual)} actual, ${opct(mix.estimated)} estimated, ${opct(mix.example)} example or AI-generated`,"","A transparent model to support thinking, not professional advice.");return L.join("\n");}
function oCsv(){const C=opsCalc(O);const rows=[["Step","Field","Value","Source"]];
  O.steps.forEach(s=>{OPS_STEP_FIELDS.forEach(f=>rows.push([s.name,SF[f].l,s[f],SRCNAME[(s.src||{})[f]||"example"]]));});
  OPS_PROC_FIELDS.forEach(f=>rows.push(["Process",OF[f].l,O[f],SRCNAME[(O.src||{})[f]||"example"]]));
  C.steps.forEach(r=>[["Capacity per day",r.cap],["Utilisation",r.util],["Waiting minutes",r.wait],["Bottleneck score",r.score],["Monthly impact",md(r.impact)]].forEach(([l,v])=>rows.push([r.name,l,isFinite(v)?+v.toFixed(4):"","Calculated"])));
  return rows.map(r=>r.map(c=>{const s=String(c===undefined?"":c);return/[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}).join(",")).join("\n");}
async function oExport(name,data){if(DL){try{await DL.save({filename:name,data});otoast("Export ready.");return;}catch(e){if(e&&e.code==="declined"){otoast("Export cancelled.");return;}}}
  try{await navigator.clipboard.writeText(data);otoast("Downloads aren't available here, so the content was copied. Paste it into a document.");}catch(e){otoast("Export isn't available in this view.");}}
const oslug=()=>(O.proc.name||"process").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"process";
$("osaveBtn").onclick=()=>needProfile(oSaveNow,"save your analysis");
$("oexpReport").onclick=()=>needProfile(()=>oExport(oslug()+"-diagnosis.md",oReport()),"export your report");
$("oexpCsv").onclick=()=>needProfile(()=>oExport(oslug()+"-data.csv",oCsv()),"export your data");

/* ---------- start ---------- */
oBuildAll();
OTAB=O.step&&oIdx(O.step)>=0?O.step:"process";
opsGo(OTAB,true);
setTimeout(oDrawSaved,600);

function oFitName(t){if(!t)return;if(!t.offsetParent){t.style.height="";return;}t.style.height="auto";if(t.scrollHeight>0)t.style.height=t.scrollHeight+"px";else t.style.height="";}
document.addEventListener("input",e=>{if(e.target.matches&&e.target.matches("textarea.scname"))oFitName(e.target);});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.matches&&e.target.matches("textarea.scname")){e.preventDefault();e.target.blur();}});
