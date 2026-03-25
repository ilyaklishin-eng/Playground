import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import interviewsData from "../data/interviews-data.js";
import { localizeInterviewItem } from "../interviews/interviews-localize.js";
import {
  CONTENT_ROLE,
  CONTENT_STATUS,
  CONTENT_SURFACE,
  INDEXABLE_STATIC_SECTIONS,
  PAGE_CLASS,
  STATIC_PAGE_CLASSES,
  classifyPostPage,
  currentBuildEnv,
  isPublicRenderableItem,
  isIndexablePost,
  isDraftLikeItem,
  isProductionBuild,
  isPublishedStatus,
  isRenderableOnLocale,
  normalizeContentItem,
  normalizeLocale,
  isReferenceCard,
  isShowcaseCandidate,
  robotsMetaForPageClass,
  shouldCompileItem,
} from "./page-index-policy.mjs";
import { replaceTrustBlock } from "./render-trust-block.mjs";
import {
  ARCHIVE_LAYOUT_CSS,
  LAYOUT_FAMILY,
  renderArchiveFooter,
  renderArchiveHeader,
  renderReaderFooter,
  renderReaderHeader,
  resolveStaticLayout,
} from "./site-layout-config.mjs";

const execFile = promisify(execFileCallback);

const siteDir = path.resolve(process.cwd(), "reputation-case", "site");
const dataPath = path.join(siteDir, "data", "digests.json");
const publicDigestsPath = path.join(siteDir, "data", "public-digests.json");
const publicInterviewsPath = path.join(siteDir, "data", "public-interviews.json");
const searchIndexManifestPath = path.join(siteDir, "data", "search-index.json");
const searchIndexLocalePath = (locale = "en") => path.join(siteDir, "data", `search-index-${locale}.json`);
const selectedPagePath = path.join(siteDir, "selected", "index.html");
const interviewsDir = path.join(siteDir, "interviews");
const postsDir = path.join(siteDir, "posts");
const homeIndexPath = path.join(siteDir, "index.html");
const homeFrIndexPath = path.join(siteDir, "fr", "index.html");
const homeDeIndexPath = path.join(siteDir, "de", "index.html");
const homeEsIndexPath = path.join(siteDir, "es", "index.html");
const bioIndexPath = path.join(siteDir, "bio", "index.html");
const contactIndexPath = path.join(siteDir, "contact", "index.html");
const sourceUrlHealthPath = path.join(siteDir, "data", "source-url-health.json");
const baseUrl = "https://www.klishin.work";
const FINGERPRINT_HEX_LENGTH = 10;
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";
const OG_IMAGE_WIDTH = "1200";
const OG_IMAGE_HEIGHT = "630";
const OG_IMAGE_TYPE = "image/jpeg";
const FIXED_IMAGE_PUBLIC_DIR = "/assets/images";
const FIXED_IMAGE_ASSETS = [
  {
    key: "portrait",
    source: "bio/ilia-klishin-portrait.jpeg",
    target: "assets/images/portrait.jpeg",
    aliases: ["/bio/ilia-klishin-portrait.jpeg", "./ilia-klishin-portrait.jpeg", "../ilia-klishin-portrait.jpeg"],
  },
  {
    key: "portraitPlaceholder",
    source: "bio/portrait-placeholder.svg",
    target: "assets/images/portrait-placeholder.svg",
    aliases: ["/bio/portrait-placeholder.svg", "./portrait-placeholder.svg", "../portrait-placeholder.svg"],
  },
  {
    key: "ogDefault",
    source: "og/site-default.jpg",
    target: "assets/images/og-site-default.jpg",
    aliases: ["/og/site-default.jpg"],
  },
  {
    key: "ogBio",
    source: "og/bio.jpg",
    target: "assets/images/og-bio.jpg",
    aliases: ["/og/bio.jpg"],
  },
  {
    key: "ogSelected",
    source: "og/selected-work.jpg",
    target: "assets/images/og-selected-work.jpg",
    aliases: ["/og/selected-work.jpg"],
  },
  {
    key: "ogPosts",
    source: "og/posts-fallback.jpg",
    target: "assets/images/og-posts-fallback.jpg",
    aliases: ["/og/posts-fallback.jpg"],
  },
  {
    key: "ogCases",
    source: "og/cases-fallback.jpg",
    target: "assets/images/og-cases-fallback.jpg",
    aliases: ["/og/cases-fallback.jpg"],
  },
];
const FIXED_IMAGE_PATHS = Object.freeze({
  portrait: `${FIXED_IMAGE_PUBLIC_DIR}/portrait.jpeg`,
  portraitPlaceholder: `${FIXED_IMAGE_PUBLIC_DIR}/portrait-placeholder.svg`,
  ogDefault: `${FIXED_IMAGE_PUBLIC_DIR}/og-site-default.jpg`,
  ogBio: `${FIXED_IMAGE_PUBLIC_DIR}/og-bio.jpg`,
  ogSelected: `${FIXED_IMAGE_PUBLIC_DIR}/og-selected-work.jpg`,
  ogPosts: `${FIXED_IMAGE_PUBLIC_DIR}/og-posts-fallback.jpg`,
  ogCases: `${FIXED_IMAGE_PUBLIC_DIR}/og-cases-fallback.jpg`,
});
let FIXED_IMAGE_VERSION = "1";
const fixedImageAbsoluteUrl = (publicPath = "") => `${baseUrl}${String(publicPath || "").trim()}`;
const SOCIAL_OG_IMAGE_BY_TYPE = {
  default: fixedImageAbsoluteUrl(FIXED_IMAGE_PATHS.ogDefault),
  bio: fixedImageAbsoluteUrl(FIXED_IMAGE_PATHS.ogBio),
  selected: fixedImageAbsoluteUrl(FIXED_IMAGE_PATHS.ogSelected),
  posts: fixedImageAbsoluteUrl(FIXED_IMAGE_PATHS.ogPosts),
  cases: fixedImageAbsoluteUrl(FIXED_IMAGE_PATHS.ogCases),
};
const FINGERPRINTABLE_ASSETS = [
  { source: "styles.css", aliases: ["/styles.css", "./styles.css"] },
  // app.js is the canonical home-feed source; the build fingerprints it into /app.<hash>.js and rewrites HTML references.
  { source: "app.js", aliases: ["/app.js", "./app.js"] },
  { source: "bio/bio.css", aliases: ["/bio/bio.css", "./bio.css", "../bio.css"] },
  { source: "cases/cases.css", aliases: ["/cases/cases.css", "./cases.css", "../cases.css"] },
  { source: "contact/contact.css", aliases: ["/contact/contact.css", "./contact.css", "../contact.css"] },
  { source: "contact/contact.js", aliases: ["/contact/contact.js", "./contact.js", "../contact.js"] },
  { source: "search/search.js", aliases: ["/search/search.js", "./search.js", "../search.js"] },
  {
    source: "interviews/interviews.js",
    aliases: ["/interviews/interviews.js", "./interviews.js", "../interviews.js"],
  },
  {
    source: "interviews/interviews-preview.js",
    aliases: ["/interviews/interviews-preview.js", "./interviews-preview.js", "../interviews-preview.js"],
  },
];
const HOME_FALLBACK_LIMIT = 8;
const HOME_FALLBACK_MAX_PER_SOURCE = 1;
const HOME_WORK_SECTION_START = "<!-- HOME_WORK_SECTION_START -->";
const HOME_WORK_SECTION_END = "<!-- HOME_WORK_SECTION_END -->";
const HOME_INTERVIEWS_SECTION_START = "<!-- HOME_INTERVIEWS_SECTION_START -->";
const HOME_INTERVIEWS_SECTION_END = "<!-- HOME_INTERVIEWS_SECTION_END -->";
const SELECTED_ALL_GRID_START = "<!-- SELECTED_ALL_GRID_START -->";
const SELECTED_ALL_GRID_END = "<!-- SELECTED_ALL_GRID_END -->";
const PERSON_NAME = "Ilia Klishin";
const SITE_NAME = "Ilia Klishin";
const DIGEST_NAME = "Ilia Klishin Digest";
const DEFAULT_SOCIAL_IMAGE = fixedImageAbsoluteUrl(FIXED_IMAGE_PATHS.portrait);
const SOCIAL_IMAGE_WIDTH = "636";
const SOCIAL_IMAGE_HEIGHT = "888";
const DEFAULT_TWITTER_CARD = "summary_large_image";
const DEFAULT_TWITTER_CREATOR = "@vorewig";
const PERSON_ID = `${baseUrl}/#person`;
const BUILD_ENV = currentBuildEnv();
const PRODUCTION_BUILD = isProductionBuild();
const INCLUDE_DRAFT_OUTPUTS = !PRODUCTION_BUILD;
const WEBSITE_ID = `${baseUrl}/#website`;
const ORGANIZATION_ID = `${baseUrl}/#organization`;
const pageFragmentForType = (pageType = "WebPage") =>
  (
    {
      WebPage: "webpage",
      ContactPage: "contactpage",
      ProfilePage: "profilepage",
      CollectionPage: "collectionpage",
    }[String(pageType || "").trim()] || "webpage"
  );
const buildPageNodeId = (canonical = "", pageType = "WebPage") => `${canonical}#${pageFragmentForType(pageType)}`;
const PERSON_ALT_NAMES = ["Ilya Klishin", "Ilia S. Klishin", "Илья Клишин"];
const PERSON_SAME_AS = [
  "https://www.linkedin.com/in/ilia-klishin-20282a1b/",
  "https://x.com/Vorewig",
  "https://www.instagram.com/vorewig",
  "https://www.facebook.com/ilya.klishin",
  "https://t.me/vorewig",
  "https://ru.wikipedia.org/wiki/%D0%9A%D0%BB%D0%B8%D1%88%D0%B8%D0%BD,_%D0%98%D0%BB%D1%8C%D1%8F_%D0%A1%D0%B5%D1%80%D0%B3%D0%B5%D0%B5%D0%B2%D0%B8%D1%87",
  "https://www.ted.com/tedx/events/3947",
  "https://www.themoscowtimes.com/author/ilya-klishin",
  "https://www.vedomosti.ru/authors/ilya-klishin",
  "https://theins.ru/en/opinion/ilya-klishin",
  "https://snob.ru/profile/28206/about/",
  "https://rtvi.com/editors-archive/ilya-klishin/",
  "https://kf.agency/articles/biography",
];
const WEBSITE_HAS_PART = [
  buildPageNodeId(`${baseUrl}/`, "WebPage"),
  buildPageNodeId(`${baseUrl}/bio/`, "ProfilePage"),
  buildPageNodeId(`${baseUrl}/cases/`, "ProfilePage"),
  buildPageNodeId(`${baseUrl}/contact/`, "ContactPage"),
  buildPageNodeId(`${baseUrl}/interviews/`, "CollectionPage"),
  buildPageNodeId(`${baseUrl}/selected/`, "CollectionPage"),
  buildPageNodeId(`${baseUrl}/search/`, "WebPage"),
  buildPageNodeId(`${baseUrl}/insights/`, "CollectionPage"),
  buildPageNodeId(`${baseUrl}/archive/`, "CollectionPage"),
  buildPageNodeId(`${baseUrl}/posts/`, "CollectionPage"),
];
const STATIC_ENTITY_SECTIONS = [
  "index.html",
  "fr/index.html",
  "de/index.html",
  "es/index.html",
  "bio/index.html",
  "bio/fr/index.html",
  "bio/de/index.html",
  "bio/es/index.html",
  "cases/index.html",
  "cases/fr/index.html",
  "cases/de/index.html",
  "cases/es/index.html",
  "selected/index.html",
  "interviews/index.html",
  "interviews/fr/index.html",
  "interviews/de/index.html",
  "interviews/es/index.html",
  "archive/index.html",
  "insights/index.html",
  "insights/fr/index.html",
  "insights/de/index.html",
  "insights/es/index.html",
  "contact/index.html",
  "about/index.html",
  "search/index.html",
];
const STATIC_SOCIAL_IMAGE_POLICY = new Map([
  ["index.html", "default"],
  ["fr/index.html", "default"],
  ["de/index.html", "default"],
  ["es/index.html", "default"],
  ["about/index.html", "default"],
  ["archive/index.html", "default"],
  ["contact/index.html", "default"],
  ["search/index.html", "default"],
  ["insights/index.html", "default"],
  ["insights/fr/index.html", "default"],
  ["insights/de/index.html", "default"],
  ["insights/es/index.html", "default"],
  ["interviews/index.html", "default"],
  ["interviews/fr/index.html", "default"],
  ["interviews/de/index.html", "default"],
  ["interviews/es/index.html", "default"],
  ["posts/index.html", "default"],
  ["posts/drafts.html", "default"],
  ["selected/index.html", "selected"],
  ["bio/index.html", "bio"],
  ["bio/fr/index.html", "bio"],
  ["bio/de/index.html", "bio"],
  ["bio/es/index.html", "bio"],
  ["cases/index.html", "cases"],
  ["cases/fr/index.html", "cases"],
  ["cases/de/index.html", "cases"],
  ["cases/es/index.html", "cases"],
]);
const LANGS = ["EN", "FR", "DE", "ES"];
const LANGUAGE_PRIORITY = ["EN", "FR", "DE", "ES"];
const HREFLANG_ORDER = ["en", "fr", "de", "es"];
const X_DEFAULT = "x-default";
const STATIC_HREFLANG_CLUSTERS = [
  {
    name: "home",
    pages: {
      en: "index.html",
      fr: "fr/index.html",
      de: "de/index.html",
      es: "es/index.html",
    },
    xDefault: "index.html",
  },
  {
    name: "bio",
    pages: {
      en: "bio/index.html",
      fr: "bio/fr/index.html",
      de: "bio/de/index.html",
      es: "bio/es/index.html",
    },
    xDefault: "bio/index.html",
  },
  {
    name: "cases",
    pages: {
      en: "cases/index.html",
      fr: "cases/fr/index.html",
      de: "cases/de/index.html",
      es: "cases/es/index.html",
    },
    xDefault: "cases/index.html",
  },
  {
    name: "insights",
    pages: {
      en: "insights/index.html",
      fr: "insights/fr/index.html",
      de: "insights/de/index.html",
      es: "insights/es/index.html",
    },
    xDefault: "insights/index.html",
  },
  {
    name: "interviews",
    pages: {
      en: "interviews/index.html",
      fr: "interviews/fr/index.html",
      de: "interviews/de/index.html",
      es: "interviews/es/index.html",
    },
    xDefault: "interviews/index.html",
  },
];
const SELECTED_SECTION_CONFIG = [
  {
    id: "journalism",
    title: "Journalism",
    intro: "Public-interest reporting and commentary tied to concrete events and timelines.",
  },
  {
    id: "media-strategy",
    title: "Media Strategy / Analysis",
    intro: "Work on institutions, platform pressure, and editorial decision environments.",
  },
  {
    id: "propaganda",
    title: "Propaganda / Information Systems",
    intro: "Analysis of networked influence tactics, manipulation infrastructure, and platform adaptation.",
  },
  {
    id: "literature",
    title: "Literature / Essays / Cultural Commentary",
    intro: "Texts on culture, representation, and symbolic politics in public discourse.",
  },
  {
    id: "public-texts",
    title: "Profiles and external records",
    intro: "Third-party publications and institutional references used as external context.",
  },
];
const SELECTED_ROLE_SECTION_CONFIG = {
  quoted: {
    id: "expert-comments",
    title: "Expert comments",
    intro: "Outside reporting and features that use Klishin as an analyst, quoted source, or commentator.",
  },
  reference: {
    id: "references",
    title: "References",
    intro: "Institutional records, profiles, and third-party references kept separate from authored work.",
  },
};
const INTERVIEWS_PAGE_CONFIG = {
  en: {
    path: path.join(interviewsDir, "index.html"),
    lang: "en",
    eyebrow: "Interviews",
    pageTitle: "Interviews",
    pageDescription:
      "Interviews, podcasts, video conversations, and long-form features with Ilia Klishin on media, migration, culture, politics, and digital environments.",
    structuredListName: "Interviews and materials with Ilia Klishin",
    title: "Interviews and public conversations",
    intro:
      "Interviews, conversations, podcasts, and long-form features involving Ilia Klishin on media, migration, literature, politics, digital environments, and cultural context.",
    filtersAria: "Interview filters",
    filterGroupAria: "Format filter",
    filters: {
      all: "All",
      text: "Text",
      video: "Video",
      podcasts: "Podcasts",
    },
    sections: {
      interviews: {
        id: "interviews-main-title",
        title: "Interviews and conversations",
        intro: "Text and video conversations, podcasts, and broadcast appearances.",
      },
      features: {
        id: "interviews-features-title",
        title: "English-language and feature materials",
        intro: "English-language features and public references with direct participation.",
      },
      archive: {
        id: "interviews-archive-title",
        title: "Archive",
        intro: "Early records and archival appearances where exact dating may require additional checks.",
      },
    },
    cta: "Open material ->",
  },
  fr: {
    path: path.join(interviewsDir, "fr", "index.html"),
    lang: "fr",
    eyebrow: "Entretiens",
    pageTitle: "Entretiens",
    pageDescription:
      "Entretiens, podcasts, conversations vidéo et formats longs avec Ilia Klishin sur les médias, l’émigration, la culture, la politique et l’environnement numérique.",
    structuredListName: "Entretiens et interventions avec Ilia Klishin",
    title: "Entretiens et conversations publiques",
    intro:
      "Entretiens, conversations, podcasts et formats longs avec Ilia Klishin autour des médias, de l’émigration, de la littérature, de la politique, de l’environnement numérique et du contexte culturel.",
    filtersAria: "Filtres",
    filterGroupAria: "Filtre par format",
    filters: {
      all: "Tous",
      text: "Texte",
      video: "Vidéo",
      podcasts: "Podcasts",
    },
    sections: {
      interviews: {
        id: "interviews-main-title",
        title: "Entretiens et conversations",
        intro: "Entretiens écrits et vidéo, podcasts et interventions publiques.",
      },
      features: {
        id: "interviews-features-title",
        title: "Matériaux anglophones et formats longs",
        intro: "Formats longs et références publiques avec participation directe.",
      },
      archive: {
        id: "interviews-archive-title",
        title: "Archive",
        intro: "Archives et apparitions plus anciennes dont la datation exacte peut encore demander vérification.",
      },
    },
    cta: "Voir l’entretien →",
  },
  de: {
    path: path.join(interviewsDir, "de", "index.html"),
    lang: "de",
    eyebrow: "Interviews",
    pageTitle: "Interviews",
    pageDescription:
      "Interviews, Podcasts, Videogespräche und längere Feature-Texte mit Ilia Klishin über Medien, Emigration, Kultur, Politik und das digitale Umfeld.",
    structuredListName: "Interviews und Beiträge mit Ilia Klishin",
    title: "Interviews und öffentliche Gespräche",
    intro:
      "Interviews, Gespräche, Podcasts und längere Formate mit Ilia Klishin zu Medien, Emigration, Literatur, Politik, digitalem Umfeld und kulturellem Kontext.",
    filtersAria: "Filter",
    filterGroupAria: "Formatfilter",
    filters: {
      all: "Alle",
      text: "Text",
      video: "Video",
      podcasts: "Podcasts",
    },
    sections: {
      interviews: {
        id: "interviews-main-title",
        title: "Interviews und Gespräche",
        intro: "Interviews in Text und Video, Podcasts und öffentliche Auftritte.",
      },
      features: {
        id: "interviews-features-title",
        title: "Englischsprachige und Feature-Materialien",
        intro: "Englischsprachige Formate und längere Stücke mit direkter Beteiligung.",
      },
      archive: {
        id: "interviews-archive-title",
        title: "Archiv",
        intro: "Frühere Auftritte und Archivmaterialien, deren genaue Datierung teils noch bestätigt werden muss.",
      },
    },
    cta: "Beitrag öffnen →",
  },
  es: {
    path: path.join(interviewsDir, "es", "index.html"),
    lang: "es",
    eyebrow: "Entrevistas",
    pageTitle: "Entrevistas",
    pageDescription:
      "Entrevistas, pódcasts, conversaciones en vídeo y formatos largos con Ilia Klishin sobre medios, emigración, cultura, política y entorno digital.",
    structuredListName: "Entrevistas e intervenciones con Ilia Klishin",
    title: "Entrevistas y conversaciones públicas",
    intro:
      "Entrevistas, conversaciones, podcasts y formatos largos con Ilia Klishin sobre medios, emigración, literatura, política, entorno digital y contexto cultural.",
    filtersAria: "Filtros",
    filterGroupAria: "Filtro por formato",
    filters: {
      all: "Todos",
      text: "Texto",
      video: "Vídeo",
      podcasts: "Podcasts",
    },
    sections: {
      interviews: {
        id: "interviews-main-title",
        title: "Entrevistas y conversaciones",
        intro: "Entrevistas en texto y en vídeo, podcasts e intervenciones públicas.",
      },
      features: {
        id: "interviews-features-title",
        title: "Materiales en inglés y formatos largos",
        intro: "Formatos largos y referencias públicas con participación directa.",
      },
      archive: {
        id: "interviews-archive-title",
        title: "Archivo",
        intro: "Registros tempranos y apariciones de archivo cuya fecha exacta aún puede requerir verificación.",
      },
    },
    cta: "Ver la entrevista →",
  },
};
const INTERVIEW_SECTION_ORDER = ["interviews", "features", "archive"];
const INTERVIEW_EMOJI_POOL = [
  "🎙️", "🎧", "🎥", "📺", "📻", "📚", "📖", "🗞️", "📰", "🗣️",
  "💬", "🌍", "🌐", "🧭", "🧠", "🔎", "📡", "🎞️", "🧩", "📝",
  "📌", "🧾", "🎚️", "🎛️", "🎤", "📣", "🛰️", "⏳", "⌛", "🔬",
  "⚖️", "🛡️", "🏛️", "💡", "🔭", "📊", "📈", "📉", "🧵", "🪶",
  "🧪", "🧬", "🗂️", "📁", "🪄", "✨", "⭐", "🌊", "🌤️", "🌙",
];
const toHtmlLang = (value = "") => {
  const lang = String(value || "").toUpperCase();
  if (lang === "EN") return "en";
  if (lang === "FR") return "fr";
  if (lang === "DE") return "de";
  if (lang === "ES") return "es";
  return "en";
};

const htmlEscape = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const normalizeInterviewIsoDate = (raw = "") => {
  const value = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  const year = value.match(/\d{4}/)?.[0] || "";
  return year ? `${year}-01-01` : "";
};

