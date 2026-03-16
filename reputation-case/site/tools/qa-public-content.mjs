import fs from "node:fs/promises";
import path from "node:path";

const SITE_DIR = path.resolve(process.cwd(), "reputation-case", "site");
const DEFAULT_INPUT = path.join(SITE_DIR, "data", "digests.json");
const DEFAULT_OUTPUT = path.join(SITE_DIR, "qa-public-content-report.json");

const parseArgs = (argv) => {
  const opts = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    failOnError: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input") opts.input = path.resolve(argv[++i] || "");
    else if (arg === "--output") opts.output = path.resolve(argv[++i] || "");
    else if (arg === "--no-fail") opts.failOnError = false;
  }

  return opts;
};

const trim = (value = "") => String(value || "").replace(/\s+/g, " ").trim();
const lower = (value = "") => trim(value).toLowerCase();

const REFERENCE_TOPIC_RE =
  /\b(editorial standard|professional profile|profil professionnel|berufsprofil|profil auteur|source-based summary|public profile|public speaking(?: history)?|offentliche rede|oratoria publica|parcours de prise de parole|institutional citation|reference institutionnelle|institutionelle referenz|documented reporting|parcours professionnel documente|dokumentierter berufsverlauf)\b/i;
const REFERENCE_TITLE_RE =
  /\b(author page|autorenprofil|profil d auteur|mirror domain|canonical variant|ted talk video reference|speaker profile|how this archive is built|methodology)\b/i;

const TRANSLIT_RE =
  /\b(lajki|zapad|nashi|soldaty|dozhd|peregovori|mitingi|nezavisimie|kandidati|buduschee|glubokaya|glotka|moskovskogo|karantina|viyavili|znaniyah|putina|makrona|novaya|mediinaya|realnost|dud|kiselev|skuchayuschaya|priviknut|plohomu|putinskoi|shredingera|tsivilizatsiyu|dinamika|tsuntsvage|viuchennoi|bespomoschnosti|netradicionnaya|tvitter|meshaet|uvidet|repressii|molodogvardejcy|kardinala|glupost|izmena|interpretirovat|porazhenie|desyatiletiyu|massovih|derevnyu|dedushke|noveishii|tridtsat|sedmoi|emotsionalnoe|onemenie|tsenzuri|grechka|apokalipsis|nekotorie|kontsa|pozvolyayut|smeyatsya)\b/i;
const CYRILLIC_RE = /[А-Яа-яЁёІіЇїЄє]/;

const BAD_PUBLIC_TITLE_RE = /\b(record|entry|notice|variant|mirror domain|canonical variant)\b/i;
const BAD_SUMMARY_PATTERNS = [
  /\bIn the \d{4}-\d{2}-\d{2} context\b/i,
  /\bSource:\b/i,
  /\bentities:\b/i,
  /\bCausal chain:\b/i,
  /\bThis card is valuable\b/i,
  /\bThe narrative avoids reductive labels\b/i,
  /\bso readers can separate reported facts from interpretation\b/i,
  /\bThis card summarizes\b/i,
  /\bAs a dated source from\b/i,
  /\bEntry added to include this publication\b/i,
  /\bverified source link\b/i,
  /\bwiden or narrow trust gaps\b/i,
  /\bframed through identifiable actors\b/i,
  /\bnamed actors and decisions\b/i,
  /\bPeriod context explains causes effects and stakes\b/i,
];
const BAD_META_NOISE_PATTERNS = [
  /\bThe narrative avoids reductive labels\b/i,
  /\bso readers can separate reported facts from interpretation\b/i,
  /\bThis card summarizes\b/i,
  /\bAs a dated source from\b/i,
  /\bEntry added to include this publication\b/i,
  /\bverified source link\b/i,
  /\bsource-linked\b/i,
  /\bmachine-readable\b/i,
  /\bmapped as\b/i,
  /\bwiden or narrow trust gaps\b/i,
  /\bframed through identifiable actors\b/i,
  /\bnamed actors and decisions\b/i,
  /\bPeriod context explains causes effects and stakes\b/i,
  /\bpublic records\b/i,
  /\bmultilingual materials\b/i,
  /\bcausal framing\b/i,
  /\bchronology actors\b/i,
];
const TRUNCATED_SUMMARY_RE = /(?:\.\.\.|…|[:;,–-])\s*$/;
const PLACEHOLDER_TITLES = new Set(["vedomosti", "the moscow times ru", "ru.themoscowtimes", "snob", "tv rain"]);
const AUTHOR_PROFILE_RE = /\b(author page|author profile|profil d auteur|autorenprofil)\b/i;

const issue = (severity, code, id, message, details = {}) => ({
  severity,
  code,
  id,
  message,
  ...details,
});

const isReady = (item) => lower(item?.status) === "ready";
const isReferenceCard = (item) => {
  const explicit = lower(item?.content_class);
  if (explicit === "reference") return true;
  if (explicit === "writing") return false;
  const relation = lower(item?.relation);
  if (relation === "reference" || relation === "author_profile") return true;
  if (relation === "authored_by_ilya" || relation === "interview_with_ilya") return false;
  const topic = trim(item?.topic);
  const title = trim(item?.title);
  return REFERENCE_TOPIC_RE.test(topic) || REFERENCE_TITLE_RE.test(title);
};

