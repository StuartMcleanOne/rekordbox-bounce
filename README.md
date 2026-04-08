# Rekordbox Bounce

> A local web app for safely merging new music downloads into an existing Rekordbox DJ library — without destroying years of cue points.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)

---

## The Problem

Rekordbox stores cue points, loops, and hot cues **by file path**. If a file in your library gets renamed, moved, or overwritten — even by a tool trying to help — Rekordbox silently drops everything attached to it. Every cue point, gone.

For DJs with large libraries built over years, this is catastrophic. Manually checking thousands of tracks before merging new downloads isn't realistic. So most people either avoid organising their library, or lose metadata and don't notice until they're at a gig.

**Rekordbox Bounce solves this.** It merges new downloads into your existing library safely, step by step, with full preview before anything changes. Files in your library are **never renamed, moved, or overwritten**.

---

## How It Works

```
Source folders (new downloads)
        ──►  Match against Library by ID3 tags (artist + title)
        ──►  Preview every action — nothing happens yet
        ──►  Library files with no match → quarantine folder (not deleted)
        ──►  Unmatched source files → moved into Library as-is
        ──►  .m3u playlist written per source folder
```

**Library files are never touched.** Source files move into the Library with their original filenames intact.

### Matching Logic

Files are matched by **ID3 tags** (artist + title via `mutagen`) — not by filename. This means tracks with inconsistent filenames still match correctly as long as they have tags. For files with no tags, it falls back to normalised filename comparison.

### Multiple Sources

You can add multiple source folders in one run. A file present in more than one source is only moved once. A Library file is kept (not quarantined) if it matches anything across any source.

### Quarantine, Not Delete

Library files with no match in any source are moved to `../RekordboxBounce/` — a sibling folder outside Rekordbox's watch path. Nothing is permanently deleted. Review and clean up manually when you're confident.

### Undo

The done screen includes a full undo: quarantined files are restored to the Library, moved files are returned to their source folders, and playlists are deleted.

---

## Features

- **Tag-based matching** — ID3/FLAC/MP4 tags via mutagen, filename fallback for untagged files
- **Multi-source support** — merge from multiple download folders in one run
- **Full preview** — see exactly what will happen before anything executes
- **Per-file keep toggles** — override any quarantine decision in the preview step
- **Deduplication** — files present across multiple source folders are only moved once
- **Native folder picker** — system file dialog, no path typing required
- **Playlist generation** — `.m3u` per source folder for easy Rekordbox import
- **Undo** — full rollback from the done screen
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
│   ├── main.py          # FastAPI app — /api/preview, /api/execute, /api/undo, /api/pick-folder
│   ├── scanner.py       # scan_folder(), read_tags(), normalize_name()
│   ├── comparator.py    # compare_folders_multi() — tag-based matching, multi-source
│   └── operations.py    # execute_sync(), undo_sync(), playlist writing
├── frontend/
│   └── src/
│       ├── App.jsx                  # Wizard: Folders → Preview → Confirm → Done
│       └── components/
│           ├── FolderSetup.jsx      # Library + Source folder selection
│           ├── PreviewStep.jsx      # Preview with per-file keep toggles
│           ├── ExecuteStep.jsx      # Confirmation gate
│           └── Done.jsx             # Results, playlist paths, undo
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

1. **Select Folders** — choose your Library (existing Rekordbox folder) and one or more Source folders (new downloads)
2. **Preview** — review every planned action. Toggle "keep" on any Library file you don't want quarantined
3. **Confirm** — tick the checkbox and run
4. **Done** — quarantined files are at `../RekordboxBounce/`. Playlists are written to your Library. Undo is available.

---

## Key Design Decisions

**Library files are immutable.** This is not a configuration option. Any rename or overwrite of an existing library file destroys Rekordbox cue points. The constraint is enforced throughout — only source files are ever moved.

**Quarantine over delete.** Removals are always reversible. Files go to a sibling folder Rekordbox can't see, not the trash.

**Tag matching over filename matching.** Source files come from download tools with inconsistent naming. Matching on artist+title tags is far more reliable. Filename comparison is only a fallback for untagged files.

**Subprocess-isolated folder picker.** On macOS, tkinter must run on the main thread, which conflicts with FastAPI's async model. The picker runs in a subprocess and returns the path via stdout.

**Files move as-is.** Source files are not renamed before moving. The Library's naming convention is preserved as-is; source files land with whatever filename they already have.

---

## Running Tests

```bash
source .venv/bin/activate
pytest tests/
```

---

## License

MIT
