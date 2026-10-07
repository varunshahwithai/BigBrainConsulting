/* ===== Operations Bottleneck Diagnoser: calculation engine. Source of truth. No AI, no page code. ===== */
const OPS_BN_W={util:30,capacity:20,queue:15,delay:10,error:10,cancel:5,cost:10};
const OPS_BN_LABEL={util:"Utilisation",capacity:"Capacity constraint",queue:"Queue pressure",delay:"Delay rate",error:"Error rate",cancel:"Cancellation rate",cost:"Cost impact"};
const OPS_H_W={capacity:30,quality:25,speed:25,reliability:20};
const OPS_H_LABEL={capacity:"Capacity",quality:"Quality",speed:"Speed",reliability:"Reliability"};
const OPS_THRESH={low:70,healthy:85,high:100};
const OPS_STEP_FIELDS=["time","tmin","tmax","staff","machines","stations","hours","err","rwShare","rwMin","delay","delayMin","wait","cancel","labour","machCost","other"];
const OPS_PROC_FIELDS=["demand","days","revenue","margin","otRate","otMax","delayCost"];
const OPS_OBJECTIVES=[["throughput","Maximise throughput"],["cost","Minimise cost"],["delay","Reduce delays"],["error","Reduce errors"],["cx","Improve customer experience"],["roi","Maximise ROI"],["investment","Minimise investment"]];
const oclamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const odiv=(a,b)=>b?a/b:0;
let OPS_ID=0;const opsId=()=>"s"+Date.now().toString(36)+(OPS_ID++).toString(36);

