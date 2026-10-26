/* ===== M&A Due Diligence Analyst: calculation engine =====
   Deterministic. No AI. Every number on screen comes from here.
   AI (Gemini) only collects inputs; this engine turns inputs into results. */

const MA_METRICS = [
  ["revenue", "Revenue", "is"], ["cogs", "Cost of goods sold", "is"], ["grossProfit", "Gross profit", "is"],
  ["ebitda", "EBITDA", "is"], ["adjEbitda", "Adjusted EBITDA", "is"], ["ebit", "EBIT (operating profit)", "is"],
  ["netIncome", "Net income", "is"], ["interest", "Interest expense", "is"], ["tax", "Tax expense", "is"],
  ["ocf", "Operating cash flow", "cf"], ["capex", "Capital expenditure", "cf"],
  ["cash", "Cash and equivalents", "bs"], ["totalDebt", "Total debt", "bs"], ["totalAssets", "Total assets", "bs"],
  ["totalLiabilities", "Total liabilities", "bs"], ["receivables", "Trade receivables", "bs"], ["inventory", "Inventory", "bs"],
  ["payables", "Trade payables", "bs"], ["headcount", "Employees", "ot"],
];
const MA_METRIC_NAME = Object.fromEntries(MA_METRICS.map((m) => [m[0], m[1]]));
const MA_CORE = ["revenue", "ebitda", "netIncome", "ocf", "capex", "cash", "totalDebt"];
const MA_OBJECTIVES = ["Revenue growth", "Market expansion", "Geographic expansion", "Technology acquisition", "Customer access", "Cost synergies", "Supply chain integration", "Financial investment", "Product expansion", "Talent or IP"];
const MA_RISK_AREAS = [
  ["financial", "Financial health"], ["earnings", "Earnings quality"], ["liquidity", "Liquidity"], ["leverage", "Leverage"],
  ["commercial", "Commercial attractiveness"], ["customers", "Customer concentration"], ["suppliers", "Supplier concentration"],
  ["regulatory", "Regulatory exposure"], ["operations", "Operational resilience"], ["technology", "Technology dependencies"],
  ["fit", "Strategic fit"], ["info", "Information completeness"],
];
const MA_SYN_CATS = ["Procurement", "Headcount", "Finance and admin", "HR", "Technology", "Facilities", "Manufacturing", "Distribution", "Logistics", "Marketing", "Cross-selling", "Geographic expansion", "Product bundling", "Working capital"];
const MA_RECS = ["Proceed to next diligence stage", "Proceed with conditions", "Pause pending further evidence", "Do not proceed based on current evidence"];
const MA_UNIT = { units: 1, thousands: 1e3, k: 1e3, millions: 1e6, m: 1e6, mn: 1e6, billions: 1e9, bn: 1e9, b: 1e9 };

function maNum(v) { return v === null || v === undefined || v === "" || !isFinite(+v) ? null : +v; }
/** Convert a reported value + unit into an absolute number. */
function maAbs(value, unit) { const v = maNum(value); if (v === null) return null; const f = MA_UNIT[String(unit || "units").toLowerCase().replace(/[^a-z]/g, "")] || 1; return v * f; }
/** Sort fiscal-year labels like "FY2023", "2024", "FY24". */
function maYearKey(y) { const m = String(y).match(/(\d{4})|(\d{2})$/); if (!m) return 0; return m[1] ? +m[1] : 2000 + +m[2]; }
function maYearLabel(y) { const k = maYearKey(y); return k ? "FY" + k : String(y); }

/* ---------- picking one value per metric and year ---------- */
/** Facts are {id, metric, year, value(absolute), currency, sourceId, page, status:'reported'|'web'|'unverified'|'user', excluded}.
    Returns the value table plus detected conflicts. */
