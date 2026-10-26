/*
  BBC – Big Brain Consulting: the website's "back door" (API).
  Runs on Cloudflare Pages Functions. Every request to /api/... arrives here.

  What it does:
  - /api/ai        asks Gemini a question for an AI button (the secret key stays here, never in the website)
  - /api/doc(s)    saves, reads and deletes a visitor's profile and saved analyses
  - /api/event     counts simple activity (which tool was opened)
  - /api/admin/... the private admin page (needs the admin password)
  - /api/health    a quick "is everything connected?" check

  Settings it reads (set in Cloudflare, never written in code):
  - DB              the D1 database (connected in wrangler.toml)
  - GEMINI_API_KEY  secret: your Gemini key
  - ADMIN_PASSWORD  secret: the password for the admin page
  - GEMINI_MODEL, GEMINI_MODEL_QUICK, AI_DAILY_LIMIT, AI_GLOBAL_DAILY_LIMIT (optional)
*/

const DAY = 86400000;
const MAX_PROMPT = 16000;
const MAX_DOC = 400000; // characters of JSON per saved item

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, name TEXT, email TEXT, role TEXT, work TEXT, news INTEGER, created_at INTEGER, updated_at INTEGER, last_seen INTEGER)`,
  `CREATE TABLE IF NOT EXISTS docs (uid TEXT NOT NULL, id TEXT NOT NULL, kind TEXT, name TEXT, data TEXT, updated_at INTEGER, PRIMARY KEY (uid, id))`,
  `CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT, name TEXT, email TEXT, company TEXT, decision TEXT, stage TEXT, timeline TEXT, data TEXT, status TEXT DEFAULT 'new', created_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS ai_queries (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT, ip_hash TEXT, tool TEXT, summary TEXT, prompt TEXT, response TEXT, ok INTEGER, error TEXT, model TEXT, ms INTEGER, created_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT, type TEXT, detail TEXT, created_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS ai_time ON ai_queries (created_at)`,
  `CREATE INDEX IF NOT EXISTS ai_ip ON ai_queries (ip_hash, created_at)`,
  `CREATE INDEX IF NOT EXISTS ev_time ON events (created_at)`,
  `CREATE INDEX IF NOT EXISTS users_email ON users (email)`,
];
let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
  schemaReady = true;
}

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
const fail = (status, error, message) => json({ error, message }, status);

const validUid = (u) => typeof u === "string" && /^[A-Za-z0-9-]{8,64}$/.test(u);
const clip = (s, n) => (s == null ? null : String(s).slice(0, n));

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin GETs may omit it
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
function safeEqual(a, b) {
  a = String(a || "");
  b = String(b || "");
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/* ---------- Gemini ---------- */
async function callGemini(env, model, prompt, timeoutMs) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 25000);
  let res;
  try {
  res = await fetch(url, {
    signal: ctrl.signal,
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
    }),
  });
  } catch (e) {
    throw Object.assign(new Error(e.name === "AbortError" ? "Gemini took too long" : e.message), { status: 504 });
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error((body.error && body.error.message) || "Gemini error " + res.status);
    e.status = res.status;
    throw e;
  }
  const parts = (body.candidates && body.candidates[0] && body.candidates[0].content && body.candidates[0].content.parts) || [];
  const text = parts.map((p) => p.text || "").join("").trim();
  if (!text) throw Object.assign(new Error("Gemini returned an empty answer"), { status: 502 });
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return { text, data: JSON.parse(cleaned) };
}

async function handleAI(request, env) {
  if (request.method !== "POST") return fail(405, "method");
  if (!sameOrigin(request)) return fail(403, "origin");
  if (!env.GEMINI_API_KEY) return fail(503, "not_configured", "AI isn't switched on yet.");
  const b = await readBody(request);
  if (!b || typeof b.prompt !== "string" || !b.prompt.trim()) return fail(400, "bad_request");
  if (b.prompt.length > MAX_PROMPT) return fail(413, "too_long");
  const uid = validUid(b.uid) ? b.uid : null;
  const tool = ["sim", "ops", "ma", "growth"].includes(b.tool) ? b.tool : "other";
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = (await sha256("bbc|" + ip)).slice(0, 24);
  const now = Date.now();

  const perVisitor = +env.AI_DAILY_LIMIT || 60;
  const overall = +env.AI_GLOBAL_DAILY_LIMIT || 1200;
  const counts = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n FROM ai_queries WHERE ip_hash = ? AND created_at > ?").bind(ipHash, now - DAY),
    env.DB.prepare("SELECT COUNT(*) AS n FROM ai_queries WHERE created_at > ?").bind(now - DAY),
  ]);
  if (counts[0].results[0].n >= perVisitor)
    return fail(429, "rate_limited", "You've used today's AI allowance. It resets within 24 hours.");
  if (counts[1].results[0].n >= overall)
    return fail(429, "rate_limited", "The AI is very busy today. Please try again tomorrow.");

  const quick = b.tier === "quick";
  // models to try, in order; each gets a time limit, then the next one is tried
  const list = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
  const chain = quick
    ? list(env.GEMINI_MODELS_QUICK || "gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-flash-lite-latest")
    : list(env.GEMINI_MODELS || "gemini-3.5-flash,gemini-3.8-flash,gemini-3.1-flash-lite");
  const summary = clip(b.prompt.split("\n").find((l) => l.trim()) || "", 160);
  let model = chain[0], result = null, err = null;
  const t0 = Date.now();
  for (let i = 0; i < chain.length && !result; i++) {
    model = chain[i];
    const left = 55000 - (Date.now() - t0);
    if (left < 5000) break;
    try {
      result = await callGemini(env, model, b.prompt, Math.min(i === chain.length - 1 ? left : 25000, left));
      err = null;
    } catch (e) {
      err = e;
      if (e instanceof SyntaxError) continue; // answer wasn't valid JSON: try the next model
    }
  }
  const ms = Date.now() - t0;
  await env.DB.prepare(
    "INSERT INTO ai_queries (uid, ip_hash, tool, summary, prompt, response, ok, error, model, ms, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
  )
    .bind(uid, ipHash, tool, summary, clip(b.prompt, 6000), result ? clip(result.text, 6000) : null, result ? 1 : 0, err ? clip(err.message, 300) : null, model, ms, now)
    .run();
  if (uid) await env.DB.prepare("UPDATE users SET last_seen = ? WHERE uid = ?").bind(now, uid).run();

  if (!result) {
    if (err && err.status === 429) return fail(429, "rate_limited", "The AI is busy right now. Try again in a minute.");
    return fail(502, "ai_failed", "The AI couldn't answer this time. Try again.");
  }
  return json({ data: result.data });
}

/* ---------- saved data ---------- */
// The site uses two kinds of path:  data/users/{uid}/{id}  (profile and saved analyses)  and  requests/{uid}  ("Hire a team")
function parseDocPath(path, uid) {
  if (typeof path !== "string" || !validUid(uid)) return null;
  const p = path.split("/");
  if (p.length === 4 && p[0] === "data" && p[1] === "users" && p[2] === uid && /^[A-Za-z0-9_-]{1,64}$/.test(p[3])) return { type: "doc", id: p[3] };
  if (p.length === 2 && p[0] === "requests" && p[1] === uid) return { type: "request" };
  return null;
}

async function handleDocs(request, env, url) {
  const uid = url.searchParams.get("uid");
  const path = url.searchParams.get("path");
  if (!validUid(uid) || path !== `data/users/${uid}`) return fail(400, "bad_path");
  const r = await env.DB.prepare("SELECT id, data FROM docs WHERE uid = ? ORDER BY updated_at DESC LIMIT 500").bind(uid).all();
  return json({ docs: r.results.map((x) => ({ id: x.id, data: JSON.parse(x.data) })) });
}

async function handleDoc(request, env, url) {
  if (request.method === "GET" || request.method === "DELETE") {
    const uid = url.searchParams.get("uid");
    const target = parseDocPath(url.searchParams.get("path"), uid);
    if (!target || target.type !== "doc") return fail(400, "bad_path");
    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT data FROM docs WHERE uid = ? AND id = ?").bind(uid, target.id).first();
      return json({ data: row ? JSON.parse(row.data) : null });
    }
    if (!sameOrigin(request)) return fail(403, "origin");
    await env.DB.prepare("DELETE FROM docs WHERE uid = ? AND id = ?").bind(uid, target.id).run();
    return json({ ok: true });
  }
  if (request.method !== "PUT") return fail(405, "method");
  if (!sameOrigin(request)) return fail(403, "origin");
  const b = await readBody(request);
  if (!b) return fail(400, "bad_request");
  const target = parseDocPath(b.path, b.uid);
  if (!target) return fail(400, "bad_path");
  const d = b.data && typeof b.data === "object" ? b.data : null;
  if (!d) return fail(400, "bad_data");
  const text = JSON.stringify(d);
  if (text.length > MAX_DOC) return fail(413, "too_big", "This analysis is too large to save.");
  const now = Date.now();

  if (target.type === "request") {
    await env.DB.prepare(
      "INSERT INTO requests (uid, name, email, company, decision, stage, timeline, data, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
    )
      .bind(b.uid, clip(d.name, 200), clip(d.email, 200), clip(d.company, 200), clip(d.decision, 4000), clip(d.stage, 100), clip(d.timeline, 100), text, now)
      .run();
    return json({ ok: true });
  }

  const kind = target.id === "profile" ? "profile" : target.id.split("_")[0];
  const stmts = [
    env.DB.prepare(
      "INSERT INTO docs (uid, id, kind, name, data, updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(uid, id) DO UPDATE SET kind = excluded.kind, name = excluded.name, data = excluded.data, updated_at = excluded.updated_at"
    ).bind(b.uid, target.id, kind, clip(d.name, 200), text, now),
  ];
  if (kind === "profile") {
    stmts.push(
      env.DB.prepare(
        "INSERT INTO users (uid, name, email, role, work, news, created_at, updated_at, last_seen) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET name = excluded.name, email = excluded.email, role = excluded.role, work = excluded.work, news = excluded.news, updated_at = excluded.updated_at, last_seen = excluded.last_seen"
      ).bind(b.uid, clip(d.name, 200), clip(d.email, 200), clip(d.role, 100), clip(d.work, 300), d.news ? 1 : 0, now, now, now)
    );
  } else {
    stmts.push(env.DB.prepare("UPDATE users SET last_seen = ? WHERE uid = ?").bind(now, b.uid));
  }
  await env.DB.batch(stmts);
  return json({ ok: true });
}

async function handleEvent(request, env) {
  if (request.method !== "POST") return fail(405, "method");
  if (!sameOrigin(request)) return fail(403, "origin");
  const b = await readBody(request);
  if (!b || typeof b.type !== "string" || !/^[a-z_]{2,30}$/.test(b.type)) return fail(400, "bad_request");
  const uid = validUid(b.uid) ? b.uid : null;
  const now = Date.now();
  const stmts = [env.DB.prepare("INSERT INTO events (uid, type, detail, created_at) VALUES (?,?,?,?)").bind(uid, b.type, clip(b.detail, 100), now)];
  if (uid) stmts.push(env.DB.prepare("UPDATE users SET last_seen = ? WHERE uid = ?").bind(now, uid));
  await env.DB.batch(stmts);
  return json({ ok: true });
}

/* ---------- admin ---------- */
async function handleAdmin(request, env, url, part) {
  if (!env.ADMIN_PASSWORD) return fail(503, "not_configured", "Set ADMIN_PASSWORD in Cloudflare first.");
  if (!safeEqual(request.headers.get("x-admin-key"), env.ADMIN_PASSWORD)) return fail(401, "wrong_password", "That password isn't right.");
  const now = Date.now();

  if (part === "summary" && request.method === "GET") {
    // tidy-up as promised on the privacy page: AI questions kept 12 months, activity 13 months
    await env.DB.batch([
      env.DB.prepare("DELETE FROM ai_queries WHERE created_at < ?").bind(now - 365 * DAY),
      env.DB.prepare("DELETE FROM events WHERE created_at < ?").bind(now - 400 * DAY),
      env.DB.prepare("DELETE FROM requests WHERE created_at < ?").bind(now - 730 * DAY),
      env.DB.prepare("DELETE FROM docs WHERE uid IN (SELECT uid FROM users WHERE COALESCE(last_seen, updated_at, created_at) < ?)").bind(now - 730 * DAY),
      env.DB.prepare("DELETE FROM users WHERE COALESCE(last_seen, updated_at, created_at) < ?").bind(now - 730 * DAY),
      env.DB.prepare("DELETE FROM docs WHERE uid NOT IN (SELECT uid FROM users) AND updated_at < ?").bind(now - 730 * DAY),
    ]);
    const q = (sql, ...args) => env.DB.prepare(sql).bind(...args);
    const r = await env.DB.batch([
      q("SELECT COUNT(*) AS n FROM users"),
      q("SELECT COUNT(*) AS n FROM users WHERE created_at > ?", now - 7 * DAY),
      q("SELECT COUNT(*) AS n FROM docs WHERE kind != 'profile'"),
      q("SELECT COUNT(*) AS n FROM ai_queries WHERE created_at > ?", now - DAY),
      q("SELECT COUNT(*) AS n FROM ai_queries WHERE created_at > ?", now - 7 * DAY),
      q("SELECT COUNT(*) AS n FROM requests WHERE status = 'new'"),
      q("SELECT COUNT(*) AS n FROM requests"),
      q("SELECT uid, name, email, role, work, news, created_at, last_seen, (SELECT COUNT(*) FROM docs d WHERE d.uid = users.uid AND d.kind != 'profile') AS saves FROM users ORDER BY created_at DESC LIMIT 500"),
      q("SELECT id, uid, name, email, company, decision, stage, timeline, status, created_at FROM requests ORDER BY created_at DESC LIMIT 300"),
      q("SELECT a.id, a.uid, a.tool, a.summary, a.ok, a.error, a.model, a.ms, a.created_at, u.name AS user_name FROM ai_queries a LEFT JOIN users u ON u.uid = a.uid ORDER BY a.created_at DESC LIMIT 300"),
      q("SELECT date(created_at / 1000, 'unixepoch') AS day, type, detail, COUNT(*) AS n FROM events WHERE created_at > ? GROUP BY day, type, detail ORDER BY day", now - 30 * DAY),
      q("SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS n FROM ai_queries WHERE created_at > ? GROUP BY day ORDER BY day", now - 30 * DAY),
      q("SELECT COUNT(DISTINCT uid) AS n FROM events WHERE created_at > ?", now - 7 * DAY),
    ]);
    const n = (i) => r[i].results[0].n;
    return json({
      totals: { users: n(0), usersNew7: n(1), saves: n(2), aiToday: n(3), ai7: n(4), requestsNew: n(5), requests: n(6), visitors7: n(12) },
      users: r[7].results,
      requests: r[8].results,
      ai: r[9].results,
      events: r[10].results,
      aiByDay: r[11].results,
      setup: { ai: !!env.GEMINI_API_KEY },
    });
  }
  if (part === "ai" && request.method === "GET") {
    const id = +url.searchParams.get("id");
    const row = await env.DB.prepare("SELECT prompt, response FROM ai_queries WHERE id = ?").bind(id).first();
    return json(row || {});
  }
  if (part === "request" && request.method === "POST") {
    const b = await readBody(request);
    if (!b || !["new", "replied", "done"].includes(b.status)) return fail(400, "bad_request");
    await env.DB.prepare("UPDATE requests SET status = ? WHERE id = ?").bind(b.status, +b.id).run();
    return json({ ok: true });
  }
  if (part === "forget" && request.method === "POST") {
    // delete everything held about a person (their right to erasure)
    const b = await readBody(request);
    const email = b && typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    if (!email) return fail(400, "bad_request");
    const uids = (await env.DB.prepare("SELECT uid FROM users WHERE lower(email) = ?").bind(email).all()).results.map((x) => x.uid);
    const reqUids = (await env.DB.prepare("SELECT DISTINCT uid FROM requests WHERE lower(email) = ?").bind(email).all()).results.map((x) => x.uid);
    const all = [...new Set([...uids, ...reqUids].filter(Boolean))];
    const stmts = [env.DB.prepare("DELETE FROM requests WHERE lower(email) = ?").bind(email)];
    for (const u of all) {
      stmts.push(env.DB.prepare("DELETE FROM users WHERE uid = ?").bind(u));
      stmts.push(env.DB.prepare("DELETE FROM docs WHERE uid = ?").bind(u));
      stmts.push(env.DB.prepare("DELETE FROM requests WHERE uid = ?").bind(u));
      stmts.push(env.DB.prepare("DELETE FROM ai_queries WHERE uid = ?").bind(u));
      stmts.push(env.DB.prepare("DELETE FROM events WHERE uid = ?").bind(u));
    }
    await env.DB.batch(stmts);
    return json({ ok: true, people: all.length });
  }
  return fail(404, "not_found");
}


/* ---------- M&A Due Diligence Analyst: research and document reading ---------- */
// Prompts live here (not in the website), so the back door only runs these fixed jobs.
const MA_METRIC_KEYS = "revenue, cogs, grossProfit, ebitda, adjEbitda, ebit, netIncome, interest, tax, ocf, capex, cash, totalDebt, totalAssets, totalLiabilities, receivables, inventory, payables, headcount";
const MA_RULES = `Rules: Prefer primary sources (annual reports, audited accounts, regulatory filings, stock exchange announcements, investor relations pages, Companies House). Never invent numbers, sources, URLs or page numbers. Only give a URL you actually found. If something can't be found, leave it out and list it under "missing". Don't treat the company's marketing claims as verified facts. Return ONLY one JSON object inside a \`\`\`json code block, no other text.`;
function maTargetLine(t) {
  t = t || {};
  const bits = [t.name && `Company: ${t.name}`, t.website && `Website: ${t.website}`, t.ticker && `Ticker: ${t.ticker}`, t.country && `Country: ${t.country}`, t.industry && `Industry: ${t.industry}`, t.hq && `Headquarters: ${t.hq}`];
  return bits.filter(Boolean).map((x) => String(x).slice(0, 200)).join(". ");
}
const MA_TASKS = {
  profile: (t) => `Research this acquisition target using Google Search. ${maTargetLine(t)}.
Find: what it does, business model, products, where it operates, ownership, strategy, recent acquisitions or disposals, management, main risks, whether it is publicly listed, its reporting currency and financial year end, and the most useful financial documents that exist (latest annual report, earlier annual reports, interim results, earnings release, investor presentation, regulatory or registry filings).
JSON shape: {"is_public": true|false|null, "listing": "exchange and ticker or null", "overview": "", "business_model": "", "products": [""], "geography": "", "ownership": "", "strategy": "", "recent_deals": [""], "management": "", "key_risks": [""], "currency": "ISO code like GBP", "fiscal_year_end": "", "documents": [{"title": "", "publisher": "", "type": "annual report|interim report|earnings release|investor presentation|regulatory filing|registry filing|news|other", "date": "YYYY-MM-DD or YYYY", "period": "FY2024 or null", "url": ""}], "missing": [""]}
${MA_RULES}`,
  financials: (t) => `Find the reported financial results of this company for its last 3 financial years, using Google Search. ${maTargetLine(t)}.
Look for: ${MA_METRIC_KEYS}. Give values exactly as reported, in the unit stated in the source. Do not calculate ratios or fill gaps. Mark adjusted EBITDA separately from reported EBITDA. If only press estimates exist (for example for a private company), include them with source_type "news".
JSON shape: {"currency": "GBP", "facts": [{"metric": "one of the names above", "period": "FY2024", "value": 123.4, "unit": "units|thousands|millions|billions", "currency": "GBP", "source_title": "", "source_url": "", "source_type": "annual report|interim report|earnings release|regulatory filing|registry filing|investor presentation|news|data provider|other", "note": ""}], "periods_covered": ["FY2024"], "missing": [""], "notes": ""}
${MA_RULES}`,
  debt: (t) => `Research the debt, cash and financing position of this company using Google Search. ${maTargetLine(t)}.
Find the latest reported total debt, cash, interest expense, debt maturities, refinancing, covenants and credit ratings.
JSON shape: {"facts": [{"metric": "totalDebt|cash|interest", "period": "FY2024", "value": 1.0, "unit": "units|thousands|millions|billions", "currency": "GBP", "source_title": "", "source_url": "", "source_type": "", "note": ""}], "debt_notes": [{"text": "", "source_title": "", "source_url": ""}], "missing": [""]}
${MA_RULES}`,
  market: (t) => `Research the market this company competes in using Google Search. ${maTargetLine(t)}.
Find the market size and growth for the company's main market (state the geography and definition; don't present a global figure as a national one), the main competitors, trends, regulation, opportunities and threats.
JSON shape: {"market_definition": "", "geography": "", "market_size": [{"value": 1.0, "unit": "millions|billions", "currency": "GBP", "year": "2025", "scope": "", "definition": "", "source_title": "", "source_url": "", "date": ""}], "growth_pct": 4.5, "growth_source_title": "", "growth_source_url": "", "competitors": [{"name": "", "note": ""}], "trends": [""], "regulation": [""], "opportunities": [""], "threats": [""], "summary": ""}
Write growth_pct as a number out of 100 (4.5 means 4.5% a year), or null if no credible figure exists.
${MA_RULES}`,
  news: (t) => `Find recent material developments and risks for this company using Google Search (last 2 years). ${maTargetLine(t)}.
JSON shape: {"developments": [{"date": "", "headline": "", "why_it_matters": "", "source_title": "", "source_url": ""}], "material_risks": [{"risk": "", "area": "financial|earnings|liquidity|leverage|commercial|customers|suppliers|regulatory|operations|technology|fit", "evidence": "", "source_title": "", "source_url": ""}], "missing": [""]}
${MA_RULES}`,
};
const MA_EXTRACT = (t) => `You are reading a document for an M&A due diligence review. ${maTargetLine(t)}.
1. Identify the document: title, publisher, type, date, reporting period, currency and the unit figures are presented in.
2. Extract figures for up to the 3 most recent financial years, for these metrics: ${MA_METRIC_KEYS}. Copy figures exactly as printed, with the page number where each appears (the PDF page number counting from 1). Keep reported and adjusted EBITDA separate. Show costs and capital expenditure as positive numbers. Do not calculate anything or fill gaps.
3. Note important qualitative facts with page numbers: customer concentration, segments, geography, debt maturities, guidance, risks, one-off items, accounting changes.
JSON shape: {"document": {"title": "", "publisher": "", "type": "annual report|interim report|earnings release|investor presentation|management accounts|financial model|other", "date": "", "period": "", "currency": "GBP", "unit": "units|thousands|millions|billions"}, "facts": [{"metric": "", "period": "FY2024", "value": 1.0, "unit": "units|thousands|millions|billions", "adjusted": false, "page": 12, "label_in_document": ""}], "qualitative": [{"topic": "", "text": "", "page": 12}], "notes": ""}
Never invent figures or page numbers. If a figure isn't in the document, leave it out.`;

function looseJson(text) {
  let t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}
async function geminiRequest(env, model, payload, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw Object.assign(new Error(e.name === "AbortError" ? "Gemini took too long" : e.message), { status: 504 });
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body.error && body.error.message) || "Gemini error " + res.status), { status: res.status });
  const cand = (body.candidates && body.candidates[0]) || {};
  const text = ((cand.content && cand.content.parts) || []).map((p) => p.text || "").join("").trim();
  if (!text) throw Object.assign(new Error("Gemini returned an empty answer (" + (cand.finishReason || "no reason") + ")"), { status: 502 });
  return { text, cand };
}
const domainOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

