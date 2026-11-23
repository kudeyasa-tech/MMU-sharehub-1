/**
 * Supabase Authentication helpers
 * --------------------------------
 * Supabase Auth handles passwords, sessions and reset emails. Row level
 * security policies in supabase/migrations/0001_initial.sql protect profiles.
 * This module exposes registerUser, loginUser, logoutUser, sendPasswordReset,
 * watchAuthState, getUserProfile and ensureUserDocument.
 */

import { isSupabaseConfigured } from "./supabase-config.js";
import { getSupabase, SupabaseNotConfiguredError } from "./supabase.js";

export { isSupabaseConfigured };

function normaliseName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function nameFromUser(user) {
  const metadataName = normaliseName(user?.user_metadata?.full_name);
  if (metadataName.length >= 2) return metadataName;

  const emailName = String(user?.email || "").split("@")[0].trim();
  if (emailName.length >= 2) return emailName.slice(0, 80);

  return "Student";
}

/** Seconds a rate-limit error asks us to wait before retrying. */
export function getAuthRetrySeconds(error) {
  const message = String(error?.message || "").toLowerCase();
  const seconds = message.match(/after\s+(\d+)\s*second/i);
  const minutes = message.match(/after\s+(\d+)\s*minute/i);
  if (seconds) return Math.min(Number(seconds[1]), 300);
  if (minutes) return Math.min(Number(minutes[1]) * 60, 300);
  return 0;
}

/** Turn a Supabase/Postgres error into a short, useful sentence. */
export function getAuthErrorMessage(error, fallback) {
  if (error instanceof SupabaseNotConfiguredError) {
    return "Supabase is not configured yet. Paste your project URL and anon key into js/supabase-config.js, then reload the page.";
  }

  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();

  if (code === "profile/setup-failed") {
    return "Your account was created, but your profile could not be saved. Check that the SQL migration was run and that RLS policies are enabled, then try logging in.";
  }

  if (code === "profile/invalid-name") {
    return "Please enter your full name (at least 2 characters).";
  }

  if (code === "profile/invalid-email") {
    return "That email address does not look valid.";
  }

  if (message.includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }

  if (message.includes("email not confirmed")) {
    return "Please confirm your email address first, then log in.";
  }

  if (message.includes("already registered") || code === "23505") {
    return "An account already exists for that email. Try logging in instead.";
  }

  if (message.includes("password should be at least")) {
    return "Use a password with at least 8 characters.";
  }

  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Network error. Check your connection and your Supabase URL, then try again.";
  }

  if (code === "42501" || message.includes("row level security")) {
    return "Supabase rejected the request. Check that the SQL migration was run and that RLS is enabled.";
  }

  if (message.includes("invalid api key") || message.includes("jwt")) {
    return "Supabase rejected the anon key. Check the value in js/supabase-config.js.";
  }

  const status = Number(error?.status || 0);
  const isRateLimit =
    status === 429 ||
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    message.includes("for security purposes");

  if (isRateLimit) {
    // Supabase's built-in email provider allows only 2 emails per hour for the
    // whole project. With "Confirm email" on, the third signup in an hour fails
    // for everyone, whatever their email address. That needs a dashboard fix
    // (turn confirmation off or add custom SMTP) - it is not a student mistake.
    if (message.includes("email") && message.includes("rate")) {
      return "The library has hit its email limit for this hour. Please try again later, or use Continue with Google to sign up instantly.";
    }

    const wait = getAuthRetrySeconds(error);
    if (wait > 0) {
      return `Too many attempts. Please wait ${wait} seconds, then try again.`;
    }

    return "Too many attempts from this network. Please wait a few minutes, then try again. Continue with Google also works.";
  }

  // Never surface raw backend text. It can contain request IDs, column names
  // or other details that help an attacker map the backend.
  return fallback || "Something went wrong. Please try again.";
}

async function insertProfile(supabase, user, name) {
  // Let Postgres set created_at. A browser clock should not decide it.
  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    email: user.email || "",
    name,
  });

  // 23505 = unique violation, which just means the profile already exists.
  if (error && error.code !== "23505") throw error;
}

