import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const siteDir = path.resolve(process.cwd(), "reputation-case", "site");
const digestsPath = path.join(siteDir, "data", "digests.json");
const interviewsModulePath = path.join(siteDir, "data", "interviews-data.js");
const defaultOutputPath = path.join(siteDir, "data", "source-url-health.json");
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_CONCURRENCY = 8;
const execFileAsync = promisify(execFile);
const USER_AGENT =
  "Mozilla/5.0 (compatible; KlishinSourceAudit/1.0; +https://www.klishin.work/)";
const BROKEN_STATUS_CODES = new Set([404, 410, 451]);
const BASE_URL = "https://www.klishin.work/";

const parseArgs = (argv = []) => {
  const options = {
    output: defaultOutputPath,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    concurrency: DEFAULT_CONCURRENCY,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--output" && argv[index + 1]) {
      options.output = path.resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--timeout" && argv[index + 1]) {
      options.timeoutMs = Math.max(1000, Number.parseInt(argv[index + 1], 10) || DEFAULT_TIMEOUT_MS);
      index += 1;
      continue;
    }
    if (token === "--concurrency" && argv[index + 1]) {
      options.concurrency = Math.max(1, Number.parseInt(argv[index + 1], 10) || DEFAULT_CONCURRENCY);
      index += 1;
      continue;
    }
  }

  return options;
};

const normalizeSourceUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  try {
    return new URL(raw, BASE_URL).toString();
  } catch {
    return raw;
  }
};

const normalizeStatus = (value = "") => String(value || "").trim().toLowerCase();
const isPublishedStatus = (value = "") => normalizeStatus(value) === "ready";

const readDigests = async () => {
  const raw = await fs.readFile(digestsPath, "utf8");
  const payload = JSON.parse(raw);
  return Array.isArray(payload?.items) ? payload.items : [];
};

const readInterviews = async () => {
  const moduleUrl = pathToFileURL(interviewsModulePath).href;
  const payload = await import(moduleUrl);
  if (Array.isArray(payload?.default)) return payload.default;
  if (Array.isArray(payload?.interviews)) return payload.interviews;
  return [];
};

const buildReferenceMap = async () => {
  const refsByUrl = new Map();

  const addRef = (rawUrl, ref) => {
    const url = normalizeSourceUrl(rawUrl);
    if (!url) return;
    if (!refsByUrl.has(url)) refsByUrl.set(url, []);
    refsByUrl.get(url).push(ref);
  };

  const digests = await readDigests();
  for (const item of digests) {
    if (!isPublishedStatus(item?.status)) continue;
    addRef(item?.url, {
      kind: "digest",
      id: String(item?.id || ""),
      title: String(item?.title || ""),
      source: String(item?.source || ""),
    });
  }

  const interviews = await readInterviews();
  for (const item of interviews) {
    addRef(item?.url, {
      kind: "interview",
      section: String(item?.section || ""),
      title: String(item?.title || ""),
      date: String(item?.date || ""),
    });
  }

  return refsByUrl;
};

const classifyStatus = (status) => {
  if (typeof status !== "number" || Number.isNaN(status) || status <= 0) return "inconclusive";
  if (status >= 200 && status < 400) return "healthy";
  if (BROKEN_STATUS_CODES.has(status)) return "broken";
  return "inconclusive";
};

const requestUrl = async (url, method, timeoutMs) => {
  const headers = {
    "user-agent": USER_AGENT,
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "cache-control": "no-cache",
  };
  if (method === "GET") headers.range = "bytes=0-1023";

  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    try {
      await response.body?.cancel();
    } catch {}
    return {
      ok: true,
      url,
      checked_via: method,
      status_code: response.status,
      final_url: response.url || url,
      classification: classifyStatus(response.status),
    };
  } catch (error) {
    return {
      ok: false,
      url,
      checked_via: method,
      status_code: 0,
      final_url: url,
      classification: "inconclusive",
      error: String(error?.message || error || "Unknown fetch error"),
    };
  }
};

