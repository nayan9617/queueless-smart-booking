import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const Home: React.FC = () => {
    const { isAuthenticated, user } = useAuthStore();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (isAuthenticated) {
            navigate(user?.role === 'salon_owner' ? '/admin/dashboard' : '/dashboard');
        }
    }, [isAuthenticated, user, navigate]);

    return (
        <div className="space-y-16">
            {/* Hero Section */}
            <section className="text-center space-y-6 py-12 md:py-20">
                <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Smart Salon Booking <br /> & Wait-Time Prediction
                </h1>
                <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                    Skip the queue. Book your slot, track live wait times, and arrive exactly when it's your turn.
                </p>
                <div className="flex justify-center gap-4">
                    <Link
                        to="/salons"
                        className="bg-primary hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                    >
                        Find a Salon
                    </Link>
                    <Link
                        to="/register"
                        className="hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-8 py-3 rounded-xl font-semibold transition-all"
                    >
                        Partner with Us
                    </Link>
                </div>
            </section>

            {/* Features Grid */}
            <section className="grid md:grid-cols-3 gap-8">
                <FeatureCard
                    icon={<Clock className="text-blue-500" size={32} />}
                    title="AI Wait Prediction"
                    description="Know exactly when to arrive with our smart ML-powered wait time estimates."
                />
                <FeatureCard
                    icon={<Calendar className="text-indigo-500" size={32} />}
                    title="Remote Booking"
                    description="Book your spot from anywhere. No need to physically wait in line."
                />
                <FeatureCard
                    icon={<Users className="text-purple-500" size={32} />}
                    title="Live Queue Tracking"
                    description="See who's ahead of you and get real-time updates on your turn."
                />
            </section>
        </div>
    );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow">
        <div className="mb-4 bg-slate-50 dark:bg-slate-900 w-12 h-12 rounded-lg flex items-center justify-center">
            {icon}
        </div>
        <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-white">{title}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
    </div>
);

export default Home;
