import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = '/Users/ilyaklishin/Documents/Playground';
const PREPARED_DATA_PATH = '/tmp/playground-main-basket1/insights/data/digests.json';
const FALLBACK_DATA_PATH = path.join(ROOT, 'reputation-case', 'site', 'data', 'digests.json');
const OUT_DIR = path.join(ROOT, 'reputation-case', 'final-forms');
const REGISTRY_PATH = path.join(OUT_DIR, 'hashnode-published-pages.json');
const CSV_PATH = path.join(OUT_DIR, 'hashnode-published-pages.csv');

const HASHNODE_ENDPOINT = process.env.HASHNODE_ENDPOINT || 'https://gql.hashnode.com';
const HASHNODE_TOKEN = process.env.HASHNODE_TOKEN || '';
const HASHNODE_PUBLICATION_HOST = process.env.HASHNODE_PUBLICATION_HOST || '';
const HASHNODE_AUTO_PUBLISH = process.env.HASHNODE_AUTO_PUBLISH === '1';
const HASHNODE_REQUIRE_GITHUB_SOURCE = process.env.HASHNODE_REQUIRE_GITHUB_SOURCE !== '0';
const HASHNODE_AUTHOR_NAME = process.env.HASHNODE_AUTHOR_NAME || 'Ilia Klishin';
const HASHNODE_DELAY_MS = Number(process.env.HASHNODE_DELAY_MS || 1200);
const HASHNODE_MAX_ITEMS = Number(process.env.HASHNODE_MAX_ITEMS || 0);
const HASHNODE_FORCE_NEW_DRAFTS = process.env.HASHNODE_FORCE_NEW_DRAFTS === '1';
const HASHNODE_FORCE_UPDATE_PUBLISHED =
  process.env.HASHNODE_FORCE_UPDATE_PUBLISHED === '1';
const HASHNODE_SLUG_SUFFIX = (process.env.HASHNODE_SLUG_SUFFIX || '').trim();
const HASHNODE_ONLY_IDS = (process.env.HASHNODE_ONLY_IDS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const slugify = (text = '') =>
  String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 72) || 'entry';

const PLACEHOLDER_QUOTE_RE =
  /short quote marker|extract will be limited|source-attributed|citation breve|uniquement|kurzes zitat|nur kurzes|brief quote marker|citation courte/i;
const META_SENTENCE_RE =
  /user-?preferred|selected by ilya|explicitly selected|priority multilingual|adaptation queue|strategic proof point|for reputation context|multilingual scaling|digest entry|now in priority|file de diffusion|priorisierte|priorisierter/i;
const META_TITLE_FRAGMENT_RE =
  /\(([^)]*(user-?preferred|user-?highlighted|priority|strategic proof point|favorite essay)[^)]*)\)/gi;

function csvEscape(v = '') {
  return `"${String(v).replaceAll('"', '""')}"`;
}

function toCsv(items) {
  const head = [
    'id',
    'language',
    'title',
    'status',
    'draft_id',
    'draft_slug',
    'post_id',
    'post_slug',
    'post_url',
    'original_url',
    'updated_at',
    'error',
  ];
  const rows = items.map((x) =>
    [
      x.id || '',
      x.language || '',
      x.title || '',
      x.status || '',
      x.draft_id || '',
      x.draft_slug || '',
      x.post_id || '',
      x.post_slug || '',
      x.post_url || '',
      x.original_url || '',
      x.updated_at || '',
      x.error || '',
    ]
      .map(csvEscape)
      .join(',')
  );
  return [head.join(','), ...rows].join('\n') + '\n';
}

function normalizeSpaces(text = '') {
  return String(text).replace(/\s+/g, ' ').trim();
}

function splitSentences(text = '') {
  const compact = normalizeSpaces(text);
  if (!compact) return [];
  const parts = compact.match(/[^.!?]+[.!?]?/g);
  return parts ? parts.map((x) => x.trim()).filter(Boolean) : [compact];
}

