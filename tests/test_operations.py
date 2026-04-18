import pytest
from pathlib import Path
from unittest.mock import patch
from backend.operations import execute_sync, sort_sync


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


def test_execute_creates_m3u_playlist(tmp_path):
    a = tmp_path / "A"
    b = tmp_path / "B"
    a.mkdir(); b.mkdir()
    _touch(b, "New Track.mp3")

    compare_result = _mock_compare(
        str(a), [str(b)],
        per_folder=[{
            "folder_b": str(b),
            "folder_b_name": "B",
            "move_to_a": ["New Track.mp3"],
            "counts": {"total_b": 1, "move_to_a": 1},
        }]
    )

    with patch("backend.comparator.compare_folders_multi", return_value=compare_result):
        result = execute_sync(str(a), [str(b)], files_to_keep=[])

    playlist_path = Path(result["per_folder"][0]["playlist_path"])
    assert playlist_path.exists()
    assert playlist_path.name == "B.m3u"
    assert playlist_path.parent == a
    content = playlist_path.read_text()
    assert "#EXTM3U" in content
    assert "New Track.mp3" in content


def test_execute_no_playlist_when_nothing_moved(tmp_path):
    a = tmp_path / "A"
    b = tmp_path / "B"
    a.mkdir(); b.mkdir()

    compare_result = _mock_compare(
        str(a), [str(b)],
        per_folder=[{
            "folder_b": str(b),
            "folder_b_name": "B",
            "move_to_a": [],
            "counts": {"total_b": 0, "move_to_a": 0},
        }]
    )

    with patch("backend.comparator.compare_folders_multi", return_value=compare_result):
        result = execute_sync(str(a), [str(b)], files_to_keep=[])

    assert result["per_folder"][0]["playlist_path"] is None


from backend.operations import undo_sync


def test_undo_restores_moved_files_to_b(tmp_path):
    a = tmp_path / "A"
    b = tmp_path / "B"
    a.mkdir(); b.mkdir()
    moved_file = a / "Track.mp3"
    moved_file.write_bytes(b"")

    result = undo_sync(
        folder_a=str(a),
        quarantine_path=str(tmp_path / "RekordboxBounce"),
        quarantined=[],
        per_folder=[{
            "folder_b": str(b),
            "moved": ["Track.mp3"],
            "playlist_path": None,
        }],
    )

    assert not moved_file.exists()
    assert (b / "Track.mp3").exists()
    assert result["restored_to_b_count"] == 1
    assert result["error_count"] == 0


def test_undo_restores_quarantined_files_to_a(tmp_path):
    a = tmp_path / "A"
    quarantine = tmp_path / "RekordboxBounce"
    a.mkdir(); quarantine.mkdir()
    q_file = quarantine / "Old Track.mp3"
    q_file.write_bytes(b"")

    result = undo_sync(
        folder_a=str(a),
        quarantine_path=str(quarantine),
        quarantined=["Old Track.mp3"],
        per_folder=[],
    )

    assert not q_file.exists()
    assert (a / "Old Track.mp3").exists()
    assert result["restored_to_a_count"] == 1


def test_undo_deletes_playlists(tmp_path):
    a = tmp_path / "A"
    a.mkdir()
    playlist = a / "B.m3u"
    playlist.write_text("#EXTM3U\n")

    undo_sync(
        folder_a=str(a),
        quarantine_path=str(tmp_path / "Q"),
        quarantined=[],
        per_folder=[{
            "folder_b": str(tmp_path / "B"),
            "moved": [],
            "playlist_path": str(playlist),
        }],
    )

    assert not playlist.exists()


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

    with patch("backend.operations._compare_multi", return_value=compare_result):
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

    with patch("backend.operations._compare_multi", return_value=compare_result):
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

    with patch("backend.operations._compare_multi", return_value=compare_result):
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

    with patch("backend.operations._compare_multi", return_value=compare_result):
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

    with patch("backend.operations._compare_multi", return_value=compare_result):
        result = sort_sync(str(a), [str(b)])

    assert result["per_folder"][0]["errors"][0]["file"] == "track.mp3"
    assert result["summary"]["error_count"] == 1


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
