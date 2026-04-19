# ReadySet Bounce

> A local web app for safely managing your DJ music library — sort new downloads, merge tracks in, or spring clean — without destroying years of cue points.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)

---

## The Problem

DJ library software stores cue points, loops, and hot cues **by file path**. If a file in your library gets renamed, moved, or overwritten — even by a tool trying to help — all of that metadata is silently lost.

For DJs with large libraries built over years, this is catastrophic. Manually checking thousands of tracks before merging new downloads isn't realistic. Most people either avoid organising their library, or lose metadata and don't notice until they're at a gig.

**ReadySet Bounce solves this.** It compares your library against new downloads by ID3 tags, shows you a full preview before anything changes, and never touches a file in your library.

---

## Three Modes

### SORT
Find what's new before you commit. Separates a source folder into two subfolders:

```
SourceFolder/
  New/        ← tracks not found in your Library
  Duplicate/  ← tracks already in your Library
```

Nothing enters your Library. Use this to triage a download folder before deciding what to do with it.

### MERGE
Bring new and old together. Moves only genuinely new tracks into your Library. Duplicates stay in the source untouched. A `.m3u` playlist is written per source folder.

### BOUNCE
Spring clean. Moves new tracks in and quarantines Library files not found in any source — without overwriting anything. Requires typing `BOUNCE` to confirm. Full undo available from the done screen.

---

## How Matching Works

Files are matched by **ID3 tags** (artist + title via `mutagen`) — not filename. Tracks with inconsistent filenames still match correctly as long as they're tagged. For untagged files, it falls back to normalised filename comparison.

Multiple source folders are supported in one run. A file present in more than one source is only moved once.

---

## Features

- **Three modes** — SORT, MERGE, BOUNCE, each with appropriate confirmation
- **Tag-based matching** — ID3/FLAC/MP4 tags, filename fallback for untagged files
- **Multi-source** — compare against multiple download folders in one run
- **Full preview** — see exactly what will happen before anything executes
- **Per-file keep toggles** — override any quarantine decision before running BOUNCE
- **Playlist generation** — `.m3u` per source folder saved to `Library/Playlists/`
- **Session history** — last 5 runs logged and shown on the done screen
- **Undo** — full rollback for BOUNCE: quarantined files return to Library, moved files return to source
- **Native folder picker** — system file dialog, no path typing required
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
│   ├── main.py          # FastAPI routes: /api/preview, /api/execute, /api/sort,
│   │                    #   /api/undo, /api/log, /api/pick-folder, /api/open-path
│   ├── scanner.py       # scan_folder(), read_tags(), normalize_name()
│   ├── comparator.py    # compare_folders_multi() — tag-based matching, multi-source
│   └── operations.py    # execute_sync(), sort_sync(), undo_sync(), playlist writing, session log
├── frontend/
│   └── src/
│       ├── App.jsx                  # Wizard: Mode → Folders → Preview → Confirm → Done
│       └── components/
│           ├── ModeStep.jsx         # SORT / MERGE / BOUNCE selector
│           ├── FolderSetup.jsx      # Library + Source folder selection
│           ├── PreviewStep.jsx      # Preview with per-file keep toggles
│           ├── ExecuteStep.jsx      # Mode-appropriate confirmation gate
│           └── Done.jsx             # Results, playlists, session history, undo
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
git clone https://github.com/StuartMcleanOne/readyset-bounce.git
cd readyset-bounce

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

1. **Choose a mode** — SORT, MERGE, or BOUNCE
2. **Select folders** — your Library and one or more Source folders
3. **Preview** — review every planned action. For BOUNCE, toggle "keep" on any Library file you want to protect
4. **Confirm** — SORT and MERGE require a checkbox. BOUNCE requires typing `BOUNCE`
5. **Done** — results and playlist paths shown. BOUNCE includes a full undo option

---

## Key Design Decisions

**Library files are immutable.** This is not configurable. Any rename or overwrite of an existing library file destroys cue point metadata. Only source files are ever moved.

**Quarantine over delete.** In BOUNCE mode, removals are always reversible. Files go to `../ReadySetBounce/` — a sibling folder outside your library's watch path — not the trash.

**Tag matching over filename matching.** Source files from download tools have inconsistent naming. Matching on artist+title tags is far more reliable. Filename comparison is only a fallback for untagged files.

**No third-party software references.** ReadySet Bounce works with any DJ library folder. No assumptions are made about which software you use.

**Files move as-is.** Source files are never renamed before moving. They land in the Library with whatever filename they already have.

---

## Running Tests

```bash
source .venv/bin/activate
pytest tests/
```

---

## License

MIT
