import { create } from 'zustand';

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: 'customer' | 'admin' | 'salon_owner';
    phone?: string;
    address?: string;
    city?: string;
    emailVerified?: boolean;
    location?: { lat: number; lng: number };
}

interface AuthState {
    user: AuthUser | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (user: AuthUser, token: string) => void;
    updateUser: (user: AuthUser) => void;
    logout: () => void;
}

const storedUser = (() => {
    try {
        const raw = localStorage.getItem('user');
        return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
        return null;
    }
})();

export const useAuthStore = create<AuthState>((set) => ({
    user: storedUser,
    token: localStorage.getItem('token'),
    isAuthenticated: !!localStorage.getItem('token'),
    login: (user, token) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ user, token, isAuthenticated: true });
    },
    updateUser: (user) => {
        localStorage.setItem('user', JSON.stringify(user));
        set({ user });
    },
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null, token: null, isAuthenticated: false });
    },
}));
