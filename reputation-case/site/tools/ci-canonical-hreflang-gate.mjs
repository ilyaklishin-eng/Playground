import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const REPORT_PATH = path.join(ROOT, "reputation-case", "site", "seo-audit-report.json");

const parseArgs = (argv) => {
  const opts = {
    reportPath: REPORT_PATH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--report" && argv[i + 1]) {
      opts.reportPath = path.resolve(argv[i + 1]);
      i += 1;
    }
  }

  return opts;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const fail = (message, details = {}) => {
  const payload = {
    status: "failed",
    message,
    details,
  };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));

  let report;
  try {
    const raw = await fs.readFile(opts.reportPath, "utf8");
    report = JSON.parse(raw);
  } catch (error) {
    fail("Cannot read seo-audit report. Run seo-audit before this gate.", {
      report_path: opts.reportPath,
      error: String(error?.message || error),
    });
    return;
  }

  const issues = report?.issues || {};
  const checks = report?.checks || {};

  const counters = {
    canonical_missing: asArray(issues.canonical_missing).length,
    canonical_mismatched: asArray(issues.canonical_mismatched).length,
    canonical_normalization_issues: asArray(issues.canonical_normalization_issues).length,
    duplicate_canonical_groups: asArray(issues.duplicate_canonical_groups).length,
    hreflang_issues: asArray(issues.hreflang_issues).length,
    key_route_hreflang_issues: asArray(issues.key_route_hreflang_issues).length,
  };

  const failedFlags = {
    key_routes_hreflang_consistent: checks.key_routes_hreflang_consistent === false,
  };

  const hasCountFailures = Object.values(counters).some((value) => value > 0);
  const hasFlagFailures = Object.values(failedFlags).some(Boolean);

  if (hasCountFailures || hasFlagFailures) {
    fail("Canonical/hreflang gate failed.", {
      counters,
      failed_flags: failedFlags,
      report_path: opts.reportPath,
    });
    return;
  }

  console.log(
    JSON.stringify(
      {
        status: "passed",
        gate: "canonical-hreflang",
        counters,
        failed_flags: failedFlags,
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  fail("Canonical/hreflang gate crashed.", { error: String(error?.message || error) });
});

