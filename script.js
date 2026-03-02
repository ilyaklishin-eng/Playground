import { RULERS, DECADE_ART } from "./app/reference-data.js";
import { dedupeAuthorInTitle, formatMetaLine, normalizeWord } from "./app/text-utils.js";

const form = document.getElementById("query-form");
const wordNode = document.getElementById("word");
const submitBtn = document.getElementById("submit-btn");
const statusLineNode = document.getElementById("status-line");
const messageNode = document.getElementById("message");

const resultCardNode = document.getElementById("result-card");
const quoteTextNode = document.getElementById("quote-text");
const quoteMetaNode = document.getElementById("quote-meta");
const quoteSourceNode = document.getElementById("quote-source");
const explainDetailsNode = document.getElementById("explain-details");
const whyYearNode = document.getElementById("why-year");
const whyModeNode = document.getElementById("why-mode");
const whyRelNode = document.getElementById("why-rel");
const resultWordNode = document.getElementById("result-word");
const contextGridNode = document.getElementById("context-grid");
const rulerCardNode = document.getElementById("ruler-card");
const rulerImageNode = document.getElementById("ruler-image");
const rulerTitleNode = document.getElementById("ruler-title");
const rulerMetaNode = document.getElementById("ruler-meta");
const artCardNode = document.getElementById("art-card");
const artImageNode = document.getElementById("art-image");
const artTitleNode = document.getElementById("art-title");
const artMetaNode = document.getElementById("art-meta");
let activeController = null;
let activeRequestId = 0;
const CLIENT_REQUEST_TIMEOUT_MS = 32000;
const CLIENT_SOFT_RETRY_MAX_ATTEMPTS = 1;
const CLIENT_SOFT_RETRY_BASE_DELAY_MS = 360;
const CLIENT_SOFT_RETRY_MAX_DELAY_MS = 3200;
const CLIENT_SOFT_RETRY_JITTER_MS = 280;

const wikiImageCache = new Map();

function enforceSingleWordInput(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trimStart();
  if (!text) return { value: "", trimmed: false };
  const [firstWord] = text.split(" ");
  return { value: firstWord, trimmed: text !== firstWord };
}

function validateWord(rawWord) {
  const word = normalizeWord(rawWord);
  if (!word) return { ok: false, reason: "Введите одно слово.", value: "" };
  if (word.length < 2 || word.length > 48) {
    return { ok: false, reason: "Слово должно быть длиной от 2 до 48 символов.", value: word };
  }
  if (!/^[a-zа-я0-9]+(?:-[a-zа-я0-9]+)?$/i.test(word)) {
    return { ok: false, reason: "Разрешены только буквы/цифры и один дефис внутри слова.", value: word };
  }
  return { ok: true, reason: "", value: word };
}

