import fs from "node:fs/promises";
import path from "node:path";

const siteDir = path.resolve(process.cwd(), "reputation-case", "site");
const dataPath = path.join(siteDir, "data", "digests.json");
const searchIndexPath = path.join(siteDir, "data", "search-index.json");
const selectedPagePath = path.join(siteDir, "selected", "index.html");
const postsDir = path.join(siteDir, "posts");
const homeIndexPath = path.join(siteDir, "index.html");
const baseUrl = "https://www.klishin.work";
const HOME_FALLBACK_START = "<!-- HTML_FIRST_CARDS_START -->";
const HOME_FALLBACK_END = "<!-- HTML_FIRST_CARDS_END -->";
const HOME_FALLBACK_LIMIT = 8;
const PERSON_NAME = "Ilia Klishin";
const SITE_NAME = "Ilia Klishin";
const DIGEST_NAME = "Ilia Klishin Digest";
const DEFAULT_SOCIAL_IMAGE = `${baseUrl}/bio/ilia-klishin-portrait.jpeg`;
const SOCIAL_IMAGE_WIDTH = "636";
const SOCIAL_IMAGE_HEIGHT = "888";
const PERSON_ID = `${baseUrl}/#person`;
const WEBSITE_ID = `${baseUrl}/#website`;
const ORGANIZATION_ID = `${baseUrl}/#organization`;
const PERSON_ALT_NAMES = ["Ilya Klishin", "Ilia S. Klishin", "Илья Клишин"];
const PERSON_SAME_AS = [
  "https://ru.wikipedia.org/wiki/%D0%9A%D0%BB%D0%B8%D1%88%D0%B8%D0%BD,_%D0%98%D0%BB%D1%8C%D1%8F_%D0%A1%D0%B5%D1%80%D0%B3%D0%B5%D0%B5%D0%B2%D0%B8%D1%87",
  "https://www.theguardian.com/world/2015/jun/08/30-under-30-moscows-young-power-list",
  "https://www.ted.com/tedx/events/3947",
  "https://www.themoscowtimes.com/author/ilya-klishin",
  "https://www.vedomosti.ru/authors/ilya-klishin",
  "https://polutona.ru/?show=1104154256",
  "https://snob.ru/profile/28206/about/",
  "https://snob.ru/profile/28206/blog/",
  "https://rtvi.com/editors-archive/ilya-klishin/",
  "https://kf.agency/articles/biography",
];
const WEBSITE_HAS_PART = [
  `${baseUrl}/#webpage`,
  `${baseUrl}/bio/#webpage`,
  `${baseUrl}/cases/#webpage`,
  `${baseUrl}/contact/#webpage`,
  `${baseUrl}/selected/#webpage`,
  `${baseUrl}/search/#webpage`,
  `${baseUrl}/insights/#webpage`,
  `${baseUrl}/archive/#webpage`,
];
const INDEXABLE_STATIC_SECTIONS = [
  "fr/index.html",
  "de/index.html",
  "es/index.html",
  "selected/index.html",
  "bio/index.html",
  "bio/fr/index.html",
  "bio/de/index.html",
  "bio/es/index.html",
  "cases/index.html",
  "cases/fr/index.html",
  "cases/de/index.html",
  "cases/es/index.html",
];
const STATIC_ROBOTS_POLICY = new Map([
  ["index.html", "index"],
  ["fr/index.html", "index"],
  ["de/index.html", "index"],
  ["es/index.html", "index"],
  ["bio/index.html", "index"],
  ["bio/fr/index.html", "index"],
  ["bio/de/index.html", "index"],
  ["bio/es/index.html", "index"],
  ["cases/index.html", "index"],
  ["cases/fr/index.html", "index"],
  ["cases/de/index.html", "index"],
  ["cases/es/index.html", "index"],
  ["selected/index.html", "index"],
  ["search/index.html", "noindex"],
  ["about/index.html", "noindex"],
  ["contact/index.html", "noindex"],
  ["archive/index.html", "noindex"],
  ["insights/index.html", "noindex"],
  ["insights/fr/index.html", "noindex"],
  ["insights/de/index.html", "noindex"],
  ["insights/es/index.html", "noindex"],
  ["posts/index.html", "noindex"],
  ["posts/drafts.html", "noindex"],
]);
const LANGS = ["EN", "FR", "DE", "ES"];
const HREFLANG_ORDER = ["en", "fr", "de", "es"];
const X_DEFAULT = "x-default";
const isPublishedStatus = (value = "") => String(value || "").trim().toLowerCase() === "ready";
const toHtmlLang = (value = "") => {
  const lang = String(value || "").toUpperCase();
  if (lang === "EN") return "en";
  if (lang === "FR") return "fr";
  if (lang === "DE") return "de";
  if (lang === "ES") return "es";
  return "en";
};

const htmlEscape = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const xmlEscape = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const slugify = (text = "") =>
  String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72) || "item";

const toIsoTimestamp = (value = "") => {
  const ts = Date.parse(String(value || ""));
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toISOString();
};

const canonicalUrl = (relativePath = "") => {
  const clean = String(relativePath || "").replace(/^\/+/, "");
  if (!clean || clean === "index.html") return `${baseUrl}/`;
  if (clean.endsWith("/index.html")) {
    const dir = clean.slice(0, -"/index.html".length);
    return `${baseUrl}/${dir}/`;
  }
  return `${baseUrl}/${clean}`;
};

