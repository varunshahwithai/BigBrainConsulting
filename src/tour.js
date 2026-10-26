/* ===== "Walk me through" tutorial: a guided mock case that never touches the user's own work ===== */
const TUT_CASE={name:"Brew & Co",product:"Specialty coffee subscription",geo:"London",cur:"GBP",currev:"",
  country:"Manchester, UK",industry:"Consumer subscriptions",ctype:"Coffee-drinking households",
  price:15,volume:24000,discount:10,varcost:6.5,fixed:60000,cac:20,upc:8,conv:5,
  tam:90000000,samPct:20,samMode:"calc",share:2,growth:6,pcust:300000,spend:60,
  elastic:-1.5,scA:13,scB:15,scC:17,sel:"C",invest:60000,horizon:3,ttmE:4,pShare:25,pCac:50,pFixed:30,pInv:60,ttmP:2,pRisk:35,
  f_reg:2,f_cap:4,f_tech:3,f_dist:6,f_brand:7,f_switch:4,f_comp:8,f_talent:3,f_ttm:4,link:true};
let TOUR=null;
const _saveDraft=saveDraft;saveDraft=function(){if(TOUR)return;_saveDraft();};
const q=sel=>typeof sel==="function"?sel():document.querySelector(sel);
const STEPS=[
  {title:"Welcome to your mock case",body:`<p>You're advising <b>Brew & Co</b>, a London coffee subscription that sells boxes of specialty beans. The founders want to know whether to launch in <b>Manchester</b>.</p><p>We'll build the case together in about five minutes. You'll change real numbers and see what they do. Your own work is safe: this practice case is separate and disappears when you finish.</p>`,tip:""},
  {tab:"model",el:"details.company",title:"Company details",body:"<p>This strip holds who the company is, what it sells and where. Open it any time to edit.</p>",tip:"Be specific. \"Coffee-drinking households in Manchester\" gives far better AI estimates than \"consumers\"."},
  {tab:"model",el:"#sliders",title:"The essential numbers",body:"<p>Five numbers drive the whole model: price, units sold per year, average discount, variable cost per unit and fixed costs per year. Each has a typing box and a slider.</p>",tip:"Use real figures where you have them. Anything that grows with every sale (beans, packaging, postage, card fees) is a variable cost. Rent and salaries are fixed."},
  {tab:"model",el:"#sliders .slider",title:"Try it: raise the price",body:"<p>Brew & Co charges £15 a box. What if it charged £17?</p><p>Watch the volume box: because <b>Volume reacts to price</b> is ticked, fewer boxes sell when the price goes up.</p>",do:"Drag the price slider to £17, or type 17 in the box.",check:()=>S.price>=16.9,tip:"Always ask how many customers you would lose before deciding a price rise is good."},
  {tab:"model",el:"#kpis",title:"Read the results",body:"<p>These eight cards update instantly. Notice operating profit went up even though fewer boxes sold.</p><p>Tap any card to see exactly how its number was calculated, step by step.</p>",do:"Tap the Gross margin card.",check:()=>traceKey==="gm",tip:"Before you trust a number, check how it was built. If a step looks wrong, the input behind it probably is.",
    onEnter:()=>{}},
  {tab:"model",el:()=>$("c-be").closest(".card"),title:"Break-even",body:"<p>Two answers here: how many units you must sell <b>each year</b> to cover costs, and in which <b>year</b> you earn back the money invested to launch.</p>",tip:"A plan that only breaks even in its final year is fragile. Small misses in sales push it past your horizon."},
  {tab:"pricing",el:()=>$("el-slider").closest(".card"),title:"Price elasticity",body:"<p>Elasticity says how strongly customers react to price. Brew & Co's −1.5 means a 1% price rise loses about 1.5% of sales.</p>",do:"Move elasticity to −0.5 and see how the explanation changes.",check:()=>Math.abs(S.elastic+0.5)<0.051,
    tip:"If you don't know it, test −0.5, −1.2 and −2.0. If your decision changes across them, elasticity is the assumption to research first, for example with a small price test.",onLeave:()=>{if(Math.abs(S.elastic+1.5)>0.01){S.elastic=-1.5;syncInputs();render();toast("Elasticity set back to −1.5 for the rest of the case.");}}},
  {tab:"pricing",el:"#sec-scen",title:"Compare price scenarios",body:"<p>Scenarios A, B and C test three prices side by side. Green marks the winner on each line.</p><p>Here the cheapest price brings in the most revenue, but the highest price makes the most profit.</p>",do:"Click \"Scenario A\" at the top right to see why it changes.",check:()=>S.sel==="A",tip:"Judge prices on operating profit, not revenue. Volume you win with a lower price often costs more than it brings in."},
  {tab:"pricing",el:"#sec-sens",title:"How sure are we?",body:"<p>This tests the chosen scenario under four different elasticities, so you can see whether the conclusion holds if customers are more or less price sensitive than you assumed.</p>",tip:"A robust recommendation wins at every elasticity tested. A fragile one wins only at one end, so flag it in your write-up."},
  {tab:"discount",el:"#disc-insight",title:"The discount trap",body:"<p>Discounts lower your net price, so each sale earns less. This shows how much extra volume you would need to keep today's profit, against how much your elasticity says you would actually get.</p>",tip:"Higher volume doesn't automatically mean higher profit. If the volume you need is far above what you'd get, the discount destroys value."},
  {tab:"market",el:"#sec-chain",title:"Size the market",body:"<p>TAM is everyone who could buy. SAM is the part Brew & Co can actually serve (subscription buyers in Manchester). SOM is the share it can realistically win. Each step is calculated from the one above.</p>",tip:"Check top-down against bottom-up: potential customers × average spend should land near your SAM. If the two are far apart, one of them is wrong."},
  {tab:"market",el:'#p-market [data-ai="suggest"]',title:"Using AI estimates safely",body:"<p>\"Suggest with AI\" proposes market numbers with a reason and a confidence level. Nothing changes until you accept a value, and anything you accept is labelled <b>AI assumption</b>.</p>",tip:"Treat AI numbers as a starting point. Check them against a public source, then replace them with your own wherever you can."},
  {tab:"entry",el:"#sec-entry",title:"Score the barriers",body:"<p>Rate each barrier from 1 to 10 and set how much it matters (the weight). The weighted average becomes the risk score used in the recommendation. \"Estimate with AI\" can suggest scores too.</p>",tip:"Give a weight of 0 to barriers that don't apply. For Brew & Co, competitor strength and brand matter most."},
  {tab:"strategy",el:"#verdict",title:"The recommendation",body:"<p>Enter, Partner or Don't Enter, calculated from the same model with fixed rules. The same inputs always give the same answer.</p>",tip:"A recommendation is only as good as its weakest input. Mention which assumptions it depends on when you present it."},
  {tab:"strategy",el:"#sec-score",title:"How the call was made",body:"<p>Each option earns points for profit, return on investment, speed of payback, market opportunity and risk. The higher total wins.</p>",tip:"If the two totals are close, the call could flip with small changes. Say so, and test the inputs that move the score most."},
  {tab:"strategy",el:"#ai-rec",title:"The AI explanation",body:"<p>\"Explain my results\" writes an eight-point summary using only the model's numbers. Each point is clickable and jumps to the section it came from.</p>",tip:"Use the AI summary as a first draft of your write-up, then check every number it quotes against the model."},
  {tab:"strategy",el:"#savebar",title:"Save and export",body:"<p>Saving a simulation or exporting a report needs a free profile with your name and email. You'll be asked the first time, then it carries on automatically.</p>",tip:"Save a version before each big change, so you can compare cases side by side later."},
  {final:true,title:"You've finished the walkthrough",body:`<p>You've run a full mock case: set the numbers, tested a price change, checked how sure the answer is, sized the market, scored the barriers and read the recommendation.</p><p><b>The habits that give accurate results:</b> use real figures, test elasticity at several values, check market size two ways, and check every AI number before you rely on it.</p>`,tip:""}
];
const TOV={dim:$("tourDim"),spot:$("tourSpot"),card:$("tourCard")};
const TOURS={};
TOURS.sim={steps:STEPS,ownLabel:"Start my own simulation",goTab:t=>go(t),
  setup(){const backup={S:JSON.parse(JSON.stringify(S)),trace:traceKey};S=Object.assign(fresh(),TUT_CASE);MARKET_KEYS.forEach(k=>S.src[k]="example");traceKey="op";
    anchorAll();applyRanges();syncInputs();$("linkPV").checked=true;setView("sim");go("model");render();return backup;},
  teardown(b,toHome){traceKey=b.trace;S=Object.assign(fresh(),b.S);anchorAll();applyRanges();syncInputs();$("linkPV").checked=S.link!==false;render();
    if(toHome)setView("home");else{setView("sim");go("model");}}};