/** Read the signed-in user's profile, creating it if it is missing. */
export async function ensureUserDocument(user) {
  if (!user) return null;

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, name, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  await insertProfile(supabase, user, nameFromUser(user));
  return { id: user.id, email: user.email, name: nameFromUser(user) };
}

/** Read the signed-in user's profile document. */
export async function getUserProfile(user) {
  if (!user) return null;

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Create a Supabase Auth account and its public profile row.
 * @param {{name: string, email: string, password: string}} details
 * @returns {Promise<{user: object, needsConfirmation: boolean}>}
 */
export async function registerUser({ name, email, password }) {
  const cleanName = normaliseName(name);
  const cleanEmail = String(email || "").trim();

  if (cleanName.length < 2) {
    const error = new Error("Please enter your full name.");
    error.code = "profile/invalid-name";
    throw error;
  }

  if (!cleanEmail) {
    const error = new Error("Please enter your email address.");
    error.code = "profile/invalid-email";
    throw error;
  }

  if (String(password || "").length < 8) {
    const error = new Error("Use a password with at least 8 characters.");
    error.code = "auth/weak-password";
    throw error;
  }

  const supabase = await getSupabase();

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: { data: { full_name: cleanName } },
  });

  if (error) throw error;
  if (!data.user) {
    const signupError = new Error("Account could not be created.");
    signupError.code = "auth/signup-failed";
    throw signupError;
  }

  // When email confirmation is off, Supabase returns a session immediately.
  // When it is on, the profile is created on the first successful login.
  if (data.session) {
    try {
      await insertProfile(supabase, data.user, cleanName);
    } catch (profileError) {
      console.error("Could not save the user profile:", profileError);
      const setupError = new Error("Profile setup failed.");
      setupError.code = "profile/setup-failed";
      setupError.cause = profileError;
      throw setupError;
    }
  }

  return { user: data.user, needsConfirmation: !data.session };
}

/**
 * Sign in with email/password.
 * @param {{email: string, password: string}} details
 */
export async function loginUser({ email, password }) {
  const cleanEmail = String(email || "").trim();

  if (!cleanEmail) {
    const error = new Error("Please enter your email address.");
    error.code = "profile/invalid-email";
    throw error;
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error) throw error;

  // A profile problem must not block a valid login.
  try {
    await ensureUserDocument(data.user);
  } catch (profileError) {
    console.warn("Signed in, but the profile could not be refreshed:", profileError);
  }

  return data.user;
}

/**
 * Start Google OAuth. Supabase redirects to the exact base URL, then the app
 * sends the student to their profile after processing the callback.
 */
export async function signInWithGoogle() {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });

  if (error) throw error;
}

/** Set a new password after a password-recovery session. */
export async function updatePassword(password) {
  const newPassword = String(password || "");
  if (newPassword.length < 8) {
    const error = new Error("Use a password with at least 8 characters.");
    error.code = "auth/weak-password";
    throw error;
  }

  const supabase = await getSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Sign the current student out. */
export async function logoutUser() {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Send a Supabase password-reset email. */
export async function sendPasswordReset(email) {
  const cleanEmail = String(email || "").trim();
  if (!cleanEmail) {
    const error = new Error("Enter your email address first.");
    error.code = "profile/invalid-email";
    throw error;
  }

  const supabase = await getSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    // Supabase only accepts the exact base URL in Redirect URLs.
    // The browser redirects to login.html?reset=1 after the session is processed.
    redirectTo: `${window.location.origin}/`,
  });

  if (error) throw error;
}

/**
 * Watch the Supabase session. The callback receives (user, meta).
 * meta.error is set if the SDK or session could not be loaded.
 * @param {(user: object|null, meta: {configured: boolean, event?: string, error?: Error}) => void} callback
 * @returns {() => void} unsubscribe
 */
export function watchAuthState(callback) {
  if (!isSupabaseConfigured) {
    queueMicrotask(() => callback(null, { configured: false }));
    return () => {};
  }

  let unsubscribe = null;
  let cancelled = false;

  getSupabase()
    .then((supabase) => {
      if (cancelled) return;

      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        callback(session?.user || null, { configured: true, event });
      });

      unsubscribe = () => data.subscription.unsubscribe();
    })
    .catch((error) => {
      console.error("Supabase could not load:", error);
      if (!cancelled) callback(null, { configured: true, error });
    });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}
