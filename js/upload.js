/**
 * Upload page controller
 * ----------------------
 * The upload flow:
 *   1. Validate the selected file with the shared helpers.
 *   2. Upload to notes/{user-id}/{note-id}/{file-name} with real progress.
 *   3. Save note metadata so the file appears in the public library.
 *   4. Remove the uploaded file if the database write fails.
 *
 * Supabase Storage JS does not expose XHR progress events, so the upload uses
 * the Storage REST endpoint with the signed-in user's access token. Supabase
 * policies still enforce the path, size and MIME type.
 */

import { getUserProfile } from "./auth.js";
import { createNote } from "./database.js";
import { getFriendlyErrorMessage } from "./errors.js";
import { formatFileSize } from "./notes.js";
import {
  getFileTypeLabel,
  sanitiseFileName,
  validateNoteFile,
} from "./storage.js";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseUrl,
} from "./supabase-config.js";
import { getSupabase } from "./supabase.js";

const form = document.getElementById("upload-form");
const fileInput = document.getElementById("note-file");
const selectedFile = document.getElementById("selected-file");
const dropzone = document.querySelector(".dropzone");
const progress = document.getElementById("upload-progress");
const message = form?.querySelector("[data-form-message]");
const submitButton = form?.querySelector('button[type="submit"]');

function showMessage(text, type = "info") {
  if (!message) return;
  message.textContent = text;
  message.classList.add("is-visible");
  message.classList.remove("is-success");
  message.classList.toggle("is-error", type === "error");
}

function clearMessage() {
  if (!message) return;
  message.textContent = "";
  message.classList.remove("is-visible", "is-error", "is-success");
}

function setLoading(loading) {
  if (!submitButton) return;

  if (loading) {
    submitButton.dataset.originalLabel ||= submitButton.textContent;
    submitButton.textContent = "Publishing…";
    submitButton.disabled = true;
    submitButton.classList.add("is-loading");
    form?.setAttribute("aria-busy", "true");
  } else {
    submitButton.textContent = submitButton.dataset.originalLabel || "Publish notes";
    submitButton.disabled = false;
    submitButton.classList.remove("is-loading");
    form?.removeAttribute("aria-busy");
  }
}

function setProgress(percent) {
  if (!progress) return;
  progress.value = percent;
  progress.textContent = `${percent}%`;
  progress.classList.add("is-visible");
}

function hideProgress() {
  if (!progress) return;
  progress.classList.remove("is-visible");
  progress.value = 0;
  progress.textContent = "0%";
}

function showSelectedFile(file, result) {
  if (!selectedFile) return;

  selectedFile.classList.add("is-visible");
  selectedFile.classList.toggle("is-error", !result.valid);

  if (result.valid) {
    selectedFile.textContent = `${file.name} · ${formatFileSize(file.size)} · ready to upload`;
  } else {
    selectedFile.textContent = result.error;
  }
}

/** Upload with a real progress event using the Storage REST endpoint. */
function uploadFile(path, file, accessToken) {
  return new Promise((resolve, reject) => {
    const encodedPath = path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const endpoint = `${supabaseUrl}/storage/v1/object/notes/${encodedPath}`;

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", endpoint, true);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", supabaseAnonKey);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "3600");

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
      setProgress(percent);
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100);
        resolve();
        return;
      }

      // Do not pass Storage's raw response into the UI. It can contain
      // internal paths and request identifiers.
      const error = new Error("Upload failed. Check the file and try again.");
      error.code = "app/upload";
      reject(error);
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Network error during upload. Please try again."))
    );
    xhr.addEventListener("abort", () =>
      reject(new Error("Upload was cancelled."))
    );

    xhr.send(file);
  });
}

/* -------------------------------------------------------------------------- */
/* File selection                                                             */
/* -------------------------------------------------------------------------- */

