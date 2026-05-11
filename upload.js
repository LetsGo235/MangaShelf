const mangaTitle = document.getElementById("mangaTitle");
const chapterName = document.getElementById("chapterName");
const coverInput = document.getElementById("coverInput");
const pageInput = document.getElementById("pageInput");
const uploadBtn = document.getElementById("uploadBtn");
const clearFormBtn = document.getElementById("clearFormBtn");
const wipeBtn = document.getElementById("wipeBtn");
const statusBox = document.getElementById("status");

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.style.color = isError ? "#ef4444" : "#49d17d";
}

function clearForm() {
  mangaTitle.value = "";
  chapterName.value = "";
  coverInput.value = "";
  pageInput.value = "";
  setStatus("");
}

uploadBtn.addEventListener("click", async () => {
  const title = mangaTitle.value.trim();
  const chapter = chapterName.value.trim();
  const pages = [...pageInput.files];

  if (!title) return setStatus("Add a manga title first.", true);
  if (!chapter) return setStatus("Add a chapter number or name first.", true);
  if (!pages.length) return setStatus("Choose at least one page image.", true);

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Saving...";

  try {
    const result = await saveChapter({
      title,
      chapterName: chapter,
      coverFile: coverInput.files[0],
      pageFiles: pages
    });
    setStatus(`Saved ${result.pages} page(s). Open the library to read it.`);
  } catch (error) {
    console.error(error);
    setStatus("Upload failed. The images may be too large for browser storage.", true);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Save Chapter";
  }
});

clearFormBtn.addEventListener("click", clearForm);

wipeBtn.addEventListener("click", async () => {
  const confirmed = confirm("Delete all local manga data from this browser?");
  if (!confirmed) return;
  await wipeLibrary();
  setStatus("Local manga database deleted. Refresh the page.");
});
