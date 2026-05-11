const params = new URLSearchParams(location.search);
const mangaId = params.get("manga");
const chapterFromUrl = params.get("chapter");
const source = params.get("source") || "github";

const mangaTitle = document.getElementById("mangaTitle");
const chapterTitle = document.getElementById("chapterTitle");
const chapterSelect = document.getElementById("chapterSelect");
const pagesEl = document.getElementById("pages");
const prevChapterBtn = document.getElementById("prevChapter");
const nextChapterBtn = document.getElementById("nextChapter");
const bottomPrev = document.getElementById("bottomPrev");
const bottomNext = document.getElementById("bottomNext");
const toggleFit = document.getElementById("toggleFit");
const toggleReadMode = document.getElementById("toggleReadMode");

let manga = null;
let chapters = [];
let currentIndex = 0;
let objectUrls = [];
let currentPages = [];
let readMode = localStorage.getItem("mangashelf-read-mode") || "scroll";
let fitMode = localStorage.getItem("mangashelf-fit-mode") || "fit";
let spreadIndex = 0;

function cleanupUrls() {
  objectUrls.forEach(url => URL.revokeObjectURL(url));
  objectUrls = [];
}

function setChapterUrl(chapterId) {
  const url = new URL(location.href);
  url.searchParams.set("source", source);
  url.searchParams.set("chapter", chapterId);
  history.replaceState(null, "", url.toString());
}

async function loadPages(chapter) {
  if (source === "github") {
    return chapter.pages.map((src, index) => ({ src, order: index + 1 }));
  }

  const localPages = await getChapterPages(chapter.id);
  return localPages.map(page => {
    const url = URL.createObjectURL(page.blob);
    objectUrls.push(url);
    return { src: url, order: page.order };
  });
}

function updateModeButtons() {
  const fit = fitMode === "fit";
  pagesEl.classList.toggle("fit-width", fit);
  pagesEl.classList.toggle("original", !fit);
  toggleFit.textContent = fit ? "Fit Width" : "Original Size";
  toggleReadMode.textContent = readMode === "book" ? "Scroll Mode" : "Book Mode";
}

function createPageImage(page, chapter) {
  const img = document.createElement("img");
  img.src = page.src;
  img.alt = `${chapter.title} page ${page.order}`;
  img.loading = "lazy";
  return img;
}

function renderScrollPages(chapter) {
  pagesEl.className = "pages";
  updateModeButtons();
  currentPages.forEach(page => pagesEl.appendChild(createPageImage(page, chapter)));
}

function renderBookSpread(chapter) {
  pagesEl.className = "pages book-pages";
  updateModeButtons();

  const wrapper = document.createElement("div");
  wrapper.className = "book-shell";

  const toolbar = document.createElement("div");
  toolbar.className = "spread-toolbar";

  const prev = document.createElement("button");
  prev.className = "mini";
  prev.textContent = "← Pages";
  prev.disabled = spreadIndex <= 0;

  const label = document.createElement("strong");
  const first = currentPages[spreadIndex];
  const second = currentPages[spreadIndex + 1];
  label.textContent = second
    ? `Pages ${first.order}–${second.order}`
    : `Page ${first ? first.order : 1}`;

  const next = document.createElement("button");
  next.className = "mini";
  next.textContent = "Pages →";
  next.disabled = spreadIndex + 2 >= currentPages.length;

  toolbar.append(prev, label, next);

  const spread = document.createElement("div");
  spread.className = "spread";

  // Two-page spread, grouped automatically: 1+2, 3+4, 5+6...
  currentPages.slice(spreadIndex, spreadIndex + 2).forEach(page => {
    const slot = document.createElement("div");
    slot.className = "page-slot";
    slot.appendChild(createPageImage(page, chapter));
    spread.appendChild(slot);
  });

  wrapper.append(toolbar, spread);
  pagesEl.appendChild(wrapper);

  prev.addEventListener("click", () => {
    spreadIndex = Math.max(0, spreadIndex - 2);
    pagesEl.innerHTML = "";
    renderBookSpread(chapter);
  });

  next.addEventListener("click", () => {
    spreadIndex = Math.min(currentPages.length - 1, spreadIndex + 2);
    pagesEl.innerHTML = "";
    renderBookSpread(chapter);
  });
}

