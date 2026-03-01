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
    from: 1700, to: 1709,
    title: "Портрет Петра I",
    artist: "Ж.-М. Натье, 1717",
    wikiTitleRu: "Портрет_Петра_I_(Натье)",
    wikiTitleEn: "Portrait_of_Peter_the_Great_(Nattier)",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Jean-Marc_Nattier_-_Portrait_of_Peter_I.jpg/640px-Jean-Marc_Nattier_-_Portrait_of_Peter_I.jpg"
  },
  {
    from: 1710, to: 1719,
    title: "Портрет Петра I",
    artist: "Ж.-М. Натье, 1717",
    wikiTitleRu: "Портрет_Петра_I_(Натье)",
    wikiTitleEn: "Portrait_of_Peter_the_Great_(Nattier)",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Jean-Marc_Nattier_-_Portrait_of_Peter_I.jpg/640px-Jean-Marc_Nattier_-_Portrait_of_Peter_I.jpg"
  },
  {
    from: 1720, to: 1729,
    title: "Портрет Петра I",
    artist: "Ж.-М. Натье, 1717",
    wikiTitleRu: "Портрет_Петра_I_(Натье)",
    wikiTitleEn: "Portrait_of_Peter_the_Great_(Nattier)",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Jean-Marc_Nattier_-_Portrait_of_Peter_I.jpg/640px-Jean-Marc_Nattier_-_Portrait_of_Peter_I.jpg"
  },
  {
    from: 1730, to: 1739,
    title: "Портрет императрицы Анны Иоанновны",
    artist: "Л. Каравак, XVIII век",
    wikiTitleRu: "Анна_Иоанновна_(портрет_Каравака)",
    wikiTitleEn: "Anna_of_Russia_by_Louis_Caravaque",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Anna_Ioannovna_by_Caravaque.jpg/640px-Anna_Ioannovna_by_Caravaque.jpg"
  },
  {
    from: 1740, to: 1749,
    title: "Портрет Елизаветы Петровны",
    artist: "Л. Каравак, XVIII век",
    wikiTitleRu: "Портрет_Елизаветы_Петровны_(Каравак)",
    wikiTitleEn: "Elizabeth_of_Russia_by_Caravaque",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Elizaveta_Petrovna_by_Caravaque.jpg/640px-Elizaveta_Petrovna_by_Caravaque.jpg"
  },
  {
    from: 1750, to: 1759,
    title: "Портрет Елизаветы Петровны",
    artist: "Л. Каравак, XVIII век",
    wikiTitleRu: "Портрет_Елизаветы_Петровны_(Каравак)",
    wikiTitleEn: "Elizabeth_of_Russia_by_Caravaque",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Elizaveta_Petrovna_by_Caravaque.jpg/640px-Elizaveta_Petrovna_by_Caravaque.jpg"
  },
  {
    from: 1760, to: 1769,
    title: "Портрет Екатерины II",
    artist: "Ф. С. Рокотов, 1763",
    wikiTitleRu: "Портрет_Екатерины_II_(Рокотов)",
    wikiTitleEn: "Portrait_of_Catherine_II_(Rokotov)",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Rokotov_Catherine_II.jpg/640px-Rokotov_Catherine_II.jpg"
  },
  {
    from: 1770, to: 1779,
    title: "Портрет Екатерины II",
    artist: "Ф. С. Рокотов, 1763",
    wikiTitleRu: "Портрет_Екатерины_II_(Рокотов)",
    wikiTitleEn: "Portrait_of_Catherine_II_(Rokotov)",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Rokotov_Catherine_II.jpg/640px-Rokotov_Catherine_II.jpg"
  },
  {
    from: 1780, to: 1789,
    title: "Портрет А. В. Храповицкого",
    artist: "Д. Г. Левицкий, 1781",
    wikiTitleRu: "Портрет_А._В._Храповицкого",
    wikiTitleEn: "Portrait_of_Alexander_Khrapovitsky",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Dmitry_Levitsky_-_Portrait_of_Alexander_Khrapovitsky.jpg/640px-Dmitry_Levitsky_-_Portrait_of_Alexander_Khrapovitsky.jpg"
  },
  {
    from: 1790, to: 1799,
    title: "Портрет А. В. Храповицкого",
    artist: "Д. Г. Левицкий, 1781",
    wikiTitleRu: "Портрет_А._В._Храповицкого",
    wikiTitleEn: "Portrait_of_Alexander_Khrapovitsky",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Dmitry_Levitsky_-_Portrait_of_Alexander_Khrapovitsky.jpg/640px-Dmitry_Levitsky_-_Portrait_of_Alexander_Khrapovitsky.jpg"
  },
  {
    from: 1800, to: 1809,
    title: "Портрет А. С. Пушкина",
    artist: "О. А. Кипренский, 1827",
    wikiTitleRu: "Портрет_А._С._Пушкина_(Кипренский)",
    wikiTitleEn: "Pushkin_by_Kiprensky",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Kiprensky_Pushkin.jpg/640px-Kiprensky_Pushkin.jpg"
  },
  {
    from: 1810, to: 1819,
    title: "Портрет А. С. Пушкина",
    artist: "О. А. Кипренский, 1827",
    wikiTitleRu: "Портрет_А._С._Пушкина_(Кипренский)",
    wikiTitleEn: "Pushkin_by_Kiprensky",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Kiprensky_Pushkin.jpg/640px-Kiprensky_Pushkin.jpg"
  },
  {
    from: 1820, to: 1829,
    title: "Портрет А. С. Пушкина",
    artist: "О. А. Кипренский, 1827",
    wikiTitleRu: "Портрет_А._С._Пушкина_(Кипренский)",
    wikiTitleEn: "Pushkin_by_Kiprensky",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Kiprensky_Pushkin.jpg/640px-Kiprensky_Pushkin.jpg"
  },
  {
    from: 1830, to: 1839,
    title: "Последний день Помпеи",
    artist: "К. П. Брюллов, 1833",
    wikiTitleRu: "Последний_день_Помпеи",
    wikiTitleEn: "The_Last_Day_of_Pompeii",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Karl_Briullov_-_The_Last_Day_of_Pompeii_-_Google_Art_Project.jpg/640px-Karl_Briullov_-_The_Last_Day_of_Pompeii_-_Google_Art_Project.jpg"
  },
  {
    from: 1840, to: 1849,
    title: "Явление Христа народу",
    artist: "А. А. Иванов, 1857",
    wikiTitleRu: "Явление_Христа_народу",
    wikiTitleEn: "The_Appearance_of_Christ_Before_the_People",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Appearance_of_Christ_before_the_people.jpg/640px-Appearance_of_Christ_before_the_people.jpg"
  },
  {
    from: 1850, to: 1859,
    title: "Явление Христа народу",
    artist: "А. А. Иванов, 1857",
    wikiTitleRu: "Явление_Христа_народу",
    wikiTitleEn: "The_Appearance_of_Christ_Before_the_People",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Appearance_of_Christ_before_the_people.jpg/640px-Appearance_of_Christ_before_the_people.jpg"
  },
  {
    from: 1860, to: 1869,
    title: "Тройка",
    artist: "В. Г. Перов, 1866",
    wikiTitleRu: "Тройка_(картина_Перова)",
    wikiTitleEn: "Troika_(Perov)",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Perov_troika.jpg/640px-Perov_troika.jpg"
  },
  {
    from: 1870, to: 1879,
    title: "Грачи прилетели",
    artist: "А. К. Саврасов, 1871",
    wikiTitleRu: "Грачи_прилетели",
    wikiTitleEn: "The_Rooks_Have_Returned",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Savrasov_Grachi_prileteli.jpg/640px-Savrasov_Grachi_prileteli.jpg"
  },
  {
    from: 1880, to: 1889,
    title: "Не ждали",
    artist: "И. Е. Репин, 1888",
    wikiTitleRu: "Не_ждали",
    wikiTitleEn: "They_Did_Not_Expect_Him",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Ilya_Repin_-_They_Did_Not_Expect_Him_-_Google_Art_Project.jpg/640px-Ilya_Repin_-_They_Did_Not_Expect_Him_-_Google_Art_Project.jpg"
  },
  {
    from: 1890, to: 1899,
    title: "Демон сидящий",
    artist: "М. А. Врубель, 1890",
    wikiTitleRu: "Демон_сидящий",
    wikiTitleEn: "Demon_Seated",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Vrubel_demon.jpg/640px-Vrubel_demon.jpg"
  },
  {
    from: 1900, to: 1909,
    title: "Девочка с персиками",
    artist: "В. А. Серов, 1887",
    wikiTitleRu: "Девочка_с_персиками",
    wikiTitleEn: "Girl_with_Peaches",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Valentin_Serov_-_Girl_with_Peaches.jpg/640px-Valentin_Serov_-_Girl_with_Peaches.jpg"
  },
  {
    from: 1910, to: 1919,
    title: "Купание красного коня",
    artist: "К. С. Петров-Водкин, 1912",
    wikiTitleRu: "Купание_красного_коня",
    wikiTitleEn: "Bathing_of_a_Red_Horse",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Kuzma_Petrov-Vodkin_-_Bathing_of_a_Red_Horse.jpg/640px-Kuzma_Petrov-Vodkin_-_Bathing_of_a_Red_Horse.jpg"
  },
  {
    from: 1920, to: 1929,
    title: "Большевик",
    artist: "Б. М. Кустодиев, 1920",
    wikiTitleRu: "Большевик_(картина_Кустодиева)",
    wikiTitleEn: "The_Bolshevik_(painting)",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Kustodiev_bolshevik.jpg/640px-Kustodiev_bolshevik.jpg"
  },
  {
    from: 1930, to: 1939,
    title: "Новая Москва",
    artist: "Ю. И. Пименов, 1937",
    wikiTitleRu: "Новая_Москва_(картина)",
    wikiTitleEn: "New_Moscow_(painting)",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Yuri_Pimenov_New_Moscow_1937.jpg/640px-Yuri_Pimenov_New_Moscow_1937.jpg"
  },
  {
    from: 1940, to: 1949,
    title: "Письмо с фронта",
    artist: "А. И. Лактионов, 1947",
    wikiTitleRu: "Письмо_с_фронта",
    wikiTitleEn: "Letter_from_the_Front",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Laktionov_Pismo_s_fronta.jpg/640px-Laktionov_Pismo_s_fronta.jpg"
  },
  {
    from: 1950, to: 1959,
    title: "Опять двойка",
    artist: "Ф. П. Решетников, 1952",
    wikiTitleRu: "Опять_двойка",
    wikiTitleEn: "Again_a_Fail_Mark",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Reshetnikov_Again_A_Two.jpg/640px-Reshetnikov_Again_A_Two.jpg"
  },
  {
    from: 1960, to: 1969,
    title: "Строители Братска",
    artist: "В. Е. Попков, 1960",
    wikiTitleRu: "Строители_Братска",
    wikiTitleEn: "Builders_of_Bratsk",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Viktor_Popkov_Builders_of_Bratsk.jpg/640px-Viktor_Popkov_Builders_of_Bratsk.jpg"
  },
  {
    from: 1970, to: 1979,
    title: "Московский дворик",
    artist: "В. Д. Поленов, 1878",
    wikiTitleRu: "Московский_дворик",
    wikiTitleEn: "Moscow_Courtyard",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Polenov_Moskovsky_Dvorik.jpg/640px-Polenov_Moskovsky_Dvorik.jpg"
  },
  {
    from: 1980, to: 1989,
    title: "Письмо",
    artist: "Т. Г. Назаренко, 1980-е",
    wikiTitleRu: "",
    wikiTitleEn: "",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/The_Tretyakov_Gallery%2C_Moscow%2C_Russia.jpg/640px-The_Tretyakov_Gallery%2C_Moscow%2C_Russia.jpg"
  },
  {
    from: 1990, to: 1999,
    title: "Черный квадрат",
    artist: "К. С. Малевич, 1915 (икона модернизма)",
    wikiTitleRu: "Чёрный_квадрат",
    wikiTitleEn: "Black_Square_(painting)",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Kazimir_Malevich%2C_1915%2C_Black_Suprematic_Square.jpg/640px-Kazimir_Malevich%2C_1915%2C_Black_Suprematic_Square.jpg"
  },
  {
    from: 2000, to: 2009,
    title: "Работа Эрика Булатова",
    artist: "Эрик Булатов, 2000-е",
    wikiTitleRu: "Булатов,_Эрик_Владимирович",
    wikiTitleEn: "Erik_Bulatov",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Erik_Bulatov.jpg/640px-Erik_Bulatov.jpg"
  },
  {
    from: 2010, to: 2019,
    title: "Работа Павла Пепперштейна",
    artist: "Павел Пепперштейн, 2010-е",
    wikiTitleRu: "Пепперштейн,_Павел_Викторович",
    wikiTitleEn: "Pavel_Pepperstein",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Pepperstein.jpg/640px-Pepperstein.jpg"
  },
  {
    from: 2020, to: 2029,
    title: "Современное искусство России",
    artist: "2020-е",
    wikiTitleRu: "ГЭС-2",
    wikiTitleEn: "GES-2",
    fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/GES-2_Moscow.jpg/640px-GES-2_Moscow.jpg"
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

function normalizeComparable(text) {
  return String(text || "")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9]+/gi, "");
}

