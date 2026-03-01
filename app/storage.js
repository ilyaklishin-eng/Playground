const FEEDBACK_KEY = "psyche_feedback_v3";
const GEN_COUNT_KEY = "psyche_generation_count_v1";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getFeedbackState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "{}");
    return {
      poem: parsed.poem || {},
      author: parsed.author || {},
      hit: Array.isArray(parsed.hit) ? parsed.hit : []
    };
  } catch {
    return { poem: {}, author: {}, hit: [] };
  }
}

export function saveFeedbackState(state) {
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(state));
}

export function recordHitFeedback({ poemId, author, score, reason }) {
  const state = getFeedbackState();
  const signal = (score - 3) / 2;

  state.poem[poemId] = clamp((state.poem[poemId] || 0) + signal, -2.5, 2.5);
  state.author[author] = clamp((state.author[author] || 0) + signal * 0.45, -1.8, 1.8);
  state.hit.push({ poemId, author, score, reason, ts: Date.now() });
  state.hit = state.hit.slice(-250);

  saveFeedbackState(state);
}

export function clearPersonalization() {
  localStorage.removeItem(FEEDBACK_KEY);
}

export function getGenerationCount() {
  const raw = Number(localStorage.getItem(GEN_COUNT_KEY));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

export function incrementGenerationCount() {
  const next = getGenerationCount() + 1;
  localStorage.setItem(GEN_COUNT_KEY, String(next));
  return next;
}
