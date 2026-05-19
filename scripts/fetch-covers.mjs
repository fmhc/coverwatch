// Run via: npm run fetch-covers

import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const COVERS_DIR = path.join(ROOT_DIR, "assets", "covers");
const BOOKS_DIR = path.join(COVERS_DIR, "books");
const MAGAZINES_DIR = path.join(COVERS_DIR, "magazines");
const MANIFEST_PATH = path.join(COVERS_DIR, "manifest.json");

const USER_AGENT =
  "coverwatch-fetch-covers/1.0 (+https://example.invalid; asset pipeline for Vite+React+three.js)";
const MIN_FILE_BYTES = 2048;
const REQUEST_DELAY_MS = 250;
const MAX_RETRIES = 1;

const SPIEGEL_BOOKS = [
  { title: "Der Nachbar", author: "Sebastian Fitzek" },
  { title: "The Secret of Secrets", author: "Dan Brown" },
  { title: "Organisch", author: "Giulia Enders" },
  { title: "Bevor der Kaffee kalt wird", author: "Toshikazu Kawaguchi" },
  { title: "It Ends with Us", author: "Colleen Hoover" },
  { title: "Achtsam morden", author: "Karsten Dusse" },
  { title: "22 Bahnen", author: "Caroline Wahl" },
  { title: "Fourth Wing", author: "Rebecca Yarros" },
  { title: "Iron Flame", author: "Rebecca Yarros" },
  { title: "Der Salzpfad", author: "Raynor Winn" },
  { title: "Das Cafe am Rande der Welt", author: "John Strelecky" },
  { title: "The Let Them Theory", author: "Mel Robbins" },
  { title: "Atomic Habits", author: "James Clear" },
  { title: "Project Hail Mary", author: "Andy Weir" },
  { title: "Funny Story", author: "Emily Henry" },
  { title: "The Housemaid", author: "Freida McFadden" },
  { title: "Verity", author: "Colleen Hoover" },
  { title: "Harry Potter und der Stein der Weisen", author: "J. K. Rowling" },
  { title: "Murtagh", author: "Christopher Paolini" },
];

