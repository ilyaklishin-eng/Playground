import interviews from "/data/interviews-data.js";
import {
  localizeInterviewItem,
  matchesFormatFilter,
} from "/interviews/interviews-localize.js";

const grid = document.getElementById("interviewsPreviewGrid");
const uiLang = String(document?.documentElement?.lang || "en").trim().slice(0, 2).toLowerCase();
const COPY = {
  en: { open: "Open material ->", empty: "No interviews are available in this language yet." },
  fr: { open: "Ouvrir le contenu ->", empty: "Aucun entretien n est encore disponible dans cette langue." },
  de: { open: "Material offnen ->", empty: "In dieser Sprache sind noch keine Interviews verfugbar." },
  es: { open: "Abrir material ->", empty: "Todavia no hay entrevistas disponibles en este idioma." },
};
const ACTIVE_COPY = COPY[uiLang] || COPY.en;
const INTERVIEW_EMOJI_POOL = [
  "🎙️",
  "🎧",
  "📚",
  "🎥",
  "🗣️",
  "🌍",
  "📰",
  "📺",
  "🧭",
  "💬",
  "📖",
  "🔎",
  "🧠",
  "📡",
  "🎞️",
];

if (!grid) {
  // script loaded on a page without interviews preview
} else {
  const items = interviews
    .map((item) => localizeInterviewItem(item, uiLang))
    .filter((item) => item.section === "interviews" || item.section === "features")
    .filter((item) => matchesFormatFilter(item, "all"))
    .map((item) => ({ ...item, ts: parseDateToTimestamp(item.date) }))
    .sort((a, b) => {
      if (b.ts !== a.ts) return b.ts - a.ts;
      return String(a.title).localeCompare(String(b.title), uiLang);
    })
    .slice(0, 6);

  renderPreview(items);
}

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

function interviewEmojiCandidates(item) {
  const format = String(item?.formatLabel || "").toLowerCase();
  const section = String(item?.section || "").toLowerCase();
  const lang = String(item?.languageLabel || "").toLowerCase();
  const text = [item?.title, item?.description, item?.formatLabel].map((v) => String(v || "").toLowerCase()).join(" ");

  if (/\bpodcast\b/.test(format) || /\bpodcast\b/.test(text)) {
    return ["🎙️", "🎧", "🗣️", "💬"];
  }
  if (/\bvideo\b/.test(format) || /\byoutube|broadcast|talk\b/.test(text)) {
    return ["🎥", "📺", "🎞️", "📡"];
  }
  if (/\btext\b/.test(format) || /\binterview|essay|feature\b/.test(text)) {
    return ["📰", "📖", "🔎", "🧠"];
  }
  if (/\bbook|nabokov|literature|reading\b/.test(text)) {
    return ["📚", "📖", "🧠", "🔎"];
  }
  if (section === "features" || /\benglish\b/.test(lang)) {
    return ["🌍", "🧭", "📰", "📡"];
  }
  return ["💬", "🧭", "📰", "🎙️"];
}

function buildInterviewEmojiMap(items) {
  const byUrl = new Map();
  const used = new Set();

  for (const item of items) {
    const key = String(item?.url || "");
    if (!key) continue;
    const candidates = [...interviewEmojiCandidates(item), ...INTERVIEW_EMOJI_POOL];
    const picked = candidates.find((emoji) => !used.has(emoji));
    if (!picked) continue;
    byUrl.set(key, picked);
    used.add(picked);
  }
  return byUrl;
}

function renderPreview(items) {
  grid.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "interview-empty";
    empty.textContent = ACTIVE_COPY.empty;
    grid.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  const emojiByUrl = buildInterviewEmojiMap(items);

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "interview-preview-card";

    const meta = document.createElement("p");
    meta.className = "interview-preview-meta";
    meta.textContent = `${formatDisplayDate(item.date)} · ${item.languageLabel} · ${item.formatLabel}`;

    const title = document.createElement("h3");
    title.className = "interview-preview-title";
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const emoji = emojiByUrl.get(String(item.url || ""));
    link.textContent = `${emoji ? `${emoji} ` : ""}${item.title}`;
    title.appendChild(link);

    const desc = document.createElement("p");
    desc.className = "interview-preview-description";
    desc.textContent = item.description;

    const action = document.createElement("a");
    action.className = "interview-preview-open";
    action.href = item.url;
    action.target = "_blank";
    action.rel = "noopener noreferrer";
    action.textContent = ACTIVE_COPY.open;

    card.append(meta, title, desc, action);
    fragment.appendChild(card);
  }

  grid.appendChild(fragment);
}
