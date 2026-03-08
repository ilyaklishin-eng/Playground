import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const SITE_DIR = path.join(ROOT, "reputation-case", "site");
const DATA_DIR = path.join(SITE_DIR, "data");

const SEARCHBOT_JSON_URL = process.env.OPENAI_SEARCHBOT_JSON_URL || "https://openai.com/searchbot.json";

const OUTPUT_JSON = path.join(DATA_DIR, "openai-searchbot-ip-allowlist.json");
const OUTPUT_TXT = path.join(DATA_DIR, "openai-searchbot-cidrs.txt");

const DEFAULT_LIST_NAME = "openai_searchbot_ips";

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
      "user-agent": "klishin-work-openai-allowlist-sync/1.0",
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
  await fs.writeFile(OUTPUT_TXT, artifact.cidrs.join("\n") + "\n", "utf8");
};

const getCloudflareEnv = () => ({
  token: process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "",
  accountId: process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "",
  listId: process.env.CF_OPENAI_SEARCHBOT_LIST_ID || "",
  listName: process.env.CF_OPENAI_SEARCHBOT_LIST_NAME || DEFAULT_LIST_NAME,
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

const syncCloudflareList = async (artifact) => {
  const env = getCloudflareEnv();
  if (!env.token || !env.accountId) {
    return { skipped: true, reason: "CF_API_TOKEN/CF_ACCOUNT_ID are not set." };
  }

  const list = await findOrCreateList({
    token: env.token,
    accountId: env.accountId,
    listId: env.listId,
    listName: env.listName,
    description: "Auto-synced from https://openai.com/searchbot.json",
  });

  await replaceListItems({
    token: env.token,
    accountId: env.accountId,
    listId: list.id,
    cidrs: artifact.cidrs,
  });

  return {
    skipped: false,
    account_id: env.accountId,
    list,
    waf_expression_example: `(http.user_agent contains "OAI-SearchBot" and ip.src in $${list.name})`,
  };
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  const payload = await readJson(SEARCHBOT_JSON_URL);
  const cidrs = extractCidrs(payload);

  const artifact = {
    generated_at: new Date().toISOString(),
    source: SEARCHBOT_JSON_URL,
    creationTime: payload?.creationTime || null,
    cidrs,
    count: cidrs.length,
  };

  if (opts.writeFiles) {
    await writeArtifacts(artifact);
  }

  const shouldSyncCloudflare = opts.syncCloudflare || Boolean(getCloudflareEnv().token && getCloudflareEnv().accountId);
  const cloudflare = shouldSyncCloudflare ? await syncCloudflareList(artifact) : { skipped: true, reason: "sync not requested" };

  const summary = {
    generated_at: artifact.generated_at,
    files_written: opts.writeFiles,
    count: cidrs.length,
    cloudflare,
    output_files: {
      json: path.relative(ROOT, OUTPUT_JSON),
      text: path.relative(ROOT, OUTPUT_TXT),
    },
  };

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
