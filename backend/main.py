import os
import subprocess
import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.comparator import compare_folders_multi
from backend.operations import execute_sync, get_quarantine_dir, undo_sync, sort_sync, read_log_entries

app = FastAPI(title="Rekordbox Bounce API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PreviewRequest(BaseModel):
    folder_a: str
    folders_b: list[str]


class ExecuteRequest(BaseModel):
    folder_a: str
    folders_b: list[str]
    files_to_keep: list[str] = []
    mode: str = "bounce"


class UndoRequest(BaseModel):
    folder_a: str
    quarantine_path: str
    quarantined: list[str]
    per_folder: list[dict]


class SortRequest(BaseModel):
    folder_a: str
    folders_b: list[str]


@app.post("/api/preview")
def preview(req: PreviewRequest):
    """Dry-run: show exactly what will happen."""
    try:
        result = compare_folders_multi(req.folder_a, req.folders_b)
        result["quarantine_path"] = str(get_quarantine_dir(req.folder_a))
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/execute")
def execute(req: ExecuteRequest):
    """Execute the sync. Destructive — only call after user confirms preview."""
    try:
        return execute_sync(req.folder_a, req.folders_b, req.files_to_keep, req.mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/undo")
def undo(req: UndoRequest):
    """Reverse the last execute: restore quarantined files and move B files back."""
    try:
        return undo_sync(
            folder_a=req.folder_a,
            quarantine_path=req.quarantine_path,
            quarantined=req.quarantined,
            per_folder=req.per_folder,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pick-folder")
def pick_folder():
    """Open native OS folder picker and return the selected path."""
    try:
        import subprocess
        import sys
        # Run tkinter in a subprocess so it's always on the main thread (macOS requirement)
        result = subprocess.run(
            [sys.executable, "-c",
             "import tkinter as tk; from tkinter import filedialog; "
             "root = tk.Tk(); root.withdraw(); "
             "root.wm_attributes('-topmost', True); "
             "path = filedialog.askdirectory(title='Select folder'); "
             "root.destroy(); print(path)"],
            capture_output=True, text=True, timeout=60,
        )
        path = result.stdout.strip()
        normalized = path.replace("\\", "/") if path else ""
        return {"path": normalized}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not open folder picker: {e}")


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


@app.get("/api/open-path")
def open_path(path: str):
    """Open a file or folder in the native OS file manager / default app."""
    p = Path(path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", str(p)])
        elif sys.platform == "win32":
            os.startfile(str(p))
        else:
            subprocess.Popen(["xdg-open", str(p)])
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
def health():
    return {"status": "ok"}