function maTable(M) {
  const srcOk = (f) => { if (f.status === "user") return true; const s = (M.sources || []).find((x) => x.id === f.sourceId); return s && s.status !== "excluded"; };
  const facts = (M.facts || []).filter((f) => f && maNum(f.value) !== null && MA_METRIC_NAME[f.metric] && f.year && srcOk(f) && (!f.currency || !M.currency || f.currency === M.currency));
  const fxSkipped = (M.facts || []).filter((f) => f && f.currency && M.currency && f.currency !== M.currency && maNum(f.value) !== null).length;
  const years = [...new Set(facts.map((f) => maYearLabel(f.year)))].sort((a, b) => maYearKey(b) - maYearKey(a)).slice(0, 3).sort((a, b) => maYearKey(a) - maYearKey(b));
  const rank = { user: 4, reported: 3, web: 2, unverified: 1 };
  const cells = {}, conflicts = [];
  for (const m of MA_METRICS.map((x) => x[0])) for (const y of years) {
    const key = m + "|" + y;
    const opts = facts.filter((f) => f.metric === m && maYearLabel(f.year) === y);
    if (!opts.length) { cells[key] = null; continue; }
    // distinct values (within 0.5%) from different sources = a conflict
    const distinct = [];
    for (const f of opts) if (!distinct.some((d) => Math.abs(d.value - f.value) <= Math.max(Math.abs(d.value), Math.abs(f.value)) * 0.005)) distinct.push(f);
    let pick = null;
    const chosenId = M.chosen && M.chosen[key];
    if (chosenId) pick = opts.find((f) => f.id === chosenId) || null;
    if (!pick) pick = opts.slice().sort((a, b) => (rank[b.status] || 0) - (rank[a.status] || 0))[0];
    cells[key] = pick;
    if (distinct.length > 1 && !opts.some((f) => f.status === "user")) conflicts.push({ key, metric: m, year: y, options: distinct, using: pick, resolved: !!chosenId });
  }
  return { years, cells, conflicts, fxSkipped };
}

/* ---------- financial analysis ---------- */
function maCalc(M) {
  const T = maTable(M);
  const val = (m, y) => { const c = T.cells[m + "|" + y]; return c ? c.value : null; };
  const div = (a, b) => (a === null || b === null || b === 0 ? null : a / b);
  const sub = (a, b) => (a === null || b === null ? null : a - b);
  const rows = T.years.map((y, i) => {
    const prev = i > 0 ? T.years[i - 1] : null;
    const rev = val("revenue", y), cogs = val("cogs", y);
    const gp = val("grossProfit", y) !== null ? val("grossProfit", y) : sub(rev, cogs);
    const ebitda = val("ebitda", y), adj = val("adjEbitda", y), ebit = val("ebit", y), ni = val("netIncome", y);
    const ocf = val("ocf", y), capexRaw = val("capex", y), capex = capexRaw === null ? null : Math.abs(capexRaw);
    const cash = val("cash", y), debt = val("totalDebt", y), interest = val("interest", y) === null ? null : Math.abs(val("interest", y));
    const fcf = sub(ocf, capex), netDebt = sub(debt, cash);
    const g = (m) => { if (!prev) return null; const a = m === "grossProfit" ? gp : val(m, y), b = m === "grossProfit" ? null : val(m, prev); return a === null || b === null || b === 0 ? null : (a - b) / Math.abs(b); };
    return {
      year: y, revenue: rev, cogs, grossProfit: gp, ebitda, adjEbitda: adj, ebit, netIncome: ni, ocf, capex, fcf, cash, debt, netDebt, interest,
      receivables: val("receivables", y), inventory: val("inventory", y),
      revGrowth: g("revenue"), ebitdaGrowth: g("ebitda"),
      grossMargin: div(gp, rev), ebitdaMargin: div(ebitda, rev), ebitMargin: div(ebit, rev), netMargin: div(ni, rev), fcfMargin: div(fcf, rev),
      ndEbitda: netDebt !== null && ebitda !== null && ebitda > 0 ? netDebt / ebitda : null,
      interestCover: ebit !== null && interest ? ebit / interest : null,
      cashConversion: div(ocf, ebitda),
      recDays: rev ? div(val("receivables", y), rev) * 365 : null,
    };
  });
  const latest = rows[rows.length - 1] || null, first = rows[0] || null;
  return { T, rows, latest, first, flags: maFlags(rows), quality: maQuality(M, T), };
}

