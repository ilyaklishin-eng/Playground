const SUPPORTED_LOCALES = new Set(["en", "fr", "de", "es"]);

export const LAYOUT_FAMILY = Object.freeze({
  READER: "reader",
  ARCHIVE: "archive",
});

export const NAV_KEY = Object.freeze({
  HOME: "home",
  BIO: "bio",
  SELECTED: "selected",
  INTERVIEWS: "interviews",
  CONTACT: "contact",
  SEARCH: "search",
  ARCHIVE: "archive",
  INSIGHTS: "insights",
  ABOUT: "about",
  POSTS: "posts",
  CASES: "cases",
});

const NAV_LABELS = Object.freeze({
  home: { en: "Home", fr: "Home", de: "Home", es: "Home" },
  bio: { en: "Bio", fr: "Bio", de: "Bio", es: "Bio" },
  selected: { en: "Selected Work", fr: "Selected Work", de: "Selected Work", es: "Selected Work" },
  interviews: { en: "Interviews", fr: "Interviews", de: "Interviews", es: "Interviews" },
  contact: { en: "Contact", fr: "Contact", de: "Contact", es: "Contact" },
  search: { en: "Search", fr: "Search", de: "Search", es: "Search" },
  archive: { en: "Archive", fr: "Archive", de: "Archive", es: "Archive" },
  insights: { en: "Research archive", fr: "Research archive", de: "Research archive", es: "Research archive" },
  about: { en: "About", fr: "About", de: "About", es: "About" },
  posts: { en: "Posts", fr: "Posts", de: "Posts", es: "Posts" },
  cases: { en: "Case notes", fr: "Case notes", de: "Case notes", es: "Case notes" },
});

const normalizeLocale = (locale = "en") => {
  const value = String(locale || "en").trim().slice(0, 2).toLowerCase();
  return SUPPORTED_LOCALES.has(value) ? value : "en";
};

const localeScopedHref = (basePath, locale = "en") => {
  const lang = normalizeLocale(locale);
  if (lang === "en") return basePath;
  return `${basePath}${lang}/`;
};

const NAV_HREF_BUILDERS = Object.freeze({
  home: (locale = "en") => (normalizeLocale(locale) === "en" ? "/" : `/${normalizeLocale(locale)}/`),
  bio: (locale = "en") => localeScopedHref("/bio/", locale),
  selected: () => "/selected/",
  interviews: (locale = "en") => localeScopedHref("/interviews/", locale),
  contact: () => "/contact/",
  search: () => "/search/",
  archive: () => "/archive/",
  insights: (locale = "en") => localeScopedHref("/insights/", locale),
  about: () => "/about/",
  posts: () => "/posts/",
  cases: (locale = "en") => localeScopedHref("/cases/", locale),
});

export const NAV_LAYOUTS = Object.freeze({
  reader: {
    header: [NAV_KEY.HOME, NAV_KEY.BIO, NAV_KEY.SELECTED, NAV_KEY.INTERVIEWS, NAV_KEY.CONTACT],
    footer: [NAV_KEY.HOME, NAV_KEY.BIO, NAV_KEY.SELECTED, NAV_KEY.CONTACT],
  },
  archive: {
    header: [NAV_KEY.HOME, NAV_KEY.SELECTED, NAV_KEY.POSTS, NAV_KEY.INSIGHTS, NAV_KEY.ARCHIVE, NAV_KEY.ABOUT],
    footer: [NAV_KEY.HOME, NAV_KEY.SELECTED, NAV_KEY.ARCHIVE, NAV_KEY.POSTS, NAV_KEY.ABOUT],
  },
});

