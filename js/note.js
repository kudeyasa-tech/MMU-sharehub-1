/**
 * Note detail page
 * ----------------
 * Shows the full description and file actions for one note, loads related
 * notes from the same subject, and lets signed-in students report content that
 * breaks the community guidelines.
 */

import { watchAuthState } from "./auth.js";
import {
  createNoteCard,
  escapeHtml,
  formatDate,
  formatFileSize,
  getFileTypeClass,
  getInitials,
} from "./notes.js";
import { createReport, getNoteById, getNotes, hasReported } from "./database.js";
import { getFriendlyErrorMessage } from "./errors.js";
import { safeFileUrl, withDownloadParam } from "./security.js";
import { isSupabaseConfigured } from "./supabase-config.js";
import { showToast } from "./main.js";

const noteId = new URLSearchParams(window.location.search).get("id");
const detailEl = document.getElementById("note-detail");
const titleEl = document.getElementById("detail-title");
const subtitleEl = document.getElementById("detail-subtitle");
const relatedEl = document.getElementById("related-notes");

const reportDialog = document.getElementById("report-dialog");
const reportForm = document.getElementById("report-form");
const reportMessage = document.getElementById("report-message");

let currentNote = null;
let currentUser = null;

function showMessage(text, type = "info") {
  if (!reportMessage) return;
  reportMessage.textContent = text;
  reportMessage.classList.add("is-visible");
  reportMessage.classList.remove("is-success");
  reportMessage.classList.toggle("is-error", type === "error");
  reportMessage.classList.toggle("is-success", type === "success");
}

function clearMessage() {
  if (!reportMessage) return;
  reportMessage.textContent = "";
  reportMessage.classList.remove("is-visible", "is-error", "is-success");
}

function renderError(title, description) {
  if (!detailEl) return;
  detailEl.innerHTML = `
    <div class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      <a class="btn btn-soft" href="browse.html">Browse all notes</a>
    </div>
  `;
}

function renderNote(note) {
  if (!detailEl) return;

  currentNote = note;
  const title = escapeHtml(note.title);
  const description = escapeHtml(note.description || "No description provided.");
  const subject = escapeHtml(note.subject);
  const faculty = escapeHtml(note.faculty);
  const year = escapeHtml(note.year);
  const uploader = escapeHtml(note.uploader_name);
  const initials = escapeHtml(getInitials(note.uploader_name));
  const type = escapeHtml(String(note.file_type || "FILE").toUpperCase());
  const typeClass = getFileTypeClass(note.file_type);
  const size = escapeHtml(formatFileSize(note.file_size));
  const date = escapeHtml(formatDate(note.created_at));
  const fileUrl = safeFileUrl(note.file_url);
  const previewUrl = fileUrl ? escapeHtml(fileUrl) : "";
  const downloadUrl = fileUrl ? escapeHtml(withDownloadParam(fileUrl, note.title)) : "";

  if (titleEl) titleEl.textContent = note.title;
  if (subtitleEl) {
    subtitleEl.textContent = `${note.subject} · ${note.faculty} · ${note.year}`;
  }
  document.title = `${note.title} — MMU ShareHub`;

  detailEl.innerHTML = `
    <div class="detail-top">
      <div class="detail-badges">
        <span class="file-badge file-badge--${typeClass}">${type}</span>
        <span class="tag">${subject}</span>
        <span class="tag tag--subtle">${year}</span>
      </div>
      <span class="detail-date">Shared ${date}</span>
    </div>

    <p class="detail-description">${description}</p>

    <div class="detail-facts">
      <div class="detail-fact">
        <span>Faculty</span>
        <strong>${faculty}</strong>
      </div>
      <div class="detail-fact">
        <span>File size</span>
        <strong>${size}</strong>
      </div>
      <div class="detail-fact">
        <span>Shared by</span>
        <strong>${initials} ${uploader}</strong>
      </div>
      <div class="detail-fact">
        <span>File type</span>
        <strong>${type}</strong>
      </div>
    </div>

    <div class="detail-actions">
      ${
        fileUrl
          ? `<button class="btn btn-soft" type="button" data-preview-url="${previewUrl}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>
              Preview in new tab
             </button>
             <button class="btn btn-primary" type="button" data-download-url="${downloadUrl}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 20h16"/></svg>
              Download
             </button>`
          : `<button class="btn btn-soft" type="button" data-demo-action="preview" data-demo-title="${title}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>
              Preview
             </button>
             <button class="btn btn-primary" type="button" data-demo-action="download" data-demo-title="${title}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 20h16"/></svg>
              Download
             </button>`
      }
      <button class="btn btn-danger" id="report-button" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4m0 1h11l-2 4 2 4H5"/></svg>
        Report note
      </button>
    </div>
    <p class="detail-hint">Notes are shared by students. Report copyrighted, confidential, plagiarised or broken material.</p>
  `;

  bindReportButton();
}

