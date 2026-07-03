# ReadySet Bounce — Full Codebase Audit
**Date:** 2026-04-29  
**Branch:** audit/portfolio-review  
**Auditor:** Claude (read-only, no code changes)

---

## Plain English Summary

ReadySet Bounce is a polished local web tool for DJs to safely manage their Rekordbox music library — specifically to merge new track downloads into a live library without ever touching existing files (which would silently destroy Rekordbox cue points). It has a FastAPI Python backend and a React frontend, and supports three operating modes: SORT (preview what's new before committing), MERGE (add new tracks to library, nothing removed), and BOUNCE (replace the old library with a new one, quarantining unmatched files). The core library-safety logic is solid and all 23 backend tests pass. The app works end-to-end and is a functional v0.2, but has several rough edges before it could be called "finished": a Figma developer tool accidentally embedded in the HTML, dead code from features that were built then removed, a broken drag-and-drop interaction, a stale folder label in the SORT preview screen, and zero frontend test coverage. Getting to a truly deployable, distributable state would also require packaging work (Electron or similar), since it currently requires manually starting two terminal processes on every use.

---

## 1. Project Summary

### What it does
A local web app that runs entirely on the user's machine. The user points it at their music Library folder and one or more Source (download) folders. The app compares them by ID3 tags (with filename fallback) and shows exactly what will happen before executing. Files are never renamed — they move as-is with original filenames.

### Stack
| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python), port 8000 |
| Frontend | React 19 + Vite 8 + Tailwind CSS v4 |
| Tag reading | mutagen |
| File ops | Python stdlib (shutil, pathlib) |
| Tests | pytest (backend only) |
| Fonts | Syne, IBM Plex Mono, IBM Plex Sans (Google Fonts) |

### Current state
- All 3 modes (SORT / MERGE / BOUNCE) implemented and tested
- 23 backend tests, all passing
- Session log (bounce_log.json) and history screen implemented
- Design: warm dark palette (gold `#F3BD68`, copper `#CC7051`)
- No frontend tests
- No production packaging

### API routes
```
GET  /api/health
GET  /api/pick-folder       — native OS folder picker (tkinter subprocess)
POST /api/preview           — dry-run comparison (no file moves)
POST /api/execute           — run MERGE or BOUNCE
POST /api/sort              — run SORT
POST /api/undo              — reverse last BOUNCE
GET  /api/log               — last 5 session log entries
GET  /api/open-path?path=…  — open folder in OS file manager
```

---

## 2. Critical Bugs

### BUG-01: Figma capture script in `frontend/index.html` (line 15)
```html
<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
```
A Figma-to-design developer tool was accidentally committed to the HTML. It loads external JavaScript from a third-party domain on every page load. This is a security and privacy concern — it should not be in a released app. Any user running this app loads Figma's script in the background. **Complexity: trivial to fix (delete the line).**

### BUG-02: Drag-and-drop opens native picker instead of using dropped path (`FolderSetup.jsx:154-158`)
The `onDrop` handler calls `pickFolder()`, which opens the native OS folder dialog — it ignores the actually dropped folder entirely. The drop target zone visually implies drag-and-drop works, but it silently discards what was dragged and asks the user to pick again. This is confusing UX. Root cause: browsers cannot read folder paths from drag events without the File System Access API. **Complexity: low (either remove the drop visual, show a message, or research the File System Access API).**

---

## 3. Logic Problems

### LOGIC-01: PreviewStep SORT label uses wrong folder naming convention (`PreviewStep.jsx:64, 78`)
```jsx
title={`${pf.move_to_a.length} going to ${pf.folder_b_name}_New/`}
title={`${(pf.duplicate_files||[]).length} going to ${pf.folder_b_name}_Duplicate/`}
```
The Preview screen shows `techno26_New/` (old sibling naming from the original spec), but the backend actually creates `New/` and `Duplicate/` as subfolders *inside* the source folder (`techno26/New/`). The Done screen correctly shows `techno26/New`. So users see `techno26_New/` in preview but `techno26/New` in results — the folder never named `techno26_New` is created. **Complexity: low (one-line fix per label).**

### LOGIC-02: `sort_sync()` scans library folder unnecessarily (`operations.py:223`)
```python
files_a = scan_folder(folder_a)  # result is never used
preview = _compare_multi(folder_a, folders_b)
```
`files_a` is assigned but never referenced again. `_compare_multi` handles the scan internally. For a large library this is a pointless double-read. **Complexity: trivial (delete line 223).**

### LOGIC-03: `execute_sync()` double-scans library (`operations.py:58-61`)
```python
files_a = scan_folder(folder_a)      # scan #1
quarantine = get_quarantine_dir(folder_a)
preview = _compare_multi(folder_a, folders_b)  # scan #2 (internal)
```
`execute_sync` calls `scan_folder(folder_a)` directly AND then calls `_compare_multi` which calls `scan_folder(folder_a)` again internally. Minor inefficiency. **Complexity: medium to refactor properly.**

