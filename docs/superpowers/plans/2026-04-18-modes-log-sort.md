# Modes, Session Log & Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SORT / MERGE / BOUNCE mode selection as the first wizard step, a /api/sort endpoint, and a session log with history on the Done screen.

**Architecture:** Backend gains a `sort_sync()` function, a session log appender/reader, and two new routes (`/api/sort`, `/api/log`). The comparator is extended to expose per-source duplicate filenames. The frontend gains a `ModeStep` component and mode-aware behaviour throughout the wizard. Mode is chosen first, locked for the session, and shown as a badge in the header.

**Tech Stack:** FastAPI · Pydantic · Python pathlib/json · React 18 · existing CSS variables

---

## File Map

**New files:**
- `frontend/src/components/ModeStep.jsx`
- `bounce_log.json` ← auto-created at runtime, gitignored

**Modified backend:**
- `backend/comparator.py` — add `duplicate_b_files` to `compare_folders()`, `duplicate_files` to `compare_folders_multi()` per-folder entries
- `backend/operations.py` — add `sort_sync()`, `append_log_entry()`, `read_log_entries()`; extend `execute_sync()` to accept `mode` and write log
- `backend/main.py` — add `SortRequest` model, `/api/sort` route, `/api/log` route; add optional `mode` field to `ExecuteRequest`

**Modified frontend:**
- `frontend/src/App.jsx` — add `'mode'` step, `mode` state, mode badge in header, pass `mode` + `preview` to child components
- `frontend/src/components/PreviewStep.jsx` — mode-aware summary bar and sections
- `frontend/src/components/ExecuteStep.jsx` — mode-aware confirmation and API call
- `frontend/src/components/Done.jsx` — mode-aware results + session history

**Modified tests:**
- `tests/test_comparator.py` — update key assertions, add duplicate_files tests
- `tests/test_operations.py` — patch `append_log_entry` in existing tests, add sort/log tests

**Modified config:**
- `.gitignore` — add `bounce_log.json`

---

## Task 1: Extend comparator to expose duplicate source files

**Files:**
- Modify: `backend/comparator.py`
- Modify: `tests/test_comparator.py`

- [ ] **Step 1: Update the existing key-assertion tests to include the new field**

In `tests/test_comparator.py`, update `test_compare_folders_returns_expected_keys`:

```python
def test_compare_folders_returns_expected_keys(tmp_path):
    a = tmp_path / "A"
    b = tmp_path / "B"
    a.mkdir(); b.mkdir()
    _touch(a, "Artist Track.mp3")
    _touch(b, "Artist Track.mp3")

    with patch("backend.comparator.read_tags", return_value=None):
        result = compare_folders(str(a), str(b))

    assert set(result.keys()) == {"delete_from_a", "keep_in_a", "move_to_a", "duplicate_b_files", "counts"}
    assert "Artist Track.mp3" in result["keep_in_a"]
```

- [ ] **Step 2: Add test for duplicate_files in compare_folders**

Append to `tests/test_comparator.py`:

```python
def test_compare_folders_duplicate_b_files(tmp_path):
    """Files in B that match A should appear in duplicate_b_files."""
    a = tmp_path / "A"
    b = tmp_path / "B"
    a.mkdir(); b.mkdir()
    _touch(a, "shared.mp3")
    _touch(b, "shared.mp3")
    _touch(b, "new.mp3")

    with patch("backend.comparator.read_tags", return_value=None):
        result = compare_folders(str(a), str(b))

    assert "shared.mp3" in result["duplicate_b_files"]
    assert "new.mp3" not in result["duplicate_b_files"]
    assert "new.mp3" in result["move_to_a"]


def test_compare_folders_multi_per_folder_has_duplicate_files(tmp_path):
    """Each per_folder entry should include duplicate_files list."""
    a = tmp_path / "A"
    b = tmp_path / "B"
    a.mkdir(); b.mkdir()
    _touch(a, "shared.mp3")
    _touch(b, "shared.mp3")
    _touch(b, "new.mp3")

    with patch("backend.comparator.read_tags", return_value=None):
        result = compare_folders_multi(str(a), [str(b)])

    pf = result["per_folder"][0]
    assert "duplicate_files" in pf
    assert "shared.mp3" in pf["duplicate_files"]
    assert "new.mp3" not in pf["duplicate_files"]
    assert pf["counts"]["duplicates"] == 1
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd "/Users/stuartmclean/Projects/Rekordbox Bounce" && source .venv/bin/activate && pytest tests/test_comparator.py -v
```

Expected: FAIL on `test_compare_folders_returns_expected_keys`, `test_compare_folders_duplicate_b_files`, `test_compare_folders_multi_per_folder_has_duplicate_files`

- [ ] **Step 4: Implement the changes in comparator.py**

In `compare_folders()`, add `matched_b` to the return dict. Replace the final return statement:

```python
    # (existing code above unchanged — matched_b set is already computed)
    delete_from_a = sorted(n for n in files_a if n not in matched_a)
    keep_in_a = sorted(matched_a)
    new_b_files = sorted(n for n in files_b if n not in matched_b)
    duplicate_b_files = sorted(matched_b)  # ← add this line

    return {
        "delete_from_a": delete_from_a,
        "keep_in_a": keep_in_a,
        "move_to_a": new_b_files,
        "duplicate_b_files": duplicate_b_files,  # ← add this
        "counts": {
            "delete_from_a": len(delete_from_a),
            "keep_in_a": len(matched_a),
            "move_to_a": len(new_b_files),
            "total_a": len(files_a),
            "total_b": len(files_b),
        },
    }
```

In `compare_folders_multi()`, add `duplicate_files` to each per_folder entry. Replace the per_folder.append call:

```python
        per_folder.append({
            "folder_b": folder_b,
            "folder_b_name": Path(folder_b).name,
            "move_to_a": move_to_a,
            "duplicate_files": result["duplicate_b_files"],  # ← add this
            "counts": {
                "total_b": result["counts"]["total_b"],
                "move_to_a": len(move_to_a),
                "duplicates": len(result["duplicate_b_files"]),  # ← add this
            },
        })
```

- [ ] **Step 5: Run tests — all must pass**

```bash
pytest tests/test_comparator.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/comparator.py tests/test_comparator.py
git commit -m "feat: expose duplicate_files per source folder in comparator"
```

---

## Task 2: Add sort_sync() to operations.py

**Files:**
- Modify: `backend/operations.py`
- Modify: `tests/test_operations.py`

- [ ] **Step 1: Write failing tests for sort_sync**

Append to `tests/test_operations.py`:

