const CORE_REFERENCES = [
  {
    name: "Bloomberg",
    href: "https://www.bloomberg.com/news/articles/2021-03-10/russia-takes-aim-at-twitter-over-content-in-unprecedented-crackdown",
    rel: "noopener noreferrer",
  },
  {
    name: "The Atlantic",
    href: "https://www.theatlantic.com/international/archive/2015/04/how-the-media-became-putins-most-powerful-weapon/391062/",
    rel: "noopener noreferrer",
  },
  {
    name: "The Guardian",
    href: "https://www.theguardian.com/world/2015/jun/08/30-under-30-moscows-young-power-list",
    rel: "noopener noreferrer",
  },
  {
    name: "Human Rights Watch",
    href: "https://www.hrw.org/news/2012/03/01/russia-harassment-critics",
    rel: "noopener noreferrer",
  },
  {
    name: "Carnegie Endowment",
    href: "https://carnegieendowment.org/posts/2016/01/web-of-control-the-future-of-the-russian-internet",
    rel: "noopener noreferrer",
  },
  {
    name: "TEDx",
    href: "https://www.ted.com/tedx/events/3947",
    rel: "noopener noreferrer",
  },
];

const SECONDARY_REFERENCES = [
  {
    name: "Freedom House",
    href: "https://freedomhouse.org/country/russia/freedom-net/2016",
    rel: "noopener noreferrer",
  },
  {
    name: "Wilson Center",
    href: "https://www.wilsoncenter.org/article/how-media-became-one-putins-most-powerful-weapons",
    rel: "noopener noreferrer",
  },
  {
    name: "RAND",
    href: "https://www.rand.org/pubs/research_reports/RR295.html",
    rel: "noopener noreferrer",
  },
  {
    name: "LSE EUROPP",
    href: "https://blogs.lse.ac.uk/europpblog/2012/03/14/russia-protests-election-observer/",
    rel: "noopener noreferrer",
  },
  {
    name: "JSIS Washington",
    href: "https://jsis.washington.edu/news/russia-media-profile-digital-patriotism-nationalist-agenda/",
    rel: "noopener noreferrer",
  },
  {
    name: "Global Voices",
    href: "https://globalvoices.org/2015/01/30/how-putin-secretly-conquered-russias-social-media-over-the-past-3-years/",
    rel: "noopener noreferrer",
  },
  {
    name: "Delfi",
    href: "https://www.delfi.lt/",
    rel: "noopener noreferrer",
  },
  {
    name: "The Insider",
    href: "https://theins.ru/en/opinion/ilya-klishin/252347",
    rel: "noopener noreferrer",
  },
  {
    name: "The Moscow Times",
    href: "https://www.themoscowtimes.com/author/ilya-klishin",
    rel: "me noopener noreferrer",
  },
  {
    name: "Vedomosti",
    href: "https://www.vedomosti.ru/authors/ilya-klishin",
    rel: "me noopener noreferrer",
  },
  {
    name: "7x7",
    href: "https://www.semnasem.org/articles/2023/09/27/ideya-vitala-v-vozduhe-soosnovatel-telegram-kanala-volna-ilya-klishin-o-tom-kak-poyavilos-media-dlya-emigrantov-iz-raznyh-stran",
    rel: "noopener noreferrer",
  },
  {
    name: "Republic",
    href: "https://republic.ru/posts/69382",
    rel: "noopener noreferrer",
  },
  {
    name: "Snob",
    href: "https://snob.ru/profile/28206/blog/",
    rel: "noopener noreferrer",
  },
];

const HOME_COPY = {
  en: {
    proofLabel: "Professional proof points",
    kf: "founder and strategist.",
    volna: "co-founder and editor-in-chief.",
    tvRain: "former Head of Digital Newsroom.",
    rtvi: "former Digital Director.",
    referencesLabel: "Independent references",
    showAll: "Show all",
  },
  fr: {
    proofLabel: "Repères professionnels",
    kf: "fondateur et stratège.",
    volna: "cofondateur et rédacteur en chef.",
    tvRain: "ancien responsable de la rédaction numérique.",
    rtvi: "ancien directeur du numérique.",
    referencesLabel: "Références indépendantes",
    showAll: "Voir toutes les références",
  },
  de: {
    proofLabel: "Berufliche Eckdaten",
    kf: "Gründer und Stratege.",
    volna: "Mitgründer und Chefredakteur.",
    tvRain: "ehemaliger Leiter der digitalen Redaktion.",
    rtvi: "ehemaliger Digitaldirektor.",
    referencesLabel: "Unabhängige Referenzen",
    showAll: "Alle Referenzen anzeigen",
  },
  es: {
    proofLabel: "Puntos profesionales clave",
    kf: "fundador y estratega.",
    volna: "cofundador y director editorial.",
    tvRain: "exjefe de redacción digital.",
    rtvi: "exdirector digital.",
    referencesLabel: "Referencias independientes",
    showAll: "Ver todas las referencias",
  },
};

