import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Salon from '../models/Salon';
import User from '../models/User';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

/** Verified working Unsplash URLs (HTTP 200 as of seed update). */
const IMAGES = {
    barberVintage: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=80',
    barberTools: 'https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?auto=format&fit=crop&w=1200&q=80',
    barberChair: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1200&q=80',
    barberCut: 'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=1200&q=80',
    barberClose: 'https://images.unsplash.com/photo-1493256338651-d82f7acb2b38?auto=format&fit=crop&w=1200&q=80',
    salonInterior: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
    salonMirror: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
    salonModern: 'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?auto=format&fit=crop&w=1200&q=80',
    hairStyle: 'https://images.unsplash.com/photo-1522338140262-f46f5913618a?auto=format&fit=crop&w=1200&q=80',
    hairDryer: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=1200&q=80',
    makeup: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=1200&q=80',
    spa: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=1200&q=80',
    scissors: 'https://images.unsplash.com/photo-1593702295094-aea22597af65?auto=format&fit=crop&w=1200&q=80',
    products: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=1200&q=80',
    stylist: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=1200&q=80',
    wash: 'https://images.unsplash.com/photo-1512690459411-b9245aed614b?auto=format&fit=crop&w=1200&q=80',
    blowdry: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=1200&q=80',
    hairCare: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=1200&q=80',
    lounge: 'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?auto=format&fit=crop&w=1200&q=80',
    salonDetail: 'https://images.unsplash.com/photo-1582095133179-bfd08e2fc6b3?auto=format&fit=crop&w=1200&q=80',
};

const FALLBACK_IMAGES = [IMAGES.barberVintage, IMAGES.salonInterior, IMAGES.barberTools];

