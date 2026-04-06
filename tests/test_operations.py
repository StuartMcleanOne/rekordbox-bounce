import pytest
from pathlib import Path
from unittest.mock import patch
from backend.operations import execute_sync


def _touch(folder: Path, name: str) -> Path:
    f = folder / name
    f.write_bytes(b"")
    return f


def _mock_compare(a, b_list, delete=None, keep=None, per_folder=None):
    """Build a compare_folders_multi return value for testing."""
    delete = delete or []
    keep = keep or []
    per_folder = per_folder or []
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
            "counts": {"total_b": 1, "move_to_a": 1},
        }]
    )

    with patch("backend.comparator.compare_folders_multi", return_value=compare_result):
        result = execute_sync(str(a), [str(b)], files_to_keep=[])

    assert (a / "DJ Mix Vol1.mp3").exists()
    assert result["per_folder"][0]["moved"] == ["DJ Mix Vol1.mp3"]
