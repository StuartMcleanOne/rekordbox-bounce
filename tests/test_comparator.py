import pytest
from pathlib import Path
from unittest.mock import patch
from backend.comparator import compare_folders


def _touch(folder: Path, name: str) -> Path:
    f = folder / name
    f.write_bytes(b"")
    return f


def test_compare_folders_no_rename_map(tmp_path):
    a = tmp_path / "A"
    b = tmp_path / "B"
    a.mkdir(); b.mkdir()
    _touch(a, "existing.mp3")
    _touch(b, "new track.mp3")

    with patch("backend.comparator.read_tags", return_value=None):
        result = compare_folders(str(a), str(b))

    assert "rename_map" not in result


def test_compare_folders_returns_expected_keys(tmp_path):
    a = tmp_path / "A"
    b = tmp_path / "B"
    a.mkdir(); b.mkdir()
    _touch(a, "Artist Track.mp3")
    _touch(b, "Artist Track.mp3")

    with patch("backend.comparator.read_tags", return_value=None):
        result = compare_folders(str(a), str(b))

    assert set(result.keys()) == {"delete_from_a", "keep_in_a", "move_to_a", "counts"}
    assert "Artist Track.mp3" in result["keep_in_a"]
