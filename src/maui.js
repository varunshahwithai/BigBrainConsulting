/* ===== M&A Due Diligence Analyst: screens ===== */
const MSTEPS = [["target", "Target"], ["evidence", "Evidence"], ["numbers", "Numbers"], ["health", "Financial health"], ["market", "Market"], ["risks", "Risks"], ["deal", "Synergies & price"], ["memo", "Memo"]];
const MTIER = { 1: "Official", 2: "Credible secondary", 3: "Supplementary" };
const MCURS = { GBP: "£", USD: "$", EUR: "€", INR: "₹", JPY: "¥", CHF: "CHF ", CAD: "C$", AUD: "A$", SGD: "S$", AED: "AED " };
const MTYPE_TIER = { "annual report": 1, "interim report": 1, "earnings release": 1, "regulatory filing": 1, "registry filing": 1, "investor presentation": 1, "management accounts": 1, "financial model": 2, "data provider": 2, news: 2, other: 3, search: 3, example: 1 };
function maFresh() {
  return { v: 1, step: "target", furthest: 0, target: { name: "" }, objectives: [], currency: "GBP", sources: [], facts: [], chosen: {}, profile: null, isPublic: null,
    commercial: {}, market: null, news: null, debtNotes: [], qualitative: [], searchHits: [], flagAI: null, risks: {}, thresholds: { red: 15, amber: 8 }, synergies: [], synAI: null,
    valuation: { multiples: { downside: 6, base: 8, upside: 10 }, ebitdaAdj: { downside: -15, base: 0, upside: 10 } }, memo: null, memoEdited: false, memoAI: false, allMetrics: false, extraYears: [], example: false };
}
let MA = null;
try { const d = JSON.parse(localStorage.getItem("ma-draft") || "null"); if (d && d.v === 1) MA = d; } catch (e) {}
if (!MA) MA = maFresh();
let MTAB = MA.step || "target", MBUSY = null, MCELL = null, mResumeShown = false, MA_A = null, mUndo = null;
function maSave() { clearTimeout(maSave.t); maSave.t = setTimeout(() => { try { localStorage.setItem("ma-draft", JSON.stringify(MA)); } catch (e) {} }, 300); }
const mIdx = (k) => MSTEPS.findIndex((s) => s[0] === k);
const mId = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);
function mSetCur() { MA_CUR = MCURS[MA.currency] || MA.currency + " "; }
const mPct = (x, d) => (x === null || x === undefined || !isFinite(x) ? "—" : (x * 100).toFixed(d === undefined ? 1 : d) + "%");
const mX = (x) => (x === null || x === undefined || !isFinite(x) ? "—" : x.toFixed(1) + "×");
function mGet(p) { return p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), MA); }
function mSet(p, v) { const ks = p.split("."); let o = MA; ks.slice(0, -1).forEach((k) => { if (o[k] == null || typeof o[k] !== "object") o[k] = {}; o = o[k]; }); o[ks[ks.length - 1]] = v; }
/** "245m", "1.2bn", "£300,000", "40k" → number */
function mParseMoney(s) {
  if (s === null || s === undefined) return null; s = String(s).trim().toLowerCase().replace(/[£$€₹¥,\s]/g, "").replace(/^(chf|aed|c\$|a\$|s\$)/, "");
  if (!s) return null; const m = s.match(/^(-?\d*\.?\d+)(k|m|mn|bn|b)?$/); if (!m) return NaN;
  return +m[1] * ({ k: 1e3, m: 1e6, mn: 1e6, bn: 1e9, b: 1e9 }[m[2]] || 1);
}
function mMoneyIn(v) { if (v === null || v === undefined || v === "" || !isFinite(v)) return ""; const a = Math.abs(v), r = (x) => String(+x.toFixed(3)); return a >= 1e9 ? r(v / 1e9) + "bn" : a >= 1e6 ? r(v / 1e6) + "m" : a >= 1e3 ? r(v / 1e3) + "k" : String(v); }

/* ---------- navigation ---------- */
function mProg() {
  const cur = mIdx(MTAB), far = Math.max(MA.furthest || 0, cur);
  $("mprog").innerHTML = MSTEPS.map(([k, l], i) => `<button type="button" class="ost${i === cur ? " cur" : ""}${i < cur ? " done" : ""}" data-mstep="${k}" ${i > far ? "disabled" : ""} ${i === cur ? 'aria-current="step"' : ""}><span class="n">${i < cur ? "✓" : i + 1}</span><span class="l">${l}</span></button>`).join("");
}
function maGo(t, noScroll) {
  if (mIdx(t) < 0) return; MTAB = t; MA.step = t; MA.furthest = Math.max(MA.furthest || 0, mIdx(t));
  MSTEPS.forEach(([k]) => { $("mp-" + k).hidden = k !== t; }); maSave();
  if (t === "deal") { MA_A = maAll(MA); mBuildDeal(); }
  if (t === "target") mBuildTarget();
  if (!noScroll && !$("ma").hidden) setTimeout(() => { const a = $("mapp"); if (a && a.getBoundingClientRect().top < 0) a.scrollIntoView({ behavior: "smooth", block: "start" }); }, 0);
  setTimeout(maRender, 0);
}
function mNext(d) { const i = mIdx(MTAB) + d; if (i < 0 || i >= MSTEPS.length) return; if (MTAB === "target" && d > 0 && !(MA.target.name || "").trim()) { const n = $("m-name"); if (n) { n.focus(); n.classList.add("flash"); } return; } maGo(MSTEPS[i][0]); }

/* ---------- step 1: target ---------- */
function mField(path, label, help, opts) {
  opts = opts || {}; const id = "m-" + path.replace(/\./g, "-"); const v = mGet(path);
  const val = opts.money ? mMoneyIn(v) : v === undefined || v === null ? "" : v;
  return `<div class="field text"><label for="${opts.id || id}">${label}${help ? `<small>${help}</small>` : ""}</label><input id="${opts.id || id}" type="text" ${opts.money || opts.num ? 'inputmode="decimal"' : ""} data-mk="${path}" ${opts.money ? 'data-money="1"' : ""} ${opts.num ? 'data-num="1"' : ""} value="${esc(val)}" placeholder="${esc(opts.ph || "")}" autocomplete="off"></div>`;
}
function mBuildTarget() {
  $("m-target-main").innerHTML = mField("target.name", "Company name", "The business you're thinking of buying", { id: "m-name", ph: "e.g. Greggs plc" }) + mField("target.industry", "Industry", "Optional", { ph: "e.g. Food retail" });
  $("m-target-more").innerHTML = mField("target.website", "Website", "", { ph: "e.g. greggs.co.uk" }) + mField("target.country", "Main country", "", { ph: "e.g. United Kingdom" }) + mField("target.hq", "Headquarters", "") +
    mField("target.ticker", "Stock ticker", "If it's listed", { ph: "e.g. GRG.L" }) + mField("target.acquirer", "Buyer", "You or your company, if known") + mField("target.rationale", "Why buy it?", "One sentence") +
    mField("valuation.price", "Indicative price", "What you might pay for the shares, e.g. 900m", { money: true, id: "m-t-price" }) + mField("valuation.ownership", "Stake you'd buy", "Percent, 100 for the whole company", { num: true, ph: "100", id: "m-t-own" });
  mBuildObjectives();
}
function mBuildObjectives() { $("m-objectives").innerHTML = MA_OBJECTIVES.map((o) => `<button type="button" class="mchip" data-mobj="${esc(o)}" aria-pressed="${MA.objectives.includes(o)}">${esc(o)}</button>`).join(""); }

/* ---------- research + uploads ---------- */
function mSrcByUrlOrTitle(url, title) {
  const u = (url || "").trim(), t = (title || "").trim().toLowerCase();
  return MA.sources.find((s) => (u && s.url === u) || (t && (s.title || "").toLowerCase() === t));
}
function mAddSource(o) {
  const ex = mSrcByUrlOrTitle(o.url, o.title); if (ex) { Object.keys(o).forEach((k) => { if (o[k] !== undefined && o[k] !== null && o[k] !== "" && (ex[k] === undefined || ex[k] === null || ex[k] === "")) ex[k] = o[k]; }); if (o.status === "analysed") ex.status = "analysed"; return ex; }
  const s = Object.assign({ id: mId(), status: "found" }, o); s.tier = s.tier || MTYPE_TIER[(s.type || "other").toLowerCase()] || 3; MA.sources.push(s); return s;
}
function mAddFact(f) {
  const v = maAbs(f.value, f.unit); if (v === null || !MA_METRIC_NAME[f.metric] || !f.year) return;
  const year = maYearLabel(f.year); if (!maYearKey(year)) return;
  const value = f.metric === "capex" || f.metric === "cogs" || f.metric === "interest" ? Math.abs(v) : v;
  const dup = MA.facts.find((x) => x.metric === f.metric && x.year === year && x.sourceId === f.sourceId); if (dup) { dup.value = value; return; }
  MA.facts.push({ id: mId(), metric: f.metric, year, value, currency: (f.currency || MA.currency || "").toUpperCase(), sourceId: f.sourceId, page: f.page || null, status: f.status, note: f.note || "", adjusted: !!f.adjusted });
}
function mOnline() { return !IN_CLAUDE && location.protocol !== "file:"; }
async function mResearch(task) {
  if (MBUSY) return;
  if (!(MA.target.name || "").trim()) { maGo("target"); return; }
  if (!mOnline()) { mWorking(`<p class="small">Online research works on the live website (bigbrainconsulting.pages.dev). Here you can still upload documents or type figures yourself.</p>`); return; }
  if (!PROFILE) { needProfile(() => mResearch(task), "research companies online"); return; }
  const LABEL = { profile: ["Researching the company", ["What it does and how it makes money", "Where it operates and who owns it", "Which financial documents exist"]], financials: ["Finding financial results", ["Looking for the latest annual report", "Collecting up to 3 years of figures", "Recording the source of every figure"]], debt: ["Checking debt and cash", ["Latest debt and cash figures", "Debt maturities and refinancing"]], market: ["Researching the market", ["Market size and growth, with region and definition", "Competitors, trends and regulation"]], news: ["Looking for recent news and risks", ["Material developments in the last 2 years", "Risks mentioned in credible sources"]] }[task];
  MBUSY = task; maRender();
  try {
    const r = await bbcApi("ma/research", { uid: webUid(), task, target: MA.target });
    mApplyResearch(task, r.data || {}, r.sources || [], !!r.noSearch);
    MA.lastResearch = { task, at: Date.now(), hits: (r.sources || []).length, noSearch: !!r.noSearch };
    toastM(`${LABEL[0]}: done.`);
  } catch (e) {
    MA.lastResearch = { task, at: Date.now(), error: e.message || "Research failed." };
    if (e.code === "profile_needed") { PROFILE = null; needProfile(() => mResearch(task), "research companies online"); }
  }
  MBUSY = null; maSave(); maRender();
}
function mWorking(html) { const w = MTAB === "market" ? $("m-working2") : $("m-working"); if (!w) return; w.hidden = !html; w.innerHTML = html || ""; }
function mApplyResearch(task, d, hits, noSearch) {
  hits.forEach((h) => { if (!MA.searchHits.some((x) => x.uri === h.uri)) MA.searchHits.push({ uri: h.uri, title: h.title, task }); });
  MA.searchHits = MA.searchHits.slice(-60);
  const srcFor = (o, typeFallback) => {
    const type = (o.source_type || o.type || typeFallback || "other").toLowerCase();
    const title = o.source_title || o.title || (o.source_url ? (o.source_url.replace(/^https?:\/\//, "").split("/")[0]) : "Web search result");
    return mAddSource({ kind: "web", title, url: o.source_url || o.url || "", publisher: o.publisher || (o.source_url ? o.source_url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : ""), type, date: o.date || "", period: o.period || "", inSearch: !!o.in_search_results, tier: MTYPE_TIER[type] || 3, task });
  };
  if (task === "profile") {
    MA.profile = d; MA.isPublic = d.is_public === true ? true : d.is_public === false ? false : null;
    if (d.currency && /^[A-Z]{3}$/.test(d.currency) && !MA.facts.length) MA.currency = d.currency;
    (d.documents || []).slice(0, 15).forEach((doc) => srcFor(Object.assign({}, doc, { source_url: doc.url, source_title: doc.title, in_search_results: doc.in_search_results }), doc.type));
  }
  if (task === "financials" || task === "debt") {
    (d.facts || []).forEach((f) => {
      const s = srcFor(f);
      const official = !noSearch && (MTYPE_TIER[(f.source_type || "").toLowerCase()] || 3) === 1 && f.in_search_results;
      if (official) s.status = "analysed";
      mAddFact({ metric: f.metric, year: f.period, value: f.value, unit: f.unit, currency: f.currency || d.currency, sourceId: s.id, status: official ? "web" : "unverified", note: noSearch ? "From the AI's general knowledge, not a live search" + (f.note ? ". " + f.note : "") : f.note });
    });
    if (d.currency && /^[A-Z]{3}$/.test(d.currency) && !MA.facts.some((f) => f.status === "reported" || f.status === "user")) MA.currency = d.currency;
    if (task === "debt") (d.debt_notes || []).forEach((n) => { if (n && n.text) MA.debtNotes.push({ text: n.text, source: n.source_title || "", url: n.source_url || "" }); });
    MA.missing = d.missing || [];
  }
  if (task === "market") {
    MA.market = d;
    (d.market_size || []).forEach((m) => srcFor(Object.assign({ source_type: "data provider" }, m)));
    if (typeof d.growth_pct === "number" && isFinite(d.growth_pct) && (MA.commercial.growthPct === undefined || MA.commercial.growthPct === "" || MA.commercial.growthSrc === "research")) { MA.commercial.growthPct = d.growth_pct; MA.commercial.growthSrc = "research"; }
  }
  if (task === "news") { MA.news = d; (d.developments || []).forEach((x) => x.source_url && srcFor(Object.assign({ source_type: "news" }, x))); }
}
function mReadFile(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onerror = () => rej(new Error("Couldn't read the file.")); r.onload = () => res(r.result); if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") r.readAsDataURL(file); else if (/\.(xlsx|xls)$/i.test(file.name)) r.readAsArrayBuffer(file); else r.readAsText(file); });
}
let mXlsx = null;
function mLoadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (mXlsx) return mXlsx;
  mXlsx = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = () => res(window.XLSX); s.onerror = () => rej(new Error("Couldn't load the spreadsheet reader.")); document.head.appendChild(s); });
  return mXlsx;
}
async function mUpload(files) {
  if (MBUSY || !files || !files.length) return;
  if (!(MA.target.name || "").trim()) { maGo("target"); return; }
  if (!mOnline()) { mWorking(`<p class="small">Reading documents works on the live website (bigbrainconsulting.pages.dev). Here you can type figures yourself in step 3.</p>`); return; }
  if (!PROFILE) { needProfile(() => mUpload(files), "upload documents"); return; }
  const list = [...files].slice(0, 5);
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    MBUSY = "upload:" + f.name + (list.length > 1 ? ` (${i + 1} of ${list.length})` : ""); maRender();
    try {
      if (f.size > 19.5 * 1024 * 1024 && /\.pdf$/i.test(f.name)) throw new Error("This PDF is over about 19 MB. Upload just the financial statements pages instead.");
      const raw = await mReadFile(f); let body = { uid: webUid(), filename: f.name, target: MA.target };
      if (typeof raw === "string" && raw.startsWith("data:")) body.pdf = raw.split(",")[1];
      else if (raw instanceof ArrayBuffer) { const X = await mLoadXlsx(); const wb = X.read(raw, { type: "array" }); body.text = wb.SheetNames.slice(0, 12).map((n) => `--- Sheet: ${n} ---\n` + X.utils.sheet_to_csv(wb.Sheets[n]).split("\n").slice(0, 400).join("\n")).join("\n\n"); }
      else body.text = String(raw).slice(0, 400000);
      const r = await bbcApi("ma/extract", body);
      const d = r.data || {}, doc = d.document || {};
      const s = mAddSource({ kind: "upload", title: doc.title || f.name, filename: f.name, publisher: doc.publisher || "", type: (doc.type || "other").toLowerCase(), date: doc.date || "", period: doc.period || "", status: "analysed", currency: doc.currency || "" });
      s.tier = MTYPE_TIER[s.type] === 1 ? 1 : 2; s.status = "analysed";
      if (doc.currency && /^[A-Z]{3}$/.test(doc.currency) && !MA.facts.some((x) => x.status === "reported" || x.status === "user")) MA.currency = doc.currency;
      (d.facts || []).forEach((x) => mAddFact({ metric: x.adjusted && x.metric === "ebitda" ? "adjEbitda" : x.metric, year: x.period, value: x.value, unit: x.unit || doc.unit, currency: doc.currency, sourceId: s.id, status: "reported", page: x.page, adjusted: x.adjusted }));
      (d.qualitative || []).slice(0, 30).forEach((q) => q && q.text && MA.qualitative.push({ sourceId: s.id, topic: q.topic || "", text: q.text, page: q.page || null }));
      s.factCount = (d.facts || []).length;
      toastM(`Read "${f.name}": ${s.factCount} figure${s.factCount === 1 ? "" : "s"} found.`);
      MA.lastResearch = { task: "upload", at: Date.now(), file: f.name, count: s.factCount };
    } catch (e) {
      MA.lastResearch = { task: "upload", at: Date.now(), file: f.name, error: e.message || "Couldn't read this file." };
      if (e.code === "profile_needed") { PROFILE = null; }
    }
    maSave();
  }
  MBUSY = null; maSave(); maRender();
}
function toastM(t) { const el = $("mtoast"); if (el) el.textContent = t; }

