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
  "/interviews/",
  "/interviews/fr/",
  "/interviews/de/",
  "/interviews/es/",
  "/selected/",
  "/search/",
  "/insights/",
  "/posts/",
  "/posts/index.html",
  "/posts/all.html",
  "/robots.txt",
  "/rss.xml",
  "/sitemap.xml",
  "/sitemap-core.xml",
  "/sitemap-en.xml",
  "/sitemap-fr.xml",
  "/sitemap-de.xml",
  "/sitemap-es.xml",
];

const USER_AGENTS_BASE = [
  {
    id: "browser",
    value: "Mozilla/5.0 (compatible; klishin-work-monitor/1.0; +https://www.klishin.work/)",
  },
  {
    id: "googlebot",
    value: "Googlebot/2.1 (+http://www.google.com/bot.html)",
  },
  {
    id: "bingbot",
    value: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  },
  {
    id: "yandexbot",
    value: "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
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
  {
    id: "gptbot",
    value: "GPTBot/1.0 (+https://openai.com/gptbot)",
  },
  {
    id: "claude_bot",
    value: "ClaudeBot/1.0 (+https://www.anthropic.com/)",
  },
  {
    id: "anthropic_ai",
    value: "anthropic-ai/1.0 (+https://www.anthropic.com/)",
  },
];
const USER_AGENTS = USER_AGENTS_BASE;
const BOT_USER_AGENT_IDS = USER_AGENTS.filter((ua) => ua.id !== "browser").map((ua) => ua.id);

const ALLOWED_STATUS = new Set([200, 301, 302, 303, 307, 308]);
const BLOCKED_STATUS = new Set([401, 403, 406, 409, 410, 423, 429, 451, 500, 502, 503, 504, 520, 521, 522, 523, 524]);
const BLOCKED_ALERT_STATUS = new Set([403, 429]);
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

const buildBlockedSummary = (checks) => {
  const blockedChecks = [];
  const byUa = new Map();
  const byPath = new Map();
  const byStatus = new Map();

  for (const check of checks) {
    const statuses = Array.isArray(check?.hops) ? check.hops.map((hop) => Number(hop?.status || 0)) : [];
    const matchedStatuses = [...new Set(statuses.filter((status) => BLOCKED_ALERT_STATUS.has(status)))];
    if (matchedStatuses.length === 0) continue;

    const userAgent = String(check?.user_agent || "");
    const pathName = String(check?.path || "");
    const isBot = BOT_USER_AGENT_IDS.includes(userAgent);
    const entry = {
      path: pathName,
      scheme: check?.scheme || "unknown",
      user_agent: userAgent,
      final_status: Number(check?.final_status || 0),
      statuses: matchedStatuses,
      hops: Array.isArray(check?.hops) ? check.hops : [],
      ok: Boolean(check?.ok),
      bot: isBot,
    };
    blockedChecks.push(entry);

    if (isBot) {
      byUa.set(userAgent, (byUa.get(userAgent) || 0) + 1);
      byPath.set(pathName, (byPath.get(pathName) || 0) + 1);
      for (const status of matchedStatuses) {
        byStatus.set(String(status), (byStatus.get(String(status)) || 0) + 1);
      }
    }
  }

  const toSortedEntries = (map) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count }));

  const botBlockedChecks = blockedChecks.filter((entry) => entry.bot);

  return {
    all: {
      total: blockedChecks.length,
      entries: blockedChecks,
      sample: blockedChecks.slice(0, 50),
    },
    bots: {
      total: botBlockedChecks.length,
      by_user_agent: toSortedEntries(byUa),
      by_path: toSortedEntries(byPath),
      by_status: toSortedEntries(byStatus),
      entries: botBlockedChecks,
      sample: botBlockedChecks.slice(0, 50),
    },
  };
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  const domain = normalizeDomain(opts.domain);
  const checks = await runChecks(domain);

  const failed = checks.filter((x) => !x.ok);
  const blockedSummary = buildBlockedSummary(checks);
  const report = {
    generated_at: new Date().toISOString(),
    domain,
    paths: IMPORTANT_PATHS,
    user_agents: USER_AGENTS.map((x) => x.id),
    totals: {
      checks: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      bot_403_429: blockedSummary.bots.total,
      any_403_429: blockedSummary.all.total,
    },
    blocked_403_429: blockedSummary,
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
