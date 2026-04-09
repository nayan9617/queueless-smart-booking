import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Menu, X, User as UserIcon } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import Logo from './common/Logo';

export const Header = () => {
    const { isAuthenticated, logout, user } = useAuthStore();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    // const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        window.location.href = '/';
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-md transition-colors duration-300 dark:border-slate-800">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Logo />

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-6">
                    {user?.role !== 'salon_owner' && (
                        <Link to="/salons" className="text-sm font-medium hover:text-primary transition-colors">
                            Find Salons
                        </Link>
                    )}
                    <ThemeToggle />
                    {isAuthenticated ? (
                        <div className="flex items-center gap-4">
                            <Link
                                to={!user ? '/login' : user?.role === 'salon_owner' ? '/owner-dashboard' : '/dashboard'}
                                className="text-sm font-medium hover:text-primary"
                            >
                                Dashboard
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="text-sm font-medium text-red-500 hover:text-red-600"
                            >
                                Logout
                            </button>
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <UserIcon size={18} />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <Link to="/login" className="text-sm font-medium hover:text-primary">
                                Log in
                            </Link>
                            <Link
                                to="/register"
                                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                                Sign up
                            </Link>
                        </div>
                    )}
                </nav>

                {/* Mobile Menu Toggle */}
                <button
                    className="md:hidden p-2"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                    {isMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Nav */}
            {isMenuOpen && (
                <div className="md:hidden border-t bg-white dark:bg-slate-900 p-4 dark:border-slate-800">
                    <nav className="flex flex-col gap-4">
                        {user?.role !== 'salon_owner' && (
                            <Link to="/salons" className="text-sm font-medium p-2 hover:bg-slate-50 rounded-md">
                                Find Salons
                            </Link>
                        )}
                        <div className="flex items-center justify-between p-2">
                            <span className="text-sm font-medium">Appearance</span>
                            <ThemeToggle />
                        </div>
                        {isAuthenticated ? (
                            <>
                                <Link to="/dashboard" className="text-sm font-medium p-2 hover:bg-slate-50 rounded-md">
                                    Dashboard
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="text-sm font-medium p-2 text-left text-red-500 hover:bg-red-50 rounded-md"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="text-sm font-medium p-2 hover:bg-slate-50 rounded-md">
                                    Log in
                                </Link>
                                <Link
                                    to="/register"
                                    className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium text-center hover:bg-primary/90"
                                >
                                    Sign up
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
};
