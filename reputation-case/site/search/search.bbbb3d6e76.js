const searchInput = document.getElementById("siteSearchInput");
const searchControls = document.getElementById("searchControls");
const filterGroup = document.getElementById("languageFilter");
const searchHint = document.getElementById("searchHint");
const searchSummary = document.getElementById("searchSummary");
const searchResults = document.getElementById("searchResults");
const searchBrowseFallback = document.getElementById("searchBrowseFallback");

const MAX_RESULTS = 40;
const SUPPORTED_LOCALES = ["en", "fr", "de", "es"];
const SUPPORTED_LANGS = SUPPORTED_LOCALES.map((locale) => locale.toUpperCase());
const SEARCH_MANIFEST_PATH = "/data/search-index.json";

const state = {
  items: [],
  itemsByLocale: new Map(),
  manifest: null,
  query: "",
  lang: "ALL",
  ui: "loading",
};

const UI_STATE = Object.freeze({
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
});

const normalizeText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();
const normalizeLocale = (value = "") => {
  const locale = String(value || "").trim().toLowerCase().slice(0, 2);
  return SUPPORTED_LOCALES.includes(locale) ? locale : "en";
};
const normalizeLang = (value = "") => {
  const lang = String(value || "").trim().toUpperCase();
  return SUPPORTED_LANGS.includes(lang) ? lang : "EN";
};
const localeToLang = (value = "") => normalizeLocale(value).toUpperCase();
const localePriority = (value = "") => {
  const index = SUPPORTED_LANGS.indexOf(normalizeLang(value));
  return index >= 0 ? index : SUPPORTED_LANGS.length;
};

const parseDateScore = (value = "") => {
  const ts = Date.parse(String(value || ""));
  return Number.isNaN(ts) ? 0 : ts;
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
    item.material_type,
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
  const localeDelta = localePriority(a.item?.language || a.item?.locale) - localePriority(b.item?.language || b.item?.locale);
  if (localeDelta !== 0) return localeDelta;
  return normalizeText(a.item?.id).localeCompare(normalizeText(b.item?.id));
};

const byRecentFirst = (a, b) => {
  const dateDelta = parseDateScore(b?.date) - parseDateScore(a?.date);
  if (dateDelta !== 0) return dateDelta;
  const localeDelta = localePriority(a?.language || a?.locale) - localePriority(b?.language || b?.locale);
  if (localeDelta !== 0) return localeDelta;
  return normalizeText(a?.id).localeCompare(normalizeText(b?.id));
};

const uiBadge = (item = {}) => {
  if (item.type === "selected") return "Selected";
  if (item.type === "interview") return "Interview";
  return "Post";
};

