// Meri Assistant - Cloudflare Worker (koi npm package nahi chahiye, ek hi file)
// Bindings: KV (KV namespace), GEMINI_API_KEY (secret), APP_KEY (secret). Optional: GEMINI_MODEL
// Cron trigger: har 10 minute ("*/10 * * * *")

const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const enc = new TextEncoder();
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,x-app-key",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...CORS } });

const b64u = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const ub64 = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };

// ---------- state (KV) ----------
async function load(env) {
  const raw = await env.KV.get("state");
  const st = raw ? JSON.parse(raw) : {};
  return { tasks: [], memory: [], subs: [], off: 300, digestHour: 8, lastDigest: "", vapid: null, ...st };
}
const save = (env, st) => env.KV.put("state", JSON.stringify(st));

async function ensureVapid(st) {
  if (st.vapid) return false;
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  st.vapid = { pub: b64u(await crypto.subtle.exportKey("raw", k.publicKey)), priv: await crypto.subtle.exportKey("jwk", k.privateKey) };
  return true;
}

// ---------- web push (RFC 8291 + VAPID) ----------
async function encrypt(sub, payload) {
  const ua = ub64(sub.keys.p256dh), auth = ub64(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256);
  const hk = async (salt, ikm, info, len) => {
    const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
  };
  const ikm = await hk(auth, secret, concat(enc.encode("WebPush: info\0"), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hk(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hk(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(enc.encode(payload), new Uint8Array([2]))));
  const hdr = new Uint8Array(21); hdr.set(salt); new DataView(hdr.buffer).setUint32(16, 4096); hdr[20] = 65;
  return concat(hdr, asPub, ct);
}

async function vapidHeader(st, endpoint) {
  const aud = new URL(endpoint).origin;
  const h = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const c = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:assistant@example.com" })));
  const key = await crypto.subtle.importKey("jwk", st.vapid.priv, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(h + "." + c));
  return `vapid t=${h}.${c}.${b64u(sig)}, k=${st.vapid.pub}`;
}

async function push(st, sub, msg) {
  const body = await encrypt(sub, JSON.stringify(msg));
  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: { Authorization: await vapidHeader(st, sub.endpoint), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "high" },
    body,
  });
  return r.status;
}

async function pushAll(st, msg) {
  let n = 0;
  const keep = [];
  for (const s of st.subs) {
    let code = 0;
    try { code = await push(st, s, msg); } catch (e) { code = 0; }
    if (code === 404 || code === 410) continue; // subscription khatam
    keep.push(s);
    if (code >= 200 && code < 300) n++;
  }
  st.subs = keep;
  return n;
}

// ---------- tasks & reminders ----------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const localAt = (y, m, d, h, mi, off) => Date.UTC(y, m - 1, d, h, mi) - off * 60000;
const localDate = (ms, off) => new Date(ms + off * 60000).toISOString().slice(0, 10);

function remindersOf(t, off) {
  const [y, m, d] = t.date.split("-").map(Number);
  const out = [{ k: "eve", at: localAt(y, m, d - 1, 18, 0, off), text: `Kal: ${t.title}${t.time ? " (" + t.time + ")" : ""}` }];
  if (t.time) {
    const [h, mi] = t.time.split(":").map(Number);
    const due = localAt(y, m, d, h, mi, off);
    out.push({ k: "hr", at: due - 3600000, text: `1 ghante mein: ${t.title} (${t.time})` });
    out.push({ k: "now", at: due, text: `Abhi: ${t.title}` });
  }
  return out;
}

function addTask(st, o, now) {
  const title = String(o.title || "").trim().slice(0, 200);
  const date = String(o.date || "").trim();
  if (!title || !DATE_RE.test(date) || isNaN(Date.parse(date))) return null;
  const time = TIME_RE.test(String(o.time || "")) ? o.time : "";
  const t = { id: crypto.randomUUID().slice(0, 8), title, date, time, done: false, sent: [] };
  t.sent = remindersOf(t, st.off).filter((r) => r.at < now).map((r) => r.k); // jo waqt guzar chuka, dobara na bheje
  st.tasks.push(t);
  return t;
}

