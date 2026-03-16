const RAW_PUBLISHED_STATUS = "ready";
const NORMALIZED_PUBLISHED_STATUS = "published";
const NORMALIZED_DRAFT_STATUS = "draft";
const DEFAULT_BUILD_ENV = "production";
const DRAFT_TAG_RE = /\bdraft\b/i;

export const CONTENT_STATUS = Object.freeze({
  PUBLISHED: NORMALIZED_PUBLISHED_STATUS,
  DRAFT: NORMALIZED_DRAFT_STATUS,
});

export const CONTENT_SURFACE = Object.freeze({
  PUBLIC: "public",
  ARCHIVE: "archive",
  DATA: "data",
});

export const CONTENT_ROLE = Object.freeze({
  AUTHORED: "authored",
  QUOTED: "quoted",
  REFERENCE: "reference",
});

export const PAGE_CLASS = Object.freeze({
  INDEXABLE: "indexable",
  THIN: "thin",
  DRAFT: "draft",
  SERVICE: "service",
});

export const SUPPORTED_LOCALES = Object.freeze(["en", "fr", "de", "es"]);

const REFERENCE_TOPIC_RE =
  /\b(editorial standard|professional profile|profil professionnel|berufsprofil|profil auteur|source-based summary|public profile|public speaking(?: history)?|offentliche rede|oratoria publica|parcours de prise de parole|institutional citation|reference institutionnelle|institutionelle referenz|documented reporting|parcours professionnel documente|dokumentierter berufsverlauf)\b/i;
const REFERENCE_TITLE_RE =
  /\b(author page|autorenprofil|profil d auteur|mirror domain|canonical variant|ted talk video reference|speaker profile|how this archive is built|methodology)\b/i;
const DATA_SURFACE_RE = /\b(registry|dataset|sitemap|rss|feed|json|tsv|xml|machine-readable)\b/i;
const ARCHIVE_SECTION_RE = /\barchive\b/i;

const normalizeText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();
const lower = (value = "") => normalizeText(value).toLowerCase();
const normalizeArray = (value) => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeArray(entry));
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => normalizeText(entry))
      .filter(Boolean);
  }
  const single = normalizeText(value);
  return single ? [single] : [];
};

const normalizeBuildEnv = (value = "") => {
  const normalized = normalizeText(value).toLowerCase();
  return normalized || DEFAULT_BUILD_ENV;
};

const countWords = (text = "") =>
  normalizeText(text)
    .split(/\s+/)
    .filter(Boolean).length;

const normalizeExplicitSurface = (value = "") => {
  const raw = lower(value);
  if (raw === CONTENT_SURFACE.PUBLIC || raw === CONTENT_SURFACE.ARCHIVE || raw === CONTENT_SURFACE.DATA) {
    return raw;
  }
  return "";
};

const normalizeExplicitRole = (value = "") => {
  const raw = lower(value);
  if (raw === "authored" || raw === "author") return CONTENT_ROLE.AUTHORED;
  if (raw === "quoted" || raw === "expert_quote" || raw === "expert comment" || raw === "expert-comment") {
    return CONTENT_ROLE.QUOTED;
  }
  if (raw === "reference" || raw === "mention") return CONTENT_ROLE.REFERENCE;
  return "";
};

const isPublishedValue = (value = "") => {
  const raw = lower(value);
  return raw === RAW_PUBLISHED_STATUS || raw === NORMALIZED_PUBLISHED_STATUS;
};

const buildStaticRecord = (locale, surface, pageClass, role = CONTENT_ROLE.REFERENCE, status = CONTENT_STATUS.PUBLISHED) =>
  Object.freeze({
    status,
    surface,
    locale,
    role,
    pageClass,
  });

