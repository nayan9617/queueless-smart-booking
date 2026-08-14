import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

interface ProtectedRouteProps {
    children?: React.ReactNode;
    /** If set, only these roles may proceed */
    roles?: Array<'customer' | 'admin' | 'salon_owner'>;
}

const ProtectedRoute = ({ children, roles }: ProtectedRouteProps) => {
    const { isAuthenticated, user } = useAuthStore();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (roles && user && !roles.includes(user.role)) {
        const fallback = user.role === 'salon_owner' ? '/admin/dashboard' : '/dashboard';
        return <Navigate to={fallback} replace />;
    }

    return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
