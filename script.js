import { MAX_QUESTION_LEN, pushShownQuote, sanitizeQuote, validateQuestion } from "./app/client-runtime.js";

const form = document.getElementById("query-form");
const questionNode = document.getElementById("question");
const counterNode = document.getElementById("counter");
const submitBtn = document.getElementById("submit-btn");
const nextBtn = document.getElementById("next-btn");
const messageNode = document.getElementById("message");

const resultCardNode = document.getElementById("result-card");
const quoteTextNode = document.getElementById("quote-text");
const quoteMetaNode = document.getElementById("quote-meta");
const quoteSourceNode = document.getElementById("quote-source");

let lastQuestion = "";
let shownQuotes = [];
let shownAuthors = [];

function setBusy(isBusy) {
  submitBtn.disabled = isBusy;
  nextBtn.disabled = isBusy;
  submitBtn.textContent = isBusy ? "Ищем..." : "Найти цитату";
}

function setMessage(text, isError = false) {
  messageNode.textContent = text || "";
  messageNode.classList.toggle("error", isError);
}

function updateCounter() {
  counterNode.textContent = `${questionNode.value.length} / ${MAX_QUESTION_LEN}`;
}

function resetContext(question) {
  lastQuestion = question;
  shownQuotes = [];
  shownAuthors = [];
  nextBtn.classList.add("hidden");
  resultCardNode.classList.add("hidden");
}

function showResult(payload) {
  const quote = sanitizeQuote(payload.quote);
  if (!quote) throw new Error("НКРЯ не вернул корректную цитату.");

  quoteTextNode.textContent = `«${quote.quote}»`;
  quoteMetaNode.textContent = quote.year
    ? `${quote.author} — ${quote.title}, ${quote.year}`
    : `${quote.author} — ${quote.title}`;
  quoteSourceNode.textContent = `Источник: ${quote.sourceName || "НКРЯ"}`;

  shownQuotes = pushShownQuote(shownQuotes, quote.quote, 40);
  shownAuthors = pushShownQuote(shownAuthors, quote.author, 20).map((value) => String(value || "").toLowerCase());

  resultCardNode.classList.remove("hidden");
  resultCardNode.focus();
  nextBtn.classList.remove("hidden");
}

async function requestQuote(question) {
  const response = await fetch("/api/nkry/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: question,
      limit: 20,
      variantMode: "default",
      excludeQuotes: shownQuotes,
      excludeAuthors: shownAuthors
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload.error || "Не удалось получить цитату."));
  }

  return response.json();
}

async function runSearch(question) {
  setBusy(true);
  setMessage("Ищем подходящую цитату...");

  try {
    const payload = await requestQuote(question);
    showResult(payload);
    setMessage("");
  } catch (error) {
    resultCardNode.classList.add("hidden");
    setMessage(error.message || "Ошибка запроса.", true);
  } finally {
    setBusy(false);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const validated = validateQuestion(questionNode.value, MAX_QUESTION_LEN);
  if (!validated.ok) {
    setMessage(validated.reason, true);
    return;
  }

  const question = validated.value;
  if (question !== lastQuestion) resetContext(question);
  await runSearch(question);
});

nextBtn.addEventListener("click", async () => {
  const validated = validateQuestion(questionNode.value, MAX_QUESTION_LEN);
  if (!validated.ok) {
    setMessage(validated.reason, true);
    return;
  }

  const question = validated.value;
  if (question !== lastQuestion) resetContext(question);
  await runSearch(question);
});

questionNode.addEventListener("input", () => {
  updateCounter();
  if (messageNode.textContent) setMessage("");
});

updateCounter();
