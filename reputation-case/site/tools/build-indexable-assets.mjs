import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

const siteDir = path.resolve(process.cwd(), "reputation-case", "site");
const dataPath = path.join(siteDir, "data", "digests.json");
const searchIndexPath = path.join(siteDir, "data", "search-index.json");
const selectedPagePath = path.join(siteDir, "selected", "index.html");
const postsDir = path.join(siteDir, "posts");
const homeIndexPath = path.join(siteDir, "index.html");
const baseUrl = "https://www.klishin.work";
const FINGERPRINT_HEX_LENGTH = 10;
const OG_IMAGE_WIDTH = "1200";
const OG_IMAGE_HEIGHT = "630";
const OG_IMAGE_TYPE = "image/jpeg";
const SOCIAL_OG_IMAGE_BY_TYPE = {
  default: `${baseUrl}/og/site-default.jpg`,
  bio: `${baseUrl}/og/bio.jpg`,
  selected: `${baseUrl}/og/selected-work.jpg`,
  posts: `${baseUrl}/og/posts-fallback.jpg`,
  cases: `${baseUrl}/og/cases-fallback.jpg`,
};
const FINGERPRINTABLE_ASSETS = [
  { source: "styles.css", aliases: ["/styles.css", "./styles.css"] },
  { source: "app.js", aliases: ["/app.js", "./app.js"] },
  { source: "bio/bio.css", aliases: ["/bio/bio.css", "./bio.css", "../bio.css"] },
  { source: "cases/cases.css", aliases: ["/cases/cases.css", "./cases.css", "../cases.css"] },
  { source: "contact/contact.css", aliases: ["/contact/contact.css", "./contact.css", "../contact.css"] },
  { source: "contact/contact.js", aliases: ["/contact/contact.js", "./contact.js", "../contact.js"] },
  { source: "search/search.js", aliases: ["/search/search.js", "./search.js", "../search.js"] },
  {
    source: "interviews/interviews.js",
    aliases: ["/interviews/interviews.js", "./interviews.js", "../interviews.js"],
  },
  {
    source: "interviews/interviews-preview.js",
    aliases: ["/interviews/interviews-preview.js", "./interviews-preview.js", "../interviews-preview.js"],
  },
  {
    source: "bio/ilia-klishin-portrait.jpeg",
    aliases: ["/bio/ilia-klishin-portrait.jpeg", "./ilia-klishin-portrait.jpeg", "../ilia-klishin-portrait.jpeg"],
  },
  {
    source: "bio/portrait-placeholder.svg",
    aliases: ["/bio/portrait-placeholder.svg", "./portrait-placeholder.svg", "../portrait-placeholder.svg"],
  },
];
const HOME_FALLBACK_START = "<!-- HTML_FIRST_CARDS_START -->";
const HOME_FALLBACK_END = "<!-- HTML_FIRST_CARDS_END -->";
const HOME_FALLBACK_LIMIT = 8;
const HOME_FALLBACK_MAX_PER_SOURCE = 2;
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
  "interviews/index.html",
  "interviews/fr/index.html",
  "interviews/de/index.html",
  "interviews/es/index.html",
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
  ["interviews/index.html", "index"],
  ["interviews/fr/index.html", "index"],
  ["interviews/de/index.html", "index"],
  ["interviews/es/index.html", "index"],
  ["search/index.html", "noindex"],
  ["about/index.html", "noindex"],
  ["contact/index.html", "noindex"],
  ["archive/index.html", "noindex"],
  ["insights/index.html", "noindex"],
  ["insights/fr/index.html", "noindex"],
  ["insights/de/index.html", "noindex"],
  ["insights/es/index.html", "noindex"],
  ["posts/index.html", "noindex"],
  ["posts/all.html", "noindex"],
  ["posts/drafts.html", "noindex"],
]);
const STATIC_SOCIAL_IMAGE_POLICY = new Map([
  ["index.html", "default"],
  ["fr/index.html", "default"],
  ["de/index.html", "default"],
  ["es/index.html", "default"],
  ["about/index.html", "default"],
  ["archive/index.html", "default"],
  ["contact/index.html", "default"],
  ["search/index.html", "default"],
  ["insights/index.html", "default"],
  ["insights/fr/index.html", "default"],
  ["insights/de/index.html", "default"],
  ["insights/es/index.html", "default"],
  ["interviews/index.html", "default"],
  ["interviews/fr/index.html", "default"],
  ["interviews/de/index.html", "default"],
  ["interviews/es/index.html", "default"],
  ["posts/index.html", "default"],
  ["posts/drafts.html", "default"],
  ["selected/index.html", "selected"],
  ["bio/index.html", "bio"],
  ["bio/fr/index.html", "bio"],
  ["bio/de/index.html", "bio"],
  ["bio/es/index.html", "bio"],
  ["cases/index.html", "cases"],
  ["cases/fr/index.html", "cases"],
  ["cases/de/index.html", "cases"],
  ["cases/es/index.html", "cases"],
]);
const LANGS = ["EN", "FR", "DE", "ES"];
const LANGUAGE_PRIORITY = ["EN", "FR", "DE", "ES"];
const HREFLANG_ORDER = ["en", "fr", "de", "es"];
const X_DEFAULT = "x-default";
const SELECTED_SECTION_CONFIG = [
  {
    id: "journalism",
    title: "Journalism",
    intro: "Public-interest reporting and commentary tied to concrete events and timelines.",
  },
  {
    id: "media-strategy",
    title: "Media Strategy / Analysis",
    intro: "Work on institutions, platform pressure, and editorial decision environments.",
  },
  {
    id: "propaganda",
    title: "Propaganda / Information Systems",
    intro: "Analysis of networked influence tactics, manipulation infrastructure, and platform adaptation.",
  },
  {
    id: "volna",
    title: "Volna / Diaspora Media",
    intro: "Work on editorial products and audience needs in post-2022 exile environments.",
  },
  {
    id: "literature",
    title: "Literature / Essays / Cultural Commentary",
    intro: "Texts on culture, representation, and symbolic politics in public discourse.",
  },
  {
    id: "public-texts",
    title: "Profiles and external records",
    intro: "Third-party publications and institutional references used as external context.",
  },
];
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

const toPosixPath = (value = "") => String(value || "").replaceAll(path.sep, "/").replace(/^\.\/+/, "");

const escapeRegExpSafe = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const listHtmlFiles = async (dir) => {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listHtmlFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      out.push(fullPath);
    }
  }
  return out;
};

