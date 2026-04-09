import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Calendar, Clock, MapPin, Loader2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import RatingModal from '../components/RatingModal';
import { useState, useEffect } from 'react';

interface Booking {
    _id: string;
    salonId: {
        name: string;
        address: string;
    };
    serviceType: string;
    status: string;
    bookingTime: string;
    estimatedStartTime: string;
    estimatedWaitTime: number;
    actualEndTime?: string;
    isRated?: boolean;
}

const Dashboard = () => {
    const { data: bookings, isLoading, error } = useQuery<Booking[]>({
        queryKey: ['my-bookings'],
        queryFn: async () => {
            const res = await api.get('/bookings/my-bookings');
            return res.data;
        },
    });

    const [ratingModalOpen, setRatingModalOpen] = useState(false);
    const [bookingToRate, setBookingToRate] = useState<Booking | null>(null);

    // Check for completed bookings that haven't been rated
    useEffect(() => {
        if (bookings) {
            const unratedBooking = bookings.find(b => b.status === 'completed' && !b.isRated);
            if (unratedBooking) {
                setBookingToRate(unratedBooking);
                setRatingModalOpen(true);
            }
        }
    }, [bookings]);

    const handleRatingSuccess = () => {
        setRatingModalOpen(false);
        setBookingToRate(null);
        // Refresh bookings to update isRated status
        // In a real app, we might want to invalidate queries
        window.location.reload();
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-20 text-red-500">
                Error loading bookings.
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Dashboard</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Manage your appointments and track live status.</p>
            </div>

            <div className="space-y-6">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Active Bookings</h2>

                {bookings?.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-100 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400">
                        No active bookings found. Time for a haircut?
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {bookings?.map((booking) => (
                            <div key={booking._id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between md:justify-start gap-3">
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{booking.salonId.name}</h3>
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-md uppercase ${booking.status === 'completed'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                            }`}>
                                            {booking.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm">
                                        <MapPin size={14} className="mr-1" />
                                        {booking.salonId.address}
                                    </div>
                                    <div className="text-slate-700 dark:text-slate-300 font-medium">
                                        {booking.serviceType}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 min-w-[200px]">
                                    {booking.status === 'completed' && booking.actualEndTime ? (
                                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-900/30">
                                            <div className="text-xs text-green-600 dark:text-green-400 mb-1 flex items-center">
                                                <CheckCircle size={12} className="mr-1" /> Completed At
                                            </div>
                                            <div className="text-lg font-bold text-green-700 dark:text-green-300">
                                                {format(new Date(booking.actualEndTime), 'h:mm a')}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center">
                                                <Clock size={12} className="mr-1" /> Estimated Start
                                            </div>
                                            <div className="text-lg font-bold text-primary">
                                                {booking.estimatedStartTime ? format(new Date(booking.estimatedStartTime), 'h:mm a') : 'Calculating...'}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-1">
                                                Wait: ~{Math.round(booking.estimatedWaitTime || 0)} mins
                                            </div>
                                        </div>
                                    )}

                                    <div className="text-xs text-slate-400 flex items-center">
                                        <Calendar size={12} className="mr-1" />
                                        Booked: {format(new Date(booking.bookingTime), 'MMM d, h:mm a')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {ratingModalOpen && bookingToRate && (
                <RatingModal
                    bookingId={bookingToRate._id}
                    salonName={bookingToRate.salonId.name}
                    onClose={() => setRatingModalOpen(false)}
                    onSuccess={handleRatingSuccess}
                />
            )}
        </div>
    );
};

export default Dashboard;
