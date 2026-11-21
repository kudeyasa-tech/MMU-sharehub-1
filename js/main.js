/**
 * Shared site behaviour
 * ---------------------
 * - Mobile navigation
 * - Active navigation link
 * - Password show/hide
 * - Demo messages for sample notes
 * - Session-aware navbar
 * - Upload/profile sign-in gates
 * - Home page "recent notes" list
 *
 * Supabase Authentication is connected in Phase 2. Database reads and file
 * uploads follow in Phases 3–4.
 */

import { isSupabaseConfigured, logoutUser, watchAuthState } from "./auth.js";
import { getNotes } from "./database.js";
import { createNoteCard, getInitials } from "./notes.js";

const body = document.body;
const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const siteNav = document.getElementById("site-nav");

// Avoid a flash of "Log in" buttons before a saved session is restored.
if (isSupabaseConfigured) {
  body.classList.add("auth-pending");
}

/* -------------------------------------------------------------------------- */
/* Mobile navigation                                                          */
/* -------------------------------------------------------------------------- */

function closeMobileMenu() {
  if (!navToggle) return;
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.setAttribute("aria-label", "Open navigation");
  body.classList.remove("nav-open");
}

function toggleMobileMenu() {
  const isOpen = body.classList.toggle("nav-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
}

if (navToggle && siteNav) {
  navToggle.addEventListener("click", toggleMobileMenu);

  siteNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMobileMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileMenu();
  });

  const desktopQuery = window.matchMedia("(min-width: 861px)");
  desktopQuery.addEventListener("change", (event) => {
    if (event.matches) closeMobileMenu();
  });
}

/* -------------------------------------------------------------------------- */
/* Header shadow while scrolling                                              */
/* -------------------------------------------------------------------------- */

if (header) {
  const updateHeader = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
}

/* -------------------------------------------------------------------------- */
/* Highlight the current page in the navbar                                   */
/* -------------------------------------------------------------------------- */

