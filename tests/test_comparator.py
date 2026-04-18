import pytest
from pathlib import Path
from unittest.mock import patch
from backend.comparator import compare_folders, compare_folders_multi


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

    assert set(result.keys()) == {"delete_from_a", "keep_in_a", "move_to_a", "duplicate_b_files", "counts"}
    assert "Artist Track.mp3" in result["keep_in_a"]


def test_compare_folders_multi_single_b(tmp_path):
    a = tmp_path / "A"
    b = tmp_path / "B"
    a.mkdir(); b.mkdir()
    _touch(a, "shared.mp3")
    _touch(b, "shared.mp3")
    _touch(b, "new.mp3")

    with patch("backend.comparator.read_tags", return_value=None):
        result = compare_folders_multi(str(a), [str(b)])

    assert "shared.mp3" in result["global_keep_in_a"]
    assert "shared.mp3" not in result["global_delete_from_a"]
    assert result["per_folder"][0]["move_to_a"] == ["new.mp3"]


def test_compare_folders_multi_union_keeps_a_file(tmp_path):
    """A file in A matched by B2 should NOT be quarantined even if absent from B1."""
    a = tmp_path / "A"
    b1 = tmp_path / "B1"
    b2 = tmp_path / "B2"
    a.mkdir(); b1.mkdir(); b2.mkdir()
    _touch(a, "track.mp3")
    _touch(b1, "other.mp3")   # B1 has no match for track.mp3
    _touch(b2, "track.mp3")   # B2 matches track.mp3

    with patch("backend.comparator.read_tags", return_value=None):
        result = compare_folders_multi(str(a), [str(b1), str(b2)])

    assert "track.mp3" not in result["global_delete_from_a"]
    assert "track.mp3" in result["global_keep_in_a"]


def test_compare_folders_multi_response_keys(tmp_path):
    a = tmp_path / "A"; a.mkdir()
    b = tmp_path / "B"; b.mkdir()

    with patch("backend.comparator.read_tags", return_value=None):
        result = compare_folders_multi(str(a), [str(b)])

    assert set(result.keys()) == {
        "global_delete_from_a", "global_keep_in_a", "per_folder", "counts"
    }


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
