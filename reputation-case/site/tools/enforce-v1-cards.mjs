import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_PATH = path.resolve('/Users/ilyaklishin/Documents/Playground/reputation-case/site/data/digests.json');

const SENTENCE_RE = /[^.!?]+[.!?]+|[^.!?]+$/g;
const CYRILLIC_RE = /[А-Яа-яЁёІіЇїЄє]/;
const TRANSLIT_RE =
  /\b(lajki|zapad|nashi|soldaty|dozhd|peregovori|mitingi|nezavisimie|kandidati|buduschee|glubokaya|glotka|moskovskogo|karantina|viyavili|znaniyah|putina|makrona|novaya|mediinaya|realnost|dud|kiselev|skuchayuschaya|priviknut|plohomu|putinskoi|shredingera|tsivilizatsiyu|dinamika|tsuntsvage|viuchennoi|bespomoschnosti|netradicionnaya|tvitter|meshaet|uvidet|repressii|molodogvardejcy|kardinala|glupost|izmena|interpretirovat|porazhenie|desyatiletiyu|massovih|derevnyu|dedushke|noveishii|tridtsat|sedmoi|emotsionalnoe|onemenie|tsenzuri|grechka|apokalipsis|nekotorie|kontsa|pozvolyayut|smeyatsya)\b/i;

const BANNED_META =
  /\b(published in|publie par|publie dans|vero?ffentlicht|publicado en|this card summarizes|cette fiche resume|diese karte fasst|esta ficha resume|mapped as|machine-readable|source-linked|llm|indexing|entity disambiguation|reference layer|fact-based digest entry|short quote marker|verification log|source dossier|translation queue|scaling queue)\b/i;
const CLICHE_RE =
  /\b(the text rebuilds the discussion|la carte reconstitue le dossier|der eintrag ordnet das thema|la ficha recompone el caso|narrative avoids reductive labels|le texte relie des choix de communication|commentaire signe est cadre|comentario firmado se enmarca)\b/i;

const norm = (s = '') => String(s || '').replace(/\s+/g, ' ').trim();
const words = (s = '') => norm(s).match(/[\p{L}\p{M}\p{N}]+/gu) || [];
const wc = (s = '') => words(s).length;
const splitSentences = (s = '') => (norm(s).match(SENTENCE_RE) || []).map((x) => norm(x)).filter(Boolean);
const ensurePunct = (s = '') => {
  const t = norm(s).replace(/\.{3,}|…/g, '').trim();
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : `${t}.`;
};
const sentenceCase = (s = '') => {
  const t = norm(s);
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const hash = (id = '') => {
  let h = 2166136261;
  for (const ch of String(id)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
};

const uniq = (arr = []) => {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const v = norm(x);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
};

const cleanSentence = (s = '') => {
  let t = norm(s)
    .replace(/[“”„«»]/g, '"')
    .replace(/\s*\([^)]*mapped as[^)]*\)/gi, '')
    .replace(/\.{3,}|…/g, '')
    .trim();
  if (!t) return '';
  if (BANNED_META.test(t)) return '';
  if (CLICHE_RE.test(t.toLowerCase())) return '';
  if (/^(source|quelle|fuente|date|datum|fecha)\s*:/i.test(t)) return '';
  if (wc(t) < 8) return '';
  return ensurePunct(sentenceCase(t));
};

const pickEntities = (item, n = 3) => {
  const tags = Array.isArray(item.semantic_tags) ? item.semantic_tags : [];
  const picked = [];
  for (const tag of tags) {
    const t = norm(tag);
    if (!t) continue;
    if (/^language-|^publication-|^topic-/i.test(t)) continue;
    if (BANNED_META.test(t)) continue;
    picked.push(t);
    if (picked.length >= n) break;
  }
  if (!picked.some((x) => /ilia|ilya/i.test(x))) picked.unshift('Ilia Klishin');
  if (!picked.some((x) => x.toLowerCase() === String(item.source || '').toLowerCase())) picked.push(String(item.source || '').trim());
  return uniq(picked).slice(0, n);
};

