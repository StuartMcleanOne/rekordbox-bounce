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