const fingerprintSingleAsset = async (sourceRelativePath = "") => {
  const normalizedSource = toPosixPath(sourceRelativePath).replace(/^\/+/, "");
  const sourceAbsolute = path.join(siteDir, normalizedSource);
  let raw;
  try {
    raw = await fs.readFile(sourceAbsolute);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }

  const hash = crypto.createHash("sha256").update(raw).digest("hex").slice(0, FINGERPRINT_HEX_LENGTH);
  const ext = path.extname(normalizedSource);
  const dirPosix = path.posix.dirname(normalizedSource);
  const baseName = path.posix.basename(normalizedSource, ext);
  const fingerprintName = `${baseName}.${hash}${ext}`;
  const fingerprintRelative = dirPosix === "." ? fingerprintName : `${dirPosix}/${fingerprintName}`;
  const fingerprintAbsolute = path.join(siteDir, fingerprintRelative);

  await fs.writeFile(fingerprintAbsolute, raw);

  const sourceDir = path.dirname(sourceAbsolute);
  const siblings = await fs.readdir(sourceDir);
  const stalePattern = new RegExp(
    `^${escapeRegExpSafe(baseName)}\\.[a-f0-9]{${FINGERPRINT_HEX_LENGTH}}${escapeRegExpSafe(ext)}$`
  );
  for (const sibling of siblings) {
    if (!stalePattern.test(sibling)) continue;
    if (sibling === fingerprintName) continue;
    await fs.unlink(path.join(sourceDir, sibling));
  }

  return {
    sourceRelative: normalizedSource,
    fingerprintRelative,
    fingerprintPublicPath: `/${fingerprintRelative}`,
    sourceCanonicalAbsolute: `${baseUrl}/${normalizedSource}`,
    fingerprintCanonicalAbsolute: `${baseUrl}/${fingerprintRelative}`,
  };
};

const rewriteAssetLinksInHtml = async (assets) => {
  const htmlFiles = await listHtmlFiles(siteDir);
  for (const htmlFile of htmlFiles) {
    let html = await fs.readFile(htmlFile, "utf8");
    const original = html;

    for (const asset of assets) {
      const aliases = new Set([
        `/${asset.sourceRelative}`,
        ...((asset.aliases || []).map((value) => String(value || "").trim()).filter(Boolean)),
      ]);
      const orderedAliases = [...aliases].sort((a, b) => b.length - a.length);
      const ext = path.posix.extname(asset.sourceRelative);
      const baseName = path.posix.basename(asset.sourceRelative, ext);
      const dirName = path.posix.dirname(asset.sourceRelative);
      const publicDir = dirName === "." ? "" : `/${dirName}`;
      const canonicalDir = dirName === "." ? "" : `/${dirName}`;
      const hashPattern = `[a-f0-9]{${FINGERPRINT_HEX_LENGTH}}`;

      const canonicalAbsoluteRe = new RegExp(
        `${escapeRegExpSafe(asset.sourceCanonicalAbsolute)}(?:\\?[^"'\\s)]+)?`,
        "g"
      );
      html = html.replace(canonicalAbsoluteRe, asset.fingerprintCanonicalAbsolute);

      // Rewrite any previous fingerprinted absolute canonical URL.
      const oldCanonicalFingerprintedRe = new RegExp(
        `${escapeRegExpSafe(baseUrl)}${escapeRegExpSafe(canonicalDir)}\\/${escapeRegExpSafe(baseName)}\\.${hashPattern}${escapeRegExpSafe(ext)}(?:\\?[^"'\\s)]+)?`,
        "g"
      );
      html = html.replace(oldCanonicalFingerprintedRe, asset.fingerprintCanonicalAbsolute);

      for (const alias of orderedAliases) {
        const re = new RegExp(`${escapeRegExpSafe(alias)}(?:\\?[^"'\\s)]+)?`, "g");
        html = html.replace(re, asset.fingerprintPublicPath);
      }

      // Rewrite any previous fingerprinted root-relative public path.
      const oldPublicFingerprintedRe = new RegExp(
        `${escapeRegExpSafe(publicDir)}\\/${escapeRegExpSafe(baseName)}\\.${hashPattern}${escapeRegExpSafe(ext)}(?:\\?[^"'\\s)]+)?`,
        "g"
      );
      html = html.replace(oldPublicFingerprintedRe, asset.fingerprintPublicPath);

      const relativeFingerprintedRe = new RegExp(
        `(?:\\./|\\.\\./)+${escapeRegExpSafe(asset.fingerprintRelative)}(?:\\?[^"'\\s)]+)?`,
        "g"
      );
      html = html.replace(relativeFingerprintedRe, asset.fingerprintPublicPath);
    }

    if (html !== original) {
      await fs.writeFile(htmlFile, html, "utf8");
    }
  }
};

const fingerprintStaticAssets = async () => {
  const mapped = [];
  for (const config of FINGERPRINTABLE_ASSETS) {
    const result = await fingerprintSingleAsset(config.source);
    if (!result) continue;
    mapped.push({
      ...result,
      aliases: config.aliases,
    });
  }
  await rewriteAssetLinksInHtml(mapped);
  return mapped;
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
  /\bthe narrative avoids reductive labels\b/i,
  /\bso readers can separate reported facts from interpretation\b/i,
  /\binstead of categorical labeling\b/i,
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

const normalizeTopicLabel = (value = "") => {
  const normalized = normalizeText(value).replace(/[_-]+/g, " ").trim();
  if (!normalized) return "Article";
  return toTitleCase(normalized);
};

const isInterviewLike = (item = {}) => {
  const text = normalizeText(
    [item?.title, item?.topic, item?.source, item?.url, item?.relation, item?.material_type].join(" ")
  ).toLowerCase();
  if (!text) return false;
  if (
    /\b(interview|podcast|conversation|q&a|video interview|audio interview|roundtable)\b/.test(text)
  ) {
    return true;
  }
  if (/youtube\.com|youtu\.be|podcasts\.apple\.com|rss\.com\/podcasts/.test(text)) return true;
  return false;
};

const classifySelectedSection = (item = {}) => {
  const source = normalizeText(item?.source).toLowerCase();
  const title = normalizeText(item?.title).toLowerCase();
  const topic = normalizeText(item?.topic).toLowerCase();
  const blob = `${title} ${topic} ${source}`;

  if (/\b(volna|diaspora|emigrant|exile|refugee|migration)\b/.test(blob)) {
    return "volna";
  }
  if (/\b(cultural|culture|literature|essay|cinema|representation|stephen king|film)\b/.test(blob)) {
    return "literature";
  }
  if (
    /\b(disinformation|propaganda|troll|bot army|platform influence|information systems|tik ?tok|telegram channels?)\b/.test(
      blob
    )
  ) {
    return "propaganda";
  }
  if (["human rights watch", "los angeles times", "news24"].includes(source)) {
    return "public-texts";
  }
  if (
    /\b(media freedom|media ethics|social network regulation|electoral timing|comparative media framing|public opinion|elite discourse)\b/.test(
      blob
    )
  ) {
    return "media-strategy";
  }
  return "journalism";
};

const PLACEHOLDER_TITLE_RE = [
  /^(vedomosti|the moscow times ru|ru\.themoscowtimes|snob|tv rain)$/i,
  /^(signed column in|chronique signee dans|signierter beitrag in|texto firmado en)\b/i,
  /^(interview on|entretien dans|interview in|entrevista en)\b/i,
  /^(author page|autorenprofil|profil d auteur|perfil de autor)\b/i,
  /^(editorial piece|texte editorial|redaktioneller text|texto editorial)$/i,
  /^(magazine piece|texte de magazine|magazintext|texto de revista)$/i,
  /^(interview|interview byline|co-authored report)$/i,
  /\b(record|notice|entry|mirror domain|canonical variant)\b/i,
];

const SMALL_TITLE_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "at",
  "by",
  "with",
  "from",
  "de",
  "la",
  "el",
  "y",
  "en",
  "von",
  "und",
]);

