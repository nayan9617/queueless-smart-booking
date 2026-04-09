# Backend

Express + TypeScript API for QueueLess.

## Setup

```bash
npm install
npm run dev
```

## Environment

The backend reads the root `.env` file and uses:

- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_URL`
- `EMAIL_USER`
- `EMAIL_PASS`
- `ML_SERVICE_URL`

## Scripts

- `npm run dev` - Start the API in watch mode.
- `npm run build` - Compile TypeScript.
- `npm start` - Run the built server.
- `npm run lint` - Lint the backend source.
