import fs from "node:fs/promises";

const withoutGeneratedAt = (value = {}) => {
  const next = { ...value };
  delete next.generated_at;
  return next;
};

export const preserveGeneratedAtWhenUnchanged = async (filePath, artifact) => {
  let existing;
  try {
    existing = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return false;
    throw error;
  }

  if (JSON.stringify(withoutGeneratedAt(existing)) !== JSON.stringify(withoutGeneratedAt(artifact))) {
    return false;
  }

  if (existing?.generated_at) artifact.generated_at = existing.generated_at;
  return true;
};
