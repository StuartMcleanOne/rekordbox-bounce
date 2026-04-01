import re
from pathlib import Path
from mutagen import File as MutagenFile

AUDIO_EXTENSIONS = {".mp3", ".flac", ".wav", ".aiff", ".aif", ".m4a", ".ogg", ".opus"}

# Characters not allowed in filenames — replaced with _
_ILLEGAL_CHARS = re.compile(r'[\\/:*?"<>|]')
# Unicode chars that commonly cause issues on Windows
_UNICODE_REPLACE = re.compile(r'[^\x00-\x7F]')


def scan_folder(folder_path: str) -> dict[str, Path]:
    """Return {filename: full_path} for all audio files in folder."""
    folder = Path(folder_path)
    if not folder.exists() or not folder.is_dir():
        raise ValueError(f"Folder does not exist: {folder_path}")
    return {
        entry.name: entry
        for entry in folder.iterdir()
        if entry.is_file() and entry.suffix.lower() in AUDIO_EXTENSIONS
    }


def read_tags(path: Path) -> dict | None:
    """Read artist and title from audio file tags. Returns None if unreadable."""
    try:
        audio = MutagenFile(path, easy=True)
        if audio is None:
            return None
        artist_raw = (audio.get("artist") or audio.get("albumartist") or [None])[0]
        title = (audio.get("title") or [None])[0]
        if artist_raw and title:
            return {"artist": artist_raw.strip(), "title": title.strip()}
        return None
    except Exception:
        return None


def _sanitize(s: str, replace_unicode: bool = False) -> str:
    """Remove filesystem-illegal characters. Optionally replace non-ASCII with _."""
    s = _ILLEGAL_CHARS.sub("_", s).strip()
    if replace_unicode:
        s = _UNICODE_REPLACE.sub("_", s)
    return s


def build_filename(artist: str, title: str, ext: str, replace_unicode: bool = False) -> str:
    """
    Build a filename matching the Rekordbox convention:
        Artist1_Artist2 Title.ext

    Multiple artists (comma or semicolon separated in tags) are joined with _.
    A single space separates the artist block from the title.
    Special chars are sanitized; optionally non-ASCII replaced with _ for Windows.
    """
    # Split multiple artists and join with _
    artists = re.split(r"\s*[,;]\s*", artist)
    artist_block = "_".join(_sanitize(a, replace_unicode) for a in artists)
    title_clean = _sanitize(title, replace_unicode)
    return f"{artist_block} {title_clean}{ext}"


def normalize_name(name: str) -> str:
    """Lowercase + strip for comparison."""
    return name.strip().lower()
