import { MAX_QUESTION_LEN, pushShownQuote, sanitizeQuote, validateQuestion } from "./app/client-runtime.js";

const form = document.getElementById("query-form");
const questionNode = document.getElementById("question");
const charCounterNode = document.getElementById("char-counter");
const submitBtn = document.getElementById("submit-btn");
const nextBtn = document.getElementById("next-btn");
const formMessageNode = document.getElementById("form-message");

const resultCardNode = document.getElementById("result-card");
const quoteTextNode = document.getElementById("quote-text");
const quoteMetaNode = document.getElementById("quote-meta");
const quoteSourceNode = document.getElementById("quote-source");
const scoreExplainNode = document.getElementById("score-explain");

const emptyCardNode = document.getElementById("empty-card");
const retrySoftBtn = document.getElementById("retry-soft-btn");
const retryClearBtn = document.getElementById("retry-clear-btn");

const feedbackScaleNode = document.getElementById("feedback-scale");
const feedbackReasonNode = document.getElementById("feedback-reason");
const saveFeedbackBtn = document.getElementById("save-feedback-btn");
const feedbackMessageNode = document.getElementById("feedback-message");

let lastQuestion = "";
let shownQuotes = [];
let shownAuthors = [];
let lastResult = null;
let selectedRating = 0;

function setMessage(text, isError = true) {
  formMessageNode.textContent = text;
  formMessageNode.style.color = isError ? "#a33f36" : "#2f6b4d";
}

function setFeedbackMessage(text, isError = false) {
  feedbackMessageNode.textContent = text;
  feedbackMessageNode.classList.toggle("message-ok", !isError);
}

