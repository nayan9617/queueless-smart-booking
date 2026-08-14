import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Loader2, Search, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import BookingModal from '../components/BookingModal';
import { mediaUrl } from '../utils/mediaUrl';

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
    distance?: number;
}

const FALLBACK_THUMB =
    'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=80';

const SalonThumbnail = ({ name, images }: { name: string; images?: string[] }) => {
    const candidates = [...(images || []).filter(Boolean).map(mediaUrl), FALLBACK_THUMB];
    const [index, setIndex] = useState(0);
    const [failed, setFailed] = useState<Record<number, boolean>>({});

    const visible = candidates.filter((_, i) => !failed[i]);
    const safeIndex = visible.length ? index % visible.length : 0;
    const src = visible[safeIndex] || FALLBACK_THUMB;
    const multi = visible.length > 1;

    return (
        <div className="relative w-full h-full">
            <img
                src={src}
                alt={name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={() => {
                    const realIdx = candidates.indexOf(src);
                    if (realIdx >= 0) setFailed((f) => ({ ...f, [realIdx]: true }));
                }}
            />
            {multi && (
                <>
                    <button
                        type="button"
                        aria-label="Previous photo"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIndex((i) => (i - 1 + visible.length) % visible.length);
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/45 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        type="button"
                        aria-label="Next photo"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIndex((i) => (i + 1) % visible.length);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/45 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <ChevronRight size={16} />
                    </button>
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                        {visible.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Photo ${i + 1}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIndex(i);
                                }}
                                className={`h-1.5 rounded-full transition-all ${
                                    i === safeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                                }`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const Salons = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'rating' | 'location'>('rating');
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationPrompted, setLocationPrompted] = useState(false);

    const requestLocation = (switchToNearMe = true) => {
        if (!('geolocation' in navigator)) {
            toast.error('Geolocation is not supported by your browser.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
                if (switchToNearMe) setSortBy('location');
                toast.success('Showing salons near you');
            },
            () => {
                toast.error('Could not get your location. Enable location for better Near Me results.');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    useEffect(() => {
        if (locationPrompted) return;
        setLocationPrompted(true);

        const remembered = sessionStorage.getItem('queueless_location_asked');
        if (remembered) return;
        sessionStorage.setItem('queueless_location_asked', '1');

        // Soft ask once per session so Near Me / distance work better
        requestLocation(false);
    }, [locationPrompted]);

    const { data: salons, isLoading, error } = useQuery<Salon[]>({
        queryKey: ['salons', searchTerm, sortBy, userLocation],
        queryFn: async () => {
            const params: Record<string, string | number> = {};
            if (searchTerm) params.search = searchTerm;

            if (sortBy === 'rating') {
                params.sort = 'rating';
            }

            if (sortBy === 'location' && userLocation) {
                params.sort = 'location';
                params.lat = userLocation.lat;
                params.lng = userLocation.lng;
            }

            const res = await api.get('/salons', { params });
            const body = res.data;
            return Array.isArray(body) ? body : body.data || [];
        },
    });

    const handleBookClick = (salon: Salon) => {
        if (!isAuthenticated) {
            navigate('/login', { state: { from: { pathname: '/salons' } } });
            return;
        }
        setSelectedSalon(salon);
    };

    const handleNearMeClick = () => {
        if (userLocation) {
            setSortBy('location');
            return;
        }
        requestLocation(true);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    if (error) {
        return <div className="text-center py-20 text-red-500">Error loading salons. Please try again.</div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Find a Salon</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        Discover the best barbers &amp; salons near you.
                        {userLocation && sortBy === 'location' ? ' Sorted by distance.' : ''}
                    </p>
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
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                sortBy === 'rating'
                                    ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            Top Rated
                        </button>
                        <button
                            onClick={handleNearMeClick}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all inline-flex items-center gap-1.5 ${
                                sortBy === 'location'
                                    ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            <MapPin size={14} />
                            Near Me
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {salons?.map((salon) => (
                    <div
                        key={salon._id}
                        className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow group"
                    >
                        <div className="h-48 bg-slate-100 dark:bg-slate-900 w-full relative overflow-hidden">
                            <SalonThumbnail name={salon.name} images={salon.images} />
                            <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1 dark:text-white">
                                <Star size={12} className="text-yellow-500 fill-yellow-500" />
                                {salon.rating || 'New'}{' '}
                                <span className="text-slate-400 font-normal">({salon.reviewCount || 0})</span>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{salon.name}</h3>
                                <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium 
                  ${
                      salon.status === 'open'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : salon.status === 'break'
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  }`}
                                >
                                    {salon.status.toUpperCase()}
                                </span>
                            </div>

                            <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm mb-4">
                                <MapPin size={16} className="mr-1 shrink-0" />
                                <span className="truncate">{salon.address}</span>
                                {typeof salon.distance === 'number' && (
                                    <span className="ml-2 shrink-0 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded-md">
                                        {salon.distance.toFixed(1)} km
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2 mb-6">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Services:</p>
                                <div className="flex flex-wrap gap-2">
                                    {salon.services.slice(0, 3).map((service, idx) => (
                                        <span
                                            key={idx}
                                            className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-md text-xs border border-slate-100 dark:border-slate-700"
                                        >
                                            {service.name}
                                        </span>
                                    ))}
                                    {salon.services.length > 3 && (
                                        <span className="text-xs text-slate-400 py-1">
                                            + {salon.services.length - 3} more
                                        </span>
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

            {(!salons || salons.length === 0) && (
                <p className="text-center text-slate-500 dark:text-slate-400 py-10">
                    No salons found. Try another search or sort.
                </p>
            )}

            {selectedSalon && (
                <BookingModal
                    salonId={selectedSalon._id}
                    salonName={selectedSalon.name}
                    salonAddress={selectedSalon.address}
                    services={selectedSalon.services}
                    onClose={() => setSelectedSalon(null)}
                    onSuccess={() => {
                        // Navigates to checkout; confirmation happens after payment
                    }}
                />
            )}
        </div>
    );
};

export default Salons;