```python
from backend.operations import sort_sync


def _mock_compare_for_sort(a, b_list, per_folder=None):
    per_folder = per_folder or []
    return {
        "global_delete_from_a": [],
        "global_keep_in_a": [],
        "per_folder": per_folder,
        "counts": {"total_a": 0, "to_quarantine": 0, "keep_in_a": 0, "total_adding": 0},
    }


def test_sort_creates_sibling_folders(tmp_path):
    a = tmp_path / "Library"
    b = tmp_path / "techno26"
    a.mkdir(); b.mkdir()
    _touch(b, "new_track.mp3")
    _touch(b, "old_track.mp3")

    compare_result = _mock_compare_for_sort(str(a), [str(b)], per_folder=[{
        "folder_b": str(b),
        "folder_b_name": "techno26",
        "move_to_a": ["new_track.mp3"],
        "duplicate_files": ["old_track.mp3"],
        "counts": {"total_b": 2, "move_to_a": 1, "duplicates": 1},
    }])

    with patch("backend.operations.compare_folders_multi", return_value=compare_result):
        result = sort_sync(str(a), [str(b)])

    assert (tmp_path / "techno26_New").is_dir()
    assert (tmp_path / "techno26_Duplicate").is_dir()


def test_sort_moves_new_files_to_new_folder(tmp_path):
    a = tmp_path / "Library"
    b = tmp_path / "techno26"
    a.mkdir(); b.mkdir()
    _touch(b, "new_track.mp3")

    compare_result = _mock_compare_for_sort(str(a), [str(b)], per_folder=[{
        "folder_b": str(b),
        "folder_b_name": "techno26",
        "move_to_a": ["new_track.mp3"],
        "duplicate_files": [],
        "counts": {"total_b": 1, "move_to_a": 1, "duplicates": 0},
    }])

    with patch("backend.operations.compare_folders_multi", return_value=compare_result):
        result = sort_sync(str(a), [str(b)])

    assert (tmp_path / "techno26_New" / "new_track.mp3").exists()
    assert not (b / "new_track.mp3").exists()
    pf = result["per_folder"][0]
    assert pf["moved_new"] == ["new_track.mp3"]
    assert pf["new_folder"] == str(tmp_path / "techno26_New")


def test_sort_moves_duplicates_to_duplicate_folder(tmp_path):
    a = tmp_path / "Library"
    b = tmp_path / "techno26"
    a.mkdir(); b.mkdir()
    _touch(b, "old_track.mp3")

    compare_result = _mock_compare_for_sort(str(a), [str(b)], per_folder=[{
        "folder_b": str(b),
        "folder_b_name": "techno26",
        "move_to_a": [],
        "duplicate_files": ["old_track.mp3"],
        "counts": {"total_b": 1, "move_to_a": 0, "duplicates": 1},
    }])

    with patch("backend.operations.compare_folders_multi", return_value=compare_result):
        result = sort_sync(str(a), [str(b)])

    assert (tmp_path / "techno26_Duplicate" / "old_track.mp3").exists()
    assert not (b / "old_track.mp3").exists()
    pf = result["per_folder"][0]
    assert pf["moved_duplicate"] == ["old_track.mp3"]
    assert pf["duplicate_folder"] == str(tmp_path / "techno26_Duplicate")


def test_sort_does_not_touch_library(tmp_path):
    a = tmp_path / "Library"
    b = tmp_path / "techno26"
    a.mkdir(); b.mkdir()
    library_file = _touch(a, "library_track.mp3")
    _touch(b, "new_track.mp3")

    compare_result = _mock_compare_for_sort(str(a), [str(b)], per_folder=[{
        "folder_b": str(b),
        "folder_b_name": "techno26",
        "move_to_a": ["new_track.mp3"],
        "duplicate_files": [],
        "counts": {"total_b": 1, "move_to_a": 1, "duplicates": 0},
    }])

    with patch("backend.operations.compare_folders_multi", return_value=compare_result):
        sort_sync(str(a), [str(b)])

    assert library_file.exists()


def test_sort_skips_collision_with_error(tmp_path):
    a = tmp_path / "Library"
    b = tmp_path / "techno26"
    new_folder = tmp_path / "techno26_New"
    a.mkdir(); b.mkdir(); new_folder.mkdir()
    _touch(b, "track.mp3")
    _touch(new_folder, "track.mp3")  # collision

    compare_result = _mock_compare_for_sort(str(a), [str(b)], per_folder=[{
        "folder_b": str(b),
        "folder_b_name": "techno26",
        "move_to_a": ["track.mp3"],
        "duplicate_files": [],
        "counts": {"total_b": 1, "move_to_a": 1, "duplicates": 0},
    }])

    with patch("backend.operations.compare_folders_multi", return_value=compare_result):
        result = sort_sync(str(a), [str(b)])

    assert result["per_folder"][0]["errors"][0]["file"] == "track.mp3"
    assert result["summary"]["error_count"] == 1
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_operations.py::test_sort_creates_sibling_folders -v
```

Expected: FAIL with `ImportError` or `AttributeError`

- [ ] **Step 3: Implement sort_sync in operations.py**

Add after the existing imports at the top of `backend/operations.py`:

```python
from backend.comparator import compare_folders_multi as _compare_multi
```

Then add `sort_sync()` at the end of the file:

```python
def sort_sync(folder_a: str, folders_b: list[str]) -> dict:
    """
    For each source folder, move files into sibling folders:
      [SourceName]_New/       — not in Library
      [SourceName]_Duplicate/ — already in Library
    Never touches folder_a.
    """
    preview = _compare_multi(folder_a, folders_b)
    per_folder_results = []

    for pf in preview["per_folder"]:
        folder_b = pf["folder_b"]
        folder_b_name = pf["folder_b_name"]
        parent = Path(folder_b).parent
        files_b = scan_folder(folder_b)

        new_folder = parent / f"{folder_b_name}_New"
        duplicate_folder = parent / f"{folder_b_name}_Duplicate"
        new_folder.mkdir(exist_ok=True)
        duplicate_folder.mkdir(exist_ok=True)

        moved_new, moved_duplicate, errors = [], [], []

        for filename in pf["move_to_a"]:
            src = files_b.get(filename)
            if src is None:
                continue
            dest = new_folder / filename
            if dest.exists():
                errors.append({"file": filename, "error": f"'{filename}' already exists in New folder, skipped"})
                continue
            try:
                shutil.move(str(src), str(dest))
                moved_new.append(filename)
            except Exception as e:
                errors.append({"file": filename, "error": str(e)})

        for filename in pf["duplicate_files"]:
            src = files_b.get(filename)
            if src is None:
                continue
            dest = duplicate_folder / filename
            if dest.exists():
                errors.append({"file": filename, "error": f"'{filename}' already exists in Duplicate folder, skipped"})
                continue
            try:
                shutil.move(str(src), str(dest))
                moved_duplicate.append(filename)
            except Exception as e:
                errors.append({"file": filename, "error": str(e)})

        per_folder_results.append({
            "folder_b": folder_b,
            "folder_b_name": folder_b_name,
            "new_folder": str(new_folder),
            "duplicate_folder": str(duplicate_folder),
            "moved_new": moved_new,
            "moved_duplicate": moved_duplicate,
            "errors": errors,
        })

    total_new = sum(len(pf["moved_new"]) for pf in per_folder_results)
    total_duplicate = sum(len(pf["moved_duplicate"]) for pf in per_folder_results)
    all_errors = [e for pf in per_folder_results for e in pf["errors"]]

    return {
        "per_folder": per_folder_results,
        "summary": {
            "total_new": total_new,
            "total_duplicate": total_duplicate,
            "error_count": len(all_errors),
        },
    }
```