const formatInterviewDisplayDate = (raw = "", locale = "en") => {
  const value = String(raw || "").trim();
  const normalizedLocale = ["en", "fr", "de", "es"].includes(locale) ? locale : "en";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(normalizedLocale, {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
    }
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    const date = new Date(`${value}-01T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(normalizedLocale, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
    }
  }
  if (/^\d{4}$/.test(value)) return value;
  const range = value.match(/^(\d{4})-(\d{4})$/);
  if (range) return `${range[1]}/${range[2]}`;
  return value;
};

const parseInterviewTimestamp = (raw = "") => {
  const value = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return Date.parse(`${value}T00:00:00Z`) || 0;
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    return Date.parse(`${value}-01T00:00:00Z`) || 0;
  }
  if (/^\d{4}$/.test(value)) {
    return Date.parse(`${value}-01-01T00:00:00Z`) || 0;
  }
  const range = value.match(/^(\d{4})-(\d{4})$/);
  if (range) {
    return Date.parse(`${range[2]}-01-01T00:00:00Z`) || 0;
  }
  const looseYear = value.match(/(\d{4})/);
  if (looseYear) {
    return Date.parse(`${looseYear[1]}-01-01T00:00:00Z`) || 0;
  }
  return 0;
};

const inferInterviewOutlet = (url = "") => {
  const value = String(url || "").trim().toLowerCase();
  if (!value) return "External source";
  if (value.includes("youtube.com")) return "YouTube";
  if (value.includes("podcasts.apple.com")) return "Apple Podcasts";
  if (value.includes("semnasem.org")) return "7x7";
  if (value.includes("rss.com/podcasts/radiotochka")) return "Radio Tochka";
  if (value.includes("holod.media")) return "Holod";
  if (value.includes("thefix.media")) return "The Fix";
  if (value.includes("rferl.org")) return "RFE/RL";
  if (value.includes("radiobaltica.eu")) return "Radio Baltica";
  if (value.includes("ambivert.club")) return "Ambivert Club";
  if (value.includes("cossa.ru")) return "Cossa";
  if (value.includes("theguardian.com")) return "The Guardian";
  if (value.includes("vb.kg")) return "VB.KG";
  return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
};

const normalizeInterviewFormatTokens = (value = "") => {
  const raw = String(value || "").toLowerCase();
  const tokens = [];
  if (/(text|feature|текст)/.test(raw)) tokens.push("text");
  if (/(video|видео)/.test(raw)) tokens.push("video");
  if (/(podcast|подкаст)/.test(raw)) tokens.push("podcasts");
  return [...new Set(tokens)];
};

const interviewEmojiCandidates = (item = {}) => {
  const format = String(item?.formatLabel || "").toLowerCase();
  const section = String(item?.section || "").toLowerCase();
  const language = String(item?.languageLabel || "").toLowerCase();
  const blob = [item?.title, item?.description, item?.formatLabel].map((v) => String(v || "").toLowerCase()).join(" ");

  if (/\bpodcast\b/.test(format) || /\bpodcast\b/.test(blob)) {
    return ["🎙️", "🎧", "📻", "💬"];
  }
  if (/\bvideo\b/.test(format) || /\byoutube|broadcast|talk\b/.test(blob)) {
    return ["🎥", "📺", "🎞️", "📡"];
  }
  if (/\btext\b/.test(format) || /\binterview|feature|essay\b/.test(blob)) {
    return ["📰", "🗞️", "📝", "📖"];
  }
  if (/\bnabokov|book|reading|literature\b/.test(blob)) {
    return ["📚", "📖", "🧠", "🔎"];
  }
  if (section === "features" || /\benglish\b/.test(language)) {
    return ["🌍", "🌐", "🧭", "🗞️"];
  }
  if (section === "archive") {
    return ["🧾", "⌛", "⏳", "🔎"];
  }
  return ["💬", "🧠", "🧭", "📰"];
};

const pickUniqueInterviewEmoji = (candidates, used, seed = 0) => {
  for (const emoji of candidates) {
    if (emoji && !used.has(emoji)) return emoji;
  }
  for (const emoji of INTERVIEW_EMOJI_POOL) {
    if (!used.has(emoji)) return emoji;
  }
  const len = INTERVIEW_EMOJI_POOL.length || 1;
  for (let i = 0; i < len * len; i += 1) {
    const first = INTERVIEW_EMOJI_POOL[(seed + i) % len];
    const second = INTERVIEW_EMOJI_POOL[(seed * 5 + i * 3) % len];
    const pair = `${first}${second}`;
    if (!used.has(pair)) return pair;
  }
  return "✨";
};

const xmlEscape = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const slugify = (text = "") =>
  String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72) || "item";

const toIsoTimestamp = (value = "") => {
  const ts = Date.parse(String(value || ""));
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toISOString();
};

const canonicalUrl = (relativePath = "") => {
  const clean = String(relativePath || "").replace(/^\/+/, "");
  if (!clean || clean === "index.html") return `${baseUrl}/`;
  if (clean.endsWith("/index.html")) {
    const dir = clean.slice(0, -"/index.html".length);
    return `${baseUrl}/${dir}/`;
  }
  return `${baseUrl}/${clean}`;
};

const stripUrlQueryAndHash = (value = "") => String(value || "").split("#")[0].split("?")[0].trim();

const isFixedImageUrl = (value = "") => {
  const normalized = stripUrlQueryAndHash(value);
  return (
    normalized.startsWith(fixedImageAbsoluteUrl(FIXED_IMAGE_PUBLIC_DIR)) ||
    normalized.startsWith(FIXED_IMAGE_PUBLIC_DIR)
  );
};

const withFixedImageVersion = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw || !isFixedImageUrl(raw)) return raw;
  const [withoutHash, hash = ""] = raw.split("#");
  const [basePart, queryPart = ""] = withoutHash.split("?");
  const params = new URLSearchParams(queryPart);
  params.set("v", FIXED_IMAGE_VERSION);
  const next = `${basePart}?${params.toString()}`;
  return hash ? `${next}#${hash}` : next;
};

const extractTitleTag = (html = "") => {
  const match = String(html || "").match(/<title>([\s\S]*?)<\/title>/i);
  return htmlToText(match?.[1] || "").trim();
};

const extractMetaTagContent = (html = "", attrName = "", attrValue = "") => {
  const escapedAttr = escapeRegExpSafe(String(attrValue || ""));
  const match = String(html || "").match(
    new RegExp(
      `<meta\\s+[^>]*${attrName}=["']${escapedAttr}["'][^>]*content=["']([^"']*)["'][^>]*\\/?>|<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${attrName}=["']${escapedAttr}["'][^>]*\\/?>`,
      "i"
    )
  );
  return htmlToText(match?.[1] || match?.[2] || "").trim();
};

const extractLinkHref = (html = "", relValue = "") => {
  const escapedRel = escapeRegExpSafe(String(relValue || ""));
  const match = String(html || "").match(
    new RegExp(
      `<link\\s+[^>]*rel=["']${escapedRel}["'][^>]*href=["']([^"']*)["'][^>]*\\/?>|<link\\s+[^>]*href=["']([^"']*)["'][^>]*rel=["']${escapedRel}["'][^>]*\\/?>`,
      "i"
    )
  );
  return htmlToText(match?.[1] || match?.[2] || "").trim();
};

const socialImageDimensionsForUrl = (imageUrl = "") => {
  const normalized = stripUrlQueryAndHash(imageUrl);
  if (normalized === DEFAULT_SOCIAL_IMAGE) {
    return { width: SOCIAL_IMAGE_WIDTH, height: SOCIAL_IMAGE_HEIGHT };
  }
  return { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
};

const buildSocialMetaSpec = ({
  title = "",
  socialTitle = "",
  description = "",
  canonical = "",
  type = "website",
  imageUrl = "",
  twitterCard = DEFAULT_TWITTER_CARD,
  twitterCreator = DEFAULT_TWITTER_CREATOR,
  siteName = SITE_NAME,
} = {}) => {
  const normalizedTitle = String(title || "").trim();
  const normalizedDescription = String(description || "").trim();
  const normalizedCanonical = String(canonical || "").trim();
  const normalizedType = String(type || "").trim() || "website";
  const normalizedImageUrl = withFixedImageVersion(String(imageUrl || "").trim() || DEFAULT_SOCIAL_IMAGE);
  const normalizedSocialTitle = String(socialTitle || "").trim() || normalizedTitle;
  const { width, height } = socialImageDimensionsForUrl(normalizedImageUrl);

  return {
    title: normalizedTitle,
    socialTitle: normalizedSocialTitle,
    description: normalizedDescription,
    canonical: normalizedCanonical,
    type: normalizedType,
    imageUrl: normalizedImageUrl,
    imageWidth: width,
    imageHeight: height,
    twitterCard: String(twitterCard || "").trim() || DEFAULT_TWITTER_CARD,
    twitterCreator: String(twitterCreator || "").trim() || DEFAULT_TWITTER_CREATOR,
    siteName: String(siteName || "").trim() || SITE_NAME,
  };
};

const renderSocialMetaTags = (meta = {}) => {
  const spec = buildSocialMetaSpec(meta);
  return [
    `<meta property="og:type" content="${htmlEscape(spec.type)}" />`,
    `<meta property="og:title" content="${htmlEscape(spec.socialTitle)}" />`,
    `<meta property="og:description" content="${htmlEscape(spec.description)}" />`,
    `<meta property="og:url" content="${htmlEscape(spec.canonical)}" />`,
    `<meta property="og:site_name" content="${htmlEscape(spec.siteName)}" />`,
    `<meta property="og:image" content="${htmlEscape(spec.imageUrl)}" />`,
    `<meta property="og:image:width" content="${htmlEscape(spec.imageWidth)}" />`,
    `<meta property="og:image:height" content="${htmlEscape(spec.imageHeight)}" />`,
    `<meta property="og:image:type" content="${OG_IMAGE_TYPE}" />`,
    `<meta property="og:image:secure_url" content="${htmlEscape(spec.imageUrl)}" />`,
    `<meta name="twitter:card" content="${htmlEscape(spec.twitterCard)}" />`,
    `<meta name="twitter:title" content="${htmlEscape(spec.socialTitle)}" />`,
    `<meta name="twitter:description" content="${htmlEscape(spec.description)}" />`,
    `<meta name="twitter:image" content="${htmlEscape(spec.imageUrl)}" />`,
    `<meta name="twitter:image:src" content="${htmlEscape(spec.imageUrl)}" />`,
    `<meta name="twitter:creator" content="${htmlEscape(spec.twitterCreator)}" />`,
    `<link rel="image_src" href="${htmlEscape(spec.imageUrl)}" />`,
  ].join("\n    ");
};

const decodeHtmlEntities = (value = "") =>
  String(value || "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

const htmlToText = (value = "") =>
  decodeHtmlEntities(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const normalizeSourceUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  try {
    return new URL(raw, `${baseUrl}/`).toString();
  } catch {
    return raw;
  }
};

const isInternalSiteUrl = (value = "") => {
  const normalized = normalizeSourceUrl(value);
  if (!normalized) return false;
  try {
    return new URL(normalized, `${baseUrl}/`).origin === new URL(`${baseUrl}/`).origin;
  } catch {
    return false;
  }
};

const homeEntryInternalPostUrl = (entry = {}) => {
  if (entry?.postPath) return canonicalUrl(`posts/${entry.postPath}`);
  const slug = String(entry?.item?.slug || "").trim().replace(/\.html$/i, "");
  if (!slug) return "";
  return canonicalUrl(`posts/${slug}.html`);
};

const getHomeEntryNoteUrl = (entry = {}) => {
  const explicitPostUrl = normalizeSourceUrl(entry?.item?.post_url || "");
  if (isInternalSiteUrl(explicitPostUrl)) return explicitPostUrl;
  const internal = homeEntryInternalPostUrl(entry);
  if (isInternalSiteUrl(internal)) return normalizeSourceUrl(internal);
  return "";
};

const getHomeEntryPrimarySourceUrl = (entry = {}) => {
  const externalSource = normalizeSourceUrl(entry?.item?.source_url || entry?.item?.url || "");
  if (!externalSource || isInternalSiteUrl(externalSource)) return "";
  return externalSource;
};

// Home cards are source-first; note links stay separate so the card can open the original publication while the CTA opens the on-site note.
const getHomeEntrySourceHealthUrl = (entry = {}) => getHomeEntryPrimarySourceUrl(entry);

const getHomeEntryPrimaryUrl = (entry = {}, brokenSourceUrls = new Set()) => {
  const sourceUrl = getHomeEntryPrimarySourceUrl(entry);
  if (sourceUrl && !brokenSourceUrls.has(sourceUrl)) return sourceUrl;
  return getHomeEntryNoteUrl(entry);
};

const loadSourceUrlHealth = async () => {
  try {
    const raw = await fs.readFile(sourceUrlHealthPath, "utf8");
    const payload = JSON.parse(raw);
    const brokenUrls = new Set(
      (Array.isArray(payload?.broken_urls) ? payload.broken_urls : [])
        .map((value) => normalizeSourceUrl(value))
        .filter(Boolean)
    );
    return {
      brokenUrls,
      report: payload,
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { brokenUrls: new Set(), report: null };
    }
    throw error;
  }
};

const sourceEntitySeed = (sourceName = "", sourceUrl = "") => {
  const normalizedUrl = normalizeSourceUrl(sourceUrl);
  if (normalizedUrl) {
    try {
      const parsed = new URL(normalizedUrl);
      return parsed.hostname.replace(/^www\./i, "");
    } catch {
      return normalizedUrl;
    }
  }
  return normalizeText(sourceName || "source");
};

const buildSourceEntityId = (sourceName = "", sourceUrl = "") =>
  `${baseUrl}/#source-${slugify(sourceEntitySeed(sourceName, sourceUrl))}`;

const toPosixPath = (value = "") => String(value || "").replaceAll(path.sep, "/").replace(/^\.\/+/, "");

const gitMetaState = {
  repoRoot: null,
  disabled: false,
  cache: new Map(),
};

const latestIso = (values = [], fallback = EPOCH_ISO) => {
  let best = null;
  for (const value of values) {
    const iso = toIsoTimestamp(value);
    if (!iso) continue;
    if (!best || iso > best) best = iso;
  }
  return best || fallback;
};

const resolveGitRepoRoot = async () => {
  if (gitMetaState.disabled) return null;
  if (gitMetaState.repoRoot) return gitMetaState.repoRoot;
  try {
    const { stdout } = await execFile("git", ["rev-parse", "--show-toplevel"], { cwd: process.cwd() });
    const repoRoot = String(stdout || "").trim();
    if (!repoRoot) {
      gitMetaState.disabled = true;
      return null;
    }
    gitMetaState.repoRoot = repoRoot;
    return repoRoot;
  } catch {
    gitMetaState.disabled = true;
    return null;
  }
};

const gitLastmodByRepoRelativePath = async (repoRelativePath = "") => {
  const cleanRelative = toPosixPath(repoRelativePath).replace(/^\/+/, "");
  if (!cleanRelative) return null;
  if (gitMetaState.disabled) return null;
  if (gitMetaState.cache.has(cleanRelative)) return gitMetaState.cache.get(cleanRelative);

  const repoRoot = await resolveGitRepoRoot();
  if (!repoRoot) return null;

  try {
    const { stdout } = await execFile("git", ["log", "-1", "--format=%cI", "--", cleanRelative], { cwd: repoRoot });
    const raw = String(stdout || "").trim();
    const iso = toIsoTimestamp(raw);
    const value = iso || null;
    gitMetaState.cache.set(cleanRelative, value);
    return value;
  } catch {
    gitMetaState.cache.set(cleanRelative, null);
    return null;
  }
};

const gitLastmodForAbsolutePath = async (absolutePath, fallback = null) => {
  const repoRoot = await resolveGitRepoRoot();
  if (!repoRoot) return fallback;
  const rel = toPosixPath(path.relative(repoRoot, absolutePath));
  if (!rel || rel.startsWith("..")) return fallback;
  return (await gitLastmodByRepoRelativePath(rel)) || fallback;
};

const escapeRegExpSafe = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const listHtmlFiles = async (dir) => {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listHtmlFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      out.push(fullPath);
    }
  }
  return out;
};

const computeFixedImageVersion = async () => {
  const hash = crypto.createHash("sha256");
  for (const asset of FIXED_IMAGE_ASSETS) {
    const raw = await fs.readFile(path.join(siteDir, asset.source));
    hash.update(asset.key);
    hash.update(raw);
  }
  return hash.digest("hex").slice(0, FINGERPRINT_HEX_LENGTH) || "1";
};

const materializeFixedImageAssets = async () => {
  for (const asset of FIXED_IMAGE_ASSETS) {
    const sourceAbsolute = path.join(siteDir, asset.source);
    const targetAbsolute = path.join(siteDir, asset.target);
    const raw = await fs.readFile(sourceAbsolute);
    await fs.mkdir(path.dirname(targetAbsolute), { recursive: true });
    await fs.writeFile(targetAbsolute, raw);
  }
};

const cleanupDeprecatedFingerprintedKeyImages = async () => {
  const staleConfigs = [
    { dir: path.join(siteDir, "bio"), base: "ilia-klishin-portrait", ext: ".jpeg" },
    { dir: path.join(siteDir, "bio"), base: "portrait-placeholder", ext: ".svg" },
  ];
  for (const config of staleConfigs) {
    let siblings = [];
    try {
      siblings = await fs.readdir(config.dir);
    } catch {
      continue;
    }
    const stalePattern = new RegExp(
      `^${escapeRegExpSafe(config.base)}\\.[a-f0-9]{${FINGERPRINT_HEX_LENGTH}}${escapeRegExpSafe(config.ext)}$`
    );
    for (const sibling of siblings) {
      if (!stalePattern.test(sibling)) continue;
      await fs.unlink(path.join(config.dir, sibling));
    }
  }
};

const rewriteFixedImageLinksInHtml = async () => {
  const htmlFiles = await listHtmlFiles(siteDir);
  for (const htmlPath of htmlFiles) {
    let html = await fs.readFile(htmlPath, "utf8");
    const original = html;

    for (const asset of FIXED_IMAGE_ASSETS) {
      const targetPublic = `/${asset.target}`;
      const versionedTarget = withFixedImageVersion(targetPublic);
      const absoluteTarget = withFixedImageVersion(fixedImageAbsoluteUrl(targetPublic));
      const ext = path.posix.extname(asset.source);
      const baseName = path.posix.basename(asset.source, ext);
      const sourceDir = path.posix.dirname(asset.source);
      const hashPattern = `[a-f0-9]{${FINGERPRINT_HEX_LENGTH}}`;

      const patterns = [
        ...asset.aliases.map((alias) => new RegExp(`${escapeRegExpSafe(alias)}(?:\\?[^"'\\s)]+)?`, "g")),
        new RegExp(`/${escapeRegExpSafe(sourceDir)}/${escapeRegExpSafe(baseName)}\\.${hashPattern}${escapeRegExpSafe(ext)}(?:\\?[^"'\\s)]+)?`, "g"),
        new RegExp(
          `${escapeRegExpSafe(baseUrl)}/${escapeRegExpSafe(sourceDir)}/${escapeRegExpSafe(baseName)}\\.${hashPattern}${escapeRegExpSafe(ext)}(?:\\?[^"'\\s)]+)?`,
          "g"
        ),
        new RegExp(`${escapeRegExpSafe(baseUrl)}${escapeRegExpSafe(targetPublic)}(?:\\?[^"'\\s)]+)?`, "g"),
      ];

      for (const pattern of patterns) {
        html = html.replace(pattern, (match) => (match.startsWith(baseUrl) ? absoluteTarget : versionedTarget));
      }
    }

    if (html !== original) {
      await fs.writeFile(htmlPath, html, "utf8");
    }
  }
};

const fingerprintSingleAsset = async (sourceRelativePath = "") => {
  const normalizedSource = toPosixPath(sourceRelativePath).replace(/^\/+/, "");
  const sourceAbsolute = path.join(siteDir, normalizedSource);
  let raw;
  try {
    raw = await fs.readFile(sourceAbsolute);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }

  const hash = crypto.createHash("sha256").update(raw).digest("hex").slice(0, FINGERPRINT_HEX_LENGTH);
  const ext = path.extname(normalizedSource);
  const dirPosix = path.posix.dirname(normalizedSource);
  const baseName = path.posix.basename(normalizedSource, ext);
  const fingerprintName = `${baseName}.${hash}${ext}`;
  const fingerprintRelative = dirPosix === "." ? fingerprintName : `${dirPosix}/${fingerprintName}`;
  const fingerprintAbsolute = path.join(siteDir, fingerprintRelative);

  await fs.writeFile(fingerprintAbsolute, raw);

  const sourceDir = path.dirname(sourceAbsolute);
  const siblings = await fs.readdir(sourceDir);
  const stalePattern = new RegExp(
    `^${escapeRegExpSafe(baseName)}\\.[a-f0-9]{${FINGERPRINT_HEX_LENGTH}}${escapeRegExpSafe(ext)}$`
  );
  for (const sibling of siblings) {
    if (!stalePattern.test(sibling)) continue;
    if (sibling === fingerprintName) continue;
    await fs.unlink(path.join(sourceDir, sibling));
  }

  return {
    sourceRelative: normalizedSource,
    fingerprintRelative,
    fingerprintPublicPath: `/${fingerprintRelative}`,
    sourceCanonicalAbsolute: `${baseUrl}/${normalizedSource}`,
    fingerprintCanonicalAbsolute: `${baseUrl}/${fingerprintRelative}`,
  };
};

const rewriteAssetLinksInHtml = async (assets) => {
  const htmlFiles = await listHtmlFiles(siteDir);
  for (const htmlFile of htmlFiles) {
    let html = await fs.readFile(htmlFile, "utf8");
    const original = html;

    for (const asset of assets) {
      const aliases = new Set([
        `/${asset.sourceRelative}`,
        ...((asset.aliases || []).map((value) => String(value || "").trim()).filter(Boolean)),
      ]);
      const orderedAliases = [...aliases].sort((a, b) => b.length - a.length);
      const ext = path.posix.extname(asset.sourceRelative);
      const baseName = path.posix.basename(asset.sourceRelative, ext);
      const dirName = path.posix.dirname(asset.sourceRelative);
      const publicDir = dirName === "." ? "" : `/${dirName}`;
      const canonicalDir = dirName === "." ? "" : `/${dirName}`;
      const hashPattern = `[a-f0-9]{${FINGERPRINT_HEX_LENGTH}}`;

      const canonicalAbsoluteRe = new RegExp(
        `${escapeRegExpSafe(asset.sourceCanonicalAbsolute)}(?:\\?[^"'\\s)]+)?`,
        "g"
      );
      html = html.replace(canonicalAbsoluteRe, asset.fingerprintCanonicalAbsolute);

      // Rewrite any previous fingerprinted absolute canonical URL.
      const oldCanonicalFingerprintedRe = new RegExp(
        `${escapeRegExpSafe(baseUrl)}${escapeRegExpSafe(canonicalDir)}\\/${escapeRegExpSafe(baseName)}\\.${hashPattern}${escapeRegExpSafe(ext)}(?:\\?[^"'\\s)]+)?`,
        "g"
      );
      html = html.replace(oldCanonicalFingerprintedRe, asset.fingerprintCanonicalAbsolute);

      for (const alias of orderedAliases) {
        const re = new RegExp(`${escapeRegExpSafe(alias)}(?:\\?[^"'\\s)]+)?`, "g");
        html = html.replace(re, asset.fingerprintPublicPath);
      }

      // Rewrite any previous fingerprinted root-relative public path.
      const oldPublicFingerprintedRe = new RegExp(
        `${escapeRegExpSafe(publicDir)}\\/${escapeRegExpSafe(baseName)}\\.${hashPattern}${escapeRegExpSafe(ext)}(?:\\?[^"'\\s)]+)?`,
        "g"
      );
      html = html.replace(oldPublicFingerprintedRe, asset.fingerprintPublicPath);

      const relativeFingerprintedRe = new RegExp(
        `(?:\\./|\\.\\./)+${escapeRegExpSafe(asset.fingerprintRelative)}(?:\\?[^"'\\s)]+)?`,
        "g"
      );
      html = html.replace(relativeFingerprintedRe, asset.fingerprintPublicPath);
    }

    if (html !== original) {
      await fs.writeFile(htmlFile, html, "utf8");
    }
  }
};

const fingerprintStaticAssets = async () => {
  const mapped = [];
  for (const config of FINGERPRINTABLE_ASSETS) {
    const result = await fingerprintSingleAsset(config.source);
    if (!result) continue;
    mapped.push({
      ...result,
      aliases: config.aliases,
    });
  }
  await rewriteAssetLinksInHtml(mapped);
  return mapped;
};

const latestBuildIso = (entries) => {
  let latest = null;
  for (const entry of entries) {
    const iso = toIsoTimestamp(entry?.item?.date);
    if (!iso) continue;
    if (!latest || iso > latest) latest = iso;
  }
  return latest || EPOCH_ISO;
};

const truncateChars = (text = "", max = 220) => {
  const plain = String(text || "").replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).trim()}…`;
};

const normalizedArray = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const next = String(raw || "").replace(/\s+/g, " ").trim();
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
};

const MACHINE_FRAGMENT_PATTERNS = [
  /\bmapped as\b/i,
  /\bmachine[- ]?readable\b/i,
  /\bsource[- ]?linked\b/i,
  /\bentity disambiguation\b/i,
  /\bsearch\/llm\/indexing\b/i,
  /\bllm\b/i,
  /\bindexing\b/i,
  /\bthis page structures the topic\b/i,
  /\bit structures the topic\b/i,
  /\bthis card is valuable for timeline checks\b/i,
  /\bas a dated source from\b/i,
  /\bhelps verify chronology actors\b/i,
  /\bcausal framing\b/i,
  /\bmultilingual materials\b/i,
  /\bpublic records\b/i,
  /\battributable sourcing\b/i,
  /\bnamed actors\b/i,
  /\bdated events\b/i,
  /\bpublication context\b/i,
  /\bcontrole de timeline\b/i,
  /\btimeline pruefung\b/i,
  /\bchronologie akteure\b/i,
  /\bkausalbezuge\b/i,
  /\bthe narrative avoids reductive labels\b/i,
  /\bso readers can separate reported facts from interpretation\b/i,
  /\binstead of categorical labeling\b/i,
];

const TECHNICAL_TAG_PATTERNS = [
  /^language-[a-z]{2}$/i,
  /^reference-\d+$/i,
  /^year-\d{4}$/i,
  /^source-verification$/i,
  /^machine-readable$/i,
  /^source-linked$/i,
  /^entity-disambiguation$/i,
  /^indexing$/i,
  /^llm$/i,
];

const normalizeText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

const cleanDisplayTitle = (rawTitle = "") => {
  const raw = normalizeText(rawTitle);
  if (!raw) return "Untitled";
  const cleaned = raw
    .replace(/\s+\(\d{4}-\d{2}-\d{2}\)\s*$/i, "")
    .replace(/^(.{3,120}?)\s*\(\d{4}-\d{2}-\d{2}\)\s*-\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || raw;
};

const normalizeTopicLabel = (value = "") => {
  const normalized = normalizeText(value).replace(/[_-]+/g, " ").trim();
  if (!normalized) return "Article";
  return toTitleCase(normalized);
};

const isInterviewLike = (item = {}) => {
  const text = normalizeText(
    [item?.title, item?.topic, item?.source, item?.url, item?.relation, item?.material_type].join(" ")
  ).toLowerCase();
  if (!text) return false;
  if (
    /\b(interview|podcast|conversation|q&a|video interview|audio interview|roundtable)\b/.test(text)
  ) {
    return true;
  }
  if (/youtube\.com|youtu\.be|podcasts\.apple\.com|rss\.com\/podcasts/.test(text)) return true;
  return false;
};

const classifySelectedSection = (item = {}) => {
  const source = normalizeText(item?.source).toLowerCase();
  const title = normalizeText(item?.title).toLowerCase();
  const topic = normalizeText(item?.topic).toLowerCase();
  const blob = `${title} ${topic} ${source}`;

  if (/\b(volna|diaspora|emigrant|exile|refugee|migration)\b/.test(blob)) {
    return "media-strategy";
  }
  if (/\b(cultural|culture|literature|essay|cinema|representation|stephen king|film)\b/.test(blob)) {
    return "literature";
  }
  if (
    /\b(disinformation|propaganda|troll|bot army|platform influence|information systems|tik ?tok|telegram channels?)\b/.test(
      blob
    )
  ) {
    return "propaganda";
  }
  if (["human rights watch", "los angeles times", "news24"].includes(source)) {
    return "public-texts";
  }
  if (
    /\b(media freedom|media ethics|social network regulation|electoral timing|comparative media framing|public opinion|elite discourse)\b/.test(
      blob
    )
  ) {
    return "media-strategy";
  }
  return "journalism";
};

const selectedSectionLabelById = (sectionId = "") =>
  SELECTED_SECTION_CONFIG.find((section) => section.id === sectionId)?.title || "Selected Work";

const extractYear = (value = "") => {
  const match = String(value || "").trim().match(/^(\d{4})/);
  return match ? match[1] : "";
};

const PLACEHOLDER_TITLE_RE = [
  /^(vedomosti|the moscow times ru|ru\.themoscowtimes|snob|tv rain)$/i,
  /^(signed column in|chronique signee dans|signierter beitrag in|texto firmado en)\b/i,
  /^(interview on|entretien dans|interview in|entrevista en)\b/i,
  /^(author page|autorenprofil|profil d auteur|perfil de autor)\b/i,
  /^(editorial piece|texte editorial|redaktioneller text|texto editorial)$/i,
  /^(magazine piece|texte de magazine|magazintext|texto de revista)$/i,
  /^(interview|interview byline|co-authored report)$/i,
  /\b(record|notice|entry|mirror domain|canonical variant)\b/i,
];

const SMALL_TITLE_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "at",
  "by",
  "with",
  "from",
  "de",
  "la",
  "el",
  "y",
  "en",
  "von",
  "und",
]);

const toTitleCase = (value = "") =>
  String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, idx) => {
      const lowerWord = word.toLowerCase();
      if (idx > 0 && SMALL_TITLE_WORDS.has(lowerWord)) return lowerWord;
      return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
    })
    .join(" ");

const humanizeSourceSlug = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/[a-z]/i.test(raw)) return "";
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  decoded = decoded
    .replace(/\.html?$/i, "")
    .replace(/^[a-z]{2}-\d{3}-/i, "")
    .replace(/-a\d+$/i, "")
    .replace(/^\d{3,}-/i, "")
    .replace(/-\d{3,}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!decoded || decoded.length < 6) return "";
  if (/^\d+(\.phtml)?$/i.test(decoded)) return "";
  const words = decoded.split(/\s+/).filter(Boolean);
  if (words.length < 2) return "";
  if (/^(authors?|profile|selected|entry|tag|posts|opinion|columns|news|articles)$/i.test(decoded)) return "";
  if (/^(klishin|details|interview|about|blog|material)$/i.test(decoded)) return "";
  return toTitleCase(decoded);
};

const extractTitleFromSourceUrl = (sourceUrl = "") => {
  const url = normalizeSourceUrl(sourceUrl);
  if (!url) return "";
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }

  const host = String(parsed.hostname || "").toLowerCase();
  const pathname = String(parsed.pathname || "");
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "";
  const prev = segments[segments.length - 2] || "";

  if (/authors?|author/.test(last) || /authors?|author/.test(prev)) {
    if (host.includes("snob")) return "Snob author page";
    if (host.includes("vedomosti")) return "Vedomosti author page";
    if (host.includes("moscowtimes")) return "The Moscow Times author page";
    return "Author page";
  }

  const fromLast = humanizeSourceSlug(last);
  if (fromLast) return fromLast;
  const fromPrev = humanizeSourceSlug(prev);
  if (fromPrev) return fromPrev;
  return "";
};

const fallbackTitleFromContext = (item = {}) => {
  const source = normalizeText(item?.source || "Source");
  const relation = normalizeText(item?.relation || "").toLowerCase();

  if (/author_profile/.test(relation)) return `${source} author page`;
  if (/interview/.test(relation)) return `Interview in ${source}`;
  if (/opinion|column/.test(relation)) return `Column in ${source}`;
  if (/republic/i.test(source)) return "Republic opinion column";
  if (/open.?space|colta/i.test(source)) return "OpenSpace/Colta co-authored report";
  if (/lenta/i.test(source)) return "Interview in Lenta";
  if (/the village/i.test(source)) return "Interview in The Village";
  if (/the moscow times ru/i.test(source)) return "Column in The Moscow Times RU";
  return `Article in ${source}`;
};

const resolveDisplayTitle = (item = {}) => {
  const cleaned = cleanDisplayTitle(item?.title || "");
  const looksPlaceholder = PLACEHOLDER_TITLE_RE.some((re) => re.test(cleaned));
  if (!looksPlaceholder) return cleaned;

  const recovered = extractTitleFromSourceUrl(item?.url || "");
  if (recovered) return recovered;

  return fallbackTitleFromContext(item);
};

const smartTrim = (text = "", max = 80) => {
  const value = normalizeText(text);
  if (!value) return "";
  if (value.length <= max) return value;
  const clipped = value.slice(0, max).replace(/\s+\S*$/, "").trim();
  return clipped || value.slice(0, max).trim();
};

const trimMetaDescription = (text = "", max = 170) => {
  const value = normalizeText(text);
  if (!value) return "";
  if (value.length <= max) return /[.!?]$/.test(value) ? value : `${value}.`;
  const clipped = value.slice(0, max).replace(/\s+\S*$/, "").trim();
  if (!clipped) return value.slice(0, max).trim();
  return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
};

const pickSeededVariant = (seed, variants) => {
  if (!Array.isArray(variants) || variants.length === 0) return "";
  const key = hashText(seed);
  return variants[key % variants.length] || variants[0];
};

const GENERIC_SOURCE_TITLE_RE =
  /^(?:The Moscow Times(?:\s+(?:RU|EN))?|Vedomosti|Snob|Republic|OpenSpace\/Colta|MEL\.?fm|News24|Wikinews|Lenta|The Village|AdIndex|Ambivert|7x7|RTVI|TV Rain|Freedom House|TEDx\s*\/\s*TED\.com|YouTube\s*\/\s*TED)\s*\(\d{4}-\d{2}-\d{2}\)(?:\s*-\s*.+)?$/i;
const SOURCE_ONLY_TITLE_RE =
  /^(?:The Moscow Times(?:\s+(?:RU|EN))?|Vedomosti|Snob|Republic|OpenSpace\/Colta|MEL\.?fm|News24|Wikinews|Lenta|The Village|AdIndex|Ambivert|7x7|RTVI|TV Rain|Freedom House|TEDx\s*\/\s*TED\.com|YouTube\s*\/\s*TED)$/i;
const buildPostMetaTitle = (item = {}, displayTitle = "") => {
  const source = normalizeText(item?.source || "Publication");
  const topic = normalizeText(item?.topic || "");
  const date = normalizeText(item?.date || "");
  const raw = normalizeText(displayTitle || item?.title || "");
  const looksGeneric =
    !raw ||
    raw.length < 12 ||
    /^untitled$/i.test(raw) ||
    /^entry$/i.test(raw) ||
    GENERIC_SOURCE_TITLE_RE.test(raw) ||
    SOURCE_ONLY_TITLE_RE.test(raw);

  let core = raw;
  if (looksGeneric) {
    if (source && topic) {
      core = `${source}: ${topic}`;
    } else if (source && date) {
      core = `${source} (${date})`;
    } else {
      core = source || "Publication";
    }
  }

  return smartTrim(core, 82);
};

const buildPostMetaDescription = (item = {}) => {
  const lang = normalizeLang(item?.language);
  const source = normalizeText(item?.source || "");
  const topic = normalizeText(item?.topic || "");
  const date = normalizeText(item?.date || "");
  const extracted = extractMetaSentence(item);

  let summary = extracted;
  if (!summary) {
    const seed = `${item?.id || ""}|${source}|${topic}|${date}|${lang}`;
    if (lang === "FR") {
      summary = pickSeededVariant(seed, [
        `${source || "Ce texte"}${date ? ` (${date})` : ""} éclaire ${topic || "le sujet"} à partir des faits, des acteurs et de la chronologie.`,
        `Synthèse concise sur ${topic || "ce sujet"} à partir d’une publication ${source || "sourcée"}${date ? ` (${date})` : ""}.`,
        `${source || "Publication"}${date ? ` (${date})` : ""} : lecture brève de ${topic || "la question"} avec contexte et enjeux.`,
        `Repère de lecture sur ${topic || "le sujet"}, fondé sur la source ${source || "principale"}${date ? ` (${date})` : ""}.`,
      ]);
    } else if (lang === "DE") {
      summary = pickSeededVariant(seed, [
        `${source || "Der Beitrag"}${date ? ` (${date})` : ""} erläutert ${topic || "das Thema"} entlang von Fakten, Akteuren und zeitlichem Verlauf.`,
        `Kurze Einordnung zu ${topic || "diesem Thema"} auf Grundlage der Quelle ${source || "mit belastbarem Bezug"}${date ? ` (${date})` : ""}.`,
        `${source || "Publikation"}${date ? ` (${date})` : ""}: knappe Einordnung von ${topic || "der Fragestellung"} mit Kontext.`,
        `Leseseite zu ${topic || "dem Thema"}, abgeleitet aus der Originalquelle ${source || ""}${date ? ` (${date})` : ""}.`,
      ]);
    } else if (lang === "ES") {
      summary = pickSeededVariant(seed, [
        `${source || "Este texto"}${date ? ` (${date})` : ""} explica ${topic || "el tema"} con foco en hechos, actores y cronología.`,
        `Resumen de ${topic || "esta cuestión"} basado en la fuente ${source || "principal"}${date ? ` (${date})` : ""}, con contexto verificable.`,
        `${source || "Publicación"}${date ? ` (${date})` : ""}: lectura breve de ${topic || "la cuestión"} y sus implicaciones públicas.`,
        `Página de referencia sobre ${topic || "el tema"}, construida a partir de la fuente ${source || "original"}${date ? ` (${date})` : ""}.`,
      ]);
    } else {
      summary = pickSeededVariant(seed, [
        `${source || "This text"}${date ? ` (${date})` : ""} explains ${topic || "the topic"} through facts, actors, and timeline context.`,
        `A concise reading of ${topic || "this issue"} based on ${source || "the source"}${date ? ` (${date})` : ""}, with verifiable touchpoints.`,
        `${source || "Publication"}${date ? ` (${date})` : ""}: focused summary of ${topic || "the core question"} and its public relevance.`,
        `Reference page on ${topic || "the topic"}, grounded in the original source${source ? ` (${source})` : ""}${date ? `, ${date}` : ""}.`,
      ]);
    }
  }

  let value = summary;
  if (source && !new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(value)) {
    if (lang === "FR") value = `${value} Publié dans ${source}${date ? ` (${date})` : ""}.`;
    else if (lang === "DE") value = `${value} Veröffentlicht bei ${source}${date ? ` (${date})` : ""}.`;
    else if (lang === "ES") value = `${value} Publicado en ${source}${date ? ` (${date})` : ""}.`;
    else value = `${value} Published in ${source}${date ? ` (${date})` : ""}.`;
  } else if (date && !value.includes(date)) {
    if (lang === "FR") value = `${value} Date de publication: ${date}.`;
    else if (lang === "DE") value = `${value} Veroeffentlicht: ${date}.`;
    else if (lang === "ES") value = `${value} Publicado: ${date}.`;
    else value = `${value} Published: ${date}.`;
  }
  return trimMetaDescription(value, 170);
};

const composeCardMeta = (item = {}) => {
  const source = normalizeText(item?.source || "-");
  const date = normalizeText(item?.date || "-");
  return `${source} • ${date}`;
};

const sourceActionLabel = (item = {}) => {
  const title = normalizeText(item?.title || "").toLowerCase();
  const source = normalizeText(item?.source || "").toLowerCase();
  const topic = normalizeText(item?.topic || "").toLowerCase();
  const url = normalizeSourceUrl(item?.url || "").toLowerCase();
  const looksVideo =
    /\b(video|talk)\b/.test(title) ||
    /\b(youtube|tedx)\b/.test(source) ||
    /\bpublic speaking\b/.test(topic) ||
    /youtube\.com|youtu\.be|ted\.com/.test(url);
  if (looksVideo) return "Watch video";
  if (isReferenceCard(item)) return "Open source";
  return "Read piece";
};

const sanitizeSemanticTags = (tags = []) =>
  normalizedArray(tags).filter((tag) => {
    const value = normalizeText(tag).toLowerCase();
    if (!value) return false;
    if (TECHNICAL_TAG_PATTERNS.some((pattern) => pattern.test(value))) return false;
    return true;
  });

const hasMachineText = (text = "") => {
  const value = normalizeText(text);
  if (!value) return false;
  return MACHINE_FRAGMENT_PATTERNS.some((pattern) => pattern.test(value));
};

const quoteCount = (item = {}) => {
  const list = Array.isArray(item?.quotes) ? item.quotes : [item?.quote].filter(Boolean);
  return list.map((x) => normalizeText(x)).filter(Boolean).length;
};

const stripLeadScaffolding = (text = "") =>
  normalizeText(text)
    .replace(
      /^This\s+.+?\s+piece\s+\(\d{4}-\d{2}-\d{2}\)\s+examines\s+a\s+concrete\s+case\s+related\s+to\s+Ilia\s+Klishin\s+and\s+situates\s+the\s+stakes\s+of\s+.+?\.\s*/i,
      ""
    )
    .replace(
      /^In\s+this\s+\d{4}-\d{2}-\d{2}\s+.+?\s+article,\s+the\s+central\s+argument\s+is\s+how\s+/i,
      ""
    )
    .replace(/^Published in .+? this text is mapped as .+?\.\s*/i, "")
    .replace(/^Publie par .+? le \d{4}-\d{2}-\d{2},\s*/i, "")
    .replace(/^Dieser Beitrag in .+? \(\d{4}-\d{2}-\d{2}\)\s+untersucht.+?\.\s*/i, "")
    .replace(/\s*In the \d{4}-\d{2}-\d{2} context, Ilia Klishin connects.+$/i, "")
    .trim();

const splitSentences = (text = "") => {
  const prepared = String(text || "").replace(
    /\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\./gi,
    "$1"
  );
  const matches = prepared.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!Array.isArray(matches)) return [];
  return matches
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean);
};

const hasMachineFragments = (sentence = "") =>
  MACHINE_FRAGMENT_PATTERNS.some((pattern) => pattern.test(String(sentence || "").trim()));

const TEMPLATE_SENTENCE_PATTERNS = [
  /^(ce texte|este texto|dieser beitrag|in diesem|la fiche|la carte|der eintrag)\b/i,
  /\bexamines a concrete case related to ilia klishin\b/i,
  /\bexamine un cas concret lie a ilia klishin\b/i,
  /\bexamina un caso concreto vinculado con ilia klishin\b/i,
  /\buntersucht einen konkreten fall mit bezug zu ilia klishin\b/i,
  /\bthe text rebuilds the discussion\b/i,
  /\bla fiche recompone el caso\b/i,
  /\bla carte reconstitue le dossier\b/i,
  /\bder eintrag ordnet das thema\b/i,
  /^im kontext \d{4}-\d{2}-\d{2}\s+verbindet ilia klishin/i,
  /^dans le contexte \d{4}-\d{2}-\d{2}\s+ilia klishin/i,
  /^en el contexto \d{4}-\d{2}-\d{2}\s+ilia klishin/i,
  /^in the \d{4}-\d{2}-\d{2} context,\s+ilia klishin/i,
  /\bis outlined from the source\b/i,
  /\bwith the key contextual markers\b/i,
  /\bthe piece examines .+ through events, actors, and editorial framing\b/i,
];

const SUMMARY_BOILERPLATE_PATTERNS = [
  /\bentry added to include\b/i,
  /\bthe summary gives a clear reference point for later comparisons\b/i,
  /\buseful reference card\b/i,
  /\bthis (?:card|entry|piece) is included as\b/i,
  /\bit is included as\b/i,
  /\bkeep this as\b/i,
  /\bsource record\b/i,
  /\bexternal analytical reference\b/i,
  /\bexternal profile context source\b/i,
  /\binstitutional context source\b/i,
  /\binstitutional record in the wider timeline\b/i,
  /\bconservee? comme source\b/i,
  /\best incluse? comme\b/i,
  /\bdiese? (?:karte|eintrag) .*referenz\b/i,
  /\bals (?:referenz|nachweis|quelle)\b/i,
  /\bfor later comparisons\b/i,
  /\bopen on-site note\b/i,
  /\bdirect link to the original publication\b/i,
  /\bdirectly to the primary source\b/i,
];

const isTemplateSentence = (sentence = "") =>
  TEMPLATE_SENTENCE_PATTERNS.some((pattern) => pattern.test(normalizeText(sentence)));

const isSummaryBoilerplate = (sentence = "") =>
  SUMMARY_BOILERPLATE_PATTERNS.some((pattern) => pattern.test(normalizeText(sentence)));

const normalizeSummarySentence = (sentence = "") =>
  normalizeText(sentence)
    .replace(/\bPublished:\s*\d{4}-\d{2}-\d{2}\.?\s*$/i, "")
    .replace(/\bPublie le\s+\d{4}-\d{2}-\d{2}\.?\s*$/i, "")
    .replace(/\bVeröffentlicht:\s*\d{4}-\d{2}-\d{2}\.?\s*$/i, "")
    .replace(/\bPublicado:\s*\d{4}-\d{2}-\d{2}\.?\s*$/i, "")
    .trim();

const collectCleanSummarySentences = (item = {}, rawText = "", options = {}) => {
  const maxSentences = Number.isFinite(options.maxSentences) ? options.maxSentences : 2;
  const cleaned = stripLeadScaffolding(normalizeText(rawText || "")) || normalizeText(rawText || "");
  const unique = new Set();
  const sentences = [];

  for (const sentence of splitSentences(cleaned)) {
    const value = normalizeSummarySentence(sentence);
    if (!value) continue;
    if (value.length < 24) continue;
    if (hasMachineFragments(value)) continue;
    if (isTemplateSentence(value)) continue;
    if (isSummaryBoilerplate(value)) continue;
    const key = value.toLowerCase();
    if (unique.has(key)) continue;
    unique.add(key);
    sentences.push(value);
    if (sentences.length >= Math.max(1, maxSentences)) break;
  }

  return sentences;
};

const finalizeSummaryText = (sentences = [], fallback = "") => {
  const preview = normalizeText(sentences.join(" ")) || normalizeText(fallback);
  if (!preview) return "";
  if (preview.length <= 320) {
    return /[.!?]$/.test(preview) ? preview : `${preview}.`;
  }

  const boundedSentences = splitSentences(preview);
  if (boundedSentences.length > 1) {
    let joined = "";
    for (const sentence of boundedSentences) {
      const next = normalizeText(`${joined} ${sentence}`.trim());
      if (next.length > 320) break;
      joined = next;
    }
    if (joined) return /[.!?]$/.test(joined) ? joined : `${joined}.`;
  }

  const clauses = preview.split(/(?<=[,;:])\s+/).map((part) => normalizeText(part)).filter(Boolean);
  if (clauses.length > 1) {
    let joined = "";
    for (const clause of clauses) {
      const next = normalizeText(`${joined} ${clause}`.trim());
      if (next.length > 320) break;
      joined = next;
    }
    if (joined && joined.length >= 80) {
      const clean = joined.replace(/[,:;]\s*$/, "").trim();
      return /[.!?]$/.test(clean) ? clean : `${clean}.`;
    }
  }

  const fallbackValue = normalizeText(fallback);
  if (fallbackValue && fallbackValue.length <= 320) {
    return /[.!?]$/.test(fallbackValue) ? fallbackValue : `${fallbackValue}.`;
  }

  return /[.!?]$/.test(preview) ? preview : `${preview}.`;
};

const extractMetaSentence = (item = {}) => {
  const pools = [item?.summary, item?.digest, item?.value_context];
  for (const pool of pools) {
    const cleaned = stripLeadScaffolding(normalizeText(pool || ""));
    if (!cleaned) continue;
    for (const sentence of splitSentences(cleaned)) {
      const value = normalizeSummarySentence(sentence);
      if (!value || value.length < 40) continue;
      if (hasMachineFragments(value)) continue;
      if (isTemplateSentence(value)) continue;
      if (isSummaryBoilerplate(value)) continue;
      return value;
    }
  }
  return "";
};

const hashText = (value = "") => {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const previewSummary = (item = {}) => {
  const raw = normalizeText(item?.digest || item?.summary || "");
  if (!raw) return "";
  const sentences = collectCleanSummarySentences(item, raw, { maxSentences: 2 });
  return finalizeSummaryText(sentences, fallbackSummary(item)).replace(/^[a-z]/, (char) => char.toUpperCase());
};

const fallbackSummary = (item = {}) => {
  const topic = normalizeText(item?.topic || "the topic");
  const source = normalizeText(item?.source || "the source");
  const year = /^\d{4}/.test(String(item?.date || "")) ? String(item.date).slice(0, 4) : "";
  const lang = normalizeLang(item?.language);
  const seed = `${item?.id || ""}|${topic}|${source}|${year}|summary`;
  let result = "";
  if (lang === "FR") {
    result = pickSeededVariant(seed, [
      `Le texte porte sur ${topic}${year ? ` en ${year}` : ""}.`,
      `Cette publication${year ? ` de ${year}` : ""} examine ${topic}.`,
      `${source} publie ici un texte consacré à ${topic}.`,
      `L'article revient sur ${topic}.`,
    ]);
  } else if (lang === "DE") {
    result = pickSeededVariant(seed, [
      `Der Beitrag behandelt ${topic}${year ? ` (${year})` : ""}.`,
      `Die Publikation${year ? ` aus ${year}` : ""} ordnet ${topic} ein.`,
      `${source} veröffentlicht hier einen Text zu ${topic}.`,
      `Der Text stellt ${topic} knapp dar.`,
    ]);
  } else if (lang === "ES") {
    result = pickSeededVariant(seed, [
      `El texto aborda ${topic}${year ? ` en ${year}` : ""}.`,
      `Esta publicación${year ? ` de ${year}` : ""} revisa ${topic}.`,
      `${source} publica aquí un texto sobre ${topic}.`,
      `La pieza presenta ${topic} de forma directa.`,
    ]);
  } else {
    result = pickSeededVariant(seed, [
      `The piece examines ${topic}${year ? ` in ${year}` : ""}.`,
      `This ${source}${year ? ` (${year})` : ""} publication focuses on ${topic}.`,
      `${source} publishes a piece on ${topic}.`,
      `The article outlines ${topic} in clear terms.`,
    ]);
  }

  return String(result || "").replace(/^[a-z]/, (char) => char.toUpperCase());
};

