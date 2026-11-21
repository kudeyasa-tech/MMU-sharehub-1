/**
 * Shared note-card renderer
 * -------------------------
 * The same card is used on the home page and the browse page.
 * All values from the database are escaped before they are placed in HTML.
 */

/** Stop database text from being interpreted as HTML. */
export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** "Aisyah Rahman" becomes "AR". */
export function getInitials(name) {
  const parts = String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Pick one of the four avatar colours without using inline styles. */
function getAvatarTone(value) {
  let total = 0;
  for (const character of String(value)) {
    total += character.charCodeAt(0);
  }
  return total % 4;
}

/** Format a byte count for humans. */
export function formatFileSize(bytes) {
  const number = Number(bytes);
  if (!Number.isFinite(number) || number <= 0) return "File";

  if (number < 1024 * 1024) {
    return `${Math.max(1, Math.round(number / 1024))} KB`;
  }

  return `${(number / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format an ISO date, with a simple fallback for bad values. */
export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently added";

  return date.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getFileTypeClass(fileType) {
  const allowed = {
    PDF: "pdf",
    DOC: "doc",
    DOCX: "doc",
    PPT: "ppt",
    PPTX: "ppt",
    TXT: "txt",
    JPG: "img",
    JPEG: "img",
    PNG: "img",
  };

  return allowed[String(fileType || "").toUpperCase()] || "file";
}

/** Only allow real HTTPS URLs from the database. */
function safeFileUrl(value) {
  const url = String(value || "");
  return url.startsWith("https://") ? url : "";
}

/** Add Supabase Storage's download query parameter. */
function downloadUrl(fileUrl, fallbackName) {
  let fileName = fallbackName || "note";

  try {
    const fromPath = String(fileUrl).split("?")[0].split("/").pop();
    if (fromPath) fileName = decodeURIComponent(fromPath);
  } catch {
    // Keep the fallback name if the URL cannot be decoded.
  }

  return `${String(fileUrl).split("?")[0]}?download=${encodeURIComponent(
    fileName
  )}`;
}

/**
 * Build the HTML for one note card.
 * @param {object} note
 * @param {{featured?: boolean}} options
 * @returns {string}
 */
export function createNoteCard(note, options = {}) {
  const title = escapeHtml(note.title);
  const description = escapeHtml(note.description);
  const subject = escapeHtml(note.subject);
  const faculty = escapeHtml(note.faculty);
  const year = escapeHtml(note.year);
  const uploader = escapeHtml(note.uploader_name);
  const fileType = escapeHtml(String(note.file_type || "FILE").toUpperCase());
  const typeClass = getFileTypeClass(note.file_type);
  const fileSize = formatFileSize(note.file_size);
  const date = formatDate(note.created_at);
  const initials = escapeHtml(getInitials(note.uploader_name));
  const tone = getAvatarTone(note.uploader_name);
  const featuredClass = options.featured ? " note-card--featured" : "";
  const detailUrl = escapeHtml(`note.html?id=${encodeURIComponent(note.id)}`);
  const fileUrl = safeFileUrl(note.file_url);
  const previewUrl = fileUrl ? escapeHtml(fileUrl) : "";
  const downloadLink = fileUrl
    ? escapeHtml(downloadUrl(fileUrl, note.title))
    : "";

  return `
    <article class="note-card${featuredClass}" data-note-id="${escapeHtml(note.id)}">
      <div class="note-card__top">
        <span class="file-badge file-badge--${typeClass}">${fileType}</span>
        <span class="note-card__size">${escapeHtml(fileSize)}</span>
      </div>

      <div class="note-card__body">
        <div class="note-card__tags">
          <span class="tag">${subject}</span>
          <span class="tag tag--subtle">${year}</span>
        </div>
        <h3 class="note-card__title"><a href="${detailUrl}">${title}</a></h3>
        <p class="note-card__description">${description}</p>
        <p class="note-card__faculty">${faculty}</p>
      </div>

      <div class="note-card__meta">
        <span class="avatar avatar--tone-${tone}" aria-hidden="true">${initials}</span>
        <span class="note-card__uploader">
          <small>Shared by</small>
          <strong>${uploader}</strong>
        </span>
        <time class="note-card__date" datetime="${escapeHtml(note.created_at)}">${date}</time>
      </div>

      <div class="note-card__actions">
        ${
          fileUrl
            ? `<button class="btn btn-soft btn-sm" type="button" data-preview-url="${previewUrl}" data-demo-title="${title}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
            <circle cx="12" cy="12" r="2.7" />
          </svg>
          Preview
        </button>
        <button class="btn btn-primary btn-sm" type="button" data-download-url="${downloadLink}" data-demo-title="${title}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 20h16" />
          </svg>
          Download
        </button>`
            : `<button class="btn btn-soft btn-sm" type="button" data-demo-action="preview" data-demo-title="${title}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
            <circle cx="12" cy="12" r="2.7" />
          </svg>
          Preview
        </button>
        <button class="btn btn-primary btn-sm" type="button" data-demo-action="download" data-demo-title="${title}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 20h16" />
          </svg>
          Download
        </button>`
        }
      </div>
    </article>
  `;
}