export const STATIC_PAGE_VISIBILITY = new Map([
  ["index.html", buildStaticRecord("en", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["fr/index.html", buildStaticRecord("fr", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["de/index.html", buildStaticRecord("de", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["es/index.html", buildStaticRecord("es", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["bio/index.html", buildStaticRecord("en", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["bio/fr/index.html", buildStaticRecord("fr", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["bio/de/index.html", buildStaticRecord("de", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["bio/es/index.html", buildStaticRecord("es", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["cases/index.html", buildStaticRecord("en", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["cases/fr/index.html", buildStaticRecord("fr", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["cases/de/index.html", buildStaticRecord("de", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["cases/es/index.html", buildStaticRecord("es", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["selected/index.html", buildStaticRecord("en", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["interviews/index.html", buildStaticRecord("en", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["interviews/fr/index.html", buildStaticRecord("fr", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["interviews/de/index.html", buildStaticRecord("de", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["interviews/es/index.html", buildStaticRecord("es", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.INDEXABLE)],
  ["contact/index.html", buildStaticRecord("en", CONTENT_SURFACE.PUBLIC, PAGE_CLASS.SERVICE)],
  ["search/index.html", buildStaticRecord("en", CONTENT_SURFACE.ARCHIVE, PAGE_CLASS.SERVICE)],
  ["about/index.html", buildStaticRecord("en", CONTENT_SURFACE.DATA, PAGE_CLASS.SERVICE)],
  ["archive/index.html", buildStaticRecord("en", CONTENT_SURFACE.ARCHIVE, PAGE_CLASS.SERVICE)],
  ["insights/index.html", buildStaticRecord("en", CONTENT_SURFACE.ARCHIVE, PAGE_CLASS.SERVICE)],
  ["insights/fr/index.html", buildStaticRecord("fr", CONTENT_SURFACE.ARCHIVE, PAGE_CLASS.SERVICE)],
  ["insights/de/index.html", buildStaticRecord("de", CONTENT_SURFACE.ARCHIVE, PAGE_CLASS.SERVICE)],
  ["insights/es/index.html", buildStaticRecord("es", CONTENT_SURFACE.ARCHIVE, PAGE_CLASS.SERVICE)],
  ["posts/index.html", buildStaticRecord("en", CONTENT_SURFACE.ARCHIVE, PAGE_CLASS.SERVICE)],
  ["posts/all.html", buildStaticRecord("en", CONTENT_SURFACE.ARCHIVE, PAGE_CLASS.SERVICE)],
  ["posts/drafts.html", buildStaticRecord("en", CONTENT_SURFACE.ARCHIVE, PAGE_CLASS.DRAFT, CONTENT_ROLE.REFERENCE, CONTENT_STATUS.DRAFT)],
]);

export const STATIC_PAGE_CLASSES = new Map(
  [...STATIC_PAGE_VISIBILITY.entries()].map(([relativePath, record]) => [relativePath, record.pageClass])
);

export const INDEXABLE_STATIC_SECTIONS = [...STATIC_PAGE_VISIBILITY.entries()]
  .filter(([, record]) => record.pageClass === PAGE_CLASS.INDEXABLE)
  .filter(([, record]) => record.status === CONTENT_STATUS.PUBLISHED && record.surface === CONTENT_SURFACE.PUBLIC)
  .map(([relativePath]) => relativePath)
  .filter((relativePath) => relativePath !== "index.html");

export const normalizeLocale = (value = "", fallback = "en") => {
  const raw = lower(value).slice(0, 2);
  if (SUPPORTED_LOCALES.includes(raw)) return raw;
  return SUPPORTED_LOCALES.includes(lower(fallback).slice(0, 2)) ? lower(fallback).slice(0, 2) : "en";
};

export const normalizeAllowedFallbackLocales = (item = {}, fallback = []) => {
  const explicit = normalizeArray(
    item?.allowed_fallback_locales ||
      item?.allowedFallbackLocales ||
      item?.fallback_locales ||
      fallback
  )
    .map((value) => normalizeLocale(value, ""))
    .filter((value) => SUPPORTED_LOCALES.includes(value));
  return [...new Set(explicit)];
};

export const currentBuildEnv = () => normalizeBuildEnv(process.env.BUILD_ENV || process.env.NODE_ENV || DEFAULT_BUILD_ENV);
export const isProductionBuild = () => currentBuildEnv() !== "development";

export const hasDraftTag = (item = {}) =>
  normalizeArray(item?.tags || item?.tag || item?.frontmatter?.tags || []).some((tag) => DRAFT_TAG_RE.test(tag));

export const isReferenceCard = (item = {}) => {
  const explicit = lower(item?.content_class || "");
  if (explicit === "reference") return true;
  if (explicit === "writing") return false;

  const topic = normalizeText(item?.topic || "");
  const title = normalizeText(item?.title || "");
  if (!title && !topic) return false;
  if (REFERENCE_TOPIC_RE.test(topic)) return true;
  if (REFERENCE_TITLE_RE.test(title)) return true;
  return false;
};

export const isDataLikeItem = (item = {}) => {
  const explicitSurface = normalizeExplicitSurface(item?.surface);
  if (explicitSurface === CONTENT_SURFACE.DATA) return true;
  const explicitClass = lower(item?.content_class || "");
  if (explicitClass === CONTENT_SURFACE.DATA) return true;
  const blob = [item?.title, item?.topic, item?.source, item?.material_type, item?.section]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" ");
  return DATA_SURFACE_RE.test(blob);
};

export const isArchiveLikeItem = (item = {}) => {
  const explicitSurface = normalizeExplicitSurface(item?.surface);
  if (explicitSurface === CONTENT_SURFACE.ARCHIVE) return true;
  const section = lower(item?.section || "");
  if (ARCHIVE_SECTION_RE.test(section)) return true;
  return isReferenceCard(item);
};

export const normalizeStatusValue = (value = "", item = {}) => {
  if (item?.draft === true || hasDraftTag(item)) return CONTENT_STATUS.DRAFT;
  return isPublishedValue(value) ? CONTENT_STATUS.PUBLISHED : CONTENT_STATUS.DRAFT;
};

export const normalizeRoleValue = (value = "", item = {}) => {
  const explicit = normalizeExplicitRole(value);
  if (explicit) return explicit;
  const section = lower(item?.section || "");
  if (section === "interviews" || section === "features") return CONTENT_ROLE.QUOTED;
  if (isDataLikeItem(item) || isArchiveLikeItem(item)) return CONTENT_ROLE.REFERENCE;
  return CONTENT_ROLE.AUTHORED;
};

export const normalizeSurfaceValue = (value = "", item = {}) => {
  const explicit = normalizeExplicitSurface(value);
  if (explicit) return explicit;
  if (isDataLikeItem(item)) return CONTENT_SURFACE.DATA;
  if (isArchiveLikeItem(item)) return CONTENT_SURFACE.ARCHIVE;
  return CONTENT_SURFACE.PUBLIC;
};

export const normalizeContentItem = (item = {}, options = {}) => {
  const normalized = { ...item };
  normalized.status = normalizeStatusValue(item?.status, item);
  normalized.surface = normalizeSurfaceValue(item?.surface, item);
  normalized.locale = normalizeLocale(options.locale || item?.locale || item?.language || options.fallbackLocale || "en");
  normalized.role = normalizeRoleValue(item?.role, item);
  normalized.allowed_fallback_locales = normalizeAllowedFallbackLocales(item, options.allowedFallbackLocales || []);
  return normalized;
};

export const isPublishedStatus = (value = "") => isPublishedValue(value);
export const isPublishedItem = (item = {}) => normalizeContentItem(item).status === CONTENT_STATUS.PUBLISHED;
export const isDraftLikeItem = (item = {}) => normalizeContentItem(item).status === CONTENT_STATUS.DRAFT;
export const isPublicRenderableItem = (item = {}) => {
  const normalized = normalizeContentItem(item);
  return normalized.status === CONTENT_STATUS.PUBLISHED && normalized.surface === CONTENT_SURFACE.PUBLIC;
};

export const isRenderableOnLocale = (item = {}, locale = "en") => {
  const normalized = normalizeContentItem(item);
  const targetLocale = normalizeLocale(locale, "en");
  if (!isPublicRenderableItem(normalized)) return false;
  if (normalized.locale === targetLocale) return true;
  return normalized.allowed_fallback_locales.includes(targetLocale);
};

export const shouldCompileItem = (item = {}, options = {}) => {
  const production = options.production ?? isProductionBuild();
  return production ? !isDraftLikeItem(item) : true;
};

export const isShowcaseCandidate = (item = {}) => {
  const title = normalizeText(item?.title || "");
  const source = lower(item?.source || "");
  const topic = lower(item?.topic || "");
  if (!title) return false;
  if (isReferenceCard(item)) return false;
  if (/\(\d{4}-\d{2}-\d{2}\)\s*$/i.test(title)) return false;
  if (source === "methodology") return false;
  if (topic.includes("editorial standard")) return false;
  return true;
};

export const isQaReviewedPost = (item = {}) => {
  const summary = normalizeText(item?.digest || item?.summary || "");
  const words = countWords(summary);
  if (!summary) return false;
  if (words < 18 || words > 220) return false;
  return true;
};

export const classifyPostPage = (item = {}) => {
  const normalized = normalizeContentItem(item);
  if (normalized.status === CONTENT_STATUS.DRAFT) return PAGE_CLASS.DRAFT;
  if (normalized.surface !== CONTENT_SURFACE.PUBLIC) return PAGE_CLASS.THIN;
  if (!isShowcaseCandidate(normalized) || !isQaReviewedPost(normalized)) return PAGE_CLASS.THIN;
  return PAGE_CLASS.INDEXABLE;
};

export const isIndexablePost = (item = {}) => classifyPostPage(item) === PAGE_CLASS.INDEXABLE;

export const staticPageVisibility = (relativePath = "") =>
  STATIC_PAGE_VISIBILITY.get(String(relativePath || "").trim()) || null;

export const staticPageClass = (relativePath = "") => staticPageVisibility(relativePath)?.pageClass || null;

export const robotsMetaForPageClass = (pageClass = PAGE_CLASS.SERVICE) =>
  pageClass === PAGE_CLASS.INDEXABLE
    ? "index,follow,max-image-preview:large"
    : pageClass === PAGE_CLASS.DRAFT
      ? "noindex,nofollow,noarchive"
      : "noindex,follow,max-image-preview:large";
