import http from "node:http";
import path from "node:path";
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const NKRY_API_BASE_URL = process.env.NKRY_API_BASE_URL || "https://ruscorpora.ru/api/v1/";
const NKRY_SEARCH_PATH = process.env.NKRY_SEARCH_PATH || "lex-gramm/concordance";
const NKRY_API_KEY = process.env.NKRY_API_KEY || "";
const NKRY_API_KEY_HEADER = process.env.NKRY_API_KEY_HEADER || "Authorization";
const NKRY_API_AUTH_PREFIX = process.env.NKRY_API_AUTH_PREFIX || "Bearer";
const NKRY_CORPUS_TYPE = process.env.NKRY_CORPUS_TYPE || "CLASSICS";
const MAX_REQUEST_BODY_BYTES = Number(process.env.MAX_REQUEST_BODY_BYTES || 32 * 1024);
const FEEDBACK_STORE_PATH = process.env.FEEDBACK_STORE_PATH || path.join(__dirname, "tools", "ranking_feedback_store.json");

const DEFAULT_MODEL = {
  version: 1,
  updatedAt: "",
  weights: {
    literal: 1,
    associative: 1,
    state: 1,
    hit: 1,
    intent: 1,
    literaryPenalty: 1,
    lengthPenalty: 1,
    diversityPenalty: 0.75
  },
  byAuthor: {},
  byFingerprint: {},
  byReason: {
    tone: 0,
    theme: 0,
    rhythm: 0,
    too_dark: 0,
    too_abstract: 0
  },
  recentFeedback: []
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadFeedbackModel() {
  try {
    if (!existsSync(FEEDBACK_STORE_PATH)) return structuredClone(DEFAULT_MODEL);
    const parsed = JSON.parse(readFileSync(FEEDBACK_STORE_PATH, "utf8"));
    return {
      ...structuredClone(DEFAULT_MODEL),
      ...parsed,
      weights: { ...DEFAULT_MODEL.weights, ...(parsed?.weights || {}) },
      byAuthor: parsed?.byAuthor && typeof parsed.byAuthor === "object" ? parsed.byAuthor : {},
      byFingerprint: parsed?.byFingerprint && typeof parsed.byFingerprint === "object" ? parsed.byFingerprint : {},
      byReason: { ...DEFAULT_MODEL.byReason, ...(parsed?.byReason || {}) },
      recentFeedback: Array.isArray(parsed?.recentFeedback) ? parsed.recentFeedback.slice(-500) : []
    };
  } catch {
    return structuredClone(DEFAULT_MODEL);
  }
}

function persistFeedbackModel(model) {
  try {
    writeFileSync(FEEDBACK_STORE_PATH, JSON.stringify(model, null, 2), "utf8");
  } catch (error) {
    console.error("feedback_model_persist_error", error.message || String(error));
  }
}

const feedbackModel = loadFeedbackModel();
const metrics = {
  searchRequests: 0,
  searchSuccess: 0,
  searchEmpty: 0,
  searchErrors: 0,
  repeatedQueries: 0,
  feedbackEvents: 0
};
const recentQueries = new Map();

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
  return String(value || "")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function detectIntentProfiles(tokens) {
  const set = new Set();
  const has = (stem) => tokens.some((token) => token.includes(stem) || stem.includes(stemPrefix(token)));

  if (has("смысл") || has("зачем") || has("жизн")) set.add("meaning");
  if (has("любов") || has("отнош") || has("сердц")) set.add("relation");
  if (has("тревог") || has("страх") || has("бою")) set.add("anxiety");
  if (has("надеж") || has("вер") || has("будущ")) set.add("hope");
  if (has("свобод") || has("вол")) set.add("freedom");

  return set;
}

function scoreIntentLexicon(intentProfiles, text) {
  if (!intentProfiles.size) return 0;

  let score = 0;
  const lexicon = {
    meaning: ["смысл", "жизн", "душ", "истин", "вечност", "судьб", "путь", "быт"],
    relation: ["любов", "сердц", "нежн", "верност", "разлук", "мил"],
    anxiety: ["тревог", "страх", "мрак", "тоска", "смятени", "боль"],
    hope: ["надеж", "свет", "утро", "заря", "вера", "весна"],
    freedom: ["свобод", "воля", "ветер", "простор", "крыл", "полет"]
  };

  for (const profile of intentProfiles) {
    const stems = lexicon[profile] || [];
    const hits = stems.reduce((acc, stem) => acc + (text.includes(stem) ? 1 : 0), 0);
    score += Math.min(4, hits) * 1.15;
  }

  return score;
}

function buildFingerprint(candidate) {
  const basis = normalizeText(`${candidate.author}|${candidate.title}|${candidate.quote}`);
  return createHash("sha1").update(basis).digest("hex").slice(0, 16);
}

function estimateTone(text) {
  const source = normalizeText(text);
  const bright = ["свет", "надеж", "утро", "весн", "радост", "вера", "любов", "мир"];
  const dark = ["тревог", "страх", "мрак", "тоска", "печал", "горе", "боль", "пустот"];

  const positive = bright.reduce((acc, stem) => acc + (source.includes(stem) ? 1 : 0), 0);
  const negative = dark.reduce((acc, stem) => acc + (source.includes(stem) ? 1 : 0), 0);
  return clamp((positive - negative) / 4, -1, 1);
}

function getFeedbackBias(candidate) {
  const authorKey = normalizeText(candidate.author || "");
  const fingerprint = buildFingerprint(candidate);
  const byAuthor = Number(feedbackModel.byAuthor?.[authorKey] || 0);
  const byFingerprint = Number(feedbackModel.byFingerprint?.[fingerprint] || 0);
  return clamp(byFingerprint * 0.35 + byAuthor * 0.2, -1, 1);
}

function scoreLiteraryPenalty(candidate) {
  const sourceText = normalizeText(
    [
      candidate.title,
      candidate.docHeader,
      candidate.docType,
      candidate.docTopic,
      candidate.docStyle
    ].join(" ")
  );

  const harshPenaltyStems = [
    "форум",
    "коммент",
    "блог",
    "переписк",
    "интернет",
    "рецепт",
    "документ",
    "подат",
    "записк",
    "инструкц",
    "отчет",
    "протокол"
  ];

  const softPenaltyStems = ["коммерц", "финанс", "право", "бизн", "производств"];
  const lyricalBoostStems = ["поэм", "стих", "дневник", "роман", "повест", "элег", "сонет", "лирик"];

  let penalty = 0;
  for (const stem of harshPenaltyStems) {
    if (sourceText.includes(stem)) penalty += 4.5;
  }
  for (const stem of softPenaltyStems) {
    if (sourceText.includes(stem)) penalty += 2.2;
  }
  for (const stem of lyricalBoostStems) {
    if (sourceText.includes(stem)) penalty -= 1.2;
  }

  return penalty;
}

function scoreCandidate(candidate, queryTokens, queryGroups, stateWeights, excludeAuthors = []) {
  const text = normalizeText(`${candidate.quote} ${candidate.title} ${candidate.author}`);
  const intentProfiles = detectIntentProfiles(queryTokens);

  let literal = 0;
  for (const token of queryTokens) {
    const stem = stemPrefix(token);
    if (text.includes(token)) literal += 2;
    else if (text.includes(stem)) literal += 1;
  }

  let associative = 0;
  for (const group of queryGroups) {
    const stems = ASSOCIATIVE_GROUPS[group] || [];
    if (stems.some((stem) => text.includes(stem))) associative += 1.5;
  }

  let stateBoost = 0;
  if (stateWeights && typeof stateWeights === "object") {
    for (const [group, weight] of Object.entries(stateWeights)) {
      const stems = ASSOCIATIVE_GROUPS[group] || [];
      if (stems.some((stem) => text.includes(stem))) stateBoost += Number(weight || 0) * 0.9;
    }
  }

  const hitBoost = Math.min(2.5, Number(candidate.hitCount || 0) * 0.7);
  const intentBoost = scoreIntentLexicon(intentProfiles, text);
  const literaryPenalty = scoreLiteraryPenalty(candidate);
  const lengthPenalty = candidate.quote.length > 340 ? 1.4 : 0;
  const tone = estimateTone(text);
  const feedbackBias = getFeedbackBias(candidate);
  const authorKey = normalizeText(candidate.author);
  const diversityPenalty = excludeAuthors.includes(authorKey) ? feedbackModel.weights.diversityPenalty : 0;

  const components = {
    literal,
    associative,
    stateBoost,
    hitBoost,
    intentBoost,
    literaryPenalty,
    lengthPenalty,
    diversityPenalty,
    feedbackBias,
    tone
  };

  const score =
    components.literal * feedbackModel.weights.literal +
    components.associative * feedbackModel.weights.associative +
    components.stateBoost * feedbackModel.weights.state +
    components.hitBoost * feedbackModel.weights.hit +
    components.intentBoost * feedbackModel.weights.intent +
    components.feedbackBias -
    components.literaryPenalty * feedbackModel.weights.literaryPenalty -
    components.lengthPenalty * feedbackModel.weights.lengthPenalty -
    components.diversityPenalty;

  return { score, components };
}

async function fetchNkryConcordance(term, limit) {
  const endpoint = new URL(String(NKRY_SEARCH_PATH || "").replace(/^\/+/, ""), NKRY_API_BASE_URL).toString();
  const authValue = NKRY_API_AUTH_PREFIX ? `${NKRY_API_AUTH_PREFIX} ${NKRY_API_KEY}` : NKRY_API_KEY;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [NKRY_API_KEY_HEADER]: authValue
    },
    body: JSON.stringify(buildNkryPayload(term))
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`НКРЯ API вернул статус ${response.status}: ${text.slice(0, 250)}`);
  }

  const payload = await response.json();
  const candidates = parseConcordanceCandidates(payload, term);
  return candidates.slice(0, limit);
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
    if (error && error.message === "payload_too_large") {
      sendJson(res, 413, { error: "Слишком большой JSON в запросе." });
      return;
    }
    sendJson(res, 400, { error: "Некорректный JSON в запросе." });
    return;
  }

  const query = String(body.query || "").trim();
  const limit = Math.max(1, Math.min(20, Number(body.limit || 10)));
  const stateWeights = body.stateWeights && typeof body.stateWeights === "object" ? body.stateWeights : {};
  const excludeQuotes = Array.isArray(body.excludeQuotes)
    ? body.excludeQuotes.map((x) => normalizeText(String(x || ""))).filter(Boolean)
    : [];

  if (!query) {
    sendJson(res, 400, { error: "Пустой query." });
    return;
  }

  const queryTokens = extractKeywords(query, 10);
  if (!queryTokens.length) {
    sendJson(res, 400, { error: "Не удалось выделить ключевые слова запроса." });
    return;
  }

  const terms = buildSearchTerms({ query, terms: body.terms, stateWeights });
  if (!terms.length) {
    sendJson(res, 400, { error: "Не удалось сформировать термы поиска." });
    return;
  }

  let allCandidates = [];
  const settled = await Promise.allSettled(terms.map((term) => fetchNkryConcordance(term, limit)));
  const errors = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      allCandidates = allCandidates.concat(result.value);
      continue;
    }
    errors.push(result.reason?.message || "Ошибка сети при обращении к НКРЯ API.");
  }

  if (!allCandidates.length) {
    const reason = errors.length ? ` Все термы завершились ошибкой: ${errors.slice(0, 3).join(" | ")}` : "";
    sendJson(res, 502, { error: `НКРЯ недоступен для текущего запроса.${reason}` });
    return;
  }

  const queryGroups = detectQueryGroups(queryTokens);

  const dedup = new Map();
  for (const candidate of allCandidates) {
    const key = normalizeText(`${candidate.quote}__${candidate.title}`);
    const score = scoreCandidate(candidate, queryTokens, queryGroups, stateWeights);
    const next = { ...candidate, score };

    if (!dedup.has(key) || dedup.get(key).score < score) {
      dedup.set(key, next);
    }
  }

  const ranked = Array.from(dedup.values()).sort((a, b) => b.score - a.score);
  const top = ranked.find((item) => !excludeQuotes.includes(normalizeText(item.quote))) || ranked[0];

  sendJson(res, 200, {
    quote: {
      quote: top.quote,
      author: top.author,
      title: top.title,
      year: top.year,
      sourceName: top.sourceName,
      score: top.score,
      matchedTerms: terms.slice(0, 5)
    }
  });
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

  res.writeHead(200, { "Content-Type": contentType, "Content-Length": size });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/nkry/search") {
    await handleNkrySearch(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Server started: http://${HOST}:${PORT}`);
});
