import fs from "node:fs/promises";
import path from "node:path";

const ROOT = "/Users/ilyaklishin/Documents/Playground";
const SITE_DIR = path.join(ROOT, "reputation-case", "site");
const FINAL_FORMS_DIR = path.join(ROOT, "reputation-case", "final-forms");
const OUT_DIR = path.join(FINAL_FORMS_DIR, "url-packages");
const DIGESTS_PATH = path.join(SITE_DIR, "data", "digests.json");
const SITEMAP_INDEX_PATH = path.join(SITE_DIR, "sitemap.xml");
const CNAME_PATH = path.join(SITE_DIR, "CNAME");
const TELEGRAPH_REGISTRY_PATH = path.join(FINAL_FORMS_DIR, "telegraph-published-pages.json");
const TELEGRAPH_INDEX_PATH = path.join(FINAL_FORMS_DIR, "telegraph-index-page.json");
const HASHNODE_REGISTRY_PATH = path.join(FINAL_FORMS_DIR, "hashnode-published-pages.json");
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const INDEXNOW_BATCH_SIZE = 10_000;

const slugify = (text = "") =>
  String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72) || "item";

const normalizeUrl = (value = "") => String(value || "").trim();

const unique = (values) => [...new Set(values.map((x) => normalizeUrl(x)).filter(Boolean))];

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const csvEscape = (value = "") => `"${String(value).replaceAll('"', '""')}"`;

const extractLocs = (xml = "") => {
  const out = [];
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    out.push(String(m[1] || "").trim());
  }
  return out;
};

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function readText(filePath, fallback = "") {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return fallback;
  }
}

function toPostPath(item) {
  const explicit = String(item?.slug || "").trim().replace(/\.html$/i, "");
  const slug = explicit || `${item.id || "item"}-${slugify(item.title || "entry")}`;
  return `${slug}.html`;
}

function toCsv(rows, header) {
  const body = rows.map((row) => header.map((key) => csvEscape(row[key] || "")).join(","));
  return [header.join(","), ...body].join("\n") + "\n";
}

function toMarkdownSummary(payload) {
  const lines = [
    `# URL Push Package (${payload.generated_on})`,
    "",
    `- Domain: \`${payload.domain}\``,
    `- Generated at: \`${payload.generated_at}\``,
    "",
    "## Counts",
    `- Site URLs (sitemap canonical): ${payload.counts.site_urls}`,
    `- IndexNow URLs: ${payload.counts.indexnow_urls}`,
    `- Archive core URLs: ${payload.counts.archive_core_urls}`,
    `- Archive with source URLs: ${payload.counts.archive_with_sources_urls}`,
    `- External item rows: ${payload.counts.external_rows}`,
    `- Telegraph URLs: ${payload.counts.telegraph_urls}`,
    `- Hashnode URLs: ${payload.counts.hashnode_urls}`,
    "",
    "## Files",
    `- \`${payload.files.package_json}\``,
    `- \`${payload.files.summary_md}\``,
    `- \`${payload.files.indexnow_urls_txt}\``,
    `- \`${payload.files.archive_core_urls_txt}\``,
    `- \`${payload.files.archive_with_sources_urls_txt}\``,
    `- \`${payload.files.external_targets_csv}\``,
    "",
    "## IndexNow Batches",
  ];

  for (const batch of payload.indexnow.batches) {
    lines.push(
      `- Batch ${batch.batch}: ${batch.count} URLs, txt=\`${batch.urls_txt}\`, payload=\`${batch.payload_json}\``
    );
  }

  return lines.join("\n") + "\n";
}

async function collectSiteUrls(domain) {
  const sitemapIndexXml = await readText(SITEMAP_INDEX_PATH, "");
  const childSitemapLocs = extractLocs(sitemapIndexXml);
  const childSitemapFiles = childSitemapLocs
    .map((loc) => {
      try {
        const url = new URL(loc);
        return path.basename(url.pathname);
      } catch {
        return "";
      }
    })
    .filter(Boolean);

  const siteUrls = [];
  for (const file of childSitemapFiles) {
    const xml = await readText(path.join(SITE_DIR, file), "");
    siteUrls.push(...extractLocs(xml));
  }

  // If sitemap index is missing or empty, fallback to root sitemap file as urlset.
  if (siteUrls.length === 0) {
    siteUrls.push(...extractLocs(sitemapIndexXml));
  }

  // Keep only canonical host URLs.
  const canonical = unique(siteUrls).filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.origin === domain;
    } catch {
      return false;
    }
  });

  return {
    urls: canonical,
    sitemap_index_url: `${domain}/sitemap.xml`,
    child_sitemaps: unique(childSitemapLocs),
  };
}

