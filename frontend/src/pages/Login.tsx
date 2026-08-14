import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';
import { Loader2 } from 'lucide-react';
import Logo from '../components/common/Logo';
import GoogleAuthButton from '../components/GoogleAuthButton';
import toast from 'react-hot-toast';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const login = useAuthStore((state) => state.login);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [unverifiedEmail, setUnverifiedEmail] = useState('');

    const goAfterAuth = (role: string) => {
        const from = (location.state as any)?.from?.pathname as string | undefined;
        if (from && from !== '/login' && from !== '/register') {
            navigate(from, { replace: true });
            return;
        }
        navigate(role === 'salon_owner' ? '/admin/dashboard' : '/salons');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setUnverifiedEmail('');

        try {
            const res = await api.post('/auth/login', { email, password });
            login(res.data.user, res.data.token);
            goAfterAuth(res.data.user.role);
        } catch (err: any) {
            const message = err.response?.data?.message || 'Login failed';
            setError(message);
            if (err.response?.data?.requiresVerification) {
                setUnverifiedEmail(err.response.data.email || email);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const resendVerification = async () => {
        try {
            await api.post('/auth/resend-verification', { email: unverifiedEmail || email });
            toast.success('Verification email resent');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Could not resend email');
        }
    };

    return (
        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 space-y-6 border border-slate-100 dark:border-slate-700">
                <div className="flex justify-center mb-2">
                    <Logo />
                </div>
                <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white">Welcome Back</h2>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm space-y-2">
                        <p>{error}</p>
                        {unverifiedEmail && (
                            <button
                                type="button"
                                onClick={resendVerification}
                                className="text-primary font-medium hover:underline"
                            >
                                Resend verification email
                            </button>
                        )}
                    </div>
                )}

                <GoogleAuthButton
                    text="signin_with"
                    onSuccessNavigate={(user) => goAfterAuth(user.role)}
                />

                <div className="flex items-center gap-3 text-xs text-slate-400">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    or continue with email
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 flex justify-center items-center"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Login'}
                    </button>
                </form>

                <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                    Don&apos;t have an account?{' '}
                    <Link to="/register" className="text-primary hover:underline font-medium">
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