async function handleMA(request, env, part) {
  if (request.method !== "POST") return fail(405, "method");
  if (!sameOrigin(request)) return fail(403, "origin");
  if (!env.GEMINI_API_KEY) return fail(503, "not_configured", "AI isn't switched on yet.");
  const b = await readBody(request);
  if (!b || !validUid(b.uid)) return fail(400, "bad_request");
  const prof = await env.DB.prepare("SELECT name FROM users WHERE uid = ?").bind(b.uid).first();
  if (!prof) return fail(401, "profile_needed", "Please create your free profile first.");
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = (await sha256("bbc|" + ip)).slice(0, 24);
  const now = Date.now();
  const counts = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n FROM ai_queries WHERE tool = 'ma' AND (summary LIKE 'research:%' OR summary LIKE 'extract:%') AND (ip_hash = ? OR uid = ?) AND created_at > ?").bind(ipHash, b.uid, now - DAY),
    env.DB.prepare("SELECT COUNT(*) AS n FROM ai_queries WHERE tool = 'ma' AND summary LIKE 'research:%' AND created_at > ?").bind(now - DAY),
  ]);
  if (counts[0].results[0].n >= (+env.MA_DAILY_LIMIT || 15)) return fail(429, "rate_limited", "You've used today's research allowance. It resets within 24 hours. You can still type or upload figures yourself.");
  const target = b.target && typeof b.target === "object" ? b.target : {};
  if (!target.name || String(target.name).trim().length < 2) return fail(400, "bad_request", "Add the company name first.");

  let summary, payload, model, timeout = 60000, research = false;
  if (part === "research") {
    const task = MA_TASKS[b.task];
    if (!task) return fail(400, "bad_request");
    if (counts[1].results[0].n >= (+env.MA_GLOBAL_DAILY_LIMIT || 450)) return fail(429, "rate_limited", "Online research is very busy today. Please try again tomorrow, or upload documents instead.");
    research = true;
    summary = `research:${b.task} ${String(target.name).slice(0, 80)}`;
    payload = { contents: [{ role: "user", parts: [{ text: task(target) }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2 } };
  } else if (part === "extract") {
    const name = String(b.filename || "document").slice(0, 120);
    summary = `extract:${name}`;
    model = env.MA_EXTRACT_MODEL || "gemini-2.5-flash";
    timeout = 120000;
    const parts = [];
    if (b.pdf) {
      if (typeof b.pdf !== "string" || b.pdf.length > 26000000) return fail(413, "too_big", "This PDF is too large (over about 19 MB). Upload just the financial statements pages, or a smaller file.");
      parts.push({ inline_data: { mime_type: "application/pdf", data: b.pdf } });
    } else if (typeof b.text === "string" && b.text.trim()) {
      parts.push({ text: `Document "${name}" (converted from a spreadsheet or text file; page numbers are sheet names or row numbers):\n\n${b.text.slice(0, 400000)}` });
    } else return fail(400, "bad_request", "The file was empty.");
    parts.push({ text: MA_EXTRACT(target) });
    payload = { contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } };
  } else return fail(404, "not_found");

  const t0 = Date.now();
  let out = null, err = null, noSearch = false;
  const errs = [];
  const list = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
  // Try models in order. Research first tries models with live Google Search; if none of them can search
  // on this plan, it falls back to the AI's general knowledge and says so.
  const attempts = research
    ? list(env.MA_RESEARCH_MODELS || "gemini-2.5-flash-lite,gemini-3.8-flash,gemini-3.5-flash,gemini-3.6-flash").map((m) => [m, true]).concat([[env.MA_FALLBACK_MODEL || "gemini-3.5-flash", false]])
    : list(env.MA_EXTRACT_MODELS || "gemini-3.5-flash,gemini-3.8-flash,gemini-3.1-flash-lite").map((m) => [m, false]);
  let searchBlocked = false;
  for (const [m, search] of attempts) {
    if (search && searchBlocked) continue;
    const left = (research ? 100000 : 150000) - (Date.now() - t0);
    if (left < 8000) break;
    model = m;
    let body = payload;
    if (research && !search) {
      // No live search on this plan: ask for the model's own knowledge, honestly labelled
      const txt = MA_TASKS[b.task](target).replace(/,? ?using Google Search/gi, "").replace(/Use Google Search\.?/gi, "")
        + `\nIMPORTANT: You do not have internet access for this request. Answer only from your own training knowledge, which may be out of date. Say which financial year each figure relates to. Only include a URL if it is the company's well-known official website or investor relations page; otherwise leave URLs empty. Use source_type "other" and source_title "AI general knowledge" for every figure. If you are not confident about a figure, leave it out.`;
      body = { contents: [{ role: "user", parts: [{ text: txt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 8192 } };
    }
    try {
      out = await geminiRequest(env, m, body, Math.min(research ? 60000 : 120000, left));
      out.data = looseJson(out.text);
      err = null;
      noSearch = research && !search;
      break;
    } catch (e) {
      errs.push(`${m}${search ? "+search" : ""} [${e.status || "?"}]: ${String(e.message).slice(0, 400)}`);
      err = e;
      out = null;
      // the free plan refuses Google Search with a quota error: stop trying other search models
      if (search && (e.status === 429 || /quota|billing|not supported|grounding|search/i.test(e.message))) searchBlocked = true;
      if (!search && e.status === 429) await new Promise((r) => setTimeout(r, 2500));
      if (e.status === 504) break; // too slow: don't keep the visitor waiting for more attempts
    }
  }
  if (err && errs.length) err.message = errs.join(" | ");
  await env.DB.prepare("INSERT INTO ai_queries (uid, ip_hash, tool, summary, prompt, response, ok, error, model, ms, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(b.uid, ipHash, "ma", summary, clip(part === "research" ? MA_TASKS[b.task](target) : summary, 6000), out ? clip(out.text, 6000) : clip(errs.join("\n"), 6000), out ? 1 : 0, err ? clip(err.message, 300) : errs.length ? clip("Earlier attempts: " + errs.join(" | "), 300) : null, model, Date.now() - t0, now)
    .run();
  await env.DB.prepare("UPDATE users SET last_seen = ? WHERE uid = ?").bind(now, b.uid).run();
  if (!out) {
    if (err && err.status === 429) return fail(429, "rate_limited", "The AI is busy right now. Try again in a minute.");
    if (err && err.status === 504) return fail(504, "timeout", "This took too long. Try again, or try a smaller file.");
    return fail(502, "ai_failed", research ? "The research couldn't be completed this time. Try again." : "The document couldn't be read this time. Try again, or try a different file.");
  }
  let sources = [];
  if (research) {
    // The search results Gemini actually used: the only sources we call "found by search"
    const chunks = (out.cand.groundingMetadata && out.cand.groundingMetadata.groundingChunks) || [];
    sources = chunks.filter((c) => c.web && c.web.uri).map((c) => ({ uri: c.web.uri, title: c.web.title || domainOf(c.web.uri) }));
    const seen = new Set(sources.map((s) => (s.title || "").toLowerCase().replace(/^www\./, "")));
    // mark every source the model named: was its website among the real search results?
    const mark = (o) => { if (o && o.source_url) o.in_search_results = seen.has(domainOf(o.source_url)); return o; };
    ["facts", "documents", "market_size", "developments", "material_risks", "debt_notes"].forEach((k) => { if (Array.isArray(out.data[k])) out.data[k].forEach(mark); });
    if (out.data.growth_source_url) out.data.growth_in_search_results = seen.has(domainOf(out.data.growth_source_url));
  }
  return json({ data: out.data, sources, model, noSearch });
}

/* ---------- router ---------- */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  try {
    if (parts[0] === "health") {
      let db = false;
      if (env.DB) {
        try {
          await ensureSchema(env);
          db = true;
        } catch {}
      }
      const out = { ok: true, db, ai: !!env.GEMINI_API_KEY, admin: !!env.ADMIN_PASSWORD };
      if (url.searchParams.get("models") === "1" && env.GEMINI_API_KEY) {
        // which Gemini models this key can use (names only, nothing secret)
        try {
          const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": env.GEMINI_API_KEY } });
          const j = await r.json();
          out.models = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => m.name.replace("models/", ""));
        } catch (e) {
          out.models = "error: " + e.message;
        }
      }
      return json(out);
    }
    if (!env.DB) return fail(503, "not_configured", "The database isn't connected yet.");
    await ensureSchema(env);
    switch (parts[0]) {
      case "ai":
        return await handleAI(request, env);
      case "docs":
        return await handleDocs(request, env, url);
      case "doc":
        return await handleDoc(request, env, url);
      case "event":
        return await handleEvent(request, env);
      case "ma":
        return await handleMA(request, env, parts[1]);
      case "admin":
        return await handleAdmin(request, env, url, parts[1]);
      default:
        return fail(404, "not_found");
    }
  } catch (e) {
    return fail(500, "server_error", "Something went wrong on our side. Please try again.");
  }
}
