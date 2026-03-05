import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, "..");
const dataPath = path.join(siteDir, "data", "digests.json");
const postsDir = path.join(siteDir, "posts");
const baseUrl = "https://ilyaklishin-eng.github.io/Playground/insights";
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

const toArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const toIsoTimestamp = (value = "") => {
  const ts = Date.parse(String(value || ""));
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toISOString();
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

const buildPostHtml = (item, postPath) => {
  const title = `${item.title} | Ilya Klishin Digest`;
  const summary = item.summary || item.digest || "";
  const keyIdeas = toArray(item.key_ideas);
  const quotes = toArray(item.quotes);
  const valueContext = item.value_context || "";
  const semanticTags = toArray(item.semantic_tags);
  const description = summary || "Fact-based digest entry with source link.";
  const canonical = `${baseUrl}/${postPath}`;
  const sourceLink = item.url;
  const htmlLang = toHtmlLang(item.language);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: item.title,
    inLanguage: htmlLang,
    datePublished: item.date || undefined,
    author: {
      "@type": "Person",
      name: "Ilia Klishin",
    },
    publisher: {
      "@type": "Organization",
      name: "Ilya Klishin Digest",
    },
    mainEntityOfPage: canonical,
    url: canonical,
    description,
    keywords: semanticTags.join(", "),
  };

  return `<!doctype html>
<html lang="${htmlLang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${htmlEscape(title)}</title>
    <meta name="description" content="${htmlEscape(description)}" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${htmlEscape(item.title)}" />
    <meta property="og:description" content="${htmlEscape(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>
      body { margin: 0; font-family: Georgia, serif; background: #f4f1ea; color: #121212; }
      main { max-width: 820px; margin: 0 auto; padding: 40px 20px 72px; }
      a { color: #0b4f7b; }
      .meta { color: #555; font-size: 0.95rem; }
      .back { margin-bottom: 20px; display: inline-block; }
      .section { margin-top: 18px; }
      h2 { margin: 0 0 8px; font-size: 1.05rem; }
      ul { margin: 0; padding-left: 18px; }
      li { margin: 6px 0; }
      .quote { color: #444; font-style: italic; }
      .tags { color: #555; font-size: 0.9rem; }
      .source { margin-top: 24px; }
    </style>
  </head>
  <body>
    <main>
      <a class="back" href="../index.html">&larr; Back to digest index</a>
      <h1>${htmlEscape(item.title)}</h1>
      <p class="meta">${htmlEscape(item.source || "-")} | ${htmlEscape(item.date || "-")} | ${htmlEscape(item.language || "-")} | ${htmlEscape(item.topic || "-")}</p>
      <section class="section">
        <h2>Summary</h2>
        <p>${htmlEscape(summary)}</p>
      </section>
      <section class="section">
        <h2>Key Ideas</h2>
        <ul>
${keyIdeas.map((idea) => `          <li>${htmlEscape(idea)}</li>`).join("\n")}
        </ul>
      </section>
      <section class="section">
        <h2>Quotes</h2>
        <ul>
${quotes.map((q) => `          <li class="quote">${htmlEscape(q)} — ${htmlEscape(item.source || "Source")}</li>`).join("\n")}
        </ul>
      </section>
      <section class="section">
        <h2>Value / Context</h2>
        <p>${htmlEscape(valueContext)}</p>
      </section>
      <section class="section">
        <h2>Semantic Tags</h2>
        <p class="tags">${htmlEscape(semanticTags.join(", "))}</p>
      </section>
      <p class="source"><a href="${htmlEscape(sourceLink)}" rel="noreferrer" target="_blank">Open original source</a></p>
    </main>
  </body>
</html>
`;
};

const buildPostsIndexHtml = (entries) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ilya Klishin Digest Posts</title>
    <meta name="description" content="Index of digest posts for search and archive navigation." />
    <link rel="canonical" href="${baseUrl}/posts/index.html" />
    <meta name="robots" content="index,follow" />
    <style>
      body { margin: 0; font-family: Georgia, serif; background: #f4f1ea; color: #121212; }
      main { max-width: 880px; margin: 0 auto; padding: 40px 20px 72px; }
      li { margin: 8px 0; }
      a { color: #0b4f7b; }
    </style>
  </head>
  <body>
    <main>
      <h1>Ilya Klishin Digest Posts</h1>
      <p><a href="../index.html">Back to digest homepage</a></p>
      <ul>
${entries
  .map(
    (entry) =>
      `        <li><a href="./${entry.postPath}">${htmlEscape(entry.item.title)}</a> (${htmlEscape(entry.item.language)} | ${htmlEscape(entry.item.date || "-")})</li>`
  )
  .join("\n")}
      </ul>
    </main>
  </body>
</html>
`;

const buildSitemap = (entries) => {
  const buildIso = latestBuildIso(entries);
  const urls = [
    { url: `${baseUrl}/index.html`, lastmod: buildIso },
    { url: `${baseUrl}/posts/index.html`, lastmod: buildIso },
    { url: `${baseUrl}/rss.xml`, lastmod: buildIso },
    ...entries.map((entry) => ({
      url: `${baseUrl}/posts/${entry.postPath}`,
      lastmod: toIsoTimestamp(entry.item?.date) || buildIso,
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (item) =>
      `  <url><loc>${xmlEscape(item.url)}</loc><lastmod>${item.lastmod}</lastmod><changefreq>weekly</changefreq></url>`
  )
  .join("\n")}
</urlset>
`;
};

const buildRss = (entries) => {
  const buildIso = latestBuildIso(entries);
  const now = new Date(buildIso).toUTCString();
  const items = entries
    .slice()
    .sort((a, b) => String(b.item.date || "").localeCompare(String(a.item.date || "")))
    .slice(0, 50)
    .map((entry) => {
      const link = `${baseUrl}/posts/${entry.postPath}`;
      const source = entry.item.url || "";
      const summary = entry.item.summary || entry.item.digest || "";
      const valueContext = entry.item.value_context || "";
      const description = `${summary}\n\n${valueContext}\n\nOriginal source: ${source}`;
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
    <title>Ilya Klishin Fact-Based Digest</title>
    <link>${xmlEscape(`${baseUrl}/index.html`)}</link>
    <description>Fact-based multilingual digest with original source links.</description>
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>
`;
};

const buildRobots = () => `User-agent: *
Allow: /
Sitemap: ${baseUrl}/sitemap.xml
`;

const main = async () => {
  const raw = await fs.readFile(dataPath, "utf8");
  const payload = JSON.parse(raw);
  const items = Array.isArray(payload.items) ? payload.items : [];

  await fs.mkdir(postsDir, { recursive: true });

  const entries = [];
  for (const item of items) {
    const explicitSlug = String(item.slug || "").trim().replace(/\.html$/i, "");
    const slug = explicitSlug || `${item.id || "item"}-${slugify(item.title || "entry")}`;
    const postPath = `${slug}.html`;
    const html = buildPostHtml(item, `posts/${postPath}`);
    await fs.writeFile(path.join(postsDir, postPath), html, "utf8");
    entries.push({ item, postPath });
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

  await fs.writeFile(path.join(postsDir, "index.html"), buildPostsIndexHtml(entries), "utf8");
  await fs.writeFile(path.join(siteDir, "sitemap.xml"), buildSitemap(entries), "utf8");
  await fs.writeFile(path.join(siteDir, "rss.xml"), buildRss(entries), "utf8");
  await fs.writeFile(path.join(siteDir, "robots.txt"), buildRobots(), "utf8");

  console.log(`Generated ${entries.length} post pages, sitemap.xml, rss.xml, robots.txt`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