/* --- templates: [name, description, time, tmin, tmax, staff, machines, stations, hours, err%, rework share%, rework min, delay%, delay min, cancel%, exit label, labour/h, machine/h, other/unit] --- */
const OPS_TEMPLATES={
  ecom:{label:"E-commerce order fulfilment",proc:"Order fulfilment",desc:"From an online order arriving to the parcel leaving the warehouse.",industry:"E-commerce",type:"Online homeware shop",biz:"Northside Goods",loc:"London",employees:12,
    demand:300,revenue:45,margin:12,otRate:20.25,otMax:1.5,delayCost:0.4,steps:[
    ["Order received","Order lands and is checked for missing details",1.0,0.5,2,1,0,0,8,1,100,4,2,30,1,"Customer cancels",14,0,0],
    ["Payment verified","Card and fraud checks before release",1.2,0.8,4,1,0,0,8,0.5,100,5,3,60,2,"Payment rejected",14,0,0],
    ["Order picked","Items collected from the shelves",6.0,4,10,4,0,0,8,3,100,8,4,45,0,"",13.5,0,0],
    ["Order packed","Items boxed, labelled and checked",5.6,4,9,4,0,3,8,4,100,10,18,60,0,"",13.5,0,1.2],
    ["Order shipped","Parcel handed to the carrier",1.3,1,3,1,0,0,8,1,100,5,6,480,0,"",14,0,3.5]]},
  rest:{label:"Restaurant order-to-delivery",proc:"Dinner service",desc:"From taking an order to the dish leaving the pass.",industry:"Hospitality",type:"Restaurant with delivery",biz:"Copper Pan",loc:"Manchester",employees:10,
    demand:220,revenue:28,margin:9,otRate:19.5,otMax:1,delayCost:1.2,steps:[
    ["Order taken","Front of house or app order",0.8,0.5,2,1,0,0,5,2,100,2,2,10,2,"Customer cancels",13,0,0],
    ["Prep","Ingredients prepared",3.5,2,6,3,0,3,5,2,100,3,5,10,0,"",13,0,2.5],
    ["Cooking","Dish cooked on the line",4.5,3,8,3,0,4,5,3,80,5,10,8,0,"",15,1.5,0],
    ["Plating and check","Plated and checked by the head chef",1.2,0.8,2,1,0,0,5,2,100,2,4,5,0,"",17,0,0.3],
    ["Driver handoff","Bagged and handed to the driver",1.0,0.5,3,1,0,0,5,1,100,2,8,15,1,"Order abandoned",12,0,0]]},
  support:{label:"Customer support ticket resolution",proc:"Ticket resolution",desc:"From a ticket arriving to it being closed.",industry:"Software",type:"Subscription software",biz:"Helpline Co",loc:"Leeds",employees:20,
    demand:400,revenue:60,margin:20,otRate:24,otMax:1,delayCost:0.6,steps:[
    ["Triage","Ticket tagged and routed",1.5,0.5,4,2,0,0,8,2,100,3,3,30,0,"",16,0,0],
    ["First response","Agent replies to the customer",5.0,2,12,5,0,0,8,3,100,5,8,60,0,"",16,0,0],
    ["Resolution","Problem fixed",8.0,3,25,8,0,0,8,6,100,12,10,120,2,"Customer churns",17,0,0],
    ["Quality review","Senior agent checks the fix",2.5,1,6,2,0,0,8,4,100,6,12,90,0,"",22,0,0],
    ["Close and survey","Ticket closed, survey sent",1.0,0.5,2,1,0,0,8,1,100,2,2,20,0,"",16,0,0]]},
  invoice:{label:"Invoice processing",proc:"Accounts payable",desc:"From a supplier invoice arriving to it being paid.",industry:"Finance operations",type:"Mid-size distributor",biz:"Ledgerline",loc:"Birmingham",employees:8,
    demand:250,revenue:0,margin:0,otRate:27,otMax:1,delayCost:1.5,steps:[
    ["Receive and scan","Invoice scanned in",1.0,0.5,2,1,1,0,7.5,1,100,3,2,60,0,"",15,0.5,0],
    ["Data entry","Details keyed into the system",4.6,3,9,3,0,0,7.5,6,100,8,5,120,0,"",15,0,0],
    ["Matching","Matched to purchase order and delivery",3.0,1,8,2,0,0,7.5,5,100,10,8,240,3,"Rejected or duplicate",16,0,0],
    ["Approval","Manager approves payment",2.0,1,5,2,0,0,5,1,100,4,15,480,0,"",30,0,0],
    ["Payment run","Payment scheduled and sent",1.5,1,3,1,0,0,7.5,0.5,100,5,2,480,0,"",18,0,0.2]]},
  recruit:{label:"Recruitment",proc:"Hiring pipeline",desc:"From an application arriving to an offer being made.",industry:"Professional services",type:"Recruitment agency",biz:"TalentBridge",loc:"Bristol",employees:6,
    demand:40,revenue:0,margin:150,otRate:30,otMax:1,delayCost:0.8,steps:[
    ["CV screen","Recruiter reviews the application",6,3,12,1,0,0,8,3,100,5,5,240,50,"Not shortlisted",20,0,0],
    ["Phone screen","Short call with the candidate",25,15,40,2,0,0,4,5,100,10,15,480,30,"Not progressed",20,0,0],
    ["Interview","Hiring manager interview",45,30,75,3,0,0,3,5,100,15,25,960,40,"Rejected",35,0,0],
    ["Offer","Offer prepared and sent",20,10,40,1,0,0,8,8,100,15,10,480,20,"Offer declined",25,0,0]]},
  mfg:{label:"Manufacturing assembly",proc:"Assembly line",desc:"From raw parts to a finished, inspected unit.",industry:"Manufacturing",type:"Bike frame maker",biz:"Forge Cycles",loc:"Sheffield",employees:14,
    demand:180,revenue:120,margin:35,otRate:22.5,otMax:1.5,delayCost:0.5,steps:[
    ["Cut parts","Tubes cut to length",2.0,1.5,3,1,1,0,8,2,50,4,3,30,0,"",15,4,8],
    ["Assemble","Frame jigged and assembled",8.0,6,12,5,0,5,8,3,100,10,4,30,0,"",15,0,2],
    ["Weld","Joints welded",3.0,2.5,5,2,1,0,8,4,80,8,8,60,0,"",17,6,1.5],
    ["Paint","Frame painted and cured",2.5,2,4,1,1,0,8,3,100,6,5,60,0,"",15,5,3],
    ["Inspect","Final quality inspection",2.0,1,4,1,0,0,8,1,100,5,2,30,1,"Scrapped",16,0,0]]},
  wh:{label:"Warehouse picking",proc:"Order picking",desc:"From an order line released to it being loaded on a truck.",industry:"Logistics",type:"Third-party warehouse",biz:"Dockside Logistics",loc:"Felixstowe",employees:15,
    demand:1200,revenue:15,margin:3,otRate:19.5,otMax:1.5,delayCost:0.2,steps:[
    ["Release wave","Lines released to pickers",0.2,0.1,0.5,1,0,0,8,0.5,100,2,1,30,0,"",14,0,0],
    ["Pick","Picker collects the line with a scanner",2.2,1.5,4,6,5,0,8,2,100,3,4,30,0,"",13,0.4,0],
    ["Sort","Lines sorted by customer",0.6,0.4,1,2,0,0,8,1,100,2,2,20,0,"",13,0,0],
    ["Load","Loaded at a dock door",0.7,0.5,1.5,3,0,2,8,0.5,100,3,5,120,0,"",13,0,0.1]]},
  onboard:{label:"Customer onboarding",proc:"Customer onboarding",desc:"From a signed contract to the customer going live.",industry:"Software",type:"B2B software company",biz:"Atlas Cloud",loc:"London",employees:9,
    demand:30,revenue:2400,margin:1500,otRate:40,otMax:1,delayCost:2,steps:[
    ["Contract check","Signed contract checked",5,3,10,1,0,0,8,2,100,10,3,240,3,"Deal falls through",28,0,0],
    ["Account setup","Workspace and users created",20,10,40,2,0,0,8,5,100,15,5,240,0,"",28,0,0],
    ["Data migration","Customer data imported",45,30,90,3,0,0,8,8,100,30,10,480,0,"",35,0,0],
    ["Training session","Live training for the customer",30,25,60,2,0,0,6,3,100,20,20,1440,2,"Customer pauses",30,0,0],
    ["Go-live review","Final check before launch",10,5,20,1,0,0,8,2,100,10,5,240,0,"",32,0,0]]}
};
function opsStepFrom(a,src){const k=["name","desc","time","tmin","tmax","staff","machines","stations","hours","err","rwShare","rwMin","delay","delayMin","cancel","exitLabel","labour","machCost","other"];
  const s={id:opsId(),wait:""};k.forEach((f,i)=>s[f]=a[i]);s.src={};OPS_STEP_FIELDS.forEach(f=>s.src[f]=src||"example");return s;}
