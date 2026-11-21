/**
 * Profile page controller
 * -----------------------
 * Phase 4 adds note management:
 *   - list the signed-in student's uploaded notes
 *   - edit title, subject, faculty, year and description
 *   - delete the note metadata and its Storage file together
 *
 * The file URL and ownership fields are never sent from this page. RLS plus a
 * database trigger enforce that on the server.
 */

import { getUserProfile, watchAuthState } from "./auth.js";
import { deleteNote, getNotes, updateNote } from "./database.js";
import { FACULTIES, YEARS } from "./mock-data.js";
import { showToast } from "./main.js";
import {
  escapeHtml,
  formatFileSize,
  getFileTypeClass,
  getInitials,
} from "./notes.js";
import { getStoragePathFromUrl } from "./storage.js";
import { getSupabase } from "./supabase.js";

const nameEl = document.getElementById("profile-summary-name");
const emailEl = document.getElementById("profile-email");
const avatarEl = document.getElementById("profile-avatar");
const joinedEl = document.getElementById("profile-joined");
const noteCountEl = document.getElementById("profile-note-count");
const listEl = document.getElementById("my-notes-list");

const editDialog = document.getElementById("edit-note-dialog");
const editForm = document.getElementById("edit-note-form");
const editMessage = editDialog?.querySelector("[data-edit-message]");
const deleteDialog = document.getElementById("delete-note-dialog");
const deleteMessage = deleteDialog?.querySelector("[data-delete-message]");
const confirmDeleteButton = document.getElementById("confirm-delete");
const deleteNameEl = document.getElementById("delete-note-name");

let myNotes = [];
let editingNoteId = null;
let deletingNoteId = null;
const emptyStateHtml = listEl?.innerHTML || "";

function formatJoined(value) {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString("en-MY", {
      month: "short",
      year: "numeric",
    });
  }
  return "recently";
}

function setMessage(element, text, type = "info") {
  if (!element) return;
  element.textContent = text;
  element.classList.add("is-visible");
  element.classList.remove("is-success");
  element.classList.toggle("is-error", type === "error");
}

function clearMessage(element) {
  if (!element) return;
  element.textContent = "";
  element.classList.remove("is-visible", "is-error", "is-success");
}

function fillSelect(select, values, placeholder) {
  if (!select) return;

  select.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  select.appendChild(first);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function renderNotes() {
  if (!listEl) return;

  if (noteCountEl) noteCountEl.textContent = String(myNotes.length);

  if (myNotes.length === 0) {
    listEl.innerHTML = emptyStateHtml;
    return;
  }

  listEl.innerHTML = myNotes
    .map((note) => {
      const title = escapeHtml(note.title);
      const subject = escapeHtml(note.subject);
      const size = escapeHtml(formatFileSize(note.file_size));
      const typeClass = getFileTypeClass(note.file_type);
      const type = escapeHtml(String(note.file_type || "FILE").toUpperCase());
      const url = String(note.file_url || "");
      const safeUrl = url.startsWith("https://") ? escapeHtml(url) : "";

      return `
        <div class="profile-note-row" data-row-id="${escapeHtml(note.id)}">
          <span class="file-badge file-badge--${typeClass}">${type}</span>
          <span class="profile-note-row__main">
            <strong>${title}</strong>
            <span>${subject} · ${size}</span>
          </span>
          <span class="profile-note-row__actions">
            ${
              safeUrl
                ? `<a class="icon-button" href="${safeUrl}" target="_blank" rel="noopener" aria-label="Open ${title}">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6m0-6-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>
                   </a>`
                : ""
            }
            <button class="icon-button" type="button" data-edit-note="${escapeHtml(note.id)}" aria-label="Edit ${title}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"/></svg>
            </button>
            <button class="icon-button icon-button--danger" type="button" data-delete-note="${escapeHtml(note.id)}" aria-label="Delete ${title}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>
            </button>
          </span>
        </div>
      `;
    })
    .join("");
}

/* -------------------------------------------------------------------------- */
/* Edit dialog                                                                */
/* -------------------------------------------------------------------------- */

function openEditDialog(note) {
  editingNoteId = note.id;
  clearMessage(editMessage);

  document.getElementById("edit-title").value = note.title || "";
  document.getElementById("edit-subject").value = note.subject || "";
  document.getElementById("edit-faculty").value = note.faculty || "";
  document.getElementById("edit-year").value = note.year || "";
  document.getElementById("edit-description").value = note.description || "";

  editDialog?.showModal();
}

editForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(editMessage);

  if (!editingNoteId) return;

  const patch = {
    title: document.getElementById("edit-title").value.trim(),
    subject: document.getElementById("edit-subject").value.trim(),
    faculty: document.getElementById("edit-faculty").value,
    year: document.getElementById("edit-year").value,
    description: document.getElementById("edit-description").value.trim(),
  };

  if (patch.title.length < 5 || patch.title.length > 100) {
    setMessage(editMessage, "Use a title between 5 and 100 characters.", "error");
    return;
  }
  if (patch.subject.length < 2 || patch.subject.length > 60) {
    setMessage(editMessage, "Use a subject between 2 and 60 characters.", "error");
    return;
  }
  if (patch.description.length < 10 || patch.description.length > 500) {
    setMessage(editMessage, "Write a description between 10 and 500 characters.", "error");
    return;
  }
  if (!patch.faculty || !patch.year) {
    setMessage(editMessage, "Choose a faculty and a year.", "error");
    return;
  }

  const submit = editForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = "Saving…";

  try {
    const updated = await updateNote(editingNoteId, patch);
    myNotes = myNotes.map((note) => (note.id === updated.id ? updated : note));
    renderNotes();
    editDialog?.close();
    showToast("Note details updated.");
  } catch (error) {
    console.warn("Could not update the note:", error);
    setMessage(editMessage, error?.message || "Could not save the changes.", "error");
  } finally {
    submit.disabled = false;
    submit.textContent = "Save changes";
  }
});

