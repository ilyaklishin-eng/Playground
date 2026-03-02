import http from "node:http";
import path from "node:path";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const NKRY_API_BASE_URL = process.env.NKRY_API_BASE_URL || "https://ruscorpora.ru/api/v1/";
const NKRY_SEARCH_PATH = process.env.NKRY_SEARCH_PATH || "lex-gramm/concordance";
const NKRY_API_KEY = process.env.NKRY_API_KEY || "";
const NKRY_API_KEY_HEADER = process.env.NKRY_API_KEY_HEADER || "Authorization";
const NKRY_API_AUTH_PREFIX = process.env.NKRY_API_AUTH_PREFIX || "Bearer";
const NKRY_CORPUS_TYPE = process.env.NKRY_CORPUS_TYPE || "MAIN";
const NKRY_SORTING = process.env.NKRY_SORTING || "grcreated";
const NKRY_FETCH_TIMEOUT_MS = clampInt(process.env.NKRY_FETCH_TIMEOUT_MS, 9000, 1500, 30000);
const NKRY_FETCH_RETRIES = clampInt(process.env.NKRY_FETCH_RETRIES, 2, 0, 6);
const NKRY_FETCH_BACKOFF_MS = clampInt(process.env.NKRY_FETCH_BACKOFF_MS, 280, 60, 3000);
const NKRY_FIRST_USAGE_MAX_PAGES = clampInt(process.env.NKRY_FIRST_USAGE_MAX_PAGES, 12, 1, 60);
const NKRY_DEEP_SCAN_MAX_PAGES = clampInt(process.env.NKRY_DEEP_SCAN_MAX_PAGES, 42, 1, 200);
const NKRY_DEEP_SCAN_YEAR_THRESHOLD = clampInt(process.env.NKRY_DEEP_SCAN_YEAR_THRESHOLD, 1900, 1600, 2100);
const NKRY_SPREAD_SCAN_POINTS = clampInt(process.env.NKRY_SPREAD_SCAN_POINTS, 18, 0, 120);
const NKRY_TAIL_SCAN_PAGES = clampInt(process.env.NKRY_TAIL_SCAN_PAGES, 28, 0, 120);
const NKRY_MAX_TOTAL_PAGES = clampInt(process.env.NKRY_MAX_TOTAL_PAGES, 96, 8, 400);
const NKRY_MAX_TOTAL_MS = clampInt(process.env.NKRY_MAX_TOTAL_MS, 18000, 3000, 60000);
const NKRY_CACHE_TTL_MS = clampInt(process.env.NKRY_CACHE_TTL_MS, 5 * 60 * 1000, 1000, 60 * 60 * 1000);
const NKRY_CACHE_MAX_ENTRIES = clampInt(process.env.NKRY_CACHE_MAX_ENTRIES, 300, 20, 2000);
const NKRY_USE_FORM_FALLBACK = process.env.NKRY_USE_FORM_FALLBACK !== "0";
const NKRY_USE_OLD_ORTHO_VARIANTS = process.env.NKRY_USE_OLD_ORTHO_VARIANTS !== "0";
const NKRY_MIN_RELEVANCE_SCORE = Math.max(
  0,
  Math.min(1, Number(process.env.NKRY_MIN_RELEVANCE_SCORE || 0.72))
);
const queryCache = new Map();
let nkryCooldownUntil = 0;

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

function withPage(endpoint, page) {
  const url = new URL(endpoint);
  url.searchParams.set("page", String(page));
  if (NKRY_SORTING) url.searchParams.set("sorting", NKRY_SORTING);
  return url.toString();
}