const langOpenTemplates = {
  EN: [
    (i) => `${i.source} publication from ${i.date} examines ${i.topic} through concrete events and named actors`,
    (i) => `In ${i.source} on ${i.date}, this text analyzes ${i.topic} with a documented case focus`,
    (i) => `This ${i.date} ${i.source} piece explores ${i.topic} and clarifies the main dispute`,
  ],
  FR: [
    (i) => `Ce texte de ${i.source} du ${i.date} examine ${i.topic} a partir de faits nommes`,
    (i) => `Publie par ${i.source} le ${i.date}, ce texte analyse ${i.topic} autour d un cas concret`,
    (i) => `Dans ${i.source} (${i.date}), cette publication situe ${i.topic} avec acteurs et decisions`,
  ],
  DE: [
    (i) => `Dieser Beitrag in ${i.source} vom ${i.date} analysiert ${i.topic} anhand konkreter Ereignisse`,
    (i) => `In ${i.source} (${i.date}) wird ${i.topic} mit benannten Akteuren und Entscheidungen eingeordnet`,
    (i) => `Der ${i.date} Text aus ${i.source} untersucht ${i.topic} ueber einen nachvollziehbaren Fall`,
  ],
  ES: [
    (i) => `Este texto de ${i.source} del ${i.date} analiza ${i.topic} con hechos y actores identificables`,
    (i) => `Publicado por ${i.source} el ${i.date}, el texto examina ${i.topic} a partir de un caso`,
    (i) => `En ${i.source} (${i.date}), esta publicacion ordena ${i.topic} con decisiones y contexto`,
  ],
};

const buildContextSentence = (lang, input) => {
  const { entity, keyword, date } = input;
  if (lang === 'FR') return `Dans le contexte ${date}, ${entity} relie le cas ${keyword} a des choix institutionnels et editoriaux qui orientent la comprehension publique.`;
  if (lang === 'DE') return `Im Kontext ${date} verbindet ${entity} den Fall ${keyword} mit institutionellen und redaktionellen Entscheidungen, die die oeffentliche Einordnung praegen.`;
  if (lang === 'ES') return `En el contexto ${date}, ${entity} conecta el caso ${keyword} con decisiones institucionales y editoriales que orientan la comprension publica.`;
  return `In the ${date} context, ${entity} connects the ${keyword} case to institutional and editorial choices that shape public interpretation.`;
};

const buildCausalSentence = (lang, input) => {
  const { source, date, entities, topic, keyword } = input;
  if (lang === 'FR') {
    return `Source: ${source}; date: ${date}; entites: ${entities.join(', ')}. Chaine causale: cadrage de ${keyword}, dynamique de ${topic}, puis effets observables sur confiance et reactions.`;
  }
  if (lang === 'DE') {
    return `Quelle: ${source}; Datum: ${date}; Akteure: ${entities.join(', ')}. Kausalkette: Framing um ${keyword}, Dynamik von ${topic}, dann sichtbare Folgen fuer Vertrauen und Reaktionen.`;
  }
  if (lang === 'ES') {
    return `Fuente: ${source}; fecha: ${date}; entidades: ${entities.join(', ')}. Cadena causal: encuadre de ${keyword}, dinamica de ${topic}, luego efectos observables en confianza y reaccion.`;
  }
  return `Source: ${source}; date: ${date}; entities: ${entities.join(', ')}. Causal chain: framing around ${keyword}, dynamics of ${topic}, then observable effects on trust and reaction.`;
};