/* ---------- example (made-up company) ---------- */
function mLoadExample() {
  mUndo = JSON.stringify(MA);
  const M = maFresh(); M.example = true; M.target = { name: "Northwind Bakeries plc", industry: "Bakery and food-to-go", country: "United Kingdom", hq: "Leeds", website: "", ticker: "", acquirer: "Your café group", rationale: "Expand into the North of England" };
  M.objectives = ["Geographic expansion", "Cost synergies"]; M.currency = "GBP"; M.isPublic = true;
  const s1 = { id: "ex1", kind: "upload", title: "Northwind Bakeries Annual Report 2025 (example)", filename: "example-annual-report.pdf", publisher: "Northwind Bakeries plc", type: "annual report", date: "2025-04", period: "FY2025", status: "analysed", tier: 1, example: true };
  const s2 = { id: "ex2", kind: "web", title: "Northwind results coverage (example)", url: "", publisher: "Example news site", type: "news", date: "2025-05", period: "FY2025", status: "found", tier: 2, example: true };
  M.sources = [s1, s2];
  const rows = { FY2023: [210e6, 126e6, 31e6, 0, 19e6, 11e6, 27e6, 9e6, 24e6, 62e6, 4.1e6, 15e6, 6e6], FY2024: [228e6, 139e6, 33e6, 35e6, 20e6, 11.5e6, 26e6, 11e6, 21e6, 74e6, 4.6e6, 19e6, 7e6], FY2025: [246e6, 152e6, 34e6, 41e6, 20e6, 11e6, 23e6, 13e6, 17e6, 89e6, 5.6e6, 25e6, 8.5e6] };
  const keys = ["revenue", "cogs", "ebitda", "adjEbitda", "ebit", "netIncome", "ocf", "capex", "cash", "totalDebt", "interest", "receivables", "inventory"];
  const pages = { revenue: 64, cogs: 64, ebitda: 21, adjEbitda: 22, ebit: 64, netIncome: 64, ocf: 67, capex: 67, cash: 65, totalDebt: 88, interest: 64, receivables: 65, inventory: 65 };
  Object.entries(rows).forEach(([y, vals]) => vals.forEach((v, i) => { if (v) M.facts.push({ id: "e" + y + i, metric: keys[i], year: y, value: v, currency: "GBP", sourceId: "ex1", page: pages[keys[i]], status: "reported" }); }));
  M.facts.push({ id: "enews", metric: "revenue", year: "FY2025", value: 250e6, currency: "GBP", sourceId: "ex2", status: "unverified", note: "Rounded figure in a news article" });
  M.qualitative = [{ sourceId: "ex1", topic: "Customers", text: "The largest wholesale customer (a supermarket chain) accounted for 18% of revenue.", page: 34 }, { sourceId: "ex1", topic: "Debt", text: "A £60m bank facility is due for renewal in 2027.", page: 88 }, { sourceId: "ex1", topic: "One-off items", text: "Adjusted EBITDA excludes £7m of store closure and restructuring costs.", page: 22 }];
  M.profile = { overview: "A made-up UK bakery chain with 180 shops and a wholesale business supplying supermarkets, used to show how the tool works.", business_model: "Sells baked goods through its own shops (70% of sales) and wholesale contracts (30%).", geography: "Northern England and the Midlands", key_risks: ["Rising ingredient and energy costs", "Dependence on one large supermarket customer"] };
  M.market = { market_definition: "UK bakery and food-to-go market (example)", geography: "United Kingdom", market_size: [{ value: 9.5, unit: "billions", currency: "GBP", year: "2025", scope: "UK", definition: "Bakery and food-to-go sales", source_title: "Example industry report", source_url: "", date: "2025" }], growth_pct: 3.5, competitors: [{ name: "Large national bakery chains", note: "Strong brands and scale" }, { name: "Supermarket in-store bakeries", note: "Low prices" }], trends: ["Growth in food-to-go and breakfast", "Pressure from ingredient and wage costs"], regulation: ["Calorie labelling rules for large food businesses"], opportunities: ["Expansion into new regions"], threats: ["Cost inflation squeezing margins"], summary: "A large, slowly growing market with strong competition." };
  M.commercial = { growthPct: 3.5, growthSrc: "research" };
  M.risks = { customers: { l: 3, i: 4, note: "Largest customer is 18% of revenue (annual report p.34)." }, fit: { l: 2, i: 4, note: "Fits the buyer's plan to expand into the North." } };
  M.synergies = [{ id: "sy1", name: "Combined flour and ingredient buying", category: "Procurement", type: "cost", label: "estimate", base: 60e6, pct: 4, prob: 70, recurringCost: 0, implCost: 0.5e6, years: 1 }, { id: "sy2", name: "Merge head office functions", category: "Finance and admin", type: "cost", label: "estimate", base: 12e6, pct: 20, prob: 60, recurringCost: 0.2e6, implCost: 2e6, years: 2 }];
  M.valuation = { price: 250e6, ownership: 100, multiples: { downside: 6, base: 7.5, upside: 9 }, ebitdaAdj: { downside: -15, base: 0, upside: 8 }, txCosts: 6e6, integrationCosts: 4e6 };
  M.step = "evidence"; M.furthest = 7;
  MA = M; mBuildAll(); maGo("evidence"); maSave();
}