const fallbackContext = (item = {}) => {
  const topic = normalizeText(item?.topic || "the topic");
  const source = normalizeText(item?.source || "the source");
  const lang = normalizeLang(item?.language);
  const year = /^\d{4}/.test(String(item?.date || "")) ? String(item.date).slice(0, 4) : "";
  const key = hashText(item?.id || `${topic}-${source}`);
  const stamp = year ? ` in ${year}` : "";
  if (lang === "FR") {
    const variants = [
      `Ce texte replace ${topic} dans son moment editorial${stamp}.`,
      `La synthese relie ${topic} au texte original publie sur ${source}.`,
      `Le sujet ${topic} est presente avec des points de verification clairs.`,
      `La lecture donne un acces direct a la source primaire.`,
    ];
    return variants[key % variants.length];
  }
  if (lang === "DE") {
    const variants = [
      `Der Beitrag ordnet ${topic} im zeitlichen Rahmen${stamp} ein.`,
      `Die Zusammenfassung verbindet ${topic} mit dem Originaltext auf ${source}.`,
      `${topic} wird mit den wichtigsten Bezugspunkten klar zusammengefasst.`,
      `Der Text verweist direkt auf die Primaerquelle.`,
    ];
    return variants[key % variants.length];
  }
  if (lang === "ES") {
    const variants = [
      `El texto ubica ${topic} en su momento editorial${stamp}.`,
      `El resumen conecta ${topic} con el texto original en ${source}.`,
      `${topic} se explica con referencias claras y verificables.`,
      `La pieza da acceso directo a la fuente primaria.`,
    ];
    return variants[key % variants.length];
  }
  const variants = [
    `This piece places ${topic} in a concrete editorial moment${stamp}.`,
    `It connects ${topic} with the original text published by ${source}.`,
    `It offers a concise entry point into the debate around ${topic}.`,
    `It explains ${topic} and links to the original source.`,
  ];
  return variants[key % variants.length];
};

