import http from "node:http";
import path from "node:path";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const processStartedAt = Date.now();

function readAppVersionFromPackage() {
  try {
    const pkgPath = path.join(__dirname, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const v = String(pkg?.version || "").trim();
    return v || "0.0.0-dev";
  } catch {
    return "0.0.0-dev";
  }
}

function clampInt(raw, fallback, min, max) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_REQUEST_BODY_BYTES = Number(process.env.MAX_REQUEST_BODY_BYTES || 16 * 1024);
const APP_VERSION = process.env.APP_VERSION || readAppVersionFromPackage();
const APP_COMMIT =
  process.env.APP_COMMIT
  || process.env.RENDER_GIT_COMMIT
  || process.env.GIT_COMMIT
  || "dev";
const APP_BUILD_TIME = process.env.APP_BUILD_TIME || new Date().toISOString();

const NKRY_API_BASE_URL = process.env.NKRY_API_BASE_URL || "https://ruscorpora.ru/api/v1/";
const NKRY_SEARCH_PATH = process.env.NKRY_SEARCH_PATH || "lex-gramm/concordance";
const NKRY_API_KEY = process.env.NKRY_API_KEY || "";
const NKRY_API_KEY_HEADER = process.env.NKRY_API_KEY_HEADER || "Authorization";
const NKRY_API_AUTH_PREFIX = process.env.NKRY_API_AUTH_PREFIX || "Bearer";
const NKRY_CORPUS_TYPE = process.env.NKRY_CORPUS_TYPE || "MAIN";
const NKRY_SORTING = process.env.NKRY_SORTING || "grcreated";
const NKRY_ALGO_REVISION = "chrono-v2";
const NKRY_FETCH_TIMEOUT_MS = clampInt(process.env.NKRY_FETCH_TIMEOUT_MS, 12000, 1500, 45000);
const NKRY_FETCH_RETRIES = clampInt(process.env.NKRY_FETCH_RETRIES, 1, 0, 6);
const NKRY_FETCH_BACKOFF_MS = clampInt(process.env.NKRY_FETCH_BACKOFF_MS, 280, 60, 3000);
const NKRY_FETCH_BACKOFF_JITTER_MS = clampInt(process.env.NKRY_FETCH_BACKOFF_JITTER_MS, 220, 0, 2000);
const NKRY_RATE_LIMIT_COOLDOWN_MIN_SEC = clampInt(process.env.NKRY_RATE_LIMIT_COOLDOWN_MIN_SEC, 6, 1, 180);
const NKRY_RATE_LIMIT_COOLDOWN_MAX_SEC = Math.max(
  NKRY_RATE_LIMIT_COOLDOWN_MIN_SEC,
  clampInt(process.env.NKRY_RATE_LIMIT_COOLDOWN_MAX_SEC, 120, 1, 900)
);
const NKRY_FIRST_USAGE_MAX_PAGES = clampInt(process.env.NKRY_FIRST_USAGE_MAX_PAGES, 12, 1, 60);
const NKRY_DEEP_SCAN_MAX_PAGES = clampInt(process.env.NKRY_DEEP_SCAN_MAX_PAGES, 42, 1, 200);
const NKRY_DEEP_SCAN_YEAR_THRESHOLD = clampInt(process.env.NKRY_DEEP_SCAN_YEAR_THRESHOLD, 1900, 1600, 2100);
const NKRY_SPREAD_SCAN_POINTS = clampInt(process.env.NKRY_SPREAD_SCAN_POINTS, 18, 0, 120);
const NKRY_TAIL_SCAN_PAGES = clampInt(process.env.NKRY_TAIL_SCAN_PAGES, 28, 0, 120);
const NKRY_HIGH_FREQ_PAGE_THRESHOLD = clampInt(process.env.NKRY_HIGH_FREQ_PAGE_THRESHOLD, 1200, 50, 10000);
const NKRY_HIGH_FREQ_DEEP_SCAN_MAX_PAGES = clampInt(process.env.NKRY_HIGH_FREQ_DEEP_SCAN_MAX_PAGES, 28, 8, 200);
const NKRY_HIGH_FREQ_SPREAD_SCAN_POINTS = clampInt(process.env.NKRY_HIGH_FREQ_SPREAD_SCAN_POINTS, 10, 0, 80);
const NKRY_HIGH_FREQ_TAIL_SCAN_PAGES = clampInt(process.env.NKRY_HIGH_FREQ_TAIL_SCAN_PAGES, 12, 0, 80);
const NKRY_MAX_TOTAL_PAGES = clampInt(process.env.NKRY_MAX_TOTAL_PAGES, 96, 8, 400);
const NKRY_MAX_TOTAL_MS = clampInt(process.env.NKRY_MAX_TOTAL_MS, 12000, 3000, 60000);
const NKRY_STRICT_MAX_TOTAL_PAGES = clampInt(process.env.NKRY_STRICT_MAX_TOTAL_PAGES, 220, 20, 1500);
const NKRY_STRICT_MAX_TOTAL_MS = clampInt(process.env.NKRY_STRICT_MAX_TOTAL_MS, 28000, 5000, 120000);
const NKRY_EMPTY_SCAN_STOP_PAGES = clampInt(process.env.NKRY_EMPTY_SCAN_STOP_PAGES, 6, 2, 40);
const NKRY_EARLY_EXIT_YEAR = clampInt(process.env.NKRY_EARLY_EXIT_YEAR, 1850, 1600, 2100);
const NKRY_CACHE_TTL_MS = clampInt(process.env.NKRY_CACHE_TTL_MS, 5 * 60 * 1000, 1000, 60 * 60 * 1000);
const NKRY_CACHE_STALE_TTL_MS = clampInt(process.env.NKRY_CACHE_STALE_TTL_MS, 60 * 60 * 1000, 5000, 24 * 60 * 60 * 1000);
const NKRY_CACHE_MAX_ENTRIES = clampInt(process.env.NKRY_CACHE_MAX_ENTRIES, 300, 20, 2000);
const NKRY_PAGE_CACHE_TTL_MS = clampInt(process.env.NKRY_PAGE_CACHE_TTL_MS, 90 * 1000, 1000, 20 * 60 * 1000);
const NKRY_PAGE_CACHE_STALE_TTL_MS = clampInt(process.env.NKRY_PAGE_CACHE_STALE_TTL_MS, 30 * 60 * 1000, 5000, 6 * 60 * 60 * 1000);
const NKRY_PAGE_CACHE_MAX_ENTRIES = clampInt(process.env.NKRY_PAGE_CACHE_MAX_ENTRIES, 2000, 100, 20000);
const NKRY_WARM_CACHE_ENABLED = process.env.NKRY_WARM_CACHE_ENABLED !== "0";
const NKRY_WARM_CACHE_INTERVAL_MS = clampInt(process.env.NKRY_WARM_CACHE_INTERVAL_MS, 45000, 8000, 5 * 60 * 1000);
const NKRY_WARM_CACHE_TOP_WORDS = clampInt(process.env.NKRY_WARM_CACHE_TOP_WORDS, 8, 1, 100);
const NKRY_WARM_CACHE_MIN_HITS = clampInt(process.env.NKRY_WARM_CACHE_MIN_HITS, 2, 1, 100);
const NKRY_USE_FORM_FALLBACK = process.env.NKRY_USE_FORM_FALLBACK !== "0";
const NKRY_USE_OLD_ORTHO_VARIANTS = process.env.NKRY_USE_OLD_ORTHO_VARIANTS !== "0";
const NKRY_STRICT_CHRONOLOGY_DEFAULT = process.env.NKRY_STRICT_CHRONOLOGY_DEFAULT !== "0";
const NKRY_STRICT_EARLY_YEAR_TARGET = clampInt(process.env.NKRY_STRICT_EARLY_YEAR_TARGET, 1900, 1600, 2100);
const NKRY_STRICT_MAX_PAGES = clampInt(process.env.NKRY_STRICT_MAX_PAGES, 220, 20, 1500);
const NKRY_MIN_RELEVANCE_SCORE = Math.max(
  0,
  Math.min(1, Number(process.env.NKRY_MIN_RELEVANCE_SCORE || 0.72))
);
const freshCache = new Map();
const staleCache = new Map();
const pageFreshCache = new Map();
const pageStaleCache = new Map();
const requestWordStats = new Map();
let warmCacheRunning = false;
let nkryCooldownUntil = 0;
let requestSeq = 0;

function logEvent(event, payload = {}, level = "info") {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payload
  };
  console.log(JSON.stringify(line));
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addJitter(ms, jitterMaxMs) {
  const base = Math.max(0, Number(ms || 0));
  const jitter = Math.max(0, Number(jitterMaxMs || 0));
  if (!jitter) return base;
  return base + Math.floor(Math.random() * (jitter + 1));
}

function parseRetryAfterSeconds(value) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber >= 0) return Math.trunc(asNumber);
  const asDate = Date.parse(raw);
  if (!Number.isFinite(asDate)) return 0;
  return Math.max(0, Math.round((asDate - Date.now()) / 1000));
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