const decodeHtmlEntities = (value = "") =>
  String(value || "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

const htmlToText = (value = "") =>
  decodeHtmlEntities(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const normalizeSourceUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  try {
    return new URL(raw, `${baseUrl}/`).toString();
  } catch {
    return raw;
  }
};

const latestBuildIso = (entries) => {
  let latest = null;
  for (const entry of entries) {
    const iso = toIsoTimestamp(entry?.item?.date);
    if (!iso) continue;
    if (!latest || iso > latest) latest = iso;
  }
  return latest || "1970-01-01T00:00:00.000Z";
};

const truncateChars = (text = "", max = 220) => {
  const plain = String(text || "").replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).trim()}…`;
};

const normalizedArray = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const next = String(raw || "").replace(/\s+/g, " ").trim();
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
};

const MACHINE_FRAGMENT_PATTERNS = [
  /\bmapped as\b/i,
  /\bmachine[- ]?readable\b/i,
  /\bsource[- ]?linked\b/i,
  /\bentity disambiguation\b/i,
  /\bsearch\/llm\/indexing\b/i,
  /\bllm\b/i,
  /\bindexing\b/i,
  /\bthis page structures the topic\b/i,
  /\bit structures the topic\b/i,
  /\bthis card is valuable for timeline checks\b/i,
  /\bas a dated source from\b/i,
  /\bhelps verify chronology actors\b/i,
  /\bcausal framing\b/i,
  /\bmultilingual materials\b/i,
  /\bpublic records\b/i,
  /\battributable sourcing\b/i,
  /\bnamed actors\b/i,
  /\bdated events\b/i,
  /\bpublication context\b/i,
  /\bcontrole de timeline\b/i,
  /\btimeline pruefung\b/i,
  /\bchronologie akteure\b/i,
  /\bkausalbezuge\b/i,
];

const TECHNICAL_TAG_PATTERNS = [
  /^language-[a-z]{2}$/i,
  /^reference-\d+$/i,
  /^year-\d{4}$/i,
  /^source-verification$/i,
  /^machine-readable$/i,
  /^source-linked$/i,
  /^entity-disambiguation$/i,
  /^indexing$/i,
  /^llm$/i,
];

const normalizeText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

const cleanDisplayTitle = (rawTitle = "") => {
  const raw = normalizeText(rawTitle);
  if (!raw) return "Untitled";
  const cleaned = raw
    .replace(/\s+\(\d{4}-\d{2}-\d{2}\)\s*$/i, "")
    .replace(/^(.{3,120}?)\s*\(\d{4}-\d{2}-\d{2}\)\s*-\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || raw;
};

const smartTrim = (text = "", max = 80) => {
  const value = normalizeText(text);
  if (!value) return "";
  if (value.length <= max) return value;
  const clipped = value.slice(0, max).replace(/\s+\S*$/, "").trim();
  return clipped || value.slice(0, max).trim();
};

const trimMetaDescription = (text = "", max = 170) => {
  const value = normalizeText(text);
  if (!value) return "";
  if (value.length <= max) return /[.!?]$/.test(value) ? value : `${value}.`;
  const clipped = value.slice(0, max).replace(/\s+\S*$/, "").trim();
  if (!clipped) return value.slice(0, max).trim();
  return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
};

const GENERIC_SOURCE_TITLE_RE =
  /^(?:The Moscow Times(?:\s+(?:RU|EN))?|Vedomosti|Snob|Republic|OpenSpace\/Colta|MEL\.?fm|News24|Wikinews|Lenta|The Village|AdIndex|Ambivert|7x7|RTVI|TV Rain|Freedom House|TEDx\s*\/\s*TED\.com|YouTube\s*\/\s*TED)\s*\(\d{4}-\d{2}-\d{2}\)(?:\s*-\s*.+)?$/i;
const SOURCE_ONLY_TITLE_RE =
  /^(?:The Moscow Times(?:\s+(?:RU|EN))?|Vedomosti|Snob|Republic|OpenSpace\/Colta|MEL\.?fm|News24|Wikinews|Lenta|The Village|AdIndex|Ambivert|7x7|RTVI|TV Rain|Freedom House|TEDx\s*\/\s*TED\.com|YouTube\s*\/\s*TED)$/i;

const buildPostMetaTitle = (item = {}, displayTitle = "") => {
  const source = normalizeText(item?.source || "Publication");
  const topic = normalizeText(item?.topic || "");
  const date = normalizeText(item?.date || "");
  const raw = normalizeText(displayTitle || item?.title || "");
  const looksGeneric =
    !raw ||
    raw.length < 12 ||
    /^untitled$/i.test(raw) ||
    /^entry$/i.test(raw) ||
    GENERIC_SOURCE_TITLE_RE.test(raw) ||
    SOURCE_ONLY_TITLE_RE.test(raw);

  let core = raw;
  if (looksGeneric) {
    if (source && topic) {
      core = `${source}: ${topic}`;
    } else if (source && date) {
      core = `${source} (${date})`;
    } else {
      core = source || "Publication";
    }
  }

  return smartTrim(core, 82);
};

const buildPostMetaDescription = (item = {}) => {
  const lang = normalizeLang(item?.language);
  const source = normalizeText(item?.source || "");
  const topic = normalizeText(item?.topic || "");
  const date = normalizeText(item?.date || "");
  const extracted = extractMetaSentence(item);

  let summary = extracted;
  if (!summary) {
    if (lang === "FR") {
      summary = `${source || "La publication"}${date ? ` (${date})` : ""} propose une analyse sur ${topic || "le sujet"} avec contexte editorial.`;
    } else if (lang === "DE") {
      summary = `${source || "Der Beitrag"}${date ? ` (${date})` : ""} bietet eine Analyse zu ${topic || "dem Thema"} mit publizistischem Kontext.`;
    } else if (lang === "ES") {
      summary = `${source || "La publicacion"}${date ? ` (${date})` : ""} ofrece un analisis sobre ${topic || "el tema"} con contexto editorial.`;
    } else {
      summary = `${source || "This publication"}${date ? ` (${date})` : ""} provides analysis on ${topic || "the topic"} with clear editorial context.`;
    }
  }

  let value = summary;
  if (source && !new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(value)) {
    if (lang === "DE") value = `${value} Quelle: ${source}${date ? `, ${date}` : ""}.`;
    else if (lang === "ES") value = `${value} Fuente: ${source}${date ? `, ${date}` : ""}.`;
    else value = `${value} Source: ${source}${date ? `, ${date}` : ""}.`;
  } else if (date && !value.includes(date)) {
    if (lang === "FR") value = `${value} Date de publication: ${date}.`;
    else if (lang === "DE") value = `${value} Veroeffentlicht: ${date}.`;
    else if (lang === "ES") value = `${value} Publicado: ${date}.`;
    else value = `${value} Published: ${date}.`;
  }
  return trimMetaDescription(value, 170);
};

const composeCardMeta = (item = {}) => {
  const source = normalizeText(item?.source || "-");
  const date = normalizeText(item?.date || "-");
  return `${source} • ${date}`;
};

const isShowcaseCandidate = (item = {}) => {
  const title = normalizeText(item?.title || "");
  const source = normalizeText(item?.source || "").toLowerCase();
  const topic = normalizeText(item?.topic || "").toLowerCase();
  if (!title) return false;
  if (/\(\d{4}-\d{2}-\d{2}\)\s*$/i.test(title)) return false;
  if (source === "methodology") return false;
  if (topic.includes("editorial standard")) return false;
  return true;
};

const sanitizeSemanticTags = (tags = []) =>
  normalizedArray(tags).filter((tag) => {
    const value = normalizeText(tag).toLowerCase();
    if (!value) return false;
    if (TECHNICAL_TAG_PATTERNS.some((pattern) => pattern.test(value))) return false;
    return true;
  });

const countWords = (text = "") =>
  normalizeText(text)
    .split(/\s+/)
    .filter(Boolean).length;

const hasMachineText = (text = "") => {
  const value = normalizeText(text);
  if (!value) return false;
  return MACHINE_FRAGMENT_PATTERNS.some((pattern) => pattern.test(value));
};

const quoteCount = (item = {}) => {
  const list = Array.isArray(item?.quotes) ? item.quotes : [item?.quote].filter(Boolean);
  return list.map((x) => normalizeText(x)).filter(Boolean).length;
};

const isQaReviewedPost = (item = {}) => {
  const summary = normalizeText(item?.summary || item?.digest || "");
  const words = countWords(summary);
  const keyIdeas = normalizedArray(item?.key_ideas);
  if (!summary) return false;
  if (words < 75 || words > 150) return false;
  if (keyIdeas.length < 3) return false;
  if (quoteCount(item) < 2) return false;
  return true;
};

const isIndexablePost = (item = {}) =>
  isPublishedStatus(item?.status) && isShowcaseCandidate(item) && isQaReviewedPost(item);

const stripLeadScaffolding = (text = "") =>
  normalizeText(text)
    .replace(
      /^This\s+.+?\s+piece\s+\(\d{4}-\d{2}-\d{2}\)\s+examines\s+a\s+concrete\s+case\s+related\s+to\s+Ilia\s+Klishin\s+and\s+situates\s+the\s+stakes\s+of\s+.+?\.\s*/i,
      ""
    )
    .replace(
      /^In\s+this\s+\d{4}-\d{2}-\d{2}\s+.+?\s+article,\s+the\s+central\s+argument\s+is\s+how\s+/i,
      ""
    )
    .replace(/^Published in .+? this text is mapped as .+?\.\s*/i, "")
    .replace(/^Publie par .+? le \d{4}-\d{2}-\d{2},\s*/i, "")
    .replace(/^Dieser Beitrag in .+? \(\d{4}-\d{2}-\d{2}\)\s+untersucht.+?\.\s*/i, "")
    .replace(/\s*In the \d{4}-\d{2}-\d{2} context, Ilia Klishin connects.+$/i, "")
    .replace(/^(?:[A-Z][a-z]{2,9}\.?\s*)?\d{1,2},\s+\d{4}\s+/i, "")
    .trim();

const splitSentences = (text = "") => {
  const matches = String(text || "").match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!Array.isArray(matches)) return [];
  return matches
    .map((sentence) =>
      sentence
        .replace(/^(?:[A-Z][a-z]{2,9}\.?\s*)?\d{1,2},\s+\d{4}\s+/, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
};

const hasMachineFragments = (sentence = "") =>
  MACHINE_FRAGMENT_PATTERNS.some((pattern) => pattern.test(String(sentence || "").trim()));

const TEMPLATE_SENTENCE_PATTERNS = [
  /^(this|ce texte|este texto|dieser beitrag|in diesem|la fiche|la carte|der eintrag)\b/i,
  /\bexamines a concrete case related to ilia klishin\b/i,
  /\bexamine un cas concret lie a ilia klishin\b/i,
  /\bexamina un caso concreto vinculado con ilia klishin\b/i,
  /\buntersucht einen konkreten fall mit bezug zu ilia klishin\b/i,
  /\bthe text rebuilds the discussion\b/i,
  /\bla fiche recompone el caso\b/i,
  /\bla carte reconstitue le dossier\b/i,
  /\bder eintrag ordnet das thema\b/i,
  /^im kontext \d{4}-\d{2}-\d{2}\s+verbindet ilia klishin/i,
  /^dans le contexte \d{4}-\d{2}-\d{2}\s+ilia klishin/i,
  /^en el contexto \d{4}-\d{2}-\d{2}\s+ilia klishin/i,
  /^in the \d{4}-\d{2}-\d{2} context,\s+ilia klishin/i,
];

const isTemplateSentence = (sentence = "") =>
  TEMPLATE_SENTENCE_PATTERNS.some((pattern) => pattern.test(normalizeText(sentence)));

const extractMetaSentence = (item = {}) => {
  const pools = [item?.summary, item?.digest, item?.value_context];
  for (const pool of pools) {
    const cleaned = stripLeadScaffolding(normalizeText(pool || ""));
    if (!cleaned) continue;
    for (const sentence of splitSentences(cleaned)) {
      const value = normalizeText(sentence);
      if (!value || value.length < 40) continue;
      if (hasMachineFragments(value)) continue;
      if (isTemplateSentence(value)) continue;
      return value;
    }
  }
  return "";
};

const hashText = (value = "") => {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const previewSummary = (item = {}) => {
  const raw = normalizeText(item?.summary || item?.digest || "");
  if (!raw) return "";

  const cleaned = stripLeadScaffolding(raw) || raw;
  const candidates = splitSentences(cleaned).filter((sentence) => !hasMachineFragments(sentence));
  const source = candidates.length > 0 ? candidates : [];
  if (source.length === 0) return fallbackSummary(item);

  const selected = [];
  let total = 0;
  for (const sentence of source) {
    const lengthWithGap = sentence.length + (selected.length > 0 ? 1 : 0);
    if (selected.length >= 2 && total + lengthWithGap > 360) break;
    if (selected.length >= 3) break;
    selected.push(sentence);
    total += lengthWithGap;
  }

  let preview = selected.join(" ").trim();
  if (!preview) preview = source[0] || "";
  if (preview.length > 380) {
    preview = preview.slice(0, 380).replace(/\s+\S*$/, "").trim();
  }
  if (!/[.!?]$/.test(preview)) preview += ".";
  return preview.replace(/^[a-z]/, (char) => char.toUpperCase());
};

const fallbackSummary = (item = {}) => {
  const topic = normalizeText(item?.topic || "the topic");
  const source = normalizeText(item?.source || "the source");
  const year = /^\d{4}/.test(String(item?.date || "")) ? String(item.date).slice(0, 4) : "";
  const lang = normalizeLang(item?.language);
  if (lang === "FR") {
    return `Ce texte de ${source}${year ? ` (${year})` : ""} explique l enjeu principal autour de ${topic} et resitue le contexte de publication.`;
  }
  if (lang === "DE") {
    return `Der Beitrag aus ${source}${year ? ` (${year})` : ""} erklaert den Kernpunkt zu ${topic} und ordnet den Publikationskontext ein.`;
  }
  if (lang === "ES") {
    return `Este texto de ${source}${year ? ` (${year})` : ""} explica la idea central sobre ${topic} y ubica su contexto de publicacion.`;
  }
  return `This piece from ${source}${year ? ` (${year})` : ""} explains the central issue in ${topic} and anchors it in publication context.`;
};

const fallbackContext = (item = {}) => {
  const topic = normalizeText(item?.topic || "the topic");
  const source = normalizeText(item?.source || "the source");
  const lang = normalizeLang(item?.language);
  const year = /^\d{4}/.test(String(item?.date || "")) ? String(item.date).slice(0, 4) : "";
  const key = hashText(item?.id || `${topic}-${source}`);
  const stamp = year ? ` (${year})` : "";
  if (lang === "FR") {
    const variants = [
      `Repere utile: ce texte situe ${topic} dans son contexte editorial${stamp}.`,
      `Repere utile: la fiche resume ${topic} et renvoie au texte original sur ${source}.`,
      `Repere utile: cette publication donne un point de reference date sur ${topic}.`,
      `Repere utile: le lecteur retrouve ${topic} avec une source primaire verifiable.`,
    ];
    return variants[key % variants.length];
  }
  if (lang === "DE") {
    const variants = [
      `Nuetzlicher Kontext: Der Beitrag ordnet ${topic} im Zeitrahmen${stamp} ein.`,
      `Nuetzlicher Kontext: Die Karte fasst ${topic} zusammen und verlinkt auf ${source}.`,
      `Nuetzlicher Kontext: Diese Quelle bietet einen datierten Referenzpunkt zu ${topic}.`,
      `Nuetzlicher Kontext: ${topic} wird mit direktem Zugang zur Primaerquelle erklaert.`,
    ];
    return variants[key % variants.length];
  }
  if (lang === "ES") {
    const variants = [
      `Contexto util: el texto ubica ${topic} en su momento editorial${stamp}.`,
      `Contexto util: esta ficha resume ${topic} y enlaza al original en ${source}.`,
      `Contexto util: ofrece un punto de referencia fechado para ${topic}.`,
      `Contexto util: explica ${topic} con acceso directo a la fuente primaria.`,
    ];
    return variants[key % variants.length];
  }
  const variants = [
    `Why it matters: it places ${topic} in a concrete editorial moment${stamp}.`,
    `Why it matters: it gives a dated reference point for ${topic} and links to ${source}.`,
    `Why it matters: it helps compare current claims on ${topic} with the original text.`,
    `Why it matters: it explains ${topic} with direct access to the primary source.`,
  ];
  return variants[key % variants.length];
};

const previewContext = (item = {}) => {
  const raw = normalizeText(item?.value_context || "");
  if (!raw) return fallbackContext(item);
  const cleaned = stripLeadScaffolding(raw) || raw;
  const candidates = splitSentences(cleaned).filter((sentence) => !hasMachineFragments(sentence));
  let context = candidates[0] || "";
  if (!context || context.length < 36) context = fallbackContext(item);
  if (context.length > 200) {
    context = context.slice(0, 200).replace(/\s+\S*$/, "").trim();
    if (!/[.!?]$/.test(context)) context += ".";
  }
  return context;
};

const pickCardQuote = (item = {}) => {
  const candidates =
    Array.isArray(item?.quotes) && item.quotes.length > 0
      ? item.quotes
      : [item?.quote].filter(Boolean);
  for (const raw of candidates) {
    const value = normalizeText(raw);
    if (!value) continue;
    if (hasMachineFragments(value)) continue;
    const quoteCore = value
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .replace(/\s*[-–—]\s*[^-–—]+$/g, "")
      .trim();
    const quoteComparable = quoteCore.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const titleComparable = String(item?.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (quoteComparable && titleComparable) {
      const shorter = Math.min(quoteComparable.length, titleComparable.length);
      const longer = Math.max(quoteComparable.length, titleComparable.length);
      const mostlySame = shorter > 10 && longer > 0 && shorter / longer >= 0.8;
      if (
        quoteComparable === titleComparable ||
        (mostlySame && (quoteComparable.includes(titleComparable) || titleComparable.includes(quoteComparable)))
      ) {
        continue;
      }
    }
    return value;
  }
  return "";
};

const escapeRegExp = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const lower = (value = "") => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

const normalizeLang = (value = "") => {
  const lang = String(value || "").trim().toUpperCase();
  if (LANGS.includes(lang)) return lang;
  return "EN";
};

const parseDateForSort = (value = "") => {
  const ts = Date.parse(String(value || ""));
  return Number.isNaN(ts) ? 0 : ts;
};

const sortEntriesByDateDesc = (a, b) => {
  const delta = parseDateForSort(b?.item?.date) - parseDateForSort(a?.item?.date);
  if (delta !== 0) return delta;
  return String(a?.item?.id || "").localeCompare(String(b?.item?.id || ""));
};

const sortHreflangAlternates = (items) =>
  items
    .slice()
    .sort((a, b) => {
      const aPos = HREFLANG_ORDER.indexOf(a.hreflang);
      const bPos = HREFLANG_ORDER.indexOf(b.hreflang);
      return (aPos === -1 ? 99 : aPos) - (bPos === -1 ? 99 : bPos);
    });

const buildLanguageClusters = (items) => {
  const idToCluster = new Map();

  for (const item of items) {
    if (normalizeLang(item?.language) !== "EN") continue;
    const enId = String(item?.id || "").trim();
    if (!enId) continue;

    const cluster = { EN: enId };
    for (const [rawLang, rawId] of Object.entries(item?.copies || {})) {
      const lang = normalizeLang(rawLang);
      const id = String(rawId || "").trim();
      if (!id) continue;
      cluster[lang] = id;
    }

    for (const id of Object.values(cluster)) {
      idToCluster.set(id, cluster);
    }
  }

  for (const item of items) {
    const id = String(item?.id || "").trim();
    if (!id || idToCluster.has(id)) continue;
    idToCluster.set(id, { [normalizeLang(item?.language)]: id });
  }

  return idToCluster;
};

const getAlternatesForItem = (item, idToPostPath, idToCluster, idToStatus = new Map(), onlyPublished = false) => {
  const itemId = String(item?.id || "").trim();
  const selfLang = toHtmlLang(item?.language);
  const cluster = idToCluster.get(itemId) || { [normalizeLang(item?.language)]: itemId };
  const rawAlternates = [];

  for (const [clusterLang, clusterId] of Object.entries(cluster)) {
    if (onlyPublished) {
      const status = String(idToStatus.get(clusterId) || "").toLowerCase();
      if (!isPublishedStatus(status)) continue;
    }
    const postPath = idToPostPath.get(clusterId);
    if (!postPath) continue;
    rawAlternates.push({
      hreflang: toHtmlLang(clusterLang),
      href: canonicalUrl(`posts/${postPath}`),
      id: clusterId,
    });
  }

  if (!rawAlternates.some((alt) => alt.id === itemId)) {
    const selfPath = idToPostPath.get(itemId);
    if (selfPath) {
      rawAlternates.push({
        hreflang: selfLang,
        href: canonicalUrl(`posts/${selfPath}`),
        id: itemId,
      });
    }
  }

  const dedupe = new Map();
  for (const alt of rawAlternates) {
    const key = `${alt.hreflang}::${alt.href}`;
    if (!dedupe.has(key)) dedupe.set(key, alt);
  }
  const alternates = sortHreflangAlternates([...dedupe.values()]);

  const preferredXDefaultId = String(cluster.EN || itemId || "").trim();
  const preferredPath = idToPostPath.get(preferredXDefaultId) || idToPostPath.get(itemId);
  const xDefaultHref = preferredPath ? canonicalUrl(`posts/${preferredPath}`) : null;

  return { alternates, xDefaultHref };
};

const buildHeadHreflangLinks = (alternates, xDefaultHref) => {
  const out = [];
  for (const alt of alternates) {
    out.push(`<link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}" />`);
  }
  if (xDefaultHref) {
    out.push(`<link rel="alternate" hreflang="${X_DEFAULT}" href="${xDefaultHref}" />`);
  }
  return out.join("\n    ");
};