const MAGAZINE_CATEGORIES = [
  {
    category: "Computer/Tech",
    titles: [
      { title: "Computer Bild", kioskSlug: "computer-bild" },
      { title: "CHIP", kioskSlug: "chip-premium-edition" },
      { title: "CHIP DVD", kioskSlug: "chip-dvd" },
      { title: "CHIP Foto-Video", kioskSlug: "chip-foto-video" },
      { title: "c't", kioskSlug: "c-t" },
      { title: "c't Make", kioskSlug: "c-t-make" },
      { title: "c't Fotografie", kioskSlug: "c-t-fotografie" },
      { title: "PC Games", kioskSlug: "pc-games-magazin" },
      { title: "PC Games Hardware", kioskSlug: "pc-games-hardware-magazin" },
      { title: "PC-WELT", kioskSlug: "pc-welt" },
      { title: "PC-WELT XXL", kioskSlug: "pc-welt-xxl" },
      { title: "PC-WELT Plus", kioskSlug: "pc-welt-plus" },
      { title: "connect", kioskSlug: "connect" },
      { title: "Mac Life", kioskSlug: "mac-life" },
      { title: "LinuxUser", kioskSlug: "linuxuser-mit-dvd" },
      { title: "GameStar XL", kioskSlug: "gamestar-xl" },
      { title: "fotoMAGAZIN", kioskSlug: "fotomagazin" },
      { title: "Play5", kioskSlug: "play5" },
      { title: "DigitalPHOTO Pro", kioskSlug: "digital-photo-pro" },
    ],
  },
  {
    category: "Angeln/Fishing",
    titles: [
      { title: "Blinker", kioskSlug: "blinker" },
      { title: "Blinker Sonderheft", kioskSlug: "blinker-sonderheft" },
      { title: "Fisch & Fang", kioskSlug: "fisch-fang-angeln" },
      { title: "Fisch & Fang Sonderheft", kioskSlug: "fisch-fang-sonderheft" },
      { title: "Angelwoche", kioskSlug: "angelwoche" },
      { title: "Angelwoche Sonderheft", kioskSlug: "angelwoche-sonderheft" },
      { title: "Rute & Rolle", kioskSlug: "rute-rolle" },
      { title: "Der Raubfisch", kioskSlug: "der-raubfisch-angeln" },
      { title: "Fliegenfischen", kioskSlug: "fliegenfischen" },
      { title: "Fliegenfischen Spezial", kioskSlug: "fliegenfischen-spezial" },
    ],
  },
  {
    category: "Auto/Motor",
    titles: [
      { title: "Auto Bild", kioskSlug: "auto-bild" },
      { title: "Auto Bild Klassik", kioskSlug: "auto-bild-klassik" },
      { title: "Auto Bild Sportscars", kioskSlug: "auto-bild-sportscars" },
      { title: "Auto Bild Reisemobil", kioskSlug: "auto-bild-reisemobil" },
      { title: "Auto Bild Camper", kioskSlug: "auto-bild-camper" },
      { title: "auto motor und sport", kioskSlug: "auto-motor-und-sport" },
      { title: "auto motor und sport edition", kioskSlug: "auto-motor-und-sport-edition" },
      { title: "ADAC Motorwelt", pageUrl: "https://www.adac.de/der-adac/motorwelt/" },
      { title: "MOTORRAD", kioskSlug: "motorrad" },
      { title: "MOTORRAD Classic", kioskSlug: "motorrad-classic" },
      { title: "MOTORRAD Reisen", kioskSlug: "motorrad-reisen" },
      { title: "MOTORRAD News", kioskSlug: "motorrad-news" },
      { title: "MOTORRAD Abenteuer", kioskSlug: "motorrad-abenteuer" },
      { title: "Auto Zeitung", kioskSlug: "auto-zeitung" },
      { title: "sport auto", kioskSlug: "sport-auto" },
      { title: "RoadBIKE", kioskSlug: "roadbike" },
      { title: "MOTOR KLASSIK", kioskSlug: "motor-klassik" },
      { title: "MOTOR KLASSIK Youngtimer", kioskSlug: "motor-klassik-youngtimer" },
      { title: "Oldtimer Markt", kioskSlug: "oldtimer-markt" },
      { title: "promobil", kioskSlug: "promobil" },
      { title: "promobil Campingbusse", kioskSlug: "promobil-campingbusse" },
      { title: "CARAVANING", kioskSlug: "caravaning" },
      { title: "Auto Straßenverkehr", kioskSlug: "auto-strassenverkehr" },
    ],
  },
  {
    category: "News/People",
    titles: [
      { title: "Der Spiegel", kioskSlug: "der-spiegel" },
      { title: "DER SPIEGEL Wissen", kioskSlug: "der-spiegel-wissen" },
      { title: "stern", kioskSlug: "stern" },
      { title: "stern Crime", kioskSlug: "stern-crime" },
      { title: "Focus", kioskSlug: "focus" },
      { title: "FOCUS Money", kioskSlug: "focus-money" },
      { title: "Bunte", kioskSlug: "bunte" },
      { title: "Bunte Gesundheit", kioskSlug: "bunte-gesundheit" },
      { title: "GALA", kioskSlug: "gala" },
      { title: "GALA Luxury", kioskSlug: "gala-luxury" },
      { title: "SUPERillu", kioskSlug: "superillu" },
      { title: "SUPERillu mit DVD", kioskSlug: "superillu-mit-dvd" },
      { title: "GEO", kioskSlug: "geo" },
      { title: "GEO Epoche", kioskSlug: "geo-epoche" },
      { title: "Capital", kioskSlug: "capital" },
      { title: "manager magazin", kioskSlug: "manager-magazin" },
      { title: "P.M. History", kioskSlug: "pm-history" },
      { title: "P.M. Thema", kioskSlug: "pm-thema" },
      { title: "P.M. Schneller schlau", kioskSlug: "pm-schneller-schlau" },
      { title: "Closer", kioskSlug: "closer" },
      { title: "Flow", kioskSlug: "flow" },
    ],
  },
  {
    category: "Sport",
    titles: [
      { title: "kicker", kioskSlug: "kicker" },
      { title: "kicker Sonderheft Champions League", kioskSlug: "kicker-sonderheft-champions-league" },
      { title: "kicker Sonderheft WM", kioskSlug: "kicker-sonderheft-wm" },
      { title: "SPORT BILD", kioskSlug: "sport-bild" },
      { title: "SPORT BILD Fußball Bundesliga", kioskSlug: "sport-bild-fussball-bundesliga" },
      { title: "SPORT BILD Sonderheft Champions League", kioskSlug: "sport-bild-sonderheft-champions-league" },
      { title: "11 Freunde", kioskSlug: "11-freunde" },
      { title: "11 Freunde Spezial", kioskSlug: "11-freunde-spezial" },
      { title: "Runner's World", kioskSlug: "runners-world" },
      { title: "Bergsteiger", kioskSlug: "bergsteiger" },
      { title: "Men's Health", kioskSlug: "mens-health" },
      { title: "Women's Health", kioskSlug: "womens-health" },
    ],
  },
  {
    category: "TV/Programm",
    titles: [
      { title: "TV Spielfilm", kioskSlug: "tv-spielfilm" },
      { title: "TV Spielfilm XXL", kioskSlug: "tv-spielfilm-xxl" },
      { title: "HÖRZU", kioskSlug: "hoerzu" },
      { title: "HÖRZU Wissen", kioskSlug: "hoerzu-wissen" },
      { title: "TV Movie", kioskSlug: "tv-movie" },
      { title: "TV Movie Digital XXL", kioskSlug: "tv-movie-digital-xxl" },
      { title: "TV Movie Stream XXL", kioskSlug: "tv-movie-stream-xxl" },
      { title: "TV Digital XXL Ausgabe", kioskSlug: "tv-digital-xxl-ausgabe" },
      { title: "TV Digital Sky Kabel Ausgabe", kioskSlug: "tv-digital-sky-kabel-ausgabe" },
      { title: "Gong", kioskSlug: "gong" },
      { title: "TV klar", kioskSlug: "tv-klar" },
      { title: "TV Hören und Sehen", kioskSlug: "tv-hoeren-und-sehen" },
      { title: "TV für mich", kioskSlug: "tv-fuer-mich" },
    ],
  },
  {
    category: "Wohnen/Frauen/Food",
    titles: [
      { title: "Schöner Wohnen", kioskSlug: "schoener-wohnen" },
      { title: "Schöner Wohnen Spezial", kioskSlug: "schoener-wohnen-spezial" },
      { title: "BRIGITTE", kioskSlug: "brigitte" },
      { title: "Für Sie", kioskSlug: "fuer-sie" },
      { title: "Landlust", kioskSlug: "landlust" },
      { title: "Landlust im Garten", kioskSlug: "landlust-im-garten" },
      { title: "Landlust Zuhaus", kioskSlug: "landlust-zuhaus" },
      { title: "Living at Home", kioskSlug: "living-at-home" },
      { title: "Living at Home Spezial", kioskSlug: "living-at-home-spezial" },
      { title: "essen & trinken", kioskSlug: "essen-trinken" },
      { title: "essen & trinken veggie", kioskSlug: "essen-trinken-veggie" },
      { title: "essen & trinken Spezial", kioskSlug: "essen-trinken-spezial" },
      { title: "essen & trinken Low Carb", kioskSlug: "essen-trinken-low-carb" },
      { title: "LandIdee", kioskSlug: "landidee" },
      { title: "LandIdee Wohnen & Deko", kioskSlug: "landidee-wohnen-deko" },
      { title: "LandIdee Dekoideen", kioskSlug: "landidee-dekoideen" },
      { title: "Mein schönes Land", kioskSlug: "mein-schoenes-land" },
      { title: "Mein schönes Landhaus", kioskSlug: "mein-schoenes-landhaus" },
      { title: "Mein schöner Garten", kioskSlug: "mein-schoener-garten" },
      { title: "Mein schöner Garten Spezial", kioskSlug: "mein-schoener-garten-spezial" },
      { title: "Lisa", kioskSlug: "lisa" },
      { title: "Lisa Kochen & Backen", kioskSlug: "lisa-kochen-backen" },
      { title: "tina", kioskSlug: "tina" },
      { title: "tina Koch & Backideen", kioskSlug: "tina-koch-backideen" },
      { title: "Laura", kioskSlug: "laura" },
      { title: "freundin", kioskSlug: "freundin" },
      { title: "BILD der FRAU", kioskSlug: "bild-der-frau" },
      { title: "Cosmopolitan", kioskSlug: "cosmopolitan" },
      { title: "VOGUE Deutsch", kioskSlug: "vogue-deutsch" },
      { title: "ELLE", kioskSlug: "elle" },
      { title: "Glamour", kioskSlug: "glamour" },
      { title: "Grazia", kioskSlug: "grazia" },
      { title: "Madame", kioskSlug: "madame" },
      { title: "Petra", kioskSlug: "petra" },
      { title: "lecker", kioskSlug: "lecker" },
      { title: "lecker special", kioskSlug: "lecker-special" },
    ],
  },
];

