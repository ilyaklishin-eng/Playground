# GitHub Pages + Cloudflare deploy checklist for `klishin.work`

This repo publishes the static site from:

- `reputation-case/site`

Canonical production host:

- `https://www.klishin.work/`

## 1) Cloudflare DNS (required)

Create these records in zone `klishin.work`:

1. `www` -> GitHub Pages
- Type: `CNAME`
- Name: `www`
- Target: `ilyaklishin-eng.github.io`
- Proxy status: `DNS only` (recommended for first launch)

2. Apex `@` -> GitHub Pages (for apex to resolve and redirect)
- Type: `A`
- Name: `@`
- Value: `185.199.108.153`
- Value: `185.199.109.153`
- Value: `185.199.110.153`
- Value: `185.199.111.153`
- Proxy status: `DNS only`

Optional IPv6 (recommended):
- `AAAA 2606:50c0:8000::153`
- `AAAA 2606:50c0:8001::153`
- `AAAA 2606:50c0:8002::153`
- `AAAA 2606:50c0:8003::153`

Expected behavior:
- `www.klishin.work` serves the site.
- `klishin.work` resolves and is redirected to `www.klishin.work` by GitHub Pages when custom domain is set.

## 2) GitHub Pages settings (required)

Repository -> `Settings` -> `Pages`:

1. Source: `GitHub Actions`
2. Custom domain: `www.klishin.work`
3. Enable `Enforce HTTPS` (after certificate is issued)

The repo already writes CNAME automatically and contains:

- `reputation-case/site/CNAME` -> `www.klishin.work`

## 3) CI/CD + IndexNow (already wired)

Workflow:

- `.github/workflows/deploy-pages.yml`

Configured:

- build static SEO assets
- deploy `reputation-case/site` to GitHub Pages
- write CNAME
- submit changed URLs to IndexNow

Set repository secret:

- `INDEXNOW_KEY`

## 4) Search engines setup (required)

### Google Search Console

1. Add property: `https://www.klishin.work/` (URL prefix).
2. Verify ownership:
- preferred: DNS TXT in Cloudflare (`klishin.work` zone, root `@`).
- alternative: HTML tag verification on home page.
3. In `Indexing -> Sitemaps`, submit:
- `https://www.klishin.work/sitemap.xml`
4. Optional: request indexing for:
- `https://www.klishin.work/`
- `https://www.klishin.work/bio/`
- `https://www.klishin.work/cases/`

### Bing Webmaster Tools

1. Add site: `https://www.klishin.work/`
2. Verify ownership:
- DNS TXT in Cloudflare, or
- import from Search Console.
3. In `Sitemaps`, submit:
- `https://www.klishin.work/sitemap.xml`
4. Optional: run URL inspection for home/bio/cases pages.

### Cloudflare anti-bot policy for search/AI crawlers

Goal:
- keep DNS records for GitHub Pages as `DNS only`;
- avoid challenge/CAPTCHA for verified search and AI crawlers.

Recommended settings in Cloudflare (`klishin.work` zone):

1. DNS:
- `www` CNAME and apex A/AAAA records -> `DNS only` (grey cloud).

2. Security/WAF:
- Do not create rules that force challenge for all bots.
- If challenge rules already exist, add a `Skip` rule above them for:
  - `cf.client.bot`
  - and user-agent contains one of:
    - `Googlebot`, `Google-Extended`, `Bingbot`, `OAI-SearchBot`, `GPTBot`,
      `ClaudeBot`, `anthropic-ai`, `PerplexityBot`, `Perplexity-User`, `CCBot`.
- For Perplexity, use a stricter AND-condition (UA + source IP list):
  - Source JSON feeds:
    - `https://www.perplexity.ai/perplexitybot.json`
    - `https://www.perplexity.ai/perplexity-user.json`
  - Recommended Cloudflare expression:
    - `(http.user_agent contains "PerplexityBot" and ip.src in $perplexitybot_ips) or (http.user_agent contains "Perplexity-User" and ip.src in $perplexity_user_ips)`
- For ChatGPT Search (OpenAI), use a stricter AND-condition (UA + source IP list):
  - Source JSON feed:
    - `https://openai.com/searchbot.json`
  - Recommended Cloudflare expression:
    - `(http.user_agent contains "OAI-SearchBot" and ip.src in $openai_searchbot_ips)`
- For ChatGPT-User (user-initiated browsing, not automatic search crawl), use UA + source IP list:
  - Source JSON feed:
    - `https://openai.com/chatgpt-user.json`
  - Recommended Cloudflare expression:
    - `(http.user_agent contains "ChatGPT-User" and ip.src in $openai_chatgpt_user_ips)`
