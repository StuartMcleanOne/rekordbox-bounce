# Rekordbox Bounce

A local web app that safely syncs a new music download folder into an existing Rekordbox library — without overwriting files that have cue points and metadata.

## The Problem

Rekordbox stores cue points per file path. Replacing or renaming a file loses everything. This tool compares your existing library against new downloads and merges them safely, step by step, with full preview before anything changes.

## How It Works

1. **Normalize** — B files are renamed to match A's naming convention (`Artist1_Artist2 Title.ext`) using ID3 tags
2. **Prune A** — files in A not present in B are moved to a quarantine folder (not deleted)
3. **Deduplicate B** — files already in A are skipped
4. **Move** — remaining new files from B are moved into A

Files in A are **never renamed or overwritten**.

## Tech Stack

- **Backend**: Python / FastAPI
- **Frontend**: React + Vite + Tailwind CSS
- **File matching**: ID3 tag comparison via `mutagen` (falls back to filename)

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm

## Setup

### First time only

```bash
# Backend dependencies
python -m venv .venv

# Mac/Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate

pip install -r requirements.txt

# Frontend dependencies
cd frontend
npm install
cd ..
```

## Running

### Mac / Linux

```bash
chmod +x start.sh
./start.sh
```

### Windows

Double-click `start.bat`, or run it from a terminal:

```bat
start.bat
```

Then open **http://localhost:5173** (or whichever port Vite picks — it'll show in the terminal).

## Usage

1. **Select Folders** — click Browse or drag a folder onto each zone
   - **A**: your existing Rekordbox library folder
   - **B**: your new downloads folder
2. **Preview** — review exactly what will happen. Check any file you want to keep in A (it won't be quarantined)
3. **Confirm** — tick the confirmation checkbox and run
4. **Done** — quarantined files are at `../RekordboxBounce/` relative to A, outside Rekordbox's watch

## Quarantine Folder

Files removed from A are moved to a `RekordboxBounce` folder in the **parent directory of A** — not deleted. Rekordbox won't see this folder. Review and delete manually when you're confident.

## Naming Convention

The app detects and applies A's naming convention automatically:

```
Artist1_Artist2 Title.ext
```

- Multiple artists joined with `_`
- Single space between artist block and title
- Matched using ID3 tags so near-duplicates with different filenames are still recognised
- Files already named correctly are not renamed

## Project Structure

```
├── backend/
│   ├── main.py          # FastAPI app + routes
│   ├── scanner.py       # File scanning, tag reading, filename building
│   ├── comparator.py    # Folder comparison logic
│   └── operations.py    # File move/quarantine execution
├── frontend/
│   └── src/
│       ├── App.jsx
│       └── components/
│           ├── FolderSetup.jsx   # Folder selection with drag & drop
│           ├── PreviewStep.jsx   # Preview with keep toggles
│           ├── ExecuteStep.jsx   # Confirmation step
│           └── Done.jsx          # Results
├── requirements.txt
├── start.sh             # Mac/Linux launcher
└── start.bat            # Windows launcher
```