const toTitleCase = (value = "") =>
  String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, idx) => {
      const lowerWord = word.toLowerCase();
      if (idx > 0 && SMALL_TITLE_WORDS.has(lowerWord)) return lowerWord;
      return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
    })
    .join(" ");

const humanizeSourceSlug = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/[a-z]/i.test(raw)) return "";
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  decoded = decoded
    .replace(/\.html?$/i, "")
    .replace(/^[a-z]{2}-\d{3}-/i, "")
    .replace(/-a\d+$/i, "")
    .replace(/^\d{3,}-/i, "")
    .replace(/-\d{3,}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!decoded || decoded.length < 6) return "";
  if (/^\d+(\.phtml)?$/i.test(decoded)) return "";
  const words = decoded.split(/\s+/).filter(Boolean);
  if (words.length < 2) return "";
  if (/^(authors?|profile|selected|entry|tag|posts|opinion|columns|news|articles)$/i.test(decoded)) return "";
  if (/^(klishin|details|interview|about|blog|material)$/i.test(decoded)) return "";
  return toTitleCase(decoded);
};

const extractTitleFromSourceUrl = (sourceUrl = "") => {
  const url = normalizeSourceUrl(sourceUrl);
  if (!url) return "";
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }

  const host = String(parsed.hostname || "").toLowerCase();
  const pathname = String(parsed.pathname || "");
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "";
  const prev = segments[segments.length - 2] || "";

  if (/authors?|author/.test(last) || /authors?|author/.test(prev)) {
    if (host.includes("snob")) return "Snob author page";
    if (host.includes("vedomosti")) return "Vedomosti author page";
    if (host.includes("moscowtimes")) return "The Moscow Times author page";
    return "Author page";
  }

  const fromLast = humanizeSourceSlug(last);
  if (fromLast) return fromLast;
  const fromPrev = humanizeSourceSlug(prev);
  if (fromPrev) return fromPrev;
  return "";
};

const fallbackTitleFromContext = (item = {}) => {
  const source = normalizeText(item?.source || "Source");
  const relation = normalizeText(item?.relation || "").toLowerCase();

  if (/author_profile/.test(relation)) return `${source} author page`;
  if (/interview/.test(relation)) return `Interview in ${source}`;
  if (/opinion|column/.test(relation)) return `Column in ${source}`;
  if (/republic/i.test(source)) return "Republic opinion column";
  if (/open.?space|colta/i.test(source)) return "OpenSpace/Colta co-authored report";
  if (/lenta/i.test(source)) return "Interview in Lenta";
  if (/the village/i.test(source)) return "Interview in The Village";
  if (/the moscow times ru/i.test(source)) return "Column in The Moscow Times RU";
  return `Article in ${source}`;
};

