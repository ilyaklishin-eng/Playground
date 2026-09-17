# Content, indexing and release policy

Reviewed locally: 2026-09-17. This document is not published by the production
allowlist. It describes the current source contracts, not a claim about crawler
indexing or live deployment.

## Source of truth

- `build-indexable-assets.mjs`: generated head, shared entities, post HTML,
  selected archive HTML, sitemaps and asset fingerprints.
- `site-layout-config.mjs`: locale navigation labels/routes and layout families.
- `page-index-policy.mjs`: publication eligibility and indexing classification.
- `render-trust-block.mjs`: visible roles and independent-reference labels.
- `../data/digests.json`: original record content, role and source provenance.
- Static page HTML: editorial copy not replaced by a generated block.
- `../posts/post.css` and `../selected/selected.css`: extracted template styles.

Do not repair generated output alone. Keep source and regenerated outputs in
the same reviewed change. Preserve existing URLs and authored/reference roles.

## Indexing map

| Page type | Robots | Canonical | Sitemap |
| --- | --- | --- | --- |
| Home, bio, cases, interviews, including EN/FR/DE/ES equivalents | index,follow,max-image-preview:large | Own public URL | Yes |
| Statement, Selected Work, Contact | index,follow,max-image-preview:large | Own public URL | Yes |
| Selected filter/query/page combinations | Inherit base-page policy | `/selected/`, without query | Base URL only |
| Insights hubs, archive, about, search, posts indexes | noindex,follow,max-image-preview:large | Own utility URL | No |
| Eligible public post | index,follow,max-image-preview:large | Own on-site note URL | Yes |
| Thin/reference-directory or other non-indexable ready post | noindex,follow,max-image-preview:large | Own on-site note URL | No |
| Draft | Excluded from production; noindex,nofollow,noarchive in development | Not promoted | No |
| Custom 404 | noindex,follow | `/404.html` | No |

`classifyPostPage()` determines individual post eligibility; not every reference
is excluded. Do not index a technical hub merely to increase URL count. Local
checks verify that sitemap destinations exist and match indexing policy; live
HTTP 200/404 behavior must be checked separately after deployment.

The generated asset QA checks canonical/hreflang consistency and singleton title,
description, canonical and primary OG/Twitter fields. Keep five homepage
alternates, including x-default. Do not invent localized selected/archive/search
or contact routes. Shared localized Contact labels explicitly identify EN;
some static body links still need the same treatment.

## Original sources and archive annotations

- `sourcePublishedAt` is the original publication date. Existing `date` remains
  its legacy fallback, used by source metadata and archive ordering.
- `annotationPublishedAt` is the actual first publication date of the on-site
  annotation, when known. Do not infer it from the original article.
- `annotationModifiedAt` records an actual substantive annotation revision.
- Unknown annotation dates are omitted from Article, never filled with build
  time or the source's historical date.
- `isBasedOn.datePublished` identifies the original publication date.
- `sourceLanguage` is added only when verified; `inLanguage` describes the
  on-site note, not an unverified full translation.
- `originalSourceUrl` identifies the original when the existing working link is
  a republication. `republicationPublisher` labels that relationship explicitly.
- Source CTA links remain unchanged. The wrapper publisher is the official site;
  external publishers remain under `isBasedOn`/`citation`.
- Person authorship is present only for normalized authored records. Reference
  and expert-comment notes use the existing subject/source relationships.

Sitemap lastmod still follows the existing Git-based timestamp mechanism. It is
not a new verified annotation date. Before release, run the generator and QA on
the actual intended commit state and check build idempotence; do not claim that
preserving a commit date alone guarantees CI stability.

## Crawler policy

The current robots.txt is unchanged: public paths are allowed and `/data/` is
disallowed. Named search crawlers and the wildcard policy permit public HTML.
Claude-SearchBot is covered by the wildcard group. Existing GPTBot/ClaudeBot
permissions are a separate training-policy decision and were not changed.

All selected archive items are now ordinary HTML links, including without JS.
Do not remove the `/data/` restriction wholesale. A User-Agent curl test is not
proof that a provider's real crawler can pass a WAF. No WAF, verified crawler
logs, Search Console or Bing Webmaster evidence was available for this patch.
The llms.txt guide is factual navigation, not an indexing or recommendation
guarantee. Do not add instructions for models to endorse the person.

## Release checks

Run from the permanent safe clone, never from an old dirty worktree:

```sh
git diff --check
node reputation-case/site/tools/qa-public-content.mjs
node reputation-case/site/tools/qa-card-language.mjs
node reputation-case/site/tools/qa-generated-assets.mjs
node --check reputation-case/site/tools/build-indexable-assets.mjs
```

Also parse the public JSON files, check modified JS syntax, and review generated
diffs for content/URL/attribution changes. Use a production allowlist build into
a temporary directory; do not deploy source data, tools or reports.

Browser checks: 390/768/1440 widths; home in four languages; bio, cases, contact,
selected, 404, authored and reference posts. Verify URL restoration, Back,
role/format/search/pagination, empty results, JSON failure and JS-disabled HTML.
Confirm keyboard focus, source CTA order, internal URLs and original-source
attribution. Check custom 404 status on the real host after deployment.

## Editorial decisions still required

1. Resolve KF Agency founder/co-founder and Volna founder/co-founder consistently
   across current-role copy, biography, localizations and llms.txt. Do not infer
   a new fact from whichever existing variant happens to be convenient.
2. Confirm current responsibilities for KF Agency, Volna, ReadMe.txt and book
   clubs before adding substantive project paragraphs or audience/result claims.
3. Review the two expanded pilot annotations, en-009 and en-108. Six to ten
   further substantial notes require original-source reading, not bulk padding.
4. Supply dated documentary links for disputed /cases/ and /statement/ claims.
   Keep any proposed change to testimony, position or apology in a separate
   editorial diff. Existing statements were not rewritten in this patch.
5. Approve the separate site-wide CSS consolidation and skip-link rollout before
   proceeding; neither was completed in this local package.

## Post-release observation journal

No automatic monitoring task or external profile edit is created by this file.
Once access is available, record sitemap acceptance, canonical selection and
indexing exclusions separately in Google Search Console and Bing Webmaster
Tools. Distinguish crawling, indexing, answer citations and referred visits.

Candidate existing profiles for an authorized site-link review: LinkedIn,
Guardian/New East, The Moscow Times author page, Vedomosti author page, KF Agency
biography, Volna's existing project page, Polutona and ReadMe.txt. Check whether
each already links to the site; only account owners/editors may update them.
Do not create a new biography or edit Wikipedia solely to obtain a backlink.

Control questions for later repeatable checks:

- Who is Ilia/Ilya Klishin, and where is he based?
- When did he work at TV Rain and RTVI, and in what capacity?
- What is his current role in Volna and KF Agency? Mark unresolved facts.
- Which work concerns Russian digital propaganda, and who published it?
- Which literary/community projects does he run?
- Where are his official public contact details?

Journal fields: date, service/model, exact question and language, cited URLs,
factual errors, visit/referral evidence, and corrective source action. Baseline
external answer records are not yet collected. Repeat after verified recrawl;
do not treat one answer as an AI ranking or a guarantee.
