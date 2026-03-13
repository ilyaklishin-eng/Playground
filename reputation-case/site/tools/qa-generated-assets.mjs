import fs from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

const SITE_DIR = path.resolve(process.cwd(), "reputation-case", "site");
const POSTS_DIR = path.join(SITE_DIR, "posts");
const DATA_PATH = path.join(SITE_DIR, "data", "digests.json");
const SEARCH_INDEX_PATH = path.join(SITE_DIR, "data", "search-index.json");
const REPORT_PATH = path.join(SITE_DIR, "qa-generated-assets-report.json");
const DOMAIN = "https://www.klishin.work";
const HOST = "www.klishin.work";
const HOME_INDEX = path.join(SITE_DIR, "index.html");
const HOME_FALLBACK_START = "<!-- HTML_FIRST_CARDS_START -->";
const HOME_FALLBACK_END = "<!-- HTML_FIRST_CARDS_END -->";
const FINGERPRINT_HEX_LENGTH = 10;
const OG_IMAGE_WIDTH = "1200";
const OG_IMAGE_HEIGHT = "630";
const OG_IMAGE_TYPE = "image/jpeg";
const SOCIAL_OG_IMAGE_BY_TYPE = {
  default: `${DOMAIN}/og/site-default.jpg`,
  bio: `${DOMAIN}/og/bio.jpg`,
  selected: `${DOMAIN}/og/selected-work.jpg`,
  posts: `${DOMAIN}/og/posts-fallback.jpg`,
  cases: `${DOMAIN}/og/cases-fallback.jpg`,
};
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
const FINGERPRINTED_ASSET_SOURCES = [
  "styles.css",
  "app.js",
  "bio/bio.css",
  "cases/cases.css",
  "contact/contact.css",
  "contact/contact.js",
  "search/search.js",
  "interviews/interviews.js",
  "interviews/interviews-preview.js",
  "bio/ilia-klishin-portrait.jpeg",
  "bio/portrait-placeholder.svg",
];
const LANGS = ["en", "fr", "de", "es"];
const PUBLISHED_STATUS = "ready";
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";
const EXTRA_POST_INDEX_FILES = new Set(["index.html", "all.html", "drafts.html"]);
const REQUIRED_BOTS = [
  "Googlebot",
  "Bingbot",
  "YandexBot",
  "OAI-SearchBot",
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "CCBot",
];

const INDEXABLE_CORE_SECTIONS = [
  "index.html",
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
const NO_DRAFT_LEAK_TARGETS = [
  ...INDEXABLE_CORE_SECTIONS,
  "selected/index.html",
  "interviews/index.html",
  "interviews/fr/index.html",
  "interviews/de/index.html",
  "interviews/es/index.html",
  "sitemap.xml",
  "sitemap-core.xml",
  "sitemap-en.xml",
  "sitemap-fr.xml",
  "sitemap-de.xml",
  "sitemap-es.xml",
  "rss.xml",
  "data/search-index.json",
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
  ["posts/all.html", "noindex"],
  ["posts/drafts.html", "noindex"],
]);
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
const REFERENCE_TOPIC_RE =
  /\b(editorial standard|professional profile|profil professionnel|berufsprofil|profil auteur|source-based summary|public profile|public speaking(?: history)?|offentliche rede|oratoria publica|parcours de prise de parole|institutional citation|reference institutionnelle|institutionelle referenz|documented reporting|parcours professionnel documente|dokumentierter berufsverlauf)\b/i;
const REFERENCE_TITLE_RE =
  /\b(author page|autorenprofil|profil d auteur|mirror domain|canonical variant|ted talk video reference|speaker profile|how this archive is built|methodology)\b/i;

const MULTILINGUAL_CLUSTERS = [
  {
    name: "home",
    pages: {
      en: "index.html",
      fr: "fr/index.html",
      de: "de/index.html",
      es: "es/index.html",
    },
    xDefault: "index.html",
  },
  {
    name: "bio",
    pages: {
      en: "bio/index.html",
      fr: "bio/fr/index.html",
      de: "bio/de/index.html",
      es: "bio/es/index.html",
    },
    xDefault: "bio/index.html",
  },
  {
    name: "cases",
    pages: {
      en: "cases/index.html",
      fr: "cases/fr/index.html",
      de: "cases/de/index.html",
      es: "cases/es/index.html",
    },
    xDefault: "cases/index.html",
  },
  {
    name: "insights",
    pages: {
      en: "insights/index.html",
      fr: "insights/fr/index.html",
      de: "insights/de/index.html",
      es: "insights/es/index.html",
    },
    xDefault: "insights/index.html",
  },
];

const parseArgs = (argv) => {
  const opts = {
    writeReport: false,
    failOnError: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--report") opts.writeReport = true;
    else if (arg === "--no-report") opts.writeReport = false;
    else if (arg === "--no-fail") opts.failOnError = false;
  }

  return opts;
};

const toIsoTimestamp = (value = "") => {
  const ts = Date.parse(String(value || ""));
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toISOString();
};

const latestIso = (values = [], fallback = EPOCH_ISO) => {
  let best = null;
  for (const value of values) {
    const iso = toIsoTimestamp(value);
    if (!iso) continue;
    if (!best || iso > best) best = iso;
  }
  return best || fallback;
};

const slugify = (text = "") =>
  String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72) || "item";

const normalizeText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

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
  const quotes = Array.isArray(item?.quotes) ? item.quotes : [item?.quote].filter(Boolean);
  return quotes.map((x) => normalizeText(x)).filter(Boolean).length;
};