let lastRequestAt = 0;
let googleBooksDisabled = false;
let bookGoogleBooksDisabled = false;

async function main() {
  const startedAt = new Date().toISOString();

  await ensureDirectories();
  await cleanDirectory(BOOKS_DIR);
  await cleanDirectory(MAGAZINES_DIR);

  console.log(`[start] Fetching covers into ${COVERS_DIR}`);

  const books = await fetchBookCovers();
  const magazines = await fetchMagazineCovers();

  const manifest = {
    generatedAt: startedAt,
    books,
    magazines,
  };

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`[done] Books: ${books.length}`);
  console.log(`[done] Magazines: ${magazines.length}`);
  console.log(`[done] Distinct magazine titles: ${new Set(magazines.map((entry) => entry.title)).size}`);
  console.log(
    `[done] Magazine sample: ${magazines
      .slice(0, 15)
      .map((entry) => entry.title)
      .join(" | ")}`
  );
  console.log(`[done] Manifest: ${MANIFEST_PATH}`);
}

async function ensureDirectories() {
  await mkdir(BOOKS_DIR, { recursive: true });
  await mkdir(MAGAZINES_DIR, { recursive: true });
}

async function cleanDirectory(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await rm(entryPath, { recursive: true, force: true });
      continue;
    }
    await rm(entryPath, { force: true });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(url) {
  const response = await request(url);
  return response.json();
}

