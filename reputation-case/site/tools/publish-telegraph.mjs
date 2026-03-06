import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.telegra.ph';
const repoRoot = '/Users/ilyaklishin/Documents/Playground';
const preparedDataPath = '/tmp/playground-main-basket1/insights/data/digests.json';
const fallbackDataPath = path.join(repoRoot, 'reputation-case', 'site', 'data', 'digests.json');
const outDir = path.join(repoRoot, 'reputation-case', 'final-forms');
const tokenPath = path.join(outDir, 'telegraph-account.json');
const registryPath = path.join(outDir, 'telegraph-published-pages.json');
const csvPath = path.join(outDir, 'telegraph-published-pages.csv');
const AUTHOR_URL = 'https://www.klishin.work/insights/';
const TELEGRAPH_UPDATE_LEGACY_PATHS = process.env.TELEGRAPH_UPDATE_LEGACY_PATHS === '1';
const TELEGRAPH_ONLY_IDS = (process.env.TELEGRAPH_ONLY_IDS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLACEHOLDER_QUOTE_RE =
  /short quote marker|extract will be limited|source-attributed|citation breve|uniquement|kurzes zitat|nur kurzes|brief quote marker|citation courte/i;
const META_SENTENCE_RE =
  /user-?preferred|selected by ilya|explicitly selected|priority multilingual|adaptation queue|strategic proof point|for reputation context|multilingual scaling|digest entry|now in priority|file de diffusion|priorisierte|priorisierter/i;
const META_TITLE_FRAGMENT_RE =
  /\(([^)]*(user-?preferred|user-?highlighted|priority|strategic proof point|favorite essay)[^)]*)\)/gi;

const normalizeSpaces = (text = '') => String(text).replace(/\s+/g, ' ').trim();

function splitSentences(text = '') {
  const compact = normalizeSpaces(text);
  if (!compact) return [];
  const parts = compact.match(/[^.!?]+[.!?]?/g);
  return parts ? parts.map((x) => x.trim()).filter(Boolean) : [compact];
}

function fallbackSummary(item) {
  const outlet = item.source || 'the source outlet';
  const d = item.date ? ` (${item.date})` : '';
  if (item.language === 'FR') {
    return `Resume factuel bref de l'article original publie sur ${outlet}${d}, sans extrapolation.`;
  }
  if (item.language === 'DE') {
    return `Kurze sachliche Zusammenfassung des Originalbeitrags bei ${outlet}${d}, ohne Extrapolation.`;
  }
  if (item.language === 'ES') {
    return `Resumen factual breve del articulo original publicado en ${outlet}${d}, sin extrapolacion.`;
  }
  return `Brief factual summary of the original article published by ${outlet}${d}, without extrapolation.`;
}

function cleanSummary(item) {
  const sentences = splitSentences(item.digest || '');
  const filtered = sentences.filter((s) => !META_SENTENCE_RE.test(s));
  const summary = normalizeSpaces(filtered.join(' '));
  return summary || fallbackSummary(item);
}

function cleanQuote(item) {
  const raw = normalizeSpaces(item.quote || '');
  if (!raw) return '';
  if (PLACEHOLDER_QUOTE_RE.test(raw) || META_SENTENCE_RE.test(raw)) return '';
  const stripped = raw.replace(/^["'“”]+|["'“”]+$/g, '');
  return stripped.length > 180 ? `${stripped.slice(0, 177)}...` : stripped;
}

function cleanTitle(title = '') {
  let next = String(title || '');
  next = next.replace(/^user-?preferred\s+/i, '');
  next = next.replace(META_TITLE_FRAGMENT_RE, '');
  next = normalizeSpaces(next.replace(/\s+[-|:]\s*$/, ''));
  return next || String(title || 'Untitled');
}

function buildLegacyCandidatePaths(pathValue = '') {
  const pathText = String(pathValue || '').trim();
  if (!pathText) return [];
  const m = pathText.match(/^(.*-\d{2}-\d{2})(-\d+)?$/);
  if (!m) return [pathText];
  const base = m[1];
  return [...new Set([pathText, base, `${base}-2`, `${base}-3`])];
}

const slugify = (text = '') =>
  String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 42) || 'entry';

const safeTitle = (id, title) => {
  const raw = `${id.toUpperCase()} | ${title}`;
  return raw.length > 255 ? `${raw.slice(0, 252)}...` : raw;
};

function buildNodes(item) {
  const summary = cleanSummary(item);
  const quote = cleanQuote(item);
  const hasQuote = Boolean(quote);
  const sourceLine = item.source
    ? `${item.source}${item.date ? ` (${item.date})` : ''}`
    : item.date || 'undated source';

  return [
    { tag: 'h3', children: [item.title] },
    { tag: 'p', children: [summary] },
    { tag: 'h4', children: ['Source'] },
    { tag: 'p', children: [`Outlet: ${sourceLine}`] },
    { tag: 'p', children: [`Language: ${item.language}`] },
    hasQuote ? { tag: 'h4', children: ['Short attributed excerpt'] } : null,
    hasQuote ? { tag: 'blockquote', children: [quote] } : null,
    {
      tag: 'p',
      children: [
        { tag: 'a', attrs: { href: item.url }, children: ['Open original source'] },
      ],
    },
  ].filter(Boolean);
}

async function apiCall(method, params) {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    form.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }

  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(`${method} failed: ${json.error}`);
  }
  return json.result;
}