function normalizeWord(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9-]/gi, "");
}

function validateOneWord(rawWord) {
  const word = normalizeWord(rawWord);
  if (!word) {
    return { ok: false, reason: "Введите одно слово.", value: "" };
  }
  if (word.length < 2 || word.length > 48) {
    return { ok: false, reason: "Слово должно быть длиной от 2 до 48 символов.", value: word };
  }
  if (!/^[a-zа-я0-9]+(?:-[a-zа-я0-9]+)?$/i.test(word)) {
    return { ok: false, reason: "Разрешены только буквы/цифры и один дефис внутри слова.", value: word };
  }
  if (word.includes("--")) {
    return { ok: false, reason: "Слово содержит некорректный дефис.", value: word };
  }
  return { ok: true, reason: "", value: word };
}

function buildNkryPayload(word, fieldName = "lex") {
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
                  fieldName: fieldName || "lex",
                  text: {
                    v: word
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

function withPage(endpoint, page, sorting = NKRY_SORTING) {
  const url = new URL(endpoint);
  url.searchParams.set("page", String(page));
  if (sorting) url.searchParams.set("sorting", sorting);
  return url.toString();
}

function createRequestBudget(strictChronology = false) {
  return {
    maxPages: strictChronology ? NKRY_STRICT_MAX_TOTAL_PAGES : NKRY_MAX_TOTAL_PAGES,
    maxMs: strictChronology ? NKRY_STRICT_MAX_TOTAL_MS : NKRY_MAX_TOTAL_MS,
    startedAt: Date.now(),
    pagesUsed: 0,
    stopReason: ""
  };
}

function isBudgetExhausted(budget) {
  if (!budget) return false;
  if (budget.pagesUsed >= budget.maxPages) {
    budget.stopReason ||= "maxPages";
    return true;
  }
  if (Date.now() - budget.startedAt >= budget.maxMs) {
    budget.stopReason ||= "maxMs";
    return true;
  }
  return false;
}

function markBudgetPageUse(budget) {
  if (!budget) return;
  budget.pagesUsed += 1;
}

function pageCacheKey(word, page, fieldName, sorting = NKRY_SORTING) {
  return [
    NKRY_ALGO_REVISION,
    NKRY_CORPUS_TYPE,
    sorting || "",
    String(fieldName || "lex"),
    String(word || ""),
    String(page || 1)
  ].join("|");
}

async function fetchNkryPage(endpoint, authValue, word, page = 1, fieldName = "lex", budget = null, sorting = NKRY_SORTING) {
  let lastError = null;
  const pageEndpoint = withPage(endpoint, page, sorting);
  const pKey = pageCacheKey(word, page, fieldName, sorting);
  const cachedPage = getFromCache(pageFreshCache, pKey, false);
  if (cachedPage) return cachedPage;

  if (isBudgetExhausted(budget)) {
    const err = new Error("Достигнут бюджет запроса до НКРЯ.");
    err.code = "NKRY_BUDGET_EXCEEDED";
    throw err;
  }
  markBudgetPageUse(budget);

  if (Date.now() < nkryCooldownUntil) {
    const stalePage = getFromCache(pageStaleCache, pKey, false);
    if (stalePage) return stalePage;
    const waitSec = Math.max(1, Math.ceil((nkryCooldownUntil - Date.now()) / 1000));
    const err = new Error(`НКРЯ временно ограничил частоту запросов. Повторите через ${waitSec} сек.`);
    err.code = "NKRY_RATE_LIMIT";
    err.retryAfterSec = waitSec;
    throw err;
  }

  for (let attempt = 0; attempt <= NKRY_FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NKRY_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(pageEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [NKRY_API_KEY_HEADER]: authValue
        },
        body: JSON.stringify(buildNkryPayload(word, fieldName)),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        const err = new Error(`НКРЯ API вернул статус ${response.status}: ${text.slice(0, 250)}`);
        if (response.status === 429) {
          const retryAfterSec = parseRetryAfterSeconds(response.headers.get("retry-after"));
          const cooldownSec = Math.max(
            NKRY_RATE_LIMIT_COOLDOWN_MIN_SEC,
            Math.min(
              NKRY_RATE_LIMIT_COOLDOWN_MAX_SEC,
              retryAfterSec || NKRY_RATE_LIMIT_COOLDOWN_MIN_SEC
            )
          );
          nkryCooldownUntil = Math.max(nkryCooldownUntil, Date.now() + cooldownSec * 1000);
          err.code = "NKRY_RATE_LIMIT";
          err.retryAfterSec = cooldownSec;
        }
        const retriable = response.status === 429 || response.status >= 500;
        if (!retriable || attempt >= NKRY_FETCH_RETRIES) throw err;
        lastError = err;
      } else {
        const payload = await response.json();
        setToCache(pageFreshCache, pKey, payload, NKRY_PAGE_CACHE_TTL_MS, NKRY_PAGE_CACHE_MAX_ENTRIES);
        setToCache(pageStaleCache, pKey, payload, NKRY_PAGE_CACHE_STALE_TTL_MS, NKRY_PAGE_CACHE_MAX_ENTRIES);
        return payload;
      }
    } catch (error) {
      const retriable =
        error?.name === "AbortError"
        || error?.cause?.code === "ECONNRESET"
        || /fetch failed/i.test(String(error?.message || ""));
      if (!retriable || attempt >= NKRY_FETCH_RETRIES) {
        clearTimeout(timeout);
        throw error;
      }
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    await sleep(addJitter(NKRY_FETCH_BACKOFF_MS * (attempt + 1), NKRY_FETCH_BACKOFF_JITTER_MS));
  }

  throw lastError || new Error("НКРЯ недоступен.");
}

function readFieldValue(valueItem) {
  if (!valueItem || typeof valueItem !== "object") return "";
  if (valueItem.valString?.v) return String(valueItem.valString.v);
  if (valueItem.valStringWeighted?.v) return String(valueItem.valStringWeighted.v);
  if (valueItem.valDateRange?.v?.start?.year) return String(valueItem.valDateRange.v.start.year);
  return "";
}

function parseDocMeta(docInfo) {
  const meta = {
    author: "",
    year: "",
    created: "",
    titleFallback: ""
  };

  const items = docInfo?.docExplainInfo?.items || [];

  for (const item of items) {
    for (const field of item.parsingFields || []) {
      const name = String(field.name || "").toLowerCase();
      const values = Array.isArray(field.value) ? field.value : [];

      if (!meta.author && (name === "author" || name.includes("автор"))) {
        const found = values.map(readFieldValue).find(Boolean);
        if (found) meta.author = found;
      }

      if (!meta.year && (name === "publ_year" || name.includes("year") || name.includes("год"))) {
        const found = values.map(readFieldValue).find(Boolean);
        if (found) meta.year = found;
      }

      if (!meta.created && name === "created") {
        const found = values.map(readFieldValue).find(Boolean);
        if (found) meta.created = found;
      }

      if (!meta.titleFallback && name === "header") {
        const found = values.map(readFieldValue).find(Boolean);
        if (found) meta.titleFallback = found;
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
  for (const sequence of snippet?.sequences || []) {
    for (const word of sequence?.words || []) {
      words.push(word);
    }
  }

  if (!words.length) return "";

  const hitIndices = [];
  for (let i = 0; i < words.length; i += 1) {
    if (words[i]?.displayParams?.hit) hitIndices.push(i);
  }

  if (!hitIndices.length) {
    return joinWords(words.slice(0, 80));
  }

  const center = hitIndices[0];
  const start = Math.max(0, center - 24);
  const end = Math.min(words.length, center + 45);
  return joinWords(words.slice(start, end));
}

function extractPrimaryYear(value) {
  const text = String(value || "");
  const match = text.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : NaN;
}

function normalizeMatchValue(raw) {
  return String(raw || "")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9-]/gi, "");
}

function commonPrefixLength(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  const max = Math.min(left.length, right.length);
  let i = 0;
  while (i < max && left[i] === right[i]) i += 1;
  return i;
}

function quoteRoughlyMatchesWord(quote, word) {
  const target = normalizeMatchValue(word);
  if (!target) return { matched: false, score: 0, mode: "none" };

  const tokens = String(quote || "").match(/[A-Za-zА-Яа-яЁё0-9-]+/gu) || [];
  for (const token of tokens) {
    const n = normalizeMatchValue(token);
    if (!n) continue;
    if (n === target) return { matched: true, score: 1, mode: "exact" };
    if (n.startsWith(target) || target.startsWith(n)) return { matched: true, score: 0.92, mode: "prefix" };
    if (commonPrefixLength(n, target) >= Math.min(4, Math.max(3, target.length - 1))) {
      return { matched: true, score: 0.82, mode: "stem" };
    }
  }
  return { matched: false, score: 0, mode: "none" };
}

function parseConcordanceCandidates(payload, word, page) {
  const candidates = [];
  if (!payload || typeof payload !== "object") return { candidates, maxPage: 1 };

  const maxPage = Number(payload?.pagination?.maxAvailablePage || payload?.pagination?.totalPageCount || 1);

  for (const group of payload.groups || []) {
    for (const doc of group.docs || []) {
      const meta = parseDocMeta(doc.info);
      const title = String(doc?.info?.title || meta.titleFallback || "Без названия");
      const author = meta.author || "Не указан";
      const yearRaw = meta.year || meta.created || "";
      const year = extractPrimaryYear(yearRaw);

      for (const snippetGroup of doc.snippetGroups || []) {
        for (const snippet of snippetGroup.snippets || []) {
          const quote = extractSnippetQuote(snippet);
          if (!quote) continue;
          const hasHit = (snippet?.sequences || []).some((sequence) =>
            (sequence?.words || []).some((w) => w?.displayParams?.hit)
          );
          const matchInfo = quoteRoughlyMatchesWord(quote, word);
          const relevanceScore = hasHit ? 1 : matchInfo.score;
          if (!hasHit && !matchInfo.matched) continue;
          if (relevanceScore < NKRY_MIN_RELEVANCE_SCORE) continue;

          candidates.push({
            quote,
            author,
            title,
            year: yearRaw,
            yearNum: Number.isFinite(year) ? year : Number.POSITIVE_INFINITY,
            sourceName: "НКРЯ",
            matchedWord: word,
            page,
            relevanceScore,
            relevanceMode: hasHit ? "hit" : matchInfo.mode,
            docId: String(
              snippet?.source?.docSource?.docId
              || doc?.info?.source?.docId
              || ""
            ),
            snippetStart: Number(snippet?.source?.start ?? NaN),
            snippetEnd: Number(snippet?.source?.end ?? NaN)
          });
        }
      }
    }
  }

  const appliedSorting = String(payload?.sorting?.currentSorting || "");
  return { candidates, maxPage, appliedSorting };
}

function pickEarliestCandidate(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return null;

  function better(left, right) {
    if (!right) return left;
    if (!left) return right;
    if (left.yearNum !== right.yearNum) return left.yearNum < right.yearNum ? left : right;
    if ((left.relevanceScore || 0) !== (right.relevanceScore || 0)) {
      return (left.relevanceScore || 0) > (right.relevanceScore || 0) ? left : right;
    }
    if ((left.page || Number.POSITIVE_INFINITY) !== (right.page || Number.POSITIVE_INFINITY)) {
      return (left.page || Number.POSITIVE_INFINITY) < (right.page || Number.POSITIVE_INFINITY) ? left : right;
    }
    return left.quote.length <= right.quote.length ? left : right;
  }

  const dedup = new Map();
  for (const candidate of candidates) {
    const hasDocFragment =
      candidate?.docId
      && Number.isFinite(candidate?.snippetStart)
      && Number.isFinite(candidate?.snippetEnd);
    const key = hasDocFragment
      ? `${candidate.docId}__${candidate.snippetStart}__${candidate.snippetEnd}`
      : `${candidate.quote}__${candidate.author}__${candidate.title}`;
    dedup.set(key, better(candidate, dedup.get(key)));
  }

  const unique = Array.from(dedup.values());
  unique.sort((a, b) => {
    if (a.yearNum !== b.yearNum) return a.yearNum - b.yearNum;
    if ((b.relevanceScore || 0) !== (a.relevanceScore || 0)) return (b.relevanceScore || 0) - (a.relevanceScore || 0);
    if (a.page !== b.page) return a.page - b.page;
    return a.quote.length - b.quote.length;
  });

  return unique[0] || null;
}

function computeYearConfidence(best, candidates, modes) {
  if (!best || !Number.isFinite(best.yearNum)) return 0;
  const sameYearCount = candidates.filter((c) => c.yearNum === best.yearNum).length;
  const hasStrictHit = candidates.some((c) => c.yearNum === best.yearNum && c.relevanceMode === "hit");
  let score = 0.5;
  if (hasStrictHit) score += 0.22;
  if (sameYearCount >= 2) score += 0.12;
  if (sameYearCount >= 4) score += 0.08;
  if ((best.relevanceScore || 0) >= 0.9) score += 0.06;
  if ((modes || []).some((m) => String(m).startsWith("form:"))) score -= 0.04;
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

function isSufficientlyEarlyYear(yearNum, strictChronology = false) {
  if (!Number.isFinite(yearNum)) return false;
  const threshold = strictChronology
    ? Math.min(NKRY_EARLY_EXIT_YEAR, NKRY_STRICT_EARLY_YEAR_TARGET)
    : NKRY_EARLY_EXIT_YEAR;
  return yearNum <= threshold;
}

function buildSpreadPages(maxAvailablePage, startPage, points) {
  const maxPage = Math.max(1, Number(maxAvailablePage || 1));
  const start = Math.max(1, Number(startPage || 1));
  const total = Math.max(0, maxPage - start + 1);
  if (total <= 0 || points <= 0) return [];

  const pageSet = new Set();
  for (let i = 0; i < points; i += 1) {
    const ratio = points === 1 ? 0 : i / (points - 1);
    const page = Math.round(start + ratio * (maxPage - start));
    if (page >= start && page <= maxPage) pageSet.add(page);
  }
  return Array.from(pageSet).sort((a, b) => a - b);
}

function buildTailPages(maxAvailablePage, tailCount) {
  const maxPage = Math.max(1, Number(maxAvailablePage || 1));
  const count = Math.max(0, Number(tailCount || 0));
  if (!count) return [];
  const start = Math.max(1, maxPage - count + 1);
  const pages = [];
  for (let page = start; page <= maxPage; page += 1) pages.push(page);
  return pages;
}

function buildOrthographyVariants(word) {
  const base = String(word || "").trim().toLowerCase();
  if (!base) return [];
  const variants = new Set([base]);
  if (/[бвгджзйклмнпрстфхцчшщ]$/i.test(base)) variants.add(`${base}ъ`);
  return Array.from(variants);
}

async function collectCandidatesForField(endpoint, authValue, word, fieldName = "lex", options = {}) {
  const budget = options.budget || null;
  const strictChronology = Boolean(options.strictChronology);
  const sorting = String(options.sorting || NKRY_SORTING);

  const firstPhaseMax = strictChronology
    ? Math.min(NKRY_FIRST_USAGE_MAX_PAGES * 2, NKRY_STRICT_MAX_PAGES)
    : NKRY_FIRST_USAGE_MAX_PAGES;
  const deepPhaseMax = strictChronology
    ? Math.min(Math.max(NKRY_DEEP_SCAN_MAX_PAGES * 2, firstPhaseMax), NKRY_STRICT_MAX_PAGES)
    : NKRY_DEEP_SCAN_MAX_PAGES;
  const spreadPoints = strictChronology
    ? Math.max(NKRY_SPREAD_SCAN_POINTS, 40)
    : NKRY_SPREAD_SCAN_POINTS;
  const tailPagesCount = strictChronology
    ? Math.max(NKRY_TAIL_SCAN_PAGES, 40)
    : NKRY_TAIL_SCAN_PAGES;

  async function fetchBudgeted(page) {
    if (isBudgetExhausted(budget)) return null;
    try {
      return await fetchNkryPage(endpoint, authValue, word, page, fieldName, budget, sorting);
    } catch (error) {
      if (error?.code === "NKRY_BUDGET_EXCEEDED") return null;
      throw error;
    }
  }

  const firstPayload = await fetchBudgeted(1);
  if (!firstPayload) {
    return {
      fieldName,
      allCandidates: [],
      best: null,
      scannedPages: 0,
      maxAvailablePage: 1,
      appliedSorting: ""
    };
  }
  const parsedFirst = parseConcordanceCandidates(firstPayload, word, 1);

  const maxAvailablePage = Math.max(1, Number(parsedFirst.maxPage || 1));
  const isHighFrequencyWord = !strictChronology && maxAvailablePage >= NKRY_HIGH_FREQ_PAGE_THRESHOLD;
  const tunedSpreadPoints = isHighFrequencyWord
    ? Math.min(spreadPoints, NKRY_HIGH_FREQ_SPREAD_SCAN_POINTS)
    : spreadPoints;
  const tunedTailPagesCount = isHighFrequencyWord
    ? Math.min(tailPagesCount, NKRY_HIGH_FREQ_TAIL_SCAN_PAGES)
    : tailPagesCount;
  const phaseOneMaxPage = Math.max(1, Math.min(maxAvailablePage, firstPhaseMax));

  let allCandidates = [...parsedFirst.candidates];
  let scannedPages = 1;
  const scannedPageSet = new Set([1]);
  let emptyStreak = parsedFirst.candidates.length ? 0 : 1;

  for (let page = 2; page <= phaseOneMaxPage; page += 1) {
    try {
      const payload = await fetchBudgeted(page);
      if (!payload) break;
      const parsed = parseConcordanceCandidates(payload, word, page);
      allCandidates = allCandidates.concat(parsed.candidates);
      scannedPages += 1;
      scannedPageSet.add(page);
      if (parsed.candidates.length) {
        emptyStreak = 0;
      } else if (!allCandidates.length) {
        emptyStreak += 1;
      }
      if (!allCandidates.length && emptyStreak >= NKRY_EMPTY_SCAN_STOP_PAGES) break;
      const maybeBest = pickEarliestCandidate(allCandidates);
      if (maybeBest && isSufficientlyEarlyYear(maybeBest.yearNum, strictChronology)) {
        return {
          fieldName,
          allCandidates,
          best: maybeBest,
          scannedPages,
          maxAvailablePage,
          appliedSorting: parsedFirst.appliedSorting || ""
        };
      }
    } catch {
      // keep successful pages only
    }
  }

  let best = pickEarliestCandidate(allCandidates);
  const shouldDeepScan =
    (!best || !Number.isFinite(best.yearNum) || best.yearNum > NKRY_DEEP_SCAN_YEAR_THRESHOLD)
    && phaseOneMaxPage < maxAvailablePage;

  if (shouldDeepScan) {
    const deepPhaseCap = isHighFrequencyWord
      ? Math.min(deepPhaseMax, NKRY_HIGH_FREQ_DEEP_SCAN_MAX_PAGES)
      : deepPhaseMax;
    const phaseTwoMaxPage = Math.max(phaseOneMaxPage, Math.min(maxAvailablePage, deepPhaseCap));
    for (let page = phaseOneMaxPage + 1; page <= phaseTwoMaxPage; page += 1) {
      try {
        const payload = await fetchBudgeted(page);
        if (!payload) break;
        const parsed = parseConcordanceCandidates(payload, word, page);
        allCandidates = allCandidates.concat(parsed.candidates);
        scannedPages += 1;
        scannedPageSet.add(page);
        if (parsed.candidates.length) {
          emptyStreak = 0;
        } else if (!allCandidates.length) {
          emptyStreak += 1;
        }
        if (!allCandidates.length && emptyStreak >= NKRY_EMPTY_SCAN_STOP_PAGES) break;
        const maybeBest = pickEarliestCandidate(allCandidates);
        if (maybeBest && isSufficientlyEarlyYear(maybeBest.yearNum, strictChronology)) {
          return {
            fieldName,
            allCandidates,
            best: maybeBest,
            scannedPages,
            maxAvailablePage,
            appliedSorting: parsedFirst.appliedSorting || ""
          };
        }
      } catch {
        // ignore failed deep pages
      }
    }
    best = pickEarliestCandidate(allCandidates);

    const shouldSpreadScan =
      (!best || !Number.isFinite(best.yearNum) || best.yearNum > NKRY_DEEP_SCAN_YEAR_THRESHOLD)
      && phaseTwoMaxPage < maxAvailablePage;
    if (shouldSpreadScan) {
      const spreadPages = buildSpreadPages(maxAvailablePage, phaseTwoMaxPage + 1, tunedSpreadPoints);
      for (const page of spreadPages) {
        if (scannedPageSet.has(page)) continue;
        try {
          const payload = await fetchBudgeted(page);
          if (!payload) break;
          const parsed = parseConcordanceCandidates(payload, word, page);
          allCandidates = allCandidates.concat(parsed.candidates);
          scannedPages += 1;
          scannedPageSet.add(page);
          if (parsed.candidates.length) {
            emptyStreak = 0;
          } else if (!allCandidates.length) {
            emptyStreak += 1;
          }
          if (!allCandidates.length && emptyStreak >= NKRY_EMPTY_SCAN_STOP_PAGES) break;
          const maybeBest = pickEarliestCandidate(allCandidates);
          if (maybeBest && isSufficientlyEarlyYear(maybeBest.yearNum, strictChronology)) {
            return {
              fieldName,
              allCandidates,
              best: maybeBest,
              scannedPages,
              maxAvailablePage,
              appliedSorting: parsedFirst.appliedSorting || ""
            };
          }
        } catch {
          // ignore failed sampled pages
        }
      }
      best = pickEarliestCandidate(allCandidates);
    }
  }

  if (maxAvailablePage > 1) {
    const tailPages = buildTailPages(maxAvailablePage, tunedTailPagesCount);
    for (const page of tailPages) {
      if (scannedPageSet.has(page)) continue;
      try {
        const payload = await fetchBudgeted(page);
        if (!payload) break;
        const parsed = parseConcordanceCandidates(payload, word, page);
        allCandidates = allCandidates.concat(parsed.candidates);
        scannedPages += 1;
        scannedPageSet.add(page);
        if (parsed.candidates.length) {
          emptyStreak = 0;
        } else if (!allCandidates.length) {
          emptyStreak += 1;
        }
        if (!allCandidates.length && emptyStreak >= NKRY_EMPTY_SCAN_STOP_PAGES) break;
        const maybeBest = pickEarliestCandidate(allCandidates);
        if (maybeBest && isSufficientlyEarlyYear(maybeBest.yearNum, strictChronology)) {
          return {
            fieldName,
            allCandidates,
            best: maybeBest,
            scannedPages,
            maxAvailablePage,
            appliedSorting: parsedFirst.appliedSorting || ""
          };
        }
      } catch {
        // ignore failed tail pages
      }
    }
    best = pickEarliestCandidate(allCandidates);
  }

  if (
    strictChronology
    && maxAvailablePage > 1
    && best
    && Number.isFinite(best.yearNum)
    && best.yearNum > NKRY_STRICT_EARLY_YEAR_TARGET
  ) {
    const strictEndPage = Math.max(1, Math.min(maxAvailablePage, NKRY_STRICT_MAX_PAGES));
    for (let page = 2; page <= strictEndPage; page += 1) {
      if (scannedPageSet.has(page)) continue;
      try {
        const payload = await fetchBudgeted(page);
        if (!payload) break;
        const parsed = parseConcordanceCandidates(payload, word, page);
        allCandidates = allCandidates.concat(parsed.candidates);
        scannedPages += 1;
        scannedPageSet.add(page);
        if (parsed.candidates.length) {
          emptyStreak = 0;
        } else if (!allCandidates.length) {
          emptyStreak += 1;
        }
        if (!allCandidates.length && emptyStreak >= NKRY_EMPTY_SCAN_STOP_PAGES) break;
        const maybeBest = pickEarliestCandidate(allCandidates);
        if (maybeBest && isSufficientlyEarlyYear(maybeBest.yearNum, true)) {
          return {
            fieldName,
            allCandidates,
            best: maybeBest,
            scannedPages,
            maxAvailablePage,
            appliedSorting: parsedFirst.appliedSorting || ""
          };
        }
      } catch {
        // ignore failed strict-scan pages
      }
    }
    best = pickEarliestCandidate(allCandidates);
  }

  return {
    fieldName,
    allCandidates,
    best,
    scannedPages,
    maxAvailablePage,
    isHighFrequencyWord,
    appliedSorting: parsedFirst.appliedSorting || ""
  };
}

function alternateChronologySorting(sorting) {
  const current = String(sorting || "").trim();
  if (current === "grcreated") return "grcreated_inv";
  if (current === "grcreated_inv") return "grcreated";
  return "";
}

async function findFirstUsage(word, options = {}) {
  const endpoint = new URL(String(NKRY_SEARCH_PATH || "").replace(/^\/+/, ""), NKRY_API_BASE_URL).toString();
  const authValue = NKRY_API_AUTH_PREFIX ? `${NKRY_API_AUTH_PREFIX} ${NKRY_API_KEY}` : NKRY_API_KEY;
  const strictChronology = options.strictChronology ?? NKRY_STRICT_CHRONOLOGY_DEFAULT;
  const baseSorting = String(options.sorting || NKRY_SORTING);
  const budget = createRequestBudget(strictChronology);

  const lexProbe = await collectCandidatesForField(endpoint, authValue, word, "lex", {
    budget,
    strictChronology,
    sorting: baseSorting
  });
  let combinedCandidates = [...lexProbe.allCandidates];
  let scannedPages = lexProbe.scannedPages;
  let appliedSorting = lexProbe.appliedSorting;
  const modes = ["lex"];
  let highFrequencyTuned = Boolean(lexProbe.isHighFrequencyWord);
  let earlyExited = Boolean(lexProbe.best && isSufficientlyEarlyYear(lexProbe.best.yearNum, strictChronology));

  const shouldProbeForm =
    !earlyExited
    && NKRY_USE_FORM_FALLBACK
    && (!lexProbe.best || !Number.isFinite(lexProbe.best.yearNum) || lexProbe.best.yearNum > NKRY_DEEP_SCAN_YEAR_THRESHOLD);
  if (shouldProbeForm) {
    try {
      const formProbe = await collectCandidatesForField(endpoint, authValue, word, "form", {
        budget,
        strictChronology,
        sorting: baseSorting
      });
      combinedCandidates = combinedCandidates.concat(formProbe.allCandidates);
      scannedPages += formProbe.scannedPages;
      if (!appliedSorting) appliedSorting = formProbe.appliedSorting;
      modes.push("form");
      highFrequencyTuned = highFrequencyTuned || Boolean(formProbe.isHighFrequencyWord);
      const maybeBest = pickEarliestCandidate(combinedCandidates);
      earlyExited = Boolean(maybeBest && isSufficientlyEarlyYear(maybeBest.yearNum, strictChronology));
    } catch {
      // keep lex results if form query failed
    }
  }

  if (NKRY_USE_OLD_ORTHO_VARIANTS && shouldProbeForm && !earlyExited) {
    const variants = buildOrthographyVariants(word).filter((v) => v !== word);
    for (const variant of variants) {
      if (earlyExited || isBudgetExhausted(budget)) break;
      try {
        const variantProbe = await collectCandidatesForField(endpoint, authValue, variant, "form", {
          budget,
          strictChronology,
          sorting: baseSorting
        });
        combinedCandidates = combinedCandidates.concat(variantProbe.allCandidates);
        scannedPages += variantProbe.scannedPages;
        if (!appliedSorting) appliedSorting = variantProbe.appliedSorting;
        modes.push(`form:${variant}`);
        highFrequencyTuned = highFrequencyTuned || Boolean(variantProbe.isHighFrequencyWord);
        const maybeBest = pickEarliestCandidate(combinedCandidates);
        earlyExited = Boolean(maybeBest && isSufficientlyEarlyYear(maybeBest.yearNum, strictChronology));
      } catch {
        // keep other probes if a single variant fails
      }
    }
  }

  let allCandidates = combinedCandidates;
  let best = pickEarliestCandidate(allCandidates);
  const triedSortings = [baseSorting];
  let switchedSorting = false;

  const altSorting = alternateChronologySorting(baseSorting);
  if (
    strictChronology
    && altSorting
    && best
    && Number.isFinite(best.yearNum)
    && best.yearNum > NKRY_STRICT_EARLY_YEAR_TARGET
  ) {
    const altBudget = createRequestBudget(true);
    const altLexProbe = await collectCandidatesForField(endpoint, authValue, word, "lex", {
      budget: altBudget,
      strictChronology: true,
      sorting: altSorting
    });
    const altCandidates = [...altLexProbe.allCandidates];
    let altScannedPages = altLexProbe.scannedPages;

    if (NKRY_USE_FORM_FALLBACK) {
      try {
        const altFormProbe = await collectCandidatesForField(endpoint, authValue, word, "form", {
          budget: altBudget,
          strictChronology: true,
          sorting: altSorting
        });
        altCandidates.push(...altFormProbe.allCandidates);
        altScannedPages += altFormProbe.scannedPages;
      } catch {
        // preserve alt lex results
      }
    }

    const altBest = pickEarliestCandidate(altCandidates);
    if (altBest && (!best || altBest.yearNum < best.yearNum)) {
      allCandidates = allCandidates.concat(altCandidates);
      best = altBest;
      scannedPages += altScannedPages;
      if (!appliedSorting) appliedSorting = altLexProbe.appliedSorting;
      switchedSorting = true;
    }
    triedSortings.push(altSorting);
  }

  const yearConfidence = computeYearConfidence(best, allCandidates, modes);

  if (!best) return null;

  return {
    quote: best.quote,
    author: best.author,
    title: best.title,
    year: best.year,
    sourceName: best.sourceName,
    meta: {
      matchedWord: word,
      pagesScanned: scannedPages,
      scannedPages,
      candidates: allCandidates.length,
      chosenPage: best.page,
      chosenYear: Number.isFinite(best.yearNum) ? best.yearNum : null,
      sortingRequested: baseSorting,
      sortingApplied: appliedSorting || "",
      triedSortings,
      switchedSorting,
      searchModes: modes,
      strictChronology,
      highFrequencyTuned,
      budgetMaxPages: budget.maxPages,
      budgetMaxMs: budget.maxMs,
      budgetUsedPages: budget.pagesUsed,
      budgetStopReason: budget.stopReason || "",
      earlyExitYear: NKRY_EARLY_EXIT_YEAR,
      earlyExited,
      yearConfidence,
      relevanceThreshold: NKRY_MIN_RELEVANCE_SCORE,
      chosenRelevanceScore: Number(best.relevanceScore || 0),
      chosenRelevanceMode: String(best.relevanceMode || "")
    }
  };
}

function cacheKey(word, strictChronology = NKRY_STRICT_CHRONOLOGY_DEFAULT) {
  return `${NKRY_ALGO_REVISION}|${NKRY_CORPUS_TYPE}|${NKRY_SORTING}|${strictChronology ? "strict" : "normal"}|${word}`;
}

function getFromCache(map, key, allowStale = false) {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt && !allowStale) {
    map.delete(key);
    return null;
  }
  return hit.value;
}

function setToCache(map, key, value, ttlMs, maxEntries = NKRY_CACHE_MAX_ENTRIES) {
  if (map.size >= maxEntries) {
    const firstKey = map.keys().next().value;
    if (firstKey) map.delete(firstKey);
  }
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function getFreshCached(key) {
  return getFromCache(freshCache, key, false);
}

function getStaleCached(key) {
  return getFromCache(staleCache, key, false);
}

function setCached(key, value) {
  setToCache(freshCache, key, value, NKRY_CACHE_TTL_MS);
  setToCache(staleCache, key, value, NKRY_CACHE_STALE_TTL_MS);
}

function markWordRequested(word) {
  const key = normalizeWord(word);
  if (!key) return;
  const prev = requestWordStats.get(key) || 0;
  requestWordStats.set(key, prev + 1);
}

function getWarmWords() {
  return Array.from(requestWordStats.entries())
    .filter(([, count]) => count >= NKRY_WARM_CACHE_MIN_HITS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, NKRY_WARM_CACHE_TOP_WORDS)
    .map(([word]) => word);
}

async function runWarmCachePass() {
  if (!NKRY_WARM_CACHE_ENABLED || warmCacheRunning) return;
  if (!NKRY_API_BASE_URL || !NKRY_SEARCH_PATH || !NKRY_API_KEY) return;
  if (Date.now() < nkryCooldownUntil) return;

  const words = getWarmWords();
  if (!words.length) return;

  warmCacheRunning = true;
  try {
    for (const word of words) {
      if (Date.now() < nkryCooldownUntil) break;
      const key = cacheKey(word, NKRY_STRICT_CHRONOLOGY_DEFAULT);
      if (getFreshCached(key)) continue;
      try {
        const result = await findFirstUsage(word, { strictChronology: NKRY_STRICT_CHRONOLOGY_DEFAULT });
        if (result) setCached(key, result);
      } catch {
        // warm-cache is best-effort only
      }
    }
  } finally {
    warmCacheRunning = false;
  }
}

async function handleNkrySearch(req, res) {
  const reqId = req.__reqId || "";
  if (!NKRY_API_BASE_URL || !NKRY_SEARCH_PATH || !NKRY_API_KEY) {
    logEvent("nkry.search.unconfigured", { reqId }, "warn");
    sendJson(res, 503, {
      error: "НКРЯ не настроен на сервере. Задайте NKRY_API_BASE_URL, NKRY_SEARCH_PATH и NKRY_API_KEY."
    });
    return;
  }

  let body;
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    if (error?.message === "payload_too_large") {
      logEvent("nkry.search.payload_too_large", { reqId }, "warn");
      sendJson(res, 413, { error: "Слишком большой JSON в запросе." });
      return;
    }
    logEvent("nkry.search.bad_json", { reqId }, "warn");
    sendJson(res, 400, { error: "Некорректный JSON в запросе." });
    return;
  }

  const validation = validateOneWord(body.word);
  if (!validation.ok) {
    logEvent("nkry.search.bad_input", { reqId, reason: validation.reason }, "warn");
    sendJson(res, 400, { error: validation.reason });
    return;
  }
  markWordRequested(validation.value);

  const strictChronology = body?.strictChronology ?? NKRY_STRICT_CHRONOLOGY_DEFAULT;

  try {
    const key = cacheKey(validation.value, strictChronology);
    const cached = getFreshCached(key);
    const result = cached || await findFirstUsage(validation.value, { strictChronology });
    if (!result) {
      sendJson(res, 404, {
        error: `Для слова «${validation.value}» в выбранном корпусе не найдено цитат.`
      });
      return;
    }
    if (!cached) setCached(key, result);
    logEvent("nkry.search.success", {
      reqId,
      word: validation.value,
      strictChronology,
      cached: Boolean(cached),
      chosenYear: result?.meta?.chosenYear ?? null,
      pagesScanned: result?.meta?.pagesScanned ?? null
    });

    sendJson(res, 200, {
      quote: {
        quote: result.quote,
        author: result.author,
        title: result.title,
        year: result.year,
        sourceName: result.sourceName
      },
      explain: "Показано самое раннее найденное употребление слова в НКРЯ (по доступным страницам выдачи).",
      meta: result.meta
    });
  } catch (error) {
    if (error?.code === "NKRY_RATE_LIMIT") {
      const key = cacheKey(validation.value, strictChronology);
      const stale = getStaleCached(key);
      if (stale) {
        logEvent("nkry.search.rate_limited_cache_fallback", {
          reqId,
          word: validation.value,
          retryAfterSec: error?.retryAfterSec || null
        }, "warn");
        sendJson(res, 200, {
          quote: {
            quote: stale.quote,
            author: stale.author,
            title: stale.title,
            year: stale.year,
            sourceName: stale.sourceName
          },
          explain: "Показано сохраненное значение из кэша: НКРЯ временно ограничил частоту запросов.",
          meta: {
            ...(stale.meta || {}),
            cached: true,
            stale: true,
            rateLimited: true,
            retryAfterSec: error?.retryAfterSec || null
          }
        });
        return;
      }

      logEvent("nkry.search.rate_limited", {
        reqId,
        word: validation.value,
        retryAfterSec: error?.retryAfterSec || null
      }, "warn");
      sendJson(res, 429, {
        error: `НКРЯ временно ограничил частоту запросов. Подождите ${error?.retryAfterSec || 10} сек и повторите.`,
        retryAfterSec: error?.retryAfterSec || 10
      });
      return;
    }
    logEvent("nkry.search.error", {
      reqId,
      word: validation.value,
      message: String(error?.message || "unknown")
    }, "error");
    sendJson(res, 502, {
      error: `Ошибка обращения к НКРЯ: ${error?.message || "неизвестная ошибка"}`
    });
  }
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

function serveStatic(req, res) {
  const requestPath = req.url?.split("?")[0] || "/";
  const filePath = getStaticPath(requestPath);

  if (!filePath || !filePath.startsWith(__dirname) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
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
  const reqId = `${Date.now().toString(36)}-${(requestSeq += 1).toString(36)}`;
  req.__reqId = reqId;
  const startedAt = Date.now();
  res.once("finish", () => {
    logEvent("http.request.completed", {
      reqId,
      method: req.method,
      path: req.url?.split("?")[0] || "",
      status: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });

  try {
    if (req.method === "POST" && req.url === "/api/nkry/search") {
      await handleNkrySearch(req, res);
      return;
    }

    if (req.method === "GET" && req.url === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        now: new Date().toISOString(),
        uptimeSec: Math.floor((Date.now() - processStartedAt) / 1000),
        corpus: NKRY_CORPUS_TYPE,
        build: {
          version: APP_VERSION,
          commit: APP_COMMIT,
          builtAt: APP_BUILD_TIME
        }
      });
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: "Внутренняя ошибка сервера." });
  }
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (NKRY_WARM_CACHE_ENABLED) {
    setInterval(() => {
      runWarmCachePass().catch(() => {});
    }, NKRY_WARM_CACHE_INTERVAL_MS).unref();
  }

  server.listen(PORT, HOST, () => {
    logEvent("server.started", {
      url: `http://${HOST}:${PORT}`,
      build: {
        version: APP_VERSION,
        commit: APP_COMMIT,
        builtAt: APP_BUILD_TIME
      },
      governor: {
        retries: NKRY_FETCH_RETRIES,
        backoffMs: NKRY_FETCH_BACKOFF_MS,
        jitterMs: NKRY_FETCH_BACKOFF_JITTER_MS,
        cooldownMinSec: NKRY_RATE_LIMIT_COOLDOWN_MIN_SEC,
        cooldownMaxSec: NKRY_RATE_LIMIT_COOLDOWN_MAX_SEC
      },
      budget: {
        maxPages: NKRY_MAX_TOTAL_PAGES,
        maxMs: NKRY_MAX_TOTAL_MS,
        strictMaxPages: NKRY_STRICT_MAX_TOTAL_PAGES,
        strictMaxMs: NKRY_STRICT_MAX_TOTAL_MS,
        earlyExitYear: NKRY_EARLY_EXIT_YEAR,
        emptyScanStopPages: NKRY_EMPTY_SCAN_STOP_PAGES
      },
      highFrequencyTuning: {
        pageThreshold: NKRY_HIGH_FREQ_PAGE_THRESHOLD,
        deepScanMaxPages: NKRY_HIGH_FREQ_DEEP_SCAN_MAX_PAGES,
        spreadScanPoints: NKRY_HIGH_FREQ_SPREAD_SCAN_POINTS,
        tailScanPages: NKRY_HIGH_FREQ_TAIL_SCAN_PAGES
      },
      cache: {
        freshMs: NKRY_CACHE_TTL_MS,
        staleMs: NKRY_CACHE_STALE_TTL_MS,
        entries: NKRY_CACHE_MAX_ENTRIES,
        pageFreshMs: NKRY_PAGE_CACHE_TTL_MS,
        pageStaleMs: NKRY_PAGE_CACHE_STALE_TTL_MS,
        pageEntries: NKRY_PAGE_CACHE_MAX_ENTRIES
      },
      warmCache: NKRY_WARM_CACHE_ENABLED ? `on/${NKRY_WARM_CACHE_INTERVAL_MS}ms` : "off"
    });
  });
}

export {
  parseConcordanceCandidates,
  pickEarliestCandidate,
  computeYearConfidence,
  validateOneWord
};