function opsFromTemplate(key){const t=OPS_TEMPLATES[key]||OPS_TEMPLATES.ecom;
  const P={tpl:key,biz:{name:t.biz,industry:t.industry,type:t.type,employees:t.employees,location:t.loc},cur:"GBP",
    proc:{name:t.proc,desc:t.desc,owner:"Operations manager",freq:"Daily"},
    demand:t.demand,days:22,revenue:t.revenue,margin:t.margin,otRate:t.otRate,otMax:t.otMax,delayCost:t.delayCost,arrivalCV:1,
    thresh:Object.assign({},OPS_THRESH),bnW:Object.assign({},OPS_BN_W),hW:Object.assign({},OPS_H_W),objective:"roi",view:"day",
    steps:t.steps.map(a=>opsStepFrom(a,"example")),scenarios:[],rca:{},src:{}};
  OPS_PROC_FIELDS.forEach(f=>P.src[f]="example");
  return P;}
function opsBlankStep(){return opsStepFrom(["New step","",5,"","",1,0,0,8,0,100,0,0,0,0,"",14,0,0],"estimated");}

/* --- the calculation --- */
/* how many units can be worked on at once: people, machines and workstations, whichever runs out first.
   Machines can run unattended (0 people = automated step); workstations need people. */
function opsParallel(s){const st=+s.staff||0,m=+s.machines||0,ws=+s.stations||0;
  if(st<=0)return m>0?(ws>0?Math.min(m,ws):m):0;
  return Math.min(...[st,m,ws].filter(x=>x>0));}