- For GPTBot (OpenAI model training crawler), use UA + source IP list:
  - Source JSON feed:
    - `https://openai.com/gptbot.json`
  - Recommended Cloudflare expression:
    - `(http.user_agent contains "GPTBot" and ip.src in $openai_gptbot_ips)`

3. Bot Fight Mode / Super Bot Fight Mode:
- keep on only if verified bots are exempted;
- otherwise disable strict challenge mode for the zone.

4. Rate limiting:
- never apply global challenge to `robots.txt`, `sitemap*.xml`, `rss.xml`.

### Automatic Perplexity allowlist sync

Included workflow:
- `.github/workflows/sync-perplexity-allowlist.yml` (daily + manual run)

Generated artifacts:
- `reputation-case/site/data/perplexity-ip-allowlist.json`
- `reputation-case/site/data/perplexitybot-cidrs.txt`
- `reputation-case/site/data/perplexity-user-cidrs.txt`
- `reputation-case/site/data/perplexity-cidrs-combined.txt`

Optional Cloudflare sync (if secrets are set):
- `CF_API_TOKEN` (Account Rules Lists write permission)
- `CF_ACCOUNT_ID`
- Optional:
  - `CF_PERPLEXITYBOT_LIST_ID` / `CF_PERPLEXITYUSER_LIST_ID`
  - `CF_PERPLEXITYBOT_LIST_NAME` / `CF_PERPLEXITYUSER_LIST_NAME`

### Automatic OpenAI SearchBot allowlist sync

Included workflow:
- `.github/workflows/sync-openai-searchbot-allowlist.yml` (daily + manual run)

Generated artifacts:
- `reputation-case/site/data/openai-searchbot-ip-allowlist.json`
- `reputation-case/site/data/openai-searchbot-cidrs.txt`

Optional Cloudflare sync (if secrets are set):
- `CF_API_TOKEN` (Account Rules Lists write permission)
- `CF_ACCOUNT_ID`
- Optional:
  - `CF_OPENAI_SEARCHBOT_LIST_ID`
  - `CF_OPENAI_SEARCHBOT_LIST_NAME`

### Automatic OpenAI GPTBot allowlist sync

Included workflow:
- `.github/workflows/sync-openai-gptbot-allowlist.yml` (daily + manual run)

Generated artifacts:
- `reputation-case/site/data/openai-gptbot-ip-allowlist.json`
- `reputation-case/site/data/openai-gptbot-cidrs.txt`

Optional Cloudflare sync (if secrets are set):
- `CF_API_TOKEN` (Account Rules Lists write permission)
- `CF_ACCOUNT_ID`
- Optional:
  - `CF_OPENAI_GPTBOT_LIST_ID`
  - `CF_OPENAI_GPTBOT_LIST_NAME`

### Automatic OpenAI ChatGPT-User allowlist sync

Included workflow:
- `.github/workflows/sync-openai-chatgpt-user-allowlist.yml` (daily + manual run)

Generated artifacts:
- `reputation-case/site/data/openai-chatgpt-user-ip-allowlist.json`
- `reputation-case/site/data/openai-chatgpt-user-cidrs.txt`

Optional Cloudflare sync (if secrets are set):
- `CF_API_TOKEN` (Account Rules Lists write permission)
- `CF_ACCOUNT_ID`
- Optional:
  - `CF_OPENAI_CHATGPT_USER_LIST_ID`
  - `CF_OPENAI_CHATGPT_USER_LIST_NAME`

### GPTBot policy in robots.txt (allow / deny / custom paths)

`build-indexable-assets.mjs` supports:
- `GPTBOT_POLICY=allow` (default)
- `GPTBOT_POLICY=deny` (writes `User-agent: GPTBot` + `Disallow: /`)
- `GPTBOT_POLICY=custom` with `GPTBOT_DISALLOW_PATHS` (comma-separated paths)

Examples:
- Allow GPTBot (default):
  - `GPTBOT_POLICY=allow`
- Block GPTBot site-wide:
  - `GPTBOT_POLICY=deny`
- Block GPTBot only on selected paths:
  - `GPTBOT_POLICY=custom`
  - `GPTBOT_DISALLOW_PATHS=/private/,/internal/`

For GitHub Actions, set repository variables:
- `GPTBOT_POLICY`
- `GPTBOT_DISALLOW_PATHS` (only for `custom`)

## 5) HTTP cache policy (static assets vs HTML)

Current GitHub Pages origin behavior:
- HTML and static files are served with `Cache-Control: max-age=600`.
- To maximize repeat-visit performance, this project now fingerprints static asset filenames during build:
  - `styles.[hash].css`
  - `app.[hash].js`
  - section CSS/JS files and key images (portrait assets)
- HTML references are rewritten to hashed filenames automatically in `build-indexable-assets.mjs`.

Recommended Cloudflare cache rules (zone: `klishin.work`):