const normalizeContextLead = (text = "", item = {}) => {
  const value = normalizeText(text);
  if (!value) return "";
  return value
    .replace(/^why this matters:\s*/i, "")
    .replace(/^relevance:\s*/i, "")
    .replace(/^use case:\s*/i, "")
    .replace(/^reader value:\s*/i, "")
    .replace(/^context:\s*/i, "")
    .replace(/^contexte:\s*/i, "")
    .replace(/^pertinence:\s*/i, "")
    .replace(/^usage:\s*/i, "")
    .replace(/^lecture utile:\s*/i, "")
    .replace(/^kontext:\s*/i, "")
    .replace(/^relevanz:\s*/i, "")
    .replace(/^nutzen:\s*/i, "")
    .replace(/^lesewert:\s*/i, "")
    .replace(/^contexto:\s*/i, "")
    .replace(/^relevancia:\s*/i, "")
    .replace(/^uso practico:\s*/i, "")
    .replace(/^valor de lectura:\s*/i, "")
    .trim();
};

const previewContext = (item = {}) => {
  const raw = normalizeText(item?.value_context || "");
  if (!raw) return fallbackContext(item);
  const cleaned = stripLeadScaffolding(raw) || raw;
  const candidates = splitSentences(cleaned).filter(
    (sentence) => !hasMachineFragments(sentence) && !isTemplateSentence(sentence)
  );
  let context = candidates[0] || "";
  if (!context || context.length < 36) context = fallbackContext(item);
  if (context.length > 200) {
    context = context.slice(0, 200).replace(/\s+\S*$/, "").trim();
    if (!/[.!?]$/.test(context)) context += ".";
  }
  return normalizeContextLead(context, item);
};

const sanitizeSelectedIntro = (text = "", item = {}) => {
  let value = finalizeSummaryText(collectCleanSummarySentences(item, text, { maxSentences: 2 }), "");
  if (!value) return "";

  const markerPatterns = [
    /\bThis card summarizes\b/i,
    /\bEntry added to include\b/i,
    /\bThis card is included as\b/i,
    /\bIt is included as\b/i,
  ];

  value = value
    .replace(/\bEntry added to include[^.]*\.\s*/gi, "")
    .replace(/\bThis card is included as[^.]*\.\s*/gi, "")
    .replace(/\bThis card summarizes\b[^.]*\.\s*/gi, "")
    .replace(/\bIt is included as[^.]*\.\s*/gi, "")
    .replace(/\bReference card\b[^.]*\.\s*/gi, "")
    .replace(/\bThe card is included as\b[^.]*\.\s*/gi, "")
    .trim();

  for (const re of markerPatterns) {
    const hit = value.match(re);
    if (!hit || typeof hit.index !== "number") continue;
    value = value.slice(0, hit.index).trim();
  }

  if (markerPatterns.some((re) => re.test(value))) {
    value = "";
  }

  if (!value || value.length < 24) {
    value = normalizeText(fallbackSummary(item));
  }

  return value;
};

const pickCardQuote = (item = {}) => {
  const candidates =
    Array.isArray(item?.quotes) && item.quotes.length > 0
      ? item.quotes
      : [item?.quote].filter(Boolean);
  for (const raw of candidates) {
    const value = normalizeText(raw);
    if (!value) continue;
    if (hasMachineFragments(value)) continue;
    const quoteCore = value
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .replace(/\s*[-–—]\s*[^-–—]+$/g, "")
      .trim();
    const quoteComparable = quoteCore.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const titleComparable = String(item?.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (quoteComparable && titleComparable) {
      const shorter = Math.min(quoteComparable.length, titleComparable.length);
      const longer = Math.max(quoteComparable.length, titleComparable.length);
      const mostlySame = shorter > 10 && longer > 0 && shorter / longer >= 0.8;
      if (
        quoteComparable === titleComparable ||
        (mostlySame && (quoteComparable.includes(titleComparable) || titleComparable.includes(quoteComparable)))
      ) {
        continue;
      }
    }
    return value;
  }
  return "";
};

const escapeRegExp = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const lower = (value = "") => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

const normalizeLang = (value = "") => {
  const lang = String(value || "").trim().toUpperCase();
  if (LANGS.includes(lang)) return lang;
  return "EN";
};

const parseDateForSort = (value = "") => {
  const ts = Date.parse(String(value || ""));
  return Number.isNaN(ts) ? 0 : ts;
};

const sortEntriesByDateDesc = (a, b) => {
  const delta = parseDateForSort(b?.item?.date) - parseDateForSort(a?.item?.date);
  if (delta !== 0) return delta;
  return String(a?.item?.id || "").localeCompare(String(b?.item?.id || ""));
};

const sortHreflangAlternates = (items) =>
  items
    .slice()
    .sort((a, b) => {
      const aPos = HREFLANG_ORDER.indexOf(a.hreflang);
      const bPos = HREFLANG_ORDER.indexOf(b.hreflang);
      return (aPos === -1 ? 99 : aPos) - (bPos === -1 ? 99 : bPos);
    });

const buildContentTranslationMaps = (items = []) => {
  const idToCluster = new Map();
  const idToContentId = new Map();
  const contentIdToCluster = new Map();
  const claimedIds = new Set();

  const assignCluster = (contentId, rawCluster = {}) => {
    const normalizedCluster = {};
    for (const [rawLang, rawId] of Object.entries(rawCluster || {})) {
      const lang = normalizeLang(rawLang);
      const id = String(rawId || "").trim();
      if (!id) continue;
      if (!normalizedCluster[lang]) normalizedCluster[lang] = id;
    }

    const clusterIds = Object.values(normalizedCluster).filter(Boolean);
    if (clusterIds.length === 0) return;

    const stableContentId = String(contentId || "").trim() || `content:${clusterIds.slice().sort()[0]}`;
    contentIdToCluster.set(stableContentId, normalizedCluster);
    for (const id of clusterIds) {
      idToCluster.set(id, normalizedCluster);
      idToContentId.set(id, stableContentId);
      claimedIds.add(id);
    }
  };

  for (const item of items) {
    const itemId = String(item?.id || "").trim();
    if (!itemId || claimedIds.has(itemId)) continue;

    const cluster = { [normalizeLang(item?.language)]: itemId };
    for (const [rawLang, rawId] of Object.entries(item?.copies || {})) {
      const lang = normalizeLang(rawLang);
      const id = String(rawId || "").trim();
      if (!id) continue;
      cluster[lang] = id;
    }
    if (Object.keys(cluster).length > 1 || Object.keys(item?.copies || {}).length > 0) {
      const preferredClusterId = String(cluster.EN || itemId || "").trim();
      assignCluster(`content:${preferredClusterId}`, cluster);
    }
  }

  const registryGroups = new Map();
  for (const item of items) {
    const id = String(item?.id || "").trim();
    const registryId = String(item?.registry_id ?? "").trim();
    if (!id || !registryId || claimedIds.has(id)) continue;
    if (!registryGroups.has(registryId)) registryGroups.set(registryId, {});
    const group = registryGroups.get(registryId);
    const lang = normalizeLang(item?.language);
    if (!group[lang]) group[lang] = id;
  }

  for (const [registryId, cluster] of registryGroups.entries()) {
    assignCluster(`registry:${registryId}`, cluster);
  }

  for (const item of items) {
    const id = String(item?.id || "").trim();
    if (!id || claimedIds.has(id)) continue;
    assignCluster(`content:${id}`, { [normalizeLang(item?.language)]: id });
  }

  return { idToCluster, idToContentId, contentIdToCluster };
};

const buildLanguageClusters = (items) => buildContentTranslationMaps(items).idToCluster;

const languagePriorityRank = (lang = "") => {
  const normalized = normalizeLang(lang);
  const idx = LANGUAGE_PRIORITY.indexOf(normalized);
  return idx === -1 ? 99 : idx;
};

const buildEntryGroupKey = (entry, idToCluster) => {
  const item = entry?.item || {};
  const itemId = String(item?.id || "").trim();
  const cluster = idToCluster?.get(itemId);
  if (cluster) {
    const clusterIds = Object.values(cluster)
      .map((id) => String(id || "").trim())
      .filter(Boolean)
      .sort();
    if (clusterIds.length > 0) return `cluster:${clusterIds.join("|")}`;
  }

  const registry = String(item?.registry_id || "").trim();
  if (registry) return `registry:${registry}`;

  const sourceUrl = normalizeSourceUrl(item?.url || "");
  if (sourceUrl) return `source:${sourceUrl.toLowerCase()}`;

  return `fallback:${lower(item?.source)}|${String(item?.date || "").trim()}|${lower(item?.title)}`;
};

const pickGroupRepresentative = (entries = []) =>
  entries
    .slice()
    .sort((a, b) => {
      const langDelta = languagePriorityRank(a?.item?.language) - languagePriorityRank(b?.item?.language);
      if (langDelta !== 0) return langDelta;
      return sortEntriesByDateDesc(a, b);
    })[0];

const groupEntriesForListing = (entries = [], idToCluster = new Map()) => {
  const buckets = new Map();
  for (const entry of entries) {
    const key = buildEntryGroupKey(entry, idToCluster);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(entry);
  }

  const groups = [];
  for (const [key, groupEntries] of buckets.entries()) {
    const representative = pickGroupRepresentative(groupEntries);
    if (!representative) continue;
    const variants = groupEntries
      .slice()
      .sort((a, b) => languagePriorityRank(a?.item?.language) - languagePriorityRank(b?.item?.language))
      .map((entry) => ({
        language: normalizeLang(entry?.item?.language),
        postPath: entry.postPath,
        id: String(entry?.item?.id || "").trim(),
      }))
      .filter((variant, idx, arr) => arr.findIndex((x) => x.language === variant.language) === idx);
    groups.push({ key, representative, entries: groupEntries, variants });
  }

  return groups.sort((a, b) => sortEntriesByDateDesc(a.representative, b.representative));
};

const getAlternatesForItem = (item, idToPostPath, idToCluster, idToStatus = new Map(), onlyPublished = false) => {
  const itemId = String(item?.id || "").trim();
  const selfLang = toHtmlLang(item?.language);
  const cluster = idToCluster.get(itemId) || { [normalizeLang(item?.language)]: itemId };
  const rawAlternates = [];

  for (const [clusterLang, clusterId] of Object.entries(cluster)) {
    if (onlyPublished) {
      const pageClass = String(idToStatus.get(clusterId) || "").toLowerCase();
      if (pageClass !== PAGE_CLASS.INDEXABLE) continue;
    }
    const postPath = idToPostPath.get(clusterId);
    if (!postPath) continue;
    rawAlternates.push({
      hreflang: toHtmlLang(clusterLang),
      href: canonicalUrl(`posts/${postPath}`),
      id: clusterId,
    });
  }

  if (!rawAlternates.some((alt) => alt.id === itemId)) {
    const selfPath = idToPostPath.get(itemId);
    if (selfPath) {
      rawAlternates.push({
        hreflang: selfLang,
        href: canonicalUrl(`posts/${selfPath}`),
        id: itemId,
      });
    }
  }

  const dedupe = new Map();
  for (const alt of rawAlternates) {
    const key = `${alt.hreflang}::${alt.href}`;
    if (!dedupe.has(key)) dedupe.set(key, alt);
  }
  const alternates = sortHreflangAlternates([...dedupe.values()]);

  const preferredXDefaultId = String(cluster.EN || itemId || "").trim();
  const preferredPath = idToPostPath.get(preferredXDefaultId) || idToPostPath.get(itemId);
  const xDefaultHref = preferredPath ? canonicalUrl(`posts/${preferredPath}`) : null;

  return { alternates, xDefaultHref };
};

const buildCardAlternatesForItem = (item, idToPostPath, idToCluster, idToStatus = new Map(), onlyPublished = false) => {
  const { alternates, xDefaultHref } = getAlternatesForItem(item, idToPostPath, idToCluster, idToStatus, onlyPublished);
  const locales = alternates.map((alt) => String(alt.hreflang || "").trim().toLowerCase()).filter(Boolean);
  return {
    alternates: alternates.map((alt) => ({
      locale: String(alt.hreflang || "").trim().toLowerCase(),
      href: alt.href,
    })),
    available_locales: [...new Set(locales)],
    x_default: xDefaultHref || "",
  };
};

const buildHeadHreflangLinks = (alternates, xDefaultHref) => {
  const out = [];
  for (const alt of alternates) {
    out.push(`<link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}" />`);
  }
  if (xDefaultHref) {
    out.push(`<link rel="alternate" hreflang="${X_DEFAULT}" href="${xDefaultHref}" />`);
  }
  return out.join("\n    ");
};

const buildCoreEntities = () => {
  const person = {
    "@type": "Person",
    "@id": PERSON_ID,
    name: PERSON_NAME,
    alternateName: PERSON_ALT_NAMES,
    url: canonicalUrl("index.html"),
    sameAs: PERSON_SAME_AS,
  };
  const organization = {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: DIGEST_NAME,
    url: canonicalUrl("index.html"),
    founder: { "@id": PERSON_ID },
  };
  const website = {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: canonicalUrl("index.html"),
    inLanguage: ["en", "fr", "de", "es"],
    publisher: { "@id": ORGANIZATION_ID },
    about: { "@id": PERSON_ID },
    hasPart: WEBSITE_HAS_PART.map((id) => ({ "@id": id })),
    potentialAction: {
      "@type": "SearchAction",
      target: `${canonicalUrl("search/index.html")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return { person, organization, website };
};

const buildBreadcrumbList = (id, items = []) => ({
  "@type": "BreadcrumbList",
  "@id": id,
  itemListElement: items.map((item, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    name: item.name,
    item: item.url,
  })),
});

const normalizeSearchUrl = (href = "") => {
  const raw = String(href || "").trim();
  if (!raw) return canonicalUrl("selected/index.html");
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return canonicalUrl(raw.slice(1));
  return canonicalUrl(raw);
};

const normalizeCardRole = (value = "") => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === CONTENT_ROLE.AUTHORED || raw === "author") return CONTENT_ROLE.AUTHORED;
  if (raw === CONTENT_ROLE.QUOTED || raw === "expert_quote") return CONTENT_ROLE.QUOTED;
  if (raw === CONTENT_ROLE.REFERENCE || raw === "mention") return CONTENT_ROLE.REFERENCE;
  return CONTENT_ROLE.REFERENCE;
};

const buildRoleBadgeSpec = (value = "") => {
  const role = normalizeCardRole(value);
  if (role === CONTENT_ROLE.AUTHORED) {
    return { role, label: "Authored", cssClass: "work-role-badge-authored" };
  }
  if (role === CONTENT_ROLE.QUOTED) {
    return { role, label: "Expert Comment", cssClass: "work-role-badge-quoted" };
  }
  return { role, label: "Reference", cssClass: "work-role-badge-reference" };
};

const buildSelectedCardHtml = (entry, idToPostPath = new Map()) => {
  const item = entry?.item || {};
  const displayTitle = htmlEscape(resolveDisplayTitle(item));
  const intro = htmlEscape(sanitizeSelectedIntro(previewSummary(item), item));
  const source = htmlEscape(normalizeText(item?.source || "-"));
  const date = htmlEscape(normalizeText(item?.date || "-"));
  const badge = buildRoleBadgeSpec(item?.role);
  const digestHref = canonicalUrl(`posts/${idToPostPath.get(item?.id) || entry?.postPath || ""}`);
  const sourceHrefRaw = normalizeSourceUrl(item?.url || "");
  const sourceLink =
    sourceHrefRaw && sourceHrefRaw !== digestHref
      ? `<a href="${htmlEscape(sourceHrefRaw)}" target="_blank" rel="noopener noreferrer">Original source</a>`
      : "";

  return `          <article class="work-card" data-role="${badge.role}" data-status="${htmlEscape(String(item?.status || CONTENT_STATUS.PUBLISHED))}" data-surface="${htmlEscape(String(item?.surface || CONTENT_SURFACE.PUBLIC))}">
            <p class="work-role"><span class="work-role-badge ${badge.cssClass}">${badge.label}</span></p>
            <h3><a class="work-title-link" href="${htmlEscape(digestHref)}">${displayTitle}</a></h3>
            <p class="work-intro">${intro}</p>
            <p class="work-meta"><strong>Publication:</strong> ${source}</p>
            <p class="work-meta"><strong>Date:</strong> ${date}</p>
            <p class="work-meta"><a href="${htmlEscape(digestHref)}">Open on-site note</a>${sourceLink ? ` · ${sourceLink}` : ""}</p>
          </article>`;
};

const buildSelectedSectionsHtml = (entries, idToPostPath = new Map()) => {
  const scoped = entries
    .filter((entry) => entry?.item?.locale === "en")
    .filter((entry) => isPublicRenderableItem(entry?.item))
    .filter((entry) => isShowcaseCandidate(entry?.item))
    .filter((entry) => !isInterviewLike(entry?.item))
    .slice()
    .sort(sortEntriesByDateDesc);

  const authoredEntries = scoped.filter((entry) => normalizeCardRole(entry?.item?.role) === CONTENT_ROLE.AUTHORED);
  const quotedEntries = scoped.filter((entry) => normalizeCardRole(entry?.item?.role) === CONTENT_ROLE.QUOTED);
  const referenceEntries = scoped.filter((entry) => normalizeCardRole(entry?.item?.role) === CONTENT_ROLE.REFERENCE);

  const grouped = new Map(SELECTED_SECTION_CONFIG.map((section) => [section.id, []]));
  for (const entry of authoredEntries) {
    const sectionId = classifySelectedSection(entry?.item);
    if (!grouped.has(sectionId)) grouped.set(sectionId, []);
    grouped.get(sectionId).push(entry);
  }

  const authoredSections = SELECTED_SECTION_CONFIG.map((section) => {
    const cards = grouped.get(section.id) || [];
    if (cards.length === 0) return "";
    const cardsHtml = cards.map((entry) => buildSelectedCardHtml(entry, idToPostPath)).join("\n\n");

    return `<section class="cluster" id="${section.id}">
        <h2>${section.title}</h2>
        <p class="cluster-intro">${section.intro}</p>
        <div class="cluster-grid">
${cardsHtml}
        </div>
      </section>`;
  }).filter(Boolean);

  const buildRoleSectionHtml = (roleKey, entriesForRole = []) => {
    if (!entriesForRole.length) return "";
    const config = SELECTED_ROLE_SECTION_CONFIG[roleKey];
    if (!config) return "";
    const cardsHtml = entriesForRole.map((entry) => buildSelectedCardHtml(entry, idToPostPath)).join("\n\n");

    return `<section class="cluster cluster-role" id="${config.id}">
        <h2>${config.title}</h2>
        <p class="cluster-intro">${config.intro}</p>
        <div class="cluster-grid">
${cardsHtml}
        </div>
      </section>`;
  };

  const sections = [
    ...authoredSections,
    buildRoleSectionHtml(CONTENT_ROLE.QUOTED, quotedEntries),
    buildRoleSectionHtml(CONTENT_ROLE.REFERENCE, referenceEntries),
  ].filter(Boolean);

  return {
    html: sections.join("\n\n"),
    itemCount: authoredEntries.length + quotedEntries.length + referenceEntries.length,
  };
};

const selectedAllEmojiCandidates = (item = {}) => {
  const source = String(item?.source || "").toLowerCase();
  const title = String(item?.title || "").toLowerCase();
  const summary = String(item?.summary || "").toLowerCase();
  const blob = `${source} ${title} ${summary}`;

  if (source.includes("bloomberg")) return ["📈", "🧮", "📊", "🌐"];
  if (source.includes("the atlantic")) return ["🌊", "🧠", "📚", "🗞️"];
  if (source.includes("guardian")) return ["🛡️", "📰", "🔎", "⚖️"];
  if (source.includes("carnegie")) return ["🏛️", "🧠", "🧭", "📖"];
  if (source.includes("global voices")) return ["🌍", "🌐", "🗣️", "📰"];
  if (source.includes("human rights watch")) return ["⚖️", "🛡️", "🔍", "🧾"];
  if (source.includes("vedomosti")) return ["📊", "📰", "🧩", "🧠"];
  if (source.includes("the moscow times")) return ["🗞️", "🧭", "📌", "🧾"];
  if (source.includes("the insider")) return ["🔬", "🧠", "📝", "📰"];
  if (/\bprotest|activis|civil\b/.test(blob)) return ["✊", "🗳️", "📣", "🧭"];
  if (/\bmedia|journal|editor|press\b/.test(blob)) return ["📰", "🗞️", "🧠", "🧾"];
  if (/\bpropaganda|disinformation|troll|bot\b/.test(blob)) return ["🧲", "🧠", "🔎", "🛰️"];
  return ["🧭", "📖", "🔎", "📰"];
};

const buildSelectedAllEmojiMap = (items = []) => {
  const byId = new Map();
  const used = new Set();

  for (const [index, item] of items.entries()) {
    const key = String(item?.id || item?.url || item?.title || `selected-${index}`);
    const candidates = [...selectedAllEmojiCandidates(item), ...SELECTED_ALL_EMOJI_POOL];
    const picked = candidates.find((emoji) => emoji && !used.has(emoji));
    if (!picked) continue;
    byId.set(key, picked);
    used.add(picked);
  }

  return byId;
};

const buildSelectedAllDefaultState = (entries, idToPostPath = new Map()) => {
  const items = entries
    .filter((entry) => normalizeLang(entry?.item?.language) === "EN")
    .filter((entry) => isPublicRenderableItem(entry?.item))
    .filter((entry) => normalizeCardRole(entry?.item?.role) === CONTENT_ROLE.AUTHORED)
    .filter((entry) => isShowcaseCandidate(entry?.item))
    .filter((entry) => !isInterviewLike(entry?.item))
    .slice()
    .sort(sortEntriesByDateDesc)
    .map((entry) => {
      const item = entry?.item || {};
      const id = String(item?.id || "").trim() || entry.postPath.replace(/\.html$/i, "");
      const url = canonicalUrl(`posts/${idToPostPath.get(id) || entry.postPath}`);
      const sourceUrl = normalizeSourceUrl(item?.url || "");
      return {
        id,
        date: normalizeText(item?.date || ""),
        source: normalizeText(item?.source || ""),
        role: CONTENT_ROLE.AUTHORED,
        title: resolveDisplayTitle(item),
        summary: sanitizeSelectedIntro(previewSummary(item), item),
        url,
        sourceUrl,
      };
    });

  const emojiById = buildSelectedAllEmojiMap(items);
  const cardsHtml = items
    .map((item) => {
      const key = String(item?.id || item?.url || item?.title || "");
      const emoji = emojiById.get(key);
      const sourceLink =
        item.sourceUrl && item.sourceUrl !== item.url
          ? ` · <a href="${htmlEscape(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Original source</a>`
          : "";

      return `          <article class="selected-all-card" data-role="authored">
            <p class="selected-all-meta">${htmlEscape(`${item.date || "-"} · Text · ${item.source || "Source"}`)}</p>
            <p class="selected-all-role"><span class="role-badge role-badge-authored">Authored</span></p>
            <h3><a href="${htmlEscape(item.url)}">${htmlEscape(`${emoji ? `${emoji} ` : ""}${item.title || "Untitled"}`)}</a></h3>
            <p class="selected-all-summary">${htmlEscape(item.summary || "No summary available.")}</p>
            <p class="selected-all-cta"><a href="${htmlEscape(item.url)}">Open on-site note</a>${sourceLink}</p>
          </article>`;
    })
    .join("\n");

  return {
    countText: `${items.length} shown · Authored`,
    gridHtml: cardsHtml,
  };
};

const updateSelectedWorkPage = async (entries, idToPostPath = new Map()) => {
  let html;
  try {
    html = await fs.readFile(selectedPagePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  const { html: sectionsHtml, itemCount } = buildSelectedSectionsHtml(entries, idToPostPath);
  const blockRe =
    /<section class="cluster" id="[^"]+">[\s\S]*?(?=\s*<section class="selected-contact")/m;
  if (!blockRe.test(html)) {
    throw new Error(`Unable to locate Selected Work cluster block in ${selectedPagePath}`);
  }

  let next = html.replace(blockRe, `${sectionsHtml}\n`);
  next = next.replace(/\n{3,}(?=\s*<section class="selected-contact")/m, "\n\n");
  next = next.replace(
    /("description":\s*")Manually curated route through key materials by Ilia Klishin\.(")/,
    '$1Section-based index of published articles, interviews, and format-grouped materials by Ilia Klishin.$2'
  );
  next = next.replace(
    /("description":\s*")Section-based index of published articles by Ilia Klishin, excluding interview materials\.(")/,
    '$1Section-based index of published articles, interviews, and format-grouped materials by Ilia Klishin.$2'
  );
  next = next.replace(/("numberOfItems":\s*)\d+/, `$1${itemCount}`);
  next = next.replace(
    /<p>\s*Start here if you want the clearest sense of my work\.\s*<\/p>/,
    `<p>Browse the full published corpus by section and by format in one place.</p>`
  );
  next = next.replace(
    /<p>\s*Browse all published article cards by section\. Interview materials are kept in the separate Interviews page\.\s*<\/p>/,
    `<p>Browse the full published corpus by section and by format in one place.</p>`
  );
  const selectedAllState = buildSelectedAllDefaultState(entries, idToPostPath);
  next = next.replace(
    /<p class="selected-all-count" id="selectedAllCount">[\s\S]*?<\/p>/m,
    `<p class="selected-all-count" id="selectedAllCount">${htmlEscape(selectedAllState.countText)}</p>`
  );
  next = replaceMarkedBlock(next, SELECTED_ALL_GRID_START, SELECTED_ALL_GRID_END, selectedAllState.gridHtml);

  if (next !== html) {
    await fs.writeFile(selectedPagePath, next, "utf8");
  }
};

const buildInterviewStructuredData = (canonical, locale, items = []) => {
  const itemListId = `${canonical}#itemlist`;
  const config = INTERVIEWS_PAGE_CONFIG[locale] || INTERVIEWS_PAGE_CONFIG.en;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: config.structuredListName,
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: items.length,
        isPartOf: { "@id": WEBSITE_ID },
        about: { "@id": PERSON_ID },
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "Article",
            "@id": `${canonical}#interview-${index + 1}`,
            headline: item.title,
            inLanguage: locale,
            datePublished: item.isoDate || undefined,
            url: item.url,
            description: item.description,
            author: { "@id": PERSON_ID },
            publisher: {
              "@type": "Organization",
              name: item.outlet,
            },
            isBasedOn: item.url,
          },
        })),
      },
    ],
  };
};

