import { io, Socket } from 'socket.io-client';

const raw = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const URL = String(raw).replace(/\/api\/?$/, '');

let singleton: Socket | null = null;

/** Authenticated singleton — reconnects with current JWT from localStorage. */
export const getSocket = (): Socket => {
    const token = localStorage.getItem('token') || '';

    if (!singleton) {
        singleton = io(URL, {
            autoConnect: false,
            transports: ['websocket', 'polling'],
            auth: { token },
        });
    } else {
        singleton.auth = { token };
    }

    return singleton;
};

/** Facade used by Dashboard / OwnerDashboard — auth comes from JWT on connect. */
export const socket = {
    get connected() {
        return getSocket().connected;
    },
    connect() {
        const s = getSocket();
        s.auth = { token: localStorage.getItem('token') || '' };
        if (!s.connected) s.connect();
        return s;
    },
    disconnect() {
        getSocket().disconnect();
    },
    emit(...args: Parameters<Socket['emit']>) {
        return getSocket().emit(...args);
    },
    on(...args: Parameters<Socket['on']>) {
        return getSocket().on(...args);
    },
    off(...args: Parameters<Socket['off']>) {
        return getSocket().off(...args);
    },
};
