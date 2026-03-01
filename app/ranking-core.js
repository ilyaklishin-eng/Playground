import { createHash } from "node:crypto";

export const DEFAULT_WEIGHTS = {
  literal: 1,
  associative: 1,
  state: 1,
  hit: 1,
  intent: 1,
  context: 1,
  literaryPenalty: 1,
  lengthPenalty: 1,
  diversityPenalty: 0.75
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stemPrefix(token) {
  if (token.length <= 5) return token;
  return token.slice(0, 5);
}

export function buildFingerprint(candidate) {
  const basis = normalizeText(`${candidate.author}|${candidate.title}|${candidate.quote}`);
  return createHash("sha1").update(basis).digest("hex").slice(0, 16);
}

export function createUserModel() {
  return {
    updatedAt: "",
    lastDecayAt: Date.now(),
    weights: { ...DEFAULT_WEIGHTS },
    byAuthor: {},
    byFingerprint: {},
    byReason: {
      tone: 0,
      theme: 0,
      rhythm: 0,
      too_dark: 0,
      too_abstract: 0
    },
    recentFeedback: []
  };
}

export function applyDecay(model, nowMs = Date.now()) {
  if (!model.lastDecayAt) {
    model.lastDecayAt = nowMs;
    return model;
  }

  const elapsedDays = Math.max(0, (nowMs - model.lastDecayAt) / (1000 * 60 * 60 * 24));
  if (elapsedDays < 0.25) return model;

  // Daily soft decay to avoid long-lived bias.
  const factor = Math.pow(0.98, elapsedDays);
  for (const key of Object.keys(model.byAuthor)) {
    model.byAuthor[key] = Number((model.byAuthor[key] * factor).toFixed(6));
    if (Math.abs(model.byAuthor[key]) < 0.0005) delete model.byAuthor[key];
  }
  for (const key of Object.keys(model.byFingerprint)) {
    model.byFingerprint[key] = Number((model.byFingerprint[key] * factor).toFixed(6));
    if (Math.abs(model.byFingerprint[key]) < 0.0005) delete model.byFingerprint[key];
  }
  for (const key of Object.keys(model.byReason)) {
    model.byReason[key] = Number((model.byReason[key] * factor).toFixed(6));
  }
  model.lastDecayAt = nowMs;
  return model;
}

export function detectIntentProfiles(tokens) {
  const set = new Set();
  const has = (stem) => tokens.some((token) => token.includes(stem) || stem.includes(stemPrefix(token)));

  if (has("смысл") || has("зачем") || has("жизн") || has("пустот") || has("ценност")) set.add("meaning");
  if (has("любов") || has("отнош") || has("сердц") || has("близ") || has("одиноч")) set.add("relation");
  if (has("тревог") || has("страх") || has("паник") || has("бою") || has("смят")) set.add("anxiety");
  if (has("надеж") || has("вер") || has("будущ") || has("оптим") || has("свет")) set.add("hope");
  if (has("свобод") || has("вол") || has("рамк") || has("выбор")) set.add("freedom");
  if (has("утрат") || has("потер") || has("разочар")) set.add("loss");

  return set;
}

export function scoreIntentLexicon(intentProfiles, text) {
  if (!intentProfiles.size) return 0;

  let score = 0;
  const lexicon = {
    meaning: ["смысл", "жизн", "душ", "истин", "вечност", "судьб", "путь", "быт", "цель", "ценност"],
    relation: ["любов", "сердц", "нежн", "верност", "разлук", "мил", "близ", "одиноч", "объять", "вместе"],
    anxiety: ["тревог", "страх", "мрак", "тоска", "смятени", "боль", "паник", "ужас", "пустот", "дрож"],
    hope: ["надеж", "свет", "утро", "заря", "вера", "весна", "тишь", "покой", "радост"],
    freedom: ["свобод", "воля", "ветер", "простор", "крыл", "полет", "дорог", "выбор"],
    loss: ["утрат", "потер", "разлук", "прощан", "слез", "пепел", "памят"]
  };

  for (const profile of intentProfiles) {
    const stems = lexicon[profile] || [];
    const hits = stems.reduce((acc, stem) => acc + (text.includes(stem) ? 1 : 0), 0);
    score += Math.min(5, hits) * 1.05;
  }

  return score;
}

export function estimateTone(text) {
  const source = normalizeText(text);
  const bright = ["свет", "надеж", "утро", "весн", "радост", "вера", "любов", "мир", "тишь", "покой"];
  const dark = ["тревог", "страх", "мрак", "тоска", "печал", "горе", "боль", "пустот", "мрак", "холод"];

  const positive = bright.reduce((acc, stem) => acc + (source.includes(stem) ? 1 : 0), 0);
  const negative = dark.reduce((acc, stem) => acc + (source.includes(stem) ? 1 : 0), 0);
  return clamp((positive - negative) / 5, -1, 1);
}

export function scoreLiteraryPenalty(candidate) {
  const sourceText = normalizeText(
    [candidate.title, candidate.docHeader, candidate.docType, candidate.docTopic, candidate.docStyle].join(" ")
  );
  const harsh = ["форум", "коммент", "блог", "переписк", "интернет", "рецепт", "документ", "инструкц", "отчет", "протокол"];
  const soft = ["коммерц", "финанс", "право", "бизн", "производств"];
  const lyrical = ["поэм", "стих", "дневник", "роман", "повест", "элег", "сонет", "лирик"];

  let penalty = 0;
  for (const stem of harsh) if (sourceText.includes(stem)) penalty += 4.5;
  for (const stem of soft) if (sourceText.includes(stem)) penalty += 2.2;
  for (const stem of lyrical) if (sourceText.includes(stem)) penalty -= 1.2;
  return penalty;
}

export function getFeedbackBias(candidate, model) {
  const authorKey = normalizeText(candidate.author || "");
  const fingerprint = buildFingerprint(candidate);
  const byAuthor = Number(model.byAuthor?.[authorKey] || 0);
  const byFingerprint = Number(model.byFingerprint?.[fingerprint] || 0);
  return clamp(byFingerprint * 0.35 + byAuthor * 0.2, -1, 1);
}

export function scoreCandidate({
  candidate,
  queryTokens,
  queryTokenWeights = {},
  queryGroups,
  queryContext = null,
  stateWeights,
  excludeAuthors = [],
  model
}) {
  const text = normalizeText(`${candidate.quote} ${candidate.title} ${candidate.author}`);
  const metaText = normalizeText(
    `${candidate.docType || ""} ${candidate.docStyle || ""} ${candidate.docTopic || ""} ${candidate.docHeader || ""}`
  );
  const jointText = `${text} ${metaText}`;
  const intentProfiles = detectIntentProfiles(queryTokens);

  let literal = 0;
  for (const token of queryTokens) {
    const stem = stemPrefix(token);
    const weight = Number(queryTokenWeights[token] || 1);
    if (jointText.includes(token)) literal += 2 * weight;
    else if (jointText.includes(stem)) literal += 1 * weight;
  }

  let associative = 0;
  for (const group of queryGroups) {
    const stems = stateWeights.__associativeGroups?.[group] || [];
    if (stems.some((stem) => jointText.includes(stem))) associative += 1.5;
  }

  let stateBoost = 0;
  if (stateWeights && typeof stateWeights === "object") {
    for (const [group, weight] of Object.entries(stateWeights)) {
      if (group === "__associativeGroups") continue;
      const stems = stateWeights.__associativeGroups?.[group] || [];
      if (stems.some((stem) => jointText.includes(stem))) stateBoost += Number(weight || 0) * 0.9;
    }
  }

  const hitBoost = Math.min(2.5, Number(candidate.hitCount || 0) * 0.7);
  const intentBoost = scoreIntentLexicon(intentProfiles, jointText);
  const literaryPenalty = scoreLiteraryPenalty(candidate);
  const lengthPenalty = candidate.quote.length > 420 ? 2.2 : candidate.quote.length > 320 ? 1.1 : 0;
  const tone = estimateTone(jointText);
  const feedbackBias = getFeedbackBias(candidate, model);
  const authorKey = normalizeText(candidate.author);
  const diversityPenalty = excludeAuthors.includes(authorKey) ? model.weights.diversityPenalty : 0;
  const contextComponent = scoreContextMatch(candidate, jointText, queryContext);

  const components = {
    literal,
    associative,
    stateBoost,
    hitBoost,
    intentBoost,
    literaryPenalty,
    lengthPenalty,
    diversityPenalty,
    feedbackBias,
    contextComponent,
    tone
  };

  const score =
    components.literal * model.weights.literal +
    components.associative * model.weights.associative +
    components.stateBoost * model.weights.state +
    components.hitBoost * model.weights.hit +
    components.intentBoost * model.weights.intent +
    components.contextComponent * (model.weights.context || 1) +
    components.feedbackBias -
    components.literaryPenalty * model.weights.literaryPenalty -
    components.lengthPenalty * model.weights.lengthPenalty -
    components.diversityPenalty;

  return { score, components };
}

function scoreContextMatch(candidate, jointText, queryContext) {
  if (!queryContext || typeof queryContext !== "object") return 0;
  const preferred = Array.isArray(queryContext.preferredStems) ? queryContext.preferredStems : [];
  const avoid = Array.isArray(queryContext.avoidStems) ? queryContext.avoidStems : [];

  let boost = 0;
  for (const stem of preferred) {
    if (jointText.includes(stem)) boost += 0.65;
  }

  let penalty = 0;
  for (const stem of avoid) {
    if (jointText.includes(stem)) penalty += 1.25;
  }

  const yearMatch = String(candidate?.year || "").match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : NaN;
  if (queryContext.isIntrospective && Number.isFinite(year) && year < 1800) penalty += 1.4;

  if (queryContext.isIntrospective) {
    if (candidate.quote.length >= 70 && candidate.quote.length <= 300) boost += 0.7;
    if (candidate.quote.length > 420) penalty += 0.9;
  }

  if (queryContext.isPolitical) {
    if (/(государ|власт|прав|закон|общест|граждан|полит)/.test(jointText)) boost += 0.8;
  }

  return clamp(boost - penalty, -6, 6);
}

export function pickTopCandidate(filtered, variantMode, previousTone) {
  if (!filtered.length) return null;
  const top = filtered[0];
  if (variantMode !== "contrast" || !Number.isFinite(previousTone)) return top;

  const relevanceFloor = top.score - 0.65;
  const pool = filtered.filter((item) => item.score >= relevanceFloor).slice(0, 18);
  if (!pool.length) return top;

  return pool
    .map((item) => {
      const contrastBonus = Math.abs((item.scoreDetails?.tone || 0) - previousTone) * 1.45;
      return { item, rankScore: item.score + contrastBonus };
    })
    .sort((a, b) => b.rankScore - a.rankScore)[0].item;
}

export function applyFeedbackLearning(model, { rating, reason, candidate, nowMs = Date.now() }) {
  applyDecay(model, nowMs);
  const signal = clamp((Number(rating) - 3) / 2, -1, 1);
  const authorKey = normalizeText(candidate?.author || "");
  const fingerprint = String(candidate?.fingerprint || "");

  if (authorKey) model.byAuthor[authorKey] = clamp(Number(model.byAuthor[authorKey] || 0) + signal * 0.35, -4, 4);
  if (fingerprint) model.byFingerprint[fingerprint] = clamp(Number(model.byFingerprint[fingerprint] || 0) + signal * 0.55, -5, 5);

  const mappedReason = String(reason || "");
  if (mappedReason && Object.prototype.hasOwnProperty.call(model.byReason, mappedReason)) {
    model.byReason[mappedReason] = clamp(model.byReason[mappedReason] + signal * 0.2, -3, 3);
  }

  if (mappedReason === "tone") model.weights.intent = clamp(model.weights.intent + signal * 0.08, 0.4, 2.4);
  if (mappedReason === "theme") {
    model.weights.associative = clamp(model.weights.associative + signal * 0.08, 0.4, 2.4);
    model.weights.literal = clamp(model.weights.literal + signal * 0.05, 0.4, 2.4);
  }
  if (mappedReason === "rhythm") model.weights.lengthPenalty = clamp(model.weights.lengthPenalty + signal * 0.06, 0.4, 2.4);
  if (mappedReason === "too_dark") {
    model.weights.literaryPenalty = clamp(model.weights.literaryPenalty + Math.max(signal * -0.09, -0.03), 0.4, 2.4);
  }
  if (mappedReason === "too_abstract") model.weights.intent = clamp(model.weights.intent + signal * 0.05, 0.4, 2.4);

  model.updatedAt = new Date(nowMs).toISOString();
  model.recentFeedback.push({
    ts: model.updatedAt,
    rating: Number(rating),
    reason: mappedReason,
    author: candidate?.author || "",
    title: candidate?.title || "",
    fingerprint
  });
  model.recentFeedback = model.recentFeedback.slice(-500);
  return model;
}

export function createServedQuoteRegistry({ ttlMs = 10 * 60 * 1000, maxSize = 8000 } = {}) {
  const map = new Map();
  function sweep(now = Date.now()) {
    for (const [key, value] of map.entries()) {
      if (now - value.createdAt > ttlMs) map.delete(key);
    }
    if (map.size > maxSize) {
      const overflow = map.size - maxSize;
      let removed = 0;
      for (const key of map.keys()) {
        map.delete(key);
        removed += 1;
        if (removed >= overflow) break;
      }
    }
  }

  return {
    issue(userKey, candidate) {
      const id = createHash("sha1").update(`${Date.now()}|${Math.random()}|${candidate.fingerprint}`).digest("hex").slice(0, 20);
      map.set(id, { ...candidate, userKey, createdAt: Date.now() });
      sweep();
      return id;
    },
    consume(userKey, servedQuoteId) {
      const value = map.get(servedQuoteId);
      if (!value) return null;
      if (value.userKey !== userKey) return null;
      if (Date.now() - value.createdAt > ttlMs) {
        map.delete(servedQuoteId);
        return null;
      }
      map.delete(servedQuoteId);
      return value;
    }
  };
}
