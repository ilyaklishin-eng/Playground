export const MAX_QUESTION_LEN = 300;

export function sanitizeQuote(item) {
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

export function validateQuestion(rawQuestion, maxLen = MAX_QUESTION_LEN) {
  const question = String(rawQuestion || "").trim();
  if (!question) return { ok: false, reason: "Введите вопрос.", value: "" };
  if (question.length > maxLen) {
    return { ok: false, reason: `Вопрос должен быть не длиннее ${maxLen} символов.`, value: question };
  }
  return { ok: true, reason: "", value: question };
}

export function pushShownQuote(shownQuotes, quote, maxSize = 20) {
  const list = Array.isArray(shownQuotes) ? [...shownQuotes] : [];
  const text = String(quote || "").trim();
  if (!text) return list;
  list.push(text);
  return list.length > maxSize ? list.slice(-maxSize) : list;
}

