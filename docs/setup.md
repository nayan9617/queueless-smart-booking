# Setup Guide

1. Create a root `.env` file from `.env.example`.
2. Start MongoDB or point `MONGO_URI` at your hosted database.
3. Install backend dependencies and run `npm run dev` in `backend/`.
4. Install frontend dependencies and run `npm run dev` in `frontend/`.
5. Install Python dependencies and run `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` in `ml-service/`.

Use `VITE_API_URL` if the frontend needs to point at a remote backend.
