import { useState } from 'react';
import { X, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Service {
    name: string;
    durationMin: number;
    price: number;
}

interface BookingModalProps {
    salonId: string;
    salonName: string;
    salonAddress: string;
    services: Service[];
    onClose: () => void;
    onSuccess: () => void;
}

const BookingModal = ({ salonId, salonName, salonAddress, services, onClose }: BookingModalProps) => {
    const [selectedService, setSelectedService] = useState<string>('');
    const navigate = useNavigate();

    const handleBooking = () => {
        if (!selectedService) return;

        const serviceObj = services.find(s => s.name === selectedService);
        if (!serviceObj) return;

        navigate('/checkout', {
            state: {
                salon: {
                    _id: salonId,
                    name: salonName,
                    address: salonAddress
                },
                selectedServices: [serviceObj]
            }
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Book at {salonName}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Service</label>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {services.map((service) => (
                                <button
                                    key={service.name}
                                    onClick={() => setSelectedService(service.name)}
                                    className={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center
                    ${selectedService === service.name
                                            ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'}`}
                                >
                                    <div>
                                        <div className="font-medium text-slate-900 dark:text-white">{service.name}</div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center mt-1">
                                            <Clock size={12} className="mr-1" />
                                            {service.durationMin} mins
                                        </div>
                                    </div>
                                    <div className="font-semibold text-slate-900 dark:text-white">₹{service.price}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleBooking}
                        disabled={!selectedService}
                        className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        Proceed to Checkout
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BookingModal;