function startTour(kind){if(TOUR)return;try{if(window.bbcTrack)bbcTrack("tour",kind||"sim");}catch(e){}const cfg=TOURS[kind||"sim"];if(!cfg)return;["chartModal","profileModal","hireModal"].forEach(id=>{const m=$(id);if(m)m.hidden=true;});
  TOUR={i:0,kind:kind||"sim",cfg,steps:cfg.steps};TOUR.backup=cfg.setup();TOV.card.hidden=false;showStep(0);}
function finishTour(toHome){if(!TOUR)return;const t=TOUR;TOUR=null;TOV.dim.hidden=true;TOV.spot.hidden=true;TOV.card.hidden=true;t.cfg.teardown(t.backup,toHome);if(toHome)toast("");}
function stepDone(st){return !st.check||st.check();}
function showStep(i){const SS=TOUR.steps;const prev=SS[TOUR.i];if(i!==TOUR.i&&prev&&prev.onLeave)prev.onLeave();
  TOUR.i=i;const st=SS[i];if(st.tab)TOUR.cfg.goTab(st.tab);if(st.onEnter)st.onEnter();
  $("tourStep").textContent=st.final||i===0?"":`Step ${i} of ${SS.length-2}`;
  $("tourTitle").textContent=st.title;$("tourBody").innerHTML=st.body;$("tourTip").textContent=st.tip?"Tip: "+st.tip:"";
  const d=$("tourDo");d.hidden=!st.do;if(st.do){d.textContent=(stepDone(st)?"Done. ":"Your turn: ")+st.do;d.classList.toggle("done",stepDone(st));}
  $("tourBack").hidden=i===0||!!st.final;$("tourSkip").hidden=!st.do||stepDone(st);
  const nx=$("tourNext");
  if(st.final){nx.textContent="End tutorial";nx.dataset.tour="end";nx.disabled=false;$("tourSkip").hidden=false;$("tourSkip").textContent=TOUR.cfg.ownLabel;$("tourSkip").dataset.tour="own";}
  else{nx.textContent=i===0?"Start the case":"Next";nx.dataset.tour="next";nx.disabled=!stepDone(st);$("tourSkip").textContent="Skip this step";$("tourSkip").dataset.tour="skip";}
  setTimeout(()=>{const t=st.el?q(st.el):null;if(t){t.scrollIntoView({behavior:"smooth",block:"center"});}placeTour();setTimeout(placeTour,450);},80);}