const resolveDisplayTitle = (item = {}) => {
  const cleaned = cleanDisplayTitle(item?.title || "");
  const looksPlaceholder = PLACEHOLDER_TITLE_RE.some((re) => re.test(cleaned));
  if (!looksPlaceholder) return cleaned;

  const recovered = extractTitleFromSourceUrl(item?.url || "");
  if (recovered) return recovered;

  return fallbackTitleFromContext(item);
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

const pickSeededVariant = (seed, variants) => {
  if (!Array.isArray(variants) || variants.length === 0) return "";
  const key = hashText(seed);
  return variants[key % variants.length] || variants[0];
};

const GENERIC_SOURCE_TITLE_RE =
  /^(?:The Moscow Times(?:\s+(?:RU|EN))?|Vedomosti|Snob|Republic|OpenSpace\/Colta|MEL\.?fm|News24|Wikinews|Lenta|The Village|AdIndex|Ambivert|7x7|RTVI|TV Rain|Freedom House|TEDx\s*\/\s*TED\.com|YouTube\s*\/\s*TED)\s*\(\d{4}-\d{2}-\d{2}\)(?:\s*-\s*.+)?$/i;
const SOURCE_ONLY_TITLE_RE =
  /^(?:The Moscow Times(?:\s+(?:RU|EN))?|Vedomosti|Snob|Republic|OpenSpace\/Colta|MEL\.?fm|News24|Wikinews|Lenta|The Village|AdIndex|Ambivert|7x7|RTVI|TV Rain|Freedom House|TEDx\s*\/\s*TED\.com|YouTube\s*\/\s*TED)$/i;
const REFERENCE_TOPIC_RE =
  /\b(editorial standard|professional profile|profil professionnel|berufsprofil|profil auteur|source-based summary|public profile|public speaking(?: history)?|offentliche rede|oratoria publica|parcours de prise de parole|institutional citation|reference institutionnelle|institutionelle referenz|documented reporting|parcours professionnel documente|dokumentierter berufsverlauf)\b/i;
const REFERENCE_TITLE_RE =
  /\b(author page|autorenprofil|profil d auteur|mirror domain|canonical variant|ted talk video reference|speaker profile|how this archive is built|methodology)\b/i;

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
    const seed = `${item?.id || ""}|${source}|${topic}|${date}|${lang}`;
    if (lang === "FR") {
      summary = pickSeededVariant(seed, [
        `${source || "Ce texte"}${date ? ` (${date})` : ""} explique ${topic || "le sujet"} en reliant faits, acteurs et chronologie.`,
        `Synthese de ${topic || "ce sujet"} a partir d une publication ${source || "sourcee"}${date ? ` (${date})` : ""}, avec points de verification.`,
        `${source || "Publication"}${date ? ` (${date})` : ""}: lecture concise de ${topic || "la question"} avec contexte et implications.`,
        `Page de reference sur ${topic || "le sujet"}, fondee sur la source ${source || "principale"}${date ? ` (${date})` : ""}.`,
      ]);
    } else if (lang === "DE") {
      summary = pickSeededVariant(seed, [
        `${source || "Der Beitrag"}${date ? ` (${date})` : ""} erklaert ${topic || "das Thema"} entlang von Fakten, Akteuren und Zeitleiste.`,
        `Kurzfassung zu ${topic || "diesem Thema"} auf Basis der Quelle ${source || "mit belastbaren Bezugspunkten"}${date ? ` (${date})` : ""}.`,
        `${source || "Publikation"}${date ? ` (${date})` : ""}: kompakte Einordnung von ${topic || "der Fragestellung"} mit Kontext.`,
        `Referenzseite zu ${topic || "dem Thema"}, abgeleitet aus der Originalquelle ${source || ""}${date ? ` (${date})` : ""}.`,
      ]);
    } else if (lang === "ES") {
      summary = pickSeededVariant(seed, [
        `${source || "Este texto"}${date ? ` (${date})` : ""} explica ${topic || "el tema"} con foco en hechos, actores y cronologia.`,
        `Resumen de ${topic || "esta cuestion"} basado en la fuente ${source || "principal"}${date ? ` (${date})` : ""}, con contexto verificable.`,
        `${source || "Publicacion"}${date ? ` (${date})` : ""}: lectura breve de ${topic || "la materia"} y sus implicaciones publicas.`,
        `Pagina de referencia sobre ${topic || "el tema"}, construida desde la fuente ${source || "original"}${date ? ` (${date})` : ""}.`,
      ]);
    } else {
      summary = pickSeededVariant(seed, [
        `${source || "This text"}${date ? ` (${date})` : ""} explains ${topic || "the topic"} through facts, actors, and timeline context.`,
        `A concise reading of ${topic || "this issue"} based on ${source || "the source"}${date ? ` (${date})` : ""}, with verifiable touchpoints.`,
        `${source || "Publication"}${date ? ` (${date})` : ""}: focused summary of ${topic || "the core question"} and its public relevance.`,
        `Reference page on ${topic || "the topic"}, grounded in the original source${source ? ` (${source})` : ""}${date ? `, ${date}` : ""}.`,
      ]);
    }
  }

  let value = summary;
  if (source && !new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(value)) {
    if (lang === "FR") value = `${value} Publie dans ${source}${date ? ` (${date})` : ""}.`;
    else if (lang === "DE") value = `${value} Veroeffentlicht bei ${source}${date ? ` (${date})` : ""}.`;
    else if (lang === "ES") value = `${value} Publicado en ${source}${date ? ` (${date})` : ""}.`;
    else value = `${value} Published in ${source}${date ? ` (${date})` : ""}.`;
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

const isReferenceCard = (item = {}) => {
  const explicit = normalizeText(item?.content_class || "").toLowerCase();
  if (explicit === "reference") return true;
  if (explicit === "writing") return false;

  const topic = normalizeText(item?.topic || "");
  const title = normalizeText(item?.title || "");
  if (!title && !topic) return false;
  if (REFERENCE_TOPIC_RE.test(topic)) return true;
  if (REFERENCE_TITLE_RE.test(title)) return true;
  return false;
};

const sourceActionLabel = (item = {}) => {
  const title = normalizeText(item?.title || "").toLowerCase();
  const source = normalizeText(item?.source || "").toLowerCase();
  const topic = normalizeText(item?.topic || "").toLowerCase();
  const url = normalizeSourceUrl(item?.url || "").toLowerCase();
  const looksVideo =
    /\b(video|talk)\b/.test(title) ||
    /\b(youtube|tedx)\b/.test(source) ||
    /\bpublic speaking\b/.test(topic) ||
    /youtube\.com|youtu\.be|ted\.com/.test(url);
  if (looksVideo) return "Watch video";
  if (isReferenceCard(item)) return "Open source";
  return "Read piece";
};

const isShowcaseCandidate = (item = {}) => {
  const title = normalizeText(item?.title || "");
  const source = normalizeText(item?.source || "").toLowerCase();
  const topic = normalizeText(item?.topic || "").toLowerCase();
  if (!title) return false;
  if (isReferenceCard(item)) return false;
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
  const summary = normalizeText(item?.digest || item?.summary || "");
  const words = countWords(summary);
  if (!summary) return false;
  if (words < 18 || words > 220) return false;
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
    .trim();

const splitSentences = (text = "") => {
  const prepared = String(text || "").replace(
    /\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\./gi,
    "$1"
  );
  const matches = prepared.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!Array.isArray(matches)) return [];
  return matches
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
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
  /\bis outlined from the source\b/i,
  /\bwith the key contextual markers\b/i,
  /\bthe piece examines .+ through events, actors, and editorial framing\b/i,
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
  const raw = normalizeText(item?.digest || item?.summary || "");
  if (!raw) return "";

  const cleaned = stripLeadScaffolding(raw) || raw;
  const candidates = splitSentences(cleaned).filter(
    (sentence) => !hasMachineFragments(sentence) && !isTemplateSentence(sentence)
  );
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
  const seed = `${item?.id || ""}|${topic}|${source}|${year}|summary`;
  let result = "";
  if (lang === "FR") {
    result = pickSeededVariant(seed, [
      `Le texte porte sur ${topic} et explique pourquoi ce sujet compte dans le debat public${year ? ` en ${year}` : ""}.`,
      `Cette publication${year ? ` de ${year}` : ""} examine ${topic} et met en avant les arguments principaux.`,
      `Synthese concise de ${topic}, avec un lien direct vers la publication originale sur ${source}.`,
      `L'article revient sur ${topic} et situe le sujet dans son contexte editorial${year ? ` (${year})` : ""}.`,
    ]);
  } else if (lang === "DE") {
    result = pickSeededVariant(seed, [
      `Der Beitrag behandelt ${topic} und zeigt, warum das Thema im oeffentlichen Diskurs relevant ist${year ? ` (${year})` : ""}.`,
      `Die Publikation${year ? ` aus ${year}` : ""} ordnet ${topic} ein und fasst die Kernargumente zusammen.`,
      `Kurze Zusammenfassung zu ${topic} mit direktem Link zur Originalquelle bei ${source}.`,
      `Der Text stellt ${topic} knapp dar und verortet den Fall im redaktionellen Kontext.`,
    ]);
  } else if (lang === "ES") {
    result = pickSeededVariant(seed, [
      `El texto aborda ${topic} y explica por que el tema importa en el debate publico${year ? ` de ${year}` : ""}.`,
      `Esta publicacion${year ? ` de ${year}` : ""} revisa ${topic} y resume los argumentos centrales.`,
      `Resumen breve de ${topic} con enlace directo a la fuente original en ${source}.`,
      `La pieza presenta ${topic} con contexto y una lectura clara para el lector general.`,
    ]);
  } else {
    result = pickSeededVariant(seed, [
      `The piece focuses on ${topic} and explains why the issue mattered in public debate${year ? ` in ${year}` : ""}.`,
      `This ${source}${year ? ` (${year})` : ""} publication examines ${topic} and summarizes the main argument.`,
      `A short summary of ${topic}, with a direct link to the original publication.`,
      `The article outlines ${topic} in clear terms and places it in editorial context.`,
    ]);
  }

  return String(result || "").replace(/^[a-z]/, (char) => char.toUpperCase());
};

const fallbackContext = (item = {}) => {
  const topic = normalizeText(item?.topic || "the topic");
  const source = normalizeText(item?.source || "the source");
  const lang = normalizeLang(item?.language);
  const year = /^\d{4}/.test(String(item?.date || "")) ? String(item.date).slice(0, 4) : "";
  const key = hashText(item?.id || `${topic}-${source}`);
  const stamp = year ? ` in ${year}` : "";
  if (lang === "FR") {
    const variants = [
      `Ce texte replace ${topic} dans son moment editorial${stamp}.`,
      `La synthese relie ${topic} au texte original publie sur ${source}.`,
      `Le sujet ${topic} est presente avec des points de verification clairs.`,
      `La lecture donne un acces direct a la source primaire.`,
    ];
    return variants[key % variants.length];
  }
  if (lang === "DE") {
    const variants = [
      `Der Beitrag ordnet ${topic} im zeitlichen Rahmen${stamp} ein.`,
      `Die Zusammenfassung verbindet ${topic} mit dem Originaltext auf ${source}.`,
      `${topic} wird mit den wichtigsten Bezugspunkten klar zusammengefasst.`,
      `Der Text verweist direkt auf die Primaerquelle.`,
    ];
    return variants[key % variants.length];
  }
  if (lang === "ES") {
    const variants = [
      `El texto ubica ${topic} en su momento editorial${stamp}.`,
      `El resumen conecta ${topic} con el texto original en ${source}.`,
      `${topic} se explica con referencias claras y verificables.`,
      `La pieza da acceso directo a la fuente primaria.`,
    ];
    return variants[key % variants.length];
  }
  const variants = [
    `This piece places ${topic} in a concrete editorial moment${stamp}.`,
    `It connects ${topic} with the original text published by ${source}.`,
    `The summary gives a clear reference point for later comparisons.`,
    `It explains ${topic} and links directly to the primary source.`,
  ];
  return variants[key % variants.length];
};

const normalizeContextLead = (text = "", item = {}) => {
  const value = normalizeText(text);
  if (!value) return "";
  return value
    .replace(/^why this matters:\s*/i, "")
    .replace(/^relevance:\s*/i, "")
    .replace(/^use case:\s*/i, "")
    .replace(/^reader value:\s*/i, "")
    .replace(/^context:\s*/i, "")
    .replace(/^contexte:\s*/i, "")
    .replace(/^pertinence:\s*/i, "")
    .replace(/^usage:\s*/i, "")
    .replace(/^lecture utile:\s*/i, "")
    .replace(/^kontext:\s*/i, "")
    .replace(/^relevanz:\s*/i, "")
    .replace(/^nutzen:\s*/i, "")
    .replace(/^lesewert:\s*/i, "")
    .replace(/^contexto:\s*/i, "")
    .replace(/^relevancia:\s*/i, "")
    .replace(/^uso practico:\s*/i, "")
    .replace(/^valor de lectura:\s*/i, "")
    .trim();
};

const previewContext = (item = {}) => {
  const raw = normalizeText(item?.value_context || "");
  if (!raw) return fallbackContext(item);
  const cleaned = stripLeadScaffolding(raw) || raw;
  const candidates = splitSentences(cleaned).filter(
    (sentence) => !hasMachineFragments(sentence) && !isTemplateSentence(sentence)
  );
  let context = candidates[0] || "";
  if (!context || context.length < 36) context = fallbackContext(item);
  if (context.length > 200) {
    context = context.slice(0, 200).replace(/\s+\S*$/, "").trim();
    if (!/[.!?]$/.test(context)) context += ".";
  }
  return normalizeContextLead(context, item);
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

const languagePriorityRank = (lang = "") => {
  const normalized = normalizeLang(lang);
  const idx = LANGUAGE_PRIORITY.indexOf(normalized);
  return idx === -1 ? 99 : idx;
};

const buildEntryGroupKey = (entry, idToCluster) => {
  const item = entry?.item || {};
  const itemId = String(item?.id || "").trim();
  const cluster = idToCluster?.get(itemId);
  if (cluster) {
    const clusterIds = Object.values(cluster)
      .map((id) => String(id || "").trim())
      .filter(Boolean)
      .sort();
    if (clusterIds.length > 0) return `cluster:${clusterIds.join("|")}`;
  }

  const registry = String(item?.registry_id || "").trim();
  if (registry) return `registry:${registry}`;

  const sourceUrl = normalizeSourceUrl(item?.url || "");
  if (sourceUrl) return `source:${sourceUrl.toLowerCase()}`;

  return `fallback:${lower(item?.source)}|${String(item?.date || "").trim()}|${lower(item?.title)}`;
};

const pickGroupRepresentative = (entries = []) =>
  entries
    .slice()
    .sort((a, b) => {
      const langDelta = languagePriorityRank(a?.item?.language) - languagePriorityRank(b?.item?.language);
      if (langDelta !== 0) return langDelta;
      return sortEntriesByDateDesc(a, b);
    })[0];

const groupEntriesForListing = (entries = [], idToCluster = new Map()) => {
  const buckets = new Map();
  for (const entry of entries) {
    const key = buildEntryGroupKey(entry, idToCluster);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(entry);
  }

  const groups = [];
  for (const [key, groupEntries] of buckets.entries()) {
    const representative = pickGroupRepresentative(groupEntries);
    if (!representative) continue;
    const variants = groupEntries
      .slice()
      .sort((a, b) => languagePriorityRank(a?.item?.language) - languagePriorityRank(b?.item?.language))
      .map((entry) => ({
        language: normalizeLang(entry?.item?.language),
        postPath: entry.postPath,
        id: String(entry?.item?.id || "").trim(),
      }))
      .filter((variant, idx, arr) => arr.findIndex((x) => x.language === variant.language) === idx);
    groups.push({ key, representative, entries: groupEntries, variants });
  }

  return groups.sort((a, b) => sortEntriesByDateDesc(a.representative, b.representative));
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

const buildBreadcrumbList = (id, items = []) => ({
  "@type": "BreadcrumbList",
  "@id": id,
  itemListElement: items.map((item, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    name: item.name,
    item: item.url,
  })),
});

const normalizeSearchUrl = (href = "") => {
  const raw = String(href || "").trim();
  if (!raw) return canonicalUrl("selected/index.html");
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return canonicalUrl(raw.slice(1));
  return canonicalUrl(raw);
};

const buildSelectedCardHtml = (entry, idToPostPath = new Map()) => {
  const item = entry?.item || {};
  const displayTitle = htmlEscape(resolveDisplayTitle(item));
  const intro = htmlEscape(previewSummary(item));
  const context = htmlEscape(previewContext(item));
  const topicType = htmlEscape(normalizeTopicLabel(item?.topic));
  const date = htmlEscape(normalizeText(item?.date || "-"));
  const digestHref = canonicalUrl(`posts/${idToPostPath.get(item?.id) || entry?.postPath || ""}`);
  const sourceHrefRaw = normalizeSourceUrl(item?.url || "");
  const sourceHref = sourceHrefRaw ? htmlEscape(sourceHrefRaw) : htmlEscape(digestHref);
  const sourceLabel = sourceHrefRaw ? "Original source" : "Digest card";

  return `          <article class="work-card">
            <h3>${displayTitle}</h3>
            <p class="work-intro">${intro}</p>
            <p class="work-why">${context}</p>
            <ul class="work-meta">
              <li><strong>Type:</strong> ${topicType}</li>
              <li><strong>Date:</strong> ${date}</li>
              <li>
                <a href="${htmlEscape(digestHref)}">Digest card</a> ·
                <a href="${sourceHref}" target="_blank" rel="noopener noreferrer">${sourceLabel}</a>
              </li>
            </ul>
          </article>`;
};

const buildSelectedSectionsHtml = (entries, idToPostPath = new Map()) => {
  const scoped = entries
    .filter((entry) => normalizeLang(entry?.item?.language) === "EN")
    .filter((entry) => isPublishedStatus(entry?.item?.status))
    .filter((entry) => isShowcaseCandidate(entry?.item))
    .filter((entry) => !isInterviewLike(entry?.item))
    .slice()
    .sort(sortEntriesByDateDesc);

  const grouped = new Map(SELECTED_SECTION_CONFIG.map((section) => [section.id, []]));
  for (const entry of scoped) {
    const sectionId = classifySelectedSection(entry?.item);
    if (!grouped.has(sectionId)) grouped.set(sectionId, []);
    grouped.get(sectionId).push(entry);
  }

  const sections = SELECTED_SECTION_CONFIG.map((section) => {
    const cards = grouped.get(section.id) || [];
    const cardsHtml =
      cards.length > 0
        ? cards.map((entry) => buildSelectedCardHtml(entry, idToPostPath)).join("\n\n")
        : `          <p class="cluster-intro">No published articles in this section yet.</p>`;

    return `<section class="cluster" id="${section.id}">
        <h2>${section.title}</h2>
        <p class="cluster-intro">${section.intro}</p>
        <div class="cluster-grid">
${cardsHtml}
        </div>
      </section>`;
  });

  return {
    html: sections.join("\n\n"),
    itemCount: scoped.length,
  };
};

const updateSelectedWorkPage = async (entries, idToPostPath = new Map()) => {
  let html;
  try {
    html = await fs.readFile(selectedPagePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  const { html: sectionsHtml, itemCount } = buildSelectedSectionsHtml(entries, idToPostPath);
  const blockRe =
    /<section class="cluster" id="journalism">[\s\S]*?(?=\s*<section class="selected-contact")/m;
  if (!blockRe.test(html)) {
    throw new Error(`Unable to locate Selected Work cluster block in ${selectedPagePath}`);
  }

  let next = html.replace(blockRe, `${sectionsHtml}\n\n`);
  next = next.replace(
    /("description":\s*")Manually curated route through key materials by Ilia Klishin\.(")/,
    '$1Section-based index of published articles by Ilia Klishin, excluding interview materials.$2'
  );
  next = next.replace(/("numberOfItems":\s*)\d+/, `$1${itemCount}`);
  next = next.replace(
    /<p>\s*Start here if you want the clearest sense of my work\.\s*<\/p>/,
    `<p>Browse all published article cards by section. Interview materials are kept in the separate Interviews page.</p>`
  );

  if (next !== html) {
    await fs.writeFile(selectedPagePath, next, "utf8");
  }
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

const buildSearchIndex = (entries, selectedCards, idToCluster = new Map()) => {
  const publishedGroups = groupEntriesForListing(
    entries.filter((entry) => isPublishedStatus(entry?.item?.status)).filter((entry) => isShowcaseCandidate(entry?.item)),
    idToCluster
  );
  const publishedCards = publishedGroups.map((group) => {
    const entry = group.representative;
    const item = entry?.item || {};
    return {
      id: String(item.id || "").trim() || entry.postPath.replace(/\.html$/i, ""),
      type: "post",
      language: normalizeLang(item.language),
      status: "ready",
      title: resolveDisplayTitle(item),
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
    const title = htmlEscape(resolveDisplayTitle(entry?.item || {}));
    const source = htmlEscape(String(entry?.item?.source || "-"));
    const date = htmlEscape(String(entry?.item?.date || "-"));
    return `<li><a href="${href}">${title}</a> — ${source} • ${date}</li>`;
  });

const homeStatusRank = (value = "") => (String(value || "").toLowerCase() === "ready" ? 0 : 1);
const HOME_PINNED_IDS = {
  EN: ["en-009", "en-002", "en-108"],
};

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
  const preferred = (byLang.get(preferredLang) || []).slice();
  const pinnedIds = HOME_PINNED_IDS[preferredLang] || [];
  if (pinnedIds.length > 0) {
    const rank = new Map(pinnedIds.map((id, index) => [id, index]));
    preferred.sort((a, b) => {
      const rankA = rank.has(String(a?.item?.id || "")) ? rank.get(String(a?.item?.id || "")) : Number.POSITIVE_INFINITY;
      const rankB = rank.has(String(b?.item?.id || "")) ? rank.get(String(b?.item?.id || "")) : Number.POSITIVE_INFINITY;
      if (rankA !== rankB) return rankA - rankB;
      return sortEntriesByDateDesc(a, b);
    });
  }
  const selected = [];
  const selectedSet = new Set();
  const perSource = new Map();
  const sourceKey = (entry) => {
    const source = String(entry?.item?.source || "").trim().toLowerCase();
    return source || `source:${String(entry?.item?.id || "")}`;
  };
  const tryAdd = (entry, perSourceCap) => {
    if (selectedSet.has(entry)) return;
    const key = sourceKey(entry);
    const count = perSource.get(key) || 0;
    if (count >= perSourceCap) return;
    selected.push(entry);
    selectedSet.add(entry);
    perSource.set(key, count + 1);
  };

  for (const entry of preferred) {
    if (selected.length >= limit) break;
    tryAdd(entry, 1);
  }
  for (const entry of preferred) {
    if (selected.length >= limit) break;
    tryAdd(entry, HOME_FALLBACK_MAX_PER_SOURCE);
  }
  for (const entry of preferred) {
    if (selected.length >= limit) break;
    tryAdd(entry, Number.POSITIVE_INFINITY);
  }

  return selected;
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
      const title = htmlEscape(resolveDisplayTitle(item));
      const meta = htmlEscape(composeCardMeta(item));
      const digest = htmlEscape(previewSummary(item));
      const sourceHref = htmlEscape(normalizeSourceUrl(item?.url || canonicalUrl(`posts/${entry.postPath}`)));
      const actionLabel = htmlEscape(sourceActionLabel(item));
      return `        <article class="card">
          <div class="card-head">
            <span class="lang-tag">${lang}</span>
          </div>
          <h3 class="card-title">${title}</h3>
          <p class="card-meta">${meta}</p>
          <p class="card-digest">${digest}</p>
          <a class="card-link" href="${sourceHref}" target="_blank" rel="noreferrer">${actionLabel}</a>
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

const upsertMetaTag = (html = "", attrName = "", attrValue = "", content = "") => {
  const normalizedContent = String(content || "").trim();
  if (!normalizedContent) return html;
  const tag = `<meta ${attrName}="${attrValue}" content="${htmlEscape(normalizedContent)}" />`;
  const escapedAttr = escapeRegExpSafe(String(attrValue || ""));
  const pairRe = new RegExp(
    `<meta\\s+[^>]*${attrName}=["']${escapedAttr}["'][^>]*content=["'][^"']*["'][^>]*\\/?>|<meta\\s+[^>]*content=["'][^"']*["'][^>]*${attrName}=["']${escapedAttr}["'][^>]*\\/?>`,
    "i"
  );
  if (pairRe.test(html)) {
    return html.replace(pairRe, tag);
  }
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
};

const applyStaticSocialPreviewPolicies = async () => {
  for (const [relativePath, imageType] of STATIC_SOCIAL_IMAGE_POLICY.entries()) {
    const fullPath = path.join(siteDir, relativePath);
    let html;
    try {
      html = await fs.readFile(fullPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    const imageUrl = SOCIAL_OG_IMAGE_BY_TYPE[imageType] || SOCIAL_OG_IMAGE_BY_TYPE.default;
    html = upsertMetaTag(html, "property", "og:image", imageUrl);
    html = upsertMetaTag(html, "property", "og:image:width", OG_IMAGE_WIDTH);
    html = upsertMetaTag(html, "property", "og:image:height", OG_IMAGE_HEIGHT);
    html = upsertMetaTag(html, "property", "og:image:type", OG_IMAGE_TYPE);
    html = upsertMetaTag(html, "name", "twitter:card", "summary_large_image");
    html = upsertMetaTag(html, "name", "twitter:image", imageUrl);

    await fs.writeFile(fullPath, html, "utf8");
  }
};

const buildPostHtml = (item, postPath, idToPostPath, idToCluster, entries, idToStatus = new Map()) => {
  const itemId = String(item?.id || "").trim();
  const decision = String(idToStatus.get(itemId) || item?.status || "").toLowerCase();
  const itemIsPublished = isPublishedStatus(decision);
  const displayTitle = resolveDisplayTitle(item);
  const metaTitle = buildPostMetaTitle(item, displayTitle);
  const title = `${metaTitle} | ${SITE_NAME}`;
  const summary = previewSummary(item);
  const description = buildPostMetaDescription(item) || "Publication summary with source context and key claims.";
  const semanticTags = normalizedArray(item.semantic_tags);
  const publicSemanticTags = sanitizeSemanticTags(semanticTags);
  const canonical = canonicalUrl(postPath);
  const postSocialImage = SOCIAL_OG_IMAGE_BY_TYPE.posts;
  const sourceLink = normalizeSourceUrl(item.url);
  const sourceCtaLabel = sourceActionLabel(item);
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
  const breadcrumbId = `${canonical}#breadcrumb`;
  const publishedIso = toIsoTimestamp(item.date) || item.date || undefined;
  const modifiedIso = toIsoTimestamp(item.lastmod || item.date) || publishedIso;
  const breadcrumb = buildBreadcrumbList(breadcrumbId, [
    { name: "Home", url: canonicalUrl("index.html") },
    { name: "Posts", url: canonicalUrl("posts/index.html") },
    { name: displayTitle, url: canonical },
  ]);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      person,
      organization,
      website,
      breadcrumb,
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
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${htmlEscape(title)}</title>
    <meta name="description" content="${htmlEscape(description)}" />
    <link rel="canonical" href="${canonical}" />
    ${hreflangHeadLinks}
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${htmlEscape(metaTitle)}" />
    <meta property="og:description" content="${htmlEscape(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${postSocialImage}" />
    <meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />
    <meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />
    <meta property="og:image:type" content="${OG_IMAGE_TYPE}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${htmlEscape(displayTitle)}" />
    <meta name="twitter:description" content="${htmlEscape(description)}" />
    <meta name="twitter:image" content="${postSocialImage}" />
    <meta name="robots" content="${itemIsPublished ? "index,follow,max-image-preview:large" : "noindex,follow,max-image-preview:large"}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Georgia, serif; background: #f4f1ea; color: #121212; line-height: 1.56; overflow-x: clip; }
      .site-header, main, .secondary-nav { width: min(860px, calc(100% - 2rem)); margin: 0 auto; }
      .site-header { padding: 20px 0 0; }
      main { padding: 14px 0 42px; }
      a { color: #0b4f7b; overflow-wrap: anywhere; }
      .meta { color: #555; font-size: 0.95rem; }
      .topnav { display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.92rem; }
      .topnav a, .secondary-nav a {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        padding: 0.45rem 0.78rem;
        border: 1px solid #d3cec4;
        border-radius: 999px;
        text-decoration: none;
        background: #fff;
      }
      section { margin-top: 18px; }
      h2 { margin: 0 0 8px; font-size: 1.08rem; }
      h3 { margin: 14px 0 8px; font-size: 0.96rem; }
      p, li, h1, h2, h3, blockquote { overflow-wrap: anywhere; }
      ul { margin: 0; padding-left: 22px; }
      li { margin: 6px 0; }
      .source { margin-top: 24px; }
      blockquote { margin: 8px 0; padding: 12px 16px; background: #fff; border-left: 4px solid #0b4f7b; }
      .tags { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; }
      .tags li { margin: 0; border: 1px solid #d3cec4; background: #fff; border-radius: 999px; padding: 4px 10px; font-size: 0.85rem; }
      .post-header h1 { margin: 0; }
      .secondary-nav { margin: 0 auto 24px; padding: 12px 0 0; border-top: 1px solid #d3cec4; font-size: 0.88rem; color: #555; display: flex; flex-wrap: wrap; gap: 8px; }
      @media (max-width: 520px) {
        .site-header, main, .secondary-nav { width: min(860px, calc(100% - 1.3rem)); }
        .site-header { padding-top: 12px; }
        .post-header h1 { font-size: 1.9rem; line-height: 1.1; }
        .topnav a, .secondary-nav a { padding: 0.44rem 0.7rem; font-size: 0.84rem; }
        ul { padding-left: 18px; }
      }
    </style>
  </head>
  <body>
    <header class="site-header">
      <nav class="topnav" aria-label="Primary">
        <a href="/">Home</a>
        <a href="/bio/">Bio</a>
        <a href="/selected/">Selected Work</a>
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
          <p>${htmlEscape(summary)}</p>
        </section>
        <section>
          <h2>Continue on site</h2>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/bio/">Biography (EN/FR/DE/ES)</a></li>
            <li><a href="/selected/">Selected Work</a></li>
            <li><a href="/insights/">Research archive</a></li>
            <li><a href="/archive/">Archive</a></li>
          </ul>
          ${languageLinks.length > 0 ? `<h3>Available languages</h3><ul>${languageLinks.join("")}</ul>` : ""}
          ${topicLinks.length > 0 ? `<h3>Related topic</h3><ul>${topicLinks.join("")}</ul>` : ""}
          ${sourceLinks.length > 0 ? `<h3>From this source</h3><ul>${sourceLinks.join("")}</ul>` : ""}
          ${latestLanguageLinks.length > 0 ? `<h3>Recent in this language</h3><ul>${latestLanguageLinks.join("")}</ul>` : ""}
        </section>
        <p class="source"><a href="${htmlEscape(sourceLink)}" rel="noreferrer" target="_blank">${htmlEscape(sourceCtaLabel)}</a></p>
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

const buildPostsIndexHtml = (entries, idToCluster = new Map(), options = {}) => {
  const {
    canonicalPath = "posts/index.html",
    pageTitle = "Published pieces",
    pageDescription = "Published pieces in chronological order.",
    listHeading = "Published posts",
    indexable = true,
  } = options;
  const scopedEntries = indexable ? entries.filter((entry) => isShowcaseCandidate(entry?.item)) : entries;
  const writingGroups = groupEntriesForListing(
    scopedEntries.filter((entry) => !isReferenceCard(entry?.item)),
    idToCluster
  );
  const referenceGroups = groupEntriesForListing(
    scopedEntries.filter((entry) => isReferenceCard(entry?.item)),
    idToCluster
  );
  const visibleGroups = writingGroups;
  const postsCanonical = canonicalUrl(canonicalPath);
  const { person, organization, website } = buildCoreEntities();
  const itemListId = `${postsCanonical}#itemlist`;
  const breadcrumbId = `${postsCanonical}#breadcrumb`;
  const sectionName =
    canonicalPath === "posts/all.html"
      ? "Full archive"
      : canonicalPath === "posts/drafts.html"
        ? "Draft archive"
        : "Posts";
  const breadcrumbItems = [
    { name: "Home", url: canonicalUrl("index.html") },
    { name: "Posts", url: canonicalUrl("posts/index.html") },
  ];
  if (canonicalPath !== "posts/index.html") {
    breadcrumbItems.push({ name: sectionName, url: postsCanonical });
  }
  const breadcrumb = buildBreadcrumbList(breadcrumbId, breadcrumbItems);
  const postsJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      person,
      organization,
      website,
      breadcrumb,
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
        name: "Published pieces index",
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: visibleGroups.length,
        itemListElement: visibleGroups.map((group, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          url: canonicalUrl(`posts/${group.representative.postPath}`),
          name: resolveDisplayTitle(group.representative.item),
          inLanguage: toHtmlLang(group.representative.item.language),
        })),
      },
    ],
  };

  const renderGroupList = (groups) =>
    groups
      .map((group) => {
        const rep = group.representative;
        const title = htmlEscape(resolveDisplayTitle(rep.item));
        const meta = htmlEscape(composeCardMeta(rep.item));
        const alternates =
          group.variants.length > 1
            ? ` <span aria-label="Available languages">(${group.variants
                .map(
                  (variant) =>
                    `<a href="./${htmlEscape(variant.postPath)}">${htmlEscape(String(variant.language || "").toUpperCase())}</a>`
                )
                .join(" · ")})</span>`
            : "";
        return `        <li><a href="./${rep.postPath}">${title}</a> — ${meta}${alternates}</li>`;
      })
      .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
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
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Georgia, serif; background: #f4f1ea; color: #121212; overflow-x: clip; line-height: 1.56; }
      .site-header, main, .secondary-nav { width: min(880px, calc(100% - 2rem)); margin: 0 auto; }
      .site-header { padding: 20px 0 0; }
      main { padding: 14px 0 42px; }
      li { margin: 8px 0; }
      a { color: #0b4f7b; overflow-wrap: anywhere; }
      .topnav { display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.92rem; }
      .topnav a, .secondary-nav a {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        padding: 0.45rem 0.78rem;
        border: 1px solid #d3cec4;
        border-radius: 999px;
        text-decoration: none;
        background: #fff;
      }
      section { margin-top: 16px; }
      h2 { margin: 0 0 8px; font-size: 1.08rem; }
      p, li, h1, h2, h3 { overflow-wrap: anywhere; }
      .lead { margin: 8px 0 0; color: #555; }
      .secondary-nav { margin: 0 auto 24px; padding: 12px 0 0; border-top: 1px solid #d3cec4; font-size: 0.88rem; color: #555; display: flex; flex-wrap: wrap; gap: 8px; }
      @media (max-width: 520px) {
        .site-header, main, .secondary-nav { width: min(880px, calc(100% - 1.3rem)); }
        .site-header { padding-top: 12px; }
        .topnav a, .secondary-nav a { padding: 0.44rem 0.7rem; font-size: 0.84rem; }
      }
    </style>
  </head>
  <body>
    <header class="site-header">
      <nav class="topnav" aria-label="Primary">
        <a href="/">Home</a>
        <a href="/bio/">Bio</a>
        <a href="/selected/">Selected Work</a>
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
        <h2>See also</h2>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/selected/">Selected Work</a></li>
          <li><a href="/insights/">Research archive</a></li>
          <li><a href="/posts/all.html">Full archive (including drafts)</a></li>
          <li><a href="/bio/">Biography (EN, FR, DE, ES)</a></li>
          <li><a href="/rss.xml">RSS feed</a></li>
          <li><a href="/sitemap.xml">Sitemap index</a></li>
        </ul>
      </section>
      <section>
        <h2>${htmlEscape(listHeading)}</h2>
        <ul>
${renderGroupList(writingGroups)}
        </ul>
      </section>
      ${referenceGroups.length > 0
        ? `<section>
        <h2>References</h2>
        <ul>
${renderGroupList(referenceGroups)}
        </ul>
      </section>`
        : ""}
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
      const summary = previewSummary(entry.item);
      const context = previewContext(entry.item);
      const descriptionParts = [summary, context, source ? `Original source: ${source}` : ""].filter(Boolean);
      const description = descriptionParts.join("\n\n");
      const pubDate = new Date(toIsoTimestamp(entry.item.date) || buildIso).toUTCString();
      return `    <item>
      <title>${xmlEscape(resolveDisplayTitle(entry.item))}</title>
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
    <title>Ilia Klishin Publications Feed</title>
    <link>${xmlEscape(canonicalUrl("index.html"))}</link>
    <description>Publication cards with concise summaries and links to original sources.</description>
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
  const idToPostPath = new Map(entries.map((entry) => [entry.item.id, entry.postPath]));
  await updateSelectedWorkPage(entries, idToPostPath);
  const selectedCards = await extractSelectedCards();
  const idToCluster = buildLanguageClusters(items);
  const searchIndex = buildSearchIndex(entries, selectedCards, idToCluster);
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
  desiredHtmlFiles.add("all.html");
  desiredHtmlFiles.add("drafts.html");
  const existingPosts = await fs.readdir(postsDir);
  for (const file of existingPosts) {
    if (!file.toLowerCase().endsWith(".html")) continue;
    if (desiredHtmlFiles.has(file)) continue;
    await fs.unlink(path.join(postsDir, file));
  }

  const sitemapFiles = buildSitemaps(indexableEntries, idToPostPath, idToCluster, idToIndexStatus);

  await fs.writeFile(
    path.join(postsDir, "index.html"),
    buildPostsIndexHtml(indexableEntries, idToCluster, {
      canonicalPath: "posts/index.html",
      pageTitle: "Published pieces",
      pageDescription: "Published pieces in chronological order.",
      listHeading: "Published posts",
      indexable: false,
    }),
    "utf8"
  );
  await fs.writeFile(
    path.join(postsDir, "all.html"),
    buildPostsIndexHtml(entries, idToCluster, {
      canonicalPath: "posts/all.html",
      pageTitle: "Full archive",
      pageDescription: "Complete archive, including working drafts.",
      listHeading: "Writing",
      indexable: false,
    }),
    "utf8"
  );
  if (draftEntries.length > 0) {
    await fs.writeFile(
      path.join(postsDir, "drafts.html"),
      buildPostsIndexHtml(draftEntries, idToCluster, {
        canonicalPath: "posts/drafts.html",
        pageTitle: "Draft archive",
        pageDescription: "Working draft archive. Not indexed.",
        listHeading: "Draft pieces",
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
  await applyStaticSocialPreviewPolicies();
  const fingerprintedAssets = await fingerprintStaticAssets();

  console.log(
    `Generated ${entries.length} post pages (${publishedEntries.length} ready, ${indexableEntries.length} indexable, ${draftEntries.length} draft), sitemap index + ${sitemapFiles.length - 1} child sitemaps, rss.xml, robots.txt, search-index (${searchIndex.counts.total} docs), home HTML-first cards, fingerprinted assets (${fingerprintedAssets.length})`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