async function requestBuffer(url) {
  const response = await request(url);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function request(url) {
  let attempt = 0;
  let lastError;

  while (attempt <= MAX_RETRIES) {
    try {
      const waitFor = Math.max(0, REQUEST_DELAY_MS - (Date.now() - lastRequestAt));
      if (waitFor > 0) {
        await sleep(waitFor);
      }

      lastRequestAt = Date.now();
      const response = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          accept: "*/*",
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt > MAX_RETRIES) {
        break;
      }
      console.warn(`[retry] ${url} -> ${error.message}`);
      await sleep(500);
    }
  }

  throw lastError;
}

function sanitizeSlug(input) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "cover";
}

function uniqueSlug(baseSlug, usedSlugs) {
  if (!usedSlugs.has(baseSlug)) {
    usedSlugs.add(baseSlug);
    return baseSlug;
  }

  let suffix = 2;
  while (usedSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  const slug = `${baseSlug}-${suffix}`;
  usedSlugs.add(slug);
  return slug;
}

function pickGoogleImageLink(imageLinks = {}) {
  const keys = ["extraLarge", "large", "medium", "small", "thumbnail", "smallThumbnail"];
  for (const key of keys) {
    if (imageLinks[key]) {
      return normalizeGoogleImageUrl(imageLinks[key]);
    }
  }
  return null;
}

function normalizeGoogleImageUrl(url) {
  const httpsUrl = url.replace(/^http:/, "https:");
  const parsed = new URL(httpsUrl);
  parsed.searchParams.delete("edge");

  const currentZoom = Number(parsed.searchParams.get("zoom") || "0");
  parsed.searchParams.set("zoom", String(Math.max(currentZoom, 5)));
  return parsed.toString();
}

function getIsbnIdentifiers(industryIdentifiers = []) {
  return industryIdentifiers
    .filter((item) => item.type === "ISBN_13" || item.type === "ISBN_10")
    .map((item) => item.identifier);
}

async function fetchBookCovers() {
  const manifestEntries = [];
  const usedSlugs = new Set();

  for (let index = 0; index < SPIEGEL_BOOKS.length; index += 1) {
    const book = SPIEGEL_BOOKS[index];
    console.log(`[book ${index + 1}/${SPIEGEL_BOOKS.length}] ${book.title} - ${book.author}`);

    try {
      let items = [];
      if (!bookGoogleBooksDisabled) {
        const googleUrl = new URL("https://www.googleapis.com/books/v1/volumes");
        googleUrl.searchParams.set("q", `intitle:${book.title} inauthor:${book.author}`);
        googleUrl.searchParams.set("country", "DE");
        googleUrl.searchParams.set("maxResults", "5");

        try {
          const googleData = await requestJson(googleUrl.toString());
          items = googleData.items || [];
        } catch (error) {
          if (/quota|rate.?limit|429/i.test(error.message)) {
            bookGoogleBooksDisabled = true;
          }
          console.warn(`[book google miss] ${book.title}: ${error.message}`);
        }
      }

      let saved = await trySaveBookFromGoogleItems(book, items, usedSlugs);
      if (!saved) {
        saved = await trySaveBookFromOpenLibrarySearch(book, usedSlugs);
      }

      if (!saved) {
        console.warn(`[book miss] ${book.title} - no usable cover found`);
        continue;
      }

      manifestEntries.push(saved);
    } catch (error) {
      console.warn(`[book error] ${book.title}: ${error.message}`);
    }
  }

  return manifestEntries;
}

async function trySaveBookFromGoogleItems(book, items, usedSlugs) {
  for (const item of items) {
    const volumeInfo = item.volumeInfo || {};
    const title = volumeInfo.title || book.title;
    const author = (volumeInfo.authors || [book.author]).join(", ");
    const sourceUrl = pickGoogleImageLink(volumeInfo.imageLinks);
    const isbns = getIsbnIdentifiers(volumeInfo.industryIdentifiers);

    if (sourceUrl) {
      const saved = await saveRemoteImage({
        url: sourceUrl,
        dirPath: BOOKS_DIR,
        slugBase: `${book.author}-${book.title}`,
        label: `${book.title} [Google Books]`,
        usedSlugs,
      });

      if (saved) {
        return {
          title,
          author,
          file: `books/${saved.file}`,
          source: sourceUrl,
          width: saved.width,
          height: saved.height,
        };
      }
    }

    const openLibraryEntry = await trySaveBookFromIsbns({
      title,
      author,
      isbns,
      slugBase: `${book.author}-${book.title}`,
      labelBase: book.title,
      usedSlugs,
    });
    if (openLibraryEntry) {
      return openLibraryEntry;
    }
  }

  return null;
}

async function trySaveBookFromOpenLibrarySearch(book, usedSlugs) {
  const searchUrl = new URL("https://openlibrary.org/search.json");
  searchUrl.searchParams.set("title", book.title);
  searchUrl.searchParams.set("author", book.author);
  searchUrl.searchParams.set("fields", "title,author_name,isbn,cover_i");
  searchUrl.searchParams.set("limit", "5");

  try {
      const searchData = await requestJson(searchUrl.toString());
      for (const doc of searchData.docs || []) {
        const title = doc.title || book.title;
        const author = Array.isArray(doc.author_name) ? doc.author_name.join(", ") : book.author;
        const isbns = Array.isArray(doc.isbn) ? doc.isbn : [];
        const coverId = doc.cover_i || null;

        const entry = await trySaveBookFromIsbns({
          title,
          author,
          isbns,
          coverId,
          slugBase: `${book.author}-${book.title}`,
          labelBase: `${book.title} [Open Library search]`,
          usedSlugs,
      });
      if (entry) {
        return entry;
      }
    }
  } catch (error) {
    console.warn(`[book openlibrary miss] ${book.title}: ${error.message}`);
  }

  return null;
}

async function trySaveBookFromIsbns({
  title,
  author,
  isbns,
  coverId,
  slugBase,
  labelBase,
  usedSlugs,
}) {
  for (const isbn of isbns) {
    const openLibraryUrl = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg`;
    const saved = await saveRemoteImage({
      url: openLibraryUrl,
      dirPath: BOOKS_DIR,
      slugBase,
      label: `${labelBase} [Open Library ${isbn}]`,
      usedSlugs,
    });

    if (saved) {
      return {
        title,
        author,
        file: `books/${saved.file}`,
        source: openLibraryUrl,
        width: saved.width,
        height: saved.height,
      };
    }
  }

  if (coverId) {
    const openLibraryIdUrl = `https://covers.openlibrary.org/b/id/${encodeURIComponent(coverId)}-L.jpg`;
    const saved = await saveRemoteImage({
      url: openLibraryIdUrl,
      dirPath: BOOKS_DIR,
      slugBase,
      label: `${labelBase} [Open Library id ${coverId}]`,
      usedSlugs,
    });

    if (saved) {
      return {
        title,
        author,
        file: `books/${saved.file}`,
        source: openLibraryIdUrl,
        width: saved.width,
        height: saved.height,
      };
    }
  }

  return null;
}

async function fetchMagazineCovers() {
  const manifestEntries = [];
  const usedSlugs = new Set();
  const sitemapBySlug = await loadUnitedKioskSitemapBySlug();
  const magazines = MAGAZINE_CATEGORIES.flatMap((group) =>
    group.titles.map((entry) => ({ ...entry, category: group.category }))
  );

  for (let index = 0; index < magazines.length; index += 1) {
    const magazine = magazines[index];
    console.log(`[magazine ${index + 1}/${magazines.length}] ${magazine.title} (${magazine.category})`);

    try {
      const entry = await fetchMagazineCoverEntry(magazine, usedSlugs, sitemapBySlug);
      if (entry) {
        manifestEntries.push(entry);
      } else {
        console.warn(`[magazine miss] ${magazine.title} - no usable cover found`);
      }
    } catch (error) {
      console.warn(`[magazine error] ${magazine.title}: ${error.message}`);
    }
  }

  return manifestEntries;
}

async function loadUnitedKioskSitemapBySlug() {
  const sitemapUrl = "https://www.united-kiosk.de/googlesitemap.xml";
  try {
    const response = await request(sitemapUrl);
    const xml = await response.text();
    const bySlug = new Map();

    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const pageUrl = match[1];
      const pathname = new URL(pageUrl).pathname.replace(/\/+$/, "");
      const slug = pathname.split("/").filter(Boolean).at(-1);
      if (slug && !bySlug.has(slug)) {
        bySlug.set(slug, pageUrl);
      }
    }

    console.log(`[magazines] United Kiosk sitemap loaded: ${bySlug.size} slugs`);
    return bySlug;
  } catch (error) {
    console.warn(`[magazines] United Kiosk sitemap unavailable: ${error.message}`);
    return new Map();
  }
}