function setBusy(isBusy) {
  submitBtn.disabled = isBusy;
  nextBtn.disabled = isBusy;
  saveFeedbackBtn.disabled = isBusy;
  submitBtn.textContent = isBusy ? "Ищем..." : "Найти цитату";
  form.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function updateCounter() {
  charCounterNode.textContent = `${questionNode.value.length} / ${MAX_QUESTION_LEN}`;
}

function hideStates() {
  resultCardNode.classList.add("hidden");
  emptyCardNode.classList.add("hidden");
}

function showEmptyState(message) {
  resultCardNode.classList.add("hidden");
  emptyCardNode.classList.remove("hidden");
  setMessage(message || "Не нашли подходящий фрагмент.");
  emptyCardNode.focus();
}

function setSelectedRating(rating) {
  selectedRating = Number(rating) || 0;
  const buttons = feedbackScaleNode.querySelectorAll("button[data-rating]");
  for (const button of buttons) {
    const value = Number(button.dataset.rating || 0);
    button.classList.toggle("active", value === selectedRating);
    button.setAttribute("aria-pressed", value === selectedRating ? "true" : "false");
  }
}

function resetFeedbackUI() {
  setSelectedRating(0);
  feedbackReasonNode.value = "";
  setFeedbackMessage("");
}

function showResult(payload) {
  const quote = sanitizeQuote(payload.quote);
  if (!quote) throw new Error("НКРЯ не вернул валидную цитату по запросу.");

  lastResult = {
    ...quote,
    tone: Number(payload.quote?.tone || 0),
    fingerprint: String(payload.quote?.fingerprint || ""),
    matchedTerms: Array.isArray(payload.quote?.matchedTerms) ? payload.quote.matchedTerms : []
  };

  resultCardNode.classList.remove("hidden");
  emptyCardNode.classList.add("hidden");

  quoteTextNode.textContent = `«${quote.quote}»`;
  const yearSuffix = quote.year ? `, ${quote.year}` : "";
  quoteMetaNode.textContent = `${quote.author} — ${quote.title}${yearSuffix}`;
  quoteSourceNode.textContent = `Источник: ${quote.sourceName || "НКРЯ"}`;

  if (payload.explain) {
    scoreExplainNode.textContent = payload.explain;
    scoreExplainNode.classList.remove("hidden");
  } else {
    scoreExplainNode.textContent = "";
    scoreExplainNode.classList.add("hidden");
  }

  shownQuotes = pushShownQuote(shownQuotes, quote.quote, 20);
  shownAuthors = pushShownQuote(shownAuthors, quote.author, 12).map((x) => String(x || "").toLowerCase());
  resetFeedbackUI();
  resultCardNode.focus();
}

async function requestQuote(question, { isVariant }) {
  const response = await fetch("/api/nkry/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: question,
      limit: 14,
      variantMode: isVariant ? "contrast" : "default",
      previousTone: isVariant && lastResult ? Number(lastResult.tone || 0) : undefined,
      excludeQuotes: shownQuotes,
      excludeAuthors: shownAuthors
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = String(payload.error || "НКРЯ сейчас недоступен.");
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function runSearch(question, isVariant = false) {
  setBusy(true);
  setMessage(isVariant ? "Ищем контрастный вариант..." : "Ищем подходящий фрагмент...", false);
  setFeedbackMessage("");

  try {
    const payload = await requestQuote(question, { isVariant });
    showResult(payload);
    nextBtn.classList.remove("hidden");
    if (isVariant) setMessage("Показан контрастный вариант.", false);
    else setMessage("", false);
  } catch (error) {
    if (error.status === 404 || error.status === 502) {
      showEmptyState(error.message || "Не нашли подходящий фрагмент.");
      return;
    }
    setMessage(error.message || "Ошибка обработки запроса.");
    hideStates();
  } finally {
    setBusy(false);
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const validated = validateQuestion(questionNode.value, MAX_QUESTION_LEN);
  if (!validated.ok) {
    setMessage(validated.reason);
    hideStates();
    return;
  }
  const question = validated.value;

  if (question !== lastQuestion) {
    shownQuotes = [];
    shownAuthors = [];
    lastQuestion = question;
  }

  hideStates();
  await runSearch(question, false);
}

async function handleNext() {
  const validated = validateQuestion(questionNode.value, MAX_QUESTION_LEN);
  if (!validated.ok) {
    setMessage(validated.reason);
    return;
  }
  await runSearch(validated.value, true);
}

async function saveFeedback() {
  if (!lastResult) {
    setFeedbackMessage("Сначала получите результат.", true);
    return;
  }
  if (!selectedRating) {
    setFeedbackMessage("Выберите оценку от 1 до 5.", true);
    return;
  }

  saveFeedbackBtn.disabled = true;
  setFeedbackMessage("Сохраняем...", false);

  try {
    const response = await fetch("/api/nkry/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: lastQuestion,
        rating: selectedRating,
        reason: feedbackReasonNode.value,
        candidate: {
          fingerprint: lastResult.fingerprint,
          author: lastResult.author,
          title: lastResult.title,
          tone: lastResult.tone,
          matchedTerms: lastResult.matchedTerms
        }
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Не удалось сохранить оценку.");
    }

    setFeedbackMessage("Спасибо, оценка учтена для следующих подборов.", false);
  } catch (error) {
    setFeedbackMessage(error.message || "Ошибка сохранения оценки.", true);
  } finally {
    saveFeedbackBtn.disabled = false;
  }
}

function softenQuestion() {
  const value = questionNode.value.trim();
  if (!value) return;
  const short = value
    .replace(/[!?]+/g, ".")
    .split(".")[0]
    .replace(/\s+/g, " ")
    .trim();
  questionNode.value = short || value;
  updateCounter();
  setMessage("Смягчили формулировку. Попробуйте еще раз.", false);
}

questionNode.addEventListener("input", updateCounter);
form.addEventListener("submit", (event) => {
  handleSubmit(event).catch((error) => {
    setBusy(false);
    setMessage(error.message || "Ошибка обработки запроса.");
  });
});

nextBtn.addEventListener("click", () => {
  handleNext().catch((error) => {
    setBusy(false);
    setMessage(error.message || "Ошибка подбора варианта.");
  });
});

feedbackScaleNode.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const rating = Number(target.dataset.rating || 0);
  if (!rating) return;
  setSelectedRating(rating);
});

feedbackScaleNode.addEventListener("keydown", (event) => {
  const active = document.activeElement;
  if (!(active instanceof HTMLButtonElement) || !active.dataset.rating) return;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const current = Number(active.dataset.rating || 0);
  if (!current) return;
  const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  const next = Math.max(1, Math.min(5, current + delta));
  const nextButton = feedbackScaleNode.querySelector(`button[data-rating="${next}"]`);
  if (nextButton instanceof HTMLButtonElement) {
    setSelectedRating(next);
    nextButton.focus();
  }
});

saveFeedbackBtn.addEventListener("click", () => {
  saveFeedback().catch((error) => {
    setFeedbackMessage(error.message || "Ошибка сохранения оценки.", true);
  });
});

retrySoftBtn.addEventListener("click", softenQuestion);
retryClearBtn.addEventListener("click", () => {
  const validated = validateQuestion(questionNode.value, MAX_QUESTION_LEN);
  if (!validated.ok) {
    setMessage(validated.reason);
    return;
  }
  runSearch(validated.value, false).catch((error) => {
    setBusy(false);
    setMessage(error.message || "Ошибка повторного запроса.");
  });
});

updateCounter();