fileInput?.addEventListener("change", () => {
  clearMessage();

  const file = fileInput.files?.[0];
  if (!file) {
    if (selectedFile) {
      selectedFile.textContent = "";
      selectedFile.classList.remove("is-visible", "is-error");
    }
    return;
  }

  const result = validateNoteFile(file);
  showSelectedFile(file, result);

  if (!result.valid) {
    fileInput.value = "";
  }
});

if (dropzone && fileInput) {
  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

form?.querySelectorAll("input, select, textarea").forEach((field) => {
  if (field === fileInput) return;
  field.addEventListener("input", clearMessage);
  field.addEventListener("change", clearMessage);
});

/* -------------------------------------------------------------------------- */
/* Publish                                                                    */
/* -------------------------------------------------------------------------- */

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  hideProgress();

  if (!isSupabaseConfigured) {
    showMessage(
      "Supabase is not configured yet. Paste your project URL and anon key into js/supabase-config.js, then reload the page.",
      "error"
    );
    return;
  }

  const data = new FormData(form);
  const title = String(data.get("title") || "").trim();
  const subject = String(data.get("subject") || "").trim();
  const faculty = String(data.get("faculty") || "");
  const year = String(data.get("year") || "");
  const description = String(data.get("description") || "").trim();
  const file = fileInput?.files?.[0];

  if (title.length < 5 || title.length > 100) {
    showMessage("Use a title between 5 and 100 characters.", "error");
    return;
  }
  if (subject.length < 2 || subject.length > 60) {
    showMessage("Use a subject between 2 and 60 characters.", "error");
    return;
  }
  if (description.length < 10 || description.length > 500) {
    showMessage("Write a description between 10 and 500 characters.", "error");
    return;
  }
  if (!faculty || !year) {
    showMessage("Choose a faculty and a year.", "error");
    return;
  }

  const fileResult = validateNoteFile(file);
  if (!fileResult.valid) {
    showMessage(fileResult.error, "error");
    return;
  }

  setLoading(true);
  setProgress(0);

  let uploadedPath = null;

  try {
    const supabase = await getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      const error = new Error("Your session has ended. Please log in again.");
      error.code = "app/session";
      throw error;
    }

    const user = session.user;
    const noteId = crypto.randomUUID();
    const safeName = sanitiseFileName(file.name) || `note.${fileResult.extension}`;
    const path = `notes/${user.id}/${noteId}/${safeName}`;

    uploadedPath = path;

    await uploadFile(path, file, session.access_token);

    const { data: publicData } = supabase.storage
      .from("notes")
      .getPublicUrl(path);

    if (!publicData?.publicUrl) {
      const error = new Error("Could not build a public file URL. Check the notes bucket.");
      error.code = "app/config";
      throw error;
    }

    let uploaderName =
      user.user_metadata?.full_name ||
      String(user.email || "").split("@")[0] ||
      "Student";

    try {
      const profile = await getUserProfile(user);
      if (profile?.name) uploaderName = profile.name;
    } catch {
      // Auth metadata is a good enough fallback.
    }

    if (uploaderName.length < 2) uploaderName = "Student";

    await createNote({
      id: noteId,
      title,
      subject,
      faculty,
      year,
      description,
      file_url: publicData.publicUrl,
      file_type: getFileTypeLabel(file.name),
      file_size: file.size,
      uploader_id: user.id,
      uploader_name: uploaderName.slice(0, 80),
    });

    showMessage("Your note is live in the library. Taking you there…", "success");
    window.location.assign("browse.html?published=1");
  } catch (error) {
    console.error("Upload failed:", error);

    // Do not leave an orphaned file if the database write failed.
    if (uploadedPath && !String(error?.message || "").includes("session has ended")) {
      try {
        const supabase = await getSupabase();
        await supabase.storage.from("notes").remove([uploadedPath]);
      } catch (cleanupError) {
        console.warn("Could not remove the orphaned file:", cleanupError);
      }
    }

    showMessage(getFriendlyErrorMessage(error, "Upload failed. Please try again."), "error");
    setLoading(false);
    hideProgress();
  }
});
