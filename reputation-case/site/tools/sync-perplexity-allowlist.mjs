import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const SITE_DIR = path.join(ROOT, "reputation-case", "site");
const DATA_DIR = path.join(SITE_DIR, "data");

const PERPLEXITYBOT_JSON_URL =
  process.env.PERPLEXITYBOT_JSON_URL || "https://www.perplexity.ai/perplexitybot.json";
const PERPLEXITY_USER_JSON_URL =
  process.env.PERPLEXITY_USER_JSON_URL || "https://www.perplexity.ai/perplexity-user.json";

const OUTPUT_JSON = path.join(DATA_DIR, "perplexity-ip-allowlist.json");
const OUTPUT_BOT_TXT = path.join(DATA_DIR, "perplexitybot-cidrs.txt");
const OUTPUT_USER_TXT = path.join(DATA_DIR, "perplexity-user-cidrs.txt");
const OUTPUT_COMBINED_TXT = path.join(DATA_DIR, "perplexity-cidrs-combined.txt");

const DEFAULT_BOT_LIST_NAME = "perplexitybot_ips";
const DEFAULT_USER_LIST_NAME = "perplexity_user_ips";

const parseArgs = (argv) => {
  const opts = {
    writeFiles: true,
    syncCloudflare: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-write-files") opts.writeFiles = false;
    else if (arg === "--write-files") opts.writeFiles = true;
    else if (arg === "--sync-cloudflare") opts.syncCloudflare = true;
  }

  return opts;
};

const uniqueSorted = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const readJson = async (url) => {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": "klishin-work-allowlist-sync/1.0",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== "object") {
    throw new Error(`Invalid JSON payload from ${url}`);
  }
  return payload;
};

const extractCidrs = (payload) => {
  const prefixes = Array.isArray(payload?.prefixes) ? payload.prefixes : [];
  const cidrs = [];

  for (const entry of prefixes) {
    if (!entry || typeof entry !== "object") continue;
    const ipv4 = String(entry.ipv4Prefix || "").trim();
    const ipv6 = String(entry.ipv6Prefix || "").trim();
    if (ipv4) cidrs.push(ipv4);
    if (ipv6) cidrs.push(ipv6);
  }

  return uniqueSorted(cidrs);
};

const writeArtifacts = async (artifact) => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_JSON, JSON.stringify(artifact, null, 2) + "\n", "utf8");
  await fs.writeFile(OUTPUT_BOT_TXT, artifact.perplexitybot.cidrs.join("\n") + "\n", "utf8");
  await fs.writeFile(OUTPUT_USER_TXT, artifact.perplexityUser.cidrs.join("\n") + "\n", "utf8");
  await fs.writeFile(OUTPUT_COMBINED_TXT, artifact.combined.cidrs.join("\n") + "\n", "utf8");
};

const getCloudflareEnv = () => ({
  token: process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "",
  accountId: process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "",
  botListId: process.env.CF_PERPLEXITYBOT_LIST_ID || "",
  userListId: process.env.CF_PERPLEXITYUSER_LIST_ID || "",
  botListName: process.env.CF_PERPLEXITYBOT_LIST_NAME || DEFAULT_BOT_LIST_NAME,
  userListName: process.env.CF_PERPLEXITYUSER_LIST_NAME || DEFAULT_USER_LIST_NAME,
});