1. **Long cache for versioned assets**  
Expression:
- `(http.request.uri.path matches ".*\\.[a-f0-9]{10}\\.(css|js|png|jpg|jpeg|webp|svg|woff|woff2)$")`

Action:
- Cache level: `Cache Everything`
- Edge TTL: `1 month` (or higher)
- Browser TTL: `1 year`
- Respect origin: `off`

2. **Safe cache for HTML**
Expression:
- `(http.request.uri.path eq "/" or http.request.uri.path matches ".*\\.html$" or not http.request.uri.path contains ".")`

Action:
- Cache level: `Bypass cache` (or Browser TTL: `5 minutes` for conservative setup)

This split keeps HTML fresh while allowing long-lived immutable cache for hashed static assets.

## 6) What is already implemented in code

- Canonical URLs point to `https://www.klishin.work/`
- `robots.txt` allows indexing and explicitly allows:
  - `Googlebot`
  - `Google-Extended`
  - `Bingbot`
  - `OAI-SearchBot`
  - `GPTBot`
  - `ClaudeBot`
  - `PerplexityBot`
  - `Perplexity-User`
  - `CCBot`
- `sitemap.xml` is sitemap index and references:
  - `/sitemap-core.xml`
  - `/sitemap-en.xml`
  - `/sitemap-fr.xml`
  - `/sitemap-de.xml`
  - `/sitemap-es.xml`
- Home page has `title`, `description`, `canonical`, OG, Twitter tags, and JSON-LD (`Person`, `Organization`, `WebSite`, `WebPage`)
- Post pages include `Article` JSON-LD and hreflang alternates (`en/fr/de/es/x-default`)
- Home page is HTML-first:
  - static fallback cards are injected at build time from `digests.json`
  - JS enhances filtering/search, but content is not JS-only
- Live crawler access checks are automated:
  - on deploy: `.github/workflows/deploy-pages.yml` job `verify-live-crawler-access`
  - on schedule: `.github/workflows/monitor-crawler-access.yml` (every 6 hours)

## 7) Verification commands

```bash
./reputation-case/site/tools/publish-main-safe.sh --dry-run

node reputation-case/site/tools/build-indexable-assets.mjs
node reputation-case/site/tools/qa-generated-assets.mjs
node reputation-case/site/tools/check-public-endpoints.mjs --domain "https://www.klishin.work" --report
node reputation-case/site/tools/sync-perplexity-allowlist.mjs --write-files
node reputation-case/site/tools/sync-openai-searchbot-allowlist.mjs --write-files
node reputation-case/site/tools/sync-openai-gptbot-allowlist.mjs --write-files
node reputation-case/site/tools/sync-openai-chatgpt-user-allowlist.mjs --write-files

rg -n "HTML_FIRST_CARDS_START|HTML_FIRST_CARDS_END" reputation-case/site/index.html

curl -sSI https://www.klishin.work/robots.txt
curl -sSI https://www.klishin.work/sitemap.xml
curl -sSI https://www.klishin.work/sitemap-en.xml
curl -sSI https://www.klishin.work/
curl -s https://www.klishin.work/ | rg -n '<link rel="canonical"|application/ld\+json|og:'
curl -s https://www.klishin.work/posts/en-001-putin-macron-talks-and-the-russia-expertise-gap.html | rg -n '<link rel="canonical"|hreflang=|"@type":"Article"|noindex'
```

Expected:

- `robots.txt` returns 200 and has `Sitemap: https://www.klishin.work/sitemap.xml`
- sitemap index and child sitemaps return 200
- no `noindex` on public pages
- no canonical URLs to `github.io`
- `qa-generated-assets.mjs` exits with success and zero errors
- endpoint check script reports no `403`, `429`, or challenge markers for `/`, `/cases/`, `/bio/`, `/insights/` under browser + `ChatGPT-User` + `OAI-SearchBot` + Perplexity UAs (and `GPTBot` unless `GPTBOT_POLICY=deny`)

## 8) Stable publish workflow (prevents stuck deploy attempts)

Use the safe publisher script:

```bash
./reputation-case/site/tools/publish-main-safe.sh
```

What it does automatically:

- removes stale git lock files only when no process owns them
- aborts half-finished rebase/merge/cherry-pick states
- commits local checkpoint if workspace is dirty
- integrates `origin/main` with `merge.renames=false` and `-X ours`
- rebuilds generated assets and commits the generated diff
- pushes `HEAD` to `main` and prints recent deploy runs

Useful flags:

- `--dry-run`: run all steps except push
- `--no-build`: skip asset rebuild/QA (not recommended for normal publish)

Important:

- if merge says it may take minutes, do not interrupt it; interrupting leaves stale git state and causes subsequent deploy failures
