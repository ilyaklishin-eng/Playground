import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = '/Users/ilyaklishin/Documents/Playground';
const INPUT_REGISTRY = path.join(ROOT, 'reputation-case', 'final-forms', 'telegraph-published-pages.json');
const INPUT_INDEX = path.join(ROOT, 'reputation-case', 'final-forms', 'telegraph-index-page.json');
const OUT_DIR = path.join(ROOT, 'reputation-case', 'archives');
const OUT_JSON = path.join(OUT_DIR, 'wayback-telegraph-archive-2026-03-04.json');
const OUT_CSV = path.join(OUT_DIR, 'wayback-telegraph-archive-2026-03-04.csv');
const OUT_MD = path.join(OUT_DIR, 'wayback-telegraph-archive-2026-03-04.md');

const WAYBACK_SAVE = 'https://web.archive.org/save/';
const USER_AGENT = 'Mozilla/5.0 (compatible; IlyaKlishinArchiveBot/1.0; +https://telegra.ph/Ilya-Klishin-Digest-Index-ENFRDEES-03-04)';
const BETWEEN_REQUEST_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const csvEscape = (v = '') => `"${String(v).replaceAll('"', '""')}"`;

function toCsv(rows) {
  const head = [
    'id',
    'language',
    'source_url',
    'archive_url',
    'status',
    'http_status',
    'attempts',
    'archived_at',
    'error',
  ];
  const body = rows.map((r) =>
    [
      r.id || '',
      r.language || '',
      r.source_url || '',
      r.archive_url || '',
      r.status || '',
      r.http_status || '',
      r.attempts || '',
      r.archived_at || '',
      r.error || '',
    ]
      .map(csvEscape)
      .join(',')
  );
  return [head.join(','), ...body].join('\n') + '\n';
}

function toMarkdown(payload) {
  const ok = payload.items.filter((x) => x.status === 'saved').length;
  const fail = payload.items.length - ok;
  const lines = [
    '# Wayback Save Log — 2026-03-04',
    '',
    `- Total URLs: ${payload.items.length}`,
    `- Saved: ${ok}`,
    `- Failed: ${fail}`,
    `- Generated at: ${payload.generated_at}`,
    '',
    '| ID | Lang | Source URL | Archive URL | Status |',
    '|---|---|---|---|---|',
  ];
  for (const row of payload.items) {
    lines.push(
      `| ${row.id || ''} | ${row.language || ''} | ${row.source_url || ''} | ${row.archive_url || ''} | ${row.status || ''} |`
    );
  }
  return lines.join('\n') + '\n';
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function persist(items, startedAt) {
  const payload = {
    started_at: startedAt,
    generated_at: new Date().toISOString(),
    count: items.length,
    items,
  };
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_JSON, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  await fs.writeFile(OUT_CSV, toCsv(items), 'utf8');
  await fs.writeFile(OUT_MD, toMarkdown(payload), 'utf8');
}

async function saveOne(url) {
  const encoded = encodeURI(url);
  const target = `${WAYBACK_SAVE}${encoded}`;
  const res = await fetch(target, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'user-agent': USER_AGENT,
      accept: '*/*',
    },
    signal: AbortSignal.timeout(60_000),
  });

  const headers = Object.fromEntries(res.headers.entries());
  const location = headers.location || '';
  const contentLocation = headers['content-location'] || '';
  const runtimeError = headers['x-archive-wayback-runtime-error'] || '';
  const retryAfter = Number(headers['retry-after'] || 0);

  let archiveUrl = '';
  if (location) {
    archiveUrl = location.startsWith('http') ? location : `https://web.archive.org${location}`;
  } else if (contentLocation) {
    archiveUrl = contentLocation.startsWith('http')
      ? contentLocation
      : `https://web.archive.org${contentLocation}`;
  }

  return {
    httpStatus: res.status,
    archiveUrl,
    runtimeError,
    retryAfter,
    headers,
  };
}

async function archiveWithRetry(entry, maxAttempts = 6) {
  let lastError = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const r = await saveOne(entry.source_url);
      const retryWait = r.retryAfter > 0 ? r.retryAfter * 1000 : Math.min(30_000, attempt * 7000);

      if ((r.httpStatus === 301 || r.httpStatus === 302) && r.archiveUrl) {
        return {
          ...entry,
          status: 'saved',
          archive_url: r.archiveUrl,
          http_status: r.httpStatus,
          attempts: attempt,
          archived_at: new Date().toISOString(),
          error: '',
        };
      }

      if (r.httpStatus === 429 || r.httpStatus >= 500) {
        lastError = `retryable_http_${r.httpStatus}`;
        await sleep(retryWait);
        continue;
      }

      if (r.runtimeError) {
        lastError = r.runtimeError;
        if (/RobotAccessControlException|Access denied/i.test(r.runtimeError)) {
          return {
            ...entry,
            status: 'failed',
            archive_url: '',
            http_status: r.httpStatus,
            attempts: attempt,
            archived_at: new Date().toISOString(),
            error: r.runtimeError,
          };
        }
        await sleep(retryWait);
        continue;
      }

      lastError = `unexpected_http_${r.httpStatus}`;
      await sleep(retryWait);
    } catch (e) {
      lastError = String(e?.message || e);
      await sleep(Math.min(30_000, attempt * 7000));
    }
  }

  return {
    ...entry,
    status: 'failed',
    archive_url: '',
    http_status: '',
    attempts: maxAttempts,
    archived_at: new Date().toISOString(),
    error: lastError || 'unknown_error',
  };
}

async function buildInput() {
  const reg = await readJson(INPUT_REGISTRY, { items: [] });
  const idx = await readJson(INPUT_INDEX, {});

  const rows = (reg.items || []).map((x) => ({
    id: x.id,
    language: x.language,
    source_url: x.url,
  }));

  if (idx?.url) {
    rows.push({
      id: 'telegraph-index',
      language: 'MIX',
      source_url: idx.url,
    });
  }

  const uniq = new Map();
  for (const row of rows) {
    if (!row.source_url) continue;
    if (!uniq.has(row.source_url)) uniq.set(row.source_url, row);
  }
  return [...uniq.values()];
}

async function main() {
  const startedAt = new Date().toISOString();
  const input = await buildInput();
  if (!input.length) {
    throw new Error('No input URLs to archive');
  }

  const existing = await readJson(OUT_JSON, { items: [] });
  const byUrl = new Map((existing.items || []).map((x) => [x.source_url, x]));
  const results = [];

  for (const entry of input) {
    const cached = byUrl.get(entry.source_url);
    if (cached?.status === 'saved' && cached?.archive_url) {
      results.push(cached);
      process.stdout.write(`skip saved ${entry.id} -> ${cached.archive_url}\n`);
      continue;
    }

    const out = await archiveWithRetry(entry);
    results.push(out);
    process.stdout.write(`${out.status} ${entry.id} -> ${out.archive_url || out.error}\n`);
    await persist(results, startedAt);
    await sleep(BETWEEN_REQUEST_MS);
  }

  await persist(results, startedAt);
  const ok = results.filter((x) => x.status === 'saved').length;
  const fail = results.length - ok;
  console.log(JSON.stringify({ total: results.length, saved: ok, failed: fail, out_json: OUT_JSON }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