Also remove the lazy import inside execute_sync since _compare_multi is now imported at the top:

In `execute_sync()`, remove the line:
```python
    from backend.comparator import compare_folders_multi  # lazy import — added in Task 2
```

And replace `compare_folders_multi(folder_a, folders_b)` with `_compare_multi(folder_a, folders_b)`.

- [ ] **Step 4: Run all sort tests**

```bash
pytest tests/test_operations.py -k "sort" -v
```

Expected: all PASS

- [ ] **Step 5: Run full test suite to catch regressions**

```bash
pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/operations.py tests/test_operations.py
git commit -m "feat: add sort_sync() — moves source files into sibling New/Duplicate folders"
```

---

## Task 3: Session log utilities

**Files:**
- Modify: `backend/operations.py`
- Modify: `tests/test_operations.py`

- [ ] **Step 1: Write failing tests for log utilities**

Append to `tests/test_operations.py`:

```python
from backend.operations import append_log_entry, read_log_entries
import json


def test_append_log_entry_creates_file(tmp_path):
    log_path = tmp_path / "test_log.json"
    entry = {"timestamp": "2026-04-18T12:00:00", "mode": "merge", "counts": {}}
    append_log_entry(entry, log_path=log_path)
    assert log_path.exists()
    data = json.loads(log_path.read_text())
    assert len(data) == 1
    assert data[0]["mode"] == "merge"


def test_append_log_entry_appends(tmp_path):
    log_path = tmp_path / "test_log.json"
    append_log_entry({"mode": "merge"}, log_path=log_path)
    append_log_entry({"mode": "bounce"}, log_path=log_path)
    data = json.loads(log_path.read_text())
    assert len(data) == 2


def test_read_log_entries_returns_reversed(tmp_path):
    log_path = tmp_path / "test_log.json"
    for i in range(7):
        append_log_entry({"index": i}, log_path=log_path)
    entries = read_log_entries(log_path=log_path, limit=5)
    assert len(entries) == 5
    assert entries[0]["index"] == 6  # newest first
    assert entries[4]["index"] == 2


def test_read_log_entries_missing_file(tmp_path):
    log_path = tmp_path / "nonexistent.json"
    entries = read_log_entries(log_path=log_path)
    assert entries == []
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_operations.py -k "log_entry or log_entries" -v
```

Expected: FAIL with `ImportError`

- [ ] **Step 3: Implement log utilities in operations.py**

Add at the top of `backend/operations.py` after existing imports:

```python
import json
from datetime import datetime, timezone
```

Add the log path constant after the imports:

```python
_LOG_PATH = Path(__file__).parent.parent / "bounce_log.json"
```

Add the two utility functions after `get_quarantine_dir()`:

```python
def append_log_entry(entry: dict, log_path: Path = None) -> None:
    path = log_path or _LOG_PATH
    entries = []
    if path.exists():
        try:
            entries = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            entries = []
    entries.append(entry)
    path.write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")


def read_log_entries(limit: int = 5, log_path: Path = None) -> list:
    path = log_path or _LOG_PATH
    if not path.exists():
        return []
    try:
        entries = json.loads(path.read_text(encoding="utf-8"))
        return list(reversed(entries))[:limit]
    except Exception:
        return []
```

- [ ] **Step 4: Run log tests**

```bash
pytest tests/test_operations.py -k "log_entry or log_entries" -v
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/operations.py tests/test_operations.py
git commit -m "feat: add append_log_entry() and read_log_entries() for session log"
```

---

## Task 4: Add mode param to execute_sync + log writing + new API routes

**Files:**
- Modify: `backend/operations.py`
- Modify: `backend/main.py`
- Modify: `tests/test_operations.py`

- [ ] **Step 1: Update existing execute_sync tests to patch append_log_entry**

In `tests/test_operations.py`, update each test that calls `execute_sync` to also patch `backend.operations.append_log_entry`. Example — update `test_execute_keeps_original_b_filename`:

```python
def test_execute_keeps_original_b_filename(tmp_path):
    a = tmp_path / "A"
    b = tmp_path / "B"
    a.mkdir(); b.mkdir()
    _touch(b, "DJ Mix Vol1.mp3")

    compare_result = _mock_compare(
        str(a), [str(b)],
        per_folder=[{
            "folder_b": str(b),
            "folder_b_name": "B",
            "move_to_a": ["DJ Mix Vol1.mp3"],
            "duplicate_files": [],
            "counts": {"total_b": 1, "move_to_a": 1, "duplicates": 0},
        }]
    )

    with patch("backend.comparator.compare_folders_multi", return_value=compare_result), \
         patch("backend.operations.append_log_entry"):
        result = execute_sync(str(a), [str(b)], files_to_keep=[])

    assert (a / "DJ Mix Vol1.mp3").exists()
    assert result["per_folder"][0]["moved"] == ["DJ Mix Vol1.mp3"]
```

Apply the same `patch("backend.operations.append_log_entry")` addition to:
- `test_execute_creates_m3u_playlist`
- `test_execute_no_playlist_when_nothing_moved`

Also update `_mock_compare` helper to include `duplicate_files` in per_folder entries:

```python
def _mock_compare(a, b_list, delete=None, keep=None, per_folder=None):
    delete = delete or []
    keep = keep or []
    per_folder = per_folder or []
    # Ensure all per_folder entries have duplicate_files
    for pf in per_folder:
        pf.setdefault("duplicate_files", [])
        pf["counts"].setdefault("duplicates", 0)
    return {
        "global_delete_from_a": delete,
        "global_keep_in_a": keep,
        "per_folder": per_folder,
        "counts": {
            "total_a": len(delete) + len(keep),
            "to_quarantine": len(delete),
            "keep_in_a": len(keep),
            "total_adding": sum(len(pf["move_to_a"]) for pf in per_folder),
        },
    }
```

- [ ] **Step 2: Add mode param to execute_sync and wire in log writing**

In `backend/operations.py`, update the `execute_sync` signature and add log writing at the end:

```python
def execute_sync(folder_a: str, folders_b: list[str], files_to_keep: list[str], mode: str = "bounce") -> dict:
```

At the end of `execute_sync()`, before the final `return`, add:

```python
    append_log_entry({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "library_name": Path(folder_a).name,
        "library_path": folder_a,
        "sources": [Path(f).name for f in folders_b],
        "counts": {
            "moved": total_moved,
            "quarantined": len(quarantined),
            "kept": len(files_to_keep),
            "errors": len(errors),
        },
    })
```

