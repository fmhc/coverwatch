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

const MAGAZINE_CATEGORY_QUERIES = [
  "Category:Magazine covers",
  "Category:Covers of magazines",
  "Category:Fishing magazines",
  "Category:Angling magazines",
];

const MAGAZINE_SEARCH_TERMS = [
  "magazine cover",
  "cover of magazine",
  "Zeitschrift Titelblatt",
];

const FISHING_MAGAZINE_SEARCH_TERMS = [
  "angling magazine cover",
  "fishing magazine cover",
  "\"The American angler\"",
  "\"tightwad fishing club\"",
  "\"stream insects\" angling",
];

let lastRequestAt = 0;

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
      const googleUrl = new URL("https://www.googleapis.com/books/v1/volumes");
      googleUrl.searchParams.set("q", `intitle:${book.title} inauthor:${book.author}`);
      googleUrl.searchParams.set("country", "DE");
      googleUrl.searchParams.set("maxResults", "5");

      let items = [];
      try {
        const googleData = await requestJson(googleUrl.toString());
        items = googleData.items || [];
      } catch (error) {
        console.warn(`[book google miss] ${book.title}: ${error.message}`);
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
  const seenPages = new Set();
  const targetCount = 130;
  const minimumFishingCount = 3;

  for (const term of FISHING_MAGAZINE_SEARCH_TERMS) {
    if (manifestEntries.filter((entry) => isFishingMagazineTitle(entry.title)).length >= minimumFishingCount) {
      break;
    }

    const pages = await fetchCommonsSearchPages(term, 25);
    console.log(`[magazines] fishing search "${term}" yielded ${pages.length} candidate pages`);

    for (const page of pages) {
      if (manifestEntries.filter((entry) => isFishingMagazineTitle(entry.title)).length >= minimumFishingCount) {
        break;
      }
      if (!isFishingMagazineTitle(page.title || "")) {
        continue;
      }
      const entry = await saveMagazinePage(page, usedSlugs, seenPages);
      if (entry) {
        manifestEntries.push(entry);
      }
    }
  }

  for (const category of MAGAZINE_CATEGORY_QUERIES) {
    if (manifestEntries.length >= targetCount) {
      break;
    }
    const pages = await fetchCommonsCategoryPages(category, 400);
    console.log(`[magazines] ${category} yielded ${pages.length} candidate pages`);

    for (const page of pages) {
      if (manifestEntries.length >= targetCount) {
        break;
      }
      const entry = await saveMagazinePage(page, usedSlugs, seenPages);
      if (entry) {
        manifestEntries.push(entry);
      }
    }
  }

  for (const term of MAGAZINE_SEARCH_TERMS) {
    if (manifestEntries.length >= targetCount) {
      break;
    }
    const pages = await fetchCommonsSearchPages(term, 50);
    console.log(`[magazines] search "${term}" yielded ${pages.length} candidate pages`);

    for (const page of pages) {
      if (manifestEntries.length >= targetCount) {
        break;
      }
      const entry = await saveMagazinePage(page, usedSlugs, seenPages);
      if (entry) {
        manifestEntries.push(entry);
      }
    }
  }

  return manifestEntries;
}

async function fetchCommonsCategoryPages(categoryTitle, limit) {
  const pages = [];
  let gcmcontinue = null;

  while (pages.length < limit) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "categorymembers");
    url.searchParams.set("gcmtitle", categoryTitle);
    url.searchParams.set("gcmtype", "file");
    url.searchParams.set("gcmlimit", "200");
    if (gcmcontinue) {
      url.searchParams.set("gcmcontinue", gcmcontinue);
    }
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|size");
    url.searchParams.set("iiurlwidth", "800");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    try {
      const data = await requestJson(url.toString());
      const batch = Object.values(data.query?.pages || {});
      pages.push(...batch);

      gcmcontinue = data.continue?.gcmcontinue || null;
      if (!gcmcontinue || batch.length === 0) {
        break;
      }
    } catch (error) {
      console.warn(`[commons category error] ${categoryTitle}: ${error.message}`);
      break;
    }
  }

  return pages;
}

async function fetchCommonsSearchPages(searchTerm, limit) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", searchTerm);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", String(limit));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|size");
  url.searchParams.set("iiurlwidth", "800");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  try {
    const data = await requestJson(url.toString());
    return Object.values(data.query?.pages || {});
  } catch (error) {
    console.warn(`[commons search error] ${searchTerm}: ${error.message}`);
    return [];
  }
}

function isFishingMagazineTitle(title) {
  return /(fishing|angling|angler|trout|stream insects)/i.test(title);
}

async function saveMagazinePage(page, usedSlugs, seenPages) {
  try {
    const imageInfo = page.imageinfo?.[0];
    if (!imageInfo?.url) {
      return null;
    }

    const sourceUrl = imageInfo.url;
    const pathname = new URL(sourceUrl).pathname.toLowerCase();
    if (!pathname.endsWith(".jpg") && !pathname.endsWith(".jpeg")) {
      return null;
    }

    if ((imageInfo.width || 0) < 300 || (imageInfo.height || 0) < 300) {
      return null;
    }

    if (seenPages.has(page.title)) {
      return null;
    }

    const title = (page.title || "Magazine cover")
      .replace(/^File:/i, "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/_/g, " ");

    const candidateUrls = [
      sourceUrl,
      imageInfo.responsiveUrls?.["2"],
      imageInfo.thumburl,
    ].filter(Boolean);

    let saved = null;
    for (const candidateUrl of candidateUrls) {
      saved = await saveRemoteImage({
        url: candidateUrl,
        dirPath: MAGAZINES_DIR,
        slugBase: title,
        label: `${title} [Commons]`,
        usedSlugs,
      });
      if (saved) {
        break;
      }
    }

    if (!saved) {
      return null;
    }

    seenPages.add(page.title);
    return {
      title,
      file: `magazines/${saved.file}`,
      source: sourceUrl,
      width: saved.width,
      height: saved.height,
    };
  } catch (error) {
    console.warn(`[magazine error] ${page.title}: ${error.message}`);
    return null;
  }
}

async function saveRemoteImage({ url, dirPath, slugBase, label, usedSlugs }) {
  try {
    const buffer = await requestBuffer(url);
    if (buffer.byteLength < MIN_FILE_BYTES) {
      console.warn(`[skip] ${label} -> too small (${buffer.byteLength} bytes)`);
      return null;
    }

    const imageType = detectImageType(buffer);
    if (imageType !== "jpeg") {
      console.warn(`[skip] ${label} -> unsupported type ${imageType || "unknown"}`);
      return null;
    }

    const size = getImageSize(buffer);
    if (!size) {
      console.warn(`[skip] ${label} -> could not read image size`);
      return null;
    }

    const slug = uniqueSlug(sanitizeSlug(slugBase), usedSlugs);
    const fileName = `${slug}.jpg`;
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