const isReferenceCard = (item = {}) => {
  const explicit = normalizeText(item?.content_class || "").toLowerCase();
  if (explicit === "reference") return true;
  if (explicit === "writing") return false;
  const topic = normalizeText(item?.topic || "");
  const title = normalizeText(item?.title || "");
  return REFERENCE_TOPIC_RE.test(topic) || REFERENCE_TITLE_RE.test(title);
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

const isQaReviewedPost = (item = {}) => {
  const summary = normalizeText(item?.digest || item?.summary || "");
  const words = countWords(summary);
  if (!summary) return false;
  if (words < 18 || words > 220) return false;
  return true;
};

const isIndexablePost = (item = {}) =>
  String(item?.status || "").trim().toLowerCase() === PUBLISHED_STATUS &&
  isShowcaseCandidate(item) &&
  isQaReviewedPost(item);

const expectedPostFilename = (item = {}) => {
  const explicitSlug = String(item?.slug || "").trim().replace(/\.html$/i, "");
  const slug = explicitSlug || `${item?.id || "item"}-${slugify(item?.title || "entry")}`;
  return `${slug}.html`;
};

const canonicalUrl = (relativePath = "") => {
  const clean = String(relativePath || "").replace(/^\/+/, "");
  if (!clean || clean === "index.html") return `${DOMAIN}/`;
  if (clean.endsWith("/index.html")) {
    const dir = clean.slice(0, -"/index.html".length);
    return `${DOMAIN}/${dir}/`;
  }
  return `${DOMAIN}/${clean}`;
};

const extractLocs = (xml = "") => [...xml.matchAll(/<loc>([^<]+)<\/loc>/gim)].map((m) => String(m[1] || "").trim());

const extractSitemapEntries = (xml = "") =>
  [...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>[\s\S]*?<\/sitemap>/gim)].map(
    (m) => ({
      loc: String(m[1] || "").trim(),
      lastmod: String(m[2] || "").trim(),
    })
  );

const extractUrlEntries = (xml = "") =>
  [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>[\s\S]*?<\/url>/gim)].map(
    (m) => ({
      loc: String(m[1] || "").trim(),
      lastmod: String(m[2] || "").trim(),
    })
  );

const extractAll = (text = "", re) => [...text.matchAll(re)].map((m) => String(m[1] || "").trim());

const extractCanonical = (html = "") => {
  const match = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  return match ? String(match[1] || "").trim() : "";
};