const formatMeta = (item = {}) => {
  const source = normalizeText(item.source || "-");
  const date = normalizeText(item.display_date || item.date || "-");
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

const renderBrowseFallback = (message = "") => {
  searchResults.innerHTML = `<article class="search-fallback">
    <h2>Browse published sections</h2>
    <p>${message || "Search is unavailable right now. Use these public indexes instead."}</p>
    <ul class="search-fallback-links">
      <li><a href="/selected/">Selected Work</a></li>
      <li><a href="/interviews/">Interviews</a></li>
      <li><a href="/posts/">Posts</a></li>
      <li><a href="/bio/">Bio</a></li>
    </ul>
  </article>`;
};

const renderCards = (cards) => {
  searchResults.innerHTML = cards
    .map(({ item }) => {
      const title = normalizeText(item.title || "Untitled");
      const summary = normalizeText(item.summary || "").replace(
        /\b(entry added to include|the summary gives a clear reference point for later comparisons|useful reference card|this (?:card|entry|piece) is included as|it is included as|keep this as|source record|external analytical reference|institutional context source)\b[^.]*\.?/gi,
        ""
      ).trim();
      const context = normalizeText(item.context || "");
      const meta = formatMeta(item);
      const url = normalizeText(item.url || "#");
      const sourceUrl = normalizeText(item.source_url || "");
      const language = normalizeLang(item.language || item.locale);
      const badge = uiBadge(item);
      const primaryLabel = item.type === "interview" ? "Open material" : "Open card";
      const showSourceLink = sourceUrl && sourceUrl !== url;

      return `<article class="result-card">
        <div class="result-head">
          <span class="result-badge">${language}</span>
          <span class="result-badge">${badge}</span>
        </div>
        <h2><a href="${url}"${item.type === "interview" ? ' target="_blank" rel="noopener noreferrer"' : ""}>${title}</a></h2>
        <p class="result-meta">${meta}</p>
        ${summary ? `<p class="result-summary">${summary}</p>` : ""}
        ${context ? `<p class="result-context">${context}</p>` : ""}
        <p class="result-links">
          <a href="${url}"${item.type === "interview" ? ' rel="noreferrer noopener" target="_blank"' : ""}>${primaryLabel}</a>
          ${showSourceLink ? `<a href="${sourceUrl}" rel="noreferrer noopener" target="_blank">Open original source</a>` : ""}
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
  return normalizeLang(item.language || item.locale) === state.lang;
};

const isPublicItem = (item = {}) => {
  const status = String(item?.status || "").trim().toLowerCase();
  const surface = String(item?.surface || "").trim().toLowerCase();
  return status === "published" && surface === "public";
};

const dedupeByContentId = (entries = [], getItem = (entry) => entry) => {
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    const item = getItem(entry) || {};
    const key = normalizeText(item.content_id || item.id);
    if (!key) {
      out.push(entry);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
};

const computeResults = () => {
  const all = state.items.filter((item) => isPublicItem(item) && passesLanguage(item));
  const query = normalizeText(state.query);
  if (!query) {
    return dedupeByContentId(all.sort(byRecentFirst))
      .slice(0, MAX_RESULTS)
      .map((item) => ({ item, score: 0 }));
  }

  const tokens = toQueryTokens(query);
  if (tokens.length === 0) return [];
  const phrase = query.toLowerCase();

  return dedupeByContentId(
    all
    .map((item) => ({ item, score: scoreItem(item, tokens, phrase) }))
    .filter((entry) => entry.score > 0)
    .sort(byBestFirst),
    (entry) => entry.item
  ).slice(0, MAX_RESULTS);
};

const render = () => {
  const results = computeResults();
  const query = normalizeText(state.query);
  const langLabel = state.lang === "ALL" ? "all locales" : state.lang;

  if (query) {
    setSummary(`${results.length} result${results.length === 1 ? "" : "s"} for "${query}" in ${langLabel}.`);
  } else {
    setSummary(`Showing ${results.length} latest published items in ${langLabel}.`);
  }

  if (results.length === 0) {
    renderEmpty(query ? "No published items match this query." : "No published items available for this language yet.");
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

const setFilterDisabled = (disabled) => {
  const buttons = [...filterGroup.querySelectorAll("button[data-lang]")];
  for (const button of buttons) {
    button.disabled = disabled;
    button.setAttribute("aria-disabled", disabled ? "true" : "false");
  }
};

const setLanguageAvailability = (counts = new Map()) => {
  const buttons = [...filterGroup.querySelectorAll("button[data-lang]")];
  for (const button of buttons) {
    const lang = String(button.dataset.lang || "ALL").toUpperCase();
    if (lang === "ALL") {
      const total = [...counts.values()].reduce((sum, value) => sum + Number(value || 0), 0);
      const disabled = total <= 0;
      button.disabled = disabled;
      button.setAttribute("aria-disabled", disabled ? "true" : "false");
      continue;
    }
    const disabled = Number(counts.get(lang) || 0) <= 0;
    button.disabled = disabled;
    button.setAttribute("aria-disabled", disabled ? "true" : "false");
  }
};

const setUiState = (nextState, options = {}) => {
  state.ui = nextState;
  const hint = normalizeText(options.hint || "");
  if (searchControls) {
    searchControls.dataset.searchState = nextState;
    searchControls.setAttribute("aria-busy", nextState === UI_STATE.LOADING ? "true" : "false");
  }

  const interactive = nextState === UI_STATE.READY;
  searchInput.disabled = !interactive;
  searchInput.setAttribute("aria-disabled", interactive ? "false" : "true");
  searchInput.setAttribute(
    "placeholder",
    nextState === UI_STATE.ERROR ? "Search is temporarily unavailable" : "Title, source, topic, keyword"
  );
  setFilterDisabled(!interactive);
  setHint(hint);

  if (searchBrowseFallback) {
    searchBrowseFallback.hidden = nextState === UI_STATE.READY;
  }
};

const initStateFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  state.query = normalizeText(params.get("q") || "");

  const langParam = String(params.get("lang") || "").trim().toUpperCase();
  if (SUPPORTED_LANGS.includes(langParam)) {
    state.lang = langParam;
  }

  searchInput.value = state.query;
};

const refreshMergedItems = () => {
  state.items = [...state.itemsByLocale.values()].flat();
};

const ensureValidSelectedLanguage = () => {
  const counts = new Map(
    SUPPORTED_LANGS.map((lang) => {
      const locale = lang.toLowerCase();
      return [lang, Array.isArray(state.itemsByLocale.get(locale)) ? state.itemsByLocale.get(locale).length : 0];
    })
  );

  if (state.lang === "ALL") {
    setActiveLanguage("ALL");
    return;
  }

  if (Number(counts.get(state.lang) || 0) > 0) {
    setActiveLanguage(state.lang);
    return;
  }

  const firstAvailable = SUPPORTED_LANGS.find((lang) => Number(counts.get(lang) || 0) > 0);
  setActiveLanguage(firstAvailable || "ALL");
};

const bindEvents = () => {
  searchInput.addEventListener("input", () => {
    state.query = normalizeText(searchInput.value);
    render();
  });

  filterGroup.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-lang]");
    if (!button || button.disabled) return;
    const lang = String(button.dataset.lang || "ALL").toUpperCase();
    setActiveLanguage(lang);
    render();
  });
};

const fetchJson = async (url) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} fetch failed (${response.status})`);
  return response.json();
};

const loadLocaleDataset = async (locale, meta = {}) => {
  const path = normalizeText(meta.path || `/data/search-index-${locale}.json`);
  const payload = await fetchJson(path);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return {
    locale,
    items: items.filter((item) => normalizeLocale(item?.locale || item?.language) === locale && isPublicItem(item)),
  };
};

const init = async () => {
  setUiState(UI_STATE.LOADING, { hint: "" });

  try {
    initStateFromUrl();

    const manifest = await fetchJson(SEARCH_MANIFEST_PATH);
    const localeEntries = SUPPORTED_LOCALES.map((locale) => [locale, manifest?.locales?.[locale] || {}]);
    const settled = await Promise.allSettled(localeEntries.map(([locale, meta]) => loadLocaleDataset(locale, meta)));
    const counts = new Map();

    settled.forEach((result, index) => {
      const locale = localeEntries[index][0];
      if (result.status !== "fulfilled") {
        counts.set(localeToLang(locale), 0);
        return;
      }
      state.itemsByLocale.set(locale, result.value.items);
      counts.set(localeToLang(locale), result.value.items.length);
    });

    refreshMergedItems();
    state.manifest = manifest;
    setLanguageAvailability(counts);

    if (state.items.length === 0) {
      throw new Error("No public locale search datasets are available.");
    }

    ensureValidSelectedLanguage();
    setUiState(UI_STATE.READY, { hint: "" });
    bindEvents();
    render();
  } catch (error) {
    console.error(error);
    setUiState(UI_STATE.ERROR, { hint: "Search is temporarily unavailable right now." });
    setSummary("");
    renderBrowseFallback("Search is temporarily unavailable right now. Browse these public sections instead.");
  }
};

init();
