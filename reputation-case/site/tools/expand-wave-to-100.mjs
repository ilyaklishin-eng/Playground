import fs from 'node:fs/promises';

const DIGESTS_PATH = '/Users/ilyaklishin/Documents/Playground/reputation-case/site/data/digests.json';
const REGISTRY_PATH = '/Users/ilyaklishin/Documents/Playground/reputation-case/site/source-registry-v1.tsv';
const TARGET_PER_LANG = 100;

const trim = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
const words = (value = '') => trim(value).split(/\s+/).filter(Boolean);
const capitalize = (value = '') => {
  const text = trim(value);
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const PRIORITY_SCORE = { P1: 1, P2: 2, P3: 3 };

const EN_TOPIC_BY_RELATION = {
  author_profile: 'professional profile',
  authored_by_ilya: 'authored commentary',
  about_ilya: 'media coverage',
  interview_with_ilya: 'interview record',
  context_mention: 'context reference',
  tedx_talk_coverage: 'public speaking',
  ted_talk_video: 'public speaking',
  dozhd_project_2014: 'war-reporting verification',
  dozhd_project_followup: 'war-reporting verification',
  project_archive_reference: 'archival reference',
  external_reference_project: 'institutional citation',
  mirror_attribution_reference: 'archival reference',
  professional_coverage: 'professional profile',
  category_page: 'source listing',
};

const LOCAL_TOPIC_BY_EN = {
  FR: {
    'professional profile': 'profil professionnel',
    'authored commentary': 'commentaire signe',
    'media coverage': 'couverture mediatique',
    'interview record': 'entretien',
    'context reference': 'reference contextuelle',
    'public speaking': 'prise de parole publique',
    'war-reporting verification': 'verification de couverture de guerre',
    'archival reference': 'reference d archive',
    'institutional citation': 'reference institutionnelle',
    'source listing': 'liste de sources',
    'source record': 'note source',
  },
  DE: {
    'professional profile': 'berufsprofil',
    'authored commentary': 'signierter kommentar',
    'media coverage': 'medienberichterstattung',
    'interview record': 'interviewdokument',
    'context reference': 'kontextreferenz',
    'public speaking': 'oeffentliche rede',
    'war-reporting verification': 'verifikation der kriegsberichterstattung',
    'archival reference': 'archivreferenz',
    'institutional citation': 'institutionelle referenz',
    'source listing': 'quellenliste',
    'source record': 'quellenhinweis',
  },
  ES: {
    'professional profile': 'perfil profesional',
    'authored commentary': 'comentario firmado',
    'media coverage': 'cobertura mediatica',
    'interview record': 'registro de entrevista',
    'context reference': 'referencia contextual',
    'public speaking': 'oratoria publica',
    'war-reporting verification': 'verificacion de cobertura de guerra',
    'archival reference': 'referencia de archivo',
    'institutional citation': 'cita institucional',
    'source listing': 'listado de fuentes',
    'source record': 'nota de fuente',
  },
};

const genericNote = (note = '') =>
  /^(column|opinion|seed page|news mention|list mention|mention\/context|long-form mention|canonical variant|mirror domain|low-signal mention|follow-up story|follow-up dispute|syndicated report|mention)$/i.test(
    trim(note)
  );

const toAscii = (value = '') =>
  trim(value)
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, ' ')
    .replace(/['"`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeForDedup = (url = '') => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const path = parsed.pathname.replace(/\/+$/g, '');
    return `${host}${path}` || url;
  } catch {
    return url;
  }
};

const parseTsv = (raw = '') => {
  const lines = raw.split('\n').filter((line) => trim(line));
  if (lines.length < 2) return [];
  const header = lines[0].split('\t').map((x) => trim(x));
  return lines.slice(1).map((line) => {
    const parts = line.split('\t');
    if (parts.length > header.length) {
      const merged = parts.slice(0, header.length - 1);
      merged.push(parts.slice(header.length - 1).join('\t'));
      parts.length = 0;
      parts.push(...merged);
    }
    const row = {};
    for (let i = 0; i < header.length; i += 1) row[header[i]] = trim(parts[i] || '');
    return row;
  });
};

