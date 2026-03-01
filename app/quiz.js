import { LIKERT_LABELS } from "./config.js";

export function shuffled(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function parseScaleValue(raw) {
  if (raw === null || raw === undefined || raw === "") return Number.NaN;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 5) return Number.NaN;
  return value;
}

export function pickQuestions(pool, { count = 8, themeMap = {} } = {}) {
  const target = Math.max(1, Math.min(Number(count) || 8, pool.length));
  const randomized = shuffled(pool);

  const buckets = new Map();
  for (const question of randomized) {
    const mapped = themeMap[question.theme] || [question.theme];
    const primaryTheme = mapped[0] || question.theme;
    if (!buckets.has(primaryTheme)) buckets.set(primaryTheme, []);
    buckets.get(primaryTheme).push(question);
  }

  const themes = shuffled([...buckets.keys()]);
  const out = [];
  const used = new Set();
  let progressed = true;

  while (out.length < target && progressed) {
    progressed = false;
    for (const theme of themes) {
      const bucket = buckets.get(theme);
      if (!bucket || !bucket.length) continue;
      const next = bucket.pop();
      if (!next || used.has(next.id)) continue;
      out.push(next);
      used.add(next.id);
      progressed = true;
      if (out.length >= target) break;
    }
  }

  if (out.length < target) {
    for (const question of randomized) {
      if (used.has(question.id)) continue;
      out.push(question);
      used.add(question.id);
      if (out.length >= target) break;
    }
  }

  return out;
}

export function isQuestionAnswered(formNode, index) {
  return Boolean(formNode.querySelector(`input[name="q_${index}"]:checked`));
}

export function updateProgress({ activeQuestions, formNode, progressTextNode, progressFillNode, progressTrackNode }) {
  const total = Math.max(1, activeQuestions.length);
  const answered = activeQuestions.reduce((count, _, index) => count + (isQuestionAnswered(formNode, index) ? 1 : 0), 0);
  const ratio = (answered / total) * 100;
  progressTextNode.textContent = `${answered}/${total}`;
  progressFillNode.style.width = `${ratio}%`;
  progressTrackNode.setAttribute("aria-valuenow", String(answered));
  progressTrackNode.setAttribute("aria-valuemax", String(total));
}

export function renderQuestions({ questionsNode, activeQuestions }) {
  questionsNode.innerHTML = "";

  activeQuestions.forEach((question, index) => {
    const wrapper = document.createElement("section");
    wrapper.className = "question";
    wrapper.dataset.index = String(index);
    wrapper.style.setProperty("--enter-delay", `${index * 24}ms`);

    const fieldset = document.createElement("fieldset");
    fieldset.className = "scale";
    const hintId = `q_hint_${index}`;
    fieldset.setAttribute("aria-describedby", hintId);

    const legend = document.createElement("legend");
    legend.className = "question-legend";
    legend.textContent = `${index + 1}. ${question.text}`;
    fieldset.appendChild(legend);

    const row = document.createElement("div");
    row.className = "scale-options";

    for (let value = 1; value <= 5; value += 1) {
      const token = LIKERT_LABELS[value];
      const label = document.createElement("label");
      label.className = "scale-option";
      label.dataset.value = String(value);

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `q_${index}`;
      input.value = String(value);
      input.required = true;
      input.setAttribute("aria-label", `${value} из 5: ${token.short}`);

      const visual = document.createElement("span");
      visual.innerHTML = `<span class="scale-mark">${token.icon} ${value}</span><span class="scale-label">${token.short}</span>`;

      label.appendChild(input);
      label.appendChild(visual);
      row.appendChild(label);
    }

    const hint = document.createElement("div");
    hint.className = "scale-hint";
    hint.id = hintId;
    hint.innerHTML = "<span>1: совсем нет</span><span>5: очень про меня</span>";

    fieldset.appendChild(row);
    fieldset.appendChild(hint);
    wrapper.appendChild(fieldset);
    questionsNode.appendChild(wrapper);
  });
}

export function syncMobileStep({ questionsNode, activeQuestions, formNode }) {
  if (!window.matchMedia("(max-width: 700px)").matches) {
    questionsNode.querySelectorAll(".question").forEach((node) => node.classList.remove("active-step"));
    return;
  }

  let currentIndex = activeQuestions.length - 1;
  for (let index = 0; index < activeQuestions.length; index += 1) {
    if (!isQuestionAnswered(formNode, index)) {
      currentIndex = index;
      break;
    }
  }

  questionsNode.querySelectorAll(".question").forEach((node) => {
    const idx = Number(node.dataset.index);
    node.classList.toggle("active-step", idx === currentIndex);
  });
}
