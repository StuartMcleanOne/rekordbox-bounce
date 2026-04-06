from pathlib import Path
from backend.scanner import scan_folder, read_tags, normalize_name


def _tag_key(tags: dict) -> str:
    """Normalized artist+title key for tag-based matching."""
    return normalize_name(f"{tags['artist']} {tags['title']}")


def compare_folders(folder_a: str, folder_b: str) -> dict:
    """
    Compare two folders using ID3 tags (with filename fallback).

    Returns:
        delete_from_a   — in A but not in B (user no longer wants)
        keep_in_a       — matched between A and B (cue points safe)
        move_to_a       — new in B, not in A
        rename_map      — {b_filename: target_filename} for files moving to A
                          only differs from b_filename when a rename is needed
        counts          — summary numbers
    """
    files_a = scan_folder(folder_a)
    files_b = scan_folder(folder_b)

    # Build tag index for A: tag_key -> filename
    tags_a: dict[str, str] = {}
    for name, path in files_a.items():
        tags = read_tags(path)
        if tags:
            tags_a[_tag_key(tags)] = name

    # Build tag index for B: tag_key -> (filename, tags)
    tags_b: dict[str, tuple] = {}
    for name, path in files_b.items():
        tags = read_tags(path)
        if tags:
            tags_b[_tag_key(tags)] = (name, tags)

    matched_a: set[str] = set()
    matched_b: set[str] = set()

    # Tag-based matching
    for key, (b_name, _) in tags_b.items():
        if key in tags_a:
            matched_a.add(tags_a[key])
            matched_b.add(b_name)

    # Filename fallback for unmatched files
    unmatched_norm_a = {normalize_name(n): n for n in files_a if n not in matched_a}
    unmatched_norm_b = {normalize_name(n): n for n in files_b if n not in matched_b}
    for key in set(unmatched_norm_a) & set(unmatched_norm_b):
        matched_a.add(unmatched_norm_a[key])
        matched_b.add(unmatched_norm_b[key])

    delete_from_a = sorted(n for n in files_a if n not in matched_a)
    keep_in_a = sorted(matched_a)
    new_b_files = sorted(n for n in files_b if n not in matched_b)

    return {
        "delete_from_a": delete_from_a,
        "keep_in_a": keep_in_a,
        "move_to_a": new_b_files,
        "counts": {
            "delete_from_a": len(delete_from_a),
            "keep_in_a": len(matched_a),
            "move_to_a": len(new_b_files),
            "total_a": len(files_a),
            "total_b": len(files_b),
        },
    }


def compare_folders_multi(folder_a: str, folders_b: list[str]) -> dict:
    """Stub — implemented in Task 2."""
    raise NotImplementedError
