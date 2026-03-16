const uiLang = String(document?.documentElement?.lang || "en")
  .trim()
  .slice(0, 2)
  .toLowerCase();

const COPY = {
  en: { empty: "No materials match the current filters." },
  fr: { empty: "Aucun contenu ne correspond aux filtres actuels." },
  de: { empty: "Keine Eintraege entsprechen den aktuellen Filtern." },
  es: { empty: "No hay materiales que coincidan con los filtros actuales." },
};

const ACTIVE_COPY = COPY[uiLang] || COPY.en;
const state = { format: "all" };
const sections = Array.from(document.querySelectorAll(".interviews-section"));
const filterButtons = Array.from(document.querySelectorAll(".filter-btn[data-format]"));
const filtersSection = document.querySelector(".interviews-filters");

const globalEmpty = ensureGlobalEmpty();

bindFilters();
render();

function ensureGlobalEmpty() {
  let node = document.getElementById("interviews-global-empty");
  if (node) return node;

  node = document.createElement("p");
  node.id = "interviews-global-empty";
  node.className = "interview-empty";
  node.hidden = true;
  node.textContent = ACTIVE_COPY.empty;

  if (filtersSection?.parentNode) {
    filtersSection.parentNode.insertBefore(node, filtersSection.nextSibling);
  }

  return node;
}

function bindFilters() {
  for (const button of filterButtons) {
    button.addEventListener("click", () => {
      const value = String(button.dataset.format || "").trim();
      if (!value || value === state.format) return;
      state.format = value;
      syncButtons();
      render();
    });
  }
}

function syncButtons() {
  for (const button of filterButtons) {
    const active = String(button.dataset.format || "").trim() === state.format;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

function cardMatchesFilter(card) {
  if (state.format === "all") return true;
  const tags = String(card.dataset.formatTags || "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  return tags.includes(state.format);
}

function render() {
  let totalVisible = 0;

  for (const section of sections) {
    const cards = Array.from(section.querySelectorAll(".interview-card"));
    let visibleInSection = 0;

    for (const card of cards) {
      const visible = cardMatchesFilter(card);
      card.hidden = !visible;
      if (visible) visibleInSection += 1;
    }

    section.hidden = visibleInSection === 0;
    totalVisible += visibleInSection;
  }

  globalEmpty.hidden = totalVisible > 0;
}
