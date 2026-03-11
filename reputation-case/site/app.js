const grid = document.getElementById("digestGrid");
const showcase = document.getElementById("digestShowcase");
const moreWorkHead = document.getElementById("moreWorkHead");
const template = document.getElementById("cardTemplate");
const updatedAt = document.getElementById("updatedAt");
const langSwitch = document.getElementById("langSwitch");
const searchInput = document.getElementById("searchInput");
const uiLang = String(document?.documentElement?.lang || "en").trim().toLowerCase();
const preferredFeedLang = String(document?.body?.dataset?.feedLang || "").trim().toUpperCase();
const LANGUAGE_PRIORITY = ["EN", "FR", "DE", "ES"];
const PAGE_LANG_TO_FEED = { en: "EN", fr: "FR", de: "DE", es: "ES" };
const lockedFeedLang = PAGE_LANG_TO_FEED[uiLang] || null;
const SHOWCASE_PINNED_IDS = {
  EN: ["en-009", "en-002", "en-108"],
};
const SHOWCASE_MAX_ITEMS = 12;
const ADDITIONAL_GRID_LIMIT = 9;
const UI_COPY = {
  en: {
    cardLink: "Read article",
    emptyFiltered: "No published cards match the current filter.",
    emptyLanguage: "No published cards are available in {lang} yet.",
    langTitlePublished: "{count} published cards",
    langTitleEmpty: "No published cards in {lang} yet",
  },
  fr: {
    cardLink: "Lire l article",
    emptyFiltered: "Aucune fiche publiee ne correspond au filtre actuel.",
    emptyLanguage: "Aucune fiche publiee n'est disponible en {lang} pour le moment.",
    langTitlePublished: "{count} fiches publiees",
    langTitleEmpty: "Aucune fiche publiee en {lang} pour le moment",
  },
  de: {
    cardLink: "Artikel lesen",
    emptyFiltered: "Keine veroffentlichten Karten entsprechen dem aktuellen Filter.",
    emptyLanguage: "Noch keine veroffentlichten Karten in {lang} verfugbar.",
    langTitlePublished: "{count} veroffentlichte Karten",
    langTitleEmpty: "Noch keine veroffentlichten Karten in {lang}",
  },
  es: {
    cardLink: "Leer articulo",
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
  lang: lockedFeedLang || (LANGUAGE_PRIORITY.includes(preferredFeedLang) ? preferredFeedLang : "EN"),
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
    .replace(/\bThe narrative avoids reductive labels[^.]*\./gi, "")
    .replace(/\bSo readers can separate reported facts from interpretation[^.]*\./gi, "")
    .replace(/\bInstead of categorical labeling[^.]*\./gi, "")
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

function humanSummaryPreview(item, options = {}) {
  const maxSentences = Number.isFinite(options.maxSentences) ? options.maxSentences : 2;
  const maxLength = Number.isFinite(options.maxLength) ? options.maxLength : 220;
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
    if (selected.length >= maxSentences && total + lengthWithGap > maxLength) break;
    if (selected.length >= maxSentences) break;
    selected.push(sentence);
    total += lengthWithGap;
  }

  let preview = selected.join(" ").trim();
  if (!preview) preview = source[0] || "";
  if (preview.length > maxLength) {
    preview = preview.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
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

function isReference(item) {
  const topic = String(item?.topic || "").toLowerCase();
  const title = String(item?.title || "").toLowerCase();
  const explicit = String(item?.content_class || "").toLowerCase();
  if (explicit === "reference") return true;
  if (
    /\b(editorial standard|professional profile|profil professionnel|berufsprofil|profil auteur|source-based summary|public profile|public speaking(?: history)?|offentliche rede|oratoria publica|parcours de prise de parole|institutional citation|reference institutionnelle|institutionelle referenz|documented reporting|parcours professionnel documente|dokumentierter berufsverlauf)\b/.test(
      topic
    )
  ) {
    return true;
  }
  if (
    /\b(author page|autorenprofil|profil d auteur|mirror domain|canonical variant|ted talk video reference|speaker profile|how this archive is built|methodology)\b/.test(
      title
    )
  ) {
    return true;
  }
  return false;
}

function cardActionLabel(item) {
  const title = String(item?.title || "").toLowerCase();
  const source = String(item?.source || "").toLowerCase();
  const topic = String(item?.topic || "").toLowerCase();
  const url = String(item?.url || "").toLowerCase();
  const isVideo =
    /\b(video|talk)\b/.test(title) ||
    /\b(youtube|tedx)\b/.test(source) ||
    /\bpublic speaking\b/.test(topic) ||
    /youtube\.com|youtu\.be|ted\.com/.test(url);
  if (isVideo) return uiLang === "fr" ? "Regarder la video" : uiLang === "de" ? "Video ansehen" : uiLang === "es" ? "Ver video" : "Watch video";
  if (isReference(item)) return uiLang === "fr" ? "Ouvrir la source" : uiLang === "de" ? "Quelle offnen" : uiLang === "es" ? "Abrir fuente" : "Open source";
  return t("cardLink");
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
  state.publishedItems = state.items.filter((item) => isPublished(item) && !isReference(item));
  updatedAt.textContent = payload.updated_at || "-";
  renderLanguageSwitch();
  bindEvents();
  bindCardInteractions(showcase);
  bindCardInteractions(grid);
  render();
}

function bindEvents() {
  if (langSwitch && !lockedFeedLang) {
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
  }

  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      render();
    });
  }
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
      item.digest || item.summary,
      item.language,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(state.query);
  });

  const sorted = filtered
    .slice()
    .sort((a, b) => {
      const aTs = Date.parse(String(a?.date || ""));
      const bTs = Date.parse(String(b?.date || ""));
      const safeA = Number.isNaN(aTs) ? 0 : aTs;
      const safeB = Number.isNaN(bTs) ? 0 : bTs;
      if (safeB !== safeA) return safeB - safeA;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });

  const pinnedIds = SHOWCASE_PINNED_IDS[state.lang] || [];
  const pinnedRank = new Map(pinnedIds.map((id, index) => [id, index]));
  const curated = sorted
    .sort((a, b) => {
      const rankA = pinnedRank.has(String(a?.id || "")) ? pinnedRank.get(String(a?.id || "")) : Number.POSITIVE_INFINITY;
      const rankB = pinnedRank.has(String(b?.id || "")) ? pinnedRank.get(String(b?.id || "")) : Number.POSITIVE_INFINITY;
      if (rankA !== rankB) return rankA - rankB;
      return 0;
    })
    .slice(0, SHOWCASE_MAX_ITEMS);

  const featured = curated.slice(0, 1);
  const supporting = curated.slice(1, 3);
  const additional = curated.slice(3, 3 + ADDITIONAL_GRID_LIMIT);

  renderShowcase(featured, supporting);
  renderGrid(additional, { showEmpty: curated.length === 0 });
  if (moreWorkHead) moreWorkHead.hidden = additional.length === 0;
  if (grid) grid.hidden = additional.length === 0 && curated.length > 0;
}

