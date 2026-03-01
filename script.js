const form = document.getElementById("query-form");
const wordNode = document.getElementById("word");
const submitBtn = document.getElementById("submit-btn");
const messageNode = document.getElementById("message");

const resultCardNode = document.getElementById("result-card");
const quoteTextNode = document.getElementById("quote-text");
const quoteMetaNode = document.getElementById("quote-meta");
const quoteSourceNode = document.getElementById("quote-source");
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

const wikiImageCache = new Map();
const RULERS = [
  { from: 1682, to: 1725, name: "Петр I", role: "Император России", wikiTitle: "Пётр_I" },
  { from: 1725, to: 1727, name: "Екатерина I", role: "Императрица России", wikiTitle: "Екатерина_I" },
  { from: 1727, to: 1730, name: "Петр II", role: "Император России", wikiTitle: "Пётр_II" },
  { from: 1730, to: 1740, name: "Анна Иоанновна", role: "Императрица России", wikiTitle: "Анна_Иоанновна" },
  { from: 1740, to: 1741, name: "Иван VI", role: "Император России", wikiTitle: "Иван_VI" },
  { from: 1741, to: 1762, name: "Елизавета Петровна", role: "Императрица России", wikiTitle: "Елизавета_Петровна" },
  { from: 1762, to: 1796, name: "Екатерина II", role: "Императрица России", wikiTitle: "Екатерина_II" },
  { from: 1796, to: 1801, name: "Павел I", role: "Император России", wikiTitle: "Павел_I" },
  { from: 1801, to: 1825, name: "Александр I", role: "Император России", wikiTitle: "Александр_I" },
  { from: 1825, to: 1855, name: "Николай I", role: "Император России", wikiTitle: "Николай_I" },
  { from: 1855, to: 1881, name: "Александр II", role: "Император России", wikiTitle: "Александр_II" },
  { from: 1881, to: 1894, name: "Александр III", role: "Император России", wikiTitle: "Александр_III" },
  { from: 1894, to: 1917, name: "Николай II", role: "Император России", wikiTitle: "Николай_II" },
  { from: 1918, to: 1924, name: "Владимир Ленин", role: "Глава РСФСР", wikiTitle: "Ленин,_Владимир_Ильич" },
  { from: 1924, to: 1953, name: "Иосиф Сталин", role: "Руководитель СССР", wikiTitle: "Сталин,_Иосиф_Виссарионович" },
  { from: 1953, to: 1964, name: "Никита Хрущев", role: "Руководитель СССР", wikiTitle: "Хрущёв,_Никита_Сергеевич" },
  { from: 1964, to: 1982, name: "Леонид Брежнев", role: "Руководитель СССР", wikiTitle: "Брежнев,_Леонид_Ильич" },
  { from: 1982, to: 1984, name: "Юрий Андропов", role: "Руководитель СССР", wikiTitle: "Андропов,_Юрий_Владимирович" },
  { from: 1984, to: 1985, name: "Константин Черненко", role: "Руководитель СССР", wikiTitle: "Черненко,_Константин_Устинович" },
  { from: 1985, to: 1991, name: "Михаил Горбачев", role: "Руководитель СССР", wikiTitle: "Горбачёв,_Михаил_Сергеевич" },
  { from: 1991, to: 1999, name: "Борис Ельцин", role: "Президент России", wikiTitle: "Ельцин,_Борис_Николаевич" },
  { from: 2000, to: 2008, name: "Владимир Путин", role: "Президент России", wikiTitle: "Путин,_Владимир_Владимирович" },
  { from: 2008, to: 2012, name: "Дмитрий Медведев", role: "Президент России", wikiTitle: "Медведев,_Дмитрий_Анатольевич" },
  { from: 2012, to: 2026, name: "Владимир Путин", role: "Президент России", wikiTitle: "Путин,_Владимир_Владимирович" }
];
const DECADE_ART = [
  {
    from: 1760,
    to: 1799,
    title: "Портрет А. В. Храповицкого",
    artist: "Д. Г. Левицкий, 1781",
    wikiTitle: "Портрет_А._В._Храповицкого"
  },
  {
    from: 1800,
    to: 1839,
    title: "Последний день Помпеи",
    artist: "К. П. Брюллов, 1833",
    wikiTitle: "Последний_день_Помпеи"
  },
  {
    from: 1840,
    to: 1869,
    title: "Явление Христа народу",
    artist: "А. А. Иванов, 1857",
    wikiTitle: "Явление_Христа_народу"
  },
  {
    from: 1870,
    to: 1899,
    title: "Грачи прилетели",
    artist: "А. К. Саврасов, 1871",
    wikiTitle: "Грачи_прилетели"
  },
  {
    from: 1900,
    to: 1929,
    title: "Купание красного коня",
    artist: "К. С. Петров-Водкин, 1912",
    wikiTitle: "Купание_красного_коня"
  },
  {
    from: 1930,
    to: 1959,
    title: "Новая Москва",
    artist: "Ю. И. Пименов, 1937",
    wikiTitle: "Новая_Москва_(картина)"
  },
  {
    from: 1960,
    to: 1989,
    title: "Суровый стиль (эпоха)",
    artist: "Советская живопись 1960-х",
    wikiTitle: "Строители_Братска"
  },
  {
    from: 1990,
    to: 2029,
    title: "Современная российская живопись",
    artist: "Рубеж XX–XXI вв.",
    wikiTitle: "Третьяковская_галерея"
  }
];