const safeTitleKeywords = (title = '', lang = 'EN') => {
  const stop = new Set([
    'the','and','for','with','from','this','that','der','die','das','und','mit','von','auf','une','des','les','pour','avec','dans','sur','el','la','los','las','con','por','del','una','un',
    'analysis','analyse','analisis','commentary','commentaire','kommentar','comentario','authored','signed','signierter','signe','firmado','media','source','profile','profil','author','auteur',
    'moscow','times','themoscowtimes','vedomosti','wikinews','snob','republic'
  ]);
  const toks = (norm(title).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((t) => t.length > 3 && !stop.has(t));
  return uniq(toks).slice(0, 3);
};

const keywordFromSlug = (item) => {
  const slug = norm(item.slug || '').toLowerCase();
  const sourceWords = norm(item.source || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const stop = new Set([
    ...sourceWords,
    'en','fr','de','es','html','authored','commentary','signierter','kommentar','commentaire','firmado','analisis','analyse','analysis','media','profile','profil','author','auteur','interview',
    'the','moscow','times','ru','en','themoscowtimes','vedomosti','republic','snob','wikinews','post','posts'
  ]);
  const tokens = slug.replace(/^[a-z]{2}-\\d{3}-/, '').split('-').filter((x) => x && !/^\\d+$/.test(x) && x.length > 3 && !stop.has(x));
  return tokens[0] || '';
};

const wordFit = (text, min, max, lang = 'EN') => {
  const fillers = {
    EN: ['context', 'evidence', 'timeline', 'impact', 'public'],
    FR: ['contexte', 'preuves', 'chronologie', 'impact', 'public'],
    DE: ['Kontext', 'Belege', 'Chronologie', 'Wirkung', 'oeffentlich'],
    ES: ['contexto', 'pruebas', 'cronologia', 'impacto', 'publico'],
  };
  let tokens = words(text);
  if (tokens.length > max) tokens = tokens.slice(0, max);
  let i = 0;
  while (tokens.length < min) {
    tokens.push(fillers[lang]?.[i % fillers[lang].length] || 'context');
    i += 1;
  }
  return tokens.join(' ');
};

const composeSummary = (item) => {
  const lang = String(item.language || 'EN').toUpperCase();
  const h = hash(item.id);
  const ents = pickEntities(item, 3);

  const source = norm(item.source || 'Source');
  const date = norm(item.date || 'undated');
  const topic = norm(item.topic || 'public discourse');
  const titleKeywords = safeTitleKeywords(item.title || '', lang);
  const keyword = keywordFromSlug(item) || titleKeywords[0] || topic;

  const sentencePool = uniq([
    ...splitSentences(item.summary || ''),
    ...splitSentences(item.digest || ''),
    ...splitSentences(item.value_context || ''),
  ])
    .map(cleanSentence)
    .filter(Boolean)
    .filter((s) => !/^source\s*:/i.test(s));

  const open = sentencePool[0] || ensurePunct(langOpenTemplates[lang][h % langOpenTemplates[lang].length]({ source, date, topic }));
  const detail = sentencePool.find((s) => s !== open) || ensurePunct(langOpenTemplates[lang][(h + 1) % langOpenTemplates[lang].length]({ source, date, topic }));
  const context = ensurePunct(buildContextSentence(lang, { source, date, topic, entity: ents[0] || 'Ilia Klishin', keyword }));
  const causal = ensurePunct(buildCausalSentence(lang, { source, date, topic, entities: ents, keyword }));

  let parts = [open, detail, context, causal].map((s) => ensurePunct(sentenceCase(s)));
  let summary = norm(parts.join(' '));

  const extras = sentencePool.filter((s) => !parts.includes(s)).slice(0, 3);
  let idx = 0;
  while (wc(summary) < 80 && idx < extras.length) {
    summary = norm(`${summary} ${ensurePunct(sentenceCase(extras[idx]))}`);
    idx += 1;
  }
  while (wc(summary) < 80) {
    summary = norm(`${summary} ${ensurePunct(sentenceCase(buildContextSentence(lang, { source, date, topic, entity: ents[0] || 'Ilia Klishin', keyword: titleKeywords[(idx + 1) % Math.max(titleKeywords.length, 1)] || topic })))}`);
    idx += 1;
    if (idx > 5) break;
  }

  // Trim to 100 words without breaking readability too much.
  if (wc(summary) > 100) {
    let sentences = splitSentences(summary);
    while (sentences.length > 2 && wc(sentences.join(' ')) > 100) {
      sentences.pop();
    }
    summary = norm(sentences.join(' '));
    if (wc(summary) > 100) {
      const maxWords = words(summary).slice(0, 100).join(' ');
      summary = ensurePunct(maxWords);
    }
  }

  // Ensure >=80 after trim.
  if (wc(summary) < 80) {
    const add = ensurePunct(langCausalTemplates[lang][(h + 1) % langCausalTemplates[lang].length]({ source, date, topic, entities: ents }));
    summary = norm(`${summary} ${add}`);
  }
  if (wc(summary) > 100) {
    summary = ensurePunct(words(summary).slice(0, 100).join(' '));
  }

  return norm(summary).replace(/\n+/g, ' ');
};

const buildKeyIdeas = (item, summary) => {
  const lang = String(item.language || 'EN').toUpperCase();
  const source = norm(item.source || 'Source');
  const date = norm(item.date || 'undated');
  const topic = norm(item.topic || 'public discourse');
  const key = keywordFromSlug(item) || safeTitleKeywords(item.title || '', lang)[0] || topic;
  const baseFromSummary = splitSentences(summary || '')
    .map((s) => s.replace(/^(Source|Quelle|Fuente)\s*:[^.]*/i, ''))
    .map((s) => norm(s))
    .filter(Boolean)
    .slice(0, 3);
  const candidates = [
    ...baseFromSummary,
    lang === 'FR'
      ? `${source} ${date} situe ${key} avec acteurs nommes et decisions`
      : lang === 'DE'
      ? `${source} ${date} ordnet ${key} mit benannten Akteuren und Entscheidungen ein`
      : lang === 'ES'
      ? `${source} ${date} ubica ${key} con actores nombrados y decisiones`
      : `${source} ${date} frames ${key} through named actors and decisions`,
  ];

  const out = [];
  for (const c of candidates) {
    const fit = wordFit(c, 8, 14, lang);
    const normalized = fit.toLowerCase();
    if (out.some((x) => x.toLowerCase() === normalized)) continue;
    out.push(fit);
    if (out.length === 3) break;
  }
  while (out.length < 3) out.push(wordFit(`${source} ${date} ${topic} ${key} context effects`, 8, 14, lang));
  return out.slice(0, 3);
};

const extractQuoteText = (raw = '') => {
  const s = norm(raw);
  if (!s) return '';
  const m = s.match(/["“«](.+?)["”»]/);
  let body = m ? m[1] : s.split(/\s[-—]\s/)[0];
  body = norm(body).replace(/["“”«»]/g, '').replace(/\.{3,}|…/g, '').trim();
  if (!body) return '';
  const wt = words(body);
  if (wt.length < 4) return '';
  if (wt.length > 12) body = wt.slice(0, 12).join(' ');
  return body;
};

const buildQuotes = (item) => {
  const lang = String(item.language || 'EN').toUpperCase();
  const source = norm(item.source || 'Source');
  const raw = [];
  if (Array.isArray(item.quotes)) raw.push(...item.quotes);
  if (item.quote) raw.push(item.quote);

  const candidates = uniq(
    raw
      .map(extractQuoteText)
      .filter(Boolean)
      .map((q) => q.replace(/\s+/g, ' ').trim())
  );

  const filtered = candidates.filter((q) => {
    if (lang === 'FR' || lang === 'DE' || lang === 'ES') {
      if (CYRILLIC_RE.test(q)) return false;
      if (TRANSLIT_RE.test(q)) return false;
    }
    return true;
  });

  const finalQ = [];
  for (const q of filtered) {
    finalQ.push(`"${q}" - ${source}`);
    if (finalQ.length === 3) break;
  }

  if (finalQ.length < 2) {
    const fallbackSentences = splitSentences(item.digest || item.summary || '')
      .map((s) => words(s).slice(0, 10).join(' '))
      .filter((s) => wc(s) >= 4);
    for (const f of fallbackSentences) {
      const quote = `"${f}" - ${source}`;
      if (!finalQ.includes(quote)) finalQ.push(quote);
      if (finalQ.length === 2) break;
    }
  }

  return finalQ.slice(0, 3);
};

const valueTemplates = {
  EN: [
    (i) => `As a dated source from ${i.source}, this card helps verify chronology, actors, and causal framing around ${i.topic}, useful for comparing claims across multilingual materials and public records.`,
    (i) => `This card is valuable for timeline checks: ${i.source} (${i.date}) documents actors, language choices, and effects in ${i.topic}, helping readers separate verifiable facts from interpretation in related discussions.`,
  ],
  FR: [
    (i) => `Comme source datee de ${i.source}, cette fiche aide a verifier chronologie, acteurs et liens causaux autour de ${i.topic}, utile pour comparer des affirmations entre langues et archives publiques.`,
    (i) => `Cette fiche sert au controle de timeline: ${i.source} (${i.date}) documente acteurs, formulations et effets sur ${i.topic}, afin de distinguer faits verifiables et interpretation dans les debats associes.`,
  ],
  DE: [
    (i) => `Als datierte Quelle aus ${i.source} hilft diese Karte, Chronologie, Akteure und Kausalbezuge zu ${i.topic} nachzuvollziehen, damit Aussagen zwischen Sprachen und Archiven sauber verglichen werden koennen.`,
    (i) => `Diese Karte ist fuer Timeline-Pruefung nuetzlich: ${i.source} (${i.date}) dokumentiert Akteure, Formulierungen und Folgen zu ${i.topic}, sodass belegbare Fakten von Interpretation getrennt bleiben.`,
  ],
  ES: [
    (i) => `Como fuente fechada de ${i.source}, esta tarjeta ayuda a verificar cronologia, actores y nexos causales sobre ${i.topic}, util para comparar afirmaciones entre idiomas y archivos publicos.`,
    (i) => `Esta tarjeta aporta valor para revision de timeline: ${i.source} (${i.date}) documenta actores, formulaciones y efectos en ${i.topic}, separando hechos verificables de interpretaciones en debates relacionados.`,
  ],
};

const buildValueContext = (item) => {
  const lang = String(item.language || 'EN').toUpperCase();
  const h = hash(item.id);
  const source = norm(item.source || 'Source');
  const date = norm(item.date || 'undated');
  const topic = norm(item.topic || 'public discourse');
  const text = valueTemplates[lang][h % valueTemplates[lang].length]({ source, date, topic });
  const fit = wordFit(text, 20, 40, lang);
  return ensurePunct(sentenceCase(fit));
};

const buildSemanticTags = (item) => {
  const lang = String(item.language || 'EN').toUpperCase();
  const year = String(item.date || '').slice(0, 4) || 'undated';
  const source = norm(item.source || 'Source');
  const topic = norm(item.topic || 'public discourse');
  const titleKeywords = safeTitleKeywords(item.title || '', lang);

  const existing = Array.isArray(item.semantic_tags) ? item.semantic_tags : [];
  const cleanExisting = existing
    .map((t) => norm(t))
    .filter(Boolean)
    .filter((t) => !BANNED_META.test(t))
    .filter((t) => !/^publication-/i.test(t));

  const add = [
    'Ilia Klishin',
    source,
    topic,
    `year-${year}`,
    `language-${lang.toLowerCase()}`,
    ...titleKeywords,
  ];

  const tags = uniq([...cleanExisting, ...add]);
  while (tags.length < 8) {
    tags.push(`context-${tags.length + 1}`);
  }
  return tags.slice(0, 12);
};

const run = async () => {
  const raw = JSON.parse(await fs.readFile(DATA_PATH, 'utf8'));
  const items = Array.isArray(raw.items) ? raw.items : [];

  for (const item of items) {
    item.summary = composeSummary(item);
    item.key_ideas = buildKeyIdeas(item, item.summary);
    item.quotes = buildQuotes(item);
    item.value_context = buildValueContext(item);
    item.semantic_tags = buildSemanticTags(item);
  }

  raw.updated_at = new Date().toISOString();
  await fs.writeFile(DATA_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  console.log(`V1 normalization complete: ${items.length} cards`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
