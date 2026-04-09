# QueueLess Smart Booking

QueueLess Smart Booking is a full-stack salon booking platform with live queue management, authenticated customer and owner flows, and an ML-powered wait-time prediction service.

## What It Includes

- Customer booking flow with salon discovery, checkout, and queue tracking.
- Salon owner/admin dashboard for managing staff, settings, and live queue state.
- Node.js + Express API with MongoDB persistence and Socket.IO updates.
- Python FastAPI microservice for wait-time prediction.

## Project Structure

- `backend/` - Express API, MongoDB models, auth, booking, salon, and staff routes.
- `frontend/` - React + Vite application for customers and salon owners.
- `ml-service/` - FastAPI service for ML-based wait-time prediction.

## Requirements

- Node.js 18 or newer
- npm
- Python 3.11 or newer
- MongoDB connection string

## Environment Variables

Create a root `.env` file in the project directory with the variables below:

```env
PORT=5001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:5173
EMAIL_USER=your_email_account
EMAIL_PASS=your_email_password
ML_SERVICE_URL=http://localhost:8000
```

The frontend currently talks to the backend at `http://localhost:5001/api`, and the Socket.IO client reads `VITE_API_URL` when present.

## Setup

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

The API starts on port `5001` by default.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on port `5173` by default.

### 3. ML Service

```bash
cd ml-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The ML service starts on port `8000` by default.

## Running the Full Stack

Open three terminals and run all services together:

```bash
# terminal 1
cd backend && npm run dev

# terminal 2
cd frontend && npm run dev

# terminal 3
cd ml-service && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Available Scripts

### Backend

- `npm run dev` - Start the API in watch mode.
- `npm run build` - Compile TypeScript.
- `npm start` - Run the compiled server.
- `npm run lint` - Lint the backend source.

### Frontend

- `npm run dev` - Start the Vite development server.
- `npm run build` - Build the production frontend.
- `npm run lint` - Lint the frontend source.

## API Overview

### Backend API

- `GET /` - Health check.
- `POST /api/auth/register` - Register a user.
- `POST /api/auth/login` - Log in a user.
- `GET /api/salons` - List salons.
- `GET /api/salons/:id` - Get a salon by id.
- `POST /api/salons` - Create a salon.
- `PATCH /api/salons/:id` - Update a salon.
- `POST /api/bookings` - Create a booking.
- `GET /api/bookings/my-bookings` - Get the signed-in user bookings.
- `GET /api/bookings/salon-bookings` - Get bookings for the owner salon.
- `PATCH /api/bookings/:id` - Update booking status.
- `POST /api/bookings/:id/rate` - Rate a booking.
- `GET /api/staff` - List staff members.
- `POST /api/staff` - Add staff.
- `PATCH /api/staff/:staffId/availability` - Update staff availability.
- `DELETE /api/staff/:staffId` - Remove staff.

### ML Service

- `GET /` - Service health check.
- `POST /predict` - Estimate wait time.
- `POST /train-init` - Trigger model training.

## Notes

- The backend reads `.env` from the project root.
- The ML service returns a confidence score alongside the estimated wait time.
- Build artifacts, local dependencies, and Python caches are ignored through `.gitignore`.
