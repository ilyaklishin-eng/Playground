const grid = document.getElementById("interviewsPreviewGrid");
const uiLang = String(document?.documentElement?.lang || "en").trim().slice(0, 2).toLowerCase();
const SOURCE_URL_HEALTH_PATH = "/data/source-url-health.json";
const PUBLIC_INTERVIEWS_PATH = "/data/public-interviews.json";
const COPY = {
  en: { open: "Open material →", empty: "No interviews are available in this language yet." },
  fr: { open: "Voir l’entretien →", empty: "Aucun entretien n’est encore disponible dans cette langue." },
  de: { open: "Beitrag öffnen →", empty: "In dieser Sprache sind noch keine Interviews verfügbar." },
  es: { open: "Ver la entrevista →", empty: "Todavía no hay entrevistas disponibles en este idioma." },
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

if (grid) {
  initPreview().catch(() => {
    if (!grid.querySelector(".interview-preview-card")) {
      renderPreview([]);
    }
  });
}

async function initPreview() {
  const brokenSourceUrls = await loadBrokenSourceUrls();
  const response = await fetch(PUBLIC_INTERVIEWS_PATH, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load interviews: ${response.status}`);
  const payload = await response.json();
  const items = (Array.isArray(payload?.items) ? payload.items : [])
    .filter((item) => String(item?.status || "").toLowerCase() === "published")
    .filter((item) => String(item?.surface || "").toLowerCase() === "public")
    .filter((item) => String(item?.locale || "").toLowerCase() === uiLang)
    .filter((item) => item.section === "interviews" || item.section === "features")
    .filter((item) => {
      const sourceUrl = normalizeSourceUrl(item?.url || "");
      if (!sourceUrl) return true;
      return !brokenSourceUrls.has(sourceUrl);
    })
    .map((item) => ({ ...item, ts: parseDateToTimestamp(item.date) }))
    .sort((a, b) => {
      if (b.ts !== a.ts) return b.ts - a.ts;
      return String(a.title).localeCompare(String(b.title), uiLang);
    })
    .slice(0, 6);

  renderPreview(items);
}

async function loadBrokenSourceUrls() {
  try {
    const response = await fetch(SOURCE_URL_HEALTH_PATH, { cache: "no-store" });
    if (!response.ok) return new Set();
    const payload = await response.json();
    return new Set(
      (Array.isArray(payload?.broken_urls) ? payload.broken_urls : [])
        .map((value) => normalizeSourceUrl(value))
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

function normalizeSourceUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  try {
    return new URL(raw, window.location.origin).toString();
  } catch {
    return raw;
  }
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
