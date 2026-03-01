import http from "node:http";
import path from "node:path";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
const NKRY_FETCH_TIMEOUT_MS = Number(process.env.NKRY_FETCH_TIMEOUT_MS || 9000);
const NKRY_FETCH_RETRIES = Number(process.env.NKRY_FETCH_RETRIES || 2);
const NKRY_FETCH_BACKOFF_MS = Number(process.env.NKRY_FETCH_BACKOFF_MS || 280);
const NKRY_FIRST_USAGE_MAX_PAGES = Number(process.env.NKRY_FIRST_USAGE_MAX_PAGES || 12);
const NKRY_DEEP_SCAN_MAX_PAGES = Number(process.env.NKRY_DEEP_SCAN_MAX_PAGES || 42);
const NKRY_DEEP_SCAN_YEAR_THRESHOLD = Number(process.env.NKRY_DEEP_SCAN_YEAR_THRESHOLD || 1900);

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

function buildNkryPayload(word) {
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

async function fetchNkryPage(endpoint, authValue, word, page = 1) {
  let lastError = null;
  const pageEndpoint = withPage(endpoint, page);

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
        body: JSON.stringify(buildNkryPayload(word)),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        const err = new Error(`НКРЯ API вернул статус ${response.status}: ${text.slice(0, 250)}`);
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

          candidates.push({
            quote,
            author,
            title,
            year: yearRaw,
            yearNum: Number.isFinite(year) ? year : Number.POSITIVE_INFINITY,
            sourceName: "НКРЯ",
            matchedWord: word,
            page
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
    if (a.page !== b.page) return a.page - b.page;
    return a.quote.length - b.quote.length;
  });

  return unique[0] || null;
}

async function findFirstUsage(word) {
  const endpoint = new URL(String(NKRY_SEARCH_PATH || "").replace(/^\/+/, ""), NKRY_API_BASE_URL).toString();
  const authValue = NKRY_API_AUTH_PREFIX ? `${NKRY_API_AUTH_PREFIX} ${NKRY_API_KEY}` : NKRY_API_KEY;

  const firstPayload = await fetchNkryPage(endpoint, authValue, word, 1);
  const parsedFirst = parseConcordanceCandidates(firstPayload, word, 1);

  const maxAvailablePage = Math.max(1, Number(parsedFirst.maxPage || 1));
  const phaseOneMaxPage = Math.max(1, Math.min(maxAvailablePage, NKRY_FIRST_USAGE_MAX_PAGES));
  let allCandidates = [...parsedFirst.candidates];
  let scannedPages = 1;

  for (let page = 2; page <= phaseOneMaxPage; page += 1) {
    try {
      const payload = await fetchNkryPage(endpoint, authValue, word, page);
      const parsed = parseConcordanceCandidates(payload, word, page);
      allCandidates = allCandidates.concat(parsed.candidates);
      scannedPages += 1;
    } catch {
      // keep candidates from successfully fetched pages
    }
  }

  let best = pickEarliestCandidate(allCandidates);
  const shouldDeepScan =
    best
    && Number.isFinite(best.yearNum)
    && best.yearNum > NKRY_DEEP_SCAN_YEAR_THRESHOLD
    && phaseOneMaxPage < maxAvailablePage;

  if (shouldDeepScan) {
    const phaseTwoMaxPage = Math.max(phaseOneMaxPage, Math.min(maxAvailablePage, NKRY_DEEP_SCAN_MAX_PAGES));
    for (let page = phaseOneMaxPage + 1; page <= phaseTwoMaxPage; page += 1) {
      try {
        const payload = await fetchNkryPage(endpoint, authValue, word, page);
        const parsed = parseConcordanceCandidates(payload, word, page);
        allCandidates = allCandidates.concat(parsed.candidates);
        scannedPages += 1;
      } catch {
        // ignore failed pages during deep scan
      }
    }
    best = pickEarliestCandidate(allCandidates);
  }

  if (!best) return null;

  return {
    quote: best.quote,
    author: best.author,
    title: best.title,
    year: best.year,
    sourceName: best.sourceName,
    meta: {
      matchedWord: word,
      scannedPages,
      candidates: allCandidates.length,
      chosenPage: best.page,
      chosenYear: Number.isFinite(best.yearNum) ? best.yearNum : null,
      sortingRequested: NKRY_SORTING,
      sortingApplied: parsedFirst.appliedSorting || ""
    }
  };
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
    const result = await findFirstUsage(validation.value);
    if (!result) {
      sendJson(res, 404, {
        error: `Для слова «${validation.value}» в выбранном корпусе не найдено цитат.`
      });
      return;
    }

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
