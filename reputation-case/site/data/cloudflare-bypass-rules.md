# Cloudflare crawler bypass rules

Use these rules above any challenge rules in the `klishin.work` zone.

- Use **Super Bot Fight Mode** if you need rule-level exemptions.
- **Bot Fight Mode** should stay off for this use case because Cloudflare does not let custom rules skip it.
- AI crawler bypass should require both **UA + IP list**.

## Rule 1: Verified AI crawlers (strict UA + IP)

```
(http.user_agent contains "OAI-SearchBot" and ip.src in $openai_searchbot_ips) or (http.user_agent contains "ChatGPT-User" and ip.src in $openai_chatgpt_user_ips) or (http.user_agent contains "GPTBot" and ip.src in $openai_gptbot_ips) or (http.user_agent contains "PerplexityBot" and ip.src in $perplexitybot_ips) or (http.user_agent contains "Perplexity-User" and ip.src in $perplexity_user_ips) or (http.user_agent contains "ClaudeBot" and ip.src in $anthropic_ai_ips) or (http.user_agent contains "anthropic-ai" and ip.src in $anthropic_ai_ips)
```

Lists:
- `openai_searchbot_ips` (35 CIDRs)
- `openai_chatgpt_user_ips` (234 CIDRs)
- `openai_gptbot_ips` (21 CIDRs)
- `perplexitybot_ips` (8 CIDRs)
- `perplexity_user_ips` (4 CIDRs)
- `anthropic_ai_ips` (1 CIDRs)

## Rule 2: Verified search engines

```
cf.client.bot and ( http.user_agent contains "Googlebot" or  http.user_agent contains "Bingbot" or  http.user_agent contains "YandexBot" or  http.user_agent contains "Google-Extended" or  http.user_agent contains "DuckDuckBot" or  http.user_agent contains "Applebot" or  http.user_agent contains "CCBot" )
```

Recommended skip targets:
- remaining custom WAF rules in current phase
- managed WAF
- rate limiting
- Super Bot Fight Mode