function cleanTitle(title = '') {
  let next = String(title || '');
  next = next.replace(/^user-?preferred\s+/i, '');
  next = next.replace(META_TITLE_FRAGMENT_RE, '');
  next = normalizeSpaces(next.replace(/\s+[-|:]\s*$/, ''));
  return next || String(title || 'Untitled');
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

function buildMarkdown(item) {
  const summary = cleanSummary(item);
  const quote = cleanQuote(item);
  const hasQuote = Boolean(quote);
  const sourceLine = item.source
    ? `${item.source}${item.date ? ` (${item.date})` : ''}`
    : item.date || 'undated source';

  return [
    `# ${item.title}`,
    '',
    summary,
    '',
    '## Source',
    '',
    `- Outlet: ${sourceLine}`,
    `- Language: ${item.language}`,
    item.url ? `- Original URL: ${item.url}` : '- Original URL: unavailable',
    '',
    hasQuote ? '## Short Attributed Excerpt' : '',
    '',
    hasQuote ? `> ${quote}` : '',
    '',
    item.url ? `[Open original source](${item.url})` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function getDataPath() {
  try {
    await fs.access(PREPARED_DATA_PATH);
    return PREPARED_DATA_PATH;
  } catch {
    return FALLBACK_DATA_PATH;
  }
}

async function gql(query, variables = {}, attempt = 1) {
  const res = await fetch(HASHNODE_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(HASHNODE_TOKEN ? { Authorization: HASHNODE_TOKEN } : {}),
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  });

  const body = await res.json().catch(() => ({}));

  const topErrors = Array.isArray(body?.errors) ? body.errors : [];
  if (!res.ok || topErrors.length) {
    const msg =
      topErrors.map((e) => e?.message).filter(Boolean).join('; ') ||
      `http_${res.status}`;
    const retryable =
      res.status === 429 ||
      res.status >= 500 ||
      /timeout|rate|too many|temporarily|ECONNRESET/i.test(msg);
    if (retryable && attempt < 3) {
      await sleep(attempt * 1500);
      return gql(query, variables, attempt + 1);
    }
    throw new Error(msg);
  }

  return body.data;
}

async function loadPublication() {
  const query = `
    query Publication($host: String!) {
      publication(host: $host) {
        id
        title
        url
        isGithubAsSourceConnected
      }
    }
  `;
  const data = await gql(query, { host: HASHNODE_PUBLICATION_HOST });
  const publication = data?.publication;
  if (!publication?.id) {
    throw new Error(`Publication not found for host: ${HASHNODE_PUBLICATION_HOST}`);
  }
  if (HASHNODE_REQUIRE_GITHUB_SOURCE && !publication.isGithubAsSourceConnected) {
    throw new Error(
      `Publication ${publication.title} has isGithubAsSourceConnected=false. Connect GitHub as Source first or set HASHNODE_REQUIRE_GITHUB_SOURCE=0.`
    );
  }
  return publication;
}

async function createDraft(publicationId, item) {
  const mutation = `
    mutation CreateDraft($input: CreateDraftInput!) {
      createDraft(input: $input) {
        draft {
          id
          slug
          title
        }
      }
    }
  `;

  const baseSlug = `ik-${item.id}-${slugify(item.title)}`;
  const slug = `${baseSlug}${HASHNODE_SLUG_SUFFIX ? `-${slugify(HASHNODE_SLUG_SUFFIX)}` : ''}`.slice(
    0,
    120
  );
  const subtitle = `${item.source} | ${item.date} | ${item.language}`;
  const contentMarkdown = buildMarkdown(item);

  const data = await gql(mutation, {
    input: {
      publicationId,
      title: item.title,
      subtitle,
      slug,
      contentMarkdown,
      originalArticleURL: item.url || '',
    },
  });

  const draft = data?.createDraft?.draft;
  if (!draft?.id) throw new Error(`createDraft failed for ${item.id}`);
  return draft;
}

async function updatePost(postId, publicationId, item, postSlug = null) {
  const mutation = `
    mutation UpdatePost($input: UpdatePostInput!) {
      updatePost(input: $input) {
        post {
          id
          slug
          url
        }
      }
    }
  `;

  const subtitle = `${item.source} | ${item.date} | ${item.language}`;
  const contentMarkdown = buildMarkdown(item);
  const data = await gql(mutation, {
    input: {
      id: postId,
      publicationId,
      title: item.title,
      subtitle,
      contentMarkdown,
      originalArticleURL: item.url || '',
      ...(postSlug ? { slug: postSlug } : {}),
    },
  });
  const post = data?.updatePost?.post;
  if (!post?.id) throw new Error(`updatePost failed for ${item.id}`);
  return post;
}

async function publishDraft(draftId) {
  const mutation = `
    mutation PublishDraft($input: PublishDraftInput!) {
      publishDraft(input: $input) {
        post {
          id
          slug
          url
        }
      }
    }
  `;

  const data = await gql(mutation, { input: { draftId } });
  const post = data?.publishDraft?.post;
  if (!post?.id) throw new Error(`publishDraft failed for draft ${draftId}`);
  return post;
}

async function persist(items, sourceDataPath) {
  const state = {
    generated_at: new Date().toISOString(),
    source_data: sourceDataPath,
    count: items.length,
    items,
  };
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
  await fs.writeFile(CSV_PATH, toCsv(items), 'utf8');
  return state;
}

function assertEnv() {
  if (!HASHNODE_TOKEN) {
    throw new Error('HASHNODE_TOKEN is required');
  }
  if (!HASHNODE_PUBLICATION_HOST) {
    throw new Error('HASHNODE_PUBLICATION_HOST is required');
  }
}

async function main() {
  assertEnv();
  const sourceDataPath = await getDataPath();
  const payload = JSON.parse(await fs.readFile(sourceDataPath, 'utf8'));
  const allItems = Array.isArray(payload.items) ? payload.items : [];
  let items =
    HASHNODE_ONLY_IDS.length > 0
      ? allItems.filter((x) => HASHNODE_ONLY_IDS.includes(x.id))
      : allItems;
  items = HASHNODE_MAX_ITEMS > 0 ? items.slice(0, HASHNODE_MAX_ITEMS) : items;
  if (!items.length) throw new Error('No items to publish');

  const publication = await loadPublication();
  process.stdout.write(
    `publication: ${publication.title} (${publication.url}) github_source=${publication.isGithubAsSourceConnected}\n`
  );

  const existing = await readJson(REGISTRY_PATH, { items: [] });
  const byId = new Map((existing.items || []).map((x) => [x.id, x]));

  for (const item of items) {
    const normalizedItem = { ...item, title: cleanTitle(item.title) };
    const current = byId.get(item.id);
    if (
      current?.status === 'published' &&
      current?.post_url &&
      !HASHNODE_FORCE_UPDATE_PUBLISHED
    ) {
      process.stdout.write(`skip published ${item.id} -> ${current.post_url}\n`);
      continue;
    }

    let next = {
      ...(current || {}),
      id: item.id,
      language: item.language,
      title: normalizedItem.title,
      original_url: item.url || '',
      updated_at: new Date().toISOString(),
      error: '',
    };

    try {
      let draftId = current?.draft_id;
      let draftSlug = current?.draft_slug;
      if (HASHNODE_FORCE_NEW_DRAFTS) {
        draftId = '';
        draftSlug = '';
      }

      if (HASHNODE_FORCE_UPDATE_PUBLISHED && current?.post_id) {
        const updated = await updatePost(
          current.post_id,
          publication.id,
          normalizedItem,
          current.post_slug || null
        );
        next = {
          ...next,
          status: 'published',
          post_id: updated.id,
          post_slug: updated.slug,
          post_url: updated.url,
        };
        process.stdout.write(`updated ${item.id} -> ${updated.url}\n`);
      } else {
        if (!draftId) {
          const draft = await createDraft(publication.id, normalizedItem);
          draftId = draft.id;
          draftSlug = draft.slug;
          next = {
            ...next,
            draft_id: draftId,
            draft_slug: draftSlug,
            status: 'draft',
          };
          process.stdout.write(`draft ${item.id} -> ${draftId}\n`);
        }

        if (HASHNODE_AUTO_PUBLISH) {
          const post = await publishDraft(draftId);
          next = {
            ...next,
            status: 'published',
            post_id: post.id,
            post_slug: post.slug,
            post_url: post.url,
          };
          process.stdout.write(`published ${item.id} -> ${post.url}\n`);
        }
      }
    } catch (error) {
      next = {
        ...next,
        status: 'failed',
        error: String(error?.message || error),
      };
      process.stdout.write(`failed ${item.id} -> ${next.error}\n`);
    }

    byId.set(item.id, next);
    const ordered = allItems.map((x) => byId.get(x.id)).filter(Boolean);
    await persist(ordered, sourceDataPath);
    await sleep(HASHNODE_DELAY_MS);
  }

  const outputItems = allItems.map((x) => byId.get(x.id)).filter(Boolean);
  const published = outputItems.filter((x) => x.status === 'published').length;
  const drafts = outputItems.filter((x) => x.status === 'draft').length;
  const failed = outputItems.filter((x) => x.status === 'failed').length;
  await persist(outputItems, sourceDataPath);

  console.log(
    JSON.stringify(
      {
        source_data: sourceDataPath,
        total: outputItems.length,
        published,
        drafts,
        failed,
        registry_file: REGISTRY_PATH,
        csv_file: CSV_PATH,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
