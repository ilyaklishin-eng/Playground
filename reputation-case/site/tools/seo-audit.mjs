import fs from "node:fs/promises";
import path from "node:path";
import { shouldCompileItem } from "./page-index-policy.mjs";

const ROOT = path.resolve(process.cwd());
const SITE_DIR = process.env.SEO_AUDIT_SITE_DIR
  ? path.resolve(process.env.SEO_AUDIT_SITE_DIR)
  : path.join(ROOT, "reputation-case", "site");
const DATA_PATH = path.join(SITE_DIR, "data", "digests.json");
const CANONICAL_DOMAIN = "https://www.klishin.work";
const CANONICAL_HOST = "www.klishin.work";
const PERSON_ID = "https://www.klishin.work/#person";
const WEBSITE_ID = "https://www.klishin.work/#website";
const ORGANIZATION_ID = "https://www.klishin.work/#organization";
const LANGS = ["EN", "FR", "DE", "ES"];
const HREFLANG_ORDER = ["en", "fr", "de", "es"];
const X_DEFAULT = "x-default";
const REQUIRED_SITEMAPS = [
  "sitemap-core.xml",
  "sitemap-en.xml",
  "sitemap-fr.xml",
  "sitemap-de.xml",
  "sitemap-es.xml",
];
const KEY_ROUTE_CLUSTERS = [
  {
    name: "home",
    pages: {
      en: "/",
      fr: "/fr/",
      de: "/de/",
      es: "/es/",
    },
  },
  {
    name: "bio",
    pages: {
      en: "/bio/",
      fr: "/bio/fr/",
      de: "/bio/de/",
      es: "/bio/es/",
    },
  },
  {
    name: "cases",
    pages: {
      en: "/cases/",
      fr: "/cases/fr/",
      de: "/cases/de/",
      es: "/cases/es/",
    },
  },
  {
    name: "interviews",
    pages: {
      en: "/interviews/",
      fr: "/interviews/fr/",
      de: "/interviews/de/",
      es: "/interviews/es/",
    },
  },
  {
    name: "insights",
    pages: {
      en: "/insights/",
      fr: "/insights/fr/",
      de: "/insights/de/",
      es: "/insights/es/",
    },
  },
];

async function walkHtml(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(current, e.name);
      if (e.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (e.isFile() && e.name.toLowerCase().endsWith(".html")) out.push(abs);
    }
  }
  return out.sort();
}

const slugify = (text = "") =>
  String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72) || "item";

const normalizeLang = (value = "") => {
  const lang = String(value || "").trim().toUpperCase();
  if (LANGS.includes(lang)) return lang;
  return "EN";
};

const toHtmlLang = (value = "") => {
  const lang = normalizeLang(value);
  if (lang === "EN") return "en";
  if (lang === "FR") return "fr";
  if (lang === "DE") return "de";
  if (lang === "ES") return "es";
  return "en";
};

function extractTag(content, regex) {
  const m = content.match(regex);
  return m ? String(m[1] || "").trim() : "";
}