const cfApi = async (token, endpoint, { method = "GET", body } = {}) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Cloudflare API ${method} ${endpoint} returned non-JSON response: ${raw.slice(0, 200)}`);
  }

  if (!response.ok || payload?.success === false) {
    const message = payload?.errors?.map((x) => x.message).join("; ") || `HTTP ${response.status}`;
    throw new Error(`Cloudflare API ${method} ${endpoint} failed: ${message}`);
  }

  return payload;
};

const findOrCreateList = async ({ token, accountId, listId, listName, description }) => {
  if (listId) {
    const details = await cfApi(token, `/accounts/${accountId}/rules/lists/${listId}`);
    const found = details?.result;
    if (!found || found.kind !== "ip") {
      throw new Error(`Cloudflare list ${listId} is missing or not an IP list.`);
    }
    return { id: found.id, name: found.name };
  }

  let page = 1;
  const perPage = 100;
  while (true) {
    const listed = await cfApi(token, `/accounts/${accountId}/rules/lists?page=${page}&per_page=${perPage}`);
    const items = Array.isArray(listed?.result) ? listed.result : [];
    const existing = items.find((x) => x?.kind === "ip" && x?.name === listName);
    if (existing?.id) {
      return { id: existing.id, name: existing.name };
    }
    const pages = Number(listed?.result_info?.total_pages || 1);
    if (page >= pages) break;
    page += 1;
  }

  const created = await cfApi(token, `/accounts/${accountId}/rules/lists`, {
    method: "POST",
    body: {
      kind: "ip",
      name: listName,
      description,
    },
  });

  const result = created?.result;
  if (!result?.id) {
    throw new Error(`Cloudflare list creation returned no list ID for ${listName}.`);
  }
  return { id: result.id, name: result.name };
};

const waitForBulkOperation = async ({ token, accountId, operationId }) => {
  const timeoutMs = 90_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const status = await cfApi(token, `/accounts/${accountId}/rules/lists/bulk_operations/${operationId}`);
    const value = String(status?.result?.status || "").toLowerCase();
    if (value === "completed") return;
    if (value === "failed") {
      const err = status?.result?.error || "unknown failure";
      throw new Error(`Cloudflare bulk operation ${operationId} failed: ${err}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Timed out waiting for Cloudflare bulk operation ${operationId}.`);
};

const replaceListItems = async ({ token, accountId, listId, cidrs }) => {
  const body = cidrs.map((cidr) => ({ ip: cidr }));

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await cfApi(token, `/accounts/${accountId}/rules/lists/${listId}/items`, {
        method: "PUT",
        body,
      });
      const operationId = response?.result?.operation_id;
      if (!operationId) {
        throw new Error(`Cloudflare returned no operation_id while updating list ${listId}.`);
      }
      await waitForBulkOperation({ token, accountId, operationId });
      return;
    } catch (error) {
      const message = String(error?.message || "");
      const retryable = /pending bulk operation|outstanding bulk operation/i.test(message);
      if (!retryable || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  }
};

const syncCloudflareLists = async (artifact) => {
  const env = getCloudflareEnv();
  if (!env.token || !env.accountId) {
    return { skipped: true, reason: "CF_API_TOKEN/CF_ACCOUNT_ID are not set." };
  }

  const botList = await findOrCreateList({
    token: env.token,
    accountId: env.accountId,
    listId: env.botListId,
    listName: env.botListName,
    description: "Auto-synced from https://www.perplexity.ai/perplexitybot.json",
  });

  const userList = await findOrCreateList({
    token: env.token,
    accountId: env.accountId,
    listId: env.userListId,
    listName: env.userListName,
    description: "Auto-synced from https://www.perplexity.ai/perplexity-user.json",
  });

  await replaceListItems({
    token: env.token,
    accountId: env.accountId,
    listId: botList.id,
    cidrs: artifact.perplexitybot.cidrs,
  });

  await replaceListItems({
    token: env.token,
    accountId: env.accountId,
    listId: userList.id,
    cidrs: artifact.perplexityUser.cidrs,
  });

  const expression = `(http.user_agent contains "PerplexityBot" and ip.src in $${botList.name}) or (http.user_agent contains "Perplexity-User" and ip.src in $${userList.name})`;

  return {
    skipped: false,
    account_id: env.accountId,
    bot_list: botList,
    user_list: userList,
    waf_expression_example: expression,
  };
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));

  const [botPayload, userPayload] = await Promise.all([readJson(PERPLEXITYBOT_JSON_URL), readJson(PERPLEXITY_USER_JSON_URL)]);
  const botCidrs = extractCidrs(botPayload);
  const userCidrs = extractCidrs(userPayload);
  const combinedCidrs = uniqueSorted([...botCidrs, ...userCidrs]);

  const artifact = {
    generated_at: new Date().toISOString(),
    sources: {
      perplexitybot: PERPLEXITYBOT_JSON_URL,
      perplexityUser: PERPLEXITY_USER_JSON_URL,
    },
    perplexitybot: {
      creationTime: botPayload?.creationTime || null,
      cidrs: botCidrs,
      count: botCidrs.length,
    },
    perplexityUser: {
      creationTime: userPayload?.creationTime || null,
      cidrs: userCidrs,
      count: userCidrs.length,
    },
    combined: {
      cidrs: combinedCidrs,
      count: combinedCidrs.length,
    },
  };

  if (opts.writeFiles) {
    await writeArtifacts(artifact);
  }

  const shouldSyncCloudflare = opts.syncCloudflare || Boolean(getCloudflareEnv().token && getCloudflareEnv().accountId);
  const cloudflare = shouldSyncCloudflare ? await syncCloudflareLists(artifact) : { skipped: true, reason: "sync not requested" };

  const summary = {
    generated_at: artifact.generated_at,
    files_written: opts.writeFiles,
    counts: {
      perplexitybot: botCidrs.length,
      perplexity_user: userCidrs.length,
      combined: combinedCidrs.length,
    },
    cloudflare,
    output_files: {
      json: path.relative(ROOT, OUTPUT_JSON),
      bot: path.relative(ROOT, OUTPUT_BOT_TXT),
      user: path.relative(ROOT, OUTPUT_USER_TXT),
      combined: path.relative(ROOT, OUTPUT_COMBINED_TXT),
    },
  };

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