const currentPage = body.dataset.page;
if (currentPage) {
  document.querySelectorAll(".nav-link[data-page]").forEach((link) => {
    if (link.dataset.page === currentPage) {
      link.setAttribute("aria-current", "page");
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Current year in the footer                                                 */
/* -------------------------------------------------------------------------- */

document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

/* -------------------------------------------------------------------------- */
/* Password visibility buttons                                                */
/* -------------------------------------------------------------------------- */

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  const field = button.closest(".password-field");
  const input = field?.querySelector("input");
  if (!input) return;

  button.addEventListener("click", () => {
    const willShow = input.type === "password";
    input.type = willShow ? "text" : "password";
    button.setAttribute("aria-pressed", String(willShow));
    button.setAttribute("aria-label", willShow ? "Hide password" : "Show password");
  });
});

/* -------------------------------------------------------------------------- */
/* Toast messages                                                             */
/* -------------------------------------------------------------------------- */

let toastTimer;

export function showToast(message) {
  let toast = document.getElementById("app-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("is-visible");

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 4500);
}

/* Note actions: real files first, sample-data demo fallback second. */
document.addEventListener("click", (event) => {
  const preview = event.target.closest("[data-preview-url]");
  if (preview) {
    event.preventDefault();
    window.open(preview.dataset.previewUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const download = event.target.closest("[data-download-url]");
  if (download) {
    event.preventDefault();
    const link = document.createElement("a");
    link.href = download.dataset.downloadUrl;
    link.rel = "noopener";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("Your download should start in a new tab.");
    return;
  }

  const trigger = event.target.closest("[data-demo-action]");
  if (!trigger) return;

  if (trigger.tagName === "A") event.preventDefault();

  const action = trigger.dataset.demoAction;
  const title = trigger.dataset.demoTitle;

  if (action === "preview") {
    showToast(
      title
        ? `“${title}” is sample data. Real notes can be previewed from Supabase Storage.`
        : "This is a sample note."
    );
    return;
  }

  if (action === "download") {
    showToast("Downloads work on real notes stored in Supabase Storage.");
    return;
  }

  showToast("This feature is connected in a later phase.");
});

/* -------------------------------------------------------------------------- */
/* Session-aware UI (Supabase Authentication)                                  */
/* -------------------------------------------------------------------------- */

let welcomeShown = false;

function fullUserName(user) {
  return (
    user?.user_metadata?.full_name ||
    String(user?.email || "")
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .trim() ||
    "Student"
  );
}

function firstName(user) {
  return fullUserName(user).split(/\s+/)[0];
}

function updateAuthUI(user) {
  const signedIn = Boolean(user);

  body.classList.remove("auth-pending");
  body.classList.toggle("is-signed-in", signedIn);
  body.dataset.authState = signedIn ? "signed-in" : "guest";

  document.querySelectorAll(".auth-guest").forEach((element) => {
    element.hidden = signedIn;
  });
  document.querySelectorAll(".auth-user").forEach((element) => {
    element.hidden = !signedIn;
  });

  if (signedIn) {
    const fullName = fullUserName(user);
    const shortName = firstName(user);

    document.querySelectorAll("[data-user-name]").forEach((element) => {
      element.textContent = shortName;
      element.title = fullName;
    });
    document.querySelectorAll("[data-user-avatar]").forEach((element) => {
      element.textContent = getInitials(fullName);
    });
  }

  // upload.html and profile.html use a sign-in gate instead of a redirect.
  if (body.dataset.page === "upload") {
    const gate = document.getElementById("upload-gate");
    const panel = document.getElementById("upload-panel");
    if (gate) gate.hidden = signedIn;
    if (panel) panel.hidden = !signedIn;
  }

  if (body.dataset.page === "profile") {
    const gate = document.getElementById("profile-gate");
    const panel = document.getElementById("profile-panel");
    if (gate) gate.hidden = signedIn;
    if (panel) panel.hidden = !signedIn;
  }

  if (
    signedIn &&
    body.dataset.page === "profile" &&
    !welcomeShown &&
    new URLSearchParams(window.location.search).get("welcome") === "1"
  ) {
    welcomeShown = true;
    showToast(`Welcome to ShareHub, ${firstName(user)}. Your account is ready.`);
  }

  // Page-specific scripts (profile.js) can react without a second listener.
  document.dispatchEvent(
    new CustomEvent("sharehub:auth", { detail: { user } })
  );
}

watchAuthState((user, meta) => {
  if (meta.error) {
    showToast(
      "Supabase could not be reached. Check your connection and your supabase-config.js values."
    );
  }

  // Reset links land on the allowed base URL. Supabase processes the token,
  // then we send the student to the password form on the same site.
  if (meta.event === "PASSWORD_RECOVERY" && body.dataset.page !== "login") {
    window.location.replace("login.html?reset=1");
    return;
  }

  updateAuthUI(user);
});

/* Confirmation after a successful upload. */
if (new URLSearchParams(window.location.search).get("published") === "1") {
  showToast("Your note is live in the library. Thanks for sharing!");
}

/* Log out from any page that shows the button. */
document.querySelectorAll("[data-logout]").forEach((button) => {
  button.addEventListener("click", async () => {
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Logging out…";

    try {
      await logoutUser();
      showToast("You have been signed out.");
      window.location.assign("index.html");
    } catch (error) {
      console.error("Could not sign out:", error);
      showToast("Could not sign out. Please try again.");
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Recent notes on the home page                                              */
/* -------------------------------------------------------------------------- */

const recentNotesGrid = document.getElementById("recent-notes");

if (recentNotesGrid) {
  try {
    const notes = await getNotes();
    const recentNotes = notes.slice(0, 3);

    recentNotesGrid.innerHTML = recentNotes
      .map((note) => createNoteCard(note, { featured: true }))
      .join("");

    if (recentNotes.length === 0) {
      recentNotesGrid.innerHTML = `
        <div class="empty-state">
          <h3>No notes yet</h3>
          <p>Be the first student to share a set of notes.</p>
        </div>
      `;
    }
  } catch (error) {
    console.error("Could not load recent notes:", error);
    recentNotesGrid.innerHTML = `
      <div class="empty-state">
        <h3>Notes could not be loaded</h3>
        <p>Please refresh the page and try again.</p>
      </div>
    `;
  }
}
