import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const SITE_DIR = path.join(ROOT, "reputation-case", "site");
const DATA_DIR = path.join(SITE_DIR, "data");

const OUTPUT_JSON = path.join(DATA_DIR, "cloudflare-bypass-rules.json");
const OUTPUT_MD = path.join(DATA_DIR, "cloudflare-bypass-rules.md");

const LIST_NAMES = {
  openaiSearchbot: process.env.CF_OPENAI_SEARCHBOT_LIST_NAME || "openai_searchbot_ips",
  openaiGptbot: process.env.CF_OPENAI_GPTBOT_LIST_NAME || "openai_gptbot_ips",
  openaiChatgptUser: process.env.CF_OPENAI_CHATGPT_USER_LIST_NAME || "openai_chatgpt_user_ips",
  perplexityBot: process.env.CF_PERPLEXITYBOT_LIST_NAME || "perplexitybot_ips",
  perplexityUser: process.env.CF_PERPLEXITYUSER_LIST_NAME || "perplexity_user_ips",
  anthropic: process.env.CF_ANTHROPIC_LIST_NAME || "anthropic_ai_ips",
};

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, "utf8"));

const listExpression = (ua, listName) => `(http.user_agent contains "${ua}" and ip.src in $${listName})`;

const main = async () => {
  const [openaiSearchbot, openaiGptbot, openaiChatgptUser, perplexity, anthropic] = await Promise.all([
    readJson(path.join(DATA_DIR, "openai-searchbot-ip-allowlist.json")),
    readJson(path.join(DATA_DIR, "openai-gptbot-ip-allowlist.json")),
    readJson(path.join(DATA_DIR, "openai-chatgpt-user-ip-allowlist.json")),
    readJson(path.join(DATA_DIR, "perplexity-ip-allowlist.json")),
    readJson(path.join(DATA_DIR, "anthropic-ip-allowlist.json")),
  ]);

  const aiBypassExpression = [
    listExpression("OAI-SearchBot", LIST_NAMES.openaiSearchbot),
    listExpression("ChatGPT-User", LIST_NAMES.openaiChatgptUser),
    listExpression("GPTBot", LIST_NAMES.openaiGptbot),
    listExpression("PerplexityBot", LIST_NAMES.perplexityBot),
    listExpression("Perplexity-User", LIST_NAMES.perplexityUser),
    listExpression("ClaudeBot", LIST_NAMES.anthropic),
    listExpression("anthropic-ai", LIST_NAMES.anthropic),
  ].join(" or ");

  const verifiedSearchExpression = [
    `cf.client.bot`,
    `and`,
    `(`,
    `http.user_agent contains "Googlebot" or `,
    `http.user_agent contains "Bingbot" or `,
    `http.user_agent contains "YandexBot" or `,
    `http.user_agent contains "Google-Extended" or `,
    `http.user_agent contains "DuckDuckBot" or `,
    `http.user_agent contains "Applebot" or `,
    `http.user_agent contains "CCBot"`,
    `)`,
  ].join(" ");

  const payload = {
    generated_at: new Date().toISOString(),
    notes: [
      "Place bypass rules above any Managed Challenge or JS Challenge rules.",
      "Use Super Bot Fight Mode if you need rule-level exemptions; Bot Fight Mode cannot be skipped by custom rules.",
      "The AI crawler rule is intentionally strict: user agent AND source IP list must both match.",
    ],
    lists: {
      openai_searchbot_ips: {
        name: LIST_NAMES.openaiSearchbot,
        count: Number(openaiSearchbot?.count || 0),
        source: openaiSearchbot?.source || null,
      },
      openai_chatgpt_user_ips: {
        name: LIST_NAMES.openaiChatgptUser,
        count: Number(openaiChatgptUser?.count || 0),
        source: openaiChatgptUser?.source || null,
      },
      openai_gptbot_ips: {
        name: LIST_NAMES.openaiGptbot,
        count: Number(openaiGptbot?.count || 0),
        source: openaiGptbot?.source || null,
      },
      perplexitybot_ips: {
        name: LIST_NAMES.perplexityBot,
        count: Number(perplexity?.perplexitybot?.count || 0),
        source: perplexity?.sources?.perplexitybot || null,
      },
      perplexity_user_ips: {
        name: LIST_NAMES.perplexityUser,
        count: Number(perplexity?.perplexityUser?.count || 0),
        source: perplexity?.sources?.perplexityUser || null,
      },
      anthropic_ai_ips: {
        name: LIST_NAMES.anthropic,
        count: Number(anthropic?.count || 0),
        source: anthropic?.source || null,
      },
    },
    rules: [
      {
        id: "verified_ai_crawlers_bypass",
        action: "skip",
        expression: aiBypassExpression,
        recommended_skips: [
          "remaining custom WAF rules in current phase",
          "managed WAF",
          "rate limiting",
          "Super Bot Fight Mode",
          "Browser Integrity Check / security-level style challenge sources",
        ],
      },
      {
        id: "verified_search_engines_bypass",
        action: "skip",
        expression: verifiedSearchExpression,
        recommended_skips: [
          "remaining custom WAF rules in current phase",
          "managed WAF",
          "rate limiting",
          "Super Bot Fight Mode",
        ],
      },
    ],
  };

  const markdown = `# Cloudflare crawler bypass rules

Use these rules above any challenge rules in the \`klishin.work\` zone.

- Use **Super Bot Fight Mode** if you need rule-level exemptions.
- **Bot Fight Mode** should stay off for this use case because Cloudflare does not let custom rules skip it.
- AI crawler bypass should require both **UA + IP list**.

## Rule 1: Verified AI crawlers (strict UA + IP)

\`\`\`
${aiBypassExpression}
\`\`\`

Lists:
- \`${LIST_NAMES.openaiSearchbot}\` (${Number(openaiSearchbot?.count || 0)} CIDRs)
- \`${LIST_NAMES.openaiChatgptUser}\` (${Number(openaiChatgptUser?.count || 0)} CIDRs)
- \`${LIST_NAMES.openaiGptbot}\` (${Number(openaiGptbot?.count || 0)} CIDRs)
- \`${LIST_NAMES.perplexityBot}\` (${Number(perplexity?.perplexitybot?.count || 0)} CIDRs)
- \`${LIST_NAMES.perplexityUser}\` (${Number(perplexity?.perplexityUser?.count || 0)} CIDRs)
- \`${LIST_NAMES.anthropic}\` (${Number(anthropic?.count || 0)} CIDRs)

## Rule 2: Verified search engines

\`\`\`
${verifiedSearchExpression}
\`\`\`

Recommended skip targets:
- remaining custom WAF rules in current phase
- managed WAF
- rate limiting
- Super Bot Fight Mode
`;

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_JSON, JSON.stringify(payload, null, 2) + "\n", "utf8");
  await fs.writeFile(OUTPUT_MD, markdown, "utf8");

  console.log(
    JSON.stringify(
      {
        generated_at: payload.generated_at,
        output_files: {
          json: path.relative(ROOT, OUTPUT_JSON),
          markdown: path.relative(ROOT, OUTPUT_MD),
        },
        rules: payload.rules.map((rule) => rule.id),
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
