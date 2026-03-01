const form = document.getElementById("query-form");
const wordNode = document.getElementById("word");
const submitBtn = document.getElementById("submit-btn");
const messageNode = document.getElementById("message");

const resultCardNode = document.getElementById("result-card");
const quoteTextNode = document.getElementById("quote-text");
const quoteMetaNode = document.getElementById("quote-meta");
const quoteSourceNode = document.getElementById("quote-source");

function normalizeWord(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9-]/gi, "");
}

function validateWord(rawWord) {
  const word = normalizeWord(rawWord);
  if (!word) return { ok: false, reason: "Введите одно слово.", value: "" };
  if (word.length < 2 || word.length > 48) {
    return { ok: false, reason: "Слово должно быть длиной от 2 до 48 символов.", value: word };
  }
  if (!/^[a-zа-я0-9]+(?:-[a-zа-я0-9]+)?$/i.test(word)) {
    return { ok: false, reason: "Разрешены только буквы/цифры и один дефис внутри слова.", value: word };
  }
  return { ok: true, reason: "", value: word };
}

function sanitizeQuote(item) {
  if (!item || typeof item !== "object") return null;
  const quote = String(item.quote || "").trim();
  if (!quote) return null;
  return {
    quote,
    author: String(item.author || "Не указан"),
    title: String(item.title || "Без названия"),
    year: String(item.year || ""),
    sourceName: String(item.sourceName || "НКРЯ")
  };
}

function setBusy(isBusy) {
  submitBtn.disabled = isBusy;
  submitBtn.textContent = isBusy ? "Ищем..." : "Показать первое употребление";
}

function setMessage(text, isError = false) {
  messageNode.textContent = text || "";
  messageNode.classList.toggle("error", isError);
}

function showResult(payload) {
  const quote = sanitizeQuote(payload.quote);
  if (!quote) throw new Error("НКРЯ не вернул корректную цитату.");

  quoteTextNode.textContent = `«${quote.quote}»`;
  quoteMetaNode.textContent = quote.year
    ? `${quote.author} — ${quote.title}, ${quote.year}`
    : `${quote.author} — ${quote.title}`;
  quoteSourceNode.textContent = `Источник: ${quote.sourceName}`;

  resultCardNode.classList.remove("hidden");
  resultCardNode.focus();
}

async function requestFirstUsage(word) {
  const response = await fetch("/api/nkry/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload.error || "Не удалось получить цитату."));
  }

  return response.json();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const validated = validateWord(wordNode.value);
  if (!validated.ok) {
    setMessage(validated.reason, true);
    resultCardNode.classList.add("hidden");
    return;
  }

  setBusy(true);
  setMessage("Ищем первую фиксацию слова в НКРЯ...");

  try {
    const payload = await requestFirstUsage(validated.value);
    showResult(payload);
    setMessage("");
  } catch (error) {
    resultCardNode.classList.add("hidden");
    setMessage(error.message || "Ошибка запроса.", true);
  } finally {
    setBusy(false);
  }
});

wordNode.addEventListener("input", () => {
  if (messageNode.textContent) setMessage("");
});