const buildInterviewCardHtml = (item, locale, ctaLabel) => {
  const dataFormatTags = item.formatTokens.join(" ");
  return `          <article class="interview-card" data-section="${htmlEscape(item.section)}" data-format-tags="${htmlEscape(dataFormatTags)}" data-status="${htmlEscape(String(item?.status || CONTENT_STATUS.PUBLISHED))}" data-surface="${htmlEscape(String(item?.surface || CONTENT_SURFACE.PUBLIC))}" lang="${htmlEscape(locale)}" itemscope itemtype="http://schema.org/Article">
            <meta itemprop="inLanguage" content="${htmlEscape(locale)}" />
            <p class="interview-meta">
              <span class="chip chip-source"><span itemprop="publisher">${htmlEscape(item.outlet)}</span></span>
              <time class="chip chip-date" itemprop="datePublished" datetime="${htmlEscape(item.isoDate)}">${htmlEscape(item.displayDate)}</time>
              <span class="chip chip-lang">${htmlEscape(item.languageLabel)}</span>
              <span class="chip chip-format">${htmlEscape(item.formatLabel)}</span>
            </p>
            <h3 class="interview-title" itemprop="headline">
              <a class="interview-title-link" href="${htmlEscape(item.url)}" target="_blank" rel="noopener noreferrer" itemprop="url">${htmlEscape(item.emoji)} ${htmlEscape(item.title)}</a>
            </h3>
            <p class="interview-description" itemprop="description">${htmlEscape(item.description)}</p>
            <p class="interview-url-wrap">
              <a class="interview-url" href="${htmlEscape(item.url)}" target="_blank" rel="noopener noreferrer">${htmlEscape(item.url)}</a>
            </p>
            <p class="interview-open-wrap">
              <a class="interview-open" href="${htmlEscape(item.url)}" target="_blank" rel="noopener noreferrer">${htmlEscape(ctaLabel)}</a>
            </p>
          </article>`;
};

const buildInterviewsMainHtml = (locale, items = []) => {
  const config = INTERVIEWS_PAGE_CONFIG[locale] || INTERVIEWS_PAGE_CONFIG.en;
  const sectionsHtml = INTERVIEW_SECTION_ORDER
    .map((sectionKey) => {
      const sectionItems = items.filter((item) => item.section === sectionKey);
      if (!sectionItems.length) return "";
      const sectionConfig = config.sections[sectionKey];
      const cardsHtml = sectionItems.map((item) => buildInterviewCardHtml(item, locale, config.cta)).join("\n");
      return `      <section class="interviews-section" id="interviews-section-${sectionKey}" aria-labelledby="${htmlEscape(sectionConfig.id)}">
        <div class="section-head">
          <h2 id="${htmlEscape(sectionConfig.id)}">${htmlEscape(sectionConfig.title)}</h2>
          <p>${htmlEscape(sectionConfig.intro)}</p>
        </div>
        <div class="interviews-grid" data-section="${htmlEscape(sectionKey)}">
${cardsHtml}
        </div>
      </section>`;
    })
    .filter(Boolean)
    .join("\n\n");

  const structuredData = buildInterviewStructuredData(
    canonicalUrl(locale === "en" ? "interviews/index.html" : `interviews/${locale}/index.html`),
    locale,
    items
  );
  const structuredDataJson = JSON.stringify(structuredData).replace(/</g, "\\u003c");

  return `    <main class="page interviews-page">
      <section class="interviews-hero">
        <p class="eyebrow">${htmlEscape(config.eyebrow)}</p>
        <h1>${htmlEscape(config.title)}</h1>
        <p>${htmlEscape(config.intro)}</p>
      </section>

      <section class="interviews-filters" aria-label="${htmlEscape(config.filtersAria)}">
        <div class="filter-group" role="group" aria-label="${htmlEscape(config.filterGroupAria)}">
          <button class="filter-btn active" type="button" data-format="all" aria-pressed="true">${htmlEscape(config.filters.all)}</button>
          <button class="filter-btn" type="button" data-format="text" aria-pressed="false">${htmlEscape(config.filters.text)}</button>
          <button class="filter-btn" type="button" data-format="video" aria-pressed="false">${htmlEscape(config.filters.video)}</button>
          <button class="filter-btn" type="button" data-format="podcasts" aria-pressed="false">${htmlEscape(config.filters.podcasts)}</button>
        </div>
      </section>

${sectionsHtml}
      <script type="application/ld+json">${structuredDataJson}</script>
    </main>`;
};

const buildPreparedInterviewItems = (locale = "en", brokenSourceUrls = new Set()) => {
  const localizedLocale = ["en", "fr", "de", "es"].includes(locale) ? locale : "en";
  const prepared = interviewsData
    .filter((item) => {
      const sourceUrl = normalizeSourceUrl(item?.url || "");
      if (!sourceUrl) return true;
      return !brokenSourceUrls.has(sourceUrl);
    })
    .map((item) => {
      const localized = localizeInterviewItem(item, localizedLocale);
      const normalized = normalizeContentItem(
        {
          ...item,
          status: item?.status || CONTENT_STATUS.PUBLISHED,
          role: item?.role || CONTENT_ROLE.QUOTED,
          surface: item?.surface || (String(item?.section || "").trim().toLowerCase() === "archive" ? CONTENT_SURFACE.ARCHIVE : CONTENT_SURFACE.PUBLIC),
        },
        { locale: localizedLocale }
      );
      return {
        ...localized,
        status: normalized.status,
        surface: normalized.surface,
        role: normalized.role,
        locale: normalized.locale,
        language: localizedLocale.toUpperCase(),
        outlet: inferInterviewOutlet(item?.url || ""),
        isoDate: normalizeInterviewIsoDate(item?.date || ""),
        displayDate: formatInterviewDisplayDate(item?.date || "", localizedLocale),
        formatTokens: normalizeInterviewFormatTokens(item?.format || ""),
        ts: parseInterviewTimestamp(item?.date || ""),
      };
    })
    .sort((a, b) => {
      if (b.ts !== a.ts) return b.ts - a.ts;
      return String(a.title || "").localeCompare(String(b.title || ""), localizedLocale);
    });

  const used = new Set();
  prepared.forEach((item, index) => {
    const emoji = pickUniqueInterviewEmoji(interviewEmojiCandidates(item), used, index);
    used.add(emoji);
    item.emoji = emoji;
  });

  return prepared;
};

