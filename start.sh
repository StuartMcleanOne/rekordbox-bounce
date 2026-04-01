#!/bin/bash
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000 &
cd frontend && npm run dev
