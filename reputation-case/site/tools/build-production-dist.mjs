import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const DEFAULT_SITE_DIR = path.join(ROOT, "reputation-case", "site");
const DEFAULT_OUT_DIR = path.join(ROOT, "reputation-case", "dist");
const CANONICAL_ORIGIN = "https://www.klishin.work";

const STATIC_EXT_RE = /\.(?:css|js|json|jpg|jpeg|png|svg|webp|avif|ico|xml|txt|woff2?|ttf|otf)$/i;
const HTML_RE = /\.html$/i;
const PUBLIC_REFERENCE_RE = /\.(?:html|js)$/i;

const PUBLIC_DATA_FILES = [
  "data/public-digests.json",
  "data/public-interviews.json",
  "data/search-index.json",
  "data/search-index-en.json",
  "data/search-index-fr.json",
  "data/search-index-de.json",
  "data/search-index-es.json",
];

const ROOT_PUBLIC_FILES = [
  "robots.txt",
  "rss.xml",
  "sitemap.xml",
  "sitemap-core.xml",
  "sitemap-en.xml",
  "sitemap-fr.xml",
  "sitemap-de.xml",
  "sitemap-es.xml",
  "llms.txt",
];

const BLOCKED_OUTPUT_PATTERNS = [
  /^tools\//,
  /^data\/digests\.json$/,
  /^data\/interviews-data\.js$/,
  /^data\/source-url-health\.json$/,
  /^data\/(?:.*allowlist.*|.*cidrs.*|cloudflare-bypass-rules\.(?:json|md)|bot-block-regression-baseline\.json)$/i,
  /(?:^|\/)(?:qa-|seo-|bot-block-|daily-monitor).*report\.(?:json|md)$/i,
  /^source-registry-v1\.tsv$/,
  /^digest-multilingual-notes-v1\.md$/,
  /^app\.js$/,
  /^styles\.css$/,
  /^home\/home\.css$/,
  /^search\/search\.js$/,
  /^interviews\/interviews\.js$/,
  /^interviews\/interviews-preview\.js$/,
  /^selected\/selected-all-materials\.js$/,
  /^contact\/contact\.js$/,
  /^contact\/contact\.css$/,
  /^cases\/cases\.css$/,
  /^bio\/bio\.css$/,
  /^og\//,
];
const BLOCKED_PUBLIC_REFERENCE_RE =
  /\/(?:tools\/|data\/source-url-health\.json|source-registry-v1\.tsv|digest-multilingual-notes-v1\.md)/i;

const parseArgs = (argv = []) => {
  const opts = {
    siteDir: DEFAULT_SITE_DIR,
    outDir: DEFAULT_OUT_DIR,
    domain: "",
    manifest: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--site-dir" && argv[index + 1]) {
      opts.siteDir = path.resolve(process.cwd(), argv[++index]);
    } else if (arg === "--out-dir" && argv[index + 1]) {
      opts.outDir = path.resolve(process.cwd(), argv[++index]);
    } else if (arg === "--domain" && argv[index + 1]) {
      opts.domain = String(argv[++index] || "").trim();
    } else if (arg === "--manifest" && argv[index + 1]) {
      opts.manifest = path.resolve(process.cwd(), argv[++index]);
    }
  }

  return opts;
};

const toPosix = (value = "") => String(value).split(path.sep).join("/");

const isInside = (base, target) => {
  const rel = path.relative(base, target);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
};

const isBlockedOutput = (relPath = "") => {
  const normalized = toPosix(relPath).replace(/^\/+/, "");
  return BLOCKED_OUTPUT_PATTERNS.some((pattern) => pattern.test(normalized));
};

const walkFiles = async (dir, out = []) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(abs, out);
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
  return out;
};

const ensureFile = async (absPath) => {
  const stat = await fs.stat(absPath).catch(() => null);
  if (!stat?.isFile()) {
    throw new Error(`Required publish file is missing: ${absPath}`);
  }
};

const copyRelativeFile = async (siteDir, outDir, relPath, copied) => {
  const rel = toPosix(relPath).replace(/^\/+/, "");
  if (!rel || isBlockedOutput(rel)) return false;

  const source = path.resolve(siteDir, rel);
  if (!isInside(siteDir, source) && source !== siteDir) {
    throw new Error(`Refusing to copy path outside site dir: ${rel}`);
  }

  await ensureFile(source);
  const target = path.resolve(outDir, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
  copied.add(rel);
  return true;
};

const localSitePath = (rawValue = "") => {
  const raw = String(rawValue || "").trim();
  if (!raw) return "";

  if (raw.startsWith("data:") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("#")) {
    return "";
  }

  let pathname = "";
  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      if (url.origin !== CANONICAL_ORIGIN) return "";
      pathname = url.pathname;
    } else if (raw.startsWith("/")) {
      const url = new URL(raw, CANONICAL_ORIGIN);
      pathname = url.pathname;
    } else {
      return "";
    }
  } catch {
    return "";
  }

  const rel = decodeURIComponent(pathname.replace(/^\/+/, ""));
  return rel;
};

