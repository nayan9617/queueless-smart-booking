import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Salon from '../models/Salon';
import User from '../models/User';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const salons = [
    {
        name: "Trim & Taper",
        address: "123 Main St, Tech City",
        coordinates: { lat: 26.2389, lng: 73.0243 }, // Jodhpur coords
        chairs: 3,
        status: "open",
        services: [
            { name: "Haircut", durationMin: 30, price: 250 },
            { name: "Beard Trim", durationMin: 15, price: 150 },
            { name: "Massage", durationMin: 45, price: 500 }
        ],
        images: [
            "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80",
            "https://images.unsplash.com/photo-1503951914875-452162b7f30a?w=800&q=80"
        ],
        rating: 4.8,
        reviewCount: 128
    },
    {
        name: "The Executive Lounge",
        address: "45 Corporate Park, Tech City",
        coordinates: { lat: 26.2689, lng: 73.0043 },
        chairs: 5,
        status: "open",
        services: [
            { name: "Premium Haircut", durationMin: 45, price: 400 },
            { name: "Facial", durationMin: 30, price: 600 },
            { name: "Full Package", durationMin: 90, price: 1200 }
        ],
        images: [
            "https://images.unsplash.com/photo-1521590832896-7ea20ade7ee5?w=800&q=80",
            "https://images.unsplash.com/photo-1599351431202-1e0f0137d9c8?w=800&q=80"
        ],
        rating: 4.9,
        reviewCount: 85
    },
    {
        name: "Quick Cuts",
        address: "88 Market Road",
        coordinates: { lat: 26.2189, lng: 73.0543 },
        chairs: 2,
        status: "break",
        services: [
            { name: "Basic Cut", durationMin: 20, price: 150 },
            { name: "Shave", durationMin: 10, price: 100 }
        ],
        images: [
            "https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?w=800&q=80"
        ],
        rating: 4.2,
        reviewCount: 45
    }
];

const seedSalons = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || '', { dbName: 'queueless' });
        console.log('Connected to MongoDB');

        // Create a dummy owner
        let owner = await User.findOne({ email: 'owner@example.com' });
        if (!owner) {
            owner = await User.create({
                name: "Salon Owner",
                email: "owner@example.com",
                password: "password123",
                role: "salon_owner"
            });
            console.log('Created dummy salon owner');
        }

        // Clear existing salons
        await Salon.deleteMany({});
        console.log('Cleared existing salons');

        // Add ownerId to salons and insert
        const salonsWithOwner = salons.map(salon => ({ ...salon, ownerId: owner?._id }));
        await Salon.insertMany(salonsWithOwner);

        console.log(`Seeded ${salons.length} salons successfully`);
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedSalons();
