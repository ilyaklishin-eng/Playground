import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const REPORT_PATH = path.join(ROOT, "reputation-case", "site", "seo-endpoint-check-report.json");

const DEFAULT_DOMAIN = "https://www.klishin.work";
const IMPORTANT_PATHS = [
  "/",
  "/fr/",
  "/de/",
  "/es/",
  "/bio/",
  "/bio/fr/",
  "/bio/de/",
  "/bio/es/",
  "/cases/",
  "/cases/fr/",
  "/cases/de/",
  "/cases/es/",
  "/contact/",
  "/selected/",
  "/search/",
  "/insights/",
];

const normalizePolicy = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "deny" || normalized === "disallow" || normalized === "off") return "deny";
  if (normalized === "custom" || normalized === "paths") return "custom";
  return "allow";
};

const GPTBOT_POLICY = normalizePolicy(process.env.GPTBOT_POLICY || "allow");

const USER_AGENTS_BASE = [
  {
    id: "browser",
    value: "Mozilla/5.0 (compatible; klishin-work-monitor/1.0; +https://www.klishin.work/)",
  },
  {
    id: "chatgpt_user",
    value: "ChatGPT-User/1.0 (+https://openai.com/bot)",
  },
  {
    id: "oai_searchbot",
    value: "OAI-SearchBot/1.0; +https://openai.com/searchbot",
  },
  {
    id: "perplexity_bot",
    value: "PerplexityBot/1.0 (+https://www.perplexity.com/perplexitybot)",
  },
  {
    id: "perplexity_user",
    value: "Perplexity-User/1.0 (+https://www.perplexity.com/perplexity-user)",
  },
];
const USER_AGENTS = GPTBOT_POLICY === "deny"
  ? USER_AGENTS_BASE
  : [
      ...USER_AGENTS_BASE,
      {
        id: "gptbot",
        value: "GPTBot/1.0 (+https://openai.com/gptbot)",
      },
    ];

const ALLOWED_STATUS = new Set([200, 301, 302, 303, 307, 308]);
const BLOCKED_STATUS = new Set([401, 403, 406, 409, 410, 423, 429, 451, 500, 502, 503, 504, 520, 521, 522, 523, 524]);
const CHALLENGE_PATTERNS = [/cf-chl/i, /challenge-platform/i, /just a moment/i, /captcha/i, /attention required/i];

const parseArgs = (argv) => {
  const opts = {
    domain: DEFAULT_DOMAIN,
    writeReport: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--domain" && argv[i + 1]) {
      opts.domain = argv[i + 1];
      i += 1;
    } else if (arg === "--no-report") {
      opts.writeReport = false;
    } else if (arg === "--report") {
      opts.writeReport = true;
    }
  }

  return opts;
};

const normalizeDomain = (input) => {
  const raw = String(input || "").trim() || DEFAULT_DOMAIN;
  const parsed = new URL(raw);
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
};

const shortBody = async (response) => {
  try {
    const text = await response.text();
    return String(text || "").slice(0, 3000);
  } catch {
    return "";
  }
};

const requestWithRedirects = async (url, ua, maxHops = 5) => {
  const hops = [];
  let current = url;

  for (let i = 0; i <= maxHops; i += 1) {
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": ua,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const status = response.status;
    const location = response.headers.get("location");
    const record = { url: current, status, location: location || null };
    hops.push(record);

    const isRedirect = status >= 300 && status < 400;
    if (!isRedirect) {
      const bodySample = await shortBody(response);
      return { hops, final: record, bodySample };
    }

    if (!location || i === maxHops) {
      const bodySample = await shortBody(response);
      return { hops, final: record, bodySample };
    }

    current = new URL(location, current).toString();
  }

  return { hops, final: hops[hops.length - 1], bodySample: "" };
};

const validateResult = ({ scheme, pathName, uaId, result }) => {
  const issues = [];
  const finalStatus = Number(result?.final?.status || 0);
  const sample = String(result?.bodySample || "");
  const allStatuses = result.hops.map((x) => Number(x.status));

  for (const status of allStatuses) {
    if (BLOCKED_STATUS.has(status)) {
      issues.push(`blocked status ${status}`);
    }
    if (!ALLOWED_STATUS.has(status)) {
      issues.push(`unexpected status ${status}`);
    }
  }

  if (scheme === "https" && finalStatus !== 200) {
    issues.push(`https final status should be 200, got ${finalStatus}`);
  }

  for (const pattern of CHALLENGE_PATTERNS) {
    if (pattern.test(sample)) {
      issues.push(`challenge marker detected (${pattern.source})`);
      break;
    }
  }

  return {
    key: `${scheme}:${pathName}:${uaId}`,
    scheme,
    path: pathName,
    user_agent: uaId,
    hops: result.hops,
    final_status: finalStatus,
    ok: issues.length === 0,
    issues,
  };
};

const runChecks = async (domain) => {
  const checks = [];
  const bases = [
    { scheme: "https", base: domain.replace(/^http:\/\//i, "https://") },
    { scheme: "http", base: domain.replace(/^https:\/\//i, "http://") },
  ];

  for (const { scheme, base } of bases) {
    for (const p of IMPORTANT_PATHS) {
      for (const ua of USER_AGENTS) {
        const url = `${base}${p}`;
        const result = await requestWithRedirects(url, ua.value);
        checks.push(validateResult({ scheme, pathName: p, uaId: ua.id, result }));
      }
    }
  }

  return checks;
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  const domain = normalizeDomain(opts.domain);
  const checks = await runChecks(domain);

  const failed = checks.filter((x) => !x.ok);
  const report = {
    generated_at: new Date().toISOString(),
    domain,
    paths: IMPORTANT_PATHS,
    user_agents: USER_AGENTS.map((x) => x.id),
    totals: {
      checks: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
    },
    checks,
  };

  if (opts.writeReport) {
    await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
  }

  if (failed.length > 0) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log(
    `Endpoint access check passed (${domain}): ${checks.length} checks across ${IMPORTANT_PATHS.length} paths and ${USER_AGENTS.length} user-agents.`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
