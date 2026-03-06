const grid = document.getElementById("digestGrid");
const template = document.getElementById("cardTemplate");
const stats = document.getElementById("stats");
const updatedAt = document.getElementById("updatedAt");
const langSwitch = document.getElementById("langSwitch");
const searchInput = document.getElementById("searchInput");
const LANGUAGE_PRIORITY = ["EN", "FR", "DE", "ES"];

const state = {
  lang: "ALL",
  query: "",
  items: [],
};

function wordsPreview(text, maxWords = 38) {
  const tokens = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= maxWords) return tokens.join(" ");
  return `${tokens.slice(0, maxWords).join(" ")}...`;
}

init();

async function init() {
  const response = await fetch("./data/digests.json", { cache: "no-store" });
  const payload = await response.json();
  state.items = payload.items;
  updatedAt.textContent = payload.updated_at || "-";
  renderLanguageSwitch();
  bindEvents();
  render();
}

function bindEvents() {
  langSwitch.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-lang]");
    if (!button) return;
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
  const filtered = state.items.filter((item) => {
    const langMatch = state.lang === "ALL" || item.language === state.lang;
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

  renderStats();
  renderGrid(filtered);
}

function getOrderedLanguages() {
  const seen = new Set(state.items.map((item) => String(item.language || "").toUpperCase()).filter(Boolean));
  const extra = [...seen]
    .filter((lang) => !LANGUAGE_PRIORITY.includes(lang))
    .sort((a, b) => a.localeCompare(b));
  return [...LANGUAGE_PRIORITY, ...extra];
}

function renderLanguageSwitch() {
  const languages = getOrderedLanguages();
  const allowed = new Set(["ALL", ...languages]);
  if (!allowed.has(state.lang)) state.lang = "ALL";

  langSwitch.innerHTML = "";
  const options = ["ALL", ...languages];
  for (const lang of options) {
    const button = document.createElement("button");
    button.className = `lang-btn${state.lang === lang ? " active" : ""}`;
    button.type = "button";
    button.dataset.lang = lang;
    button.textContent = lang === "ALL" ? "All" : lang;
    langSwitch.appendChild(button);
  }
}

function renderStats() {
  const counts = state.items.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.language] = (acc[item.language] || 0) + 1;
      return acc;
    },
    { total: 0 }
  );

  stats.innerHTML = "";
  const labels = [`Total: ${counts.total}`];
  for (const lang of getOrderedLanguages()) {
    labels.push(`${lang}: ${counts[lang] || 0}`);
  }
  for (const text of labels) {
    const pill = document.createElement("span");
    pill.className = "stat-pill";
    pill.textContent = text;
    stats.appendChild(pill);
  }
}

function renderGrid(items) {
  grid.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No items match the current filter.";
    grid.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const node = template.content.firstElementChild.cloneNode(true);

    node.querySelector(".lang-tag").textContent = item.language;

    const statusTag = node.querySelector(".status-tag");
    statusTag.textContent = item.status;
    statusTag.dataset.status = item.status;

    node.querySelector(".card-title").textContent = item.title;
    node.querySelector(".card-meta").textContent = `${item.source} • ${item.date} • ${item.topic}`;
    node.querySelector(".card-digest").textContent = wordsPreview(item.summary || item.digest, 38);

    const quoteCandidates = Array.isArray(item.quotes) && item.quotes.length > 0
      ? item.quotes
      : [item.quote].filter(Boolean);
    node.querySelector(".card-quote").textContent = quoteCandidates[0] || "";

    const link = node.querySelector(".card-link");
    link.href = item.url;

    fragment.appendChild(node);
  }

  grid.appendChild(fragment);
}
