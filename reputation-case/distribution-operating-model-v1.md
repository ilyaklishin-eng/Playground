# Distribution Operating Model v1 (EN/FR/DE)

## Goal
Create a wide multilingual footprint across platforms where publishing can be automated after one-time setup.

## Tier A: enable first (maximum controllability)
1. Own Digest Site (GitHub Pages)
2. Ghost
3. WordPress (self-hosted or WordPress.com)
4. DEV / Forem
5. Hashnode
6. Blogger
7. Tumblr
8. Write.as
9. Telegram channel (distribution links)
10. Mastodon account (distribution links)
11. X / Twitter distribution

These eleven can be run with API keys/tokens and scheduled posting scripts.

## Tier B: add with partial/manual flows
1. Medium (manual/import + canonical)
2. Substack (manual/import)
3. LinkedIn (manual or restricted API route)
4. Beehiiv (API scope depends on plan)
5. Newsletter stacks (Kit, Buttondown, MailerLite, Brevo, Mailchimp)

## Content unit
- One digest card = title + fact-based summary + one short quote + source link.
- Publish EN first, then FR and DE variants.
- Keep canonical source URL in each post.

## Automation principle
- API-first platforms: full autopublish from queue files.
- Manual platforms: prefilled drafts + one-click paste workflow.
- Central source of truth: `site/data/digests.json` + batch TSV queues.

## Initial production rhythm
- Daily: 6 source items -> 18 outputs (EN/FR/DE)
- Weekly: 42 source items -> 126 outputs

## Risk controls
- No long quotes.
- No unsourced claims.
- Keep claim language factual and non-defamatory.
- Store publication logs per platform for rollback and appeals.
- Apply hard exclusion policy: do not publish/scale Current Time + Kyiv Post trope URLs in positive content.