const opsAutomated=s=>!(+s.staff>0)&&+s.machines>0;
function opsCalc(P){
  const T=P.thresh||OPS_THRESH,steps=P.steps||[],D=+P.demand||0,days=+P.days||0;
  const out=[];let inU=D,inC=D;
  steps.forEach((s,i)=>{
    const time=Math.max(0,+s.time||0),hours=Math.max(0,+s.hours||0),err=oclamp(+s.err||0,0,100)/100,rw=oclamp(s.rwShare===""||s.rwShare===undefined?100:+s.rwShare,0,100)/100,
      rwMin=Math.max(0,+s.rwMin||0),delay=oclamp(+s.delay||0,0,100)/100,delayMin=Math.max(0,+s.delayMin||0),cancel=oclamp(+s.cancel||0,0,100)/100;
    const par=opsParallel(s);
    const availMin=par*hours*60;
    const load=time+err*rw*rwMin;                       /* minutes of work per unit entering, incl. rework */
    const cap=load>0?availMin/load:(availMin>0?Infinity:0); /* units per day in normal hours */
    const capSimple=time>0?par*60/time*hours:Infinity;  /* the brief's simple formula, no rework */
    const pass=Math.max(0,1-cancel-err*(1-rw));
    const util=cap===Infinity?0:cap>0?inU/cap:(inU>0?Infinity:0);
    const otMin=par*Math.max(0,+P.otMax||0)*60;
    const capOT=load>0?(availMin+otMin)/load:(availMin+otMin>0?Infinity:0);
    const processed=Math.min(inC,capOT);
    const dropped=Math.max(0,inC-processed);
    const otHours=Math.max(0,processed*load-availMin)/60;
    const cancelled=processed*cancel,errors=processed*err,reworked=errors*rw,failed=errors*(1-rw),delayed=processed*delay;
    /* waiting: user value, or an estimate from how busy the step is */
    let wait,waitSrc,growing=false,cleared=false;
    const tmin=+s.tmin,tmax=+s.tmax;const cs=(isFinite(tmin)&&isFinite(tmax)&&s.tmin!==""&&s.tmax!==""&&tmax>tmin&&time>0)?((tmax-tmin)/4)/time:0.5;
    const ca=P.arrivalCV===undefined?1:Math.max(0,+P.arrivalCV);
    if(s.wait!==""&&s.wait!==undefined&&isFinite(+s.wait)){wait=Math.max(0,+s.wait);waitSrc=(s.src&&s.src.wait)||"estimated";}
    else{waitSrc="model";
      if(par<=0||load<=0)wait=0;
      else if(util<0.999){const c=par;wait=((ca*ca+cs*cs)/2)*(Math.pow(util,Math.sqrt(2*(c+1))-1)/(c*(1-util)))*load;wait=Math.min(wait,hours*60);}
      else{const excess=Math.max(0,inC-cap);wait=cap>0?(excess/2)*(hours*60)/cap:hours*60;wait=Math.min(wait,hours*60*3);growing=dropped>0.0001;cleared=!growing;}}
    if(!isFinite(wait))wait=0;
    const delayAvg=delay*delayMin;
    const lead=load+wait+delayAvg;
    out.push({i,id:s.id,name:s.name||("Step "+(i+1)),s,time,hours,par,availMin,load,cap,capSimple,capOT,pass,inU,inC,util,processed,dropped,otHours,cancelled,errors,reworked,failed,delayed,
      wait,waitSrc,growing,cleared,delayAvg,lead,cs,err,rw,rwMin,delay,delayMin,cancel,
      status:util>T.high/100?"Overloaded":util>=T.healthy/100?"High":util>=T.low/100?"Healthy":"Low"});
    inU=inU*pass;inC=processed*pass;});
  const n=out.length;
  /* downstream pass products */
  const passFrom=i=>{let p=1;for(let j=i;j<n;j++)p*=out[j].pass;return p;};
  out.forEach((r,i)=>{r.downPass=passFrom(i);r.capFinal=r.cap===Infinity?Infinity:r.cap*r.downPass;r.lostFinal=r.dropped*r.downPass;r.failedFinal=r.failed*passFrom(i+1);});
  const throughput=n?out[n-1].processed*out[n-1].pass:D;
  const throughputU=n?out[n-1].inU*out[n-1].pass:D;
  const capFinite=out.filter(r=>isFinite(r.capFinal));
  const procCap=capFinite.length?Math.min(...capFinite.map(r=>r.capFinal)):Infinity;
  /* money per day */
  const m=+P.margin||0,rev=+P.revenue||0;
  out.forEach(r=>{const s=r.s;const lab=+s.labour||0,mach=+s.machCost||0,oth=+s.other||0;
    r.delayHours=r.delayed*r.delayMin/60;r.delayCost=r.delayHours*(+P.delayCost||0);
    r.reworkHours=r.reworked*r.rwMin/60;r.reworkCost=r.reworkHours*lab;
    r.otCost=r.otHours*(+P.otRate||0);
    r.lostUnits=r.lostFinal+r.failedFinal;r.lostContrib=r.lostUnits*m;
    r.cancelRevenue=r.cancelled*rev;r.cancelHours=r.cancelled*r.time/60;r.cancelCost=r.cancelHours*(lab+mach)+r.cancelled*oth;
    r.revenueOpp=r.cancelRevenue+r.lostUnits*rev;
    r.impact=r.delayCost+r.reworkCost+r.otCost+r.lostContrib;
    r.hoursLost=r.reworkHours+r.cancelHours;
    r.affected=r.errors+r.delayed+r.cancelled+r.dropped;
    r.fixedCost=((+s.staff||0)*lab+(+s.machines||0)*mach)*r.hours;
    r.varCost=r.processed*oth;});
  const sum=k=>out.reduce((a,r)=>a+r[k],0);
  const prod=f=>out.reduce((a,r)=>a*(1-f(r)),1);
  const procTime=sum("load"),waitTime=sum("wait"),delayTime=sum("delayAvg"),lead=procTime+waitTime+delayTime;
  const openHours=out.length?Math.max(...out.map(r=>r.hours)):0;
  const lambda=openHours>0?throughput/openHours:0;
  const little={lambda,W:lead/60,L:lambda*lead/60,ok:openHours>0&&lead>0&&!out.some(r=>r.growing)};
  const maxUtil=out.length?Math.max(...out.map(r=>r.util)):0;
  const constraint=out.length?out.reduce((a,r)=>r.util>a.util?r:a,out[0]):null;
  const totals={throughput,throughputU,procCap,lead,procTime,waitTime,delayTime,waitShare:odiv(waitTime+delayTime,lead),maxUtil,
    delayRate:1-prod(r=>r.delay),errorRate:1-prod(r=>r.err),cancelRate:1-prod(r=>r.cancel),
    delayCost:sum("delayCost"),reworkCost:sum("reworkCost"),otCost:sum("otCost"),lostContrib:sum("lostContrib"),impact:sum("impact"),
    revenueOpp:sum("revenueOpp"),cancelRevenue:sum("cancelRevenue"),cancelCost:sum("cancelCost"),reworkHours:sum("reworkHours"),hoursLost:sum("hoursLost"),
    delayHours:sum("delayHours"),otHours:sum("otHours"),lostUnits:sum("lostUnits"),dropped:sum("dropped"),fixedCost:sum("fixedCost"),varCost:sum("varCost"),
    growing:out.some(r=>r.growing),days};
  totals.opCost=totals.fixedCost+totals.varCost+totals.otCost;
  /* bottleneck score */
  const W=P.bnW||OPS_BN_W;const wsum=Object.keys(OPS_BN_W).reduce((a,k)=>a+Math.max(0,+W[k]||0),0)||1;
  const maxWait=Math.max(0,...out.map(r=>r.wait)),maxImp=Math.max(0,...out.map(r=>r.impact));
  out.forEach(r=>{const c={util:oclamp((r.util-0.5)/0.7,0,1),capacity:isFinite(procCap)&&isFinite(r.capFinal)&&r.capFinal>0?procCap/r.capFinal:(r.capFinal===0?1:0),
      queue:maxWait>0?r.wait/maxWait:0,delay:oclamp(r.delay/0.25,0,1),error:oclamp(r.err/0.15,0,1),cancel:oclamp(r.cancel/0.10,0,1),cost:maxImp>0?r.impact/maxImp:0};
    r.comp=c;r.parts={};let t=0;Object.keys(OPS_BN_W).forEach(k=>{const p=10*Math.max(0,+W[k]||0)*c[k]/wsum;r.parts[k]=p;t+=p;});r.score=t;
    r.waitShare=odiv(r.wait,waitTime);r.severity=r.score>=7?"Severe":r.score>=5?"Moderate":r.score>=3?"Mild":"Minor";});
  const ranking=out.slice().sort((a,b)=>b.score-a.score||b.util-a.util||a.i-b.i);
  /* process health */
  const HW=P.hW||OPS_H_W;const hsum=Object.keys(OPS_H_W).reduce((a,k)=>a+Math.max(0,+HW[k]||0),0)||1;
  const hs={capacity:1-oclamp((maxUtil-(T.healthy/100))/0.5,0,1),quality:1-oclamp(totals.errorRate/0.20,0,1),
    speed:(1-totals.waitShare)*(totals.growing?0.5:1),reliability:1-oclamp((totals.delayRate+totals.cancelRate)/0.30,0,1)};
  const hparts={};let health=0;Object.keys(OPS_H_W).forEach(k=>{hparts[k]=100*Math.max(0,+HW[k]||0)*hs[k]/hsum;health+=hparts[k];});
  return{steps:out,totals,ranking,primary:ranking[0]||null,constraint,health,hs,hparts,little};}

