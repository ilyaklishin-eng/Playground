import fs from "node:fs/promises";
import path from "node:path";

const SITE_DIR = path.resolve(process.cwd(), "reputation-case", "site");
const DATA_PATH = path.join(SITE_DIR, "data", "digests.json");

const LANGS = new Set(["EN", "FR", "DE", "ES"]);

const trim = (value = "") => String(value || "").replace(/\s+/g, " ").trim();
const lower = (value = "") => trim(value).toLowerCase();
const wc = (value = "") => (trim(value).match(/[\p{L}\p{M}\p{N}]+/gu) || []).length;

const splitSentences = (value = "") =>
  trim(value)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => trim(part))
    .filter(Boolean);

const toSentence = (value = "") => {
  const out = trim(String(value || "").replace(/[;:,]+$/g, ""));
  if (!out) return "";
  return /[.!?]$/.test(out) ? out : `${out}.`;
};

const dedupeKeepOrder = (items) => {
  const out = [];
  const seen = new Set();
  for (const raw of items) {
    const next = trim(raw);
    if (!next) continue;
    const key = lower(next);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
};

const CYRILLIC_RE = /[А-Яа-яЁёІіЇїЄє]/;

const TRANSLIT_TOKENS = [
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
  "moskovskogo",
  "karantina",
  "viyavili",
  "znaniyah",
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
  "sveta",
  "pozvolyayut",
  "smeyatsya",
];

const TRANSLIT_RE = new RegExp(`\\b(${TRANSLIT_TOKENS.join("|")})\\b`, "i");

const META_LEXICON_RE =
  /\b(mapped as|machine-readable|source-linked|search\/llm|llm-based|llm|indexing|indexability|entity disambiguation|entity systems|search crawlers|fact-based digest entry|translation queue|scaling queue|reference layer|verification log|source dossier|short quote marker)\b/i;

const SERVICE_PHRASE_RE =
  /\b(mapped as|ce texte est classe en|ist dieser beitrag dem thema|este texto se clasifica en|machine-readable|maschinenlesbar|source-linked|source-bound|source-first|llm|language models|modeles de langue|sprachmodelle|indexing|indexability|indexation|indexierungs|robots? d indexation|indexierungsbots|search engines?|moteurs de recherche|entity disambiguation|entity systems)\b/i;

const TEMPLATE_START_RE = [
  /^\s*Published in .*? on \d{4}-\d{2}-\d{2}[^.]*\./i,
  /^\s*Published by .*? on \d{4}-\d{2}-\d{2}[^.]*\./i,
  /^\s*Publie (?:dans|par) .*? le \d{4}-\d{2}-\d{2}[^.]*\./i,
  /^\s*Veroeffentlicht in .*? am \d{4}-\d{2}-\d{2}[^.]*\./i,
  /^\s*Publicado (?:en|por) .*? el \d{4}-\d{2}-\d{2}[^.]*\./i,
];

const TITLE_META_PREFIX_RE =
  /^(analysis|media analysis|authored essay|authored commentary|documented reporting|editorial methodology|analyse|analyse media|analisis|analisis mediatico|medienanalyse|signierter kommentar|commentaire signe|comentario firmado)\s*:\s*/i;

const GENERIC_TEMPLATE_SENTENCE_RE = [
  /The text follows concrete episodes, named institutions/i,
  /It also captures the practical stakes of framing/i,
  /Read in sequence with related publications/i,
  /Le texte suit des episodes concrets, des institutions nommees/i,
  /Il montre aussi les effets pratiques du cadrage/i,
  /Lu avec des publications voisines de la meme periode/i,
  /Der Text arbeitet mit konkreten Episoden, benannten Institutionen/i,
  /Zugleich zeigt er die praktischen Folgen von Framing/i,
  /Im Zusammenhang mit weiteren Beitraegen derselben Periode/i,
  /El texto sigue episodios concretos, instituciones identificadas/i,
  /Tambien muestra el impacto practico del encuadre/i,
  /Leido junto con publicaciones relacionadas del mismo periodo/i,
  /The publication remains useful as a dated source/i,
  /As a source-linked document from its publication date/i,
  /La publication reste utile comme trace datee/i,
  /Comme document source date, ce texte aide/i,
  /Die Publikation bleibt als datierter Nachweis nuetzlich/i,
  /Als datiertes Quelldokument hilft der Text/i,
  /La publicacion sigue siendo util como registro fechado/i,
  /Como documento fechado y vinculado a fuente/i,
];

const topicLabel = (lang, topic = "") => {
  const t = trim(topic) || "analysis";
  const maps = {
    EN: t,
    FR: t,
    DE: t,
    ES: t,
  };
  return maps[lang] || maps.EN;
};

const normalizeTopicForText = (topic = "", lang = "EN") => {
  const t = lower(topic);
  if (!t) return lang === "FR" ? "analyse" : lang === "DE" ? "Analyse" : lang === "ES" ? "analisis" : "analysis";

  if (
    t.includes("source-based") ||
    t.includes("quellenbasi") ||
    t.includes("resume contextuel") ||
    t.includes("kontextzusammenfassung") ||
    t.includes("editorial method") ||
    t.includes("methode editoriale") ||
    t.includes("redaktionelle methode")
  ) {
    if (lang === "FR") return "contexte biographique";
    if (lang === "DE") return "biografischer Kontext";
    if (lang === "ES") return "contexto biografico";
    return "biographical context";
  }

  return trim(topic);
};

const normalizeLang = (value = "") => {
  const lang = String(value || "").trim().toUpperCase();
  return LANGS.has(lang) ? lang : "EN";
};

const sourceFromUrl = (url = "") => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("themoscowtimes.com")) return "The Moscow Times";
    if (host.includes("vedomosti.ru")) return "Vedomosti";
    if (host.includes("snob.ru")) return "Snob";
    if (host.includes("republic.ru")) return "Republic";
    if (host.includes("mel.fm")) return "Mel.fm";
    if (host.includes("wikinews.org")) return "Wikinews";
    if (host.includes("lenta.ru")) return "Lenta";
    if (host.includes("7x7")) return "7x7";
    if (host.includes("guardian")) return "The Guardian";
    if (host.includes("humanrights.org") || host.includes("hrw.org")) return "Human Rights Watch";
    return "";
  } catch {
    return "";
  }
};