async function fetchMagazineCoverEntry(magazine, usedSlugs, sitemapBySlug) {
  let saved = await trySaveMagazineFromGoogleBooks(magazine, usedSlugs);
  if (saved) {
    return saved;
  }

  saved = await trySaveMagazineFromPage(magazine, usedSlugs, sitemapBySlug);
  if (saved) {
    return saved;
  }

  saved = await trySaveMagazineFromWikipedia(magazine, usedSlugs);
  if (saved) {
    return saved;
  }

  saved = await trySaveMagazineFromOpenLibrary(magazine, usedSlugs);
  if (saved) {
    return saved;
  }

  return null;
}

async function trySaveMagazineFromGoogleBooks(magazine, usedSlugs) {
  if (googleBooksDisabled) {
    return null;
  }

  const googleUrl = new URL("https://www.googleapis.com/books/v1/volumes");
  googleUrl.searchParams.set("q", `intitle:${magazine.title}`);
  googleUrl.searchParams.set("country", "DE");
  googleUrl.searchParams.set("maxResults", "5");

  try {
    const data = await requestJson(googleUrl.toString());
    for (const item of data.items || []) {
      const imageUrl = pickGoogleImageLink(item.volumeInfo?.imageLinks);
      if (!imageUrl) {
        continue;
      }

      const saved = await saveRemoteImage({
        url: imageUrl,
        dirPath: MAGAZINES_DIR,
        slugBase: magazine.title,
        label: `${magazine.title} [Google Books]`,
        usedSlugs,
      });

      if (saved) {
        return buildMagazineManifestEntry(magazine.title, saved, imageUrl);
      }
    }
  } catch (error) {
    if (/quota|rate.?limit|429/i.test(error.message)) {
      googleBooksDisabled = true;
    }
    console.warn(`[magazine google miss] ${magazine.title}: ${error.message}`);
  }

  return null;
}

