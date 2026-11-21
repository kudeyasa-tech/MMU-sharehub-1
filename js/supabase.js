/**
 * Shared Supabase client
 * ----------------------
 * The Supabase JS SDK is loaded from a CDN only when a real config is present.
 * That keeps the sample-data site usable offline with no console errors.
 */

import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseUrl,
} from "./supabase-config.js";

const SDK_URL = "https://esm.sh/@supabase/supabase-js@2.119.2";

let clientPromise = null;

/** A predictable error for the "config still has PASTE_..." case. */
export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase is not configured. Paste your project URL and anon key into js/supabase-config.js."
    );
    this.name = "SupabaseNotConfiguredError";
    this.code = "app/not-configured";
  }
}

/**
 * Get the single shared Supabase client.
 * @returns {Promise<object>}
 */
export function getSupabase() {
  if (!isSupabaseConfigured) {
    return Promise.reject(new SupabaseNotConfiguredError());
  }

  if (!clientPromise) {
    clientPromise = import(SDK_URL)
      .then(({ createClient }) =>
        createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        })
      )
      .catch((error) => {
        // Allow a retry after a temporary network failure.
        clientPromise = null;
        throw error;
      });
  }

  return clientPromise;
}