const updateInterviewPages = async (sourceUrlHealth = { brokenUrls: new Set() }) => {
  for (const [locale, config] of Object.entries(INTERVIEWS_PAGE_CONFIG)) {
    let html;
    try {
      html = await fs.readFile(config.path, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    const preparedItems = buildPreparedInterviewItems(locale, sourceUrlHealth.brokenUrls || new Set()).filter((item) =>
      isPublicRenderableItem(item)
    );
    const nextMain = buildInterviewsMainHtml(locale, preparedItems);
    let next = html.replace(/<main class="page interviews-page">[\s\S]*?<\/main>/m, nextMain);
    next = next.replace(/\s*<template id="interviewCardTemplate">[\s\S]*?<\/template>\s*/m, "\n\n");

    if (next !== html) {
      await fs.writeFile(config.path, next, "utf8");
    }
  }
};

const extractSelectedCards = async () => {
  let html;
  try {
    html = await fs.readFile(selectedPagePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const sections = [...html.matchAll(/<section class="cluster" id="([^"]+)">([\s\S]*?)<\/section>/gim)];
  const cards = [];

  for (const sectionMatch of sections) {
    const sectionId = String(sectionMatch[1] || "").trim();
    const sectionHtml = String(sectionMatch[2] || "");
    const sectionTitle = htmlToText(sectionHtml.match(/<h2>([\s\S]*?)<\/h2>/i)?.[1] || sectionId);
    const sectionIntro = htmlToText(sectionHtml.match(/<p class="cluster-intro">([\s\S]*?)<\/p>/i)?.[1] || "");

    const cardMatches = [...sectionHtml.matchAll(/<article class="work-card"([^>]*)>([\s\S]*?)<\/article>/gim)];
    for (const cardMatch of cardMatches) {
      const cardAttrs = String(cardMatch[1] || "");
      const cardHtml = String(cardMatch[2] || "");
      const title = htmlToText(cardHtml.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1] || "");
      if (!title) continue;

      const role = normalizeCardRole(cardAttrs.match(/\bdata-role="([^"]+)"/i)?.[1] || "");
      const status = String(cardAttrs.match(/\bdata-status="([^"]+)"/i)?.[1] || CONTENT_STATUS.PUBLISHED).trim().toLowerCase();
      const surface = String(cardAttrs.match(/\bdata-surface="([^"]+)"/i)?.[1] || CONTENT_SURFACE.PUBLIC).trim().toLowerCase();
      const intro = htmlToText(cardHtml.match(/<p class="work-intro">([\s\S]*?)<\/p>/i)?.[1] || "");
      const whyRaw = htmlToText(cardHtml.match(/<p class="work-why">([\s\S]*?)<\/p>/i)?.[1] || "");
      const why = whyRaw.replace(/^Why this matters:\s*/i, "").trim();
      const type = htmlToText(cardHtml.match(/<li><strong>Type:<\/strong>\s*([\s\S]*?)<\/li>/i)?.[1] || "");
      const date =
        htmlToText(cardHtml.match(/<li><strong>Date:<\/strong>\s*([\s\S]*?)<\/li>/i)?.[1] || "") ||
        htmlToText(cardHtml.match(/<p class="work-meta"><strong>Date:<\/strong>\s*([\s\S]*?)<\/p>/i)?.[1] || "");

      const linkCandidates = [...cardHtml.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)].map((m) => String(m[1] || "").trim());
      const digestLink = linkCandidates.find((href) => href.startsWith("/posts/"));
      const preferredLink = digestLink || linkCandidates[0] || `/selected/#${sectionId}`;
      const originalLink = linkCandidates.find((href) => /^https?:\/\//i.test(href)) || "";

      cards.push({
        id: `selected-${sectionId}-${cards.length + 1}`,
        type: "selected",
        language: "EN",
        locale: "en",
        status,
        surface,
        role,
        title,
        summary: intro,
        context: why,
        topic: sectionTitle,
        source: "Selected Work",
        date: date || "",
        material_type: type || "Curated card",
        section: sectionTitle,
        section_intro: sectionIntro,
        url: normalizeSearchUrl(preferredLink),
        source_url: normalizeSearchUrl(originalLink || preferredLink),
      });
    }
  }

  return cards;
};

const buildSearchPostCardsForLocale = (
  locale,
  entries,
  idToCluster = new Map(),
  idToContentId = new Map(),
  idToPostPath = new Map(),
  idToStatus = new Map()
) => {
  const publishedGroups = groupEntriesForListing(
    entries
      .filter((entry) => isRenderableOnLocale(entry?.item, locale))
      .filter((entry) => isShowcaseCandidate(entry?.item)),
    idToCluster
  );

  return publishedGroups.map((group) => {
    const entry = group.representative;
    const item = entry?.item || {};
    const translationMeta = buildCardAlternatesForItem(item, idToPostPath, idToCluster, idToStatus, false);
    return {
      id: String(item.id || "").trim() || entry.postPath.replace(/\.html$/i, ""),
      content_id: idToContentId.get(String(item.id || "").trim()) || `content:${String(item.id || "").trim()}`,
      type: "post",
      language: normalizeLang(item.language),
      locale: item.locale || toHtmlLang(item.language),
      status: item.status || CONTENT_STATUS.PUBLISHED,
      surface: item.surface || CONTENT_SURFACE.PUBLIC,
      role: item.role || CONTENT_ROLE.AUTHORED,
      alternates: translationMeta.alternates,
      available_locales: translationMeta.available_locales,
      x_default: translationMeta.x_default,
      title: resolveDisplayTitle(item),
      summary: previewSummary(item),
      context: previewContext(item),
      topic: normalizeText(item.topic || ""),
      source: normalizeText(item.source || ""),
      date: normalizeText(item.date || ""),
      display_date: normalizeText(item.date || ""),
      material_type: "Digest card",
      url: canonicalUrl(`posts/${entry.postPath}`),
      source_url: normalizeSourceUrl(item.url),
      semantic_tags: sanitizeSemanticTags(normalizedArray(item.semantic_tags)),
    };
  });
};

const buildSearchSelectedCardsForLocale = (locale, selectedCards = []) =>
  (Array.isArray(selectedCards) ? selectedCards : []).filter((item) => isRenderableOnLocale(item, locale));

const buildSearchInterviewCardsForLocale = (locale, sourceUrlHealth = { brokenUrls: new Set() }) => {
  const localizedConfig = INTERVIEWS_PAGE_CONFIG[locale] || INTERVIEWS_PAGE_CONFIG.en;
  return buildPreparedInterviewItems(locale, sourceUrlHealth.brokenUrls || new Set())
    .filter((item) => isPublicRenderableItem(item))
    .map((item, index) => ({
      id: `interview-${locale}-${index + 1}`,
      content_id: `interview:${crypto
        .createHash("sha1")
        .update(normalizeText(item.url || item.title || `${locale}-${index + 1}`))
        .digest("hex")
        .slice(0, 16)}`,
      type: "interview",
      language: normalizeLang(item.language),
      locale: item.locale || locale,
      status: item.status || CONTENT_STATUS.PUBLISHED,
      surface: item.surface || CONTENT_SURFACE.PUBLIC,
      role: item.role || CONTENT_ROLE.QUOTED,
      title: item.title,
      summary: item.description,
      context: "",
      topic: normalizeText(localizedConfig?.sections?.[item.section]?.title || item.sectionLabel || item.section || ""),
      source: normalizeText(item.outlet || ""),
      date: normalizeText(item.isoDate || ""),
      display_date: normalizeText(item.displayDate || item.isoDate || ""),
      material_type: normalizeText(item.formatLabel || item.format || "Interview"),
      url: normalizeSearchUrl(item.url),
      source_url: normalizeSourceUrl(item.url),
      semantic_tags: sanitizeSemanticTags([...normalizedArray(item.formatTokens), normalizeText(item.section || "")]),
    }));
};

const sortSearchIndexItems = (items = []) =>
  items.slice().sort((a, b) => {
    const dateDelta = Date.parse(String(b?.date || "")) - Date.parse(String(a?.date || ""));
    if (!Number.isNaN(dateDelta) && dateDelta !== 0) return dateDelta;
    return normalizeText(a?.id).localeCompare(normalizeText(b?.id));
  });

const buildSearchIndexForLocale = (
  locale,
  entries,
  selectedCards,
  sourceUrlHealth,
  idToCluster = new Map(),
  idToContentId = new Map(),
  idToPostPath = new Map(),
  idToStatus = new Map()
) => {
  const posts = buildSearchPostCardsForLocale(locale, entries, idToCluster, idToContentId, idToPostPath, idToStatus);
  const selected = buildSearchSelectedCardsForLocale(locale, selectedCards);
  const interviews = buildSearchInterviewCardsForLocale(locale, sourceUrlHealth);
  const items = sortSearchIndexItems([...posts, ...selected, ...interviews]);
  const generatedAt = latestIso(
    items.map((item) => item.date || item.display_date || "").filter(Boolean),
    latestBuildIso(entries)
  );

  return {
    locale,
    generated_at: generatedAt,
    counts: {
      total: items.length,
      posts: posts.length,
      selected: selected.length,
      interviews: interviews.length,
    },
    items,
  };
};

const buildSearchIndexes = (
  entries,
  selectedCards,
  sourceUrlHealth,
  idToCluster = new Map(),
  idToContentId = new Map(),
  idToPostPath = new Map(),
  idToStatus = new Map()
) => {
  const itemsByLocale = Object.fromEntries(
    HREFLANG_ORDER.map((locale) => [
      locale,
      buildSearchIndexForLocale(
        locale,
        entries,
        selectedCards,
        sourceUrlHealth,
        idToCluster,
        idToContentId,
        idToPostPath,
        idToStatus
      ),
    ])
  );
  const locales = Object.fromEntries(
    HREFLANG_ORDER.map((locale) => [
      locale,
      {
        path: `/data/search-index-${locale}.json`,
        count: itemsByLocale[locale]?.counts?.total || 0,
        generated_at: itemsByLocale[locale]?.generated_at || latestBuildIso(entries),
      },
    ])
  );
  const counts = Object.fromEntries(HREFLANG_ORDER.map((locale) => [locale, Number(locales[locale]?.count || 0)]));
  const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  const generatedAt = latestIso(
    HREFLANG_ORDER.map((locale) => locales[locale]?.generated_at).filter(Boolean),
    latestBuildIso(entries)
  );

  return {
    generated_at: generatedAt,
    counts: {
      total,
      locales: counts,
    },
    locales,
    itemsByLocale,
  };
};

const pickUniqueEntries = (entries, max, used) => {
  const out = [];
  for (const entry of entries) {
    const id = String(entry?.item?.id || "").trim();
    if (!id || used.has(id)) continue;
    used.add(id);
    out.push(entry);
    if (out.length >= max) break;
  }
  return out;
};

const buildPublicDigestsDataset = (
  entries = [],
  idToCluster = new Map(),
  idToContentId = new Map(),
  idToPostPath = new Map(),
  idToStatus = new Map()
) => ({
  generated_at: latestBuildIso(entries),
  counts: {
    total: entries.length,
  },
  items: entries
    .slice()
    .sort(sortEntriesByDateDesc)
    .map((entry) => {
      const item = entry?.item || {};
      const translationMeta = buildCardAlternatesForItem(item, idToPostPath, idToCluster, idToStatus, false);
      return {
        ...item,
        content_id: idToContentId.get(String(item.id || "").trim()) || `content:${String(item.id || "").trim()}`,
        language: normalizeLang(item.language),
        locale: item.locale || toHtmlLang(item.language),
        status: item.status || CONTENT_STATUS.PUBLISHED,
        surface: item.surface || CONTENT_SURFACE.PUBLIC,
        role: item.role || CONTENT_ROLE.AUTHORED,
        alternates: translationMeta.alternates,
        available_locales: translationMeta.available_locales,
        x_default: translationMeta.x_default,
        post_path: entry.postPath,
        post_url: canonicalUrl(`posts/${entry.postPath}`),
        source_url: normalizeSourceUrl(item.url || ""),
      };
    }),
});

const buildPublicInterviewsDataset = (sourceUrlHealth = { brokenUrls: new Set() }) => {
  const items = HREFLANG_ORDER.flatMap((locale) =>
    buildPreparedInterviewItems(locale, sourceUrlHealth.brokenUrls || new Set()).filter((item) => isPublicRenderableItem(item))
  );
  return {
    generated_at: latestIso(items.map((item) => item.isoDate).filter(Boolean), new Date().toISOString()),
    counts: {
      total: items.length,
    },
    items,
  };
};

const buildRelatedPostGroups = (item, entries) => {
  const itemId = String(item?.id || "").trim();
  const itemLang = normalizeLang(item?.language);
  const itemTopic = lower(item?.topic);
  const itemSource = lower(item?.source);
  const itemYear = extractYear(item?.date);
  const itemSectionId = classifySelectedSection(item);

  const candidates = entries.filter(
    (entry) => String(entry?.item?.id || "").trim() !== itemId && isShowcaseCandidate(entry?.item)
  );
  const sameLang = candidates
    .filter((entry) => normalizeLang(entry?.item?.language) === itemLang)
    .sort(sortEntriesByDateDesc);

  const sameTopicLang = sameLang.filter((entry) => lower(entry?.item?.topic) === itemTopic);
  const sameTopicAny = candidates
    .filter((entry) => lower(entry?.item?.topic) === itemTopic)
    .sort(sortEntriesByDateDesc);

  const sameSourceLang = sameLang.filter((entry) => lower(entry?.item?.source) === itemSource);
  const sameSourceAny = candidates
    .filter((entry) => lower(entry?.item?.source) === itemSource)
    .sort(sortEntriesByDateDesc);

  const sameSectionLang = sameLang.filter((entry) => classifySelectedSection(entry?.item) === itemSectionId);
  const sameSectionAny = candidates
    .filter((entry) => classifySelectedSection(entry?.item) === itemSectionId)
    .sort(sortEntriesByDateDesc);

  const sameYearLang =
    itemYear.length === 4
      ? sameLang.filter((entry) => extractYear(entry?.item?.date) === itemYear)
      : [];
  const sameYearAny =
    itemYear.length === 4
      ? candidates.filter((entry) => extractYear(entry?.item?.date) === itemYear).sort(sortEntriesByDateDesc)
      : [];

  const latestAcrossArchive = candidates.slice().sort(sortEntriesByDateDesc);

  const used = new Set();
  const relatedByTopic = [
    ...pickUniqueEntries(sameTopicLang, 4, used),
    ...pickUniqueEntries(sameTopicAny, 4, used),
  ].slice(0, 4);

  const relatedBySource = [
    ...pickUniqueEntries(sameSourceLang, 4, used),
    ...pickUniqueEntries(sameSourceAny, 4, used),
  ].slice(0, 4);

  const relatedBySection = [
    ...pickUniqueEntries(sameSectionLang, 4, used),
    ...pickUniqueEntries(sameSectionAny, 4, used),
  ].slice(0, 4);

  const relatedByYear = [
    ...pickUniqueEntries(sameYearLang, 4, used),
    ...pickUniqueEntries(sameYearAny, 4, used),
  ].slice(0, 4);

  const languageTimeline = entries
    .filter((entry) => isShowcaseCandidate(entry?.item))
    .filter((entry) => normalizeLang(entry?.item?.language) === itemLang)
    .sort(sortEntriesByDateDesc);
  const languageTimelineIndex = languageTimeline.findIndex(
    (entry) => String(entry?.item?.id || "").trim() === itemId
  );
  const newerInLanguage = languageTimelineIndex > 0 ? languageTimeline[languageTimelineIndex - 1] : null;
  const olderInLanguage =
    languageTimelineIndex > -1 && languageTimelineIndex < languageTimeline.length - 1
      ? languageTimeline[languageTimelineIndex + 1]
      : null;

  const sourceTimeline = itemSource
    ? entries
        .filter((entry) => isShowcaseCandidate(entry?.item))
        .filter((entry) => lower(entry?.item?.source) === itemSource)
        .sort(sortEntriesByDateDesc)
    : [];
  const sourceTimelineIndex = sourceTimeline.findIndex(
    (entry) => String(entry?.item?.id || "").trim() === itemId
  );
  const newerFromSource = sourceTimelineIndex > 0 ? sourceTimeline[sourceTimelineIndex - 1] : null;
  const olderFromSource =
    sourceTimelineIndex > -1 && sourceTimelineIndex < sourceTimeline.length - 1
      ? sourceTimeline[sourceTimelineIndex + 1]
      : null;

  const latestSameLanguage = pickUniqueEntries(sameLang, 4, used);
  const latestAcrossSite = pickUniqueEntries(latestAcrossArchive, 4, used);

  return {
    relatedByTopic,
    relatedBySource,
    relatedBySection,
    relatedByYear,
    newerInLanguage,
    olderInLanguage,
    newerFromSource,
    olderFromSource,
    latestSameLanguage,
    latestAcrossSite,
  };
};

const buildRelatedLinks = (entries) =>
  entries.map((entry) => {
    const href = canonicalUrl(`posts/${entry.postPath}`);
    const title = htmlEscape(resolveDisplayTitle(entry?.item || {}));
    const source = htmlEscape(String(entry?.item?.source || "-"));
    const date = htmlEscape(String(entry?.item?.date || "-"));
    return `<li><a href="${href}">${title}</a> — ${source} • ${date}</li>`;
  });

const buildDirectionalRelatedLink = (label, entry) => {
  if (!entry) return "";
  const href = canonicalUrl(`posts/${entry.postPath}`);
  const title = htmlEscape(resolveDisplayTitle(entry?.item || {}));
  const source = htmlEscape(String(entry?.item?.source || "-"));
  const date = htmlEscape(String(entry?.item?.date || "-"));
  return `<li>${htmlEscape(label)}: <a href="${href}">${title}</a> — ${source} • ${date}</li>`;
};

const homeStatusRank = (value = "") => (isPublishedStatus(value) ? 0 : 1);
const HOME_PINNED_IDS = {
  EN: ["en-009", "en-141", "en-107", "en-108", "en-143", "en-002", "en-001", "en-134"],
};
const HOME_EXCLUDED_IDS = {
  EN: new Set(["en-017"]),
};
const HOME_FALLBACK_COPY = {
  en: {
    empty: "No published cards are available in the public feed yet.",
    openNote: "Open on-site note",
    originalSource: "Original source",
  },
  fr: {
    empty: "Aucune fiche publiée n’est disponible dans ce flux pour le moment.",
    openNote: "Ouvrir la fiche du site",
    originalSource: "Source originale",
  },
  de: {
    empty: "Derzeit sind in diesem Feed keine veröffentlichten Karten verfügbar.",
    openNote: "Interne Seite öffnen",
    originalSource: "Originalquelle",
  },
  es: {
    empty: "Todavía no hay fichas publicadas disponibles en este flujo.",
    openNote: "Abrir ficha del sitio",
    originalSource: "Fuente original",
  },
};
const HOME_SECTION_COPY = {
  en: {
    workTitle: "Selected articles and essays",
    workLink: "Browse all articles and media work",
    moreWork: "Further reading",
    interviewsAria: "Interviews",
    interviewsTitle: "Interviews and conversations",
    interviewsIntro: "Recent interviews, podcasts, and long-form discussions.",
    interviewsLink: "View all interviews",
    interviewsHref: "/interviews/",
    interviewOpen: "Open material ->",
  },
  fr: {
    workTitle: "Travaux sélectionnés",
    workLink: "Voir la sélection complète",
    moreWork: "Autres lectures",
    interviewsAria: "Entretiens",
    interviewsTitle: "Entretiens et conversations",
    interviewsIntro: "Entretiens récents, podcasts et conversations au long cours.",
    interviewsLink: "Voir tous les entretiens",
    interviewsHref: "/interviews/fr/",
    interviewOpen: "Voir l’entretien →",
  },
  de: {
    workTitle: "Ausgewählte Arbeiten",
    workLink: "Gesamte Auswahl ansehen",
    moreWork: "Weitere Texte",
    interviewsAria: "Interviews",
    interviewsTitle: "Interviews und Gespräche",
    interviewsIntro: "Aktuelle Interviews, Podcasts und ausführlichere Gespräche.",
    interviewsLink: "Alle Interviews ansehen",
    interviewsHref: "/interviews/de/",
    interviewOpen: "Beitrag öffnen →",
  },
  es: {
    workTitle: "Trabajo seleccionado",
    workLink: "Ver la selección completa",
    moreWork: "Más lecturas",
    interviewsAria: "Entrevistas",
    interviewsTitle: "Entrevistas y conversaciones",
    interviewsIntro: "Entrevistas recientes, podcasts y conversaciones en profundidad.",
    interviewsLink: "Ver todas las entrevistas",
    interviewsHref: "/interviews/es/",
    interviewOpen: "Ver la entrevista →",
  },
};
const HOME_FIXED_TITLE_EMOJI = {
  "en-009": "🧭",
  "en-141": "🧠",
  "en-107": "🕸️",
  "en-108": "🛰️",
  "en-143": "🏛️",
  "en-002": "🪧",
  "en-001": "📰",
  "en-134": "🧪",
};
const HOME_EMOJI_POOL = [
  "🧭",
  "📰",
  "📱",
  "🕸️",
  "🪧",
  "🛰️",
  "⚖️",
  "🎥",
  "🗞️",
  "🔍",
  "🧠",
  "🛡️",
  "🌍",
  "🧱",
  "🕊️",
  "📡",
  "🎙️",
  "📚",
  "🧪",
  "🧵",
  "🧩",
  "🔦",
  "🏛️",
  "📣",
  "🗳️",
  "🧬",
  "🧷",
  "🧨",
];
const SELECTED_ALL_EMOJI_POOL = [
  "📰",
  "🗞️",
  "📚",
  "📖",
  "🔎",
  "🧠",
  "🧭",
  "📡",
  "🛰️",
  "🧪",
  "🧩",
  "🛡️",
  "⚖️",
  "🏛️",
  "🌐",
  "✍️",
  "📝",
  "📌",
  "🧾",
  "📊",
  "📈",
  "📉",
  "🗂️",
  "📁",
  "🧵",
  "🪶",
  "🕯️",
  "⏳",
  "🔬",
  "🧬",
  "🧱",
  "⚙️",
  "🔭",
  "🧰",
  "💡",
  "🔦",
  "🌊",
  "🧊",
  "⛰️",
  "🏔️",
  "🏙️",
  "🌃",
  "🌆",
  "🕰️",
  "⏱️",
  "🧮",
  "🗳️",
  "🔐",
  "🔓",
  "🔒",
  "🧷",
  "📐",
  "📏",
  "🗺️",
  "📻",
  "🪄",
  "🪐",
  "🌙",
  "⭐",
  "✨",
  "🪙",
];

const sortEntriesForHome = (a, b) => {
  const statusDelta = homeStatusRank(a?.item?.status) - homeStatusRank(b?.item?.status);
  if (statusDelta !== 0) return statusDelta;
  return sortEntriesByDateDesc(a, b);
};

const pickHomeFallbackEntries = (entries, locale = "en", limit, brokenSourceUrls = new Set()) => {
  const targetLocale = normalizeLocale(locale, "en");
  const targetLang = normalizeLang(targetLocale);
  const published = entries
    .slice()
    .sort(sortEntriesForHome)
    .filter((entry) => isRenderableOnLocale(entry?.item, targetLocale))
    .filter((entry) => isShowcaseCandidate(entry?.item))
    .filter((entry) => normalizeCardRole(entry?.item?.role) === CONTENT_ROLE.AUTHORED)
    .filter((entry) => {
      const sourceUrl = getHomeEntrySourceHealthUrl(entry);
      if (!sourceUrl) return true;
      if (getHomeEntryNoteUrl(entry)) return true;
      return !brokenSourceUrls.has(sourceUrl);
    });
  if (!published.length) return [];

  const nativeEntries = published.filter((entry) => normalizeLang(entry?.item?.language) === targetLang);
  const fallbackEntries = published.filter((entry) => normalizeLang(entry?.item?.language) !== targetLang);
  const excludedForLang = HOME_EXCLUDED_IDS[targetLang] || new Set();
  const preferred = [...nativeEntries, ...fallbackEntries].filter(
    (entry) => !excludedForLang.has(String(entry?.item?.id || ""))
  );
  const pinnedIds = HOME_PINNED_IDS[targetLang] || [];
  if (pinnedIds.length > 0) {
    const rank = new Map(pinnedIds.map((id, index) => [id, index]));
    preferred.sort((a, b) => {
      const rankA = rank.has(String(a?.item?.id || "")) ? rank.get(String(a?.item?.id || "")) : Number.POSITIVE_INFINITY;
      const rankB = rank.has(String(b?.item?.id || "")) ? rank.get(String(b?.item?.id || "")) : Number.POSITIVE_INFINITY;
      if (rankA !== rankB) return rankA - rankB;
      return sortEntriesByDateDesc(a, b);
    });
  }
  const selected = [];
  const selectedSet = new Set();
  const perSource = new Map();
  const sourceKey = (entry) => {
    const source = String(entry?.item?.source || "").trim().toLowerCase();
    return source || `source:${String(entry?.item?.id || "")}`;
  };
  const tryAdd = (entry, perSourceCap) => {
    if (selectedSet.has(entry)) return;
    const key = sourceKey(entry);
    const count = perSource.get(key) || 0;
    if (count >= perSourceCap) return;
    selected.push(entry);
    selectedSet.add(entry);
    perSource.set(key, count + 1);
  };

  for (const entry of preferred) {
    if (selected.length >= limit) break;
    tryAdd(entry, 1);
  }
  for (const entry of preferred) {
    if (selected.length >= limit) break;
    tryAdd(entry, HOME_FALLBACK_MAX_PER_SOURCE);
  }
  for (const entry of preferred) {
    if (selected.length >= limit) break;
    tryAdd(entry, Number.POSITIVE_INFINITY);
  }

  return selected;
};

const homeEmojiCandidates = (item) => {
  const text = [
    String(item?.title || ""),
    String(item?.source || ""),
    String(item?.topic || ""),
    String(item?.summary || ""),
    String(item?.digest || ""),
  ]
    .join(" ")
    .toLowerCase();
  if (/\b(bot|troll|disinformation|interference|cyber|twitter|social media|platform)\b/.test(text)) {
    return ["🛰️", "🕸️", "📱", "🧠", "🔍"];
  }
  if (/\b(protest|election|activism|civil society|mobilization)\b/.test(text)) {
    return ["🪧", "🗳️", "📣", "🧱", "🌍"];
  }
  if (/\b(media|journalis|press|newsroom|editorial|author)\b/.test(text)) {
    return ["📰", "🗞️", "🎙️", "📡", "📚"];
  }
  if (/\b(human rights|harassment|intimidation|pressure|freedom)\b/.test(text)) {
    return ["⚖️", "🛡️", "🔦", "🏛️"];
  }
  if (/\b(video|ted|interview|podcast|talk)\b/.test(text)) {
    return ["🎥", "🎙️", "📡", "📚"];
  }
  if (/\b(war|soldier|ukraine|donbas|security)\b/.test(text)) {
    return ["🕊️", "🌍", "🧱", "🛡️"];
  }
  return ["🧩", "🧪", "🧭", "📘"];
};

const buildHomeEmojiMap = (entries) => {
  const byId = new Map();
  const used = new Set();
  for (const entry of entries || []) {
    const item = entry?.item || {};
    const id = String(item?.id || "");
    if (!id) continue;
    const fixed = HOME_FIXED_TITLE_EMOJI[id];
    if (fixed && !used.has(fixed)) {
      byId.set(id, fixed);
      used.add(fixed);
      continue;
    }
    const candidates = [...homeEmojiCandidates(item), ...HOME_EMOJI_POOL];
    const picked = candidates.find((emoji) => !used.has(emoji));
    if (!picked) continue;
    byId.set(id, picked);
    used.add(picked);
  }
  return byId;
};

const buildFeaturedDigestParagraphs = (item = {}) => {
  const raw = String(item?.summary || item?.digest || "").trim();
  if (!raw) return [];

  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((paragraph) =>
      finalizeSummaryText(collectCleanSummarySentences(item, paragraph, { maxSentences: 4 }), "")
    )
    .filter(Boolean);

  if ((item?.id || "") === "en-009") {
    const emphasis = "accurately predicted the weaponization of social media";
    for (let index = 0; index < paragraphs.length; index += 1) {
      if (!paragraphs[index].includes(emphasis)) continue;
      paragraphs[index] = paragraphs[index].replace(emphasis, `__EMPH__${emphasis}__EMPH__`);
      break;
    }
  }

  return paragraphs;
};

const buildFeaturedDigestHtml = (item = {}) => {
  const paragraphs = buildFeaturedDigestParagraphs(item);
  if (!paragraphs.length) {
    return `<p>${htmlEscape(previewSummary(item))}</p>`;
  }

  return paragraphs
    .map((paragraph) => {
      const escaped = htmlEscape(paragraph).replace(/__EMPH__(.*?)__EMPH__/g, "<strong>$1</strong>");
      return `<p>${escaped}</p>`;
    })
    .join("");
};

const buildHomeRenderedCardHtml = (entry, variant, emojiById, locale = "en", brokenSourceUrls = new Set()) => {
  const item = entry?.item || {};
  const copy = HOME_FALLBACK_COPY[normalizeLocale(locale, "en")] || HOME_FALLBACK_COPY.en;
  const lang = htmlEscape(normalizeLang(item?.language));
  const emoji = emojiById.get(String(item?.id || ""));
  const title = htmlEscape(`${emoji ? `${emoji} ` : ""}${cleanDisplayTitle(item?.title || "")}`);
  const meta = htmlEscape(composeCardMeta(item));
  const primaryUrl = getHomeEntryPrimaryUrl(entry, brokenSourceUrls);
  const sourceUrl = getHomeEntryPrimarySourceUrl(entry);
  const noteUrl = getHomeEntryNoteUrl(entry);
  // Home fallback stays source-first, but can fall back to the on-site note instead of shipping a dead source click target.
  const canNavigate = Boolean(primaryUrl);
  const showNoteCta = Boolean(noteUrl && noteUrl !== primaryUrl);
  const showSourceCta = Boolean(showNoteCta && sourceUrl && sourceUrl === primaryUrl);
  const digestHtml =
    variant === "featured"
      ? buildFeaturedDigestHtml(item)
      : `<p>${htmlEscape(previewSummary(item))}</p>`;
  const quote = variant === "featured" && item?.id !== "en-009" ? normalizeText(pickCardQuote(item)) : "";
  const articleClass = `card card-${variant}${canNavigate ? " card-clickable" : ""}`;
  const dataUrlAttr = canNavigate ? ` data-url="${htmlEscape(primaryUrl)}"` : "";
  const titleHtml = canNavigate
    ? `<a class="card-title-link" href="${htmlEscape(primaryUrl)}">${title}</a>`
    : title;
  const links = [];
  if (showNoteCta) {
    links.push(`<a class="card-link" href="${htmlEscape(noteUrl)}">${htmlEscape(copy.openNote)}</a>`);
  }
  if (showSourceCta) {
    links.push(
      `<a class="card-link-secondary" href="${htmlEscape(sourceUrl)}" target="_blank" rel="noopener noreferrer">${htmlEscape(copy.originalSource)}</a>`
    );
  }
  const ctaHtml =
    links.length > 0 ? `\n          <div class="card-links">\n            ${links.join("\n            ")}\n          </div>` : "";

  return `        <article class="${articleClass}"${dataUrlAttr}>
          <div class="card-head">
            <span class="lang-tag">${lang}</span>
          </div>
          <h3 class="card-title">${titleHtml}</h3>
          <p class="card-meta">${meta}</p>
          <div class="card-digest">${digestHtml}</div>
          <blockquote class="card-quote"${quote ? "" : " hidden"}>${quote ? htmlEscape(quote) : ""}</blockquote>
${ctaHtml}
        </article>`;
};

const buildHomeWorkSectionHtml = (entries, locale = "en", sourceUrlHealth = { brokenUrls: new Set() }) => {
  const copy = HOME_SECTION_COPY[normalizeLocale(locale, "en")] || HOME_SECTION_COPY.en;
  const brokenSourceUrls = sourceUrlHealth?.brokenUrls || new Set();
  const top = pickHomeFallbackEntries(entries, locale, HOME_FALLBACK_LIMIT, brokenSourceUrls);
  if (top.length === 0) return "";

  const featured = top.slice(0, 1);
  const supporting = top.slice(1, 3);
  const additional = top.slice(3);
  const emojiById = buildHomeEmojiMap(top);

  const featuredHtml = featured[0]
    ? buildHomeRenderedCardHtml(featured[0], "featured", emojiById, locale, brokenSourceUrls)
    : "";
  const supportingHtml = supporting.length
    ? `        <div class="supporting-stack">\n${supporting
        .map((entry) => buildHomeRenderedCardHtml(entry, "supporting", emojiById, locale, brokenSourceUrls))
        .join("\n")}\n        </div>`
    : "";
  const gridHtml = additional.length
    ? `        <div class="more-work-head" id="moreWorkHead">
          <h3>${htmlEscape(copy.moreWork)}</h3>
        </div>
        <section class="digest-grid" id="digestGrid" aria-live="polite">
${additional.map((entry) => buildHomeRenderedCardHtml(entry, "standard", emojiById, locale, brokenSourceUrls)).join("\n")}
        </section>`
    : "";

  return `      <section class="work-section" id="curated-feed" aria-labelledby="work-title">
        <div class="cards-intro">
          <div>
            <h2 id="work-title">${htmlEscape(copy.workTitle)}</h2>
          </div>
          <a class="cards-intro-link" href="/selected/">${htmlEscape(copy.workLink)}</a>
        </div>

        <section class="digest-showcase" id="digestShowcase" aria-live="polite">
${[featuredHtml, supportingHtml].filter(Boolean).join("\n")}
        </section>
${gridHtml}
      </section>`;
};

const buildHomeInterviewPreviewCardHtml = (item, locale = "en") => {
  const copy = HOME_SECTION_COPY[normalizeLocale(locale, "en")] || HOME_SECTION_COPY.en;
  return `          <article class="interview-preview-card">
            <p class="interview-preview-meta">${htmlEscape(`${item.displayDate} · ${item.languageLabel} · ${item.formatLabel}`)}</p>
            <h3 class="interview-preview-title">
              <a href="${htmlEscape(item.url)}" target="_blank" rel="noopener noreferrer">${htmlEscape(item.emoji)} ${htmlEscape(item.title)}</a>
            </h3>
            <p class="interview-preview-description">${htmlEscape(item.description)}</p>
            <a class="interview-preview-open" href="${htmlEscape(item.url)}" target="_blank" rel="noopener noreferrer">${htmlEscape(copy.interviewOpen)}</a>
          </article>`;
};

const buildHomeInterviewsPreviewSectionHtml = (locale = "en", sourceUrlHealth = { brokenUrls: new Set() }) => {
  const copy = HOME_SECTION_COPY[normalizeLocale(locale, "en")] || HOME_SECTION_COPY.en;
  const items = buildPreparedInterviewItems(locale, sourceUrlHealth?.brokenUrls || new Set())
    .filter((item) => isPublicRenderableItem(item))
    .filter((item) => item.section === "interviews" || item.section === "features")
    .slice(0, 6);

  if (!items.length) return "";

  return `      <section class="interviews-preview" aria-label="${htmlEscape(copy.interviewsAria)}">
        <div class="interviews-preview-head">
          <h2>${htmlEscape(copy.interviewsTitle)}</h2>
          <p>${htmlEscape(copy.interviewsIntro)}</p>
        </div>
        <div class="interviews-preview-grid" id="interviewsPreviewGrid">
${items.map((item) => buildHomeInterviewPreviewCardHtml(item, locale)).join("\n")}
        </div>
        <div class="interviews-preview-actions">
          <a class="cta-btn cta-primary" href="${htmlEscape(copy.interviewsHref)}">${htmlEscape(copy.interviewsLink)}</a>
        </div>
      </section>`;
};

const replaceMarkedBlock = (html, startMarker, endMarker, innerHtml = "") => {
  const re = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`, "m");
  if (!re.test(html)) {
    throw new Error(`Missing marked block ${startMarker} ... ${endMarker}`);
  }
  const body = String(innerHtml || "").trim();
  return html.replace(re, `${startMarker}\n${body ? `${body}\n` : ""}${endMarker}`);
};

const updateHomeHtmlFirstCards = async (entries, sourceUrlHealth) => {
  const homePages = [
    { path: homeIndexPath, locale: "en" },
    { path: homeFrIndexPath, locale: "fr" },
    { path: homeDeIndexPath, locale: "de" },
    { path: homeEsIndexPath, locale: "es" },
  ];

  for (const page of homePages) {
    const html = await fs.readFile(page.path, "utf8");
    let next = replaceMarkedBlock(
      html,
      HOME_WORK_SECTION_START,
      HOME_WORK_SECTION_END,
      buildHomeWorkSectionHtml(entries, page.locale, sourceUrlHealth)
    );
    next = replaceMarkedBlock(
      next,
      HOME_INTERVIEWS_SECTION_START,
      HOME_INTERVIEWS_SECTION_END,
      buildHomeInterviewsPreviewSectionHtml(page.locale, sourceUrlHealth)
    );
    await fs.writeFile(page.path, next, "utf8");
  }
};

const stripCanonicalLinks = (html = "") =>
  String(html || "").replace(
    /<link\s+[^>]*rel=["']canonical["'][^>]*href=["'][^"']*["'][^>]*\/?>|<link\s+[^>]*href=["'][^"']*["'][^>]*rel=["']canonical["'][^>]*\/?>/gi,
    ""
  );

const stripAlternateHreflangLinks = (html = "") =>
  String(html || "").replace(
    /<link\s+[^>]*rel=["']alternate["'][^>]*hreflang=["'][^"']+["'][^>]*href=["'][^"']*["'][^>]*\/?>|<link\s+[^>]*href=["'][^"']*["'][^>]*hreflang=["'][^"']+["'][^>]*rel=["']alternate["'][^>]*\/?>/gi,
    ""
  );

const appendHeadMarkup = (html = "", lines = []) => {
  const normalized = lines.map((line) => String(line || "").trim()).filter(Boolean);
  if (normalized.length === 0) return html;
  const compactHead = String(html || "").replace(/\n(?:[ \t]*\n){2,}(?=[ \t]*<\/head>)/gi, "\n");
  return compactHead.replace(/<\/head>/i, `    ${normalized.join("\n    ")}\n  </head>`);
};

const staticHreflangConfigForPath = (relativePath = "") => {
  const normalizedPath = String(relativePath || "").trim().replace(/^\/+/, "");
  for (const cluster of STATIC_HREFLANG_CLUSTERS) {
    if (Object.values(cluster.pages).includes(normalizedPath)) return cluster;
  }
  return null;
};

const buildStaticHeadHreflangLinks = (relativePath = "") => {
  const cluster = staticHreflangConfigForPath(relativePath);
  if (!cluster) return [];
  const lines = [];
  for (const hreflang of HREFLANG_ORDER) {
    const targetPath = cluster.pages?.[hreflang];
    if (!targetPath) continue;
    lines.push(`<link rel="alternate" hreflang="${hreflang}" href="${canonicalUrl(targetPath)}" />`);
  }
  if (cluster.xDefault) {
    lines.push(`<link rel="alternate" hreflang="${X_DEFAULT}" href="${canonicalUrl(cluster.xDefault)}" />`);
  }
  return lines;
};

const applyStaticHeadSeoPolicies = async () => {
  for (const [relativePath, pageClass] of STATIC_PAGE_CLASSES.entries()) {
    const fullPath = path.join(siteDir, relativePath);
    let html;
    try {
      html = await fs.readFile(fullPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    html = stripCanonicalLinks(html);
    html = stripAlternateHreflangLinks(html);
    html = appendHeadMarkup(html, [
      `<link rel="canonical" href="${htmlEscape(canonicalUrl(relativePath))}" />`,
      ...buildStaticHeadHreflangLinks(relativePath),
    ]);
    const robotsValue = robotsMetaForPageClass(pageClass);
    html = upsertMetaTag(html, "name", "robots", robotsValue);
    await fs.writeFile(fullPath, html, "utf8");
  }
};

const upsertMetaTag = (html = "", attrName = "", attrValue = "", content = "") => {
  const normalizedContent = String(content || "").trim();
  if (!normalizedContent) return html;
  const tag = `<meta ${attrName}="${attrValue}" content="${htmlEscape(normalizedContent)}" />`;
  const escapedAttr = escapeRegExpSafe(String(attrValue || ""));
  const pairRe = new RegExp(
    `<meta\\s+[^>]*${attrName}=["']${escapedAttr}["'][^>]*content=["'][^"']*["'][^>]*\\/?>|<meta\\s+[^>]*content=["'][^"']*["'][^>]*${attrName}=["']${escapedAttr}["'][^>]*\\/?>`,
    "i"
  );
  if (pairRe.test(html)) {
    return html.replace(pairRe, tag);
  }
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
};

const upsertLinkRel = (html = "", relValue = "", href = "") => {
  const normalizedHref = String(href || "").trim();
  if (!normalizedHref) return html;
  const rel = String(relValue || "").trim();
  if (!rel) return html;
  const tag = `<link rel="${htmlEscape(rel)}" href="${htmlEscape(normalizedHref)}" />`;
  const escapedRel = escapeRegExpSafe(rel);
  const relRe = new RegExp(
    `<link\\s+[^>]*rel=["']${escapedRel}["'][^>]*href=["'][^"']*["'][^>]*\\/?>|<link\\s+[^>]*href=["'][^"']*["'][^>]*rel=["']${escapedRel}["'][^>]*\\/?>`,
    "i"
  );
  if (relRe.test(html)) {
    return html.replace(relRe, tag);
  }
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
};

const STATIC_SWITCH_LANGS = ["en", "fr", "de", "es"];
const SITE_LANG_SWITCH_RE = /<(nav|div)\b([^>]*)\bclass=["']site-lang-switch["']([^>]*)>([\s\S]*?)<\/\1>/i;
const RAW_UI_HREF_PATTERNS = [
  /^\/rss\.xml$/i,
  /^\/sitemap(?:-[a-z]+)?\.xml$/i,
  /^\/source-registry-v1\.tsv$/i,
  /^\/data\/.+\.(?:json|tsv)$/i,
];
const BIO_CASE_LINK_BY_LOCALE = {
  en: '<li><a href="/cases/">Case notes and clarifications</a></li>',
  fr: '<li><a href="/cases/fr/">Notes de cas et clarifications</a></li>',
  de: '<li><a href="/cases/de/">Falldokumentation und Klarstellungen</a></li>',
  es: '<li><a href="/cases/es/">Notas de casos y aclaraciones</a></li>',
};
const STATIC_TRUST_BLOCKS = [
  { path: homeIndexPath, marker: "home", variant: "full", locale: "en" },
  { path: homeFrIndexPath, marker: "home", variant: "full", locale: "fr" },
  { path: homeDeIndexPath, marker: "home", variant: "full", locale: "de" },
  { path: homeEsIndexPath, marker: "home", variant: "full", locale: "es" },
  { path: bioIndexPath, marker: "bio", variant: "minimal", locale: "en" },
  { path: contactIndexPath, marker: "contact", variant: "minimal", locale: "en" },
];

const extractAlternateHrefMap = (html = "") => {
  const out = new Map();
  const matches = String(html || "").matchAll(
    /<link\s+[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*\/?>|<link\s+[^>]*href=["']([^"']+)["'][^>]*hreflang=["']([^"']+)["'][^>]*rel=["']alternate["'][^>]*\/?>/gi
  );
  for (const match of matches) {
    const hreflang = String(match[1] || match[4] || "")
      .trim()
      .toLowerCase();
    const href = String(match[2] || match[3] || "").trim();
    if (!hreflang || !href) continue;
    out.set(hreflang, href);
  }
  return out;
};

const toSiteRelativeHref = (href = "") => {
  const raw = String(href || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, baseUrl);
    if (url.origin !== baseUrl) return raw;
    return `${url.pathname}${url.search}${url.hash}` || "/";
  } catch {
    return raw;
  }
};

const buildSiteLanguageSwitchHtml = (html = "", fallbackRelativePath = "index.html") => {
  const match = String(html || "").match(SITE_LANG_SWITCH_RE);
  if (!match) return html;

  const tagName = String(match[1] || "div").toLowerCase();
  const rawAttrs = `${String(match[2] || "")} class="site-lang-switch"${String(match[3] || "")}`;
  const ariaLabel = rawAttrs.match(/\baria-label=["']([^"']+)["']/i)?.[1] || "Site language";
  const attrsWithoutAria = rawAttrs.replace(/\s*\baria-label=["'][^"']+["']/i, "").replace(/\s+/g, " ").trim();

  const alternates = extractAlternateHrefMap(html);
  const htmlLang = extractHtmlLang(html);
  const currentHref = extractCanonicalHref(html, fallbackRelativePath);
  if (!alternates.has(htmlLang)) alternates.set(htmlLang, currentHref);

  const links = STATIC_SWITCH_LANGS.filter((lang) => alternates.has(lang)).map((lang) => {
    const href = toSiteRelativeHref(alternates.get(lang));
    const isActive = lang === htmlLang;
    return `<a${isActive ? ` class="active"` : ""} href="${htmlEscape(href)}"${isActive ? ` aria-current="page"` : ""}>${lang.toUpperCase()}</a>`;
  });

  if (links.length === 0) return html;

  const replacement = `<${tagName}${attrsWithoutAria ? ` ${attrsWithoutAria}` : ""} aria-label="${htmlEscape(
    ariaLabel
  )}">\n        ${links.join("\n        ")}\n      </${tagName}>`;

  return html.replace(SITE_LANG_SWITCH_RE, replacement);
};

const applyStaticLanguageSwitchPolicies = async () => {
  for (const relativePath of STATIC_ENTITY_SECTIONS) {
    const fullPath = path.join(siteDir, relativePath);
    let html;
    try {
      html = await fs.readFile(fullPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    const nextHtml = buildSiteLanguageSwitchHtml(html, relativePath);
    if (nextHtml !== html) {
      await fs.writeFile(fullPath, nextHtml, "utf8");
    }
  }
};

const READER_HEADER_RE = /<header\b[^>]*class=["'][^"']*topbar[^"']*["'][^>]*>[\s\S]*?<\/header>\s*/i;
const ARCHIVE_HEADER_RE = /<header\b[^>]*class=["'][^"']*archive-header[^"']*["'][^>]*>[\s\S]*?<\/header>\s*/i;
const PRIMARY_NAV_RE = /<nav\b(?![^>]*class=["'][^"']*site-lang-switch[^"']*["'])[^>]*aria-label=["']Primary(?: navigation)?["'][^>]*>[\s\S]*?<\/nav>\s*/i;
const FOOTER_RE =
  /<footer\b[^>]*class=["'][^"']*(?:footer|secondary-nav|selected-secondary|archive-footer)[^"']*["'][^>]*>[\s\S]*?<\/footer>\s*/i;
const FOOTER_UTILITY_RE = /<details\b[^>]*class=["'][^"']*footer-utility[^"']*["'][^>]*>[\s\S]*?<\/details>\s*/gi;
const ARCHIVE_LAYOUT_STYLE_RE = /<style id=["']archive-layout-styles["'][^>]*>[\s\S]*?<\/style>\s*/i;

const appendBodyClass = (html = "", className = "") =>
  String(html || "").replace(/<body\b([^>]*)>/i, (match, attrs) => {
    const classMatch = String(attrs || "").match(/\bclass=["']([^"']*)["']/i);
    if (!classMatch) return `<body${attrs || ""} class="${className}">`;
    const existing = new Set(
      String(classMatch[1] || "")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
    );
    existing.add(className);
    return match.replace(classMatch[0], `class="${Array.from(existing).join(" ")}"`);
  });

const insertAfterBodyLead = (html = "", markup = "") => {
  const ornamentRe = /(<body\b[^>]*>\s*(?:<div\b[^>]*class=["'][^"']*bg-ornament[^"']*["'][^>]*><\/div>\s*)?)/i;
  if (ornamentRe.test(html)) {
    return html.replace(ornamentRe, `$1${markup}\n`);
  }
  return html.replace(/<body\b[^>]*>/i, (match) => `${match}\n${markup}\n`);
};

const appendFooterBeforeBodyClose = (html = "", markup = "") => {
  const source = String(html || "");
  const bodyOpenMatch = source.match(/<body\b[^>]*>/i);
  const bodyCloseIndex = source.toLowerCase().lastIndexOf("</body>");
  if (!bodyOpenMatch || bodyCloseIndex === -1) return source;
  const bodyOpenEnd = (bodyOpenMatch.index || 0) + bodyOpenMatch[0].length;
  const beforeBodyContent = source.slice(0, bodyOpenEnd);
  const bodyInner = source.slice(bodyOpenEnd, bodyCloseIndex);
  const afterClose = source.slice(bodyCloseIndex);
  const trailingScriptsMatch = bodyInner.match(/((?:\s*<script\b[\s\S]*?<\/script>\s*)+)$/i);
  if (trailingScriptsMatch) {
    const scripts = trailingScriptsMatch[1];
    const bodyContentWithoutScripts = bodyInner.slice(0, bodyInner.length - scripts.length);
    return `${beforeBodyContent}${bodyContentWithoutScripts}${markup}\n${scripts}${afterClose}`;
  }
  return `${beforeBodyContent}${bodyInner}${markup}\n  ${afterClose}`;
};

const ensureArchiveLayoutStyles = (html = "") => {
  if (ARCHIVE_LAYOUT_STYLE_RE.test(html)) return html;
  return html.replace(/<\/head>/i, `    <style id="archive-layout-styles">\n${ARCHIVE_LAYOUT_CSS}\n    </style>\n  </head>`);
};

const injectLayoutChrome = (html = "", relativePath = "") => {
  const layout = resolveStaticLayout(relativePath);
  if (!layout) return html;

  const htmlLang = extractHtmlLang(html);
  let next = String(html || "");
  next = next.replace(FOOTER_UTILITY_RE, "");

  if (layout.family === LAYOUT_FAMILY.READER) {
    next = next.replace(READER_HEADER_RE, "");
    next = next.replace(FOOTER_RE, "");
    next = insertAfterBodyLead(next, renderReaderHeader({ locale: htmlLang, currentKey: layout.currentKey }));
    next = appendFooterBeforeBodyClose(next, renderReaderFooter({ locale: htmlLang }));
    return next;
  }

  next = appendBodyClass(next, "archive-layout");
  next = ensureArchiveLayoutStyles(next);
  next = next.replace(ARCHIVE_HEADER_RE, "");
  next = next.replace(READER_HEADER_RE, "");
  next = next.replace(PRIMARY_NAV_RE, "");
  next = next.replace(FOOTER_RE, "");
  next = insertAfterBodyLead(next, renderArchiveHeader({ locale: htmlLang, currentKey: layout.currentKey }));
  next = appendFooterBeforeBodyClose(next, renderArchiveFooter({ locale: htmlLang }));
  return next;
};

const ensureBioCaseLink = (html = "", locale = "en") => {
  const caseLink = BIO_CASE_LINK_BY_LOCALE[locale] || BIO_CASE_LINK_BY_LOCALE.en;
  if (String(html).includes(caseLink)) return html;
  const start = String(html).indexOf("<h3>Additional references</h3>");
  if (start !== -1) {
    const ulOpen = String(html).indexOf("<ul>", start);
    const ulClose = String(html).indexOf("</ul>", ulOpen);
    if (ulOpen !== -1 && ulClose !== -1) {
      return `${String(html).slice(0, ulClose)}          ${caseLink}\n        ${String(html).slice(ulClose)}`;
    }
  }
  const refsStart = String(html).indexOf('<section class="refs-card">');
  if (refsStart === -1) return html;
  const ulOpen = String(html).indexOf("<ul>", refsStart);
  const ulClose = String(html).indexOf("</ul>", ulOpen);
  if (ulOpen === -1 || ulClose === -1) return html;
  return `${String(html).slice(0, ulClose)}          ${caseLink}\n        ${String(html).slice(ulClose)}`;
};

const listHtmlFilesRecursively = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listHtmlFilesRecursively(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      out.push(fullPath);
    }
  }
  return out;
};

const applyNavigationUiPolicies = async () => {
  const htmlFiles = await listHtmlFilesRecursively(siteDir);
  for (const fullPath of htmlFiles) {
    let html = await fs.readFile(fullPath, "utf8");
    const relativePath = path.relative(siteDir, fullPath).replace(/\\/g, "/");
    html = injectLayoutChrome(html, relativePath);
    if (relativePath === "bio/index.html") html = ensureBioCaseLink(html, "en");
    if (relativePath === "bio/fr/index.html") html = ensureBioCaseLink(html, "fr");
    if (relativePath === "bio/de/index.html") html = ensureBioCaseLink(html, "de");
    if (relativePath === "bio/es/index.html") html = ensureBioCaseLink(html, "es");
    await fs.writeFile(fullPath, html, "utf8");
  }
};

const applyStaticTrustBlockPolicies = async () => {
  for (const block of STATIC_TRUST_BLOCKS) {
    let html;
    try {
      html = await fs.readFile(block.path, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    const next = replaceTrustBlock(html, block.marker, {
      variant: block.variant,
      locale: block.locale,
    });
    await fs.writeFile(block.path, next, "utf8");
  }
};

const applyStaticSocialPreviewPolicies = async () => {
  for (const [relativePath, imageType] of STATIC_SOCIAL_IMAGE_POLICY.entries()) {
    const fullPath = path.join(siteDir, relativePath);
    let html;
    try {
      html = await fs.readFile(fullPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    const title = extractTitleTag(html);
    const description = extractMetaTagContent(html, "name", "description");
    const canonical = extractLinkHref(html, "canonical") || canonicalUrl(relativePath);
    const type = extractMetaTagContent(html, "property", "og:type") || "website";
    const existingImage = extractMetaTagContent(html, "property", "og:image");
    const preferredImage = SOCIAL_OG_IMAGE_BY_TYPE[imageType] || SOCIAL_OG_IMAGE_BY_TYPE.default || DEFAULT_SOCIAL_IMAGE;
    const imageUrl = preferredImage || existingImage || DEFAULT_SOCIAL_IMAGE;
    const socialMeta = buildSocialMetaSpec({
      title,
      socialTitle: title,
      description,
      canonical,
      type,
      imageUrl,
    });

    html = upsertMetaTag(html, "property", "og:type", socialMeta.type);
    html = upsertMetaTag(html, "property", "og:title", socialMeta.socialTitle);
    html = upsertMetaTag(html, "property", "og:description", socialMeta.description);
    html = upsertMetaTag(html, "property", "og:url", socialMeta.canonical);
    html = upsertMetaTag(html, "property", "og:site_name", socialMeta.siteName);
    html = upsertMetaTag(html, "property", "og:image", socialMeta.imageUrl);
    html = upsertMetaTag(html, "property", "og:image:width", socialMeta.imageWidth);
    html = upsertMetaTag(html, "property", "og:image:height", socialMeta.imageHeight);
    html = upsertMetaTag(html, "property", "og:image:type", OG_IMAGE_TYPE);
    html = upsertMetaTag(html, "property", "og:image:secure_url", socialMeta.imageUrl);
    html = upsertMetaTag(html, "name", "twitter:card", socialMeta.twitterCard);
    html = upsertMetaTag(html, "name", "twitter:title", socialMeta.socialTitle);
    html = upsertMetaTag(html, "name", "twitter:description", socialMeta.description);
    html = upsertMetaTag(html, "name", "twitter:image", socialMeta.imageUrl);
    html = upsertMetaTag(html, "name", "twitter:image:src", socialMeta.imageUrl);
    html = upsertMetaTag(html, "name", "twitter:creator", socialMeta.twitterCreator);
    html = upsertLinkRel(html, "image_src", socialMeta.imageUrl);

    await fs.writeFile(fullPath, html, "utf8");
  }
};

const FIRST_JSONLD_SCRIPT_RE = /<script type=["']application\/ld\+json["']>\s*([\s\S]*?)\s*<\/script>/i;

const STATIC_ENTITY_RETENTION_TYPES = new Set(["FAQPage", "ItemList", "QAPage", "ClaimReview"]);

const STATIC_SECTION_LABELS = {
  en: {
    home: "Home",
    bio: "Bio",
    cases: "Case notes",
    selected: "Selected Work",
    interviews: "Interviews",
    contact: "Contact",
    archive: "Archive",
    insights: "Research archive",
    search: "Search",
    about: "About",
    posts: "Posts",
    page: "Page",
  },
  fr: {
    home: "Accueil",
    bio: "Biographie",
    cases: "Notes de cas",
    selected: "Travaux sélectionnés",
    interviews: "Entretiens",
    contact: "Contact",
    archive: "Archives",
    insights: "Archives de recherche",
    search: "Recherche",
    about: "À propos",
    posts: "Publications",
    page: "Page",
  },
  de: {
    home: "Startseite",
    bio: "Biografie",
    cases: "Falldokumentation",
    selected: "Ausgewählte Arbeiten",
    interviews: "Interviews",
    contact: "Kontakt",
    archive: "Archiv",
    insights: "Recherchearchiv",
    search: "Suche",
    about: "Über",
    posts: "Beiträge",
    page: "Seite",
  },
  es: {
    home: "Inicio",
    bio: "Biografía",
    cases: "Notas de casos",
    selected: "Trabajo seleccionado",
    interviews: "Entrevistas",
    contact: "Contacto",
    archive: "Archivo",
    insights: "Archivo de investigación",
    search: "Búsqueda",
    about: "Acerca de",
    posts: "Publicaciones",
    page: "Página",
  },
};

const extractHtmlLang = (html = "") => {
  const match = String(html || "").match(/<html[^>]*\blang=["']([^"']+)["']/i);
  const lang = String(match?.[1] || "en").trim().slice(0, 2).toLowerCase();
  return ["en", "fr", "de", "es"].includes(lang) ? lang : "en";
};

const extractCanonicalHref = (html = "", fallbackRelativePath = "index.html") => {
  const source = String(html || "");
  const match = source.match(
    /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*\/?>|<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*\/?>/i
  );
  const href = String(match?.[1] || match?.[2] || "").trim();
  return href || canonicalUrl(fallbackRelativePath);
};

const extractHeadTitle = (html = "") => {
  const match = String(html || "").match(/<title>([\s\S]*?)<\/title>/i);
  return htmlToText(match?.[1] || "").trim();
};

const extractMetaDescription = (html = "") => {
  const match = String(html || "").match(
    /<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*\/?>|<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*\/?>/i
  );
  return decodeHtmlEntities(String(match?.[1] || match?.[2] || "")).trim();
};

const parseFirstJsonLdGraph = (html = "") => {
  const match = String(html || "").match(FIRST_JSONLD_SCRIPT_RE);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed?.["@graph"])) return parsed["@graph"];
    if (parsed && typeof parsed === "object") return [parsed];
    return [];
  } catch {
    return [];
  }
};

const inferStaticSectionKey = (relativePath = "") => {
  const clean = String(relativePath || "").replace(/^\/+/, "");
  if (!clean) return "home";
  if (clean === "index.html" || /^(fr|de|es)\/index\.html$/i.test(clean)) return "home";
  const first = clean.split("/")[0].toLowerCase();
  if (
    ["bio", "cases", "selected", "interviews", "contact", "archive", "insights", "search", "about", "posts"].includes(
      first
    )
  ) {
    return first;
  }
  return "page";
};

const inferStaticPageType = (relativePath = "") => {
  const clean = String(relativePath || "").replace(/^\/+/, "").toLowerCase();
  if (clean.startsWith("contact/")) return "ContactPage";
  if (clean.startsWith("bio/") || clean.startsWith("cases/")) return "ProfilePage";
  if (
    clean.startsWith("selected/") ||
    clean.startsWith("interviews/") ||
    clean.startsWith("archive/") ||
    clean.startsWith("insights/") ||
    clean.startsWith("posts/")
  ) {
    return "CollectionPage";
  }
  return "WebPage";
};

const inferPageNodeId = (canonical = "", relativePath = "", pageType = "WebPage") => {
  return buildPageNodeId(canonical, pageType);
};

const languageHomeUrl = (htmlLang = "en") =>
  htmlLang === "en" ? canonicalUrl("index.html") : canonicalUrl(`${htmlLang}/index.html`);

const sectionLabelForLang = (sectionKey = "page", htmlLang = "en") => {
  const pack = STATIC_SECTION_LABELS[htmlLang] || STATIC_SECTION_LABELS.en;
  return pack[sectionKey] || pack.page;
};

const retainedStaticNodes = (nodes = []) => {
  const retained = [];
  const seen = new Set();
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node || typeof node !== "object") continue;
    const type = String(node["@type"] || "").trim();
    if (!STATIC_ENTITY_RETENTION_TYPES.has(type)) continue;
    const key = String(node["@id"] || `${type}:${JSON.stringify(node)}`);
    if (seen.has(key)) continue;
    seen.add(key);
    retained.push(node);
  }
  return retained;
};

const replaceFirstJsonLdScript = (html = "", payload = {}) => {
  const script = `<script type="application/ld+json">\n${JSON.stringify(payload, null, 2)}\n    </script>`;
  if (FIRST_JSONLD_SCRIPT_RE.test(html)) {
    return html.replace(FIRST_JSONLD_SCRIPT_RE, script);
  }
  return html.replace(/<\/head>/i, `    ${script}\n  </head>`);
};

const applyStaticEntityLayer = async (entries = []) => {
  const buildIso = latestBuildIso(entries);
  const digestsGitLastmod =
    (await gitLastmodForAbsolutePath(path.join(siteDir, "data", "digests.json"), buildIso)) || buildIso;
  for (const relativePath of STATIC_ENTITY_SECTIONS) {
    const fullPath = path.join(siteDir, relativePath);
    let html;
    try {
      html = await fs.readFile(fullPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    const htmlLang = extractHtmlLang(html);
    const canonical = extractCanonicalHref(html, relativePath);
    const title = extractHeadTitle(html) || sectionLabelForLang(inferStaticSectionKey(relativePath), htmlLang);
    const description = extractMetaDescription(html);
    const sectionKey = inferStaticSectionKey(relativePath);
    const pageType = inferStaticPageType(relativePath);
    const pageId = inferPageNodeId(canonical, relativePath, pageType);
    const breadcrumbId = `${canonical}#breadcrumb`;
    const homeUrl = languageHomeUrl(htmlLang);
    const breadcrumbItems = [{ name: sectionLabelForLang("home", htmlLang), url: homeUrl }];
    if (canonical !== homeUrl) {
      breadcrumbItems.push({ name: sectionLabelForLang(sectionKey, htmlLang), url: canonical });
    }
    const modifiedIso = digestsGitLastmod;

    const existingGraph = parseFirstJsonLdGraph(html);
    const preservedNodes = retainedStaticNodes(existingGraph);
    const firstItemListId = preservedNodes.find((node) => node?.["@type"] === "ItemList" && node?.["@id"])?.["@id"];

    const { person, organization, website } = buildCoreEntities();
    const breadcrumb = buildBreadcrumbList(breadcrumbId, breadcrumbItems);
    const pageNode = {
      "@type": pageType,
      "@id": pageId,
      url: canonical,
      name: title,
      description: description || undefined,
      inLanguage: htmlLang,
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": PERSON_ID },
      author: { "@id": PERSON_ID },
      publisher: { "@id": ORGANIZATION_ID },
      breadcrumb: { "@id": breadcrumbId },
      dateModified: modifiedIso || undefined,
    };

    if (pageType === "ProfilePage") {
      pageNode.mainEntity = { "@id": PERSON_ID };
    } else if (pageType === "CollectionPage" && firstItemListId) {
      pageNode.mainEntity = { "@id": firstItemListId };
    }

    const payload = {
      "@context": "https://schema.org",
      "@graph": [person, organization, website, breadcrumb, pageNode, ...preservedNodes],
    };

    const nextHtml = replaceFirstJsonLdScript(html, payload);
    await fs.writeFile(fullPath, nextHtml, "utf8");
  }
};

const buildPostHtml = (item, postPath, idToPostPath, idToCluster, entries, idToStatus = new Map()) => {
  const itemId = String(item?.id || "").trim();
  const pageClass = String(idToStatus.get(itemId) || classifyPostPage(item)).toLowerCase();
  const displayTitle = resolveDisplayTitle(item);
  const metaTitle = buildPostMetaTitle(item, displayTitle);
  const title = `${metaTitle} | ${SITE_NAME}`;
  const summary = previewSummary(item);
  const description = buildPostMetaDescription(item) || "Publication summary with source context and key claims.";
  const semanticTags = normalizedArray(item.semantic_tags);
  const publicSemanticTags = sanitizeSemanticTags(semanticTags);
  const canonical = canonicalUrl(postPath);
  const postSocialImage =
    normalizeSourceUrl(item?.social_image || item?.og_image || item?.image || item?.card_image || "") ||
    SOCIAL_OG_IMAGE_BY_TYPE.posts ||
    DEFAULT_SOCIAL_IMAGE;
  const postSocialMeta = buildSocialMetaSpec({
    title,
    socialTitle: metaTitle,
    description,
    canonical,
    type: "article",
    imageUrl: postSocialImage,
  });
  const sourceLink = normalizeSourceUrl(item.url);
  const sourceCtaLabel = sourceActionLabel(item);
  const htmlLang = toHtmlLang(item.language);
  const { alternates, xDefaultHref } = getAlternatesForItem(
    item,
    idToPostPath,
    idToCluster,
    idToStatus,
    false
  );
  const hreflangHeadLinks = buildHeadHreflangLinks(alternates, xDefaultHref);
  const languageLinks = alternates.map(
    (alt) =>
      `<li><a href="${htmlEscape(alt.href)}">${htmlEscape(String(alt.hreflang).toUpperCase())}</a></li>`
  );
  const {
    relatedByTopic,
    relatedBySource,
    relatedBySection,
    relatedByYear,
    newerInLanguage,
    olderInLanguage,
    newerFromSource,
    olderFromSource,
    latestSameLanguage,
    latestAcrossSite,
  } = buildRelatedPostGroups(item, entries);
  const topicLinks = buildRelatedLinks(relatedByTopic);
  const sourceLinks = buildRelatedLinks(relatedBySource);
  const sectionLinks = buildRelatedLinks(relatedBySection);
  const yearLinks = buildRelatedLinks(relatedByYear);
  const languageTimelineLinks = [
    buildDirectionalRelatedLink("Newer", newerInLanguage),
    buildDirectionalRelatedLink("Older", olderInLanguage),
  ].filter(Boolean);
  const sourceTimelineLinks = [
    buildDirectionalRelatedLink("Newer", newerFromSource),
    buildDirectionalRelatedLink("Older", olderFromSource),
  ].filter(Boolean);
  const latestLanguageLinks = buildRelatedLinks(latestSameLanguage);
  const latestSiteLinks = buildRelatedLinks(latestAcrossSite);
  const selectedSectionId = classifySelectedSection(item);
  const selectedSectionLabel = selectedSectionLabelById(selectedSectionId);
  const localizedHomeHref = htmlLang === "en" ? "/" : `/${htmlLang}/`;
  const { person, organization, website } = buildCoreEntities();
  const pageId = buildPageNodeId(canonical, "WebPage");
  const articleId = `${canonical}#article`;
  const breadcrumbId = `${canonical}#breadcrumb`;
  const publishedIso = toIsoTimestamp(item.date) || item.date || undefined;
  const modifiedIso = toIsoTimestamp(item.lastmod || item.date) || publishedIso;
  const breadcrumb = buildBreadcrumbList(breadcrumbId, [
    { name: "Home", url: canonicalUrl("index.html") },
    { name: "Posts", url: canonicalUrl("posts/index.html") },
    { name: displayTitle, url: canonical },
  ]);
  const sourceName = normalizeText(item.source || "");
  const sourceOrigin = sourceLink
    ? (() => {
        try {
          return new URL(sourceLink).origin;
        } catch {
          return undefined;
        }
      })()
    : undefined;
  const sourceNodeId = sourceLink || sourceName ? buildSourceEntityId(sourceName, sourceLink) : undefined;
  const sourceOrganization =
    sourceNodeId && sourceName
      ? {
          "@type": "Organization",
          "@id": sourceNodeId,
          name: sourceName,
          url: sourceOrigin || sourceLink,
          sameAs: sourceOrigin ? [sourceOrigin] : undefined,
        }
      : undefined;
  const basedOn =
    sourceLink
      ? {
          "@type": "CreativeWork",
          url: sourceLink,
          name: sourceName || "Original source",
          publisher: sourceOrganization ? { "@id": sourceNodeId } : undefined,
        }
      : undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      person,
      organization,
      website,
      breadcrumb,
      ...(sourceOrganization ? [sourceOrganization] : []),
      {
        "@type": "WebPage",
        "@id": pageId,
        url: canonical,
        name: displayTitle,
        inLanguage: htmlLang,
        isPartOf: { "@id": WEBSITE_ID },
        about: { "@id": PERSON_ID },
      },
      {
        "@type": "Article",
        "@id": articleId,
        headline: displayTitle,
        description,
        inLanguage: htmlLang,
        datePublished: publishedIso,
        dateModified: modifiedIso,
        author: { "@id": PERSON_ID },
        publisher: { "@id": ORGANIZATION_ID },
        isPartOf: { "@id": WEBSITE_ID },
        mainEntityOfPage: { "@id": pageId },
        about: { "@id": PERSON_ID },
        url: canonical,
        citation: sourceLink || undefined,
        isBasedOn: basedOn,
        mentions: sourceOrganization ? { "@id": sourceNodeId } : undefined,
        keywords: publicSemanticTags.length > 0 ? publicSemanticTags.join(", ") : undefined,
        isAccessibleForFree: true,
      },
    ],
  };

  return `<!doctype html>
<html lang="${htmlLang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${htmlEscape(title)}</title>
    <meta name="description" content="${htmlEscape(description)}" />
    <link rel="canonical" href="${canonical}" />
    ${hreflangHeadLinks}
    ${renderSocialMetaTags(postSocialMeta)}
    <meta name="robots" content="${robotsMetaForPageClass(pageClass)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Georgia, serif; background: #f4f1ea; color: #121212; line-height: 1.56; overflow-x: clip; }
      main { padding: 14px 0 42px; }
      main { width: min(860px, calc(100% - 2rem)); margin: 0 auto; }
      a { color: #0b4f7b; overflow-wrap: anywhere; }
      .meta { color: #555; font-size: 0.95rem; }
      section { margin-top: 18px; }
      h2 { margin: 0 0 8px; font-size: 1.08rem; }
      h3 { margin: 14px 0 8px; font-size: 0.96rem; }
      p, li, h1, h2, h3, blockquote { overflow-wrap: anywhere; }
      ul { margin: 0; padding-left: 22px; }
      li { margin: 6px 0; }
      .source { margin-top: 24px; }
      blockquote { margin: 8px 0; padding: 12px 16px; background: #fff; border-left: 4px solid #0b4f7b; }
      .tags { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; }
      .tags li { margin: 0; border: 1px solid #d3cec4; background: #fff; border-radius: 999px; padding: 4px 10px; font-size: 0.85rem; }
      .post-header h1 { margin: 0; }
${ARCHIVE_LAYOUT_CSS}
      @media (max-width: 520px) {
        main { width: min(860px, calc(100% - 1.3rem)); }
        .post-header h1 { font-size: 1.9rem; line-height: 1.1; }
        ul { padding-left: 18px; }
      }
    </style>
  </head>
  <body class="archive-layout">
    ${renderArchiveHeader({ locale: htmlLang, currentKey: "posts" })}
    <main>
      <article>
        <header class="post-header">
          <h1>${htmlEscape(displayTitle)}</h1>
          <p class="meta">${htmlEscape(composeCardMeta(item))}</p>
        </header>
        <section>
          <p>${htmlEscape(summary)}</p>
        </section>
        <section>
          <h2>Continue on site</h2>
          <ul>
            <li><a href="${localizedHomeHref}">Home</a></li>
            <li><a href="/bio/">Biography (EN/FR/DE/ES)</a></li>
            <li><a href="/selected/">Selected Work</a></li>
            <li><a href="/selected/#${selectedSectionId}">Selected section: ${htmlEscape(selectedSectionLabel)}</a></li>
            <li><a href="/interviews/">Interviews</a></li>
            <li><a href="/posts/">Published posts index</a></li>
            <li><a href="/posts/all.html">${INCLUDE_DRAFT_OUTPUTS ? "Full archive (including drafts)" : "Full archive"}</a></li>
            <li><a href="/insights/">Research archive</a></li>
            <li><a href="/archive/">Archive</a></li>
            <li><a href="/search/">Search</a></li>
            <li><a href="/contact/">Contact</a></li>
          </ul>
          ${languageLinks.length > 0 ? `<h3>Available languages</h3><ul>${languageLinks.join("")}</ul>` : ""}
          ${topicLinks.length > 0 ? `<h3>Related topic</h3><ul>${topicLinks.join("")}</ul>` : ""}
          ${sectionLinks.length > 0 ? `<h3>Related section</h3><ul>${sectionLinks.join("")}</ul>` : ""}
          ${sourceLinks.length > 0 ? `<h3>From this source</h3><ul>${sourceLinks.join("")}</ul>` : ""}
          ${yearLinks.length > 0 ? `<h3>Same period</h3><ul>${yearLinks.join("")}</ul>` : ""}
          ${languageTimelineLinks.length > 0 ? `<h3>Timeline in this language</h3><ul>${languageTimelineLinks.join("")}</ul>` : ""}
          ${sourceTimelineLinks.length > 0 ? `<h3>Timeline from this source</h3><ul>${sourceTimelineLinks.join("")}</ul>` : ""}
          ${latestLanguageLinks.length > 0 ? `<h3>Recent in this language</h3><ul>${latestLanguageLinks.join("")}</ul>` : ""}
          ${latestSiteLinks.length > 0 ? `<h3>More from this archive</h3><ul>${latestSiteLinks.join("")}</ul>` : ""}
        </section>
        <p class="source"><a href="${htmlEscape(sourceLink)}" rel="noreferrer" target="_blank">${htmlEscape(sourceCtaLabel)}</a></p>
      </article>
    </main>
    ${renderArchiveFooter({ locale: htmlLang })}
  </body>
</html>
`;
};

const buildPostsIndexHtml = (entries, idToCluster = new Map(), options = {}) => {
  const {
    canonicalPath = "posts/index.html",
    pageTitle = "Published pieces",
    pageDescription = "Published pieces in chronological order.",
    listHeading = "Published posts",
    indexable = true,
  } = options;
  const scopedEntries = indexable ? entries.filter((entry) => isShowcaseCandidate(entry?.item)) : entries;
  const writingGroups = groupEntriesForListing(
    scopedEntries.filter((entry) => !isReferenceCard(entry?.item)),
    idToCluster
  );
  const referenceGroups = groupEntriesForListing(
    scopedEntries.filter((entry) => isReferenceCard(entry?.item)),
    idToCluster
  );
  const visibleGroups = writingGroups;
  const postsCanonical = canonicalUrl(canonicalPath);
  const postsSocialImage = SOCIAL_OG_IMAGE_BY_TYPE.default || DEFAULT_SOCIAL_IMAGE;
  const postsSocialMeta = buildSocialMetaSpec({
    title: pageTitle,
    socialTitle: pageTitle,
    description: pageDescription,
    canonical: postsCanonical,
    type: "website",
    imageUrl: postsSocialImage,
  });
  const { person, organization, website } = buildCoreEntities();
  const itemListId = `${postsCanonical}#itemlist`;
  const breadcrumbId = `${postsCanonical}#breadcrumb`;
  const sectionName =
    canonicalPath === "posts/all.html"
      ? "Full archive"
      : canonicalPath === "posts/drafts.html"
        ? "Draft archive"
        : "Posts";
  const breadcrumbItems = [
    { name: "Home", url: canonicalUrl("index.html") },
    { name: "Posts", url: canonicalUrl("posts/index.html") },
  ];
  if (canonicalPath !== "posts/index.html") {
    breadcrumbItems.push({ name: sectionName, url: postsCanonical });
  }
  const breadcrumb = buildBreadcrumbList(breadcrumbId, breadcrumbItems);
  const postsJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      person,
      organization,
      website,
      breadcrumb,
      {
        "@type": "CollectionPage",
        "@id": buildPageNodeId(postsCanonical, "CollectionPage"),
        url: postsCanonical,
        name: pageTitle,
        description: pageDescription,
        inLanguage: ["en", "fr", "de", "es"],
        isPartOf: { "@id": WEBSITE_ID },
        about: { "@id": PERSON_ID },
        mainEntity: { "@id": itemListId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: "Published pieces index",
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: visibleGroups.length,
        itemListElement: visibleGroups.map((group, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          url: canonicalUrl(`posts/${group.representative.postPath}`),
          name: resolveDisplayTitle(group.representative.item),
          inLanguage: toHtmlLang(group.representative.item.language),
        })),
      },
    ],
  };

  const renderGroupList = (groups) =>
    groups
      .map((group) => {
        const rep = group.representative;
        const title = htmlEscape(resolveDisplayTitle(rep.item));
        const meta = htmlEscape(composeCardMeta(rep.item));
        const alternates =
          group.variants.length > 1
            ? ` <span aria-label="Available languages">(${group.variants
                .map(
                  (variant) =>
                    `<a href="./${htmlEscape(variant.postPath)}">${htmlEscape(String(variant.language || "").toUpperCase())}</a>`
                )
                .join(" · ")})</span>`
            : "";
        return `        <li><a href="./${rep.postPath}">${title}</a> — ${meta}${alternates}</li>`;
      })
      .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${htmlEscape(pageTitle)}</title>
    <meta name="description" content="${htmlEscape(pageDescription)}" />
    <link rel="canonical" href="${postsCanonical}" />
    <link rel="alternate" hreflang="en" href="${postsCanonical}" />
    <link rel="alternate" hreflang="${X_DEFAULT}" href="${postsCanonical}" />
    ${renderSocialMetaTags(postsSocialMeta)}
    <meta name="robots" content="${indexable ? robotsMetaForPageClass(PAGE_CLASS.INDEXABLE) : robotsMetaForPageClass(PAGE_CLASS.SERVICE)}" />
    <script type="application/ld+json">${JSON.stringify(postsJsonLd)}</script>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Georgia, serif; background: #f4f1ea; color: #121212; overflow-x: clip; line-height: 1.56; }
      main { padding: 14px 0 42px; }
      main { width: min(880px, calc(100% - 2rem)); margin: 0 auto; }
      li { margin: 8px 0; }
      a { color: #0b4f7b; overflow-wrap: anywhere; }
      section { margin-top: 16px; }
      h2 { margin: 0 0 8px; font-size: 1.08rem; }
      p, li, h1, h2, h3 { overflow-wrap: anywhere; }
      .lead { margin: 8px 0 0; color: #555; }
${ARCHIVE_LAYOUT_CSS}
      @media (max-width: 520px) {
        main { width: min(880px, calc(100% - 1.3rem)); }
      }
    </style>
  </head>
  <body class="archive-layout">
    ${renderArchiveHeader({ locale: "en", currentKey: "posts" })}
    <main>
      <section>
        <h1>${htmlEscape(pageTitle)}</h1>
        <p class="lead">${htmlEscape(pageDescription)}</p>
      </section>
      <section>
        <h2>See also</h2>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/selected/">Selected Work</a></li>
          <li><a href="/insights/">Research archive</a></li>
          <li><a href="/posts/all.html">${INCLUDE_DRAFT_OUTPUTS ? "Full archive (including drafts)" : "Full archive"}</a></li>
          <li><a href="/bio/">Biography (EN, FR, DE, ES)</a></li>
        </ul>
      </section>
      <section>
        <h2>${htmlEscape(listHeading)}</h2>
        <ul>
${renderGroupList(writingGroups)}
        </ul>
      </section>
      ${referenceGroups.length > 0
        ? `<section>
        <h2>References</h2>
        <ul>
${renderGroupList(referenceGroups)}
        </ul>
      </section>`
        : ""}
    </main>
    ${renderArchiveFooter({ locale: "en" })}
  </body>
</html>
`;
};

const buildUrlSet = (urls, withAlternates = false) => {
  const xmlns = withAlternates
    ? `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`
    : `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  return `<?xml version="1.0" encoding="UTF-8"?>
${xmlns}
${urls
  .map((item) => {
    const alternates = withAlternates
      ? (item.alternates || [])
          .map(
            (alt) =>
              `    <xhtml:link rel="alternate" hreflang="${xmlEscape(alt.hreflang)}" href="${xmlEscape(alt.href)}" />`
          )
          .join("\n")
      : "";
    return `  <url>
    <loc>${xmlEscape(item.url)}</loc>
    <lastmod>${item.lastmod}</lastmod>
    <changefreq>weekly</changefreq>${alternates ? `\n${alternates}` : ""}
  </url>`;
  })
  .join("\n")}
</urlset>
`;
};

const buildSitemapIndex = (sitemaps, childLastmods = new Map(), fallbackIso = EPOCH_ISO) => `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (name) =>
      `  <sitemap><loc>${xmlEscape(canonicalUrl(name))}</loc><lastmod>${latestIso([childLastmods.get(name)], fallbackIso)}</lastmod></sitemap>`
  )
  .join("\n")}
</sitemapindex>
`;

const buildSitemaps = async (entries, idToPostPath, idToCluster, idToStatus = new Map()) => {
  const buildIso = latestBuildIso(entries);
  const staticUrls = await Promise.all(
    INDEXABLE_STATIC_SECTIONS.map(async (section) => ({
      url: canonicalUrl(section),
      lastmod: await gitLastmodForAbsolutePath(path.join(siteDir, section), buildIso),
    }))
  );
  const homeLastmod = await gitLastmodForAbsolutePath(path.join(siteDir, "index.html"), buildIso);
  const coreUrls = [
    { url: canonicalUrl("index.html"), lastmod: homeLastmod },
    ...staticUrls,
  ];

  const files = [
    {
      name: "sitemap-core.xml",
      content: buildUrlSet(coreUrls, false),
    },
  ];
  const childLastmods = new Map([["sitemap-core.xml", latestIso(coreUrls.map((item) => item.lastmod), buildIso)]]);

  for (const lang of LANGS) {
    const langEntries = entries.filter((entry) => normalizeLang(entry?.item?.language) === lang);
    const urls = await Promise.all(langEntries.map(async (entry) => {
      const canonical = canonicalUrl(`posts/${entry.postPath}`);
      const { alternates, xDefaultHref } = getAlternatesForItem(
        entry.item,
        idToPostPath,
        idToCluster,
        idToStatus,
        true
      );
      const hreflangs = alternates.map((alt) => ({ hreflang: alt.hreflang, href: alt.href }));
      if (xDefaultHref) {
        hreflangs.push({ hreflang: X_DEFAULT, href: xDefaultHref });
      }
      const postGitLastmod = await gitLastmodForAbsolutePath(path.join(postsDir, entry.postPath));
      return {
        url: canonical,
        lastmod: postGitLastmod || toIsoTimestamp(entry.item?.lastmod || entry.item?.date) || buildIso,
        alternates: hreflangs,
      };
    }));
    const sitemapName = `sitemap-${lang.toLowerCase()}.xml`;
    files.push({
      name: sitemapName,
      content: buildUrlSet(urls, true),
    });
    childLastmods.set(sitemapName, latestIso(urls.map((item) => item.lastmod), buildIso));
  }

  const indexFileNames = files.map((file) => file.name);
  files.push({
    name: "sitemap.xml",
    content: buildSitemapIndex(indexFileNames, childLastmods, buildIso),
  });

  return files;
};

const buildRss = (entries) => {
  const buildIso = latestBuildIso(entries);
  const now = new Date(buildIso).toUTCString();
  const items = entries
    .slice()
    .sort((a, b) => String(b.item.date || "").localeCompare(String(a.item.date || "")))
    .slice(0, 50)
    .map((entry) => {
      const link = canonicalUrl(`posts/${entry.postPath}`);
      const source = normalizeSourceUrl(entry.item.url || "");
      const summary = previewSummary(entry.item);
      const context = previewContext(entry.item);
      const descriptionParts = [summary, context, source ? `Original source: ${source}` : ""].filter(Boolean);
      const description = descriptionParts.join("\n\n");
      const pubDate = new Date(toIsoTimestamp(entry.item.date) || buildIso).toUTCString();
      return `    <item>
      <title>${xmlEscape(resolveDisplayTitle(entry.item))}</title>
      <link>${xmlEscape(link)}</link>
      <guid>${xmlEscape(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${xmlEscape(description)}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Ilia Klishin Publications Feed</title>
    <link>${xmlEscape(canonicalUrl("index.html"))}</link>
    <description>Publication cards with concise summaries and links to original sources.</description>
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>
`;
};

const renderBotBlock = (agent, { allowRoot = true, disallowPaths = [] } = {}) => {
  const lines = [`User-agent: ${agent}`];
  if (allowRoot) lines.push("Allow: /");
  for (const disallow of disallowPaths) {
    lines.push(`Disallow: ${disallow}`);
  }
  return lines.join("\n");
};

const FULL_WHITELIST_BOTS = [
  "Googlebot",
  "Bingbot",
  "YandexBot",
  "OAI-SearchBot",
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "CCBot",
];

const EXTRA_ALLOW_BOTS = ["Google-Extended", "DuckDuckBot", "DuckAssistBot", "Applebot", "Yandex"];
const ROBOTS_SITEMAP_FILES = ["sitemap.xml", "sitemap-core.xml", "sitemap-en.xml", "sitemap-fr.xml", "sitemap-de.xml", "sitemap-es.xml"];

const buildRobots = () => {
  const blocks = [
    renderBotBlock("*", { allowRoot: true, disallowPaths: ["/tools/"] }),
    ...FULL_WHITELIST_BOTS.map((agent) => renderBotBlock(agent, { allowRoot: true, disallowPaths: [] })),
    ...EXTRA_ALLOW_BOTS.map((agent) => renderBotBlock(agent, { allowRoot: true, disallowPaths: [] })),
  ];

  const sitemapLines = ROBOTS_SITEMAP_FILES.map((name) => `Sitemap: ${canonicalUrl(name)}`).join("\n");
  return `${blocks.join("\n\n")}\n\n${sitemapLines}\n`;
};

const main = async () => {
  const sourceUrlHealth = await loadSourceUrlHealth();
  const raw = await fs.readFile(dataPath, "utf8");
  const payload = JSON.parse(raw);
  const items = Array.isArray(payload.items) ? payload.items.map((item) => normalizeContentItem(item)) : [];

  await fs.mkdir(postsDir, { recursive: true });
  FIXED_IMAGE_VERSION = await computeFixedImageVersion();
  await materializeFixedImageAssets();

  const entries = items.map((item) => {
    const explicitSlug = String(item.slug || "").trim().replace(/\.html$/i, "");
    const slug = explicitSlug || `${item.id || "item"}-${slugify(item.title || "entry")}`;
    const postPath = `${slug}.html`;
    return { item, postPath };
  });
  const compiledEntries = entries.filter((entry) => shouldCompileItem(entry?.item, { production: PRODUCTION_BUILD }));
  const publicEntries = compiledEntries.filter((entry) => isPublicRenderableItem(entry?.item));
  const publishedEntries = compiledEntries.filter((entry) => isPublishedStatus(entry?.item?.status));
  const indexableEntries = compiledEntries.filter((entry) => isIndexablePost(entry?.item));
  const draftEntries = entries.filter((entry) => isDraftLikeItem(entry?.item));
  const excludedDraftEntries = PRODUCTION_BUILD
    ? entries.filter((entry) => !shouldCompileItem(entry?.item, { production: true }))
    : [];
  const idToPostPath = new Map(compiledEntries.map((entry) => [entry.item.id, entry.postPath]));
  await updateInterviewPages(sourceUrlHealth);
  await updateSelectedWorkPage(publicEntries, idToPostPath);
  const selectedCards = await extractSelectedCards();
  const { idToCluster, idToContentId } = buildContentTranslationMaps(items);
  const publicInterviews = buildPublicInterviewsDataset(sourceUrlHealth);
  const idToIndexStatus = new Map(
    compiledEntries.map((entry) => [String(entry?.item?.id || "").trim(), classifyPostPage(entry?.item)])
  );
  const searchIndexes = buildSearchIndexes(
    publicEntries,
    selectedCards,
    sourceUrlHealth,
    idToCluster,
    idToContentId,
    idToPostPath,
    idToIndexStatus
  );
  const publicDigests = buildPublicDigestsDataset(
    publicEntries,
    idToCluster,
    idToContentId,
    idToPostPath,
    idToIndexStatus
  );

  for (const entry of compiledEntries) {
    const html = buildPostHtml(
      entry.item,
      `posts/${entry.postPath}`,
      idToPostPath,
      idToCluster,
      indexableEntries,
      idToIndexStatus
    );
    await fs.writeFile(path.join(postsDir, entry.postPath), html, "utf8");
  }

  // Remove stale generated HTML pages left from old slugs/names.
  const desiredHtmlFiles = new Set(compiledEntries.map((entry) => entry.postPath));
  desiredHtmlFiles.add("index.html");
  desiredHtmlFiles.add("all.html");
  if (INCLUDE_DRAFT_OUTPUTS) {
    desiredHtmlFiles.add("drafts.html");
  }
  const existingPosts = await fs.readdir(postsDir);
  for (const file of existingPosts) {
    if (!file.toLowerCase().endsWith(".html")) continue;
    if (desiredHtmlFiles.has(file)) continue;
    await fs.unlink(path.join(postsDir, file));
  }

  const sitemapFiles = await buildSitemaps(indexableEntries, idToPostPath, idToCluster, idToIndexStatus);

  await fs.writeFile(
    path.join(postsDir, "index.html"),
    buildPostsIndexHtml(indexableEntries, idToCluster, {
      canonicalPath: "posts/index.html",
      pageTitle: "Published pieces",
      pageDescription: "Published pieces in chronological order.",
      listHeading: "Published posts",
      indexable: false,
    }),
    "utf8"
  );
  await fs.writeFile(
    path.join(postsDir, "all.html"),
    buildPostsIndexHtml(compiledEntries, idToCluster, {
      canonicalPath: "posts/all.html",
      pageTitle: "Full archive",
      pageDescription: INCLUDE_DRAFT_OUTPUTS
        ? "Complete archive, including working drafts."
        : "Complete archive of published pieces.",
      listHeading: "Writing",
      indexable: false,
    }),
    "utf8"
  );
  if (INCLUDE_DRAFT_OUTPUTS && draftEntries.length > 0) {
    await fs.writeFile(
      path.join(postsDir, "drafts.html"),
      buildPostsIndexHtml(draftEntries, idToCluster, {
        canonicalPath: "posts/drafts.html",
        pageTitle: "Draft archive",
        pageDescription: "Working draft archive. Not indexed.",
        listHeading: "Draft pieces",
        indexable: false,
      }),
      "utf8"
    );
  } else {
    try {
      await fs.unlink(path.join(postsDir, "drafts.html"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  for (const file of sitemapFiles) {
    await fs.writeFile(path.join(siteDir, file.name), file.content, "utf8");
  }
  await fs.writeFile(path.join(siteDir, "rss.xml"), buildRss(publicEntries), "utf8");
  await fs.writeFile(path.join(siteDir, "robots.txt"), buildRobots(), "utf8");
  await fs.writeFile(publicDigestsPath, JSON.stringify(publicDigests, null, 2) + "\n", "utf8");
  await fs.writeFile(publicInterviewsPath, JSON.stringify(publicInterviews, null, 2) + "\n", "utf8");
  await fs.writeFile(
    searchIndexManifestPath,
    JSON.stringify(
      {
        generated_at: searchIndexes.generated_at,
        counts: searchIndexes.counts,
        locales: searchIndexes.locales,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  for (const locale of HREFLANG_ORDER) {
    await fs.writeFile(
      searchIndexLocalePath(locale),
      JSON.stringify(searchIndexes.itemsByLocale[locale] || buildSearchIndexForLocale(locale, [], [], sourceUrlHealth), null, 2) + "\n",
      "utf8"
    );
  }
  const notesSource = path.resolve(process.cwd(), "reputation-case", "digest-multilingual-notes-v1.md");
  const notesTarget = path.join(siteDir, "digest-multilingual-notes-v1.md");
  try {
    await fs.copyFile(notesSource, notesTarget);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await updateHomeHtmlFirstCards(publicEntries, sourceUrlHealth);
  await applyStaticHeadSeoPolicies();
  await applyStaticSocialPreviewPolicies();
  await applyStaticEntityLayer(compiledEntries);
  await applyStaticTrustBlockPolicies();
  const fingerprintedAssets = await fingerprintStaticAssets();
  await rewriteFixedImageLinksInHtml();
  await cleanupDeprecatedFingerprintedKeyImages();
  await applyNavigationUiPolicies();
  await applyStaticLanguageSwitchPolicies();

  console.log(
    `Generated ${compiledEntries.length} post pages (${publishedEntries.length} ready, ${indexableEntries.length} indexable, ${draftEntries.length} draft signals${PRODUCTION_BUILD ? `, excluded-from-production=${excludedDraftEntries.length}` : ""}), sitemap index + ${sitemapFiles.length - 1} child sitemaps, rss.xml, robots.txt, search-index (${HREFLANG_ORDER.map((locale) => `${locale}:${searchIndexes.counts.locales[locale] || 0}`).join(", ")}), home HTML-first cards, fingerprinted assets (${fingerprintedAssets.length}), source-url-broken=${sourceUrlHealth.brokenUrls.size}, build-env=${BUILD_ENV}`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
