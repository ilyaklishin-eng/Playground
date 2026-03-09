import fs from "node:fs/promises";
import path from "node:path";

const SITE_DIR = path.resolve(process.cwd(), "reputation-case", "site");
const DEFAULT_INPUT = path.join(SITE_DIR, "data", "digests.json");
const DEFAULT_OUTPUT = path.join(SITE_DIR, "qa-content-report.json");

const parseArgs = (argv) => {
  const opts = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    minSummaryWords: 80,
    maxSummaryWords: 100,
    minSummarySentences: 2,
    minQuoteWords: 4,
    maxQuoteWords: 12,
    minQuotes: 2,
    maxQuotes: 3,
    minKeyIdeaWords: 8,
    maxKeyIdeaWords: 14,
    requiredKeyIdeas: 3,
    minValueContextWords: 20,
    maxValueContextWords: 40,
    minSemanticTags: 8,
    maxSemanticTags: 12,
    repeatedSentenceThreshold: 6,
    maxConsoleItems: 30,
    failOnError: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input") opts.input = path.resolve(argv[++i] || "");
    else if (arg === "--output") opts.output = path.resolve(argv[++i] || "");
    else if (arg === "--min-summary-words") opts.minSummaryWords = Number(argv[++i] || opts.minSummaryWords);
    else if (arg === "--max-summary-words") opts.maxSummaryWords = Number(argv[++i] || opts.maxSummaryWords);
    else if (arg === "--min-summary-sentences")
      opts.minSummarySentences = Number(argv[++i] || opts.minSummarySentences);
    else if (arg === "--min-quote-words") opts.minQuoteWords = Number(argv[++i] || opts.minQuoteWords);
    else if (arg === "--max-quote-words") opts.maxQuoteWords = Number(argv[++i] || opts.maxQuoteWords);
    else if (arg === "--min-quotes") opts.minQuotes = Number(argv[++i] || opts.minQuotes);
    else if (arg === "--max-quotes") opts.maxQuotes = Number(argv[++i] || opts.maxQuotes);
    else if (arg === "--min-keyidea-words") opts.minKeyIdeaWords = Number(argv[++i] || opts.minKeyIdeaWords);
    else if (arg === "--max-keyidea-words") opts.maxKeyIdeaWords = Number(argv[++i] || opts.maxKeyIdeaWords);
    else if (arg === "--required-keyideas")
      opts.requiredKeyIdeas = Number(argv[++i] || opts.requiredKeyIdeas);
    else if (arg === "--min-value-context-words")
      opts.minValueContextWords = Number(argv[++i] || opts.minValueContextWords);
    else if (arg === "--max-value-context-words")
      opts.maxValueContextWords = Number(argv[++i] || opts.maxValueContextWords);
    else if (arg === "--min-semantic-tags") opts.minSemanticTags = Number(argv[++i] || opts.minSemanticTags);
    else if (arg === "--max-semantic-tags") opts.maxSemanticTags = Number(argv[++i] || opts.maxSemanticTags);
    else if (arg === "--repeated-sentence-threshold")
      opts.repeatedSentenceThreshold = Number(argv[++i] || opts.repeatedSentenceThreshold);
    else if (arg === "--max-console-items") opts.maxConsoleItems = Number(argv[++i] || opts.maxConsoleItems);
    else if (arg === "--no-fail") opts.failOnError = false;
  }

  return opts;
};

const trim = (value = "") => String(value || "").replace(/\s+/g, " ").trim();
const lower = (value = "") => trim(value).toLowerCase();
const words = (value = "") => lower(value).match(/[\p{L}\p{M}\p{N}]+/gu) || [];
const wordCount = (value = "") => words(value).length;
const sentenceSplit = (value = "") =>
  trim(value)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => trim(part))
    .filter(Boolean);

