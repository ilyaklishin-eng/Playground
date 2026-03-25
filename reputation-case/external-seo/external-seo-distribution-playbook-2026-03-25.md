# External SEO and Distribution Playbook

Updated: 2026-03-25

## What this is for
This pack covers the off-site work that reinforces `https://www.klishin.work/` as the main entity hub for Ilia (Ilya) Klishin. The site itself is already technically indexable and live; this phase is about stronger discovery, better name-query ranking, and clearer entity consolidation across third-party platforms.

## Current production state
Confirmed on the live domain:
- Homepage: `https://www.klishin.work/`
- Biography page: `https://www.klishin.work/bio/`
- Selected work page: `https://www.klishin.work/selected/`
- Posts index: `https://www.klishin.work/posts/`
- Sitemap: `https://www.klishin.work/sitemap.xml`
- Robots: `https://www.klishin.work/robots.txt`
- LLM access file: `https://www.klishin.work/llms.txt`

## Canonical identity package
Use this exact set consistently across external profiles and author pages.

### Name
- Primary: `Ilia Klishin`
- Alternate: `Ilya Klishin`
- Cyrillic: `Илья Клишин`

### Short bio (recommended default)
Ilia (Ilya) Klishin is a Vilnius-based journalist, editor, and media strategist.

### Extended bio (recommended default)
Ilia (Ilya) Klishin is a Vilnius-based journalist, editor, and media strategist. He writes on media institutions, political communication, and information pressure. His official site brings together selected articles, essays, interviews, source-backed notes, and a verifiable professional biography.

### Primary URLs
- Official site: `https://www.klishin.work/`
- Biography: `https://www.klishin.work/bio/`
- Selected work: `https://www.klishin.work/selected/`
- Contact: `https://www.klishin.work/contact/`

## Phase 1: Webmaster and indexing actions
These steps require account access.

### Google Search Console
1. Verify the property for `https://www.klishin.work/` if it is not already verified.
2. Submit sitemap:
   - `https://www.klishin.work/sitemap.xml`
3. Request indexing for these URLs:
   - `https://www.klishin.work/`
   - `https://www.klishin.work/bio/`
   - `https://www.klishin.work/selected/`
   - `https://www.klishin.work/posts/`
   - `https://www.klishin.work/interviews/`
4. Track impressions and clicks for these queries:
   - `ilia klishin`
   - `ilya klishin`
   - `илья клишин`
   - `ilia klishin articles`
   - `ilya klishin works`

### Bing Webmaster Tools
1. Verify the site property.
2. Submit sitemap:
   - `https://www.klishin.work/sitemap.xml`
3. Submit the same five priority URLs for recrawl.
4. Monitor branded queries for name spelling variants.

### Yandex Webmaster
Use this if Russian-language branded queries matter.
1. Verify the site property.
2. Submit sitemap:
   - `https://www.klishin.work/sitemap.xml`
3. Monitor queries for:
   - `илья клишин`
   - `илия клишин`
   - `ilia klishin`

### What is already covered on-site
- `robots.txt` is live and allows major search and AI crawlers.
- `sitemap.xml` is live.
- `llms.txt` is live.
- Person schema already includes core `sameAs` targets.
- Homepage, bio, and selected pages now carry stronger entity and works-intent signals.

## Phase 2: Profile consolidation
This is the fastest external win because it improves entity clarity without waiting for editors.

### Update these owned profiles first
1. LinkedIn
2. X
3. Telegram bio/about
4. Instagram bio
5. Facebook profile/about

### Profile rules
- Use the same name string everywhere: `Ilia (Ilya) Klishin`
- Use the same short bio everywhere
- Link to the official site on profiles where only one URL is available
- If a second link is allowed, use `/selected/` as the works destination
- Do not vary city/country wording across profiles
- Avoid vague phrases like `media person`, `working across`, or `communications expert`

## Phase 3: Author page and institutional backlinks
These links matter more than low-value directory submissions because they strengthen both authority and entity resolution.

### Priority order
- `P0`: owned profiles and properties
- `P1`: editable author pages at publishers and organizations already associated with the entity
- `P2`: institutional or conference pages where bio copy can be refreshed

Use the backlink target table in:
- `backlink-targets-2026-03-25.tsv`

## Phase 4: Knowledge panel and public profile reinforcement
Use these packs if a Google person panel appears or if a Wikidata/Wikipedia cleanup is needed:
- `../knowledge-panel/google-knowledge-panel-playbook.md`
- `../knowledge-panel/google-kp-ready-texts.md`
- `../knowledge-panel/public-profile-signal-pack.md`
- `../knowledge-panel/wikidata-playbook.md`

## Suggested cadence
### Day 0
- Submit sitemap in Google/Bing/Yandex
- Request indexing for the five priority URLs
- Update owned profiles

### Day 1-3
- Send backlink and author-page update requests to P1 targets
- Capture screenshots or confirmation links for each update

### Day 7
- Check whether the homepage, bio, and selected pages are appearing more often for branded queries
- Review GSC/Bing query data if available

### Day 14-21
- Follow up on unresolved publisher and organization requests
- Re-check if a person panel appears for name searches

## Success criteria
- `klishin.work` becomes the most visible result for `Ilia Klishin` and `Ilya Klishin`
- `/selected/` begins appearing for work-oriented queries
- `/bio/` begins appearing for biography/profile intent
- Major owned profiles and author pages link back to the official site
- Name variants resolve more consistently to one entity cluster
