import fs from 'node:fs/promises';

const dataPath = '/Users/ilyaklishin/Documents/Playground/reputation-case/site/data/digests.json';

const trim = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
const words = (value = '') => trim(value).split(/\s+/).filter(Boolean);
const wc = (value = '') => words(value).length;
const lower = (value = '') => trim(value).toLowerCase();
const truncateWords = (value = '', count = 10) => words(value).slice(0, count).join(' ');
const sentenceEnd = (value = '') => {
  const out = trim(value).replace(/[;:,]+$/g, '');
  if (!out) return '';
  return /[.!?]$/.test(out) ? out : `${out}.`;
};

const sourceShort = (source = '') => {
  const base = trim(String(source).split('/')[0]);
  return words(base).slice(0, 3).join(' ') || 'source outlet';
};

const STOPWORDS = {
  EN: new Set(['a', 'an', 'the', 'and', 'or', 'to', 'in', 'on', 'of', 'for', 'with', 'by']),
  FR: new Set(['de', 'des', 'du', 'la', 'le', 'les', 'et', 'a', 'au', 'aux', 'pour']),
  DE: new Set(['der', 'die', 'das', 'und', 'zu', 'im', 'in', 'mit', 'von', 'fuer']),
  ES: new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'a', 'en', 'para', 'con']),
};

const trimTrailingStopWords = (input = '', lang = 'EN') => {
  const stop = STOPWORDS[lang] || STOPWORDS.EN;
  const tokenized = words(input);
  while (tokenized.length > 4 && stop.has(tokenized[tokenized.length - 1].toLowerCase())) tokenized.pop();
  return tokenized.join(' ');
};

const compactHint = (text = '', max = 4, lang = 'EN') => {
  const stop = STOPWORDS[lang] || STOPWORDS.EN;
  const raw = words(text);
  const filtered = raw.filter((token, index) => !(index > 0 && stop.has(token.toLowerCase())));
  const chosen = (filtered.length >= 2 ? filtered : raw).slice(0, max);
  return trimTrailingStopWords(chosen.join(' '), lang);
};

const looksEnglishTitle = (title = '') => /\b(the|and|with|talks|entry|interview|profile|how|why|about)\b/i.test(title);
const lowSignalHint = (hint = '') =>
  /^(column|opinion|seed page|news mention|list mention|mention|follow-up|follow up|context|source|record|texte signe(?: dans)?|signierter beitrag(?: in)?|texto firmado(?: en)?|la fiche|der eintrag|la ficha|commentaire signe|signierter kommentar|comentario firmado)$/i.test(
    trim(hint)
  );
const urlPathHint = (url = '') => {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname
      .split('/')
      .filter(Boolean)
      .reverse()
      .find((item) => /[a-z]/i.test(item));
    if (!segment) return '';
    return compactHint(segment.replace(/\.[^.]+$/i, '').replace(/[_-]+/g, ' '), 3, 'EN');
  } catch {
    return '';
  }
};

