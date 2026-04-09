# Troubleshooting

- If the backend cannot connect to MongoDB, verify `MONGO_URI` and that the database is reachable.
- If the frontend cannot reach the API, check `VITE_API_URL` and the backend port.
- If email sending fails, confirm `EMAIL_USER` and `EMAIL_PASS` are valid Gmail credentials.
- If wait-time prediction returns errors, make sure the ML service is running on port `8000`.
