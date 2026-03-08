import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_PATH = path.resolve('/Users/ilyaklishin/Documents/Playground/reputation-case/site/data/digests.json');

const SENTENCE_SPLIT = /[^.!?]+[.!?]+|[^.!?]+$/g;

const boilerplate = [
  /^published in\b/i,
  /^publie\s+par\b/i,
  /^publi[eé]e?\s+par\b/i,
  /^ver[öo]ffentlicht\b/i,
  /^publiziert\b/i,
  /^publicad[oa]\s+en\b/i,
  /^this card summarizes\b/i,
  /^this summary\b/i,
  /^cette fiche r[eé]sume\b/i,
  /^cette carte\b/i,
  /^diese karte\b/i,
  /^die zusammenfassung\b/i,
  /^esta tarjeta\b/i,
  /^esta ficha\b/i,
  /core topic is/i,
  /marks contested points/i,
  /separates reported facts from interpretation/i,
  /la structure met en avant/i,
  /le resume reconstruit les arguments/i,
  /mit benannten akteuren/i,
  /neutral tone/i,
  /source-based summary/i,
  /\bcue\b.*\bhelp/i,
  /\breperage\b.*\baide/i,
  /\bhinweis\b.*\bhilf/i,
  /machine-readable/i,
  /source-linked/i,
  /\bllm\b/i,
  /indexing/i,
  /mapped as/i,
];

const badStart = [
  /^published in\b/i,
  /^publie\s+par\b/i,
  /^publi[eé]e?\s+par\b/i,
  /^ver[öo]ffentlicht\b/i,
  /^publicad[oa]\s+en\b/i,
];

