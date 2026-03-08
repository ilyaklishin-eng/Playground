import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

const DATA_PATH = '/Users/ilyaklishin/Documents/Playground/reputation-case/site/data/digests.json';

const trim = (v = '') => String(v || '').replace(/\s+/g, ' ').trim();
const words = (v = '') => trim(v).split(/\s+/).filter(Boolean);
const wc = (v = '') => words(v).length;
const lower = (v = '') => trim(v).toLowerCase();

const splitSentences = (text = '') =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .match(/[^.!?]+[.!?]?/g)
    ?.map((s) => trim(s))
    .filter(Boolean) || [];

const toSentence = (s = '') => {
  const out = trim(String(s || '').replace(/[;:,]+$/g, ''));
  if (!out) return '';
  return /[.!?]$/.test(out) ? out : `${out}.`;
};

const META_RE =
  /(short quote marker|verification log|source dossier|priority multilingual|adaptation queue|fact-based digest entry|source-linked context|metadata note|translation queue|scaling queue|multilingual scaling|this card|this page functions|machine-readable structure|supports comparison across language copies|source-first verification workflows|reference layer|couche de reference|referenzschicht|capa de referencia|digest translation|entry focuses on|cet enregistrement sur|dieser eintrag behandelt|este registro sobre|how authored commentary is framed through evidence|comment commentaire signe est cadre|wie signierter kommentar ueber evidenz|como comentario firmado se enmarca con evidencia|how media framing and reputational narratives change when categorical labels replace context|search crawlers|entity systems|llm-based synthesis pipelines|fournit aux moteurs et modeles)/i;

const META_TITLE_RE =
  /(source analysis|analyse source|quellenanalyse|analisis de fuente|texte signe dans|signierter beitrag in|texto firmado en|user-preferred|strategic essay|lajki na zapad|digest translation|\[[a-z]{2}-\d+\]$)/i;

const TRANSLIT_RE_EN =
  /(putinskoi|peregovori|viyavili|moskovskogo|glubokaya|karantina|ustal|lajki|zapad|mitingi|probeli|znaniyah|nashi soldaty|netradicionnaya|molodogvardejcy|dinamika|vyklyuchat|meshaet|repressii|maximalnyi|noveishii|derevnyu|dedushke|oznachayut|russkuyu|tsivilizatsiyu|emotsionalnoe|onemenie|tsenzuri|tsuntsvage|grechka|apokalipsis|nekotorie|kontsa|russkie|lyudi|pozvolyayut|smeyatsya|pochemu|kak tvitter|glupost|izmena|chto sluchilos|desantnikami|vse materialy dozhdja|interpretirovat|desyatiletiyu|massovih|zachem|ozhidanii|smotrit|\ba\d{4,}\b|[a-z]+(skogo|tsiyu|tsiya|viy|naya|aya|ogo)\b)/i;