### LOGIC-04: `execute_sync` tests have ineffective mocks
Tests for `execute_sync` patch `backend.comparator.compare_folders_multi`, but `operations.py` imports it as `from backend.comparator import compare_folders_multi as _compare_multi` — a local binding that is unaffected by patching the module attribute. The tests pass coincidentally because the real comparison with temporary folders returns the expected result anyway. The patches are no-ops. **Complexity: low (change patch targets to `backend.operations._compare_multi`).**

### LOGIC-05: `mode` parameter in execute endpoint has no validation (`main.py:28-31`, `operations.py:52`)
Any string can be passed as `mode`. Passing `mode: "invalid"` would skip quarantining (since it doesn't equal `"bounce"`) and proceed with moves — incorrect behavior with no error. **Complexity: low (add enum validation in Pydantic model or route handler).**

### LOGIC-06: No guard for source === library path
If the user accidentally sets the Source folder to the same path as the Library, `execute_sync` would try to move files from A to A. `shutil.move` into the same location would silently fail or error. **Complexity: low (add path equality check in `/api/preview`).**

---

## 4. Dead or Broken Code

| File | Issue |
|---|---|
| `main.py` (project root) | PyCharm "Hello World" template stub. Has a `print_hi()` function, never imported or called by anything. Unrelated to the app. |
| `frontend/src/App.css` | Default Vite template CSS (hero layout, counter, etc.). Never imported anywhere — `App.jsx` imports `index.css`, not `App.css`. |
| `frontend/src/assets/react.svg` | Default Vite template asset. Never referenced. |
| `frontend/src/assets/vite.svg` | Default Vite template asset. Never referenced. |
| `backend/scanner.py`: `build_filename()` | Built for the file-renaming feature that was later removed. Never called from anywhere. |
| `backend/scanner.py`: `_sanitize()`, `_ILLEGAL_CHARS`, `_UNICODE_REPLACE` | Support code for `build_filename()`. Also dead. |
| `backend/comparator.py`: `compare_folders()` | The original single-folder compare. Only used internally by `compare_folders_multi()`. Not exposed via any API route. Fine as an internal helper, but could be made private (`_compare_folders`). |
| `.worktrees/feature-modes-log-sort/` | Git worktree from the feature branch that was merged to main. The feature is shipped; this directory is a leftover artifact. |
| Figma script in `index.html` | See BUG-01. |

---

## 5. Type Safety Issues

- **No TypeScript** — all frontend code is plain JavaScript. Component props have no type declarations.
- **No PropTypes** — React props are unvalidated at runtime. Passing wrong types would fail silently or produce cryptic errors.
- **Python typing is partial** — `read_tags()` returns `dict | None` (Python 3.10+ union syntax, correct), but many function signatures use bare `dict` or `list` without inner types (e.g., `per_folder: list[dict]`).
- **`mode` accepts any string** — see LOGIC-05.
- **`files_to_keep` could contain filenames not in folder_a** — `execute_sync` uses it as a filter against `global_delete_from_a` but doesn't validate that each filename actually exists. Non-existent names are silently ignored, which is acceptable but undocumented.

---

## 6. Architecture Observations

### What's clean
- **4-layer backend pipeline**: `scanner.py` → `comparator.py` → `operations.py` → `main.py`. Each layer has a single job. Dependency flow is one-directional.
- **Wizard state in App.jsx only**: All state lives at the top. Child components receive props and emit events. No prop drilling chains, no global state. Clean.
- **No database needed**: A flat JSON log file is the right call for a local single-user tool.
- **Tag matching with filename fallback**: Robust — handles untagged files and different filenames for the same track.
- **Quarantine instead of delete**: Files are never destroyed. A safe choice that builds user trust.

### What's inconsistent
- **Design token drift**: `CLAUDE.md` documents `--accent: #22d3ee` (cyan) and `--success: #10b981` (green), but the current `index.css` has `--accent: #F3BD68` (gold) and `--success: #9E8A6E` (a muted brown identical to `--text-muted`). CLAUDE.md is stale after the palette redesign.
- **Quarantine folder name drift**: CLAUDE.md says quarantine goes to `../RekordboxBounce/`. The code (`operations.py:27`) returns `ReadySetBounce/`. The folder was renamed but CLAUDE.md wasn't updated.
- **Inline style vs CSS variables**: The design system defines CSS variables in `index.css`, but some components use hardcoded rgba values (e.g., `rgba(158,138,110,0.3)` in Done.jsx) that duplicate or approximate the variables without using them. Minor but adds drift risk.
- **`start.sh` is Mac-only despite cross-platform claim**: The script uses `source .venv/bin/activate` (bash/zsh syntax). `start.bat` covers Windows. A developer README note would help.
- **No production deployment path**: The app requires the user to run `uvicorn` and `npm run dev` (or `start.sh`). There is no Electron wrapper, PyInstaller build, or `npm run build` + static serving setup. The `vite build` script exists in `package.json` but is never used. For a non-developer user, this is a significant gap.

---

## 7. Missing Features

| Feature | Notes |
|---|---|
| Frontend tests | Zero frontend test coverage. No Vitest, no Testing Library. |
| Undo for MERGE mode | Files moved into Library by MERGE cannot be undone via the UI. They'd have to be deleted manually. |
| Undo for SORT mode | Files sorted by SORT cannot be undone via the UI. |
| Recursive folder scanning | `scan_folder()` only scans the top level of a folder. Subdirectories are invisible. A user with a hierarchically organized library would get wrong results. |
| Input validation on path field | Typing a non-existent path into the manual text input doesn't error until "Scan & Preview" is clicked. A simple existence check on blur would improve UX. |
| Window title | `index.html` line 7 still reads `<title>Rekordbox Bounce</title>` but the app was renamed to "ReadySet Bounce". |
| Same-folder guard | No check that Source ≠ Library before executing. |
| Large folder warning | No timeout, progress indicator, or file count warning for large libraries. A 10,000 file scan might hang the UI. |
| Packaging / distribution | No Electron or PyInstaller build pipeline. Cannot hand this to a non-developer user. |

---

## 8. Fix Priority Order

| # | Fix | Complexity | Why |
|---|---|---|---|
| 1 | Remove Figma script from `index.html` | Trivial | Security — loads external JS on every run |
| 2 | Fix `<title>` in `index.html` | Trivial | Brand consistency |
| 3 | Fix SORT folder labels in `PreviewStep.jsx` | Low | Preview says `_New/`, backend creates `/New` — visible mismatch |
| 4 | Delete root `main.py` stub | Trivial | Confusing file, unrelated to app |
| 5 | Delete `App.css` and unused Vite assets | Trivial | Dead code cleanup |
| 6 | Remove dead code from `scanner.py` (`build_filename`, etc.) | Low | Dead code from removed feature |
| 7 | Delete `files_a = scan_folder(folder_a)` in `sort_sync` | Trivial | Redundant scan, result never used |
| 8 | Add `mode` enum validation in `ExecuteRequest` | Low | Prevents silent wrong-mode behavior |
| 9 | Add source === library guard in `/api/preview` | Low | Prevents self-move disaster |
| 10 | Update CLAUDE.md (palette colours, quarantine folder name) | Low | Stale documentation misleads future sessions |
| 11 | Fix drag-and-drop UX in `FolderSetup.jsx` | Medium | Either make it work or make failure explicit |
| 12 | Clean up `.worktrees/` directory | Low | Leftover artifact from merged branch |
| 13 | Fix ineffective mock patches in `test_operations.py` | Low | Tests pass for the right reason but mocks are no-ops |
| 14 | Add PropTypes or migrate to TypeScript | Medium | Frontend props are completely unvalidated |
| 15 | Add frontend test suite (Vitest + Testing Library) | High | Zero frontend test coverage |
| 16 | Add recursive folder scanning option | Medium | Users with hierarchical libraries get incomplete results |
| 17 | Production packaging (Electron or similar) | High | Required to hand off to a non-developer user |

---

## Claude.ai Projects — Recommended File List

All files below are plain text and total well under 1 MB (project source: ~1.3 MB excluding node_modules, .venv, .git).

### Backend (Python)
```
backend/__init__.py
backend/main.py
backend/scanner.py
backend/comparator.py
backend/operations.py
requirements.txt
```

### Frontend (React)
```
frontend/src/main.jsx
frontend/src/App.jsx
frontend/src/index.css
frontend/src/components/ModeStep.jsx
frontend/src/components/FolderSetup.jsx
frontend/src/components/PreviewStep.jsx
frontend/src/components/ExecuteStep.jsx
frontend/src/components/Done.jsx
frontend/index.html
frontend/vite.config.js
frontend/package.json
```

### Tests
```
tests/__init__.py
tests/test_comparator.py
tests/test_operations.py
```

### Config / Docs
```
CLAUDE.md
README.md
start.sh
start.bat
.gitignore
docs/superpowers/specs/2026-04-18-modes-log-sort-design.md
docs/superpowers/plans/2026-04-18-modes-log-sort.md
```

### Do NOT include
- `node_modules/` — hundreds of MBs of dependencies
- `.venv/` — Python virtualenv, large
- `.git/` — version history
- `.worktrees/` — leftover worktree directory
- `frontend/src/assets/hero.png` — binary image, not needed for code review
- `main.py` (project root) — PyCharm stub, not the app

**Estimated upload size: ~150 KB** (all text files, well within the 30 MB limit).
