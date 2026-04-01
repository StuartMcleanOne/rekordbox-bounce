# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

**Rekordbox Bounce** is a local web app for safely merging a new music download folder (B) into an existing Rekordbox library folder (A) without overwriting files that have cue points and metadata.

**Critical constraint**: Any rename or replacement of a file in A causes Rekordbox to lose its cue points. Files in A must never be renamed, moved, or overwritten.

## Architecture

**Backend**: FastAPI (Python) on port 8000
**Frontend**: React + Vite + Tailwind CSS on port 5173/5174

```
backend/
  main.py        — FastAPI app, routes: /api/preview, /api/execute, /api/pick-folder, /api/health
  scanner.py     — scan_folder(), read_tags(), build_filename(), normalize_name()
  comparator.py  — compare_folders() — tag-based matching with filename fallback
  operations.py  — execute_sync() — quarantine + move with rename

frontend/src/
  App.jsx                        — wizard state machine (setup → preview → execute → done)
  components/FolderSetup.jsx     — folder selection, Browse button calls /api/pick-folder
  components/PreviewStep.jsx     — preview with per-file keep toggles
  components/ExecuteStep.jsx     — confirmation gate
  components/Done.jsx            — results summary
```

## Core Logic

1. **Normalize B** — rename B files to match A's convention (`Artist1_Artist2 Title.ext`) using ID3 tags before comparison
2. **Compare** — match by ID3 tags (artist+title), fall back to normalized filename
3. **Quarantine** — files in A not matched in B go to `../RekordboxBounce/` (parent of A, outside Rekordbox's watch)
4. **Move** — unmatched B files move into A, renamed to match A's convention

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

- **Files in A are never touched** — only B files get renamed before moving
- **Quarantine not delete** — removed files go to `../RekordboxBounce/`, not the trash
- **Native folder picker** — `/api/pick-folder` uses `tkinter.filedialog` (cross-platform)
- **Tag matching** — `mutagen` reads ID3/FLAC/etc tags; falls back to filename comparison for untagged files
- **Naming convention** — `Artist1_Artist2 Title.ext` where multiple artists (comma-separated in tags) are joined with `_`
- **Windows-first** — all file ops use `pathlib.Path`, paths normalised to forward slashes in the API response

## Design System

Dark theme. CSS variables in `frontend/src/index.css`.
Fonts: Syne (headings) + IBM Plex Mono (filenames/code) + IBM Plex Sans (body) — all with system fallbacks.
Accent: `#22d3ee` (cyan). Danger: `#f43f5e`. Success: `#10b981`.
