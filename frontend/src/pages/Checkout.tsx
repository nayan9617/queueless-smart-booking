import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';
import toast from 'react-hot-toast';
import { CreditCard, User, MapPin, Loader2 } from 'lucide-react';

interface CheckoutState {
    salon: any;
    selectedServices: any[]; // Array of service objects
}

const Checkout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const state = location.state as CheckoutState;

    if (!state?.salon || !state?.selectedServices) {
        navigate('/salons');
        return null; // Ensure we don't render anything if redirecting
    }

    const { salon } = state;

    // Transform initial services to include guestName (default to user)
    const [services, setServices] = useState(state.selectedServices.map(s => ({
        ...s,
        guestName: user?.name || 'Guest'
    })));

    const [contactInfo, setContactInfo] = useState({
        phone: (user as any)?.phone || '',
        email: user?.email || ''
    });

    const [isProcessing, setIsProcessing] = useState(false);

    const totalAmount = services.reduce((acc, s) => acc + s.price, 0);
    const totalDuration = services.reduce((acc, s) => acc + s.durationMin, 0);

    const handleServiceGuestChange = (index: number, name: string) => {
        const newServices = [...services];
        newServices[index].guestName = name;
        setServices(newServices);
    };

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);

        try {
            // Transform services for API
            const bookingServices = services.map(s => ({
                name: s.name,
                price: s.price,
                duration: s.durationMin,
                guestName: s.guestName
            }));

            await api.post('/bookings', {
                salonId: salon._id,
                services: bookingServices,
                contactInfo,
                paymentDetails: { method: 'credit_card', status: 'paid' } // Mock
            });

            toast.success('Booking confirmed! Check your email.');
            navigate('/dashboard'); // Or /success
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Booking failed');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
            {/* Left Column: Forms */}
            <div className="md:col-span-2 space-y-8">
                {/* Guest Management */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-100 dark:border-slate-700">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                        <User className="text-primary" /> Guest Details
                    </h2>
                    <div className="space-y-4">
                        {services.map((service, index) => (
                            <div key={index} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900 dark:text-white">{service.name}</div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400">{service.durationMin} min • ${service.price}</div>
                                </div>
                                <div className="w-1/2">
                                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Guest Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={service.guestName}
                                        onChange={(e) => handleServiceGuestChange(index, e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Contact Info */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-100 dark:border-slate-700">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                        <User className="text-primary" /> Contact Info
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                            <input
                                type="tel"
                                required
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={contactInfo.phone}
                                onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                            <input
                                type="email"
                                required
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={contactInfo.email}
                                onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Payment */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-100 dark:border-slate-700">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                        <CreditCard className="text-primary" /> Payment Method
                    </h2>
                    <div className="p-4 border border-blue-100 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-900/30 rounded-lg mb-4">
                        <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-medium mb-1">
                            <span className="bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200 text-xs px-2 py-0.5 rounded">TEST MODE</span>
                            Mock Payment
                        </div>
                        <p className="text-sm text-blue-600 dark:text-blue-400">No real charge will be made.</p>
                    </div>

                    <form id="checkout-form" onSubmit={handlePayment} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Card Number</label>
                            <input type="text" placeholder="0000 0000 0000 0000" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expiry</label>
                                <input type="text" placeholder="MM/YY" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CVC</label>
                                <input type="text" placeholder="123" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {/* Right Column: Order Summary */}
            <div className="space-y-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-100 dark:border-slate-700 sticky top-24">
                    <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Order Summary</h2>

                    <div className="mb-6">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{salon.name}</h3>
                        <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 mt-1">
                            <MapPin size={14} /> {salon.address}
                        </div>
                    </div>

                    <div className="space-y-3 mb-6 border-b border-slate-100 dark:border-slate-700 pb-6">
                        {services.map((s, i) => (
                            <div key={i} className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                                <span>{s.name} (x1)</span>
                                <span className="font-medium">${s.price}</span>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2 mb-6">
                        <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                            <span>Total Duration</span>
                            <span>{totalDuration} mins</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white">
                            <span>Total</span>
                            <span>${totalAmount}</span>
                        </div>
                    </div>

                    <button
                        form="checkout-form"
                        disabled={isProcessing}
                        className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {isProcessing ? <Loader2 className="animate-spin" /> : 'Pay & Secure Appointment'}
                    </button>

                    <p className="text-center text-xs text-slate-400 mt-4">
                        By booking, you agree to our Terms of Service.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