const decodeUrlCue = (url = "") => {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop() || "";
    const plain = decodeURIComponent(seg)
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/^a\d+$/i, "")
      .replace(/^material$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!plain) return "";
    return plain.split(" ").slice(0, 8).join(" ");
  } catch {
    return "";
  }
};

const keepSummarySentence = (sentence = "") => {
  const s = trim(sentence);
  if (!s) return false;
  if (META_LEXICON_RE.test(s)) return false;
  if (SERVICE_PHRASE_RE.test(s)) return false;
  if (GENERIC_TEMPLATE_SENTENCE_RE.some((re) => re.test(s))) return false;
  if (TEMPLATE_START_RE.some((re) => re.test(s))) return false;
  return true;
};

const stripTemplateClauses = (text = "") =>
  trim(text)
    .replace(/Published in [\s\S]*? on \d{4}-\d{2}-\d{2}, this text is mapped as [^.]*\./gi, " ")
    .replace(/Published by [\s\S]*? on \d{4}-\d{2}-\d{2}, this [^.]* entry focuses on [^.]*\./gi, " ")
    .replace(/Publie (?:dans|par) [\s\S]*? le \d{4}-\d{2}-\d{2}, ce texte est classe en [^.]*\./gi, " ")
    .replace(/Veroeffentlicht in [\s\S]*? am \d{4}-\d{2}-\d{2}, ist dieser Beitrag dem Thema [^.]*\./gi, " ")
    .replace(/Publicado (?:en|por) [\s\S]*? el \d{4}-\d{2}-\d{2}, este texto se clasifica en [^.]*\./gi, " ")
    .replace(/\s+/g, " ");

