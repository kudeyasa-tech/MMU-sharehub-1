/**
 * Login, register and password-reset page controller
 * ---------------------------------------------------
 * Supabase Auth accepts only the exact base URL as a redirect URL, so reset
 * links land on index.html. main.js then sends the student here with ?reset=1
 * after Supabase has processed the recovery token.
 */

import {
  getAuthErrorMessage,
  isSupabaseConfigured,
  loginUser,
  registerUser,
  sendPasswordReset,
  signInWithGoogle,
  updatePassword,
  watchAuthState,
} from "./auth.js";

const form = document.querySelector("[data-auth-form]");
const resetForm = document.querySelector("[data-reset-form]");
const setupNotice = document.querySelector("[data-supabase-notice]");
const message = form?.querySelector("[data-form-message]");
const resetMessage = resetForm?.querySelector("[data-reset-message]");
const submitButton = form?.querySelector('button[type="submit"]');
const resetButton = resetForm?.querySelector('button[type="submit"]');
const forgotButton = document.querySelector("[data-forgot-password]");
const emailInput = form?.querySelector('input[name="email"]');
const passwordInput = form?.querySelector("[data-password-primary]");
const confirmPasswordInput = form?.querySelector("[data-password-confirm]");
const resetPasswordInput = resetForm?.querySelector("[data-password-primary]");
const resetConfirmInput = resetForm?.querySelector("[data-password-confirm]");

const params = new URLSearchParams(window.location.search);
const isResetMode = params.get("reset") === "1";

let isSubmitting = false;
let redirecting = false;

/** Only allow a local page name such as upload.html in ?next=. */
function getDestination() {
  const next = params.get("next");
  if (next && /^[a-z][a-z0-9-]*\.html$/i.test(next)) {
    return next;
  }
  return "profile.html";
}

const destination = getDestination();

function showMessage(text, type = "info", target = message) {
  if (!target) return;
  target.textContent = text;
  target.classList.add("is-visible");
  target.classList.toggle("is-error", type === "error");
  target.classList.toggle("is-success", type === "success");
}

function clearMessage(target = message) {
  if (!target) return;
  target.textContent = "";
  target.classList.remove("is-visible", "is-error", "is-success");
}

function setBusy(button, busy, label) {
  if (!button) return;

  if (busy) {
    button.dataset.originalLabel ||= button.textContent;
    button.textContent = label;
    button.disabled = true;
    button.classList.add("is-loading");
  } else {
    button.textContent = button.dataset.originalLabel || label;
    button.disabled = false;
    button.classList.remove("is-loading");
  }
}

function redirectTo(target) {
  const targetUrl =
    target === "profile.html" ? "profile.html?welcome=1" : target;
  window.location.assign(targetUrl);
}

/* Switch the login card into password-reset mode. */
if (isResetMode && resetForm) {
  form.hidden = true;
  resetForm.hidden = false;
  if (setupNotice) setupNotice.hidden = true;

  const eyebrow = document.querySelector(".auth-form-wrap .eyebrow");
  const heading = document.getElementById("login-title");
  const intro = document.querySelector(".auth-form-wrap__intro");

  if (eyebrow) eyebrow.textContent = "Account recovery";
  if (heading) heading.textContent = "Set a new password";
  if (intro) intro.textContent = "Choose a new password for your ShareHub account.";
}

if (setupNotice && !isSupabaseConfigured && !isResetMode) {
  setupNotice.hidden = false;
}

watchAuthState((user, meta) => {
  if (meta.error) {
    showMessage(getAuthErrorMessage(meta.error), "error", resetModeMessage());
    return;
  }

  // During recovery, main.js handles the redirect from the base URL. Stay here
  // so the student can enter a new password.
  if (meta.event === "PASSWORD_RECOVERY") return;

  if (isResetMode && !user) {
    showMessage(
      "This reset link has expired. Request a new one from the login page.",
      "error",
      resetMessage
    );
    return;
  }

  if (user && !isResetMode && !isSubmitting && !redirecting) {
    redirecting = true;
    redirectTo(destination);
  }
});

function resetModeMessage() {
  return isResetMode ? resetMessage : message;
}