async function tick(env, now = Date.now()) {
  const st = await load(env);
  if (!st.vapid || !st.subs.length) return { sent: 0 };
  let sent = 0, dirty = false;
  for (const t of st.tasks) {
    if (t.done) continue;
    for (const r of remindersOf(t, st.off)) {
      if (t.sent.includes(r.k) || r.at > now) continue;
      t.sent.push(r.k); dirty = true;
      if (now - r.at > 12 * 3600000) continue; // bohat purana, chhor do
      const n = await pushAll(st, { title: "Meri Assistant", body: r.text, tag: t.id + r.k });
      sent += n > 0 ? 1 : 0;
    }
  }
  // subah ka digest
  const loc = new Date(now + st.off * 60000), today = loc.toISOString().slice(0, 10);
  if (st.lastDigest !== today && loc.getUTCHours() >= st.digestHour) {
    st.lastDigest = today; dirty = true;
    const todays = st.tasks.filter((t) => !t.done && t.date === today);
    const late = st.tasks.filter((t) => !t.done && t.date < today);
    if (todays.length || late.length) {
      const lines = todays.map((t) => "• " + (t.time ? t.time + " " : "") + t.title);
      if (late.length) lines.push(`⚠ ${late.length} kaam guzar chuke hain`);
      const n = await pushAll(st, { title: todays.length ? "Aaj khas din hai" : "Purane kaam baqi hain", body: lines.join("\n"), tag: "digest" + today });
      sent += n > 0 ? 1 : 0;
    }
  }
  // purane mukammal kaam saaf (30 din)
  const cut = localDate(now - 30 * 86400000, st.off);
  const before = st.tasks.length;
  st.tasks = st.tasks.filter((t) => !(t.done && t.date < cut));
  if (st.tasks.length !== before) dirty = true;
  if (dirty) await save(env, st);
  return { sent };
}

// ---------- AI ----------
const SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    tasks: { type: "ARRAY", items: { type: "OBJECT", properties: { title: { type: "STRING" }, date: { type: "STRING" }, time: { type: "STRING" } }, required: ["title", "date"] } },
    memories: { type: "ARRAY", items: { type: "STRING" } },
    complete_ids: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["reply"],
};

function systemPrompt(st, now) {
  const loc = new Date(now + st.off * 60000);
  const days = ["Itwaar", "Peer", "Mangal", "Budh", "Jumeraat", "Jumma", "Hafta"];
  const when = `${loc.toISOString().slice(0, 10)} ${loc.toISOString().slice(11, 16)} (${days[loc.getUTCDay()]})`;
  const pend = st.tasks.filter((t) => !t.done).map((t) => `- [${t.id}] ${t.date}${t.time ? " " + t.time : ""} ${t.title}`).join("\n") || "(koi nahi)";
  const mem = st.memory.map((m) => "- " + m).join("\n") || "(abhi kuch nahi)";
  return `Tum "Meri Assistant" ho, ek zaheen, meherban personal assistant jo ek Pakistani larki/aurat ke liye kaam karti hai.
Abhi ka waqt (user ka local): ${when}.
Jis zubaan mein user likhe usi mein jawab do. Roman Urdu mein likhe to Roman Urdu mein, English mein likhe to English mein. Jawab chhote, saaf aur madadgar rakho.
Jab user assignment, essay, email, message ya koi aur likhne wala kaam maange to poora, mukammal aur achha likha hua jawab "reply" mein do.
Agar user koi kaam, deadline, appointment ya reminder bataye to "tasks" mein daalo. "date" hamesha YYYY-MM-DD ho (aaj ke hisab se "kal", "jumma" wagaira hal karo), "time" sirf tab do jab user ne waqt bataya ho (HH:MM, 24 ghante). Reply mein bhi ek line mein tasdeeq do.
Agar user apne baare mein koi aham baat bataye jo yaad rakhni chahiye (naam, pasand, rishte, ahem tareekhein, aadatein) to chhote jumle mein "memories" mein daalo. Purani memory dobara na daalo.
Agar user bataye ke koi kaam ho gaya to uski id "complete_ids" mein do.
Jo kaam tum nahi kar sakti (WhatsApp ya calls dekhna, kisi ko message bhejna) un ke baare mein jhoot na bolo.
Hamesha sirf JSON do: {"reply": "...", "tasks": [{"title","date","time"}], "memories": ["..."], "complete_ids": ["..."]}. tasks/memories/complete_ids khali ho to khali list do.

Yaad rakhi hui baatein:
${mem}

Baqi kaam:
${pend}`;
}

async function askGemini(env, sys, contents) {
  const models = env.GEMINI_MODEL ? [env.GEMINI_MODEL] : MODELS;
  let last = "";
  for (const m of models) {
    for (const useSchema of [true, false]) {
      const gc = { responseMimeType: "application/json", maxOutputTokens: 8192, temperature: 0.7 };
      if (useSchema) gc.responseSchema = SCHEMA;
      let r;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: gc }),
          signal: AbortSignal.timeout(22000),
        });
      } catch (e) { last = `${m}: der lag gayi ya network masla`; break; }
      if (r.ok) {
        const j = await r.json();
        const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
        if (text) return text;
        last = "AI ne khali jawab diya";
        break;
      }
      last = `${m}: ${r.status} ${(await r.text()).slice(0, 200)}`;
      if (r.status !== 400) break; // 400 par bina schema dobara koshish, baqi par agla model
    }
  }
  throw new Error(last || "AI jawab nahi de saka");
}

