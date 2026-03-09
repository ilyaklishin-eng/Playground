import fs from "node:fs/promises";
import path from "node:path";

const SITE_DIR = path.resolve(process.cwd(), "reputation-case", "site");
const POSTS_DIR = path.join(SITE_DIR, "posts");
const DATA_PATH = path.join(SITE_DIR, "data", "digests.json");
const REPORT_PATH = path.join(SITE_DIR, "qa-generated-assets-report.json");
const DOMAIN = "https://www.klishin.work";
const HOST = "www.klishin.work";
const HOME_INDEX = path.join(SITE_DIR, "index.html");
const HOME_FALLBACK_START = "<!-- HTML_FIRST_CARDS_START -->";
const HOME_FALLBACK_END = "<!-- HTML_FIRST_CARDS_END -->";
const LANGS = ["en", "fr", "de", "es"];
const PUBLISHED_STATUS = "ready";
const EXTRA_POST_INDEX_FILES = new Set(["index.html", "drafts.html"]);
const REQUIRED_BOTS = [
  "Googlebot",
  "Google-Extended",
  "Bingbot",
  "OAI-SearchBot",
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "CCBot",
];

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

const CORE_SECTIONS = [
  "index.html",
  "fr/index.html",
  "de/index.html",
  "es/index.html",
  "about/index.html",
  "bio/index.html",
  "bio/fr/index.html",
  "bio/de/index.html",
  "bio/es/index.html",
  "cases/index.html",
  "cases/fr/index.html",
  "cases/de/index.html",
  "cases/es/index.html",
  "insights/index.html",
  "insights/fr/index.html",
  "insights/de/index.html",
  "insights/es/index.html",
  "archive/index.html",
  "posts/index.html",
];

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

const slugify = (text = "") =>
  String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72) || "item";

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

const extractAll = (text = "", re) => [...text.matchAll(re)].map((m) => String(m[1] || "").trim());