const localPublicPath = (rawValue = "") => {
  const rel = localSitePath(rawValue);
  if (!rel || !STATIC_EXT_RE.test(rel)) return "";
  return rel;
};

const collectLocalStaticRefs = (html = "") => {
  const refs = new Set();
  const attrRe = /\b(?:href|src|content)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(attrRe)) {
    const rel = localPublicPath(match[1]);
    if (rel) refs.add(rel);
  }
  return refs;
};

const collectLocalRefs = (html = "") => {
  const refs = new Set();
  const attrRe = /\b(?:href|src|content)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(attrRe)) {
    const rel = localSitePath(match[1]);
    if (rel) refs.add(rel);
  }
  return refs;
};

const validateDist = async (outDir) => {
  const files = await walkFiles(outDir);
  const rels = files.map((file) => toPosix(path.relative(outDir, file))).sort();
  const blocked = rels.filter((rel) => isBlockedOutput(rel));
  if (blocked.length) {
    throw new Error(`Production dist contains blocked files:\n${blocked.join("\n")}`);
  }

  const relSet = new Set(rels);
  const missingRefs = [];
  const blockedRefs = [];
  const blockedTextRefs = [];
  for (const file of files.filter((candidate) => HTML_RE.test(candidate))) {
    const html = await fs.readFile(file, "utf8");
    for (const ref of collectLocalRefs(html)) {
      if (isBlockedOutput(ref)) {
        blockedRefs.push(`${toPosix(path.relative(outDir, file))} -> ${ref}`);
      }
    }
    for (const ref of collectLocalStaticRefs(html)) {
      if (!relSet.has(ref)) {
        missingRefs.push(`${toPosix(path.relative(outDir, file))} -> ${ref}`);
      }
    }
  }
  for (const file of files.filter((candidate) => PUBLIC_REFERENCE_RE.test(candidate))) {
    const text = await fs.readFile(file, "utf8");
    if (BLOCKED_PUBLIC_REFERENCE_RE.test(text)) {
      blockedTextRefs.push(toPosix(path.relative(outDir, file)));
    }
  }

  if (missingRefs.length) {
    throw new Error(`Production dist has missing static references:\n${missingRefs.join("\n")}`);
  }
  if (blockedRefs.length) {
    throw new Error(`Production dist contains public links to blocked files:\n${blockedRefs.join("\n")}`);
  }
  if (blockedTextRefs.length) {
    throw new Error(`Production dist contains references to blocked public paths:\n${blockedTextRefs.join("\n")}`);
  }

  return rels;
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  const siteDir = opts.siteDir;
  const outDir = opts.outDir;
  const copied = new Set();

  if (path.resolve(siteDir) === path.resolve(outDir)) {
    throw new Error("Output directory must be separate from the source site directory.");
  }

  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  const siteFiles = await walkFiles(siteDir);
  const htmlFiles = siteFiles.filter((file) => HTML_RE.test(file) && !toPosix(path.relative(siteDir, file)).startsWith("tools/"));

  for (const file of htmlFiles) {
    const rel = toPosix(path.relative(siteDir, file));
    await copyRelativeFile(siteDir, outDir, rel, copied);

    const html = await fs.readFile(file, "utf8");
    for (const ref of collectLocalStaticRefs(html)) {
      await copyRelativeFile(siteDir, outDir, ref, copied);
    }
  }

  for (const rel of ROOT_PUBLIC_FILES) {
    await copyRelativeFile(siteDir, outDir, rel, copied);
  }

  for (const rel of PUBLIC_DATA_FILES) {
    await copyRelativeFile(siteDir, outDir, rel, copied);
  }

  if (opts.domain) {
    await fs.writeFile(path.join(outDir, "CNAME"), `${opts.domain}\n`, "utf8");
    copied.add("CNAME");
  } else {
    await copyRelativeFile(siteDir, outDir, "CNAME", copied).catch(() => false);
  }

  const rels = await validateDist(outDir);
  const manifest = {
    generated_at: new Date().toISOString(),
    site_dir: siteDir,
    out_dir: outDir,
    copied_files: rels.length,
    html_files: rels.filter((rel) => rel.endsWith(".html")).length,
    public_data_files: PUBLIC_DATA_FILES.filter((rel) => rels.includes(rel)),
    blocked_patterns_enforced: BLOCKED_OUTPUT_PATTERNS.map((pattern) => String(pattern)),
    files: rels,
  };

  if (opts.manifest) {
    await fs.mkdir(path.dirname(opts.manifest), { recursive: true });
    await fs.writeFile(opts.manifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(
    `Production dist ready: files=${manifest.copied_files} html=${manifest.html_files} out=${path.relative(ROOT, outDir) || outDir}`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
