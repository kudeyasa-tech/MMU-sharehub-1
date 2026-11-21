/**
 * Data access layer
 * -----------------
 * When Supabase is configured, notes are read from the public `notes` table.
 * Without a config (or before the SQL migration is run), the site falls back to
 * local sample data so development never stops.
 *
 * Keeping data access in one file means page code does not need to change when
 * the backend switches on.
 */

import { sampleNotes } from "./mock-data.js";
import { isUuid } from "./security.js";
import { isSupabaseConfigured } from "./supabase-config.js";
import { getSupabase } from "./supabase.js";

const NOTE_COLUMNS =
  "id, title, subject, faculty, year, description, file_url, file_type, file_size, uploader_id, uploader_name, created_at";

/** Map a Postgres row to the shape used by the note-card renderer. */
function rowToNote(row) {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    faculty: row.faculty,
    year: row.year,
    description: row.description,
    file_url: row.file_url,
    file_type: row.file_type,
    file_size: Number(row.file_size),
    uploader_id: row.uploader_id,
    uploader_name: row.uploader_name,
    created_at: row.created_at,
  };
}

/**
 * Fetch all notes.
 * @returns {Promise<Array>}
 */
export async function getNotes() {
  if (!isSupabaseConfigured) {
    return [...sampleNotes];
  }

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("notes")
      .select(NOTE_COLUMNS)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(rowToNote);
  } catch (error) {
    // A live project with a missing table should show an empty library, not
    // pretend that sample notes are real uploads.
    const missingTable =
      error?.code === "PGRST205" ||
      String(error?.message || "").includes("Could not find the table");

    if (missingTable) {
      console.warn(
        "Supabase notes table is missing. Run supabase/migrations/0001_initial.sql."
      );
      return [];
    }

    throw error;
  }
}

/**
 * Find one note by id.
 * @param {string} id
 * @returns {Promise<object|undefined>}
 */
export async function getNoteById(id) {
  const key = String(id || "");

  if (!isUuid(key)) {
    return isSupabaseConfigured
      ? undefined
      : sampleNotes.find((note) => note.id === key);
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("id", key)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToNote(data) : undefined;
}

/**
 * Insert a new note. Requires a signed-in uploader (checked by RLS).
 * @param {object} noteData
 * @returns {Promise<object>} the inserted note
 */
export async function createNote(noteData) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Cannot save a note.");
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("notes")
    .insert(noteData)
    .select()
    .single();

  if (error) throw error;
  return rowToNote(data);
}

/**
 * Update a note's editable metadata. RLS only allows the uploader, and a
 * database trigger stops file/ownership fields from being changed.
 * @param {string} id
 * @param {object} patch only title, subject, faculty, year and description
 * @returns {Promise<object>} the updated note
 */
export async function updateNote(id, patch) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Cannot update a note.");
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("notes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return rowToNote(data);
}

/**
 * Delete a note by id. RLS only allows the uploader to do this.
 * @param {string} id
 */
export async function deleteNote(id) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Cannot delete a note.");
  }

  const supabase = await getSupabase();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Check whether the signed-in student already reported this note.
 * @param {string} noteId
 * @param {string} reporterId
 * @returns {Promise<boolean>}
 */
export async function hasReported(noteId, reporterId) {
  if (!isSupabaseConfigured) return false;

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("reports")
    .select("id")
    .eq("note_id", noteId)
    .eq("reporter_id", reporterId)
    .limit(1);

  if (error) throw error;
  return data.length > 0;
}

/**
 * Submit a report. RLS forces reporter_id to match the signed-in user.
 * @param {{noteId: string, reporterId: string, reason: string, details?: string}} report
 */
export async function createReport({ noteId, reporterId, reason, details }) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Cannot submit a report.");
  }

  const supabase = await getSupabase();
  const { error } = await supabase.from("reports").insert({
    note_id: noteId,
    reporter_id: reporterId,
    reason,
    details: String(details || "").trim().slice(0, 500) || null,
  });

  if (error) throw error;
}

/**
 * Filter and sort notes in the browser.
 * @param {Array} notes
 * @param {{query?: string, subject?: string, faculty?: string, year?: string, sort?: string}} filters
 * @returns {Array}
 */
export function filterNotes(notes, filters = {}) {
  const query = String(filters.query || "").trim().toLowerCase();
  const subject = filters.subject || "";
  const faculty = filters.faculty || "";
  const year = filters.year || "";

  const filtered = notes.filter((note) => {
    const searchableText = [
      note.title,
      note.subject,
      note.faculty,
      note.year,
      note.description,
      note.uploader_name,
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = !query || searchableText.includes(query);
    const matchesSubject = !subject || note.subject === subject;
    const matchesFaculty = !faculty || note.faculty === faculty;
    const matchesYear = !year || note.year === year;

    return matchesQuery && matchesSubject && matchesFaculty && matchesYear;
  });

  return sortNotes(filtered, filters.sort || "newest");
}

/** Sort a copy of the list so the caller's array is never mutated. */
export function sortNotes(notes, sortBy) {
  const sorted = [...notes];

  switch (sortBy) {
    case "oldest":
      return sorted.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "subject":
      return sorted.sort(
        (a, b) =>
          a.subject.localeCompare(b.subject) ||
          a.title.localeCompare(b.title)
      );
    case "newest":
    default:
      return sorted.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
  }
}

/**
 * Get a list of unique values for a filter dropdown.
 * @param {Array} notes
 * @param {string} field
 * @returns {string[]}
 */
export function getUniqueValues(notes, field) {
  return [...new Set(notes.map((note) => note[field]).filter(Boolean))].sort(
    (a, b) => String(a).localeCompare(String(b))
  );
}
