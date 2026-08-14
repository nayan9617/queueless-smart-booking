import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
    Loader2,
    CheckCircle,
    XCircle,
    Play,
    Clock,
    Edit2,
    Phone,
    Mail,
    StickyNote,
    User,
    IndianRupee,
} from 'lucide-react';
import { format } from 'date-fns';
import { socket } from '../socket';

interface Booking {
    _id: string;
    userId?: { name?: string; phone?: string; email?: string };
    services: { name: string; duration: number; price: number; guestName?: string }[];
    status: string;
    bookingTime: string;
    estimatedWaitTime: number;
    estimatedStartTime?: string;
    contactInfo?: { phone?: string; email?: string; name?: string };
    paymentStatus?: string;
    paymentMethod?: string | null;
    totalAmount?: number;
    notes?: string;
}

interface SalonData {
    salon: { name: string; _id: string };
    bookings: Booking[];
}

const OwnerDashboard = ({ embedded = false }: { embedded?: boolean }) => {
    const queryClient = useQueryClient();
    const [editingTime, setEditingTime] = useState<{ id: string; time: number } | null>(null);

    const { data, isLoading, error } = useQuery<SalonData>({
        queryKey: ['salon-bookings'],
        queryFn: async () => {
            const res = await api.get('/bookings/salon-bookings');
            return res.data;
        },
        refetchInterval: 30000,
    });

    const { data: analytics } = useQuery({
        queryKey: ['salon-analytics'],
        queryFn: async () => {
            const res = await api.get('/bookings/salon-analytics');
            return res.data;
        },
        refetchInterval: 60000,
    });

    useEffect(() => {
        if (!data?.salon?._id) return;

        if (!socket.connected) socket.connect();
        socket.emit('join_salon', data.salon._id);

        const handleUpdate = (payload: any) => {
            queryClient.invalidateQueries({ queryKey: ['salon-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['my-salon'] });
            if (payload?.type !== 'STATUS_CHANGE' && payload?.type !== 'CANCELLED') {
                toast.success('Queue updated');
            }
        };

        socket.on('new_booking', handleUpdate);
        socket.on('booking_updated', handleUpdate);

        return () => {
            socket.off('new_booking', handleUpdate);
            socket.off('booking_updated', handleUpdate);
        };
    }, [data?.salon?._id, queryClient]);

    const updateBookingMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            await api.patch(`/bookings/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salon-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['salon-analytics'] });
            queryClient.invalidateQueries({ queryKey: ['my-salon'] });
            toast.success('Booking updated');
            setEditingTime(null);
        },
        onError: () => toast.error('Failed to update'),
    });

    const liveBookings = useMemo(() => {
        const list = data?.bookings || [];
        return list.filter(
            (b) =>
                ['confirmed', 'in-progress'].includes(b.status) ||
                (b.status === 'pending' && b.paymentStatus === 'paid')
        );
    }, [data?.bookings]);

    const recentBookings = useMemo(() => {
        const list = data?.bookings || [];
        return list.filter((b) => ['completed', 'cancelled'].includes(b.status));
    }, [data?.bookings]);

    if (isLoading) {
        return (
            <div className="flex justify-center p-20">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    if (error) {
        const errorMsg = (error as any).response?.data?.message || 'Failed to load dashboard';
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500">
                    <XCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard Unavailable</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-md">{errorMsg}</p>
            </div>
        );
    }

    const handleStartBooking = (booking: Booking) => {
        const confirmedBookings = liveBookings
            .filter((b) => b.status === 'confirmed')
            .sort((a, b) => new Date(a.bookingTime).getTime() - new Date(b.bookingTime).getTime());

        const isFirst = confirmedBookings?.[0]?._id === booking._id;
        if (!isFirst) {
            if (
                !window.confirm(
                    'You are starting a booking out of order. Update wait times for other customers if needed.'
                )
            ) {
                return;
            }
        }
        updateBookingMutation.mutate({ id: booking._id, data: { status: 'in-progress' } });
    };

    const renderBookingCard = (booking: Booking) => {
        const displayName =
            booking.contactInfo?.name ||
            booking.services?.[0]?.guestName ||
            booking.userId?.name ||
            'Guest';
        const phone = booking.contactInfo?.phone || booking.userId?.phone || 'N/A';
        const email = booking.contactInfo?.email || booking.userId?.email || 'N/A';
        const totalDuration = booking.services?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;

        return (
            <div
                key={booking._id}
                className="p-4 md:p-5 flex flex-col xl:flex-row xl:items-start justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors gap-4"
            >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div
                        className={`w-2 self-stretch min-h-12 rounded-full shrink-0 ${
                            booking.status === 'in-progress'
                                ? 'bg-green-500'
                                : booking.status === 'confirmed'
                                  ? 'bg-blue-500'
                                  : booking.status === 'completed'
                                    ? 'bg-slate-300'
                                    : 'bg-red-300'
                        }`}
                    />
                    <div className="space-y-3 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900 dark:text-white text-lg">{displayName}</h3>
                            <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                                {booking.status}
                            </span>
                            <span
                                className={`text-xs uppercase font-semibold px-2 py-0.5 rounded-md ${
                                    booking.paymentStatus === 'paid'
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                }`}
                            >
                                {booking.paymentStatus || 'pending'}
                                {booking.paymentMethod ? ` · ${booking.paymentMethod}` : ''}
                            </span>
                        </div>

                        <div className="space-y-1.5">
                            {booking.services?.map((service, idx) => (
                                <div
                                    key={`${service.name}-${idx}`}
                                    className="text-sm text-slate-700 dark:text-slate-300 flex flex-wrap gap-x-3 gap-y-1"
                                >
                                    <span className="font-medium">{service.name}</span>
                                    <span className="text-slate-400">
                                        {service.duration} min · ₹{service.price}
                                    </span>
                                    {service.guestName && (
                                        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                            <User size={12} /> {service.guestName}
                                        </span>
                                    )}
                                </div>
                            ))}
                            <p className="text-xs text-slate-400">
                                Total {totalDuration} min · Booked{' '}
                                {format(new Date(booking.bookingTime), 'MMM d, h:mm a')}
                                {booking.estimatedStartTime
                                    ? ` · Est. start ${format(new Date(booking.estimatedStartTime), 'h:mm a')}`
                                    : ''}
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3 space-y-2 text-sm">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300">
                                <span className="inline-flex items-center gap-1.5">
                                    <Phone size={14} className="text-slate-400" />
                                    <span className="select-all font-medium">{phone}</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5 min-w-0">
                                    <Mail size={14} className="text-slate-400 shrink-0" />
                                    <span className="select-all truncate">{email}</span>
                                </span>
                                <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                                    <IndianRupee size={14} />
                                    {booking.totalAmount || 0}
                                </span>
                            </div>
                            {booking.notes ? (
                                <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
                                    <StickyNote size={14} className="mt-0.5 text-slate-400 shrink-0" />
                                    <span>{booking.notes}</span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 xl:gap-6 shrink-0">
                    <div className="text-right min-w-[110px]">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-end gap-1">
                            <Clock size={12} /> Est. Wait
                        </div>
                        {editingTime?.id === booking._id ? (
                            <div className="flex items-center justify-end gap-2">
                                <input
                                    type="number"
                                    className="w-16 px-2 py-1 border rounded text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600"
                                    value={editingTime.time}
                                    onChange={(e) =>
                                        setEditingTime({ ...editingTime, time: Number(e.target.value) })
                                    }
                                    autoFocus
                                />
                                <button
                                    onClick={() =>
                                        updateBookingMutation.mutate({
                                            id: booking._id,
                                            data: { estimatedWaitTime: editingTime.time },
                                        })
                                    }
                                    className="bg-green-500 text-white p-1 rounded hover:bg-green-600"
                                >
                                    <CheckCircle size={14} />
                                </button>
                                <button onClick={() => setEditingTime(null)} className="text-slate-400 p-1">
                                    <XCircle size={14} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-end gap-2 group">
                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                    {booking.estimatedWaitTime} min
                                </span>
                                {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                                    <button
                                        onClick={() =>
                                            setEditingTime({
                                                id: booking._id,
                                                time: booking.estimatedWaitTime,
                                            })
                                        }
                                        className="text-slate-300 group-hover:text-primary"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {booking.status === 'confirmed' && (
                            <>
                                <button
                                    onClick={() => handleStartBooking(booking)}
                                    className="flex items-center gap-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/30"
                                >
                                    <Play size={14} /> Start
                                </button>
                                <button
                                    onClick={() =>
                                        updateBookingMutation.mutate({
                                            id: booking._id,
                                            data: { status: 'no-show' },
                                        })
                                    }
                                    className="flex items-center gap-1 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 px-3 py-1.5 rounded-lg text-sm font-medium"
                                    title="Mark as no-show"
                                >
                                    No-show
                                </button>
                            </>
                        )}
                        {booking.status === 'in-progress' && (
                            <button
                                onClick={() =>
                                    updateBookingMutation.mutate({
                                        id: booking._id,
                                        data: { status: 'completed' },
                                    })
                                }
                                className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium"
                            >
                                <CheckCircle size={14} /> Complete
                            </button>
                        )}
                        {booking.status !== 'completed' &&
                            booking.status !== 'cancelled' &&
                            booking.status !== 'no-show' && (
                            <button
                                onClick={() =>
                                    updateBookingMutation.mutate({
                                        id: booking._id,
                                        data: { status: 'cancelled' },
                                    })
                                }
                                className="flex items-center gap-1 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                                <XCircle size={14} />
                            </button>
                        )}
                        {(booking.status === 'completed' || booking.status === 'no-show') && (
                            <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-lg text-sm font-medium">
                                {booking.status === 'no-show' ? 'No-show' : 'Done'}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {!embedded && (
                <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {data?.salon.name} Dashboard
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">Live queue with full customer details</p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold text-primary">{liveBookings.length}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">
                            In queue
                        </div>
                    </div>
                </div>
            )}

            {embedded && (
                <div className="flex justify-end">
                    <div className="text-right">
                        <div className="text-2xl font-bold text-primary">{liveBookings.length}</div>
                        <div className="text-xs text-slate-500 uppercase font-bold">In queue</div>
                    </div>
                </div>
            )}

            {analytics?.totals && (
                <div
                    data-testid="owner-analytics"
                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
                >
                    {[
                        ['Today', analytics.totals.bookings],
                        ['Done', analytics.totals.completed],
                        ['Cancelled', analytics.totals.cancelled],
                        ['No-show', analytics.totals.noShow],
                        ['Avg wait', `${analytics.averages?.estimatedWaitMinutes ?? 0}m`],
                        ['Avg svc', `${analytics.averages?.completedServiceDurationMinutes ?? 0}m`],
                    ].map(([label, value]) => (
                        <div
                            key={String(label)}
                            className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-center"
                        >
                            <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
                            <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-b dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200">
                    Live Queue
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {liveBookings.length === 0 && (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                            Queue is empty — paid bookings will appear here.
                        </div>
                    )}
                    {liveBookings.map(renderBookingCard)}
                </div>
            </div>

            {recentBookings.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-b dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200">
                        Recent (last 24h)
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {recentBookings.map(renderBookingCard)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OwnerDashboard;