async function apiCallWithRetry(method, params, attempt = 1) {
  try {
    return await apiCall(method, params);
  } catch (error) {
    const msg = String(error?.message || '');
    const match = msg.match(/FLOOD_WAIT_(\d+)/);
    if (match) {
      const waitSec = Number(match[1]) || 5;
      const backoff = Math.min(waitSec + 1, 30);
      process.stdout.write(`rate limit: ${method}, waiting ${backoff}s\\n`);
      await sleep(backoff * 1000);
      return apiCallWithRetry(method, params, attempt + 1);
    }
    throw error;
  }
}

async function getDataPath() {
  try {
    await fs.access(preparedDataPath);
    return preparedDataPath;
  } catch {
    return fallbackDataPath;
  }
}

async function ensureAccount() {
  await fs.mkdir(outDir, { recursive: true });

  try {
    const raw = await fs.readFile(tokenPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.access_token) return parsed;
  } catch {}

  const created = await apiCall('createAccount', {
    short_name: 'ilya_digest',
    author_name: 'Ilia Klishin',
    author_url: AUTHOR_URL,
  });

  await fs.writeFile(tokenPath, JSON.stringify(created, null, 2) + '\n', 'utf8');
  return created;
}

async function loadRegistry() {
  try {
    const raw = await fs.readFile(registryPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { generated_at: null, source_data: null, items: [] };
  }
}

function toCsv(items) {
  const head = ['id', 'language', 'date', 'title', 'source', 'path', 'url', 'original_url'];
  const esc = (v = '') => `"${String(v).replaceAll('"', '""')}"`;
  const rows = items.map((x) =>
    [x.id, x.language, x.date, x.title, x.source, x.path, x.url, x.original_url].map(esc).join(',')
  );
  return [head.join(','), ...rows].join('\n') + '\n';
}

async function persistRegistry(items, dataPath, byId) {
  const outItems = items.map((x) => byId.get(x.id)).filter(Boolean);
  const state = {
    generated_at: new Date().toISOString(),
    source_data: dataPath,
    count: outItems.length,
    items: outItems,
  };
  await fs.writeFile(registryPath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  await fs.writeFile(csvPath, toCsv(outItems), 'utf8');
  return state;
}

async function publishAll() {
  const dataPath = await getDataPath();
  const payload = JSON.parse(await fs.readFile(dataPath, 'utf8'));
  const allItems = Array.isArray(payload.items) ? payload.items : [];
  let items = allItems;
  if (TELEGRAPH_ONLY_IDS.length > 0) {
    items = items.filter((x) => TELEGRAPH_ONLY_IDS.includes(x.id));
  }

  if (!items.length) throw new Error('No items in digest dataset');

  const account = await ensureAccount();
  const registry = await loadRegistry();
  const byId = new Map(registry.items.map((x) => [x.id, x]));

  for (const item of items) {
    const cleanedTitle = cleanTitle(item.title);
    const normalizedItem = { ...item, title: cleanedTitle };
    const generatedPath = `ik-${item.id}-${slugify(cleanedTitle)}`.slice(0, 90);
    const existing = byId.get(item.id);
    const targetPath = existing?.path || generatedPath;
    const title = safeTitle(item.id, cleanedTitle);
    const content = buildNodes(normalizedItem);

    let result;
    try {
      result = await apiCallWithRetry('editPage', {
        access_token: account.access_token,
        path: targetPath,
        title,
        author_name: 'Ilia Klishin',
        author_url: AUTHOR_URL,
        content,
        return_content: false,
      });
    } catch (err) {
      const message = String(err.message || '');
      if (/PATH_ACCESS_DENIED|PAGE_NOT_FOUND|PATH_REQUIRED/i.test(message)) {
        result = await apiCallWithRetry('createPage', {
          access_token: account.access_token,
          title,
          author_name: 'Ilia Klishin',
          author_url: AUTHOR_URL,
          path: generatedPath,
          content,
          return_content: false,
        });
      } else {
        throw err;
      }
    }

    if (TELEGRAPH_UPDATE_LEGACY_PATHS) {
      const legacyPaths = buildLegacyCandidatePaths(result.path).filter((x) => x !== result.path);
      for (const legacyPath of legacyPaths) {
        try {
          await apiCallWithRetry('editPage', {
            access_token: account.access_token,
            path: legacyPath,
            title,
            author_name: 'Ilia Klishin',
            author_url: AUTHOR_URL,
            content,
            return_content: false,
          });
          process.stdout.write(`legacy-updated ${item.id} -> ${legacyPath}\n`);
        } catch (legacyErr) {
          const msg = String(legacyErr?.message || '');
          if (/PATH_ACCESS_DENIED|PAGE_NOT_FOUND|PATH_REQUIRED/i.test(msg)) {
            continue;
          }
          throw legacyErr;
        }
      }
    }

    const row = {
      id: item.id,
      language: item.language,
      date: item.date,
      title: cleanedTitle,
      source: item.source,
      path: result.path,
      url: result.url,
      original_url: item.url,
      updated_at: new Date().toISOString(),
    };

    byId.set(item.id, row);
    process.stdout.write(`published ${item.id} -> ${result.url}\n`);
    await persistRegistry(allItems, dataPath, byId);
    await sleep(700);
  }

  const finalRegistry = await persistRegistry(allItems, dataPath, byId);
  const outItems = finalRegistry.items;

  const summary = {
    source_data: dataPath,
    count: outItems.length,
    first_url: outItems[0]?.url || null,
    last_url: outItems[outItems.length - 1]?.url || null,
    token_file: tokenPath,
    registry_file: registryPath,
    csv_file: csvPath,
  };

  console.log(JSON.stringify(summary, null, 2));
}

publishAll().catch((e) => {
  console.error(e);
  process.exit(1);
});
