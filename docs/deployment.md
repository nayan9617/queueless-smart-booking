# Deployment

Before deploying:

- Set production values for `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, and `ML_SERVICE_URL`.
- Build the backend and frontend.
- Run the ML service with a production ASGI server.
- Ensure email credentials are valid for outbound notifications.

The backend and frontend can be deployed independently, but both should point to the same MongoDB and auth settings.