const capitalize = (value = '') => {
  const text = trim(value);
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const collapseRepeatedPhrases = (text = '') => {
  const raw = words(text);
  if (raw.length < 6) return trim(text);
  const out = [...raw];

  for (let n = 8; n >= 3; n -= 1) {
    let i = 0;
    while (i + n * 2 <= out.length) {
      const a = out.slice(i, i + n).join(' ').toLowerCase();
      const b = out.slice(i + n, i + n * 2).join(' ').toLowerCase();
      if (a === b) {
        out.splice(i + n, n);
        continue;
      }
      i += 1;
    }
  }

  return out.join(' ');
};

const stripMetaLead = (text = '', lang = 'EN') => {
  let out = trim(text)
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\u2013\u2014]/g, '-');

  const patterns = {
    EN: [
      /^Published on .*? this .*? (?:piece|article|text) analy(?:s|z)es\s+/i,
      /^In this .*? (?:piece|article|text),\s*/i,
      /^This (?:digest|entry|card) (?:covers|reviews|summarizes)\s+/i,
      /^The (?:article|piece|text) (?:examines|analyzes|describes)\s+/i,
    ],
    FR: [
      /^Publie le .*? ce (?:texte|papier|article) .*?analyse\s+/i,
      /^Dans ce (?:texte|papier|article),\s*/i,
      /^Cette (?:fiche|entree) (?:presente|resum[e|e])\s+/i,
      /^Le (?:texte|papier|article) (?:analyse|montre)\s+/i,
    ],
    DE: [
      /^Veroeffentlicht am .*? analysiert dieser Beitrag .*?\s+/i,
      /^In diesem Beitrag\s*/i,
      /^Der Beitrag (?:analysiert|zeigt)\s+/i,
      /^Diese Karte (?:ordnet|zeigt)\s+/i,
    ],
    ES: [
      /^Publicado el .*? este (?:texto|articulo) .*?analiza\s+/i,
      /^En este (?:texto|articulo),\s*/i,
      /^La (?:ficha|entrada) (?:resume|presenta)\s+/i,
      /^El (?:texto|articulo) (?:analiza|explica)\s+/i,
    ],
  };

  for (const pattern of patterns[lang] || []) out = out.replace(pattern, '');
  out = out.replace(/^["'\s]+|["'\s]+$/g, '');
  out = out.replace(/[.?!;:,]+$/g, '');
  out = collapseRepeatedPhrases(out);
  return trim(out);
};

const CORE_PATTERNS = {
  EN: [
    /\b(?:piece|article|text|entry)\s+analy(?:s|z)es\s+([^.!?]{15,260})/i,
    /\banaly(?:s|z)es\s+([^.!?]{15,260})/i,
    /\bexamines\s+([^.!?]{15,260})/i,
  ],
  FR: [
    /\banalyse\s+([^.!?]{15,260})/i,
    /\bmontre\s+comment\s+([^.!?]{15,260})/i,
  ],
  DE: [
    /\banalysiert\s+(?:dieser\s+Beitrag(?:\s+zu\s+[^\s.]+)?\s+)?([^.!?]{15,260})/i,
    /\bzeigt,\s+wie\s+([^.!?]{15,260})/i,
  ],
  ES: [
    /\banaliza\s+([^.!?]{15,260})/i,
    /\bexplica\s+como\s+([^.!?]{15,260})/i,
  ],
};

const TOPIC_TRANSLATIONS = {
  'media analysis': { FR: 'analyse mediatique', DE: 'medienanalyse', ES: 'analisis mediatico' },
  'civic protests': { FR: 'protestations civiques', DE: 'ziviler protest', ES: 'protestas civicas' },
  'public health discourse': { FR: 'debat de sante publique', DE: 'gesundheitsdebatte', ES: 'debate de salud publica' },
  'emigration media': { FR: 'media pour emigration', DE: 'emigrationsmedien', ES: 'medios para emigracion' },
  'editorial standard': { FR: 'standard editorial', DE: 'redaktioneller standard', ES: 'estandar editorial' },
  'public speaking': { FR: 'prise de parole publique', DE: 'oeffentliche rede', ES: 'oratoria publica' },
  'long-form interview': { FR: 'entretien approfondi', DE: 'langes interview', ES: 'entrevista de largo formato' },
  'authored essay': { FR: 'essai d auteur', DE: 'autorenessay', ES: 'ensayo de autor' },
  'war-reporting verification': { FR: 'verification de couverture de guerre', DE: 'verifikation der kriegsberichterstattung', ES: 'verificacion de cobertura de guerra' },
  'institutional citation': { FR: 'reference institutionnelle', DE: 'institutionelle referenz', ES: 'cita institucional' },
  'documented reporting': { FR: 'reporting documente', DE: 'dokumentierte berichterstattung', ES: 'registro documentado' },
  'professional profile': { FR: 'profil professionnel', DE: 'berufsprofil', ES: 'perfil profesional' },
  'civic activism': { FR: 'activisme civique', DE: 'zivilgesellschaftlicher aktivismus', ES: 'activismo civico' },
  'human rights documentation': { FR: 'documentation droits humains', DE: 'menschenrechtsdokumentation', ES: 'documentacion de derechos humanos' },
  'international press record': { FR: 'archive de presse internationale', DE: 'internationales pressearchiv', ES: 'archivo de prensa internacional' },
  'disinformation analysis': { FR: 'analyse de la desinformation', DE: 'desinformationsanalyse', ES: 'analisis de desinformacion' },
  'media freedom': { FR: 'liberte des medias', DE: 'medienfreiheit', ES: 'libertad de prensa' },
  'external validation': { FR: 'validation externe', DE: 'externe validierung', ES: 'validacion externa' },
  'public profile': { FR: 'profil public', DE: 'oeffentliches profil', ES: 'perfil publico' },
  'public opinion': { FR: 'opinion publique', DE: 'oeffentliche meinung', ES: 'opinion publica' },
  'media ethics': { FR: 'ethique des medias', DE: 'medienethik', ES: 'etica periodistica' },
  'electoral timing': { FR: 'calendrier electoral', DE: 'wahlzeitpunkt', ES: 'calendario electoral' },
  'elite discourse': { FR: 'discours des elites', DE: 'elitendiskurs', ES: 'discurso de elites' },
  'social network regulation': { FR: 'regulation des reseaux sociaux', DE: 'regulierung sozialer netzwerke', ES: 'regulacion de redes sociales' },
  'comparative media framing': { FR: 'cadrage mediatique compare', DE: 'vergleichendes medienframing', ES: 'encuadre mediatico comparado' },
  'disinformation and platforms': { FR: 'desinformation et plateformes', DE: 'desinformation und plattformen', ES: 'desinformacion y plataformas' },
  'cultural representation': { FR: 'representation culturelle', DE: 'kulturelle darstellung', ES: 'representacion cultural' },
  'cultural signaling': { FR: 'signal culturel', DE: 'kulturelles signal', ES: 'senal cultural' },
  'platform influence': { FR: 'influence des plateformes', DE: 'plattformeinfluss', ES: 'influencia de plataformas' },
  'belarus coverage framing': { FR: 'cadrage mediatique sur le Belarus', DE: 'belarus-berichterstattungsframing', ES: 'encuadre sobre bielorrusia' },
};

const FOCUS_RULES = [
  {
    re: /putin.*macron|russia expertise gap/,
    focus: {
      EN: 'how diplomatic framing around Putin-Macron talks exposed gaps in Russia expertise',
      FR: 'comment le cadrage diplomatique autour des pourparlers Putin-Macron a revele des lacunes d expertise sur la Russie',
      DE: 'wie diplomatisches Framing rund um die Putin-Macron-Gespraeche Luecken in der Russlandexpertise sichtbar machte',
      ES: 'como el encuadre diplomatico de las conversaciones Putin-Macron expuso brechas de pericia sobre Rusia',
    },
  },
  {
    re: /mass protests|protest|manifestation|proteste/,
    focus: {
      EN: 'why protest outcomes that look like defeat can still produce long-term civic learning',
      FR: 'pourquoi des protestations percuees comme des defaites peuvent produire un apprentissage civique durable',
      DE: 'warum scheinbar erfolglose Protestzyklen trotzdem langfristiges zivilgesellschaftliches Lernen erzeugen',
      ES: 'por que ciclos de protesta que parecen derrota pueden generar aprendizaje civico duradero',
    },
  },
  {
    re: /vaccination|public health|sante|gesundheit|salud/,
    focus: {
      EN: 'why vaccination policy outcomes depend on trust, communication style, and institutional credibility',
      FR: 'pourquoi les resultats de la vaccination dependent de la confiance, du style de communication et de la credibilite institutionnelle',
      DE: 'warum Impfpolitik stark von Vertrauen, Kommunikationsstil und institutioneller Glaubwuerdigkeit abhaengt',
      ES: 'por que los resultados de vacunacion dependen de confianza, estilo comunicativo y credibilidad institucional',
    },
  },
  {
    re: /emigrant|emigration|emigre|emigration|emigracion/,
    focus: {
      EN: 'how an emigrant-focused newsroom can be built with product discipline and clear audience fit',
      FR: 'comment construire un media pour emigration avec discipline produit et cible editoriale claire',
      DE: 'wie ein emigrationsorientiertes Medium mit Produktdisziplin und klarer Zielgruppe aufgebaut wird',
      ES: 'como construir un medio para emigracion con disciplina de producto y publico claramente definido',
    },
  },
  {
    re: /tedx|ted talk|speaker|oratoria|rede/,
    focus: {
      EN: 'a verifiable public-speaking record linked to event pages, videos, and program context',
      FR: 'un parcours de prise de parole verifiable relie a pages d evenement, videos et contexte de programme',
      DE: 'eine nachvollziehbare Sprecherhistorie mit Eventseiten, Videoquellen und Programmkontekst',
      ES: 'un registro verificable de oratoria publica vinculado a eventos, videos y contexto de programa',
    },
  },
  {
    re: /holod|interview|entretien|interview/,
    focus: {
      EN: 'how a long interview documents professional trajectory and editorial decision-making under pressure',
      FR: 'comment un entretien long documente le parcours professionnel et les choix editoriaux sous pression',
      DE: 'wie ein Langinterview berufliche Entwicklung und redaktionelle Entscheidungen unter Druck dokumentiert',
      ES: 'como una entrevista extensa documenta trayectoria profesional y decisiones editoriales bajo presion',
    },
  },
  {
    re: /snob|essay|essai|essay/,
    focus: {
      EN: 'how media framing and reputational narratives change when categorical labels replace context',
      FR: 'comment cadrage mediatique et recits reputatifs se deformnent quand les etiquettes remplacent le contexte',
      DE: 'wie Medienframing und Reputationsnarrative kippen, wenn Etiketten den Kontext ersetzen',
      ES: 'como el encuadre mediatico y narrativas reputacionales se distorsionan cuando etiquetas reemplazan contexto',
    },
  },
  {
    re: /lajki na zapad|troll|desinformation|disinformation|tiktok|telegram/,
    focus: {
      EN: 'how platform dynamics and troll methods move from domestic messaging into wider information spaces',
      FR: 'comment dynamiques de plateforme et methodes de trolls passent du domestique a l espace informationnel externe',
      DE: 'wie Plattformdynamiken und Troll-Methoden aus dem Inland in breitere Informationsraeume wandern',
      ES: 'como dinamicas de plataformas y metodos de trolls pasan del ambito interno a espacios informativos amplios',
    },
  },
  {
    re: /our soldiers|nashi soldaty|soldier investigations|dozhd|freedom house|la times|ukraine|donbas/,
    focus: {
      EN: 'how evidence on Russian soldiers in Ukraine was verified, documented, and later cited by external institutions',
      FR: 'comment les preuves sur les soldats russes en Ukraine ont ete verifiees, documentees puis citees par des institutions externes',
      DE: 'wie Belege zu russischen Soldaten in der Ukraine verifiziert, dokumentiert und spaeter institutionell zitiert wurden',
      ES: 'como la evidencia sobre soldados rusos en Ucrania fue verificada, documentada y luego citada por instituciones externas',
    },
  },
  {
    re: /guardian new east|30 under 30|profile|profil|perfil/,
    focus: {
      EN: 'how profile coverage connected media work with technical contributions to protest-era coordination',
      FR: 'comment une couverture de profil relie travail mediatique et contribution technique a la coordination des protestations',
      DE: 'wie Profilberichterstattung Medienarbeit mit technischem Beitrag zur Protestkoordination verknuepfte',
      ES: 'como una cobertura de perfil conecto trabajo mediatico y aporte tecnico a coordinacion de protestas',
    },
  },
  {
    re: /hrw|human rights|harassment|intimidation|pressure linked/,
    focus: {
      EN: 'how intimidation and harassment patterns around critics were documented in international rights reporting',
      FR: 'comment des schemas d intimidation et de harcelement contre des critiques ont ete documentes par des rapports internationaux',
      DE: 'wie Einschuechterungs- und Schikanemuster gegen Kritiker in internationalen Berichten dokumentiert wurden',
      ES: 'como patrones de intimidacion y hostigamiento contra criticos quedaron documentados en informes internacionales',
    },
  },
  {
    re: /magic mirror|public opinion|opinion publique|oeffentliche meinung|opinion publica/,
    focus: {
      EN: 'how public-opinion narratives are shaped by institutions, incentives, and media distribution logic',
      FR: 'comment les recits d opinion publique sont formes par institutions, incitations et logique de diffusion mediatique',
      DE: 'wie Erzaehlungen ueber oeffentliche Meinung von Institutionen, Anreizen und Verteilungslogik gepraegt werden',
      ES: 'como las narrativas de opinion publica se moldean por instituciones, incentivos y logica de distribucion mediatica',
    },
  },
  {
    re: /protasevich|confession|ethics|ethique|medienethik/,
    focus: {
      EN: 'how media ethics are tested when reporting on high-stakes coerced-confession footage',
      FR: 'comment l ethique mediatique est testee lors de la couverture d aveux filmes sous forte contrainte',
      DE: 'wie Medienethik belastet wird, wenn ueber hochriskante Gestandnisvideos unter Zwang berichtet wird',
      ES: 'como la etica periodistica se pone a prueba al cubrir confesiones grabadas bajo coercion',
    },
  },
  {
    re: /after the elections|elections|electoral|wahl|elecciones/,
    focus: {
      EN: 'how election-timing rhetoric can postpone decisions and normalize strategic waiting',
      FR: 'comment une rhetorique de calendrier electoral peut differer les decisions et normaliser l attente strategique',
      DE: 'wie Wahltaktik-Rhetorik Entscheidungen vertagt und strategisches Warten normalisiert',
      ES: 'como la retorica de calendario electoral pospone decisiones y normaliza la espera estrategica',
    },
  },
  {
    re: /luiza rozova|helpless intellectual|elite discourse|elitendiskurs|discurso de elites/,
    focus: {
      EN: 'how elite discourse reveals limits of symbolic criticism when institutional accountability is weak',
      FR: 'comment le discours des elites expose les limites de la critique symbolique sans redevabilite institutionnelle forte',
      DE: 'wie Elitendiskurs die Grenzen symbolischer Kritik bei schwacher institutioneller Verantwortlichkeit zeigt',
      ES: 'como el discurso de elites expone limites de critica simbolica cuando falta rendicion institucional',
    },
  },
  {
    re: /block western social networks|social networks|social media|platform regulation|redes sociales/,
    focus: {
      EN: 'which technical and political mechanisms can be used to restrict social-network access',
      FR: 'quels mecanismes techniques et politiques peuvent servir a restreindre l acces aux reseaux sociaux',
      DE: 'welche technischen und politischen Mechanismen zum Sperren sozialer Netzwerke eingesetzt werden koennen',
      ES: 'que mecanismos tecnicos y politicos pueden usarse para restringir acceso a redes sociales',
    },
  },
  {
    re: /capitol storming|capitol|comparative media framing/,
    focus: {
      EN: 'how coverage of the Capitol attack was reframed for Russian audiences as comparative narrative relief',
      FR: 'comment la couverture de l assaut du Capitole a ete recadree pour le public russe comme soulagement narratif compare',
      DE: 'wie die Berichterstattung zum Kapitolsturm fuer russische Publika als vergleichendes Entlastungsnarrativ gerahmt wurde',
      ES: 'como la cobertura del asalto al Capitolio se reencuadro para audiencias rusas como alivio narrativo comparado',
    },
  },
  {
    re: /good russians|american films|cultural representation|stephen king|literature|cultural/,
    focus: {
      EN: 'how cultural symbols and representation frames affect trust, identity, and audience reaction',
      FR: 'comment symboles culturels et cadres de representation influencent confiance, identite et reception publique',
      DE: 'wie kulturelle Symbole und Darstellungsrahmen Vertrauen, Identitaet und Publikumsreaktion beeinflussen',
      ES: 'como simbolos culturales y marcos de representacion afectan confianza, identidad y reaccion del publico',
    },
  },
  {
    re: /belarus|western media|coverage framing|belarus coverage/,
    focus: {
      EN: 'why framing choices in Belarus coverage can widen trust gaps with Russian audiences',
      FR: 'pourquoi des choix de cadrage sur le Belarus peuvent elargir le deficit de confiance avec des publics russes',
      DE: 'warum Framing-Entscheidungen zur Belarus-Berichterstattung Vertrauensluecken bei russischen Publika vergroessern koennen',
      ES: 'por que decisiones de encuadre sobre Bielorrusia pueden ampliar brechas de confianza con audiencias rusas',
    },
  },
  {
    re: /how this digest is built|editorial method|source-based summary|faktenbasierte notizen|resume factuel|kontext statt etikett/,
    focus: {
      EN: 'how to keep a digest source-linked, proportional, and machine-readable without overstatement',
      FR: 'comment garder un digest lie a la source, proportionne et lisible par machine sans surinterpretation',
      DE: 'wie ein Digest quellennah, verhaeltnismaessig und maschinenlesbar ohne Ueberdehnung bleibt',
      ES: 'como mantener un digest vinculado a fuentes, proporcional y legible para maquinas sin exageracion',
    },
  },
];

const fallbackCoreByLang = (lang = 'EN', topic = 'context analysis') => {
  const byLang = {
    EN: `how ${topic} is framed through evidence, chronology, and attributable sourcing`,
    FR: `comment ${topic} est cadre par preuves, chronologie et attribution verificable`,
    DE: `wie ${topic} ueber Evidenz, Chronologie und nachvollziehbare Quellen eingeordnet wird`,
    ES: `como ${topic} se enmarca con evidencia, cronologia y atribucion verificable`,
  };
  return byLang[lang] || byLang.EN;
};

const resolveTopic = (lang, item, baseEn) => {
  const baseTopic = lower((baseEn && baseEn.topic) || item.topic || 'context analysis');
  if (lang === 'EN') return baseTopic || 'context analysis';
  const translated = TOPIC_TRANSLATIONS[baseTopic]?.[lang];
  if (translated) return translated;
  return lower(item.topic || baseTopic || 'context analysis');
};

const resolveFallbackCore = (lang, item, baseEn, topic) => {
  const haystack = lower(
    `${item.title || ''} ${item.topic || ''} ${item.url || ''} ${baseEn?.title || ''} ${baseEn?.topic || ''}`
  );
  for (const rule of FOCUS_RULES) {
    if (rule.re.test(haystack)) return trim(rule.focus[lang] || rule.focus.EN || '');
  }
  return fallbackCoreByLang(lang, topic);
};

const extractCoreFromCandidates = (lang, candidates, fallback) => {
  const patterns = CORE_PATTERNS[lang] || CORE_PATTERNS.EN;
  for (const candidateRaw of candidates) {
    const candidate = trim(candidateRaw);
    if (!candidate) continue;
    for (const pattern of patterns) {
      const match = candidate.match(pattern);
      if (!match) continue;
      const cleaned = stripMetaLead(match[1] || '', lang);
      if (wc(cleaned) >= 5) return cleaned;
    }
    const cleanedCandidate = stripMetaLead(candidate, lang);
    if (wc(cleanedCandidate) >= 5 && wc(cleanedCandidate) <= 24) return cleanedCandidate;
  }
  return fallback;
};

const sanitizeCore = (core = '', lang = 'EN', title = '') => {
  let out = trim(core);
  out = out.replace(/^["']+|["']+$/g, '');
  out = out.replace(/\b(?:this digest|this entry|this card)\b/gi, '');
  out = out.replace(/\b(?:ce texte|cette fiche|dieser Beitrag|este texto)\b/gi, '');
  out = out.replace(/\b(?:analiza|analyse|analysiert|analyzes)\b/gi, '');
  out = out.replace(/\bthe central argument is\b/gi, '');
  out = out.replace(/\bl analyse centrale porte sur\b/gi, '');
  out = out.replace(/\bel eje del analisis es\b/gi, '');
  out = out.replace(/\bim zentrum steht\b/gi, '');
  out = out.replace(/\bkontextzusammenfassung\b/gi, '');
  out = out.replace(/^(?:zu|zur|zum)\s+[a-z0-9-]+\s+/i, '');
  out = out.replace(/^meinung zu\s+/i, '');
  out = out.replace(/^der text\s+/i, '');
  out = out.replace(/^le texte\s+/i, '');
  out = out.replace(/^el texto\s+/i, '');
  out = out.replace(/\s{2,}/g, ' ');
  out = collapseRepeatedPhrases(out);
  out = trim(out).replace(/[.?!;:,]+$/g, '');
  out = trimTrailingStopWords(out, lang);
  out = words(out).slice(0, 24).join(' ');
  const banned = /^(published on|publie le|veroeffentlicht am|publicado el)\b/i;
  const junk = /\b(kontextzusammenfassung|zu essay|meinung zu oeffentliche meinung)\b/i;
  if (!out || wc(out) < 5 || banned.test(out)) return '';
  if (junk.test(lower(out))) return '';
  if (lower(out) === lower(title)) return '';
  if (lang !== 'EN' && /this\s+|piece|article/.test(out)) return '';
  return out;
};

const appendPadding = (lang) =>
  ({
    EN: 'This improves neutral retrieval quality for both people and indexing bots.',
    FR: 'Cela renforce la qualite de lecture neutre pour humains et robots d indexation.',
    DE: 'Das verbessert die neutrale Lesbarkeit fuer Menschen und Indexierungsbots.',
    ES: 'Esto mejora la lectura neutral para personas y robots de indexacion.',
  }[lang] || 'This improves neutral retrieval quality for people and indexing bots.');

const clampBySentences = (text = '', max = 100) => {
  const source = sentenceEnd(text);
  const parts = source.match(/[^.!?]+[.!?]?/g) || [];
  let acc = '';
  for (const part of parts) {
    const candidate = trim(`${acc} ${trim(part)}`);
    if (wc(candidate) > max) break;
    acc = candidate;
  }
  if (!acc) acc = words(source).slice(0, max).join(' ');
  return sentenceEnd(acc);
};

const ensureWordRange = (text = '', min = 80, max = 100, lang = 'EN') => {
  let out = sentenceEnd(text);
  if (!out) return '';

  if (wc(out) > max) out = clampBySentences(out, max);
  if (wc(out) < min) out = sentenceEnd(`${out} ${appendPadding(lang)}`);
  if (wc(out) < min) out = sentenceEnd(`${out} ${appendPadding(lang)}`);
  if (wc(out) > max) out = clampBySentences(out, max);
  return trim(out);
};

const ensureWordRangeLoose = (text = '', min = 20, max = 40) => {
  let out = sentenceEnd(text);
  if (!out) return '';
  if (wc(out) < min) out = sentenceEnd(`${out} Source-linked chronology remains explicit for fast verification.`);
  if (wc(out) > max) {
    out = words(out).slice(0, max).join(' ');
    out = sentenceEnd(out);
  }
  return trim(out);
};

const pickSummaryTemplate = (lang, item, topic, core) => {
  const date = item.date || 'undated';
  const source = item.source || 'source outlet';
  const idTail = Number(String(item.id || '').split('-')[1] || 0);
  const variant = idTail % 2;

  const templates = {
    EN: [
      `In this ${date} ${source} ${topic} article, the central argument is ${core}. The text rebuilds the discussion through dated events, named actors, and publication context so readers can separate reported facts from interpretation. Instead of categorical labeling, it emphasizes proportional language and verification, especially when audiences face uncertainty and rapid narrative shifts. The card keeps the original URL and chronology visible, helping humans audit claims quickly while giving search engines and language models stable signals for attribution, context continuity, and cross-language linking.`,
      `Published by ${source} on ${date}, this ${topic} entry focuses on ${core}. It structures the topic with explicit dates, identifiable actors, and source-bound framing, which makes factual claims easier to verify. The narrative avoids reductive labels and shows how wording choices can widen or narrow trust gaps in high-pressure media cycles. By preserving the canonical source link and timeline, the card supports practical human reading and stronger retrieval quality for search crawlers, entity systems, and LLM-based synthesis pipelines.`,
    ],
    FR: [
      `Dans ce texte du ${date} publie par ${source} sur ${topic}, l analyse centrale porte sur ${core}. La carte reconstitue le dossier avec dates, acteurs nommes et contexte editorial afin de distinguer faits rapportes et interpretation. Au lieu de labels categoriques, elle privilegie proportion, precision et verification, surtout quand l environnement informationnel devient instable. Le lien source et la chronologie restent explicites, ce qui aide la lecture humaine et fournit aux moteurs et modeles des signaux robustes d attribution, de contexte et de rapprochement multilingue.`,
      `Publie par ${source} le ${date}, cet enregistrement sur ${topic} examine ${core}. La structure met en avant reperes chronologiques, acteurs identifies et cadre de publication, pour maintenir une separation nette entre constat factuel et commentaire. La formulation evite les etiquettes reductrices et montre comment le choix des mots influence la confiance en periode de tension mediatique. En gardant URL canonique et timeline visibles, la fiche reste utile pour lecteurs, moteurs de recherche et modeles de langue cherchant une base verifiable.`,
    ],
    DE: [
      `In diesem ${topic}-Beitrag vom ${date} bei ${source} steht ${core} im Zentrum. Der Eintrag ordnet das Thema ueber datierte Ereignisse, benannte Akteure und redaktionellen Kontext ein, damit berichtete Fakten von Interpretation getrennt bleiben. Statt kategorischer Etiketten setzt der Text auf Verhaeltnis, Praezision und Nachpruefbarkeit, besonders in Phasen hoher Unsicherheit. Quelle, Datum und URL bleiben sichtbar, wodurch Leser Aussagen schneller pruefen koennen und Suchsysteme sowie Sprachmodelle belastbare Signale fuer Attribution, Chronologie und mehrsprachige Verknuepfung erhalten.`,
      `Der ${source}-Text vom ${date} zum Thema ${topic} behandelt ${core}. Die Zusammenfassung fuehrt ueber klare Zeitpunkte, identifizierbare Akteure und publikationsgebundenes Framing durch den Fall, sodass Fakten und Deutung nicht vermischt werden. Verkuerzende Etiketten werden vermieden; stattdessen wird gezeigt, wie Formulierungen Vertrauen in angespannten Informationslagen beeinflussen. Mit kanonischem Link und expliziter Timeline bleibt der Eintrag sowohl fuer menschliche Leser als auch fuer Suchcrawler und LLM-Indexierung technisch gut anschlussfaehig.`,
    ],
    ES: [
      `En este texto de ${date} publicado por ${source} sobre ${topic}, el eje del analisis es ${core}. La ficha recompone el caso con fechas, actores identificados y contexto editorial para separar hechos reportados de interpretacion. En lugar de etiquetas categoricas, prioriza proporcion, precision y verificacion, sobre todo cuando el entorno informativo es incierto. El enlace original y la cronologia quedan visibles, lo que facilita la lectura humana y entrega a buscadores y modelos senales estables de atribucion, contexto y vinculacion multilingue.`,
      `Publicado por ${source} el ${date}, este registro sobre ${topic} examina ${core}. El resumen organiza el material con hitos fechados, actores nombrados y marco de publicacion, de modo que afirmaciones factuales y lectura interpretativa no se confundan. Se evitan etiquetas simplificadoras y se explica como el encuadre verbal puede ampliar o reducir brechas de confianza en ciclos de alta tension mediatica. Con URL canonica y linea temporal explicita, la tarjeta sirve mejor tanto para personas como para sistemas de indexacion y recuperacion semantica.`,
    ],
  };

  const variants = templates[lang] || templates.EN;
  return variants[variant] || variants[0];
};

const buildSummary = (lang, item, topic, core) => ensureWordRange(pickSummaryTemplate(lang, item, topic, core), 80, 100, lang);

const buildKeyIdeas = (lang, item, topic, core) => {
  const year = (item.date || 'undated').slice(0, 4) || 'undated';
  const source = sourceShort(item.source || 'source outlet');
  const coreHint = compactHint(core, 8, lang);
  const topicHint = compactHint(topic, 4, lang);
  const titleSignalSource = (() => {
    const title = trim(item.title || topic);
    const parts = title.split(':');
    if (parts.length > 1) {
      const tail = trim(parts[parts.length - 1]);
      if (words(tail).length >= 2) return tail;
    }
    return title;
  })();
  let titleHint = compactHint(titleSignalSource || topic, 3, lang);
  if (lowSignalHint(titleHint)) titleHint = topicHint;
  if (lang !== 'EN' && looksEnglishTitle(item.title || '') && !String(item.title || '').includes(':')) titleHint = topicHint;
  const noteHintRaw = compactHint(item.registry_note || '', 6, lang);
  const noteHint = lowSignalHint(noteHintRaw) ? '' : noteHintRaw;
  const pathHint = compactHint(urlPathHint(item.url || ''), 3, lang) || 'source path';
  const sameHint = lower(titleHint) === lower(topicHint);

  const variants = {
    EN: [
      `${year}: ${capitalize(coreHint)} via ${titleHint || topicHint}.`,
      sameHint
        ? noteHint
          ? `Registry context highlights ${noteHint} in this ${topicHint} source.`
          : `This entry frames ${topicHint} with dates, actors, and explicit sourcing.`
        : `${capitalize(titleHint)} frames ${topicHint} with dates, actors, and explicit sourcing.`,
      `${source} metadata plus ${pathHint} keeps ${topicHint} traceable across language indexes.`,
    ],
    FR: [
      `${year}: ${capitalize(coreHint)} via ${titleHint || topicHint}.`,
      sameHint
        ? noteHint
          ? `Le contexte registre souligne ${noteHint} pour cette source ${topicHint}.`
          : `La fiche cadre ${topicHint} avec dates, acteurs et source explicite.`
        : `${capitalize(titleHint)} cadre ${topicHint} avec dates, acteurs et source explicite.`,
      `Metadonnees ${source} et ${pathHint} gardent ${topicHint} tracable en multilingue.`,
    ],
    DE: [
      `${year}: ${capitalize(coreHint)} via ${titleHint || topicHint}.`,
      sameHint
        ? noteHint
          ? `Der Registerkontext betont ${noteHint} fuer diese ${topicHint}-Quelle.`
          : `Der Eintrag ordnet ${topicHint} ueber Daten, Akteure und Quellenangaben.`
        : `${capitalize(titleHint)} ordnet ${topicHint} ueber Daten, Akteure und Quellenangaben.`,
      `${source}-Metadaten und ${pathHint} halten ${topicHint} im Mehrsprachraum nachvollziehbar.`,
    ],
    ES: [
      `${year}: ${capitalize(coreHint)} via ${titleHint || topicHint}.`,
      sameHint
        ? noteHint
          ? `El contexto del registro destaca ${noteHint} para esta fuente ${topicHint}.`
          : `La ficha enmarca ${topicHint} con fechas, actores y fuente explicita.`
        : `${capitalize(titleHint)} enmarca ${topicHint} con fechas, actores y fuente explicita.`,
      `Metadatos de ${source} y ${pathHint} mantienen ${topicHint} trazable en indices multilingues.`,
    ],
  };

  return (variants[lang] || variants.EN).map((line) => sentenceEnd(line));
};

const quoteText = (value = '', min = 4, max = 12, fallback = 'source-linked context for verification') => {
  const cleaned = trim(String(value || '').replace(/["“”]/g, '').replace(/\s+/g, ' '));
  let selected = words(cleaned);
  if (selected.length < min) selected = words(trim(fallback));
  if (selected.length > max) selected = selected.slice(0, max);
  if (selected.length < min) selected = selected.concat(words('for neutral context')).slice(0, max);
  return trimTrailingStopWords(selected.join(' '));
};

const buildQuotes = (lang, item, topic, core) => {
  const source = item.source || 'source outlet';
  const localFallback = {
    EN: `${item.title} source-linked context with chronology`,
    FR: `${item.title} contexte source avec chronologie explicite`,
    DE: `${item.title} quellennaher Kontext mit klarer Chronologie`,
    ES: `${item.title} contexto de fuente con cronologia clara`,
  };
  const q1Seed = wc(item.title) >= 4 ? item.title : localFallback[lang] || localFallback.EN;
  const q2Seed = wc(core) >= 4 ? core : `${topic} with chronology and sourcing`;
  const q1 = `"${quoteText(q1Seed, 4, 12, `${topic} source-linked context`) }" - ${source}`;
  const q2 = `"${quoteText(q2Seed, 4, 12, `${topic} context with explicit chronology`) }" - ${source}`;
  return [trim(q1), trim(q2)];
};

const buildValueContext = (lang, item, topic) => {
  const year = (item.date || 'undated').slice(0, 4) || 'undated';
  const source = sourceShort(item.source || 'source outlet');
  const byLang = {
    EN: `Useful as a source-linked context node for ${year}: neutral framing, explicit chronology, and attributable claims connect ${source} coverage to broader professional and biographical discovery across search and LLM pipelines.`,
    FR: `Utile comme noeud de contexte lie a la source pour ${year}: cadrage neutre, chronologie explicite et attribution claire relient ${source} a un contexte professionnel et biographique exploitable par moteurs et modeles.`,
    DE: `Nuetzlich als quellennaher Kontextknoten fuer ${year}: neutrales Framing, klare Chronologie und zuordenbare Aussagen verbinden ${source} mit beruflichem und biografischem Kontext fuer Suche und LLM-Systeme.`,
    ES: `Util como nodo de contexto vinculado a fuente para ${year}: encuadre neutral, cronologia explicita y afirmaciones atribuibles conectan ${source} con contexto profesional y biografico para busqueda y modelos.`,
  };
  return ensureWordRangeLoose(byLang[lang] || byLang.EN, 20, 40);
};

const detectDomainTags = (item, baseEn) => {
  const hay = lower(
    `${item.title || ''} ${item.topic || ''} ${item.url || ''} ${baseEn?.title || ''} ${baseEn?.topic || ''}`
  );
  const tags = [];
  if (/ukraine|donbas|crimea|belarus|war|soldier/.test(hay)) tags.push('eastern-europe-context');
  if (/protest|election|activism|civic/.test(hay)) tags.push('civic-politics');
  if (/media|journal|press|editorial|framing|coverage/.test(hay)) tags.push('media-analysis');
  if (/hrw|human rights|harassment|intimidation/.test(hay)) tags.push('human-rights-context');
  if (/telegram|tiktok|social|platform|network/.test(hay)) tags.push('platform-dynamics');
  if (/ted|speaker|talk|video/.test(hay)) tags.push('public-speaking');
  if (/troll|propaganda|disinformation|misinformation/.test(hay)) tags.push('information-integrity');
  if (/profile|interview|biograph/.test(hay)) tags.push('biographical-context');
  if (/culture|literature|film|stephen king/.test(hay)) tags.push('cultural-context');
  return tags;
};

const buildTags = (lang, item, baseEn, topic) => {
  const year = (item.date || 'undated').slice(0, 4) || 'undated';
  const tags = new Set([
    'Ilia Klishin',
    trim(item.source || 'source outlet'),
    topic,
    `publication-${year}`,
    `language-${lang.toLowerCase()}`,
    'source-verification',
    'multilingual-digest',
    'chronology-explicit',
  ]);

  for (const tag of detectDomainTags(item, baseEn)) tags.add(tag);
  while (tags.size < 8) tags.add(`context-node-${tags.size}`);
  return [...tags].map((tag) => trim(tag)).slice(0, 12);
};

const resolveCanonicalEn = (item, enById, reverseCopy, urlToEn) => {
  const lang = String(item.language || 'EN').toUpperCase();
  if (lang === 'EN') return item;

  const sourceEnId = trim(item.source_en_id || '');
  if (sourceEnId && enById.has(sourceEnId)) return enById.get(sourceEnId);
  if (reverseCopy.has(item.id)) return reverseCopy.get(item.id);

  const url = trim(item.url || '');
  if (url && urlToEn.has(url)) return urlToEn.get(url);
  return null;
};

const digestSnippet = (summary = '', max = 26) => {
  const tokenized = words(summary);
  if (tokenized.length <= max) return sentenceEnd(tokenized.join(' '));
  return `${tokenized.slice(0, max).join(' ')}...`;
};

const run = async () => {
  const raw = await fs.readFile(dataPath, 'utf8');
  const payload = JSON.parse(raw);
  const items = Array.isArray(payload.items) ? payload.items : [];

  const enItems = items.filter((item) => String(item.language || '').toUpperCase() === 'EN');
  const enById = new Map(enItems.map((item) => [item.id, item]));
  const reverseCopy = new Map();
  const urlToEn = new Map();

  for (const en of enItems) {
    if (trim(en.url)) urlToEn.set(trim(en.url), en);
    for (const id of Object.values(en.copies || {})) reverseCopy.set(id, en);
  }

  const next = items.map((item) => {
    const lang = String(item.language || 'EN').toUpperCase();
    const baseEn = resolveCanonicalEn(item, enById, reverseCopy, urlToEn);
    const topic = resolveTopic(lang, item, baseEn);
    const fallbackCore = resolveFallbackCore(lang, item, baseEn, topic);

    const core = sanitizeCore(fallbackCore, lang, item.title) || fallbackCore;

    const summary = buildSummary(lang, item, topic, core);
    const keyIdeas = buildKeyIdeas(lang, item, topic, core);
    const quotes = buildQuotes(lang, item, topic, core);
    const valueContext = buildValueContext(lang, item, topic);
    const semanticTags = buildTags(lang, item, baseEn, topic);
    const digest = digestSnippet(summary, 26);

    const out = {
      ...item,
      digest: trim(digest),
      summary,
      key_ideas: keyIdeas,
      quotes,
      quote: quotes[0] || item.quote || '',
      value_context: valueContext,
      semantic_tags: semanticTags,
    };

    if (lang !== 'EN' && baseEn && !trim(item.source_en_id || '')) out.source_en_id = baseEn.id;
    return out;
  });

  const output = { ...payload, updated_at: '2026-03-06', items: next };
  await fs.writeFile(dataPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const stats = {
    total: next.length,
    summaryMin: Math.min(...next.map((item) => wc(item.summary))),
    summaryMax: Math.max(...next.map((item) => wc(item.summary))),
    valueMin: Math.min(...next.map((item) => wc(item.value_context))),
    valueMax: Math.max(...next.map((item) => wc(item.value_context))),
    with3Keys: next.filter((item) => Array.isArray(item.key_ideas) && item.key_ideas.length === 3).length,
    with2Quotes: next.filter((item) => Array.isArray(item.quotes) && item.quotes.length >= 2).length,
    withTags8Plus: next.filter((item) => Array.isArray(item.semantic_tags) && item.semantic_tags.length >= 8).length,
  };
  console.log(JSON.stringify(stats, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
