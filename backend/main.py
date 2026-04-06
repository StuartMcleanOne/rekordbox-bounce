from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.comparator import compare_folders
from backend.operations import execute_sync, get_quarantine_dir, undo_sync

app = FastAPI(title="Rekordbox Bounce API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PreviewRequest(BaseModel):
    folder_a: str
    folder_b: str


class ExecuteRequest(BaseModel):
    folder_a: str
    folder_b: str
    files_to_keep: list[str] = []


class UndoRequest(BaseModel):
    folder_a: str
    quarantine_path: str
    quarantined: list[str]
    per_folder: list[dict]


@app.post("/api/preview")
def preview(req: PreviewRequest):
    """Dry-run: show exactly what will happen."""
    try:
        result = compare_folders(req.folder_a, req.folder_b)
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
        return execute_sync(req.folder_a, req.folder_b, req.files_to_keep)
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
        import tkinter as tk
        from tkinter import filedialog
        import sys
        root = tk.Tk()
        root.withdraw()
        try:
            root.wm_attributes('-topmost', True)
        except Exception:
            pass  # Not fatal if topmost fails on some platforms
        path = filedialog.askdirectory(title="Select folder")
        root.destroy()
        # Normalise to forward slashes for consistency in the UI
        normalized = path.replace("\\", "/") if path else ""
        return {"path": normalized}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not open folder picker: {e}")


@app.get("/api/health")
def health():
    return {"status": "ok"}
