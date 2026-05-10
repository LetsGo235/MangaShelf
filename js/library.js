const grid = document.getElementById("mangaGrid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const shelfNotice = document.getElementById("shelfNotice");
let library = [];

function coverUrl(item) {
  if (item.coverUrl) return item.coverUrl;
  return item.coverBlob ? URL.createObjectURL(item.coverBlob) : "";
}

function readerLink(item) {
  const source = item.source === "github" ? "github" : "local";
  return `reader.html?source=${source}&manga=${encodeURIComponent(item.id)}`;
}

function renderLibrary() {
  const search = searchInput.value.trim().toLowerCase();
  const sort = sortSelect.value;

  let items = library.filter(item => item.title.toLowerCase().includes(search));

  if (sort === "az") items.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "chapters") items.sort((a, b) => b.chapterCount - a.chapterCount);
  if (sort === "updated") items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  grid.innerHTML = "";
  emptyState.classList.toggle("hidden", items.length > 0);

  items.forEach(item => {
    const card = document.createElement("a");
    card.className = "card";
    card.href = readerLink(item);
    card.innerHTML = `
      <div class="source-tag ${item.source === "github" ? "online" : "local"}">${item.source === "github" ? "ONLINE" : "LOCAL"}</div>
      <img class="cover" src="${coverUrl(item)}" alt="${item.title} cover" />
      <div class="card-content">
        <h3>${item.title}</h3>
        <p>${item.chapterCount} chapter${item.chapterCount === 1 ? "" : "s"}</p>
        ${item.description ? `<p class="tiny-desc">${item.description}</p>` : ""}
        <span class="button primary">Read</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

async function init() {
  const [remoteLibrary, localLibrary] = await Promise.all([
    getRemoteLibrary(),
    getLibrary().catch(() => [])
  ]);
  library = [...remoteLibrary, ...localLibrary.map(item => ({ ...item, source: "local" }))];

  if (shelfNotice) {
    shelfNotice.textContent = `${remoteLibrary.length} online title(s) from GitHub · ${localLibrary.length} local title(s) in this browser`;
  }

  renderLibrary();
}

searchInput.addEventListener("input", renderLibrary);
sortSelect.addEventListener("change", renderLibrary);
init();
