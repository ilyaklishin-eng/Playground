import interviews from "/data/interviews-data.js";

const SECTION_ORDER = ["interviews", "features", "archive"];
const uiLang = String(document?.documentElement?.lang || "en").trim().slice(0, 2).toLowerCase();
const CONTENT_LANG_BY_PAGE = {
  en: "en",
  fr: "fr",
  de: "de",
  es: "es",
};
const COPY = {
  en: {
    empty: "No materials match the current filters.",
    listName: "Interviews and materials with Ilia Klishin",
    open: "Open material ->",
  },
  fr: {
    empty: "Aucun contenu ne correspond aux filtres actuels.",
    listName: "Entretiens et interventions avec Ilia Klishin",
    open: "Ouvrir le contenu ->",
  },
  de: {
    empty: "Keine Eintraege entsprechen den aktuellen Filtern.",
    listName: "Interviews und Beitraege mit Ilia Klishin",
    open: "Material offnen ->",
  },
  es: {
    empty: "No hay materiales que coincidan con los filtros actuales.",
    listName: "Entrevistas y participaciones con Ilia Klishin",
    open: "Abrir material ->",
  },
};
const ACTIVE_COPY = COPY[uiLang] || COPY.en;

const state = {
  format: "all"
};

const sectionNodes = new Map();
const template = document.getElementById("interviewCardTemplate");

for (const section of SECTION_ORDER) {
  const node = document.querySelector(`.interviews-grid[data-section="${section}"]`);
  if (node) sectionNodes.set(section, node);
}

const preparedItems = interviews
  .map((item, index) => ({
    ...item,
    id: `interview-${index + 1}`,
    ts: parseDateToTimestamp(item.date),
    languageCode: normalizeLanguageCode(item.language),
  }))
  .sort((a, b) => {
    if (b.ts !== a.ts) return b.ts - a.ts;
    return String(a.title).localeCompare(String(b.title), uiLang);
  });

bindFilters();
render();
injectStructuredData();

function parseDateToTimestamp(raw) {
  const value = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    const date = new Date(`${value}-01T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  if (/^\d{4}$/.test(value)) {
    return Date.parse(`${value}-01-01T00:00:00Z`) || 0;
  }
  const range = value.match(/^(\d{4})-(\d{4})$/);
  if (range) {
    return Date.parse(`${range[2]}-01-01T00:00:00Z`) || 0;
  }
  const looseYear = value.match(/(\d{4})/);
  if (looseYear) {
    return Date.parse(`${looseYear[1]}-01-01T00:00:00Z`) || 0;
  }
  return 0;
}

function formatDisplayDate(raw) {
  const value = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(uiLang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    const date = new Date(`${value}-01T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(uiLang, { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  }
  if (/^\d{4}$/.test(value)) return value;
  const range = value.match(/^(\d{4})-(\d{4})$/);
  if (range) return `${range[1]}/${range[2]}`;
  return value;
}

function normalizeLanguageCode(value = "") {
  const language = String(value || "").trim().toLowerCase();
  if (language.includes("english")) return "en";
  if (language.includes("french")) return "fr";
  if (language.includes("german") || language.includes("deutsch")) return "de";
  if (language.includes("spanish")) return "es";
  return "ru";
}

function matchesPageLanguage(item) {
  const expected = CONTENT_LANG_BY_PAGE[uiLang];
  if (!expected) return true;
  return item.languageCode === expected;
}

function bindFilters() {
  document.querySelectorAll(".filter-btn[data-format]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.format;
      if (!value || state.format === value) return;
      state.format = value;
      updateFormatButtons();
      render();
    });
  });
}

function updateFormatButtons() {
  document.querySelectorAll(".filter-btn[data-format]").forEach((button) => {
    const active = button.dataset.format === state.format;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function matchesFormat(item) {
  if (state.format === "all") return true;
  const value = String(item.format || "").toLowerCase();

  if (state.format === "text") {
    return value.includes("text") || value.includes("feature");
  }
  if (state.format === "video") {
    return value.includes("video");
  }
  if (state.format === "podcasts") {
    return value.includes("podcast");
  }
  return true;
}

function filterItems(items, section) {
  return items.filter((item) => {
    if (item.section !== section) return false;
    if (!matchesPageLanguage(item)) return false;
    if (!matchesFormat(item)) return false;
    return true;
  });
}

function render() {
  for (const section of SECTION_ORDER) {
    const container = sectionNodes.get(section);
    if (!container) continue;

    const items = filterItems(preparedItems, section);
    container.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "interview-empty";
      empty.textContent = ACTIVE_COPY.empty;
      container.appendChild(empty);
      continue;
    }

    const fragment = document.createDocumentFragment();
    for (const item of items) {
      fragment.appendChild(renderCard(item));
    }
    container.appendChild(fragment);
  }
}

function renderCard(item) {
  const node = template.content.firstElementChild.cloneNode(true);

  const dateNode = node.querySelector(".chip-date");
  const langNode = node.querySelector(".chip-lang");
  const formatNode = node.querySelector(".chip-format");

  dateNode.textContent = formatDisplayDate(item.date);
  dateNode.setAttribute("content", normalizeIsoDate(item.date));
  langNode.textContent = item.language;
  formatNode.textContent = item.format;

  const titleLink = node.querySelector(".interview-title-link");
  titleLink.href = item.url;
  titleLink.textContent = item.title;
  titleLink.setAttribute("itemprop", "name");

  const descriptionNode = node.querySelector(".interview-description");
  descriptionNode.textContent = item.description;

  const urlNode = node.querySelector(".interview-url");
  urlNode.href = item.url;
  urlNode.textContent = item.url;

  const openNode = node.querySelector(".interview-open");
  openNode.href = item.url;
  openNode.textContent = ACTIVE_COPY.open;

  return node;
}

function normalizeIsoDate(raw) {
  const value = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  const year = value.match(/\d{4}/)?.[0] || "";
  return year ? `${year}-01-01` : "";
}

function injectStructuredData() {
  const visibleItems = preparedItems.filter((item) => matchesPageLanguage(item));
  const listElements = visibleItems.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "CreativeWork",
      name: item.title,
      inLanguage: item.languageCode,
      datePublished: normalizeIsoDate(item.date) || undefined,
      url: item.url,
      description: item.description
    }
  }));

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: ACTIVE_COPY.listName,
    itemListElement: listElements
  });

  document.head.appendChild(script);
}
