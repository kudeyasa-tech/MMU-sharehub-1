/**
 * Supabase configuration
 * ----------------------
 * Paste the values from your Supabase project here:
 * Supabase Dashboard -> Project Settings -> API.
 *
 * The URL looks like: https://abcdefgh.supabase.co
 * The anon key is a long public key starting with "eyJ...".
 *
 * The anon key is safe to use in a browser. Security comes from the row level
 * security (RLS) policies in supabase/migrations/0001_initial.sql, not from
 * hiding this key.
 */

export const supabaseUrl = "https://bpygjjejaxzqwgclyrad.supabase.co";
export const supabaseAnonKey = "sb_publishable_DJo0nriE0WJ--oQs_yxTxg_Adxz8VyP";

/**
 * True once both placeholders have been replaced. Until then the site stays
 * in guest mode with the offline sample notes.
 */
export const isSupabaseConfigured = [supabaseUrl, supabaseAnonKey].every(
  (value) => value && !String(value).startsWith("PASTE_")
);
