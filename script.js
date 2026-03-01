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

const rulerPhotoCache = new Map();
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
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Dmitry_Levitsky_-_Portrait_of_Alexander_Khrapovitsky.jpg/640px-Dmitry_Levitsky_-_Portrait_of_Alexander_Khrapovitsky.jpg"
  },
  {
    from: 1800,
    to: 1839,
    title: "Последний день Помпеи",
    artist: "К. П. Брюллов, 1833",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Karl_Briullov_-_The_Last_Day_of_Pompeii_-_Google_Art_Project.jpg/640px-Karl_Briullov_-_The_Last_Day_of_Pompeii_-_Google_Art_Project.jpg"
  },
  {
    from: 1840,
    to: 1869,
    title: "Явление Христа народу",
    artist: "А. А. Иванов, 1857",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Appearance_of_Christ_before_the_people.jpg/640px-Appearance_of_Christ_before_the_people.jpg"
  },
  {
    from: 1870,
    to: 1899,
    title: "Грачи прилетели",
    artist: "А. К. Саврасов, 1871",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Savrasov_Grachi_prileteli.jpg/640px-Savrasov_Grachi_prileteli.jpg"
  },
  {
    from: 1900,
    to: 1929,
    title: "Купание красного коня",
    artist: "К. С. Петров-Водкин, 1912",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Kuzma_Petrov-Vodkin_-_Bathing_of_a_Red_Horse.jpg/640px-Kuzma_Petrov-Vodkin_-_Bathing_of_a_Red_Horse.jpg"
  },
  {
    from: 1930,
    to: 1959,
    title: "Новая Москва",
    artist: "Ю. И. Пименов, 1937",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Yuri_Pimenov_New_Moscow_1937.jpg/640px-Yuri_Pimenov_New_Moscow_1937.jpg"
  },
  {
    from: 1960,
    to: 1989,
    title: "Суровый стиль (эпоха)",
    artist: "Советская живопись 1960-х",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Viktor_Popkov_Builders_of_Bratsk.jpg/640px-Viktor_Popkov_Builders_of_Bratsk.jpg"
  },
  {
    from: 1990,
    to: 2029,
    title: "Современная российская живопись",
    artist: "Рубеж XX–XXI вв.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/State_Tretyakov_Gallery_10.jpg/640px-State_Tretyakov_Gallery_10.jpg"
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

async function loadRulerPhoto(wikiTitle) {
  if (!wikiTitle) return "";
  if (rulerPhotoCache.has(wikiTitle)) return rulerPhotoCache.get(wikiTitle);

  try {
    const response = await fetch(`https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`);
    if (!response.ok) throw new Error("bad_status");
    const payload = await response.json();
    const src = String(payload?.thumbnail?.source || payload?.originalimage?.source || "");
    rulerPhotoCache.set(wikiTitle, src);
    return src;
  } catch {
    rulerPhotoCache.set(wikiTitle, "");
    return "";
  }
}

async function renderRulerByYear(rawYear) {
  const year = extractYear(rawYear);
  const ruler = getRulerByYear(year);
  const art = getArtByYear(year);

  let hasContext = false;

  if (ruler) {
    rulerTitleNode.textContent = `Правитель России в ${year} году: ${ruler.name}`;
    rulerMetaNode.textContent = `${ruler.role} (${ruler.from}–${ruler.to})`;

    const photo = await loadRulerPhoto(ruler.wikiTitle);
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
    artImageNode.src = art.image;
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

  quoteTextNode.textContent = `«${quote.quote}»`;
  quoteMetaNode.textContent = quote.year
    ? `${quote.author} — ${quote.title}, ${quote.year}`
    : `${quote.author} — ${quote.title}`;
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