async function fetchNkryPage(endpoint, authValue, word, page = 1, fieldName = "lex") {
  let lastError = null;
  const pageEndpoint = withPage(endpoint, page);
  if (Date.now() < nkryCooldownUntil) {
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
          const cooldownSec = Math.max(6, retryAfterSec || 0);
          nkryCooldownUntil = Date.now() + cooldownSec * 1000;
          err.code = "NKRY_RATE_LIMIT";
          err.retryAfterSec = cooldownSec;
        }
        const retriable = response.status === 429 || response.status >= 500;
        if (!retriable || attempt >= NKRY_FETCH_RETRIES) throw err;
        lastError = err;
      } else {
        return response.json();
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

    await sleep(NKRY_FETCH_BACKOFF_MS * (attempt + 1));
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
            relevanceMode: hasHit ? "hit" : matchInfo.mode
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

  const dedup = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.quote}__${candidate.author}__${candidate.title}`;
    if (!dedup.has(key)) dedup.set(key, candidate);
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
  const deadlineAt = Number(options.deadlineAt || Number.POSITIVE_INFINITY);
  const budget = options.budget || null;

  async function fetchBudgeted(page) {
    if (Date.now() > deadlineAt) return null;
    if (budget && budget.remaining <= 0) return null;
    if (budget) budget.remaining -= 1;
    return fetchNkryPage(endpoint, authValue, word, page, fieldName);
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
  const phaseOneMaxPage = Math.max(1, Math.min(maxAvailablePage, NKRY_FIRST_USAGE_MAX_PAGES));

  let allCandidates = [...parsedFirst.candidates];
  let scannedPages = 1;
  const scannedPageSet = new Set([1]);

  for (let page = 2; page <= phaseOneMaxPage; page += 1) {
    try {
      const payload = await fetchBudgeted(page);
      if (!payload) break;
      const parsed = parseConcordanceCandidates(payload, word, page);
      allCandidates = allCandidates.concat(parsed.candidates);
      scannedPages += 1;
      scannedPageSet.add(page);
    } catch {
      // keep successful pages only
    }
  }

  let best = pickEarliestCandidate(allCandidates);
  const shouldDeepScan =
    (!best || !Number.isFinite(best.yearNum) || best.yearNum > NKRY_DEEP_SCAN_YEAR_THRESHOLD)
    && phaseOneMaxPage < maxAvailablePage;

  if (shouldDeepScan) {
    const phaseTwoMaxPage = Math.max(phaseOneMaxPage, Math.min(maxAvailablePage, NKRY_DEEP_SCAN_MAX_PAGES));
    for (let page = phaseOneMaxPage + 1; page <= phaseTwoMaxPage; page += 1) {
      try {
        const payload = await fetchBudgeted(page);
        if (!payload) break;
        const parsed = parseConcordanceCandidates(payload, word, page);
        allCandidates = allCandidates.concat(parsed.candidates);
        scannedPages += 1;
        scannedPageSet.add(page);
      } catch {
        // ignore failed deep pages
      }
    }
    best = pickEarliestCandidate(allCandidates);

    const shouldSpreadScan =
      (!best || !Number.isFinite(best.yearNum) || best.yearNum > NKRY_DEEP_SCAN_YEAR_THRESHOLD)
      && phaseTwoMaxPage < maxAvailablePage;
    if (shouldSpreadScan) {
      const spreadPages = buildSpreadPages(maxAvailablePage, phaseTwoMaxPage + 1, NKRY_SPREAD_SCAN_POINTS);
      for (const page of spreadPages) {
        if (scannedPageSet.has(page)) continue;
        try {
          const payload = await fetchBudgeted(page);
          if (!payload) break;
          const parsed = parseConcordanceCandidates(payload, word, page);
          allCandidates = allCandidates.concat(parsed.candidates);
          scannedPages += 1;
          scannedPageSet.add(page);
        } catch {
          // ignore failed sampled pages
        }
      }
      best = pickEarliestCandidate(allCandidates);
    }
  }

  if (maxAvailablePage > 1) {
    const tailPages = buildTailPages(maxAvailablePage, NKRY_TAIL_SCAN_PAGES);
    for (const page of tailPages) {
      if (scannedPageSet.has(page)) continue;
      try {
        const payload = await fetchBudgeted(page);
        if (!payload) break;
        const parsed = parseConcordanceCandidates(payload, word, page);
        allCandidates = allCandidates.concat(parsed.candidates);
        scannedPages += 1;
        scannedPageSet.add(page);
      } catch {
        // ignore failed tail pages
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
    appliedSorting: parsedFirst.appliedSorting || ""
  };
}

async function findFirstUsage(word) {
  const endpoint = new URL(String(NKRY_SEARCH_PATH || "").replace(/^\/+/, ""), NKRY_API_BASE_URL).toString();
  const authValue = NKRY_API_AUTH_PREFIX ? `${NKRY_API_AUTH_PREFIX} ${NKRY_API_KEY}` : NKRY_API_KEY;
  const budget = { remaining: NKRY_MAX_TOTAL_PAGES };
  const deadlineAt = Date.now() + NKRY_MAX_TOTAL_MS;

  const lexProbe = await collectCandidatesForField(endpoint, authValue, word, "lex", { deadlineAt, budget });
  let combinedCandidates = [...lexProbe.allCandidates];
  let scannedPages = lexProbe.scannedPages;
  let appliedSorting = lexProbe.appliedSorting;
  const modes = ["lex"];

  const shouldProbeForm =
    NKRY_USE_FORM_FALLBACK
    && (!lexProbe.best || !Number.isFinite(lexProbe.best.yearNum) || lexProbe.best.yearNum > NKRY_DEEP_SCAN_YEAR_THRESHOLD);
  if (shouldProbeForm) {
    try {
      const formProbe = await collectCandidatesForField(endpoint, authValue, word, "form", { deadlineAt, budget });
      combinedCandidates = combinedCandidates.concat(formProbe.allCandidates);
      scannedPages += formProbe.scannedPages;
      if (!appliedSorting) appliedSorting = formProbe.appliedSorting;
      modes.push("form");
    } catch {
      // keep lex results if form query failed
    }
  }

  if (NKRY_USE_OLD_ORTHO_VARIANTS && shouldProbeForm) {
    const variants = buildOrthographyVariants(word).filter((v) => v !== word);
    for (const variant of variants) {
      try {
        const variantProbe = await collectCandidatesForField(endpoint, authValue, variant, "form", { deadlineAt, budget });
        combinedCandidates = combinedCandidates.concat(variantProbe.allCandidates);
        scannedPages += variantProbe.scannedPages;
        if (!appliedSorting) appliedSorting = variantProbe.appliedSorting;
        modes.push(`form:${variant}`);
      } catch {
        // keep other probes if a single variant fails
      }
    }
  }

  const allCandidates = combinedCandidates;
  const best = pickEarliestCandidate(allCandidates);
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
      sortingRequested: NKRY_SORTING,
      sortingApplied: appliedSorting || "",
      searchModes: modes,
      yearConfidence,
      relevanceThreshold: NKRY_MIN_RELEVANCE_SCORE,
      chosenRelevanceScore: Number(best.relevanceScore || 0),
      chosenRelevanceMode: String(best.relevanceMode || "")
    }
  };
}

function cacheKey(word) {
  return `${NKRY_CORPUS_TYPE}|${NKRY_SORTING}|${word}`;
}

function getCached(key, allowStale = false) {
  const hit = queryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt && !allowStale) {
    queryCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value) {
  if (queryCache.size >= NKRY_CACHE_MAX_ENTRIES) {
    const firstKey = queryCache.keys().next().value;
    if (firstKey) queryCache.delete(firstKey);
  }
  queryCache.set(key, { value, expiresAt: Date.now() + NKRY_CACHE_TTL_MS });
}

async function handleNkrySearch(req, res) {
  if (!NKRY_API_BASE_URL || !NKRY_SEARCH_PATH || !NKRY_API_KEY) {
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
      sendJson(res, 413, { error: "Слишком большой JSON в запросе." });
      return;
    }
    sendJson(res, 400, { error: "Некорректный JSON в запросе." });
    return;
  }

  const validation = validateOneWord(body.word);
  if (!validation.ok) {
    sendJson(res, 400, { error: validation.reason });
    return;
  }

  try {
    const key = cacheKey(validation.value);
    const cached = getCached(key);
    const result = cached || await findFirstUsage(validation.value);
    if (!result) {
      sendJson(res, 404, {
        error: `Для слова «${validation.value}» в выбранном корпусе не найдено цитат.`
      });
      return;
    }
    if (!cached) setCached(key, result);

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
      const key = cacheKey(validation.value);
      const stale = getCached(key, true);
      if (stale) {
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

      sendJson(res, 429, {
        error: `НКРЯ временно ограничил частоту запросов. Подождите ${error?.retryAfterSec || 10} сек и повторите.`
      });
      return;
    }
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
  try {
    if (req.method === "POST" && req.url === "/api/nkry/search") {
      await handleNkrySearch(req, res);
      return;
    }

    if (req.method === "GET" && req.url === "/api/health") {
      sendJson(res, 200, { ok: true, corpus: NKRY_CORPUS_TYPE, now: new Date().toISOString() });
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

server.listen(PORT, HOST, () => {
  console.log(`Server started: http://${HOST}:${PORT}`);
});
