import interviews from "/data/interviews-data.js";
import {
  localizeInterviewItem,
  matchesFormatFilter,
} from "/interviews/interviews-localize.js";

const SECTION_ORDER = ["interviews", "features", "archive"];
const uiLang = String(document?.documentElement?.lang || "en").trim().slice(0, 2).toLowerCase();
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

const INTERVIEW_EMOJI_POOL = [
  "🎙️", "🎧", "🎥", "📺", "📻", "📚", "📖", "🗞️", "📰", "🗣️",
  "💬", "🌍", "🌐", "🧭", "🧠", "🔎", "📡", "🎞️", "🧩", "📝",
  "📌", "🧾", "🎚️", "🎛️", "🎤", "📣", "🛰️", "⏳", "⌛", "🔬",
  "⚖️", "🛡️", "🏛️", "💡", "🔭", "📊", "📈", "📉", "🧵", "🪶",
  "🧪", "🧬", "🗂️", "📁", "🪄", "✨", "⭐", "🌊", "🌤️", "🌙"
];

const sectionNodes = new Map();
const template = document.getElementById("interviewCardTemplate");

for (const section of SECTION_ORDER) {
  const node = document.querySelector(`.interviews-grid[data-section="${section}"]`);
  if (node) sectionNodes.set(section, node);
}

const preparedItems = interviews
  .map((item, index) => ({
    ...localizeInterviewItem(item, uiLang),
    id: `interview-${index + 1}`,
    ts: parseDateToTimestamp(item.date),
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
  return matchesFormatFilter(item, state.format);
}

function filterItems(items, section) {
  return items.filter((item) => {
    if (item.section !== section) return false;
    if (!matchesFormat(item)) return false;
    return true;
  });
}

function pickUniqueEmoji(candidates, used, seed = 0) {
  for (const emoji of candidates) {
    if (emoji && !used.has(emoji)) return emoji;
  }

  for (const emoji of INTERVIEW_EMOJI_POOL) {
    if (!used.has(emoji)) return emoji;
  }

  const len = INTERVIEW_EMOJI_POOL.length || 1;
  for (let i = 0; i < len * len; i += 1) {
    const first = INTERVIEW_EMOJI_POOL[(seed + i) % len];
    const second = INTERVIEW_EMOJI_POOL[(seed * 5 + i * 3) % len];
    const pair = `${first}${second}`;
    if (!used.has(pair)) return pair;
  }

  return "✨";
}

function emojiCandidates(item) {
  const format = String(item?.formatLabel || "").toLowerCase();
  const section = String(item?.section || "").toLowerCase();
  const language = String(item?.languageLabel || "").toLowerCase();
  const blob = [item?.title, item?.description, item?.formatLabel].map((v) => String(v || "").toLowerCase()).join(" ");

  if (/\bpodcast\b/.test(format) || /\bpodcast\b/.test(blob)) {
    return ["🎙️", "🎧", "📻", "💬"];
  }
  if (/\bvideo\b/.test(format) || /\byoutube|broadcast|talk\b/.test(blob)) {
    return ["🎥", "📺", "🎞️", "📡"];
  }
  if (/\btext\b/.test(format) || /\binterview|feature|essay\b/.test(blob)) {
    return ["📰", "🗞️", "📝", "📖"];
  }
  if (/\bnabokov|book|reading|literature\b/.test(blob)) {
    return ["📚", "📖", "🧠", "🔎"];
  }
  if (section === "features" || /\benglish\b/.test(language)) {
    return ["🌍", "🌐", "🧭", "🗞️"];
  }
  if (section === "archive") {
    return ["🧾", "⌛", "⏳", "🔎"];
  }

  return ["💬", "🧠", "🧭", "📰"];
}

function buildEmojiMap(items) {
  const map = new Map();
  const used = new Set();

  items.forEach((item, index) => {
    const key = String(item?.id || item?.url || `row-${index}`);
    const emoji = pickUniqueEmoji(emojiCandidates(item), used, index);
    map.set(key, emoji);
    used.add(emoji);
  });

  return map;
}

function render() {
  const visibleItems = preparedItems.filter((item) => matchesFormat(item));
  const emojiById = buildEmojiMap(visibleItems);

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
      fragment.appendChild(renderCard(item, emojiById));
    }
    container.appendChild(fragment);
  }
}

function renderCard(item, emojiById) {
  const node = template.content.firstElementChild.cloneNode(true);

  const dateNode = node.querySelector(".chip-date");
  const langNode = node.querySelector(".chip-lang");
  const formatNode = node.querySelector(".chip-format");

  dateNode.textContent = formatDisplayDate(item.date);
  dateNode.setAttribute("content", normalizeIsoDate(item.date));
  langNode.textContent = item.languageLabel;
  formatNode.textContent = item.formatLabel;

  const titleLink = node.querySelector(".interview-title-link");
  titleLink.href = item.url;
  const emoji = emojiById?.get(String(item?.id || item?.url || ""));
  titleLink.textContent = emoji ? `${emoji} ${item.title}` : item.title;
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
  const visibleItems = preparedItems;
  const canonical =
    document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "https://www.klishin.work/interviews/";
  const itemListId = `${canonical}#itemlist`;
  const websiteId = "https://www.klishin.work/#website";
  const personId = "https://www.klishin.work/#person";
  const listElements = visibleItems.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "CreativeWork",
      "@id": `${canonical}#interview-${index + 1}`,
      name: item.title,
      inLanguage: String(item.language || uiLang).slice(0, 2).toLowerCase(),
      datePublished: normalizeIsoDate(item.date) || undefined,
      url: item.url,
      description: item.description,
      author: { "@id": personId },
      isBasedOn: item.url
    }
  }));

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "ItemList",
          "@id": itemListId,
          name: ACTIVE_COPY.listName,
          itemListOrder: "https://schema.org/ItemListOrderDescending",
          numberOfItems: listElements.length,
          itemListElement: listElements,
          isPartOf: { "@id": websiteId },
          about: { "@id": personId }
        }
      ]
    },
    null,
    2
  );

  document.head.appendChild(script);
}
