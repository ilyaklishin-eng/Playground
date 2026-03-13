import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const DEFAULT_REPORT_PATH = path.join(ROOT, "reputation-case", "site", "seo-endpoint-check-report.json");
const DEFAULT_BASELINE_PATH = path.join(ROOT, "reputation-case", "site", "data", "bot-block-regression-baseline.json");
const DEFAULT_OUTPUT_PATH = path.join(ROOT, "reputation-case", "site", "bot-block-regression-report.json");

const parseArgs = (argv) => {
  const opts = {
    reportPath: DEFAULT_REPORT_PATH,
    baselinePath: DEFAULT_BASELINE_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    writeReport: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--report" && argv[i + 1]) {
      opts.reportPath = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === "--baseline" && argv[i + 1]) {
      opts.baselinePath = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === "--output" && argv[i + 1]) {
      opts.outputPath = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === "--no-output") {
      opts.writeReport = false;
    }
  }

  return opts;
};

const fail = async (message, details, opts) => {
  const payload = {
    status: "failed",
    message,
    details,
  };
  if (opts?.writeReport && opts?.outputPath) {
    await fs.mkdir(path.dirname(opts.outputPath), { recursive: true });
    await fs.writeFile(opts.outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  }
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
};

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
};

const normalizeStatuses = (entry) =>
  [...new Set((Array.isArray(entry?.statuses) ? entry.statuses : []).map((status) => Number(status)).filter(Boolean))].sort(
    (a, b) => a - b
  );

const buildKey = (entry) =>
  `${String(entry?.scheme || "https")}|${String(entry?.path || "")}|${String(entry?.user_agent || "")}|${normalizeStatuses(entry).join(",")}`;

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));

  let report;
  let baseline;
  try {
    [report, baseline] = await Promise.all([readJson(opts.reportPath), readJson(opts.baselinePath)]);
  } catch (error) {
    await fail(
      "Cannot read endpoint report or bot-block regression baseline.",
      {
        report_path: opts.reportPath,
        baseline_path: opts.baselinePath,
        error: String(error?.message || error),
      },
      opts
    );
    return;
  }

  const botBlocked = Array.isArray(report?.blocked_403_429?.bots?.entries)
    ? report.blocked_403_429.bots.entries
    : [];

  const baselineAllowed = new Set(
    (Array.isArray(baseline?.allowed) ? baseline.allowed : []).map((entry) =>
      `${String(entry?.scheme || "https")}|${String(entry?.path || "")}|${String(entry?.user_agent || "")}|${
        Array.isArray(entry?.statuses) ? entry.statuses.map(Number).sort((a, b) => a - b).join(",") : ""
      }`
    )
  );

  const unexpected = botBlocked.filter((entry) => !baselineAllowed.has(buildKey(entry)));
  const maxAllowed = Number(baseline?.max_total_403_429 ?? 0);
  const unexpectedCount = unexpected.length;
  const passed = unexpectedCount <= maxAllowed;

  const payload = {
    status: passed ? "passed" : "failed",
    generated_at: new Date().toISOString(),
    report_path: opts.reportPath,
    baseline_path: opts.baselinePath,
    totals: {
      bot_403_429: Number(report?.blocked_403_429?.bots?.total || 0),
      unexpected_403_429: unexpectedCount,
      max_allowed_403_429: maxAllowed,
    },
    by_user_agent: Array.isArray(report?.blocked_403_429?.bots?.by_user_agent) ? report.blocked_403_429.bots.by_user_agent : [],
    by_path: Array.isArray(report?.blocked_403_429?.bots?.by_path) ? report.blocked_403_429.bots.by_path : [],
    sample: unexpected.slice(0, 20),
  };

  if (opts.writeReport) {
    await fs.mkdir(path.dirname(opts.outputPath), { recursive: true });
    await fs.writeFile(opts.outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  }

  if (!passed) {
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(payload, null, 2));
};

main().catch(async (error) => {
  await fail("Bot 403/429 regression gate crashed.", { error: String(error?.message || error) }, parseArgs(process.argv.slice(2)));
});
