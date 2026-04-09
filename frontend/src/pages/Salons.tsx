import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { MapPin, Loader2, Search } from 'lucide-react';

interface Service {
    name: string;
    durationMin: number;
    price: number;
}

interface Salon {
    _id: string;
    name: string;
    address: string;
    status: 'open' | 'closed' | 'break';
    services: Service[];
    ownerId: {
        name: string;
    };
    images?: string[];
    rating?: number;
    reviewCount?: number;
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import BookingModal from '../components/BookingModal';
import { Star } from 'lucide-react';

const Salons = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'rating' | 'location'>('rating');
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    // Get user location on mount if they want to sort by location
    const handleLocationClick = () => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                    setSortBy('location');
                },
                (error) => {
                    console.error("Error getting location:", error);
                    alert("Could not get your location. Please enable location services.");
                }
            );
        } else {
            alert("Geolocation is not supported by your browser.");
        }
    };

    const { data: salons, isLoading, error } = useQuery<Salon[]>({
        queryKey: ['salons', searchTerm, sortBy, userLocation],
        queryFn: async () => {
            const params: any = {};
            if (searchTerm) params.search = searchTerm;
            if (sortBy === 'rating') params.sort = 'rating';
            if (userLocation) {
                params.lat = userLocation.lat;
                params.lng = userLocation.lng;
            }

            const res = await api.get('/salons', { params });
            return res.data;
        },
    });

    const handleBookClick = (salon: Salon) => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        setSelectedSalon(salon);
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
                Error loading salons. Please try again.
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Find a Salon</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Discover the best barbers & salons near you.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search salons..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50 w-full sm:w-64"
                        />
                    </div>

                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        <button
                            onClick={() => setSortBy('rating')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${sortBy === 'rating' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            Top Rated
                        </button>
                        <button
                            onClick={handleLocationClick}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${sortBy === 'location' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            Near Me
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {salons?.map((salon) => (
                    <div key={salon._id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow group">
                        <div className="h-48 bg-slate-100 dark:bg-slate-900 w-full relative overflow-hidden">
                            {salon.images && salon.images.length > 0 ? (
                                <img
                                    src={salon.images[0]}
                                    alt={salon.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                    <span className="text-sm font-medium">No Image Available</span>
                                </div>
                            )}
                            <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1 dark:text-white">
                                <Star size={12} className="text-yellow-500 fill-yellow-500" />
                                {salon.rating || 'New'} <span className="text-slate-400 font-normal">({salon.reviewCount || 0})</span>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{salon.name}</h3>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium 
                  ${salon.status === 'open' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                                    {salon.status.toUpperCase()}
                                </span>
                            </div>

                            <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm mb-4">
                                <MapPin size={16} className="mr-1" />
                                {salon.address}
                                {/* @ts-ignore */}
                                {salon.distance && (
                                    <span className="ml-2 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded-full">
                                        {/* @ts-ignore */}
                                        {salon.distance.toFixed(1)} km away
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2 mb-6">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Services:</p>
                                <div className="flex flex-wrap gap-2">
                                    {salon.services.slice(0, 3).map((service, idx) => (
                                        <span key={idx} className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-md text-xs border border-slate-100 dark:border-slate-700">
                                            {service.name}
                                        </span>
                                    ))}
                                    {salon.services.length > 3 && (
                                        <span className="text-xs text-slate-400 py-1">+ {salon.services.length - 3} more</span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => handleBookClick(salon)}
                                className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-white py-2 rounded-lg font-medium transition-colors"
                            >
                                Book Appointment
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {selectedSalon && (
                <BookingModal
                    salonId={selectedSalon._id}
                    salonName={selectedSalon.name}
                    salonAddress={selectedSalon.address}
                    services={selectedSalon.services}
                    onClose={() => setSelectedSalon(null)}
                    onSuccess={() => {
                        alert('Booking Confirmed! You will receive a notification shortly.');
                        // TODO: Adding toast notification later
                    }}
                />
            )}
        </div>
    );
};

export default Salons;
