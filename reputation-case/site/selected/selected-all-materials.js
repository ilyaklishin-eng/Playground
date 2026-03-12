import interviews from "/data/interviews-data.js";
import { localizeInterviewItem } from "/interviews/interviews-localize.js";

const grid = document.getElementById("selectedAllGrid");
const countNode = document.getElementById("selectedAllCount");
const filterButtons = Array.from(document.querySelectorAll(".selected-all-filters .filter-btn[data-format]"));

const state = {
  items: [],
  format: "all",
};

const uiLang = String(document?.documentElement?.lang || "en").toLowerCase();
const pageLang = uiLang === "fr" ? "FR" : uiLang === "de" ? "DE" : uiLang === "es" ? "ES" : "EN";

init().catch((error) => {
  console.error("Failed to build selected materials feed", error);
  if (countNode) countNode.textContent = "Failed to load materials.";
});

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripTags(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function toTimestamp(raw) {
  const value = normalize(raw);
  if (!value) return 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return Date.parse(`${value}T00:00:00Z`) || 0;
  if (/^\d{4}-\d{2}$/.test(value)) return Date.parse(`${value}-01T00:00:00Z`) || 0;
  if (/^\d{4}$/.test(value)) return Date.parse(`${value}-01-01T00:00:00Z`) || 0;
  if (/^\d{4}[\/\-]\d{4}$/.test(value)) {
    const firstYear = value.slice(0, 4);
    return Date.parse(`${firstYear}-01-01T00:00:00Z`) || 0;
  }
  return Date.parse(value) || 0;
}

function summaryTwoSentences(raw) {
  const text = normalize(stripTags(raw));
  if (!text) return "";
  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  const picked = parts.slice(0, 2).map((part) => normalize(part));
  const merged = normalize(picked.join(" "));
  if (!merged) return "";
  return /[.!?]$/.test(merged) ? merged : `${merged}.`;
}

function detectFormat(item) {
  const blob = [
    item.formatLabel,
    item.format,
    item.title,
    item.description,
    item.summary,
    item.material_type,
    item.source,
    item.topic,
  ]
    .map((v) => String(v || ""))
    .join(" ")
    .toLowerCase();

  if (/(podcast|подкаст|podcasts)/.test(blob)) return "podcasts";
  if (/(video|видео|youtube|tedx?|broadcast|эфир|talk|interview by skype)/.test(blob)) return "video";
  return "text";
}

function formatLabel(kind) {
  if (kind === "video") return "Video";
  if (kind === "podcasts") return "Podcast";
  return "Text";
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function createCard(item) {
  const node = document.createElement("article");
  node.className = "selected-all-card";

  const meta = document.createElement("p");
  meta.className = "selected-all-meta";
  meta.textContent = `${item.date || "-"} · ${formatLabel(item.format)} · ${item.source || "Source"}`;

  const title = document.createElement("h3");
  const titleLink = document.createElement("a");
  titleLink.href = item.url;
  if (isAbsoluteUrl(item.url)) {
    titleLink.target = "_blank";
    titleLink.rel = "noopener noreferrer";
  }
  titleLink.textContent = item.title || "Untitled";
  title.appendChild(titleLink);

  const summary = document.createElement("p");
  summary.className = "selected-all-summary";
  summary.textContent = item.summary || "No summary available.";

  const cta = document.createElement("p");
  cta.className = "selected-all-cta";
  const ctaLink = document.createElement("a");
  ctaLink.href = item.url;
  if (isAbsoluteUrl(item.url)) {
    ctaLink.target = "_blank";
    ctaLink.rel = "noopener noreferrer";
  }
  ctaLink.textContent = "Open material ->";
  cta.appendChild(ctaLink);

  node.append(meta, title, summary, cta);
  return node;
}

function dedupeByUrl(items) {
  const byUrl = new Map();
  for (const item of items) {
    const key = normalize(item.url || item.sourceUrl || item.title).toLowerCase();
    if (!key) continue;
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, item);
      continue;
    }

    const existingScore = (existing.format !== "text" ? 2 : 0) + (existing.summary?.length || 0);
    const nextScore = (item.format !== "text" ? 2 : 0) + (item.summary?.length || 0);
    if (nextScore > existingScore) {
      byUrl.set(key, item);
    }
  }
  return Array.from(byUrl.values());
}

function render() {
  if (!grid) return;
  const all = state.items;
  const visible = state.format === "all" ? all : all.filter((item) => item.format === state.format);
  grid.innerHTML = "";

  if (countNode) {
    countNode.textContent = `${visible.length} shown / ${all.length} total`;
  }

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "selected-all-empty";
    empty.textContent = "No materials match the current filter.";
    grid.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  visible.forEach((item) => fragment.appendChild(createCard(item)));
  grid.appendChild(fragment);
}

function bindFilters() {
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const next = String(button.dataset.format || "all");
      if (next === state.format) return;
      state.format = next;
      filterButtons.forEach((node) => {
        const active = String(node.dataset.format) === next;
        node.classList.toggle("active", active);
        node.setAttribute("aria-pressed", active ? "true" : "false");
      });
      render();
    });
  });
}

async function loadDigestCards() {
  const response = await fetch("/data/digests.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load digests: ${response.status}`);
  const payload = await response.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return items
    .filter((item) => String(item?.status || "").toLowerCase() === "ready")
    .filter((item) => String(item?.language || "").toUpperCase() === pageLang)
    .map((item) => ({
      id: normalize(item.id),
      date: normalize(item.date),
      source: normalize(item.source),
      title: normalize(item.title),
      summary: summaryTwoSentences(item.summary || item.digest),
      url: normalize(item.url),
      sourceUrl: normalize(item.url),
      format: detectFormat(item),
    }))
    .filter((item) => item.title && item.url);
}

function loadInterviewCards() {
  return interviews
    .map((item) => localizeInterviewItem(item, uiLang))
    .map((item) => ({
      id: `interview-${normalize(item.url)}`,
      date: normalize(item.date),
      source: normalize(item.section === "features" ? "Feature" : "Interview"),
      title: normalize(item.title),
      summary: summaryTwoSentences(item.description),
      url: normalize(item.url),
      sourceUrl: normalize(item.url),
      format: detectFormat(item),
    }))
    .filter((item) => item.title && item.url);
}

async function init() {
  const digestCards = await loadDigestCards();
  const interviewCards = loadInterviewCards();
  const combined = dedupeByUrl([...digestCards, ...interviewCards])
    .slice()
    .sort((a, b) => {
      const dateDelta = toTimestamp(b.date) - toTimestamp(a.date);
      if (dateDelta !== 0) return dateDelta;
      return a.title.localeCompare(b.title);
    });

  state.items = combined;
  bindFilters();
  render();
}
