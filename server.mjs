import http from "node:http";
import path from "node:path";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  applyDecay,
  applyFeedbackLearning,
  buildFingerprint,
  createServedQuoteRegistry,
  createUserModel,
  normalizeText as rankNormalizeText,
  pickTopCandidate,
  scoreCandidate
} from "./app/ranking-core.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadDotEnv(dotEnvPath) {
  if (!existsSync(dotEnvPath)) return;

  const content = readFileSync(dotEnvPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue;

    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const NKRY_API_BASE_URL = process.env.NKRY_API_BASE_URL || "https://ruscorpora.ru/api/v1/";
const NKRY_SEARCH_PATH = process.env.NKRY_SEARCH_PATH || "lex-gramm/concordance";
const NKRY_API_KEY = process.env.NKRY_API_KEY || "";
const NKRY_API_KEY_HEADER = process.env.NKRY_API_KEY_HEADER || "Authorization";
const NKRY_API_AUTH_PREFIX = process.env.NKRY_API_AUTH_PREFIX || "Bearer";
const NKRY_CORPUS_TYPE = process.env.NKRY_CORPUS_TYPE || "CLASSICS";
const MAX_REQUEST_BODY_BYTES = Number(process.env.MAX_REQUEST_BODY_BYTES || 32 * 1024);
const NKRY_FETCH_TIMEOUT_MS = Number(process.env.NKRY_FETCH_TIMEOUT_MS || 8000);
const NKRY_FETCH_RETRIES = Number(process.env.NKRY_FETCH_RETRIES || 3);
const NKRY_FETCH_BACKOFF_MS = Number(process.env.NKRY_FETCH_BACKOFF_MS || 240);
const FEEDBACK_STORE_PATH = process.env.FEEDBACK_STORE_PATH || path.join(__dirname, "tools", "ranking_feedback_store.json");
const APP_VERSION = process.env.APP_VERSION || "local";
const BOOT_AT = Date.now();
const RECENT_QUERIES_MAX = Number(process.env.RECENT_QUERIES_MAX || 3000);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_FEEDBACK_PER_WINDOW = Number(process.env.RATE_LIMIT_FEEDBACK_PER_WINDOW || 40);
const RATE_LIMIT_METRICS_PER_WINDOW = Number(process.env.RATE_LIMIT_METRICS_PER_WINDOW || 90);
const FEEDBACK_API_TOKEN = process.env.FEEDBACK_API_TOKEN || "";
const METRICS_API_TOKEN = process.env.METRICS_API_TOKEN || "";
const NKRY_MOCK_MODE = process.env.NKRY_MOCK_MODE === "1";
const SERVED_QUOTE_TTL_MS = Number(process.env.SERVED_QUOTE_TTL_MS || 10 * 60 * 1000);
const SERVED_QUOTE_MAX = Number(process.env.SERVED_QUOTE_MAX || 8000);
const FEEDBACK_USERS_MAX = Number(process.env.FEEDBACK_USERS_MAX || 5000);
const FEEDBACK_USERS_PRUNE_BATCH = Number(process.env.FEEDBACK_USERS_PRUNE_BATCH || 200);
const SLO_WINDOW_MS = Number(process.env.SLO_WINDOW_MS || 15 * 60 * 1000);
const SLO_SUCCESS_RATE_MIN = Number(process.env.SLO_SUCCESS_RATE_MIN || 0.85);
const SLO_NO_RESULT_RATE_MAX = Number(process.env.SLO_NO_RESULT_RATE_MAX || 0.25);
const SLO_SEARCH_ERROR_RATE_MAX = Number(process.env.SLO_SEARCH_ERROR_RATE_MAX || 0.05);
const NKRY_CIRCUIT_FAILURE_THRESHOLD = Number(process.env.NKRY_CIRCUIT_FAILURE_THRESHOLD || 4);
const NKRY_CIRCUIT_OPEN_MS = Number(process.env.NKRY_CIRCUIT_OPEN_MS || 90_000);
const LOCAL_FALLBACK_POOL_MAX = Number(process.env.LOCAL_FALLBACK_POOL_MAX || 1200);
const RECENT_GOOD_POOL_MAX = Number(process.env.RECENT_GOOD_POOL_MAX || 220);
const POEMS_LOCAL_PATH = process.env.POEMS_LOCAL_PATH || path.join(__dirname, "poems.local.json");
const MATCH_EXPLORATION_EPSILON = Number(process.env.MATCH_EXPLORATION_EPSILON || 0.05);
const MATCH_EXPLORATION_TOP_K = Number(process.env.MATCH_EXPLORATION_TOP_K || 6);
const ENABLE_LOCAL_FALLBACK = process.env.ENABLE_LOCAL_FALLBACK === "1";

const DEFAULT_FEEDBACK_STORE = {
  version: 2,
  updatedAt: "",
  globalModel: createUserModel(),
  users: {}
};

function sanitizeUserModel(raw) {
  const base = createUserModel();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    weights: { ...base.weights, ...(raw.weights || {}) },
    byAuthor: raw.byAuthor && typeof raw.byAuthor === "object" ? raw.byAuthor : {},
    byFingerprint: raw.byFingerprint && typeof raw.byFingerprint === "object" ? raw.byFingerprint : {},
    byReason: { ...base.byReason, ...(raw.byReason || {}) },
    recentFeedback: Array.isArray(raw.recentFeedback) ? raw.recentFeedback.slice(-500) : [],
    lastDecayAt: Number.isFinite(Number(raw.lastDecayAt)) ? Number(raw.lastDecayAt) : Date.now(),
    lastSeenAt: Number.isFinite(Number(raw.lastSeenAt)) ? Number(raw.lastSeenAt) : Date.now()
  };
}

function lineCountText(text) {
  return String(text || "")
    .split("\n")
    .filter((line) => line.trim().length > 0).length;
}