const extractCanonical = (html = "") => {
  const match = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  return match ? String(match[1] || "").trim() : "";
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
    const explicitSlug = String(item?.slug || "").trim().replace(/\.html$/i, "");
    const slug = explicitSlug || `${item?.id || "item"}-${slugify(item?.title || "entry")}`;
    expected.add(`${slug}.html`);
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

const checkSitemaps = async (issues) => {
  const requiredChildren = ["sitemap-core.xml", ...LANGS.map((l) => `sitemap-${l}.xml`)];
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

  const indexLocs = extractLocs(indexXml);
  const expectedLocs = requiredChildren.map((name) => canonicalUrl(name));

  for (const loc of expectedLocs) {
    if (!indexLocs.includes(loc)) {
      pushError(issues, "sitemap.index.missing-child", `Missing child sitemap in sitemap.xml: ${loc}`);
    }
  }
  for (const loc of indexLocs) {
    if (!expectedLocs.includes(loc)) {
      pushWarn(issues, "sitemap.index.unknown-child", `Unexpected child sitemap in sitemap.xml: ${loc}`);
    }
    if (!isCanonicalUrl(loc)) {
      pushError(issues, "sitemap.index.non-canonical", "Child sitemap loc is non-canonical.", { loc });
    }
  }

  const coreExpected = CORE_SECTIONS.map((section) => canonicalUrl(section));
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
  const coreLocs = extractLocs(coreXml);
  for (const loc of coreExpected) {
    if (!coreLocs.includes(loc)) {
      pushError(issues, "sitemap.core.missing-url", `Core sitemap missing URL: ${loc}`);
    }
  }
  for (const loc of coreLocs) {
    if (!isCanonicalUrl(loc)) {
      pushError(issues, "sitemap.core.non-canonical", "Core sitemap has non-canonical URL.", { loc });
    }
  }

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

    const locs = extractLocs(xml);
    for (const loc of locs) {
      if (!isCanonicalUrl(loc)) {
        pushError(issues, "sitemap.lang.non-canonical", `${name} has non-canonical URL.`, { loc });
        continue;
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

const checkRobots = async (issues) => {
  const robotsPath = path.join(SITE_DIR, "robots.txt");
  const robots = await fs.readFile(robotsPath, "utf8");
  const gptBotPolicy = normalizePolicy(process.env.GPTBOT_POLICY || "allow");
  const gptBotCustomPaths = parsePathList(process.env.GPTBOT_DISALLOW_PATHS, ["/tools/"]);
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
    if (bot === "GPTBot") {
      if (gptBotPolicy === "deny") {
        if (!/Disallow:\s*\/\s*$/im.test(block)) {
          pushError(issues, "robots.gptbot.deny.missing", "GPTBot deny policy expects Disallow: /.");
        }
      } else if (gptBotPolicy === "custom") {
        if (!gptBotCustomPaths.includes("/") && !/Allow:\s*\/\s*$/im.test(block)) {
          pushError(issues, "robots.gptbot.custom.allow.missing", "GPTBot custom policy (without /) expects Allow: /.");
        }
        for (const disallowPath of gptBotCustomPaths) {
          const disallowRe = new RegExp(`Disallow:\\s*${disallowPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "im");
          if (!disallowRe.test(block)) {
            pushError(
              issues,
              "robots.gptbot.custom.disallow.missing",
              `GPTBot custom policy misses Disallow: ${disallowPath}.`
            );
          }
        }
      } else {
        if (!/Allow:\s*\/\s*$/im.test(block)) {
          pushError(issues, "robots.bot-allow.missing", `${bot} block misses Allow: /.`);
        }
        if (!/Disallow:\s*\/tools\/\s*$/im.test(block)) {
          pushError(issues, "robots.bot-disallow-tools.missing", `${bot} block misses Disallow: /tools/.`);
        }
      }
      continue;
    }

    if (!/Allow:\s*\/\s*$/im.test(block)) {
      pushError(issues, "robots.bot-allow.missing", `${bot} block misses Allow: /.`);
    }
    if (!/Disallow:\s*\/tools\/\s*$/im.test(block)) {
      pushError(issues, "robots.bot-disallow-tools.missing", `${bot} block misses Disallow: /tools/.`);
    }
  }
};

const checkHtmlSeoSemantics = async (issues) => {
  const htmlPaths = [
    ...CORE_SECTIONS.map((section) => path.join(SITE_DIR, section)),
  ];

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
      /<p class="source">\s*<a[^>]*href=["']([^"']+)["'][^>]*>\s*Open original source\s*<\/a>/i
    );
    if (!sourceAnchorMatch || !/^https?:\/\//i.test(String(sourceAnchorMatch[1] || "").trim())) {
      pushError(issues, "post.source.link.missing", `Post page is missing visible source link with absolute URL: ${rel}`);
    }
  }
};

const checkHomeHtmlFirst = async (issues) => {
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
  if (cardCount < 8) {
    pushError(
      issues,
      "home.html-first.too-few-cards",
      `Home page HTML-first fallback has too few cards: ${cardCount} (expected >= 8).`
    );
  }

  if (!/href="https:\/\/www\.klishin\.work\/posts\//.test(between) && !/href="\/posts\//.test(between)) {
    pushError(issues, "home.html-first.links", "Home page fallback cards do not link to internal /posts/ pages.");
  }

  if (!/<noscript>[\s\S]*\/posts\//i.test(html)) {
    pushWarn(issues, "home.html-first.noscript", "Home page is missing a noscript hint with link to /posts/.");
  }
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  const issues = [];

  const raw = await fs.readFile(DATA_PATH, "utf8");
  const payload = JSON.parse(raw);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const publishedItems = items.filter(
    (item) => String(item?.status || "").trim().toLowerCase() === PUBLISHED_STATUS
  );

  await checkPosts(items, issues);
  await checkSitemaps(issues);
  await checkRss(publishedItems.length, issues);
  await checkRobots(issues);
  await checkHtmlSeoSemantics(issues);
  await checkHomeHtmlFirst(issues);

  const errors = issues.filter((x) => x.severity === "error");
  const warns = issues.filter((x) => x.severity === "warn");
  const report = {
    generated_at: new Date().toISOString(),
    checks: {
      posts: true,
      sitemaps: true,
      rss: true,
      robots: true,
      html_seo: true,
      home_html_first: true,
    },
    totals: {
      items: items.length,
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