const requestUrlViaCurl = async (url, timeoutMs) => {
  try {
    const timeoutSeconds = Math.max(2, Math.ceil(timeoutMs / 1000));
    const { stdout } = await execFileAsync("curl", [
      "-sSIL",
      "-A",
      USER_AGENT,
      "-H",
      "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "--max-time",
      String(timeoutSeconds),
      "-o",
      "/dev/null",
      "-D",
      "-",
      "-w",
      "\nCURL_EFFECTIVE_URL:%{url_effective}\n",
      url,
    ]);

    const output = String(stdout || "");
    const statusMatches = [...output.matchAll(/^HTTP\/[0-9.]+\s+(\d{3})/gim)];
    const effectiveUrlMatch = output.match(/CURL_EFFECTIVE_URL:(.+)$/m);
    const statusCode = statusMatches.length
      ? Number.parseInt(statusMatches.at(-1)?.[1] || "0", 10)
      : 0;

    return {
      ok: statusCode > 0,
      url,
      checked_via: "CURL",
      status_code: statusCode,
      final_url: effectiveUrlMatch?.[1]?.trim() || url,
      classification: classifyStatus(statusCode),
    };
  } catch (error) {
    return {
      ok: false,
      url,
      checked_via: "CURL",
      status_code: 0,
      final_url: url,
      classification: "inconclusive",
      error: String(error?.message || error || "Unknown curl error"),
    };
  }
};

const needsGetFallback = (result) => {
  if (!result?.ok) return true;
  return result.status_code >= 400;
};

const checkUrl = async (url, timeoutMs) => {
  const head = await requestUrl(url, "HEAD", timeoutMs);
  if (!needsGetFallback(head)) return head;

  const get = await requestUrl(url, "GET", timeoutMs);
  if (get.classification === "broken" || head.classification === "broken") {
    const curl = await requestUrlViaCurl(url, timeoutMs);
    if (curl.classification === "healthy" || curl.classification === "broken") return curl;
  }
  if (get.classification === "healthy" || get.classification === "broken") return get;
  if (head.classification === "broken") return head;
  if (head.ok && head.status_code > 0 && !get.ok) return head;
  return get;
};

const mapWithConcurrency = async (items, limit, mapper) => {
  const results = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, () => worker());
  await Promise.all(workers);
  return results;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const refsByUrl = await buildReferenceMap();
  const urls = [...refsByUrl.keys()];

  if (urls.length === 0) {
    throw new Error("No source URLs found to audit.");
  }

  const checked = await mapWithConcurrency(urls, options.concurrency, (url) =>
    checkUrl(url, options.timeoutMs)
  );

  const results = checked.map((result) => ({
    ...result,
    refs: refsByUrl.get(result.url) || [],
  }));

  const healthy = results.filter((item) => item.classification === "healthy");
  const broken = results.filter((item) => item.classification === "broken");
  const inconclusive = results.filter((item) => item.classification === "inconclusive");

  if (healthy.length + broken.length === 0) {
    throw new Error("Source URL audit produced no deterministic results; all checks were inconclusive.");
  }

  const brokenUrls = broken.map((item) => item.url);
  const brokenDigestIds = [...new Set(
    broken.flatMap((item) =>
      (item.refs || [])
        .filter((ref) => ref.kind === "digest" && ref.id)
        .map((ref) => String(ref.id))
    )
  )].sort((a, b) => a.localeCompare(b));
  const brokenInterviewUrls = [...new Set(
    broken.flatMap((item) =>
      (item.refs || [])
        .filter((ref) => ref.kind === "interview")
        .map(() => item.url)
    )
  )].sort((a, b) => a.localeCompare(b));

  const report = {
    generated_at: new Date().toISOString(),
    policy: {
      timeout_ms: options.timeoutMs,
      concurrency: options.concurrency,
      broken_status_codes: [...BROKEN_STATUS_CODES].sort((a, b) => a - b),
      note: "Only definite terminal responses are treated as broken. 403/429/5xx remain inconclusive.",
    },
    totals: {
      checked_urls: results.length,
      healthy_urls: healthy.length,
      broken_urls: broken.length,
      inconclusive_urls: inconclusive.length,
    },
    broken_urls: brokenUrls,
    broken_digest_ids: brokenDigestIds,
    broken_interview_urls: brokenInterviewUrls,
    results,
  };

  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(
    `Source URL audit: checked=${results.length} healthy=${healthy.length} broken=${broken.length} inconclusive=${inconclusive.length}`
  );
  console.log(`Report: ${options.output}`);
  if (broken.length > 0) {
    for (const item of broken.slice(0, 10)) {
      console.log(`BROKEN ${item.status_code} ${item.url}`);
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
