const grid = document.getElementById("digestGrid");
const template = document.getElementById("cardTemplate");
const updatedAt = document.getElementById("updatedAt");
const langSwitch = document.getElementById("langSwitch");
const searchInput = document.getElementById("searchInput");
const uiLang = String(document?.documentElement?.lang || "en").trim().toLowerCase();
const preferredFeedLang = String(document?.body?.dataset?.feedLang || "").trim().toUpperCase();
const LANGUAGE_PRIORITY = ["EN", "FR", "DE", "ES"];
const CURATED_FEED_LIMIT = 8;
const UI_COPY = {
  en: {
    cardLink: "Read full card",
    emptyFiltered: "No published cards match the current filter.",
    emptyLanguage: "No published cards are available in {lang} yet.",
    langTitlePublished: "{count} published cards",
    langTitleEmpty: "No published cards in {lang} yet",
  },
  fr: {
    cardLink: "Lire la fiche complete",
    emptyFiltered: "Aucune fiche publiee ne correspond au filtre actuel.",
    emptyLanguage: "Aucune fiche publiee n'est disponible en {lang} pour le moment.",
    langTitlePublished: "{count} fiches publiees",
    langTitleEmpty: "Aucune fiche publiee en {lang} pour le moment",
  },
  de: {
    cardLink: "Vollstandige Karte lesen",
    emptyFiltered: "Keine veroffentlichten Karten entsprechen dem aktuellen Filter.",
    emptyLanguage: "Noch keine veroffentlichten Karten in {lang} verfugbar.",
    langTitlePublished: "{count} veroffentlichte Karten",
    langTitleEmpty: "Noch keine veroffentlichten Karten in {lang}",
  },
  es: {
    cardLink: "Leer ficha completa",
    emptyFiltered: "No hay fichas publicadas que coincidan con el filtro actual.",
    emptyLanguage: "Todavia no hay fichas publicadas en {lang}.",
    langTitlePublished: "{count} fichas publicadas",
    langTitleEmpty: "Todavia no hay fichas publicadas en {lang}",
  },
};

const MACHINE_FRAGMENT_PATTERNS = [
  /\bmapped as\b/i,
  /\bmachine[- ]?readable\b/i,
  /\bsource[- ]?linked\b/i,
  /\bentity disambiguation\b/i,
  /\bsearch\/llm\/indexing\b/i,
  /\bllm\b/i,
  /\bindexing\b/i,
  /\bthis page structures the topic\b/i,
  /\bit structures the topic\b/i,
  /\bthis card is valuable for timeline checks\b/i,
  /\bas a dated source from\b/i,
  /\bhelps verify chronology actors\b/i,
  /\bcausal framing\b/i,
  /\bmultilingual materials\b/i,
  /\bpublic records\b/i,
  /\battributable sourcing\b/i,
  /\bnamed actors\b/i,
  /\bdated events\b/i,
  /\bpublication context\b/i,
  /\bcontrole de timeline\b/i,
  /\btimeline pruefung\b/i,
  /\bchronologie akteure\b/i,
  /\bkausalbezuge\b/i,
];