Also add log writing in `sort_sync()`, before its final `return`:

```python
    append_log_entry({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": "sort",
        "library_name": Path(folder_a).name,
        "library_path": folder_a,
        "sources": [Path(f).name for f in folders_b],
        "counts": {
            "moved": total_new + total_duplicate,
            "new": total_new,
            "duplicates": total_duplicate,
            "errors": len(all_errors),
        },
    })
```

- [ ] **Step 3: Update main.py — add mode to ExecuteRequest and new routes**

In `backend/main.py`:

Add `mode` field to `ExecuteRequest`:

```python
class ExecuteRequest(BaseModel):
    folder_a: str
    folders_b: list[str]
    files_to_keep: list[str] = []
    mode: str = "bounce"
```

Update the `/api/execute` route to pass mode:

```python
@app.post("/api/execute")
def execute(req: ExecuteRequest):
    """Execute the sync. Destructive — only call after user confirms preview."""
    try:
        return execute_sync(req.folder_a, req.folders_b, req.files_to_keep, req.mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

Add new models and routes after the existing ones:

```python
class SortRequest(BaseModel):
    folder_a: str
    folders_b: list[str]


@app.post("/api/sort")
def sort(req: SortRequest):
    """Sort source files into sibling New/Duplicate folders. Never touches Library."""
    try:
        return sort_sync(req.folder_a, req.folders_b)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/log")
def get_log():
    """Return last 5 session log entries in reverse chronological order."""
    try:
        return read_log_entries()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

Update the import at the top of `main.py`:

```python
from backend.operations import execute_sync, get_quarantine_dir, undo_sync, sort_sync, read_log_entries
```

- [ ] **Step 4: Run full test suite**

```bash
pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/operations.py tests/test_operations.py
git commit -m "feat: wire mode into execute_sync, add /api/sort and /api/log routes"
```

---

## Task 5: ModeStep.jsx — new component

**Files:**
- Create: `frontend/src/components/ModeStep.jsx`

- [ ] **Step 1: Create ModeStep.jsx**

```jsx
const MODES = [
  {
    key: 'sort',
    label: 'SORT',
    description: "Separates what's new from what's old. So you don't waste time re-analysing tracks you already have.",
    color: 'var(--accent)',
    dimColor: 'var(--accent-dim)',
    borderColor: 'rgba(34,211,238,0.25)',
  },
  {
    key: 'merge',
    label: 'MERGE',
    description: "Brings new and old together. Your existing Library is protected. New tracks are added. Nothing is removed.",
    color: 'var(--accent)',
    dimColor: 'var(--accent-dim)',
    borderColor: 'rgba(34,211,238,0.25)',
  },
  {
    key: 'bounce',
    label: 'BOUNCE',
    description: "Spring clean. Replaces your old Library with your new one — without overwriting anything. New tracks come in, unmatched tracks go to quarantine.",
    color: 'var(--danger)',
    dimColor: 'var(--danger-dim)',
    borderColor: 'rgba(244,63,94,0.25)',
  },
]

export default function ModeStep({ mode, setMode, onNext }) {
  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          Choose a mode
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Select how you want to work with your folders.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
        {MODES.map(m => {
          const selected = mode === m.key
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              style={{
                padding: '20px 24px',
                borderRadius: '10px',
                background: selected ? m.dimColor : 'var(--surface)',
                border: `1px solid ${selected ? m.borderColor : 'var(--border)'}`,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{
                  fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 700,
                  color: selected ? m.color : 'var(--text-muted)',
                  letterSpacing: '0.1em',
                }}>
                  {m.label}
                </span>
                {selected && (
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: m.color, flexShrink: 0,
                  }} />
                )}
              </div>
              <p style={{
                fontSize: '13px', lineHeight: 1.55, margin: 0,
                color: selected ? 'var(--text)' : 'var(--text-muted)',
              }}>
                {m.description}
              </p>
            </button>
          )
        })}
      </div>

      <button
        onClick={onNext}
        style={{
          width: '100%', padding: '14px', borderRadius: '8px',
          background: 'var(--accent)', color: '#000',
          border: 'none', cursor: 'pointer',
          fontSize: '14px', fontWeight: 600, fontFamily: 'IBM Plex Sans',
        }}
      >
        Continue →
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ModeStep.jsx
git commit -m "feat: add ModeStep component — mode selection card UI"
```

---

## Task 6: App.jsx — mode wiring

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Rewrite App.jsx with mode step and mode state**

