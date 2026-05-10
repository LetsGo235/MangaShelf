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

let manga = null;
let chapters = [];
let currentIndex = 0;
let objectUrls = [];

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

async function renderChapter(index) {
  currentIndex = Math.max(0, Math.min(index, chapters.length - 1));
  const chapter = chapters[currentIndex];

  cleanupUrls();
  pagesEl.innerHTML = "";
  mangaTitle.textContent = manga.title;
  chapterTitle.textContent = chapter.title;
  chapterSelect.value = chapter.id;
  setChapterUrl(chapter.id);

  const pages = await loadPages(chapter);

  pages.forEach(page => {
    const img = document.createElement("img");
    img.src = page.src;
    img.alt = `${chapter.title} page ${page.order}`;
    img.loading = "lazy";
    pagesEl.appendChild(img);
  });

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
  const fit = pagesEl.classList.toggle("fit-width");
  pagesEl.classList.toggle("original", !fit);
  toggleFit.textContent = fit ? "Fit Width" : "Original Size";
});

window.addEventListener("beforeunload", cleanupUrls);
initReader();
