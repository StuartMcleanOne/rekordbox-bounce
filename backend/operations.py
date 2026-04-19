import shutil
import json
from pathlib import Path
from datetime import datetime, timezone
from backend.scanner import scan_folder
from backend.comparator import compare_folders_multi as _compare_multi


_LOG_PATH = Path(__file__).parent.parent / "bounce_log.json"


def _write_playlist(dest_dir: Path, folder_b_name: str, moved_files: list[str]) -> Path:
    """Write a .m3u playlist into dest_dir/_Playlists/ listing full paths of moved files."""
    playlists_dir = dest_dir / "_Playlists"
    playlists_dir.mkdir(exist_ok=True)
    playlist_path = playlists_dir / f"{folder_b_name}.m3u"
    lines = ["#EXTM3U"]
    for filename in moved_files:
        lines.append(str(dest_dir / filename))
    playlist_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return playlist_path


def get_quarantine_dir(folder_a: str) -> Path:
    """Quarantine folder lives in the parent of A, outside Rekordbox's watch."""
    return Path(folder_a).parent / "RekordboxBounce"


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


def execute_sync(folder_a: str, folders_b: list[str], files_to_keep: list[str], mode: str = "bounce") -> dict:
    """
    Execute the sync:
    1. Move files from A (not in any B) to quarantine — unless in files_to_keep
    2. For each B folder: move new files into A keeping their original filenames
    """
    files_a = scan_folder(folder_a)
    quarantine = get_quarantine_dir(folder_a)

    preview = _compare_multi(folder_a, folders_b)
    to_quarantine = [f for f in preview["global_delete_from_a"] if f not in files_to_keep]

    quarantined = []
    errors = []

    # Step 1: quarantine unwanted A files (BOUNCE only)
    if mode == "bounce":
        if to_quarantine:
            quarantine.mkdir(parents=True, exist_ok=True)
        for filename in to_quarantine:
            src = files_a[filename]
            dest = quarantine / filename
            if dest.exists():
                dest = quarantine / f"_{filename}"
            try:
                shutil.move(str(src), str(dest))
                quarantined.append(filename)
            except Exception as e:
                errors.append({"file": filename, "error": str(e)})

    # Step 2: move new files from each B folder into A
    dest_dir = Path(folder_a)
    per_folder_results = []
    for pf in preview["per_folder"]:
        folder_b = pf["folder_b"]
        folder_b_name = pf["folder_b_name"]
        files_b = scan_folder(folder_b)
        moved = []
        folder_errors = []

        for b_filename in pf["move_to_a"]:
            src = files_b[b_filename]
            dest = dest_dir / b_filename
            if dest.exists():
                folder_errors.append({"file": b_filename, "error": f"'{b_filename}' already exists in A, skipped"})
                continue
            try:
                shutil.move(str(src), str(dest))
                moved.append(b_filename)
            except Exception as e:
                folder_errors.append({"file": b_filename, "error": str(e)})

        playlist_path = None
        if moved:
            playlist_path = _write_playlist(dest_dir, folder_b_name, moved)

        per_folder_results.append({
            "folder_b": folder_b,
            "folder_b_name": folder_b_name,
            "moved": moved,
            "playlist_path": str(playlist_path) if playlist_path else None,
            "errors": folder_errors,
        })
        errors.extend(folder_errors)

    total_moved = sum(len(pf["moved"]) for pf in per_folder_results)
    kept_in_library_count = len(files_a) - len(quarantined)

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

    return {
        "quarantined": quarantined,
        "quarantine_path": str(quarantine),
        "per_folder": per_folder_results,
        "summary": {
            "quarantined_count": len(quarantined),
            "kept_count": len(files_to_keep),
            "total_moved_count": total_moved,
            "kept_in_library_count": kept_in_library_count,
            "error_count": len(errors),
        },
    }


def undo_sync(
    folder_a: str,
    quarantine_path: str,
    quarantined: list[str],
    per_folder: list[dict],
) -> dict:
    """
    Reverse a previous execute_sync:
    1. Move each quarantined file back from quarantine to folder_a
    2. Move each moved file back from folder_a to its source folder_b
    3. Delete playlist files
    """
    a = Path(folder_a)
    quarantine = Path(quarantine_path)
    errors = []
    restored_to_a = []
    restored_to_b_count = 0

    # Restore quarantined files to A
    for filename in quarantined:
        src = quarantine / filename
        dest = a / filename
        if not src.exists():
            errors.append({"file": filename, "error": "not found in quarantine"})
            continue
        if dest.exists():
            errors.append({"file": filename, "error": f"'{filename}' already exists in A, skipped"})
            continue
        try:
            shutil.move(str(src), str(dest))
            restored_to_a.append(filename)
        except Exception as e:
            errors.append({"file": filename, "error": str(e)})

    # Move files back to their B folders
    for pf in per_folder:
        b = Path(pf["folder_b"])
        for filename in pf.get("moved", []):
            src = a / filename
            dest = b / filename
            if not src.exists():
                errors.append({"file": filename, "error": "not found in A"})
                continue
            if dest.exists():
                errors.append({"file": filename, "error": f"'{filename}' already exists in B, skipped"})
                continue
            try:
                shutil.move(str(src), str(dest))
                restored_to_b_count += 1
            except Exception as e:
                errors.append({"file": filename, "error": str(e)})

        # Delete playlist
        playlist_path = pf.get("playlist_path")
        if playlist_path:
            p = Path(playlist_path)
            if p.exists():
                p.unlink()

    return {
        "restored_to_a": restored_to_a,
        "restored_to_a_count": len(restored_to_a),
        "restored_to_b_count": restored_to_b_count,
        "error_count": len(errors),
        "errors": errors,
    }


def sort_sync(folder_a: str, folders_b: list[str]) -> dict:
    """
    For each source folder, sort files into subfolders inside it:
      New/       — not in Library
      Duplicate/ — already in Library
    Never touches folder_a.
    """
    files_a = scan_folder(folder_a)
    preview = _compare_multi(folder_a, folders_b)
    per_folder_results = []

    for pf in preview["per_folder"]:
        folder_b = pf["folder_b"]
        folder_b_name = pf["folder_b_name"]
        files_b = scan_folder(folder_b)

        new_folder = Path(folder_b) / "New"
        duplicate_folder = Path(folder_b) / "Duplicate"
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

    return {
        "per_folder": per_folder_results,
        "summary": {
            "total_new": total_new,
            "total_duplicate": total_duplicate,
            "kept_in_library_count": len(files_a),
            "error_count": len(all_errors),
        },
    }