function normalizeWord(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9-]/gi, "");
}

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

function dedupeAuthorInTitle(author, title) {
  const cleanAuthor = String(author || "").trim();
  const cleanTitle = String(title || "").trim();
  if (!cleanAuthor || !cleanTitle) return cleanTitle || "Без названия";

  const leadingAuthorPattern = new RegExp(`^\\s*${escapeRegex(cleanAuthor)}\\s*[.\\-–—,:;]*\\s*`, "iu");
  const deduped = cleanTitle.replace(leadingAuthorPattern, "").trim();
  return deduped || cleanTitle;
}

function normalizeForMatch(text) {
  return String(text || "").toLowerCase().replaceAll("ё", "е");
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
    const shouldMark = normalized === word || normalized.startsWith(stem);
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
  return DECADE_ART.find((art) => year >= art.from && year <= art.to) || null;
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

async function renderRulerByYear(rawYear) {
  const year = extractYear(rawYear);
  const ruler = getRulerByYear(year);
  const art = getArtByYear(year);

  let hasContext = false;

  if (ruler) {
    rulerTitleNode.textContent = `Правитель России в ${year} году: ${ruler.name}`;
    rulerMetaNode.textContent = `${ruler.role} (${ruler.from}–${ruler.to})`;

    const photo = await loadWikiImage(ruler.wikiTitle);
    if (photo) {
      rulerImageNode.src = photo;
      rulerImageNode.alt = `${ruler.name}`;
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
    artTitleNode.textContent = `Атмосфера десятилетия: ${art.title}`;
    artMetaNode.textContent = art.artist;
    const artPhoto = await loadWikiImage(art.wikiTitle);
    if (artPhoto) {
      artImageNode.src = artPhoto;
      artImageNode.alt = art.title;
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

async function showResult(payload) {
  const quote = sanitizeQuote(payload.quote);
  if (!quote) throw new Error("НКРЯ не вернул корректную цитату.");
  const matchedWord = normalizeWord(payload?.meta?.matchedWord || "");
  const title = dedupeAuthorInTitle(quote.author, quote.title);
  const typographic = formatQuoteTypography(quote.quote);
  const quoteHtml = highlightQuoteCore(typographic.core, matchedWord);
  const tail = typographic.tail ? escapeHtml(typographic.tail) : "";

  quoteTextNode.innerHTML = `«${quoteHtml}»${tail}`;
  quoteMetaNode.textContent = quote.year
    ? `${quote.author} — ${title}, ${quote.year}`
    : `${quote.author} — ${title}`;
  quoteSourceNode.textContent = `Источник: ${quote.sourceName}`;
  resultWordNode.textContent = matchedWord ? `Слово: ${matchedWord}` : "";
  await renderRulerByYear(quote.year);

  resultCardNode.classList.remove("hidden");
  resultCardNode.classList.remove("fade-in");
  void resultCardNode.offsetWidth;
  resultCardNode.classList.add("fade-in");
  resultCardNode.focus();
  resultCardNode.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function requestFirstUsage(word) {
  const response = await fetch("/api/nkry/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload.error || "Не удалось получить цитату."));
  }

  return response.json();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const validated = validateWord(wordNode.value);
  if (!validated.ok) {
    setMessage(validated.reason, true);
    resultCardNode.classList.add("hidden");
    return;
  }

  setBusy(true);
  setMessage("Ищем первую фиксацию слова в НКРЯ...");

  try {
    const payload = await requestFirstUsage(validated.value);
    await showResult(payload);
    setMessage("");
  } catch (error) {
    resultCardNode.classList.add("hidden");
    setMessage(error.message || "Ошибка запроса.", true);
  } finally {
    setBusy(false);
  }
});

wordNode.addEventListener("input", () => {
  const enforced = enforceSingleWordInput(wordNode.value);
  if (enforced.value !== wordNode.value) {
    wordNode.value = enforced.value;
  }

  if (enforced.trimmed) {
    setMessage("Пожалуйста, вводите только одно слово. Лишний текст убран автоматически.");
    return;
  }

  if (messageNode.textContent) setMessage("");
});