function loadLocalFallbackCorpus() {
  try {
    if (!existsSync(POEMS_LOCAL_PATH)) return [];
    const payload = JSON.parse(readFileSync(POEMS_LOCAL_PATH, "utf8"));
    if (!Array.isArray(payload)) return [];
    const out = [];
    for (const poem of payload) {
      if (!poem || typeof poem !== "object") continue;
      const text = String(poem.text || "").trim();
      const lc = lineCountText(text);
      if (lc < 3) continue;
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const quoteBase = lines.slice(0, Math.min(4, lines.length)).join(" ");
      if (!quoteBase) continue;
      const quote = quoteBase.length > 320 ? `${quoteBase.slice(0, 317)}...` : quoteBase;
      out.push({
        quote,
        author: String(poem.author || "Не указан"),
        title: String(poem.title || "Без названия"),
        year: String(poem.year || ""),
        sourceName: "Локальный каталог",
        hitCount: 1,
        matchedTerm: "fallback",
        docType: "поэзия",
        docTopic: Array.isArray(poem.tags) ? poem.tags.join(",") : "",
        docStyle: "художественный",
        docHeader: "",
        fallbackNorm: rankNormalizeText(`${quote} ${poem.author || ""} ${poem.title || ""}`)
      });
      if (out.length >= LOCAL_FALLBACK_POOL_MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

function loadFeedbackStore() {
  try {
    if (!existsSync(FEEDBACK_STORE_PATH)) return structuredClone(DEFAULT_FEEDBACK_STORE);
    const parsed = JSON.parse(readFileSync(FEEDBACK_STORE_PATH, "utf8"));
    if (parsed?.users && typeof parsed.users === "object") {
      const users = {};
      for (const [key, model] of Object.entries(parsed.users)) {
        users[key] = sanitizeUserModel(model);
      }
      return {
        ...structuredClone(DEFAULT_FEEDBACK_STORE),
        ...parsed,
        globalModel: sanitizeUserModel(parsed?.globalModel || {}),
        users
      };
    }

    // Backward compatibility with single global model format.
    if (parsed && typeof parsed === "object" && (parsed.weights || parsed.byAuthor || parsed.byFingerprint)) {
      return {
        ...structuredClone(DEFAULT_FEEDBACK_STORE),
        updatedAt: String(parsed.updatedAt || ""),
        globalModel: sanitizeUserModel(parsed),
        users: {
          legacy_global: sanitizeUserModel(parsed)
        }
      };
    }
    return structuredClone(DEFAULT_FEEDBACK_STORE);
  } catch {
    return structuredClone(DEFAULT_FEEDBACK_STORE);
  }
}

async function ensureFeedbackStoreBootstrapped(store) {
  try {
    if (existsSync(FEEDBACK_STORE_PATH)) return;
    await persistFeedbackStoreDurable(store);
    console.log(JSON.stringify({ type: "feedback_store_bootstrap", path: FEEDBACK_STORE_PATH }));
  } catch (error) {
    console.error(
      JSON.stringify({
        type: "feedback_store_bootstrap_error",
        path: FEEDBACK_STORE_PATH,
        message: error?.message || String(error)
      })
    );
  }
}

function persistFeedbackStore(store) {
  pruneFeedbackUsers(store);
  return persistFeedbackStoreDurable(store);
}

const feedbackStore = loadFeedbackStore();
const metrics = {
  searchRequests: 0,
  searchSuccess: 0,
  searchEmpty: 0,
  searchErrors: 0,
  repeatedQueries: 0,
  feedbackEvents: 0,
  searchLatencyTotalMs: 0,
  searchLatencySamples: 0,
  userModelsPruned: 0,
  feedbackPersistErrors: 0,
  circuitOpenEvents: 0,
  circuitFallbackResponses: 0,
  searchExploreServed: 0,
  searchExploitServed: 0,
  feedbackExploreEvents: 0,
  feedbackExploitEvents: 0,
  feedbackExploreRatingTotal: 0,
  feedbackExploitRatingTotal: 0
};
const recentQueries = new Map();
const rateBuckets = new Map();
const recentSearchEvents = [];
const feedbackPersistErrorEvents = [];
const localFallbackCorpus = ENABLE_LOCAL_FALLBACK ? loadLocalFallbackCorpus() : [];
const recentGoodPool = [];
const nkryCircuit = {
  consecutiveFailures: 0,
  openUntil: 0,
  lastFailureAt: 0,
  lastOpenedAt: 0,
  lastReason: ""
};
const servedQuoteRegistry = createServedQuoteRegistry({ ttlMs: SERVED_QUOTE_TTL_MS, maxSize: SERVED_QUOTE_MAX });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pushTimestamp(list, timestamp, windowMs = SLO_WINDOW_MS) {
  list.push(timestamp);
  const cutoff = timestamp - windowMs;
  while (list.length > 0 && list[0] < cutoff) list.shift();
}

function recordSearchEvent(kind, now = Date.now()) {
  recentSearchEvents.push({ ts: now, kind });
  const cutoff = now - SLO_WINDOW_MS;
  while (recentSearchEvents.length > 0 && recentSearchEvents[0].ts < cutoff) recentSearchEvents.shift();
}

function markSearchError() {
  metrics.searchErrors += 1;
  recordSearchEvent("error");
}

function markSearchEmpty() {
  metrics.searchEmpty += 1;
  recordSearchEvent("empty");
}

function markSearchSuccess() {
  metrics.searchSuccess += 1;
  recordSearchEvent("success");
}

function isNkryCircuitOpen(now = Date.now()) {
  return nkryCircuit.openUntil > now;
}

function markNkryFailure(reason = "") {
  const now = Date.now();
  nkryCircuit.consecutiveFailures += 1;
  nkryCircuit.lastFailureAt = now;
  nkryCircuit.lastReason = String(reason || "").slice(0, 240);
  if (nkryCircuit.consecutiveFailures >= NKRY_CIRCUIT_FAILURE_THRESHOLD) {
    nkryCircuit.openUntil = now + NKRY_CIRCUIT_OPEN_MS;
    nkryCircuit.lastOpenedAt = now;
    metrics.circuitOpenEvents += 1;
  }
}

function markNkrySuccess() {
  nkryCircuit.consecutiveFailures = 0;
  nkryCircuit.openUntil = 0;
  nkryCircuit.lastReason = "";
}

function addRecentGoodCandidates(candidates) {
  for (const item of candidates || []) {
    if (!item || !item.quote) continue;
    const key = rankNormalizeText(`${item.quote}__${item.title || ""}`);
    if (!key) continue;
    if (recentGoodPool.some((x) => x.key === key)) continue;
    recentGoodPool.push({
      key,
      quote: item.quote,
      author: item.author || "Не указан",
      title: item.title || "Без названия",
      year: item.year || "",
      sourceName: item.sourceName || "НКРЯ",
      hitCount: Number(item.hitCount || 1),
      matchedTerm: item.matchedTerm || "recent",
      docType: item.docType || "поэзия",
      docTopic: item.docTopic || "",
      docStyle: item.docStyle || "",
      docHeader: item.docHeader || "",
      fallbackNorm: rankNormalizeText(`${item.quote} ${item.author || ""} ${item.title || ""}`)
    });
  }
  if (recentGoodPool.length > RECENT_GOOD_POOL_MAX) {
    recentGoodPool.splice(0, recentGoodPool.length - RECENT_GOOD_POOL_MAX);
  }
}

async function persistFeedbackStoreDurable(store) {
  const payload = JSON.stringify(store, null, 2);
  const targetPath = FEEDBACK_STORE_PATH;
  const tmpPath = `${targetPath}.tmp`;
  try {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(tmpPath, payload, "utf8");
    await rename(tmpPath, targetPath);
  } catch (error) {
    metrics.feedbackPersistErrors += 1;
    pushTimestamp(feedbackPersistErrorEvents, Date.now());
    try {
      await writeFile(targetPath, payload, "utf8");
    } catch (fallbackError) {
      console.error("feedback_model_persist_error", fallbackError.message || String(fallbackError));
      throw fallbackError;
    }
    console.error("feedback_model_persist_tmp_error", error.message || String(error));
  }
}

function touchRecentQuery(queryKey) {
  const hits = (recentQueries.get(queryKey) || 0) + 1;
  recentQueries.set(queryKey, hits);
  if (hits > 1) metrics.repeatedQueries += 1;
  if (recentQueries.size > RECENT_QUERIES_MAX) {
    const overflow = recentQueries.size - RECENT_QUERIES_MAX;
    let removed = 0;
    for (const key of recentQueries.keys()) {
      recentQueries.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}

function clientIp(req) {
  const fromHeader = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fromHeader || req.socket.remoteAddress || "unknown";
}

function checkRateLimit(req, bucketName, maxPerWindow) {
  const now = Date.now();
  const ip = clientIp(req);
  const key = `${bucketName}:${ip}`;
  if (rateBuckets.size > 10_000) {
    for (const [bucketKey, value] of rateBuckets.entries()) {
      if (now - value.windowStart > RATE_LIMIT_WINDOW_MS * 3) rateBuckets.delete(bucketKey);
    }
  }
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(key, { windowStart: now, count: 1 });
    return true;
  }

  bucket.count += 1;
  if (bucket.count > maxPerWindow) return false;
  return true;
}

function matchesSameOrigin(req) {
  const origin = String(req.headers.origin || "").trim();
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const host = String(req.headers.host || "");
    return originUrl.host === host;
  } catch {
    return false;
  }
}

function isAuthorized(req, scope) {
  const headerToken = String(req.headers["x-api-token"] || req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const ip = clientIp(req);
  const isLocal = ip === "127.0.0.1" || ip === "::1";
  if (scope === "metrics") {
    if (METRICS_API_TOKEN) return headerToken === METRICS_API_TOKEN;
    return isLocal || matchesSameOrigin(req);
  }

  if (scope === "feedback") {
    if (FEEDBACK_API_TOKEN) return headerToken === FEEDBACK_API_TOKEN;
    return isLocal || matchesSameOrigin(req);
  }

  return false;
}

function nextRequestId() {
  return createHash("sha1")
    .update(`${Date.now()}-${Math.random()}`)
    .digest("hex")
    .slice(0, 10);
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const STOPWORDS = new Set([
  "а", "без", "бы", "был", "была", "были", "было", "быть", "в", "вам", "вас", "во", "вот", "все", "всё", "вы", "где",
  "да", "даже", "для", "до", "его", "ее", "её", "если", "есть", "еще", "ещё", "же", "за", "и", "из", "или", "им", "их",
  "как", "ко", "когда", "кто", "ли", "лишь", "мне", "много", "можно", "мой", "мы", "на", "над", "надо", "нас", "не", "него",
  "нее", "неё", "нет", "ни", "но", "ну", "о", "об", "одна", "одни", "он", "она", "они", "оно", "от", "очень", "по", "под",
  "при", "про", "раз", "с", "сам", "себя", "сейчас", "снова", "собой", "так", "там", "тебя", "тем", "то", "только", "тут",
  "ты", "у", "уже", "хоть", "хочу", "чего", "чем", "что", "чтобы", "эта", "эти", "это", "я"
]);

const ASSOCIATIVE_GROUPS = {
  anxiety: ["тревог", "страх", "бояз", "паник", "беспокой", "темн", "мрак", "тоска", "смятени"],
  hope: ["надеж", "свет", "будущ", "вера", "утро", "весн", "заря", "радост"],
  relation: ["любов", "сердц", "нежн", "поцел", "разлук", "верност", "мил", "близ"],
  meaning: ["смысл", "путь", "душ", "жизн", "вечност", "истин", "судьб"],
  freedom: ["свобод", "воля", "ветер", "дорог", "простор", "крыл"],
  past: ["утрат", "потер", "печал", "слез", "слёз", "горе", "расставан", "вчера", "прошл"],
  future: ["завтра", "дальше", "начать", "настан", "будет", "потом"]
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function getStaticPath(urlPath) {
  let decoded = "";
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const normalized = path.normalize(decoded);
  const withoutTraversal = normalized.replace(/^(\.\.(\/|\\|$))+/, "");
  const relative = withoutTraversal === "/" ? "index.html" : withoutTraversal.replace(/^[/\\]+/, "");
  return path.join(__dirname, relative);
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    req.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("bad_json"));
      }
    });
    req.on("error", reject);
  });
}

function normalizeText(value) {
  return rankNormalizeText(value);
}

function getClientKey(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(value)) return "";
  return value;
}