function extractAlternateLinks(content) {
  const tags = [...content.matchAll(/<link\b[^>]*rel=["']alternate["'][^>]*>/gi)].map((m) => m[0]);
  const out = [];
  for (const tag of tags) {
    const hreflang = extractTag(tag, /\shreflang=["']([^"']+)["']/i).toLowerCase();
    const href = extractTag(tag, /\shref=["']([^"']+)["']/i);
    if (!hreflang || !href) continue;
    out.push({ hreflang, href });
  }
  return out;
}

function toPublicPath(absPath) {
  const rel = path.relative(SITE_DIR, absPath).replace(/\\/g, "/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"/index.html".length)}/`;
  return `/${rel}`;
}

function canonicalUrl(relativePath = "") {
  const clean = String(relativePath || "").replace(/^\/+/, "");
  if (!clean || clean === "index.html") return `${CANONICAL_DOMAIN}/`;
  if (clean.endsWith("/index.html")) {
    const dir = clean.slice(0, -"/index.html".length);
    return `${CANONICAL_DOMAIN}/${dir}/`;
  }
  return `${CANONICAL_DOMAIN}/${clean}`;
}

function toExpectedCanonical(absPath) {
  return `${CANONICAL_DOMAIN}${toPublicPath(absPath)}`;
}

function hasNoindex(robotsMeta) {
  return /(^|\s|,)noindex(\s|,|$)/i.test(robotsMeta);
}

function isPostPath(publicPath = "") {
  if (!/^\/posts\/[^/]+\.html$/i.test(publicPath)) return false;
  return !/^\/posts\/(?:index|all|drafts)\.html$/i.test(publicPath);
}

function canonicalNormalizationIssues(canonical) {
  if (!canonical) return [];
  const issues = [];
  let parsed;
  try {
    parsed = new URL(canonical);
  } catch {
    return ["invalid_url"];
  }
  if (parsed.protocol !== "https:") issues.push("not_https");
  if (parsed.host !== CANONICAL_HOST) issues.push("host_mismatch");
  if (parsed.search) issues.push("has_query");
  if (parsed.hash) issues.push("has_hash");
  if (/\/index\.html$/i.test(parsed.pathname)) issues.push("ends_with_index_html");
  return issues;
}

function sortHreflangAlternates(items) {
  return items.slice().sort((a, b) => {
    const aPos = HREFLANG_ORDER.indexOf(a.hreflang);
    const bPos = HREFLANG_ORDER.indexOf(b.hreflang);
    return (aPos === -1 ? 99 : aPos) - (bPos === -1 ? 99 : bPos);
  });
}

function buildLanguageClusters(items) {
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
}

function buildEntries(items) {
  return items.map((item) => {
    const explicitSlug = String(item.slug || "").trim().replace(/\.html$/i, "");
    const slug = explicitSlug || `${item.id || "item"}-${slugify(item.title || "entry")}`;
    const postPath = `${slug}.html`;
    return { item, postPath };
  });
}

function alternatesForItem(item, idToPostPath, idToCluster) {
  const itemId = String(item?.id || "").trim();
  const selfLang = toHtmlLang(item?.language);
  const cluster = idToCluster.get(itemId) || { [normalizeLang(item?.language)]: itemId };
  const raw = [];

  for (const [clusterLang, clusterId] of Object.entries(cluster)) {
    const postPath = idToPostPath.get(clusterId);
    if (!postPath) continue;
    raw.push({
      hreflang: toHtmlLang(clusterLang),
      href: canonicalUrl(`posts/${postPath}`),
      id: clusterId,
    });
  }

  if (!raw.some((alt) => alt.id === itemId)) {
    const selfPath = idToPostPath.get(itemId);
    if (selfPath) {
      raw.push({
        hreflang: selfLang,
        href: canonicalUrl(`posts/${selfPath}`),
        id: itemId,
      });
    }
  }

  const dedupe = new Map();
  for (const alt of raw) {
    dedupe.set(`${alt.hreflang}::${alt.href}`, alt);
  }
  const alternates = sortHreflangAlternates([...dedupe.values()]);

  const preferredXDefaultId = String(cluster.EN || itemId || "").trim();
  const preferredPath = idToPostPath.get(preferredXDefaultId) || idToPostPath.get(itemId);
  const xDefaultHref = preferredPath ? canonicalUrl(`posts/${preferredPath}`) : null;

  return { alternates, xDefaultHref };
}

function extractXmlLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gim)].map((m) => String(m[1] || "").trim());
}

function isCanonicalUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.host !== CANONICAL_HOST) return false;
    if (parsed.search || parsed.hash) return false;
    if (/\/index\.html$/i.test(parsed.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const rawData = await fs.readFile(DATA_PATH, "utf8");
  const payload = JSON.parse(rawData);
  const allItems = Array.isArray(payload.items) ? payload.items : [];
  const items = allItems.filter((item) => shouldCompileItem(item, { production: true }));
  const entries = buildEntries(items);
  const idToPostPath = new Map(entries.map((entry) => [entry.item.id, entry.postPath]));
  const postPathToItem = new Map(entries.map((entry) => [entry.postPath, entry.item]));
  const idToCluster = buildLanguageClusters(items);

  const htmlFiles = await walkHtml(SITE_DIR);
  const rows = [];

  for (const file of htmlFiles) {
    const content = await fs.readFile(file, "utf8");
    const canonical = extractTag(content, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    const robots = extractTag(content, /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
    const altLinks = extractAlternateLinks(content);
    const publicPath = toPublicPath(file);
    const postSlug = publicPath.startsWith("/posts/") ? publicPath.slice("/posts/".length) : null;
    const item = postSlug ? postPathToItem.get(postSlug) : null;

    rows.push({
      file,
      path: publicPath,
      canonical,
      expectedCanonical: toExpectedCanonical(file),
      canonicalNormalization: canonicalNormalizationIssues(canonical),
      robots,
      noindex: hasNoindex(robots),
      githubRef: /github\.io/i.test(content),
      hasArticleJsonLd: /"@type"\s*:\s*"Article"/.test(content),
      hasWebSiteJsonLd: /"@type"\s*:\s*"WebSite"/.test(content),
      hasPersonJsonLd: /"@type"\s*:\s*"Person"/.test(content),
      hasOrganizationJsonLd: /"@type"\s*:\s*"Organization"/.test(content),
      hasPersonEntityId: content.includes(PERSON_ID),
      hasWebSiteEntityId: content.includes(WEBSITE_ID),
      hasOrganizationEntityId: content.includes(ORGANIZATION_ID),
      alternates: altLinks,
      item,
      isPost: isPostPath(publicPath),
    });
  }

  const canonicalMissing = rows.filter((r) => !r.canonical).map((r) => r.path);
  const canonicalMismatched = rows
    .filter((r) => r.canonical && r.canonical !== r.expectedCanonical)
    .map((r) => ({ path: r.path, canonical: r.canonical, expected: r.expectedCanonical }));
  const canonicalNormalizationIssuesList = rows
    .filter((r) => (r.canonicalNormalization || []).length > 0)
    .map((r) => ({
      path: r.path,
      canonical: r.canonical,
      issues: r.canonicalNormalization,
    }));
  const noindexPages = rows.filter((r) => r.noindex).map((r) => r.path);
  const githubRefs = rows.filter((r) => r.githubRef).map((r) => r.path);
  const entityConsistencyIssues = rows
    .filter((r) => !r.hasPersonEntityId || !r.hasWebSiteEntityId || !r.hasOrganizationEntityId)
    .map((r) => ({
      path: r.path,
      missing: [
        ...(r.hasPersonEntityId ? [] : ["person_id"]),
        ...(r.hasWebSiteEntityId ? [] : ["website_id"]),
        ...(r.hasOrganizationEntityId ? [] : ["organization_id"]),
      ],
    }));

  const canonicalToPaths = new Map();
  for (const row of rows) {
    if (!row.canonical) continue;
    const list = canonicalToPaths.get(row.canonical) || [];
    list.push(row.path);
    canonicalToPaths.set(row.canonical, list);
  }
  const duplicateCanonicalGroups = [...canonicalToPaths.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([canonical, paths]) => ({ canonical, paths }));

  const hreflangIssues = [];
  for (const row of rows.filter((r) => r.isPost)) {
    if (!row.item) {
      hreflangIssues.push({
        path: row.path,
        issue: "post_not_found_in_dataset",
      });
      continue;
    }
    const expected = alternatesForItem(row.item, idToPostPath, idToCluster);
    const expectedMap = new Map();
    for (const alt of expected.alternates) {
      expectedMap.set(alt.hreflang, alt.href);
    }
    if (expected.xDefaultHref) {
      expectedMap.set(X_DEFAULT, expected.xDefaultHref);
    }

    const actualMap = new Map();
    for (const alt of row.alternates) {
      if (!actualMap.has(alt.hreflang)) {
        actualMap.set(alt.hreflang, alt.href);
      }
    }

    for (const [hreflang, href] of expectedMap.entries()) {
      if (!actualMap.has(hreflang)) {
        hreflangIssues.push({
          path: row.path,
          issue: "missing_hreflang",
          hreflang,
          expected: href,
        });
        continue;
      }
      if (actualMap.get(hreflang) !== href) {
        hreflangIssues.push({
          path: row.path,
          issue: "hreflang_href_mismatch",
          hreflang,
          expected: href,
          actual: actualMap.get(hreflang),
        });
      }
    }

    for (const [hreflang, href] of actualMap.entries()) {
      if (!expectedMap.has(hreflang)) {
        hreflangIssues.push({
          path: row.path,
          issue: "unexpected_hreflang",
          hreflang,
          actual: href,
        });
      }
    }
  }

  const rowByPath = new Map(rows.map((row) => [row.path, row]));
  const keyRouteHreflangIssues = [];
  for (const cluster of KEY_ROUTE_CLUSTERS) {
    const expectedMap = new Map([
      ["en", `${CANONICAL_DOMAIN}${cluster.pages.en}`],
      ["fr", `${CANONICAL_DOMAIN}${cluster.pages.fr}`],
      ["de", `${CANONICAL_DOMAIN}${cluster.pages.de}`],
      ["es", `${CANONICAL_DOMAIN}${cluster.pages.es}`],
      [X_DEFAULT, `${CANONICAL_DOMAIN}${cluster.pages.en}`],
    ]);

    for (const [lang, pagePath] of Object.entries(cluster.pages)) {
      const row = rowByPath.get(pagePath);
      if (!row) {
        keyRouteHreflangIssues.push({
          cluster: cluster.name,
          path: pagePath,
          issue: "missing_page",
        });
        continue;
      }

      const actualMap = new Map();
      for (const alt of row.alternates || []) {
        if (!actualMap.has(alt.hreflang)) {
          actualMap.set(alt.hreflang, alt.href);
        }
      }

      for (const [hreflang, href] of expectedMap.entries()) {
        if (!actualMap.has(hreflang)) {
          keyRouteHreflangIssues.push({
            cluster: cluster.name,
            path: pagePath,
            issue: "missing_hreflang",
            hreflang,
            expected: href,
          });
          continue;
        }
        if (actualMap.get(hreflang) !== href) {
          keyRouteHreflangIssues.push({
            cluster: cluster.name,
            path: pagePath,
            issue: "hreflang_href_mismatch",
            hreflang,
            expected: href,
            actual: actualMap.get(hreflang),
          });
        }
      }

      for (const [hreflang, href] of actualMap.entries()) {
        if (!expectedMap.has(hreflang)) {
          keyRouteHreflangIssues.push({
            cluster: cluster.name,
            path: pagePath,
            issue: "unexpected_hreflang",
            hreflang,
            actual: href,
          });
        }
      }
    }
  }

  const robotsPath = path.join(SITE_DIR, "robots.txt");
  const sitemapIndexPath = path.join(SITE_DIR, "sitemap.xml");
  const robotsTxt = await fs.readFile(robotsPath, "utf8");
  const sitemapIndexXml = await fs.readFile(sitemapIndexPath, "utf8");
  const sitemapIndexLocs = extractXmlLocs(sitemapIndexXml);
  const expectedSitemapLocs = REQUIRED_SITEMAPS.map((name) => canonicalUrl(name));
  const missingSitemapsInIndex = expectedSitemapLocs.filter((loc) => !sitemapIndexLocs.includes(loc));
  const unknownSitemapsInIndex = sitemapIndexLocs.filter((loc) => !expectedSitemapLocs.includes(loc));
  const sitemapChildMissingFiles = [];
  const sitemapChildLocIssues = [];
  const sitemapLanguageScopeIssues = [];

  for (const name of REQUIRED_SITEMAPS) {
    const abs = path.join(SITE_DIR, name);
    let xml = "";
    try {
      xml = await fs.readFile(abs, "utf8");
    } catch {
      sitemapChildMissingFiles.push(name);
      continue;
    }

    const locs = extractXmlLocs(xml);
    for (const loc of locs) {
      if (!isCanonicalUrl(loc)) {
        sitemapChildLocIssues.push({
          sitemap: name,
          url: loc,
          issue: "non_canonical_url",
        });
      }
    }

    const langMatch = name.match(/^sitemap-(en|fr|de|es)\.xml$/i);
    if (langMatch) {
      const lang = String(langMatch[1]).toLowerCase();
      for (const loc of locs) {
        try {
          const parsed = new URL(loc);
          if (!/^\/posts\//.test(parsed.pathname)) {
            sitemapLanguageScopeIssues.push({
              sitemap: name,
              url: loc,
              issue: "non_post_url_in_language_sitemap",
            });
            continue;
          }
          const fileName = parsed.pathname.slice("/posts/".length);
          if (!new RegExp(`^${lang}-`).test(fileName)) {
            sitemapLanguageScopeIssues.push({
              sitemap: name,
              url: loc,
              issue: "wrong_language_prefix",
            });
          }
        } catch {
          sitemapLanguageScopeIssues.push({
            sitemap: name,
            url: loc,
            issue: "invalid_url",
          });
        }
      }
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    canonical_domain: CANONICAL_DOMAIN,
    totals: {
      html_pages: rows.length,
      post_pages: rows.filter((r) => r.isPost).length,
      indexable_pages: rows.filter((r) => !r.noindex).length,
      article_jsonld_pages: rows.filter((r) => r.hasArticleJsonLd).length,
      website_jsonld_pages: rows.filter((r) => r.hasWebSiteJsonLd).length,
      person_jsonld_pages: rows.filter((r) => r.hasPersonJsonLd).length,
      organization_jsonld_pages: rows.filter((r) => r.hasOrganizationJsonLd).length,
      pages_with_all_core_entity_ids: rows.filter(
        (r) => r.hasPersonEntityId && r.hasWebSiteEntityId && r.hasOrganizationEntityId
      ).length,
    },
    checks: {
      robots_txt_exists: true,
      sitemap_xml_exists: true,
      sitemap_xml_is_index: /<sitemapindex\b/i.test(sitemapIndexXml),
      robots_has_sitemap_line: new RegExp(
        `\\nSitemap:\\s*${CANONICAL_DOMAIN.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\/sitemap\\.xml\\s*$`,
        "m"
      ).test(robotsTxt),
      robots_blocks_all: /^Disallow:\s*\/\s*$/m.test(robotsTxt),
      sitemap_index_all_entries_canonical: sitemapIndexLocs.every((loc) => isCanonicalUrl(loc)),
      sitemap_index_has_required_children: missingSitemapsInIndex.length === 0,
      core_entity_ids_on_all_pages: entityConsistencyIssues.length === 0,
      key_routes_hreflang_consistent: keyRouteHreflangIssues.length === 0,
    },
    issues: {
      canonical_missing: canonicalMissing,
      canonical_mismatched: canonicalMismatched,
      canonical_normalization_issues: canonicalNormalizationIssuesList,
      noindex_pages: noindexPages,
      github_io_references: githubRefs,
      entity_consistency_pages_missing_ids: entityConsistencyIssues,
      duplicate_canonical_groups: duplicateCanonicalGroups,
      hreflang_issues: hreflangIssues,
      sitemap_index_missing_children: missingSitemapsInIndex,
      sitemap_index_unknown_children: unknownSitemapsInIndex,
      sitemap_child_missing_files: sitemapChildMissingFiles,
      sitemap_child_loc_issues: sitemapChildLocIssues,
      sitemap_language_scope_issues: sitemapLanguageScopeIssues,
      key_route_hreflang_issues: keyRouteHreflangIssues,
    },
    pages: rows.map((row) => ({
      path: row.path,
      canonical: row.canonical,
      robots: row.robots,
      noindex: row.noindex,
      article_jsonld: row.hasArticleJsonLd,
      website_jsonld: row.hasWebSiteJsonLd,
      person_jsonld: row.hasPersonJsonLd,
      organization_jsonld: row.hasOrganizationJsonLd,
      has_person_id: row.hasPersonEntityId,
      has_website_id: row.hasWebSiteEntityId,
      has_organization_id: row.hasOrganizationEntityId,
      alternates: row.alternates,
    })),
  };

  const outPath = path.join(SITE_DIR, "seo-audit-report.json");
  await fs.writeFile(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