const salons = [
    {
        name: 'Trim & Taper',
        address: '123 Main St, Sardarpura, Jodhpur',
        coordinates: { lat: 26.2389, lng: 73.0243 },
        chairs: 3,
        status: 'open' as const,
        services: [
            { name: 'Haircut', durationMin: 30, price: 250 },
            { name: 'Beard Trim', durationMin: 15, price: 150 },
            { name: 'Head Massage', durationMin: 20, price: 200 },
        ],
        images: [IMAGES.barberVintage, IMAGES.barberTools],
        rating: 4.8,
        reviewCount: 128,
        staff: [
            { name: 'Amit Sharma', role: 'barber' as const, isAvailable: true },
            { name: 'Ravi Meena', role: 'barber' as const, isAvailable: true },
        ],
    },
    {
        name: 'The Executive Lounge',
        address: '45 Corporate Park, Paota, Jodhpur',
        coordinates: { lat: 26.2689, lng: 73.0043 },
        chairs: 5,
        status: 'open' as const,
        services: [
            { name: 'Premium Haircut', durationMin: 45, price: 400 },
            { name: 'Facial', durationMin: 30, price: 600 },
            { name: 'Full Grooming Package', durationMin: 90, price: 1200 },
        ],
        images: [IMAGES.lounge, IMAGES.barberChair, IMAGES.products],
        rating: 4.9,
        reviewCount: 85,
        staff: [
            { name: 'Kabir Singh', role: 'manager' as const, isAvailable: true },
            { name: 'Dev Patel', role: 'barber' as const, isAvailable: true },
            { name: 'Arjun Rao', role: 'barber' as const, isAvailable: false },
        ],
    },
    {
        name: 'Quick Cuts',
        address: '88 Market Road, Clock Tower, Jodhpur',
        coordinates: { lat: 26.2189, lng: 73.0543 },
        chairs: 2,
        status: 'break' as const,
        services: [
            { name: 'Basic Cut', durationMin: 20, price: 150 },
            { name: 'Shave', durationMin: 10, price: 100 },
        ],
        images: [IMAGES.barberCut, IMAGES.barberClose],
        rating: 4.2,
        reviewCount: 45,
        staff: [{ name: 'Suresh', role: 'barber' as const, isAvailable: false }],
    },
    {
        name: 'Northside Cuts',
        address: '12 Residency Road, Ratanada, Jodhpur',
        coordinates: { lat: 26.2521, lng: 73.0169 },
        chairs: 4,
        status: 'open' as const,
        services: [
            { name: 'Fade Haircut', durationMin: 35, price: 300 },
            { name: 'Beard Sculpt', durationMin: 20, price: 180 },
            { name: 'Kids Cut', durationMin: 25, price: 200 },
            { name: 'Hair Color Touch-up', durationMin: 40, price: 550 },
        ],
        images: [IMAGES.scissors, IMAGES.salonDetail],
        rating: 4.6,
        reviewCount: 96,
        staff: [
            { name: 'Nikhil Jain', role: 'barber' as const, isAvailable: true },
            { name: 'Imran Khan', role: 'barber' as const, isAvailable: true },
        ],
    },
    {
        name: 'Bliss Studio Salon',
        address: '7th Floor, Plaza Mall, Chopasni Road, Jodhpur',
        coordinates: { lat: 26.2804, lng: 73.0207 },
        chairs: 6,
        status: 'open' as const,
        services: [
            { name: 'Haircut & Style', durationMin: 40, price: 450 },
            { name: 'Keratin Smooth', durationMin: 120, price: 2500 },
            { name: 'Bridal Makeup Trial', durationMin: 90, price: 1800 },
            { name: 'Manicure', durationMin: 35, price: 400 },
        ],
        images: [IMAGES.salonInterior, IMAGES.salonMirror, IMAGES.salonModern],
        rating: 4.7,
        reviewCount: 210,
        staff: [
            { name: 'Priya Shah', role: 'manager' as const, isAvailable: true },
            { name: 'Neha Gupta', role: 'barber' as const, isAvailable: true },
            { name: 'Ananya Roy', role: 'barber' as const, isAvailable: true },
        ],
    },
    {
        name: 'Royal Razor Barbers',
        address: 'Near Ummed Garden, Circuit House Road, Jodhpur',
        coordinates: { lat: 26.2912, lng: 73.0381 },
        chairs: 3,
        status: 'open' as const,
        services: [
            { name: 'Classic Haircut', durationMin: 30, price: 280 },
            { name: 'Hot Towel Shave', durationMin: 25, price: 220 },
            { name: 'Mustache Trim', durationMin: 10, price: 80 },
        ],
        images: [IMAGES.barberChair, IMAGES.barberTools],
        rating: 4.5,
        reviewCount: 67,
        staff: [
            { name: 'Vikram Rathore', role: 'barber' as const, isAvailable: true },
            { name: 'Jai Singh', role: 'barber' as const, isAvailable: true },
        ],
    },
    {
        name: 'Glow & Go Unisex',
        address: 'Shop 14, Basni Industrial Area, Jodhpur',
        coordinates: { lat: 26.2035, lng: 73.0122 },
        chairs: 4,
        status: 'closed' as const,
        services: [
            { name: 'Express Cut', durationMin: 25, price: 200 },
            { name: 'Blow Dry', durationMin: 30, price: 350 },
            { name: 'Threading', durationMin: 15, price: 80 },
        ],
        images: [IMAGES.blowdry, IMAGES.hairDryer, IMAGES.spa],
        rating: 4.1,
        reviewCount: 33,
        staff: [
            { name: 'Meera Joshi', role: 'barber' as const, isAvailable: false },
            { name: 'Pooja Verma', role: 'barber' as const, isAvailable: false },
        ],
    },
    {
        name: 'Urban Edge Hair Co.',
        address: 'Opposite AIIMS, Basni Phase 2, Jodhpur',
        coordinates: { lat: 26.2408, lng: 72.9981 },
        chairs: 5,
        status: 'open' as const,
        services: [
            { name: 'Signature Cut', durationMin: 40, price: 350 },
            { name: 'Beard Color', durationMin: 25, price: 300 },
            { name: 'Scalp Therapy', durationMin: 35, price: 450 },
            { name: 'Hair Spa', durationMin: 50, price: 700 },
        ],
        images: [IMAGES.barberCut, IMAGES.salonDetail],
        rating: 4.4,
        reviewCount: 112,
        staff: [
            { name: 'Rohit Das', role: 'manager' as const, isAvailable: true },
            { name: 'Farhan Ali', role: 'barber' as const, isAvailable: true },
            { name: 'Yash Chouhan', role: 'barber' as const, isAvailable: true },
        ],
    },
    {
        name: 'Silk Scissors Boutique',
        address: 'Near Kaylana Lake Road, Jodhpur',
        coordinates: { lat: 26.3045, lng: 72.9788 },
        chairs: 3,
        status: 'open' as const,
        services: [
            { name: 'Precision Cut', durationMin: 45, price: 500 },
            { name: 'Balayage Consult', durationMin: 30, price: 0 },
            { name: 'Deep Conditioning', durationMin: 40, price: 650 },
        ],
        images: [IMAGES.hairDryer, IMAGES.hairStyle, IMAGES.makeup],
        rating: 4.85,
        reviewCount: 54,
        staff: [
            { name: 'Ishita Kapoor', role: 'manager' as const, isAvailable: true },
            { name: 'Sara Khan', role: 'barber' as const, isAvailable: true },
        ],
    },
    {
        name: 'Campus Clippers',
        address: 'Near MBM Engineering College, Jodhpur',
        coordinates: { lat: 26.2736, lng: 73.0355 },
        chairs: 2,
        status: 'open' as const,
        services: [
            { name: 'Student Cut', durationMin: 20, price: 120 },
            { name: 'Beard Trim', durationMin: 12, price: 80 },
            { name: 'Combo Cut + Beard', durationMin: 30, price: 180 },
        ],
        images: [IMAGES.stylist, IMAGES.wash, IMAGES.hairCare],
        rating: 4.0,
        reviewCount: 29,
        staff: [{ name: 'Lucky', role: 'barber' as const, isAvailable: true }],
    },
];

const seedSalons = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || '', { dbName: 'queueless' });
        console.log('Connected to MongoDB');

        let owner = await User.findOne({ email: 'owner@example.com' });
        if (!owner) {
            owner = await User.create({
                name: 'Salon Owner',
                email: 'owner@example.com',
                password: 'password123',
                role: 'salon_owner',
                phone: '9876543210',
                address: 'Jodhpur, Rajasthan',
                city: 'Jodhpur',
                emailVerified: true,
            });
            console.log('Created dummy salon owner (owner@example.com / password123)');
        } else if (owner.emailVerified === false) {
            owner.emailVerified = true;
            await owner.save();
        }

        await Salon.deleteMany({});
        console.log('Cleared existing salons');

        const salonsWithOwner = salons.map((salon) => ({
            ...salon,
            ownerId: owner!._id,
            images: salon.images?.length ? salon.images : FALLBACK_IMAGES,
        }));

        await Salon.insertMany(salonsWithOwner);
        console.log(`Seeded ${salons.length} salons with verified thumbnail URLs`);

        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedSalons();
