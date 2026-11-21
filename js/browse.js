/**
 * Browse page
 * -----------
 * Loads notes, fills the filter dropdowns, and filters the list as the
 * student types or changes a filter. Notes come from js/database.js, and the
 * filtering itself stays in the browser.
 */

import { filterNotes, getNotes, getUniqueValues } from "./database.js";
import { createNoteCard } from "./notes.js";

const searchForm = document.getElementById("browse-search-form");
const searchInput = document.getElementById("note-search");
const filterPanel = document.getElementById("filter-form");
const subjectFilter = document.getElementById("subject-filter");
const facultyFilter = document.getElementById("faculty-filter");
const yearFilter = document.getElementById("year-filter");
const sortSelect = document.getElementById("sort-select");
const notesGrid = document.getElementById("browse-notes");
const resultsCount = document.getElementById("results-count");
const emptyState = document.getElementById("empty-state");
const emptyTitle = document.getElementById("empty-title");
const emptyDescription = document.getElementById("empty-description");
const clearFiltersButton = document.getElementById("clear-filters");
const emptyClearButton = document.getElementById("empty-clear");

let allNotes = [];
let searchTimer;

/** Read the filters from the form. */
function getCurrentFilters() {
  return {
    query: searchInput?.value || "",
    subject: subjectFilter?.value || "",
    faculty: facultyFilter?.value || "",
    year: yearFilter?.value || "",
    sort: sortSelect?.value || "newest",
  };
}

/** Put the current filters into the address bar so links can be shared. */
function syncUrl(filters) {
  const url = new URL(window.location.href);
  const entries = {
    q: filters.query.trim(),
    subject: filters.subject,
    faculty: filters.faculty,
    year: filters.year,
    sort: filters.sort === "newest" ? "" : filters.sort,
  };

  Object.entries(entries).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
  });

  window.history.replaceState({}, "", url);
}

/** Fill a <select> with an "All ..." option and unique values. */
function fillSelect(select, values, allLabel) {
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = allLabel;
  select.appendChild(allOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if (values.includes(currentValue)) select.value = currentValue;
}

/** Show a loading skeleton while the data request is running. */
function showSkeletons() {
  if (!notesGrid) return;

  notesGrid.innerHTML = Array.from(
    { length: 6 },
    () => `
      <div class="note-card skeleton-card" aria-hidden="true">
        <div class="skeleton skeleton--badge"></div>
        <div class="skeleton skeleton--title"></div>
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--text skeleton--short"></div>
        <div class="skeleton skeleton--footer"></div>
      </div>
    `
  ).join("");
}

/** Render the filtered notes. */
function renderNotes(notes, filters) {
  if (!notesGrid || !emptyState || !resultsCount) return;

  const hasFilters = Boolean(
    filters.query || filters.subject || filters.faculty || filters.year
  );

  if (notes.length === 0) {
    notesGrid.innerHTML = "";
    notesGrid.hidden = true;
    emptyState.hidden = false;

    if (emptyTitle && emptyDescription) {
      emptyTitle.textContent = filters.query
        ? `No notes match “${filters.query}”`
        : "No notes match these filters";
      emptyDescription.textContent = "Try a different subject, faculty or year.";
    }

    resultsCount.textContent = "0 notes found";
    return;
  }

  notesGrid.hidden = false;
  emptyState.hidden = true;
  notesGrid.innerHTML = notes.map((note) => createNoteCard(note)).join("");

  const label = notes.length === 1 ? "note" : "notes";
  resultsCount.innerHTML = hasFilters
    ? `Showing <strong>${notes.length}</strong> matching ${label}`
    : `Showing all <strong>${notes.length}</strong> ${label}`;
}

/** Apply all current filters, then update the URL. */
function applyFilters({ updateUrl = true } = {}) {
  const filters = getCurrentFilters();
  const filteredNotes = filterNotes(allNotes, filters);

  renderNotes(filteredNotes, filters);
  if (updateUrl) syncUrl(filters);

  if (clearFiltersButton) {
    const hasFilters = Boolean(
      filters.query || filters.subject || filters.faculty || filters.year
    );
    clearFiltersButton.disabled = !hasFilters;
  }
}

/** Reset all controls and show every note again. */
function clearAllFilters() {
  if (searchInput) searchInput.value = "";
  if (subjectFilter) subjectFilter.value = "";
  if (facultyFilter) facultyFilter.value = "";
  if (yearFilter) yearFilter.value = "";
  if (sortSelect) sortSelect.value = "newest";

  applyFilters();
  searchInput?.focus();
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

filterPanel?.addEventListener("change", () => applyFilters());

searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  applyFilters();
});

searchInput?.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => applyFilters(), 180);
});

sortSelect?.addEventListener("change", () => applyFilters());

clearFiltersButton?.addEventListener("click", clearAllFilters);
emptyClearButton?.addEventListener("click", clearAllFilters);

/* -------------------------------------------------------------------------- */
/* Initial load                                                               */
/* -------------------------------------------------------------------------- */

async function initBrowsePage() {
  if (!notesGrid) return;

  showSkeletons();

  try {
    allNotes = await getNotes();

    fillSelect(
      subjectFilter,
      getUniqueValues(allNotes, "subject"),
      "All subjects"
    );
    fillSelect(
      facultyFilter,
      getUniqueValues(allNotes, "faculty"),
      "All faculties"
    );
    fillSelect(yearFilter, getUniqueValues(allNotes, "year"), "All years");

    // Read filters from a shared link such as browse.html?q=database
    const params = new URLSearchParams(window.location.search);
    if (searchInput) searchInput.value = params.get("q") || "";
    if (subjectFilter) subjectFilter.value = params.get("subject") || "";
    if (facultyFilter) facultyFilter.value = params.get("faculty") || "";
    if (yearFilter) yearFilter.value = params.get("year") || "";
    if (sortSelect) sortSelect.value = params.get("sort") || "newest";

    applyFilters({ updateUrl: false });
  } catch (error) {
    console.error("Could not load notes:", error);
    notesGrid.hidden = true;
    if (emptyState) emptyState.hidden = false;
    if (emptyTitle) emptyTitle.textContent = "Could not load notes";
    if (emptyDescription) {
      emptyDescription.textContent =
        "Something went wrong. Refresh the page and try again.";
    }
    if (resultsCount) resultsCount.textContent = "Unable to load notes";
    if (clearFiltersButton) clearFiltersButton.disabled = true;
  }
}

initBrowsePage();
