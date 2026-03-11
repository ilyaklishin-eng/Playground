const searchInput = document.getElementById("siteSearchInput");
const filterGroup = document.getElementById("languageFilter");
const searchHint = document.getElementById("searchHint");
const searchSummary = document.getElementById("searchSummary");
const searchResults = document.getElementById("searchResults");

const MAX_RESULTS = 40;
const state = {
  items: [],
  query: "",
  lang: "ALL",
};

const normalizeText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

const parseDateScore = (value = "") => {
  const ts = Date.parse(String(value || ""));
  return Number.isNaN(ts) ? 0 : ts;
};

const normalizeLang = (value = "") => {
  const lang = String(value || "").trim().toUpperCase();
  return ["EN", "FR", "DE", "ES"].includes(lang) ? lang : "EN";
};

const toQueryTokens = (query = "") =>
  normalizeText(query)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);

const searchableBlob = (item = {}) => {
  const fields = [
    item.title,
    item.summary,
    item.context,
    item.topic,
    item.source,
    item.section,
    ...(Array.isArray(item.semantic_tags) ? item.semantic_tags : []),
  ];
  return normalizeText(fields.filter(Boolean).join(" ")).toLowerCase();
};

const scoreItem = (item, tokens, phrase = "") => {
  const title = normalizeText(item.title).toLowerCase();
  const summary = normalizeText(item.summary).toLowerCase();
  const context = normalizeText(item.context).toLowerCase();
  const topic = normalizeText(item.topic).toLowerCase();
  const source = normalizeText(item.source).toLowerCase();
  const blob = searchableBlob(item);

  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 8;
    if (summary.includes(token)) score += 5;
    if (context.includes(token)) score += 3;
    if (topic.includes(token)) score += 2;
    if (source.includes(token)) score += 2;
    if (blob.includes(token)) score += 1;
  }

  if (phrase && title.includes(phrase)) score += 8;
  if (phrase && summary.includes(phrase)) score += 5;

  return score;
};

const byBestFirst = (a, b) => {
  const scoreDelta = Number(b.score || 0) - Number(a.score || 0);
  if (scoreDelta !== 0) return scoreDelta;
  const dateDelta = parseDateScore(b.item?.date) - parseDateScore(a.item?.date);
  if (dateDelta !== 0) return dateDelta;
  return normalizeText(a.item?.id).localeCompare(normalizeText(b.item?.id));
};

const byRecentFirst = (a, b) => {
  const dateDelta = parseDateScore(b?.date) - parseDateScore(a?.date);
  if (dateDelta !== 0) return dateDelta;
  return normalizeText(a?.id).localeCompare(normalizeText(b?.id));
};

const uiBadge = (item = {}) => {
  if (item.type === "selected") return "Selected";
  return "Post";
};

const formatMeta = (item = {}) => {
  const source = normalizeText(item.source || "-");
  const date = normalizeText(item.date || "-");
  const topic = normalizeText(item.topic || "");
  return topic ? `${source} • ${date} • ${topic}` : `${source} • ${date}`;
};

const setHint = (text) => {
  searchHint.textContent = text;
};

const setSummary = (text) => {
  searchSummary.textContent = text;
};

const renderEmpty = (message) => {
  searchResults.innerHTML = `<article class="search-empty">${message}</article>`;
};

const renderCards = (cards) => {
  searchResults.innerHTML = cards
    .map(({ item }) => {
      const title = normalizeText(item.title || "Untitled");
      const summary = normalizeText(item.summary || "");
      const context = normalizeText(item.context || "");
      const meta = formatMeta(item);
      const url = normalizeText(item.url || "#");
      const sourceUrl = normalizeText(item.source_url || "");
      const language = normalizeLang(item.language);
      const badge = uiBadge(item);

      return `<article class="result-card">
        <div class="result-head">
          <span class="result-badge">${language}</span>
          <span class="result-badge">${badge}</span>
        </div>
        <h2><a href="${url}">${title}</a></h2>
        <p class="result-meta">${meta}</p>
        ${summary ? `<p class="result-summary">${summary}</p>` : ""}
        ${context ? `<p class="result-context">${context}</p>` : ""}
        <p class="result-links">
          <a href="${url}">Open card</a>
          ${sourceUrl ? `<a href="${sourceUrl}" rel="noreferrer" target="_blank">Open original source</a>` : ""}
        </p>
      </article>`;
    })
    .join("\n");
};

const applyQueryStateToUrl = () => {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.lang !== "ALL") params.set("lang", state.lang.toLowerCase());
  const next = params.toString();
  const target = next ? `${window.location.pathname}?${next}` : window.location.pathname;
  window.history.replaceState({}, "", target);
};

const passesLanguage = (item = {}) => {
  if (state.lang === "ALL") return true;
  return normalizeLang(item.language) === state.lang;
};

const isPublicItem = (item = {}) => {
  if (item.type === "selected") return true;
  return String(item.status || "ready").trim().toLowerCase() === "ready";
};

const computeResults = () => {
  const all = state.items.filter((item) => isPublicItem(item) && passesLanguage(item));
  const query = normalizeText(state.query);
  if (!query) {
    return all.sort(byRecentFirst).slice(0, MAX_RESULTS).map((item) => ({ item, score: 0 }));
  }

  const tokens = toQueryTokens(query);
  if (tokens.length === 0) return [];
  const phrase = query.toLowerCase();

  return all
    .map((item) => ({ item, score: scoreItem(item, tokens, phrase) }))
    .filter((entry) => entry.score > 0)
    .sort(byBestFirst)
    .slice(0, MAX_RESULTS);
};

const render = () => {
  const results = computeResults();
  const query = normalizeText(state.query);
  const langLabel = state.lang === "ALL" ? "all languages" : state.lang;

  if (query) {
    setSummary(`${results.length} result${results.length === 1 ? "" : "s"} for "${query}" in ${langLabel}.`);
  } else {
    setSummary(`Showing ${results.length} latest items in ${langLabel}.`);
  }

  if (results.length === 0) {
    renderEmpty(query ? "No published items match this query." : "No published items available yet.");
  } else {
    renderCards(results);
  }

  applyQueryStateToUrl();
};

const setActiveLanguage = (lang) => {
  state.lang = lang;
  const buttons = [...filterGroup.querySelectorAll("button[data-lang]")];
  for (const button of buttons) {
    const active = String(button.dataset.lang || "") === lang;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
};

const initStateFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  state.query = normalizeText(params.get("q") || "");

  const langParam = String(params.get("lang") || "").trim().toUpperCase();
  if (["EN", "FR", "DE", "ES"].includes(langParam)) {
    state.lang = langParam;
  }

  searchInput.value = state.query;
  setActiveLanguage(state.lang);
};

const bindEvents = () => {
  searchInput.addEventListener("input", () => {
    state.query = normalizeText(searchInput.value);
    render();
  });

  filterGroup.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-lang]");
    if (!button) return;
    const lang = String(button.dataset.lang || "ALL").toUpperCase();
    setActiveLanguage(lang);
    render();
  });
};

const init = async () => {
  setHint("Loading search index...");

  try {
    const response = await fetch("/data/search-index.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`search-index fetch failed (${response.status})`);

    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.items = items;
    setHint(`Index ready: ${items.length} items.`);

    initStateFromUrl();
    bindEvents();
    render();
  } catch (error) {
    console.error(error);
    setHint("Search index is temporarily unavailable.");
    setSummary("");
    renderEmpty("Unable to load search data right now. Please try again in a minute.");
  }
};

init();
