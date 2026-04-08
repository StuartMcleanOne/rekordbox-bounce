# Rekordbox Bounce

> A local web app for safely merging new music downloads into an existing Rekordbox DJ library — without destroying years of cue points.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)

---

## The Problem

Rekordbox stores cue points, loops, and hot cues **by file path**. If a file in your library gets renamed, moved, or overwritten — even by a tool trying to help — Rekordbox silently drops everything attached to it. Every cue point, gone.

For DJs with large libraries built over years, this is catastrophic. Manually checking thousands of tracks before merging new downloads isn't realistic. So most people either avoid organising their library or lose metadata and don't notice until they're at a gig.

**Rekordbox Bounce solves this.** It merges new downloads into your existing library safely, step by step, with full preview before anything changes. Files in your library are **never renamed, moved, or overwritten** — that constraint is the entire foundation of the app.

---

## How It Works

```
New downloads (B)  ──►  Normalize filenames using ID3 tags
                   ──►  Match against library (A) by artist+title tags
                   ──►  Preview every action before executing
                   ──►  Quarantine A files not in B  (not delete — quarantine)
                   ──►  Move new B files into A
```

**Files in A are never touched.** Only B files get renamed before moving.

### Matching Logic

Files are matched by **ID3 tags** (artist + title via `mutagen`), not by filename. This means near-duplicates with different filename conventions still match correctly. If a file has no tags, it falls back to normalised filename comparison.

### Naming Convention

The app reads A's existing files and detects the naming convention automatically:

```
Artist1_Artist2 Title.ext
```

Multiple artists (comma-separated in tags) are joined with `_`. B files are renamed to this convention before moving — so your library stays consistent without you having to think about it.

### Quarantine, Not Delete

Files in A that don't have a match in B are moved to `../RekordboxBounce/` — a sibling folder outside Rekordbox's watch path. Nothing is deleted. Review and clean up manually when you're confident.

---

## Features

- **Tag-based matching** — ID3/FLAC/MP4 tags via mutagen, filename fallback for untagged files
- **Full preview** — see exactly what will happen before anything executes
- **Per-file keep toggles** — override any quarantine decision in the preview step
- **Deduplication** — files present across multiple source folders are handled without conflicts
- **Native folder picker** — system file dialog, no path typing required
- **Undo** — quarantined files can be restored from the done screen
- **Cross-platform** — all file operations via `pathlib`, tested on Mac and Windows

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.11+ / FastAPI |
| Frontend | React 18 + Vite + Tailwind CSS |
| File matching | mutagen (ID3, FLAC, MP4, AAC tags) |
| Folder picker | tkinter (subprocess-isolated for macOS thread safety) |
| Fonts | Syne · IBM Plex Mono · IBM Plex Sans |

---

## Project Structure

```
├── backend/
│   ├── main.py          # FastAPI app — /api/preview, /api/execute, /api/pick-folder
│   ├── scanner.py       # scan_folder(), read_tags(), build_filename(), normalize_name()
│   ├── comparator.py    # compare_folders() — tag-based matching with filename fallback
│   └── operations.py    # execute_sync() — quarantine + move with rename
├── frontend/
│   └── src/
│       ├── App.jsx                  # Wizard state machine: setup → preview → execute → done
│       └── components/
│           ├── FolderSetup.jsx      # Folder selection
│           ├── PreviewStep.jsx      # Preview with per-file keep toggles
│           ├── ExecuteStep.jsx      # Confirmation gate
│           └── Done.jsx             # Results, undo, playlist paths
├── tests/
│   ├── test_comparator.py
│   └── test_operations.py
├── start.sh             # Mac/Linux one-command launcher
└── start.bat            # Windows one-command launcher
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+

### First-time install

```bash
git clone https://github.com/StuartMcleanOne/rekordbox-bounce.git
cd rekordbox-bounce

# Backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..
```

### Run

**Mac / Linux**
```bash
./start.sh
```

**Windows**
```bat
start.bat
```

Then open **http://localhost:5173** in your browser.

---

## Usage

1. **Select Folders** — Browse to your Rekordbox library folder (A) and your new downloads folder (B)
2. **Preview** — review every planned action. Toggle "keep" on any file you want to leave in A
3. **Confirm** — tick the checkbox and execute
4. **Done** — quarantined files are at `../RekordboxBounce/` relative to A. Undo is available.

---

## Key Design Decisions

**Files in A are immutable.** This is not a configuration option. Any rename or overwrite of an existing library file destroys Rekordbox cue points permanently. The constraint is enforced throughout the codebase.

**Quarantine over delete.** Removals are always reversible. Files go to a sibling folder Rekordbox can't see, not the trash.

**Tag matching over filename matching.** Download tools produce inconsistent filenames. Tags are more reliable. Mutagen supports ID3, FLAC, MP4, and AAC out of the box.

**Subprocess-isolated folder picker.** On macOS, tkinter must run on the main thread, which conflicts with FastAPI's async model. The picker runs in a subprocess and returns the selected path via stdout.

---

## Running Tests

```bash
source .venv/bin/activate
pytest tests/
```

---

## License

MIT