function dedupeAuthorInTitle(author, title) {
  const cleanAuthor = String(author || "").trim();
  const cleanTitle = String(title || "").trim();
  if (!cleanAuthor || !cleanTitle) return cleanTitle || "Без названия";

  const authorKey = normalizeComparable(cleanAuthor);
  let out = cleanTitle;

  for (let i = 0; i < 2; i += 1) {
    const m = out.match(/^\s*([^.—–\-:]+)\s*[.—–\-:]\s*(.*)$/u);
    if (!m) break;
    const lead = String(m[1] || "").trim();
    const rest = String(m[2] || "").trim();
    const leadKey = normalizeComparable(lead);

    if (!leadKey) break;
    const isSameAuthor =
      leadKey === authorKey
      || authorKey.startsWith(leadKey)
      || leadKey.startsWith(authorKey);
    if (!isSameAuthor) break;
    out = rest;
  }

  const leadingAuthorPattern = new RegExp(`^\\s*${escapeRegex(cleanAuthor)}\\s*[.\\-–—,:;]*\\s*`, "iu");
  const deduped = out.replace(leadingAuthorPattern, "").trim();
  return deduped || cleanTitle;
}

function normalizeYearText(value) {
  return String(value || "")
    .replace(/[–—]/g, "-")
    .replace(/[−‑‒]/g, "-")
    .replace(/\s+/g, "")
    .trim();
}