function getUserKey(req, body) {
  const explicitClientId = getClientKey(body?.clientId) || getClientKey(req.headers["x-client-id"]);
  if (explicitClientId) return `client:${explicitClientId}`;
  const ip = clientIp(req);
  const ua = String(req.headers["user-agent"] || "");
  const fallback = createHash("sha1").update(`${ip}|${ua}`).digest("hex").slice(0, 20);
  return `anon:${fallback}`;
}

function getGlobalModel() {
  const model = sanitizeUserModel(feedbackStore.globalModel || {});
  feedbackStore.globalModel = model;
  return model;
}

function blendNumericMaps(primary = {}, secondary = {}, primaryWeight = 0.7, secondaryWeight = 0.3) {
  const out = {};
  const keys = new Set([...Object.keys(primary), ...Object.keys(secondary)]);
  for (const key of keys) {
    const a = Number(primary[key] || 0);
    const b = Number(secondary[key] || 0);
    out[key] = Number((a * primaryWeight + b * secondaryWeight).toFixed(6));
  }
  return out;
}

function blendModels(userModel, globalModel, userWeight = 0.7, globalWeight = 0.3) {
  return {
    updatedAt: userModel.updatedAt || globalModel.updatedAt || "",
    lastDecayAt: Date.now(),
    weights: blendNumericMaps(userModel.weights, globalModel.weights, userWeight, globalWeight),
    byAuthor: blendNumericMaps(userModel.byAuthor, globalModel.byAuthor, userWeight, globalWeight),
    byFingerprint: blendNumericMaps(userModel.byFingerprint, globalModel.byFingerprint, userWeight, globalWeight),
    byReason: blendNumericMaps(userModel.byReason, globalModel.byReason, userWeight, globalWeight),
    recentFeedback: []
  };
}

function pruneFeedbackUsers(store) {
  const keys = Object.keys(store.users || {});
  if (keys.length <= FEEDBACK_USERS_MAX) return;
  const sorted = keys
    .map((key) => {
      const model = store.users[key];
      const lastSeen = Number(model?.lastSeenAt || 0);
      const updatedAt = Date.parse(String(model?.updatedAt || "")) || 0;
      return { key, score: Math.max(lastSeen, updatedAt) };
    })
    .sort((a, b) => a.score - b.score);

  const toRemove = Math.min(keys.length - FEEDBACK_USERS_MAX, FEEDBACK_USERS_PRUNE_BATCH);
  for (let i = 0; i < toRemove; i += 1) {
    delete store.users[sorted[i].key];
  }
  metrics.userModelsPruned += toRemove;
}

function getOrCreateUserModel(userKey) {
  pruneFeedbackUsers(feedbackStore);
  const existing = feedbackStore.users[userKey];
  if (existing) {
    existing.lastSeenAt = Date.now();
    return existing;
  }
  const model = createUserModel();
  model.lastSeenAt = Date.now();
  feedbackStore.users[userKey] = model;
  return model;
}

function buildScoringStateWeights(stateWeights) {
  const out = { __associativeGroups: ASSOCIATIVE_GROUPS };
  if (!stateWeights || typeof stateWeights !== "object") return out;
  for (const [key, value] of Object.entries(stateWeights)) out[key] = value;
  return out;
}