/* --- confidence: the weakest source behind a number --- */
const OPS_CONF_RANK={actual:3,estimated:2,model:2,example:1,ai:1};
function opsConf(srcs){const lo=Math.min(...srcs.map(s=>OPS_CONF_RANK[s]||1));return lo>=3?"High":lo===2?"Medium":"Low";}
function opsStepConf(P,r,fields){return opsConf(fields.map(f=>OPS_PROC_FIELDS.includes(f)?(P.src[f]||"example"):((r.s.src||{})[f]||"example")));}

/* --- scenarios --- */
const OPS_SC_KINDS={
  staff:{label:"Add one employee",desc:"One more person at the step",inv:1500,mc:0},
  machine:{label:"Add one machine or workstation",desc:"One more machine or workstation at the step",inv:8000,mc:0},
  automate:{label:"Automate a manual step",desc:"Halves processing time and errors",inv:30000,mc:300},
  faster:{label:"Reduce processing time by 20%",desc:"Better layout, tools or training",inv:5000,mc:0},
  quality:{label:"Reduce error rate by 50%",desc:"Checklists, poka-yoke, training",inv:4000,mc:0},
  variability:{label:"Reduce demand variability",desc:"Smoother arrivals, for example batching or time slots",inv:2000,mc:0},
  sequence:{label:"Change process sequence",desc:"Move a step earlier so rejected items leave sooner",inv:1000,mc:0},
  remove:{label:"Remove an unnecessary step",desc:"Cut a step that adds no value",inv:0,mc:0},
  custom:{label:"Custom change",desc:"Any field, any step",inv:0,mc:0}};
