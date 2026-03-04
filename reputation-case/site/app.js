const grid = document.getElementById("digestGrid");
const template = document.getElementById("cardTemplate");
const stats = document.getElementById("stats");
const updatedAt = document.getElementById("updatedAt");
const langSwitch = document.getElementById("langSwitch");
const searchInput = document.getElementById("searchInput");

const state = {
  lang: "ALL",
  query: "",
  items: [],
};

init();

async function init() {
  const response = await fetch("./data/digests.json", { cache: "no-store" });
  const payload = await response.json();
  state.items = payload.items;
  updatedAt.textContent = payload.updated_at || "-";
  bindEvents();
  render();
}

function bindEvents() {
  langSwitch.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-lang]");
    if (!button) return;
    state.lang = button.dataset.lang;
    langSwitch
      .querySelectorAll(".lang-btn")
      .forEach((node) => node.classList.toggle("active", node === button));
    render();
  });

  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });
}

function render() {
  const filtered = state.items.filter((item) => {
    const langMatch = state.lang === "ALL" || item.language === state.lang;
    if (!langMatch) return false;
    if (!state.query) return true;

    const haystack = [
      item.title,
      item.source,
      item.topic,
      item.digest,
      item.language,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(state.query);
  });

  renderStats();
  renderGrid(filtered);
}

function renderStats() {
  const counts = state.items.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.language] = (acc[item.language] || 0) + 1;
      return acc;
    },
    { total: 0 }
  );

  stats.innerHTML = "";
  [`Total: ${counts.total}`, `EN: ${counts.EN || 0}`, `FR: ${counts.FR || 0}`, `DE: ${counts.DE || 0}`].forEach(
    (text) => {
      const pill = document.createElement("span");
      pill.className = "stat-pill";
      pill.textContent = text;
      stats.appendChild(pill);
    }
  );
}

function renderGrid(items) {
  grid.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No items match the current filter.";
    grid.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const node = template.content.firstElementChild.cloneNode(true);

    node.querySelector(".lang-tag").textContent = item.language;

    const statusTag = node.querySelector(".status-tag");
    statusTag.textContent = item.status;
    statusTag.dataset.status = item.status;

    node.querySelector(".card-title").textContent = item.title;
    node.querySelector(".card-meta").textContent = `${item.source} • ${item.date} • ${item.topic}`;
    node.querySelector(".card-digest").textContent = item.digest;
    node.querySelector(".card-quote").textContent = item.quote;

    const link = node.querySelector(".card-link");
    link.href = item.url;

    fragment.appendChild(node);
  }

  grid.appendChild(fragment);
}
