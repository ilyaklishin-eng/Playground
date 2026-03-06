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

1. Add URL-prefix property: `https://www.klishin.work/`
2. Verify ownership (DNS TXT in Cloudflare)
3. Submit sitemap: `https://www.klishin.work/sitemap.xml`

### Bing Webmaster Tools

1. Add site: `https://www.klishin.work/`
2. Verify ownership (DNS TXT or import from GSC)
3. Submit sitemap: `https://www.klishin.work/sitemap.xml`

## 5) What is already implemented in code

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

## 6) Verification commands

```bash
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