/* Password confirmation is checked by the browser before submit. */
function watchPasswordMatch(primary, confirm) {
  if (!primary || !confirm) return;

  const checkPasswords = () => {
    const isMatch = primary.value === confirm.value;
    confirm.setCustomValidity(isMatch ? "" : "The two passwords do not match.");
  };

  primary.addEventListener("input", checkPasswords);
  confirm.addEventListener("input", checkPasswords);
}

watchPasswordMatch(passwordInput, confirmPasswordInput);
watchPasswordMatch(resetPasswordInput, resetConfirmInput);

form?.querySelectorAll("input").forEach((input) => {
  input.addEventListener("input", () => clearMessage(message));
});

resetForm?.querySelectorAll("input").forEach((input) => {
  input.addEventListener("input", () => clearMessage(resetMessage));
});

document.querySelectorAll("[data-google-signin]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!isSupabaseConfigured) {
      if (setupNotice) setupNotice.hidden = false;
      showMessage(
        "Supabase is not configured yet. Paste your project URL and anon key into js/supabase-config.js, then reload the page.",
        "error",
        resetModeMessage()
      );
      return;
    }

    setBusy(button, true, "Connecting…");

    try {
      await signInWithGoogle();
    } catch (error) {
      console.warn("Google sign-in failed:", error);
      showMessage(getAuthErrorMessage(error), "error", resetModeMessage());
      setBusy(button, false, "Continue with Google");
    }
  });
});

forgotButton?.addEventListener("click", async () => {
  const email = emailInput?.value.trim() || "";

  if (!email) {
    emailInput?.focus();
    showMessage(
      "Enter your email address above, then choose Forgot password again.",
      "error"
    );
    return;
  }

  if (!isSupabaseConfigured) {
    if (setupNotice) setupNotice.hidden = false;
    showMessage(
      "Supabase is not configured yet. Paste your project URL and anon key into js/supabase-config.js, then reload the page.",
      "error"
    );
    return;
  }

  setBusy(forgotButton, true, "Sending…");

  try {
    await sendPasswordReset(email);
    showMessage(
      `Password reset email sent to ${email}. Check your inbox and spam folder.`,
      "success"
    );
  } catch (error) {
    showMessage(getAuthErrorMessage(error), "error");
  } finally {
    setBusy(forgotButton, false, "Forgot password?");
  }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(message);

  if (!isSupabaseConfigured) {
    if (setupNotice) setupNotice.hidden = false;
    showMessage(
      "Supabase is not configured yet. Paste your project URL and anon key into js/supabase-config.js, then reload the page.",
      "error"
    );
    return;
  }

  const data = new FormData(form);
  const isRegister = form.dataset.authForm === "register";

  isSubmitting = true;
  setBusy(submitButton, true, isRegister ? "Creating your account…" : "Signing you in…");

  try {
    if (isRegister) {
      const result = await registerUser({
        name: String(data.get("name") || ""),
        email: String(data.get("email") || ""),
        password: String(data.get("password") || ""),
      });

      if (result.needsConfirmation) {
        showMessage(
          "Account created. Check your email for the confirmation link, then log in.",
          "success"
        );
        isSubmitting = false;
        setBusy(submitButton, false, "Create account");
        return;
      }

      showMessage("Account created. Taking you to your profile…", "success");
    } else {
      await loginUser({
        email: String(data.get("email") || ""),
        password: String(data.get("password") || ""),
      });
      showMessage("Signed in. Taking you to your profile…", "success");
    }

    redirecting = true;
    redirectTo(destination);
  } catch (error) {
    console.warn("Authentication failed:", error);
    showMessage(getAuthErrorMessage(error), "error");
    isSubmitting = false;
    setBusy(submitButton, false, "Log in");
  }
});

resetForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(resetMessage);

  if (!isSupabaseConfigured) {
    showMessage(
      "Supabase is not configured yet. Paste your project URL and anon key into js/supabase-config.js, then reload the page.",
      "error",
      resetMessage
    );
    return;
  }

  const password = resetPasswordInput?.value || "";
  setBusy(resetButton, true, "Updating…");

  try {
    await updatePassword(password);
    showMessage(
      "Password updated. Taking you to your profile…",
      "success",
      resetMessage
    );
    window.setTimeout(() => window.location.assign("profile.html"), 700);
  } catch (error) {
    console.warn("Password update failed:", error);
    showMessage(getAuthErrorMessage(error), "error", resetMessage);
    setBusy(resetButton, false, "Update password");
  }
});
