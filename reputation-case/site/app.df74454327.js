const grid = document.getElementById("digestGrid");
const showcase = document.getElementById("digestShowcase");
const moreWorkHead = document.getElementById("moreWorkHead");
const template = document.getElementById("cardTemplate");
const updatedAt = document.getElementById("updatedAt");
const langSwitch = document.getElementById("langSwitch");
const searchInput = document.getElementById("searchInput");
const uiLang = String(document?.documentElement?.lang || "en").trim().toLowerCase();
const preferredFeedLang = String(document?.body?.dataset?.feedLang || "").trim().toUpperCase();
const IS_HOME_PAGE = Boolean(document?.body?.classList?.contains("home-page"));
const PUBLIC_DIGESTS_PATH = "/data/public-digests.json";
const SOURCE_URL_HEALTH_PATH = "/data/source-url-health.json";
const LANGUAGE_PRIORITY = ["EN", "FR", "DE", "ES"];
const PAGE_LANG_TO_FEED = { en: "EN", fr: "FR", de: "DE", es: "ES" };
const lockedFeedLang = PAGE_LANG_TO_FEED[uiLang] || null;
const SHOWCASE_PINNED_IDS = {
  EN: ["en-009", "en-141", "en-107", "en-108", "en-143", "en-002", "en-001", "en-134"],
};
const HOME_EXCLUDED_IDS = {
  EN: new Set(["en-017"]),
};
const SHOWCASE_MAX_ITEMS = 12;
const ADDITIONAL_GRID_LIMIT = 9;
const ADDITIONAL_MAX_PER_SOURCE = 1;
const UI_COPY = {
  en: {
    openNote: "Open on-site note",
    originalSource: "Original source",
    emptyFiltered: "No published cards match the current filter.",
    emptyLanguage: "No published cards are available in {lang} yet.",
    emptyLoadFailed: "Published cards are temporarily unavailable.",
    langTitlePublished: "{count} published cards",
    langTitleEmpty: "No published cards in {lang} yet",
  },
  fr: {
    openNote: "Ouvrir la fiche du site",
    originalSource: "Source originale",
    emptyFiltered: "Aucune fiche publiée ne correspond au filtre actuel.",
    emptyLanguage: "Aucune fiche publiée n’est disponible en {lang} pour le moment.",
    emptyLoadFailed: "Les fiches publiées sont temporairement indisponibles.",
    langTitlePublished: "{count} fiches publiées",
    langTitleEmpty: "Aucune fiche publiée en {lang} pour le moment",
  },
  de: {
    openNote: "Interne Seite öffnen",
    originalSource: "Originalquelle",
    emptyFiltered: "Keine veröffentlichten Karten entsprechen dem aktuellen Filter.",
    emptyLanguage: "Noch keine veröffentlichten Karten in {lang} verfügbar.",
    emptyLoadFailed: "Veröffentlichte Karten sind vorübergehend nicht verfügbar.",
    langTitlePublished: "{count} veröffentlichte Karten",
    langTitleEmpty: "Noch keine veröffentlichten Karten in {lang}",
  },
  es: {
    openNote: "Abrir ficha del sitio",
    originalSource: "Fuente original",
    emptyFiltered: "No hay fichas publicadas que coincidan con el filtro actual.",
    emptyLanguage: "Todavía no hay fichas publicadas en {lang}.",
    emptyLoadFailed: "Las fichas publicadas no están disponibles temporalmente.",
    langTitlePublished: "{count} fichas publicadas",
    langTitleEmpty: "Todavía no hay fichas publicadas en {lang}",
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

function sourceKey(item) {
  const source = normalizeText(item?.source || "").toLowerCase();
  if (source) return source;
  return `source:${normalizeText(item?.id || "")}`;
}

function pickDiverseBySource(items, limit, maxPerSource = 2) {
  if (!Array.isArray(items) || items.length === 0 || limit <= 0) return [];
  const cap = Number.isFinite(maxPerSource) && maxPerSource > 0 ? Math.floor(maxPerSource) : 1;
  const selected = [];
  const selectedSet = new Set();
  const perSource = new Map();

  const tryAdd = (item, perSourceCap) => {
    if (selectedSet.has(item)) return;
    const key = sourceKey(item);
    const count = perSource.get(key) || 0;
    if (count >= perSourceCap) return;
    selected.push(item);
    selectedSet.add(item);
    perSource.set(key, count + 1);
  };

  for (const item of items) {
    if (selected.length >= limit) break;
    tryAdd(item, 1);
  }
  for (const item of items) {
    if (selected.length >= limit) break;
    tryAdd(item, cap);
  }
  for (const item of items) {
    if (selected.length >= limit) break;
    tryAdd(item, Number.POSITIVE_INFINITY);
  }
  return selected;
}

const state = {
  lang: lockedFeedLang || (LANGUAGE_PRIORITY.includes(preferredFeedLang) ? preferredFeedLang : "EN"),
  query: "",
  publishedItems: [],
  brokenHomeSourceUrls: new Set(),
  loadFailed: false,
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

function normalizeSourceUrl(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  try {
    return new URL(raw, window.location.origin).toString();
  } catch {
    return raw;
  }
}

function isInternalSiteUrl(value) {
  const normalized = normalizeSourceUrl(value);
  if (!normalized) return false;
  try {
    return new URL(normalized, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

function toNavigableUrl(raw) {
  if (!raw) return "";
  try {
    const resolved = new URL(raw, window.location.origin);
    if (!/^https?:$/i.test(resolved.protocol)) return "";
    if (resolved.origin === window.location.origin) {
      return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    }
    return resolved.toString();
  } catch {
    return "";
  }
}

function getCardNoteUrl(item) {
  const explicitPostUrl = normalizeSourceUrl(item?.post_url || "");
  if (isInternalSiteUrl(explicitPostUrl)) return toNavigableUrl(explicitPostUrl);

  const internal = normalizeSourceUrl(internalPostUrl(item));
  if (isInternalSiteUrl(internal)) return toNavigableUrl(internal);

  return "";
}

function getCardPrimarySourceUrl(item) {
  const externalSource = normalizeSourceUrl(item?.source_url || item?.url || "");
  if (!externalSource || isInternalSiteUrl(externalSource)) return "";
  return toNavigableUrl(externalSource);
}

// Home cards are source-first; note links stay separate so the card can open the original publication while the CTA opens the on-site note.
function getCardSourceHealthUrl(item) {
  return getCardPrimarySourceUrl(item);
}

function isBlockedHomeSource(item) {
  if (!IS_HOME_PAGE) return false;
  const sourceUrl = getCardSourceHealthUrl(item);
  if (!sourceUrl) return false;
  return Boolean(!getCardNoteUrl(item) && state.brokenHomeSourceUrls.has(sourceUrl));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function featuredDigestParagraphs(item) {
  const raw = String(item?.summary || item?.digest || "").trim();
  if (!raw) return [];

  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((paragraph) => normalizeText(paragraph))
    .filter(Boolean);

  if ((item?.id || "") === "en-009") {
    const emphasis = "accurately predicted the weaponization of social media";
    for (let i = 0; i < paragraphs.length; i += 1) {
      if (paragraphs[i].includes(emphasis)) {
        paragraphs[i] = paragraphs[i].replace(emphasis, `__EMPH__${emphasis}__EMPH__`);
        break;
      }
    }
  }

  return paragraphs;
}

function renderFeaturedDigest(digestNode, item) {
  const paragraphs = featuredDigestParagraphs(item);
  if (paragraphs.length === 0) {
    digestNode.textContent = "";
    return;
  }

  const html = paragraphs
    .map((paragraph) => {
      const escaped = escapeHtml(paragraph).replace(/__EMPH__(.*?)__EMPH__/g, "<strong>$1</strong>");
      return `<p>${escaped}</p>`;
    })
    .join("");

  digestNode.innerHTML = html;
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

const SUMMARY_BOILERPLATE_PATTERNS = [
  /\bentry added to include\b/i,
  /\bthe summary gives a clear reference point for later comparisons\b/i,
  /\buseful reference card\b/i,
  /\bthis (?:card|entry|piece) is included as\b/i,
  /\bit is included as\b/i,
  /\bkeep this as\b/i,
  /\bsource record\b/i,
  /\bexternal analytical reference\b/i,
  /\bexternal profile context source\b/i,
  /\binstitutional context source\b/i,
  /\binstitutional record in the wider timeline\b/i,
  /\bfor later comparisons\b/i,
  /\bdirect link to the original publication\b/i,
];

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

function isSummaryBoilerplate(sentence) {
  return SUMMARY_BOILERPLATE_PATTERNS.some((pattern) => pattern.test(String(sentence || "").trim()));
}

function normalizeSummarySentence(sentence) {
  return normalizeText(sentence)
    .replace(/\bPublished:\s*\d{4}-\d{2}-\d{2}\.?\s*$/i, "")
    .trim();
}

function collectCleanSummarySentences(item, raw, maxSentences = 2) {
  const cleaned = stripLeadScaffolding(normalizeText(raw || "")) || normalizeText(raw || "");
  const unique = new Set();
  const out = [];
  for (const sentence of splitSentences(cleaned)) {
    const value = normalizeSummarySentence(sentence);
    if (!value || value.length < 24) continue;
    if (hasMachineFragments(value)) continue;
    if (isSummaryBoilerplate(value)) continue;
    const key = value.toLowerCase();
    if (unique.has(key)) continue;
    unique.add(key);
    out.push(value);
    if (out.length >= Math.max(1, maxSentences)) break;
  }
  return out;
}

function humanSummaryPreview(item, options = {}) {
  const maxSentences = Number.isFinite(options.maxSentences) ? options.maxSentences : 2;
  const raw = normalizeText(item?.summary || item?.digest || "");
  if (!raw) return "";
  const selected = collectCleanSummarySentences(item, raw, maxSentences);
  let preview = selected.join(" ").trim();
  if (!preview) preview = fallbackSummary(item);
  if (!/[.!?]$/.test(preview)) preview += ".";
  return preview.replace(/^[a-z]/, (char) => char.toUpperCase());
}

function fallbackSummary(item) {
  const topic = normalizeText(item?.topic || "the topic");
  const source = normalizeText(item?.source || "the source");
  const year = /^\d{4}/.test(String(item?.date || "")) ? String(item.date).slice(0, 4) : "";
  const lang = String(item?.language || "").toUpperCase();
  if (lang === "FR") {
    return `Ce texte de ${source}${year ? ` (${year})` : ""} porte sur ${topic}.`;
  }
  if (lang === "DE") {
    return `Der Beitrag aus ${source}${year ? ` (${year})` : ""} behandelt ${topic}.`;
  }
  if (lang === "ES") {
    return `Este texto de ${source}${year ? ` (${year})` : ""} aborda ${topic}.`;
  }
  return `This piece from ${source}${year ? ` (${year})` : ""} examines ${topic}.`;
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

function internalPostUrl(item) {
  const slug = normalizeText(item?.slug || "").replace(/\.html$/i, "");
  if (!slug) return "";
  return `/posts/${slug}.html`;
}

function getCardPrimaryUrl(item) {
  const sourceUrl = getCardPrimarySourceUrl(item);
  if (sourceUrl && !state.brokenHomeSourceUrls.has(sourceUrl)) {
    return sourceUrl;
  }
  return getCardNoteUrl(item);
}

init();

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeLocaleToken(value) {
  return String(value || "").trim().toLowerCase().slice(0, 2);
}

function allowedFallbackLocales(item) {
  const raw = item?.allowed_fallback_locales;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((value) => normalizeLocaleToken(value)).filter(Boolean))];
}

function isPublished(item) {
  return normalizeStatus(item?.status) === "published";
}

function isPublicVisible(item) {
  return isPublished(item) && normalizeStatus(item?.surface) === "public";
}

function isAuthoredRole(item) {
  return normalizeText(item?.role || "").toLowerCase() === "authored";
}

function canRenderInFeedLocale(item, feedLang = "EN") {
  const targetLocale = normalizeLocaleToken(feedLang);
  const itemLocale = normalizeLocaleToken(item?.locale || item?.language);
  if (!targetLocale) return true;
  if (itemLocale === targetLocale) return true;
  return allowedFallbackLocales(item).includes(targetLocale);
}

function shouldShowCardLanguageBadge(item, feedLang = state.lang) {
  const cardLang = String(item?.language || "").trim().toUpperCase();
  const currentLang = String(feedLang || "").trim().toUpperCase();
  if (!cardLang) return false;
  if (!currentLang) return true;
  return cardLang !== currentLang;
}

function publishedCounts() {
  return state.publishedItems
    .filter((item) => isAuthoredRole(item))
    .filter((item) => isShowcaseCandidate(item))
    .filter((item) => !isBlockedHomeSource(item))
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
  const sourceHealthPromise = fetch(SOURCE_URL_HEALTH_PATH, { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);

  try {
    const response = await fetch(PUBLIC_DIGESTS_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Home feed request failed with status ${response.status}`);
    }

    // Guard the main feed fetch against error pages, broken JSON, and payload shape drift.
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.loadFailed = !Array.isArray(payload?.items);
    state.publishedItems = items.filter((item) => isPublicVisible(item));
    if (updatedAt) {
      const stamp = normalizeText(payload?.updated_at || payload?.generated_at || "-") || "-";
      updatedAt.textContent = stamp;
    }
  } catch {
    state.loadFailed = true;
    state.publishedItems = [];
    if (updatedAt) {
      updatedAt.textContent = "-";
    }
  }

  const sourceHealth = await sourceHealthPromise;
  state.brokenHomeSourceUrls = new Set(
    (Array.isArray(sourceHealth?.broken_urls) ? sourceHealth.broken_urls : [])
      .map((value) => normalizeSourceUrl(value))
      .filter(Boolean)
  );
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
    if (!isAuthoredRole(item)) return false;
    if (!isShowcaseCandidate(item)) return false;
    if (isBlockedHomeSource(item)) return false;
    const langMatch = canRenderInFeedLocale(item, state.lang);
    if (!langMatch) return false;
    if (IS_HOME_PAGE) {
      const hiddenForLang = HOME_EXCLUDED_IDS[state.lang];
      if (hiddenForLang?.has(String(item?.id || ""))) return false;
    }
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
  const prioritized = sorted
    .sort((a, b) => {
      const rankA = pinnedRank.has(String(a?.id || "")) ? pinnedRank.get(String(a?.id || "")) : Number.POSITIVE_INFINITY;
      const rankB = pinnedRank.has(String(b?.id || "")) ? pinnedRank.get(String(b?.id || "")) : Number.POSITIVE_INFINITY;
      if (rankA !== rankB) return rankA - rankB;
      return 0;
    });

  const featured = prioritized.slice(0, 1);
  const featuredSet = new Set(featured);
  const supportingPool = prioritized.filter((item) => !featuredSet.has(item));
  const supporting = pickDiverseBySource(supportingPool, 2, 1);
  const supportingSet = new Set(supporting);
  const additionalPool = supportingPool.filter((item) => !supportingSet.has(item));
  const additional = pickDiverseBySource(additionalPool, ADDITIONAL_GRID_LIMIT, ADDITIONAL_MAX_PER_SOURCE).slice(
    0,
    Math.max(0, SHOWCASE_MAX_ITEMS - featured.length - supporting.length)
  );
  const renderedCount = featured.length + supporting.length + additional.length;

  renderShowcase(featured, supporting);
  renderGrid(additional, { showEmpty: prioritized.length === 0 });
  if (moreWorkHead) moreWorkHead.hidden = additional.length === 0;
  if (grid) grid.hidden = additional.length === 0 && renderedCount > 0;
}

function getOrderedLanguages() {
  // Home feed intentionally supports only the productized EN/FR/DE/ES switcher.
  if (lockedFeedLang) return [lockedFeedLang];
  return [...LANGUAGE_PRIORITY];
}

function renderLanguageSwitch() {
  if (!langSwitch) return;
  const languages = getOrderedLanguages();
  const counts = publishedCounts();
  const defaultLang = lockedFeedLang || "EN";
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
  if (!grid) return;
  const showEmpty = Boolean(options.showEmpty);
  grid.innerHTML = "";

  if (!items.length) {
    if (!showEmpty) return;
    const empty = document.createElement("div");
    empty.className = "empty";
    if (state.loadFailed) {
      empty.textContent = t("emptyLoadFailed");
    } else if (state.query) {
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
  const primaryUrl = getCardPrimaryUrl(item);
  const sourceUrl = getCardPrimarySourceUrl(item);
  const noteUrl = getCardNoteUrl(item);
  const showLangTag = shouldShowCardLanguageBadge(item, state.lang);
  // Cards stay source-first; if the source is unavailable, they can fall back to the on-site note instead of shipping a dead click target.
  const canNavigate = Boolean(primaryUrl);
  const showNoteCta = Boolean(noteUrl && noteUrl !== primaryUrl);
  const showSourceCta = Boolean(showNoteCta && sourceUrl && sourceUrl === primaryUrl);
  const node = template.content.firstElementChild.cloneNode(true);
  node.classList.add(`card-${variant}`);
  if (canNavigate) {
    node.classList.add("card-clickable");
    node.dataset.url = primaryUrl;
  }

  const cardHead = node.querySelector(".card-head");
  const langTag = node.querySelector(".lang-tag");
  if (langTag) {
    langTag.textContent = showLangTag ? String(item?.language || "").trim().toUpperCase() : "";
    langTag.hidden = !showLangTag;
  }
  if (cardHead) {
    cardHead.hidden = !showLangTag;
  }

  const titleNode = node.querySelector(".card-title");
  titleNode.textContent = "";
  if (canNavigate) {
    const titleLink = document.createElement("a");
    titleLink.href = primaryUrl;
    titleLink.className = "card-title-link";
    titleLink.textContent = cleanDisplayTitle(item.title);
    titleNode.appendChild(titleLink);
  } else {
    titleNode.textContent = cleanDisplayTitle(item.title);
  }

  node.querySelector(".card-meta").textContent = composeCardMeta(item);
  const digestNode = node.querySelector(".card-digest");
  if (variant === "featured") {
    renderFeaturedDigest(digestNode, item);
  } else {
    digestNode.textContent = humanSummaryPreview(item, {
      maxSentences: 3,
    });
  }

  const quoteNode = node.querySelector(".card-quote");
  const quoteText = variant === "featured" && item?.id !== "en-009" ? pickCardQuote(item) : "";
  if (quoteText) {
    quoteNode.textContent = quoteText;
    quoteNode.hidden = false;
  } else {
    quoteNode.textContent = "";
    quoteNode.hidden = true;
  }

  let linksWrap = node.querySelector(".card-links");
  const link = node.querySelector(".card-link");
  let sourceLink = node.querySelector(".card-link-secondary");
  if (!linksWrap) {
    linksWrap = document.createElement("div");
    linksWrap.className = "card-links";
    if (link) {
      node.insertBefore(linksWrap, link);
      linksWrap.appendChild(link);
    } else {
      node.appendChild(linksWrap);
    }
  }
  if (!sourceLink) {
    sourceLink = document.createElement("a");
    sourceLink.className = "card-link-secondary";
    linksWrap.appendChild(sourceLink);
  }
  if (showNoteCta) {
    link.href = noteUrl;
    // The CTA stays dedicated to the on-site note while the card itself opens the primary source.
    link.textContent = t("openNote");
    link.hidden = false;
  } else {
    link.removeAttribute("href");
    link.textContent = "";
    link.hidden = true;
  }
  if (showSourceCta) {
    sourceLink.href = sourceUrl;
    sourceLink.textContent = t("originalSource");
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.hidden = false;
  } else {
    sourceLink.removeAttribute("href");
    sourceLink.removeAttribute("target");
    sourceLink.removeAttribute("rel");
    sourceLink.textContent = "";
    sourceLink.hidden = true;
  }
  if (linksWrap) {
    linksWrap.hidden = !showNoteCta && !showSourceCta;
  }

  return node;
}

function bindCardInteractions(container) {
  if (!container || container.dataset.cardInteractionsBound === "1") return;
  container.dataset.cardInteractionsBound = "1";

  container.addEventListener("click", (event) => {
    const card = event.target.closest(".card-clickable");
    if (!card || !container.contains(card)) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.target.closest("a,button,input,label,select,textarea,summary,[role='button'],[role='link']")) return;
    const primaryLink = card.querySelector(".card-title-link[href], .card-link[href]");
    if (primaryLink instanceof HTMLAnchorElement) {
      primaryLink.click();
    }
  });
}
