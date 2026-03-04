# Wikidata Playbook (Entity Hygiene)

Updated: 2026-03-03

## Official references
- Create/edit items: https://www.wikidata.org/wiki/Help:Items
- Sources/references: https://www.wikidata.org/wiki/Help:References
- Living people policy: https://www.wikidata.org/wiki/Wikidata:Living_people
- Paid editing disclosure (if applicable): https://www.wikidata.org/wiki/Wikidata:Disclosure_of_paid_editing

## Step-by-step

### Step 1: Find your item (or confirm none exists)
- Search in Wikidata for:
  - Ilia Klishin
  - Ilya Klishin
  - Илья Клишин
  - Ілля Клішин
- If item exists: audit labels/descriptions/aliases/statements/references.
- If no item exists: create new item only if notability and sourcing are solid.

### Step 2: Audit high-risk fields first
- Label / description (EN, RU, UK)
- Occupation
- Employer / affiliation
- Official website
- Social profile identifiers
- "described by source" claims that import loaded wording

### Step 3: Remove or de-prioritize weak/problematic claims
- For living persons, remove unsourced or poorly sourced contentious claims.
- Keep only neutral claims with reliable references.
- Prefer factual statements over narrative labels.

### Step 4: Add strong references to neutral facts
- Use reliable, independent sources.
- Add references via:
  - stated in (P248)
  - reference URL (P854)
  - retrieved date (P813)

### Step 5: Prevent conflation
- Ensure aliases are accurate and not overbroad.
- Check if another person with similar name is merged/confused.
- If conflated, request split per Wikidata process.

## Suggested minimal neutral data model
- instance of: human
- date of birth
- occupation: journalist
- official website
- notable employer history (with sources)
- language labels/aliases aligned to real transliterations

## Practical note
Direct self-editing is allowed, but keep edits conservative, referenced, and policy-compliant. If there is likely COI scrutiny, use talk page requests and/or disclose paid editing where applicable.