function sanitizeQuote(item) {
  if (!item || typeof item !== "object") return null;
  const quote = String(item.quote || "").trim();
  if (!quote) return null;
  return {
    quote,
    author: String(item.author || "Не указан"),
    title: String(item.title || "Без названия"),
    year: String(item.year || ""),
    sourceName: String(item.sourceName || "НКРЯ")
  };
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeForMatch(text) {
  return String(text || "").toLowerCase().replaceAll("ё", "е");
}

function commonPrefixLength(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  const max = Math.min(x.length, y.length);
  let i = 0;
  while (i < max && x[i] === y[i]) i += 1;
  return i;
}

function hasStrongStemOverlap(token, word) {
  const t = normalizeForMatch(token);
  const w = normalizeForMatch(word);
  if (!t || !w) return false;
  if (t === w) return true;
  if (t.length <= 3 || w.length <= 3) return false;

  // Allow inflectional endings for Russian forms (e.g. "метла" -> "метлу").
  const overlap = commonPrefixLength(t, w);
  const minRequired = Math.min(5, Math.max(3, Math.min(t.length, w.length) - 1));
  return overlap >= minRequired;
}

function formatQuoteTypography(rawQuote) {
  const quote = String(rawQuote || "").trim();
  if (!quote) return { core: "", tail: "" };
  const match = quote.match(/([.!?…]+)$/u);
  if (!match) return { core: quote, tail: "" };
  const tail = match[1];
  const core = quote.slice(0, -tail.length).trimEnd();
  return { core: core || quote, tail };
}

function highlightQuoteCore(rawCore, matchedWord) {
  const core = String(rawCore || "");
  const word = normalizeForMatch(matchedWord);
  if (!core) return "";
  if (!word) return escapeHtml(core);

  const stem = word.length > 5 ? word.slice(0, 5) : word;
  if (!stem) return escapeHtml(core);

  const tokenRegex = /([A-Za-zА-Яа-яЁё0-9-]+)/gu;
  let cursor = 0;
  let out = "";
  let matchedAny = false;
  let tokenMatch;

  while ((tokenMatch = tokenRegex.exec(core)) !== null) {
    const full = tokenMatch[0];
    const start = tokenMatch.index;
    const end = start + full.length;
    out += escapeHtml(core.slice(cursor, start));

    const normalized = normalizeForMatch(full);
    const shouldMark =
      normalized === word
      || normalized.startsWith(stem)
      || hasStrongStemOverlap(normalized, word);
    if (shouldMark) {
      out += `<mark class="hit">${escapeHtml(full)}</mark>`;
      matchedAny = true;
    } else {
      out += escapeHtml(full);
    }
    cursor = end;
  }
  out += escapeHtml(core.slice(cursor));

  if (matchedAny) return out;

  const exactRegex = new RegExp(`(${escapeRegex(word)})`, "iu");
  const exactMatch = core.match(exactRegex);
  if (!exactMatch) return escapeHtml(core);
  const idx = exactMatch.index || 0;
  const exact = exactMatch[0];
  return `${escapeHtml(core.slice(0, idx))}<mark class="hit">${escapeHtml(exact)}</mark>${escapeHtml(core.slice(idx + exact.length))}`;
}

function extractYear(rawYear) {
  const match = String(rawYear || "").match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function getRulerByYear(year) {
  if (!Number.isFinite(year)) return null;
  return RULERS.find((ruler) => year >= ruler.from && year <= ruler.to) || null;
}

function getArtByYear(year) {
  if (!Number.isFinite(year)) return null;
  const exact = DECADE_ART.find((art) => year >= art.from && year <= art.to);
  if (exact) return exact;
  return DECADE_ART[DECADE_ART.length - 1] || null;
}

function canLoadImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function fetchWikiSummaryImage(host, wikiTitle) {
  const response = await fetch(`https://${host}/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`);
  if (!response.ok) return "";
  const payload = await response.json();
  return String(payload?.thumbnail?.source || payload?.originalimage?.source || "");
}

async function loadWikiImage(wikiTitle) {
  if (!wikiTitle) return "";
  if (wikiImageCache.has(wikiTitle)) return wikiImageCache.get(wikiTitle);

  const candidates = [];
  try {
    candidates.push(await fetchWikiSummaryImage("ru.wikipedia.org", wikiTitle));
  } catch {}
  try {
    candidates.push(await fetchWikiSummaryImage("en.wikipedia.org", wikiTitle));
  } catch {}

  for (const src of candidates) {
    if (await canLoadImage(src)) {
      wikiImageCache.set(wikiTitle, src);
      return src;
    }
  }

  wikiImageCache.set(wikiTitle, "");
  return "";
}

async function loadAnyWikiImage(art) {
  if (!art) return "";
  const fromRu = await loadWikiImage(art?.wiki?.ruTitle || "");
  if (fromRu) return fromRu;
  const fromEn = await loadWikiImage(art?.wiki?.enTitle || "");
  if (fromEn) return fromEn;
  const fallback = String(art.imageUrl || "");
  if (fallback && await canLoadImage(fallback)) return fallback;
  return "";
}

async function renderRulerByYear(rawYear) {
  const year = extractYear(rawYear);
  const ruler = getRulerByYear(year);
  const art = getArtByYear(year);

  let hasContext = false;

  if (ruler) {
    rulerTitleNode.textContent = `Правитель России в ${year} году: ${ruler.displayTitle}`;
    rulerMetaNode.textContent = String(ruler.tenureLabel || "");

    const photo = await loadWikiImage(ruler?.wiki?.ruTitle || "");
    if (photo) {
      rulerImageNode.src = photo;
      rulerImageNode.alt = `${ruler.displayTitle}`;
      rulerImageNode.classList.remove("hidden");
    } else {
      rulerImageNode.removeAttribute("src");
      rulerImageNode.alt = "";
      rulerImageNode.classList.add("hidden");
    }
    rulerCardNode.classList.remove("hidden");
    hasContext = true;
  } else {
    rulerCardNode.classList.add("hidden");
  }

  if (art) {
    artTitleNode.textContent = art.displayTitle;
    artMetaNode.textContent = art.tenureLabel;
    const artPhoto = await loadAnyWikiImage(art);
    if (artPhoto) {
      artImageNode.onerror = () => {
        artImageNode.removeAttribute("src");
        artImageNode.alt = "";
        artImageNode.classList.add("hidden");
        artCardNode.classList.add("hidden");
        contextGridNode.classList.toggle("hidden", !ruler || rulerCardNode.classList.contains("hidden"));
      };
      artImageNode.src = artPhoto;
      artImageNode.alt = art?.canonicalObject?.title || art.displayTitle;
      artImageNode.classList.remove("hidden");
      artCardNode.classList.remove("hidden");
      hasContext = true;
    } else {
      artImageNode.removeAttribute("src");
      artImageNode.alt = "";
      artImageNode.classList.add("hidden");
      artCardNode.classList.add("hidden");
    }
  } else {
    artImageNode.removeAttribute("src");
    artImageNode.alt = "";
    artImageNode.classList.add("hidden");
    artCardNode.classList.add("hidden");
  }

  contextGridNode.classList.toggle("hidden", !hasContext);
}

function setBusy(isBusy) {
  submitBtn.disabled = isBusy;
  submitBtn.textContent = isBusy ? "Ищем..." : "Показать первое употребление";
}

function setMessage(text, isError = false) {
  messageNode.textContent = text || "";
  messageNode.classList.toggle("error", isError);
}

function setStatusLine(text, kind = "") {
  statusLineNode.textContent = text || "";
  statusLineNode.classList.remove("search", "cache", "warn");
  if (kind) statusLineNode.classList.add(kind);
}

function formatSearchModes(value) {
  const modes = Array.isArray(value) ? value : [];
  if (!modes.length) return "лексический поиск";
  return modes
    .map((mode) => String(mode || "").replace("form", "по словоформе").replace("lex", "по лемме"))
    .join(", ");
}

function renderWhyBlock(meta) {
  const m = meta && typeof meta === "object" ? meta : {};
  const chosenYear = Number.isFinite(Number(m.chosenYear)) ? String(m.chosenYear) : "не определен";
  const relevanceNum = Number(m.chosenRelevanceScore);
  const relevance = Number.isFinite(relevanceNum) ? `${(relevanceNum * 100).toFixed(0)}%` : "н/д";

  whyYearNode.textContent = chosenYear;
  whyModeNode.textContent = formatSearchModes(m.searchModes);
  whyRelNode.textContent = relevance;
  explainDetailsNode.open = false;
  explainDetailsNode.classList.remove("hidden");
}

function userErrorMessage(error, requestedWord) {
  const status = Number(error?.status || 0);
  const retryAfterSec = Math.max(0, Number(error?.retryAfterSec || 0));
  const word = String(requestedWord || "");

  if (status === 429) {
    const wait = retryAfterSec || 10;
    return `Ограничение API, попробуйте через ${wait} сек.`;
  }
  if (status === 404) {
    if (word.length >= 7 || word.includes("-")) {
      return `Для слова «${word}» результат не найден. Возможно, слово очень редкое для текущего корпуса.`;
    }
    return `Для слова «${word}» не найдено результата в НКРЯ.`;
  }
  if (status === 400) {
    return "Проверьте ввод: нужно одно слово без пробелов и лишних знаков.";
  }
  return error?.message || "Ошибка запроса.";
}

async function showResult(payload) {
  const quote = sanitizeQuote(payload.quote);
  if (!quote) throw new Error("НКРЯ не вернул корректную цитату.");
  const matchedWord = normalizeWord(payload?.meta?.matchedWord || "");
  const title = dedupeAuthorInTitle(quote.author, quote.title);
  const typographic = formatQuoteTypography(quote.quote);
  const quoteHtml = highlightQuoteCore(typographic.core, matchedWord);
  const tail = typographic.tail ? escapeHtml(typographic.tail) : "";

  quoteTextNode.innerHTML = `«${quoteHtml}»${tail}`;
  quoteMetaNode.textContent = formatMetaLine(quote.author, title, quote.year);
  quoteSourceNode.textContent = `Источник: ${quote.sourceName}`;
  resultWordNode.textContent = matchedWord ? `Слово: ${matchedWord}` : "";
  renderWhyBlock(payload?.meta || {});
  await renderRulerByYear(quote.year);

  resultCardNode.classList.remove("hidden");
  resultCardNode.classList.remove("fade-in");
  void resultCardNode.offsetWidth;
  resultCardNode.classList.add("fade-in");
  resultCardNode.focus();
  resultCardNode.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function requestFirstUsage(word, signal) {
  const response = await fetch("/api/nkry/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, strictChronology: true }),
    signal
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(String(payload.error || "Не удалось получить цитату."));
    error.status = Number(response.status || 0);
    error.retryAfterSec = Number(payload?.retryAfterSec || 0);
    error.retriable = error.status === 429 || error.status === 408 || error.status >= 500;
    error.payload = payload;
    throw error;
  }

  return response.json();
}

function waitWithAbort(ms, signal) {
  return new Promise((resolve, reject) => {
    if (!Number.isFinite(ms) || ms <= 0) {
      resolve();
      return;
    }
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function computeRetryDelayMs(error, attemptIndex) {
  const retryAfterMs = Number(error?.retryAfterSec || 0) > 0
    ? Number(error.retryAfterSec) * 1000
    : 0;
  const backoffMs = CLIENT_SOFT_RETRY_BASE_DELAY_MS * (2 ** Math.max(0, attemptIndex));
  const base = Math.max(retryAfterMs, backoffMs);
  const jitter = Math.floor(Math.random() * (CLIENT_SOFT_RETRY_JITTER_MS + 1));
  return Math.min(CLIENT_SOFT_RETRY_MAX_DELAY_MS, base + jitter);
}

async function requestFirstUsageWithRetry(word, signal, onRetry) {
  for (let attempt = 0; attempt <= CLIENT_SOFT_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await requestFirstUsage(word, signal);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      const retriable = Boolean(
        error?.retriable
        || error?.status >= 500
        || error?.status === 429
        || error?.status === 408
        || /fetch failed|network|timeout/i.test(String(error?.message || ""))
      );
      if (!retriable || attempt >= CLIENT_SOFT_RETRY_MAX_ATTEMPTS) throw error;
      const delayMs = computeRetryDelayMs(error, attempt);
      if (typeof onRetry === "function") onRetry(attempt + 1, delayMs, error);
      await waitWithAbort(delayMs, signal);
    }
  }
  throw new Error("Не удалось получить цитату после повторных попыток.");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const validated = validateWord(wordNode.value);
  if (!validated.ok) {
    setStatusLine("Проверьте ввод", "warn");
    setMessage(validated.reason, true);
    resultCardNode.classList.add("hidden");
    return;
  }

  setBusy(true);
  setStatusLine("Ищем в НКРЯ...", "search");
  setMessage("");
  if (activeController) activeController.abort();
  const requestId = ++activeRequestId;
  const controller = new AbortController();
  activeController = controller;
  const timeout = setTimeout(() => controller.abort(), CLIENT_REQUEST_TIMEOUT_MS);

  try {
    const payload = await requestFirstUsageWithRetry(validated.value, controller.signal, (_retryNo, delayMs) => {
      const delaySec = Math.max(1, Math.round(delayMs / 1000));
      setStatusLine(`Ограничение API, попробуйте через ${delaySec} сек (авто-повтор)...`, "warn");
    });
    if (requestId !== activeRequestId) return;
    await showResult(payload);
    if (payload?.meta?.cached || payload?.meta?.stale) {
      const retry = Number(payload?.meta?.retryAfterSec || 0);
      setStatusLine(
        retry > 0
          ? `Использован кэш (ограничение API, повтор через ${retry} сек).`
          : "Использован кэш.",
        "cache"
      );
    } else {
      setStatusLine("Найдено в НКРЯ.", "search");
    }
    setMessage("");
  } catch (error) {
    if (error?.name === "AbortError") {
      if (requestId === activeRequestId) {
        setStatusLine("Запрос прерван по таймауту", "warn");
        setMessage("Запрос занял слишком много времени. Попробуйте еще раз.", true);
      }
      return;
    }
    if (requestId !== activeRequestId) return;
    resultCardNode.classList.add("hidden");
    explainDetailsNode.classList.add("hidden");
    if (Number(error?.status || 0) === 429) {
      const retry = Math.max(1, Number(error?.retryAfterSec || 10));
      setStatusLine(`Ограничение API, попробуйте через ${retry} сек.`, "warn");
    } else if (Number(error?.status || 0) === 404) {
      setStatusLine("Нет результата в НКРЯ", "warn");
    } else {
      setStatusLine("Ошибка запроса к НКРЯ", "warn");
    }
    setMessage(userErrorMessage(error, validated.value), true);
  } finally {
    clearTimeout(timeout);
    if (requestId === activeRequestId) {
      setBusy(false);
      activeController = null;
    }
  }
});

wordNode.addEventListener("input", () => {
  const enforced = enforceSingleWordInput(wordNode.value);
  if (enforced.value !== wordNode.value) {
    wordNode.value = enforced.value;
  }

  if (enforced.trimmed) {
    setStatusLine("Проверьте ввод", "warn");
    setMessage("Пожалуйста, вводите только одно слово. Лишний текст убран автоматически.");
    return;
  }

  if (messageNode.textContent) setMessage("");
});
