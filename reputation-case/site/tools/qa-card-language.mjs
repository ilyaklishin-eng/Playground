import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SITE_DIR = path.resolve(process.cwd(), "reputation-case", "site");
const DIGESTS_PATH = path.join(SITE_DIR, "data", "digests.json");
const INTERVIEWS_DATA_PATH = path.join(SITE_DIR, "data", "interviews-data.js");
const INTERVIEWS_LOCALIZE_PATH = path.join(SITE_DIR, "interviews", "interviews-localize.js");
const DEFAULT_OUTPUT = path.join(SITE_DIR, "qa-card-language-report.json");
const TARGET_LANGS = ["en", "fr", "de", "es"];
const CYRILLIC_RE = /[А-Яа-яЁёІіЇїЄє]/u;
const STOPWORDS = {
  en: new Set([
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "into",
    "about",
    "after",
    "over",
    "under",
    "why",
    "how",
    "not",
    "than",
    "where",
    "when",
    "through",
    "against",
    "between",
    "without",
    "report",
    "essay",
    "interview",
    "article",
    "column",
    "piece",
  ]),
  fr: new Set([
    "le",
    "la",
    "les",
    "un",
    "une",
    "des",
    "de",
    "du",
    "dans",
    "sur",
    "avec",
    "pour",
    "par",
    "sans",
    "entre",
    "contre",
    "cet",
    "cette",
    "ces",
    "qui",
    "que",
    "est",
    "pas",
    "article",
    "entretien",
    "texte",
    "rapport",
    "essai",
  ]),
  de: new Set([
    "der",
    "die",
    "das",
    "ein",
    "eine",
    "und",
    "mit",
    "fuer",
    "ueber",
    "im",
    "in",
    "zu",
    "zur",
    "zum",
    "auf",
    "gegen",
    "ohne",
    "zwischen",
    "nicht",
    "wie",
    "warum",
    "artikel",
    "interview",
    "bericht",
    "text",
  ]),
  es: new Set([
    "el",
    "la",
    "los",
    "las",
    "un",
    "una",
    "de",
    "del",
    "en",
    "con",
    "para",
    "por",
    "sin",
    "entre",
    "contra",
    "este",
    "esta",
    "estos",
    "estas",
    "como",
    "que",
    "no",
    "articulo",
    "entrevista",
    "texto",
    "reporte",
    "ensayo",
  ]),
};

const parseArgs = (argv) => {
  const opts = {
    output: DEFAULT_OUTPUT,
    failOnError: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output") opts.output = path.resolve(argv[++i] || "");
    else if (arg === "--no-fail") opts.failOnError = false;
  }

  return opts;
};

const clean = (value = "") => String(value || "").replace(/\s+/g, " ").trim();
const normalize = (value = "") =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const tokenize = (value = "") => normalize(value).match(/[a-z]+/g) || [];
const issue = (severity, code, id, message, details = {}) => ({ severity, code, id, message, ...details });

const analyzeLanguageSignal = (text = "") => {
  const tokens = tokenize(text);
  const counts = Object.fromEntries(
    Object.entries(STOPWORDS).map(([lang, words]) => [lang, tokens.filter((token) => words.has(token)).length])
  );
  return {
    tokens,
    tokenCount: tokens.length,
    counts,
  };
};

const dominantOtherLanguage = (targetLang, counts = {}) =>
  Object.entries(counts)
    .filter(([lang]) => lang !== targetLang)
    .sort((a, b) => b[1] - a[1])[0] || [null, 0];

const evaluateVisibleText = (id, lang, text, field, issues) => {
  const visible = clean(text);
  if (!visible || !TARGET_LANGS.includes(lang)) return;

  if (CYRILLIC_RE.test(visible)) {
    issues.push(
      issue("error", "language.cyrillic-leak", id, `${field} contains Cyrillic on a ${lang.toUpperCase()} card.`, {
        field,
        sample: visible.slice(0, 220),
      })
    );
    return;
  }

  const { tokenCount, counts } = analyzeLanguageSignal(visible);
  if (tokenCount < 8) return;

  const targetScore = counts[lang] || 0;
  const [otherLang, otherScore] = dominantOtherLanguage(lang, counts);
  const targetLead = targetScore - otherScore;
  const looksForeign = (targetScore === 0 && otherScore >= 2) || (otherScore >= targetScore + 3 && otherScore >= 4);

  if (looksForeign) {
    issues.push(
      issue("error", "language.mixed-or-wrong-locale", id, `${field} looks more like ${String(otherLang || "").toUpperCase()} than ${lang.toUpperCase()}.`, {
        field,
        sample: visible.slice(0, 220),
        counts,
        target_score: targetScore,
        other_lang: otherLang,
        other_score: otherScore,
        target_lead: targetLead,
      })
    );
  }
};

const loadInterviewsModules = async () => {
  const interviewsModule = await import(pathToFileURL(INTERVIEWS_DATA_PATH).href);
  const localizeModule = await import(pathToFileURL(INTERVIEWS_LOCALIZE_PATH).href);
  return {
    interviews: interviewsModule.default || interviewsModule.interviews || [],
    localizeInterviewItem: localizeModule.localizeInterviewItem,
  };
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(await fs.readFile(DIGESTS_PATH, "utf8"));
  const digestItems = Array.isArray(payload?.items) ? payload.items : [];
  const readyDigestItems = digestItems.filter((item) => String(item?.status || "").trim().toLowerCase() === "ready");
  const issues = [];

  for (const item of readyDigestItems) {
    const lang = String(item?.language || "").trim().toLowerCase();
    if (!TARGET_LANGS.includes(lang)) continue;
    const id = clean(item?.id) || "(missing-id)";
    evaluateVisibleText(id, lang, item?.title || "", "title", issues);
    evaluateVisibleText(id, lang, item?.summary || item?.digest || "", "summary", issues);
    const quotes = Array.isArray(item?.quotes) ? item.quotes.filter(Boolean) : [];
    quotes.forEach((quote, index) => evaluateVisibleText(id, lang, quote, `quote_${index + 1}`, issues));
  }

  const { interviews, localizeInterviewItem } = await loadInterviewsModules();
  let interviewChecks = 0;
  for (const locale of TARGET_LANGS) {
    for (const [index, baseItem] of interviews.entries()) {
      const localized = localizeInterviewItem(baseItem, locale);
      const id = `interview:${locale}:${index + 1}`;
      evaluateVisibleText(id, locale, localized?.title || "", "title", issues);
      evaluateVisibleText(id, locale, localized?.description || "", "description", issues);
      interviewChecks += 1;
    }
  }

  const errors = issues.filter((entry) => entry.severity === "error");
  const warnings = issues.filter((entry) => entry.severity === "warn");
  const report = {
    generated_at: new Date().toISOString(),
    totals: {
      ready_digest_cards: readyDigestItems.length,
      interview_cards_checked: interviewChecks,
      errors: errors.length,
      warnings: warnings.length,
      issues: issues.length,
    },
    issues,
  };

  await fs.writeFile(opts.output, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    `QA card language: ready_cards=${readyDigestItems.length} interview_cards=${interviewChecks} errors=${errors.length} warnings=${warnings.length}`
  );
  console.log(`Report: ${opts.output}`);

  if (opts.failOnError && errors.length > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