function splitTokens(text) {
  return normalizeText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function stemPrefix(token) {
  if (token.length <= 5) return token;
  return token.slice(0, 5);
}

function extractKeywords(text, limit = 8) {
  const tokens = splitTokens(text);
  const uniq = [];
  const seen = new Set();

  for (const token of tokens) {
    const key = stemPrefix(token);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(token);
    if (uniq.length >= limit) break;
  }

  return uniq;
}

function detectQueryGroups(tokens) {
  const groups = new Set();
  for (const [group, stems] of Object.entries(ASSOCIATIVE_GROUPS)) {
    for (const token of tokens) {
      const prefix = stemPrefix(token);
      if (stems.some((stem) => token.includes(stem) || stem.includes(prefix))) {
        groups.add(group);
        break;
      }
    }
  }
  return groups;
}

function buildSearchTerms({ query, terms, stateWeights }) {
  const queryTerms = extractKeywords(query, 8);
  const out = [...queryTerms];

  if (Array.isArray(terms)) {
    for (const term of terms) {
      if (typeof term === "string" && term.trim()) out.push(term.trim());
    }
  }

  if (stateWeights && typeof stateWeights === "object") {
    for (const [group, score] of Object.entries(stateWeights)) {
      if (Number(score) < 0.75) continue;
      const stems = ASSOCIATIVE_GROUPS[group] || [];
      if (stems.length) out.push(stems[0]);
    }
  }

  const uniq = [];
  const seen = new Set();
  for (const term of out) {
    const token = normalizeText(term).split(" ")[0];
    if (!token || token.length < 3) continue;
    const key = stemPrefix(token);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(token);
    if (uniq.length >= 10) break;
  }

  return uniq;
}

function buildNkryPayload(term) {
  return {
    corpus: {
      type: NKRY_CORPUS_TYPE
    },
    lexGramm: {
      sectionValues: [
        {
          subsectionValues: [
            {
              conditionValues: [
                {
                  fieldName: "lex",
                  text: {
                    v: term
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  };
}

function readFieldValue(valueItem) {
  if (!valueItem || typeof valueItem !== "object") return "";
  if (valueItem.valString?.v) return String(valueItem.valString.v);
  if (valueItem.valStringWeighted?.v) return String(valueItem.valStringWeighted.v);
  if (valueItem.valDateRange?.v?.start?.year) return String(valueItem.valDateRange.v.start.year);
  return "";
}

function parseDocMeta(docInfo) {
  const meta = { author: "", year: "", type: "", topic: "", style: "", header: "" };
  const items = docInfo?.docExplainInfo?.items || [];

  for (const item of items) {
    for (const field of item.parsingFields || []) {
      const name = String(field.name || "").toLowerCase();
      const values = Array.isArray(field.value) ? field.value : [];

      if (!meta.author && (name === "author" || name.includes("автор"))) {
        const found = values.map(readFieldValue).find(Boolean);
        if (found) meta.author = found;
      }

      if (!meta.year && (name === "publ_year" || name === "created" || name.includes("year") || name.includes("год"))) {
        const found = values.map(readFieldValue).find(Boolean);
        if (found) meta.year = found;
      }

      if (!meta.type && name === "type") {
        const found = values.map(readFieldValue).find(Boolean);
        if (found) meta.type = found;
      }

      if (!meta.topic && name === "topic") {
        const found = values.map(readFieldValue).find(Boolean);
        if (found) meta.topic = found;
      }

      if (!meta.style && name === "style") {
        const found = values.map(readFieldValue).find(Boolean);
        if (found) meta.style = found;
      }

      if (!meta.header && name === "header") {
        const found = values.map(readFieldValue).find(Boolean);
        if (found) meta.header = found;
      }
    }
  }

  return meta;
}

function joinWords(words) {
  const parts = words
    .map((word) => String(word?.text || ""))
    .filter((x) => x.length > 0);

  return parts
    .join("")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .trim();
}

function extractSnippetQuote(snippet) {
  const words = [];
  for (const sequence of snippet.sequences || []) {
    for (const word of sequence.words || []) words.push(word);
  }

  if (!words.length) return { quote: "", hitCount: 0 };

  const hitIndices = [];
  for (let i = 0; i < words.length; i += 1) {
    if (words[i]?.displayParams?.hit) hitIndices.push(i);
  }

  if (!hitIndices.length) {
    return { quote: joinWords(words.slice(0, 80)), hitCount: 0 };
  }

  const center = hitIndices[0];
  const start = Math.max(0, center - 24);
  const end = Math.min(words.length, center + 45);

  return {
    quote: joinWords(words.slice(start, end)),
    hitCount: hitIndices.length
  };
}

function parseConcordanceCandidates(payload, term) {
  const candidates = [];
  if (!payload || typeof payload !== "object") return candidates;

  for (const group of payload.groups || []) {
    for (const doc of group.docs || []) {
      const meta = parseDocMeta(doc.info);
      const title = String(doc?.info?.title || "Без названия");

      for (const snippetGroup of doc.snippetGroups || []) {
        for (const snippet of snippetGroup.snippets || []) {
          const { quote, hitCount } = extractSnippetQuote(snippet);
          if (!quote) continue;

          candidates.push({
            quote,
            author: meta.author || "Не указан",
            title,
            year: meta.year || "",
            sourceName: "НКРЯ",
            hitCount,
            matchedTerm: term,
            docType: meta.type || "",
            docTopic: meta.topic || "",
            docStyle: meta.style || "",
            docHeader: meta.header || ""
          });
        }
      }
    }
  }

  return candidates;
}

function buildMockCandidates(term, limit) {
  const base = [
    {
      quote: "И долго буду тем любезен я народу, что чувства добрые я лирой пробуждал.",
      author: "Александр Пушкин",
      title: "Я памятник себе воздвиг нерукотворный",
      year: "1836",
      sourceName: "НКРЯ-MOCK",
      hitCount: 2
    },
    {
      quote: "О, как убийственно мы любим, как в буйной слепоте страстей.",
      author: "Федор Тютчев",
      title: "О, как убийственно мы любим",
      year: "1851",
      sourceName: "НКРЯ-MOCK",
      hitCount: 2
    },
    {
      quote: "И скучно и грустно, и некому руку подать в минуту душевной невзгоды.",
      author: "Михаил Лермонтов",
      title: "И скучно и грустно",
      year: "1840",
      sourceName: "НКРЯ-MOCK",
      hitCount: 3
    },
    {
      quote: "Не жалею, не зову, не плачу, все пройдет, как с белых яблонь дым.",
      author: "Сергей Есенин",
      title: "Не жалею, не зову, не плачу",
      year: "1921",
      sourceName: "НКРЯ-MOCK",
      hitCount: 2
    }
  ];
  return base.slice(0, limit).map((item, idx) => ({
    ...item,
    matchedTerm: term,
    docType: "поэзия",
    docTopic: idx % 2 ? "лирика" : "рефлексия",
    docStyle: "художественный",
    docHeader: `${item.author} ${item.title}`
  }));
}

async function fetchNkryConcordance(term, limit) {
  if (NKRY_MOCK_MODE) {
    return buildMockCandidates(term, limit);
  }
  const endpoint = new URL(String(NKRY_SEARCH_PATH || "").replace(/^\/+/, ""), NKRY_API_BASE_URL).toString();
  const authValue = NKRY_API_AUTH_PREFIX ? `${NKRY_API_AUTH_PREFIX} ${NKRY_API_KEY}` : NKRY_API_KEY;
  let lastError = null;

  for (let attempt = 0; attempt <= NKRY_FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NKRY_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [NKRY_API_KEY_HEADER]: authValue
        },
        body: JSON.stringify(buildNkryPayload(term)),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        const err = new Error(`НКРЯ API вернул статус ${response.status}: ${text.slice(0, 250)}`);
        const retriable = response.status === 429 || response.status >= 500;
        if (!retriable || attempt >= NKRY_FETCH_RETRIES) throw err;
        lastError = err;
      } else {
        const payload = await response.json();
        const candidates = parseConcordanceCandidates(payload, term);
        return selectDiverseCandidates(candidates, Math.max(limit * 6, 90), 2);
      }
    } catch (error) {
      const timedOut = error?.name === "AbortError";
      const retriable = timedOut || error?.cause?.code === "ECONNRESET" || /fetch failed/i.test(String(error?.message || ""));
      if (!retriable || attempt >= NKRY_FETCH_RETRIES) {
        clearTimeout(timeout);
        throw error;
      }
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(NKRY_FETCH_BACKOFF_MS * (attempt + 1));
  }

  throw lastError || new Error("НКРЯ недоступен.");
}

function shuffleArray(array) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function selectDiverseCandidates(candidates, limit = 90, perAuthorLimit = 2) {
  if (!Array.isArray(candidates) || candidates.length <= 1) return Array.isArray(candidates) ? candidates : [];
  const shuffled = shuffleArray(candidates);
  const authorCounts = new Map();
  const usedKeys = new Set();
  const selected = [];

  for (const item of shuffled) {
    const key = normalizeText(`${item?.quote || ""}__${item?.title || ""}`);
    if (!key || usedKeys.has(key)) continue;
    const authorKey = normalizeText(String(item?.author || ""));
    const count = authorCounts.get(authorKey) || 0;
    if (count >= perAuthorLimit) continue;

    selected.push(item);
    usedKeys.add(key);
    authorCounts.set(authorKey, count + 1);
    if (selected.length >= limit) break;
  }

  if (selected.length >= limit) return selected;
  for (const item of shuffled) {
    const key = normalizeText(`${item?.quote || ""}__${item?.title || ""}`);
    if (!key || usedKeys.has(key)) continue;
    selected.push(item);
    usedKeys.add(key);
    if (selected.length >= limit) break;
  }

  return selected;
}

function buildFallbackCandidates(queryTokens, limit = 28) {
  const queryStems = queryTokens.map((token) => stemPrefix(token));
  const pool = [...recentGoodPool, ...localFallbackCorpus];
  const scored = pool
    .map((item) => {
      const source = item.fallbackNorm || rankNormalizeText(`${item.quote} ${item.author} ${item.title}`);
      let lexical = 0;
      for (const token of queryTokens) {
        const stem = stemPrefix(token);
        if (source.includes(token)) lexical += 2;
        else if (source.includes(stem)) lexical += 1;
      }
      for (const stem of queryStems) {
        if (source.includes(stem)) lexical += 0.2;
      }
      const recentBoost = item.matchedTerm === "recent" ? 0.8 : 0;
      return { item, rank: lexical + recentBoost };
    })
    .filter((row) => row.rank > 0.2)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map((row) => ({
      ...row.item,
      matchedTerm: row.item.matchedTerm || "fallback",
      hitCount: Math.max(1, Number(row.item.hitCount || 1))
    }));

  if (scored.length) return scored;
  return recentGoodPool.slice(-Math.min(limit, recentGoodPool.length)).map((row) => ({
    ...row,
    matchedTerm: "fallback_recent",
    hitCount: Math.max(1, Number(row.hitCount || 1))
  }));
}

function rankAndPick({
  allCandidates,
  queryTokens,
  queryGroups,
  scoringStateWeights,
  excludeAuthors,
  excludeQuotes,
  effectiveModel,
  variantMode,
  previousTone
}) {
  const dedup = new Map();
  for (const candidate of allCandidates) {
    const key = normalizeText(`${candidate.quote}__${candidate.title}`);
    const scored = scoreCandidate({
      candidate,
      queryTokens,
      queryGroups,
      stateWeights: scoringStateWeights,
      excludeAuthors,
      model: effectiveModel
    });
    const next = { ...candidate, score: scored.score, scoreDetails: scored.components, fingerprint: buildFingerprint(candidate) };
    if (!dedup.has(key) || dedup.get(key).score < scored.score) dedup.set(key, next);
  }

  const ranked = Array.from(dedup.values()).sort((a, b) => b.score - a.score);
  const filtered = ranked.filter((item) => !excludeQuotes.includes(normalizeText(item.quote)));
  if (!filtered.length) return null;

  const top = pickTopCandidate(filtered, variantMode, previousTone);
  const alternatives = filtered
    .filter((item) => item.fingerprint !== top.fingerprint)
    .slice(0, 3)
    .map((item) => ({
      quote: item.quote,
      author: item.author,
      title: item.title,
      year: item.year,
      sourceName: item.sourceName,
      tone: item.scoreDetails?.tone || 0,
      fingerprint: item.fingerprint
    }));
  return { top, alternatives, ranked: filtered };
}

function pickWithControlledExploration(picked, variantMode) {
  const base = picked?.top || null;
  if (!base) return { top: null, policy: "exploit", epsilon: 0, exploredFromTopK: 0 };

  const epsilon = Math.max(0, Math.min(0.5, Number(MATCH_EXPLORATION_EPSILON || 0)));
  const allowExplore = variantMode !== "contrast" && epsilon > 0;
  const ranked = Array.isArray(picked?.ranked) ? picked.ranked : [];
  const explorePool = ranked.slice(1, Math.max(1, Math.min(MATCH_EXPLORATION_TOP_K, ranked.length)));
  const shouldExplore = allowExplore && explorePool.length > 0 && Math.random() < epsilon;

  if (!shouldExplore) {
    return {
      top: base,
      policy: "exploit",
      epsilon,
      exploredFromTopK: explorePool.length
    };
  }

  const idx = Math.floor(Math.random() * explorePool.length);
  return {
    top: explorePool[idx] || base,
    policy: "explore",
    epsilon,
    exploredFromTopK: explorePool.length
  };
}

async function handleNkrySearch(req, res) {
  const startedAt = Date.now();
  metrics.searchRequests += 1;
  if (!NKRY_MOCK_MODE && (!NKRY_API_BASE_URL || !NKRY_SEARCH_PATH || !NKRY_API_KEY)) {
    markSearchError();
    sendJson(res, 503, {
      error: "НКРЯ не настроен на сервере. Задайте NKRY_API_BASE_URL, NKRY_SEARCH_PATH и NKRY_API_KEY."
    });
    return;
  }

  let body;
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    if (error && error.message === "payload_too_large") {
      markSearchError();
      sendJson(res, 413, { error: "Слишком большой JSON в запросе." });
      return;
    }
    markSearchError();
    sendJson(res, 400, { error: "Некорректный JSON в запросе." });
    return;
  }

  const userKey = getUserKey(req, body);
  const userModel = getOrCreateUserModel(userKey);
  const globalModel = getGlobalModel();
  applyDecay(userModel);
  applyDecay(globalModel);
  const effectiveModel = blendModels(userModel, globalModel);

  const query = String(body.query || "").trim();
  const limit = Math.max(1, Math.min(20, Number(body.limit || 10)));
  const variantMode = String(body.variantMode || "");
  const previousTone = Number(body.previousTone);
  const excludeAuthors = Array.isArray(body.excludeAuthors)
    ? body.excludeAuthors.map((x) => normalizeText(String(x || ""))).filter(Boolean)
    : [];
  const stateWeights = body.stateWeights && typeof body.stateWeights === "object" ? body.stateWeights : {};
  const scoringStateWeights = buildScoringStateWeights(stateWeights);
  const excludeQuotes = Array.isArray(body.excludeQuotes)
    ? body.excludeQuotes.map((x) => normalizeText(String(x || ""))).filter(Boolean)
    : [];

  if (!query) {
    markSearchError();
    sendJson(res, 400, { error: "Пустой query." });
    return;
  }

  const queryTokens = extractKeywords(query, 10);
  if (!queryTokens.length) {
    markSearchError();
    sendJson(res, 400, { error: "Не удалось выделить ключевые слова запроса." });
    return;
  }
  const queryGroups = detectQueryGroups(queryTokens);

  const terms = buildSearchTerms({ query, terms: body.terms, stateWeights });
  if (!terms.length) {
    markSearchError();
    sendJson(res, 400, { error: "Не удалось сформировать термы поиска." });
    return;
  }

  const queryKey = normalizeText(query);
  touchRecentQuery(queryKey);

  const sendRankedPayload = (picked, responseTerms, explainText = "", meta = {}) => {
    const selection = pickWithControlledExploration(picked, variantMode);
    const top = selection.top || picked.top;
    if (selection.policy === "explore") metrics.searchExploreServed += 1;
    else metrics.searchExploitServed += 1;

    const alternatives = (picked.ranked || [])
      .filter((item) => item.fingerprint !== top.fingerprint)
      .slice(0, 3)
      .map((item) => ({
        quote: item.quote,
        author: item.author,
        title: item.title,
        year: item.year,
        sourceName: item.sourceName,
        tone: item.scoreDetails?.tone || 0,
        fingerprint: item.fingerprint
      }));

    const servedQuoteId = servedQuoteRegistry.issue(userKey, {
      fingerprint: top.fingerprint,
      author: top.author,
      title: top.title,
      quote: top.quote,
      servingPolicy: selection.policy,
      explorationEpsilon: selection.epsilon
    });
    addRecentGoodCandidates([top, ...alternatives]);
    markSearchSuccess();
    metrics.searchLatencyTotalMs += Date.now() - startedAt;
    metrics.searchLatencySamples += 1;
    console.log(
      JSON.stringify({
        type: "search_success",
        query: queryKey,
        variantMode: variantMode || "default",
        matchedTerms: responseTerms.slice(0, 5),
        topAuthor: top.author,
        topTitle: top.title,
        servingPolicy: selection.policy,
        explorationEpsilon: selection.epsilon,
        exploredFromTopK: selection.exploredFromTopK,
        ...meta
      })
    );
    sendJson(res, 200, {
      quote: {
        quote: top.quote,
        author: top.author,
        title: top.title,
        year: top.year,
        sourceName: top.sourceName,
        score: top.score,
        matchedTerms: responseTerms.slice(0, 5),
        tone: top.scoreDetails?.tone || 0,
        fingerprint: top.fingerprint,
        servingPolicy: selection.policy,
        servedQuoteId,
        scoreDetails: top.scoreDetails
      },
      explain: explainText
        || "Скоринг: совпадение запроса + тематическая близость + эмоциональный тон + коррекция по вашему feedback.",
      alternatives
    });
  };

  if (isNkryCircuitOpen()) {
    const fallbackCandidates = buildFallbackCandidates(queryTokens, Math.max(18, limit * 3));
    const pickedFallback = rankAndPick({
      allCandidates: fallbackCandidates,
      queryTokens,
      queryGroups,
      scoringStateWeights,
      excludeAuthors,
      excludeQuotes,
      effectiveModel,
      variantMode,
      previousTone
    });
    if (pickedFallback) {
      metrics.circuitFallbackResponses += 1;
      sendRankedPayload(
        pickedFallback,
        ["fallback_circuit_open"],
        "НКРЯ временно недоступен, показан лучший вариант из локального каталога/последних релевантных результатов.",
        { fallback: "circuit_open" }
      );
      return;
    }
    markSearchError();
    sendJson(res, 503, { error: "Внешний источник временно недоступен. Попробуйте снова через минуту." });
    return;
  }

  let allCandidates = [];
  const settled = await Promise.allSettled(terms.map((term) => fetchNkryConcordance(term, limit)));
  const errors = [];
  let upstreamSuccesses = 0;
  for (const result of settled) {
    if (result.status === "fulfilled") {
      upstreamSuccesses += 1;
      allCandidates = allCandidates.concat(result.value);
      continue;
    }
    errors.push(result.reason?.message || "Ошибка сети при обращении к НКРЯ API.");
  }
  if (upstreamSuccesses > 0) markNkrySuccess();
  else markNkryFailure(errors.slice(0, 2).join(" | "));

  if (!allCandidates.length) {
    const fallbackCandidates = buildFallbackCandidates(queryTokens, Math.max(18, limit * 3));
    const pickedFallback = rankAndPick({
      allCandidates: fallbackCandidates,
      queryTokens,
      queryGroups,
      scoringStateWeights,
      excludeAuthors,
      excludeQuotes,
      effectiveModel,
      variantMode,
      previousTone
    });
    if (pickedFallback) {
      metrics.circuitFallbackResponses += 1;
      sendRankedPayload(
        pickedFallback,
        ["fallback_after_upstream_error"],
        "НКРЯ временно недоступен, показан лучший вариант из локального каталога/последних релевантных результатов.",
        { fallback: "upstream_error" }
      );
      return;
    }
    markSearchError();
    const reason = errors.length ? ` Все термы завершились ошибкой: ${errors.slice(0, 3).join(" | ")}` : "";
    sendJson(res, 502, { error: `НКРЯ недоступен для текущего запроса.${reason}` });
    console.log(JSON.stringify({ type: "search_error", query: queryKey, reason: "all_terms_failed", errors: errors.slice(0, 3) }));
    return;
  }

  const picked = rankAndPick({
    allCandidates,
    queryTokens,
    queryGroups,
    scoringStateWeights,
    excludeAuthors,
    excludeQuotes,
    effectiveModel,
    variantMode,
    previousTone
  });
  if (!picked) {
    markSearchEmpty();
    sendJson(res, 404, { error: "Не удалось выбрать новый фрагмент, попробуйте изменить вопрос." });
    console.log(JSON.stringify({ type: "search_empty", query: queryKey, reason: "all_excluded" }));
    return;
  }
  sendRankedPayload(picked, terms);
}

async function handleNkryFeedback(req, res) {
  if (!checkRateLimit(req, "feedback", RATE_LIMIT_FEEDBACK_PER_WINDOW)) {
    sendJson(res, 429, { error: "Слишком много feedback-запросов. Повторите позже." });
    return;
  }
  if (!isAuthorized(req, "feedback")) {
    sendJson(res, 401, { error: "Unauthorized feedback request." });
    return;
  }

  let body;
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    if (error && error.message === "payload_too_large") {
      sendJson(res, 413, { error: "Слишком большой JSON в запросе." });
      return;
    }
    sendJson(res, 400, { error: "Некорректный JSON в запросе." });
    return;
  }

  const rating = Number(body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    sendJson(res, 400, { error: "Оценка должна быть в диапазоне 1-5." });
    return;
  }

  const userKey = getUserKey(req, body);
  const servedQuoteId = String(body.servedQuoteId || "").trim();
  if (!servedQuoteId) {
    sendJson(res, 200, { ok: true, ignored: "legacy_feedback_without_servedQuoteId" });
    return;
  }
  const servedCandidate = servedQuoteRegistry.consume(userKey, servedQuoteId);
  if (!servedCandidate) {
    sendJson(res, 409, { error: "Feedback отклонен: цитата не найдена или уже подтверждена." });
    return;
  }

  const reason = String(body.reason || "").trim();
  const userModel = getOrCreateUserModel(userKey);
  const globalModel = getGlobalModel();
  applyFeedbackLearning(userModel, { rating, reason, candidate: servedCandidate });
  applyFeedbackLearning(globalModel, { rating, reason, candidate: servedCandidate });
  const effectiveModel = blendModels(userModel, globalModel);
  feedbackStore.updatedAt = new Date().toISOString();
  try {
    await persistFeedbackStore(feedbackStore);
  } catch {
    sendJson(res, 500, { error: "Не удалось сохранить feedback в хранилище." });
    return;
  }
  metrics.feedbackEvents += 1;
  const servingPolicy = String(servedCandidate.servingPolicy || "exploit") === "explore" ? "explore" : "exploit";
  if (servingPolicy === "explore") {
    metrics.feedbackExploreEvents += 1;
    metrics.feedbackExploreRatingTotal += rating;
  } else {
    metrics.feedbackExploitEvents += 1;
    metrics.feedbackExploitRatingTotal += rating;
  }
  console.log(
    JSON.stringify({
      type: "feedback",
      rating,
      hitScore: rating,
      reason,
      author: servedCandidate.author || "",
      title: servedCandidate.title || "",
      servingPolicy
    })
  );

  sendJson(res, 200, {
    ok: true,
    updatedAt: effectiveModel.updatedAt,
    weights: effectiveModel.weights
  });
}

function getWindowSearchStats(windowMs = SLO_WINDOW_MS) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const windowEvents = recentSearchEvents.filter((event) => event.ts >= cutoff);
  const total = windowEvents.length;
  let success = 0;
  let empty = 0;
  let error = 0;
  for (const event of windowEvents) {
    if (event.kind === "success") success += 1;
    else if (event.kind === "empty") empty += 1;
    else if (event.kind === "error") error += 1;
  }
  const successRate = total ? success / total : 0;
  const noResultRate = total ? empty / total : 0;
  const searchErrorRate = total ? error / total : 0;
  const feedbackPersistErrors = feedbackPersistErrorEvents.filter((ts) => ts >= cutoff).length;
  return {
    windowMs,
    total,
    success,
    empty,
    error,
    successRate: Number(successRate.toFixed(4)),
    noResultRate: Number(noResultRate.toFixed(4)),
    searchErrorRate: Number(searchErrorRate.toFixed(4)),
    feedbackPersistErrors
  };
}

function getSloState(windowStats) {
  const alerts = [];
  if (windowStats.total > 0 && windowStats.successRate < SLO_SUCCESS_RATE_MIN) {
    alerts.push({
      key: "successRate",
      severity: "critical",
      message: `successRate ${windowStats.successRate} < ${SLO_SUCCESS_RATE_MIN}`
    });
  }
  if (windowStats.total > 0 && windowStats.noResultRate > SLO_NO_RESULT_RATE_MAX) {
    alerts.push({
      key: "noResultRate",
      severity: "critical",
      message: `noResultRate ${windowStats.noResultRate} > ${SLO_NO_RESULT_RATE_MAX}`
    });
  }
  if (windowStats.total > 0 && windowStats.searchErrorRate > SLO_SEARCH_ERROR_RATE_MAX) {
    alerts.push({
      key: "searchErrors",
      severity: "critical",
      message: `searchErrorRate ${windowStats.searchErrorRate} > ${SLO_SEARCH_ERROR_RATE_MAX}`
    });
  }
  if (windowStats.feedbackPersistErrors > 0) {
    alerts.push({
      key: "feedbackPersistErrors",
      severity: "critical",
      message: `feedbackPersistErrors ${windowStats.feedbackPersistErrors} > 0`
    });
  }
  return {
    ok: alerts.length === 0,
    alerts
  };
}

function getQualityMetrics() {
  const ratings = [];
  const globalModel = getGlobalModel();
  for (const row of globalModel.recentFeedback || []) {
    const value = Number(row.rating);
    if (Number.isFinite(value)) ratings.push(value);
  }
  for (const model of Object.values(feedbackStore.users)) {
    for (const row of model.recentFeedback || []) {
      const value = Number(row.rating);
      if (Number.isFinite(value)) ratings.push(value);
    }
  }
  const averageRating = ratings.length
    ? Number((ratings.reduce((acc, x) => acc + x, 0) / ratings.length).toFixed(3))
    : null;
  const searchLatencyAvgMs = metrics.searchLatencySamples
    ? Number((metrics.searchLatencyTotalMs / metrics.searchLatencySamples).toFixed(2))
    : null;
  const window15m = getWindowSearchStats(SLO_WINDOW_MS);
  const slo = getSloState(window15m);
  const exploreAvgHitScore = metrics.feedbackExploreEvents
    ? Number((metrics.feedbackExploreRatingTotal / metrics.feedbackExploreEvents).toFixed(3))
    : null;
  const exploitAvgHitScore = metrics.feedbackExploitEvents
    ? Number((metrics.feedbackExploitRatingTotal / metrics.feedbackExploitEvents).toFixed(3))
    : null;
  const exploreVsExploitDelta =
    Number.isFinite(exploreAvgHitScore) && Number.isFinite(exploitAvgHitScore)
      ? Number((exploreAvgHitScore - exploitAvgHitScore).toFixed(3))
      : null;

  return {
    searchRequests: metrics.searchRequests,
    searchSuccess: metrics.searchSuccess,
    searchEmpty: metrics.searchEmpty,
    searchErrors: metrics.searchErrors,
    repeatedQueries: metrics.repeatedQueries,
    feedbackEvents: metrics.feedbackEvents,
    successRate: metrics.searchRequests ? Number((metrics.searchSuccess / metrics.searchRequests).toFixed(4)) : 0,
    noResultRate: metrics.searchRequests ? Number((metrics.searchEmpty / metrics.searchRequests).toFixed(4)) : 0,
    searchLatencyAvgMs,
    averageRating,
    modelUpdatedAt: feedbackStore.updatedAt || null,
    globalModelUpdatedAt: globalModel.updatedAt || null,
    globalFeedbackEvents: Array.isArray(globalModel.recentFeedback) ? globalModel.recentFeedback.length : 0,
    userModels: Object.keys(feedbackStore.users).length,
    userModelsPruned: metrics.userModelsPruned,
    feedbackPersistErrors: metrics.feedbackPersistErrors,
    exploration: {
      epsilon: Number(Math.max(0, Math.min(0.5, MATCH_EXPLORATION_EPSILON)).toFixed(4)),
      topK: MATCH_EXPLORATION_TOP_K,
      searchExploreServed: metrics.searchExploreServed,
      searchExploitServed: metrics.searchExploitServed,
      feedbackExploreEvents: metrics.feedbackExploreEvents,
      feedbackExploitEvents: metrics.feedbackExploitEvents,
      exploreAvgHitScore,
      exploitAvgHitScore,
      exploreVsExploitDelta
    },
    circuitOpenEvents: metrics.circuitOpenEvents,
    circuitFallbackResponses: metrics.circuitFallbackResponses,
    nkryCircuit: {
      isOpen: isNkryCircuitOpen(),
      consecutiveFailures: nkryCircuit.consecutiveFailures,
      openUntil: nkryCircuit.openUntil ? new Date(nkryCircuit.openUntil).toISOString() : null,
      lastFailureAt: nkryCircuit.lastFailureAt ? new Date(nkryCircuit.lastFailureAt).toISOString() : null,
      lastOpenedAt: nkryCircuit.lastOpenedAt ? new Date(nkryCircuit.lastOpenedAt).toISOString() : null,
      lastReason: nkryCircuit.lastReason || null
    },
    window15m,
    slo
  };
}

function getFeedbackStats() {
  const globalModel = getGlobalModel();
  const events = Array.isArray(globalModel.recentFeedback) ? globalModel.recentFeedback : [];
  const ratings = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  const reasons = {};
  const byAuthor = {};
  const byTitle = {};

  for (const row of events) {
    const rating = String(Math.max(1, Math.min(5, Math.round(Number(row.rating) || 0))));
    if (ratings[rating] !== undefined) ratings[rating] += 1;
    const reason = String(row.reason || "").trim() || "(none)";
    reasons[reason] = (reasons[reason] || 0) + 1;
    const author = String(row.author || "").trim() || "Не указан";
    const title = String(row.title || "").trim() || "Без названия";
    byAuthor[author] = (byAuthor[author] || 0) + 1;
    byTitle[title] = (byTitle[title] || 0) + 1;
  }

  const ratedTotal = Object.values(ratings).reduce((acc, x) => acc + x, 0);
  const fitPositive = (ratings["4"] || 0) + (ratings["5"] || 0);
  const fitNegative = (ratings["1"] || 0) + (ratings["2"] || 0);
  const fitNeutral = ratings["3"] || 0;
  const activeUsers = Object.values(feedbackStore.users).filter(
    (model) => Array.isArray(model?.recentFeedback) && model.recentFeedback.length > 0
  ).length;

  return {
    totalFeedbackEvents: ratedTotal,
    activeUsers,
    globalModelUpdatedAt: globalModel.updatedAt || null,
    fit: {
      positive_4_5: fitPositive,
      negative_1_2: fitNegative,
      neutral_3: fitNeutral
    },
    ratings,
    reasons: Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count })),
    topAuthors: Object.entries(byAuthor)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([author, count]) => ({ author, count })),
    topTitles: Object.entries(byTitle)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([title, count]) => ({ title, count }))
  };
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const filePath = getStaticPath(requestUrl.pathname);
  if (!filePath) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  const size = statSync(filePath).size;
  const cacheControl = extension === ".html" ? "no-store, max-age=0" : "no-cache, max-age=0";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": size,
    "Cache-Control": cacheControl
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const requestId = nextRequestId();
  const startedAt = Date.now();
  res.on("finish", () => {
    console.log(
      JSON.stringify({
        type: "http_access",
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt
      })
    );
  });

  try {
    if (req.method === "POST" && req.url === "/api/nkry/search") {
      await handleNkrySearch(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/nkry/feedback") {
      await handleNkryFeedback(req, res);
      return;
    }

    if (req.method === "GET" && req.url === "/api/metrics") {
      if (!checkRateLimit(req, "metrics", RATE_LIMIT_METRICS_PER_WINDOW)) {
        sendJson(res, 429, { error: "Слишком много запросов метрик. Повторите позже." });
        return;
      }
      if (!isAuthorized(req, "metrics")) {
        sendJson(res, 401, { error: "Unauthorized metrics request." });
        return;
      }
      sendJson(res, 200, {
        ...getQualityMetrics(),
        appVersion: APP_VERSION,
        uptimeSec: Math.floor((Date.now() - BOOT_AT) / 1000),
        now: new Date().toISOString()
      });
      return;
    }

    if (req.method === "GET" && req.url === "/api/feedback-stats") {
      if (!checkRateLimit(req, "metrics", RATE_LIMIT_METRICS_PER_WINDOW)) {
        sendJson(res, 429, { error: "Слишком много запросов статистики. Повторите позже." });
        return;
      }
      if (!isAuthorized(req, "metrics")) {
        sendJson(res, 401, { error: "Unauthorized feedback stats request." });
        return;
      }
      sendJson(res, 200, {
        ...getFeedbackStats(),
        appVersion: APP_VERSION,
        now: new Date().toISOString()
      });
      return;
    }

    if (req.method === "GET" && req.url === "/api/slo-alerts") {
      if (!checkRateLimit(req, "metrics", RATE_LIMIT_METRICS_PER_WINDOW)) {
        sendJson(res, 429, { error: "Слишком много запросов SLO-алертов. Повторите позже." });
        return;
      }
      if (!isAuthorized(req, "metrics")) {
        sendJson(res, 401, { error: "Unauthorized slo alerts request." });
        return;
      }
      const window15m = getWindowSearchStats(SLO_WINDOW_MS);
      const slo = getSloState(window15m);
      sendJson(res, 200, {
        ok: slo.ok,
        alerts: slo.alerts,
        window15m,
        thresholds: {
          successRateMin: SLO_SUCCESS_RATE_MIN,
          noResultRateMax: SLO_NO_RESULT_RATE_MAX,
          searchErrorRateMax: SLO_SEARCH_ERROR_RATE_MAX,
          feedbackPersistErrorsMax: 0
        },
        now: new Date().toISOString()
      });
      return;
    }

    if (req.method === "GET" && req.url === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        appVersion: APP_VERSION,
        uptimeSec: Math.floor((Date.now() - BOOT_AT) / 1000),
        now: new Date().toISOString()
      });
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    console.error(
      JSON.stringify({
        type: "http_unhandled_error",
        requestId,
        method: req.method,
        url: req.url,
        message: error?.message || String(error)
      })
    );
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal server error" });
    } else {
      res.end();
    }
  }
});

server.listen(PORT, HOST, async () => {
  await ensureFeedbackStoreBootstrapped(feedbackStore);
  console.log(`Server started: http://${HOST}:${PORT}`);
});