```jsx
import { useState } from 'react'
import './index.css'
import ModeStep from './components/ModeStep'
import FolderSetup from './components/FolderSetup'
import PreviewStep from './components/PreviewStep'
import ExecuteStep from './components/ExecuteStep'
import Done from './components/Done'

const STEPS = [
  { key: 'mode', label: 'Mode' },
  { key: 'setup', label: 'Folders' },
  { key: 'preview', label: 'Preview' },
  { key: 'execute', label: 'Confirm' },
  { key: 'done', label: 'Done' },
]

const MODE_COLORS = {
  sort: { color: 'var(--accent)', dim: 'var(--accent-dim)', border: 'rgba(34,211,238,0.25)' },
  merge: { color: 'var(--accent)', dim: 'var(--accent-dim)', border: 'rgba(34,211,238,0.25)' },
  bounce: { color: 'var(--danger)', dim: 'var(--danger-dim)', border: 'rgba(244,63,94,0.25)' },
}

export default function App() {
  const [step, setStep] = useState('mode')
  const [mode, setMode] = useState('merge')
  const [folderA, setFolderA] = useState('')
  const [foldersB, setFoldersB] = useState([''])
  const [preview, setPreview] = useState(null)
  const [filesToKeep, setFilesToKeep] = useState([])
  const [result, setResult] = useState(null)

  const currentIndex = STEPS.findIndex(s => s.key === step)
  const mc = MODE_COLORS[mode]

  const handleReset = () => {
    setStep('mode')
    setMode('merge')
    setFolderA('')
    setFoldersB([''])
    setPreview(null)
    setFilesToKeep([])
    setResult(null)
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '20px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>
            Rekordbox Bounce
          </h1>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.05em' }}>
            v0.2
          </span>
          {step !== 'mode' && (
            <span style={{
              fontSize: '10px', fontFamily: 'IBM Plex Mono', fontWeight: 700,
              letterSpacing: '0.1em', padding: '2px 8px', borderRadius: '4px',
              color: mc.color, background: mc.dim, border: `1px solid ${mc.border}`,
            }}>
              {mode.toUpperCase()}
            </span>
          )}
        </div>

        {/* Step indicator */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {STEPS.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '20px',
                fontSize: '12px', fontFamily: 'IBM Plex Sans',
                background: i === currentIndex ? 'var(--accent-dim)' : 'transparent',
                color: i < currentIndex ? 'var(--accent)' : i === currentIndex ? 'var(--accent)' : 'var(--text-dim)',
                border: i === currentIndex ? '1px solid rgba(34,211,238,0.25)' : '1px solid transparent',
                transition: 'all 0.2s',
              }}>
                <span style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px',
                  background: i < currentIndex ? 'var(--accent)' : i === currentIndex ? 'rgba(34,211,238,0.2)' : 'var(--surface-2)',
                  color: i < currentIndex ? '#000' : i === currentIndex ? 'var(--accent)' : 'var(--text-dim)',
                  fontWeight: 600,
                }}>
                  {i < currentIndex ? '✓' : i + 1}
                </span>
                {s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: '20px', height: '1px', background: i < currentIndex ? 'var(--accent)' : 'var(--border)', opacity: 0.5 }} />
              )}
            </div>
          ))}
        </nav>
      </header>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: '680px' }}>
          {step === 'mode' && (
            <ModeStep
              mode={mode}
              setMode={setMode}
              onNext={() => setStep('setup')}
            />
          )}
          {step === 'setup' && (
            <FolderSetup
              folderA={folderA}
              setFolderA={setFolderA}
              foldersB={foldersB}
              setFoldersB={setFoldersB}
              onNext={(p) => { setPreview(p); setFilesToKeep([]); setStep('preview') }}
            />
          )}
          {step === 'preview' && (
            <PreviewStep
              preview={preview}
              filesToKeep={filesToKeep}
              setFilesToKeep={setFilesToKeep}
              mode={mode}
              onBack={() => setStep('setup')}
              onConfirm={() => setStep('execute')}
            />
          )}
          {step === 'execute' && (
            <ExecuteStep
              folderA={folderA}
              foldersB={foldersB}
              filesToKeep={filesToKeep}
              mode={mode}
              onResult={(r) => { setResult(r); setStep('done') }}
              onBack={() => setStep('preview')}
            />
          )}
          {step === 'done' && (
            <Done
              result={result}
              folderA={folderA}
              mode={mode}
              preview={preview}
              onReset={handleReset}
            />
          )}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Start the dev server and verify the Mode step renders**

```bash
cd "/Users/stuartmclean/Projects/Rekordbox Bounce/frontend" && npm run dev
```

Open http://localhost:5173. You should see the Mode step with three cards. MERGE should be pre-selected. Clicking Continue should advance to Folders. The MERGE badge should appear in the header after the mode is chosen.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add mode step to wizard, mode badge in header"
```

---

## Task 7: PreviewStep.jsx — mode-aware sections

**Files:**
- Modify: `frontend/src/components/PreviewStep.jsx`

- [ ] **Step 1: Add mode prop and adapt summary bar**

Replace the `export default function PreviewStep(...)` signature and summary bar:

```jsx
export default function PreviewStep({ preview, filesToKeep, setFilesToKeep, onBack, onConfirm, mode }) {
  const { global_delete_from_a, global_keep_in_a, per_folder, quarantine_path, counts } = preview
  const quarantineCount = counts.to_quarantine - filesToKeep.length

  const toggleKeep = (f) =>
    setFilesToKeep(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])

  const totalNew = per_folder.reduce((s, pf) => s + pf.move_to_a.length, 0)
  const totalDuplicate = per_folder.reduce((s, pf) => s + (pf.duplicate_files || []).length, 0)
  const totalSourceFiles = per_folder.reduce((s, pf) => s + pf.counts.total_b, 0)

  const summaryStats = mode === 'sort'
    ? [
        { value: totalSourceFiles, label: 'Source files', color: 'var(--text)' },
        { value: totalNew, label: 'Going to New/', color: 'var(--accent)' },
        { value: totalDuplicate, label: 'Going to Duplicate/', color: 'var(--text-muted)' },
      ]
    : mode === 'merge'
    ? [
        { value: counts.total_a, label: 'Files in Library', color: 'var(--text)' },
        { value: totalSourceFiles, label: 'Files in Source', color: 'var(--text)' },
        { value: counts.keep_in_a, label: 'Already matched', color: 'var(--success)' },
        { value: counts.total_adding, label: 'Adding to Library', color: 'var(--accent)' },
      ]
    : [
        { value: counts.total_a, label: 'Files in Library', color: 'var(--text)' },
        { value: totalSourceFiles, label: 'Files in Source', color: 'var(--text)' },
        { value: quarantineCount, label: 'To quarantine', color: 'var(--danger)' },
        { value: counts.total_adding, label: 'Adding to Library', color: 'var(--accent)' },
      ]
```

- [ ] **Step 2: Add mode-aware section rendering**

Replace the sections JSX (everything between the summary bar and the nav buttons) with:

