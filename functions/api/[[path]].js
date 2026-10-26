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
    ? list(env.GEMINI_MODELS_QUICK || "gemini-3.1-flash-lite,gemini-2.5-flash-lite,gemini-flash-lite-latest")
    : list(env.GEMINI_MODELS || "gemini-3.5-flash,gemini-2.5-flash,gemini-3.1-flash-lite");
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
      case "admin":
        return await handleAdmin(request, env, url, parts[1]);
      default:
        return fail(404, "not_found");
    }
  } catch (e) {
    return fail(500, "server_error", "Something went wrong on our side. Please try again.");
  }
}
