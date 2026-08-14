import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import Salon from './models/Salon';
import Booking from './models/Booking';
import { bump } from './utils/betaCounters';
import { logger } from './utils/logger';

let io: Server;

export type SocketUser = { id: string; role: string };

const getTokenFromHandshake = (socket: Socket): string | null => {
    const auth = socket.handshake.auth as { token?: string } | undefined;
    if (auth?.token && typeof auth.token === 'string') return auth.token;

    const header = socket.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
        return header.slice(7);
    }

    const q = socket.handshake.query?.token;
    if (typeof q === 'string' && q.length > 0) return q;

    return null;
};

export const initSocket = (httpServer: HttpServer) => {
    const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

    io = new Server(httpServer, {
        cors: {
            origin: [clientOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    io.use((socket, next) => {
        try {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                return next(new Error('Server auth misconfigured'));
            }

            const token = getTokenFromHandshake(socket);
            if (!token) {
                bump('socketAuthFailed');
                logger.warn('socket_auth_failed', { reason: 'missing_token' });
                return next(new Error('Unauthorized'));
            }

            const decoded = jwt.verify(token, secret) as { id: string; role: string };
            if (!decoded?.id) {
                return next(new Error('Unauthorized'));
            }

            (socket.data as { user: SocketUser }).user = {
                id: String(decoded.id),
                role: decoded.role,
            };
            return next();
        } catch {
            bump('socketAuthFailed');
            logger.warn('socket_auth_failed', { reason: 'invalid_token' });
            return next(new Error('Unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        const user = (socket.data as { user?: SocketUser }).user;
        if (!user) {
            socket.disconnect(true);
            return;
        }

        // Always join the authenticated user's private room — never trust client userId
        const userRoom = `user:${user.id}`;
        socket.join(userRoom);
        console.log(`Socket ${socket.id} authenticated as ${user.id} (${user.role})`);

        socket.on('join_salon', async (salonId: string, ack?: (res: { ok: boolean; error?: string }) => void) => {
            const reply = (payload: { ok: boolean; error?: string }) => {
                if (typeof ack === 'function') ack(payload);
            };

            try {
                if (!salonId || typeof salonId !== 'string') {
                    reply({ ok: false, error: 'Invalid salonId' });
                    return;
                }

                const salon = await Salon.findById(salonId).select('ownerId');
                if (!salon) {
                    reply({ ok: false, error: 'Salon not found' });
                    return;
                }

                const isOwner =
                    (user.role === 'salon_owner' || user.role === 'admin') &&
                    String(salon.ownerId) === user.id;

                if (isOwner) {
                    socket.join(salonId);
                    reply({ ok: true });
                    return;
                }

                // Customers may join only if they have an active/recent booking at this salon
                const hasBooking = await Booking.exists({
                    salonId,
                    userId: user.id,
                    status: { $in: ['pending', 'confirmed', 'in-progress'] },
                });

                if (!hasBooking) {
                    reply({ ok: false, error: 'Forbidden' });
                    return;
                }

                socket.join(salonId);
                reply({ ok: true });
            } catch (err) {
                console.error('join_salon failed:', err);
                reply({ ok: false, error: 'Join failed' });
            }
        });

        // Reject legacy join_user — room is assigned from JWT only
        socket.on('join_user', (_userId: string, ack?: (res: { ok: boolean; error?: string }) => void) => {
            if (typeof ack === 'function') {
                ack({ ok: true, error: undefined });
            }
            // No-op: already in user:${authUser.id}
        });

        socket.on('disconnect', () => {
            console.log(`Socket ${socket.id} disconnected`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};