async function chat(env, st, body, now) {
  const hist = (Array.isArray(body.history) ? body.history : []).slice(-24)
    .map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: String(m.text || "").slice(0, 6000) }] }))
    .filter((m) => m.parts[0].text);
  if (!hist.length || hist[hist.length - 1].role !== "user") throw new Error("Message khali hai");
  const text = await askGemini(env, systemPrompt(st, now), hist);
  let out;
  try { out = JSON.parse(text); } catch (e) { out = { reply: text }; }
  const added = [], remembered = [], completed = [];
  for (const t of Array.isArray(out.tasks) ? out.tasks : []) { const x = addTask(st, t, now); if (x) added.push(x); }
  for (let m of Array.isArray(out.memories) ? out.memories : []) {
    m = String(m).trim().slice(0, 300);
    if (m && !st.memory.includes(m) && st.memory.length < 80) { st.memory.push(m); remembered.push(m); }
  }
  for (const id of Array.isArray(out.complete_ids) ? out.complete_ids : []) {
    const t = st.tasks.find((x) => x.id === id);
    if (t && !t.done) { t.done = true; completed.push(id); }
  }
  return { reply: String(out.reply || "").trim() || "…", added, remembered, completed };
}

// ---------- routes ----------
const eq = (a, b) => { a = enc.encode(a || ""); b = enc.encode(b || ""); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };
const view = (st) => ({ tasks: st.tasks, memory: st.memory, subs: st.subs.length, vapid: st.vapid.pub, dh: st.digestHour });

async function handle(req, env) {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (url.pathname === "/" ) return new Response("Meri Assistant chal rahi hai ✓", { headers: CORS });
  if (!env.KV) return json({ error: "KV namespace bind nahi hua (Settings > Bindings, naam: KV)" }, 500);
  if (!env.APP_KEY || !eq(req.headers.get("x-app-key"), env.APP_KEY)) return json({ error: "Galat ya missing app key" }, 401);
  const st = await load(env);
  const fresh = await ensureVapid(st);
  const now = Date.now();
  let b = {};
  if (req.method === "POST") { try { b = await req.json(); } catch (e) { b = {}; } }
  if (Number.isFinite(b.tzOffset) && Math.abs(b.tzOffset) <= 840) st.off = Math.round(b.tzOffset);
  const done = async (o) => { await save(env, st); return json(o); };
  const p = url.pathname;

  if (p === "/api/state") { if (fresh) await save(env, st); return json({ ...view(st), now }); }
  if (p === "/api/chat") {
    if (!env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY set nahi hai" }, 500);
    try { const r = await chat(env, st, b, now); return done({ ...r, ...view(st) }); }
    catch (e) { return json({ error: String(e.message || e) }, 502); }
  }
  if (p === "/api/subscribe") {
    const s = b.sub;
    if (!s || !s.endpoint || !s.keys?.p256dh || !s.keys?.auth) return json({ error: "Subscription theek nahi" }, 400);
    st.subs = st.subs.filter((x) => x.endpoint !== s.endpoint).concat([{ endpoint: s.endpoint, keys: s.keys }]).slice(-5);
    return done(view(st));
  }
  if (p === "/api/test-push") {
    const n = await pushAll(st, { title: "Meri Assistant", body: "Test kamyab ✓ Alert aise aayenge.", tag: "test" });
    await save(env, st);
    return json({ sent: n, subs: st.subs.length });
  }
  if (p === "/api/task") {
    const t = addTask(st, b, now);
    if (!t) return json({ error: "Kaam ya tareekh theek nahi" }, 400);
    return done({ task: t, ...view(st) });
  }
  if (p === "/api/task/update") {
    const i = st.tasks.findIndex((t) => t.id === b.id);
    if (i < 0) return json({ error: "Kaam nahi mila" }, 404);
    if (b.remove) st.tasks.splice(i, 1); else st.tasks[i].done = !!b.done;
    return done(view(st));
  }
  if (p === "/api/memory") {
    if (typeof b.add === "string" && b.add.trim()) { const m = b.add.trim().slice(0, 300); if (!st.memory.includes(m) && st.memory.length < 80) st.memory.push(m); }
    if (Number.isInteger(b.remove) && b.remove >= 0 && b.remove < st.memory.length) st.memory.splice(b.remove, 1);
    return done(view(st));
  }
  if (p === "/api/settings") {
    if (Number.isInteger(b.digestHour) && b.digestHour >= 0 && b.digestHour <= 23) st.digestHour = b.digestHour;
    return done({ ...view(st), digestHour: st.digestHour });
  }
  return json({ error: "Rasta nahi mila" }, 404);
}

export default {
  async fetch(req, env) {
    try { return await handle(req, env); } catch (e) { return json({ error: "Server masla: " + (e.message || e) }, 500); }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(tick(env)); },
  _tick: tick,
};
