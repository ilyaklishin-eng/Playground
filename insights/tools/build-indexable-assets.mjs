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

const buildPostHtml = (item, postPath) => {
  const title = `${item.title} | Ilya Klishin Digest`;
  const description = item.digest || "Fact-based digest entry with source link.";
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
      .source { margin-top: 24px; }
      blockquote { margin: 20px 0; padding: 14px 18px; background: #fff; border-left: 4px solid #0b4f7b; }
    </style>
  </head>
  <body>
    <main>
      <a class="back" href="../index.html">&larr; Back to digest index</a>
      <h1>${htmlEscape(item.title)}</h1>
      <p class="meta">${htmlEscape(item.source || "-")} | ${htmlEscape(item.date || "-")} | ${htmlEscape(item.language || "-")} | ${htmlEscape(item.topic || "-")}</p>
      <p>${htmlEscape(item.digest || "")}</p>
      <blockquote>${htmlEscape(item.quote || "")}</blockquote>
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
  const now = new Date().toISOString();
  const urls = [
    `${baseUrl}/index.html`,
    `${baseUrl}/posts/index.html`,
    `${baseUrl}/rss.xml`,
    ...entries.map((entry) => `${baseUrl}/posts/${entry.postPath}`),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url><loc>${xmlEscape(url)}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq></url>`
  )
  .join("\n")}
</urlset>
`;
};

const buildRss = (entries) => {
  const now = new Date().toUTCString();
  const items = entries
    .slice()
    .sort((a, b) => String(b.item.date || "").localeCompare(String(a.item.date || "")))
    .slice(0, 50)
    .map((entry) => {
      const link = `${baseUrl}/posts/${entry.postPath}`;
      const source = entry.item.url || "";
      const description = `${entry.item.digest || ""}\n\nOriginal source: ${source}`;
      return `    <item>
      <title>${xmlEscape(entry.item.title)}</title>
      <link>${xmlEscape(link)}</link>
      <guid>${xmlEscape(link)}</guid>
      <pubDate>${new Date(entry.item.date || Date.now()).toUTCString()}</pubDate>
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
    const slug = `${item.id || "item"}-${slugify(item.title || "entry")}`;
    const postPath = `${slug}.html`;
    const html = buildPostHtml(item, `posts/${postPath}`);
    await fs.writeFile(path.join(postsDir, postPath), html, "utf8");
    entries.push({ item, postPath });
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
