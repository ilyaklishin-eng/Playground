import interviews from "/data/interviews-data.js";
import { localizeInterviewItem } from "/interviews/interviews-localize.js";

const grid = document.getElementById("selectedAllGrid");
const countNode = document.getElementById("selectedAllCount");
const filterButtons = Array.from(document.querySelectorAll(".selected-all-filters .filter-btn[data-format]"));

const state = {
  items: [],
  format: "all",
};

const EMOJI_POOL = [...new Set([
  "📰", "🗞️", "📚", "📖", "🔎", "🧠", "🧭", "🎙️", "🎧", "🎥",
  "📺", "🎞️", "📡", "🛰️", "🧪", "🧩", "🛡️", "⚖️", "🏛️", "🌐",
  "🌍", "🌎", "🌏", "💬", "🗣️", "✍️", "📝", "📌", "📍", "📎",
  "🧾", "📊", "📈", "📉", "🗂️", "📁", "🧵", "🪶", "🕯️", "⏳",
  "⌛", "🔬", "🧬", "🧱", "⚙️", "🔭", "🧰", "🪪", "🛠️", "🧿",
  "🪞", "💡", "🔦", "🕳️", "🌫️", "☀️", "🌤️", "🌦️", "🌥️", "🌪️",
  "🌊", "🧊", "⛰️", "🏔️", "🏙️", "🌃", "🌆", "🕰️", "⏱️", "🧮",
  "🧯", "🗳️", "🧑‍💻", "👩‍💻", "👨‍💻", "🧑‍🏫", "👩‍🏫", "👨‍🏫", "🧑‍⚖️", "🧑‍💼",
  "🧑‍💼", "🧑‍💼", "🔐", "🔓", "🔒", "🧷", "🪡", "📐", "📏", "🗺️",
  "🧯", "🛎️", "🔔", "🔕", "📣", "📯", "🎚️", "🎛️", "📻", "🪄",
  "🪄", "🧑‍🎓", "👩‍🎓", "👨‍🎓", "🧑‍🔬", "👩‍🔬", "👨‍🔬", "🧑‍🚀", "👩‍🚀", "👨‍🚀",
  "🧑‍🎤", "👩‍🎤", "👨‍🎤", "🪐", "🌙", "⭐", "✨", "🔆", "🔅", "🪙",
  "💼", "📇", "📬", "📭", "📤", "📥", "🧺", "🪜", "🧭", "🧨",
  "🧠", "🪬", "🪪", "🫧", "🫶", "🤝", "🫱", "🫲", "🫡", "🧑‍💻",
  "🧑‍⚕️", "🧑‍🏭", "🧑‍🔧", "🧑‍🎨", "🧑‍✈️", "🧑‍🚒", "🧑‍⚖️", "🧑‍🌾", "🧑‍🏛️"
])];

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

function hasLeadingEmoji(text) {
  return /^\p{Extended_Pictographic}/u.test(String(text || "").trim());
}

function pickUniqueEmoji(candidates, used, seed = 0) {
  for (const emoji of candidates) {
    if (emoji && !used.has(emoji)) return emoji;
  }

  for (const emoji of EMOJI_POOL) {
    if (!used.has(emoji)) return emoji;
  }

  const len = EMOJI_POOL.length || 1;
  for (let i = 0; i < len * len; i += 1) {
    const first = EMOJI_POOL[(seed + i) % len];
    const second = EMOJI_POOL[(seed * 7 + i * 3) % len];
    const pair = `${first}${second}`;
    if (!used.has(pair)) return pair;
  }

  return "✨";
}

function emojiCandidates(item) {
  const source = String(item?.source || "").toLowerCase();
  const title = String(item?.title || "").toLowerCase();
  const summary = String(item?.summary || "").toLowerCase();
  const format = String(item?.format || "").toLowerCase();
  const blob = `${source} ${title} ${summary}`;

  if (format === "podcasts") return ["🎙️", "🎧", "🗣️", "📻"];
  if (format === "video") return ["🎥", "📺", "🎞️", "📡"];

  if (source.includes("bloomberg")) return ["📈", "🧮", "📊", "🌐"];
  if (source.includes("the atlantic")) return ["🌊", "🧠", "📚", "🗞️"];
  if (source.includes("guardian")) return ["🛡️", "📰", "🔎", "⚖️"];
  if (source.includes("carnegie")) return ["🏛️", "🧠", "🧭", "📖"];
  if (source.includes("global voices")) return ["🌍", "🌐", "🗣️", "📰"];
  if (source.includes("human rights watch")) return ["⚖️", "🛡️", "🔍", "🧾"];
  if (source.includes("vedomosti")) return ["📊", "📰", "🧩", "🧠"];
  if (source.includes("moscow times")) return ["🗞️", "🧭", "📌", "🧾"];
  if (source.includes("tv rain")) return ["📺", "🛰️", "🔎", "📡"];
  if (source.includes("the insider")) return ["🔬", "🧠", "📝", "📰"];

  if (/\bprotest|activis|civil\b/.test(blob)) return ["✊", "🗳️", "📣", "🧭"];
  if (/\bmedia|journal|editor|press\b/.test(blob)) return ["📰", "🗞️", "🧠", "🧾"];
  if (/\bpropaganda|disinformation|troll|bot\b/.test(blob)) return ["🧲", "🧠", "🔎", "🛰️"];

  return ["🧭", "📖", "🔎", "📰"];
}

function buildEmojiMap(items) {
  const byKey = new Map();
  const used = new Set();

  items.forEach((item, index) => {
    const key = String(item?.id || item?.url || item?.title || `item-${index}`);
    if (!key) return;
    const emoji = pickUniqueEmoji(emojiCandidates(item), used, index);
    byKey.set(key, emoji);
    used.add(emoji);
  });

  return byKey;
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function createCard(item, emojiMap) {
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
  const key = String(item?.id || item?.url || item?.title || "");
  const emoji = emojiMap?.get(key);
  const baseTitle = item.title || "Untitled";
  titleLink.textContent = emoji ? `${emoji} ${baseTitle}` : baseTitle;
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
  const emojiMap = buildEmojiMap(visible);
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
  visible.forEach((item) => fragment.appendChild(createCard(item, emojiMap)));
  grid.appendChild(fragment);
}

function decorateClusterCards() {
  const links = Array.from(document.querySelectorAll(".cluster-grid .work-title-link"));
  if (!links.length) return;

  const items = links.map((link, index) => {
    const baseTitle =
      link.dataset.baseTitle ||
      String(link.textContent || "").trim().replace(/^\p{Extended_Pictographic}\s*/u, "");
    if (!link.dataset.baseTitle) link.dataset.baseTitle = baseTitle;
    return {
      id: `cluster-${index}`,
      title: baseTitle,
      summary: link.closest(".work-card")?.querySelector(".work-intro")?.textContent || "",
      source: link.closest(".work-card")?.querySelector(".work-meta")?.textContent || "",
      format: "text",
      url: link.getAttribute("href") || "",
    };
  });

  const emojiMap = buildEmojiMap(items);
  links.forEach((link, index) => {
    const key = `cluster-${index}`;
    const emoji = emojiMap.get(key);
    const baseTitle = link.dataset.baseTitle || String(link.textContent || "").trim();
    if (hasLeadingEmoji(baseTitle)) {
      link.textContent = baseTitle;
      return;
    }
    link.textContent = emoji ? `${emoji} ${baseTitle}` : baseTitle;
  });
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
  decorateClusterCards();
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