/** Earnings-quality and financial warning signs, detected from numbers only. */
function maFlags(rows) {
  const out = [], L = rows[rows.length - 1], P = rows[rows.length - 2], F = rows[0];
  const pc = (x) => (x * 100).toFixed(1) + "%";
  const add = (id, sev, fact, question) => out.push({ id, sev, fact, question });
  if (!L) return out;
  if (P && L.ebitda !== null && P.ebitda !== null && L.ocf !== null && P.ocf !== null && L.ebitda > P.ebitda && L.ocf < P.ocf)
    add("ebitda_vs_cash", "amber", `EBITDA rose from ${maFmt(P.ebitda)} to ${maFmt(L.ebitda)}, but operating cash flow fell from ${maFmt(P.ocf)} to ${maFmt(L.ocf)}.`, "Why is cash flow falling while EBITDA rises? Ask for a working capital bridge and details of any non-cash income.");
  if (F && F !== L && F.ebitdaMargin !== null && L.ebitdaMargin !== null && L.ebitdaMargin < F.ebitdaMargin - 0.02)
    add("margin_decline", "amber", `EBITDA margin fell from ${pc(F.ebitdaMargin)} in ${F.year} to ${pc(L.ebitdaMargin)} in ${L.year}.`, "What is driving the lower margin: pricing, product mix, input costs or overheads? Ask for a cost breakdown by year.");
  const negF = rows.filter((r) => r.fcf !== null && r.fcf < 0);
  if (negF.length >= 2 || (L.fcf !== null && L.fcf < 0))
    add("neg_fcf", negF.length >= 2 ? "red" : "amber", `Free cash flow was negative in ${negF.map((r) => r.year).join(", ")} (latest: ${maFmt(L.fcf)}).`, "How is the business funding the cash shortfall, and when does management expect free cash flow to turn positive?");
  if (P && L.receivables !== null && P.receivables && L.revenue !== null && P.revenue) {
    const rg = (L.receivables - P.receivables) / Math.abs(P.receivables), vg = (L.revenue - P.revenue) / Math.abs(P.revenue);
    if (rg - vg > 0.1) add("receivables", "amber", `Receivables grew ${pc(rg)} while revenue grew ${pc(vg)}.`, "Are customers paying more slowly? Ask for an aged receivables report and bad-debt history.");
  }
  if (P && L.inventory !== null && P.inventory && L.revenue !== null && P.revenue) {
    const ig = (L.inventory - P.inventory) / Math.abs(P.inventory), vg = (L.revenue - P.revenue) / Math.abs(P.revenue);
    if (ig - vg > 0.15) add("inventory", "amber", `Inventory grew ${pc(ig)} while revenue grew ${pc(vg)}.`, "Is stock building up because sales are slowing? Ask for inventory ageing and write-off history.");
  }
  if (L.adjEbitda !== null && L.ebitda !== null && L.ebitda > 0 && L.adjEbitda > L.ebitda * 1.15)
    add("adjustments", "amber", `Adjusted EBITDA (${maFmt(L.adjEbitda)}) is ${pc(L.adjEbitda / L.ebitda - 1)} higher than reported EBITDA (${maFmt(L.ebitda)}).`, "What are the adjustments, and are any of them actually recurring costs? Ask for a full reconciliation.");
  if (L.ndEbitda !== null && (L.ndEbitda > 3 || (P && P.ndEbitda !== null && L.ndEbitda > P.ndEbitda + 0.5)))
    add("leverage", L.ndEbitda > 4 ? "red" : "amber", `Net debt is ${L.ndEbitda.toFixed(1)}× EBITDA${P && P.ndEbitda !== null ? ` (was ${P.ndEbitda.toFixed(1)}×)` : ""}.`, "What are the debt maturities and covenants, and is any refinancing due soon?");
  if (L.interestCover !== null && L.interestCover < 3)
    add("interest", L.interestCover < 1.5 ? "red" : "amber", `Operating profit covers interest only ${L.interestCover.toFixed(1)} times.`, "How sensitive is the business to higher interest rates, and what happens if profit dips?");
  if (L.cashConversion !== null && L.ebitda > 0 && L.cashConversion < 0.6)
    add("conversion", "amber", `Only ${pc(L.cashConversion)} of EBITDA turned into operating cash flow in ${L.year}.`, "Where is the cash going? Check working capital, provisions and one-off items.");
  if (L.netIncome !== null && L.netIncome < 0)
    add("loss", "amber", `The company made a net loss of ${maFmt(L.netIncome)} in ${L.year}.`, "Is the loss from one-off items or the underlying business? Ask for a bridge from operating profit to net income.");
  return out;
}