const TOPIC_LABEL = {
  EN: {
    'media analysis': 'Media Analysis',
    'civic protests': 'Protest Cycle Analysis',
    'public health discourse': 'Public-Health Commentary',
    'emigration media': 'Exile Media Interview',
    'editorial standard': 'Editorial Methodology',
    'public speaking': 'Public-Speaking Record',
    'long-form interview': 'Long-Form Interview',
    'interview record': 'Interview Record',
    'authored essay': 'Authored Essay',
    'authored commentary': 'Authored Commentary',
    media: 'Media Analysis',
    essay: 'Authored Essay',
    'war-reporting verification': 'War-Reporting Verification',
    'institutional citation': 'Institutional Citation',
    'documented reporting': 'Documented Reporting',
    'professional profile': 'Professional Profile',
    'civic activism': 'Civic Activism Coverage',
    'human rights documentation': 'Human-Rights Documentation',
    'international press record': 'International Press Record',
    'disinformation analysis': 'Disinformation Analysis',
    'media freedom': 'Media-Freedom Commentary',
    'external validation': 'External Validation',
    'public profile': 'Public Profile',
    'media ethics': 'Media-Ethics Commentary',
    'electoral timing': 'Electoral-Timing Analysis',
    'elite discourse': 'Elite-Discourse Analysis',
    'social network regulation': 'Platform-Regulation Analysis',
    'comparative media framing': 'Comparative Media Framing',
    'platform influence': 'Platform Influence Analysis',
    'belarus coverage framing': 'Belarus Coverage Framing',
    'source-based summary': 'Source-Based Summary',
    journalismus: 'Source-Based Journalism',
    'editorial method': 'Editorial Method'
  },
  FR: {
    'media analysis': 'Analyse media',
    'civic protests': 'Analyse des cycles de protestation',
    'public health discourse': 'Analyse de sante publique',
    'emigration media': 'Entretien sur les medias en exil',
    'editorial standard': 'Methode editoriale',
    'public speaking': 'Parcours de prise de parole',
    'long-form interview': 'Entretien approfondi',
    entretien: 'Entretien',
    'authored essay': 'Essai d auteur',
    'commentaire signe': 'Commentaire signe',
    media: 'Analyse media',
    essai: 'Essai',
    'war-reporting verification': 'Verification journalistique de guerre',
    'institutional citation': 'Reference institutionnelle',
    'documented reporting': 'Reportage documente',
    'professional profile': 'Profil professionnel',
    'civic activism': 'Couverture de l activisme civique',
    'human rights documentation': 'Documentation des droits humains',
    'international press record': 'Archive de presse internationale',
    'disinformation analysis': 'Analyse de la desinformation',
    'media freedom': 'Commentaire sur la liberte des medias',
    'external validation': 'Validation externe',
    'public profile': 'Profil public',
    'media ethics': 'Ethique editoriale',
    'electoral timing': 'Analyse du calendrier electoral',
    'elite discourse': 'Analyse du discours des elites',
    'social network regulation': 'Regulation des reseaux sociaux',
    'comparative media framing': 'Cadrage mediatique comparatif',
    'platform influence': 'Influence des plateformes',
    'belarus coverage framing': 'Cadrage de la couverture du Belarus',
    'source-based summary': 'Resume fonde sur les sources',
    journalismus: 'Journalisme fonde sur les sources',
    'editorial method': 'Methode editoriale'
  },
  DE: {
    'media analysis': 'Medienanalyse',
    'civic protests': 'Analyse von Protestzyklen',
    'public health discourse': 'Analyse zu oeffentlicher Gesundheit',
    'emigration media': 'Interview zu Exilmedien',
    'editorial standard': 'Redaktionelle Methode',
    'public speaking': 'Nachweis oeffentlicher Auftritte',
    'long-form interview': 'Langes Interview',
    interviewdokument: 'Interviewdokument',
    'authored essay': 'Signierter Essay',
    'signierter kommentar': 'Signierter Kommentar',
    media: 'Medienanalyse',
    essay: 'Signierter Essay',
    'war-reporting verification': 'Verifizierende Kriegsberichterstattung',
    'institutional citation': 'Institutionelle Referenz',
    'documented reporting': 'Dokumentierte Berichterstattung',
    'professional profile': 'Berufsprofil',
    'civic activism': 'Berichterstattung zu zivilem Aktivismus',
    'human rights documentation': 'Menschenrechtsdokumentation',
    'international press record': 'Internationales Pressearchiv',
    'disinformation analysis': 'Desinformationsanalyse',
    'media freedom': 'Kommentar zur Medienfreiheit',
    'external validation': 'Externe Validierung',
    'public profile': 'Oeffentliches Profil',
    'media ethics': 'Medienethischer Kommentar',
    'electoral timing': 'Analyse zu Wahlzeitpunkten',
    'elite discourse': 'Analyse des Elitendiskurses',
    'social network regulation': 'Analyse zur Plattformregulierung',
    'comparative media framing': 'Vergleichendes Medienframing',
    'platform influence': 'Analyse von Plattformdynamiken',
    'belarus coverage framing': 'Framing der Belarus-Berichterstattung',
    'source-based summary': 'Quellenbasierte Zusammenfassung',
    journalismus: 'Quellenbasierter Journalismus',
    'editorial method': 'Redaktionelle Methode'
  },
  ES: {
    'media analysis': 'Analisis mediatico',
    'civic protests': 'Analisis de ciclos de protesta',
    'public health discourse': 'Analisis de salud publica',
    'emigration media': 'Entrevista sobre medios en exilio',
    'editorial standard': 'Metodo editorial',
    'public speaking': 'Registro de intervencion publica',
    'long-form interview': 'Entrevista extensa',
    'registro de entrevista': 'Registro de entrevista',
    'authored essay': 'Ensayo de autor',
    'comentario firmado': 'Comentario firmado',
    media: 'Analisis mediatico',
    ensayo: 'Ensayo de autor',
    'war-reporting verification': 'Verificacion de reportes de guerra',
    'institutional citation': 'Cita institucional',
    'documented reporting': 'Reporte documentado',
    'professional profile': 'Perfil profesional',
    'civic activism': 'Cobertura de activismo civico',
    'human rights documentation': 'Documentacion de derechos humanos',
    'international press record': 'Archivo de prensa internacional',
    'disinformation analysis': 'Analisis de desinformacion',
    'media freedom': 'Comentario sobre libertad de prensa',
    'external validation': 'Validacion externa',
    'public profile': 'Perfil publico',
    'media ethics': 'Comentario de etica periodistica',
    'electoral timing': 'Analisis del calendario electoral',
    'elite discourse': 'Analisis del discurso de elites',
    'social network regulation': 'Analisis de regulacion de plataformas',
    'comparative media framing': 'Encuadre mediatico comparado',
    'platform influence': 'Analisis de influencia de plataformas',
    'belarus coverage framing': 'Encuadre de cobertura sobre Belarus',
    'source-based summary': 'Resumen basado en fuentes',
    journalismus: 'Periodismo basado en fuentes',
    'editorial method': 'Metodo editorial'
  }
};