/* ---------- step 2 render ---------- */
function mRenderEvidence() {
  const busy = MBUSY;
  if (busy) {
    const up = busy.startsWith("upload:");
    const L = up ? ["Reading your document", ["Identifying the document and its reporting period", "Finding the financial statements", "Copying figures with their page numbers"]] : { profile: ["Researching the company", ["What it does and how it makes money", "Where it operates and who owns it", "Which financial documents exist"]], financials: ["Finding financial results", ["Looking for the latest annual report", "Collecting up to 3 years of figures", "Recording the source of every figure"]], debt: ["Checking debt and cash", ["Latest debt and cash figures", "Debt maturities and refinancing"]], market: ["Researching the market", ["Market size and growth, with region and definition", "Competitors, trends and regulation"]], news: ["Looking for recent news and risks", ["Material developments in the last 2 years", "Risks mentioned in credible sources"]] }[busy] || ["Working", []];
    mWorking(`<div class="row"><span class="mspin" aria-hidden="true"></span><h3 style="margin:0">${L[0]}${up ? ": " + esc(busy.slice(7)) : ""}…</h3></div><p class="small muted">This is what's being looked for. It usually takes ${up ? "30 seconds to 2 minutes" : "20 to 60 seconds"}; please keep this page open.</p><ul class="small mlist">${L[1].map((x) => `<li>${x}</li>`).join("")}</ul>`);
  } else if (MA.lastResearch && MA.lastResearch.noSearch && Date.now() - MA.lastResearch.at < 1800000) {
    mWorking(`<p class="small"><b>Heads up:</b> live Google search wasn't available on the free AI plan for this request, so these results come from the AI's general knowledge. They may be out of date, and every figure is marked Unverified. For reliable numbers, upload the company's annual report.</p>`);
  } else if (MA.lastResearch && MA.lastResearch.error && Date.now() - MA.lastResearch.at < 600000) {
    mWorking(`<p class="small neg"><b>That didn't work:</b> ${esc(MA.lastResearch.error)}</p>`);
  } else mWorking("");
  document.querySelectorAll("[data-mresearch]").forEach((b) => (b.disabled = !!busy));
  const fi = $("m-file"); if (fi) fi.disabled = !!busy;
  $("m-allow").textContent = mOnline() ? "Uses your free profile. Up to 15 research runs or document reads a day." : "Online research and document reading work on the live website.";
  const pv = $("m-private");
  pv.hidden = MA.isPublic !== false;
  pv.innerHTML = `<b>This looks like a private company.</b> Private companies usually don't publish full accounts, so financial data will be limited and mostly unverified. The market, competitors and risks can still be assessed. For a full walkthrough, try a listed company, or upload documents if you have them.`;
  const C = MA_A.C, q = C.quality;
  const sm = $("m-summary");
  if (MA.sources.length || MA.facts.length) {
    const analysed = MA.sources.filter((s) => s.status === "analysed").length, excluded = MA.sources.filter((s) => s.status === "excluded").length;
    const sugg = [];
    if (!MA.profile) sugg.push(`<button class="linkbtn" type="button" data-mresearch="profile">Research the company</button>`);
    if (!C.T.years.length || q.missing.length) sugg.push(`<button class="linkbtn" type="button" data-mresearch="financials">Find financial results</button>`);
    if (q.missing.includes("totalDebt") || q.missing.includes("cash")) sugg.push(`<button class="linkbtn" type="button" data-mresearch="debt">Check debt and cash</button>`);
    if (q.unverified) sugg.push("Upload the annual report to turn unverified figures into reported ones");
    sm.hidden = false;
    sm.innerHTML = `<h3>What we have so far</h3><div class="cl"><span>Sources</span><b>${MA.sources.length}${excluded ? ` (${excluded} excluded)` : ""}</b><span>Documents read or confirmed</span><b>${analysed}</b><span>Years covered</span><b>${C.T.years.length ? C.T.years.join(", ") : "None yet"}</b><span>Figures from official documents</span><b>${q.verified}</b><span>Unverified figures</span><b class="${q.unverified ? "" : ""}">${q.unverified}</b><span>Core figures missing (latest year)</span><b>${q.missing.length ? q.missing.map((m) => MA_METRIC_NAME[m]).join(", ") : "None"}</b><span>Sources that disagree</span><b class="${q.conflicts ? "neg" : ""}">${q.conflicts}</b></div>
      ${C.T.fxSkipped ? `<p class="small neg">${C.T.fxSkipped} figure${C.T.fxSkipped > 1 ? "s are" : " is"} in a different currency from ${MA.currency} and ${C.T.fxSkipped > 1 ? "aren't" : "isn't"} used. Change the currency in step 3 if needed.</p>` : ""}
      ${sugg.length ? `<p class="small"><b>Suggested next:</b> ${sugg.join(" · ")}</p>` : ""}`;
  } else sm.hidden = true;
  const P = MA.profile, pr = $("m-profile");
  if (P) {
    pr.hidden = false;
    const li = (a) => (a && a.length ? `<ul class="small mlist">${a.slice(0, 8).map((x) => `<li>${esc(typeof x === "string" ? x : x.name || JSON.stringify(x))}</li>`).join("")}</ul>` : "");
    pr.innerHTML = `<div class="row"><h3>Company overview</h3><span class="chip ai">${MA.example ? "Example" : "AI summary of web research"}</span></div>
      ${P.overview ? `<p>${esc(P.overview)}</p>` : ""}<div class="cl">${[["Business model", P.business_model], ["Where it operates", P.geography], ["Ownership", P.ownership], ["Listed", P.listing || (MA.isPublic === false ? "Private company" : "")], ["Strategy", P.strategy], ["Management", P.management], ["Financial year end", P.fiscal_year_end]].filter((x) => x[1]).map(([l, v]) => `<span>${l}</span><b style="text-align:left;font-weight:500">${esc(v)}</b>`).join("")}</div>
      ${P.products && P.products.length ? `<h4>Products and services</h4>${li(P.products)}` : ""}${P.recent_deals && P.recent_deals.length ? `<h4>Recent deals</h4>${li(P.recent_deals)}` : ""}${P.key_risks && P.key_risks.length ? `<h4>Risks mentioned</h4>${li(P.key_risks)}` : ""}
      ${P.missing && P.missing.length ? `<p class="small muted"><b>Couldn't find:</b> ${P.missing.map(esc).join("; ")}</p>` : ""}
      <p class="small muted">Summaries are written by AI from search results. Check important points against the original sources below.</p>`;
  } else pr.hidden = true;
  $("m-srccount").textContent = MA.sources.length ? `${MA.sources.length} source${MA.sources.length > 1 ? "s" : ""}` : "";
  const used = (s) => MA.facts.filter((f) => f.sourceId === s.id).length;
  const rows = MA.sources.slice().sort((a, b) => (a.status === "excluded") - (b.status === "excluded") || a.tier - b.tier).map((s) => {
    const n = used(s);
    const st = s.example ? "Example" : s.status === "excluded" ? "Excluded" : s.kind === "upload" ? "Read" : s.status === "analysed" ? "Confirmed by search" : "Found";
    return `<div class="msrc${s.status === "excluded" ? " off" : ""}"><div class="msrc-h"><span class="mtier t${s.tier}">${MTIER[s.tier]}</span><b>${esc(s.title)}</b></div>
      <div class="small muted">${[s.kind === "upload" ? "Uploaded: " + esc(s.filename || "") : esc(s.publisher || ""), esc(s.type || ""), s.date && "Published " + esc(s.date), s.period && "Covers " + esc(s.period)].filter(Boolean).join(" · ")}</div>
      <div class="small">${st}${n ? ` · ${n} figure${n > 1 ? "s" : ""} used` : ""}${s.kind === "web" && s.url && !s.inSearch && !s.example ? ` · <span class="neg">link not seen in the search results: check it</span>` : ""}</div>
      <div class="row">${s.url ? `<a class="pill sm ghost" href="${esc(s.url)}" target="_blank" rel="noopener">Open original</a>` : ""}<button class="pill sm ghost" type="button" data-msrc="${s.id}">${s.status === "excluded" ? "Include" : "Exclude"}</button>${s.kind === "web" && /annual report|interim|filing|presentation/.test(s.type || "") && !s.example ? `<button class="linkbtn small" type="button" data-mpick="1">Upload this document to read it fully</button>` : ""}</div></div>`;
  });
  $("m-sources").innerHTML = (rows.join("") || `<p class="muted small">No sources yet. Use one of the two options above, or <button class="linkbtn" type="button" data-mexample="1">load the worked example</button>.</p>`) +
    (MA.searchHits.length ? `<details class="more" style="margin-top:10px"><summary>All search results Gemini used (${MA.searchHits.length})</summary><ul class="small mlist">${MA.searchHits.map((h) => `<li><a href="${esc(h.uri)}" target="_blank" rel="noopener">${esc(h.title)}</a></li>`).join("")}</ul></details>` : "");
}

/* ---------- step 3 numbers ---------- */
const M_SHOW = ["revenue", "grossProfit", "ebitda", "adjEbitda", "ebit", "netIncome", "ocf", "capex", "cash", "totalDebt"];
function mYearsShown(C) { const ys = [...new Set(C.T.years.concat(MA.extraYears || []))].sort((a, b) => maYearKey(a) - maYearKey(b)); return ys.slice(-3); }
function mTag(c) {
  if (!c) return "";
  const s = MA.sources.find((x) => x.id === c.sourceId);
  if (s && s.example) return `<span class="mtag example">Example${c.page ? " p." + c.page : ""}</span>`;
  return c.status === "reported" ? `<span class="mtag reported">Reported${c.page ? " p." + c.page : ""}</span>` : c.status === "web" ? `<span class="mtag web">Web</span>` : c.status === "user" ? `<span class="mtag user">You</span>` : `<span class="mtag unverified">Unverified</span>`;
}
function mRenderNumbers() {
  const C = MA_A.C, years = mYearsShown(C);
  $("m-cur").innerHTML = Object.keys(MCURS).concat(MCURS[MA.currency] ? [] : [MA.currency]).map((c) => `<option value="${c}"${c === MA.currency ? " selected" : ""}>${c}</option>`).join("");
  const conf = C.T.conflicts;
  $("m-conflicts").innerHTML = conf.length ? `<div class="card big mconf"><h3>${conf.filter((c) => !c.resolved).length ? "Sources disagree on " + conf.filter((c) => !c.resolved).length + " figure" + (conf.filter((c) => !c.resolved).length > 1 ? "s" : "") : "Conflicts you've resolved"}</h3><p class="small muted">Pick which figure to use. Differences can come from rounding, restated accounts, different reporting periods or adjusted versus reported numbers.</p>
    ${conf.map((c) => `<div class="mconf-i"><b>${MA_METRIC_NAME[c.metric]} ${c.year}</b>${c.options.map((o) => { const s = MA.sources.find((x) => x.id === o.sourceId); return `<label class="mopt"><input type="radio" name="mc-${c.key}" data-mchoose="${c.key}" value="${o.id}" ${c.using.id === o.id ? "checked" : ""}> <span><b>${maFmt(o.value)}</b> ${mTag(o)} <span class="small muted">${esc(s ? s.title : "")}${o.note ? " · " + esc(o.note) : ""}</span></span></label>`; }).join("")}${c.resolved ? `<span class="small ok">✓ Your choice</span>` : `<span class="small muted">Currently using the most reliable source.</span>`}</div>`).join("")}</div>` : "";
  $("m-th").innerHTML = `<tr><th>Figure</th>${years.map((y) => `<th>${y}</th>`).join("")}</tr>`;
  const metrics = MA.allMetrics ? MA_METRICS.map((m) => m[0]) : M_SHOW.concat(MA_METRICS.map((m) => m[0]).filter((m) => !M_SHOW.includes(m) && years.some((y) => C.T.cells[m + "|" + y])));
  if (!years.length) { $("m-tb").innerHTML = `<tr><td colspan="2" class="muted small">No figures yet. Research the company or upload documents in step 2, or <button class="linkbtn" type="button" data-maddyear="1">add a year</button> and type figures in yourself.</td></tr>`; }
  else $("m-tb").innerHTML = metrics.map((m) => `<tr><td>${MA_METRIC_NAME[m]}${m === "grossProfit" ? '<small class="muted"> (or revenue − COGS)</small>' : ""}</td>${years.map((y) => { const key = m + "|" + y, c = C.T.cells[key]; const calcGp = m === "grossProfit" && !c ? (C.rows.find((r) => r.year === y) || {}).grossProfit : null;
      return `<td><button type="button" class="mcell${MCELL === key ? " on" : ""}" data-mcell="${key}">${c ? `<b>${maFmt(c.value)}</b>${mTag(c)}` : calcGp !== null && calcGp !== undefined ? `<b>${maFmt(calcGp)}</b><span class="mtag calc">Calculated</span>` : `<span class="muted">Missing</span>`}</button></td>`; }).join("")}</tr>`).join("");
  $("m-allmetrics").textContent = MA.allMetrics ? "Show fewer figures" : "Show all figures";
  // cell detail
  const ci = $("m-cellinfo");
  if (MCELL) {
    const [m, y] = MCELL.split("|"); const c = C.T.cells[MCELL]; const s = c && MA.sources.find((x) => x.id === c.sourceId);
    const opts = MA.facts.filter((f) => f.metric === m && maYearLabel(f.year) === y);
    ci.innerHTML = `<div class="mci"><div class="row"><h4 style="margin:0">${MA_METRIC_NAME[m]}, ${y}</h4><span class="spacer"></span><button class="xbtn" type="button" data-mcellclose="1" aria-label="Close">×</button></div>
      ${c ? `<p><b>${maFmt(c.value)}</b> ${mTag(c)}</p><p class="small">${c.status === "user" ? "Entered by you." : s ? `Source: ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}${c.page ? `, page ${c.page}` : ""}. ${esc(s.type || "")}${s.period ? ", covers " + esc(s.period) : ""}.` : ""} ${c.status === "web" ? "Found online in an official source; not read from the full document." : c.status === "unverified" ? "Not confirmed by an official source. Treat with care." : c.status === "reported" ? "Read from the document." : ""}${c.note ? " Note: " + esc(c.note) : ""}</p>` : `<p class="small muted">No figure found for this year.</p>`}
      ${opts.length > 1 ? `<p class="small muted">${opts.length} sources give a figure for this. See the comparison at the top.</p>` : ""}
      <div class="field text" style="margin-top:8px"><label for="m-cellval">${c ? "Correct this figure" : "Enter this figure"}<small>In ${MA.currency}. You can type 245m or 1.2bn</small></label><input id="m-cellval" type="text" inputmode="decimal" placeholder="e.g. 245m" value="${c && c.status === "user" ? mMoneyIn(c.value) : ""}"></div>
      <div class="row" style="margin-top:8px"><button class="pill sm" type="button" data-mcellsave="1">Save</button>${c && c.status === "user" ? `<button class="pill sm ghost" type="button" data-mcelldel="1">Remove my figure</button>` : ""}<span class="small neg" id="m-cellerr"></span></div></div>`;
  } else ci.innerHTML = "";
  const q = C.quality;
  $("m-quality").innerHTML = `<h3>Data quality</h3><div class="cl"><span>Figures from official documents</span><b>${q.verified}</b><span>Unverified figures</span><b>${q.unverified}</b><span>Core figures missing for the latest year</span><b>${q.missing.length ? q.missing.map((m) => MA_METRIC_NAME[m]).join(", ") : "None"}</b><span>Unresolved conflicts</span><b class="${q.conflicts ? "neg" : ""}">${q.conflicts}</b><span>Evidence completeness</span><b>${Math.round(q.score * 100)}%</b></div>${C.T.fxSkipped ? `<p class="small neg">${C.T.fxSkipped} figure(s) in another currency aren't used.</p>` : ""}<p class="small muted">Version 1 analyses up to the 3 most recent years.</p>`;
}

/* ---------- step 4 health ---------- */
function mNeed(r, list) { const miss = list.filter((k) => r[k] === null || r[k] === undefined); return miss.length ? `Needs ${miss.map((k) => ({ revenue: "revenue", ebitda: "EBITDA", ocf: "operating cash flow", capex: "capex", debt: "total debt", cash: "cash", ebit: "EBIT", interest: "interest expense", netIncome: "net income" }[k] || k)).join(" and ")}` : ""; }
function mRenderHealth() {
  const C = MA_A.C, L = C.latest, rows = C.rows;
  if (!L) { $("m-kpis").innerHTML = `<div class="card big" style="grid-column:1/-1"><p class="muted">No figures yet. Add some in step 3 to see the financial health.</p></div>`; }
  else {
    const k = (l, v, sub, cls) => `<div class="mkpi"><span>${l}</span><b class="${cls || ""}">${v}</b><i>${sub}</i></div>`;
    $("m-kpis").innerHTML = k("Revenue " + L.year, maFmt(L.revenue), L.revGrowth !== null ? `${L.revGrowth >= 0 ? "+" : ""}${mPct(L.revGrowth)} on last year` : mNeed(L, ["revenue"]) || "Growth needs 2 years") +
      k("EBITDA margin", mPct(L.ebitdaMargin), L.ebitdaMargin !== null ? `EBITDA ${maFmt(L.ebitda)}` : mNeed(L, ["ebitda", "revenue"])) +
      k("Free cash flow", maFmt(L.fcf), L.fcf !== null ? `${mPct(L.fcfMargin)} of revenue` : mNeed(L, ["ocf", "capex"]), L.fcf !== null && L.fcf < 0 ? "neg" : "") +
      k("Net debt", maFmt(L.netDebt), L.netDebt !== null ? (L.netDebt < 0 ? "More cash than debt" : "Debt minus cash") : mNeed(L, ["debt", "cash"])) +
      k("Net debt / EBITDA", mX(L.ndEbitda), L.ndEbitda !== null ? (L.ndEbitda > 3 ? "High" : L.ndEbitda > 2 ? "Moderate" : "Low") : L.netDebt !== null && L.netDebt <= 0 ? "Net cash" : mNeed(L, ["debt", "cash", "ebitda"]), L.ndEbitda > 3 ? "neg" : "") +
      k("Interest cover", mX(L.interestCover), L.interestCover !== null ? (L.interestCover < 3 ? "Thin" : "Comfortable") : mNeed(L, ["ebit", "interest"]), L.interestCover !== null && L.interestCover < 3 ? "neg" : "");
  }
  const ys = rows.map((r) => r.year), z = (a) => a.map((v) => (v === null || v === undefined ? 0 : v));
  if (ys.length) {
    barChart("mc-rev", { cats: ys, catName: "", yFmt: (v) => maFmt(v), series: [{ n: "Revenue", c: "var(--ink)", vals: z(rows.map((r) => r.revenue)) }, { n: "EBITDA", c: "var(--go)", cs: rows.map((r) => (r.ebitda < 0 ? "var(--stop)" : "var(--go)")), vals: z(rows.map((r) => r.ebitda)) }] }, { views: ["bar", "line"] });
    barChart("mc-margin", { cats: ys, catName: "", yFmt: (v) => Math.round(v) + "%", series: [{ n: "Gross margin", c: "var(--s2)", vals: z(rows.map((r) => (r.grossMargin === null ? null : r.grossMargin * 100))) }, { n: "EBITDA margin", c: "var(--go)", vals: z(rows.map((r) => (r.ebitdaMargin === null ? null : r.ebitdaMargin * 100))) }, { n: "Net margin", c: "var(--amber)", vals: z(rows.map((r) => (r.netMargin === null ? null : r.netMargin * 100))) }] }, { views: ["line", "bar"] });
    barChart("mc-cash", { cats: ys, catName: "", yFmt: (v) => maFmt(v), series: [{ n: "Operating cash flow", c: "var(--ink)", vals: z(rows.map((r) => r.ocf)) }, { n: "Free cash flow", c: "var(--go)", cs: rows.map((r) => (r.fcf < 0 ? "var(--stop)" : "var(--go)")), vals: z(rows.map((r) => r.fcf)) }] }, { views: ["bar", "line"] });
    barChart("mc-debt", { cats: ys, catName: "", yFmt: (v) => maFmt(v), series: [{ n: "Net debt", c: "var(--ink)", cs: rows.map((r) => (r.ndEbitda > 3 ? "var(--stop)" : "var(--ink)")), vals: z(rows.map((r) => r.netDebt)) }] }, { views: ["bar", "line"] });
  } else ["mc-rev", "mc-margin", "mc-cash", "mc-debt"].forEach((id) => { const s = $(id); if (s) { s.setAttribute("viewBox", "0 0 640 120"); s.innerHTML = `<text x="320" y="64" text-anchor="middle">No figures yet</text>`; } });
  const F = C.flags, AIx = MA.flagAI || {};
  $("m-flags").innerHTML = F.length ? F.map((f) => { const ai = AIx[f.id];
    const ev = MA.qualitative.filter((q) => mFlagTopic(f.id).test((q.topic || "") + " " + q.text)).slice(0, 2);
    return `<div class="mflag ${f.sev}"><div class="row"><span class="chip ${f.sev === "red" ? "stop" : "warn"}">${f.sev === "red" ? "Serious" : "Worth checking"}</span></div>
      <dl><dt>What the numbers show</dt><dd>${esc(f.fact)}</dd>
      <dt>Possible explanation</dt><dd>${ai ? `${esc(ai.text)} <span class="chip ai">AI suggestion, not established</span>` : `<span class="muted">Not yet explained. Use "Suggest explanations with AI", or check the documents.</span>`}</dd>
      <dt>What the documents say</dt><dd>${ev.length ? ev.map((q) => { const s = MA.sources.find((x) => x.id === q.sourceId); return `${esc(q.text)} <span class="small muted">(${esc(s ? s.title : "")}${q.page ? ", p." + q.page : ""})</span>`; }).join("<br>") : ai && ai.evidence ? esc(ai.evidence) + ' <span class="chip ai">AI</span>' : '<span class="muted">Nothing found in the documents read so far.</span>'}</dd>
      <dt>Question to ask the seller</dt><dd>${esc(f.question)}</dd></dl></div>`; }).join("") : `<p class="small ok">${C.latest ? "No warning signs found in the figures available." : "Add figures to check for warning signs."}</p>`;
  const R = [["Revenue growth", "revGrowth", "pct", "(This year − last year) ÷ last year"], ["Gross margin", "grossMargin", "pct", "Gross profit ÷ revenue"], ["EBITDA margin", "ebitdaMargin", "pct", "EBITDA ÷ revenue"], ["EBIT margin", "ebitMargin", "pct", "EBIT ÷ revenue"], ["Net profit margin", "netMargin", "pct", "Net income ÷ revenue"], ["Free cash flow", "fcf", "m", "Operating cash flow − capital expenditure"], ["Free cash flow margin", "fcfMargin", "pct", "Free cash flow ÷ revenue"], ["Cash conversion", "cashConversion", "pct", "Operating cash flow ÷ EBITDA"], ["Net debt", "netDebt", "m", "Total debt − cash"], ["Net debt / EBITDA", "ndEbitda", "x", "Net debt ÷ EBITDA"], ["Interest cover", "interestCover", "x", "EBIT ÷ interest expense"], ["Receivable days", "recDays", "d", "Receivables ÷ revenue × 365"]];
  $("m-rth").innerHTML = `<tr><th>Ratio</th>${ys.map((y) => `<th>${y}</th>`).join("")}<th>Formula</th></tr>`;
  $("m-rtb").innerHTML = R.map(([l, k, t, f]) => `<tr><td>${l}</td>${rows.map((r) => `<td>${t === "pct" ? mPct(r[k]) : t === "x" ? mX(r[k]) : t === "d" ? (r[k] === null ? "—" : Math.round(r[k])) : maFmt(r[k])}</td>`).join("")}<td class="small muted">${f}</td></tr>`).join("");
}
function mFlagTopic(id) { return { ebitda_vs_cash: /cash|working capital/i, margin_decline: /margin|cost|pric/i, neg_fcf: /cash|capex|invest/i, receivables: /receivab|debtor|customer/i, inventory: /inventor|stock/i, adjustments: /adjust|one-off|exceptional|restructur/i, leverage: /debt|facilit|loan|bond|refinanc/i, interest: /interest|debt/i, conversion: /cash|working capital/i, loss: /loss|impair|exceptional/i }[id] || /$^/; }

/* ---------- step 5 market ---------- */
function mRenderMarket() {
  const d = MA.market, n = MA.news;
  const busy = MBUSY === "market" || MBUSY === "news";
  document.querySelectorAll("#mp-market [data-mresearch]").forEach((b) => (b.disabled = !!MBUSY));
  const w = $("m-working2");
  w.innerHTML = busy ? `<div class="row" style="margin-top:10px"><span class="mspin"></span><span class="small">${MBUSY === "market" ? "Researching market size, growth, competitors and regulation" : "Looking for recent developments and risks"}… usually 20 to 60 seconds.</span></div>` : MA.lastResearch && MA.lastResearch.error && ["market", "news"].includes(MA.lastResearch.task) ? `<p class="small neg">${esc(MA.lastResearch.error)}</p>` : MA.lastResearch && MA.lastResearch.noSearch && ["market", "news"].includes(MA.lastResearch.task) ? `<p class="small"><b>Heads up:</b> live Google search wasn't available for this request, so this comes from the AI's general knowledge and may be out of date. Check the key figures.</p>` : `<p class="small muted">${mOnline() ? "Uses your free profile and counts toward the daily research allowance." : "Online research works on the live website."}</p>`;
  const src = (o) => (o.source_url ? ` <a class="small" href="${esc(o.source_url)}" target="_blank" rel="noopener">${esc(o.source_title || "source")}</a>${o.in_search_results === false && !MA.example ? ' <span class="small neg">(link not seen in search results)</span>' : ""}` : o.source_title ? ` <span class="small muted">(${esc(o.source_title)})</span>` : "");
  const li = (a) => (a && a.length ? `<ul class="small mlist">${a.map((x) => `<li>${esc(typeof x === "string" ? x : (x.name ? x.name + (x.note ? ": " + x.note : "") : JSON.stringify(x)))}</li>`).join("")}</ul>` : `<p class="small muted">Nothing found.</p>`);
  let h = "";
  if (d) {
    h += `<div class="card big"><div class="row"><h3>Market</h3><span class="chip ai">${MA.example ? "Example" : "From web research"}</span></div>${d.summary ? `<p>${esc(d.summary)}</p>` : ""}<div class="cl"><span>Market definition</span><b style="text-align:left;font-weight:500">${esc(d.market_definition || "—")}</b><span>Region</span><b style="text-align:left;font-weight:500">${esc(d.geography || "—")}</b><span>Growth</span><b style="text-align:left;font-weight:500">${typeof d.growth_pct === "number" ? d.growth_pct + "% a year" : "No credible figure found"}${d.growth_source_url ? src({ source_url: d.growth_source_url, source_title: d.growth_source_title, in_search_results: d.growth_in_search_results }) : ""}</b></div>
      <h4>Market size estimates</h4>${(d.market_size || []).length ? `<div class="tablebox"><table class="mtable"><thead><tr><th>Size</th><th>Year</th><th>Scope</th><th>Definition</th><th>Source</th></tr></thead><tbody>${d.market_size.map((m) => `<tr><td><b>${esc(String(m.value))} ${esc(m.unit || "")} ${esc(m.currency || "")}</b></td><td>${esc(m.year || "")}</td><td>${esc(m.scope || "")}</td><td class="small">${esc(m.definition || "")}</td><td>${src(m) || '<span class="small muted">—</span>'}</td></tr>`).join("")}</tbody></table></div><p class="small muted">Estimates from different sources often use different definitions and regions, so they aren't directly comparable.</p>` : `<p class="small muted">No credible market size found.</p>`}</div>
      <div class="cols"><div class="card big"><h4>Competitors</h4>${li(d.competitors)}</div><div class="card big"><h4>Trends</h4>${li(d.trends)}</div></div>
      <div class="cols"><div class="card big"><h4>Regulation</h4>${li(d.regulation)}</div><div class="card big"><h4>Opportunities and threats</h4>${li((d.opportunities || []).map((x) => "Opportunity: " + x).concat((d.threats || []).map((x) => "Threat: " + x)))}</div></div>`;
  }
  if (n) {
    h += `<div class="card big"><div class="row"><h3>Recent developments</h3><span class="chip ai">From web research</span></div>${(n.developments || []).length ? `<ul class="mlist">${n.developments.map((x) => `<li><b>${esc(x.headline || "")}</b> <span class="small muted">${esc(x.date || "")}</span><br><span class="small">${esc(x.why_it_matters || "")}</span>${src(x)}</li>`).join("")}</ul>` : `<p class="small muted">Nothing material found.</p>`}
      ${(n.material_risks || []).length ? `<h4>Risks mentioned in sources</h4><ul class="mlist">${n.material_risks.map((x) => `<li>${esc(x.risk || "")} <span class="small muted">${esc(x.evidence || "")}</span>${src(x)}</li>`).join("")}</ul>` : ""}</div>`;
  }
  if (!d && !n) h = `<div class="card big"><p class="muted small">No market research yet. Use the buttons above${MA.isPublic === false ? ". This step works well even for private companies" : ""}, or type the market growth yourself below.</p></div>`;
  $("m-market").innerHTML = h;
  const g = $("m-growth"); if (g && document.activeElement !== g) g.value = MA.commercial.growthPct === undefined || MA.commercial.growthPct === null ? "" : MA.commercial.growthPct;
}

/* ---------- step 6 risks ---------- */
const MRSTAT = { red: ["Red", "stop", "Material concern: investigate urgently"], amber: ["Amber", "warn", "Potential concern: needs more diligence"], green: ["Green", "go", "No material issue in the evidence reviewed"], grey: ["Grey", "in", "Not enough evidence to assess"] };
function mRenderRisks() {
  const R = MA_A.R, cnt = { red: 0, amber: 0, green: 0, grey: 0 }; R.forEach((r) => cnt[r.status]++);
  $("m-riskcount").innerHTML = ["red", "amber", "green", "grey"].map((k) => `<div class="mrc ${k}"><b>${cnt[k]}</b><span>${MRSTAT[k][0]}</span></div>`).join("");
  const sel = (k, f, v) => `<select data-mrisk="${k}" data-f="${f}" aria-label="${f === "l" ? "Likelihood" : "Impact"}"><option value="">–</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}"${+v === n ? " selected" : ""}>${n}</option>`).join("")}</select>`;
  $("m-risks").innerHTML = `<div class="mrisk mrisk-h small muted"><span>Area</span><span>Likelihood</span><span>Impact</span><span>Score</span><span>Evidence</span></div>` + R.map((r) => { const u = MA.risks[r.key] || {};
    const aiPending = u.aiL && u.aiI && !u.aiAccepted;
    return `<div class="mrisk"><span><span class="mdot ${r.status}" title="${MRSTAT[r.status][2]}"></span><b>${r.label}</b></span>${sel(r.key, "l", r.l)}${sel(r.key, "i", r.i)}<span><b>${r.score === null ? "—" : r.score}</b> <span class="chip ${MRSTAT[r.status][1]}">${MRSTAT[r.status][0]}</span></span>
      <span class="small">${esc(r.why) || '<span class="muted">No evidence yet.</span>'} ${r.source === "auto" ? '<span class="mtag calc">From the numbers</span>' : r.source === "ai" ? '<span class="chip ai">AI suggestion you accepted</span>' : r.source === "user" ? '<span class="mtag user">Your score</span>' : ""}
      ${aiPending ? `<span class="maisugg">AI suggests ${u.aiL} × ${u.aiI}: ${esc(u.aiWhy || "")} <button class="linkbtn" type="button" data-mriskuse="${r.key}">Use this</button> · <button class="linkbtn" type="button" data-mriskno="${r.key}">Ignore</button></span>` : ""}
      <details class="more"><summary>Mitigation and information needed</summary><div class="fields" style="margin-top:6px"><div class="field text"><label>Evidence or notes</label><input type="text" data-mk="risks.${r.key}.note" value="${esc(u.note || "")}"></div><div class="field text"><label>Mitigation</label><input type="text" data-mk="risks.${r.key}.mitigation" value="${esc(u.mitigation || "")}"></div><div class="field text"><label>Information still needed</label><input type="text" data-mk="risks.${r.key}.needed" value="${esc(u.needed || "")}"></div></div>${u.l || u.i ? `<button class="linkbtn small" type="button" data-mriskclear="${r.key}">Clear my score</button>` : ""}</details></span></div>`; }).join("");
}