function renderPagesForMode(chapter) {
  pagesEl.innerHTML = "";
  if (readMode === "book") renderBookSpread(chapter);
  else renderScrollPages(chapter);
}

async function renderChapter(index) {
  currentIndex = Math.max(0, Math.min(index, chapters.length - 1));
  const chapter = chapters[currentIndex];

  cleanupUrls();
  pagesEl.innerHTML = "";
  mangaTitle.textContent = manga.title;
  chapterTitle.textContent = `${chapter.title} • ${readMode === "book" ? "Book spread" : "Scroll reader"}`;
  chapterSelect.value = chapter.id;
  setChapterUrl(chapter.id);

  currentPages = await loadPages(chapter);
  spreadIndex = 0;
  renderPagesForMode(chapter);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < chapters.length - 1;
  prevChapterBtn.disabled = !hasPrev;
  bottomPrev.disabled = !hasPrev;
  nextChapterBtn.disabled = !hasNext;
  bottomNext.disabled = !hasNext;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goPrev() { if (currentIndex > 0) renderChapter(currentIndex - 1); }
function goNext() { if (currentIndex < chapters.length - 1) renderChapter(currentIndex + 1); }

async function initReader() {
  if (!mangaId) {
    mangaTitle.textContent = "No manga selected.";
    return;
  }

  const bundle = source === "local" ? await getMangaBundle(mangaId) : await getRemoteMangaBundle(mangaId);
  manga = bundle.manga;
  chapters = bundle.chapters;

  if (!manga || !chapters.length) {
    mangaTitle.textContent = "Manga not found.";
    chapterTitle.textContent = source === "github"
      ? "Check manifest.json and make sure the manga id, chapter ids, and image paths are correct."
      : "Go back to the library and select an uploaded title.";
    return;
  }

  chapterSelect.innerHTML = chapters.map(ch => `<option value="${ch.id}">${ch.title}</option>`).join("");
  const startIndex = chapterFromUrl ? chapters.findIndex(ch => ch.id === chapterFromUrl) : 0;
  await renderChapter(startIndex >= 0 ? startIndex : 0);
}

chapterSelect.addEventListener("change", () => {
  const index = chapters.findIndex(ch => ch.id === chapterSelect.value);
  if (index >= 0) renderChapter(index);
});

prevChapterBtn.addEventListener("click", goPrev);
bottomPrev.addEventListener("click", goPrev);
nextChapterBtn.addEventListener("click", goNext);
bottomNext.addEventListener("click", goNext);

toggleFit.addEventListener("click", () => {
  fitMode = fitMode === "fit" ? "original" : "fit";
  localStorage.setItem("mangashelf-fit-mode", fitMode);
  renderPagesForMode(chapters[currentIndex]);
});

toggleReadMode.addEventListener("click", () => {
  readMode = readMode === "book" ? "scroll" : "book";
  localStorage.setItem("mangashelf-read-mode", readMode);
  spreadIndex = 0;
  chapterTitle.textContent = `${chapters[currentIndex].title} • ${readMode === "book" ? "Book spread" : "Scroll reader"}`;
  renderPagesForMode(chapters[currentIndex]);
});

document.addEventListener("keydown", (event) => {
  if (readMode !== "book") return;
  if (event.key === "ArrowRight") {
    spreadIndex = Math.min(currentPages.length - 1, spreadIndex + 2);
    renderPagesForMode(chapters[currentIndex]);
  }
  if (event.key === "ArrowLeft") {
    spreadIndex = Math.max(0, spreadIndex - 2);
    renderPagesForMode(chapters[currentIndex]);
  }
});

window.addEventListener("beforeunload", cleanupUrls);
initReader();