/* -------------------------------------------------------------------------- */
/* Delete dialog                                                              */
/* -------------------------------------------------------------------------- */

function openDeleteDialog(note) {
  deletingNoteId = note.id;
  clearMessage(deleteMessage);
  if (deleteNameEl) deleteNameEl.textContent = note.title || "this note";
  deleteDialog?.showModal();
}

confirmDeleteButton?.addEventListener("click", async () => {
  if (!deletingNoteId) return;

  const note = myNotes.find((item) => item.id === deletingNoteId);
  if (!note) return;

  clearMessage(deleteMessage);
  confirmDeleteButton.disabled = true;
  confirmDeleteButton.textContent = "Deleting…";

  try {
    // Remove the metadata first so a Storage failure cannot leave a visible
    // note with a broken file. A failed file delete only leaves an orphan.
    await deleteNote(deletingNoteId);

    const storagePath = getStoragePathFromUrl(note.file_url);
    if (storagePath) {
      try {
        const supabase = await getSupabase();
        const { error } = await supabase.storage
          .from("notes")
          .remove([storagePath]);
        if (error) throw error;
      } catch (fileError) {
        console.warn("Note deleted but its file could not be removed:", fileError);
        showToast("Note deleted. The file could not be removed from Storage.");
      }
    }

    myNotes = myNotes.filter((item) => item.id !== deletingNoteId);
    renderNotes();
    deleteDialog?.close();
    showToast("Note deleted.");
  } catch (error) {
    console.warn("Could not delete the note:", error);
    setMessage(deleteMessage, error?.message || "Could not delete the note.", "error");
  } finally {
    confirmDeleteButton.disabled = false;
    confirmDeleteButton.textContent = "Delete note";
    deletingNoteId = null;
  }
});

/* -------------------------------------------------------------------------- */
/* Row actions                                                                */
/* -------------------------------------------------------------------------- */

listEl?.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-note]");
  if (editButton) {
    const note = myNotes.find((item) => item.id === editButton.dataset.editNote);
    if (note) openEditDialog(note);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-note]");
  if (deleteButton) {
    const note = myNotes.find(
      (item) => item.id === deleteButton.dataset.deleteNote
    );
    if (note) openDeleteDialog(note);
  }
});

/* -------------------------------------------------------------------------- */
/* Shared dialog behaviour                                                    */
/* -------------------------------------------------------------------------- */

document.querySelectorAll("[data-dialog-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog")?.close());
});

[editDialog, deleteDialog].forEach((dialog) => {
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

fillSelect(document.getElementById("edit-faculty"), FACULTIES, "Select a faculty");
fillSelect(document.getElementById("edit-year"), YEARS, "Select a year");

/* -------------------------------------------------------------------------- */
/* Load profile                                                               */
/* -------------------------------------------------------------------------- */

watchAuthState(async (user) => {
  if (!user) return;

  let profile = null;

  try {
    profile = await getUserProfile(user);
  } catch (error) {
    console.warn("Could not read the profile document:", error);
  }

  try {
    myNotes = (await getNotes()).filter((note) => note.uploader_id === user.id);
  } catch (error) {
    console.warn("Could not load notes:", error);
    myNotes = [];
  }
  renderNotes();

  const name =
    profile?.name ||
    user.user_metadata?.full_name ||
    String(user.email || "").split("@")[0] ||
    "Student";

  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = user.email || "No email on this account";
  if (avatarEl) avatarEl.textContent = getInitials(name);

  const created = profile?.created_at || user.created_at;
  if (joinedEl) {
    joinedEl.textContent = created ? formatJoined(created) : "recently";
  }
});
