# Architecture

QueueLess is split into three services:

- `backend/` handles auth, salons, bookings, staff, and notifications.
- `frontend/` provides the React customer and owner experience.
- `ml-service/` estimates wait times through a FastAPI endpoint.

The backend talks to MongoDB and can call the ML service for wait-time predictions. The frontend talks to the backend API and Socket.IO server.
