import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import Logo from '../components/common/Logo';

const VerifyEmail = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const token = params.get('token');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
        token ? 'loading' : 'error'
    );
    const [message, setMessage] = useState(
        token ? 'Verifying your email…' : 'Missing verification token.'
    );
    const started = useRef(false);

    useEffect(() => {
        if (!token) return;
        if (started.current) return;
        started.current = true;

        (async () => {
            try {
                const res = await api.get('/auth/verify-email', {
                    params: { token },
                });
                login(res.data.user, res.data.token);
                setStatus('success');
                setMessage(
                    res.data.message === 'Email already verified'
                        ? 'Your email is already verified. Redirecting…'
                        : 'Email verified! Redirecting…'
                );
                setTimeout(() => {
                    navigate(res.data.user.role === 'salon_owner' ? '/admin/dashboard' : '/salons');
                }, 1000);
            } catch (err: unknown) {
                const msg =
                    err && typeof err === 'object' && 'response' in err
                        ? (err as { response?: { data?: { message?: string } } }).response?.data
                              ?.message
                        : undefined;
                setStatus('error');
                setMessage(msg || 'Verification failed');
            }
        })();
    }, [token, login, navigate]);

    return (
        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 space-y-5 border border-slate-100 dark:border-slate-700 text-center">
                <Logo />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Email verification</h2>
                {status === 'loading' && (
                    <div className="flex justify-center py-4">
                        <Loader2 className="animate-spin text-primary" size={28} />
                    </div>
                )}
                <p
                    className={`text-sm ${
                        status === 'error'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-600 dark:text-slate-400'
                    }`}
                >
                    {message}
                </p>
                {status === 'error' && (
                    <div className="space-y-2">
                        <Link to="/login" className="inline-block text-primary text-sm font-medium hover:underline">
                            Go to login
                        </Link>
                        <p className="text-xs text-slate-500">
                            You can resend a verification email from the login page if needed.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VerifyEmail;