const buildCoreEntities = () => {
  const person = {
    "@type": "Person",
    "@id": PERSON_ID,
    name: PERSON_NAME,
    alternateName: PERSON_ALT_NAMES,
    url: canonicalUrl("index.html"),
    sameAs: PERSON_SAME_AS,
  };
  const organization = {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: DIGEST_NAME,
    url: canonicalUrl("index.html"),
    founder: { "@id": PERSON_ID },
    sameAs: [canonicalUrl("index.html"), canonicalUrl("archive/index.html")],
  };
  const website = {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: canonicalUrl("index.html"),
    inLanguage: ["en", "fr", "de", "es"],
    publisher: { "@id": ORGANIZATION_ID },
    about: { "@id": PERSON_ID },
    hasPart: WEBSITE_HAS_PART.map((id) => ({ "@id": id })),
    potentialAction: {
      "@type": "SearchAction",
      target: `${canonicalUrl("search/index.html")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return { person, organization, website };
};

const normalizeSearchUrl = (href = "") => {
  const raw = String(href || "").trim();
  if (!raw) return canonicalUrl("selected/index.html");
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return canonicalUrl(raw.slice(1));
  return canonicalUrl(raw);
};

const extractSelectedCards = async () => {
  let html;
  try {
    html = await fs.readFile(selectedPagePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const sections = [...html.matchAll(/<section class="cluster" id="([^"]+)">([\s\S]*?)<\/section>/gim)];
  const cards = [];

  for (const sectionMatch of sections) {
    const sectionId = String(sectionMatch[1] || "").trim();
    const sectionHtml = String(sectionMatch[2] || "");
    const sectionTitle = htmlToText(sectionHtml.match(/<h2>([\s\S]*?)<\/h2>/i)?.[1] || sectionId);
    const sectionIntro = htmlToText(sectionHtml.match(/<p class="cluster-intro">([\s\S]*?)<\/p>/i)?.[1] || "");

    const cardMatches = [...sectionHtml.matchAll(/<article class="work-card">([\s\S]*?)<\/article>/gim)];
    for (const cardMatch of cardMatches) {
      const cardHtml = String(cardMatch[1] || "");
      const title = htmlToText(cardHtml.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1] || "");
      if (!title) continue;

      const intro = htmlToText(cardHtml.match(/<p class="work-intro">([\s\S]*?)<\/p>/i)?.[1] || "");
      const whyRaw = htmlToText(cardHtml.match(/<p class="work-why">([\s\S]*?)<\/p>/i)?.[1] || "");
      const why = whyRaw.replace(/^Why this matters:\s*/i, "").trim();
      const type = htmlToText(cardHtml.match(/<li><strong>Type:<\/strong>\s*([\s\S]*?)<\/li>/i)?.[1] || "");
      const date = htmlToText(cardHtml.match(/<li><strong>Date:<\/strong>\s*([\s\S]*?)<\/li>/i)?.[1] || "");

      const linkCandidates = [...cardHtml.matchAll(/<a\s+href="([^"]+)"/gi)].map((m) => String(m[1] || "").trim());
      const digestLink = linkCandidates.find((href) => href.startsWith("/posts/"));
      const preferredLink = digestLink || linkCandidates[0] || `/selected/#${sectionId}`;
      const originalLink = linkCandidates.find((href) => /^https?:\/\//i.test(href)) || "";

      cards.push({
        id: `selected-${sectionId}-${cards.length + 1}`,
        type: "selected",
        language: "EN",
        title,
        summary: intro,
        context: why,
        topic: sectionTitle,
        source: "Selected Work",
        date: date || "",
        material_type: type || "Curated card",
        section: sectionTitle,
        section_intro: sectionIntro,
        url: normalizeSearchUrl(preferredLink),
        source_url: normalizeSearchUrl(originalLink || preferredLink),
      });
    }
  }

  return cards;
};

const buildSearchIndex = (entries, selectedCards) => {
  const publishedCards = entries
    .filter((entry) => isPublishedStatus(entry?.item?.status))
    .filter((entry) => isShowcaseCandidate(entry?.item))
    .map((entry) => {
      const item = entry.item || {};
      return {
        id: String(item.id || "").trim() || entry.postPath.replace(/\.html$/i, ""),
        type: "post",
        language: normalizeLang(item.language),
        status: "ready",
        title: cleanDisplayTitle(item.title || "Untitled"),
        summary: previewSummary(item),
        context: previewContext(item),
        topic: normalizeText(item.topic || ""),
        source: normalizeText(item.source || ""),
        date: normalizeText(item.date || ""),
        material_type: "Digest card",
        url: canonicalUrl(`posts/${entry.postPath}`),
        source_url: normalizeSourceUrl(item.url),
        semantic_tags: sanitizeSemanticTags(normalizedArray(item.semantic_tags)),
      };
    });

  const selected = Array.isArray(selectedCards) ? selectedCards : [];
  const items = [...publishedCards, ...selected];
  const generatedAt = latestBuildIso(entries);

  return {
    generated_at: generatedAt,
    counts: {
      total: items.length,
      posts: publishedCards.length,
      selected: selected.length,
    },
    items,
  };
};

const pickUniqueEntries = (entries, max, used) => {
  const out = [];
  for (const entry of entries) {
    const id = String(entry?.item?.id || "").trim();
    if (!id || used.has(id)) continue;
    used.add(id);
    out.push(entry);
    if (out.length >= max) break;
  }
  return out;
};

const buildRelatedPostGroups = (item, entries) => {
  const itemId = String(item?.id || "").trim();
  const itemLang = normalizeLang(item?.language);
  const itemTopic = lower(item?.topic);
  const itemSource = lower(item?.source);

  const candidates = entries.filter(
    (entry) => String(entry?.item?.id || "").trim() !== itemId && isShowcaseCandidate(entry?.item)
  );
  const sameLang = candidates
    .filter((entry) => normalizeLang(entry?.item?.language) === itemLang)
    .sort(sortEntriesByDateDesc);

  const sameTopicLang = sameLang.filter((entry) => lower(entry?.item?.topic) === itemTopic);
  const sameTopicAny = candidates
    .filter((entry) => lower(entry?.item?.topic) === itemTopic)
    .sort(sortEntriesByDateDesc);

  const sameSourceLang = sameLang.filter((entry) => lower(entry?.item?.source) === itemSource);
  const sameSourceAny = candidates
    .filter((entry) => lower(entry?.item?.source) === itemSource)
    .sort(sortEntriesByDateDesc);

  const used = new Set();
  const relatedByTopic = [
    ...pickUniqueEntries(sameTopicLang, 3, used),
    ...pickUniqueEntries(sameTopicAny, 3, used),
  ].slice(0, 3);

  const relatedBySource = [
    ...pickUniqueEntries(sameSourceLang, 3, used),
    ...pickUniqueEntries(sameSourceAny, 3, used),
  ].slice(0, 3);

  const latestSameLanguage = pickUniqueEntries(sameLang, 3, used);

  return { relatedByTopic, relatedBySource, latestSameLanguage };
};

const buildRelatedLinks = (entries) =>
  entries.map((entry) => {
    const href = canonicalUrl(`posts/${entry.postPath}`);
    const title = htmlEscape(cleanDisplayTitle(String(entry?.item?.title || "Untitled")));
    const source = htmlEscape(String(entry?.item?.source || "-"));
    const date = htmlEscape(String(entry?.item?.date || "-"));
    return `<li><a href="${href}">${title}</a> — ${source} • ${date}</li>`;
  });

const homeStatusRank = (value = "") => (String(value || "").toLowerCase() === "ready" ? 0 : 1);

const sortEntriesForHome = (a, b) => {
  const statusDelta = homeStatusRank(a?.item?.status) - homeStatusRank(b?.item?.status);
  if (statusDelta !== 0) return statusDelta;
  return sortEntriesByDateDesc(a, b);
};

const pickHomeFallbackEntries = (entries, limit) => {
  const published = entries
    .slice()
    .sort(sortEntriesForHome)
    .filter((entry) => isPublishedStatus(entry?.item?.status))
    .filter((entry) => isShowcaseCandidate(entry?.item));
  if (!published.length) return [];

  const byLang = new Map();
  for (const entry of published) {
    const lang = normalizeLang(entry?.item?.language);
    if (!byLang.has(lang)) byLang.set(lang, []);
    byLang.get(lang).push(entry);
  }

  const preferredLang = byLang.has("EN")
    ? "EN"
    : [...byLang.keys()].sort((a, b) => a.localeCompare(b))[0];
  return (byLang.get(preferredLang) || []).slice(0, limit);
};

const buildHomeFallbackCards = (entries) => {
  const top = pickHomeFallbackEntries(entries, HOME_FALLBACK_LIMIT);
  if (top.length === 0) {
    return `        <div class="empty">No published cards are available in the public feed yet.</div>`;
  }
  return top
    .map((entry) => {
      const item = entry.item || {};
      const lang = htmlEscape(String(item.language || "-"));
      const title = htmlEscape(cleanDisplayTitle(item.title || "Untitled"));
      const meta = htmlEscape(composeCardMeta(item));
      const digest = htmlEscape(previewSummary(item));
      const context = htmlEscape(previewContext(item));
      const quote = htmlEscape(pickCardQuote(item));
      const digestHref = canonicalUrl(`posts/${entry.postPath}`);
      return `        <article class="card">
          <div class="card-head">
            <span class="lang-tag">${lang}</span>
          </div>
          <h3 class="card-title">${title}</h3>
          <p class="card-meta">${meta}</p>
          <p class="card-digest">${digest}</p>
          <p class="card-context">${context}</p>
          ${quote ? `<blockquote class="card-quote">${quote}</blockquote>` : ""}
          <a class="card-link" href="${digestHref}">Open digest card</a>
        </article>`;
    })
    .join("\n");
};

const updateHomeHtmlFirstCards = async (entries) => {
  const html = await fs.readFile(homeIndexPath, "utf8");
  if (!html.includes(HOME_FALLBACK_START) || !html.includes(HOME_FALLBACK_END)) {
    throw new Error(`Missing fallback markers in ${homeIndexPath}.`);
  }
  const replacement = `${HOME_FALLBACK_START}
${buildHomeFallbackCards(entries)}
        ${HOME_FALLBACK_END}`;
  const re = new RegExp(`${escapeRegExp(HOME_FALLBACK_START)}[\\s\\S]*?${escapeRegExp(HOME_FALLBACK_END)}`, "m");
  const next = html.replace(re, replacement);
  await fs.writeFile(homeIndexPath, next, "utf8");
};

const applyStaticRobotsPolicies = async () => {
  for (const [relativePath, policy] of STATIC_ROBOTS_POLICY.entries()) {
    const fullPath = path.join(siteDir, relativePath);
    let html;
    try {
      html = await fs.readFile(fullPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    const robotsValue =
      policy === "index" ? "index,follow,max-image-preview:large" : "noindex,follow,max-image-preview:large";
    if (/<meta\s+name=["']robots["']/i.test(html)) {
      html = html.replace(
        /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i,
        `<meta name="robots" content="${robotsValue}" />`
      );
    } else {
      html = html.replace(/<head>/i, `<head>\n    <meta name="robots" content="${robotsValue}" />`);
    }
    await fs.writeFile(fullPath, html, "utf8");
  }
};

const buildPostHtml = (item, postPath, idToPostPath, idToCluster, entries, idToStatus = new Map()) => {
  const itemId = String(item?.id || "").trim();
  const decision = String(idToStatus.get(itemId) || item?.status || "").toLowerCase();
  const itemIsPublished = isPublishedStatus(decision);
  const displayTitle = cleanDisplayTitle(item.title);
  const metaTitle = buildPostMetaTitle(item, displayTitle);
  const title = `${metaTitle} | ${SITE_NAME}`;
  const summary = String(item.summary || item.digest || "").replace(/\s+/g, " ").trim();
  const digest = String(item.digest || summary || "").replace(/\s+/g, " ").trim();
  const description = buildPostMetaDescription(item) || "Source-linked publication summary and context.";
  const keyIdeas = normalizedArray(item.key_ideas);
  const quotes = normalizedArray(item.quotes);
  const semanticTags = normalizedArray(item.semantic_tags);
  const publicSemanticTags = sanitizeSemanticTags(semanticTags);
  const valueContext = String(item.value_context || "").replace(/\s+/g, " ").trim();
  const canonical = canonicalUrl(postPath);
  const sourceLink = normalizeSourceUrl(item.url);
  const htmlLang = toHtmlLang(item.language);
  const { alternates, xDefaultHref } = getAlternatesForItem(
    item,
    idToPostPath,
    idToCluster,
    idToStatus,
    itemIsPublished
  );
  const hreflangHeadLinks = buildHeadHreflangLinks(alternates, xDefaultHref);
  const languageLinks = alternates.map(
    (alt) =>
      `<li><a href="${htmlEscape(alt.href)}">${htmlEscape(String(alt.hreflang).toUpperCase())}</a></li>`
  );
  const { relatedByTopic, relatedBySource, latestSameLanguage } = buildRelatedPostGroups(item, entries);
  const topicLinks = buildRelatedLinks(relatedByTopic);
  const sourceLinks = buildRelatedLinks(relatedBySource);
  const latestLanguageLinks = buildRelatedLinks(latestSameLanguage);
  const { person, organization, website } = buildCoreEntities();
  const pageId = `${canonical}#webpage`;
  const articleId = `${canonical}#article`;
  const publishedIso = toIsoTimestamp(item.date) || item.date || undefined;
  const modifiedIso = toIsoTimestamp(item.lastmod || item.date) || publishedIso;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      person,
      organization,
      website,
      {
        "@type": "WebPage",
        "@id": pageId,
        url: canonical,
        name: displayTitle,
        inLanguage: htmlLang,
        isPartOf: { "@id": WEBSITE_ID },
        about: { "@id": PERSON_ID },
      },
      {
        "@type": "Article",
        "@id": articleId,
        headline: displayTitle,
        description,
        inLanguage: htmlLang,
        datePublished: publishedIso,
        dateModified: modifiedIso,
        author: {
          "@type": "Person",
          "@id": PERSON_ID,
          name: PERSON_NAME,
          url: canonicalUrl("index.html"),
        },
        publisher: {
          "@type": "Organization",
          "@id": ORGANIZATION_ID,
          name: DIGEST_NAME,
          url: canonicalUrl("index.html"),
        },
        isPartOf: { "@id": WEBSITE_ID },
        mainEntityOfPage: { "@id": pageId },
        about: { "@id": PERSON_ID },
        url: canonical,
        citation: sourceLink || undefined,
        isBasedOn: sourceLink || undefined,
        keywords: publicSemanticTags.length > 0 ? publicSemanticTags.join(", ") : undefined,
        isAccessibleForFree: true,
      },
    ],
  };

  return `<!doctype html>
<html lang="${htmlLang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${htmlEscape(title)}</title>
    <meta name="description" content="${htmlEscape(description)}" />
    <link rel="canonical" href="${canonical}" />
    ${hreflangHeadLinks}
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${htmlEscape(metaTitle)}" />
    <meta property="og:description" content="${htmlEscape(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${DEFAULT_SOCIAL_IMAGE}" />
    <meta property="og:image:width" content="${SOCIAL_IMAGE_WIDTH}" />
    <meta property="og:image:height" content="${SOCIAL_IMAGE_HEIGHT}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${htmlEscape(metaTitle)}" />
    <meta name="twitter:description" content="${htmlEscape(description)}" />
    <meta name="twitter:image" content="${DEFAULT_SOCIAL_IMAGE}" />
    <meta name="twitter:creator" content="@vorewig" />
    <meta name="robots" content="${itemIsPublished ? "index,follow,max-image-preview:large" : "noindex,follow,max-image-preview:large"}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>
      body { margin: 0; font-family: Georgia, serif; background: #f4f1ea; color: #121212; }
      .site-header { max-width: 860px; margin: 0 auto; padding: 30px 20px 0; }
      main { max-width: 860px; margin: 0 auto; padding: 18px 20px 56px; }
      a { color: #0b4f7b; }
      .meta { color: #555; font-size: 0.95rem; }
      .topnav { font-size: 0.95rem; }
      .topnav a { margin-right: 12px; }
      section { margin-top: 18px; }
      h2 { margin: 0 0 8px; font-size: 1.12rem; }
      h3 { margin: 14px 0 8px; font-size: 0.98rem; }
      ul { margin: 0; padding-left: 22px; }
      li { margin: 6px 0; }
      .source { margin-top: 24px; }
      blockquote { margin: 8px 0; padding: 12px 16px; background: #fff; border-left: 4px solid #0b4f7b; }
      .tags { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; }
      .tags li { margin: 0; border: 1px solid #d3cec4; background: #fff; border-radius: 999px; padding: 4px 10px; font-size: 0.85rem; }
      .post-header h1 { margin: 0; }
      .secondary-nav { max-width: 860px; margin: 0 auto 40px; padding: 12px 20px 0; border-top: 1px solid #d3cec4; font-size: 0.9rem; color: #555; }
      .secondary-nav a { margin-right: 10px; white-space: nowrap; }
    </style>
  </head>
  <body>
    <header class="site-header">
      <nav class="topnav" aria-label="Primary">
        <a href="/">Home</a>
        <a href="/bio/">Bio / About</a>
        <a href="/selected/">Selected Work</a>
        <a href="/cases/">Cases / Clarifications</a>
        <a href="/search/">Search</a>
        <a href="/contact/">Contact</a>
      </nav>
    </header>
    <main>
      <article>
        <header class="post-header">
          <h1>${htmlEscape(displayTitle)}</h1>
          <p class="meta">${htmlEscape(composeCardMeta(item))}</p>
        </header>
        <section>
          <h2>Summary</h2>
          <p>${htmlEscape(summary || digest)}</p>
        </section>
        ${keyIdeas.length > 0
          ? `<section><h2>Key Ideas</h2><ul>${keyIdeas.map((x) => `<li>${htmlEscape(x)}</li>`).join("")}</ul></section>`
          : ""}
        ${quotes.length > 0
          ? `<section><h2>Quotes</h2><ul>${quotes.map((x) => `<li><blockquote>${htmlEscape(x)}</blockquote></li>`).join("")}</ul></section>`
          : ""}
        ${valueContext ? `<section><h2>Value / Context</h2><p>${htmlEscape(valueContext)}</p></section>` : ""}
        ${languageLinks.length > 0
          ? `<section><h2>Available languages</h2><ul>${languageLinks.join("")}</ul></section>`
          : ""}
        <section>
          <h2>Related Materials</h2>
          <h3>Core site sections</h3>
          <ul>
            <li><a href="/">Home digest index</a></li>
            <li><a href="/bio/">Biography (EN/FR/DE/ES)</a></li>
            <li><a href="/cases/">Case clarifications (EN/FR/DE/ES)</a></li>
            <li><a href="/selected/">Selected Work</a></li>
            <li><a href="/insights/">Insights research layer</a></li>
            <li><a href="/archive/">Archive hub</a></li>
          </ul>
          ${topicLinks.length > 0 ? `<h3>More on this topic</h3><ul>${topicLinks.join("")}</ul>` : ""}
          ${sourceLinks.length > 0 ? `<h3>From the same source</h3><ul>${sourceLinks.join("")}</ul>` : ""}
          ${latestLanguageLinks.length > 0 ? `<h3>Recent in this language</h3><ul>${latestLanguageLinks.join("")}</ul>` : ""}
        </section>
        <p class="source"><a href="${htmlEscape(sourceLink)}" rel="noreferrer" target="_blank">Open original source</a></p>
      </article>
    </main>
    <footer class="secondary-nav" aria-label="Secondary">
      <a href="/archive/">Archive</a>
      <a href="/posts/">Posts</a>
      <a href="/search/">Search</a>
      <a href="/rss.xml">RSS</a>
      <a href="/sitemap.xml">Sitemap</a>
    </footer>
  </body>
</html>
`;
};

const buildPostsIndexHtml = (entries, options = {}) => {
  const {
    canonicalPath = "posts/index.html",
    pageTitle = `${DIGEST_NAME} Posts`,
    pageDescription = "Index of published digest posts for search and archive navigation.",
    indexable = true,
  } = options;
  const visibleEntries = indexable ? entries.filter((entry) => isShowcaseCandidate(entry?.item)) : entries;
  const postsCanonical = canonicalUrl(canonicalPath);
  const { person, organization, website } = buildCoreEntities();
  const itemListId = `${postsCanonical}#itemlist`;
  const postsJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      person,
      organization,
      website,
      {
        "@type": "CollectionPage",
        "@id": `${postsCanonical}#webpage`,
        url: postsCanonical,
        name: pageTitle,
        description: pageDescription,
        inLanguage: ["en", "fr", "de", "es"],
        isPartOf: { "@id": WEBSITE_ID },
        about: { "@id": PERSON_ID },
        mainEntity: { "@id": itemListId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: "Digest post index",
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: visibleEntries.length,
        itemListElement: visibleEntries.map((entry, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          url: canonicalUrl(`posts/${entry.postPath}`),
          name: cleanDisplayTitle(entry.item.title),
          inLanguage: toHtmlLang(entry.item.language),
        })),
      },
    ],
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${htmlEscape(pageTitle)}</title>
    <meta name="description" content="${htmlEscape(pageDescription)}" />
    <link rel="canonical" href="${postsCanonical}" />
    <link rel="alternate" hreflang="en" href="${postsCanonical}" />
    <link rel="alternate" hreflang="${X_DEFAULT}" href="${postsCanonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${htmlEscape(pageTitle)}" />
    <meta property="og:description" content="${htmlEscape(pageDescription)}" />
    <meta property="og:url" content="${postsCanonical}" />
    <meta property="og:image" content="${DEFAULT_SOCIAL_IMAGE}" />
    <meta property="og:image:width" content="${SOCIAL_IMAGE_WIDTH}" />
    <meta property="og:image:height" content="${SOCIAL_IMAGE_HEIGHT}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${htmlEscape(pageTitle)}" />
    <meta name="twitter:description" content="${htmlEscape(pageDescription)}" />
    <meta name="twitter:image" content="${DEFAULT_SOCIAL_IMAGE}" />
    <meta name="twitter:creator" content="@vorewig" />
    <meta name="robots" content="${indexable ? "index,follow" : "noindex,follow"}" />
    <script type="application/ld+json">${JSON.stringify(postsJsonLd)}</script>
    <style>
      body { margin: 0; font-family: Georgia, serif; background: #f4f1ea; color: #121212; }
      .site-header { max-width: 880px; margin: 0 auto; padding: 30px 20px 0; }
      main { max-width: 880px; margin: 0 auto; padding: 18px 20px 56px; }
      li { margin: 8px 0; }
      a { color: #0b4f7b; }
      .topnav { font-size: 0.95rem; }
      .topnav a { margin-right: 12px; }
      section { margin-top: 16px; }
      h2 { margin: 0 0 8px; font-size: 1.12rem; }
      .lead { margin: 8px 0 0; color: #555; }
      .secondary-nav { max-width: 880px; margin: 0 auto 40px; padding: 12px 20px 0; border-top: 1px solid #d3cec4; font-size: 0.9rem; color: #555; }
      .secondary-nav a { margin-right: 10px; white-space: nowrap; }
    </style>
  </head>
  <body>
    <header class="site-header">
      <nav class="topnav" aria-label="Primary">
        <a href="/">Home</a>
        <a href="/bio/">Bio / About</a>
        <a href="/selected/">Selected Work</a>
        <a href="/cases/">Cases / Clarifications</a>
        <a href="/search/">Search</a>
        <a href="/contact/">Contact</a>
      </nav>
    </header>
    <main>
      <section>
        <h1>${htmlEscape(pageTitle)}</h1>
        <p class="lead">${htmlEscape(pageDescription)}</p>
      </section>
      <section>
        <h2>Related Materials</h2>
        <ul>
          <li><a href="/">Interactive digest with filters</a></li>
          <li><a href="/selected/">Selected Work</a></li>
          <li><a href="/insights/">Insights research layer</a></li>
          <li><a href="/bio/">Biography (EN, FR, DE, ES)</a></li>
          <li><a href="/cases/">Case clarifications (EN, FR, DE, ES)</a></li>
          <li><a href="/rss.xml">RSS feed</a></li>
          <li><a href="/sitemap.xml">Sitemap index</a></li>
        </ul>
      </section>
      <section>
        <h2>Published posts</h2>
        <ul>
${visibleEntries
  .map(
    (entry) =>
      `        <li><a href="./${entry.postPath}">${htmlEscape(cleanDisplayTitle(entry.item.title))}</a> — ${htmlEscape(composeCardMeta(entry.item))}</li>`
  )
  .join("\n")}
        </ul>
      </section>
    </main>
    <footer class="secondary-nav" aria-label="Secondary">
      <a href="/archive/">Archive</a>
      <a href="/posts/">Posts</a>
      <a href="/search/">Search</a>
      <a href="/rss.xml">RSS</a>
      <a href="/sitemap.xml">Sitemap</a>
    </footer>
  </body>
</html>
`;
};

const buildUrlSet = (urls, withAlternates = false) => {
  const xmlns = withAlternates
    ? `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`
    : `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  return `<?xml version="1.0" encoding="UTF-8"?>
${xmlns}
${urls
  .map((item) => {
    const alternates = withAlternates
      ? (item.alternates || [])
          .map(
            (alt) =>
              `    <xhtml:link rel="alternate" hreflang="${xmlEscape(alt.hreflang)}" href="${xmlEscape(alt.href)}" />`
          )
          .join("\n")
      : "";
    return `  <url>
    <loc>${xmlEscape(item.url)}</loc>
    <lastmod>${item.lastmod}</lastmod>
    <changefreq>weekly</changefreq>${alternates ? `\n${alternates}` : ""}
  </url>`;
  })
  .join("\n")}
</urlset>
`;
};

const buildSitemapIndex = (sitemaps, buildIso) => `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (name) =>
      `  <sitemap><loc>${xmlEscape(canonicalUrl(name))}</loc><lastmod>${buildIso}</lastmod></sitemap>`
  )
  .join("\n")}
</sitemapindex>
`;

const buildSitemaps = (entries, idToPostPath, idToCluster, idToStatus = new Map()) => {
  const buildIso = latestBuildIso(entries);
  const staticUrls = INDEXABLE_STATIC_SECTIONS.map((section) => ({
    url: canonicalUrl(section),
    lastmod: buildIso,
  }));
  const coreUrls = [
    { url: canonicalUrl("index.html"), lastmod: buildIso },
    ...staticUrls,
  ];

  const files = [
    {
      name: "sitemap-core.xml",
      content: buildUrlSet(coreUrls, false),
    },
  ];

  for (const lang of LANGS) {
    const langEntries = entries.filter((entry) => normalizeLang(entry?.item?.language) === lang);
    const urls = langEntries.map((entry) => {
      const canonical = canonicalUrl(`posts/${entry.postPath}`);
      const { alternates, xDefaultHref } = getAlternatesForItem(
        entry.item,
        idToPostPath,
        idToCluster,
        idToStatus,
        true
      );
      const hreflangs = alternates.map((alt) => ({ hreflang: alt.hreflang, href: alt.href }));
      if (xDefaultHref) {
        hreflangs.push({ hreflang: X_DEFAULT, href: xDefaultHref });
      }
      return {
        url: canonical,
        lastmod: toIsoTimestamp(entry.item?.date) || buildIso,
        alternates: hreflangs,
      };
    });
    files.push({
      name: `sitemap-${lang.toLowerCase()}.xml`,
      content: buildUrlSet(urls, true),
    });
  }

  const indexFileNames = files.map((file) => file.name);
  files.push({
    name: "sitemap.xml",
    content: buildSitemapIndex(indexFileNames, buildIso),
  });

  return files;
};

const buildRss = (entries) => {
  const buildIso = latestBuildIso(entries);
  const now = new Date(buildIso).toUTCString();
  const items = entries
    .slice()
    .sort((a, b) => String(b.item.date || "").localeCompare(String(a.item.date || "")))
    .slice(0, 50)
    .map((entry) => {
      const link = canonicalUrl(`posts/${entry.postPath}`);
      const source = normalizeSourceUrl(entry.item.url || "");
      const description = `${entry.item.digest || ""}\n\nOriginal source: ${source}`;
      const pubDate = new Date(toIsoTimestamp(entry.item.date) || buildIso).toUTCString();
      return `    <item>
      <title>${xmlEscape(entry.item.title)}</title>
      <link>${xmlEscape(link)}</link>
      <guid>${xmlEscape(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${xmlEscape(description)}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Ilia Klishin Fact-Based Digest</title>
    <link>${xmlEscape(canonicalUrl("index.html"))}</link>
    <description>Fact-based multilingual digest with original source links.</description>
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>
`;
};

const normalizePolicy = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "deny" || normalized === "disallow" || normalized === "off") return "deny";
  if (normalized === "custom" || normalized === "paths") return "custom";
  return "allow";
};

const normalizeDisallowPath = (value = "") => {
  let pathValue = String(value || "").trim();
  if (!pathValue) return "";
  if (!pathValue.startsWith("/")) pathValue = `/${pathValue}`;
  return pathValue;
};

const parsePathList = (raw, fallback = []) => {
  const values = String(raw || "")
    .split(",")
    .map((item) => normalizeDisallowPath(item))
    .filter(Boolean);

  const resolved = values.length > 0 ? values : fallback.map((item) => normalizeDisallowPath(item)).filter(Boolean);
  return [...new Set(resolved)];
};

const renderBotBlock = (agent, { allowRoot = true, disallowPaths = ["/tools/"] } = {}) => {
  const lines = [`User-agent: ${agent}`];
  if (allowRoot) lines.push("Allow: /");
  for (const disallow of disallowPaths) {
    lines.push(`Disallow: ${disallow}`);
  }
  return lines.join("\n");
};

const buildGptBotBlock = () => {
  const policy = normalizePolicy(process.env.GPTBOT_POLICY || "allow");
  if (policy === "deny") {
    return renderBotBlock("GPTBot", { allowRoot: false, disallowPaths: ["/"] });
  }
  if (policy === "custom") {
    const paths = parsePathList(process.env.GPTBOT_DISALLOW_PATHS, ["/tools/"]);
    const allowRoot = !paths.includes("/");
    return renderBotBlock("GPTBot", { allowRoot, disallowPaths: paths });
  }
  return renderBotBlock("GPTBot", { allowRoot: true, disallowPaths: ["/tools/"] });
};

const buildRobots = () => {
  const blocks = [
    renderBotBlock("*", { allowRoot: true, disallowPaths: ["/tools/"] }),
    renderBotBlock("Googlebot", { allowRoot: true, disallowPaths: ["/tools/"] }),
    renderBotBlock("Google-Extended", { allowRoot: true, disallowPaths: ["/tools/"] }),
    renderBotBlock("Bingbot", { allowRoot: true, disallowPaths: ["/tools/"] }),
    renderBotBlock("DuckDuckBot", { allowRoot: true, disallowPaths: ["/tools/"] }),
    renderBotBlock("DuckAssistBot", { allowRoot: true, disallowPaths: ["/tools/"] }),
    renderBotBlock("Applebot", { allowRoot: true, disallowPaths: ["/tools/"] }),
    renderBotBlock("Yandex", { allowRoot: true, disallowPaths: ["/tools/"] }),
    renderBotBlock("YandexBot", { allowRoot: true, disallowPaths: ["/tools/"] }),
    renderBotBlock("OAI-SearchBot", { allowRoot: true, disallowPaths: ["/tools/"] }),
    buildGptBotBlock(),
    renderBotBlock("ChatGPT-User", { allowRoot: true, disallowPaths: ["/tools/"] }),
    renderBotBlock("ClaudeBot", { allowRoot: true, disallowPaths: ["/tools/"] }),
    renderBotBlock("anthropic-ai", { allowRoot: true, disallowPaths: ["/tools/"] }),
    renderBotBlock("PerplexityBot", { allowRoot: true, disallowPaths: ["/tools/"] }),
    renderBotBlock("Perplexity-User", { allowRoot: true, disallowPaths: ["/tools/"] }),
    renderBotBlock("CCBot", { allowRoot: true, disallowPaths: ["/tools/"] }),
  ];

  return `${blocks.join("\n\n")}\n\nSitemap: ${canonicalUrl("sitemap.xml")}\n`;
};

const main = async () => {
  const raw = await fs.readFile(dataPath, "utf8");
  const payload = JSON.parse(raw);
  const items = Array.isArray(payload.items) ? payload.items : [];

  await fs.mkdir(postsDir, { recursive: true });

  const entries = items.map((item) => {
    const explicitSlug = String(item.slug || "").trim().replace(/\.html$/i, "");
    const slug = explicitSlug || `${item.id || "item"}-${slugify(item.title || "entry")}`;
    const postPath = `${slug}.html`;
    return { item, postPath };
  });
  const publishedEntries = entries.filter((entry) => isPublishedStatus(entry?.item?.status));
  const indexableEntries = entries.filter((entry) => isIndexablePost(entry?.item));
  const draftEntries = entries.filter((entry) => !isPublishedStatus(entry?.item?.status));
  const selectedCards = await extractSelectedCards();
  const searchIndex = buildSearchIndex(entries, selectedCards);
  const idToPostPath = new Map(entries.map((entry) => [entry.item.id, entry.postPath]));
  const idToCluster = buildLanguageClusters(items);
  const idToIndexStatus = new Map(
    entries.map((entry) => [String(entry?.item?.id || "").trim(), isIndexablePost(entry?.item) ? "ready" : "draft"])
  );

  for (const entry of entries) {
    const html = buildPostHtml(
      entry.item,
      `posts/${entry.postPath}`,
      idToPostPath,
      idToCluster,
      indexableEntries,
      idToIndexStatus
    );
    await fs.writeFile(path.join(postsDir, entry.postPath), html, "utf8");
  }

  // Remove stale generated HTML pages left from old slugs/names.
  const desiredHtmlFiles = new Set(entries.map((entry) => entry.postPath));
  desiredHtmlFiles.add("index.html");
  const existingPosts = await fs.readdir(postsDir);
  for (const file of existingPosts) {
    if (!file.toLowerCase().endsWith(".html")) continue;
    if (desiredHtmlFiles.has(file)) continue;
    await fs.unlink(path.join(postsDir, file));
  }

  const sitemapFiles = buildSitemaps(indexableEntries, idToPostPath, idToCluster, idToIndexStatus);

  await fs.writeFile(
    path.join(postsDir, "index.html"),
    buildPostsIndexHtml(indexableEntries, {
      canonicalPath: "posts/index.html",
      pageTitle: `${DIGEST_NAME} Posts`,
      pageDescription: "Index of published digest posts for search and archive navigation.",
      indexable: false,
    }),
    "utf8"
  );
  if (draftEntries.length > 0) {
    await fs.writeFile(
      path.join(postsDir, "drafts.html"),
      buildPostsIndexHtml(draftEntries, {
        canonicalPath: "posts/drafts.html",
        pageTitle: `${DIGEST_NAME} Draft Posts`,
        pageDescription: "Internal draft index; excluded from indexing and public discovery.",
        indexable: false,
      }),
      "utf8"
    );
  } else {
    try {
      await fs.unlink(path.join(postsDir, "drafts.html"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  for (const file of sitemapFiles) {
    await fs.writeFile(path.join(siteDir, file.name), file.content, "utf8");
  }
  await fs.writeFile(path.join(siteDir, "rss.xml"), buildRss(indexableEntries), "utf8");
  await fs.writeFile(path.join(siteDir, "robots.txt"), buildRobots(), "utf8");
  await fs.writeFile(searchIndexPath, JSON.stringify(searchIndex, null, 2) + "\n", "utf8");
  const notesSource = path.resolve(process.cwd(), "reputation-case", "digest-multilingual-notes-v1.md");
  const notesTarget = path.join(siteDir, "digest-multilingual-notes-v1.md");
  try {
    await fs.copyFile(notesSource, notesTarget);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await updateHomeHtmlFirstCards(indexableEntries);
  await applyStaticRobotsPolicies();

  console.log(
    `Generated ${entries.length} post pages (${publishedEntries.length} ready, ${indexableEntries.length} indexable, ${draftEntries.length} draft), sitemap index + ${sitemapFiles.length - 1} child sitemaps, rss.xml, robots.txt, search-index (${searchIndex.counts.total} docs), home HTML-first cards`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
