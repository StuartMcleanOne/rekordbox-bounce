import shutil
from pathlib import Path
from backend.scanner import scan_folder, normalize_name


def get_quarantine_dir(folder_a: str) -> Path:
    """Quarantine folder lives in the parent of A, outside Rekordbox's watch."""
    return Path(folder_a).parent / "RekordboxBounce"


def execute_sync(folder_a: str, folder_b: str, files_to_keep: list[str]) -> dict:
    """
    Execute the sync:
    1. Move files from A (not in B) to quarantine — unless in files_to_keep
    2. Move new files from B to A, renaming to match A's convention

    files_to_keep: filenames from delete_from_a the user chose to keep in A
    """
    files_a = scan_folder(folder_a)
    files_b = scan_folder(folder_b)
    quarantine = get_quarantine_dir(folder_a)

    # Rebuild match logic (same as comparator)
    from backend.comparator import compare_folders
    preview = compare_folders(folder_a, folder_b)
    to_quarantine = [f for f in preview["delete_from_a"] if f not in files_to_keep]
    to_move = preview["move_to_a"]
    rename_map = preview["rename_map"]

    quarantined = []
    moved = []
    errors = []

    # Step 1: Move unwanted A files to quarantine
    if to_quarantine:
        quarantine.mkdir(parents=True, exist_ok=True)

    for filename in to_quarantine:
        src = files_a[filename]
        dest = quarantine / filename
        # Avoid overwriting in quarantine
        if dest.exists():
            dest = quarantine / f"_{filename}"
        try:
            shutil.move(str(src), str(dest))
            quarantined.append(filename)
        except Exception as e:
            errors.append({"file": filename, "error": str(e)})

    # Step 2: Move new B files into A with renamed convention
    dest_dir = Path(folder_a)
    for b_filename in to_move:
        src = files_b[b_filename]
        target_name = rename_map.get(b_filename, b_filename)
        dest = dest_dir / target_name

        # Safety: never overwrite
        if dest.exists():
            errors.append({"file": b_filename, "error": f"Destination '{target_name}' already exists, skipped"})
            continue
        try:
            shutil.move(str(src), str(dest))
            moved.append({"original": b_filename, "renamed_to": target_name})
        except Exception as e:
            errors.append({"file": b_filename, "error": str(e)})

    return {
        "quarantined": quarantined,
        "quarantine_path": str(quarantine),
        "moved": moved,
        "errors": errors,
        "summary": {
            "quarantined_count": len(quarantined),
            "kept_count": len(files_to_keep),
            "moved_count": len(moved),
            "error_count": len(errors),
        },
    }
