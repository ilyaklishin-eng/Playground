import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const SITE_DIR = path.join(ROOT, "reputation-case", "site");

const QA_REPORT_PATH = path.join(SITE_DIR, "qa-generated-assets-report.json");
const SEO_AUDIT_REPORT_PATH = path.join(SITE_DIR, "seo-audit-report.json");
const ENDPOINT_REPORT_PATH = path.join(SITE_DIR, "seo-endpoint-check-report.json");
const BOT_BLOCK_REPORT_PATH = path.join(SITE_DIR, "bot-block-regression-report.json");

const DEFAULT_MD_OUTPUT = path.join(SITE_DIR, "daily-monitor-report.md");
const DEFAULT_JSON_OUTPUT = path.join(SITE_DIR, "daily-monitor-report.json");

const parseArgs = (argv) => {
  const opts = {
    mdOut: DEFAULT_MD_OUTPUT,
    jsonOut: DEFAULT_JSON_OUTPUT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--md-out" && argv[i + 1]) {
      opts.mdOut = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === "--json-out" && argv[i + 1]) {
      opts.jsonOut = path.resolve(argv[i + 1]);
      i += 1;
    }
  }

  return opts;
};

const readJsonSafe = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const countArrayValues = (obj = {}) =>
  Object.values(obj || {}).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);

const fmt = (value, fallback = "n/a") => {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
};

const topEntries = (mapLike = new Map(), max = 8) =>
  [...mapLike.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max);

const buildEndpointSlices = (endpointReport) => {
  const failedChecks = Array.isArray(endpointReport?.checks)
    ? endpointReport.checks.filter((check) => !check?.ok)
    : [];

  const byUa = new Map();
  const byPath = new Map();
  for (const failure of failedChecks) {
    const ua = String(failure?.user_agent || "unknown");
    const pathName = String(failure?.path || "unknown");
    byUa.set(ua, (byUa.get(ua) || 0) + 1);
    byPath.set(pathName, (byPath.get(pathName) || 0) + 1);
  }

  const sample = failedChecks.slice(0, 20).map((failure) => ({
    path: failure.path,
    user_agent: failure.user_agent,
    final_status: failure.final_status,
    issues: Array.isArray(failure.issues) ? failure.issues : [],
    hops: Array.isArray(failure.hops) ? failure.hops : [],
  }));

  return {
    failedChecks,
    failuresByUa: topEntries(byUa, 10),
    failuresByPath: topEntries(byPath, 10),
    sample,
  };
};

