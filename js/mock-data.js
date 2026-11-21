/**
 * Sample note data for Phase 1
 * -----------------------------
 * This lets the site work offline while Supabase is being set up.
 * Phase 3 replaces this with live documents from Supabase.
 *
 * Keep the field names the same as the Supabase documents so the
 * switch to the real database is as small as possible.
 */

export const FACULTIES = [
  "Computing & Informatics",
  "Engineering",
  "Business",
  "Creative Multimedia",
  "Applied Communication",
];

export const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4"];

export const sampleNotes = [
  {
    id: "sample-data-structures",
    title: "Data Structures & Algorithms — Final Exam Notes",
    subject: "Data Structures",
    faculty: "Computing & Informatics",
    year: "Year 2",
    description:
      "Stacks, queues, trees, graphs, sorting and Big-O explained with short examples and exam-style questions.",
    file_url: null,
    file_type: "PDF",
    file_size: 4_800_000,
    uploader_id: "sample-user-aisyah",
    uploader_name: "Aisyah Rahman",
    created_at: "2026-11-19T09:30:00.000Z",
    is_sample: true,
  },
  {
    id: "sample-discrete-math",
    title: "Discrete Mathematics — Complete Cheat Sheet",
    subject: "Discrete Mathematics",
    faculty: "Computing & Informatics",
    year: "Year 1",
    description:
      "Logic, sets, relations, functions, counting and graph theory condensed into a clean revision sheet.",
    file_url: null,
    file_type: "PDF",
    file_size: 1_200_000,
    uploader_id: "sample-user-daniel",
    uploader_name: "Daniel Lim",
    created_at: "2026-11-17T13:15:00.000Z",
    is_sample: true,
  },
  {
    id: "sample-databases",
    title: "Database Systems — Normalization Made Simple",
    subject: "Database Systems",
    faculty: "Computing & Informatics",
    year: "Year 2",
    description:
      "A step-by-step walkthrough of 1NF to 3NF, ER diagrams, SQL joins and common final exam traps.",
    file_url: null,
    file_type: "DOCX",
    file_size: 2_400_000,
    uploader_id: "sample-user-iman",
    uploader_name: "Nur Iman",
    created_at: "2026-11-14T08:05:00.000Z",
    is_sample: true,
  },
  {
    id: "sample-oop-java",
    title: "Object-Oriented Programming — Java Revision Pack",
    subject: "Object-Oriented Programming",
    faculty: "Computing & Informatics",
    year: "Year 1",
    description:
      "Classes, inheritance, interfaces, collections and exception handling with annotated Java snippets.",
    file_url: null,
    file_type: "PPTX",
    file_size: 6_100_000,
    uploader_id: "sample-user-kavitha",
    uploader_name: "Kavitha Subramaniam",
    created_at: "2026-11-12T15:40:00.000Z",
    is_sample: true,
  },
  {
    id: "sample-digital-logic",
    title: "Digital Logic Design — Lab & Theory Summary",
    subject: "Digital Logic Design",
    faculty: "Engineering",
    year: "Year 2",
    description:
      "Boolean algebra, K-maps, flip-flops and combinational circuits with worked lab examples.",
    file_url: null,
    file_type: "PDF",
    file_size: 3_700_000,
    uploader_id: "sample-user-faris",
    uploader_name: "Faris Hakim",
    created_at: "2026-11-09T10:20:00.000Z",
    is_sample: true,
  },
  {
    id: "sample-accounting",
    title: "Financial Accounting — Formula & Journal Guide",
    subject: "Financial Accounting",
    faculty: "Business",
    year: "Year 1",
    description:
      "Double-entry rules, journal entries, trial balances and the formulas you need for the final paper.",
    file_url: null,
    file_type: "DOCX",
    file_size: 980_000,
    uploader_id: "sample-user-chloe",
    uploader_name: "Chloe Tan",
    created_at: "2026-11-05T07:45:00.000Z",
    is_sample: true,
  },
  {
    id: "sample-marketing",
    title: "Marketing Principles — Case Study Framework",
    subject: "Marketing Principles",
    faculty: "Business",
    year: "Year 3",
    description:
      "A reusable framework for SWOT, segmentation, positioning and recommendation questions in case studies.",
    file_url: null,
    file_type: "PPTX",
    file_size: 5_200_000,
    uploader_id: "sample-user-arif",
    uploader_name: "Arif Zulkifli",
    created_at: "2026-10-29T11:10:00.000Z",
    is_sample: true,
  },
  {
    id: "sample-uiux",
    title: "UI/UX Fundamentals — Wireframing Notes",
    subject: "UI/UX Design",
    faculty: "Creative Multimedia",
    year: "Year 2",
    description:
      "User flows, wireframes, hierarchy and usability heuristics with hand-drawn examples from class.",
    file_url: null,
    file_type: "PNG",
    file_size: 8_600_000,
    uploader_id: "sample-user-meiling",
    uploader_name: "Mei Ling",
    created_at: "2026-10-24T16:30:00.000Z",
    is_sample: true,
  },
  {
    id: "sample-public-speaking",
    title: "Public Speaking — Final Presentation Checklist",
    subject: "Public Speaking",
    faculty: "Applied Communication",
    year: "Year 1",
    description:
      "A practical checklist for structure, slide design, delivery and handling questions during assessment.",
    file_url: null,
    file_type: "PDF",
    file_size: 640_000,
    uploader_id: "sample-user-hana",
    uploader_name: "Hana Yusof",
    created_at: "2026-10-20T09:00:00.000Z",
    is_sample: true,
  },
];

/** Subjects in alphabetical order, made from the sample data. */
export const SUBJECTS = [...new Set(sampleNotes.map((note) => note.subject))].sort(
  (a, b) => a.localeCompare(b)
);