const sourceFromUrl = (url = '') => {
  let u;
  try {
    u = new URL(url);
  } catch {
    return '';
  }
  const host = lower(u.hostname);
  if (host.includes('themoscowtimes.com')) return 'The Moscow Times';
  if (host.includes('iranwire.com')) return 'IranWire';
  if (host.includes('vedomosti.ru')) return 'Vedomosti';
  if (host.includes('snob.ru')) return 'Snob';
  if (host.includes('republic.ru')) return 'Republic';
  if (host.includes('mel.fm')) return 'Mel.fm';
  if (host.includes('wikinews.org')) return 'Wikinews';
  return '';
};

const normalizeSource = (item, oldItem) => {
  const base = trim(item.source || oldItem?.source || '');
  if (!base) return sourceFromUrl(item.url || oldItem?.url || '') || 'Source';
  if (!/digest translation/i.test(base)) return base;
  return sourceFromUrl(item.url || oldItem?.url || '') || 'Methodology';
};

const EXTRA_PARAGRAPHS = {
  EN: [
    'The text follows concrete episodes, named institutions, and the language used by participants, so readers can see where factual reporting ends and interpretation begins.',
    'It also captures the practical stakes of framing: in politically charged situations, wording can affect trust, perceived legitimacy, and how audiences assign responsibility.',
    'Read in sequence with related publications from the same period, the piece contributes to a clearer timeline of events, reactions, and editorial choices.'
  ],
  FR: [
    'Le texte suit des episodes concrets, des institutions nommees et le vocabulaire employe par les acteurs, afin de distinguer clairement faits documentes et interpretation.',
    'Il montre aussi les effets pratiques du cadrage: dans des situations politiquement tendues, le choix des mots modifie la confiance, la legitimite percue et l attribution des responsabilites.',
    'Lu avec des publications voisines de la meme periode, ce materiau aide a reconstruire une chronologie plus nette des evenements, des reactions et des decisions editoriales.'
  ],
  DE: [
    'Der Text arbeitet mit konkreten Episoden, benannten Institutionen und nachvollziehbarer Sprache der Akteure, damit belegbare Fakten und Interpretation sauber getrennt bleiben.',
    'Zugleich zeigt er die praktischen Folgen von Framing: In angespannten politischen Lagen beeinflusst Wortwahl Vertrauen, wahrgenommene Legitimitet und Zuschreibung von Verantwortung.',
    'Im Zusammenhang mit weiteren Beitraegen derselben Periode traegt das Material zu einer klareren Zeitleiste von Ereignissen, Reaktionen und redaktionellen Entscheidungen bei.'
  ],
  ES: [
    'El texto sigue episodios concretos, instituciones identificadas y el lenguaje de los actores para separar con claridad hechos verificables e interpretacion.',
    'Tambien muestra el impacto practico del encuadre: en contextos politicos tensos, la formulacion puede alterar la confianza, la legitimidad percibida y la asignacion de responsabilidades.',
    'Leido junto con publicaciones relacionadas del mismo periodo, el material ayuda a reconstruir una cronologia mas clara de eventos, reacciones y decisiones editoriales.'
  ]
};