const normalizeSentence = (value = "") =>
  lower(value)
    .replace(/[“”„«»"']/g, "")
    .replace(/[.,!?;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeIdea = (value = "") =>
  lower(value)
    .replace(/[“”„«»"']/g, "")
    .replace(/[.,!?;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const TEMPLATE_PATTERNS = [
  {
    code: "template.meta-mapped-en",
    field: "summary",
    severity: "error",
    re: /\bPublished in .* on \d{4}-\d{2}-\d{2}, this text is mapped as\b/i,
    message: "Summary starts with template meta boilerplate in English.",
  },
  {
    code: "template.meta-mapped-fr",
    field: "summary",
    severity: "error",
    re: /\bPublie dans .* le \d{4}-\d{2}-\d{2}, ce texte est classe en\b/i,
    message: "Summary starts with template meta boilerplate in French.",
  },
  {
    code: "template.meta-mapped-de",
    field: "summary",
    severity: "error",
    re: /\bVeroeffentlicht in .* am \d{4}-\d{2}-\d{2}, ist dieser Beitrag dem Thema\b/i,
    message: "Summary starts with template meta boilerplate in German.",
  },
  {
    code: "template.meta-mapped-es",
    field: "summary",
    severity: "error",
    re: /\bPublicado en .* el \d{4}-\d{2}-\d{2}, este texto esta clasificado en\b/i,
    message: "Summary starts with template meta boilerplate in Spanish.",
  },
  {
    code: "template.generic-framing-en",
    field: "summary",
    severity: "warn",
    re: /\bThe text follows concrete episodes, named institutions, and the language used by participants\b/i,
    message: "Summary contains repeated generic framing sentence in English.",
  },
  {
    code: "template.generic-framing-fr",
    field: "summary",
    severity: "warn",
    re: /\bLe texte suit des episodes concrets, des institutions nommees\b/i,
    message: "Summary contains repeated generic framing sentence in French.",
  },
  {
    code: "template.generic-framing-de",
    field: "summary",
    severity: "warn",
    re: /\bDer Text arbeitet mit konkreten Episoden, benannten Institutionen\b/i,
    message: "Summary contains repeated generic framing sentence in German.",
  },
  {
    code: "template.generic-framing-es",
    field: "summary",
    severity: "warn",
    re: /\bEl texto trabaja con episodios concretos, instituciones nombradas\b/i,
    message: "Summary contains repeated generic framing sentence in Spanish.",
  },
];

const TITLE_TRANSLIT_PATTERNS = [
  { code: "title.translit.lajki-zapad", re: /\blajki\s+na\s+zapad\b/i },
  { code: "title.translit.nashi-soldaty", re: /\bnashi\s+soldaty\b/i },
  { code: "title.translit.dozhd", re: /\bdozhd\b/i },
  { code: "title.translit.peregovori", re: /\bperegovori\b/i },
  { code: "title.translit.mitingi", re: /\bmitingi\b/i },
  { code: "title.translit.nezavisimie-kandidati", re: /\bnezavisimie\s+kandidati\b/i },
  { code: "title.translit.buduschee-otmenili", re: /\bbuduschee\s+otmenili\b/i },
  { code: "title.translit.glubokaya-glotka", re: /\bglubokaya\s+glotka\b/i },
  { code: "title.translit.novaya-mediinaya", re: /\bnovaya\s+mediinaya\b/i },
];

const TITLE_TRANSLIT_TOKENS = new Set([
  "lajki",
  "zapad",
  "nashi",
  "soldaty",
  "dozhd",
  "peregovori",
  "mitingi",
  "nezavisimie",
  "kandidati",
  "buduschee",
  "glubokaya",
  "glotka",
  "moskovskogo",
  "karantina",
  "viyavili",
  "znaniyah",
  "putina",
  "makrona",
  "novaya",
  "mediinaya",
  "realnost",
  "dud",
  "kiselev",
  "skuchayuschaya",
  "priviknut",
  "plohomu",
  "putinskoi",
  "shredingera",
  "tsivilizatsiyu",
  "dinamika",
  "tsuntsvage",
  "viuchennoi",
  "bespomoschnosti",
  "netradicionnaya",
  "tvitter",
  "meshaet",
  "uvidet",
  "repressii",
  "molodogvardejcy",
  "kardinala",
  "glupost",
  "izmena",
  "interpretirovat",
  "porazhenie",
  "desyatiletiyu",
  "massovih",
  "derevnyu",
  "dedushke",
  "noveishii",
  "tridtsat",
  "sedmoi",
  "emotsionalnoe",
  "onemenie",
  "tsenzuri",
  "grechka",
  "apokalipsis",
  "nekotorie",
  "kontsa",
  "pozvolyayut",
  "smeyatsya",
]);

const TITLE_META_PREFIX = /^(analyse|analysis|analisis|authored essay|media analysis|documented reporting|editorial methodology)\s*:/i;
const CYRILLIC_RE = /[А-Яа-яЁёІіЇїЄє]/;
const TRANSLIT_RE =
  /\b(lajki|zapad|nashi|soldaty|dozhd|peregovori|mitingi|nezavisimie|kandidati|buduschee|glubokaya|glotka|moskovskogo|karantina|viyavili|znaniyah|putina|makrona|novaya|mediinaya|realnost|dud|kiselev|skuchayuschaya|priviknut|plohomu|putinskoi|shredingera|tsivilizatsiyu|dinamika|tsuntsvage|viuchennoi|bespomoschnosti|netradicionnaya|tvitter|meshaet|uvidet|repressii|molodogvardejcy|kardinala|glupost|izmena|interpretirovat|porazhenie|desyatiletiyu|massovih|derevnyu|dedushke|noveishii|tridtsat|sedmoi|emotsionalnoe|onemenie|tsenzuri|grechka|apokalipsis|nekotorie|kontsa|pozvolyayut|smeyatsya)\b/i;

const BANNED_PUBLIC_LEXICON =
  /\b(machine-readable|source-linked|search\/llm|llm|indexing|indexability|entity disambiguation|entity systems|search crawlers|fact-based digest entry|translation queue|scaling queue|reference layer|verification log|source dossier|short quote marker)\b/i;

const makeIssue = (severity, code, field, message, details = {}) => ({
  severity,
  code,
  field,
  message,
  ...details,
});

const pushIssue = (bucket, issue) => {
  bucket.push(issue);
};

const addIssueCount = (counts, code) => {
  counts.set(code, (counts.get(code) || 0) + 1);
};

const checkTitle = (item, issues) => {
  const title = trim(item.title);
  const lang = String(item.language || item.lang || "").trim().toUpperCase();
  if (!title) {
    pushIssue(issues, makeIssue("error", "title.empty", "title", "Title is empty."));
    return;
  }

  if (TITLE_META_PREFIX.test(title)) {
    pushIssue(
      issues,
      makeIssue(
        "error",
        "title.meta-prefix",
        "title",
        "Title starts with a generic meta prefix; prefer a direct translated article title.",
        { value: title }
      )
    );
  }

  for (const pattern of TITLE_TRANSLIT_PATTERNS) {
    if (pattern.re.test(title)) {
      pushIssue(
        issues,
        makeIssue("error", pattern.code, "title", "Title contains transliterated Russian phrase.", { value: title })
      );
    }
  }

  const tokens = title.toLowerCase().match(/[a-z]+/g) || [];
  const translitTokens = [...new Set(tokens.filter((token) => TITLE_TRANSLIT_TOKENS.has(token)))];
  if (translitTokens.length > 0) {
    pushIssue(
      issues,
      makeIssue(
        "error",
        "title.translit.tokens",
        "title",
        "Title likely contains transliterated Russian tokens.",
        { tokens: translitTokens }
      )
    );
  }

  if (["FR", "DE", "ES"].includes(lang) && CYRILLIC_RE.test(title)) {
    pushIssue(
      issues,
      makeIssue(
        "error",
        "title.cyrillic.non-en",
        "title",
        "Title contains Cyrillic in FR/DE/ES card; use localized translation.",
        { value: title }
      )
    );
  }
};

const checkQuotes = (item, opts, issues) => {
  const lang = String(item.language || item.lang || "").trim().toUpperCase();
  const quotes = Array.isArray(item.quotes) ? item.quotes.map((q) => trim(q)).filter(Boolean) : [];

  if (quotes.length < opts.minQuotes || quotes.length > opts.maxQuotes) {
    pushIssue(
      issues,
      makeIssue(
        "error",
        "quotes.count.invalid",
        "quotes",
        `Quotes array must contain ${opts.minQuotes}-${opts.maxQuotes} items; found ${quotes.length}.`
      )
    );
  }

  for (const quote of quotes) {
    const body = trim(String(quote).replace(/\s[-—]\s.+$/, ""));
    const wordsInQuote = wordCount(body);
    if (wordsInQuote < opts.minQuoteWords || wordsInQuote > opts.maxQuoteWords) {
      pushIssue(
        issues,
        makeIssue(
          "error",
          "quotes.length.invalid",
          "quotes",
          `Quote must be ${opts.minQuoteWords}-${opts.maxQuoteWords} words; found ${wordsInQuote}.`,
          { value: quote }
        )
      );
    }

    if (BANNED_PUBLIC_LEXICON.test(quote)) {
      pushIssue(
        issues,
        makeIssue(
          "error",
          "quotes.banned-lexicon",
          "quotes",
          "Quote contains banned meta/technical lexicon.",
          { value: quote }
        )
      );
    }

    if (!/\s[-—]\s.+$/.test(quote)) {
      pushIssue(
        issues,
        makeIssue(
          "error",
          "quotes.attribution.missing",
          "quotes",
          "Quote must include source attribution with dash separator.",
          { value: quote }
        )
      );
    }
  }

  if (!["FR", "DE", "ES"].includes(lang)) return;

  for (const quote of quotes) {
    if (TRANSLIT_RE.test(quote)) {
      pushIssue(
        issues,
        makeIssue(
          "error",
          "quotes.translit.non-en",
          "quotes",
          "Quote contains transliterated Russian token in FR/DE/ES card.",
          { value: quote }
        )
      );
    }

    if (CYRILLIC_RE.test(quote)) {
      pushIssue(
        issues,
        makeIssue(
          "error",
          "quotes.cyrillic.non-en",
          "quotes",
          "Quote contains Cyrillic in FR/DE/ES card; use localized translation.",
          { value: quote }
        )
      );
    }
  }
};

const checkSummary = (item, opts, issues) => {
  const summary = trim(item.summary);

  if (!summary) {
    pushIssue(issues, makeIssue("error", "summary.empty", "summary", "Summary is empty."));
    return;
  }

  const wc = wordCount(summary);
  if (wc < opts.minSummaryWords || wc > opts.maxSummaryWords) {
    pushIssue(
      issues,
      makeIssue(
        "error",
        "summary.word-range.invalid",
        "summary",
        `Summary must be ${opts.minSummaryWords}-${opts.maxSummaryWords} words; found ${wc}.`
      )
    );
  }

  if (/\n/.test(String(item.summary || ""))) {
    pushIssue(
      issues,
      makeIssue("error", "summary.multiline", "summary", "Summary must be a single paragraph without line breaks.")
    );
  }

  const sentences = sentenceSplit(summary);
  if (sentences.length < opts.minSummarySentences) {
    pushIssue(
      issues,
      makeIssue(
        "warn",
        "summary.too-few-sentences",
        "summary",
        `Summary has too few sentences: ${sentences.length} (min ${opts.minSummarySentences}).`
      )
    );
  }

  if (/[.]{3}|…/.test(summary)) {
    pushIssue(
      issues,
      makeIssue("error", "summary.truncated", "summary", "Summary contains ellipsis and looks truncated.", {
        value: summary.slice(0, 240),
      })
    );
  }

  if (/\bmapped as\b/i.test(summary)) {
    pushIssue(
      issues,
      makeIssue(
        "error",
        "summary.template-mapped-as",
        "summary",
        "Summary contains template phrase 'mapped as'; replace with direct topic description."
      )
    );
  }

  if (BANNED_PUBLIC_LEXICON.test(summary)) {
    pushIssue(
      issues,
      makeIssue(
        "error",
        "summary.banned-lexicon",
        "summary",
        "Summary contains banned meta/technical lexicon not allowed in public card text."
      )
    );
  }

  for (const pattern of TEMPLATE_PATTERNS) {
    if (pattern.field !== "summary") continue;
    if (pattern.re.test(summary)) {
      pushIssue(issues, makeIssue(pattern.severity, pattern.code, "summary", pattern.message));
    }
  }
};

const checkKeyIdeas = (item, opts, issues) => {
  const keyIdeas = Array.isArray(item.key_ideas) ? item.key_ideas : [];
  if (keyIdeas.length !== opts.requiredKeyIdeas) {
    pushIssue(
      issues,
      makeIssue(
        "error",
        "keyideas.count.invalid",
        "key_ideas",
        `Key ideas must contain exactly ${opts.requiredKeyIdeas} items; found ${keyIdeas.length}.`
      )
    );
  }

  if (keyIdeas.length === 0) {
    return;
  }

  const seen = new Map();
  for (const idea of keyIdeas) {
    const normalized = normalizeIdea(idea);
    const ideaWords = wordCount(idea);

    if (ideaWords < opts.minKeyIdeaWords || ideaWords > opts.maxKeyIdeaWords) {
      pushIssue(
        issues,
        makeIssue(
          "error",
          "keyideas.length.invalid",
          "key_ideas",
          `Each key idea must be ${opts.minKeyIdeaWords}-${opts.maxKeyIdeaWords} words; found ${ideaWords}.`,
          { value: trim(idea) }
        )
      );
    }

    if (BANNED_PUBLIC_LEXICON.test(idea)) {
      pushIssue(
        issues,
        makeIssue(
          "error",
          "keyideas.banned-lexicon",
          "key_ideas",
          "Key idea contains banned meta/technical lexicon.",
          { value: trim(idea) }
        )
      );
    }

    if (!normalized) continue;
    if (!seen.has(normalized)) seen.set(normalized, []);
    seen.get(normalized).push(idea);
  }

  for (const [normalized, variants] of seen.entries()) {
    if (variants.length > 1) {
      pushIssue(
        issues,
        makeIssue("error", "keyideas.duplicate-local", "key_ideas", "Duplicate key idea inside the same card.", {
          normalized,
          count: variants.length,
        })
      );
    }
  }
};

const checkValueContext = (item, opts, issues) => {
  const value = trim(item.value_context);
  if (!value) {
    pushIssue(issues, makeIssue("error", "value_context.empty", "value_context", "Value/context is empty."));
    return;
  }

  const valueWords = wordCount(value);
  if (valueWords < opts.minValueContextWords || valueWords > opts.maxValueContextWords) {
    pushIssue(
      issues,
      makeIssue(
        "error",
        "value_context.length.invalid",
        "value_context",
        `Value/context must be ${opts.minValueContextWords}-${opts.maxValueContextWords} words; found ${valueWords}.`
      )
    );
  }

  if (BANNED_PUBLIC_LEXICON.test(value)) {
    pushIssue(
      issues,
      makeIssue(
        "error",
        "value_context.banned-lexicon",
        "value_context",
        "Value/context contains banned meta/technical lexicon."
      )
    );
  }
};

const checkSemanticTags = (item, opts, issues) => {
  const tags = Array.isArray(item.semantic_tags) ? item.semantic_tags.map((t) => trim(t)).filter(Boolean) : [];
  if (tags.length < opts.minSemanticTags || tags.length > opts.maxSemanticTags) {
    pushIssue(
      issues,
      makeIssue(
        "error",
        "semantic_tags.count.invalid",
        "semantic_tags",
        `Semantic tags must contain ${opts.minSemanticTags}-${opts.maxSemanticTags} items; found ${tags.length}.`
      )
    );
  }

  const seen = new Set();
  for (const tag of tags) {
    const key = lower(tag);
    if (seen.has(key)) {
      pushIssue(
        issues,
        makeIssue("error", "semantic_tags.duplicate-local", "semantic_tags", "Duplicate semantic tag in card.", {
          value: tag,
        })
      );
    }
    seen.add(key);

    if (BANNED_PUBLIC_LEXICON.test(tag)) {
      pushIssue(
        issues,
        makeIssue(
          "error",
          "semantic_tags.banned-lexicon",
          "semantic_tags",
          "Semantic tag contains banned meta/technical lexicon.",
          { value: tag }
        )
      );
    }
  }
};

const checkTemplatePhrasesInField = (value, field, issues) => {
  const text = trim(value);
  if (!text) return;
  for (const pattern of TEMPLATE_PATTERNS) {
    if (pattern.field !== field) continue;
    if (pattern.re.test(text)) {
      pushIssue(issues, makeIssue(pattern.severity, pattern.code, field, pattern.message));
    }
  }
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  const raw = await fs.readFile(opts.input, "utf8");
  const payload = JSON.parse(raw);
  const items = Array.isArray(payload.items) ? payload.items : [];

  const itemReports = new Map();
  const issueCodeCounts = new Map();

  const summaryToIds = new Map();
  const sentenceToEntries = new Map();
  const keyIdeaToEntries = new Map();

  for (const item of items) {
    const id = String(item.id || "").trim() || "(missing-id)";
    const report = {
      id,
      language: String(item.language || "").trim(),
      title: String(item.title || "").trim(),
      issues: [],
    };

    checkTitle(item, report.issues);
    checkSummary(item, opts, report.issues);
    checkKeyIdeas(item, opts, report.issues);
    checkQuotes(item, opts, report.issues);
    checkValueContext(item, opts, report.issues);
    checkSemanticTags(item, opts, report.issues);
    checkTemplatePhrasesInField(item.value_context, "value_context", report.issues);
    checkTemplatePhrasesInField(item.digest, "digest", report.issues);

    for (const issue of report.issues) addIssueCount(issueCodeCounts, issue.code);
    itemReports.set(id, report);

    const summaryNorm = normalizeSentence(item.summary || "");
    if (summaryNorm) {
      if (!summaryToIds.has(summaryNorm)) summaryToIds.set(summaryNorm, []);
      summaryToIds.get(summaryNorm).push(id);
    }

    for (const sentence of sentenceSplit(item.summary || "")) {
      const normSentence = normalizeSentence(sentence);
      const wc = wordCount(sentence);
      if (!normSentence || wc < 10) continue;
      if (!sentenceToEntries.has(normSentence)) sentenceToEntries.set(normSentence, { count: 0, ids: new Set(), raw: sentence });
      const entry = sentenceToEntries.get(normSentence);
      entry.count += 1;
      entry.ids.add(id);
      if (sentence.length > entry.raw.length) entry.raw = sentence;
    }

    const ideas = Array.isArray(item.key_ideas) ? item.key_ideas : [];
    for (const idea of ideas) {
      const normIdea = normalizeIdea(idea);
      if (!normIdea) continue;
      if (!keyIdeaToEntries.has(normIdea)) keyIdeaToEntries.set(normIdea, { ids: new Set(), samples: new Set() });
      const entry = keyIdeaToEntries.get(normIdea);
      entry.ids.add(id);
      entry.samples.add(trim(idea));
    }
  }

  const globalIssues = [];

  for (const [summaryNorm, ids] of summaryToIds.entries()) {
    if (ids.length < 2) continue;
    globalIssues.push({
      severity: "warn",
      code: "summary.duplicate-global",
      message: "Identical summary text is reused across multiple cards.",
      count: ids.length,
      ids,
      summary_preview: summaryNorm.slice(0, 220),
    });
    for (const id of ids) {
      const report = itemReports.get(id);
      pushIssue(
        report.issues,
        makeIssue("warn", "summary.duplicate-global", "summary", "Summary text is identical to another card.", {
          ids,
        })
      );
      addIssueCount(issueCodeCounts, "summary.duplicate-global");
    }
  }

  const repeatedSummarySentences = [...sentenceToEntries.entries()]
    .filter(([, entry]) => entry.ids.size >= opts.repeatedSentenceThreshold)
    .sort((a, b) => b[1].ids.size - a[1].ids.size);

  for (const [normSentence, entry] of repeatedSummarySentences) {
    const ids = [...entry.ids];
    const severity = "warn";
    globalIssues.push({
      severity,
      code: "summary.repeated-sentence-global",
      message: "Long summary sentence repeats across too many cards (template drift).",
      count: ids.length,
      ids,
      sentence: entry.raw,
      normalized: normSentence,
    });
  }

  const repeatedByItem = new Map();
  for (const [, entry] of repeatedSummarySentences) {
    for (const id of entry.ids) {
      if (!repeatedByItem.has(id)) repeatedByItem.set(id, []);
      repeatedByItem.get(id).push(entry.raw);
    }
  }
  for (const [id, sentences] of repeatedByItem.entries()) {
    const report = itemReports.get(id);
    const severity = "warn";
    pushIssue(
      report.issues,
      makeIssue(
        severity,
        "summary.repeated-sentence-global",
        "summary",
        "Summary contains sentence(s) reused in many other cards.",
        {
          repeated_sentence_count: sentences.length,
          examples: sentences.slice(0, 3),
        }
      )
    );
    addIssueCount(issueCodeCounts, "summary.repeated-sentence-global");
  }

  const repeatedKeyIdeas = [...keyIdeaToEntries.entries()]
    .filter(([, entry]) => entry.ids.size >= 2)
    .sort((a, b) => b[1].ids.size - a[1].ids.size);

  for (const [normIdea, entry] of repeatedKeyIdeas) {
    const ids = [...entry.ids];
    const severity = "warn";
    globalIssues.push({
      severity,
      code: "keyideas.duplicate-global",
      message: "Same key idea appears in multiple cards.",
      count: ids.length,
      ids,
      normalized: normIdea,
      samples: [...entry.samples].slice(0, 3),
    });
  }

  const repeatedIdeasByItem = new Map();
  for (const [normIdea, entry] of repeatedKeyIdeas) {
    for (const id of entry.ids) {
      if (!repeatedIdeasByItem.has(id)) repeatedIdeasByItem.set(id, []);
      repeatedIdeasByItem.get(id).push(normIdea);
    }
  }
  for (const [id, ideas] of repeatedIdeasByItem.entries()) {
    const report = itemReports.get(id);
    const severity = "warn";
    pushIssue(
      report.issues,
      makeIssue(
        severity,
        "keyideas.duplicate-global",
        "key_ideas",
        "One or more key ideas are reused in other cards.",
        { repeated_keyidea_count: ideas.length }
      )
    );
    addIssueCount(issueCodeCounts, "keyideas.duplicate-global");
  }

  const itemResults = [...itemReports.values()].filter((entry) => entry.issues.length > 0);
  const totalErrors =
    itemResults.reduce((sum, item) => sum + item.issues.filter((issue) => issue.severity === "error").length, 0) +
    globalIssues.filter((issue) => issue.severity === "error").length;
  const totalWarnings =
    itemResults.reduce((sum, item) => sum + item.issues.filter((issue) => issue.severity === "warn").length, 0) +
    globalIssues.filter((issue) => issue.severity === "warn").length;

  const report = {
    generated_at: new Date().toISOString(),
    input: opts.input,
    total_items: items.length,
    thresholds: {
      min_summary_words: opts.minSummaryWords,
      max_summary_words: opts.maxSummaryWords,
      min_summary_sentences: opts.minSummarySentences,
      min_quote_words: opts.minQuoteWords,
      max_quote_words: opts.maxQuoteWords,
      min_quotes: opts.minQuotes,
      max_quotes: opts.maxQuotes,
      required_key_ideas: opts.requiredKeyIdeas,
      min_key_idea_words: opts.minKeyIdeaWords,
      max_key_idea_words: opts.maxKeyIdeaWords,
      min_value_context_words: opts.minValueContextWords,
      max_value_context_words: opts.maxValueContextWords,
      min_semantic_tags: opts.minSemanticTags,
      max_semantic_tags: opts.maxSemanticTags,
      repeated_sentence_threshold: opts.repeatedSentenceThreshold,
    },
    totals: {
      errors: totalErrors,
      warnings: totalWarnings,
      items_with_issues: itemResults.length,
      global_issues: globalIssues.length,
    },
    issue_code_counts: Object.fromEntries([...issueCodeCounts.entries()].sort((a, b) => b[1] - a[1])),
    global_issues: globalIssues,
    items: itemResults.sort((a, b) => a.id.localeCompare(b.id)),
  };

  await fs.writeFile(opts.output, JSON.stringify(report, null, 2));

  const previewItems = itemResults.slice(0, opts.maxConsoleItems);
  console.log(`QA content check: ${items.length} items`);
  console.log(`Errors: ${totalErrors} | Warnings: ${totalWarnings} | Items with issues: ${itemResults.length}`);
  console.log(`Report: ${opts.output}`);

  if (globalIssues.length > 0) {
    console.log("\nGlobal issues:");
    for (const issue of globalIssues.slice(0, 12)) {
      console.log(`- [${issue.severity}] ${issue.code}: ${issue.message} (count=${issue.count})`);
    }
  }

  if (previewItems.length > 0) {
    console.log("\nItem issue preview:");
    for (const item of previewItems) {
      const errors = item.issues.filter((x) => x.severity === "error").length;
      const warns = item.issues.filter((x) => x.severity === "warn").length;
      console.log(`- ${item.id} (${item.language}) errors=${errors} warns=${warns}`);
      for (const issue of item.issues.slice(0, 4)) {
        console.log(`  * [${issue.severity}] ${issue.code}: ${issue.message}`);
      }
    }
    if (itemResults.length > opts.maxConsoleItems) {
      console.log(`...and ${itemResults.length - opts.maxConsoleItems} more items`);
    }
  }

  if (opts.failOnError && totalErrors > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
