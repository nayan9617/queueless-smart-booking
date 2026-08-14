import { Request, Response } from 'express';
import Salon from '../models/Salon';
import Booking from '../models/Booking';
import { predictWaitTime } from '../services/mlService';
import { logger } from '../utils/logger';

export const getSalons = async (req: Request, res: Response) => {
    try {
        const { search, lat, lng, sort } = req.query;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const query: Record<string, unknown> = {};

        if (search) {
            const term = String(search).slice(0, 100);
            query.$or = [
                { name: { $regex: term, $options: 'i' } },
                { address: { $regex: term, $options: 'i' } },
            ];
        }

        let sortOption: any = { rating: -1 };
        if (sort === 'rating') sortOption = { rating: -1 };
        if (sort === 'newest') sortOption = { createdAt: -1 };

        const total = await Salon.countDocuments(query);
        let salons: any[] = await Salon.find(query)
            .sort(sortOption)
            .populate('ownerId', 'name')
            .skip(lat && lng && sort !== 'rating' ? 0 : skip)
            .limit(lat && lng && sort !== 'rating' ? 200 : limit);

        if (lat && lng && sort !== 'rating') {
            const userLat = parseFloat(lat as string);
            const userLng = parseFloat(lng as string);

            salons = salons
                .map((salon: any) => {
                    const coords = salon.coordinates || { lat: 0, lng: 0 };
                    const R = 6371;
                    const dLat = deg2rad(coords.lat - userLat);
                    const dLon = deg2rad(coords.lng - userLng);
                    const a =
                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(deg2rad(userLat)) *
                            Math.cos(deg2rad(coords.lat)) *
                            Math.sin(dLon / 2) *
                            Math.sin(dLon / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    const d = R * c;
                    return { ...salon.toObject(), distance: d };
                })
                .sort((a: any, b: any) => a.distance - b.distance)
                .slice(skip, skip + limit);
        }

        logger.event('salon_search', {
            search: search ? String(search).slice(0, 40) : undefined,
            sort: sort ? String(sort) : undefined,
            nearby: Boolean(lat && lng),
            resultCount: salons.length,
        });

        res.json({
            data: salons,
            pagination: {
                page,
                limit,
                total,
                hasNext: skip + salons.length < total,
            },
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}


export const getSalonById = async (req: Request, res: Response) => {
    try {
        const salon = await Salon.findById(req.params.id).populate('ownerId', 'name');
        if (!salon) {
            return res.status(404).json({ message: 'Salon not found' });
        }
        logger.event('salon_viewed', { salonId: String(salon._id) });
        res.json(salon);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

/** Public live wait estimate from the hybrid ML + queue snapshot. */
export const getSalonWaitEstimate = async (req: Request, res: Response) => {
    try {
        const salon = await Salon.findById(req.params.id);
        if (!salon) {
            return res.status(404).json({ message: 'Salon not found' });
        }

        const activeInQueue = await Booking.find({
            salonId: salon._id,
            status: { $in: ['confirmed', 'in-progress'] },
            paymentStatus: 'paid',
        }).select('services status actualStartTime');

        const now = new Date();
        const queueWorkload = activeInQueue.reduce((sum, b: any) => {
            const duration = (b.services || []).reduce(
                (acc: number, s: any) => acc + Number(s.duration || 0),
                0
            );
            const base = duration > 0 ? duration : 30;
            if (b.status === 'in-progress' && b.actualStartTime) {
                const elapsed = Math.max(
                    0,
                    (now.getTime() - new Date(b.actualStartTime).getTime()) / 60000
                );
                return sum + Math.max(0, base - elapsed);
            }
            return sum + base;
        }, 0);

        const avgService =
            salon.services?.length
                ? salon.services.reduce((a: number, s: any) => a + Number(s.duration || 30), 0) /
                  salon.services.length
                : 30;

        const activeStaffCount = (salon.staff || []).filter((s: any) => s.isAvailable).length;
        const effectiveBarbers =
            activeStaffCount > 0 ? activeStaffCount : Math.max(1, salon.staff?.length || 1);

        const prediction = await predictWaitTime({
            queue_length: activeInQueue.length,
            active_barbers: effectiveBarbers,
            service_duration_avg: Number(req.query.duration) || avgService,
            time_of_day: now.getHours() * 60 + now.getMinutes(),
            day_of_week: (now.getDay() + 6) % 7,
            total_chairs: salon.chairs,
            queue_workload: queueWorkload,
        });

        res.json({
            salonId: salon._id,
            salonName: salon.name,
            queueLength: activeInQueue.length,
            activeBarbers: effectiveBarbers,
            estimatedWaitTime: prediction.waitTime,
            confidence: prediction.confidence,
            method: prediction.method,
        });
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
        if (images !== undefined) salon.images = Array.isArray(images) ? images : salon.images;
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
        const { name, address, chairs, coordinates, services, images } = req.body;
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
            images: Array.isArray(images) ? images.filter(Boolean) : [],
            rating: 0,
            reviewCount: 0,
            staff: []
        });

        logger.event('salon_created', { salonId: String(newSalon._id), chairs: newSalon.chairs });
        res.status(201).json(newSalon);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

/** Owner uploads salon photos from device (multipart). */
export const uploadSalonImages = async (req: Request, res: Response) => {
    try {
        const salon = await Salon.findById(req.params.id);
        if (!salon) {
            return res.status(404).json({ message: 'Salon not found' });
        }
        // @ts-ignore
        if (salon.ownerId.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const files = (req.files as Express.Multer.File[]) || [];
        if (!files.length) {
            return res.status(400).json({ message: 'No images uploaded' });
        }

        const urls = files.map((f) => `/uploads/salons/${f.filename}`);
        salon.images = [...(salon.images || []), ...urls];
        await salon.save();

        res.json({ images: salon.images, added: urls });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};