async function trySaveMagazineFromWikipedia(magazine, usedSlugs) {
  const pageTitles = buildWikipediaCandidates(magazine.title, magazine.wikipediaTitles);

  for (const pageTitle of pageTitles) {
    const summaryUrl = `https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
    try {
      const data = await requestJson(summaryUrl);
      const candidateUrls = [data.originalimage?.source, data.thumbnail?.source].filter(Boolean);

      for (const candidateUrl of candidateUrls) {
        const saved = await saveRemoteImage({
          url: candidateUrl,
          dirPath: MAGAZINES_DIR,
          slugBase: magazine.title,
          label: `${magazine.title} [Wikipedia]`,
          usedSlugs,
        });

        if (saved) {
          return buildMagazineManifestEntry(magazine.title, saved, candidateUrl);
        }
      }
    } catch (error) {
      if (!/404/i.test(error.message)) {
        console.warn(`[magazine wikipedia miss] ${magazine.title}: ${error.message}`);
      }
    }
  }

  return null;
}

function buildWikipediaCandidates(title, extraTitles = []) {
  const base = title
    .replace(/\s+/g, " ")
    .trim();
  const candidates = [
    ...extraTitles,
    base,
    `${base} (Zeitschrift)`,
    `${base} (Magazin)`,
  ];

  return [...new Set(candidates.map((entry) => entry.replace(/ /g, "_")))];
}

async function trySaveMagazineFromPage(magazine, usedSlugs, sitemapBySlug) {
  const pageUrl =
    magazine.pageUrl || (magazine.kioskSlug ? sitemapBySlug.get(magazine.kioskSlug) : null);

  if (!pageUrl) {
    return null;
  }

  try {
    const response = await request(pageUrl);
    const html = await response.text();
    const candidateUrls = extractImageCandidatesFromHtml(html, pageUrl);

    for (const candidateUrl of candidateUrls) {
      const saved = await saveRemoteImage({
        url: candidateUrl,
        dirPath: MAGAZINES_DIR,
        slugBase: magazine.title,
        label: `${magazine.title} [Page]`,
        usedSlugs,
      });

      if (saved) {
        return buildMagazineManifestEntry(magazine.title, saved, candidateUrl);
      }
    }
  } catch (error) {
    console.warn(`[magazine page miss] ${magazine.title}: ${error.message}`);
  }

  return null;
}

function extractImageCandidatesFromHtml(html, pageUrl) {
  const candidates = new Map();
  const isAdacMotorweltPage = /adac\.de\/der-adac\/motorwelt/i.test(pageUrl);

  const addCandidate = (url, score) => {
    if (!url) {
      return;
    }

    try {
      const cleanedUrl = url.replace(/,+$/, "");
      const absolute = new URL(cleanedUrl, pageUrl).toString();
      const normalized = absolute.replace(/&amp;/g, "&");
      const parsed = new URL(normalized);
      const pathname = parsed.pathname.toLowerCase();
      const allowExtensionlessAdac =
        parsed.hostname === "assets.adac.de" && pathname.startsWith("/image/upload/");
      if (!allowExtensionlessAdac && !/\.(jpe?g|png)(?:$|\?)/i.test(pathname)) {
        return;
      }

      const previous = candidates.get(normalized) || 0;
      candidates.set(normalized, Math.max(previous, score));
    } catch {
      // Ignore malformed URLs in inline markup.
    }
  };

  for (const match of html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)) {
    addCandidate(match[1], 100);
  }

  for (const match of html.matchAll(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi)) {
    addCandidate(match[1], 90);
  }

  if (isAdacMotorweltPage) {
    for (const match of html.matchAll(/https?:\/\/[^"'\\s>]+(?:jpe?g|png|webp)/gi)) {
      for (const candidate of match[0].split(",")) {
        const normalized = candidate.trim();
        if (/assets\.adac\.de/i.test(normalized) && /cover/i.test(normalized) && /\.jpe?g$/i.test(normalized)) {
          addCandidate(normalized, 130);
        }
      }
    }
  }

  for (const match of html.matchAll(/https?:\/\/[^"'\\s)<>]+?\.(?:jpe?g|png)(?:\?[^"'\\s<>]*)?/gi)) {
    const url = match[0];
    let score = 10;
    if (/(cover|titel|titelbild|ausgabe|heft|magazin|epaper|coverg)/i.test(url)) {
      score += 40;
    }
    if (/united-kiosk\.de|assets\.adac\.de/i.test(url)) {
      score += 20;
    }
    addCandidate(url, score);
  }

  return [...candidates.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url]) => url);
}

async function trySaveMagazineFromOpenLibrary(magazine, usedSlugs) {
  const searchUrl = new URL("https://openlibrary.org/search.json");
  searchUrl.searchParams.set("title", magazine.title);
  searchUrl.searchParams.set("fields", "title,cover_i");
  searchUrl.searchParams.set("limit", "3");

  try {
    const searchData = await requestJson(searchUrl.toString());
    for (const doc of searchData.docs || []) {
      if (!doc.cover_i) {
        continue;
      }

      const openLibraryUrl = `https://covers.openlibrary.org/b/id/${encodeURIComponent(doc.cover_i)}-L.jpg`;
      const saved = await saveRemoteImage({
        url: openLibraryUrl,
        dirPath: MAGAZINES_DIR,
        slugBase: magazine.title,
        label: `${magazine.title} [Open Library]`,
        usedSlugs,
      });

      if (saved) {
        return buildMagazineManifestEntry(magazine.title, saved, openLibraryUrl);
      }
    }
  } catch (error) {
    console.warn(`[magazine openlibrary miss] ${magazine.title}: ${error.message}`);
  }

  return null;
}

