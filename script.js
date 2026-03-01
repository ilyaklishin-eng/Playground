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

let lastQuestion = "";
let shownQuotes = [];

function setMessage(text, isError = true) {
  formMessageNode.textContent = text;
  formMessageNode.style.color = isError ? "#a33f36" : "#2f6b4d";
}

function setBusy(isBusy) {
  submitBtn.disabled = isBusy;
  nextBtn.disabled = isBusy;
  submitBtn.textContent = isBusy ? "Ищем..." : "Найти цитату";
}

function updateCounter() {
  charCounterNode.textContent = `${questionNode.value.length} / ${MAX_QUESTION_LEN}`;
}

function showResult(result) {
  resultCardNode.classList.remove("hidden");
  quoteTextNode.textContent = `«${result.quote}»`;
  const yearSuffix = result.year ? `, ${result.year}` : "";
  quoteMetaNode.textContent = `${result.author} — ${result.title}${yearSuffix}`;
  quoteSourceNode.textContent = `Источник: ${result.sourceName || "НКРЯ"}`;
}

async function requestQuote(question, excludeQuotes) {
  const response = await fetch("/api/nkry/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: question,
      limit: 12,
      excludeQuotes
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "НКРЯ сейчас недоступен.");
  }

  const payload = await response.json();
  const quote = sanitizeQuote(payload.quote);
  if (!quote) throw new Error("НКРЯ не вернул валидную цитату по запросу.");
  return quote;
}

async function runSearch(question, isVariant = false) {
  setBusy(true);
  setMessage("");

  try {
    const quote = await requestQuote(question, shownQuotes);
    showResult(quote);

    shownQuotes = pushShownQuote(shownQuotes, quote.quote, 20);

    nextBtn.classList.remove("hidden");
    if (isVariant) setMessage("Показан другой вариант.", false);
  } finally {
    setBusy(false);
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const validated = validateQuestion(questionNode.value, MAX_QUESTION_LEN);
  if (!validated.ok) {
    setMessage(validated.reason);
    return;
  }
  const question = validated.value;

  if (question !== lastQuestion) {
    shownQuotes = [];
    lastQuestion = question;
  }

  resultCardNode.classList.add("hidden");
  await runSearch(question, false);
}

async function handleNext() {
  const validated = validateQuestion(questionNode.value, MAX_QUESTION_LEN);
  if (!validated.ok) {
    setMessage(validated.reason);
    return;
  }
  const question = validated.value;

  await runSearch(question, true);
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

updateCounter();
