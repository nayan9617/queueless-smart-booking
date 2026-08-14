import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { LogOut, LayoutDashboard, Users, Loader2, Settings } from 'lucide-react';
import StaffManagement from '../staff/StaffManagement';
import OwnerDashboard from '../../../pages/OwnerDashboard';
import SalonOnboarding from '../onboarding/SalonOnboarding';
import SalonSettings from '../settings/SalonSettings';
import Logo from '../../../components/common/Logo';

const AdminDashboard = () => {
    const { logout, user } = useAuthStore();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'staff' | 'settings'>('dashboard');

    const { data: salonData, isLoading, error } = useQuery({
        queryKey: ['my-salon'],
        queryFn: async () => {
            const res = await api.get('/bookings/salon-bookings');
            return res.data;
        },
        retry: false,
    });

    const updateStatusMutation = useMutation({
        mutationFn: async (status: string) => {
            if (!salonData?.salon?._id) return;
            await api.patch(`/salons/${salonData.salon._id}`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-salon'] });
            toast.success('Salon status updated');
        },
    });

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={40} />
            </div>
        );
    }

    if (error && (error as any).response?.status === 404) {
        return <SalonOnboarding />;
    }

    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
            <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 dark:bg-slate-950 text-white p-6 z-50">
                <div className="mb-10">
                    <Logo className="text-xl font-bold text-white" iconClassName="text-primary" />
                </div>

                <nav className="space-y-2">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors 
                            ${activeTab === 'dashboard' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <LayoutDashboard size={20} /> Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('staff')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors 
                            ${activeTab === 'staff' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <Users size={20} /> Staff
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors 
                            ${activeTab === 'settings' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <Settings size={20} /> Settings
                    </button>
                </nav>

                <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex items-center gap-3 mb-6 p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold">
                            {user?.name?.charAt(0) || 'A'}
                        </div>
                        <div className="overflow-hidden">
                            <div className="text-sm font-medium truncate">{user?.name}</div>
                            <div className="text-xs text-slate-400 capitalize">{user?.role}</div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors font-medium border border-red-500/20 hover:border-red-500"
                    >
                        <LogOut size={18} /> Logout
                    </button>
                </div>
            </aside>

            <main className="ml-64 flex-1 p-8">
                <div className="max-w-7xl mx-auto space-y-8">
                    <header className="flex justify-between items-end border-b border-slate-200 dark:border-slate-700 pb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                                {activeTab === 'dashboard'
                                    ? 'Dashboard Overview'
                                    : activeTab === 'staff'
                                      ? 'Staff Management'
                                      : 'Salon Settings'}
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">
                                {activeTab === 'dashboard'
                                    ? 'Manage your salon, staff, and live queue.'
                                    : activeTab === 'staff'
                                      ? 'Manage your team availability and roles.'
                                      : 'Update salon details and services.'}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="text-sm text-slate-400">
                                {new Date().toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                })}
                            </div>

                            {salonData?.salon && (
                                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                                    <button
                                        onClick={() => updateStatusMutation.mutate('open')}
                                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                                            salonData.salon.status === 'open'
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        Open
                                    </button>
                                    <button
                                        onClick={() => updateStatusMutation.mutate('break')}
                                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                                            salonData.salon.status === 'break'
                                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        Break
                                    </button>
                                    <button
                                        onClick={() => updateStatusMutation.mutate('closed')}
                                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                                            salonData.salon.status === 'closed'
                                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        Closed
                                    </button>
                                </div>
                            )}
                        </div>
                    </header>

                    {/* Keep panels mounted so form drafts survive tab switches */}
                    <div className="grid grid-cols-1 gap-8">
                        <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                                <OwnerDashboard embedded />
                            </div>
                        </div>
                        <div className={activeTab === 'staff' ? 'block' : 'hidden'}>
                            <StaffManagement />
                        </div>
                        <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
                            <SalonSettings />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
