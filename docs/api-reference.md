# API Reference

## Backend

- `GET /` - Health check.
- `POST /api/auth/register` - Register a user.
- `POST /api/auth/login` - Log a user in.
- `GET /api/salons` - List salons.
- `GET /api/salons/:id` - Fetch a salon.
- `POST /api/bookings` - Create a booking.
- `GET /api/bookings/my-bookings` - Get the current user's bookings.
- `GET /api/bookings/salon-bookings` - Get owner salon bookings.
- `PATCH /api/bookings/:id` - Update booking status.
- `POST /api/bookings/:id/rate` - Rate a completed booking.

## ML Service

- `GET /` - Health check.
- `POST /predict` - Predict queue wait time.
- `POST /train-init` - Trigger model training.