const STATIC_LAYOUT_OVERRIDES = new Map([
  ["index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.HOME }],
  ["fr/index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.HOME }],
  ["de/index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.HOME }],
  ["es/index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.HOME }],
  ["bio/index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.BIO }],
  ["bio/fr/index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.BIO }],
  ["bio/de/index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.BIO }],
  ["bio/es/index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.BIO }],
  ["selected/index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.SELECTED }],
  ["interviews/index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.INTERVIEWS }],
  ["interviews/fr/index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.INTERVIEWS }],
  ["interviews/de/index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.INTERVIEWS }],
  ["interviews/es/index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.INTERVIEWS }],
  ["contact/index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.CONTACT }],
  ["search/index.html", { family: LAYOUT_FAMILY.READER, currentKey: NAV_KEY.SEARCH }],
  ["archive/index.html", { family: LAYOUT_FAMILY.ARCHIVE, currentKey: NAV_KEY.ARCHIVE }],
  ["about/index.html", { family: LAYOUT_FAMILY.ARCHIVE, currentKey: NAV_KEY.ABOUT }],
  ["insights/index.html", { family: LAYOUT_FAMILY.ARCHIVE, currentKey: NAV_KEY.INSIGHTS }],
  ["insights/fr/index.html", { family: LAYOUT_FAMILY.ARCHIVE, currentKey: NAV_KEY.INSIGHTS }],
  ["insights/de/index.html", { family: LAYOUT_FAMILY.ARCHIVE, currentKey: NAV_KEY.INSIGHTS }],
  ["insights/es/index.html", { family: LAYOUT_FAMILY.ARCHIVE, currentKey: NAV_KEY.INSIGHTS }],
  ["cases/index.html", { family: LAYOUT_FAMILY.ARCHIVE, currentKey: NAV_KEY.CASES }],
  ["cases/fr/index.html", { family: LAYOUT_FAMILY.ARCHIVE, currentKey: NAV_KEY.CASES }],
  ["cases/de/index.html", { family: LAYOUT_FAMILY.ARCHIVE, currentKey: NAV_KEY.CASES }],
  ["cases/es/index.html", { family: LAYOUT_FAMILY.ARCHIVE, currentKey: NAV_KEY.CASES }],
]);

export const ARCHIVE_LAYOUT_CSS = `
      .archive-header,
      .archive-footer {
        width: min(960px, calc(100% - 2rem));
        margin: 0 auto;
      }
      .archive-header {
        padding: 18px 0 0;
      }
      .archive-shell {
        display: grid;
        gap: 0.65rem;
        padding: 0.95rem 1rem;
        border: 1px solid #ddd7ce;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.82);
      }
      .archive-shell-label {
        margin: 0;
        color: #6e6558;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.13em;
        text-transform: uppercase;
      }
      .archive-nav,
      .archive-footer-nav {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .archive-nav a,
      .archive-footer-nav a {
        display: inline-flex;
        align-items: center;
        min-height: 42px;
        border: 1px solid #d7d2ca;
        border-radius: 12px;
        padding: 0.42rem 0.78rem;
        text-decoration: none;
        color: #1c1c1c;
        background: #fff;
        font-size: 0.86rem;
      }
      .archive-nav a[aria-current="page"],
      .archive-footer-nav a[aria-current="page"] {
        border-color: #2b3340;
        background: rgba(43, 51, 64, 0.09);
      }
      .archive-footer {
        margin: 24px auto 28px;
        padding-top: 12px;
        border-top: 1px solid #ddd7ce;
      }
      @media (max-width: 520px) {
        .archive-header,
        .archive-footer {
          width: min(960px, calc(100% - 1.3rem));
        }
        .archive-nav a,
        .archive-footer-nav a {
          padding: 0.42rem 0.68rem;
          font-size: 0.82rem;
        }
      }
`;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const getNavLabel = (key, locale = "en") => {
  const lang = normalizeLocale(locale);
  const pack = NAV_LABELS[key];
  if (!pack) return "";
  return pack[lang] || pack.en || "";
};

export const getNavHref = (key, locale = "en") => {
  const builder = NAV_HREF_BUILDERS[key];
  return typeof builder === "function" ? builder(locale) : "/";
};

export const buildNavItems = (keys = [], locale = "en") =>
  keys.map((key) => ({
    key,
    label: getNavLabel(key, locale),
    href: getNavHref(key, locale),
  }));

const renderNavLinks = (keys = [], locale = "en", currentKey = "", className = "") =>
  buildNavItems(keys, locale)
    .map((item) => {
      const active = item.key === currentKey ? ` aria-current="page"` : "";
      const activeClass = item.key === currentKey && className ? ` class="${className}"` : "";
      return `<a${activeClass} href="${escapeHtml(item.href)}"${active}>${escapeHtml(item.label)}</a>`;
    })
    .join("\n        ");

const renderLanguageSwitchPlaceholder = (locale = "en", tagName = "nav") => {
  const lang = normalizeLocale(locale);
  return `<${tagName} class="site-lang-switch" aria-label="Site language">
        <a class="active" href="${escapeHtml(getNavHref(NAV_KEY.HOME, lang))}" aria-current="page">${lang.toUpperCase()}</a>
      </${tagName}>`;
};

export const renderReaderHeader = ({ locale = "en", currentKey = "", brandLabel = "Ilia Klishin", languageSwitchTag = "nav" } = {}) => {
  const lang = normalizeLocale(locale);
  return `<header class="topbar" id="siteTopbar">
      <a class="brand" href="${escapeHtml(getNavHref(NAV_KEY.HOME, lang))}" aria-label="Go to home">${escapeHtml(brandLabel)}</a>
      <nav class="primary-nav" aria-label="Primary">
        ${renderNavLinks(NAV_LAYOUTS.reader.header, lang, currentKey)}
      </nav>
      ${renderLanguageSwitchPlaceholder(lang, languageSwitchTag)}
    </header>`;
};

export const renderReaderFooter = ({ locale = "en" } = {}) => {
  const lang = normalizeLocale(locale);
  return `<footer class="footer">
      <nav class="secondary-nav" aria-label="Secondary">
        ${renderNavLinks(NAV_LAYOUTS.reader.footer, lang)}
      </nav>
    </footer>`;
};

export const renderArchiveHeader = ({ locale = "en", currentKey = "" } = {}) => {
  const lang = normalizeLocale(locale);
  return `<header class="archive-header">
      <div class="archive-shell">
        <p class="archive-shell-label">Archive / Utility</p>
        <nav class="archive-nav" aria-label="Archive navigation">
          ${renderNavLinks(NAV_LAYOUTS.archive.header, lang, currentKey)}
        </nav>
      </div>
    </header>`;
};

export const renderArchiveFooter = ({ locale = "en" } = {}) => {
  const lang = normalizeLocale(locale);
  return `<footer class="archive-footer">
      <nav class="archive-footer-nav" aria-label="Archive footer">
        ${renderNavLinks(NAV_LAYOUTS.archive.footer, lang)}
      </nav>
    </footer>`;
};

export const resolveStaticLayout = (relativePath = "") => {
  const clean = String(relativePath || "").replace(/^\/+/, "");
  return STATIC_LAYOUT_OVERRIDES.get(clean) || null;
};