function getOrderedLanguages() {
  if (lockedFeedLang) return [lockedFeedLang];
  const seen = new Set(state.items.map((item) => String(item.language || "").toUpperCase()).filter(Boolean));
  const extra = [...seen]
    .filter((lang) => !LANGUAGE_PRIORITY.includes(lang))
    .sort((a, b) => a.localeCompare(b));
  return [...LANGUAGE_PRIORITY, ...extra];
}

function renderLanguageSwitch() {
  if (!langSwitch) return;
  const languages = getOrderedLanguages().filter((lang) => LANGUAGE_PRIORITY.includes(lang));
  const counts = publishedCounts();
  const defaultLang = lockedFeedLang || (languages.includes("EN") ? "EN" : languages[0] || "EN");
  if (!languages.includes(state.lang)) {
    state.lang = defaultLang;
  }
  if (lockedFeedLang) {
    state.lang = lockedFeedLang;
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
    button.setAttribute("aria-controls", "digestShowcase digestGrid");
    button.setAttribute("aria-label", `Show ${lang} cards`);
    button.title =
      count === 0 ? t("langTitleEmpty", { lang }) : t("langTitlePublished", { count, lang });
    langSwitch.appendChild(button);
  }
}

function renderShowcase(featuredItems, supportingItems) {
  if (!showcase) return;
  showcase.innerHTML = "";

  if (!featuredItems.length && !supportingItems.length) return;

  const fragment = document.createDocumentFragment();
  const featured = featuredItems[0];
  if (featured) {
    fragment.appendChild(createCardNode(featured, "featured"));
  }

  if (supportingItems.length) {
    const stack = document.createElement("div");
    stack.className = "supporting-stack";
    for (const item of supportingItems) {
      stack.appendChild(createCardNode(item, "supporting"));
    }
    fragment.appendChild(stack);
  }

  showcase.appendChild(fragment);
}

function renderGrid(items, options = {}) {
  const showEmpty = Boolean(options.showEmpty);
  grid.innerHTML = "";

  if (!items.length) {
    if (!showEmpty) return;
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
  for (const item of items) fragment.appendChild(createCardNode(item, "standard"));

  grid.appendChild(fragment);
}

function createCardNode(item, variant) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.classList.add(`card-${variant}`, "card-clickable");
  node.dataset.url = item.url;
  node.setAttribute("role", "link");
  node.setAttribute("tabindex", "0");
  node.setAttribute("aria-label", `${cleanDisplayTitle(item.title)} — ${composeCardMeta(item)}`);

  node.querySelector(".lang-tag").textContent = item.language;

  const titleNode = node.querySelector(".card-title");
  const titleLink = document.createElement("a");
  titleLink.href = item.url;
  titleLink.className = "card-title-link";
  titleLink.textContent = cleanDisplayTitle(item.title);
  titleNode.textContent = "";
  titleNode.appendChild(titleLink);

  node.querySelector(".card-meta").textContent = composeCardMeta(item);
  node.querySelector(".card-digest").textContent = humanSummaryPreview(item, {
    maxSentences: variant === "featured" ? 3 : 2,
    maxLength: variant === "featured" ? 300 : 205,
  });

  const quoteNode = node.querySelector(".card-quote");
  const quoteText = variant === "featured" ? pickCardQuote(item) : "";
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

  return node;
}

function bindCardInteractions(container) {
  if (!container || container.dataset.cardInteractionsBound === "1") return;
  container.dataset.cardInteractionsBound = "1";

  container.addEventListener("click", (event) => {
    const card = event.target.closest(".card-clickable");
    if (!card || !container.contains(card)) return;
    if (event.target.closest("a,button,input,label")) return;
    const href = card.dataset.url;
    if (href) window.location.href = href;
  });

  container.addEventListener("keydown", (event) => {
    const card = event.target.closest(".card-clickable");
    if (!card || !container.contains(card)) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const href = card.dataset.url;
    if (href) window.location.href = href;
  });
}
