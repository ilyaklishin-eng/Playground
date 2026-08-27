import path from "node:path";
import { fileURLToPath } from "node:url";

export const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SITE_DIR = path.resolve(TOOLS_DIR, "..");
export const REPUTATION_CASE_DIR = path.resolve(SITE_DIR, "..");
export const REPO_ROOT = path.resolve(REPUTATION_CASE_DIR, "..");