function extractYearTokens(value) {
  return Array.from(String(value || "").matchAll(/\b(1[6-9]\d{2}|20\d{2})\b/g), (m) => m[1]);
}

function extractYearRanges(value) {
  const normalized = normalizeYearText(value);
  return Array.from(normalized.matchAll(/(1[6-9]\d{2}|20\d{2})-(1[6-9]\d{2}|20\d{2})/g), (m) => `${m[1]}-${m[2]}`);
}

function isYearAlreadyInTitle(title, year) {
  const y = normalizeYearText(year);
  if (!y) return false;
  const t = normalizeYearText(title);
  if (t.includes(y)) return true;

  const titleYears = new Set(extractYearTokens(title));
  const yearYears = extractYearTokens(year);
  if (yearYears.length && yearYears.every((token) => titleYears.has(token))) return true;

  const titleRanges = new Set(extractYearRanges(title));
  const yearRanges = extractYearRanges(year);
  if (yearRanges.length && yearRanges.every((range) => titleRanges.has(range))) return true;

  return false;
}

function formatMetaLine(author, title, year) {
  const cleanAuthor = String(author || "Не указан").trim() || "Не указан";
  const cleanTitle = String(title || "Без названия").trim() || "Без названия";
  const cleanYear = String(year || "").trim();

  const base = `${cleanAuthor} — ${cleanTitle}`;
  if (!cleanYear || isYearAlreadyInTitle(cleanTitle, cleanYear)) return base;
  return `${base}, ${cleanYear}`;
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
  const fromRu = await loadWikiImage(art.wikiTitleRu || "");
  if (fromRu) return fromRu;
  const fromEn = await loadWikiImage(art.wikiTitleEn || "");
  if (fromEn) return fromEn;
  return String(art.fallbackImage || "");
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
    artTitleNode.textContent = `Знаковое произведение ${art.from}-х: ${art.title}`;
    artMetaNode.textContent = art.artist;
    const artPhoto = await loadAnyWikiImage(art);
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
  quoteMetaNode.textContent = formatMetaLine(quote.author, title, quote.year);
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
