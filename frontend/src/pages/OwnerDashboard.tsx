import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle, XCircle, Play, Clock, Edit2 } from 'lucide-react';
import { socket } from '../socket';

interface Booking {
    _id: string;
    userId: { name: string };
    services: { name: string; duration: number; price: number; guestName?: string }[];
    status: string;
    bookingTime: string;
    estimatedWaitTime: number;
    estimatedStartTime: string;
    contactInfo?: { phone: string; email: string };
    paymentStatus?: string;
    totalAmount?: number;
}

interface SalonData {
    salon: { name: string; _id: string };
    bookings: Booking[];
}

const OwnerDashboard = () => {
    const queryClient = useQueryClient();
    const [editingTime, setEditingTime] = useState<{ id: string, time: number } | null>(null);

    const { data, isLoading, error } = useQuery<SalonData>({
        queryKey: ['salon-bookings'],
        queryFn: async () => {
            const res = await api.get('/bookings/salon-bookings');
            return res.data;
        },
        refetchInterval: 30000 // Fallback polling every 30s
    });

    useEffect(() => {
        if (!data?.salon?._id) return;

        if (!socket.connected) {
            socket.connect();
        }

        socket.emit('join_salon', data.salon._id);

        const handleUpdate = (payload: any) => {
            console.log('Socket update received:', payload);
            queryClient.invalidateQueries({ queryKey: ['salon-bookings'] });

            // Optional: Show specific toast based on event
            if (payload?.type === 'STATUS_CHANGE') {
                // toast('Booking status updated', { icon: 'ℹ️' });
            } else if (payload?.userId) {
                toast.success('New booking received! 🔔');
            }
        };

        socket.on('new_booking', handleUpdate);
        socket.on('booking_updated', handleUpdate);

        return () => {
            socket.off('new_booking', handleUpdate);
            socket.off('booking_updated', handleUpdate);
            // Don't disconnect here if other components might use it, 
            // but for now this is the only one.
            socket.disconnect();
        };
    }, [data?.salon?._id, queryClient]);

    const updateBookingMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            await api.patch(`/bookings/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salon-bookings'] });
            toast.success('Booking updated');
            setEditingTime(null);
        },
        onError: () => {
            toast.error('Failed to update');
        }
    });

    if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" size={32} /></div>;

    if (error) {
        const errorMsg = (error as any).response?.data?.message || 'Failed to load dashboard';
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500">
                    <XCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard Unavailable</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-md">
                    {errorMsg === 'Salon not found for this user'
                        ? "We couldn't find a salon associated with your account."
                        : errorMsg}
                </p>
                {errorMsg === 'Salon not found for this user' && (
                    <button
                        onClick={() => {
                            localStorage.removeItem('token');
                            window.location.href = '/login';
                        }}
                        className="bg-primary text-white px-6 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors"
                    >
                        Log Out & Login Again
                    </button>
                )}
            </div>
        );
    }

    const handleStartBooking = (booking: Booking) => {
        const confirmedBookings = data?.bookings
            .filter(b => b.status === 'confirmed')
            .sort((a, b) => new Date(a.bookingTime).getTime() - new Date(b.bookingTime).getTime());

        const isFirst = confirmedBookings?.[0]?._id === booking._id;

        if (!isFirst) {
            if (!window.confirm("⚠️ Warning: You are starting a booking out of order.\n\nPlease ensure you manually update the wait times for other customers if this impacts the schedule.")) {
                return;
            }
        }
        updateBookingMutation.mutate({ id: booking._id, data: { status: 'in-progress' } });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{data?.salon.name} Dashboard</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage your active queue</p>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-bold text-primary">{data?.bookings.filter(b => b.status !== 'completed' && b.status !== 'cancelled').length}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Active Customers</div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200">Live Queue</div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {data?.bookings.length === 0 && <div className="p-8 text-center text-slate-500 dark:text-slate-400">Queue is empty</div>}

                    {data?.bookings.map((booking) => (
                        <div key={booking._id} className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors gap-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-2 h-12 rounded-full ${booking.status === 'in-progress' ? 'bg-green-500' :
                                    booking.status === 'confirmed' ? 'bg-blue-500' :
                                        booking.status === 'completed' ? 'bg-slate-300' : 'bg-red-300'
                                    }`} />
                                <div>
                                    <div className="font-bold text-slate-900 dark:text-white">
                                        {booking.services?.[0]?.guestName || booking.userId?.name || 'Guest'}
                                    </div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400">
                                        {booking.services && booking.services.length > 0
                                            ? booking.services.map(s => s.name).join(', ')
                                            : 'Service'}
                                    </div>
                                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-2">
                                        Booked at {new Date(booking.bookingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>

                                    {/* Customer Details */}
                                    <div className="text-xs bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-600 dark:text-slate-400">Contact:</span>
                                            <span className="text-slate-700 dark:text-slate-300 select-all">{booking.contactInfo?.phone || 'N/A'}</span>
                                            <span className="text-slate-300 dark:text-slate-600">|</span>
                                            <span className="text-slate-700 dark:text-slate-300 select-all">{booking.contactInfo?.email || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-600 dark:text-slate-400">Payment:</span>
                                            <span className={`capitalize font-medium ${booking.paymentStatus === 'paid' ? 'text-green-600 dark:text-green-400' : 'text-slate-500'}`}>
                                                {booking.paymentStatus || 'Pending'}
                                            </span>
                                            <span className="text-slate-300 dark:text-slate-600">|</span>
                                            <span className="font-bold text-slate-900 dark:text-white">${booking.totalAmount || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                {/* Wait Time Editor */}
                                <div className="text-right min-w-[120px]">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-end gap-1">
                                        <Clock size={12} /> Est. Wait
                                    </div>

                                    {editingTime?.id === booking._id ? (
                                        <div className="flex items-center justify-end gap-2">
                                            <input
                                                type="number"
                                                className="w-16 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600"
                                                value={editingTime.time}
                                                onChange={(e) => setEditingTime({ ...editingTime, time: Number(e.target.value) })}
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => updateBookingMutation.mutate({ id: booking._id, data: { estimatedWaitTime: editingTime.time } })}
                                                className="bg-green-500 text-white p-1 rounded hover:bg-green-600"
                                                title="Save"
                                            >
                                                <CheckCircle size={14} />
                                            </button>
                                            <button
                                                onClick={() => setEditingTime(null)}
                                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                                                title="Cancel"
                                            >
                                                <XCircle size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-end gap-2 group">
                                            <span className="font-bold text-slate-700 dark:text-slate-200">{booking.estimatedWaitTime} min</span>
                                            {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => setEditingTime({ id: booking._id, time: booking.estimatedWaitTime })}
                                                    className="text-slate-300 group-hover:text-primary transition-colors"
                                                    title="Edit Wait Time"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Status Actions */}
                                <div className="flex gap-2">
                                    {booking.status === 'confirmed' && (
                                        <button
                                            onClick={() => handleStartBooking(booking)}
                                            className="flex items-center gap-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
                                        >
                                            <Play size={14} /> Start
                                        </button>
                                    )}
                                    {booking.status === 'in-progress' && (
                                        <button
                                            onClick={() => updateBookingMutation.mutate({ id: booking._id, data: { status: 'completed' } })}
                                            className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            <CheckCircle size={14} /> Complete
                                        </button>
                                    )}
                                    {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                                        <button
                                            onClick={() => updateBookingMutation.mutate({ id: booking._id, data: { status: 'cancelled' } })}
                                            className="flex items-center gap-1 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <XCircle size={14} />
                                        </button>
                                    )}
                                    {booking.status === 'completed' && (
                                        <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-sm font-medium">Completed</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default OwnerDashboard;
