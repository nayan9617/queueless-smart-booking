import { Request, Response } from 'express';
import Salon from '../models/Salon';

export const getSalons = async (req: Request, res: Response) => {
    try {
        const { search, lat, lng, sort } = req.query;

        let query: any = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } }
            ];
        }

        // Sort by rating if requested
        let sortOption: any = {};
        if (sort === 'rating') {
            sortOption = { rating: -1 };
        }

        let salons = await Salon.find(query).sort(sortOption).populate('ownerId', 'name email');

        // Location based sorting (in-memory if lat/lng provided)
        if (lat && lng) {
            const userLat = parseFloat(lat as string);
            const userLng = parseFloat(lng as string);

            salons = salons.map((salon: any) => {
                // Calculate distance (Haversine formula approximation or simple Euclidean for now)
                // For simplicity/speed, using Euclidean as a very rough approximation or just relying on direct comparison if needed
                // Better: Haversine
                const R = 6371; // Radius of the earth in km
                const dLat = deg2rad(salon.coordinates.lat - userLat);
                const dLon = deg2rad(salon.coordinates.lng - userLng);
                const a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(deg2rad(userLat)) * Math.cos(deg2rad(salon.coordinates.lat)) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const d = R * c; // Distance in km

                return { ...salon.toObject(), distance: d };
            }).sort((a: any, b: any) => a.distance - b.distance);
        }

        res.json(salons);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}


export const getSalonById = async (req: Request, res: Response) => {
    try {
        const salon = await Salon.findById(req.params.id).populate('ownerId', 'name email');
        if (!salon) {
            return res.status(404).json({ message: 'Salon not found' });
        }
        res.json(salon);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};



export const updateSalon = async (req: Request, res: Response) => {
    try {
        const { status, images, services, name, address, chairs } = req.body;
        const salon = await Salon.findById(req.params.id);

        if (!salon) {
            return res.status(404).json({ message: 'Salon not found' });
        }

        // Check ownership
        // @ts-ignore
        if (salon.ownerId.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        if (status) salon.status = status;
        if (images) salon.images = images;
        if (services) salon.services = services;
        if (name) salon.name = name;
        if (address) salon.address = address;
        if (chairs) salon.chairs = chairs;

        await salon.save();
        res.json(salon);
    } catch (error: any) {
        console.error("Update Salon Error:", error);
        res.status(400).json({ message: error.message });
    }
};

// Admin/Owner only
export const createSalon = async (req: Request, res: Response) => {
    try {
        const { name, address, chairs, coordinates, services } = req.body;
        // @ts-ignore
        const ownerId = req.user.id;

        // Check if owner already has a salon
        const existingSalon = await Salon.findOne({ ownerId });
        if (existingSalon) {
            return res.status(400).json({ message: 'User already owns a salon' });
        }

        const newSalon = await Salon.create({
            ownerId,
            name,
            address,
            chairs: chairs || 1,
            coordinates: coordinates || { lat: 0, lng: 0 },
            services: services || [],
            status: 'open',
            images: [],
            rating: 0,
            reviewCount: 0,
            staff: []
        });

        res.status(201).json(newSalon);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};
