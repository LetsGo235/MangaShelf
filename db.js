const DB_NAME = "MangaShelfDB";
const DB_VERSION = 1;
const MANGA_STORE = "manga";
const CHAPTER_STORE = "chapters";
const PAGE_STORE = "pages";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(MANGA_STORE)) {
        const manga = db.createObjectStore(MANGA_STORE, { keyPath: "id" });
        manga.createIndex("title", "title", { unique: false });
      }

      if (!db.objectStoreNames.contains(CHAPTER_STORE)) {
        const chapters = db.createObjectStore(CHAPTER_STORE, { keyPath: "id" });
        chapters.createIndex("mangaId", "mangaId", { unique: false });
      }

      if (!db.objectStoreNames.contains(PAGE_STORE)) {
        const pages = db.createObjectStore(PAGE_STORE, { keyPath: "id" });
        pages.createIndex("chapterId", "chapterId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(db, storeName, mode = "readonly") {
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function makeId(...parts) {
  return parts.map(slugify).join("__");
}

async function getAll(storeName) {
  const db = await openDB();
  return requestToPromise(txStore(db, storeName).getAll());
}

async function getById(storeName, id) {
  const db = await openDB();
  return requestToPromise(txStore(db, storeName).get(id));
}

async function getByIndex(storeName, indexName, value) {
  const db = await openDB();
  const store = txStore(db, storeName);
  return requestToPromise(store.index(indexName).getAll(value));
}

async function saveChapter({ title, chapterName, coverFile, pageFiles }) {
  const mangaId = makeId(title);
  const chapterId = makeId(title, chapterName);
  const now = Date.now();
  const sortedPages = [...pageFiles].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const db = await openDB();
  const tx = db.transaction([MANGA_STORE, CHAPTER_STORE, PAGE_STORE], "readwrite");
  const mangaStore = tx.objectStore(MANGA_STORE);
  const chapterStore = tx.objectStore(CHAPTER_STORE);
  const pageStore = tx.objectStore(PAGE_STORE);

  const existingManga = await requestToPromise(mangaStore.get(mangaId));
  const existingCover = existingManga?.coverBlob;
  const coverBlob = coverFile || existingCover || sortedPages[0];

  mangaStore.put({
    id: mangaId,
    title,
    coverBlob,
    updatedAt: now,
    createdAt: existingManga?.createdAt || now
  });

  chapterStore.put({
    id: chapterId,
    mangaId,
    title: chapterName,
    pageCount: sortedPages.length,
    updatedAt: now
  });

  const oldPages = await requestToPromise(pageStore.index("chapterId").getAll(chapterId));
  oldPages.forEach(page => pageStore.delete(page.id));

  sortedPages.forEach((file, index) => {
    pageStore.put({
      id: `${chapterId}__page-${String(index + 1).padStart(4, "0")}`,
      mangaId,
      chapterId,
      order: index + 1,
      fileName: file.name,
      blob: file
    });
  });

  await txDone(tx);
  return { mangaId, chapterId, pages: sortedPages.length };
}

async function getLibrary() {
  const [manga, chapters] = await Promise.all([getAll(MANGA_STORE), getAll(CHAPTER_STORE)]);
  return manga.map(item => {
    const ownedChapters = chapters.filter(ch => ch.mangaId === item.id);
    return {
      ...item,
      chapterCount: ownedChapters.length,
      latestChapter: ownedChapters.sort((a, b) => b.updatedAt - a.updatedAt)[0]
    };
  });
}

async function getMangaBundle(mangaId) {
  const manga = await getById(MANGA_STORE, mangaId);
  const chapters = await getByIndex(CHAPTER_STORE, "mangaId", mangaId);
  chapters.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
  return { manga, chapters };
}

async function getChapterPages(chapterId) {
  const pages = await getByIndex(PAGE_STORE, "chapterId", chapterId);
  return pages.sort((a, b) => a.order - b.order);
}

async function wipeLibrary() {
  indexedDB.deleteDatabase(DB_NAME);
}