function buildMagazineManifestEntry(title, saved, source) {
  return {
    title,
    file: `magazines/${saved.file}`,
    source,
    width: saved.width,
    height: saved.height,
  };
}

async function saveRemoteImage({ url, dirPath, slugBase, label, usedSlugs }) {
  try {
    const buffer = await requestBuffer(url);
    if (buffer.byteLength < MIN_FILE_BYTES) {
      console.warn(`[skip] ${label} -> too small (${buffer.byteLength} bytes)`);
      return null;
    }

    const imageType = detectImageType(buffer);
    if (imageType !== "jpeg" && imageType !== "png") {
      console.warn(`[skip] ${label} -> unsupported type ${imageType || "unknown"}`);
      return null;
    }

    const size = getImageSize(buffer);
    if (!size) {
      console.warn(`[skip] ${label} -> could not read image size`);
      return null;
    }

    const slug = uniqueSlug(sanitizeSlug(slugBase), usedSlugs);
    const fileName = `${slug}.${imageType === "png" ? "png" : "jpg"}`;
    const filePath = path.join(dirPath, fileName);

    await writeFile(filePath, buffer);
    const fileStats = await stat(filePath);
    if (fileStats.size < MIN_FILE_BYTES) {
      await rm(filePath, { force: true });
      console.warn(`[skip] ${label} -> wrote broken file (${fileStats.size} bytes)`);
      return null;
    }

    console.log(`[saved] ${label} -> ${fileName} (${size.width}x${size.height})`);
    return {
      file: fileName,
      width: size.width,
      height: size.height,
    };
  } catch (error) {
    console.warn(`[save error] ${label}: ${error.message}`);
    return null;
  }
}

function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  return null;
}

function getImageSize(buffer) {
  const type = detectImageType(buffer);
  if (type === "png") {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }
  if (type === "jpeg") {
    return getJpegSize(buffer);
  }
  return null;
}

function getJpegSize(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) {
      return null;
    }

    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker);

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }
  return null;
}

main().catch((error) => {
  console.error(`[fatal] ${error.stack || error.message}`);
  process.exitCode = 1;
});
