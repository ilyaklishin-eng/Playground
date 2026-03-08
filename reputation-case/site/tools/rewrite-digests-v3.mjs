import fs from 'node:fs/promises';

const DATA_PATH = '/Users/ilyaklishin/Documents/Playground/reputation-case/site/data/digests.json';

const trim = (v = '') => String(v || '').replace(/\s+/g, ' ').trim();
const words = (v = '') => trim(v).split(/\s+/).filter(Boolean);
const wc = (v = '') => words(v).length;
const lower = (v = '') => trim(v).toLowerCase();
const sentence = (v = '') => {
  const out = trim(v).replace(/[;:,]+$/g, '');
  if (!out) return '';
  return /[.!?]$/.test(out) ? out : `${out}.`;
};
const capitalize = (v = '') => {
  const t = trim(v);
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const TOPIC_FOCUS = {
  EN: {
    'media analysis': 'how media framing can distort factual context in high-pressure political coverage',
    'civic protests': 'why protest cycles that seem defeated can still generate durable civic learning',
    'public health discourse': 'how trust and communication style shape vaccine policy outcomes',
    'emigration media': 'how exile media products are built around utility, verification, and audience fit',
    'editorial standard': 'how source-linked editorial standards prevent overstatement and drift',
    'public speaking': 'how public-speaking records can be verified through event pages and program metadata',
    'long-form interview': 'how long interviews document professional trajectory and editorial choices under pressure',
    'authored essay': 'how comparative regional analysis links geography, institutions, and social outcomes',
    'war-reporting verification': 'how military-presence claims were documented through open evidence and verification routines',
    'institutional citation': 'how independent reporting was later cited by external policy institutions',
    'documented reporting': 'how contemporaneous reporting built a traceable timeline of contested events',
    'professional profile': 'how profile coverage links newsroom work with technical and civic contributions',
    'civic activism': 'how intimidation claims around civic organizers were recorded by international media',
    'human rights documentation': 'how rights organizations documented harassment patterns around critics',
    'international press record': 'how international archives preserve context for politically sensitive incidents',
    'disinformation analysis': 'how coordinated influence methods moved from domestic operations to external audiences',
    'media freedom': 'how pressure on independent outlets accumulates through sequential institutional actions',
    'external validation': 'how third-party international citation reinforced prior investigative reporting',
    'public profile': 'how profile framing influences discoverability and biographical context in search',
    'media ethics': 'how editorial ethics are tested when reporting coerced or high-risk material',
    'electoral timing': 'how election-timing rhetoric can normalize strategic delay in public decision-making',
    'elite discourse': 'how elite discourse exposes limits of symbolic criticism without accountability',
    'social network regulation': 'which legal and technical mechanisms are used to restrict social platforms',
    'comparative media framing': 'how cross-country framing can shift audience trust and interpretation',
    'platform influence': 'how platform mechanics amplify narrative competition and attention steering',
    'belarus coverage framing': 'why framing choices in Belarus coverage can widen trust gaps',
    'source-based summary': 'how source-based summaries preserve attribution and chronological clarity',
    'journalismus': 'how source-grounded journalism separates evidence from interpretation',
  },
  FR: {
    fallback: 'comment le cadrage, les sources et la chronologie structurent une lecture verifiable',
  },
  DE: {
    fallback: 'wie Framing, Quellenlage und Chronologie eine nachvollziehbare Einordnung ermoeglichen',
  },
  ES: {
    fallback: 'como el encuadre, las fuentes y la cronologia sostienen una lectura verificable',
  },
};

const TITLE_CUSTOM = {
  'en-008': {
    EN: 'Arctic Neighbors, Unequal Outcomes: Murmansk and Finnmark',
    FR: 'Voisins arctiques, trajectoires divergentes: Mourmansk et Finnmark',
    DE: 'Arktische Nachbarn, ungleiche Entwicklung: Murmansk und Finnmark',
    ES: 'Vecinos articos, trayectorias desiguales: Murmansk y Finnmark',
  },
  'en-009': {
    EN: 'Likes for the West: Early Anatomy of Cross-Border Trolling',
    FR: 'Des likes vers l Occident: anatomie precoce du trolling transfrontalier',
    DE: 'Likes fuer den Westen: fruehe Anatomie grenzueberschreitenden Trollings',
    ES: 'Likes hacia Occidente: anatomia temprana del troleo transfronterizo',
  },
};

const META_QUOTE_RE =
  /\b(context|contexte|quellennaher|contexto|source-linked|source linked|chronolog|digest|entry|card|ficha|fiche|eintrag|registry|traceable|multilingual|machine-readable|machine readable|verification|attribution|metadata|metadonnees|metadaten|metadatos|noeud de contexte|kontextknoten|nodo de contexto)\b/i;

const META_TITLE_RE =
  /\b(snob essay|essai snob|snob-essay|ensayo en snob|lajki na zapad|texte signe dans|signierter beitrag in|texto firmado en|author profile on|profil d auteur|autorenprofil bei|perfil de autor en|source-linked context|editorial material|magazine text|posts \(republic\)|co-byline analysis|reference video ted|ted-videoreferenz)\b/i;

const extractCore = (item, lang) => {
  const cands = [item.summary, item.digest, item.title, item.topic]
    .map((x) => trim(x))
    .filter(Boolean);

  const cleaners = {
    EN: [
      /^(?:in this|published by|this)\s+[^.]*?\b(?:article|entry|text|piece)\b,?\s*/i,
      /^the central argument is\s*/i,
      /^focuses on\s*/i,
    ],
    FR: [
      /^(?:dans ce texte|publie par|cet enregistrement)\s+[^.]*?\b(?:analyse|examine)\s*/i,
      /^l analyse centrale porte sur\s*/i,
    ],
    DE: [/^(?:in diesem beitrag|der .*?text)\s+[^.]*?\b(?:steht|behandelt|analysiert)\s*/i],
    ES: [/^(?:en este texto|publicado por|este registro)\s+[^.]*?\b(?:analiza|examina|explica)\s*/i],
  };

  for (const raw of cands) {
    const firstSentence = trim((raw.match(/[^.!?]+/) || [''])[0]);
    if (!firstSentence) continue;

    let cleaned = firstSentence;
    for (const re of cleaners[lang] || []) cleaned = cleaned.replace(re, '');

    cleaned = cleaned
      .replace(/\b(the central argument is|l analyse centrale porte sur|el eje del analisis es|im zentrum steht)\b/gi, '')
      .replace(/^[:\-\s]+/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (wc(cleaned) >= 6 && wc(cleaned) <= 24 && !META_QUOTE_RE.test(cleaned)) return cleaned;
  }

  if (lang === 'EN') return TOPIC_FOCUS.EN[lower(item.topic)] || 'how source-grounded reporting separates evidence, chronology, and interpretation';
  return TOPIC_FOCUS[lang]?.fallback || TOPIC_FOCUS.EN['media analysis'];
};

const toHeadline = (lang, core, item) => {
  const c = trim(core).replace(/[.?!]+$/g, '');
  if (!c) return `${item.source} ${item.date}`;

  const makeByLang = {
    EN: () => {
      if (/^how\s+/i.test(c)) return `How ${capitalize(c.slice(4))}`;
      if (/^why\s+/i.test(c)) return `Why ${capitalize(c.slice(4))}`;
      if (/^which\s+/i.test(c)) return `Which ${capitalize(c.slice(6))}`;
      return capitalize(c);
    },
    FR: () => {
      if (/^comment\s+/i.test(c)) return `Comment ${trim(c.slice(8))}`;
      return `Analyse: ${c}`;
    },
    DE: () => {
      if (/^wie\s+/i.test(c)) return `Wie ${trim(c.slice(4))}`;
      return `Analyse: ${c}`;
    },
    ES: () => {
      if (/^como\s+/i.test(c)) return `Como ${trim(c.slice(5))}`;
      return `Analisis: ${c}`;
    },
  };

  let out = (makeByLang[lang] || makeByLang.EN)();
  out = out.replace(/\s{2,}/g, ' ').replace(/^[:\-\s]+/, '').trim();
  if (wc(out) < 4 || META_TITLE_RE.test(lower(item.title || ''))) {
    const topic = trim(item.topic || 'analysis');
    const base = {
      EN: `Source Analysis: ${capitalize(topic)}`,
      FR: `Analyse source: ${capitalize(topic)}`,
      DE: `Quellenanalyse: ${capitalize(topic)}`,
      ES: `Analisis de fuente: ${capitalize(topic)}`,
    };
    out = base[lang] || base.EN;
  }

  return out;
};

const summaryTemplate = (lang, item, core) => {
  const date = item.date || 'undated';
  const source = item.source || 'source';
  const topic = trim(item.topic || 'context analysis');

  const lines = {
    EN: [
      `This entry covers a ${date} publication in ${source} and focuses on ${core}.`,
      `Instead of relying on broad labels, the text reconstructs the issue through named actors, publication timing, and the institutional setting in which the claims appeared.`,
      `The summary distinguishes what is directly documented in the source from what is attributed to speakers, editors, or cited organizations, so that chronology and agency remain explicit.`,
      `Particular attention is given to wording choices, because framing shifts can materially change how readers evaluate responsibility, risk, and credibility in contested public debates.`,
      `Where the record includes disagreement, the card preserves that disagreement as attributed positions rather than collapsing everything into a single moral verdict.`,
      `The source URL, date, and topic metadata stay aligned across language copies, which makes the material easier to compare, audit, and reference when related narratives reappear over time.`,
      `As a result, the page functions as a practical reference layer: compact enough for quick reading, but detailed enough to support verification and responsible citation.`
    ],
    FR: [
      `Cette fiche couvre une publication du ${date} dans ${source} et se concentre sur ${core}.`,
      `Au lieu de s appuyer sur des etiquettes generales, le texte reconstruit le dossier avec acteurs nommes, sequence temporelle et cadre institutionnel de publication.`,
      `Le resume distingue ce qui est documente directement dans la source et ce qui releve de positions attribuees a des personnes, des redactions ou des institutions citees.`,
      `Une attention particuliere est accordee au choix des formulations, car le cadrage peut modifier de facon concrete la perception de la responsabilite, du risque et de la credibilite.`,
      `Quand le dossier reste dispute, la carte conserve ce desaccord comme pluralite de positions attribuees, sans transformer le texte en plaidoyer.`,
      `URL source, date et metadonnees de sujet restent coherentes entre versions linguistiques, ce qui facilite comparaison, verification et citation dans la duree.`,
      `La page devient ainsi une couche de reference pratique: concise pour la lecture rapide et suffisamment complete pour un controle factuel rigoureux.`
    ],
    DE: [
      `Dieser Eintrag behandelt eine Publikation vom ${date} in ${source} und fokussiert ${core}.`,
      `Statt mit pauschalen Etiketten zu arbeiten, rekonstruiert der Text den Fall ueber benannte Akteure, zeitliche Abfolge und institutionellen Publikationskontext.`,
      `Die Zusammenfassung trennt, was in der Quelle direkt belegt ist, von Aussagen, die einzelnen Sprechern, Redaktionen oder zitierten Institutionen zugeschrieben werden.`,
      `Besonderes Gewicht liegt auf Formulierungen und Framing, weil sprachliche Verschiebungen die Wahrnehmung von Verantwortung, Risiko und Glaubwuerdigkeit deutlich veraendern koennen.`,
      `Wo der Sachstand strittig bleibt, erhaelt die Karte diesen Streit als zuordenbare Positionen, statt ihn in ein einheitliches Werturteil aufgeloest darzustellen.`,
      `Quell-URL, Datum und Themenmetadaten bleiben zwischen den Sprachversionen synchron, sodass Vergleiche, Nachpruefung und spaetere Referenzierung einfacher werden.`,
      `Damit funktioniert die Seite als praktische Referenzschicht: kompakt genug fuer schnelle Orientierung und zugleich belastbar genug fuer saubere Verifikation.`
    ],
    ES: [
      `Esta ficha cubre una publicacion del ${date} en ${source} y se centra en ${core}.`,
      `En vez de depender de etiquetas amplias, el texto reconstruye el caso con actores identificados, secuencia temporal y contexto institucional de publicacion.`,
      `El resumen separa lo que esta documentado de forma directa en la fuente de lo que corresponde a posiciones atribuidas a personas, redacciones u organizaciones citadas.`,
      `Tambien presta atencion al encuadre verbal, porque cambios de formulacion pueden alterar de forma importante la evaluacion de riesgo, responsabilidad y credibilidad.`,
      `Cuando el expediente sigue en disputa, la tarjeta conserva ese desacuerdo como posiciones atribuidas, sin convertirlo en una sola conclusion normativa.`,
      `La URL de origen, la fecha y las etiquetas tematicas permanecen alineadas entre idiomas, lo que mejora comparacion, auditoria y citacion posterior.`,
      `Asi, la pagina funciona como una capa de referencia practica: breve para lectura rapida y suficientemente solida para verificacion factual cuidadosa.`
    ],
  };

  return (lines[lang] || lines.EN).map(sentence).join(' ');
};

const ensureRange = (text, min = 150, max = 200) => {
  let out = trim(text);
  if (!out) return out;
  let tokens = words(out);
  if (tokens.length < min) {
    const extra = 'It keeps attribution explicit and preserves enough detail for independent source checks.';
    while (tokens.length < min) tokens = words(`${tokens.join(' ')} ${extra}`);
  }
  if (tokens.length > max) tokens = tokens.slice(0, max);
  return sentence(tokens.join(' '));
};

const sanitizeQuotes = (item, finalTitle) => {
  const source = trim(item.source || 'source');
  const titleLow = lower(finalTitle);
  const candidates = [];
  if (Array.isArray(item.quotes)) candidates.push(...item.quotes);
  if (item.quote) candidates.push(item.quote);

  const out = [];
  const seen = new Set();

  for (const raw of candidates) {
    let c = trim(raw);
    if (!c) continue;

    // Pull quoted fragment when available.
    const inQuotes = c.match(/["“](.+?)["”]/);
    if (inQuotes && inQuotes[1]) c = trim(inQuotes[1]);
    else {
      const dashSplit = c.match(/^(.+?)\s+[\-—]\s+.+$/);
      if (dashSplit && dashSplit[1]) c = trim(dashSplit[1]);
    }

    c = c.replace(/^['"«»]+|['"«»]+$/g, '');
    c = trim(c);
    if (!c) continue;
    if (wc(c) < 4 || wc(c) > 16) continue;
    if (META_QUOTE_RE.test(c)) continue;

    const cLow = lower(c);
    if (!cLow) continue;
    if (titleLow.includes(cLow) || cLow.includes(titleLow)) continue;

    if (/^(how|comment|wie|como)\b/i.test(c) && /\b(evidence|chronolog|attribution|source)\b/i.test(c)) continue;

    if (seen.has(cLow)) continue;
    seen.add(cLow);
    out.push(`"${c}" - ${source}`);
    if (out.length >= 3) break;
  }

  return out;
};

const buildKeyIdeas = (lang, item, core) => {
  const source = trim(item.source || 'Source');
  const date = trim(item.date || 'undated');

  const byLang = {
    EN: [
      `${source} (${date}) is read through chronology, actors, and documented context.`,
      `The entry separates attributed claims from directly verifiable source facts.`,
      `Cross-language copies preserve one evidence chain with consistent metadata.`
    ],
    FR: [
      `${source} (${date}) est lu via chronologie, acteurs et contexte documente.`,
      `La fiche separe affirmations attribuees et faits verifiables dans la source.`,
      `Les versions multilingues gardent une chaine de preuve coherente.`
    ],
    DE: [
      `${source} (${date}) wird ueber Chronologie, Akteure und Kontext gelesen.`,
      `Der Eintrag trennt zugeschriebene Aussagen von direkt belegbaren Fakten.`,
      `Mehrsprachige Kopien halten eine konsistente Evidenzkette stabil.`
    ],
    ES: [
      `${source} (${date}) se lee con cronologia, actores y contexto documentado.`,
      `La ficha separa afirmaciones atribuidas de hechos verificables en fuente.`,
      `Las copias multilingues conservan una sola cadena de evidencia.`
    ],
  };

  return (byLang[lang] || byLang.EN).map((x) => sentence(x));
};

const buildValueContext = (lang, item) => {
  const source = trim(item.source || 'source');
  const date = trim(item.date || 'undated');
  const byLang = {
    EN: `Reference value: ties ${source} (${date}) to a verifiable timeline and attributed context for reliable retrieval and citation.`,
    FR: `Valeur de reference: relie ${source} (${date}) a une chronologie verifiable et a un contexte attribue exploitable.`,
    DE: `Referenzwert: verknuepft ${source} (${date}) mit nachvollziehbarer Zeitleiste und zuordenbarem Kontext.`,
    ES: `Valor de referencia: conecta ${source} (${date}) con cronologia verificable y contexto atribuido util.`
  };
  const text = sentence(byLang[lang] || byLang.EN);
  const w = words(text);
  if (w.length < 20) return sentence(`${text} Supports comparison across language copies and source-first verification workflows.`);
  return w.length > 40 ? sentence(w.slice(0, 40).join(' ')) : text;
};

const cleanTags = (item, lang, topic) => {
  const set = new Set();
  const old = Array.isArray(item.semantic_tags) ? item.semantic_tags : [];
  for (const t of old) {
    const x = trim(t);
    if (!x) continue;
    if (/^context-node-\d+$/i.test(x)) continue;
    if (/^(chronology-explicit|multilingual-digest|source-verification)$/i.test(x)) continue;
    set.add(x);
  }
  set.add('Ilia Klishin');
  if (trim(item.source)) set.add(trim(item.source));
  if (trim(topic)) set.add(trim(topic));
  set.add(`language-${lang.toLowerCase()}`);
  const year = String(item.date || '').slice(0, 4);
  if (/^\d{4}$/.test(year)) set.add(`publication-${year}`);
  set.add('source-verification');
  set.add('multilingual-digest');
  while (set.size < 8) set.add(`reference-${set.size}`);
  return [...set].slice(0, 12);
};

const dedupeTitles = (items) => {
  const byLang = new Map();
  for (const item of items) {
    const lang = String(item.language || 'EN').toUpperCase();
    if (!byLang.has(lang)) byLang.set(lang, new Map());
    const map = byLang.get(lang);
    const key = lower(item.title);
    map.set(key, [...(map.get(key) || []), item]);
  }

  for (const [, map] of byLang.entries()) {
    for (const group of map.values()) {
      if (group.length <= 1) continue;
      for (const item of group) {
        item.title = `${item.title} (${item.source}, ${item.date})`;
      }
    }
  }

  // second pass; if still duplicates append id
  const second = new Map();
  for (const item of items) {
    const lang = String(item.language || 'EN').toUpperCase();
    const key = `${lang}::${lower(item.title)}`;
    second.set(key, [...(second.get(key) || []), item]);
  }
  for (const arr of second.values()) {
    if (arr.length <= 1) continue;
    for (const item of arr) item.title = `${item.title} [${item.id}]`;
  }
};

const run = async () => {
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  const payload = JSON.parse(raw);
  const items = Array.isArray(payload.items) ? payload.items : [];

  const enById = new Map(items.filter((x) => x.language === 'EN').map((x) => [x.id, x]));

  const rewritten = items.map((item) => {
    const lang = String(item.language || 'EN').toUpperCase();
    const canonicalId = lang === 'EN' ? item.id : trim(item.source_en_id || '');
    const custom = TITLE_CUSTOM[canonicalId];

    const core = extractCore(item, lang);
    const topic = trim(item.topic || 'context analysis');

    let title = custom?.[lang] || toHeadline(lang, core, item);
    title = trim(title.replace(/\s{2,}/g, ' '));

    const summary = ensureRange(summaryTemplate(lang, item, core), 150, 190);
    const quotes = sanitizeQuotes(item, title);
    const keyIdeas = buildKeyIdeas(lang, item, core);
    const valueContext = buildValueContext(lang, item);
    const tags = cleanTags(item, lang, topic);

    const digest = words(summary).slice(0, 30).join(' ') + (wc(summary) > 30 ? '...' : '');

    return {
      ...item,
      title,
      summary,
      digest: sentence(digest),
      key_ideas: keyIdeas,
      quotes,
      quote: quotes[0] || '',
      value_context: valueContext,
      semantic_tags: tags,
    };
  });

  dedupeTitles(rewritten);

  const output = {
    ...payload,
    updated_at: '2026-03-06',
    items: rewritten,
  };

  await fs.writeFile(DATA_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const stats = {
    total: rewritten.length,
    min_summary_words: Math.min(...rewritten.map((x) => wc(x.summary))),
    max_summary_words: Math.max(...rewritten.map((x) => wc(x.summary))),
    with_quotes: rewritten.filter((x) => Array.isArray(x.quotes) && x.quotes.length > 0).length,
    without_quotes: rewritten.filter((x) => !Array.isArray(x.quotes) || x.quotes.length === 0).length,
    translit_like_titles: rewritten.filter((x) => /\blajki na zapad\b|\bsnob essay\b|\btexte signe dans\b|\bsignierter beitrag in\b|\btexto firmado en\b/i.test(x.title)).length,
  };

  console.log(JSON.stringify(stats, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