function opsMakeScenario(P,kind,C){C=C||opsCalc(P);const k=OPS_SC_KINDS[kind];const bn=C.primary;const sc={id:opsId(),kind,name:k.label,investment:k.inv,monthlyCost:k.mc,step:bn?bn.id:null,amount:null,field:"time",op:"pct",value:-10,to:0};
  if(kind==="sequence"){const cand=C.steps.slice().sort((a,b)=>(b.cancel+b.err*(1-b.rw))-(a.cancel+a.err*(1-a.rw))||a.i-b.i)[0];sc.step=cand?cand.id:null;sc.to=0;}
  if(kind==="remove"){const cand=C.steps.slice().sort((a,b)=>a.util-b.util||b.i-a.i)[0];sc.step=cand?cand.id:null;}
  return sc;}
function opsApply(P,sc){const Q=JSON.parse(JSON.stringify(P));const idx=Q.steps.findIndex(s=>s.id===sc.step);const s=idx>=0?Q.steps[idx]:null;
  const mul=(f,x)=>{if(s)s[f]=(+s[f]||0)*x;};
  switch(sc.kind){
    case"staff":if(s&&!opsAutomated(s))s.staff=(+s.staff||0)+1;break;
    case"machine":if(s){if(+s.machines>0)s.machines=+s.machines+1;if(+s.stations>0)s.stations=+s.stations+1;}break;
    case"automate":mul("time",0.5);mul("err",0.5);if(s){if(s.tmin!=="")s.tmin=+s.tmin*0.5;if(s.tmax!=="")s.tmax=+s.tmax*0.5;}break;
    case"faster":mul("time",0.8);if(s){if(s.tmin!=="")s.tmin=+s.tmin*0.8;if(s.tmax!=="")s.tmax=+s.tmax*0.8;}break;
    case"quality":mul("err",0.5);break;
    case"variability":Q.arrivalCV=(Q.arrivalCV===undefined?1:+Q.arrivalCV)*0.5;break;
    case"sequence":if(idx>=0){const [m]=Q.steps.splice(idx,1);Q.steps.splice(oclamp(+sc.to||0,0,Q.steps.length),0,m);}break;
    case"remove":if(idx>=0&&Q.steps.length>1)Q.steps.splice(idx,1);break;
    case"custom":if(s&&sc.field){const v=+sc.value||0,cur=+s[sc.field]||0;s[sc.field]=sc.op==="set"?v:sc.op==="add"?cur+v:cur*(1+v/100);
      if(["staff","machines","stations"].includes(sc.field))s[sc.field]=Math.max(0,Math.round(s[sc.field]));
      if(["err","delay","cancel","rwShare"].includes(sc.field))s[sc.field]=oclamp(s[sc.field],0,100);
      if(s[sc.field]<0)s[sc.field]=0;}break;}
  return Q;}