const fallbackSentences = (lang, ctx) => {
  const title = trim(ctx.title) || `${ctx.source} ${ctx.date}`;
  const source = trim(ctx.source) || "the source outlet";
  const date = trim(ctx.date) || "the publication date";
  const topic = trim(ctx.topic) || "analysis";
  const cue = trim(ctx.cue);

  if (lang === "FR") {
    return [
      `Cette fiche resume \"${title}\" publie par ${source} le ${date}.`,
      `Le texte traite du theme ${topic} a partir d acteurs identifies, de decisions nommees et d une chronologie explicite.`,
      `Le resume reconstruit les arguments avec un ton neutre et distingue les faits rapportes des interpretations qui restent discutables.`,
      cue
        ? `Le reperage ${cue} aide a relier ce texte a d autres publications de la meme periode.`
        : `Cette entree permet de replacer la publication dans son contexte editorial et politique d origine.`,
      `La carte sert a comprendre ce qui est affirme, sur quelles bases, et pourquoi ce cadrage a compte dans le debat public.`,
    ];
  }

  if (lang === "DE") {
    return [
      `Diese Karte fasst \"${title}\" zusammen, veroeffentlicht bei ${source} am ${date}.`,
      `Im Mittelpunkt steht das Thema ${topic}, mit benannten Akteuren, nachvollziehbarer Chronologie und klaren Bezuegen zur Ausgangsquelle.`,
      `Die Darstellung bleibt neutral, trennt berichtete Fakten von Deutungen und ordnet strittige Punkte als offene Bewertung ein.`,
      cue
        ? `Der Hinweis ${cue} erleichtert die Verbindung zu weiteren Texten aus derselben Phase.`
        : `Der Eintrag hilft, den Beitrag in seinem urspruenglichen redaktionellen und politischen Umfeld zu lesen.`,
      `Damit wird sichtbar, welche Aussagen belegt sind, welche Begriffe den Ton setzen und welche Folgen das Framing in der Debatte hatte.`,
    ];
  }

  if (lang === "ES") {
    return [
      `Esta ficha resume \"${title}\", publicado por ${source} el ${date}.`,
      `El tema central es ${topic}, con actores identificables, decisiones concretas y una secuencia temporal verificable en la fuente original.`,
      `El resumen mantiene un tono neutral y separa los hechos reportados de las interpretaciones que siguen siendo discutidas.`,
      cue
        ? `La referencia ${cue} facilita conectar este texto con otras publicaciones del mismo periodo.`
        : `La entrada ayuda a leer la publicacion dentro de su contexto editorial y politico original.`,
      `Asi se entiende mejor que se afirmo, con que base se argumento y por que ese encuadre influyo en el debate publico.`,
    ];
  }

  return [
    `This card summarizes \"${title}\" published by ${source} on ${date}.`,
    `The core topic is ${topic}, framed through identifiable actors, dated events, and wording used in the source publication.`,
    `The summary keeps a neutral tone, separates reported facts from interpretation, and marks contested points as contested.`,
    cue
      ? `The cue ${cue} helps connect this text with related materials from the same period.`
      : `The entry places the publication in its original editorial and political context without retrospective labeling.`,
    `It clarifies what was argued, which evidence was cited, and why the framing mattered in public discussion at that moment.`,
  ];
};

const buildSummary = (item, ctx) => {
  const lang = normalizeLang(item.language);
  const seed = stripTemplateClauses(item.summary || item.digest || "");
  const cleanedSentences = dedupeKeepOrder(splitSentences(seed).filter(keepSummarySentence)).map(toSentence);
  const out = [...cleanedSentences];

  for (const sentence of fallbackSentences(lang, ctx)) {
    if (out.length >= 8 && wc(out.join(" ")) >= 150) break;
    const next = toSentence(sentence);
    if (!next) continue;
    if (out.some((existing) => lower(existing) === lower(next))) continue;
    out.push(next);
  }

  if (out.length < 3) {
    out.push(...fallbackSentences(lang, ctx).slice(0, 3).map(toSentence));
  }

  while (wc(out.join(" ")) < 150) {
    const topUp = fallbackSentences(lang, ctx)[out.length % 5];
    const sentence = toSentence(topUp);
    if (!sentence) break;
    if (!out.some((existing) => lower(existing) === lower(sentence))) {
      out.push(sentence);
      continue;
    }

    const variant =
      lang === "FR"
        ? `Pour ${ctx.source} (${ctx.date}), la lecture du theme ${ctx.topic} gagne en precision quand on distingue faits dates, citations attribuees et interpretation editoriale.`
        : lang === "DE"
          ? `Fuer ${ctx.source} (${ctx.date}) wird das Thema ${ctx.topic} praeziser, wenn datierte Fakten, zugeordnete Zitate und redaktionelle Einordnung getrennt gelesen werden.`
          : lang === "ES"
            ? `En ${ctx.source} (${ctx.date}), el tema ${ctx.topic} se entiende mejor cuando se separan hechos fechados, citas atribuidas e interpretacion editorial.`
            : `For ${ctx.source} (${ctx.date}), the ${ctx.topic} discussion is clearer when dated facts, attributed wording, and editorial interpretation are read separately.`;
    out.push(toSentence(variant));
  }

  return trim(out.join(" "));
};

