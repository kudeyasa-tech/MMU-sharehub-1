/** User-facing error text. Never return raw backend messages to the UI. */

import { getAuthErrorMessage } from "./auth.js";

const FRIENDLY = {
  "23505": "That has already been submitted.",
  "23514": "One of the values did not pass the database rules.",
  "23503": "The related record no longer exists.",
  "42501": "The database rejected the request. Check the SQL migration and RLS policies.",
  PGRST205: "A database table is missing. Run the SQL migration.",
  "413": "The file is too large. The maximum is 20 MB.",
  "422": "That file type is not allowed.",
};

/** Map an error to a short, safe sentence. */
export function getFriendlyErrorMessage(error, fallback) {
  const code = String(error?.code || error?.status || "");

  if (code.startsWith("auth/")) {
    return getAuthErrorMessage(error, fallback);
  }

  // Codes we set ourselves carry a message that is safe to display.
  if (code.startsWith("app/")) {
    return error.message;
  }

  if (FRIENDLY[code]) return FRIENDLY[code];

  return fallback || "That did not work. Please try again.";
}
