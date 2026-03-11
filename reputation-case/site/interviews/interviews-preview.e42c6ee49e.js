import interviews from "/data/interviews-data.js";

const grid = document.getElementById("interviewsPreviewGrid");
if (!grid) {
  // script loaded on a page without interviews preview
} else {
  const items = interviews
    .filter((item) => item.section === "interviews" || item.section === "features")
    .map((item) => ({ ...item, ts: parseDateToTimestamp(item.date) }))
    .sort((a, b) => {
      if (b.ts !== a.ts) return b.ts - a.ts;
      return String(a.title).localeCompare(String(b.title), "ru");
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

function renderPreview(items) {
  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "interview-preview-card";

    const meta = document.createElement("p");
    meta.className = "interview-preview-meta";
    meta.textContent = `${item.displayDate} · ${item.language} · ${item.format}`;

    const title = document.createElement("h3");
    title.className = "interview-preview-title";
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.title;
    title.appendChild(link);

    const desc = document.createElement("p");
    desc.className = "interview-preview-description";
    desc.textContent = item.description;

    const action = document.createElement("a");
    action.className = "interview-preview-open";
    action.href = item.url;
    action.target = "_blank";
    action.rel = "noopener noreferrer";
    action.textContent = "Открыть материал →";

    card.append(meta, title, desc, action);
    fragment.appendChild(card);
  }

  grid.innerHTML = "";
  grid.appendChild(fragment);
}
