import { Request, Response, NextFunction } from 'express';

/** Require JWT payload role to be salon_owner (or admin). */
export const requireSalonOwner = (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const role = req.user?.role;
    if (role !== 'salon_owner' && role !== 'admin') {
        return res.status(403).json({ message: 'Salon owner access required' });
    }
    next();
};