async function loadRelatedNotes(note) {
  if (!relatedEl) return;

  try {
    const notes = await getNotes();
    const related = notes
      .filter((item) => item.id !== note.id && item.subject === note.subject)
      .slice(0, 3);

    if (related.length === 0) {
      relatedEl.innerHTML = `
        <div class="empty-state">
          <h3>No related notes yet</h3>
          <p>Browse the library to find notes from other subjects.</p>
          <a class="btn btn-soft" href="browse.html">Browse all notes</a>
        </div>
      `;
      return;
    }

    relatedEl.innerHTML = related.map((item) => createNoteCard(item)).join("");
  } catch (error) {
    console.warn("Could not load related notes:", error);
    relatedEl.innerHTML = "";
  }
}

function bindReportButton() {
  const button = document.getElementById("report-button");
  button?.addEventListener("click", async () => {
    if (!currentNote) return;

    if (!currentUser) {
      window.location.assign("login.html");
      return;
    }

    if (!isSupabaseConfigured) {
      showToast("Reports need a configured Supabase project.");
      return;
    }

    clearMessage();
    button.disabled = true;

    try {
      const alreadyReported = await hasReported(currentNote.id, currentUser.id);
      if (alreadyReported) {
        showMessage("You already reported this note. We have it.", "error");
        reportDialog?.showModal();
        return;
      }
      reportDialog?.showModal();
    } catch (error) {
      console.warn("Could not check existing reports:", error);
      showMessage(getFriendlyErrorMessage(error, "Could not open the report form."), "error");
      reportDialog?.showModal();
    } finally {
      button.disabled = false;
    }
  });
}

reportForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  if (!currentNote || !currentUser) return;

  const reason = document.getElementById("report-reason")?.value || "";
  const details = document.getElementById("report-details")?.value || "";

  if (!reason) {
    showMessage("Choose a reason for the report.", "error");
    return;
  }

  const submit = reportForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = "Sending…";

  try {
    await createReport({
      noteId: currentNote.id,
      reporterId: currentUser.id,
      reason,
      details,
    });

    reportDialog?.close();
    showToast("Report sent. Thank you for helping keep the library safe.");
  } catch (error) {
    console.warn("Could not submit the report:", error);
    showMessage(getFriendlyErrorMessage(error, "Could not send the report."), "error");
  } finally {
    submit.disabled = false;
    submit.textContent = "Send report";
  }
});

document.querySelectorAll("[data-dialog-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog")?.close());
});

reportDialog?.addEventListener("click", (event) => {
  if (event.target === reportDialog) reportDialog.close();
});

watchAuthState((user) => {
  currentUser = user;
});

async function init() {
  if (!noteId) {
    renderError("No note selected", "Open a note from the library to see its details.");
    return;
  }

  try {
    const note = await getNoteById(noteId);
    if (!note) {
      renderError("Note not found", "This note may have been removed by its uploader.");
      return;
    }

    renderNote(note);
    await loadRelatedNotes(note);
  } catch (error) {
    console.error("Could not load the note:", error);
    renderError("Could not load notes", "Please refresh the page and try again.");
  }
}

init();