const MINIMAL_COPY = {
  en: {
    label: "At a glance",
    intro: "Independent references include",
  },
  fr: {
    label: "En bref",
    intro: "Parmi les références indépendantes :",
  },
  de: {
    label: "Auf einen Blick",
    intro: "Zu den unabhängigen Referenzen zählen",
  },
  es: {
    label: "De un vistazo",
    intro: "Las referencias independientes incluyen",
  },
};

export const TRUST_BLOCK_MARKERS = {
  home: {
    start: "<!-- TRUST_BLOCK_HOME_START -->",
    end: "<!-- TRUST_BLOCK_HOME_END -->",
    indent: "            ",
  },
  bio: {
    start: "<!-- TRUST_BLOCK_BIO_START -->",
    end: "<!-- TRUST_BLOCK_BIO_END -->",
    indent: "      ",
  },
  contact: {
    start: "<!-- TRUST_BLOCK_CONTACT_START -->",
    end: "<!-- TRUST_BLOCK_CONTACT_END -->",
    indent: "      ",
  },
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const resolveLocale = (locale = "en") => {
  const normalized = String(locale || "en").trim().toLowerCase();
  return HOME_COPY[normalized] ? normalized : "en";
};

const renderReferenceLink = ({ name, href, rel }) =>
  `<a href="${escapeHtml(href)}" target="_blank" rel="${escapeHtml(rel || "noopener noreferrer")}">${escapeHtml(name)}</a>`;

const renderReferenceLine = (references = []) =>
  references
    .map((reference, index) => {
      const suffix = index === references.length - 1 ? "." : ",";
      return `${renderReferenceLink(reference)}${suffix}`;
    })
    .join("\n                ");

const renderFullBlock = (locale = "en") => {
  const copy = HOME_COPY[resolveLocale(locale)];
  return `            <ul class="hero-proof-list" aria-label="${escapeHtml(copy.proofLabel)}">
              <li><a class="hero-proof-link" href="https://kf.agency/" target="_blank" rel="noopener noreferrer">KF Agency</a>: ${escapeHtml(copy.kf)}</li>
              <li><a class="hero-proof-link" href="https://linktr.ee/volnamedia" target="_blank" rel="noopener noreferrer">Volna Media</a>: ${escapeHtml(copy.volna)}</li>
              <li><strong>TV Rain:</strong> ${escapeHtml(copy.tvRain)}</li>
              <li><strong>RTVI:</strong> ${escapeHtml(copy.rtvi)}</li>
              <li>
                <strong>${escapeHtml(copy.referencesLabel)}:</strong>
                <span class="hero-reference-line">
                ${renderReferenceLine(CORE_REFERENCES)}
                </span>
                <details class="hero-reference-more">
                  <summary>${escapeHtml(copy.showAll)}</summary>
                  <span class="hero-reference-line">
                    ${renderReferenceLine(SECONDARY_REFERENCES)}
                  </span>
                </details>
              </li>
            </ul>`;
};

const renderMinimalBlock = (locale = "en") => {
  const copy = MINIMAL_COPY[resolveLocale(locale)];
  const references = CORE_REFERENCES.map(renderReferenceLink).join(", ");
  return `      <section class="trust-inline" aria-label="${escapeHtml(copy.label)}">
        <p><strong>${escapeHtml(copy.label)}:</strong> ${escapeHtml(copy.intro)} ${references}.</p>
      </section>`;
};

export const renderTrustBlock = ({ variant = "full", locale = "en" } = {}) => {
  if (variant === "minimal") return renderMinimalBlock(locale);
  return renderFullBlock(locale);
};

const escapeRegExp = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const replaceTrustBlock = (html = "", markerKey = "home", options = {}) => {
  const markers = TRUST_BLOCK_MARKERS[markerKey];
  if (!markers) {
    throw new Error(`Unknown trust block marker: ${markerKey}`);
  }
  if (!String(html).includes(markers.start) || !String(html).includes(markers.end)) {
    throw new Error(`Missing trust block markers for ${markerKey}.`);
  }
  const indent = markers.indent || "";
  const replacement = `${indent}${markers.start}\n${renderTrustBlock(options)}\n${indent}${markers.end}`;
  const pattern = new RegExp(`${escapeRegExp(markers.start)}[\\s\\S]*?${escapeRegExp(markers.end)}`, "m");
  return String(html).replace(pattern, replacement);
};
