export function lineCount(text) {
  return String(text || "")
    .split("\n")
    .filter((line) => line.trim().length > 0).length;
}

const NOISE_MARKERS = ["http://", "https://", "читать полностью", "биография", "copyright", "версия для печати"];

export function detectEditorialIssues(poem) {
  const issues = [];
  const text = String(poem?.text || "").toLowerCase();
  if (!text.trim()) issues.push("empty_text");
  if (lineCount(text) < 4) issues.push("too_short");
  if (lineCount(text) > 20) issues.push("too_long");
  if (NOISE_MARKERS.some((marker) => text.includes(marker))) issues.push("noise_marker");
  return issues;
}

export function schemaValidatePoem(poem, { axes, themes }) {
  if (!poem || typeof poem !== "object") return { status: "rejected", reason: "bad_object" };
  if (typeof poem.id !== "string" || !poem.id.trim()) return { status: "rejected", reason: "bad_id" };
  if (typeof poem.title !== "string" || !poem.title.trim()) return { status: "rejected", reason: "bad_title" };
  if (typeof poem.author !== "string" || !poem.author.trim()) return { status: "rejected", reason: "bad_author" };
  if (!Array.isArray(poem.v) || poem.v.length !== axes.length) return { status: "rejected", reason: "bad_vector" };
  if (!poem.v.every((x) => Number.isFinite(Number(x)))) return { status: "rejected", reason: "bad_vector_value" };

  const text = typeof poem.text === "string" ? poem.text.trim() : "";
  const lc = lineCount(text);
  const status = lc >= 4 && lc <= 20 ? "ready" : "placeholder";

  const tags = Array.isArray(poem.tags) ? poem.tags.filter((tag) => typeof tag === "string" && themes.includes(tag)) : [];

  return {
    status,
    value: {
      id: poem.id.trim(),
      title: poem.title.trim(),
      author: poem.author.trim(),
      year: typeof poem.year === "string" ? poem.year.trim() : "",
      tags,
      v: poem.v.map((x) => Number(x)),
      text,
      source: typeof poem.source === "string" ? poem.source : "",
      catalogStatus: status,
      meta: poem.meta && typeof poem.meta === "object" ? poem.meta : {}
    }
  };
}

export function normalizeCatalog(items, { axes, themes, seed = [] }) {
  const dedupIds = new Set();
  const dedupText = new Set();
  const merged = [];

  const stats = {
    ready: 0,
    placeholder: 0,
    rejected: 0,
    deduped: 0
  };

  function tryAdd(poem) {
    const validated = schemaValidatePoem(poem, { axes, themes });
    if (validated.status === "rejected") {
      stats.rejected += 1;
      return;
    }

    const normalized = validated.value;
    const idKey = normalized.id;
    if (dedupIds.has(idKey)) {
      stats.deduped += 1;
      return;
    }

    const textKey = normalized.text.toLowerCase().replace(/\s+/g, " ").trim();
    if (textKey && dedupText.has(textKey)) {
      stats.deduped += 1;
      return;
    }

    dedupIds.add(idKey);
    if (textKey) dedupText.add(textKey);
    merged.push(normalized);
    stats[normalized.catalogStatus] += 1;
  }

  seed.forEach(tryAdd);
  items.forEach(tryAdd);

  return { poems: merged, stats };
}

export function editorialReviewCatalog(poems) {
  const byText = new Map();
  const byMeta = new Map();
  const report = {
    ready: [],
    placeholder: [],
    rejected: [],
    duplicates: [],
    noisy: []
  };

  for (const poem of poems) {
    const textKey = String(poem.text || "").toLowerCase().replace(/\s+/g, " ").trim();
    const metaKey = `${poem.author}::${poem.title}::${poem.year || ""}`.toLowerCase();
    const issues = detectEditorialIssues(poem);

    if (poem.catalogStatus === "ready" && issues.length === 0) {
      report.ready.push(poem);
    } else if (poem.catalogStatus === "placeholder" || issues.includes("empty_text")) {
      report.placeholder.push({ poem, issues });
    } else {
      report.rejected.push({ poem, issues });
    }

    if (issues.includes("noise_marker")) report.noisy.push({ poem, issues });
    if (textKey) {
      if (byText.has(textKey)) report.duplicates.push({ type: "text", first: byText.get(textKey), duplicate: poem.id });
      else byText.set(textKey, poem.id);
    }
    if (byMeta.has(metaKey)) report.duplicates.push({ type: "meta", first: byMeta.get(metaKey), duplicate: poem.id });
    else byMeta.set(metaKey, poem.id);
  }

  return report;
}

export function buildAnchorCandidates(poems, limit = 100) {
  return poems
    .filter((poem) => poem.catalogStatus === "ready")
    .sort((a, b) => {
      const ay = Number(a.year || 0);
      const by = Number(b.year || 0);
      if (ay && by && ay !== by) return ay - by;
      return `${a.author} ${a.title}`.localeCompare(`${b.author} ${b.title}`, "ru");
    })
    .slice(0, limit)
    .map((poem) => ({
      id: poem.id,
      author: poem.author,
      title: poem.title,
      year: poem.year || "",
      source: poem.source || "",
      verified_text: false,
      verified_meta: false,
      reviewer: "",
      reviewed_at: ""
    }));
}

export function splitCatalog(poems) {
  return {
    ready: poems.filter((poem) => poem.catalogStatus === "ready"),
    placeholder: poems.filter((poem) => poem.catalogStatus === "placeholder")
  };
}

export async function loadLocalCatalog({ url, axes, themes, seed = [] }) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    if (response.status === 404) {
      return { status: "ready", poems: seed, stats: { ready: seed.length, placeholder: 0, rejected: 0, deduped: 0 } };
    }
    throw new Error("Не удалось загрузить локальный каталог стихов.");
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Файл каталога имеет неверный формат.");
  }

  const normalized = normalizeCatalog(payload, { axes, themes, seed });
  return { status: "ready", poems: normalized.poems, stats: normalized.stats };
}

export function selectPlaceholderMatches(placeholders, topThemes, limit = 8) {
  const scored = placeholders
    .map((poem) => {
      let score = 0;
      for (const theme of topThemes) {
        if ((poem.tags || []).includes(theme)) score += 1;
      }
      if (poem.meta?.required_by_user) score += 0.6;
      return { poem, score };
    })
    .sort((a, b) => b.score - a.score || a.poem.id.localeCompare(b.poem.id, "ru"));

  return scored.slice(0, limit).map((x) => x.poem);
}
