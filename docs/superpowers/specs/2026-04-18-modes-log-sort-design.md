# Design: Modes, Session Log & Sort Endpoint
**Date:** 2026-04-18
**Status:** Approved

---

## Overview

Add three operating modes (SORT, MERGE, BOUNCE) to the Rekordbox Bounce wizard, a session log, and a new `/api/sort` backend endpoint. The mode selector becomes the first step of the wizard, ensuring users make a deliberate choice before touching any folders.

---

## 1. Wizard Flow

**Before:** Folders → Preview → Confirm → Done (4 steps)
**After:** Mode → Folders → Preview → Confirm → Done (5 steps)

`App.jsx` gains a `mode` state (default: `'merge'`). Mode is selected on the first screen and locked for the rest of the session. A small colored pill in the header shows the active mode throughout.

---

## 2. Mode Step (new `ModeStep.jsx`)

Three large selectable cards. Clicking a card selects it. "Continue" advances to Folders.

| Mode | Tint | Card copy |
|------|------|-----------|
| SORT | Neutral (cyan/dark) | "Separates what's new from what's old. So you don't waste time re-analysing tracks you already have." |
| MERGE | Neutral (cyan/dark) | "Brings new and old together. Your existing Library is protected. New tracks are added. Nothing is removed." |
| BOUNCE | Red (`#f43f5e`) | "Spring clean. Replaces your old Library with your new one — without overwriting anything. New tracks come in, unmatched tracks go to quarantine." |

Default selected: MERGE.

---

## 3. Mode Behaviours

### SORT
- Compares Library against all Source folders using existing tag-based matching
- Does **not** move any files into the Library
- Does **not** quarantine anything
- For each Source folder, creates two **sibling** folders next to it:
  - `[SourceName]_New/` — files not found in the Library
  - `[SourceName]_Duplicate/` — files already matched in the Library
- Example: source folder `techno26` → produces `techno26_New/` and `techno26_Duplicate/` at the same level
- Original source files are moved into the appropriate sibling folder
- If sibling folders already exist, files are moved in alongside existing content; filename collisions are skipped and reported as errors

### MERGE
- Moves only genuinely new files into the Library (files not matched in any Source stay in Library untouched)
- Duplicates (source files already matched in Library) stay in Source — **not quarantined, not moved**
- Generates one `.m3u` playlist per Source folder (same as current execute logic)
- Requires standard checkbox confirmation before executing

### BOUNCE
- Full current behaviour: quarantine Library files with no match + move new Source files in
- Requires user to type `BOUNCE` into a text input to unlock the Run button (checkbox alone is not enough)
- Danger warning shown prominently: "This will quarantine Library files not found in any Source. This cannot be undone automatically if the quarantine folder is deleted."

---

## 4. Preview Step Adaptations

Mode changes which sections appear in `PreviewStep.jsx`:

**SORT:**
- Per Source: "Going to [SourceName]_New/" (cyan) — filenames listed
- Per Source: "Going to [SourceName]_Duplicate/" (muted) — filenames listed
- No quarantine section. No "staying in Library" section.

**MERGE:**
- "Staying in Library" (green, collapsed by default) — matched Library files
- Per Source: "New files from [Source]" (cyan) — files that will move in
- No quarantine section.

**BOUNCE:**
- Current behaviour unchanged: quarantine (red, with keep toggles), staying (green), new per source (cyan)

---

## 5. Confirm Step Adaptations (`ExecuteStep.jsx`)

All modes pass through the Confirm step — no mode skips it.

| Mode | Confirmation mechanism | Button label |
|------|------------------------|--------------|
| SORT | No checkbox — button always enabled | "Run Sort" |
| MERGE | Standard checkbox | "Run Merge" |
| BOUNCE | Type `BOUNCE` to unlock + danger warning | "Run Bounce" |

Confirm step explanatory text reflects the active mode.

---

## 6. Done Screen Adaptations (`Done.jsx`)

**SORT:**
- Per source: paths to `[SourceName]_New/` and `[SourceName]_Duplicate/`, file counts, any errors

**MERGE:**
- Per source: new files moved + playlist path
- Per source: duplicates found (count + filenames) — so user knows what was skipped

**BOUNCE:**
- Current behaviour unchanged

All modes: session history section at the bottom (see Section 8).

---

## 7. Backend Changes

### Extend `/api/preview` (additive only)

Each `per_folder` entry gains a `duplicate_files` list — the source filenames that matched the Library. Existing consumers are unaffected (new field, additive).

```json
{
  "per_folder": [
    {
      "folder_b": "...",
      "folder_b_name": "techno26",
      "move_to_a": ["new-track.mp3"],
      "duplicate_files": ["old-track.mp3"],
      "counts": { "total_b": 10, "move_to_a": 3, "duplicates": 7 }
    }
  ]
}
```

### New `POST /api/sort`

```
Request:  { folder_a: str, folders_b: list[str] }
Response: {
  per_folder: [
    {
      folder_b: str,
      folder_b_name: str,
      new_folder: str,        // absolute path to [SourceName]_New/
      duplicate_folder: str,  // absolute path to [SourceName]_Duplicate/
      moved_new: [str],       // filenames moved to New/
      moved_duplicate: [str], // filenames moved to Duplicate/
      errors: [{ file, error }]
    }
  ],
  summary: { total_new, total_duplicate, error_count }
}
```

- Runs existing `compare_folders_multi` internally
- Creates sibling folders at `Path(folder_b).parent / f"{folder_b_name}_New"` etc.
- Never touches `folder_a`

### New `GET /api/log`

Returns the last 5 entries from `bounce_log.json` (stored at project root) in reverse chronological order.

```json
[
  {
    "timestamp": "2026-04-18T21:30:00",
    "mode": "merge",
    "library_path": "/Music/Library",
    "library_name": "Library",
    "sources": ["techno26", "house12"],
    "counts": { "moved": 14, "duplicates": 6, "quarantined": 0, "errors": 0 }
  }
]
```

The backend appends to `bounce_log.json` after every successful `/api/execute` or `/api/sort`. File is created on first write if absent.

---

## 8. Session History (Done screen)

Collapsible "Session History" section below results. Fetches from `GET /api/log` on mount.

Each entry displays:
```
18 Apr 2026, 21:30  [MERGE]  Library  →  14 moved · 6 duplicates
```

Last 5 entries, newest first. If log is empty or fetch fails, section is hidden.

---

## 9. Files Affected

**New files:**
- `frontend/src/components/ModeStep.jsx`
- `bounce_log.json` (auto-created at runtime, gitignored)

**Modified frontend:**
- `frontend/src/App.jsx` — add mode step, mode state, pass mode as prop
- `frontend/src/components/PreviewStep.jsx` — mode-aware sections
- `frontend/src/components/ExecuteStep.jsx` — mode-aware confirmation
- `frontend/src/components/Done.jsx` — mode-aware results + session history

**Modified backend:**
- `backend/comparator.py` — add `duplicate_files` to `per_folder` output
- `backend/operations.py` — add log write after execute; add `sort_sync()`
- `backend/main.py` — add `/api/sort` and `/api/log` routes

**No changes to:**
- `/api/preview` shape (additive only)
- `/api/execute` logic
- `/api/undo` logic
- `scanner.py`

---

## 10. Constraints

- No files are ever renamed in any mode
- Library files are never touched in SORT or MERGE
- No third-party software is referenced by name anywhere in UI copy
- `bounce_log.json` added to `.gitignore`
