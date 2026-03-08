import fs from "node:fs/promises";
import path from "node:path";

const siteDir = path.resolve(process.cwd(), "reputation-case", "site");
const dataPath = path.join(siteDir, "data", "digests.json");
const postsDir = path.join(siteDir, "posts");
const homeIndexPath = path.join(siteDir, "index.html");
const baseUrl = "https://www.klishin.work";
const HOME_FALLBACK_START = "<!-- HTML_FIRST_CARDS_START -->";
const HOME_FALLBACK_END = "<!-- HTML_FIRST_CARDS_END -->";
const HOME_FALLBACK_LIMIT = 24;
const PERSON_NAME = "Ilia Klishin";
const SITE_NAME = "Ilia Klishin";
const DIGEST_NAME = "Ilia Klishin Digest";
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
  `${baseUrl}/insights/#webpage`,
  `${baseUrl}/archive/#webpage`,
];
const STATIC_SECTIONS = [
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
  "archive/index.html",
];
const LANGS = ["EN", "FR", "DE", "ES"];
const HREFLANG_ORDER = ["en", "fr", "de", "es"];
const X_DEFAULT = "x-default";
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

const previewSummary = (text = "") => {
  const plain = String(text || "").replace(/\s+/g, " ").trim();
  if (!plain) return "";

  const sentenceMatches = plain.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  const sentences = Array.isArray(sentenceMatches)
    ? sentenceMatches.map((sentence) => sentence.trim()).filter(Boolean)
    : [plain];

  if (sentences.length <= 3) return sentences.join(" ");
  return sentences.slice(0, 3).join(" ");
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

const getAlternatesForItem = (item, idToPostPath, idToCluster) => {
  const itemId = String(item?.id || "").trim();
  const selfLang = toHtmlLang(item?.language);
  const cluster = idToCluster.get(itemId) || { [normalizeLang(item?.language)]: itemId };
  const rawAlternates = [];

  for (const [clusterLang, clusterId] of Object.entries(cluster)) {
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
      target: `${canonicalUrl("index.html")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return { person, organization, website };
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

  const candidates = entries.filter((entry) => String(entry?.item?.id || "").trim() !== itemId);
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
    const title = htmlEscape(String(entry?.item?.title || "Untitled"));
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
  const groups = new Map();
  for (const lang of LANGS) groups.set(lang, []);

  for (const entry of entries.slice().sort(sortEntriesForHome)) {
    const lang = normalizeLang(entry?.item?.language);
    if (!groups.has(lang)) groups.set(lang, []);
    groups.get(lang).push(entry);
  }

  const picked = [];
  while (picked.length < limit) {
    let progressed = false;
    for (const lang of LANGS) {
      const queue = groups.get(lang) || [];
      if (!queue.length) continue;
      picked.push(queue.shift());
      progressed = true;
      if (picked.length >= limit) break;
    }
    if (!progressed) break;
  }

  if (picked.length >= limit) return picked.slice(0, limit);

  const usedIds = new Set(picked.map((entry) => String(entry?.item?.id || "").trim()));
  const rest = entries
    .slice()
    .sort(sortEntriesForHome)
    .filter((entry) => {
      const id = String(entry?.item?.id || "").trim();
      if (!id || usedIds.has(id)) return false;
      usedIds.add(id);
      return true;
    });

  return [...picked, ...rest].slice(0, limit);
};

const buildHomeFallbackCards = (entries) => {
  const top = pickHomeFallbackEntries(entries, HOME_FALLBACK_LIMIT);
  return top
    .map((entry) => {
      const item = entry.item || {};
      const lang = htmlEscape(String(item.language || "-"));
      const status = htmlEscape(String(item.status || "ready"));
      const title = htmlEscape(String(item.title || "Untitled"));
      const source = htmlEscape(String(item.source || "-"));
      const date = htmlEscape(String(item.date || "-"));
      const topic = htmlEscape(String(item.topic || "-"));
      const digest = htmlEscape(previewSummary(item.summary || item.digest || ""));
      const quoteCandidates =
        Array.isArray(item.quotes) && item.quotes.length > 0
          ? item.quotes
          : [item.quote].filter(Boolean);
      const quote = htmlEscape(String(quoteCandidates[0] || ""));
      const digestHref = canonicalUrl(`posts/${entry.postPath}`);
      return `        <article class="card">
          <div class="card-head">
            <span class="lang-tag">${lang}</span>
            <span class="status-tag" data-status="${status}">${status}</span>
          </div>
          <h2 class="card-title">${title}</h2>
          <p class="card-meta">${source} • ${date} • ${topic}</p>
          <p class="card-digest">${digest}</p>
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

const buildPostHtml = (item, postPath, idToPostPath, idToCluster, entries) => {
  const title = `${item.title} | ${DIGEST_NAME}`;
  const summary = String(item.summary || item.digest || "").replace(/\s+/g, " ").trim();
  const digest = String(item.digest || summary || "").replace(/\s+/g, " ").trim();
  const description = truncateChars(summary || digest || "Fact-based digest entry with source link.", 170);
  const keyIdeas = normalizedArray(item.key_ideas);
  const quotes = normalizedArray(item.quotes);
  const semanticTags = normalizedArray(item.semantic_tags);
  const valueContext = String(item.value_context || "").replace(/\s+/g, " ").trim();
  const canonical = canonicalUrl(postPath);
  const sourceLink = normalizeSourceUrl(item.url);
  const htmlLang = toHtmlLang(item.language);
  const { alternates, xDefaultHref } = getAlternatesForItem(item, idToPostPath, idToCluster);
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
        name: item.title,
        inLanguage: htmlLang,
        isPartOf: { "@id": WEBSITE_ID },
        about: { "@id": PERSON_ID },
      },
      {
        "@type": "Article",
        "@id": articleId,
        headline: item.title,
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
    <meta property="og:title" content="${htmlEscape(item.title)}" />
    <meta property="og:description" content="${htmlEscape(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>
      body { margin: 0; font-family: Georgia, serif; background: #f4f1ea; color: #121212; }
      main { max-width: 860px; margin: 0 auto; padding: 40px 20px 72px; }
      a { color: #0b4f7b; }
      .meta { color: #555; font-size: 0.95rem; }
      .topnav { margin-bottom: 18px; font-size: 0.95rem; }
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
    </style>
  </head>
  <body>
    <main>
      <nav class="topnav" aria-label="Primary">
        <a href="/">Home</a>
        <a href="/bio/">Bio</a>
        <a href="/cases/">Cases</a>
        <a href="/about/">About</a>
        <a href="/insights/">Insights</a>
        <a href="/archive/">Archive</a>
      </nav>
      <h1>${htmlEscape(item.title)}</h1>
      <p class="meta">${htmlEscape(item.source || "-")} | ${htmlEscape(item.date || "-")} | ${htmlEscape(item.language || "-")} | ${htmlEscape(item.topic || "-")}</p>
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
      ${semanticTags.length > 0
        ? `<section><h2>Semantic Tags</h2><ul class="tags">${semanticTags.map((x) => `<li>${htmlEscape(x)}</li>`).join("")}</ul></section>`
        : ""}
      ${languageLinks.length > 0
        ? `<section><h2>Language Copies</h2><ul>${languageLinks.join("")}</ul></section>`
        : ""}
      <section>
        <h2>Related Materials</h2>
        <h3>Core site sections</h3>
        <ul>
          <li><a href="/">Home digest index</a></li>
          <li><a href="/bio/">Biography (EN/FR/DE/ES)</a></li>
          <li><a href="/cases/">Case clarifications (EN/FR/DE/ES)</a></li>
          <li><a href="/insights/">Insights hub</a></li>
          <li><a href="/archive/">Archive hub</a></li>
        </ul>
        ${topicLinks.length > 0 ? `<h3>More on this topic</h3><ul>${topicLinks.join("")}</ul>` : ""}
        ${sourceLinks.length > 0 ? `<h3>From the same source</h3><ul>${sourceLinks.join("")}</ul>` : ""}
        ${latestLanguageLinks.length > 0 ? `<h3>Recent in this language</h3><ul>${latestLanguageLinks.join("")}</ul>` : ""}
      </section>
      <p class="source"><a href="${htmlEscape(sourceLink)}" rel="noreferrer" target="_blank">Open original source</a></p>
    </main>
  </body>
</html>
`;
};

const buildPostsIndexHtml = (entries) => {
  const postsCanonical = canonicalUrl("posts/index.html");
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
        name: `${DIGEST_NAME} Posts`,
        description: "Static index of multilingual digest entries with direct links to source pages.",
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
        numberOfItems: entries.length,
        itemListElement: entries.map((entry, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          url: canonicalUrl(`posts/${entry.postPath}`),
          name: entry.item.title,
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
    <title>${DIGEST_NAME} Posts</title>
    <meta name="description" content="Index of digest posts for search and archive navigation." />
    <link rel="canonical" href="${postsCanonical}" />
    <link rel="alternate" hreflang="en" href="${postsCanonical}" />
    <link rel="alternate" hreflang="${X_DEFAULT}" href="${postsCanonical}" />
    <meta name="robots" content="index,follow" />
    <script type="application/ld+json">${JSON.stringify(postsJsonLd)}</script>
    <style>
      body { margin: 0; font-family: Georgia, serif; background: #f4f1ea; color: #121212; }
      main { max-width: 880px; margin: 0 auto; padding: 40px 20px 72px; }
      li { margin: 8px 0; }
      a { color: #0b4f7b; }
    </style>
  </head>
  <body>
    <main>
      <h1>${DIGEST_NAME} Posts</h1>
      <p>
        <a href="/">Home</a> ·
        <a href="/bio/">Bio</a> ·
        <a href="/cases/">Cases</a> ·
        <a href="/about/">About</a> ·
        <a href="/insights/">Insights</a> ·
        <a href="/archive/">Archive</a>
      </p>
      <section>
        <h2>Related Materials</h2>
        <ul>
          <li><a href="/">Interactive digest with filters</a></li>
          <li><a href="/insights/">Insights hub</a></li>
          <li><a href="/bio/">Biography (EN, FR, DE, ES)</a></li>
          <li><a href="/cases/">Case clarifications (EN, FR, DE, ES)</a></li>
          <li><a href="/source-registry-v1.tsv">Source registry (TSV)</a></li>
          <li><a href="/rss.xml">RSS feed</a></li>
          <li><a href="/sitemap.xml">Sitemap index</a></li>
        </ul>
      </section>
      <ul>
${entries
  .map(
    (entry) =>
      `        <li><a href="./${entry.postPath}">${htmlEscape(entry.item.title)}</a> — ${htmlEscape(entry.item.source || "-")} • ${htmlEscape(entry.item.date || "-")} • ${htmlEscape(entry.item.language || "-")} • ${htmlEscape(entry.item.topic || "-")}</li>`
  )
  .join("\n")}
      </ul>
    </main>
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

const buildSitemaps = (entries, idToPostPath, idToCluster) => {
  const buildIso = latestBuildIso(entries);
  const staticUrls = STATIC_SECTIONS.map((section) => ({
    url: canonicalUrl(section),
    lastmod: buildIso,
  }));
  const coreUrls = [
    { url: canonicalUrl("index.html"), lastmod: buildIso },
    ...staticUrls,
    { url: canonicalUrl("posts/index.html"), lastmod: buildIso },
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
      const { alternates, xDefaultHref } = getAlternatesForItem(entry.item, idToPostPath, idToCluster);
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
  const idToPostPath = new Map(entries.map((entry) => [entry.item.id, entry.postPath]));
  const idToCluster = buildLanguageClusters(items);

  for (const entry of entries) {
    const html = buildPostHtml(entry.item, `posts/${entry.postPath}`, idToPostPath, idToCluster, entries);
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

  const sitemapFiles = buildSitemaps(entries, idToPostPath, idToCluster);

  await fs.writeFile(path.join(postsDir, "index.html"), buildPostsIndexHtml(entries), "utf8");
  for (const file of sitemapFiles) {
    await fs.writeFile(path.join(siteDir, file.name), file.content, "utf8");
  }
  await fs.writeFile(path.join(siteDir, "rss.xml"), buildRss(entries), "utf8");
  await fs.writeFile(path.join(siteDir, "robots.txt"), buildRobots(), "utf8");
  const notesSource = path.resolve(process.cwd(), "reputation-case", "digest-multilingual-notes-v1.md");
  const notesTarget = path.join(siteDir, "digest-multilingual-notes-v1.md");
  try {
    await fs.copyFile(notesSource, notesTarget);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await updateHomeHtmlFirstCards(entries);

  console.log(
    `Generated ${entries.length} post pages, sitemap index + ${sitemapFiles.length - 1} child sitemaps, rss.xml, robots.txt, home HTML-first cards`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