```jsx
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {mode === 'sort' && per_folder.map((pf, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Section
              title={`${pf.move_to_a.length} going to ${pf.folder_b_name}_New/`}
              meta="Not in your Library"
              color="var(--accent)" dimColor="var(--accent-dim)" borderColor="rgba(34,211,238,0.2)"
              defaultOpen
            >
              {pf.move_to_a.length === 0 ? <EmptyState text="No new files" /> : (
                <ul style={{ padding: '0 0 4px' }}>
                  {pf.move_to_a.map(f => (
                    <li key={f} style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</li>
                  ))}
                </ul>
              )}
            </Section>
            <Section
              title={`${(pf.duplicate_files || []).length} going to ${pf.folder_b_name}_Duplicate/`}
              meta="Already in your Library"
              color="var(--text-muted)" dimColor="var(--surface)" borderColor="var(--border)"
              defaultOpen={false}
            >
              {(pf.duplicate_files || []).length === 0 ? <EmptyState text="No duplicates found" /> : (
                <ul style={{ padding: '0 0 4px' }}>
                  {(pf.duplicate_files || []).map(f => (
                    <li key={f} style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        ))}

        {mode === 'merge' && (
          <>
            <Section
              title={`${counts.keep_in_a} already in Library`}
              meta="Matched — will not be moved or changed"
              color="var(--success)" dimColor="var(--success-dim)" borderColor="rgba(16,185,129,0.2)"
              defaultOpen={false}
            >
              {global_keep_in_a.length === 0 ? <EmptyState text="No matched files" /> : (
                <ul style={{ padding: '0 0 4px' }}>
                  {global_keep_in_a.map(f => (
                    <li key={f} style={{ padding: '9px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</li>
                  ))}
                </ul>
              )}
            </Section>
            {per_folder.map((pf, i) => (
              <Section key={i}
                title={`${pf.move_to_a.length} new files from ${pf.folder_b_name}`}
                meta="Will be moved into Library"
                color="var(--accent)" dimColor="var(--accent-dim)" borderColor="rgba(34,211,238,0.2)"
                defaultOpen
              >
                {pf.move_to_a.length === 0 ? <EmptyState text="No new files to add" /> : (
                  <ul style={{ padding: '0 0 4px' }}>
                    {pf.move_to_a.map(f => (
                      <li key={f} style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</li>
                    ))}
                  </ul>
                )}
              </Section>
            ))}
          </>
        )}

        {mode === 'bounce' && (
          <>
            <Section
              title={`${quarantineCount} going to quarantine`}
              meta={quarantine_path}
              color="var(--danger)" dimColor="var(--danger-dim)" borderColor="rgba(244,63,94,0.2)"
              defaultOpen badge={`${filesToKeep.length} kept`} badgeVisible={filesToKeep.length > 0}
            >
              {global_delete_from_a.length === 0 ? <EmptyState text="Nothing to quarantine" /> : (
                <ul style={{ padding: '0 0 4px' }}>
                  {global_delete_from_a.map(f => {
                    const kept = filesToKeep.includes(f)
                    return (
                      <li key={f} onClick={() => toggleKeep(f)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', cursor: 'pointer', borderTop: '1px solid var(--border)', background: kept ? 'rgba(34,211,238,0.04)' : 'transparent', transition: 'background 0.1s' }}>
                        <Checkbox checked={kept} color="var(--accent)" />
                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: kept ? 'var(--accent)' : 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                        {kept && <span style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono', color: 'var(--accent)', padding: '2px 8px', background: 'var(--accent-dim)', borderRadius: '4px', whiteSpace: 'nowrap' }}>KEEPING</span>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Section>
            <Section
              title={`${counts.keep_in_a} staying in Library`}
              meta="Matched — cue points safe, not touched"
              color="var(--success)" dimColor="var(--success-dim)" borderColor="rgba(16,185,129,0.2)"
              defaultOpen={false}
            >
              {global_keep_in_a.length === 0 ? <EmptyState text="No matched files" /> : (
                <ul style={{ padding: '0 0 4px' }}>
                  {global_keep_in_a.map(f => (
                    <li key={f} style={{ padding: '9px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</li>
                  ))}
                </ul>
              )}
            </Section>
            {per_folder.map((pf, i) => (
              <Section key={i}
                title={`${pf.move_to_a.length} new files from ${pf.folder_b_name}`}
                meta="Will be moved into Library with original filename"
                color="var(--accent)" dimColor="var(--accent-dim)" borderColor="rgba(34,211,238,0.2)"
                defaultOpen
              >
                {pf.move_to_a.length === 0 ? <EmptyState text="No new files to add" /> : (
                  <ul style={{ padding: '0 0 4px' }}>
                    {pf.move_to_a.map(f => (
                      <li key={f} style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</li>
                    ))}
                  </ul>
                )}
              </Section>
            ))}
          </>
        )}
      </div>
```

Also update the summary bar render (replace the existing stats map) to use `summaryStats`:

