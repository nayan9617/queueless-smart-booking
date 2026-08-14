import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Calendar,
    Clock,
    Users,
    MapPin,
    Bell,
    Scissors,
    BarChart3,
    Smartphone,
    ArrowRight,
    CheckCircle2,
    ChevronDown,
} from 'lucide-react';
import {
    motion,
    useScroll,
    useTransform,
    useSpring,
    useInView,
} from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';

const fadeUp = {
    hidden: { opacity: 0, y: 36 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
    },
};

const Home: React.FC = () => {
    const { isAuthenticated, user } = useAuthStore();
    const navigate = useNavigate();
    const heroRef = useRef<HTMLElement>(null);
    const manifestoRef = useRef<HTMLElement>(null);
    const stepsRef = useRef<HTMLElement>(null);

    const { scrollYProgress: heroProgress } = useScroll({
        target: heroRef,
        offset: ['start start', 'end start'],
    });

    const { scrollYProgress: manifestoProgress } = useScroll({
        target: manifestoRef,
        offset: ['start end', 'end start'],
    });

    const { scrollYProgress: stepsProgress } = useScroll({
        target: stepsRef,
        offset: ['start end', 'end start'],
    });

    const brandY = useTransform(heroProgress, [0, 1], [0, -120]);
    const brandScale = useTransform(heroProgress, [0, 1], [1, 0.86]);
    const brandOpacity = useTransform(heroProgress, [0, 0.75], [1, 0]);
    const dialRotate = useTransform(heroProgress, [0, 1], [0, 28]);
    const atmosphereY = useTransform(heroProgress, [0, 1], [0, 160]);

    const manifestoX = useSpring(useTransform(manifestoProgress, [0.15, 0.55], [80, 0]), {
        stiffness: 60,
        damping: 22,
    });
    const manifestoOpacity = useTransform(manifestoProgress, [0.1, 0.35], [0, 1]);

    const stepsX = useTransform(stepsProgress, [0.1, 0.7], [60, -40]);

    React.useEffect(() => {
        if (isAuthenticated) {
            navigate(user?.role === 'salon_owner' ? '/admin/dashboard' : '/dashboard');
        }
    }, [isAuthenticated, user, navigate]);

    return (
        <div className="pb-16 overflow-x-hidden">
            {/* Hero */}
            <section
                ref={heroRef}
                className="relative min-h-[calc(100svh-4rem)] flex items-center overflow-hidden home-atmosphere"
            >
                <motion.div
                    style={{ y: atmosphereY }}
                    className="pointer-events-none absolute inset-0"
                    aria-hidden="true"
                >
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-size-[64px_64px] mask-[radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
                    <WaitDial className="absolute right-[-6%] top-[18%] w-[min(58vw,440px)] opacity-50 dark:opacity-60 dial-breathe hidden md:block" style={{ rotate: dialRotate }} />
                    <WaitDial className="absolute right-[-20%] bottom-[12%] w-[min(70vw,280px)] opacity-30 dark:opacity-40 dial-breathe md:hidden" style={{ rotate: dialRotate }} />
                </motion.div>

                <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-16 md:py-20 text-center">
                    <motion.div
                        style={{ y: brandY, scale: brandScale, opacity: brandOpacity }}
                        className="flex flex-col items-center space-y-8 md:space-y-10"
                    >
                        <motion.p
                            className="font-display text-[clamp(3.5rem,12vw,8.5rem)] leading-[0.85] font-extrabold tracking-[-0.04em] text-slate-900 dark:text-white"
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                        >
                            QueueLess
                        </motion.p>

                        <div className="max-w-2xl space-y-5 flex flex-col items-center">
                            <motion.h1
                                className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight"
                                initial={{ opacity: 0, y: 24 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                            >
                                Smart salon booking & wait-time prediction.
                            </motion.h1>
                            <motion.p
                                className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-lg leading-relaxed"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.7, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            >
                                Skip the queue. Book your slot, track live wait times, and arrive exactly when it&apos;s your turn.
                            </motion.p>
                            <motion.div
                                className="flex flex-wrap justify-center gap-3 pt-1"
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.65, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
                            >
                                <Link
                                    to="/salons"
                                    className="bg-primary hover:bg-blue-600 text-white px-7 py-3 rounded-xl font-semibold transition-colors"
                                >
                                    Find a Salon
                                </Link>
                                <Link
                                    to="/register"
                                    className="border border-slate-300 dark:border-slate-600 hover:bg-white/60 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-100 px-7 py-3 rounded-xl font-semibold transition-colors"
                                >
                                    Partner with Us
                                </Link>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>

                <div className="absolute bottom-0 inset-x-0 overflow-hidden border-t border-slate-200/60 dark:border-slate-700/60 bg-white/40 dark:bg-slate-950/30 backdrop-blur-sm" aria-hidden="true">
                    <div className="queue-track flex whitespace-nowrap py-3 text-sm font-medium tracking-[0.2em] uppercase text-slate-500 dark:text-slate-400">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <span key={i} className="flex shrink-0">
                                <span className="mx-6">Book remotely</span>
                                <span className="mx-6 text-blue-500">·</span>
                                <span className="mx-6">Predict the wait</span>
                                <span className="mx-6 text-blue-500">·</span>
                                <span className="mx-6">Arrive on time</span>
                                <span className="mx-6 text-blue-500">·</span>
                                <span className="mx-6">Skip the line</span>
                                <span className="mx-6 text-blue-500">·</span>
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* Manifesto — expensive scroll beat */}
            <section ref={manifestoRef} className="relative py-28 md:py-40 px-4 sm:px-6 overflow-hidden">
                <motion.div style={{ x: manifestoX, opacity: manifestoOpacity }} className="max-w-5xl mx-auto">
                    <p className="font-display text-[clamp(2.25rem,7vw,5.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-slate-900 dark:text-white">
                        Your time is expensive.
                        <span className="block text-blue-600 dark:text-blue-400 mt-2 md:mt-4">
                            Waiting shouldn&apos;t be.
                        </span>
                    </p>
                    <p className="mt-8 max-w-xl text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                        QueueLess turns salon queues into predicted minutes — so the chair is ready when you are,
                        not the other way around.
                    </p>
                </motion.div>
            </section>

            {/* How it works */}
            <section ref={stepsRef} className="py-8 md:py-12">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
                    <div className="max-w-2xl space-y-3">
                        <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                            How QueueLess works
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg">
                            Three steps from discovery to your chair — without standing in line.
                        </p>
                    </div>

                    <motion.div style={{ x: stepsX }} className="grid md:grid-cols-3 gap-8 md:gap-10 will-change-transform">
                        {[
                            {
                                step: '01',
                                title: 'Find a salon',
                                body: 'Browse nearby salons, services, and live queue status before you leave home.',
                            },
                            {
                                step: '02',
                                title: 'Book & get a wait estimate',
                                body: 'Reserve your spot. Our ML model estimates wait time from queue length, staff, and timing.',
                            },
                            {
                                step: '03',
                                title: 'Arrive on your turn',
                                body: 'Track your place in the queue in real time and walk in when you are next.',
                            },
                        ].map((item) => (
                            <div key={item.step} className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-6">
                                <p className="font-display text-4xl font-bold text-blue-600/90 dark:text-blue-400/90 tabular-nums">
                                    {item.step}
                                </p>
                                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{item.body}</p>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Features */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 space-y-12">
                <div className="max-w-2xl space-y-3">
                    <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Built for busy days
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg">
                        Everything you need to plan your visit around real wait times — not guesses.
                    </p>
                </div>
                <motion.div
                    className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ staggerChildren: 0.14 }}
                >
                    <FeatureCard
                        icon={<Clock className="text-blue-500" size={28} />}
                        title="AI wait prediction"
                        description="Know when to arrive with ML-powered estimates based on queue length, active barbers, and time of day."
                    />
                    <FeatureCard
                        icon={<Calendar className="text-blue-500" size={28} />}
                        title="Remote booking"
                        description="Book your spot from anywhere. No need to physically wait in line or call ahead."
                    />
                    <FeatureCard
                        icon={<Users className="text-blue-500" size={28} />}
                        title="Live queue tracking"
                        description="See who is ahead of you and get real-time updates as the queue moves."
                    />
                </motion.div>
            </section>

            {/* Wait preview */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                    <motion.div
                        className="space-y-5"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.35 }}
                        variants={fadeUp}
                    >
                        <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                            See your wait before you leave
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg leading-relaxed">
                            Estimates use live salon data — queue length, staff, and service timing — so you spend
                            less time sitting around.
                        </p>
                        <ul className="space-y-3">
                            {[
                                'Live queue length and staff availability',
                                'Predicted wait in minutes, not vague ranges',
                                'Updates as bookings start and finish',
                            ].map((line) => (
                                <li key={line} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                                    <CheckCircle2 className="text-blue-500 shrink-0 mt-0.5" size={20} />
                                    <span>{line}</span>
                                </li>
                            ))}
                        </ul>
                    </motion.div>

                    <WaitPreviewCard />
                </div>
            </section>

            {/* Audiences */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24 space-y-12">
                <div className="max-w-2xl space-y-3">
                    <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Two sides, one smoother visit
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg">
                        Customers get time back. Owners get a clearer, calmer floor.
                    </p>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                    <AudiencePanel
                        title="For customers"
                        points={[
                            { icon: <MapPin size={18} />, text: 'Discover salons and services near you' },
                            { icon: <Smartphone size={18} />, text: 'Book from your phone in under a minute' },
                            { icon: <Bell size={18} />, text: 'Follow your place in the live queue' },
                            { icon: <Clock size={18} />, text: 'Plan around predicted wait times' },
                        ]}
                        cta={{ to: '/register', label: 'Create customer account' }}
                    />
                    <AudiencePanel
                        title="For salon owners"
                        points={[
                            { icon: <Scissors size={18} />, text: 'Manage staff availability and chairs' },
                            { icon: <Users size={18} />, text: 'Run a live digital queue on the floor' },
                            { icon: <BarChart3 size={18} />, text: 'Keep bookings organized in one dashboard' },
                            { icon: <Calendar size={18} />, text: 'Reduce walk-in chaos and no-shows' },
                        ]}
                        cta={{ to: '/register', label: 'List your salon' }}
                    />
                </div>
            </section>

            {/* FAQ */}
            <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-20 space-y-8">
                <div className="space-y-3">
                    <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Common questions
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg">
                        Quick answers before you book or partner with us.
                    </p>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-700 border-y border-slate-200 dark:border-slate-700">
                    {[
                        {
                            q: 'How accurate is the wait-time prediction?',
                            a: 'We blend a gradient-boosted model trained on real completed visits with a live queue simulator (staff, chairs, remaining service minutes). Confidence rises as your salon logs more history and retrains.',
                        },
                        {
                            q: 'Do I need an account to browse salons?',
                            a: 'You can explore the product from the home page. Signing up unlocks booking, queue tracking, and your personal dashboard.',
                        },
                        {
                            q: 'Can salon owners manage staff and live queues?',
                            a: 'Yes. Owner accounts get a dashboard for staff availability, salon settings, and live booking status so the floor stays in sync.',
                        },
                        {
                            q: 'Is QueueLess only for hair salons?',
                            a: 'It is built around salon-style queues and appointments, but the same flow works for barbershops and similar walk-in booking businesses.',
                        },
                    ].map((item) => (
                        <FaqItem key={item.q} question={item.q} answer={item.a} />
                    ))}
                </div>
            </section>

            {/* Closing CTA */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
                <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-blue-950 text-white px-6 py-16 md:px-14 md:py-20">
                    <div className="absolute inset-0 home-atmosphere opacity-60" aria-hidden="true" />
                    <div className="relative space-y-6 max-w-2xl">
                        <p className="font-display text-4xl md:text-6xl font-extrabold tracking-tight leading-[0.95]">
                            Ready to skip the queue?
                        </p>
                        <p className="text-slate-300 text-base md:text-lg max-w-xl">
                            Find a salon near you, or register your shop and start offering smarter wait times today.
                        </p>
                        <div className="flex flex-wrap gap-3 pt-2">
                            <Link
                                to="/salons"
                                className="inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 px-7 py-3 rounded-xl font-semibold transition-colors"
                            >
                                Find a Salon
                                <ArrowRight size={18} />
                            </Link>
                            <Link
                                to="/register"
                                className="inline-flex items-center gap-2 border border-white/30 hover:bg-white/10 px-7 py-3 rounded-xl font-semibold transition-colors"
                            >
                                Partner with Us
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

const WaitDial = ({
    className,
    style,
}: {
    className?: string;
    style?: React.ComponentProps<typeof motion.svg>['style'];
}) => (
    <motion.svg viewBox="0 0 400 400" className={className} style={style} fill="none" aria-hidden="true">
        <circle cx="200" cy="200" r="168" stroke="currentColor" className="text-blue-500/25" strokeWidth="1.5" />
        <circle
            cx="200"
            cy="200"
            r="132"
            stroke="currentColor"
            className="text-blue-500/40"
            strokeWidth="2"
            strokeDasharray="14 10"
        />
        <circle cx="200" cy="200" r="88" stroke="currentColor" className="text-blue-600/50" strokeWidth="18" strokeLinecap="round" strokeDasharray="220 400" transform="rotate(-90 200 200)" />
        <text
            x="200"
            y="192"
            textAnchor="middle"
            className="fill-slate-900 dark:fill-white"
            style={{ fontSize: 42, fontFamily: 'Syne, sans-serif', fontWeight: 800 }}
        >
            18
        </text>
        <text
            x="200"
            y="224"
            textAnchor="middle"
            className="fill-slate-500 dark:fill-slate-400"
            style={{ fontSize: 14, fontFamily: 'Outfit, sans-serif', letterSpacing: '0.18em' }}
        >
            MIN WAIT
        </text>
    </motion.svg>
);

const WaitPreviewCard = () => {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, amount: 0.5 });
    const [minutes, setMinutes] = React.useState(0);

    React.useEffect(() => {
        if (!inView) return;
        let frame = 0;
        const target = 18;
        const id = window.setInterval(() => {
            frame += 1;
            const next = Math.min(target, Math.round((frame / 28) * target));
            setMinutes(next);
            if (next >= target) window.clearInterval(id);
        }, 32);
        return () => window.clearInterval(id);
    }, [inView]);

    return (
        <motion.div
            ref={ref}
            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 md:p-7 space-y-5"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden="true"
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Now at</p>
                    <p className="font-semibold text-slate-900 dark:text-white">Northside Cuts</p>
                </div>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md">
                    Open
                </span>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/80 p-5 space-y-1">
                <p className="text-sm text-slate-500 dark:text-slate-400">Estimated wait</p>
                <p className="font-display text-5xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                    {minutes} min
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">3 ahead · 2 barbers active</p>
            </div>
            <div className="space-y-3">
                {[
                    { label: 'You', meta: 'Haircut · booked', active: true },
                    { label: 'Guest 2', meta: '~12 min', active: false },
                    { label: 'Guest 1', meta: 'In chair', active: false },
                ].map((row) => (
                    <div
                        key={row.label}
                        className={`flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0 ${
                            row.active
                                ? 'text-blue-600 dark:text-blue-400 font-medium'
                                : 'text-slate-600 dark:text-slate-400'
                        }`}
                    >
                        <span>{row.label}</span>
                        <span className="text-sm">{row.meta}</span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

const FeatureCard = ({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) => (
    <motion.div
        variants={fadeUp}
        className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700"
    >
        <div className="mb-4 bg-slate-50 dark:bg-slate-900 w-12 h-12 rounded-lg flex items-center justify-center">
            {icon}
        </div>
        <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-white">{title}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
    </motion.div>
);

const AudiencePanel = ({
    title,
    points,
    cta,
}: {
    title: string;
    points: { icon: React.ReactNode; text: string }[];
    cta: { to: string; label: string };
}) => (
    <motion.div
        className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 space-y-6"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
        <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{title}</h3>
        <ul className="space-y-4">
            {points.map((point) => (
                <li key={point.text} className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                    <span className="mt-0.5 text-blue-500 shrink-0">{point.icon}</span>
                    <span>{point.text}</span>
                </li>
            ))}
        </ul>
        <Link
            to={cta.to}
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold hover:gap-3 transition-all"
        >
            {cta.label}
            <ArrowRight size={16} />
        </Link>
    </motion.div>
);

const FaqItem = ({ question, answer }: { question: string; answer: string }) => (
    <details className="group py-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold text-slate-900 dark:text-white">
            {question}
            <ChevronDown size={20} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <p className="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed pr-8">{answer}</p>
    </details>
);

export default Home;
