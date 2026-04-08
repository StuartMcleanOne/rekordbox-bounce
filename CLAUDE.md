# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

**Rekordbox Bounce** is a local web app for safely merging new music download folders (Sources) into an existing Rekordbox library folder (Library) without touching files that have cue points and metadata.

**Critical constraint**: Any rename, move, or overwrite of a file in the Library causes Rekordbox to lose its cue points permanently. Library files must never be renamed, moved, or overwritten.

## Architecture

**Backend**: FastAPI (Python) on port 8000
**Frontend**: React + Vite + Tailwind CSS on port 5173/5174

```
backend/
  main.py        — FastAPI app, routes: /api/preview, /api/execute, /api/undo, /api/pick-folder, /api/health
  scanner.py     — scan_folder(), read_tags(), normalize_name()
  comparator.py  — compare_folders_multi() — tag-based matching, multi-source, deduplication
  operations.py  — execute_sync(), undo_sync(), _write_playlist()

frontend/src/
  App.jsx                        — wizard state machine (setup → preview → execute → done)
  components/FolderSetup.jsx     — Library + Source folder selection, Browse calls /api/pick-folder
  components/PreviewStep.jsx     — preview with per-file keep toggles
  components/ExecuteStep.jsx     — confirmation gate
  components/Done.jsx            — results, playlist paths, undo button
```

## Folder Terminology

- **Library** (`folder_a` in API) — the existing Rekordbox library. Never touched.
- **Source / Sources** (`folders_b` in API) — one or more new download folders. Files move from here into Library.

The UI shows "Library" and "Source 1", "Source 2" etc. The API uses `folder_a` / `folders_b` internally.

## Core Logic

1. **Match** — compare Library against all Sources by ID3 tags (artist+title via mutagen), fall back to normalised filename for untagged files
2. **Quarantine** — Library files not matched in any Source go to `../RekordboxBounce/` (parent of Library, outside Rekordbox's watch)
3. **Move** — unmatched Source files move into Library with their original filenames unchanged
4. **Playlist** — a `.m3u` playlist is written to Library for each Source folder's moved files
5. **Undo** — full rollback: quarantined files returned to Library, moved files returned to Sources, playlists deleted

**Files are never renamed.** Source files move as-is. The naming convention step was explored and removed — it caused problems and wasn't needed since the source of downloads is controlled separately.

## Running Locally

```bash
# Backend (from project root, with .venv activated)
uvicorn backend.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

Mac: `./start.sh` | Windows: `start.bat`

## First-time Setup

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd frontend && npm install
```

## Key Decisions

- **Library files are immutable** — source files move as-is; Library files are never touched
- **Quarantine not delete** — removed files go to `../RekordboxBounce/`, not the trash
- **Tag matching** — mutagen reads ID3/FLAC/MP4/AAC tags; falls back to filename comparison for untagged files
- **Multi-source** — compare_folders_multi() handles N source folders; deduplication prevents the same file moving twice
- **Native folder picker** — `/api/pick-folder` runs tkinter in a subprocess (macOS main-thread requirement)
- **Cross-platform** — all file ops use `pathlib.Path`, paths normalised to forward slashes in API responses

## Design System

Dark theme. CSS variables in `frontend/src/index.css`.
Fonts: Syne (headings) + IBM Plex Mono (filenames/code) + IBM Plex Sans (body) — all with system fallbacks.
Accent: `#22d3ee` (cyan). Danger: `#f43f5e`. Success: `#10b981`.
