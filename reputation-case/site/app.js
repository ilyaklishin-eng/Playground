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

function summaryPreview(text) {
  const plain = String(text || "").replace(/\s+/g, " ").trim();
  if (!plain) return "";

  // Strip repeated technical scaffolding so preview starts with article substance.
  const stripped = plain
    .replace(
      /^This\s+.+?\s+piece\s+\(\d{4}-\d{2}-\d{2}\)\s+examines\s+a\s+concrete\s+case\s+related\s+to\s+Ilia\s+Klishin\s+and\s+situates\s+the\s+stakes\s+of\s+.+?\.\s*/i,
      ""
    )
    .replace(
      /^In\s+this\s+\d{4}-\d{2}-\d{2}\s+.+?\s+article,\s+the\s+central\s+argument\s+is\s+how\s+/i,
      ""
    )
    .replace(/\s*In the \d{4}-\d{2}-\d{2} context, Ilia Klishin connects.+$/i, "")
    .replace(/^(?:[A-Z][a-z]{2,9}\.?\s*)?\d{1,2},\s+\d{4}\s+/i, "")
    .trim();

  const source = stripped || plain;
  const sentenceMatches = source.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  const sentences = Array.isArray(sentenceMatches)
    ? sentenceMatches.map((sentence) => sentence.trim()).filter(Boolean)
    : [source];

  const twoSentences = sentences.slice(0, 2).join(" ").trim();
  if (!twoSentences) return "";
  const promoteSentenceCase = (value) =>
    String(value || "").replace(/^[a-z]/, (c) => c.toUpperCase());
  if (twoSentences.length <= 320) return promoteSentenceCase(twoSentences);
  const first = sentences[0] || "";
  const clipped =
    first.length <= 320 ? first.trim() : first.slice(0, 320).replace(/\s+\S*$/, "").trim();
  return promoteSentenceCase(clipped);
}

init();

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function isPublished(item) {
  return normalizeStatus(item?.status) === "ready";
}

function publishedCounts() {
  return state.publishedItems.reduce(
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
    langSwitch
      .querySelectorAll(".lang-btn")
      .forEach((node) => node.classList.toggle("active", node === button));
    render();
  });

  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });
}

function render() {
  const filtered = state.publishedItems.filter((item) => {
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

    node.querySelector(".card-title").textContent = item.title;
    node.querySelector(".card-meta").textContent = `${item.source} • ${item.date} • ${item.topic}`;
    node.querySelector(".card-digest").textContent = summaryPreview(item.summary || item.digest);

    const quoteCandidates = Array.isArray(item.quotes) && item.quotes.length > 0
      ? item.quotes
      : [item.quote].filter(Boolean);
    node.querySelector(".card-quote").textContent = quoteCandidates[0] || "";

    const link = node.querySelector(".card-link");
    link.href = item.url;
    link.textContent = t("cardLink");

    fragment.appendChild(node);
  }

  grid.appendChild(fragment);
}