```jsx
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${summaryStats.length}, 1fr)`,
        gap: '1px', background: 'var(--border)',
        borderRadius: '10px', overflow: 'hidden',
        marginBottom: '20px', border: '1px solid var(--border)',
      }}>
        {summaryStats.map(s => (
          <div key={s.label} style={{ padding: '18px 16px', background: 'var(--surface)', textAlign: 'center' }}>
            <div style={{ fontSize: '26px', fontFamily: 'Syne', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px', fontFamily: 'IBM Plex Mono' }}>{s.label}</div>
          </div>
        ))}
      </div>
```

- [ ] **Step 3: Verify in browser — test all three modes**

With the dev server running:
- Set mode to SORT: preview sections should show "Going to _New/" and "Going to _Duplicate/"
- Set mode to MERGE: sections show matched (green, collapsed) and new per source (cyan)
- Set mode to BOUNCE: current sections (quarantine, staying, new)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PreviewStep.jsx
git commit -m "feat: make PreviewStep mode-aware (SORT/MERGE/BOUNCE sections)"
```

---

## Task 8: ExecuteStep.jsx — mode-aware confirmation

**Files:**
- Modify: `frontend/src/components/ExecuteStep.jsx`

- [ ] **Step 1: Rewrite ExecuteStep.jsx**

```jsx
import { useState } from 'react'

export default function ExecuteStep({ folderA, foldersB, filesToKeep, mode, onResult, onBack }) {
  const [confirmed, setConfirmed] = useState(false)
  const [bounceInput, setBounceInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const canRun =
    mode === 'sort' ? true :
    mode === 'merge' ? confirmed :
    bounceInput === 'BOUNCE'

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const endpoint = mode === 'sort' ? '/api/sort' : '/api/execute'
      const body = mode === 'sort'
        ? { folder_a: folderA, folders_b: foldersB }
        : { folder_a: folderA, folders_b: foldersB, files_to_keep: filesToKeep, mode }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Something went wrong')
      }
      onResult(await res.json())
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const labels = {
    sort: { title: 'Ready to sort', subtitle: "Files will be moved into sibling folders next to each Source. Your Library is not touched.", button: 'Run Sort' },
    merge: { title: 'Ready to merge', subtitle: 'New files will move into your Library. Duplicates stay where they are.', button: 'Run Merge' },
    bounce: { title: 'Ready to bounce', subtitle: null, button: 'Run Bounce' },
  }
  const { title, subtitle, button } = labels[mode]

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{subtitle}</p>
        )}
      </div>

      {mode === 'bounce' && (
        <div style={{
          padding: '16px 20px', borderRadius: '10px', marginBottom: '20px',
          background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.3)',
        }}>
          <p style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Warning
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
            This will quarantine Library files not found in any Source. This cannot be undone automatically if the quarantine folder is deleted.
          </p>
        </div>
      )}

      {mode === 'merge' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '24px' }}>
          <div
            onClick={() => setConfirmed(c => !c)}
            style={{
              width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
              border: `2px solid ${confirmed ? 'var(--accent)' : 'var(--border-bright)'}`,
              background: confirmed ? 'var(--accent)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.1s',
            }}
          >
            {confirmed && <span style={{ color: '#000', fontSize: '11px', fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            I understand this will move files into my Library
          </span>
        </label>
      )}

      {mode === 'bounce' && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Type <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--danger)' }}>BOUNCE</span> to confirm
          </p>
          <input
            type="text"
            value={bounceInput}
            onChange={e => setBounceInput(e.target.value)}
            placeholder="BOUNCE"
            style={{
              width: '100%', padding: '12px 16px', borderRadius: '8px',
              background: 'var(--surface)', border: `1px solid ${bounceInput === 'BOUNCE' ? 'var(--danger)' : 'var(--border)'}`,
              color: 'white', fontSize: '14px', fontFamily: 'IBM Plex Mono',
              outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
          />
        </div>
      )}

      {error && (
        <div style={{
          marginBottom: '16px', padding: '14px 16px', borderRadius: '8px',
          background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.2)',
          color: 'var(--danger)', fontSize: '13px', fontFamily: 'IBM Plex Mono',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onBack} disabled={loading} style={secondaryBtn}>← Back</button>
        <button
          onClick={handleRun}
          disabled={!canRun || loading}
          style={{
            ...primaryBtn,
            background: canRun && !loading
              ? (mode === 'bounce' ? 'var(--danger)' : 'var(--accent)')
              : 'var(--surface-2)',
            color: canRun && !loading ? (mode === 'bounce' ? 'white' : '#000') : 'var(--text-dim)',
            cursor: canRun && !loading ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Running...' : button}
        </button>
      </div>
    </div>
  )
}

const primaryBtn = {
  flex: 1, padding: '14px', borderRadius: '8px',
  border: 'none', fontSize: '14px', fontWeight: 600, fontFamily: 'IBM Plex Sans',
  transition: 'all 0.15s',
}

const secondaryBtn = {
  padding: '14px 20px', borderRadius: '8px',
  background: 'transparent', color: 'var(--text-muted)',
  border: '1px solid var(--border-bright)', cursor: 'pointer',
  fontSize: '14px', fontFamily: 'IBM Plex Sans',
}
```

- [ ] **Step 2: Verify in browser**

- SORT: "Run Sort" button is always enabled, no checkbox
- MERGE: checkbox must be ticked before "Run Merge" enables
- BOUNCE: danger warning shown, "Run Bounce" stays disabled until "BOUNCE" typed exactly

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ExecuteStep.jsx
git commit -m "feat: mode-aware ExecuteStep — SORT no-checkbox, MERGE checkbox, BOUNCE type-to-confirm"
```

---

## Task 9: Done.jsx — mode-aware results + session history

**Files:**
- Modify: `frontend/src/components/Done.jsx`

- [ ] **Step 1: Rewrite Done.jsx**

```jsx
import { useState, useEffect } from 'react'

export default function Done({ result, folderA, mode, preview, onReset }) {
  const [undoState, setUndoState] = useState('idle')
  const [undoError, setUndoError] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    fetch('/api/log').then(r => r.json()).then(setHistory).catch(() => {})
  }, [])

  const handleUndo = async () => {
    setUndoState('loading')
    setUndoError(null)
    try {
      const { quarantined, quarantine_path, per_folder } = result
      const res = await fetch('/api/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_a: folderA,
          quarantine_path,
          quarantined,
          per_folder: per_folder.map(pf => ({
            folder_b: pf.folder_b,
            moved: pf.moved,
            playlist_path: pf.playlist_path,
          })),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Undo failed')
      }
      setUndoState('done')
    } catch (err) {
      setUndoError(err.message)
      setUndoState('error')
    }
  }

  if (undoState === 'done') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px' }}>↩</div>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>Undo complete</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>Files have been moved back. Your library is as it was.</p>
        <button onClick={onReset} style={resetBtn}>Start over</button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '28px', textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--success-dim)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px' }}>✓</div>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          {mode === 'sort' ? 'Sort complete' : mode === 'merge' ? 'Merge complete' : 'Sync complete'}
        </h2>
      </div>

      {/* SORT results */}
      {mode === 'sort' && (
        <>
          <StatsBar stats={[
            { value: result.summary.total_new, label: 'Moved to New/', color: 'var(--accent)' },
            { value: result.summary.total_duplicate, label: 'Moved to Duplicate/', color: 'var(--text-muted)' },
            { value: result.summary.error_count, label: 'Errors', color: result.summary.error_count > 0 ? 'var(--amber)' : 'var(--text-dim)' },
          ]} />
          {result.per_folder.map((pf, i) => (
            <div key={i}>
              {pf.moved_new.length > 0 && (
                <CollapsibleList title={`${pf.moved_new.length} files in ${pf.folder_b_name}_New/`} color="var(--accent)" borderColor="rgba(34,211,238,0.2)" dimColor="var(--accent-dim)">
                  <PathRow path={pf.new_folder} />
                  {pf.moved_new.map((f, j) => <FileRow key={j} name={f} />)}
                </CollapsibleList>
              )}
              {pf.moved_duplicate.length > 0 && (
                <CollapsibleList title={`${pf.moved_duplicate.length} files in ${pf.folder_b_name}_Duplicate/`} color="var(--text-muted)" borderColor="var(--border)" dimColor="var(--surface)">
                  <PathRow path={pf.duplicate_folder} />
                  {pf.moved_duplicate.map((f, j) => <FileRow key={j} name={f} />)}
                </CollapsibleList>
              )}
              {pf.errors.length > 0 && <ErrorList errors={pf.errors} sourceName={pf.folder_b_name} />}
            </div>
          ))}
        </>
      )}

      {/* MERGE results */}
      {mode === 'merge' && (
        <>
          <StatsBar stats={[
            { value: result.summary.total_moved_count, label: 'Added to Library', color: 'var(--success)' },
            { value: result.summary.quarantined_count === 0 ? (preview?.per_folder || []).reduce((s, pf) => s + (pf.duplicate_files || []).length, 0) : 0, label: 'Duplicates found', color: 'var(--text-muted)' },
            { value: result.summary.error_count, label: 'Errors', color: result.summary.error_count > 0 ? 'var(--amber)' : 'var(--text-dim)' },
          ]} />
          {result.per_folder.map((pf, i) => {
            const previewPf = (preview?.per_folder || [])[i] || {}
            const duplicates = previewPf.duplicate_files || []
            return (
              <div key={i}>
                {pf.moved.length > 0 && (
                  <CollapsibleList title={`${pf.moved.length} added from ${pf.folder_b_name}`} color="var(--accent)" borderColor="rgba(34,211,238,0.2)" dimColor="var(--accent-dim)">
                    {pf.playlist_path && <PathRow path={pf.playlist_path} label="Playlist:" />}
                    {pf.moved.map((f, j) => <FileRow key={j} name={f} />)}
                  </CollapsibleList>
                )}
                {duplicates.length > 0 && (
                  <CollapsibleList title={`${duplicates.length} duplicates found in ${pf.folder_b_name}`} color="var(--text-muted)" borderColor="var(--border)" dimColor="var(--surface)">
                    <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>These files are already in your Library and were left in place.</div>
                    {duplicates.map((f, j) => <FileRow key={j} name={f} />)}
                  </CollapsibleList>
                )}
                {pf.errors.length > 0 && <ErrorList errors={pf.errors} sourceName={pf.folder_b_name} />}
              </div>
            )
          })}
        </>
      )}

      {/* BOUNCE results */}
      {mode === 'bounce' && (
        <>
          <StatsBar stats={[
            { value: result.summary.quarantined_count, label: 'Quarantined', color: 'var(--danger)' },
            { value: result.summary.kept_count, label: 'Kept in Library', color: 'var(--accent)' },
            { value: result.summary.total_moved_count, label: 'Added to Library', color: 'var(--success)' },
            { value: result.summary.error_count, label: 'Errors', color: result.summary.error_count > 0 ? 'var(--amber)' : 'var(--text-dim)' },
          ]} />
          {result.summary.quarantined_count > 0 && (
            <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
              Quarantine: <span style={{ color: 'var(--text)' }}>{result.quarantine_path}</span>
            </div>
          )}
          {result.per_folder.map((pf, i) => (
            <div key={i}>
              {pf.moved.length > 0 && (
                <CollapsibleList title={`${pf.moved.length} files added from ${pf.folder_b_name}`} color="var(--accent)" borderColor="rgba(34,211,238,0.2)" dimColor="var(--accent-dim)">
                  {pf.playlist_path && <PathRow path={pf.playlist_path} label="Playlist:" />}
                  {pf.moved.map((f, j) => <FileRow key={j} name={f} />)}
                </CollapsibleList>
              )}
              {pf.errors.length > 0 && <ErrorList errors={pf.errors} sourceName={pf.folder_b_name} />}
            </div>
          ))}
          {undoError && (
            <div style={{ marginBottom: '12px', padding: '14px 16px', background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '8px', color: 'var(--danger)', fontSize: '13px', fontFamily: 'IBM Plex Mono' }}>
              {undoError}
            </div>
          )}
        </>
      )}

      {/* Session history */}
      {history.length > 0 && (
        <details style={{ marginTop: '24px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface)', overflow: 'hidden' }}>
          <summary style={{ padding: '14px 20px', cursor: 'pointer', listStyle: 'none', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'IBM Plex Sans' }}>
            Session History
          </summary>
          <div>
            {history.map((entry, i) => (
              <div key={i} style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', whiteSpace: 'nowrap' }}>
                  {new Date(entry.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: '4px', color: entry.mode === 'bounce' ? 'var(--danger)' : 'var(--accent)', background: entry.mode === 'bounce' ? 'var(--danger-dim)' : 'var(--accent-dim)' }}>
                  {entry.mode.toUpperCase()}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text)', fontFamily: 'IBM Plex Sans' }}>{entry.library_name}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                  {entry.mode === 'sort'
                    ? `${entry.counts.new ?? 0} new · ${entry.counts.duplicates ?? 0} duplicates`
                    : entry.mode === 'merge'
                    ? `${entry.counts.moved ?? 0} moved`
                    : `${entry.counts.moved ?? 0} moved · ${entry.counts.quarantined ?? 0} quarantined`}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        {mode === 'bounce' && (
          <button
            onClick={handleUndo}
            disabled={undoState === 'loading'}
            style={{
              padding: '14px 20px', borderRadius: '8px',
              background: 'transparent',
              color: undoState === 'loading' ? 'var(--text-dim)' : 'var(--danger)',
              border: `1px solid ${undoState === 'loading' ? 'var(--border)' : 'rgba(244,63,94,0.4)'}`,
              cursor: undoState === 'loading' ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontFamily: 'IBM Plex Sans', transition: 'all 0.15s',
            }}
          >
            {undoState === 'loading' ? 'Undoing...' : '↩ Undo'}
          </button>
        )}
        <button onClick={onReset} style={{ ...resetBtn, flex: 1 }}>Start over</button>
      </div>
    </div>
  )
}

function StatsBar({ stats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: '1px', background: 'var(--border)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '20px' }}>
      {stats.map(s => (
        <div key={s.label} style={{ padding: '18px 16px', background: 'var(--surface)', textAlign: 'center' }}>
          <div style={{ fontSize: '26px', fontFamily: 'Syne', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px', fontFamily: 'IBM Plex Mono' }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

function CollapsibleList({ title, color, borderColor, dimColor, children }) {
  return (
    <details style={{ border: `1px solid ${borderColor}`, borderRadius: '10px', background: dimColor, overflow: 'hidden', marginBottom: '12px' }}>
      <summary style={{ padding: '14px 20px', cursor: 'pointer', listStyle: 'none', fontSize: '14px', fontWeight: 600, color: 'white', fontFamily: 'Syne', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />
        {title}
      </summary>
      <div style={{ maxHeight: '240px', overflowY: 'auto' }}>{children}</div>
    </details>
  )
}

function PathRow({ path, label = 'Folder:' }) {
  return (
    <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
      {label} <span style={{ color: 'var(--accent)' }}>{path}</span>
    </div>
  )
}

function FileRow({ name }) {
  return (
    <div style={{ padding: '9px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text-muted)' }}>
      {name}
    </div>
  )
}

function ErrorList({ errors, sourceName }) {
  return (
    <CollapsibleList title={`${errors.length} error${errors.length > 1 ? 's' : ''} in ${sourceName}`} color="var(--amber)" borderColor="rgba(245,158,11,0.2)" dimColor="var(--amber-dim)">
      {errors.map((e, j) => (
        <div key={j} style={{ padding: '9px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
          <span style={{ color: 'var(--text)' }}>{e.file}</span>
          <span style={{ color: 'var(--text-muted)' }}>: {e.error}</span>
        </div>
      ))}
    </CollapsibleList>
  )
}

const resetBtn = {
  padding: '14px', borderRadius: '8px',
  background: 'transparent', color: 'var(--text-muted)',
  border: '1px solid var(--border-bright)', cursor: 'pointer',
  fontSize: '14px', fontFamily: 'IBM Plex Sans',
}
```

- [ ] **Step 2: Verify in browser — check all three modes reach Done screen correctly**

Use the app with test folders to confirm:
- SORT Done: shows New/ and Duplicate/ folder paths and counts
- MERGE Done: shows moved files + playlist path + duplicates found section
- BOUNCE Done: shows quarantine count, moved files, undo button; session history appears below

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Done.jsx
git commit -m "feat: mode-aware Done screen with session history"
```

---

## Task 10: Housekeeping

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add bounce_log.json to .gitignore**

Append to `.gitignore`:

```
# Session log (user data, not source)
bounce_log.json
```

- [ ] **Step 2: Run full test suite one final time**

```bash
cd "/Users/stuartmclean/Projects/Rekordbox Bounce" && source .venv/bin/activate && pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore bounce_log.json"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Mode step ✓ · SORT sibling folders ✓ · SORT copy text ✓ · MERGE checkbox + duplicate display ✓ · BOUNCE type-to-confirm + warning ✓ · Preview adaptations ✓ · Confirm adaptations ✓ · Done adaptations ✓ · `/api/sort` ✓ · `/api/log` ✓ · Session log ✓ · History on Done ✓ · No third-party names ✓ · Library never touched in SORT/MERGE ✓
- [x] **Placeholder scan:** No TBDs, no vague steps — all code blocks are complete
- [x] **Type consistency:** `duplicate_files` used consistently across comparator → preview response → PreviewStep → Done; `sort_sync` return shape matches Done's `result.per_folder` access pattern; `append_log_entry` signature matches all call sites