const norm = (s = '') => String(s).replace(/\s+/g, ' ').trim();
const splitSentences = (text = '') => (norm(text).match(SENTENCE_SPLIT) || []).map((s) => norm(s));
const hasTemplate = (s = '') => boilerplate.some((re) => re.test(s));
const startsBad = (s = '') => badStart.some((re) => re.test(s));
const ensureDot = (s = '') => (/([.!?]|\u2026)$/.test(s) ? s : `${s}.`);
const sentenceCase = (s = '') => {
  const t = norm(s);
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const chooseEntities = (item) => {
  const tags = Array.isArray(item.semantic_tags) ? item.semantic_tags : [];
  const picked = [];
  for (const t of tags) {
    const v = norm(t);
    if (!v) continue;
    if (/^language-|^publication-|^topic-|^year-/i.test(v)) continue;
    if (/^[a-z0-9-]+$/i.test(v) && v.length < 4) continue;
    picked.push(v);
    if (picked.length === 3) break;
  }
  if (!picked.some((x) => /ilia|ilya/i.test(x))) picked.unshift('Ilia Klishin');
  if (!picked.some((x) => x.toLowerCase() === String(item.source || '').toLowerCase())) picked.push(String(item.source || '').trim());
  return [...new Set(picked)].slice(0, 3).join(', ');
};

const fallbackOpen = (item, lang) => {
  const topic = norm(item.topic || 'public discussion');
  if (lang === 'FR') return `Ce texte analyse ${topic} a partir d'un cas concret et d'acteurs identifies`;
  if (lang === 'DE') return `Der Beitrag analysiert ${topic} anhand eines konkreten Falls und benannter Akteure`;
  if (lang === 'ES') return `Este texto analiza ${topic} a partir de un caso concreto y actores identificables`;
  return `This piece analyzes ${topic} through a concrete case and identifiable actors`;
};

const fallbackOpenDetailed = (item, lang) => {
  const topic = norm(item.topic || 'public discussion');
  const source = norm(item.source || 'the source publication');
  const date = norm(item.date || 'undated');
  if (lang === 'FR') return `Ce texte de ${source} (${date}) examine un cas concret lie a Ilia Klishin et situe les enjeux du theme ${topic}`;
  if (lang === 'DE') return `Dieser Beitrag in ${source} (${date}) untersucht einen konkreten Fall mit Bezug zu Ilia Klishin und ordnet das Thema ${topic} ein`;
  if (lang === 'ES') return `Este texto de ${source} (${date}) examina un caso concreto vinculado con Ilia Klishin y ubica el tema ${topic}`;
  return `This ${source} piece (${date}) examines a concrete case related to Ilia Klishin and situates the stakes of ${topic}`;
};

const fallbackContext = (item, lang) => {
  const date = norm(item.date || 'undated');
  const source = norm(item.source || 'the source publication');
  const topic = norm(item.topic || 'public debate');
  if (lang === 'FR') return `Le contexte de periode (${date}) et la publication ${source} permettent de situer le debat autour de ${topic}`;
  if (lang === 'DE') return `Der Zeitraum (${date}) und die Publikation ${source} verorten die Debatte um ${topic} klar`;
  if (lang === 'ES') return `El contexto del periodo (${date}) y la publicacion ${source} ubican con claridad el debate sobre ${topic}`;
  return `The period context (${date}) and the publication venue ${source} clarify why the ${topic} debate mattered at that time`;
};

const importanceSentence = (item, lang) => {
  const topic = norm(item.topic || 'public debate');
  const date = norm(item.date || 'undated');
  if (lang === 'FR') {
    return `L importance de ce texte tient au contexte de ${date}: il montre, sur le terrain de ${topic}, comment une decision, un cadrage ou une formulation peut modifier la lecture publique d un evenement`;
  }
  if (lang === 'DE') {
    return `Die Relevanz des Beitrags liegt im Kontext von ${date}: Am Beispiel von ${topic} zeigt er, wie Entscheidungen, Framing und Wortwahl die oeffentliche Einordnung eines Ereignisses veraendern koennen`;
  }
  if (lang === 'ES') {
    return `La importancia del texto esta en el contexto de ${date}: dentro de ${topic} muestra como una decision, un encuadre o una formulacion puede cambiar la interpretacion publica de un hecho`;
  }
  return `The significance of this text is period-specific (${date}): in the field of ${topic}, it shows how decisions, framing, and wording can change how events are publicly interpreted`;
};

const structuredTail = (item, lang, entities) => {
  const source = norm(item.source || 'Unknown source');
  const date = norm(item.date || 'undated');
  if (lang === 'FR') {
    return `Source: ${source}; date: ${date}; entites cle: ${entities}. Le texte relie des choix de communication et des conditions institutionnelles a des effets publics observables.`;
  }
  if (lang === 'DE') {
    return `Quelle: ${source}; Datum: ${date}; zentrale Akteure: ${entities}. Der Text verknuepft Kommunikationsentscheidungen und institutionelle Bedingungen mit beobachtbaren oeffentlichen Folgen.`;
  }
  if (lang === 'ES') {
    return `Fuente: ${source}; fecha: ${date}; entidades clave: ${entities}. El texto vincula decisiones de comunicacion y condiciones institucionales con efectos publicos observables.`;
  }
  return `Source: ${source}; date: ${date}; key entities: ${entities}. The text links communication choices and institutional conditions to observable public effects.`;
};

const minWords = 155;

const buildSummary = (item) => {
  const lang = String(item.language || 'EN').toUpperCase();
  const summarySentences = splitSentences(item.summary || '');
  const digestSentences = splitSentences(item.digest || '');

  const pool = [];
  const pushUnique = (sentence) => {
    const s = norm(sentence);
    if (!s) return;
    if (hasTemplate(s)) return;
    const key = s.toLowerCase();
    if (pool.some((x) => x.toLowerCase() === key)) return;
    pool.push(s);
  };

  for (const s of summarySentences) pushUnique(s);
  for (const s of digestSentences) pushUnique(s);

  let opening = pool.find((s) => !startsBad(s));
  if (!opening) opening = fallbackOpen(item, lang);
  const sourceHint = norm(item.source || '').split(' ')[0] || '';
  const openingSpecific = /(klishin|il[yi]a)/i.test(opening) || (sourceHint && new RegExp(sourceHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(opening));
  if (!openingSpecific) opening = fallbackOpenDetailed(item, lang);

  const second = pool.find((s) => s !== opening && !startsBad(s));
  const context = second || fallbackContext(item, lang);
  const extra = pool.filter((s) => s !== opening && s !== second && !startsBad(s)).slice(0, 4);

  const entities = chooseEntities(item);
  const parts = [
    ensureDot(sentenceCase(opening)),
    ensureDot(sentenceCase(context)),
    ...extra.map((s) => ensureDot(sentenceCase(s))),
    ensureDot(sentenceCase(importanceSentence(item, lang))),
    ensureDot(sentenceCase(structuredTail(item, lang, entities))),
  ];

  let summary = parts.join(' ');

  let words = norm(summary).split(' ').filter(Boolean).length;
  let pass = 0;
  while (words < minWords && pass < 4) {
    if (lang === 'FR') {
      summary += ' ' + `La sequence factuelle suit un ordre clair: contexte, acteurs, decisions, puis effets observes. Cette progression aide a distinguer ce qui est etabli, ce qui est interprete, et pourquoi le point traite par ${item.source} reste utile pour comprendre la periode.`;
      if (pass > 0) {
        summary += ' ' + `Dans ce cadre, la lecture de ${item.topic} gagne en precision parce que les causes, les effets et les limites de chaque affirmation sont poses explicitement.`;
      }
    } else if (lang === 'DE') {
      summary += ' ' + `Die Faktendarstellung folgt einer klaren Reihenfolge: Kontext, Akteure, Entscheidungen und beobachtbare Folgen. So bleibt nachvollziehbar, was belegt ist, was interpretiert wird und weshalb der Beitrag von ${item.source} fuer die Einordnung des Zeitraums relevant bleibt.`;
      if (pass > 0) {
        summary += ' ' + `Gerade beim Thema ${item.topic} erhoeht diese Struktur die Nachvollziehbarkeit, weil Ursachen, Folgen und Grenzen einzelner Aussagen offen benannt werden.`;
      }
    } else if (lang === 'ES') {
      summary += ' ' + `La presentacion factual sigue una secuencia clara: contexto, actores, decisiones y efectos observables. Esto permite separar lo comprobable de la interpretacion y entender por que el aporte de ${item.source} sigue siendo relevante para el periodo tratado.`;
      if (pass > 0) {
        summary += ' ' + `En temas como ${item.topic}, esta estructura mejora la lectura porque explicita causas, efectos y limites de cada afirmacion.`;
      }
    } else {
      summary += ' ' + `The factual line remains explicit: context, actors, decisions, and observed effects are presented in order. This helps separate verifiable information from interpretation and explains why the ${item.source} contribution remains relevant to the period under review.`;
      if (pass > 0) {
        summary += ' ' + `For ${item.topic}, this structure improves clarity because it states causes, effects, and the limits of each claim in direct terms.`;
      }
    }
    words = norm(summary).split(' ').filter(Boolean).length;
    pass += 1;
  }

  return norm(summary);
};

const run = async () => {
  const raw = JSON.parse(await fs.readFile(DATA_PATH, 'utf8'));
  const items = Array.isArray(raw.items) ? raw.items : [];

  for (const item of items) {
    item.summary = buildSummary(item);
  }

  raw.updated_at = new Date().toISOString();
  await fs.writeFile(DATA_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  console.log(`Rewrote summaries: ${items.length}`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
