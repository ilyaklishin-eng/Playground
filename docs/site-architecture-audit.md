# Site Architecture Audit (`klishin.work`)

Date: 2026-03-09
Scope: `/Users/ilyaklishin/Documents/Playground/reputation-case/site`

## 1) Public Pages Map

Core human-facing routes:

- `/` — public home (hero, public/research split, published cards feed, contact block)
- `/bio/` — biography (EN)
- `/bio/fr/` — biography (FR)
- `/bio/de/` — biography (DE)
- `/bio/es/` — biography (ES)
- `/cases/` — case clarifications (EN)
- `/cases/fr/` — case clarifications (FR)
- `/cases/de/` — case clarifications (DE)
- `/cases/es/` — case clarifications (ES)
- `/about/` — site purpose and layer explanation

Navigation includes `Contact` anchor: `/#contact`.

## 2) Archive / Research Pages Map

Research/archive routes and endpoints:

- `/insights/` — research hub
- `/archive/` — archive hub
- `/posts/` — static index of all cards
- `/posts/*.html` — per-card static pages (generated)
- `/data/digests.json` — primary data source for cards
- `/source-registry-v1.tsv` — source registry
- `/rss.xml` — feed
- `/sitemap.xml` — sitemap index
- `/sitemap-core.xml`, `/sitemap-en.xml`, `/sitemap-fr.xml`, `/sitemap-de.xml`, `/sitemap-es.xml`
- `/robots.txt`
- `/llms.txt`

## 3) Problem Areas (Current)

- Draft leakage into archive layer: `posts/*` and language sitemaps are generated from all items, not only `ready`.
- Language readiness imbalance: EN has published items; FR/DE/ES are mostly or fully `draft`.
- Data quality variance in `digests.json`: template phrasing and uneven summary/title quality still present.
- Public/archive boundary is improved in UI, but archive pages remain indexable and can dominate discovery if not tuned further.
- Large generated surface (`posts/index.html` + 400 cards) increases QA and consistency risk.

## 4) Components To Change Next

Primary files/scripts for next tasks:

- Home UI behavior:
  - `reputation-case/site/index.html`
  - `reputation-case/site/app.js`
  - `reputation-case/site/styles.css`
- Public static pages copy/structure:
  - `reputation-case/site/about/index.html`
  - `reputation-case/site/bio/*/index.html`
  - `reputation-case/site/cases/*/index.html`
  - `reputation-case/site/insights/index.html`
  - `reputation-case/site/archive/index.html`
- Build pipeline (generation + SEO artifacts):
  - `reputation-case/site/tools/build-indexable-assets.mjs`
- Content QA and gates:
  - `reputation-case/site/tools/qa-content.mjs`
  - `reputation-case/site/tools/qa-generated-assets.mjs`
  - `.github/workflows/validate-seo-assets.yml`
  - `.github/workflows/deploy-pages.yml`
- Source content normalization:
  - `reputation-case/site/data/digests.json`
  - `reputation-case/site/tools/enforce-v1-cards.mjs` (and related rewrite scripts)
