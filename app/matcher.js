function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

function norm(a) {
  return Math.sqrt(dot(a, a));
}

function cosine(a, b) {
  const denominator = norm(a) * norm(b);
  if (!denominator) return 0;
  return dot(a, b) / denominator;
}

function scoreToSignal(score) {
  return (score - 3) / 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function buildUserVector(answers, axes) {
  const base = axes.reduce((acc, axis) => {
    acc[axis] = 0;
    return acc;
  }, {});

  answers.forEach(({ question, score }) => {
    const signal = scoreToSignal(score);
    Object.entries(question.vector).forEach(([axis, weight]) => {
      base[axis] += signal * weight;
    });
  });

  return axes.map((axis) => base[axis]);
}

export function profileThemes(answers, canonicalThemes, themeMap) {
  const totals = {};
  canonicalThemes.forEach((theme) => {
    totals[theme] = 0;
  });

  answers.forEach(({ question, score }) => {
    const mapped = themeMap[question.theme] || [question.theme];
    mapped.forEach((theme) => {
      if (!Object.prototype.hasOwnProperty.call(totals, theme)) totals[theme] = 0;
      totals[theme] += score;
    });
  });

  return Object.entries(totals)
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme]) => theme);
}

function editorialBoostForPoem(poemId, topThemes, editorialCanon) {
  let score = 0;
  topThemes.forEach((theme) => {
    const canonIds = editorialCanon[theme] || [];
    if (canonIds.includes(poemId)) score += 0.11;
  });
  return Math.min(0.22, score);
}

export function scorePoem({ poem, userVector, topThemes, feedback, editorialCanon, axes }) {
  const similarity = cosine(userVector, poem.v || axes.map(() => 0));

  let themeBoost = 0;
  topThemes.forEach((theme) => {
    if ((poem.tags || []).includes(theme)) themeBoost += 0.14;
  });

  const poemFeedback = clamp(feedback.poem?.[poem.id] || 0, -2.5, 2.5);
  const authorFeedback = clamp(feedback.author?.[poem.author] || 0, -1.8, 1.8);
  const feedbackBoost = clamp(poemFeedback * 0.08 + authorFeedback * 0.05, -0.24, 0.24);

  const editorialBoost = editorialBoostForPoem(poem.id, topThemes, editorialCanon);
  const score = similarity + themeBoost + feedbackBoost + editorialBoost;

  return {
    poem,
    score,
    similarity,
    themeBoost,
    feedbackBoost,
    editorialBoost
  };
}

export function rankPoems({ poems, answers, axes, canonicalThemes, themeMap, feedback, editorialCanon }) {
  const userVector = buildUserVector(answers, axes);
  const topThemes = profileThemes(answers, canonicalThemes, themeMap);

  const ranked = poems
    .map((poem) => scorePoem({ poem, userVector, topThemes, feedback, editorialCanon, axes }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.poem.id.localeCompare(b.poem.id, "ru");
    });

  return { ranked, topThemes };
}