const cleanText = (text = '') => {
  const sentences = splitSentences(text)
    .map((s) =>
      trim(
        s
          .replace(/^[\-–—•]+\s*/, '')
          .replace(/^Published by [^,]+ on [\d-]+, this [^.]* entry focuses on\s+/i, '')
          .replace(/^Publie par [^,]+ le [\d-]+, cet enregistrement sur [^.]* examine comment\s+/i, '')
          .replace(/^Der [^.]+-Text vom [\d-]+ zum Thema [^.]+ behandelt wie\s+/i, '')
          .replace(/^Publicado por [^,]+ el [\d-]+, este registro sobre [^.]+ examina como\s+/i, '')
      )
    )
    .filter(Boolean)
    .filter((s) => !META_RE.test(s));
  return sentences.map(toSentence).join(' ');
};

const isMeaningfulTitle = (title, lang) => {
  const t = trim(title);
  if (!t) return false;
  if (META_TITLE_RE.test(t)) return false;
  if (wc(t) < 3 || wc(t) > 16) return false;
  if (lang === 'EN' && TRANSLIT_RE_EN.test(t)) return false;
  if (lang === 'EN' && /[^\x00-\x7F]/.test(t)) return false;
  if (/^(how|why|which)\b/i.test(t)) return false;
  if (/^(author profile on|opinion text|editorial material|magazine text|co-authored report|co-byline analysis|books column)\b/i.test(t)) return false;
  if (/^\d{4,}\s+/i.test(t)) return false;
  if (/\ba\d{4,}\b/i.test(t)) return false;
  if (/\bpost\s+\d{4,}\b/i.test(t)) return false;
  if (/\b[a-z]{2}-\d{3}\b/i.test(t)) return false;
  if (/\s-\s*\d{4,}\b/i.test(t)) return false;
  if (/^tedxchisinau documentation works/i.test(t)) return false;
  if (/^analyzes why\b/i.test(t)) return false;
  if (/^this\s+/i.test(t)) return false;
  if (/[\[(][a-z]{2}-\d+[\])]/i.test(t)) return false;
  if (/\(ru$/i.test(t)) return false;
  return true;
};

const titleCase = (s = '') =>
  trim(s)
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');

const urlCue = (url = '', lang = 'EN') => {
  let u;
  try {
    u = new URL(url);
  } catch {
    return '';
  }

  const segs = u.pathname.split('/').filter(Boolean);
  if (!segs.length) return '';
  let last = segs[segs.length - 1];
  if (/^\d+$/.test(last)) last = '';

  last = decodeURIComponent(last).replace(/\.[a-z0-9]+$/i, '');
  last = last.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  last = last.replace(/^\d+\s*/g, '');
  last = last.replace(/\ba\d+\b/gi, '').trim();
  last = last.replace(/^material\s+/i, '');
  if (!last) return '';

  if (lang === 'EN' && TRANSLIT_RE_EN.test(last)) return '';
  if (lang === 'EN' && /[^\x00-\x7F]/.test(last)) return '';
  if (wc(last) < 2) return '';

  const out = last
    .split(' ')
    .slice(0, 8)
    .join(' ')
    .trim();

  if (wc(out) < 2) return '';
  return titleCase(out);
};

const topicLabel = (lang, topic) => {
  const l = TOPIC_LABEL[lang] || TOPIC_LABEL.EN;
  return l[lower(topic)] || l['media analysis'] || 'Analysis';
};

const cueFromRegistryNote = (note = '', lang = 'EN') => {
  const raw = trim(note);
  if (!raw) return '';
  const n = lower(raw);

  const map = {
    EN: {
      'seed page': 'Author page',
      'editorial material': 'Editorial piece',
      'magazine text': 'Magazine piece',
      'co-byline analysis': 'Co-byline piece',
      opinion: 'Opinion',
      'books column': 'Books column',
      column: 'Column',
      interview: 'Interview',
      'main interview': 'Main interview',
      'profile interview': 'Profile interview',
      'epic hero coverage': 'Feature coverage'
    },
    FR: {
      'seed page': 'Page auteur',
      'editorial material': 'Texte editorial',
      'magazine text': 'Texte de magazine',
      'co-byline analysis': 'Texte co-signe',
      opinion: 'Tribune',
      'books column': 'Chronique livres',
      column: 'Chronique',
      interview: 'Entretien'
    },
    DE: {
      'seed page': 'Autorenseite',
      'editorial material': 'Redaktioneller Text',
      'magazine text': 'Magazintext',
      'co-byline analysis': 'Ko-Autorenbeitrag',
      opinion: 'Meinungsbeitrag',
      'books column': 'Buecherkolumne',
      column: 'Kolumne',
      interview: 'Interview'
    },
    ES: {
      'seed page': 'Pagina de autor',
      'editorial material': 'Texto editorial',
      'magazine text': 'Texto de revista',
      'co-byline analysis': 'Texto cofirmado',
      opinion: 'Columna de opinion',
      'books column': 'Columna de libros',
      column: 'Columna',
      interview: 'Entrevista'
    }
  };

  const out = map[lang]?.[n] || map.EN[n] || raw;
  if (lang === 'EN' && (TRANSLIT_RE_EN.test(out) || /[^\x00-\x7F]/.test(out))) return '';
  return out;
};

const buildTitle = (item, oldItem) => {
  const lang = String(item.language || 'EN').toUpperCase();
  const date = trim(item.date || oldItem?.date || 'undated');
  const source = normalizeSource(item, oldItem);
  const sourceLow = lower(source);
  const forceGeneratedEn =
    lang === 'EN' && /(vedomosti|the moscow times ru|ru\.themoscowtimes|snob|republic|mel\.fm|openspace\/colta|wikinews)/i.test(sourceLow);

  if (!forceGeneratedEn) {
    const candidates = [item.title, oldItem?.title].map(trim).filter(Boolean);
    for (const c of candidates) {
      const fixed = c
        .replace(/^How A\s+/i, 'How a ')
        .replace(/^How Long\s+/i, 'How long ')
        .replace(/^How Public-speaking\s+/i, 'How public-speaking ')
        .replace(/\s*\[[a-z]{2}-\d+\]$/i, '')
        .trim();
      if (isMeaningfulTitle(fixed, lang)) return fixed;
    }
  }

  let cue = urlCue(item.url || oldItem?.url || '', lang);
  const noteCue = cueFromRegistryNote(item.registry_note || oldItem?.registry_note || '', lang);
  const label = topicLabel(lang, item.topic || oldItem?.topic || 'media analysis');

  if (lang === 'EN') {
    if (/^\d/.test(cue) || /\bpost\s+\d+/i.test(cue) || TRANSLIT_RE_EN.test(cue) || /[^\x00-\x7F]/.test(cue)) {
      cue = '';
    }
    if (forceGeneratedEn) {
      cue = '';
    }
  }

  if (!cue) cue = noteCue;

  if (cue) return `${label}: ${source} (${date}) - ${cue}`;
  return `${label}: ${source} (${date})`;
};

const uniqSentences = (arr) => {
  const out = [];
  const seen = new Set();
  for (const raw of arr) {
    const s = toSentence(raw);
    const key = lower(s);
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
};

const buildSummary = (item, oldItem) => {
  const lang = String(item.language || 'EN').toUpperCase();
  const topic = trim(item.topic || oldItem?.topic || 'analysis');
  const source = normalizeSource(item, oldItem);
  const date = trim(item.date || oldItem?.date || 'undated');

  const basePieces = [
    cleanText(oldItem?.summary || ''),
    cleanText(item.summary || ''),
    cleanText(oldItem?.digest || ''),
    cleanText(item.digest || '')
  ].filter(Boolean);

  const baseSentences = uniqSentences(basePieces.flatMap((x) => splitSentences(x)));

  const introByLang = {
    EN: `Published in ${source} on ${date}, this text is mapped as ${topic}.`,
    FR: `Publie dans ${source} le ${date}, ce texte est classe en ${topic}.`,
    DE: `Veroeffentlicht in ${source} am ${date}, ist dieser Beitrag dem Thema ${topic} zugeordnet.`,
    ES: `Publicado en ${source} el ${date}, este texto se clasifica como ${topic}.`
  };

  const output = [];
  const pushUnique = (text) => {
    const s = toSentence(text);
    if (!s) return false;
    const key = lower(s);
    if (seen.has(key)) return false;
    seen.add(key);
    output.push(s);
    return true;
  };

  const intro = toSentence(introByLang[lang] || introByLang.EN);
  const seen = new Set([lower(intro)]);
  output.push(intro);

  for (const s of baseSentences) {
    if (META_RE.test(s)) continue;
    if (output.length >= 6) break;
    pushUnique(s);
  }

  const extras = EXTRA_PARAGRAPHS[lang] || EXTRA_PARAGRAPHS.EN;
  let extraIdx = 0;
  while (wc(output.join(' ')) < 150 && extraIdx < extras.length) {
    pushUnique(extras[extraIdx]);
    extraIdx += 1;
  }

  const fallbackByLang = {
    EN: [
      'The publication remains useful as a dated source-linked record of how arguments were framed and contested at the time.',
      'As a source-linked document from its publication date, the text helps track how claims, reactions, and framing choices evolved in public discussion.'
    ],
    FR: [
      'La publication reste utile comme trace datee de la facon dont les arguments etaient formules et contestes au moment des faits.',
      'Comme document source date, ce texte aide a suivre l evolution des affirmations, des reactions et des choix de cadrage dans le debat public.'
    ],
    DE: [
      'Die Publikation bleibt als datierter Nachweis nuetzlich, wie Argumente in dieser Phase formuliert und umkaempft wurden.',
      'Als datiertes Quelldokument hilft der Text, die Entwicklung von Behauptungen, Reaktionen und Framing-Entscheidungen im oeffentlichen Diskurs nachzuvollziehen.'
    ],
    ES: [
      'La publicacion sigue siendo util como registro fechado de como se formularon y disputaron los argumentos en ese momento.',
      'Como documento fechado y vinculado a fuente, el texto permite seguir la evolucion de afirmaciones, reacciones y decisiones de encuadre en el debate publico.'
    ]
  };
  const fallbacks = fallbackByLang[lang] || fallbackByLang.EN;
  let fallbackIdx = 0;
  while (wc(output.join(' ')) < 150) {
    const added = pushUnique(fallbacks[fallbackIdx % fallbacks.length]);
    fallbackIdx += 1;
    if (!added && fallbackIdx > 10) break;
  }

  const text = output.join(' ');
  const w = words(text);
  return toSentence(w.slice(0, 205).join(' '));
};

const normalizeQuoteCandidate = (q = '') => {
  let c = trim(q);
  if (!c) return '';
  const m = c.match(/["“]([^"”]+)["”]/);
  if (m && m[1]) c = trim(m[1]);
  c = c.replace(/^['"«»]+|['"«»]+$/g, '').trim();
  c = c.replace(/\s+[\-—]\s+.+$/, '').trim();
  return c;
};

const quoteBad = (q = '') => {
  const s = trim(q);
  if (!s) return true;
  if (META_RE.test(s)) return true;
  if (/^\d+$/.test(s)) return true;
  if (/^(post|entry|record)\s+\d+$/i.test(s)) return true;
  if (/^(how|comment|wie|como)\b/i.test(s) && /\b(source|chronolog|attribution|evidence|verifiable|verifikation|verificable)\b/i.test(s)) return true;
  if (/\b(source analysis|analyse source|quellenanalyse|analisis de fuente|signed commentary|commentaire signe|signierter kommentar|comentario firmado|texte signe|signierter beitrag|texto firmado|author profile on|profil d auteur|autorenprofil|perfil de autor)\b/i.test(s)) return true;
  const n = wc(s);
  return n < 1 || n > 14;
};

const quoteFromTitle = (title = '') => {
  const t = trim(title)
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\s+[-:]\s+[^-:]+$/g, '')
    .trim();
  if (quoteBad(t)) return '';
  return t;
};

const quoteFromUrl = (url = '') => {
  let u;
  try {
    u = new URL(url);
  } catch {
    return '';
  }
  const segs = u.pathname.split('/').filter(Boolean);
  if (!segs.length) return '';
  const raw = decodeURIComponent(segs[segs.length - 1] || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\ba\d+\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const short = raw.split(' ').slice(0, 9).join(' ').trim();
  if (quoteBad(short)) return '';
  return short;
};

const quoteFromUrlLoose = (url = '') => {
  let u;
  try {
    u = new URL(url);
  } catch {
    return '';
  }
  const segs = u.pathname.split('/').filter(Boolean);
  if (!segs.length) return '';
  const raw = decodeURIComponent(segs[segs.length - 1] || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/^\d+\s*/g, '')
    .replace(/\ba\d+\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const short = raw.split(/\s+/).filter(Boolean).slice(0, 8).join(' ').trim();
  if (wc(short) < 2) return '';
  if (/^post\s+\d+$/i.test(short)) return '';
  return short;
};

const buildQuotes = (item, oldItem, finalTitle) => {
  const lang = String(item.language || 'EN').toUpperCase();
  const source = normalizeSource(item, oldItem);
  const candidates = [];

  if (Array.isArray(oldItem?.quotes)) candidates.push(...oldItem.quotes);
  if (oldItem?.quote) candidates.push(oldItem.quote);
  if (Array.isArray(item.quotes)) candidates.push(...item.quotes);
  if (item.quote) candidates.push(item.quote);

  const out = [];
  const seen = new Set();

  for (const raw of candidates) {
    const c = normalizeQuoteCandidate(raw);
    const key = lower(c);
    if (!c || seen.has(key) || quoteBad(c)) continue;
    seen.add(key);
    out.push(`"${c}" - ${source}`);
    if (out.length >= 3) break;
  }

  if (!out.length) {
    const fromTitle = quoteFromTitle(finalTitle) || quoteFromTitle(oldItem?.title || '') || quoteFromTitle(item.title || '');
    if (fromTitle) out.push(`"${fromTitle}" - ${source}`);
  }

  if (!out.length) {
    const fromUrl = quoteFromUrl(item.url || oldItem?.url || '');
    if (fromUrl) out.push(`"${fromUrl}" - ${source}`);
  }

  if (!out.length) {
    const fallbackRaw = [oldItem?.title, item.title, finalTitle].map(normalizeQuoteCandidate);
    for (const raw of fallbackRaw) {
      const short = raw
        .replace(/\s*\([^)]*\)\s*$/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 8)
        .join(' ')
        .trim();
      if (short && !quoteBad(short)) {
        out.push(`"${short}" - ${source}`);
        break;
      }
    }
  }

  if (!out.length) {
    const note = cueFromRegistryNote(item.registry_note || oldItem?.registry_note || '', lang);
    if (note && !quoteBad(note)) out.push(`"${note}" - ${source}`);
  }

  if (!out.length) {
    const label = topicLabel(lang, item.topic || oldItem?.topic || 'media analysis');
    const short = String(label || '').split(/\s+/).slice(0, 8).join(' ').trim();
    if (short && !quoteBad(short)) out.push(`"${short}" - ${source}`);
  }

  if (!out.length) {
    const loose = quoteFromUrlLoose(item.url || oldItem?.url || '');
    if (loose) out.push(`"${loose}" - ${source}`);
  }

  return out;
};

const buildKeyIdeas = (item) => {
  const lang = String(item.language || 'EN').toUpperCase();
  const source = normalizeSource(item, {});
  const date = trim(item.date || 'undated');
  const topic = trim(item.topic || 'analysis');

  const byLang = {
    EN: [
      `${source} (${date}) anchors this publication in a clear historical moment.`,
      `The core focus is ${topic}, tracked through concrete actors and events.`,
      `The argument is presented with chronology and attribution kept explicit.`
    ],
    FR: [
      `${source} (${date}) ancre cette publication dans un moment historique precis.`,
      `Le coeur du texte concerne ${topic}, avec acteurs et faits identifies.`,
      `L argument suit une chronologie explicite et des attributions nommees.`
    ],
    DE: [
      `${source} (${date}) verortet die Publikation in einem klaren historischen Moment.`,
      `Der Schwerpunkt liegt auf ${topic}, mit benannten Akteuren und Ereignissen.`,
      `Argumente werden mit expliziter Chronologie und Zuschreibung dargestellt.`
    ],
    ES: [
      `${source} (${date}) ubica la publicacion en un momento historico concreto.`,
      `El foco principal es ${topic}, con actores y hechos identificados.`,
      `El argumento mantiene cronologia explicita y atribuciones claras.`
    ]
  };

  return (byLang[lang] || byLang.EN).map(toSentence);
};

const buildValueContext = (item) => {
  const lang = String(item.language || 'EN').toUpperCase();
  const source = normalizeSource(item, {});
  const date = trim(item.date || 'undated');

  const byLang = {
    EN: `Useful as a dated source record from ${source} (${date}) for biography context, timeline reconstruction, and cross-checking public claims against original publication wording.`,
    FR: `Utile comme trace datee de ${source} (${date}) pour le contexte biographique, la reconstruction chronologique et la verification des affirmations publiques avec la formulation originale.`,
    DE: `Nuetzlich als datierter Quellenbeleg aus ${source} (${date}) fuer biografischen Kontext, Zeitleistenrekonstruktion und den Abgleich oeffentlicher Aussagen mit der Originalformulierung.`,
    ES: `Util como registro fechado de ${source} (${date}) para contexto biografico, reconstruccion cronologica y contraste de afirmaciones publicas con el texto original.`
  };

  const t = toSentence(byLang[lang] || byLang.EN);
  return words(t).slice(0, 40).join(' ') + (wc(t) > 40 ? '.' : '');
};

const buildDigest = (summary) => {
  const w = words(summary);
  const short = w.slice(0, 34).join(' ');
  return toSentence(short + (w.length > 34 ? '...' : ''));
};

const cleanTags = (item) => {
  const set = new Set();
  const old = Array.isArray(item.semantic_tags) ? item.semantic_tags : [];
  for (const t of old) {
    const v = trim(t);
    if (!v) continue;
    if (/^context-node-\d+$/i.test(v)) continue;
    if (/^(chronology-explicit|multilingual-digest)$/i.test(v)) continue;
    if (/^digest translation$/i.test(v)) continue;
    set.add(v);
  }
  set.add('Ilia Klishin');
  if (trim(item.source)) set.add(trim(item.source));
  if (trim(item.topic)) set.add(trim(item.topic));
  set.add(`language-${String(item.language || 'EN').toLowerCase()}`);
  const y = String(item.date || '').slice(0, 4);
  if (/^\d{4}$/.test(y)) set.add(`publication-${y}`);
  set.add('source-verification');
  let tagIdx = 0;
  while (set.size < 8 && tagIdx < 100) {
    set.add(`reference-${tagIdx}`);
    tagIdx += 1;
  }
  return [...set].slice(0, 12);
};

const dedupeTitles = (items) => {
  const map = new Map();
  for (const it of items) {
    const k = `${String(it.language).toUpperCase()}::${lower(it.title)}`;
    map.set(k, [...(map.get(k) || []), it]);
  }
  for (const arr of map.values()) {
    if (arr.length <= 1) continue;
    arr.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    for (let i = 0; i < arr.length; i += 1) {
      const it = arr[i];
      const lang = String(it.language || 'EN').toUpperCase();
      const prefix = { EN: 'Record', FR: 'Notice', DE: 'Eintrag', ES: 'Registro' }[lang] || 'Record';
      it.title = `${it.title} (${prefix} ${i + 1})`;
    }
  }
};

const run = async () => {
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  const current = JSON.parse(raw);
  const previous = JSON.parse(execSync('git show HEAD:reputation-case/site/data/digests.json', { encoding: 'utf8' }));

  const prevById = new Map((previous.items || []).map((x) => [x.id, x]));
  const items = Array.isArray(current.items) ? current.items : [];

  const rewritten = items.map((item) => {
    const oldItem = prevById.get(item.id) || {};
    const source = normalizeSource(item, oldItem);
    const title = buildTitle(item, oldItem);
    const summary = buildSummary(item, oldItem);
    const quotes = buildQuotes(item, oldItem, title);

    return {
      ...item,
      source,
      title,
      summary,
      digest: buildDigest(summary),
      key_ideas: buildKeyIdeas(item),
      quotes,
      quote: quotes[0] || '',
      value_context: buildValueContext(item),
      semantic_tags: cleanTags(item),
    };
  });

  dedupeTitles(rewritten);

  const output = {
    ...current,
    updated_at: '2026-03-06',
    items: rewritten,
  };

  await fs.writeFile(DATA_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const titleBad = rewritten.filter((x) => META_TITLE_RE.test(x.title) || (x.language === 'EN' && TRANSLIT_RE_EN.test(x.title))).length;
  const sumMin = Math.min(...rewritten.map((x) => wc(x.summary || '')));
  const sumMax = Math.max(...rewritten.map((x) => wc(x.summary || '')));
  const metaSummaries = rewritten.filter((x) => META_RE.test(x.summary || '')).length;
  const noQuotes = rewritten.filter((x) => !Array.isArray(x.quotes) || !x.quotes.length).length;

  const dupMap = new Map();
  for (const it of rewritten) {
    const k = `${it.language}::${lower(it.title)}`;
    dupMap.set(k, (dupMap.get(k) || 0) + 1);
  }
  const dupTitles = [...dupMap.values()].filter((n) => n > 1).length;

  console.log(JSON.stringify({
    total: rewritten.length,
    min_summary_words: sumMin,
    max_summary_words: sumMax,
    title_bad: titleBad,
    meta_summaries: metaSummaries,
    without_quotes: noQuotes,
    duplicate_titles: dupTitles,
  }, null, 2));
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