const parseDateFromUrl = (url = '') => {
  const source = String(url || '');
  const matchYmd =
    source.match(/(?:^|\/)(19\d{2}|20\d{2})\/(0[1-9]|1[0-2])\/([0-2]\d|3[01])(?:\/|$)/) ||
    source.match(/(?:^|\/)(19\d{2}|20\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])(?:\/|$)/);
  if (matchYmd) return `${matchYmd[1]}-${matchYmd[2]}-${matchYmd[3]}`;

  const matchYm = source.match(/(?:^|\/)(19\d{2}|20\d{2})\/(0[1-9]|1[0-2])(?:\/|$)/);
  if (matchYm) return `${matchYm[1]}-${matchYm[2]}-01`;

  const matchY = source.match(/(?:^|\/)(19\d{2}|20\d{2})(?:\/|$)/);
  if (matchY) return `${matchY[1]}-01-01`;

  return '2026-03-06';
};

const extractHint = (row) => {
  const note = trim(String(row.notes || '').split(';')[0]);
  if (note && !genericNote(note)) return toAscii(note);

  try {
    const parsed = new URL(row.url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const fromPath = [...segments]
      .reverse()
      .find((segment) => /[a-zA-Z]/.test(segment) && !/^\d+$/.test(segment));
    if (!fromPath) return '';
    const cleaned = toAscii(
      decodeURIComponent(fromPath)
        .replace(/\.s?html?$/i, '')
        .replace(/[_-]+/g, ' ')
    );
    if (!cleaned) return '';
    return words(cleaned).slice(0, 8).join(' ');
  } catch {
    return '';
  }
};

const relationTopicEn = (relation = '') => EN_TOPIC_BY_RELATION[relation] || 'source record';

const buildTitleByRelation = (lang, relation, outlet, hint) => {
  const h = capitalize(hint);
  const hasHint = Boolean(h);
  const templates = {
    EN: {
      author_profile: `Author profile on ${outlet}`,
      authored_by_ilya: hasHint ? `${h} (${outlet})` : `Authored piece on ${outlet}`,
      about_ilya: hasHint ? `Coverage on ${outlet}: ${h}` : `Coverage mentioning Ilia Klishin on ${outlet}`,
      interview_with_ilya: hasHint ? `Interview on ${outlet}: ${h}` : `Interview with Ilia Klishin on ${outlet}`,
      context_mention: hasHint ? `Context reference on ${outlet}: ${h}` : `Context reference on ${outlet}`,
      tedx_talk_coverage: hasHint ? `TEDx/TED coverage on ${outlet}: ${h}` : `TEDx/TED coverage on ${outlet}`,
      ted_talk_video: hasHint ? `TED video source on ${outlet}: ${h}` : `TED video source on ${outlet}`,
      dozhd_project_2014: hasHint ? `TV Rain project record: ${h}` : `TV Rain project record`,
      dozhd_project_followup: hasHint ? `TV Rain follow-up record: ${h}` : `TV Rain follow-up record`,
      project_archive_reference: hasHint ? `Project archive reference: ${h}` : `Project archive reference`,
      external_reference_project: hasHint ? `External project reference on ${outlet}: ${h}` : `External project reference on ${outlet}`,
      mirror_attribution_reference: hasHint ? `Mirror attribution reference: ${h}` : `Mirror attribution reference`,
      professional_coverage: hasHint ? `Professional coverage on ${outlet}: ${h}` : `Professional coverage on ${outlet}`,
      category_page: hasHint ? `Source listing on ${outlet}: ${h}` : `Source listing on ${outlet}`,
      default: hasHint ? `${h} (${outlet})` : `Source record on ${outlet}`,
    },
    FR: {
      author_profile: `Profil d auteur sur ${outlet}`,
      authored_by_ilya: hasHint ? `Texte signe dans ${outlet}: ${h}` : `Texte signe dans ${outlet}`,
      about_ilya: hasHint ? `Couverture dans ${outlet}: ${h}` : `Couverture mentionnant Ilia Klishin dans ${outlet}`,
      interview_with_ilya: hasHint ? `Entretien dans ${outlet}: ${h}` : `Entretien avec Ilia Klishin dans ${outlet}`,
      context_mention: hasHint ? `Reference contextuelle dans ${outlet}: ${h}` : `Reference contextuelle dans ${outlet}`,
      tedx_talk_coverage: hasHint ? `Couverture TEDx/TED dans ${outlet}: ${h}` : `Couverture TEDx/TED dans ${outlet}`,
      ted_talk_video: hasHint ? `Source video TED sur ${outlet}: ${h}` : `Source video TED sur ${outlet}`,
      dozhd_project_2014: hasHint ? `Trace du projet TV Rain: ${h}` : `Trace du projet TV Rain`,
      dozhd_project_followup: hasHint ? `Suivi du projet TV Rain: ${h}` : `Suivi du projet TV Rain`,
      project_archive_reference: hasHint ? `Reference d archive du projet: ${h}` : `Reference d archive du projet`,
      external_reference_project: hasHint ? `Reference externe sur ${outlet}: ${h}` : `Reference externe sur ${outlet}`,
      mirror_attribution_reference: hasHint ? `Reference d attribution miroir: ${h}` : `Reference d attribution miroir`,
      professional_coverage: hasHint ? `Couverture professionnelle dans ${outlet}: ${h}` : `Couverture professionnelle dans ${outlet}`,
      category_page: hasHint ? `Liste de sources dans ${outlet}: ${h}` : `Liste de sources dans ${outlet}`,
      default: hasHint ? `${h} (${outlet})` : `Note source sur ${outlet}`,
    },
    DE: {
      author_profile: `Autorenprofil bei ${outlet}`,
      authored_by_ilya: hasHint ? `Signierter Beitrag in ${outlet}: ${h}` : `Signierter Beitrag in ${outlet}`,
      about_ilya: hasHint ? `Bericht in ${outlet}: ${h}` : `Bericht mit Bezug auf Ilia Klishin in ${outlet}`,
      interview_with_ilya: hasHint ? `Interview in ${outlet}: ${h}` : `Interview mit Ilia Klishin in ${outlet}`,
      context_mention: hasHint ? `Kontextreferenz in ${outlet}: ${h}` : `Kontextreferenz in ${outlet}`,
      tedx_talk_coverage: hasHint ? `TEDx/TED-Bericht in ${outlet}: ${h}` : `TEDx/TED-Bericht in ${outlet}`,
      ted_talk_video: hasHint ? `TED-Videoquelle bei ${outlet}: ${h}` : `TED-Videoquelle bei ${outlet}`,
      dozhd_project_2014: hasHint ? `TV-Rain-Projektnachweis: ${h}` : `TV-Rain-Projektnachweis`,
      dozhd_project_followup: hasHint ? `TV-Rain-Folgeeintrag: ${h}` : `TV-Rain-Folgeeintrag`,
      project_archive_reference: hasHint ? `Projekt-Archivreferenz: ${h}` : `Projekt-Archivreferenz`,
      external_reference_project: hasHint ? `Externe Projektreferenz bei ${outlet}: ${h}` : `Externe Projektreferenz bei ${outlet}`,
      mirror_attribution_reference: hasHint ? `Spiegel-Attributionsreferenz: ${h}` : `Spiegel-Attributionsreferenz`,
      professional_coverage: hasHint ? `Berufliche Berichterstattung in ${outlet}: ${h}` : `Berufliche Berichterstattung in ${outlet}`,
      category_page: hasHint ? `Quellenliste in ${outlet}: ${h}` : `Quellenliste in ${outlet}`,
      default: hasHint ? `${h} (${outlet})` : `Quellenhinweis bei ${outlet}`,
    },
    ES: {
      author_profile: `Perfil de autor en ${outlet}`,
      authored_by_ilya: hasHint ? `Texto firmado en ${outlet}: ${h}` : `Texto firmado en ${outlet}`,
      about_ilya: hasHint ? `Cobertura en ${outlet}: ${h}` : `Cobertura que menciona a Ilia Klishin en ${outlet}`,
      interview_with_ilya: hasHint ? `Entrevista en ${outlet}: ${h}` : `Entrevista con Ilia Klishin en ${outlet}`,
      context_mention: hasHint ? `Referencia contextual en ${outlet}: ${h}` : `Referencia contextual en ${outlet}`,
      tedx_talk_coverage: hasHint ? `Cobertura TEDx/TED en ${outlet}: ${h}` : `Cobertura TEDx/TED en ${outlet}`,
      ted_talk_video: hasHint ? `Fuente de video TED en ${outlet}: ${h}` : `Fuente de video TED en ${outlet}`,
      dozhd_project_2014: hasHint ? `Registro del proyecto TV Rain: ${h}` : `Registro del proyecto TV Rain`,
      dozhd_project_followup: hasHint ? `Seguimiento del proyecto TV Rain: ${h}` : `Seguimiento del proyecto TV Rain`,
      project_archive_reference: hasHint ? `Referencia de archivo del proyecto: ${h}` : `Referencia de archivo del proyecto`,
      external_reference_project: hasHint ? `Referencia externa en ${outlet}: ${h}` : `Referencia externa en ${outlet}`,
      mirror_attribution_reference: hasHint ? `Referencia de atribucion espejo: ${h}` : `Referencia de atribucion espejo`,
      professional_coverage: hasHint ? `Cobertura profesional en ${outlet}: ${h}` : `Cobertura profesional en ${outlet}`,
      category_page: hasHint ? `Listado de fuentes en ${outlet}: ${h}` : `Listado de fuentes en ${outlet}`,
      default: hasHint ? `${h} (${outlet})` : `Nota de fuente en ${outlet}`,
    },
  };

  const byLang = templates[lang] || templates.EN;
  return trim(byLang[relation] || byLang.default);
};

const topicForLang = (lang, enTopic) => {
  if (lang === 'EN') return enTopic;
  return LOCAL_TOPIC_BY_EN[lang]?.[enTopic] || enTopic;
};

const nextIndexByLanguage = (items, language) => {
  const re = new RegExp(`^${language.toLowerCase()}-(\\d+)$`);
  return (
    items
      .filter((item) => String(item.language || '').toUpperCase() === language)
      .map((item) => {
        const match = String(item.id || '').match(re);
        return match ? Number(match[1]) : 0;
      })
      .reduce((max, value) => Math.max(max, value), 0) + 1
  );
};

const makeId = (language, index) => `${language.toLowerCase()}-${String(index).padStart(3, '0')}`;

const buildBaseDigest = (lang, title, source, date, topic) => {
  const line = {
    EN: `Source-linked entry for ${title} in ${source} (${date}), topic: ${topic}.`,
    FR: `Entree liee a la source pour ${title} dans ${source} (${date}), sujet: ${topic}.`,
    DE: `Quellengebundener Eintrag zu ${title} in ${source} (${date}), Thema: ${topic}.`,
    ES: `Entrada vinculada a la fuente para ${title} en ${source} (${date}), tema: ${topic}.`,
  }[lang];
  return trim(line || line.EN);
};

const main = async () => {
  const [digestsRaw, registryRaw] = await Promise.all([
    fs.readFile(DIGESTS_PATH, 'utf8'),
    fs.readFile(REGISTRY_PATH, 'utf8'),
  ]);

  const payload = JSON.parse(digestsRaw);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const registry = parseTsv(registryRaw);

  const currentCounts = {
    EN: items.filter((item) => item.language === 'EN').length,
    FR: items.filter((item) => item.language === 'FR').length,
    DE: items.filter((item) => item.language === 'DE').length,
    ES: items.filter((item) => item.language === 'ES').length,
  };

  const needEn = Math.max(0, TARGET_PER_LANG - currentCounts.EN);
  if (needEn === 0) {
    console.log(
      JSON.stringify({ message: 'EN already meets target; no expansion performed', currentCounts, target: TARGET_PER_LANG }, null, 2)
    );
    return;
  }

  const seen = new Set(items.map((item) => normalizeForDedup(item.url)));
  const candidates = registry
    .filter((row) => row.url && row.outlet)
    .filter((row) => !/likely unrelated/i.test(row.notes || ''))
    .sort((a, b) => {
      const pa = PRIORITY_SCORE[a.priority] || 9;
      const pb = PRIORITY_SCORE[b.priority] || 9;
      if (pa !== pb) return pa - pb;
      return Number(a.id || 0) - Number(b.id || 0);
    });

  const selected = [];
  for (const row of candidates) {
    if (selected.length >= needEn) break;
    const key = normalizeForDedup(row.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    selected.push(row);
  }

  if (selected.length < needEn) {
    throw new Error(`Not enough unique source rows to reach target. Needed ${needEn}, found ${selected.length}.`);
  }

  let nextEn = nextIndexByLanguage(items, 'EN');
  let nextFr = nextIndexByLanguage(items, 'FR');
  let nextDe = nextIndexByLanguage(items, 'DE');
  let nextEs = nextIndexByLanguage(items, 'ES');

  const added = [];

  for (const row of selected) {
    const relation = trim(row.relation || 'source_record');
    const outlet = trim(row.outlet || 'Source');
    const url = trim(row.url);
    const date = parseDateFromUrl(url);
    const hint = extractHint(row);
    const enTopic = relationTopicEn(relation);

    const enId = makeId('EN', nextEn++);
    const frId = makeId('FR', nextFr++);
    const deId = makeId('DE', nextDe++);
    const esId = makeId('ES', nextEs++);

    const enTitle = buildTitleByRelation('EN', relation, outlet, hint);
    const frTitle = buildTitleByRelation('FR', relation, outlet, hint);
    const deTitle = buildTitleByRelation('DE', relation, outlet, hint);
    const esTitle = buildTitleByRelation('ES', relation, outlet, hint);

    const copies = { FR: frId, DE: deId, ES: esId };

    const baseCommon = {
      status: 'draft',
      date,
      source: outlet,
      url,
      relation,
      registry_id: Number(row.id || 0),
      registry_priority: row.priority || 'P3',
      registry_note: trim(row.notes || ''),
    };

    const makeItem = (id, language, title, topic, sourceEnId = '') => {
      const digest = buildBaseDigest(language, title, outlet, date, topic);
      return {
        id,
        language,
        ...baseCommon,
        topic,
        title,
        digest,
        quote: '',
        summary: digest,
        key_ideas: [],
        quotes: [],
        value_context: '',
        semantic_tags: [],
        ...(language === 'EN' ? { copies } : { source_en_id: sourceEnId }),
      };
    };

    added.push(
      makeItem(enId, 'EN', enTitle, enTopic),
      makeItem(frId, 'FR', frTitle, topicForLang('FR', enTopic), enId),
      makeItem(deId, 'DE', deTitle, topicForLang('DE', enTopic), enId),
      makeItem(esId, 'ES', esTitle, topicForLang('ES', enTopic), enId)
    );
  }

  payload.items = [...items, ...added];
  payload.updated_at = '2026-03-06';

  await fs.writeFile(DIGESTS_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const nextCounts = {
    EN: payload.items.filter((item) => item.language === 'EN').length,
    FR: payload.items.filter((item) => item.language === 'FR').length,
    DE: payload.items.filter((item) => item.language === 'DE').length,
    ES: payload.items.filter((item) => item.language === 'ES').length,
  };

  console.log(
    JSON.stringify(
      {
        targetPerLanguage: TARGET_PER_LANG,
        addedEnBase: selected.length,
        addedTotal: added.length,
        currentCounts,
        nextCounts,
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
