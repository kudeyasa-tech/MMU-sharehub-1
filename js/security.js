/**
 * Shared URL and identifier checks
 * --------------------------------
 * These helpers are defence in depth. Supabase RLS and Storage policies are the
 * real boundary, but the browser should never open or download a URL that did
 * not come from this project's public notes bucket.
 */

import { supabaseUrl } from "./supabase-config.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let allowedOrigin = null;

function getAllowedOrigin() {
  if (!allowedOrigin) {
    try {
      allowedOrigin = new URL(supabaseUrl).origin;
    } catch {
      allowedOrigin = "";
    }
  }
  return allowedOrigin;
}

/** True only for this project's public Storage object URLs. */
export function isAllowedFileUrl(value) {
  const raw = String(value || "");
  if (!raw.startsWith("https://")) return false;

  try {
    const url = new URL(raw);
    return (
      url.origin === getAllowedOrigin() &&
      url.pathname.startsWith("/storage/v1/object/public/notes/")
    );
  } catch {
    return false;
  }
}

/** Return the URL only when it is safe to open or download. */
export function safeFileUrl(value) {
  const raw = String(value || "");
  return isAllowedFileUrl(raw) ? raw : "";
}

/** Validate a UUID before using it in a query or URL. */
export function isUuid(value) {
  return UUID_PATTERN.test(String(value || ""));
}

/** Build a Supabase Storage download URL without trusting the input host. */
export function withDownloadParam(fileUrl, fallbackName) {
  const safe = safeFileUrl(fileUrl);
  if (!safe) return "";

  let fileName = String(fallbackName || "note");
  try {
    const fromPath = new URL(safe).pathname.split("/").pop();
    if (fromPath) fileName = decodeURIComponent(fromPath);
  } catch {
    // Keep the fallback name.
  }

  return `${safe}?download=${encodeURIComponent(fileName)}`;
}