function tourRecheck(){if(!TOUR)return;const st=TOUR.steps[TOUR.i];if(st&&st.do&&!st.final){const ok=stepDone(st);const d=$("tourDo");d.textContent=(ok?"Done. ":"Your turn: ")+st.do;d.classList.toggle("done",ok);$("tourNext").disabled=!ok;$("tourSkip").hidden=ok;}reTour();}
function placeTour(){if(!TOUR)return;const st=TOUR.steps[TOUR.i];const t=st.el?q(st.el):null;const c=TOV.card;
  if(!t){TOV.spot.hidden=true;TOV.dim.hidden=false;c.style.left=Math.max(16,(innerWidth-c.offsetWidth)/2)+"px";c.style.top=Math.max(16,(innerHeight-c.offsetHeight)/2)+"px";return;}
  TOV.dim.hidden=true;TOV.spot.hidden=false;const r=t.getBoundingClientRect();const p=8;
  const top=Math.max(4,r.top-p),bot=Math.min(innerHeight-4,r.bottom+p);
  Object.assign(TOV.spot.style,{left:(r.left-p)+"px",top:top+"px",width:(r.width+2*p)+"px",height:Math.max(24,bot-top)+"px"});
  if(innerWidth<=600)return;
  const cw=c.offsetWidth,ch=c.offsetHeight;let x,y;
  if(innerHeight-r.bottom>ch+28){y=r.bottom+18;x=r.left;}
  else if(r.top>ch+28){y=r.top-ch-18;x=r.left;}
  else if(innerWidth-r.right>cw+28){x=r.right+18;y=r.top;}
  else if(r.left>cw+28){x=r.left-cw-18;y=r.top;}
  else{x=innerWidth-cw-20;y=innerHeight-ch-20;}
  c.style.left=Math.min(Math.max(16,x),innerWidth-cw-16)+"px";c.style.top=Math.min(Math.max(16,y),innerHeight-ch-16)+"px";}
let tourRaf=0;const reTour=()=>{if(!TOUR)return;cancelAnimationFrame(tourRaf);tourRaf=requestAnimationFrame(placeTour);};
window.addEventListener("scroll",reTour,{passive:true});window.addEventListener("resize",reTour);
document.addEventListener("click",e=>{const b=e.target.closest("[data-tour]");if(!b)return;e.preventDefault();const a=b.dataset.tour;
  if(a==="start")startTour("sim");
  else if(a==="start-ops")startTour("ops");
  else if(!TOUR)return;
  else if(a==="next"||a==="skip"){if(TOUR.i<TOUR.steps.length-1)showStep(TOUR.i+1);}
  else if(a==="back"){if(TOUR.i>0)showStep(TOUR.i-1);}
  else if(a==="end")finishTour(true);
  else if(a==="own")finishTour(false);});
/* re-check the "your turn" action whenever the model changes */
const _renderT=render;render=function(){const R=_renderT();if(TOUR&&TOUR.kind==="sim")tourRecheck();return R;};
