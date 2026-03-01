export function showCatalogState(node, mode, text = "") {
  node.className = `catalog-state ${mode}`;
  node.classList.remove("hidden");

  if (mode === "loading") {
    node.innerHTML = `
      <div class="state-title" aria-hidden="true"></div>
      <div class="state-line" aria-hidden="true"></div>
      <div class="state-line short" aria-hidden="true"></div>
    `;
    return;
  }

  node.textContent = text;
}

export function hideCatalogState(node) {
  node.className = "catalog-state hidden";
  node.textContent = "";
}

export function showPlaceholderState(node, text = "") {
  if (!text) {
    node.className = "placeholder-state hidden";
    node.textContent = "";
    return;
  }
  node.className = "placeholder-state";
  node.textContent = text;
}

export function showPoem({ resultNode, poemTitleNode, poemMetaNode, poemNode, poem }) {
  poemTitleNode.textContent = poem.title;
  poemMetaNode.textContent = `${poem.author}, ${poem.year || "без даты"}`;
  poemNode.textContent = poem.text;
  resultNode.classList.remove("hidden");
}

export function renderPlaceholderList({ sectionNode, listNode, items }) {
  if (!items.length) {
    sectionNode.classList.add("hidden");
    listNode.innerHTML = "";
    return;
  }

  listNode.innerHTML = "";
  items.forEach((poem) => {
    const li = document.createElement("li");
    const year = poem.year ? `, ${poem.year}` : "";
    const badge = poem.meta?.required_by_user ? " (обязательный блок)" : "";
    li.textContent = `[placeholder] ${poem.author} — ${poem.title}${year}${badge}`;
    listNode.appendChild(li);
  });
  sectionNode.classList.remove("hidden");
}

export function setReadingMode(enabled) {
  document.body.classList.toggle("reading-mode", Boolean(enabled));
}

export function renderHitScale(node, selected) {
  node.innerHTML = "";
  for (let value = 1; value <= 5; value += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hit-btn";
    btn.dataset.value = String(value);
    if (selected === value) btn.classList.add("active");
    btn.textContent = `${value}`;
    node.appendChild(btn);
  }
}