function opsEval(P,sc,C0){C0=C0||opsCalc(P);const Q=opsApply(P,sc);const C=opsCalc(Q);const d=+P.days||0;
  const impactNow=C0.totals.impact*d,impactNew=C.totals.impact*d;
  const fixedDelta=(C.totals.fixedCost-C0.totals.fixedCost)*d;
  const monthlyBenefit=(impactNow-impactNew)-fixedDelta-(+sc.monthlyCost||0);
  const inv=Math.max(0,+sc.investment||0);
  const annual=monthlyBenefit*12;
  const roi=inv>0?annual/inv:(monthlyBenefit>0?Infinity:0);
  const payback=monthlyBenefit>0?inv/monthlyBenefit:null;
  const from=C0.constraint,to=C.constraint;
  const shifted=!!(from&&to&&to.id!==from.id&&from.util>=0.85);
  return{sc,Q,C,impactNow,impactNew,fixedDelta,monthlyBenefit,annual,roi,payback,inv,from,to,shifted,
    totalCost:(C.totals.fixedCost+C.totals.impact)*d+(+sc.monthlyCost||0)};}
function opsRecommend(P,C0){C0=C0||opsCalc(P);const evs=(P.scenarios||[]).map(sc=>opsEval(P,sc,C0));const obj=P.objective||"roi";
  const metric={throughput:e=>e.C.totals.throughput,cost:e=>-e.totalCost,delay:e=>-(e.C.totals.waitTime+e.C.totals.delayTime),error:e=>-e.C.totals.errorRate,
    cx:e=>-(e.C.totals.delayRate+e.C.totals.cancelRate),roi:e=>e.roi,investment:e=>-e.inv}[obj]||(e=>e.roi);
  const base={throughput:C0.totals.throughput,cost:-(C0.totals.fixedCost+C0.totals.impact)*(+P.days||0),delay:-(C0.totals.waitTime+C0.totals.delayTime),error:-C0.totals.errorRate,cx:-(C0.totals.delayRate+C0.totals.cancelRate)}[obj];
  const ok=evs.filter(e=>e.monthlyBenefit>0.005||(base!==undefined&&e.monthlyBenefit>=-0.005&&metric(e)>base+1e-9));
  const sorted=ok.slice().sort((a,b)=>{const ma=metric(a),mb=metric(b);if(ma!==mb)return mb>ma?1:-1;if(b.monthlyBenefit!==a.monthlyBenefit)return b.monthlyBenefit-a.monthlyBenefit;return a.inv-b.inv;});
  return{evs,best:sorted[0]||null,ranked:sorted,obj};}

if(typeof module!=="undefined")module.exports={OPS_TEMPLATES,OPS_BN_W,OPS_H_W,OPS_THRESH,OPS_SC_KINDS,OPS_OBJECTIVES,OPS_STEP_FIELDS,OPS_PROC_FIELDS,opsFromTemplate,opsBlankStep,opsCalc,opsParallel,opsAutomated,opsMakeScenario,opsApply,opsEval,opsRecommend,opsConf,opsStepConf};