/** How complete and trustworthy the evidence is. */
function maQuality(M, T) {
  const ly = T.years[T.years.length - 1];
  let have = 0, reported = 0;
  for (const m of MA_CORE) { const c = ly ? T.cells[m + "|" + ly] : null; if (c) { have++; if (c.status === "reported" || c.status === "user") reported++; } }
  const allCells = Object.values(T.cells).filter(Boolean);
  const verified = allCells.filter((c) => c.status === "reported" || c.status === "user").length;
  const unverified = allCells.length - verified;
  const missing = ly ? MA_CORE.filter((m) => !T.cells[m + "|" + ly]) : MA_CORE.slice();
  const score = (have / MA_CORE.length) * 0.5 + (reported / MA_CORE.length) * 0.3 + (Math.min(T.years.length, 3) / 3) * 0.2;
  return { score, have, reported, years: T.years.length, verified, unverified, missing, conflicts: T.conflicts.filter((c) => !c.resolved).length };
}

/* ---------- risk matrix ---------- */
function maRiskStatus(score, th) { if (score === null) return "grey"; return score >= th.red ? "red" : score >= th.amber ? "amber" : "green"; }
/** Suggested likelihood/impact from the numbers, where the numbers allow it. Null = not enough evidence. */
function maRiskAuto(C, M) {
  const L = C.latest, q = C.quality, flags = C.flags, s = {};
  const set = (k, l, i, why) => (s[k] = { l, i, why });
  if (L && L.netMargin !== null) set("financial", L.netMargin < 0 ? 4 : L.netMargin < 0.05 ? 3 : 2, 4, `Net margin ${(L.netMargin * 100).toFixed(1)}%${L.fcf !== null ? `, free cash flow ${maFmt(L.fcf)}` : ""}.`);
  if (L && (L.cashConversion !== null || L.ebitda !== null)) { const n = flags.filter((f) => ["ebitda_vs_cash", "adjustments", "conversion", "receivables", "inventory"].includes(f.id)).length; set("earnings", Math.min(5, 1 + n), 4, n ? `${n} earnings-quality warning sign${n > 1 ? "s" : ""} found.` : "No earnings-quality warning signs in the figures available."); }
  if (L && L.cash !== null && L.fcf !== null) { const runway = L.fcf < 0 ? L.cash / -L.fcf : Infinity; set("liquidity", runway < 1 ? 5 : runway < 2 ? 4 : L.fcf < 0 ? 3 : 1, 5, L.fcf < 0 ? `Cash covers about ${runway.toFixed(1)} years of current cash burn.` : "Free cash flow is positive."); }
  if (L && L.ndEbitda !== null) set("leverage", L.ndEbitda > 4 ? 5 : L.ndEbitda > 3 ? 4 : L.ndEbitda > 2 ? 3 : L.ndEbitda > 0 ? 2 : 1, 4, `Net debt / EBITDA ${L.ndEbitda.toFixed(1)}×${L.interestCover !== null ? `, interest cover ${L.interestCover.toFixed(1)}×` : ""}.`);
  else if (L && L.netDebt !== null && L.netDebt <= 0) set("leverage", 1, 4, "The company has more cash than debt.");
  const mg = maNum(M.commercial ? M.commercial.growthPct : null);
  if (mg !== null) set("commercial", mg < 0 ? 4 : mg < 3 ? 3 : 2, 3, `Market growth about ${mg}% a year (from market research).`);
  const qi = q.score >= 0.8 ? 1 : q.score >= 0.6 ? 2 : q.score >= 0.4 ? 3 : q.score >= 0.2 ? 4 : 5;
  set("info", qi, 4, `${q.have} of ${MA_CORE.length} core figures found for the latest year, ${q.reported} from official documents, over ${q.years} year${q.years === 1 ? "" : "s"}.`);
  return s;
}
function maRisks(M, C) {
  const auto = maRiskAuto(C, M), th = M.thresholds || { red: 15, amber: 8 };
  return MA_RISK_AREAS.map(([k, label]) => {
    const u = (M.risks && M.risks[k]) || {};
    const src = u.l && u.i ? "user" : u.aiL && u.aiI && u.aiAccepted ? "ai" : auto[k] ? "auto" : null;
    const l = src === "user" ? +u.l : src === "ai" ? +u.aiL : src === "auto" ? auto[k].l : null;
    const i = src === "user" ? +u.i : src === "ai" ? +u.aiI : src === "auto" ? auto[k].i : null;
    const score = l && i ? l * i : null;
    return { key: k, label, l, i, score, status: maRiskStatus(score, th), source: src, why: (src === "auto" && auto[k].why) || (src === "ai" && u.aiWhy) || u.note || "", mitigation: u.mitigation || "", needed: u.needed || "" };
  });
}