/* ---------- step 7 deal ---------- */
function mBuildDeal() {
  const L = MA_A.C.latest || {};
  $("m-val-in").innerHTML = mField("valuation.price", "Price for the shares", "What you'd pay, e.g. 250m", { money: true }) + mField("valuation.ownership", "Stake bought", "Percent", { num: true, ph: "100" }) +
    mField("valuation.ebitda", "EBITDA used", `Leave blank to use ${L.year || "the latest year"}${L.ebitda !== null && L.ebitda !== undefined ? " (" + maFmt(L.ebitda) + ")" : ""}`, { money: true }) +
    `<label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-mk="valuation.useAdjusted" ${MA.valuation.useAdjusted ? "checked" : ""}> Use adjusted EBITDA${L.adjEbitda !== null && L.adjEbitda !== undefined ? " (" + maFmt(L.adjEbitda) + ")" : " (not available)"}</label>` +
    mField("valuation.debt", "Total debt", `Blank = ${maFmt(L.debt)}`, { money: true }) + mField("valuation.cash", "Cash", `Blank = ${maFmt(L.cash)}`, { money: true }) +
    mField("valuation.debtLike", "Other debt-like items", "Leases, pensions, minority interests", { money: true }) + mField("valuation.txCosts", "Transaction costs", "Advisers, fees, stamp duty", { money: true }) + mField("valuation.integrationCosts", "Integration costs", "One-off costs to combine the businesses", { money: true });
  $("m-val-mult").innerHTML = `<h4 style="margin:0">EV / EBITDA multiple</h4>` + ["downside", "base", "upside"].map((k) => mField("valuation.multiples." + k, k[0].toUpperCase() + k.slice(1), "× EBITDA", { num: true })).join("") + `<h4 style="margin:8px 0 0">EBITDA change in each scenario</h4>` + ["downside", "base", "upside"].map((k) => mField("valuation.ebitdaAdj." + k, k[0].toUpperCase() + k.slice(1), "% versus the EBITDA used", { num: true })).join("");
  mBuildSyn();
}
function mBuildSyn() {
  const SY = MA_A.SY;
  $("m-syn").innerHTML = (MA.synergies || []).map((s, i) => { const r = SY.items[i] || {};
    const opt = (arr, v) => arr.map((x) => `<option value="${esc(x[0])}"${x[0] === v ? " selected" : ""}>${esc(x[1])}</option>`).join("");
    return `<div class="msyn"><div class="row"><span class="mtag ${s.label === "disclosed" ? "reported" : s.label === "ai" ? "ai" : "user"}">${s.label === "disclosed" ? "Disclosed" : s.label === "ai" ? "AI idea" : "Your estimate"}</span><input type="text" class="msyn-n" data-msyn="${s.id}" data-f="name" value="${esc(s.name || "")}" placeholder="Name this synergy" aria-label="Synergy name"><span class="spacer"></span><button class="oscx" style="position:static" type="button" data-msyndel="${s.id}" aria-label="Remove synergy">×</button></div>
      ${s.rationale ? `<p class="small muted">${esc(s.rationale)}</p>` : ""}
      <div class="msyn-g">
        <label>Category<select data-msyn="${s.id}" data-f="category">${opt(MA_SYN_CATS.map((c) => [c, c]), s.category)}</select></label>
        <label>Type<select data-msyn="${s.id}" data-f="type">${opt([["cost", "Cost saving"], ["revenue", "Revenue uplift"]], s.type)}</select></label>
        <label>Label<select data-msyn="${s.id}" data-f="label">${opt([["estimate", "Your estimate"], ["disclosed", "Disclosed"], ["ai", "AI idea"]], s.label)}</select></label>
        <label>${s.type === "revenue" ? "Revenue base" : "Cost base"}<input type="text" inputmode="decimal" data-msyn="${s.id}" data-f="base" data-money="1" value="${mMoneyIn(s.base)}" placeholder="e.g. 60m"></label>
        <label>${s.type === "revenue" ? "Uplift" : "Saving"} %<input type="text" inputmode="decimal" data-msyn="${s.id}" data-f="pct" value="${s.pct ?? ""}"></label>
        ${s.type === "revenue" ? `<label>Profit margin on extra revenue %<input type="text" inputmode="decimal" data-msyn="${s.id}" data-f="margin" value="${s.margin ?? ""}" placeholder="30"></label>` : ""}
        <label>Chance it happens %<input type="text" inputmode="decimal" data-msyn="${s.id}" data-f="prob" value="${s.prob ?? ""}" placeholder="50"></label>
        <label>Extra running cost a year<input type="text" inputmode="decimal" data-msyn="${s.id}" data-f="recurringCost" data-money="1" value="${mMoneyIn(s.recurringCost)}"></label>
        <label>One-off cost<input type="text" inputmode="decimal" data-msyn="${s.id}" data-f="implCost" data-money="1" value="${mMoneyIn(s.implCost)}"></label>
        <label>Years to achieve<input type="text" inputmode="decimal" data-msyn="${s.id}" data-f="years" value="${s.years ?? ""}" placeholder="2"></label>
      </div>
      <div class="small msyn-r" id="msynr-${s.id}">${mSynLine(r, s)}</div></div>`; }).join("") || `<p class="small muted">No synergies yet. Add your own, or ask AI for ideas to check.</p>`;
  if (MA.synAI && MA.synAI.length) $("m-syn").innerHTML += `<div class="maisugg" style="display:block;margin-top:10px"><b>AI ideas to consider</b> <span class="chip ai">Hypotheses, not facts</span><ul class="small mlist">${MA.synAI.map((x, i) => `<li><b>${esc(x.name)}</b> (${esc(x.category || "")}, ${x.type === "revenue" ? "revenue" : "cost"}): ${esc(x.rationale || "")} <button class="linkbtn" type="button" data-msynaiadd="${i}">Add</button></li>`).join("")}</ul></div>`;
}
function mSynLine(r, s) { if (!r || r.gross === undefined) return ""; if (!s.base || !s.pct) return `<span class="muted">Add the ${s.type === "revenue" ? "revenue base and uplift" : "cost base and saving"} to size this.</span>`; return `Full-year impact ${maFmt(r.gross)} × ${Math.round(r.prob * 100)}% chance = <b>${maFmt(r.riskAdj)}</b> risk-adjusted${r.recurring ? `, ${maFmt(r.net)} after running costs` : ""}${r.oneOff ? ` · one-off cost ${maFmt(r.oneOff)}` : ""}${s.years ? ` · about ${s.years} year${+s.years === 1 ? "" : "s"} to achieve` : ""}`; }
function mRenderDeal() {
  const SY = MA_A.SY, VA = MA_A.VA;
  (MA.synergies || []).forEach((s, i) => { const el = $("msynr-" + s.id); if (el) el.innerHTML = mSynLine(SY.items[i], s); });
  $("m-syntot").innerHTML = `<span>Gross annual synergies</span><b>${maFmt(SY.gross)}</b><span>Risk-adjusted</span><b>${maFmt(SY.riskAdj)}</b><span>Net annual benefit after running costs</span><b class="${SY.net > 0 ? "pos" : ""}">${maFmt(SY.net)}</b><span>One-off implementation costs</span><b>${maFmt(SY.oneOff)}</b><span class="small">Of which AI ideas (unvalidated)</span><b class="small">${maFmt(SY.byLabel.ai)}</b>`;
  const sc = VA.scenarios, row = (l, f) => `<tr><td>${l}</td>${sc.map((s) => `<td>${f(s)}</td>`).join("")}</tr>`;
  $("m-val").innerHTML = row("EBITDA", (s) => maFmt(s.ebitda)) + row("Multiple", (s) => s.mult + "×") + row("Enterprise value", (s) => maFmt(s.ev)) + row("Less debt, plus cash, less debt-like", (s) => (s.equity === null ? "—" : maFmt(s.equity - s.ev))) + row("<b>Equity value</b>", (s) => `<b>${maFmt(s.equity)}</b>`) + row(`Value of a ${Math.round(VA.own * 100)}% stake`, (s) => maFmt(s.stake));
  if (sc[1].ev !== null) barChart("mc-val", { cats: sc.map((s) => s.label), catName: "", yFmt: (v) => maFmt(v), lines: VA.price !== null ? [{ v: VA.price, label: "Your price " + maFmt(VA.price), c: "var(--stop)" }] : [], series: [{ n: "Enterprise value", c: "var(--s2)", vals: sc.map((s) => s.ev || 0) }, { n: "Equity value of stake", c: "var(--go)", vals: sc.map((s) => s.stake || 0) }] }, { views: ["bar", "line"] });
  const v = VA.verdict, cls = v === "supported" ? "go" : v === "needs_synergies" || v === "stretched" ? "mid" : v === "not_supported" ? "stop" : "";
  const txt = { supported: "The price is within the base-case valuation.", needs_synergies: "The price is above the base-case value, but within it once risk-adjusted synergies are included (after one-off costs).", stretched: "The price is only supported in the upside scenario.", not_supported: "The price is above even the upside valuation." }[v];
  $("m-valverdict").innerHTML = sc[1].ev === null ? `<p class="small muted" style="margin-top:10px">Needs EBITDA${VA.debt === null || VA.debt === undefined ? ", debt" : ""}${VA.cash === null || VA.cash === undefined ? " and cash" : ""} to value the company. Add them in step 3 or above.</p>` :
    `<div class="callout ${cls}" style="margin-top:12px"><strong>${v ? txt : "Enter a price above to test it against the valuation."}</strong><p class="small">${VA.price !== null && VA.impliedMultiple !== null ? `Your price implies about ${VA.impliedMultiple.toFixed(1)}× EBITDA. ` : ""}${VA.walkAway !== null ? `Walk-away guide: about ${maFmt(VA.walkAway)}, the base-case stake value plus synergies valued at half the base multiple (${maFmt(VA.synValue)}), less one-off, transaction and integration costs.` : ""}</p></div>`;
}

