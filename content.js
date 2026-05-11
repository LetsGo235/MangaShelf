const MANIFEST_URL = "manifest.json";

function normalizeRemotePath(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return path.replace(/^\.\//, "");
}

async function getRemoteManifest() {
  try {
    const response = await fetch(`${MANIFEST_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Manifest not found: ${response.status}`);
    const manifest = await response.json();
    return manifest;
  } catch (error) {
    console.warn("No manifest.json found or it could not be loaded.", error);
    return { manga: [] };
  }
}

function remoteLibraryFromManifest(manifest) {
  return (manifest.manga || []).map(item => ({
    id: item.id,
    source: "github",
    title: item.title,
    author: item.author || "",
    status: item.status || "",
    description: item.description || "",
    coverUrl: normalizeRemotePath(item.cover),
    chapterCount: (item.chapters || []).length,
    updatedAt: item.updatedAt ? new Date(item.updatedAt).getTime() : 0,
    chapters: item.chapters || []
  }));
}

async function getRemoteLibrary() {
  const manifest = await getRemoteManifest();
  return remoteLibraryFromManifest(manifest);
}

async function getRemoteMangaBundle(mangaId) {
  const manifest = await getRemoteManifest();
  const item = (manifest.manga || []).find(manga => manga.id === mangaId);
  if (!item) return { manga: null, chapters: [] };

  const chapters = (item.chapters || []).map(chapter => ({
    id: chapter.id,
    mangaId: item.id,
    title: chapter.title || chapter.id,
    pages: (chapter.pages || []).map(normalizeRemotePath),
    pageCount: (chapter.pages || []).length
  })).sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));

  return {
    manga: {
      id: item.id,
      source: "github",
      title: item.title,
      author: item.author || "",
      status: item.status || "",
      description: item.description || "",
      coverUrl: normalizeRemotePath(item.cover)
    },
    chapters
  };
}