/* ---------- synergies ---------- */
function maSynergy(s) {
  const base = maNum(s.base) || 0, pct = (maNum(s.pct) || 0) / 100, prob = Math.min(1, Math.max(0, (maNum(s.prob) === null ? 50 : maNum(s.prob)) / 100));
  const margin = s.type === "revenue" ? Math.min(1, Math.max(0, (maNum(s.margin) === null ? 30 : maNum(s.margin)) / 100)) : 1;
  const gross = base * pct * margin;               // annual profit impact at full run-rate
  const riskAdj = gross * prob;
  const recurring = maNum(s.recurringCost) || 0;
  return { gross, riskAdj, net: riskAdj - recurring, oneOff: maNum(s.implCost) || 0, recurring, prob, margin };
}
function maSynergies(M) {
  const items = (M.synergies || []).map((s) => Object.assign({ s }, maSynergy(s)));
  const sum = (k, f) => items.filter(f || (() => true)).reduce((a, x) => a + x[k], 0);
  return { items, gross: sum("gross"), riskAdj: sum("riskAdj"), net: sum("net"), oneOff: sum("oneOff"), recurring: sum("recurring"),
    byLabel: { disclosed: sum("riskAdj", (x) => x.s.label === "disclosed"), estimate: sum("riskAdj", (x) => x.s.label === "estimate"), ai: sum("riskAdj", (x) => x.s.label === "ai") } };
}

/* ---------- valuation ---------- */
function maValuation(M, C, SY) {
  const V = M.valuation || {}, L = C.latest || {};
  const useAdj = V.useAdjusted && L.adjEbitda !== null && L.adjEbitda !== undefined;
  const ebitda0 = maNum(V.ebitda) !== null ? maNum(V.ebitda) : useAdj ? L.adjEbitda : L.ebitda;
  const debt = maNum(V.debt) !== null ? maNum(V.debt) : L.debt, cash = maNum(V.cash) !== null ? maNum(V.cash) : L.cash;
  const debtLike = maNum(V.debtLike) || 0, tx = maNum(V.txCosts) || 0, integ = maNum(V.integrationCosts) || 0;
  const own = Math.min(100, Math.max(0, maNum(V.ownership) === null ? 100 : maNum(V.ownership))) / 100;
  const price = maNum(V.price);
  const sc = [["downside", "Downside"], ["base", "Base"], ["upside", "Upside"]].map(([k, l]) => {
    const mult = maNum((V.multiples || {})[k]) !== null ? maNum(V.multiples[k]) : { downside: 6, base: 8, upside: 10 }[k];
    const adj = maNum((V.ebitdaAdj || {})[k]) !== null ? maNum(V.ebitdaAdj[k]) : { downside: -15, base: 0, upside: 10 }[k];
    const e = ebitda0 === null || ebitda0 === undefined ? null : ebitda0 * (1 + adj / 100);
    const ev = e === null ? null : e * mult;
    const eq = ev === null || debt === null || debt === undefined || cash === null || cash === undefined ? null : ev - debt + cash - debtLike;
    return { key: k, label: l, mult, adj, ebitda: e, ev, equity: eq, stake: eq === null ? null : eq * own };
  });
  const base = sc[1];
  const synValue = SY.net * (base.mult || 0) * 0.5;   // capitalised at half the base multiple: synergies are less certain than profit
  const walkAway = base.stake === null ? null : base.stake + synValue * own - SY.oneOff - tx - integ;
  let verdict = null;
  if (price !== null && base.stake !== null) verdict = price <= base.stake ? "supported" : price <= walkAway ? "needs_synergies" : sc[2].stake !== null && price <= sc[2].stake ? "stretched" : "not_supported";
  return { ebitda0, useAdj, debt, cash, debtLike, tx, integ, own, price, scenarios: sc, synValue, walkAway, verdict,
    impliedMultiple: price !== null && ebitda0 ? (price / own + (debt || 0) - (cash || 0) + debtLike) / ebitda0 : null };
}

