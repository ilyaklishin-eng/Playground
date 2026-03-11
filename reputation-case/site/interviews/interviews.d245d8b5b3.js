import interviews from "/data/interviews-data.js";

const SECTION_ORDER = ["interviews", "features", "archive"];

const state = {
  format: "all",
  language: "all"
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
    ts: parseDateToTimestamp(item.date)
  }))
  .sort((a, b) => {
    if (b.ts !== a.ts) return b.ts - a.ts;
    return String(a.title).localeCompare(String(b.title), "ru");
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

  document.querySelectorAll(".filter-btn[data-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.lang;
      if (!value) return;
      state.language = state.language === value ? "all" : value;
      updateLanguageButtons();
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

function updateLanguageButtons() {
  document.querySelectorAll(".filter-btn[data-lang]").forEach((button) => {
    const active = button.dataset.lang === state.language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function matchesFormat(item) {
  if (state.format === "all") return true;
  const value = String(item.format || "").toLowerCase();

  if (state.format === "text") {
    return value.includes("текст") || value.includes("feature");
  }
  if (state.format === "video") {
    return value.includes("видео");
  }
  if (state.format === "podcasts") {
    return value.includes("подкаст");
  }
  return true;
}

function matchesLanguage(item) {
  if (state.language === "all") return true;
  if (state.language === "ru") return item.language === "Русский";
  if (state.language === "en") return item.language === "English";
  return true;
}

function filterItems(items, section) {
  return items.filter((item) => {
    if (item.section !== section) return false;
    if (!matchesFormat(item)) return false;
    if (!matchesLanguage(item)) return false;
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
      empty.textContent = "По текущим фильтрам материалов нет.";
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

  dateNode.textContent = item.displayDate;
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
  const listElements = preparedItems.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "CreativeWork",
      name: item.title,
      inLanguage: item.language === "English" ? "en" : "ru",
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
    name: "Интервью и материалы с участием Ильи Клишина",
    itemListElement: listElements
  });

  document.head.appendChild(script);
}
