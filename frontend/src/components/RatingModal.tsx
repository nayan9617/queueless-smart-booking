import { useState } from 'react';
import { Star, X } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface RatingModalProps {
    bookingId: string;
    salonName: string;
    onClose: () => void;
    onSuccess: () => void;
}

const RatingModal = ({ bookingId, salonName, onClose, onSuccess }: RatingModalProps) => {
    const [rating, setRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) return;

        setIsSubmitting(true);
        try {
            await api.post(`/bookings/${bookingId}/rate`, { rating });
            toast.success('Thank you for your feedback!');
            onSuccess();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to submit rating');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-xl p-6 relative animate-fade-in">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Rate your Experience</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        How was your service at <span className="font-semibold text-primary">{salonName}</span>?
                    </p>
                </div>

                <div className="flex justify-center gap-2 mb-8">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(0)}
                            onClick={() => setRating(star)}
                            className="transition-transform hover:scale-110 focus:outline-none"
                        >
                            <Star
                                size={32}
                                className={`${star <= (hoveredRating || rating)
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'fill-transparent text-slate-300 dark:text-slate-600'
                                    } transition-colors duration-200`}
                            />
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={rating === 0 || isSubmitting}
                    className="w-full bg-primary hover:bg-blue-600 text-white py-3 rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
            </div>
        </div>
    );
};

export default RatingModal;
