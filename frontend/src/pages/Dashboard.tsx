import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Calendar,
    Clock,
    MapPin,
    Loader2,
    CheckCircle,
    User,
    Phone,
    Mail,
    Home,
    XCircle,
    IndianRupee,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../services/api';
import RatingModal from '../components/RatingModal';
import { useAuthStore } from '../store/useAuthStore';
import { socket } from '../socket';

interface BookingService {
    name: string;
    price: number;
    duration: number;
    guestName?: string;
}

interface Booking {
    _id: string;
    salonId: {
        _id?: string;
        name: string;
        address: string;
    } | null;
    services: BookingService[];
    status: string;
    paymentStatus: string;
    totalAmount: number;
    bookingTime: string;
    estimatedStartTime?: string;
    estimatedWaitTime?: number;
    actualEndTime?: string;
    isRated?: boolean;
    customerRating?: number;
    contactInfo?: {
        phone?: string;
        email?: string;
        name?: string;
    };
    notes?: string;
}

type Tab = 'bookings' | 'profile';

const statusClass = (status: string) => {
    switch (status) {
        case 'completed':
            return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
        case 'cancelled':
            return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
        case 'no-show':
            return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
        case 'pending':
            return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
        case 'in-progress':
            return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
        default:
            return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    }
};

const Dashboard = () => {
    const queryClient = useQueryClient();
    const { user, updateUser } = useAuthStore();
    const [tab, setTab] = useState<Tab>('bookings');
    const [filter, setFilter] = useState<'all' | 'active' | 'past'>('all');
    const [ratingModalOpen, setRatingModalOpen] = useState(false);
    const [bookingToRate, setBookingToRate] = useState<Booking | null>(null);
    const [dismissedRatingIds, setDismissedRatingIds] = useState<string[]>(() => {
        try {
            return JSON.parse(sessionStorage.getItem('queueless_rating_dismissed') || '[]');
        } catch {
            return [];
        }
    });
    const [autoPromptDone, setAutoPromptDone] = useState(false);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        address: user?.address || '',
        city: user?.city || '',
    });

    const { data: bookings, isLoading, error } = useQuery<Booking[]>({
        queryKey: ['my-bookings'],
        queryFn: async () => {
            const res = await api.get('/bookings/my-bookings', { params: { page: 1, limit: 50 } });
            const body = res.data;
            return Array.isArray(body) ? body : body.data || [];
        },
    });

    useEffect(() => {
        api.get('/auth/me')
            .then((res) => {
                updateUser(res.data.user);
                setProfileForm({
                    name: res.data.user.name || '',
                    phone: res.data.user.phone || '',
                    address: res.data.user.address || '',
                    city: res.data.user.city || '',
                });
            })
            .catch(() => undefined);
    }, [updateUser]);

    // Live queue ETA / status for the signed-in customer
    useEffect(() => {
        if (!user?.id) return;

        if (!socket.connected) socket.connect();
        // Private user room is assigned server-side from JWT — do not send userId

        const salonIds = new Set(
            (bookings || [])
                .filter((b) => ['pending', 'confirmed', 'in-progress'].includes(b.status))
                .map((b) =>
                    typeof b.salonId === 'object' && b.salonId && '_id' in (b.salonId as any)
                        ? String((b.salonId as any)._id)
                        : null
                )
                .filter(Boolean) as string[]
        );
        salonIds.forEach((id) => socket.emit('join_salon', id));

        const onUpdate = (payload: any) => {
            queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
            if (payload?.type === 'ESTIMATE_UPDATE') {
                toast('Your wait estimate was updated', { icon: '⏱️' });
            } else if (payload?.type === 'STATUS_CHANGE') {
                toast('Your booking status changed', { icon: '✂️' });
            }
        };

        socket.on('booking_updated', onUpdate);
        return () => {
            socket.off('booking_updated', onUpdate);
        };
    }, [user?.id, bookings, queryClient]);

    useEffect(() => {
        // Auto-prompt at most once per visit — closing must not chain into the next booking
        if (!bookings || ratingModalOpen || autoPromptDone) return;

        const dismissed = new Set(dismissedRatingIds);
        const unratedBooking = bookings.find(
            (b) =>
                b.status === 'completed' &&
                !b.isRated &&
                !dismissed.has(b._id) &&
                typeof b.salonId === 'object' &&
                !!b.salonId?.name
        );

        if (unratedBooking) {
            setBookingToRate(unratedBooking);
            setRatingModalOpen(true);
        }
        setAutoPromptDone(true);
    }, [bookings, ratingModalOpen, autoPromptDone, dismissedRatingIds]);

    const dismissRatingPrompt = (bookingId: string) => {
        setDismissedRatingIds((prev) => {
            const next = prev.includes(bookingId) ? prev : [...prev, bookingId];
            sessionStorage.setItem('queueless_rating_dismissed', JSON.stringify(next));
            return next;
        });
        setRatingModalOpen(false);
        setBookingToRate(null);
        setAutoPromptDone(true);
    };

    const filteredBookings = useMemo(() => {
        if (!bookings) return [];
        if (filter === 'active') {
            return bookings.filter((b) => ['pending', 'confirmed', 'in-progress'].includes(b.status));
        }
        if (filter === 'past') {
            return bookings.filter((b) => ['completed', 'cancelled'].includes(b.status));
        }
        return bookings;
    }, [bookings, filter]);

    const stats = useMemo(() => {
        const list = bookings || [];
        return {
            total: list.length,
            active: list.filter((b) => ['pending', 'confirmed', 'in-progress'].includes(b.status)).length,
            completed: list.filter((b) => b.status === 'completed').length,
        };
    }, [bookings]);

    const handleCancel = async (bookingId: string) => {
        if (!confirm('Cancel this appointment?')) return;
        setCancellingId(bookingId);
        try {
            await api.post(`/bookings/${bookingId}/cancel`);
            toast.success('Booking cancelled');
            queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Could not cancel booking');
        } finally {
            setCancellingId(null);
        }
    };

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            const res = await api.patch('/auth/me', profileForm);
            updateUser(res.data.user);
            toast.success('Profile updated');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Could not update profile');
        } finally {
            setSavingProfile(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    if (error) {
        return <div className="text-center py-20 text-red-500">Error loading your dashboard.</div>;
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Account</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        Profile, appointments, and payment status in one place.
                    </p>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start">
                    <button
                        onClick={() => setTab('bookings')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            tab === 'bookings'
                                ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                                : 'text-slate-500'
                        }`}
                    >
                        Bookings
                    </button>
                    <button
                        onClick={() => setTab('profile')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            tab === 'profile'
                                ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                                : 'text-slate-500'
                        }`}
                    >
                        Profile
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3 md:gap-4">
                {[
                    { label: 'Total', value: stats.total },
                    { label: 'Active', value: stats.active },
                    { label: 'Completed', value: stats.completed },
                ].map((item) => (
                    <div
                        key={item.label}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
                    >
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{item.value}</p>
                    </div>
                ))}
            </div>

            {tab === 'bookings' ? (
                <div className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                        {(['all', 'active', 'past'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                                    filter === f
                                        ? 'bg-primary text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    {filteredBookings.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-100 dark:border-slate-700 text-center space-y-4">
                            <p className="text-slate-500 dark:text-slate-400">
                                No bookings here yet. Find a salon and book your next visit.
                            </p>
                            <a
                                href="/salons"
                                className="inline-flex bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-600"
                            >
                                Browse salons
                            </a>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredBookings.map((booking) => {
                                const serviceLabel = booking.services
                                    ?.map((s) => s.name)
                                    .join(', ');
                                return (
                                    <div
                                        key={booking._id}
                                        className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col lg:flex-row justify-between gap-5"
                                    >
                                        <div className="space-y-2 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                                    {booking.salonId?.name || 'Salon'}
                                                </h3>
                                                <span
                                                    className={`px-2 py-1 text-xs font-semibold rounded-md uppercase ${statusClass(
                                                        booking.status
                                                    )}`}
                                                >
                                                    {booking.status}
                                                </span>
                                                <span className="px-2 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 uppercase">
                                                    {booking.paymentStatus}
                                                </span>
                                            </div>
                                            <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm">
                                                <MapPin size={14} className="mr-1" />
                                                {booking.salonId?.address}
                                            </div>
                                            <p className="text-slate-700 dark:text-slate-300 font-medium">
                                                {serviceLabel || 'Service'}
                                            </p>
                                            {booking.services?.some((s) => s.guestName) && (
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    Guests:{' '}
                                                    {booking.services
                                                        .map((s) => s.guestName)
                                                        .filter(Boolean)
                                                        .join(', ')}
                                                </p>
                                            )}
                                            {booking.notes ? (
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    Note: {booking.notes}
                                                </p>
                                            ) : null}
                                            <p className="text-sm text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                                                <IndianRupee size={14} />
                                                {booking.totalAmount}
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-3 min-w-[220px]">
                                            {booking.status === 'completed' && booking.actualEndTime ? (
                                                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-900/30">
                                                    <div className="text-xs text-green-600 dark:text-green-400 mb-1 flex items-center">
                                                        <CheckCircle size={12} className="mr-1" /> Completed At
                                                    </div>
                                                    <div className="text-lg font-bold text-green-700 dark:text-green-300">
                                                        {format(new Date(booking.actualEndTime), 'h:mm a')}
                                                    </div>
                                                </div>
                                            ) : booking.status !== 'cancelled' ? (
                                                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center">
                                                        <Clock size={12} className="mr-1" /> Estimated Start
                                                    </div>
                                                    <div className="text-lg font-bold text-primary">
                                                        {booking.estimatedStartTime
                                                            ? format(new Date(booking.estimatedStartTime), 'h:mm a')
                                                            : 'Calculating...'}
                                                    </div>
                                                    <div className="text-xs text-slate-400 mt-1">
                                                        Come in ~{Math.round(booking.estimatedWaitTime || 0)} min
                                                        (estimate, may vary)
                                                    </div>
                                                </div>
                                            ) : null}

                                            <div className="text-xs text-slate-400 flex items-center">
                                                <Calendar size={12} className="mr-1" />
                                                Booked: {format(new Date(booking.bookingTime), 'MMM d, h:mm a')}
                                            </div>

                                            {booking.status === 'completed' && !booking.isRated && (
                                                <button
                                                    onClick={() => {
                                                        setBookingToRate(booking);
                                                        setRatingModalOpen(true);
                                                    }}
                                                    className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60 rounded-lg py-2 transition-colors"
                                                >
                                                    Rate this visit
                                                </button>
                                            )}
                                            {booking.status === 'completed' && booking.isRated && (
                                                <div className="text-xs text-center text-slate-400">
                                                    Thanks — you rated this visit
                                                    {booking.customerRating ? ` (${booking.customerRating}/5)` : ''}
                                                </div>
                                            )}

                                            {['pending', 'confirmed'].includes(booking.status) && (
                                                <button
                                                    onClick={() => handleCancel(booking._id)}
                                                    disabled={cancellingId === booking._id}
                                                    className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg py-2 transition-colors disabled:opacity-60"
                                                >
                                                    {cancellingId === booking._id ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : (
                                                        <XCircle size={14} />
                                                    )}
                                                    Cancel appointment
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <form
                    onSubmit={handleProfileSave}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-6 md:p-8 space-y-5"
                >
                    <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-slate-700">
                        <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <User size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Personal details</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Used for bookings, receipts, and salon contact.
                            </p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                                Full name
                            </label>
                            <input
                                required
                                value={profileForm.name}
                                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                                Email
                            </label>
                            <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-500">
                                <Mail size={16} />
                                <span className="text-sm truncate">{user?.email}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Email can&apos;t be changed here.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                                Phone
                            </label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    required
                                    value={profileForm.phone}
                                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                    placeholder="10-digit mobile"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                                City
                            </label>
                            <input
                                required
                                value={profileForm.city}
                                onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                                Address
                            </label>
                            <div className="relative">
                                <Home size={16} className="absolute left-3 top-3 text-slate-400" />
                                <textarea
                                    required
                                    rows={3}
                                    value={profileForm.address}
                                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={savingProfile}
                        className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-600 disabled:opacity-60 inline-flex items-center gap-2"
                    >
                        {savingProfile && <Loader2 size={16} className="animate-spin" />}
                        Save profile
                    </button>
                </form>
            )}

            {ratingModalOpen && bookingToRate && (
                <RatingModal
                    bookingId={bookingToRate._id}
                    salonName={
                        (typeof bookingToRate.salonId === 'object' && bookingToRate.salonId?.name) ||
                        'this salon'
                    }
                    onClose={() => dismissRatingPrompt(bookingToRate._id)}
                    onSuccess={() => {
                        dismissRatingPrompt(bookingToRate._id);
                        queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
                    }}
                />
            )}
        </div>
    );
};

export default Dashboard;