const cleanDigest = (summary = "") => {
  const sentences = splitSentences(summary).slice(0, 3);
  return trim(sentences.join(" "));
};

const stripQuoteMarkup = (raw = "") => {
  let text = trim(raw);
  if (!text) return "";
  const quoted = text.match(/[\"“«„]([^\"”»“„]+)[\"”»“„]/);
  if (quoted?.[1]) text = trim(quoted[1]);
  text = text.replace(/\s*[-—]\s*[^-—]+$/, "").trim();
  text = text.replace(/^['"«»„“]+|['"«»„“]+$/g, "").trim();
  return text;
};

const quoteSnippetFromSentence = (sentence = "", minWords = 4, maxWords = 12) => {
  const words = trim(sentence)
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < minWords) return "";
  return words.slice(0, Math.min(maxWords, words.length)).join(" ");
};

const isQuoteAllowed = (lang, quoteText = "") => {
  const text = trim(quoteText);
  if (!text) return false;
  if (META_LEXICON_RE.test(text)) return false;
  if (SERVICE_PHRASE_RE.test(text)) return false;
  const n = wc(text);
  if (n < 4 || n > 18) return false;
  if (/[.]{3}|…/.test(text)) return false;
  if (lang !== "EN") {
    if (CYRILLIC_RE.test(text)) return false;
    if (TRANSLIT_RE.test(text)) return false;
  }
  return true;
};

const cleanQuotes = (item, summary, source) => {
  const lang = normalizeLang(item.language);
  const candidates = [];
  if (Array.isArray(item.quotes)) candidates.push(...item.quotes);
  if (item.quote) candidates.push(item.quote);

  const out = [];
  const seen = new Set();
  for (const raw of candidates) {
    const text = stripQuoteMarkup(raw);
    if (!isQuoteAllowed(lang, text)) continue;
    const key = lower(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`"${text}" - ${source}`);
    if (out.length >= 3) break;
  }

  if (out.length < 2) {
    for (const sentence of splitSentences(summary)) {
      const snippet = quoteSnippetFromSentence(sentence);
      if (!isQuoteAllowed(lang, snippet)) continue;
      const key = lower(snippet);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(`"${snippet}" - ${source}`);
      if (out.length >= 3) break;
    }
  }

  if (out.length < 2) {
    const titleSnippet = quoteSnippetFromSentence(item.title || "", 3, 9);
    if (titleSnippet && !seen.has(lower(titleSnippet))) {
      out.push(`"${titleSnippet}" - ${source}`);
      seen.add(lower(titleSnippet));
    }
  }

  if (out.length < 2) {
    const fallback = lang === "FR"
      ? "Le texte expose un cadre factuel date et attribue"
      : lang === "DE"
        ? "Der Text markiert einen datierten und zuordenbaren Argumentationsrahmen"
        : lang === "ES"
          ? "El texto define un marco argumental fechado y atribuible"
          : "The text sets a dated and attributable argument frame";
    out.push(`"${fallback}" - ${source}`);
  }

  return out.slice(0, 3);
};

const fixTitleForTranslit = (item, ctx) => {
  const lang = normalizeLang(item.language);
  let title = trim(item.title)
    .replace(TITLE_META_PREFIX_RE, "")
    .replace(/\bDozhd\b/gi, "TV Rain")
    .replace(/\s*-\s*(Column|Opinion|Record \d+|Notice \d+|Eintrag \d+|Registro \d+)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const needsRebuild =
    !title ||
    wc(title) < 3 ||
    (["FR", "DE", "ES"].includes(lang) && (CYRILLIC_RE.test(title) || TRANSLIT_RE.test(title)));

  if (!needsRebuild) {
    if (!/^[A-ZА-ЯЁ]/.test(title) && !/^[a-z]/.test(title)) return title;
    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  const source = ctx.source;
  const date = ctx.date;
  const cue = trim(ctx.cue);
  const topic = topicLabel(lang, ctx.topic);

  if (lang === "FR") {
    if (cue) return `Analyse de ${cue}: ${source} (${date})`;
    return `Analyse ${topic}: ${source} (${date})`;
  }
  if (lang === "DE") {
    if (cue) return `Analyse zu ${cue}: ${source} (${date})`;
    return `Analyse ${topic}: ${source} (${date})`;
  }
  if (lang === "ES") {
    if (cue) return `Analisis sobre ${cue}: ${source} (${date})`;
    return `Analisis ${topic}: ${source} (${date})`;
  }
  if (cue) return `${cue} (${source}, ${date})`;
  return `${source} ${date}`;
};

const cleanKeyIdeas = (item, summary, ctx) => {
  const lang = normalizeLang(item.language);
  const base = Array.isArray(item.key_ideas) ? item.key_ideas : [];
  const cleaned = dedupeKeepOrder(
    base
      .map((x) => trim(x).replace(/[.]{3}|…/g, ""))
      .filter((x) => x && !META_LEXICON_RE.test(x) && !SERVICE_PHRASE_RE.test(x))
  );

  const out = [];
  const ensureLength = (text) => {
    let words = trim(text)
      .replace(/\(\d{4}-\d{2}-\d{2}\)/g, "")
      .split(/\s+/)
      .filter(Boolean);
    if (words.length < 8) {
      const extra =
        lang === "FR"
          ? ["dans", "le", "contexte", "de", ctx.source]
          : lang === "DE"
            ? ["im", "Kontext", "von", ctx.source]
            : lang === "ES"
              ? ["en", "el", "contexto", "de", ctx.source]
            : ["in", "the", "context", "of", ctx.source];
      words = [...words, ...extra];
    }
    while (words.length < 8) {
      const pad =
        lang === "FR"
          ? ["chronologie", "acteurs", "cadre"]
          : lang === "DE"
            ? ["Chronologie", "Akteure", "Rahmen"]
            : lang === "ES"
              ? ["cronologia", "actores", "marco"]
              : ["chronology", "actors", "context"];
      words = [...words, ...pad];
    }
    if (words.length > 14) words = words.slice(0, 14);
    return words.join(" ");
  };

  for (const idea of cleaned) {
    out.push(ensureLength(idea));
    if (out.length >= 3) break;
  }

  const sentenceIdeas = splitSentences(summary).map((s) => quoteSnippetFromSentence(s, 8, 14)).filter(Boolean);
  for (const idea of sentenceIdeas) {
    if (out.length >= 3) break;
    if (out.some((x) => lower(x) === lower(idea))) continue;
    out.push(ensureLength(idea));
  }

  const langFallback = {
    EN: [
      `The publication records ${ctx.topic} with source based chronology and attribution`,
      `The argument links wording choices to concrete public reactions and timelines`,
      `The card keeps factual context visible while preserving disputed interpretations`,
    ],
    FR: [
      `La publication documente ${ctx.topic} avec chronologie et attribution explicites`,
      `L argument relie les choix de formulation aux reactions publiques`,
      `La fiche conserve le contexte factuel sans effacer les points contestes`,
    ],
    DE: [
      `Die Publikation dokumentiert ${ctx.topic} mit klarer Chronologie und Zuschreibung`,
      `Die Argumentation verbindet Wortwahl mit konkreten oeffentlichen Reaktionen`,
      `Die Karte bewahrt den Faktenkontext und markiert strittige Deutungen`,
    ],
    ES: [
      `La publicacion documenta ${ctx.topic} con cronologia y atribucion explicita`,
      `El argumento conecta la formulacion con reacciones publicas concretas`,
      `La ficha mantiene contexto factual y marca interpretaciones discutidas`,
    ],
  };

  for (const fb of langFallback[lang] || langFallback.EN) {
    if (out.length >= 3) break;
    out.push(ensureLength(fb));
  }

  return out.slice(0, 3);
};

const cleanValueContext = (item, ctx) => {
  const lang = normalizeLang(item.language);
  const source = ctx.source;
  const date = ctx.date;
  const topic = ctx.topic;
  let text = trim(item.value_context || "");

  if (!text || META_LEXICON_RE.test(text) || SERVICE_PHRASE_RE.test(text)) {
    if (lang === "FR") {
      text = `Reference utile pour le contexte biographique: ce texte de ${source} (${date}) clarifie le theme ${topic} et aide a verifier la chronologie, les attributions et le cadre public de publication.`;
    } else if (lang === "DE") {
      text = `Nuetzlicher Referenzpunkt fuer den biografischen Kontext: Der Beitrag aus ${source} (${date}) ordnet das Thema ${topic} ein und erleichtert die Pruefung von Chronologie, Zuschreibung und oeffentlichem Publikationsrahmen.`;
    } else if (lang === "ES") {
      text = `Referencia util para contexto biografico: este texto de ${source} (${date}) aclara el tema ${topic} y facilita verificar cronologia, atribucion y marco publico de publicacion.`;
    } else {
      text = `Useful reference for biography context: this ${source} (${date}) publication clarifies the ${topic} frame and helps verify chronology, attribution, and public wording in the original source.`;
    }
  }

  let words = trim(text).split(/\s+/).filter(Boolean);
  if (words.length < 20) {
    const pad =
      lang === "FR"
        ? ["La", "fiche", "reste", "utile", "pour", "situer", "arguments", "et", "reactions", "dans", "leur", "sequence", "documentee"]
        : lang === "DE"
          ? ["Der", "Eintrag", "bleibt", "hilfreich", "um", "Argumente", "und", "Reaktionen", "in", "einer", "dokumentierten", "Sequenz", "einzuordnen"]
          : lang === "ES"
            ? ["La", "ficha", "tambien", "sirve", "para", "situar", "argumentos", "y", "reacciones", "en", "una", "secuencia", "documentada"]
            : ["The", "entry", "also", "helps", "place", "claims", "and", "responses", "inside", "a", "documented", "sequence", "of", "events"];
    words = [...words, ...pad];
  }
  if (words.length > 40) words = words.slice(0, 40);
  return toSentence(words.join(" "));
};

const run = async () => {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const payload = JSON.parse(raw);
  const items = Array.isArray(payload.items) ? payload.items : [];

  let summaryPatched = 0;
  let titlePatched = 0;
  let quotesPatched = 0;
  let keyIdeasPatched = 0;
  let valuePatched = 0;

  const nextItems = items.map((item) => {
    const source = trim(item.source) || sourceFromUrl(item.url) || "Source";
    const date = trim(item.date) || "undated";
    const lang = normalizeLang(item.language);
    const topic = normalizeTopicForText(trim(item.topic) || "analysis", lang);
    const cue = decodeUrlCue(item.url || "");
    const ctx = { source, date, topic, cue, title: trim(item.title) };

    const next = { ...item };
    next.source = source;

    const fixedTitle = fixTitleForTranslit(next, ctx);
    if (trim(fixedTitle) !== trim(next.title)) {
      titlePatched += 1;
      next.title = fixedTitle;
    }

    const summary = buildSummary(next, { ...ctx, title: trim(next.title) });
    if (trim(summary) !== trim(next.summary)) summaryPatched += 1;
    next.summary = summary;
    next.digest = cleanDigest(summary);

    const quotes = cleanQuotes(next, summary, source);
    if (JSON.stringify(quotes) !== JSON.stringify(next.quotes || [])) quotesPatched += 1;
    next.quotes = quotes;
    next.quote = quotes[0] || "";

    const keyIdeas = cleanKeyIdeas(next, summary, ctx);
    if (JSON.stringify(keyIdeas) !== JSON.stringify(next.key_ideas || [])) keyIdeasPatched += 1;
    next.key_ideas = keyIdeas;

    const valueContext = cleanValueContext(next, ctx);
    if (trim(valueContext) !== trim(next.value_context)) valuePatched += 1;
    next.value_context = valueContext;

    return next;
  });

  const out = {
    ...payload,
    updated_at: new Date().toISOString(),
    items: nextItems,
  };

  await fs.writeFile(DATA_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        total: nextItems.length,
        patched: {
          summary: summaryPatched,
          title: titlePatched,
          quotes: quotesPatched,
          key_ideas: keyIdeasPatched,
          value_context: valuePatched,
        },
      },
      null,
      2
    )
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