const normalizedSourceUrl = (item) => {
  const raw = trim(item?.url);
  if (!raw) return "";
  try {
    return new URL(raw).toString().toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(await fs.readFile(opts.input, "utf8"));
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const readyItems = items.filter((item) => isReady(item));
  const writingItems = readyItems.filter((item) => !isReferenceCard(item));

  const issues = [];

  for (const item of readyItems) {
    const id = trim(item?.id) || "(missing-id)";
    const title = trim(item?.title);
    const summary = trim(item?.summary || item?.digest);
    const lang = upper(item?.language);
    const quotes = Array.isArray(item?.quotes) ? item.quotes.map((q) => trim(q)).filter(Boolean) : [];

    if (!title) {
      issues.push(issue("error", "title.empty", id, "Public card title is empty."));
      continue;
    }

    if (BAD_PUBLIC_TITLE_RE.test(title)) {
      issues.push(issue("error", "title.bad-lexeme", id, "Public title contains blocked machine term.", { title }));
    }

    if (PLACEHOLDER_TITLES.has(lower(title))) {
      issues.push(issue("error", "title.placeholder", id, "Public title is a source placeholder; use a human title.", { title }));
    }

    for (const pattern of BAD_SUMMARY_PATTERNS) {
      if (pattern.test(summary)) {
        issues.push(
          issue("error", "summary.blocked-template", id, "Summary contains blocked boilerplate/template phrase.", {
            summary,
            pattern: String(pattern),
          })
        );
      }
    }

    if (summary && TRUNCATED_SUMMARY_RE.test(summary)) {
      issues.push(
        issue("error", "summary.truncated", id, "Summary looks truncated or cut off mid-thought.", {
          summary,
        })
      );
    }

    const valueContext = trim(item?.value_context);
    const keyIdeas = Array.isArray(item?.key_ideas) ? item.key_ideas.map((entry) => trim(entry)).filter(Boolean) : [];

    for (const pattern of BAD_META_NOISE_PATTERNS) {
      if (pattern.test(valueContext)) {
        issues.push(
          issue("error", "value-context.meta-noise", id, "Value/context contains service boilerplate or meta-noise.", {
            value_context: valueContext,
            pattern: String(pattern),
          })
        );
      }

      for (const idea of keyIdeas) {
        if (pattern.test(idea)) {
          issues.push(
            issue("warn", "key-ideas.meta-noise", id, "Key ideas contain template/meta language that should be rewritten.", {
              key_idea: idea,
              pattern: String(pattern),
            })
          );
        }
      }

      for (const quote of quotes) {
        if (pattern.test(quote)) {
          issues.push(
            issue("warn", "quotes.meta-noise", id, "Quote field contains synthetic/meta language instead of a real quote.", {
              quote,
              pattern: String(pattern),
            })
          );
        }
      }
    }

    if (["FR", "DE", "ES"].includes(lang)) {
      if (CYRILLIC_RE.test(title) || TRANSLIT_RE.test(title)) {
        issues.push(
          issue(
            "error",
            "title.translit-or-cyrillic.non-en",
            id,
            "FR/DE/ES title contains translit/Cyrillic; use localized title.",
            { title }
          )
        );
      }

      for (const quote of quotes) {
        if (CYRILLIC_RE.test(quote) || TRANSLIT_RE.test(quote)) {
          issues.push(
            issue(
              "error",
              "quotes.translit-or-cyrillic.non-en",
              id,
              "FR/DE/ES quote contains translit/Cyrillic; use localized quote.",
              { quote }
            )
          );
        }
      }
    }
  }

  for (const item of writingItems) {
    const id = trim(item?.id) || "(missing-id)";
    const title = trim(item?.title);
    const topic = trim(item?.topic);
    if (AUTHOR_PROFILE_RE.test(title) || AUTHOR_PROFILE_RE.test(topic)) {
      issues.push(
        issue(
          "error",
          "writing.author-profile-leakage",
          id,
          "Author/profile-style card appears in main writing feed; mark as reference.",
          { title, topic }
        )
      );
    }
  }

  const sourceToIds = new Map();
  for (const item of writingItems) {
    const sourceUrl = normalizedSourceUrl(item);
    if (!sourceUrl) continue;
    if (!sourceToIds.has(sourceUrl)) sourceToIds.set(sourceUrl, []);
    sourceToIds.get(sourceUrl).push(trim(item?.id) || "(missing-id)");
  }

  for (const [sourceUrl, ids] of sourceToIds.entries()) {
    if (ids.length > 1) {
      issues.push(
        issue(
          "error",
          "writing.duplicate-source-url",
          ids.join(","),
          "Duplicate source URL appears across multiple ready writing cards.",
          { source_url: sourceUrl, ids }
        )
      );
    }
  }

  const errors = issues.filter((x) => x.severity === "error");
  const warnings = issues.filter((x) => x.severity === "warn");

  const report = {
    generated_at: new Date().toISOString(),
    input: opts.input,
    totals: {
      items: items.length,
      ready_items: readyItems.length,
      writing_items: writingItems.length,
      reference_items: readyItems.length - writingItems.length,
      errors: errors.length,
      warnings: warnings.length,
      issues: issues.length,
    },
    issues,
  };

  await fs.writeFile(opts.output, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    `QA public content: total=${items.length} ready=${readyItems.length} writing=${writingItems.length} references=${readyItems.length - writingItems.length}`
  );
  console.log(`Errors=${errors.length} Warnings=${warnings.length}`);
  console.log(`Report: ${opts.output}`);

  if (opts.failOnError && errors.length > 0) {
    process.exitCode = 1;
  }
};

const upper = (value = "") => String(value || "").trim().toUpperCase();

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