/* ---------- step 8 memo ---------- */
function mBiggest(R, keys) { const r = R.filter((x) => keys.includes(x.key) && x.score !== null).sort((a, b) => b.score - a.score)[0]; return r ? `${r.label} (${MRSTAT[r.status][0].toLowerCase()}, ${r.score}/25)${r.why ? ": " + r.why : ""}` : "Not enough evidence to judge yet."; }
function mGlance() {
  const { C, R, SY, VA, RE } = MA_A, L = C.latest;
  const attractive = []; if (L && L.revGrowth > 0) attractive.push(`revenue growing ${mPct(L.revGrowth)}`); if (L && L.ebitdaMargin > 0.15) attractive.push(`healthy EBITDA margin of ${mPct(L.ebitdaMargin)}`); if (L && L.fcf > 0) attractive.push("positive free cash flow"); if (maNum(MA.commercial.growthPct) > 3) attractive.push(`a market growing about ${MA.commercial.growthPct}% a year`); if (MA.objectives.length) attractive.push(`fit with your aims (${MA.objectives.join(", ").toLowerCase()})`);
  return [["What makes it attractive", attractive.length ? attractive.join("; ") : "Not clear from the evidence so far."], ["Biggest financial risk", mBiggest(R, ["financial", "earnings", "liquidity", "leverage"])], ["Biggest commercial risk", mBiggest(R, ["commercial", "customers", "suppliers", "regulatory", "operations", "technology", "fit"])],
    ["Synergy opportunity", SY.items.length ? `${maFmt(SY.riskAdj)} a year risk-adjusted (${maFmt(SY.net)} net), with ${maFmt(SY.oneOff)} of one-off costs${SY.byLabel.ai ? `; ${maFmt(SY.byLabel.ai)} of it is unvalidated AI ideas` : ""}.` : "No synergies modelled yet."],
    ["Is the price supportable?", VA.verdict ? { supported: "Yes, within the base case.", needs_synergies: "Only if synergies are delivered.", stretched: "Only in the upside case.", not_supported: "No, it's above the upside valuation." }[VA.verdict] : VA.scenarios[1].ev === null ? "Can't tell yet: EBITDA, debt or cash is missing." : "No price entered."],
    ["What's still missing", C.quality.missing.length ? C.quality.missing.map((m) => MA_METRIC_NAME[m]).join(", ") + (R.filter((r) => r.status === "grey").length ? `; ${R.filter((r) => r.status === "grey").length} risk areas without evidence` : "") : R.filter((r) => r.status === "grey").length ? `${R.filter((r) => r.status === "grey").length} risk areas without evidence` : "Nothing major."],
    ["Preliminary recommendation", RE.label], ["What to investigate next", mNextSteps().slice(0, 3).join(" ")]];
}
function mQuestions() {
  const { C, R } = MA_A, out = [];
  C.flags.forEach((f) => out.push(f.question));
  R.filter((r) => r.status === "red" || r.status === "amber").forEach((r) => { if (r.needed) out.push(`${r.label}: ${r.needed}`); });
  R.filter((r) => r.status === "grey" && ["customers", "suppliers", "regulatory", "operations", "technology"].includes(r.key)).forEach((r) => out.push({ customers: "Who are the largest customers, and what share of revenue does each represent?", suppliers: "Which suppliers are critical, and what happens if one fails or raises prices?", regulatory: "Which regulations, licences or pending changes could affect the business?", operations: "How resilient are operations to outages, key-person loss or disruption?", technology: "Which systems and technology providers does the business depend on?" }[r.key]));
  if (C.quality.missing.length) out.push(`Can you provide audited figures for ${C.quality.missing.map((m) => MA_METRIC_NAME[m].toLowerCase()).join(", ")}?`);
  return [...new Set(out)];
}
function mNextSteps() {
  const { C, R } = MA_A, out = [];
  if (C.quality.missing.length) out.push(`Get audited accounts covering ${C.quality.missing.map((m) => MA_METRIC_NAME[m].toLowerCase()).join(", ")}.`);
  if (C.quality.unverified) out.push("Confirm the unverified figures against the annual report.");
  if (C.quality.conflicts) out.push("Resolve the figures where sources disagree.");
  R.filter((r) => r.status === "red").forEach((r) => out.push(`Investigate ${r.label.toLowerCase()} as a priority.`));
  if (C.flags.length) out.push(`Send the seller the ${C.flags.length} question${C.flags.length > 1 ? "s" : ""} raised by the warning signs (section 9).`);
  if (R.some((r) => r.status === "grey")) out.push(`Gather evidence for the ${R.filter((r) => r.status === "grey").length} risk areas still marked grey.`);
  if ((MA.synergies || []).some((s) => s.label === "ai")) out.push("Validate the AI-suggested synergies with real cost data before relying on them.");
  out.push("Commission professional financial, legal and tax due diligence before committing.");
  return [...new Set(out)];
}
function mMemoHTML() {
  const { C, R, SY, VA, RE } = MA_A, L = C.latest, t = MA.target, P = MA.profile || {}, d = MA.market;
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const sec = (n, h, body) => `<h2>${n}. ${h}</h2>${body}`;
  const p = (x) => `<p>${x}</p>`;
  const ys = C.rows.map((r) => r.year);
  const fin = C.rows.length ? `<table><thead><tr><th></th>${ys.map((y) => `<th>${y}</th>`).join("")}</tr></thead><tbody>${[["Revenue", "revenue", "m"], ["Revenue growth", "revGrowth", "p"], ["EBITDA", "ebitda", "m"], ["EBITDA margin", "ebitdaMargin", "p"], ["Net income", "netIncome", "m"], ["Operating cash flow", "ocf", "m"], ["Free cash flow", "fcf", "m"], ["Net debt", "netDebt", "m"], ["Net debt / EBITDA", "ndEbitda", "x"]].map(([l, k, f]) => `<tr><td>${l}</td>${C.rows.map((r) => `<td>${f === "p" ? mPct(r[k]) : f === "x" ? mX(r[k]) : maFmt(r[k])}</td>`).join("")}</tr>`).join("")}</tbody></table><p><i>Reported figures come from the sources listed in section 12; ratios are calculated by the tool.${C.quality.unverified ? ` ${C.quality.unverified} figure(s) are unverified.` : ""}</i></p>` : p("<b>No financial figures were available, so a financial assessment can't be completed yet.</b>");
  const srcs = MA.sources.filter((s) => s.status !== "excluded").map((s, i) => `<li>${esc(s.title)}${s.publisher ? ", " + esc(s.publisher) : ""}${s.date ? ", " + esc(s.date) : ""}${s.period ? " (covers " + esc(s.period) + ")" : ""}. ${s.example ? "Example data" : s.kind === "upload" ? "Uploaded document" : esc(MTIER[s.tier]) + " source"}${s.url ? `: <a href="${esc(s.url)}">${esc(s.url.length > 70 ? s.url.slice(0, 70) + "…" : s.url)}</a>` : ""}</li>`).join("");
  const riskRows = R.map((r) => `<tr><td>${r.label}</td><td>${MRSTAT[r.status][0]}</td><td>${r.score === null ? "—" : r.score}</td><td>${esc(r.why || "Not enough evidence.")}${r.mitigation ? " <i>Mitigation: " + esc(r.mitigation) + "</i>" : ""}</td></tr>`).join("");
  const exec = `${esc(t.name || "The target")}${t.industry ? ", " + esc(t.industry) : ""}, was reviewed${MA.objectives.length ? " for " + esc(MA.objectives.join(", ").toLowerCase()) : ""}. ${L ? `In ${L.year} it reported revenue of ${maFmt(L.revenue)}${L.ebitdaMargin !== null ? ` with an EBITDA margin of ${mPct(L.ebitdaMargin)}` : ""}${L.netDebt !== null ? ` and net ${L.netDebt < 0 ? "cash of " + maFmt(-L.netDebt) : "debt of " + maFmt(L.netDebt)}` : ""}.` : "Financial figures were not available."} ${C.flags.length ? `${C.flags.length} warning sign${C.flags.length > 1 ? "s were" : " was"} found in the figures.` : ""} ${R.filter((r) => r.status === "red").length ? `${R.filter((r) => r.status === "red").length} risk area(s) are red.` : "No risk area is red."} ${VA.verdict ? "Against the valuation, " + { supported: "the proposed price is within the base case.", needs_synergies: "the proposed price depends on synergies.", stretched: "the proposed price is only supported in the upside case.", not_supported: "the proposed price is above the upside valuation." }[VA.verdict] : ""} Preliminary recommendation: <b>${RE.label}</b>.`;
  return `<h1>Due diligence memo: ${esc(t.name || "Target")}</h1><p class="mmeta">${today} · Prepared with BBC – Big Brain Consulting · Preliminary analysis${MA.example ? " · <b>Example data, not a real company</b>" : ""}</p>` +
    sec(1, "Executive summary", `<p data-msec="exec">${MA.memoExec ? esc(MA.memoExec) + " <i>(wording improved by AI)</i>" : exec}</p>`) +
    sec(2, "Company overview", p(esc(P.overview || "No overview available.")) + (P.business_model ? p("<b>Business model:</b> " + esc(P.business_model)) : "") + (P.geography ? p("<b>Where it operates:</b> " + esc(P.geography)) : "") + (MA.isPublic === false ? p("<i>This appears to be a private company, so public financial information is limited.</i>") : "")) +
    sec(3, "Financial performance", fin) +
    sec(4, "Earnings quality", C.flags.length ? `<ul>${C.flags.map((f) => `<li><b>Observed:</b> ${esc(f.fact)}${MA.flagAI && MA.flagAI[f.id] ? ` <b>Possible explanation (AI hypothesis):</b> ${esc(MA.flagAI[f.id].text)}` : ""} <b>Question:</b> ${esc(f.question)}</li>`).join("")}</ul>` : p(L ? "No earnings-quality warning signs were found in the figures available." : "Not assessed: no figures.")) +
    sec(5, "Commercial assessment", d ? p(esc(d.summary || "")) + p(`<b>Market:</b> ${esc(d.market_definition || "—")} (${esc(d.geography || "")}). <b>Growth:</b> ${typeof d.growth_pct === "number" ? d.growth_pct + "% a year" : "no credible figure found"}.`) + ((d.competitors || []).length ? p("<b>Competitors:</b> " + d.competitors.map((c) => esc(c.name || c)).join(", ")) : "") : p("No market research was carried out.")) +
    sec(6, "Financial and commercial risks", `<table><thead><tr><th>Area</th><th>Rating</th><th>Score</th><th>Evidence</th></tr></thead><tbody>${riskRows}</tbody></table><p><i>Score = likelihood × impact (1–5 each). Grey means not enough evidence; it is not a green result.</i></p>`) +
    sec(7, "Potential synergies", SY.items.length ? `<ul>${SY.items.map((x) => `<li>${esc(x.s.name || x.s.category)} (${x.s.label === "disclosed" ? "disclosed" : x.s.label === "ai" ? "AI hypothesis, unvalidated" : "analyst estimate"}): ${maFmt(x.riskAdj)} a year risk-adjusted${x.oneOff ? ", one-off cost " + maFmt(x.oneOff) : ""}.</li>`).join("")}</ul>${p(`Total risk-adjusted synergies ${maFmt(SY.riskAdj)} a year; net benefit ${maFmt(SY.net)}; one-off costs ${maFmt(SY.oneOff)}.`)}` : p("No synergies were modelled.")) +
    sec(8, "Valuation and deal economics", VA.scenarios[1].ev !== null ? `<table><thead><tr><th></th>${VA.scenarios.map((s) => `<th>${s.label}</th>`).join("")}</tr></thead><tbody><tr><td>EBITDA × multiple</td>${VA.scenarios.map((s) => `<td>${maFmt(s.ebitda)} × ${s.mult}</td>`).join("")}</tr><tr><td>Enterprise value</td>${VA.scenarios.map((s) => `<td>${maFmt(s.ev)}</td>`).join("")}</tr><tr><td>Equity value (${Math.round(VA.own * 100)}%)</td>${VA.scenarios.map((s) => `<td>${maFmt(s.stake)}</td>`).join("")}</tr></tbody></table>${p(VA.price !== null ? `Proposed price ${maFmt(VA.price)}${VA.impliedMultiple !== null ? ` (about ${VA.impliedMultiple.toFixed(1)}× EBITDA)` : ""}. ${VA.walkAway !== null ? "Walk-away guide about " + maFmt(VA.walkAway) + "." : ""}` : "No price was proposed.")}<p><i>Simplified bridge: equity value = enterprise value − debt + cash − other debt-like items.</i></p>` : p("A valuation couldn't be calculated because EBITDA, debt or cash is missing.")) +
    sec(9, "Outstanding diligence questions", (mQuestions().length ? `<ul>${mQuestions().map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : p("No specific questions raised yet."))) +
    sec(10, "Preliminary recommendation", p(`<b>${RE.label}.</b> ${RE.reasons.map(esc).join(" ")}`) + p("<i>This recommendation follows fixed rules based on evidence completeness, the risk matrix and the valuation. It is not an instruction to buy.</i>")) +
    sec(11, "Recommended next steps", `<ol>${mNextSteps().slice(0, 6).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`) +
    sec(12, "Sources and assumptions", (srcs ? `<ol>${srcs}</ol>` : p("No sources recorded.")) + p(`Currency ${esc(MA.currency)}. Up to the 3 most recent financial years. Facts, calculations, AI interpretations and hypotheses are labelled as such. AI summaries were generated from web search results and should be checked against the original sources.`) + p("<i>This memo is a preliminary decision-support tool. It does not replace professional financial, legal, tax, accounting or technical due diligence.</i>"));
}
function mRenderMemo() {
  const RE = MA_A.RE, cls = ["go", "mid", "stop", "stop"][RE.idx];
  $("m-verdict").className = "verdict " + cls;
  $("m-verdict").innerHTML = `<span class="eyebrow">Preliminary recommendation</span><p class="call">${RE.label}</p><ul class="small mlist">${RE.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul><details class="more"><summary>How the recommendation is decided</summary><ol class="small mlist"><li>Under 50% evidence completeness: Pause pending further evidence.</li><li>Red financial risks and a price above the upside valuation: Do not proceed.</li><li>Any red risk, a price that needs synergies or upside, under 75% completeness, or unresolved conflicting figures: Proceed with conditions.</li><li>Otherwise: Proceed to the next diligence stage.</li></ol></details>`;
  $("m-glance").innerHTML = mGlance().map(([h, t]) => `<li><b>${h}:</b> ${esc(t)}</li>`).join("");
  const m = $("m-memo");
  if (!MA.memoEdited || !MA.memo) { MA.memo = mMemoHTML(); }
  if (document.activeElement !== m && m.innerHTML !== MA.memo) m.innerHTML = MA.memo;
  $("m-memonote").textContent = MA.memoEdited ? "You've edited this memo. Use \"Rebuild\" to start again from the latest numbers (your edits will be replaced)." : "Click anywhere in the memo to edit it. It updates automatically until you make your first edit.";
}

/* ---------- AI helpers (explanations, risk scores, synergy ideas, memo wording) ---------- */
async function mAI(kind) {
  if (!AI) { toastM("AI isn't available here."); return; }
  if (!PROFILE && mOnline()) { needProfile(() => mAI(kind), "use AI features"); return; }
  const { C, R } = MA_A, t = MA.target;
  const btn = document.querySelector(`[data-mai="${kind}"]`); if (btn) { btn.disabled = true; btn.dataset.l = btn.textContent; btn.textContent = "Working…"; }
  const ctx = `Target: ${t.name || ""}${t.industry ? " (" + t.industry + ")" : ""}. Currency ${MA.currency}. ${MA.profile && MA.profile.overview ? "Overview: " + MA.profile.overview : ""}
Document notes: ${MA.qualitative.slice(0, 15).map((q) => q.topic + ": " + q.text + (q.page ? " (p." + q.page + ")" : "")).join(" | ") || "none"}.
Debt notes: ${MA.debtNotes.slice(0, 6).map((d) => d.text).join(" | ") || "none"}.`;
  try {
    if (kind === "explain") {
      if (!C.flags.length) { toastM("No warning signs to explain."); return; }
      const r = await AI.json(`You are helping with M&A due diligence. For each warning sign below, suggest the most plausible possible explanation (one or two sentences) and, only if the notes below actually support it, quote the supporting evidence. Never present an explanation as established fact and never allege fraud.
${ctx}
Warning signs:
${C.flags.map((f) => f.id + ": " + f.fact).join("\n")}
Return JSON: {"items":[{"id":"warning id","explanation":"","evidence":"text from the notes above, or empty"}]}`, { modelTier: "default" });
      MA.flagAI = {}; (r.items || []).forEach((x) => { if (x && x.id && x.explanation) MA.flagAI[x.id] = { text: x.explanation, evidence: x.evidence || "" }; });
    }
    if (kind === "risks") {
      const evid = [MA.profile && (MA.profile.key_risks || []).join("; "), MA.news && (MA.news.material_risks || []).map((x) => `[${x.area}] ${x.risk}: ${x.evidence}`).join("; "), MA.market && [(MA.market.threats || []).join("; "), (MA.market.regulation || []).join("; ")].join("; ")].filter(Boolean).join("\n");
      if (!evid && !MA.qualitative.length) { $("m-riskai").innerHTML = `<p class="small muted">There's no research or document evidence to score from yet. Research the company (step 2) or the market and news (step 5) first.</p>`; return; }
      const r = await AI.json(`You are scoring an M&A risk matrix. Only score areas where the evidence below actually says something; skip all others. Likelihood and impact are 1 to 5.
Areas: customers (customer concentration), suppliers, regulatory, operations, technology, commercial, fit (strategic fit with: ${MA.objectives.join(", ") || "not stated"}).
${ctx}
Evidence from research:
${evid}
Return JSON: {"risks":[{"area":"one of the area keys","likelihood":1,"impact":1,"evidence":"one sentence citing the evidence","mitigation":"","info_needed":""}]}`, { modelTier: "default" });
      let n = 0; (r.risks || []).forEach((x) => { if (!x || !MA_RISK_AREAS.some((a) => a[0] === x.area)) return; const l = Math.round(+x.likelihood), i = Math.round(+x.impact); if (!(l >= 1 && l <= 5 && i >= 1 && i <= 5)) return; const u = (MA.risks[x.area] = MA.risks[x.area] || {}); Object.assign(u, { aiL: l, aiI: i, aiWhy: x.evidence || "", aiAccepted: false }); if (!u.mitigation && x.mitigation) u.mitigation = x.mitigation; if (!u.needed && x.info_needed) u.needed = x.info_needed; n++; });
      $("m-riskai").innerHTML = `<p class="small muted">${n ? `AI suggested scores for ${n} area${n > 1 ? "s" : ""}. Review each one and choose "Use this" or "Ignore".` : "The evidence wasn't specific enough for AI to suggest scores."}</p>`;
    }
    if (kind === "synergies") {
      const r = await AI.json(`Suggest up to 6 potential synergy ideas for this acquisition. Buyer: ${t.acquirer || "not stated"}. Aims: ${MA.objectives.join(", ") || "not stated"}.
${ctx}
Give ideas only: no money amounts or percentages. Each is a hypothesis to validate.
Return JSON: {"ideas":[{"name":"","category":"one of: ${MA_SYN_CATS.join(", ")}","type":"cost or revenue","rationale":"one sentence"}]}`, { modelTier: "default" });
      MA.synAI = (r.ideas || []).filter((x) => x && x.name).slice(0, 6).map((x) => ({ name: x.name, category: MA_SYN_CATS.includes(x.category) ? x.category : "Procurement", type: x.type === "revenue" ? "revenue" : "cost", rationale: x.rationale || "" }));
      mBuildSyn();
    }
    if (kind === "memo") {
      const plain = $("m-memo").innerText.slice(0, 9000);
      const r = await AI.json(`Rewrite only the executive summary of this due diligence memo so it reads clearly and professionally in 4 to 6 sentences. Use only facts and numbers that appear in the memo. Do not add new facts, sources or figures, and keep the stated recommendation exactly.
Memo:
${plain}
Return JSON: {"executive_summary":""}`, { modelTier: "default" });
      if (r.executive_summary) { MA.memoExec = r.executive_summary; MA.memoEdited = false; MA.memo = null; }
    }
  } catch (e) { toastM(e && e.message ? e.message : "The AI couldn't help this time."); if (kind === "risks") $("m-riskai").innerHTML = `<p class="small neg">${esc(e.message || "The AI couldn't help this time.")}</p>`; }
  finally { if (btn) { btn.disabled = false; btn.textContent = btn.dataset.l || btn.textContent; } maSave(); maRender(); }
}

/* ---------- save, open, export ---------- */
async function mList() { if (DB && UID) { try { const q = await DB.collection("data/users/" + UID).get(); return q.docs.filter((d) => d.exists && d.id.startsWith("ma_")).map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => b.savedAt - a.savedAt); } catch (e) { return []; } } try { return JSON.parse(localStorage.getItem("ma-saved") || "[]"); } catch (e) { return []; } }
async function mSaveRec() {
  const name = ($("msaveName").value || "").trim() || `${MA.target.name || "Analysis"} · ${new Date().toLocaleDateString("en-GB")}`;
  const rec = { name, savedAt: Date.now(), target: MA.target.name || "", rec: MA_A.RE.label, state: JSON.parse(JSON.stringify(MA)) };
  if (DB && UID) { try { await DB.collection("data/users/" + UID).doc("ma_" + Date.now().toString(36)).set(rec); toastM(`Saved "${name}" to your account.`); } catch (e) { toastM("Couldn't save just now. Try again."); return; } }
  else { const l = await mList(); l.unshift(Object.assign({ id: "ma_" + Date.now().toString(36) }, rec)); try { localStorage.setItem("ma-saved", JSON.stringify(l.slice(0, 20))); toastM(`Saved "${name}" in this browser.`); } catch (e) { toastM("This browser blocked saving."); } }
  mDrawSaved();
}
async function mDrawSaved() { const l = await mList(); const el = $("msaved"); if (!el) return; el.innerHTML = l.length ? `<h4>Your saved analyses</h4>${l.map((it) => `<div class="saved"><div><b>${esc(it.name)}</b><small class="muted">${new Date(it.savedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${esc(it.rec || "")}</small></div><div class="row"><button class="pill sm ghost" type="button" data-mopen="${esc(it.id)}">Open</button><button class="pill sm ghost" type="button" data-mdel="${esc(it.id)}">Delete</button></div></div>`).join("")}` : ""; }
function mExportDoc() {
  const html = `<html><head><meta charset="utf-8"><title>${esc(MA.target.name || "Due diligence memo")}</title><style>body{font-family:Helvetica,Arial,sans-serif;font-size:11pt;line-height:1.5;color:#111;max-width:760px}h1,h2{font-family:Georgia,serif}h1{font-size:22pt}h2{font-size:14pt;margin-top:18pt}table{border-collapse:collapse;width:100%;font-size:9.5pt}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}.mmeta{color:#666}</style></head><body>${$("m-memo").innerHTML}</body></html>`;
  return html;
}

/* ---------- master render ---------- */
function mBuildAll() { mSetCur(); MA_A = maAll(MA); mBuildTarget(); mBuildDeal(); $("m-thresh").innerHTML = mField("thresholds.red", "Red from score", "Likelihood × impact, out of 25", { num: true }) + mField("thresholds.amber", "Amber from score", "Below this is green", { num: true }); }
function maRender() {
  if ($("ma").hidden && !window.MA_FORCE) return;
  mSetCur(); MA_A = maAll(MA); mProg();
  if ($("mnext-1")) $("mnext-1").disabled = !(MA.target.name || "").trim();
  if (!mResumeShown) { mResumeShown = true; if ((MA.furthest || 0) > 0 && (MA.target.name || "").trim()) { const r = $("mresume"); r.hidden = false; r.innerHTML = `<p><b>Welcome back.</b> We've kept your analysis of ${esc(MA.target.name)}.</p><div class="row"><button class="pill sm" type="button" data-mresume="1">Carry on</button><button class="pill sm ghost" type="button" data-mrestart="1">Start a new analysis</button></div>`; } }
  const t = MTAB;
  if (t === "evidence") mRenderEvidence();
  if (t === "numbers") mRenderNumbers();
  if (t === "health") mRenderHealth();
  if (t === "market") mRenderMarket();
  if (t === "risks") mRenderRisks();
  if (t === "deal") mRenderDeal();
  if (t === "memo") mRenderMemo();
}

/* ---------- events ---------- */
document.addEventListener("input", (e) => {
  const i = e.target;
  if (i.dataset && i.dataset.mk) {
    const p = i.dataset.mk; let v;
    if (i.type === "checkbox") v = i.checked;
    else if (i.dataset.money) { v = mParseMoney(i.value); if (Number.isNaN(v)) return; }
    else if (i.dataset.num || p === "commercial.growthPct") { v = i.value.trim() === "" ? "" : +i.value.replace(/[^\d.\-]/g, ""); if (v !== "" && !isFinite(v)) return; }
    else v = i.value;
    mSet(p, v);
    if (p === "commercial.growthPct") MA.commercial.growthSrc = "user";
    if (p.startsWith("risks.")) { maSave(); MA_A = maAll(MA); return; }
    maSave();
    if (p.startsWith("target.")) { if ($("mnext-1")) $("mnext-1").disabled = !(MA.target.name || "").trim(); return; }
    MA_A = maAll(MA); if (MTAB === "deal") mRenderDeal(); else if (MTAB === "risks") mRenderRisks(); else maRender();
    return;
  }
  if (i.dataset && i.dataset.msyn) {
    const s = MA.synergies.find((x) => x.id === i.dataset.msyn); if (!s) return; const f = i.dataset.f;
    if (f === "name") s.name = i.value; else if (i.dataset.money) { const v = mParseMoney(i.value); if (Number.isNaN(v)) return; s[f] = v; } else { const v = i.value.trim() === "" ? "" : +i.value; if (v !== "" && !isFinite(v)) return; s[f] = v; }
    maSave(); MA_A = maAll(MA); mRenderDeal();
  }
  if (i.isContentEditable && i.id === "m-memo") { MA.memo = i.innerHTML; MA.memoEdited = true; maSave(); }
});
document.addEventListener("change", (e) => {
  const i = e.target;
  if (i.id === "m-file") { mUpload(i.files); i.value = ""; return; }
  if (i.id === "m-cur") { MA.currency = i.value; maSave(); maRender(); return; }
  if (i.dataset && i.dataset.mrisk) { const u = (MA.risks[i.dataset.mrisk] = MA.risks[i.dataset.mrisk] || {}); u[i.dataset.f] = i.value === "" ? "" : +i.value; maSave(); MA_A = maAll(MA); mRenderRisks(); return; }
  if (i.dataset && i.dataset.msyn && i.tagName === "SELECT") { const s = MA.synergies.find((x) => x.id === i.dataset.msyn); if (s) { s[i.dataset.f] = i.value; maSave(); MA_A = maAll(MA); mBuildSyn(); mRenderDeal(); } return; }
  if (i.dataset && i.dataset.mchoose) { MA.chosen[i.dataset.mchoose] = i.value; maSave(); maRender(); return; }
  if (i.type === "checkbox" && i.dataset.mk) { mSet(i.dataset.mk, i.checked); maSave(); MA_A = maAll(MA); mRenderDeal(); }
});
document.addEventListener("click", (e) => {
  const g = (s) => e.target.closest(s); let b;
  if ((b = g("[data-mnext]"))) { e.preventDefault(); mNext(1); return; }
  if ((b = g("[data-mback]"))) { e.preventDefault(); mNext(-1); return; }
  if ((b = g("[data-mstep]"))) { if (!b.disabled) maGo(b.dataset.mstep); return; }
  if ((b = g("[data-mresearch]"))) { mResearch(b.dataset.mresearch); return; }
  if ((b = g("[data-mpick]"))) { const f = $("m-file"); if (f) f.click(); return; }
  if ((b = g("[data-mexample]"))) { mLoadExample(); return; }
  if ((b = g("[data-mobj]"))) { const o = b.dataset.mobj; MA.objectives = MA.objectives.includes(o) ? MA.objectives.filter((x) => x !== o) : MA.objectives.concat(o); mBuildObjectives(); maSave(); return; }
  if ((b = g("[data-msrc]"))) { const s = MA.sources.find((x) => x.id === b.dataset.msrc); if (s) { s.status = s.status === "excluded" ? (s.kind === "upload" ? "analysed" : "found") : "excluded"; maSave(); maRender(); } return; }
  if ((b = g("[data-mcell]"))) { MCELL = MCELL === b.dataset.mcell ? null : b.dataset.mcell; mRenderNumbers(); setTimeout(() => { const i = $("m-cellval"); if (i) i.focus(); }, 20); return; }
  if ((b = g("[data-mcellclose]"))) { MCELL = null; mRenderNumbers(); return; }
  if ((b = g("[data-mcellsave]"))) { const v = mParseMoney($("m-cellval").value); if (v === null || Number.isNaN(v)) { $("m-cellerr").textContent = "Type a number, like 245m."; return; } const [m, y] = MCELL.split("|"); MA.facts = MA.facts.filter((f) => !(f.status === "user" && f.metric === m && f.year === y)); const id = mId(); MA.facts.push({ id, metric: m, year: y, value: m === "capex" || m === "cogs" || m === "interest" ? Math.abs(v) : v, currency: MA.currency, sourceId: null, status: "user" }); MA.chosen[MCELL] = id; maSave(); maRender(); return; }
  if ((b = g("[data-mcelldel]"))) { const [m, y] = MCELL.split("|"); MA.facts = MA.facts.filter((f) => !(f.status === "user" && f.metric === m && f.year === y)); delete MA.chosen[MCELL]; maSave(); maRender(); return; }
  if ((b = g("[data-maddyear]"))) { const ys = mYearsShown(MA_A.C); if (ys.length >= 3) { toastM("Version 1 uses up to 3 years."); return; } const ny = ys.length ? "FY" + (maYearKey(ys[0]) - 1) : "FY" + (new Date().getFullYear() - 1); MA.extraYears = (MA.extraYears || []).concat(ny); maSave(); if (MTAB !== "numbers") maGo("numbers"); else maRender(); return; }
  if ((b = g("[data-mallmetrics]"))) { MA.allMetrics = !MA.allMetrics; maSave(); mRenderNumbers(); return; }
  if ((b = g("[data-mai]"))) { mAI(b.dataset.mai); return; }
  if ((b = g("[data-mriskuse]"))) { const u = MA.risks[b.dataset.mriskuse]; if (u) { u.aiAccepted = true; u.l = ""; u.i = ""; } maSave(); maRender(); return; }
  if ((b = g("[data-mriskno]"))) { const u = MA.risks[b.dataset.mriskno]; if (u) { delete u.aiL; delete u.aiI; delete u.aiWhy; u.aiAccepted = false; } maSave(); maRender(); return; }
  if ((b = g("[data-mriskclear]"))) { const u = MA.risks[b.dataset.mriskclear]; if (u) { u.l = ""; u.i = ""; } maSave(); maRender(); return; }
  if ((b = g("[data-msynadd]"))) { MA.synergies.push({ id: mId(), name: "", category: "Procurement", type: "cost", label: "estimate", prob: 50 }); maSave(); MA_A = maAll(MA); mBuildSyn(); mRenderDeal(); return; }
  if ((b = g("[data-msyndel]"))) { MA.synergies = MA.synergies.filter((x) => x.id !== b.dataset.msyndel); maSave(); MA_A = maAll(MA); mBuildSyn(); mRenderDeal(); return; }
  if ((b = g("[data-msynaiadd]"))) { const x = MA.synAI[+b.dataset.msynaiadd]; if (x) { MA.synergies.push({ id: mId(), name: x.name, category: x.category, type: x.type, label: "ai", rationale: x.rationale, prob: 30 }); MA.synAI.splice(+b.dataset.msynaiadd, 1); } maSave(); MA_A = maAll(MA); mBuildSyn(); mRenderDeal(); return; }
  if ((b = g("[data-mmemoreset]"))) { MA.memoEdited = false; MA.memo = null; MA.memoExec = null; maSave(); mRenderMemo(); return; }
  if ((b = g("[data-mresume]"))) { $("mresume").hidden = true; return; }
  if ((b = g("[data-mrestart]"))) { mUndo = JSON.stringify(MA); MA = maFresh(); MCELL = null; mBuildAll(); maGo("target"); const r = $("mresume"); r.hidden = false; r.innerHTML = `<p>Started a new analysis.</p><div class="row"><button class="pill sm ghost" type="button" data-mundo="1">Undo</button><button class="pill sm ghost" type="button" data-mresume="1">OK</button></div>`; return; }
  if ((b = g("[data-mundo]"))) { if (mUndo) { MA = JSON.parse(mUndo); mUndo = null; mBuildAll(); maGo(MA.step || "target", true); $("mresume").hidden = true; } return; }
  if ((b = g("[data-mopen]"))) { mList().then((l) => { const it = l.find((x) => x.id === b.dataset.mopen); if (it && it.state) { mUndo = JSON.stringify(MA); MA = Object.assign(maFresh(), it.state); mBuildAll(); maGo(MA.step || "memo"); toastM(`Opened "${it.name}".`); } }); return; }
  if ((b = g("[data-mdel]"))) { const id = b.dataset.mdel; (async () => { if (DB && UID) { try { await DB.collection("data/users/" + UID).doc(id).delete(); } catch (err) {} } else { try { localStorage.setItem("ma-saved", JSON.stringify((await mList()).filter((x) => x.id !== id))); } catch (err) {} } toastM("Deleted."); mDrawSaved(); })(); return; }
});
$("msaveBtn").onclick = () => needProfile(mSaveRec, "save your analysis");
$("mexpWord").onclick = () => needProfile(async () => { const name = (MA.target.name || "due-diligence").toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-memo.doc"; const blob = new Blob([mExportDoc()], { type: "application/msword" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); toastM("Word document downloaded."); }, "export your memo");
$("mexpPdf").onclick = () => needProfile(() => { const w = window.open("", "_blank"); if (!w) { toastM("Your browser blocked the print window. Allow pop-ups for this site and try again."); return; } w.document.write(mExportDoc().replace("</body>", "<script>window.onload=()=>{window.print();}<\/script></body>")); w.document.close(); toastM("Choose \"Save as PDF\" in the print window."); }, "export your memo");
(function () { const d = $("m-drop"); if (!d) return; ["dragover", "dragenter"].forEach((ev) => d.addEventListener(ev, (e) => { e.preventDefault(); d.classList.add("over"); })); ["dragleave", "drop"].forEach((ev) => d.addEventListener(ev, (e) => { e.preventDefault(); d.classList.remove("over"); })); d.addEventListener("drop", (e) => mUpload(e.dataTransfer.files)); })();
mBuildAll(); MTAB = MA.step && mIdx(MA.step) >= 0 ? MA.step : "target"; MSTEPS.forEach(([k]) => { $("mp-" + k).hidden = k !== MTAB; }); setTimeout(mDrawSaved, 700);
