# RU Wikipedia Audit: Илья Клишин (2026-03-04)

- Page checked: https://ru.wikipedia.org/wiki/Клишин,_Илья_Сергеевич
- Audit date: 2026-03-04
- Goal: verify all claims/materials used on the page and flag weak/unstable references.
- Detailed per-reference table: `wiki-ru-reference-audit-2026-03-04.tsv`

## Quick result

1. References checked: 28 (22 numbered references + 6 external links).
2. Verified in this run: 13.
3. Blocked/URL unresolved in crawler: 15.
4. High-risk source quality issues:
- multiple primary/self-published links for biographical claims (`kf.agency`, `kfconsulting.tilda.ws`, Twitter);
- several unresolved/dead-style refs (Echo, Delfi, some old Colta/Lenta/MEL links);
- two explicit "citation needed" markers remain in biography text.

## Claim-level assessment

### A. Supported (good confidence)

1. Co-founder context for "Волна" and post-2022 trajectory: supported by 7x7 + Holod.
2. Protest-organizer context and 2012 pressure episode: supported by Lenta item; stronger corroboration available (HRW + Guardian already in registry).
3. Guardian profile signal (30 under 30 / New East): directly supported by The Guardian.
4. Publication footprint (Vedomosti, Snob, Moscow Times): supported by working byline/profile URLs.

### B. Supported but weakly sourced (needs hardening)

1. Core lead bio currently leans on own-agency profile and other soft sources.
2. KFConsulting founding claim currently points to company site (primary source).
3. Relocation claim currently points to personal Twitter (primary source for BLP-style fact).

### C. Unstable or unresolved references

1. Echo RTVI-appointment ref URL not reliably accessible.
2. Delfi publication refs not resolved in crawler (URL-level verification failed).
3. MEL FLEX ref in page list not machine-resolved in this run.
4. Some older Colta/Lenta/Carnegie refs intermittently unavailable.

## Data quality issues on the page itself

1. `Выпускник МГИМО ...` currently shows citation-needed marker.
2. `Живет в Литве с женой и дочерью` currently shows citation-needed marker.

For living-person pages, these should be either sourced with reliable independent references or removed/softened.

## Recommended fixes for RU Wikipedia page

### Priority P1 (do first)

1. Replace/augment lead references with independent high-quality sources (Guardian, major media byline pages, 7x7/Holod where applicable).
2. Replace primary-source-only references for sensitive biographical facts (Twitter, company site).
3. Resolve or remove dead/unverifiable refs (Echo/Delfi unresolved links).

### Priority P2

1. Add stronger multi-source support for 2011-2012 protest section using existing independent materials already collected in project registry (Lenta + HRW + Guardian + Reuters Trust where policy-compatible).
2. Normalize publication list references to stable author-profile URLs where available.

### Priority P3

1. Keep external links concise; remove non-working duplicates.
2. Archive-check old links and replace with working equivalents only if they meet reliability rules.

## Ready replacement pool (already in project files)

- Protest/pressure cluster dossier:
  - `/Users/ilyaklishin/Documents/Playground/reputation-case/dossiers/protests-2011-2012-organizing-and-pressure.md`
- Source registry (verified candidates):
  - `/Users/ilyaklishin/Documents/Playground/reputation-case/source-registry-v1.tsv`

## What still needs manual browser confirmation

1. Exact current URL for the Echo RTVI reference in wiki footnote [11].
2. Exact current URL(s) for Delfi references in footnotes [21] and [28].
3. Exact MEL FLEX URL used in footnote [5], if different from verified MEL alternatives.

