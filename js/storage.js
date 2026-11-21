/**
 * Storage helpers
 * ---------------
 * Pure file-validation logic. It gives fast feedback in the browser; the
 * Storage bucket configuration repeats the same limits server-side.
 *
 * Rules of the upload:
 * - 20 MB maximum
 * - PDF, DOC, DOCX, PPT, PPTX, TXT, JPG, PNG only
 * - everything else (including .exe, .bat, .js, .html) is rejected
 */

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB in bytes

export const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "txt",
  "jpg",
  "jpeg",
  "png",
];

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/jpeg",
  "image/png",
];

/** "my notes.PDF" -> "pdf" */
export function getFileExtension(fileName) {
  const name = String(fileName || "");
  const lastDot = name.lastIndexOf(".");
  if (lastDot === -1 || lastDot === name.length - 1) return "";
  return name.slice(lastDot + 1).toLowerCase();
}

/**
 * Convert a Supabase public file URL back into a Storage object path.
 * Returns null for anything that is not a public notes/... URL.
 */
export function getStoragePathFromUrl(publicUrl) {
  try {
    const url = new URL(String(publicUrl || ""));
    const marker = "/storage/v1/object/public/";
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;

    const path = url.pathname.slice(index + marker.length);
    if (!path.startsWith("notes/")) return null;

    return path
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return null;
  }
}

/** Turn a file extension into the label stored in the notes table. */
export function getFileTypeLabel(fileName) {
  const extension = getFileExtension(fileName);
  const labels = {
    pdf: "PDF",
    doc: "DOC",
    docx: "DOCX",
    ppt: "PPT",
    pptx: "PPTX",
    txt: "TXT",
    jpg: "JPG",
    jpeg: "JPG",
    png: "PNG",
  };
  return labels[extension] || "FILE";
}

/** Make a safe filename for Supabase Storage. */
export function sanitiseFileName(fileName) {
  return String(fileName || "note")
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);
}

/**
 * Validate a selected file.
 * @param {File} file
 * @returns {{valid: true, extension: string, mimeType: string, size: number}
 *          | {valid: false, error: string}}
 */
export function validateNoteFile(file) {
  if (!file) {
    return { valid: false, error: "Please choose a file to upload." };
  }

  const extension = getFileExtension(file.name);
  if (!extension) {
    return {
      valid: false,
      error: "The file needs a valid extension, such as .pdf or .docx.",
    };
  }

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: "Only PDF, DOC, DOCX, PPT, PPTX, TXT, JPG and PNG files are allowed.",
    };
  }

  // Some browsers leave the MIME type empty. In that case the extension
  // check above is still required, and Supabase Storage rules check again.
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: "That file type is not allowed. Please upload a document or image.",
    };
  }

  if (file.size === 0) {
    return { valid: false, error: "This file is empty." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "The file is too large. Maximum size is 20 MB." };
  }

  return {
    valid: true,
    extension,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}

/* Uploads are handled by js/upload.js using the Storage REST endpoint so the
   browser can report real progress. The rules above are mirrored in the
   `notes` bucket configuration in supabase/migrations/0001_initial.sql. */
