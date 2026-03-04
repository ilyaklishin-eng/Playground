# Indexing Fast-Track Checklist

## 1) Publish to production (required)

1. Open PR from `codex/nkry-citation` to `main`.
2. Merge PR.
3. Wait for GitHub Pages deploy workflow to complete.

Compare URL:
https://github.com/ilyaklishin-eng/Playground/compare/main...codex/nkry-citation?expand=1

## 2) Check public URLs (required)

1. https://ilyaklishin-eng.github.io/Playground/reputation-case/site/index.html
2. https://ilyaklishin-eng.github.io/Playground/reputation-case/site/posts/index.html
3. https://ilyaklishin-eng.github.io/Playground/reputation-case/site/sitemap.xml
4. https://ilyaklishin-eng.github.io/Playground/reputation-case/site/rss.xml

## 3) Accelerate indexing (optional but recommended)

1. In Google Search Console: URL inspection -> request indexing for:
- `/reputation-case/site/index.html`
- `/reputation-case/site/posts/index.html`
2. Submit sitemap in Search Console:
- `https://ilyaklishin-eng.github.io/Playground/reputation-case/site/sitemap.xml`
3. In Bing Webmaster Tools: submit same sitemap.

## 4) Expected timing

- First crawl signal: typically within 24-72 hours after deployment.
- Broader indexation of post pages: usually 3-14 days, sometimes longer.