/* ---------- recommendation (transparent rules) ---------- */
function maRecommend(M, C, R, VA) {
  const q = C.quality, reds = R.filter((r) => r.status === "red"), finReds = reds.filter((r) => ["financial", "earnings", "liquidity", "leverage"].includes(r.key));
  const reasons = [];
  let rec;
  if (q.score < 0.5) { rec = 2; reasons.push(`Only ${q.have} of ${MA_CORE.length} core financial figures are available for the latest year, so a reliable financial assessment can't be completed yet.`); }
  else if (finReds.length && VA.verdict === "not_supported") { rec = 3; reasons.push(`Red flags in ${finReds.map((r) => r.label.toLowerCase()).join(", ")} and the price isn't supported by the valuation.`); }
  else if (reds.length || VA.verdict === "stretched" || VA.verdict === "not_supported" || VA.verdict === "needs_synergies" || q.score < 0.75 || q.conflicts) {
    rec = 1;
    if (reds.length) reasons.push(`${reds.length} red risk${reds.length > 1 ? "s" : ""}: ${reds.map((r) => r.label.toLowerCase()).join(", ")}.`);
    if (VA.verdict === "needs_synergies") reasons.push("The price only works if the expected synergies are achieved.");
    if (VA.verdict === "stretched") reasons.push("The price is only supported in the upside scenario.");
    if (VA.verdict === "not_supported") reasons.push("The price is above even the upside valuation.");
    if (q.score < 0.75) reasons.push("Some key financial figures are missing or unverified.");
    if (q.conflicts) reasons.push(`${q.conflicts} figure${q.conflicts > 1 ? "s have" : " has"} conflicting sources still to resolve.`);
  } else { rec = 0; reasons.push("The evidence is reasonably complete, no red risks were found and the price is within the base valuation."); }
  if (VA.verdict === null && rec !== 2) reasons.push("No price was entered, so the valuation check was skipped.");
  return { idx: rec, label: MA_RECS[rec], reasons };
}

/** Everything at once. */
function maAll(M) {
  const C = maCalc(M), R = maRisks(M, C), SY = maSynergies(M), VA = maValuation(M, C, SY), RE = maRecommend(M, C, R, VA);
  return { C, R, SY, VA, RE };
}

/* ---------- formatting ---------- */
let MA_CUR = "£";
function maFmt(v, dp) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  const a = Math.abs(v), s = v < 0 ? "−" : "";
  const fx = (x, u, d) => s + MA_CUR + x.toFixed(dp !== undefined ? dp : d) + u;
  if (a >= 1e9) return fx(a / 1e9, "B", a >= 1e11 ? 0 : a >= 1e10 ? 1 : 2);
  if (a >= 1e6) return fx(a / 1e6, "M", a >= 1e8 ? 0 : 1);
  if (a >= 1e4) return fx(a / 1e3, "K", 0);
  return s + MA_CUR + Math.round(a).toLocaleString("en-GB");
}
if (typeof module !== "undefined") module.exports = { MA_METRICS, MA_CORE, MA_RISK_AREAS, maAbs, maYearKey, maYearLabel, maTable, maCalc, maFlags, maQuality, maRisks, maRiskAuto, maSynergy, maSynergies, maValuation, maRecommend, maAll, maFmt };