async function buildPackage() {
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10);
  const cname = (await readText(CNAME_PATH, "www.klishin.work")).trim() || "www.klishin.work";
  const domain = `https://${cname}`;
  const outBase = path.join(OUT_DIR, dateStamp);

  await fs.mkdir(outBase, { recursive: true });

  const digests = await readJson(DIGESTS_PATH, { items: [] });
  const digestItems = Array.isArray(digests.items) ? digests.items : [];

  const telegraphRegistry = await readJson(TELEGRAPH_REGISTRY_PATH, { items: [] });
  const telegraphIndex = await readJson(TELEGRAPH_INDEX_PATH, {});
  const hashnodeRegistry = await readJson(HASHNODE_REGISTRY_PATH, { items: [] });

  const telegraphById = new Map((telegraphRegistry.items || []).map((x) => [x.id, x.url]));
  const hashnodeById = new Map(
    (hashnodeRegistry.items || [])
      .filter((x) => x?.post_url)
      .map((x) => [x.id, x.post_url])
  );

  const telegraphUrls = unique([
    ...(telegraphRegistry.items || []).map((x) => x.url),
    telegraphIndex?.url || "",
  ]);
  const hashnodeUrls = unique((hashnodeRegistry.items || []).map((x) => x.post_url || x.url));

  const site = await collectSiteUrls(domain);
  const siteUrls = site.urls;
  const indexnowUrls = [...siteUrls];

  const externalRows = digestItems.map((item) => {
    const postPath = toPostPath(item);
    const siteUrl = `${domain}/posts/${postPath}`;
    return {
      id: item.id || "",
      language: item.language || "",
      status: item.status || "",
      date: item.date || "",
      title: item.title || "",
      source: item.source || "",
      topic: item.topic || "",
      site_url: siteUrl,
      source_url: item.url || "",
      telegraph_url: telegraphById.get(item.id) || "",
      hashnode_url: hashnodeById.get(item.id) || "",
    };
  });

  const sourceUrls = unique(externalRows.map((x) => x.source_url));
  const archiveCoreUrls = unique([...siteUrls, ...telegraphUrls, ...hashnodeUrls]);
  const archiveWithSourcesUrls = unique([...archiveCoreUrls, ...sourceUrls]);

  const indexnowBatches = chunk(indexnowUrls, INDEXNOW_BATCH_SIZE);
  const batchDescriptors = [];

  const files = {
    package_json: path.join(outBase, `url-push-package-${dateStamp}.json`),
    summary_md: path.join(outBase, `url-push-package-${dateStamp}.md`),
    indexnow_urls_txt: path.join(outBase, `indexnow-urls-${dateStamp}.txt`),
    archive_core_urls_txt: path.join(outBase, `archive-core-urls-${dateStamp}.txt`),
    archive_with_sources_urls_txt: path.join(outBase, `archive-with-sources-urls-${dateStamp}.txt`),
    external_targets_csv: path.join(outBase, `external-targets-${dateStamp}.csv`),
  };

  await fs.writeFile(files.indexnow_urls_txt, `${indexnowUrls.join("\n")}\n`, "utf8");
  await fs.writeFile(files.archive_core_urls_txt, `${archiveCoreUrls.join("\n")}\n`, "utf8");
  await fs.writeFile(files.archive_with_sources_urls_txt, `${archiveWithSourcesUrls.join("\n")}\n`, "utf8");
  await fs.writeFile(
    files.external_targets_csv,
    toCsv(externalRows, [
      "id",
      "language",
      "status",
      "date",
      "title",
      "source",
      "topic",
      "site_url",
      "source_url",
      "telegraph_url",
      "hashnode_url",
    ]),
    "utf8"
  );

  for (let idx = 0; idx < indexnowBatches.length; idx += 1) {
    const batchNumber = String(idx + 1).padStart(3, "0");
    const urls = indexnowBatches[idx];
    const urlsTxt = path.join(outBase, `indexnow-batch-${batchNumber}-urls.txt`);
    const payloadJson = path.join(outBase, `indexnow-batch-${batchNumber}-payload.json`);
    const payload = {
      host: cname,
      key: "<INDEXNOW_KEY>",
      keyLocation: `${domain}/<INDEXNOW_KEY>.txt`,
      urlList: urls,
    };
    await fs.writeFile(urlsTxt, `${urls.join("\n")}\n`, "utf8");
    await fs.writeFile(payloadJson, JSON.stringify(payload, null, 2) + "\n", "utf8");
    batchDescriptors.push({
      batch: idx + 1,
      count: urls.length,
      urls_txt: urlsTxt,
      payload_json: payloadJson,
    });
  }

  const payload = {
    generated_at: now.toISOString(),
    generated_on: dateStamp,
    domain,
    inputs: {
      sitemap_index_url: site.sitemap_index_url,
      sitemap_children: site.child_sitemaps,
      digests_path: DIGESTS_PATH,
      telegraph_registry_exists: (telegraphRegistry.items || []).length > 0,
      hashnode_registry_exists: (hashnodeRegistry.items || []).length > 0,
    },
    counts: {
      site_urls: siteUrls.length,
      indexnow_urls: indexnowUrls.length,
      archive_core_urls: archiveCoreUrls.length,
      archive_with_sources_urls: archiveWithSourcesUrls.length,
      external_rows: externalRows.length,
      source_urls: sourceUrls.length,
      telegraph_urls: telegraphUrls.length,
      hashnode_urls: hashnodeUrls.length,
      indexnow_batches: batchDescriptors.length,
    },
    files,
    indexnow: {
      endpoint: INDEXNOW_ENDPOINT,
      host: cname,
      key_location_placeholder: `${domain}/<INDEXNOW_KEY>.txt`,
      batches: batchDescriptors,
    },
    samples: {
      indexnow_first_10: indexnowUrls.slice(0, 10),
      archive_core_first_10: archiveCoreUrls.slice(0, 10),
      archive_with_sources_first_10: archiveWithSourcesUrls.slice(0, 10),
      external_rows_first_5: externalRows.slice(0, 5),
    },
  };

  await fs.writeFile(files.package_json, JSON.stringify(payload, null, 2) + "\n", "utf8");
  await fs.writeFile(files.summary_md, toMarkdownSummary(payload), "utf8");

  console.log(
    JSON.stringify(
      {
        generated_on: dateStamp,
        out_dir: outBase,
        counts: payload.counts,
        files,
      },
      null,
      2
    )
  );
}

buildPackage().catch((error) => {
  console.error(error);
  process.exit(1);
});