const buildMarkdown = ({ qaReport, seoAuditReport, endpointReport, botBlockReport, slices, generatedAt }) => {
  const qaErrors = Number(qaReport?.totals?.errors || 0);
  const qaWarnings = Number(qaReport?.totals?.warnings || 0);
  const qaIndexable = qaReport?.totals?.indexable_items;

  const seoIssueCount = countArrayValues(seoAuditReport?.issues || {});
  const seoChecks = seoAuditReport?.checks || {};
  const failedSeoChecks = Object.entries(seoChecks)
    .filter(([, value]) => value === false)
    .map(([key]) => key);

  const endpointTotal = Number(endpointReport?.totals?.checks || 0);
  const endpointFailed = Number(endpointReport?.totals?.failed || 0);
  const endpointPassed = Number(endpointReport?.totals?.passed || 0);
  const bot403429 = Number(endpointReport?.totals?.bot_403_429 || 0);
  const botBlockStatus = botBlockReport ? (String(botBlockReport?.status || "") === "passed" ? "PASS" : "FAIL") : "MISSING REPORT";

  const lines = [];
  lines.push("# Daily Indexability and Bot-Access Report");
  lines.push("");
  lines.push(`Generated at: ${generatedAt}`);
  lines.push("");
  lines.push("## Status");
  lines.push(`- QA generated assets: ${qaReport ? (qaErrors === 0 ? "PASS" : "FAIL") : "MISSING REPORT"}`);
  lines.push(`- SEO audit: ${seoAuditReport ? (seoIssueCount === 0 ? "PASS" : "FAIL") : "MISSING REPORT"}`);
  lines.push(`- Endpoint bot-access check: ${endpointReport ? (endpointFailed === 0 ? "PASS" : "FAIL") : "MISSING REPORT"}`);
  lines.push(`- Bot 403/429 regression gate: ${botBlockStatus}`);
  lines.push("");
  lines.push("## Indexability Snapshot");
  lines.push(`- Indexable items: ${fmt(qaIndexable)}`);
  lines.push(`- QA errors: ${fmt(qaErrors)}`);
  lines.push(`- QA warnings: ${fmt(qaWarnings)}`);
  lines.push(`- SEO audit issue entries: ${fmt(seoIssueCount)}`);
  lines.push(`- Canonical mismatches: ${fmt((seoAuditReport?.issues?.canonical_mismatched || []).length, "0")}`);
  lines.push(`- Hreflang issues: ${fmt((seoAuditReport?.issues?.hreflang_issues || []).length, "0")}`);
  lines.push(
    `- Sitemap language scope issues: ${fmt((seoAuditReport?.issues?.sitemap_language_scope_issues || []).length, "0")}`
  );
  lines.push(`- Draft leakage findings: ${fmt((qaReport?.issues || []).filter((x) => /draft/i.test(String(x.code || ""))).length, "0")}`);
  lines.push("");
  lines.push("## Bot-Access Snapshot");
  lines.push(`- Total endpoint checks: ${fmt(endpointTotal)}`);
  lines.push(`- Passed: ${fmt(endpointPassed)}`);
  lines.push(`- Failed: ${fmt(endpointFailed)}`);
  lines.push(`- Bot 403/429 hits: ${fmt(bot403429)}`);
  lines.push("");
  lines.push("### Bot 403/429 regression");
  if (!botBlockReport) {
    lines.push("- report missing");
  } else {
    lines.push(`- Status: ${fmt(botBlockReport.status)}`);
    lines.push(`- Unexpected 403/429 hits: ${fmt(botBlockReport?.totals?.unexpected_403_429, "0")}`);
    lines.push(`- Max allowed: ${fmt(botBlockReport?.totals?.max_allowed_403_429, "0")}`);
  }
  lines.push("");
  lines.push("### Failed checks by user-agent");
  if (slices.failuresByUa.length === 0) {
    lines.push("- none");
  } else {
    for (const [ua, count] of slices.failuresByUa) {
      lines.push(`- ${ua}: ${count}`);
    }
  }
  lines.push("");
  lines.push("### Failed checks by path");
  if (slices.failuresByPath.length === 0) {
    lines.push("- none");
  } else {
    for (const [pathName, count] of slices.failuresByPath) {
      lines.push(`- ${pathName}: ${count}`);
    }
  }
  lines.push("");

  if (failedSeoChecks.length > 0) {
    lines.push("## Failed SEO Checks");
    for (const check of failedSeoChecks) lines.push(`- ${check}`);
    lines.push("");
  }

  if (slices.sample.length > 0) {
    lines.push("## Endpoint Failure Sample");
    for (const failure of slices.sample.slice(0, 12)) {
      const issue = (failure.issues || [])[0] || "unknown";
      lines.push(`- ${failure.path} | ${failure.user_agent} | ${failure.final_status} | ${issue}`);
    }
    lines.push("");
  }

  if (Array.isArray(botBlockReport?.sample) && botBlockReport.sample.length > 0) {
    lines.push("## Bot 403/429 Sample");
    for (const failure of botBlockReport.sample.slice(0, 12)) {
      lines.push(
        `- ${failure.path} | ${failure.user_agent} | ${Array.isArray(failure.statuses) ? failure.statuses.join(",") : "n/a"}`
      );
    }
    lines.push("");
  }

  lines.push("## Source Reports");
  lines.push(`- ${path.relative(ROOT, QA_REPORT_PATH)}`);
  lines.push(`- ${path.relative(ROOT, SEO_AUDIT_REPORT_PATH)}`);
  lines.push(`- ${path.relative(ROOT, ENDPOINT_REPORT_PATH)}`);
  lines.push(`- ${path.relative(ROOT, BOT_BLOCK_REPORT_PATH)}`);
  lines.push("");

  return lines.join("\n");
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));

  const [qaReport, seoAuditReport, endpointReport, botBlockReport] = await Promise.all([
    readJsonSafe(QA_REPORT_PATH),
    readJsonSafe(SEO_AUDIT_REPORT_PATH),
    readJsonSafe(ENDPOINT_REPORT_PATH),
    readJsonSafe(BOT_BLOCK_REPORT_PATH),
  ]);

  const generatedAt = new Date().toISOString();
  const slices = buildEndpointSlices(endpointReport);

  const summary = {
    generated_at: generatedAt,
    status: {
      qa_report_present: !!qaReport,
      seo_audit_report_present: !!seoAuditReport,
      endpoint_report_present: !!endpointReport,
      qa_errors: Number(qaReport?.totals?.errors || 0),
      qa_warnings: Number(qaReport?.totals?.warnings || 0),
      seo_issue_entries: countArrayValues(seoAuditReport?.issues || {}),
      endpoint_failed: Number(endpointReport?.totals?.failed || 0),
      endpoint_total: Number(endpointReport?.totals?.checks || 0),
      bot_403_429: Number(endpointReport?.totals?.bot_403_429 || 0),
      bot_block_regression_status: botBlockReport?.status || "missing",
    },
    endpoint_failures: {
      by_user_agent: slices.failuresByUa.map(([user_agent, count]) => ({ user_agent, count })),
      by_path: slices.failuresByPath.map(([pathName, count]) => ({ path: pathName, count })),
      sample: slices.sample,
    },
    bot_403_429_regression: botBlockReport || null,
  };

  const markdown = buildMarkdown({ qaReport, seoAuditReport, endpointReport, botBlockReport, slices, generatedAt });

  await fs.mkdir(path.dirname(opts.mdOut), { recursive: true });
  await fs.mkdir(path.dirname(opts.jsonOut), { recursive: true });
  await fs.writeFile(opts.mdOut, `${markdown}\n`, "utf8");
  await fs.writeFile(opts.jsonOut, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(`Daily monitor report written:\n- ${opts.mdOut}\n- ${opts.jsonOut}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
