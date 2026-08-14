import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuthStore, type AuthUser } from '../store/useAuthStore';

interface GoogleAuthButtonProps {
    role?: 'customer' | 'salon_owner';
    onSuccessNavigate: (user: AuthUser) => void;
    text?: 'signin_with' | 'signup_with' | 'continue_with';
}

const GoogleAuthButton = ({ role = 'customer', onSuccessNavigate, text = 'continue_with' }: GoogleAuthButtonProps) => {
    const login = useAuthStore((state) => state.login);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
        return (
            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                Google sign-in is unavailable until <code className="text-[11px]">VITE_GOOGLE_CLIENT_ID</code> is set.
            </p>
        );
    }

    const handleSuccess = async (response: CredentialResponse) => {
        if (!response.credential) {
            toast.error('Google sign-in failed');
            return;
        }

        try {
            const res = await api.post('/auth/google', {
                credential: response.credential,
                role,
            });
            login(res.data.user, res.data.token);
            toast.success('Signed in with Google');
            onSuccessNavigate(res.data.user);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Google sign-in failed');
        }
    };

    return (
        <div className="flex justify-center w-full [&>div]:w-full [&>div>div]:w-full">
            <GoogleLogin
                onSuccess={handleSuccess}
                onError={() => toast.error('Google sign-in was cancelled')}
                theme="outline"
                size="large"
                text={text}
                shape="rectangular"
                width="100%"
            />
        </div>
    );
};

export default GoogleAuthButton;
