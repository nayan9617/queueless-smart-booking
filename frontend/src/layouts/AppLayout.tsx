import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import Logo from '../components/common/Logo';

const AppLayout: React.FC = () => {
    const { pathname } = useLocation();
    const isHome = pathname === '/';

    return (
        <div className="min-h-screen flex flex-col transition-colors duration-300 overflow-x-hidden">
            <Header />
            <main className={isHome ? 'flex-1 min-w-0' : 'flex-1 min-w-0 container mx-auto px-4 sm:px-6 py-6 md:py-8'}>
                <Outlet />
            </main>
            <footer className="border-t py-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <div className="container mx-auto px-4 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
                    <Logo className="text-lg font-bold text-slate-600 dark:text-slate-300" iconSize={18} iconClassName="text-slate-400" to="#" />
                    &copy; {new Date().getFullYear()} QueueLess. All rights reserved.
                </div>
            </footer>
        </div>
    );
};

export default AppLayout;
