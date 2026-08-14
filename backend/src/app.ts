import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { initSocket } from './socket';
import connectDB from './config';
import dotenv from 'dotenv';
import path from 'path';
import { startPendingBookingExpiryJob } from './services/pendingExpiryService';
import { requestIdMiddleware } from './middlewares/requestIdMiddleware';
import { logger } from './utils/logger';
import { warnUnsafeEnvFlags } from './utils/envSafety';
import { allowedOrigins } from './utils/allowedOrigins';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app: Express = express();
app.disable('etag'); // Force 200 OK responses to prevent stale cache
const httpServer = createServer(app);
const io = initSocket(httpServer);

const isVercel = Boolean(process.env.VERCEL);

// Middleware
app.use(requestIdMiddleware);
app.use(async (_req: Request, _res: Response, next: NextFunction) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        next(err);
    }
});
app.use(express.json({ limit: '2mb' }));
app.use(
    cors({
        origin: allowedOrigins(),
        credentials: true,
    })
);
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
);
app.use(
    morgan(':method :url :status :response-time ms rid=:req[x-request-id]', {
        skip: (req) => req.path === '/',
    })
);

// Uploaded salon photos (device uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Basic Routes
app.get('/', (_req: Request, res: Response) => {
    res.json({ message: 'QueueLess API is running 🚀' });
});

import authRoutes from './routes/authRoutes';
import salonRoutes from './routes/salonRoutes';
import bookingRoutes from './routes/bookingRoutes';
import staffRoutes from './routes/staffRoutes';
import opsRoutes from './routes/opsRoutes';
import { getHealth } from './controllers/opsController';

app.use('/api/auth', authRoutes);
app.use('/api/salons', salonRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/ops', opsRoutes);
app.get('/health', getHealth);

// Error Handling Middleware — never leak stacks to clients
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled request error', {
        requestId: (req as Request & { requestId?: string }).requestId,
        message: err.message,
    });
    res.status(500).json({
        message: 'Something went wrong',
        requestId: (req as Request & { requestId?: string }).requestId,
    });
});

const PORT = process.env.PORT || 5001;

const startServer = async () => {
    warnUnsafeEnvFlags();
    await connectDB();
    if (!isVercel) {
        startPendingBookingExpiryJob();
    }
    if (!isVercel) {
        httpServer.listen(PORT, () => {
            logger.info('server_started', { port: Number(PORT) });
        });
    } else {
        logger.info('vercel_function_ready');
    }
};

void startServer();

export default httpServer;
export { app, io };
