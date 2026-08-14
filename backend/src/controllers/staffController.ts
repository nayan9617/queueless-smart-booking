import { Request, Response } from 'express';
import Salon from '../models/Salon';
import { logger } from '../utils/logger';

// Add new staff member
export const addStaff = async (req: Request, res: Response) => {
    try {
        const { name, role } = req.body;
        // @ts-ignore
        const ownerId = req.user.id;

        const salon = await Salon.findOne({ ownerId });
        if (!salon) {
            return res.status(404).json({ message: 'Salon not found for this user' });
        }

        salon.staff.push({
            name,
            role: role || 'barber',
            isAvailable: true
        } as any);

        await salon.save();
        logger.event('staff_created', { salonId: String(salon._id), name });
        res.status(201).json(salon.staff);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Remove staff member
export const removeStaff = async (req: Request, res: Response) => {
    try {
        const { staffId } = req.params;
        // @ts-ignore
        const ownerId = req.user.id;

        const salon = await Salon.findOne({ ownerId });
        if (!salon) {
            return res.status(404).json({ message: 'Salon not found' });
        }

        salon.staff = salon.staff.filter(s => s._id.toString() !== staffId);
        await salon.save();
        res.json(salon.staff);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Toggle staff availability
export const updateStaffAvailability = async (req: Request, res: Response) => {
    try {
        const { staffId } = req.params;
        const { isAvailable } = req.body;
        // @ts-ignore
        const ownerId = req.user.id;

        const salon = await Salon.findOne({ ownerId });
        if (!salon) {
            return res.status(404).json({ message: 'Salon not found' });
        }

        const staff = salon.staff.find(s => s._id.toString() === staffId);
        if (!staff) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        staff.isAvailable = isAvailable;
        await salon.save();
        logger.event('staff_updated', {
            salonId: String(salon._id),
            staffId,
            isAvailable,
        });
        res.json(staff);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Get all staff
export const getStaff = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const ownerId = req.user.id;
        const salon = await Salon.findOne({ ownerId });

        if (!salon) {
            return res.status(404).json({ message: 'Salon not found' });
        }

        res.json(salon.staff);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