const extractMetaContent = (html = "", attrName = "", attrValue = "") => {
  const escaped = escapeRegExp(String(attrValue || ""));
  const direct = new RegExp(
    `<meta\\s+[^>]*${attrName}=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const reverse = new RegExp(
    `<meta\\s+[^>]*content=["']([^"']+)["'][^>]*${attrName}=["']${escaped}["'][^>]*>`,
    "i"
  );
  const hit = html.match(direct) || html.match(reverse);
  return hit ? String(hit[1] || "").trim() : "";
};

const escapeRegExp = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toPosixPath = (value = "") => String(value || "").replaceAll(path.sep, "/").replace(/^\.\/+/, "");

const gitState = {
  repoRoot: null,
  disabled: false,
  cache: new Map(),
};

const resolveGitRepoRoot = async () => {
  if (gitState.disabled) return null;
  if (gitState.repoRoot) return gitState.repoRoot;
  try {
    const { stdout } = await execFile("git", ["rev-parse", "--show-toplevel"], { cwd: process.cwd() });
    const root = String(stdout || "").trim();
    if (!root) {
      gitState.disabled = true;
      return null;
    }
    gitState.repoRoot = root;
    return root;
  } catch {
    gitState.disabled = true;
    return null;
  }
};

const gitLastmodByRepoPath = async (repoRelativePath = "") => {
  const key = toPosixPath(repoRelativePath).replace(/^\/+/, "");
  if (!key) return null;
  if (gitState.disabled) return null;
  if (gitState.cache.has(key)) return gitState.cache.get(key);

  const repoRoot = await resolveGitRepoRoot();
  if (!repoRoot) return null;

  try {
    const { stdout } = await execFile("git", ["log", "-1", "--format=%cI", "--", key], { cwd: repoRoot });
    const iso = toIsoTimestamp(String(stdout || "").trim());
    const value = iso || null;
    gitState.cache.set(key, value);
    return value;
  } catch {
    gitState.cache.set(key, null);
    return null;
  }
};

const canonicalLocToRepoPath = (loc = "") => {
  try {
    const parsed = new URL(loc);
    if (parsed.protocol !== "https:" || parsed.host !== HOST) return null;
    if (parsed.search || parsed.hash) return null;
    let pathname = parsed.pathname;
    if (!pathname || pathname === "/") return "reputation-case/site/index.html";
    if (pathname.endsWith("/")) pathname = `${pathname}index.html`;
    const rel = pathname.replace(/^\/+/, "");
    return rel ? `reputation-case/site/${rel}` : "reputation-case/site/index.html";
  } catch {
    return null;
  }
};

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

const extractRobotsMeta = (html = "") => {
  const match = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  return match ? String(match[1] || "").trim().toLowerCase() : "";
};

const extractHreflangLinks = (html = "") => {
  const links = [];
  const re = /<link\s+rel=["']alternate["']\s+hreflang=["']([^"']+)["']\s+href=["']([^"']+)["']/gi;
  for (const match of html.matchAll(re)) {
    links.push({
      hreflang: String(match[1] || "").trim().toLowerCase(),
      href: String(match[2] || "").trim(),
    });
  }
  return links;
};

const extractJsonLdObjects = (html = "") => {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    const raw = String(match[1] || "").trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Ignore malformed JSON-LD blocks; dedicated checks will flag missing entities.
    }
  }
  return out;
};

const flattenJsonLdNodes = (objects = []) => {
  const nodes = [];
  for (const object of objects) {
    if (!object || typeof object !== "object") continue;
    if (Array.isArray(object)) {
      for (const node of object) {
        if (node && typeof node === "object") nodes.push(node);
      }
      continue;
    }
    if (Array.isArray(object["@graph"])) {
      for (const node of object["@graph"]) {
        if (node && typeof node === "object") nodes.push(node);
      }
      continue;
    }
    nodes.push(object);
  }
  return nodes;
};

const hasSchemaType = (node, expectedType) => {
  const type = node?.["@type"];
  if (Array.isArray(type)) {
    return type.some((entry) => String(entry || "").toLowerCase() === String(expectedType || "").toLowerCase());
  }
  return String(type || "").toLowerCase() === String(expectedType || "").toLowerCase();
};

const hasExplicitPersonAuthor = (author) => {
  const list = Array.isArray(author) ? author : [author];
  return list.some((entry) => entry && typeof entry === "object" && hasSchemaType(entry, "Person"));
};

const isCanonicalUrl = (raw = "") => {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return false;
    if (parsed.host !== HOST) return false;
    if (parsed.search || parsed.hash) return false;
    if (/\/index\.html$/i.test(parsed.pathname)) return false;
    return true;
  } catch {
    return false;
  }
};

const pushError = (bucket, check, message, details = null) => {
  bucket.push({ severity: "error", check, message, details });
};

const pushWarn = (bucket, check, message, details = null) => {
  bucket.push({ severity: "warn", check, message, details });
};

const checkPosts = async (items, issues) => {
  const expected = new Set();
  for (const item of items) {
    expected.add(expectedPostFilename(item));
  }

  const files = await fs.readdir(POSTS_DIR);
  const existing = files.filter((x) => x.toLowerCase().endsWith(".html"));
  const existingSet = new Set(existing);
  const missing = [...expected].filter((x) => !existingSet.has(x));
  const stale = existing.filter((x) => !EXTRA_POST_INDEX_FILES.has(x) && !expected.has(x));

  if (!existingSet.has("index.html")) {
    pushError(issues, "posts.index.exists", "Missing posts/index.html.");
  }
  if (missing.length > 0) {
    pushError(issues, "posts.expected.missing", "Some expected generated post files are missing.", missing.slice(0, 20));
  }
  if (stale.length > 0) {
    pushError(issues, "posts.stale.present", "Stale generated post files detected.", stale.slice(0, 20));
  }
};

const checkSitemaps = async (indexableItems, issues) => {
  const requiredChildren = ["sitemap-core.xml", ...LANGS.map((l) => `sitemap-${l}.xml`)];
  const childLatestLastmod = new Map();
  const coreExpected = INDEXABLE_CORE_SECTIONS.map((section) => canonicalUrl(section));
  const corePath = path.join(SITE_DIR, "sitemap-core.xml");
  const coreXml = await fs.readFile(corePath, "utf8");
  if (!/<urlset\b/i.test(coreXml)) {
    pushError(issues, "sitemap.core.format", "sitemap-core.xml is not a urlset document.");
  }
  const coreUrlCount = (coreXml.match(/<url>/g) || []).length;
  const coreLastmodCount = (coreXml.match(/<lastmod>/g) || []).length;
  if (coreUrlCount !== coreLastmodCount) {
    pushError(
      issues,
      "sitemap.core.lastmod.mismatch",
      `sitemap-core.xml has ${coreUrlCount} url entries but ${coreLastmodCount} lastmod tags.`
    );
  }
  if (/github\.io/i.test(coreXml)) {
    pushError(issues, "sitemap.core.githubio", "sitemap-core.xml contains github.io URLs.");
  }
  const coreEntries = extractUrlEntries(coreXml);
  const coreLocs = coreEntries.map((entry) => entry.loc);
  for (const loc of coreExpected) {
    if (!coreLocs.includes(loc)) {
      pushError(issues, "sitemap.core.missing-url", `Core sitemap missing URL: ${loc}`);
    }
  }
  for (const entry of coreEntries) {
    const loc = entry.loc;
    if (!isCanonicalUrl(loc)) {
      pushError(issues, "sitemap.core.non-canonical", "Core sitemap has non-canonical URL.", { loc });
      continue;
    }
    const normalizedLastmod = toIsoTimestamp(entry.lastmod);
    if (!normalizedLastmod) {
      pushError(issues, "sitemap.core.lastmod.invalid", "Core sitemap has invalid lastmod value.", {
        loc,
        lastmod: entry.lastmod,
      });
      continue;
    }
    if (normalizedLastmod === EPOCH_ISO) {
      pushError(issues, "sitemap.core.lastmod.epoch", "Core sitemap uses epoch fallback lastmod.", {
        loc,
      });
    }
    const repoPath = canonicalLocToRepoPath(loc);
    const gitLastmod = repoPath ? await gitLastmodByRepoPath(repoPath) : null;
    if (!gitLastmod) {
      pushWarn(issues, "sitemap.core.lastmod.git-missing", "Cannot resolve git lastmod for core URL.", {
        loc,
        repoPath,
      });
      continue;
    }
    if (normalizedLastmod !== gitLastmod) {
      pushError(issues, "sitemap.core.lastmod.git-mismatch", "Core sitemap lastmod is not git-derived.", {
        loc,
        expected: gitLastmod,
        actual: normalizedLastmod,
      });
    }
  }
  childLatestLastmod.set("sitemap-core.xml", latestIso(coreEntries.map((entry) => entry.lastmod), EPOCH_ISO));

  for (const lang of LANGS) {
    const name = `sitemap-${lang}.xml`;
    const filePath = path.join(SITE_DIR, name);
    const xml = await fs.readFile(filePath, "utf8");
    if (!/<urlset\b/i.test(xml)) {
      pushError(issues, "sitemap.lang.format", `${name} is not a urlset document.`);
      continue;
    }
    const langUrlCount = (xml.match(/<url>/g) || []).length;
    const langLastmodCount = (xml.match(/<lastmod>/g) || []).length;
    if (langUrlCount !== langLastmodCount) {
      pushError(
        issues,
        "sitemap.lang.lastmod.mismatch",
        `${name} has ${langUrlCount} url entries but ${langLastmodCount} lastmod tags.`
      );
    }
    if (/github\.io/i.test(xml)) {
      pushError(issues, "sitemap.lang.githubio", `${name} contains github.io URLs.`);
    }

    const entries = extractUrlEntries(xml);
    const locs = entries.map((entry) => entry.loc);
    const expectedLangCount = indexableItems.filter(
      (item) => String(item?.language || "").trim().toLowerCase() === lang
    ).length;
    const expectedLangFiles = new Set(
      indexableItems
        .filter((item) => String(item?.language || "").trim().toLowerCase() === lang)
        .map((item) => expectedPostFilename(item))
    );
    if (locs.length !== expectedLangCount) {
      pushError(
        issues,
        "sitemap.lang.count.mismatch",
        `${name} has ${locs.length} URLs, expected ${expectedLangCount} indexable URLs.`
      );
    }
    for (const entry of entries) {
      const loc = entry.loc;
      if (!isCanonicalUrl(loc)) {
        pushError(issues, "sitemap.lang.non-canonical", `${name} has non-canonical URL.`, { loc });
        continue;
      }
      const normalizedLastmod = toIsoTimestamp(entry.lastmod);
      if (!normalizedLastmod) {
        pushError(issues, "sitemap.lang.lastmod.invalid", `${name} has invalid lastmod value.`, {
          loc,
          lastmod: entry.lastmod,
        });
        continue;
      }
      if (normalizedLastmod === EPOCH_ISO) {
        pushError(issues, "sitemap.lang.lastmod.epoch", `${name} uses epoch fallback lastmod.`, { loc });
      }
      const parsed = new URL(loc);
      if (!parsed.pathname.startsWith("/posts/")) {
        pushError(issues, "sitemap.lang.scope", `${name} contains non-post URL.`, { loc });
        continue;
      }
      const fileName = parsed.pathname.slice("/posts/".length);
      if (!fileName.startsWith(`${lang}-`)) {
        pushError(issues, "sitemap.lang.prefix", `${name} contains wrong language post URL.`, { loc });
      }
      if (!expectedLangFiles.has(fileName)) {
        pushError(
          issues,
          "sitemap.lang.non-indexable-url",
          `${name} includes non-indexable post URL (thin/draft/reference leak).`,
          { loc, fileName }
        );
      }
      const repoPath = canonicalLocToRepoPath(loc);
      const gitLastmod = repoPath ? await gitLastmodByRepoPath(repoPath) : null;
      if (!gitLastmod) {
        pushWarn(issues, "sitemap.lang.lastmod.git-missing", `${name} URL has no git lastmod match.`, {
          loc,
          repoPath,
        });
        continue;
      }
      if (normalizedLastmod !== gitLastmod) {
        pushError(issues, "sitemap.lang.lastmod.git-mismatch", `${name} lastmod is not git-derived.`, {
          loc,
          expected: gitLastmod,
          actual: normalizedLastmod,
        });
      }
    }
    childLatestLastmod.set(name, latestIso(entries.map((entry) => entry.lastmod), EPOCH_ISO));
  }

  const indexPath = path.join(SITE_DIR, "sitemap.xml");
  const indexXml = await fs.readFile(indexPath, "utf8");
  if (!/<sitemapindex\b/i.test(indexXml)) {
    pushError(issues, "sitemap.index.format", "sitemap.xml is not a sitemapindex document.");
    return;
  }
  const sitemapEntryCount = (indexXml.match(/<sitemap>/g) || []).length;
  const sitemapLastmodCount = (indexXml.match(/<lastmod>/g) || []).length;
  if (sitemapEntryCount !== sitemapLastmodCount) {
    pushError(
      issues,
      "sitemap.index.lastmod.mismatch",
      `sitemap.xml has ${sitemapEntryCount} sitemap entries but ${sitemapLastmodCount} lastmod tags.`
    );
  }
  if (/github\.io/i.test(indexXml)) {
    pushError(issues, "sitemap.index.githubio", "sitemap.xml contains github.io URLs.");
  }

  const indexEntries = extractSitemapEntries(indexXml);
  const indexLocs = indexEntries.map((entry) => entry.loc);
  const indexEntryByLoc = new Map(
    indexEntries.map((entry) => [entry.loc, { ...entry, normalizedLastmod: toIsoTimestamp(entry.lastmod) }])
  );
  const expectedLocs = requiredChildren.map((name) => canonicalUrl(name));

  for (const loc of expectedLocs) {
    if (!indexLocs.includes(loc)) {
      pushError(issues, "sitemap.index.missing-child", `Missing child sitemap in sitemap.xml: ${loc}`);
    }
  }
  for (const entry of indexEntries) {
    const loc = entry.loc;
    const normalizedLastmod = toIsoTimestamp(entry.lastmod);
    if (!expectedLocs.includes(loc)) {
      pushWarn(issues, "sitemap.index.unknown-child", `Unexpected child sitemap in sitemap.xml: ${loc}`);
    }
    if (!isCanonicalUrl(loc)) {
      pushError(issues, "sitemap.index.non-canonical", "Child sitemap loc is non-canonical.", { loc });
      continue;
    }
    if (!normalizedLastmod) {
      pushError(issues, "sitemap.index.lastmod.invalid", "Child sitemap entry has invalid lastmod.", {
        loc,
        lastmod: entry.lastmod,
      });
      continue;
    }
    if (normalizedLastmod === EPOCH_ISO) {
      pushError(issues, "sitemap.index.lastmod.epoch", "sitemap.xml uses epoch fallback lastmod.", { loc });
    }
  }

  for (const childName of requiredChildren) {
    const loc = canonicalUrl(childName);
    const indexEntry = indexEntryByLoc.get(loc);
    if (!indexEntry || !indexEntry.normalizedLastmod) continue;
    const expectedLastmod = childLatestLastmod.get(childName);
    if (!expectedLastmod) continue;
    if (indexEntry.normalizedLastmod !== expectedLastmod) {
      pushError(
        issues,
        "sitemap.index.lastmod.child-mismatch",
        `sitemap.xml child lastmod does not match child sitemap content max lastmod.`,
        { child: childName, expected: expectedLastmod, actual: indexEntry.normalizedLastmod }
      );
    }
  }
};

const checkRss = async (entryCount, issues) => {
  const rssPath = path.join(SITE_DIR, "rss.xml");
  const rss = await fs.readFile(rssPath, "utf8");
  if (!/<rss\b/i.test(rss) || !/<channel>/i.test(rss)) {
    pushError(issues, "rss.format", "rss.xml is not a valid RSS channel document.");
    return;
  }
  if (/github\.io/i.test(rss)) {
    pushError(issues, "rss.githubio", "rss.xml contains github.io URLs.");
  }

  const channelLinks = extractAll(rss, /<channel>[\s\S]*?<link>([^<]+)<\/link>/gi);
  if (!channelLinks.includes(`${DOMAIN}/`)) {
    pushError(issues, "rss.channel-link", "rss.xml channel link is missing canonical homepage.");
  }

  const itemLinks = extractAll(rss, /<item>[\s\S]*?<link>([^<]+)<\/link>/gi);
  const expectedItems = Math.min(50, entryCount);
  if (itemLinks.length !== expectedItems) {
    pushError(issues, "rss.item-count", `rss.xml item count mismatch: got ${itemLinks.length}, expected ${expectedItems}.`);
  }
  for (const link of itemLinks) {
    if (!isCanonicalUrl(link)) {
      pushError(issues, "rss.item-link.non-canonical", "rss.xml item link is non-canonical.", { link });
    }
  }
};

const checkSearchIndex = async (issues) => {
  let raw;
  try {
    raw = await fs.readFile(SEARCH_INDEX_PATH, "utf8");
  } catch (error) {
    pushError(issues, "search-index.file.missing", "Missing data/search-index.json.");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    pushError(issues, "search-index.json.invalid", "data/search-index.json is not valid JSON.");
    return;
  }

  const items = Array.isArray(payload?.items) ? payload.items : null;
  if (!items) {
    pushError(issues, "search-index.items.missing", "data/search-index.json is missing items array.");
    return;
  }

  if (!payload?.generated_at || Number.isNaN(Date.parse(String(payload.generated_at)))) {
    pushError(issues, "search-index.generated-at.invalid", "data/search-index.json has invalid generated_at.");
  }

  const seenIds = new Set();
  let selectedCount = 0;
  for (const item of items) {
    const id = normalizeText(item?.id);
    if (!id) {
      pushError(issues, "search-index.item.id.missing", "Search index item is missing id.");
      continue;
    }
    if (seenIds.has(id)) {
      pushError(issues, "search-index.item.id.duplicate", "Duplicate search index id detected.", { id });
      continue;
    }
    seenIds.add(id);

    const type = normalizeText(item?.type).toLowerCase();
    const url = normalizeText(item?.url);
    const isExternalHttp = /^https?:\/\//i.test(url) && !url.includes(HOST);

    if (type === "post") {
      if (!url || !isCanonicalUrl(url)) {
        pushError(issues, "search-index.item.url.invalid", "Post search index item must use canonical URL.", { id, url });
      }
      const status = normalizeText(item?.status).toLowerCase();
      if (status !== "ready") {
        pushError(issues, "search-index.item.post.status.invalid", "Search index includes non-ready post.", {
          id,
          status,
        });
      }
    } else if (type === "selected") {
      if (!url || (!isCanonicalUrl(url) && !isExternalHttp)) {
        pushError(
          issues,
          "search-index.item.url.invalid",
          "Selected search index item must use canonical or absolute external URL.",
          { id, url }
        );
      }
      selectedCount += 1;
    } else {
      pushError(issues, "search-index.item.type.invalid", "Search index item has unknown type.", { id, type });
    }
  }

  if (selectedCount === 0) {
    pushError(issues, "search-index.selected.missing", "Search index has no selected-work entries.");
  }
};

const checkRobots = async (issues) => {
  const robotsPath = path.join(SITE_DIR, "robots.txt");
  const robots = await fs.readFile(robotsPath, "utf8");
  if (/github\.io/i.test(robots)) {
    pushError(issues, "robots.githubio", "robots.txt contains github.io URLs.");
  }

  if (!/User-agent:\s*\*/i.test(robots)) {
    pushError(issues, "robots.wildcard.missing", "robots.txt misses User-agent: * block.");
  }
  if (!/Allow:\s*\/\s*$/im.test(robots)) {
    pushError(issues, "robots.allow-root.missing", "robots.txt misses Allow: /.");
  }
  if (!/Disallow:\s*\/tools\/\s*$/im.test(robots)) {
    pushError(issues, "robots.disallow-tools.missing", "robots.txt misses Disallow: /tools/.");
  }
  if (/User-agent:\s*\*[\s\S]*?Disallow:\s*\/\s*$/im.test(robots)) {
    pushError(issues, "robots.blocks-all", "robots.txt wildcard block disallows the entire site.");
  }
  if (!new RegExp(`Sitemap:\\s*${DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/sitemap\\.xml`, "i").test(robots)) {
    pushError(issues, "robots.sitemap-line", "robots.txt missing canonical sitemap line.");
  }

  for (const bot of REQUIRED_BOTS) {
    const blockRe = new RegExp(`User-agent:\\s*${bot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[\\s\\S]*?(?:\\n\\n|$)`, "i");
    const block = robots.match(blockRe)?.[0] || "";
    if (!block) {
      pushError(issues, "robots.bot-block.missing", `robots.txt missing block for ${bot}.`);
      continue;
    }

    if (!/Allow:\s*\/\s*$/im.test(block)) {
      pushError(issues, "robots.bot-allow.missing", `${bot} block misses Allow: /.`);
    }
    if (/^\s*Disallow:\s*/im.test(block)) {
      pushError(issues, "robots.bot-disallow.present", `${bot} block should be full whitelist (no Disallow lines).`);
    }
  }
};

const checkHtmlSeoSemantics = async (items, issues) => {
  const htmlPaths = [...new Set([...STATIC_ROBOTS_POLICY.keys()].map((section) => path.join(SITE_DIR, section)))];
  const itemByFile = new Map(items.map((item) => [expectedPostFilename(item), item]));

  const postFiles = (await fs.readdir(POSTS_DIR)).filter((x) => x.toLowerCase().endsWith(".html"));
  for (const file of postFiles) {
    htmlPaths.push(path.join(POSTS_DIR, file));
  }

  for (const htmlPath of htmlPaths) {
    const rel = path.relative(SITE_DIR, htmlPath).replaceAll(path.sep, "/");
    const html = await fs.readFile(htmlPath, "utf8");

    if (/github\.io/i.test(html)) {
      pushError(issues, "html.githubio.reference", `HTML file references github.io: ${rel}`);
    }

    const canonical = extractCanonical(html);
    if (!canonical) {
      pushError(issues, "html.canonical.missing", `Missing canonical link in ${rel}.`);
    } else if (!isCanonicalUrl(canonical)) {
      pushError(issues, "html.canonical.non-canonical", `Canonical URL is not canonical in ${rel}.`, { canonical });
    }

    const robots = extractRobotsMeta(html);
    if (!robots) {
      pushError(issues, "html.robots.missing", `Missing robots meta in ${rel}.`);
    }

    const staticPolicy = STATIC_ROBOTS_POLICY.get(rel);
    if (staticPolicy) {
      const expectsIndex = staticPolicy === "index";
      if (expectsIndex && !robots.includes("index,follow")) {
        pushError(issues, "html.robots.static.index", `Expected index,follow robots policy in ${rel}.`, { robots });
      }
      if (!expectsIndex && !robots.includes("noindex,follow")) {
        pushError(issues, "html.robots.static.noindex", `Expected noindex,follow robots policy in ${rel}.`, { robots });
      }
    }

    let expectedSocialImage = null;
    const staticSocialType = STATIC_SOCIAL_IMAGE_POLICY.get(rel);
    if (staticSocialType) {
      expectedSocialImage = SOCIAL_OG_IMAGE_BY_TYPE[staticSocialType] || SOCIAL_OG_IMAGE_BY_TYPE.default;
    } else if (rel.startsWith("posts/") && !EXTRA_POST_INDEX_FILES.has(path.basename(rel))) {
      expectedSocialImage = SOCIAL_OG_IMAGE_BY_TYPE.posts;
    }

    if (expectedSocialImage) {
      const ogImage = extractMetaContent(html, "property", "og:image");
      const ogWidth = extractMetaContent(html, "property", "og:image:width");
      const ogHeight = extractMetaContent(html, "property", "og:image:height");
      const ogType = extractMetaContent(html, "property", "og:image:type");
      const twitterCard = extractMetaContent(html, "name", "twitter:card");
      const twitterImage = extractMetaContent(html, "name", "twitter:image");

      if (!ogImage) {
        pushError(issues, "html.social.og-image.missing", `Missing og:image in ${rel}.`);
      } else if (ogImage !== expectedSocialImage) {
        pushError(issues, "html.social.og-image.mismatch", `Unexpected og:image in ${rel}.`, {
          expected: expectedSocialImage,
          actual: ogImage,
        });
      }
      if (ogWidth !== OG_IMAGE_WIDTH || ogHeight !== OG_IMAGE_HEIGHT || ogType !== OG_IMAGE_TYPE) {
        pushError(issues, "html.social.og-image-meta.mismatch", `Invalid OG image metadata in ${rel}.`, {
          expected: { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, type: OG_IMAGE_TYPE },
          actual: { width: ogWidth, height: ogHeight, type: ogType },
        });
      }
      if (twitterCard !== "summary_large_image") {
        pushError(issues, "html.social.twitter-card.invalid", `twitter:card must be summary_large_image in ${rel}.`, {
          actual: twitterCard,
        });
      }
      if (!twitterImage) {
        pushError(issues, "html.social.twitter-image.missing", `Missing twitter:image in ${rel}.`);
      } else if (twitterImage !== expectedSocialImage) {
        pushError(issues, "html.social.twitter-image.mismatch", `Unexpected twitter:image in ${rel}.`, {
          expected: expectedSocialImage,
          actual: twitterImage,
        });
      }
    }
  }

  for (const cluster of MULTILINGUAL_CLUSTERS) {
    const expected = {
      ...Object.fromEntries(
        Object.entries(cluster.pages).map(([lang, section]) => [lang, canonicalUrl(section)])
      ),
      "x-default": canonicalUrl(cluster.xDefault),
    };
    const requiredLangs = Object.keys(expected);

    for (const [lang, section] of Object.entries(cluster.pages)) {
      const htmlPath = path.join(SITE_DIR, section);
      const rel = section;
      const html = await fs.readFile(htmlPath, "utf8");
      const links = extractHreflangLinks(html);
      const map = new Map(links.map((link) => [link.hreflang, link.href]));

      for (const hreflang of requiredLangs) {
        const href = map.get(hreflang);
        if (!href) {
          pushError(
            issues,
            "html.hreflang.missing",
            `Missing hreflang="${hreflang}" on ${rel} (${cluster.name}:${lang}).`
          );
          continue;
        }
        if (href !== expected[hreflang]) {
          pushError(
            issues,
            "html.hreflang.href.mismatch",
            `Unexpected hreflang href on ${rel} for ${hreflang}.`,
            { expected: expected[hreflang], actual: href }
          );
        }
      }
    }
  }

  const homeHtml = await fs.readFile(path.join(SITE_DIR, "index.html"), "utf8");
  const homeNodes = flattenJsonLdNodes(extractJsonLdObjects(homeHtml));
  if (!homeNodes.some((node) => hasSchemaType(node, "Person"))) {
    pushError(issues, "home.jsonld.person.missing", "Home page JSON-LD is missing Person entity.");
  }
  if (!homeNodes.some((node) => hasSchemaType(node, "WebSite"))) {
    pushError(issues, "home.jsonld.website.missing", "Home page JSON-LD is missing WebSite entity.");
  }

  for (const file of postFiles) {
    if (EXTRA_POST_INDEX_FILES.has(file)) continue;
    const htmlPath = path.join(POSTS_DIR, file);
    const rel = `posts/${file}`;
    const html = await fs.readFile(htmlPath, "utf8");
    const item = itemByFile.get(file);
    if (!item) {
      pushError(issues, "post.item.missing", `Cannot map generated file to source item: ${rel}`);
      continue;
    }

    const postRobots = extractRobotsMeta(html);
    const shouldIndex = isIndexablePost(item);
    if (shouldIndex && !postRobots.includes("index,follow")) {
      pushError(issues, "post.robots.index.mismatch", `Indexable post is not index,follow: ${rel}`, { robots: postRobots });
    }
    if (!shouldIndex && !postRobots.includes("noindex,follow")) {
      pushError(
        issues,
        "post.robots.noindex.mismatch",
        `Non-indexable post is not noindex,follow: ${rel}`,
        { robots: postRobots }
      );
    }

    const nodes = flattenJsonLdNodes(extractJsonLdObjects(html));
    const article = nodes.find((node) => hasSchemaType(node, "Article"));

    if (!article) {
      pushError(issues, "post.jsonld.article.missing", `Post page is missing Article JSON-LD: ${rel}`);
      continue;
    }
    if (!hasExplicitPersonAuthor(article.author)) {
      pushError(issues, "post.jsonld.author.missing", `Post page Article JSON-LD is missing explicit Person author: ${rel}`);
    }
    if (!article.datePublished || !article.dateModified) {
      pushError(issues, "post.jsonld.date.missing", `Post page Article JSON-LD is missing datePublished/dateModified: ${rel}`);
    }
    const sourceField = article.isBasedOn || article.citation;
    const source = Array.isArray(sourceField) ? sourceField.find((x) => String(x || "").trim()) : sourceField;
    if (!source || !/^https?:\/\//i.test(String(source).trim())) {
      pushError(issues, "post.jsonld.source.missing", `Post page Article JSON-LD is missing explicit source URL: ${rel}`);
    }

    const sourceAnchorMatch = html.match(
      /<p class="source">\s*<a[^>]*href=["']([^"']+)["'][^>]*>\s*(?:Read original(?: source)?|Read piece|Open source|Open original source|Watch video)\s*<\/a>/i
    );
    if (!sourceAnchorMatch || !/^https?:\/\//i.test(String(sourceAnchorMatch[1] || "").trim())) {
      pushError(issues, "post.source.link.missing", `Post page is missing visible source link with absolute URL: ${rel}`);
    }
  }
};

const checkHomeHtmlFirst = async (minimumCards, issues) => {
  const html = await fs.readFile(HOME_INDEX, "utf8");
  if (!html.includes(HOME_FALLBACK_START) || !html.includes(HOME_FALLBACK_END)) {
    pushError(issues, "home.html-first.markers", "Home page is missing HTML-first fallback markers.");
    return;
  }

  const start = html.indexOf(HOME_FALLBACK_START);
  const end = html.indexOf(HOME_FALLBACK_END);
  if (end <= start) {
    pushError(issues, "home.html-first.range", "Home page fallback marker range is invalid.");
    return;
  }

  const between = html.slice(start + HOME_FALLBACK_START.length, end);
  const cardCount = (between.match(/<article class="card"/g) || []).length;
  if (cardCount < minimumCards) {
    pushError(
      issues,
      "home.html-first.too-few-cards",
      `Home page HTML-first fallback has too few cards: ${cardCount} (expected >= ${minimumCards}).`
    );
  }

  if (!/href="(?:https?:\/\/|\/posts\/)/i.test(between)) {
    pushError(issues, "home.html-first.links", "Home page fallback cards do not include visible links.");
  }

  if (!/<noscript>[\s\S]*\/posts\//i.test(html)) {
    pushWarn(issues, "home.html-first.noscript", "Home page is missing a noscript hint with link to /posts/.");
  }
};

const checkNoDraftLeakage = async (items, indexableItems, issues) => {
  const draftItems = items.filter((item) => String(item?.status || "").trim().toLowerCase() !== PUBLISHED_STATUS);
  if (draftItems.length === 0) return;

  const draftPostPaths = new Set(draftItems.map((item) => `/posts/${expectedPostFilename(item)}`));
  const indexablePostPaths = new Set(indexableItems.map((item) => `/posts/${expectedPostFilename(item)}`));

  const homeHtml = await fs.readFile(HOME_INDEX, "utf8");
  const start = homeHtml.indexOf(HOME_FALLBACK_START);
  const end = homeHtml.indexOf(HOME_FALLBACK_END);
  if (start >= 0 && end > start) {
    const fragment = homeHtml.slice(start + HOME_FALLBACK_START.length, end);
    const postHrefs = [...fragment.matchAll(/href=["'](\/posts\/[^"']+\.html)["']/gi)].map((m) => String(m[1] || "").trim());
    const leakedInHome = postHrefs.filter((href) => href && !indexablePostPaths.has(href));
    if (leakedInHome.length > 0) {
      pushError(
        issues,
        "draft.leak.home-fallback",
        "Home HTML-first card block includes non-indexable post links.",
        leakedInHome.slice(0, 20)
      );
    }
  }

  for (const relative of NO_DRAFT_LEAK_TARGETS) {
    const absPath = path.join(SITE_DIR, relative);
    let content = "";
    try {
      content = await fs.readFile(absPath, "utf8");
    } catch {
      pushError(issues, "draft.leak.target.missing", `Draft-leak check target is missing: ${relative}`);
      continue;
    }

    const hits = [];
    for (const draftPath of draftPostPaths) {
      if (content.includes(draftPath)) {
        hits.push(draftPath);
      }
    }

    if (hits.length > 0) {
      pushError(
        issues,
        "draft.leak.detected",
        `Detected draft post links in public/indexable artifact: ${relative}`,
        hits.slice(0, 20)
      );
    }
  }
};

const checkAssetFingerprinting = async (issues) => {
  const htmlFiles = await listHtmlFiles(SITE_DIR);

  for (const sourceRaw of FINGERPRINTED_ASSET_SOURCES) {
    const source = toPosixPath(sourceRaw).replace(/^\/+/, "");
    const sourceAbs = path.join(SITE_DIR, source);
    let stat;
    try {
      stat = await fs.stat(sourceAbs);
    } catch {
      pushError(issues, "assets.source.missing", `Missing source asset for fingerprinting: ${source}`);
      continue;
    }
    if (!stat.isFile()) {
      pushError(issues, "assets.source.invalid", `Asset source is not a file: ${source}`);
      continue;
    }

    const dirAbs = path.dirname(sourceAbs);
    const ext = path.extname(source);
    const base = path.basename(source, ext);
    const expectedPattern = new RegExp(`^${escapeRegExp(base)}\\.[a-f0-9]{${FINGERPRINT_HEX_LENGTH}}${escapeRegExp(ext)}$`);
    const siblings = await fs.readdir(dirAbs);
    const fingerprinted = siblings.filter((name) => expectedPattern.test(name));

    if (fingerprinted.length !== 1) {
      pushError(
        issues,
        "assets.fingerprint.count",
        `Expected exactly one fingerprinted variant for ${source}, got ${fingerprinted.length}.`,
        fingerprinted
      );
      continue;
    }

    const currentFingerprinted = fingerprinted[0];
    const hashedPublic = `/${toPosixPath(path.posix.join(path.posix.dirname(source), currentFingerprinted)).replace(/^\.\//, "")}`;
    const sourcePublic = `/${source}`;
    const sourceRefRe = new RegExp(`${escapeRegExp(sourcePublic)}(?:\\?[^"'\\s)]+)?`);
    const hashedRefRe = new RegExp(`${escapeRegExp(hashedPublic)}(?:\\?[^"'\\s)]+)?`);
    const sourceAbsoluteRe = new RegExp(`${escapeRegExp(`${DOMAIN}/${source}`)}(?:\\?[^"'\\s)]+)?`);
    const hashedAbsoluteRe = new RegExp(`${escapeRegExp(`${DOMAIN}${hashedPublic}`)}(?:\\?[^"'\\s)]+)?`);

    let hashedSeen = false;
    for (const htmlPath of htmlFiles) {
      const rel = toPosixPath(path.relative(SITE_DIR, htmlPath));
      const html = await fs.readFile(htmlPath, "utf8");
      if (sourceRefRe.test(html) || sourceAbsoluteRe.test(html)) {
        pushError(
          issues,
          "assets.reference.unfingerprinted",
          `HTML still references unfingerprinted asset path for ${source}.`,
          { file: rel }
        );
      }
      if (hashedRefRe.test(html) || hashedAbsoluteRe.test(html)) {
        hashedSeen = true;
      }
    }

    if (!hashedSeen) {
      pushWarn(
        issues,
        "assets.reference.unused",
        `No HTML references found for fingerprinted asset ${source}.`
      );
    }
  }

  for (const htmlPath of htmlFiles) {
    const rel = toPosixPath(path.relative(SITE_DIR, htmlPath));
    const html = await fs.readFile(htmlPath, "utf8");
    if (
      /(?:href|src)=["'](?:\/|\.\/|\.\.\/)[^"']+\.(?:css|js|png|jpe?g|webp|svg|woff2?)(?:\?[^"']*\bv=[^"']*)["']/i.test(
        html
      )
    ) {
      pushError(issues, "assets.query-version.present", `Found legacy ?v= asset query in ${rel}.`);
    }
  }
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  const issues = [];

  const raw = await fs.readFile(DATA_PATH, "utf8");
  const payload = JSON.parse(raw);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const publishedItems = items.filter((item) => String(item?.status || "").trim().toLowerCase() === PUBLISHED_STATUS);
  const indexableItems = items.filter((item) => isIndexablePost(item));
  const minimumHomeCards = Math.min(8, Math.max(1, indexableItems.length));

  await checkPosts(items, issues);
  await checkSitemaps(indexableItems, issues);
  await checkRss(indexableItems.length, issues);
  await checkSearchIndex(issues);
  await checkRobots(issues);
  await checkHtmlSeoSemantics(items, issues);
  await checkHomeHtmlFirst(minimumHomeCards, issues);
  await checkNoDraftLeakage(items, indexableItems, issues);
  await checkAssetFingerprinting(issues);

  const errors = issues.filter((x) => x.severity === "error");
  const warns = issues.filter((x) => x.severity === "warn");
  const report = {
    generated_at: new Date().toISOString(),
    checks: {
      posts: true,
      sitemaps: true,
      rss: true,
      search_index: true,
      robots: true,
      html_seo: true,
      home_html_first: true,
      draft_leakage: true,
      asset_fingerprints: true,
      social_preview: true,
    },
    totals: {
      items: items.length,
      published_items: publishedItems.length,
      indexable_items: indexableItems.length,
      errors: errors.length,
      warnings: warns.length,
      issues: issues.length,
    },
    issues,
  };

  if (opts.writeReport) {
    await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
  }

  if (issues.length === 0) {
    console.log("QA passed: generated posts/sitemap/rss/robots and HTML-first home fallback are consistent and canonical.");
    return;
  }

  console.log(JSON.stringify(report, null, 2));

  if (opts.failOnError && errors.length > 0) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