function cleanDisplayTitle(rawTitle) {
  const raw = normalizeText(rawTitle);
  if (!raw) return "Untitled";
  const cleaned = raw
    .replace(/\s+\(\d{4}-\d{2}-\d{2}\)\s*$/i, "")
    .replace(/^(.{3,120}?)\s*\(\d{4}-\d{2}-\d{2}\)\s*-\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || raw;
}

function composeCardMeta(item) {
  const source = normalizeText(item?.source || "-");
  const date = normalizeText(item?.date || "-");
  return `${source} • ${date}`;
}

function isShowcaseCandidate(item) {
  const title = normalizeText(item?.title || "");
  const source = normalizeText(item?.source || "").toLowerCase();
  const topic = normalizeText(item?.topic || "").toLowerCase();
  if (!title) return false;
  if (/\(\d{4}-\d{2}-\d{2}\)\s*$/i.test(title)) return false;
  if (source === "methodology") return false;
  if (topic.includes("editorial standard")) return false;
  return true;
}

const state = {
  lang: LANGUAGE_PRIORITY.includes(preferredFeedLang) ? preferredFeedLang : "EN",
  query: "",
  items: [],
  publishedItems: [],
};

function t(key, vars = {}) {
  const copy = UI_COPY[uiLang] || UI_COPY.en;
  const templateText = String(copy[key] || UI_COPY.en[key] || "");
  return templateText.replace(/\{([a-z_]+)\}/gi, (_, token) =>
    Object.prototype.hasOwnProperty.call(vars, token) ? String(vars[token]) : ""
  );
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripLeadScaffolding(text) {
  return normalizeText(text)
    .replace(
      /^This\s+.+?\s+piece\s+\(\d{4}-\d{2}-\d{2}\)\s+examines\s+a\s+concrete\s+case\s+related\s+to\s+Ilia\s+Klishin\s+and\s+situates\s+the\s+stakes\s+of\s+.+?\.\s*/i,
      ""
    )
    .replace(
      /^In\s+this\s+\d{4}-\d{2}-\d{2}\s+.+?\s+article,\s+the\s+central\s+argument\s+is\s+how\s+/i,
      ""
    )
    .replace(/^Published in .+? this text is mapped as .+?\.\s*/i, "")
    .replace(/^Publie par .+? le \d{4}-\d{2}-\d{2},\s*/i, "")
    .replace(/^Dieser Beitrag in .+? \(\d{4}-\d{2}-\d{2}\)\s+untersucht.+?\.\s*/i, "")
    .replace(/\s*In the \d{4}-\d{2}-\d{2} context, Ilia Klishin connects.+$/i, "")
    .replace(/^(?:[A-Z][a-z]{2,9}\.?\s*)?\d{1,2},\s+\d{4}\s+/i, "")
    .trim();
}

function splitSentences(text) {
  const matches = String(text || "").match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!Array.isArray(matches)) return [];
  return matches
    .map((sentence) =>
      sentence
        .replace(/^(?:[A-Z][a-z]{2,9}\.?\s*)?\d{1,2},\s+\d{4}\s+/, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

function hasMachineFragments(sentence) {
  const value = String(sentence || "").trim();
  if (!value) return true;
  return MACHINE_FRAGMENT_PATTERNS.some((pattern) => pattern.test(value));
}

function hashText(value) {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function humanSummaryPreview(item) {
  const raw = normalizeText(item?.summary || item?.digest || "");
  if (!raw) return "";
  const cleaned = stripLeadScaffolding(raw) || raw;
  const candidates = splitSentences(cleaned).filter((sentence) => !hasMachineFragments(sentence));
  const source = candidates.length > 0 ? candidates : [];
  if (source.length === 0) return fallbackSummary(item);

  const selected = [];
  let total = 0;
  for (const sentence of source) {
    const lengthWithGap = sentence.length + (selected.length > 0 ? 1 : 0);
    if (selected.length >= 2 && total + lengthWithGap > 360) break;
    if (selected.length >= 3) break;
    selected.push(sentence);
    total += lengthWithGap;
  }

  let preview = selected.join(" ").trim();
  if (!preview) preview = source[0] || "";
  if (preview.length > 380) {
    preview = preview.slice(0, 380).replace(/\s+\S*$/, "").trim();
  }
  if (!/[.!?]$/.test(preview)) preview += ".";
  return preview.replace(/^[a-z]/, (char) => char.toUpperCase());
}

function fallbackSummary(item) {
  const topic = normalizeText(item?.topic || "the topic");
  const source = normalizeText(item?.source || "the source");
  const year = /^\d{4}/.test(String(item?.date || "")) ? String(item.date).slice(0, 4) : "";
  const lang = String(item?.language || "").toUpperCase();
  if (lang === "FR") {
    return `Ce texte de ${source}${year ? ` (${year})` : ""} explique l enjeu principal autour de ${topic} et resitue le contexte de publication.`;
  }
  if (lang === "DE") {
    return `Der Beitrag aus ${source}${year ? ` (${year})` : ""} erklaert den Kernpunkt zu ${topic} und ordnet den Publikationskontext ein.`;
  }
  if (lang === "ES") {
    return `Este texto de ${source}${year ? ` (${year})` : ""} explica la idea central sobre ${topic} y ubica su contexto de publicacion.`;
  }
  return `This piece from ${source}${year ? ` (${year})` : ""} explains the central issue in ${topic} and anchors it in publication context.`;
}

function fallbackContext(item) {
  const topic = normalizeText(item?.topic || "the topic");
  const source = normalizeText(item?.source || "the source");
  const year = /^\d{4}/.test(String(item?.date || "")) ? String(item.date).slice(0, 4) : "";
  const key = hashText(item?.id || `${topic}-${source}`);
  const stamp = year ? ` (${year})` : "";
  const lang = String(item?.language || "").toUpperCase();
  if (lang === "FR") {
    const variants = [
      `Repere utile: ce texte situe ${topic} dans son contexte editorial${stamp}.`,
      `Repere utile: la fiche resume ${topic} et renvoie au texte original sur ${source}.`,
      `Repere utile: cette publication donne un point de reference date sur ${topic}.`,
      `Repere utile: le lecteur retrouve ${topic} avec une source primaire verifiable.`,
    ];
    return variants[key % variants.length];
  }
  if (lang === "DE") {
    const variants = [
      `Nuetzlicher Kontext: Der Beitrag ordnet ${topic} im Zeitrahmen${stamp} ein.`,
      `Nuetzlicher Kontext: Die Karte fasst ${topic} zusammen und verlinkt auf ${source}.`,
      `Nuetzlicher Kontext: Diese Quelle bietet einen datierten Referenzpunkt zu ${topic}.`,
      `Nuetzlicher Kontext: ${topic} wird mit direktem Zugang zur Primaerquelle erklaert.`,
    ];
    return variants[key % variants.length];
  }
  if (lang === "ES") {
    const variants = [
      `Contexto util: el texto ubica ${topic} en su momento editorial${stamp}.`,
      `Contexto util: esta ficha resume ${topic} y enlaza al original en ${source}.`,
      `Contexto util: ofrece un punto de referencia fechado para ${topic}.`,
      `Contexto util: explica ${topic} con acceso directo a la fuente primaria.`,
    ];
    return variants[key % variants.length];
  }
  const variants = [
    `Why it matters: it places ${topic} in a concrete editorial moment${stamp}.`,
    `Why it matters: it gives a dated reference point for ${topic} and links to ${source}.`,
    `Why it matters: it helps compare current claims on ${topic} with the original text.`,
    `Why it matters: it explains ${topic} with direct access to the primary source.`,
  ];
  return variants[key % variants.length];
}

function humanContextPreview(item) {
  const raw = normalizeText(item?.value_context || "");
  if (!raw) return fallbackContext(item);

  const cleaned = stripLeadScaffolding(raw) || raw;
  const candidates = splitSentences(cleaned).filter((sentence) => !hasMachineFragments(sentence));
  let context = candidates[0] || "";
  if (!context || context.length < 36) context = fallbackContext(item);
  if (context.length > 200) {
    context = context.slice(0, 200).replace(/\s+\S*$/, "").trim();
    if (!/[.!?]$/.test(context)) context += ".";
  }
  return context;
}

function pickCardQuote(item) {
  const candidates =
    Array.isArray(item?.quotes) && item.quotes.length > 0
      ? item.quotes
      : [item?.quote].filter(Boolean);
  for (const raw of candidates) {
    const value = normalizeText(raw);
    if (!value) continue;
    if (hasMachineFragments(value)) continue;
    const quoteCore = value
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .replace(/\s*[-–—]\s*[^-–—]+$/g, "")
      .trim();
    const quoteComparable = quoteCore.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const titleComparable = String(item?.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (quoteComparable && titleComparable) {
      const shorter = Math.min(quoteComparable.length, titleComparable.length);
      const longer = Math.max(quoteComparable.length, titleComparable.length);
      const mostlySame = shorter > 10 && longer > 0 && shorter / longer >= 0.8;
      if (
        quoteComparable === titleComparable ||
        (mostlySame && (quoteComparable.includes(titleComparable) || titleComparable.includes(quoteComparable)))
      ) {
        continue;
      }
    }
    return value;
  }
  return "";
}

init();

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function isPublished(item) {
  return normalizeStatus(item?.status) === "ready";
}

function publishedCounts() {
  return state.publishedItems
    .filter((item) => isShowcaseCandidate(item))
    .reduce(
    (acc, item) => {
      const lang = String(item?.language || "").toUpperCase();
      if (!lang) return acc;
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    },
    {}
    );
}

async function init() {
  const response = await fetch("/data/digests.json", { cache: "no-store" });
  const payload = await response.json();
  state.items = payload.items;
  state.publishedItems = state.items.filter(isPublished);
  updatedAt.textContent = payload.updated_at || "-";
  renderLanguageSwitch();
  bindEvents();
  render();
}

function bindEvents() {
  langSwitch.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-lang]");
    if (!button || button.disabled) return;
    state.lang = button.dataset.lang;
    langSwitch.querySelectorAll(".lang-btn").forEach((node) => {
      const isActive = node === button;
      node.classList.toggle("active", isActive);
      node.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    render();
  });

  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });
}

function render() {
  const filtered = state.publishedItems.filter((item) => {
    if (!isShowcaseCandidate(item)) return false;
    const langMatch = item.language === state.lang;
    if (!langMatch) return false;
    if (!state.query) return true;

    const haystack = [
      item.title,
      item.source,
      item.topic,
      item.digest,
      item.language,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(state.query);
  });

  const curated = filtered
    .slice()
    .sort((a, b) => {
      const aTs = Date.parse(String(a?.date || ""));
      const bTs = Date.parse(String(b?.date || ""));
      const safeA = Number.isNaN(aTs) ? 0 : aTs;
      const safeB = Number.isNaN(bTs) ? 0 : bTs;
      if (safeB !== safeA) return safeB - safeA;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    })
    .slice(0, CURATED_FEED_LIMIT);

  renderGrid(curated);
}

function getOrderedLanguages() {
  const seen = new Set(state.items.map((item) => String(item.language || "").toUpperCase()).filter(Boolean));
  const extra = [...seen]
    .filter((lang) => !LANGUAGE_PRIORITY.includes(lang))
    .sort((a, b) => a.localeCompare(b));
  return [...LANGUAGE_PRIORITY, ...extra];
}

function renderLanguageSwitch() {
  const languages = getOrderedLanguages().filter((lang) => LANGUAGE_PRIORITY.includes(lang));
  const counts = publishedCounts();
  const defaultLang = languages.includes("EN") ? "EN" : languages[0] || "EN";
  if (!languages.includes(state.lang)) {
    state.lang = defaultLang;
  }

  langSwitch.innerHTML = "";
  for (const lang of languages) {
    const count = counts[lang] || 0;
    const button = document.createElement("button");
    button.className = `lang-btn${state.lang === lang ? " active" : ""}`;
    button.type = "button";
    button.dataset.lang = lang;
    button.textContent = lang;
    button.setAttribute("aria-pressed", state.lang === lang ? "true" : "false");
    button.setAttribute("aria-controls", "digestGrid");
    button.setAttribute("aria-label", `Show ${lang} cards`);
    button.title =
      count === 0 ? t("langTitleEmpty", { lang }) : t("langTitlePublished", { count, lang });
    langSwitch.appendChild(button);
  }
}

function renderGrid(items) {
  grid.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    if (state.query) {
      empty.textContent = t("emptyFiltered");
    } else {
      empty.textContent = t("emptyLanguage", { lang: state.lang });
    }
    grid.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const node = template.content.firstElementChild.cloneNode(true);

    node.querySelector(".lang-tag").textContent = item.language;

    node.querySelector(".card-title").textContent = cleanDisplayTitle(item.title);
    node.querySelector(".card-meta").textContent = composeCardMeta(item);
    node.querySelector(".card-digest").textContent = humanSummaryPreview(item);
    const contextNode = node.querySelector(".card-context");
    if (contextNode) {
      contextNode.textContent = humanContextPreview(item);
    }

    const quoteText = pickCardQuote(item);
    const quoteNode = node.querySelector(".card-quote");
    if (quoteText) {
      quoteNode.textContent = quoteText;
      quoteNode.hidden = false;
    } else {
      quoteNode.textContent = "";
      quoteNode.hidden = true;
    }

    const link = node.querySelector(".card-link");
    link.href = item.url;
    link.textContent = t("cardLink");

    fragment.appendChild(node);
  }

  grid.appendChild(fragment);
}
