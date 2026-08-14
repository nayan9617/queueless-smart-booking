import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';
import toast from 'react-hot-toast';
import { CreditCard, User, MapPin, Loader2, StickyNote, ShieldCheck } from 'lucide-react';
import { loadRazorpayScript } from '../utils/razorpay';

interface CheckoutState {
    salon: any;
    selectedServices: any[];
}

const Checkout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, updateUser } = useAuthStore();
    const state = location.state as CheckoutState | null;

    const [services, setServices] = useState(
        () =>
            state?.selectedServices?.map((s) => ({
                ...s,
                guestName: user?.name || 'Guest',
            })) || []
    );

    const [contactInfo, setContactInfo] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        email: user?.email || '',
    });
    const [notes, setNotes] = useState('');
    const [saveToProfile, setSaveToProfile] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const totalAmount = useMemo(() => services.reduce((acc, s) => acc + s.price, 0), [services]);
    const totalDuration = useMemo(
        () => services.reduce((acc, s) => acc + (s.durationMin || s.duration || 0), 0),
        [services]
    );

    if (!state?.salon || !state?.selectedServices?.length) {
        navigate('/salons');
        return null;
    }

    const { salon } = state;

    const handleServiceGuestChange = (index: number, name: string) => {
        const next = [...services];
        next[index].guestName = name;
        setServices(next);
    };

    const confirmOnServer = async (
        bookingId: string,
        paymentPayload: Record<string, unknown>
    ) => {
        await api.post('/bookings/verify-payment', {
            bookingId,
            ...paymentPayload,
        });
    };

    const openRazorpay = async (booking: any, payment: any) => {
        const ready = await loadRazorpayScript();
        if (!ready) {
            throw new Error('Could not load Razorpay checkout');
        }

        return new Promise<void>((resolve, reject) => {
            const rzp = new window.Razorpay({
                key: payment.keyId,
                amount: payment.amount,
                currency: payment.currency || 'INR',
                name: 'QueueLess',
                description: `Booking at ${salon.name}`,
                order_id: payment.orderId,
                prefill: {
                    name: contactInfo.name,
                    email: contactInfo.email,
                    contact: contactInfo.phone,
                },
                notes: {
                    bookingId: String(booking._id),
                    salonId: String(salon._id),
                },
                theme: { color: '#2563eb' },
                handler: async (response: any) => {
                    try {
                        await confirmOnServer(booking._id, {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                },
                modal: {
                    ondismiss: () => reject(new Error('Payment cancelled')),
                },
            });

            rzp.on('payment.failed', () => {
                reject(new Error('Payment failed. Please try again.'));
            });

            rzp.open();
        });
    };

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!contactInfo.phone || contactInfo.phone.length < 10) {
            toast.error('Enter a valid phone number');
            return;
        }
        if (!contactInfo.email) {
            toast.error('Email is required for booking confirmation');
            return;
        }

        setIsProcessing(true);

        try {
            if (saveToProfile) {
                try {
                    const profileRes = await api.patch('/auth/me', {
                        name: contactInfo.name,
                        phone: contactInfo.phone,
                    });
                    updateUser(profileRes.data.user);
                } catch {
                    // Non-blocking — booking can continue
                }
            }

            const bookingServices = services.map((s) => ({
                name: s.name,
                price: s.price,
                duration: s.durationMin || s.duration,
                guestName: s.guestName,
            }));

            const clientRequestId =
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID()
                    : `bk_${Date.now()}_${Math.random().toString(36).slice(2)}`;

            const res = await api.post(
                '/bookings',
                {
                    salonId: salon._id,
                    services: bookingServices,
                    contactInfo,
                    notes,
                    clientRequestId,
                },
                { headers: { 'Idempotency-Key': clientRequestId } }
            );

            const { booking, payment } = res.data;

            if (payment?.provider === 'razorpay') {
                await openRazorpay(booking, payment);
            } else {
                await confirmOnServer(booking._id, { demo: true });
                toast('Completed in demo mode (add Razorpay keys for live payments)', { icon: 'ℹ️' });
            }

            toast.success('Appointment confirmed! Check your email.');
            navigate('/dashboard');
        } catch (error: any) {
            const message =
                error?.response?.data?.message ||
                error?.message ||
                'Booking or payment failed';
            toast.error(message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 pt-4 pb-10">
            <div className="md:col-span-2 space-y-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-100 dark:border-slate-700">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                        <User className="text-primary" /> Guest details
                    </h2>
                    <div className="space-y-4">
                        {services.map((service, index) => (
                            <div
                                key={index}
                                className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700"
                            >
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900 dark:text-white">{service.name}</div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400">
                                        {service.durationMin || service.duration} min • ₹{service.price}
                                    </div>
                                </div>
                                <div className="sm:w-1/2">
                                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                                        Guest name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        value={service.guestName}
                                        onChange={(e) => handleServiceGuestChange(index, e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-100 dark:border-slate-700">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                        <User className="text-primary" /> Contact for confirmation
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Full name
                            </label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                value={contactInfo.name}
                                onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Phone
                            </label>
                            <input
                                type="tel"
                                required
                                minLength={10}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                value={contactInfo.phone}
                                onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                                placeholder="10-digit mobile"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                value={contactInfo.email}
                                onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                            />
                        </div>
                    </div>
                    <label className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={saveToProfile}
                            onChange={(e) => setSaveToProfile(e.target.checked)}
                            className="rounded border-slate-300"
                        />
                        Save name &amp; phone to my profile
                    </label>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-100 dark:border-slate-700">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                        <StickyNote className="text-primary" /> Notes for salon
                    </h2>
                    <textarea
                        rows={3}
                        placeholder="Allergies, preferred stylist, arrival notes…"
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-100 dark:border-slate-700">
                    <h2 className="text-xl font-bold mb-3 flex items-center gap-2 text-slate-900 dark:text-white">
                        <CreditCard className="text-primary" /> Payment
                    </h2>
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
                        <ShieldCheck className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={20} />
                        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                            <p className="font-medium">Secure checkout via Razorpay</p>
                            <p className="text-blue-700/90 dark:text-blue-300/90">
                                Cards, UPI, netbanking, and wallets. Appointment is confirmed only after payment
                                succeeds. Use Razorpay <strong>Test Mode</strong> keys for free testing.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-100 dark:border-slate-700 sticky top-24">
                    <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Order summary</h2>

                    <div className="mb-6">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{salon.name}</h3>
                        <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 mt-1">
                            <MapPin size={14} /> {salon.address}
                        </div>
                    </div>

                    <div className="space-y-3 mb-6 border-b border-slate-100 dark:border-slate-700 pb-6">
                        {services.map((s, i) => (
                            <div key={i} className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                                <span>{s.name}</span>
                                <span className="font-medium">₹{s.price}</span>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2 mb-6">
                        <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                            <span>Total duration</span>
                            <span>{totalDuration} mins</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white">
                            <span>Total</span>
                            <span>₹{totalAmount}</span>
                        </div>
                    </div>

                    <form onSubmit={handlePayment}>
                        <button
                            type="submit"
                            disabled={isProcessing}
                            className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {isProcessing ? <Loader2 className="animate-spin" /> : `Pay ₹${totalAmount}`}
                        </button>
                    </form>

                    <p className="text-center text-xs text-slate-400 mt-4">
                        You&apos;ll join the live queue after payment. Confirmation email goes to{' '}
                        {contactInfo.email || 'your email'}.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
